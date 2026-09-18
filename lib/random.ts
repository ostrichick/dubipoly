export function randomInt(max: number) {
  const bytes = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / max) * max;
  let value: number;
  do {
    crypto.getRandomValues(bytes);
    value = bytes[0];
  } while (value >= limit);
  return value % max;
}