import { createError, json, normalizeRequest, readJsonBody, TEMPLATE_IDS } from './schema.mjs';
import { runTalentIntelligence } from './service.mjs';

export async function routeRequest(req, res) {
  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, { ok: true, service: 'talent-intelligence-service', version: 'v0.1' });
  }

  if (req.method === 'GET' && req.url === '/api/talent-intelligence/schema') {
    return json(res, 200, {
      ok: true,
      templates: TEMPLATE_IDS,
      endpoints: {
        run: 'POST /api/talent-intelligence/run',
        health: 'GET /health'
      },
      responseShape: {
        ok: true,
        mode: 'template-renderer',
        templateId: 'sourcing_strategy_cn',
        summary: { projectName: 'string', roleTitle: 'string', templateId: 'string' },
        reportMarkdown: 'string',
        metadata: { startedAt: 'ISO date', completedAt: 'ISO date' }
      }
    });
  }

  if (req.method === 'POST' && req.url === '/api/talent-intelligence/run') {
    try {
      const raw = await readJsonBody(req);
      const payload = normalizeRequest(raw);
      const result = await runTalentIntelligence(payload);
      return json(res, 200, result);
    } catch (error) {
      const normalized = error?.ok === false ? error : createError('INTERNAL_ERROR', error.message || 'Unknown error', undefined, 500);
      return json(res, normalized.status || 500, normalized);
    }
  }

  return json(res, 404, createError('NOT_FOUND', 'Endpoint not found.', { method: req.method, url: req.url }, 404));
}
