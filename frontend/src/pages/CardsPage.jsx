// Card packs and collection. Claim the free daily pack, buy packs with
// credits, open them with a flip reveal, and browse everything collected.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { fetchCardCatalog, fetchMyCards, claimDailyPack, buyPacks } from '../api.js';
import TradingCard, { RARITY_COLOR, RARITY_LABEL } from '../components/TradingCard.jsx';
import PackOpening from '../components/PackOpening.jsx';
import { ChipGroup, PrimaryButton, EmptyState } from '../components/ui.jsx';

const spring = { type: 'spring', stiffness: 420, damping: 32 };
const MAX_QTY = 10;
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const rank = (r) => RARITY_ORDER.indexOf(r);

/* ---------- Helpers ---------- */

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function formatCountdown(ms) {
  if (ms <= 60_000) return 'under a minute';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/* ---------- Back link ---------- */

function BackToSetup({ onClick, className = '' }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover="hover"
      whileTap={{ scale: 0.97 }}
      className={`group inline-flex items-center gap-2.5 rounded-full border border-line/40 bg-bg-deep/70 pl-1.5 pr-4 py-1.5 text-sm text-ink/70 hover:text-ink hover:border-highlight/60 transition-colors ${className}`}
    >
      <span className="relative w-7 h-7 rounded-full bg-surface-2 border border-line/50 group-hover:bg-highlight group-hover:border-highlight transition-colors flex items-center justify-center overflow-hidden">
        <motion.svg
          variants={{ hover: { rotate: -10, scale: 1.1 } }}
          transition={spring}
          className="w-3.5 h-3.5 text-ink group-hover:text-highlight-fg transition-colors"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5 21V4" />
          <path d="M5 4h13l-2 4 2 4H5" />
          <path d="M9 4v8M13 4v8M5 8h13" strokeWidth="1.2" opacity="0.6" />
        </motion.svg>
      </span>
      <span className="flex flex-col leading-none text-left">
        <span className="text-[10px] uppercase tracking-widest text-ink/40 group-hover:text-ink/60 transition-colors">Back to</span>
        <span className="font-display text-base mt-0.5">Race setup</span>
      </span>
    </motion.button>
  );
}

/* ---------- Credits ---------- */

function CreditsPill({ credits }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-line/40 bg-bg-deep/70 pl-3 pr-4 py-1.5">
      <span className="w-5 h-5 rounded-full bg-highlight/20 border border-highlight/60 flex items-center justify-center text-[10px] text-highlight-soft font-display">
        cr
      </span>
      <span className="relative overflow-hidden h-6 flex items-center">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={credits}
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -14, opacity: 0 }}
            transition={spring}
            className="font-display text-xl leading-none tabular-nums"
          >
            {credits.toLocaleString()}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="text-[11px] uppercase tracking-wider text-ink/45">credits</span>
    </div>
  );
}

/* ---------- Pack shop ---------- */

