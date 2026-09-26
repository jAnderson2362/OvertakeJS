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

/* ---------- Auth ---------- */

// The session lives in an httpOnly cookie, sent automatically on same-origin
// requests.
const postJson = (path, body) =>
  request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export const fetchMe = () => request('/api/auth/me');
export const register = (email, password, name) => postJson('/api/auth/register', { email, password, name });
export const login = (email, password) => postJson('/api/auth/login', { email, password });
export const logout = () => request('/api/auth/logout', { method: 'POST' });

/* ---------- Cards and packs ---------- */

export const fetchCardCatalog = () => request('/api/cards/catalog');
export const fetchMyCards = () => request('/api/cards/me');
export const claimDailyPack = () => request('/api/cards/packs/daily', { method: 'POST' });
export const buyPacks = (packId, quantity) => postJson('/api/cards/packs/buy', { packId, quantity });
