/**
 * Headless harness for the animation feel tests: the real Locomotor,
 * Controller and Animator on a real body (assets/people/*.glb) with the real
 * clip packs (assets/anim/*.glb). One loop step = one 60 Hz controller step
 * plus one animation update, exactly as the game does at 60 fps.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Animator } from "../src/anim/animator.ts";
import { decodeClipPack } from "../src/anim/clip.ts";
import { AnimLibrary } from "../src/anim/library.ts";
import { rotV, type V3 } from "../src/anim/math.ts";
import { B, BONE_COUNT, BONE_INDEX, Skeleton, fk, wpos } from "../src/anim/skeleton.ts";
import type { Ground } from "../src/sim/controller.ts";
import { Locomotor, type LocoInput } from "../src/sim/locomotor.ts";
import { MotionSense } from "../src/anim/motion-sense.ts";

const GAME = resolve(__dirname, "..");

let lib: AnimLibrary | null = null;
export function library(): AnimLibrary {
  if (!lib) lib = AnimLibrary.fromPacks(["locomotion", "social", "action", "vehicles"].map((n) => decodeClipPack(readFileSync(resolve(GAME, `assets/anim/${n}.glb`)))));
  return lib;
}

/** A body's mib_rig rest pose from its GLB nodes. */
export function bodySkeleton(key: string): Skeleton {
  const buf = readFileSync(resolve(GAME, `assets/people/${key}.glb`));
  const jl = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jl).toString("utf8")) as { nodes: { name?: string; rotation?: number[]; translation?: number[] }[] };
  const rot = new Float32Array(BONE_COUNT * 4), pos = new Float32Array(BONE_COUNT * 3);
  for (let i = 0; i < BONE_COUNT; i++) rot[i * 4 + 3] = 1;
  for (const n of json.nodes) {
    const b = BONE_INDEX[n.name ?? ""];
    if (b === undefined) continue;
    if (n.rotation) rot.set(n.rotation, b * 4);
    if (n.translation) pos.set(n.translation, b * 3);
  }
  return new Skeleton(rot, pos, library().refHipHeight);
}

export const FLAT: Ground = { height: () => 0, resolve: (x, z) => [x, z] };

export interface Frame {
  t: number;
  speed: number;
  dominant: string;
  state: string;
  x: number;
  z: number;
  yaw: number;
  /** World positions of the balls of the feet (ToeBase) and ankles. */
  toeL: V3;
  toeR: V3;
  /** Lowest point of each foot (ankle minus its height, or the toe). */
  lowL: number;
  lowR: number;
  rot: Float32Array;
}

export class Sim {
  readonly anim: Animator;
  readonly loco: Locomotor;
  t = 0;
  readonly frames: Frame[] = [];

  constructor(body = "casual", readonly ground: Ground = FLAT) {
    this.anim = new Animator(library(), bodySkeleton(body));
    this.anim.groundAt = (x, z) => {
      const c = this.loco.c;
      const cs = Math.cos(c.yaw), sn = Math.sin(c.yaw);
      return this.ground.height(c.x + x * cs + z * sn, c.z - x * sn + z * cs) - this.loco.renderY;
    };
    this.loco = new Locomotor(this.anim, 0, 0, 0, 0);
    const rw = fk(this.anim.sk, this.anim.sk.restPose());
    this.rest = { toe: Math.min(wpos(rw, B.LToe)[1], wpos(rw, B.RToe)[1]), ankle: Math.min(wpos(rw, B.LFoot)[1], wpos(rw, B.RFoot)[1]) };
  }

  /** Rest heights of the ball-of-foot and ankle joints above the sole. */
  readonly rest: { toe: number; ankle: number };

