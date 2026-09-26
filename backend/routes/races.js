import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getCarById, getTrackById, isDbReady } from '../data/store.js';
import { simulateRace } from '../sim/race.js';
import Race from '../models/Race.js';
import { listBuilds } from '../data/builds.js';
import { BUILD_PREFIX, raceCarFromBuild } from '../cards/builds.js';

const router = Router();

// Each simulation is CPU work plus a stored race, and needs no sign-in.
const simulateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many races at once. Wait a moment and try again.' },
});

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

router.post('/simulate', simulateLimiter, async (req, res) => {
  const { carIds, trackId, laps: rawLaps, seed: rawSeed } = req.body ?? {};

  if (!Array.isArray(carIds) || carIds.length < 2 || carIds.length > 8) {
    return res.status(400).json({ error: 'Pick between 2 and 8 cars.' });
  }
  if (carIds.some((id) => typeof id !== 'string')) {
    return res.status(400).json({ error: 'Invalid car in the entry list.' });
  }
  if (new Set(carIds).size !== carIds.length) {
    return res.status(400).json({ error: 'Duplicate cars in the entry list.' });
  }

  // Custom builds ('build:<id>') race as their tuned car. Only the signed-in
  // player's own builds are allowed.
  const buildIds = carIds.filter((id) => id.startsWith(BUILD_PREFIX));
  const buildCars = {};
  if (buildIds.length) {
    if (!req.auth) return res.status(401).json({ error: 'Sign in to race your custom builds.' });
    try {
      const mine = new Map((await listBuilds(req.auth.userId)).map((b) => [`${BUILD_PREFIX}${b.id}`, b]));
      for (const id of buildIds) {
        const car = mine.has(id) ? raceCarFromBuild(mine.get(id)) : null;
        if (!car) return res.status(400).json({ error: 'One of those builds no longer exists. Pick your cars again.' });
        buildCars[id] = car;
      }
    } catch (err) {
      console.error('Failed to load builds for race:', err);
      return res.status(500).json({ error: 'Could not load your builds.' });
    }
  }

  const missing = carIds.filter((id) => !buildCars[id] && !getCarById(id));
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
    const result = simulateRace({ track, carIds, laps, seed, cars: buildCars });
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
