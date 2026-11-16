/**
 * People walking: a graph of footpaths (sidewalks, crossings, campus paths)
 * and walkers that wander it. At each junction a walker picks a new way (not
 * straight back, unless it is a dead end), sometimes stops to idle (chat,
 * look at a shop), and keeps a small sideways offset so crowds do not walk in
 * single file. Pure logic.
 */
import type { NavGrid } from "./nav.ts";
import type { P2 } from "./path.ts";
import type { Rng } from "./rng.ts";

export interface WalkGraph { nodes: P2[]; edges: number[][] }

/**
 * Build a graph from polylines. Points closer than `snap` merge, and a line's
 * end that touches the middle of another line splits it there, so crossings
 * and side paths join up without exact numbers.
 */
export function buildGraph(lines: P2[][], snap = 0.8): WalkGraph {
  const nodes: P2[] = [];
  const edges: number[][] = [];
  const find = (p: P2): number => {
    for (let i = 0; i < nodes.length; i++) if (Math.hypot(nodes[i]![0] - p[0], nodes[i]![1] - p[1]) < snap) return i;
    nodes.push([p[0], p[1]]);
    edges.push([]);
    return nodes.length - 1;
  };
  // Split lines where other lines' end points touch them.
  const ends: P2[] = lines.flatMap((l) => [l[0]!, l[l.length - 1]!]);
  const split = lines.map((line) => {
    const out: P2[] = [line[0]!];
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1]!, b = line[i]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const hits: { t: number; p: P2 }[] = [];
      for (const e of ends) {
        const t = ((e[0] - a[0]) * (b[0] - a[0]) + (e[1] - a[1]) * (b[1] - a[1])) / (len * len || 1);
        if (t <= 0.01 || t >= 0.99) continue;
        const px = a[0] + (b[0] - a[0]) * t, pz = a[1] + (b[1] - a[1]) * t;
        if (Math.hypot(px - e[0], pz - e[1]) < snap) hits.push({ t, p: [px, pz] });
      }
      hits.sort((h1, h2) => h1.t - h2.t).forEach((h) => out.push(h.p));
      out.push(b);
    }
    return out;
  });
  const link = (a: number, b: number) => {
    if (a === b || edges[a]!.includes(b)) return;
    edges[a]!.push(b);
    edges[b]!.push(a);
  };
  for (const line of split) {
    let prev = find(line[0]!);
    for (let i = 1; i < line.length; i++) {
      const cur = find(line[i]!);
      link(prev, cur);
      prev = cur;
    }
  }
  return { nodes, edges };
}

export interface Walker {
  from: number;
  to: number;
  /** 0..1 along the current edge. */
  t: number;
  speed: number;
  /** Sideways offset from the path centre, metres. */
  offset: number;
  /** Seconds left standing still. */
  idle: number;
  x: number;
  z: number;
  /** Facing, radians (0 = +z). */
  yaw: number;
  moving: boolean;
}

export function makeWalker(g: WalkGraph, rng: Rng): Walker {
  const from = rng.int(0, g.nodes.length - 1);
  const nb = g.edges[from]!;
  const to = nb.length ? rng.pick(nb) : from;
  const w: Walker = { from, to, t: rng.next(), speed: rng.range(1.05, 1.5), offset: rng.range(-0.7, 0.7), idle: 0, x: 0, z: 0, yaw: 0, moving: true };
  place(w, g);
  return w;
}

/**
 * The walk lines with every edge that touches something solid (a gate
 * pillar, the fountain, a bench, a lamp post) replaced by a real path round
 * it, planned on the navigation grid. Lines that are clear stay exactly as
 * drawn. Run once at load (only the few blocked edges are searched).
 */
export function clearLines(lines: P2[][], nav: NavGrid): P2[][] {
  return lines.map((raw) => {
    // Corners that sit on something solid move to the nearest open ground.
    const line = raw.map((p) => (nav.walkable(p[0], p[1]) ? p : (nav.nearestWalkable(p[0], p[1], 3) as P2 | null) ?? p));
    const out: P2[] = [line[0]!];
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1]!, b = line[i]!;
      const p = nav.clear(a, b) ? null : nav.findPath(a, b, { margin: 8, allow: ["lawn", "rough"] });
      if (!p) out.push(b);
      else for (let k = 1; k < p.length; k++) out.push(p[k]!);
    }
    return out;
  });
}

/**
 * Drop any graph edge that touches something solid (where joining nearby
 * corners of two routed lines made a short-cut over a corner). Walkers never
 * take an edge that is not clear.
 */
export function pruneGraph(g: WalkGraph, nav: NavGrid): WalkGraph {
  g.edges.forEach((list, i) => {
    g.edges[i] = list.filter((j) => nav.clear(g.nodes[i]!, g.nodes[j]!));
  });
  return g;
}

/** Anything solid (sim/collide.ts CollisionWorld): side-steps never put a walker inside it. */
export interface CrowdSolids { blocked(x: number, z: number, r: number): boolean }

