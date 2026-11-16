/**
 * The Cutscene Director: plays the ```cutscene blocks of docs/plan/missions/Y1.md
 * exactly as written, in the engine (plan: in-engine, data-driven, skippable,
 * skip equals watch).
 *
 * Input: a parsed block (src/story/parse.ts) plus its staging (where it happens,
 * where each actor stands, the camera anchors the block names, walk routes and
 * any look-reactive extra lines). Every FORMAT.md timeline key is handled:
 *
 *   camera.cut / move / follow / return / shake      say (subtitles + voice by line id)
 *   actor.walk / run / anim / look / show / hide / ride / enter / exit
 *   sfx.play, music.play / stop, light.set, prop.show / hide / move, fx.play,
 *   title.card, calendar.show, and `if: special.x` then/else branches.
 *
 * Shots frame by type (wide, medium, close, over_shoulder, pov, top). A shot's
 * `from` is an anchor (a named camera spot) or an actor (over the shoulder,
 * point of view); `look` is an anchor, an actor or a prop. Cameras never end up
 * inside walls or under the floor. Actors walk with the same no-overlap rule as
 * gameplay: they keep a personal radius from each other and step round.
 *
 * Skipping (Esc, Enter, Space, a tap, the Skip button) runs every remaining
 * entry's end state and puts everyone where the block's endState says, so a
 * skipped scene ends exactly where a watched one does (plan rule A8).
 */
import * as pc from "playcanvas";
import { ease } from "../sim/motion.ts";
import { makePath, sample, type P2, type Path } from "../sim/path.ts";
import type { FlowMap, StoryCutscene, TimelineEntry } from "../story/parse.ts";
import type { AnimName, Person } from "../world/people.ts";

export type A3 = [number, number, number];

/** Who the player is, for branches and token lines. */
export interface PlayerCtx {
  name: string;
  female: boolean;
  /** Colour name of the top, e.g. "blue" (for lines that react to the outfit). */
  topColour: string;
  headwear: "none" | "hijab" | "cap";
  headColour: string;
  roomie: string;
  specials: { jiya: boolean; taty: boolean; madison: boolean };
}

/** A camera anchor: a position, optionally a second position for camera.move, and a field of view. */
export interface CamAnchor { pos: A3; to?: A3; fov?: number }

export interface ActorPlace {
  /** Anchor name or position. */
  at: string | A3;
  /** Facing in radians, or an anchor/role to face. */
  face?: number | string;
  /** A pose to hold from the start (sit, kneel, phone...). */
  anim?: AnimName;
  hidden?: boolean;
}

/** One extra timeline entry (look-reactive lines, small acting beats), merged into the block. */
export interface ExtraEntry { at: number; key: string; args: FlowMap; cond?: string | null; branch?: "then" | "else" | null }

export interface CutStage {
  /** "world" for the map, else an interior id (anchors are then local to that room). */
  where: string;
  /** Hour of day to show (unless a light.set says otherwise). */
  hour?: number;
  actors: Record<string, ActorPlace>;
  anchors?: Record<string, A3 | CamAnchor>;
  /** Routes for actor.walk / run / ride, keyed "ROLE>target" or just the target name. */
  routes?: Record<string, A3[]>;
  extra?: ExtraEntry[];
  /** Text variants by line id (the player's look and sex change the words; the id gains a suffix). */
  variants?: Record<string, (c: PlayerCtx) => { id: string; text: string } | null>;
  /** Where the player stands afterwards (overrides the block's endState PLAYER.at), with facing. */
  end?: { at: string | A3; face?: number };
  /** Extras: a crowd for this scene (count, area, facing, pose). */
  crowd?: { n: number; x: number; z: number; hx: number; hz: number; face: number; anim?: AnimName; rows?: boolean; where?: string }[];
  /** Names the block uses that live elsewhere: "room_door" -> "hostel:room_door_cam", "CROWD" -> "lawn_crowd". */
  aliases?: Record<string, string>;
}

