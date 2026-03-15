import http from 'http';
import { createError, createRequestId, json, withRequestMeta } from './app/schema.mjs';
import { routeRequest } from './app/routes.mjs';

const port = Number(process.env.PORT || process.env.TALENT_INTEL_PORT || 8788);

const server = http.createServer(async (req, res) => {
  const requestId = createRequestId(req?.headers?.['x-request-id']);

  try {
    await routeRequest(req, res);
  } catch (error) {
    const payload = withRequestMeta(
      createError('UNHANDLED_SERVER_ERROR', error?.message || 'Unknown error', undefined, 500),
      requestId,
      {
        status: 500,
        timestamp: new Date().toISOString()
      }
    );
    json(res, 500, payload, requestId);
  }
});

server.listen(port, () => {
  console.log(`[talent-intelligence-service] listening on http://127.0.0.1:${port}`);
});
