function normalizeText(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function toIso(valueMs) {
  return new Date(valueMs).toISOString();
}

function summarize(value, maxLength = 280) {
  if (value === undefined || value === null) return undefined;
  const raw = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  if (raw.length <= maxLength) return raw;
  return `${raw.slice(0, maxLength - 3)}...`;
}

function envFlag(name, fallback = false) {
  const raw = normalizeText(process.env[name]);
  if (!raw) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

function numberOr(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function resolveHeaderValue(runtimeValue, envValue) {
  const runtimeText = normalizeText(runtimeValue);
  if (runtimeText) return runtimeText;
  const envText = normalizeText(envValue);
  return envText || undefined;
}

function buildMessages(payload) {
  const ctx = payload.searchContext || {};
  const system = [
    'You are a talent intelligence analyst.',
    'Return only markdown.',
    'Use concise Chinese headings and bullets.',
    'Ground the answer strictly in the provided JSON payload.',
    'Do not claim external research or fabricated facts.'
  ].join(' ');

  const user = [
    'Generate a talent intelligence deliverable in markdown.',
    `templateId: ${payload.templateId}`,
    'requestJson:',
    JSON.stringify(payload, null, 2),
    '',
    'Required output rules:',
    `- Title must mention role: ${ctx.roleTitle || 'Unknown Role'}`,
    '- Include a short conclusion section first.',
    '- Use practical recruiter language.',
    '- If information is missing, say TBD instead of inventing details.'
  ].join('\n');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ];
}

export function resolveRemoteOpenAIConfig(runtime = {}) {
  const requestedRunner = normalizeText(runtime.runner || runtime.runnerId).toLowerCase();
  const requestedMode = normalizeText(runtime.executionMode || runtime.mode).toLowerCase();
  const explicitRemoteRequest = ['openai-chat', 'openai', 'remote-llm'].includes(requestedRunner)
    || ['openai', 'llm', 'remote'].includes(requestedMode);

  const allowRemote = runtime.allowRemote === true
    || runtime.remoteEnabled === true
    || envFlag('TALENT_INTEL_ENABLE_REMOTE_RUNNER', false);
  const remoteRequired = runtime.remoteRequired === true;
  const baseUrl = normalizeText(runtime.baseUrl || process.env.TALENT_INTEL_REMOTE_BASE_URL);
  const apiKey = normalizeText(runtime.apiKey || process.env.TALENT_INTEL_REMOTE_API_KEY);
  const model = normalizeText(runtime.model || process.env.TALENT_INTEL_DEFAULT_MODEL || 'bailian/qwen3.5-plus');
  const timeoutMs = numberOr(runtime.timeoutMs, 120000);
  const temperature = numberOr(runtime.temperature, 0.4);
  const maxTokens = numberOr(runtime.maxTokens, 5000);
  const path = normalizeText(runtime.path || process.env.TALENT_INTEL_REMOTE_PATH || '/chat/completions');
  const organization = resolveHeaderValue(runtime.organization, process.env.TALENT_INTEL_REMOTE_ORG);
  const project = resolveHeaderValue(runtime.project, process.env.TALENT_INTEL_REMOTE_PROJECT);

  const configured = Boolean(baseUrl && model);
  const callable = explicitRemoteRequest && allowRemote && configured;
  let readiness = 'disabled';
  if (callable) readiness = 'callable';
  else if (allowRemote && configured) readiness = 'standby';
  else if (allowRemote && !configured) readiness = 'misconfigured';
  else if (configured) readiness = 'configured-but-disabled';

  let reason = 'Remote runner is disabled by default; set runtime.allowRemote=true or TALENT_INTEL_ENABLE_REMOTE_RUNNER=1 to allow outbound calls.';
  if (readiness === 'callable') {
    reason = 'Remote runner is explicitly enabled and configured for OpenAI-compatible chat completions.';
  } else if (readiness === 'standby') {
    reason = 'Remote runner is configured and allowed, but this request did not explicitly select the remote adapter.';
  } else if (readiness === 'misconfigured') {
    reason = 'Remote runner was enabled but is missing baseUrl or model configuration.';
  } else if (readiness === 'configured-but-disabled') {
    reason = 'Remote runner configuration exists, but outbound calls remain disabled until explicitly enabled.';
  }

  return {
    enabled: allowRemote,
    required: remoteRequired,
    explicitRemoteRequest,
    configured,
    callable,
    readiness,
    reason,
    request: {
      baseUrl,
      apiKey,
      model,
      timeoutMs,
      temperature,
      maxTokens,
      path,
      organization,
      project
    }
  };
}

export async function callRemoteOpenAICompatible({ payload, runtime = {}, requestContext = {} }) {
  const remote = resolveRemoteOpenAIConfig(runtime);

  if (!remote.callable) {
    const error = new Error(remote.reason);
    error.code = remote.required ? 'REMOTE_RUNNER_REQUIRED_BUT_UNAVAILABLE' : 'REMOTE_RUNNER_NOT_CALLABLE';
    error.remote = remote;
    throw error;
  }

  const baseUrl = remote.request.baseUrl.replace(/\/+$/, '');
  const path = remote.request.path.startsWith('/') ? remote.request.path : `/${remote.request.path}`;
  const url = `${baseUrl}${path}`;
  const controller = new AbortController();
  const startedAtMs = Date.now();
  const timer = setTimeout(() => controller.abort(), remote.request.timeoutMs);

  try {
    const headers = {
      'Content-Type': 'application/json'
    };
    if (remote.request.apiKey) headers.Authorization = `Bearer ${remote.request.apiKey}`;
    if (remote.request.organization) headers['OpenAI-Organization'] = remote.request.organization;
    if (remote.request.project) headers['OpenAI-Project'] = remote.request.project;
    if (requestContext.requestId) headers['X-Request-Id'] = requestContext.requestId;

    const body = {
      model: remote.request.model,
      temperature: remote.request.temperature,
      max_tokens: remote.request.maxTokens,
      messages: buildMessages(payload)
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const rawText = await response.text();
    let parsed;
    try {
      parsed = rawText ? JSON.parse(rawText) : {};
    } catch {
      parsed = undefined;
    }

    if (!response.ok) {
      const error = new Error(`Remote OpenAI-compatible request failed with HTTP ${response.status}`);
      error.code = 'REMOTE_RUNNER_HTTP_ERROR';
      error.status = response.status;
      error.responseBody = summarize(parsed || rawText);
      error.remote = remote;
      throw error;
    }

    const content = parsed?.choices?.[0]?.message?.content;
    if (!normalizeText(content)) {
      const error = new Error('Remote OpenAI-compatible response did not include choices[0].message.content');
      error.code = 'REMOTE_RUNNER_BAD_RESPONSE';
      error.responseBody = summarize(parsed || rawText);
      error.remote = remote;
      throw error;
    }

    const completedAtMs = Date.now();
    return {
      reportMarkdown: String(content),
      remoteInfo: {
        attempted: true,
        succeeded: true,
        baseUrl,
        path,
        model: remote.request.model,
        startedAt: toIso(startedAtMs),
        completedAt: toIso(completedAtMs),
        durationMs: completedAtMs - startedAtMs,
        responseId: parsed?.id,
        finishReason: parsed?.choices?.[0]?.finish_reason,
        usage: parsed?.usage
      }
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`Remote OpenAI-compatible request timed out after ${remote.request.timeoutMs}ms`);
      timeoutError.code = 'REMOTE_RUNNER_TIMEOUT';
      timeoutError.remote = remote;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
