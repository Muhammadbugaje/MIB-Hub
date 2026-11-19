/**
 * THE COIL (the Engineering Garden's, the one the Maker has kept alive for
 * forty years). A hero asset, built to the story bible:
 *
 *  - a round stone plinth with six bronze plaques (one per coil site, M20)
 *    and, round its rim, ten seal sockets, empty until the faculties' seals
 *    are won (setSeals);
 *  - a flat spiral primary winding of copper strip on insulator posts;
 *  - a tall secondary coil: a dark former with fine copper banding;
 *  - a polished toroid top-load and a crown ring that glows;
 *  - a brass spark gap and its fittings, a strike rod on its own insulator
 *    and a copper ground ring set into the gravel.
 *
 * States (setState), driven by the story: "dormant" (cold metal, the crown
 * barely glowing), "humming" (a shimmer, small corona sparks on the toroid,
 * the hum), and "lit" (procedural lightning: branching streamers from the
 * toroid into the air, to the strike rod and down to the ground ring,
 * regenerated every few frames; a flickering blue-white light over the
 * garden; a crack and a small camera shake when you are near; the cats turn
 * to look).
 *
 * The arcs are camera-facing ribbons in one dynamic mesh (one draw call),
 * additive, rebuilt every third frame; one light, flickered. Phones get
 * fewer streamers.
 */
import * as pc from "playcanvas";
import { type Builder, type RGBA, type V3 } from "../gfx/builder.ts";
import type { MatLib } from "../gfx/materials.ts";
import { makeProp } from "../gfx/propmesh.ts";
import { makeRng, type Rng } from "../sim/rng.ts";

export type CoilState = "dormant" | "humming" | "lit";

const hex = (h: string): RGBA => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const STONE = hex("#b9b2a2"), STONE_DARK = hex("#8f887a"), COPPER = hex("#c27a3e"), COPPER_DARK = hex("#8e5428"), BRASS = hex("#c9a14a"), BRONZE = hex("#8a6a3a");
const FORMER = hex("#2e2a26"), PORCELAIN = hex("#ece8de"), IRON = hex("#3a3f44"), CHROME = hex("#d8dde2");

/** Heights (metres above the plinth's foot). */
export const COIL = { plinthH: 0.75, plinthR: 1.05, primaryY: 0.98, secondaryY0: 0.95, secondaryY1: 3.05, toroidY: 3.25, toroidR: 0.62, toroidTube: 0.17, rodX: 1.7, rodZ: 0.9, rodTop: 2.6, groundR: 2.25 };

/** The whole coil is built at this scale (taller than a person by half again; campus.ts's colliders match). */
export const COIL_SCALE = 1.3;

/** The ten seal sockets' angles round the plinth rim (radians). */
export const SOCKETS = Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2 + Math.PI / 10);

