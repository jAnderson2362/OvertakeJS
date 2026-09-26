// Procedural countryside around a circuit: rough grass with a mown, striped
// verge along the track, gravel traps on the outside of corners, a lake and
// woodland. Built once per track in world metres (the same space as
// track.path) and seeded from the track id, so a circuit always looks the
// same. RaceView draws it under whatever camera is active.

/** Small seeded PRNG (mulberry32 over a string hash). */
function seeded(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Distance from (x, y) to the closed polyline. */
function distToPath(path, x, y) {
  let best = Infinity;
  for (let i = 0; i < path.length; i++) {
    const [ax, ay] = path[i];
    const [bx, by] = path[(i + 1) % path.length];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    const d = Math.hypot(x - ax - t * dx, y - ay - t * dy);
    if (d < best) best = d;
  }
  return best;
}

/** Runs of tight corner, offset to the outside of the turn. */
function gravelTraps(path, width) {
  const n = path.length;
  const traps = [];
  let cur = null;
  for (let i = 0; i < n; i++) {
    const p0 = path[(i - 1 + n) % n], p1 = path[i], p2 = path[(i + 1) % n];
    const ax = p1[0] - p0[0], ay = p1[1] - p0[1];
    const bx = p2[0] - p1[0], by = p2[1] - p1[1];
    const turn = Math.atan2(ax * by - ay * bx, ax * bx + ay * by); // + = left
    const curvature = turn / ((Math.hypot(ax, ay) + Math.hypot(bx, by)) / 2 || 1);
    if (Math.abs(curvature) < 1 / 220) { cur = null; continue; }

    const tl = Math.hypot(ax + bx, ay + by) || 1;
    const tx = (ax + bx) / tl, ty = (ay + by) / tl;
    const side = curvature > 0 ? -1 : 1; // outside is opposite the turn
    const off = width / 2 + 22; // centre of a 36 m deep trap
    if (!cur || cur.side !== side) { cur = { side, points: [] }; traps.push(cur); }
    cur.points.push([p1[0] - side * ty * off, p1[1] + side * tx * off]);
  }
  return traps.filter((t) => t.points.length >= 3).map((t) => t.points);
}

/** Even-odd test: is (x, y) inside the closed track loop? */
function insideLoop(path, x, y) {
  let inside = false;
  for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
    const [xi, yi] = path[i], [xj, yj] = path[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** A lake in the infield's most open spot, if there's room for one. */
function findLake(path, width, box, rand) {
  let best = null;
  for (let x = box.minX; x <= box.maxX; x += 20) {
    for (let y = box.minY; y <= box.maxY; y += 20) {
      if (!insideLoop(path, x, y)) continue;
      const d = distToPath(path, x, y);
      if (!best || d > best.d) best = { x, y, d };
    }
  }
  const r = best ? Math.min(best.d - (width / 2 + 60), 170) : 0;
  if (r < 40) return null;

  const phase = [rand() * 6.28, rand() * 6.28];
  const points = Array.from({ length: 32 }, (_, i) => {
    const a = (i / 32) * Math.PI * 2;
    const k = 0.82 + 0.1 * Math.sin(a * 2 + phase[0]) + 0.08 * Math.sin(a * 3 + phase[1]);
    return [best.x + Math.cos(a) * r * k, best.y + Math.sin(a) * r * k];
  });
  return { x: best.x, y: best.y, r, points };
}

function woodland(path, width, ext, lake, rand) {
  const trees = [];
  const clear = width / 2 + 45; // run-off and gravel kept free of trees
  const place = (x, y, r) => {
    if (distToPath(path, x, y) < clear + r) return;
    if (lake && Math.hypot(x - lake.x, y - lake.y) < lake.r + r + 6) return;
    trees.push({ x, y, r, tone: Math.floor(rand() * 3) });
  };

  const areaKm2 = (ext.w * ext.h) / 1e6;
  for (let c = Math.round(areaKm2 * 14); c > 0; c--) {
    const cx = ext.minX + rand() * ext.w, cy = ext.minY + rand() * ext.h;
    const spread = 30 + rand() * 80;
    for (let n = 12 + Math.floor(rand() * 30); n > 0; n--) {
      const a = rand() * Math.PI * 2, d = spread * Math.sqrt(rand());
      place(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 3.5 + rand() * 4.5);
    }
  }
  for (let n = Math.round(areaKm2 * 40); n > 0; n--) {
    place(ext.minX + rand() * ext.w, ext.minY + rand() * ext.h, 2.5 + rand() * 3);
  }
  return trees;
}

/** Grass as a texture: soft patches, plus mowing stripes along the verge. */
function paintGround(path, ext, rand, colors) {
  const res = Math.min(1, Math.sqrt(4e6 / (ext.w * ext.h))); // pixels per metre
  const W = Math.ceil(ext.w * res), H = Math.ceil(ext.h * res);
  const toWorld = (g) => { g.scale(res, res); g.translate(-ext.minX, -ext.minY); };
  const trace = (g) => {
    g.beginPath();
    path.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
  };

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  toWorld(g);
  g.fillStyle = colors.rough;
  g.fillRect(ext.minX, ext.minY, ext.w, ext.h);

  for (let i = 0; i < 90; i++) {
    const x = ext.minX + rand() * ext.w, y = ext.minY + rand() * ext.h;
    const r = 40 + rand() * 160;
    const patch = g.createRadialGradient(x, y, 0, x, y, r);
    patch.addColorStop(0, rand() < 0.55 ? colors.patchDark : colors.patchLight);
    patch.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = patch;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Mown verge: a soft-edged band either side of the circuit.
  g.lineJoin = 'round';
  g.filter = `blur(${Math.max(1, 10 * res)}px)`;
  trace(g);
  g.strokeStyle = colors.mown;
  g.lineWidth = 150;
  g.stroke();
  g.filter = 'none';

  // Stripes run parallel to the main straight, masked to the verge.
  const stripes = document.createElement('canvas');
  stripes.width = W; stripes.height = H;
  const s = stripes.getContext('2d');
  toWorld(s);
  const [x0, y0] = path[0], [x1, y1] = path[1];
  const D = Math.hypot(ext.w, ext.h);
  s.save();
  s.translate(ext.minX + ext.w / 2, ext.minY + ext.h / 2);
  s.rotate(Math.atan2(y1 - y0, x1 - x0));
  s.fillStyle = colors.stripe;
  for (let v = -D; v < D; v += 24) s.fillRect(-D, v, 2 * D, 12);
  s.restore();
  s.globalCompositeOperation = 'destination-in';
  s.filter = `blur(${Math.max(1, 10 * res)}px)`;
  trace(s);
  s.lineJoin = 'round';
  s.lineWidth = 140;
  s.stroke();

  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(stripes, 0, 0);
  return { canvas, x: ext.minX, y: ext.minY, w: ext.w, h: ext.h };
}

/**
 * Build the scenery for a race's track. `colors` holds the resolved
 * --scenery-* tokens (rough, mown, stripe, patchDark, patchLight).
 */
export function buildScenery(track, colors) {
  const { path, width } = track;
  const rand = seeded(String(track.id ?? track.name));

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of path) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const box = { minX, minY, maxX, maxY };
  // Generous margin: wide screens show a lot of ground beside the circuit.
  const margin = Math.max(maxX - minX, maxY - minY) * 0.6 + 200;
  const ext = {
    minX: minX - margin, minY: minY - margin,
    w: maxX - minX + 2 * margin, h: maxY - minY + 2 * margin,
  };

  const lake = findLake(path, width, box, rand);
  return {
    ground: paintGround(path, ext, rand, colors),
    gravel: gravelTraps(path, width),
    lake,
    trees: woodland(path, width, ext, lake, rand),
  };
}
