type Room = {
  createdAt: number;
  players: Array<{ token: string; name: string }>;
};

const rooms = new Map<string, Room>();
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
  const roomCode = new URL(request.url).searchParams.get('room')?.toUpperCase() ?? '';
  const room = rooms.get(roomCode);
  if (!room) return json({ error: 'ROOM_NOT_FOUND' }, 404);
  return json({ roomCode, players: room.players.length, ready: room.players.length === 2 });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    action?: 'create' | 'join';
    roomCode?: string;
    name?: string;
  };
  const name = body.name?.trim().slice(0, 24) || 'Traveler';

  if (body.action === 'create') {
    let roomCode = code();
    while (rooms.has(roomCode)) roomCode = code();
    const token = crypto.randomUUID();
    rooms.set(roomCode, { createdAt: Date.now(), players: [{ token, name }] });
    return json({ roomCode, token, role: 'host', players: 1, ready: false }, 201);
  }

  const roomCode = body.roomCode?.trim().toUpperCase() ?? '';
  const room = rooms.get(roomCode);
  if (!room) return json({ error: 'ROOM_NOT_FOUND' }, 404);
  if (room.players.length >= 2) return json({ error: 'ROOM_FULL' }, 409);
  const token = crypto.randomUUID();
  room.players.push({ token, name });
  return json({ roomCode, token, role: 'guest', players: 2, ready: true });
}
