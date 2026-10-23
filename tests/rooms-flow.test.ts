/* oxlint-disable typescript/no-floating-promises */
import assert from 'node:assert/strict';
import test, { beforeEach, afterEach, mock } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { GET, POST } from '../app/api/rooms/route.ts';
import { POST as actionPost } from '../app/api/rooms/[roomCode]/actions/route.ts';
import {
  rooms,
  loadRoom,
  persistRoom,
  roomSnapshot,
} from '../lib/server-rooms.ts';
import { board } from '../lib/board.ts';
import { assets, restore, rules, type Game } from '../lib/game.ts';

type Snapshot = ReturnType<typeof roomSnapshot> & {
  token: string;
  playerIndex: number;
  error?: string;
  role?: 'host' | 'guest';
};
let sqlite: DatabaseSync;
let failReads = false,
  failWrites = false;
let forcedRoomRandom: number[] | null = null;
let beforeSweepDelete: ((code: string) => void) | null = null;
beforeEach(() => {
  let seed = 42719;
  mock.method(crypto, 'getRandomValues', (array: Uint32Array) => {
    if (forcedRoomRandom) {
      for (let i = 0; i < array.length; i++)
        array[i] = forcedRoomRandom[i % forcedRoomRandom.length];
      return array;
    }
    for (let i = 0; i < array.length; i++) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      array[i] = seed >>> 0;
    }
    return array;
  });
  sqlite = new DatabaseSync(':memory:');
  for (const file of ['0000_create_rooms.sql', '0001_room_presence.sql']) {
    sqlite.exec(
      readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'),
    );
  }
  failReads = false;
  failWrites = false;
  forcedRoomRandom = null;
  beforeSweepDelete = null;
  rooms.clear();
  // Actual SQLite SQL/constraints, with the small async D1 interface adapter.
  globalThis.__DUBIPOLY_ENV__ = {
    DB: {
      prepare(sql: string) {
        return {
          bind(...args: Array<string | number>) {
            const statement = () => sqlite.prepare(sql);
            return {
              async first() {
                if (failReads) throw Error('Injected read outage');
                return statement().get(...args) ?? null;
              },
              async all() {
                if (failReads) throw Error('Injected read outage');
                return { results: statement().all(...args) };
              },
              async run() {
                if (failWrites) throw Error('Injected write outage');
                if (sql.startsWith('DELETE FROM dubipoly_rooms WHERE room_code') && beforeSweepDelete)
                  beforeSweepDelete(String(args[0]));
                return {
                  meta: { changes: Number(statement().run(...args).changes) },
                };
              },
            };
          },
        };
      },
    } as unknown as import('@cloudflare/workers-types').D1Database,
  };
});
afterEach(() => {
  mock.restoreAll();
  globalThis.__DUBIPOLY_ENV__ = undefined;
  rooms.clear();
  sqlite.close();
});
function request(body: unknown) {
  return new Request('http://test/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
async function result(response: Response, status = 200) {
  const body = (await response.json()) as Snapshot;
  assert.equal(response.status, status, JSON.stringify(body));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  return body;
}
async function post(body: unknown, status = 200) {
  return result(await POST(request(body)), status);
}
async function read(code: string, token: string) {
  rooms.clear(); // Simulate a different/cold Worker; never rely on shared process memory.
  return result(
    await GET(
      new Request(`http://test/api/rooms?room=${code}`, {
        headers: { 'X-Room-Token': token },
      }),
    ),
  );
}
async function pair() {
  const host = await post({ action: 'create' }, 201);
  assert.match(host.roomCode, /^[A-HJ-NP-Z2-9]{10}$/);
  const guest = await post({ action: 'join', roomCode: host.roomCode });
  assert.notEqual(host.token, guest.token);
  assert.deepEqual(guest.names, ['Traveler 1', 'Traveler 2']);
  const started = await post({
    action: 'start',
    roomCode: host.roomCode,
    token: host.token,
  });
  return { code: host.roomCode, tokens: [host.token, guest.token], started };
}
async function action(code: string, body: unknown, status = 200) {
  return result(
    await actionPost(request(body), {
      params: Promise.resolve({ roomCode: code }),
    }),
    status,
  );
}
async function equalPlayers(code: string, tokens: string[]) {
  const a = await read(code, tokens[0]),
    b = await read(code, tokens[1]);
  assert.equal(a.playerIndex, 0);
  assert.equal(b.playerIndex, 1);
  assert.equal(a.matchId, b.matchId);
  assert.deepEqual(a.game, b.game);
  assert.deepEqual(a.save, b.save);
  assert.equal(a.token, undefined);
  assert.equal(b.token, undefined);
  return a;
}

test('two independent identities: authorization, name changes, rejoin, heartbeat isolation', async () => {
  const { code, tokens, started } = await pair();
  await post({ action: 'join', roomCode: code }, 409);
  await post({ action: 'start', roomCode: code, token: tokens[1] }, 403);
  await post(
    { action: 'rename', roomCode: code, token: 'stranger', name: 'x' },
    403,
  );
  await post(
    { action: 'rename', roomCode: code, token: tokens[1], name: '  ' },
    400,
  );
  await post({
    action: 'rename',
    roomCode: code,
    token: tokens[0],
    name: 'Dubu Korea',
  });
  await post({
    action: 'rename',
    roomCode: code,
    token: tokens[1],
    name: 'Dubi Perú',
  });
  const before = (await loadRoom(code))!.storedAt;
  const snapshot = await equalPlayers(code, tokens);
  assert.equal(
    (await loadRoom(code))!.storedAt,
    before,
    'heartbeat must not write game row',
  );
  assert.deepEqual(
    snapshot.game!.players.map((p) => p.name),
    ['Dubu Korea', 'Dubi Perú'],
  );
  assert.equal(snapshot.game!.revision, started.game!.revision);
  assert.deepEqual(
    restore(JSON.stringify(snapshot.save))!.game,
    snapshot.game,
    'renaming must not leave a revision unsupported by the replay journal',
  );
  assert.equal(
    (await post({ action: 'join', roomCode: code, token: tokens[0] })).token,
    tokens[0],
  );
});

test('new room codes remain distinct and retired two-digit codes are rejected', async () => {
  const first = await post({ action: 'create' }, 201);
  const second = await post({ action: 'create' }, 201);
  assert.notEqual(first.roomCode, second.roomCode);
  await post({ action: 'join', roomCode: '27', name: 'Legacy guest' }, 400);
  await post({ action: 'join', roomCode: 'SHORT' }, 400);
});

test('client-generated join token survives a lost response and cannot claim another seat', async () => {
  const host = await post({ action: 'create' }, 201);
  const proposedToken = crypto.randomUUID();
  const initial = await POST(request({
    action: 'join', roomCode: host.roomCode, name: 'Guest', token: proposedToken,
  }));
  assert.equal(initial.status, 200);
  // Client loses this successful response before saving any returned payload.
  rooms.clear();

  const retried = await post({
    action: 'join', roomCode: host.roomCode, name: 'Guest', token: proposedToken,
  });
  assert.equal(retried.token, proposedToken);
  assert.equal(retried.role, 'guest');
  assert.equal(retried.players, 2);
  assert.equal(retried.names[1], 'Guest');
  assert.equal(JSON.stringify(retried).includes(host.token), false);
  assert.equal((await post({ action: 'join', roomCode: host.roomCode, token: host.token })).role, 'host');

  const stranger = crypto.randomUUID();
  const rejected = await post({ action: 'join', roomCode: host.roomCode, token: stranger }, 409);
  assert.equal(rejected.error, 'ROOM_FULL');
  assert.equal(JSON.stringify(rejected).includes(host.token), false);
  assert.equal(JSON.stringify(rejected).includes(proposedToken), false);
  assert.equal((await post({
    action: 'rename', roomCode: host.roomCode, token: stranger, name: 'Impostor',
  }, 403)).error, 'INVALID_PLAYER');
  assert.equal((await result(await GET(new Request(
    `http://test/api/rooms?room=${host.roomCode}&token=${stranger}`,
  )), 403)).error, 'INVALID_PLAYER');
  const saved = (await loadRoom(host.roomCode))!;
  assert.deepEqual(saved.players.map((player) => player.token), [host.token, proposedToken]);
});

test('join rejects invalid proposed tokens before occupying a vacant seat', async () => {
  const host = await post({ action: 'create' }, 201);
  for (const token of ['not-a-uuid', '00000000-0000-0000-0000-000000000000', '', 123, {}]) {
    const failed = await post({ action: 'join', roomCode: host.roomCode, token }, 400);
    assert.equal(failed.error, 'INVALID_TOKEN');
  }
  assert.equal((await loadRoom(host.roomCode))!.players.length, 1);
  const guest = await post({ action: 'join', roomCode: host.roomCode, token: crypto.randomUUID() });
  assert.equal(guest.players, 2);
  await post({ action: 'join', roomCode: host.roomCode, token: crypto.randomUUID() }, 409);
  const legacy = await post({ action: 'create' }, 201);
  const legacyGuest = await post({ action: 'join', roomCode: legacy.roomCode, token: null });
  assert.match(legacyGuest.token, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});

test('two different proposed guest tokens cannot win the same seat', async () => {
  const host = await post({ action: 'create' }, 201);
  const candidates = [crypto.randomUUID(), crypto.randomUUID()];
  const responses = await Promise.all(candidates.map((token) => POST(request({
    action: 'join', roomCode: host.roomCode, token,
  }))));
  assert.deepEqual(responses.map((response) => response.status).sort((a, b) => a - b), [200, 409]);
  const stored = (await loadRoom(host.roomCode))!;
  assert.equal(stored.players.length, 2);
  assert.ok(candidates.includes(stored.players[1].token));
  assert.equal(stored.players[0].token, host.token);
});

test('room creation retries bounded random collisions without enumerating other codes', async () => {
  forcedRoomRandom = [0];
  const first = await post({ action: 'create' }, 201);
  assert.equal(first.roomCode, '2222222222');
  const exhausted = await post({ action: 'create' }, 503);
  assert.equal(exhausted.error, 'NO_ROOM_CODES');
  forcedRoomRandom = null;
  const next = await post({ action: 'create' }, 201);
  assert.notEqual(next.roomCode, first.roomCode);
});

test('renaming after a played action preserves the save/replay revision', async () => {
  const { code, tokens, started } = await pair();
  const played = await action(code, {
    token: tokens[0], matchId: started.matchId, revision: 0,
    requestId: 'rename-replay', type: 'roll',
  });
  const renamed = await post({ action: 'rename', roomCode: code, token: tokens[0], name: 'Updated traveler' });
  assert.equal(renamed.game!.revision, played.game!.revision);
  assert.deepEqual(restore(JSON.stringify(renamed.save))!.game, renamed.game);
});

test('expired D1 rooms cannot be read, joined, or acted upon', async () => {
  const host = await post({ action: 'create' }, 201);
  await read(host.roomCode, host.token);
  const room = (await loadRoom(host.roomCode))!;
  const oldTime = Date.now() - 6 * 60 * 60 * 1000 - 1000;
  const stale = {
    ...room, createdAt: oldTime,
    players: room.players.map((player) => ({ ...player, lastSeen: oldTime })),
  };
  sqlite.prepare('UPDATE dubipoly_rooms SET payload = ?, updated_at = ? WHERE room_code = ?')
    .run(JSON.stringify({ ...stale, processed: [...stale.processed] }), oldTime, host.roomCode);
  sqlite.prepare('UPDATE dubipoly_presence SET last_seen = ? WHERE room_code = ?')
    .run(oldTime, host.roomCode);
  rooms.clear();
  await result(await GET(new Request(`http://test/api/rooms?room=${host.roomCode}&token=${host.token}`)), 404);
  await post({ action: 'join', roomCode: host.roomCode }, 404);
  await action(host.roomCode, { type: 'reaction', token: host.token, emoji: '💪' }, 404);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM dubipoly_rooms WHERE room_code = ?').get(host.roomCode)?.count, 0);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM dubipoly_presence WHERE room_code = ?').get(host.roomCode)?.count, 0);
});

test('recent game updates and heartbeats prevent eviction of rooms older than six hours', async () => {
  const host = await post({ action: 'create' }, 201);
  await read(host.roomCode, host.token);
  const room = (await loadRoom(host.roomCode))!;
  const oldTime = Date.now() - 6 * 60 * 60 * 1000 - 1000;
  const stalePayload = JSON.stringify({
    ...room, createdAt: oldTime,
    players: room.players.map((player) => ({ ...player, lastSeen: oldTime })),
    processed: [...room.processed],
  });
  // A recent game write should keep the room alive even when creation is old.
  sqlite.prepare('UPDATE dubipoly_rooms SET payload = ? WHERE room_code = ?')
    .run(stalePayload, host.roomCode);
  rooms.clear();
  await read(host.roomCode, host.token);

  // With an old game row, the independently persisted heartbeat keeps it alive.
  sqlite.prepare('UPDATE dubipoly_rooms SET payload = ?, updated_at = ? WHERE room_code = ?')
    .run(stalePayload, oldTime, host.roomCode);
  rooms.clear();
  await read(host.roomCode, host.token);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM dubipoly_rooms WHERE room_code = ?').get(host.roomCode)?.count, 1);
});

test('room creation sweeps at most four idle expired D1 rooms and orphan presence', async () => {
  const expired = await Promise.all(Array.from({ length: 6 }, () => post({ action: 'create' }, 201)));
  const recentHeartbeat = await post({ action: 'create' }, 201);
  const active = await post({ action: 'create' }, 201);
  const oldTime = Date.now() - 6 * 60 * 60 * 1000 - 1000;
  for (const room of [...expired, recentHeartbeat]) {
    const staleAt = room.roomCode === expired[0].roomCode ? oldTime - 1000 : oldTime;
    const row = sqlite.prepare('SELECT payload FROM dubipoly_rooms WHERE room_code = ?')
      .get(room.roomCode) as { payload: string };
    const payload = JSON.parse(row.payload);
    payload.createdAt = staleAt;
    for (const player of payload.players) player.lastSeen = staleAt;
    sqlite.prepare('UPDATE dubipoly_rooms SET payload = ?, updated_at = ? WHERE room_code = ?')
      .run(JSON.stringify(payload), staleAt, room.roomCode);
  }
  for (const room of [expired[0], recentHeartbeat]) {
    sqlite.prepare('INSERT INTO dubipoly_presence (room_code, token, last_seen) VALUES (?, ?, ?)')
      .run(room.roomCode, room.token, room === recentHeartbeat ? Date.now() : oldTime);
  }
  rooms.clear();

  await post({ action: 'create' }, 201);
  const countExpired = () => expired.filter((room) => sqlite.prepare(
    'SELECT 1 FROM dubipoly_rooms WHERE room_code = ?',
  ).get(room.roomCode)).length;
  assert.equal(countExpired(), 2, 'one request removes at most four stale rooms');
  assert.ok(sqlite.prepare('SELECT 1 FROM dubipoly_rooms WHERE room_code = ?').get(recentHeartbeat.roomCode));
  assert.ok(sqlite.prepare('SELECT 1 FROM dubipoly_rooms WHERE room_code = ?').get(active.roomCode));
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS total FROM dubipoly_presence WHERE room_code = ?')
    .get(expired[0].roomCode)?.total, 0, 'old presence is removed with its expired room');

  await post({ action: 'create' }, 201);
  assert.equal(countExpired(), 0);
  assert.ok(sqlite.prepare('SELECT 1 FROM dubipoly_rooms WHERE room_code = ?').get(recentHeartbeat.roomCode));
});

