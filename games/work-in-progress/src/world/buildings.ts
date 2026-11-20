/**
 * The building kit: walls, windows, arches, columns, roofs (gable, hip,
 * mono-pitch, dome, pyramid), towers, balconies, awnings and sign slots, and
 * the recipes that combine them into original buildings:
 *
 *   senate    neoclassical hall: columned portico, pediment, drum and dome
 *   gothic    red-brick college: steep slate roofs, gabled bays, crenellated tower
 *   library   Nordic timber and glass: curtain wall, deep mono-pitch overhang
 *   arcade    Mediterranean: arched loggia, terracotta hip roof, bell tower
 *   sahel     earth-plaster Sahelian hall: buttress pinnacles, toron beams, domes
 *   medicine  contemporary curved facade with white fins
 *   hostel    balconied halls with hipped roofs and breeze-block stair towers
 *   shophouse Afro-Brazilian two-storey shops: balconies, shutters, ornate parapets
 *   plus houses, kiosks, market stalls, the gatehouse and a bus shelter.
 *
 * Everything is merged into the static world (few draw calls).
 */
import type { Builder, RGBA, V3 } from "../gfx/builder.ts";
import type { SignAtlas } from "../gfx/textures.ts";
import type { CollisionWorld } from "../sim/collide.ts";
import { makeRng, type Rng } from "../sim/rng.ts";
import type { Building } from "./layout.ts";

const hex = (h: string, a = 255): RGBA => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a];

/** Wall tones for plastered buildings (warm, sunny, never pure white). */
export const TONES = ["#efe6d2", "#e3cfa6", "#e8b4a8", "#a9c8dc", "#b5d6c0", "#f0d58c", "#d99a7c", "#c9b8dc", "#f2c29b", "#c6cf9e"].map((h) => hex(h));
const TRIM = hex("#f7f2e6");
const DARK = hex("#3a3632");
const STONE = hex("#efe2c8");
const TERRACOTTA = hex("#c9643c");
const SLATE = hex("#5d6670");
const COPPER = hex("#5fa48e");
const SHUTTER = ["#2f6b4f", "#2f5f8a", "#8a3b2f", "#3b6e6a", "#6b4f2f"].map((h) => hex(h));

/** Placement helper for one building: local coordinates (front = +z). */
class Site {
  constructor(public b: Builder, public bx: number, public bz: number, public rot: number) {}
  /** Move the builder origin to a local spot (lx, lz), turned by lrot. */
  at(lx: number, lz: number, lrot = 0, y = 0): Builder {
    const c = Math.cos(this.rot), s = Math.sin(this.rot);
    return this.b.at(this.bx + lx * c + lz * s, this.bz - lx * s + lz * c, this.rot + lrot, y);
  }
  /** Builder placed on a face: x runs along the face, +z points out of it. */
  face(which: "front" | "back" | "left" | "right", w: number, d: number): Builder {
    if (which === "front") return this.at(0, d / 2, 0);
    if (which === "back") return this.at(0, -d / 2, Math.PI);
    if (which === "right") return this.at(w / 2, 0, Math.PI / 2);
    return this.at(-w / 2, 0, -Math.PI / 2);
  }
}

interface WinOpts { w: number; h: number; arch?: boolean; shutters?: RGBA; frame?: RGBA; sill?: boolean; lit: number; rng: Rng; louvre?: boolean }

/** One window on a face-local builder: frame, glass (lit at night by chance), sill, optional arch head and shutters. */
const CURTAINS: RGBA[] = [[178, 64, 52, 255], [214, 186, 120, 255], [62, 96, 140, 255], [236, 230, 214, 255], [96, 130, 84, 255], [150, 90, 140, 255]];

function windowAt(b: Builder, x: number, y: number, o: WinOpts): void {
  const { w, h } = o;
  const lit = o.rng.chance(o.lit);
  const glassTint: RGBA = lit ? [92, 104, 118, 255] : [70, 86, 104, 0];
  // Dark reveal (gives depth) then glass slightly in front.
  b.tint([46, 44, 42, 255]).box("trim", x, y - 0.05, 0.01, w + 0.1, h + 0.1, 0.02, 1, ["back", "bottom"]);
  // A room behind the glass: a curtain drawn to one side (seen through the pane up close).
  if (o.rng.chance(0.7)) {
    const side = o.rng.chance(0.5) ? -1 : 1, cw = w * o.rng.range(0.25, 0.45);
    b.tint(o.rng.pick(CURTAINS)).box("cloth", x + side * (w / 2 - cw / 2), y + 0.02, 0.047, cw, h - 0.04, 0.008, 1, ["back"]);
  }
  b.tint(glassTint).quad("glass", [x - w / 2, y, 0.04], [x + w / 2, y, 0.04], [x + w / 2, y + h, 0.04], [x - w / 2, y + h, 0.04], 1);
  const fr = o.frame ?? TRIM;
  b.tint(fr);
  const t = 0.09;
  b.box("trim", x - w / 2 - t / 2, y, 0.06, t, h, 0.1, 1, ["back"]);
  b.box("trim", x + w / 2 + t / 2, y, 0.06, t, h, 0.1, 1, ["back"]);
  b.box("trim", x, y + h, 0.06, w + 2 * t, t, 0.1, 1, ["back"]);
  b.box("trim", x, y - t, 0.06, w + 2 * t, t, 0.1, 1, ["back"]);
  b.box("trim", x, y, 0.05, 0.05, h, 0.06, 1, ["back"]); // mullion
  b.box("trim", x, y + h * 0.62, 0.05, w, 0.05, 0.06, 1, ["back"]); // transom
  if (o.sill !== false) b.box("trim", x, y - t - 0.08, 0.1, w + 0.4, 0.08, 0.22, 1, ["back"]);
  if (o.arch) {
    // Semicircular head as a stepped fan of glass and a trim band.
    const r = w / 2, n = 8;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI, a1 = ((i + 1) / n) * Math.PI;
      b.tint(glassTint).poly("glass", [[x, y + h, 0.04], [x + Math.cos(a0) * r, y + h + Math.sin(a0) * r, 0.04], [x + Math.cos(a1) * r, y + h + Math.sin(a1) * r, 0.04]], [[0, 0], [1, 0], [1, 1]], [0, 0, 1]);
      b.tint(fr).box("trim", x + Math.cos((a0 + a1) / 2) * (r + 0.05), y + h + Math.sin((a0 + a1) / 2) * (r + 0.05) - 0.05, 0.06, 0.32, 0.12, 0.1, 1, ["back"]);
    }
  }
  if (o.shutters) {
    b.tint(o.shutters);
    for (const sx of [-1, 1]) {
      b.box("wood", x + sx * (w / 2 + 0.1 + w * 0.26), y, 0.08, w * 0.5, h, 0.05, 1, ["back"]);
      for (let k = 0.15; k < h; k += 0.18) {
        b.tint([o.shutters[0] - 20, o.shutters[1] - 20, o.shutters[2] - 20, 255]).box("trim", x + sx * (w / 2 + 0.1 + w * 0.26), y + k, 0.11, w * 0.46, 0.03, 0.02, 1, ["back"]);
        b.tint(o.shutters);
      }
    }
  }
  if (o.louvre) {
    b.tint([200, 196, 186, 255]);
    for (let k = 0.1; k < h; k += 0.16) b.box("trim", x, y + k, 0.12, w, 0.035, 0.08, 1, ["back"]);
  }
}

/** A grid of windows across a face of width fw. */
function windowGrid(b: Builder, fw: number, floors: number, floorH: number, y0: number, spacing: number, o: Omit<WinOpts, "w" | "h"> & { w: number; h: number }, skipCentre = 0): void {
  const n = Math.max(1, Math.floor((fw - 1) / spacing));
  const start = -((n - 1) * spacing) / 2;
  for (let f = 0; f < floors; f++)
    for (let i = 0; i < n; i++) {
      const x = start + i * spacing;
      if (skipCentre && Math.abs(x) < skipCentre && f === 0) continue;
      windowAt(b, x, y0 + f * floorH + (floorH - o.h) * 0.45, o);
    }
}

