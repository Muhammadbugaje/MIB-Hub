/**
 * Garment seams are cut through the body's own triangles, so a cut can only be
 * as fine as the mesh. Whole-triangle cuts left a stair-stepped neckline, sleeve
 * ends and hems that read as torn cloth (the owner's "torn shirt"). These tests
 * pin the cut line down: it must sit on the intended neck ring, sleeve plane and
 * waistband within a few millimetres, and the skin weights of the new seam
 * vertices must stay valid.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { B, BONE_COUNT, Skeleton, fk, wpos } from "../src/anim/skeleton.ts";
import { makeGarments, parseBase, STYLES, type BaseGeometry } from "../src/world/basebody.ts";

const root = resolve(__dirname, "../assets/people2");
/** Palette slot from a garment vertex's U (the clothes mesh packs 16 flat colours). */
const slotOf = (u: number) => Math.round(u * 16 - 0.5);

function loadBase(key: string): { geo: BaseGeometry; sk: Skeleton } {
  const index = JSON.parse(readFileSync(resolve(root, "index.json"), "utf8")) as Record<string, { file: string; hipHeight: number }>;
  const info = index[key]!;
  const buf = readFileSync(resolve(root, info.file));
  const geo = parseBase(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
  return { geo, sk: new Skeleton(geo.rest.rot, geo.rest.pos, info.hipHeight) };
}

describe.each(["base_m", "base_f"])("garments on %s", (key) => {
  const { geo, sk } = loadBase(key);
  const body = geo.meshes.get("body")!;
  const w = fk(sk, sk.restPose());
  const p = (b: number) => wpos(w, b);
  const neckY = p(B.Neck)[1], neckZ = p(B.Neck)[2];
  const shoulderX = Math.abs(p(B.LArm)[0]), armY = p(B.LArm)[1];
  const hipY = p(B.Hips)[1];
  const sleeveEnd = shoulderX + 0.13;
  const g = makeGarments(body, sk, STYLES.casual!);
  const pos = g.clothes.pos, uv = g.clothes.uv;
  const topV: number[] = [], bottomV: number[] = [];
  for (let v = 0; v < pos.length / 3; v++) {
    const s = slotOf(uv[v * 2]!);
    if (s === STYLES.casual!.topSlot) topV.push(v);
    if (s === STYLES.casual!.bottomSlot) bottomV.push(v);
  }

  it("never dresses the head: the face stays skin, not shirt cloth", () => {
    const tops = topV.map((v) => pos[v * 3 + 1]!);
    expect(tops.length).toBeGreaterThan(10);
    // The collar cap, plus the 9 mm cloth offset along the surface normal.
    expect(Math.max(...tops)).toBeLessThan(neckY + 0.03);
  });

  it("the neckline sits on the crew-neck ring, not on whole body triangles", () => {
    // Above the collar line, cloth must stay outside the 7.8 cm neck ring (or overlap it by < 4 mm);
    // and it must actually reach the ring, or the shirt has been cut in too far.
    const near = topV.map((v) => Math.hypot(pos[v * 3]!, pos[v * 3 + 2]! - neckZ)).filter((r) => r < 0.13);
    const above = topV.filter((v) => pos[v * 3 + 1]! > neckY - 0.005).map((v) => Math.hypot(pos[v * 3]!, pos[v * 3 + 2]! - neckZ));
    expect(above.length).toBeGreaterThan(10);
    expect(Math.min(...above)).toBeGreaterThanOrEqual(0.074);
    // The cloth is pushed 9 mm off the skin, so the ring sits just outside 7.8 cm.
    expect(Math.min(...near)).toBeLessThanOrEqual(0.092);
  });

  it("the sleeve ends on the sleeve plane, not on whole body triangles", () => {
    const arm = topV.filter((v) => pos[v * 3 + 1]! > armY - 0.2 && Math.abs(pos[v * 3]!) > shoulderX + 0.1).map((v) => Math.abs(pos[v * 3]!));
    expect(arm.length).toBeGreaterThan(10);
    expect(Math.max(...arm)).toBeLessThanOrEqual(sleeveEnd + 0.01);
    expect(Math.max(...arm)).toBeGreaterThanOrEqual(sleeveEnd - 0.005);
  });

  it("the shirt tucks into the trousers at one even waistband (no ring of skin between them)", () => {
    const waist = hipY + 0.05;
    const at = (vs: number[]) => vs.filter((v) => Math.abs(pos[v * 3 + 1]! - waist) < 0.02 && Math.abs(pos[v * 3]!) < 0.25).map((v) => pos[v * 3 + 1]!);
    const shirt = at(topV), trousers = at(bottomV);
    expect(shirt.length && trousers.length).toBeTruthy();
    // Each garment crosses the waistline by a few millimetres, so they overlap instead of leaving a gap.
    expect(Math.min(...shirt)).toBeLessThan(waist + 0.005);
    expect(Math.max(...trousers)).toBeGreaterThan(waist - 0.005);
    expect(Math.min(...shirt)).toBeGreaterThan(waist - 0.02);
    expect(Math.max(...trousers)).toBeLessThan(waist + 0.02);
  });

  it("keeps every seam vertex rigid and inside the palette and the rig", () => {
    expect(g.clothes.idx.length).toBeGreaterThan(3000);
    expect(g.clothes.idx.length % 3).toBe(0);
    // One pass, then one assertion per invariant: a per-vertex `expect` over the whole
    // garment mesh costs seconds of matcher overhead and made this test time out.
    const bad: string[] = [];
    const count = g.clothes.weights.length / 4;
    for (let v = 0; v < count; v++) {
      const sum = g.clothes.weights[v * 4]! + g.clothes.weights[v * 4 + 1]! + g.clothes.weights[v * 4 + 2]! + g.clothes.weights[v * 4 + 3]!;
      if (Math.abs(sum - 1) > 1e-4) bad.push(`vertex ${v}: weights sum to ${sum}`);
      for (let j = 0; j < 4; j++) {
        const joint = g.clothes.joints[v * 4 + j];
        const weight = g.clothes.weights[v * 4 + j]!;
        if (joint === undefined || joint < 0 || joint >= BONE_COUNT) bad.push(`vertex ${v}: joint ${joint} outside the rig`);
        if (!Number.isFinite(weight)) bad.push(`vertex ${v}: weight is not finite`);
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });
});
