import {
  API_VERSION,
  createError,
  createRequestId,
  json,
  normalizeRequest,
  readJsonBody,
  TEMPLATE_IDS,
  withRequestMeta
} from './schema.mjs';
import { DEFAULT_LOCAL_RUNNER_ID, WORKFLOW_ID, getExecutionCatalog, resolveExecutionTarget } from './execution.mjs';
import { persistRunArtifacts, persistRunFailure } from './persistence.mjs';
import { runTalentIntelligence } from './service.mjs';

function getRequestId(req) {
  return createRequestId(req.headers['x-request-id']);
}

function normalizeError(error, requestId) {
  const normalized = error?.ok === false
    ? error
    : createError('INTERNAL_ERROR', error?.message || 'Unknown error', undefined, 500);

  return withRequestMeta(
    {
      ok: false,
      error: normalized.error
    },
    requestId,
    {
      status: normalized.status || 500,
      timestamp: new Date().toISOString()
    }
  );
}

function buildExecutionContract() {
  const catalog = getExecutionCatalog();
  return {
    defaultRequestMode: 'openai',
    defaultRunnerId: DEFAULT_LOCAL_RUNNER_ID,
    supportedRequestModes: catalog.supportedRequestModes,
    supportedRunnerIds: catalog.supportedRunnerIds,
    runners: catalog.runners
  };
}

