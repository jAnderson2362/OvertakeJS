// Multiplayer rooms: lobbies where signed-in players each bring one car (a
// garage build or a stock car) and race it against each other.
//
// The server is authoritative. Clients only ever send ids: every car is
// rebuilt from its owner's garage when the race starts, the race is
// simulated here, and every player gets the same result with a shared start
// time, so they all watch it play out in sync.
//
// Rooms live in memory (they're short-lived), which assumes a single API
// process. The transport (multiplayer/socket.js) talks to this module only
// through method calls and the `emit(userIds, message)` callback.

import { randomInt } from 'node:crypto';
import { getCarById, getTrackById } from '../data/store.js';
import { listBuilds } from '../data/builds.js';
import { getCatalog } from '../cards/catalog.js';
import { raceCarFromBuild, summary } from '../cards/builds.js';
import { simulateRace } from '../sim/race.js';

export const MAX_PLAYERS = 8;
export const MIN_PLAYERS = 2;
export const MIN_LAPS = 2;
export const MAX_LAPS = 10;              // keeps a live race at 4x under ~5 minutes
export const LIVE_SPEED = 4;              // race seconds per real second when watching live
export const COUNTDOWN_MS = 5000;         // start lights before the race clock runs
export const RESULTS_GRACE_MS = 3000;     // room stays in race mode this long after the finish
export const DISCONNECT_GRACE_MS = 60_000; // a dropped player keeps their lobby spot this long
export const MAX_ROOMS = 200;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I/L mix-ups
const CODE_LENGTH = 6;

const fail = (error) => ({ error });
const OK = { ok: true };

/* ---------- Cars ---------- */

/** The few stats the lobby shows for each player's car. */
function statLine(car) {
  const s = summary(car);
  return {
    hp: s.hp, mass: s.mass, hpPerTonne: s.hpPerTonne, topSpeed: s.topSpeed,
    zeroToHundred: s.zeroToHundred, drive: s.drive, lapTime: s.lapTime,
  };
}

/**
 * Turn a player's car choice into a race-ready car record plus what the
 * lobby shows about it. Builds must belong to the player. Returns null when
 * the car isn't available to them (deleted build, retired card, unknown id).
 */
export async function resolvePlayerCar(userId, choice) {
  if (choice.kind === 'build') {
    const build = (await listBuilds(userId)).find((b) => b.id === choice.id);
    const car = build ? raceCarFromBuild(build) : null;
    if (!car) return null;
    const baseName = getCatalog().byId.get(build.carCardId)?.name ?? null;
    return { car, info: { kind: 'build', id: build.id, name: build.name, baseName, stats: statLine(car) } };
  }
  const car = getCarById(choice.id);
  if (!car) return null;
  return { car, info: { kind: 'stock', id: car.id, name: car.name, baseName: null, stats: statLine(car) } };
}

/** { kind: 'build' | 'stock', id } from untrusted input, or null. */
function readCarChoice(input) {
  if (!input || typeof input !== 'object') return null;
  const { kind, id } = input;
  if ((kind !== 'build' && kind !== 'stock') || typeof id !== 'string' || id.length > 64) return null;
  return { kind, id };
}

/** Validated room settings, falling back to `current` for anything not sent. */
function readSettings(input, current = {}) {
  const trackId = input?.trackId ?? current.trackId;
  const laps = input?.laps ?? current.laps;
  const isPrivate = input?.isPrivate ?? current.isPrivate ?? false;
  if (typeof trackId !== 'string' || !getTrackById(trackId)) return fail('Pick a circuit.');
  if (!Number.isInteger(laps) || laps < MIN_LAPS || laps > MAX_LAPS) {
    return fail(`Laps must be between ${MIN_LAPS} and ${MAX_LAPS}.`);
  }
  if (typeof isPrivate !== 'boolean') return fail('That room setting is not valid.');
  return { trackId, laps, isPrivate };
}

/* ---------- Manager ---------- */

