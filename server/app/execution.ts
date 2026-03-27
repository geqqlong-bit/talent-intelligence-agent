// @ts-nocheck
import { API_VERSION, createError } from './schema.js';
import { callRemoteOpenAICompatible, resolveRemoteOpenAIConfig } from './remote-openai.js';

// Concurrency limiter implementation
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

export const WORKFLOW_ID = 'talent-intelligence.local-template-render';
export const REMOTE_WORKFLOW_ID = 'talent-intelligence.remote-llm-run';
export const LOCAL_ONLY_BOUNDARY = 'local-only';
export const DEFAULT_LOCAL_RUNNER_ID = 'local-template';

const RUNNER_REGISTRY = {
  'local-template': {
    id: 'local-template',
    label: 'Local Template Runner',
    kind: 'local-template-engine',
    provider: 'local',
    adapter: 'template-renderer',
    executionMode: 'local-template',
    publicMode: 'template-renderer',
    workflowId: WORKFLOW_ID,
    capabilities: ['template-render', 'workflow-stage-handoff', 'artifact-tracking'],
    acceptsModes: ['local', 'template-renderer', 'openai', 'llm', 'remote'],
    acceptsRunners: ['template-renderer', 'local', 'builtin', 'default'],
    selectionReason: 'Local template runner is the executable backend bundled with this service.'
  },
  'openai-chat': {
    id: 'openai-chat',
    label: 'OpenAI-Compatible Remote Runner',
    kind: 'remote-llm-runner',
    provider: 'openai-compatible',
    adapter: 'chat-completions',
    executionMode: 'remote-llm',
    publicMode: 'llm',
    workflowId: REMOTE_WORKFLOW_ID,
    capabilities: ['llm-generate', 'optional-remote-fallback'],
    acceptsModes: ['openai', 'llm', 'remote'],
    acceptsRunners: ['openai', 'openai-chat', 'remote-llm'],
    selectionReason: 'OpenAI-compatible chat-completions adapter is available when explicitly enabled and configured.'
  }
};

function normalizeText(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase();
}

function getRunnerAvailability(runner, runtime = {}) {
  if (runner.id === DEFAULT_LOCAL_RUNNER_ID) {
    return {
      available: true,
      executable: true,
      implementationStatus: 'active',
      selectionReason: runner.selectionReason,
      remote: undefined
    };
  }

  const remote = resolveRemoteOpenAIConfig(runtime);
  return {
    available: remote.callable,
    executable: remote.callable,
    implementationStatus: remote.callable ? 'active' : 'standby',
    selectionReason: remote.reason,
    remote
  };
}

function publicRunnerView(runner, runtime = {}) {
  const availability = getRunnerAvailability(runner, runtime);
  return {
    id: runner.id,
    label: runner.label,
    kind: runner.kind,
    provider: runner.provider,
    adapter: runner.adapter,
    executionMode: runner.executionMode,
    publicMode: runner.publicMode,
    available: availability.available,
    executable: availability.executable,
    capabilities: [...runner.capabilities],
    workflowId: runner.workflowId,
    boundary: LOCAL_ONLY_BOUNDARY,
    implementationStatus: availability.implementationStatus,
    selectionReason: availability.selectionReason,
    remote: availability.remote
      ? {
          readiness: availability.remote.readiness,
          enabled: availability.remote.enabled,
          configured: availability.remote.configured,
          explicitRemoteRequest: availability.remote.explicitRemoteRequest,
          required: availability.remote.required
        }
      : undefined
  };
}

export function listRunnerCatalog(runtime = {}) {
  return Object.values(RUNNER_REGISTRY).map((runner) => publicRunnerView(runner, runtime));
}

function findRequestedRunner(runtime = {}) {
  const requestedRunnerId = normalizeKey(runtime.runner || runtime.runnerId);
  if (!requestedRunnerId) return undefined;

  return Object.values(RUNNER_REGISTRY).find((runner) => {
    if (runner.id === requestedRunnerId) return true;
    return runner.acceptsRunners.includes(requestedRunnerId);
  });
}

function findModeCandidate(runtime = {}) {
  const requestedMode = normalizeKey(runtime.executionMode || runtime.mode || 'openai');
  return Object.values(RUNNER_REGISTRY).find((runner) => runner.acceptsModes.includes(requestedMode));
}

function listAcceptedModes() {
  return [...new Set(Object.values(RUNNER_REGISTRY).flatMap((runner) => runner.acceptsModes))].sort();
}

function buildInvalidRunnerError(requestedRunner) {
  return createError(
    'INVALID_RUNNER',
    `Unsupported runner: ${requestedRunner}`,
    {
      requestedRunner,
      allowed: Object.keys(RUNNER_REGISTRY),
      aliases: Object.fromEntries(Object.values(RUNNER_REGISTRY).map((runner) => [runner.id, runner.acceptsRunners]))
    }
  );
}

function buildInvalidModeError(requestedMode) {
  return createError(
    'INVALID_RUNTIME_MODE',
    `Unsupported runtime mode: ${requestedMode}`,
    {
      requestedMode,
      allowed: listAcceptedModes()
    }
  );
}

function selectionFallbackKindFor(remote) {
  if (!remote) return 'runner-unavailable';
  if (remote.readiness === 'misconfigured') return 'remote-invalid-config';
  if (remote.readiness === 'disabled' || remote.readiness === 'configured-but-disabled') return 'remote-disabled';
  if (remote.readiness === 'standby') return 'remote-not-selected';
  return 'runner-unavailable';
}

