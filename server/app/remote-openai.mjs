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

function createRemoteConfigError({ code, message, remote, status = 503, details = undefined }) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  error.details = details;
  error.remote = remote;
  return error;
}

function remoteConfigErrorFor(remote) {
  if (remote.required && !remote.explicitRemoteRequest) {
    return createRemoteConfigError({
      code: 'REMOTE_RUNNER_REQUIRED_BUT_NOT_SELECTED',
      message: 'Remote execution is required, but this request did not select a remote runner.',
      remote,
      status: 400,
      details: {
        readiness: remote.readiness
      }
    });
  }

  if (remote.readiness === 'misconfigured') {
    return createRemoteConfigError({
      code: remote.required ? 'REMOTE_RUNNER_REQUIRED_BUT_INVALID_CONFIG' : 'REMOTE_RUNNER_INVALID_CONFIG',
      message: remote.reason,
      remote,
      status: remote.required ? 503 : 400,
      details: {
        readiness: remote.readiness,
        missing: {
          baseUrl: !remote.request.baseUrl,
          model: !remote.request.model
        }
      }
    });
  }

  if (remote.readiness === 'disabled' || remote.readiness === 'configured-but-disabled') {
    return createRemoteConfigError({
      code: remote.required ? 'REMOTE_RUNNER_REQUIRED_BUT_DISABLED' : 'REMOTE_RUNNER_DISABLED',
      message: remote.reason,
      remote,
      status: remote.required ? 503 : 400,
      details: {
        readiness: remote.readiness
      }
    });
  }

  if (remote.readiness === 'standby') {
    return createRemoteConfigError({
      code: remote.required ? 'REMOTE_RUNNER_REQUIRED_BUT_NOT_SELECTED' : 'REMOTE_RUNNER_NOT_SELECTED',
      message: remote.reason,
      remote,
      status: remote.required ? 503 : 400,
      details: {
        readiness: remote.readiness
      }
    });
  }

  return createRemoteConfigError({
    code: remote.required ? 'REMOTE_RUNNER_REQUIRED_BUT_UNAVAILABLE' : 'REMOTE_RUNNER_NOT_CALLABLE',
    message: remote.reason,
    remote,
    status: remote.required ? 503 : 400,
    details: {
      readiness: remote.readiness
    }
  });
}

// Define the multi-stage pipeline stages
const MULTI_STAGE_STAGES = [
  {
    id: 'jd-diagnosis',
    label: 'JD Diagnosis',
    prompt: 'Analyze the job description and provide a diagnosis of the role requirements, market positioning, and potential challenges in finding suitable candidates. Focus on identifying if the role is well-defined and realistic in the current market.'
  },
  {
    id: 'search-plan',
    label: 'Search Plan',
    prompt: 'Create a comprehensive search plan based on the role requirements. Include timeline, target companies, search channels, and success metrics for the search process.'
  },
  {
    id: 'sourcing-strategy',
    label: 'Sourcing Strategy',
    prompt: 'Develop a detailed sourcing strategy focusing on target companies, candidate profiles, outreach methods, and competitive landscape analysis.'
  },
  {
    id: 'candidate-assessment',
    label: 'Candidate Assessment Framework',
    prompt: 'Assess the candidate using only resume evidence from the provided payload. Return transparent structured reasoning for each dimension, including direct evidence quotes, a confidence label, and explicit 信息不足 when evidence is missing. Do not use black-box numeric scoring.'
  }
];

