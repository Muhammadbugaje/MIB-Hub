/**
 * Asset build step for people: turns a store character GLB (e.g. a CC0
 * Quaternius character) into a small, game-ready GLB.
 *
 *   npx tsx games/work-in-progress/tools/pack-character.ts <in.glb> <out.glb> idle=<clip> walk=<clip> run=<clip>
 *
 * What it does:
 *   1. merges every skinned primitive into ONE mesh (one draw call per person);
 *   2. drops the original materials: each vertex gets a UV that points at a
 *      "palette slot" (one texel per original material), so the game can
 *      recolour skin, shirt, trousers, hair... with a tiny palette texture;
 *   3. keeps only the animation clips we use, renamed to idle / walk / run;
 *   4. stores the slot names and original colours in mesh.extras.slots.
 *
 * Pure Node, no dependencies. The output is a normal glTF 2.0 binary.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

interface Accessor { bufferView?: number; byteOffset?: number; componentType: number; count: number; type: string; normalized?: boolean; min?: number[]; max?: number[] }
interface BufferView { byteOffset?: number; byteLength: number; byteStride?: number }
interface Gltf {
  accessors: Accessor[]; bufferViews: BufferView[]; nodes: Record<string, unknown>[];
  meshes: { primitives: { attributes: Record<string, number>; indices?: number; material?: number }[] }[];
  skins: { joints: number[]; inverseBindMatrices?: number; skeleton?: number }[];
  materials?: { name?: string; pbrMetallicRoughness?: { baseColorFactor?: number[] } }[];
  animations?: { name?: string; channels: { sampler: number; target: { node?: number; path: string } }[]; samplers: { input: number; output: number; interpolation?: string }[] }[];
  scenes?: { nodes: number[] }[]; scene?: number;
}

const COMPS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

export function parseGlb(buf: Buffer): { json: Gltf; bin: Buffer } {
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString("utf8")) as Gltf;
  const binStart = 20 + jsonLen;
  const binLen = buf.readUInt32LE(binStart);
  return { json, bin: buf.subarray(binStart + 8, binStart + 8 + binLen) };
}

/** Read an accessor into a plain number array (normalised integers become 0..1 floats). */
function read(g: Gltf, bin: Buffer, index: number): { data: number[]; comps: number } {
  const a = g.accessors[index]!;
  const comps = COMPS[a.type]!;
  const bv = g.bufferViews[a.bufferView ?? 0]!;
  const size = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }[a.componentType as 5126]!;
  const stride = bv.byteStride ?? size * comps;
  const base = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const data: number[] = [];
  for (let i = 0; i < a.count; i++) {
    for (let c = 0; c < comps; c++) {
      const o = base + i * stride + c * size;
      let v: number;
      switch (a.componentType) {
        case 5126: v = bin.readFloatLE(o); break;
        case 5125: v = bin.readUInt32LE(o); break;
        case 5123: v = bin.readUInt16LE(o); if (a.normalized) v /= 65535; break;
        case 5121: v = bin.readUInt8(o); if (a.normalized) v /= 255; break;
        case 5122: v = bin.readInt16LE(o); if (a.normalized) v = Math.max(v / 32767, -1); break;
        default: v = bin.readInt8(o); if (a.normalized) v = Math.max(v / 127, -1);
      }
      data.push(v);
    }
  }
  return { data, comps };
}

type Mat = number[];
function mul(a: Mat, b: Mat): Mat {
  const o = new Array<number>(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r]! += a[k * 4 + r]! * b[c * 4 + k]!;
  return o;
}
function local(n: Record<string, unknown>): Mat {
  if (Array.isArray(n.matrix)) return n.matrix as number[];
  const [tx, ty, tz] = (n.translation as number[]) ?? [0, 0, 0];
  const [x, y, z, w] = (n.rotation as number[]) ?? [0, 0, 0, 1];
  const [sx, sy, sz] = (n.scale as number[]) ?? [1, 1, 1];
  return [
    (1 - 2 * (y! * y! + z! * z!)) * sx!, 2 * (x! * y! + z! * w!) * sx!, 2 * (x! * z! - y! * w!) * sx!, 0,
    2 * (x! * y! - z! * w!) * sy!, (1 - 2 * (x! * x! + z! * z!)) * sy!, 2 * (y! * z! + x! * w!) * sy!, 0,
    2 * (x! * z! + y! * w!) * sz!, 2 * (y! * z! - x! * w!) * sz!, (1 - 2 * (x! * x! + y! * y!)) * sz!, 0,
    tx!, ty!, tz!, 1,
  ];
}

