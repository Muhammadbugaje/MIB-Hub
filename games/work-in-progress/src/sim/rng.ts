/**
 * One seeded random number generator for the whole game (plan rule F5: no
 * Math.random in game code, so every run of the same seed builds the same
 * town and screenshots can be compared).
 */
export interface Rng {
  /** 0 <= n < 1 */
  next(): number;
  range(min: number, max: number): number;
  int(min: number, maxInclusive: number): number;
  pick<T>(list: readonly T[]): T;
  chance(p: number): boolean;
}

/** mulberry32: tiny, fast and good enough for scenery. */
export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (list) => list[Math.floor(next() * list.length)]!,
    chance: (p) => next() < p,
  };
}

/** Cheap deterministic 2D value noise in 0..1 (for ground colour, tree sizes...). */
export function noise2(x: number, z: number, seed = 1): number {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const h = (a: number, b: number) => {
    let n = Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(seed, 2147483647);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = h(xi, zi), b = h(xi + 1, zi), c = h(xi, zi + 1), d = h(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Fractal noise: a few octaves of noise2, 0..1. */
export function fbm(x: number, z: number, octaves = 4, seed = 1): number {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * f, z * f, seed + i);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}
