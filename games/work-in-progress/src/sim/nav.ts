/**
 * NAVIGATION: where people can walk, and the best way there.
 *
 * A fine walkable grid (25 cm cells) baked from the real collision geometry
 * (every building, wall, fence, prop, tree trunk, water edge, interior wall
 * and piece of furniture: whatever the CollisionWorld holds) plus a cost per
 * cell read from the ground itself: footpaths, sidewalks, paving and zebra
 * crossings are cheap; red earth a little dearer; lawns dearer still; roads
 * very dear (people cross at the crossings). The grid is baked lazily in 16 m
 * chunks the first time anything needs them, so a phone only pays for the
 * parts of the map in use; interiors (far east of the map) are more chunks.
 *
 * Search: A* with an octile heuristic over 8 neighbours (no corner cutting),
 * on typed arrays in a window round start and goal, stepped with a work
 * budget so long searches spread over several frames. The cell path is then
 * string-pulled (line of sight on the grid, never on to dearer ground than
 * the stretch it replaces) into a few straight legs.
 *
 * Pure TypeScript, no engine: tests run it headless on the same colliders.
 */

export type NavPoint = [number, number];

export const CELL = 0.25;
const CHUNK = 64; // cells per chunk side (16 m)
const BLOCKED = 255;
const OFF = 0x40000; // cell index offset (keeps indices positive)

export type GroundKind = "path" | "floor" | "crossing" | "rough" | "lawn" | "road" | "verge";
/** "verge" is baked, never read from the world: the outer half metre of a footpath (walkers keep to the middle). */
const KINDS: GroundKind[] = ["path", "floor", "crossing", "rough", "lawn", "road", "verge"];
const VERGE = 6;

/** Cost of walking one metre on each kind of ground (paths are the reference). */
// Red-earth footpaths are paths too (barely dearer than paving); lawn is three times the walk, so
// people keep to a path unless cutting across saves a lot.
export const GROUND_COST: Record<GroundKind, number> = { path: 1, floor: 1, crossing: 1, rough: 1.1, lawn: 3.6, road: 25, verge: 1.5 };
const DEFAULT_COSTS = KINDS.map((k) => GROUND_COST[k]);

export interface NavWorld {
  /** True when a circle of radius r at (x, z) overlaps something solid. */
  blocked(x: number, z: number, r: number): boolean;
  /** Ground kind at (x, z). */
  ground(x: number, z: number): GroundKind;
}

export interface SearchOptions {
  /** Ground kinds walked at path cost (a scripted shortcut across the lawn, say). */
  allow?: GroundKind[];
  /** Give up after this many expanded cells (very long or impossible searches). */
  maxNodes?: number;
  /** Heuristic weight (> 1 trades optimality for speed; 1.2 keeps paths natural). */
  weight?: number;
  /** Extra search room round the start-goal box, metres. */
  margin?: number;
}

/** A binary min-heap of cell indices by f-score. */
class Heap {
  private k: number[] = [];
  private f: number[] = [];
  get size(): number {
    return this.k.length;
  }
  push(key: number, f: number): void {
    const a = this.k, b = this.f;
    let i = a.length;
    a.push(key);
    b.push(f);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (b[p]! <= f) break;
      a[i] = a[p]!;
      b[i] = b[p]!;
      i = p;
    }
    a[i] = key;
    b[i] = f;
  }
  pop(): number {
    const a = this.k, b = this.f;
    const top = a[0]!;
    const lk = a.pop()!, lf = b.pop()!;
    const n = a.length;
    if (n) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i, mf = lf;
        if (l < n && b[l]! < mf) {
          m = l;
          mf = b[l]!;
        }
        if (r < n && b[r]! < mf) m = r;
        if (m === i) break;
        a[i] = a[m]!;
        b[i] = b[m]!;
        i = m;
      }
      a[i] = lk;
      b[i] = lf;
    }
    return top;
  }
}

const NB: [number, number, number][] = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

