/**
 * The story game: everything Missions 1-10 run on.
 *
 * Mission scripts (missions/scripts.ts) are short async functions that read
 * like the Steps in Y1.md: `await g.cutscene("cut_m001_mid_1")`,
 * `await g.reach(...)`, `await g.talk("npc.mama_nkechi")`. This class makes
 * those words work in the engine:
 *
 *  - the cast (named NPCs built from cast.ts), crowd extras, story props
 *    (the goat, the bicycle, the keke, the family car, the note, the cats...);
 *  - interiors and their doors (fade, teleport, lights on inside);
 *  - objectives with a world marker and minimap arrow that route through
 *    doors when the target is indoors (rules U1-U3: one objective reader,
 *    the arrow points at the thing itself, every step has a beacon);
 *  - triggers: reach, talk (one interaction targeter: the step's target
 *    first, people over things, then nearest by facing: rule K2), use,
 *    time of day, follow and escort;
 *  - the Director for cutscenes (StageWorld), light presets, sound cues;
 *  - the bicycle, the keke ride, the goat chase, boosts and stamina;
 *  - progress: checkpoints per step, rewards once, local and cloud saves.
 */
import * as pc from "playcanvas";
import type { MatLib } from "../gfx/materials.ts";
import type { CollisionWorld } from "../sim/collide.ts";
import { damp, dampAngle } from "../sim/motion.ts";
import { makePath, sample, type P2 } from "../sim/path.ts";
import type { StoryBundle } from "../../tools/story-plugin.ts";
import type { StoryCutscene } from "../story/parse.ts";
import { CAMPUS_ANCHORS, SCULPTURES } from "../world/campus.ts";
import { byId, INTERIORS, interiorAt, interiorOrigin, type InteriorPlan, toWorld } from "../world/interior-plan.ts";
import type { BuiltInterior } from "../world/interiors.ts";
import { PLACES } from "../world/layout.ts";
import { type AnimName, type CharModel, FEMALE_MODELS, type Look, Person, randomLook } from "../world/people.ts";
import { Bicycle, BIKE, Goat, makeCandle, makeCats, makeCrate, makeGown, makeKeke, makeNote, makePlugSign, makeShade, makeSneakers, makeTin } from "../world/story-props.ts";
import { surfaceHeight } from "../world/surface.ts";
import { type CoilState, TeslaCoil } from "../world/tesla-coil.ts";
import { makeRng } from "../sim/rng.ts";
import { CAST, castKey } from "./cast.ts";
import { type A3, type CamAnchor, Director, type PlayerCtx, type StageActor, type StageWorld } from "./director.ts";
import type { InputState } from "./input.ts";
import { MissionUi } from "./mission-ui.ts";
import { Minigames } from "./minigames.ts";
import { EXTRA_INTERIOR_ANCHORS, EXTRA_WORLD_ANCHORS, stageFor } from "./missions/stages.ts";
import { worldAnchors, worldDoors } from "./missions/places.ts";
import { FollowCamera, Player } from "./player.ts";
import { applyEndState, type Progress, saveCloud, saveLocal } from "./save.ts";
import { Sfx } from "./sfx.ts";
import { VOICE_PROFILES, VoicePlayer, profileKey } from "./voices.ts";
import { type Body, StoryNav } from "./story-nav.ts";
import { GuideTrail, projectOnPath, trailMarks } from "./guide-trail.ts";
import type { NavPoint, PathSearch } from "../sim/nav.ts";
import type { NavGrid } from "../sim/nav.ts";
import type { Doors } from "../world/door-models.ts";
import { placeOf } from "./nav-routes.ts";
import { Combat } from "./combat.ts";

export class Abort extends Error {
  constructor() {
    super("mission aborted");
  }
}

/** Something to walk to: a position in a place ("world" or an interior id). */
export interface Target { pos: A3; where: string; label?: string }

interface Waiter { check: () => boolean; resolve: () => void; reject: (e: Error) => void; onReady?: () => void | Promise<void> }
interface Interaction { id: string; label: string; pos: () => A3; where: () => string; r: number; priority: number; onUse: () => void; person?: Person }

export interface GameDeps {
  app: pc.AppBase;
  cam: pc.Entity;
  mats: MatLib;
  people: CharModel[];
  col: CollisionWorld;
  /** The navigation grid (shared with the crowd's line routing). */
  nav?: NavGrid;
  /** The doors (entrances, exits, room doorways) that swing as people pass. */
  doors?: Doors;
  /** Phone quality (fewer arcs, no extras). */
  low?: boolean;
  interiors: BuiltInterior[];
  hudRoot: HTMLElement;
  story: StoryBundle;
  carEntity: (key: string, colour: string) => pc.Entity;
  /** The game's ambience (muted indoors, ducked in cutscenes). */
  setAmbience: (inside: boolean) => void;
  letterbox: (on: boolean) => void;
  subtitle: (who: string | null, text: string) => void;
  fadeEl: (a: number) => void;
  skipButton: (on: boolean, f: () => void) => void;
  showHud: (on: boolean) => void;
  toast: (t: string) => void;
  /** The top-level HUD (action hint, enemy health bar...). */
  hud: Hud;
}
import { Hud } from "./hud.ts";

/** The mission display layer (objective, marker, minimap, cards...). */
export interface MissionUiLike {
  setStamina: (s: number, zobo: boolean) => void;
  setObjective: (mission: string, text: string, target: (() => Target | null) | Target | null) => void;
  showCard: (kicker: string, title: string, sub?: string, rewards?: string[], ms?: number) => void;
  showPrompt: (label: string | null) => void;
  titleCard: (text: string | null) => void;
  calendar: (text: string | null) => void;
  letterbox: (on: boolean) => void;
  subtitle: (w: string | null, t: string) => void;
  fade: (a: number) => void;
  skipButton: (on: boolean, f: () => void) => void;
  say: (t: string) => void;
  ask: (q: string, o: string[]) => Promise<number>;
  key: (k: string) => boolean;
  get choosing(): boolean;
  insert: (kind: "note" | "photo" | "logbook" | "logbook_stub" | "kb_board" | "plug_sign" | null, playerTop?: string) => void;
}

const PI = Math.PI;

/** Top speed per vehicle kind. */
function kindTopSpeed(kind: "car" | "okada" | "keke"): number {
  return kind === "car" ? 13 : kind === "okada" ? 11 : 8;
}

export class StoryGame implements StageWorld {
  readonly ui: MissionUi & { letterbox(on: boolean): void; subtitle(w: string | null, t: string): void; fade(a: number): void; skipButton(on: boolean, f: () => void): void; say(t: string): void; setActionHint(t: string | null): void; setEnemyHealth(name: string | null, health: number | null): void; setMode(t: string): void };
  readonly mini: Minigames;
  readonly voice: VoicePlayer;
  readonly sfxs = new Sfx();
  player!: Player;
  follow!: FollowCamera;
  ctx!: PlayerCtx;
  look!: Look;
  progress!: Progress;
  /** "world" or an interior id. */
  place = "world";
  /** Clock and light (main.ts reads these every frame). */
  hours = 7.6;
  clockSpeed = 1;
  lightPreset = "day";
  mode: "menu" | "play" | "cut" | "bike" | "ride" | "mini" | "combat" | "drive" = "menu";
  director: Director | null = null;
  private npcs = new Map<string, Person>();
  private extras: Person[] = [];
  private extrasUsed = 0;
  private waiters: Waiter[] = [];
  private interactions: Interaction[] = [];
  /** Navigation: everyone the story walks (leaders, followers, the goat, cutscene routes). */
  readonly navs: StoryNav;
  /** Crowd walkers near the story's people (main.ts fills this every step; agents steer round them). */
  readonly crowdNear: { x: number; z: number; r: number }[] = [];
  private bodies = new WeakMap<object, Body>();
  /** Ground arrows to the objective (Settings: "Ground arrows"; main.ts wires the switch). */
  guideOn: () => boolean = () => true;
  private guide: GuideTrail;
  private guidePath: NavPoint[] = [];
  private guideSearch: PathSearch | null = null;
  private guideGoal: NavPoint | null = null;
  private guideRepath = 0;
  private guideShow = false;
  private token = 0;
  objective: { mission: string; text: string; target: () => Target | null } | null = null;
  // Props.
  goat!: Goat;
  bike!: Bicycle;
  keke!: pc.Entity;
  car!: pc.Entity;
  note!: pc.Entity;
  tin!: pc.Entity;
  gown: pc.Entity | null = null;
  crate!: pc.Entity;
  sneakers!: pc.Entity;
  plugSign!: pc.Entity;
  candle!: pc.Entity;
  shade!: pc.Entity;
  cats: pc.Entity | null = null;
  statue!: Person;
  private stones: Person[] = [];
  // Lights for presets.
  private torchLight!: pc.Entity;
  private candleLight!: pc.Entity;
  private coilLight!: pc.Entity;
  /** The Garden coil. */
  coil!: TeslaCoil;
  /** Story override for the coil ("lit" in a scene, say); null: from the flags and the hour. */
  coilOverride: CoilState | null = null;
  /** Camera micro-shake (seconds left) when the coil cracks near you. */
  private shakeT = 0;
  /** Combat state (null when not in a fight). */
  combat: Combat | null = null;
  /** The door we're mid-transition through (null when not transitioning). */
  private transitionDoor: string | null = null;
  /** The target we're transitioning to. */
  private transitionTarget: Target | null = null;
  /** The yaw to face after the transition. */
  private transitionYaw: number | null = null;

  /**
   * The coil's state from the story: lit (lightning) only once coil 1 has been lit at the
   * end of Year 1 (flag coil1_lit), after dark and in its scenes; humming whenever the Maker
   * keeps it alive (evenings, nights, its Year 1 scenes); dormant by day.
   */
  coilState(): CoilState {
    if (this.coilOverride) return this.coilOverride;
    // Its scenes in Year 1 (coil_glow) show it humming: it is not lit until the end of the year.
    if (this.lightPreset === "coil_glow") return this.progress?.flags.coil1_lit ? "lit" : "humming";
    const night = this.hours > 18.6 || this.hours < 5.6;
    if (night && this.progress?.flags.coil1_lit) return "lit";
    return night ? "humming" : "dormant";
  }

  /** Seals won so far (flags seal_engineering, seal_education...; ten in all). */
  sealCount(): number {
    return Math.min(10, Object.keys(this.progress?.flags ?? {}).filter((k) => k.startsWith("seal_") && this.progress.flags[k]).length);
  }
  private flicker = 0;
  // Boosts and stamina.
  boosts: { turbo: number; zobo: number; kola: number } = { turbo: 0, zobo: 0, kola: 0 };
  stamina = 1;
  carrying = false;
  // Bike state.
  private bikeS = { x: 0, z: 0, yaw: 0, speed: 0, lean: 0, dist: 0, prevX: 0, prevZ: 0, prevYaw: 0 };
  private goatInBasket = false;
  private shadeAnim: { t: number; from: A3; to: A3 } | null = null;
  private time = 0;
  private gameplayCamPos = new pc.Vec3();
  private tmpV = new pc.Vec3();
  private cutCb: (() => void) | null = null;