/** Static props (cars): bake every mesh node into one palette-mapped mesh, in model space. */
function packStatic(g: Gltf, bin: Buffer, output: string) {
  const world = new Map<number, Mat>();
  const visit = (i: number, parent: Mat) => {
    const m = mul(parent, local(g.nodes[i]!));
    world.set(i, m);
    for (const c of (g.nodes[i]!.children as number[]) ?? []) visit(c, m);
  };
  for (const r of g.scenes?.[g.scene ?? 0]?.nodes ?? []) visit(r, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const slots: { name: string; color: number[] }[] = [];
  const slotOf = new Map<string, number>();
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  g.nodes.forEach((n, ni) => {
    if (typeof n.mesh !== "number" || !world.has(ni)) return;
    const m = world.get(ni)!;
    for (const p of g.meshes[n.mesh]!.primitives) {
      const mat = g.materials?.[p.material ?? -1];
      const name = mat?.name ?? "Default";
      if (!slotOf.has(name)) {
        slotOf.set(name, slots.length);
        slots.push({ name, color: (mat?.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1]).slice(0, 3) });
      }
      const slot = slotOf.get(name)!;
      const P = read(g, bin, p.attributes.POSITION!).data;
      const N = read(g, bin, p.attributes.NORMAL!).data;
      const start = pos.length / 3;
      for (let v = 0; v < P.length / 3; v++) {
        const [x, y, z] = [P[v * 3]!, P[v * 3 + 1]!, P[v * 3 + 2]!];
        pos.push(m[0]! * x + m[4]! * y + m[8]! * z + m[12]!, m[1]! * x + m[5]! * y + m[9]! * z + m[13]!, m[2]! * x + m[6]! * y + m[10]! * z + m[14]!);
        const [a, b, c] = [N[v * 3]!, N[v * 3 + 1]!, N[v * 3 + 2]!];
        const nx = m[0]! * a + m[4]! * b + m[8]! * c, ny = m[1]! * a + m[5]! * b + m[9]! * c, nz = m[2]! * a + m[6]! * b + m[10]! * c;
        const l = Math.hypot(nx, ny, nz) || 1;
        nor.push(nx / l, ny / l, nz / l);
        uv.push((slot + 0.5) / 16, 0.5);
      }
      const I = p.indices !== undefined ? read(g, bin, p.indices).data : [...Array(P.length / 3).keys()];
      for (const i of I) idx.push(i + start);
    }
  });
  const f32 = (a: number[]) => Buffer.from(new Float32Array(a).buffer);
  const vcount = pos.length / 3;
  const parts = [f32(pos), f32(nor), f32(uv), Buffer.from((vcount < 65536 ? new Uint16Array(idx) : new Uint32Array(idx)).buffer)];
  let off = 0;
  const bufferViews = parts.map((b) => { const v = { buffer: 0, byteOffset: off, byteLength: b.length }; off += b.length + ((4 - (b.length % 4)) % 4); return v; });
  const min = [0, 1, 2].map((c) => Math.min(...pos.filter((_, i) => i % 3 === c)));
  const max = [0, 1, 2].map((c) => Math.max(...pos.filter((_, i) => i % 3 === c)));
  const out = {
    asset: { version: "2.0", generator: "MIB-Hub pack-character (static)" },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: "Body", mesh: 0 }],
    meshes: [{ name: "Body", primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }], extras: { slots } }],
    materials: [{ name: "Palette", pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.6 } }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: vcount, type: "VEC3", min, max },
      { bufferView: 1, componentType: 5126, count: vcount, type: "VEC3" },
      { bufferView: 2, componentType: 5126, count: vcount, type: "VEC2" },
      { bufferView: 3, componentType: vcount < 65536 ? 5123 : 5125, count: idx.length, type: "SCALAR" },
    ],
    bufferViews, buffers: [{ byteLength: off }],
  };
  writeGlb(output, out, Buffer.concat(parts.flatMap((b) => [b, Buffer.alloc((4 - (b.length % 4)) % 4)])));
  const manifest = join(dirname(output), "index.json");
  const index = existsSync(manifest) ? (JSON.parse(readFileSync(manifest, "utf8")) as Record<string, unknown>) : {};
  index[basename(output, ".glb")] = { file: basename(output), slots, size: [0, 1, 2].map((c) => max[c]! - min[c]!) };
  writeFileSync(manifest, JSON.stringify(index, null, 1) + "\n");
  console.log(`${output}: static, ${vcount} verts, ${idx.length / 3} tris, ${slots.length} slots [${slots.map((s) => s.name).join(", ")}], size ${[0, 1, 2].map((c) => (max[c]! - min[c]!).toFixed(2)).join(" x ")}`);
}

