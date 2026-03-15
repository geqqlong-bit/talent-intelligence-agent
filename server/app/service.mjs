import crypto from 'crypto';
import { API_VERSION } from './schema.mjs';
import { renderTemplate } from './templates.mjs';

const WORKFLOW_ID = 'talent-intelligence.local-template-render';
const WORKFLOW_HOOK = 'workflowRunner.execute';

function nowMs() {
  return Date.now();
}

function toIso(valueMs) {
  return new Date(valueMs).toISOString();
}

function createRunId(seed = undefined) {
  const raw = seed ? String(seed).trim() : '';
  return raw || `run_${crypto.randomUUID()}`;
}

function resolveExecutionMode(runtime = {}) {
  const requestedMode = String(runtime.mode || 'openai').trim().toLowerCase();

  if (requestedMode === 'local' || requestedMode === 'template-renderer') {
    return 'local-template';
  }

  if (requestedMode === 'openai' || requestedMode === 'llm' || requestedMode === 'remote') {
    return 'local-template';
  }

  return 'local-template';
}

function buildRequestContext(payload, context = {}) {
  const startedAtMs = nowMs();
  const runtime = payload.runtime || {};
  const executionMode = resolveExecutionMode(runtime);

  return {
    requestId: context.requestId,
    runId: createRunId(context.runId),
    startedAtMs,
    runtime,
    payload,
    executionMode,
    requestedMode: String(runtime.mode || 'openai'),
    requestedModel: String(runtime.model || 'template-only')
  };
}

function buildExecutionPlan(requestContext) {
  return {
    workflow: {
      id: WORKFLOW_ID,
      version: API_VERSION,
      executionMode: requestContext.executionMode,
      futureHook: WORKFLOW_HOOK
    },
    engine: {
      kind: 'local-template-engine',
      version: API_VERSION,
      provider: 'local',
      adapter: 'template-renderer',
      executionMode: requestContext.executionMode,
      requestedMode: requestContext.requestedMode,
      requestedModel: requestContext.requestedModel
    },
    steps: [
      {
        id: 'render-template',
        kind: 'template-render',
        status: 'pending'
      }
    ]
  };
}

async function executeWorkflow(requestContext, executionPlan) {
  if (executionPlan.workflow.executionMode !== 'local-template') {
    throw new Error(`Unsupported execution mode: ${executionPlan.workflow.executionMode}`);
  }

  const reportMarkdown = renderTemplate(requestContext.payload);

  return {
    reportMarkdown,
    execution: {
      status: 'completed',
      stepCount: executionPlan.steps.length,
      renderer: 'renderTemplate'
    }
  };
}

function buildSummary(payload) {
  return {
    projectName: payload.searchContext.projectName,
    roleTitle: payload.searchContext.roleTitle,
    templateId: payload.templateId
  };
}

function buildMetadata(requestContext, executionPlan, executionResult) {
  const completedAtMs = nowMs();

  return {
    requestId: requestContext.requestId,
    runId: requestContext.runId,
    apiVersion: API_VERSION,
    startedAt: toIso(requestContext.startedAtMs),
    completedAt: toIso(completedAtMs),
    durationMs: completedAtMs - requestContext.startedAtMs,
    workflowId: executionPlan.workflow.id,
    workflowVersion: executionPlan.workflow.version,
    executionMode: executionPlan.workflow.executionMode,
    executionStatus: executionResult.execution.status
  };
}

export async function runTalentIntelligence(payload, context = {}) {
  const requestContext = buildRequestContext(payload, context);
  const executionPlan = buildExecutionPlan(requestContext);
  const executionResult = await executeWorkflow(requestContext, executionPlan);
  const metadata = buildMetadata(requestContext, executionPlan, executionResult);

  return {
    ok: true,
    requestId: requestContext.requestId,
    mode: 'template-renderer',
    templateId: payload.templateId,
    run: {
      id: requestContext.runId,
      status: executionResult.execution.status,
      templateId: payload.templateId,
      mode: 'template-renderer'
    },
    engine: executionPlan.engine,
    summary: buildSummary(payload),
    reportMarkdown: executionResult.reportMarkdown,
    metadata,
    orchestration: {
      requestId: requestContext.requestId,
      runId: requestContext.runId,
      workflow: executionPlan.workflow,
      execution: executionResult.execution
    }
  };
}
