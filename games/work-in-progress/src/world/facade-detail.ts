/**
 * Buildings up close: the small things a facade has that you only notice
 * near it. String courses at every floor, downpipes with brackets and shoes,
 * split air-conditioning units and their drip pipes on the hostels and shops,
 * low vents, a cornice band on the flat roofs, and at every entrance two wall
 * lamps (lit at night) and a brass name plate.
 *
 * LOD: everything is merged per 64 m chunk (one mesh per material per chunk)
 * and only drawn within about 45 m of the camera, dithering in and out
 * between 38 and 50 m so nothing pops. Far away the buildings are exactly
 * as before.
 */
import * as pc from "playcanvas";
import { Builder, MeshData, type RGBA } from "../gfx/builder.ts";
import type { MatLib } from "../gfx/materials.ts";
import { meshFromData } from "../gfx/propmesh.ts";
import { makeRng, type Rng } from "../sim/rng.ts";
import { buildingHeight } from "./buildings.ts";
import type { DoorSpec } from "./door-plan.ts";
import type { Building } from "./layout.ts";

const CHUNK = 64;
const NEAR = 38, FAR = 50;

const PIPE: RGBA = [86, 90, 94, 255];
const AC: RGBA = [232, 232, 226, 255];
const GRILLE: RGBA = [70, 72, 74, 255];
const BAND: RGBA = [236, 228, 210, 255];

/** Floor height per style (as buildings.ts builds them). */
const FLOOR_H: Partial<Record<Building["style"], number>> = { hostel: 3.2, shophouse: 3.6, medicine: 3.8, library: 4.8, arcade: 4.4, gothic: 4.4, house: 3, deco: 4.2 };

/** Local builder for a building face: x along the face, +z out of it, y up. */
function face(b: Builder, B: Building, which: "front" | "back" | "left" | "right"): Builder {
  const { w, d } = B;
  const [lx, lz, lr] = which === "front" ? [0, d / 2, 0] : which === "back" ? [0, -d / 2, Math.PI] : which === "right" ? [w / 2, 0, Math.PI / 2] : [-w / 2, 0, -Math.PI / 2];
  const c = Math.cos(B.rot), s = Math.sin(B.rot);
  return b.at(B.x + lx * c + lz * s, B.z - lx * s + lz * c, B.rot + lr);
}

function downpipe(b: Builder, x: number, H: number): void {
  b.tint(PIPE).cylinder("metal", x, 0.05, 0.11, 0.055, 0.055, H - 0.25, 8);
  // Hopper head at the top, a shoe at the foot, brackets every 1.6 m.
  b.box("metal", x, H - 0.45, 0.13, 0.24, 0.26, 0.2);
  b.box("metal", x, 0, 0.18, 0.12, 0.12, 0.2);
  for (let y = 1.2; y < H - 0.6; y += 1.6) b.box("metal", x, y, 0.06, 0.16, 0.05, 0.12);
}

function acUnit(b: Builder, x: number, y: number, rng: Rng): void {
  b.tint(AC).box("trim", x, y, 0.2, 0.84, 0.54, 0.3);
  // The fan grille (a dark disc of slats) and side vents.
  b.tint(GRILLE);
  for (let k = -3; k <= 3; k++) b.box("trim", x - 0.12, y + 0.27 + k * 0.05, 0.36, 0.38 - Math.abs(k) * 0.06, 0.02, 0.01);
  b.box("trim", x + 0.27, y + 0.08, 0.36, 0.16, 0.36, 0.01);
  // Brackets and the drip pipe running down.
  b.tint(PIPE).box("metal", x - 0.3, y - 0.06, 0.18, 0.04, 0.06, 0.34);
  b.box("metal", x + 0.3, y - 0.06, 0.18, 0.04, 0.06, 0.34);
  if (rng.chance(0.7)) b.box("metal", x + 0.36, 0, 0.05, 0.025, y, 0.025);
}

function vent(b: Builder, x: number, y: number): void {
  b.tint([200, 196, 186, 255]).box("trim", x, y, 0.03, 0.34, 0.24, 0.04);
  b.tint(GRILLE);
  for (let k = 0; k < 4; k++) b.box("trim", x, y + 0.04 + k * 0.05, 0.055, 0.28, 0.018, 0.01);
}

/** Floor-line bands round a face (and a cornice band at the top on flat roofs). */
function bands(b: Builder, width: number, FH: number, floors: number, cornice: boolean): void {
  b.tint(BAND);
  for (let f = 1; f < floors; f++) b.box("plaster", 0, f * FH - 0.08, 0.04, width + 0.04, 0.16, 0.09, 2);
  if (cornice) {
    const H = FH * floors;
    b.box("plaster", 0, H - 0.5, 0.06, width + 0.1, 0.22, 0.14, 2);
    b.box("plaster", 0, H - 0.3, 0.1, width + 0.2, 0.18, 0.22, 2);
  }
}