/** Vehicle names in blocks -> the role that plays them. */
const VEHICLE_ALIAS: Record<string, string> = { family_car: "CAR", keke: "KEKE", bicycle: "BIKE" };

/** What the director needs from the game world. */
export interface StageWorld {
  cam: pc.Entity;
  /** Anchor lookup on the map (campus, gate...) or in an interior (local -> world). */
  anchor(name: string, where: string): A3 | CamAnchor | null;
  /** The actor for a role (cast id resolved by the world); null for absent optional roles. */
  actor(role: string, castId: string): StageActor | null;
  /** World height of the walkable surface. */
  ground(x: number, z: number): number;
  /** Camera must not be inside solid things. Returns a corrected position. */
  clearCam(p: pc.Vec3): pc.Vec3;
  /** A point to look at for a prop id (prop.note...). */
  prop(id: string, where: string): A3 | null;
  showProp(id: string, at: A3 | null, show: boolean): void;
  light(preset: string): void;
  fx(id: string, at: A3 | null): void;
  sfx(cue: string): void;
  music(cue: string | null, duck: boolean): void;
  say(line: { id: string; castId: string; role: string; text: string; mood: string }): void;
  /** Speaker name for subtitles. */
  speakerName(role: string, castId: string): string;
  ui: DirectorUi;
  /** The gameplay camera's position and look-at (for camera.return blends). */
  gameplayCam(): { pos: A3; look: A3 };
  crowd(spec: NonNullable<CutStage["crowd"]>, where: string): void;
  clearCrowd(): void;
  /** Plan a walk through these marks on the navigation grid (round walls, furniture, trees). Absent: straight lines. */
  navRoute?(pts: P2[]): P2[];
  /** True when a body of radius r at (x, z) would overlap something solid (side-steps never go into walls). */
  blocked?(x: number, z: number, r: number): boolean;
}

export interface DirectorUi {
  letterbox(on: boolean): void;
  subtitle(who: string | null, text: string): void;
  fade(alpha: number): void;
  skipButton(on: boolean, onSkip: () => void): void;
  titleCard(text: string | null): void;
  calendar(text: string | null): void;
}

export interface StageActor {
  kind: "person" | "goat" | "vehicle" | "prop";
  ent: pc.Entity;
  person?: Person;
  /** Collision radius for the no-overlap rule (people 0.3, the goat 0.35, vehicles none). */
  radius: number;
  /** Called with the actor's speed each frame (gait, legs, wheels). */
  animate?(dt: number, speed: number): void;
}

const SHOT_FOV: Record<string, number> = { wide: 52, medium: 40, close: 30, over_shoulder: 40, pov: 58, top: 50 };

interface Live {
  role: string;
  a: StageActor;
  x: number;
  z: number;
  yaw: number;
  path: Path | null;
  s: number;
  speed: number;
  face: string | number | null;
  /** Height above the ground (the goat on the suya table). */
  lift: number;
  liftTo: number;
}

interface CamShot { kind: string; shot: string; from: string; look: string; dur: number; at: number }

export class Director {
  t = 0;
  done = false;
  private entries: TimelineEntry[] = [];
  private idx = 0;
  private live = new Map<string, Live>();
  private shot: CamShot | null = null;
  private retStart = -1;
  private retDur = 1;
  private retFrom = { pos: new pc.Vec3(), look: new pc.Vec3() };
  private shake = { amt: 0, until: 0 };
  private subUntil = 0;
  private fadeA = 0;
  private fadeTo = 0;
  private fadeRate = 0;
  private duration: number;
  private camPos = new pc.Vec3();
  private camLook = new pc.Vec3();
  private tmp = new pc.Vec3();
  private shotBase: { pos: A3; to: A3 | null; fov: number } | null = null;
  private povHidden: Live | null = null;

