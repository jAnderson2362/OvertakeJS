import { useMemo, useState } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import StepHeader from '../components/StepHeader.jsx';
import CarDetail from '../components/CarDetail.jsx';
import {
  SearchBox, ChipGroup, ViewToggle, SortSelect, PrimaryButton, EmptyState,
} from '../components/ui.jsx';

export const MAX_CARS = 8;
export const MIN_CARS = 2;

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'hp', label: 'Power' },
  { value: 'torque', label: 'Torque' },
  { value: 'hpPerTonne', label: 'Power to weight' },
  { value: 'mass', label: 'Weight' },
  { value: 'topSpeed', label: 'Top speed' },
  { value: 'tireGrip', label: 'Grip' },
  { value: 'year', label: 'Year' },
];

// Columns for the table view. `numeric` columns sort descending first.
const COLUMNS = [
  { key: 'name', label: 'Car' },
  { key: 'class', label: 'Class' },
  { key: 'hp', label: 'hp', numeric: true },
  { key: 'torque', label: 'lb-ft', numeric: true },
  { key: 'mass', label: 'kg', numeric: true },
  { key: 'hpPerTonne', label: 'hp/t', numeric: true },
  { key: 'topSpeed', label: 'km/h', numeric: true },
  { key: 'tireGrip', label: 'Grip', numeric: true, format: (v) => v.toFixed(2) },
  { key: 'drive', label: 'Drive' },
];

const spring = { type: 'spring', stiffness: 420, damping: 32 };

const decorate = (car) => ({
  ...car,
  hpPerTonne: Math.round((car.powerToWeight ?? car.hp / car.mass) * 1000),
});

function matches(car, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return [car.name, car.class, car.drive, car.country, String(car.year), car.ev ? 'ev electric' : '']
    .some((s) => s && s.toLowerCase().includes(q));
}

/* ---------- Card view ---------- */

function StatBar({ label, value, max, unit }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between text-[11px] leading-none mb-1">
        <span className="text-ink/50">{label}</span>
        <span className="tabular-nums text-ink">{value}<span className="text-ink/40 ml-0.5">{unit}</span></span>
      </div>
      <div className="h-1 rounded-full bg-line/25 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-line to-highlight"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, (value / max) * 100)}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

/** "Stats" pill that opens the detail card without toggling selection. */
function StatsButton({ onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onKeyDown={(e) => e.stopPropagation()}
      className={`group/stats inline-flex items-center gap-1.5 h-8 rounded-full border border-line bg-bg-deep/60 pl-2.5 pr-3 text-xs font-medium text-ink hover:bg-highlight hover:border-highlight hover:text-highlight-fg transition-colors ${className}`}
    >
      <svg
        className="w-3.5 h-3.5 text-highlight-soft group-hover/stats:text-highlight-fg transition-colors"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
        aria-hidden
      >
        <path d="M5 20v-6M12 20V4M19 20v-10" />
      </svg>
      Stats
    </button>
  );
}

