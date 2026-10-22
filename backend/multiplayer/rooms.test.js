// Room logic tests. Run with `npm test` in backend/. Uses the in-memory store
// (no database) and a fake clock.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { initStore } from '../data/store.js';
import { createBuild, deleteBuild } from '../data/builds.js';
import {
  RoomManager, resolvePlayerCar, MAX_PLAYERS, COUNTDOWN_MS, LIVE_SPEED, RESULTS_GRACE_MS, DISCONNECT_GRACE_MS,
} from './rooms.js';

before(async () => { await initStore(false); });

const TRACK = 'valmont-gp';
const user = (n) => ({ id: `u${n}`, name: `Driver ${n}` });

/** A manager wired to a fake clock, recording everything it sends. */
function setup(opts = {}) {
  const sent = [];
  let listChanges = 0;
  const clock = { t: 1_000_000 };
  const rooms = new RoomManager({
    emit: (ids, msg) => sent.push({ ids, msg }),
    onListChange: () => { listChanges += 1; },
    now: () => clock.t,
    ...opts,
  });
  const lastTo = (id, type) => [...sent].reverse().find((s) => s.ids.includes(id) && s.msg.type === type)?.msg;
  return { rooms, sent, clock, lastTo, listChanges: () => listChanges };
}

/** Host plus `n - 1` guests in one room, every guest with a stock car and ready. */
async function readyRoom(ctx, n = 2, settings = { trackId: TRACK, laps: 2 }) {
  const { code } = ctx.rooms.create(user(1), settings);
  for (let i = 2; i <= n; i++) assert.deepEqual(ctx.rooms.join(user(i), code), { ok: true });
  for (let i = 1; i <= n; i++) {
    assert.deepEqual(await ctx.rooms.setCar(`u${i}`, { kind: 'stock', id: 'mazda-mx5' }), { ok: true });
    if (i > 1) assert.deepEqual(ctx.rooms.setReady(`u${i}`, true), { ok: true });
  }
  return code;
}

test('create makes the creator host of a listed room', () => {
  const ctx = setup();
  const res = ctx.rooms.create(user(1), { trackId: TRACK, laps: 5 });
  assert.equal(res.ok, true);
  assert.match(res.code, /^[A-HJ-NP-Z2-9]{6}$/);
  const view = ctx.lastTo('u1', 'room').room;
  assert.equal(view.hostId, 'u1');
  assert.equal(view.members.length, 1);
  assert.equal(ctx.rooms.listPublic()[0].code, res.code);
  assert.ok(ctx.listChanges() > 0);
});

test('create validates settings', () => {
  const ctx = setup();
  assert.ok(ctx.rooms.create(user(1), { trackId: 'nowhere', laps: 5 }).error);
  assert.ok(ctx.rooms.create(user(1), { trackId: TRACK, laps: 1 }).error);
  assert.ok(ctx.rooms.create(user(1), { trackId: TRACK, laps: 3.5 }).error);
  assert.ok(ctx.rooms.create(user(1), { trackId: TRACK, laps: '5' }).error);
  assert.ok(ctx.rooms.create(user(1), { trackId: TRACK, laps: 5, isPrivate: 'yes' }).error);
});

test('private rooms are joinable by code but not listed', () => {
  const ctx = setup();
  const { code } = ctx.rooms.create(user(1), { trackId: TRACK, laps: 5, isPrivate: true });
  assert.equal(ctx.rooms.listPublic().length, 0);
  assert.deepEqual(ctx.rooms.join(user(2), code.toLowerCase()), { ok: true });
  assert.equal(ctx.lastTo('u2', 'room').room.members.length, 2);
});

test('join rejects unknown codes and full rooms', () => {
  const ctx = setup();
  const { code } = ctx.rooms.create(user(1), { trackId: TRACK, laps: 5 });
  assert.ok(ctx.rooms.join(user(2), 'ZZZZZZ').error);
  for (let i = 2; i <= MAX_PLAYERS; i++) assert.deepEqual(ctx.rooms.join(user(i), code), { ok: true });
  assert.match(ctx.rooms.join(user(99), code).error, /full/);
});

test('joining another room leaves the first, and the host role passes on', () => {
  const ctx = setup();
  const a = ctx.rooms.create(user(1), { trackId: TRACK, laps: 5 }).code;
  ctx.rooms.join(user(2), a);
  const b = ctx.rooms.create(user(3), { trackId: TRACK, laps: 5 }).code;
  ctx.rooms.join(user(1), b);
  assert.equal(ctx.rooms.rooms.get(a).hostId, 'u2');
  assert.equal(ctx.rooms.rooms.get(a).members.size, 1);
  assert.equal(ctx.rooms.roomOf('u1').code, b);
});

test('the last player leaving closes the room', () => {
  const ctx = setup();
  const { code } = ctx.rooms.create(user(1), { trackId: TRACK, laps: 5 });
  ctx.rooms.leave('u1');
  assert.equal(ctx.rooms.rooms.has(code), false);
  assert.equal(ctx.lastTo('u1', 'room').room, null);
});