  constructor(
    readonly cut: StoryCutscene,
    readonly stage: CutStage,
    private world: StageWorld,
    private ctx: PlayerCtx,
    private onEnd: (endState: FlowMap, playerAt: A3 | null, face: number | null) => void,
    opts: { fadeIn?: boolean } = {},
  ) {
    // Merge the block with the staging's extra entries, keep the right branch of every `if:`.
    const all: TimelineEntry[] = [...cut.timeline, ...(stage.extra ?? []).map((e, i) => ({ at: e.at, key: e.key, args: e.args, cond: e.cond ?? null, branch: e.branch ?? null, line: -1 - i }))];
    this.entries = all.filter((e) => this.allowed(e)).sort((a, b) => a.at - b.at || (a.key.startsWith("camera") ? -1 : 1));
    const lastAt = Math.max(0, ...this.entries.map((e) => e.at + (e.key === "say" ? 2.8 : e.key.startsWith("camera") ? Math.min(Number(e.args.dur ?? e.args.blend ?? 1), 4) : 0.5)));
    this.duration = Math.min(cut.maxDuration, lastAt + 0.4);
    // Place the cast.
    for (const [role, place] of Object.entries(stage.actors)) {
      const castId = role === "PLAYER" ? "player" : cut.cast[role] ?? stage.actors[role] ? cut.cast[role] ?? role.toLowerCase() : role.toLowerCase();
      if (cut.optional.includes(role) && !this.specialOn(cut.cast[role] ?? "")) continue;
      const a = world.actor(role, castId);
      if (!a) continue;
      const p = this.pos(place.at);
      const l: Live = { role, a, x: p[0], z: p[2], yaw: 0, path: null, s: 0, speed: 0, face: place.face ?? null, lift: 0, liftTo: 0 };
      l.yaw = this.faceYaw(l, place.face);
      a.ent.enabled = !place.hidden;
      this.setTransform(l);
      a.person?.act(place.anim ?? "stand");
      if (place.anim) a.person?.act(place.anim);
      this.live.set(role, l);
    }
    for (const c of stage.crowd ?? []) world.crowd([c], stage.where);
    world.ui.letterbox(true);
    world.ui.skipButton(cut.skippable, () => this.skip());
    if (opts.fadeIn) {
      this.fadeA = 1;
      this.fadeTo = 0;
      this.fadeRate = 1 / 0.6;
    }
    if (stage.hour !== undefined) world.light(`hour:${stage.hour}`);
  }

  private specialOn(castId: string): boolean {
    const n = castId.replace("special.", "") as keyof PlayerCtx["specials"];
    return !!this.ctx.specials[n];
  }

  private allowed(e: TimelineEntry): boolean {
    if (!e.cond) return true;
    const on = e.cond.startsWith("special.") ? this.specialOn(e.cond) : e.cond === "player.female" ? this.ctx.female : e.cond === "player.male" ? !this.ctx.female : false;
    return e.branch === "else" ? !on : on;
  }

  /* ------------------------------------------------------------ resolving names */

  private anchorRaw(name: string): A3 | CamAnchor | null {
    const alias = this.stage.aliases?.[name];
    if (alias && alias !== name) name = alias;
    const local = this.stage.anchors?.[name];
    if (local) return this.toWorld(local);
    const k = name.indexOf(":");
    if (k > 0) return this.world.anchor(name.slice(k + 1), name.slice(0, k));
    return this.world.anchor(name, this.stage.where);
  }

  /** Stage-local anchors in an interior are in the room's frame; the world turns them into map positions. */
  private toWorld(a: A3 | CamAnchor): A3 | CamAnchor {
    if (this.stage.where === "world") return a;
    const conv = (p: A3): A3 => {
      const o = this.world.anchor("__origin", this.stage.where) as A3 | null;
      return o ? [p[0] + o[0], p[1], p[2] + o[2]] : p;
    };
    if (Array.isArray(a)) return conv(a);
    return { pos: conv(a.pos), to: a.to ? conv(a.to) : undefined, fov: a.fov };
  }