function writeGlb(output: string, json: unknown, binBuf: Buffer) {
  const jsonBuf = Buffer.from(JSON.stringify(json));
  const jsonPad = Buffer.alloc((4 - (jsonBuf.length % 4)) % 4, 0x20);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuf.length + jsonPad.length + 8 + binBuf.length, 8);
  const jh = Buffer.alloc(8);
  jh.writeUInt32LE(jsonBuf.length + jsonPad.length, 0);
  jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8);
  bh.writeUInt32LE(binBuf.length, 0);
  bh.writeUInt32LE(0x004e4942, 4);
  writeFileSync(output, Buffer.concat([header, jh, jsonBuf, jsonPad, bh, binBuf]));
}

/* ---- stride measurement: how fast the planted foot slides back in each clip */

function slerpish(a: number[], b: number[], t: number): number[] {
  const d = a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]! + a[3]! * b[3]!;
  const bb = d < 0 ? b.map((v) => -v) : b;
  const o = a.map((v, i) => v + (bb[i]! - v) * t);
  const l = Math.hypot(...o) || 1;
  return o.map((v) => v / l);
}

/**
 * Evaluate the skeleton over each clip and measure the speed at which a planted
 * foot moves backwards. Walking the character at exactly that speed means the
 * feet do not slide (plan rule A1). Also tells which way the model faces.
 */
function strideSpeeds(g: Gltf, bin: Buffer, clips: Map<string, string>): Record<string, { speed: number; facing: number }> {
  const out: Record<string, { speed: number; facing: number }> = {};
  const parent = new Map<number, number>();
  g.nodes.forEach((n, i) => ((n.children as number[]) ?? []).forEach((c) => parent.set(c, i)));
  const feet = g.nodes.map((n, i) => ({ n, i })).filter(({ n }) => /^foot\.?[lr]$/i.test(String(n.name ?? ""))).map(({ i }) => i);
  if (feet.length < 2) return out;
  for (const [outName, clipName] of clips) {
    if (outName !== "walk" && outName !== "run") continue;
    const src = g.animations?.find((a) => a.name === clipName || a.name?.endsWith(`|${clipName}`));
    if (!src) continue;
    const chans = src.channels.map((c) => {
      const smp = src.samplers[c.sampler]!;
      const out2 = read(g, bin, smp.output);
      return { node: c.target.node!, path: c.target.path, times: read(g, bin, smp.input).data, vals: out2.data, comps: out2.comps, cubic: smp.interpolation === "CUBICSPLINE" };
    });
    const dur = Math.max(...chans.map((c) => c.times[c.times.length - 1]!));
    const pose = (t: number) => {
      const trs = g.nodes.map((n) => ({ translation: (n.translation as number[]) ?? [0, 0, 0], rotation: (n.rotation as number[]) ?? [0, 0, 0, 1], scale: (n.scale as number[]) ?? [1, 1, 1] }));
      for (const c of chans) {
        if (c.path === "weights") continue;
        let k = 0;
        while (k < c.times.length - 2 && c.times[k + 1]! <= t) k++;
        const t0 = c.times[k]!, t1 = c.times[Math.min(k + 1, c.times.length - 1)]!;
        const f = t1 > t0 ? Math.max(0, Math.min(1, (t - t0) / (t1 - t0))) : 0;
        const stride = c.cubic ? c.comps * 3 : c.comps, off = c.cubic ? c.comps : 0;
        const a = c.vals.slice(k * stride + off, k * stride + off + c.comps);
        const kb = Math.min(k + 1, c.times.length - 1);
        const b = c.vals.slice(kb * stride + off, kb * stride + off + c.comps);
        const v = c.path === "rotation" ? slerpish(a, b, f) : a.map((x, i) => x + (b[i]! - x) * f);
        (trs[c.node] as Record<string, number[]>)[c.path] = v;
      }
      const world = new Map<number, number[]>();
      const get = (i: number): number[] => {
        if (world.has(i)) return world.get(i)!;
        const n = trs[i]!;
        const m = local({ translation: n.translation, rotation: n.rotation, scale: n.scale });
        const w = parent.has(i) ? mul(get(parent.get(i)!), m) : m;
        world.set(i, w);
        return w;
      };
      return feet.map((f) => { const w = get(f); return [w[12]!, w[13]!, w[14]!]; });
    };
    const N = 240, dt = dur / N;
    const samples = Array.from({ length: N + 1 }, (_, i) => pose(i * dt));
    const vel: number[] = [];
    feet.forEach((_, fi) => {
      const ys = samples.map((s) => s[fi]![1]!);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      for (let i = 0; i < N; i++) {
        if (ys[i]! > minY + (maxY - minY) * 0.15) continue;
        vel.push((samples[i + 1]![fi]![2]! - samples[i]![fi]![2]!) / dt);
      }
    });
    vel.sort((a, b) => a - b);
    const med = vel[Math.floor(vel.length / 2)] ?? 0;
    out[outName] = { speed: Math.abs(med), facing: med < 0 ? 1 : -1 };
  }
  return out;
}

