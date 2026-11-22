/**
 * Vehicle hijacking: press E near any parked car/okada/keke to enter it,
 * drive around with WASD, press E again to get out.
 *
 * Reuses the existing Traffic system's carEntity factory and the parked
 * positions from layout.ts. Driving uses the same collision resolution as
 * the camera spring arm so vehicles can't drive through buildings, and
 * hitting a pedestrian at speed knocks them back and deals damage.
 */

import * as pc from "playcanvas";
import type { StoryGame } from "./story-game.ts";
import { surfaceHeight } from "../world/surface.ts";
import { parked, okadaPark } from "../world/layout.ts";
import type { Collider } from "../sim/collide.ts";

export type HijackKind = "car" | "okada" | "keke";

export interface HijackSpot {
  id: string;
  kind: HijackKind;
  x: number;
  z: number;
  yaw: number;
  ent?: pc.Entity;
}

export class VehicleHijack {
  private sg: StoryGame;
  active: { kind: HijackKind; x: number; z: number; yaw: number; speed: number; ent: pc.Entity } | null = null;
  spots: HijackSpot[] = [];

  private readonly carTop = 14;
  private readonly okadaTop = 11;
  private readonly kekeTop = 9;

  constructor(sg: StoryGame, private carEntity: (key: string, colour: string) => pc.Entity) {
    this.sg = sg;
    for (let i = 0; i < parked.length; i++) {
      const p = parked[i]!;
      this.spots.push({ id: `car-${i}`, kind: "car", x: p.x, z: p.z, yaw: p.yaw });
    }
    for (let i = 0; i < okadaPark.length; i++) {
      const p = okadaPark[i]!;
      this.spots.push({ id: `okada-${i}`, kind: "okada", x: p.x, z: p.z, yaw: p.yaw });
    }
  }

  nearest(x: number, z: number, r = 3.5): HijackSpot | null {
    let best: HijackSpot | null = null;
    let bd = r;
    for (const s of this.spots) {
      if (s.ent && !s.ent.enabled) continue;
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  enter(x: number, z: number): string {
    if (this.active) return "Already in a vehicle — press E to get out.";
    const s = this.nearest(x, z);
    if (!s) return "No vehicle nearby to hijack.";

    const colour = s.kind === "car" ? "#e9e9e6" : s.kind === "okada" ? "#e8742c" : "#f4f1ea";
    const e = this.carEntity(s.kind === "car" ? "sedan" : s.kind === "okada" ? "okada" : "keke", colour);
    e.setPosition(s.x, surfaceHeight(s.x, s.z), s.z);
    e.setEulerAngles(0, (s.yaw * 180) / Math.PI, 0);
    e.enabled = true;
    this.sg.d.app.root.addChild(e);
    s.ent = e;

    const kindTop = s.kind === "car" ? this.carTop : s.kind === "okada" ? this.okadaTop : this.kekeTop;
    this.active = { kind: s.kind, x: s.x, z: s.z, yaw: s.yaw, speed: 0, ent: e };
    this.sg.mode = "drive";
    this.sg.player.frozen = true;
    this.sg.player.person.visible = false;
    this.sg.ui.setMode(s.kind.toUpperCase());
    this.sg.ui.say(`Hijacked ${s.kind}. Press E to get out.`);
    this.sg.sfxs.play("door");
    return `Hijacked ${s.kind}.`;
  }

  exit(): void {
    if (!this.active) return;
    const a = this.active;
    this.sg.player.person.visible = true;
    this.sg.player.x = a.x + Math.sin(a.yaw) * 1.6;
    this.sg.player.z = a.z + Math.cos(a.yaw) * 1.6;
    this.sg.player.yaw = a.yaw;
    this.sg.player.frozen = false;
    this.sg.mode = "play";
    this.sg.ui.setMode("");
    this.sg.ui.say("Got out.");
    this.sg.sfxs.play("door");
    a.ent.destroy();
    this.active = null;
  }

  step(dt: number, moveX: number, moveY: number): void {
    if (!this.active) return;
    const a = this.active;
    const top = a.kind === "car" ? this.carTop : a.kind === "okada" ? this.okadaTop : this.kekeTop;

    const throttle = Math.max(0, moveY);
    const brake = Math.max(0, -moveY);
    a.speed += (throttle * 4 - brake * 10 - 0.35 * Math.sign(a.speed)) * dt;
    a.speed = Math.max(0, Math.min(top, a.speed));

    const steer = -moveX * (1.6 / (1 + a.speed * 0.35));
    a.yaw += steer * dt * Math.min(1, a.speed / 1.5 + 0.2);

    let nx = a.x + Math.sin(a.yaw) * a.speed * dt;
    let nz = a.z + Math.cos(a.yaw) * a.speed * dt;
    [nx, nz] = this.sg.col.resolve(nx, nz, a.kind === "car" ? 1.1 : 0.6);
    const moved = Math.hypot(nx - a.x, nz - a.z);
    if (moved < a.speed * dt * 0.4) a.speed *= 0.5;
    a.x = nx;
    a.z = nz;

    a.ent.setPosition(a.x, surfaceHeight(a.x, a.z), a.z);
    a.ent.setEulerAngles(0, (a.yaw * 180) / Math.PI, 0);

    // Hit pedestrians at speed: knock back + damage.
    if (a.speed > 5) {
      this.sg.npcs.forEach((p) => {
        if (!p.visible) return;
        const q = p.root.getPosition();
        const d = Math.hypot(q.x - a.x, q.z - a.z);
        if (d < (a.kind === "car" ? 1.6 : 1.0)) {
          const cx = q.x - a.x, cz = q.z - a.z;
          const cd = Math.hypot(cx, cz) || 1;
          p.place(q.x + (cx / cd) * 2, surfaceHeight(q.x, q.z), q.z + (cz / cd) * 2, q.y);
          if (this.sg.combat) {
            const f = this.sg.combat.fighters.get(p.root.name ?? "");
            if (f) f.health = Math.max(0, f.health - 0.3);
          }
        }
      });
    }

    const seatOff: [number, number, number] =
      a.kind === "car" ? [0.5, 1.0, -0.5] : a.kind === "okada" ? [0, 0.85, -0.1] : [0.35, 0.7, 0.6];
    const sy = Math.sin(a.yaw), cy = Math.cos(a.yaw);
    this.sg.player.person.place(
      a.x + seatOff[0] * cy - seatOff[2] * sy,
      surfaceHeight(a.x, a.z) + seatOff[1],
      a.z + seatOff[0] * sy + seatOff[2] * cy,
      a.yaw
    );
    this.sg.player.person.gait(0);
  }

  colliders(): Collider[] {
    if (!this.active) return [];
    const a = this.active;
    return [{ kind: "circle", x: a.x, z: a.z, r: a.kind === "car" ? 1.1 : 0.6, h: 1.6 }];
  }
}