function remoteSelectionErrorCode(remote) {
  if (!remote?.required) return 'REMOTE_RUNNER_REQUIRED_BUT_UNAVAILABLE';
  if (remote.readiness === 'misconfigured') return 'REMOTE_RUNNER_REQUIRED_BUT_INVALID_CONFIG';
  if (remote.readiness === 'disabled' || remote.readiness === 'configured-but-disabled') return 'REMOTE_RUNNER_REQUIRED_BUT_DISABLED';
  if (remote.readiness === 'standby') return 'REMOTE_RUNNER_REQUIRED_BUT_NOT_SELECTED';
  return 'REMOTE_RUNNER_REQUIRED_BUT_UNAVAILABLE';
}

export function resolveExecutionTarget(runtime = {}) {
  const requestedMode = normalizeText(runtime.executionMode || runtime.mode || 'openai', 'openai');
  const requestedRunner = normalizeText(runtime.runner || runtime.runnerId);

  const runnerMatch = findRequestedRunner(runtime);
  const modeMatch = findModeCandidate(runtime);

  if (requestedRunner && !runnerMatch) {
    throw buildInvalidRunnerError(requestedRunner);
  }

  if (!requestedRunner && normalizeText(runtime.executionMode || runtime.mode) && !modeMatch) {
    throw buildInvalidModeError(requestedMode);
  }

  const preferred = runnerMatch || modeMatch || RUNNER_REGISTRY[DEFAULT_LOCAL_RUNNER_ID];
  const preferredAvailability = getRunnerAvailability(preferred, runtime);

  if (!preferredAvailability.available && preferredAvailability.remote?.required) {
    throw createError(
      remoteSelectionErrorCode(preferredAvailability.remote),
      preferredAvailability.selectionReason,
      {
        requestedMode,
        requestedRunner: requestedRunner || preferred.id,
        preferredRunnerId: preferred.id,
        remote: preferredAvailability.remote
      },
      503
    );
  }

  const executable = preferredAvailability.available ? preferred : RUNNER_REGISTRY[DEFAULT_LOCAL_RUNNER_ID];
  const fallbackApplied = preferred.id !== executable.id;
  const resolutionSource = runnerMatch ? 'runner' : modeMatch ? 'mode' : 'default';
  const strategy = runnerMatch ? 'requested-runner' : modeMatch ? 'requested-mode' : 'default-runner';
  const fallbackKind = fallbackApplied ? selectionFallbackKindFor(preferredAvailability.remote) : 'none';

  return {
    requestedMode,
    requestedRunner: requestedRunner || undefined,
    preferredRunnerId: preferred.id,
    resolvedMode: executable.publicMode,
    resolvedRunnerId: executable.id,
    executionMode: executable.executionMode,
    workflowId: executable.workflowId,
    fallbackApplied,
    fallbackKind,
    fallbackReason: fallbackApplied
      ? `Requested ${resolutionSource} ${preferred.id} is not callable for this request; using ${executable.id} instead. ${preferredAvailability.selectionReason}`
      : preferredAvailability.selectionReason,
    resolutionSource,
    strategy,
    selectionStrategy: strategy,
    requestedRunnerAvailability: preferredAvailability
  };
}

export function createWorkflowDescriptor(executionTarget, version = API_VERSION) {
  return {
    id: executionTarget.workflowId,
    version,
    executionMode: executionTarget.executionMode,
    runnerId: executionTarget.resolvedRunnerId,
    futureHook: 'workflowRunner.execute'
  };
}

export function createEngineDescriptor(executionTarget, version = API_VERSION, requestedModel = 'template-only') {
  const runner = RUNNER_REGISTRY[executionTarget.resolvedRunnerId] || RUNNER_REGISTRY[DEFAULT_LOCAL_RUNNER_ID];
  const requestedAvailability = executionTarget.requestedRunnerAvailability || getRunnerAvailability(runner, {});

  return {
    kind: runner.kind,
    version,
    provider: runner.provider,
    adapter: runner.adapter,
    runnerId: runner.id,
    executionMode: runner.executionMode,
    requestedMode: executionTarget.requestedMode,
    requestedRunner: executionTarget.requestedRunner,
    preferredRunnerId: executionTarget.preferredRunnerId,
    requestedModel,
    resolvedMode: executionTarget.resolvedMode,
    implementationStatus: requestedAvailability.implementationStatus,
    resolutionSource: executionTarget.resolutionSource,
    fallbackApplied: executionTarget.fallbackApplied,
    fallbackKind: executionTarget.fallbackKind,
    fallbackReason: executionTarget.fallbackReason,
    boundary: LOCAL_ONLY_BOUNDARY,
    remote: requestedAvailability.remote
      ? {
          readiness: requestedAvailability.remote.readiness,
          enabled: requestedAvailability.remote.enabled,
          configured: requestedAvailability.remote.configured,
          callable: requestedAvailability.remote.callable,
          required: requestedAvailability.remote.required,
          explicitRemoteRequest: requestedAvailability.remote.explicitRemoteRequest,
          baseUrl: requestedAvailability.remote.request.baseUrl || undefined,
          path: requestedAvailability.remote.request.path,
          model: requestedAvailability.remote.request.model
        }
      : undefined
  };
}

