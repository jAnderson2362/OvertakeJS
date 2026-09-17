import { useState } from 'react';
import TrackMap from './TrackMap.jsx';

const LAP_OPTIONS = [3, 5, 8, 10, 15, 20];
const MAX_CARS = 8;

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
        <div className="font-semibold text-sm leading-tight">{car.name}</div>
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

export default function SetupScreen({ cars, tracks, onSimulate, simulating, error }) {
  const [selectedCars, setSelectedCars] = useState([]);
  const [trackId, setTrackId] = useState(tracks[0]?.id);
  const [laps, setLaps] = useState(5);

  const toggleCar = (id) =>
    setSelectedCars((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : prev.length < MAX_CARS ? [...prev, id] : prev,
    );

  const ready = selectedCars.length >= 2 && trackId && !simulating;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight">
          Overtake<span className="text-red-500">JS</span>
        </h1>
        <p className="text-zinc-400 mt-1">
          Pick your grid, pick a circuit, the physics engine settles the rest.
        </p>
      </header>

      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-lg font-semibold">1 · Choose cars</h2>
          <span className="text-sm text-zinc-500">{selectedCars.length}/{MAX_CARS} selected (min 2)</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {cars.map((car) => (
            <CarCard
              key={car.id}
              car={car}
              selected={selectedCars.includes(car.id)}
              disabled={selectedCars.length >= MAX_CARS}
              onToggle={() => toggleCar(car.id)}
            />
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4">2 · Choose circuit</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tracks.map((track) => (
            <button
              key={track.id}
              onClick={() => setTrackId(track.id)}
              className={`text-left rounded-xl border p-4 transition-all ${
                trackId === track.id
                  ? 'border-red-500 bg-red-500/10'
                  : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-600'
              }`}
            >
              <TrackMap path={track.path} className="w-full h-32 mb-3"
                stroke={trackId === track.id ? '#f87171' : '#71717a'} />
              <div className="font-semibold">{track.name}</div>
              <div className="text-xs text-zinc-500 mb-2">{track.location} · {(track.length / 1000).toFixed(2)} km</div>
              <p className="text-xs text-zinc-400 leading-relaxed">{track.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4">3 · Race distance</h2>
        <div className="flex gap-2 flex-wrap">
          {LAP_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setLaps(n)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                laps === n
                  ? 'border-red-500 bg-red-500/10 text-red-400'
                  : 'border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-zinc-600'
              }`}
            >
              {n} laps
            </button>
          ))}
        </div>
      </section>

      {error && (
        <div className="mb-6 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        onClick={() => onSimulate(selectedCars, trackId, laps)}
        disabled={!ready}
        className={`w-full sm:w-auto px-10 py-4 rounded-xl font-bold text-lg tracking-wide transition-all ${
          ready
            ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/25'
            : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
        }`}
      >
        {simulating ? 'Crunching the numbers…' : 'Simulate race'}
      </button>
    </div>
  );
}
