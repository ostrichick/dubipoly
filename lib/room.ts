export type RoomMessage =
  | { type: 'state'; roomCode: string; save: unknown }
  | { type: 'hello'; roomCode: string };

export function makeRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
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
