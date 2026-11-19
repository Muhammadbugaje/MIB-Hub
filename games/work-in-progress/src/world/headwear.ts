/**
 * Hijabs (owner, 16 Nov: "the hijabs look very bad"; the old one was a cone
 * shell with hair poking through).
 *
 * Each hijab is a smooth cloth surface generated to fit the wearer's own
 * head, neck and shoulders (measured from the body mesh by
 * tools/anim/rebind-character.ts), skinned to the same skeleton as the
 * body: the crown follows the head, the neck wrap blends from head to
 * neck, the drape rides the chest and shoulders. So it turns with the
 * head, never floats, and the hair under it is hidden completely (the
 * body's hair is switched off in the palette when a hijab is worn).
 *
 * Styles worn in northern Nigeria and by students (references: everyday
 * campus photos and modest-fashion tutorials; described in docs/RESEARCH.md):
 *   wrap      a wrapped hijab framing the face, chin and neck covered, a
 *             short drape over the shoulders (the everyday student look);
 *   gyale     a looser draped veil (gyale) over the head and shoulders,
 *             longer at the back and with one end falling over the left
 *             shoulder, soft folds;
 *   undercap  an under-cap band (a second colour across the forehead) with
 *             a neat wrap over it;
 *   khimar    a longer cape-like cover to mid-chest, all round.
 *
 * The face opening is an oval cut along the hairline, cheeks and under the
 * chin (the surface rows are fitted to the oval, so the edge is clean, not
 * jagged), with a slightly rolled edge. Folds are geometry (fine sine
 * ripples that grow towards the hem) so they light correctly at any angle.
 * Fabric: soft roughness, no specular glint, a gentle sheen.
 */
import * as pc from "playcanvas";
import { SH } from "../gfx/materials.ts";
import { B, MIB_BONES, type Skeleton, fk } from "../anim/skeleton.ts";
import type { CharModel, Look } from "./people.ts";

export type HijabStyle = "wrap" | "gyale" | "undercap" | "khimar";
export const HIJAB_STYLES: HijabStyle[] = ["wrap", "gyale", "undercap", "khimar"];

interface Fit {
  head: { min: number[]; max: number[] };
  hair?: { min: (number | null)[]; max: (number | null)[] };
  neck: { min: (number | null)[]; max: (number | null)[] };
  chest: { min: number[]; max: number[] };
  joints: { head: number[]; neck: number[]; spine2: number[]; headTop: number[]; lArm: number[] };
}

const STYLE: Record<HijabStyle, { pad: number; hem: number; flare: number; fold: number; foldK: number; back: number; tail: number; band: boolean; open: number }> = {
  // pad clears the ears (the base mesh's ears stick out a centimetre past the skull; too thin a wrap let them
  // poke through as skin-coloured patches at the temples). open trims the face oval so it frames the cheeks.
  wrap: { pad: 0.028, hem: 0.09, flare: 0.03, fold: 0.003, foldK: 9, back: 0.02, tail: 0, band: false, open: 0.92 },
  gyale: { pad: 0.03, hem: 0.24, flare: 0.07, fold: 0.006, foldK: 8, back: 0.08, tail: 0.16, band: false, open: 0.98 },
  undercap: { pad: 0.019, hem: 0.11, flare: 0.025, fold: 0.003, foldK: 11, back: 0.02, tail: 0, band: true, open: 0.9 },
  khimar: { pad: 0.024, hem: 0.36, flare: 0.09, fold: 0.005, foldK: 8, back: 0.05, tail: 0, band: false, open: 0.93 },
};

