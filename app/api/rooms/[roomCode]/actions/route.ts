import { events } from '../../../../../lib/events';
import { loadRoom, persistRoom, roomSnapshot, touchPlayer } from '../../../../../lib/server-rooms';
import { transition, type Action, type PlayerId } from '../../../../../lib/game';

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function randomInt(max: number) {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0] % max;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ roomCode: string }> },
) {
  const { roomCode: rawCode } = await context.params;
  const roomCode = rawCode.toUpperCase();
  const room = await loadRoom(roomCode);
  if (!room) return json({ error: 'ROOM_NOT_FOUND' }, 404);
  if (!room.game || !room.save) return json({ error: 'GAME_NOT_STARTED' }, 409);

  const body = (await request.json().catch(() => ({}))) as {
    token?: string;
    type?: Action['type'];
    revision?: number;
    requestId?: string;
  };
  const playerIndex = touchPlayer(room, body.token ?? '');
  if (playerIndex < 0) return json({ error: 'INVALID_PLAYER' }, 403);
  if (!body.type || !['roll', 'buy', 'upgrade', 'end'].includes(body.type)) {
    return json({ error: 'INVALID_ACTION' }, 400);
  }
  if (!body.requestId) return json({ error: 'MISSING_REQUEST_ID' }, 400);
  const previous = room.processed.get(body.requestId);
  if (previous) return json(previous.snapshot);
  if (body.revision !== room.game.revision) return json({ error: 'STALE_STATE' }, 409);

  const action: Action =
    body.type === 'roll'
      ? { type: 'roll', dice: [randomInt(6) + 1, randomInt(6) + 1], event: randomInt(events.length) }
      : { type: body.type };
  const next = transition(room.game, action, playerIndex as PlayerId, room.game.revision);
  if (next === room.game) return json({ error: 'ACTION_REJECTED' }, 409);
  const previousGame = room.game;
  const previousSave = room.save;
  const previousProcessed = room.processed;
  room.game = next;
  room.save = { ...room.save, actions: [...room.save.actions, action] };
  const snapshot = { ...roomSnapshot(roomCode, room), token: body.token };
  // Store the request ID in the same snapshot as the game mutation. This makes
  // retries safe even after the request lands on a different Worker instance.
  room.processed = new Map(room.processed);
  room.processed.set(body.requestId, { revision: next.revision, snapshot });
  if (room.processed.size > 200) {
    const oldest = room.processed.keys().next().value;
    if (oldest) room.processed.delete(oldest);
  }
  if (!(await persistRoom(roomCode, room))) {
    room.game = previousGame;
    room.save = previousSave;
    room.processed = previousProcessed;
    return json({ error: 'ROOM_CHANGED' }, 409);
  }
  return json(snapshot);
}