export function place(w: Walker, g: WalkGraph, solids?: CrowdSolids): void {
  const a = g.nodes[w.from]!, b = g.nodes[w.to]!;
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len, nz = dx / len;
  const cx = a[0] + dx * w.t, cz = a[1] + dz * w.t;
  // The path's centre line is clear of everything (test/nav.test.ts); a side-step that would
  // put the walker into a wall, a tree or a bench is pulled back towards the centre.
  if (solids && w.offset !== 0) {
    for (let k = 0; k < 6 && solids.blocked(cx + nx * w.offset, cz + nz * w.offset, 0.28); k++) w.offset *= k < 5 ? 0.6 : 0;
  }
  w.x = cx + nx * w.offset;
  w.z = cz + nz * w.offset;
  if (len > 0.01) w.yaw = Math.atan2(dx, dz);
}

/** Choose the next node after arriving at `at`, coming from `prev`. */
export function nextNode(g: WalkGraph, at: number, prev: number, rng: Rng): number {
  const nb = g.edges[at]!;
  if (!nb.length) return at;
  const options = nb.length > 1 ? nb.filter((n) => n !== prev) : nb;
  return rng.pick(options);
}

export function stepWalker(w: Walker, g: WalkGraph, dt: number, rng: Rng, idleChance = 0.12, solids?: CrowdSolids): void {
  if (w.idle > 0) {
    w.idle -= dt;
    w.moving = false;
    return;
  }
  w.moving = true;
  const a = g.nodes[w.from]!, b = g.nodes[w.to]!;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < 0.01) {
    w.to = nextNode(g, w.from, -1, rng);
    return;
  }
  w.t += (w.speed * dt) / len;
  if (w.t >= 1) {
    const prev = w.from;
    w.from = w.to;
    w.to = nextNode(g, w.from, prev, rng);
    w.t = 0;
    if (rng.chance(idleChance)) w.idle = rng.range(2, 9);
    if (rng.chance(0.2)) w.offset = Math.max(-0.9, Math.min(0.9, w.offset + rng.range(-0.4, 0.4)));
  }
  place(w, g, solids);
}

/**
 * Keep walkers out of each other (and out of the player and the story cast):
 * people closer than `gap` slide sideways on their path (their offset), the
 * way people pass on a pavement; anyone about to walk into an obstacle waits a
 * moment. Pure, in place, O(n) with a grid.
 */
export function separate(ws: Walker[], g: WalkGraph, obstacles: readonly { x: number; z: number; r: number }[], dt: number, gap = 0.72, solids?: CrowdSolids): void {
  const cell = 2;
  const grid = new Map<number, Walker[]>();
  const key = (x: number, z: number) => Math.floor(x / cell) * 73856093 ^ Math.floor(z / cell) * 19349663;
  for (const w of ws) {
    const k = key(w.x, w.z);
    let l = grid.get(k);
    if (!l) grid.set(k, (l = []));
    l.push(w);
  }
  const normal = (w: Walker): [number, number] => {
    const a = g.nodes[w.from]!, b = g.nodes[w.to]!;
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
    return [-dz / L, dx / L];
  };
  const nudge = (w: Walker, ox: number, oz: number, amt: number) => {
    const [nx, nz] = normal(w);
    const side = ox * nx + oz * nz >= 0 ? 1 : -1;
    w.offset = Math.max(-1.4, Math.min(1.4, w.offset + side * amt));
  };
  for (const w of ws) {
    const cx = Math.floor(w.x / cell), cz = Math.floor(w.z / cell);
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++) {
        const l = grid.get((cx + i) * 73856093 ^ (cz + j) * 19349663);
        if (!l) continue;
        for (const o of l) {
          if (o === w) continue;
          const dx = w.x - o.x, dz = w.z - o.z, d = Math.hypot(dx, dz);
          if (d >= gap) continue;
          // Each takes half the correction, sideways (head-on pairs both keep right).
          const amt = Math.min(0.5, (gap - d) * 0.5 + dt * 0.6);
          if (d < 1e-3) nudge(w, 1, 0, amt);
          else nudge(w, dx, dz, amt);
        }
      }
    for (const o of obstacles) {
      const dx = w.x - o.x, dz = w.z - o.z, d = Math.hypot(dx, dz);
      const min = o.r + 0.36;
      if (d >= min + 0.5) continue;
      nudge(w, dx || 1, dz, Math.min(0.6, (min + 0.5 - d) * 0.6));
      // About to walk into it: wait a moment.
      const a = g.nodes[w.from]!, b = g.nodes[w.to]!;
      const fx = b[0] - a[0], fz = b[1] - a[1];
      if (d < min + 0.15 && (o.x - w.x) * fx + (o.z - w.z) * fz > 0) w.idle = Math.max(w.idle, 0.5);
    }
    place(w, g, solids);
  }
}
