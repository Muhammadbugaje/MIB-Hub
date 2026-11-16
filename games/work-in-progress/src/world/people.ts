/**
 * People: skinned characters (CC0 Quaternius bases, packed by
 * tools/pack-character.ts into one mesh each), recoloured per person with a
 * tiny palette texture (skin, hair, clothes), plus hijabs and caps attached
 * to the head bone.
 *
 * Rules this follows (plan §1.2, §1.3):
 *  - one scale for every human (1.74 m), from the skeleton's measured rest height;
 *  - feet never slide: walk/run play rate = ground speed / the clip's measured
 *    stride speed (tools/pack-character.ts measures it from the planted foot);
 *  - blends between idle, walk and run take 0.2 s (no snapping);
 *  - skin and hair are never glossy (roughness >= 0.55).
 */
import * as pc from "playcanvas";
import { Builder, MeshData, type RGBA } from "../gfx/builder.ts";
import { SH } from "../gfx/materials.ts";
import type { Rng } from "../sim/rng.ts";
import { Rig, type GestureName } from "./rig.ts";

export const HUMAN_HEIGHT = 1.74;

export interface ModelInfo {
  file: string;
  clips: string[];
  slots: { name: string; color: number[] }[];
  height: number;
  footY: number;
  stride: Record<string, { speed: number; facing: number }>;
}