  /** A position for a name: an anchor, a live actor (its feet), a prop; fallback the origin of the stage. */
  pos(at: string | A3): A3 {
    if (Array.isArray(at)) return (this.stage.where === "world" ? at : (this.toWorld(at) as A3));
    const live = this.live.get(at) ?? this.live.get(VEHICLE_ALIAS[at] ?? "");
    if (live) return [live.x, this.world.ground(live.x, live.z), live.z];
    const an = this.anchorRaw(at);
    if (an) return Array.isArray(an) ? an : an.pos;
    const pr = this.world.prop(at, this.stage.where);
    if (pr) return pr;
    console.warn(`cutscene ${this.cut.id}: no anchor "${at}"`);
    const o = this.world.anchor("__origin", this.stage.where) as A3 | null;
    return o ?? [0, 0, 0];
  }

  /** A point to look at: an actor's head (or a goat's), an anchor, a prop. */
  private lookPoint(name: string, out: pc.Vec3): pc.Vec3 {
    const live = this.live.get(name) ?? this.live.get(VEHICLE_ALIAS[name] ?? "");
    if (live) {
      const e = live.a.ent.getPosition();
      const h = live.a.kind === "person" ? (live.a.person?.held === "sit" ? 1.12 : 1.55) : live.a.kind === "goat" ? 0.8 : 1.0;
      return out.set(e.x, e.y + h, e.z);
    }
    const p = this.pos(name);
    return out.set(p[0], p[1] || this.world.ground(p[0], p[2]) + 1.0, p[2]);
  }

  private faceYaw(l: Live, face: number | string | null | undefined): number {
    if (typeof face === "number") return face;
    if (typeof face === "string") {
      const p = this.pos(face);
      return Math.atan2(p[0] - l.x, p[2] - l.z);
    }
    return l.yaw;
  }

  private setTransform(l: Live): void {
    const y = this.world.ground(l.x, l.z) + l.lift;
    if (l.a.person) l.a.person.place(l.x, y, l.z, l.yaw);
    else {
      l.a.ent.setPosition(l.x, y, l.z);
      l.a.ent.setEulerAngles(0, (l.yaw * 180) / Math.PI, 0);
    }
  }

  /* ------------------------------------------------------------ the timeline */

