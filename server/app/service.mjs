import crypto from 'crypto';
import { createError } from './schema.mjs';
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

function normalizeExecutionFailure(error, requestContext, executionPlan) {
  if (error?.ok === false) return error;

  const remoteErrorCode = typeof error?.code === 'string' && error.code.startsWith('REMOTE_')
    ? error.code
    : undefined;

  return createError(
    remoteErrorCode || 'RUNNER_EXECUTION_FAILED',
    error?.message || 'Execution runner failed.',
    {
      runnerId: executionPlan.engine.runnerId,
      workflowId: executionPlan.workflow.id,
      requestedMode: requestContext.requestedMode,
      requestedRunner: requestContext.requestedRunner,
      resolvedMode: requestContext.executionTarget.resolvedMode,
      fallbackApplied: requestContext.executionTarget.fallbackApplied,
      cause: error?.cause?.message || undefined,
      code: error?.code,
      status: error?.status,
      responseBody: error?.responseBody,
      remote: error?.remote,
      details: error?.details
    },
    error?.status || (remoteErrorCode ? 503 : 500)
  );
}

function remoteRuntimeFallbackKind(error) {
  if (error?.code === 'REMOTE_RUNNER_INVALID_CONFIG') return 'remote-invalid-config';
  if (error?.code === 'REMOTE_RUNNER_REQUIRED_BUT_INVALID_CONFIG') return 'remote-invalid-config';
  if (error?.code === 'REMOTE_RUNNER_DISABLED') return 'remote-disabled';
  if (error?.code === 'REMOTE_RUNNER_REQUIRED_BUT_DISABLED') return 'remote-disabled';
  if (error?.code === 'REMOTE_RUNNER_UNREACHABLE') return 'remote-unreachable';
  if (error?.code === 'REMOTE_RUNNER_TIMEOUT') return 'remote-timeout';
  if (error?.code === 'REMOTE_RUNNER_HTTP_ERROR') return 'remote-http-error';
  if (error?.code === 'REMOTE_RUNNER_BAD_RESPONSE') return 'remote-bad-response';
  return 'runtime-execution-fallback';
}

function buildLocalFallbackPlanFromRemote(executionPlan, error) {
  return {
    ...executionPlan,
    workflow: {
      ...executionPlan.workflow,
      id: 'talent-intelligence.local-template-render',
      executionMode: 'local-template',
      runnerId: 'local-template'
    },
    engine: {
      ...executionPlan.engine,
      kind: 'local-template-engine',
      provider: 'local',
      adapter: 'template-renderer',
      runnerId: 'local-template',
      executionMode: 'local-template',
      resolvedMode: 'template-renderer',
      implementationStatus: 'active',
      fallbackApplied: true,
      fallbackKind: remoteRuntimeFallbackKind(error),
      fallbackReason: `Remote runner failed and local fallback was used: ${error.message}`
    },
    steps: executionPlan.steps.map((step) => ({
      ...step,
      runnerId: 'local-template'
    }))
  };
}

async function executeWorkflow(requestContext, executionPlan) {
  const runnerId = executionPlan.engine.runnerId;
  const executeRunner = executionRunners[runnerId];

  if (!executeRunner) {
    throw createError(
      'UNSUPPORTED_EXECUTION_RUNNER',
      `Unsupported execution runner: ${runnerId}`,
      {
        runnerId,
        available: Object.keys(executionRunners)
      },
      500
    );
  }

  try {
    return await executeRunner({
      payload: requestContext.payload,
      runtime: requestContext.runtime,
      requestContext,
      executionPlan,
      renderTemplate
    });
  } catch (error) {
    const remoteRequired = requestContext.runtime?.remoteRequired === true;
    const isRemoteRunner = runnerId === 'openai-chat';

    if (isRemoteRunner && !remoteRequired) {
      const fallbackPlan = buildLocalFallbackPlanFromRemote(executionPlan, error);
      const fallbackResult = await executionRunners['local-template']({
        payload: requestContext.payload,
        runtime: requestContext.runtime,
        requestContext,
        executionPlan: fallbackPlan,
        renderTemplate
      });

      return {
        ...fallbackResult,
        executionPlan: fallbackPlan,
        execution: {
          ...fallbackResult.execution,
          remote: {
            attempted: true,
            succeeded: false,
            fallbackApplied: true,
            fallbackKind: remoteRuntimeFallbackKind(error),
            error: {
              code: error.code || 'REMOTE_RUNNER_FAILED',
              message: error.message,
              status: error.status,
              responseBody: error.responseBody,
              details: error.details
            }
          },
          result: {
            ...fallbackResult.execution.result,
            fallbackFromRunnerId: 'openai-chat'
          }
        }
      };
    }

    throw normalizeExecutionFailure(error, requestContext, executionPlan);
  }
}

