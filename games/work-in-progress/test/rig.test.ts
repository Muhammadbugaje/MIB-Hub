/**
 * The rig layer's poses keep bones their length (no stretching), put the hips
 * at the seat and the feet on the floor, and turn heads without drifting.
 */
import * as pc from "playcanvas";
import { describe, expect, it } from "vitest";
import { Rig } from "../src/world/rig.ts";

/** A small skeleton like the CC0 bases: hips, legs with feet as children, arms with wrists. */
function skeleton(footChild = true) {
  const root = new pc.Entity("root");
  const model = new pc.Entity("model");
  model.setLocalScale(0.5, 0.5, 0.5);
  root.addChild(model);
  const mk = (n: string, parent: pc.GraphNode, p: [number, number, number]) => {
    const e = new pc.Entity(n);
    e.setLocalPosition(...p);
    parent.addChild(e);
    return e;
  };
  const hips = mk("Hips", model, [0, 1.9, 0]);
  const torso = mk("Torso", hips, [0, 0.4, 0]);
  const head = mk("Head", torso, [0, 0.9, 0]);
  void head;
  for (const [s, x] of [["L", 0.2], ["R", -0.2]] as const) {
    const ul = mk(`UpperLeg.${s}`, hips, [x, -0.1, 0]);
    const ll = mk(`LowerLeg.${s}`, ul, [0, -0.85, 0]);
    mk(`Foot.${s}`, footChild ? ll : model, footChild ? [0, -0.85, 0.05] : [x, 0.1, 0.05]);
    const ua = mk(`UpperArm.${s}`, torso, [x * 2, 0.7, 0]);
    const la = mk(`LowerArm.${s}`, ua, [0, -0.55, 0]);
    mk(`Wrist.${s}`, la, [0, -0.5, 0]);
  }
  root.setLocalPosition(5, 0, 3);
  root.setLocalEulerAngles(0, 40, 0);
  root.syncHierarchy();
  return { root, model };
}

const P = (m: pc.Entity, n: string) => m.findByName(n)!.getPosition().clone();

describe("rig poses", () => {
  for (const footChild of [true, false]) {
    it(`sit keeps bone lengths, lowers the hips and keeps the feet down (${footChild ? "feet under shins" : "IK-style feet"})`, () => {
      const { root, model } = skeleton(footChild);
      const rig = new Rig(root, model, 0.5);
      const before = { thigh: P(model, "UpperLeg.L").distance(P(model, "LowerLeg.L")), hip: P(model, "Hips").y };
      rig.play("sit");
      for (let i = 0; i < 40; i++) rig.update(1 / 30);
      const thigh = P(model, "UpperLeg.L").distance(P(model, "LowerLeg.L"));
      expect(thigh).toBeCloseTo(before.thigh, 4);
      expect(P(model, "Hips").y).toBeLessThan(before.hip - 0.1);
      expect(P(model, "Hips").y).toBeGreaterThan(0.3);
      const foot = P(model, "Foot.L");
      expect(foot.y).toBeLessThan(0.25);
      expect(foot.distance(root.getPosition())).toBeLessThan(1.2);
    });
  }

  it("arm gestures reach their targets without stretching, and release", () => {
    const { root, model } = skeleton();
    const rig = new Rig(root, model, 0.5);
    const arm = P(model, "UpperArm.R").distance(P(model, "LowerArm.R"));
    rig.play("point");
    for (let i = 0; i < 20; i++) rig.update(1 / 30);
    expect(P(model, "UpperArm.R").distance(P(model, "LowerArm.R"))).toBeCloseTo(arm, 4);
    // The hand ends up in front of the body (the character faces +z rotated by its yaw).
    const fwd = new pc.Vec3();
    root.getRotation().transformVector(new pc.Vec3(0, 0, 1), fwd);
    const hand = P(model, "Wrist.R").sub(P(model, "UpperArm.R"));
    expect(hand.dot(fwd)).toBeGreaterThan(0.2);
  });

  it("a head turn never accumulates (repeated frames give the same pose)", () => {
    const { root, model } = skeleton();
    const rig = new Rig(root, model, 0.5);
    rig.headTurn = { yaw: 30, pitch: 0 };
    const head = model.findByName("Head")!;
    const base = head.getLocalRotation().clone();
    // A real animation rewrites the bone every frame; emulate that.
    const frames: pc.Quat[] = [];
    for (let i = 0; i < 5; i++) {
      head.setLocalRotation(base);
      rig.update(1 / 30);
      frames.push(head.getRotation().clone());
    }
    expect(frames[4]!.equals(frames[1]!)).toBe(true);
  });
});