export interface CharModel {
  key: string;
  info: ModelInfo;
  container: pc.ContainerResource;
  tracks: Map<string, pc.AnimTrack>;
  female: boolean;
  scale: number;
  /** Ground speed (m/s at our scale) at which the clip's feet do not slide. */
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
export function slotRoles(info: ModelInfo): ("skin" | "skinDark" | "hair" | "brow" | "eye" | "detail" | number)[] {
  let cloth = 0;
  // The long-dress model's "Red" material is its hair (its bun), not cloth; "Brown" is the dress (checked in screenshots).
  const dressHair = info.file.startsWith("womandress");
  return info.slots.map((s) => {
    const n = s.name.toLowerCase();
    if (dressHair && n === "red") return "hair";
    if (n === "skin") return "skin";
    if (n.startsWith("skin")) return "skinDark";
    if (n.startsWith("hair")) return "hair";
    if (n.startsWith("eyebrow")) return "brow";
    if (n.startsWith("eye")) return "eye";
    if (n === "tietexture" || n === "details" || n === "earrings" || n === "gold") return "detail";
    return cloth++;
  });
}

export function clothingSlots(info: ModelInfo): number {
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
  return {
    model: m.key,
    skin: rng.pick(SKIN_TONES.slice(0, 9)),
    hair: rng.pick(HAIR),
    outfit,
    headwear: head,
    headwearColor: head === "cap" ? rng.pick(["#f4f1ea", "#2a5fa8", "#7a2e3b", "#2b2b2b", "#1f6b52"]) : rng.pick(CLOTH),
  };
}

/** The 16 x 1 palette texture for a look (one texel per material slot). */
export function paletteFor(device: pc.GraphicsDevice, model: CharModel, look: Look): pc.Texture {
  const roles = slotRoles(model.info);
  const data = new Uint8Array(16 * 4);
  const skin = hexToRgb(look.skin), hair = hexToRgb(look.hair);
  roles.forEach((r, i) => {
    let c: [number, number, number];
    if (r === "skin") c = skin;
    else if (r === "skinDark") c = [skin[0] * 0.85, skin[1] * 0.82, skin[2] * 0.8];
    else if (r === "hair" || r === "brow") c = hair;
    else if (r === "eye") c = [24, 20, 18];
    else if (r === "detail") c = model.info.slots[i]!.color.map((v) => Math.round(Math.pow(v, 1 / 2.2) * 255)) as [number, number, number];
    else c = hexToRgb(look.outfit[r] ?? "#888888");
    data.set([c[0], c[1], c[2], 255], i * 4);
  });
  const tex = new pc.Texture(device, {
    width: 16, height: 1, format: pc.PIXELFORMAT_SRGBA8, mipmaps: false,
    minFilter: pc.FILTER_NEAREST, magFilter: pc.FILTER_NEAREST, addressU: pc.ADDRESS_CLAMP_TO_EDGE, addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    levels: [data],
  });
  return tex;
}

export async function loadPeople(app: pc.AppBase, base: string, onProgress: (f: number) => void): Promise<CharModel[]> {
  const index = (await (await fetch(`${base}people/index.json`)).json()) as Record<string, ModelInfo>;
  const keys = Object.keys(index);
  let done = 0;
  const models = await Promise.all(
    keys.map(
      (key) =>
        new Promise<CharModel>((resolve, reject) => {
          app.assets.loadFromUrl(`${base}people/${index[key]!.file}`, "container", (err, asset) => {
            if (err || !asset) return reject(new Error(String(err)));
            const container = asset.resource as pc.ContainerResource;
            const tracks = new Map<string, pc.AnimTrack>();
            for (const a of container.animations) tracks.set(a.name.replace(/^.*\|/, ""), a.resource as pc.AnimTrack);
            const info = index[key]!;
            const scale = HUMAN_HEIGHT / info.height;
            onProgress(++done / keys.length);
            resolve({
              key, info, container, tracks, female: FEMALE_MODELS.includes(key), scale,
              walkSpeed: (info.stride.walk?.speed ?? 1.3) * scale,
              runSpeed: (info.stride.run?.speed ?? 3) * scale,
            });
          });
        }),
    ),
  );
  return models;
}

/* ------------------------------------------------------------ headwear */

let hijabMesh: pc.Mesh | null = null;
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

/** Hijab and cap meshes in "head units": the head is a unit-radius ball centred at the origin, face towards +z. */
function headwearMeshes(device: pc.GraphicsDevice): { hijab: pc.Mesh; cap: pc.Mesh } {
  if (!hijabMesh) {
    const W: RGBA = [255, 255, 255, 255];
    hijabMesh = meshFrom(device, (b) => {
      b.tint(W);
      // Head covering: a slightly enlarged ball, open at the face (the face is covered by a skin-coloured head anyway).
      b.blob("x", [0, 0.08, -0.08], 1.18, 3, W, [215, 215, 215, 255], 1.05, 14, 9, 0.02);
      // The drape over the shoulders and chest: a wide flared cone below the chin.
      b.cylinder("x", 0, -1.85, -0.05, 1.75, 1.0, 1.15, 16, false, true);
    });
    capMesh = meshFrom(device, (b) => {
      b.tint(W);
      b.cylinder("x", 0, 0.32, 0, 1.06, 1.0, 0.62, 16, true, true);
    });
  }
  return { hijab: hijabMesh, cap: capMesh! };
}

/* ---------------------------------------------------------------- person */

/** Clips that play once and then return to the body's state (idle, walk...). */
const ONE_SHOT = new Set(["wave", "interact", "hit", "punch", "fall", "jump", "stand", "clap"]);

/** The FORMAT.md `actor.anim` names. */
export type AnimName =
  | "sit" | "stand" | "hug" | "wave" | "phone" | "eat" | "look" | "gesture" | "laugh" | "shock" | "point" | "nod" | "shake_head"
  | "carry" | "write" | "kneel" | "sleep" | "cheer" | "facepalm" | "horns" | "clap" | "hold_torch" | "oath" | "punch" | "fall" | "hit" | "idle" | "talk" | "sit_floor";

/** Names the missions use that have no real clip yet on any model (procedural fallback today). */
export const ANIM_FALLBACKS: AnimName[] = ["point", "phone", "write", "eat", "hug", "nod", "shake_head", "gesture", "talk", "shock", "laugh", "facepalm", "cheer", "carry", "kneel", "sleep", "hold_torch", "oath", "horns"];

export class Person {
  readonly root: pc.Entity;
  private model: pc.Entity;
  private anim: pc.AnimComponent;
  private state = "idle";
  readonly cm: CharModel;
  readonly rig: Rig;
  material: pc.StandardMaterial;
  /** A one-shot clip in progress: seconds left. */
  private shotLeft = 0;
  /** Held pose (sit, kneel...) that walking must not cancel. */
  held: AnimName | null = null;
  private moving = 0;

