// WebSocket transport for multiplayer rooms (logic lives in rooms.js).
//
// Clients connect to /api/multiplayer with their normal session cookie. The
// handshake is refused unless the cookie is a current session and the
// browser's Origin is the app's own (a cookie-authenticated socket would
// otherwise be open to any site the player visits). Messages are small JSON
// objects ({ type, ...fields }) and are rate limited per socket.

import { STATUS_CODES } from 'node:http';
import { WebSocketServer } from 'ws';
import { userIdFromToken, tokenFromCookieHeader } from '../auth/session.js';
import { findUserById } from '../data/users.js';
import { RoomManager } from './rooms.js';

const PATH = '/api/multiplayer';
const MAX_MESSAGE_BYTES = 4096;
const MAX_SOCKETS = 2000;
const MAX_SOCKETS_PER_USER = 5;
const RATE_PER_SECOND = 8;        // sustained messages per socket
const RATE_BURST = 20;
const MAX_DROPPED = 50;           // rate-limited messages before the socket is closed
const SESSION_RECHECK_MS = 60_000; // catch sessions revoked by signing out elsewhere
const HEARTBEAT_MS = 30_000;
const TICK_MS = 1000;
const LIST_DEBOUNCE_MS = 250;

/** Refuse an upgrade with a plain HTTP status. */
function reject(socket, status) {
  socket.end(`HTTP/1.1 ${status} ${STATUS_CODES[status]}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

/** Token bucket: true when this message may be handled. */
function takeToken(ws) {
  const now = Date.now();
  const b = ws.bucket;
  b.tokens = Math.min(RATE_BURST, b.tokens + ((now - b.at) / 1000) * RATE_PER_SECOND);
  b.at = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

/**
 * Attach the multiplayer socket server to an http.Server.
 * `allowedOrigin` is the frontend's origin (CLIENT_URL).
 */
export function attachMultiplayer(server, { allowedOrigin }) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
  const socketsByUser = new Map(); // userId -> Set<ws>
  const subscribers = new Set();   // sockets on the room browser

  const send = (ws, msg) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  };

  const emit = (userIds, msg) => {
    const data = JSON.stringify(msg);
    for (const id of userIds) {
      for (const ws of socketsByUser.get(id) ?? []) if (ws.readyState === ws.OPEN) ws.send(data);
    }
  };

  let listTimer = null;
  const scheduleListUpdate = () => {
    if (listTimer) return;
    listTimer = setTimeout(() => {
      listTimer = null;
      const data = JSON.stringify({ type: 'rooms', rooms: rooms.listPublic() });
      for (const ws of subscribers) if (ws.readyState === ws.OPEN) ws.send(data);
    }, LIST_DEBOUNCE_MS);
  };

  const rooms = new RoomManager({ emit, onListChange: scheduleListUpdate });

  server.on('upgrade', async (req, socket, head) => {
    socket.on('error', () => {}); // a client vanishing mid-handshake must not crash the server
    let pathname;
    try { pathname = new URL(req.url, 'http://localhost').pathname; } catch { return reject(socket, 400); }
    if (pathname !== PATH) return reject(socket, 404);

    const { origin } = req.headers;
    if (origin && origin !== allowedOrigin) return reject(socket, 403);
    if (wss.clients.size >= MAX_SOCKETS) return reject(socket, 503);

    const token = tokenFromCookieHeader(req.headers.cookie);
    let user;
    try {
      const userId = await userIdFromToken(token);
      user = userId ? await findUserById(userId) : null;
    } catch (err) {
      console.error('Multiplayer handshake failed:', err.message);
      return reject(socket, 500);
    }
    if (!user) return reject(socket, 401);
    if ((socketsByUser.get(user.id)?.size ?? 0) >= MAX_SOCKETS_PER_USER) return reject(socket, 429);

    wss.handleUpgrade(req, socket, head, (ws) => onConnection(ws, { id: user.id, name: user.name }, token));
  });

  function onConnection(ws, user, token) {
    Object.assign(ws, {
      user, token, alive: true, checkedAt: Date.now(), dropped: 0,
      bucket: { tokens: RATE_BURST, at: Date.now() },
    });
    let mine = socketsByUser.get(user.id);
    if (!mine) socketsByUser.set(user.id, (mine = new Set()));
    mine.add(ws);

    const { room, race } = rooms.connect(user);
    send(ws, { type: 'hello', user, room, serverNow: Date.now() });
    if (race) send(ws, race);

    ws.on('pong', () => { ws.alive = true; });
    ws.on('message', (data, isBinary) => {
      handle(ws, data, isBinary).catch((err) => {
        console.error('Multiplayer message failed:', err);
        send(ws, { type: 'error', message: 'Something went wrong. Try again.' });
      });
    });
    ws.on('close', () => {
      subscribers.delete(ws);
      mine.delete(ws);
      if (mine.size === 0) {
        socketsByUser.delete(user.id);
        rooms.disconnect(user.id);
      }
    });
    ws.on('error', () => {});
  }

  async function handle(ws, data, isBinary) {
    if (isBinary) return ws.close(1003, 'Text messages only');
    if (!takeToken(ws)) {
      if (++ws.dropped > MAX_DROPPED) return ws.close(1008, 'Too many messages');
      return send(ws, { type: 'error', message: 'Slow down a little.' });
    }

    let msg;
    try { msg = JSON.parse(data.toString('utf8')); } catch { msg = null; }
    if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') {
      return send(ws, { type: 'error', message: 'That message was not understood.' });
    }

    if (Date.now() - ws.checkedAt > SESSION_RECHECK_MS) {
      ws.checkedAt = Date.now();
      if ((await userIdFromToken(ws.token)) !== ws.user.id) return ws.close(4401, 'Signed out');
    }

    const userId = ws.user.id;
    let result;
    switch (msg.type) {
      case 'ping':
        return send(ws, { type: 'pong', t: Number.isFinite(msg.t) ? msg.t : null, serverNow: Date.now() });
      case 'rooms.subscribe':
        subscribers.add(ws);
        return send(ws, { type: 'rooms', rooms: rooms.listPublic() });
      case 'rooms.unsubscribe':
        subscribers.delete(ws);
        return;
      case 'room.create': result = rooms.create(ws.user, msg); break;
      case 'room.join': result = rooms.join(ws.user, msg.code); break;
      case 'room.leave': result = rooms.leave(userId); break;
      case 'room.car': result = await rooms.setCar(userId, msg.car); break;
      case 'room.ready': result = rooms.setReady(userId, msg.ready); break;
      case 'room.settings': result = rooms.updateSettings(userId, msg); break;
      case 'room.kick': result = rooms.kick(userId, msg.userId); break;
      case 'room.start': result = await rooms.start(userId); break;
      default:
        return send(ws, { type: 'error', message: 'That message was not understood.' });
    }
    if (result?.error) send(ws, { type: 'error', message: result.error, request: msg.type });
  }

  // Drop sockets that stopped answering pings (closed laptops, dead networks).
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.alive) { ws.terminate(); continue; }
      ws.alive = false;
      ws.ping();
    }
  }, HEARTBEAT_MS);
  const ticker = setInterval(() => rooms.tick(), TICK_MS);
  heartbeat.unref();
  ticker.unref();
  server.on('close', () => {
    clearInterval(heartbeat);
    clearInterval(ticker);
    clearTimeout(listTimer);
  });

  return { wss, rooms };
}
