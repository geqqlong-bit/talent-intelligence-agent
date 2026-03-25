function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hashString(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deterministicVector(text, dimensions = 1536) {
  const tokens = String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/i)
    .filter(Boolean);

  const vector = new Array(dimensions).fill(0);
  if (!tokens.length) return vector;

  for (const token of tokens) {
    const seed = hashString(token);
    const index = seed % dimensions;
    const signed = ((seed % 2000) / 1000) - 1;
    vector[index] = clamp(vector[index] + signed, -1, 1);
  }

  return vector.map((value) => Number(value.toFixed(6)));
}

export function createVectorizer(config = {}) {
  const {
    baseUrl,
    apiKey,
    model,
    timeoutMs = 30000,
    dimensions = 1536,
    logger = console
  } = config;

  return {
    async vectorizeText(text) {
      const fallbackVector = deterministicVector(text, dimensions);
      if (!baseUrl || !model) return fallbackVector;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
          },
          body: JSON.stringify({
            model,
            input: text
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          logger.warn?.(`[tia.vectorizer] embedding fallback after HTTP ${response.status}`);
          return fallbackVector;
        }

        const payload = await response.json();
        const vector = payload?.data?.[0]?.embedding;
        return Array.isArray(vector) && vector.length ? vector : fallbackVector;
      } catch {
        return fallbackVector;
      } finally {
        clearTimeout(timer);
      }
    }
  };
}
