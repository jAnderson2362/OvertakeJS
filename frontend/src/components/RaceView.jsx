import { useEffect, useMemo, useRef, useState } from 'react';
import { buildPathLookup, distanceAt, speedAt, standingsAt } from '../utils/playback.js';
import { formatLapTime, formatClock, formatGap } from '../utils/format.js';
import CarThumb from './CarThumb.jsx';

/** Read a CSS token from the document (canvas drawing can't use CSS variables directly). */
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const SPEED_OPTIONS = [1, 2, 4, 8, 16, 32];

// Simulated gearbox for the RPM readout (there is no real engine model, so we
// derive gear + revs from speed: revs climb through each gear's speed band and
// drop on the upshift, giving the familiar sawtooth).
const GEARS = 8;
const MAX_RPM = 13000;

function gearbox(speedKmh, topSpeed) {
  const band = topSpeed / GEARS;
  const gear = Math.min(GEARS, Math.max(1, Math.floor(speedKmh / band) + 1));
  const within = Math.min(1, Math.max(0, (speedKmh - (gear - 1) * band) / band));
  const floorFrac = gear === 1 ? 0.12 : 0.55; // revs just after an upshift
  const rpmFrac = floorFrac + within * (1 - floorFrac);
  return { gear, rpm: Math.round(rpmFrac * MAX_RPM), rpmFrac };
}