function door(b: Builder, x: number, w: number, h: number, color: RGBA, arch = false): void {
  b.tint([40, 36, 32, 255]).box("trim", x, 0, 0.01, w + 0.3, h + 0.15, 0.03, 1, ["back"]);
  b.tint(color).box("wood", x - w / 4 - 0.01, 0, 0.04, w / 2 - 0.04, h, 0.06, 1, ["back"]);
  b.box("wood", x + w / 4 + 0.01, 0, 0.04, w / 2 - 0.04, h, 0.06, 1, ["back"]);
  b.tint(TRIM).box("trim", x, h, 0.08, w + 0.5, 0.18, 0.16, 1, ["back"]);
  if (arch) for (let i = 0; i < 7; i++) {
    const a = ((i + 0.5) / 7) * Math.PI;
    b.box("trim", x + Math.cos(a) * (w / 2 + 0.1), h + Math.sin(a) * (w / 2 + 0.1), 0.08, 0.3, 0.16, 0.16, 1, ["back"]);
  }
}

/** Balustrade / railing along x on a face-local builder. */
function railing(b: Builder, x0: number, x1: number, y: number, z: number, color: RGBA, h = 1, gap = 0.16): void {
  b.tint(color);
  b.box("metal", (x0 + x1) / 2, y + h - 0.06, z, x1 - x0, 0.06, 0.06);
  b.box("metal", (x0 + x1) / 2, y + 0.12, z, x1 - x0, 0.04, 0.04);
  for (let x = x0; x <= x1 + 0.01; x += gap) b.box("metal", x, y, z, 0.028, h, 0.028, 1, ["top", "bottom"]);
}

/** Classical column (shaft with base and capital) at local (x, z). */
function column(b: Builder, x: number, z: number, y0: number, h: number, r: number, mat = "stone", color = STONE): void {
  b.tint(color);
  b.box(mat, x, y0, z, r * 2.6, r * 0.5, r * 2.6);
  b.cylinder(mat, x, y0 + r * 0.5, z, r * 1.05, r * 0.88, h - r * 1.2, 14, false);
  b.box(mat, x, y0 + h - r * 0.7, z, r * 2.5, r * 0.7, r * 2.5);
}

/** Parapet crenellations (merlons) round a w x d roof at y. */
function crenellate(b: Builder, w: number, d: number, y: number, mat: string, color: RGBA, size = 0.6, hgt = 0.7): void {
  b.tint(color);
  const along = (len: number, place: (t: number) => [number, number]) => {
    const n = Math.floor(len / (size * 2));
    for (let i = 0; i <= n; i++) {
      const [x, z] = place(-len / 2 + (i * len) / n);
      b.box(mat, x, y, z, size, hgt, size);
    }
  };
  along(w, (t) => [t, d / 2 - size / 2]);
  along(w, (t) => [t, -d / 2 + size / 2]);
  along(d, (t) => [w / 2 - size / 2, t]);
  along(d, (t) => [-w / 2 + size / 2, t]);
}

/** Sign slot: a board on a face-local builder, textured from the sign atlas. */
export function signBoard(b: Builder, signs: SignAtlas, name: string, x: number, y: number, w: number, h: number, z = 0.12): void {
  const [u0, v0, u1, v1] = signs.uv(name);
  b.tint([255, 255, 255, 255]).box("trim", x, y - 0.06, z - 0.06, w + 0.16, h + 0.12, 0.1, 1, ["back"]);
  b.poly("signs", [[x - w / 2, y, z + 0.005], [x + w / 2, y, z + 0.005], [x + w / 2, y + h, z + 0.005], [x - w / 2, y + h, z + 0.005]], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], [0, 0, 1]);
}

/** Striped awning (fabric) sloping out from the wall: width w, drop, projection p, colourway row 0..7. */
function awning(b: Builder, x: number, y: number, w: number, p: number, way: number): void {
  const v = (way + 0.5) / 8;
  const vv = 1 - v;
  b.tint([255, 255, 255, 255]);
  b.poly("fabric", [[x - w / 2, y - 0.7, p], [x + w / 2, y - 0.7, p], [x + w / 2, y, 0.05], [x - w / 2, y, 0.05]], [[0, vv], [w / 1.5, vv], [w / 1.5, vv], [0, vv]]);
  // Scalloped valance.
  b.poly("fabric", [[x - w / 2, y - 1.0, p], [x + w / 2, y - 1.0, p], [x + w / 2, y - 0.7, p], [x - w / 2, y - 0.7, p]], [[0, vv], [w / 1.5, vv], [w / 1.5, vv], [0, vv]], [0, 0, 1]);
  b.tint(DARK).box("metal", x - w / 2 + 0.05, y - 1.0, p - 0.05, 0.04, 1.0, 0.04);
  b.box("metal", x + w / 2 - 0.05, y - 1.0, p - 0.05, 0.04, 1.0, 0.04);
}

/** Rough height of a building's main mass (camera clearance). */
export function buildingHeight(B: Building): number {
  const perFloor: Partial<Record<Building["style"], number>> = { theatre: 4.6, senate: 4.4, gothic: 4.4, library: 4.8, arcade: 4.4, sahel: 4.2, medicine: 3.8, hostel: 3.2, shophouse: 3.6, deco: 4.2, barn: 4.5, stand: 6 };
  if (B.style === "stall" || B.style === "kiosk") return 2.6;
  if (B.style === "house" || B.style === "gatehouse") return 4;
  return (perFloor[B.style] ?? 3.5) * B.floors + 2;
}

/* ================================================================ recipes */

export interface BuildCtx { b: Builder; signs: SignAtlas; col: CollisionWorld }

export function buildBuilding(ctx: BuildCtx, B: Building): void {
  const rng = makeRng(B.seed * 7919);
  const s = new Site(ctx.b, B.x, B.z, B.rot);
  const tone = TONES[B.tone % TONES.length]!;
  switch (B.style) {
    case "senate": senate(s, B, rng, ctx); break;
    case "gothic": gothic(s, B, rng, ctx); break;
    case "library": library(s, B, rng, ctx); break;
    case "arcade": arcadeHall(s, B, rng, ctx); break;
    case "sahel": sahel(s, B, rng, ctx); break;
    case "medicine": medicine(s, B, rng, ctx); break;
    case "hostel": hostel(s, B, rng, tone, ctx); break;
    case "shophouse": shophouse(s, B, rng, tone, ctx); break;
    case "house": house(s, B, rng, tone); break;
    case "gatehouse": gatehouse(s, B); break;
    case "stall": stall(s, B, rng); break;
    case "kiosk": kiosk(s, B, rng, ctx); break;
    case "busstop": busStop(s, B); break;
    case "deco": deco(s, B, rng, ctx); break;
    case "barn": barn(s, B, rng, ctx); break;
    case "stand": stand(s, B, ctx); break;
    case "boathouse": boathouse(s, B); break;
    case "theatre": theatre(s, B, rng, ctx); break;
    case "pyramid": pyramid(s, B, rng, ctx); break;
  }
  if (B.style !== "busstop") ctx.col.add({ kind: "box", x: B.x, z: B.z, hx: B.w / 2, hz: B.d / 2, rot: B.rot, h: buildingHeight(B) });
}

