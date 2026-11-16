/**
 * Polylines measured by distance: the backbone for traffic lanes and for any
 * smooth movement along a route. Pure maths, no engine.
 */
export type P2 = [number, number];

export interface Path {
  pts: P2[];
  /** Distance from the start to each point. */
  cum: number[];
  length: number;
  closed: boolean;
}

export function makePath(points: P2[], closed = false): Path {
  const pts: P2[] = [];
  for (const p of points) {
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.05) pts.push([p[0], p[1]]);
  }
  if (closed) pts.push([pts[0]![0], pts[0]![1]]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
  return { pts, cum, length: cum[cum.length - 1]!, closed };
}

export interface PathSample { x: number; z: number; /** heading as a unit vector */ dx: number; dz: number }

/** Position and direction at distance s along the path (wraps for closed paths, clamps otherwise). */
export function sample(path: Path, s: number, out: PathSample = { x: 0, z: 0, dx: 1, dz: 0 }): PathSample {
  const L = path.length;
  if (path.closed) s = ((s % L) + L) % L;
  else s = Math.max(0, Math.min(L, s));
  let lo = 0, hi = path.cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (path.cum[mid]! <= s) lo = mid;
    else hi = mid;
  }
  const a = path.pts[lo]!, b = path.pts[hi]!;
  const seg = path.cum[hi]! - path.cum[lo]! || 1;
  const t = (s - path.cum[lo]!) / seg;
  out.x = a[0] + (b[0] - a[0]) * t;
  out.z = a[1] + (b[1] - a[1]) * t;
  out.dx = (b[0] - a[0]) / seg;
  out.dz = (b[1] - a[1]) / seg;
  return out;
}

/** Points along a circular arc (x = cx + r cos a, z = cz - r sin a: angles grow anticlockwise on a north-up map). */
export function arc(cx: number, cz: number, r: number, a0: number, a1: number, step = 0.12): P2[] {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / step));
  const out: P2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + r * Math.cos(a), cz - r * Math.sin(a)]);
  }
  return out;
}

/** Quadratic Bezier corner from a through control c to b. */
export function corner(a: P2, c: P2, b: P2, n = 10): P2[] {
  const out: P2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return out;
}

/** Turn (radians) of the path between s and s + ahead: used to slow down for bends. */
export function turnAhead(path: Path, s: number, ahead: number): number {
  const a = sample(path, s), b = sample(path, s + ahead);
  const dot = a.dx * b.dx + a.dz * b.dz;
  return Math.acos(Math.max(-1, Math.min(1, dot)));
}
