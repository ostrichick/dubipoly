import { cleanupRooms, loadRoom, persistRoom, roomSnapshot, rooms, startRoom, touchPlayer } from '../../../lib/server-rooms';

function code() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 100).padStart(2, '0');
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
    action?: 'create' | 'join' | 'start' | 'rename';
    roomCode?: string;
    token?: string;
    name?: string;
  };

  if (body.action === 'create') {
    let roomCode = code();
    let attempts = 0;
    while ((rooms.has(roomCode) || (await loadRoom(roomCode))) && attempts < 100) {
      roomCode = code();
      attempts++;
    }
    if (rooms.has(roomCode) || (await loadRoom(roomCode))) return json({ error: 'NO_ROOM_CODES' }, 503);
    const name = body.name?.trim().slice(0, 24) || 'Traveler 1';
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
  if (!/^\d{2}$/.test(roomCode)) return json({ error: 'INVALID_ROOM_CODE' }, 400);
  const room = await loadRoom(roomCode);
  if (!room) return json({ error: 'ROOM_NOT_FOUND' }, 404);
  if (body.action === 'start') {
    const host = room.players[0];
    if (!host || host.token !== body.token) return json({ error: 'NOT_HOST' }, 403);
    host.lastSeen = Date.now();
    if (room.players.length !== 2) return json({ error: 'WAITING_FOR_PLAYER' }, 409);
    startRoom(room);
    if (!(await persistRoom(roomCode, room))) return json({ error: 'ROOM_CHANGED' }, 409);
    return json({ ...roomSnapshot(roomCode, room), token: body.token, role: 'host' });
  }
  if (body.action === 'rename') {
    const playerIndex = room.players.findIndex((player) => player.token === body.token);
    if (playerIndex < 0) return json({ error: 'INVALID_TOKEN' }, 403);
    const name = body.name?.trim().slice(0, 24);
    if (!name) return json({ error: 'INVALID_NAME' }, 400);
    const applyRename = (target: typeof room) => {
      target.players[playerIndex].name = name;
      target.players[playerIndex].lastSeen = Date.now();
      target.names[playerIndex] = name;
      if (target.game) target.game.players[playerIndex].name = name;
      if (target.save) target.save.names[playerIndex] = name;
    };
    applyRename(room);
    if (!(await persistRoom(roomCode, room))) {
      const latest = await loadRoom(roomCode);
      const latestIndex = latest?.players.findIndex((player) => player.token === body.token) ?? -1;
      if (!latest || latestIndex < 0) return json({ error: 'ROOM_CHANGED' }, 409);
      const targetIndex = playerIndex;
      latest.players[targetIndex].name = name;
      latest.players[targetIndex].lastSeen = Date.now();
      latest.names[targetIndex] = name;
      if (latest.game) latest.game.players[targetIndex].name = name;
      if (latest.save) latest.save.names[targetIndex] = name;
      if (!(await persistRoom(roomCode, latest))) return json({ error: 'ROOM_CHANGED' }, 409);
      return json({ ...roomSnapshot(roomCode, latest), token: body.token, role: targetIndex === 0 ? 'host' : 'guest' });
    }
    return json({ ...roomSnapshot(roomCode, room), token: body.token, role: playerIndex === 0 ? 'host' : 'guest' });
  }
  if (room.players.length >= 2) return json({ error: 'ROOM_FULL' }, 409);
  const token = crypto.randomUUID();
  const name = body.name?.trim().slice(0, 24) || 'Traveler 2';
  room.names[1] = name;
  room.players.push({ token, name, lastSeen: Date.now() });
  if (!(await persistRoom(roomCode, room))) return json({ error: 'ROOM_CHANGED' }, 409);
  return json({ ...roomSnapshot(roomCode, room), token, role: 'guest' });
}
