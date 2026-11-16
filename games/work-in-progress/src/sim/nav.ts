/**
 * NAVIGATION: where people can walk, and the best way there.
 *
 * A fine walkable grid (25 cm cells) baked from the real collision geometry
 * (every building, wall, fence, prop, tree trunk, water edge, interior wall
 * and piece of furniture: whatever the CollisionWorld holds) plus a cost per
 * cell read from the ground itself: footpaths, sidewalks, paving and zebra
 * crossings are cheap; lawns cost more; roads cost a lot (people cross at the
 * crossings). The grid is baked lazily in 16 m chunks the first time a search
 * touches them, so a phone only pays for the parts of the map in use, and
 * interiors (far east of the map) are just more chunks.
 *
 * Search: A* with an octile heuristic over 8 neighbours (no corner cutting),
 * run with a node budget so long searches spread over frames. Results are
 * string-pulled (line of sight on the grid, never into dearer ground than the
 * path already uses) into a few straight legs.
 *
 * Pure TypeScript, no engine: the tests run it headless on the same colliders.
 */

export type NavPoint = [number, number];

export const CELL = 0.25;
const CHUNK = 64; // cells per chunk side (16 m)
const BLOCKED = 255;

export interface NavWorld {
  /** True when a circle of radius r at (x, z) overlaps something solid. */
  blocked(x: number, z: number, r: number): boolean;
  /** Ground cost class at (x, z): "path" | "lawn" | "road" | "crossing" | "rough" | "floor". */
  ground(x: number, z: number): GroundKind;
}

export type GroundKind = "path" | "floor" | "crossing" | "lawn" | "rough" | "road";

/** Cost of walking one metre on each kind of ground (paths are the reference). */
export const GROUND_COST: Record<GroundKind, number> = { path: 1, floor: 1, crossing: 1, rough: 1.6, lawn: 2.4, road: 24 };

export interface SearchOptions {
  /** Ground kinds allowed at path cost (a scripted shortcut across the lawn, for example). */
  allow?: GroundKind[];
  /** Give up after this many expanded cells (very long or impossible searches). */
  maxNodes?: number;
  /** Heuristic weight (> 1 trades optimality for speed; 1.25 keeps paths natural). */
  weight?: number;
}

const key = (ix: number, iz: number) => ix * 0x100000 + iz;

class Chunk {
  readonly cost = new Uint8Array(CHUNK * CHUNK);
}