  constructor(app: pc.AppBase, cm: CharModel, look: Look, parent: pc.Entity, opts: { shadows?: boolean } = {}) {
    this.cm = cm;
    this.root = new pc.Entity("person");
    this.model = cm.container.instantiateRenderEntity();
    this.model.setLocalScale(cm.scale, cm.scale, cm.scale);
    this.model.setLocalPosition(0, 0, 0);
    this.root.addChild(this.model);
    parent.addChild(this.root);

    const mat = new pc.StandardMaterial();
    mat.useMetalness = true;
    mat.metalness = 0;
    mat.gloss = 0.32; // roughness 0.68: never glossy (rule C2)
    mat.specularityFactor = 0.35;
    mat.diffuseMap = paletteFor(app.graphicsDevice, cm, look);
    (mat as unknown as { ambientSH: Float32Array }).ambientSH = SH;
    mat.update();
    this.material = mat;
    for (const r of this.model.findComponents("render") as pc.RenderComponent[]) {
      for (const mi of r.meshInstances) mi.material = mat;
      r.castShadows = opts.shadows ?? true;
      r.receiveShadows = true;
    }

    this.model.addComponent("anim", { activate: true });
    this.anim = this.model.anim!;
    for (const [name, t] of cm.tracks) this.anim.assignAnimation(name, t, undefined, 1, !ONE_SHOT.has(name));
    this.anim.baseLayer?.transition("idle", 0);
    this.rig = new Rig(this.root, this.model, cm.scale);

    if (look.headwear !== "none") this.addHeadwear(app, look);
  }

  private addHeadwear(app: pc.AppBase, look: Look): void {
    const head = this.model.findByName("Head");
    const top = this.model.findByName("Head_end");
    if (!head || !top) return;
    const meshes = headwearMeshes(app.graphicsDevice);
    const mat = new pc.StandardMaterial();
    mat.diffuse = new pc.Color().fromString(look.headwearColor);
    mat.diffuseVertexColor = true;
    mat.gloss = 0.2;
    mat.useMetalness = true;
    mat.metalness = 0;
    mat.specularityFactor = 0.3;
    (mat as unknown as { ambientSH: Float32Array }).ambientSH = SH;
    mat.update();
    // Size from the skeleton: head bone to the top of the head.
    this.root.syncHierarchy();
    const hp = head.getPosition(), tp = top.getPosition();
    const headLen = hp.distance(tp);
    const r = headLen * 0.5;
    const holder = new pc.Entity("headwear");
    head.addChild(holder);
    // Place in world space relative to the person, then the bone carries it.
    const centre = new pc.Vec3().lerp(hp, tp, 0.55);
    const fwd = new pc.Vec3();
    this.root.getWorldTransform().transformVector(pc.Vec3.FORWARD, fwd).mulScalar(-1); // +z of the root
    centre.add(fwd.clone().mulScalar(-r * 0.12));
    holder.setPosition(centre);
    holder.setRotation(this.root.getRotation());
    const hs = head.getScale();
    holder.setLocalScale(r / hs.x, r / hs.y, r / hs.z);
    holder.addComponent("render", { meshInstances: [new pc.MeshInstance(look.headwear === "hijab" ? meshes.hijab : meshes.cap, mat)], castShadows: true });
  }

  /** Place the person; yaw in radians (0 = facing +z). */
  place(x: number, y: number, z: number, yaw: number): void {
    this.root.setLocalPosition(x, y, z);
    this.root.setLocalEulerAngles(0, (yaw * 180) / Math.PI, 0);
  }

  /** Models whose sit clip reads as sitting on a chair (the "man" base's clip does not, so it uses the rig pose). */
  get hasSit(): boolean {
    return this.cm.tracks.has("sit") && this.cm.key !== "man";
  }

  private go(state: string, blend: number): void {
    if (state !== this.state && this.anim.baseLayer && (this.cm.tracks.has(state) || state === "idle")) {
      this.anim.baseLayer.transition(state, blend);
      this.state = state;
    }
  }

