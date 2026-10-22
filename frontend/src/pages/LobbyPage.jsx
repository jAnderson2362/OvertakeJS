// Multiplayer lobby: browse open rooms, host a new one, or join with a code.
import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useMultiplayer } from '../multiplayer/connection.jsx';
import { ConnectionPill, TrackPicker, LapsPicker } from '../multiplayer/ui.jsx';
import TrackMap from '../components/TrackMap.jsx';
import { PrimaryButton, BackToSetup } from '../components/ui.jsx';

const spring = { type: 'spring', stiffness: 420, damping: 32 };

function RoomRow({ room, track, current, onJoin, index }) {
  const full = room.players >= room.maxPlayers;
  const racing = room.state === 'racing';
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ ...spring, delay: Math.min(index, 8) * 0.03 }}
      className={`rounded-xl border p-3 flex items-center gap-3 ${current ? 'border-highlight/70 bg-accent/15' : 'border-line/35 bg-surface/60'}`}
    >
      <span className="shrink-0 w-16 h-12 rounded-lg bg-bg-deep/60 hidden sm:flex items-center justify-center">
        {track && <TrackMap path={track.path} className="w-14 h-10 text-muted" strokeWidth={2.5} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-display text-xl leading-none truncate">{room.trackName}</div>
        <div className="text-xs text-ink/50 mt-1 truncate">
          Hosted by <span className="text-ink/80">{room.hostName}</span> · {room.laps} laps
        </div>
      </div>
      <div className="shrink-0 flex items-center gap-3">
        <span className="text-right leading-tight">
          <span className="block font-display text-lg leading-none tabular-nums">{room.players}/{room.maxPlayers}</span>
          <span className={`block text-[10px] uppercase tracking-wider mt-0.5 ${racing ? 'text-highlight-soft' : 'text-ink/45'}`}>
            {racing ? 'Racing' : 'In lobby'}
          </span>
        </span>
        <button
          type="button"
          onClick={onJoin}
          disabled={!current && (full || racing)}
          className="rounded-lg border border-line bg-surface px-4 py-2 text-sm text-ink enabled:hover:border-highlight/60 enabled:hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {current ? 'Open' : full ? 'Full' : 'Join'}
        </button>
      </div>
    </motion.div>
  );
}

