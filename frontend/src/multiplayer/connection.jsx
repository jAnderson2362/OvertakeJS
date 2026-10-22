// Multiplayer connection: one WebSocket shared by the lobby and room pages.
//
// The server owns all room state and pushes it here; this provider keeps the
// latest copy, sends player actions, reconnects with backoff, and estimates
// the offset between this machine's clock and the server's so a race starts
// at the same moment for everyone.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { fetchMe } from '../api.js';

const MultiplayerContext = createContext(null);

const socketUrl = () => `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/api/multiplayer`;
const RETRY_MS = [1000, 2000, 4000, 8000, 10000];
const CLOCK_PINGS = 4;

// What the server tells a player who is removed from a room.
const REMOVED_REASON = {
  kicked: 'The host removed you from the room.',
};

export function MultiplayerProvider({ children }) {
  // 'connecting' | 'open' | 'reconnecting' | 'signedout'
  const [status, setStatus] = useState('connecting');
  const [me, setMe] = useState(null);
  const [room, setRoom] = useState(null);
  const [rooms, setRooms] = useState(null);
  const [race, setRace] = useState(null);
  const [notice, setNotice] = useState(null); // { id, message }
  const [clockOffset, setClockOffset] = useState(0); // server ms minus local ms

  const wsRef = useRef(null);
  const subscribedRef = useRef(false);
  const bestRttRef = useRef(Infinity);

  // `request` is the action a server error answers (e.g. 'room.join').
  const say = useCallback((message, request = null) => setNotice({ id: Date.now() + Math.random(), message, request }), []);

  useEffect(() => {
    let closedByUs = false;
    let attempt = 0;
    let retryTimer = null;
    const pingTimers = [];

    const connect = () => {
      const ws = new WebSocket(socketUrl());
      wsRef.current = ws;
      let opened = false;

      ws.onopen = () => {
        opened = true;
        attempt = 0;
        setStatus('open');
        bestRttRef.current = Infinity;
        for (let i = 0; i < CLOCK_PINGS; i++) {
          pingTimers.push(setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping', t: Date.now() }));
          }, i * 400));
        }
        if (subscribedRef.current) ws.send(JSON.stringify({ type: 'rooms.subscribe' }));
      };

      ws.onmessage = (event) => {
        let msg;
        try { msg = JSON.parse(event.data); } catch { return; }
        switch (msg.type) {
          case 'hello':
            setMe(msg.user);
            setRoom(msg.room);
            setClockOffset((o) => (bestRttRef.current === Infinity ? msg.serverNow - Date.now() : o));
            break;
          case 'pong': {
            // Keep the estimate from the quickest round trip: least queueing noise.
            const rtt = Date.now() - msg.t;
            if (Number.isFinite(rtt) && rtt < bestRttRef.current) {
              bestRttRef.current = rtt;
              setClockOffset(msg.serverNow + rtt / 2 - Date.now());
            }
            break;
          }
          case 'room':
            setRoom(msg.room);
            if (!msg.room && REMOVED_REASON[msg.reason]) say(REMOVED_REASON[msg.reason]);
            break;
          case 'rooms':
            setRooms(msg.rooms);
            break;
          case 'race':
            setRace({ code: msg.code, race: msg.race, startAt: msg.startAt, speed: msg.speed, entryByUser: msg.entryByUser });
            break;
          case 'error':
            say(msg.message, msg.request ?? null);
            break;
          default:
        }
      };

      ws.onclose = async (event) => {
        if (closedByUs) return;
        // Signed out (here or on another device): stop instead of retrying forever.
        if (event.code === 4401) { setStatus('signedout'); return; }
        if (!opened) {
          const signedIn = await fetchMe().then((r) => !!r.user).catch(() => true);
          if (closedByUs) return;
          if (!signedIn) { setStatus('signedout'); return; }
        }
        setStatus('reconnecting');
        retryTimer = setTimeout(connect, RETRY_MS[Math.min(attempt++, RETRY_MS.length - 1)]);
      };
    };

    connect();
    return () => {
      closedByUs = true;
      clearTimeout(retryTimer);
      pingTimers.forEach(clearTimeout);
      wsRef.current?.close(1000, 'Leaving multiplayer');
    };
  }, [say]);

  const send = useCallback((type, fields = {}) => {
    const ws = wsRef.current;
    if (ws?.readyState !== WebSocket.OPEN) {
      say('Not connected. Reconnecting...');
      return false;
    }
    ws.send(JSON.stringify({ type, ...fields }));
    return true;
  }, [say]);

  const subscribeRooms = useCallback((on) => {
    subscribedRef.current = on;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: on ? 'rooms.subscribe' : 'rooms.unsubscribe' }));
    }
  }, []);

  const value = useMemo(() => ({
    status, me, room, rooms, race, notice, clockOffset,
    send, subscribeRooms,
    dismissRace: () => setRace(null),
    clearNotice: () => setNotice(null),
  }), [status, me, room, rooms, race, notice, clockOffset, send, subscribeRooms]);

  return <MultiplayerContext.Provider value={value}>{children}</MultiplayerContext.Provider>;
}

export function useMultiplayer() {
  const ctx = useContext(MultiplayerContext);
  if (!ctx) throw new Error('useMultiplayer must be used inside MultiplayerProvider');
  return ctx;
}