/** An in-progress search (step it with a budget; `done` and `path` tell the outcome). */
export class PathSearch {
  done = false;
  /** The smoothed path (start first), or null when no walkable route exists. */
  path: NavPoint[] | null = null;
  /** True when the goal itself was reached (false: the path ends at the closest reachable point). */
  reached = false;
  expanded = 0;
  private open = new Heap();
  private x0: number;
  private z0: number;
  private w: number;
  private h: number;
  private g: Float32Array;
  private from: Int32Array;
  private state: Uint8Array; // 0 new, 1 open, 2 closed
  private cost: Uint8Array; // window copy of the grid (254 = not read yet)
  private costTable: number[];
  private goal: number;
  private gix: number;
  private giz: number;
  private best = -1;
  private bestH = Infinity;
  private weight: number;
  private maxNodes: number;

  constructor(private nav: NavGrid, private sx: number, private sz: number, private gx: number, private gz: number, o: SearchOptions) {
    const [six, siz] = nav.cellOf(sx, sz);
    const [gix, giz] = nav.cellOf(gx, gz);
    this.gix = gix;
    this.giz = giz;
    const dist = Math.hypot(gx - sx, gz - sz);
    const m = Math.ceil(((o.margin ?? 24) + dist * 0.35) / CELL);
    this.x0 = Math.min(six, gix) - m;
    this.z0 = Math.min(siz, giz) - m;
    this.w = Math.abs(gix - six) + 2 * m + 1;
    this.h = Math.abs(giz - siz) + 2 * m + 1;
    const n = this.w * this.h;
    this.g = new Float32Array(n);
    this.from = new Int32Array(n).fill(-1);
    this.state = new Uint8Array(n);
    this.cost = new Uint8Array(n).fill(254);
    this.costTable = KINDS.map((k) => (o.allow?.includes(k) ? 1 : GROUND_COST[k]));
    this.weight = o.weight ?? 1.2;
    this.maxNodes = o.maxNodes ?? 250000;
    this.goal = this.idx(gix, giz);
    const s = this.idx(six, siz);
    this.state[s] = 1;
    this.open.push(s, this.heur(six, siz));
  }

  private idx(ix: number, iz: number): number {
    return (ix - this.x0) * this.h + (iz - this.z0);
  }

  private heur(ix: number, iz: number): number {
    const dx = Math.abs(ix - this.gix), dz = Math.abs(iz - this.giz);
    return (Math.max(dx, dz) + 0.41421 * Math.min(dx, dz)) * this.weight;
  }

  /** Kind index of a window cell (0..5), or BLOCKED. */
  private kind(i: number, ix: number, iz: number): number {
    let c = this.cost[i]!;
    if (c === 254) c = this.cost[i] = this.nav.raw(ix, iz);
    return c;
  }

  /** Expand up to `budget` cells (chunk bakes count against it). Returns true when finished. */
  step(budget: number): boolean {
    if (this.done) return true;
    const nav = this.nav, W = this.w, H = this.h;
    const work0 = nav.work;
    while (budget - (nav.work - work0) > 0) {
      budget--;
      if (!this.open.size || this.expanded > this.maxNodes) {
        this.finish(this.best);
        return true;
      }
      const k = this.open.pop();
      if (this.state[k] === 2) continue;
      this.state[k] = 2;
      this.expanded++;
      if (k === this.goal) {
        this.finish(k);
        return true;
      }
      const lx = Math.floor(k / H), lz = k - lx * H;
      const ix = lx + this.x0, iz = lz + this.z0;
      const hk = this.heur(ix, iz);
      if (hk < this.bestH) {
        this.bestH = hk;
        this.best = k;
      }
      const gk = this.g[k]!;
      for (const [dx, dz, len] of NB) {
        const nx = lx + dx, nz = lz + dz;
        if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
        const nk = nx * H + nz;
        if (this.state[nk] === 2) continue;
        const kc = this.kind(nk, ix + dx, iz + dz);
        if (kc >= BLOCKED) continue;
        // No cutting corners past a blocked cell.
        if (dx && dz && (this.kind(nx * H + lz, ix + dx, iz) >= BLOCKED || this.kind(lx * H + nz, ix, iz + dz) >= BLOCKED)) continue;
        const ng = gk + len * this.costTable[kc]!;
        if (this.state[nk] === 1 && this.g[nk]! <= ng) continue;
        this.g[nk] = ng;
        this.from[nk] = k;
        this.state[nk] = 1;
        this.open.push(nk, ng + this.heur(ix + dx, iz + dz));
      }
    }
    return false;
  }

