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
