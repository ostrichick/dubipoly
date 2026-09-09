import { createGame, type Game, type Save } from './game';
import type { D1Database } from '@cloudflare/workers-types';

export type ServerRoom = {
  createdAt: number;
  names: [string, string];
  players: Array<{ token: string; name: string; lastSeen: number }>;
  game: Game | null;
  save: Save | null;
  processed: Map<string, { revision: number; snapshot: ReturnType<typeof roomSnapshot> }>;
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
    createdAt: room.createdAt,
    names: room.names,
    players: room.players,
    game: room.game,
    save: room.save,
  });
}

function deserialize(payload: string) {
  const value = JSON.parse(payload) as Omit<ServerRoom, 'processed'>;
  return { ...value, processed: new Map() } satisfies ServerRoom;
}

export async function loadRoom(roomCode: string) {
  const existing = rooms.get(roomCode);
  if (existing) return existing;
  const db = database();
  if (!db) return undefined;
  try {
    const row = await db
      .prepare('SELECT payload FROM dubipoly_rooms WHERE room_code = ?1')
      .bind(roomCode)
      .first<{ payload: string }>();
    if (!row?.payload) return undefined;
    const room = deserialize(row.payload);
    rooms.set(roomCode, room);
    return room;
  } catch {
    return undefined;
  }
}

export async function persistRoom(roomCode: string, room: ServerRoom) {
  const db = database();
  if (!db) return false;
  try {
    await db
      .prepare(
        'INSERT INTO dubipoly_rooms (room_code, payload, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(room_code) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at',
      )
      .bind(roomCode, serialize(room), Date.now())
      .run();
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

export function touchPlayer(room: ServerRoom, token: string) {
  const player = room.players.find((entry) => entry.token === token);
  if (!player) return -1;
  player.lastSeen = Date.now();
  return room.players.indexOf(player);
}

export function startRoom(room: ServerRoom) {
  if (!room.game) {
    room.game = createGame(room.names);
    room.save = { version: 1, names: room.names, actions: [] };
  }
  return room;
}
