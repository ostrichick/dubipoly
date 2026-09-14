import { createGame, type Game, type Save } from './game.ts';
import type { D1Database } from '@cloudflare/workers-types';

export type ServerRoom = {
  matchId?: string;
  createdAt: number;
  names: [string, string];
  players: Array<{ token: string; name: string; lastSeen: number }>;
  game: Game | null;
  save: Save | null;
  processed: Map<string, { revision: number; snapshot?: unknown }>;
  storedAt?: number;
};

export const rooms = new Map<string, ServerRoom>();

declare global {
  // The custom Worker wrapper exposes Cloudflare bindings to route handlers.
  var __DUBIPOLY_ENV__: { DB?: D1Database } | undefined;
}

function database() {
  return globalThis.__DUBIPOLY_ENV__?.DB;
}

function serialize(room: ServerRoom) {
  return JSON.stringify({
    matchId: room.matchId,
    createdAt: room.createdAt,
    names: room.names,
    players: room.players,
    game: room.game,
    save: room.save,
    processed: Array.from(room.processed.entries()),
  });
}

function deserialize(payload: string) {
  const value = JSON.parse(payload) as Omit<ServerRoom, 'processed'> & {
    processed?: Array<[string, { revision: number; snapshot?: unknown }]>;
  };
  return {
    ...value,
    processed: new Map(value.processed ?? []),
  } satisfies ServerRoom;
}

export async function loadRoom(roomCode: string) {
  const db = database();
  const existing = rooms.get(roomCode);
  if (!db) return existing ? structuredClone(existing) : undefined;
  const row = await db
    .prepare(
      'SELECT payload, updated_at FROM dubipoly_rooms WHERE room_code = ?1',
    )
    .bind(roomCode)
    .first<{ payload: string; updated_at: number }>();
  if (!row?.payload) return undefined;
  const room = deserialize(row.payload);
  room.storedAt = row.updated_at;
  rooms.set(roomCode, room);
  return room;
}

export async function persistRoom(roomCode: string, room: ServerRoom) {
  const db = database();
  if (!db) {
    const existing = rooms.get(roomCode);
    if (existing && existing.storedAt !== room.storedAt) return false;
    room.storedAt = Math.max(Date.now(), (room.storedAt ?? 0) + 1);
    rooms.set(roomCode, structuredClone(room));
    return true;
  }
  try {
    const updatedAt = Math.max(Date.now(), (room.storedAt ?? 0) + 1);
    const result =
      room.storedAt === undefined
        ? await db
            .prepare(
              'INSERT INTO dubipoly_rooms (room_code, payload, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(room_code) DO NOTHING',
            )
            .bind(roomCode, serialize(room), updatedAt)
            .run()
        : await db
            .prepare(
              'UPDATE dubipoly_rooms SET payload = ?1, updated_at = ?2 WHERE room_code = ?3 AND updated_at = ?4',
            )
            .bind(serialize(room), updatedAt, roomCode, room.storedAt)
            .run();
    if (result.meta.changes !== 1) return false;
    room.storedAt = updatedAt;
    rooms.set(roomCode, structuredClone(room));
    return true;
  } catch {
    return false;
  }
}

export function cleanupRooms() {
  const expiry = Date.now() - 1000 * 60 * 60 * 6;
  for (const [code, room] of rooms) {
    if (room.createdAt < expiry) rooms.delete(code);
  }
}

export function roomSnapshot(roomCode: string, room: ServerRoom) {
  return {
    matchId: room.matchId ?? 'legacy',
    roomCode,
    names: room.names,
    players: room.players.length,
    ready: room.players.length === 2,
    started: room.game !== null,
    game: room.game,
    save: room.save,
    presence: room.players.map((player) => ({
      connected: Date.now() - player.lastSeen < 8000,
    })),
  };
}

/** Presence does not change the game row or compete with game-state writes. */
export async function heartbeat(
  roomCode: string,
  room: ServerRoom,
  token: string,
) {
  const index = touchPlayer(room, token);
  if (index < 0) return -1;
  const db = database();
  if (db) {
    await db
      .prepare(
        'INSERT INTO dubipoly_presence (room_code, token, last_seen) VALUES (?1, ?2, ?3) ON CONFLICT(room_code, token) DO UPDATE SET last_seen = excluded.last_seen',
      )
      .bind(roomCode, token, Date.now())
      .run();
    const seen = await db
      .prepare(
        'SELECT token, last_seen FROM dubipoly_presence WHERE room_code = ?1',
      )
      .bind(roomCode)
      .all<{ token: string; last_seen: number }>();
    for (const player of room.players) {
      player.lastSeen =
        seen.results.find((row) => row.token === player.token)?.last_seen ??
        player.lastSeen;
    }
  } else {
    const stored = rooms.get(roomCode);
    const player = stored?.players.find((entry) => entry.token === token);
    if (player) player.lastSeen = Date.now();
  }
  return index;
}

export function touchPlayer(room: ServerRoom, token: string) {
  const player = room.players.find((entry) => entry.token === token);
  if (!player) return -1;
  player.lastSeen = Date.now();
  return room.players.indexOf(player);
}

export function startRoom(room: ServerRoom) {
  if (!room.game) {
    room.matchId = crypto.randomUUID();
    room.game = createGame(room.names);
    room.save = { version: 2, names: room.names, actions: [] };
  }
  return room;
}
