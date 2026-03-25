import crypto from 'crypto';
import { createError } from './schema.mjs';
import { renderTemplate } from './templates.mjs';
import { classifyRequest } from './classifier.mjs';
import { getDomainKnowledge } from './rag.mjs';
import { validateWithExpertRules } from './expert-rules.mjs';
import { persistRunArtifacts, persistRunFailure } from './persistence.mjs';
import {
  createEngineDescriptor,
  createWorkflowDescriptor,
  executionRunners,
  resolveExecutionTarget
} from './execution.mjs';
import { jobManager, generateJobId } from './job-manager.mjs';

// Global map to store job states
const jobStateMap = new Map();

// Job status constants
const JOB_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

// Function to create a new job
function createJob(jobId, payload) {
  const job = {
    jobId,
    status: JOB_STATUS.PENDING,
    payload,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    result: null,
    error: null
  };
  
  jobStateMap.set(jobId, job);
  return job;
}

// Function to update job status
function updateJobStatus(jobId, status, updates = {}) {
  const job = jobStateMap.get(jobId);
  if (!job) {
    throw new Error(`Job not found: ${jobId}`);
  }
  
  job.status = status;
  
  if (updates.result !== undefined) {
    job.result = updates.result;
  }
  
  if (updates.error !== undefined) {
    job.error = updates.error;
  }
  
  if (status === JOB_STATUS.PROCESSING && !job.startedAt) {
    job.startedAt = new Date().toISOString();
  }
  
  if ([JOB_STATUS.COMPLETED, JOB_STATUS.FAILED].includes(status) && !job.completedAt) {
    job.completedAt = new Date().toISOString();
  }
  
  jobStateMap.set(jobId, job);
  return job;
}

// Function to get job by ID
function getJob(jobId) {
  return jobStateMap.get(jobId);
}

// Function to process a job asynchronously
async function processJobAsync(jobId, payload, context = {}) {
  try {
    updateJobStatus(jobId, JOB_STATUS.PROCESSING);
    
    // Import the runTalentIntelligence function and execute it
    const result = await runTalentIntelligence(payload, {
      ...context,
      jobId
    });
    
    updateJobStatus(jobId, JOB_STATUS.COMPLETED, { result });
    return result;
  } catch (error) {
    updateJobStatus(jobId, JOB_STATUS.FAILED, { 
      error: {
        message: error.message,
        code: error.code,
        status: error.status
      }
    });
    throw error;
  }
}

