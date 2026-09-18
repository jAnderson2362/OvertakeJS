import { getPlayerId } from './player.js';

async function request(path, options) {
  const res = await fetch(path, options);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body.error) message = body.error;
    } catch { /* non-JSON error body */ }
    throw new Error(message);
  }
  return res.json();
}

export const fetchCars = () => request('/api/cars');
export const fetchTracks = () => request('/api/tracks');

export const simulateRace = (carIds, trackId, laps) =>
  request('/api/races/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ carIds, trackId, laps }),
  });

/* ---------- Cards and packs ---------- */

const asPlayer = () => ({ 'X-Player-Id': getPlayerId() });

export const fetchCardCatalog = () => request('/api/cards/catalog');

export const fetchMyCards = () => request('/api/cards/me', { headers: asPlayer() });

export const claimDailyPack = () =>
  request('/api/cards/packs/daily', { method: 'POST', headers: asPlayer() });

export const buyPacks = (packId, quantity) =>
  request('/api/cards/packs/buy', {
    method: 'POST',
    headers: { ...asPlayer(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ packId, quantity }),
  });
