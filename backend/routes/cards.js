import { Router } from 'express';
import { getCatalog, getPack, rarityRefund } from '../cards/catalog.js';
import { openPack, packOddsPercent } from '../cards/packs.js';
import { loadPlayer, savePlayer, ConflictError } from '../data/players.js';
import { MAX_PACKS_PER_PURCHASE } from '../data/cards.js';

const router = Router();

/* ---------- Player identity ---------- */

// Until there is auth, the client identifies itself with a generated id.
const PLAYER_ID = /^[A-Za-z0-9_-]{8,64}$/;

function requirePlayer(req, res, next) {
  const id = req.get('X-Player-Id');
  if (!id || !PLAYER_ID.test(id)) {
    return res.status(400).json({ error: 'Missing or invalid X-Player-Id header.' });
  }
  req.playerId = id;
  next();
}

/* ---------- Daily pack timing (UTC calendar day) ---------- */

const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);

function nextUtcMidnight(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
}

/* ---------- Shaping ---------- */

function publicPlayer(p) {
  const today = dayKey();
  return {
    playerId: p.playerId,
    credits: p.credits,
    packsOpened: p.packsOpened,
    daily: {
      available: p.lastDailyClaim !== today,
      nextAt: nextUtcMidnight().toISOString(),
    },
    cards: p.cards,
  };
}

function publicPack(pack) {
  return { ...pack, odds: packOddsPercent(pack) };
}

/** Add pulled cards to a player, returning the reveal entries. */
function grantCards(player, pulls, now) {
  return pulls.map((card) => {
    const owned = player.cards.find((c) => c.cardId === card.id);
    if (owned) {
      owned.count += 1;
      const refund = rarityRefund(card.rarity);
      player.credits += refund;
      return { cardId: card.id, rarity: card.rarity, isNew: false, refund };
    }
    player.cards.push({ cardId: card.id, count: 1, firstAt: now });
    return { cardId: card.id, rarity: card.rarity, isNew: true, refund: 0 };
  });
}

/* ---------- Routes ---------- */

// Everything a client needs to render cards and packs.
router.get('/catalog', (req, res) => {
  const { rarities, packs, slots, cards } = getCatalog();
  res.json({ rarities, slots, packs: packs.map(publicPack), cards });
});

router.get('/me', requirePlayer, async (req, res) => {
  try {
    res.json(publicPlayer(await loadPlayer(req.playerId)));
  } catch (err) {
    console.error('Failed to load player:', err);
    res.status(500).json({ error: 'Failed to load your collection.' });
  }
});

async function openPacks(req, res, pack, quantity, mutate) {
  try {
    const player = await loadPlayer(req.playerId);
    const expect = { credits: player.credits, lastDailyClaim: player.lastDailyClaim };

    const rejection = mutate(player);
    if (rejection) return res.status(rejection.status).json({ error: rejection.error });

    const now = new Date();
    const packs = Array.from({ length: quantity }, () => ({
      packId: pack.id,
      cards: grantCards(player, openPack(pack), now),
    }));
    player.packsOpened += quantity;

    await savePlayer(player, expect);
    res.json({ player: publicPlayer(player), packs });
  } catch (err) {
    if (err instanceof ConflictError) return res.status(409).json({ error: err.message });
    console.error('Failed to open pack:', err);
    res.status(500).json({ error: 'Failed to open pack.' });
  }
}

// Claim today's free pack.
router.post('/packs/daily', requirePlayer, (req, res) => {
  const pack = getPack('daily');
  const today = dayKey();
  return openPacks(req, res, pack, 1, (player) => {
    if (player.lastDailyClaim === today) {
      return { status: 409, error: 'You already opened today\'s free pack.' };
    }
    player.lastDailyClaim = today;
    return null;
  });
});

// Buy and open one or more paid packs with credits.
router.post('/packs/buy', requirePlayer, (req, res) => {
  const { packId, quantity: rawQty } = req.body ?? {};
  const pack = getPack(packId);
  if (!pack || pack.daily) {
    return res.status(400).json({ error: 'Unknown pack.' });
  }
  const quantity = Math.round(Number(rawQty ?? 1));
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_PACKS_PER_PURCHASE) {
    return res.status(400).json({ error: `Buy between 1 and ${MAX_PACKS_PER_PURCHASE} packs at a time.` });
  }
  const cost = pack.price * quantity;
  return openPacks(req, res, pack, quantity, (player) => {
    if (player.credits < cost) {
      return { status: 402, error: `Not enough credits. ${cost} needed, you have ${player.credits}.` };
    }
    player.credits -= cost;
    return null;
  });
});

export default router;
