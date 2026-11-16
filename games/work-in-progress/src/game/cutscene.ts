/**
 * In-engine cutscenes, driven by data (game/scenes.ts).
 *
 * A scene is a list of camera shots (moves with easing, cuts, rails), lines
 * of dialogue (speaker, text, voice line id), actor cues (spawn, walk, ride,
 * pose, show, hide), fades and letterbox bars. Lines and shots can depend on
 * who the player is (`when` and text functions get the player's look), so
 * the player's own character and outfit appear exactly as worn.
 *
 * Voices: if a recorded file exists for a line id (voice/index.json lists
 * them) it plays; otherwise the browser's speech voice reads it with a
 * per-character voice, pitch and rate; with neither, subtitles alone.
 *
 * Skipping (Esc, Enter, Space, a tap, or the Skip button) runs every
 * remaining cue's end state, so a skipped scene ends exactly where a watched
 * one does (plan rule A8).
 */
import * as pc from "playcanvas";
import type { CollisionWorld } from "../sim/collide.ts";
import { ease, type EaseName } from "../sim/motion.ts";
import { makePath, sample, type P2, type Path } from "../sim/path.ts";
import type { Look, Person } from "../world/people.ts";
import { ROAD_Y, surfaceHeight } from "../world/surface.ts";

export type V3 = [number, number, number];

/** Who the player is, for branching lines and shots. */
export interface PlayerCtx {
  look: Look;
  female: boolean;
  /** Plain-English colour name of the top the player is wearing. */
  topColour: string;
  roommate: string;
}

export interface Shot {
  at: number;
  dur: number;
  from: V3;
  to?: V3;
  look: V3 | string;
  lookTo?: V3 | string;
  ease?: EaseName;
  fov?: number;
  when?: (c: PlayerCtx) => boolean;
}

export interface Line {
  at: number;
  who: string;
  id: string;
  text: string | ((c: PlayerCtx) => string);
  dur?: number;
  when?: (c: PlayerCtx) => boolean;
}

export type Cue =
  | { at: number; do: "spawn"; actor: string; pos: V3; yaw: number }
  | { at: number; do: "walk"; actor: string; path: P2[]; speed: number }
  | { at: number; do: "ride"; actor: string; path: P2[]; speed: number }
  | { at: number; do: "pose"; actor: string; pose: "idle" | "sit" }
  | { at: number; do: "hide" | "show"; actor: string }
  | { at: number; do: "fade"; to: number; dur: number };

export interface SceneDef {
  id: string;
  letterbox: boolean;
  duration: number;
  shots: Shot[];
  lines: Line[];
  cues: Cue[];
  /** Where the player stands when the scene ends (watched or skipped). */
  end: { player: V3; yaw: number; cameraYaw: number };
}

/** Per-character voice settings for the browser speech fallback. */
export const VOICES: Record<string, { pitch: number; rate: number; prefer: RegExp; female: boolean; name: string }> = {
  DAD: { pitch: 0.82, rate: 0.94, prefer: /(Daniel|Fred|Ralph|Alex|male|en-NG|en-GB)/i, female: false, name: "Dad" },
  MUM: { pitch: 1.18, rate: 1.04, prefer: /(Samantha|Karen|Moira|Tessa|Fiona|female|en-NG|en-GB)/i, female: true, name: "Mum" },
  GUARD: { pitch: 0.7, rate: 0.9, prefer: /(Rishi|Daniel|Alex|male|en-NG)/i, female: false, name: "Gate guard" },
  PLAYER: { pitch: 1.0, rate: 1.0, prefer: /(en-GB|en-US)/i, female: false, name: "You" },
};

/** Actors a scene can move: people and props (the family car). */
export interface Actor {
  entity: pc.Entity;
  person?: Person;
  /** Rides keep their wheels on the road; people follow the surface. */
  kind: "person" | "vehicle";
  path?: Path;
  s?: number;
  speed?: number;
  yaw: number;
  x: number;
  z: number;
}

export interface CutsceneUi {
  letterbox(on: boolean): void;
  subtitle(who: string | null, text: string): void;
  fade(alpha: number): void;
  skipButton(on: boolean, onSkip: () => void): void;
}