/** A binary min-heap of cell keys by f-score. */
class Heap {
  private keys: number[] = [];
  private f: number[] = [];
  get size(): number {
    return this.keys.length;
  }
  push(k: number, f: number): void {
    const a = this.keys, b = this.f;
    a.push(k);
    b.push(f);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (b[p]! <= f) break;
      a[i] = a[p]!;
      b[i] = b[p]!;
      i = p;
    }
    a[i] = k;
    b[i] = f;
  }
  pop(): number {
    const a = this.keys, b = this.f;
    const top = a[0]!;
    const lk = a.pop()!, lf = b.pop()!;
    if (a.length) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i, mf = lf;
        if (l < a.length && b[l]! < mf) {
          m = l;
          mf = b[l]!;
        }
        if (r < a.length && b[r]! < mf) m = r;
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

/** An in-progress search (stepped with a budget). */
export class PathSearch {
  done = false;
  path: NavPoint[] | null = null;
  expanded = 0;
  private open = new Heap();
  private g = new Map<number, number>();
  private from = new Map<number, number>();
  private closed = new Set<number>();
  private goalK: number;
  private best = { k: -1, h: Infinity };

  constructor(private nav: NavGrid, private sx: number, private sz: number, private gx: number, private gz: number, private o: SearchOptions) {
    const s = nav.cellOf(sx, sz), g = nav.cellOf(gx, gz);
    this.goalK = key(g[0], g[1]);
    const sk = key(s[0], s[1]);
    this.g.set(sk, 0);
    this.open.push(sk, this.h(s[0], s[1]));
  }

  private h(ix: number, iz: number): number {
    const g = this.nav.cellOf(this.gx, this.gz);
    const dx = Math.abs(ix - g[0]), dz = Math.abs(iz - g[1]);
    return (Math.max(dx, dz) + 0.4142 * Math.min(dx, dz)) * (this.o.weight ?? 1.25);
  }

  /** Expand up to `budget` cells. Returns true when finished (found or impossible). */
  step(budget: number): boolean {
    if (this.done) return true;
    const nav = this.nav;
    const maxNodes = this.o.maxNodes ?? 400000;
    while (budget-- > 0) {
      if (!this.open.size || this.expanded > maxNodes) {
        // Impossible or too far: settle for the closest reachable cell (never a path through walls).
        this.finish(this.best.k >= 0 ? this.best.k : -1);
        return true;
      }
      const k = this.open.pop();
      if (this.closed.has(k)) continue;
      this.closed.add(k);
      this.expanded++;
      if (k === this.goalK) {
        this.finish(k);
        return true;
      }
      const ix = Math.floor(k / 0x100000), iz = k - ix * 0x100000;
      const hk = this.h(ix, iz);
      if (hk < this.best.h) this.best = { k, h: hk };
      const gk = this.g.get(k)!;
      for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++) {
          if (!dx && !dz) continue;
          const nx = ix + dx, nz = iz + dz;
          const c = nav.costAt(nx, nz, this.o);
          if (c >= BLOCKED) continue;
          // No cutting corners past a blocked cell.
          if (dx && dz && (nav.costAt(ix + dx, iz, this.o) >= BLOCKED || nav.costAt(ix, iz + dz, this.o) >= BLOCKED)) continue;
          const nk = key(nx, nz);
          if (this.closed.has(nk)) continue;
          const step = (dx && dz ? 1.4142 : 1) * c;
          const ng = gk + step;
          const old = this.g.get(nk);
          if (old !== undefined && old <= ng) continue;
          this.g.set(nk, ng);
          this.from.set(nk, k);
          this.open.push(nk, ng + this.h(nx, nz));
        }
    }
    return false;
  }

  private finish(endK: number): void {
    this.done = true;
    if (endK < 0) {
      this.path = null;
      return;
    }
    const cells: NavPoint[] = [];
    for (let k: number | undefined = endK; k !== undefined; k = this.from.get(k)) {
      const ix = Math.floor(k / 0x100000), iz = k - ix * 0x100000;
      cells.push(this.nav.centreOf(ix, iz));
    }
    cells.reverse();
    // Exact ends: start where we are, finish on the goal when it was reached.
    if (cells.length) cells[0] = [this.sx, this.sz];
    if (endK === this.goalK) cells[cells.length - 1] = [this.gx, this.gz];
    this.path = this.nav.smooth(cells, this.o);
  }
}

export class NavGrid {
  private chunks = new Map<number, Chunk>();
  /** Clearance radius baked into "blocked" (a person is 0.3 m; slightly less lets 1 m doorways through). */
  readonly clearance: number;
  bakedChunks = 0;

  constructor(private world: NavWorld, clearance = 0.27) {
    this.clearance = clearance;
  }

  cellOf(x: number, z: number): [number, number] {
    return [Math.floor(x / CELL) + 0x40000, Math.floor(z / CELL) + 0x40000];
  }

  centreOf(ix: number, iz: number): NavPoint {
    return [(ix - 0x40000 + 0.5) * CELL, (iz - 0x40000 + 0.5) * CELL];
  }

  private chunk(cx: number, cz: number): Chunk {
    const k = cx * 0x10000 + cz;
    let c = this.chunks.get(k);
    if (c) return c;
    c = new Chunk();
    const kinds: GroundKind[] = ["path", "floor", "crossing", "lawn", "rough", "road"];
    for (let i = 0; i < CHUNK; i++)
      for (let j = 0; j < CHUNK; j++) {
        const [x, z] = this.centreOf(cx * CHUNK + i, cz * CHUNK + j);
        if (this.world.blocked(x, z, this.clearance)) c.cost[i * CHUNK + j] = BLOCKED;
        else c.cost[i * CHUNK + j] = kinds.indexOf(this.world.ground(x, z));
      }
    this.chunks.set(k, c);
    this.bakedChunks++;
    return c;
  }

