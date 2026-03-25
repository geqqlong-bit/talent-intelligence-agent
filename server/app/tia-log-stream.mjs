import crypto from 'crypto';
import { getLogHistory, publishLog, subscribeLogs } from '../../src/tia/log-bus.mjs';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const LOG_STREAM_PATH = '/api/tia/logs/stream';

function encodeFrame(payload) {
  const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const data = Buffer.from(message);
  const length = data.length;

  if (length < 126) {
    return Buffer.concat([Buffer.from([0x81, length]), data]);
  }

  if (length < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
    return Buffer.concat([header, data]);
  }

  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(length), 2);
  return Buffer.concat([header, data]);
}

function sendFrame(socket, payload) {
  if (!socket.destroyed && socket.writable) {
    socket.write(encodeFrame(payload));
  }
}

function sendControlFrame(socket, opcode) {
  if (!socket.destroyed && socket.writable) {
    socket.write(Buffer.from([0x80 | opcode, 0x00]));
  }
}

function computeAcceptValue(key) {
  return crypto.createHash('sha1').update(`${key}${WS_GUID}`).digest('base64');
}

export function isTiaLogUpgradeRequest(req) {
  const url = new URL(req.url, 'http://127.0.0.1');
  return url.pathname === LOG_STREAM_PATH && String(req.headers.upgrade || '').toLowerCase() === 'websocket';
}

export function handleTiaLogUpgrade(req, socket, head = Buffer.alloc(0)) {
  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    socket.destroy();
    return;
  }

  const acceptValue = computeAcceptValue(String(key));
  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptValue}`,
    '\r\n'
  ].join('\r\n'));

  const unsubscribe = subscribeLogs((event) => {
    sendFrame(socket, { type: 'log', event });
  });

  const cleanup = () => {
    unsubscribe();
  };

  socket.on('close', cleanup);
  socket.on('end', cleanup);
  socket.on('error', cleanup);
  socket.on('data', (chunk) => {
    const opcode = chunk?.[0] & 0x0f;
    if (opcode === 0x8) {
      sendControlFrame(socket, 0x8);
      cleanup();
      socket.end();
      return;
    }
    if (opcode === 0x9) {
      sendControlFrame(socket, 0xA);
    }
  });

  if (head?.length) {
    socket.emit('data', head);
  }

  sendFrame(socket, { type: 'history', events: getLogHistory() });
  publishLog({
    type: 'tia.ws.connected',
    message: 'TIA dashboard log stream connected',
    payload: { remoteAddress: socket.remoteAddress || 'unknown' }
  });
}
