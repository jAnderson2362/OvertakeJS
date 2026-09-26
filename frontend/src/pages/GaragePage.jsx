// Garage: custom cars built from the player's cards. Pick an owned car card
// as the base, fit at most one part per sub-slot (grouped into categories:
// engine, platform, drivetrain, tires, aero, conversion), and watch the stats
// (including a lap simulated on the reference circuit) change before saving.
// One copy of a card sits in one build at a time; the server enforces the
// same rule. Categories and slots come from the card catalog.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  fetchCardCatalog, fetchMyCards, fetchGarage,
  previewBuild, createBuild, updateBuild, deleteBuild,
} from '../api.js';
import { useAuth } from '../auth.jsx';
import { RARITY_COLOR, RARITY_LABEL, PART_ICON } from '../components/TradingCard.jsx';
import { PrimaryButton, BackToSetup, ChipGroup } from '../components/ui.jsx';
import { formatLapTime } from '../utils/format.js';

const spring = { type: 'spring', stiffness: 420, damping: 32 };
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const rarityRank = (r) => RARITY_ORDER.indexOf(r);
const byRarityThenName = (a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || a.name.localeCompare(b.name);

// Which direction is an improvement, and how many decimals to show.
const STAT_ROWS = [
  { key: 'hp', label: 'Power', unit: 'hp', better: 'up' },
  { key: 'torque', label: 'Torque', unit: 'lb-ft', better: 'up' },
  { key: 'mass', label: 'Weight', unit: 'kg', better: 'down' },
  { key: 'hpPerTonne', label: 'Power to weight', unit: 'hp/t', better: 'up' },
  { key: 'zeroToHundred', label: '0 to 100 km/h', unit: 's', better: 'down', dp: 2 },
  { key: 'braking', label: '100 to 0 braking', unit: 'm', better: 'down', dp: 1 },
  { key: 'tireGrip', label: 'Tire grip', unit: 'g', better: 'up', dp: 3 },
  { key: 'cornering', label: 'Cornering', unit: '%', better: 'up' },
  { key: 'liftArea', label: 'Downforce', unit: 'm²', better: 'up', dp: 2 },
  { key: 'dragArea', label: 'Drag', unit: 'm²', better: 'down', dp: 3 },
  { key: 'topSpeed', label: 'Top speed', unit: 'km/h', better: 'up' },
];

const fmt = (v, dp = 0) => (dp ? v.toFixed(dp) : Math.round(v).toLocaleString());

/* ---------- Pieces ---------- */

function CategoryIcon({ category, color = 'currentColor', className = 'w-4 h-4' }) {
  return (
    <svg
      viewBox="0 0 24 24" className={className} fill="none" stroke={color}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden
    >
      {PART_ICON[category]}
    </svg>
  );
}

function SpareTag({ spare }) {
  return (
    <span className={`text-[10px] tabular-nums ${spare > 0 ? 'text-ink/45' : 'text-ink/30'}`}>
      {spare > 0 ? `${spare} spare` : 'In another build'}
    </span>
  );
}

function StatRow({ row, stock, tuned }) {
  const diff = tuned - stock;
  const changed = Math.abs(diff) >= 0.5 * 10 ** -(row.dp ?? 0);
  const better = (row.better === 'up') === (diff > 0);
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-line/15 last:border-0">
      <span className="text-sm text-ink/60">{row.label}</span>
      <span className="flex items-baseline gap-2 tabular-nums">
        {changed && (
          <motion.span
            key={diff}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`text-xs ${better ? 'text-highlight-soft' : 'text-ink/40'}`}
          >
            {diff > 0 ? '+' : '−'}{fmt(Math.abs(diff), row.dp)}
          </motion.span>
        )}
        <span className="text-ink">{fmt(tuned, row.dp)}</span>
        <span className="text-[11px] text-ink/40 w-9">{row.unit}</span>
      </span>
    </div>
  );
}

