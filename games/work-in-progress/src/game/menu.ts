/**
 * The front end: a console-launcher style title and menu over the live campus.
 *
 *   title     the logo reveal over a slow golden-hour flight across the quad
 *             and the clock tower, then "Press any key / tap to start"
 *   main      Continue · New game · Missions (once unlocked) · Settings · Credits
 *   creator   your fresher on a turntable in good light, with tabs:
 *             Identity (young man / young woman, name), Skin, Hair, Outfit
 *             (style, top, bottom, shoes, head: cap or hijab), a randomise
 *             button and camera zoom to the face or the outfit
 *   settings  graphics quality, sound and voice volume, subtitles, computer
 *             voices, reduced motion, the controls
 *   credits   who made what (CREDITS.md in short)
 *   missions  the missions you have passed, to replay
 *
 * Keyboard (arrows / WASD, Enter, Esc), gamepad (d-pad or stick, A, B) and
 * touch all work. Every target is at least 44 px. Hover and focus make a soft
 * click (after the first key press unlocks sound). Works at 375 px wide.
 */
import * as pc from "playcanvas";
import type { StoryMission } from "../story/parse.ts";
import { catmull } from "../sim/motion.ts";
import { CLOTH, type CharModel, FEMALE_MODELS, HAIR, type Look, MALE_MODELS, Person, clothingSlots, SKIN_TONES } from "../world/people.ts";
import { surfaceHeight } from "../world/surface.ts";
import { GAME_NAME, defaultLook, loadLook, saveLook } from "./hud.ts";
import type { Progress } from "./save.ts";

export interface MenuSettings {
  quality: "auto" | "low" | "medium" | "high";
  soundVolume: number;
  voiceVolume: number;
  subtitles: boolean;
  /** Glowing arrows on the ground along the way to the objective. */
  groundArrows: boolean;
  voices: boolean;
  reducedMotion: boolean;
}

const SETTINGS_KEY = "wip-settings";

export function loadSettings(): MenuSettings {
  const base: MenuSettings = { quality: "auto", soundVolume: 0.8, voiceVolume: 0.9, subtitles: true, groundArrows: true, voices: true, reducedMotion: matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...base, ...(JSON.parse(raw) as Partial<MenuSettings>) };
  } catch {
    /* private mode */
  }
  return base;
}