  /** Run for `secs` with an input (camera looking along +z, so moveY = forward = +z). */
  run(secs: number, inp: Partial<LocoInput> = {}, record = true): this {
    const dt = 1 / 60;
    const steps = Math.round(secs * 60);
    for (let i = 0; i < steps; i++) {
      const input: LocoInput = { moveX: 0, moveY: 0, run: false, ...inp };
      this.loco.step(dt, input, 0, this.ground);
      // A jump press is a single frame.
      if (inp.jumpPressed) inp = { ...inp, jumpPressed: false };
      this.anim.update(dt);
      this.t += dt;
      if (record) this.frames.push(this.snapshot());
    }
    return this;
  }

  snapshot(): Frame {
    const c = this.loco.c, a = this.anim;
    const w = fk(a.sk, a.pose, undefined, a.hipScale);
    const toW = (p: V3): V3 => {
      const r = rotV([0, Math.sin(c.yaw / 2), 0, Math.cos(c.yaw / 2)], 0, p);
      return [r[0] + c.x, r[1] + this.loco.renderY, r[2] + c.z];
    };
    const tl = toW(wpos(w, B.LToe)), tr = toW(wpos(w, B.RToe));
    const al = toW(wpos(w, B.LFoot)), ar = toW(wpos(w, B.RFoot));
    return {
      t: this.t, speed: c.speed, dominant: a.dominant, state: a.state, x: c.x, z: c.z, yaw: c.yaw,
      // Lowest point of each foot: the sole under the ball (toe joint minus its rest height) or under the heel
      // (ankle minus its rest height), so 0 = touching the ground, below 0 = sinking.
      toeL: tl, toeR: tr, lowL: Math.min(tl[1] - this.rest.toe, al[1] - this.rest.ankle), lowR: Math.min(tr[1] - this.rest.toe, ar[1] - this.rest.ankle),
      rot: Float32Array.from(a.pose.rot),
    };
  }

  /** Which clip dominated most frames in [from, to] seconds. */
  dominantIn(from: number, to: number): string {
    const n = new Map<string, number>();
    for (const f of this.frames) if (f.t >= from && f.t <= to) n.set(f.dominant, (n.get(f.dominant) ?? 0) + 1);
    return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  }

  /**
   * Foot slide: for every planted window of each foot (the ball of the foot
   * on the ground for 4+ frames), how far it moved along the ground.
   */
  footSlide(from: number, to: number): { max: number; plants: number; drifts: number[] } {
    const fr = this.frames.filter((f) => f.t >= from && f.t <= to);
    const drifts: number[] = [];
    for (const side of ["L", "R"] as const) {
      const low = fr.map((f) => (side === "L" ? f.lowL : f.lowR));
      const toe = fr.map((f) => (side === "L" ? f.toeL : f.toeR));
      const ground = Math.min(...low);
      let start = -1;
      for (let i = 0; i <= fr.length; i++) {
        const on = i < fr.length && low[i]! < ground + 0.012;
        if (on && start < 0) start = i;
        if (!on && start >= 0) {
          if (i - start >= 4) {
            // Drift of the planted ball of the foot (skip the first and last frame: touch-down and lift-off).
            const a = toe[start + 1]!, b = toe[i - 2]!;
            drifts.push(Math.hypot(b[0] - a[0], b[2] - a[2]));
          }
          start = -1;
        }
      }
    }
    return { max: Math.max(0, ...drifts), plants: drifts.length, drifts };
  }

  /** Biggest change of any bone's rotation between two consecutive frames (degrees). */
  maxPop(from: number, to: number): number {
    const fr = this.frames.filter((f) => f.t >= from && f.t <= to);
    let m = 0;
    for (let i = 1; i < fr.length; i++) {
      const a = fr[i - 1]!.rot, b = fr[i]!.rot;
      for (let k = 0; k < BONE_COUNT; k++) {
        const d = Math.abs(a[k * 4]! * b[k * 4]! + a[k * 4 + 1]! * b[k * 4 + 1]! + a[k * 4 + 2]! * b[k * 4 + 2]! + a[k * 4 + 3]! * b[k * 4 + 3]!);
        m = Math.max(m, (2 * Math.acos(Math.min(1, d)) * 180) / Math.PI);
      }
    }
    return m;
  }
}

