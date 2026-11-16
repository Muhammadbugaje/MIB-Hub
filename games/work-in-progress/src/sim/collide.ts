/**
 * Simple 2D collision for walking: buildings and walls are rotated boxes,
 * trees, poles and fountains are circles. The player is a circle that gets
 * pushed out of anything it overlaps. A grid keeps lookups cheap. Pure logic.
 */
/** h = height in metres (used by the camera so it never ends up inside a building). */
export type Collider =
  | { kind: "box"; x: number; z: number; hx: number; hz: number; rot: number; h?: number }
  | { kind: "circle"; x: number; z: number; r: number; h?: number };

export class CollisionWorld {
  private cells = new Map<string, Collider[]>();
  /** Largest query radius that `near` answers exactly (people, cameras, the goat). */
  static readonly MARGIN = 1;
  constructor(private cell = 16) {}

  add(c: Collider): void {
    // Registered in every cell within its reach plus a margin, so a query from
    // a neighbouring cell (a person standing just across a cell edge) still finds it.
    const r = (c.kind === "circle" ? c.r : Math.hypot(c.hx, c.hz)) + CollisionWorld.MARGIN;
    for (let gx = Math.floor((c.x - r) / this.cell); gx <= Math.floor((c.x + r) / this.cell); gx++)
      for (let gz = Math.floor((c.z - r) / this.cell); gz <= Math.floor((c.z + r) / this.cell); gz++) {
        const k = `${gx},${gz}`;
        let list = this.cells.get(k);
        if (!list) this.cells.set(k, (list = []));
        list.push(c);
      }
  }

  near(x: number, z: number): Collider[] {
    return this.cells.get(`${Math.floor(x / this.cell)},${Math.floor(z / this.cell)}`) ?? [];
  }

  /** Move a circle of radius r out of every collider it overlaps. Returns the corrected position. */
  resolve(x: number, z: number, r: number): [number, number] {
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (const c of this.near(x, z)) {
        const p = pushOut(c, x, z, r);
        if (p) {
          x = p[0];
          z = p[1];
          moved = true;
        }
      }
      if (!moved) break;
    }
    return [x, z];
  }

  /**
   * Camera spring arm: how far along the segment from (ax, ay, az) to (bx, by, bz)
   * a sphere of radius r can go (0..1) before it touches a solid. A solid
   * counts when its top is above the bottom of the sphere; solids without a
   * height are low walls (1 m), never ignored. The hit is refined by
   * bisection so the arm length changes smoothly (no stepping).
   */
  clearance(ax: number, ay: number, az: number, bx: number, by: number, bz: number, r = 0.35): number {
    const len = Math.hypot(bx - ax, by - ay, bz - az);
    const steps = Math.max(8, Math.ceil(len / 0.1));
    let prev = 0;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (this.hits(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t, r)) {
        let lo = prev, hi = t;
        for (let k = 0; k < 6; k++) {
          const m = (lo + hi) / 2;
          if (this.hits(ax + (bx - ax) * m, ay + (by - ay) * m, az + (bz - az) * m, r)) hi = m;
          else lo = m;
        }
        return lo;
      }
      prev = t;
    }
    return 1;
  }

  /** Is a sphere at (x, y, z) touching any solid (camera checks)? */
  inside(x: number, y: number, z: number, r: number): boolean {
    return this.hits(x, y, z, r);
  }

  private hits(x: number, y: number, z: number, r: number): boolean {
    // The sphere can overlap colliders listed in neighbouring cells: check the cells it touches.
    const seen = new Set<Collider>();
    for (const ox of [-r, r]) for (const oz of [-r, r]) for (const c of this.near(x + ox, z + oz)) {
      if (seen.has(c)) continue;
      seen.add(c);
      if ((c.h ?? 1) < y - r) continue;
      if (pushOut(c, x, z, r)) return true;
    }
    return false;
  }

  blocked(x: number, z: number, r: number): boolean {
    return this.near(x, z).some((c) => pushOut(c, x, z, r) !== null);
  }
}

/** Where a circle at (x, z) must move to stop overlapping c, or null when it does not overlap. */
export function pushOut(c: Collider, x: number, z: number, r: number): [number, number] | null {
  if (c.kind === "circle") {
    const dx = x - c.x, dz = z - c.z;
    const d = Math.hypot(dx, dz);
    const min = c.r + r;
    if (d >= min) return null;
    if (d < 1e-6) return [c.x + min, c.z];
    return [c.x + (dx / d) * min, c.z + (dz / d) * min];
  }
  // Into the box's local frame.
  const cos = Math.cos(c.rot), sin = Math.sin(c.rot);
  const dx = x - c.x, dz = z - c.z;
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;
  const qx = Math.max(-c.hx, Math.min(c.hx, lx));
  const qz = Math.max(-c.hz, Math.min(c.hz, lz));
  let ox = lx - qx, oz = lz - qz;
  const d = Math.hypot(ox, oz);
  if (d >= r) return null;
  let nlx: number, nlz: number;
  if (d > 1e-6) {
    ox /= d;
    oz /= d;
    nlx = qx + ox * r;
    nlz = qz + oz * r;
  } else {
    // Centre is inside: leave by the nearest face.
    const px = c.hx - Math.abs(lx), pz = c.hz - Math.abs(lz);
    if (px < pz) {
      nlx = Math.sign(lx || 1) * (c.hx + r);
      nlz = lz;
    } else {
      nlx = lx;
      nlz = Math.sign(lz || 1) * (c.hz + r);
    }
  }
  // Back to world space (inverse rotation).
  return [c.x + nlx * cos + nlz * sin, c.z - nlx * sin + nlz * cos];
}
