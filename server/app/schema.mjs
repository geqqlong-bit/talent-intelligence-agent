export const TEMPLATE_IDS = [
  'jd_diagnosis_cn',
  'sourcing_strategy_cn',
  'candidate_assessment_cn',
  'search_plan_cn'
];

export function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload, null, 2));
}

export function createError(code, message, details = undefined, status = 400) {
  return { ok: false, error: { code, message, details }, status };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toStringArray(value) {
  if (value === undefined || value === null || value === '') return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return [String(value).trim()].filter(Boolean);
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
      projectName: String(searchContext.projectName || 'Talent Intelligence Task'),
      roleTitle: String(searchContext.roleTitle || 'Unknown Role'),
      clientName: searchContext.clientName ? String(searchContext.clientName) : undefined,
      searchType: String(searchContext.searchType || 'executive_search'),
      mandateType: searchContext.mandateType ? String(searchContext.mandateType) : undefined,
      companyContext: String(searchContext.companyContext || 'Employer context not specified'),
      companyStage: searchContext.companyStage ? String(searchContext.companyStage) : undefined,
      businessModel: searchContext.businessModel ? String(searchContext.businessModel) : undefined,
      teamStage: searchContext.teamStage ? String(searchContext.teamStage) : undefined,
      hiringBrief: String(searchContext.hiringBrief || 'Provide recruiting analysis and recommendations.'),
      objective: String(searchContext.objective || 'Produce a structured talent intelligence deliverable.'),
      targetIndustry: String(searchContext.targetIndustry || 'TBD'),
      targetCompanies: toStringArray(searchContext.targetCompanies),
      location: String(searchContext.location || 'China'),
      targetGeographies: toStringArray(searchContext.targetGeographies),
      salaryRange: String(searchContext.salaryRange || 'TBD'),
      compensationMix: searchContext.compensationMix ? String(searchContext.compensationMix) : undefined,
      equity: searchContext.equity ? String(searchContext.equity) : undefined,
      reportingLine: searchContext.reportingLine ? String(searchContext.reportingLine) : undefined,
      level: searchContext.level ? String(searchContext.level) : undefined,
      headcount: searchContext.headcount ? String(searchContext.headcount) : undefined,
      urgency: searchContext.urgency ? String(searchContext.urgency) : undefined,
      searchReason: searchContext.searchReason ? String(searchContext.searchReason) : undefined,
      successProfile: searchContext.successProfile ? String(searchContext.successProfile) : undefined,
      successMetrics: searchContext.successMetrics ? String(searchContext.successMetrics) : undefined,
      marketSignals: searchContext.marketSignals ? String(searchContext.marketSignals) : undefined,
      stakeholderBrief: searchContext.stakeholderBrief ? String(searchContext.stakeholderBrief) : undefined,
      mustHaveSkills: toStringArray(searchContext.mustHaveSkills),
      niceToHaveSkills: toStringArray(searchContext.niceToHaveSkills),
      dealBreakers: toStringArray(searchContext.dealBreakers),
      targetFunctions: toStringArray(searchContext.targetFunctions),
      targetBackgrounds: toStringArray(searchContext.targetBackgrounds),
      offLimits: toStringArray(searchContext.offLimits),
      sourceChannels: toStringArray(searchContext.sourceChannels),
      interviewProcess: searchContext.interviewProcess ? String(searchContext.interviewProcess) : undefined,
      interviewPanel: toStringArray(searchContext.interviewPanel),
      processConstraints: searchContext.processConstraints ? String(searchContext.processConstraints) : undefined,
      candidateName: searchContext.candidateName ? String(searchContext.candidateName) : undefined,
      candidateSummary: searchContext.candidateSummary ? String(searchContext.candidateSummary) : undefined,
      candidateHighlights: toStringArray(searchContext.candidateHighlights),
      candidateConcerns: toStringArray(searchContext.candidateConcerns),
      interviewerNotes: searchContext.interviewerNotes ? String(searchContext.interviewerNotes) : undefined
    },
    runtime: {
      mode: String(runtime.mode || 'openai'),
      baseUrl: runtime.baseUrl ? String(runtime.baseUrl) : undefined,
      apiKey: runtime.apiKey ? String(runtime.apiKey) : undefined,
      model: String(runtime.model || process.env.TALENT_INTEL_DEFAULT_MODEL || 'bailian/qwen3.5-plus'),
      temperature: Number.isFinite(Number(runtime.temperature)) ? Number(runtime.temperature) : 0.4,
      maxTokens: Number.isFinite(Number(runtime.maxTokens)) ? Number(runtime.maxTokens) : 5000,
      timeoutMs: Number.isFinite(Number(runtime.timeoutMs)) ? Number(runtime.timeoutMs) : 120000
    }
  };

  if (!normalized.searchContext.roleTitle.trim()) {
    throw createError('MISSING_ROLE_TITLE', 'searchContext.roleTitle is required.');
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