export class Cutscene {
  t = 0;
  done = false;
  private shotIdx = -1;
  private lineIdx = 0;
  private cueIdx = 0;
  private fadeFrom = 0;
  private fadeTo = 0;
  private fadeStart = 0;
  private fadeDur = 0;
  private subtitleUntil = 0;
  private lines: Line[];
  private shots: Shot[];
  private voiceFiles: Set<string>;
  private audio: HTMLAudioElement | null = null;
  private lookV = new pc.Vec3();

  constructor(
    private def: SceneDef,
    private ctx: PlayerCtx,
    private actors: Map<string, Actor>,
    private cam: pc.Entity,
    private ui: CutsceneUi,
    private col: CollisionWorld,
    voiceFiles: string[],
    private voiceOn: boolean,
    private onEnd: (def: SceneDef) => void,
  ) {
    this.lines = def.lines.filter((l) => !l.when || l.when(ctx)).sort((a, b) => a.at - b.at);
    this.shots = def.shots.filter((s) => !s.when || s.when(ctx)).sort((a, b) => a.at - b.at);
    this.voiceFiles = new Set(voiceFiles);
    def.cues.sort((a, b) => a.at - b.at);
    ui.letterbox(def.letterbox);
    ui.skipButton(true, () => this.skip());
  }

  private point(p: V3 | string): V3 {
    if (typeof p !== "string") return p;
    const a = this.actors.get(p);
    if (!a) return [0, 1.5, 0];
    const e = a.entity.getPosition();
    return [e.x, e.y + (a.kind === "person" ? 1.45 : 1.0), e.z];
  }

  private say(l: Line): void {
    const text = typeof l.text === "function" ? l.text(this.ctx) : l.text;
    const v = VOICES[l.who];
    const name = v?.name ?? l.who;
    const words = text.split(/\s+/).length;
    this.subtitleUntil = this.t + (l.dur ?? Math.max(2.2, words * 0.42 + 1));
    this.ui.subtitle(name, text);
    if (!this.voiceOn) return;
    try {
      this.audio?.pause();
      speechSynthesis?.cancel();
      if (this.voiceFiles.has(l.id)) {
        this.audio = new Audio(`voice/${l.id}.mp3`);
        void this.audio.play().catch(() => undefined);
      } else if (typeof speechSynthesis !== "undefined" && v) {
        const u = new SpeechSynthesisUtterance(text);
        const voices = speechSynthesis.getVoices().filter((x) => /^en/i.test(x.lang));
        const pick = voices.find((x) => v.prefer.test(x.name) || v.prefer.test(x.lang)) ?? voices[0];
        if (pick) u.voice = pick;
        u.pitch = v.pitch;
        u.rate = v.rate;
        u.volume = 0.9;
        speechSynthesis.speak(u);
      }
    } catch {
      /* subtitles only */
    }
  }

  private runCue(c: Cue): void {
    if (c.do === "fade") {
      this.fadeFrom = this.currentFade();
      this.fadeTo = c.to;
      this.fadeStart = this.t;
      this.fadeDur = c.dur;
      return;
    }
    const a = this.actors.get(c.actor);
    if (!a) return;
    switch (c.do) {
      case "spawn":
        a.entity.enabled = true;
        a.x = c.pos[0];
        a.z = c.pos[2];
        a.yaw = c.yaw;
        a.path = undefined;
        a.entity.setPosition(c.pos[0], a.kind === "person" ? surfaceHeight(c.pos[0], c.pos[2]) : c.pos[1], c.pos[2]);
        a.entity.setEulerAngles(0, (c.yaw * 180) / Math.PI, 0);
        break;
      case "walk":
      case "ride":
        a.path = makePath(c.path);
        a.s = 0;
        a.speed = c.speed;
        break;
      case "pose":
        a.person?.pose(c.pose);
        break;
      case "hide":
        a.entity.enabled = false;
        break;
      case "show":
        a.entity.enabled = true;
        break;
    }
  }