test('sweep preserves rows with a heartbeat or CAS write racing the DELETE', async () => {
  const heartbeatRoom = await post({ action: 'create' }, 201);
  const updatedRoom = await post({ action: 'create' }, 201);
  const oldTime = Date.now() - 6 * 60 * 60 * 1000 - 1000;
  for (const room of [heartbeatRoom, updatedRoom]) {
    const row = sqlite.prepare('SELECT payload FROM dubipoly_rooms WHERE room_code = ?')
      .get(room.roomCode) as { payload: string };
    const payload = JSON.parse(row.payload);
    payload.createdAt = oldTime;
    payload.players.forEach((player: { lastSeen: number }) => { player.lastSeen = oldTime; });
    sqlite.prepare('UPDATE dubipoly_rooms SET payload = ?, updated_at = ? WHERE room_code = ?')
      .run(JSON.stringify(payload), oldTime, room.roomCode);
  }
  rooms.clear();
  beforeSweepDelete = (code) => {
    if (code === heartbeatRoom.roomCode) {
      sqlite.prepare('INSERT INTO dubipoly_presence (room_code, token, last_seen) VALUES (?, ?, ?)')
        .run(code, heartbeatRoom.token, Date.now());
    } else if (code === updatedRoom.roomCode) {
      sqlite.prepare('UPDATE dubipoly_rooms SET updated_at = ? WHERE room_code = ?')
        .run(Date.now(), code);
    }
  };
  await post({ action: 'create' }, 201);
  beforeSweepDelete = null;
  for (const room of [heartbeatRoom, updatedRoom]) {
    assert.ok(sqlite.prepare('SELECT 1 FROM dubipoly_rooms WHERE room_code = ?').get(room.roomCode));
  }
});

