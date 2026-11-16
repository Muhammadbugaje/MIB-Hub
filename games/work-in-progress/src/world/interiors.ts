/**
 * Builds the interiors in interior-plan.ts: floors, walls with doorways,
 * ceilings, every piece of furniture, the colliders (the same rectangles),
 * and the lights. Static geometry goes into the town's merged meshes (a few
 * draw calls per room); lights are real point lights switched on only while
 * you are inside that interior.
 */
import * as pc from "playcanvas";
import type { Builder, RGBA } from "../gfx/builder.ts";
import type { SignAtlas } from "../gfx/textures.ts";
import type { CollisionWorld } from "../sim/collide.ts";
import { signBoard } from "./buildings.ts";
import { FLOOR, INTERIORS, type InteriorPlan, type Item, interiorOrigin, wallsOf } from "./interior-plan.ts";

const hex = (h: string, a = 255): RGBA => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a];
const WOOD = hex("#a8754a"), DARKWOOD = hex("#6e4a2e"), METAL = hex("#7d858c"), DARK = hex("#34383c"), WHITE = hex("#f4f1ea"), CREAM = hex("#ece2cc");

/** Every sign text the interiors draw (added to the sign atlas at boot). */
export const INTERIOR_SIGNS = ["Registry", "Bursary", "Bank", "Triage", "SUG", "7", "LAW OF TORT · Week 3", "EEE 101 · Circuits", "Old banner", "Fees notice", "Notices"];

/** A face-local builder for an item: origin at the item's centre, turned by its rotation. */
function place(b: Builder, p: InteriorPlan, i: Item): Builder {
  const [ox, oz] = interiorOrigin(p);
  return b.at(ox + i.x, oz + i.z, i.rot, FLOOR);
}

function legs(b: Builder, hx: number, hz: number, h: number, r = 0.025, inset = 0.05): void {
  b.tint(METAL);
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) b.box("metal", sx * (hx - inset), 0, sz * (hz - inset), r * 2, h, r * 2);
}