  private run(e: TimelineEntry): void {
    const A = e.args;
    const str = (k: string) => (A[k] === undefined ? "" : String(A[k]));
    switch (e.key) {
      case "camera.cut":
      case "camera.move":
      case "camera.follow": {
        this.retStart = -1;
        this.shot = { kind: e.key, shot: str("shot") || "medium", from: str("from") || str("who"), look: str("look") || str("who"), dur: Number(A.dur ?? 4), at: this.t };
        this.shotBase = null;
        break;
      }
      case "camera.return":
        this.retStart = this.t;
        this.retDur = Number(A.blend ?? 1);
        this.retFrom.pos.copy(this.world.cam.getPosition());
        this.retFrom.look.copy(this.camLook);
        break;
      case "camera.shake":
        this.shake = { amt: Number(A.amt ?? 0.3), until: this.t + Number(A.dur ?? 0.5) };
        break;
      case "say": {
        const role = str("who");
        const castId = role === "PLAYER" ? "player" : this.cut.cast[role] ?? role.toLowerCase();
        let id = str("id"), text = str("text");
        const v = this.stage.variants?.[id]?.(this.ctx);
        if (v) {
          id = v.id;
          text = v.text;
        }
        text = fillPlayer(text, this.ctx);
        this.world.say({ id, castId, role, text, mood: str("mood") || "neutral" });
        this.world.ui.subtitle(this.world.speakerName(role, castId), text);
        this.subUntil = this.t + Math.max(2.4, Math.min(6.5, 1 + text.split(/\s+/).length * 0.36));
        // The speaker looks at whoever the camera is looking at, unless they are the subject.
        break;
      }
      case "actor.walk":
      case "actor.run": {
        const l = this.live.get(str("who"));
        if (!l) break;
        const toRaw = A.to as unknown;
        const to = Array.isArray(toRaw) ? "" : str("to");
        const route = to ? this.stage.routes?.[`${l.role}>${to}`] ?? this.stage.routes?.[to] : undefined;
        const pts: P2[] = [[l.x, l.z]];
        for (const p of route ?? []) {
          const w = this.pos(p);
          pts.push([w[0], w[2]]);
        }
        const end = Array.isArray(toRaw) ? this.pos(toRaw as A3) : this.pos(to);
        pts.push([end[0], end[2]]);
        // People and the goat walk real paths (never through a wall); vehicles keep their road lines.
        l.path = makePath(this.world.navRoute && (l.a.kind === "person" || l.a.kind === "goat") ? this.world.navRoute(pts) : pts);
        l.s = 0;
        l.liftTo = l.a.kind === "goat" && end[1] > 0.2 ? end[1] : 0;
        l.speed = e.key === "actor.run" ? (l.a.kind === "goat" ? 5.2 : 5.0) : 2.0;
        l.a.person?.act("stand");
        break;
      }
      case "actor.ride": {
        // A rider in a vehicle: the vehicle actor (named in `vehicle`) drives to `to`; the rider is inside it.
        const veh = this.live.get(roleOfVehicle(str("vehicle")));
        if (!veh) break;
        const route = this.stage.routes?.[str("to")];
        const pts: P2[] = [[veh.x, veh.z], ...(route ?? []).map((p) => { const w = this.pos(p); return [w[0], w[2]] as P2; })];
        const end = this.pos(str("to"));
        pts.push([end[0], end[2]]);
        veh.path = makePath(pts);
        veh.s = 0;
        veh.speed = 5.5;
        break;
      }
      case "actor.place": {
        const l = this.live.get(str("who"));
        if (!l) break;
        const at = A.at;
        const p = typeof at === "string" ? this.pos(at) : this.pos(at as unknown as A3);
        l.x = p[0];
        l.z = p[2];
        l.path = null;
        if (A.face !== undefined) l.yaw = typeof A.face === "number" ? A.face : this.faceYaw(l, String(A.face));
        l.face = null;
        this.setTransform(l);
        break;
      }
      case "actor.anim": {
        const l = this.live.get(str("who"));
        if (l?.a.person) l.a.person.act(str("anim") as AnimName);
        else if (str("who") === "CROWD") this.world.fx(`crowd:${str("anim")}`, null);
        break;
      }
      case "actor.look": {
        const l = this.live.get(str("who"));
        if (!l) break;
        const p = this.lookPoint(str("at"), new pc.Vec3());
        if (l.a.person) {
          l.a.person.rig.lookAt = p.clone();
          // Turn the body most of the way too when the target is behind.
          const want = Math.atan2(p.x - l.x, p.z - l.z);
          let d = want - l.yaw;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          if (Math.abs(d) > 1.2) l.face = want;
        } else if (l.a.kind === "goat") {
          l.face = Math.atan2(p.x - l.x, p.z - l.z);
          this.world.fx("goat_look", null);
        }
        break;
      }
      case "actor.show":
      case "actor.hide": {
        const l = this.live.get(str("who"));
        if (l) l.a.ent.enabled = e.key === "actor.show";
        break;
      }
      case "actor.enter":
      case "actor.exit": {
        const l = this.live.get(str("who"));
        if (l) l.a.ent.enabled = e.key === "actor.exit";
        break;
      }
      case "sfx.play":
        this.world.sfx(str("cue"));
        break;
      case "music.play":
        this.world.music(str("cue"), !!A.duck);
        break;
      case "music.stop":
        this.world.music(null, false);
        break;
      case "light.set":
        this.world.light(str("preset"));
        break;
      case "prop.show":
      case "prop.hide":
      case "prop.move": {
        const at = str("at") ? this.pos(str("at")) : null;
        this.world.showProp(str("id"), at, e.key !== "prop.hide");
        break;
      }
      case "fx.play":
        this.world.fx(str("id"), str("at") ? this.pos(str("at")) : null);
        break;
      case "title.card":
        this.world.ui.titleCard(fillPlayer(str("text"), this.ctx));
        setTimeoutSafe(() => this.world.ui.titleCard(null), 3800);
        break;
      case "calendar.show":
        this.world.ui.calendar(str("text"));
        setTimeoutSafe(() => this.world.ui.calendar(null), 4200);
        break;
    }
  }