test('authenticated heartbeat polls eventually sweep other idle rooms without new creations', async () => {
  const idle = await post({ action: 'create' }, 201);
  const active = await post({ action: 'create' }, 201);
  const oldTime = Date.now() - 6 * 60 * 60 * 1000 - 1000;
  const oldRow = sqlite.prepare('SELECT payload FROM dubipoly_rooms WHERE room_code = ?')
    .get(idle.roomCode) as { payload: string };
  const payload = JSON.parse(oldRow.payload);
  payload.createdAt = oldTime;
  for (const player of payload.players) player.lastSeen = oldTime;
  sqlite.prepare('UPDATE dubipoly_rooms SET payload = ?, updated_at = ? WHERE room_code = ?')
    .run(JSON.stringify(payload), oldTime, idle.roomCode);
  rooms.clear();

  const realNow = Date.now();
  mock.method(Date, 'now', () => realNow + 2 * 60_000);
  const refreshed = await result(await GET(new Request(
    `http://test/api/rooms?room=${active.roomCode}&token=${active.token}`,
  )));
  assert.equal(refreshed.roomCode, active.roomCode);
  assert.equal(sqlite.prepare('SELECT 1 FROM dubipoly_rooms WHERE room_code = ?')
    .get(idle.roomCode), undefined);
});

