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
    capabilities: ['template-render'],
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
    resolutionSource: runnerMatch ? 'runner' : modeMatch ? 'mode' : 'default',
    strategy: runnerMatch ? 'requested-runner' : modeMatch ? 'requested-mode' : 'default-runner'
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
    fallbackReason: executionTarget.fallbackReason
  };
}

function toIso(valueMs) {
  return new Date(valueMs).toISOString();
}

function createStepSummary(step, startedAtMs, completedAtMs, output = undefined, status = 'completed') {
  return {
    id: step.id,
    kind: step.kind,
    runnerId: step.runnerId,
    status,
    startedAt: toIso(startedAtMs),
    completedAt: toIso(completedAtMs),
    durationMs: completedAtMs - startedAtMs,
    output
  };
}

export const executionRunners = {
  'local-template': async ({ payload, executionPlan, renderTemplate }) => {
    const step = executionPlan.steps[0] || {
      id: 'render-template',
      kind: 'template-render',
      runnerId: DEFAULT_LOCAL_RUNNER_ID
    };

    const startedAtMs = Date.now();
    const reportMarkdown = renderTemplate(payload);
    const completedAtMs = Date.now();
    const result = {
      renderer: 'renderTemplate',
      templateId: payload.templateId
    };

    return {
      reportMarkdown,
      execution: {
        status: 'completed',
        runnerId: DEFAULT_LOCAL_RUNNER_ID,
        boundary: LOCAL_ONLY_BOUNDARY,
        stepCount: 1,
        steps: [createStepSummary(step, startedAtMs, completedAtMs, result)],
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
