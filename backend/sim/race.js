// Full race simulation.
//
// Pipeline:
//   1. Qualifying — solve each car's clean lap (fresh tires, light fuel) to
//      set the grid.
//   2. Per-lap speed profiles — the lap solver is re-run for every (car, lap)
//      with that lap's fuel mass and degraded tire grip, so the pace evolution
//      over a stint is physically derived, not a fudge factor.
//   3. Time-domain race integration at 50 ms steps — standing start, cars
//      chase their target profile through an accel/brake envelope, with
//      slipstream, dirty air, blocking, and a zone-based overtaking model.
//
// The output timeline (distance-along-track per car at 250 ms cadence) is
// what the frontend replays.

import { solveSpeedProfile, accelEnvelope } from './lapsim.js';
import { getCarById } from '../data/store.js';

const SIM_DT = 0.05;      // physics step, s
const RECORD_DT = 0.25;   // timeline sample cadence, s
const GRID_SPACING = 8;   // meters between grid slots
const MIN_GAP = 4.5;      // minimum car-to-car spacing, m

const COLORS = [
  '#ef4444', '#3b82f6', '#22c55e', '#eab308',
  '#a855f7', '#f97316', '#06b6d4', '#ec4899',
];

/** Deterministic PRNG (mulberry32) so a race can be reproduced from its seed. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller standard normal from a uniform PRNG. */
function gaussian(rand) {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function abbreviate(name) {
  const words = name.replace(/\(.*\)/, '').trim().split(/\s+/);
  return (words.length >= 2 ? words[0][0] + words[1].slice(0, 2) : words[0].slice(0, 3)).toUpperCase();
}

/** Tire degradation per lap: harder on grip the more power-dense the car. */
function degPerLap(car) {
  return 0.0015 + 0.006 * (car.power / car.mass);
}

function interpProfile(v, ds, sMod) {
  const n = v.length;
  const f = sMod / ds;
  const i = Math.floor(f) % n;
  const w = f - Math.floor(f);
  return v[i] * (1 - w) + v[(i + 1) % n] * w;
}

export function simulateRace({ track, carIds, laps, seed }) {
  const rand = mulberry32(seed);
  const { centerline, overtakeZones } = track;
  const L = centerline.length;
  const ds = centerline.spacing;
  const nSamples = centerline.curvature.length;
  const trackKm = L / 1000;

  const inZone = new Uint8Array(nSamples);
  for (const z of overtakeZones) {
    for (let i = z.start; ; i = (i + 1) % nSamples) {
      inZone[i] = 1;
      if (i === z.end) break;
    }
  }

  // --- 1. Qualifying -------------------------------------------------------
  const entries = carIds.map((carId, idx) => {
    const car = getCarById(carId);
    const quali = solveSpeedProfile(centerline, car, {
      mass: car.mass + car.fuelPerKm * trackKm * 2,
      grip: car.tireGrip,
    });
    return {
      car,
      carId,
      color: COLORS[idx % COLORS.length],
      abbr: abbreviate(car.name),
      qualiTime: quali.lapTime,
      aggression: 0.3 + rand() * 0.6,
    };
  });
  entries.sort((a, b) => a.qualiTime - b.qualiTime);
  entries.forEach((e, i) => { e.grid = i + 1; });

  // --- 2. Per-lap speed profiles ------------------------------------------
  for (const e of entries) {
    const { car } = e;
    const deg = degPerLap(car);
    e.profiles = [];
    e.noise = [];
    e.conds = [];
    for (let lap = 1; lap <= laps; lap++) {
      const fuelRemaining = car.fuelPerKm * trackKm * (laps - lap + 1);
      const grip = car.tireGrip * (1 - deg * (lap - 1));
      const cond = { mass: car.mass + fuelRemaining, grip };
      e.profiles.push(solveSpeedProfile(centerline, car, cond));
      e.noise.push(1 / (1 + gaussian(rand) * car.consistency));
      e.conds.push(cond);
    }
  }

  // --- 3. Race integration -------------------------------------------------
  const state = entries.map((e) => ({
    e,
    s: -GRID_SPACING * e.grid,   // grid slot behind the line
    v: 0,
    lapsDone: 0,
    lastCrossT: 0,
    lapTimes: [],
    finished: false,
    finishTime: null,
    maxV: 0,
    overtakeUntil: -1,           // boost window end time
    lastZoneTried: -1,           // zone start index of last attempt
  }));

  const events = [];
  const samples = {};
  for (const st of state) samples[st.e.carId] = [];

  const slowest = Math.max(...entries.map((e) => e.qualiTime));
  const hardCap = laps * slowest * 1.6 + 90;
  let fastestLap = { time: Infinity, carId: null };
  let prevOrder = state.map((st) => st.e.carId);

  let t = 0;
  let nextRecord = 0;
  events.push({ t: 0, type: 'start', text: 'Lights out — race start!' });

  while (t < hardCap && state.some((st) => !st.finished)) {
    // Physical order by total distance (leader first) for proximity queries.
    const byDist = [...state].sort((a, b) => b.s - a.s);

    for (let bi = 0; bi < byDist.length; bi++) {
      const st = byDist[bi];
      const { e } = st;
      const lapIdx = Math.min(Math.max(st.lapsDone, 0), laps - 1);
      const profile = e.profiles[lapIdx];
      const sMod = ((st.s % L) + L) % L;
      const sampleIdx = Math.floor(sMod / ds) % nSamples;
      const kappa = Math.abs(centerline.curvature[sampleIdx]);

      let target = interpProfile(profile.v, ds, sMod) * e.noise[lapIdx];
      if (st.finished) target *= 0.5; // cool-down lap pace

      // Nearest car ahead by total distance (encodes physical proximity).
      const ahead = bi > 0 ? byDist[bi - 1] : null;
      const gapM = ahead ? ahead.s - st.s : Infinity;
      const timeGap = gapM / Math.max(st.v, 5);
      const overtaking = t < st.overtakeUntil;

      if (ahead && !st.finished && gapM < 200) {
        const onStraight = kappa < 1 / 450;
        // Slipstream on straights at speed.
        if (timeGap > 0.25 && timeGap < 1.6 && onStraight && st.v > 30) {
          target *= 1.04;
        }
        // Turbulent air costs downforce-dependent grip in corners.
        if (timeGap < 1.0 && kappa > 1 / 220 && !overtaking) {
          target *= 1 - 0.03 * (1 - timeGap);
        }
        // Overtake attempt: once per zone, needs a genuine pace advantage.
        if (inZone[sampleIdx] && !overtaking && timeGap < 0.9) {
          const zoneKey = sampleIdx - (sampleIdx % 8); // coarse zone-entry key
          if (st.lastZoneTried !== zoneKey) {
            st.lastZoneTried = zoneKey;
            const paceDelta = (target - ahead.v) / Math.max(ahead.v, 10);
            const beingLapped = ahead.lapsDone < st.lapsDone || ahead.finished;
            if (paceDelta > 0.005 || beingLapped) {
              const p = beingLapped
                ? 0.95
                : Math.min(0.9, Math.max(0.08, 0.25 + 8 * paceDelta + 0.3 * e.aggression));
              if (rand() < p) {
                st.overtakeUntil = t + 5;
              }
            }
          }
        }
        // Blocked: stuck in the wake unless mid-overtake.
        if (timeGap < 0.45 && !overtaking) {
          target = Math.min(target, ahead.v * 1.005);
        }
        if (overtaking) target *= 1.02;
      }

      // Chase target speed through the physical accel/brake envelope.
      const cond = e.conds[lapIdx];
      const env = accelEnvelope(e.car, cond.mass, cond.grip, Math.max(st.v, 0.5));
      if (st.v < target) st.v = Math.min(target, st.v + Math.max(env.accel, 0.3) * SIM_DT);
      else st.v = Math.max(target, st.v - env.brake * SIM_DT);
      st.maxV = Math.max(st.maxV, st.v);

      const prevS = st.s;
      st.s += st.v * SIM_DT;

      // Hard minimum spacing (no ghosting) except while making a pass.
      if (ahead && !overtaking && st.s > ahead.s - MIN_GAP) {
        st.s = Math.max(prevS, ahead.s - MIN_GAP);
        st.v = Math.min(st.v, ahead.v);
      }

      // Lap crossing detection with sub-step interpolation.
      const newLaps = Math.floor(st.s / L);
      if (newLaps > st.lapsDone && st.s >= 0 && !st.finished) {
        const overshoot = st.s - newLaps * L;
        const tCross = t + SIM_DT - overshoot / Math.max(st.v, 1);
        const lapTime = tCross - st.lastCrossT;
        st.lapsDone = newLaps;
        st.lastCrossT = tCross;
        if (newLaps > 1 || st.lapTimes.length === 0) st.lapTimes.push(lapTime);
        if (newLaps >= 2 && lapTime < fastestLap.time) {
          fastestLap = { time: lapTime, carId: e.carId };
          events.push({
            t: tCross, type: 'fastestLap',
            text: `Fastest lap: ${e.car.name} — ${lapTime.toFixed(3)}s`,
          });
        }
        if (newLaps >= laps) {
          st.finished = true;
          st.finishTime = tCross;
        }
      }
    }

    t += SIM_DT;

    // Timeline recording + overtake event detection at 250 ms cadence.
    if (t >= nextRecord) {
      for (const st of state) {
        samples[st.e.carId].push(Math.round(st.s * 10) / 10);
      }
      const order = [...state]
        .sort((a, b) => (a.finished && b.finished ? a.finishTime - b.finishTime : b.s - a.s))
        .map((st) => st.e.carId);
      for (let pos = 0; pos < order.length; pos++) {
        const prevPos = prevOrder.indexOf(order[pos]);
        if (prevPos > pos && t > 3) {
          const mover = entries.find((e) => e.carId === order[pos]);
          const displaced = entries.find((e) => e.carId === order[pos + 1]);
          if (mover && displaced && mover !== displaced) {
            events.push({
              t, type: 'overtake',
              text: `${mover.car.name} passes ${displaced.car.name} for P${pos + 1}`,
            });
          }
          break; // one event per frame is enough for the ticker
        }
      }
      prevOrder = order;
      nextRecord += RECORD_DT;
    }
  }

  // --- Results -------------------------------------------------------------
  const classified = [...state].sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    return b.s - a.s;
  });
  const winnerTime = classified[0].finishTime;

  const results = classified.map((st, i) => ({
    position: i + 1,
    carId: st.e.carId,
    name: st.e.car.name,
    color: st.e.color,
    grid: st.e.grid,
    finished: st.finished,
    totalTime: st.finishTime,
    gap: i === 0 || !st.finished ? null : st.finishTime - winnerTime,
    bestLap: st.lapTimes.length ? Math.min(...st.lapTimes) : null,
    topSpeedKmh: Math.round(st.maxV * 3.6),
    lapTimes: st.lapTimes.map((lt) => Math.round(lt * 1000) / 1000),
  }));

  return {
    seed,
    track: {
      id: track.id,
      name: track.name,
      width: track.width,
      length: Math.round(L),
      laps,
      path: centerline.points.filter((_, i) => i % 3 === 0).map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]),
    },
    entries: entries.map((e) => ({
      carId: e.carId,
      name: e.car.name,
      color: e.color,
      abbr: e.abbr,
      grid: e.grid,
      qualiTime: Math.round(e.qualiTime * 1000) / 1000,
    })),
    timeline: {
      dt: RECORD_DT,
      duration: t,
      trackLength: Math.round(L * 10) / 10,
      samples,
    },
    fastestLap: fastestLap.carId ? { carId: fastestLap.carId, time: Math.round(fastestLap.time * 1000) / 1000 } : null,
    events: events.map((ev) => ({ ...ev, t: Math.round(ev.t * 100) / 100 })),
    results,
  };
}
