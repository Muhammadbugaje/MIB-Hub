/**
 * The realistic base bodies (Quaternius Universal Base Characters, CC0; packed
 * by tools/anim/pack-ubc.ts into assets/people2): a male and a female base
 * with good shoulder topology and skin weights, eyes, eyebrows, and
 * head-rigged hairstyles, all on mib_rig.
 *
 * Clothing is made here from the body's own surface: the triangles of a
 * garment's region (torso, sleeves to a length, legs, feet) are copied and
 * pushed out a few millimetres along the welded normals, keeping the body's
 * skin weights. A garment therefore bends exactly with the body and can never
 * be poked through (plan rule C3: "clothes are skinned to the same rig"),
 * and the body triangles it covers are removed (no z-fighting, less to draw).
 * A modest tunic adds a short flared skirt to the knee over trousers.
 *
 * Every person = body (skin texture tinted by their tone) + one clothes mesh
 * (all garments, coloured from a tiny palette, one draw) + hair + eyes + brows.
 * The ten body keys the cast, crowd and menu already use (casual, hoodie,
 * womandress...) are now outfit styles on these two bases.
 */
import * as pc from "playcanvas";
import { MORPH_NAMES, morphDeltas, smoothNormals, type Mesh } from "../anim/meshops.ts";
import { B, BONE_COUNT, BONE_INDEX, MIB_BONES, Skeleton, fk, wpos } from "../anim/skeleton.ts";
import type { V3 } from "../anim/math.ts";

export interface BaseInfo {
  file: string;
  female: boolean;
  height: number;
  hipHeight: number;
  textures: { albedo: string; normal: string; rough: string; eye: string; hair: string };
  fit: unknown;
}

/** An outfit style on a base: which garments, and which palette slot colours each (slot names drive the menu). */
export interface Style {
  base: "base_m" | "base_f";
  top: "tee" | "elbow" | "long" | "tunic";
  bottom: "trousers" | "shorts";
  slots: string[];
  topSlot: number;
  bottomSlot: number;
  shoeSlot: number;
  /** Default hairstyles for this style (picked per person). */
  hair: string[];
}

/** The old body keys, now outfit styles (slot order matches the cast's outfit arrays in game/cast.ts). */
export const STYLES: Record<string, Style> = {
  casual: { base: "base_m", top: "tee", bottom: "trousers", slots: ["Shirt", "Sleeves", "Trousers", "Shoes"], topSlot: 0, bottomSlot: 2, shoeSlot: 3, hair: ["simpleparted", "buzzed"] },
  hoodie: { base: "base_m", top: "long", bottom: "trousers", slots: ["Hoodie", "Trim", "Trousers"], topSlot: 0, bottomSlot: 2, shoeSlot: 1, hair: ["buzzed", "simpleparted"] },
  business: { base: "base_m", top: "long", bottom: "trousers", slots: ["Suit", "Black", "Shirt", "Tie"], topSlot: 0, bottomSlot: 0, shoeSlot: 1, hair: ["simpleparted"] },
  farmer: { base: "base_m", top: "long", bottom: "trousers", slots: ["Overalls", "Shirt", "Trousers", "Hat", "Scarf"], topSlot: 1, bottomSlot: 2, shoeSlot: 0, hair: ["buzzed"] },
  man: { base: "base_m", top: "tee", bottom: "trousers", slots: ["Shirt2", "Shirt", "Trousers", "Shoes", "Socks"], topSlot: 1, bottomSlot: 2, shoeSlot: 3, hair: ["buzzed", "simpleparted"] },
  manlong: { base: "base_m", top: "long", bottom: "trousers", slots: ["Shirt", "Trousers"], topSlot: 0, bottomSlot: 1, shoeSlot: 1, hair: ["simpleparted", "buzzed"] },
  mansuit: { base: "base_m", top: "long", bottom: "trousers", slots: ["Shirt", "Trousers"], topSlot: 0, bottomSlot: 1, shoeSlot: 1, hair: ["simpleparted"] },
  womancasual: { base: "base_f", top: "elbow", bottom: "trousers", slots: ["Top", "Trousers", "Shoes", "Socks"], topSlot: 0, bottomSlot: 1, shoeSlot: 2, hair: ["long", "buns"] },
  animwoman: { base: "base_f", top: "long", bottom: "trousers", slots: ["Top", "Trousers", "Trim", "Shoes"], topSlot: 0, bottomSlot: 1, shoeSlot: 3, hair: ["long", "buns"] },
  womandress: { base: "base_f", top: "tunic", bottom: "trousers", slots: ["Dress", "Trim", "Belt"], topSlot: 0, bottomSlot: 0, shoeSlot: 1, hair: ["buns", "long"] },
};

