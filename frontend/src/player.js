// Stand-in for user identity until auth exists: a random id generated once
// per browser and kept in localStorage. The backend keys collections on it.

const KEY = 'overtake.playerId';

function randomId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

let cached = null;

export function getPlayerId() {
  if (cached) return cached;
  try {
    cached = localStorage.getItem(KEY);
    if (!cached) {
      cached = randomId();
      localStorage.setItem(KEY, cached);
    }
  } catch {
    cached = cached ?? randomId(); // storage blocked: id lasts for this page load
  }
  return cached;
}
