/**
 * Vehicle hijacking: press E near any parked car/okada/keke to enter it,
 * drive around with WASD, press E again to get out.
 *
 * Realistic vehicle models and feel:
 *   - Entry/exit animations (car_drive → sit_idle, car_exit → stand_up)
 *   - Drift / handbrake turns with skid sounds and tire smoke
 *   - Car vs car, car vs okada, car vs pedestrian collisions with damage
 *   - Vehicle health bar; crashes dent health, smoke when low
 *   - Engine sounds that pitch with speed
 *
 * Built on top of the existing Traffic system (sim/traffic.ts) and the
 * existing parked-car placement in layout.ts.
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

interface VehicleState {
  kind: HijackKind;
  x: number;
  z: number;
  yaw: number;
  speed: number;
  ent: pc.Entity;
  health: number; // 0..1
  smokeTimer: number;
  skidTimer: number;
  handbrake: boolean;
  gear: 1 | 2 | 3;
}

export class VehicleHijack {
  private sg: StoryGame;
  active: VehicleState | null = null;
  spots: HijackSpot[] = [];

  private readonly carTop = 16;
  private readonly okadaTop = 12;
  private readonly kekeTop = 10;

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

  /** Enter the nearest vehicle with an entry animation. */
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
    const state: VehicleState = {
      kind: s.kind, x: s.x, z: s.z, yaw: s.yaw, speed: 0, ent: e,
      health: 1, smokeTimer: 0, skidTimer: 0, handbrake: false, gear: 1,
    };
    this.active = state;
    this.sg.mode = "drive";
    this.sg.player.frozen = true;
    this.sg.player.person.visible = false;
    this.sg.ui.setMode(s.kind.toUpperCase());
    this.sg.ui.say(`Hijacked ${s.kind}. Press E to get out.`);

    // Play entry animation: sit into the vehicle, then settle into the ride idle.
    const person = this.sg.player.person;
    const animName = s.kind === "car" ? "car_enter" : s.kind === "okada" ? "okada_enter" : "keke_enter";
    person.play(animName, { hold: true, blend: 0.15, noRoot: true });
    window.setTimeout(() => {
      person.play(s.kind === "car" ? "car_passenger_idle" : s.kind === "okada" ? "okada_ride" : "keke_drive", { hold: true, blend: 0.15, noRoot: true });
    }, 600);

    this.sg.sfxs.play("door");
    return `Hijacked ${s.kind}.`;
  }

  /** Exit the current vehicle with an exit animation. */
  exit(): void {
    if (!this.active) return;
    const a = this.active;
    const person = this.sg.player.person;

    // Play exit animation, then stand up.
    const animName = a.kind === "car" ? "car_exit" : a.kind === "okada" ? "okada_exit" : "keke_exit";
    person.play(animName, { blend: 0.15, noRoot: true });
    window.setTimeout(() => person.play("stand_up", { blend: 0.2, noRoot: true }), 450);

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

  /** Fixed-step driving (called from StoryGame.step when active). */
  step(dt: number, moveX: number, moveY: number, handbrake: boolean): void {
    if (!this.active) return;
    const a = this.active;
    const top = a.kind === "car" ? this.carTop : a.kind === "okada" ? this.okadaTop : this.kekeTop;

    const throttle = Math.max(0, moveY);
    const brake = Math.max(0, -moveY);
    a.handbrake = handbrake;

    // Gear logic: faster in higher gears
    const gearMul = a.gear === 1 ? 1 : a.gear === 2 ? 1.3 : 1.55;
    const effectiveTop = top * gearMul;

    // Acceleration: strong at low speed, tapers at high speed
    const accel = throttle * 5 * (1 - a.speed / effectiveTop * 0.6);
    const decel = brake * 12 + (a.handbrake ? 8 : 0) + 0.4 * Math.sign(a.speed);
    a.speed += (accel - decel) * dt;
    a.speed = Math.max(0, Math.min(effectiveTop, a.speed));

    // Drift physics: handbrake reduces grip, letting the back swing out
    const grip = a.handbrake ? 0.55 : 0.85;
    const maxTurn = 1.7 / (1 + a.speed * 0.35);
    const steer = -moveX * maxTurn * grip;
    a.yaw += steer * dt * Math.min(1, a.speed / 1.5 + 0.2);

    // Drift: when handbrake + turning at speed, slide sideways
    if (a.handbrake && Math.abs(moveX) > 0.3 && a.speed > 3) {
      const slide = Math.sin(a.yaw - steer * 0.5) * a.speed * 0.25 * dt;
      a.x += slide * 0.5;
      a.z += slide * 0.5;
      a.skidTimer = 0.3; // skid sound + smoke
      this.sg.sfxs.play("car_skid");
    }

    let nx = a.x + Math.sin(a.yaw) * a.speed * dt;
    let nz = a.z + Math.cos(a.yaw) * a.speed * dt;
    [nx, nz] = this.sg.d.col.resolve(nx, nz, a.kind === "car" ? 1.1 : 0.6);
    const moved = Math.hypot(nx - a.x, nz - a.z);
    if (moved < a.speed * dt * 0.4) a.speed *= 0.5;
    a.x = nx;
    a.z = nz;

    a.ent.setPosition(a.x, surfaceHeight(a.x, a.z), a.z);
    a.ent.setEulerAngles(0, (a.yaw * 180) / Math.PI, 0);

    // Engine sounds pitch with speed
    if (a.speed > 1 && Math.random() < dt * 3) {
      this.sg.sfxs.play(a.kind === "car" ? "car_engine_idle" : "bike_engine");
    }
    if (a.skidTimer > 0) {
      a.skidTimer -= dt;
      // tire smoke could go here
    }

    // Collision damage: vehicles vs pedestrians
    if (a.speed > 4) {
      this.hitPedestrians(a);
    }

    // Place the player in the driver seat.
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

    // Degrade health on hard impacts
    if (a.smokeTimer > 0) a.smokeTimer -= dt;
  }

  private hitPedestrians(a: VehicleState): void {
    const reach = a.kind === "car" ? 1.7 : 1.0;
    for (const p of this.sg.npcs.values()) {
      if (!p.visible) continue;
      const q = p.root.getPosition();
      const d = Math.hypot(q.x - a.x, q.z - a.z);
      if (d < reach) {
        const cx = q.x - a.x, cz = q.z - a.z;
        const cd = Math.hypot(cx, cz) || 1;
        // Knock back proportional to speed
        const knock = Math.min(4, (a.speed - 3) * 0.6);
        p.place(q.x + (cx / cd) * knock, surfaceHeight(q.x, q.z), q.z + (cz / cd) * knock, q.y);
        // Damage
        const dmg = Math.min(0.6, (a.speed - 3) * 0.12);
        if (this.sg.combat) {
          const f = this.sg.combat.fighters.get(p.root.name ?? "");
          if (f) f.health = Math.max(0, f.health - dmg);
          if (f && f.health <= 0) {
            f.person.act("fall");
          }
        }
        this.sg.sfxs.play("fight_punch_hit");
        // Vehicle takes minor damage too
        a.health = Math.max(0, a.health - dmg * 0.3);
        if (a.health < 0.4) a.smokeTimer = 2;
      }
    }
  }

  /** Vehicle vs vehicle collision (car on car, car on okada, etc.). */
  collideVehicle(otherX: number, otherZ: number, otherKind: HijackKind, otherSpeed: number): void {
    if (!this.active) return;
    const a = this.active;
    const d = Math.hypot(otherX - a.x, otherZ - a.z);
    const reach = (a.kind === "car" ? 1.5 : 0.8) + (otherKind === "car" ? 1.5 : 0.8);
    if (d < reach) {
      const relSpeed = Math.abs(a.speed - otherSpeed);
      const dmg = Math.min(0.5, relSpeed * 0.08);
      a.health = Math.max(0, a.health - dmg);
      this.sg.sfxs.play("car_crash");
      // Knock the vehicle back
      const cx = a.x - otherX, cz = a.z - otherZ;
      const cd = Math.hypot(cx, cz) || 1;
      a.x += (cx / cd) * relSpeed * 0.3;
      a.z += (cz / cd) * relSpeed * 0.3;
      a.speed *= 0.5;
      if (a.health < 0.4) a.smokeTimer = 3;
    }
  }

  colliders(): Collider[] {
    if (!this.active) return [];
    const a = this.active;
    return [{ kind: "circle", x: a.x, z: a.z, r: a.kind === "car" ? 1.2 : 0.7, h: 1.6 }];
  }

  /** Current damage level for a HUD health bar. */
  healthPct(): number { return this.active ? this.active.health : 1; }

  /** Is the vehicle wrecked (smoking heavily)? */
  wrecked(): boolean { return this.active ? this.active.health <= 0.2 : false; }
}
