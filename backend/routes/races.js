import { Router } from 'express';
import { getCarById, getTrackById, isDbReady } from '../data/store.js';
import { simulateRace } from '../sim/race.js';
import Race from '../models/Race.js';

const router = Router();

// Recent race history (empty when running without a database).
router.get('/', async (req, res) => {
  if (!isDbReady()) return res.json([]);
  try {
    const races = await Race.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .select('seed trackId trackName laps carIds winner fastestLap createdAt')
      .lean();
    res.json(races);
  } catch (err) {
    console.error('Failed to list races:', err);
    res.status(500).json({ error: 'Failed to list races.' });
  }
});

// Full stored race (timeline included) for replaying a past simulation.
router.get('/:id', async (req, res) => {
  if (!isDbReady()) return res.status(404).json({ error: 'Race history requires a database.' });
  try {
    const race = await Race.findById(req.params.id).lean();
    if (!race) return res.status(404).json({ error: 'Race not found.' });
    res.json(race.payload);
  } catch {
    res.status(404).json({ error: 'Race not found.' });
  }
});

router.post('/simulate', async (req, res) => {
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

    // Persist after responding; a storage failure never breaks the sim.
    if (isDbReady()) {
      const winner = result.results[0];
      Race.create({
        seed,
        trackId,
        trackName: track.name,
        laps,
        carIds,
        winner: { carId: winner.carId, name: winner.name, totalTime: winner.totalTime },
        fastestLap: result.fastestLap,
        payload: result,
      }).catch((err) => console.error('Failed to store race:', err.message));
    }
  } catch (err) {
    console.error('Simulation failed:', err);
    res.status(500).json({ error: 'Simulation failed.' });
  }
});

export default router;