function toIso(valueMs) {
  return new Date(valueMs).toISOString();
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function summarizeValue(value, maxLength = 280) {
  if (value === undefined) return undefined;
  const raw = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  if (raw.length <= maxLength) return raw;
  return `${raw.slice(0, maxLength - 3)}...`;
}

function createStepSummary(step, startedAtMs, completedAtMs, output = undefined, status = 'completed') {
  // Extract token usage from output if available
  let tokenUsage = undefined;
  if (output && typeof output === 'object') {
    if (output.tokenUsage) {
      tokenUsage = output.tokenUsage;
    } else if (output.remoteInfo && output.remoteInfo.tokenUsage) {
      tokenUsage = output.remoteInfo.tokenUsage;
    }
  }
  
  return {
    id: step.id,
    stageId: step.stageId,
    kind: step.kind,
    runnerId: step.runnerId,
    status,
    startedAt: toIso(startedAtMs),
    completedAt: toIso(completedAtMs),
    durationMs: completedAtMs - startedAtMs,
    consumes: [...(step.consumes || [])],
    produces: [...(step.produces || [])],
    output,
    metrics: {
      durationMs: completedAtMs - startedAtMs,
      tokenUsage
    }
  };
}

function createStageSummary(stage, steps) {
  const relevantSteps = steps.filter((step) => step.stageId === stage.id);
  const startedAt = relevantSteps[0]?.startedAt;
  const completedAt = relevantSteps[relevantSteps.length - 1]?.completedAt;
  const durationMs = relevantSteps.reduce((total, step) => total + (step.durationMs || 0), 0);

  return {
    id: stage.id,
    label: stage.label,
    order: stage.order,
    status: relevantSteps.every((step) => step.status === 'completed') ? 'completed' : 'pending',
    stepCount: relevantSteps.length,
    stepIds: relevantSteps.map((step) => step.id),
    startedAt,
    completedAt,
    durationMs,
    consumes: [...(stage.consumes || [])],
    produces: [...(stage.produces || [])]
  };
}

function createArtifactSummary({ artifactId, name, kind, mimeType, producedBy, stageId, content, metadata = {} }) {
  return {
    id: artifactId,
    name,
    kind,
    mimeType,
    stageId,
    producedBy,
    boundary: LOCAL_ONLY_BOUNDARY,
    metadata: {
      ...clone(metadata),
      preview: summarizeValue(content)
    }
  };
}

function createArtifactRecorder(planArtifacts = []) {
  const registry = new Map(
    planArtifacts.map((artifact) => [artifact.id, { ...clone(artifact), status: 'planned' }])
  );

  return {
    materialize(artifactId, content, extras = {}) {
      const base = registry.get(artifactId) || { id: artifactId };
      const artifact = {
        ...base,
        ...clone(extras),
        id: artifactId,
        content: clone(content),
        status: 'materialized'
      };
      registry.set(artifactId, artifact);
      return artifact;
    },
    get(artifactId) {
      return registry.get(artifactId);
    },
    listSummaries() {
      return Array.from(registry.values())
        .filter((artifact) => artifact.status === 'materialized')
        .map((artifact) => createArtifactSummary({
          artifactId: artifact.id,
          name: artifact.name,
          kind: artifact.kind,
          mimeType: artifact.mimeType,
          producedBy: artifact.producedBy,
          stageId: artifact.stageId,
          content: artifact.content,
          metadata: artifact.metadata
        }));
    }
  };
}

function createRunStep(executionPlan, completedSteps) {
  return async (stepId, produceOutput) => {
    const step = executionPlan.steps.find((item) => item.id === stepId) || {
      id: stepId,
      stageId: 'adhoc',
      kind: 'task',
      runnerId: DEFAULT_LOCAL_RUNNER_ID,
      consumes: [],
      produces: []
    };
    const startedAtMs = Date.now();
    const output = await produceOutput();
    const completedAtMs = Date.now();
    const summary = createStepSummary(step, startedAtMs, completedAtMs, output);
    completedSteps.push(summary);
    return output;
  };
}

function renderEvidenceBasedAssessmentMarkdown(assessment, index = 0) {
  if (!assessment || typeof assessment !== 'object') {
    return '信息不足：未返回结构化候选人评估。';
  }

  const dimensions = Array.isArray(assessment.dimensions) ? assessment.dimensions : [];
  const overallRisks = Array.isArray(assessment.overallRisks) ? assessment.overallRisks : [];
  const followUpQuestions = Array.isArray(assessment.followUpQuestions) ? assessment.followUpQuestions : [];

  const dimensionSections = dimensions.map((dimension) => {
    const evidenceQuotes = Array.isArray(dimension.evidenceQuotes) && dimension.evidenceQuotes.length
      ? dimension.evidenceQuotes.map((quote) => `  - "${quote}"`).join('\n')
      : '  - 信息不足';
    const missingInformation = Array.isArray(dimension.missingInformation) && dimension.missingInformation.length
      ? dimension.missingInformation.map((item) => `  - ${item}`).join('\n')
      : '  - 无';

    return [
      `#### ${dimension.label || dimension.key || `维度 ${index + 1}`}`,
      `- 判断：${dimension.judgement || '信息不足'}`,
      `- 置信度：${dimension.confidence || '低'}`,
      `- 证据状态：${dimension.evidenceStatus || '信息不足'}`,
      '- 简历证据：',
      evidenceQuotes,
      '- 缺失信息：',
      missingInformation
    ].join('\n');
  }).join('\n\n');

  const riskSection = overallRisks.length
    ? overallRisks.map((risk) => `- ${risk.label || '风险'}：${risk.detail || '信息不足'}（置信度：${risk.confidence || '低'}；证据状态：${risk.evidenceStatus || '信息不足'}）`).join('\n')
    : '- 无明确补充风险';

  const questionSection = followUpQuestions.length
    ? followUpQuestions.map((question) => `- ${question}`).join('\n')
    : '- 无';

  return [
    `### 候选人评估｜${assessment.candidateName || `候选人 ${index + 1}`}`,
    `- 推荐结论：${assessment.recommendation || '谨慎推进'}`,
    `- 摘要：${assessment.summary || '信息不足'}`,
    '',
    '#### 评估维度',
    dimensionSections || '- 信息不足',
    '',
    '#### 综合风险',
    riskSection,
    '',
    '#### 下一轮追问',
    questionSection
  ].join('\n');
}

function toAssessmentScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  return Math.min(100, Math.max(0, Number(numeric.toFixed(2))));
}

