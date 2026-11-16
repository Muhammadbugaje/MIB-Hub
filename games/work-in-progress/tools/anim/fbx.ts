/**
 * A small, dependency-free reader for binary FBX files (the format Mixamo
 * downloads come in). It reads exactly what the animation pipeline needs:
 *
 *   - the node tree (Models: LimbNode bones, Null, Mesh) with their local
 *     transforms, including FBX's pre/post rotations, pivots and offsets;
 *   - animation curves (AnimationStack -> Layer -> CurveNode -> Curve) for
 *     translation, rotation and scale;
 *   - whether the file carries a skinned mesh (Geometry + Skin deformer), and
 *     the bind pose of every bone (from the clusters' TransformLink);
 *   - the scene settings (unit scale, frame rate, up axis).
 *
 * Why our own reader: FBX2glTF needs a native binary per platform and a
 * network download; three.js's loader wants a DOM. This file runs in plain
 * Node on macOS 12 offline, and every number it produces is checkable.
 *
 * Format notes (from the FBX SDK docs and the Blender importer):
 *   header "Kaydara FBX Binary  \0" + 0x1A 0x00 + uint32 version;
 *   node record: endOffset, numProps, propListLen (uint32, or uint64 from
 *   version 7500), nameLen (uint8), name, properties, nested records, and a
 *   null record that ends a nested list;
 *   property codes: Y i16, C bool, I i32, F f32, D f64, L i64, S/R bytes,
 *   f/d/l/i/b arrays (length, encoding 0 raw | 1 zlib, compressed length).
 */
import { inflateSync } from "node:zlib";

export type FbxProp = number | bigint | boolean | string | Buffer | Float32Array | Float64Array | Int32Array | BigInt64Array | Uint8Array;

export interface FbxNode {
  name: string;
  props: FbxProp[];
  children: FbxNode[];
}

/** FBX time unit: ticks per second. */
export const FBX_TICKS = 46186158000;

export function parseFbxBinary(buf: Buffer): FbxNode[] {
  const magic = buf.subarray(0, 20).toString("latin1");
  if (!magic.startsWith("Kaydara FBX Binary")) throw new Error("not a binary FBX file");
  const version = buf.readUInt32LE(23);
  const wide = version >= 7500;
  let pos = 27;

  const readProp = (): FbxProp => {
    const code = String.fromCharCode(buf[pos]!);
    pos += 1;
    switch (code) {
      case "Y": { const v = buf.readInt16LE(pos); pos += 2; return v; }
      case "C": { const v = buf[pos]! !== 0; pos += 1; return v; }
      case "I": { const v = buf.readInt32LE(pos); pos += 4; return v; }
      case "F": { const v = buf.readFloatLE(pos); pos += 4; return v; }
      case "D": { const v = buf.readDoubleLE(pos); pos += 8; return v; }
      case "L": { const v = buf.readBigInt64LE(pos); pos += 8; return v; }
      case "S": case "R": {
        const len = buf.readUInt32LE(pos);
        pos += 4;
        const b = buf.subarray(pos, pos + len);
        pos += len;
        return code === "S" ? b.toString("utf8") : Buffer.from(b);
      }
      case "f": case "d": case "l": case "i": case "b": {
        const n = buf.readUInt32LE(pos);
        const enc = buf.readUInt32LE(pos + 4);
        const clen = buf.readUInt32LE(pos + 8);
        pos += 12;
        let raw = buf.subarray(pos, pos + clen);
        pos += clen;
        if (enc === 1) raw = inflateSync(raw);
        const copy = Buffer.from(raw); // aligned copy
        const ab = copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength);
        if (code === "f") return new Float32Array(ab, 0, n);
        if (code === "d") return new Float64Array(ab, 0, n);
        if (code === "l") return new BigInt64Array(ab, 0, n);
        if (code === "i") return new Int32Array(ab, 0, n);
        return new Uint8Array(ab, 0, n);
      }
      default:
        throw new Error(`unknown FBX property type '${code}' at ${pos - 1}`);
    }
  };

  const readNode = (): FbxNode | null => {
    const end = wide ? Number(buf.readBigUInt64LE(pos)) : buf.readUInt32LE(pos);
    const nprops = wide ? Number(buf.readBigUInt64LE(pos + 8)) : buf.readUInt32LE(pos + 4);
    pos += wide ? 24 : 12;
    const nameLen = buf[pos]!;
    pos += 1;
    if (end === 0) return null;
    const name = buf.subarray(pos, pos + nameLen).toString("latin1");
    pos += nameLen;
    const props: FbxProp[] = [];
    for (let i = 0; i < nprops; i++) props.push(readProp());
    const children: FbxNode[] = [];
    while (pos < end) {
      const c = readNode();
      if (!c) break;
      children.push(c);
    }
    pos = end;
    return { name, props, children };
  };

  const top: FbxNode[] = [];
  while (pos < buf.length - 13) {
    const n = readNode();
    if (!n) break;
    top.push(n);
  }
  return top;
}