function senate(s: Site, B: Building, rng: Rng, ctx: BuildCtx): void {
  const { w, d } = B, H = 13;
  // Podium and main block.
  s.at(0, 0).tint(STONE).box("stone", 0, 0, 0, w + 1.2, 1.2, d + 1.2, 4);
  s.at(0, 0).box("stone", 0, 1.2, 0, w, H - 1.2, d, 4, ["bottom"]);
  // Cornice and balustrade.
  s.at(0, 0).tint(TRIM).box("stone", 0, H, 0, w + 0.8, 0.6, d + 0.8, 4);
  for (const f of ["front", "back", "left", "right"] as const) {
    const fw = f === "front" || f === "back" ? w : d;
    const fb = s.face(f, w, d);
    windowGrid(fb, fw, 2, 5, 1.6, 4.2, { w: 1.5, h: 2.8, arch: true, lit: 0.35, rng, frame: TRIM }, f === "front" ? 14 : 0);
    railing(fb, -fw / 2 + 0.3, fw / 2 - 0.3, H + 0.6, -0.3, STONE, 0.9, 0.35);
  }
  // Portico: steps, 8 columns, entablature and pediment.
  const pw = 22, pd = 7;
  const f = s.at(0, d / 2 + pd / 2);
  for (let i = 0; i < 5; i++) f.tint(STONE).box("stone", 0, i * 0.24, pd / 2 + 2.2 - i * 0.45, pw + 6 - i * 0.4, 0.24, 2.4 + i * 0.4 + pd, 4);
  for (let i = 0; i < 8; i++) column(f, -pw / 2 + 1 + (i * (pw - 2)) / 7, pd / 2 - 1, 1.2, H - 1.8, 0.55);
  f.tint(TRIM).box("stone", 0, H - 0.6, 0, pw + 0.6, 1.4, pd + 0.4, 4);
  f.tint(STONE).gableRoof("stone", "stone", 0, H + 0.8, 0.4, pd + 0.2, pw, 3.2, 0.3, 0.3);
  signBoard(s.at(0, d / 2 + pd + 0.31), ctx.signs, "Senate Hall", 0, H - 0.45, 7, 0.9, 0);
  door(s.face("front", w, d), 0, 2.4, 4.2, hex("#5a3a24"), true);
  // Drum, dome and lantern (copper green).
  const top = s.at(0, -1);
  top.tint(STONE).cylinder("stone", 0, H, 0, 8, 8, 3.5, 28);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    column(top, Math.cos(a) * 8.3, Math.sin(a) * 8.3, H, 3.5, 0.28);
  }
  top.tint(TRIM).cylinder("stone", 0, H + 3.5, 0, 8.6, 8.6, 0.6, 28);
  top.tint(COPPER).dome("dome", 0, H + 4.1, 0, 7.6, 28, 9, false, 1.1);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    top.tint(TRIM).box("stone", Math.cos(a) * 5.4, H + 4.2 + 4.2, Math.sin(a) * 5.4, 0.25, 0.25, 0.25);
  }
  top.tint(STONE).cylinder("stone", 0, H + 12.2, 0, 1.4, 1.4, 2.2, 12);
  top.tint(COPPER).dome("dome", 0, H + 14.4, 0, 1.5, 12, 4);
  top.tint(hex("#d8b45a")).cylinder("metal", 0, H + 15.8, 0, 0.12, 0.02, 2.2, 6);
  // Side wings' low pavilions.
  for (const sx of [-1, 1]) {
    const wg = s.at(sx * (w / 2 + 5), 2);
    wg.tint(STONE).box("stone", 0, 0, 0, 10, 9, d - 6, 4);
    wg.tint(TERRACOTTA).hipRoof("rooftile", 0, 9, 0, 10, d - 6, 2.8, 0.7);
    windowGrid(s.at(sx * (w / 2 + 5), 2 + (d - 6) / 2), 10, 2, 4.2, 0.6, 3.2, { w: 1.2, h: 2.2, lit: 0.3, rng, frame: TRIM });
  }
}