/** Body arrays by mesh name, plus the skeleton rest TRS, from a packed base GLB. */
export interface BaseGeometry {
  meshes: Map<string, { mesh: Mesh; nor: number[] }>;
  rest: { rot: Float32Array; pos: Float32Array };
  ibm: Float32Array;
}

const COMPS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

export function parseBase(buf: ArrayBuffer): BaseGeometry {
  const dv = new DataView(buf);
  const jl = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jl))) as {
    nodes: { name?: string; rotation?: number[]; translation?: number[]; mesh?: number }[];
    meshes: { name: string; primitives: { attributes: Record<string, number>; indices: number }[] }[];
    skins: { inverseBindMatrices: number }[];
    accessors: { bufferView: number; byteOffset?: number; componentType: number; count: number; type: string; normalized?: boolean }[];
    bufferViews: { byteOffset?: number }[];
  };
  const binOff = 20 + jl + 8;
  const read = (i: number): number[] => {
    const a = json.accessors[i]!;
    const o = binOff + (json.bufferViews[a.bufferView]!.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const n = a.count * COMPS[a.type]!;
    const out = new Array<number>(n);
    for (let k = 0; k < n; k++) {
      switch (a.componentType) {
        case 5126: out[k] = dv.getFloat32(o + k * 4, true); break;
        case 5125: out[k] = dv.getUint32(o + k * 4, true); break;
        case 5123: out[k] = dv.getUint16(o + k * 2, true); break;
        default: out[k] = dv.getUint8(o + k) / (a.normalized ? 255 : 1);
      }
    }
    return out;
  };
  const meshes = new Map<string, { mesh: Mesh; nor: number[] }>();
  for (const m of json.meshes) {
    const p = m.primitives[0]!, at = p.attributes;
    meshes.set(m.name, { mesh: { pos: read(at.POSITION!), uv: read(at.TEXCOORD_0!), joints: read(at.JOINTS_0!), weights: read(at.WEIGHTS_0!), idx: read(p.indices) }, nor: read(at.NORMAL!) });
  }
  const rest = { rot: new Float32Array(BONE_COUNT * 4), pos: new Float32Array(BONE_COUNT * 3) };
  for (const n of json.nodes) {
    const b = BONE_INDEX[n.name ?? ""];
    if (b === undefined) continue;
    rest.rot.set(n.rotation ?? [0, 0, 0, 1], b * 4);
    rest.pos.set(n.translation ?? [0, 0, 0], b * 3);
  }
  return { meshes, rest, ibm: Float32Array.from(read(json.skins[0]!.inverseBindMatrices)) };
}

/* ------------------------------------------------------------------ clothing from the body surface */

interface Garments {
  /** The body with the covered triangles removed (and its garment seams cut finely). */
  body: Mesh;
  bodyNor: number[];
  /** All garments as one mesh with palette UVs. */
  clothes: Mesh;
  clothesNor: number[];
}

/** Region landmarks of a base in its rest (T) pose. */
function landmarks(sk: Skeleton) {
  const w = fk(sk, sk.restPose());
  const p = (b: number) => wpos(w, b);
  return {
    hipY: p(B.Hips)[1], neckY: p(B.Neck)[1], neckZ: p(B.Neck)[2], chestY: p(B.Spine2)[1],
    shoulderX: Math.abs(p(B.LArm)[0]), elbowX: Math.abs(p(B.LForeArm)[0]), wristX: Math.abs(p(B.LHand)[0]),
    kneeY: p(B.LLeg)[1], ankleY: p(B.LFoot)[1], armY: p(B.LArm)[1],
  };
}

