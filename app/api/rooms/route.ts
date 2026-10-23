import {
  allowRoomCreation,
  heartbeat,
  loadRoom,
  persistRoom,
  roomSnapshot,
  startRoom,
  sweepExpiredRooms,
  sweepExpiredRoomsOnRead,
  type ServerRoom,
} from '../../../lib/server-rooms.ts';

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{10}$/;
const JOIN_TOKEN_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function newRoomCode() {
  const random = crypto.getRandomValues(new Uint32Array(2));
  let code = '';
  for (let i = 0; i < 10; i++) {
    const word = random[i < 6 ? 0 : 1];
    code += ROOM_CODE_ALPHABET[(word >>> ((i < 6 ? i : i - 6) * 5)) & 31];
  }
  return code;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const roomCode = url.searchParams.get('room')?.toUpperCase() ?? '';
    // The token travels only in a header so it stays out of request-URL logs.
    const token = request.headers.get('x-room-token') ?? '';
    const room = await loadRoom(roomCode);
    if (!room) return json({ error: 'ROOM_NOT_FOUND' }, 404);
    const fast = url.searchParams.get('sync') === '1';
    const playerIndex = fast
      ? room.players.findIndex((player) => player.token === token)
      : await heartbeat(roomCode, room, token);
    if (playerIndex < 0) return json({ error: 'INVALID_PLAYER' }, 403);
    if (!fast) await sweepExpiredRoomsOnRead();
    if (
      fast &&
      room.game &&
      url.searchParams.get('match') === (room.matchId ?? 'legacy') &&
      url.searchParams.get('revision') === String(room.game.revision) &&
      // Renames and reactions keep the revision but change the stamp.
      url.searchParams.get('stamp') === String(room.storedAt ?? 0)
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
  } catch (error) {
    console.error('GET /api/rooms failed', error);
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
      if (!(await allowRoomCreation(request)))
        return json({ error: 'RATE_LIMITED' }, 429);
      await sweepExpiredRooms();
      for (let attempt = 0; attempt < 10; attempt++) {
        const roomCode = newRoomCode();
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
      }
      return json({ error: 'NO_ROOM_CODES' }, 503);
    }
    const roomCode =
      typeof body.roomCode === 'string'
        ? body.roomCode.trim().toUpperCase()
        : '';
    if (!ROOM_CODE_PATTERN.test(roomCode))
      return json({ error: 'INVALID_ROOM_CODE' }, 400);
    if (
      body.action === 'join' &&
      body.token != null &&
      (typeof body.token !== 'string' || !JOIN_TOKEN_PATTERN.test(body.token))
    )
      return json({ error: 'INVALID_TOKEN' }, 400);
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
        // A client may persist its UUID before POST, so a lost response is retryable.
        // Older clients without a token still receive a server-generated UUID.
        token = token || crypto.randomUUID();
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
  } catch (error) {
    console.error('POST /api/rooms failed', error);
    return json({ error: 'STORAGE_UNAVAILABLE' }, 503);
  }
}