test('missing Worker D1 binding fails closed even with a cached room', async () => {
  const host = await post({ action: 'create' }, 201);
  const actualEnv = globalThis.__DUBIPOLY_ENV__;
  globalThis.__DUBIPOLY_ENV__ = {};
  try {
    await post({ action: 'create' }, 503);
    await result(await GET(new Request(`http://test/api/rooms?room=${host.roomCode}&token=${host.token}`)), 503);
    await action(host.roomCode, { type: 'reaction', token: host.token }, 503);
  } finally {
    globalThis.__DUBIPOLY_ENV__ = actualEnv;
  }
});

test('failed reaction persistence does not acknowledge delivery or leak into D1', async () => {
  const host = await post({ action: 'create' }, 201);
  failWrites = true;
  const failed = await action(host.roomCode, { type: 'reaction', token: host.token, emoji: '😍' }, 503);
  assert.equal(failed.error, 'STORAGE_UNAVAILABLE');
  failWrites = false;
  rooms.clear();
  const snapshot = await read(host.roomCode, host.token);
  assert.equal(snapshot.reaction, null);
});

test('concurrent rolls apply once, duplicate returns latest state, stale/out-of-turn rejected', async () => {
  const { code, tokens, started } = await pair();
  const body = {
    token: tokens[0],
    matchId: started.matchId,
    revision: 0,
    requestId: 'roll-once',
    type: 'roll',
  };
  const [a, b] = await Promise.all([action(code, body), action(code, body)]);
  assert.deepEqual(a.game, b.game);
  assert.equal(a.game!.revision, 1);
  await action(
    code,
    { ...body, token: tokens[1], requestId: 'other-player', revision: 1 },
    409,
  );
  await action(code, { ...body, requestId: 'stale' }, 409);
  await action(code, { ...body, requestId: 'end', revision: 1, type: 'end' });
  const retry = await action(code, body);
  assert.equal(
    retry.game!.revision,
    2,
    'old duplicate must not return revision 1',
  );
  await equalPlayers(code, tokens);
});