  constructor(private d: GameDeps) {
    const ui = new MissionUi(d.hudRoot);
    this.ui = Object.assign(ui, {
      letterbox: (on: boolean) => d.letterbox(on),
      subtitle: (w: string | null, t: string) => d.subtitle(w, t),
      fade: (a: number) => d.fadeEl(a),
      skipButton: (on: boolean, f: () => void) => d.skipButton(on, f),
      say: (t: string) => d.toast(t),
      setActionHint: (t: string | null) => d.hud.setActionHint(t),
      setEnemyHealth: (name: string | null, health: number | null) => d.hud.setEnemyHealth(name, health),
      setMode: (t: string) => d.hud.setMode(t),
    });
    this.mini = new Minigames(ui);
    this.voice = new VoicePlayer(d.story.recorded);
    ui.onPrompt = () => this.useNearest();
    this.buildProps();
    this.guide = new GuideTrail(d.app);
    this.navs = new StoryNav(d.col, d.nav, {
      player: () => {
        const pl = this.player;
        if (!pl) return { x: 0, y: 0, z: 0, place: "none", vx: 0, vz: 0, visible: false };
        return { x: pl.x, y: pl.y, z: pl.z, place: this.place, vx: 0, vz: 0, visible: pl.person.visible };
      },
      unseen: (x, z) => this.unseen(x, z),
      female: () => this.ctx?.female ?? false,
      doorPass: (link, phase) => this.d.doors?.open(phase === "out" ? link.doorA.id : link.doorB.id, 1.0),
    });
    this.combat = new Combat(this);
  }

  /** True when nobody could see a body at (x, z): another place, off camera or far away. */
  private unseen(x: number, z: number): boolean {
    if (placeOf(x, z) !== this.place) return true;
    const c = this.d.cam.getPosition();
    if (Math.hypot(c.x - x, c.z - z) > 70) return true;
    const cam = this.d.cam.camera;
    if (!cam) return true;
    const sph = new pc.BoundingSphere(new pc.Vec3(x, surfaceHeight(x, z) + 0.9, z), 1);
    return !cam.frustum.containsSphere(sph);
  }

  /** A person as the navigator moves them. */
  bodyOf(p: Person): Body {
    let b = this.bodies.get(p);
    if (!b) {
      b = {
        place: (x, y, z, yaw) => p.place(x, y, z, yaw),
        gait: (sp) => p.gait(sp),
        get visible() {
          return p.visible;
        },
        set visible(v: boolean) {
          p.visible = v;
        },
        look: (at) => {
          p.rig.lookAt = at ? new pc.Vec3(at[0], at[1], at[2]) : null;
        },
        wave: () => p.act("wave"),
      };
      this.bodies.set(p, b);
    }
    return b;
  }

  private goatBody(): Body {
    let b = this.bodies.get(this.goat);
    if (!b) {
      const goat = this.goat;
      b = {
        place: (x, y, z, yaw) => goat.place(x, y, z, yaw),
        gait: (sp, dt) => goat.animate(dt || 1 / 60, sp, this.time),
        get visible() {
          return goat.root.enabled;
        },
        set visible(v: boolean) {
          goat.visible = v;
        },
      };
      this.bodies.set(goat, b);
    }
    return b;
  }

  get app(): pc.AppBase {
    return this.d.app;
  }

  get cam(): pc.Entity {
    return this.d.cam;
  }

  /* ================================================================ setup */

  private buildProps(): void {
    const { app, mats } = this.d;
    this.goat = new Goat(app, mats);
    this.goat.visible = false;
    this.bike = new Bicycle(app, mats);
    this.bike.visible = false;
    this.keke = makeKeke(app, mats);
    app.root.addChild(this.keke);
    this.keke.enabled = false;
    this.car = new pc.Entity("family-car");
    this.car.addChild(this.d.carEntity("suv", "#2f3c4a"));
    app.root.addChild(this.car);
    this.car.enabled = false;
    const add = (e: pc.Entity) => {
      app.root.addChild(e);
      e.enabled = false;
      return e;
    };
    this.note = add(makeNote(app, mats));
    this.tin = add(makeTin(app, mats));
    this.crate = add(makeCrate(app, mats));
    this.sneakers = add(makeSneakers(app, mats));
    this.plugSign = add(makePlugSign(app, mats));
    this.candle = add(makeCandle(app, mats));
    this.shade = makeShade(app);
    // Lights for the presets.
    const light = (name: string, color: [number, number, number], range: number) => {
      const e = new pc.Entity(name);
      e.addComponent("light", { type: "omni", castShadows: false, range, intensity: 0, color: new pc.Color(...color), falloffMode: pc.LIGHTFALLOFF_INVERSESQUARED });
      app.root.addChild(e);
      return e;
    };
    this.torchLight = light("torch", [1, 0.97, 0.88], 4);
    this.candleLight = light("candle", [1, 0.66, 0.3], 6);
    this.coilLight = light("coil", [0.45, 1, 0.9], 9);
    this.coilLight.setPosition(PLACES.engGarden.x, 2.6, PLACES.engGarden.z);
    // The Garden coil (hero prop): its state follows the story (see coilState()).
    this.coil = new TeslaCoil(app, this.d.mats, PLACES.engGarden.x, PLACES.engGarden.z, 0.02, !!this.d.low);
    this.coil.onCrack = (dist) => {
      if (dist < 22) this.sfxs.play("coil_crack");
      if (dist < 9) this.shakeT = 0.18;
    };
    // Crowd extras for scenes (queues, the lawn, the lecture theatres).
    const rng = makeRng(606);
    for (let i = 0; i < 30; i++) {
      const look = randomLook(rng, this.d.people);
      const cm = this.d.people.find((m) => m.key === look.model)!;
      const p = new Person(app, cm, look, app.root);
      p.visible = false;
      this.extras.push(p);
    }
    // The Sculpture Garden: stone people on their plinths, and the girl feeding fish at the pond.
    const stone = (model: string): Look => ({ model, skin: "#b4aea2", hair: "#9d978b", outfit: Array(6).fill("#aaa498"), headwear: "none", headwearColor: "#aaa498" });
    const models = ["manlong", "womancasual", "mansuit", "man", "womandress", "animwoman", "casual", "manlong", "hoodie", "business"];
    SCULPTURES.forEach(([sx, sz], i) => {
      const cm = this.d.people.find((m) => m.key === models[i % models.length])!;
      const p = new Person(app, cm, stone(cm.key), app.root, { shadows: true });
      p.place(sx, surfaceHeight(sx, sz) + 0.35, sz, (i * 1.7) % (2 * PI));
      this.stones.push(p);
    });
    const scm = this.d.people.find((m) => m.key === "womancasual")!;
    this.statue = new Person(app, scm, stone("womancasual"), app.root);
    this.statue.place(-24, 0.02, -119.55, 0);
    this.statue.act("sit");
    this.statue.act("hold_torch");
  }

  /** Position of a combatant (for camera tracking). */
  fighterPos(castId: string): { x: number; z: number } {
    const c = this.combat?.fighters.get(castId);
    if (!c) return { x: this.player.x, z: this.player.z };
    const p = c.person.root.getPosition();
    return { x: p.x, z: p.z };
  }

  /** Start a fight with the named NPC. */
  fight(opponent: string): void {
    this.combat!.start(opponent);
    this.mode = "combat";
    this.player.frozen = false;
    this.ui.setMode("FIGHT");
  }

  /** End the current fight and return to play. */
  endFight(): void {
    this.combat!.end();
    this.mode = "play";
    this.ui.setMode("");
    this.ui.setActionHint(null);
  }

  /** Start (or restart) the story for this look and name. */
  begin(look: Look, progress: Progress, specials: PlayerCtx["specials"]): void {
    this.look = look;
    this.progress = progress;
    const female = FEMALE_MODELS.includes(look.model);
    this.voice.playerFemale = female;
    this.ctx = {
      name: progress.name || "Fresher", female, topColour: colourName(look.outfit[0] ?? "#ffffff"), headwear: look.headwear,
      headColour: colourName(look.headwearColor), roomie: female ? "Firdausi" : "Bature", specials,
    };
    if (!this.player) {
      const cm = this.d.people.find((p) => p.key === look.model) ?? this.d.people[0]!;
      const person = new Person(this.d.app, cm, look, this.d.app.root);
      this.player = new Player(person, this.d.col, -101.4, -92, PI / 2);
      this.follow = new FollowCamera(this.d.cam, this.d.col);
    }
  }

  /* ================================================================ anchors (StageWorld) */

  private worldAnchorTable(): Record<string, A3 | CamAnchor> {
    return { ...CAMPUS_ANCHORS, ...worldAnchors(this.ctx.female), ...EXTRA_WORLD_ANCHORS };
  }

  anchor(name: string, where: string): A3 | CamAnchor | null {
    if (where === "world") return this.worldAnchorTable()[name] ?? null;
    const plan = INTERIORS.find((p) => p.id === where);
    if (!plan) return null;
    const [ox, oz] = interiorOrigin(plan);
    if (name === "__origin") return [ox, 0, oz];
    const a = EXTRA_INTERIOR_ANCHORS[where]?.[name] ?? plan.anchors[name];
    if (!a) return null;
    const conv = (p: A3): A3 => [ox + p[0], p[1], oz + p[2]];
    return Array.isArray(a) ? conv(a) : { pos: conv(a.pos), to: a.to ? conv(a.to) : undefined, fov: a.fov };
  }

  /** A position for an anchor name in a place (camera anchors give their position). */
  at(name: string, where = "world"): A3 {
    const a = this.anchor(name, where);
    if (!a) throw new Error(`no anchor ${name} in ${where}`);
    return Array.isArray(a) ? a : a.pos;
  }

  target(name: string, where = "world", label?: string): Target {
    return { pos: this.at(name, where), where, label };
  }

  ground(x: number, z: number): number {
    return surfaceHeight(x, z);
  }

  clearCam(p: pc.Vec3): pc.Vec3 {
    const g = surfaceHeight(p.x, p.z) + 0.3;
    if (p.y < g) p.y = g;
    // Indoors the ceiling caps the camera.
    const ip = interiorAt(p.x, p.z);
    if (ip) {
      const [ox, oz] = interiorOrigin(ip);
      const room = ip.rooms.find((r) => Math.abs(p.x - ox - r.x) <= r.hx && Math.abs(p.z - oz - r.z) <= r.hz);
      if (room) p.y = Math.min(p.y, room.h - 0.2);
    } else {
      for (const c of this.d.col.near(p.x, p.z)) if ((c.h ?? 0) > p.y && this.d.col.blocked(p.x, p.z, 0.25)) p.y = (c.h ?? 0) + 0.6;
    }
    return p;
  }

