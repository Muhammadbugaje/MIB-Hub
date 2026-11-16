/**
 * Characters onto mib_rig: every body in the game on ONE skeleton (plan §3.7,
 * top rule 2), smooth instead of faceted (owner: "not a boxy sand feel").
 *
 *   npx tsx games/work-in-progress/tools/anim/rebind-character.ts
 *   (reads ~/Downloads/games-files/assets-raw/people-packed/*.glb, the
 *    palette-packed CC0 Quaternius bodies made by tools/pack-character.ts,
 *    and writes assets/people/*.glb + assets/people/index.json)
 *
 * For each body:
 *   1. read the bind pose from the inverse bind matrices (the files' node
 *      transforms are a stray animation pose) and turn the mesh to Y up,
 *      metres, facing +Z, 1.74 m tall (one scale for every human, rule C6);
 *   2. map its bones onto mib_rig (Mixamo names); bones the body lacks
 *      (toes, a third spine bone, finger joints) are added in sensible places
 *      with no skin weights;
 *   3. re-pose the mesh into the Mixamo bind T-pose (each segment turned so
 *      it points the way the reference skeleton's does), so every Mixamo clip
 *      plays on it directly, with no run-time retargeting;
 *   4. smooth it: welded, area-weighted smooth normals (no flat facets, no
 *      shadow-acne "sand"), and one level of Loop subdivision for the close-up
 *      LOD0 (rounder silhouettes); LOD1 is the original density, smoothed;
 *   5. write a GLB with the mib_rig skeleton, both LODs skinned to it, and
 *      the palette slots in mesh extras.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeClipPack } from "../../src/anim/clip.ts";
import { conj, fromTo, mulQ, norm, rotV, sub, type Q, type V3 } from "../../src/anim/math.ts";
import { B, BONE_COUNT, BONE_INDEX, MIB_BONES, PARENT, Skeleton, fk } from "../../src/anim/skeleton.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(HERE, "../..");
const SRC = join(homedir(), "Downloads/games-files/assets-raw/people-packed");
const OUT = join(GAME, "assets/people");
export const HUMAN_HEIGHT = 1.74;

/* ------------------------------------------------------------------ GLB in */

interface Gltf {
  nodes: { name?: string; children?: number[]; mesh?: number; skin?: number }[];
  meshes: { primitives: { attributes: Record<string, number>; indices?: number }[]; extras?: Record<string, unknown> }[];
  skins: { joints: number[]; inverseBindMatrices: number }[];
  accessors: { bufferView?: number; byteOffset?: number; componentType: number; count: number; type: string; normalized?: boolean }[];
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[];
}
const COMPS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function parseGlb(buf: Buffer): { json: Gltf; bin: Buffer } {
  const jl = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jl).toString("utf8")) as Gltf;
  const bs = 20 + jl;
  return { json, bin: buf.subarray(bs + 8, bs + 8 + buf.readUInt32LE(bs)) };
}

function read(g: Gltf, bin: Buffer, i: number): { data: Float64Array; comps: number } {
  const a = g.accessors[i]!;
  const comps = COMPS[a.type]!;
  const bv = g.bufferViews[a.bufferView ?? 0]!;
  const size = ({ 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 } as Record<number, number>)[a.componentType]!;
  const stride = bv.byteStride ?? size * comps;
  const base = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out = new Float64Array(a.count * comps);
  for (let k = 0; k < a.count; k++)
    for (let c = 0; c < comps; c++) {
      const o = base + k * stride + c * size;
      let v: number;
      switch (a.componentType) {
        case 5126: v = bin.readFloatLE(o); break;
        case 5125: v = bin.readUInt32LE(o); break;
        case 5123: v = bin.readUInt16LE(o); if (a.normalized) v /= 65535; break;
        case 5121: v = bin.readUInt8(o); if (a.normalized) v /= 255; break;
        case 5122: v = bin.readInt16LE(o); if (a.normalized) v = Math.max(v / 32767, -1); break;
        default: v = bin.readInt8(o); if (a.normalized) v = Math.max(v / 127, -1);
      }
      out[k * comps + c] = v;
    }
  return { data: out, comps };
}

