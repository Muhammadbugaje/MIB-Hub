/**
 * Trees and bushes: a few hand-shaped models (neem, mango, flame tree, royal
 * palm, far-away tree line, shrub) drawn many times with GPU instancing, so
 * hundreds of trees cost a handful of draw calls. Crowns sway in the wind
 * (vertex shader in gfx/materials.ts).
 */
import * as pc from "playcanvas";
import { Builder, MeshData, type RGBA, type V3 } from "../gfx/builder.ts";
import type { MatLib } from "../gfx/materials.ts";
import type { CollisionWorld } from "../sim/collide.ts";
import { makeRng } from "../sim/rng.ts";
import { bushes, trees, type TreeKind } from "./layout.ts";
import { surfaceHeight } from "./surface.ts";

type Parts = Map<string, MeshData>;

function model(build: (b: Builder) => void): Parts {
  const parts: Parts = new Map();
  const b = new Builder((mat) => {
    let m = parts.get(mat);
    if (!m) parts.set(mat, (m = new MeshData()));
    return m;
  });
  b.at(0, 0);
  build(b);
  return parts;
}

const hex = (h: string): RGBA => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];

function crown(b: Builder, seed: number, centre: V3, radius: number, count: number, top: RGBA, bottom: RGBA, flat = 0.75, extra?: { color: RGBA; share: number }) {
  const rng = makeRng(seed);
  for (let i = 0; i < count; i++) {
    const a = rng.range(0, Math.PI * 2), r = i === 0 ? 0 : rng.range(radius * 0.35, radius * 0.75);
    const c: V3 = [centre[0] + Math.cos(a) * r, centre[1] + rng.range(-radius * 0.25, radius * 0.3) - (r / radius) * radius * 0.2, centre[2] + Math.sin(a) * r];
    const useExtra = extra && rng.chance(extra.share);
    const t = useExtra ? extra.color : top;
    const bt: RGBA = useExtra ? [extra.color[0] * 0.55, extra.color[1] * 0.5, extra.color[2] * 0.5, 255] : bottom;
    b.blob("leaves", c, (i === 0 ? radius * 0.7 : rng.range(radius * 0.4, radius * 0.6)), seed + i * 1.37, t, bt, flat, 14, 9, 0.16);
  }
}

function branches(b: Builder, seed: number, trunkTop: number, spread: number, n: number, r: number) {
  const rng = makeRng(seed);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const end: V3 = [Math.cos(a) * spread, trunkTop + rng.range(1.2, 2.4), Math.sin(a) * spread];
    b.tint(hex("#8a7a68")).limb("bark", [0, trunkTop - 0.6, 0], end, r, r * 0.4, 6);
  }
}

