import { Router } from 'express';
import { getCarById } from '../data/cars.js';
import { getTrackById } from '../data/tracks.js';
import { simulateRace } from '../sim/race.js';

const router = Router();

router.post('/simulate', (req, res) => {
  const { carIds, trackId, laps: rawLaps, seed: rawSeed } = req.body ?? {};

  if (!Array.isArray(carIds) || carIds.length < 2 || carIds.length > 8) {
    return res.status(400).json({ error: 'Pick between 2 and 8 cars.' });
  }
  if (new Set(carIds).size !== carIds.length) {
    return res.status(400).json({ error: 'Duplicate cars in the entry list.' });
  }
  const missing = carIds.filter((id) => !getCarById(id));
  if (missing.length) {
    return res.status(400).json({ error: `Unknown car(s): ${missing.join(', ')}` });
  }
  const track = getTrackById(trackId);
  if (!track) {
    return res.status(400).json({ error: `Unknown track: ${trackId}` });
  }
  const laps = Math.round(Number(rawLaps));
  if (!Number.isFinite(laps) || laps < 2 || laps > 25) {
    return res.status(400).json({ error: 'Laps must be between 2 and 25.' });
  }
  const seed = Number.isFinite(Number(rawSeed))
    ? Number(rawSeed) >>> 0
    : (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;

  try {
    const result = simulateRace({ track, carIds, laps, seed });
    res.json(result);
  } catch (err) {
    console.error('Simulation failed:', err);
    res.status(500).json({ error: 'Simulation failed.' });
  }
});

export default router;
