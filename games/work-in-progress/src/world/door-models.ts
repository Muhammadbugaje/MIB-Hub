/**
 * The doors you see: a frame (jambs, head, an arch where the building has
 * one), a threshold, a dark doorway behind, and hinged leaves that swing open
 * when someone passes and close behind them. Built from world/door-plan.ts,
 * one entity per door (frame) plus one per leaf, so a swing is a single
 * rotation. Room doors stand open against the room side; the kitchen has a
 * bare frame.
 */
import * as pc from "playcanvas";
import type { RGBA } from "../gfx/builder.ts";
import type { MatLib } from "../gfx/materials.ts";
import { makeProp } from "../gfx/propmesh.ts";
import type { DoorSpec } from "./door-plan.ts";

const hex = (h: string): RGBA => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const FRAME: RGBA = [236, 230, 214, 255];
const DARK: RGBA = [16, 14, 13, 255];
const OPEN_DEG = 96;

interface Live {
  spec: DoorSpec;
  root: pc.Entity;
  hinges: { e: pc.Entity; sign: number; deg: number }[];
  /** 0 closed .. 1 open. */
  t: number;
  target: number;
  /** Seconds before it closes again. */
  hold: number;
}

export class Doors {
  private live = new Map<string, Live>();

  constructor(app: pc.AppBase, mats: MatLib, specs: DoorSpec[]) {
    for (const d of specs) this.live.set(d.id, this.build(app, mats, d));
  }

  get specs(): DoorSpec[] {
    return [...this.live.values()].map((l) => l.spec);
  }

  private build(app: pc.AppBase, mats: MatLib, d: DoorSpec): Live {
    const root = new pc.Entity(`door-${d.id}`);
    root.setPosition(d.x, d.y, d.z);
    root.setEulerAngles(0, (d.yaw * 180) / Math.PI, 0);
    app.root.addChild(root);
    const { w, h } = d;
    const frame = makeProp(app, mats, `door-frame-${d.id}`, (b) => {
      b.tint(FRAME);
      // Jambs, head, and a little architrave proud of the wall.
      // Exits sit on a wall's face; doorways between rooms straddle the wall.
      const fz = d.rest === "closed" ? 0.06 : 0;
      b.box("trim", -w / 2 - 0.07, 0, fz, 0.14, h + 0.12, 0.2);
      b.box("trim", w / 2 + 0.07, 0, fz, 0.14, h + 0.12, 0.2);
      b.box("trim", 0, h, fz, w + 0.28, 0.14, 0.2);
      if (d.arch)
        for (let i = 0; i < 9; i++) {
          const a = ((i + 0.5) / 9) * Math.PI;
          b.box("trim", Math.cos(a) * (w / 2 + 0.05), h + 0.1 + Math.sin(a) * (w / 2) * 0.55, 0.02, 0.32, 0.16, 0.16);
        }
      // Threshold.
      b.tint([150, 146, 138, 255]).box("stone", 0, 0, 0, w + 0.1, 0.035, 0.34);
      if (d.rest === "closed") {
        // The dark doorway behind the leaves (what you see when they swing open).
        // (Proud of the wall face, so it covers any painted door; the leaves close in front of it.)
        b.tint(DARK).box("trim", 0, 0.03, 0.08, w, h - 0.03, 0.02);
      }
      if (d.porch) {
        // A small glazed vestibule from the door back to the recessed facade.
        const p = d.porch;
        b.tint([44, 62, 74, 255]);
        b.box("trim", -w / 2 - 0.2, 0, -p / 2, 0.12, h + 0.3, p);
        b.box("trim", w / 2 + 0.2, 0, -p / 2, 0.12, h + 0.3, p);
        b.tint(FRAME).box("trim", 0, h + 0.3, -p / 2 + 0.05, w + 0.6, 0.18, p + 0.1);
      }
    }, { shadows: false });
    root.addChild(frame);
    const hinges: Live["hinges"] = [];
    if (d.rest !== "frame") {
      const lw = d.leaves === 2 ? w / 2 : w;
      const col = hex(d.colour);
      for (let k = 0; k < d.leaves; k++) {
        // Double doors: left leaf then right. A single leaf hangs on its hinge side.
        const left = d.leaves === 2 ? k === 0 : (d.hinge ?? -1) < 0;
        const hinge = new pc.Entity("hinge");
        hinge.setLocalPosition(left ? -w / 2 : w / 2, 0.03, d.rest === "closed" ? 0.12 : -0.07 * d.swing);
        root.addChild(hinge);
        const sx = left ? 1 : -1;
        // Room doors are painted (so they read apart from the wooden wardrobes); entrances are wood.
        const M = d.rest === "open" ? "trim" : "wood";
        const leaf = makeProp(app, mats, "leaf", (b) => {
          b.tint(col).box(M, (sx * lw) / 2, 0, 0, lw - 0.02, h - 0.05, 0.05);
          // Panels, a kick plate and a handle.
          b.tint([Math.max(0, col[0] - 22), Math.max(0, col[1] - 22), Math.max(0, col[2] - 22), 255]);
          b.box(M, (sx * lw) / 2, h * 0.55, 0.03, lw * 0.6, h * 0.3, 0.012);
          b.box(M, (sx * lw) / 2, h * 0.12, 0.03, lw * 0.6, h * 0.3, 0.012);
          b.tint([200, 190, 150, 255]).box("metal", sx * (lw - 0.1), h * 0.45, 0.06, 0.03, 0.03, 0.06);
          b.box("metal", sx * (lw - 0.1), h * 0.45, -0.06, 0.03, 0.03, 0.06);
          b.box("metal", sx * (lw - 0.13), h * 0.45 - 0.015, 0.09, 0.09, 0.03, 0.025);
        }, { shadows: true });
        hinge.addChild(leaf);
        // Positive angle swings a left leaf towards local -z (away from the approach side).
        hinges.push({ e: hinge, sign: sx * d.swing, deg: d.openDeg ?? OPEN_DEG });
      }
    }
    const l: Live = { spec: d, root, hinges, t: d.rest === "open" ? 1 : 0, target: d.rest === "open" ? 1 : 0, hold: 0 };
    this.pose(l);
    return l;
  }

