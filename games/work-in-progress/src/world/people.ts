/**
 * People: every human in the game on ONE skeleton (mib_rig, Mixamo bone
 * names) and ONE clip set (assets/anim/*.glb, converted from the owner's
 * Mixamo downloads by tools/anim/build-anims.ts).
 *
 * Bodies are the CC0 Quaternius bases, re-posed into the Mixamo T-pose and
 * re-bound to mib_rig by tools/anim/rebind-character.ts, 1.74 m tall, with
 * smooth welded normals and a subdivided close-up LOD (no flat facets, no
 * "boxy sand"). They are recoloured per person with a tiny palette texture
 * (skin, hair, clothes); hijabs and caps ride on the head bone.
 *
 * Animation is ours, not the engine's: each Person has an Animator
 * (src/anim/animator.ts) that writes bone rotations every frame. One ticker
 * runs them all after the game's update, with crowd LOD (plan §4.7): full
 * IK and reactions near the camera, plain clips further out at a lower
 * rate, frozen far away.
 *
 * Rules this follows (plan §1.2, §1.3):
 *  - one scale for every human; height varies only within ±6 %;
 *  - feet never slide: the gait's play rate comes from the measured ground
 *    speed of the body (not the requested speed) and the clips' measured
 *    stride speeds;
 *  - every change of animation blends (no pops);
 *  - skin and hair are never glossy (roughness >= 0.55).
 */
import * as pc from "playcanvas";
import { Animator } from "../anim/animator.ts";
import { MotionSense } from "../anim/motion-sense.ts";
import { FEEL } from "../anim/feel.ts";
import { AnimLibrary, type AnimIndex } from "../anim/library.ts";
import { B, BONE_COUNT, MIB_BONES, Skeleton } from "../anim/skeleton.ts";
import type { V3 } from "../anim/math.ts";
import { Builder, MeshData, type RGBA } from "../gfx/builder.ts";
import { SH } from "../gfx/materials.ts";
import type { Rng } from "../sim/rng.ts";
import { type GestureName } from "./rig.ts";
import { surfaceHeight } from "./surface.ts";
import { HIJAB_STYLES, buildHeadwear, type HijabStyle } from "./headwear.ts";
import { DEFAULT_BODY, buildBody, type BodyKit, type BodyShape } from "./bodymesh.ts";

export const HUMAN_HEIGHT = 1.74;

export interface ModelInfo {
  file: string;
  slots: { name: string; color: number[] }[];
  height: number;
  hipHeight: number;
  rig: string;
  /** Head, neck and chest measurements for headwear (tools/anim/rebind-character.ts). */
  fit?: unknown;
}

export interface CharModel {
  key: string;
  info: ModelInfo;
  container: pc.ContainerResource;
  female: boolean;
  /** Model scale (1: bodies are built at 1.74 m). */
  scale: number;
  /** mib_rig proportions of this body. */
  skeleton: Skeleton;
  /** The smooth close-up mesh, the crowd mesh, the skin and the body morphs (built at load). */
  kit: BodyKit;
  /** Ground speed (m/s) of a natural walk and run on this body (stride-matched). */
  walkSpeed: number;
  runSpeed: number;
}

/** What a person looks like. Saved for the player; random for everyone else. */
export interface Look {
  model: string;
  skin: string;
  hair: string;
  /** Colours for the clothing slots, in slot order. */
  outfit: string[];
  headwear: "none" | "hijab" | "cap";
  headwearColor: string;
  /** Hijab style (default "wrap"); see world/headwear.ts. */
  hijabStyle?: HijabStyle;
  /** Body shape (morph weights 0..1); omitted = the natural default. */
  body?: BodyShape;
}

export const FEMALE_MODELS = ["animwoman", "womandress", "womancasual"];
export const MALE_MODELS = ["casual", "hoodie", "business", "man", "manlong", "mansuit", "farmer"];

export const SKIN_TONES = ["#4a2e1f", "#5a3a26", "#6b4430", "#7a4e34", "#8d5b3c", "#a06a46", "#b5794f", "#c68a5e", "#d9a77c", "#e8c3a0"];
export const HAIR = ["#141010", "#1d1512", "#2a1d16", "#3b2a1e", "#0e0c0c"];
export const CLOTH = [
  "#f4f1ea", "#e9e4d8", "#86b7e0", "#2a5fa8", "#1f3c66", "#7a2e3b", "#a83232", "#2f8a4c", "#1f6b52", "#e0a526", "#d9622b",
  "#5b4ba8", "#2b2b2b", "#56606a", "#c9b896", "#e98a8a", "#f2c230", "#3e8e9e", "#8a5a3a", "#d7d0c3",
];

const hexToRgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** What each slot of a model is for (skin, hair, eyes, or the n-th clothing colour). */
export function slotRoles(info: Pick<ModelInfo, "file" | "slots">): ("skin" | "skinDark" | "hair" | "brow" | "eye" | "detail" | number)[] {
  // The long-dress body: cloth colours in the cast's order [dress, trim (shoes), belt]; "Brown" is its eyebrows.
  if (info.file.startsWith("womandress")) {
    const map: Record<string, "skin" | "hair" | "brow" | number> = { Skin: "skin", LimeGreen: 0, Red: 1, Gold: 2, Brown: "brow", Hair: "hair" };
    return info.slots.map((s) => map[s.name] ?? "detail");
  }
  let cloth = 0;
  return info.slots.map((s) => {
    const n = s.name.toLowerCase();
    if (n === "skin") return "skin";
    if (n.startsWith("skin")) return "skinDark";
    if (n.startsWith("hair")) return "hair";
    if (n.startsWith("eyebrow")) return "brow";
    if (n.startsWith("eye")) return "eye";
    if (n === "tietexture" || n === "details" || n === "earrings" || n === "gold") return "detail";
    return cloth++;
  });
}

export function clothingSlots(info: Pick<ModelInfo, "file" | "slots">): number {
  return slotRoles(info).filter((r) => typeof r === "number").length;
}

export function randomLook(rng: Rng, models: CharModel[], female?: boolean): Look {
  const pool = models.filter((m) => female === undefined || m.female === female);
  const m = rng.pick(pool);
  const n = clothingSlots(m.info);
  const outfit = Array.from({ length: n }, () => rng.pick(CLOTH));
  // A long kaftan look sometimes: top and bottom the same colour.
  if (n >= 2 && rng.chance(0.25)) outfit[1] = outfit[0]!;
  const head = m.female ? (rng.chance(0.55) ? "hijab" : "none") : rng.chance(0.3) ? "cap" : "none";
  const look: Look = {
    model: m.key,
    skin: rng.pick(SKIN_TONES.slice(0, 9)),
    hair: rng.pick(HAIR),
    outfit,
    headwear: head,
    headwearColor: head === "cap" ? rng.pick(["#f4f1ea", "#2a5fa8", "#7a2e3b", "#2b2b2b", "#1f6b52"]) : rng.pick(CLOTH),
  };
  if (head === "hijab") look.hijabStyle = rng.pick(HIJAB_STYLES);
  return look;
}

/**
 * The 16 x 1 palette texture for a look (one texel per material slot).
 * Alpha 0 hides a slot (hair under a hijab: rule "hair hidden completely").
 */
export function paletteFor(device: pc.GraphicsDevice, model: Pick<CharModel, "info">, look: Look): pc.Texture {
  const roles = slotRoles(model.info);
  const data = new Uint8Array(16 * 4);
  const skin = hexToRgb(look.skin), hair = hexToRgb(look.hair);
  const hideHair = look.headwear === "hijab";
  roles.forEach((r, i) => {
    let c: [number, number, number];
    let a = 255;
    if (r === "skin") c = skin;
    else if (r === "skinDark") c = [skin[0] * 0.88, skin[1] * 0.85, skin[2] * 0.83];
    else if (r === "hair" || r === "brow") {
      c = hair;
      if (r === "hair" && hideHair) a = 0;
    } else if (r === "eye") c = [24, 20, 18];
    else if (r === "detail") c = model.info.slots[i]!.color.map((v) => Math.round(Math.pow(v, 1 / 2.2) * 255)) as [number, number, number];
    else c = hexToRgb(look.outfit[r] ?? "#888888");
    data.set([c[0], c[1], c[2], a], i * 4);
  });
  return new pc.Texture(device, {
    width: 16, height: 1, format: pc.PIXELFORMAT_SRGBA8, mipmaps: false,
    minFilter: pc.FILTER_NEAREST, magFilter: pc.FILTER_NEAREST, addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    levels: [data],
  });
}

/* ------------------------------------------------------------------ loading */

/** The game's one clip library (set by loadPeople). */
export let ANIM: AnimLibrary = new AnimLibrary();