  /* ------------------------------------------------------------ the camera */

  private resolveShot(s: CamShot): { pos: A3; to: A3 | null; fov: number } {
    const fov = SHOT_FOV[s.shot] ?? 42;
    const look = this.lookPoint(s.look, new pc.Vec3());
    const actor = this.live.get(s.from);
    if (actor && (s.shot === "pov" || s.shot === "over_shoulder" || s.kind === "camera.follow")) return { pos: [0, 0, 0], to: null, fov };
    const an = this.anchorRaw(s.from);
    if (an) {
      if (Array.isArray(an)) {
        const to = s.kind === "camera.move" ? pushIn(an, look, s.shot === "wide" ? 0.22 : 0.12) : pushIn(an, look, 0.04);
        return { pos: an, to, fov };
      }
      return { pos: an.pos, to: an.to ?? (s.kind === "camera.move" ? pushIn(an.pos, look, 0.2) : null), fov: an.fov ?? fov };
    }
    // No anchor of that name: frame the look target by shot type (logged, never a broken camera).
    console.warn(`cutscene ${this.cut.id}: camera anchor "${s.from}" not staged; framing by shot type`);
    const dist = s.shot === "wide" ? 12 : s.shot === "close" ? 1.8 : 3.4;
    return { pos: [look.x + dist * 0.7, look.y + (s.shot === "wide" ? 4 : 0.1), look.z + dist * 0.7], to: null, fov };
  }

  private updateCamera(dt: number): void {
    const cam = this.world.cam;
    if (this.retStart >= 0) {
      const k = ease.inOut(Math.min(1, (this.t - this.retStart) / Math.max(0.05, this.retDur)));
      const g = this.world.gameplayCam();
      this.camPos.lerp(this.retFrom.pos, new pc.Vec3(g.pos[0], g.pos[1], g.pos[2]), k);
      this.camLook.lerp(this.retFrom.look, new pc.Vec3(g.look[0], g.look[1], g.look[2]), k);
    } else if (this.shot) {
      const s = this.shot;
      const k = Math.min(1, (this.t - s.at) / Math.max(0.05, s.dur));
      this.lookPoint(s.look, this.camLook);
      const actor = this.live.get(s.from);
      if (actor && (s.shot === "pov" || s.shot === "over_shoulder" || s.kind === "camera.follow")) {
        const e = actor.a.ent.getPosition();
        const f = new pc.Vec3(Math.sin(actor.yaw), 0, Math.cos(actor.yaw));
        const r = new pc.Vec3(-f.z, 0, f.x);
        const head = actor.a.person?.held === "sit" ? 1.15 : 1.58;
        if (s.shot === "pov") {
          this.camPos.set(e.x + f.x * 0.12, e.y + head, e.z + f.z * 0.12);
          if (actor.a.ent.enabled) {
            actor.a.ent.enabled = false;
            this.povHidden = actor;
          }
        } else if (s.kind === "camera.follow") {
          this.camPos.set(e.x - f.x * 3.4 + r.x * 1.3, e.y + 1.9, e.z - f.z * 3.4 + r.z * 1.3);
          this.camLook.set(e.x, e.y + 1.3, e.z);
        } else {
          // Over the shoulder: behind and to the right of the actor, looking past them.
          const dir = new pc.Vec3().sub2(this.camLook, new pc.Vec3(e.x, e.y + head, e.z));
          dir.y = 0;
          if (dir.lengthSq() < 1e-4) dir.copy(f);
          dir.normalize();
          const right = new pc.Vec3(-dir.z, 0, dir.x);
          this.camPos.set(e.x - dir.x * 0.95 - right.x * 0.42, e.y + head + 0.12, e.z - dir.z * 0.95 - right.z * 0.42);
        }
        if (cam.camera) cam.camera.fov = SHOT_FOV[s.shot] ?? 42;
      } else {
        if (!this.shotBase) this.shotBase = this.resolveShot(s);
        const b = this.shotBase;
        const kk = s.kind === "camera.move" ? ease.sine(k) : ease.out(k);
        const to = b.to ?? b.pos;
        this.camPos.set(b.pos[0] + (to[0] - b.pos[0]) * kk, b.pos[1] + (to[1] - b.pos[1]) * kk, b.pos[2] + (to[2] - b.pos[2]) * kk);
        if (cam.camera) cam.camera.fov = b.fov;
      }
    }
    if (this.t < this.shake.until) {
      const a = this.shake.amt * 0.08;
      this.camPos.add(this.tmp.set((Math.random() - 0.5) * a, (Math.random() - 0.5) * a, (Math.random() - 0.5) * a));
    }
    // Never inside walls or under the floor.
    this.world.clearCam(this.camPos);
    cam.setPosition(this.camPos);
    cam.lookAt(this.camLook);
    // Re-show a pov actor once the pov shot ends.
    if (this.povHidden && (!this.shot || this.shot.shot !== "pov" || this.retStart >= 0)) {
      this.povHidden.a.ent.enabled = true;
      this.povHidden = null;
    }
    void dt;
  }