function normalizeAssessmentRubrics(rubrics = []) {
  if (!Array.isArray(rubrics) || rubrics.length === 0) return [];
  const totalWeight = rubrics.reduce((sum, rubric) => sum + (Number(rubric?.weight) > 0 ? Number(rubric.weight) : 0), 0) || rubrics.length;
  return rubrics.map((rubric, index) => {
    const weight = Number(rubric?.weight) > 0 ? Number(rubric.weight) : 1;
    return {
      id: rubric?.id || `dimension_${index + 1}`,
      label: rubric?.label || rubric?.name || rubric?.dimension || `维度 ${index + 1}`,
      description: rubric?.description,
      weight,
      normalizedWeight: Number((weight / totalWeight).toFixed(6))
    };
  });
}

function inferLegacyDimensionScore(payload, rubric, index) {
  if (!payload || typeof payload !== 'object') return undefined;
  const compactLabel = String(rubric.label || '').replace(/\s+/g, '');
  const keys = [
    `${rubric.id}Score`,
    `${compactLabel}Score`,
    ['technicalScore', 'culturalFitScore', 'experienceScore'][index]
  ].filter(Boolean);

  for (const key of keys) {
    const score = toAssessmentScore(payload[key]);
    if (score !== undefined) return score;
  }

  return toAssessmentScore(payload.overallScore ?? payload.score);
}

function normalizeCandidateAssessmentOutput(rawAssessment, { candidate = {}, rubrics = [], candidateIndex = 0 } = {}) {
  const normalizedRubrics = normalizeAssessmentRubrics(rubrics);
  const payload = rawAssessment && typeof rawAssessment === 'object' ? rawAssessment : { rawContent: rawAssessment };
  const existingDimensions = Array.isArray(payload.dimensions) ? payload.dimensions : [];
  const isEvidenceBased = existingDimensions.some((dimension) => Array.isArray(dimension?.evidenceQuotes) || dimension?.evidenceStatus);

  const dimensions = isEvidenceBased
    ? existingDimensions.map((dimension, index) => ({
        ...dimension,
        key: dimension.key || dimension.id || `dimension_${index + 1}`,
        id: dimension.id || dimension.key || `dimension_${index + 1}`,
        label: dimension.label || `维度 ${index + 1}`,
        evidenceQuotes: Array.isArray(dimension.evidenceQuotes) ? dimension.evidenceQuotes : [],
        missingInformation: Array.isArray(dimension.missingInformation) ? dimension.missingInformation : [],
        confidence: dimension.confidence || '低',
        evidenceStatus: dimension.evidenceStatus || '信息不足'
      }))
    : normalizedRubrics.length
      ? normalizedRubrics.map((rubric, index) => {
          const matched = existingDimensions.find((dimension) => {
            const key = dimension?.key || dimension?.id;
            const label = dimension?.label;
            return key === rubric.id || label === rubric.label;
          }) || {};
          const score = toAssessmentScore(matched.score ?? matched.dimensionScore ?? inferLegacyDimensionScore(payload, rubric, index));
          return {
            ...matched,
            key: matched.key || rubric.id,
            id: matched.id || rubric.id,
            label: matched.label || rubric.label,
            description: matched.description || rubric.description,
            weight: rubric.weight,
            normalizedWeight: rubric.normalizedWeight,
            score,
            weightedScore: score === undefined ? undefined : Number((score * rubric.normalizedWeight).toFixed(2))
          };
        })
      : existingDimensions;

  const weightedOverallScore = isEvidenceBased || !dimensions.length
    ? undefined
    : Number(dimensions.reduce((sum, dimension) => sum + (dimension.weightedScore || 0), 0).toFixed(2));
  const overallScore = isEvidenceBased
    ? undefined
    : toAssessmentScore(payload.overallScore ?? payload.score ?? weightedOverallScore);

  return {
    ...payload,
    candidateIndex,
    candidateName: payload.candidateName || candidate.name || `Candidate ${candidateIndex + 1}`,
    overallScore,
    score: overallScore,
    weightedOverallScore,
    weighted: !isEvidenceBased && dimensions.length > 0,
    dimensions,
    strengths: Array.isArray(payload.strengths) ? payload.strengths : (Array.isArray(candidate.highlights) ? candidate.highlights : []),
    concerns: Array.isArray(payload.concerns) ? payload.concerns : (Array.isArray(candidate.concerns) ? candidate.concerns : [])
  };
}

function buildExecutionEnvelope({ executionPlan, artifactStore, completedSteps, runnerId, result, extra = {} }) {
  const stages = executionPlan.stages.map((stage) => createStageSummary(stage, completedSteps));
  const artifacts = artifactStore.listSummaries();
  
  // Calculate aggregated metrics
  const totalDurationMs = completedSteps.reduce((total, step) => total + (step.metrics?.durationMs || 0), 0);
  const totalPromptTokens = completedSteps.reduce((total, step) => {
    const tokens = step.metrics?.tokenUsage?.promptTokens;
    return total + (typeof tokens === 'number' ? tokens : 0);
  }, 0);
  const totalCompletionTokens = completedSteps.reduce((total, step) => {
    const tokens = step.metrics?.tokenUsage?.completionTokens;
    return total + (typeof tokens === 'number' ? tokens : 0);
  }, 0);
  const totalTokens = completedSteps.reduce((total, step) => {
    const tokens = step.metrics?.tokenUsage?.totalTokens;
    return total + (typeof tokens === 'number' ? tokens : 0);
  }, 0);
  
  const aggregatedTokenUsage = totalPromptTokens > 0 || totalCompletionTokens > 0 || totalTokens > 0 
    ? {
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalTokens
      }
    : undefined;

  return {
    status: 'completed',
    runnerId,
    boundary: LOCAL_ONLY_BOUNDARY,
    stageCount: stages.length,
    stepCount: completedSteps.length,
    stages,
    steps: completedSteps,
    artifacts,
    finalArtifactId: result.finalArtifactId,
    result,
    metrics: {
      totalDurationMs,
      tokenUsage: aggregatedTokenUsage
    },
    ...extra
  };
}

