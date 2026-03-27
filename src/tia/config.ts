// @ts-nocheck
import path from 'path';

function normalizeText(value, fallback = undefined) {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function resolveTiaConfig(overrides = {}) {
  const cwd = overrides.cwd || process.cwd();
  const pgUrl = normalizeText(overrides.pgUrl || process.env.PG_URL || process.env.TIA_PG_URL);
  const llmBaseUrl = normalizeText(overrides.llmBaseUrl || process.env.LLM_BASE_URL || process.env.TIA_LLM_BASE_URL);
  const llmApiKey = normalizeText(overrides.llmApiKey || process.env.LLM_API_KEY || process.env.TIA_LLM_API_KEY || process.env.OPENAI_API_KEY);
  const llmModel = normalizeText(overrides.llmModel || process.env.LLM_MODEL || process.env.TIA_LLM_MODEL, 'qwen-max');
  const embeddingBaseUrl = normalizeText(overrides.embeddingBaseUrl || process.env.TIA_EMBEDDING_BASE_URL || llmBaseUrl);
  const embeddingApiKey = normalizeText(overrides.embeddingApiKey || process.env.TIA_EMBEDDING_API_KEY || llmApiKey);
  const embeddingModel = normalizeText(overrides.embeddingModel || process.env.TIA_EMBEDDING_MODEL, 'text-embedding-3-small');
  const reportDir = path.resolve(cwd, normalizeText(overrides.reportDir || process.env.TIA_REPORT_DIR, 'state/reports'));
  const defaultWebhookUrls = normalizeList(overrides.defaultWebhookUrls || process.env.TIA_DEFAULT_WEBHOOK_URLS);

  return {
    cwd,
    pgUrl,
    llmBaseUrl,
    llmApiKey,
    llmModel,
    embeddingBaseUrl,
    embeddingApiKey,
    embeddingModel,
    reportDir,
    defaultWebhookUrls
  };
}
