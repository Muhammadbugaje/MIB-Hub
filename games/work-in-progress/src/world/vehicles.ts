/**
 * Traffic you can see: cars (CC0 Quaternius models), okadas and kekes
 * driving the lanes from layout.ts with the logic in sim/traffic.ts, plus
 * parked cars.
 *
 * Smoothness and correctness (plan §1.5, the classic game's complaints):
 *  - the simulation runs at a fixed 60 Hz; what you see is interpolated
 *    between the last two steps, so nothing jitters at any frame rate;
 *  - every model's forward axis is measured at load (headlights end) and
 *    turned to +z, then +z is turned to the direction of travel;
 *  - every model's lowest point is measured and put exactly on the road;
 *  - okada lean comes from a critically damped spring on the turn rate (no wobble).
 */
import * as pc from "playcanvas";
import { Builder, MeshData, type RGBA } from "../gfx/builder.ts";
import { SH, type MatLib } from "../gfx/materials.ts";
import { makePath, type Path } from "../sim/path.ts";
import type { Rng } from "../sim/rng.ts";
import { type Obstacle, type Vehicle, placeVehicle, stepTraffic } from "../sim/traffic.ts";
import { lanes, parked } from "./layout.ts";
import { type CharModel, MALE_MODELS, Person, randomLook } from "./people.ts";
import { surfaceHeight } from "./surface.ts";
import { KEKE_COLOURS, KEKE_LENGTH, KEKE_SEATS, OKADA_COLOURS, OKADA_LENGTH, OKADA_SEATS, kekeMesh, okadaMesh } from "./vehicle-models.ts";

const hex = (h: string): RGBA => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];

export const CAR_COLOURS = ["#e9e9e6", "#b9bec4", "#1e1f22", "#8a1f24", "#1f4e8a", "#2f5f4a", "#c9c2b0", "#5a5f66"];

interface CarModel {
  key: string;
  container: pc.ContainerResource;
  /** Rotation (degrees about y) that makes the model face +z. */
  turn: number;
  /** Offset that puts the model's lowest point at y = 0 and its centre at x = z = 0. */
  offset: pc.Vec3;
  length: number;
  slots: string[];
}

/** Analyse a car mesh: bounding box and which end the headlights are on. */
function analyseCar(mesh: pc.Mesh, slotNames: string[]): { turn: number; offset: pc.Vec3; length: number } {
  const pos: number[] = [];
  const uv: number[] = [];
  mesh.getPositions(pos);
  mesh.getUvs(0, uv);
  const lightSlot = slotNames.findIndex((s) => /headlight/i.test(s));
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  let lz = 0, ln = 0;
  for (let i = 0; i < pos.length / 3; i++) {
    for (let c = 0; c < 3; c++) {
      min[c] = Math.min(min[c]!, pos[i * 3 + c]!);
      max[c] = Math.max(max[c]!, pos[i * 3 + c]!);
    }
    if (Math.floor(uv[i * 2]! * 16) === lightSlot) {
      lz += pos[i * 3 + 2]!;
      ln++;
    }
  }
  const cz = (min[2]! + max[2]!) / 2;
  const front = ln ? lz / ln - cz : 1;
  return { turn: front >= 0 ? 0 : 180, offset: new pc.Vec3(-(min[0]! + max[0]!) / 2, -min[1]!, -cz), length: max[2]! - min[2]! };
}

export async function loadCars(app: pc.AppBase, base: string): Promise<CarModel[]> {
  const index = (await (await fetch(`${base}cars/index.json`)).json()) as Record<string, { file: string; slots: { name: string }[] }>;
  return Promise.all(
    Object.entries(index).map(
      ([key, info]) =>
        new Promise<CarModel>((resolve, reject) => {
          app.assets.loadFromUrl(`${base}cars/${info.file}`, "container", (err, asset) => {
            if (err || !asset) return reject(new Error(String(err)));
            const container = asset.resource as pc.ContainerResource;
            const probe = container.instantiateRenderEntity();
            const mi = (probe.findComponents("render") as pc.RenderComponent[])[0]!.meshInstances[0]!;
            const slots = info.slots.map((s) => s.name);
            const a = analyseCar(mi.mesh!, slots);
            probe.destroy();
            resolve({ key, container, slots, ...a });
          });
        }),
    ),
  );
}

