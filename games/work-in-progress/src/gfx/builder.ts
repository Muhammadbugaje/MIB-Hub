/**
 * Geometry builder: collects triangles for static scenery (roads, kerbs,
 * buildings, props) into big merged meshes, one per material and map chunk.
 * That keeps draw calls low (a whole district is a handful of meshes) while
 * the chunks still let the camera skip what is behind it.
 *
 * Every shape is placed through the current transform: `at(x, z, rot, y)`
 * puts the local origin at a spot on the map, turned by rot about y (the
 * same convention as the engine and sim/collide.ts).
 */
export type RGBA = [number, number, number, number?];
export type V3 = [number, number, number];

export class MeshData {
  pos: number[] = [];
  nor: number[] = [];
  uv: number[] = [];
  col: number[] = [];
  idx: number[] = [];
  get vertexCount(): number {
    return this.pos.length / 3;
  }
}

/** Current placement: origin, rotation about y, plus an optional uniform scale. */
interface Xf { x: number; y: number; z: number; c: number; s: number; k: number }

export class Builder {
  private xf: Xf = { x: 0, y: 0, z: 0, c: 1, s: 0, k: 1 };
  /** Colour applied to new vertices (0..255 sRGB). */
  color: RGBA = [255, 255, 255, 255];
  constructor(private sink: (mat: string, x: number, z: number) => MeshData) {}

  at(x: number, z: number, rot = 0, y = 0, scale = 1): this {
    this.xf = { x, y, z, c: Math.cos(rot), s: Math.sin(rot), k: scale };
    return this;
  }

  tint(c: RGBA): this {
    this.color = c;
    return this;
  }

  /** Local point to world. */
  w(p: V3): V3 {
    const { x, y, z, c, s, k } = this.xf;
    return [x + (p[0] * c + p[2] * s) * k, y + p[1] * k, z + (-p[0] * s + p[2] * c) * k];
  }
  private wn(n: V3): V3 {
    const { c, s } = this.xf;
    return [n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c];
  }

  private mesh(mat: string): MeshData {
    return this.sink(mat, this.xf.x, this.xf.z);
  }

  /** A triangle fan / polygon given by local points (convex), with one normal. */
  poly(mat: string, pts: V3[], uvs: [number, number][], normal?: V3): void {
    const m = this.mesh(mat);
    const base = m.vertexCount;
    const n = normal ?? faceNormal(pts[0]!, pts[1]!, pts[2]!);
    // Keep the winding consistent with the requested normal (front faces are anticlockwise).
    if (normal && pts.length >= 3) {
      const f = polyNormal(pts);
      if (f[0] * normal[0] + f[1] * normal[1] + f[2] * normal[2] < 0) {
        pts = [...pts].reverse();
        uvs = [...uvs].reverse();
      }
    }
    const wn = this.wn(n);
    const [r, g, b, a = 255] = this.color;
    pts.forEach((p, i) => {
      const q = this.w(p);
      m.pos.push(q[0], q[1], q[2]);
      m.nor.push(wn[0], wn[1], wn[2]);
      m.uv.push(uvs[i]![0], uvs[i]![1]);
      m.col.push(r, g, b, a);
    });
    for (let i = 1; i < pts.length - 1; i++) m.idx.push(base, base + i, base + i + 1);
  }

  /** Quad a-b-c-d (anticlockwise seen from the front), UVs from world-ish metres. */
  quad(mat: string, a: V3, b: V3, c: V3, d: V3, uvScale = 1, uv?: [number, number][]): void {
    const n = faceNormal(a, b, c);
    if (!uv) {
      const ex = len(sub(b, a)), ey = len(sub(d, a));
      uv = [[0, 0], [ex / uvScale, 0], [ex / uvScale, ey / uvScale], [0, ey / uvScale]];
    }
    this.poly(mat, [a, b, c, d], uv, n);
  }