const meshCache = new Map<string, pc.Mesh>();

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Profile rings: [y, rx, rz, cz] from the crown down to the hem (rest pose, model space). */
function profile(f: Fit, st: (typeof STYLE)[HijabStyle]): [number, number, number, number][] {
  const h = f.head;
  const hx = (h.max[0]! - h.min[0]!) / 2, hz = (h.max[2]! - h.min[2]!) / 2;
  const hc = (h.max[2]! + h.min[2]!) / 2;
  const hairTop = f.hair && f.hair.max[1] != null ? Math.max(h.max[1]!, Math.min(h.max[1]! + 0.04, f.hair.max[1]!)) : h.max[1]!;
  const top = hairTop + 0.01 + st.pad * 0.5;
  const hh = top - h.min[1]!;
  const chinY = h.min[1]! + 0.012;
  const nk = f.neck.max[0] != null ? { r: Math.max(0.045, ((f.neck.max[0] as number) - (f.neck.min[0] as number)) / 2), cz: ((f.neck.max[2] as number) + (f.neck.min[2] as number)) / 2 } : { r: 0.055, cz: f.joints.neck[2]! };
  const shoulderY = f.joints.lArm[1]!;
  const chW = Math.min(0.3, Math.max(0.16, Math.abs(f.joints.lArm[0]!) + 0.05));
  const chC = (f.chest.max[2]! + f.chest.min[2]!) / 2;
  const p = st.pad;
  const sx = hx + p, sz = hz + p;
  // Width of the shoulder drape. A wrap ends just past the jaw on the collarbones; capes fall over the
  // shoulders, so only they use the chest width.
  const cape = st.hem > 0.2;
  const dw = (k: number) => (cape ? chW * k : nk.r * 1.8 + st.flare * (k / 0.62));
  return [
    [top + 0.004, 0.012, 0.012, hc],
    [top - 0.01, sx * 0.45, sz * 0.5, hc],
    [top - hh * 0.12, sx * 0.78, sz * 0.82, hc],
    [top - hh * 0.3, sx * 0.97, sz * 0.99, hc],
    [top - hh * 0.5, sx, sz, hc],
    [top - hh * 0.7, sx * 0.97, sz * 0.97, hc + 0.004],
    [chinY + 0.035, sx * 0.88, sz * 0.9, hc + 0.008],
    // Under the chin the cloth hugs the neck (the old +5 cm made a stiff collar round the jaw).
    [chinY - 0.01, nk.r + 0.014 + p, sz * 0.72, hc + 0.0],
    [chinY - 0.045, nk.r + 0.018 + p, nk.r + 0.022 + p, nk.cz + 0.012],
    [shoulderY + 0.035, nk.r + 0.026 + p, nk.r + 0.03 + p, nk.cz + 0.01],
    // The drape: a wrap hugs the collarbones and falls a little way onto the chest. Using the chest half-width
    // here made a flat shoulder-wide disc (a poncho, not a hijab). Cape styles (gyale, khimar) stay wider.
    [shoulderY - 0.005, dw(0.62) + p, dw(0.55) + p, chC + 0.005],
    [shoulderY - st.hem * 0.5, dw(0.78) + p + st.flare * 0.4, dw(0.68) + p + st.flare * 0.3, chC + 0.01],
    [shoulderY - st.hem * 0.94, dw(0.86) + p + st.flare, dw(0.76) + p + st.flare * 0.5, chC + 0.015],
    // Final row turned gently back in, so the hem falls away instead of ending in a flat cut. (A flat final
    // ring was the "poncho shelf" the owner saw.)
    [shoulderY - st.hem, dw(0.72) + p + st.flare * 0.8, dw(0.64) + p + st.flare * 0.4, chC + 0.016],
  ];
}

/** Catmull-Rom through the profile rows: a smooth, dense set of rings. */
function resample(rows: [number, number, number, number][], n: number): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  const seg = rows.length - 1;
  for (let i = 0; i <= n; i++) {
    const u = (i / n) * seg;
    const k = Math.min(seg - 1, Math.floor(u)), t = u - k;
    const P = (j: number) => rows[Math.max(0, Math.min(seg, j))]!;
    const r: number[] = [];
    for (let c = 0; c < 4; c++) {
      const p0 = P(k - 1)[c]!, p1 = P(k)[c]!, p2 = P(k + 1)[c]!, p3 = P(k + 2)[c]!;
      const t2 = t * t, t3 = t2 * t;
      r.push(0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3));
    }
    out.push(r as [number, number, number, number]);
  }
  return out;
}