export function makeGarments(body: { mesh: Mesh; nor: number[] }, sk: Skeleton, style: Style): Garments {
  const m = body.mesh;
  const L = landmarks(sk);
  const welded = smoothNormals(m, 180);
  const sleeveEnd = style.top === "tee" ? L.shoulderX + 0.13 : style.top === "elbow" ? L.elbowX + 0.04 : L.wristX - 0.03;
  // Per-vertex garment membership (by position in the T-pose; arms lie along +-x).
  const isArm = (v: V3) => Math.abs(v[0]) > L.shoulderX - 0.015 && v[1] > L.armY - 0.2;
  const top = (v: V3) => {
    // The head is not shirt: cap the torso just above the collar. Without this the top region (everything above
    // the hem) covered the whole head in cloth, which read as a pale "mask" with a torn jaw line.
    if (isArm(v)) return Math.abs(v[0]) < sleeveEnd;
    if (v[1] > L.neckY + 0.015) return false;
    // A crew neckline is a ring around the neck, not a plane across the shoulders: cutting by height alone
    // shaved the top of the shoulder bare (the "torn shirt" the cast shot showed).
    if (v[1] > L.neckY - 0.03) {
      const nx = v[0], nz = v[2] - L.neckZ;
      if (nx * nx + nz * nz < 0.078 * 0.078) return false;
    }
    return v[1] > L.hipY - (style.top === "tunic" ? 0.12 : 0.06);
  };
  const legBottom = style.bottom === "shorts" ? L.kneeY + 0.08 : L.ankleY + 0.035;
  const bottom = (v: V3) => !isArm(v) && v[1] < L.hipY + 0.05 && v[1] > legBottom;
  const shoe = (v: V3) => !isArm(v) && v[1] <= L.ankleY + 0.05;
  // The standoff each garment keeps from the skin. Clothes are not paint: a tee or a trouser leg stands a
  // centimetre or two proud of the body, which is what makes the silhouette read as fabric rather than anatomy.
  const garments: { test: (v: V3) => boolean; slot: number; off: number }[] = [
    { test: shoe, slot: style.shoeSlot, off: 0.008 },
    { test: bottom, slot: style.bottomSlot, off: 0.013 },
    { test: top, slot: style.topSlot, off: 0.015 },
  ];
  const tri = m.idx.length / 3;
  // Which region a point on the body belongs to (first garment that claims it, else -1 for bare skin).
  const region = (p: V3): number => {
    for (let gi = 0; gi < garments.length; gi++) if (garments[gi]!.test(p)) return gi;
    return -1;
  };
  const vpos = [...m.pos], vnor = [...body.nor], vwel = [...welded], vuv = [...m.uv], vjoin = [...m.joints], vwgt = [...m.weights];
  const posOf = (v: number): V3 => [vpos[v * 3]!, vpos[v * 3 + 1]!, vpos[v * 3 + 2]!];
  const unit = (x: number, y: number, z: number): V3 => {
    const l = Math.hypot(x, y, z) || 1;
    return [x / l, y / l, z / l];
  };
  const lerpV = (a: number, b: number, t: number): number => {
    const id = vpos.length / 3;
    for (let c = 0; c < 3; c++) vpos.push(vpos[a * 3 + c]! + (vpos[b * 3 + c]! - vpos[a * 3 + c]!) * t);
    const nr = unit(vnor[a * 3]! + (vnor[b * 3]! - vnor[a * 3]!) * t, vnor[a * 3 + 1]! + (vnor[b * 3 + 1]! - vnor[a * 3 + 1]!) * t, vnor[a * 3 + 2]! + (vnor[b * 3 + 2]! - vnor[a * 3 + 2]!) * t);
    const wr = unit(vwel[a * 3]! + (vwel[b * 3]! - vwel[a * 3]!) * t, vwel[a * 3 + 1]! + (vwel[b * 3 + 1]! - vwel[a * 3 + 1]!) * t, vwel[a * 3 + 2]! + (vwel[b * 3 + 2]! - vwel[a * 3 + 2]!) * t);
    vnor.push(nr[0], nr[1], nr[2]); vwel.push(wr[0], wr[1], wr[2]);
    vuv.push(vuv[a * 2]! + (vuv[b * 2]! - vuv[a * 2]!) * t, vuv[a * 2 + 1]! + (vuv[b * 2 + 1]! - vuv[a * 2 + 1]!) * t);
    // Blend the skin weights by bone, then keep the heaviest four (the mesh's skinning rule).
    const acc = new Map<number, number>();
    for (const [v, k] of [[a, 1 - t], [b, t]] as const) for (let j = 0; j < 4; j++) {
      const bone = vjoin[v * 4 + j]!, w = vwgt[v * 4 + j]! * k;
      if (w > 0) acc.set(bone, (acc.get(bone) ?? 0) + w);
    }
    const best = [...acc.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4);
    const sum = best.reduce((s, e) => s + e[1], 0) || 1;
    for (let j = 0; j < 4; j++) { vjoin.push(best[j]?.[0] ?? 0); vwgt.push(best[j] ? best[j]![1] / sum : 0); }
    return id;
  };
  const mids = new Map<string, number>();
  const midpoint = (a: number, b: number): number => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    const had = mids.get(key);
    if (had !== undefined) return had;
    const id = lerpV(a, b, 0.5);
    mids.set(key, id);
    return id;
  };
  // Subdivide only the triangles that straddle a region edge, so a hem or neckline is cut finely (not on the
  // body's coarse triangle edges), then the leaves are clipped to the exact cut line below.
  const onSeam = (a: number, b: number, c: number) => region(posOf(a)) !== region(posOf(b)) || region(posOf(b)) !== region(posOf(c)) || region(posOf(a)) !== region(posOf(c));
  const leaves: number[] = [];
  const split = (a: number, b: number, c: number, depth: number): void => {
    if (depth === 0 || !onSeam(a, b, c)) { leaves.push(a, b, c); return; }
    const ab = midpoint(a, b), bc = midpoint(b, c), ca = midpoint(c, a);
    split(a, ab, ca, depth - 1); split(ab, b, bc, depth - 1); split(ca, bc, c, depth - 1); split(ab, bc, ca, depth - 1);
  };
  for (let t = 0; t < tri; t++) split(m.idx[t * 3]!, m.idx[t * 3 + 1]!, m.idx[t * 3 + 2]!, 4);
  const out: Mesh = { pos: [], uv: [], joints: [], weights: [], idx: [] };
  const outNor: number[] = [];
  const remaps = garments.map(() => new Map<number, number>());
  // Per output vertex: which garment it belongs to, and where on the body it was (drapeCloth uses both).
  const garmentOf: number[] = [];
  const home: number[] = [];
  const homeNor: number[] = [];
  const bodyIdx: number[] = [];
  // Sutherland-Hodgman clip of a triangle against "this point belongs to region `want`", with the crossing
  // found by bisection on the region test itself. That puts the new edge exactly on the cut surface (the
  // neck ring, a hem height, a sleeve plane), so hems and necklines are straight, clean lines, never a fringe
  // of stretched triangles over the skin.
  const intersect = (a: number, b: number, want: number): number => {
    let lo = 0, hi = 1;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      const p: V3 = [vpos[a * 3]! + (vpos[b * 3]! - vpos[a * 3]!) * mid, vpos[a * 3 + 1]! + (vpos[b * 3 + 1]! - vpos[a * 3 + 1]!) * mid, vpos[a * 3 + 2]! + (vpos[b * 3 + 2]! - vpos[a * 3 + 2]!) * mid];
      if (region(p) === want) hi = mid; else lo = mid;
    }
    return lerpV(a, b, (lo + hi) / 2);
  };
  const clip = (poly: number[], want: number): number[] => {
    const res: number[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
      const ina = region(posOf(a)) === want, inb = region(posOf(b)) === want;
      if (ina) res.push(a);
      if (ina !== inb) res.push(intersect(a, b, want));
    }
    return res;
  };
  const fan = (poly: number[], emit: (a: number, b: number, c: number) => void) => {
    for (let i = 1; i + 1 < poly.length; i++) emit(poly[0]!, poly[i]!, poly[i + 1]!);
  };
  const garmentVert = (gi: number, v: number): number => {
    const remap = remaps[gi]!;
    const had = remap.get(v);
    if (had !== undefined) return had;
    const g = garments[gi]!;
    const k = out.pos.length / 3;
    remap.set(v, k);
    const p = posOf(v), nx = vwel[v * 3]!, ny = vwel[v * 3 + 1]!, nz = vwel[v * 3 + 2]!;
    out.pos.push(p[0] + nx * g.off, p[1] + ny * g.off, p[2] + nz * g.off);
    outNor.push(nx, ny, nz);
    garmentOf.push(gi);
    home.push(p[0], p[1], p[2]);
    homeNor.push(nx, ny, nz);
    out.uv.push((g.slot + 0.5) / 16, 0.5);
    for (let j = 0; j < 4; j++) {
      out.joints.push(vjoin[v * 4 + j]!);
      out.weights.push(vwgt[v * 4 + j]!);
    }
    return k;
  };
  for (let t = 0; t < leaves.length; t += 3) {
    const a = leaves[t]!, b = leaves[t + 1]!, c = leaves[t + 2]!;
    const p = posOf(a), q = posOf(b), r = posOf(c);
    const centre: V3 = [(p[0] + q[0] + r[0]) / 3, (p[1] + q[1] + r[1]) / 3, (p[2] + q[2] + r[2]) / 3];
    const gi = region(centre);
    if (gi < 0) {
      // Bare skin: cut away whatever belongs to a garment so the two sides share one seam line.
      fan(clip([a, b, c], -1), (x, y, z) => bodyIdx.push(x, y, z));
      continue;
    }
    const poly = clip([a, b, c], gi);
    fan(poly, (x, y, z) => out.idx.push(garmentVert(gi, x), garmentVert(gi, y), garmentVert(gi, z)));
  }
  drapeCloth(out, garmentOf, home, homeNor, garments.map((g) => g.off));
  if (style.top === "tunic") addSkirt(out, outNor, m, L, style.topSlot);
  // Fabric shading: normals from the garment's own draped surface, not the muscles underneath.
  const fabricNor = smoothNormals(out, 180);
  const bodyMesh: Mesh = { pos: vpos, uv: vuv, joints: vjoin, weights: vwgt, idx: bodyIdx };
  return { body: bodyMesh, bodyNor: vnor, clothes: out, clothesNor: fabricNor };
}