// The card is a div with button semantics (not a <button>) so it can hold
// the Stats button inside it.
function CarCard({ car, slot, disabled, onToggle, onStats, maxima }) {
  const selected = slot != null;
  const onKeyDown = (e) => {
    if (disabled || e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); }
  };
  return (
    <motion.div
      layout
      role="button"
      tabIndex={disabled ? -1 : 0}
      initial={{ opacity: 0, scale: 0.92, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -8, transition: { duration: 0.15 } }}
      transition={spring}
      whileHover={disabled ? undefined : { y: -4 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      onClick={disabled ? undefined : onToggle}
      onKeyDown={onKeyDown}
      aria-pressed={selected}
      aria-disabled={disabled}
      className={`relative text-left rounded-xl border p-4 overflow-hidden transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-highlight/60 ${
        selected
          ? 'border-highlight/80 bg-accent/25 shadow-xl shadow-accent/20 cursor-pointer'
          : disabled
            ? 'border-line/20 bg-surface/30 opacity-40 cursor-not-allowed'
            : 'border-line/35 bg-surface/60 hover:border-line hover:bg-surface cursor-pointer'
      }`}
    >
      {/* Selected glow sweep */}
      <AnimatePresence>
        {selected && (
          <motion.span
            key="glow"
            aria-hidden
            className="absolute inset-0 pointer-events-none bg-gradient-to-br from-highlight/15 via-transparent to-accent/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          {/* The Custom badge flows inline after the last word, so long names wrap. */}
          <div className="font-display text-xl leading-tight line-clamp-2">
            {car.name}
            {car.custom && (
              <span className="ml-2 inline-block align-middle -translate-y-px rounded px-1 py-px border border-highlight-soft/50 text-highlight-soft font-sans text-[11px] leading-tight">
                Custom
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] uppercase tracking-wider text-ink/50 min-w-0">
            {car.custom ? (
              <span className="truncate normal-case tracking-normal">{car.baseName}</span>
            ) : (
              <>
                <span>{car.class}</span>
                <span className="text-muted">·</span>
                <span>{car.year}</span>
              </>
            )}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <StatsButton onClick={onStats} />
          <AnimatePresence mode="popLayout" initial={false}>
            {selected ? (
              <motion.span
                key="slot"
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 90 }}
                transition={spring}
                className="shrink-0 w-8 h-8 rounded-full bg-highlight text-highlight-fg font-display text-lg leading-none flex items-center justify-center shadow-md shadow-highlight/30"
                title={`Grid slot ${slot + 1}`}
              >
                {slot + 1}
              </motion.span>
            ) : (
              <motion.span
                key="plus"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="shrink-0 w-8 h-8 rounded-full border border-line/50 text-muted flex items-center justify-center text-lg"
              >
                +
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5">
        <StatBar label="Power" value={car.hp} max={maxima.hp} unit="hp" />
        <StatBar label="Torque" value={car.torque} max={maxima.torque} unit="lb-ft" />
        <StatBar label="Top speed" value={car.topSpeed} max={maxima.topSpeed} unit="km/h" />
        <StatBar label="Grip" value={car.tireGrip.toFixed(2)} max={maxima.tireGrip} unit="g" />
      </div>

      <div className="relative mt-3 flex items-center justify-between text-[11px] text-ink/50">
        <span><span className="text-ink tabular-nums">{car.mass}</span> kg</span>
        <span className="uppercase tracking-wider">{car.drive}</span>
      </div>
    </motion.div>
  );
}

/* ---------- Table view ---------- */

function CarTable({ cars, slotOf, disabled, onToggle, onStats, sort, onSort }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-line/35 bg-surface/50 overflow-hidden"
    >
      <div className="overflow-x-auto scroll-thin">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-ink/50 bg-bg-deep/60">
            <tr>
              <th className="w-12 px-3 py-2.5 text-left font-medium">#</th>
              {COLUMNS.map((col) => {
                const active = sort.key === col.key;
                return (
                  <th key={col.key} className={`px-3 py-2.5 font-medium ${col.numeric ? 'text-right' : 'text-left'}`}>
                    <button
                      type="button"
                      onClick={() => onSort(col.key)}
                      className={`inline-flex items-center gap-1 hover:text-ink transition-colors ${active ? 'text-highlight' : ''}`}
                    >
                      {col.label}
                      <span className={`text-[9px] transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`}>
                        {sort.dir === 'asc' ? '▲' : '▼'}
                      </span>
                    </button>
                  </th>
                );
              })}
              <th className="px-3 py-2.5"><span className="sr-only">Details</span></th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {cars.map((car) => {
                const slot = slotOf(car.id);
                const selected = slot != null;
                const rowDisabled = disabled && !selected;
                return (
                  <motion.tr
                    key={car.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: rowDisabled ? 0.4 : 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    onClick={() => !rowDisabled && onToggle(car.id)}
                    aria-selected={selected}
                    className={`border-t border-line/20 transition-colors ${
                      selected
                        ? 'bg-accent/25'
                        : rowDisabled
                          ? 'cursor-not-allowed'
                          : 'cursor-pointer hover:bg-line/15'
                    }`}
                  >
                    <td className="px-3 py-2">
                      {selected ? (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={spring}
                          className="inline-flex w-6 h-6 rounded-full bg-highlight text-highlight-fg font-display text-base leading-none items-center justify-center"
                        >
                          {slot + 1}
                        </motion.span>
                      ) : (
                        <span className="inline-flex w-6 h-6 rounded-full border border-line/40" />
                      )}
                    </td>
                    {COLUMNS.map((col) => (
                      <td
                        key={col.key}
                        className={`px-3 py-2 whitespace-nowrap ${col.numeric ? 'text-right tabular-nums' : ''} ${
                          col.key === 'name' ? 'font-display text-lg leading-none' : col.key === 'class' ? 'text-ink/60' : ''
                        }`}
                      >
                        {col.format ? col.format(car[col.key]) : car[col.key]}
                        {col.key === 'drive' && car.ev && <span className="ml-1.5 text-highlight text-[10px]">EV</span>}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right">
                      <StatsButton onClick={() => onStats(car.id)} />
                    </td>
                  </motion.tr>
                );
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

/* ---------- Selected grid tray ---------- */

function GridTray({ cars, selected, onRemove, onClear, onNext, ready }) {
  const byId = useMemo(() => Object.fromEntries(cars.map((c) => [c.id, c])), [cars]);
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ ...spring, delay: 0.15 }}
      className="sticky bottom-4 z-20 mt-8"
    >
      <div className="rounded-2xl border border-line/40 bg-bg-deep/85 backdrop-blur-md shadow-2xl shadow-bg-deep/60 px-4 py-3 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="shrink-0">
            <div className="font-display text-lg leading-none">Your grid</div>
            <div className="flex items-center gap-1 mt-1">
              {Array.from({ length: MAX_CARS }, (_, i) => (
                <motion.span
                  key={i}
                  className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                    i < selected.length ? 'bg-highlight' : 'bg-line/40'
                  }`}
                  animate={{ scale: i === selected.length - 1 ? [1, 1.5, 1] : 1 }}
                  transition={{ duration: 0.35 }}
                />
              ))}
              <span className="ml-1.5 text-[11px] text-ink/50 tabular-nums">
                {selected.length}/{MAX_CARS}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <LayoutGroup>
              <AnimatePresence initial={false}>
                {selected.length === 0 ? (
                  <motion.span
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-sm text-ink/40"
                  >
                    Pick at least {MIN_CARS} cars to race.
                  </motion.span>
                ) : (
                  selected.map((id, i) => (
                    <motion.span
                      key={id}
                      layout
                      initial={{ opacity: 0, scale: 0.6, x: -10 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.12 } }}
                      transition={spring}
                      className="group flex items-center gap-1.5 rounded-full border border-highlight/40 bg-accent/30 pl-1 pr-2 py-0.5 text-xs"
                    >
                      <span className="w-5 h-5 rounded-full bg-highlight text-highlight-fg font-display text-lg leading-none flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="max-w-[140px] truncate">{byId[id]?.name ?? id}</span>
                      <button
                        type="button"
                        onClick={() => onRemove(id)}
                        aria-label={`Remove ${byId[id]?.name ?? id}`}
                        className="ml-0.5 text-ink/40 hover:text-ink transition-colors"
                      >
                        ×
                      </button>
                    </motion.span>
                  ))
                )}
              </AnimatePresence>
            </LayoutGroup>
          </div>
        </div>

        <div className="flex items-center gap-4 ml-auto">
          <AnimatePresence>
            {selected.length > 0 && (
              <motion.button
                key="clear"
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClear}
                className="text-sm text-ink/50 hover:text-ink transition-colors"
              >
                Clear
              </motion.button>
            )}
          </AnimatePresence>
          <PrimaryButton onClick={onNext} disabled={!ready}>
            Choose circuit
          </PrimaryButton>
        </div>
      </div>
    </motion.div>
  );
}

/* ---------- Page ---------- */

export default function CarsPage({ cars, selected, onChange, onNext }) {
  const [query, setQuery] = useState('');
  const [carClass, setCarClass] = useState('all');
  const [drive, setDrive] = useState('all');
  const [view, setView] = useState('cards');
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const [detailId, setDetailId] = useState(null); // car whose stats card is open

  const all = useMemo(() => cars.map(decorate), [cars]);
  const detailCar = all.find((c) => c.id === detailId);

  const maxima = useMemo(() => ({
    hp: Math.max(...all.map((c) => c.hp)),
    torque: Math.max(...all.map((c) => c.torque)),
    topSpeed: Math.max(...all.map((c) => c.topSpeed)),
    tireGrip: Math.max(...all.map((c) => c.tireGrip)),
  }), [all]);

  const classOptions = useMemo(() => {
    const counts = new Map();
    for (const c of all) counts.set(c.class, (counts.get(c.class) ?? 0) + 1);
    return [
      { value: 'all', label: 'All', count: all.length },
      ...[...counts.entries()].sort().map(([value, count]) => ({ value, label: value, count })),
    ];
  }, [all]);

  const driveOptions = useMemo(() => {
    const drives = [...new Set(all.map((c) => c.drive))].sort();
    return [{ value: 'all', label: 'Any drive' }, ...drives.map((d) => ({ value: d, label: d }))];
  }, [all]);

  const visible = useMemo(() => {
    const list = all.filter(
      (c) => matches(c, query) && (carClass === 'all' || c.class === carClass) && (drive === 'all' || c.drive === drive),
    );
    const dir = sort.dir === 'asc' ? 1 : -1;
    // The player's own custom builds stay at the top under any sort.
    return list.sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return (b.custom ? 1 : 0) - (a.custom ? 1 : 0) || cmp * dir || a.name.localeCompare(b.name);
    });
  }, [all, query, carClass, drive, sort]);

  const slotOf = (id) => { const i = selected.indexOf(id); return i === -1 ? null : i; };
  const full = selected.length >= MAX_CARS;

  const toggle = (id) =>
    onChange(
      selected.includes(id)
        ? selected.filter((c) => c !== id)
        : full ? selected : [...selected, id],
    );

  // Table headers toggle direction; the sort dropdown picks a sensible default
  // direction (numbers high to low, text A to Z).
  const sortByColumn = (key) =>
    setSort((s) => {
      if (s.key === key) return { key, dir: s.dir === 'asc' ? 'desc' : 'asc' };
      const numeric = COLUMNS.find((c) => c.key === key)?.numeric;
      return { key, dir: numeric ? 'desc' : 'asc' };
    });
  const sortByOption = (key) => setSort({ key, dir: key === 'name' ? 'asc' : 'desc' });

  const resetFilters = () => { setQuery(''); setCarClass('all'); setDrive('all'); };
  const filtered = query || carClass !== 'all' || drive !== 'all';
  const ready = selected.length >= MIN_CARS;

  return (
    <div className="max-w-6xl mx-auto px-6 pt-10 pb-6">
      <StepHeader step={1} />

      <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
        <div>
          <h2 className="font-display text-3xl leading-none">Choose your cars</h2>
          <p className="text-sm text-ink/50 mt-1">
            Pick {MIN_CARS} to {MAX_CARS} cars. The order you pick sets the starting grid.
          </p>
        </div>
        <div className="text-sm text-ink/50 tabular-nums">
          Showing <span className="text-ink">{visible.length}</span> of {all.length}
          {filtered && (
            <button onClick={resetFilters} className="ml-3 text-highlight hover:text-highlight-soft transition-colors">
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="sticky top-3 z-10 mb-5 rounded-xl border border-line/35 bg-bg-deep/80 backdrop-blur-md p-3 space-y-3"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <SearchBox value={query} onChange={setQuery} placeholder="Search by name, class, country or year" />
          <SortSelect value={sort.key} onChange={sortByOption} options={SORT_OPTIONS} />
          <ViewToggle value={view} onChange={setView} />
        </div>
        <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
          <ChipGroup options={classOptions} value={carClass} onChange={setCarClass} layoutId="class-chip" label="Class" />
          <span className="hidden sm:block w-px h-5 bg-line/40" />
          <ChipGroup options={driveOptions} value={drive} onChange={setDrive} layoutId="drive-chip" label="Drivetrain" />
        </div>
      </motion.div>

      {/* Results */}
      <AnimatePresence mode="wait" initial={false}>
        {view === 'cards' ? (
          <motion.div
            key="cards"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
          >
            <AnimatePresence mode="popLayout">
              {visible.length === 0 ? (
                <EmptyState
                  key="empty"
                  title="No cars match"
                  hint="Try a different search or clear the filters."
                  onReset={resetFilters}
                />
              ) : (
                visible.map((car) => (
                  <CarCard
                    key={car.id}
                    car={car}
                    slot={slotOf(car.id)}
                    disabled={full && slotOf(car.id) == null}
                    onToggle={() => toggle(car.id)}
                    onStats={() => setDetailId(car.id)}
                    maxima={maxima}
                  />
                ))
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div
            key="table"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
          >
            {visible.length === 0 ? (
              <div className="grid">
                <EmptyState title="No cars match" hint="Try a different search or clear the filters." onReset={resetFilters} />
              </div>
            ) : (
              <CarTable
                cars={visible}
                slotOf={slotOf}
                disabled={full}
                onToggle={toggle}
                onStats={setDetailId}
                sort={sort}
                onSort={sortByColumn}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <GridTray
        cars={all}
        selected={selected}
        onRemove={(id) => onChange(selected.filter((c) => c !== id))}
        onClear={() => onChange([])}
        onNext={onNext}
        ready={ready}
      />

      <AnimatePresence>
        {detailCar && (
          <CarDetail
            key="detail"
            car={detailCar}
            selected={slotOf(detailCar.id) != null}
            canAdd={!full}
            onToggle={() => toggle(detailCar.id)}
            onClose={() => setDetailId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
