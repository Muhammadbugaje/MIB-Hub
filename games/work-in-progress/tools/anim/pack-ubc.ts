/**
 * Realistic base bodies (owner, 16 Nov: "redesign them all to look good and
 * like real people"): Quaternius "Universal Base Characters" (Standard, CC0),
 * a male and a female base with proper shoulder topology and skin weights,
 * plus their eyes, eyebrows and head-rigged hairstyles.
 *
 *   npx tsx games/work-in-progress/tools/anim/pack-ubc.ts
 *   (reads ~/Downloads/games-files/assets-raw/quaternius-ubc/x/..., the free
 *    Standard zip from https://quaternius.itch.io/universal-base-characters,
 *    and writes assets/people2/: base_m.glb, base_f.glb, textures, index.json)
 *
 * Their bind pose is already a T-pose in metres, Y up, facing +Z, on an
 * Unreal-style skeleton; bones are renamed to mib_rig (Mixamo names) and each
 * segment gets only the tiny turn that lines it up with the reference rig, so
 * the artist's skin weights deform exactly as authored (good shoulders and
 * armpits: the old CC0 bodies were re-posed by 90 degrees and collapsed).
 *
 * Output per base: one GLB with the mib_rig skeleton and skinned meshes
 * "body", "eyes", "brows" and "hair_<style>"; JPEG textures (albedo and normal
 * 1024, roughness 512; the normal map's muscle detail is softened: the owner
 * wants natural, not bodybuilder); fit data (head, neck, chest boxes) for
 * hijabs and clothing.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeClipPack } from "../../src/anim/clip.ts";
import { conj, fromTo, norm, rotV, sub, type Q, type V3 } from "../../src/anim/math.ts";
import type { Mesh } from "../../src/anim/meshops.ts";
import { B, BONE_COUNT, BONE_INDEX, MIB_BONES, PARENT, Skeleton, fk } from "../../src/anim/skeleton.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const GAME = resolve(HERE, "../..");
const RAW = join(homedir(), "Downloads/games-files/assets-raw/quaternius-ubc/x/Universal Base Characters[Standard]");
const OUT = join(GAME, "assets/people2");

/** Unreal mannequin bone -> mib_rig (Mixamo) bone. */
export function ueToMib(n: string): string | null {
  const side = n.endsWith("_l") ? "Left" : n.endsWith("_r") ? "Right" : "";
  const b = n.replace(/_(l|r)$/, "");
  const fixed: Record<string, string> = { root: "Root", pelvis: "Hips", spine_01: "Spine", spine_02: "Spine1", spine_03: "Spine2", neck_01: "Neck", Head: "Head", head: "Head" };
  if (fixed[n]) return fixed[n]!;
  const limb: Record<string, string> = { clavicle: "Shoulder", upperarm: "Arm", lowerarm: "ForeArm", hand: "Hand", thigh: "UpLeg", calf: "Leg", foot: "Foot", ball: "ToeBase", ball_leaf: "Toe_End" };
  if (limb[b]) return `${side}${limb[b]}`;
  const f = /^(thumb|index|middle|ring|pinky)_0(\d)(_leaf)?$/.exec(b);
  if (f) return `${side}Hand${f[1]![0]!.toUpperCase()}${f[1]!.slice(1)}${f[2]}`;
  return null;
}

/* ------------------------------------------------------------------ glTF (separate .bin) in */

interface GJ {
  nodes: { name?: string }[];
  materials?: { name?: string }[];
  meshes: { name: string; primitives: { attributes: Record<string, number>; indices: number; material?: number }[] }[];
  skins: { joints: number[]; inverseBindMatrices: number }[];
  accessors: { bufferView: number; byteOffset?: number; componentType: number; count: number; type: string; normalized?: boolean }[];
  bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[];
}
const COMPS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function loadGltf(file: string): { json: GJ; bin: Buffer } {
  return { json: JSON.parse(readFileSync(file, "utf8")) as GJ, bin: readFileSync(file.replace(/\.gltf$/, ".bin")) };
}

