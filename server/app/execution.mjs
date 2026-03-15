import { API_VERSION } from './schema.mjs';

export const WORKFLOW_ID = 'talent-intelligence.local-template-render';
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
    available: true,
    capabilities: ['template-render', 'workflow-stage-handoff', 'artifact-tracking'],
    acceptsModes: ['local', 'template-renderer', 'openai', 'llm', 'remote'],
    acceptsRunners: ['template-renderer', 'local', 'builtin', 'default'],
    selectionReason: 'Local template runner is the executable backend bundled with this local-only service.'
  },
  'openai-chat': {
    id: 'openai-chat',
    label: 'OpenAI-Compatible Remote Runner',
    kind: 'remote-llm-runner',
    provider: 'openai-compatible',
    adapter: 'chat-completions',
    executionMode: 'remote-llm',
    publicMode: 'llm',
    workflowId: 'talent-intelligence.remote-llm-run',
    available: false,
    capabilities: ['llm-generate'],
    acceptsModes: ['openai', 'llm', 'remote'],
    acceptsRunners: ['openai', 'openai-chat', 'remote-llm'],
    selectionReason: 'Declared as a future backend only; this build stays local-only and will not call remote providers.'
  }
};

function normalizeText(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase();
}

function publicRunnerView(runner) {
  return {
    id: runner.id,
    label: runner.label,
    kind: runner.kind,
    provider: runner.provider,
    adapter: runner.adapter,
    executionMode: runner.executionMode,
    publicMode: runner.publicMode,
    available: runner.available,
    capabilities: [...runner.capabilities],
    workflowId: runner.workflowId,
    boundary: LOCAL_ONLY_BOUNDARY,
    selectionReason: runner.selectionReason
  };
}

export function listRunnerCatalog() {
  return Object.values(RUNNER_REGISTRY).map(publicRunnerView);
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

export function resolveExecutionTarget(runtime = {}) {
  const requestedMode = normalizeText(runtime.executionMode || runtime.mode || 'openai', 'openai');
  const requestedRunner = normalizeText(runtime.runner || runtime.runnerId);

  const runnerMatch = findRequestedRunner(runtime);
  const modeMatch = findModeCandidate(runtime);
  const preferred = runnerMatch || modeMatch || RUNNER_REGISTRY[DEFAULT_LOCAL_RUNNER_ID];
  const executable = preferred.available ? preferred : RUNNER_REGISTRY[DEFAULT_LOCAL_RUNNER_ID];
  const fallbackApplied = preferred.id !== executable.id;
  const resolutionSource = runnerMatch ? 'runner' : modeMatch ? 'mode' : 'default';
  const strategy = runnerMatch ? 'requested-runner' : modeMatch ? 'requested-mode' : 'default-runner';

  return {
    requestedMode,
    requestedRunner: requestedRunner || undefined,
    resolvedMode: executable.publicMode,
    resolvedRunnerId: executable.id,
    executionMode: executable.executionMode,
    workflowId: executable.workflowId,
    fallbackApplied,
    fallbackReason: fallbackApplied
      ? `Requested runner ${preferred.id} is not executable in this local-only build; using ${executable.id} instead.`
      : executable.selectionReason,
    resolutionSource,
    strategy,
    selectionStrategy: strategy
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

  return {
    kind: runner.kind,
    version,
    provider: runner.provider,
    adapter: runner.adapter,
    runnerId: runner.id,
    executionMode: runner.executionMode,
    requestedMode: executionTarget.requestedMode,
    requestedRunner: executionTarget.requestedRunner,
    requestedModel,
    resolvedMode: executionTarget.resolvedMode,
    implementationStatus: runner.available ? 'active' : 'planned',
    resolutionSource: executionTarget.resolutionSource,
    fallbackReason: executionTarget.fallbackReason,
    boundary: LOCAL_ONLY_BOUNDARY
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

export const executionRunners = {
  'local-template': async ({ payload, executionPlan, renderTemplate, requestContext }) => {
    const artifactStore = createArtifactRecorder(executionPlan.artifacts);
    const completedSteps = [];

    const runStep = (stepId, produceOutput) => {
      const step = executionPlan.steps.find((item) => item.id === stepId) || {
        id: stepId,
        stageId: 'adhoc',
        kind: 'task',
        runnerId: DEFAULT_LOCAL_RUNNER_ID,
        consumes: [],
        produces: []
      };
      const startedAtMs = Date.now();
      const output = produceOutput({ artifactStore, requestContext, payload });
      const completedAtMs = Date.now();
      const summary = createStepSummary(step, startedAtMs, completedAtMs, output);
      completedSteps.push(summary);
      return output;
    };

    runStep('capture-request', ({ artifactStore: store }) => {
      const artifact = store.materialize('normalized-request', payload, {
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

    runStep('build-brief', ({ artifactStore: store }) => {
      const requestArtifact = store.get('normalized-request');
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
      const artifact = store.materialize('workflow-brief', brief, {
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

    const renderOutput = runStep('render-template', ({ artifactStore: store }) => {
      const reportMarkdown = renderTemplate(payload);
      const briefArtifact = store.get('workflow-brief');
      const artifact = store.materialize('report-markdown', reportMarkdown, {
        producedBy: 'render-template',
        metadata: {
          templateId: payload.templateId,
          sourceArtifactId: briefArtifact?.id,
          lineCount: reportMarkdown.split('\n').length
        }
      });
      return {
        artifactId: artifact.id,
        renderer: 'renderTemplate',
        templateId: payload.templateId,
        sourceArtifactId: briefArtifact?.id
      };
    });

    const finalizationOutput = runStep('finalize-response', ({ artifactStore: store }) => {
      const reportArtifact = store.get('report-markdown');
      const runSummary = {
        runId: requestContext.runId,
        requestId: requestContext.requestId,
        templateId: payload.templateId,
        resolvedRunnerId: executionPlan.engine.runnerId,
        finalArtifactId: reportArtifact?.id
      };
      const artifact = store.materialize('run-summary', runSummary, {
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

    const stages = executionPlan.stages.map((stage) => createStageSummary(stage, completedSteps));
    const artifacts = artifactStore.listSummaries();
    const reportArtifact = artifactStore.get('report-markdown');
    const result = {
      renderer: 'renderTemplate',
      templateId: payload.templateId,
      artifactId: renderOutput.artifactId,
      finalizationArtifactId: finalizationOutput.artifactId
    };

    return {
      reportMarkdown: reportArtifact?.content || '',
      execution: {
        status: 'completed',
        runnerId: DEFAULT_LOCAL_RUNNER_ID,
        boundary: LOCAL_ONLY_BOUNDARY,
        stageCount: stages.length,
        stepCount: completedSteps.length,
        stages,
        steps: completedSteps,
        artifacts,
        finalArtifactId: reportArtifact?.id,
        result
      }
    };
  }
};

export function getExecutionCatalog() {
  const catalog = listRunnerCatalog();
  const defaultRunner = RUNNER_REGISTRY[DEFAULT_LOCAL_RUNNER_ID];

  return {
    boundary: LOCAL_ONLY_BOUNDARY,
    defaultRunnerId: defaultRunner.id,
    supportedRequestModes: [...defaultRunner.acceptsModes],
    supportedRunnerIds: catalog.filter((item) => item.available).map((item) => item.id),
    runners: catalog
  };
}

export const resolveExecution = resolveExecutionTarget;