async function executeLocalTemplateRunner({ payload, executionPlan, renderTemplate, requestContext }) {
  const artifactStore = createArtifactRecorder(executionPlan.artifacts);
  const completedSteps = [];
  const runStep = createRunStep(executionPlan, completedSteps);

  await runStep('capture-request', async () => {
    const artifact = artifactStore.materialize('normalized-request', payload, {
      producedBy: 'capture-request',
      metadata: {
        templateId: payload.templateId,
        roleTitle: payload.searchContext?.roleTitle,
        projectName: payload.searchContext?.projectName
      }
    });
    return {
      artifactId: artifact.id,
      fieldsCaptured: Object.keys(payload.searchContext || {}).length
    };
  });

  await runStep('build-brief', async () => {
    const requestArtifact = artifactStore.get('normalized-request');
    const brief = {
      templateId: payload.templateId,
      projectName: payload.searchContext?.projectName,
      roleTitle: payload.searchContext?.roleTitle,
      objective: payload.searchContext?.objective,
      targetCompanies: payload.searchContext?.targetCompanies || [],
      constraints: {
        location: payload.searchContext?.location,
        salaryRange: payload.searchContext?.salaryRange,
        mustHaveSkills: payload.searchContext?.mustHaveSkills || [],
        dealBreakers: payload.searchContext?.dealBreakers || []
      },
      sourceArtifactId: requestArtifact?.id
    };
    const artifact = artifactStore.materialize('workflow-brief', brief, {
      producedBy: 'build-brief',
      metadata: {
        sourceArtifactId: requestArtifact?.id,
        targetCompanyCount: brief.targetCompanies.length
      }
    });
    return {
      artifactId: artifact.id,
      sourceArtifactId: requestArtifact?.id,
      targetCompanyCount: brief.targetCompanies.length
    };
  });

  const renderOutput = await runStep('render-template', async () => {
    const reportMarkdown = renderTemplate(payload);
    const briefArtifact = artifactStore.get('workflow-brief');
    const artifact = artifactStore.materialize('report-markdown', reportMarkdown, {
      producedBy: 'render-template',
      metadata: {
        templateId: payload.templateId,
        sourceArtifactId: briefArtifact?.id,
        lineCount: reportMarkdown.split('\n').length,
        renderer: 'renderTemplate'
      }
    });
    return {
      artifactId: artifact.id,
      renderer: 'renderTemplate',
      templateId: payload.templateId,
      sourceArtifactId: briefArtifact?.id
    };
  });

  const finalizationOutput = await runStep('finalize-response', async () => {
    const reportArtifact = artifactStore.get('report-markdown');
    const runSummary = {
      runId: requestContext.runId,
      requestId: requestContext.requestId,
      templateId: payload.templateId,
      resolvedRunnerId: executionPlan.engine.runnerId,
      finalArtifactId: reportArtifact?.id
    };
    const artifact = artifactStore.materialize('run-summary', runSummary, {
      producedBy: 'finalize-response',
      metadata: {
        sourceArtifactId: reportArtifact?.id
      }
    });
    return {
      artifactId: artifact.id,
      finalArtifactId: reportArtifact?.id
    };
  });

  const reportArtifact = artifactStore.get('report-markdown');
  const result = {
    renderer: 'renderTemplate',
    templateId: payload.templateId,
    artifactId: renderOutput.artifactId,
    finalArtifactId: finalizationOutput.finalArtifactId,
    finalizationArtifactId: finalizationOutput.artifactId
  };

  return {
    reportMarkdown: reportArtifact?.content || '',
    execution: buildExecutionEnvelope({
      executionPlan,
      artifactStore,
      completedSteps,
      runnerId: DEFAULT_LOCAL_RUNNER_ID,
      result
    })
  };
}