/** Two shape variants per kind so neighbouring trees differ. */
function makeModel(kind: TreeKind, v: number): Parts {
  return model((b) => {
    const s = v * 101 + 7;
    switch (kind) {
      case "neem": {
        b.tint(hex("#9a8a76")).cylinder("bark", 0, 0, 0, 0.32, 0.22, 3.6, 8, false);
        branches(b, s, 3.6, 1.8, 4, 0.16);
        crown(b, s, [0, 5.6, 0], 3.4, 9, v ? hex("#7fb04a") : hex("#86b84f"), hex("#2f5a28"), 0.62);
        break;
      }
      case "mango": {
        b.tint(hex("#6e5a48")).cylinder("bark", 0, 0, 0, 0.42, 0.3, 2.4, 8, false);
        branches(b, s, 2.4, 1.6, 5, 0.22);
        crown(b, s, [0, 4.6, 0], 3.9, 10, v ? hex("#4f8f3a") : hex("#5a9a40"), hex("#1e4220"), 0.85);
        break;
      }
      case "flame": {
        b.tint(hex("#8c7b6a")).cylinder("bark", 0, 0, 0, 0.36, 0.26, 3.0, 8, false);
        branches(b, s, 3.0, 3.2, 6, 0.18);
        crown(b, s, [0, 5.0, 0], 5.2, 11, hex("#79ad4a"), hex("#335c2a"), 0.42, { color: v ? hex("#e8452a") : hex("#f05a28"), share: 0.55 });
        break;
      }
      case "palm": {
        // Royal palm: pale smooth trunk, green crownshaft, drooping fronds.
        const H = 13 + v;
        b.tint(hex("#c8c2b6")).cylinder("bark", 0, 0, 0, 0.42, 0.3, H * 0.45, 10, false);
        b.tint(hex("#cfc9bd")).cylinder("bark", 0, H * 0.45, 0, 0.3, 0.28, H * 0.42, 10, false);
        b.tint(hex("#6f9a48")).cylinder("bark", 0, H * 0.87, 0, 0.32, 0.26, H * 0.1, 10, false);
        const rng = makeRng(s);
        const top = H * 0.97;
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2 + rng.range(-0.15, 0.15);
          const L = rng.range(3.6, 4.6), up = rng.range(0.2, 0.9);
          const seg = 7;
          const pts: V3[] = [];
          for (let k = 0; k <= seg; k++) {
            const t = k / seg;
            pts.push([Math.cos(a) * L * t, top + up * L * t - 2.2 * t * t * L * 0.5, Math.sin(a) * L * t]);
          }
          for (let k = 0; k < seg; k++) {
            const p = pts[k]!, q = pts[k + 1]!;
            const w0 = 0.7 * Math.sin(Math.PI * Math.min(1, (k / seg) * 1.15 + 0.08)), w1 = 0.7 * Math.sin(Math.PI * Math.min(1, ((k + 1) / seg) * 1.15 + 0.08));
            const sx = -Math.sin(a), sz = Math.cos(a);
            const col: RGBA = k < 2 ? hex("#5a8a3a") : hex("#6fa846");
            b.tint(col).poly("palm", [[p[0] - sx * w0, p[1] - 0.12, p[2] - sz * w0], [q[0] - sx * w1, q[1] - 0.12, q[2] - sz * w1], [q[0], q[1], q[2]], [p[0], p[1], p[2]]], [[0, k], [0, k + 1], [0.5, k + 1], [0.5, k]]);
            b.poly("palm", [[p[0], p[1], p[2]], [q[0], q[1], q[2]], [q[0] + sx * w1, q[1] - 0.12, q[2] + sz * w1], [p[0] + sx * w0, p[1] - 0.12, p[2] + sz * w0]], [[0.5, k], [0.5, k + 1], [1, k + 1], [1, k]]);
          }
        }
        break;
      }
      case "far": {
        b.tint(hex("#5a4a3a")).cylinder("far", 0, 0, 0, 0.3, 0.2, 2.5, 5, false);
        const rng = makeRng(s);
        for (let i = 0; i < 3; i++)
          b.blob("far", [rng.range(-1.2, 1.2), 4.5 + rng.range(-0.5, 0.8), rng.range(-1.2, 1.2)], rng.range(2.2, 3.0), s + i, hex("#5e8a42"), hex("#28432a"), 0.8, 7, 5, 0.15);
        break;
      }
    }
  });
}

function bushModel(v: number): Parts {
  return model((b) => {
    const rng = makeRng(900 + v);
    for (let i = 0; i < 4; i++)
      b.blob("bush", [rng.range(-0.35, 0.35), 0.45 + rng.range(-0.05, 0.15), rng.range(-0.35, 0.35)], rng.range(0.45, 0.65), 33 + v * 7 + i, v === 2 ? hex("#5f9a45") : hex("#6ea84a"), hex("#24462a"), 0.85, 8, 5, 0.2);
    if (v !== 0) for (let i = 0; i < 7; i++) b.blob("bush", [rng.range(-0.5, 0.5), 0.75 + rng.range(0, 0.2), rng.range(-0.5, 0.5)], 0.14, i, v === 2 ? hex("#e8607a") : hex("#f4d03a"), v === 2 ? hex("#a83050") : hex("#c89a20"), 1, 5, 3, 0.1);
  });
}

