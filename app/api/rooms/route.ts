import { cleanupRooms, loadRoom, persistRoom, roomSnapshot, rooms, startRoom, touchPlayer } from '../../../lib/server-rooms';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function code() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET(request: Request) {
  cleanupRooms();
  const url = new URL(request.url);
  const roomCode = url.searchParams.get('room')?.toUpperCase() ?? '';
  const token = url.searchParams.get('token') ?? '';
  const room = await loadRoom(roomCode);
  if (!room) return json({ error: 'ROOM_NOT_FOUND' }, 404);
  const playerIndex = token ? touchPlayer(room, token) : -1;
  await persistRoom(roomCode, room);
  return json({ ...roomSnapshot(roomCode, room), playerIndex });
}

export async function POST(request: Request) {
  cleanupRooms();
  const body = (await request.json().catch(() => ({}))) as {
    action?: 'create' | 'join' | 'start';
    roomCode?: string;
    token?: string;
    name?: string;
  };
  const name = body.name?.trim().slice(0, 24) || 'Traveler';

  if (body.action === 'create') {
    let roomCode = code();
    while (rooms.has(roomCode)) roomCode = code();
    const token = crypto.randomUUID();
    rooms.set(roomCode, {
      createdAt: Date.now(),
      names: [name, 'Traveler 2'],
      players: [{ token, name, lastSeen: Date.now() }],
      game: null,
      save: null,
      processed: new Map(),
    });
    await persistRoom(roomCode, rooms.get(roomCode)!);
    return json({ ...roomSnapshot(roomCode, rooms.get(roomCode)!), token, role: 'host' }, 201);
  }

  const roomCode = body.roomCode?.trim().toUpperCase() ?? '';
  const room = await loadRoom(roomCode);
  if (!room) return json({ error: 'ROOM_NOT_FOUND' }, 404);
  if (body.action === 'start') {
    const host = room.players[0];
    if (!host || host.token !== body.token) return json({ error: 'NOT_HOST' }, 403);
    host.lastSeen = Date.now();
    if (room.players.length !== 2) return json({ error: 'WAITING_FOR_PLAYER' }, 409);
    startRoom(room);
    await persistRoom(roomCode, room);
    return json({ ...roomSnapshot(roomCode, room), token: body.token, role: 'host' });
  }
  if (room.players.length >= 2) return json({ error: 'ROOM_FULL' }, 409);
  const token = crypto.randomUUID();
  room.names[1] = name;
  room.players.push({ token, name, lastSeen: Date.now() });
  await persistRoom(roomCode, room);
  return json({ ...roomSnapshot(roomCode, room), token, role: 'guest' });
}