function gothic(s: Site, B: Building, rng: Rng, ctx: BuildCtx): void {
  const { w, d } = B, FH = 4, H = FH * 3;
  const brickT: RGBA = [255, 255, 255, 255];
  s.at(0, 0).tint(STONE).box("stone", 0, 0, 0, w + 0.3, 0.9, d + 0.3, 4);
  s.at(0, 0).tint(brickT).box("brick", 0, 0.9, 0, w, H - 0.9, d, 2, ["bottom"]);
  // Stone string courses.
  for (const y of [FH, FH * 2, H]) s.at(0, 0).tint(STONE).box("stone", 0, y - 0.15, 0, w + 0.24, 0.3, d + 0.24, 4);
  // Steep slate roof with dormers.
  s.at(0, 0).tint(SLATE).gableRoof("rooftile", "brick", 0, H, 0, w, d, 7, 0.5);
  for (let x = -w / 2 + 5; x < w / 2 - 4; x += 7) {
    const dm = s.at(x, d / 2 - 1.6);
    dm.tint(brickT).box("brick", 0, H, 0.4, 2.4, 2.4, 1.8, 2);
    dm.tint(SLATE).gableRoof("rooftile", "brick", 0, H + 2.4, 0.4, 2.4, 1.8, 1.4, 0.15);
    windowAt(s.at(x, d / 2 - 0.69 + 0.22), 0, H + 0.4, { w: 1.1, h: 1.5, lit: 0.4, rng, frame: STONE });
  }
  // Two gabled bays projecting from the front.
  for (const bx of [-w / 3, w / 3]) {
    const bay = s.at(bx, d / 2 + 1.5);
    bay.tint(brickT).box("brick", 0, 0, 0, 7, H + 1.5, 3, 2);
    // The gable faces front: rotate the roof so its gable is on the front.
    const g = s.at(bx, d / 2 + 1.5, Math.PI / 2);
    g.tint(SLATE).gableRoof("rooftile", "brick", 0, H + 1.5, 0, 3.2, 7, 4.5, 0.4);
    const fb = s.at(bx, d / 2 + 3);
    for (let f = 0; f < 3; f++) windowAt(fb, 0, 1.4 + f * FH, { w: 1.9, h: 2.6, arch: true, lit: 0.4, rng, frame: STONE });
  }
  for (const f of ["front", "back"] as const) windowGrid(s.face(f, w, d), w, 3, FH, 0.9, 3.4, { w: 1.2, h: 2.2, arch: true, lit: 0.35, rng, frame: STONE }, 6);
  for (const f of ["left", "right"] as const) windowGrid(s.face(f, w, d), d, 3, FH, 0.9, 3.4, { w: 1.2, h: 2.2, arch: true, lit: 0.35, rng, frame: STONE });
  door(s.face("front", w, d), 0, 2.2, 3.4, hex("#2f6db5"), true);
  // Central tower with crenellations and corner pinnacles.
  const T = s.at(0, d / 2 - 2);
  const th = H + 13;
  T.tint(brickT).box("brick", 0, 0, 0, 6.5, th, 6.5, 2);
  T.tint(STONE).box("stone", 0, th, 0, 7.1, 0.5, 7.1, 4);
  crenellate(T, 7.1, 7.1, th + 0.5, "stone", STONE, 0.7, 0.9);
  for (const [px, pz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) T.tint(STONE).cylinder("stone", px * 3.3, th + 0.5, pz * 3.3, 0.45, 0, 3, 8, false, false);
  const tf = s.at(0, d / 2 - 2 + 3.25);
  windowAt(tf, 0, H + 2, { w: 1.6, h: 4, arch: true, lit: 0.2, rng, frame: STONE, louvre: true });
  // Engineering accent banner.
  signBoard(s.at(0, d / 2 + 1.27), ctx.signs, "Faculty of Engineering", 0, 4.3, 6, 0.75, 0);
}

function library(s: Site, B: Building, rng: Rng, ctx: BuildCtx): void {
  const { w, d } = B;
  const WOOD: RGBA = hex("#d9a46a");
  // White concrete base and timber upper volume that cantilevers out at the front.
  s.at(0, 0).tint(hex("#eceae4")).box("plaster", 0, 0, -1, w, 4.5, d - 2, 3);
  s.at(0, 0).tint(WOOD).box("wood", 0, 4.5, 0.6, w + 2, 5, d + 1.2, 2);
  // Curtain wall: glass with a mullion grid across the ground floor front.
  const g = s.at(0, d / 2 - 1.0);
  const lit = rng.chance(0.9);
  g.tint(lit ? [110, 128, 140, 255] : [100, 118, 134, 0]).quad("glass", [-w / 2 + 0.3, 0.05, 0.02], [w / 2 - 0.3, 0.05, 0.02], [w / 2 - 0.3, 4.4, 0.02], [-w / 2 + 0.3, 4.4, 0.02], 1);
  g.tint(DARK);
  for (let x = -w / 2 + 0.3; x <= w / 2 - 0.29; x += 1.8) g.box("metal", x, 0, 0.06, 0.08, 4.45, 0.12);
  g.box("metal", 0, 2.2, 0.06, w - 0.6, 0.06, 0.1);
  // Upper floor: tall vertical slot windows between timber fins.
  const uf = s.at(0, d / 2 + 1.2);
  for (let x = -w / 2 + 1.5; x < w / 2 - 1; x += 2.4) {
    windowAt(uf, x, 5.1, { w: 1.2, h: 3.8, lit: 0.6, rng, frame: hex("#2f2f2f"), sill: false });
    uf.tint(hex("#b98454")).box("wood", x + 1.2, 4.5, 0.25, 0.18, 5, 0.5);
  }
  // Mono-pitch roof with a deep overhang, dark standing-seam metal.
  const R = s.at(0, 0);
  const y0 = 9.5, rise = 3.2, ov = 3;
  R.tint(hex("#454b52")).quad("corrugated", [-w / 2 - 1.5, y0 + rise, -d / 2 - 1], [w / 2 + 1.5, y0 + rise, -d / 2 - 1], [w / 2 + 1.5, y0, d / 2 + 1.2 + ov], [-w / 2 - 1.5, y0, d / 2 + 1.2 + ov], 2);
  R.quad("corrugated", [-w / 2 - 1.5, y0 - 0.25, d / 2 + 1.2 + ov], [w / 2 + 1.5, y0 - 0.25, d / 2 + 1.2 + ov], [w / 2 + 1.5, y0 + rise - 0.25, -d / 2 - 1], [-w / 2 - 1.5, y0 + rise - 0.25, -d / 2 - 1], 2);
  R.tint(WOOD).poly("wood", [[w / 2 + 1, y0, d / 2 + 1.2], [w / 2 + 1, y0, -d / 2 - 0.6], [w / 2 + 1, y0 + rise * 0.95, -d / 2 - 0.6]], [[0, 0], [d, 0], [d, rise]], [1, 0, 0]);
  R.poly("wood", [[-w / 2 - 1, y0, -d / 2 - 0.6], [-w / 2 - 1, y0, d / 2 + 1.2], [-w / 2 - 1, y0 + rise * 0.95, -d / 2 - 0.6]], [[0, 0], [d, 0], [0, rise]], [-1, 0, 0]);
  // Slim steel columns under the overhang.
  for (let x = -w / 2; x <= w / 2; x += w / 5) R.tint(DARK).cylinder("metal", x, 0, d / 2 + 3.8, 0.12, 0.12, y0 - 0.1, 8);
  signBoard(s.at(0, d / 2 + 1.25), ctx.signs, "University Library", -w / 2 + 6, 9.05, 7, 0.75, 0);
}

function arcadeHall(s: Site, B: Building, rng: Rng, ctx: BuildCtx): void {
  const { w, d } = B, FH = 4.4;
  const wall: RGBA = hex("#f1e4c9");
  s.at(0, 0).tint(wall).box("plaster", 0, 0, -1.5, w, FH * 2, d - 3, 3);
  // Ground-floor loggia: arches along the front with a vaulted walkway behind.
  const lf = s.at(0, d / 2);
  lf.tint(wall).arcade("plaster", -w / 2, w / 2, 0, 0.7, 0, FH, 9, 2.9, 0.8);
  lf.tint(hex("#d7c19c")).box("brickpave", 0, 0, -1.5, w, 0.12, 3, 2, ["bottom"]);
  windowGrid(s.at(0, d / 2 - 3), w, 1, FH, 0, 4.9, { w: 1.4, h: 2.4, arch: true, lit: 0.4, rng, frame: TRIM });
  // Upper floor over the loggia, with shuttered windows and a small balcony at the centre.
  s.at(0, 0).tint(wall).box("plaster", 0, FH, 0, w, FH, d, 3);
  s.at(0, 0).tint(hex("#e7d3ad")).box("plaster", 0, FH - 0.2, 0, w + 0.3, 0.3, d + 0.3, 3);
  const shut = SHUTTER[0]!;
  windowGrid(s.face("front", w, d), w, 1, FH, FH, 4.9, { w: 1.2, h: 2.3, lit: 0.35, rng, shutters: shut });
  windowGrid(s.face("back", w, d), w, 2, FH, 0, 4.9, { w: 1.2, h: 2.3, lit: 0.35, rng, shutters: shut });
  railing(s.face("front", w, d), -3, 3, FH + 0.1, 0.9, DARK, 1);
  s.face("front", w, d).tint(wall).box("plaster", 0, FH - 0.1, 0.5, 6.4, 0.2, 1.2);
  // Terracotta hip roof and a bell tower at one end.
  s.at(0, 0).tint(TERRACOTTA).hipRoof("rooftile", 0, FH * 2, 0, w, d, 4, 0.9);
  const T = s.at(w / 2 - 3, -d / 2 + 3);
  T.tint(wall).box("plaster", 0, 0, 0, 5.5, FH * 2 + 9, 5.5, 3);
  T.tint(hex("#e0c79d")).box("plaster", 0, FH * 2 + 9, 0, 6, 0.4, 6, 3);
  for (const f of ["front", "back", "left", "right"] as const) {
    const tb = s.at(w / 2 - 3, -d / 2 + 3, { front: 0, back: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 }[f]);
    tb.tint(wall).arcade("plaster", -2.75, 2.75, 2.76, 0.2, FH * 2 + 5.5, FH * 2 + 9, 2, FH * 2 + 7.4, 0.6);
  }
  T.tint(TERRACOTTA).cylinder("rooftile", 0, FH * 2 + 9.4, 0, 3.6, 0, 4, 4, false, false);
  signBoard(s.at(0, d / 2 + 0.03), ctx.signs, "Faculty of Arts", 0, FH + 0.2, 6, 0.7, 0);
}

function sahel(s: Site, B: Building, rng: Rng, ctx: BuildCtx): void {
  const { w, d } = B;
  const EARTH: RGBA = hex("#c98a5a");
  const EARTH2: RGBA = hex("#b97a4c");
  const H = 8.5;
  s.at(0, 0).tint(EARTH).box("plaster", 0, 0, 0, w, H, d, 3);
  // Rounded buttress pinnacles along the front, tapering, with toron beams.
  const fb = s.face("front", w, d);
  for (let x = -w / 2; x <= w / 2 + 0.01; x += w / 8) {
    fb.tint(EARTH2).cylinder("plaster", x, 0, 0.3, 0.75, 0.35, H + 2.6, 8, true, true, 3);
    fb.tint(EARTH).cylinder("plaster", x, H + 2.6, 0.3, 0.36, 0.05, 1.2, 8, false, true, 3);
  }
  for (let x = -w / 2 + 1.2; x < w / 2; x += 2.2)
    for (const y of [2.8, 5.6, 8.0]) fb.tint(hex("#8a6a48")).box("wood", x, y, 0.5, 0.14, 0.14, 1.0);
  // Grand arched entrance and small arched windows.
  door(fb, 0, 3.2, 4.2, hex("#6b3e22"), true);
  for (const x of [-w / 2 + 4, -w / 2 + 8.5, w / 2 - 4, w / 2 - 8.5]) windowAt(fb, x, 2, { w: 1.0, h: 1.7, arch: true, lit: 0.6, rng, frame: hex("#e8d6b6") });
  windowGrid(s.face("back", w, d), w, 2, 3.6, 0.8, 4, { w: 0.9, h: 1.5, arch: true, lit: 0.4, rng, frame: hex("#e8d6b6") });
  // Crenellated parapet with little cone pinnacles, three white domes on the roof.
  crenellate(s.at(0, 0), w, d, H, "plaster", EARTH, 0.7, 0.8);
  for (const [x, r] of [[-w / 4, 3], [0, 4.2], [w / 4, 3]] as const) {
    const t = s.at(x, -1);
    t.tint(EARTH).cylinder("plaster", 0, H, 0, r + 0.3, r + 0.3, 1.4, 20);
    t.tint(hex("#f4efe4")).dome("plaster", 0, H + 1.4, 0, r, 20, 7, false, 0.9);
  }
  signBoard(s.at(0, d / 2 + 0.31), ctx.signs, "The Spot · Student Centre", 0, 5.2, 7, 0.75, 0);
  // Shaded terrace with umbrellas in front.
  for (const [ux, uz] of [[-8, 4.5], [-3, 6], [3, 6], [8, 4.5]] as const) {
    const u = s.at(ux, d / 2 + uz);
    u.tint(DARK).cylinder("metal", 0, 0, 0, 0.05, 0.05, 2.4, 6);
    u.tint(hex("#f2c230")).cylinder("cloth", 0, 2.1, 0, 1.6, 0.05, 0.6, 10, false, false);
    u.tint(hex("#f4efe4")).cylinder("trim", 0, 0, 0, 0.55, 0.55, 0.74, 10);
  }
}

function medicine(s: Site, B: Building, rng: Rng, ctx: BuildCtx): void {
  const { w, d } = B, FH = 3.8, floors = B.floors;
  const TEAL = hex("#2e9c8e");
  const H = FH * floors;
  // A convex curved facade: wedges around a large radius.
  const R = 40, span = w / R, segs = 12;
  const back = s.at(0, -2);
  back.tint(hex("#f3f1ec")).box("plaster", 0, 0, -2, w * 0.9, H, d - 6, 3);
  for (let i = 0; i < segs; i++) {
    const a = -span / 2 + ((i + 0.5) / segs) * span;
    const x = Math.sin(a) * R, z = Math.cos(a) * R - R + d / 2 - 2;
    const seg = s.at(x, z, a);
    const sw = (span / segs) * R + 0.05;
    seg.tint(hex("#f3f1ec")).box("plaster", 0, FH, -1.5, sw, H - FH + 0.6, 3, 3);
    for (let f = 1; f < floors; f++) {
      const lit = rng.chance(0.5);
      seg.tint(lit ? [92, 110, 122, 255] : [84, 104, 120, 0]).quad("glass", [-sw / 2, f * FH + 0.6, 0.02], [sw / 2, f * FH + 0.6, 0.02], [sw / 2, f * FH + 3.2, 0.02], [-sw / 2, f * FH + 3.2, 0.02], 1);
      seg.tint(hex("#fafaf7")).box("trim", 0, f * FH + 3.2, 0.3, sw, 0.6, 0.7);
    }
    // Vertical white fins.
    seg.tint(hex("#fafaf7")).box("trim", -sw / 2, FH, 0.4, 0.14, H - FH, 0.9);
    // Ground floor pilotis and a recessed glass lobby.
    seg.tint([96, 116, 128, 255]).quad("glass", [-sw / 2, 0.05, -1.5], [sw / 2, 0.05, -1.5], [sw / 2, FH, -1.5], [-sw / 2, FH, -1.5], 1);
    if (i % 2 === 0) seg.tint(hex("#e8e6e0")).cylinder("plaster", 0, 0, 0, 0.3, 0.3, FH, 10);
  }
  s.at(0, 0).tint(hex("#f3f1ec")).box("trim", 0, H, 0, w + 1, 0.7, d + 0.5);
  s.at(0, 0).tint(TEAL).box("trim", 0, H + 0.45, 0, w + 1.04, 0.22, d + 0.54, 1, ["top", "bottom"]);
  signBoard(s.at(0, d / 2 + 0.15), ctx.signs, "College of Health Sciences", 0, FH + 0.2, 8, 0.75, 0.2);
}

function hostel(s: Site, B: Building, rng: Rng, tone: RGBA, ctx: BuildCtx): void {
  const { w, d } = B, FH = 3.2, F = B.floors, H = FH * F;
  s.at(0, 0).tint(tone).box("plaster", 0, 0, 0, w, H, d, 3);
  s.at(0, 0).tint(hex("#8e8a80")).box("plaster", 0, 0, 0, w + 0.1, 0.6, d + 0.1, 3);
  // Balconies with railings for each room on the front.
  const fb = s.face("front", w, d);
  const rooms = Math.floor(w / 4);
  for (let f = 0; f < F; f++)
    for (let i = 0; i < rooms; i++) {
      const x = -w / 2 + 2 + i * 4;
      if (Math.abs(x) < 3) continue;
      windowAt(fb, x - 0.6, f * FH + 0.9, { w: 1.1, h: 1.5, lit: 0.55, rng, frame: TRIM, louvre: rng.chance(0.4) });
      fb.tint(hex("#6b4a32")).box("wood", x + 1.0, f * FH, 0.03, 0.9, 2.1, 0.06, 1, ["back"]);
      if (f > 0) {
        fb.tint(TRIM).box("plaster", x, f * FH - 0.15, 0.6, 3.6, 0.15, 1.2);
        railing(fb, x - 1.7, x + 1.7, f * FH, 1.15, hex("#3e4a52"), 1);
        // Washing hanging out to dry, sometimes.
        if (rng.chance(0.35)) fb.tint(rng.pick([hex("#d23c3c"), hex("#2a6fb0"), hex("#f2c230"), hex("#f4efe4"), hex("#2f8a4c")])).box("cloth", x + rng.range(-1, 1), f * FH + 0.4, 1.17, 0.8, 0.6, 0.02);
      }
    }
  windowGrid(s.face("back", w, d), w, F, FH, 0, 2.6, { w: 1.0, h: 1.3, lit: 0.45, rng, frame: TRIM });
  // Central stair tower with breeze-block screen.
  const T = s.at(0, d / 2 + 0.6);
  T.tint(hex("#e9e1cf")).box("plaster", 0, 0, 0, 5, H + 2, 1.4, 3);
  // The tower is solid (the entrance door is on its front): people and the camera stop at it.
  {
    const lz = d / 2 + 0.6, c = Math.cos(B.rot), sn = Math.sin(B.rot);
    ctx.col.add({ kind: "box", x: B.x + lz * sn, z: B.z + lz * c, hx: 2.5, hz: 0.7, rot: B.rot, h: H + 2 });
  }
  for (let y = 1; y < H; y += 0.5)
    for (let x = -1.8; x <= 1.8; x += 0.5) T.tint(hex("#d2c7ae")).box("trim", x, y, 0.72, 0.34, 0.34, 0.06);
  door(s.at(0, d / 2 + 1.31), 0, 1.8, 2.5, hex("#2f5f8a"));
  s.at(0, 0).tint(hex("#a8442c")).hipRoof("corrugated", 0, H, 0, w, d, 3.2, 0.9);
  if (B.sign) signBoard(s.at(0, d / 2 + 1.31), ctx.signs, B.sign, 0, H - 0.4, 5.2, 0.9, 0);
  // Water tank on a stand.
  const wt = s.at(w / 2 - 4, -d / 2 + 2);
  wt.tint(hex("#2e2e2e")).cylinder("metal", 0, H + 1.6, 0, 1.0, 1.0, 1.6, 12);
  wt.tint(hex("#7a7a7a")).box("metal", 0, H, 0, 1.9, 1.6, 1.9);
}

const ORNAMENT = [hex("#ffffff"), hex("#f7efe0"), hex("#fff8e8")];

function shophouse(s: Site, B: Building, rng: Rng, tone: RGBA, ctx: BuildCtx): void {
  const { w, d } = B, FH = 3.6, F = B.floors, H = FH * F;
  const trim = rng.pick(ORNAMENT);
  s.at(0, 0).tint(tone).box("plaster", 0, 0, 0, w, H, d, 3);
  // Pilasters and cornices.
  const fb = s.face("front", w, d);
  for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) fb.tint(trim).box("plaster", x, 0, 0.12, 0.45, H, 0.25, 3);
  for (let f = 1; f <= F; f++) fb.tint(trim).box("plaster", 0, f * FH - 0.25, 0.15, w, 0.28, 0.32, 3);
  // Shop front: dark interior, shelves of colourful goods, roller shutter half up.
  fb.tint([46, 42, 38, 255]).box("trim", 0, 0.15, 0.02, w - 1.4, 2.8, 0.04, 1, ["back"]);
  for (let y = 0.6; y < 2.6; y += 0.55)
    for (let x = -w / 2 + 1; x < w / 2 - 1; x += 0.45) fb.tint(rng.pick([hex("#e8a33c"), hex("#c84a3a"), hex("#3a7bb8"), hex("#f2e6c8"), hex("#4f9a5a"), hex("#d8d0c0")])).box("cloth", x, y, 0.08, 0.36, 0.3, 0.05, 1, ["back"]);
  fb.tint(hex("#9aa0a6")).box("corrugated", 0, 2.4, 0.1, w - 1.4, 0.6, 0.08, 2, ["back"]);
  awning(fb, 0, 3.4, w - 0.6, 1.8, rng.int(0, 7));
  if (B.sign) signBoard(fb, ctx.signs, B.sign, 0, 3.55, Math.min(w - 1.2, 6.4), 1.0, 0.16);
  // Upper floors: tall shuttered windows with arched heads, full-width balcony on floor 2.
  const shut = rng.pick(SHUTTER);
  const n = Math.max(2, Math.floor(w / 3));
  for (let f = 1; f < F; f++) {
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w / n) * (i + 0.5);
      windowAt(fb, x, f * FH + 0.3, { w: 0.95, h: 2.0, arch: rng.chance(0.6), lit: 0.5, rng, shutters: shut, frame: trim, sill: false });
    }
  }
  if (F >= 2) {
    fb.tint(trim).box("plaster", 0, FH - 0.05, 0.75, w - 0.2, 0.18, 1.5, 3);
    railing(fb, -w / 2 + 0.2, w / 2 - 0.2, FH + 0.13, 1.45, rng.chance(0.5) ? hex("#2e3a40") : hex("#f4efe4"), 1, 0.2);
    // Decorative brackets under the balcony.
    for (let x = -w / 2 + 0.8; x < w / 2; x += 2) fb.tint(trim).box("plaster", x, FH - 0.5, 0.35, 0.18, 0.45, 0.7);
  }
  // Parapet: stepped or curved ornamental gable with a medallion.
  const pf = s.face("front", w, d);
  pf.tint(tone).box("plaster", 0, H, 0, w, 0.9, 0.35, 3);
  if (rng.chance(0.6)) {
    const pw = w * 0.42;
    for (let k = 0; k < 4; k++) pf.tint(k % 2 ? trim : tone).box("plaster", 0, H + 0.9 + k * 0.32, 0, pw - k * (pw / 4.5), 0.32, 0.35, 3);
    pf.tint(trim).cylinder("plaster", 0, H + 1.3, 0.2, 0.4, 0.4, 0.06, 12);
  } else {
    for (let x = -w / 2 + 0.6; x < w / 2; x += 1.1) pf.tint(trim).box("plaster", x, H + 0.9, 0, 0.3, 0.35, 0.35, 3);
  }
  // Roof: corrugated hip behind the parapet (visible from above).
  s.at(0, -0.4).tint(rng.pick([hex("#9a3d2a"), hex("#6c7a82"), hex("#3e6b8a"), hex("#7d8a5a")])).hipRoof("corrugated", 0, H, 0, w - 0.6, d - 1.2, 2, 0.2);
  windowGrid(s.face("back", w, d), w, F, FH, 0, 3, { w: 0.9, h: 1.2, lit: 0.4, rng, frame: trim });
}

