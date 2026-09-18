import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import StepHeader from '../components/StepHeader.jsx';
import TrackMap from '../components/TrackMap.jsx';
import { SearchBox, ChipGroup, SortSelect, PrimaryButton, SecondaryButton, GhostButton, EmptyState } from '../components/ui.jsx';

const LAP_OPTIONS = [3, 5, 8, 10, 15, 20];

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'length', label: 'Length' },
  { value: 'width', label: 'Width' },
];

const spring = { type: 'spring', stiffness: 420, damping: 32 };

// Circuit type is inferred from the location blurb so the seed data stays as is.
function circuitKind(track) {
  const s = `${track.location} ${track.name}`.toLowerCase();
  if (s.includes('oval') || s.includes('speedway')) return 'Oval';
  if (s.includes('street')) return 'Street';
  return 'Road course';
}

const km = (m) => (m / 1000).toFixed(2);

function matches(track, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return [track.name, track.location, track.description, track.kind]
    .some((s) => s && s.toLowerCase().includes(q));
}

/* ---------- List item ---------- */

function TrackRow({ track, active, onSelect }) {
  return (
    <motion.button
      layout
      type="button"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12, transition: { duration: 0.15 } }}
      transition={spring}
      whileHover={{ x: 3 }}
      whileTap={{ scale: 0.99 }}
      onClick={onSelect}
      aria-pressed={active}
      className={`relative w-full text-left rounded-xl border p-3 flex items-center gap-3 transition-colors ${
        active
          ? 'border-highlight/80 bg-accent/25 shadow-lg shadow-accent/15'
          : 'border-line/35 bg-surface/60 hover:border-line hover:bg-surface'
      }`}
    >
      {active && (
        <motion.span
          layoutId="track-active-bar"
          className="absolute left-0 top-3 bottom-3 w-1 rounded-r bg-highlight"
          transition={spring}
        />
      )}
      <div className={`shrink-0 w-20 h-16 rounded-lg flex items-center justify-center ${active ? 'bg-bg-deep/60' : 'bg-bg-deep/40'}`}>
        <TrackMap path={track.path} className={`w-16 h-12 transition-colors ${active ? 'text-highlight' : 'text-muted'}`} strokeWidth={2.5} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-display text-xl leading-none truncate">{track.name}</div>
        <div className="text-xs text-ink/50 mt-0.5 truncate">{track.location}</div>
        <div className="mt-1.5 flex items-center gap-2 text-[11px]">
          <span className="rounded-full px-2 py-px bg-line/30 text-ink/70">{track.kind}</span>
          <span className="tabular-nums text-ink/60">{km(track.length)} km</span>
        </div>
      </div>
    </motion.button>
  );
}

/* ---------- Preview panel ---------- */

function Stat({ label, value, unit }) {
  return (
    <div className="rounded-lg bg-bg-deep/50 border border-line/25 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-ink/45">{label}</div>
      <div className="font-display text-xl leading-none mt-0.5 tabular-nums">
        {value}<span className="text-ink/40 text-sm ml-1">{unit}</span>
      </div>
    </div>
  );
}