/** Build (or reuse) the hijab mesh for a body and style. */
function hijabMesh(device: pc.GraphicsDevice, cm: CharModel, sk: Skeleton, style: HijabStyle, band: string): pc.Mesh | null {
  const f = (cm.info as unknown as { fit?: Fit }).fit;
  if (!f) return null;
  const key = `${cm.key}|${style}|${band}`;
  const hit = meshCache.get(key);
  if (hit) return hit;
  const st = STYLE[style];
  const rows = resample(profile(f, st), 40);
  const N = 56; // columns round the head
  const h = f.head;
  const faceTop = h.max[1]! - (h.max[1]! - h.min[1]!) * 0.2 * st.open; // hairline
  const chinY = h.min[1]! + 0.018;
  const faceC = (faceTop + chinY) / 2, faceH = (faceTop - chinY) / 2;
  const openW = 1.0 * st.open; // half-angle of the face opening at its widest (radians)
  const shoulderY = f.joints.lArm[1]!;
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], col: number[] = [], bi: number[] = [], bw: number[] = [];
  const BONES = [B.Head, B.Neck, B.Spine2, B.LShoulder, B.RShoulder];
  const bandRgb = new pc.Color().fromString(band);
  const grid: number[][] = [];
  rows.forEach(([y, rx, rz, cz], ri) => {
    // The face opening: this row is an arc from +edge to 2pi-edge (front = 0).
    const inFace = y < faceTop && y > chinY;
    const e = inFace ? openW * Math.sqrt(Math.max(0, 1 - ((y - faceC) / faceH) ** 2)) : 0;
    const row: number[] = [];
    for (let c = 0; c <= N; c++) {
      const th = e + ((2 * Math.PI - 2 * e) * c) / N;
      const s = Math.sin(th), co = Math.cos(th);
      // A round section: squaring it (the old cartoon head) pinched the cloth in at the temples and let the
      // ears cut through as skin-coloured patches.
      const sxp = s, czp = co;
      // Folds grow towards the hem; the back hangs a little lower and fuller.
      const drape = smooth(shoulderY + 0.06, shoulderY - 0.2, y);
      const fold = st.fold * drape * (Math.sin(th * st.foldK + y * 30) + 0.4 * Math.sin(th * st.foldK * 2.3 + 1.7));
      const back = st.back * drape * Math.max(0, -co);
      // Gyale tail: one end hangs longer over the left shoulder.
      const tail = st.tail * drape * Math.exp(-(((th - 1.9) / 0.5) ** 2));
      // The face opening's edge sits a hair (2 mm) above the cloth so it reads as a hem, not a cut. A dent
      // here made a visible notch at each temple.
      const lift = inFace && (c === 0 || c === N) ? 0.002 : 0;
      const x = sxp * (rx + fold + lift);
      const z = cz + czp * (rz + fold + lift) - back * 0.4;
      const yy = y - back - tail;
      row.push(pos.length / 3);
      pos.push(x, yy, z);
      uv.push(c / N, ri / (rows.length - 1));
      // Colour: white (tinted by the material); the undercap band is a stripe across the forehead edge.
      const isBand = st.band && Math.abs(y - faceTop) < 0.018 && (th < 1.6 || th > 2 * Math.PI - 1.6);
      const shade = 1 - 0.06 * drape * (0.5 + 0.5 * Math.sin(th * st.foldK + y * 30)); // soft fold shading
      if (isBand) col.push(Math.round(bandRgb.r * 255), Math.round(bandRgb.g * 255), Math.round(bandRgb.b * 255), 255);
      else col.push(Math.round(255 * shade), Math.round(255 * shade), Math.round(255 * shade), 255);
      // Skin weights by height: head above the chin, neck under it, chest and shoulders for the drape.
      const wHead = smooth(chinY - 0.06, chinY + 0.02, y);
      const wChest = smooth(shoulderY + 0.05, shoulderY - 0.04, y);
      const wNeck = Math.max(0, 1 - wHead - wChest);
      const side = smooth(0.08, 0.2, Math.abs(x)) * wChest * 0.35;
      const ws = [wHead, wNeck, wChest * (1 - side), x > 0 ? side : 0, x < 0 ? side : 0];
      const tot = ws.reduce((a, b) => a + b, 0) || 1;
      const top4 = ws.map((w, i) => [i, w / tot] as [number, number]).sort((a, b) => b[1] - a[1]).slice(0, 4);
      bi.push(...top4.map(([i]) => i));
      bw.push(...top4.map(([, w]) => w));
    }
    grid.push(row);
  });
  // Normals from the grid (central differences; outward).
  const P = (i: number) => [pos[i * 3]!, pos[i * 3 + 1]!, pos[i * 3 + 2]!];
  for (let r = 0; r < grid.length; r++)
    for (let c = 0; c <= N; c++) {
      const a = P(grid[r]![Math.max(0, c - 1)]!), b = P(grid[r]![Math.min(N, c + 1)]!);
      const u = P(grid[Math.max(0, r - 1)]![c]!), d = P(grid[Math.min(grid.length - 1, r + 1)]![c]!);
      const tc = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!], tr = [d[0]! - u[0]!, d[1]! - u[1]!, d[2]! - u[2]!];
      let n = [tc[1]! * tr[2]! - tc[2]! * tr[1]!, tc[2]! * tr[0]! - tc[0]! * tr[2]!, tc[0]! * tr[1]! - tc[1]! * tr[0]!];
      const me = P(grid[r]![c]!);
      const out = [me[0]!, me[1]! - (r === 0 ? 1 : 0), me[2]! - rows[r]![3]!];
      if (n[0]! * out[0]! + n[1]! * out[1]! + n[2]! * out[2]! < 0) n = n.map((v) => -v);
      const l = Math.hypot(n[0]!, n[1]!, n[2]!) || 1;
      nor.push(n[0]! / l, n[1]! / l, n[2]! / l);
    }
  const idx: number[] = [];
  for (let r = 0; r < grid.length - 1; r++)
    for (let c = 0; c < N; c++) {
      const a = grid[r]![c]!, b = grid[r]![c + 1]!, d = grid[r + 1]![c]!, e = grid[r + 1]![c + 1]!;
      idx.push(a, d, b, b, d, e);
    }
  const mesh = new pc.Mesh(device);
  mesh.setPositions(new Float32Array(pos));
  mesh.setNormals(new Float32Array(nor));
  mesh.setUvs(0, new Float32Array(uv));
  mesh.setColors32(new Uint8Array(col));
  mesh.setVertexStream(pc.SEMANTIC_BLENDINDICES, new Uint8Array(bi), 4, pc.TYPE_UINT8);
  mesh.setVertexStream(pc.SEMANTIC_BLENDWEIGHT, new Float32Array(bw), 4, pc.TYPE_FLOAT32);
  mesh.setIndices(new Uint16Array(idx));
  mesh.update(pc.PRIMITIVE_TRIANGLES);
  // Inverse bind matrices from the body's rest pose.
  const w = fk(sk, sk.restPose());
  const ibp = BONES.map((b) => {
    const m = new pc.Mat4().setTRS(new pc.Vec3(w.pos[b * 3]!, w.pos[b * 3 + 1]!, w.pos[b * 3 + 2]!), new pc.Quat(w.rot[b * 4]!, w.rot[b * 4 + 1]!, w.rot[b * 4 + 2]!, w.rot[b * 4 + 3]!), pc.Vec3.ONE);
    return m.invert();
  });
  mesh.skin = new pc.Skin(device, ibp, BONES.map((b) => MIB_BONES[b]![0]));
  meshCache.set(key, mesh);
  return mesh;
}

