import { createGame, type Game, type Save } from './game';

export type ServerRoom = {
  createdAt: number;
  names: [string, string];
  players: Array<{ token: string; name: string; lastSeen: number }>;
  game: Game | null;
  save: Save | null;
  processed: Map<string, { revision: number; snapshot: ReturnType<typeof roomSnapshot> }>;
};

export const rooms = new Map<string, ServerRoom>();

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