function house(s: Site, B: Building, rng: Rng, tone: RGBA): void {
  const { w, d } = B, H = 3.2;
  s.at(0, 0).tint(tone).box("plaster", 0, 0, -1, w, H, d - 2, 3);
  const fb = s.at(0, d / 2 - 2);
  windowAt(fb, -w / 4, 1, { w: 1.1, h: 1.3, lit: 0.6, rng, louvre: true });
  windowAt(fb, w / 4, 1, { w: 1.1, h: 1.3, lit: 0.6, rng, louvre: true });
  door(fb, 0, 1.0, 2.2, rng.pick(SHUTTER));
  // Veranda with posts.
  s.at(0, d / 2 - 1).tint(hex("#d8d2c4")).box("paver", 0, 0, 0, w, 0.25, 2, 2);
  for (const x of [-w / 2 + 0.3, 0 - 1.5, 1.5, w / 2 - 0.3]) s.at(x, d / 2 - 0.3).tint(TRIM).box("plaster", 0, 0.25, 0, 0.26, H - 0.25, 0.26, 3);
  s.at(0, 0).tint(rng.pick([hex("#9a3d2a"), hex("#6c7a82"), hex("#3e6b8a")])).hipRoof("corrugated", 0, H, 0, w, d, 1.8, 0.4);
  // Compound wall with a gate.
  const cw: RGBA = [tone[0] - 20, tone[1] - 20, tone[2] - 20, 255];
  const W2 = w / 2 + 3, D2 = d / 2 + 3;
  s.at(0, 0).tint(cw).box("plaster", 0, 0, -D2, W2 * 2, 1.8, 0.25, 3);
  s.at(0, 0).box("plaster", -W2, 0, 0, 0.25, 1.8, D2 * 2, 3);
  s.at(0, 0).box("plaster", W2, 0, 0, 0.25, 1.8, D2 * 2, 3);
  s.at(0, 0).box("plaster", -W2 / 2 - 1, 0, D2, W2 - 2, 1.8, 0.25, 3);
  s.at(0, 0).box("plaster", W2 / 2 + 1, 0, D2, W2 - 2, 1.8, 0.25, 3);
  s.at(0, D2).tint(hex("#2f5f8a")).box("metal", 0, 0, 0, 3.6, 1.9, 0.08);
}