function OddsBar({ odds }) {
  return (
    <div>
      <div className="flex h-1.5 rounded-full overflow-hidden bg-line/20">
        {RARITY_ORDER.map((r) => (
          <motion.span
            key={r}
            initial={{ flexBasis: 0 }}
            animate={{ flexBasis: `${odds[r] ?? 0}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{ background: RARITY_COLOR[r] }}
          />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1 text-[10px] leading-none">
        {RARITY_ORDER.map((r) => (
          <div key={r} className="min-w-0">
            <div className="truncate" style={{ color: RARITY_COLOR[r] }}>{RARITY_LABEL[r]}</div>
            <div className="text-ink/60 tabular-nums mt-1">{odds[r] ?? 0}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QtyStepper({ value, onChange, max }) {
  const btn = 'w-7 h-7 rounded-md border border-line/50 text-ink/70 hover:text-ink hover:border-line disabled:opacity-30 disabled:cursor-not-allowed transition-colors';
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="Fewer packs">−</button>
      <span className="w-8 text-center font-display text-lg leading-none tabular-nums">{value}</span>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="More packs">+</button>
    </div>
  );
}

function PackCard({ pack, credits, daily, busy, onOpen, index }) {
  const [qty, setQty] = useState(1);
  const now = useNow();
  const cost = pack.price * qty;
  const available = pack.daily ? daily.available : credits >= cost;
  const isBusy = busy === pack.id;
  const highlight = pack.daily && daily.available;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.05 + index * 0.06 }}
      className={`relative rounded-2xl border p-5 flex flex-col gap-4 overflow-hidden ${
        highlight ? 'border-highlight/70 bg-accent/15 shadow-xl shadow-accent/20' : 'border-line/35 bg-surface/60'
      }`}
    >
      {highlight && (
        <motion.span
          aria-hidden
          className="absolute inset-0 pointer-events-none bg-gradient-to-br from-highlight/15 via-transparent to-transparent"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-2xl leading-none">{pack.name}</h3>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] leading-none tabular-nums ${
            pack.daily ? 'bg-highlight text-highlight-fg' : 'bg-line/30 text-ink/80'
          }`}>
            {pack.daily ? 'Free' : `${pack.price} cr`}
          </span>
        </div>
        <p className="text-sm text-ink/55 mt-1.5">{pack.tagline}</p>
      </div>

      <div className="relative flex items-center gap-2 text-[11px]">
        <span className="rounded-full px-2 py-0.5 bg-line/30 text-ink/70">{pack.cards} cards</span>
        {pack.guarantee && (
          <span className="rounded-full px-2 py-0.5 border" style={{ borderColor: RARITY_COLOR[pack.guarantee], color: RARITY_COLOR[pack.guarantee] }}>
            {RARITY_LABEL[pack.guarantee]}+ guaranteed
          </span>
        )}
      </div>

      <div className="relative">
        <OddsBar odds={pack.odds} />
      </div>

      <div className="relative mt-auto pt-2 flex items-center justify-between gap-3">
        {pack.daily ? (
          daily.available ? (
            <PrimaryButton onClick={() => onOpen(pack, 1)} disabled={isBusy} className="w-full px-4! text-xl!">
              {isBusy ? 'Opening...' : 'Open free pack'}
            </PrimaryButton>
          ) : (
            <div className="w-full rounded-xl border border-line/30 bg-bg-deep/50 px-4 py-2.5 text-center text-sm text-ink/60">
              Next free pack in <span className="text-ink tabular-nums">{formatCountdown(new Date(daily.nextAt) - now)}</span>
            </div>
          )
        ) : (
          <>
            <QtyStepper value={qty} onChange={(v) => setQty(Math.min(MAX_QTY, Math.max(1, v)))} max={MAX_QTY} />
            <PrimaryButton onClick={() => onOpen(pack, qty)} disabled={!available || isBusy} className="px-5! text-xl!">
              {isBusy ? 'Opening...' : `Buy ${qty > 1 ? `×${qty} ` : ''}· ${cost} cr`}
            </PrimaryButton>
          </>
        )}
      </div>
    </motion.div>
  );
}

/* ---------- Page ---------- */

export default function CardsPage({ onProfile }) {
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [opening, setOpening] = useState(null);

  const [typeFilter, setTypeFilter] = useState('all');
  const [rarityFilter, setRarityFilter] = useState('all');
  const [ownedOnly, setOwnedOnly] = useState(false);

  useEffect(() => {
    Promise.all([fetchCardCatalog(), fetchMyCards()])
      .then(([cat, me]) => { setCatalog(cat); setProfile(me); })
      .catch((err) => setLoadError(err.message));
  }, []);

  const byId = useMemo(
    () => (catalog ? Object.fromEntries(catalog.cards.map((c) => [c.id, c])) : {}),
    [catalog],
  );
  const owned = useMemo(
    () => (profile ? Object.fromEntries(profile.cards.map((c) => [c.cardId, c])) : {}),
    [profile],
  );

  const applyResult = (result) => {
    setProfile(result.player);
    onProfile?.(result.player);
    setOpening(result);
  };

  const open = async (pack, qty) => {
    setBusy(pack.id);
    setError(null);
    try {
      applyResult(pack.daily ? await claimDailyPack() : await buyPacks(pack.id, qty));
    } catch (err) {
      setError(err.message);
      // The balance or daily status may have moved under us; resync.
      fetchMyCards().then(setProfile).catch(() => {});
    } finally {
      setBusy(null);
    }
  };

  const sorted = useMemo(() => {
    if (!catalog) return [];
    return [...catalog.cards].sort((a, b) =>
      rank(b.rarity) - rank(a.rarity)
      || (a.type === b.type ? 0 : a.type === 'car' ? -1 : 1)
      || a.name.localeCompare(b.name),
    );
  }, [catalog]);

  const visible = useMemo(
    () => sorted.filter((c) =>
      (typeFilter === 'all' || c.type === typeFilter)
      && (rarityFilter === 'all' || c.rarity === rarityFilter)
      && (!ownedOnly || owned[c.id])),
    [sorted, typeFilter, rarityFilter, ownedOnly, owned],
  );

  const totals = useMemo(() => {
    const t = { all: 0, car: 0, part: 0 };
    const o = { all: 0, car: 0, part: 0 };
    for (const c of sorted) { t.all += 1; t[c.type] += 1; if (owned[c.id]) { o.all += 1; o[c.type] += 1; } }
    return { total: t, owned: o };
  }, [sorted, owned]);

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <h1 className="font-display text-3xl leading-none mb-2">Card shop is closed</h1>
          <p className="text-ink/60 text-sm">{loadError}</p>
          <BackToSetup onClick={() => navigate('/')} className="mt-5" />
        </div>
      </div>
    );
  }

  if (!catalog || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted animate-pulse">Shuffling the deck...</p>
      </div>
    );
  }

  const typeOptions = [
    { value: 'all', label: 'All', count: totals.total.all },
    { value: 'car', label: 'Cars', count: totals.total.car },
    { value: 'part', label: 'Parts', count: totals.total.part },
  ];
  const rarityOptions = [
    { value: 'all', label: 'Any rarity' },
    ...RARITY_ORDER.map((r) => ({ value: r, label: RARITY_LABEL[r] })),
  ];
  const progress = totals.total.all ? totals.owned.all / totals.total.all : 0;

  return (
    <div className="max-w-6xl mx-auto px-6 pt-10 pb-16">
      {/* Header */}
      <header className="mb-10 flex items-end justify-between gap-6 flex-wrap">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
          <BackToSetup onClick={() => navigate('/')} className="mb-4" />
          <h1 className="font-display text-4xl leading-none tracking-tight">
            Card <span className="text-highlight">packs</span>
          </h1>
          <p className="text-ink/60 mt-1">
            One free pack a day. Spend credits on more for better odds at the rare stuff.
          </p>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <CreditsPill credits={profile.credits} />
        </motion.div>
      </header>

      {/* Packs */}
      <section className="mb-12">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-display text-2xl leading-none">Packs</h2>
          <span className="text-xs text-ink/45 tabular-nums">{profile.packsOpened} opened so far</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {catalog.packs.map((pack, i) => (
            <PackCard
              key={pack.id}
              pack={pack}
              credits={profile.credits}
              daily={profile.daily}
              busy={busy}
              onOpen={open}
              index={i}
            />
          ))}
        </div>
        <AnimatePresence>
          {error && (
            <motion.p
              key="err"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 rounded-lg border border-danger/50 bg-danger/10 px-4 py-2.5 text-sm text-ink"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </section>

      {/* Collection */}
      <section>
        <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
          <div>
            <h2 className="font-display text-2xl leading-none">Collection</h2>
            <div className="mt-2 flex items-center gap-3">
              <div className="w-40 h-1.5 rounded-full bg-line/25 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-line to-highlight"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                />
              </div>
              <span className="text-xs text-ink/55 tabular-nums">
                <span className="text-ink">{totals.owned.all}</span> of {totals.total.all} collected
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOwnedOnly((v) => !v)}
            aria-pressed={ownedOnly}
            className={`text-xs rounded-full px-3 py-1.5 border transition-colors ${
              ownedOnly ? 'border-highlight bg-highlight/15 text-ink' : 'border-line/40 text-ink/60 hover:text-ink'
            }`}
          >
            Owned only
          </button>
        </div>

        <div className="sticky top-3 z-10 mb-5 rounded-xl border border-line/35 bg-bg-deep/80 backdrop-blur-md p-3 flex items-center gap-x-4 gap-y-2 flex-wrap">
          <ChipGroup options={typeOptions} value={typeFilter} onChange={setTypeFilter} layoutId="card-type-chip" label="Type" />
          <span className="hidden sm:block w-px h-5 bg-line/40" />
          <ChipGroup options={rarityOptions} value={rarityFilter} onChange={setRarityFilter} layoutId="card-rarity-chip" label="Rarity" />
        </div>

        <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <AnimatePresence mode="popLayout">
            {visible.length === 0 ? (
              <EmptyState
                key="empty"
                title={ownedOnly ? 'Nothing here yet' : 'No cards match'}
                hint={ownedOnly ? 'Open a pack to start your collection.' : 'Try a different filter.'}
                onReset={() => { setTypeFilter('all'); setRarityFilter('all'); setOwnedOnly(false); }}
              />
            ) : (
              visible.map((card) => (
                <motion.div
                  key={card.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
                  transition={spring}
                >
                  <TradingCard card={card} owned={!!owned[card.id]} count={owned[card.id]?.count ?? 0} />
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </motion.div>
      </section>

      <AnimatePresence>
        {opening && (
          <PackOpening
            key="opening"
            result={opening}
            packs={catalog.packs}
            catalogById={byId}
            onClose={() => setOpening(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
