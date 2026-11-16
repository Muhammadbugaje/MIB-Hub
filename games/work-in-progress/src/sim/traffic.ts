/**
 * Traffic: cars, keke and okada drive along lane paths (sim/path.ts), keep a
 * safe gap to whatever is ahead of them (any vehicle, the player, a person on
 * a crossing), slow down for bends, and re-enter at the start of their lane
 * when they reach the end (the ends are hidden beyond the fog). Pure logic.
 */
import { type Path, type PathSample, sample, turnAhead } from "./path.ts";

export type VehicleKind = "car" | "keke" | "okada";

export interface Vehicle {
  kind: VehicleKind;
  path: number;
  /** Distance along the path. */
  s: number;
  speed: number;
  cruise: number;
  /** Length in metres (bumper to bumper). */
  length: number;
  /** World state, updated by stepTraffic. */
  x: number;
  z: number;
  dx: number;
  dz: number;
  /** Seconds to wait before re-entering (staggered respawn). */
  wait: number;
}

export interface Obstacle { x: number; z: number; r: number }

const tmp: PathSample = { x: 0, z: 0, dx: 1, dz: 0 };

export function placeVehicle(v: Vehicle, paths: Path[]): void {
  sample(paths[v.path]!, v.s, tmp);
  v.x = tmp.x; v.z = tmp.z; v.dx = tmp.dx; v.dz = tmp.dz;
}

/** Free distance ahead of v (bumper gap), looking in a narrow corridor along its heading. */
export function gapAhead(v: Vehicle, others: readonly Vehicle[], obstacles: readonly Obstacle[], look = 28): number {
  let best = look;
  for (const o of others) {
    if (o === v || o.wait > 0) continue;
    const rx = o.x - v.x, rz = o.z - v.z;
    const along = rx * v.dx + rz * v.dz;
    if (along <= 0 || along > look + o.length) continue;
    const side = Math.abs(-rx * v.dz + rz * v.dx);
    if (side > 2.0) continue;
    // Ignore a car heading straight at us in the other lane (it is beside us, not ahead).
    if (o.dx * v.dx + o.dz * v.dz < -0.5 && side > 1.2) continue;
    best = Math.min(best, along - (v.length + o.length) / 2);
  }
  for (const o of obstacles) {
    const rx = o.x - v.x, rz = o.z - v.z;
    const along = rx * v.dx + rz * v.dz;
    if (along <= 0 || along > look) continue;
    if (Math.abs(-rx * v.dz + rz * v.dx) > 1.6 + o.r) continue;
    best = Math.min(best, along - v.length / 2 - o.r);
  }
  return best;
}

/** The speed v wants right now: cruise, limited by the gap ahead and by bends. */
export function targetSpeed(v: Vehicle, gap: number, path: Path): number {
  const minGap = v.kind === "okada" ? 1.6 : 2.5;
  const brake = 14;
  const byGap = v.cruise * Math.max(0, Math.min(1, (gap - minGap) / brake));
  const turn = turnAhead(path, v.s, 10);
  const byBend = turn > 0.25 ? Math.max(4, v.cruise * (1 - Math.min(0.65, turn * 0.55))) : v.cruise;
  return Math.min(byGap, byBend);
}

export function stepTraffic(vs: Vehicle[], paths: Path[], dt: number, obstacles: readonly Obstacle[] = []): void {
  for (const v of vs) {
    const path = paths[v.path]!;
    if (v.wait > 0) {
      v.wait -= dt;
      if (v.wait <= 0) {
        v.s = 0;
        placeVehicle(v, paths);
        // Only enter when the start of the lane is clear.
        if (gapAhead(v, vs, obstacles, 12) < 6) v.wait = 0.5;
      }
      continue;
    }
    const want = targetSpeed(v, gapAhead(v, vs, obstacles), path);
    const rate = want > v.speed ? 2.6 : 7.5; // gentle throttle, firm brakes
    v.speed += Math.max(-rate * dt, Math.min(rate * dt, want - v.speed));
    v.speed = Math.max(0, v.speed);
    v.s += v.speed * dt;
    if (!path.closed && v.s >= path.length) {
      v.wait = 0.5 + (v.path % 3) * 0.7;
      v.speed = v.cruise * 0.6;
      continue;
    }
    placeVehicle(v, paths);
  }
}