  /** Pick idle / walk / run from the ground speed and set the play rate so feet do not slide. */
  gait(speed: number, blend = 0.2): void {
    this.moving = speed;
    if (this.shotLeft > 0) return;
    // Walking off releases a held pose (sitting people stand up first).
    if (this.held && speed > 0.15) this.act("stand");
    if (this.held) return;
    const cm = this.cm;
    let want = "idle";
    if (speed > 0.15) want = speed > (cm.walkSpeed + cm.runSpeed) / 2 ? "run" : "walk";
    this.go(want, blend);
    this.anim.speed = want === "walk" ? speed / cm.walkSpeed : want === "run" ? speed / cm.runSpeed : 1;
  }

  /** Riders on okadas and kekes: the sit clip (straddling), or the rig's seated pose for rigs without one. */
  pose(name: "sit" | "idle"): void {
    if (name === "sit" && this.cm.tracks.has("sit")) {
      this.held = "sit";
      this.go("sit", 0.3);
      return;
    }
    if (name === "sit") this.act("sit");
    else this.act("stand");
  }

  /**
   * THE ANIMATION INTERFACE for missions and cutscenes. Play a FORMAT.md
   * `actor.anim` by name: a real clip where the model has one (wave, clap,
   * sit, punch...), otherwise the procedural fallback on the rig layer
   * (point, phone, nod, talk...). When the animation engine brings real
   * clips for more names, they drop in here (`has(name)` picks the clip)
   * and no mission changes. ANIM_FALLBACKS lists which names are procedural today.
   */
  act(name: AnimName): void {
    const has = (c: string) => this.cm.tracks.has(c);
    this.anim.speed = 1;
    switch (name) {
      case "sit":
      case "sit_floor":
        // Story sitting uses the rig pose for every model, so a seat mark means the same thing for everyone:
        // the root (feet) stands just in front of the seat, the hips go back over it.
        this.held = "sit";
        this.rig.seatHeight = name === "sit_floor" ? 0.06 : 0.46;
        this.go("idle", 0.3);
        this.rig.play("sit");
        return;
      case "kneel":
      case "sleep":
      case "carry":
      case "phone":
      case "hold_torch":
      case "oath":
        if (name === "kneel" || name === "sleep") this.held = name;
        this.go("idle", 0.25);
        this.rig.play(name);
        return;
      case "stand":
      case "idle":
        if (this.held || this.rig.gesture || this.rig.bodyPose) {
          this.held = null;
          this.rig.play(null);
          this.go(this.moving > 0.15 ? "walk" : "idle", 0.35);
        }
        return;
      case "wave":
      case "clap":
      case "punch":
      case "fall":
      case "hit":
        if (has(name)) return this.oneShot(name);
        if (name === "hit" && has("interact")) return this.oneShot("interact");
        this.rig.play(name === "fall" || name === "hit" ? "shock" : name === "punch" ? "gesture" : name);
        return;
      case "shock":
        if (has("hit")) return this.oneShot("hit");
        this.rig.play("shock");
        return;
      case "horns":
        this.rig.play("cheer");
        return;
      case "talk":
        this.rig.play("gesture");
        return;
      case "look":
        return;
      default:
        this.rig.play(name as GestureName);
    }
  }

  private oneShot(clip: string): void {
    const t = this.cm.tracks.get(clip);
    if (!t || !this.anim.baseLayer) return;
    this.anim.baseLayer.transition(clip, 0.15);
    this.state = clip;
    this.shotLeft = Math.max(0.4, t.duration - 0.12);
  }

  /** Per-frame: one-shot clips return to the body's state; the rig layer applies poses after the clips. */
  update(dt: number): void {
    if (this.shotLeft > 0) {
      this.shotLeft -= dt;
      if (this.shotLeft <= 0) {
        this.state = "";
        if (this.held === "sit" && !this.rig.bodyPose && this.cm.tracks.has("sit")) this.go("sit", 0.25);
        else this.go(this.moving > 0.15 ? "walk" : "idle", 0.25);
      }
    }
    if (this.anim.enabled && this.root.enabled) this.rig.update(dt);
  }

  /** Turn animation evaluation off for far-away people (they keep their last pose). */
  set animating(on: boolean) {
    this.anim.enabled = on;
  }

  set visible(on: boolean) {
    this.root.enabled = on;
  }

  get visible(): boolean {
    return this.root.enabled;
  }

  destroy(): void {
    this.root.destroy();
  }
}
