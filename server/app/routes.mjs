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

export async function routeRequest(req, res) {
  const requestId = getRequestId(req);

  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, withRequestMeta({
      ok: true,
      service: 'talent-intelligence-service',
      version: API_VERSION,
      status: 'healthy',
      execution: {
        mode: 'local-template',
        workflowId: 'talent-intelligence.local-template-render'
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
      responseShape: {
        ok: true,
        requestId: 'req_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        mode: 'template-renderer',
        templateId: 'sourcing_strategy_cn',
        run: {
          id: 'run_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          status: 'completed',
          templateId: 'sourcing_strategy_cn',
          mode: 'template-renderer'
        },
        engine: {
          kind: 'local-template-engine',
          version: API_VERSION,
          provider: 'local',
          adapter: 'template-renderer',
          executionMode: 'local-template',
          requestedMode: 'openai',
          requestedModel: 'bailian/qwen3.5-plus'
        },
        summary: { projectName: 'string', roleTitle: 'string', templateId: 'string' },
        reportMarkdown: 'string',
        metadata: {
          requestId: 'req_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          runId: 'run_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          apiVersion: API_VERSION,
          startedAt: 'ISO date',
          completedAt: 'ISO date',
          durationMs: 12,
          workflowId: 'talent-intelligence.local-template-render',
          workflowVersion: API_VERSION,
          executionMode: 'local-template',
          executionStatus: 'completed'
        },
        orchestration: {
          requestId: 'req_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          runId: 'run_xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
          workflow: {
            id: 'talent-intelligence.local-template-render',
            version: API_VERSION,
            executionMode: 'local-template',
            futureHook: 'workflowRunner.execute'
          },
          execution: {
            status: 'completed',
            stepCount: 1,
            renderer: 'renderTemplate'
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
    try {
      const raw = await readJsonBody(req);
      const payload = normalizeRequest(raw);
      const result = await runTalentIntelligence(payload, { requestId });
      return json(res, 200, result, requestId);
    } catch (error) {
      const normalized = normalizeError(error, requestId);
      return json(res, normalized.metadata.status || 500, normalized, requestId);
    }
  }

  const notFound = normalizeError(
    createError('NOT_FOUND', 'Endpoint not found.', { method: req.method, url: req.url }, 404),
    requestId
  );
  return json(res, 404, notFound, requestId);
}
