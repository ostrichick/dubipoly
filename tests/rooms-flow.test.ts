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
import { assets, restore, type Game } from '../lib/game.ts';

type Snapshot = ReturnType<typeof roomSnapshot> & {
  token: string;
  playerIndex: number;
  error?: string;
};
let sqlite: DatabaseSync;
let failReads = false,
  failWrites = false;
beforeEach(() => {
  let seed = 42719;
  mock.method(crypto, 'getRandomValues', (array: Uint32Array) => {
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
  assert.match(host.roomCode, /^\d{2}$/);
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
  assert.equal(snapshot.game!.revision, started.game!.revision + 2);
  assert.equal(
    (await post({ action: 'join', roomCode: code, token: tokens[0] })).token,
    tokens[0],
  );
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
      g.phase === 'roll'
        ? 'roll'
        : g.phase === 'choice' &&
            player.cash > 500 + (prop ? city.upgrade! : city.price!) &&
            (!prop || prop.level < 3)
          ? prop
            ? 'upgrade'
            : 'buy'
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
    assert.ok(++checked <= 400, 'bounded complete game including doubles');
  }
  const g = snapshot.game!;
  assert.equal(g.reason, 'rounds');
  assert.equal(g.round, 20);
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
  const rolled = await action(code, {
    token: tokens[0],
    matchId: reset.matchId,
    revision: 0,
    requestId: 'new-match',
    type: 'roll',
  });
  await action(code, {
    token: tokens[0],
    matchId: reset.matchId,
    revision: rolled.game!.revision,
    requestId: 'new-end',
    type: 'end',
  });
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
