import { useEffect, useMemo, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { fetchCars, fetchTracks, fetchGarage, simulateRace } from './api.js';
import CarsPage, { MIN_CARS } from './pages/CarsPage.jsx';
import TrackPage from './pages/TrackPage.jsx';
import CardsPage from './pages/CardsPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import GaragePage from './pages/GaragePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RaceView from './components/RaceView.jsx';
import { useAuth } from './auth.jsx';

// Race entry ids for custom builds; the server resolves them to tuned cars.
const BUILD_PREFIX = 'build:';

/** A saved garage build shaped like a stock car for the picker: tuned stats, base car details. */
function pickerCarFromBuild(build, stockById) {
  const base = stockById[build.carCardId.slice('car:'.length)];
  const t = build.stats.tuned;
  return {
    id: `${BUILD_PREFIX}${build.id}`,
    name: build.name,
    custom: true,
    baseName: base?.name ?? 'Custom build',
    class: 'Custom build',
    year: base?.year,
    country: base?.country,
    ev: base?.ev ?? false,
    hp: t.hp,
    mass: t.mass,
    topSpeed: t.topSpeed,
    tireGrip: t.tireGrip,
    drive: t.drive,
    powerToWeight: t.hp / t.mass,
  };
}

function App() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const [cars, setCars] = useState(null);
  const [tracks, setTracks] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const [selectedCars, setSelectedCars] = useState([]);
  const [trackId, setTrackId] = useState(null);
  const [laps, setLaps] = useState(5);

  const [simulating, setSimulating] = useState(false);
  const [simError, setSimError] = useState(null);
  const [race, setRace] = useState(null);

  useEffect(() => {
    Promise.all([fetchCars(), fetchTracks()])
      .then(([c, t]) => { setCars(c); setTracks(t); setTrackId(t[0]?.id ?? null); })
      .catch((err) => setLoadError(err.message));
  }, []);

  // The signed-in player's garage builds join the car picker. Refetched on
  // the picker so a build saved in the garage shows up straight away; a
  // failure just leaves the stock cars.
  const [builds, setBuilds] = useState([]);
  useEffect(() => {
    if (!user) { setBuilds([]); return; }
    if (pathname !== '/') return;
    fetchGarage().then((g) => setBuilds(g.builds.filter((b) => b.stats))).catch(() => {});
  }, [user, pathname]);

  // Builds first, then stock cars.
  const pickerCars = useMemo(() => {
    if (!cars) return null;
    const stockById = Object.fromEntries(cars.map((c) => [c.id, c]));
    return [...builds.map((b) => pickerCarFromBuild(b, stockById)), ...cars];
  }, [cars, builds]);

  // Drop grid picks for builds that were deleted or belong to a signed-out player.
  useEffect(() => {
    const live = new Set(builds.map((b) => `${BUILD_PREFIX}${b.id}`));
    setSelectedCars((sel) => {
      const kept = sel.filter((id) => !id.startsWith(BUILD_PREFIX) || live.has(id));
      return kept.length === sel.length ? sel : kept;
    });
  }, [builds]);

  const runSimulation = async () => {
    setSimulating(true);
    setSimError(null);
    try {
      const result = await simulateRace(selectedCars, trackId, laps);
      setRace(result);
      navigate('/race');
    } catch (err) {
      setSimError(err.message);
      navigate('/track');
    } finally {
      setSimulating(false);
    }
  };

  if (loadError) {
    return (
      <div className="min-h-screen text-ink flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <h1 className="font-display text-3xl leading-none mb-2">Can't reach the pit wall</h1>
          <p className="text-ink/60 text-sm">
            {loadError}. Is the backend running on port 5000? (<code>npm run dev</code> in <code>backend/</code>)
          </p>
        </div>
      </div>
    );
  }

  if (!cars || !tracks) {
    return (
      <div className="min-h-screen text-ink flex items-center justify-center">
        <p className="text-muted animate-pulse">Warming up the engines...</p>
      </div>
    );
  }

  const haveGrid = selectedCars.length >= MIN_CARS;

  return (
    <div className="min-h-screen text-ink">
      <Routes>
        <Route
          path="/"
          element={
            <CarsPage
              cars={pickerCars}
              selected={selectedCars}
              onChange={setSelectedCars}
              onNext={() => navigate('/track')}
            />
          }
        />
        <Route path="/cards" element={<CardsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/garage" element={<GaragePage />} />
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route
          path="/track"
          element={
            haveGrid ? (
              <TrackPage
                tracks={tracks}
                trackId={trackId}
                onTrackChange={setTrackId}
                laps={laps}
                onLapsChange={setLaps}
                selectedCount={selectedCars.length}
                onBack={() => navigate('/')}
                onSimulate={runSimulation}
                simulating={simulating}
                error={simError}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/race"
          element={
            race ? (
              <RaceView race={race} onExit={() => navigate('/track')} onRerun={runSimulation} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;