  /* ------------------------------------------------------------ actors */

  private moveActors(dt: number): void {
    for (const l of this.live.values()) {
      if (l.path) {
        const remaining = l.path.length - l.s;
        const v = Math.min(l.speed, Math.max(0.5, remaining * 1.5));
        let ns = Math.min(l.path.length, l.s + v * dt);
        const p = sample(l.path, ns);
        // No overlap: if the next step would enter someone's personal space, wait a beat or step round.
        let blocked = false;
        for (const o of this.live.values()) {
          if (o === l || !o.a.ent.enabled || o.a.radius <= 0 || l.a.radius <= 0) continue;
          if (o.path && o.s < o.path.length) continue; // two walkers: the path planner keeps them apart
          const d = Math.hypot(p.x - o.x, p.z - o.z);
          if (d < l.a.radius + o.a.radius) {
            const dNow = Math.hypot(l.x - o.x, l.z - o.z);
            if (d < dNow) blocked = true;
          }
        }
        if (blocked) {
          // Sidestep: move along the path's normal a little this frame.
          const nx = -p.dz, nz = p.dx;
          const sx = l.x + nx * 0.6 * dt, sz = l.z + nz * 0.6 * dt;
          if (!this.world.blocked?.(sx, sz, l.a.radius)) {
            l.x = sx;
            l.z = sz;
          }
          ns = l.s;
        } else {
          l.x = p.x;
          l.z = p.z;
          if (Math.hypot(p.dx, p.dz) > 0.01) l.yaw = dampYaw(l.yaw, Math.atan2(p.dx, p.dz), 10, dt);
        }
        const moved = ns - l.s;
        l.s = ns;
        // A hop up on to something at the end of the path (the goat on the suya table).
        if (l.liftTo > 0) l.lift = l.liftTo * Math.max(0, Math.min(1, 1 - (l.path.length - l.s) / 1.2));
        const speed = moved / Math.max(1e-4, dt);
        l.a.person?.gait(speed);
        l.a.animate?.(dt, speed);
        if (l.s >= l.path.length - 0.005) {
          l.path = null;
          l.a.person?.gait(0);
          l.a.animate?.(dt, 0);
        }
      } else {
        if (l.face !== null && l.face !== undefined) l.yaw = dampYaw(l.yaw, this.faceYaw(l, l.face), 6, dt);
        l.a.person?.gait(0);
        l.a.animate?.(dt, 0);
      }
      this.setTransform(l);
      l.a.person?.update(dt);
    }
  }

  /* ------------------------------------------------------------ the loop */

