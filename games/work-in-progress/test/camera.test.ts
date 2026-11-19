/**
 * Camera feel tests (plan §5.10 camera_clip; owner, 16 Nov: "never stuck in a
 * building or any object; re-orient when you start moving unless you're
 * moving the camera"). The real CameraRig and CollisionWorld, driven by the
 * real player loop (Locomotor + Controller) through a small test town.
 */
import { describe, expect, it } from "vitest";
import { FEEL } from "../src/anim/feel.ts";
import { CameraRig, type CamSolids, type MovingSolid } from "../src/sim/camera.ts";
import { CollisionWorld } from "../src/sim/collide.ts";
import { Controller } from "../src/sim/controller.ts";
import { Locomotor } from "../src/sim/locomotor.ts";

/** A test town: two buildings with a narrow alley, a corridor, a row of trees, a low wall with no height set. */
function town(): CollisionWorld {
  const c = new CollisionWorld();
  c.add({ kind: "box", x: -6, z: 10, hx: 4, hz: 6, rot: 0, h: 9 });
  c.add({ kind: "box", x: 6, z: 10, hx: 4, hz: 6, rot: 0.15, h: 12 });
  // A 2 m wide corridor (indoor-like) further on.
  c.add({ kind: "box", x: -1.6, z: 30, hx: 0.3, hz: 8, rot: 0, h: 3 });
  c.add({ kind: "box", x: 1.6, z: 30, hx: 0.3, hz: 8, rot: 0, h: 3 });
  for (let i = 0; i < 8; i++) c.add({ kind: "circle", x: (i % 2 ? 2.2 : -2.2), z: 42 + i * 3, r: 0.35, h: 6 });
  c.add({ kind: "box", x: 0, z: -4, hx: 6, hz: 0.25, rot: 0 }); // a low wall with no height: counts as 1 m
  return c;
}

const solidsOf = (c: CollisionWorld): CamSolids => ({
  clearance: (ax, ay, az, bx, by, bz, r) => c.clearance(ax, ay, az, bx, by, bz, r),
  inside: (x, y, z, r) => c.inside(x, y, z, r),
  ground: () => 0,
});

function run(opts: { look?: (t: number) => [number, number]; move?: (t: number) => [number, number]; secs: number; startYaw?: number; moving?: (t: number) => MovingSolid[]; at?: [number, number]; worldMove?: boolean }) {
  const col = town();
  const solids = solidsOf(col);
  const loco = new Locomotor(null, opts.at?.[0] ?? 0, 0, opts.at?.[1] ?? 0, 0);
  const g = { height: () => 0, resolve: (x: number, z: number, r: number) => col.resolve(x, z, r) };
  const rig = new CameraRig();
  rig.lookScale = 0.0042;
  rig.yaw = opts.startYaw ?? 0;
  const frames: { t: number; cam: { x: number; y: number; z: number }; pivot: { x: number; y: number; z: number }; yaw: number; inside: boolean; seesPlayer: boolean; moving: MovingSolid[] }[] = [];
  const dt = 1 / 60;
  for (let i = 0; i < opts.secs * 60; i++) {
    const t = i * dt;
    const [mx, my] = opts.move?.(t) ?? [0, 0];
    // worldMove: the stick is read against a fixed world heading (so the test path does not follow the camera).
    loco.step(dt, { moveX: mx, moveY: my, run: false }, opts.worldMove ? 0 : rig.yaw, g);
    const c: Controller = loco.c;
    const [lx, ly] = opts.look?.(t) ?? [0, 0];
    const mv = opts.moving?.(t) ?? [];
    rig.update(dt, { lookDX: lx, lookDY: ly, zoom: 0 }, { x: c.x, y: c.y, z: c.z, moveYaw: c.yaw, speed: c.speed, turnRate: c.turnRate, indoors: false }, solids, mv);
    const p = rig.pos;
    const inMoving = mv.some((m) => Math.hypot(p.x - m.x, p.z - m.z) < m.r + 0.05 && p.y < m.h);
    frames.push({
      t, cam: { ...p }, pivot: { ...rig.pivot }, yaw: rig.yaw,
      inside: col.inside(p.x, p.y, p.z, 0.08) || inMoving,
      // Line of sight from the camera to the player's chest.
      seesPlayer: col.clearance(p.x, p.y, p.z, c.x, c.y + 1.2, c.z, 0.02) > 0.97,
      moving: mv,
    });
  }
  return { frames, loco };
}

