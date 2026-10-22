// Online multiplayer: a room browser at /multiplayer and rooms at
// /multiplayer/:code. Signed-in players only; both pages share one socket.
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { MultiplayerProvider, useMultiplayer } from '../multiplayer/connection.jsx';
import { NoticeToast } from '../multiplayer/ui.jsx';
import LobbyPage from './LobbyPage.jsx';
import RoomPage from './RoomPage.jsx';

function SignedOut() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        <h1 className="font-display text-3xl leading-none mb-2">You have been signed out</h1>
        <p className="text-ink/60 text-sm">Sign in again to get back on the grid.</p>
        <Link
          to={`/login?next=${encodeURIComponent(pathname)}`}
          className="mt-5 inline-block text-sm text-highlight hover:text-highlight-soft underline underline-offset-4"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}

function MultiplayerRoutes({ tracks, cars }) {
  const { status } = useMultiplayer();
  if (status === 'signedout') return <SignedOut />;
  return (
    <>
      <Routes>
        <Route index element={<LobbyPage tracks={tracks} />} />
        <Route path=":code" element={<RoomPage tracks={tracks} cars={cars} />} />
        <Route path="*" element={<Navigate to="/multiplayer" replace />} />
      </Routes>
      <NoticeToast />
    </>
  );
}

export default function MultiplayerPage({ tracks, cars }) {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted animate-pulse">Finding the paddock...</p>
      </div>
    );
  }
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(pathname)}`} replace />;
  // Keyed by user so signing in as someone else opens a fresh connection.
  return (
    <MultiplayerProvider key={user.id}>
      <MultiplayerRoutes tracks={tracks} cars={cars} />
    </MultiplayerProvider>
  );
}
