// Timeline playback helpers: interpolate car distances at arbitrary race time,
// map distance-along-track to canvas coordinates, and compute live time gaps.

/** Build a distance->point lookup from the rendered path polyline. */
export function buildPathLookup(path, trackLength) {
  const n = path.length;
  const cum = new Float64Array(n + 1);
  for (let i = 1; i <= n; i++) {
    const a = path[i - 1];
    const b = path[i % n];
    cum[i] = cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  const total = cum[n];
  // The polyline is a downsample of the physics centerline, so its length is
  // slightly short of the true track length; rescale so the start/finish lines up.
  const scale = total / trackLength;

  return function pointAt(s) {
    let d = ((s % trackLength) + trackLength) % trackLength * scale;
    // binary search cum for the containing segment
    let lo = 0, hi = n;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= d) lo = mid; else hi = mid;
    }
    const a = path[lo];
    const b = path[(lo + 1) % n];
    const segLen = cum[lo + 1] - cum[lo];
    const w = segLen > 1e-9 ? (d - cum[lo]) / segLen : 0;
    return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w];
  };
}

/** Linear interpolation of a car's distance samples at race time t. */
export function distanceAt(samples, dt, t) {
  const f = t / dt;
  const i = Math.floor(f);
  if (i < 0) return samples[0];
  if (i >= samples.length - 1) return samples[samples.length - 1];
  const w = f - i;
  return samples[i] * (1 - w) + samples[i + 1] * w;
}

/** Instantaneous speed (m/s) from central difference of the samples. */
export function speedAt(samples, dt, t) {
  const i = Math.max(1, Math.min(samples.length - 2, Math.round(t / dt)));
  return Math.max(0, (samples[i + 1] - samples[i - 1]) / (2 * dt));
}

/**
 * True time gap: how long ago (in race time) the chasing car will need to
 * reach the leader's current distance. Binary search over the chaser's own
 * monotonic distance samples.
 */
export function timeGapTo(chaserSamples, dt, leaderDistance, now) {
  const n = chaserSamples.length;
  if (chaserSamples[n - 1] >= leaderDistance) {
    // find first sample index where chaser reaches leaderDistance
    let lo = 0, hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (chaserSamples[mid] < leaderDistance) lo = mid + 1; else hi = mid;
    }
    let tReach = lo * dt;
    if (lo > 0) {
      const span = chaserSamples[lo] - chaserSamples[lo - 1];
      const w = span > 1e-9 ? (leaderDistance - chaserSamples[lo - 1]) / span : 0;
      tReach = (lo - 1 + w) * dt;
    }
    return tReach - now; // positive: chaser reaches that point tReach-now seconds after "now"
  }
  // chaser never reaches that distance in the recorded timeline; estimate
  const v = speedAt(chaserSamples, dt, (n - 1) * dt);
  const remaining = leaderDistance - chaserSamples[n - 1];
  return (n - 1) * dt + (v > 1 ? remaining / v : Infinity) - now;
}

/** Live standings at race time t. Returns rows sorted by race position. */
export function standingsAt(race, t) {
  const { timeline, entries, track } = race;
  const { samples, dt } = timeline;
  const L = timeline.trackLength;

  const rows = entries.map((e) => {
    const arr = samples[e.carId];
    const s = distanceAt(arr, dt, t);
    return {
      ...e,
      s,
      speedKmh: speedAt(arr, dt, t) * 3.6,
      lap: Math.min(Math.max(Math.floor(s / L) + 1, 1), track.laps),
      finished: s >= track.laps * L - 1,
    };
  });
  rows.sort((a, b) => b.s - a.s);

  const leader = rows[0];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (i === 0) {
      r.gap = null;
      r.lapsBehind = 0;
    } else {
      r.lapsBehind = Math.max(0, Math.floor((leader.s - r.s) / L));
      r.gap = r.lapsBehind > 0
        ? null
        : Math.max(0, timeGapTo(samples[r.carId], dt, leader.s, t));
    }
    r.position = i + 1;
  }
  return rows;
}