const matCache = new Map<string, pc.StandardMaterial>();

function fabric(color: string): pc.StandardMaterial {
  let m = matCache.get(color);
  if (m) return m;
  m = new pc.StandardMaterial();
  m.diffuse = new pc.Color().fromString(color);
  m.diffuseVertexColor = true;
  m.useMetalness = true;
  m.metalness = 0;
  m.gloss = 0.18; // roughness 0.82: matte fabric (rule C2: never glossy)
  m.specularityFactor = 0.18;
  // A whisper of sheen only. The old values (0.25+0.3c at gloss 0.4) painted broad grey highlights on dark
  // hijabs — they read as skin-coloured patches at the temples.
  m.useSheen = true;
  const c = new pc.Color().fromString(color);
  m.sheen = new pc.Color(0.05 + c.r * 0.06, 0.05 + c.g * 0.06, 0.05 + c.b * 0.06);
  m.sheenGloss = 0.85;
  m.cull = pc.CULLFACE_NONE;
  m.twoSidedLighting = true;
  (m as unknown as { ambientSH: Float32Array }).ambientSH = SH;
  m.update();
  matCache.set(color, m);
  return m;
}

/** Put a hijab on a person's model (the model's skeleton nodes drive it). */
export function buildHeadwear(device: pc.GraphicsDevice, sk: Skeleton, look: Look, model: pc.Entity, cm?: CharModel): pc.Entity | null {
  const style = look.hijabStyle ?? "wrap";
  const band = style === "undercap" ? (look.outfit[0] && look.outfit[0] !== look.headwearColor ? look.outfit[0] : "#f4f1ea") : "#ffffff";
  const model0 = cm ?? (model as unknown as { __cm?: CharModel }).__cm;
  if (!model0) return null;
  const mesh = hijabMesh(device, model0, sk, style, band);
  if (!mesh || !mesh.skin) return null;
  const mi = new pc.MeshInstance(mesh, fabric(look.headwearColor));
  const si = new pc.SkinInstance(mesh.skin);
  si.bones = mesh.skin.boneNames.map((n) => model.findByName(n)!);
  si.rootBone = model;
  mi.skinInstance = si;
  const e = new pc.Entity("hijab");
  model.addChild(e);
  e.addComponent("render", { meshInstances: [mi], castShadows: true, receiveShadows: true });
  return e;
}