function buildBody(b: Builder): void {
  const C = COIL;
  // Plinth: a stepped stone drum, a moulded cap.
  b.tint(STONE_DARK).cylinder("stone", 0, 0, 0, C.plinthR + 0.18, C.plinthR + 0.14, 0.14, 24);
  b.tint(STONE).cylinder("stone", 0, 0.14, 0, C.plinthR, C.plinthR - 0.04, C.plinthH - 0.26, 24, false);
  b.tint(STONE).cylinder("stone", 0, C.plinthH - 0.12, 0, C.plinthR + 0.08, C.plinthR + 0.1, 0.12, 24);
  // Six bronze plaques round the drum (one for each coil site).
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const r = C.plinthR - 0.01;
    b.at(Math.sin(a) * r, Math.cos(a) * r, a, 0).tint(BRONZE).box("metal", 0, 0.3, 0, 0.36, 0.22, 0.025);
    b.at(Math.sin(a) * (r + 0.015), Math.cos(a) * (r + 0.015), a, 0).tint(hex("#5e4826")).box("metal", 0, 0.34, 0, 0.26, 0.02, 0.01);
    b.at(Math.sin(a) * (r + 0.015), Math.cos(a) * (r + 0.015), a, 0).box("metal", 0, 0.39, 0, 0.2, 0.015, 0.01);
    b.at(0, 0);
  }
  // Ten empty sockets in the cap's rim (the seals sit in them when won).
  for (const a of SOCKETS) {
    const r = C.plinthR - 0.06;
    b.tint(hex("#4a463e")).cylinder("stone", Math.sin(a) * r, C.plinthH - 0.005, Math.cos(a) * r, 0.065, 0.065, 0.012, 14);
  }
  // Insulator posts carrying the primary (porcelain stacks).
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.26;
    const x = Math.sin(a) * 0.72, z = Math.cos(a) * 0.72;
    for (let s = 0; s < 3; s++) b.tint(PORCELAIN).cylinder("trim", x, C.plinthH + s * 0.07, z, 0.05, 0.035, 0.06, 10);
  }
  // The flat spiral primary: copper strip winding outwards.
  const turns = 4.5, steps = 90;
  let prev: V3 | null = null;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = t * turns * Math.PI * 2;
    const r = 0.42 + t * 0.32;
    const p: V3 = [Math.sin(a) * r, C.primaryY, Math.cos(a) * r];
    if (prev) b.tint(i % 2 ? COPPER : COPPER_DARK).limb("metal", prev, p, 0.016, 0.016, 5);
    prev = p;
  }
  // The secondary: a dark former, fine copper banding, end caps.
  b.tint(FORMER).cylinder("trim", 0, C.secondaryY0, 0, 0.21, 0.21, C.secondaryY1 - C.secondaryY0, 18);
  const bands = 52;
  for (let k = 0; k < bands; k++) {
    const y = C.secondaryY0 + 0.08 + (k / bands) * (C.secondaryY1 - C.secondaryY0 - 0.16);
    b.tint(k % 2 ? COPPER : hex("#d08a4a")).cylinder("metal", 0, y, 0, 0.222, 0.222, 0.022, 18, false);
  }
  b.tint(BRASS).cylinder("metal", 0, C.secondaryY0 - 0.04, 0, 0.27, 0.26, 0.06, 18);
  b.tint(BRASS).cylinder("metal", 0, C.secondaryY1, 0, 0.25, 0.24, 0.06, 18);
  // The top-load: a polished toroid on a short neck.
  b.tint(CHROME).cylinder("metal", 0, C.secondaryY1 + 0.06, 0, 0.08, 0.08, C.toroidY - C.secondaryY1 - 0.06, 10);
  const seg = 28;
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    b.tint(CHROME).limb("metal", [Math.sin(a0) * C.toroidR, C.toroidY, Math.cos(a0) * C.toroidR], [Math.sin(a1) * C.toroidR, C.toroidY, Math.cos(a1) * C.toroidR], C.toroidTube, C.toroidTube, 12);
  }
  b.tint(CHROME).cylinder("metal", 0, C.toroidY - 0.05, 0, C.toroidR, C.toroidR, 0.1, 24);
  b.tint(CHROME).dome("metal", 0, C.toroidY + 0.05, 0, C.toroidR * 0.55, 18, 4, false, 0.35);
  // The brass spark gap on its bakelite box, by the plinth (two balls on threaded rods).
  const gx = -1.05, gz = 0.95;
  b.tint(hex("#3a2a1e")).box("wood", gx, 0, gz, 0.5, 0.42, 0.34);
  for (const sx of [-1, 1]) {
    b.tint(PORCELAIN).cylinder("trim", gx + sx * 0.14, 0.42, gz, 0.04, 0.03, 0.14, 8);
    b.tint(BRASS).limb("metal", [gx + sx * 0.14, 0.56, gz], [gx + sx * 0.05, 0.58, gz], 0.012, 0.012, 6);
    b.tint(BRASS).dome("metal", gx + sx * 0.04, 0.545, gz, 0.035, 10, 4, true);
  }
  b.tint(COPPER).limb("metal", [gx + 0.14, 0.5, gz - 0.1], [0, C.primaryY, 0.75], 0.012, 0.012, 5);
  // The strike rod on its insulator, and the copper ground ring set in the gravel.
  b.tint(PORCELAIN).cylinder("trim", C.rodX, 0, C.rodZ, 0.09, 0.07, 0.5, 10);
  for (let s = 0; s < 4; s++) b.tint(PORCELAIN).cylinder("trim", C.rodX, 0.5 + s * 0.09, C.rodZ, 0.075, 0.05, 0.07, 10);
  b.tint(IRON).cylinder("metal", C.rodX, 0.86, C.rodZ, 0.022, 0.018, C.rodTop - 0.86, 8);
  b.tint(BRASS).dome("metal", C.rodX, C.rodTop, C.rodZ, 0.07, 10, 4, true);
  for (let i = 0; i < 40; i++) {
    const a0 = (i / 40) * Math.PI * 2, a1 = ((i + 1) / 40) * Math.PI * 2;
    b.tint(COPPER_DARK).limb("metal", [Math.sin(a0) * C.groundR, 0.03, Math.cos(a0) * C.groundR], [Math.sin(a1) * C.groundR, 0.03, Math.cos(a1) * C.groundR], 0.025, 0.025, 5);
  }
}