const child = (n: FbxNode | undefined, name: string) => n?.children.find((c) => c.name === name);

/** Properties70 -> map of name -> values (numbers, strings). */
function props70(n: FbxNode | undefined): Map<string, FbxProp[]> {
  const out = new Map<string, FbxProp[]>();
  const p70 = child(n, "Properties70");
  if (!p70) return out;
  for (const p of p70.children) if (p.name === "P") out.set(String(p.props[0]), p.props.slice(4));
  return out;
}

const num3 = (v: FbxProp[] | undefined, d: [number, number, number]): [number, number, number] =>
  v && v.length >= 3 ? [Number(v[0]), Number(v[1]), Number(v[2])] : d;

/* ------------------------------------------------------------ the scene */

export interface FbxModel {
  id: bigint;
  name: string;
  /** "LimbNode", "Null", "Mesh", "Root"... */
  type: string;
  parent: FbxModel | null;
  children: FbxModel[];
  t: [number, number, number];
  r: [number, number, number];
  s: [number, number, number];
  preRot: [number, number, number];
  postRot: [number, number, number];
  rotOffset: [number, number, number];
  rotPivot: [number, number, number];
  scaleOffset: [number, number, number];
  scalePivot: [number, number, number];
  /** FBX EEulerOrder: 0 XYZ, 1 XZY, 2 YZX, 3 YXZ, 4 ZXY, 5 ZYX. */
  order: number;
  anim: { T?: Curve3; R?: Curve3; S?: Curve3 };
  /** World bind matrix (column-major 4x4) from a skin cluster's TransformLink, if any. */
  bind?: Float64Array;
}

export interface Curve { times: Float64Array; values: Float32Array }
export interface Curve3 { x?: Curve; y?: Curve; z?: Curve; def: [number, number, number] }

export interface FbxScene {
  version: number;
  models: FbxModel[];
  roots: FbxModel[];
  /** Centimetres per unit (Mixamo: 1 = centimetres). */
  unitScale: number;
  upAxis: number;
  frameRate: number;
  /** A skinned mesh is present (a "with skin" download). */
  hasSkin: boolean;
  meshes: { name: string; vertexCount: number; polyCount: number }[];
  stackNames: string[];
  /** Earliest and latest key time over all curves, seconds. */
  start: number;
  end: number;
}

const TIME_MODES: Record<number, number> = { 1: 120, 2: 100, 3: 60, 4: 50, 5: 48, 6: 30, 7: 30, 8: 29.97, 9: 29.97, 10: 25, 11: 24, 13: 96, 14: 72, 15: 59.94, 17: 119.88 };

