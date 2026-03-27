// @ts-nocheck
function normalizeText(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function summarize(value, maxLength = 400) {
  if (value === undefined || value === null) return '';
  const raw = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return raw.length <= maxLength ? raw : `${raw.slice(0, maxLength - 3)}...`;
}

export function createLlmClient(config = {}) {
  const {
    baseUrl,
    apiKey,
    model,
    temperature = 0.3,
    maxTokens = 1200,
    timeoutMs = 45000,
    mockHandler = undefined,
    logger = console
  } = config;

  async function request({ messages, jsonMode = false, fallback = undefined }) {
    if (typeof mockHandler === 'function') {
      return mockHandler({ messages, jsonMode, fallback });
    }

    if (!baseUrl || !model) {
      if (typeof fallback === 'function') return fallback();
      throw new Error('LLM is not configured: missing baseUrl or model.');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
        },
        body: JSON.stringify({
          model,
          temperature,
          max_tokens: maxTokens,
          response_format: jsonMode ? { type: 'json_object' } : undefined,
          messages
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const text = await response.text();
        if (typeof fallback === 'function') {
          logger.warn?.(`[tia.llm] falling back after HTTP ${response.status}: ${summarize(text)}`);
          return fallback();
        }
        throw new Error(`LLM request failed: HTTP ${response.status} ${summarize(text)}`);
      }

      const payload = await response.json();
      const content = payload?.choices?.[0]?.message?.content;
      if (!normalizeText(content)) {
        if (typeof fallback === 'function') return fallback();
        throw new Error('LLM response did not include message content.');
      }

      return jsonMode ? JSON.parse(content) : String(content);
    } catch (error) {
      if (error?.name === 'AbortError') {
        if (typeof fallback === 'function') return fallback();
        throw new Error(`LLM request timed out after ${timeoutMs}ms`);
      }
      if (typeof fallback === 'function') {
        logger.warn?.(`[tia.llm] fallback activated: ${error.message}`);
        return fallback();
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async completeText({ system, user, fallback }) {
      return request({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        jsonMode: false,
        fallback
      });
    },
    async completeJson({ system, user, fallback }) {
      return request({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        jsonMode: true,
        fallback
      });
    }
  };
}
