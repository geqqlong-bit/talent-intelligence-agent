import { createError, json, readJsonBody, withRequestMeta } from './schema.mjs';
import { createTiaServiceContainer } from '../../src/tia/service-container.mjs';
import { getLogHistory, publishLog } from '../../src/tia/log-bus.mjs';

let defaultServices;

function getServices(provided) {
  if (provided) return provided;
  if (!defaultServices) {
    defaultServices = createTiaServiceContainer();
  }
  return defaultServices;
}

function parseRequestUrl(req) {
  return new URL(req.url, 'http://127.0.0.1');
}

function respond(res, status, payload, requestId) {
  return json(
    res,
    status,
    withRequestMeta(payload, requestId, {
      timestamp: new Date().toISOString()
    }),
    requestId
  );
}

function normalizeError(error, requestId) {
  if (error?.ok === false && error.error) {
    return withRequestMeta(
      {
        ok: false,
        error: error.error
      },
      requestId,
      {
        status: error.status || 500,
        timestamp: new Date().toISOString()
      }
    );
  }

  return withRequestMeta(
    {
      ok: false,
      error: {
        code: 'TIA_INTERNAL_ERROR',
        message: error?.message || 'Unknown TIA error'
      }
    },
    requestId,
    {
      status: 500,
      timestamp: new Date().toISOString()
    }
  );
}

function isTiaPath(pathname) {
  return pathname === '/api/tia' || pathname.startsWith('/api/tia/');
}

function summarizeOverview(positions, candidates, funnel, alerts) {
  return {
    activePositionCount: positions.filter((position) => position.status === 'active').length,
    candidateCount: candidates.length,
    stageBreakdown: funnel,
    highUrgencyAlertCount: alerts.filter((alert) => alert.urgency === 'HIGH').length
  };
}

export async function routeTiaRequest(req, res, { requestId, services } = {}) {
  const url = parseRequestUrl(req);
  const pathname = url.pathname;

  if (!isTiaPath(pathname)) {
    return false;
  }

  const tiaServices = getServices(services);

  try {
    publishLog({
      type: 'tia.api.request',
      message: `${req.method} ${pathname}`,
      payload: Object.fromEntries(url.searchParams.entries())
    });

    if (req.method === 'GET' && (pathname === '/api/tia' || pathname === '/api/tia/health')) {
      const positions = await tiaServices.listPositions();
      const candidates = await tiaServices.listCandidates();
      const funnel = await tiaServices.getFunnel();
      const alertResult = await tiaServices.scanRisks();

      return respond(res, 200, {
        ok: true,
        service: 'tia',
        runtime: tiaServices.runtimeInfo?.() || {},
        overview: summarizeOverview(positions, candidates, funnel, alertResult.alerts || [])
      }, requestId);
    }

    if (req.method === 'GET' && pathname === '/api/tia/positions') {
      const items = await tiaServices.listPositions();
      return respond(res, 200, {
        ok: true,
        items,
        runtime: tiaServices.runtimeInfo?.() || {}
      }, requestId);
    }

    if (req.method === 'GET' && pathname === '/api/tia/workbench') {
      const positionId = url.searchParams.get('position_id') || undefined;
      const result = await tiaServices.getWorkbench({ position_id: positionId });
      return respond(res, 200, {
        ok: true,
        runtime: tiaServices.runtimeInfo?.() || {},
        result
      }, requestId);
    }

    if (req.method === 'GET' && pathname.match(/^\/api\/tia\/positions\/[^/]+\/context$/)) {
      const positionId = decodeURIComponent(pathname.split('/')[4]);
      const context = await tiaServices.getPositionContext({ position_id: positionId });
      return respond(res, 200, {
        ok: true,
        context
      }, requestId);
    }

    if (req.method === 'GET' && pathname === '/api/tia/candidates') {
      const positionId = url.searchParams.get('position_id') || undefined;
      const items = await tiaServices.listCandidates(positionId);
      return respond(res, 200, {
        ok: true,
        filters: { positionId },
        items
      }, requestId);
    }

    if (req.method === 'GET' && pathname === '/api/tia/clients') {
      const items = await tiaServices.listClients();
      return respond(res, 200, {
        ok: true,
        items
      }, requestId);
    }

    if (req.method === 'GET' && pathname === '/api/tia/funnel') {
      const positionId = url.searchParams.get('position_id') || undefined;
      const items = await tiaServices.getFunnel(positionId);
      return respond(res, 200, {
        ok: true,
        filters: { positionId },
        items
      }, requestId);
    }

    if (req.method === 'GET' && pathname === '/api/tia/alerts') {
      const positionId = url.searchParams.get('position_id') || undefined;
      const result = await tiaServices.scanRisks({ position_id: positionId });
      return respond(res, 200, {
        ok: true,
        ...result,
        filters: { positionId }
      }, requestId);
    }

    if (req.method === 'GET' && pathname === '/api/tia/touch-records') {
      const positionId = url.searchParams.get('position_id') || undefined;
      const candidateId = url.searchParams.get('candidate_id') || undefined;
      const limit = Number(url.searchParams.get('limit') || 20);
      const items = await tiaServices.listTouchRecords({
        positionId,
        candidateId,
        limit: Number.isFinite(limit) ? limit : 20
      });
      return respond(res, 200, {
        ok: true,
        items,
        filters: { positionId, candidateId }
      }, requestId);
    }

    if (req.method === 'GET' && pathname === '/api/tia/logs/history') {
      return respond(res, 200, {
        ok: true,
        logs: getLogHistory()
      }, requestId);
    }

    if (req.method === 'POST' && pathname === '/api/tia/assess') {
      const body = await readJsonBody(req);
      const result = await tiaServices.assessCandidate(body);
      return respond(res, 200, { ok: true, result }, requestId);
    }

    if (req.method === 'POST' && pathname === '/api/tia/cc') {
      const body = await readJsonBody(req);
      const result = await tiaServices.generateCc(body);
      return respond(res, 200, { ok: true, result }, requestId);
    }

    if (req.method === 'POST' && pathname === '/api/tia/report') {
      const body = await readJsonBody(req);
      const result = await tiaServices.generateReport(body);
      return respond(res, 200, { ok: true, result }, requestId);
    }

    if (req.method === 'POST' && pathname === '/api/tia/offer') {
      const body = await readJsonBody(req);
      const result = await tiaServices.analyzeOffer(body);
      return respond(res, 200, { ok: true, result }, requestId);
    }

    if (req.method === 'POST' && pathname === '/api/tia/copilot') {
      const body = await readJsonBody(req);
      const result = await tiaServices.runCopilot(body);
      return respond(res, 200, { ok: true, result }, requestId);
    }

    if (req.method === 'POST' && pathname === '/api/tia/stage') {
      const body = await readJsonBody(req);
      const result = await tiaServices.stageUpdate(body);
      return respond(res, 200, { ok: true, result }, requestId);
    }

    const notFound = createError('TIA_NOT_FOUND', `Unknown TIA endpoint: ${pathname}`, { method: req.method, pathname }, 404);
    return json(res, 404, normalizeError(notFound, requestId), requestId);
  } catch (error) {
    const normalized = normalizeError(error, requestId);
    return json(res, normalized.metadata.status || 500, normalized, requestId);
  }
}
