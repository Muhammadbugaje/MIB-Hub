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
  private actionHint: HTMLElement | null = null;
  private enemyHealth: HTMLElement | null = null;
  private enemyHealthBar: HTMLElement | null = null;
  private enemyHealthName: HTMLElement | null = null;
  private phone: HTMLElement | null = null;
  private phoneMission: HTMLElement | null = null;
  private phoneGoals: HTMLElement | null = null;
  private phoneHelp: HTMLElement | null = null;
  private phoneSettings: HTMLElement | null = null;
  private phoneHints: HTMLElement | null = null;
  private phoneClues: HTMLElement | null = null;
  private phoneMessages: HTMLElement | null = null;
  private phoneClasses: HTMLElement | null = null;
  private phoneCamera: HTMLElement | null = null;
  private phoneHealth: HTMLElement | null = null;
  private phoneHealthBar: HTMLElement | null = null;
  private phoneHealthName: HTMLElement | null = null;
  private phoneTabs: HTMLElement | null = null;
  private phoneTabPanels: Record<string, HTMLElement> = {};
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

    // Context-sensitive action hint (E key on keyboard, big button on touch).
    this.actionHint = el("div", "wip-action-hint", "");
    this.root.append(this.actionHint);

    // Enemy health bar (shown during combat).
    this.enemyHealth = el("div", "wip-enemy-health");
    this.enemyHealthName = el("div", "wip-enemy-health__name", "");
    this.enemyHealthBar = el("div", "wip-enemy-health__bar");
    const fill = el("div", "wip-enemy-health__fill");
    this.enemyHealthBar.append(fill);
    this.enemyHealth.append(this.enemyHealthName, this.enemyHealthBar);
    this.enemyHealth.hidden = true;
    this.root.append(this.enemyHealth);

    // Phone UI — futuristic in-game phone with tabs
    this.phone = el("div", "wip-phone");
    this.phoneHealth = el("div", "wip-phone-health");
    this.phoneHealthName = el("div", "wip-phone-health__name", "Health");
    this.phoneHealthBar = el("div", "wip-phone-health__bar");
    const phoneHealthFill = el("div", "wip-phone-health__fill");
    this.phoneHealthBar.append(phoneHealthFill);
    this.phoneHealth.append(this.phoneHealthName, this.phoneHealthBar);
    this.phone.append(this.phoneHealth);

    // Phone tabs
    this.phoneTabs = el("div", "wip-phone-tabs");
    const tabs: [string, string][] = [
      ["missions", "Missions"], ["goals", "Goals"], ["help", "Help"],
      ["settings", "Settings"], ["hints", "Hints"], ["clues", "Clues"],
      ["messages", "Messages"], ["classes", "Classes"], ["camera", "Camera"],
    ];
    this.phoneTabPanels = {};
    for (const [id, label] of tabs) {
      const btn = el("button", "wip-phone-tab", label);
      btn.type = "button";
      btn.dataset.tab = id;
      btn.setAttribute("aria-pressed", "false");
      btn.onclick = () => {
        this.showPhoneTab(id);
      };
      this.phoneTabs.append(btn);
      const panel = el("div", "wip-phone-section");
      panel.id = `phone-${id}`;
      panel.innerHTML = `<h3>${label}</h3><ul></ul>`;
      this.phoneTabPanels[id] = panel;
      this.phone.append(panel);
    }
    this.phone.append(this.phoneTabs);
    this.showPhoneTab("missions");

    this.phone.clicked = false;
    this.phone.addEventListener("click", (e) => {
      e.stopPropagation();
      this.phone.clicked = !this.phone.clicked;
      this.phone.classList.toggle("on", this.phone.clicked);
    });

    // Pause button - opens pause menu
    this.pauseBtn = el("button", "wip-pause-btn", "⏸");
    this.pauseBtn.type = "button";
    this.pauseBtn.onclick = () => this.onPauseToggle?.();
    this.root.insertBefore(this.pauseBtn, this.hud);

    // Map button - opens map view
    this.mapBtn = el("button", "wip-map-btn", "🗺");
    this.mapBtn.type = "button";
    this.mapBtn.onclick = () => this.onMapToggle?.();
    this.root.insertBefore(this.mapBtn, this.hud);

    this.root.append(this.hud, this.top, this.bottom, this.sub, this.fader, this.skip, this.toast, this.loading);

    // Player health bar (moved from center to top-left with proper label)
    this.playerHealth = el("div", "wip-player-health");
    this.playerHealthName = el("div", "wip-player-health__name", "Health");
    this.playerHealthBar = el("div", "wip-player-health__bar");
    const playerHealthFill = el("div", "wip-player-health__fill");
    this.playerHealthBar.append(playerHealthFill);
    this.playerHealth.append(this.playerHealthName, this.playerHealthBar);
    this.root.insertBefore(this.playerHealth, this.hud);
    this.playerHealth.hidden = true;
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
    this.playerHealth.hidden = !on;
  }

  toggleHud(): void {
    this.hud.hidden = !this.hud.hidden;
    this.playerHealth.hidden = !this.playerHealth.hidden;
  }

  /** Pause the game and show a pause overlay. Pauses time, ambient barks, and shows the pause menu. */
  pause(): void {
    this.root.classList.add("wip-paused");
    const wasPlaying = playing;
    playing = false;
    hud.say("Game paused");
  }

  /** Resume the game from pause. */
  resume(): void {
    this.root.classList.remove("wip-paused");
    playing = true;
    hud.say("Game resumed");
  }

  /** Toggle pause: if paused, resume; if running, pause. */
  togglePause(): void {
    if (this.root.classList.contains("wip-paused")) {
      this.resume();
    } else {
      this.pause();
    }
  }

  /** Toggle map view: show a minimap of the campus. */
  toggleMap(): void {
    this.root.classList.toggle("wip-map-open");
    if (this.root.classList.contains("wip-map-open")) {
      this.say("Map opened");
      this.renderMap();
    } else {
      this.say("Map closed");
    }
  }

  /** Render a simple minimap of the campus in the top-right corner. */
  renderMap(): void {
    // Create map overlay if not exists
    let mapOverlay = document.querySelector(".wip-map-overlay");
    if (!mapOverlay) {
      mapOverlay = el("div", "wip-map-overlay");
      this.root.append(mapOverlay);
    }
    mapOverlay.innerHTML = '';
    // Draw simple campus outline and key locations
    const map = el("div", "wip-map-canvas");
    mapOverlay.append(map);
    // Campus boundary roughly -80 to 80, -180 to -40
    const w = el("div", "wip-map-window");
    map.append(w);
    // Key locations as markers
    const locations: [string, number, number][] = [
      ["Main Gate", -70, -30],
      ["Clock Tower", -40, -128],
      ["Senate Hall", -20, -226],
      ["Student Centre", 40, -84],
      ["Cafeteria", 100, -200],
      ["Faculty of Engineering", -52, -175],
    ];
    const s = el("span", "", "Campus Map");
    s.style.cssText = "position:absolute;top:8px;left:8px;font:700 14px system-ui;color:#f2b33d";
    map.append(s);
    locations.forEach(([name, x, z]) => {
      const marker = el("div", "wip-map-marker");
      // Simple projection: x from -80 to 80 maps to 0-100px, z from -180 to -40 maps to 0-100px
      const px = Math.round((x + 80) / 160 * 200) + 20;
      const pz = Math.round((z + 180) / 140 * 200) + 20;
      marker.style.cssText = `
        position:absolute;
        left:${px}px;top:${pz}px;
        width:8px;height:8px;border-radius:50%;background:#f2b33d;
        transform:translate(-50%,-50%);
      `;
      marker.title = name;
      marker.onclick = () => this.say(name);
      map.append(marker);
    });
  }

  setClock(text: string, speedLabel: string): void {
    this.clock.textContent = speedLabel ? `${text}  ${speedLabel}` : text;
  }

  setMode(text: string): void {
    this.mode.textContent = text;
  }

  /** Context-sensitive action prompt (E on keyboard, big button on touch). Shows "Talk", "Use", "Door", etc. */
  setActionHint(text: string | null): void {
    if (!this.actionHint) return;
    this.actionHint.textContent = text ?? "";
    this.actionHint.classList.toggle("on", !!text);
  }

  /** Show/hide the enemy health bar during combat. */
  setEnemyHealth(name: string | null, health: number | null): void {
    if (!this.enemyHealth) return;
    if (name === null || health === null) {
      this.enemyHealth.hidden = true;
      return;
    }
    this.enemyHealth.hidden = false;
    if (this.enemyHealthName) this.enemyHealthName.textContent = name;
    if (this.enemyHealthBar) {
      const fill = this.enemyHealthBar.firstElementChild as HTMLElement | null;
      if (fill) fill.style.width = `${Math.round(Math.max(0, Math.min(1, health)) * 100)}%`;
    }
  }

  setPlayerHealth(name: string | null, health: number | null): void {
    if (!this.playerHealth) return;
    if (name === null || health === null) {
      this.playerHealth.hidden = true;
      return;
    }
    this.playerHealth.hidden = false;
    if (this.playerHealthName) this.playerHealthName.textContent = name;
    if (this.playerHealthBar) {
      const fill = this.playerHealthBar.firstElementChild as HTMLElement | null;
      if (fill) fill.style.width = `${Math.round(Math.max(0, Math.min(1, health)) * 100)}%`;
    }
  }

  /** Show a phone tab by id. */
  showPhoneTab(id: string): void {
    if (!this.phoneTabs) return;
    // Deactivate all tabs
    this.phoneTabs.querySelectorAll<HTMLElement>('.wip-phone-tab').forEach((b) => {
      b.setAttribute("aria-pressed", "false");
    });
    // Hide all panels
    for (const panel of Object.values(this.phoneTabPanels)) {
      panel.classList.remove("on");
    }
    // Activate selected tab button
    const btn = this.phoneTabs.querySelector<HTMLElement>(`button[data-tab="${id}"]`);
    if (btn) btn.setAttribute("aria-pressed", "true");
    // Show selected panel
    const panel = this.phoneTabPanels[id];
    if (panel) panel.classList.add("on");
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
