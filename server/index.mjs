import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createError, createRequestId, json, withRequestMeta } from './app/schema.ts';
import { routeRequest } from './app/routes.ts';
import { handleTiaLogUpgrade, isTiaLogUpgradeRequest } from './app/tia-log-stream.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || process.env.TALENT_INTEL_PORT || 8788);

function serveHtml(res, filePath) {
  const html = fs.readFileSync(filePath, 'utf-8');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

export function createTalentIntelligenceServer(options = {}) {
  const sockets = new Set();
  const server = http.createServer(async (req, res) => {
    const requestId = createRequestId(req?.headers?.['x-request-id']);
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname;

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Request-Id'
      });
      return res.end();
    }

    if (req.method === 'GET' && (pathname === '/' || pathname === '/ui')) {
      const htmlPath = path.join(__dirname, '../public/index.html');
      try {
        return serveHtml(res, htmlPath);
      } catch {
        // ignored
      }
    }

    if (req.method === 'GET' && (pathname === '/tia' || pathname === '/tia-dashboard')) {
      const htmlPath = path.join(__dirname, '../public/tia-dashboard.html');
      try {
        return serveHtml(res, htmlPath);
      } catch {
        // ignored
      }
    }

    try {
      await routeRequest(req, res, { tiaServices: options.tiaServices });
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

  server.on('upgrade', (req, socket, head) => {
    if (isTiaLogUpgradeRequest(req)) {
      return handleTiaLogUpgrade(req, socket, head);
    }
    socket.destroy();
  });

  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  server.destroyAllSockets = () => {
    for (const socket of sockets) {
      socket.destroy();
    }
  };

  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = createTalentIntelligenceServer();
  server.listen(port, () => {
    console.log(`[talent-intelligence-service] listening on http://127.0.0.1:${port}`);
    console.log(`[talent-intelligence-service] Web UI available at http://127.0.0.1:${port}/ui`);
    console.log(`[talent-intelligence-service] TIA dashboard available at http://127.0.0.1:${port}/tia`);
  });
}
