import { events } from '../../../../../lib/events.ts';
import {
  loadRoom,
  persistRoom,
  roomSnapshot,
} from '../../../../../lib/server-rooms.ts';
import {
  transition,
  type Action,
  type PlayerId,
} from '../../../../../lib/game.ts';

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
  try {
    const { roomCode: rawCode } = await context.params;
    const roomCode = rawCode.toUpperCase();
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (
      !body ||
      typeof body.type !== 'string' ||
      !['roll', 'buy', 'upgrade', 'end', 'bail', 'sell', 'reaction', 'fly', 'skipFly', 'sail', 'skipSail', 'payDebt', 'bankrupt', 'payRent', 'claimEvent'].includes(
        body.type,
      )
    )
      return json({ error: 'INVALID_ACTION' }, 400);

    if (body.type === 'reaction') {
      const room = await loadRoom(roomCode);
      if (!room) return json({ error: 'ROOM_NOT_FOUND' }, 404);
      const playerIndex = room.players.findIndex(
        (player) => player.token === body.token,
      );
      if (playerIndex < 0) return json({ error: 'INVALID_PLAYER' }, 403);
      room.reaction = {
        player: playerIndex,
        emoji: String(body.emoji ?? '🐾').slice(0, 10),
        at: Date.now(),
      };
      await persistRoom(roomCode, room);
      return json(roomSnapshot(roomCode, room));
    }

    if (
      typeof body.requestId !== 'string' ||
      !body.requestId ||
      body.requestId.length > 100
    )
      return json({ error: 'MISSING_REQUEST_ID' }, 400);
    for (let attempt = 0; attempt < 4; attempt++) {
      const room = await loadRoom(roomCode);
      if (!room) return json({ error: 'ROOM_NOT_FOUND' }, 404);
      if (!room.game || !room.save)
        return json({ error: 'GAME_NOT_STARTED' }, 409);
      const playerIndex = room.players.findIndex(
        (player) => player.token === body.token,
      );
      if (playerIndex < 0) return json({ error: 'INVALID_PLAYER' }, 403);
      if (body.matchId !== (room.matchId ?? 'legacy'))
        return json({ error: 'STALE_MATCH' }, 409);
      const key = playerIndex + ':' + body.requestId;
      // Return the latest state for a duplicate; never roll a client backwards.
      if (room.processed.has(key)) return json(roomSnapshot(roomCode, room));
      if (body.revision !== room.game.revision)
        return json({ error: 'STALE_STATE' }, 409);

      let action: Action;
      if (body.type === 'roll') {
        const mod = room.game.players[playerIndex].nextRollModifier;
        let dice: [number, number];
        if (mod === 'single') {
          dice = [randomInt(6) + 1, 0];
        } else if (mod === 'doubles') {
          const d = randomInt(6) + 1;
          dice = [d, d];
        } else {
          dice = [randomInt(6) + 1, randomInt(6) + 1];
        }
        action = {
          type: 'roll',
          dice,
          event: randomInt(events.length),
        };
      } else if (body.type === 'sell') {
        action = { type: 'sell', space: Number(body.space) };
      } else if (body.type === 'fly') {
        action = { type: 'fly', space: Number(body.space) };
      } else if (body.type === 'sail') {
        action = { type: 'sail', space: Number(body.space) };
      } else {
        action = {
          type: body.type as
            | 'buy'
            | 'upgrade'
            | 'end'
            | 'bail'
            | 'skipFly'
            | 'skipSail'
            | 'payDebt'
            | 'bankrupt',
        };
      }
      const next = transition(
        room.game,
        action,
        playerIndex as PlayerId,
        room.game.revision,
      );
      if (next === room.game) return json({ error: 'ACTION_REJECTED' }, 409);
      room.game = next;
      room.save = { ...room.save, actions: [...room.save.actions, action] };
      // Only the accepted revision is needed for deduplication, not nested snapshots.
      room.processed.set(key, { revision: next.revision });
      if (room.processed.size > 200)
        room.processed.delete(room.processed.keys().next().value!);
      if (await persistRoom(roomCode, room))
        return json(roomSnapshot(roomCode, room));
    }
    return json({ error: 'ROOM_CHANGED' }, 409);
  } catch {
    return json({ error: 'STORAGE_UNAVAILABLE' }, 503);
  }
}
