// Full-screen pack reveal. Cards arrive face down; tap one to flip it or
// reveal them all. Once everything is face up a summary shows what was new
// and what got refunded as a duplicate.
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import TradingCard, { RARITY_COLOR, RARITY_LABEL } from './TradingCard.jsx';
import { PrimaryButton, GhostButton } from './ui.jsx';

const spring = { type: 'spring', stiffness: 260, damping: 26 };

function CardBack({ packName }) {
  return (
    <div className="absolute inset-0 rounded-2xl p-[2px] bg-gradient-to-br from-line via-surface-2 to-line shadow-xl shadow-bg-deep/70">
      <div
        className="relative h-full w-full rounded-[14px] overflow-hidden bg-bg-deep flex flex-col items-center justify-center"
        style={{
          backgroundImage:
            'repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0 6px, transparent 6px 14px)',
        }}
      >
        <span className="absolute inset-3 rounded-[10px] border border-line/40" />
        <span className="font-display text-4xl leading-none tracking-tight">
          O<span className="text-highlight">J</span>
        </span>
        <span className="mt-2 text-[9px] uppercase tracking-[0.25em] text-ink/40">{packName}</span>
      </div>
    </div>
  );
}

function FlipCard({ pull, packName, revealed, onReveal, index }) {
  const { card } = pull;
  const color = RARITY_COLOR[card.rarity];
  const big = card.rarity === 'legendary' || card.rarity === 'epic';

  return (
    <motion.div
      initial={{ opacity: 0, y: 60, rotate: -6 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ ...spring, delay: index * 0.07 }}
      className="relative w-36 sm:w-44 shrink-0"
    >
      {/* Burst behind rare pulls */}
      <AnimatePresence>
        {revealed && big && (
          <motion.span
            key="burst"
            aria-hidden
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{ background: color }}
            initial={{ opacity: 0.7, scale: 0.9 }}
            animate={{ opacity: 0, scale: card.rarity === 'legendary' ? 1.9 : 1.5 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      <div style={{ perspective: 1000 }}>
        <motion.button
          type="button"
          onClick={onReveal}
          disabled={revealed}
          aria-label={revealed ? card.name : 'Reveal card'}
          whileHover={revealed ? undefined : { y: -6, scale: 1.02 }}
          whileTap={revealed ? undefined : { scale: 0.97 }}
          className={`relative block w-full aspect-[5/7] preserve-3d ${revealed ? 'cursor-default' : 'cursor-pointer'}`}
          animate={{ rotateY: revealed ? 0 : 180 }}
          transition={{ duration: 0.65, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="absolute inset-0 backface-hidden" style={{ transform: 'rotateY(180deg)' }}>
            <CardBack packName={packName} />
          </div>
          <div className="absolute inset-0 backface-hidden">
            <TradingCard card={card} />
          </div>
        </motion.button>
      </div>

      <div className="h-6 mt-2 flex items-center justify-center">
        <AnimatePresence>
          {revealed && (
            <motion.span
              key="tag"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className={`text-[11px] uppercase tracking-wider rounded-full px-2.5 py-1 leading-none ${
                pull.isNew ? 'bg-highlight text-highlight-fg' : 'bg-line/40 text-ink/70'
              }`}
            >
              {pull.isNew ? 'New' : `Duplicate · +${pull.refund} cr`}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function PackOpening({ result, packs, catalogById, onClose }) {
  const pulls = useMemo(
    () => result.packs.map((p, pi) => ({
      packId: p.packId,
      key: pi,
      cards: p.cards.map((c, ci) => ({ ...c, key: `${pi}-${ci}`, card: catalogById[c.cardId] })).filter((c) => c.card),
    })),
    [result, catalogById],
  );
  const all = useMemo(() => pulls.flatMap((p) => p.cards), [pulls]);
  const packName = packs.find((p) => p.id === result.packs[0]?.packId)?.name ?? 'Pack';

  const [revealed, setRevealed] = useState(() => new Set());
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const reveal = (key) => setRevealed((s) => (s.has(key) ? s : new Set(s).add(key)));

  const revealAll = () => {
    all.forEach((pull, i) => {
      if (revealed.has(pull.key)) return;
      timers.current.push(setTimeout(() => reveal(pull.key), i * 180));
    });
  };

  const done = all.length > 0 && all.every((p) => revealed.has(p.key));
  const fresh = all.filter((p) => p.isNew).length;
  const refund = all.reduce((s, p) => s + p.refund, 0);
  const best = all.reduce((b, p) => (!b || rank(p.card.rarity) > rank(b.card.rarity) ? p : b), null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-bg-deep/92 backdrop-blur-md overflow-y-auto scroll-thin"
      role="dialog"
      aria-modal="true"
      aria-label="Pack opening"
    >
      <div className="min-h-full flex flex-col items-center justify-center px-6 py-10">
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h2 className="font-display text-4xl leading-none">
            {packName}
            {result.packs.length > 1 && <span className="text-ink/40"> ×{result.packs.length}</span>}
          </h2>
          <p className="text-sm text-ink/50 mt-2">
            {done ? 'All revealed.' : 'Tap a card to flip it over.'}
          </p>
        </motion.div>

        <div className="flex flex-col gap-8 w-full max-w-5xl">
          {pulls.map((pack, pi) => (
            <div key={pack.key}>
              {pulls.length > 1 && (
                <div className="text-[11px] uppercase tracking-widest text-ink/40 mb-3 text-center">
                  Pack {pi + 1} of {pulls.length}
                </div>
              )}
              <div className="flex flex-wrap justify-center gap-4 sm:gap-5">
                {pack.cards.map((pull, ci) => (
                  <FlipCard
                    key={pull.key}
                    pull={pull}
                    packName={packName}
                    revealed={revealed.has(pull.key)}
                    onReveal={() => reveal(pull.key)}
                    index={pi * 5 + ci}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-4">
          <AnimatePresence mode="wait">
            {done ? (
              <motion.div
                key="summary"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <div className="flex items-center justify-center gap-4 text-sm flex-wrap">
                  <span><span className="text-ink tabular-nums">{fresh}</span> <span className="text-ink/50">new</span></span>
                  <span className="text-ink/30">·</span>
                  <span><span className="text-ink tabular-nums">{all.length - fresh}</span> <span className="text-ink/50">duplicate{all.length - fresh === 1 ? '' : 's'}</span></span>
                  {refund > 0 && (
                    <>
                      <span className="text-ink/30">·</span>
                      <span className="text-highlight-soft tabular-nums">+{refund} credits back</span>
                    </>
                  )}
                </div>
                {best && (
                  <div className="mt-1.5 text-xs text-ink/50">
                    Best pull: <span style={{ color: RARITY_COLOR[best.card.rarity] }}>{RARITY_LABEL[best.card.rarity]}</span> {best.card.name}
                  </div>
                )}
                <PrimaryButton onClick={onClose} className="mt-5">Done</PrimaryButton>
              </motion.div>
            ) : (
              <motion.div key="actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-6">
                <PrimaryButton onClick={revealAll}>Reveal all</PrimaryButton>
                <GhostButton onClick={onClose}>Skip</GhostButton>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

const RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
const rank = (r) => RANK[r] ?? 0;
