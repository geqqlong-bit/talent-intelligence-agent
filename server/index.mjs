import http from 'http';
import { routeRequest } from './app/routes.mjs';

const port = Number(process.env.PORT || process.env.TALENT_INTEL_PORT || 8788);

const server = http.createServer(async (req, res) => {
  try {
    await routeRequest(req, res);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: { code: 'UNHANDLED_SERVER_ERROR', message: error.message } }, null, 2));
  }
});

server.listen(port, () => {
  console.log(`[talent-intelligence-service] listening on http://127.0.0.1:${port}`);
});