/** Column-major 4x4 inverse (affine). */
function inv4(m: Float64Array, o = 0): Float64Array {
  const a = m.subarray(o, o + 16);
  // Affine: [R t; 0 1] -> [R^-1, -R^-1 t] with general 3x3 inverse.
  const r = [a[0]!, a[1]!, a[2]!, a[4]!, a[5]!, a[6]!, a[8]!, a[9]!, a[10]!];
  const det = r[0]! * (r[4]! * r[8]! - r[7]! * r[5]!) - r[3]! * (r[1]! * r[8]! - r[7]! * r[2]!) + r[6]! * (r[1]! * r[5]! - r[4]! * r[2]!);
  const id = 1 / det;
  const iv = [
    (r[4]! * r[8]! - r[5]! * r[7]!) * id, (r[2]! * r[7]! - r[1]! * r[8]!) * id, (r[1]! * r[5]! - r[2]! * r[4]!) * id,
    (r[5]! * r[6]! - r[3]! * r[8]!) * id, (r[0]! * r[8]! - r[2]! * r[6]!) * id, (r[2]! * r[3]! - r[0]! * r[5]!) * id,
    (r[3]! * r[7]! - r[4]! * r[6]!) * id, (r[1]! * r[6]! - r[0]! * r[7]!) * id, (r[0]! * r[4]! - r[1]! * r[3]!) * id,
  ];
  const t = [a[12]!, a[13]!, a[14]!];
  const out = new Float64Array(16);
  out[0] = iv[0]!; out[1] = iv[1]!; out[2] = iv[2]!;
  out[4] = iv[3]!; out[5] = iv[4]!; out[6] = iv[5]!;
  out[8] = iv[6]!; out[9] = iv[7]!; out[10] = iv[8]!;
  out[12] = -(iv[0]! * t[0]! + iv[3]! * t[1]! + iv[6]! * t[2]!);
  out[13] = -(iv[1]! * t[0]! + iv[4]! * t[1]! + iv[7]! * t[2]!);
  out[14] = -(iv[2]! * t[0]! + iv[5]! * t[1]! + iv[8]! * t[2]!);
  out[15] = 1;
  return out;
}

/* ------------------------------------------------------------------ bone mapping */

/** Quaternius bone -> mib_rig bone. Metacarpal "1" bones of the 62-bone bases start at the wrist: they skin to the hand. */
function mapBone(name: string): string | null {
  const m = /^(.*)\.(L|R)$/.exec(name);
  const side = m ? (m[2] === "L" ? "Left" : "Right") : "";
  const base = m ? m[1]! : name;
  switch (base) {
    case "Root": case "Body": case "Bone": case "Hips": return "Hips";
    case "Abdomen": return "Spine";
    case "Torso": return "Spine1";
    case "Chest": return "Spine2";
    case "Neck": return "Neck";
    case "Head": return "Head";
    case "Shoulder": return `${side}Shoulder`;
    case "UpperArm": return `${side}Arm`;
    case "LowerArm": return `${side}ForeArm`;
    case "Wrist": case "Palm": case "MiddleHand": return `${side}Hand`;
    case "Fingers": return `${side}HandMiddle1`;
    case "UpperLeg": return `${side}UpLeg`;
    case "LowerLeg": return `${side}Leg`;
    case "Foot": return `${side}Foot`;
    case "PT": case "PoleTarget": return null;
  }
  const f = /^(Thumb|Index|Middle|Ring|Pinky)(\d)$/.exec(base);
  if (f) {
    const n = Number(f[2]);
    if (f[1] === "Thumb") return `${side}HandThumb${Math.min(3, n)}`;
    if (n === 1) return `${side}Hand`;
    return `${side}Hand${f[1]}${n - 1}`;
  }
  return null;
}

/** The segment each mib bone "points along" (its main child). */
const MAIN_CHILD: Record<string, string> = (() => {
  const m: Record<string, string> = { Hips: "Spine", Spine: "Spine1", Spine1: "Spine2", Spine2: "Neck", Neck: "Head", Head: "HeadTop_End" };
  for (const s of ["Left", "Right"]) {
    Object.assign(m, { [`${s}Shoulder`]: `${s}Arm`, [`${s}Arm`]: `${s}ForeArm`, [`${s}ForeArm`]: `${s}Hand`, [`${s}Hand`]: `${s}HandMiddle1`, [`${s}UpLeg`]: `${s}Leg`, [`${s}Leg`]: `${s}Foot`, [`${s}Foot`]: `${s}ToeBase`, [`${s}ToeBase`]: `${s}Toe_End` });
    for (const f of ["Thumb", "Index", "Middle", "Ring", "Pinky"]) for (let i = 1; i < 4; i++) m[`${s}Hand${f}${i}`] = `${s}Hand${f}${i + 1}`;
  }
  return m;
})();

/* ------------------------------------------------------------------ mesh maths */

interface Mesh {
  pos: number[]; // xyz
  uv: number[];
  joints: number[]; // 4 per vertex (mib indices)
  weights: number[];
  idx: number[];
}

