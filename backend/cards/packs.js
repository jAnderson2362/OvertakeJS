// Pack opening: weighted rarity rolls with an optional floor guarantee, then
// a uniform pick within the rolled tier.

import { RARITIES } from '../data/cards.js';
import { getCatalog, rarityRank } from './catalog.js';

function weightedPick(weights, rand) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [id, w] of entries) {
    r -= w;
    if (r <= 0) return id;
  }
  return entries[entries.length - 1][0];
}

/** Odds restricted to tiers at or above `floor`. */
function oddsAtLeast(odds, floor) {
  const min = rarityRank(floor);
  return Object.fromEntries(
    Object.entries(odds).filter(([id]) => rarityRank(id) >= min),
  );
}

function rollRarities(pack, rand) {
  const rolled = Array.from({ length: pack.cards }, () => weightedPick(pack.odds, rand));
  if (pack.guarantee) {
    const min = rarityRank(pack.guarantee);
    if (!rolled.some((r) => rarityRank(r) >= min)) {
      rolled[rolled.length - 1] = weightedPick(oddsAtLeast(pack.odds, pack.guarantee), rand);
    }
  }
  return rolled;
}

/**
 * Open one pack. Returns the cards pulled, in reveal order (rarest last so
 * the reveal builds up). Each entry is a catalog card.
 */
export function openPack(pack, rand = Math.random) {
  const { byRarity } = getCatalog();
  const rarities = rollRarities(pack, rand);
  const pulls = rarities.map((rarity) => {
    // Fall back down the tiers if a tier somehow has no cards.
    let pool = byRarity[rarity];
    let rank = rarityRank(rarity);
    while ((!pool || pool.length === 0) && rank > 0) {
      rank -= 1;
      pool = byRarity[RARITIES[rank].id];
    }
    return pool[Math.floor(rand() * pool.length)];
  });
  return pulls.sort((a, b) => rarityRank(a.rarity) - rarityRank(b.rarity));
}

/** Percent odds per rarity for display, e.g. { common: 70, rare: 22, ... }. */
export function packOddsPercent(pack) {
  const total = Object.values(pack.odds).reduce((s, w) => s + w, 0);
  return Object.fromEntries(
    Object.entries(pack.odds).map(([id, w]) => [id, Math.round((w / total) * 1000) / 10]),
  );
}