function buildSummary(payload) {
  return {
    projectName: payload.searchContext.projectName,
    roleTitle: payload.searchContext.roleTitle,
    templateId: payload.templateId
  };
}

function buildMetadata(requestContext, effectiveExecutionPlan, executionResult) {
  const completedAtMs = nowMs();
  const fallbackApplied = requestContext.executionTarget.fallbackApplied || Boolean(executionResult.execution?.remote?.fallbackApplied);
  const fallbackKind = executionResult.execution?.remote?.fallbackKind
    || effectiveExecutionPlan.engine?.fallbackKind
    || requestContext.executionTarget.fallbackKind;
  const fallbackReason = executionResult.execution?.remote?.error?.message
    || effectiveExecutionPlan.engine?.fallbackReason
    || requestContext.executionTarget.fallbackReason;

  return {
    requestId: requestContext.requestId,
    runId: requestContext.runId,
    apiVersion: effectiveExecutionPlan.workflow.version,
    startedAt: toIso(requestContext.startedAtMs),
    completedAt: toIso(completedAtMs),
    durationMs: completedAtMs - requestContext.startedAtMs,
    workflowId: effectiveExecutionPlan.workflow.id,
    workflowVersion: effectiveExecutionPlan.workflow.version,
    runnerId: effectiveExecutionPlan.engine.runnerId,
    executionMode: effectiveExecutionPlan.workflow.executionMode,
    executionStatus: executionResult.execution.status,
    requestedMode: requestContext.requestedMode,
    requestedRunner: requestContext.requestedRunner,
    preferredRunnerId: requestContext.executionTarget.preferredRunnerId,
    resolvedMode: effectiveExecutionPlan.engine.resolvedMode,
    fallbackApplied,
    fallbackKind,
    fallbackReason,
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
  const effectiveExecutionPlan = executionResult.executionPlan || executionPlan;
  const metadata = buildMetadata(requestContext, effectiveExecutionPlan, executionResult);

  const fallbackApplied = requestContext.executionTarget.fallbackApplied || Boolean(executionResult.execution?.remote?.fallbackApplied);
  const fallbackKind = executionResult.execution?.remote?.fallbackKind
    || effectiveExecutionPlan.engine?.fallbackKind
    || requestContext.executionTarget.fallbackKind;
  const fallbackReason = executionResult.execution?.remote?.error?.message
    || effectiveExecutionPlan.engine?.fallbackReason
    || requestContext.executionTarget.fallbackReason;

  return {
    ok: true,
    requestId: requestContext.requestId,
    mode: effectiveExecutionPlan.engine.resolvedMode,
    templateId: payload.templateId,
    run: {
      id: requestContext.runId,
      status: executionResult.execution.status,
      templateId: payload.templateId,
      mode: effectiveExecutionPlan.engine.resolvedMode,
      runnerId: effectiveExecutionPlan.engine.runnerId,
      stageCount: executionResult.execution.stageCount,
      stepCount: executionResult.execution.stepCount,
      artifactCount: executionResult.execution.artifacts?.length || 0,
      finalArtifactId: executionResult.execution.finalArtifactId
    },
    engine: effectiveExecutionPlan.engine,
    summary: buildSummary(payload),
    reportMarkdown: executionResult.reportMarkdown,
    metadata,
    orchestration: {
      requestId: requestContext.requestId,
      runId: requestContext.runId,
      workflow: effectiveExecutionPlan.workflow,
      execution: executionResult.execution,
      selection: {
        requestedMode: requestContext.requestedMode,
        requestedRunner: requestContext.requestedRunner,
        preferredRunnerId: requestContext.executionTarget.preferredRunnerId,
        resolvedRunnerId: effectiveExecutionPlan.engine.runnerId,
        resolvedMode: effectiveExecutionPlan.engine.resolvedMode,
        resolutionSource: requestContext.executionTarget.resolutionSource,
        strategy: requestContext.executionTarget.selectionStrategy,
        fallbackApplied,
        fallbackKind,
        fallbackReason
      }
    }
  };
}
