import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const STEPS = ['Cars', 'Circuit', 'Race'];
const spring = { type: 'spring', stiffness: 420, damping: 32 };
const MotionLink = motion.create(Link);

const pill = 'group inline-flex items-center gap-2.5 rounded-full border border-line/40 bg-bg-deep/70 pl-1.5 pr-4 py-1.5 text-sm text-ink/70 hover:text-ink hover:border-highlight/60 transition-colors';
const badge = 'relative w-7 h-7 rounded-full bg-surface-2 border border-line/50 group-hover:bg-highlight group-hover:border-highlight transition-colors flex items-center justify-center overflow-hidden';

/** Signed-in: name pill with a sign-out menu. Signed-out: sign-in pill. */
function UserChip() {
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  if (loading) return <span className="h-10 w-28 rounded-full border border-line/20 animate-pulse" />;

  if (!user) {
    return (
      <MotionLink to="/login" whileHover="hover" whileTap={{ scale: 0.97 }} className={pill}>
        <span className={badge}>
          <motion.svg
            variants={{ hover: { scale: 1.1 } }}
            transition={spring}
            className="w-3.5 h-3.5 text-ink group-hover:text-highlight-fg transition-colors"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
          </motion.svg>
        </span>
        <span className="flex flex-col leading-none text-left">
          <span className="text-[10px] uppercase tracking-widest text-ink/40 group-hover:text-ink/60 transition-colors">Driver</span>
          <span className="font-display text-base mt-0.5">Sign in</span>
        </span>
      </MotionLink>
    );
  }

  return (
    <div ref={ref} className="relative">
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        whileTap={{ scale: 0.97 }}
        aria-haspopup="menu"
        aria-expanded={open}
        className={pill}
      >
        <span className={`${badge} font-display text-sm text-ink group-hover:text-highlight-fg`}>
          {user.name.trim()[0]?.toUpperCase()}
        </span>
        <span className="flex flex-col leading-none text-left">
          <span className="text-[10px] uppercase tracking-widest text-ink/40 group-hover:text-ink/60 transition-colors">Driver</span>
          <span className="font-display text-base mt-0.5 max-w-[140px] truncate">{user.name}</span>
        </span>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            key="menu"
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 z-30 min-w-[180px] rounded-xl border border-line/40 bg-bg-deep/95 backdrop-blur-md shadow-2xl shadow-bg-deep/60 p-1.5"
          >
            <div className="px-3 py-2 text-xs text-ink/45 truncate">{user.email}</div>
            <Link to="/cards" role="menuitem" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-ink/80 hover:bg-line/30 hover:text-ink transition-colors">
              My collection
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); logout(); }}
              className="w-full text-left rounded-lg px-3 py-2 text-sm text-ink/80 hover:bg-danger/20 hover:text-ink transition-colors"
            >
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Pill link to the card packs page: a fanned card badge that fills red on hover. */
function CardsLink() {
  return (
    <MotionLink
      to="/cards"
      whileHover="hover"
      whileTap={{ scale: 0.97 }}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      className={pill}
    >
      <span className={badge}>
        <motion.svg
          variants={{ hover: { rotate: -8, scale: 1.1 } }}
          transition={spring}
          className="w-4 h-4 text-ink group-hover:text-highlight-fg transition-colors"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden
        >
          <rect x="7" y="4" width="11" height="15" rx="2" transform="rotate(8 12.5 11.5)" />
          <rect x="5" y="6" width="11" height="15" rx="2" transform="rotate(-8 10.5 13.5)" fill="currentColor" fillOpacity="0.15" />
        </motion.svg>
      </span>
      <span className="flex flex-col leading-none text-left">
        <span className="text-[10px] uppercase tracking-widest text-ink/40 group-hover:text-ink/60 transition-colors">Open</span>
        <span className="font-display text-base mt-0.5">Card packs</span>
      </span>
    </MotionLink>
  );
}

export default function StepHeader({ step }) {
  return (
    <header className="mb-8 flex items-end justify-between gap-6 flex-wrap">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <h1 className="font-display text-4xl leading-none tracking-tight">
          Overtake<span className="text-highlight">JS</span>
        </h1>
        <p className="text-ink/60 mt-1">
          Pick your grid, pick a circuit, the physics engine settles the rest.
        </p>
      </motion.div>

      <div className="flex flex-col items-end gap-4">
        <div className="flex items-center gap-2">
          <CardsLink />
          <UserChip />
        </div>
        <ol className="flex items-center gap-3 font-display text-lg leading-none">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const active = n === step;
          const done = n < step;
          return (
            <li key={label} className="flex items-center gap-3">
              {i > 0 && (
                <span className="relative w-10 h-px bg-line/40 overflow-hidden">
                  {done && (
                    <motion.span
                      className="absolute inset-0 bg-highlight"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      style={{ transformOrigin: 'left' }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                    />
                  )}
                </span>
              )}
              <span className={`flex items-center gap-2 ${active ? 'text-ink' : done ? 'text-highlight' : 'text-muted'}`}>
                <motion.span
                  layout
                  className={`w-7 h-7 rounded-full border flex items-center justify-center text-sm ${
                    active
                      ? 'border-accent bg-accent text-accent-fg shadow-lg shadow-accent/40'
                      : done
                        ? 'border-highlight bg-highlight/15 text-highlight'
                        : 'border-line/50'
                  }`}
                  animate={active ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  {done ? '✓' : n}
                </motion.span>
                {label}
              </span>
            </li>
          );
        })}
        </ol>
      </div>
    </header>
  );
}
