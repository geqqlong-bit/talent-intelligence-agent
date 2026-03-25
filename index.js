import { createTiaServiceContainer } from './src/tia/service-container.mjs';

let definePluginEntry = (entry) => entry;

try {
  ({ definePluginEntry } = await import('openclaw/plugin-sdk/core'));
} catch {
  // Keep a no-op fallback so local tests can import this file without the OpenClaw SDK installed.
}

function asTextResult(payload) {
  return {
    content: [
      {
        type: 'text',
        text: typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)
      }
    ]
  };
}

export default definePluginEntry({
  id: 'tia',
  name: 'Talent Intelligence Agent',
  description: 'Recruiting workflow tools, skills, and structured delivery primitives.',
  register(api) {
    const services = createTiaServiceContainer({ config: api?.config || pluginConfigFallback(api), logger: api?.logger || console });

    api.registerTool(
      {
        name: 'tia_db_query',
        description: 'Execute a read-only PostgreSQL query for TIA business data.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            sql: { type: 'string' },
            params: { type: 'array', items: {} }
          },
          required: ['sql']
        },
        async execute(_id, params) {
          return asTextResult(await services.dbQuery(params));
        }
      },
      { optional: true }
    );

    api.registerTool(
      {
        name: 'tia_db_write',
        description: 'Insert, update, or delete rows in the TIA core business tables.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            table: { type: 'string' },
            operation: { type: 'string', enum: ['insert', 'update', 'delete'] },
            data: { type: 'object' }
          },
          required: ['table', 'operation', 'data']
        },
        async execute(_id, params) {
          return asTextResult(await services.dbWrite(params));
        }
      },
      { optional: true }
    );

    api.registerTool(
      {
        name: 'tia_get_position_context',
        description: 'Assemble the full position context, client preferences, funnel state, and recent rejection signals.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            position_id: { type: 'string' }
          },
          required: ['position_id']
        },
        async execute(_id, params) {
          return asTextResult(await services.getPositionContext(params));
        }
      },
      { optional: true }
    );

    api.registerTool(
      {
        name: 'tia_stage_update',
        description: 'Update a candidate stage, write touch records, and emit webhook events.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            candidate_id: { type: 'string' },
            new_stage: { type: 'string' },
            summary: { type: 'string' },
            next_action: { type: 'string' },
            webhook_urls: { type: 'array', items: { type: 'string' } }
          },
          required: ['candidate_id', 'new_stage']
        },
        async execute(_id, params) {
          return asTextResult(await services.stageUpdate(params));
        }
      },
      { optional: true }
    );

    api.registerTool(
      {
        name: 'tia_risk_scan',
        description: 'Scan all active workflow data and return structured recruiting alerts.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            position_id: { type: 'string' }
          }
        },
        async execute(_id, params) {
          return asTextResult(await services.scanRisks(params));
        }
      },
      { optional: true }
    );

    api.registerTool(
      {
        name: 'tia_assess',
        description: 'Run a structured candidate assessment using position context, rubric, and client preferences.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            candidate_id: { type: 'string' },
            position_id: { type: 'string' },
            candidate_name: { type: 'string' },
            resume_text: { type: 'string' },
            rubrics: { type: 'array', items: { type: 'object' } }
          }
        },
        async execute(_id, params) {
          return asTextResult(await services.assessCandidate(params));
        }
      },
      { optional: true }
    );

    api.registerTool(
      {
        name: 'tia_cc',
        description: 'Generate outreach scripts, rejection handling, and a short social follow-up message.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            candidate_id: { type: 'string' },
            position_id: { type: 'string' },
            candidate_background: { type: 'object' },
            position_brief: { type: 'string' },
            stage: { type: 'string' }
          }
        },
        async execute(_id, params) {
          return asTextResult(await services.generateCc(params));
        }
      },
      { optional: true }
    );

    api.registerTool(
      {
        name: 'tia_report',
        description: 'Generate a standard client-ready markdown report for a candidate.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            candidate_id: { type: 'string' }
          },
          required: ['candidate_id']
        },
        async execute(_id, params) {
          return asTextResult(await services.generateReport(params));
        }
      },
      { optional: true }
    );

    api.registerTool(
      {
        name: 'tia_offer',
        description: 'Produce a structured offer negotiation analysis for client and candidate conversations.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            salary_current: { type: 'number' },
            salary_expected: { type: 'number' },
            client_budget_min: { type: 'number' },
            client_budget_max: { type: 'number' },
            has_competing_offer: { type: 'boolean' },
            leave_reason: { type: 'string' },
            guarantee_months: { type: 'number' }
          }
        },
        async execute(_id, params) {
          return asTextResult(await services.analyzeOffer(params));
        }
      },
      { optional: true }
    );

    api.registerTool(
      {
        name: 'tia_classify',
        description: 'Classify a hiring request to determine the best response template and detect missing information proactively.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            roleTitle: { type: 'string', description: 'Target role title' },
            hiringBrief: { type: 'string', description: 'Hiring brief text' },
            objective: { type: 'string', description: 'Task objective' },
            rawInput: { type: 'string', description: 'Raw user input' },
            companyContext: { type: 'string', description: 'Company context' }
          }
        },
        async execute(_id, params) {
          return asTextResult(await services.classify(params));
        }
      },
      { optional: true }
    );

    api.registerTool(
      {
        name: 'tia_rag',
        description: 'Retrieve domain knowledge (salary benchmarks, target companies, key traits, industry insights) via RAG for a given role and industry.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            role_title: { type: 'string', description: 'Role title to retrieve knowledge for' },
            industry: { type: 'string', description: 'Industry to retrieve insights for' }
          },
          required: ['role_title']
        },
        async execute(_id, params) {
          return asTextResult(await services.retrieveKnowledge(params));
        }
      },
      { optional: true }
    );

    api.registerTool(
      {
        name: 'tia_validate',
        description: 'Validate generated output against codified expert HR rules for a given template type. Returns pass/fail and feedback.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            markdown: { type: 'string', description: 'The generated markdown content to validate' },
            template_id: { type: 'string', description: 'The template ID used to generate the content (e.g. sourcing_strategy_cn, candidate_assessment_cn)' }
          },
          required: ['markdown', 'template_id']
        },
        async execute(_id, params) {
          return asTextResult(await services.validateOutput(params));
        }
      },
      { optional: true }
    );

    api.registerTool(
      {
        name: 'tia_copilot',
        description: 'Run a copilot task to generate professional markdown content. Supported tasks: bd_script, jd_diagnosis, market_map, interview_prep, followup_plan, invoice_email, onboarding_plan, shortlist_summary.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            task_type: { type: 'string', enum: ['bd_script', 'jd_diagnosis', 'market_map', 'interview_prep', 'followup_plan', 'invoice_email', 'onboarding_plan', 'shortlist_summary'] },
            position_id: { type: 'string' },
            candidate_id: { type: 'string' },
            notes: { type: 'string' }
          },
          required: ['task_type']
        },
        async execute(_id, params) {
          return asTextResult(await services.runCopilot(params));
        }
      },
      { optional: true }
    );

    api.registerTool(
      {
        name: 'tia_workbench',
        description: 'Get a full workbench snapshot including dashboard metrics, priority items, funnel, BD analysis, position cards, kanban board, offer negotiations, and AI workbench actions.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            position_id: { type: 'string', description: 'Optional position ID to focus the workbench on' }
          }
        },
        async execute(_id, params) {
          return asTextResult(await services.getWorkbench(params));
        }
      },
      { optional: true }
    );

    // ── Browser Automation Tools ──

    api.registerTool(
      {
        name: 'tia_browser_search',
        description: 'Search for candidates on a recruiting platform (猎聘/脉脉/Boss直聘). Returns search URL and browser automation instructions.',
        parameters: {
          type: 'object',
          properties: {
            platform: { type: 'string', description: 'Platform: "liepin", "maimai", or "boss"', enum: ['liepin', 'maimai', 'boss'] },
            keywords: { type: 'string', description: 'Search keywords (role title, skills, etc.)' },
            city: { type: 'string', description: 'City filter (e.g., "北京", "上海")' },
            filters: {
              type: 'object',
              description: 'Additional filters: salaryMin, salaryMax, experience, education',
              properties: {
                salaryMin: { type: 'string' },
                salaryMax: { type: 'string' },
                experience: { type: 'string' },
                education: { type: 'string' }
              }
            }
          },
          required: ['platform', 'keywords']
        }
      },
      async (params) => {
        try {
          return asTextResult(services.browserSearch(params));
        } catch (e) {
          return asTextResult({ error: e.message });
        }
      },
      { optional: true }
    );

    api.registerTool(
      {
        name: 'tia_browser_extract',
        description: 'Extract and normalize candidate data from page content or a profile URL on a recruiting platform.',
        parameters: {
          type: 'object',
          properties: {
            platform: { type: 'string', description: 'Platform: "liepin", "maimai", or "boss"', enum: ['liepin', 'maimai', 'boss'] },
            profileUrl: { type: 'string', description: 'URL of a candidate profile page' },
            pageContent: { description: 'Raw candidate data extracted from the page (object or array of objects)' }
          },
          required: ['platform']
        }
      },
      async (params) => {
        try {
          return asTextResult(services.browserExtract(params));
        } catch (e) {
          return asTextResult({ error: e.message });
        }
      },
      { optional: true }
    );

    api.registerTool(
      {
        name: 'tia_resume_import',
        description: 'Normalize and import candidate data into the TIA database. Handles deduplication by name+company.',
        parameters: {
          type: 'object',
          properties: {
            candidates: {
              type: 'array',
              description: 'Array of candidate objects to import',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  company: { type: 'string' },
                  title: { type: 'string' },
                  experience: { type: 'string' },
                  salary: { type: 'string' },
                  summary: { type: 'string' },
                  profileUrl: { type: 'string' }
                }
              }
            },
            platform: { type: 'string', description: 'Source platform', enum: ['liepin', 'maimai', 'boss'] },
            positionId: { type: 'string', description: 'Position ID to associate candidates with' }
          },
          required: ['candidates', 'platform']
        }
      },
      async (params) => {
        try {
          return asTextResult(await services.resumeImport(params));
        } catch (e) {
          return asTextResult({ error: e.message });
        }
      },
      { optional: true }
    );

    // Lifecycle: clean shutdown of PG connection pool
    if (typeof api.onShutdown === 'function') {
      api.onShutdown(async () => {
        await services.close();
      });
    }

    // Scheduled Task: Heartbeat — risk scanning every 30 minutes
    if (typeof api.registerScheduledTask === 'function') {
      api.registerScheduledTask({
        id: 'tia_heartbeat',
        name: 'TIA Risk Heartbeat',
        description: 'Scans for workflow risks, stalled candidates, expiring contracts, and onboarding follow-ups every 30 minutes.',
        schedule: '*/30 * * * *',
        async execute() {
          const risks = await services.scanRisks({});
          const highUrgency = (risks.alerts || []).filter(a => a.urgency === 'HIGH');
          if (highUrgency.length > 0) {
            return asTextResult({
              type: 'heartbeat_alert',
              alertCount: highUrgency.length,
              alerts: highUrgency,
              message: `⚠️ ${highUrgency.length} high-urgency alerts detected.`
            });
          }
          return asTextResult({ type: 'heartbeat_ok', alertCount: 0, message: 'No high-urgency alerts.' });
        }
      });
    }
  }
});

function pluginConfigFallback(api) {
  return api?.config || {};
}
