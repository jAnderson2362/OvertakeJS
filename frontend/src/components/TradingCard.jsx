// A trading card face. Used in the collection grid and the pack reveal.
// Rarity drives the frame colour, glow and (for epic/legendary) the sheen.
import { motion } from 'motion/react';

export const RARITY_COLOR = {
  common: 'var(--rarity-common)',
  uncommon: 'var(--rarity-uncommon)',
  rare: 'var(--rarity-rare)',
  epic: 'var(--rarity-epic)',
  legendary: 'var(--rarity-legendary)',
};

export const RARITY_LABEL = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

/* ---------- Art ---------- */

function CarArt({ color }) {
  return (
    <svg viewBox="0 0 200 100" className="w-[88%] drop-shadow-lg" aria-hidden>
      <defs>
        <linearGradient id="car-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* shadow */}
      <ellipse cx="100" cy="86" rx="82" ry="5" fill="#000" opacity="0.5" />
      {/* body */}
      <path
        d="M14 68c0-7 4-11 11-13l20-4 22-20c5-5 10-7 17-7h40c7 0 12 2 17 7l17 17 22 5c7 2 11 6 11 13v9c0 3-2 5-5 5H19c-3 0-5-2-5-5z"
        fill={color}
      />
      <path
        d="M14 68c0-7 4-11 11-13l20-4 22-20c5-5 10-7 17-7h40c7 0 12 2 17 7l17 17 22 5c7 2 11 6 11 13v9c0 3-2 5-5 5H19c-3 0-5-2-5-5z"
        fill="url(#car-body)"
      />
      {/* glass */}
      <path d="M70 48l18-17c3-3 6-4 10-4h26c4 0 7 1 10 4l15 17z" fill="var(--bg-deep)" opacity="0.85" />
      <path d="M104 31h22c4 0 7 1 10 4l13 13h-45z" fill="#fff" opacity="0.08" />
      {/* lights */}
      <rect x="176" y="62" width="10" height="4" rx="2" fill="#F0EDEE" opacity="0.9" />
      <rect x="15" y="62" width="9" height="4" rx="2" fill="var(--bg-deep)" opacity="0.6" />
      {/* wheels */}
      <circle cx="54" cy="76" r="14" fill="var(--bg-deep)" />
      <circle cx="54" cy="76" r="7" fill="none" stroke={color} strokeWidth="3" />
      <circle cx="146" cy="76" r="14" fill="var(--bg-deep)" />
      <circle cx="146" cy="76" r="7" fill="none" stroke={color} strokeWidth="3" />
    </svg>
  );
}

// One icon per part category (data/cards.js PART_CATEGORIES).
export const PART_ICON = {
  engine: <path d="M13 2 3 14h7l-1 8 10-12h-7z" />,
  platform: <path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5z" />,
  drivetrain: (
    <>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22M4.9 4.9l2.5 2.5M16.6 16.6l2.5 2.5M4.9 19.1l2.5-2.5M16.6 7.4l2.5-2.5" />
    </>
  ),
  tires: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3v5.5M12 15.5V21M3 12h5.5M15.5 12H21" />
    </>
  ),
  aero: (
    <>
      <path d="M3 14h18l-4-6H7z" />
      <path d="M12 14v6M8 20h8" />
    </>
  ),
  conversion: <path d="M4 8h14l-4-4M20 16H6l4 4" />,
};

function PartArt({ category, color }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-[46%] drop-shadow-lg"
      fill="none"
      stroke={color}
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {PART_ICON[category] ?? PART_ICON.engine}
    </svg>
  );
}

/* ---------- Card ---------- */

function Stat({ label, value }) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] uppercase tracking-wider text-ink/40 leading-none">{label}</div>
      <div className="text-[13px] tabular-nums text-ink leading-tight mt-0.5">{value}</div>
    </div>
  );
}

