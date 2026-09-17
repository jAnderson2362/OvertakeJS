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
