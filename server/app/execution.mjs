import { API_VERSION, createError } from './schema.mjs';
import { callRemoteOpenAICompatible, resolveRemoteOpenAIConfig } from './remote-openai.mjs';

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
    output
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

function buildExecutionEnvelope({ executionPlan, artifactStore, completedSteps, runnerId, result, extra = {} }) {
  const stages = executionPlan.stages.map((stage) => createStageSummary(stage, completedSteps));
  const artifacts = artifactStore.listSummaries();

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

  const remoteOutput = await runStep('render-template', async () => {
    const remoteResult = await callRemoteOpenAICompatible({
      payload,
      runtime: requestContext.runtime,
      requestContext
    });
    const briefArtifact = artifactStore.get('workflow-brief');
    const artifact = artifactStore.materialize('report-markdown', remoteResult.reportMarkdown, {
      producedBy: 'render-template',
      metadata: {
        templateId: payload.templateId,
        sourceArtifactId: briefArtifact?.id,
        lineCount: remoteResult.reportMarkdown.split('\n').length,
        renderer: 'openai-compatible-chat-completions',
        remoteInfo: remoteResult.remoteInfo
      }
    });
    return {
      artifactId: artifact.id,
      renderer: 'openai-compatible-chat-completions',
      templateId: payload.templateId,
      sourceArtifactId: briefArtifact?.id,
      remoteInfo: remoteResult.remoteInfo
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
      remoteSucceeded: true
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
    renderer: 'openai-compatible-chat-completions',
    templateId: payload.templateId,
    artifactId: remoteOutput.artifactId,
    finalArtifactId: finalizationOutput.finalArtifactId,
    finalizationArtifactId: finalizationOutput.artifactId,
    remoteInfo: remoteOutput.remoteInfo
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
          ...remoteOutput.remoteInfo
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
