import crypto from 'crypto';

export const API_VERSION = 'v0.3';

export const TEMPLATE_IDS = [
  'jd_diagnosis_cn',
  'sourcing_strategy_cn',
  'candidate_assessment_cn',
  'search_plan_cn'
];

export function createRequestId(seed = undefined) {
  const raw = seed ? String(seed).trim() : '';
  return raw || `req_${crypto.randomUUID()}`;
}

export function json(res, status, payload, requestId = undefined) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8' };
  if (requestId) headers['X-Request-Id'] = requestId;
  res.writeHead(status, headers);
  res.end(JSON.stringify(payload, null, 2));
}

export function createError(code, message, details = undefined, status = 400, extras = {}) {
  return {
    ok: false,
    error: { code, message, details },
    status,
    ...extras
  };
}

export function withRequestMeta(payload, requestId, extras = {}) {
  return {
    ...payload,
    requestId,
    metadata: {
      requestId,
      apiVersion: API_VERSION,
      ...payload.metadata,
      ...extras
    }
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toStringArray(value) {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return [String(value).trim()].filter(Boolean);
}

function toOptionalString(value, fallback = undefined) {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
}

function toRequiredString(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

export function normalizeRequest(body = {}) {
  if (!isPlainObject(body)) {
    throw createError('INVALID_REQUEST', 'Request body must be a JSON object.');
  }

  const hasNestedSearchContext = isPlainObject(body.searchContext);
  const searchContext = hasNestedSearchContext ? body.searchContext : body;
  const runtime = isPlainObject(body.runtime) ? body.runtime : {};
  const templateId = body.templateId || searchContext.templateId || 'search_plan_cn';

  if (!TEMPLATE_IDS.includes(templateId)) {
    throw createError('INVALID_TEMPLATE', `Unsupported templateId: ${templateId}`, { allowed: TEMPLATE_IDS });
  }

  const normalized = {
    templateId,
    searchContext: {
      projectName: toOptionalString(searchContext.projectName, 'Talent Intelligence Task'),
      roleTitle: toRequiredString(searchContext.roleTitle),
      clientName: toOptionalString(searchContext.clientName),
      searchType: toOptionalString(searchContext.searchType, 'executive_search'),
      mandateType: toOptionalString(searchContext.mandateType),
      companyContext: toOptionalString(searchContext.companyContext, 'Employer context not specified'),
      companyStage: toOptionalString(searchContext.companyStage),
      businessModel: toOptionalString(searchContext.businessModel),
      teamStage: toOptionalString(searchContext.teamStage),
      hiringBrief: toOptionalString(searchContext.hiringBrief, 'Provide recruiting analysis and recommendations.'),
      objective: toOptionalString(searchContext.objective, 'Produce a structured talent intelligence deliverable.'),
      targetIndustry: toOptionalString(searchContext.targetIndustry, 'TBD'),
      targetCompanies: toStringArray(searchContext.targetCompanies),
      location: toOptionalString(searchContext.location, 'China'),
      targetGeographies: toStringArray(searchContext.targetGeographies),
      salaryRange: toOptionalString(searchContext.salaryRange, 'TBD'),
      compensationMix: toOptionalString(searchContext.compensationMix),
      equity: toOptionalString(searchContext.equity),
      reportingLine: toOptionalString(searchContext.reportingLine),
      level: toOptionalString(searchContext.level),
      headcount: toOptionalString(searchContext.headcount),
      urgency: toOptionalString(searchContext.urgency),
      searchReason: toOptionalString(searchContext.searchReason),
      successProfile: toOptionalString(searchContext.successProfile),
      successMetrics: toOptionalString(searchContext.successMetrics),
      marketSignals: toOptionalString(searchContext.marketSignals),
      stakeholderBrief: toOptionalString(searchContext.stakeholderBrief),
      mustHaveSkills: toStringArray(searchContext.mustHaveSkills),
      niceToHaveSkills: toStringArray(searchContext.niceToHaveSkills),
      dealBreakers: toStringArray(searchContext.dealBreakers),
      targetFunctions: toStringArray(searchContext.targetFunctions),
      targetBackgrounds: toStringArray(searchContext.targetBackgrounds),
      offLimits: toStringArray(searchContext.offLimits),
      sourceChannels: toStringArray(searchContext.sourceChannels),
      interviewProcess: toOptionalString(searchContext.interviewProcess),
      interviewPanel: toStringArray(searchContext.interviewPanel),
      processConstraints: toOptionalString(searchContext.processConstraints),
      candidateName: toOptionalString(searchContext.candidateName),
      candidateSummary: toOptionalString(searchContext.candidateSummary),
      candidateHighlights: toStringArray(searchContext.candidateHighlights),
      candidateConcerns: toStringArray(searchContext.candidateConcerns),
      interviewerNotes: toOptionalString(searchContext.interviewerNotes)
    },
    runtime: {
      mode: String(runtime.mode || runtime.executionMode || 'openai'),
      executionMode: runtime.executionMode ? String(runtime.executionMode) : undefined,
      runner: runtime.runner ? String(runtime.runner) : runtime.runnerId ? String(runtime.runnerId) : undefined,
      runnerId: runtime.runnerId ? String(runtime.runnerId) : runtime.runner ? String(runtime.runner) : undefined,
      baseUrl: runtime.baseUrl ? String(runtime.baseUrl) : undefined,
      apiKey: runtime.apiKey ? String(runtime.apiKey) : undefined,
      model: String(runtime.model || process.env.TALENT_INTEL_DEFAULT_MODEL || 'bailian/qwen3.5-plus'),
      temperature: Number.isFinite(Number(runtime.temperature)) ? Number(runtime.temperature) : 0.4,
      maxTokens: Number.isFinite(Number(runtime.maxTokens)) ? Number(runtime.maxTokens) : 5000,
      timeoutMs: Number.isFinite(Number(runtime.timeoutMs)) ? Number(runtime.timeoutMs) : 120000
    }
  };

  if (!normalized.searchContext.roleTitle) {
    throw createError('MISSING_ROLE_TITLE', 'searchContext.roleTitle is required.', { field: 'searchContext.roleTitle' });
  }

  return normalized;
}

export async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(createError('INVALID_JSON', 'Request body must be valid JSON.', { raw: body }));
      }
    });
    req.on('error', (error) => reject(createError('REQUEST_READ_ERROR', error.message, undefined, 500)));
  });
}
