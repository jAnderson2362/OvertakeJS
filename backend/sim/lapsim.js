// Quasi-steady-state point-mass lap simulation.
//
// The classic three-step lap-time solver used by professional lap-sim tools:
//   1. Corner speed ceiling at every centerline sample from lateral grip,
//      including aerodynamic downforce (grip grows with v^2, solved in closed form).
//   2. Forward pass: integrate v^2 along the track under the acceleration
//      limit — min(traction, engine power) minus drag and rolling resistance,
//      with longitudinal grip reduced by the friction ellipse while cornering.
//   3. Backward pass: same integration in reverse under the braking limit.
// The pointwise minimum of the passes is the fastest physically consistent
// speed profile; both passes run twice around the loop so the closed circuit
// wraps consistently.

const RHO = 1.225;   // air density, kg/m^3
const G = 9.81;      // gravity, m/s^2
const CRR = 0.013;   // rolling resistance coefficient

import { DRIVE_TRACTION } from '../data/cars.js';

/**
 * Solve the speed profile for one car on one track under given conditions.
 *
 * @param centerline { curvature: Float64Array, spacing, length }
 * @param car        car record from data/cars.js
 * @param cond       { mass, grip } — current total mass (kg) and tire mu
 * @returns { v: Float64Array (m/s per sample), lapTime (s) }
 */
export function solveSpeedProfile(centerline, car, cond) {
  const { curvature, spacing: ds } = centerline;
  const n = curvature.length;

  const m = cond.mass;
  const mu = cond.grip;
  const q = 0.5 * RHO * (car.liftArea || 0);   // downforce = q * v^2
  const dragK = 0.5 * RHO * car.dragArea;      // drag = dragK * v^2
  const vmax = car.topSpeed / 3.6;
  const eff = car.ev ? 0.94 : 0.85;            // driveline efficiency
  const P = car.power * 1000 * eff;
  const driveFrac = DRIVE_TRACTION[car.drive] ?? 0.72;

  // --- 1. Cornering speed ceiling ------------------------------------------
  // Lateral equilibrium: m v^2 |k| <= mu (m g + q v^2)
  //  => v^2 (m|k| - mu q) <= mu m g
  const vlim = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const k = Math.abs(curvature[i]);
    const denom = m * k - mu * q;
    vlim[i] = denom > 1e-9 ? Math.min(vmax, Math.sqrt((mu * m * G) / denom)) : vmax;
  }

  // Normal-load acceleration including downforce, and the friction-ellipse
  // fraction of grip left for longitudinal force at speed v on curvature k.
  const gEff = (v) => G + (q * v * v) / m;
  const ellipse = (v, k) => {
    const aLat = v * v * Math.abs(k);
    const aLatMax = mu * gEff(v);
    const r = aLat / aLatMax;
    return Math.sqrt(Math.max(0, 1 - r * r));
  };

  const v = Float64Array.from(vlim);

  for (let pass = 0; pass < 2; pass++) {
    // --- 2. Forward pass (acceleration-limited) ----------------------------
    for (let j = 0; j < 2 * n; j++) {
      const i = j % n;
      const inext = (i + 1) % n;
      const vi = Math.max(v[i], 0.5);
      const aTraction = driveFrac * mu * gEff(vi) * ellipse(vi, curvature[i]);
      const aPower = P / (m * Math.max(vi, 3));
      const aResist = (dragK * vi * vi + CRR * m * G) / m;
      const a = Math.min(aTraction, aPower) - aResist;
      const cand = Math.sqrt(Math.max(vi * vi + 2 * a * ds, 0.25));
      if (cand < v[inext]) v[inext] = cand;
    }

    // --- 3. Backward pass (braking-limited) --------------------------------
    for (let j = 2 * n; j > 0; j--) {
      const i = j % n;
      const iprev = (i - 1 + n) % n;
      const vi = Math.max(v[i], 0.5);
      const aBrakeGrip = mu * gEff(vi) * ellipse(vi, curvature[i]);
      const aResist = (dragK * vi * vi + CRR * m * G) / m; // drag helps braking
      const a = aBrakeGrip + aResist;
      const cand = Math.sqrt(vi * vi + 2 * a * ds);
      if (cand < v[iprev]) v[iprev] = cand;
    }
  }

  // Lap time via trapezoidal integration of ds / v.
  let lapTime = 0;
  for (let i = 0; i < n; i++) {
    lapTime += ds / ((v[i] + v[(i + 1) % n]) * 0.5);
  }

  return { v, lapTime };
}

/**
 * Longitudinal acceleration envelope at actual speed v (used by the race
 * integrator so cars launch from a standing start and chase their target
 * profile with physically consistent accel/braking rates).
 */
export function accelEnvelope(car, mass, grip, v) {
  const q = 0.5 * RHO * (car.liftArea || 0);
  const dragK = 0.5 * RHO * car.dragArea;
  const eff = car.ev ? 0.94 : 0.85;
  const P = car.power * 1000 * eff;
  const driveFrac = DRIVE_TRACTION[car.drive] ?? 0.72;
  const gE = G + (q * v * v) / mass;
  const aResist = (dragK * v * v + CRR * mass * G) / mass;
  return {
    accel: Math.min(driveFrac * grip * gE, P / (mass * Math.max(v, 3))) - aResist,
    brake: grip * gE + aResist,
  };
}