export function readFbxScene(buf: Buffer): FbxScene {
  const top = parseFbxBinary(buf);
  const version = buf.readUInt32LE(23);
  const gs = props70(child(top.find((n) => n.name === "GlobalSettings"), "Properties70") ? top.find((n) => n.name === "GlobalSettings") : undefined);
  const unitScale = Number(gs.get("UnitScaleFactor")?.[0] ?? 1);
  const upAxis = Number(gs.get("UpAxis")?.[0] ?? 1);
  const timeMode = Number(gs.get("TimeMode")?.[0] ?? 6);
  const frameRate = timeMode === 14 ? Number(gs.get("CustomFrameRate")?.[0] ?? 30) : TIME_MODES[timeMode] ?? 30;

  const objects = top.find((n) => n.name === "Objects")?.children ?? [];
  const conns = top.find((n) => n.name === "Connections")?.children ?? [];
  const byId = new Map<bigint, FbxNode>();
  for (const o of objects) byId.set(BigInt(o.props[0] as bigint), o);

  const models = new Map<bigint, FbxModel>();
  const meshes: FbxScene["meshes"] = [];
  let hasGeometry = false, hasSkinDef = false;
  for (const o of objects) {
    const id = BigInt(o.props[0] as bigint);
    const cleanName = String(o.props[1]).split("\u0000")[0]!;
    if (o.name === "Model") {
      const p = props70(o);
      models.set(id, {
        id, name: cleanName, type: String(o.props[2]), parent: null, children: [],
        t: num3(p.get("Lcl Translation"), [0, 0, 0]),
        r: num3(p.get("Lcl Rotation"), [0, 0, 0]),
        s: num3(p.get("Lcl Scaling"), [1, 1, 1]),
        preRot: num3(p.get("PreRotation"), [0, 0, 0]),
        postRot: num3(p.get("PostRotation"), [0, 0, 0]),
        rotOffset: num3(p.get("RotationOffset"), [0, 0, 0]),
        rotPivot: num3(p.get("RotationPivot"), [0, 0, 0]),
        scaleOffset: num3(p.get("ScalingOffset"), [0, 0, 0]),
        scalePivot: num3(p.get("ScalingPivot"), [0, 0, 0]),
        order: Number(p.get("RotationOrder")?.[0] ?? 0),
        anim: {},
      });
    } else if (o.name === "Geometry" && String(o.props[2]) === "Mesh") {
      hasGeometry = true;
      const v = child(o, "Vertices")?.props[0] as Float64Array | undefined;
      const pi = child(o, "PolygonVertexIndex")?.props[0] as Int32Array | undefined;
      let polys = 0;
      if (pi) for (const x of pi) if (x < 0) polys++;
      meshes.push({ name: cleanName, vertexCount: v ? v.length / 3 : 0, polyCount: polys });
    } else if (o.name === "Deformer" && String(o.props[2]) === "Skin") hasSkinDef = true;
  }

  // Connections: parents, curve nodes, curves, clusters.
  const curveNodes = new Map<bigint, { kind: string; def: [number, number, number]; x?: Curve; y?: Curve; z?: Curve }>();
  const curves = new Map<bigint, Curve>();
  for (const o of objects) {
    const id = BigInt(o.props[0] as bigint);
    if (o.name === "AnimationCurveNode") {
      const kind = String(o.props[1]).split("\u0000")[0]!;
      const p = props70(o);
      curveNodes.set(id, { kind, def: [Number(p.get("d|X")?.[0] ?? 0), Number(p.get("d|Y")?.[0] ?? 0), Number(p.get("d|Z")?.[0] ?? 0)] });
    } else if (o.name === "AnimationCurve") {
      const kt = child(o, "KeyTime")?.props[0] as BigInt64Array | undefined;
      const kv = child(o, "KeyValueFloat")?.props[0] as Float32Array | Float64Array | undefined;
      if (kt && kv) {
        const times = new Float64Array(kt.length);
        for (let i = 0; i < kt.length; i++) times[i] = Number(kt[i]!) / FBX_TICKS;
        curves.set(id, { times, values: Float32Array.from(kv) });
      }
    }
  }
  const clusterLink = new Map<bigint, Float64Array>(); // cluster id -> TransformLink
  for (const o of objects) {
    if (o.name === "Deformer" && String(o.props[2]) === "Cluster") {
      const tl = child(o, "TransformLink")?.props[0] as Float64Array | undefined;
      if (tl) clusterLink.set(BigInt(o.props[0] as bigint), tl);
    }
  }
  let start = Infinity, end = -Infinity;
  for (const c of conns) {
    if (c.name !== "C") continue;
    const type = String(c.props[0]);
    const a = BigInt(c.props[1] as bigint), b = BigInt(c.props[2] as bigint);
    if (type === "OO") {
      const ma = models.get(a), mb = models.get(b);
      if (ma && mb) {
        ma.parent = mb;
        mb.children.push(ma);
      }
      // Cluster -> bone model is "OO" with the model as child: bone a, cluster b.
      if (ma && clusterLink.has(b)) ma.bind = clusterLink.get(b);
    } else if (type === "OP") {
      const prop = String(c.props[3]);
      const crv = curves.get(a), cn = curveNodes.get(b);
      if (crv && cn) {
        if (prop === "d|X") cn.x = crv;
        else if (prop === "d|Y") cn.y = crv;
        else if (prop === "d|Z") cn.z = crv;
        if (crv.times.length) {
          start = Math.min(start, crv.times[0]!);
          end = Math.max(end, crv.times[crv.times.length - 1]!);
        }
        continue;
      }
      const cn2 = curveNodes.get(a), m = models.get(b);
      if (cn2 && m) {
        const c3: Curve3 = { x: cn2.x, y: cn2.y, z: cn2.z, def: cn2.def };
        if (prop === "Lcl Translation") m.anim.T = c3;
        else if (prop === "Lcl Rotation") m.anim.R = c3;
        else if (prop === "Lcl Scaling") m.anim.S = c3;
      }
    }
  }
  // Curve nodes are linked to models before their curves in some files: re-link.
  for (const c of conns) {
    if (c.name !== "C" || String(c.props[0]) !== "OP") continue;
    const cn2 = curveNodes.get(BigInt(c.props[1] as bigint)), m = models.get(BigInt(c.props[2] as bigint));
    if (!cn2 || !m) continue;
    const c3: Curve3 = { x: cn2.x, y: cn2.y, z: cn2.z, def: cn2.def };
    const prop = String(c.props[3]);
    if (prop === "Lcl Translation") m.anim.T = c3;
    else if (prop === "Lcl Rotation") m.anim.R = c3;
    else if (prop === "Lcl Scaling") m.anim.S = c3;
  }
  const stackNames = objects.filter((o) => o.name === "AnimationStack").map((o) => String(o.props[1]).split("\u0000")[0]!);
  const all = [...models.values()];
  return {
    version, models: all, roots: all.filter((m) => !m.parent), unitScale, upAxis, frameRate,
    hasSkin: hasGeometry && hasSkinDef, meshes, stackNames,
    start: Number.isFinite(start) ? start : 0, end: Number.isFinite(end) ? end : 0,
  };
}

