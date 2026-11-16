/**
 * Mesh operations shared by the asset tools and the game (pure maths):
 *   - smoothNormals: welded, area-weighted normals (no flat facets, no
 *     shadow-acne "sand" on characters);
 *   - pnSubdivide: interpolating curved-PN subdivision for the close-up LOD
 *     (original vertices stay put, so bodies never shrink);
 *   - morphDeltas: body shape targets (heavy, lean, fit; plan §3.5) along
 *     welded normals, mixed by skin weights per body region.
 * The game builds the close-up LOD and the morphs at load time from the
 * base mesh, which keeps the downloaded character files small.
 */
import { sub, norm, type V3 } from "./math.ts";
import { MIB_BONES } from "./skeleton.ts";

export interface Mesh {
  pos: number[]; // xyz
  uv: number[];
  joints: number[]; // 4 per vertex (mib indices)
  weights: number[];
  idx: number[];
}

/** Weld by position; area-weighted smooth normals with a crease limit (sharp > 75 degrees stays sharp). */
export function smoothNormals(m: Mesh, creaseDeg = 75): number[] {
  if (creaseDeg >= 180) creaseDeg = 181;
  const n = m.pos.length / 3;
  const key = (i: number) => `${Math.round(m.pos[i * 3]! * 1e4)},${Math.round(m.pos[i * 3 + 1]! * 1e4)},${Math.round(m.pos[i * 3 + 2]! * 1e4)}`;
  const group = new Map<string, number[]>();
  for (let i = 0; i < n; i++) (group.get(key(i)) ?? group.set(key(i), []).get(key(i))!).push(i);
  const faceN: V3[] = [];
  const cornerFaces: number[][] = Array.from({ length: n }, () => []);
  for (let f = 0; f < m.idx.length / 3; f++) {
    const [a, b, c] = [m.idx[f * 3]!, m.idx[f * 3 + 1]!, m.idx[f * 3 + 2]!];
    const pa: V3 = [m.pos[a * 3]!, m.pos[a * 3 + 1]!, m.pos[a * 3 + 2]!];
    const e1 = sub([m.pos[b * 3]!, m.pos[b * 3 + 1]!, m.pos[b * 3 + 2]!], pa), e2 = sub([m.pos[c * 3]!, m.pos[c * 3 + 1]!, m.pos[c * 3 + 2]!], pa);
    faceN.push([e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]); // area-weighted
    cornerFaces[a]!.push(f);
    cornerFaces[b]!.push(f);
    cornerFaces[c]!.push(f);
  }
  const cos = Math.cos((creaseDeg * Math.PI) / 180);
  const out = new Array<number>(n * 3).fill(0);
  for (const ids of group.values()) {
    const faces = ids.flatMap((i) => cornerFaces[i]!);
    for (const i of ids) {
      const own = cornerFaces[i]!.map((f) => norm(faceN[f]!));
      const acc: V3 = [0, 0, 0];
      for (const f of faces) {
        const fn = norm(faceN[f]!);
        if (own.length && !own.some((o) => o[0] * fn[0] + o[1] * fn[1] + o[2] * fn[2] > cos)) continue;
        acc[0] += faceN[f]![0];
        acc[1] += faceN[f]![1];
        acc[2] += faceN[f]![2];
      }
      const r = norm(acc);
      out[i * 3] = r[0];
      out[i * 3 + 1] = r[1];
      out[i * 3 + 2] = r[2];
    }
  }
  return out;
}

/**
 * Interpolating subdivision (curved PN triangles, Vlachos et al. 2001): every
 * original vertex stays exactly where it is (no shrinking: Loop subdivision
 * made the bodies look too thin), and each edge gets a new point on the
 * cubic curve its two end normals describe, so silhouettes round off.
 * Normals are the welded smooth normals, so seams between palette slots
 * stay closed. Skin weights of new points are the edge's average.
 */