function gatehouse(s: Site, B: Building): void {
  const { w, d } = B;
  s.at(0, 0).tint(STONE).box("stone", 0, 0, 0, w, 3.2, d, 4);
  s.at(0, 0).tint(TERRACOTTA).hipRoof("rooftile", 0, 3.2, 0, w, d, 2, 0.8);
  const fb = s.face("front", w, d);
  fb.tint([90, 110, 125, 255]).quad("glass", [-2.5, 1.1, 0.03], [2.5, 1.1, 0.03], [2.5, 2.6, 0.03], [-2.5, 2.6, 0.03], 1);
  door(s.face("left", w, d), 0, 1, 2.3, hex("#2f5f8a"));
}

function stall(s: Site, B: Building, rng: Rng): void {
  const { w, d } = B;
  const post: RGBA = hex("#6b5a46");
  for (const [px, pz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) s.at(px * (w / 2 - 0.1), pz * (d / 2 - 0.1)).tint(post).box("wood", 0, 0, 0, 0.12, pz > 0 ? 2.6 : 2.2, 0.12);
  const roof = s.at(0, 0);
  roof.tint(rng.pick([hex("#9aa3a8"), hex("#a8442c"), hex("#3e6b8a"), hex("#c8c2b0")])).quad("corrugated", [-w / 2 - 0.3, 2.2, -d / 2 - 0.4], [w / 2 + 0.3, 2.2, -d / 2 - 0.4], [w / 2 + 0.3, 2.7, d / 2 + 0.5], [-w / 2 - 0.3, 2.7, d / 2 + 0.5], 2);
  // Counter table with piles of produce.
  s.at(0, d / 2 - 0.6).tint(hex("#a77b52")).box("wood", 0, 0, 0, w - 0.4, 0.85, 1.0, 2);
  const goods = [hex("#d6402a"), hex("#f0a020"), hex("#5a9a3a"), hex("#e8d8a0"), hex("#7a3a8a"), hex("#c86428"), hex("#f2e6c8")];
  for (let x = -w / 2 + 0.6; x < w / 2 - 0.4; x += 0.7) {
    const c = rng.pick(goods);
    s.at(x, d / 2 - 0.6).tint(c).dome("cloth", 0, 0.85, 0, 0.3, 8, 3, false, 0.8);
    s.at(x, d / 2 - 0.6).tint(hex("#b89060")).cylinder("wood", 0, 0.83, 0, 0.36, 0.36, 0.04, 10);
  }
  // Sacks and crates at the back.
  for (let i = 0; i < 3; i++) s.at(rng.range(-w / 2 + 0.5, w / 2 - 0.5), -d / 2 + 0.6).tint(rng.pick([hex("#d8cba8"), hex("#c4b48c"), hex("#8a6a48")])).box("cloth", 0, 0, 0, 0.6, rng.range(0.5, 0.9), 0.5);
}

function kiosk(s: Site, B: Building, rng: Rng, ctx: BuildCtx): void {
  const { w, d } = B;
  const c = rng.pick([hex("#2a6fb0"), hex("#e0a526"), hex("#2f8a4c"), hex("#c8442f"), hex("#1f9bb4"), hex("#7a2e3b")]);
  s.at(0, 0).tint(c).box("corrugated", 0, 0, 0, w, 2.5, d, 2);
  const fb = s.face("front", w, d);
  fb.tint([40, 36, 32, 255]).box("trim", 0, 1.0, 0.01, w - 0.6, 1.1, 0.03, 1, ["back"]);
  for (let x = -w / 2 + 0.5; x < w / 2 - 0.4; x += 0.32) fb.tint(rng.pick([hex("#f2c230"), hex("#e85a3a"), hex("#4aa0e0"), hex("#f4efe4")])).box("cloth", x, 1.1, 0.05, 0.24, 0.3, 0.05, 1, ["back"]);
  fb.tint(hex("#d9d2c2")).box("wood", 0, 0.95, 0.25, w - 0.2, 0.08, 0.5);
  awning(fb, 0, 2.5, w + 0.2, 1.2, rng.int(0, 7));
  s.at(0, 0).tint(hex("#d9d2c2")).box("metal", 0, 2.5, 0, w + 0.2, 0.08, d + 0.2);
  void ctx;
}

function busStop(s: Site, B: Building): void {
  const { w, d } = B;
  for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) s.at(x, -d / 2 + 0.2).tint(DARK).box("metal", 0, 0, 0, 0.1, 2.6, 0.1);
  s.at(0, 0).tint(hex("#2e9c8e")).quad("corrugated", [-w / 2, 2.6, -d / 2], [w / 2, 2.6, -d / 2], [w / 2, 2.4, d / 2 + 0.3], [-w / 2, 2.4, d / 2 + 0.3], 2);
  s.at(0, -d / 2 + 0.1).tint([120, 150, 165, 255]).quad("glass", [-w / 2 + 0.2, 0.3, 0], [w / 2 - 0.2, 0.3, 0], [w / 2 - 0.2, 2.4, 0], [-w / 2 + 0.2, 2.4, 0], 1);
  s.at(0, -d / 2 + 0.5).tint(hex("#b98454")).box("wood", 0, 0.45, 0, w - 1, 0.08, 0.5);
}

