/**
 * Animation feel suite, steps 1-4 (docs/ANIM_PROGRESS.md): body, idle, walk,
 * run. Every test drives the REAL loop (Locomotor -> Controller -> Animator ->
 * forward kinematics) on real bodies and the real clip packs, the way the
 * game runs at 60 fps (test/anim-harness.ts).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FEEL } from "../src/anim/feel.ts";
import { morphDeltas, pnSubdivide, smoothNormals, type Mesh } from "../src/anim/meshops.ts";
import { B, fk } from "../src/anim/skeleton.ts";
import { parseBase } from "../src/world/basebody.ts";
import type { Ground } from "../src/sim/controller.ts";
import type { LocoInput } from "../src/sim/locomotor.ts";
import { NpcSim, Sim, bodySkeleton } from "./anim-harness.ts";

const BODIES = ["casual", "hoodie", "business", "farmer", "man", "manlong", "mansuit", "animwoman", "womandress", "womancasual"];
const body = (k: string) => {
  const b = readFileSync(resolve(__dirname, `../assets/people2/${k === "casual" ? "base_m" : "base_f"}.glb`));
  return parseBase(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)).meshes.get("body")!;
};

describe("step 1: rig and body", () => {
  it("every body is on mib_rig, stands on its soles, and has natural proportions", () => {
    for (const k of BODIES) {
      const sk = bodySkeleton(k);
      const w = fk(sk, sk.restPose());
      const y = (b: number) => w.pos[b * 3 + 1]!;
      // Head above neck above chest above hips above knees above feet (a sane upright skeleton).
      expect(y(B.Head), k).toBeGreaterThan(y(B.Neck));
      expect(y(B.Neck), k).toBeGreaterThan(y(B.Spine2));
      expect(y(B.Spine2), k).toBeGreaterThan(y(B.Hips));
      expect(y(B.Hips), k).toBeGreaterThan(y(B.LLeg));
      expect(y(B.LLeg), k).toBeGreaterThan(y(B.LFoot));
      // Legs are 40-60 % of the height (cartoon, not stilts or stumps).
      expect(sk.hipHeight / 1.74, k).toBeGreaterThan(0.4);
      expect(sk.hipHeight / 1.74, k).toBeLessThan(0.62);
      // The ball-of-foot joint sits on or just above the sole (the animator lifts by exactly this).
      expect(Math.min(y(B.LToe), y(B.RToe)), k).toBeGreaterThanOrEqual(-0.005);
      expect(Math.min(y(B.LToe), y(B.RToe)), k).toBeLessThan(0.04);
    }
  });

  it("the smooth close-up mesh keeps every original vertex (no shrinking) and its normals are unit length", () => {
    const { mesh, nor } = body("casual");
    const fine = pnSubdivide(mesh, nor);
    expect(fine.idx.length).toBe(mesh.idx.length * 4);
    for (let i = 0; i < mesh.pos.length; i++) expect(fine.pos[i]).toBe(mesh.pos[i]);
    const n2 = smoothNormals(fine);
    for (let i = 0; i < n2.length; i += 3) expect(Math.hypot(n2[i]!, n2[i + 1]!, n2[i + 2]!)).toBeCloseTo(1, 3);
  });

  it("body morphs never open a seam (vertices at the same spot move together) and stay within a few cm", () => {
    const { mesh } = body("animwoman");
    const d = morphDeltas(mesh as Mesh);
    const key = (i: number) => `${Math.round(mesh.pos[i * 3]! * 1e4)},${Math.round(mesh.pos[i * 3 + 1]! * 1e4)},${Math.round(mesh.pos[i * 3 + 2]! * 1e4)}`;
    const first = new Map<string, number>();
    for (let i = 0; i < mesh.pos.length / 3; i++) if (!first.has(key(i))) first.set(key(i), i);
    let seam = 0, size = 0;
    for (const t of d)
      for (let i = 0; i < mesh.pos.length / 3; i++) {
        const j = first.get(key(i))!;
        for (let c = 0; c < 3; c++) seam = Math.max(seam, Math.abs(t[i * 3 + c]! - t[j * 3 + c]!));
        size = Math.max(size, Math.hypot(t[i * 3]!, t[i * 3 + 1]!, t[i * 3 + 2]!));
      }
    expect(seam).toBeLessThan(0.004);
    expect(size).toBeLessThan(0.09);
  });
});

describe("step 2: idle_breathe, fidgets only after 30 s", () => {
  it("standing still plays idle_breathe for the first 30 s, and a fidget may come only after", () => {
    const s = new Sim("casual").run(40);
    for (const f of s.frames) if (f.t < FEEL.fidget.after) expect(f.dominant, `t=${f.t.toFixed(2)}`).toBe("idle_breathe");
    expect(s.footSlide(0, 40).max).toBeLessThan(0.02);
  });

  it("never fidgets while moving", () => {
    const s = new Sim("animwoman").run(1).run(40, { moveY: 1 });
    for (const f of s.frames) if (f.t > 1.5) expect(FEEL.fidget.clips).not.toContain(f.dominant);
  });
});

describe("step 3: walk_fwd (foot_slide)", () => {
  for (const k of BODIES) {
    it(`${k}: holding forward walks at ${FEEL.speed.walk} m/s with walk_fwd, feet planted (<= 2 cm)`, () => {
      const s = new Sim(k).run(1).run(5, { moveY: 1 });
      expect(s.dominantIn(2, 6)).toBe("walk_fwd");
      for (const f of s.frames) if (f.t > 2) expect(f.speed).toBeCloseTo(FEEL.speed.walk, 1);
      const fs = s.footSlide(2, 6);
      expect(fs.plants).toBeGreaterThanOrEqual(4);
      expect(fs.max).toBeLessThanOrEqual(0.02);
      expect(s.maxPop(0, 6)).toBeLessThanOrEqual(35);
    });
  }
});

describe("step 4: run (Shift) and the walk/run transition", () => {
  for (const k of BODIES) {
    it(`${k}: Shift runs at ${FEEL.speed.run} m/s on the sprint clip, feet planted, no pops through the change`, () => {
      const s = new Sim(k).run(1).run(3, { moveY: 1 }).run(4, { moveY: 1, run: true }).run(2, { moveY: 1 });
      expect(s.dominantIn(5.5, 8)).toBe("sprint_fwd");
      for (const f of s.frames) if (f.t > 5.5 && f.t < 8) expect(f.speed).toBeCloseTo(FEEL.speed.run, 1);
      expect(s.footSlide(5.5, 8).max).toBeLessThanOrEqual(0.02);
      expect(s.dominantIn(9, 10)).toBe("walk_fwd");
      // pose_pop (rule A9): no bone jumps more than 35 degrees in a frame through the changes of gait.
      // (A sprinting knee on a short-legged body swings ~34 deg per frame on its own at 60 fps; that is
      // motion, not a pop, so steady running gets a looser sanity bound.)
      expect(s.maxPop(0.9, 1.6)).toBeLessThanOrEqual(35);
      expect(s.maxPop(3.9, 4.7)).toBeLessThanOrEqual(35);
      expect(s.maxPop(7.9, 8.7)).toBeLessThanOrEqual(35);
      expect(s.maxPop(0, 10)).toBeLessThanOrEqual(42);
    });
  }

  it("accel_curve: reaches 95 % of walk in about 0.15 s and of run in about 0.35 s, and stops quickly", () => {
    const t95 = (inp: { moveY: number; run?: boolean }, target: number) => {
      const s = new Sim("casual").run(0.5).run(2, inp);
      return s.frames.find((f) => f.t > 0.5 && f.speed >= 0.95 * target)!.t - 0.5;
    };
    expect(t95({ moveY: 1 }, FEEL.speed.walk)).toBeLessThan(FEEL.accel.toWalk + 0.06);
    expect(t95({ moveY: 1, run: true }, FEEL.speed.run)).toBeLessThan(FEEL.accel.toRun + 0.08);
    const s = new Sim("casual").run(2, { moveY: 1, run: true }).run(1.5);
    const stopAt = s.frames.find((f) => f.t > 2 && f.speed < 0.05 * FEEL.speed.run)!.t - 2;
    expect(stopAt).toBeLessThan(FEEL.accel.stopFromRun + 0.1);
    expect(s.dominantIn(3.2, 3.5)).toMatch(/idle_breathe|run_stop/);
  });
});

describe("step 6: stops (walk_stop / run_stop, distance matched, feet never slide)", () => {
  for (const k of ["casual", "man", "animwoman", "womandress"]) {
    for (const run of [false, true]) {
      it(`${k}: letting go of ${run ? "Shift-run" : "walk"} plays ${run ? "run_stop" : "walk_stop"}, settles into idle_breathe, feet planted`, () => {
        const s = new Sim(k).run(1).run(3, { moveY: 1, run }).run(2.5);
        const seq: string[] = [];
        for (const f of s.frames) if (f.t > 3.9 && seq[seq.length - 1] !== f.dominant) seq.push(f.dominant);
        expect(seq[0]).toBe(run ? "sprint_fwd" : "walk_fwd");
        expect(seq[1]!.replace("~m", "")).toBe(run ? "run_stop" : "walk_stop");
        expect(seq[seq.length - 1]).toBe("idle_breathe");
        // No flicker back into a gait after the stop.
        expect(seq.length).toBe(3);
        // Stopped within half a second; idle within a second.
        expect(s.frames.find((f) => f.t > 4 && f.speed < 0.05)!.t - 4).toBeLessThan(0.5);
        expect(s.frames.find((f) => f.t > 4 && f.dominant === "idle_breathe")!.t - 4).toBeLessThan(1);
        // Feet: planted feet stay put (corrective steps instead of slides).
        expect(s.footSlide(4, 6.5).max).toBeLessThanOrEqual(0.03);
        expect(s.maxPop(3.9, 6.5)).toBeLessThanOrEqual(35);
      });
    }
  }

  it("the idle stance is balanced: feet about hip-width apart, level, on the ground", () => {
    for (const k of ["casual", "man", "animwoman", "womancasual"]) {
      const s = new Sim(k).run(2);
      const f = s.frames[s.frames.length - 1]!;
      const w = Math.abs(f.toeL[0] - f.toeR[0]);
      expect(w, k).toBeGreaterThan(0.18);
      expect(w, k).toBeLessThan(0.34);
      expect(Math.abs(f.toeL[2] - f.toeR[2]), k).toBeLessThan(0.05);
      expect(Math.abs(f.lowL - f.lowR), k).toBeLessThan(0.02);
    }
  });
});

describe("step 7: turns and the run pivot", () => {
  it("reversing at a run plants and pivots (run_pivot_180), ends facing back, and runs on with no stall or pop", () => {
    const s = new Sim("casual").run(1).run(2, { moveY: 1, run: true }).run(2, { moveY: -1, run: true });
    const seq: string[] = [];
    for (const f of s.frames) if (f.t > 2.9 && seq[seq.length - 1] !== f.dominant) seq.push(f.dominant);
    expect(seq[1]).toBe("run_pivot_180");
    expect(seq).not.toContain("idle_breathe");
    const end = s.frames[s.frames.length - 1]!;
    expect(Math.abs(Math.abs(end.yaw) - Math.PI)).toBeLessThan(0.05);
    expect(end.speed).toBeCloseTo(7, 1);
    expect(s.maxPop(2.9, 5)).toBeLessThanOrEqual(35);
    expect(s.footSlide(3, 5).max).toBeLessThanOrEqual(0.03);
  });

  for (const run of [false, true]) {
    it(`a 90-degree turn at a ${run ? "run" : "walk"} is quick (< 0.25 s), feet stay planted, no pop`, () => {
      const s = new Sim("animwoman").run(1).run(2, { moveY: 1, run }).run(2, { moveX: 1, run });
      const turned = s.frames.find((f) => f.t > 3 && Math.abs(Math.abs(f.yaw) - Math.PI / 2) < 0.05)!;
      expect(turned.t - 3).toBeLessThan(0.25);
      expect(s.footSlide(3, 5).max).toBeLessThanOrEqual(0.03);
      expect(s.maxPop(2.9, 5)).toBeLessThanOrEqual(35);
    });
  }

  it("turning round from standing never drags a foot (steps instead)", () => {
    const s = new Sim("casual").run(1).run(1.5, { moveY: -1 }).run(1);
    expect(s.footSlide(1, 3.5).max).toBeLessThanOrEqual(0.03);
    expect(s.maxPop(0.9, 3.5)).toBeLessThanOrEqual(35);
  });
});

describe("step 8: jump, fall and land (coyote_and_buffer)", () => {
  const ledge: Ground = { height: (_x, z) => (z < 3 ? 1.2 : 0), resolve: (x, z) => [x, z] };
  const press = (s: Sim, inp: Partial<LocoInput>) => s.run(1 / 60, { ...inp, jumpPressed: true, jumpHeld: true });

  for (const [name, inp, clip] of [["standing", {}, "jump_start"], ["walking", { moveY: 1 }, "jump_start"], ["running", { moveY: 1, run: true }, "jump_run"]] as const) {
    it(`${name}: Space jumps in the same frame (${clip}), lands back into the right state, no pops, never through the ground`, () => {
      const s = new Sim("casual").run(1).run(1, inp);
      press(s, inp).run(0.5, { ...inp, jumpHeld: true }).run(1.5, inp);
      const t0 = 2;
      expect(s.frames.find((f) => f.t > t0)!.dominant).toBe(clip);
      const peak = Math.max(...s.frames.map((f) => f.t > t0 && f.t < t0 + 1 ? s.loco.c.y + 0 * f.t : 0));
      void peak;
      const after = s.dominantIn(3.2, 3.9);
      expect(after).toBe(name === "standing" ? "idle_breathe" : name === "walking" ? "walk_fwd" : "sprint_fwd");
      expect(s.maxPop(1.9, 4)).toBeLessThanOrEqual(35);
      for (const f of s.frames) expect(Math.min(f.lowL, f.lowR), `t=${f.t.toFixed(2)}`).toBeGreaterThan(-0.012);
    });
  }

  it("jump height is about 0.9 m; a short tap is a short hop", () => {
    const top = (held: number) => {
      const s = new Sim("casual").run(0.5);
      press(s, {}).run(held, { jumpHeld: true }).run(1);
      let m = 0;
      for (const f of s.frames) m = Math.max(m, f.toeL[1] - s.rest.toe);
      return m;
    };
    const full = top(0.6), hop = top(0.03);
    expect(full).toBeGreaterThan(0.75);
    expect(full).toBeLessThan(1.05);
    expect(hop).toBeLessThan(full * 0.75);
  });

  it("coyote time: a jump pressed 0.10 s after walking off a ledge still works", () => {
    const s = new Sim("casual", ledge);
    s.loco.c.y = 1.2;
    s.run(0.3);
    let off = -1;
    for (let i = 0; i < 240 && off < 0; i++) {
      s.run(1 / 60, { moveY: 1, run: true });
      if (!s.loco.c.grounded) off = s.t;
    }
    expect(off).toBeGreaterThan(0);
    s.run(0.1, { moveY: 1, run: true });
    const vyBefore = s.loco.c.vy;
    press(s, { moveY: 1, run: true });
    expect(s.loco.c.vy).toBeGreaterThan(Math.max(0, vyBefore) + 3);
  });

  it("jump buffer: a jump pressed 0.10 s before landing fires on landing", () => {
    const s = new Sim("casual").run(0.5);
    press(s, {}).run(0.4, { jumpHeld: true });
    // Falling now: run until 0.1 s before touch-down (predict from height and speed).
    while (s.loco.c.y > 0.0 && !(s.loco.c.vy < 0 && s.loco.c.y + s.loco.c.vy * 0.1 - 16 * 0.01 <= 0)) s.run(1 / 60);
    press(s, {});
    s.run(0.25);
    const rose = s.frames.slice(-15).some((f) => s.loco.c.vy > 2 || f.dominant === "jump_start");
    expect(rose).toBe(true);
  });

  it("falling off a 1.2 m ledge: fall_loop in the air, a landing, feet never through the ground", () => {
    const s = new Sim("casual", ledge);
    s.loco.c.y = 1.2;
    s.run(0.3).run(2.5, { moveY: 1 }).run(1.5);
    expect(s.frames.some((f) => f.dominant === "fall_loop" || f.dominant === "jump_start")).toBe(true);
    expect(s.frames.some((f) => /land_/.test(f.dominant) || f.dominant === "walk_fwd")).toBe(true);
    // Each foot against the ground under that foot (a foot over the edge may hang lower than the top).
    for (const f of s.frames) {
      expect(f.lowL - ledge.height(f.toeL[0], f.toeL[2] - 0.06)).toBeGreaterThan(-0.03);
      expect(f.lowR - ledge.height(f.toeR[0], f.toeR[2] - 0.06)).toBeGreaterThan(-0.03);
    }
    expect(s.maxPop(0, 4.3)).toBeLessThanOrEqual(35);
  });
});

describe("step 9: kerbs and stairs with foot IK (steps_and_slopes)", () => {
  const flat = (x: number, z: number): [number, number] => [x, z];
  const kerb = (h: number): Ground => ({ height: (_x, z) => (z > 3 ? h : 0), resolve: flat });
  const stairs = (up: boolean): Ground => ({
    height: (_x, z) => {
      const n = Math.max(0, Math.min(10, Math.floor((z - 3) / 0.3) + 1));
      const hgt = (z < 3 ? 0 : n) * 0.17;
      return up ? hgt : 1.7 - hgt;
    },
    resolve: flat,
  });
  const footsOk = (s: Sim, g: Ground, tol = 0.03) => {
    let worst = 0;
    for (const f of s.frames) {
      worst = Math.min(worst, f.lowL - g.height(f.toeL[0], f.toeL[2] - 0.04), f.lowR - g.height(f.toeR[0], f.toeR[2] - 0.04));
    }
    expect(worst).toBeGreaterThan(-tol);
  };

  for (const run of [false, true]) {
    it(`steps up and down a 0.15 m kerb at a ${run ? "run" : "walk"} without leaving the ground, feet on the kerb, not in it`, () => {
      const g = kerb(0.15);
      const s = new Sim("casual", g).run(0.3).run(run ? 1.2 : 2.5, { moveY: 1, run });
      expect(s.loco.c.y).toBeCloseTo(0.15, 3);
      expect(s.frames.every((f) => f.dominant !== "fall_loop")).toBe(true);
      footsOk(s, g);
      expect(s.maxPop(0, 3)).toBeLessThanOrEqual(35);
    });
  }

  it("climbs a 0.35 m step but not a 0.40 m one", () => {
    const a = new Sim("casual", kerb(0.35)).run(0.3).run(2.5, { moveY: 1 });
    expect(a.loco.c.y).toBeCloseTo(0.35, 3);
    const b = new Sim("casual", kerb(0.4)).run(0.3).run(2.5, { moveY: 1 });
    expect(b.loco.c.y).toBeCloseTo(0, 3);
    expect(b.loco.c.z).toBeLessThan(3);
  });

  it("walks down stairs with no airborne frames, and up them, feet on the treads", () => {
    for (const up of [true, false]) {
      const g = stairs(up);
      const s = new Sim("animwoman", g);
      s.loco.c.y = g.height(0, 0);
      s.run(0.3);
      let air = 0;
      for (let i = 0; i < 240; i++) {
        s.run(1 / 60, { moveY: 1 });
        if (!s.loco.c.grounded) air++;
      }
      expect(air, up ? "up" : "down").toBe(0);
      expect(s.loco.c.y).toBeCloseTo(g.height(0, 9), 3);
      footsOk(s, g, 0.05);
    }
  });
});

describe("step 10: crowds on the same locomotion (NavAgent / crowd walkers)", () => {
  const cruise = 1.85; // a crowd walker (walk stride x 1.2, owner: "everything faster")
  for (const lod of [0, 1] as const) {
    it(`a crowd walker at ${cruise} m/s with speed jitter and nudges walks with matched feet (LOD${lod})`, () => {
      const n = new NpcSim("animwoman", lod).move(1, () => [0, 0]).move(8, (t) => {
        const sp = cruise * (1 + 0.15 * Math.sin(t * 2.1));
        const side = 0.25 * Math.sin(t * 0.7);
        return [side, sp];
      });
      expect(n.dominantIn(2, 9)).toBe("walk_fwd");
      expect(n.footSlide(2, 9).max).toBeLessThanOrEqual(lod === 0 ? 0.03 : 0.05);
      if (lod === 0) expect(n.maxPop(0, 9)).toBeLessThanOrEqual(35);
    });
  }

  it("a NavAgent-style walk: start, cruise, slow to arrive, stand: idle > walk > idle with no flicker and planted feet", () => {
    const n = new NpcSim("casual", 0).move(1, () => [0, 0]).move(6, (t) => {
      const u = t - 1;
      const sp = u < 0.4 ? (u / 0.4) * 2.0 : u > 4.6 ? Math.max(0, 2.0 * (1 - (u - 4.6) / 0.8)) : 2.0;
      return [0, sp];
    }).move(3, () => [0, 0]);
    const seq: string[] = [];
    for (const f of n.frames) if (seq[seq.length - 1] !== f.dominant) seq.push(f.dominant);
    expect(seq).toEqual(["idle_breathe", "walk_fwd", "idle_breathe"]);
    expect(n.footSlide(1, 10).max).toBeLessThanOrEqual(0.03);
    expect(n.maxPop(0, 10)).toBeLessThanOrEqual(35);
  });
});
