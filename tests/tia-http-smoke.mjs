import assert from 'node:assert/strict';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { createTalentIntelligenceServer } from '../server/index.mjs';
import { createTiaServiceContainer } from '../src/tia/service-container.mjs';
import { publishLog } from '../src/tia/log-bus.mjs';

async function startServer() {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'tia-smoke-'));
  const tiaServices = createTiaServiceContainer({
    config: {
      cwd,
      reportDir: 'reports'
    }
  });
  const server = createTalentIntelligenceServer({ tiaServices });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`
  };
}

async function closeServer(server) {
  server.destroyAllSockets?.();
  server.closeAllConnections?.();
  await new Promise((resolve) => server.close(() => resolve()));
}

async function readJson(response) {
  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    throw new Error(payload?.error?.message || `Request failed: ${response.status}`);
  }
  return payload;
}

async function runHttpChecks(baseUrl) {
  const positions = await readJson(await fetch(`${baseUrl}/api/tia/positions`));
  assert.equal(Array.isArray(positions.items), true);
  assert.equal(positions.items.length > 0, true);

  const positionId = positions.items[0].id;
  const workbench = await readJson(await fetch(`${baseUrl}/api/tia/workbench?position_id=${positionId}`));
  assert.equal(workbench.result.selectedPositionId, positionId);
  assert.equal(Array.isArray(workbench.result.kanban.columns), true);

  const context = await readJson(await fetch(`${baseUrl}/api/tia/positions/${positionId}/context`));
  assert.equal(context.context.position.id, positionId);

  const alerts = await readJson(await fetch(`${baseUrl}/api/tia/alerts?position_id=${positionId}`));
  assert.equal(Array.isArray(alerts.alerts), true);

  const assessment = await readJson(await fetch(`${baseUrl}/api/tia/assess`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      candidate_id: '33333333-3333-3333-3333-333333333331',
      position_id: positionId
    })
  }));
  assert.equal(typeof assessment.result.overallScore, 'number');

  const copilot = await readJson(await fetch(`${baseUrl}/api/tia/copilot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_type: 'market_map',
      position_id: positionId
    })
  }));
  assert.match(copilot.result.content, /市场测绘/);

  const dashboard = await (await fetch(`${baseUrl}/tia`)).text();
  assert.match(dashboard, /把猎头工作台做成可推进的操作系统/);
}

async function runWebSocketCheck(baseUrl) {
  if (typeof WebSocket !== 'function') {
    console.log('[skip] Global WebSocket is unavailable in this Node runtime.');
    return;
  }

  const wsUrl = baseUrl.replace(/^http/, 'ws') + '/api/tia/logs/stream';

  await new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    const messages = [];
    const timer = setTimeout(() => reject(new Error('Timed out waiting for websocket smoke events.')), 5000);

    socket.addEventListener('message', (event) => {
      const payload = JSON.parse(event.data);
      messages.push(payload);
      if (messages.some((message) => message.type === 'history') && messages.some((message) => message.type === 'log' && message.event?.type === 'tia.test.event')) {
        clearTimeout(timer);
        socket.addEventListener('close', () => resolve(), { once: true });
        socket.close();
      }
    });

    socket.addEventListener('open', () => {
      publishLog({
        type: 'tia.test.event',
        message: 'websocket smoke test'
      });
    });

    socket.addEventListener('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function main() {
  const { server, baseUrl } = await startServer();
  try {
    await runHttpChecks(baseUrl);
    await runWebSocketCheck(baseUrl);
    console.log('TIA HTTP smoke test passed.');
  } finally {
    await closeServer(server);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