/**
 * Cloth drape: the garment starts as the body surface pushed out along its normals, which is why it used to
 * read as paint (every muscle, the cleavage and the spine showed through the "shirt"). Laplacian smoothing of
 * that shell pulls it across concave anatomy the way fabric bridges a gap, and a per-vertex clamp keeps it
 * outside the skin (no poke-through). Hems, cuffs and the neckline are anchored (their sewing line) so the
 * edges stay clean and the cloth falls away from them over the next few millimetres.
 */
function drapeCloth(out: Mesh, garmentOf: number[], home: number[], homeNor: number[], offs: number[]): void {
  const n = garmentOf.length;
  if (!n) return;
  const adj: number[][] = Array.from({ length: n }, () => []);
  const edges = new Map<string, number>();
  const edge = (a: number, b: number) => {
    if (a === b) return;
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    edges.set(key, (edges.get(key) ?? 0) + 1);
  };
  for (let t = 0; t < out.idx.length; t += 3) {
    const a = out.idx[t]!, b = out.idx[t + 1]!, c = out.idx[t + 2]!;
    edge(a, b); edge(b, c); edge(c, a);
    adj[a]!.push(b, c); adj[b]!.push(a, c); adj[c]!.push(a, b);
  }
  // Boundary = a vertex on an edge used by one triangle (a hem or a seam).
  const dist = new Int32Array(n).fill(-1);
  const queue: number[] = [];
  for (const [key, count] of edges) {
    if (count !== 1) continue;
    for (const s of key.split(":")) {
      const v = Number(s);
      if (dist[v] !== -1) continue;
      dist[v] = 0;
      queue.push(v);
    }
  }
  for (let q = 0; q < queue.length; q++) {
    const v = queue[q]!;
    for (const w of adj[v]!) if (dist[w] === -1) { dist[w] = dist[v]! + 1; queue.push(w); }
  }
  const pos = out.pos;
  // The sewing line sits on the skin and the cloth falls away from it over a few centimetres (a hem that
  // floats a full centimetre above bare skin looks like a cut-out, not a garment).
  for (let v = 0; v < n; v++) {
    const k = 0.25 + 0.75 * Math.min(1, (dist[v]! < 0 ? 6 : dist[v]!) / 6);
    for (let c = 0; c < 3; c++) pos[v * 3 + c] = home[v * 3 + c]! + (pos[v * 3 + c]! - home[v * 3 + c]!) * k;
  }
  const next = [...pos];
  for (let iter = 0; iter < 5; iter++) {
    next.splice(0, next.length, ...pos);
    for (let v = 0; v < n; v++) {
      const d = dist[v]!;
      if (d >= 0 && d < 2) continue; // anchored sewing line
      const w = d < 0 ? 1 : Math.min(1, (d - 1) / 6); // ease away from the edge
      const nb = adj[v]!;
      if (!nb.length) continue;
      let ax = 0, ay = 0, az = 0;
      for (const u of nb) { ax += pos[u * 3]!; ay += pos[u * 3 + 1]!; az += pos[u * 3 + 2]!; }
      const k = w * 0.7;
      next[v * 3] = pos[v * 3]! + (ax / nb.length - pos[v * 3]!) * k;
      next[v * 3 + 1] = pos[v * 3 + 1]! + (ay / nb.length - pos[v * 3 + 1]!) * k;
      next[v * 3 + 2] = pos[v * 3 + 2]! + (az / nb.length - pos[v * 3 + 2]!) * k;
    }
    pos.splice(0, pos.length, ...next);
  }
  // Never let the smoothed cloth sink into the skin: measure from the body vertex it was cut from.
  for (let v = 0; v < n; v++) {
    const d = dist[v]!;
    if (d >= 0 && d < 2) continue;
    const nx = homeNor[v * 3]!, ny = homeNor[v * 3 + 1]!, nz = homeNor[v * 3 + 2]!;
    const along = (pos[v * 3]! - home[v * 3]!) * nx + (pos[v * 3 + 1]! - home[v * 3 + 1]!) * ny + (pos[v * 3 + 2]! - home[v * 3 + 2]!) * nz;
    // Only enough standoff to stay outside the skin: a deep crease (under the bust, the small of the back)
    // must be allowed to close, or the cloth keeps the body's shape and reads as paint again.
    const min = offs[garmentOf[v]!]! * 0.18;
    if (along < min) {
      const push = min - along;
      pos[v * 3] = pos[v * 3]! + nx * push;
      pos[v * 3 + 1] = pos[v * 3 + 1]! + ny * push;
      pos[v * 3 + 2] = pos[v * 3 + 2]! + nz * push;
    }
  }
}

