export type RoomMessage =
  | { type: 'state'; roomCode: string; save: unknown }
  | { type: 'hello'; roomCode: string };

export function makeRoomCode() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 100).padStart(2, '0');
}

export function roomFromLocation() {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('room')?.toUpperCase() ?? '';
}

export function roomUrl(code: string) {
  if (typeof window === 'undefined') return `?room=${encodeURIComponent(code)}`;
  const url = new URL(window.location.href);
  url.searchParams.set('room', code);
  return url.toString();
}
