// @ts-nocheck
function normalizeWebhookUrls(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (!value) return [];
  return [String(value).trim()].filter(Boolean);
}

const DEFAULT_TIMEOUT_MS = 10000;
const MAX_RETRIES = 2;
const RETRY_BASE_MS = 500;

async function fetchWithTimeout(url, options, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function sendWithRetry(url, payload, logger, retries = MAX_RETRIES) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      return {
        url,
        status: response.status,
        ok: response.ok,
        attempts: attempt + 1
      };
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        const delayMs = RETRY_BASE_MS * Math.pow(2, attempt);
        logger.warn?.(`[tia.webhook] ${url} attempt ${attempt + 1} failed: ${error.message}, retrying in ${delayMs}ms`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  return {
    url,
    status: 0,
    ok: false,
    attempts: MAX_RETRIES + 1,
    error: lastError?.name === 'AbortError' ? `Request timed out after ${DEFAULT_TIMEOUT_MS}ms` : (lastError?.message || String(lastError))
  };
}

export async function emitWebhookEvents(urls, payload, logger = console) {
  const targets = normalizeWebhookUrls(urls);
  if (!targets.length) return [];

  const results = await Promise.allSettled(
    targets.map((url) => sendWithRetry(url, payload, logger))
  );

  return results.map((result, index) => {
    if (result.status === 'fulfilled') return result.value;
    logger.warn?.(`[tia.webhook] ${targets[index]} failed: ${result.reason?.message || result.reason}`);
    return {
      url: targets[index],
      status: 0,
      ok: false,
      attempts: 1,
      error: result.reason?.message || String(result.reason)
    };
  });
}
