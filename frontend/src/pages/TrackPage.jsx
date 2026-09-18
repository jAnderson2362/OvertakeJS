import StepHeader from '../components/StepHeader.jsx';
import TrackMap from '../components/TrackMap.jsx';

const LAP_OPTIONS = [3, 5, 8, 10, 15, 20];

export default function TrackPage({
  tracks, trackId, onTrackChange, laps, onLapsChange,
  selectedCount, onBack, onSimulate, simulating, error,
}) {
  const ready = Boolean(trackId) && !simulating;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <StepHeader step={2} />

      <section className="mb-10">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-display text-4xl leading-none">Choose circuit</h2>
          <button onClick={onBack} className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
            ← Change cars ({selectedCount} selected)
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tracks.map((track) => (
            <button
              key={track.id}
              onClick={() => onTrackChange(track.id)}
              className={`text-left rounded-xl border p-4 transition-all ${
                trackId === track.id
                  ? 'border-red-500 bg-red-500/10'
                  : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-600'
              }`}
            >
              <TrackMap path={track.path} className="w-full h-32 mb-3"
                stroke={trackId === track.id ? '#f87171' : '#71717a'} />
              <div className="font-display text-3xl leading-none">{track.name}</div>
              <div className="text-xs text-zinc-500 mb-2">{track.location} · {(track.length / 1000).toFixed(2)} km</div>
              <p className="text-xs text-zinc-400 leading-relaxed">{track.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="font-display text-4xl leading-none mb-4">Race distance</h2>
        <div className="flex gap-2 flex-wrap">
          {LAP_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => onLapsChange(n)}
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

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button onClick={onBack} className="text-sm text-zinc-400 hover:text-white transition-colors">
          ← Back
        </button>
        <button
          onClick={onSimulate}
          disabled={!ready}
          className={`w-full sm:w-auto px-10 py-3 rounded-xl font-display text-4xl leading-none tracking-wide transition-all ${
            ready
              ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/25'
              : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
          }`}
        >
          {simulating ? 'Crunching the numbers…' : 'Simulate race'}
        </button>
      </div>
    </div>
  );
}