export default function LobbyPage({ tracks }) {
  const navigate = useNavigate();
  const { status, room, rooms, notice, send, subscribeRooms } = useMultiplayer();
  const [trackId, setTrackId] = useState(tracks[0]?.id ?? null);
  const [laps, setLaps] = useState(5);
  const [isPrivate, setIsPrivate] = useState(false);
  const [code, setCode] = useState('');
  // Set when this page asked to create or join a room, so arriving in one
  // opens it. Being in a room already doesn't bounce you away from here.
  const [pending, setPending] = useState(false);
  const roomAtAsk = useRef(null);

  useEffect(() => {
    subscribeRooms(true);
    return () => subscribeRooms(false);
  }, [subscribeRooms]);

  useEffect(() => {
    if (pending && room && room.code !== roomAtAsk.current) navigate(`/multiplayer/${room.code}`);
  }, [pending, room, navigate]);
  useEffect(() => {
    if (notice?.request === 'room.create' || notice?.request === 'room.join') setPending(false);
  }, [notice]);

  const ask = (type, fields) => {
    roomAtAsk.current = room?.code ?? null;
    if (send(type, fields)) setPending(true);
  };

  const create = () => ask('room.create', { trackId, laps, isPrivate });
  const cleanCode = code.trim().toUpperCase();
  const joinByCode = (e) => {
    e.preventDefault();
    if (cleanCode.length !== 6) return;
    if (room?.code === cleanCode) navigate(`/multiplayer/${cleanCode}`);
    else ask('room.join', { code: cleanCode });
  };
  const trackById = Object.fromEntries(tracks.map((t) => [t.id, t]));
  const online = status === 'open';

  return (
    <div className="max-w-6xl mx-auto px-6 pt-10 pb-16">
      <header className="mb-8 flex items-end justify-between gap-6 flex-wrap">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
          <BackToSetup onClick={() => navigate('/')} className="mb-4" />
          <h1 className="font-display text-4xl leading-none tracking-tight">
            Multi<span className="text-highlight">player</span>
          </h1>
          <p className="text-ink/60 mt-1">Bring your garage builds and race other drivers online.</p>
        </motion.div>
        <ConnectionPill />
      </header>

      <AnimatePresence>
        {room && (
          <motion.div
            key="in-room"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-6 rounded-xl border border-highlight/60 bg-accent/15 px-4 py-3 flex items-center justify-between gap-4 flex-wrap"
          >
            <span className="text-sm text-ink/80">
              You are in room <span className="font-display text-lg leading-none text-ink tracking-wider">{room.code}</span>
              {' '}at {room.trackName}.
            </span>
            <span className="flex items-center gap-4">
              <button type="button" onClick={() => send('room.leave')} className="text-sm text-ink/55 hover:text-ink transition-colors">
                Leave it
              </button>
              <Link to={`/multiplayer/${room.code}`} className="rounded-lg bg-accent hover:bg-accent-hover px-4 py-2 text-sm text-accent-fg transition-colors">
                Back to the room
              </Link>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-6 items-start">
        {/* Open rooms */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-2xl leading-none">Open rooms</h2>
            {rooms && <span className="text-xs text-ink/45 tabular-nums">{rooms.length} open</span>}
          </div>
          <div className="space-y-2">
            {!rooms ? (
              <p className="text-sm text-muted animate-pulse py-6">Looking for races...</p>
            ) : rooms.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line/40 py-14 text-center">
                <div className="font-display text-xl leading-none">No open rooms</div>
                <p className="text-sm text-ink/50 mt-1">Host one and send the code to a friend.</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {rooms.map((r, i) => (
                  <RoomRow
                    key={r.code}
                    room={r}
                    index={i}
                    track={trackById[r.trackId]}
                    current={room?.code === r.code}
                    onJoin={() => (room?.code === r.code ? navigate(`/multiplayer/${r.code}`) : ask('room.join', { code: r.code }))}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>
        </section>

        {/* Host + join */}
        <aside className="space-y-4 lg:sticky lg:top-6">
          <section className="rounded-2xl border border-line/35 bg-surface/60 p-5">
            <h2 className="font-display text-2xl leading-none mb-1">Host a race</h2>
            <p className="text-sm text-ink/50 mb-4">Pick where you race. You can change it in the room.</p>
            <TrackPicker tracks={tracks} value={trackId} onChange={setTrackId} />
            <div className="mt-4">
              <LapsPicker value={laps} onChange={setLaps} layoutId="lobby-laps" />
            </div>
            <label className="mt-4 flex items-center justify-between gap-3 text-sm text-ink/70 cursor-pointer select-none">
              <span>
                Private room
                <span className="block text-[11px] text-ink/40">Hidden from the list. Join by code only.</span>
              </span>
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="w-4 h-4 accent-[var(--accent)]"
              />
            </label>
            <PrimaryButton onClick={create} disabled={!online || !trackId} className="w-full mt-5 text-xl!">
              Create room
            </PrimaryButton>
          </section>

          <section className="rounded-2xl border border-line/35 bg-surface/60 p-5">
            <h2 className="font-display text-2xl leading-none mb-3">Join with a code</h2>
            <form onSubmit={joinByCode} className="flex gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^a-z0-9]/gi, '').slice(0, 6))}
                placeholder="ABC123"
                aria-label="Room code"
                autoCapitalize="characters"
                spellCheck={false}
                className="flex-1 min-w-0 rounded-lg border border-line/40 bg-bg-deep/70 px-3 py-2 font-display text-xl leading-none tracking-[0.25em] uppercase text-ink placeholder:text-muted placeholder:tracking-[0.25em] focus:outline-none focus:border-highlight/70 focus:ring-2 focus:ring-highlight/20"
              />
              <button
                type="submit"
                disabled={!online || cleanCode.length !== 6}
                className="rounded-lg bg-accent enabled:hover:bg-accent-hover px-5 text-sm text-accent-fg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Join
              </button>
            </form>
          </section>
        </aside>
      </div>
    </div>
  );
}
