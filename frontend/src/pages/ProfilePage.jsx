// Driver profile. A read-only overview of the signed-in account: identity,
// credits, collection stats and recent pulls. Built entirely from the
// existing /api/auth/me + /api/cards endpoints, so no new backend is needed.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { fetchCardCatalog, fetchMyCards } from '../api.js';
import { useAuth } from '../auth.jsx';
import TradingCard, { RARITY_COLOR, RARITY_LABEL } from '../components/TradingCard.jsx';

const spring = { type: 'spring', stiffness: 420, damping: 32 };
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const MotionLink = motion.create(Link);

const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const formatDate = (iso) => (iso ? dateFmt.format(new Date(iso)) : null);

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

/* ---------- Pieces ---------- */

function StatTile({ label, value, sub, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay }}
      className="rounded-xl border border-line/35 bg-surface/60 px-4 py-3.5"
    >
      <div className="text-[11px] uppercase tracking-wider text-ink/45 leading-none">{label}</div>
      <div className="mt-2 font-display text-3xl leading-none tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-ink/45">{sub}</div>}
    </motion.div>
  );
}

/** Owned unique cards per rarity, as a proportional bar with a legend. */
function RarityBreakdown({ counts, totals }) {
  const ownedTotal = RARITY_ORDER.reduce((n, r) => n + (counts[r] ?? 0), 0);
  return (
    <div>
      <div className="flex h-2 rounded-full overflow-hidden bg-line/20">
        {RARITY_ORDER.map((r) => {
          const share = ownedTotal ? ((counts[r] ?? 0) / ownedTotal) * 100 : 0;
          return (
            <motion.span
              key={r}
              initial={{ flexBasis: 0 }}
              animate={{ flexBasis: `${share}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              style={{ background: RARITY_COLOR[r] }}
            />
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-3">
        {RARITY_ORDER.map((r) => (
          <div key={r} className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: RARITY_COLOR[r] }} />
              <span className="truncate text-[11px] uppercase tracking-wider" style={{ color: RARITY_COLOR[r] }}>
                {RARITY_LABEL[r]}
              </span>
            </div>
            <div className="mt-1 text-sm text-ink/70 tabular-nums">
              <span className="text-ink">{counts[r] ?? 0}</span>
              <span className="text-ink/40"> / {totals[r] ?? 0}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TypeProgress({ label, owned, total, delay }) {
  const pct = total ? owned / total : 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay }}
    >
      <div className="flex items-baseline justify-between text-sm mb-1.5">
        <span className="text-ink/70">{label}</span>
        <span className="tabular-nums text-ink/55">
          <span className="text-ink">{owned}</span> / {total}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-line/25 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-line to-highlight"
          initial={{ width: 0 }}
          animate={{ width: `${pct * 100}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  );
}

function ActionCard({ to, kicker, title, desc, delay }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay }}>
      <Link
        to={to}
        className="group block rounded-xl border border-line/35 bg-surface/60 p-5 hover:border-highlight/60 hover:bg-surface transition-colors"
      >
        <div className="text-[10px] uppercase tracking-widest text-ink/40 group-hover:text-highlight-soft transition-colors">{kicker}</div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="font-display text-2xl leading-none">{title}</span>
        </div>
        <p className="mt-1.5 text-sm text-ink/55">{desc}</p>
      </Link>
    </motion.div>
  );
}

/* ---------- Page ---------- */

export default function ProfilePage() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted animate-pulse">Reading your race pass...</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login?next=/profile" replace />;
  return <ProfilePageInner user={user} />;
}

function ProfilePageInner({ user }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [catalog, setCatalog] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    Promise.all([fetchCardCatalog(), fetchMyCards()])
      .then(([cat, me]) => { setCatalog(cat); setProfile(me); })
      .catch((err) => setLoadError(err.message));
  }, []);

  const byId = useMemo(
    () => (catalog ? Object.fromEntries(catalog.cards.map((c) => [c.id, c])) : {}),
    [catalog],
  );

  const stats = useMemo(() => {
    if (!catalog || !profile) return null;

    const rarityOwned = {};
    const rarityTotal = {};
    const typeTotal = { car: 0, part: 0 };
    const typeOwned = { car: 0, part: 0 };
    for (const c of catalog.cards) {
      rarityTotal[c.rarity] = (rarityTotal[c.rarity] ?? 0) + 1;
      if (c.type in typeTotal) typeTotal[c.type] += 1;
    }

    let totalCards = 0;
    let earliest = null;
    for (const held of profile.cards) {
      const card = byId[held.cardId];
      if (!card) continue; // a card no longer in the catalog
      totalCards += held.count;
      rarityOwned[card.rarity] = (rarityOwned[card.rarity] ?? 0) + 1;
      if (card.type in typeOwned) typeOwned[card.type] += 1;
      if (held.firstAt && (!earliest || held.firstAt < earliest)) earliest = held.firstAt;
    }

    const uniqueOwned = typeOwned.car + typeOwned.part;
    const totalUnique = catalog.cards.length;
    const recent = [...profile.cards]
      .filter((h) => byId[h.cardId] && h.firstAt)
      .sort((a, b) => (a.firstAt < b.firstAt ? 1 : -1))
      .slice(0, 6);

    return {
      rarityOwned, rarityTotal, typeTotal, typeOwned,
      uniqueOwned, totalUnique, totalCards,
      duplicates: totalCards - uniqueOwned,
      completion: totalUnique ? uniqueOwned / totalUnique : 0,
      since: formatDate(earliest),
      recent,
    };
  }, [catalog, profile, byId]);

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <h1 className="font-display text-3xl leading-none mb-2">Profile is in the pits</h1>
          <p className="text-ink/60 text-sm">{loadError}</p>
          <BackToSetup onClick={() => navigate('/')} className="mt-5" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted animate-pulse">Loading your garage...</p>
      </div>
    );
  }

  const initial = user.name.trim()[0]?.toUpperCase() ?? '?';
  const completionPct = Math.round(stats.completion * 100);

  return (
    <div className="max-w-6xl mx-auto px-6 pt-10 pb-16">
      {/* Header */}
      <header className="mb-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
          <BackToSetup onClick={() => navigate('/')} className="mb-4" />
          <h1 className="font-display text-4xl leading-none tracking-tight">
            Driver <span className="text-highlight">profile</span>
          </h1>
        </motion.div>
      </header>

      {/* Identity hero */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...spring, delay: 0.05 }}
        className="relative overflow-hidden rounded-2xl border border-line/35 bg-surface/60 backdrop-blur-md shadow-2xl shadow-bg-deep/40 p-6 sm:p-7"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-highlight/10 via-transparent to-transparent"
        />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
          <motion.div
            initial={{ scale: 0.6, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={spring}
            className="shrink-0 w-20 h-20 rounded-2xl bg-accent text-accent-fg font-display text-4xl leading-none flex items-center justify-center shadow-lg shadow-accent/30 border border-accent-hover/40"
          >
            {initial}
          </motion.div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-widest text-ink/40">Driver</div>
            <h2 className="font-display text-3xl leading-none mt-1 truncate">{user.name}</h2>
            <p className="text-sm text-ink/55 mt-1.5 truncate">{user.email}</p>
            {stats.since && (
              <p className="text-xs text-ink/40 mt-1">Member since {stats.since}</p>
            )}
          </div>
          <div className="shrink-0 flex sm:flex-col items-end gap-3">
            <div className="flex items-center gap-2 rounded-full border border-line/40 bg-bg-deep/70 pl-3 pr-4 py-1.5">
              <span className="w-5 h-5 rounded-full bg-highlight/20 border border-highlight/60 flex items-center justify-center text-[10px] text-highlight-soft font-display">
                cr
              </span>
              <span className="font-display text-xl leading-none tabular-nums">{profile.credits.toLocaleString()}</span>
              <span className="text-[11px] uppercase tracking-wider text-ink/45">credits</span>
            </div>
            <button
              type="button"
              onClick={() => { logout(); navigate('/'); }}
              className="text-xs text-ink/50 hover:text-ink transition-colors rounded-full border border-line/40 px-3 py-1.5 hover:border-danger/60"
            >
              Sign out
            </button>
          </div>
        </div>
      </motion.section>

      {/* Stat tiles */}
      <section className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Cards collected" value={stats.uniqueOwned} sub={`of ${stats.totalUnique} in the set`} delay={0.08} />
        <StatTile label="Total cards" value={stats.totalCards.toLocaleString()} sub={`${stats.duplicates} duplicate${stats.duplicates === 1 ? '' : 's'}`} delay={0.12} />
        <StatTile label="Packs opened" value={profile.packsOpened.toLocaleString()} sub={profile.daily.available ? 'Free pack ready' : 'Free pack claimed'} delay={0.16} />
        <StatTile label="Set complete" value={`${completionPct}%`} sub={completionPct === 100 ? 'Full house' : 'Keep pulling'} delay={0.2} />
      </section>

      {/* Collection detail */}
      <section className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.22 }}
          className="lg:col-span-2 rounded-2xl border border-line/35 bg-surface/60 p-5 sm:p-6"
        >
          <h3 className="font-display text-2xl leading-none mb-4">Collection by rarity</h3>
          <RarityBreakdown counts={stats.rarityOwned} totals={stats.rarityTotal} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.26 }}
          className="rounded-2xl border border-line/35 bg-surface/60 p-5 sm:p-6 flex flex-col gap-5 justify-center"
        >
          <h3 className="font-display text-2xl leading-none">By type</h3>
          <TypeProgress label="Cars" owned={stats.typeOwned.car} total={stats.typeTotal.car} delay={0.3} />
          <TypeProgress label="Parts" owned={stats.typeOwned.part} total={stats.typeTotal.part} delay={0.34} />
        </motion.div>
      </section>

      {/* Recent pulls */}
      <section className="mt-10">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h3 className="font-display text-2xl leading-none">Recent pulls</h3>
          <MotionLink
            to="/cards"
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.97 }}
            transition={spring}
            className="group inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm text-ink hover:border-highlight/60 hover:bg-surface-2 transition-colors"
          >
            <svg
              className="w-4 h-4 text-ink/70 group-hover:text-highlight-soft transition-colors"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              aria-hidden
            >
              <rect x="7" y="4" width="11" height="15" rx="2" transform="rotate(8 12.5 11.5)" />
              <rect x="5" y="6" width="11" height="15" rx="2" transform="rotate(-8 10.5 13.5)" fill="currentColor" fillOpacity="0.15" />
            </svg>
            View collection
            <span className="text-ink/40 group-hover:text-highlight group-hover:translate-x-0.5 transition-all"></span>
          </MotionLink>
        </div>
        {stats.recent.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-dashed border-line/40 py-12 text-center"
          >
            <div className="font-display text-xl leading-none">No cards yet</div>
            <p className="text-sm text-ink/50 mt-1">Open your first pack to start the collection.</p>
            <Link to="/cards" className="mt-4 inline-block text-sm text-highlight hover:text-highlight-soft underline underline-offset-4">
              Go to card packs
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {stats.recent.map((held, i) => (
              <motion.div
                key={held.cardId}
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ ...spring, delay: 0.3 + i * 0.05 }}
              >
                <TradingCard card={byId[held.cardId]} owned count={held.count} />
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Actions */}
      <section className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ActionCard
          to="/cards"
          kicker="Open"
          title="Card packs"
          desc="Claim the daily pack or spend credits for better odds."
          delay={0.36}
        />
        <ActionCard
          to="/"
          kicker="Start"
          title="Race setup"
          desc="Build a grid, pick a circuit and run the simulation."
          delay={0.4}
        />
      </section>
    </div>
  );
}