  /** Run to the end now (cutscenes, tests). */
  finishNow(): NavPoint[] | null {
    while (!this.step(50000));
    return this.path;
  }

  private finish(end: number): void {
    this.done = true;
    if (end < 0) return;
    this.reached = end === this.goal;
    const H = this.h;
    const cells: NavPoint[] = [];
    const kinds: number[] = [];
    for (let k = end; k >= 0; k = this.from[k]!) {
      const lx = Math.floor(k / H);
      cells.push(this.nav.centreOf(lx + this.x0, k - lx * H + this.z0));
      kinds.push(this.cost[k]!);
    }
    cells.reverse();
    kinds.reverse();
    // Exact ends: start where we stand; finish on the goal itself when it was reached.
    cells[0] = [this.sx, this.sz];
    if (this.reached) cells[cells.length - 1] = [this.gx, this.gz];
    this.path = this.nav.smooth(cells, kinds.map((c) => (c >= BLOCKED ? 1 : this.costTable[c]!)), this.costTable);
  }
}

class Chunk {
  readonly cell = new Uint8Array(CHUNK * CHUNK);
}

export class NavGrid {
  private chunks = new Map<number, Chunk>();
  /** Clearance radius baked into "blocked" (people are 0.3 m; plus a margin so straight legs between cell centres never graze a corner; 1 m doorways still pass). */
  readonly clearance: number;
  bakedChunks = 0;
  /** Work counter: searches charge chunk bakes to their frame budget. */
  work = 0;

  constructor(private world: NavWorld, clearance = 0.34) {
    this.clearance = clearance;
  }

  cellOf(x: number, z: number): [number, number] {
    return [Math.floor(x / CELL) + OFF, Math.floor(z / CELL) + OFF];
  }

  centreOf(ix: number, iz: number): NavPoint {
    return [(ix - OFF + 0.5) * CELL, (iz - OFF + 0.5) * CELL];
  }

  private chunk(cx: number, cz: number): Chunk {
    const k = cx * 0x10000 + cz;
    let c = this.chunks.get(k);
    if (c) return c;
    c = new Chunk();
    // Ground kind: sampled every 50 cm (it changes slowly; costs only steer the choice).
    const half = CHUNK / 2;
    const kinds = new Uint8Array(half * half);
    const PATHY = [0, 3]; // path, rough (red-earth footpaths)
    const LAWN = 4;
    const sample = (i: number, j: number) => {
      const [x, z] = this.centreOf(cx * CHUNK + i * 2, cz * CHUNK + j * 2);
      return KINDS.indexOf(this.world.ground(x + CELL / 2, z + CELL / 2));
    };
    for (let i = 0; i < half; i++) for (let j = 0; j < half; j++) kinds[i * half + j] = sample(i, j);
    // Footpath samples next to lawn are the verge: a little dearer, so routes keep to the middle.
    const at = (i: number, j: number) => (i >= 0 && j >= 0 && i < half && j < half ? kinds[i * half + j]! : sample(i, j));
    const verge: number[] = [];
    for (let i = 0; i < half; i++)
      for (let j = 0; j < half; j++) {
        if (!PATHY.includes(kinds[i * half + j]!)) continue;
        if (at(i + 1, j) === LAWN || at(i - 1, j) === LAWN || at(i, j + 1) === LAWN || at(i, j - 1) === LAWN) verge.push(i * half + j);
      }
    for (const v of verge) kinds[v] = VERGE;
    for (let i = 0; i < CHUNK; i++)
      for (let j = 0; j < CHUNK; j++) {
        const [x, z] = this.centreOf(cx * CHUNK + i, cz * CHUNK + j);
        c.cell[i * CHUNK + j] = this.world.blocked(x, z, this.clearance) ? BLOCKED : kinds[(i >> 1) * half + (j >> 1)]!;
      }
    this.chunks.set(k, c);
    this.bakedChunks++;
    this.work += 2000;
    return c;
  }

