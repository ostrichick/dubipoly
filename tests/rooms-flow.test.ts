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
  rooms.clear();
  // Actual SQLite SQL/constraints, with the small async D1 interface adapter.
  globalThis.__DUBIPOLY_ENV__ = {
    DB: {
      prepare(sql: string) {
        return {
          bind(...args: Array<string | number>) {
            const statement = () => sqlite.prepare(sql.replace(/\?\d+/g, '?'));
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
    await GET(new Request(`http://test/api/rooms?room=${code}&token=${token}`)),
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

test('new room codes remain distinct and existing two-digit rooms can be joined', async () => {
  const first = await post({ action: 'create' }, 201);
  const second = await post({ action: 'create' }, 201);
  assert.notEqual(first.roomCode, second.roomCode);
  const room = (await loadRoom(first.roomCode))!;
  room.storedAt = undefined;
  assert.equal(await persistRoom('27', room), true);
  rooms.clear();
  const oldRoom = await read('27', first.token);
  assert.equal(oldRoom.roomCode, '27');
  const joined = await post({ action: 'join', roomCode: '27', name: 'Legacy guest' });
  assert.equal(joined.names[1], 'Legacy guest');
  await post({ action: 'join', roomCode: 'SHORT' }, 400);
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
  await action(host.roomCode, { type: 'reaction', token: host.token, emoji: '😍' }, 409);
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
    409,
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