async function executeRemoteRunner({ payload, executionPlan, requestContext }) {
  const artifactStore = createArtifactRecorder(executionPlan.artifacts);
  const completedSteps = [];
  const runStep = createRunStep(executionPlan, completedSteps);

  await runStep('capture-request', async () => {
    const artifact = artifactStore.materialize('normalized-request', payload, {
      producedBy: 'capture-request',
      metadata: {
        templateId: payload.templateId,
        roleTitle: payload.searchContext?.roleTitle,
        projectName: payload.searchContext?.projectName
      }
    });
    return {
      artifactId: artifact.id,
      fieldsCaptured: Object.keys(payload.searchContext || {}).length
    };
  });

  await runStep('build-brief', async () => {
    const requestArtifact = artifactStore.get('normalized-request');
    const brief = {
      templateId: payload.templateId,
      projectName: payload.searchContext?.projectName,
      roleTitle: payload.searchContext?.roleTitle,
      objective: payload.searchContext?.objective,
      targetCompanies: payload.searchContext?.targetCompanies || [],
      constraints: {
        location: payload.searchContext?.location,
        salaryRange: payload.searchContext?.salaryRange,
        mustHaveSkills: payload.searchContext?.mustHaveSkills || [],
        dealBreakers: payload.searchContext?.dealBreakers || []
      },
      sourceArtifactId: requestArtifact?.id
    };
    const artifact = artifactStore.materialize('workflow-brief', brief, {
      producedBy: 'build-brief',
      metadata: {
        sourceArtifactId: requestArtifact?.id,
        targetCompanyCount: brief.targetCompanies.length
      }
    });
    return {
      artifactId: artifact.id,
      sourceArtifactId: requestArtifact?.id,
      targetCompanyCount: brief.targetCompanies.length
    };
  });

  // Execute multi-stage pipeline for remote runner
  await runStep('execute-jd-diagnosis', async () => {
    const briefArtifact = artifactStore.get('workflow-brief');
    const stage = { id: 'jd-diagnosis', label: 'JD Diagnosis' };
    
    const stagePayload = {
      ...payload,
      currentStage: stage,
      stageContext: {
        ...payload.searchContext,
        currentStage: stage.label
      }
    };

    const stageResult = await callRemoteOpenAICompatible({
      payload: stagePayload,
      runtime: requestContext.runtime,
      requestContext,
      stage: stage
    });

    const artifact = artifactStore.materialize('jd-diagnosis-result', stageResult.reportMarkdown, {
      producedBy: 'execute-jd-diagnosis',
      metadata: {
        templateId: payload.templateId,
        sourceArtifactId: briefArtifact?.id,
        renderer: 'openai-compatible-chat-completions',
        remoteInfo: stageResult.remoteInfo
      }
    });

    return {
      artifactId: artifact.id,
      renderer: 'openai-compatible-chat-completions',
      templateId: payload.templateId,
      sourceArtifactId: briefArtifact?.id,
      remoteInfo: stageResult.remoteInfo
    };
  });

  await runStep('execute-search-plan', async () => {
    const prevArtifact = artifactStore.get('jd-diagnosis-result');
    const stage = { id: 'search-plan', label: 'Search Plan' };
    
    const stagePayload = {
      ...payload,
      currentStage: stage,
      stageContext: {
        ...payload.searchContext,
        jdDiagnosis: prevArtifact?.content,
        currentStage: stage.label
      }
    };

    const stageResult = await callRemoteOpenAICompatible({
      payload: stagePayload,
      runtime: requestContext.runtime,
      requestContext,
      stage: stage
    });

    const artifact = artifactStore.materialize('search-plan-result', stageResult.reportMarkdown, {
      producedBy: 'execute-search-plan',
      metadata: {
        templateId: payload.templateId,
        sourceArtifactId: prevArtifact?.id,
        renderer: 'openai-compatible-chat-completions',
        remoteInfo: stageResult.remoteInfo
      }
    });

    return {
      artifactId: artifact.id,
      renderer: 'openai-compatible-chat-completions',
      templateId: payload.templateId,
      sourceArtifactId: prevArtifact?.id,
      remoteInfo: stageResult.remoteInfo
    };
  });

  await runStep('execute-sourcing-strategy', async () => {
    const prevArtifact = artifactStore.get('search-plan-result');
    const stage = { id: 'sourcing-strategy', label: 'Sourcing Strategy' };
    
    const stagePayload = {
      ...payload,
      currentStage: stage,
      stageContext: {
        ...payload.searchContext,
        jdDiagnosis: artifactStore.get('jd-diagnosis-result')?.content,
        searchPlan: prevArtifact?.content,
        currentStage: stage.label
      }
    };

    const stageResult = await callRemoteOpenAICompatible({
      payload: stagePayload,
      runtime: requestContext.runtime,
      requestContext,
      stage: stage
    });

    const artifact = artifactStore.materialize('sourcing-strategy-result', stageResult.reportMarkdown, {
      producedBy: 'execute-sourcing-strategy',
      metadata: {
        templateId: payload.templateId,
        sourceArtifactId: prevArtifact?.id,
        renderer: 'openai-compatible-chat-completions',
        remoteInfo: stageResult.remoteInfo
      }
    });

    return {
      artifactId: artifact.id,
      renderer: 'openai-compatible-chat-completions',
      templateId: payload.templateId,
      sourceArtifactId: prevArtifact?.id,
      remoteInfo: stageResult.remoteInfo
    };
  });

  const candidateOutput = await runStep('execute-candidate-assessment', async () => {
    const prevArtifact = artifactStore.get('sourcing-strategy-result');
    const stage = { id: 'candidate-assessment', label: 'Candidate Assessment' };
    
    // Check if we need to run candidate assessment in parallel for multiple candidates
    const candidates = payload.searchContext?.candidates || []; // Get candidates from searchContext for consistency with schema
    const rubrics = payload.searchContext?.rubrics || [];
    
    if (Array.isArray(candidates) && candidates.length > 0) {
      // Parallel execution for multiple candidates
      const maxConcurrency = payload.runtime?.maxConcurrency || 5; // Default to 5 concurrent calls
      const concurrencyLimit = Math.min(candidates.length, maxConcurrency); // Use configured or default limit
      const limiter = createConcurrencyLimiter(concurrencyLimit);
      
      // Run candidate assessments in parallel
      const promises = candidates.map(async (candidate, index) => {
        try {
          const stagePayload = {
            ...payload,
            currentStage: stage,
            candidateIndex: index, // Track which candidate this is
            candidateData: candidate, // Include candidate-specific data
            stageContext: {
              ...payload.searchContext,
              jdDiagnosis: artifactStore.get('jd-diagnosis-result')?.content,
              searchPlan: artifactStore.get('search-plan-result')?.content,
              sourcingStrategy: prevArtifact?.content,
              candidate: candidate,
              currentStage: stage.label
            }
          };

          const stageResult = await limiter(() => callRemoteOpenAICompatible({
            payload: stagePayload,
            runtime: {
              ...requestContext.runtime,
              jsonMode: true
            },
            requestContext,
            stage: stage
          }));

          const assessmentPayload = normalizeCandidateAssessmentOutput(
            stageResult.structuredOutput || { rawContent: stageResult.reportMarkdown },
            { candidate, rubrics, candidateIndex: index }
          );

          // Create a unique artifact for each candidate assessment
          const artifactId = `candidate-assessment-result-${index}`;
          const artifact = artifactStore.materialize(artifactId, assessmentPayload, {
            producedBy: 'execute-candidate-assessment',
            metadata: {
              templateId: payload.templateId,
              sourceArtifactId: prevArtifact?.id,
              renderer: 'openai-compatible-chat-completions',
              remoteInfo: stageResult.remoteInfo,
              candidateIndex: index,
              candidateName: candidate.name || `Candidate ${index + 1}`
            }
          });

          return {
            artifactId: artifact.id,
            renderer: 'openai-compatible-chat-completions',
            templateId: payload.templateId,
            sourceArtifactId: prevArtifact?.id,
            remoteInfo: stageResult.remoteInfo,
            candidateIndex: index,
            candidateName: assessmentPayload.candidateName,
            assessment: assessmentPayload,
            success: true
          };
        } catch (error) {
          // If one candidate assessment fails, log the error but don't crash others
          console.error(`Failed to assess candidate ${index}:`, error);
          
          // Create a failure artifact for this candidate
          const artifactId = `candidate-assessment-result-${index}`;
          const artifact = artifactStore.materialize(artifactId, `Candidate assessment failed: ${error.message}`, {
            producedBy: 'execute-candidate-assessment',
            metadata: {
              templateId: payload.templateId,
              sourceArtifactId: prevArtifact?.id,
              renderer: 'openai-compatible-chat-completions',
              error: error.message,
              candidateIndex: index,
              candidateName: candidate.name || `Candidate ${index + 1}`,
              success: false
            }
          });

          return {
            artifactId: artifact.id,
            renderer: 'openai-compatible-chat-completions',
            templateId: payload.templateId,
            sourceArtifactId: prevArtifact?.id,
            remoteInfo: null,
            candidateIndex: index,
            success: false,
            error: error.message
          };
        }
      });

      // Wait for all candidate assessments to complete (using Promise.allSettled to prevent one failure from crashing all)
      const results = await Promise.allSettled(promises);
      
      // Count successes and failures
      const successfulAssessments = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
      const failedAssessments = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;
      
      // Create a summary artifact containing all candidate assessments
      const allAssessments = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value)
        .filter(Boolean);
      const structuredAssessments = allAssessments
        .map((item) => item.assessment)
        .filter(Boolean);
        
      const summaryArtifact = artifactStore.materialize('candidate-assessment-result', {
        totalCandidates: candidates.length,
        successfulAssessments,
        failedAssessments,
        rubrics: normalizeAssessmentRubrics(rubrics),
        assessments: structuredAssessments,
        allAssessmentIds: Array.from({ length: candidates.length }, (_, i) => `candidate-assessment-result-${i}`),
        timestamp: new Date().toISOString()
      }, {
        producedBy: 'execute-candidate-assessment',
        metadata: {
          templateId: payload.templateId,
          sourceArtifactId: prevArtifact?.id,
          renderer: 'openai-compatible-chat-completions',
          totalCandidates: candidates.length,
          successfulCount: successfulAssessments,
          failedCount: failedAssessments
        }
      });

      return {
        artifactId: summaryArtifact.id,
        renderer: 'openai-compatible-chat-completions',
        templateId: payload.templateId,
        sourceArtifactId: prevArtifact?.id,
        totalCandidates: candidates.length,
        successfulAssessments,
        failedAssessments,
        candidateAssessment: {
          mode: 'batch',
          totalCandidates: candidates.length,
          successfulAssessments,
          failedAssessments,
          rubrics: normalizeAssessmentRubrics(rubrics),
          assessments: structuredAssessments
        }
      };
    } else {
      // Original single candidate assessment behavior
      const stagePayload = {
        ...payload,
        currentStage: stage,
        stageContext: {
          ...payload.searchContext,
          jdDiagnosis: artifactStore.get('jd-diagnosis-result')?.content,
          searchPlan: artifactStore.get('search-plan-result')?.content,
          sourcingStrategy: prevArtifact?.content,
          currentStage: stage.label
        }
      };

      const stageResult = await callRemoteOpenAICompatible({
        payload: stagePayload,
        runtime: {
          ...requestContext.runtime,
          jsonMode: true
        },
        requestContext,
        stage: stage
      });

      const assessmentPayload = normalizeCandidateAssessmentOutput(
        stageResult.structuredOutput || { rawContent: stageResult.reportMarkdown },
        {
          candidate: {
            name: payload.searchContext?.candidateName,
            highlights: payload.searchContext?.candidateHighlights,
            concerns: payload.searchContext?.candidateConcerns
          },
          rubrics,
          candidateIndex: 0
        }
      );

      const artifact = artifactStore.materialize('candidate-assessment-result', assessmentPayload, {
        producedBy: 'execute-candidate-assessment',
        metadata: {
          templateId: payload.templateId,
          sourceArtifactId: prevArtifact?.id,
          renderer: 'openai-compatible-chat-completions',
          remoteInfo: stageResult.remoteInfo
        }
      });

      return {
        artifactId: artifact.id,
        renderer: 'openai-compatible-chat-completions',
        templateId: payload.templateId,
        sourceArtifactId: prevArtifact?.id,
        remoteInfo: stageResult.remoteInfo,
        candidateAssessment: {
          mode: 'single',
          totalCandidates: 1,
          rubrics: normalizeAssessmentRubrics(rubrics),
          assessment: assessmentPayload
        }
      };
    }
  });

  const compileOutput = await runStep('compile-results', async () => {
    // Combine all stage results into a final report
    const jdDiagnosis = artifactStore.get('jd-diagnosis-result')?.content || '';
    const searchPlan = artifactStore.get('search-plan-result')?.content || '';
    const sourcingStrategy = artifactStore.get('sourcing-strategy-result')?.content || '';
    
    // Get the candidate assessment summary
    const candidateAssessmentSummary = artifactStore.get('candidate-assessment-result')?.content || '';
    
    // If there are multiple candidate assessments, get them individually
    let candidateAssessmentContent = '';
    if (typeof candidateAssessmentSummary === 'object' && candidateAssessmentSummary.totalCandidates > 0) {
      // This is a parallel assessment scenario - get individual assessments
      candidateAssessmentContent = `## Individual Candidate Assessments (${candidateAssessmentSummary.totalCandidates} total)\n\n`;
      
      for (let i = 0; i < candidateAssessmentSummary.totalCandidates; i++) {
        const artifactId = `candidate-assessment-result-${i}`;
        const individualAssessment = artifactStore.get(artifactId)?.content;
        
        if (individualAssessment) {
          candidateAssessmentContent += `${renderEvidenceBasedAssessmentMarkdown(individualAssessment, i)}\n\n`;
        }
      }
    } else {
      // Single assessment scenario
      candidateAssessmentContent = `## Candidate Assessment Framework\n\n${renderEvidenceBasedAssessmentMarkdown(candidateAssessmentSummary)}\n\n`;
    }

    const combinedReport = [
      `# ${payload.searchContext?.roleTitle || 'Talent Intelligence Report'}\n\n`,
      `## Job Description Diagnosis\n\n${jdDiagnosis}\n\n`,
      `## Search Plan\n\n${searchPlan}\n\n`,
      `## Sourcing Strategy\n\n${sourcingStrategy}\n\n`,
      candidateAssessmentContent
    ].join('');

    const artifact = artifactStore.materialize('report-markdown', combinedReport, {
      producedBy: 'compile-results',
      metadata: {
        templateId: payload.templateId,
        renderer: 'multi-stage-combination',
        stageCount: 4,
        sourceArtifacts: [
          'jd-diagnosis-result',
          'search-plan-result', 
          'sourcing-strategy-result',
          'candidate-assessment-result'
        ],
        hasParallelAssessments: typeof candidateAssessmentSummary === 'object' && candidateAssessmentSummary.totalCandidates > 0,
        totalCandidates: typeof candidateAssessmentSummary === 'object' ? candidateAssessmentSummary.totalCandidates : 0
      }
    });

    return {
      artifactId: artifact.id,
      renderer: 'multi-stage-combination',
      templateId: payload.templateId,
      stageCount: 4
    };
  });

  const finalizationOutput = await runStep('finalize-response', async () => {
    const reportArtifact = artifactStore.get('report-markdown');
    const runSummary = {
      runId: requestContext.runId,
      requestId: requestContext.requestId,
      templateId: payload.templateId,
      resolvedRunnerId: executionPlan.engine.runnerId,
      finalArtifactId: reportArtifact?.id,
      remoteAttempted: true,
      remoteSucceeded: true,
      multiStage: true
    };
    const artifact = artifactStore.materialize('run-summary', runSummary, {
      producedBy: 'finalize-response',
      metadata: {
        sourceArtifactId: reportArtifact?.id,
        multiStage: true
      }
    });
    return {
      artifactId: artifact.id,
      finalArtifactId: reportArtifact?.id
    };
  });

  const reportArtifact = artifactStore.get('report-markdown');
  const result = {
    renderer: 'multi-stage-combination',
    templateId: payload.templateId,
    artifactId: compileOutput.artifactId,
    finalArtifactId: finalizationOutput.finalArtifactId,
    finalizationArtifactId: finalizationOutput.artifactId,
    multiStage: true,
    stageResults: {
      jdDiagnosis: artifactStore.get('jd-diagnosis-result')?.content,
      searchPlan: artifactStore.get('search-plan-result')?.content,
      sourcingStrategy: artifactStore.get('sourcing-strategy-result')?.content,
      candidateAssessment: artifactStore.get('candidate-assessment-result')?.content
    },
    candidateAssessment: candidateOutput.candidateAssessment
  };

  return {
    reportMarkdown: reportArtifact?.content || '',
    execution: buildExecutionEnvelope({
      executionPlan,
      artifactStore,
      completedSteps,
      runnerId: 'openai-chat',
      result,
      extra: {
        remote: {
          attempted: true,
          succeeded: true,
          multiStage: true,
          stageCount: 4
        }
      }
    })
  };
}

export const executionRunners = {
  'local-template': executeLocalTemplateRunner,
  'openai-chat': executeRemoteRunner
};

export function getExecutionCatalog(runtime = {}) {
  const catalog = listRunnerCatalog(runtime);
  const defaultRunner = RUNNER_REGISTRY[DEFAULT_LOCAL_RUNNER_ID];

  return {
    boundary: LOCAL_ONLY_BOUNDARY,
    defaultRunnerId: defaultRunner.id,
    defaultPublicMode: defaultRunner.publicMode,
    supportedRequestModes: listAcceptedModes(),
    supportedRunnerIds: catalog.filter((item) => item.executable).map((item) => item.id),
    plannedRunnerIds: catalog.filter((item) => !item.executable).map((item) => item.id),
    runners: catalog
  };
}

export const resolveExecution = resolveExecutionTarget;