/**
 * An NPC moved by someone else (the crowd walker, NavAgent, the director),
 * exactly as Person does it: placed each frame, its motion measured
 * (MotionSense), animated at its LOD rate (LOD0 every frame, LOD1 at 30 Hz).
 */
export class NpcSim {
  readonly anim: Animator;
  readonly sense = new MotionSense();
  x = 0;
  z = 0;
  yaw = 0;
  t = 0;
  private acc = 0;
  readonly frames: Frame[] = [];
  readonly rest: { toe: number; ankle: number };

  constructor(body = "casual", readonly lod: 0 | 1 = 0) {
    this.anim = new Animator(library(), bodySkeleton(body));
    this.anim.setSeed(7);
    this.anim.groundAt = () => 0;
    const rw = fk(this.anim.sk, this.anim.sk.restPose());
    this.rest = { toe: Math.min(wpos(rw, B.LToe)[1], wpos(rw, B.RToe)[1]), ankle: Math.min(wpos(rw, B.LFoot)[1], wpos(rw, B.RFoot)[1]) };
  }

  /** Move with a velocity (m/s) for `secs`, turning to face the way it goes, 60 frames per second. */
  move(secs: number, vel: (t: number) => [number, number]): this {
    const dt = 1 / 60;
    for (let i = 0; i < Math.round(secs * 60); i++) {
      const [vx, vz] = vel(this.t);
      this.x += vx * dt;
      this.z += vz * dt;
      if (Math.hypot(vx, vz) > 0.05) {
        const want = Math.atan2(vx, vz);
        let d = want - this.yaw;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        this.yaw += d * (1 - Math.exp(-9 * dt));
      }
      this.t += dt;
      this.sense.update(this.x, this.z, this.yaw, dt);
      const a = this.anim;
      a.input.speed = this.sense.speed < 0.08 ? 0 : this.sense.speed;
      a.input.turnRate = this.sense.turn;
      a.input.accel = this.sense.accel;
      a.lod = this.lod;
      this.acc += dt;
      const step = this.lod === 1 ? 1 / 30 : 0;
      if (this.acc >= step) {
        a.input.moved = this.sense.take();
        a.update(this.acc);
        this.acc = 0;
      }
      const w = fk(a.sk, a.pose, undefined, a.hipScale);
      const q: [number, number, number, number] = [0, Math.sin(this.yaw / 2), 0, Math.cos(this.yaw / 2)];
      const toW = (p: V3): V3 => {
        const r = rotV(q, 0, p);
        return [r[0] + this.x, r[1], r[2] + this.z];
      };
      const tl = toW(wpos(w, B.LToe)), tr = toW(wpos(w, B.RToe)), al = toW(wpos(w, B.LFoot)), ar = toW(wpos(w, B.RFoot));
      this.frames.push({ t: this.t, speed: this.sense.speed, dominant: a.dominant, state: a.state, x: this.x, z: this.z, yaw: this.yaw, toeL: tl, toeR: tr, lowL: Math.min(tl[1] - this.rest.toe, al[1] - this.rest.ankle), lowR: Math.min(tr[1] - this.rest.toe, ar[1] - this.rest.ankle), rot: Float32Array.from(a.pose.rot) });
    }
    return this;
  }

  footSlide(from: number, to: number): { max: number; plants: number; drifts: number[] } {
    return Sim.prototype.footSlide.call(this as unknown as Sim, from, to);
  }
  dominantIn(from: number, to: number): string {
    return Sim.prototype.dominantIn.call(this as unknown as Sim, from, to);
  }
  maxPop(from: number, to: number): number {
    return Sim.prototype.maxPop.call(this as unknown as Sim, from, to);
  }
}