function saveSettings(s: MenuSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------ names for every swatch */

const SKIN_NAMES = ["Ebony", "Deep brown", "Chestnut", "Mahogany", "Cocoa", "Bronze", "Caramel", "Honey", "Sand", "Ivory"];
const HAIR_NAMES = ["Jet black", "Soft black", "Dark brown", "Chestnut brown", "Blue-black"];
const CLOTH_NAMES = ["White", "Cream", "Sky blue", "Royal blue", "Navy", "Wine", "Red", "Green", "Forest", "Mustard", "Orange", "Purple", "Black", "Slate", "Khaki", "Rose", "Yellow", "Teal", "Brown", "Stone"];
export const MODEL_LABEL: Record<string, string> = {
  casual: "Tee and jeans", hoodie: "Hoodie", business: "Smart suit", man: "Polo and chinos", manlong: "Long sleeves", mansuit: "Kaftan", farmer: "Overalls",
  animwoman: "Casual", womandress: "Long dress", womancasual: "Top and trousers",
};

/**
 * What each clothing slot of each model is, so the outfit tab can name them
 * ("Top", "Trousers", "Shoes"); see the slot lists in assets/people/index.json.
 */
export const SLOT_ROLE: Record<string, ("top" | "bottom" | "shoes" | "trim" | "socks")[]> = {
  casual: ["top", "trim", "bottom", "shoes"],
  hoodie: ["top", "trim", "bottom"],
  business: ["top", "trim", "trim", "trim"],
  man: ["trim", "top", "bottom", "shoes", "socks"],
  manlong: ["top", "bottom"],
  mansuit: ["top", "bottom"],
  farmer: ["top", "trim", "bottom", "trim", "trim"],
  animwoman: ["top", "bottom", "trim", "shoes"],
  womandress: ["top", "trim", "trim"],
  womancasual: ["top", "bottom", "shoes", "socks"],
};

const TIPS = [
  "Mama Nkechi always knows when you haven't eaten. Don't lie to her.",
  "The Amana Clock has said 6:06 since before anyone's uncle came here.",
  "Freshers go to the wrong Twin Theatre once. It's tradition.",
  "Sit. Tea first, gist second. Nobody pays until they stand.",
  "Carry water. Carry a pen. Carry yourself.",
  "If you see a crowd after eight, somebody is sharing something free.",
  "Garri takes cold water. Hot water and you've made eba by accident.",
  "KB prices by face. Wear a good one.",
];

const css = `
@font-face{font-family:"Bricolage Display";src:url("./fonts/bricolage-800-latin.woff2") format("woff2");font-weight:800;font-display:swap}
.mn{position:absolute;inset:0;pointer-events:auto;font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#fffaf0;overflow:hidden}
.mn *{box-sizing:border-box}
.mn-vig{position:absolute;inset:0;pointer-events:none;background:radial-gradient(120% 90% at 50% 45%,rgba(0,0,0,0) 45%,rgba(6,8,12,.55) 80%,rgba(6,8,12,.85) 100%),linear-gradient(180deg,rgba(10,12,18,.25),rgba(10,12,18,0) 30%,rgba(10,12,18,0) 60%,rgba(10,12,18,.55))}
.mn-scrim{position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,rgba(8,10,16,.72) 0%,rgba(8,10,16,.38) 34%,rgba(8,10,16,0) 58%);opacity:0;transition:opacity .6s}
.mn.scrim .mn-scrim{opacity:1}
.mn-screen{position:absolute;inset:0;opacity:0;transform:translateY(10px);filter:blur(6px);transition:opacity .5s cubic-bezier(.2,.8,.2,1),transform .5s cubic-bezier(.2,.8,.2,1),filter .5s;pointer-events:none}
.mn-screen.on{opacity:1;transform:none;filter:none;pointer-events:auto}
.mn-logo{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);text-align:center;width:min(920px,92vw);padding:40px 20px}
.mn-logo::before{content:"";position:absolute;inset:-20% -10%;z-index:-1;background:radial-gradient(closest-side,rgba(8,10,16,.55),rgba(8,10,16,0));pointer-events:none}
.mn-logo h1{margin:0;font:800 clamp(44px,9.5vw,112px)/.92 "Bricolage Display",system-ui,sans-serif;letter-spacing:-.035em;background:linear-gradient(100deg,#fff4d6 0%,#f2b33d 42%,#e8742c 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 6px 30px rgba(232,116,44,.35))}
.mn-logo h1 span{display:inline-block;opacity:0;transform:translateY(.35em) scale(.96);filter:blur(10px);transition:all .9s cubic-bezier(.16,1,.3,1)}
.mn-logo.reveal h1 span{opacity:1;transform:none;filter:none}
.mn-logo p{margin:14px 0 0;font-size:clamp(15px,2.1vw,20px);color:rgba(255,250,240,.86);letter-spacing:.01em;opacity:0;transition:opacity 1s .9s}
.mn-logo.reveal p{opacity:1}
.mn-rule{width:0;height:2px;margin:18px auto 0;background:linear-gradient(90deg,transparent,#f2b33d,transparent);transition:width 1.2s .5s cubic-bezier(.16,1,.3,1)}
.mn-logo.reveal .mn-rule{width:min(420px,70vw)}
.mn-press{position:absolute;left:50%;bottom:14%;transform:translateX(-50%);font-weight:800;letter-spacing:.32em;text-transform:uppercase;font-size:13px;color:#fff;opacity:0;transition:opacity .8s 1.6s;white-space:nowrap}
.mn-screen.on .mn-press{opacity:1;animation:mnPulse 2.4s 2.4s ease-in-out infinite}
@keyframes mnPulse{0%,100%{opacity:1}50%{opacity:.35}}
.mn-badge{display:inline-block;margin-top:14px;padding:4px 10px;border-radius:99px;border:1px solid rgba(242,179,61,.6);color:#f2b33d;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
.mn-side{position:absolute;left:clamp(16px,6vw,84px);top:50%;transform:translateY(-50%);width:min(380px,calc(100vw - 32px))}
.mn-side .mn-mini{font:800 clamp(30px,5vw,46px)/.95 "Bricolage Display",system-ui;letter-spacing:-.03em;margin:0 0 6px;background:linear-gradient(100deg,#fff4d6,#f2b33d 50%,#e8742c);-webkit-background-clip:text;background-clip:text;color:transparent}
.mn-side .mn-sub{margin:0 0 22px;color:rgba(255,250,240,.75)}
.mn-item{display:flex;align-items:center;gap:14px;width:100%;min-height:54px;margin:6px 0;padding:12px 18px;border-radius:16px;border:1px solid rgba(255,255,255,.14);background:rgba(16,20,28,.66);backdrop-filter:blur(14px) saturate(1.2);-webkit-backdrop-filter:blur(14px) saturate(1.2);color:#fffaf0;font:800 18px/1 "Bricolage Display",system-ui;letter-spacing:-.01em;text-align:left;cursor:pointer;opacity:0;transform:translateX(-14px);transition:transform .45s cubic-bezier(.16,1,.3,1),opacity .45s,background .2s,border-color .2s,box-shadow .2s}
.mn-screen.on .mn-item{opacity:1;transform:none}
.mn-item small{margin-left:auto;font:600 12px system-ui;color:rgba(255,250,240,.6);letter-spacing:0}
.mn-item:hover,.mn-item:focus-visible,.mn-item.sel{outline:none;background:linear-gradient(100deg,rgba(242,179,61,.95),rgba(232,116,44,.95));border-color:transparent;color:#1b1408;box-shadow:0 10px 30px rgba(232,116,44,.35);transform:translateX(6px)}
.mn-item:hover small,.mn-item.sel small,.mn-item:focus-visible small{color:rgba(27,20,8,.7)}
.mn-item[disabled]{opacity:.55!important;cursor:default;filter:saturate(.4)}
.mn-hint{position:absolute;right:clamp(16px,4vw,40px);bottom:20px;display:flex;gap:14px;font-size:12px;color:rgba(255,250,240,.7)}
.mn-hint kbd{display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 6px;margin-right:5px;border-radius:6px;background:rgba(255,255,255,.16);font:800 11px system-ui;color:#fff}
.mn-panel{position:absolute;top:0;bottom:0;left:0;width:min(520px,100vw);display:flex;flex-direction:column;background:linear-gradient(180deg,rgba(14,17,24,.82),rgba(14,17,24,.7));backdrop-filter:blur(18px) saturate(1.2);-webkit-backdrop-filter:blur(18px) saturate(1.2);border-right:1px solid rgba(255,255,255,.08);box-shadow:20px 0 60px rgba(0,0,0,.35)}
.mn-panel header{padding:22px 22px 10px}
.mn-panel header h2{margin:0;font:800 30px/1 "Bricolage Display",system-ui;letter-spacing:-.02em}
.mn-panel header p{margin:6px 0 0;color:rgba(255,250,240,.7);font-size:14px}
.mn-tabs{display:flex;gap:6px;padding:8px 22px 0;overflow-x:auto;scrollbar-width:none}
.mn-tab{flex:0 0 auto;min-height:44px;padding:10px 16px;border-radius:12px;border:0;background:transparent;color:rgba(255,250,240,.7);font:800 14px system-ui;cursor:pointer;border-bottom:3px solid transparent}
.mn-tab[aria-selected="true"]{color:#fff;border-bottom-color:#f2b33d;background:rgba(255,255,255,.06)}
.mn-body{flex:1;overflow-y:auto;padding:12px 22px 18px}
.mn-label{margin:16px 0 8px;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#f2b33d}
.mn-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px}
.mn-grid.wide{grid-template-columns:repeat(auto-fill,minmax(140px,1fr))}
.mn-sw{position:relative;min-height:64px;padding:8px 8px 8px 8px;border-radius:14px;border:2px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#fffaf0;cursor:pointer;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-end;gap:6px;text-align:left;font:700 13px/1.15 system-ui;transition:border-color .15s,transform .15s,background .15s}
.mn-sw i{display:block;width:100%;height:26px;border-radius:9px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)}
.mn-sw:hover,.mn-sw:focus-visible{outline:none;transform:translateY(-2px);border-color:rgba(255,255,255,.35)}
.mn-sw[aria-pressed="true"]{border-color:#f2b33d;background:rgba(242,179,61,.14);box-shadow:0 0 0 1px #f2b33d inset}
.mn-sw.card{min-height:58px;justify-content:center;font-size:15px}
.mn-field{width:100%;min-height:48px;padding:10px 14px;border-radius:12px;border:2px solid rgba(255,255,255,.14);background:rgba(0,0,0,.25);color:#fff;font:700 17px system-ui}
.mn-field:focus{outline:none;border-color:#f2b33d}
.mn-foot{display:flex;gap:10px;padding:14px 22px calc(14px + env(safe-area-inset-bottom));border-top:1px solid rgba(255,255,255,.08);background:rgba(10,12,16,.4)}
.mn-btn{min-height:50px;padding:12px 18px;border-radius:14px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07);color:#fff;font:800 15px system-ui;cursor:pointer}
.mn-btn:hover,.mn-btn:focus-visible{outline:none;border-color:rgba(255,255,255,.5)}
.mn-btn.primary{flex:1;border:0;background:linear-gradient(100deg,#f2b33d,#e8742c);color:#1b1408;font:800 19px "Bricolage Display",system-ui;box-shadow:0 10px 30px rgba(232,116,44,.35)}
.mn-zoom{position:absolute;right:clamp(14px,3vw,30px);top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:8px}
.mn-zoom button{min-width:96px;min-height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.25);background:rgba(14,17,24,.55);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#fff;font:800 13px system-ui;cursor:pointer}
.mn-zoom button[aria-pressed="true"]{background:#f2b33d;color:#1b1408;border-color:transparent}
.mn-row{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:56px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.07)}
.mn-row b{font-weight:800}
.mn-row small{display:block;color:rgba(255,250,240,.6);font-weight:500}
.mn-seg{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}
.mn-seg button{min-height:44px;min-width:56px;padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.05);color:#fff;font:800 13px system-ui;cursor:pointer}
.mn-seg button[aria-pressed="true"]{background:#f2b33d;color:#1b1408;border-color:transparent}
.mn-range{width:150px;accent-color:#f2b33d;height:44px}
.mn-cred p{margin:0 0 12px;color:rgba(255,250,240,.8);font-size:14px}
.mn-cred b{color:#fff}
.mn-keys{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:14px;color:rgba(255,250,240,.85)}
.mn-keys kbd{display:inline-block;min-width:26px;padding:3px 8px;border-radius:7px;background:rgba(255,255,255,.14);font:800 12px system-ui;color:#fff;text-align:center}
@media (max-width:640px){
 .mn-panel{width:100vw;top:auto;height:58vh;border-right:0;border-top:1px solid rgba(255,255,255,.1);border-radius:22px 22px 0 0;bottom:0}
 .mn-zoom{top:16px;transform:none;flex-direction:row;right:12px}
 .mn-zoom button{min-width:72px}
 .mn-side{top:auto;bottom:22px;transform:none}
 .mn-logo{top:30%}
 .mn-hint{display:none}
}
@media (prefers-reduced-motion:reduce){.mn-screen,.mn-item,.mn-logo h1 span{transition:none!important}.mn-grain{animation:none}}
.mn.reduced .mn-screen,.mn.reduced .mn-item,.mn.reduced .mn-logo h1 span{transition:none!important}
.mn.reduced .mn-grain{animation:none}
.mn.reduced .mn-press,.mn.reduced .mn-logo p,.mn.reduced .mn-rule{transition:none!important;animation:none!important}
`;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

type Screen = "title" | "main" | "creator" | "settings" | "credits" | "missions" | "loading";

/** Where the creator's turntable stands: the quad lawn, the flame trees and the Senate dome behind. */
const STAGE = { x: -16, z: -172, yaw: 0 };

/** The golden-hour drift behind the title and the menu (position, look-at). */
const DRIFT: [number, number, number, number, number, number][] = [
  [-26, 7, -148, 0, 14, -205],
  [-8, 5.5, -140, 0, 16, -128],
  [14, 9, -156, -4, 8, -200],
  [30, 12, -186, 0, 12, -226],
  [6, 14, -112, 0, 18, -128],
  [-22, 8, -134, -6, 10, -176],
];

export interface MenuOptions {
  story: StoryMission[];
  debug: boolean;
  onPlay: (look: Look, name: string, fresh: boolean, replay?: string) => void;
}

export class Menu {
  private root = el("div", "mn");
  private screens = new Map<Screen, HTMLElement>();
  private current: Screen = "title";
  private look: Look;
  private name: string;
  private preview: Person | null = null;
  private yaw = 0;
  private zoom: "full" | "face" | "outfit" = "full";
  private t = 0;
  private camPos = new pc.Vec3();
  private camLook = new pc.Vec3();
  private audio: AudioContext | null = null;
  private focusList: HTMLElement[] = [];
  private focusIdx = 0;
  private padPrev = new Set<string>();
  private keyHandler: (e: KeyboardEvent) => void;
  private dragging = false;
  private lastX = 0;
  private frozen = false;
  private tab = "identity";

  constructor(private host: HTMLElement, private app: pc.AppBase, private cam: pc.Entity, private people: CharModel[], private settings: MenuSettings, private progress: Progress, private opts: MenuOptions) {
    const style = el("style");
    style.textContent = css;
    document.head.append(style);
    if (settings.reducedMotion || new URLSearchParams(location.search).get("shot") === "1") this.root.classList.add("reduced");
    this.look = loadLook();
    this.name = progress.name && progress.name !== "Fresher" ? progress.name : this.look.model && FEMALE_MODELS.includes(this.look.model) ? "Amina" : "Musa";
    this.root.append(el("div", "mn-vig"), el("div", "mn-scrim"));
    this.host.append(this.root);
    this.buildTitle();
    this.buildMain();
    this.keyHandler = (e) => this.onKey(e);
    window.addEventListener("keydown", this.keyHandler);
    this.root.addEventListener("pointerdown", (e) => {
      if (this.current === "title") {
        e.preventDefault();
        this.unlock();
        this.showScreen("main");
      } else if (this.current === "creator" && (e.target as HTMLElement).tagName === "DIV" && (e.target as HTMLElement).classList.contains("mn-screen")) {
        this.dragging = true;
        this.lastX = e.clientX;
      }
    });
    window.addEventListener("pointerup", () => (this.dragging = false));
    window.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      this.yaw += (e.clientX - this.lastX) * 0.012;
      this.lastX = e.clientX;
    });
    if (this.cam.camera) this.cam.camera.fov = 42;
  }

  /* ------------------------------------------------------------ sound */

  private unlock(): void {
    if (this.audio) return;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audio = new Ctx();
    } catch {
      this.audio = null;
    }
  }

  private blip(kind: "move" | "ok" | "back"): void {
    const c = this.audio;
    if (!c || this.settings.soundVolume <= 0) return;
    const o = c.createOscillator(), g = c.createGain();
    const f = kind === "ok" ? 880 : kind === "back" ? 330 : 620;
    o.type = "triangle";
    o.frequency.setValueAtTime(f, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(kind === "back" ? f * 0.7 : f * 1.25, c.currentTime + 0.08);
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.06 * this.settings.soundVolume, c.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.12);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.14);
  }

  /* ------------------------------------------------------------ screens */

  private screen(id: Screen): HTMLElement {
    let s = this.screens.get(id);
    if (!s) {
      s = el("div", "mn-screen");
      this.screens.set(id, s);
      this.root.append(s);
    }
    return s;
  }

  showScreen(id: Screen): void {
    if (id === "creator") this.buildCreator();
    if (id === "settings") this.buildSettings();
    if (id === "credits") this.buildCredits();
    if (id === "missions") this.buildMissions();
    if (id === "main") this.buildMain();
    if (id === "loading") this.buildLoading();
    for (const [k, s] of this.screens) s.classList.toggle("on", k === id);
    this.root.classList.toggle("scrim", id !== "title");
    this.current = id;
    if (id === "title") setTimeout(() => this.screens.get("title")?.querySelector(".mn-logo")?.classList.add("reveal"), 120);
    if (this.preview) this.preview.visible = id === "creator";
    if (id === "creator") this.ensurePreview();
    this.focusList = [...(this.screens.get(id)?.querySelectorAll<HTMLElement>(".mn-item:not([disabled]), .mn-btn, .mn-tab") ?? [])];
    this.focusIdx = 0;
    if (id === "main") this.select(0);
  }

  private select(i: number): void {
    if (!this.focusList.length) return;
    this.focusIdx = (i + this.focusList.length) % this.focusList.length;
    this.focusList.forEach((e, k) => e.classList.toggle("sel", k === this.focusIdx));
    this.focusList[this.focusIdx]!.focus({ preventScroll: true });
  }

  private buildTitle(): void {
    const s = this.screen("title");
    s.innerHTML = "";
    const logo = el("div", "mn-logo");
    const h = el("h1");
    GAME_NAME.split(" ").forEach((w, i) => {
      const span = el("span", "", w);
      span.style.transitionDelay = `${0.15 + i * 0.18}s`;
      h.append(span, document.createTextNode(i < 2 ? " " : ""));
    });
    logo.append(h, el("div", "mn-rule"), el("p", "", "Freshers' week. Make yourself at home."), el("span", "mn-badge", "Early build"));
    s.append(logo, el("div", "mn-press", matchMedia("(pointer: coarse)").matches ? "Tap to start" : "Press any key to start"));
  }

  private buildMain(): void {
    const s = this.screen("main");
    s.innerHTML = "";
    const side = el("div", "mn-side");
    side.append(el("div", "mn-mini", GAME_NAME), el("p", "mn-sub", "Year 1 · Arriving"));
    const has = this.progress.done.length > 0 || !!this.progress.current;
    const item = (label: string, sub: string, f: () => void, disabled = false) => {
      const b = el("button", "mn-item");
      b.type = "button";
      b.append(el("span", "", label), el("small", "", sub));
      if (disabled) b.disabled = true;
      b.onclick = () => {
        this.blip("ok");
        f();
      };
      b.onmouseenter = () => {
        this.blip("move");
        const i = this.focusList.indexOf(b);
        if (i >= 0) this.select(i);
      };
      b.style.transitionDelay = `${side.querySelectorAll(".mn-item").length * 0.06}s`;
      side.append(b);
    };
    if (has) item("Continue", `${this.progress.name} · ${this.progress.done.length}/10`, () => this.opts.onPlay(loadLook(), this.progress.name, false));
    item("New game", has ? "Start Year 1 again" : "Make your fresher", () => this.showScreen("creator"));
    item("Missions", this.progress.done.length ? `${this.progress.done.length} passed` : "Locked until Mission 1", () => this.showScreen("missions"), !this.progress.done.length);
    item("Settings", "Sound, voices, graphics", () => this.showScreen("settings"));
    item("Credits", "Who made what", () => this.showScreen("credits"));
    s.append(side, hints());
  }

  private buildLoading(): void {
    const s = this.screen("loading");
    s.innerHTML = "";
    const box = el("div", "mn-logo");
    box.append(el("h1", "", "Loading"), el("p", "", TIPS[Math.floor(Math.random() * TIPS.length)]!));
    box.classList.add("reveal");
    s.append(box);
  }

  /* ------------------------------------------------------------ the creator */

  private female(): boolean {
    return FEMALE_MODELS.includes(this.look.model);
  }

  private ensurePreview(): void {
    if (this.preview) this.preview.destroy();
    const cm = this.people.find((p) => p.key === this.look.model) ?? this.people[0]!;
    // Outfit arrays must match the model's slot count.
    const n = clothingSlots(cm.info);
    while (this.look.outfit.length < n) this.look.outfit.push(this.look.outfit[this.look.outfit.length - 1] ?? "#2b2b2b");
    this.preview = new Person(this.app, cm, this.look, this.app.root);
    this.preview.place(STAGE.x, surfaceHeight(STAGE.x, STAGE.z), STAGE.z, this.yaw);
    this.preview.visible = this.current === "creator";
  }

  private buildCreator(): void {
    const s = this.screen("creator");
    s.innerHTML = "";
    const panel = el("div", "mn-panel");
    const head = el("header");
    head.append(el("h2", "", "Your fresher"), el("p", "", "One story for everyone. Your look, your name, your way."));
    const tabs = el("div", "mn-tabs");
    tabs.setAttribute("role", "tablist");
    const body = el("div", "mn-body");
    const TABS: [string, string][] = [["identity", "Identity"], ["skin", "Face and skin"], ["hair", "Hair"], ["outfit", "Outfit"]];
    const drawTab = () => {
      body.innerHTML = "";
      tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === this.tab)));
      if (this.tab === "identity") this.tabIdentity(body);
      if (this.tab === "skin") this.tabSkin(body);
      if (this.tab === "hair") this.tabHair(body);
      if (this.tab === "outfit") this.tabOutfit(body);
    };
    for (const [id, label] of TABS) {
      const b = el("button", "mn-tab", label);
      b.type = "button";
      b.dataset.tab = id;
      b.setAttribute("role", "tab");
      b.onclick = () => {
        this.blip("move");
        this.tab = id;
        this.zoom = id === "skin" || id === "hair" ? "face" : id === "outfit" ? "outfit" : "full";
        drawTab();
        this.drawZoom(zoom);
      };
      tabs.append(b);
    }
    const foot = el("div", "mn-foot");
    const back = el("button", "mn-btn", "Back");
    back.onclick = () => {
      this.blip("back");
      this.showScreen("main");
    };
    const rnd = el("button", "mn-btn", "Randomise");
    rnd.onclick = () => {
      this.blip("ok");
      this.randomise();
      drawTab();
    };
    const go = el("button", "mn-btn primary", "Start Year 1");
    go.onclick = () => {
      this.blip("ok");
      this.name = (this.name || "").trim() || (this.female() ? "Amina" : "Musa");
      saveLook(this.look);
      this.opts.onPlay(this.look, this.name, true);
    };
    foot.append(back, rnd, go);
    panel.append(head, tabs, body, foot);
    const zoom = el("div", "mn-zoom");
    this.drawZoom(zoom);
    s.append(panel, zoom);
    drawTab();
  }

  private drawZoom(z: HTMLElement): void {
    z.innerHTML = "";
    for (const [id, label] of [["face", "Face"], ["outfit", "Outfit"], ["full", "Full"]] as const) {
      const b = el("button", "", label);
      b.type = "button";
      b.setAttribute("aria-pressed", String(this.zoom === id));
      b.onclick = () => {
        this.zoom = id;
        this.blip("move");
        this.drawZoom(z);
      };
      z.append(b);
    }
  }

  private changed(): void {
    saveLook(this.look);
    this.ensurePreview();
  }

  /** A grid of named swatches. */
  private swatches(host: HTMLElement, label: string, values: string[], names: string[], get: () => string, set: (v: string) => void, wide = false): void {
    host.append(el("div", "mn-label", label));
    const grid = el("div", wide ? "mn-grid wide" : "mn-grid");
    values.forEach((v, i) => {
      const b = el("button", "mn-sw");
      b.type = "button";
      const chip = el("i");
      chip.style.background = v;
      b.append(chip, el("span", "", names[i] ?? v));
      b.title = names[i] ?? v;
      b.setAttribute("aria-label", `${label}: ${names[i] ?? v}`);
      b.setAttribute("aria-pressed", String(get() === v));
      b.onclick = () => {
        this.blip("move");
        set(v);
        grid.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", "false"));
        b.setAttribute("aria-pressed", "true");
        this.changed();
      };
      grid.append(b);
    });
    host.append(grid);
  }

  /** A grid of named cards (no colour). */
  private cards(host: HTMLElement, label: string, values: string[], names: string[], get: () => string, set: (v: string) => void, redraw?: () => void): void {
    host.append(el("div", "mn-label", label));
    const grid = el("div", "mn-grid wide");
    values.forEach((v, i) => {
      const b = el("button", "mn-sw card", names[i] ?? v);
      b.type = "button";
      b.setAttribute("aria-pressed", String(get() === v));
      b.onclick = () => {
        this.blip("move");
        set(v);
        this.changed();
        if (redraw) redraw();
        else {
          grid.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", "false"));
          b.setAttribute("aria-pressed", "true");
        }
      };
      grid.append(b);
    });
    host.append(grid);
  }

  private tabIdentity(body: HTMLElement): void {
    const redraw = () => {
      body.innerHTML = "";
      this.tabIdentity(body);
    };
    this.cards(body, "You are", ["m", "f"], ["A young man", "A young woman"], () => (this.female() ? "f" : "m"), (v) => {
      const want = v === "f";
      if (want === this.female()) return;
      this.look.model = want ? "womancasual" : "casual";
      if (!want && this.look.headwear === "hijab") this.look.headwear = "none";
      if (["Musa", "Amina"].includes(this.name)) this.name = want ? "Amina" : "Musa";
    }, redraw);
    body.append(el("div", "mn-label", "Your name"));
    const f = el("input", "mn-field");
    f.type = "text";
    f.maxLength = 18;
    f.value = this.name;
    f.placeholder = "Your first name";
    f.setAttribute("aria-label", "Your first name");
    f.oninput = () => (this.name = f.value.replace(/[^\p{L}\p{M}' -]/gu, "").slice(0, 18));
    body.append(f);
    const roomie = el("p", "", `Your roommate: ${this.female() ? "Firdausi" : "Bature"}. Your hall: ${this.female() ? "Kadanya" : "Giginya"}.`);
    roomie.style.cssText = "margin:12px 0 0;color:rgba(255,250,240,.7);font-size:14px";
    body.append(roomie);
  }

  private tabSkin(body: HTMLElement): void {
    this.swatches(body, "Skin tone", SKIN_TONES, SKIN_NAMES, () => this.look.skin, (v) => (this.look.skin = v));
  }

  private tabHair(body: HTMLElement): void {
    this.swatches(body, "Hair colour", HAIR, HAIR_NAMES, () => this.look.hair, (v) => (this.look.hair = v));
    const p = el("p", "", "More hairstyles arrive with the new character models.");
    p.style.cssText = "margin:12px 0 0;color:rgba(255,250,240,.6);font-size:13px";
    body.append(p);
  }

  private tabOutfit(body: HTMLElement): void {
    const redraw = () => {
      body.innerHTML = "";
      this.tabOutfit(body);
    };
    const models = this.female() ? FEMALE_MODELS : MALE_MODELS.filter((k) => k !== "farmer");
    this.cards(body, "Style", models, models.map((m) => MODEL_LABEL[m] ?? m), () => this.look.model, (v) => (this.look.model = v), redraw);
    const roles = SLOT_ROLE[this.look.model] ?? [];
    const slotFor = (r: string) => roles.indexOf(r as "top");
    const colour = (label: string, role: string, from = 0, to = CLOTH.length) => {
      const i = slotFor(role);
      if (i < 0) return;
      this.swatches(body, label, CLOTH.slice(from, to), CLOTH_NAMES.slice(from, to), () => this.look.outfit[i] ?? "", (v) => {
        this.look.outfit[i] = v;
        // Long garments: the matching lower half for kaftans and dresses.
        if (this.look.model === "mansuit" && role === "top" && this.look.outfit[1] === this.look.outfit[0]) this.look.outfit[1] = v;
      });
    };
    colour(this.look.model === "womandress" ? "Dress" : this.look.model === "mansuit" ? "Kaftan" : "Top", "top");
    colour(this.female() ? "Trousers or skirt" : "Trousers", "bottom");
    colour("Shoes", "shoes", 0, 14);
    const heads = this.female() ? ["none", "hijab", "cap"] : ["none", "cap"];
    this.cards(body, "Head", heads, heads.map((h) => ({ none: "Nothing", hijab: "Hijab", cap: "Cap" })[h]!), () => this.look.headwear, (v) => (this.look.headwear = v as Look["headwear"]), redraw);
    if (this.look.headwear !== "none") this.swatches(body, this.look.headwear === "hijab" ? "Hijab colour" : "Cap colour", CLOTH.slice(0, 18), CLOTH_NAMES.slice(0, 18), () => this.look.headwearColor, (v) => (this.look.headwearColor = v));
  }

  private randomise(): void {
    const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]!;
    const female = this.female();
    const models = female ? FEMALE_MODELS : MALE_MODELS.filter((k) => k !== "farmer");
    const model = pick(models);
    const cm = this.people.find((p) => p.key === model);
    const n = cm ? clothingSlots(cm.info) : 4;
    this.look = {
      model, skin: pick(SKIN_TONES), hair: pick(HAIR), outfit: Array.from({ length: n }, () => pick(CLOTH)),
      headwear: female ? pick(["none", "hijab", "hijab"] as const) : pick(["none", "none", "cap"] as const), headwearColor: pick(CLOTH),
    };
    this.changed();
  }

  /* ------------------------------------------------------------ settings, credits, missions */

  private sheetPanel(title: string, sub: string): { panel: HTMLElement; body: HTMLElement } {
    const id = title.toLowerCase() as Screen;
    const s = this.screen(id);
    s.innerHTML = "";
    const panel = el("div", "mn-panel");
    const head = el("header");
    head.append(el("h2", "", title), el("p", "", sub));
    const body = el("div", "mn-body");
    const foot = el("div", "mn-foot");
    const back = el("button", "mn-btn primary", "Back");
    back.onclick = () => {
      this.blip("back");
      this.showScreen("main");
    };
    foot.append(back);
    panel.append(head, body, foot);
    s.append(panel);
    return { panel, body };
  }

  private buildSettings(): void {
    const { body } = this.sheetPanel("Settings", "Saved on this device.");
    const S = this.settings;
    const row = (label: string, note: string, control: HTMLElement) => {
      const r = el("div", "mn-row");
      const l = el("div");
      l.append(el("b", "", label), el("small", "", note));
      r.append(l, control);
      body.append(r);
    };
    const seg = <T extends string | boolean>(vals: [T, string][], get: () => T, set: (v: T) => void) => {
      const g = el("div", "mn-seg");
      for (const [v, label] of vals) {
        const b = el("button", "", label);
        b.type = "button";
        b.setAttribute("aria-pressed", String(get() === v));
        b.onclick = () => {
          this.blip("move");
          set(v);
          saveSettings(S);
          g.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", "false"));
          b.setAttribute("aria-pressed", "true");
        };
        g.append(b);
      }
      return g;
    };
    const range = (get: () => number, set: (v: number) => void) => {
      const r = el("input", "mn-range");
      r.type = "range";
      r.min = "0";
      r.max = "1";
      r.step = "0.05";
      r.value = String(get());
      r.oninput = () => {
        set(Number(r.value));
        saveSettings(S);
      };
      return r;
    };
    row("Graphics", "Applies the next time the game loads", seg([["auto", "Auto"], ["low", "Low"], ["medium", "Medium"], ["high", "High"]], () => S.quality, (v) => (S.quality = v)));
    row("Sound", "Ambience, effects and music", range(() => S.soundVolume, (v) => (S.soundVolume = v)));
    row("Voices", "Spoken lines", range(() => S.voiceVolume, (v) => (S.voiceVolume = v)));
    row("Computer voices", "Until the cast records, each character has a browser voice", seg([[true, "On"], [false, "Off"]], () => S.voices, (v) => (S.voices = v)));
    row("Subtitles", "Who is speaking and what they say", seg([[true, "On"], [false, "Off"]], () => S.subtitles, (v) => (S.subtitles = v)));
    row("Ground arrows", "Glowing arrows on the ground show the way to your objective", seg([[true, "On"], [false, "Off"]], () => S.groundArrows, (v) => (S.groundArrows = v)));
    row("Reduced motion", "Calmer menus and transitions", seg([[false, "Off"], [true, "On"]], () => S.reducedMotion, (v) => {
      S.reducedMotion = v;
      this.root.classList.toggle("reduced", v);
    }));
    body.append(el("div", "mn-label", "Controls"));
    const keys = el("div", "mn-keys");
    for (const [k, v] of [["W A S D", "Move"], ["Shift", "Run"], ["Drag / right stick", "Look"], ["Wheel", "Zoom"], ["E", "Talk, use, go through doors"], ["1 2 3", "Choose a reply"], ["J", "Journal"], ["T", "Time speed"], ["M", "Sound on or off"], ["Esc / Space", "Skip a cutscene"]] as const) {
      const kk = el("span");
      for (const part of k.split(" / ")) kk.append(el("kbd", "", part), document.createTextNode(" "));
      keys.append(kk, el("span", "", v));
    }
    body.append(keys);
  }

  private buildCredits(): void {
    const { body } = this.sheetPanel("Credits", "Made for MIB-Hub.");
    body.classList.add("mn-cred");
    const p = (html: string) => {
      const e = el("p");
      e.innerHTML = html;
      body.append(e);
    };
    p("<b>Story</b> · the Year 1 scripts, cast and world of the story bible (MIB-Hub).");
    p("<b>Engine</b> · PlayCanvas 2.23.3 (MIT).");
    p("<b>People and cars</b> · Quaternius, CC0, recoloured and repacked for the game.");
    p("<b>Display font</b> · Bricolage Grotesque, SIL Open Font License 1.1.");
    p("<b>Everything else</b> · roads, buildings, interiors, the goat, the bicycle, trees, sky, sound and music are made by the game's own code.");
    p("Voices are computer voices until the cast records their lines. Special characters' voices belong to the real people.");
  }

  private buildMissions(): void {
    const { body } = this.sheetPanel("Missions", "Passed missions can be replayed (rewards are only paid once).");
    for (const m of this.opts.story) {
      const done = this.progress.done.includes(m.key);
      const b = el("button", "mn-item");
      b.type = "button";
      b.append(el("span", "", `M${m.num} · ${m.title}`), el("small", "", done ? "Replay" : "Locked"));
      b.disabled = !done && !this.opts.debug;
      b.onclick = () => this.opts.onPlay(loadLook(), this.progress.name, false, m.key);
      body.append(b);
    }
  }

  /* ------------------------------------------------------------ input */

  private onKey(e: KeyboardEvent): void {
    if ((e.target as HTMLElement)?.tagName === "INPUT" && e.key !== "Escape" && e.key !== "Enter") return;
    this.unlock();
    if (this.current === "title") {
      this.showScreen("main");
      return;
    }
    const k = e.key.toLowerCase();
    if (k === "arrowdown" || k === "s") {
      this.select(this.focusIdx + 1);
      this.blip("move");
      e.preventDefault();
    } else if (k === "arrowup" || k === "w") {
      this.select(this.focusIdx - 1);
      this.blip("move");
      e.preventDefault();
    } else if (k === "enter" || k === " ") {
      if ((e.target as HTMLElement)?.tagName !== "BUTTON") this.focusList[this.focusIdx]?.click();
    } else if (k === "escape" && this.current !== "main") {
      this.blip("back");
      this.showScreen("main");
    } else if (this.current === "creator" && (k === "q" || k === "e")) this.yaw += k === "q" ? -0.4 : 0.4;
  }

  private pollPad(): void {
    const pads = navigator.getGamepads?.() ?? [];
    const now = new Set<string>();
    for (const p of pads) {
      if (!p) continue;
      if (p.buttons[12]?.pressed || (p.axes[1] ?? 0) < -0.6) now.add("up");
      if (p.buttons[13]?.pressed || (p.axes[1] ?? 0) > 0.6) now.add("down");
      if (p.buttons[0]?.pressed) now.add("a");
      if (p.buttons[1]?.pressed) now.add("b");
      if (p.buttons[9]?.pressed) now.add("start");
    }
    const fresh = (k: string) => now.has(k) && !this.padPrev.has(k);
    if (this.current === "title" && (fresh("a") || fresh("start"))) this.showScreen("main");
    else {
      if (fresh("down")) this.select(this.focusIdx + 1);
      if (fresh("up")) this.select(this.focusIdx - 1);
      if (fresh("a")) this.focusList[this.focusIdx]?.click();
      if (fresh("b") && this.current !== "main") this.showScreen("main");
    }
    this.padPrev = now;
  }

  /* ------------------------------------------------------------ per frame */

  update(dt: number): void {
    if (this.frozen) return;
    this.t += dt;
    this.pollPad();
    if (this.current === "creator") {
      // The turntable: a slow turn, faster when dragged; the camera eases to the chosen framing.
      if (!this.dragging && !this.settings.reducedMotion) this.yaw += dt * 0.35;
      this.preview?.place(STAGE.x, surfaceHeight(STAGE.x, STAGE.z), STAGE.z, this.yaw);
      this.preview?.gait(0);
      this.preview?.update(dt);
      const narrow = innerWidth < 640;
      const f = this.zoom === "face" ? { d: 1.05, y: 1.58, ly: 1.56, side: narrow ? 0 : 0.42 } : this.zoom === "outfit" ? { d: 2.3, y: 1.15, ly: 0.95, side: narrow ? 0 : 0.85 } : { d: 3.6, y: 1.25, ly: 0.95, side: narrow ? 0 : 1.25 };
      const wantPos = new pc.Vec3(STAGE.x - f.side, f.y + (narrow ? 0.5 : 0), STAGE.z + f.d + (narrow ? 1.4 : 0));
      const wantLook = new pc.Vec3(STAGE.x - f.side, f.ly - (narrow ? 0.45 : 0), STAGE.z);
      const k = 1 - Math.exp(-dt * 4);
      this.camPos.lerp(this.camPos, wantPos, this.camPos.lengthSq() ? k : 1);
      this.camLook.lerp(this.camLook, wantLook, this.camLook.lengthSq() ? k : 1);
    } else {
      // The golden-hour drift (slow, smooth, looping).
      const n = DRIFT.length;
      const u = this.t * (this.settings.reducedMotion ? 0.012 : 0.028);
      const i = Math.floor(u) % n, fr = u - Math.floor(u);
      const key = (o: number) => DRIFT[(i + o + n) % n]!;
      const p = [0, 1, 2, 3, 4, 5].map((c) => catmull(key(-1)[c]!, key(0)[c]!, key(1)[c]!, key(2)[c]!, fr));
      this.camPos.set(p[0]!, Math.max(p[1]!, surfaceHeight(p[0]!, p[2]!) + 1.4), p[2]!);
      this.camLook.set(p[3]!, p[4]!, p[5]!);
    }
    this.cam.setPosition(this.camPos);
    this.cam.lookAt(this.camLook);
  }

  /** Screenshots: stop moving. */
  freeze(): void {
    this.frozen = true;
  }

  dispose(): void {
    window.removeEventListener("keydown", this.keyHandler);
    this.preview?.destroy();
    this.preview = null;
    this.root.remove();
    if (this.cam.camera) this.cam.camera.fov = 55;
  }

  get hour(): number {
    return 17.55;
  }

  void(): void {
    void defaultLook;
  }
}

function hints(): HTMLElement {
  const h = el("div", "mn-hint");
  h.innerHTML = "<span><kbd>↑</kbd><kbd>↓</kbd>Choose</span><span><kbd>Enter</kbd>Select</span><span><kbd>Esc</kbd>Back</span>";
  return h;
}
