/**
 * Routes across places: the map and the interiors are separate pieces of the
 * navigation grid (interiors sit far east, out of sight), joined by doors.
 * A route from anywhere to anywhere is a list of legs; each leg is walked on
 * the grid inside one place and ends at a door, where the walker passes
 * through (fades out, appears on the other side) and the next leg begins.
 *
 * Links: every building's front door (map <-> interior) and the stairs inside
 * the Senate and the Student Union (hall <-> basement, same interior, not
 * joined by any floor). Pure logic: the tests plan with it headless.
 */
import type { NavPoint } from "../sim/nav.ts";
import { byId, INTERIORS, interiorAt, toWorld } from "../world/interior-plan.ts";
import { worldDoors } from "./missions/places.ts";
import { buildingFor, entranceDoor, entranceId, interiorDoorWall } from "../world/door-plan.ts";

export interface NavLink {
  /** Place and point you leave from. */
  from: string;
  a: NavPoint;
  /** Place and point you arrive at, and the facing when you arrive. */
  to: string;
  b: NavPoint;
  yaw: number;
  label: string;
  /** The door you pass through on each side (world/door-plan.ts ids and the doorway's centre). */
  doorA: { id: string; x: number; z: number };
  doorB: { id: string; x: number; z: number };
}

/** The place ("world" or an interior id) a world position belongs to. */
export const placeOf = (x: number, z: number): string => interiorAt(x, z)?.id ?? "world";

/** Every door link (both directions). */
export function navLinks(female: boolean): NavLink[] {
  const out: NavLink[] = [];
  const doors = worldDoors(female);
  for (const [id, d] of Object.entries(doors)) {
    const plan = INTERIORS.find((p) => p.id === id);
    if (!plan) continue;
    const b = buildingFor(id, female)!;
    const ent = entranceDoor(entranceId(id, female), b, () => 0);
    const outside = { id: ent.id, x: ent.x, z: ent.z };
    const wallOf = (dp: { id: string; x: number; z: number; yaw: number }) => {
      const w = interiorDoorWall(plan, dp.x, dp.z, dp.yaw);
      const [x, z] = toWorld(plan, w.x, w.z);
      return { id: dp.id, x, z };
    };
    for (const dp of plan.doors) {
      const [wx, wz] = toWorld(plan, dp.x, dp.z);
      if (dp.to === "world") {
        out.push({ from: "world", a: [d.at[0], d.at[2]], to: id, b: [wx, wz], yaw: dp.yaw, label: d.label, doorA: outside, doorB: wallOf(dp) });
        out.push({ from: id, a: [wx, wz], to: "world", b: [d.at[0], d.at[2]], yaw: d.yaw, label: dp.label, doorA: wallOf(dp), doorB: outside });
      } else {
        const other = byId(id).doors.find((x) => x.id === dp.to);
        if (!other) continue;
        const [ox, oz] = toWorld(plan, other.x, other.z);
        out.push({ from: id, a: [wx, wz], to: id, b: [ox, oz], yaw: other.yaw, label: dp.label, doorA: wallOf(dp), doorB: wallOf(other) });
      }
    }
  }
  return out;
}

export interface RouteLeg {
  where: string;
  /** Where the leg starts and ends (planned on the grid by the caller). */
  from: NavPoint;
  to: NavPoint;
  /** The door at the end of this leg (absent on the last leg). */
  link?: NavLink;
}

/**
 * Which doors to go through from (place, point) to (place, point): a small
 * Dijkstra over the door links, legs measured as straight lines (the grid
 * search then walks each leg properly). `reachable(a, b)` says whether two
 * points in one place are joined by floor (the Senate hall and its basement
 * are not); by default every pair in one place is.
 */
export function routeLegs(from: NavPoint, to: NavPoint, links: NavLink[], reachable: (a: NavPoint, b: NavPoint) => boolean = () => true): RouteLeg[] {
  const pf = placeOf(from[0], from[1]), pt = placeOf(to[0], to[1]);
  if (pf === pt && reachable(from, to)) return [{ where: pf, from, to }];
  // Nodes: 0 = start, 1 = goal, then each link's arrival point.
  type Node = { p: NavPoint; where: string; via?: NavLink };
  const nodes: Node[] = [{ p: from, where: pf }, { p: to, where: pt }, ...links.map((l) => ({ p: l.b, where: l.to, via: l }))];
  const dist = nodes.map(() => Infinity);
  const prev: (number | -1)[] = nodes.map(() => -1);
  const used = nodes.map(() => false);
  dist[0] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < nodes.length; i++) if (!used[i] && dist[i]! < Infinity && (u < 0 || dist[i]! < dist[u]!)) u = i;
    if (u < 0 || u === 1) break;
    used[u] = true;
    const n = nodes[u]!;
    // To the goal directly.
    if (n.where === pt && reachable(n.p, to)) relax(u, 1, Math.hypot(to[0] - n.p[0], to[1] - n.p[1]));
    // Through any door that leaves from here.
    links.forEach((l, k) => {
      if (l.from !== n.where || !reachable(n.p, l.a)) return;
      relax(u, k + 2, Math.hypot(l.a[0] - n.p[0], l.a[1] - n.p[1]) + 2);
    });
  }
  function relax(u: number, v: number, w: number): void {
    if (dist[u]! + w < dist[v]!) {
      dist[v] = dist[u]! + w;
      prev[v] = u;
    }
  }
  if (dist[1] === Infinity) return [{ where: pf, from, to }];
  const chain: number[] = [];
  for (let v = 1; v >= 0; v = prev[v]!) chain.unshift(v);
  const legs: RouteLeg[] = [];
  for (let i = 0; i < chain.length - 1; i++) {
    const a = nodes[chain[i]!]!, b = nodes[chain[i + 1]!]!;
    if (b.via) legs.push({ where: a.where, from: a.p, to: b.via.a, link: b.via });
    else legs.push({ where: a.where, from: a.p, to: b.p });
  }
  return legs;
}
