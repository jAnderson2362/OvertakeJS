const STEPS = ['Cars', 'Circuit', 'Race'];

export default function StepHeader({ step }) {
  return (
    <header className="mb-10 flex items-end justify-between gap-6 flex-wrap">
      <div>
        <h1 className="font-display text-7xl leading-none font-bold tracking-tight">
          Overtake<span className="text-red-500">JS</span>
        </h1>
        <p className="text-zinc-400 mt-2">
          Pick your grid, pick a circuit, the physics engine settles the rest.
        </p>
      </div>

      <ol className="flex items-center gap-3 font-display text-2xl leading-none">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const active = n === step;
          const done = n < step;
          return (
            <li key={label} className="flex items-center gap-3">
              {i > 0 && <span className="w-8 h-px bg-zinc-800" />}
              <span className={`flex items-center gap-2 ${active ? 'text-white' : done ? 'text-zinc-400' : 'text-zinc-600'}`}>
                <span
                  className={`w-7 h-7 rounded-full border flex items-center justify-center text-xl ${
                    active ? 'border-red-500 bg-red-500/15 text-red-400' : done ? 'border-zinc-600' : 'border-zinc-800'
                  }`}
                >
                  {n}
                </span>
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </header>
  );
}