  /** True when the chunk holding (x, z) is baked (amortised pre-baking). */
  isBaked(x: number, z: number): boolean {
    const [ix, iz] = this.cellOf(x, z);
    return this.chunks.has(Math.floor(ix / CHUNK) * 0x10000 + Math.floor(iz / CHUNK));
  }

  /** Bake the chunk at (x, z) now (call a few per frame round where people are). */
  bakeAt(x: number, z: number): void {
    const [ix, iz] = this.cellOf(x, z);
    this.chunk(Math.floor(ix / CHUNK), Math.floor(iz / CHUNK));
  }

  /** Kind index (0..5) of a cell, or BLOCKED. */
  raw(ix: number, iz: number): number {
    const cx = Math.floor(ix / CHUNK), cz = Math.floor(iz / CHUNK);
    return this.chunk(cx, cz).cell[(ix - cx * CHUNK) * CHUNK + (iz - cz * CHUNK)]!;
  }

  walkable(x: number, z: number): boolean {
    const [ix, iz] = this.cellOf(x, z);
    return this.raw(ix, iz) < BLOCKED;
  }

  kindAt(x: number, z: number): GroundKind | "blocked" {
    const [ix, iz] = this.cellOf(x, z);
    const r = this.raw(ix, iz);
    return r >= BLOCKED ? "blocked" : KINDS[r]!;
  }

  /** The nearest walkable point to (x, z) within `radius` metres (targets placed on furniture), or null. */
  nearestWalkable(x: number, z: number, radius = 2.5): NavPoint | null {
    if (this.walkable(x, z)) return [x, z];
    for (let r = CELL / 2; r <= radius + 1e-6; r += CELL / 2) {
      const n = Math.max(8, Math.ceil((Math.PI * 2 * r) / (CELL / 2)));
      for (let a = 0; a < n; a++) {
        const px = x + Math.cos((a / n) * Math.PI * 2) * r, pz = z + Math.sin((a / n) * Math.PI * 2) * r;
        if (this.walkable(px, pz)) return [px, pz];
      }
    }
    return null;
  }

  /** The nearest point within `radius` whose ground is one of `kinds` (route marks snap on to footpaths), or null. */
  nearestOfKind(x: number, z: number, kinds: GroundKind[], radius = 3.5): NavPoint | null {
    const want = kinds.map((k) => KINDS.indexOf(k));
    const ok = (px: number, pz: number) => {
      const [ix, iz] = this.cellOf(px, pz);
      return want.includes(this.raw(ix, iz));
    };
    if (ok(x, z)) return [x, z];
    for (let r = CELL; r <= radius + 1e-6; r += CELL) {
      const n = Math.max(8, Math.ceil((Math.PI * 2 * r) / CELL));
      let best: NavPoint | null = null;
      for (let a = 0; a < n; a++) {
        const px = x + Math.cos((a / n) * Math.PI * 2) * r, pz = z + Math.sin((a / n) * Math.PI * 2) * r;
        if (ok(px, pz)) {
          best = [px, pz];
          break;
        }
      }
      if (best) {
        // Step a little further in, off the very edge of the path.
        const dx = best[0] - x, dz = best[1] - z, d = Math.hypot(dx, dz) || 1;
        const deeper: NavPoint = [best[0] + (dx / d) * 0.4, best[1] + (dz / d) * 0.4];
        return ok(deeper[0], deeper[1]) && this.walkable(deeper[0], deeper[1]) ? deeper : best;
      }
    }
    return null;
  }

