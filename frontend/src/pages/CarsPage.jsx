import StepHeader from '../components/StepHeader.jsx';

export const MAX_CARS = 8;
export const MIN_CARS = 2;

function CarCard({ car, selected, disabled, onToggle }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled && !selected}
      className={`text-left rounded-xl border p-4 transition-all duration-150 ${
        selected
          ? 'border-red-500 bg-red-500/10 shadow-lg shadow-red-500/10'
          : disabled
            ? 'border-zinc-800 bg-zinc-900/40 opacity-40 cursor-not-allowed'
            : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-600'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-display text-2xl leading-none">{car.name}</div>
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 whitespace-nowrap">{car.class}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-zinc-400">
        <div><span className="text-zinc-200 font-medium">{car.hp}</span> hp</div>
        <div><span className="text-zinc-200 font-medium">{car.mass}</span> kg</div>
        <div><span className="text-zinc-200 font-medium">{car.drive}</span>{car.ev ? ' · EV' : ''}</div>
        <div><span className="text-zinc-200 font-medium">{car.topSpeed}</span> km/h</div>
        <div>grip <span className="text-zinc-200 font-medium">{car.tireGrip.toFixed(2)}</span></div>
        <div><span className="text-zinc-200 font-medium">{(car.powerToWeight * 1000).toFixed(0)}</span> hp/t</div>
      </div>
    </button>
  );
}

export default function CarsPage({ cars, selected, onChange, onNext }) {
  const toggle = (id) =>
    onChange(
      selected.includes(id)
        ? selected.filter((c) => c !== id)
        : selected.length < MAX_CARS ? [...selected, id] : selected,
    );

  const ready = selected.length >= MIN_CARS;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <StepHeader step={1} />

      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-display text-4xl leading-none">Choose your grid</h2>
          <div className="flex items-baseline gap-4 text-sm text-zinc-500">
            <span>{selected.length}/{MAX_CARS} selected (min {MIN_CARS})</span>
            {selected.length > 0 && (
              <button onClick={() => onChange([])} className="hover:text-zinc-300 transition-colors">
                Clear
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {cars.map((car) => (
            <CarCard
              key={car.id}
              car={car}
              selected={selected.includes(car.id)}
              disabled={selected.length >= MAX_CARS}
              onToggle={() => toggle(car.id)}
            />
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!ready}
          className={`w-full sm:w-auto px-10 py-3 rounded-xl font-display text-4xl leading-none tracking-wide transition-all ${
            ready
              ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/25'
              : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
          }`}
        >
          Choose circuit →
        </button>
      </div>
    </div>
  );
}