/** Art Deco science faculty: stepped massing, vertical fins, a central tower with a stepped crown. */
function deco(s: Site, B: Building, rng: Rng, ctx: BuildCtx): void {
  const { w, d } = B, FH = 4.2, H = FH * B.floors;
  const CREAM: RGBA = hex("#efe4cc"), ACCENT: RGBA = hex("#5b4ba8"), GOLD: RGBA = hex("#d8b45a");
  s.at(0, 0).tint(CREAM).box("stone", 0, 0, 0, w, H, d, 4);
  // Stepped wings and parapet bands.
  for (const sx of [-1, 1]) {
    s.at(sx * (w / 2 - 4), 0).tint(CREAM).box("stone", 0, H, 0, 8, 1.6, d - 2, 4);
    s.at(sx * (w / 2 - 4), 0).tint(ACCENT).box("trim", 0, H + 1.6, 0, 8.2, 0.25, d - 1.8);
  }
  s.at(0, 0).tint(ACCENT).box("trim", 0, H, 0, w + 0.2, 0.3, d + 0.2);
  const fb = s.face("front", w, d);
  for (let x = -w / 2 + 2; x <= w / 2 - 1.9; x += 2.6) fb.tint(CREAM).box("stone", x, 0.6, 0.25, 0.5, H - 0.6, 0.5, 4);
  for (let x = -w / 2 + 3.3; x < w / 2 - 2; x += 2.6) for (let f = 0; f < B.floors; f++) windowAt(fb, x, f * FH + 0.9, { w: 1.6, h: 2.6, lit: 0.45, rng, frame: hex("#2e2a3a"), sill: false });
  windowGrid(s.face("back", w, d), w, B.floors, FH, 0, 2.6, { w: 1.4, h: 2.4, lit: 0.4, rng, frame: hex("#2e2a3a") });
  // Central tower with a stepped crown and a gold finial.
  const T = s.at(0, d / 2 - 2.5);
  T.tint(CREAM).box("stone", 0, 0, 0, 7, H + 9, 5, 4);
  for (let k = 0; k < 4; k++) T.tint(k % 2 ? ACCENT : CREAM).box("stone", 0, H + 9 + k * 1.1, 0, 6 - k * 1.3, 1.1, 4.2 - k * 0.9, 4);
  T.tint(GOLD).cylinder("metal", 0, H + 13.4, 0, 0.18, 0.02, 3, 6);
  for (let f = 0; f < 4; f++) windowAt(s.at(0, d / 2), 0, 1.2 + f * 3.4, { w: 1.6, h: 2.6, lit: 0.6, rng, frame: GOLD, sill: false });
  door(s.at(0, d / 2), 0, 2.4, 3.2, ACCENT);
  if (B.sign) signBoard(s.at(0, d / 2 + 0.02), ctx.signs, B.sign, 0, H + 2.2, 6, 0.75, 0);
}

/** Agriculture faculty: a big timber barn with a gambrel-like double slope, white trims and a lantern. */
function barn(s: Site, B: Building, rng: Rng, ctx: BuildCtx): void {
  const { w, d } = B, H = 7;
  const RED: RGBA = hex("#9c3b2a"), WHITE: RGBA = hex("#f4efe4");
  s.at(0, 0).tint(hex("#c9c1b0")).box("stone", 0, 0, 0, w, 1, d, 4);
  s.at(0, 0).tint(RED).box("wood", 0, 1, 0, w, H - 1, d, 2);
  // Roof turned so the gable faces the front.
  s.at(0, 0, Math.PI / 2).tint(hex("#4e5a5e")).gableRoof("corrugated", "wood", 0, H, 0, d, w, 6, 0.6);
  const fb = s.face("front", w, d);
  // Big sliding doors with white X-braces.
  fb.tint(RED).box("wood", 0, 0.05, 0.06, 6, 5, 0.1);
  fb.tint(WHITE).box("trim", 0, 5.05, 0.12, 6.3, 0.2, 0.1);
  for (const sx of [-1, 1]) {
    fb.tint(WHITE).box("trim", sx * 3.05, 0.05, 0.12, 0.2, 5, 0.1);
    fb.tint(WHITE).limb("trim", [sx * 2.9, 0.2, 0.14], [sx * 0.1, 4.9, 0.14], 0.07, 0.07, 4);
    fb.limb("trim", [sx * 0.1, 0.2, 0.14], [sx * 2.9, 4.9, 0.14], 0.07, 0.07, 4);
  }
  windowAt(fb, 0, H + 1.4, { w: 1.6, h: 1.6, lit: 0.5, rng, frame: WHITE });
  windowGrid(s.face("left", w, d), d, 1, 4, 1.5, 3.2, { w: 1.2, h: 1.6, lit: 0.4, rng, frame: WHITE });
  windowGrid(s.face("right", w, d), d, 1, 4, 1.5, 3.2, { w: 1.2, h: 1.6, lit: 0.4, rng, frame: WHITE });
  // Cupola on the ridge.
  const c = s.at(0, 0);
  c.tint(WHITE).box("wood", 0, H + 5.6, 0, 2, 1.8, 2);
  c.tint(hex("#5fa48e")).cylinder("dome", 0, H + 7.4, 0, 1.6, 0, 1.6, 4, false, false);
  if (B.sign) signBoard(s.at(0, d / 2 + 0.02), ctx.signs, B.sign, 0, 5.5, 6, 0.75, 0.1);
  // Silo beside it.
  const si = s.at(w / 2 + 3, -d / 4);
  si.tint(hex("#d8d2c4")).cylinder("metal", 0, 0, 0, 2.2, 2.2, 11, 16);
  si.tint(hex("#8a9096")).dome("dome", 0, 11, 0, 2.2, 16, 5);
}

/** Grandstand: tiered seats under a cantilevered roof on steel columns. */
function stand(s: Site, B: Building, ctx: BuildCtx): void {
  const { w, d } = B;
  const SEATS = [hex("#2a6fb0"), hex("#f2c230"), hex("#2a6fb0")];
  s.at(0, 0).tint(hex("#dad4c6")).box("plaster", 0, 0, -d / 2 + 1, w, 6.5, 2, 3);
  for (let k = 0; k < 7; k++) {
    const z = d / 2 - 0.6 - k * 1.0;
    s.at(0, 0).tint(hex("#cfc8b8")).box("plaster", 0, 0, z, w - 1, 0.6 + k * 0.75, 1.0, 3);
    s.at(0, 0).tint(SEATS[k % 3]!).box("trim", 0, 0.6 + k * 0.75, z + 0.1, w - 1.4, 0.18, 0.5);
  }
  for (let x = -w / 2 + 1; x <= w / 2 - 0.9; x += (w - 2) / 5) s.at(x, -d / 2 + 0.6).tint(hex("#4a5056")).box("metal", 0, 0, 0, 0.3, 9, 0.3);
  s.at(0, 0).tint(hex("#f4f1ea")).quad("corrugated", [-w / 2 - 1, 9.2, -d / 2], [w / 2 + 1, 9.2, -d / 2], [w / 2 + 1, 8.4, d / 2 + 2.5], [-w / 2 - 1, 8.4, d / 2 + 2.5], 2);
  s.at(0, 0).quad("corrugated", [-w / 2 - 1, 8.25, d / 2 + 2.5], [w / 2 + 1, 8.25, d / 2 + 2.5], [w / 2 + 1, 9.05, -d / 2], [-w / 2 - 1, 9.05, -d / 2], 2);
  void ctx;
}

/** Timber boathouse on the lake shore. */
function boathouse(s: Site, B: Building): void {
  const { w, d } = B;
  s.at(0, 0).tint(hex("#b98454")).box("wood", 0, 0, 0, w, 3.2, d, 2);
  s.at(0, 0).tint(hex("#3e6b8a")).gableRoof("corrugated", "wood", 0, 3.2, 0, w, d, 2.4, 0.5);
  door(s.face("front", w, d), 0, 2.6, 2.6, hex("#f4efe4"));
}

export type { V3 };

/**
 * A lecture theatre (the Twin Theatres are two of these, mirror images across
 * the lawn): a tall brick hall whose roof rises towards the back like the raked
 * seats inside, a deep portico of round columns, a glazed foyer and the name
 * over the entrance (swapped by tradition, says the story).
 */