/** Sample a curve at time t (linear between keys; FBX Mixamo keys are dense, one per frame). */
export function sampleCurve(c: Curve | undefined, t: number, def: number): number {
  if (!c || c.times.length === 0) return def;
  const ts = c.times, vs = c.values;
  if (t <= ts[0]!) return vs[0]!;
  const n = ts.length;
  if (t >= ts[n - 1]!) return vs[n - 1]!;
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ts[mid]! <= t) lo = mid;
    else hi = mid;
  }
  const f = (t - ts[lo]!) / (ts[hi]! - ts[lo]! || 1);
  return vs[lo]! + (vs[hi]! - vs[lo]!) * f;
}

/* ------------------------------------------------------------ transform maths (column-major 4x4, float64) */

export type M4 = Float64Array;

export const m4 = {
  ident(): M4 {
    const m = new Float64Array(16);
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
  },
  mul(a: M4, b: M4): M4 {
    const o = new Float64Array(16);
    for (let c = 0; c < 4; c++)
      for (let r = 0; r < 4; r++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[k * 4 + r]! * b[c * 4 + k]!;
        o[c * 4 + r] = s;
      }
    return o;
  },
  trans(x: number, y: number, z: number): M4 {
    const m = m4.ident();
    m[12] = x;
    m[13] = y;
    m[14] = z;
    return m;
  },
  scale(x: number, y: number, z: number): M4 {
    const m = m4.ident();
    m[0] = x;
    m[5] = y;
    m[10] = z;
    return m;
  },
  rotAxis(axis: 0 | 1 | 2, deg: number): M4 {
    const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    const m = m4.ident();
    if (axis === 0) { m[5] = c; m[6] = s; m[9] = -s; m[10] = c; }
    else if (axis === 1) { m[0] = c; m[2] = -s; m[8] = s; m[10] = c; }
    else { m[0] = c; m[1] = s; m[4] = -s; m[5] = c; }
    return m;
  },
  /** FBX euler (degrees) with the given order: XYZ means X is applied first (R = Rz * Ry * Rx). */
  euler(r: [number, number, number], order = 0): M4 {
    const X = m4.rotAxis(0, r[0]), Y = m4.rotAxis(1, r[1]), Z = m4.rotAxis(2, r[2]);
    switch (order) {
      case 1: return m4.mul(Y, m4.mul(Z, X)); // XZY
      case 2: return m4.mul(X, m4.mul(Z, Y)); // YZX
      case 3: return m4.mul(Z, m4.mul(X, Y)); // YXZ
      case 4: return m4.mul(Y, m4.mul(X, Z)); // ZXY
      case 5: return m4.mul(X, m4.mul(Y, Z)); // ZYX
      default: return m4.mul(Z, m4.mul(Y, X)); // XYZ
    }
  },
  invert(m: M4): M4 {
    const inv = new Float64Array(16);
    const a = m;
    inv[0] = a[5]! * a[10]! * a[15]! - a[5]! * a[11]! * a[14]! - a[9]! * a[6]! * a[15]! + a[9]! * a[7]! * a[14]! + a[13]! * a[6]! * a[11]! - a[13]! * a[7]! * a[10]!;
    inv[4] = -a[4]! * a[10]! * a[15]! + a[4]! * a[11]! * a[14]! + a[8]! * a[6]! * a[15]! - a[8]! * a[7]! * a[14]! - a[12]! * a[6]! * a[11]! + a[12]! * a[7]! * a[10]!;
    inv[8] = a[4]! * a[9]! * a[15]! - a[4]! * a[11]! * a[13]! - a[8]! * a[5]! * a[15]! + a[8]! * a[7]! * a[13]! + a[12]! * a[5]! * a[11]! - a[12]! * a[7]! * a[9]!;
    inv[12] = -a[4]! * a[9]! * a[14]! + a[4]! * a[10]! * a[13]! + a[8]! * a[5]! * a[14]! - a[8]! * a[6]! * a[13]! - a[12]! * a[5]! * a[10]! + a[12]! * a[6]! * a[9]!;
    inv[1] = -a[1]! * a[10]! * a[15]! + a[1]! * a[11]! * a[14]! + a[9]! * a[2]! * a[15]! - a[9]! * a[3]! * a[14]! - a[13]! * a[2]! * a[11]! + a[13]! * a[3]! * a[10]!;
    inv[5] = a[0]! * a[10]! * a[15]! - a[0]! * a[11]! * a[14]! - a[8]! * a[2]! * a[15]! + a[8]! * a[3]! * a[14]! + a[12]! * a[2]! * a[11]! - a[12]! * a[3]! * a[10]!;
    inv[9] = -a[0]! * a[9]! * a[15]! + a[0]! * a[11]! * a[13]! + a[8]! * a[1]! * a[15]! - a[8]! * a[3]! * a[13]! - a[12]! * a[1]! * a[11]! + a[12]! * a[3]! * a[9]!;
    inv[13] = a[0]! * a[9]! * a[14]! - a[0]! * a[10]! * a[13]! - a[8]! * a[1]! * a[14]! + a[8]! * a[2]! * a[13]! + a[12]! * a[1]! * a[10]! - a[12]! * a[2]! * a[9]!;
    inv[2] = a[1]! * a[6]! * a[15]! - a[1]! * a[7]! * a[14]! - a[5]! * a[2]! * a[15]! + a[5]! * a[3]! * a[14]! + a[13]! * a[2]! * a[7]! - a[13]! * a[3]! * a[6]!;
    inv[6] = -a[0]! * a[6]! * a[15]! + a[0]! * a[7]! * a[14]! + a[4]! * a[2]! * a[15]! - a[4]! * a[3]! * a[14]! - a[12]! * a[2]! * a[7]! + a[12]! * a[3]! * a[6]!;
    inv[10] = a[0]! * a[5]! * a[15]! - a[0]! * a[7]! * a[13]! - a[4]! * a[1]! * a[15]! + a[4]! * a[3]! * a[13]! + a[12]! * a[1]! * a[7]! - a[12]! * a[3]! * a[5]!;
    inv[14] = -a[0]! * a[5]! * a[14]! + a[0]! * a[6]! * a[13]! + a[4]! * a[1]! * a[14]! - a[4]! * a[2]! * a[13]! - a[12]! * a[1]! * a[6]! + a[12]! * a[2]! * a[5]!;
    inv[3] = -a[1]! * a[6]! * a[11]! + a[1]! * a[7]! * a[10]! + a[5]! * a[2]! * a[11]! - a[5]! * a[3]! * a[10]! - a[9]! * a[2]! * a[7]! + a[9]! * a[3]! * a[6]!;
    inv[7] = a[0]! * a[6]! * a[11]! - a[0]! * a[7]! * a[10]! - a[4]! * a[2]! * a[11]! + a[4]! * a[3]! * a[10]! + a[8]! * a[2]! * a[7]! - a[8]! * a[3]! * a[6]!;
    inv[11] = -a[0]! * a[5]! * a[11]! + a[0]! * a[7]! * a[9]! + a[4]! * a[1]! * a[11]! - a[4]! * a[3]! * a[9]! - a[8]! * a[1]! * a[7]! + a[8]! * a[3]! * a[5]!;
    inv[15] = a[0]! * a[5]! * a[10]! - a[0]! * a[6]! * a[9]! - a[4]! * a[1]! * a[10]! + a[4]! * a[2]! * a[9]! + a[8]! * a[1]! * a[6]! - a[8]! * a[2]! * a[5]!;
    const det = a[0]! * inv[0]! + a[1]! * inv[4]! + a[2]! * inv[8]! + a[3]! * inv[12]!;
    const id = det ? 1 / det : 0;
    for (let i = 0; i < 16; i++) inv[i] = inv[i]! * id;
    return inv;
  },
};