export default function RaceView({ race, onExit, onRerun }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  // Playback clock lives in a ref so the rAF loop never fights React renders.
  const playRef = useRef({ t: 0, speed: 8, playing: true, lastFrame: null });

  const [speed, setSpeed] = useState(8);
  const [playing, setPlaying] = useState(true);
  const [hud, setHud] = useState({ t: 0, rows: [], done: false });
  // Onboard camera: which car we're riding with (null = full-track view).
  const [focusId, setFocusId] = useState(null);
  const focusRef = useRef(null);

  const pointAt = useMemo(
    () => buildPathLookup(race.track.path, race.timeline.trackLength),
    [race],
  );

  useEffect(() => { playRef.current.speed = speed; }, [speed]);
  useEffect(() => { playRef.current.playing = playing; }, [playing]);
  useEffect(() => { focusRef.current = focusId; }, [focusId]);

  // Main render loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const palette = {
      curb: cssVar('--track-curb'),
      asphalt: cssVar('--track-asphalt'),
      asphaltLo: cssVar('--track-asphalt-lo'),
      line: cssVar('--track-line'),
      edge: cssVar('--track-edge'),
      glow: cssVar('--track-glow'),
      kerb: cssVar('--track-kerb'),
      kerbAlt: cssVar('--track-kerb-alt'),
      checkA: cssVar('--track-check-a'),
      checkB: cssVar('--track-check-b'),
      arena: cssVar('--track-arena'),
      arenaLo: cssVar('--track-arena-lo'),
      grid: cssVar('--track-grid'),
      label: cssVar('--car-label'),
    };
    const { track, timeline, entries } = race;
    const { samples, dt, duration } = timeline;
    let raf;
    let lastHud = -1;

    // Fit transform for the track's bounding box.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of track.path) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }

    function resize() {
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(containerRef.current);

    // Smoothed onboard camera, persisted across frames.
    const camera = { id: null, x: 0, y: 0, ang: 0 };

    // Returns a { project(x,y)->[X,Y], scale } camera. With `focus` set it
    // centres on that car, zooms in and rotates so the car points up-screen.
    function transform(focus) {
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.width, H = canvas.height;
      const pad = 40 * dpr;
      const fit = Math.min((W - 2 * pad) / (maxX - minX), (H - 2 * pad) / (maxY - minY));
      if (focus) {
        const Z = fit * 4.5;
        const cxS = W * 0.5, cyS = H * 0.6; // car sits low-centre, track ahead above
        const cos = Math.cos(focus.ang), sin = Math.sin(focus.ang);
        const project = (x, y) => {
          const dx = (x - focus.x) * Z, dy = (-y - -focus.y) * Z; // flip y (world up)
          return [cxS + dx * cos - dy * sin, cyS + dx * sin + dy * cos];
        };
        return { project, scale: Z, focus: true };
      }
      const ox = (W - (maxX - minX) * fit) / 2;
      const oy = (H - (maxY - minY) * fit) / 2;
      // y-flip so the authored layout reads naturally
      const project = (x, y) => [ox + (x - minX) * fit, H - (oy + (y - minY) * fit)];
      return { project, scale: fit, focus: false };
    }

    // Atmospheric arena backdrop: radial floor gradient + faint telemetry grid.
    function drawBackground() {
      const W = canvas.width, H = canvas.height;
      const dpr = window.devicePixelRatio || 1;
      const g = ctx.createRadialGradient(W * 0.5, H * 0.4, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.75);
      g.addColorStop(0, palette.arena);
      g.addColorStop(1, palette.arenaLo);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = palette.grid;
      ctx.lineWidth = 1 * dpr;
      const step = 46 * dpr;
      ctx.beginPath();
      for (let x = (W % step) / 2; x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = (H % step) / 2; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
    }

    // Darken the edges so the action reads toward the centre (broadcast feel).
    function drawVignette() {
      const W = canvas.width, H = canvas.height;
      const vg = ctx.createRadialGradient(W * 0.5, H * 0.5, H * 0.28, W * 0.5, H * 0.5, Math.max(W, H) * 0.7);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);
    }

    function tracePath(tf) {
      ctx.beginPath();
      track.path.forEach(([x, y], i) => {
        const [px, py] = tf.project(x, y);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      });
      ctx.closePath();
    }

    function drawTrack(tf) {
      const dpr = window.devicePixelRatio || 1;
      const ribbon = Math.max(track.width * tf.scale, 10 * dpr);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      // Soft ground shadow beneath the ribbon so the track sits on the arena floor.
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.65)';
      ctx.shadowBlur = 22 * dpr;
      ctx.shadowOffsetY = 6 * dpr;
      tracePath(tf);
      ctx.strokeStyle = palette.arenaLo;
      ctx.lineWidth = ribbon + 12 * dpr;
      ctx.stroke();
      ctx.restore();

      // Red safety-glow rim so the circuit feels lit.
      ctx.save();
      ctx.shadowColor = palette.glow;
      ctx.shadowBlur = 16 * dpr;
      tracePath(tf);
      ctx.strokeStyle = palette.curb;
      ctx.lineWidth = ribbon + 6 * dpr;
      ctx.stroke();
      ctx.restore();

      // Bright track edges (both sides), then the asphalt on top.
      tracePath(tf);
      ctx.strokeStyle = palette.edge;
      ctx.lineWidth = ribbon + 2.5 * dpr;
      ctx.stroke();

      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      grad.addColorStop(0, palette.asphalt);
      grad.addColorStop(1, palette.asphaltLo);
      tracePath(tf);
      ctx.strokeStyle = grad;
      ctx.lineWidth = ribbon;
      ctx.stroke();

      // Dashed centre racing line.
      tracePath(tf);
      ctx.setLineDash([10 * dpr, 12 * dpr]);
      ctx.strokeStyle = palette.line;
      ctx.lineWidth = 1.5 * dpr;
      ctx.stroke();
      ctx.setLineDash([]);

      // Start/finish: kerb-striped checkered gate perpendicular to the track.
      const [x0, y0] = track.path[0];
      const [x1, y1] = track.path[1];
      const [sx0, sy0] = tf.project(x0, y0);
      const [sx1, sy1] = tf.project(x1, y1);
      const dx = sx1 - sx0;
      const dy = sy1 - sy0;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const ux = dx / len, uy = dy / len;
      const half = ribbon / 2;
      const cells = 6;
      const cell = (half * 2) / cells;
      const sq = 3.5 * dpr;
      for (let c = 0; c < cells; c++) {
        for (let r = 0; r < 2; r++) {
          ctx.fillStyle = (c + r) % 2 === 0 ? palette.checkA : palette.checkB;
          const px = sx0 + nx * (-half + c * cell) + ux * r * sq;
          const py = sy0 + ny * (-half + c * cell) + uy * r * sq;
          ctx.fillRect(px, py, cell * 0.95, sq);
        }
      }
      // Red kerb caps at each end of the gate.
      ctx.fillStyle = palette.kerb;
      for (const sign of [-1, 1]) {
        const px = sx0 + nx * sign * (half + cell * 0.5);
        const py = sy0 + ny * sign * (half + cell * 0.5);
        ctx.beginPath();
        ctx.arc(px, py, 3 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawCars(tf, t, focusId) {
      const dpr = window.devicePixelRatio || 1;
      const scaleK = tf.focus ? 1.7 : 1; // bigger glyphs in the onboard cam
      const rows = [...entries].map((e) => ({ e, s: distanceAt(samples[e.carId], dt, t) }));
      rows.sort((a, b) => a.s - b.s); // draw leader last (on top)
      // Focused car always draws on top of the pack.
      rows.sort((a, b) => (a.e.carId === focusId ? 1 : 0) - (b.e.carId === focusId ? 1 : 0));

      rows.forEach(({ e, s }) => {
        const isLeader = e.carId === rows.reduce((m, r) => (r.s > m.s ? r : m), rows[0]).e.carId;
        const isFocus = e.carId === focusId;
        const [x, y] = pointAt(Math.max(s, 0.01));
        const [cx, cy] = tf.project(x, y);

        // Heading in screen space, from a point just ahead on the track.
        const [ax, ay] = pointAt(Math.max(s, 0.01) + 2.5);
        const [axS, ayS] = tf.project(ax, ay);
        const ang = Math.atan2(ayS - cy, axS - cx);

        // Fading motion trail sampled back along the racing line.
        const trailLen = 34; // metres
        const segs = 7;
        ctx.lineCap = 'round';
        for (let k = 0; k < segs; k++) {
          const s0 = s - (k / segs) * trailLen;
          const s1 = s - ((k + 1) / segs) * trailLen;
          if (s1 < 0.01) break;
          const [px0, py0] = pointAt(s0), [px1, py1] = pointAt(s1);
          const [q0x, q0y] = tf.project(px0, py0);
          const [q1x, q1y] = tf.project(px1, py1);
          const a = (1 - k / segs) * 0.5;
          ctx.strokeStyle = e.color;
          ctx.globalAlpha = a;
          ctx.lineWidth = (7 - k * 0.7) * dpr * scaleK;
          ctx.beginPath();
          ctx.moveTo(q0x, q0y);
          ctx.lineTo(q1x, q1y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Onboard targeting ring around the ridden car.
        if (isFocus) {
          ctx.save();
          ctx.strokeStyle = palette.kerbAlt;
          ctx.globalAlpha = 0.9;
          ctx.lineWidth = 1.5 * dpr;
          ctx.beginPath();
          ctx.arc(cx, cy, 13 * dpr * scaleK, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 0.35;
          ctx.beginPath();
          ctx.arc(cx, cy, 17 * dpr * scaleK, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(ang);
        ctx.scale(scaleK, scaleK);

        // Leader glow halo.
        if (isLeader) {
          ctx.save();
          ctx.shadowColor = palette.glow;
          ctx.shadowBlur = 14 * dpr;
          ctx.fillStyle = e.color;
          ctx.beginPath();
          ctx.arc(0, 0, 8 * dpr, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Directional car glyph: rounded body with a lighter nose.
        const L = 15 * dpr, Wc = 8.5 * dpr, rad = 2.6 * dpr;
        ctx.beginPath();
        const hx = L / 2, hy = Wc / 2;
        ctx.moveTo(-hx + rad, -hy);
        ctx.lineTo(hx - rad, -hy);
        ctx.quadraticCurveTo(hx, -hy, hx, -hy + rad);
        ctx.lineTo(hx, hy - rad);
        ctx.quadraticCurveTo(hx, hy, hx - rad, hy);
        ctx.lineTo(-hx + rad, hy);
        ctx.quadraticCurveTo(-hx, hy, -hx, hy - rad);
        ctx.lineTo(-hx, -hy + rad);
        ctx.quadraticCurveTo(-hx, -hy, -hx + rad, -hy);
        ctx.closePath();
        ctx.fillStyle = e.color;
        ctx.fill();
        ctx.lineWidth = 1.4 * dpr;
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.stroke();
        // Nose highlight.
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(hx - 4 * dpr, -hy + 1.2 * dpr, 2.4 * dpr, Wc - 2.4 * dpr);
        ctx.restore();

        // Abbreviation tag (upright, above the car).
        const tagY = cy - 11 * dpr * scaleK;
        ctx.font = `700 ${9 * dpr * (tf.focus ? 1.15 : 1)}px Lato, ui-sans-serif, system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.lineWidth = 3 * dpr;
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.strokeText(e.abbr, cx, tagY);
        ctx.fillStyle = isFocus ? palette.kerbAlt : isLeader ? palette.kerbAlt : palette.label;
        ctx.fillText(e.abbr, cx, tagY);
      });
    }

    function frame(now) {
      const p = playRef.current;
      if (p.lastFrame == null) p.lastFrame = now;
      const elapsed = (now - p.lastFrame) / 1000;
      p.lastFrame = now;
      if (p.playing) p.t = Math.min(p.t + elapsed * p.speed, duration);

      // Onboard camera: track the focused car's position and heading.
      const fid = focusRef.current;
      let focus = null;
      if (fid != null && samples[fid]) {
        const s = distanceAt(samples[fid], dt, p.t);
        const [cx, cy] = pointAt(Math.max(s, 0.01));
        const [ax, ay] = pointAt(Math.max(s, 0.01) + 3);
        // Rotation that turns the car's forward vector into screen-up.
        const targetAng = (-Math.PI / 2) - Math.atan2(-(ay - cy), ax - cx);
        if (camera.id !== fid) {
          camera.id = fid; camera.x = cx; camera.y = cy; camera.ang = targetAng;
        } else {
          camera.x += (cx - camera.x) * 0.2;
          camera.y += (cy - camera.y) * 0.2;
          let d = targetAng - camera.ang;
          d = Math.atan2(Math.sin(d), Math.cos(d)); // shortest angular path
          camera.ang += d * 0.15;
        }
        focus = { x: camera.x, y: camera.y, ang: camera.ang };
      } else {
        camera.id = null;
      }

      const tf = transform(focus);
      drawBackground();
      drawTrack(tf);
      drawCars(tf, p.t, fid);
      drawVignette();

      // Throttle HUD (React) updates to ~8 Hz.
      if (Math.abs(p.t - lastHud) > 0.12 || (p.t >= duration && lastHud < duration)) {
        lastHud = p.t;
        setHud({ t: p.t, rows: standingsAt(race, p.t), done: p.t >= duration });
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [race, pointAt]);

  const restart = () => {
    playRef.current.t = 0;
    setPlaying(true);
  };

  const visibleEvents = useMemo(
    () => race.events.filter((ev) => ev.t <= hud.t).slice(-4).reverse(),
    [race.events, hud.t],
  );

  const leaderLap = hud.rows[0]?.lap ?? 1;
  const focusRow = focusId != null ? hud.rows.find((r) => r.carId === focusId) : null;
  const toggleFocus = (carId) => setFocusId((cur) => (cur === carId ? null : carId));

  // Gauge ceiling: the field's top speed, rounded up to a tidy multiple of 20.
  const topSpeed = useMemo(() => {
    const { samples, dt } = race.timeline;
    let mx = 0;
    for (const arr of Object.values(samples)) {
      for (let i = 1; i < arr.length; i++) {
        const v = (arr[i] - arr[i - 1]) / dt;
        if (v > mx) mx = v;
      }
    }
    return Math.max(Math.ceil((mx * 3.6) / 20) * 20, 80);
  }, [race]);

  // Live telemetry for the ridden car, sampled from its own distance trace so
  // the readout is accurate regardless of playback speed.
  const telemetry = useMemo(() => {
    if (focusId == null || !race.timeline.samples[focusId]) return null;
    const { samples, dt } = race.timeline;
    const arr = samples[focusId];
    const t = hud.t;
    const speed = speedAt(arr, dt, t) * 3.6;
    const delta = speed - speedAt(arr, dt, Math.max(0, t - 0.4)) * 3.6;
    const WINDOW = 6, N = 40;
    const trace = [];
    for (let i = 0; i < N; i++) {
      const tt = Math.max(0, t - WINDOW + (WINDOW * i) / (N - 1));
      trace.push(speedAt(arr, dt, tt) * 3.6);
    }
    return { speed, delta, trace, ...gearbox(speed, topSpeed) };
  }, [race, focusId, hud.t, topSpeed]);

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-line/30 bg-bg-deep">
        <div className="flex items-center gap-4">
          <button
            onClick={onExit}
            className="px-4 py-1.5 rounded-lg font-display text-lg leading-none border border-line bg-surface text-ink hover:border-ink/60 hover:bg-surface-2 transition-colors"
          >
            Back to setup
          </button>
          <div>
            <span className="font-display text-xl leading-none align-middle">{race.track.name}</span>
            <span className="text-ink/45 text-sm ml-2">
              {(race.track.length / 1000).toFixed(2)} km · {race.track.laps} laps
            </span>
          </div>
        </div>
        <div className="flex items-center gap-5 text-sm">
          <span className="tabular-nums text-ink/80">
            Lap <span className="font-semibold text-ink">{leaderLap}</span>/{race.track.laps}
          </span>
          <span className="tabular-nums text-ink/60">⏱ {formatClock(hud.t)}</span>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Canvas */}
        <div ref={containerRef} className="flex-1 relative bg-bg">
          <canvas ref={canvasRef} className="absolute inset-0" />

          {/* Onboard camera banner */}
          {focusRow && (
            <div className="absolute left-4 top-4 flex items-center gap-3 pl-2.5 pr-3 py-2 rounded-xl bg-bg-deep/85 border border-line/40 backdrop-blur-sm">
              <span className="w-2.5 h-2.5 rounded-full ring-2 ring-bg-deep" style={{ background: focusRow.color }} />
              <div className="leading-tight">
                <div className="text-[10px] uppercase tracking-wider text-highlight-soft">Onboard · P{focusRow.position}</div>
                <div className="font-display text-lg leading-none">{focusRow.name}</div>
              </div>
              <div className="text-right leading-tight tabular-nums pl-1">
                <div className="text-lg font-semibold">{Math.round(focusRow.speedKmh)}<span className="text-[10px] text-ink/45 ml-0.5">km/h</span></div>
                <div className="text-[10px] text-ink/45">Lap {focusRow.lap}/{race.track.laps}</div>
              </div>
              <button
                onClick={() => setFocusId(null)}
                className="ml-1 px-2.5 py-1 rounded-lg text-xs bg-line/40 hover:bg-line/60 transition-colors"
              >
                Exit
              </button>
            </div>
          )}

          {/* Events ticker */}
          <div className="absolute left-4 bottom-4 space-y-1 pointer-events-none">
            {visibleEvents.map((ev, i) => (
              <div key={`${ev.t}-${i}`}
                className={`text-xs px-3 py-1.5 rounded-md bg-bg-deep/85 border border-line/30 ${
                  ev.type === 'overtake' ? 'text-highlight' : ev.type === 'fastestLap' ? 'text-highlight-soft italic' : 'text-ink/80'
                }`}>
                <span className="text-ink/45 tabular-nums mr-2">{formatClock(ev.t)}</span>
                {ev.text}
              </div>
            ))}
          </div>

          {/* Results overlay */}
          {hud.done && (
            <div className="absolute inset-0 flex items-center justify-center bg-bg/80 backdrop-blur-sm">
              <div className="bg-surface border border-line/50 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl">
                <h2 className="font-display text-3xl leading-none mb-1">Race result</h2>
                <p className="text-sm text-ink/60 mb-4">
                  {race.track.name} · {race.track.laps} laps
                  {race.fastestLap && (
                    <> · fastest lap {formatLapTime(race.fastestLap.time)} (
                    {race.entries.find((e) => e.carId === race.fastestLap.carId)?.name})</>
                  )}
                </p>
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {race.results.map((r) => (
                    <div key={r.carId} className="flex items-center gap-3 text-sm bg-bg-deep/60 rounded-lg px-3 py-2">
                      <span className="w-6 text-ink/60 font-semibold tabular-nums">{r.position}</span>
                      <CarThumb src={r.image} color={r.color} name={r.name} />
                      <span className="flex-1 truncate">{r.name}</span>
                      <span className="text-ink/60 tabular-nums text-xs">
                        {r.position === 1 ? formatLapTime(r.totalTime) : formatGap(r.gap, 0)}
                      </span>
                      <span className="text-ink/45 tabular-nums text-xs w-16 text-right">
                        {formatLapTime(r.bestLap)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 mt-5">
                  <button onClick={restart}
                    className="flex-1 py-2.5 rounded-lg bg-line hover:bg-line/80 text-accent-fg font-medium text-sm transition-colors">
                    Replay
                  </button>
                  <button onClick={onRerun}
                    className="flex-1 py-2.5 rounded-lg bg-accent hover:bg-accent-hover font-medium text-sm transition-colors">
                    Re-run simulation
                  </button>
                  <button onClick={onExit}
                    className="flex-1 py-2.5 rounded-lg bg-line/40 hover:bg-line/60 font-medium text-sm transition-colors">
                    New race
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <aside className="w-72 border-l border-line/30 bg-bg-deep flex flex-col">
          <div className="px-4 py-2 border-b border-line/30 flex items-baseline justify-between">
            <span className="font-display text-lg leading-none tracking-wide text-ink/60">Live standings</span>
            <span className="text-[10px] text-ink/35 uppercase tracking-wider">tap for onboard</span>
          </div>
          <div className="flex-1 overflow-y-auto scroll-thin">
            {hud.rows.map((row) => {
              const selected = row.carId === focusId;
              return (
                <button
                  key={row.carId}
                  onClick={() => toggleFocus(row.carId)}
                  aria-pressed={selected}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 border-b border-line/15 text-sm text-left transition-colors ${
                    selected ? 'bg-accent/20 border-l-2 border-l-accent' : 'hover:bg-surface/60 border-l-2 border-l-transparent'
                  }`}
                >
                  <span className="w-5 text-ink/45 font-semibold tabular-nums">{row.position}</span>
                  <CarThumb src={row.image} color={row.color} name={row.name} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate leading-tight flex items-center gap-1.5">
                      {row.name}
                      {selected && <span className="text-[9px] text-accent-fg bg-accent px-1 py-px rounded uppercase tracking-wide leading-none">POV</span>}
                    </div>
                    <div className="text-[11px] text-ink/45 tabular-nums">
                      {row.finished ? 'Finished' : `Lap ${row.lap} · ${Math.round(row.speedKmh)} km/h`}
                    </div>
                  </div>
                  <span className="text-xs text-ink/60 tabular-nums">
                    {row.position === 1 ? 'Leader' : formatGap(row.gap, row.lapsBehind)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Live speed dash for the ridden car */}
          {focusRow && telemetry && (
            <SpeedDash row={focusRow} telemetry={telemetry} topSpeed={topSpeed} />
          )}

          {/* Playback controls */}
          <div className="border-t border-line/30 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPlaying((p) => !p)}
                className="flex-1 py-2 rounded-lg bg-line/40 hover:bg-line/60 text-sm font-medium transition-colors">
                {playing ? '❚❚ Pause' : '▶ Play'}
              </button>
              <button onClick={restart}
                className="py-2 px-3 rounded-lg bg-line/40 hover:bg-line/60 text-sm transition-colors">
                ↺
              </button>
            </div>
            <div>
              <div className="text-[11px] text-ink/45 mb-1.5">Playback speed</div>
              <div className="grid grid-cols-6 gap-1">
                {SPEED_OPTIONS.map((s) => (
                  <button key={s} onClick={() => setSpeed(s)}
                    className={`py-1 rounded text-xs tabular-nums transition-colors ${
                      speed === s ? 'bg-highlight text-highlight-fg font-semibold' : 'bg-line/30 text-ink/60 hover:bg-line/50'
                    }`}>
                    {s}×
                  </button>
                ))}
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-line/30 overflow-hidden">
              <div className="h-full bg-highlight transition-[width] duration-200"
                style={{ width: `${Math.min(100, (hud.t / race.timeline.duration) * 100)}%` }} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Onboard telemetry: analog speedo arc, digital km/h readout and a rolling speed trace. */
function SpeedDash({ row, telemetry, topSpeed }) {
  const { speed, delta, trace, gear, rpm, rpmFrac } = telemetry;
  const SEGS = 14;
  const litSegs = Math.round(rpmFrac * SEGS);
  const f = Math.max(0, Math.min(1, speed / topSpeed));
  // Needle endpoint on a 180° top arc (0 = left, 1 = right).
  const ang = Math.PI - f * Math.PI;
  const nx = 100 + 66 * Math.cos(ang);
  const ny = 100 - 66 * Math.sin(ang);

  const N = trace.length;
  const pts = trace.map((v, i) => {
    const x = (i / (N - 1)) * 100;
    const y = 30 - Math.max(0, Math.min(1, v / topSpeed)) * 28 - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <div className="border-t border-line/30 px-4 pt-3 pb-2">
      <div className="flex items-center justify-between mb-1">
        <span className="font-display text-base leading-none tracking-wide text-ink/70">Telemetry</span>
        <span className="flex items-center gap-1.5 text-[11px] text-ink/45">
          <span className="w-2 h-2 rounded-full" style={{ background: row.color }} />
          {row.abbr ?? row.name}
        </span>
      </div>

      <div className="relative">
        <svg viewBox="0 0 200 108" className="w-full">
          {/* dial ticks */}
          {Array.from({ length: 9 }).map((_, i) => {
            const a = Math.PI - (i / 8) * Math.PI;
            const r0 = 78, r1 = i % 2 === 0 ? 68 : 72;
            return (
              <line key={i}
                x1={100 + r0 * Math.cos(a)} y1={100 - r0 * Math.sin(a)}
                x2={100 + r1 * Math.cos(a)} y2={100 - r1 * Math.sin(a)}
                stroke="var(--line)" strokeWidth="1.5" strokeLinecap="round" />
            );
          })}
          {/* track + value arcs */}
          <path d="M22,100 A78,78 0 0 1 178,100" pathLength="100" fill="none"
            stroke="var(--line)" strokeOpacity="0.5" strokeWidth="7" strokeLinecap="round" />
          <path d="M22,100 A78,78 0 0 1 178,100" pathLength="100" fill="none"
            stroke="var(--accent)" strokeWidth="7" strokeLinecap="round"
            strokeDasharray={`${(f * 100).toFixed(2)} 100`}
            style={{ transition: 'stroke-dasharray 120ms linear' }} />
          {/* needle */}
          <line x1="100" y1="100" x2={nx.toFixed(1)} y2={ny.toFixed(1)}
            stroke="var(--highlight-soft)" strokeWidth="2.5" strokeLinecap="round"
            style={{ transition: 'all 120ms linear' }} />
          <circle cx="100" cy="100" r="5" fill="var(--surface-2)" stroke="var(--line)" strokeWidth="1.5" />
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pointer-events-none">
          <div className="font-display text-3xl leading-none tabular-nums">
            {Math.round(speed)}
            <span className="text-xs text-ink/45 font-sans ml-1">km/h</span>
          </div>
        </div>
      </div>

      {/* gear + shift-light rev strip */}
      <div className="flex items-center gap-3 mt-1">
        <div className="flex flex-col items-center leading-none">
          <span className="font-display text-2xl leading-none tabular-nums" style={{ color: rpmFrac > 0.92 ? 'var(--highlight-soft)' : undefined }}>{gear}</span>
          <span className="text-[8px] text-ink/40 uppercase tracking-wider mt-0.5">gear</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between text-[10px] text-ink/40 mb-1">
            <span className="uppercase tracking-wider">RPM</span>
            <span className="tabular-nums text-ink/60">{rpm.toLocaleString()}</span>
          </div>
          <div className="flex gap-[2px] h-2.5">
            {Array.from({ length: SEGS }).map((_, i) => {
              const lit = i < litSegs;
              const color = i >= SEGS - 2 ? 'var(--highlight-soft)' : i >= SEGS - 5 ? 'var(--accent)' : 'var(--ink)';
              return (
                <span key={i} className="flex-1 rounded-[1px]"
                  style={{ background: lit ? color : 'var(--line)', opacity: lit ? (i >= SEGS - 5 ? 1 : 0.85) : 0.3 }} />
              );
            })}
          </div>
        </div>
      </div>

      {/* rolling speed trace over the last ~6s */}
      <div className="mt-2">
        <div className="flex items-center justify-between text-[10px] text-ink/40 mb-1">
          <span className="uppercase tracking-wider">Speed · 6s</span>
          <span className={`tabular-nums ${delta > 0.5 ? 'text-highlight-soft' : delta < -0.5 ? 'text-ink/50' : 'text-ink/40'}`}>
            {delta > 0.5 ? '▲' : delta < -0.5 ? '▼' : '•'} {Math.abs(delta) < 0.5 ? 'steady' : `${delta > 0 ? '+' : ''}${Math.round(delta)}`}
          </span>
        </div>
        <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-8">
          <polyline points={`0,30 ${pts.join(' ')} 100,30`} fill="var(--highlight-glow)" stroke="none" />
          <polyline points={pts.join(' ')} fill="none" stroke="var(--accent)" strokeWidth="1.5"
            strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    </div>
  );
}