/**
 * A modest tunic's skirt: a flared tube from the hips to just below the knee
 * (worn over trousers). The side of the skirt over each leg follows that leg
 * more towards the hem, so a stride never pushes a knee through it.
 */
function addSkirt(out: Mesh, nor: number[], body: Mesh, L: ReturnType<typeof landmarks>, slot: number): void {
  // Hip width and depth from the body at hip height.
  let rx = 0.12, rzF = 0.1, rzB = 0.12;
  for (let i = 0; i < body.pos.length / 3; i++) {
    const y = body.pos[i * 3 + 1]!;
    if (Math.abs(y - (L.hipY - 0.05)) > 0.03) continue;
    const x = body.pos[i * 3]!, z = body.pos[i * 3 + 2]!;
    if (Math.abs(x) > 0.3) continue;
    rx = Math.max(rx, Math.abs(x));
    if (z > 0) rzF = Math.max(rzF, z);
    else rzB = Math.max(rzB, -z);
  }
  const top = L.hipY - 0.02, hem = L.kneeY - 0.1;
  const rings = 9, seg = 36;
  const base = out.pos.length / 3;
  for (let r = 0; r <= rings; r++) {
    const u = r / rings;
    const y = top + (hem - top) * u;
    const flare = 0.022 + 0.085 * u * u;
    for (let s = 0; s < seg; s++) {
      const a = (s / seg) * Math.PI * 2;
      const sx = Math.sin(a), cz = Math.cos(a);
      const x = sx * (rx + flare);
      const z = cz > 0 ? cz * (rzF + flare) : cz * (rzB + flare);
      out.pos.push(x, y, z);
      const nl = Math.hypot(sx, 0.15 * u, cz) || 1;
      nor.push(sx / nl, (-0.15 * u) / nl, cz / nl);
      out.uv.push((slot + 0.5) / 16, 0.5);
      // Hips at the waist; towards the hem, more of the leg on this side.
      const legW = 0.62 * u * Math.min(1, Math.abs(sx) * 0.5 + 0.5);
      const leg = x >= 0 ? B.LUpLeg : B.RUpLeg;
      out.joints.push(B.Hips, leg, B.Hips, B.Hips);
      out.weights.push(1 - legW, legW, 0, 0);
    }
  }
  for (let r = 0; r < rings; r++)
    for (let s = 0; s < seg; s++) {
      const a = base + r * seg + s, b = base + r * seg + ((s + 1) % seg), c = base + (r + 1) * seg + s, d = base + (r + 1) * seg + ((s + 1) % seg);
      out.idx.push(a, c, b, b, c, d);
    }
}