export async function loadPeople(app: pc.AppBase, base: string, onProgress: (f: number) => void): Promise<CharModel[]> {
  const [index, animIndex] = await Promise.all([
    fetch(`${base}people/index.json`).then((r) => r.json() as Promise<Record<string, ModelInfo>>),
    fetch(`${base}anim/index.json`).then((r) => r.json() as Promise<AnimIndex>),
  ]);
  ANIM = new AnimLibrary(animIndex, (file) => fetch(`${base}anim/${file}`).then((r) => {
    if (!r.ok) throw new Error(`anim pack ${file}: ${r.status}`);
    return r.arrayBuffer();
  }));
  // The core pack before anyone moves; the social pack right after (cutscenes need it soon).
  const loco = ANIM.loadPack("locomotion");
  const keys = Object.keys(index);
  let done = 0;
  const models = await Promise.all(
    keys.map(
      (key) =>
        new Promise<CharModel>((resolve, reject) => {
          const url = `${base}people/${index[key]!.file}`;
          // The bytes for our own mesh build (the browser cache serves the container load the same file).
          const bytes = fetch(url).then((r) => r.arrayBuffer());
          app.assets.loadFromUrl(url, "container", (err, asset) => {
            if (err || !asset) return reject(new Error(String(err)));
            const container = asset.resource as pc.ContainerResource;
            const info = index[key]!;
            bytes.then((buf) => {
              onProgress(++done / (keys.length + 1));
              resolve({ key, info, container, kit: buildBody(app.graphicsDevice, buf), female: FEMALE_MODELS.includes(key), scale: 1, skeleton: skeletonOf(container), walkSpeed: 1.9, runSpeed: 5.2 });
            }, reject);
          });
        }),
    ),
  );
  await loco;
  onProgress(1);
  void ANIM.loadPack("social");
  const walk = ANIM.get("walk_fwd"), run = ANIM.get("run_fwd");
  for (const m of models) {
    const hs = m.skeleton.hipHeight / ANIM.refHipHeight;
    if (walk?.meta.speed) m.walkSpeed = walk.meta.speed * hs;
    if (run?.meta.speed) m.runSpeed = run.meta.speed * hs;
  }
  startTicker(app);
  return models;
}

/** Read a body's mib_rig rest pose from its GLB nodes. */
function skeletonOf(container: pc.ContainerResource): Skeleton {
  const e = container.instantiateRenderEntity();
  const rot = new Float32Array(BONE_COUNT * 4), pos = new Float32Array(BONE_COUNT * 3);
  MIB_BONES.forEach(([n], i) => {
    const node = e.findByName(n);
    const q = node?.getLocalRotation() ?? new pc.Quat();
    const p = node?.getLocalPosition() ?? new pc.Vec3();
    rot.set([q.x, q.y, q.z, q.w], i * 4);
    pos.set([p.x, p.y, p.z], i * 3);
  });
  e.destroy();
  return new Skeleton(rot, pos, ANIM.refHipHeight);
}

const clampN = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/* ------------------------------------------------------------------ the ticker (crowd LOD) */

const LIVE = new Set<Person>();
let personSeed = 0;
const camPos = new pc.Vec3();
/** Frame cost of the last tick (ms) and how many people were at each LOD (perf HUD and tests). */
export const ANIM_STATS = { ms: 0, lod: [0, 0, 0, 0], count: 0, nearest: 0, why: "" };

function startTicker(_app: pc.AppBase): void {}

/**
 * Animate everyone once per frame. main.ts calls this at the end of its
 * update (after the crowd, traffic, story and cutscenes have placed people),
 * so poses always match this frame's positions.
 */
export function tickPeople(app: pc.AppBase, dt: number, camera?: pc.Entity): void {
  tickAll(app, Math.min(dt, 0.1), camera);
}

function tickAll(app: pc.AppBase, dt: number, camera?: pc.Entity): void {
  const t0 = performance.now();
  if (camera) camPos.copy(camera.getPosition());
  else {
    const cams = app.root.findComponents("camera") as pc.CameraComponent[];
    const cam = cams.find((c) => c.enabled && c.entity.enabled);
    if (cam) camPos.copy(cam.entity.getPosition());
  }
  const near: { p: Person; d: number }[] = [];
  ANIM_STATS.lod = [0, 0, 0, 0];
  for (const p of LIVE) {
    if (!p.root.enabled || !p.alive) continue;
    const wp = p.root.getPosition();
    const d = Math.hypot(wp.x - camPos.x, wp.y - camPos.y, wp.z - camPos.z);
    near.push({ p, d });
  }
  near.sort((a, b) => a.d - b.d);
  const L = FEEL.lod;
  let reactive = 0;
  for (const { p, d } of near) {
    let lod: 0 | 1 | 2 | 3;
    if (p.forceLod !== null) lod = p.forceLod;
    else if (!p.animOn) lod = 3;
    else if (d < L.full && reactive < L.reactive) {
      lod = 0;
      reactive++;
    } else if (d < L.mid) lod = 1;
    else if (d < L.far) lod = 2;
    else lod = 3;
    ANIM_STATS.lod[lod]!++;
    p.tick(dt, lod);
  }
  ANIM_STATS.count = near.length;
  ANIM_STATS.nearest = near[0]?.d ?? -1;
  ANIM_STATS.why = near[0] ? `${near[0].p.forceLod}/${near[0].p.animOn}` : "";
  ANIM_STATS.ms = ANIM_STATS.ms * 0.9 + (performance.now() - t0) * 0.1;
}