export async function routeRequest(req, res) {
  const requestId = getRequestId(req);
  const executionCatalog = buildExecutionContract();

  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, withRequestMeta({
      ok: true,
      service: 'talent-intelligence-service',
      version: API_VERSION,
      status: 'healthy',
      execution: {
        mode: DEFAULT_LOCAL_RUNNER_ID,
        workflowId: WORKFLOW_ID,
        ...executionCatalog
      }
    }, requestId, { timestamp: new Date().toISOString() }), requestId);
  }

  if (req.method === 'GET' && req.url === '/api/talent-intelligence/schema') {
    return json(res, 200, withRequestMeta({
      ok: true,
      service: 'talent-intelligence-service',
      version: API_VERSION,
      templates: TEMPLATE_IDS,
      endpoints: {
        run: 'POST /api/talent-intelligence/run',
        health: 'GET /health',
        schema: 'GET /api/talent-intelligence/schema'
      },
      execution: executionCatalog,
      responseShape: {
        ok: true,
        requestId: 'req_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        mode: 'template-renderer',
        templateId: 'sourcing_strategy_cn',
        run: {
          id: 'run_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          status: 'completed',
          templateId: 'sourcing_strategy_cn',
          mode: 'template-renderer',
          runnerId: 'local-template',
          stageCount: 4,
          stepCount: 4,
          artifactCount: 4,
          finalArtifactId: 'report-markdown'
        },
        engine: {
          kind: 'local-template-engine',
          version: API_VERSION,
          provider: 'local',
          adapter: 'template-renderer',
          runnerId: 'local-template',
          executionMode: 'local-template',
          requestedMode: 'openai',
          requestedRunner: 'openai-chat',
          resolvedMode: 'template-renderer',
          requestedModel: 'bailian/qwen3.5-plus',
          implementationStatus: 'active',
          resolutionSource: 'runner',
          fallbackReason: resolveExecutionTarget({ mode: 'openai', runner: 'openai-chat' }).fallbackReason
        },
        summary: { projectName: 'string', roleTitle: 'string', templateId: 'string' },
        reportMarkdown: 'string',
        artifacts: {
          rootDir: '/absolute/path/to/state/runs/YYYY/MM/DD/run_xxx',
          files: {
            request: '/absolute/path/to/request.json',
            response: '/absolute/path/to/response.json',
            reportMarkdown: '/absolute/path/to/report.md',
            events: '/absolute/path/to/events.log'
          }
        },
        metadata: {
          requestId: 'req_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          runId: 'run_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          apiVersion: API_VERSION,
          startedAt: 'ISO date',
          completedAt: 'ISO date',
          durationMs: 12,
          workflowId: WORKFLOW_ID,
          workflowVersion: API_VERSION,
          runnerId: 'local-template',
          executionMode: 'local-template',
          executionStatus: 'completed',
          requestedMode: 'openai',
          requestedRunner: 'openai-chat',
          resolvedMode: 'template-renderer',
          stageCount: 4,
          stepCount: 4,
          artifactCount: 4,
          finalArtifactId: 'report-markdown'
        },
        orchestration: {
          requestId: 'req_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          runId: 'run_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          workflow: {
            id: WORKFLOW_ID,
            version: API_VERSION,
            executionMode: 'local-template',
            runnerId: 'local-template',
            futureHook: 'workflowRunner.execute'
          },
          execution: {
            status: 'completed',
            runnerId: 'local-template',
            boundary: 'local-only',
            stageCount: 4,
            stepCount: 4,
            finalArtifactId: 'report-markdown',
            stages: [
              {
                id: 'ingest-request',
                label: 'Ingest Request',
                order: 1,
                status: 'completed',
                stepCount: 1,
                stepIds: ['capture-request'],
                consumes: [],
                produces: ['normalized-request']
              }
            ],
            steps: [
              {
                id: 'render-template',
                stageId: 'render-report',
                kind: 'template-render',
                runnerId: 'local-template',
                status: 'completed',
                consumes: ['workflow-brief'],
                produces: ['report-markdown'],
                output: {
                  artifactId: 'report-markdown',
                  renderer: 'renderTemplate',
                  templateId: 'sourcing_strategy_cn'
                }
              }
            ],
            artifacts: [
              {
                id: 'report-markdown',
                name: 'Rendered Report',
                kind: 'markdown',
                mimeType: 'text/markdown',
                stageId: 'render-report',
                producedBy: 'render-template',
                boundary: 'local-only',
                metadata: {
                  preview: '# 人才寻访策略报告｜VP Product...'
                }
              }
            ],
            result: {
              renderer: 'renderTemplate',
              templateId: 'sourcing_strategy_cn',
              artifactId: 'report-markdown'
            }
          },
          selection: {
            requestedMode: 'openai',
            requestedRunner: 'openai-chat',
            resolvedRunnerId: 'local-template',
            resolvedMode: 'template-renderer',
            resolutionSource: 'runner',
            fallbackApplied: true,
            fallbackReason: resolveExecutionTarget({ mode: 'openai', runner: 'openai-chat' }).fallbackReason
          }
        }
      },
      errorShape: {
        ok: false,
        requestId: 'req_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        error: {
          code: 'INVALID_TEMPLATE',
          message: 'Unsupported templateId: bad_template',
          details: {
            allowed: TEMPLATE_IDS
          }
        },
        metadata: {
          requestId: 'req_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          apiVersion: API_VERSION,
          status: 400,
          timestamp: 'ISO date'
        }
      }
    }, requestId, { timestamp: new Date().toISOString() }), requestId);
  }

  if (req.method === 'POST' && req.url === '/api/talent-intelligence/run') {
    let raw;

    try {
      raw = await readJsonBody(req);
      const payload = normalizeRequest(raw);
      const result = await runTalentIntelligence(payload, { requestId });
      const persisted = await persistRunArtifacts(result, payload);
      return json(res, 200, persisted, requestId);
    } catch (error) {
      const normalized = normalizeError(error, requestId);
      await persistRunFailure({
        requestId,
        requestPayload: raw,
        error: normalized.error,
        timestamp: normalized.metadata.timestamp
      });
      return json(res, normalized.metadata.status || 500, normalized, requestId);
    }
  }

  const notFound = normalizeError(
    createError('NOT_FOUND', 'Endpoint not found.', { method: req.method, url: req.url }, 404),
    requestId
  );
  return json(res, 404, notFound, requestId);
}
