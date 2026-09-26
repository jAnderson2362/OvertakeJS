// Forza-style performance card for a car record (stock or tuned build).
//
// The measured figures come from the same physics as the race sim
// (lapsim.js accelEnvelope and the cornering model): standing-start times,
// braking distances and steady-state lateral grip. Each 0-10 rating maps one
// measurement onto a fixed scale so cars compare directly.
//
// Offroad is an estimate: the sim has no loose surfaces, so it scores the
// traits that help off tarmac (AWD, ride height, soft suspension, road tires,
// low weight) instead of measuring anything.

import { accelEnvelope } from './lapsim.js';

const G = 9.81;
const RHO = 1.225;
const MPH = 0.44704;          // m/s per mph
const FT = 3.28084;           // ft per metre

const clamp10 = (x) => Math.round(Math.min(10, Math.max(0, x)) * 10) / 10;
/** Linear 0-10 rating: `worst` scores 0, `best` scores 10 (either order). */
const rate = (value, worst, best) => clamp10(((value - worst) / (best - worst)) * 10);
const round = (x, dp) => Math.round(x * 10 ** dp) / 10 ** dp;

/** Seconds from standstill to `v` m/s on a straight. */
export function timeTo(car, v) {
  const dt = 0.005;
  let speed = 0, t = 0;
  while (speed < v && t < 60) {
    speed += Math.max(accelEnvelope(car, car.mass, car.tireGrip, speed).accel, 0.01) * dt;
    t += dt;
  }
  return t;
}

/** Metres to stop from `v` m/s on a straight. */
export function stoppingDistance(car, v) {
  const dt = 0.001;
  let speed = v, d = 0;
  while (speed > 0) {
    speed -= accelEnvelope(car, car.mass, car.tireGrip, speed).brake * dt;
    d += Math.max(speed, 0) * dt;
  }
  return d;
}

/** Steady cornering grip in g at `v` m/s, downforce included. */
function lateralG(car, v) {
  const muLat = car.tireGrip * (car.cornerGrip ?? 1);
  const downforce = 0.5 * RHO * (car.liftArea || 0) * v * v;
  return muLat * (1 + downforce / (car.mass * G));
}

/** Estimated 0-10 offroad score from traits that matter on loose ground. */
function offroadScore(car) {
  const drive = { awd: 7.5, fwd: 5, rwd: 4.5 }[car.drive] ?? 4.5;
  return drive
    + ((car.traction ?? 1) - 1) * 10            // clutch / diff / wide rears help find grip
    - (car.liftArea || 0) * 1.2                 // aero cars sit low and scrape
    - Math.max(0, car.tireGrip - 1) * 5         // sticky track rubber clogs on dirt
    - ((car.cornerGrip ?? 1) - 1) * 12          // stiff race suspension skips over bumps
    - Math.max(0, car.mass - 1400) / 500;       // weight digs in
}

/**
 * Ratings (0-10) and the measured figures behind them. Units follow Forza:
 * mph for launch/acceleration/braking runs, feet for braking distance.
 */
export function performanceCard(car) {
  const zeroTo60 = timeTo(car, 60 * MPH);
  const zeroTo100 = timeTo(car, 100 * MPH);
  const brake60 = stoppingDistance(car, 60 * MPH) * FT;
  const brake100 = stoppingDistance(car, 100 * MPH) * FT;
  const latG60 = lateralG(car, 60 * MPH);
  const latG120 = lateralG(car, 120 * MPH);

  return {
    ratings: {
      speed: rate(car.topSpeed, 120, 380),
      handling: rate((latG60 + latG120) / 2, 0.7, 1.6),
      acceleration: rate(zeroTo100, 16, 4),
      launch: rate(zeroTo60, 8, 1.8),
      braking: rate(brake60, 150, 80),
      offroad: clamp10(offroadScore(car)),
    },
    stats: {
      topSpeedKmh: Math.round(car.topSpeed),
      zeroTo60: round(zeroTo60, 2),
      zeroTo100: round(zeroTo100, 2),
      braking60: Math.round(brake60),
      braking100: Math.round(brake100),
      lateralG60: round(latG60, 2),
      lateralG120: round(latG120, 2),
    },
  };
}
