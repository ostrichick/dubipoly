import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRoom, persistRoom, rooms } from '../lib/server-rooms.ts';

test('D1 room snapshots restore retry state and reject stale writers', async () => {
  const rows = new Map<string, { payload: string; updated_at: number }>();
  const database = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first() {
              const row = rows.get(String(args[0]));
              return row ? { payload: row.payload, updated_at: row.updated_at } : null;
            },
            async run() {
              const insert = sql.startsWith('INSERT');
              const roomCode = String(insert ? args[0] : args[2]);
              if (insert) {
                if (rows.has(roomCode)) return { meta: { changes: 0 } };
                rows.set(roomCode, { payload: String(args[1]), updated_at: Number(args[2]) });
                return { meta: { changes: 1 } };
              }
              const row = rows.get(roomCode);
              if (!row || row.updated_at !== Number(args[3])) return { meta: { changes: 0 } };
              rows.set(roomCode, { payload: String(args[0]), updated_at: Number(args[1]) });
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };

  // This test double implements only the prepared statements exercised here.
  globalThis.__DUBIPOLY_ENV__ = { DB: database as unknown as import('@cloudflare/workers-types').D1Database };
  rooms.clear();
  try {
    rooms.set('TEST01', {
      createdAt: Date.now(),
      names: ['Dubu', 'Dubi'],
      players: [],
      game: null,
      save: null,
      processed: new Map([['request-1', { revision: 1, snapshot: {} as never }]]),
    });

    assert.equal(await persistRoom('TEST01', rooms.get('TEST01')!), true);
    rooms.clear();
    const restored = await loadRoom('TEST01');
    assert.ok(restored?.processed.has('request-1'));

    const firstWriter = await loadRoom('TEST01');
    const staleWriter = await loadRoom('TEST01');
    assert.equal(await persistRoom('TEST01', firstWriter!), true);
    assert.equal(await persistRoom('TEST01', staleWriter!), false);
  } finally {
    rooms.clear();
    globalThis.__DUBIPOLY_ENV__ = undefined;
  }
});