/**
 * The FBX local transform:
 *   T * Roff * Rp * Rpre * R * Rpost^-1 * Rp^-1 * Soff * Sp * S * Sp^-1
 * (pre and post rotations are always XYZ order).
 */
export function fbxLocal(m: FbxModel, t: [number, number, number], r: [number, number, number], s: [number, number, number]): M4 {
  const T = m4.trans(...t);
  const Roff = m4.trans(...m.rotOffset);
  const Rp = m4.trans(...m.rotPivot);
  const RpInv = m4.trans(-m.rotPivot[0], -m.rotPivot[1], -m.rotPivot[2]);
  const Rpre = m4.euler(m.preRot, 0);
  const R = m4.euler(r, m.order);
  const RpostInv = m4.invert(m4.euler(m.postRot, 0));
  const Soff = m4.trans(...m.scaleOffset);
  const Sp = m4.trans(...m.scalePivot);
  const SpInv = m4.trans(-m.scalePivot[0], -m.scalePivot[1], -m.scalePivot[2]);
  const S = m4.scale(...s);
  let o = m4.mul(T, Roff);
  o = m4.mul(o, Rp);
  o = m4.mul(o, Rpre);
  o = m4.mul(o, R);
  o = m4.mul(o, RpostInv);
  o = m4.mul(o, RpInv);
  o = m4.mul(o, Soff);
  o = m4.mul(o, Sp);
  o = m4.mul(o, S);
  o = m4.mul(o, SpInv);
  return o;
}