/** The near-detail of one building into a chunk's builder. */
export function buildingDetail(b: Builder, B: Building): void {
  const FH = FLOOR_H[B.style];
  if (!FH || B.floors < 1) return;
  const rng = makeRng(B.seed * 31 + 7);
  const H = Math.min(buildingHeight(B), FH * B.floors);
  const flat = B.style === "shophouse" || B.style === "library" || B.style === "arcade" || B.style === "deco";
  for (const side of ["left", "right", "back"] as const) {
    const fb = face(b, B, side);
    const width = side === "back" ? B.w : B.d;
    if (B.style !== "gothic") bands(fb, width, FH, B.floors, flat);
    // Downpipes near both corners of the side faces.
    if (side !== "back") for (const sx of [-1, 1]) downpipe(fb, sx * (width / 2 - 0.35), H);
    // Air conditioners on the hostels and shops (one or two per floor, on the sides).
    if (B.style === "hostel" || B.style === "shophouse" || B.style === "medicine") {
      for (let f = 0; f < B.floors; f++) {
        if (!rng.chance(side === "back" ? 0.5 : 0.75)) continue;
        const x = rng.range(-width / 2 + 1.4, width / 2 - 1.4);
        acUnit(fb, x, f * FH + (f === 0 ? 2.1 : 0.9), rng);
      }
    }
    // Low vents.
    for (let k = 0; k < Math.floor(width / 7); k++) vent(fb, -width / 2 + 3 + k * 7 + rng.range(-1, 1), 0.35);
  }
}

/** Two wall lamps (lit at night) and a brass name plate by an entrance door. */
export function entranceDetail(b: Builder, d: DoorSpec): void {
  b.at(d.x, d.z, d.yaw, d.y);
  for (const sx of [-1, 1]) {
    const x = sx * (d.w / 2 + 0.5);
    b.tint([40, 38, 36, 255]).box("metal", x, Math.min(d.h, 2.6) + 0.1, 0.06, 0.12, 0.2, 0.14);
    b.box("metal", x, Math.min(d.h, 2.6) + 0.25, 0.14, 0.04, 0.04, 0.16);
    // The lantern: a glowing box under a little cap.
    b.tint([255, 236, 190, 255]).box("lamp", x, Math.min(d.h, 2.6) + 0.3, 0.24, 0.16, 0.24, 0.16);
    b.tint([40, 38, 36, 255]).box("metal", x, Math.min(d.h, 2.6) + 0.54, 0.24, 0.22, 0.04, 0.22);
  }
  b.tint([190, 150, 70, 255]).box("metal", d.w / 2 + 0.5, 1.25, 0.04, 0.34, 0.24, 0.02);
}

interface ChunkLive { e: pc.Entity; mis: pc.MeshInstance[]; cx: number; cz: number; r: number; fade: number }

export class FacadeDetail {
  private chunks: ChunkLive[] = [];

  constructor(app: pc.AppBase, mats: MatLib, buildings: Building[], entrances: DoorSpec[]) {
    // Dithered copies of the materials the details use (fade in and out without sorting or popping).
    const dithered = new Map<string, pc.StandardMaterial>();
    const matFor = (name: string) => {
      let m = dithered.get(name);
      if (!m) {
        const base = mats.get(name);
        m = base.clone();
        m.opacityDither = pc.DITHER_BAYER8;
        m.opacity = 1;
        m.update();
        dithered.set(name, m);
        const night = mats.night.find((n) => n.mat === base);
        if (night) mats.night.push({ mat: m, day: night.day, night: night.night });
      }
      return m;
    };
    const groups = new Map<string, { builds: ((b: Builder) => void)[]; xs: number[]; zs: number[] }>();
    const add = (x: number, z: number, f: (b: Builder) => void) => {
      const k = `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
      let g = groups.get(k);
      if (!g) groups.set(k, (g = { builds: [], xs: [], zs: [] }));
      g.builds.push(f);
      g.xs.push(x);
      g.zs.push(z);
    };
    for (const B of buildings) add(B.x, B.z, (b) => buildingDetail(b, B));
    for (const d of entrances) if (d.place === "world") add(d.x, d.z, (b) => entranceDetail(b, d));
    for (const g of groups.values()) {
      const byMat = new Map<string, MeshData>();
      const b = new Builder((mat) => {
        let d = byMat.get(mat);
        if (!d) byMat.set(mat, (d = new MeshData()));
        return d;
      });
      for (const f of g.builds) f(b);
      const mis: pc.MeshInstance[] = [];
      for (const [mat, d] of byMat) if (d.idx.length) mis.push(new pc.MeshInstance(meshFromData(app.graphicsDevice, d), matFor(mat)));
      if (!mis.length) continue;
      const e = new pc.Entity("facade-detail");
      e.addComponent("render", { meshInstances: mis, castShadows: false, receiveShadows: true });
      app.root.addChild(e);
      const cx = g.xs.reduce((a, v) => a + v, 0) / g.xs.length, cz = g.zs.reduce((a, v) => a + v, 0) / g.zs.length;
      // The chunk's reach: its farthest building centre plus a building's half size.
      const r = Math.max(...g.xs.map((x, i) => Math.hypot(x - cx, g.zs[i]! - cz))) + 20;
      e.enabled = false;
      this.chunks.push({ e, mis, cx, cz, r, fade: 0 });
    }
  }

  /** Per frame: show and dither the chunks near the camera. */
  update(camX: number, camZ: number): void {
    for (const c of this.chunks) {
      const d = Math.max(0, Math.hypot(c.cx - camX, c.cz - camZ) - c.r);
      const want = d <= NEAR ? 1 : d >= FAR ? 0 : 1 - (d - NEAR) / (FAR - NEAR);
      if (want === c.fade && (want > 0) === c.e.enabled) continue;
      c.fade = want;
      c.e.enabled = want > 0.01;
      for (const mi of c.mis) mi.setParameter("material_opacity", want);
    }
  }
}