/* ------------------------------------------------------------ headwear (legacy caps) */

let capMesh: pc.Mesh | null = null;

function meshFrom(device: pc.GraphicsDevice, build: (b: Builder) => void): pc.Mesh {
  const d = new MeshData();
  const b = new Builder(() => d);
  b.at(0, 0);
  build(b);
  const mesh = new pc.Mesh(device);
  mesh.setPositions(new Float32Array(d.pos));
  mesh.setNormals(new Float32Array(d.nor));
  mesh.setUvs(0, new Float32Array(d.uv));
  mesh.setColors32(new Uint8Array(d.col));
  mesh.setIndices(new Uint16Array(d.idx));
  mesh.update(pc.PRIMITIVE_TRIANGLES);
  return mesh;
}

function capMeshFor(device: pc.GraphicsDevice): pc.Mesh {
  if (!capMesh) {
    const W: RGBA = [255, 255, 255, 255];
    capMesh = meshFrom(device, (b) => {
      b.tint(W);
      b.cylinder("x", 0, 0.32, 0, 1.06, 1.0, 0.62, 16, true, true);
    });
  }
  return capMesh;
}

/* ---------------------------------------------------------------- person */

/** The FORMAT.md `actor.anim` names (and a few more the scripts use). */
export type AnimName =
  | "sit" | "stand" | "hug" | "wave" | "phone" | "eat" | "look" | "gesture" | "laugh" | "shock" | "point" | "nod" | "shake_head"
  | "carry" | "write" | "kneel" | "sleep" | "cheer" | "facepalm" | "horns" | "clap" | "hold_torch" | "oath" | "punch" | "fall" | "hit" | "idle" | "talk" | "sit_floor";

/**
 * Names the missions use and how each plays now. Every one has a real clip
 * (Mixamo or made by us); the procedural fallbacks below only run while a
 * clip's pack is still loading or if a clip goes missing.
 */
export const ACT_CLIPS: Record<AnimName, { clip: string; layer: "full" | "upper"; hold?: boolean; then?: string; dur?: number }> = {
  sit: { clip: "sit_down", layer: "full", then: "sit_idle", hold: true },
  sit_floor: { clip: "sit_floor", layer: "full", hold: true },
  stand: { clip: "stand_up", layer: "full" },
  idle: { clip: "idle_breathe", layer: "full" },
  hug: { clip: "hug_a", layer: "full" },
  wave: { clip: "wave", layer: "upper", dur: 2.4 },
  phone: { clip: "phone_call", layer: "upper", hold: true },
  eat: { clip: "eat_stand", layer: "upper", dur: 4.2 },
  look: { clip: "idle_look_around", layer: "upper", dur: 3 },
  gesture: { clip: "talk_1", layer: "upper", dur: 2.8 },
  talk: { clip: "talk_2", layer: "upper", dur: 2.8 },
  laugh: { clip: "laugh", layer: "upper", dur: 2.6 },
  shock: { clip: "shock", layer: "full" },
  point: { clip: "point", layer: "upper" },
  nod: { clip: "nod", layer: "upper", dur: 1.6 },
  shake_head: { clip: "shake_head", layer: "upper" },
  carry: { clip: "carry_idle", layer: "upper", hold: true },
  write: { clip: "write", layer: "upper", dur: 3 },
  kneel: { clip: "kneel_down", layer: "full", then: "kneel", hold: true },
  sleep: { clip: "sleep", layer: "full", hold: true },
  cheer: { clip: "cheer", layer: "full" },
  facepalm: { clip: "facepalm", layer: "upper", dur: 2.4 },
  horns: { clip: "horns", layer: "upper" },
  clap: { clip: "clap", layer: "upper", dur: 2.4 },
  hold_torch: { clip: "point", layer: "upper", hold: true },
  oath: { clip: "raise_hand", layer: "upper", hold: true },
  punch: { clip: "shove", layer: "full" },
  fall: { clip: "knock_down", layer: "full" },
  hit: { clip: "flinch", layer: "upper" },
};