  private pose(l: Live): void {
    // Ease in and out of the swing.
    const e = l.t * l.t * (3 - 2 * l.t);
    for (const h of l.hinges) h.e.setLocalEulerAngles(0, h.sign * h.deg * e, 0);
  }

  /** Swing a door open; it closes again after `secs`. */
  open(id: string, secs = 1.6): void {
    const l = this.live.get(id);
    if (!l || l.spec.rest !== "closed") return;
    l.target = 1;
    l.hold = Math.max(l.hold, secs);
  }

  /** Is it (nearly) open? */
  isOpen(id: string): boolean {
    return (this.live.get(id)?.t ?? 0) > 0.85;
  }

  /** The nearest closed (passable) door in a place within r metres. */
  near(place: string, x: number, z: number, r = 3): DoorSpec | null {
    let best: DoorSpec | null = null, bd = r;
    for (const l of this.live.values()) {
      if (l.spec.place !== place || l.spec.rest !== "closed") continue;
      const d = Math.hypot(l.spec.x - x, l.spec.z - z);
      if (d < bd) {
        bd = d;
        best = l.spec;
      }
    }
    return best;
  }

  update(dt: number): void {
    for (const l of this.live.values()) {
      if (l.spec.rest !== "closed") continue;
      if (l.target > 0) {
        l.hold -= dt;
        if (l.hold <= 0 && l.t >= 1) l.target = 0;
      }
      if (l.t === l.target) continue;
      const rate = l.target > l.t ? 2.6 : 1.5;
      l.t = l.target > l.t ? Math.min(l.target, l.t + rate * dt) : Math.max(l.target, l.t - rate * dt);
      this.pose(l);
    }
  }
}
