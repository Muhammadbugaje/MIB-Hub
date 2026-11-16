/**
 * People walking: a graph of footpaths (sidewalks, crossings, campus paths)
 * and walkers that wander it. At each junction a walker picks a new way (not
 * straight back, unless it is a dead end), sometimes stops to idle (chat,
 * look at a shop), and keeps a small sideways offset so crowds do not walk in
 * single file. Pure logic.
 */
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

function place(w: Walker, g: WalkGraph): void {
  const a = g.nodes[w.from]!, b = g.nodes[w.to]!;
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len, nz = dx / len;
  w.x = a[0] + dx * w.t + nx * w.offset;
  w.z = a[1] + dz * w.t + nz * w.offset;
  if (len > 0.01) w.yaw = Math.atan2(dx, dz);
}

/** Choose the next node after arriving at `at`, coming from `prev`. */
export function nextNode(g: WalkGraph, at: number, prev: number, rng: Rng): number {
  const nb = g.edges[at]!;
  if (!nb.length) return at;
  const options = nb.length > 1 ? nb.filter((n) => n !== prev) : nb;
  return rng.pick(options);
}

export function stepWalker(w: Walker, g: WalkGraph, dt: number, rng: Rng, idleChance = 0.12): void {
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
  place(w, g);
}
