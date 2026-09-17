import { useEffect, useState } from 'react';
import { fetchCars, fetchTracks, simulateRace } from './api.js';
import SetupScreen from './components/SetupScreen.jsx';
import RaceView from './components/RaceView.jsx';

function App() {
  const [cars, setCars] = useState(null);
  const [tracks, setTracks] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [simError, setSimError] = useState(null);
  const [race, setRace] = useState(null);
  const [lastSetup, setLastSetup] = useState(null);

  useEffect(() => {
    Promise.all([fetchCars(), fetchTracks()])
      .then(([c, t]) => { setCars(c); setTracks(t); })
      .catch((err) => setLoadError(err.message));
  }, []);

  const runSimulation = async (carIds, trackId, laps) => {
    setSimulating(true);
    setSimError(null);
    try {
      const result = await simulateRace(carIds, trackId, laps);
      setLastSetup({ carIds, trackId, laps });
      setRace(result);
    } catch (err) {
      setSimError(err.message);
    } finally {
      setSimulating(false);
    }
  };

  if (loadError) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <h1 className="text-2xl font-bold mb-2">Can't reach the pit wall</h1>
          <p className="text-zinc-400 text-sm">
            {loadError} — is the backend running on port 5000? (<code>npm run dev</code> in <code>backend/</code>)
          </p>
        </div>
      </div>
    );
  }

  if (!cars || !tracks) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <p className="text-zinc-500 animate-pulse">Warming up the engines…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {race ? (
        <RaceView
          race={race}
          onExit={() => setRace(null)}
          onRerun={() => lastSetup && runSimulation(lastSetup.carIds, lastSetup.trackId, lastSetup.laps)}
        />
      ) : (
        <SetupScreen
          cars={cars}
          tracks={tracks}
          onSimulate={runSimulation}
          simulating={simulating}
          error={simError}
        />
      )}
    </div>
  );
}

export default App;
