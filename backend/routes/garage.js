import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../auth/session.js';
import { loadPlayer } from '../data/players.js';
import { getTrackById } from '../data/store.js';
import { listBuilds, createBuild, updateBuild, deleteBuild } from '../data/builds.js';
import {
  SLOTS, MAX_BUILDS, REFERENCE_TRACK_ID,
  resolveBuild, buildStats, checkCardCopies, normalizeParts,
} from '../cards/builds.js';

const router = Router();

// Previews run the lap solver on every part swap, so cap the rate per IP.
router.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many garage requests. Wait a moment and try again.' },
}));
router.use(requireAuth);

/* ---------- Shaping ---------- */

/** A stored build plus its stats (null if its cards left the catalog). */
function publicBuild(build) {
  const parts = normalizeParts(build.parts);
  const resolved = resolveBuild({ carCardId: build.carCardId, parts });
  return {
    id: build.id,
    name: build.name,
    carCardId: build.carCardId,
    parts,
    stats: resolved.error ? null : buildStats(resolved),
    updatedAt: build.updatedAt,
  };
}

/**
 * Validate the request body, keeping only filled, known slots. Card ids are
 * checked later against the catalog.
 */
function readBuild(body) {
  const { name, carCardId, parts } = body ?? {};
  const n = String(name ?? '').trim();
  if (n.length < 2 || n.length > 24) return { error: 'Build name must be 2 to 24 characters.' };
  if (typeof carCardId !== 'string') return { error: 'Pick one of your car cards as the base.' };

  const cleanParts = {};
  for (const slot of SLOTS) {
    const id = parts?.[slot] ?? null;
    if (id === null) continue;
    if (typeof id !== 'string') return { error: 'That part is not valid.' };
    cleanParts[slot] = id;
  }
  return { build: { name: n, carCardId, parts: cleanParts } };
}

/* ---------- Routes ---------- */

router.get('/', async (req, res) => {
  try {
    const builds = await listBuilds(req.auth.userId);
    const track = getTrackById(REFERENCE_TRACK_ID);
    res.json({
      builds: builds.map(publicBuild),
      maxBuilds: MAX_BUILDS,
      referenceTrack: track ? { id: track.id, name: track.name } : null,
    });
  } catch (err) {
    console.error('Failed to load garage:', err);
    res.status(500).json({ error: 'Failed to load your garage.' });
  }
});

// Stats for an unsaved build while the player swaps parts. Pure maths, so
// it doesn't check ownership; saving does.
router.post('/preview', (req, res) => {
  const { carCardId, parts } = req.body ?? {};
  const resolved = resolveBuild({ carCardId, parts });
  if (resolved.error) return res.status(400).json({ error: resolved.error });
  res.json(buildStats(resolved));
});

router.post('/', async (req, res) => {
  const input = readBuild(req.body);
  if (input.error) return res.status(400).json({ error: input.error });
  const resolved = resolveBuild(input.build);
  if (resolved.error) return res.status(400).json({ error: resolved.error });

  try {
    const userId = req.auth.userId;
    const [player, builds] = await Promise.all([loadPlayer(userId), listBuilds(userId)]);
    if (builds.length >= MAX_BUILDS) {
      return res.status(400).json({ error: `Your garage is full (${MAX_BUILDS} builds). Delete one to make room.` });
    }
    const copyError = checkCardCopies(player, builds, input.build);
    if (copyError) return res.status(400).json({ error: copyError });

    const build = await createBuild(userId, input.build);
    res.status(201).json(publicBuild(build));
  } catch (err) {
    console.error('Failed to create build:', err);
    res.status(500).json({ error: 'Failed to save the build.' });
  }
});

router.put('/:id', async (req, res) => {
  const input = readBuild(req.body);
  if (input.error) return res.status(400).json({ error: input.error });
  const resolved = resolveBuild(input.build);
  if (resolved.error) return res.status(400).json({ error: resolved.error });

  try {
    const userId = req.auth.userId;
    const [player, builds] = await Promise.all([loadPlayer(userId), listBuilds(userId)]);
    if (!builds.some((b) => b.id === req.params.id)) {
      return res.status(404).json({ error: 'Build not found.' });
    }
    const others = builds.filter((b) => b.id !== req.params.id);
    const copyError = checkCardCopies(player, others, input.build);
    if (copyError) return res.status(400).json({ error: copyError });

    const build = await updateBuild(userId, req.params.id, input.build);
    if (!build) return res.status(404).json({ error: 'Build not found.' });
    res.json(publicBuild(build));
  } catch (err) {
    console.error('Failed to update build:', err);
    res.status(500).json({ error: 'Failed to save the build.' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const removed = await deleteBuild(req.auth.userId, req.params.id);
    if (!removed) return res.status(404).json({ error: 'Build not found.' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to delete build:', err);
    res.status(500).json({ error: 'Failed to delete the build.' });
  }
});

export default router;