function read(g: GJ, bin: Buffer, i: number): number[] {
  const a = g.accessors[i]!;
  const bv = g.bufferViews[a.bufferView]!;
  const comps = COMPS[a.type]!;
  const size = ({ 5121: 1, 5123: 2, 5125: 4, 5126: 4 } as Record<number, number>)[a.componentType]!;
  const stride = bv.byteStride ?? size * comps;
  const base = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out: number[] = new Array(a.count * comps);
  for (let k = 0; k < a.count; k++)
    for (let c = 0; c < comps; c++) {
      const o = base + k * stride + c * size;
      let v: number;
      switch (a.componentType) {
        case 5126: v = bin.readFloatLE(o); break;
        case 5125: v = bin.readUInt32LE(o); break;
        case 5123: v = bin.readUInt16LE(o); if (a.normalized) v /= 65535; break;
        default: v = bin.readUInt8(o); if (a.normalized) v /= 255;
      }
      out[k * comps + c] = v;
    }
  return out;
}

function inv4(m: number[], o: number): number[] {
  // Rigid transform inverse (rotation + translation, scale ~1).
  const r = [m[o]!, m[o + 1]!, m[o + 2]!, m[o + 4]!, m[o + 5]!, m[o + 6]!, m[o + 8]!, m[o + 9]!, m[o + 10]!];
  const t = [m[o + 12]!, m[o + 13]!, m[o + 14]!];
  // transpose rotation
  const rt = [r[0]!, r[3]!, r[6]!, r[1]!, r[4]!, r[7]!, r[2]!, r[5]!, r[8]!];
  return [rt[0]!, rt[1]!, rt[2]!, 0, rt[3]!, rt[4]!, rt[5]!, 0, rt[6]!, rt[7]!, rt[8]!, 0,
    -(rt[0]! * t[0]! + rt[3]! * t[1]! + rt[6]! * t[2]!), -(rt[1]! * t[0]! + rt[4]! * t[1]! + rt[7]! * t[2]!), -(rt[2]! * t[0]! + rt[5]! * t[1]! + rt[8]! * t[2]!), 1];
}

interface SrcMesh { name: string; mesh: Mesh; nor: number[]; material?: string }

/** A glTF's skinned meshes with joints renamed to mib_rig indices. */
function meshesOf(file: string, pick?: (name: string) => boolean): { meshes: SrcMesh[]; joints: Map<number, V3> } {
  const { json, bin } = loadGltf(file);
  const skin = json.skins[0]!;
  const ibm = read(json, bin, skin.inverseBindMatrices);
  const jMib = skin.joints.map((j) => {
    const m = ueToMib(json.nodes[j]!.name ?? "");
    return m ? BONE_INDEX[m] ?? -1 : -1;
  });
  const joints = new Map<number, V3>();
  jMib.forEach((b, k) => {
    if (b < 0) return;
    const w = inv4(ibm, k * 16);
    joints.set(b, [w[12]!, w[13]!, w[14]!]);
  });
  const meshes: SrcMesh[] = [];
  for (const m of json.meshes) {
    if (pick && !pick(m.name)) continue;
    const p = m.primitives[0]!;
    const at = p.attributes;
    const J = read(json, bin, at.JOINTS_0!), W = read(json, bin, at.WEIGHTS_0!);
    const joints4: number[] = [], weights4: number[] = [];
    for (let i = 0; i < J.length / 4; i++) {
      const infl = new Map<number, number>();
      for (let k = 0; k < 4; k++) {
        const w = W[i * 4 + k]!;
        if (w <= 0) continue;
        const b = jMib[J[i * 4 + k]!] ?? -1;
        infl.set(b < 0 ? B.Hips : b, (infl.get(b < 0 ? B.Hips : b) ?? 0) + w);
      }
      const top = [...infl].sort((a, c) => c[1] - a[1]).slice(0, 4);
      const tot = top.reduce((s, x) => s + x[1], 0) || 1;
      for (let k = 0; k < 4; k++) {
        joints4.push(top[k]?.[0] ?? B.Hips);
        weights4.push((top[k]?.[1] ?? 0) / tot);
      }
    }
    meshes.push({
      name: m.name,
      material: json.materials?.[p.material ?? -1]?.name ?? "",
      mesh: { pos: read(json, bin, at.POSITION!), uv: read(json, bin, at.TEXCOORD_0!), joints: joints4, weights: weights4, idx: read(json, bin, p.indices) },
      nor: read(json, bin, at.NORMAL!),
    });
  }
  return { meshes, joints };
}

