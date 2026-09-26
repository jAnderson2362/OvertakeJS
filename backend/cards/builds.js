// Custom builds: an owned car card plus at most one part card per slot.
//
// applyParts turns a build into a car record with the same shape as
// data/cars.js, so the race simulator can run it as-is (for PvP later). For
// now it drives the garage stats, including a lap time from the real lap
// solver on a reference circuit.

import { getCatalog } from './catalog.js';
import { PART_SLOTS } from '../data/cards.js';
import { getCarById, getTrackById } from '../data/store.js';
import { solveSpeedProfile, accelEnvelope } from '../sim/lapsim.js';

export const SLOTS = Object.keys(PART_SLOTS);
export const MAX_BUILDS = 12;
export const REFERENCE_TRACK_ID = 'valmont-gp';

const round = (x, dp) => Math.round(x * 10 ** dp) / 10 ** dp;

// Upgrade-only stats (see data/cards.js). 1 means stock.
const UPGRADE_DEFAULTS = { cornerGrip: 1, brake: 1, traction: 1, driveline: 1 };

/** Base car with each part's mods applied (set, mul, add, in slot order). */
export function applyParts(base, parts) {
  const car = { ...UPGRADE_DEFAULTS, ...base };
  for (const part of parts) {
    for (const { stat, mul, add, set } of part.mods) {
      if (set != null) car[stat] = set;
      if (mul != null) car[stat] *= mul;
      if (add != null) car[stat] += add;
    }
  }
  car.dragArea = Math.max(car.dragArea, 0.2);
  car.liftArea = Math.max(car.liftArea, 0);

  // hp tracks power. Top speed is drag limited (P = ½ρ·CdA·v³), so it moves
  // with the cube root of wheel power over drag area.
  const powerRatio = car.power / base.power;
  car.hp = base.hp * powerRatio;
  car.topSpeed = base.topSpeed
    * Math.cbrt((powerRatio * car.driveline * base.dragArea) / car.dragArea);
  return car;
}

/** Clean-lap time on the reference circuit, or null if it isn't loaded. */
function referenceLap(car) {
  const track = getTrackById(REFERENCE_TRACK_ID);
  if (!track) return null;
  return solveSpeedProfile(track.centerline, car, { mass: car.mass, grip: car.tireGrip }).lapTime;
}

const KMH_100 = 100 / 3.6;

/** Standing start to 100 km/h on a straight, in seconds. */
function zeroToHundred(car) {
  const dt = 0.005;
  let v = 0, t = 0;
  while (v < KMH_100 && t < 60) {
    v += Math.max(accelEnvelope(car, car.mass, car.tireGrip, v).accel, 0.01) * dt;
    t += dt;
  }
  return t;
}

/** Stopping distance from 100 km/h, in metres. */
function brakingDistance(car) {
  const dt = 0.001;
  let v = KMH_100, d = 0;
  while (v > 0) {
    v -= accelEnvelope(car, car.mass, car.tireGrip, v).brake * dt;
    d += Math.max(v, 0) * dt;
  }
  return d;
}

function summary(car) {
  const lap = referenceLap(car);
  return {
    hp: Math.round(car.hp),
    mass: Math.round(car.mass),
    hpPerTonne: Math.round((car.hp / car.mass) * 1000),
    tireGrip: round(car.tireGrip, 3),
    cornering: Math.round((car.cornerGrip ?? 1) * 100), // % of stock
    zeroToHundred: round(zeroToHundred(car), 2),
    braking: round(brakingDistance(car), 1),
    liftArea: round(car.liftArea, 2),
    dragArea: round(car.dragArea, 3),
    topSpeed: Math.round(car.topSpeed),
    drive: car.drive.toUpperCase(),
    lapTime: lap == null ? null : round(lap, 3),
  };
}

/**
 * A build's parts keyed by the current slots. Builds saved before the slot
 * rework used tires/engine/chassis/aero keys; each card moves to its own
 * slot now. Unknown or retired cards are dropped.
 */
export function normalizeParts(parts) {
  const { byId } = getCatalog();
  const out = Object.fromEntries(SLOTS.map((s) => [s, null]));
  for (const [key, id] of Object.entries(parts ?? {})) {
    if (!id) continue;
    const card = byId.get(id);
    if (card?.type !== 'part') continue;
    if (key === card.slot || !PART_SLOTS[key]) out[card.slot] = id;
  }
  return out;
}

/**
 * Look up a build's cards in the catalog. Returns { error } when the base
 * isn't a car card or a part is unknown or in the wrong slot.
 */
export function resolveBuild({ carCardId, parts }) {
  const { byId } = getCatalog();
  const carCard = byId.get(carCardId);
  const base = carCard?.type === 'car' ? getCarById(carCard.carId) : null;
  if (!base) return { error: 'Pick one of your car cards as the base.' };

  const partCards = {};
  for (const slot of SLOTS) {
    const id = parts?.[slot] ?? null;
    if (id === null) { partCards[slot] = null; continue; }
    const card = byId.get(id);
    if (card?.type !== 'part' || card.slot !== slot) {
      return { error: `That part doesn't fit the ${PART_SLOTS[slot].label.toLowerCase()} slot.` };
    }
    partCards[slot] = card;
  }
  return { carCard, base, partCards };
}

/** Stock and tuned stats for a resolved build. */
export function buildStats({ base, partCards }) {
  const tuned = applyParts(base, SLOTS.map((s) => partCards[s]).filter(Boolean));
  return { stock: summary(base), tuned: summary(tuned) };
}

/** How many times each card id appears across a list of builds. */
function cardUsage(builds) {
  const used = new Map();
  for (const b of builds) {
    for (const id of [b.carCardId, ...Object.values(b.parts)]) {
      if (id) used.set(id, (used.get(id) ?? 0) + 1);
    }
  }
  return used;
}

/**
 * One copy of a card sits in one build at a time. Checks `build` only uses
 * copies the player owns and hasn't already put in `otherBuilds`. Returns an
 * error message, or null when it's fine.
 */
export function checkCardCopies(player, otherBuilds, build) {
  const { byId } = getCatalog();
  const owned = new Map(player.cards.map((c) => [c.cardId, c.count]));
  const used = cardUsage(otherBuilds);
  for (const [id, need] of cardUsage([build])) {
    const have = owned.get(id) ?? 0;
    const name = byId.get(id)?.name ?? 'that card';
    if (have === 0) return `You don't own ${name}.`;
    if ((used.get(id) ?? 0) + need > have) {
      return `Every copy of ${name} you own is already in another build.`;
    }
  }
  return null;
}