/* ------------------------------------------------------------------ engine meshes */

export function toPcMesh(device: pc.GraphicsDevice, m: Mesh, nor: number[], skin: pc.Skin, idx?: number[], morph = true): pc.Mesh {
  const mesh = new pc.Mesh(device);
  mesh.setPositions(Float32Array.from(m.pos));
  mesh.setNormals(Float32Array.from(nor));
  mesh.setUvs(0, Float32Array.from(m.uv));
  mesh.setVertexStream(pc.SEMANTIC_BLENDINDICES, Uint8Array.from(m.joints), 4, pc.TYPE_UINT8);
  mesh.setVertexStream(pc.SEMANTIC_BLENDWEIGHT, Float32Array.from(m.weights), 4, pc.TYPE_FLOAT32);
  const ix = idx ?? m.idx;
  mesh.setIndices(m.pos.length / 3 > 65535 ? Uint32Array.from(ix) : Uint16Array.from(ix));
  mesh.update(pc.PRIMITIVE_TRIANGLES);
  mesh.skin = skin;
  if (morph) mesh.morph = new pc.Morph(morphDeltas(m).map((d, i) => new pc.MorphTarget({ deltaPositions: Float32Array.from(d), name: MORPH_NAMES[i]! })), device);
  return mesh;
}

