/**
 * Everything drawn in HTML over the 3D view: the loading screen, the start
 * menu with the look picker, the in-game HUD (name, clock, controls hint,
 * camera mode), and the cutscene layer (letterbox, subtitles, fades, Skip).
 */
import type { CutsceneUi } from "./cutscene.ts";
import { CLOTH, FEMALE_MODELS, HAIR, type Look, MALE_MODELS, SKIN_TONES } from "../world/people.ts";

export const GAME_NAME = "Work in Progress";

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

const MODEL_LABEL: Record<string, string> = {
  casual: "Tee and jeans", hoodie: "Hoodie", business: "Suit", man: "Casual", manlong: "Long sleeves", mansuit: "Formal", farmer: "Overalls",
  animwoman: "Casual", womandress: "Dress", womancasual: "Tee",
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

function saveLook(l: Look): void {
  try {
    localStorage.setItem("wip-look", JSON.stringify(l));
  } catch {
    /* ignore */
  }
}

export class Hud implements CutsceneUi {
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
    card.append(track, this.loadMsg);
    this.loading.append(card);

    this.hud = el("div", "wip-hud");
    const brand = el("div", "wip-brand");
    brand.append(el("strong", "", GAME_NAME), el("span", "wip-badge", "early build"));
    this.clock = el("div", "wip-clock", "07:30");
    this.mode = el("div", "wip-mode", "");
    this.stats = el("div", "wip-stats", "");
    const hint = el("div", "wip-hint");
    hint.innerHTML = "<b>WASD</b> move · <b>Shift</b> run · <b>drag</b> look · <b>wheel</b> zoom · <b>C</b> showcase · <b>T</b> time speed · <b>N</b> day/night · <b>M</b> sound · <b>H</b> hide";
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

  /* ---- the start menu with the look picker */
  menu(onPlay: (look: Look, opts: { voices: boolean; sound: boolean; skipIntro: boolean }) => void): void {
    const look = loadLook();
    const m = el("div", "wip-menu");
    const card = el("div", "wip-menu__card");
    card.append(el("h1", "wip-title", GAME_NAME), el("p", "wip-tag", "Freshers' week. Make yourself at home."));
    const sect = (title: string) => {
      const s = el("div", "wip-pick");
      s.append(el("h2", "", title));
      card.append(s);
      return s;
    };
    const chips = (host: HTMLElement, values: string[], get: () => string, set: (v: string) => void, label?: (v: string) => string) => {
      const row = el("div", "wip-chips");
      const draw = () => {
        row.innerHTML = "";
        for (const v of values) {
          const b = el("button", `wip-chip${label ? " wip-chip--text" : ""}`, label ? label(v) : "");
          b.type = "button";
          if (!label) b.style.background = v;
          b.setAttribute("aria-pressed", String(get() === v));
          b.setAttribute("aria-label", label ? label(v) : v);
          b.onclick = () => {
            set(v);
            saveLook(look);
            refreshAll();
          };
          row.append(b);
        }
      };
      host.append(row);
      return draw;
    };
    const female = () => FEMALE_MODELS.includes(look.model);
    const drawers: (() => void)[] = [];
    const refreshAll = () => drawers.forEach((d) => d());
    const who = sect("You are");
    drawers.push(chips(who, ["m", "f"], () => (female() ? "f" : "m"), (v) => {
      look.model = v === "f" ? "womancasual" : "casual";
      if (v === "m" && look.headwear === "hijab") look.headwear = "none";
    }, (v) => (v === "f" ? "A young woman" : "A young man")));
    const style = sect("Style");
    const styleRow = el("div");
    style.append(styleRow);
    drawers.push(() => {
      styleRow.innerHTML = "";
      const models = female() ? FEMALE_MODELS : MALE_MODELS.filter((k) => k !== "farmer");
      chips(styleRow, models, () => look.model, (v) => (look.model = v), (v) => MODEL_LABEL[v] ?? v)();
    });
    drawers.push(chips(sect("Skin"), SKIN_TONES, () => look.skin, (v) => (look.skin = v)));
    drawers.push(chips(sect("Top"), CLOTH.slice(0, 14), () => look.outfit[0] ?? "", (v) => (look.outfit[0] = v)));
    drawers.push(chips(sect("Trousers / skirt"), CLOTH.slice(2, 16), () => look.outfit[1] ?? "", (v) => (look.outfit[1] = v)));
    drawers.push(chips(sect("Hair"), HAIR, () => look.hair, (v) => (look.hair = v)));
    const headSect = sect("Head");
    const headRow = el("div");
    headSect.append(headRow);
    drawers.push(() => {
      headRow.innerHTML = "";
      const opts = female() ? ["none", "hijab"] : ["none", "cap"];
      chips(headRow, opts, () => look.headwear, (v) => (look.headwear = v as Look["headwear"]), (v) => ({ none: "Nothing", hijab: "Hijab", cap: "Cap" })[v] ?? v)();
      if (look.headwear !== "none") chips(headRow, CLOTH.slice(0, 14), () => look.headwearColor, (v) => (look.headwearColor = v))();
    });
    refreshAll();
    const opts = el("div", "wip-opts");
    const check = (label: string, on: boolean) => {
      const l = el("label", "wip-check");
      const i = el("input");
      i.type = "checkbox";
      i.checked = on;
      l.append(i, document.createTextNode(label));
      opts.append(l);
      return i;
    };
    const sound = check("Sound", true);
    const voices = check("Spoken lines (computer voice)", true);
    const skipIntro = check("Skip the opening film", false);
    card.append(opts);
    const play = el("button", "wip-play", "Play");
    play.type = "button";
    play.onclick = () => {
      saveLook(look);
      m.remove();
      onPlay(look, { voices: voices.checked, sound: sound.checked, skipIntro: skipIntro.checked });
    };
    card.append(play, el("p", "wip-small", "Early build: what you see is the first map slice. Missions, interiors and voices come next."));
    m.append(card);
    this.root.append(m);
  }
}