export class RoomManager {
  /**
   * @param emit         (userIds, message) => void, delivers to every socket of those users
   * @param onListChange () => void, the public room list changed
   * @param resolveCar   async (userId, choice) => { car, info } | null
   * @param now          clock in ms (injectable for tests)
   */
  constructor({ emit, onListChange = () => {}, resolveCar = resolvePlayerCar, now = Date.now }) {
    this.emit = emit;
    this.onListChange = onListChange;
    this.resolveCar = resolveCar;
    this.now = now;
    this.rooms = new Map();    // code -> room
    this.userRoom = new Map(); // userId -> code
  }

  roomOf(userId) {
    const code = this.userRoom.get(userId);
    return code ? this.rooms.get(code) ?? null : null;
  }

  /* ----- Views ----- */

  /** What every member sees about the room. */
  view(room) {
    const track = getTrackById(room.trackId);
    return {
      code: room.code,
      isPrivate: room.isPrivate,
      hostId: room.hostId,
      trackId: room.trackId,
      trackName: track?.name ?? room.trackId,
      laps: room.laps,
      state: room.state,
      starting: room.starting,
      maxPlayers: MAX_PLAYERS,
      members: [...room.members.values()].map((m) => ({
        userId: m.userId, name: m.name, ready: m.ready, connected: m.connected, car: m.car,
      })),
      race: room.race && {
        startAt: room.race.startAt, endsAt: room.race.endsAt, speed: LIVE_SPEED, entryByUser: room.race.entryByUser,
      },
      lastResult: room.lastResult,
    };
  }

