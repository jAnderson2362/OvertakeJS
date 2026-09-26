// Player repository. Backed by MongoDB when connected, otherwise an in-memory
// map so packs still work without a database (collections just reset on
// restart).
//
// Writes are guarded on the credit balance the caller loaded, so two
// overlapping purchases can't both spend the same credits: the second one
// fails with ConflictError and the route asks the client to retry.

import Player from '../models/Player.js';
import { isDbReady } from './store.js';
import { STARTING_CREDITS } from './cards.js';

const memory = new Map();

export class ConflictError extends Error {
  constructor() {
    super('Your collection changed while this was in progress. Please try again.');
    this.name = 'ConflictError';
  }
}

function freshPlayer(playerId) {
  return {
    playerId,
    credits: STARTING_CREDITS,
    lastDailyClaim: null,
    packsOpened: 0,
    cards: [],
  };
}

function clone(p) {
  return { ...p, cards: p.cards.map((c) => ({ ...c })) };
}

/** Load a plain player object, creating one on first sight. */
export async function loadPlayer(playerId) {
  if (!isDbReady()) {
    if (!memory.has(playerId)) memory.set(playerId, freshPlayer(playerId));
    return clone(memory.get(playerId));
  }
  const { playerId: _id, ...defaults } = freshPlayer(playerId);
  const doc = await Player.findOneAndUpdate(
    { playerId },
    { $setOnInsert: defaults },
    { upsert: true, new: true, lean: true },
  );
  return {
    playerId: doc.playerId,
    credits: doc.credits,
    lastDailyClaim: doc.lastDailyClaim ?? null,
    packsOpened: doc.packsOpened ?? 0,
    cards: doc.cards.map(({ cardId, count, firstAt }) => ({ cardId, count, firstAt })),
  };
}

/**
 * Persist a mutated player. `expect` is the credits + lastDailyClaim the
 * caller loaded; if the stored values differ, nothing is written.
 */
export async function savePlayer(player, expect) {
  const guard = { credits: expect.credits, lastDailyClaim: expect.lastDailyClaim };
  const next = {
    credits: player.credits,
    lastDailyClaim: player.lastDailyClaim,
    packsOpened: player.packsOpened,
    cards: player.cards,
  };

  if (!isDbReady()) {
    const cur = memory.get(player.playerId);
    if (!cur || cur.credits !== guard.credits || cur.lastDailyClaim !== guard.lastDailyClaim) {
      throw new ConflictError();
    }
    memory.set(player.playerId, clone({ ...cur, ...next }));
    return;
  }

  const res = await Player.updateOne({ playerId: player.playerId, ...guard }, { $set: next });
  if (res.matchedCount === 0) throw new ConflictError();
}
