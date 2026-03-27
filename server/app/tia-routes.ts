import { createError as _createError, json as _json, readJsonBody as _readJsonBody, withRequestMeta as _withRequestMeta } from './schema.js';
const createError = _createError as any;
const json = _json as any;
const readJsonBody = _readJsonBody as any;
const withRequestMeta = _withRequestMeta as any;
import { createTiaServiceContainer } from '../../src/tia/service-container.js';
import { getLogHistory, publishLog } from '../../src/tia/log-bus.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

let defaultServices: any;

function getServices(provided?: any) {
  if (provided) return provided;
  if (!defaultServices) {
    defaultServices = createTiaServiceContainer();
  }
  return defaultServices;
}

function parseRequestUrl(req: IncomingMessage) {
  return new URL(req.url || '', 'http://127.0.0.1');
}

function respond(res: ServerResponse, status: number, payload: any, requestId?: string) {
  return json(
    res,
    status,
    withRequestMeta(payload, requestId, {
      timestamp: new Date().toISOString()
    }),
    requestId
  );
}

function normalizeError(error: any, requestId?: string) {
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

function isTiaPath(pathname: string) {
  return pathname === '/api/tia' || pathname.startsWith('/api/tia/');
}

function summarizeOverview(positions: any[], candidates: any[], funnel: any[], alerts: any[]) {
  return {
    activePositionCount: positions.filter((position) => position.status === 'active').length,
    candidateCount: candidates.length,
    stageBreakdown: funnel,
    highUrgencyAlertCount: alerts.filter((alert) => alert.urgency === 'HIGH').length
  };
}

export async function routeTiaRequest(
  req: IncomingMessage,
  res: ServerResponse,
  { requestId, services }: { requestId?: string, services?: any } = {}
) {
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
        ...(result as any),
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
      const body: any = await readJsonBody(req);
      const result = await tiaServices.assessCandidate(body);
      return respond(res, 200, { ok: true, result }, requestId);
    }

    if (req.method === 'POST' && pathname === '/api/tia/cc') {
      const body: any = await readJsonBody(req);
      const result = await tiaServices.generateCc(body);
      return respond(res, 200, { ok: true, result }, requestId);
    }

    if (req.method === 'POST' && pathname === '/api/tia/report') {
      const body: any = await readJsonBody(req);
      const result = await tiaServices.generateReport(body);
      return respond(res, 200, { ok: true, result }, requestId);
    }

    if (req.method === 'POST' && pathname === '/api/tia/offer') {
      const body: any = await readJsonBody(req);
      const result = await tiaServices.analyzeOffer(body);
      return respond(res, 200, { ok: true, result }, requestId);
    }

    if (req.method === 'POST' && pathname === '/api/tia/copilot') {
      const body: any = await readJsonBody(req);
      const result = await tiaServices.runCopilot(body);
      return respond(res, 200, { ok: true, result }, requestId);
    }

    if (req.method === 'POST' && pathname === '/api/tia/stage') {
      const body: any = await readJsonBody(req);
      const result = await tiaServices.stageUpdate(body);
      return respond(res, 200, { ok: true, result }, requestId);
    }

    // ── Position Write Endpoints ──

    if (req.method === 'POST' && pathname === '/api/tia/positions') {
      const body: any = await readJsonBody(req);
      if (!body.job_title) return respond(res, 400, { ok: false, error: { code: 'MISSING_FIELD', message: 'job_title is required' } }, requestId);
      const result = await tiaServices.dbWrite({
        table: 'positions',
        operation: 'insert',
        data: {
          id: crypto.randomUUID(),
          job_title: body.job_title,
          client_name: body.client_name || body.client || '',
          industry: body.industry || '',
          salary_range: body.salary_range || body.salary || '',
          must_have_requirements: body.must_have_requirements || body.must_have || [],
          preferred_requirements: body.preferred_requirements || body.preferred || [],
          work_location: body.work_location || body.location || '',
          status: body.status || 'active',
          notes: body.notes || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      });
      return respond(res, 201, { ok: true, result }, requestId);
    }

    if (req.method === 'PUT' && pathname.match(/^\/api\/tia\/positions\/[^/]+$/)) {
      const positionId = decodeURIComponent(pathname.split('/')[4]);
      const body: any = await readJsonBody(req);
      const result = await tiaServices.dbWrite({
        table: 'positions',
        operation: 'update',
        data: { ...body, id: positionId, updated_at: new Date().toISOString() }
      });
      return respond(res, 200, { ok: true, result }, requestId);
    }

    if (req.method === 'DELETE' && pathname.match(/^\/api\/tia\/positions\/[^/]+$/)) {
      const positionId = decodeURIComponent(pathname.split('/')[4]);
      const result = await tiaServices.dbWrite({
        table: 'positions',
        operation: 'delete',
        data: { id: positionId }
      });
      return respond(res, 200, { ok: true, result }, requestId);
    }

    // ── Candidate Write Endpoints ──

    if (req.method === 'POST' && pathname === '/api/tia/candidates') {
      const body: any = await readJsonBody(req);
      if (!body.name) return respond(res, 400, { ok: false, error: { code: 'MISSING_FIELD', message: 'name is required' } }, requestId);
      const result = await tiaServices.dbWrite({
        table: 'candidates',
        operation: 'insert',
        data: {
          id: crypto.randomUUID(),
          position_id: body.position_id || null,
          name: body.name,
          mobile: body.mobile || null,
          email: body.email || null,
          current_company: body.current_company || body.company || '',
          current_title: body.current_title || body.title || '',
          years_experience: body.years_experience ?? null,
          resume_text: body.resume_text || body.summary || '',
          salary_current: body.salary_current ?? null,
          salary_expected: body.salary_expected ?? null,
          notes: body.notes || '',
          stage: body.stage || 'sourcing',
          stage_updated_at: new Date().toISOString(),
          ai_assessment: {},
          offer_risk: 'none',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      });
      return respond(res, 201, { ok: true, result }, requestId);
    }

    if (req.method === 'PUT' && pathname.match(/^\/api\/tia\/candidates\/[^/]+$/)) {
      const candidateId = decodeURIComponent(pathname.split('/')[4]);
      const body: any = await readJsonBody(req);
      const result = await tiaServices.dbWrite({
        table: 'candidates',
        operation: 'update',
        data: { ...body, id: candidateId, updated_at: new Date().toISOString() }
      });
      return respond(res, 200, { ok: true, result }, requestId);
    }

    if (req.method === 'DELETE' && pathname.match(/^\/api\/tia\/candidates\/[^/]+$/)) {
      const candidateId = decodeURIComponent(pathname.split('/')[4]);
      const result = await tiaServices.dbWrite({
        table: 'candidates',
        operation: 'delete',
        data: { id: candidateId }
      });
      return respond(res, 200, { ok: true, result }, requestId);
    }

    // ── Bulk CSV Import ──

    if (req.method === 'POST' && pathname === '/api/tia/import/positions') {
      const body: any = await readJsonBody(req);
      const rows = body.rows || [];
      if (!Array.isArray(rows) || rows.length === 0) {
        return respond(res, 400, { ok: false, error: { code: 'EMPTY_PAYLOAD', message: 'rows[] is required and must not be empty' } }, requestId);
      }
      const results = [];
      for (const row of rows) {
        try {
          if (!row.job_title) { results.push({ row, status: 'skipped', reason: 'missing job_title' }); continue; }
          await tiaServices.dbWrite({
            table: 'positions',
            operation: 'insert',
            data: {
              id: crypto.randomUUID(),
              job_title: row.job_title,
              client_name: row.client_name || row.client || '',
              industry: row.industry || '',
              salary_range: row.salary_range || row.salary || '',
              must_have_requirements: Array.isArray(row.must_have_requirements) ? row.must_have_requirements : (row.must_have ? [row.must_have] : []),
              work_location: row.work_location || row.location || '',
              status: row.status || 'active',
              notes: row.notes || '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          });
          results.push({ row: row.job_title, status: 'imported' });
        } catch (err: any) {
          results.push({ row: row.job_title, status: 'error', error: err.message });
        }
      }
      const imported = results.filter(r => r.status === 'imported').length;
      const skipped = results.filter(r => r.status === 'skipped').length;
      const errors = results.filter(r => r.status === 'error').length;
      return respond(res, 200, { ok: true, total: rows.length, imported, skipped, errors, results }, requestId);
    }

    if (req.method === 'POST' && pathname === '/api/tia/import/candidates') {
      const body: any = await readJsonBody(req);
      const rows = body.rows || [];
      if (!Array.isArray(rows) || rows.length === 0) {
        return respond(res, 400, { ok: false, error: { code: 'EMPTY_PAYLOAD', message: 'rows[] is required and must not be empty' } }, requestId);
      }
      const results = [];
      for (const row of rows) {
        try {
          if (!row.name) { results.push({ row, status: 'skipped', reason: 'missing name' }); continue; }
          await tiaServices.dbWrite({
            table: 'candidates',
            operation: 'insert',
            data: {
              id: crypto.randomUUID(),
              position_id: row.position_id || null,
              name: row.name,
              mobile: row.mobile || null,
              email: row.email || null,
              current_company: row.current_company || row.company || '',
              current_title: row.current_title || row.title || '',
              years_experience: row.years_experience != null ? Number(row.years_experience) : null,
              resume_text: row.resume_text || row.summary || '',
              salary_current: row.salary_current != null ? Number(row.salary_current) : null,
              salary_expected: row.salary_expected != null ? Number(row.salary_expected) : null,
              notes: row.notes || '',
              stage: row.stage || 'sourcing',
              stage_updated_at: new Date().toISOString(),
              ai_assessment: {},
              offer_risk: 'none',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          });
          results.push({ name: row.name, status: 'imported' });
        } catch (err: any) {
          results.push({ name: row.name, status: 'error', error: err.message });
        }
      }
      const imported = results.filter(r => r.status === 'imported').length;
      const skipped = results.filter(r => r.status === 'skipped').length;
      const errors = results.filter(r => r.status === 'error').length;
      return respond(res, 200, { ok: true, total: rows.length, imported, skipped, errors, results }, requestId);
    }

    const notFound: any = createError('TIA_NOT_FOUND', `Unknown TIA endpoint: ${pathname}`, { method: req.method, pathname }, 404);
    return json(res, 404, normalizeError(notFound, requestId), requestId);
  } catch (error: any) {
    const normalized = normalizeError(error, requestId);
    return json(res, normalized.metadata.status || 500, normalized, requestId);
  }
}