/** Names that have no clip at all today and play a procedural pose (kept for the coverage report). */
export const ANIM_FALLBACKS: AnimName[] = [];

export class Person {
  readonly root: pc.Entity;
  private model: pc.Entity;
  private nodes: (pc.GraphNode | null)[] = [];
  readonly cm: CharModel;
  readonly anim: Animator;
  /** Missions and the director: look-at, fixed head turn, pedals (the old rig API). */
  readonly rig: PersonRig;
  material: pc.StandardMaterial;
  /** Held pose (sit, kneel...) that walking must not cancel. */
  held: AnimName | null = null;
  /** Called on footsteps ("fs_L", "fs_R") and other clip events. */
  onEvent: ((name: string) => void) | null = null;
  alive = true;
  animOn = true;
  forceLod: 0 | 1 | 2 | 3 | null = null;
  private lods: pc.Entity[] = [];
  private meshInstances: pc.MeshInstance[] = [];
  private lodShown = -1;
  private acc = 0;
  private readonly sense = new MotionSense();
  private wanted = 0;
  private placed = { x: 0, y: 0, z: 0, yaw: 0 };
  private tmpQ = new pc.Quat();
  private tmpV = new pc.Vec3();
  /** Player-driven: the controller sets the animator's inputs itself. */
  driven = false;
  /** Feet follow the town's ground (off for riders on vehicles and people in interiors' props). */
  footIK = true;

  constructor(app: pc.AppBase, cm: CharModel, look: Look, parent: pc.Entity, opts: { shadows?: boolean } = {}) {
    this.cm = cm;
    this.root = new pc.Entity("person");
    this.model = cm.container.instantiateRenderEntity();
    this.root.addChild(this.model);
    parent.addChild(this.root);
    this.nodes = MIB_BONES.map(([n]) => this.model.findByName(n));

    const mat = new pc.StandardMaterial();
    mat.useMetalness = true;
    mat.metalness = 0;
    // Soft skin and cloth: roughness 0.68 (never glossy, rule C2), low specular, a warm soft sheen at
    // grazing angles (cheap stand-in for light scattering in skin and fabric fuzz).
    mat.gloss = 0.32;
    mat.specularityFactor = 0.28;
    mat.useSheen = true;
    mat.sheen = new pc.Color(0.16, 0.11, 0.09);
    mat.sheenGloss = 0.35;
    mat.diffuseMap = paletteFor(app.graphicsDevice, cm, look);
    mat.opacityMap = mat.diffuseMap;
    mat.opacityMapChannel = "a";
    mat.alphaTest = 0.5;
    (mat as unknown as { ambientSH: Float32Array }).ambientSH = SH;
    mat.update();
    this.material = mat;
    // The container's own mesh is replaced by our two LODs (smooth close-up and crowd), skinned to its nodes.
    for (const r of this.model.findComponents("render") as pc.RenderComponent[]) r.entity.removeComponent("render");
    const kit = cm.kit;
    const bones = kit.boneNames.map((n) => this.model.findByName(n)!);
    for (const [name, mesh] of [["lod0", kit.lod0], ["lod1", kit.lod1]] as const) {
      const e = new pc.Entity(name);
      this.model.addChild(e);
      const mi = new pc.MeshInstance(mesh, mat);
      const si = new pc.SkinInstance(kit.skin);
      si.bones = bones;
      si.rootBone = this.model;
      mi.skinInstance = si;
      e.addComponent("render", { meshInstances: [mi], castShadows: opts.shadows ?? true, receiveShadows: true });
      this.lods.push(e);
      this.meshInstances.push(mi);
    }
    if (look.body) this.setBody(look.body);
    this.anim = new Animator(ANIM, cm.skeleton);
    this.anim.setSeed(++personSeed * 2654435761);
    this.anim.groundAt = (x, z) => this.groundAt(x, z);
    this.anim.onEvent = (n) => this.onEvent?.(n);
    this.rig = new PersonRig(this);
    if (look.headwear !== "none") this.addHeadwear(app, look);
    this.showLod(1);
    LIVE.add(this);
    // Start in a natural idle (never the T-pose), even for people far away who are not ticked yet.
    this.anim.update(0);
    this.applyPose();
  }