// Function to start a job asynchronously
function startJobAsync(jobId, payload, context = {}) {
  // Process the job in the background
  processJobAsync(jobId, payload, context).catch(error => {
    console.error(`Job ${jobId} failed with error:`, error);
    // Error is already handled in processJobAsync
  });
  
  // Return immediately
  return getJob(jobId);
}

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

  // Determine if we should use multi-stage approach based on runner type
  const isRemoteRunner = engine.runnerId === 'openai-chat';
  
  let stages, artifacts, steps;
  
  if (isRemoteRunner) {
    // Multi-stage approach for remote runner
    stages = [
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
        id: 'jd-diagnosis',
        label: 'JD Diagnosis',
        order: 3,
        consumes: ['workflow-brief'],
        produces: ['jd-diagnosis-result']
      },
      {
        id: 'search-plan',
        label: 'Search Plan',
        order: 4,
        consumes: ['jd-diagnosis-result'],
        produces: ['search-plan-result']
      },
      {
        id: 'sourcing-strategy',
        label: 'Sourcing Strategy',
        order: 5,
        consumes: ['search-plan-result'],
        produces: ['sourcing-strategy-result']
      },
      {
        id: 'candidate-assessment',
        label: 'Candidate Assessment',
        order: 6,
        consumes: ['sourcing-strategy-result'],
        produces: ['candidate-assessment-result']
      },
      {
        id: 'compile-report',
        label: 'Compile Final Report',
        order: 7,
        consumes: ['candidate-assessment-result'],
        produces: ['report-markdown']
      },
      {
        id: 'finalize-run',
        label: 'Finalize Run',
        order: 8,
        consumes: ['report-markdown'],
        produces: ['run-summary']
      }
    ];

    artifacts = [
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
        id: 'jd-diagnosis-result',
        name: 'JD Diagnosis Result',
        kind: 'markdown',
        mimeType: 'text/markdown',
        stageId: 'jd-diagnosis'
      },
      {
        id: 'search-plan-result',
        name: 'Search Plan Result',
        kind: 'markdown',
        mimeType: 'text/markdown',
        stageId: 'search-plan'
      },
      {
        id: 'sourcing-strategy-result',
        name: 'Sourcing Strategy Result',
        kind: 'markdown',
        mimeType: 'text/markdown',
        stageId: 'sourcing-strategy'
      },
      {
        id: 'candidate-assessment-result',
        name: 'Candidate Assessment Result Summary',
        kind: 'json',
        mimeType: 'application/json',
        stageId: 'candidate-assessment'
      },
      {
        id: 'report-markdown',
        name: 'Compiled Report',
        kind: 'markdown',
        mimeType: 'text/markdown',
        stageId: 'compile-report'
      },
      {
        id: 'run-summary',
        name: 'Run Summary',
        kind: 'json',
        mimeType: 'application/json',
        stageId: 'finalize-run'
      }
    ];

    steps = [
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
        id: 'execute-jd-diagnosis',
        stageId: 'jd-diagnosis',
        kind: 'remote-llm-call',
        runnerId: engine.runnerId,
        status: 'pending',
        consumes: ['workflow-brief'],
        produces: ['jd-diagnosis-result']
      },
      {
        id: 'execute-search-plan',
        stageId: 'search-plan',
        kind: 'remote-llm-call',
        runnerId: engine.runnerId,
        status: 'pending',
        consumes: ['jd-diagnosis-result'],
        produces: ['search-plan-result']
      },
      {
        id: 'execute-sourcing-strategy',
        stageId: 'sourcing-strategy',
        kind: 'remote-llm-call',
        runnerId: engine.runnerId,
        status: 'pending',
        consumes: ['search-plan-result'],
        produces: ['sourcing-strategy-result']
      },
      {
        id: 'execute-candidate-assessment',
        stageId: 'candidate-assessment',
        kind: 'remote-llm-call',
        runnerId: engine.runnerId,
        status: 'pending',
        consumes: ['sourcing-strategy-result'],
        produces: ['candidate-assessment-result']
      },
      {
        id: 'compile-results',
        stageId: 'compile-report',
        kind: 'result-compilation',
        runnerId: engine.runnerId,
        status: 'pending',
        consumes: ['candidate-assessment-result'],
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
    ];
  } else {
    // Traditional single-stage approach for local template runner
    stages = [
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

    artifacts = [
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

    steps = [
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
    ];
  }

  return {
    workflow,
    engine,
    stages,
    artifacts,
    steps
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
  
  // Extract performance and token usage metrics from execution result
  const executionMetrics = executionResult.execution?.metrics || {};
  const tokenUsage = executionMetrics.tokenUsage;
  const totalDurationMs = executionMetrics.totalDurationMs || (completedAtMs - requestContext.startedAtMs);

  return {
    requestId: requestContext.requestId,
    runId: requestContext.runId,
    apiVersion: effectiveExecutionPlan.workflow.version,
    startedAt: toIso(requestContext.startedAtMs),
    completedAt: toIso(completedAtMs),
    durationMs: completedAtMs - requestContext.startedAtMs,
    totalDurationMs: totalDurationMs,
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
    finalArtifactId: executionResult.execution.finalArtifactId,
    performance: {
      totalDurationMs: totalDurationMs,
      stepDurationMs: completedAtMs - requestContext.startedAtMs,
      tokenUsage
    }
  };
}

async function preparePayloadForExecution(payload = {}) {
  const activePayload = {
    ...payload,
    searchContext: {
      ...(payload.searchContext || {})
    },
    runtime: {
      ...(payload.runtime || {})
    }
  };

  if (activePayload.templateId === 'auto') {
    const classification = await classifyRequest(activePayload.searchContext);
    if (classification.needsClarification) {
      throw createError('CLARIFICATION_REQUIRED', classification.message, undefined, 400);
    }
    activePayload.templateId = classification.templateId;
    if (classification.extractedContext) {
      activePayload.searchContext.roleTitle = classification.extractedContext.roleTitle;
    }
  }

  const ragContext = await getDomainKnowledge(activePayload.searchContext.roleTitle, activePayload.searchContext.targetIndustry);
  if (ragContext) {
    activePayload.searchContext.hiringBrief = (activePayload.searchContext.hiringBrief || '') + ragContext;
  }

  return activePayload;
}

async function applyExpertReview(markdown, templateId) {
  if (!markdown) return markdown;
  const critic = await validateWithExpertRules(markdown, templateId);
  if (critic.passed) return markdown;
  return `${markdown}\n\n> [!WARNING]\n> **Expert Rule Validation Failed:**\n> ${critic.feedback}\n`;
}

function buildRunResponse({
  activePayload,
  requestContext,
  effectiveExecutionPlan,
  executionResult,
  metadata,
  finalMarkdown,
  jobId = undefined
}) {
  const fallbackApplied = requestContext.executionTarget.fallbackApplied || Boolean(executionResult.execution?.remote?.fallbackApplied);
  const fallbackKind = executionResult.execution?.remote?.fallbackKind
    || effectiveExecutionPlan.engine?.fallbackKind
    || requestContext.executionTarget.fallbackKind;
  const fallbackReason = executionResult.execution?.remote?.error?.message
    || effectiveExecutionPlan.engine?.fallbackReason
    || requestContext.executionTarget.fallbackReason;

  const response = {
    ok: true,
    requestId: requestContext.requestId,
    ...(jobId ? { jobId } : {}),
    mode: effectiveExecutionPlan.engine.resolvedMode,
    templateId: activePayload.templateId,
    run: {
      id: requestContext.runId,
      status: executionResult.execution.status,
      templateId: activePayload.templateId,
      mode: effectiveExecutionPlan.engine.resolvedMode,
      runnerId: effectiveExecutionPlan.engine.runnerId,
      stageCount: executionResult.execution.stageCount,
      stepCount: executionResult.execution.stepCount,
      artifactCount: executionResult.execution.artifacts?.length || 0,
      finalArtifactId: executionResult.execution.finalArtifactId
    },
    engine: effectiveExecutionPlan.engine,
    summary: buildSummary(activePayload),
    reportMarkdown: finalMarkdown,
    candidateAssessment: executionResult.execution?.result?.candidateAssessment,
    metadata,
    orchestration: {
      requestId: requestContext.requestId,
      runId: requestContext.runId,
      ...(jobId ? { jobId } : {}),
      workflow: effectiveExecutionPlan.workflow,
      execution: {
        ...executionResult.execution,
        metrics: {
          ...executionResult.execution.metrics,
          requestTotalDurationMs: metadata.durationMs,
          executionDurationMs: executionResult.execution.metrics?.totalDurationMs || metadata.totalDurationMs
        }
      },
      selection: {
        requestedMode: requestContext.requestedMode,
        requestedRunner: requestContext.requestedRunner,
        preferredRunnerId: requestContext.executionTarget.preferredRunnerId,
        resolvedRunnerId: effectiveExecutionPlan.engine.runnerId,
        resolvedMode: effectiveExecutionPlan.engine.resolvedMode,
        resolutionSource: requestContext.executionTarget.resolutionSource,
        strategy: requestContext.executionTarget.strategy,
        fallbackApplied,
        fallbackKind,
        fallbackReason
      }
    }
  };

  return response;
}

// Main function to run talent intelligence - can be called synchronously or as part of a job
export async function runTalentIntelligence(payload, context = {}) {
  const activePayload = await preparePayloadForExecution(payload);
  const requestContext = buildRequestContext(activePayload, context);
  const executionPlan = buildExecutionPlan(requestContext);
  const executionResult = await executeWorkflow(requestContext, executionPlan);
  const effectiveExecutionPlan = executionResult.executionPlan || executionPlan;
  const metadata = buildMetadata(requestContext, effectiveExecutionPlan, executionResult);
  const finalMarkdown = await applyExpertReview(executionResult.reportMarkdown, activePayload.templateId);

  return buildRunResponse({
    activePayload,
    requestContext,
    effectiveExecutionPlan,
    executionResult,
    metadata,
    finalMarkdown
  });
}

// Function to run talent intelligence as a background job with webhook support
export async function runTalentIntelligenceAsJob(payload, context = {}) {
  const jobId = context.jobId || generateJobId();
  const webhookUrl = payload.webhookUrl;
  const requestId = context.requestId;
  let activePayload = payload;
  let requestContext;
  
  // Create initial job entry if not provided
  if (!jobManager.getJob(jobId)) {
    jobManager.createJob(jobId, payload, 'processing', 10);
  }

  try {
    activePayload = await preparePayloadForExecution(payload);
    requestContext = buildRequestContext(activePayload, { ...context, jobId });
    const executionPlan = buildExecutionPlan(requestContext);
    
    // Update job progress during execution
    jobManager.updateJob(jobId, { 
      status: 'processing', 
      progress: 30,
      message: 'Executing workflow...'
    });
    
    const executionResult = await executeWorkflow(requestContext, executionPlan);
    const effectiveExecutionPlan = executionResult.executionPlan || executionPlan;
    const metadata = buildMetadata(requestContext, effectiveExecutionPlan, executionResult);
    const finalMarkdown = await applyExpertReview(executionResult.reportMarkdown, activePayload.templateId);
    const result = buildRunResponse({
      activePayload,
      requestContext,
      effectiveExecutionPlan,
      executionResult,
      metadata,
      finalMarkdown,
      jobId
    });
    const persistedResult = await persistRunArtifacts(result, activePayload);

    // Update job with final result
    jobManager.updateJob(jobId, { 
      status: 'completed', 
      progress: 100,
      result: persistedResult,
      message: 'Execution completed successfully'
    });

    // Trigger webhook if provided
    if (webhookUrl) {
      await jobManager.triggerWebhook(jobId, webhookUrl, {
        status: 'completed',
        result: persistedResult,
        error: null
      });
    }

    return persistedResult;
  } catch (error) {
    // Update job with error
    const errorObj = {
      ok: false,
      error: {
        code: error.code || 'JOB_EXECUTION_FAILED',
        message: error.message || 'Job execution failed',
        details: error.details || {}
      }
    };

    await persistRunFailure({
      requestId,
      runId: requestContext?.runId,
      requestPayload: activePayload,
      error: errorObj.error,
      timestamp: new Date().toISOString()
    });

    jobManager.updateJob(jobId, { 
      status: 'failed', 
      progress: 100,
      error: errorObj,
      message: error.message || 'Job execution failed'
    });

    // Trigger webhook for failure if provided
    if (webhookUrl) {
      await jobManager.triggerWebhook(jobId, webhookUrl, {
        status: 'failed',
        result: null,
        error: errorObj
      });
    }

    throw error;
  }
}

// Function to get job status by ID
export function getJobStatus(jobId) {
  return jobManager.getJob(jobId);
}

// Concurrency limiter implementation for batch processing
function createConcurrencyLimiter(concurrency = 5) {
  const queue = [];
  let activeCount = 0;
  
  function next() {
    if (queue.length === 0 || activeCount >= concurrency) return;
    
    activeCount++;
    const { promiseFn, resolve, reject } = queue.shift();
    
    promiseFn()
      .then(result => {
        resolve(result);
      })
      .catch(error => {
        reject(error);
      })
      .finally(() => {
        activeCount--;
        next();
      });
  }
  
  return async function(promiseFn) {
    if (activeCount < concurrency) {
      activeCount++;
      
      try {
        const result = await promiseFn();
        activeCount--;
        next();
        return result;
      } catch (error) {
        activeCount--;
        next();
        throw error;
      }
    } else {
      return new Promise((resolve, reject) => {
        queue.push({ promiseFn, resolve, reject });
        next();
      });
    }
  };
}

// Function to run multiple talent intelligence tasks in parallel
export async function runTalentIntelligenceBatch(payloads, context = {}, options = {}) {
  const concurrency = options.concurrency || Math.min(payloads.length, 5); // Default to 5 concurrent executions
  const limiter = createConcurrencyLimiter(concurrency);
  
  // Process each payload in parallel
  const promises = payloads.map(async (payload, index) => {
    try {
      const result = await limiter(() => runTalentIntelligence(payload, {
        ...context,
        runId: `${context.runId || 'batch'}-${index}`
      }));
      
      return {
        index,
        success: true,
        result,
        error: null
      };
    } catch (error) {
      console.error(`Batch item ${index} failed:`, error);
      return {
        index,
        success: false,
        result: null,
        error: {
          message: error.message,
          code: error.code,
          status: error.status
        }
      };
    }
  });
  
  // Wait for all promises to settle (using Promise.allSettled to prevent one failure from crashing others)
  const results = await Promise.allSettled(promises);
  
  // Process results
  const processedResults = results.map((result, idx) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      console.error(`Batch item ${idx} rejected:`, result.reason);
      return {
        index: idx,
        success: false,
        result: null,
        error: {
          message: result.reason?.message || 'Unknown error',
          code: result.reason?.code || 'UNKNOWN_ERROR',
          status: result.reason?.status || 500
        }
      };
    }
  });
  
  // Return batch summary
  const successfulCount = processedResults.filter(r => r.success).length;
  const failedCount = processedResults.filter(r => !r.success).length;
  
  return {
    ok: true,
    batchId: context.batchId || `batch_${Date.now()}`,
    totalCount: payloads.length,
    successfulCount,
    failedCount,
    results: processedResults,
    summary: {
      total: payloads.length,
      succeeded: successfulCount,
      failed: failedCount,
      successRate: payloads.length > 0 ? (successfulCount / payloads.length) * 100 : 0
    }
  };
}

// Export job-related functions
export { 
  createJob, 
  getJob, 
  startJobAsync,
  JOB_STATUS
};