function theatre(s: Site, B: Building, rng: Rng, ctx: BuildCtx): void {
  const { w, d } = B, H = 8.5;
  const BRICK: RGBA = hex("#c46a4a"), CON: RGBA = hex("#e9e2d2");
  s.at(0, 0).tint(CON).box("stone", 0, 0, 0, w + 0.3, 0.7, d + 0.3, 4);
  s.at(0, 0).tint(BRICK).box("brick", 0, 0.7, -1, w, H - 0.7, d - 2, 2, ["bottom"]);
  // The roof slopes up towards the back (the raked seating), with a concrete fascia.
  const back = s.at(0, -d / 2 + 1);
  back.tint(BRICK).box("brick", 0, H, 0, w, 3.2, 2, 2);
  for (let k = 0; k < 8; k++) {
    const z = -d / 2 + 2 + k * ((d - 3) / 8);
    const y = H + 3.2 * (1 - k / 8);
    s.at(0, z + (d - 3) / 16).tint(CON).box("plaster", 0, H, 0, w + 0.4, y - H + 0.05, (d - 3) / 8 + 0.02, 3);
  }
  s.at(0, 0).tint(CON).box("plaster", 0, H + 0.02, d / 2 - 1.4, w + 0.6, 0.6, 2.4, 3);
  // Portico: six columns and a deep canopy over glass doors.
  const fb = s.face("front", w, d);
  fb.tint(CON).box("plaster", 0, 5.6, 1.6, w - 2, 0.6, 3.4, 3);
  const c = Math.cos(B.rot), sn = Math.sin(B.rot);
  for (let k = 0; k < 6; k++) {
    const lx = -w / 2 + 2.4 + k * ((w - 4.8) / 5), lz = d / 2 + 3;
    fb.tint(CON).cylinder("stone", lx, 0.7, 3.0, 0.38, 0.34, 4.9, 12);
    ctx.col.add({ kind: "circle", x: B.x + lx * c + lz * sn, z: B.z - lx * sn + lz * c, r: 0.4, h: 6 });
  }
  fb.tint(hex("#2c3e4a", 255)).box("trim", 0, 0.7, -0.92, w - 4, 4.6, 0.1);
  for (let x = -w / 2 + 3; x <= w / 2 - 3; x += 1.6) fb.tint(TRIM).box("trim", x, 0.7, -0.84, 0.08, 4.6, 0.08);
  windowAt(s.at(-w / 4, d / 2 - 0.9), 0, 1.4, { w: 2.2, h: 2.8, lit: 0.6, rng, frame: TRIM });
  windowAt(s.at(w / 4, d / 2 - 0.9), 0, 1.4, { w: 2.2, h: 2.8, lit: 0.6, rng, frame: TRIM });
  door(s.at(0, d / 2 - 0.9), 0, 2.6, 3, hex("#3b2a1e"));
  // A paved apron under the portico, flush with the paths (no steps to sink into).
  fb.tint(hex("#d8d0bf")).box("stone", 0, 0, 2.2, w - 1.2, 0.035, 4.4, 2);
  // Tall slot windows down the sides.
  for (const f of ["left", "right"] as const) {
    const fs = s.face(f, w, d);
    for (let z = -d / 2 + 3; z < d / 2 - 3; z += 2.6) windowAt(fs, z, 2, { w: 0.5, h: 5.2, lit: 0.4, rng, frame: CON });
  }
  if (B.sign) signBoard(s.at(0, d / 2 + 3.32), ctx.signs, B.sign, 0, 6.0, 6.4, 0.8, 0.02);
}

function pyramid(s: Site, B: Building, rng: Rng, ctx: BuildCtx): void {
  const { w, d } = B;
  const H = 12; // Total height of the pyramid structure
  const baseH = 0.8; // Concrete base platform

  // Glass pyramid constants
  const GLASS_CLEAR: RGBA = [180, 200, 215, 120]; // Semi-transparent glass with blue tint
  const GLASS_FRAME: RGBA = hex("#c8c8c8"); // Light grey steel frame
  const BASE_CON: RGBA = hex("#e5dfd0"); // Warm concrete

  // Concrete base platform (slightly larger than pyramid footprint)
  s.at(0, 0).tint(BASE_CON).box("stone", 0, 0, 0, w + 2, baseH, d + 2, 4);

  // The glass pyramid structure - built as 4 triangular faces
  const apexY = H; // Apex height
  const baseSize = Math.min(w, d) - 2; // Leave margin for entrance

  // Build the four glass faces as triangular panels
  for (let side = 0; side < 4; side++) {
    const angle = (side * Math.PI) / 2;
    const cx = Math.cos(angle) * baseSize / 2;
    const cz = Math.sin(angle) * baseSize / 2;
    const nx = Math.cos(angle + Math.PI / 2) * baseSize / 2;
    const nz = Math.sin(angle + Math.PI / 2) * baseSize / 2;

    // Each face is divided into segments for the glass panels
    const segments = 6;
    for (let seg = 0; seg < segments; seg++) {
      const t0 = (seg / segments) - 0.5;
      const t1 = ((seg + 1) / segments) - 0.5;

      // Glass panel vertices (from base to apex)
      const p0: V3 = [cx + nx * t0, baseH, cz + nz * t0];
      const p1: V3 = [cx + nx * t1, baseH, cz + nz * t1];
      const apex: V3 = [0, apexY, 0];

      // Draw glass panel
      s.at(0, 0).tint(GLASS_CLEAR).poly("glass", [p0, p1, apex], [[0, 0], [1, 0], [0.5, 1]]);
    }
  }

  // Steel frame edges (vertical edges from corners to apex)
  const frameThick = 0.1;
  for (let corner = 0; corner < 4; corner++) {
    const angle = (corner * Math.PI) / 2;
    const cx = Math.cos(angle) * baseSize / 2;
    const cz = Math.sin(angle) * baseSize / 2;

    // Vertical frame edge as a thin box from corner to apex
    s.at(0, 0).tint(GLASS_FRAME).cylinder("metal", cx, baseH + (apexY - baseH) / 2, cz, frameThick, frameThick, apexY - baseH, 6);
  }

  // Horizontal frame rings at different heights for structural support
  for (let ring = 1; ring < 4; ring++) {
    const ringY = baseH + (H - baseH) * (ring / 4);
    const ringSize = baseSize * (1 - ring / 4);
    s.at(0, 0).tint(GLASS_FRAME).cylinder("metal", 0, ringY, 0, ringSize / 2, ringSize / 2, 0.06, 4);
  }

  // Interior floor visible through glass (light wood)
  s.at(0, 0).tint(hex("#d4b896")).box("wood", 0, baseH + 0.05, 0, baseSize - 1, 0.08, baseSize - 1, 2);

  // Glass entrance door on the front face (recessed slightly)
  const entrance = s.face("front", w, d);
  entrance.tint([40, 50, 60, 255]).box("trim", 0, baseH, 0.01, 2.6, 3.4, 0.04, 1, ["back"]);
  entrance.tint([120, 160, 180, 180]).quad("glass",
    [-1.3, baseH, 0.03], [1.3, baseH, 0.03],
    [1.3, baseH + 3.4, 0.03], [-1.3, baseH + 3.4, 0.03], 1);
  entrance.tint(GLASS_FRAME).box("metal", 0, baseH, 0.05, 2.7, 0.08, 0.08);
  entrance.tint(GLASS_FRAME).box("metal", 0, baseH + 3.4, 0.05, 2.7, 0.08, 0.08);
  entrance.tint(GLASS_FRAME).box("metal", -1.3, baseH + 1.7, 0.05, 0.08, 3.4, 0.08);
  entrance.tint(GLASS_FRAME).box("metal", 1.3, baseH + 1.7, 0.05, 0.08, 3.4, 0.08);

  // Study furniture visible inside (desks arranged in a study layout)
  const DESK: RGBA = hex("#8b6f47");
  for (let ix = -1; ix <= 1; ix++) {
    for (let iz = -1; iz <= 1; iz++) {
      if (ix === 0 && iz === 0) continue; // Leave center clear for walkway
      s.at(ix * 4.5, iz * 4.5).tint(DESK).box("wood", 0, baseH + 0.85, 0, 1.4, 0.08, 0.9);
    }
  }

  // Sign at the entrance
  if (B.sign) signBoard(s.at(0, d / 2 + 1.3), ctx.signs, B.sign, 0, baseH + 1.8, 9, 0.7, 0);
}
