/**
 * Walkable surface height: where the ground is raised (sidewalks, kerbed
 * islands) and where it is not. People and the player follow this so their
 * feet sit exactly on the paving: never sunk into it, never floating.
 * It mirrors the geometry built in roads.ts (same numbers from layout.ts).
 */
import type { P2 } from "../sim/path.ts";
import { CLOCK, FAR, GATE_Z, MARKET_Z, RB, lateriteAreas, lawns, pathSurfaces, pavedAreas, plazas, roads } from "./layout.ts";
import { Y, groundHeight } from "./roads.ts";

interface Walk { a: P2; b: P2; inner: number; outer: number }

const W = 3.6, E = 5, C = 3.5;
const strips: [P2, P2, number][] = [
  [[-FAR + 20, 0], [-19.6, 0], E], [[19.6, 0], [FAR - 20, 0], E],
  [[0, -19.6], [0, GATE_Z], E], [[0, 19.6], [0, MARKET_Z - 8.6], E], [[0, MARKET_Z + 8.6], [0, FAR - 20], E],
  [[-170, MARKET_Z], [-8.6, MARKET_Z], E], [[8.6, MARKET_Z], [FAR - 20, MARKET_Z], E],
  [[0, GATE_Z - 2], [0, CLOCK.z + 16.6], C],
];
const walks: Walk[] = strips.map(([a, b, off]) => ({ a, b, inner: off, outer: off + W }));

/** Distance from p to segment ab, and whether the projection falls inside it. */
function segDist(p: P2, a: P2, b: P2): { d: number; inside: boolean } {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const L2 = dx * dx + dz * dz || 1;
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2;
  const cx = a[0] + dx * t, cz = a[1] + dz * t;
  return { d: Math.hypot(p[0] - cx, p[1] - cz), inside: t >= 0 && t <= 1 };
}

export function surfaceHeight(x: number, z: number): number {
  const p: P2 = [x, z];
  for (const w of walks) {
    const { d, inside } = segDist(p, w.a, w.b);
    if (inside && d >= w.inner && d <= w.outer) return Y.walk;
  }
  const rb = Math.hypot(x - RB.x, z - RB.z);
  if (rb < RB.island) return Y.walk;
  if (rb >= RB.outer && rb <= RB.outer + 3.6) {
    // Gaps where roads enter.
    const a = Math.atan2(-(z - RB.z), x - RB.x);
    const m = ((a % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2);
    if (m > 0.36 && m < Math.PI / 2 - 0.36) return Y.walk;
  }
  const ck = Math.hypot(x - CLOCK.x, z - CLOCK.z);
  if (ck < CLOCK.island) return Y.walk;
  if (ck >= CLOCK.outer && ck <= CLOCK.outer + 3.6) {
    const a = Math.atan2(-(z - CLOCK.z), x - CLOCK.x);
    const m = ((a % (Math.PI / 2)) + Math.PI / 2) % (Math.PI / 2);
    if (m > 0.32 && m < Math.PI / 2 - 0.32) return Y.walk;
  }
  return flatLayer(p);
}

/** The highest flat layer (path, paving, road, red earth, lawn) under a point, or the ground. */
function flatLayer(p: P2): number {
  for (const ps of pathSurfaces)
    for (let i = 0; i < ps.line.length - 1; i++) {
      const { d, inside } = segDist(p, ps.line[i]!, ps.line[i + 1]!);
      if (d <= ps.width / 2 && (inside || d < 0.01)) return ps.kind === "paving" ? Y.path : Y.laterite;
    }
  for (const r of roads)
    for (let i = 0; i < r.line.length - 1; i++) {
      const { d, inside } = segDist(p, r.line[i]!, r.line[i + 1]!);
      if (inside && d <= r.width / 2) return Y.road;
    }
  const rb = Math.hypot(p[0] - RB.x, p[1] - RB.z), ck = Math.hypot(p[0] - CLOCK.x, p[1] - CLOCK.z);
  if ((rb >= RB.island && rb <= RB.outer) || (ck >= CLOCK.island && ck <= CLOCK.outer)) return Y.ring;
  const inRect = (a: { x: number; z: number; hx: number; hz: number }) => Math.abs(p[0] - a.x) <= a.hx && Math.abs(p[1] - a.z) <= a.hz;
  if (plazas.some(inRect) || pavedAreas.some((a) => a.hx > 0 && inRect(a))) return Y.paving;
  if (lateriteAreas.some(inRect)) return Y.laterite;
  if (lawns.some(inRect)) return Y.lawn;
  return groundHeight(p[0], p[1]);
}

/** Height of the road surface (vehicles' wheels sit exactly here). */
export const ROAD_Y = Y.road;