/* ------------------------------------------------------------------ bind alignment */

/** The segment each bone points along. */
const MAIN_CHILD: Record<string, string> = (() => {
  const m: Record<string, string> = { Hips: "Spine", Spine: "Spine1", Spine1: "Spine2", Spine2: "Neck", Neck: "Head" };
  for (const s of ["Left", "Right"]) {
    Object.assign(m, { [`${s}Shoulder`]: `${s}Arm`, [`${s}Arm`]: `${s}ForeArm`, [`${s}ForeArm`]: `${s}Hand`, [`${s}Hand`]: `${s}HandMiddle1`, [`${s}UpLeg`]: `${s}Leg`, [`${s}Leg`]: `${s}Foot`, [`${s}Foot`]: `${s}ToeBase`, [`${s}ToeBase`]: `${s}Toe_End` });
    for (const f of ["Thumb", "Index", "Middle", "Ring", "Pinky"]) for (let i = 1; i < 4; i++) m[`${s}Hand${f}${i}`] = `${s}Hand${f}${i + 1}`;
  }
  return m;
})();

function build(ref: Skeleton, joints: Map<number, V3>, meshesIn: SrcMesh[], height: number) {
  // One scale for every human (plan rule C6): the body's height (soles to crown) becomes HUMAN_HEIGHT. Measured
  // from the soles, not from zero: the lift below then puts the soles on the ground without making anyone taller.
  let rawMin = Infinity;
  for (const m of meshesIn) if (m.name === "body") for (let i = 1; i < m.mesh.pos.length; i += 3) rawMin = Math.min(rawMin, m.mesh.pos[i]!);
  const s0 = 1.74 / Math.max(0.01, height - rawMin);
  joints = new Map([...joints].map(([k, v]) => [k, [v[0] * s0, v[1] * s0, v[2] * s0] as V3]));
  // Soles exactly on the ground (the source files stand about 1 cm below zero).
  let minY = Infinity;
  for (const m of meshesIn) if (m.name === "body") for (let i = 1; i < m.mesh.pos.length; i += 3) minY = Math.min(minY, m.mesh.pos[i]! * s0);
  const lift = -minY;
  joints = new Map([...joints].map(([k, v]) => [k, [v[0], v[1] + lift, v[2]] as V3]));
  const meshes = meshesIn.map((m) => ({ ...m, mesh: { ...m.mesh, pos: m.mesh.pos.map((v, i) => v * s0 + (i % 3 === 1 ? lift : 0)) } }));
  const refW = fk(ref, ref.restPose());
  const refPos = (b: number): V3 => [refW.pos[b * 3]!, refW.pos[b * 3 + 1]!, refW.pos[b * 3 + 2]!];
  const p0: V3[] = new Array(BONE_COUNT);
  for (let b = 0; b < BONE_COUNT; b++) {
    const j = joints.get(b);
    if (j) p0[b] = j;
  }
  // HeadTop_End: above the head by the reference ratio of head height.
  const head = p0[B.Head]!, neck = p0[B.Neck]!;
  const k = Math.hypot(...sub(refPos(B.HeadTop), refPos(B.Head))) / Math.hypot(...sub(refPos(B.Head), refPos(B.Neck)));
  p0[B.HeadTop] = [head[0], head[1] + Math.hypot(...sub(head, neck)) * k, head[2]];
  p0[B.Root] ??= [0, 0, 0];
  // Ball-of-foot pivots along the reference rig's ankle-to-ball direction, down to the sole (the foot mesh is
  // not turned): the clips' heel-to-toe roll then lands the sole flat, exactly as on the reference rig.
  const body = meshes.find((m) => m.name === "body")!.mesh;
  let soleY = Infinity, frontZ = -Infinity;
  for (let i = 0; i < body.pos.length / 3; i++) {
    soleY = Math.min(soleY, body.pos[i * 3 + 1]!);
    if (body.pos[i * 3 + 1]! < 0.05) frontZ = Math.max(frontZ, body.pos[i * 3 + 2]!);
  }
  for (const [foot, toe, end] of [[B.LFoot, B.LToe, B.LToeEnd], [B.RFoot, B.RToe, B.RToeEnd]] as const) {
    const ank = p0[foot]!;
    const d = norm(sub(refPos(toe), refPos(foot)));
    const len = (ank[1] - soleY) / Math.max(0.2, -d[1]);
    const ball: V3 = [ank[0] + d[0] * len, soleY, ank[2] + d[2] * len];
    p0[toe] = ball;
    const d2 = norm(sub(refPos(end), refPos(toe)));
    const len2 = Math.max(0.03, (frontZ - 0.01 - ball[2]) / Math.max(0.3, d2[2]));
    p0[end] = [ball[0] + d2[0] * len2, soleY + d2[1] * len2, ball[2] + d2[2] * len2];
  }
  for (let b = 0; b < BONE_COUNT; b++) if (!p0[b]) throw new Error(`missing joint ${MIB_BONES[b]![0]}`);
  // Small segment alignments to the reference T-pose (the bodies are already T-posed).
  const D: Q[] = new Array(BONE_COUNT).fill(null).map(() => [0, 0, 0, 1] as Q);
  let maxTurn = 0;
  let maxBone = "";
  for (let b = 0; b < BONE_COUNT; b++) {
    const c = MAIN_CHILD[MIB_BONES[b]![0]];
    if (!c || b === B.Hips) {
      D[b] = PARENT[b]! >= 0 && b !== B.Hips ? D[PARENT[b]!]! : [0, 0, 0, 1];
      continue;
    }
    const ci = BONE_INDEX[c]!;
    // The clavicles keep the artist's own angle (re-posing them would bend the shoulder and armpit area).
    // Feet and hands too: a re-posed foot would no longer sit flat; the clips' bone frames carry them as authored.
    if (b === B.LShoulder || b === B.RShoulder || b === B.LFoot || b === B.RFoot || b === B.LToe || b === B.RToe || b === B.LHand || b === B.RHand || b === B.LToeEnd || b === B.RToeEnd) {
      D[b] = [0, 0, 0, 1];
      continue;
    }
    D[b] = fromTo(norm(sub(p0[ci]!, p0[b]!)), norm(sub(refPos(ci), refPos(b))));
    const turn = (2 * Math.acos(Math.min(1, Math.abs(D[b]![3]))) * 180) / Math.PI;
    if (turn > 6) console.log(`  align ${MIB_BONES[b]![0]} ${turn.toFixed(1)} deg`);
    if (turn > maxTurn) {
      maxTurn = turn;
      maxBone = MIB_BONES[b]![0];
    }
  }
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
  const out = meshes.map((sm) => {
    const m = sm.mesh;
    const pos: number[] = [], nor: number[] = [];
    for (let i = 0; i < m.pos.length / 3; i++) {
      const v: V3 = [m.pos[i * 3]!, m.pos[i * 3 + 1]!, m.pos[i * 3 + 2]!];
      const n: V3 = [sm.nor[i * 3]!, sm.nor[i * 3 + 1]!, sm.nor[i * 3 + 2]!];
      const a: V3 = [0, 0, 0], an: V3 = [0, 0, 0];
      for (let kk = 0; kk < 4; kk++) {
        const w = m.weights[i * 4 + kk]!;
        if (w <= 0) continue;
        const b = m.joints[i * 4 + kk]!;
        const r = rotV(D[b]!, 0, sub(v, p0[b]!));
        a[0] += (p1[b]![0] + r[0]) * w; a[1] += (p1[b]![1] + r[1]) * w; a[2] += (p1[b]![2] + r[2]) * w;
        const rn = rotV(D[b]!, 0, n);
        an[0] += rn[0] * w; an[1] += rn[1] * w; an[2] += rn[2] * w;
      }
      pos.push(...a);
      nor.push(...norm(an));
    }
    return { name: sm.name, mesh: { ...m, pos }, nor };
  });
  const refRot: Q[] = Array.from({ length: BONE_COUNT }, (_, b) => [refW.rot[b * 4]!, refW.rot[b * 4 + 1]!, refW.rot[b * 4 + 2]!, refW.rot[b * 4 + 3]!]);
  const rest = { rot: Float32Array.from(ref.restRot), pos: new Float32Array(BONE_COUNT * 3) };
  for (let b = 0; b < BONE_COUNT; b++) {
    const par = PARENT[b]!;
    rest.pos.set(par < 0 ? p1[b]! : rotV(conj(refRot[par]!), 0, sub(p1[b]!, p1[par]!)), b * 3);
  }
  const ibm = new Float32Array(BONE_COUNT * 16);
  for (let b = 0; b < BONE_COUNT; b++) {
    const q = conj(refRot[b]!);
    const [x, y, z, w] = q;
    const R = [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y)];
    const t = rotV(q, 0, p1[b]!);
    ibm.set([R[0]!, R[1]!, R[2]!, 0, R[3]!, R[4]!, R[5]!, 0, R[6]!, R[7]!, R[8]!, 0, -t[0], -t[1], -t[2], 1], b * 16);
  }
  return { meshes: out, rest, ibm, p1, maxTurn, maxBone };
}

