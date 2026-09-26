// Detailed stats card for one car (stock or custom build): Forza-style 0-10
// ratings plus the measured figures behind them. Opened from the car picker.
// The numbers come from the backend's physics (sim/performance.js).
import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { PrimaryButton, SecondaryButton } from './ui.jsx';

const spring = { type: 'spring', stiffness: 420, damping: 32 };

const RATINGS = [
  { key: 'speed', label: 'Speed', hint: 'Top speed' },
  { key: 'handling', label: 'Handling', hint: 'Cornering grip at 60 and 120 mph' },
  { key: 'acceleration', label: 'Acceleration', hint: '0 to 100 mph' },
  { key: 'launch', label: 'Launch', hint: '0 to 60 mph' },
  { key: 'braking', label: 'Braking', hint: '60 to 0 mph stopping distance' },
  { key: 'offroad', label: 'Offroad', hint: 'Estimated from drivetrain, ride height, tires, suspension and weight' },
];

function RatingBar({ label, hint, value, index }) {
  return (
    <div title={hint}>
      <div className="flex items-baseline justify-between mb-1">
        <span className="font-display text-lg leading-none">{label}</span>
        <span className="font-display text-lg leading-none tabular-nums">{value.toFixed(1)}</span>
      </div>
      <div className="h-2 rounded-full bg-line/25 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-line to-highlight"
          initial={{ width: 0 }}
          animate={{ width: `${value * 10}%` }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 + index * 0.05 }}
        />
      </div>
    </div>
  );
}

function Figure({ label, value, unit }) {
  return (
    <div className="rounded-lg border border-line/25 bg-bg-deep/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-ink/45 leading-none">{label}</div>
      <div className="mt-1.5 tabular-nums leading-none">
        <span className="text-lg text-ink">{value}</span>
        {unit && <span className="ml-1 text-xs text-ink/45">{unit}</span>}
      </div>
    </div>
  );
}

export default function CarDetail({ car, selected, canAdd, onToggle, onClose }) {
  const closeRef = useRef(null);
  const { ratings, stats } = car.performance;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-bg-deep/75 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="car-detail-title"
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={spring}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto scroll-thin rounded-2xl border border-line/40 bg-surface shadow-2xl shadow-bg-deep/60"
      >
        <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-br from-highlight/10 via-transparent to-transparent" />

        {/* Header */}
        <div className="relative flex items-start justify-between gap-4 px-6 pt-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h2 id="car-detail-title" className="font-display text-3xl leading-none truncate">{car.name}</h2>
              {car.custom && (
                <span className="shrink-0 translate-y-0.5 rounded px-1 py-px border border-highlight-soft/50 text-highlight-soft text-[11px] leading-tight">
                  Custom
                </span>
              )}
            </div>
            <p className="mt-1.5 text-xs uppercase tracking-wider text-ink/50">
              {car.custom ? <span className="normal-case tracking-normal">{car.baseName}</span> : <>{car.class} · {car.year} · {car.country}</>}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 w-9 h-9 rounded-full border border-line/40 text-ink/60 hover:text-ink hover:border-ink/60 transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Ratings */}
        <div className="relative px-6 pt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          {RATINGS.map((r, i) => (
            <RatingBar key={r.key} label={r.label} hint={r.hint} value={ratings[r.key]} index={i} />
          ))}
        </div>

        {/* Measured figures */}
        <div className="relative px-6 pt-6">
          <h3 className="text-[11px] uppercase tracking-widest text-ink/40 mb-2">Details</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Figure label="Top speed" value={stats.topSpeedKmh} unit="km/h" />
            <Figure label="0 to 60 mph" value={stats.zeroTo60.toFixed(2)} unit="s" />
            <Figure label="0 to 100 mph" value={stats.zeroTo100.toFixed(2)} unit="s" />
            <Figure label="60 to 0 mph" value={stats.braking60} unit="ft" />
            <Figure label="100 to 0 mph" value={stats.braking100} unit="ft" />
            <Figure label="Lateral g at 60 mph" value={stats.lateralG60.toFixed(2)} unit="g" />
            <Figure label="Lateral g at 120 mph" value={stats.lateralG120.toFixed(2)} unit="g" />
            <Figure label="Weight" value={car.mass.toLocaleString()} unit="kg" />
            <Figure label="Power" value={car.hp.toLocaleString()} unit="hp" />
            <Figure label="Torque" value={car.torque?.toLocaleString() ?? '-'} unit="lb-ft" />
            <Figure label="Drivetrain" value={car.drive} />
          </div>
        </div>

        {/* Footer */}
        <div className="relative px-6 py-6 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-[11px] text-ink/40 max-w-xs">
            Offroad is an estimate. Races run on tarmac only.
          </p>
          <div className="flex items-center gap-3 ml-auto">
            {selected ? (
              <SecondaryButton onClick={onToggle}>Remove from grid</SecondaryButton>
            ) : (
              <PrimaryButton onClick={onToggle} disabled={!canAdd} className="px-6! text-xl!">
                {canAdd ? 'Add to grid' : 'Grid full'}
              </PrimaryButton>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
