// Small pieces shared by the multiplayer lobby and room pages.
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import TrackMap from '../components/TrackMap.jsx';
import { useMultiplayer } from './connection.jsx';

export const LAP_OPTIONS = [3, 5, 8, 10];

// Same order as the simulator's colours (backend/sim/race.js COLORS): the
// nth driver to join races in the nth colour.
export const RACE_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#f97316', '#06b6d4', '#ec4899'];

const spring = { type: 'spring', stiffness: 420, damping: 32 };
const km = (m) => (m / 1000).toFixed(2);

export function ConnectionPill() {
  const { status } = useMultiplayer();
  const label = { open: 'Connected', connecting: 'Connecting', reconnecting: 'Reconnecting', signedout: 'Signed out' }[status];
  const ok = status === 'open';
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line/40 bg-bg-deep/70 px-3 py-1.5 text-xs text-ink/70">
      <span className={`w-2 h-2 rounded-full ${ok ? 'bg-ink' : 'bg-highlight-soft animate-pulse'}`} />
      {label}
    </span>
  );
}

/** Bottom toast for server errors and notices; fades out on its own. */
export function NoticeToast() {
  const { notice, clearNotice } = useMultiplayer();
  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(clearNotice, 4500);
    return () => clearTimeout(t);
  }, [notice, clearNotice]);
  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center pointer-events-none px-4">
      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice.id}
            role="status"
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={spring}
            className="pointer-events-auto max-w-md rounded-xl border border-danger/60 bg-bg-deep/95 backdrop-blur-md px-4 py-3 text-sm text-ink shadow-2xl shadow-bg-deep/60 flex items-start gap-3"
          >
            <span className="mt-1 w-2 h-2 shrink-0 rounded-full bg-highlight-soft" />
            <span className="flex-1">{notice.message}</span>
            <button type="button" onClick={clearNotice} aria-label="Dismiss" className="text-ink/40 hover:text-ink leading-none text-lg">
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Vertical list of circuits with a mini map each. */
export function TrackPicker({ tracks, value, onChange, disabled = false }) {
  return (
    <div className="space-y-2" role="radiogroup" aria-label="Circuit">
      {tracks.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(t.id)}
            className={`w-full text-left rounded-xl border p-2.5 flex items-center gap-3 transition-colors disabled:cursor-not-allowed ${
              active
                ? 'border-highlight/80 bg-accent/20'
                : 'border-line/35 bg-bg-deep/40 hover:border-line enabled:hover:bg-surface disabled:opacity-60'
            }`}
          >
            <span className="shrink-0 w-14 h-10 rounded-lg bg-bg-deep/60 flex items-center justify-center">
              <TrackMap path={t.path} className={`w-12 h-8 ${active ? 'text-highlight' : 'text-muted'}`} strokeWidth={2.5} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-lg leading-none truncate">{t.name}</span>
              <span className="block text-[11px] text-ink/50 mt-1 tabular-nums">{km(t.length)} km · {t.location}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function LapsPicker({ value, onChange, layoutId, disabled = false }) {
  return (
    <div className="grid grid-cols-4 gap-1.5 rounded-lg bg-bg-deep/60 p-1" role="radiogroup" aria-label="Laps">
      {LAP_OPTIONS.map((n) => {
        const active = value === n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(n)}
            className={`relative py-2 rounded-md text-sm tabular-nums transition-colors disabled:cursor-not-allowed ${
              active ? 'text-highlight-fg font-bold' : 'text-ink/70 enabled:hover:text-ink disabled:opacity-60'
            }`}
          >
            {active && <motion.span layoutId={layoutId} className="absolute inset-0 rounded-md bg-highlight" transition={spring} />}
            <span className="relative z-10">{n} laps</span>
          </button>
        );
      })}
    </div>
  );
}
