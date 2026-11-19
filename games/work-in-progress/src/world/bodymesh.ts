/**
 * Character body meshes, built in the browser from the small base GLBs
 * (assets/people/*.glb, made by tools/anim/rebind-character.ts):
 *
 *   lod1  the base mesh with welded smooth normals (crowds, mid distance);
 *   lod0  the same surface subdivided with curved PN triangles (close-up:
 *         round silhouettes, no facets), built once per body type;
 *   morphs heavy / lean / fit body-shape targets (plan §3.5), used only by
 *         people whose body differs from the default (the player, named
 *         characters, anyone the story fattens or slims over the years).
 *
 * The default "natural average" body (a touch fuller than the CC0 bases,
 * owner: "too skinny") is baked straight into the positions, so most crowd
 * people need no morph at all.
 */
import * as pc from "playcanvas";
import { MORPH_NAMES, morphDeltas, pnSubdivide, smoothNormals, type Mesh } from "../anim/meshops.ts";

/** The default body (morph weights baked into every body's positions). */
export const DEFAULT_BODY: Record<string, number> = { heavy: 0.32, lean: 0, fit: 0.15 };

export interface BodyShape {
  heavy?: number;
  lean?: number;
  fit?: number;
  tired?: number;
}

export interface BodyKit {
  lod0: pc.Mesh;
  lod1: pc.Mesh;
  skin: pc.Skin;
  boneNames: string[];
  /** Morph target order (heavy, lean, fit). */
  morphs: string[];
}

interface GJ {
  meshes: { primitives: { attributes: Record<string, number>; indices?: number }[] }[];
  skins: { joints: number[]; inverseBindMatrices: number }[];
  nodes: { name?: string }[];
  accessors: { bufferView?: number; byteOffset?: number; componentType: number; count: number; type: string; normalized?: boolean }[];
  bufferViews: { byteOffset?: number; byteLength: number }[];
}

const COMPS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

/** Read the base mesh, normals and inverse bind matrices out of a body GLB. */
export function parseBody(buf: ArrayBuffer): { mesh: Mesh; nor: number[]; ibm: Float32Array; boneNames: string[] } {
  const dv = new DataView(buf);
  const jl = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jl))) as GJ;
  const binOff = 20 + jl + 8;
  const read = (i: number): number[] => {
    const a = json.accessors[i]!;
    const bv = json.bufferViews[a.bufferView ?? 0]!;
    const n = a.count * COMPS[a.type]!;
    const o = binOff + (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const out = new Array<number>(n);
    for (let k = 0; k < n; k++) {
      switch (a.componentType) {
        case 5126: out[k] = dv.getFloat32(o + k * 4, true); break;
        case 5125: out[k] = dv.getUint32(o + k * 4, true); break;
        case 5123: out[k] = dv.getUint16(o + k * 2, true) / (a.normalized ? 65535 : 1); break;
        case 5121: out[k] = dv.getUint8(o + k) / (a.normalized ? 255 : 1); break;
        default: out[k] = 0;
      }
    }
    return out;
  };
  const prim = json.meshes[0]!.primitives[0]!;
  const at = prim.attributes;
  const mesh: Mesh = { pos: read(at.POSITION!), uv: read(at.TEXCOORD_0!), joints: read(at.JOINTS_0!), weights: read(at.WEIGHTS_0!), idx: read(prim.indices!) };
  const nor = at.NORMAL !== undefined ? read(at.NORMAL) : smoothNormals(mesh);
  const skin = json.skins[0]!;
  return { mesh, nor, ibm: Float32Array.from(read(skin.inverseBindMatrices)), boneNames: skin.joints.map((j) => json.nodes[j]!.name ?? "") };
}

function toPcMesh(device: pc.GraphicsDevice, m: Mesh, nor: number[], skin: pc.Skin): pc.Mesh {
  // Bake the default body shape into the positions; morph targets stay relative to it.
  const deltas = morphDeltas(m);
  const pos = Float32Array.from(m.pos);
  MORPH_NAMES.forEach((name, t) => {
    const w = DEFAULT_BODY[name] ?? 0;
    if (!w) return;
    const d = deltas[t]!;
    for (let i = 0; i < pos.length; i++) pos[i] = pos[i]! + d[i]! * w;
  });
  const mesh = new pc.Mesh(device);
  mesh.setPositions(pos);
  mesh.setNormals(Float32Array.from(nor));
  mesh.setUvs(0, Float32Array.from(m.uv));
  mesh.setVertexStream(pc.SEMANTIC_BLENDINDICES, Uint8Array.from(m.joints), 4, pc.TYPE_UINT8);
  mesh.setVertexStream(pc.SEMANTIC_BLENDWEIGHT, Float32Array.from(m.weights), 4, pc.TYPE_FLOAT32);
  mesh.setIndices(pos.length / 3 > 65535 ? Uint32Array.from(m.idx) : Uint16Array.from(m.idx));
  mesh.update(pc.PRIMITIVE_TRIANGLES);
  mesh.skin = skin;
  mesh.morph = new pc.Morph(deltas.map((d, i) => new pc.MorphTarget({ deltaPositions: Float32Array.from(d), name: MORPH_NAMES[i]! })), device);
  return mesh;
}

/** Build the two LODs and the skin for one body type. */
export function buildBody(device: pc.GraphicsDevice, buf: ArrayBuffer): BodyKit {
  const { mesh, nor, ibm, boneNames } = parseBody(buf);
  const ibp: pc.Mat4[] = [];
  for (let i = 0; i < boneNames.length; i++) ibp.push(new pc.Mat4().set(Array.from(ibm.subarray(i * 16, i * 16 + 16))));
  const skin = new pc.Skin(device, ibp, boneNames);
  const detail = pnSubdivide(mesh, nor);
  return {
    lod0: toPcMesh(device, detail, smoothNormals(detail), skin),
    lod1: toPcMesh(device, mesh, nor, skin),
    skin,
    boneNames,
    morphs: MORPH_NAMES,
  };
}
