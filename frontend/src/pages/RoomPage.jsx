// A multiplayer room: the drivers and their cars, the host's race settings,
// ready up, then everyone watches the same race live. Opening a room's link
// joins it.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { fetchGarage } from '../api.js';
import { useMultiplayer } from '../multiplayer/connection.jsx';
import { ConnectionPill, TrackPicker, LapsPicker, RACE_COLORS } from '../multiplayer/ui.jsx';
import RaceView from '../components/RaceView.jsx';
import { PrimaryButton, ChipGroup } from '../components/ui.jsx';
import { formatLapTime, formatGap } from '../utils/format.js';

const spring = { type: 'spring', stiffness: 420, damping: 32 };

/* ---------- Pieces ---------- */

function Tag({ children, strong = false }) {
  return (
    <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded uppercase tracking-wider leading-none ${
      strong ? 'bg-accent text-accent-fg' : 'bg-line/50 text-ink/80'
    }`}>
      {children}
    </span>
  );
}

function CarStats({ stats }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink/55 tabular-nums">
      <span><span className="text-ink">{stats.hp}</span> hp</span>
      <span><span className="text-ink">{stats.mass.toLocaleString()}</span> kg</span>
      <span><span className="text-ink">{stats.topSpeed}</span> km/h</span>
      <span>0 to 100 <span className="text-ink">{stats.zeroToHundred.toFixed(1)}</span> s</span>
      <span>{stats.drive}</span>
    </div>
  );
}

function DriverSlot({ member, color, host, you, canKick, onKick, index }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ ...spring, delay: index * 0.03 }}
      className={`relative rounded-xl border p-4 pl-5 overflow-hidden ${you ? 'border-highlight/70 bg-accent/15' : 'border-line/35 bg-surface/60'}`}
    >
      <span aria-hidden className="absolute left-0 inset-y-0 w-1.5" style={{ background: color }} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={`w-2 h-2 shrink-0 rounded-full ${member.connected ? 'bg-ink/70' : 'bg-highlight-soft animate-pulse'}`}
              title={member.connected ? 'Connected' : 'Reconnecting'} />
            <span className="font-display text-xl leading-none truncate">{member.name}</span>
            {host && <Tag>Host</Tag>}
            {you && <Tag strong>You</Tag>}
          </div>
          {member.car ? (
            <>
              <div className="mt-2 flex items-center gap-1.5 min-w-0 text-sm text-ink/80">
                <span className="truncate">{member.car.name}</span>
                {member.car.kind === 'build' && <Tag>Custom</Tag>}
              </div>
              {member.car.baseName && <div className="text-xs text-ink/45 truncate">{member.car.baseName}</div>}
            </>
          ) : (
            <div className="mt-2 text-sm text-ink/40">Choosing a car...</div>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {!host && (
            <span className={`text-[11px] uppercase tracking-wider ${member.ready ? 'text-highlight-soft' : 'text-ink/40'}`}>
              {member.ready ? 'Ready' : 'Not ready'}
            </span>
          )}
          {canKick && (
            <button
              type="button"
              onClick={onKick}
              aria-label={`Remove ${member.name}`}
              title="Remove from room"
              className="w-6 h-6 rounded-full text-ink/40 hover:text-ink hover:bg-line/40 transition-colors leading-none"
            >
              ×
            </button>
          )}
        </div>
      </div>
      {member.car && <CarStats stats={member.car.stats} />}
      {!member.connected && <div className="mt-2 text-[11px] text-highlight-soft">Connection lost. Holding their spot.</div>}
    </motion.div>
  );
}

// On phones only the first open slot shows, so the controls stay close.
function EmptySlot({ color, first }) {
  return (
    <div className={`relative rounded-xl border border-dashed border-line/35 p-4 pl-5 items-center text-sm text-ink/35 min-h-[88px] ${first ? 'flex' : 'hidden md:flex'}`}>
      <span aria-hidden className="absolute left-0 inset-y-0 w-1.5 opacity-30" style={{ background: color }} />
      Waiting for a driver
    </div>
  );
}

function CarOption({ option, selected, disabled, onPick }) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled}
      aria-pressed={selected}
      className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors disabled:cursor-not-allowed ${
        selected ? 'border-highlight bg-accent/20' : 'border-line/35 bg-bg-deep/40 enabled:hover:border-highlight/50 disabled:opacity-50'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-base leading-tight truncate">{option.name}</span>
        <span className="shrink-0 text-[11px] text-ink/50 tabular-nums">{option.hp} hp</span>
      </div>
      <div className="text-[11px] text-ink/45 truncate">{option.sub}</div>
    </button>
  );
}

function CarPicker({ builds, buildsError, cars, value, onPick, disabled }) {
  const [tab, setTab] = useState(value?.kind === 'stock' ? 'stock' : 'builds');
  const options = tab === 'builds'
    ? (builds ?? []).map((b) => ({
      kind: 'build', id: b.id, name: b.name, hp: b.stats.tuned.hp,
      sub: `${cars.find((c) => `car:${c.id}` === b.carCardId)?.name ?? 'Custom build'} · ${b.stats.tuned.mass.toLocaleString()} kg`,
    }))
    : cars.map((c) => ({ kind: 'stock', id: c.id, name: c.name, hp: c.hp, sub: `${c.class} · ${c.mass.toLocaleString()} kg` }));

  return (
    <section className="rounded-2xl border border-line/35 bg-surface/60 p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-display text-2xl leading-none">Your car</h2>
        <ChipGroup
          options={[{ value: 'builds', label: 'My builds', count: builds?.length ?? null }, { value: 'stock', label: 'Stock' }]}
          value={tab}
          onChange={setTab}
          layoutId="room-car-tab"
          label="Car source"
        />
      </div>
      <div className="space-y-1.5 max-h-[340px] overflow-y-auto scroll-thin pr-1 -mr-1">
        {tab === 'builds' && !builds && !buildsError && <p className="text-sm text-muted animate-pulse py-3">Opening your garage...</p>}
        {tab === 'builds' && buildsError && <p className="text-sm text-ink/50 py-3">{buildsError}</p>}
        {tab === 'builds' && builds?.length === 0 && (
          <div className="rounded-lg border border-dashed border-line/40 px-4 py-6 text-center text-sm text-ink/50">
            No builds yet.{' '}
            {/* A new tab keeps this one connected, so the player keeps their spot. */}
            <a href="/garage" target="_blank" rel="noopener" className="text-highlight hover:text-highlight-soft underline underline-offset-4">Make one in the garage</a>
            , or race a stock car.
          </div>
        )}
        {options.map((o) => (
          <CarOption
            key={`${o.kind}:${o.id}`}
            option={o}
            selected={value?.kind === o.kind && value?.id === o.id}
            disabled={disabled}
            onPick={() => onPick({ kind: o.kind, id: o.id })}
          />
        ))}
      </div>
    </section>
  );
}

function LastResult({ result, meId, onWatch }) {
  return (
    <section className="rounded-2xl border border-line/35 bg-surface/60 p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-display text-2xl leading-none">Last race</h2>
        {onWatch && (
          <button type="button" onClick={onWatch} className="text-sm text-highlight hover:text-highlight-soft transition-colors">
            Watch the replay
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {result.map((r) => (
          <div key={r.position} className={`flex items-center gap-3 text-sm rounded-lg px-3 py-2 ${r.userId === meId ? 'bg-accent/20' : 'bg-bg-deep/50'}`}>
            <span className="w-5 text-ink/55 font-semibold tabular-nums">{r.position}</span>
            <span className="flex-1 min-w-0 truncate">
              {r.driver}
              <span className="text-ink/45 text-xs ml-1.5">{r.carName}</span>
            </span>
            <span className="text-xs text-ink/60 tabular-nums">
              {!r.finished ? 'DNF' : r.position === 1 ? formatLapTime(r.totalTime) : formatGap(r.gap, 0)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Why the host can't start yet (mirrors the server's checks), or null. */
function startBlocker(room) {
  if (room.members.length < 2) return 'Waiting for at least one more driver.';
  const noCar = room.members.find((m) => !m.car);
  if (noCar) return `Waiting for ${noCar.name} to pick a car.`;
  const notReady = room.members.find((m) => m.userId !== room.hostId && !m.ready);
  if (notReady) return `Waiting for ${notReady.name} to ready up.`;
  return null;
}

/* ---------- Page ---------- */

export default function RoomPage({ tracks, cars }) {
  const navigate = useNavigate();
  const params = useParams();
  const code = params.code.toUpperCase();
  const { status, me, room: current, race, notice, clockOffset, send } = useMultiplayer();
  const room = current?.code === code ? current : null;

  // Opening a room's link joins it, once per visit. Once in, losing the room
  // (left, removed, or the room closed) goes back to the lobby.
  const askedRef = useRef(false);
  const wasInRef = useRef(false);
  const [joinFailed, setJoinFailed] = useState(null);
  useEffect(() => {
    if (room) { wasInRef.current = true; return; }
    if (wasInRef.current) { navigate('/multiplayer', { replace: true }); return; }
    if (status === 'open' && me && !askedRef.current) {
      askedRef.current = true;
      send('room.join', { code });
    }
  }, [room, status, me, code, send, navigate]);
  useEffect(() => {
    if (notice?.request === 'room.join' && !room) setJoinFailed(notice.message);
  }, [notice, room]);

  const [builds, setBuilds] = useState(null);
  const [buildsError, setBuildsError] = useState(null);
  // Refetched when the tab regains focus: a build made in the garage tab shows up.
  useEffect(() => {
    const load = () => fetchGarage()
      .then((g) => { setBuilds(g.builds.filter((b) => b.stats)); setBuildsError(null); })
      .catch((err) => setBuildsError(err.message));
    load();
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, []);

  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/multiplayer/${code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked: the code is on screen */ }
  };

  // The race on screen, by start time. A race that is running opens on its
  // own (including after a reconnect); closing it returns to the room, and a
  // finished one only reopens when asked.
  const raceHere = race?.code === code ? race : null;
  const raceStart = raceHere?.startAt ?? null;
  const racingNow = room?.state === 'racing';
  const [watching, setWatching] = useState(null);
  useEffect(() => {
    if (raceStart && racingNow) setWatching(raceStart);
  }, [raceStart, racingNow]);
  const live = useMemo(
    () => (raceHere ? { startAt: raceHere.startAt - clockOffset, speed: raceHere.speed } : null),
    [raceHere, clockOffset],
  );

  if (raceHere && watching === raceHere.startAt && me) {
    return (
      <RaceView
        race={raceHere.race}
        live={live}
        youId={raceHere.entryByUser[me.id] ?? null}
        exitLabel="Back to the room"
        onExit={() => setWatching(null)}
      />
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          {joinFailed ? (
            <>
              <h1 className="font-display text-3xl leading-none mb-2">Could not join {code}</h1>
              <p className="text-ink/60 text-sm">{joinFailed}</p>
            </>
          ) : (
            <p className="text-muted animate-pulse">{status === 'open' ? `Joining room ${code}...` : 'Connecting...'}</p>
          )}
          <Link to="/multiplayer" className="mt-5 inline-block text-sm text-highlight hover:text-highlight-soft underline underline-offset-4">
            Back to the lobby
          </Link>
        </div>
      </div>
    );
  }

  const isHost = room.hostId === me?.id;
  const mine = room.members.find((m) => m.userId === me?.id);
  const inLobby = room.state === 'lobby' && !room.starting;
  const blocker = startBlocker(room);
  const slots = Array.from({ length: room.maxPlayers }, (_, i) => room.members[i] ?? null);

  return (
    <div className="max-w-6xl mx-auto px-6 pt-10 pb-16">
      {/* Header */}
      <header className="mb-8 flex items-end justify-between gap-6 flex-wrap">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
          <div className="mb-4 flex items-center gap-3">
            <button
              type="button"
              onClick={() => send('room.leave')}
              className="rounded-full border border-line/40 bg-bg-deep/70 px-4 py-1.5 text-sm text-ink/70 hover:text-ink hover:border-highlight/60 transition-colors"
            >
              Leave room
            </button>
            <ConnectionPill />
          </div>
          <div className="text-[11px] uppercase tracking-widest text-ink/40">
            {room.isPrivate ? 'Private room' : 'Public room'}
          </div>
          <h1 className="font-display text-4xl leading-none tracking-tight mt-1">
            {room.trackName}
          </h1>
          <p className="text-ink/60 mt-1">
            {room.laps} laps · {room.members.length} of {room.maxPlayers} drivers
          </p>
        </motion.div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-line/40 bg-bg-deep/70 px-4 py-2 text-center">
            <div className="text-[10px] uppercase tracking-widest text-ink/40">Room code</div>
            <div className="font-display text-3xl leading-none tracking-[0.2em] mt-1">{room.code}</div>
          </div>
          <button
            type="button"
            onClick={copyLink}
            className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink hover:border-highlight/60 hover:bg-surface-2 transition-colors"
          >
            {copied ? 'Link copied' : 'Copy invite link'}
          </button>
        </div>
      </header>

      {/* Race under way (when the viewer closed the broadcast) */}
      {room.state === 'racing' && (
        <div className="mb-6 rounded-xl border border-highlight/60 bg-accent/15 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <span className="text-sm text-ink/80">The race is under way.</span>
          {raceHere && (
            <button type="button" onClick={() => setWatching(raceHere.startAt)} className="rounded-lg bg-accent hover:bg-accent-hover px-4 py-2 text-sm text-accent-fg transition-colors">
              Watch live
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-6 items-start">
        {/* Drivers */}
        <section className="space-y-6 min-w-0">
          <div>
            <h2 className="font-display text-2xl leading-none mb-3">Drivers</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <AnimatePresence initial={false}>
                {slots.map((m, i) => (m ? (
                  <DriverSlot
                    key={m.userId}
                    member={m}
                    index={i}
                    color={RACE_COLORS[i % RACE_COLORS.length]}
                    host={m.userId === room.hostId}
                    you={m.userId === me?.id}
                    canKick={isHost && inLobby && m.userId !== me?.id}
                    onKick={() => send('room.kick', { userId: m.userId })}
                  />
                ) : (
                  <EmptySlot key={`empty-${i}`} color={RACE_COLORS[i % RACE_COLORS.length]} first={i === room.members.length} />
                )))}
              </AnimatePresence>
            </div>
          </div>
          {room.lastResult && (
            <LastResult
              result={room.lastResult}
              meId={me?.id}
              onWatch={raceHere && room.state === 'lobby' ? () => setWatching(raceHere.startAt) : null}
            />
          )}
        </section>

        {/* Controls */}
        <aside className="space-y-4 lg:sticky lg:top-6 min-w-0">
          <section className="rounded-2xl border border-line/35 bg-surface/70 backdrop-blur-md shadow-2xl shadow-bg-deep/40 p-5">
            {isHost ? (
              <>
                <PrimaryButton onClick={() => send('room.start')} disabled={!inLobby || Boolean(blocker)} className="w-full text-xl!">
                  {room.starting ? 'Building the grid...' : room.state === 'racing' ? 'Racing' : 'Start race'}
                </PrimaryButton>
                <p className="mt-3 text-sm text-ink/55 text-center">
                  {room.state === 'racing' ? 'Back in the room when the flag drops.' : blocker ?? 'Everyone is ready. Lights out when you are.'}
                </p>
              </>
            ) : (
              <>
                <PrimaryButton
                  onClick={() => send('room.ready', { ready: !mine?.ready })}
                  disabled={!inLobby || !mine?.car}
                  className="w-full text-xl!"
                >
                  {mine?.ready ? 'Not ready' : 'Ready up'}
                </PrimaryButton>
                <p className="mt-3 text-sm text-ink/55 text-center">
                  {room.state === 'racing'
                    ? 'Back in the room when the flag drops.'
                    : !mine?.car ? 'Pick a car to get on the grid.'
                      : mine.ready ? 'Waiting for the host to start.' : 'Ready up when you are happy with your car.'}
                </p>
              </>
            )}
          </section>

          <CarPicker
            builds={builds}
            buildsError={buildsError}
            cars={cars}
            value={mine?.car}
            onPick={(car) => send('room.car', { car })}
            disabled={!inLobby}
          />

          <section className="rounded-2xl border border-line/35 bg-surface/60 p-5">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-display text-2xl leading-none">Race</h2>
              {!isHost && <span className="text-xs text-ink/45">The host picks these</span>}
            </div>
            <TrackPicker
              tracks={tracks}
              value={room.trackId}
              onChange={(trackId) => send('room.settings', { trackId })}
              disabled={!isHost || !inLobby}
            />
            <div className="mt-4">
              <LapsPicker
                value={room.laps}
                onChange={(laps) => send('room.settings', { laps })}
                layoutId="room-laps"
                disabled={!isHost || !inLobby}
              />
            </div>
            {isHost && (
              <label className="mt-4 flex items-center justify-between gap-3 text-sm text-ink/70 cursor-pointer select-none">
                <span>
                  Private room
                  <span className="block text-[11px] text-ink/40">Hidden from the lobby list.</span>
                </span>
                <input
                  type="checkbox"
                  checked={room.isPrivate}
                  disabled={!inLobby}
                  onChange={(e) => send('room.settings', { isPrivate: e.target.checked })}
                  className="w-4 h-4 accent-[var(--accent)]"
                />
              </label>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