/* ------------------------------------------------------------------ GLB out (geometry + skin only; materials are made in the game) */

function writeGlb(file: string, rest: { rot: Float32Array; pos: Float32Array }, ibm: Float32Array, meshes: { name: string; mesh: Mesh; nor: number[] }[], extras: Record<string, unknown>): number {
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
  const acc = (arr: Float32Array | Uint16Array | Uint32Array | Uint8Array, type: string, comp: number, normalized = false, minmax = false, target?: number) => {
    const comps = COMPS[type]!;
    const a: Record<string, unknown> = { bufferView: add(Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength), target), componentType: comp, count: arr.length / comps, type };
    if (normalized) a.normalized = true;
    if (minmax) {
      const mn = new Array(comps).fill(Infinity), mx = new Array(comps).fill(-Infinity);
      for (let i = 0; i < arr.length; i++) {
        mn[i % comps] = Math.min(mn[i % comps], arr[i]!);
        mx[i % comps] = Math.max(mx[i % comps], arr[i]!);
      }
      a.min = mn;
      a.max = mx;
    }
    accs.push(a);
    return accs.length - 1;
  };
  const nodes: Record<string, unknown>[] = MIB_BONES.map(([name], i) => ({
    name,
    rotation: Array.from(rest.rot.subarray(i * 4, i * 4 + 4)).map((v) => +v.toFixed(7)),
    translation: Array.from(rest.pos.subarray(i * 3, i * 3 + 3)).map((v) => +v.toFixed(6)),
  }));
  MIB_BONES.forEach(([, p], i) => {
    if (p) ((nodes[BONE_INDEX[p]!]!.children as number[] | undefined) ?? (nodes[BONE_INDEX[p]!]!.children = [])).push(i);
  });
  const ibmAcc = acc(ibm, "MAT4", 5126);
  const gm: Record<string, unknown>[] = [];
  const scene = [0];
  for (const l of meshes) {
    const m = l.mesh;
    const nv = m.pos.length / 3;
    const wq = new Uint8Array(nv * 4);
    for (let i = 0; i < nv; i++) {
      const q = [0, 1, 2, 3].map((k) => Math.round(m.weights[i * 4 + k]! * 255));
      q[q.indexOf(Math.max(...q))]! += 255 - q.reduce((s, x) => s + x, 0);
      wq.set(q, i * 4);
    }
    const big = nv > 65535;
    gm.push({
      name: l.name,
      primitives: [{
        attributes: {
          POSITION: acc(Float32Array.from(m.pos), "VEC3", 5126, false, true, 34962),
          NORMAL: acc(Float32Array.from(l.nor), "VEC3", 5126, false, false, 34962),
          TEXCOORD_0: acc(Float32Array.from(m.uv), "VEC2", 5126, false, false, 34962),
          JOINTS_0: acc(Uint8Array.from(m.joints), "VEC4", 5121, false, false, 34962),
          WEIGHTS_0: acc(wq, "VEC4", 5121, true, false, 34962),
        },
        indices: acc(big ? Uint32Array.from(m.idx) : Uint16Array.from(m.idx), "SCALAR", big ? 5125 : 5123, false, false, 34963),
      }],
    });
    nodes.push({ name: l.name, mesh: gm.length - 1, skin: 0 });
    scene.push(nodes.length - 1);
  }
  const binLen = off + ((4 - (off % 4)) % 4);
  const json = {
    asset: { version: "2.0", generator: "MIB-Hub WIP pack-ubc (mib_rig v1)", extras },
    scene: 0, scenes: [{ nodes: scene }], nodes, meshes: gm,
    skins: [{ joints: MIB_BONES.map((_, i) => i), inverseBindMatrices: ibmAcc, skeleton: 0 }],
    accessors: accs, bufferViews: views, buffers: [{ byteLength: binLen }],
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

/* ------------------------------------------------------------------ textures (Python PIL: resize, soften normals, JPEG) */

function textures(): void {
  const T = join(RAW, "Base Characters/Textures");
  const H = join(RAW, "Hairstyles/Textures");
  const jobs: [string, string, number, string][] = [
    [join(T, "T_Superhero_Male_Ligh.png"), "m_albedo.jpg", 1024, "skin"],
    [join(T, "T_Superhero_Male_Normal.png"), "m_normal.jpg", 1024, "normal"],
    [join(T, "T_Superhero_Male_Roughness.png"), "m_rough.jpg", 512, "gray"],
    [join(T, "T_Superhero_Female_Light_BaseColor.png"), "f_albedo.jpg", 1024, "skin"],
    [join(T, "T_Superhero_Female_Normal.png"), "f_normal.jpg", 1024, "normal"],
    [join(T, "T_Superhero_Female_Roughness.png"), "f_rough.jpg", 512, "gray"],
    [join(T, "T_Eye_Brown.png"), "eye.jpg", 256, "albedo"],
    [join(T, "T_Hair_1_BaseColor.png"), "hair1_albedo.jpg", 1024, "albedo"],
    [join(T, "T_Hair_1_Normal.png"), "hair1_normal.jpg", 512, "normal"],
    [join(T, "T_Hair_2_BaseColor.png"), "hair2_albedo.jpg", 1024, "albedo"],
    [join(T, "T_Hair_2_Normal.png"), "hair2_normal.jpg", 512, "normal"],
  ];
  void H;
  const py = `
import sys, json
from PIL import Image
jobs = json.loads(sys.argv[1]); out = sys.argv[2]
for src, dst, size, kind in jobs:
    im = Image.open(src)
    if kind == "gray":
        im = im.convert("L")
    else:
        im = im.convert("RGB")
    im = im.resize((size, size), Image.LANCZOS)
    if kind == "normal":
        # Soften sculpted muscle detail by half (natural, not bodybuilder); keep the tangent-space encoding.
        flat = Image.new("RGB", im.size, (128, 128, 255))
        im = Image.blend(flat, im, 0.55)
    if kind == "skin":
        # A neutral skin-detail map: divide by the average skin colour so skin sits at mid-grey (0.66) and keeps
        # its relative variation (lips, cheeks, creases); the game multiplies it by each person's skin tone.
        small = im.resize((128, 128))
        px = [p for p in small.getdata() if p[0] > 90 and p[0] > p[1] + 15 and p[1] > p[2]]
        mean = [sum(c[i] for c in px) / len(px) for i in range(3)]
        bands = [b.point(lambda v, m=mean[i]: max(0, min(255, int(v / m * 0.66 * 255)))) for i, b in enumerate(im.split())]
        im = Image.merge("RGB", bands)
    im.save(out + "/" + dst, "JPEG", quality=86 if kind != "normal" else 90, optimize=True)
`;
  execFileSync("python3", ["-I", "-c", py, JSON.stringify(jobs), OUT], { stdio: "inherit" });
}

/* ------------------------------------------------------------------ main */

function fitOf(meshes: { name: string; mesh: Mesh }[], p1: V3[]) {
  const body = meshes.find((m) => m.name === "body")!.mesh;
  const box = (pred: (i: number) => boolean) => {
    const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < body.pos.length / 3; i++) {
      if (!pred(i)) continue;
      for (let c = 0; c < 3; c++) {
        mn[c] = Math.min(mn[c]!, body.pos[i * 3 + c]!);
        mx[c] = Math.max(mx[c]!, body.pos[i * 3 + c]!);
      }
    }
    return { min: mn.map((v) => +v.toFixed(4)), max: mx.map((v) => +v.toFixed(4)) };
  };
  const dom = (i: number) => body.joints[i * 4]!;
  const hairBoxes = meshes.filter((m) => m.name.startsWith("hair_")).flatMap((m) => [...m.mesh.pos]);
  let hairTop = -Infinity;
  for (let i = 1; i < hairBoxes.length; i += 3) hairTop = Math.max(hairTop, hairBoxes[i]!);
  return {
    head: box((i) => dom(i) === B.Head),
    hair: { min: [null, null, null], max: [null, Number.isFinite(hairTop) ? +hairTop.toFixed(4) : null, null] },
    neck: box((i) => dom(i) === B.Neck),
    chest: box((i) => dom(i) === B.Spine2 || dom(i) === B.LShoulder || dom(i) === B.RShoulder),
    joints: { head: p1[B.Head]!.map((v) => +v.toFixed(4)), neck: p1[B.Neck]!.map((v) => +v.toFixed(4)), spine2: p1[B.Spine2]!.map((v) => +v.toFixed(4)), headTop: p1[B.HeadTop]!.map((v) => +v.toFixed(4)), lArm: p1[B.LArm]!.map((v) => +v.toFixed(4)) },
  };
}