export interface BaseKit {
  key: string;
  info: BaseInfo;
  geo: BaseGeometry;
  skeleton: Skeleton;
  skin: pc.Skin;
  boneNames: string[];
  tex: { albedo: pc.Texture; normal: pc.Texture; rough: pc.Texture; eye: pc.Texture; hair: pc.Texture; hairNormal: pc.Texture };
  meshes: { eyes: pc.Mesh | null; brows: pc.Mesh | null; hair: Map<string, pc.Mesh> };
  /** Per style: the body without the covered triangles, and the clothes. */
  outfits: Map<string, { body: pc.Mesh; clothes: pc.Mesh }>;
}

function loadTexture(app: pc.AppBase, url: string, srgb: boolean): Promise<pc.Texture> {
  return new Promise((res, rej) => {
    const asset = new pc.Asset(url, "texture", { url }, { srgb, mipmaps: true });
    asset.once("load", () => res(asset.resource as pc.Texture));
    asset.once("error", (e: unknown) => rej(new Error(String(e))));
    app.assets.add(asset);
    app.assets.load(asset);
  });
}

export async function loadBases(app: pc.AppBase, base: string, refHip: number): Promise<Map<string, BaseKit>> {
  const index = (await (await fetch(`${base}people2/index.json`)).json()) as Record<string, BaseInfo>;
  const kits = new Map<string, BaseKit>();
  const device = app.graphicsDevice;
  await Promise.all(Object.entries(index).map(async ([key, info]) => {
    const buf = await (await fetch(`${base}people2/${info.file}`)).arrayBuffer();
    const geo = parseBase(buf);
    const boneNames = MIB_BONES.map(([n]) => n);
    const ibp: pc.Mat4[] = [];
    for (let i = 0; i < BONE_COUNT; i++) ibp.push(new pc.Mat4().set(Array.from(geo.ibm.subarray(i * 16, i * 16 + 16))));
    const skin = new pc.Skin(device, ibp, boneNames);
    const t = info.textures;
    const [albedo, normal, rough, eye, hair, hairNormal] = await Promise.all([
      loadTexture(app, `${base}people2/${t.albedo}`, true), loadTexture(app, `${base}people2/${t.normal}`, false), loadTexture(app, `${base}people2/${t.rough}`, false),
      loadTexture(app, `${base}people2/${t.eye}`, true), loadTexture(app, `${base}people2/${t.hair}_albedo.jpg`, true), loadTexture(app, `${base}people2/${t.hair}_normal.jpg`, false),
    ]);
    const mk = (name: string) => {
      const g = geo.meshes.get(name);
      return g ? toPcMesh(device, g.mesh, g.nor, skin, undefined, false) : null;
    };
    const hairMeshes = new Map<string, pc.Mesh>();
    for (const name of geo.meshes.keys()) if (name.startsWith("hair_")) hairMeshes.set(name.slice(5), mk(name)!);
    kits.set(key, {
      key, info, geo, skeleton: new Skeleton(geo.rest.rot, geo.rest.pos, refHip), skin, boneNames,
      tex: { albedo, normal, rough, eye, hair, hairNormal },
      meshes: { eyes: mk("eyes"), brows: mk("brows"), hair: hairMeshes },
      outfits: new Map(),
    });
  }));
  return kits;
}

/** The body and clothes meshes for a style (built once per style). */
export function outfitOf(device: pc.GraphicsDevice, kit: BaseKit, styleKey: string): { body: pc.Mesh; clothes: pc.Mesh } {
  let o = kit.outfits.get(styleKey);
  if (o) return o;
  const style = STYLES[styleKey]!;
  const body = kit.geo.meshes.get("body")!;
  const g = makeGarments(body, kit.skeleton, style);
  o = { body: toPcMesh(device, g.body, g.bodyNor, kit.skin), clothes: toPcMesh(device, g.clothes, g.clothesNor, kit.skin) };
  kit.outfits.set(styleKey, o);
  return o;
}

/** The skin colour multiplier for the skin-detail texture (it averages 0.66 grey on skin). */
export function skinTint(hex: string): pc.Color {
  const c = new pc.Color().fromString(hex);
  const lin = (v: number) => Math.pow(v, 2.2);
  const k = 1 / lin(0.66);
  const out = (v: number) => Math.pow(lin(v) * k, 1 / 2.2);
  return new pc.Color(out(c.r), out(c.g), out(c.b));
}
