import crypto from 'crypto';
import { renderTemplate } from './templates.mjs';
import {
  createEngineDescriptor,
  createWorkflowDescriptor,
  executionRunners,
  resolveExecutionTarget
} from './execution.mjs';

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

function buildRequestContext(payload, context = {}) {
  const startedAtMs = nowMs();
  const runtime = payload.runtime || {};
  const executionTarget = resolveExecutionTarget(runtime);

  return {
    requestId: context.requestId,
    runId: createRunId(context.runId),
    startedAtMs,
    runtime,
    payload,
    executionTarget,
    requestedMode: executionTarget.requestedMode,
    requestedRunner: executionTarget.requestedRunner,
    requestedModel: String(runtime.model || 'template-only')
  };
}

function buildExecutionPlan(requestContext) {
  const workflow = createWorkflowDescriptor(requestContext.executionTarget);
  const engine = createEngineDescriptor(
    requestContext.executionTarget,
    workflow.version,
    requestContext.requestedModel
  );

  return {
    workflow,
    engine,
    steps: [
      {
        id: 'render-template',
        kind: 'template-render',
        runnerId: engine.runnerId,
        status: 'pending'
      }
    ]
  };
}

async function executeWorkflow(requestContext, executionPlan) {
  const runnerId = executionPlan.engine.runnerId;
  const executeRunner = executionRunners[runnerId];

  if (!executeRunner) {
    throw new Error(`Unsupported execution runner: ${runnerId}`);
  }

  return executeRunner({
    payload: requestContext.payload,
    runtime: requestContext.runtime,
    requestContext,
    executionPlan,
    renderTemplate
  });
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
    apiVersion: executionPlan.workflow.version,
    startedAt: toIso(requestContext.startedAtMs),
    completedAt: toIso(completedAtMs),
    durationMs: completedAtMs - requestContext.startedAtMs,
    workflowId: executionPlan.workflow.id,
    workflowVersion: executionPlan.workflow.version,
    runnerId: executionPlan.engine.runnerId,
    executionMode: executionPlan.workflow.executionMode,
    executionStatus: executionResult.execution.status,
    requestedMode: requestContext.requestedMode,
    requestedRunner: requestContext.requestedRunner,
    resolvedMode: requestContext.executionTarget.resolvedMode
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
    mode: requestContext.executionTarget.resolvedMode,
    templateId: payload.templateId,
    run: {
      id: requestContext.runId,
      status: executionResult.execution.status,
      templateId: payload.templateId,
      mode: requestContext.executionTarget.resolvedMode,
      runnerId: executionPlan.engine.runnerId
    },
    engine: executionPlan.engine,
    summary: buildSummary(payload),
    reportMarkdown: executionResult.reportMarkdown,
    metadata,
    orchestration: {
      requestId: requestContext.requestId,
      runId: requestContext.runId,
      workflow: executionPlan.workflow,
      execution: executionResult.execution,
      selection: {
        requestedMode: requestContext.requestedMode,
        requestedRunner: requestContext.requestedRunner,
        resolvedRunnerId: requestContext.executionTarget.resolvedRunnerId,
        strategy: requestContext.executionTarget.selectionStrategy,
        fallbackApplied: requestContext.executionTarget.fallbackApplied,
        fallbackReason: requestContext.executionTarget.fallbackReason
      }
    }
  };
}