export default function TradingCard({ card, count = 0, owned = true, className = '' }) {
  const color = RARITY_COLOR[card.rarity] ?? RARITY_COLOR.common;
  const legendary = card.rarity === 'legendary';
  const epic = card.rarity === 'epic';

  return (
    <motion.div
      whileHover="hover"
      className={`relative aspect-[5/7] w-full select-none ${className}`}
      style={{ '--card-color': color }}
    >
      {/* Frame */}
      <div
        className={`absolute inset-0 rounded-2xl p-[2px] transition-opacity ${owned ? '' : 'opacity-35 grayscale'}`}
        style={{
          background: `linear-gradient(160deg, ${color} 0%, color-mix(in oklab, ${color} 45%, var(--bg-deep)) 60%, ${color} 100%)`,
          boxShadow: owned
            ? `0 10px 30px -12px color-mix(in oklab, ${color} 70%, transparent)${legendary ? `, 0 0 24px -4px ${color}` : ''}`
            : 'none',
        }}
      >
        <div className="relative h-full w-full rounded-[14px] bg-bg-deep overflow-hidden flex flex-col">
          {/* Sheen */}
          {(legendary || epic) && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-1/2 z-10"
              style={{
                background: 'linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.16) 50%, transparent 80%)',
              }}
              initial={{ x: '-140%' }}
              animate={legendary ? { x: ['-140%', '260%'] } : undefined}
              variants={epic ? { hover: { x: '260%', transition: { duration: 0.9, ease: 'easeInOut' } } } : undefined}
              transition={legendary ? { duration: 2.2, repeat: Infinity, repeatDelay: 1.6, ease: 'easeInOut' } : undefined}
            />
          )}

          {/* Top strip */}
          <div className="flex items-center justify-between px-3 pt-2.5 text-[10px] uppercase tracking-widest leading-none">
            <span style={{ color }}>{RARITY_LABEL[card.rarity]}</span>
            <span className="text-ink/45">{card.type === 'car' ? 'Car' : card.categoryLabel?.split(' ')[0]}</span>
          </div>

          {/* Art */}
          <div
            className="relative flex-1 min-h-0 flex items-center justify-center"
            style={{
              background: `radial-gradient(70% 60% at 50% 55%, color-mix(in oklab, ${color} 22%, transparent), transparent 75%)`,
            }}
          >
            <span
              aria-hidden
              className="absolute inset-x-3 bottom-0 h-px"
              style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)`, opacity: 0.5 }}
            />
            {card.type === 'car' ? <CarArt color={color} /> : <PartArt category={card.category} color={color} />}
          </div>

          {/* Body */}
          <div className="px-3 pb-3 pt-2">
            <div className="font-display text-[15px] leading-tight line-clamp-2 min-h-[2.4em]">{card.name}</div>
            {card.type === 'car' ? (
              <>
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-ink/45 truncate">
                  {card.class} · {card.year}
                  {card.ev && <span className="ml-1.5 text-highlight-soft">EV</span>}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                  <Stat label="Power" value={`${card.stats.hp} hp`} />
                  <Stat label="Weight" value={`${card.stats.mass} kg`} />
                  <Stat label="Top speed" value={`${card.stats.topSpeed} km/h`} />
                  <Stat label="Grip" value={`${card.stats.tireGrip.toFixed(2)} g`} />
                </div>
              </>
            ) : (
              <>
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-ink/45 truncate">{card.slotLabel}</div>
                <div className="mt-2 rounded-lg border px-2.5 py-2 text-center" style={{ borderColor: `color-mix(in oklab, ${color} 45%, transparent)` }}>
                  <div className="font-display text-lg leading-none" style={{ color }}>{card.effect}</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Count badge */}
      {owned && count > 1 && (
        <span
          className="absolute -top-2 -right-2 z-20 min-w-7 h-7 px-2 rounded-full bg-bg-deep border font-display text-sm leading-none flex items-center justify-center shadow-lg"
          style={{ borderColor: color, color }}
        >
          ×{count}
        </span>
      )}
    </motion.div>
  );
}