test('two clients disconnect and reconnect independently without changing seats or game state', async () => {
  const { code, tokens, started } = await pair();
  await read(code, tokens[0]);
  const guestBefore = await read(code, tokens[1]);
  assert.deepEqual(guestBefore.presence, [{ connected: true }, { connected: true }]);

  // Simulate the host phone being closed while the guest is still polling.
  const offlineAt = Date.now() - 9000;
  sqlite.prepare('UPDATE dubipoly_presence SET last_seen = ? WHERE room_code = ? AND token = ?')
    .run(offlineAt, code, tokens[0]);
  rooms.clear(); // The next request is handled by a new Worker instance.
  const guestWhileHostOffline = await read(code, tokens[1]);
  assert.deepEqual(guestWhileHostOffline.presence, [{ connected: false }, { connected: true }]);
  assert.equal(guestWhileHostOffline.game!.revision, started.game!.revision);

  // Reloading with the stored host token restores the original seat.
  const hostRejoined = await post({ action: 'join', roomCode: code, token: tokens[0] });
  assert.equal(hostRejoined.role, 'host');
  assert.equal(hostRejoined.token, tokens[0]);
  assert.equal(hostRejoined.players, 2);
  const hostAfterReconnect = await read(code, tokens[0]);
  const guestAfterReconnect = await read(code, tokens[1]);
  assert.deepEqual(guestAfterReconnect.presence, [{ connected: true }, { connected: true }]);
  assert.deepEqual(hostAfterReconnect.game, guestAfterReconnect.game);
  assert.deepEqual(hostAfterReconnect.save, guestAfterReconnect.save);
  await post({ action: 'join', roomCode: code }, 409);
});