/** A branching streamer: a jagged polyline from a towards b, with side branches. */
export function streamer(rng: Rng, a: V3, b: V3, out: V3[][], depth = 0, jag = 0.22): void {
  const n = 7 + Math.floor(rng.next() * 5);
  const pts: V3[] = [a];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const j = jag * len * Math.sin(t * Math.PI);
    pts.push([a[0] + (b[0] - a[0]) * t + rng.range(-j, j) * 0.5, a[1] + (b[1] - a[1]) * t + rng.range(-j, j) * 0.5, a[2] + (b[2] - a[2]) * t + rng.range(-j, j) * 0.5]);
    if (depth < 2 && rng.chance(0.28 - depth * 0.1)) {
      const p = pts[pts.length - 1]!;
      const bl = len * rng.range(0.15, 0.35);
      streamer(rng, p, [p[0] + rng.range(-bl, bl), p[1] + rng.range(-bl * 0.6, bl * 0.4), p[2] + rng.range(-bl, bl)], out, depth + 1, jag * 1.2);
    }
  }
  pts.push(b);
  out.push(pts);
}

export class TeslaCoil {
  readonly root: pc.Entity;
  state: CoilState = "dormant";
  private crown: pc.Entity;
  private crownMat: pc.StandardMaterial;
  private seals: pc.Entity[] = [];
  private arcMesh: pc.Mesh;
  private arcMi: pc.MeshInstance;
  private arcMat: pc.StandardMaterial;
  private light: pc.Entity;
  private rng = makeRng(606);
  private t = 0;
  private regen = 0;
  private paths: V3[][] = [];
  private widths: number[] = [];
  /** Seconds left of a crack (brighter arcs, light spike). */
  private crack = 0;
  private nextCrack = 2;
  /** Called on each crack (sound, camera shake); distance to the camera is passed. */
  onCrack: ((dist: number) => void) | null = null;
  /** Cats that turn to look at the arcs. */
  cats: pc.Entity | null = null;
  private catBase: number[] = [];