function toMesh(device: pc.GraphicsDevice, d: MeshData): pc.Mesh {
  const mesh = new pc.Mesh(device);
  mesh.setPositions(new Float32Array(d.pos));
  mesh.setNormals(new Float32Array(d.nor));
  mesh.setUvs(0, new Float32Array(d.uv));
  mesh.setColors32(new Uint8Array(d.col));
  mesh.setIndices(d.vertexCount > 65535 ? new Uint32Array(d.idx) : new Uint16Array(d.idx));
  mesh.update(pc.PRIMITIVE_TRIANGLES);
  return mesh;
}

/** Make one instanced render entity per (model part) for a list of transforms. */
function instance(app: pc.AppBase, mats: MatLib, parent: pc.Entity, parts: Parts, xforms: pc.Mat4[], shadows: boolean, name: string): void {
  if (!xforms.length) return;
  const device = app.graphicsDevice;
  const data = new Float32Array(xforms.length * 16);
  xforms.forEach((m, i) => data.set(m.data, i * 16));
  for (const [mat, d] of parts) {
    const vb = new pc.VertexBuffer(device, pc.VertexFormat.getDefaultInstancingFormat(device), xforms.length, { data: data.slice() });
    const mi = new pc.MeshInstance(toMesh(device, d), mats.get(mat));
    mi.setInstancing(vb);
    const e = new pc.Entity(`${name}-${mat}`);
    e.addComponent("render", { meshInstances: [mi], castShadows: shadows, receiveShadows: true });
    // Instances spread over the whole map: give the bounds the full extent so culling never hides them.
    e.render!.customAabb = new pc.BoundingBox(new pc.Vec3(0, 10, -60), new pc.Vec3(520, 40, 520));
    parent.addChild(e);
  }
}

export interface TreeInfo { x: number; z: number; crownY: number; crownR: number; kind: TreeKind }

export function buildNature(app: pc.AppBase, mats: MatLib, parent: pc.Entity, col: CollisionWorld, lowQuality: boolean): TreeInfo[] {
  const kinds: TreeKind[] = ["neem", "mango", "flame", "palm", "far"];
  const info: TreeInfo[] = [];
  for (const kind of kinds) {
    for (const v of [0, 1]) {
      const spots = trees.filter((t, i) => t.kind === kind && i % 2 === v);
      const xf = spots.map((t) => new pc.Mat4().setTRS(new pc.Vec3(t.x, surfaceHeight(t.x, t.z), t.z), new pc.Quat().setFromEulerAngles(0, (t.rot * 180) / Math.PI, 0), new pc.Vec3(t.scale, t.scale, t.scale)));
      instance(app, mats, parent, makeModel(kind, v), xf, kind !== "far" && !(lowQuality && kind === "palm"), `tree-${kind}${v}`);
      for (const t of spots) {
        if (kind !== "far") col.add({ kind: "circle", x: t.x, z: t.z, r: (kind === "palm" ? 0.4 : 0.45) * t.scale });
        const crownY = { neem: 5.6, mango: 4.6, flame: 5.0, palm: 12.5, far: 4.5 }[kind] * t.scale;
        const crownR = { neem: 3.2, mango: 3.6, flame: 5, palm: 3.5, far: 2.5 }[kind] * t.scale;
        info.push({ x: t.x, z: t.z, crownY, crownR, kind });
      }
    }
  }
  for (const v of [0, 1, 2]) {
    const spots = bushes.filter((_, i) => i % 3 === v);
    const xf = spots.map((s) => new pc.Mat4().setTRS(new pc.Vec3(s.x, surfaceHeight(s.x, s.z), s.z), new pc.Quat().setFromEulerAngles(0, (s.x * 37) % 360, 0), new pc.Vec3(s.s, s.s, s.s)));
    instance(app, mats, parent, bushModel(v), xf, !lowQuality, `bush${v}`);
  }
  return info;
}
