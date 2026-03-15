import fs from 'fs';
import path from 'path';

const CSV_FIELDS = new Set([
  'targetCompanies',
  'offLimits',
  'mustHaveSkills',
  'niceToHaveSkills',
  'dealBreakers',
  'targetFunctions',
  'targetBackgrounds',
  'targetGeographies',
  'interviewPanel',
  'candidateHighlights',
  'candidateConcerns',
  'sourceChannels'
]);

function parseArgs(argv) {
  const params = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      params[key] = next;
      i += 1;
    } else {
      params[key] = true;
    }
  }
  return params;
}

function env(name, fallback) {
  return process.env[name] || fallback;
}

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function csvToList(value) {
  if (!value || value === 'TBD') return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanObject(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => {
      if (value === undefined || value === null || value === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    })
  );
}

function normalizeString(value) {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  return normalized || undefined;
}

function requireRoleTitle(args) {
  const roleTitle = normalizeString(args.roleTitle);
  if (!roleTitle) {
    throw new Error('roleTitle is required. Supply --roleTitle <text> or include a non-empty roleTitle in --intakeFile.');
  }
  return roleTitle;
}

function readIntakeFile(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const raw = fs.readFileSync(absolutePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Intake file must be a JSON object: ${absolutePath}`);
  }
  return parsed;
}

function normalizeMergedArgs(args) {
  const normalized = { ...args };
  for (const field of CSV_FIELDS) {
    if (field in normalized) {
      normalized[field] = csvToList(normalized[field]);
    }
  }
  return normalized;
}

function buildPayload(args, runtime) {
  const normalizedRoleTitle = requireRoleTitle(args);

  const {
    projectName = 'Talent Intelligence Task',
    companyContext = 'Employer context not specified',
    hiringBrief = 'Provide recruiting analysis and recommendations.',
    objective = 'Produce a structured talent intelligence deliverable.',
    targetIndustry = 'TBD',
    targetCompanies = [],
    location = 'China',
    salaryRange = 'TBD',
    templateId = 'jd_diagnosis_cn',
    model = runtime.defaultModel,
    clientName,
    searchType = 'executive_search',
    mandateType = 'TBD',
    companyStage,
    businessModel,
    teamStage,
    reportingLine,
    level,
    headcount = '1',
    urgency,
    searchReason,
    successProfile,
    successMetrics,
    marketSignals,
    stakeholderBrief,
    mustHaveSkills = [],
    niceToHaveSkills = [],
    dealBreakers = [],
    targetFunctions = [],
    targetBackgrounds = [],
    offLimits = [],
    targetGeographies = [],
    compensationMix,
    equity,
    interviewProcess,
    interviewPanel = [],
    processConstraints,
    sourceChannels = [],
    candidateName,
    candidateSummary,
    candidateHighlights = [],
    candidateConcerns = [],
    interviewerNotes,
    out,
    intakeFile,
    help,
    ...extraFields
  } = args;

  return {
    payload: {
      searchContext: cleanObject({
        projectName,
        roleTitle: normalizedRoleTitle,
        clientName,
        searchType,
        mandateType,
        companyContext,
        companyStage,
        businessModel,
        teamStage,
        hiringBrief,
        objective,
        targetIndustry,
        targetCompanies,
        location,
        targetGeographies,
        salaryRange,
        compensationMix,
        equity,
        reportingLine,
        level,
        headcount,
        urgency,
        searchReason,
        successProfile,
        successMetrics,
        marketSignals,
        stakeholderBrief,
        mustHaveSkills,
        niceToHaveSkills,
        dealBreakers,
        targetFunctions,
        targetBackgrounds,
        offLimits,
        sourceChannels,
        interviewProcess,
        interviewPanel,
        processConstraints,
        candidateName,
        candidateSummary,
        candidateHighlights,
        candidateConcerns,
        interviewerNotes,
        ...extraFields
      }),
      templateId,
      runtime: {
        mode: 'openai',
        baseUrl: runtime.llmBaseUrl,
        apiKey: runtime.llmApiKey,
        model,
        temperature: runtime.temperature,
        maxTokens: runtime.maxTokens,
        timeoutMs: runtime.timeoutMs
      }
    },
    meta: { out, intakeFile, help }
  };
}

function renderList(title, items, fallback = '- TBD') {
  if (!Array.isArray(items) || items.length === 0) return `## ${title}\n\n${fallback}\n`;
  return `## ${title}\n\n${items.map((item) => `- ${item}`).join('\n')}\n`;
}

function renderBulletSection(title, lines) {
  const valid = lines.filter(Boolean);
  if (valid.length === 0) return '';
  return `## ${title}\n\n${valid.map((line) => `- ${line}`).join('\n')}\n`;
}

function buildFallbackMarkdown(payload) {
  const ctx = payload.searchContext;
  const topSummary = [
    `Role: ${ctx.roleTitle}`,
    `Objective: ${ctx.objective}`,
    `Template: ${payload.templateId}`,
    `Search Type: ${ctx.searchType || 'TBD'}`,
    ctx.clientName ? `Client: ${ctx.clientName}` : null,
    ctx.reportingLine ? `Reporting Line: ${ctx.reportingLine}` : null,
    ctx.level ? `Level: ${ctx.level}` : null
  ].filter(Boolean);

  return `# Talent Intelligence Report\n\n## Executive Summary\n\n${topSummary.map((line) => `- ${line}`).join('\n')}\n\n## Search Context\n\n- Project: ${ctx.projectName}\n- Company Context: ${ctx.companyContext}\n- Hiring Brief: ${ctx.hiringBrief}\n- Target Industry: ${ctx.targetIndustry}\n- Location: ${ctx.location}\n- Salary Range: ${ctx.salaryRange}\n- Mandate Type: ${ctx.mandateType || 'TBD'}\n- Search Reason: ${ctx.searchReason || 'TBD'}\n\n${renderBulletSection('Calibration Notes', [
    ctx.successProfile ? `Success Profile: ${ctx.successProfile}` : null,
    ctx.successMetrics ? `Success Metrics: ${ctx.successMetrics}` : null,
    ctx.marketSignals ? `Market Signals: ${ctx.marketSignals}` : null,
    ctx.stakeholderBrief ? `Stakeholder Brief: ${ctx.stakeholderBrief}` : null,
    ctx.processConstraints ? `Process Constraints: ${ctx.processConstraints}` : null
  ])}${renderList('Target Companies', ctx.targetCompanies)}\n${renderList('Must-Have Skills', ctx.mustHaveSkills)}\n${renderList('Nice-to-Have Skills', ctx.niceToHaveSkills)}\n${renderList('Deal Breakers', ctx.dealBreakers)}\n${renderList('Off-Limits / No-Touch Companies', ctx.offLimits)}\n${renderList('Candidate Highlights', ctx.candidateHighlights)}\n${renderList('Candidate Concerns', ctx.candidateConcerns)}\n## Recommended Next Step\n\nUse this scaffold to connect a real backend and replace the fallback report with workflow output.\n`;
}

async function main() {
  const rawArgs = parseArgs(process.argv.slice(2));

  if (rawArgs.help) {
    console.log(`Usage: node talent-intelligence-cli.mjs [options]\n\nCore options:\n  --projectName <text>\n  --roleTitle <text>  (required; may also come from --intakeFile)\n  --companyContext <text>\n  --hiringBrief <text>\n  --objective <text>\n  --targetIndustry <text>\n  --targetCompanies <csv>\n  --location <text>\n  --salaryRange <text>\n  --templateId <jd_diagnosis_cn|sourcing_strategy_cn|candidate_assessment_cn|search_plan_cn>\n  --model <model>\n  --out <file>\n\nExecutive-search intake options:\n  --intakeFile <json>\n  --clientName <text>\n  --searchType <executive_search|talent_map|replacement|succession>\n  --mandateType <retained|contingent|in_house>\n  --companyStage <text>\n  --businessModel <text>\n  --teamStage <text>\n  --reportingLine <text>\n  --level <text>\n  --headcount <number>\n  --urgency <text>\n  --searchReason <text>\n  --successProfile <text>\n  --successMetrics <text>\n  --marketSignals <text>\n  --stakeholderBrief <text>\n  --mustHaveSkills <csv>\n  --niceToHaveSkills <csv>\n  --dealBreakers <csv>\n  --targetFunctions <csv>\n  --targetBackgrounds <csv>\n  --offLimits <csv>\n  --targetGeographies <csv>\n  --compensationMix <text>\n  --equity <text>\n  --interviewProcess <text>\n  --interviewPanel <csv>\n  --processConstraints <text>\n  --sourceChannels <csv>\n\nCandidate-assessment options:\n  --candidateName <text>\n  --candidateSummary <text>\n  --candidateHighlights <csv>\n  --candidateConcerns <csv>\n  --interviewerNotes <text>\n`);
    process.exit(0);
  }

  const backendUrl = env('TALENT_INTEL_BACKEND_URL', 'http://127.0.0.1:8788');
  const llmBaseUrl = env('TALENT_INTEL_LLM_BASE_URL', 'http://127.0.0.1:8999/v1');
  const llmApiKey = env('TALENT_INTEL_LLM_API_KEY', 'test-key');
  const defaultModel = env('TALENT_INTEL_DEFAULT_MODEL', 'bailian/qwen3.5-plus');
  const temperature = toNumber(env('TALENT_INTEL_TEMPERATURE', '0.4'), 0.4);
  const maxTokens = toNumber(env('TALENT_INTEL_MAX_TOKENS', '5000'), 5000);
  const timeoutMs = toNumber(env('TALENT_INTEL_TIMEOUT_MS', '120000'), 120000);

  const fileArgs = rawArgs.intakeFile ? readIntakeFile(rawArgs.intakeFile) : {};
  const mergedArgs = normalizeMergedArgs({ ...fileArgs, ...rawArgs });
  const runtime = { backendUrl, llmBaseUrl, llmApiKey, defaultModel, temperature, maxTokens, timeoutMs };
  const { payload, meta } = buildPayload(mergedArgs, runtime);

  console.log(`[Talent Intelligence] Backend: ${backendUrl}`);
  let finalMarkdown = '';

  try {
    const res = await fetch(`${backendUrl}/api/talent-intelligence/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Workflow start failed: ${res.status} ${res.statusText} :: ${text}`);
    }

    const data = await res.json();
    finalMarkdown = data.reportMarkdown || data.markdown || '';
    if (!finalMarkdown.trim()) {
      finalMarkdown = buildFallbackMarkdown(payload);
    }
  } catch (error) {
    console.warn(`[Talent Intelligence] Backend unavailable or failed: ${error.message}`);
    finalMarkdown = buildFallbackMarkdown(payload);
    finalMarkdown += `\n\n## Runtime Note\n\nBackend attempted: ${backendUrl}\nError: ${error.message}\n`;
  }

  if (meta.out) {
    const outPath = path.resolve(process.cwd(), meta.out);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, finalMarkdown, 'utf8');
    console.log(`[Talent Intelligence] Wrote report to ${outPath}`);
  } else {
    console.log(finalMarkdown);
  }
}

main().catch((error) => {
  console.error('[Talent Intelligence] Fatal error:', error);
  process.exit(1);
});