/** Weld by position; area-weighted smooth normals with a crease limit (sharp > 75 degrees stays sharp). */
function smoothNormals(m: Mesh, creaseDeg = 75): number[] {
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
 * One level of Loop subdivision on the welded surface. Corners keep their
 * own palette UV (one slot per face), skin weights follow the same stencils
 * and are renormalised to the four biggest influences.
 */
function loopSubdivide(m: Mesh): Mesh {
  const n = m.pos.length / 3;
  const key = (i: number) => `${Math.round(m.pos[i * 3]! * 1e4)},${Math.round(m.pos[i * 3 + 1]! * 1e4)},${Math.round(m.pos[i * 3 + 2]! * 1e4)}`;
  const weld = new Map<string, number>();
  const wOf = new Int32Array(n);
  const wFirst: number[] = [];
  for (let i = 0; i < n; i++) {
    const k = key(i);
    let w = weld.get(k);
    if (w === undefined) {
      w = wFirst.length;
      weld.set(k, w);
      wFirst.push(i);
    }
    wOf[i] = w;
  }
  const W = wFirst.length;
  const P = (w: number): V3 => [m.pos[wFirst[w]! * 3]!, m.pos[wFirst[w]! * 3 + 1]!, m.pos[wFirst[w]! * 3 + 2]!];
  // Skin as sparse maps per welded vertex.
  const skinOf = (i: number): Map<number, number> => {
    const s = new Map<number, number>();
    for (let k = 0; k < 4; k++) {
      const wt = m.weights[i * 4 + k]!;
      if (wt > 0) s.set(m.joints[i * 4 + k]!, (s.get(m.joints[i * 4 + k]!) ?? 0) + wt);
    }
    return s;
  };
  const S = (w: number) => skinOf(wFirst[w]!);
  const F = m.idx.length / 3;
  const edges = new Map<string, { a: number; b: number; opp: number[] }>();
  const ek = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`);
  const nbr: Set<number>[] = Array.from({ length: W }, () => new Set());
  for (let f = 0; f < F; f++) {
    const t = [wOf[m.idx[f * 3]!]!, wOf[m.idx[f * 3 + 1]!]!, wOf[m.idx[f * 3 + 2]!]!];
    for (let e = 0; e < 3; e++) {
      const a = t[e]!, b = t[(e + 1) % 3]!, c = t[(e + 2) % 3]!;
      if (a === b) continue;
      const k = ek(a, b);
      let E = edges.get(k);
      if (!E) edges.set(k, (E = { a, b, opp: [] }));
      E.opp.push(c);
      nbr[a]!.add(b);
      nbr[b]!.add(a);
    }
  }
  const boundary = new Set<number>();
  for (const E of edges.values()) if (E.opp.length !== 2) {
    boundary.add(E.a);
    boundary.add(E.b);
  }
  const mix = (parts: [number, number][]): { p: V3; s: Map<number, number> } => {
    const p: V3 = [0, 0, 0];
    const s = new Map<number, number>();
    for (const [w, k] of parts) {
      const q = P(w);
      p[0] += q[0] * k; p[1] += q[1] * k; p[2] += q[2] * k;
      for (const [j, v] of S(w)) s.set(j, (s.get(j) ?? 0) + v * k);
    }
    return { p, s };
  };
  // New positions of old vertices.
  const vNew: { p: V3; s: Map<number, number> }[] = [];
  for (let w = 0; w < W; w++) {
    if (boundary.has(w)) {
      const bn = [...nbr[w]!].filter((o) => {
        const E = edges.get(ek(w, o));
        return E && E.opp.length !== 2;
      });
      if (bn.length === 2) vNew.push(mix([[w, 0.75], [bn[0]!, 0.125], [bn[1]!, 0.125]]));
      else vNew.push(mix([[w, 1]]));
      continue;
    }
    const nb = [...nbr[w]!];
    const k = nb.length;
    const beta = k === 3 ? 3 / 16 : 3 / (8 * k);
    vNew.push(mix([[w, 1 - k * beta], ...nb.map((o) => [o, beta] as [number, number])]));
  }
  // Edge points.
  const ePt = new Map<string, { p: V3; s: Map<number, number> }>();
  for (const [k, E] of edges) ePt.set(k, E.opp.length === 2 ? mix([[E.a, 3 / 8], [E.b, 3 / 8], [E.opp[0]!, 1 / 8], [E.opp[1]!, 1 / 8]]) : mix([[E.a, 0.5], [E.b, 0.5]]));
  // Emit triangles; a vertex is (point id, uv).
  const out: Mesh = { pos: [], uv: [], joints: [], weights: [], idx: [] };
  const vmap = new Map<string, number>();
  const emit = (pid: string, pt: { p: V3; s: Map<number, number> }, u: number, v: number): number => {
    const k = `${pid}|${u.toFixed(5)},${v.toFixed(5)}`;
    let i = vmap.get(k);
    if (i !== undefined) return i;
    i = out.pos.length / 3;
    vmap.set(k, i);
    out.pos.push(...pt.p);
    out.uv.push(u, v);
    const top = [...pt.s].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const tot = top.reduce((s, x) => s + x[1], 0) || 1;
    for (let j = 0; j < 4; j++) {
      out.joints.push(top[j]?.[0] ?? 0);
      out.weights.push((top[j]?.[1] ?? 0) / tot);
    }
    return i;
  };
  for (let f = 0; f < F; f++) {
    const c = [m.idx[f * 3]!, m.idx[f * 3 + 1]!, m.idx[f * 3 + 2]!];
    const w = c.map((i) => wOf[i]!);
    if (w[0] === w[1] || w[1] === w[2] || w[0] === w[2]) continue;
    // One palette slot per face: take the first corner's uv for the new edge points.
    const u = m.uv[c[0]! * 2]!, v = m.uv[c[0]! * 2 + 1]!;
    const V = c.map((i, j) => emit(`v${w[j]}`, vNew[w[j]!]!, m.uv[i * 2]!, m.uv[i * 2 + 1]!));
    const E = [0, 1, 2].map((j) => {
      const k = ek(w[j]!, w[(j + 1) % 3]!);
      return emit(`e${k}`, ePt.get(k)!, u, v);
    });
    out.idx.push(V[0]!, E[0]!, E[2]!, V[1]!, E[1]!, E[0]!, V[2]!, E[2]!, E[1]!, E[0]!, E[1]!, E[2]!);
  }
  return out;
}

/* ------------------------------------------------------------------ GLB out */

function writeGlb(file: string, sk: { rot: Float32Array; pos: Float32Array }, ibm: Float32Array, lods: { name: string; mesh: Mesh; nor: number[] }[], extras: Record<string, unknown>): number {
  const chunks: Buffer[] = [];
  let off = 0;
  const views: Record<string, unknown>[] = [];
  const accs: Record<string, unknown>[] = [];
  const add = (data: Buffer, target?: number) => {
    const pad = (4 - (off % 4)) % 4;
    if (pad) {
      chunks.push(Buffer.alloc(pad));
      off += pad;
    }
    views.push({ buffer: 0, byteOffset: off, byteLength: data.length, ...(target ? { target } : {}) });
    chunks.push(data);
    off += data.length;
    return views.length - 1;
  };
  const f32 = (a: number[] | Float32Array, type: string, minmax = false, target?: number) => {
    const arr = Float32Array.from(a);
    const comps = COMPS[type]!;
    const acc: Record<string, unknown> = { bufferView: add(Buffer.from(arr.buffer), target), componentType: 5126, count: arr.length / comps, type };
    if (minmax) {
      const mn = new Array(comps).fill(Infinity), mx = new Array(comps).fill(-Infinity);
      for (let i = 0; i < arr.length; i++) {
        mn[i % comps] = Math.min(mn[i % comps], arr[i]!);
        mx[i % comps] = Math.max(mx[i % comps], arr[i]!);
      }
      acc.min = mn;
      acc.max = mx;
    }
    accs.push(acc);
    return accs.length - 1;
  };
  const nodes: Record<string, unknown>[] = MIB_BONES.map(([name], i) => ({
    name,
    rotation: Array.from(sk.rot.subarray(i * 4, i * 4 + 4)).map((v) => +v.toFixed(7)),
    translation: Array.from(sk.pos.subarray(i * 3, i * 3 + 3)).map((v) => +v.toFixed(6)),
  }));
  MIB_BONES.forEach(([, p], i) => {
    if (p) ((nodes[BONE_INDEX[p]!]!.children as number[] | undefined) ?? (nodes[BONE_INDEX[p]!]!.children = [])).push(i);
  });
  const ibmAcc = f32(ibm, "MAT4");
  const meshes: Record<string, unknown>[] = [];
  const sceneNodes = [0];
  for (const l of lods) {
    const m = l.mesh;
    const nv = m.pos.length / 3;
    const j16 = new Uint16Array(m.joints);
    const jv = add(Buffer.from(j16.buffer), 34962);
    accs.push({ bufferView: jv, componentType: 5123, count: nv, type: "VEC4" });
    const jAcc = accs.length - 1;
    const wq = new Uint8Array(nv * 4);
    for (let i = 0; i < nv; i++) {
      const w = [0, 1, 2, 3].map((k) => m.weights[i * 4 + k]!);
      const q = w.map((x) => Math.round(x * 255));
      const d = 255 - q.reduce((s, x) => s + x, 0);
      q[q.indexOf(Math.max(...q))]! += d;
      wq.set(q, i * 4);
    }
    const wv = add(Buffer.from(wq.buffer), 34962);
    accs.push({ bufferView: wv, componentType: 5121, normalized: true, count: nv, type: "VEC4" });
    const wAcc = accs.length - 1;
    const big = nv > 65535;
    const ib = big ? Buffer.from(Uint32Array.from(m.idx).buffer) : Buffer.from(Uint16Array.from(m.idx).buffer);
    const iv = add(ib, 34963);
    accs.push({ bufferView: iv, componentType: big ? 5125 : 5123, count: m.idx.length, type: "SCALAR" });
    const iAcc = accs.length - 1;
    meshes.push({
      name: l.name,
      primitives: [{ attributes: { POSITION: f32(m.pos, "VEC3", true, 34962), NORMAL: f32(l.nor, "VEC3", false, 34962), TEXCOORD_0: f32(m.uv, "VEC2", false, 34962), JOINTS_0: jAcc, WEIGHTS_0: wAcc }, indices: iAcc }],
      extras,
    });
    nodes.push({ name: l.name, mesh: meshes.length - 1, skin: 0 });
    sceneNodes.push(nodes.length - 1);
  }
  const binLen = off + ((4 - (off % 4)) % 4);
  const json = {
    asset: { version: "2.0", generator: "MIB-Hub WIP rebind-character (mib_rig v1)" },
    scene: 0,
    scenes: [{ nodes: sceneNodes }],
    nodes,
    meshes,
    skins: [{ joints: MIB_BONES.map((_, i) => i), inverseBindMatrices: ibmAcc, skeleton: 0 }],
    accessors: accs,
    bufferViews: views,
    buffers: [{ byteLength: binLen }],
  };
  let jb = Buffer.from(JSON.stringify(json));
  if (jb.length % 4) jb = Buffer.concat([jb, Buffer.alloc(4 - (jb.length % 4), 0x20)]);
  const bin = Buffer.concat([...chunks, Buffer.alloc(binLen - off)]);
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(12 + 8 + jb.length + 8 + bin.length, 8);
  const jh = Buffer.alloc(8);
  jh.writeUInt32LE(jb.length, 0);
  jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8);
  bh.writeUInt32LE(bin.length, 0);
  bh.writeUInt32LE(0x004e4942, 4);
  const all = Buffer.concat([head, jh, jb, bh, bin]);
  writeFileSync(file, all);
  return all.length;
}

/* ------------------------------------------------------------------ the rebind */

export function rebind(buf: Buffer, ref: Skeleton, opts: { subdivide: boolean }): { rest: { rot: Float32Array; pos: Float32Array }; ibm: Float32Array; lods: { name: string; mesh: Mesh; nor: number[] }[]; extras: Record<string, unknown>; report: string } {
  const { json, bin } = parseGlb(buf);
  const skin = json.skins[0]!;
  const ibmRaw = read(json, bin, skin.inverseBindMatrices).data;
  const jn = skin.joints.map((j) => json.nodes[j]!.name ?? "");
  const prim = json.meshes[0]!.primitives[0]!;
  const P = read(json, bin, prim.attributes.POSITION!).data;
  const UV = read(json, bin, prim.attributes.TEXCOORD_0!).data;
  const J = read(json, bin, prim.attributes.JOINTS_0!).data;
  const Wt = read(json, bin, prim.attributes.WEIGHTS_0!).data;
  const I = prim.indices !== undefined ? Array.from(read(json, bin, prim.indices).data) : Array.from({ length: P.length / 3 }, (_, i) => i);
  const nv = P.length / 3;
  // Bind joint positions in mesh space.
  const jp: V3[] = jn.map((_, j) => {
    const m = inv4(ibmRaw, j * 16);
    return [m[12]!, m[13]!, m[14]!];
  });
  // Mesh space -> Y up, metres, facing +Z. The up axis is the longest extent.
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < nv; i++) for (let c = 0; c < 3; c++) {
    mn[c] = Math.min(mn[c]!, P[i * 3 + c]!);
    mx[c] = Math.max(mx[c]!, P[i * 3 + c]!);
  }
  const ext = [0, 1, 2].map((c) => mx[c]! - mn[c]!);
  // Up is the axis from the feet to the head (not the longest extent: a T-pose's arm span can beat its height).
  const headJ = jn.findIndex((n) => n === "Head"), footJ = jn.findIndex((n) => n === "Foot.L");
  const hf = [0, 1, 2].map((c) => jp[headJ]![c]! - jp[footJ]![c]!);
  const up = hf.map(Math.abs).indexOf(Math.max(...hf.map(Math.abs)));
  const s = HUMAN_HEIGHT / ext[up]!;
  const upSign = hf[up]! > 0 ? 1 : -1;
  let toY = (p: V3): V3 => {
    const y = (p[up]! - (upSign > 0 ? mn[up]! : mx[up]!)) * upSign * s;
    if (up === 2) return [p[0] * s, y, -p[1] * upSign * s];
    if (up === 1) return [p[0] * s, y, p[2] * s];
    return [-p[1] * s, y, p[2] * s];
  };
  // Facing: the left side (.L joints) must be at +x when facing +z; otherwise turn 180 degrees.
  const lj = jn.findIndex((n) => n === "UpperLeg.L"), rj = jn.findIndex((n) => n === "UpperLeg.R");
  if (toY(jp[lj]!)[0] < toY(jp[rj]!)[0]) {
    const base = toY;
    toY = (p: V3) => {
      const q = base(p);
      return [-q[0], q[1], -q[2]];
    };
  }
  const vpos: V3[] = [];
  for (let i = 0; i < nv; i++) vpos.push(toY([P[i * 3]!, P[i * 3 + 1]!, P[i * 3 + 2]!]));
  const jpos = jp.map(toY);
  // Map joints to mib bones; collect positions for each mib bone (first mapped joint wins; Hips from the "Hips" joint).
  const jMib = jn.map((n) => {
    const m = mapBone(n);
    return m ? BONE_INDEX[m]! : -1;
  });
  const have: (V3 | null)[] = new Array(BONE_COUNT).fill(null);
  jn.forEach((n, j) => {
    const b = jMib[j]!;
    if (b < 0) return;
    if (b === B.Hips && n !== "Hips") return;
    const isHand = b === B.LHand || b === B.RHand;
    // The hand joint is the wrist (or palm), never a metacarpal or the mid-hand.
    if (isHand && !/^(Wrist|Palm)\./.test(n)) return;
    if (!have[b]) have[b] = jpos[j]!;
  });
  // Unweighted helper joints (pole targets) and the bones' weights onto the nearest mapped parent.
  const refW = fk(ref, ref.restPose());
  const refPos = (b: number): V3 => [refW.pos[b * 3]!, refW.pos[b * 3 + 1]!, refW.pos[b * 3 + 2]!];
  const refDir = (b: number, c: number): V3 => norm(sub(refPos(c), refPos(b)));
  // Fill missing bones from the reference proportions, scaled by the nearest known segment.
  const minY = Math.min(...vpos.map((v) => v[1]));
  const maxY = Math.max(...vpos.map((v) => v[1]));
  for (let b = 0; b < BONE_COUNT; b++) {
    if (have[b]) continue;
    const name = MIB_BONES[b]![0];
    const par = PARENT[b]!;
    if (b === B.Root) {
      have[b] = [have[B.Hips]![0], 0, have[B.Hips]![2]];
      continue;
    }
    if (name === "Spine2") {
      // Between Spine1 and Neck, at the reference's ratio.
      const a = have[B.Spine1]!, n = have[B.Neck]!;
      const r = 0.35;
      have[b] = [a[0] + (n[0] - a[0]) * r, a[1] + (n[1] - a[1]) * r, a[2] + (n[2] - a[2]) * r];
      continue;
    }
    if (name === "HeadTop_End") {
      const h = have[B.Head]!;
      have[b] = [h[0], maxY, h[2] + 0.02];
      continue;
    }
    if (/ToeBase$/.test(name)) {
      // Ball of the foot: forward of the ankle, on the ground (from the mesh's foot vertices).
      const ank = have[par]!;
      const side = name.startsWith("Left") ? 1 : -1;
      const feet = vpos.filter((v) => v[1] < minY + 0.06 && Math.sign(v[0] - (have[B.Hips]![0])) === side);
      const front = feet.length ? Math.max(...feet.map((v) => v[2])) : ank[2] + 0.18;
      have[b] = [ank[0], minY + 0.01, ank[2] + (front - ank[2]) * 0.62];
      continue;
    }
    if (/Toe_End$/.test(name)) {
      const ank = have[PARENT[par]!]!, ball = have[par]!;
      const side = name.startsWith("Left") ? 1 : -1;
      const feet = vpos.filter((v) => v[1] < minY + 0.06 && Math.sign(v[0] - have[B.Hips]![0]) === side);
      const front = feet.length ? Math.max(...feet.map((v) => v[2])) : ball[2] + 0.08;
      have[b] = [ball[0], minY + 0.01, front - 0.01];
      void ank;
      continue;
    }
    // Fingers and other chain ends: continue from the parent along the reference direction, with the reference length scaled by the hand size.
    const pp = have[par]!;
    const handScale = (() => {
      const hb = name.startsWith("Left") ? B.LHand : B.RHand;
      const fa = name.startsWith("Left") ? B.LForeArm : B.RForeArm;
      if (!have[hb] || !have[fa]) return 1;
      const tl = Math.hypot(...sub(have[hb]!, have[fa]!));
      const rl = Math.hypot(...sub(refPos(hb), refPos(fa)));
      return tl / rl;
    })();
    // Direction: the parent segment's direction in this body (so fingers follow a down-pointing hand in an A-pose).
    const gp = PARENT[par]!;
    let dir: V3;
    if (/Hand(Index|Middle|Ring|Pinky)1$/.test(name) || /HandThumb1$/.test(name)) {
      const fa = name.startsWith("Left") ? B.LForeArm : B.RForeArm;
      dir = norm(sub(have[par]!, have[fa]!));
      // Spread across the palm like the reference (offset perpendicular).
      const off = sub(refPos(b), refPos(par));
      const refArm = refDir(fa, par);
      const along = off[0] * refArm[0] + off[1] * refArm[1] + off[2] * refArm[2];
      const perp = sub(off, [refArm[0] * along, refArm[1] * along, refArm[2] * along]);
      const rot = fromTo(refArm, dir);
      const pr = rotV(rot, 0, perp);
      have[b] = [pp[0] + (dir[0] * along + pr[0]) * handScale, pp[1] + (dir[1] * along + pr[1]) * handScale, pp[2] + (dir[2] * along + pr[2]) * handScale];
      continue;
    }
    dir = gp >= 0 && have[gp] ? norm(sub(pp, have[gp]!)) : [0, 1, 0];
    const l = Math.hypot(...sub(refPos(b), refPos(par))) * handScale;
    have[b] = [pp[0] + dir[0] * l, pp[1] + dir[1] * l, pp[2] + dir[2] * l];
  }
  const p0 = have as V3[];
  // Re-pose: each segment turned to the reference direction (absolute, minimal rotation).
  const D: Q[] = new Array(BONE_COUNT).fill(null).map(() => [0, 0, 0, 1] as Q);
  for (let b = 0; b < BONE_COUNT; b++) {
    const name = MIB_BONES[b]![0];
    const c = MAIN_CHILD[name];
    if (!c) {
      D[b] = PARENT[b]! >= 0 ? D[PARENT[b]!]! : [0, 0, 0, 1];
      continue;
    }
    const ci = BONE_INDEX[c]!;
    const cur = norm(sub(p0[ci]!, p0[b]!));
    D[b] = fromTo(cur, refDir(b, ci));
  }
  // Hips: keep the pelvis level (no turn); its children carry their own turns.
  D[B.Hips] = [0, 0, 0, 1];
  D[B.Root] = [0, 0, 0, 1];
  // New joint positions down the chain.
  const p1: V3[] = new Array(BONE_COUNT);
  for (let b = 0; b < BONE_COUNT; b++) {
    const par = PARENT[b]!;
    if (par < 0) {
      p1[b] = p0[b]!;
      continue;
    }
    const v = rotV(D[par]!, 0, sub(p0[b]!, p0[par]!));
    p1[b] = [p1[par]![0] + v[0], p1[par]![1] + v[1], p1[par]![2] + v[2]];
  }
  // Vertices follow their joints (linear blend of the per-segment turns).
  const mesh: Mesh = { pos: [], uv: Array.from(UV), joints: [], weights: [], idx: I };
  const unmapped = new Set<string>();
  for (let i = 0; i < nv; i++) {
    const acc: V3 = [0, 0, 0];
    const infl = new Map<number, number>();
    let tot = 0;
    for (let k = 0; k < 4; k++) {
      const w = Wt[i * 4 + k]!;
      if (w <= 0) continue;
      let b = jMib[J[i * 4 + k]!]!;
      if (b < 0) {
        unmapped.add(jn[J[i * 4 + k]!]!);
        b = B.Hips;
      }
      const v = rotV(D[b]!, 0, sub(vpos[i]!, p0[b]!));
      acc[0] += (p1[b]![0] + v[0]) * w;
      acc[1] += (p1[b]![1] + v[1]) * w;
      acc[2] += (p1[b]![2] + v[2]) * w;
      infl.set(b, (infl.get(b) ?? 0) + w);
      tot += w;
    }
    mesh.pos.push(acc[0] / (tot || 1), acc[1] / (tot || 1), acc[2] / (tot || 1));
    const top = [...infl].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const t2 = top.reduce((s2, x) => s2 + x[1], 0) || 1;
    for (let k = 0; k < 4; k++) {
      mesh.joints.push(top[k]?.[0] ?? B.Hips);
      mesh.weights.push((top[k]?.[1] ?? 0) / t2);
    }
  }
  // Ground the re-posed body (feet on y = 0) and centre it over the root.
  const footMin = Math.min(...mesh.pos.filter((_, i) => i % 3 === 1));
  const cx = p1[B.Hips]![0], cz = p1[B.Hips]![2];
  for (let i = 0; i < mesh.pos.length; i += 3) {
    mesh.pos[i] = mesh.pos[i]! - cx;
    mesh.pos[i + 1] = mesh.pos[i + 1]! - footMin;
    mesh.pos[i + 2] = mesh.pos[i + 2]! - cz;
  }
  for (const p of p1) {
    p[0] -= cx;
    p[1] -= footMin;
    p[2] -= cz;
  }
  p1[B.Root] = [0, 0, 0];
  // The skeleton: reference rest rotations (the Mixamo bind frames), this body's joint positions.
  const refRot: Q[] = Array.from({ length: BONE_COUNT }, (_, b) => [refW.rot[b * 4]!, refW.rot[b * 4 + 1]!, refW.rot[b * 4 + 2]!, refW.rot[b * 4 + 3]!]);
  const rest = { rot: Float32Array.from(ref.restRot), pos: new Float32Array(BONE_COUNT * 3) };
  for (let b = 0; b < BONE_COUNT; b++) {
    const par = PARENT[b]!;
    const lp = par < 0 ? p1[b]! : rotV(conj(refRot[par]!), 0, sub(p1[b]!, p1[par]!));
    rest.pos.set(lp, b * 3);
  }
  // Inverse bind matrices from world (rotation refRot, position p1).
  const ibm = new Float32Array(BONE_COUNT * 16);
  for (let b = 0; b < BONE_COUNT; b++) {
    const q = conj(refRot[b]!);
    const [x, y, z, w] = q;
    const R = [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y)];
    const t = rotV(q, 0, p1[b]!);
    ibm.set([R[0]!, R[1]!, R[2]!, 0, R[3]!, R[4]!, R[5]!, 0, R[6]!, R[7]!, R[8]!, 0, -t[0], -t[1], -t[2], 1], b * 16);
  }
  // Fit data for headwear (hijabs sized to each head, neck and shoulders): from the skin, not the hair.
  const slots = ((json.meshes[0]!.extras ?? {}).slots as { name: string }[] | undefined) ?? [];
  const isHair = (i: number) => /hair|brown/i.test(slots[Math.floor(mesh.uv[i * 2]! * 16)]?.name ?? "") && !/eyebrow/i.test(slots[Math.floor(mesh.uv[i * 2]! * 16)]?.name ?? "");
  const box = (pred: (i: number) => boolean) => {
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < mesh.pos.length / 3; i++) {
      if (!pred(i)) continue;
      for (let c = 0; c < 3; c++) {
        mn[c] = Math.min(mn[c]!, mesh.pos[i * 3 + c]!);
        mx[c] = Math.max(mx[c]!, mesh.pos[i * 3 + c]!);
      }
    }
    return { min: mn.map((v) => +v.toFixed(4)), max: mx.map((v) => +v.toFixed(4)) };
  };
  const dom = (i: number) => mesh.joints[i * 4]!;
  const fit = {
    head: box((i) => dom(i) === B.Head && !isHair(i)),
    hair: box((i) => isHair(i)),
    neck: box((i) => dom(i) === B.Neck),
    chest: box((i) => dom(i) === B.Spine2 || dom(i) === B.LShoulder || dom(i) === B.RShoulder),
    joints: { head: p1[B.Head]!.map((v) => +v.toFixed(4)), neck: p1[B.Neck]!.map((v) => +v.toFixed(4)), spine2: p1[B.Spine2]!.map((v) => +v.toFixed(4)), headTop: p1[B.HeadTop]!.map((v) => +v.toFixed(4)), lArm: p1[B.LArm]!.map((v) => +v.toFixed(4)) },
  };
  const lods: { name: string; mesh: Mesh; nor: number[] }[] = [];
  if (opts.subdivide) {
    const sub1 = loopSubdivide(mesh);
    lods.push({ name: "lod0", mesh: sub1, nor: smoothNormals(sub1) });
  }
  lods.push({ name: opts.subdivide ? "lod1" : "lod0", mesh, nor: smoothNormals(mesh) });
  void mulQ;
  return {
    rest, ibm, lods, extras: { ...(json.meshes[0]!.extras ?? {}), fit },
    report: `tris ${mesh.idx.length / 3}${opts.subdivide ? ` -> lod0 ${lods[0]!.mesh.idx.length / 3}` : ""}; unmapped weighted joints: ${[...unmapped].join(", ") || "none"}`,
  };
}

function main(): void {
  const refPack = decodeClipPack(readFileSync(join(GAME, "assets/anim/locomotion.glb")));
  const ref = new Skeleton(refPack.rest.rot, refPack.rest.pos);
  if (!existsSync(SRC)) throw new Error(`missing ${SRC}`);
  mkdirSync(OUT, { recursive: true });
  const oldIndex = JSON.parse(readFileSync(join(SRC, "index.json"), "utf8")) as Record<string, { file: string; slots: unknown }>;
  const index: Record<string, unknown> = {};
  for (const f of readdirSync(SRC).filter((x) => x.endsWith(".glb")).sort()) {
    const key = basename(f, ".glb");
    const r = rebind(readFileSync(join(SRC, f)), ref, { subdivide: true });
    const bytes = writeGlb(join(OUT, f), r.rest, r.ibm, r.lods, r.extras);
    const sk = new Skeleton(r.rest.rot, r.rest.pos, ref.hipHeight);
    index[key] = { file: f, slots: oldIndex[key]?.slots ?? r.extras.slots ?? [], height: HUMAN_HEIGHT, hipHeight: +sk.hipHeight.toFixed(4), rig: "mib_rig", fit: r.extras.fit };
    console.log(`${key.padEnd(12)} ${(bytes / 1024).toFixed(0).padStart(5)} KB  hips ${sk.hipHeight.toFixed(3)} m  ${r.report}`);
  }
  writeFileSync(join(OUT, "index.json"), JSON.stringify(index, null, 1));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