  private addHeadwear(app: pc.AppBase, look: Look): void {
    const head = this.model.findByName("Head");
    if (!head) return;
    const top = this.model.findByName("HeadTop_End");
    this.root.syncHierarchy();
    if (look.headwear === "hijab") {
      buildHeadwear(app.graphicsDevice, this.cm.skeleton, look, this.model, this.cm);
      return;
    }
    // Cap: a short cylinder on the crown, sized from the skeleton (head bone to the top of the head).
    const hp = head.getPosition(), tp = top?.getPosition() ?? hp.clone().add(new pc.Vec3(0, 0.2, 0));
    const r = hp.distance(tp) * 0.5;
    const mat = new pc.StandardMaterial();
    mat.diffuse = new pc.Color().fromString(look.headwearColor);
    mat.diffuseVertexColor = true;
    mat.gloss = 0.2;
    mat.useMetalness = true;
    mat.metalness = 0;
    mat.specularityFactor = 0.3;
    (mat as unknown as { ambientSH: Float32Array }).ambientSH = SH;
    mat.update();
    const holder = new pc.Entity("headwear");
    head.addChild(holder);
    const centre = new pc.Vec3().lerp(hp, tp, 0.55);
    holder.setPosition(centre);
    holder.setRotation(this.root.getRotation());
    const hs = head.getScale();
    holder.setLocalScale(r / hs.x, r / hs.y, r / hs.z);
    holder.addComponent("render", { meshInstances: [new pc.MeshInstance(capMeshFor(app.graphicsDevice), mat)], castShadows: true });
  }

  /** Place the person; yaw in radians (0 = facing +z). */
  place(x: number, y: number, z: number, yaw: number): void {
    this.root.setLocalPosition(x, y, z);
    this.root.setLocalEulerAngles(0, (yaw * 180) / Math.PI, 0);
    this.placed.x = x;
    this.placed.y = y;
    this.placed.z = z;
    this.placed.yaw = yaw;
  }

  /** Every model has a real seated loop now. */
  get hasSit(): boolean {
    return true;
  }

  /**
   * Requested ground speed. The gait is matched to the body's MEASURED
   * speed (what the feet actually cover), so a person pushed aside or slowed
   * by the crowd never moonwalks; this value only says "I mean to move".
   */
  gait(speed: number, _blend = 0.2): void {
    this.wanted = speed;
    if (this.held && speed > 0.15) this.act("stand");
  }

  /** Riders: seated on a vehicle (Root at the vehicle's origin). */
  ride(kind: "okada_ride" | "okada_pillion" | "keke_drive" | "keke_passenger" | "car_drive" | "car_passenger_idle" | "cycle_freewheel"): void {
    this.held = "sit";
    this.footIK = false;
    if (!this.anim.play(kind, { hold: true, blend: 0.1 })) ANIM.request(kind);
  }

  /** Riders on okadas and kekes (old API). */
  pose(name: "sit" | "idle"): void {
    if (name === "sit") this.act("sit");
    else this.act("stand");
  }

  /**
   * THE NAMED-CLIP INTERFACE for missions and cutscenes: play any clip id
   * from the packs (assets/anim/index.json, or docs/ANIM_INVENTORY.md), on
   * the full body or the upper body. Returns false while its pack loads (it
   * then plays as soon as it arrives).
   */
  play(clip: string, o: { upper?: boolean; hold?: boolean; then?: string; duration?: number; blend?: number; noRoot?: boolean; offset?: [number, number, number] } = {}): boolean {
    const go = () => (o.upper ? this.anim.upperPlay(clip, { duration: o.duration }) : this.anim.play(clip, { hold: o.hold, then: o.then, blend: o.blend, noRoot: o.noRoot, offset: o.offset }));
    if (go()) return true;
    void ANIM.ensure([clip, ...(o.then ? [o.then] : [])]).then(() => {
      if (this.alive) go();
    });
    return false;
  }

