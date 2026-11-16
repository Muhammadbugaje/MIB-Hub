/**
 * The sky: one dome with a shader that paints the gradient, the sun and its
 * glow, the moon, twinkling stars and drifting clouds; birds flocking over
 * the campus; leaves falling from the trees near the camera; and smoke
 * rising from the suya grill. All of it costs a few draw calls.
 */
import * as pc from "playcanvas";
import { Builder, MeshData } from "../gfx/builder.ts";
import { SH, flapChunk } from "../gfx/materials.ts";
import type { SkyState } from "../sim/daynight.ts";
import { makeRng } from "../sim/rng.ts";
import type { TreeInfo } from "./nature.ts";
import { surfaceHeight } from "./surface.ts";

const VS = /* glsl */ `
attribute vec3 aPosition;
uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;
varying vec3 vDir;
void main(void) {
  vDir = aPosition;
  vec4 p = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);
  gl_Position = p.xyww;
  gl_Position.z = p.w * 0.99999; // just inside the far plane, behind everything
}`;

const FS = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunColor;
uniform float uTime;
uniform float uNight;
uniform float uCloud;
uniform float uExposure;

float hash3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return s;
}
// Khronos PBR Neutral, the same curve the engine uses for the world (TONEMAP_NEUTRAL).
vec3 neutral(vec3 color) {
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < 0.76) return color;
  float d = 0.24;
  float newPeak = 1.0 - d * d / (peak + d - 0.76);
  color *= newPeak / peak;
  float g = 1.0 - 1.0 / (0.15 * (peak - newPeak) + 1.0);
  return mix(color, vec3(newPeak), g);
}