  private currentFade(): number {
    if (this.fadeDur <= 0) return this.fadeTo;
    const k = Math.min(1, (this.t - this.fadeStart) / this.fadeDur);
    return this.fadeFrom + (this.fadeTo - this.fadeFrom) * ease.sine(k);
  }

  update(dt: number, skipPressed: boolean): void {
    if (this.done) return;
    if (skipPressed) return this.skip();
    this.t += dt;
    while (this.cueIdx < this.def.cues.length && this.def.cues[this.cueIdx]!.at <= this.t) this.runCue(this.def.cues[this.cueIdx++]!);
    while (this.lineIdx < this.lines.length && this.lines[this.lineIdx]!.at <= this.t) this.say(this.lines[this.lineIdx++]!);
    if (this.t > this.subtitleUntil) this.ui.subtitle(null, "");
    this.ui.fade(this.currentFade());

    // Actors on paths.
    for (const a of this.actors.values()) {
      if (!a.path || !a.entity.enabled) continue;
      const remaining = a.path.length - (a.s ?? 0);
      // Ease to a stop over the last few metres (no sudden halt).
      const v = Math.min(a.speed ?? 1, Math.max(0.6, remaining * 1.2));
      a.s = Math.min(a.path.length, (a.s ?? 0) + v * dt);
      const p = sample(a.path, a.s);
      a.x = p.x;
      a.z = p.z;
      a.yaw = Math.atan2(p.dx, p.dz);
      const y = a.kind === "person" ? surfaceHeight(p.x, p.z) : ROAD_Y;
      a.entity.setPosition(p.x, y, p.z);
      a.entity.setEulerAngles(0, (a.yaw * 180) / Math.PI, 0);
      const moving = a.s < a.path.length - 0.01;
      a.person?.gait(moving ? v : 0);
      if (!moving) a.path = undefined;
    }

    // Camera: the shot whose start time has passed most recently.
    let idx = -1;
    for (let i = 0; i < this.shots.length; i++) if (this.shots[i]!.at <= this.t) idx = i;
    if (idx >= 0) {
      const s = this.shots[idx]!;
      this.shotIdx = idx;
      const k = (ease[s.ease ?? "inOut"])(Math.min(1, (this.t - s.at) / s.dur));
      const to = s.to ?? s.from;
      const pos: V3 = [s.from[0] + (to[0] - s.from[0]) * k, s.from[1] + (to[1] - s.from[1]) * k, s.from[2] + (to[2] - s.from[2]) * k];
      const la = this.point(s.look), lb = this.point(s.lookTo ?? s.look);
      // Never inside geometry: lift the camera above anything it would be inside.
      for (const c of this.col.near(pos[0], pos[2])) if ((c.h ?? 0) > pos[1] && this.col.blocked(pos[0], pos[2], 0.3)) pos[1] = (c.h ?? 0) + 1;
      pos[1] = Math.max(pos[1], surfaceHeight(pos[0], pos[2]) + 0.4);
      this.cam.setPosition(pos[0], pos[1], pos[2]);
      this.lookV.set(la[0] + (lb[0] - la[0]) * k, la[1] + (lb[1] - la[1]) * k, la[2] + (lb[2] - la[2]) * k);
      this.cam.lookAt(this.lookV);
      if (s.fov && this.cam.camera) this.cam.camera.fov = s.fov;
    }
    void this.shotIdx;
    if (this.t >= this.def.duration) this.finish();
  }

  /** Jump to the end state: run every remaining cue and finish. */
  skip(): void {
    while (this.cueIdx < this.def.cues.length) this.runCue(this.def.cues[this.cueIdx++]!);
    for (const a of this.actors.values()) {
      if (!a.path) continue;
      const p = sample(a.path, a.path.length);
      a.entity.setPosition(p.x, a.kind === "person" ? surfaceHeight(p.x, p.z) : ROAD_Y, p.z);
      a.path = undefined;
    }
    this.finish();
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    try {
      this.audio?.pause();
      speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
    this.ui.subtitle(null, "");
    this.ui.letterbox(false);
    this.ui.fade(0);
    this.ui.skipButton(false, () => undefined);
    this.onEnd(this.def);
  }
}