  /** The FORMAT.md `actor.anim` names (missions call this). */
  act(name: AnimName): void {
    const spec = ACT_CLIPS[name];
    switch (name) {
      case "stand":
      case "idle": {
        const was = this.held;
        this.held = null;
        this.anim.upperStop();
        this.anim.hands.w = 0;
        if (was === "sit") this.play("stand_up", { noRoot: true, blend: 0.2 });
        else this.anim.stopAction(0.35);
        return;
      }
      case "sit":
      case "sit_floor": {
        this.held = "sit";
        const seatY = name === "sit_floor" ? 0.06 : this.rig.seatHeight;
        // Hips over the seat: 0.2 m behind the root (the mission seat marks put the feet in front of the seat).
        const loop = ANIM.get(name === "sit" ? "sit_idle" : "sit_floor");
        const hs = this.anim.hipScale;
        const hy = loop ? loop.hips[1]! * hs : 0.55;
        const hz = loop ? loop.hips[2]! * hs : 0;
        const off: [number, number, number] = [0, Math.max(-0.2, Math.min(0.2, seatY + 0.09 - hy)), -0.2 - hz];
        if (name === "sit") this.play("sit_down", { then: "sit_idle", hold: true, noRoot: true, offset: off });
        else this.play("sit_floor", { hold: true, offset: [0, Math.max(-0.1, Math.min(0.1, seatY + 0.08 - hy)), 0] });
        return;
      }
      case "kneel":
      case "sleep":
        this.held = name;
        this.play(spec.clip, { then: spec.then, hold: true, noRoot: true });
        return;
      case "look":
        // The director turns the head (rig.lookAt); "look" itself plays nothing.
        return;
      case "fall":
        this.play("knock_down", { noRoot: false });
        return;
      case "hit":
        this.anim.bump([0, 0, -1], 3);
        this.play("flinch", { upper: true, duration: 1.2 });
        return;
      case "eat":
        this.play(this.held === "sit" ? "eat_seated" : "eat_stand", { upper: true, duration: spec.dur });
        return;
      case "phone":
      case "carry":
      case "hold_torch":
      case "oath":
        this.play(spec.clip, { upper: true });
        return;
      default:
        if (spec.layer === "upper" || this.held) this.play(spec.clip, { upper: true, duration: spec.dur });
        else this.play(spec.clip, { blend: 0.2 });
    }
  }

  /** Ground under a model-space point, relative to the person's root (foot IK on kerbs and steps). */
  private groundAt(x: number, z: number): number {
    if (!this.footIK) return 0;
    const s = this.root.getLocalScale().y || 1;
    const c = Math.cos(this.placed.yaw), sn = Math.sin(this.placed.yaw);
    const wx = this.placed.x + (x * c + z * sn) * s, wz = this.placed.z + (-x * sn + z * c) * s;
    return (surfaceHeight(wx, wz) - this.placed.y) / s;
  }

  /** Turn animation evaluation off for far-away people (they keep their last pose). */
  set animating(on: boolean) {
    this.animOn = on;
  }

  set visible(on: boolean) {
    this.root.enabled = on;
  }

  get visible(): boolean {
    return this.root.enabled;
  }

  /** Kept for callers that tick people themselves: the shared ticker does the work once per frame. */
  update(_dt: number): void {}

  /** Advance the animation and write the bones (called by the ticker). */
  tick(dt: number, lod: 0 | 1 | 2 | 3): void {
    const a = this.anim;
    // Measured motion (ground speed, turn rate, acceleration) from where the person was placed.
    if (dt > 0) this.sense.update(this.placed.x, this.placed.z, this.placed.yaw, dt, this.root.getLocalScale().y || 1);
    if (!this.driven) {
      const m = this.sense;
      a.input.speed = this.held ? 0 : m.speed < 0.08 && this.wanted < 0.1 ? 0 : m.speed;
      a.input.turnRate = m.turn;
      a.input.accel = m.accel;
    }
    // Rate by LOD: mid-distance people at 30 Hz, far at 10 Hz (plan §4.7).
    a.lod = lod;
    if (lod === 3 && this.lodShown >= 0) return;
    this.acc += dt;
    const step = lod === 2 ? 1 / 10 : lod === 1 ? 1 / 30 : 0;
    if (this.acc < step && this.lodShown >= 0) return;
    const adt = this.acc;
    this.acc = 0;
    this.rig.sync(adt);
    if (!this.driven) a.input.moved = this.sense.take();
    a.update(adt);
    this.applyPose();
    this.showLod(lod === 0 ? 0 : 1);
  }

  /**
   * Body shape (owner: characters can get fatter or slimmer over the game).
   * Weights 0..1 per morph, clamped to sane ranges; morph instances are made
   * only for people who differ from the default body.
   */
  setBody(b: BodyShape): void {
    const want: Record<string, number> = { heavy: clampN(b.heavy ?? DEFAULT_BODY.heavy!, 0, 1), lean: clampN(b.lean ?? DEFAULT_BODY.lean!, 0, 1), fit: clampN(b.fit ?? DEFAULT_BODY.fit!, 0, 1) };
    for (const mi of this.meshInstances) {
      const morph = mi.mesh?.morph;
      if (!morph) continue;
      if (!mi.morphInstance) mi.morphInstance = new pc.MorphInstance(morph);
      this.cm.kit.morphs.forEach((name, i) => mi.morphInstance!.setWeight(i, (want[name] ?? 0) - (DEFAULT_BODY[name] ?? 0)));
    }
  }

