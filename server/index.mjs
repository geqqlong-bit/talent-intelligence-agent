import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createError, createRequestId, json, withRequestMeta } from './app/schema.mjs';
import { routeRequest } from './app/routes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || process.env.TALENT_INTEL_PORT || 8788);

const server = http.createServer(async (req, res) => {
  const requestId = createRequestId(req?.headers?.['x-request-id']);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Request-Id'
    });
    return res.end();
  }

  // Serve simple web UI
  if (req.method === 'GET' && (req.url === '/' || req.url === '/ui')) {
    const htmlPath = path.join(__dirname, '../public/index.html');
    try {
      const html = fs.readFileSync(htmlPath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    } catch (e) {
      // Ignored
    }
  }

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
  console.log(`[talent-intelligence-service] Web UI available at http://127.0.0.1:${port}/ui`);
});