test('two independent clients recover stale polls and actions, then reload after rematch', async () => {
  const { code, tokens, started } = await pair();
  const guestCached = await read(code, tokens[1]);
  const fastUrl = (token: string, match: string, revision: number) =>
    `http://test/api/rooms?room=${code}&token=${token}&sync=1&match=${match}&revision=${revision}`;

  const unchanged = await GET(new Request(fastUrl(tokens[1], started.matchId, 0)));
  assert.equal(unchanged.status, 204);
  assert.equal(unchanged.headers.get('cache-control'), 'no-store');

  const rolled = await action(code, {
    token: tokens[0], matchId: started.matchId, revision: 0,
    requestId: 'host-after-guest-poll', type: 'roll',
  });
  const guestUpdate = await result(await GET(new Request(fastUrl(tokens[1], guestCached.matchId, 0))));
  assert.equal(guestUpdate.game!.revision, rolled.game!.revision);
  assert.deepEqual(guestUpdate.game, rolled.game);

  const stale = await action(code, {
    token: tokens[0], matchId: started.matchId, revision: 0,
    requestId: 'new-stale-action', type: 'end',
  }, 409);
  assert.equal(stale.error, 'STALE_STATE');
  const refreshed = await read(code, tokens[0]);
  const ended = await action(code, {
    token: tokens[0], matchId: refreshed.matchId, revision: refreshed.game!.revision,
    requestId: 'end-after-refresh', type: 'end',
  });
  assert.ok(ended.game!.revision > refreshed.game!.revision);
  assert.deepEqual((await read(code, tokens[1])).game, ended.game);

  // A host rematch remains visible even to a client holding a newer revision
  // from the old match, and neither device can replay old-match actions.
  const room = (await loadRoom(code))!;
  room.game!.phase = 'finished';
  assert.equal(await persistRoom(code, room), true);
  const reset = await post({
    action: 'rematch', roomCode: code, token: tokens[0], matchId: started.matchId,
  });
  assert.notEqual(reset.matchId, started.matchId);
  const guestAfterRematch = await result(
    await GET(new Request(fastUrl(tokens[1], started.matchId, ended.game!.revision))),
  );
  assert.equal(guestAfterRematch.matchId, reset.matchId);
  assert.equal(guestAfterRematch.game!.revision, 0);
  assert.equal((await post({ action: 'join', roomCode: code, token: tokens[1] })).role, 'guest');
  const rejected = await action(code, {
    token: tokens[1], matchId: started.matchId, revision: ended.game!.revision,
    requestId: 'old-match-guest', type: 'roll',
  }, 409);
  assert.equal(rejected.error, 'STALE_MATCH');
  assert.deepEqual((await equalPlayers(code, tokens)).game, reset.game);
});

