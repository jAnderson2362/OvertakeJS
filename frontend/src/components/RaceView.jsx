import { useEffect, useMemo, useRef, useState } from 'react';
import { buildPathLookup, distanceAt, standingsAt } from '../utils/playback.js';
import { formatLapTime, formatClock, formatGap } from '../utils/format.js';

const SPEED_OPTIONS = [1, 2, 4, 8, 16, 32];

export default function RaceView({ race, onExit, onRerun }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  // Playback clock lives in a ref so the rAF loop never fights React renders.
  const playRef = useRef({ t: 0, speed: 8, playing: true, lastFrame: null });

  const [speed, setSpeed] = useState(8);
  const [playing, setPlaying] = useState(true);
  const [hud, setHud] = useState({ t: 0, rows: [], done: false });

  const pointAt = useMemo(
    () => buildPathLookup(race.track.path, race.timeline.trackLength),
    [race],
  );

  useEffect(() => { playRef.current.speed = speed; }, [speed]);
  useEffect(() => { playRef.current.playing = playing; }, [playing]);

  // Main render loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
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

    function transform() {
      const dpr = window.devicePixelRatio || 1;
      const W = canvas.width, H = canvas.height;
      const pad = 40 * dpr;
      const scale = Math.min((W - 2 * pad) / (maxX - minX), (H - 2 * pad) / (maxY - minY));
      const ox = (W - (maxX - minX) * scale) / 2;
      const oy = (H - (maxY - minY) * scale) / 2;
      // y-flip so the authored layout reads naturally
      return { toX: (x) => ox + (x - minX) * scale, toY: (y) => H - (oy + (y - minY) * scale), scale };
    }

    function drawTrack(tf) {
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const ribbon = Math.max(track.width * tf.scale, 10 * dpr);

      ctx.beginPath();
      track.path.forEach(([x, y], i) => {
        i === 0 ? ctx.moveTo(tf.toX(x), tf.toY(y)) : ctx.lineTo(tf.toX(x), tf.toY(y));
      });
      ctx.closePath();
      ctx.lineJoin = 'round';

      ctx.strokeStyle = '#3f3f46';           // curb / casing
      ctx.lineWidth = ribbon + 5 * dpr;
      ctx.stroke();
      ctx.strokeStyle = '#26262b';           // asphalt
      ctx.lineWidth = ribbon;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; // faded racing line
      ctx.lineWidth = 1.5 * dpr;
      ctx.stroke();

      // Start/finish: short checkered bar perpendicular to the track direction.
      const [x0, y0] = track.path[0];
      const [x1, y1] = track.path[1];
      const dx = tf.toX(x1) - tf.toX(x0);
      const dy = tf.toY(y1) - tf.toY(y0);
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const half = ribbon / 2;
      const cells = 6;
      const cell = (half * 2) / cells;
      const sq = 3 * dpr;
      for (let c = 0; c < cells; c++) {
        for (let r = 0; r < 2; r++) {
          ctx.fillStyle = (c + r) % 2 === 0 ? '#e4e4e7' : '#18181b';
          const px = tf.toX(x0) + nx * (-half + c * cell) + (dx / len) * r * sq;
          const py = tf.toY(y0) + ny * (-half + c * cell) + (dy / len) * r * sq;
          ctx.fillRect(px, py, cell * 0.95, sq);
        }
      }
    }

    function drawCars(tf, t) {
      const dpr = window.devicePixelRatio || 1;
      const rows = [...entries].map((e) => ({ e, s: distanceAt(samples[e.carId], dt, t) }));
      rows.sort((a, b) => a.s - b.s); // draw leader last (on top)
      for (const { e, s } of rows) {
        const [x, y] = pointAt(Math.max(s, 0.01));
        const cx = tf.toX(x), cy = tf.toY(y);
        const r = 6.5 * dpr;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = e.color;
        ctx.fill();
        ctx.lineWidth = 1.5 * dpr;
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.stroke();
        ctx.font = `700 ${9 * dpr}px Lato, ui-sans-serif, system-ui`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(244,244,245,0.85)';
        ctx.fillText(e.abbr, cx, cy - r - 4 * dpr);
      }
    }

    function frame(now) {
      const p = playRef.current;
      if (p.lastFrame == null) p.lastFrame = now;
      const elapsed = (now - p.lastFrame) / 1000;
      p.lastFrame = now;
      if (p.playing) p.t = Math.min(p.t + elapsed * p.speed, duration);

      const tf = transform();
      drawTrack(tf);
      drawCars(tf, p.t);

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

  return (
    <div className="h-screen flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-zinc-950">
        <div className="flex items-center gap-4">
          <button onClick={onExit} className="text-sm text-zinc-400 hover:text-white transition-colors">
            ← Setup
          </button>
          <div>
            <span className="font-display text-3xl leading-none align-middle">{race.track.name}</span>
            <span className="text-zinc-500 text-sm ml-2">
              {(race.track.length / 1000).toFixed(2)} km · {race.track.laps} laps
            </span>
          </div>
        </div>
        <div className="flex items-center gap-5 text-sm">
          <span className="tabular-nums text-zinc-300">
            Lap <span className="font-semibold text-white">{leaderLap}</span>/{race.track.laps}
          </span>
          <span className="tabular-nums text-zinc-400">⏱ {formatClock(hud.t)}</span>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Canvas */}
        <div ref={containerRef} className="flex-1 relative bg-zinc-950">
          <canvas ref={canvasRef} className="absolute inset-0" />

          {/* Events ticker */}
          <div className="absolute left-4 bottom-4 space-y-1 pointer-events-none">
            {visibleEvents.map((ev, i) => (
              <div key={`${ev.t}-${i}`}
                className={`text-xs px-3 py-1.5 rounded-md bg-zinc-900/85 border border-zinc-800 ${
                  ev.type === 'overtake' ? 'text-amber-300' : ev.type === 'fastestLap' ? 'text-purple-300' : 'text-zinc-300'
                }`}>
                <span className="text-zinc-500 tabular-nums mr-2">{formatClock(ev.t)}</span>
                {ev.text}
              </div>
            ))}
          </div>

          {/* Results overlay */}
          {hud.done && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
              <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl">
                <h2 className="font-display text-5xl leading-none mb-1">🏁 Race result</h2>
                <p className="text-sm text-zinc-400 mb-4">
                  {race.track.name} · {race.track.laps} laps
                  {race.fastestLap && (
                    <> · fastest lap {formatLapTime(race.fastestLap.time)} (
                    {race.entries.find((e) => e.carId === race.fastestLap.carId)?.name})</>
                  )}
                </p>
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {race.results.map((r) => (
                    <div key={r.carId} className="flex items-center gap-3 text-sm bg-zinc-800/60 rounded-lg px-3 py-2">
                      <span className="w-6 text-zinc-400 font-semibold tabular-nums">{r.position}</span>
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} />
                      <span className="flex-1 truncate">{r.name}</span>
                      <span className="text-zinc-400 tabular-nums text-xs">
                        {r.position === 1 ? formatLapTime(r.totalTime) : formatGap(r.gap, 0)}
                      </span>
                      <span className="text-zinc-500 tabular-nums text-xs w-16 text-right">
                        {formatLapTime(r.bestLap)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 mt-5">
                  <button onClick={restart}
                    className="flex-1 py-2.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 font-medium text-sm transition-colors">
                    Replay
                  </button>
                  <button onClick={onRerun}
                    className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 font-medium text-sm transition-colors">
                    Re-run simulation
                  </button>
                  <button onClick={onExit}
                    className="flex-1 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 font-medium text-sm transition-colors">
                    New race
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <aside className="w-72 border-l border-zinc-800 bg-zinc-950 flex flex-col">
          <div className="px-4 py-2 border-b border-zinc-800 font-display text-2xl leading-none tracking-wide text-zinc-400">
            Live standings
          </div>
          <div className="flex-1 overflow-y-auto">
            {hud.rows.map((row) => (
              <div key={row.carId} className="flex items-center gap-2.5 px-4 py-2.5 border-b border-zinc-900 text-sm">
                <span className="w-5 text-zinc-500 font-semibold tabular-nums">{row.position}</span>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: row.color }} />
                <div className="flex-1 min-w-0">
                  <div className="truncate leading-tight">{row.name}</div>
                  <div className="text-[11px] text-zinc-500 tabular-nums">
                    {row.finished ? 'Finished' : `Lap ${row.lap} · ${Math.round(row.speedKmh)} km/h`}
                  </div>
                </div>
                <span className="text-xs text-zinc-400 tabular-nums">
                  {row.position === 1 ? 'Leader' : formatGap(row.gap, row.lapsBehind)}
                </span>
              </div>
            ))}
          </div>

          {/* Playback controls */}
          <div className="border-t border-zinc-800 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPlaying((p) => !p)}
                className="flex-1 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm font-medium transition-colors">
                {playing ? '❚❚ Pause' : '▶ Play'}
              </button>
              <button onClick={restart}
                className="py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-sm transition-colors">
                ↺
              </button>
            </div>
            <div>
              <div className="text-[11px] text-zinc-500 mb-1.5">Playback speed</div>
              <div className="grid grid-cols-6 gap-1">
                {SPEED_OPTIONS.map((s) => (
                  <button key={s} onClick={() => setSpeed(s)}
                    className={`py-1 rounded text-xs tabular-nums transition-colors ${
                      speed === s ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}>
                    {s}×
                  </button>
                ))}
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full bg-red-600 transition-[width] duration-200"
                style={{ width: `${Math.min(100, (hud.t / race.timeline.duration) * 100)}%` }} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