function drawItem(b: Builder, signs: SignAtlas, p: InteriorPlan, i: Item): void {
  const s = place(b, p, i);
  const { hx, hz, h } = i;
  switch (i.kind) {
    case "bed":
    case "bunk": {
      s.tint(DARKWOOD).box("wood", 0, 0, 0, hx * 2, 0.32, hz * 2, 1);
      s.tint(hex(i.tag ?? "#2f5f8a")).box("cloth", 0, 0.32, 0.05, hx * 2 - 0.06, 0.16, hz * 2 - 0.16, 1);
      s.tint(WHITE).box("cloth", 0, 0.48, -hz + 0.22, hx * 2 - 0.16, 0.1, 0.32, 1);
      s.tint(DARKWOOD).box("wood", 0, 0, -hz + 0.03, hx * 2, 0.8, 0.06, 1);
      break;
    }
    case "desk":
    case "ledger_desk":
    case "table":
      s.tint(i.kind === "table" ? hex("#c79a64") : WOOD).box("wood", 0, h - 0.04, 0, hx * 2, 0.04, hz * 2, 1);
      legs(s, hx, hz, h - 0.04);
      if (i.kind === "ledger_desk") {
        s.tint(hex("#5a2a20")).box("cloth", 0.1, h, 0, 0.5, 0.06, 0.36, 1);
        s.tint(CREAM).box("trim", 0.1, h + 0.06, 0, 0.46, 0.012, 0.32, 1);
      }
      if (i.kind === "desk") s.tint(hex("#e9e4d8")).box("trim", -hx * 0.4, h, 0, 0.3, 0.03, 0.22, 1);
      break;
    case "chair":
      s.tint(WOOD).box("wood", 0, 0.44, 0, hx * 2, 0.04, hz * 2, 1);
      s.box("wood", 0, 0.48, -hz + 0.02, hx * 2, 0.42, 0.04, 1);
      legs(s, hx, hz, 0.44, 0.018, 0.03);
      break;
    case "stool":
      s.tint(hex("#c03a2b")).cylinder("trim", 0, h - 0.04, 0, hx, hx, 0.04, 10);
      s.tint(METAL).cylinder("metal", 0, 0, 0, 0.03, 0.03, h - 0.04, 6);
      break;
    case "wardrobe":
    case "cabinet":
    case "drawer":
      s.tint(i.kind === "wardrobe" ? WOOD : hex("#8f9aa2")).box(i.kind === "wardrobe" ? "wood" : "metal", 0, 0, 0, hx * 2, h, hz * 2, 1);
      s.tint(DARK).box("metal", 0, 0.05, hz + 0.005, 0.01, h - 0.1, 0.01);
      for (let y = 0.3; y < h; y += i.kind === "drawer" ? 0.25 : 2) s.tint(DARK).box("metal", 0.12, y, hz + 0.01, 0.12, 0.02, 0.02);
      break;
    case "shelf":
      s.tint(WOOD);
      s.box("wood", -hx + 0.02, 0, 0, 0.04, h, hz * 2, 1);
      s.box("wood", hx - 0.02, 0, 0, 0.04, h, hz * 2, 1);
      for (let y = 0.02; y < h; y += 0.45) s.box("wood", 0, y, 0, hx * 2, 0.03, hz * 2, 1);
      for (let k = 0; k < 6; k++) s.tint(hex(["#d23c3c", "#2a6fb0", "#f2c230", "#2f8a4c", "#e9e4d8", "#7a2e3b"][k]!)).box("trim", -hx + 0.15 + k * (hx * 2 - 0.3) / 6, 0.47 + (k % 2) * 0.45, 0, 0.12, 0.22, hz * 1.4, 1);
      break;
    case "bench":
    case "waiting_bench":
      s.tint(i.kind === "waiting_bench" ? hex("#3e6a8a") : WOOD).box(i.kind === "waiting_bench" ? "metal" : "wood", 0, h - 0.05, 0, hx * 2, 0.05, hz * 2, 1);
      s.box(i.kind === "waiting_bench" ? "metal" : "wood", 0, h, -hz + 0.03, hx * 2, 0.4, 0.04, 1);
      legs(s, hx, hz, h - 0.05, 0.02);
      break;
    case "deskrow":
      s.tint(WOOD).box("wood", 0, h - 0.04, 0, hx * 2, 0.04, hz * 2, 1);
      // Modesty panel on the side facing the stage (+z local), the bench seat behind (-z local).
      s.tint(DARKWOOD).box("wood", 0, 0.1, hz - 0.02, hx * 2, h - 0.14, 0.03, 1);
      s.tint(DARKWOOD).box("wood", 0, 0.42, -hz - 0.26, hx * 2, 0.04, 0.26, 1);
      s.tint(METAL).box("metal", -hx + 0.1, 0, -hz - 0.26, 0.04, 0.42, 0.04);
      s.box("metal", hx - 0.1, 0, -hz - 0.26, 0.04, 0.42, 0.04);
      legs(s, hx, hz, h - 0.04, 0.025, 0.1);
      break;
    case "counter":
      s.tint(hex("#d8cfbb")).box("plaster", 0, 0, 0, hx * 2, h, hz * 2, 1);
      s.tint(DARKWOOD).box("wood", 0, h, 0, hx * 2 + 0.06, 0.05, hz * 2 + 0.08, 1);
      // Glass screen with a speaking slot (registration windows).
      if (i.tag && i.tag !== "Triage") {
        // An open service window: posts and a top rail (no glass, so the clerk is seen).
        s.tint(METAL).box("metal", 0, h + 1.2, 0, hx * 2, 0.05, 0.05);
        for (const x of [-hx + 0.05, hx - 0.05]) s.box("metal", x, h, 0, 0.05, 1.2, 0.05);
      }
      if (i.tag) signBoard(s, signs, i.tag, 0, h + 1.35, Math.min(2.2, hx * 1.6), 0.4, 0.06);
      break;
    case "hotplate":
      s.tint(DARK).box("metal", 0, 0.92, 0, hx * 2, 0.08, hz * 2);
      s.tint(hex("#222222")).cylinder("metal", 0, 1.0, 0, 0.12, 0.12, 0.012, 14);
      s.tint(hex("#3d3d3d")).cylinder("metal", 0, 1.012, 0, 0.11, 0.1, 0.12, 12);
      break;
    case "radio":
      s.tint(hex("#5a3424")).box("wood", 0, 1.32, 0, hx * 2, 0.16, hz * 2);
      s.tint(hex("#d8c69a")).box("trim", 0.05, 1.36, hz + 0.003, 0.12, 0.07, 0.005);
      s.tint(METAL).limb("metal", [-hx + 0.03, 1.48, 0], [-hx - 0.1, 1.82, 0], 0.005, 0.004, 4);
      break;
    case "lectern":
      s.tint(DARKWOOD).box("wood", 0, 0.35, 0, 0.6, h - 0.35, 0.45, 1);
      s.tint(WOOD).box("wood", 0, h, 0, 0.66, 0.05, 0.55, 1);
      break;
    case "stage":
      s.tint(hex("#8a5f3c")).box("wood", 0, 0, 0, hx * 2, h, hz * 2, 1);
      break;
    case "board":
      s.tint(hex("#2f4a3a")).box("trim", 0, 1.0, 0, hx * 2, h, 0.04);
      s.tint(WOOD).box("wood", 0, 0.95, 0.03, hx * 2 + 0.1, 0.06, 0.12);
      if (i.tag) signBoard(s, signs, i.tag, 0, 2.6, hx * 1.1, 0.5, 0.05);
      // Chalk lines: a circuit (Gabas) or the words of the lecture (Yamma).
      s.tint(hex("#e9eee9"));
      for (let k = 0; k < 5; k++) s.box("trim", -hx * 0.7 + k * hx * 0.32, 1.5 + (k % 2) * 0.35, 0.03, hx * 0.24, 0.025, 0.005);
      for (let k = 0; k < 3; k++) s.box("trim", -hx * 0.5 + k * hx * 0.5, 1.4, 0.03, 0.025, 0.55, 0.005);
      break;
    case "curtain":
      s.tint(hex("#8fb8c8")).box("cloth", 0, 0.25, 0, hx * 2, h - 0.25, hz * 2, 1);
      s.tint(METAL).box("metal", 0, h, 0, 0.03, 0.03, hz * 2 + 0.1);
      break;
    case "crate":
      s.tint(hex("#b98a50")).box("wood", 0, 0, 0, hx * 2, h, hz * 2, 0.5);
      s.tint(DARKWOOD).box("wood", 0, h * 0.45, hz + 0.005, hx * 2, 0.06, 0.01);
      break;
    case "chairs_stack":
      for (let k = 0; k < 7; k++) {
        const y = k * 0.16;
        if (y > h - 0.3) break;
        s.tint(hex(k % 2 ? "#e8e4dc" : "#dcd6ca")).box("trim", 0, 0.44 + y, 0, hx * 2, 0.04, hz * 2, 1);
        s.box("trim", 0, 0.48 + y, -hz + 0.02, hx * 2, 0.4, 0.03, 1);
      }
      legs(s, hx, hz, 0.44, 0.015, 0.03);
      break;
    case "tt_table":
      s.tint(hex("#1f6b52")).box("wood", 0, h - 0.04, 0, hx * 2, 0.04, hz * 2, 1);
      s.tint(WHITE).box("trim", 0, h, 0, 0.02, 0.005, hz * 2, 1);
      s.tint(hex("#f0f0f0", 200)).box("cloth", 0, h, 0, 0.01, 0.15, hz * 2 + 0.1, 1);
      legs(s, hx, hz, h - 0.04, 0.03);
      // Broken: one corner sags.
      s.tint(DARK).box("metal", hx - 0.2, h - 0.12, hz - 0.2, 0.3, 0.08, 0.3);
      break;
    case "bag": {
      // Ghana-must-go: red and blue check.
      for (let k = 0; k < 4; k++) s.tint(hex(k % 2 ? "#c23a3a" : "#2f5aa8")).box("cloth", -hx + hx * 0.5 * k + hx * 0.25, 0, 0, hx * 0.5, h, hz * 2, 1);
      s.tint(hex("#f4f1ea")).box("cloth", 0, h * 0.45, 0, hx * 2 + 0.01, 0.05, hz * 2 + 0.01, 1);
      break;
    }
    case "rope_post":
      s.tint(hex("#c9a23a")).cylinder("metal", 0, 0, 0, 0.14, 0.12, 0.04, 10);
      s.cylinder("metal", 0, 0.04, 0, 0.03, 0.03, h - 0.04, 8);
      s.dome("metal", 0, h, 0, 0.05, 8, 3);
      break;
    case "steel_door":
      s.tint(hex("#5f6a70")).box("metal", 0, 0, 0, hx * 2, h, 0.06);
      s.tint(DARK).box("metal", 0, h, 0, hx * 2 + 0.12, 0.08, 0.1);
      for (let y = 0.4; y < h; y += 0.6) s.tint(hex("#4c555a")).box("metal", 0, y, 0.035, hx * 2 - 0.12, 0.02, 0.01);
      signBoard(s, signs, "7", 0, 1.25, 0.32, 0.4, 0.06);
      break;
    case "plant":
      s.tint(hex("#a0522d")).cylinder("plaster", 0, 0, 0, hx * 0.8, hx, 0.45, 10);
      s.tint(hex("#3f7a3a")).blob("bush", [0, 0.9, 0], hx * 1.3, i.x * 7 + i.z, hex("#4f8f45"), hex("#2f5a2c"), 1.2, 8, 6, 0.25);
      break;
    case "noticeboard":
      s.tint(hex("#a77b4f")).box("wood", 0, 1.0, 0, hx * 2, 0.9, 0.03);
      for (let k = 0; k < 6; k++) s.tint(hex(["#fff8e8", "#f6e58d", "#e8f1f5", "#ffd1c1", "#fff8e8", "#d9f2d9"][k]!)).box("trim", -hx + 0.2 + (k % 3) * (hx * 2 - 0.3) / 3, 1.15 + Math.floor(k / 3) * 0.38, 0.02, 0.28, 0.34, 0.005);
      break;
    case "sink":
      s.tint(hex("#d6d9db")).box("metal", 0, 0, 0, hx * 2, h, hz * 2, 1);
      s.tint(METAL).limb("metal", [0, h, -hz + 0.05], [0, h + 0.3, -hz + 0.15], 0.015, 0.015, 5);
      break;
    case "workbench":
      s.tint(hex("#b9b2a4")).box("wood", 0, h - 0.05, 0, hx * 2, 0.05, hz * 2, 1);
      s.tint(hex("#8a8f94")).box("metal", 0, 0, 0, hx * 2 - 0.1, h - 0.05, hz * 2 - 0.1, 1);
      if (i.tag === "scopes") for (let k = 0; k < 3; k++) s.tint(hex("#d8d4c8")).box("metal", -hx + 0.4 + k * 0.7, h, -0.1, 0.4, 0.22, 0.3);
      if (i.tag === "parts") for (let k = 0; k < 6; k++) s.tint(hex(["#d23c3c", "#2a6fb0", "#f2c230"][k % 3]!)).box("trim", -hx + 0.3 + k * 0.6, h, 0.1, 0.12, 0.05, 0.08);
      if (i.tag === "logbook") {
        // The lab logbook: a big old ledger, open.
        s.tint(hex("#4a2c1c")).box("cloth", 0, h, 0, 0.9, 0.05, 0.6);
        s.tint(hex("#efe2c4")).box("trim", -0.22, h + 0.05, 0, 0.42, 0.02, 0.54);
        s.tint(hex("#efe2c4")).box("trim", 0.22, h + 0.05, 0, 0.42, 0.02, 0.54);
      }
      break;
    case "bed_med":
      s.tint(METAL).box("metal", 0, 0.3, 0, hx * 2, 0.06, hz * 2);
      s.tint(WHITE).box("cloth", 0, 0.36, 0, hx * 2 - 0.06, 0.18, hz * 2 - 0.06, 1);
      s.tint(hex("#cfe3e6")).box("cloth", 0, 0.54, -hz + 0.25, hx * 2 - 0.2, 0.08, 0.35, 1);
      legs(s, hx, hz, 0.3, 0.02);
      break;
    case "door_prop":
      s.tint(i.tag === "far" ? hex("#5a3c26") : hex("#7a5236")).box("wood", 0, 0, 0, hx * 2, h, 0.05);
      s.tint(hex("#c9a23a")).box("metal", hx * 0.65, 1.0, 0.04, 0.06, 0.06, 0.06);
      break;
    case "banner":
      s.tint(i.tag === "old" ? hex("#8a6a5a") : hex("#1f6b52")).box("cloth", 0, h, 0, hx * 2, 0.8, 0.02);
      if (i.tag === "SUG") signBoard(s, signs, "SUG", 0, h + 0.18, 1.6, 0.4, 0.03);
      break;
    case "gown_table":
      s.tint(hex("#c79a64")).box("wood", 0, h - 0.04, 0, hx * 2, 0.04, hz * 2, 1);
      legs(s, hx, hz, h - 0.04);
      for (let k = 0; k < 5; k++) s.tint(hex(k % 2 ? "#1d1d24" : "#262633")).box("cloth", -hx + 0.35 + k * (hx * 2 - 0.5) / 4, h, -0.05 + (k % 2) * 0.1, 0.5, 0.06, hz * 1.5, 1);
      break;
    case "window":
      s.tint(WHITE).box("trim", 0, 0.9, 0, hx * 2 + 0.12, h + 0.12, 0.06);
      s.tint([255, 255, 255, 255]).quad("daywin", [-hx, 0.96, 0.035], [hx, 0.96, 0.035], [hx, 0.96 + h, 0.035], [-hx, 0.96 + h, 0.035], 1);
      s.tint(WHITE).box("trim", 0, 0.96 + h / 2, 0.04, hx * 2, 0.04, 0.02);
      s.box("trim", 0, 0.96, 0.04, 0.04, h, 0.02);
      break;
    case "clock":
      s.tint(WHITE).cylinder("trim", 0, 2.6, 0.02, 0.36, 0.36, 0.04, 20);
      s.tint([255, 255, 255, 255]).quad("clock", [-0.32, 2.3, 0.07], [0.32, 2.3, 0.07], [0.32, 2.94, 0.07], [-0.32, 2.94, 0.07], 1, [[0, 0], [1, 0], [1, 1], [0, 1]]);
      break;
    case "lamp": {
      const ceil = roomHeight(p, i.x, i.z) - FLOOR;
      if (i.tag === "strip") {
        s.tint(WHITE).box("metal", 0, ceil - 0.08, 0, hx * 2, 0.06, hz * 2 + 0.06);
        s.tint([255, 255, 255, 255]).box("ilamp", 0, ceil - 0.11, 0, hx * 2 - 0.06, 0.03, hz * 2);
      } else {
        s.tint(METAL).limb("metal", [0, ceil, 0], [0, ceil - 0.4, 0], 0.008, 0.008, 4);
        s.tint([255, 255, 255, 255]).cylinder("ilamp", 0, ceil - 0.55, 0, 0.06, 0.08, 0.15, 10);
      }
      break;
    }
    case "locker":
      s.tint(hex("#5d7a8c")).box("metal", 0, 0, 0, hx * 2 - 0.02, h, hz * 2, 1);
      for (let y = 1.5; y < 1.75; y += 0.06) s.tint(hex("#3e5260")).box("metal", 0, y, hz + 0.003, hx * 1.2, 0.02, 0.005);
      s.tint(hex(i.tag === "plug" ? "#d4af37" : "#8a8f94")).box("metal", hx * 0.55, 0.95, hz + 0.01, 0.06, 0.1, 0.04);
      break;
  }
}

