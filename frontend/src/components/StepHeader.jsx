import { motion } from 'motion/react';

const STEPS = ['Cars', 'Circuit', 'Race'];

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
    </header>
  );
}