function main(): void {
  mkdirSync(OUT, { recursive: true });
  const refPack = decodeClipPack(readFileSync(join(GAME, "assets/anim/locomotion.glb")));
  const ref = new Skeleton(refPack.rest.rot, refPack.rest.pos);
  const G = join(RAW, "Base Characters/Godot - UE");
  const HR = join(RAW, "Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)");
  const bases: { key: string; file: string; female: boolean; hair: string[] }[] = [
    { key: "base_m", file: join(G, "Superhero_Male_FullBody.gltf"), female: false, hair: ["Hair_SimpleParted", "Hair_Buzzed", "Hair_Beard"] },
    { key: "base_f", file: join(G, "Superhero_Female_FullBody.gltf"), female: true, hair: ["Hair_Long", "Hair_Buns", "Hair_BuzzedFemale"] },
  ];
  const index: Record<string, unknown> = {};
  for (const b of bases) {
    const src = meshesOf(b.file);
    // Name meshes by their material: MI_Eyes = eyes, MI_Hair_* on the body file = eyebrows, the rest = body.
    const named = src.meshes.map((m) => ({ ...m, name: /eyes/i.test(m.material ?? "") ? "eyes" : /hair/i.test(m.material ?? "") ? "brows" : "body" }));
    for (const h of b.hair) {
      const hm = meshesOf(join(HR, `${h}.gltf`));
      for (const m of hm.meshes) named.push({ ...m, name: `hair_${h.replace(/^Hair_/, "").toLowerCase()}` });
    }
    const rawHeight = Math.max(...named.filter((m) => m.name === "body").flatMap((m) => m.mesh.pos.filter((_, i) => i % 3 === 1)));
    const built = build(ref, src.joints, named, rawHeight);
    const bytes = writeGlb(join(OUT, `${b.key}.glb`), built.rest, built.ibm, built.meshes, { source: "Quaternius Universal Base Characters (Standard), CC0" });
    const sk = new Skeleton(built.rest.rot, built.rest.pos, ref.hipHeight);
    const height = Math.max(...built.meshes.filter((m) => m.name === "body").flatMap((m) => m.mesh.pos.filter((_, i) => i % 3 === 1)));
    index[b.key] = {
      file: `${b.key}.glb`, female: b.female, height: +height.toFixed(3), hipHeight: +sk.hipHeight.toFixed(4), rig: "mib_rig",
      meshes: built.meshes.map((m) => ({ name: m.name, tris: m.mesh.idx.length / 3 })),
      textures: { albedo: `${b.female ? "f" : "m"}_albedo.jpg`, normal: `${b.female ? "f" : "m"}_normal.jpg`, rough: `${b.female ? "f" : "m"}_rough.jpg`, eye: "eye.jpg", hair: b.female ? "hair2" : "hair1" },
      fit: fitOf(built.meshes, built.p1),
    };
    console.log(`${b.key}: ${(bytes / 1024).toFixed(0)} KB, height ${height.toFixed(2)} m, hips ${sk.hipHeight.toFixed(3)}, largest bind alignment ${built.maxTurn.toFixed(1)} deg (${built.maxBone}), meshes ${built.meshes.map((m) => `${m.name}:${m.mesh.idx.length / 3}`).join(" ")}`);
  }
  writeFileSync(join(OUT, "index.json"), JSON.stringify(index, null, 1));
  textures();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