  update(dt: number, skipPressed: boolean): void {
    if (this.done) return;
    if (skipPressed && this.cut.skippable) return this.skip();
    this.t += dt;
    while (this.idx < this.entries.length && this.entries[this.idx]!.at <= this.t) this.run(this.entries[this.idx++]!);
    if (this.t > this.subUntil) this.world.ui.subtitle(null, "");
    this.moveActors(dt);
    this.updateCamera(dt);
    if (this.fadeRate) {
      this.fadeA += Math.sign(this.fadeTo - this.fadeA) * Math.min(Math.abs(this.fadeTo - this.fadeA), this.fadeRate * dt);
      this.world.ui.fade(this.fadeA);
    }
    if (this.t >= this.duration) this.finish();
  }

  /** Jump to the end: run every remaining entry, put actors at their path ends, finish. */
  skip(): void {
    if (this.done) return;
    this.world.say({ id: "", castId: "", role: "", text: "", mood: "" });
    while (this.idx < this.entries.length) {
      const e = this.entries[this.idx++]!;
      if (e.key === "say" || e.key === "sfx.play" || e.key.startsWith("camera") || e.key === "title.card" || e.key === "calendar.show") continue;
      this.run(e);
    }
    for (const l of this.live.values()) {
      if (l.path) {
        const p = sample(l.path, l.path.length);
        l.x = p.x;
        l.z = p.z;
        l.yaw = Math.atan2(p.dx, p.dz);
        l.path = null;
      }
      l.a.person?.gait(0);
      this.setTransform(l);
    }
    this.finish();
  }

  /** Where each actor ends (for tests: skip equals watch, no overlaps at the end). */
  endPositions(): Record<string, [number, number]> {
    const out: Record<string, [number, number]> = {};
    for (const [r, l] of this.live) {
      if (l.path) {
        const p = sample(l.path, l.path.length);
        out[r] = [p.x, p.z];
      } else out[r] = [l.x, l.z];
    }
    return out;
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.world.ui.subtitle(null, "");
    this.world.ui.letterbox(false);
    this.world.ui.skipButton(false, () => undefined);
    this.world.ui.fade(0);
    this.world.clearCrowd();
    if (this.povHidden) this.povHidden.a.ent.enabled = true;
    for (const l of this.live.values()) if (l.a.person) l.a.person.rig.lookAt = null;
    const es = this.cut.endState;
    const pl = (es.PLAYER as FlowMap | undefined) ?? {};
    let at: A3 | null = null;
    let face: number | null = null;
    if (this.stage.end) {
      at = this.pos(this.stage.end.at);
      face = this.stage.end.face ?? null;
    } else if (typeof pl.at === "string") at = this.pos(pl.at);
    this.onEnd(es, at, face);
  }

  get length(): number {
    return this.duration;
  }

  /** The block's entries that will play for this player (for tests and the debug menu). */
  get plan(): readonly TimelineEntry[] {
    return this.entries;
  }
}

/* ------------------------------------------------------------ helpers */

function pushIn(from: A3, look: pc.Vec3, k: number): A3 {
  return [from[0] + (look.x - from[0]) * k, from[1] + (look.y - from[1]) * k, from[2] + (look.z - from[2]) * k];
}

function dampYaw(a: number, b: number, rate: number, dt: number): number {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * (1 - Math.exp(-rate * dt));
}

/** "family_car" -> the role that plays it ("CAR"); staging names vehicle roles in upper case. */
function roleOfVehicle(v: string): string {
  return v === "family_car" ? "CAR" : v === "keke" ? "KEKE" : v === "bicycle" ? "BIKE" : v.toUpperCase();
}

export function fillPlayer(text: string, c: PlayerCtx): string {
  return text.replace(/\{\{PLAYER_NAME\}\}/g, c.name).replace(/\{\{ROOMIE\}\}/g, c.roomie).replace(/\{\{GAME_NAME\}\}/g, "Work in Progress").replace(/\{\{UNI_NAME\}\}/g, "the university").replace(/\{\{UNI_SHORT\}\}/g, "the uni");
}

function setTimeoutSafe(f: () => void, ms: number): void {
  if (typeof setTimeout !== "undefined") setTimeout(f, ms);
}