function TrackPreview({ track, laps }) {
  return (
    <div className="rounded-2xl border border-line/35 bg-surface/50 overflow-hidden">
      <div className="relative aspect-[4/3] bg-bg-deep/60 border-b border-line/25">
        <div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: 'linear-gradient(color-mix(in oklab, var(--line) 35%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklab, var(--line) 35%, transparent) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <AnimatePresence mode="wait">
          {track ? (
            <motion.div
              key={track.id}
              className="absolute inset-0 p-6"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02, transition: { duration: 0.15 } }}
              transition={{ duration: 0.3 }}
            >
              <TrackMap path={track.path} className="w-full h-full text-highlight drop-shadow-[0_0_12px_var(--highlight-glow)]"
                strokeWidth={4} animate />
            </motion.div>
          ) : (
            <motion.div key="none" className="absolute inset-0 flex items-center justify-center text-ink/40 text-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              Select a circuit to preview it
            </motion.div>
          )}
        </AnimatePresence>
        {track && (
          <span className="absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] bg-bg-deep/80 border border-line/40 text-ink/70">
            {track.kind}
          </span>
        )}
      </div>

      <AnimatePresence mode="wait">
        {track && (
          <motion.div
            key={track.id}
            className="p-5"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
            transition={{ duration: 0.25, delay: 0.05 }}
          >
            <div className="font-display text-3xl leading-none">{track.name}</div>
            <div className="text-sm text-ink/50 mt-1">{track.location}</div>
            <p className="text-sm text-ink/70 leading-relaxed mt-3">{track.description}</p>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <Stat label="Lap length" value={km(track.length)} unit="km" />
              <Stat label="Track width" value={track.width} unit="m" />
              <Stat label="Race distance" value={km(track.length * laps)} unit="km" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Page ---------- */

export default function TrackPage({
  tracks, trackId, onTrackChange, laps, onLapsChange,
  selectedCount, onBack, onSimulate, simulating, error,
}) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [sortKey, setSortKey] = useState('name');

  const all = useMemo(() => tracks.map((t) => ({ ...t, kind: circuitKind(t) })), [tracks]);

  const kindOptions = useMemo(() => {
    const counts = new Map();
    for (const t of all) counts.set(t.kind, (counts.get(t.kind) ?? 0) + 1);
    return [
      { value: 'all', label: 'All', count: all.length },
      ...[...counts.entries()].sort().map(([value, count]) => ({ value, label: value, count })),
    ];
  }, [all]);

  const visible = useMemo(() => {
    const list = all.filter((t) => matches(t, query) && (kind === 'all' || t.kind === kind));
    return list.sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name);
      return b[sortKey] - a[sortKey] || a.name.localeCompare(b.name);
    });
  }, [all, query, kind, sortKey]);

  const current = all.find((t) => t.id === trackId) ?? null;
  const filtered = query || kind !== 'all';
  const resetFilters = () => { setQuery(''); setKind('all'); };
  const ready = Boolean(trackId) && !simulating;

  return (
    <div className="max-w-6xl mx-auto px-6 pt-10 pb-6">
      <StepHeader step={2} />

      <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
        <div>
          <h2 className="font-display text-3xl leading-none">Choose circuit</h2>
          <p className="text-sm text-ink/50 mt-1">
            Where the grid of {selectedCount} will race. Pick a circuit and a race distance.
          </p>
        </div>
        <GhostButton onClick={onBack}>Change cars ({selectedCount} selected)</GhostButton>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-6 items-start">
        {/* Left: search + scrolling list */}
        <div className="space-y-3">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            className="rounded-xl border border-line/35 bg-bg-deep/80 backdrop-blur-md p-3 space-y-3"
          >
            <div className="flex items-center gap-3 flex-wrap">
              <SearchBox value={query} onChange={setQuery} placeholder="Search circuits" />
              <SortSelect value={sortKey} onChange={setSortKey} options={SORT_OPTIONS} />
            </div>
            <ChipGroup options={kindOptions} value={kind} onChange={setKind} layoutId="kind-chip" label="Circuit type" />
          </motion.div>

          <div className="flex items-center justify-between text-xs text-ink/50 px-1 tabular-nums">
            <span>Showing <span className="text-ink">{visible.length}</span> of {all.length}</span>
            {filtered && (
              <button onClick={resetFilters} className="text-highlight hover:text-highlight-soft transition-colors">Reset</button>
            )}
          </div>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto scroll-thin pr-1 -mr-1">
            <AnimatePresence mode="popLayout">
              {visible.length === 0 ? (
                <EmptyState key="empty" title="No circuits match" hint="Try a different search." onReset={resetFilters} />
              ) : (
                visible.map((track) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    active={track.id === trackId}
                    onSelect={() => onTrackChange(track.id)}
                  />
                ))
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right: preview + race distance */}
        <div className="lg:sticky lg:top-4 space-y-4">
          <TrackPreview track={current} laps={laps} />

          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.2 }}
            className="rounded-2xl border border-line/35 bg-surface/50 p-4"
          >
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="font-display text-xl leading-none">Race distance</h3>
              <span className="text-xs text-ink/50 tabular-nums">
                {current ? `${laps} laps · ${km(current.length * laps)} km` : `${laps} laps`}
              </span>
            </div>
            <div className="grid grid-cols-6 gap-1.5 rounded-lg bg-bg-deep/60 p-1">
              {LAP_OPTIONS.map((n) => {
                const active = laps === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onLapsChange(n)}
                    className={`relative py-2 rounded-md text-sm tabular-nums transition-colors ${
                      active ? 'text-highlight-fg font-bold' : 'text-ink/70 hover:text-ink'
                    }`}
                    aria-pressed={active}
                  >
                    {active && (
                      <motion.span layoutId="laps-pill" className="absolute inset-0 rounded-md bg-highlight" transition={spring} />
                    )}
                    <span className="relative z-10">{n}</span>
                  </button>
                );
              })}
            </div>
          </motion.section>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6 rounded-lg border border-accent bg-accent/20 px-4 py-3 text-sm text-ink"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...spring, delay: 0.15 }}
        className="sticky bottom-4 z-20 mt-8"
      >
        <div className="rounded-2xl border border-line/40 bg-bg-deep/85 backdrop-blur-md shadow-2xl shadow-bg-deep/60 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <SecondaryButton onClick={onBack}>Back to cars</SecondaryButton>
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm text-ink/60">
              {current ? (
                <>
                  <span className="text-ink">{current.name}</span> · {laps} laps · {selectedCount} cars
                </>
              ) : 'No circuit selected'}
            </span>
            <PrimaryButton onClick={onSimulate} disabled={!ready}>
              {simulating ? 'Crunching the numbers...' : 'Simulate race'}
            </PrimaryButton>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