  /**
   * Walking cost of the straight segment a to b over the grid (metres times
   * each cell's cost), or Infinity when it touches a blocked cell (including
   * squeezing diagonally between two blocked cells).
   */
  segmentCost(a: NavPoint, b: NavPoint, costTable: number[] = DEFAULT_COSTS): number {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(d / (CELL * 0.3)));
    const stepLen = d / n;
    let lastI = NaN, lastJ = NaN, lastC = 0, total = 0;
    for (let i = 0; i <= n; i++) {
      const x = a[0] + ((b[0] - a[0]) * i) / n, z = a[1] + ((b[1] - a[1]) * i) / n;
      const [ix, iz] = this.cellOf(x, z);
      if (i > 0) total += stepLen * lastC;
      if (ix === lastI && iz === lastJ) continue;
      if (!Number.isNaN(lastI) && ix !== lastI && iz !== lastJ) {
        if (this.raw(ix, lastJ) >= BLOCKED || this.raw(lastI, iz) >= BLOCKED) return Infinity;
      }
      lastI = ix;
      lastJ = iz;
      const r = this.raw(ix, iz);
      if (r >= BLOCKED) return Infinity;
      lastC = costTable[r]!;
    }
    return total;
  }

  /** Line of sight: the straight segment a to b touches nothing solid. */
  clear(a: NavPoint, b: NavPoint): boolean {
    return this.segmentCost(a, b) < Infinity;
  }

  /**
   * String pulling: keep only the corners needed. A shortcut from corner i to
   * corner j is taken only when it is clear AND costs no more than the cell
   * path it replaces (so it never cuts across a lawn the search had walked
   * round on the footpath, or strays on to the road).
   */
  smooth(cells: NavPoint[], cellCost: number[], costTable: number[]): NavPoint[] {
    if (cells.length <= 2) return cells;
    // Cost along the cell path up to each cell.
    const cum: number[] = [0];
    for (let i = 1; i < cells.length; i++) {
      const a = cells[i - 1]!, b = cells[i]!;
      cum.push(cum[i - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1]) * (cellCost[i - 1]! + cellCost[i]!) / 2);
    }
    // Corners of the cell path (direction changes).
    const idx: number[] = [0];
    for (let i = 1; i < cells.length - 1; i++) {
      const a = cells[i - 1]!, b = cells[i]!, c = cells[i + 1]!;
      if (Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) > 1e-9) idx.push(i);
    }
    idx.push(cells.length - 1);
    const out: NavPoint[] = [cells[0]!];
    let i = 0;
    while (i < idx.length - 1) {
      let j = idx.length - 1;
      for (; j > i + 1; j--) {
        const along = cum[idx[j]!]! - cum[idx[i]!]!;
        if (this.segmentCost(cells[idx[i]!]!, cells[idx[j]!]!, costTable) <= along * 1.03 + 0.1) break;
      }
      out.push(cells[idx[j]!]!);
      i = j;
    }
    return out;
  }

  /** Start a search (step it with a budget, or call finishNow). */
  search(from: NavPoint, to: NavPoint, o: SearchOptions = {}): PathSearch {
    return new PathSearch(this, from[0], from[1], to[0], to[1], o);
  }

  /** Search to completion now (cutscenes, tests). */
  findPath(from: NavPoint, to: NavPoint, o: SearchOptions = {}): NavPoint[] | null {
    return this.search(from, to, o).finishNow();
  }

  /** Total length of a path. */
  static length(p: NavPoint[]): number {
    let L = 0;
    for (let i = 1; i < p.length; i++) L += Math.hypot(p[i]![0] - p[i - 1]![0], p[i]![1] - p[i - 1]![1]);
    return L;
  }
}
