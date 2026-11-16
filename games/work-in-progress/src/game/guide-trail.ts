/**
 * Ground guidance: soft glowing chevrons on the ground along the real
 * walking route to the current objective (footpaths first, through doors),
 * flowing gently towards it and fading out 25-35 m ahead so they never
 * clutter the view. Shown only when the objective is more than about 15 m
 * away, never in cutscenes, and switchable in Settings ("Ground arrows").
 *
 * trailMarks() is the pure part (tested): where each chevron sits along a
 * path. GuideTrail draws them: one instanced mesh, one draw call, a fixed
 * pool of instances updated each frame.
 */
import * as pc from "playcanvas";
import type { NavPoint } from "../sim/nav.ts";

export interface TrailMark { x: number; z: number; yaw: number; /** 0..1 */ fade: number }

export interface TrailOptions {
  spacing?: number;
  /** First chevron this far ahead of you. */
  start?: number;
  /** Fully visible up to here, then fading to nothing at maxDist. */
  fadeFrom?: number;
  maxDist?: number;
  /** No chevrons in the last few metres before the goal. */
  stopBefore?: number;
  /** Flow speed (metres per second). */
  flow?: number;
}

/** Distance along a polyline of the point closest to p. */
export function projectOnPath(path: NavPoint[], p: NavPoint): { s: number; d: number } {
  let best = { s: 0, d: Infinity }, acc = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!, b = path[i]!;
    const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    if (L < 1e-6) continue;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (L * L)));
    const d = Math.hypot(a[0] + dx * t - p[0], a[1] + dz * t - p[1]);
    if (d < best.d) best = { s: acc + L * t, d };
    acc += L;
  }
  return best;
}

/** Chevrons along the path ahead of `from`, flowing with time t (seconds). */
export function trailMarks(path: NavPoint[], from: NavPoint, t: number, o: TrailOptions = {}): TrailMark[] {
  const spacing = o.spacing ?? 1.5, start = o.start ?? 1.6, fadeFrom = o.fadeFrom ?? 22, maxDist = o.maxDist ?? 34, stopBefore = o.stopBefore ?? 2.5, flow = o.flow ?? 1.1;
  if (path.length < 2) return [];
  const cum = [0];
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1]! + Math.hypot(path[i]![0] - path[i - 1]![0], path[i]![1] - path[i - 1]![1]));
  const total = cum[cum.length - 1]!;
  const s0 = projectOnPath(path, from).s;
  const out: TrailMark[] = [];
  const phase = (t * flow) % spacing;
  for (let ahead = start + phase; ahead <= maxDist; ahead += spacing) {
    const s = s0 + ahead;
    if (s > total - stopBefore) break;
    let i = 1;
    while (i < cum.length - 1 && cum[i]! < s) i++;
    const a = path[i - 1]!, b = path[i]!, L = cum[i]! - cum[i - 1]! || 1, u = (s - cum[i - 1]!) / L;
    const x = a[0] + (b[0] - a[0]) * u, z = a[1] + (b[1] - a[1]) * u;
    // Fade in over the first metre after appearing, out towards the far end.
    const fin = Math.min(1, (ahead - start) / 1.0 + 0.15);
    const fout = ahead <= fadeFrom ? 1 : Math.max(0, 1 - (ahead - fadeFrom) / (maxDist - fadeFrom));
    out.push({ x, z, yaw: Math.atan2(b[0] - a[0], b[1] - a[1]), fade: Math.min(fin, fout) });
  }
  return out;
}

const MAX = 26;

/** A flat chevron pointing along +z, 0.62 m wide. */
function chevronMesh(device: pc.GraphicsDevice): pc.Mesh {
  const arm = (sx: number): number[] => {
    // A thick stroke from the outer back corner to the tip.
    const bx = 0.31 * sx, bz = -0.16, tx = 0, tz = 0.16, w = 0.09;
    const dx = tx - bx, dz = tz - bz, L = Math.hypot(dx, dz), nx = (-dz / L) * w, nz = (dx / L) * w;
    return [bx - nx, 0, bz - nz, bx + nx, 0, bz + nz, tx + nx, 0, tz + nz, tx - nx, 0, tz - nz];
  };
  const pos = [...arm(-1), ...arm(1)];
  const idx = [0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6];
  const nor: number[] = [];
  for (let i = 0; i < 8; i++) nor.push(0, 1, 0);
  const m = new pc.Mesh(device);
  m.setPositions(pos);
  m.setNormals(nor);
  m.setIndices(idx);
  m.update(pc.PRIMITIVE_TRIANGLES);
  return m;
}

export class GuideTrail {
  private vb: pc.VertexBuffer;
  private data = new Float32Array(MAX * 16);
  private mi: pc.MeshInstance;
  private mat: pc.StandardMaterial;
  private m = new pc.Mat4();
  private q = new pc.Quat();
  private v = new pc.Vec3();
  private sc = new pc.Vec3();

  constructor(app: pc.AppBase) {
    const device = app.graphicsDevice;
    const mat = new pc.StandardMaterial();
    mat.useLighting = false;
    mat.diffuse = new pc.Color(0, 0, 0);
    // The accent colour (the HUD's gold), glowing so it reads at night too.
    mat.emissive = new pc.Color(0.95, 0.7, 0.24);
    mat.emissiveIntensity = 1.6;
    mat.opacity = 0.82;
    mat.blendType = pc.BLEND_NORMAL;
    mat.depthWrite = false;
    mat.cull = pc.CULLFACE_NONE;
    // Like the road markings: a few centimetres up plus a depth bias, so it never fights the ground.
    mat.depthBias = -4;
    mat.slopeDepthBias = -4;
    mat.update();
    this.mat = mat;
    this.vb = new pc.VertexBuffer(device, pc.VertexFormat.getDefaultInstancingFormat(device), MAX, { usage: pc.BUFFER_DYNAMIC, data: this.data });
    this.mi = new pc.MeshInstance(chevronMesh(device), mat);
    this.mi.setInstancing(this.vb);
    this.mi.cull = false;
    this.mi.instancingCount = 0;
    const e = new pc.Entity("guide-trail");
    e.addComponent("render", { meshInstances: [this.mi], castShadows: false, receiveShadows: false });
    app.root.addChild(e);
  }

  /** Draw these marks (heights from the walkable surface); pulse is 0..1 time for the shimmer. */
  show(marks: TrailMark[], height: (x: number, z: number) => number, t: number): void {
    const n = Math.min(MAX, marks.length);
    for (let i = 0; i < n; i++) {
      const k = marks[i]!;
      // A soft shimmer running along the trail towards the goal.
      const shimmer = 0.88 + 0.12 * Math.sin(t * 5 - i * 0.9);
      const s = Math.max(0.001, k.fade * shimmer);
      this.v.set(k.x, height(k.x, k.z) + 0.035, k.z);
      this.q.setFromEulerAngles(0, (k.yaw * 180) / Math.PI, 0);
      this.sc.set(s * 1.35, 1, s * 1.35);
      this.m.setTRS(this.v, this.q, this.sc);
      this.data.set(this.m.data, i * 16);
    }
    this.vb.setData(this.data);
    this.mi.instancingCount = n;
    this.mat.opacity = 0.82;
  }

  hide(): void {
    this.mi.instancingCount = 0;
  }
}