  constructor(app: pc.AppBase, mats: MatLib, readonly x: number, readonly z: number, readonly y: number, private low = false) {
    this.root = new pc.Entity("tesla-coil");
    this.root.setPosition(x, y, z);
    this.root.setLocalScale(COIL_SCALE, COIL_SCALE, COIL_SCALE);
    app.root.addChild(this.root);
    this.root.addChild(makeProp(app, mats, "coil-body", buildBody));
    // The crown ring: a thin glowing band round the toroid.
    const crownMat = new pc.StandardMaterial();
    crownMat.diffuse = new pc.Color(0.1, 0.2, 0.2);
    crownMat.emissive = new pc.Color(0.5, 1, 0.92);
    crownMat.emissiveIntensity = 0.2;
    crownMat.update();
    this.crownMat = crownMat;
    this.crown = makeProp(app, mats, "coil-crown", (b) => {
      const seg = 40, R = COIL.toroidR + COIL.toroidTube + 0.02;
      for (let i = 0; i < seg; i++) {
        const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
        b.tint([255, 255, 255, 255]).limb("glow", [Math.sin(a0) * R, COIL.toroidY, Math.cos(a0) * R], [Math.sin(a1) * R, COIL.toroidY, Math.cos(a1) * R], 0.018, 0.018, 6);
      }
    }, { override: { glow: crownMat }, shadows: false });
    this.root.addChild(this.crown);
    // The seals (hidden until won): brass discs with a raised boss.
    for (const a of SOCKETS) {
      const r = COIL.plinthR - 0.06;
      const s = makeProp(app, mats, "seal", (b) => {
        b.tint(BRASS).cylinder("metal", 0, 0, 0, 0.06, 0.06, 0.025, 16);
        b.tint(hex("#e0bc66")).cylinder("metal", 0, 0.025, 0, 0.035, 0.03, 0.012, 12);
      });
      s.setLocalPosition(Math.sin(a) * r, COIL.plinthH, Math.cos(a) * r);
      s.enabled = false;
      this.root.addChild(s);
      this.seals.push(s);
    }
    // The arcs: one dynamic additive mesh.
    const arcMat = new pc.StandardMaterial();
    arcMat.useLighting = false;
    arcMat.diffuse = new pc.Color(0, 0, 0);
    arcMat.emissive = new pc.Color(0.75, 0.88, 1);
    arcMat.emissiveIntensity = 3;
    arcMat.emissiveVertexColor = true;
    arcMat.blendType = pc.BLEND_ADDITIVE;
    arcMat.depthWrite = false;
    arcMat.cull = pc.CULLFACE_NONE;
    arcMat.update();
    this.arcMat = arcMat;
    this.arcMesh = new pc.Mesh(app.graphicsDevice);
    this.arcMesh.setPositions([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    this.arcMesh.setColors32([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    this.arcMesh.setIndices([0, 1, 2]);
    this.arcMesh.update(pc.PRIMITIVE_TRIANGLES, false);
    this.arcMi = new pc.MeshInstance(this.arcMesh, arcMat);
    this.arcMi.cull = false;
    const arcs = new pc.Entity("coil-arcs");
    arcs.addComponent("render", { meshInstances: [this.arcMi], castShadows: false, receiveShadows: false });
    app.root.addChild(arcs);
    this.arcs = arcs;
    // The garden light (blue-white, flickered).
    this.light = new pc.Entity("coil-light");
    this.light.addComponent("light", { type: "omni", color: new pc.Color(0.62, 0.8, 1), range: 14, intensity: 0, castShadows: false, falloffMode: pc.LIGHTFALLOFF_INVERSESQUARED });
    this.light.setPosition(x, y + COIL.toroidY * COIL_SCALE + 0.5, z);
    app.root.addChild(this.light);
  }
  private arcs: pc.Entity;

  setState(s: CoilState): void {
    this.state = s;
  }

  /** How many of the ten seals are in their sockets (they fill in order). */
  setSeals(n: number): void {
    this.seals.forEach((s, i) => (s.enabled = i < n));
  }

  /** Per frame. cam: the camera position (for ribbons facing it and for the crack). */
  update(dt: number, cam: pc.Vec3): void {
    this.t += dt;
    const lit = this.state === "lit", hum = this.state === "humming";
    // The crown: a faint breath when dormant, a shimmer when humming, bright when lit.
    const shimmer = 0.5 + 0.5 * Math.sin(this.t * 9) * Math.sin(this.t * 3.7);
    this.crownMat.emissiveIntensity = lit ? 2.2 + shimmer * 0.8 : hum ? 0.7 + shimmer * 0.5 : 0.12 + 0.06 * Math.sin(this.t * 0.8);
    this.crownMat.update();
    // Cracks: every couple of seconds when lit.
    if (lit) {
      this.nextCrack -= dt;
      if (this.nextCrack <= 0) {
        this.nextCrack = this.rng.range(1.2, 3.4);
        this.crack = 0.22;
        this.regen = 0;
        const d = Math.hypot(cam.x - this.x, cam.z - this.z);
        this.onCrack?.(d);
      }
    }
    this.crack = Math.max(0, this.crack - dt);
    // Light: flicker with the arcs.
    const flick = lit ? 2.2 + this.rng.range(0, 2.2) + this.crack * 30 : hum ? 0.35 + this.rng.range(0, 0.25) : 0;
    this.light.light!.intensity = flick;
    // Arcs: regenerate every few frames.
    if (!lit && !hum) {
      if (this.arcs.enabled) this.arcs.enabled = false;
      this.turnCats(0);
      return;
    }
    this.arcs.enabled = true;
    this.regen -= dt;
    if (this.regen <= 0) {
      this.regen = lit ? 0.05 : 0.09;
      this.makeArcs(lit);
    }
    this.buildRibbons(cam, lit ? (this.crack > 0 ? 1.6 : 1) : 0.6);
    this.turnCats(lit ? (this.crack > 0 ? 1 : 0.55) : 0);
  }

  private makeArcs(lit: boolean): void {
    const C = COIL, rng = this.rng;
    const out: V3[][] = [];
    const surface = (a: number, up: number): V3 => [Math.sin(a) * (C.toroidR + C.toroidTube * Math.cos(up)), C.toroidY + C.toroidTube * Math.sin(up), Math.cos(a) * (C.toroidR + C.toroidTube * Math.cos(up))];
    if (!lit) {
      // Humming: little corona sparks on the toroid.
      for (let i = 0; i < 4; i++) {
        const a = rng.range(0, Math.PI * 2), p = surface(a, rng.range(-0.4, 1.2));
        const l = rng.range(0.12, 0.3);
        streamer(rng, p, [p[0] + Math.sin(a) * l, p[1] + rng.range(0, l), p[2] + Math.cos(a) * l], out, 2, 0.4);
      }
    } else {
      const n = this.low ? 4 : 7;
      for (let i = 0; i < n; i++) {
        const a = rng.range(0, Math.PI * 2), p = surface(a, rng.range(-0.3, 1));
        const l = rng.range(1.0, 2.4);
        streamer(rng, p, [p[0] + Math.sin(a) * l, p[1] + rng.range(-0.6, 0.9), p[2] + Math.cos(a) * l], out);
      }
      // To the strike rod, and (on a crack) down to the ground ring.
      if (rng.chance(0.75)) streamer(rng, surface(Math.atan2(C.rodX, C.rodZ), 0), [C.rodX, C.rodTop + 0.05, C.rodZ], out, 0, 0.18);
      if (this.crack > 0 || rng.chance(0.2)) {
        const a = rng.range(0, Math.PI * 2);
        streamer(rng, surface(a, -0.6), [Math.sin(a) * C.groundR, 0.04, Math.cos(a) * C.groundR], out, 0, 0.16);
      }
    }
    const S = COIL_SCALE;
    this.paths = out.map((p) => p.map((q) => [q[0] * S + this.x, q[1] * S + this.y, q[2] * S + this.z] as V3));
    this.widths = out.map((p, i) => (i === 0 || p.length > 9 ? 0.06 : 0.032) * (lit ? 1 : 0.6));
  }

  /** Camera-facing ribbons along every streamer (core bright, tips fading). */
  private buildRibbons(cam: pc.Vec3, bright: number): void {
    const pos: number[] = [], col: number[] = [], idx: number[] = [];
    this.paths.forEach((pts, k) => {
      const w = this.widths[k]! * (this.crack > 0 ? 1.5 : 1);
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]!, q = pts[Math.min(pts.length - 1, i + 1)]!, o = pts[Math.max(0, i - 1)]!;
        const tx = q[0] - o[0], ty = q[1] - o[1], tz = q[2] - o[2];
        const vx = cam.x - p[0], vy = cam.y - p[1], vz = cam.z - p[2];
        let sx = ty * vz - tz * vy, sy = tz * vx - tx * vz, sz = tx * vy - ty * vx;
        const sl = Math.hypot(sx, sy, sz) || 1;
        const taper = 1 - i / (pts.length - 1) * 0.7;
        sx = (sx / sl) * w * taper;
        sy = (sy / sl) * w * taper;
        sz = (sz / sl) * w * taper;
        const base = pos.length / 3;
        pos.push(p[0] - sx, p[1] - sy, p[2] - sz, p[0] + sx, p[1] + sy, p[2] + sz);
        const a = Math.round(255 * Math.min(1, bright * taper));
        const c = Math.round(Math.min(255, 200 * bright));
        col.push(c, Math.min(255, c + 30), 255, a, c, Math.min(255, c + 30), 255, a);
        if (i < pts.length - 1) idx.push(base, base + 1, base + 3, base, base + 3, base + 2);
      }
    });
    if (!idx.length) return;
    this.arcMesh.setPositions(pos);
    this.arcMesh.setColors32(col);
    this.arcMesh.setIndices(idx);
    this.arcMesh.update(pc.PRIMITIVE_TRIANGLES, false);
    this.arcMat.emissiveIntensity = 2.5 * bright;
  }

  /** The cats turn their heads (whole bodies, they are small) towards the coil while it arcs. */
  private turnCats(amount: number): void {
    const cats = this.cats;
    if (!cats) return;
    const kids = cats.children as pc.Entity[];
    if (this.catBase.length !== kids.length) this.catBase = kids.map((k) => k.getEulerAngles().y);
    kids.forEach((k, i) => {
      // Facing out (sentries) at rest; towards the coil (a half turn) when it cracks.
      const twitch = amount > 0 ? Math.sin(this.t * 7 + i) * 6 * amount : 0;
      k.setEulerAngles(0, this.catBase[i]! + 150 * amount * (i % 2 ? 1 : -1) * 0.6 + twitch, 0);
    });
  }
}