test('complete online game and rematch: every action matches both players and replay', async () => {
  const { code, tokens, started } = await pair();
  let snapshot = started,
    checked = 0;
  while (snapshot.game!.phase !== 'finished') {
    const g = snapshot.game!,
      player = g.players[g.current],
      city = board[player.position],
      prop = g.properties[player.position];
    const type =
      g.pendingPayment?.type === 'rent'
        ? 'payRent'
        : g.pendingPayment?.type === 'event'
          ? 'claimEvent'
          : g.phase === 'debt'
            ? (g.pendingDebt && player.cash >= g.pendingDebt.amount)
              ? 'payDebt'
              : 'bankrupt'
            : g.phase === 'roll'
              ? 'roll'
              : g.phase === 'choice' &&
                  !prop &&
                  city.price != null &&
                  player.cash > 500 + city.price
                ? 'buy'
                : g.phase === 'choice' &&
                    prop &&
                    prop.owner === g.current &&
                    prop.level < 3 &&
                    city.upgrade != null &&
                    player.cash > 500 + city.upgrade
                  ? 'upgrade'
                  : 'end';
    snapshot = await action(code, {
      token: tokens[g.current],
      matchId: snapshot.matchId,
      revision: g.revision,
      requestId: crypto.randomUUID(),
      type,
    });
    const synced = await equalPlayers(code, tokens);
    assert.deepEqual(snapshot.game, synced.game);
    assert.deepEqual(
      restore(JSON.stringify(snapshot.save))!.game,
      snapshot.game,
    );
    assert.ok(++checked <= 800, 'bounded complete game including doubles');
  }
  const g = snapshot.game!;
  assert.equal(g.reason, 'rounds');
  assert.equal(g.round, rules.rounds);
  const totals = [assets(g, 0), assets(g, 1)];
  assert.equal(
    g.winner,
    totals[0] === totals[1] ? 'tie' : totals[0] > totals[1] ? 0 : 1,
  );
  const saved = (await loadRoom(code))!;
  assert.ok(
    JSON.stringify([...saved.processed]).length < 20000,
    'deduplication storage must stay linear',
  );
  const reset = await post({
    action: 'rematch',
    roomCode: code,
    token: tokens[0],
    matchId: snapshot.matchId,
  });
  assert.notEqual(reset.matchId, snapshot.matchId);
  assert.equal(reset.game!.revision, 0);
  assert.deepEqual(
    reset.game!.players.map((p) => [p.cash, p.position]),
    [
      [1500, 0],
      [1500, 0],
    ],
  );
  assert.deepEqual(reset.game!.properties, {});
  assert.equal(reset.game!.winner, null);
  await action(
    code,
    {
      token: tokens[0],
      matchId: snapshot.matchId,
      revision: 0,
      requestId: 'old-match',
      type: 'roll',
    },
    409,
  );
  await post(
    {
      action: 'rematch',
      roomCode: code,
      token: tokens[1],
      matchId: reset.matchId,
    },
    403,
  );
  await equalPlayers(code, tokens);
  let step = await action(code, {
    token: tokens[0],
    matchId: reset.matchId,
    revision: 0,
    requestId: 'new-match',
    type: 'roll',
  });
  while (step.game!.current === 0 && step.game!.phase !== 'finished') {
    step = await action(code, {
      token: tokens[0],
      matchId: reset.matchId,
      revision: step.game!.revision,
      requestId: crypto.randomUUID(),
      type: step.game!.phase === 'roll' ? 'roll' : 'end',
    });
  }
  const final = await equalPlayers(code, tokens);
  assert.equal(final.game!.current, 1);
  console.log(
    JSON.stringify({
      scenario: 'complete-online-rounds-rematch',
      checkpoints: checked + 2,
      totals,
      winner: g.winner,
    }),
  );
});

test('storage outage never succeeds using a stale in-memory snapshot', async () => {
  const { code, tokens } = await pair();
  failReads = true;
  await post({ action: 'create' }, 503);
  await result(
    await GET(
      new Request(`http://test/api/rooms?room=${code}&token=${tokens[0]}`),
    ),
    503,
  );
  failReads = false;
  failWrites = true;
  await post({ action: 'create' }, 503);
  await post(
    { action: 'rename', roomCode: code, token: tokens[0], name: 'Not saved' },
    503,
  );
  failWrites = false;
  const synced = await equalPlayers(code, tokens);
  assert.equal(synced.names[0], 'Traveler 1');
});

test('bankruptcy result persists and both clients agree (explicit rule-edge fixture)', async () => {
  const { code, tokens, started } = await pair();
  const room = (await loadRoom(code))!;
  // Controlled fixture, not counted as a naturally played full game.
  room.game!.players[0].cash = 0;
  for (const city of board.filter((s) => s.type === 'city'))
    room.game!.properties[city.index] = { owner: 1, level: 3 };
  assert.equal(await persistRoom(code, room), true);
  let snapshot = await equalPlayers(code, tokens);
  for (let n = 0; n < 80 && snapshot.game!.phase !== 'finished'; n++) {
    const g: Game = snapshot.game!;
    snapshot = await action(code, {
      token: tokens[g.current],
      matchId: started.matchId,
      revision: g.revision,
      requestId: crypto.randomUUID(),
      type: g.phase === 'roll' ? 'roll' : 'end',
    });
  }
  assert.equal(snapshot.game!.reason, 'bankruptcy');
  assert.equal(snapshot.game!.winner, 1);
  await equalPlayers(code, tokens);
});
