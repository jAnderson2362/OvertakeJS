// Builds the full card catalog: one card per car in the store plus every
// part card. Built once on first use (the car store is ready before routes
// serve) and shared by the pack opener and the API.

import { getCars } from '../data/store.js';
import { RARITIES, CAR_RARITY, PART_SLOTS, PACKS, seedParts } from '../data/cards.js';

let catalog = null;

export const rarityRank = (id) => RARITIES.find((r) => r.id === id)?.rank ?? 0;
export const rarityRefund = (id) => RARITIES.find((r) => r.id === id)?.refund ?? 0;

/** Tier fallback for cars not listed in CAR_RARITY, by hp per tonne. */
function carRarity(car) {
  if (CAR_RARITY[car.id]) return CAR_RARITY[car.id];
  const hpPerTonne = (car.hp / car.mass) * 1000;
  if (hpPerTonne >= 440) return 'legendary';
  if (hpPerTonne >= 330) return 'epic';
  if (hpPerTonne >= 270) return 'rare';
  if (hpPerTonne >= 220) return 'uncommon';
  return 'common';
}

export function getCatalog() {
  if (catalog) return catalog;

  const carCards = getCars().map((c) => ({
    id: `car:${c.id}`,
    type: 'car',
    rarity: carRarity(c),
    name: c.name,
    carId: c.id,
    class: c.class,
    year: c.year,
    country: c.country,
    ev: !!c.ev,
    stats: {
      hp: c.hp,
      mass: c.mass,
      topSpeed: c.topSpeed,
      tireGrip: c.tireGrip,
      drive: c.drive.toUpperCase(),
    },
  }));

  const partCards = seedParts.map((p) => ({
    id: `part:${p.id}`,
    type: 'part',
    rarity: p.rarity,
    name: p.name,
    partId: p.id,
    slot: p.slot,
    slotLabel: PART_SLOTS[p.slot]?.label ?? p.slot,
    effect: p.effect,
    mods: p.mods,
  }));

  const cards = [...carCards, ...partCards];
  const byId = new Map(cards.map((c) => [c.id, c]));
  const byRarity = Object.fromEntries(RARITIES.map((r) => [r.id, cards.filter((c) => c.rarity === r.id)]));

  catalog = { rarities: RARITIES, packs: PACKS, slots: PART_SLOTS, cards, byId, byRarity };
  return catalog;
}

export const getPack = (id) => PACKS.find((p) => p.id === id);