  /**
   * Axis-aligned box in local space: centre (cx, cy-bottom, cz), size (sx, sy, sz).
   * UVs are in metres / uvScale so tiling textures line up on every face.
   * skip: faces to leave out ("top", "bottom", "front" (+z), "back", "left" (-x), "right").
   */
  box(mat: string, cx: number, y0: number, cz: number, sx: number, sy: number, sz: number, uvScale = 1, skip: string[] = []): void {
    const x0 = cx - sx / 2, x1 = cx + sx / 2, z0 = cz - sz / 2, z1 = cz + sz / 2, y1 = y0 + sy;
    const u = (v: number) => v / uvScale;
    if (!skip.includes("front")) this.poly(mat, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [[u(x0), u(y0)], [u(x1), u(y0)], [u(x1), u(y1)], [u(x0), u(y1)]], [0, 0, 1]);
    if (!skip.includes("back")) this.poly(mat, [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [[u(-x1), u(y0)], [u(-x0), u(y0)], [u(-x0), u(y1)], [u(-x1), u(y1)]], [0, 0, -1]);
    if (!skip.includes("right")) this.poly(mat, [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [[u(-z1), u(y0)], [u(-z0), u(y0)], [u(-z0), u(y1)], [u(-z1), u(y1)]], [1, 0, 0]);
    if (!skip.includes("left")) this.poly(mat, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [[u(z0), u(y0)], [u(z1), u(y0)], [u(z1), u(y1)], [u(z0), u(y1)]], [-1, 0, 0]);
    if (!skip.includes("top")) this.poly(mat, [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [[u(x0), u(-z1)], [u(x1), u(-z1)], [u(x1), u(-z0)], [u(x0), u(-z0)]], [0, 1, 0]);
    if (!skip.includes("bottom")) this.poly(mat, [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [[u(x0), u(z0)], [u(x1), u(z0)], [u(x1), u(z1)], [u(x0), u(z1)]], [0, -1, 0]);
  }

  /**
   * Cylinder or cone along y: bottom centre (cx, y0, cz), radii r0 (bottom), r1 (top).
   * segs = 4 makes a square pillar or pyramid (rotated so faces line up with the axes).
   */
  cylinder(mat: string, cx: number, y0: number, cz: number, r0: number, r1: number, h: number, segs = 12, caps = true, smooth = true, uvScale = 1): void {
    const m = this.mesh(mat);
    const off = segs === 4 ? Math.PI / 4 : 0;
    const k = segs === 4 ? Math.SQRT2 : 1;
    const [r, g, b, a = 255] = this.color;
    const slope = (r0 - r1) / h;
    const ring = (i: number) => off + (i / segs) * Math.PI * 2;
    const circ = 2 * Math.PI * Math.max(r0, r1);
    if (smooth && segs > 4) {
      const base = m.vertexCount;
      for (let i = 0; i <= segs; i++) {
        const t = ring(i), cs = Math.cos(t), sn = Math.sin(t);
        const n = this.wn(norm([cs, slope, sn]));
        for (const [rad, y] of [[r0, y0], [r1, y0 + h]] as const) {
          const q = this.w([cx + cs * rad * k, y, cz + sn * rad * k]);
          m.pos.push(q[0], q[1], q[2]);
          m.nor.push(n[0], n[1], n[2]);
          m.uv.push(((i / segs) * circ) / uvScale, (y - y0) / uvScale);
          m.col.push(r, g, b, a);
        }
      }
      for (let i = 0; i < segs; i++) {
        const v = base + i * 2;
        m.idx.push(v, v + 1, v + 3, v, v + 3, v + 2);
      }
    } else {
      for (let i = 0; i < segs; i++) {
        const t0 = ring(i), t1 = ring(i + 1);
        const p = (t: number, rad: number, y: number): V3 => [cx + Math.cos(t) * rad * k, y, cz + Math.sin(t) * rad * k];
        const a0 = p(t0, r0, y0), a1 = p(t1, r0, y0), b1 = p(t1, r1, y0 + h), b0 = p(t0, r1, y0 + h);
        if (r1 < 1e-4) this.poly(mat, [a1, a0, b0], [[0, 0], [1, 0], [0.5, 1]]);
        else this.quad(mat, a1, a0, b0, b1, uvScale);
      }
    }
    if (caps && r1 > 1e-4) {
      const pts: V3[] = [];
      for (let i = segs - 1; i >= 0; i--) pts.push([cx + Math.cos(ring(i)) * r1 * k, y0 + h, cz + Math.sin(ring(i)) * r1 * k]);
      this.poly(mat, pts, pts.map((p) => [p[0] / uvScale, p[2] / uvScale]), [0, 1, 0]);
    }
  }

  /** A wheel: a short cylinder whose axis is local x (tyre seen from the side). */
  wheel(mat: string, cx: number, cy: number, cz: number, r: number, width: number, segs = 12): void {
    const ring: V3[] = [];
    for (let i = 0; i < segs; i++) {
      // Start at the bottom so the lowest vertex is exactly cy - r (wheels touch the road).
      const a = -Math.PI / 2 + (i / segs) * Math.PI * 2;
      ring.push([0, cy + Math.sin(a) * r, cz + Math.cos(a) * r]);
    }
    const hw = width / 2;
    for (let i = 0; i < segs; i++) {
      const p = ring[i]!, q = ring[(i + 1) % segs]!;
      const mid = norm([0, (p[1] + q[1]) / 2 - cy, (p[2] + q[2]) / 2 - cz]);
      this.poly(mat, [[cx - hw, p[1], p[2]], [cx - hw, q[1], q[2]], [cx + hw, q[1], q[2]], [cx + hw, p[1], p[2]]], [[0, 0], [1, 0], [1, 1], [0, 1]], mid);
    }
    for (const sx of [-1, 1]) {
      const pts = ring.map((p): V3 => [cx + sx * hw, p[1], p[2]]);
      if (sx < 0) pts.reverse();
      this.poly(mat, pts, pts.map(() => [0, 0] as [number, number]), [sx, 0, 0]);
    }
  }

  /** A tapered cylinder between two local points (branches, tilted poles). */
  limb(mat: string, a: V3, b: V3, r0: number, r1: number, segs = 7): void {
    const m = this.mesh(mat);
    const axis = norm(sub(b, a));
    const ref: V3 = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u = norm(cross(axis, ref)), v = cross(axis, u);
    const [cr, cg, cb, ca = 255] = this.color;
    const base = m.vertexCount;
    const L = len(sub(b, a));
    for (let i = 0; i <= segs; i++) {
      const t = (i / segs) * Math.PI * 2;
      const dir: V3 = [u[0] * Math.cos(t) + v[0] * Math.sin(t), u[1] * Math.cos(t) + v[1] * Math.sin(t), u[2] * Math.cos(t) + v[2] * Math.sin(t)];
      const wn = this.wn(dir);
      for (const [p, r, vv] of [[a, r0, 0], [b, r1, L]] as const) {
        const q = this.w([p[0] + dir[0] * r, p[1] + dir[1] * r, p[2] + dir[2] * r]);
        m.pos.push(q[0], q[1], q[2]);
        m.nor.push(wn[0], wn[1], wn[2]);
        m.uv.push(i / segs, vv / 2);
        m.col.push(cr, cg, cb, ca);
      }
    }
    for (let i = 0; i < segs; i++) {
      const k = base + i * 2;
      m.idx.push(k, k + 3, k + 1, k, k + 2, k + 3);
    }
  }

  /**
   * A lumpy blob (tree crown clump): a sphere pushed in and out by noise,
   * coloured lighter on top and darker underneath (cheap ambient occlusion).
   */
  blob(mat: string, c: V3, r: number, seed: number, top: RGBA, bottom: RGBA, sy = 0.8, segs = 10, rings = 7, bump = 0.22): void {
    const m = this.mesh(mat);
    const base = m.vertexCount;
    for (let j = 0; j <= rings; j++) {
      const phi = -Math.PI / 2 + (j / rings) * Math.PI;
      for (let i = 0; i <= segs; i++) {
        const t = (i / segs) * Math.PI * 2;
        const n: V3 = [Math.cos(phi) * Math.cos(t), Math.sin(phi), Math.cos(phi) * Math.sin(t)];
        const k = 1 + bump * (Math.sin(n[0] * 5.1 + seed) * Math.sin(n[1] * 4.3 + seed * 1.7) * Math.sin(n[2] * 4.7 + seed * 0.7) * 2 + Math.sin(t * 3 + seed) * 0.3);
        const pl: V3 = [c[0] + n[0] * r * k, c[1] + n[1] * r * k * sy, c[2] + n[2] * r * k];
        const q = this.w(pl);
        const wn = this.wn(norm([n[0], n[1] / sy, n[2]]));
        const h = (n[1] + 1) / 2;
        m.pos.push(q[0], q[1], q[2]);
        m.nor.push(wn[0], wn[1], wn[2]);
        m.uv.push((t / (Math.PI * 2)) * r * 2.2, (phi / Math.PI + 0.5) * r * 1.6);
        m.col.push(bottom[0] + (top[0] - bottom[0]) * h, bottom[1] + (top[1] - bottom[1]) * h, bottom[2] + (top[2] - bottom[2]) * h, 255);
      }
    }
    const cols = segs + 1;
    for (let j = 0; j < rings; j++)
      for (let i = 0; i < segs; i++) {
        const v = base + j * cols + i;
        m.idx.push(v, v + cols, v + 1, v + 1, v + cols, v + cols + 1);
      }
  }

  /** Dome / sphere cap: centre at (cx, y0, cz), radius r, from the equator up (or a full sphere). sy squashes it. */
  dome(mat: string, cx: number, y0: number, cz: number, r: number, segs = 16, rings = 6, full = false, sy = 1): void {
    const m = this.mesh(mat);
    const base = m.vertexCount;
    const [cr, cg, cb, ca = 255] = this.color;
    const start = full ? -rings : 0;
    for (let j = start; j <= rings; j++) {
      const phi = (j / rings) * (Math.PI / 2);
      for (let i = 0; i <= segs; i++) {
        const t = (i / segs) * Math.PI * 2;
        const n: V3 = [Math.cos(phi) * Math.cos(t), Math.sin(phi), Math.cos(phi) * Math.sin(t)];
        const q = this.w([cx + n[0] * r, y0 + n[1] * r * sy, cz + n[2] * r]);
        const wn = this.wn(norm([n[0], n[1] / sy, n[2]]));
        m.pos.push(q[0], q[1], q[2]);
        m.nor.push(wn[0], wn[1], wn[2]);
        m.uv.push((i / segs) * 2 * Math.PI * r, phi * r);
        m.col.push(cr, cg, cb, ca);
      }
    }
    const cols = segs + 1;
    for (let j = 0; j < rings - start; j++)
      for (let i = 0; i < segs; i++) {
        const v = base + j * cols + i;
        m.idx.push(v, v + cols, v + 1, v + 1, v + cols, v + cols + 1);
      }
  }

  /**
   * Gable roof over a w x d footprint (local, centred at cx, cz), ridge along x.
   * Eave at y0, ridge height rise, overhang o. The two gable ends are walls (wallMat).
   */
  gableRoof(mat: string, wallMat: string | null, cx: number, y0: number, cz: number, w: number, d: number, rise: number, o = 0.5, thick = 0.18): void {
    const x0 = cx - w / 2 - o, x1 = cx + w / 2 + o, zf = cz + d / 2 + o, zb = cz - d / 2 - o;
    const drop = (rise / (d / 2)) * o;
    const ridge = y0 + rise;
    const ye = y0 - drop;
    const sl = Math.hypot(d / 2 + o, rise + drop);
    // Two slopes (top and a thin underside).
    this.quad(mat, [x0, ye, zf], [x1, ye, zf], [x1, ridge, cz], [x0, ridge, cz], 1, [[0, 0], [x1 - x0, 0], [x1 - x0, sl], [0, sl]]);
    this.quad(mat, [x1, ye, zb], [x0, ye, zb], [x0, ridge, cz], [x1, ridge, cz], 1, [[0, 0], [x1 - x0, 0], [x1 - x0, sl], [0, sl]]);
    this.quad(mat, [x1, ye - thick, zf], [x0, ye - thick, zf], [x0, ridge - thick, cz], [x1, ridge - thick, cz], 1);
    this.quad(mat, [x0, ye - thick, zb], [x1, ye - thick, zb], [x1, ridge - thick, cz], [x0, ridge - thick, cz], 1);
    // Fascia boards.
    this.quad(mat, [x0, ye - thick, zf], [x1, ye - thick, zf], [x1, ye, zf], [x0, ye, zf], 1);
    this.quad(mat, [x1, ye - thick, zb], [x0, ye - thick, zb], [x0, ye, zb], [x1, ye, zb], 1);
    if (wallMat) {
      const gx0 = cx - w / 2, gx1 = cx + w / 2;
      this.poly(wallMat, [[gx1, y0, cz + d / 2], [gx1, y0, cz - d / 2], [gx1, ridge, cz]], [[0, 0], [d, 0], [d / 2, rise]], [1, 0, 0]);
      this.poly(wallMat, [[gx0, y0, cz - d / 2], [gx0, y0, cz + d / 2], [gx0, ridge, cz]], [[0, 0], [d, 0], [d / 2, rise]], [-1, 0, 0]);
    }
    // Barge boards on the gable edges.
    this.poly(mat, [[x0, ye, zf], [x0, ridge, cz], [x0, ridge - thick, cz], [x0, ye - thick, zf]], [[0, 0], [1, 0], [1, 0.2], [0, 0.2]], [-1, 0, 0]);
    this.poly(mat, [[x0, ridge, cz], [x0, ye, zb], [x0, ye - thick, zb], [x0, ridge - thick, cz]], [[0, 0], [1, 0], [1, 0.2], [0, 0.2]], [-1, 0, 0]);
    this.poly(mat, [[x1, ridge, cz], [x1, ye, zf], [x1, ye - thick, zf], [x1, ridge - thick, cz]], [[0, 0], [1, 0], [1, 0.2], [0, 0.2]], [1, 0, 0]);
    this.poly(mat, [[x1, ye, zb], [x1, ridge, cz], [x1, ridge - thick, cz], [x1, ye - thick, zb]], [[0, 0], [1, 0], [1, 0.2], [0, 0.2]], [1, 0, 0]);
  }

  /** Hipped roof: four slopes up to a short ridge along x. */
  hipRoof(mat: string, cx: number, y0: number, cz: number, w: number, d: number, rise: number, o = 0.6): void {
    const hw = w / 2 + o, hd = d / 2 + o;
    const inset = Math.min(hd, hw);
    const rx = Math.max(0, hw - inset);
    const ye = y0 - (rise / inset) * o * 0.6;
    const top = y0 + rise;
    const A: V3 = [cx - hw, ye, cz + hd], B: V3 = [cx + hw, ye, cz + hd], Cc: V3 = [cx + hw, ye, cz - hd], D: V3 = [cx - hw, ye, cz - hd];
    const R0: V3 = [cx - rx, top, cz], R1: V3 = [cx + rx, top, cz];
    const sl = Math.hypot(hd, top - ye);
    this.poly(mat, [A, B, R1, R0], [[0, 0], [2 * hw, 0], [hw + rx, sl], [hw - rx, sl]]);
    this.poly(mat, [Cc, D, R0, R1], [[0, 0], [2 * hw, 0], [hw + rx, sl], [hw - rx, sl]]);
    this.poly(mat, [B, Cc, R1], [[0, 0], [2 * hd, 0], [hd, sl]]);
    this.poly(mat, [D, A, R0], [[0, 0], [2 * hd, 0], [hd, sl]]);
    // Underside so the overhang is solid from below.
    this.poly(mat, [D, Cc, B, A], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, -1, 0]);
  }

  /**
   * A wall with round-arched openings (arcade / loggia / cloister). Local: the
   * wall runs along x from x0 to x1 at depth z (thickness t towards -z),
   * bottom y0, top y1, arches of the given count, springing at ys.
   */
  arcade(mat: string, x0: number, x1: number, z: number, t: number, y0: number, y1: number, count: number, ys: number, pier = 0.6): void {
    const bay = (x1 - x0) / count;
    const r = (bay - pier) / 2;
    for (let i = 0; i <= count; i++) {
      // Piers.
      const px = x0 + i * bay;
      const pw = i === 0 || i === count ? pier / 2 : pier;
      const pcx = i === 0 ? px + pw / 2 : i === count ? px - pw / 2 : px;
      this.box(mat, pcx, y0, z - t / 2, pw, ys - y0, t, 1, ["top", "bottom"]);
    }
    for (let i = 0; i < count; i++) {
      const cx = x0 + i * bay + bay / 2;
      const steps = 10;
      for (let k = 0; k < steps; k++) {
        const a0 = Math.PI - (k / steps) * Math.PI, a1 = Math.PI - ((k + 1) / steps) * Math.PI;
        const p0x = cx + Math.cos(a0) * r, p0y = ys + Math.sin(a0) * r;
        const p1x = cx + Math.cos(a1) * r, p1y = ys + Math.sin(a1) * r;
        // Spandrel front and back.
        this.quad(mat, [p0x, p0y, z], [p1x, p1y, z], [p1x, y1, z], [p0x, y1, z], 1);
        this.quad(mat, [p1x, p1y, z - t], [p0x, p0y, z - t], [p0x, y1, z - t], [p1x, y1, z - t], 1);
        // Intrados (the curved underside).
        this.quad(mat, [p0x, p0y, z - t], [p1x, p1y, z - t], [p1x, p1y, z], [p0x, p0y, z], 1);
      }
      // Fill above the pier tops beside the arch.
      this.box(mat, cx - bay / 2 + pier / 4, ys, z - t / 2, pier / 2, y1 - ys, t, 1, ["bottom", "top", "left", "right"]);
      this.box(mat, cx + bay / 2 - pier / 4, ys, z - t / 2, pier / 2, y1 - ys, t, 1, ["bottom", "top", "left", "right"]);
    }
    this.box(mat, (x0 + x1) / 2, y1 - 0.001, z - t / 2, x1 - x0, 0.001, t, 1, ["bottom", "front", "back", "left", "right"]);
  }

  /** A flat ribbon along a polyline (roads, paths, markings), at height y, width w, UV u across, v along (metres / uvScale). */
  ribbon(mat: string, line: [number, number][], w: number, y: number, uvScale = 1, uOff = 0): void {
    const m = this.sink(mat, line[0]![0], line[0]![1]);
    const [r, g, b, a = 255] = this.color;
    let dist = 0;
    const base = m.vertexCount;
    for (let i = 0; i < line.length; i++) {
      const p = line[i]!;
      const prev = line[Math.max(0, i - 1)]!, next = line[Math.min(line.length - 1, i + 1)]!;
      let dx = next[0] - prev[0], dz = next[1] - prev[1];
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
      if (i > 0) dist += Math.hypot(p[0] - line[i - 1]![0], p[1] - line[i - 1]![1]);
      const nx = -dz * (w / 2), nz = dx * (w / 2);
      m.pos.push(p[0] + nx, y, p[1] + nz, p[0] - nx, y, p[1] - nz);
      m.nor.push(0, 1, 0, 0, 1, 0);
      m.uv.push(uOff, dist / uvScale, uOff + w / uvScale, dist / uvScale);
      m.col.push(r, g, b, a, r, g, b, a);
    }
    for (let i = 0; i < line.length - 1; i++) {
      const v = base + i * 2;
      m.idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
    }
  }

  /** A raised kerb along a polyline: an L-shaped strip of the given height on one side (side = +1 left of travel, -1 right). */
  kerb(mat: string, line: [number, number][], offset: number, width: number, height: number, uvScale = 1): void {
    const m = this.sink(mat, line[0]![0], line[0]![1]);
    const [r, g, b, a = 255] = this.color;
    let dist = 0;
    const base = m.vertexCount;
    const verts: number[][] = [];
    for (let i = 0; i < line.length; i++) {
      const p = line[i]!;
      const prev = line[Math.max(0, i - 1)]!, next = line[Math.min(line.length - 1, i + 1)]!;
      let dx = next[0] - prev[0], dz = next[1] - prev[1];
      const l = Math.hypot(dx, dz) || 1;
      dx /= l;
      dz /= l;
      if (i > 0) dist += Math.hypot(p[0] - line[i - 1]![0], p[1] - line[i - 1]![1]);
      const nx = -dz, nz = dx;
      const inner = offset, outer = offset + Math.sign(offset || 1) * width;
      const s = Math.sign(offset || 1);
      // 4 vertices: face bottom, face top, top outer... with face normal pointing to the road.
      verts.push([p[0] + nx * inner, 0, p[1] + nz * inner, -nx * s, 0, -nz * s, dist / uvScale, 0]);
      verts.push([p[0] + nx * inner, height, p[1] + nz * inner, -nx * s, 0, -nz * s, dist / uvScale, height / uvScale]);
      verts.push([p[0] + nx * inner, height, p[1] + nz * inner, 0, 1, 0, dist / uvScale, height / uvScale]);
      verts.push([p[0] + nx * outer, height, p[1] + nz * outer, 0, 1, 0, dist / uvScale, (height + width) / uvScale]);
    }
    for (const v of verts) {
      m.pos.push(v[0]!, v[1]!, v[2]!);
      m.nor.push(v[3]!, v[4]!, v[5]!);
      m.uv.push(v[6]!, v[7]!);
      m.col.push(r, g, b, a);
    }
    for (let i = 0; i < line.length - 1; i++) {
      const v = base + i * 4, n = v + 4;
      const flip = offset < 0;
      const tri = (p: number, q: number, s2: number) => (flip ? m.idx.push(p, s2, q) : m.idx.push(p, q, s2));
      tri(v, n, v + 1); tri(v + 1, n, n + 1);
      tri(v + 2, n + 2, v + 3); tri(v + 3, n + 2, n + 3);
    }
  }

  /** A sagging wire (catenary) as a thin flat-ish tube of 2 crossed ribbons between two points. */
  wire(mat: string, a: V3, b: V3, sag: number, thick = 0.035, segs = 12): void {
    const m = this.sink(mat, a[0], a[2]);
    const [r, g, bl, al = 255] = this.color;
    for (const [ox, oy] of [[thick, 0], [0, thick]] as const) {
      const base = m.vertexCount;
      const dx = b[0] - a[0], dz = b[2] - a[2];
      const l = Math.hypot(dx, dz) || 1;
      const sx = (-dz / l) * ox, sz = (dx / l) * ox;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const y = a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t);
        const x = a[0] + dx * t, z = a[2] + dz * t;
        m.pos.push(x - sx, y - oy, z - sz, x + sx, y + oy, z + sz);
        m.nor.push(0, 1, 0, 0, 1, 0);
        m.uv.push(0, t, 1, t);
        m.col.push(r, g, bl, al, r, g, bl, al);
      }
      for (let i = 0; i < segs; i++) {
        const v = base + i * 2;
        m.idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3, v, v + 1, v + 2, v + 1, v + 3, v + 2);
      }
    }
  }
}

export function sub(a: V3, b: V3): V3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
export function cross(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
export function len(a: V3): number {
  return Math.hypot(a[0], a[1], a[2]);
}
export function norm(a: V3): V3 {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
/** Newell's method: robust normal of a polygon. */
export function polyNormal(p: V3[]): V3 {
  let x = 0, y = 0, z = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!, b = p[(i + 1) % p.length]!;
    x += (a[1] - b[1]) * (a[2] + b[2]);
    y += (a[2] - b[2]) * (a[0] + b[0]);
    z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return norm([x, y, z]);
}
export function faceNormal(a: V3, b: V3, c: V3): V3 {
  const u = sub(b, a), v = sub(c, a);
  return norm([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]);
}
