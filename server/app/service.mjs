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

  const stages = [
    {
      id: 'ingest-request',
      label: 'Ingest Request',
      order: 1,
      consumes: [],
      produces: ['normalized-request']
    },
    {
      id: 'prepare-brief',
      label: 'Prepare Workflow Brief',
      order: 2,
      consumes: ['normalized-request'],
      produces: ['workflow-brief']
    },
    {
      id: 'render-report',
      label: 'Render Report',
      order: 3,
      consumes: ['workflow-brief'],
      produces: ['report-markdown']
    },
    {
      id: 'finalize-run',
      label: 'Finalize Run',
      order: 4,
      consumes: ['report-markdown'],
      produces: ['run-summary']
    }
  ];

  const artifacts = [
    {
      id: 'normalized-request',
      name: 'Normalized Request Payload',
      kind: 'json',
      mimeType: 'application/json',
      stageId: 'ingest-request'
    },
    {
      id: 'workflow-brief',
      name: 'Workflow Brief',
      kind: 'json',
      mimeType: 'application/json',
      stageId: 'prepare-brief'
    },
    {
      id: 'report-markdown',
      name: 'Rendered Report',
      kind: 'markdown',
      mimeType: 'text/markdown',
      stageId: 'render-report'
    },
    {
      id: 'run-summary',
      name: 'Run Summary',
      kind: 'json',
      mimeType: 'application/json',
      stageId: 'finalize-run'
    }
  ];

  return {
    workflow,
    engine,
    stages,
    artifacts,
    steps: [
      {
        id: 'capture-request',
        stageId: 'ingest-request',
        kind: 'capture-input',
        runnerId: engine.runnerId,
        status: 'pending',
        consumes: [],
        produces: ['normalized-request']
      },
      {
        id: 'build-brief',
        stageId: 'prepare-brief',
        kind: 'brief-synthesis',
        runnerId: engine.runnerId,
        status: 'pending',
        consumes: ['normalized-request'],
        produces: ['workflow-brief']
      },
      {
        id: 'render-template',
        stageId: 'render-report',
        kind: 'template-render',
        runnerId: engine.runnerId,
        status: 'pending',
        consumes: ['workflow-brief'],
        produces: ['report-markdown']
      },
      {
        id: 'finalize-response',
        stageId: 'finalize-run',
        kind: 'response-finalization',
        runnerId: engine.runnerId,
        status: 'pending',
        consumes: ['report-markdown'],
        produces: ['run-summary']
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
    resolvedMode: requestContext.executionTarget.resolvedMode,
    stageCount: executionResult.execution.stageCount,
    stepCount: executionResult.execution.stepCount,
    artifactCount: executionResult.execution.artifacts?.length || 0,
    finalArtifactId: executionResult.execution.finalArtifactId
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
      runnerId: executionPlan.engine.runnerId,
      stageCount: executionResult.execution.stageCount,
      stepCount: executionResult.execution.stepCount,
      artifactCount: executionResult.execution.artifacts?.length || 0,
      finalArtifactId: executionResult.execution.finalArtifactId
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
        resolvedMode: requestContext.executionTarget.resolvedMode,
        resolutionSource: requestContext.executionTarget.resolutionSource,
        strategy: requestContext.executionTarget.selectionStrategy,
        fallbackApplied: requestContext.executionTarget.fallbackApplied,
        fallbackReason: requestContext.executionTarget.fallbackReason
      }
    }
  };
}
