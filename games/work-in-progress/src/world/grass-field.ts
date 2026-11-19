/**
 * Grass up close: clumps of real blades on the lawns round the camera (about
 * 25 m on high quality, less on medium, none on phones), swaying in the wind
 * (vertex shader, the same wind as the trees), shrinking away towards the
 * edge of the patch so there is no hard line, with a few small flowers and
 * weeds among them. Blades overlap the path edges a little, softening where
 * grass meets paving.
 *
 * Two instanced meshes (plain clumps, flowering clumps) = two draw calls; the
 * patch is re-scattered from a fixed hash as the camera moves, so a spot
 * always grows the same clump.
 */
import * as pc from "playcanvas";
import { MeshData, type RGBA } from "../gfx/builder.ts";
import type { MatLib } from "../gfx/materials.ts";
import { meshFromData } from "../gfx/propmesh.ts";
import { makeRng } from "../sim/rng.ts";

const CELL = 0.55;

function hash(ix: number, iz: number, k: number): number {
  let h = (ix * 374761393 + iz * 668265263 + k * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function clumpMesh(device: pc.GraphicsDevice, flowers: boolean): pc.Mesh {
  const d = new MeshData();
  const rng = makeRng(flowers ? 91 : 17);
  // One triangle per blade: dark at the root, lighter at the tip (vertex colours), normals
  // pointing up so the blades take the same light as the lawn under them and blend into it.
  const vert = (x: number, y: number, z: number, c: RGBA) => {
    d.pos.push(x, y, z);
    d.nor.push(0, 1, 0);
    d.uv.push(0, 0);
    d.col.push(c[0], c[1], c[2], 255);
    return d.pos.length / 3 - 1;
  };
  const blades = flowers ? 18 : 26;
  for (let i = 0; i < blades; i++) {
    const a = rng.range(0, Math.PI * 2), r = Math.sqrt(rng.next()) * 0.3;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = rng.range(0.07, 0.2) * (r < 0.12 ? 1.25 : 1), w = rng.range(0.012, 0.022);
    const yaw = rng.range(0, Math.PI), lean = rng.range(0.02, 0.08), la = rng.range(0, Math.PI * 2);
    const cx = Math.cos(yaw) * w, cz = Math.sin(yaw) * w;
    const g = rng.range(0.82, 1.12) * 0.8, dry = rng.chance(0.08);
    const base: RGBA = dry ? [Math.round(70 * g), Math.round(78 * g), Math.round(34 * g), 255] : [Math.round(40 * g), Math.round(72 * g), Math.round(22 * g), 255];
    const tip: RGBA = dry ? [Math.round(118 * g), Math.round(116 * g), Math.round(58 * g), 255] : [Math.round(66 * g), Math.round(106 * g), Math.round(34 * g), 255];
    const i0 = vert(x - cx, 0, z - cz, base), i1 = vert(x + cx, 0, z + cz, base), i2 = vert(x + Math.cos(la) * lean, h, z + Math.sin(la) * lean, tip);
    d.idx.push(i0, i1, i2);
  }
  if (flowers) {
    const cols: RGBA[] = [[250, 248, 236, 255], [246, 206, 60, 255], [226, 120, 160, 255], [190, 150, 230, 255]];
    for (let i = 0; i < 3; i++) {
      const x = rng.range(-0.16, 0.16), z = rng.range(-0.16, 0.16), h = rng.range(0.14, 0.24), s = rng.range(0.028, 0.04);
      const st: RGBA = [70, 110, 44, 255];
      const a0 = vert(x - 0.005, 0, z, st), a1 = vert(x + 0.005, 0, z, st), a2 = vert(x, h, z, st);
      d.idx.push(a0, a1, a2);
      const c = cols[(i + (flowers ? 1 : 0)) % cols.length]!;
      // A small flower head: two crossed quads.
      for (const [ux, uz] of [[1, 0], [0, 1]] as const) {
        const p0 = vert(x - ux * s, h - 0.01, z - uz * s, c), p1 = vert(x + ux * s, h - 0.01, z + uz * s, c);
        const p2 = vert(x + ux * s, h + 0.02, z + uz * s, c), p3 = vert(x - ux * s, h + 0.02, z - uz * s, c);
        d.idx.push(p0, p1, p2, p0, p2, p3);
      }
    }
  }
  return meshFromData(device, d);
}

class Layer {
  readonly vb: pc.VertexBuffer;
  readonly data: Float32Array;
  readonly mi: pc.MeshInstance;
  n = 0;
  constructor(app: pc.AppBase, mat: pc.Material, mesh: pc.Mesh, readonly max: number, name: string) {
    this.data = new Float32Array(max * 16);
    this.vb = new pc.VertexBuffer(app.graphicsDevice, pc.VertexFormat.getDefaultInstancingFormat(app.graphicsDevice), max, { usage: pc.BUFFER_DYNAMIC, data: this.data });
    this.mi = new pc.MeshInstance(mesh, mat);
    this.mi.setInstancing(this.vb);
    this.mi.cull = false;
    this.mi.instancingCount = 0;
    const e = new pc.Entity(name);
    e.addComponent("render", { meshInstances: [this.mi], castShadows: false, receiveShadows: true });
    app.root.addChild(e);
  }
}

export class GrassField {
  private plain: Layer | null = null;
  private flower: Layer | null = null;
  private cx = Infinity;
  private cz = Infinity;
  private retry = 0;
  private m = new pc.Mat4();
  private q = new pc.Quat();
  private v = new pc.Vec3();
  private s = new pc.Vec3();

  /**
   * radius 0 turns it off (phones). isLawn says where blades may grow (lawn
   * ground, nothing solid); height gives the ground height.
   */
  constructor(app: pc.AppBase, mats: MatLib, private radius: number, private isLawn: (x: number, z: number) => boolean | null, private height: (x: number, z: number) => number) {
    if (radius <= 0) return;
    const mat = mats.get("blade");
    const cells = Math.ceil((Math.PI * radius * radius) / (CELL * CELL));
    this.plain = new Layer(app, mat, clumpMesh(app.graphicsDevice, false), cells, "grass-blades");
    this.flower = new Layer(app, mat, clumpMesh(app.graphicsDevice, true), Math.ceil(cells * 0.12), "grass-flowers");
  }

  /** Re-scatter round the camera when it has moved a few metres (or when forced). */
  update(camX: number, camZ: number, force = false): void {
    if (!this.plain || !this.flower) return;
    // Indoors (the interiors sit far east): no grass.
    if (camX > 1500) {
      this.plain.mi.instancingCount = this.flower.mi.instancingCount = 0;
      this.cx = Infinity;
      return;
    }
    if (this.retry > 0 && --this.retry === 0) force = true;
    if (!force && Math.hypot(camX - this.cx, camZ - this.cz) < 2.5) return;
    this.cx = camX;
    this.cz = camZ;
    const R = this.radius, P = this.plain, F = this.flower;
    P.n = F.n = 0;
    let pending = false;
    const i0 = Math.floor((camX - R) / CELL), i1 = Math.floor((camX + R) / CELL);
    const j0 = Math.floor((camZ - R) / CELL), j1 = Math.floor((camZ + R) / CELL);
    for (let i = i0; i <= i1; i++)
      for (let j = j0; j <= j1; j++) {
        const x = (i + hash(i, j, 2)) * CELL, z = (j + hash(i, j, 3)) * CELL;
        const d = Math.hypot(x - camX, z - camZ);
        if (d > R) continue;
        // Dense near you, thinner further out (where single blades cannot be told apart anyway).
        if (hash(i, j, 1) > (d < 9 ? 0.92 : d < 16 ? 0.62 : 0.4)) continue;
        const lawn = this.isLawn(x, z);
        if (lawn === null) {
          pending = true;
          continue;
        }
        if (!lawn) continue;
        const flower = hash(i, j, 4) < 0.07;
        const L = flower ? F : P;
        if (L.n >= L.max) continue;
        // Shrink away towards the patch edge (no hard line where the blades stop).
        const edge = Math.min(1, (R - d) / 7);
        const sc = (0.75 + hash(i, j, 5) * 0.6) * edge * edge * (3 - 2 * edge);
        this.v.set(x, this.height(x, z), z);
        this.q.setFromEulerAngles(0, hash(i, j, 6) * 360, 0);
        this.s.set(sc, sc * (0.8 + hash(i, j, 7) * 0.5), sc);
        this.m.setTRS(this.v, this.q, this.s);
        L.data.set(this.m.data, L.n * 16);
        L.n++;
      }
    for (const L of [P, F]) {
      L.vb.setData(L.data);
      L.mi.instancingCount = L.n;
    }
    // Some ground was not known yet (the grid bakes as you go): try again soon.
    if (pending) this.retry = 30;
  }
}