describe("camera_clip: the camera never ends up inside anything", () => {
  it("walking through the alley, the corridor and the trees while the camera is swung round", () => {
    const { frames } = run({
      secs: 26,
      move: () => [0, 1],
      // Sweep the camera all the way round, slowly, the whole time (worst case: it keeps backing into walls).
      look: (t) => [Math.sin(t * 0.6) * 9, Math.sin(t * 0.37) * 3],
    });
    const bad = frames.filter((f) => f.inside);
    expect(bad.map((f) => f.t.toFixed(2)).slice(0, 5)).toEqual([]);
    expect(frames.filter((f) => !f.seesPlayer).length).toBeLessThanOrEqual(frames.length * 0.01);
    for (const f of frames) expect(f.cam.y).toBeGreaterThan(0.15);
  });

  it("backed against a wall: the camera pulls in, never through it, and eases back out when clear", () => {
    // In the alley with its left wall right behind (camera looks +x, sits at -x), back into the wall (-x; with the
    // stick read against heading 0, moveX = +1 walks to -x), then walk out of the alley (+z).
    const { frames } = run({ secs: 8, at: [-1.6, 10], startYaw: Math.PI / 2, worldMove: true, move: (t) => (t < 1 ? [1, 0] : t < 3 ? [0, 0] : [0, 1]) });
    expect(frames.some((f) => f.inside)).toBe(false);
    const armAt = (t: number) => {
      const f = frames.find((x) => x.t >= t)!;
      return Math.hypot(f.cam.x - f.pivot.x, f.cam.z - f.pivot.z);
    };
    expect(armAt(2.5)).toBeLessThan(1.5);
    // The swing waits until the player has held the new direction (settle), then eases behind; by 7.4 s the
    // alley corner is behind them and the arm is out again.
    expect(armAt(7.4)).toBeGreaterThan(2.5);
  });

  it("people and vehicles passing between the camera and the player are never entered", () => {
    const { frames } = run({
      secs: 8,
      at: [0, -20],
      move: () => [0, 0],
      moving: (t) => [{ x: -3 + ((t * 1.5) % 6), z: -23.5, r: 0.3, h: 1.8 }, { x: 4 - ((t * 3) % 8), z: -24.5, r: 1.2, h: 1.5 }],
    });
    expect(frames.some((f) => f.inside)).toBe(false);
  });
});

describe("recentre: the camera swings behind when you move, unless you steer it", () => {
  const behind = (f: { yaw: number }, moveYaw: number) => Math.abs(Math.atan2(Math.sin(f.yaw - moveYaw), Math.cos(f.yaw - moveYaw)));

  it("moving with no look input: the camera ends up behind the direction of travel", () => {
    // Camera starts looking +z (yaw 0); the player walks a fixed world direction 90 degrees to the side.
    const { frames, loco } = run({ secs: 5, worldMove: true, move: (t) => (t < 0.5 ? [0, 0] : [1, 0]) });
    const end = frames[frames.length - 1]!;
    expect(behind(end, loco.c.yaw)).toBeLessThan(0.15);
    // Nothing moved the camera before the player moved; nobody had touched the look input, so it swings at once.
    for (const f of frames) if (f.t < 0.5) expect(Math.abs(f.yaw)).toBeLessThan(1e-6);
    expect(FEEL.camera.recentreAfter).toBeGreaterThanOrEqual(1);
  });

  it("standing still never recentres (you can look around)", () => {
    const { frames } = run({ secs: 4, startYaw: 2, move: () => [0, 0] });
    for (const f of frames) expect(f.yaw).toBeCloseTo(2, 5);
  });

  it("any look input cancels the recentre: while the player steers the camera, it goes where they put it", () => {
    const { frames } = run({ secs: 5, worldMove: true, move: () => [1, 0], look: (t) => (t > 1 && t < 4 ? [2, 0] : [0, 0]) });
    // During steering the yaw changes only by the input (constant rate, no pull back).
    const a = frames.find((f) => f.t >= 2)!, b = frames.find((f) => f.t >= 3)!;
    const rate = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw));
    expect(rate).toBeCloseTo(-2 * 0.0042 * 60, 2);
  });

  it("nothing moves until the player has held one direction (a glance or a short sidestep is not a course)", () => {
    const { frames } = run({ secs: 5, worldMove: true, move: (t) => (t < 0.5 ? [0, 0] : t < 1.1 ? [1, 0] : t < 1.7 ? [0, 1] : t < 2.3 ? [-1, 0] : [0, 0]) });
    // Every leg is shorter than the settle time, so the camera never starts a swing.
    for (const f of frames) expect(Math.abs(f.yaw)).toBeLessThan(1e-6);
  });

  it("a sustained direction eases the view behind, smoothly, and stops there", () => {
    const { frames, loco } = run({ secs: 6, worldMove: true, move: (t) => (t < 0.5 ? [0, 0] : [1, 0]) });
    const start = 0.5 + FEEL.camera.settle;
    // Still exactly where it was while the player settles into the direction.
    for (const f of frames) if (f.t < start - 2 / 60) expect(Math.abs(f.yaw)).toBeLessThan(1e-6);
    // Smooth: no frame turns it more than 3 degrees (no snap, no wobble).
    const step = (3 * Math.PI) / 180;
    for (let i = 1; i < frames.length; i++) {
      const d = Math.abs(Math.atan2(Math.sin(frames[i]!.yaw - frames[i - 1]!.yaw), Math.cos(frames[i]!.yaw - frames[i - 1]!.yaw)));
      expect(d).toBeLessThanOrEqual(step);
    }
    // It ends behind the travel direction, and then holds still (no perpetual creep).
    const end = frames[frames.length - 1]!;
    expect(behind(end, loco.c.yaw)).toBeLessThan(0.06);
    const tail = frames.filter((f) => f.t > 4.6);
    expect(Math.max(...tail.map((f) => f.yaw)) - Math.min(...tail.map((f) => f.yaw))).toBeLessThan(1e-4);
  });

  it("a small drift near the centre never twitches the camera (deadzone)", () => {
    const { frames } = run({ secs: 5, worldMove: true, move: () => [0.1763, 1] });
    for (const f of frames) expect(Math.abs(f.yaw)).toBeLessThan(1e-6);
  });
});