export function pnSubdivide(m: Mesh, nor: number[]): Mesh {
  const out: Mesh = { pos: [...m.pos], uv: [...m.uv], joints: [...m.joints], weights: [...m.weights], idx: [] };
  const key = (i: number) => `${Math.round(m.pos[i * 3]! * 1e4)},${Math.round(m.pos[i * 3 + 1]! * 1e4)},${Math.round(m.pos[i * 3 + 2]! * 1e4)}`;
  // Edge points are shared by position (both sides of a seam get the same point) and split by uv.
  const pointCache = new Map<string, { p: V3; s: Map<number, number> }>();
  const vCache = new Map<string, number>();
  const edgePoint = (a: number, b: number): { p: V3; s: Map<number, number> } => {
    const ka = key(a), kb = key(b);
    const k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
    let e = pointCache.get(k);
    if (e) return e;
    const P1: V3 = [m.pos[a * 3]!, m.pos[a * 3 + 1]!, m.pos[a * 3 + 2]!], P2: V3 = [m.pos[b * 3]!, m.pos[b * 3 + 1]!, m.pos[b * 3 + 2]!];
    const N1: V3 = [nor[a * 3]!, nor[a * 3 + 1]!, nor[a * 3 + 2]!], N2: V3 = [nor[b * 3]!, nor[b * 3 + 1]!, nor[b * 3 + 2]!];
    const d = sub(P2, P1);
    const w12 = d[0] * N1[0] + d[1] * N1[1] + d[2] * N1[2];
    const w21 = -(d[0] * N2[0] + d[1] * N2[1] + d[2] * N2[2]);
    const b1: V3 = [(2 * P1[0] + P2[0] - w12 * N1[0]) / 3, (2 * P1[1] + P2[1] - w12 * N1[1]) / 3, (2 * P1[2] + P2[2] - w12 * N1[2]) / 3];
    const b2: V3 = [(2 * P2[0] + P1[0] - w21 * N2[0]) / 3, (2 * P2[1] + P1[1] - w21 * N2[1]) / 3, (2 * P2[2] + P1[2] - w21 * N2[2]) / 3];
    const p: V3 = [(P1[0] + 3 * b1[0] + 3 * b2[0] + P2[0]) / 8, (P1[1] + 3 * b1[1] + 3 * b2[1] + P2[1]) / 8, (P1[2] + 3 * b1[2] + 3 * b2[2] + P2[2]) / 8];
    // Very long or folded edges: limit the bulge to a fraction of the edge length (no balloons).
    const mid: V3 = [(P1[0] + P2[0]) / 2, (P1[1] + P2[1]) / 2, (P1[2] + P2[2]) / 2];
    const off = sub(p, mid), ol = Math.hypot(...off), el = Math.hypot(...d);
    const lim = el * 0.12;
    const q: V3 = ol > lim ? [mid[0] + (off[0] / ol) * lim, mid[1] + (off[1] / ol) * lim, mid[2] + (off[2] / ol) * lim] : p;
    const s = new Map<number, number>();
    for (const v of [a, b]) for (let k2 = 0; k2 < 4; k2++) {
      const wt = m.weights[v * 4 + k2]!;
      if (wt > 0) s.set(m.joints[v * 4 + k2]!, (s.get(m.joints[v * 4 + k2]!) ?? 0) + wt * 0.5);
    }
    e = { p: q, s };
    pointCache.set(k, e);
    return e;
  };
  const vert = (a: number, b: number): number => {
    const e = edgePoint(a, b);
    const u = (m.uv[a * 2]! + m.uv[b * 2]!) / 2, v = (m.uv[a * 2 + 1]! + m.uv[b * 2 + 1]!) / 2;
    const k = `${e.p.map((x) => x.toFixed(5)).join(",")}|${u.toFixed(5)},${v.toFixed(5)}`;
    let i = vCache.get(k);
    if (i !== undefined) return i;
    i = out.pos.length / 3;
    vCache.set(k, i);
    out.pos.push(...e.p);
    out.uv.push(u, v);
    const top = [...e.s].sort((x, y) => y[1] - x[1]).slice(0, 4);
    const tot = top.reduce((acc, x) => acc + x[1], 0) || 1;
    for (let j = 0; j < 4; j++) {
      out.joints.push(top[j]?.[0] ?? 0);
      out.weights.push((top[j]?.[1] ?? 0) / tot);
    }
    return i;
  };
  for (let f = 0; f < m.idx.length / 3; f++) {
    const a = m.idx[f * 3]!, b = m.idx[f * 3 + 1]!, c = m.idx[f * 3 + 2]!;
    const ab = vert(a, b), bc = vert(b, c), ca = vert(c, a);
    out.idx.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
  }
  return out;
}

/**
 * Body morph targets (plan §3.5: heavy, lean, fit), as position deltas along
 * the welded smooth normal (so seams between colour slots never open).
 * Amounts are per bone region in metres at weight 1; a vertex mixes its
 * bones' amounts by its skin weights, so the shape changes smoothly from
 * belly to chest to arms. Clothes are part of the same surface and follow.
 */
export const MORPHS: Record<string, Partial<Record<string, number>> & { belly?: number }> = {
  heavy: { Hips: 0.042, Spine: 0.048, Spine1: 0.036, Spine2: 0.022, Neck: 0.014, Head: 0.004, Shoulder: 0.016, Arm: 0.02, ForeArm: 0.011, Hand: 0.002, UpLeg: 0.032, Leg: 0.014, belly: 0.035 },
  lean: { Hips: -0.016, Spine: -0.022, Spine1: -0.016, Spine2: -0.01, Neck: -0.004, Shoulder: -0.006, Arm: -0.008, ForeArm: -0.004, UpLeg: -0.012, Leg: -0.006, belly: -0.012 },
  fit: { Hips: 0.004, Spine: -0.01, Spine1: 0.01, Spine2: 0.022, Neck: 0.01, Shoulder: 0.022, Arm: 0.02, ForeArm: 0.012, UpLeg: 0.014, Leg: 0.01, belly: -0.012 },
};
export const MORPH_NAMES = Object.keys(MORPHS);

export function morphDeltas(m: Mesh): number[][] {
  const n = m.pos.length / 3;
  // Welded normals (crease 180: one normal per position).
  const nor = smoothNormals(m, 180);
  const region = (b: number): string => {
    const name = MIB_BONES[b]![0].replace(/^(Left|Right)/, "");
    if (/^Hand/.test(name)) return "Hand";
    return name;
  };
  return MORPH_NAMES.map((k) => {
    const amt = MORPHS[k]!;
    const d = new Array<number>(n * 3).fill(0);
    for (let i = 0; i < n; i++) {
      let a = 0;
      for (let j = 0; j < 4; j++) {
        const w = m.weights[i * 4 + j]!;
        if (w <= 0) continue;
        const r = region(m.joints[i * 4 + j]!);
        let v = amt[r] ?? 0;
        // The belly pushes forward on the lower spine.
        if ((r === "Spine" || r === "Spine1") && nor[i * 3 + 2]! > 0) v += (amt.belly ?? 0) * nor[i * 3 + 2]! * (r === "Spine" ? 1 : 0.6);
        a += v * w;
      }
      d[i * 3] = nor[i * 3]! * a;
      d[i * 3 + 1] = nor[i * 3 + 1]! * a * 0.4; // mostly sideways and forwards: heights barely change
      d[i * 3 + 2] = nor[i * 3 + 2]! * a;
    }
    return d;
  });
}