  prop(id: string, where: string): A3 | null {
    const map: Record<string, pc.Entity | null> = { "prop.note": this.note, "prop.goat_sarki": this.goat.root, "prop.plug_sign": this.plugSign, "prop.turbo_sneakers": this.sneakers };
    const e = map[id];
    if (e?.enabled) {
      const p = e.getPosition();
      return [p.x, p.y + 0.1, p.z];
    }
    if (id === "prop.cats_ring" || id === "prop.statue_fish_girl" || id === "prop.statue_fish_girl_turned") return id === "prop.cats_ring" ? [PLACES.engGarden.x, 0.4, PLACES.engGarden.z] : [-24, 1.0, -120.0];
    if (id === "prop.logbook" || id === "prop.logbook_p40") return this.at("lab_bench", "lab");
    void where;
    return null;
  }

  showProp(id: string, at: A3 | null, show: boolean): void {
    const put = (e: pc.Entity, p: A3 | null, yaw = 0) => {
      e.enabled = show;
      if (show && p) {
        e.setPosition(p[0], Math.max(p[1], surfaceHeight(p[0], p[2])), p[2]);
        e.setEulerAngles(0, yaw, 0);
      }
    };
    switch (id) {
      case "prop.note":
        put(this.note, at, 20);
        break;
      case "prop.gown_huge":
        this.wearGown(show, false);
        break;
      case "prop.turbo_sneakers": {
        const p = this.player.person.root.getPosition();
        put(this.sneakers, [p.x + 0.4, p.y + 0.95, p.z + 0.2]);
        setTimeout(() => (this.sneakers.enabled = false), 4000);
        break;
      }
      case "prop.plug_sign":
        this.plugSign.enabled = show;
        break;
      case "prop.cats_ring":
        if (show && !this.cats) this.cats = makeCats(this.d.app, this.d.mats, PLACES.engGarden.x, PLACES.engGarden.z, 3.3, this.ctx.specials.taty ? 12 : 11, 0.02);
        if (this.cats) this.cats.enabled = show;
        break;
      case "prop.statue_fish_girl_turned":
        this.statue.rig.headTurn = show ? { yaw: 70, pitch: -14 } : { yaw: 0, pitch: 0 };
        break;
      case "prop.photo_backrow_gap":
        this.ui.insert(show ? "photo" : null, this.look.outfit[0]);
        if (show) setTimeout(() => this.ui.insert(null), 4500);
        break;
      case "prop.logbook_p40":
        this.ui.insert(show ? "logbook" : null);
        break;
      case "prop.logbook_stub_p41":
        this.ui.insert(show ? "logbook_stub" : null);
        if (show) setTimeout(() => this.ui.insert(null), 5000);
        break;
      case "prop.bib":
        if (show) this.d.toast("Jega throws you a bib.");
        break;
    }
  }

  /** Show or hide a story prop from a mission script (the gown, belted or not, the cats...). */
  showPropPublic(id: string, show: boolean): void {
    if (id === "prop.gown_huge") this.wearGown(show, false);
    else if (id === "prop.gown_belted") this.wearGown(show, true);
    else this.showProp(id, null, show);
  }

  private wearGown(on: boolean, belted: boolean): void {
    if (this.gown) {
      this.gown.destroy();
      this.gown = null;
    }
    if (!on) return;
    this.gown = makeGown(this.d.app, this.d.mats, belted);
    this.player.person.root.addChild(this.gown);
    this.gown.setLocalPosition(0, 0, 0);
    this.gown.setLocalScale(1.08, 1, 1.12);
  }

  light(preset: string): void {
    if (preset.startsWith("hour:")) {
      this.hours = Number(preset.slice(5));
      return;
    }
    this.lightPreset = preset;
    // Candlelight in the hostel kitchen: the one candle on the table (and its light).
    if (preset === "candle") {
      const c = this.at("candle_circle", "hostel");
      this.candle.enabled = true;
      this.candle.setPosition(c[0], 0.79, c[2]);
    } else this.candle.enabled = false;
    if (preset === "day" && (this.hours < 5.8 || this.hours > 18.2)) this.hours = 9;
    if (preset === "dusk") this.hours = 18.4;
    if (preset === "night" || preset === "coil_glow") this.hours = Math.max(this.hours, 20.5) % 24;
  }

  fx(id: string, at: A3 | null): void {
    if (id === "flicker") this.flicker = 1.6;
    else if (id === "shade_drift") {
      const from = at ?? this.at("corridor_far_end", "hostel");
      const to = this.at("idris_door", "hostel");
      this.shadeAnim = { t: 0, from: [from[0], 0.6, from[2]], to: [to[0] + 0.6, 0.6, to[2] - 0.2] };
      this.shade.enabled = true;
    } else if (id === "dust") this.sfxs.play("wind_gust");
    else if (id === "goat_look") this.goat.lookT = 3;
    else if (id.startsWith("crowd:")) {
      const anim = id.slice(6) as AnimName;
      for (let i = 0; i < this.extrasUsed; i++) this.extras[i]!.act(anim);
    }
  }

  sfx(cue: string): void {
    this.sfxs.play(cue);
  }

  music(cue: string | null, duck: boolean): void {
    this.sfxs.music(cue);
    void duck;
  }

  say(line: { id: string; castId: string; role: string; text: string; mood: string }): void {
    if (!line.id) {
      this.voice.stop();
      return;
    }
    this.sfxs.duck(true);
    setTimeout(() => this.sfxs.duck(false), 2600);
    this.voice.say({ id: line.id, castId: line.castId, text: line.text, mood: line.mood });
  }

  speakerName(role: string, castId: string): string {
    if (castId === "player") return this.ctx.name;
    if (castId === "npc.roomie") return this.ctx.roomie;
    if (castId === "crowd.freshers") return "Freshers";
    return VOICE_PROFILES[profileKey(castId, this.ctx.female)]?.name ?? CAST[castId]?.name ?? role;
  }

  gameplayCam(): { pos: A3; look: A3 } {
    const p = this.player.pos(1, this.tmpV);
    const yaw = this.player.yaw;
    const back = 4.6;
    const pos: A3 = [p.x - Math.sin(yaw) * back, p.y + 2.1, p.z - Math.cos(yaw) * back];
    const v = this.clearCam(new pc.Vec3(...pos));
    // Indoors: keep the camera inside the room.
    const ip = interiorAt(p.x, p.z);
    if (ip) {
      const [ox, oz] = interiorOrigin(ip);
      const room = ip.rooms.find((r) => Math.abs(p.x - ox - r.x) <= r.hx && Math.abs(p.z - oz - r.z) <= r.hz);
      if (room) {
        v.x = Math.max(ox + room.x - room.hx + 0.35, Math.min(ox + room.x + room.hx - 0.35, v.x));
        v.z = Math.max(oz + room.z - room.hz + 0.35, Math.min(oz + room.z + room.hz - 0.35, v.z));
      }
    }
    return { pos: [v.x, v.y, v.z], look: [p.x, p.y + 1.45, p.z] };
  }

  crowd(specs: NonNullable<import("./director.ts").CutStage["crowd"]>, where: string): void {
    for (const c of specs) {
      const w = c.where ?? where;
      const o = w === "world" ? [0, 0] : interiorOrigin(byId(w));
      const n = Math.min(c.n, this.extras.length - this.extrasUsed);
      const alongX = c.hx >= c.hz;
      for (let i = 0; i < n; i++) {
        const p = this.extras[this.extrasUsed++]!;
        let x: number, z: number;
        if (c.rows) {
          const t = n === 1 ? 0.5 : i / (n - 1);
          x = c.x + (alongX ? (t - 0.5) * 2 * c.hx : 0);
          z = c.z + (alongX ? 0 : (t - 0.5) * 2 * c.hz);
        } else {
          // A loose group on a grid with jitter (at least 0.8 m apart).
          const cols = Math.max(1, Math.floor((c.hx * 2) / 0.9));
          x = c.x - c.hx + 0.45 + (i % cols) * 0.9 + ((i * 37) % 7) * 0.04;
          z = c.z - c.hz + 0.45 + Math.floor(i / cols) * 0.95 + ((i * 53) % 5) * 0.05;
        }
        const wx = x + o[0]!, wz = z + o[1]!;
        p.visible = true;
        p.place(wx, surfaceHeight(wx, wz), wz, c.face + (c.rows ? 0 : ((i * 29) % 9 - 4) * 0.08));
        p.act("stand");
        if (c.anim) p.act(c.anim);
        p.gait(0);
      }
    }
  }

  clearCrowd(): void {
    for (let i = 0; i < this.extrasUsed; i++) {
      this.extras[i]!.act("stand");
      this.extras[i]!.visible = false;
    }
    this.extrasUsed = 0;
  }

  /** The actor for a cutscene role. */
  actor(role: string, castId: string): StageActor | null {
    if (role === "PLAYER") {
      this.player.person.visible = true;
      return { kind: "person", ent: this.player.person.root, person: this.player.person, radius: 0.3 };
    }
    if (castId === "prop.goat_sarki" || role === "GOAT") {
      this.goat.visible = true;
      return { kind: "goat", ent: this.goat.root, radius: 0.35, animate: (dt, sp) => this.goat.animate(dt, sp, this.time) };
    }
    if (role === "CAR") {
      this.car.enabled = true;
      return { kind: "vehicle", ent: this.car, radius: 0 };
    }
    if (role === "KEKE") {
      this.keke.enabled = true;
      return { kind: "vehicle", ent: this.keke, radius: 0 };
    }
    if (castId.startsWith("crowd.freshers") || castId.startsWith("prop.")) return null;
    const p = this.npc(castId);
    if (!p) return null;
    p.visible = true;
    return { kind: "person", ent: p.root, person: p, radius: 0.3 };
  }

  /** Story vehicles and the goat as obstacles for the traffic (cars stop for the family car and the keke). */
  storyObstacles(out: { x: number; z: number; r: number }[]): void {
    for (const e of [this.car, this.keke]) {
      if (!e.enabled) continue;
      const p = e.getPosition();
      out.push({ x: p.x, z: p.z, r: 1.7 });
    }
    if (this.goat.root.enabled && !this.goatInBasket) out.push({ x: this.goat.x, z: this.goat.z, r: 0.5 });
  }