/** The model's local TRS at time t (its own curves, or its static values). */
export function sampleModel(m: FbxModel, t: number): { t: [number, number, number]; r: [number, number, number]; s: [number, number, number] } {
  const s3 = (c: Curve3 | undefined, d: [number, number, number]): [number, number, number] =>
    c ? [sampleCurve(c.x, t, c.x ? 0 : d[0]), sampleCurve(c.y, t, c.y ? 0 : d[1]), sampleCurve(c.z, t, c.z ? 0 : d[2])] : d;
  return { t: s3(m.anim.T, m.t), r: s3(m.anim.R, m.r), s: s3(m.anim.S, m.s) };
}

/** Rotation part of a matrix (assumes no shear) as a unit quaternion [x, y, z, w]. */
export function matToQuat(m: M4): [number, number, number, number] {
  // Normalise columns (remove scale).
  const sx = Math.hypot(m[0]!, m[1]!, m[2]!), sy = Math.hypot(m[4]!, m[5]!, m[6]!), sz = Math.hypot(m[8]!, m[9]!, m[10]!);
  const m00 = m[0]! / sx, m10 = m[1]! / sx, m20 = m[2]! / sx;
  const m01 = m[4]! / sy, m11 = m[5]! / sy, m21 = m[6]! / sy;
  const m02 = m[8]! / sz, m12 = m[9]! / sz, m22 = m[10]! / sz;
  const tr = m00 + m11 + m22;
  let x: number, y: number, z: number, w: number;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    w = 0.25 * s; x = (m21 - m12) / s; y = (m02 - m20) / s; z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    w = (m21 - m12) / s; x = 0.25 * s; y = (m01 + m10) / s; z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    w = (m02 - m20) / s; x = (m01 + m10) / s; y = 0.25 * s; z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = 0.25 * s;
  }
  const l = Math.hypot(x, y, z, w);
  return [x / l, y / l, z / l, w / l];
}