test('ready needs a car, and only the host changes settings', async () => {
  const ctx = setup();
  const { code } = ctx.rooms.create(user(1), { trackId: TRACK, laps: 5 });
  ctx.rooms.join(user(2), code);
  assert.match(ctx.rooms.setReady('u2', true).error, /car/);
  await ctx.rooms.setCar('u2', { kind: 'stock', id: 'gr-supra' });
  assert.deepEqual(ctx.rooms.setReady('u2', true), { ok: true });
  assert.match(ctx.rooms.updateSettings('u2', { laps: 3 }).error, /host/);
  assert.deepEqual(ctx.rooms.updateSettings('u1', { laps: 3 }), { ok: true });
  const room = ctx.rooms.rooms.get(code);
  assert.equal(room.laps, 3);
  assert.equal(room.trackId, TRACK, 'unsent settings are kept');
  assert.equal(room.members.get('u2').ready, false, 'new settings clear ready');
});

test('car choices are validated', async () => {
  const ctx = setup();
  ctx.rooms.create(user(1), { trackId: TRACK, laps: 5 });
  assert.ok((await ctx.rooms.setCar('u1', { kind: 'stock', id: 'not-a-car' })).error);
  assert.ok((await ctx.rooms.setCar('u1', { kind: 'rocket', id: 'mazda-mx5' })).error);
  assert.ok((await ctx.rooms.setCar('u1', 'mazda-mx5')).error);
  assert.ok((await ctx.rooms.setCar('u1', { kind: 'stock', id: 'x'.repeat(100) })).error);
});

test('players can only race their own builds', async () => {
  const mine = await createBuild('owner', { name: 'Track Rat', carCardId: 'car:mazda-mx5', parts: {} });
  const ctx = setup();
  const { code } = ctx.rooms.create({ id: 'owner', name: 'Owner' }, { trackId: TRACK, laps: 5 });
  ctx.rooms.join({ id: 'thief', name: 'Thief' }, code);
  assert.match((await ctx.rooms.setCar('thief', { kind: 'build', id: mine.id })).error, /garage/);
  assert.deepEqual(await ctx.rooms.setCar('owner', { kind: 'build', id: mine.id }), { ok: true });
  const car = ctx.rooms.rooms.get(code).members.get('owner').car;
  assert.equal(car.name, 'Track Rat');
  assert.equal(car.baseName, 'Mazda MX-5 (ND)');
  assert.ok(car.stats.lapTime > 0);
});

test('a slow car lookup never overwrites a newer pick', async () => {
  let release;
  const slow = new Promise((r) => { release = r; });
  const ctx = setup({
    resolveCar: async (userId, choice) => {
      if (choice.id === 'mazda-mx5') await slow;
      return resolvePlayerCar(userId, choice);
    },
  });
  ctx.rooms.create(user(1), { trackId: TRACK, laps: 5 });
  const first = ctx.rooms.setCar('u1', { kind: 'stock', id: 'mazda-mx5' });
  await ctx.rooms.setCar('u1', { kind: 'stock', id: 'gr-supra' });
  release();
  await first;
  assert.equal(ctx.rooms.roomOf('u1').members.get('u1').car.id, 'gr-supra');
});

test('start checks the grid', async () => {
  const ctx = setup();
  const { code } = ctx.rooms.create(user(1), { trackId: TRACK, laps: 2 });
  await ctx.rooms.setCar('u1', { kind: 'stock', id: 'mazda-mx5' });
  assert.match((await ctx.rooms.start('u1')).error, /at least 2/);
  ctx.rooms.join(user(2), code);
  assert.match((await ctx.rooms.start('u1')).error, /picked a car/);
  await ctx.rooms.setCar('u2', { kind: 'stock', id: 'gr-supra' });
  assert.match((await ctx.rooms.start('u1')).error, /ready/);
  ctx.rooms.setReady('u2', true);
  assert.match((await ctx.rooms.start('u2')).error, /host/);
});

test('a started race reaches every player with the same result', async () => {
  const ctx = setup();
  const code = await readyRoom(ctx, 3);
  assert.deepEqual(await ctx.rooms.start('u1'), { ok: true });

  const raceMsgs = ctx.sent.filter((s) => s.msg.type === 'race');
  assert.equal(raceMsgs.length, 1, 'one broadcast');
  assert.deepEqual(raceMsgs[0].ids.sort(), ['u1', 'u2', 'u3']);
  const { race, startAt, speed, entryByUser } = raceMsgs[0].msg;
  assert.equal(startAt, ctx.clock.t + COUNTDOWN_MS);
  assert.equal(speed, LIVE_SPEED);
  assert.deepEqual(entryByUser, { u1: 'p1', u2: 'p2', u3: 'p3' });
  assert.equal(race.entries.length, 3);
  assert.deepEqual(race.entries.map((e) => e.driver).sort(), ['Driver 1', 'Driver 2', 'Driver 3']);
  assert.ok(race.results.every((r) => r.driver), 'results name the drivers');

  const room = ctx.rooms.rooms.get(code);
  assert.equal(room.state, 'racing');
  assert.equal(room.race.endsAt, startAt + (race.timeline.duration / LIVE_SPEED) * 1000 + RESULTS_GRACE_MS);
  assert.ok(ctx.rooms.join(user(9), code).error, 'no joining mid-race');
  assert.ok((await ctx.rooms.setCar('u2', { kind: 'stock', id: 'gr-supra' })).error, 'no car swaps mid-race');

  // Reconnecting mid-race gets the race again.
  ctx.rooms.disconnect('u2');
  assert.equal(ctx.rooms.connect(user(2)).race.startAt, startAt);
});