/** Parts of an item outside its main footprint that are still solid (the bench behind a desk row). Local -> room frame. */
export function extraSolids(i: Item): { x: number; z: number; hx: number; hz: number }[] {
  if (i.kind !== "deskrow") return [];
  const lz = -i.hz - 0.26, c = Math.cos(i.rot), s = Math.sin(i.rot);
  return [{ x: i.x + lz * s, z: i.z + lz * c, hx: i.hx, hz: 0.13 }];
}

function roomHeight(p: InteriorPlan, x: number, z: number): number {
  const r = p.rooms.find((q) => Math.abs(x - q.x) <= q.hx && Math.abs(z - q.z) <= q.hz) ?? p.rooms[0]!;
  return r.h;
}

export interface BuiltInterior {
  plan: InteriorPlan;
  lights: pc.Entity[];
}

/** Build every interior into the static world, add colliders, and make (disabled) lights. */
export function buildInteriors(app: pc.AppBase, b: Builder, signs: SignAtlas, col: CollisionWorld): BuiltInterior[] {
  const out: BuiltInterior[] = [];
  for (const p of INTERIORS) {
    const [ox, oz] = interiorOrigin(p);
    for (const r of p.rooms) {
      const floorMat = r.floor === "wood" ? "wood" : r.floor === "tile" ? "paver" : r.floor === "lino" ? "plaster" : "stone";
      const ft: RGBA = r.floor === "tile" ? hex("#d9d3c6") : r.floor === "lino" ? hex("#9fb8b0") : r.floor === "concrete" ? hex("#b5b0a5") : hex("#c08a5a");
      b.at(ox + r.x, oz + r.z, 0, 0).tint(ft).box(floorMat, 0, -0.2, 0, r.hx * 2 + 0.2, 0.2 + FLOOR, r.hz * 2 + 0.2, r.floor === "tile" ? 1.2 : 2, ["bottom"]);
      // Ceiling (casts the shadow that keeps the sun out) with a pale underside.
      b.at(ox + r.x, oz + r.z, 0, 0).tint(hex("#f2efe8")).box("plaster", 0, r.h, 0, r.hx * 2 + 0.3, 0.2, r.hz * 2 + 0.3, 3);
      // Skirting boards make the walls sit on the floor (no floating edges).
      b.at(ox + r.x, oz + r.z, 0, 0).tint(DARKWOOD);
    }
    for (const w of wallsOf(p)) {
      const r = p.rooms.find((q) => Math.abs(w.x - q.x) <= q.hx + 0.2 && Math.abs(w.z - q.z) <= q.hz + 0.2) ?? p.rooms[0]!;
      const tone = hex(r.wall);
      const bw = b.at(ox + w.x, oz + w.z, 0, 0);
      bw.tint(tone).box("plaster", 0, 0, 0, w.hx * 2, r.h, w.hz * 2, 2.5);
      bw.tint(hex("#8a7a66")).box("plaster", 0, 0, 0, w.hx * 2 + 0.02, 0.12, w.hz * 2 + 0.02, 1);
      col.add({ kind: "box", x: ox + w.x, z: oz + w.z, hx: w.hx, hz: w.hz, rot: 0, h: r.h });
    }
    for (const i of p.items) {
      drawItem(b, signs, p, i);
      if (!i.soft) col.add({ kind: "box", x: ox + i.x, z: oz + i.z, hx: i.hx, hz: i.hz, rot: i.rot, h: i.h });
      for (const e of extraSolids(i)) col.add({ kind: "box", x: ox + e.x, z: oz + e.z, hx: e.hx, hz: e.hz, rot: i.rot, h: 0.46 });
    }
    const lights = p.lights.map((l) => {
      const e = new pc.Entity(`ilight-${p.id}`);
      e.addComponent("light", { type: "omni", castShadows: false, range: l.range, intensity: 1.6, color: new pc.Color(l.color[0], l.color[1], l.color[2]), falloffMode: pc.LIGHTFALLOFF_INVERSESQUARED });
      e.setPosition(ox + l.x, l.y, oz + l.z);
      e.enabled = false;
      app.root.addChild(e);
      return e;
    });
    out.push({ plan: p, lights });
  }
  return out;
}
