import {
  heartbeat,
  loadRoom,
  persistRoom,
  roomSnapshot,
  startRoom,
  type ServerRoom,
} from '../../../lib/server-rooms.ts';

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const roomCode = url.searchParams.get('room')?.toUpperCase() ?? '';
    const token = url.searchParams.get('token') ?? '';
    const room = await loadRoom(roomCode);
    if (!room) return json({ error: 'ROOM_NOT_FOUND' }, 404);
    const fast = url.searchParams.get('sync') === '1';
    const playerIndex = fast
      ? room.players.findIndex((player) => player.token === token)
      : await heartbeat(roomCode, room, token);
    if (playerIndex < 0) return json({ error: 'INVALID_PLAYER' }, 403);
    if (
      fast &&
      room.game &&
      url.searchParams.get('match') === (room.matchId ?? 'legacy') &&
      url.searchParams.get('revision') === String(room.game.revision)
    ) {
      return new Response(null, {
        status: 204,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    return json({
      ...roomSnapshot(roomCode, room),
      ...(fast ? { presence: undefined } : {}),
      playerIndex,
    });
  } catch {
    return json({ error: 'STORAGE_UNAVAILABLE' }, 503);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (
      !body ||
      typeof body.action !== 'string' ||
      !['create', 'join', 'start', 'rename', 'rematch'].includes(body.action)
    )
      return json({ error: 'INVALID_ACTION' }, 400);
    const name =
      typeof body.name === 'string' ? body.name.trim().slice(0, 24) : '';
    if (body.action === 'create') {
      const seed = crypto.getRandomValues(new Uint32Array(1))[0] % 100;
      for (let offset = 0; offset < 100; offset++) {
        const roomCode = String((seed + offset) % 100).padStart(2, '0');
        if (await loadRoom(roomCode)) continue;
        const token = crypto.randomUUID();
        const room: ServerRoom = {
          createdAt: Date.now(),
          names: [name || 'Traveler 1', 'Traveler 2'],
          players: [
            { token, name: name || 'Traveler 1', lastSeen: Date.now() },
          ],
          game: null,
          save: null,
          processed: new Map(),
        };
        if (await persistRoom(roomCode, room))
          return json(
            { ...roomSnapshot(roomCode, room), token, role: 'host' },
            201,
          );
        if (!(await loadRoom(roomCode)))
          return json({ error: 'STORAGE_UNAVAILABLE' }, 503);
      }
      return json({ error: 'NO_ROOM_CODES' }, 503);
    }
    const roomCode =
      typeof body.roomCode === 'string'
        ? body.roomCode.trim().toUpperCase()
        : '';
    if (!/^\d{2}$/.test(roomCode))
      return json({ error: 'INVALID_ROOM_CODE' }, 400);
    for (let attempt = 0; attempt < 4; attempt++) {
      const room = await loadRoom(roomCode);
      if (!room) return json({ error: 'ROOM_NOT_FOUND' }, 404);
      let playerIndex = room.players.findIndex(
        (player) => player.token === body.token,
      );
      let token = typeof body.token === 'string' ? body.token : '';
      if (body.action === 'join') {
        if (playerIndex >= 0)
          return json({
            ...roomSnapshot(roomCode, room),
            token,
            role: playerIndex === 0 ? 'host' : 'guest',
          });
        if (room.players.length >= 2) return json({ error: 'ROOM_FULL' }, 409);
        token = crypto.randomUUID();
        playerIndex = 1;
        room.names[1] = name || 'Traveler 2';
        room.players.push({ token, name: room.names[1], lastSeen: Date.now() });
      } else {
        if (playerIndex < 0) return json({ error: 'INVALID_PLAYER' }, 403);
        if (body.action === 'rename') {
          if (!name) return json({ error: 'INVALID_NAME' }, 400);
          room.names[playerIndex] = name;
          room.players[playerIndex].name = name;
          if (room.game) {
            room.game.players[playerIndex].name = name;
            room.game.revision++;
          }
          if (room.save) room.save.names[playerIndex] = name;
        } else {
          if (playerIndex !== 0) return json({ error: 'NOT_HOST' }, 403);
          if (room.players.length !== 2)
            return json({ error: 'WAITING_FOR_PLAYER' }, 409);
          if (body.action === 'rematch') {
            if (body.matchId !== (room.matchId ?? 'legacy'))
              return json({ error: 'STALE_MATCH' }, 409);
            room.game = null;
            room.save = null;
            room.processed.clear();
          }
          startRoom(room);
        }
      }
      if (await persistRoom(roomCode, room))
        return json({
          ...roomSnapshot(roomCode, room),
          token,
          role: playerIndex === 0 ? 'host' : 'guest',
        });
    }
    return json({ error: 'ROOM_CHANGED' }, 409);
  } catch {
    return json({ error: 'STORAGE_UNAVAILABLE' }, 503);
  }
}