function BuildTile({ build, byId, categories, active, onEdit, index }) {
  const car = byId[build.carCardId];
  const tuned = build.stats?.tuned;
  return (
    <motion.button
      type="button"
      onClick={onEdit}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.04 * index }}
      whileHover={{ y: -2 }}
      aria-pressed={active}
      className={`text-left rounded-xl border p-4 transition-colors ${
        active ? 'border-highlight/70 bg-accent/15' : 'border-line/35 bg-surface/60 hover:border-highlight/50 hover:bg-surface'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-xl leading-none truncate">{build.name}</div>
          <div className="text-xs text-ink/50 mt-1 truncate">{car?.name ?? 'Unknown car'}</div>
        </div>
        {/* One badge per category: lit in its rarest fitted part's colour, with a count. */}
        <div className="flex gap-1 shrink-0">
          {categories.map((cat) => {
            const fitted = cat.slots.map((s) => byId[build.parts[s.id]]).filter(Boolean);
            const best = fitted.reduce((b, p) => (!b || rarityRank(p.rarity) > rarityRank(b.rarity) ? p : b), null);
            const color = best ? RARITY_COLOR[best.rarity] : 'var(--line)';
            return (
              <span
                key={cat.id}
                title={fitted.length ? `${cat.label}: ${fitted.map((p) => p.name).join(', ')}` : `${cat.label}: stock`}
                className="relative w-6 h-6 rounded-md border flex items-center justify-center"
                style={{ borderColor: best ? color : 'color-mix(in oklab, var(--line) 50%, transparent)' }}
              >
                <CategoryIcon category={cat.id} className="w-3.5 h-3.5" color={color} />
                {fitted.length > 1 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-3.5 h-3.5 px-0.5 rounded-full bg-bg-deep border text-[8px] leading-none flex items-center justify-center tabular-nums" style={{ borderColor: color, color }}>
                    {fitted.length}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>
      {tuned ? (
        <div className="mt-3 flex items-center gap-3 text-xs text-ink/60 tabular-nums">
          <span><span className="text-ink">{tuned.hp}</span> hp</span>
          <span><span className="text-ink">{tuned.mass.toLocaleString()}</span> kg</span>
          <span className="ml-auto text-ink">{formatLapTime(tuned.lapTime)}</span>
        </div>
      ) : (
        <div className="mt-3 text-xs text-highlight-soft">A card in this build no longer exists. Edit it to fix.</div>
      )}
    </motion.button>
  );
}

function CarOption({ card, selected, spare, onPick }) {
  const disabled = spare <= 0 && !selected;
  const color = RARITY_COLOR[card.rarity];
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      aria-pressed={selected}
      className={`relative text-left rounded-xl border p-3 pl-4 overflow-hidden transition-colors ${
        selected
          ? 'border-highlight bg-accent/15'
          : disabled
            ? 'border-line/20 opacity-45 cursor-not-allowed'
            : 'border-line/35 bg-bg-deep/50 hover:border-highlight/50'
      }`}
    >
      <span aria-hidden className="absolute left-0 inset-y-0 w-1" style={{ background: color }} />
      <div className="font-display text-base leading-tight truncate">{card.name}</div>
      <div className="text-[10px] uppercase tracking-wider mt-0.5 truncate" style={{ color }}>
        {RARITY_LABEL[card.rarity]} · {card.class}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-ink/60 tabular-nums">
        <span>{card.stats.hp} hp · {card.stats.torque} lb-ft · {card.stats.mass} kg</span>
        <SpareTag spare={spare} />
      </div>
    </button>
  );
}

function SlotPicker({ slot, category, options, value, spareOf, onPick }) {
  const current = options.find((c) => c.id === value);
  const chip = 'rounded-lg border px-3 py-2 text-left transition-colors';

  // Slots with no cards collapse to one line so a category stays scannable.
  if (options.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line/30 px-4 py-3 flex items-center justify-between gap-3">
        <span className="font-display text-base leading-none text-ink/60">{slot.label}</span>
        <span className="text-[11px] text-ink/40">No cards yet</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line/35 bg-surface/50 p-4">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="w-8 h-8 rounded-lg bg-bg-deep border border-line/40 flex items-center justify-center">
          <CategoryIcon category={category} color={current ? RARITY_COLOR[current.rarity] : 'var(--ink)'} />
        </span>
        <div className="min-w-0">
          <div className="font-display text-lg leading-none">{slot.label}</div>
          <div className="text-xs text-ink/50 mt-0.5 truncate">{current ? `${current.name} · ${current.effect}` : 'Stock'}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onPick(null)}
          aria-pressed={value === null}
          className={`${chip} ${value === null ? 'border-highlight bg-accent/15' : 'border-line/35 hover:border-highlight/50'}`}
        >
          <div className="text-sm leading-tight">Stock</div>
          <div className="text-[10px] text-ink/45">No part</div>
        </button>
        {options.map((card) => {
          const selected = card.id === value;
          const spare = spareOf(card.id);
          const disabled = spare <= 0 && !selected;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onPick(card.id)}
              disabled={disabled}
              aria-pressed={selected}
              className={`${chip} ${
                selected
                  ? 'border-highlight bg-accent/15'
                  : disabled
                    ? 'border-line/20 opacity-45 cursor-not-allowed'
                    : 'border-line/35 hover:border-highlight/50'
              }`}
            >
              <div className="flex items-center gap-1.5 text-sm leading-tight">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: RARITY_COLOR[card.rarity] }} />
                {card.name}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px]" style={{ color: RARITY_COLOR[card.rarity] }}>{card.effect}</span>
                <SpareTag spare={spare} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

export default function GaragePage() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted animate-pulse">Opening the garage doors...</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login?next=/garage" replace />;
  return <GaragePageInner />;
}

function GaragePageInner() {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState(null);
  const [profile, setProfile] = useState(null);
  const [garage, setGarage] = useState(null);
  const [loadError, setLoadError] = useState(null);

  // The build being edited: { id?, name, carCardId, parts } or null.
  const [draft, setDraft] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [categoryId, setCategoryId] = useState('engine');
  const builderRef = useRef(null);

  useEffect(() => {
    Promise.all([fetchCardCatalog(), fetchMyCards(), fetchGarage()])
      .then(([cat, me, g]) => { setCatalog(cat); setProfile(me); setGarage(g); })
      .catch((err) => setLoadError(err.message));
  }, []);

  const byId = useMemo(
    () => (catalog ? Object.fromEntries(catalog.cards.map((c) => [c.id, c])) : {}),
    [catalog],
  );
  const owned = useMemo(
    () => (profile ? Object.fromEntries(profile.cards.map((c) => [c.cardId, c.count])) : {}),
    [profile],
  );

  // Copies tied up in other saved builds (the one being edited is excluded,
  // so its own cards count as free while editing it).
  const usedElsewhere = useMemo(() => {
    const used = {};
    for (const b of garage?.builds ?? []) {
      if (b.id === draft?.id) continue;
      for (const id of [b.carCardId, ...Object.values(b.parts)]) {
        if (id) used[id] = (used[id] ?? 0) + 1;
      }
    }
    return used;
  }, [garage, draft?.id]);
  const spareOf = (id) => (owned[id] ?? 0) - (usedElsewhere[id] ?? 0);

  const ownedCars = useMemo(
    () => (catalog ? catalog.cards.filter((c) => c.type === 'car' && owned[c.id]).sort(byRarityThenName) : []),
    [catalog, owned],
  );
  // Owned part cards grouped by slot id.
  const partsBySlot = useMemo(() => {
    const groups = Object.fromEntries(Object.keys(catalog?.slots ?? {}).map((s) => [s, []]));
    for (const c of catalog?.cards ?? []) {
      if (c.type === 'part' && owned[c.id] && groups[c.slot]) groups[c.slot].push(c);
    }
    for (const list of Object.values(groups)) list.sort(byRarityThenName);
    return groups;
  }, [catalog, owned]);

  // Live stats while the draft changes, debounced so rapid swaps send one request.
  const draftCar = draft?.carCardId;
  const draftParts = draft?.parts;
  useEffect(() => {
    if (!draftCar) { setStats(null); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      previewBuild(draftCar, draftParts)
        .then((s) => { if (!cancelled) setStats(s); })
        .catch((err) => { if (!cancelled) setError(err.message); });
    }, 120);
    return () => { cancelled = true; clearTimeout(t); };
  }, [draftCar, draftParts]);

  const openDraft = (next) => {
    setDraft(next);
    setStats(null);
    setError(null);
    setConfirmDelete(false);
    requestAnimationFrame(() => builderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  // draft.parts holds filled slots only ({ slotId: cardId }); a missing slot is stock.
  const startNew = () => openDraft({ name: `Build ${(garage?.builds.length ?? 0) + 1}`, carCardId: null, parts: {} });
  const edit = (b) => openDraft({ id: b.id, name: b.name, carCardId: b.carCardId, parts: { ...b.parts } });
  const setPart = (slot, id) => setDraft((d) => ({ ...d, parts: { ...d.parts, [slot]: id } }));

  const reload = async () => setGarage(await fetchGarage());

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = { name: draft.name, carCardId: draft.carCardId, parts: draft.parts };
      if (draft.id) await updateBuild(draft.id, body);
      else await createBuild(body);
      await reload();
      setDraft(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    setError(null);
    try {
      await deleteBuild(draft.id);
      await reload();
      setDraft(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  };

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <h1 className="font-display text-3xl leading-none mb-2">Garage is locked</h1>
          <p className="text-ink/60 text-sm">{loadError}</p>
          <BackToSetup onClick={() => navigate('/')} className="mt-5" />
        </div>
      </div>
    );
  }

  if (!catalog || !profile || !garage) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted animate-pulse">Rolling out the builds...</p>
      </div>
    );
  }

  const { builds, maxBuilds, referenceTrack } = garage;
  const { categories } = catalog;
  const full = builds.length >= maxBuilds;
  const nameOk = (draft?.name.trim().length ?? 0) >= 2;
  const lapGain = stats ? stats.stock.lapTime - stats.tuned.lapTime : 0;
  const category = categories.find((c) => c.id === categoryId) ?? categories[0];
  const categoryOptions = categories.map((c) => ({
    value: c.id,
    label: c.label,
    count: draft ? c.slots.filter((s) => draft.parts[s.id]).length || null : null,
  }));

  return (
    <div className="max-w-6xl mx-auto px-6 pt-10 pb-16">
      {/* Header */}
      <header className="mb-8 flex items-end justify-between gap-6 flex-wrap">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
          <BackToSetup onClick={() => navigate('/')} className="mb-4" />
          <h1 className="font-display text-4xl leading-none tracking-tight">
            Your <span className="text-highlight">garage</span>
          </h1>
          <p className="text-ink/60 mt-1">
            Turn your cards into custom cars. Each card copy fits one build at a time.
          </p>
        </motion.div>
        <div className="rounded-full border border-line/40 bg-bg-deep/70 px-4 py-1.5 text-sm text-ink/60 tabular-nums">
          <span className="font-display text-xl leading-none text-ink">{builds.length}</span> / {maxBuilds} builds
        </div>
      </header>

      {/* Saved builds */}
      <section className="mb-10">
        {ownedCars.length === 0 && builds.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line/40 py-14 text-center">
            <div className="font-display text-xl leading-none">No car cards yet</div>
            <p className="text-sm text-ink/50 mt-1">Every build starts from a car card you own.</p>
            <Link to="/cards" className="mt-4 inline-block text-sm text-highlight hover:text-highlight-soft underline underline-offset-4">
              Go to card packs
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {builds.map((b, i) => (
              <BuildTile key={b.id} build={b} byId={byId} categories={categories} active={draft?.id === b.id} onEdit={() => edit(b)} index={i} />
            ))}
            <motion.button
              type="button"
              onClick={startNew}
              disabled={full || ownedCars.length === 0}
              whileHover={full ? undefined : { y: -2 }}
              className="rounded-xl border border-dashed border-line/50 p-4 min-h-[112px] flex flex-col items-center justify-center gap-1 text-ink/60 hover:text-ink hover:border-highlight/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span className="font-display text-2xl leading-none">+ New build</span>
              <span className="text-xs">{full ? 'Garage full. Delete a build first.' : 'Start from one of your car cards'}</span>
            </motion.button>
          </div>
        )}
      </section>

      {/* Builder (mode="wait": switching builds swaps panels instead of stacking two) */}
      <AnimatePresence mode="wait">
        {draft && (
          <motion.section
            key={draft.id ?? 'new'}
            ref={builderRef}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={spring}
            className="scroll-mt-6 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start"
          >
            <div className="space-y-8 min-w-0">
              <div>
                <h2 className="font-display text-2xl leading-none mb-1">1. Base car</h2>
                <p className="text-sm text-ink/50 mb-4">Pick one of your car cards.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {ownedCars.map((card) => (
                    <CarOption
                      key={card.id}
                      card={card}
                      selected={draft.carCardId === card.id}
                      spare={spareOf(card.id)}
                      onPick={() => setDraft((d) => ({ ...d, carCardId: card.id }))}
                    />
                  ))}
                </div>
              </div>

              <div>
                <h2 className="font-display text-2xl leading-none mb-1">2. Parts</h2>
                <p className="text-sm text-ink/50 mb-4">One part per slot, from the cards you own.</p>
                <div className="mb-4 rounded-xl border border-line/35 bg-bg-deep/80 p-2">
                  <ChipGroup
                    options={categoryOptions}
                    value={category.id}
                    onChange={setCategoryId}
                    layoutId="garage-category-chip"
                    label="Part category"
                  />
                </div>
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start"
                >
                  {category.slots.map((slot) => (
                    <SlotPicker
                      key={slot.id}
                      slot={slot}
                      category={category.id}
                      options={partsBySlot[slot.id] ?? []}
                      value={draft.parts[slot.id] ?? null}
                      spareOf={spareOf}
                      onPick={(id) => setPart(slot.id, id)}
                    />
                  ))}
                </motion.div>
              </div>
            </div>

            {/* Stats + save */}
            <aside className="lg:sticky lg:top-6 rounded-2xl border border-line/35 bg-surface/70 backdrop-blur-md shadow-2xl shadow-bg-deep/40 p-5">
              <label className="block">
                <span className="text-[11px] uppercase tracking-widest text-ink/40">Build name</span>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  maxLength={24}
                  className="mt-1 w-full rounded-lg border border-line/40 bg-bg-deep/70 px-3 py-2 font-display text-xl leading-none text-ink focus:outline-none focus:border-highlight/70 focus:ring-2 focus:ring-highlight/20"
                />
              </label>

              {!draft.carCardId ? (
                <p className="mt-5 text-sm text-ink/50">Pick a base car to see its stats.</p>
              ) : !stats ? (
                <p className="mt-5 text-sm text-muted animate-pulse">Running the numbers...</p>
              ) : (
                <>
                  <div className="mt-5 rounded-xl border border-line/30 bg-bg-deep/60 px-4 py-3">
                    <div className="text-[11px] uppercase tracking-widest text-ink/40">
                      Lap at {referenceTrack?.name ?? 'the test track'}
                    </div>
                    <div className="mt-1 flex items-baseline justify-between gap-3">
                      <span className="font-display text-3xl leading-none tabular-nums">{formatLapTime(stats.tuned.lapTime)}</span>
                      {Math.abs(lapGain) >= 0.0005 && (
                        <span className={`text-sm tabular-nums ${lapGain > 0 ? 'text-highlight-soft' : 'text-ink/40'}`}>
                          {lapGain > 0 ? '−' : '+'}{Math.abs(lapGain).toFixed(3)}s vs stock
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3">
                    {STAT_ROWS.map((row) => (
                      <StatRow key={row.key} row={row} stock={stats.stock[row.key]} tuned={stats.tuned[row.key]} />
                    ))}
                    <div className="flex items-baseline justify-between gap-3 py-1.5">
                      <span className="text-sm text-ink/60">Drivetrain</span>
                      <span className="text-sm">
                        {stats.stock.drive !== stats.tuned.drive && (
                          <span className="text-ink/40">{stats.stock.drive} → </span>
                        )}
                        <span className={stats.stock.drive !== stats.tuned.drive ? 'text-highlight-soft' : 'text-ink'}>
                          {stats.tuned.drive}
                        </span>
                      </span>
                    </div>
                  </div>
                </>
              )}

              <AnimatePresence>
                {error && (
                  <motion.p
                    key="err"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-4 rounded-lg border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-ink"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <PrimaryButton
                onClick={save}
                disabled={saving || !draft.carCardId || !nameOk}
                className="w-full mt-5 text-xl!"
              >
                {saving ? 'Saving...' : draft.id ? 'Save changes' : 'Save build'}
              </PrimaryButton>

              <div className="mt-3 flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => setDraft(null)}
                  className="text-ink/55 hover:text-ink transition-colors"
                >
                  Cancel
                </button>
                {draft.id && (
                  confirmDelete ? (
                    <span className="flex items-center gap-3">
                      <button type="button" onClick={() => setConfirmDelete(false)} className="text-ink/55 hover:text-ink transition-colors">
                        Keep it
                      </button>
                      <button type="button" onClick={remove} disabled={saving} className="text-highlight-soft hover:text-ink transition-colors">
                        Yes, delete
                      </button>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setConfirmDelete(true)} className="text-ink/55 hover:text-highlight-soft transition-colors">
                      Delete build
                    </button>
                  )
                )}
              </div>
              {draft.id && (
                <p className="mt-3 text-[11px] text-ink/40">
                  Deleting a build frees its cards. The cards stay in your collection.
                </p>
              )}
            </aside>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