test('the room returns to the lobby with results after the race', async () => {
  const ctx = setup();
  const code = await readyRoom(ctx, 2);
  await ctx.rooms.start('u1');
  const room = ctx.rooms.rooms.get(code);
  ctx.clock.t = room.race.endsAt - 1;
  ctx.rooms.tick();
  assert.equal(room.state, 'racing');
  ctx.clock.t = room.race.endsAt;
  ctx.rooms.tick();
  assert.equal(room.state, 'lobby');
  assert.equal(room.race, null);
  assert.equal(room.lastResult.length, 2);
  assert.deepEqual(room.lastResult.map((r) => r.position), [1, 2]);
  assert.ok(room.lastResult.every((r) => r.userId === 'u1' || r.userId === 'u2'));
  assert.ok([...room.members.values()].every((m) => !m.ready), 'everyone readies up again');
});

test('a build deleted before the start stops the race and frees the slot', async () => {
  const build = await createBuild('u2', { name: 'Ghost', carCardId: 'car:gr-supra', parts: {} });
  const ctx = setup();
  const { code } = ctx.rooms.create(user(1), { trackId: TRACK, laps: 2 });
  ctx.rooms.join(user(2), code);
  await ctx.rooms.setCar('u1', { kind: 'stock', id: 'mazda-mx5' });
  await ctx.rooms.setCar('u2', { kind: 'build', id: build.id });
  ctx.rooms.setReady('u2', true);
  await deleteBuild('u2', build.id);

  const res = await ctx.rooms.start('u1');
  assert.match(res.error, /Driver 2 needs to pick another car/);
  const room = ctx.rooms.rooms.get(code);
  assert.equal(room.state, 'lobby');
  assert.equal(room.starting, false);
  assert.equal(room.members.get('u2').car, null);
});

test('someone leaving while cars load cancels the start', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const ctx = setup({
    resolveCar: async (userId, choice) => { await gate; return resolvePlayerCar(userId, choice); },
  });
  const { code } = ctx.rooms.create(user(1), { trackId: TRACK, laps: 2 });
  ctx.rooms.join(user(2), code);
  ctx.rooms.join(user(3), code);
  for (const id of ['u1', 'u2', 'u3']) {
    const pick = ctx.rooms.setCar(id, { kind: 'stock', id: 'mazda-mx5' });
    release();
    await pick;
  }
  ctx.rooms.setReady('u2', true);
  ctx.rooms.setReady('u3', true);

  let open;
  const gate2 = new Promise((r) => { open = r; });
  ctx.rooms.resolveCar = async (userId, choice) => { await gate2; return resolvePlayerCar(userId, choice); };
  const starting = ctx.rooms.start('u1');
  assert.ok(ctx.rooms.join(user(4), code).error, 'no joining while the start loads');
  ctx.rooms.leave('u3');
  open();
  assert.match((await starting).error, /grid changed/);
  assert.equal(ctx.rooms.rooms.get(code).state, 'lobby');
});

test('kicked players are told and cannot rejoin', () => {
  const ctx = setup();
  const { code } = ctx.rooms.create(user(1), { trackId: TRACK, laps: 5 });
  ctx.rooms.join(user(2), code);
  assert.ok(ctx.rooms.kick('u2', 'u1').error, 'guests cannot kick');
  assert.ok(ctx.rooms.kick('u1', 'u1').error, 'host cannot kick themselves');
  assert.deepEqual(ctx.rooms.kick('u1', 'u2'), { ok: true });
  assert.equal(ctx.lastTo('u2', 'room').reason, 'kicked');
  assert.match(ctx.rooms.join(user(2), code).error, /removed/);
});

test('players who drop out of the lobby lose their spot after the grace period', () => {
  const ctx = setup();
  const { code } = ctx.rooms.create(user(1), { trackId: TRACK, laps: 5 });
  ctx.rooms.join(user(2), code);
  ctx.rooms.disconnect('u1');
  const room = ctx.rooms.rooms.get(code);
  assert.equal(room.members.get('u1').connected, false);

  ctx.clock.t += DISCONNECT_GRACE_MS - 1;
  ctx.rooms.tick();
  assert.ok(room.members.has('u1'), 'still inside the grace period');

  ctx.rooms.connect(user(1));
  ctx.rooms.disconnect('u1');
  ctx.clock.t += DISCONNECT_GRACE_MS;
  ctx.rooms.tick();
  assert.equal(room.members.has('u1'), false);
  assert.equal(room.hostId, 'u2', 'host passes to a connected player');
});
