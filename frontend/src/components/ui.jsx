// Small shared UI pieces for the setup pages: search box, filter chips,
// segmented view toggle and the primary CTA button. All animated with motion.
import { motion, AnimatePresence } from 'motion/react';

export function SearchBox({ value, onChange, placeholder }) {
  return (
    <label className="relative flex-1 min-w-[200px]">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-line/40 bg-bg-deep/70 pl-9 pr-9 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-highlight/70 focus:ring-2 focus:ring-highlight/20 transition-colors"
      />
      <AnimatePresence>
        {value && (
          <motion.button
            type="button"
            key="clear"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            onClick={() => onChange('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-muted hover:text-ink hover:bg-line/30 transition-colors text-sm"
          >
            ×
          </motion.button>
        )}
      </AnimatePresence>
    </label>
  );
}

/** A row of toggle chips. `layoutId` gives the active pill a sliding highlight. */
export function ChipGroup({ options, value, onChange, layoutId, label }) {
  return (
    <div className="flex items-center gap-1 flex-wrap" role="group" aria-label={label}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`relative px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              active ? 'text-highlight-fg' : 'text-ink/70 hover:text-ink'
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full bg-highlight"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
            <span className="relative z-10">
              {opt.label}
              {opt.count != null && (
                <span className={`ml-1 tabular-nums ${active ? 'text-highlight-fg/60' : 'text-muted'}`}>{opt.count}</span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ViewToggle({ value, onChange }) {
  const options = [
    { value: 'cards', label: 'Cards', icon: 'M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z' },
    { value: 'table', label: 'Table', icon: 'M4 6h16M4 12h16M4 18h16' },
  ];
  return (
    <div className="flex rounded-lg border border-line/40 bg-bg-deep/70 p-0.5" role="group" aria-label="View">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              active ? 'text-ink' : 'text-muted hover:text-ink'
            }`}
            aria-pressed={active}
          >
            {active && (
              <motion.span
                layoutId="view-toggle"
                className="absolute inset-0 rounded-md bg-line/50"
                transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
            <svg className="relative z-10 w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d={opt.icon} />
            </svg>
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function SortSelect({ value, onChange, options }) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      Sort
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-line/40 bg-bg-deep/70 px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-highlight/70"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function PrimaryButton({ children, disabled, onClick, className = '', type = 'button' }) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.03, y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`relative overflow-hidden px-10 py-2.5 rounded-xl font-display text-2xl leading-none tracking-wide transition-colors ${
        disabled
          ? 'bg-line/20 text-muted cursor-not-allowed border border-line/30'
          : 'bg-accent hover:bg-accent-hover text-accent-fg shadow-lg shadow-accent/30 border border-accent-hover/40'
      } ${className}`}
    >
      {!disabled && (
        <motion.span
          aria-hidden
          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-accent-fg/20 to-transparent"
          initial={{ x: '-150%' }}
          animate={{ x: '400%' }}
          transition={{ repeat: Infinity, repeatDelay: 2.5, duration: 1.1, ease: 'easeInOut' }}
        />
      )}
      <span className="relative">{children}</span>
    </motion.button>
  );
}

/** Outlined secondary action, sized to sit beside PrimaryButton. */
export function SecondaryButton({ children, onClick, className = '' }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.03, x: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`px-6 py-2.5 rounded-xl font-display text-xl leading-none tracking-wide border border-line bg-surface text-ink hover:border-ink/60 hover:bg-surface-2 transition-colors ${className}`}
    >
      {children}
    </motion.button>
  );
}

export function GhostButton({ children, onClick, className = '' }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ x: -2 }}
      whileTap={{ scale: 0.97 }}
      className={`text-sm text-ink/60 hover:text-ink transition-colors ${className}`}
    >
      {children}
    </motion.button>
  );
}

export function EmptyState({ title, hint, onReset }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="col-span-full rounded-xl border border-dashed border-line/40 py-14 text-center"
    >
      <div className="font-display text-xl leading-none">{title}</div>
      <p className="text-sm text-ink/50 mt-1">{hint}</p>
      {onReset && (
        <button onClick={onReset} className="mt-4 text-sm text-highlight hover:text-highlight-soft underline underline-offset-4">
          Reset filters
        </button>
      )}
    </motion.div>
  );
}