function buildMessages(payload, stage = null) {
  const ctx = payload.searchContext || {};
  
  if (stage) {
    // Multi-stage approach - each stage gets specific instructions
    const stageInfo = MULTI_STAGE_STAGES.find(s => s.id === stage.id) || MULTI_STAGE_STAGES[0];
    const isCandidateAssessment = stage.id === 'candidate-assessment';
    
    const system = [
      'You are a talent intelligence analyst specializing in executive search.',
      isCandidateAssessment ? 'Return only valid JSON.' : 'Return only markdown for this specific stage.',
      'Ground the answer strictly in the provided JSON payload.',
      'Do not claim external research or fabricated facts.'
    ].join(' ');

    const user = [
      `Generate talent intelligence deliverable for stage: ${stageInfo.label}`,
      stageInfo.prompt,
      `Role: ${ctx.roleTitle || 'Unknown Role'}`,
      `Company: ${ctx.company || 'Unknown Company'}`,
      `Industry: ${ctx.industry || 'Unknown Industry'}`,
      `Location: ${ctx.location || 'Unknown Location'}`,
      `Budget Range: ${ctx.salaryRange || 'Not specified'}`,
      'requestJson:',
      JSON.stringify(payload, null, 2),
      '',
      'Required output rules:',
      `- Focus specifically on: ${stageInfo.label}`,
      '- Use practical recruiter language.',
      isCandidateAssessment
        ? `- Return a JSON object with this shape: {"candidateName":"string","recommendation":"建议推进|谨慎推进|暂不推进","summary":"string","dimensions":[{"key":"relevant_experience|achievement_ownership|domain_alignment|risk_flags","label":"string","judgement":"string","confidence":"高|中|低","evidenceQuotes":["string"],"evidenceStatus":"证据充分|证据有限|信息不足","missingInformation":["string"]}],"overallRisks":[{"label":"string","detail":"string","confidence":"高|中|低","evidenceQuotes":["string"],"evidenceStatus":"证据充分|证据有限|信息不足"}],"followUpQuestions":["string"]}`
        : `- Title must mention role: ${ctx.roleTitle || 'Unknown Role'}`,
      isCandidateAssessment
        ? '- Every dimension must include direct evidenceQuotes copied or tightly quoted from the candidate resume fields in the payload.'
        : '- Use concise Chinese headings and bullets.',
      isCandidateAssessment
        ? '- If resume evidence is missing, set evidenceStatus to 信息不足 and explain what is missing in missingInformation. Never invent evidence.'
        : '- If information is missing, say TBD instead of inventing details.',
      isCandidateAssessment
        ? '- Do not output numeric scores, percentages, stars, or black-box ratings.'
        : ''
    ].filter(Boolean).join('\n');

    return [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ];
  } else {
    // Fallback to monolithic approach for backward compatibility
    const system = [
      'You are a talent intelligence analyst.',
      'Return only markdown.',
      'Use concise Chinese headings and bullets.',
      'Ground the answer strictly in the provided JSON payload.',
      'Do not claim external research or fabricated facts.'
    ].join(' ');

    const user = [
      'Generate a comprehensive talent intelligence deliverable in markdown.',
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

export async function callRemoteOpenAICompatible({ payload, runtime = {}, requestContext = {}, stage = null }) {
  const remote = resolveRemoteOpenAIConfig(runtime);

  if (!remote.callable) {
    throw remoteConfigErrorFor(remote);
  }

  const baseUrl = remote.request.baseUrl.replace(/\/+$/, '');
  const path = remote.request.path.startsWith('/') ? remote.request.path : `/${remote.request.path}`;
  const url = `${baseUrl}${path}`;
  const controller = new AbortController();
  const startedAtMs = Date.now();
  const timer = setTimeout(() => controller.abort(), remote.request.timeoutMs);

  // Check if streaming is requested
  const stream = runtime.stream === true;

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
      messages: buildMessages(payload, stage) // Pass stage to buildMessages
    };

    // Add response format if specified in runtime
    if (runtime.responseFormat) {
      body.response_format = runtime.responseFormat;
    } else if (runtime.jsonMode === true) {
      body.response_format = { type: "json_object" };
    }

    // Add streaming flag if requested
    if (stream) {
      body.stream = true;
      // For some providers like Bailian/Qwen, we might need different streaming options
      if (remote.request.model.includes('bailian') || remote.request.model.includes('qwen')) {
        // Some models may require specific streaming settings
        body.stream_options = { include_usage: true };
      } else {
        body.stream_options = { include_usage: true };
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      const rawText = await response.text();
      let parsed;
      try {
        parsed = rawText ? JSON.parse(rawText) : {};
      } catch {
        parsed = undefined;
      }

      const error = new Error(`Remote OpenAI-compatible request failed with HTTP ${response.status}`);
      error.code = 'REMOTE_RUNNER_HTTP_ERROR';
      error.status = response.status;
      error.responseBody = summarize(parsed || rawText);
      error.remote = remote;
      throw error;
    }

    let content = '';
    let parsedResponse = {}; // Store the final parsed response
    
    if (stream) {
      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          
          // Process each complete line
          let newlineIndex;
          while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            const line = buffer.substring(0, newlineIndex);
            buffer = buffer.substring(newlineIndex + 1);

            const trimmedLine = line.trim();
            
            // Skip empty lines and comments (data: [DONE])
            if (!trimmedLine || trimmedLine === 'data: [DONE]') {
              continue;
            }

            // Handle SSE format (data: ...)
            if (trimmedLine.startsWith('data: ')) {
              const dataStr = trimmedLine.slice(6); // Remove 'data: ' prefix
              
              if (dataStr === '[DONE]') {
                break;
              }

              try {
                const chunk = JSON.parse(dataStr);
                
                if (chunk.choices && chunk.choices.length > 0) {
                  const delta = chunk.choices[0].delta;
                  if (delta && delta.content) {
                    content += delta.content;
                  }
                  
                  // Check if we've reached the end
                  if (chunk.choices[0].finish_reason) {
                    break;
                  }
                }
                
                // Capture usage if present (usually in the final chunk)
                if (chunk.usage) {
                  parsedResponse.usage = chunk.usage;
                }
                
                // Capture response ID if present
                if (chunk.id) {
                  parsedResponse.id = chunk.id;
                }
              } catch (parseErr) {
                console.warn('Failed to parse SSE data:', dataStr);
                continue;
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } else {
      // Handle non-streaming response
      const rawText = await response.text();
      try {
        parsedResponse = rawText ? JSON.parse(rawText) : {};
      } catch {
        parsedResponse = undefined;
      }

      content = parsedResponse?.choices?.[0]?.message?.content || '';
    }

    if (!normalizeText(content)) {
      const error = new Error('Remote OpenAI-compatible response did not include content');
      error.code = 'REMOTE_RUNNER_BAD_RESPONSE';
      error.status = 502;
      error.responseBody = summarize(parsedResponse);
      error.remote = remote;
      throw error;
    }

    let parsedContent;
    const expectsJson = runtime.responseFormat?.type === 'json_object'
      || runtime.responseFormat === 'json_object'
      || runtime.jsonMode === true;
    if (expectsJson) {
      try {
        parsedContent = JSON.parse(content);
      } catch {
        const error = new Error('Remote OpenAI-compatible response returned invalid JSON content');
        error.code = 'REMOTE_RUNNER_BAD_RESPONSE';
        error.status = 502;
        error.responseBody = summarize(content);
        error.remote = remote;
        throw error;
      }
    }

    const completedAtMs = Date.now();
    const usage = parsedResponse?.usage || {};
    
    // Extract token usage metrics
    const tokenUsage = {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
      model: remote.request.model
    };
    
    return {
      reportMarkdown: String(content),
      structuredOutput: parsedContent,
      remoteInfo: {
        attempted: true,
        succeeded: true,
        baseUrl,
        path,
        model: remote.request.model,
        startedAt: toIso(startedAtMs),
        completedAt: toIso(completedAtMs),
        durationMs: completedAtMs - startedAtMs,
        responseId: parsedResponse?.id,
        finishReason: parsedResponse?.choices?.[0]?.finish_reason || 'stop',
        usage: parsedResponse?.usage,
        tokenUsage,
        stream: !!stream,
        stage: stage ? stage.id : null // Include stage info in remote info
      }
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`Remote OpenAI-compatible request timed out after ${remote.request.timeoutMs}ms`);
      timeoutError.code = 'REMOTE_RUNNER_TIMEOUT';
      timeoutError.status = 504;
      timeoutError.remote = remote;
      throw timeoutError;
    }

    if (!error?.code && error instanceof Error) {
      error.code = 'REMOTE_RUNNER_UNREACHABLE';
      error.status = 503;
      error.remote = remote;
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}
