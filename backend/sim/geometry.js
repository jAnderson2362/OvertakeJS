// Track geometry: closed centripetal Catmull-Rom spline sampling + curvature.
//
// Tracks are authored as a loop of 2D control points (meters). We interpolate a
// smooth closed spline through them, resample it at uniform arc-length spacing,
// and compute signed curvature at every sample (Menger curvature). The same
// sampled centerline drives both the physics solver and the frontend renderer.

/**
 * Centripetal Catmull-Rom interpolation (Barry-Goldman pyramid, alpha = 0.5).
 * Centripetal parameterization avoids the cusps/self-intersections that the
 * uniform variant produces on unevenly spaced control points.
 */
function catmullRom(p0, p1, p2, p3, t) {
  const alpha = 0.5;
  const knot = (a, b, prev) => prev + Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]) ** alpha, 1e-4);
  const t0 = 0;
  const t1 = knot(p0, p1, t0);
  const t2 = knot(p1, p2, t1);
  const t3 = knot(p2, p3, t2);
  const u = t1 + t * (t2 - t1);

  const lerpP = (pa, pb, ta, tb) => {
    const w = (u - ta) / (tb - ta);
    return [pa[0] + (pb[0] - pa[0]) * w, pa[1] + (pb[1] - pa[1]) * w];
  };
  const a1 = lerpP(p0, p1, t0, t1);
  const a2 = lerpP(p1, p2, t1, t2);
  const a3 = lerpP(p2, p3, t2, t3);
  const b1 = lerpP(a1, a2, t0, t2);
  const b2 = lerpP(a2, a3, t1, t3);
  return lerpP(b1, b2, t1, t2);
}

/** Signed Menger curvature of three points: 4 * signedArea / (|ab||bc||ca|). */
function mengerCurvature(a, b, c) {
  const abx = b[0] - a[0], aby = b[1] - a[1];
  const acx = c[0] - a[0], acy = c[1] - a[1];
  const cross = abx * acy - aby * acx; // 2 * signed area
  const lab = Math.hypot(abx, aby);
  const lbc = Math.hypot(c[0] - b[0], c[1] - b[1]);
  const lca = Math.hypot(acx, acy);
  const denom = lab * lbc * lca;
  if (denom < 1e-9) return 0;
  return (2 * cross) / denom;
}

/**
 * Sample a closed control-point loop into a uniform-arc-length centerline.
 * Returns { points, curvature, spacing, length }.
 */
export function buildCenterline(controlPoints, targetSpacing = 5) {
  const n = controlPoints.length;

  // Dense evaluation of the closed spline.
  const dense = [];
  for (let i = 0; i < n; i++) {
    const p0 = controlPoints[(i - 1 + n) % n];
    const p1 = controlPoints[i];
    const p2 = controlPoints[(i + 1) % n];
    const p3 = controlPoints[(i + 2) % n];
    const chord = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const steps = Math.max(6, Math.ceil(chord / 2));
    for (let s = 0; s < steps; s++) {
      dense.push(catmullRom(p0, p1, p2, p3, s / steps));
    }
  }

  // Cumulative arc length of the dense polyline (closed).
  const cum = [0];
  for (let i = 1; i <= dense.length; i++) {
    const a = dense[i - 1];
    const b = dense[i % dense.length];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = cum[dense.length];

  // Uniform resample: adjust spacing so it divides the length exactly.
  const count = Math.max(32, Math.round(total / targetSpacing));
  const spacing = total / count;
  const points = [];
  let seg = 0;
  for (let i = 0; i < count; i++) {
    const d = i * spacing;
    while (seg < dense.length - 1 && cum[seg + 1] < d) seg++;
    const a = dense[seg];
    const b = dense[(seg + 1) % dense.length];
    const segLen = cum[seg + 1] - cum[seg];
    const w = segLen > 1e-9 ? (d - cum[seg]) / segLen : 0;
    points.push([a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w]);
  }

  // Curvature at each sample, then a small moving-average smooth to strip
  // spline discretization noise (window ~5 samples = 25 m).
  const raw = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    raw[i] = mengerCurvature(
      points[(i - 1 + count) % count],
      points[i],
      points[(i + 1) % count],
    );
  }
  const curvature = new Float64Array(count);
  const half = 2;
  for (let i = 0; i < count; i++) {
    let sum = 0;
    for (let k = -half; k <= half; k++) sum += raw[(i + k + count) % count];
    curvature[i] = sum / (2 * half + 1);
  }

  return { points, curvature, spacing, length: total };
}

/**
 * Find straights suitable for overtaking: maximal runs of samples where the
 * curve radius exceeds minRadius, at least minLength meters long.
 * Returns index ranges [{ start, end, length }] into the centerline samples.
 */
export function findOvertakeZones(curvature, spacing, minRadius = 350, minLength = 130) {
  const n = curvature.length;
  const straight = (i) => Math.abs(curvature[i]) < 1 / minRadius;
  const zones = [];

  // Find a curved sample to anchor the scan so runs never wrap ambiguously.
  let anchor = 0;
  while (anchor < n && straight(anchor)) anchor++;
  if (anchor === n) return [{ start: 0, end: n - 1, length: n * spacing }]; // pure oval edge case

  let runStart = -1;
  for (let k = 1; k <= n; k++) {
    const i = (anchor + k) % n;
    if (straight(i)) {
      if (runStart === -1) runStart = i;
    } else if (runStart !== -1) {
      const runLen = ((i - runStart + n) % n) * spacing;
      if (runLen >= minLength) zones.push({ start: runStart, end: (i - 1 + n) % n, length: runLen });
      runStart = -1;
    }
  }
  return zones;
}