  /** Ground kind index (0..5) of a cell, or BLOCKED. */
  raw(ix: number, iz: number): number {
    const cx = Math.floor(ix / CHUNK), cz = Math.floor(iz / CHUNK);
    return this.chunk(cx, cz).cost[(ix - cx * CHUNK) * CHUNK + (iz - cz * CHUNK)]!;
  }

  private static KINDS: GroundKind[] = ["path", "floor", "crossing", "lawn", "rough", "road"];

  costAt(ix: number, iz: number, o: SearchOptions = {}): number {
    const r = this.raw(ix, iz);
    if (r >= BLOCKED) return BLOCKED;
    const kind = NavGrid.KINDS[r]!;
    return o.allow?.includes(kind) ? 1 : GROUND_COST[kind];
  }

  walkable(x: number, z: number): boolean {
    const [ix, iz] = this.cellOf(x, z);
    return this.raw(ix, iz) < BLOCKED;
  }

  kindAt(x: number, z: number): GroundKind | "blocked" {
    const [ix, iz] = this.cellOf(x, z);
    const r = this.raw(ix, iz);
    return r >= BLOCKED ? "blocked" : NavGrid.KINDS[r]!;
  }

  /** The nearest walkable point to (x, z) within `radius` metres (for targets placed on furniture). */
  nearestWalkable(x: number, z: number, radius = 2): NavPoint | null {
    if (this.walkable(x, z)) return [x, z];
    let best: NavPoint | null = null, bd = Infinity;
    for (let r = CELL; r <= radius; r += CELL)
      for (let a = 0; a < 16; a++) {
        const px = x + Math.cos((a / 16) * Math.PI * 2) * r, pz = z + Math.sin((a / 16) * Math.PI * 2) * r;
        if (this.walkable(px, pz)) {
          const d = Math.hypot(px - x, pz - z);
          if (d < bd) {
            bd = d;
            best = [px, pz];
          }
        }
      }
    return best;
  }

  /**
   * Line of sight on the grid from a to b: every cell under the segment
   * (sampled at a quarter cell, swept by the clearance) is walkable and no
   * dearer than `maxCost`.
   */
  clear(a: NavPoint, b: NavPoint, maxCost: number, o: SearchOptions = {}): boolean {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(d / (CELL * 0.25)));
    for (let i = 0; i <= n; i++) {
      const x = a[0] + ((b[0] - a[0]) * i) / n, z = a[1] + ((b[1] - a[1]) * i) / n;
      const [ix, iz] = this.cellOf(x, z);
      const c = this.costAt(ix, iz, o);
      if (c >= BLOCKED || c > maxCost + 1e-6) return false;
    }
    return true;
  }

  /** String pulling: keep only the corners needed to stay on walkable ground of no greater cost. */
  smooth(cells: NavPoint[], o: SearchOptions = {}): NavPoint[] {
    if (cells.length <= 2) return cells;
    const costOf = (p: NavPoint) => {
      const [ix, iz] = this.cellOf(p[0], p[1]);
      return this.costAt(ix, iz, o);
    };
    const out: NavPoint[] = [cells[0]!];
    let i = 0;
    while (i < cells.length - 1) {
      let j = cells.length - 1;
      for (; j > i + 1; j--) {
        const maxC = Math.max(costOf(cells[i]!), costOf(cells[j]!));
        if (this.clear(cells[i]!, cells[j]!, maxC, o)) break;
      }
      out.push(cells[j]!);
      i = j;
    }
    return out;
  }

  /** Start a search (step it with a budget, or call findPath for an immediate answer). */
  search(from: NavPoint, to: NavPoint, o: SearchOptions = {}): PathSearch {
    return new PathSearch(this, from[0], from[1], to[0], to[1], o);
  }

  /** Search to completion now (cutscenes, tests). */
  findPath(from: NavPoint, to: NavPoint, o: SearchOptions = {}): NavPoint[] | null {
    const s = this.search(from, to, o);
    while (!s.step(20000));
    return s.path;
  }

  /** Total length of a path. */
  static length(p: NavPoint[]): number {
    let L = 0;
    for (let i = 1; i < p.length; i++) L += Math.hypot(p[i]![0] - p[i - 1]![0], p[i]![1] - p[i - 1]![1]);
    return L;
  }
}