  /** Public rooms for the lobby browser, newest first. */
  listPublic() {
    return [...this.rooms.values()]
      .filter((r) => !r.isPrivate)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50)
      .map((r) => ({
        code: r.code,
        hostName: r.members.get(r.hostId)?.name ?? '',
        trackId: r.trackId,
        trackName: getTrackById(r.trackId)?.name ?? r.trackId,
        laps: r.laps,
        players: r.members.size,
        maxPlayers: MAX_PLAYERS,
        state: r.state,
      }));
  }

  /** The race message a member needs to watch the current race, or null. */
  raceMessage(room) {
    if (room.state !== 'racing') return null;
    const { payload, startAt, entryByUser } = room.race;
    return { type: 'race', code: room.code, race: payload, startAt, speed: LIVE_SPEED, entryByUser };
  }

  changed(room) {
    this.emit([...room.members.keys()], { type: 'room', room: this.view(room) });
    if (!room.isPrivate) this.onListChange();
  }

  /* ----- Connection state (driven by the transport) ----- */

  /** A user's first socket opened. Returns their room view and race, if any. */
  connect(user) {
    const room = this.roomOf(user.id);
    if (!room) return { room: null, race: null };
    const m = room.members.get(user.id);
    m.connected = true;
    m.disconnectedAt = null;
    this.changed(room);
    return { room: this.view(room), race: this.raceMessage(room) };
  }

  /** A user's last socket closed. They keep their spot for a grace period. */
  disconnect(userId) {
    const room = this.roomOf(userId);
    if (!room) return;
    const m = room.members.get(userId);
    m.connected = false;
    m.disconnectedAt = this.now();
    this.changed(room);
  }

  /* ----- Membership ----- */

  newMember(user) {
    return {
      userId: user.id, name: user.name, ready: false, connected: true, disconnectedAt: null,
      car: null, carSeq: 0,
    };
  }

  newCode() {
    for (;;) {
      let code = '';
      for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
  }

  create(user, input) {
    const settings = readSettings(input);
    if (settings.error) return settings;
    if (this.rooms.size >= MAX_ROOMS) return fail('Too many rooms are open right now. Try again soon.');

    this.leave(user.id);
    const room = {
      code: this.newCode(),
      hostId: user.id,
      ...settings,
      state: 'lobby',
      starting: false,
      members: new Map([[user.id, this.newMember(user)]]), // join order sets car colours
      banned: new Set(),
      race: null,
      lastResult: null,
      createdAt: this.now(),
    };
    this.rooms.set(room.code, room);
    this.userRoom.set(user.id, room.code);
    this.changed(room);
    return { ok: true, code: room.code };
  }

  join(user, rawCode) {
    const code = String(rawCode ?? '').trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room) return fail('No room with that code.');
    if (room.members.has(user.id)) { // already in: just resync this client
      this.changed(room);
      return OK;
    }
    if (room.banned.has(user.id)) return fail('The host removed you from this room.');
    if (room.state !== 'lobby' || room.starting) return fail('That race is under way. Try again when it finishes.');
    if (room.members.size >= MAX_PLAYERS) return fail('That room is full.');

    this.leave(user.id);
    room.members.set(user.id, this.newMember(user));
    this.userRoom.set(user.id, room.code);
    this.changed(room);
    return OK;
  }

  leave(userId) {
    const room = this.roomOf(userId);
    if (room) this.removeMember(room, userId, 'left');
    return OK;
  }

  kick(userId, targetId) {
    const room = this.roomOf(userId);
    if (!room) return fail('You are not in a room.');
    if (room.hostId !== userId) return fail('Only the host can remove players.');
    if (room.state !== 'lobby' || room.starting) return fail('Wait for the race to finish.');
    if (targetId === userId || !room.members.has(targetId)) return fail('That player is not in the room.');
    room.banned.add(targetId);
    this.removeMember(room, targetId, 'kicked');
    return OK;
  }

  removeMember(room, userId, reason) {
    room.members.delete(userId);
    this.userRoom.delete(userId);
    this.emit([userId], { type: 'room', room: null, reason });
    if (room.members.size === 0) {
      this.rooms.delete(room.code);
      if (!room.isPrivate) this.onListChange();
      return;
    }
    if (room.hostId === userId) {
      const members = [...room.members.values()];
      room.hostId = (members.find((m) => m.connected) ?? members[0]).userId;
    }
    this.changed(room);
  }

  /* ----- Lobby actions ----- */

  async setCar(userId, input) {
    const room = this.roomOf(userId);
    if (!room) return fail('You are not in a room.');
    if (room.state !== 'lobby' || room.starting) return fail('You can\'t change cars once the race is starting.');
    const choice = readCarChoice(input);
    if (!choice) return fail('Pick a car.');

    const member = room.members.get(userId);
    const seq = ++member.carSeq;
    const resolved = await this.resolveCar(userId, choice);

    // The room may have moved on while the car loaded; a later pick wins.
    if (this.roomOf(userId) !== room || room.members.get(userId) !== member || seq !== member.carSeq) return OK;
    if (room.state !== 'lobby' || room.starting) return fail('You can\'t change cars once the race is starting.');
    if (!resolved) return fail('That car is not in your garage.');
    member.car = resolved.info;
    member.ready = false;
    this.changed(room);
    return OK;
  }

  setReady(userId, ready) {
    const room = this.roomOf(userId);
    if (!room) return fail('You are not in a room.');
    if (room.state !== 'lobby' || room.starting) return fail('The race is already starting.');
    if (typeof ready !== 'boolean') return fail('That is not a valid ready state.');
    const member = room.members.get(userId);
    if (ready && !member.car) return fail('Pick a car first.');
    member.ready = ready;
    this.changed(room);
    return OK;
  }

  updateSettings(userId, input) {
    const room = this.roomOf(userId);
    if (!room) return fail('You are not in a room.');
    if (room.hostId !== userId) return fail('Only the host can change the race.');
    if (room.state !== 'lobby' || room.starting) return fail('Wait for the race to finish.');
    const settings = readSettings(input, room);
    if (settings.error) return settings;

    const wasPublic = !room.isPrivate;
    Object.assign(room, settings);
    // Everyone readied up for the old race; make them confirm the new one.
    for (const m of room.members.values()) m.ready = false;
    this.changed(room);
    if (wasPublic && room.isPrivate) this.onListChange(); // drop it from the public list
    return OK;
  }

  /* ----- Racing ----- */

  async start(userId) {
    const room = this.roomOf(userId);
    if (!room) return fail('You are not in a room.');
    if (room.hostId !== userId) return fail('Only the host can start the race.');
    if (room.state !== 'lobby' || room.starting) return fail('The race is already starting.');

    const members = [...room.members.values()];
    if (members.length < MIN_PLAYERS) return fail(`You need at least ${MIN_PLAYERS} drivers to race.`);
    const noCar = members.find((m) => !m.car);
    if (noCar) return fail(`${noCar.name} has not picked a car yet.`);
    const notReady = members.find((m) => m.userId !== room.hostId && !m.ready);
    if (notReady) return fail(`Waiting for ${notReady.name} to ready up.`);
    const track = getTrackById(room.trackId);
    if (!track) return fail('That circuit is no longer available.');

    // Rebuild every car from its owner's garage now: a build may have been
    // edited or deleted since it was picked.
    room.starting = true;
    this.changed(room);
    let resolved;
    try {
      resolved = await Promise.all(members.map((m) => this.resolveCar(m.userId, { kind: m.car.kind, id: m.car.id })));
    } catch (err) {
      console.error('Multiplayer car load failed:', err);
      return this.abortStart(room, 'Could not load the cars. Try again.');
    }

    const current = [...room.members.values()];
    if (this.rooms.get(room.code) !== room || current.length !== members.length || current.some((m, i) => m !== members[i])) {
      return this.abortStart(room, 'The grid changed while the cars loaded. Try again.');
    }
    const missing = members.filter((m, i) => !resolved[i]);
    if (missing.length) {
      for (const m of missing) { m.car = null; m.ready = false; }
      return this.abortStart(room, `${missing.map((m) => m.name).join(', ')} needs to pick another car.`);
    }

    const carIds = [];
    const cars = {};
    const drivers = {};
    const entryByUser = {};
    members.forEach((m, i) => {
      const entryId = `p${i + 1}`;
      carIds.push(entryId);
      cars[entryId] = resolved[i].car;
      drivers[entryId] = m.name;
      entryByUser[m.userId] = entryId;
      m.car = resolved[i].info; // freshest stats
    });

    let payload;
    try {
      payload = simulateRace({ track, carIds, laps: room.laps, seed: randomInt(2 ** 32), cars, drivers });
    } catch (err) {
      console.error('Multiplayer simulation failed:', err);
      return this.abortStart(room, 'The race could not be simulated. Try again.');
    }

    const startAt = this.now() + COUNTDOWN_MS;
    room.state = 'racing';
    room.starting = false;
    room.race = {
      payload,
      startAt,
      endsAt: startAt + (payload.timeline.duration / LIVE_SPEED) * 1000 + RESULTS_GRACE_MS,
      entryByUser,
    };
    for (const m of members) m.ready = false;
    this.emit(members.map((m) => m.userId), this.raceMessage(room));
    this.changed(room);
    return OK;
  }

  abortStart(room, message) {
    room.starting = false;
    if (this.rooms.get(room.code) === room) this.changed(room);
    return fail(message);
  }

  /** Finishing order of a race, for the lobby's "last race" panel. */
  resultSummary(room) {
    const userByEntry = Object.fromEntries(Object.entries(room.race.entryByUser).map(([u, e]) => [e, u]));
    return room.race.payload.results.map((r) => ({
      position: r.position,
      userId: userByEntry[r.carId] ?? null,
      driver: r.driver,
      carName: r.name,
      finished: r.finished,
      totalTime: r.totalTime,
      gap: r.gap,
      bestLap: r.bestLap,
    }));
  }

  /** Housekeeping, run about once a second: finish races, drop departed players. */
  tick() {
    const now = this.now();
    for (const room of [...this.rooms.values()]) {
      if (room.state === 'racing' && now >= room.race.endsAt) {
        room.lastResult = this.resultSummary(room);
        room.state = 'lobby';
        room.race = null;
        this.changed(room);
      }
      if (room.state !== 'lobby' || room.starting) continue;
      for (const m of [...room.members.values()]) {
        if (!m.connected && now - m.disconnectedAt >= DISCONNECT_GRACE_MS && this.rooms.has(room.code)) {
          this.removeMember(room, m.userId, 'left');
        }
      }
    }
  }
}