  /** Debug (screenshots): who is visible and what pose layer each holds. */
  castState(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, p] of this.npcs) if (p.visible) out[k] = `${p.held ?? "-"}/${p.rig.bodyPose ?? "-"}/${p.rig.gesture ?? "-"}/${p.rig.debugPoseW.toFixed(2)}`;
    return out;
  }

  /** Named characters on the map, for the crowd to walk round. */
  storyPeople(out: { x: number; z: number; r: number }[]): void {
    for (const p of this.npcs.values()) {
      if (!p.visible) continue;
      const q = p.root.getPosition();
      if (q.x < 1500) out.push({ x: q.x, z: q.z, r: 0.33 });
    }
  }

  /* ================================================================ the cast */

  /** Get (or build) a named character. */
  npc(castId: string): Person | null {
    const key = castKey(castId, this.ctx.female);
    let p = this.npcs.get(key);
    if (p) return p;
    const c = CAST[key];
    if (!c) return null;
    const cm = this.d.people.find((m) => m.key === c.look.model);
    if (!cm) return null;
    p = new Person(this.d.app, cm, c.look, this.d.app.root);
    if (c.height || c.width) p.root.setLocalScale(c.width ?? 1, c.height ?? 1, c.width ?? 1);
    p.visible = false;
    this.npcs.set(key, p);
    return p;
  }

  /** Put a character on a mark (or hide them with at = null). */
  put(castId: string, at: Target | null, face = 0, anim?: AnimName): Person | null {
    const p = this.npc(castId);
    if (!p) return null;
    if (!at) {
      this.navs.release(this.bodyOf(p));
      p.visible = false;
      return p;
    }
    this.navs.release(this.bodyOf(p));
    p.visible = true;
    p.place(at.pos[0], surfaceHeight(at.pos[0], at.pos[2]), at.pos[2], face);
    p.act("stand");
    if (anim) p.act(anim);
    p.gait(0);
    return p;
  }

  /** Hide every named character (between missions). */
  clearCast(): void {
    for (const p of this.npcs.values()) {
      p.visible = false;
      p.act("stand");
      p.rig.lookAt = null;
    }
    this.navs.clear();
    this.goat.visible = false;
    this.goatInBasket = false;
    this.car.enabled = false;
    this.keke.enabled = false;
    this.bike.visible = false;
    for (const e of [this.note, this.tin, this.crate, this.sneakers, this.plugSign, this.candle]) e.enabled = false;
    this.wearGown(false, false);
    this.clearCrowd();
  }

  /* ================================================================ mission plumbing */

  /** Start a new mission run (earlier waits are aborted). */
  newRun(): number {
    this.token++;
    for (const w of this.waiters) w.reject(new Abort());
    this.waiters = [];
    this.interactions = [];
    this.navs.clear();
    this.mini.cancel();
    if (this.director) {
      this.director = null;
      this.ui.letterbox(false);
      this.ui.subtitle(null, "");
      this.ui.skipButton(false, () => undefined);
      this.ui.fade(0);
    }
    this.mode = "play";
    this.player.frozen = false;
    this.d.showHud(true);
    this.ui.setPlaying(true);
    // Set time to night for missions - ensures submissions and interactions start at night
    this.hours = 21 + Math.random() * 2;  // Between 21:00 and 23:00
    this.lightPreset = "night";
    this.light("night");
    return this.token;
  }

  private wait(check: () => boolean, onReady?: () => void | Promise<void>): Promise<void> {
    const tok = this.token;
    return new Promise((resolve, reject) => {
      if (tok !== this.token) return reject(new Abort());
      this.waiters.push({ check, resolve, reject, onReady });
    });
  }

  sleep(s: number): Promise<void> {
    const until = this.time + s;
    return this.wait(() => this.time >= until);
  }

  setObjective(mission: string, text: string, target: (() => Target | null) | Target | null): void {
    const t = typeof target === "function" ? target : () => target;
    this.objective = { mission, text: fill(text, this.ctx), target: t };
    this.ui.objective(mission, this.objective.text);
  }

  clearObjective(): void {
    this.objective = null;
    this.ui.objective(null, null);
  }

  /** Where the player is right now. */
  playerAt(): Target {
    const p = this.player;
    return { pos: [p.x, p.y, p.z], where: this.place };
  }

  dist(t: Target): number {
    if (t.where !== this.place) return Infinity;
    return Math.hypot(this.player.x - t.pos[0], this.player.z - t.pos[2]);
  }

  /** Wait until the player reaches a target (within r metres, in the right place). */
  reach(t: Target, r = 2): Promise<void> {
    return this.wait(() => this.mode === "play" && this.dist(t) <= r, async () => {
      // Show message when arriving at a mission location: go sleep or wander
      if (this.mode === "play" && this.objective) {
        const hour = this.hours.toFixed(1);
        this.ui.say(`It is night (hour ${hour}). Go rest or wander around until morning.`);
      }
    });
  }

  /** Wait until the player presses E near a person or a spot. */
  use(id: string, label: string, pos: () => Target, r = 2, priority = 1, person?: Person): Promise<void> {
    const tok = this.token;
    return new Promise((resolve, reject) => {
      const it: Interaction = {
        id, label, r, priority, person,
        pos: () => pos().pos, where: () => pos().where,
        onUse: () => {
          this.interactions = this.interactions.filter((x) => x !== it);
          resolve();
        },
      };
      this.interactions.push(it);
      this.waiters.push({ check: () => false, resolve: () => undefined, reject: (e) => {
        this.interactions = this.interactions.filter((x) => x !== it);
        if (tok === this.token) return;
        reject(e);
      } });
    });
  }

  /** Talk to a character: walk up to them and press E. */
  talk(castId: string, label?: string, r = 2.2): Promise<void> {
    const p = this.npc(castId)!;
    const name = this.speakerName("", castId);
    return this.use(`talk:${castId}`, label ?? `Talk to ${name}`, () => {
      const q = p.root.getPosition();
      return { pos: [q.x, q.y, q.z], where: interiorAt(q.x, q.z)?.id ?? "world" };
    }, r, 2, p);
  }

  /** Wait until the clock passes an hour (24 h, decimal). */
  until(hour: number): Promise<void> {
    return this.wait(() => this.hours >= hour);
  }

  /** A bark during play: subtitle (no letterbox) and the character's voice. */
  bark(castId: string, id: string, text: string, mood = "neutral", secs?: number): void {
    const t = fill(text, this.ctx);
    this.d.subtitle(this.speakerName("", castId), t);
    this.say({ id, castId, role: "", text: t, mood });
    const n = secs ?? Math.max(2.4, Math.min(6, 1 + t.split(/\s+/).length * 0.36));
    const tok = ++this.barkTok;
    setTimeout(() => {
      if (tok === this.barkTok && this.mode !== "cut") this.d.subtitle(null, "");
    }, n * 1000);
  }
  private barkTok = 0;

  async barks(lines: [string, string, string, string?][], gap = 0.4): Promise<void> {
    for (const [castId, id, text, mood] of lines) {
      this.bark(castId, id, text, mood ?? "neutral");
      await this.sleep(Math.max(2.2, Math.min(5.5, 1 + text.split(/\s+/).length * 0.34)) + gap);
    }
  }

  ask(q: string, options: string[]): Promise<number> {
    const prev = this.mode;
    this.mode = "mini";
    return this.ui.ask(fill(q, this.ctx), options.map((o) => fill(o, this.ctx))).then((i) => {
      this.mode = prev === "mini" ? "play" : prev;
      return i;
    });
  }

  /** Run a minigame (the player stands still while it runs). */
  async minigame<T>(start: () => Promise<T>): Promise<T> {
    this.mode = "mini";
    this.ui.setPlaying(false);
    try {
      return await start();
    } finally {
      this.mode = "play";
      this.ui.setPlaying(true);
    }
  }

  /**
   * A character walks a route (marks in any places): a real path between marks
   * (footpaths first, round everything solid, through doors). Resolves on
   * arrival. With lead, they guide you: wait when you fall behind, wave, come
   * back for you, and re-route if you take another way.
   */
  walk(castId: string | Person, route: Target[], o: { speed?: number; lead?: number; run?: boolean } = {}): Promise<void> {
    const p = typeof castId === "string" ? this.npc(castId)! : castId;
    const q = p.root.getPosition();
    p.act("stand");
    const yaw = (p.root.getEulerAngles().y * Math.PI) / 180;
    return this.navs.walk(this.bodyOf(p), { x: q.x, z: q.z, yaw }, route.map((t) => t.pos), { speed: o.run ? 4.6 : Math.max(2.0, o.speed ?? 2.0), lead: o.lead });
  }

  /** A character follows you (escorts), keeping `gap` metres behind. Stop it with the handle. */
  escort(castId: string | Person, gap = 1.2, maxSpeed = 3.2): { stop(): void } {
    const p = typeof castId === "string" ? this.npc(castId)! : castId;
    const q = p.root.getPosition();
    p.act("stand");
    const yaw = (p.root.getEulerAngles().y * Math.PI) / 180;
    return this.navs.follow(this.bodyOf(p), { x: q.x, z: q.z, yaw }, { gap, maxSpeed });
  }

  /** Where a walking character is now (objective markers follow leaders). */
  whereIs(p: Person): Target {
    const at = this.navs.positionOf(this.bodyOf(p));
    if (at) return { pos: at.pos, where: at.where };
    const q = p.root.getPosition();
    return { pos: [q.x, q.y, q.z], where: placeOf(q.x, q.z) };
  }

  /** Cutscene walks: plan each leg on the navigation grid (round walls, furniture, trees). */
  navRoute(pts: P2[]): P2[] {
    return this.navs.planRoute(pts);
  }

  blocked(x: number, z: number, r: number): boolean {
    return this.d.col.blocked(x, z, r);
  }

  /** Fade to black, run f, fade back (doors, time skips). */
  async fadeThrough(f: () => void, secs = 0.35): Promise<void> {
    const steps = 8;
    for (let i = 1; i <= steps; i++) {
      this.ui.fade(i / steps);
      await this.sleep(secs / steps);
    }
    f();
    await this.sleep(0.12);
    for (let i = steps - 1; i >= 0; i--) {
      this.ui.fade(i / steps);
      await this.sleep(secs / steps);
    }
  }

  /** Move the player instantly (and the camera behind them). */
  teleport(t: Target, yaw: number): void {
    this.player.teleport(t.pos[0], t.pos[2], yaw);
    this.player.person.act("stand");
    this.player.person.visible = true;
    this.setPlace(interiorAt(t.pos[0], t.pos[2])?.id ?? "world");
    this.follow.reset(this.player.pos(1, this.tmpV), yaw);
    this.follow.yaw = yaw;
  }

  private setPlace(where: string): void {
    if (where === this.place) return;
    this.place = where;
    for (const bi of this.d.interiors) for (const l of bi.lights) l.enabled = bi.plan.id === where;
    this.d.setAmbience(where !== "world");
  }

  /**
   * Go through a door: walk up to it, it swings open, fade, and you come out
   * of the matching door on the other side (it opens for you and closes
   * behind you), facing out.
   */
  async enterDoor(to: Target, yaw: number): Promise<void> {
    const doors = this.d.doors;
    const here = doors?.near(this.place, this.player.x, this.player.z, 3.4);
    // Start loading the new world behind the door as soon as we approach
    if (doors && here) {
      // Pre-load the target place resources while walking to the door
      const targetPlace = to.where === "world" ? "world" : to.where;
      // Mark that we're transitioning through this door
      this.transitionDoor = here.id;
      this.transitionTarget = to;
      this.transitionYaw = yaw;
      // Walk up to the threshold (a real walk: the feet move, collisions apply)
      const ax = here.x + Math.sin(here.yaw) * 0.5, az = here.z + Math.cos(here.yaw) * 0.5;
      this.autoWalk = { x: ax, z: az, face: here.yaw + PI };
      const t0 = this.time;
      await this.wait(() => this.autoWalk === null || this.time - t0 > 1.6 || Math.hypot(this.player.x - ax, this.player.z - az) < 0.18);
      this.autoWalk = null;
      this.player.frozen = true;
      doors.open(here.id, 1.2);
      this.sfxs.play("door");
      await this.sleep(0.35);
    } else {
      this.sfxs.play("door");
    }
    // Fade through and teleport - the new place is already loading
    await this.fadeThrough(() => {
      // Out on the map: a step clear of the doorway, the camera a little to one side so it is not in the wall.
      const out = to.where === "world";
      const at: A3 = out ? [to.pos[0] + Math.sin(yaw) * 1.2, to.pos[1], to.pos[2] + Math.cos(yaw) * 1.2] : to.pos;
      this.teleport({ ...to, pos: at }, yaw);
      if (out && this.follow) {
        this.follow.reset(this.player.pos(1, this.tmpV), yaw + 0.75);
        this.follow.yaw = yaw + 0.75;
      }
      // Open door on the other side if it exists
      const there = doors?.near(this.place, to.pos[0], to.pos[2], 3.4);
      if (there) doors!.open(there.id, 0.9);
    });
    this.player.frozen = false;
    // Clean up transition markers
    this.transitionDoor = null;
    this.transitionTarget = null;
    this.transitionYaw = null;
  }

  /** Screenshots and the nav simulation in the browser (?follow=1): the player follows the guide, using doors. */
  shotFollow = false;
  private shotDoorBusy = false;

  private followLeaderForShots(): void {
    // The camera swings round behind you (a steady view for the stills).
    if (this.follow) this.follow.yaw = dampAngle(this.follow.yaw, this.player.yaw, 3, 1 / 60);
    const l = this.navs.leader();
    if (!l) return;
    if (l.where === this.place) {
      const d = Math.hypot(l.pos[0] - this.player.x, l.pos[2] - this.player.z);
      if (d > 2.4) this.steerShot(l.pos[0], l.pos[2]);
      return;
    }
    // The guide is through a door: walk to it and use it.
    const door = this.routeTo({ pos: l.pos, where: l.where });
    const d = Math.hypot(door[0] - this.player.x, door[2] - this.player.z);
    if (d > 1.0) this.steerShot(door[0], door[2]);
    else if (!this.shotDoorBusy) {
      this.shotDoorBusy = true;
      this.useNearest();
      void this.sleep(2).then(() => (this.shotDoorBusy = false), () => (this.shotDoorBusy = false));
    }
  }
  private shotPath: [number, number][] = [];
  private shotPathT = 0;
  /** Walk towards (x, z) on a planned path (re-planned twice a second). */
  private steerShot(x: number, z: number): void {
    if (this.time - this.shotPathT > 0.5 || !this.shotPath.length) {
      this.shotPathT = this.time;
      this.shotPath = this.navs.planRoute([[this.player.x, this.player.z], [x, z]]);
    }
    while (this.shotPath.length > 1 && Math.hypot(this.shotPath[1]![0] - this.player.x, this.shotPath[1]![1] - this.player.z) < 0.4) this.shotPath.shift();
    const t = this.shotPath[1] ?? [x, z];
    this.autoWalkOnce = { x: t[0], z: t[1] };
  }
  /** A one-step steer for followLeaderForShots (walks like input would). */
  private autoWalkOnce: { x: number; z: number } | null = null;

  /** The player walks themselves to a point (door approaches); input is ignored meanwhile. */
  private autoWalk: { x: number; z: number; face: number } | null = null;

  /* ================================================================ cutscenes */

  findCut(id: string): StoryCutscene {
    for (const m of this.d.story.missions) for (const c of m.cutscenes) if (c.id === id) return c;
    throw new Error(`no cutscene ${id}`);
  }

  /** Play a cutscene block from Y1.md; resolves when it ends (watched or skipped). */
  cutscene(id: string, opts: { fadeIn?: boolean } = {}): Promise<void> {
    const tok = this.token;
    const cut = this.findCut(id);
    const stage = stageFor(id, this.ctx);
    if (!stage) throw new Error(`no staging for ${id}`);
    return new Promise((resolve, reject) => {
      this.mode = "cut";
      this.d.showHud(false);
      this.ui.setPlaying(false);
      this.player.frozen = true;
      this.navs.clear();
      // Everyone not in this scene steps out of shot.
      const inScene = new Set(Object.keys(stage.actors));
      for (const [k, p] of this.npcs) {
        const role = Object.entries(cut.cast).find(([, v]) => castKey(v, this.ctx.female) === k)?.[0];
        if (!role || !inScene.has(role)) p.visible = false;
      }
      if (!inScene.has("GOAT") && !this.goatInBasket) this.goat.visible = false;
      if (!inScene.has("CAR")) this.car.enabled = false;
      if (!inScene.has("KEKE")) this.keke.enabled = false;
      // The scene's interior lights on (cameras may cut between places).
      if (stage.where !== "world") this.setPlace(stage.where);
      this.director = new Director(cut, stage, this, this.ctx, (endState, at, face) => {
        applyEndState(this.progress, endState);
        this.ui.setMoney(this.progress.money);
        this.director = null;
        this.shade.enabled = false;
        this.ui.insert(null);
        this.sfxs.music(null);
        this.player.frozen = false;
        if (at) {
          this.teleport({ pos: at, where: interiorAt(at[0], at[2])?.id ?? "world" }, face ?? this.player.yaw);
        } else {
          const q = this.player.person.root.getPosition();
          this.teleport({ pos: [q.x, q.y, q.z], where: interiorAt(q.x, q.z)?.id ?? "world" }, this.player.yaw);
        }
        this.mode = "play";
        this.d.showHud(true);
        this.ui.setPlaying(true);
        this.save();
        if (tok !== this.token) reject(new Abort());
        else resolve();
      }, opts);
    });
  }

  /* ================================================================ vehicles and chases */

  /** Ride the bicycle to a target (player-controlled). The goat rides in the basket if asked. */
  ride(to: Target, opts: { goat?: boolean; companion?: string } = {}): Promise<void> {
    const b = this.bikeS;
    b.x = this.player.x;
    b.z = this.player.z;
    b.yaw = this.player.yaw;
    b.speed = 0;
    b.prevX = b.x;
    b.prevZ = b.z;
    b.prevYaw = b.yaw;
    this.bike.visible = true;
    this.goatInBasket = !!opts.goat;
    if (opts.goat) {
      this.goat.visible = true;
      this.bike.basket.addChild(this.goat.root);
      this.goat.root.setLocalPosition(0, 0.04, 0);
      this.goat.root.setLocalEulerAngles(0, 0, 0);
      this.goat.root.setLocalScale(0.62, 0.62, 0.62);
    }
    this.mode = "bike";
    this.player.person.rig.pedal = { phase: 0, seatY: BIKE.seatY, crankY: BIKE.crankY, crankZ: BIKE.crankZ, crankR: BIKE.crankR, handZ: BIKE.barZ, handY: BIKE.barY };
    if (opts.companion) {
      const c = this.npc(opts.companion)!;
      c.visible = true;
      this.companion = c;
    }
    return this.wait(() => Math.hypot(b.x - to.pos[0], b.z - to.pos[2]) < 3.2).then(() => {
      this.mode = "play";
      this.player.person.rig.pedal = null;
      this.player.teleport(b.x, b.z, b.yaw);
      // The bike leans on its stand beside you.
      this.bike.root.setPosition(b.x + Math.cos(b.yaw) * 0.9, surfaceHeight(b.x, b.z), b.z - Math.sin(b.yaw) * 0.9);
      this.bike.update(b.dist, 0.12);
      if (this.goatInBasket) {
        this.d.app.root.addChild(this.goat.root);
        this.goat.root.setLocalScale(1, 1, 1);
        this.goat.place(b.x + Math.sin(b.yaw) * 1.6, surfaceHeight(b.x, b.z), b.z + Math.cos(b.yaw) * 1.6, b.yaw);
        this.goatInBasket = false;
      }
      this.companion = null;
    });
  }
  private companion: Person | null = null;

  private stepBike(dt: number, inp: InputState): void {
    const b = this.bikeS;
    b.prevX = b.x;
    b.prevZ = b.z;
    b.prevYaw = b.yaw;
    const throttle = Math.max(0, inp.moveY), brake = Math.max(0, -inp.moveY);
    const top = inp.run && this.stamina > 0.05 ? 7.5 : 5.2;
    b.speed += (throttle * 2.6 - brake * 6 - 0.35 * Math.sign(b.speed)) * dt;
    b.speed = Math.max(0, Math.min(top, b.speed));
    // Steering: tighter when slow, gentle when fast (no snapping).
    const steer = -inp.moveX * (1.6 / (1 + b.speed * 0.25));
    b.yaw += steer * dt * Math.min(1, b.speed / 1.2 + 0.2);
    let nx = b.x + Math.sin(b.yaw) * b.speed * dt, nz = b.z + Math.cos(b.yaw) * b.speed * dt;
    [nx, nz] = this.d.col.resolve(nx, nz, 0.45);
    const moved = Math.hypot(nx - b.x, nz - b.z);
    if (moved < b.speed * dt * 0.5) b.speed *= 0.6; // bumped into something: slow, never stuck
    b.x = nx;
    b.z = nz;
    b.dist += moved;
    b.lean = damp(b.lean, -steer * Math.min(1, b.speed / 4) * 0.25, 6, dt);
    if (inp.run && throttle > 0) this.stamina = Math.max(0, this.stamina - dt * 0.06);
    // The player's own state follows the bike (the camera interpolates it like walking: no jitter).
    this.player.snapPrev();
    this.player.x = b.x;
    this.player.z = b.z;
    this.player.y = surfaceHeight(b.x, b.z);
    this.player.yaw = b.yaw;
    this.player.speed = b.speed;
  }

  private renderBike(alpha: number): void {
    const b = this.bikeS;
    const x = b.prevX + (b.x - b.prevX) * alpha, z = b.prevZ + (b.z - b.prevZ) * alpha;
    const yaw = b.prevYaw + Math.atan2(Math.sin(b.yaw - b.prevYaw), Math.cos(b.yaw - b.prevYaw)) * alpha;
    const y = surfaceHeight(x, z);
    this.bike.root.setPosition(x, y, z);
    this.bike.root.setEulerAngles(0, (yaw * 180) / PI, 0);
    this.bike.update(b.dist, b.lean);
    this.player.person.place(x, y, z, yaw);
    this.player.person.gait(0);
    if (this.player.person.rig.pedal) this.player.person.rig.pedal.phase = this.bike.phase;
    // The companion jogs beside the bike (on the left), at whatever pace the bike sets.
    if (this.companion) {
      const c = this.companion;
      const cp = c.root.getPosition();
      const tx = x + Math.cos(yaw) * 1.4 - Math.sin(yaw) * 0.6, tz = z - Math.sin(yaw) * 1.4 - Math.cos(yaw) * 0.6;
      const dx = tx - cp.x, dz = tz - cp.z, dd = Math.hypot(dx, dz);
      const sp = Math.min(dd * 2.4, 6);
      const step = Math.min(dd, sp * (1 / 60));
      const nx = cp.x + (dd > 1e-3 ? (dx / dd) * step : 0), nz = cp.z + (dd > 1e-3 ? (dz / dd) * step : 0);
      const [rx, rz] = this.d.col.resolve(nx, nz, 0.3);
      c.place(rx, surfaceHeight(rx, rz), rz, dd > 0.3 ? Math.atan2(dx, dz) : yaw);
      c.gait(dd > 0.3 ? sp : 0);
    }
  }

  /* ================================================================ driving */

  /** Driving state (set when the player is behind the wheel of a car / okada / keke). */
  private driving = false;
  private driveKind: "car" | "okada" | "keke" = "car";
  private driveS = { x: 0, z: 0, yaw: 0, speed: 0, steer: 0, brake: 0, gear: 1, prevX: 0, prevZ: 0, prevYaw: 0 };
  private driveTarget: Target | null = null;

  /** Drive a vehicle to a target (player-controlled). Used by missions for car / okada / keke driving. */
  async drive(to: Target, kind: "car" | "okada" | "keke" = "car"): Promise<void> {
    const ent = kind === "car" ? this.car : kind === "okada" ? this.d.carEntity("okada", "#e8742c") : this.keke;
    ent.enabled = true;
    const p = ent.getPosition();
    this.driveS.x = p.x; this.driveS.z = p.z; this.driveS.yaw = ent.getEulerAngles().y * Math.PI / 180;
    this.driveS.speed = 0;
    this.driveKind = kind;
    this.driveTarget = to;
    this.driving = true;
    this.mode = "drive";
    this.player.frozen = true;
    this.ui.setMode(kind.toUpperCase());

    return new Promise<void>((resolve) => {
      const check = () => {
        const d = Math.hypot(this.driveS.x - to.pos[0], this.driveS.z - to.pos[2]);
        if (d < 3.0) {
          this.driving = false;
          this.mode = "play";
          this.player.frozen = false;
          this.player.x = this.driveS.x;
          this.player.z = this.driveS.z;
          this.player.yaw = this.driveS.yaw;
          this.ui.setMode("");
          ent.enabled = false;
          resolve();
        }
      };
      this.driveResolve = resolve;
      this.driveCheck = check;
    });
  }

  private driveResolve: (() => void) | null = null;
  private driveCheck: (() => void) | null = null;

  /** Stop driving and get out. */
  private stopDrive(): void {
    this.driving = false;
    this.mode = "play";
    this.player.frozen = false;
    this.ui.setMode("");
    if (this.driveKind === "car") this.car.enabled = false;
    else if (this.driveKind === "keke") this.keke.enabled = false;
  }

  private stepDrive(dt: number, inp: InputState): void {
    const b = this.driveS;
    b.prevX = b.x;
    b.prevZ = b.z;
    b.prevYaw = b.yaw;

    // Throttle / brake.
    const throttle = Math.max(0, inp.moveY);
    const brake = Math.max(0, -inp.moveY);
    const top = kindTopSpeed(this.driveKind);
    b.speed += (throttle * 3 - brake * 8 - 0.4 * Math.sign(b.speed)) * dt;
    b.speed = Math.max(0, Math.min(top, b.speed));

    // Steering: tighter when slow, gentle when fast.
    const steer = -inp.moveX * (1.8 / (1 + b.speed * 0.3));
    b.steer = steer;
    b.yaw += steer * dt * Math.min(1, b.speed / 1.5 + 0.2);

    let nx = b.x + Math.sin(b.yaw) * b.speed * dt, nz = b.z + Math.cos(b.yaw) * b.speed * dt;
    [nx, nz] = this.d.col.resolve(nx, nz, 0.55);
    const moved = Math.hypot(nx - b.x, nz - b.z);
    if (moved < b.speed * dt * 0.5) b.speed *= 0.6;
    b.x = nx;
    b.z = nz;

    // Place the vehicle entity.
    const ent = b === this.driveS ? null : null;
    const v = this.driveKind === "car" ? this.car : this.driveKind === "keke" ? this.keke : this.d.carEntity("okada", "#e8742c");
    v.setPosition(b.x, surfaceHeight(b.x, b.z), b.z);
    v.setEulerAngles(0, (b.yaw * 180) / PI, 0);

    // Player sits in the driver seat.
    const seatOff: [number, number, number] = this.driveKind === "car" ? [0.5, 0.9, -0.4] : this.driveKind === "okada" ? [0, 0.78, -0.05] : [0.32, 0.62, 0.55];
    const sy = Math.sin(b.yaw), cy = Math.cos(b.yaw);
    this.player.person.place(
      b.x + seatOff[0] * cy - seatOff[2] * sy,
      surfaceHeight(b.x, b.z) + seatOff[1],
      b.z + seatOff[0] * sy + seatOff[2] * cy,
      b.yaw
    );
    this.player.person.gait(0);

    // Check arrival.
    if (this.driveCheck) this.driveCheck();
  }

  private renderDrive(alpha: number): void {
    const b = this.driveS;
    const x = b.prevX + (b.x - b.prevX) * alpha, z = b.prevZ + (b.z - b.prevZ) * alpha;
    const yaw = b.prevYaw + Math.atan2(Math.sin(b.yaw - b.prevYaw), Math.cos(b.yaw - b.prevYaw)) * alpha;
    const y = surfaceHeight(x, z);
    const v = this.driveKind === "car" ? this.car : this.driveKind === "keke" ? this.keke : this.d.carEntity("okada", "#e8742c");
    v.setPosition(x, y, z);
    v.setEulerAngles(0, (yaw * 180) / PI, 0);
  }

  /** Ride the keke as a passenger along a route (skippable with Esc / Space once moving). */
  kekeRide(route: Target[], riders: Person[]): Promise<void> {
    const start = route[0]!.pos;
    const pts: P2[] = route.map((t) => [t.pos[0], t.pos[2]] as P2);
    const path = makePath(pts);
    this.keke.enabled = true;
    let s = 0;
    this.mode = "ride";
    for (const r of riders) r.act("sit");
    const place = () => {
      const p = sample(path, s);
      const yaw = Math.atan2(p.dx, p.dz);
      const y = surfaceHeight(p.x, p.z);
      this.keke.setPosition(p.x, y, p.z);
      this.keke.setEulerAngles(0, (yaw * 180) / PI, 0);
      riders.forEach((r, i) => {
        const side = i === 0 ? 0.32 : -0.32;
        r.place(p.x + Math.cos(yaw) * side - Math.sin(yaw) * 0.45, y + 0.18, p.z - Math.sin(yaw) * side - Math.cos(yaw) * 0.45, yaw);
      });
      return { x: p.x, z: p.z, yaw };
    };
    place();
    void start;
    this.rideTick = (dt, skip) => {
      s = skip ? path.length : Math.min(path.length, s + Math.min(6, 1.5 + s * 0.6) * dt);
      const p = place();
      this.player.x = p.x;
      this.player.z = p.z;
      this.player.yaw = p.yaw;
      return s >= path.length;
    };
    return this.wait(() => this.rideDone).then(() => {
      this.rideDone = false;
      this.rideTick = null;
      this.mode = "play";
      for (const r of riders) r.act("stand");
      this.keke.enabled = false;
    });
  }
  private rideTick: ((dt: number, skip: boolean) => boolean) | null = null;
  private rideDone = false;

  /**
   * The goat chase: Sarki waits at each waypoint until you are close, then
   * trots to the next (never out of sight, never through anything). At the
   * last one it lets itself be caught.
   */
  async chaseGoat(points: Target[], barks: (i: number) => void): Promise<void> {
    this.goat.visible = true;
    const body = this.goatBody();
    for (let i = 0; i < points.length; i++) {
      const pt = points[i]!;
      // Run to the waypoint on a real path (round people, trees and kiosks).
      const q = this.goat.root.getPosition();
      await this.navs.walk(body, { x: q.x, z: q.z, yaw: this.goat.yaw }, [pt.pos], { speed: 4.4, radius: 0.35, allow: ["lawn"] });
      barks(i);
      // Turn round and wait, insultingly, until you are close.
      this.goat.lookT = 2.5;
      const gp = this.goat.root.getPosition();
      if (i < points.length - 1) {
        await this.wait(() => {
          this.goat.animate(1 / 60, 0, this.time);
          this.goat.place(gp.x, gp.y, gp.z, dampAngle(this.goat.yaw, Math.atan2(this.player.x - gp.x, this.player.z - gp.z), 4, 1 / 60));
          return Math.hypot(this.player.x - gp.x, this.player.z - gp.z) < 5;
        });
      }
    }
  }

  /* ================================================================ boosts and stamina */

  useBoost(kind: "turbo" | "zobo" | "kola", secs: number): void {
    this.boosts[kind] = secs;
    this.sfxs.play("pickup");
  }

  /* ================================================================ saving */

  save(): void {
    this.progress.hour = this.hours;
    saveLocal(this.progress);
    void saveCloud(this.progress);
  }

  /* ================================================================ the frame */

  private useNearest(): void {
    const it = this.nearestInteraction();
    if (it) it.onUse();
  }

  /** One interaction targeter (rule K2): the current step's target first, people before things, then nearest in front of you. */
  nearestInteraction(): Interaction | null {
    if (this.mode !== "play") return null;
    let best: Interaction | null = null, bestScore = -Infinity;
    const fx = Math.sin(this.player.yaw), fz = Math.cos(this.player.yaw);
    for (const it of this.interactions) {
      if (it.where() !== this.place) continue;
      const p = it.pos();
      const dx = p[0] - this.player.x, dz = p[2] - this.player.z;
      const d = Math.hypot(dx, dz);
      if (d > it.r) continue;
      const facing = d > 0.01 ? (dx * fx + dz * fz) / d : 1;
      const score = it.priority * 10 + facing * 2 - d;
      if (score > bestScore) {
        bestScore = score;
        best = it;
      }
    }
    return best;
  }

  /** Doors: inside to out, out to in. Registered as interactions with the lowest priority. */
  doorInteractions(): void {
    const doors = worldDoors(this.ctx.female);
    for (const [id, d] of Object.entries(doors)) {
      const plan = byId(id);
      const inside = plan.doors.find((x) => x.to === "world")!;
      const [ix, iz] = toWorld(plan, inside.x, inside.z);
      this.interactions.push({ id: `door:${id}`, label: d.label, r: 2.4, priority: 0, pos: () => d.at, where: () => "world", onUse: () => void this.enterDoor({ pos: [ix, 0, iz], where: id }, inside.yaw).catch(() => undefined) });
      for (const dp of plan.doors) {
        const [wx, wz] = toWorld(plan, dp.x, dp.z);
        if (dp.to === "world") {
          this.interactions.push({ id: `exit:${dp.id}`, label: dp.label, r: 1.6, priority: 0, pos: () => [wx, 0, wz], where: () => id, onUse: () => void this.enterDoor({ pos: d.at, where: "world" }, d.yaw).catch(() => undefined) });
        } else {
          const other = plan.doors.find((x) => x.id === dp.to)!;
          const [ox, oz] = toWorld(plan, other.x, other.z);
          this.interactions.push({ id: `stairs:${dp.id}`, label: dp.label, r: 1.6, priority: 0, pos: () => [wx, 0, wz], where: () => id, onUse: () => void this.enterDoor({ pos: [ox, 0, oz], where: id }, other.yaw).catch(() => undefined) });
        }
      }
    }
  }

  /** Doors survive a new run (they are part of the world, not a mission). */
  keepDoors(): void {
    this.interactions = this.interactions.filter((i) => i.id.startsWith("door:") || i.id.startsWith("exit:") || i.id.startsWith("stairs:"));
    if (!this.interactions.length) this.doorInteractions();
  }

  /** Where the marker should point for a target: the target, or the door that leads towards it. */
  routeTo(t: Target): A3 {
    if (t.where === this.place) {
      // Same interior, different floor (senate hall / basement; SUG hall / basement): point at the stairs.
      if (this.place !== "world") {
        const plan = byId(this.place);
        const [ox, oz] = interiorOrigin(plan);
        const roomOf = (x: number, z: number) => plan.rooms.findIndex((r) => Math.abs(x - ox - r.x) <= r.hx + 0.1 && Math.abs(z - oz - r.z) <= r.hz + 0.1);
        const a = roomOf(this.player.x, this.player.z), b = roomOf(t.pos[0], t.pos[2]);
        if (a !== b && a >= 0 && b >= 0 && plan.rooms.length > 1 && (plan.id === "senate" || plan.id === "sug")) {
          const door = plan.doors.find((d) => d.to !== "world" && roomOf(ox + d.x, oz + d.z) === a);
          if (door) return [ox + door.x, 0, oz + door.z];
        }
      }
      return t.pos;
    }
    if (this.place === "world") return worldDoors(this.ctx.female)[t.where]?.at ?? t.pos;
    const plan = byId(this.place);
    const out = plan.doors.find((d) => d.to === "world")!;
    const [wx, wz] = toWorld(plan, out.x, out.z);
    return [wx, 0, wz];
  }

  private bakeTick = 0;

  /**
   * Ground arrows: keep a walking route from you to the objective (or to the
   * door that leads to it), planned on the navigation grid a little each
   * step, re-planned every 1.5 s and whenever you stray from it.
   */
  private stepGuide(dt: number): void {
    const t = this.mode === "play" && this.guideOn() ? this.objective?.target() ?? null : null;
    const far = !!t && (t.where !== this.place || Math.hypot(t.pos[0] - this.player.x, t.pos[2] - this.player.z) > 15);
    this.guideShow = far;
    if (!t || !far) {
      this.guideSearch = null;
      return;
    }
    const g = this.routeTo(t);
    const goal: NavPoint = [g[0], g[2]];
    const me: NavPoint = [this.player.x, this.player.z];
    this.guideRepath -= dt;
    const strayed = this.guidePath.length > 1 && projectOnPath(this.guidePath, me).d > 3;
    const moved = !this.guideGoal || Math.hypot(goal[0] - this.guideGoal[0], goal[1] - this.guideGoal[1]) > 2;
    if (!this.guideSearch && (this.guideRepath <= 0 || strayed || moved)) {
      const nav = this.navs.nav;
      this.guideSearch = nav.search(nav.nearestWalkable(me[0], me[1]) ?? me, nav.nearestWalkable(goal[0], goal[1], 3) ?? goal);
      this.guideGoal = goal;
      this.guideRepath = 1.5;
      if (moved || strayed) this.guidePath = [];
    }
    if (this.guideSearch && this.guideSearch.step(700)) {
      this.guidePath = this.guideSearch.path ?? [];
      this.guideSearch = null;
    }
  }

  /** The ?debug=1 navigation overlay: the grid round you, every path, stuck agents in red. */
  private drawNavDebug(): void {
    const app = this.d.app;
    const pos: number[] = [], cols: number[] = [];
    this.navs.debugDraw((a, b, c) => {
      pos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      cols.push(c[0], c[1], c[2], 1, c[0], c[1], c[2], 1);
    }, this.player.x, this.player.z);
    if (pos.length) app.drawLineArrays(pos, cols, false);
  }

  /** Fixed-step update (60 Hz): player, walkers, waiters. */
  step(dt: number, inp: InputState): void {
    this.time += dt;
    if (!this.player) return;
    if (this.mode === "bike") this.stepBike(dt, inp);
    else if (this.mode === "ride") {
      if (this.rideTick?.(dt, ["escape", " ", "enter"].some((k) => inp.pressed.has(k)))) this.rideDone = true;
    } else if (this.mode === "combat") {
      this.combat?.enemyTurn(dt);
      // Player can still move in a fight (dodge, close distance).
      this.player.step(dt, { ...inp, moveX: inp.moveX, moveY: inp.moveY, run: false }, this.follow ? this.follow.yaw : 0);
      // Combat: player punch/kick/block input (only when in combat mode).
      if (this.combat) {
        this.combat.playerInput({ punch: inp.punch, kick: inp.kick, block: inp.block });
      }
      // Camera follows the fight.
      if (this.combat && this.follow) {
        const p = this.player.person.root.getPosition();
        const e = this.combat.playerId ? this.fighterPos(this.combat.playerId) : p;
        const camYaw = Math.atan2(e.x - p.x, e.z - p.z);
        this.follow.yaw = dampAngle(this.follow.yaw, camYaw, 3, dt);
      }
    } else if (this.mode === "drive") {
      this.stepDrive(dt, inp);
    } else {
      const free = this.mode === "play";
      const turbo = this.boosts.turbo > 0 ? 1.45 : 1;
      const canRun = this.stamina > 0.04 || this.boosts.zobo > 0;
      const run = inp.run && canRun && !(this.carrying && this.boosts.zobo <= 0);
      this.player.speedMul = (this.carrying ? 0.86 : 1) * turbo;
      if (this.shotFollow && free && !this.autoWalk) this.followLeaderForShots();
      if (this.autoWalk && free) {
        const dx = this.autoWalk.x - this.player.x, dz = this.autoWalk.z - this.player.z, d = Math.hypot(dx, dz);
        // Steer by handing the controller a camera aimed at the spot and "forward" (it walks, animates, collides).
        this.player.step(dt, { ...inp, moveX: 0, moveY: d > 0.15 ? Math.min(1, d * 1.6) : 0, run: false }, d > 0.01 ? Math.atan2(dx, dz) : this.autoWalk.face);
        if (d <= 0.15) this.player.yaw = dampAngle(this.player.yaw, this.autoWalk.face, 10, dt);
      } else if (this.autoWalkOnce && free) {
        const dx = this.autoWalkOnce.x - this.player.x, dz = this.autoWalkOnce.z - this.player.z;
        this.player.step(dt, { ...inp, moveX: 0, moveY: 1, run: false }, Math.atan2(dx, dz));
        this.autoWalkOnce = null;
      } else this.player.step(dt, free ? { ...inp, run } : { ...inp, moveX: 0, moveY: 0, run: false }, this.follow ? (free ? this.follow.moveYaw(inp) : this.follow.yaw) : 0);
      // Stamina: running drains, walking refills; Zobo Max freezes it.
      if (this.boosts.zobo > 0) this.stamina = 1;
      else if (run && this.player.speed > 2.5) this.stamina = Math.max(0, this.stamina - dt * (0.07 + this.progress.stats.stamina * -0.004));
      else this.stamina = Math.min(1, this.stamina + dt * 0.12);
      const where = interiorAt(this.player.x, this.player.z)?.id ?? "world";
      if (where !== this.place) this.setPlace(where);
    }
    for (const k of ["turbo", "zobo", "kola"] as const) this.boosts[k] = Math.max(0, this.boosts[k] - dt);
    // Everyone the story walks: leaders, followers, the goat (navigation grid, avoidance, doors).
    const ob = this.navs.obstacles;
    ob.length = 0;
    for (const c of this.crowdNear) ob.push(c);
    for (const p of this.npcs.values()) {
      if (!p.visible || this.navs.isMoving(this.bodyOf(p))) continue;
      const q = p.root.getPosition();
      ob.push({ x: q.x, z: q.z, r: 0.3 });
    }
    if (this.goat.root.enabled && !this.navs.isMoving(this.goatBody())) {
      const q = this.goat.root.getPosition();
      ob.push({ x: q.x, z: q.z, r: 0.35 });
    }
    this.navs.step(dt);
    this.stepGuide(dt);
    // You and the story's walkers never stand inside each other.
    if ((this.mode === "play" || this.mode === "combat") && this.player.person.visible) {
      const [px, pz] = this.navs.pushOut(this.player.x, this.player.z, 0.33);
      if (px !== this.player.x || pz !== this.player.z) {
        this.player.x = px;
        this.player.z = pz;
      }
    }
    if (this.mode === "play" && ++this.bakeTick % 8 === 0) this.navs.prebake(this.player.x, this.player.z);
    // Resolve waits (in order; a resolved wait is removed).
    const ready = this.waiters.filter((w) => w.check());
    if (ready.length) {
      this.waiters = this.waiters.filter((w) => !ready.includes(w));
      for (const w of ready) {
        if (w.onReady) void w.onReady();
        w.resolve();
      }
    }
  }

  /** Per rendered frame: interpolation, the director, the HUD (marker, minimap, prompt), props, lights. */
  frame(dt: number, alpha: number, inp: InputState): void {
    if (!this.player) return;
    if (this.mode === "bike") this.renderBike(alpha);
    else if (this.mode === "drive") this.renderDrive(alpha);
    else if (this.mode === "combat") {
      // Combat: keep player facing the enemy, render the fighter.
      this.player.person.update(dt);
      this.combat?.render(dt);
    } else if (this.mode !== "cut" && this.mode !== "ride") this.player.render(alpha);
    else if (this.mode !== "cut") this.player.person.update(dt);
    this.d.doors?.update(dt);
    if (this.guideShow && this.guidePath.length > 1) this.guide.show(trailMarks(this.guidePath, [this.player.x, this.player.z], this.time), surfaceHeight, this.time);
    else this.guide.hide();
    // Walkers: placed every rendered frame, interpolated between fixed steps.
    this.navs.render(alpha, dt);
    if (this.navs.debug) this.drawNavDebug();
    for (const p of this.npcs.values()) if (p.visible) {
      // Characters glance at you when you come near (and stop when you leave).
      if (this.mode === "play" && !this.navs.isMoving(this.bodyOf(p))) {
        const q = p.root.getPosition();
        const near = Math.hypot(q.x - this.player.x, q.z - this.player.z) < 3.2;
        p.rig.lookAt = near ? new pc.Vec3(this.player.x, this.player.y + 1.55, this.player.z) : null;
      }
      if (this.mode !== "cut") p.update(dt);
    }
    for (let i = 0; i < this.extrasUsed; i++) this.extras[i]!.update(dt);
    this.statue.update(dt);
    if (this.mode === "cut" && this.director) {
      const skip = ["escape", "enter", " "].some((k) => inp.pressed.has(k));
      this.director.update(dt, skip);
    } else if ((this.mode === "play" || this.mode === "bike" || this.mode === "mini") && this.follow) {
      const pos = this.player.pos(alpha, this.tmpV);
      const speed = this.mode === "bike" ? this.bikeS.speed : this.player.speed;
      this.follow.update(dt, this.mode === "mini" ? { ...inp, lookDX: 0, lookDY: 0, zoom: 0 } : inp, pos, speed, this.player.yaw);
      this.keepCamInside();
      // The coil cracked close by: a small, quick camera shake.
      if (this.shakeT > 0) {
        this.shakeT -= dt;
        const c = this.d.cam.getPosition(), k = this.shakeT * 0.22;
        this.d.cam.setPosition(c.x + (Math.random() - 0.5) * k, c.y + (Math.random() - 0.5) * k, c.z + (Math.random() - 0.5) * k);
      }
    } else if (this.mode === "ride" && this.follow) {
      const pos = this.player.pos(1, this.tmpV);
      this.follow.update(dt, inp, pos, 4, this.player.yaw);
    }
    this.mini.update(dt, { pressed: inp.pressed, moveX: inp.moveX, moveY: inp.moveY, lookDX: inp.lookDX, lookDY: inp.lookDY });
    if (this.ui.choosing) for (const k of inp.pressed) this.ui.key(k);
    if (inp.pressed.has("e") && this.mode === "play") this.useNearest();
    this.hud();
    this.effects(dt);
  }

  private keepCamInside(): void {
    if (this.place === "world") return;
    const c = this.d.cam.getPosition().clone();
    const p = this.player;
    const ip = byId(this.place);
    const [ox, oz] = interiorOrigin(ip);
    const room = ip.rooms.find((r) => Math.abs(p.x - ox - r.x) <= r.hx && Math.abs(p.z - oz - r.z) <= r.hz);
    if (!room) return;
    c.x = Math.max(ox + room.x - room.hx + 0.3, Math.min(ox + room.x + room.hx - 0.3, c.x));
    c.z = Math.max(oz + room.z - room.hz + 0.3, Math.min(oz + room.z + room.hz - 0.3, c.z));
    c.y = Math.min(c.y, room.h - 0.25);
    this.d.cam.setPosition(c);
    this.d.cam.lookAt(p.x, p.y + 1.45, p.z);
  }

  private hud(): void {
    const playing = this.mode === "play" || this.mode === "bike" || this.mode === "combat";
    const it = playing ? this.nearestInteraction() : null;
    this.ui.showPrompt(it ? it.label : null);
    this.ui.setStamina(this.stamina, this.boosts.zobo > 0);
    // Enemy health bar during combat.
    const cbt = this.combat;
    if (this.mode === "combat" && cbt && cbt.playerId) {
      const enemyId = [...cbt.fighters.keys()].find((k) => k !== cbt.playerId) ?? null;
      const h = enemyId ? cbt.healthOf(enemyId) : null;
      if (h !== null && enemyId) this.ui.setEnemyHealth(enemyId, h);
    } else {
      this.ui.setEnemyHealth(null, null);
    }
    const list: { name: string; left: number }[] = [];
    if (this.boosts.turbo > 0) list.push({ name: "Turbo Sneakers", left: this.boosts.turbo });
    if (this.boosts.zobo > 0) list.push({ name: "Zobo Max", left: this.boosts.zobo });
    if (this.boosts.kola > 0) list.push({ name: "Lucky Kola", left: this.boosts.kola });
    this.ui.setBoosts(list);
    const t = playing && this.objective ? this.objective.target() : null;
    const camYaw = this.follow?.yaw ?? 0;
    if (t) {
      const r = this.routeTo(t);
      const d = Math.hypot(r[0] - this.player.x, r[2] - this.player.z);
      this.ui.distance(d, t.where !== this.place ? (this.place === "world" ? "go inside" : "go outside") : t.label);
      // Project the marker (2.2 m above the target, or above the head of a person target).
      const w = new pc.Vec3(r[0], (r[1] || surfaceHeight(r[0], r[2])) + 2.2, r[2]);
      const cam = this.d.cam.camera!;
      const s = cam.worldToScreen(w, new pc.Vec3());
      const fwd = this.d.cam.forward;
      const behind = (w.x - this.d.cam.getPosition().x) * fwd.x + (w.y - this.d.cam.getPosition().y) * fwd.y + (w.z - this.d.cam.getPosition().z) * fwd.z < 0;
      const scale = this.ui.root.clientWidth / (this.d.app.graphicsDevice.width / (this.d.app.graphicsDevice.maxPixelRatio || 1)) || 1;
      void scale;
      this.ui.markerAt(s.x, s.y, behind, d < 1000 ? `${Math.round(d)} m` : "");
      this.ui.minimap(this.player.x, this.player.z, camYaw, this.place === "world" ? r[0] : null, this.place === "world" ? r[2] : null, this.place === "world" ? null : byId(this.place).name);
    } else {
      this.ui.markerAt(null);
      this.ui.distance(null);
      this.ui.minimap(this.player.x, this.player.z, camYaw, null, null, this.place === "world" ? null : byId(this.place).name);
    }
  }

  private effects(dt: number): void {
    // Light presets: torch near the player's hand, candle at the candle, the coil's glow.
    const blackout = ["blackout", "torch", "candle"].includes(this.lightPreset);
    const lp = this.d.cam.getPosition();
    this.torchLight.light!.intensity = this.lightPreset === "torch" ? 1.1 : 0;
    if (this.lightPreset === "torch") {
      const p = this.player.person.root.getPosition();
      this.torchLight.setPosition(p.x + Math.sin(this.player.yaw) * 0.5, p.y + 1.3, p.z + Math.cos(this.player.yaw) * 0.5);
    }
    this.candleLight.light!.intensity = this.lightPreset === "candle" ? 3.2 + Math.sin(this.time * 17) * 0.3 + Math.sin(this.time * 7.3) * 0.25 : 0;
    if (this.candle.enabled) {
      const c = this.candle.getPosition();
      this.candleLight.setPosition(c.x, c.y + 0.35, c.z);
    }
    // The old point light only fills in for the coil's crown now (the coil has its own arc light).
    this.coilLight.light!.intensity = this.coil.state === "dormant" && (this.hours > 19 || this.hours < 5.5) ? 0.5 : 0;
    this.coil.setState(this.coilState());
    this.coil.setSeals(this.sealCount());
    this.coil.cats = this.cats;
    this.coil.update(dt, this.d.cam.getPosition());
    // Its hum: by state, falling off with distance (inaudible past ~35 m; silent indoors).
    {
      const c = this.d.cam.getPosition();
      const d = Math.hypot(c.x - this.coil.x, c.z - this.coil.z);
      const st = this.coil.state;
      const base = st === "lit" ? 1 : st === "humming" ? 0.55 : 0.12;
      const fall = this.place !== "world" ? 0 : 1 / (1 + (d / 6) * (d / 6));
      this.sfxs.coilHum(base * fall, st === "lit");
    }
    // Interior lights follow the preset (off in a blackout; a flicker on cue).
    if (this.flicker > 0) this.flicker = Math.max(0, this.flicker - dt);
    const on = !blackout && !(this.flicker > 0 && Math.sin(this.time * 40) > -0.2 && this.flicker < 1.4);
    for (const bi of this.d.interiors) if (bi.plan.id === this.place) for (const l of bi.lights) l.light!.intensity = on ? 1.6 : 0;
    this.d.mats.get("ilamp").emissiveIntensity = on ? 2.2 : 0.02;
    this.d.mats.get("ilamp").update();
    // The shade drifts down the corridor and thins to nothing.
    if (this.shadeAnim) {
      const a = this.shadeAnim;
      a.t += dt / 9;
      const k = Math.min(1, a.t);
      this.shade.setPosition(a.from[0] + (a.to[0] - a.from[0]) * k, a.from[1] + Math.sin(this.time * 1.3) * 0.05, a.from[2] + (a.to[2] - a.from[2]) * k);
      // Face the camera (a soft billboard), then fade as it thins.
      this.shade.lookAt(lp);
      this.shade.rotateLocal(90, 0, 0);
      if (k >= 1) {
        this.shade.enabled = false;
        this.shadeAnim = null;
      }
    }
    if (this.cats?.enabled) this.cats.children.forEach((c, i) => c.setLocalEulerAngles(0, c.getLocalEulerAngles().y, Math.sin(this.time * 1.4 + i) * 0.6));
  }

  /** Spot the camera can show at the end of a scene to (gameplay camera). */
  get camYaw(): number {
    return this.follow?.yaw ?? 0;
  }

  get gameplayCamPosition(): pc.Vec3 {
    return this.gameplayCamPos;
  }

  /** Inside plan for a place id. */
  interior(where: string): InteriorPlan | null {
    return where === "world" ? null : byId(where);
  }

  get isInside(): boolean {
    return this.place !== "world";
  }

  void(): void {
    void this.cutCb;
  }
}

