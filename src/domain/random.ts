export function nextRandom(seed: number) {
  let value = seed;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return value >>> 0 || 1;
}