function carMaterial(device: pc.GraphicsDevice, model: CarModel, body: string, cache: Map<string, pc.StandardMaterial>): pc.StandardMaterial {
  const key = `${model.key}|${body}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const data = new Uint8Array(64), glow = new Uint8Array(64);
  model.slots.forEach((s, i) => {
    let c: RGBA = hex(body);
    if (/window/i.test(s)) c = [38, 46, 54, 255];
    else if (/black/i.test(s)) c = [22, 22, 24, 255];
    else if (/grey|material/i.test(s)) c = [70, 72, 76, 255];
    else if (/headlight/i.test(s)) c = [250, 240, 214, 255];
    else if (/tail|brake/i.test(s)) c = [190, 26, 22, 255];
    else if (/yellow/i.test(s) && model.key === "taxi") c = hex("#f0c419");
    data.set(c as number[], i * 4);
    if (/headlight/i.test(s)) glow.set([255, 240, 210, 255], i * 4);
    if (/tail|brake/i.test(s)) glow.set([255, 40, 30, 255], i * 4);
  });
  const opts = { width: 16, height: 1, mipmaps: false, minFilter: pc.FILTER_NEAREST, magFilter: pc.FILTER_NEAREST, addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE };
  const m = new pc.StandardMaterial();
  m.diffuseMap = new pc.Texture(device, { ...opts, format: pc.PIXELFORMAT_SRGBA8, levels: [data] });
  m.emissiveMap = new pc.Texture(device, { ...opts, format: pc.PIXELFORMAT_SRGBA8, levels: [glow] });
  m.emissive = new pc.Color(1, 1, 1);
  m.emissiveIntensity = 0;
  m.useMetalness = true;
  m.metalness = 0.35;
  m.gloss = 0.68;
  (m as unknown as { ambientSH: Float32Array }).ambientSH = SH;
  m.update();
  cache.set(key, m);
  return m;
}

function builtMesh(device: pc.GraphicsDevice, build: (b: Builder) => void): Map<string, pc.Mesh> {
  const parts = new Map<string, MeshData>();
  const b = new Builder((mat) => {
    let d = parts.get(mat);
    if (!d) parts.set(mat, (d = new MeshData()));
    return d;
  });
  b.at(0, 0);
  build(b);
  const out = new Map<string, pc.Mesh>();
  for (const [mat, d] of parts) {
    const mesh = new pc.Mesh(device);
    mesh.setPositions(new Float32Array(d.pos));
    mesh.setNormals(new Float32Array(d.nor));
    mesh.setUvs(0, new Float32Array(d.uv));
    mesh.setColors32(new Uint8Array(d.col));
    mesh.setIndices(new Uint16Array(d.idx));
    mesh.update(pc.PRIMITIVE_TRIANGLES);
    out.set(mat, mesh);
  }
  return out;
}

interface Visual {
  v: Vehicle;
  root: pc.Entity;
  body: pc.Entity;
  /** Interpolation: state at the previous and current fixed step. */
  px: number; pz: number; pyaw: number;
  cx: number; cz: number; cyaw: number;
  lean: number; leanVel: number;
  riders: Person[];
  mats: pc.StandardMaterial[];
}

export class Traffic {
  readonly paths: Path[];
  readonly vehicles: Vehicle[] = [];
  private visuals: Visual[] = [];
  private carMats = new Map<string, pc.StandardMaterial>();
  private emissive: pc.StandardMaterial[] = [];
  readonly root = new pc.Entity("traffic");

  constructor(private app: pc.AppBase, private mats: MatLib, private cars: CarModel[], people: CharModel[], rng: Rng, counts: { car: number; okada: number; keke: number }) {
    app.root.addChild(this.root);
    this.paths = lanes.map((l) => makePath(l.pts));
    const device = app.graphicsDevice;

    // Pre-built okada and keke meshes per colour (shared by every vehicle of that colour).
    const okadas = OKADA_COLOURS.map((c) => builtMesh(device, (b) => okadaMesh(b, hex(c))));
    const kekes = KEKE_COLOURS.map(([a, s]) => builtMesh(device, (b) => kekeMesh(b, hex(a), hex(s))));
    const riders = people.filter((p) => MALE_MODELS.includes(p.key) && p.tracks.has("sit"));

    const spawn = (kind: Vehicle["kind"], lane: number, s: number) => {
      const isCar = kind === "car";
      const car = isCar ? rng.pick(cars) : null;
      const v: Vehicle = {
        kind, path: lane, s, speed: 0, cruise: kind === "car" ? rng.range(10, 13.5) : kind === "okada" ? rng.range(9, 12) : rng.range(7, 8.5),
        length: car ? car.length + 0.4 : kind === "okada" ? OKADA_LENGTH : KEKE_LENGTH, x: 0, z: 0, dx: 0, dz: 1, wait: 0,
      };
      v.speed = v.cruise * 0.7;
      placeVehicle(v, this.paths);
      const root = new pc.Entity(kind);
      const body = new pc.Entity("body");
      root.addChild(body);
      this.root.addChild(root);
      const vis: Visual = { v, root, body, px: v.x, pz: v.z, pyaw: 0, cx: v.x, cz: v.z, cyaw: 0, lean: 0, leanVel: 0, riders: [], mats: [] };
      vis.cyaw = vis.pyaw = Math.atan2(v.dx, v.dz);
      if (car) {
        const e = car.container.instantiateRenderEntity();
        const mat = carMaterial(device, car, car.key === "taxi" ? "#f0c419" : rng.pick(CAR_COLOURS), this.carMats);
        for (const r of e.findComponents("render") as pc.RenderComponent[]) for (const mi of r.meshInstances) mi.material = mat;
        e.setLocalEulerAngles(0, car.turn, 0);
        const off = car.offset.clone();
        if (car.turn) off.set(-off.x, off.y, -off.z);
        e.setLocalPosition(off);
        body.addChild(e);
        if (!this.emissive.includes(mat)) this.emissive.push(mat);
      } else {
        const meshes = kind === "okada" ? rng.pick(okadas) : rng.pick(kekes);
        const mis = [...meshes].map(([mat, mesh]) => new pc.MeshInstance(mesh, this.mats.get(mat)));
        body.addComponent("render", { meshInstances: mis, castShadows: true });
        if (riders.length) {
          const seats = kind === "okada" ? [OKADA_SEATS.rider, ...(rng.chance(0.5) ? [OKADA_SEATS.passenger] : [])] : [KEKE_SEATS.driver];
          for (const seat of seats) {
            const p = new Person(app, rng.pick(riders), randomLook(rng, riders, false), body, { shadows: true });
            p.pose("sit");
            // The sit clip's hips are ~0.47 m above the floor at our scale: lift so they rest on the seat.
            p.place(0, seat.y - 0.47, seat.z - 0.12, 0);
            vis.riders.push(p);
          }
        }
      }
      root.setLocalPosition(v.x, surfaceHeight(v.x, v.z), v.z);
      this.visuals.push(vis);
      this.vehicles.push(v);
    };

    lanes.forEach((lane, li) => {
      const len = this.paths[li]!.length;
      const n = Math.max(1, Math.round((len / 860) * (counts.car + counts.okada + counts.keke) / 2.4));
      for (let i = 0; i < n; i++) {
        const want = rng.pick(lane.kinds);
        const kind = want === "car" && this.count("car") >= counts.car ? "okada" : want === "okada" && this.count("okada") >= counts.okada ? "keke" : want;
        spawn(kind, li, (i / n) * len + rng.range(0, 10));
      }
    });

    // Parked cars (static).
    for (const p of parked) {
      const car = rng.pick(cars);
      const e = car.container.instantiateRenderEntity();
      const mat = carMaterial(device, car, car.key === "taxi" ? "#f0c419" : rng.pick(CAR_COLOURS), this.carMats);
      for (const r of e.findComponents("render") as pc.RenderComponent[]) for (const mi of r.meshInstances) mi.material = mat;
      const holder = new pc.Entity("parked");
      holder.addChild(e);
      e.setLocalEulerAngles(0, car.turn, 0);
      const off = car.offset.clone();
      if (car.turn) off.set(-off.x, off.y, -off.z);
      e.setLocalPosition(off);
      holder.setLocalPosition(p.x, surfaceHeight(p.x, p.z), p.z);
      holder.setLocalEulerAngles(0, (p.yaw * 180) / Math.PI, 0);
      this.root.addChild(holder);
    }
  }

  /** A standalone car (cutscene props), normalised and painted like the traffic. */
  carEntity(key: string, colour: string): pc.Entity {
    const car = this.cars.find((c) => c.key === key) ?? this.cars[0]!;
    const e = car.container.instantiateRenderEntity();
    const mat = carMaterial(this.app.graphicsDevice, car, colour, this.carMats);
    if (!this.emissive.includes(mat)) this.emissive.push(mat);
    for (const r of e.findComponents("render") as pc.RenderComponent[]) for (const mi of r.meshInstances) mi.material = mat;
    e.setLocalEulerAngles(0, car.turn, 0);
    const off = car.offset.clone();
    if (car.turn) off.set(-off.x, off.y, -off.z);
    e.setLocalPosition(off);
    return e;
  }

  private count(kind: Vehicle["kind"]): number {
    return this.vehicles.filter((v) => v.kind === kind).length;
  }

  /** One fixed simulation step. */
  step(dt: number, obstacles: readonly Obstacle[]): void {
    for (const vis of this.visuals) {
      vis.px = vis.cx;
      vis.pz = vis.cz;
      vis.pyaw = vis.cyaw;
    }
    stepTraffic(this.vehicles, this.paths, dt, obstacles);
    for (const vis of this.visuals) {
      const v = vis.v;
      const teleported = Math.hypot(v.x - vis.cx, v.z - vis.cz) > 5;
      vis.cx = v.x;
      vis.cz = v.z;
      let yaw = Math.atan2(v.dx, v.dz);
      // Keep yaw continuous so interpolation never spins the long way round.
      while (yaw - vis.cyaw > Math.PI) yaw -= 2 * Math.PI;
      while (yaw - vis.cyaw < -Math.PI) yaw += 2 * Math.PI;
      const turnRate = (yaw - vis.cyaw) / dt;
      vis.cyaw = yaw;
      if (teleported) {
        vis.px = vis.cx;
        vis.pz = vis.cz;
        vis.pyaw = vis.cyaw;
      }
      if (v.kind === "okada") {
        // Lean into the turn: critically damped spring (no overshoot, no wobble).
        const target = Math.max(-0.35, Math.min(0.35, -turnRate * v.speed * 0.045));
        const k = 60, c = 2 * Math.sqrt(k);
        vis.leanVel += (k * (target - vis.lean) - c * vis.leanVel) * dt;
        vis.lean += vis.leanVel * dt;
      }
      vis.root.enabled = v.wait <= 0;
    }
  }

  /** Draw state between the last two steps (alpha 0..1). */
  render(alpha: number, night: number, camX: number, camZ: number): void {
    for (const vis of this.visuals) {
      if (!vis.root.enabled) continue;
      const x = vis.px + (vis.cx - vis.px) * alpha;
      const z = vis.pz + (vis.cz - vis.pz) * alpha;
      const yaw = vis.pyaw + (vis.cyaw - vis.pyaw) * alpha;
      vis.root.setLocalPosition(x, surfaceHeight(x, z), z);
      vis.root.setLocalEulerAngles(0, (yaw * 180) / Math.PI, 0);
      if (vis.v.kind === "okada") vis.body.setLocalEulerAngles(0, 0, (vis.lean * 180) / Math.PI);
      const far = Math.hypot(x - camX, z - camZ) > 90;
      for (const r of vis.riders) r.animating = !far;
    }
    const glow = 0.15 + night * 2.2;
    for (const m of this.emissive) {
      if (Math.abs(m.emissiveIntensity - glow) > 0.02) {
        m.emissiveIntensity = glow;
        m.update();
      }
    }
  }
}