/* ------------------------------------------------------------ helpers */

export function fill(text: string, c: PlayerCtx): string {
  return text.replace(/\{\{PLAYER_NAME\}\}/g, c.name).replace(/\{\{ROOMIE\}\}/g, c.roomie);
}

const NAMES: [string, [number, number, number]][] = [
  ["white", [244, 241, 234]], ["cream", [233, 228, 216]], ["sky-blue", [134, 183, 224]], ["blue", [42, 95, 168]], ["navy", [31, 60, 102]],
  ["wine", [122, 46, 59]], ["red", [168, 50, 50]], ["green", [47, 138, 76]], ["dark green", [31, 107, 82]], ["mustard", [224, 165, 38]],
  ["orange", [217, 98, 43]], ["purple", [91, 75, 168]], ["black", [43, 43, 43]], ["grey", [86, 96, 106]], ["beige", [201, 184, 150]],
  ["pink", [233, 138, 138]], ["yellow", [242, 194, 48]], ["teal", [62, 142, 158]], ["brown", [138, 90, 58]],
];

/** Plain-English name for a colour, for lines like "that blue shirt". */
export function colourName(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  let best = NAMES[0]!;
  let bd = Infinity;
  for (const n of NAMES) {
    const d = (n[1][0] - r) ** 2 + (n[1][1] - g) ** 2 + (n[1][2] - b) ** 2;
    if (d < bd) {
      bd = d;
      best = n;
    }
  }
  return best[0];
}