/** Height of the skeleton in its rest pose: lowest foot end to the top of the head (world units). */
function restHeight(g: Gltf): { height: number; footY: number } {
  const parent = new Map<number, number>();
  g.nodes.forEach((n, i) => ((n.children as number[]) ?? []).forEach((c) => parent.set(c, i)));
  const world = (i: number): number[] => (parent.has(i) ? mul(world(parent.get(i)!), local(g.nodes[i]!)) : local(g.nodes[i]!));
  const ys = (re: RegExp) => g.nodes.map((n, i) => ({ n, i })).filter(({ n }) => re.test(String(n.name ?? ""))).map(({ i }) => world(i)[13]!);
  const head = Math.max(...ys(/^head(_end)?$/i));
  const foot = Math.min(...ys(/^foot\.?[lr](_end)?$/i), ...ys(/toe/i));
  return { height: head - foot, footY: foot };
}

function main() {
  const [input, output, ...pairs] = process.argv.slice(2);
  if (!input || !output) throw new Error("usage: pack-character <in.glb> <out.glb> idle=<clip> walk=<clip> run=<clip>");
  const clips = new Map(pairs.map((p) => p.split("=") as [string, string]));
  const { json: g, bin } = parseGlb(readFileSync(input));

  // Union skin: joints of the first skinned node, others remapped into it.
  const skinned = g.nodes.map((n, i) => ({ n, i })).filter(({ n }) => typeof n.mesh === "number" && typeof n.skin === "number");
  if (!skinned.length) return packStatic(g, bin, output);
  const joints: number[] = [];
  const ibms: number[] = [];
  const jointIndex = new Map<number, number>();
  for (const { n } of skinned) {
    const skin = g.skins[n.skin as number]!;
    const ibm = skin.inverseBindMatrices !== undefined ? read(g, bin, skin.inverseBindMatrices).data : [];
    skin.joints.forEach((node, k) => {
      if (jointIndex.has(node)) return;
      jointIndex.set(node, joints.length);
      joints.push(node);
      ibms.push(...(ibm.length ? ibm.slice(k * 16, k * 16 + 16) : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
    });
  }

  const slots: { name: string; color: number[] }[] = [];
  const slotOf = new Map<string, number>();
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], jnt: number[] = [], wgt: number[] = [], idx: number[] = [];
  for (const { n } of skinned) {
    const skin = g.skins[n.skin as number]!;
    for (const p of g.meshes[n.mesh as number]!.primitives) {
      const mat = g.materials?.[p.material ?? -1];
      const name = mat?.name ?? "Default";
      if (!slotOf.has(name)) {
        slotOf.set(name, slots.length);
        slots.push({ name, color: (mat?.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1]).slice(0, 3) });
      }
      const slot = slotOf.get(name)!;
      const P = read(g, bin, p.attributes.POSITION!).data;
      const N = p.attributes.NORMAL !== undefined ? read(g, bin, p.attributes.NORMAL).data : P.map(() => 0);
      const J = read(g, bin, p.attributes.JOINTS_0!).data;
      const W = read(g, bin, p.attributes.WEIGHTS_0!).data;
      const start = pos.length / 3;
      const count = P.length / 3;
      for (let v = 0; v < count; v++) {
        pos.push(P[v * 3]!, P[v * 3 + 1]!, P[v * 3 + 2]!);
        nor.push(N[v * 3]!, N[v * 3 + 1]!, N[v * 3 + 2]!);
        uv.push((slot + 0.5) / 16, 0.5);
        for (let c = 0; c < 4; c++) {
          jnt.push(jointIndex.get(skin.joints[J[v * 4 + c]!]!) ?? 0);
          wgt.push(W[v * 4 + c]!);
        }
      }
      const I = p.indices !== undefined ? read(g, bin, p.indices).data : [...Array(count).keys()];
      for (const i of I) idx.push(i + start);
    }
  }
  if (slots.length > 16) throw new Error(`too many material slots (${slots.length})`);

  // ---- write the new binary
  const chunks: Buffer[] = [];
  const bufferViews: BufferView[] = [];
  const accessors: Accessor[] = [];
  let offset = 0;
  function add(data: ArrayBufferView, acc: Omit<Accessor, "bufferView">): number {
    const b = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    const pad = (4 - (b.length % 4)) % 4;
    bufferViews.push({ byteOffset: offset, byteLength: b.length });
    chunks.push(b, Buffer.alloc(pad));
    offset += b.length + pad;
    accessors.push({ ...acc, bufferView: bufferViews.length - 1 });
    return accessors.length - 1;
  }
  const vcount = pos.length / 3;
  const min = [0, 1, 2].map((c) => Math.min(...pos.filter((_, i) => i % 3 === c)));
  const max = [0, 1, 2].map((c) => Math.max(...pos.filter((_, i) => i % 3 === c)));
  const aPos = add(new Float32Array(pos), { componentType: 5126, count: vcount, type: "VEC3", min, max });
  const aNor = add(new Float32Array(nor), { componentType: 5126, count: vcount, type: "VEC3" });
  const aUv = add(new Float32Array(uv), { componentType: 5126, count: vcount, type: "VEC2" });
  const aJnt = add(joints.length < 256 ? new Uint8Array(jnt) : new Uint16Array(jnt), { componentType: joints.length < 256 ? 5121 : 5123, count: vcount, type: "VEC4" });
  const aWgt = add(new Float32Array(wgt), { componentType: 5126, count: vcount, type: "VEC4" });
  const aIdx = add(vcount < 65536 ? new Uint16Array(idx) : new Uint32Array(idx), { componentType: vcount < 65536 ? 5123 : 5125, count: idx.length, type: "SCALAR" });
  const aIbm = add(new Float32Array(ibms), { componentType: 5126, count: joints.length, type: "MAT4" });

  const animations: NonNullable<Gltf["animations"]> = [];
  for (const [outName, clipName] of clips) {
    const src = g.animations?.find((a) => a.name === clipName || a.name?.endsWith(`|${clipName}`));
    if (!src) throw new Error(`clip not found: ${clipName}`);
    const samplers = src.samplers.map((s) => {
      const inp = read(g, bin, s.input).data;
      const out = read(g, bin, s.output);
      const type = g.accessors[s.output]!.type;
      const input = add(new Float32Array(inp), { componentType: 5126, count: inp.length, type: "SCALAR", min: [Math.min(...inp)], max: [Math.max(...inp)] });
      const output = add(new Float32Array(out.data), { componentType: 5126, count: out.data.length / out.comps, type });
      return { input, output, interpolation: s.interpolation ?? "LINEAR" };
    });
    animations.push({ name: outName, samplers, channels: src.channels.filter((c) => c.target.path !== "weights") });
  }

  const nodes = g.nodes.map((n) => {
    const { mesh: _m, skin: _s, ...rest } = n;
    return rest;
  });
  nodes.push({ name: "SkinnedMesh", mesh: 0, skin: 0 });
  const sceneNodes = [...(g.scenes?.[g.scene ?? 0]?.nodes ?? [])].filter((i) => !skinned.some((s) => s.i === i));
  sceneNodes.push(nodes.length - 1);

  const out = {
    asset: { version: "2.0", generator: "MIB-Hub pack-character" },
    scene: 0,
    scenes: [{ nodes: sceneNodes }],
    nodes,
    meshes: [{ name: "SkinnedMesh", primitives: [{ attributes: { POSITION: aPos, NORMAL: aNor, TEXCOORD_0: aUv, JOINTS_0: aJnt, WEIGHTS_0: aWgt }, indices: aIdx, material: 0 }], extras: { slots, ...restHeight(g), stride: strideSpeeds(g, bin, clips) } }],
    materials: [{ name: "Palette", pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.8 } }],
    skins: [{ joints, inverseBindMatrices: aIbm }],
    animations,
    accessors,
    bufferViews: bufferViews.map((v) => ({ buffer: 0, ...v })),
    buffers: [{ byteLength: offset }],
  };
  writeGlb(output, out, Buffer.concat(chunks));
  // The game reads this manifest (slots, rest height, stride speeds) without parsing GLBs itself.
  const manifest = join(dirname(output), "index.json");
  const index = existsSync(manifest) ? (JSON.parse(readFileSync(manifest, "utf8")) as Record<string, unknown>) : {};
  index[basename(output, ".glb")] = { file: basename(output), clips: [...clips.keys()], ...out.meshes[0]!.extras };
  writeFileSync(manifest, JSON.stringify(index, null, 1) + "\n");
  console.log(`${output}: ${vcount} verts, ${idx.length / 3} tris, ${joints.length} joints, ${slots.length} slots [${slots.map((s) => s.name).join(", ")}], ${(offset / 1024).toFixed(0)} KB`);
}

main();
