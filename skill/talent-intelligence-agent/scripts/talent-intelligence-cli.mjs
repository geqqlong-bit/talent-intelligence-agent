import fs from 'fs';
import path from 'path';

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
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildFallbackMarkdown(payload) {
  const companies = payload.searchContext.targetCompanies.length
    ? payload.searchContext.targetCompanies.map((c) => `- ${c}`).join('\n')
    : '- TBD';

  return `# Talent Intelligence Report\n\n## Executive Summary\n\n- Role: ${payload.searchContext.roleTitle}\n- Objective: ${payload.searchContext.objective}\n- Template: ${payload.templateId}\n\n## Search Context\n\n- Project: ${payload.searchContext.projectName}\n- Company Context: ${payload.searchContext.companyContext}\n- Hiring Brief: ${payload.searchContext.hiringBrief}\n- Target Industry: ${payload.searchContext.targetIndustry}\n- Location: ${payload.searchContext.location}\n- Salary Range: ${payload.searchContext.salaryRange}\n\n## Target Companies\n\n${companies}\n\n## Recommended Next Step\n\nUse this scaffold to connect a real backend and replace the fallback report with workflow output.\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(`Usage: node talent-intelligence-cli.mjs [options]\n\nOptions:\n  --projectName <text>\n  --roleTitle <text>\n  --companyContext <text>\n  --hiringBrief <text>\n  --objective <text>\n  --targetIndustry <text>\n  --targetCompanies <csv>\n  --location <text>\n  --salaryRange <text>\n  --templateId <jd_diagnosis_cn|sourcing_strategy_cn|candidate_assessment_cn|search_plan_cn>\n  --model <model>\n  --out <file>\n`);
    process.exit(0);
  }

  const backendUrl = env('TALENT_INTEL_BACKEND_URL', 'http://127.0.0.1:8788');
  const llmBaseUrl = env('TALENT_INTEL_LLM_BASE_URL', 'http://127.0.0.1:8999/v1');
  const llmApiKey = env('TALENT_INTEL_LLM_API_KEY', 'test-key');
  const defaultModel = env('TALENT_INTEL_DEFAULT_MODEL', 'bailian/qwen3.5-plus');
  const temperature = toNumber(env('TALENT_INTEL_TEMPERATURE', '0.4'), 0.4);
  const maxTokens = toNumber(env('TALENT_INTEL_MAX_TOKENS', '5000'), 5000);
  const timeoutMs = toNumber(env('TALENT_INTEL_TIMEOUT_MS', '120000'), 120000);

  const {
    projectName = 'Talent Intelligence Task',
    roleTitle = 'Unknown Role',
    companyContext = 'Employer context not specified',
    hiringBrief = 'Provide recruiting analysis and recommendations.',
    objective = 'Produce a structured talent intelligence deliverable.',
    targetIndustry = 'TBD',
    targetCompanies = 'TBD',
    location = 'China',
    salaryRange = 'TBD',
    templateId = 'jd_diagnosis_cn',
    model = defaultModel,
    out
  } = args;

  const payload = {
    searchContext: {
      projectName,
      roleTitle,
      companyContext,
      hiringBrief,
      objective,
      targetIndustry,
      targetCompanies: csvToList(targetCompanies),
      location,
      salaryRange
    },
    templateId,
    runtime: {
      mode: 'openai',
      baseUrl: llmBaseUrl,
      apiKey: llmApiKey,
      model,
      temperature,
      maxTokens,
      timeoutMs
    }
  };

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

  if (out) {
    const outPath = path.resolve(process.cwd(), out);
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