  /** Debug and approval shots: show the bind T-pose (no animation). */
  showBindPose(): void {
    this.forceLod = 3;
    this.anim.sk.restPose(this.anim.pose);
    this.applyPose();
    this.showLod(0);
  }

  private showLod(i: number): void {
    if (this.lods.length < 2 || i === this.lodShown) {
      this.lodShown = i;
      return;
    }
    this.lodShown = i;
    this.lods.forEach((e, k) => (e.enabled = k === i));
  }

  /** Bone rotations (and the hips' translation) onto the engine's nodes. */
  private applyPose(): void {
    const p = this.anim.pose, q = this.tmpQ;
    for (let b = 0; b < BONE_COUNT; b++) {
      const n = this.nodes[b];
      if (!n) continue;
      q.set(p.rot[b * 4]!, p.rot[b * 4 + 1]!, p.rot[b * 4 + 2]!, p.rot[b * 4 + 3]!);
      n.setLocalRotation(q);
    }
    const h = this.nodes[B.Hips];
    if (h) {
      const s = this.anim.hipScale;
      h.setLocalPosition(this.tmpV.set(p.hips[0]! * s, p.hips[1]! * s, p.hips[2]! * s));
    }
  }

  /** A bump from a world-space direction (someone brushed past). */
  bump(worldDir: V3, strength: number): void {
    const c = Math.cos(-this.placed.yaw), s = Math.sin(-this.placed.yaw);
    this.anim.bump([worldDir[0] * c + worldDir[2] * s, 0, -worldDir[0] * s + worldDir[2] * c], strength);
  }

  destroy(): void {
    this.alive = false;
    LIVE.delete(this);
    this.root.destroy();
  }
}

/**
 * The old rig API the missions and the director use (lookAt, headTurn,
 * pedal, seatHeight, play), mapped onto the Animator.
 */
export class PersonRig {
  /** Look-at target (world); null = none. */
  lookAt: pc.Vec3 | null = null;
  /** Fixed head turn (degrees). */
  headTurn = { yaw: 0, pitch: 0 };
  /** Pedalling (bicycle): phase in radians from distance travelled (rule A3); null when not riding. */
  pedal: { phase: number; seatY: number; crankY: number; crankZ: number; crankR: number; handZ: number; handY: number } | null = null;
  /** Seat height for "sit" (metres above the root). */
  seatHeight = 0.46;
  private inv = new pc.Mat4();
  private v = new pc.Vec3();
  private cycling = false;

  constructor(private p: Person) {}

  get gesture(): string | null {
    return this.p.anim.upperClip;
  }

  get bodyPose(): string | null {
    return this.p.held;
  }

  get busy(): boolean {
    return !!this.p.anim.upperClip || !!this.p.held;
  }

  /** Debug (castState): 1 while a held pose plays. */
  get debugPoseW(): number {
    return this.p.held ? 1 : 0;
  }

  play(g: GestureName | null): void {
    if (g === null) this.p.act("stand");
    else this.p.act(g as AnimName);
  }

  /** Per tick: world look target -> model space; pedals. */
  sync(_dt: number): void {
    const a = this.p.anim;
    if (this.lookAt) {
      this.inv.copy(this.p.root.getWorldTransform()).invert();
      this.inv.transformPoint(this.lookAt, this.v);
      a.lookTarget = [this.v.x, this.v.y, this.v.z];
    } else a.lookTarget = null;
    a.headTurn.yaw = this.headTurn.yaw;
    a.headTurn.pitch = this.headTurn.pitch;
    if (this.pedal) {
      const pd = this.pedal;
      a.pedals = { phase: pd.phase, y: pd.crankY, z: pd.crankZ, r: pd.crankR, x: 0.13 };
      a.hands = { L: [0.22, pd.handY + 0.02, pd.handZ - 0.03], R: [-0.22, pd.handY + 0.02, pd.handZ - 0.03], w: 1, grip: true };
      if (!this.cycling) {
        this.cycling = true;
        if (!ANIM.get("cycle")) ANIM.request("cycle");
        a.cycle(true);
      }
    } else if (this.cycling) {
      this.cycling = false;
      a.pedals = null;
      a.hands.w = 0;
      a.cycle(false);
    }
  }
}
