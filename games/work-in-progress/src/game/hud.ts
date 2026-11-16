/**
 * Everything drawn in HTML over the 3D view: the loading screen, the start
 * menu with the look picker, the in-game HUD (name, clock, controls hint,
 * camera mode), and the cutscene layer (letterbox, subtitles, fades, Skip).
 */
import type { Look } from "../world/people.ts";

export const GAME_NAME = "Work in Progress";

/** Lines from the story for the loading screen (nothing that spoils the mysteries). */
const LORE = [
  "\"Sit. Tea first, gist second.\" (Mai Shayi Audu)",
  "The Amana Clock says 6:06. It has said 6:06 for a very long time.",
  "\"You have eaten? Don't lie to me.\" (Mama Nkechi)",
  "Every fresher goes to the wrong Twin Theatre once.",
  "\"Network.\" (Mr. Clement, Bursary)",
  "\"Four passports.\" (Mrs. Adebayo, Registry)",
  "Garri wants cold water. Hot water makes eba.",
  "\"Pass! Is the ball your inheritance?\" (Coach Danladi)",
  "\"I don't sell products. I sell advantages.\" (Mubarak)",
];

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

export function defaultLook(): Look {
  return { model: "casual", skin: "#c68a5e", hair: "#1d1512", outfit: ["#f4f1ea", "#2a5fa8", "#1f3c66", "#2b2b2b"], headwear: "none", headwearColor: "#2a5fa8" };
}

export function loadLook(): Look {
  try {
    const raw = localStorage.getItem("wip-look");
    if (raw) return { ...defaultLook(), ...(JSON.parse(raw) as Partial<Look>) };
  } catch {
    /* private mode */
  }
  return defaultLook();
}

export function saveLook(l: Look): void {
  try {
    localStorage.setItem("wip-look", JSON.stringify(l));
  } catch {
    /* ignore */
  }
}

export class Hud {
  readonly root: HTMLElement;
  private loading: HTMLElement;
  private bar: HTMLElement;
  private loadMsg: HTMLElement;
  private hud: HTMLElement;
  private clock: HTMLElement;
  private mode: HTMLElement;
  private stats: HTMLElement;
  private top = el("div", "wip-bar wip-bar--top");
  private bottom = el("div", "wip-bar wip-bar--bottom");
  private sub = el("div", "wip-sub");
  private fader = el("div", "wip-fade");
  private skip = el("button", "wip-skip", "Skip ›");
  private toast = el("div", "wip-toast");
  private toastTimer = 0;
  private tipTimer = 0;

  constructor(host: HTMLElement) {
    this.root = el("div", "wip-ui");
    host.append(this.root);
    this.loading = el("div", "wip-loading");
    const card = el("div", "wip-loading__card");
    card.append(el("h1", "wip-title", GAME_NAME), el("p", "wip-tag", "An early look at the new campus game"));
    const track = el("div", "wip-progress");
    this.bar = el("div", "wip-progress__bar");
    track.append(this.bar);
    this.loadMsg = el("p", "wip-loading__msg", "Laying the roads…");
    const tip = el("p", "wip-loading__tip", LORE[Math.floor(Math.random() * LORE.length)]!);
    card.append(track, this.loadMsg, tip);
    this.tipTimer = window.setInterval(() => {
      tip.style.opacity = "0";
      setTimeout(() => {
        tip.textContent = LORE[Math.floor(Math.random() * LORE.length)]!;
        tip.style.opacity = "1";
      }, 400);
    }, 4200);
    this.loading.append(card);

    this.hud = el("div", "wip-hud");
    const brand = el("div", "wip-brand");
    brand.append(el("strong", "", GAME_NAME), el("span", "wip-badge", "early build"));
    this.clock = el("div", "wip-clock", "07:30");
    this.mode = el("div", "wip-mode", "");
    this.stats = el("div", "wip-stats", "");
    const hint = el("div", "wip-hint");
    hint.innerHTML = "<b>WASD</b> move · <b>Shift</b> run · <b>drag</b> look · <b>E</b> talk / use / doors · <b>1-3</b> reply · <b>J</b> journal · <b>T</b> time · <b>M</b> sound · <b>H</b> hide";
    this.hud.append(brand, this.clock, this.mode, hint, this.stats);
    this.hud.hidden = true;
    this.sub.hidden = true;
    this.skip.hidden = true;
    this.root.append(this.hud, this.top, this.bottom, this.sub, this.fader, this.skip, this.toast, this.loading);
  }

  progress(f: number, msg?: string): void {
    this.bar.style.width = `${Math.round(Math.max(0.03, Math.min(1, f)) * 100)}%`;
    if (msg) this.loadMsg.textContent = msg;
  }

  hideLoading(): void {
    clearInterval(this.tipTimer);
    this.loading.classList.add("is-gone");
    setTimeout(() => this.loading.remove(), 700);
  }

  showHud(on: boolean): void {
    this.hud.hidden = !on;
  }

  toggleHud(): void {
    this.hud.hidden = !this.hud.hidden;
  }

  setClock(text: string, speedLabel: string): void {
    this.clock.textContent = speedLabel ? `${text}  ${speedLabel}` : text;
  }

  setMode(text: string): void {
    this.mode.textContent = text;
  }

  setStats(text: string): void {
    this.stats.textContent = text;
  }

  say(text: string): void {
    this.toast.textContent = text;
    this.toast.classList.add("on");
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove("on"), 1800);
  }

  /* ---- cutscene layer */
  letterbox(on: boolean): void {
    this.top.classList.toggle("on", on);
    this.bottom.classList.toggle("on", on);
    if (on) this.hud.hidden = true;
  }
  subtitle(who: string | null, text: string): void {
    if (!who || !text) {
      this.sub.hidden = true;
      return;
    }
    this.sub.hidden = false;
    this.sub.innerHTML = "";
    this.sub.append(el("b", "", who), el("span", "", text));
  }
  fade(a: number): void {
    this.fader.style.opacity = String(a);
  }
  skipButton(on: boolean, onSkip: () => void): void {
    this.skip.hidden = !on;
    this.skip.onclick = (e) => {
      e.stopPropagation();
      onSkip();
    };
  }
}