void main(void) {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uTop, pow(clamp(h, 0.0, 1.0), 0.5));
  // Below the horizon: fade to the ground haze (hidden by hills and fog anyway).
  col = mix(col, mix(uHorizon, uGround, 0.6), smoothstep(0.0, -0.12, h));
  float sd = max(dot(d, uSunDir), 0.0);
  float day = 1.0 - uNight;
  // Mie-ish glow around the sun, stronger near the horizon.
  col += uSunColor * (pow(sd, 6.0) * 0.28 + pow(sd, 48.0) * 0.5) * (0.4 + day * 0.6) * (1.0 + (1.0 - clamp(h * 3.0, 0.0, 1.0)) * 0.6);
  col += uSunColor * smoothstep(0.99955, 0.99975, sd) * 14.0 * step(-0.02, uSunDir.y);
  // Moon.
  float md = max(dot(d, uMoonDir), 0.0);
  col += vec3(0.8, 0.86, 1.0) * (smoothstep(0.99935, 0.9996, md) * 2.2 + pow(md, 120.0) * 0.12) * uNight;
  // Stars.
  if (h > 0.0 && uNight > 0.02) {
    vec3 g = floor(d * 260.0);
    float s = hash3(g);
    float tw = 0.6 + 0.4 * sin(uTime * 2.0 + s * 80.0);
    col += vec3(0.9, 0.95, 1.0) * step(0.9972, s) * tw * uNight * smoothstep(0.02, 0.35, h) * 1.4;
  }
  // Clouds: a drifting fractal layer projected onto a plane overhead.
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.08) * 0.9 + vec2(uTime * 0.004, uTime * 0.0016);
    float n = fbm(uv * 1.3);
    float cover = smoothstep(0.58 - uCloud * 0.18, 0.86, n) * smoothstep(0.0, 0.12, h);
    float thick = smoothstep(0.55, 0.95, n);
    vec3 lit = mix(vec3(1.0, 0.98, 0.96), uSunColor, 0.35) * (0.75 + 0.6 * pow(sd, 3.0));
    vec3 shade = mix(uTop, uHorizon, 0.5) * 0.85;
    vec3 cc = mix(lit, shade, thick * 0.55);
    cc = mix(cc, cc * vec3(0.09, 0.1, 0.16), uNight);
    col = mix(col, cc, cover * 0.92);
  }
  col *= uExposure;
  col = neutral(col);
  gl_FragColor = vec4(pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
}`;

export class Sky {
  readonly entity: pc.Entity;
  private mat: pc.ShaderMaterial;

  constructor(app: pc.AppBase) {
    const mat = new pc.ShaderMaterial({ uniqueName: "WipSky", vertexGLSL: VS, fragmentGLSL: FS, attributes: { aPosition: pc.SEMANTIC_POSITION } });
    mat.cull = pc.CULLFACE_NONE;
    mat.depthWrite = false;
    mat.update();
    this.mat = mat;
    const mesh = pc.Mesh.fromGeometry(app.graphicsDevice, new pc.SphereGeometry({ radius: 1, latitudeBands: 24, longitudeBands: 32 }));
    this.entity = new pc.Entity("sky");
    const mi = new pc.MeshInstance(mesh, mat);
    mi.cull = false;
    this.entity.addComponent("render", { meshInstances: [mi], castShadows: false, receiveShadows: false });
    this.entity.setLocalScale(800, 800, 800);
    app.root.addChild(this.entity);
  }

  update(s: SkyState, camPos: pc.Vec3, time: number, exposure: number, clouds = 0.5): void {
    this.entity.setPosition(camPos);
    const m = this.mat;
    m.setParameter("uSunDir", s.sunDir);
    m.setParameter("uMoonDir", s.moonDir);
    m.setParameter("uTop", s.skyTop);
    m.setParameter("uHorizon", s.skyHorizon);
    m.setParameter("uGround", s.groundBounce);
    m.setParameter("uSunColor", s.sunColor);
    m.setParameter("uTime", time);
    m.setParameter("uNight", s.night);
    m.setParameter("uCloud", clouds);
    m.setParameter("uExposure", exposure);
  }
}

/* ----------------------------------------------------------------- birds */

interface Flock { cx: number; cz: number; y: number; r: number; speed: number; phase: number; count: number; kind: "circle" | "pass" }

export class Birds {
  private vb: pc.VertexBuffer;
  private data: Float32Array;
  private flocks: Flock[];
  private total: number;
  private m = new pc.Mat4();
  private q = new pc.Quat();
  private v = new pc.Vec3();
  private s = new pc.Vec3(1, 1, 1);

  constructor(app: pc.AppBase, count: number) {
    const rng = makeRng(808);
    this.flocks = [
      { cx: 0, cz: -150, y: 42, r: 60, speed: 0.12, phase: 0, count: 14, kind: "circle" },
      { cx: -80, cz: 40, y: 34, r: 40, speed: -0.16, phase: 2, count: 10, kind: "circle" },
      { cx: 90, cz: -60, y: 55, r: 90, speed: 0.08, phase: 4, count: 12, kind: "circle" },
      { cx: 0, cz: 0, y: 70, r: 260, speed: 0.03, phase: 1, count: 9, kind: "pass" },
    ];
    const scaleDown = count / 45;
    for (const f of this.flocks) f.count = Math.max(4, Math.round(f.count * scaleDown));
    this.total = this.flocks.reduce((a, f) => a + f.count, 0);
    void rng;
    // A simple bird: body and two swept wings (the shader flaps them).
    const d = new MeshData();
    const b = new Builder(() => d);
    b.at(0, 0).tint([40, 38, 44, 255]);
    b.poly("x", [[0, 0, 0.32], [0.06, 0, -0.1], [0, 0.04, -0.3], [-0.06, 0, -0.1]], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 1, 0]);
    b.poly("x", [[0.04, 0, 0.12], [0.62, 0.02, -0.12], [0.5, 0.02, -0.2], [0.04, 0, -0.05]], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 1, 0]);
    b.poly("x", [[-0.04, 0, 0.12], [-0.04, 0, -0.05], [-0.5, 0.02, -0.2], [-0.62, 0.02, -0.12]], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 1, 0]);
    const mesh = new pc.Mesh(app.graphicsDevice);
    mesh.setPositions(new Float32Array(d.pos));
    mesh.setNormals(new Float32Array(d.nor));
    mesh.setUvs(0, new Float32Array(d.uv));
    mesh.setColors32(new Uint8Array(d.col));
    mesh.setIndices(new Uint16Array(d.idx));
    mesh.update(pc.PRIMITIVE_TRIANGLES);
    const mat = new pc.StandardMaterial();
    mat.diffuse = new pc.Color(0.16, 0.15, 0.18);
    mat.cull = pc.CULLFACE_NONE;
    mat.twoSidedLighting = true;
    mat.gloss = 0.2;
    (mat as unknown as { ambientSH: Float32Array }).ambientSH = SH;
    mat.getShaderChunks(pc.SHADERLANGUAGE_GLSL).set("transformVS", flapChunk(app.graphicsDevice));
    mat.update();
    this.data = new Float32Array(this.total * 16);
    this.vb = new pc.VertexBuffer(app.graphicsDevice, pc.VertexFormat.getDefaultInstancingFormat(app.graphicsDevice), this.total, { usage: pc.BUFFER_DYNAMIC, data: this.data });
    const mi = new pc.MeshInstance(mesh, mat);
    mi.setInstancing(this.vb);
    const e = new pc.Entity("birds");
    e.addComponent("render", { meshInstances: [mi], castShadows: false });
    e.render!.customAabb = new pc.BoundingBox(new pc.Vec3(0, 60, -60), new pc.Vec3(400, 60, 400));
    app.root.addChild(e);
  }

  update(t: number): void {
    let k = 0;
    for (const f of this.flocks) {
      const a = t * f.speed + f.phase;
      for (let i = 0; i < f.count; i++) {
        const o = i * 2.399; // golden angle spread inside the flock
        const lag = i * 0.012 * Math.sign(f.speed || 1);
        const aa = a - lag;
        let x: number, z: number, y: number, hx: number, hz: number;
        if (f.kind === "circle") {
          const rr = f.r + Math.sin(o * 3.1 + t * 0.4) * 6;
          x = f.cx + Math.cos(aa) * rr + Math.sin(o) * 2.5;
          z = f.cz + Math.sin(aa) * rr + Math.cos(o) * 2.5;
          y = f.y + Math.sin(t * 0.7 + o) * 2.5 + i * 0.15;
          hx = -Math.sin(aa) * Math.sign(f.speed);
          hz = Math.cos(aa) * Math.sign(f.speed);
        } else {
          const p = ((t * 9 + i * 1.6) % 700) - 350;
          x = p + Math.sin(o) * 3;
          z = -40 + Math.cos(o) * 4 + p * 0.3;
          y = f.y + Math.sin(o * 2) * 3;
          hx = 0.957;
          hz = 0.287;
        }
        this.v.set(x, y, z);
        this.q.setFromEulerAngles(Math.sin(t + o) * 6, (Math.atan2(hx, hz) * 180) / Math.PI, Math.sin(t * 0.8 + o) * 18);
        this.m.setTRS(this.v, this.q, this.s.set(1.3, 1.3, 1.3));
        this.data.set(this.m.data, k * 16);
        k++;
      }
    }
    this.vb.setData(this.data);
  }
}

/* ---------------------------------------------------------------- leaves */

interface Leaf { x: number; y: number; z: number; vy: number; spin: number; rot: number; sway: number; phase: number; rest: number; floor: number }

export class FallingLeaves {
  private leaves: Leaf[] = [];
  private sets: { vb: pc.VertexBuffer; data: Float32Array }[] = [];
  private rng = makeRng(31337);
  private m = new pc.Mat4();
  private q = new pc.Quat();
  private v = new pc.Vec3();
  private s = new pc.Vec3(1, 1, 1);
  private near: TreeInfo[] = [];
  private lastScan = -99;

  constructor(app: pc.AppBase, private trees: TreeInfo[], private count: number) {
    const d = new MeshData();
    const b = new Builder(() => d);
    b.at(0, 0).tint([255, 255, 255, 255]);
    b.poly("x", [[0, 0, 0.07], [0.035, 0, 0.0], [0, 0, -0.07], [-0.035, 0, 0.0]], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 1, 0]);
    const mesh = new pc.Mesh(app.graphicsDevice);
    mesh.setPositions(new Float32Array(d.pos));
    mesh.setNormals(new Float32Array(d.nor));
    mesh.setUvs(0, new Float32Array(d.uv));
    mesh.setIndices(new Uint16Array(d.idx));
    mesh.update(pc.PRIMITIVE_TRIANGLES);
    const colours = [[0.86, 0.66, 0.2], [0.55, 0.62, 0.22], [0.66, 0.36, 0.14]];
    const per = Math.ceil(count / colours.length);
    for (const c of colours) {
      const mat = new pc.StandardMaterial();
      mat.diffuse = new pc.Color(c[0]!, c[1]!, c[2]!);
      mat.cull = pc.CULLFACE_NONE;
      mat.twoSidedLighting = true;
      mat.gloss = 0.25;
      (mat as unknown as { ambientSH: Float32Array }).ambientSH = SH;
      mat.update();
      const data = new Float32Array(per * 16);
      const vb = new pc.VertexBuffer(app.graphicsDevice, pc.VertexFormat.getDefaultInstancingFormat(app.graphicsDevice), per, { usage: pc.BUFFER_DYNAMIC, data });
      const mi = new pc.MeshInstance(mesh, mat);
      mi.setInstancing(vb);
      const e = new pc.Entity("leaves");
      e.addComponent("render", { meshInstances: [mi], castShadows: false });
      e.render!.customAabb = new pc.BoundingBox(new pc.Vec3(0, 10, -60), new pc.Vec3(400, 30, 400));
      app.root.addChild(e);
      this.sets.push({ vb, data });
    }
    for (let i = 0; i < per * colours.length; i++) this.leaves.push({ x: 0, y: -10, z: 0, vy: 0, spin: 0, rot: 0, sway: 0, phase: 0, rest: this.rng.range(0, 4), floor: 0 });
  }

  private respawn(l: Leaf): void {
    if (!this.near.length) {
      l.y = -10;
      l.rest = 1;
      return;
    }
    const t = this.rng.pick(this.near);
    const a = this.rng.range(0, Math.PI * 2), r = this.rng.range(0, t.crownR * 0.8);
    l.x = t.x + Math.cos(a) * r;
    l.z = t.z + Math.sin(a) * r;
    l.y = t.crownY + this.rng.range(-1, 0.5);
    l.vy = this.rng.range(0.45, 0.8);
    l.spin = this.rng.range(1.5, 4);
    l.sway = this.rng.range(0.4, 1.0);
    l.phase = this.rng.range(0, 6.28);
    l.rot = this.rng.range(0, 360);
    l.rest = 0;
    l.floor = surfaceHeight(l.x, l.z) + 0.02;
  }

  update(dt: number, t: number, camX: number, camZ: number): void {
    if (t - this.lastScan > 1.5) {
      this.lastScan = t;
      this.near = this.trees.filter((tr) => tr.kind !== "palm" && tr.kind !== "far" && Math.hypot(tr.x - camX, tr.z - camZ) < 45);
    }
    let k = 0;
    const per = this.sets[0]!.data.length / 16;
    for (const l of this.leaves) {
      if (l.y <= l.floor) {
        // Resting on the ground for a while, then gone.
        l.rest -= dt;
        if (l.rest <= 0) this.respawn(l);
      } else {
        l.y -= l.vy * dt;
        l.x += Math.sin(t * 1.3 + l.phase) * l.sway * dt + 0.25 * dt;
        l.z += Math.cos(t * 1.1 + l.phase) * l.sway * dt * 0.6;
        l.rot += l.spin * 60 * dt;
        if (l.y <= l.floor) {
          l.y = l.floor;
          l.rest = this.rng.range(3, 8);
        }
      }
      const flat = l.y <= l.floor;
      this.v.set(l.x, l.y, l.z);
      this.q.setFromEulerAngles(flat ? 0 : Math.sin(t * 3 + l.phase) * 55, l.rot, flat ? 0 : Math.cos(t * 2.4 + l.phase) * 40);
      this.m.setTRS(this.v, this.q, this.s.set(1.4, 1.4, 1.4));
      const set = this.sets[Math.floor(k / per)]!;
      set.data.set(this.m.data, (k % per) * 16);
      k++;
    }
    for (const s of this.sets) s.vb.setData(s.data);
    void this.count;
  }
}

/* ----------------------------------------------------------------- smoke */

/** Soft smoke puffs over the suya grill (a small pool of billboards, no allocation per frame). */
export class Smoke {
  private puffs: { e: pc.Entity; age: number; life: number; dx: number }[] = [];
  private mat: pc.StandardMaterial;
  constructor(app: pc.AppBase, private x: number, private z: number, tex: pc.Texture) {
    const mat = new pc.StandardMaterial();
    mat.diffuse = new pc.Color(0.82, 0.8, 0.78);
    mat.opacityMap = tex;
    mat.opacityMapChannel = "a";
    mat.blendType = pc.BLEND_NORMAL;
    mat.depthWrite = false;
    mat.opacity = 0.35;
    mat.useLighting = true;
    (mat as unknown as { ambientSH: Float32Array }).ambientSH = SH;
    mat.update();
    this.mat = mat;
    const rng = makeRng(5);
    for (let i = 0; i < 10; i++) {
      const e = new pc.Entity("puff");
      e.addComponent("render", { type: "plane", castShadows: false, receiveShadows: false });
      e.render!.meshInstances[0]!.material = mat;
      app.root.addChild(e);
      this.puffs.push({ e, age: (i / 10) * 4, life: 4, dx: rng.range(-0.3, 0.3) });
    }
  }
  update(dt: number, cam: pc.Entity): void {
    for (const p of this.puffs) {
      p.age = (p.age + dt) % p.life;
      const t = p.age / p.life;
      p.e.setPosition(this.x + p.dx + t * 1.2, 1.2 + t * 4.5, this.z + t * 0.4);
      p.e.lookAt(cam.getPosition());
      p.e.rotateLocal(90, 0, 0);
      const s = 0.5 + t * 2.4;
      p.e.setLocalScale(s, s, s);
    }
    this.mat.opacity = 0.32;
  }
}
