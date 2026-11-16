/**
 * The mission layer of the HUD, in HTML over the 3D view:
 *
 *  - the objective panel (mission title, the current objective, distance);
 *  - the world marker (a diamond over the target, clamped to the screen edge
 *    with an arrow when the target is behind you) and the minimap (roads,
 *    buildings, you, and an arrow to the target when it is off the map);
 *  - mission start and "mission passed" cards with rewards;
 *  - the interaction prompt ("E  Talk to Mama Nkechi"), dialogue choices;
 *  - money, the stamina bar, boost timers (Turbo Sneakers, Zobo Max...);
 *  - inserts (the note, the class photo with the gap, logbook page 40),
 *    title cards and the calendar card;
 *  - the journal (J): missions, clues, legends, contacts;
 *  - the debug menu (?debug=1): mission select and replay, special toggles.
 *
 * Everything is readable at phone width; buttons are at least 44 px (rule K4/K5).
 */
import { buildings, roads, RB, CLOCK } from "../world/layout.ts";

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

const CSS = `
.mi-choice[hidden],.mi-prompt[hidden],.mi-mini[hidden],.mi-panel[hidden],.mi-obj[hidden]{display:none!important}
.mi-obj{position:absolute;left:16px;top:58px;max-width:min(380px,calc(100vw - 32px));padding:10px 14px;border-radius:14px;background:rgba(14,18,24,.62);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);box-shadow:0 6px 24px rgba(0,0,0,.25)}
.mi-obj[hidden]{display:none}
.mi-obj small{display:block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);font-weight:800}
.mi-obj b{display:block;font-size:16px;line-height:1.3;margin-top:2px}
.mi-obj span{font-size:12px;color:var(--ink-2)}
.mi-marker{position:absolute;left:0;top:0;width:34px;height:34px;margin:-17px 0 0 -17px;pointer-events:none;transition:opacity .2s}
.mi-marker i{position:absolute;inset:6px;transform:rotate(45deg);border-radius:5px;background:var(--accent);box-shadow:0 0 0 3px rgba(0,0,0,.35),0 0 16px rgba(242,179,61,.8)}
.mi-marker em{position:absolute;top:36px;left:50%;transform:translateX(-50%);font:700 11px system-ui;white-space:nowrap;color:#fff;text-shadow:0 1px 3px #000}
.mi-marker.edge i{border-radius:2px 50% 50% 50%}
.mi-map{position:absolute;right:16px;bottom:16px;width:150px;height:150px;border-radius:50%;overflow:hidden;background:rgba(14,18,24,.6);box-shadow:0 0 0 3px rgba(255,255,255,.18),0 8px 24px rgba(0,0,0,.35)}
.mi-map canvas{width:100%;height:100%;display:block}
.mi-money{position:absolute;right:16px;top:80px;padding:6px 12px;border-radius:12px;background:rgba(14,18,24,.55);font-weight:800;font-variant-numeric:tabular-nums;color:#9be38a}
.mi-stam{position:absolute;right:16px;top:116px;width:120px;height:6px;border-radius:9px;background:rgba(255,255,255,.18);overflow:hidden}
.mi-stam i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#4fc3f7,#9be38a);transition:width .15s}
.mi-boosts{position:absolute;right:16px;top:128px;display:flex;flex-direction:column;gap:4px;align-items:flex-end}
.mi-boost{padding:4px 10px;border-radius:99px;background:rgba(242,179,61,.92);color:#1b1408;font:800 12px system-ui}
.mi-prompt{position:absolute;left:50%;bottom:70px;transform:translateX(-50%);display:flex;gap:10px;align-items:center;padding:8px 16px 8px 8px;border-radius:99px;background:rgba(14,18,24,.72);font-weight:700;pointer-events:auto;cursor:pointer;min-height:44px;box-sizing:border-box}
.mi-prompt kbd{display:inline-grid;place-items:center;min-width:30px;height:30px;border-radius:8px;background:#fff;color:#111;font:900 14px system-ui}
.mi-card{position:absolute;left:50%;top:22%;transform:translate(-50%,-10px);min-width:min(460px,86vw);text-align:center;padding:20px 26px;border-radius:20px;background:rgba(10,12,16,.78);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);opacity:0;transition:opacity .4s,transform .4s;pointer-events:none}
.mi-card.on{opacity:1;transform:translate(-50%,0)}
.mi-card small{display:block;letter-spacing:.2em;text-transform:uppercase;font-weight:800;color:var(--accent);font-size:12px}
.mi-card h2{margin:6px 0 4px;font-size:clamp(24px,4.4vw,38px);line-height:1.05;font-weight:900}
.mi-card p{margin:6px 0 0;color:var(--ink-2);font-size:14px}
.mi-card ul{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:6px;justify-content:center}
.mi-card li{padding:4px 10px;border-radius:99px;background:rgba(255,255,255,.1);font-size:13px;font-weight:700}
.mi-choice{position:absolute;left:50%;bottom:calc(11vh + 70px);transform:translateX(-50%);display:flex;flex-direction:column;gap:8px;width:min(520px,90vw);pointer-events:auto}
.mi-choice p{margin:0 0 4px;text-align:center;font-weight:700;text-shadow:0 1px 6px #000}
.mi-choice button{min-height:46px;padding:10px 16px;border-radius:14px;border:1px solid rgba(255,255,255,.25);background:rgba(14,18,24,.82);color:#fff;font:700 15px system-ui;text-align:left;cursor:pointer;display:flex;gap:10px;align-items:center}
.mi-choice button:hover,.mi-choice button:focus{background:rgba(242,179,61,.95);color:#1b1408;outline:none}
.mi-choice kbd{display:inline-grid;place-items:center;min-width:24px;height:24px;border-radius:6px;background:rgba(255,255,255,.85);color:#111;font:900 12px system-ui}
.mi-title{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;opacity:0;transition:opacity .8s}
.mi-title.on{opacity:1}
.mi-title b{font:italic 600 clamp(22px,4vw,40px)/1.2 Georgia,"Times New Roman",serif;text-align:center;max-width:80vw;text-shadow:0 2px 16px rgba(0,0,0,.9)}
.mi-cal{position:absolute;left:18px;top:calc(11vh + 14px);padding:8px 14px;border-left:4px solid var(--accent);background:rgba(10,12,16,.6);font-weight:800;opacity:0;transition:opacity .5s}
.mi-cal.on{opacity:1}
.mi-insert{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%) rotate(-1.5deg);pointer-events:none;opacity:0;transition:opacity .5s;box-shadow:0 20px 60px rgba(0,0,0,.6)}
.mi-insert.on{opacity:1}
.mi-insert canvas{display:block;width:min(520px,80vw);height:auto;border-radius:6px}
.mi-panel{position:absolute;inset:0;display:grid;place-items:center;background:rgba(6,8,12,.55);pointer-events:auto}
.mi-panel[hidden]{display:none}
.mi-sheet{width:min(640px,calc(100vw - 24px));max-height:calc(100vh - 40px);overflow:auto;padding:18px 20px;border-radius:18px;background:rgba(16,20,26,.94);box-sizing:border-box}
.mi-sheet h2{margin:0 0 10px;font-size:22px}
.mi-sheet h3{margin:14px 0 6px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--accent)}
.mi-sheet ul{margin:0;padding-left:18px;color:var(--ink-2);font-size:14px}
.mi-sheet button{min-height:44px;margin:4px 6px 0 0;padding:8px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;font:700 14px system-ui;cursor:pointer}
.mi-sheet button.primary{background:var(--accent);color:#1b1408;border:0}
.mi-sheet .row{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.08)}
.mi-sheet .row b{flex:1 1 200px}
.mi-mini{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,calc(100vw - 24px));padding:16px 18px;border-radius:18px;background:rgba(12,14,18,.86);pointer-events:auto;box-sizing:border-box}
.mi-mini[hidden]{display:none}
.mi-mini h3{margin:0 0 4px;font-size:18px}
.mi-mini p{margin:4px 0;color:var(--ink-2);font-size:14px}
.mi-mini .bar{position:relative;height:22px;border-radius:11px;background:rgba(255,255,255,.12);margin:10px 0;overflow:hidden}
.mi-mini .bar i{position:absolute;top:0;bottom:0;background:rgba(155,227,138,.55)}
.mi-mini .bar b{position:absolute;top:-3px;bottom:-3px;width:6px;margin-left:-3px;border-radius:3px;background:#fff;box-shadow:0 0 8px #fff}
.mi-mini .btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.mi-mini button{min-height:46px;flex:1 1 140px;padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;font:800 15px system-ui;cursor:pointer}
.mi-mini button.primary{background:var(--accent);color:#1b1408;border:0}
.mi-mini .big{font:900 34px/1 system-ui;text-align:center;margin:8px 0;font-variant-numeric:tabular-nums}
.mi-dbg{position:absolute;left:16px;bottom:16px;min-height:44px;padding:8px 12px;border-radius:12px;border:1px dashed rgba(255,255,255,.5);background:rgba(0,0,0,.55);color:#fff;font:800 12px system-ui;pointer-events:auto;cursor:pointer}
@media (max-width:640px){.mi-map{width:110px;height:110px}.mi-obj b{font-size:14px}.mi-prompt{bottom:150px}}
`;

export interface Reward { label: string }

export class MissionUi {
  readonly root: HTMLElement;
  private obj = el("div", "mi-obj");
  private objTitle = el("small");
  private objText = el("b");
  private objDist = el("span");
  private marker = el("div", "mi-marker");
  private markerLabel = el("em");
  private map = el("div", "mi-map");
  private mapCanvas = el("canvas");
  private mapBase: HTMLCanvasElement;
  private money = el("div", "mi-money", "₦0");
  private stam = el("div", "mi-stam");
  private stamBar = el("i");
  private boosts = el("div", "mi-boosts");
  private prompt = el("div", "mi-prompt");
  private card = el("div", "mi-card");
  private choice = el("div", "mi-choice");
  private title = el("div", "mi-title");
  private cal = el("div", "mi-cal");
  private insertEl = el("div", "mi-insert");
  readonly panel = el("div", "mi-panel");
  readonly mini = el("div", "mi-mini");
  private choiceKeys: ((k: string) => boolean) | null = null;
  onPrompt: (() => void) | null = null;
  private cardTimer = 0;

  constructor(host: HTMLElement) {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.append(style);
    this.root = el("div");
    this.root.style.cssText = "position:absolute;inset:0;pointer-events:none";
    this.obj.append(this.objTitle, this.objText, this.objDist);
    this.obj.hidden = true;
    this.marker.append(el("i"), this.markerLabel);
    this.marker.style.opacity = "0";
    this.mapCanvas.width = this.mapCanvas.height = 300;
    this.map.append(this.mapCanvas);
    this.stam.append(this.stamBar);
    this.prompt.hidden = true;
    this.prompt.onclick = (e) => {
      e.stopPropagation();
      this.onPrompt?.();
    };
    this.choice.hidden = true;
    this.panel.hidden = true;
    this.mini.hidden = true;
    this.root.append(this.marker, this.obj, this.map, this.money, this.stam, this.boosts, this.prompt, this.card, this.choice, this.title, this.cal, this.insertEl, this.mini, this.panel);
    host.append(this.root);
    this.mapBase = drawMapBase();
    this.setPlaying(false);
  }

  /** Show or hide the gameplay HUD (objective, map, money...) — hidden during cutscenes. */
  setPlaying(on: boolean): void {
    for (const e of [this.map, this.money, this.stam, this.boosts]) e.style.display = on ? "" : "none";
    if (!on) {
      this.marker.style.opacity = "0";
      this.prompt.hidden = true;
    }
    this.obj.style.display = on ? "" : "none";
  }

  objective(mission: string | null, text: string | null): void {
    if (!text) {
      this.obj.hidden = true;
      return;
    }
    this.obj.hidden = false;
    this.objTitle.textContent = mission ?? "";
    this.objText.textContent = text;
  }

  distance(m: number | null, where?: string): void {
    this.objDist.textContent = m === null ? "" : `${where ? where + " · " : ""}${m < 1000 ? Math.round(m) + " m" : (m / 1000).toFixed(1) + " km"}`;
  }

  /** Place the marker at screen coordinates (px), or hide it. Off-screen targets clamp to the edge. */
  markerAt(x: number | null, y = 0, behind = false, label = ""): void {
    if (x === null) {
      this.marker.style.opacity = "0";
      return;
    }
    const W = this.root.clientWidth, H = this.root.clientHeight, pad = 34;
    let px = x, py = y;
    let edge = behind || px < pad || py < pad || px > W - pad || py > H - pad;
    if (behind) {
      px = W - px;
      py = H - pad;
    }
    px = Math.max(pad, Math.min(W - pad, px));
    py = Math.max(pad, Math.min(H - pad, py));
    if (edge && !behind && x > pad && x < W - pad && y > pad && y < H - pad) edge = false;
    this.marker.classList.toggle("edge", edge);
    this.marker.style.transform = `translate(${px}px, ${py}px)`;
    this.marker.style.opacity = "1";
    this.markerLabel.textContent = label;
  }

  /** Draw the minimap: player at the centre, map turned so up is where the camera looks. */
  minimap(px: number, pz: number, camYaw: number, tx: number | null, tz: number | null, inside: string | null): void {
    const c = this.mapCanvas, g = c.getContext("2d")!;
    const S = 300, scale = 1.25; // pixels per metre
    g.clearRect(0, 0, S, S);
    g.save();
    g.translate(S / 2, S / 2);
    if (inside) {
      g.fillStyle = "rgba(255,255,255,.08)";
      g.fillRect(-S / 2, -S / 2, S, S);
      g.fillStyle = "#fff";
      g.font = "700 22px system-ui";
      g.textAlign = "center";
      g.fillText(inside, 0, -60);
    } else {
      g.rotate(camYaw - Math.PI);
      // The base map is drawn at 1 px = 2 m around (0, -60); place it under the player.
      const k = scale * 2;
      g.drawImage(this.mapBase, -(px - MAP0.x) * scale - (MAP0.w / 2) * k, -(pz - MAP0.z) * scale - (MAP0.h / 2) * k, MAP0.w * k, MAP0.h * k);
      if (tx !== null && tz !== null) {
        let dx = (tx - px) * scale, dz = (tz - pz) * scale;
        const d = Math.hypot(dx, dz), R = S / 2 - 16;
        if (d > R) {
          dx = (dx / d) * R;
          dz = (dz / d) * R;
        }
        g.fillStyle = "#f2b33d";
        g.strokeStyle = "#000";
        g.lineWidth = 3;
        g.beginPath();
        g.arc(dx, dz, 9, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
    }
    g.restore();
    // The player arrow (always pointing up = camera direction).
    g.fillStyle = "#fff";
    g.strokeStyle = "#000";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(S / 2, S / 2 - 13);
    g.lineTo(S / 2 + 9, S / 2 + 9);
    g.lineTo(S / 2, S / 2 + 4);
    g.lineTo(S / 2 - 9, S / 2 + 9);
    g.closePath();
    g.stroke();
    g.fill();
  }

  setMoney(n: number): void {
    this.money.textContent = `₦${n.toLocaleString("en-GB")}`;
  }

  setStamina(f: number, frozen: boolean): void {
    this.stamBar.style.width = `${Math.round(Math.max(0, Math.min(1, f)) * 100)}%`;
    this.stamBar.style.background = frozen ? "linear-gradient(90deg,#c76bd6,#f2b33d)" : "";
  }

  setBoosts(list: { name: string; left: number }[]): void {
    this.boosts.innerHTML = "";
    for (const b of list) this.boosts.append(el("div", "mi-boost", `${b.name} ${Math.ceil(b.left)}s`));
  }

  showPrompt(label: string | null): void {
    if (!label) {
      this.prompt.hidden = true;
      return;
    }
    this.prompt.hidden = false;
    this.prompt.innerHTML = "";
    this.prompt.append(el("kbd", "", "E"), el("span", "", label));
  }

  /** Mission start / passed cards. */
  showCard(kicker: string, titleText: string, sub = "", rewards: string[] = [], ms = 3600): void {
    this.card.innerHTML = "";
    this.card.append(el("small", "", kicker), el("h2", "", titleText));
    if (sub) this.card.append(el("p", "", sub));
    if (rewards.length) {
      const ul = el("ul");
      for (const r of rewards) ul.append(el("li", "", r));
      this.card.append(ul);
    }
    this.card.classList.add("on");
    clearTimeout(this.cardTimer);
    this.cardTimer = window.setTimeout(() => this.card.classList.remove("on"), ms);
  }

  /** A dialogue choice: resolves with the picked index (keys 1..n, click or tap). */
  ask(question: string, options: string[]): Promise<number> {
    return new Promise((resolve) => {
      this.choice.innerHTML = "";
      if (question) this.choice.append(el("p", "", question));
      const pick = (i: number) => {
        this.choice.hidden = true;
        this.choiceKeys = null;
        resolve(i);
      };
      options.forEach((o, i) => {
        const b = el("button");
        b.type = "button";
        b.append(el("kbd", "", String(i + 1)), el("span", "", o));
        b.onclick = (e) => {
          e.stopPropagation();
          pick(i);
        };
        this.choice.append(b);
      });
      this.choice.hidden = false;
      this.choiceKeys = (k) => {
        const n = Number(k);
        if (n >= 1 && n <= options.length) {
          pick(n - 1);
          return true;
        }
        return false;
      };
    });
  }

  /** Feed key presses to an open choice. */
  key(k: string): boolean {
    return this.choiceKeys ? this.choiceKeys(k) : false;
  }

  get choosing(): boolean {
    return !!this.choiceKeys;
  }

  titleCard(text: string | null): void {
    if (text) {
      this.title.innerHTML = "";
      this.title.append(el("b", "", text));
    }
    this.title.classList.toggle("on", !!text);
  }

  calendar(text: string | null): void {
    if (text) this.cal.textContent = text;
    this.cal.classList.toggle("on", !!text);
  }

  /** Close-up inserts drawn on a canvas (no real photos, ever). */
  insert(kind: "note" | "photo" | "logbook" | "logbook_stub" | "kb_board" | "plug_sign" | null, playerTop = "#2a5fa8"): void {
    if (!kind) {
      this.insertEl.classList.remove("on");
      return;
    }
    this.insertEl.innerHTML = "";
    this.insertEl.append(drawInsert(kind, playerTop));
    this.insertEl.classList.add("on");
  }

  /** Open a full-screen sheet (journal, debug). Returns the sheet element to fill. */
  sheet(onClose?: () => void): HTMLElement {
    this.panel.innerHTML = "";
    const s = el("div", "mi-sheet");
    this.panel.append(s);
    this.panel.hidden = false;
    this.panel.onclick = (e) => {
      if (e.target === this.panel) {
        this.closeSheet();
        onClose?.();
      }
    };
    return s;
  }

  closeSheet(): void {
    this.panel.hidden = true;
    this.panel.innerHTML = "";
  }

  get sheetOpen(): boolean {
    return !this.panel.hidden;
  }

  debugButton(onClick: () => void): void {
    const b = el("button", "mi-dbg", "Missions (debug)");
    b.type = "button";
    b.onclick = (e) => {
      e.stopPropagation();
      onClick();
    };
    this.root.append(b);
  }
}

/* ------------------------------------------------------------ minimap base */

const MAP0 = { x: 0, z: -60, w: 300, h: 300 }; // centre (m) and size (px at 2 m per px)

function drawMapBase(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = MAP0.w;
  c.height = MAP0.h;
  const g = c.getContext("2d")!;
  const X = (x: number) => (x - MAP0.x) / 2 + MAP0.w / 2;
  const Z = (z: number) => (z - MAP0.z) / 2 + MAP0.h / 2;
  g.fillStyle = "#3d5a3a";
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = "#5c5f63";
  g.lineCap = "round";
  for (const r of roads) {
    g.lineWidth = r.width / 2;
    g.beginPath();
    r.line.forEach((p, i) => (i ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1]))));
    g.stroke();
  }
  for (const k of [RB, CLOCK]) {
    g.lineWidth = (k.outer - k.island) / 2;
    g.beginPath();
    g.arc(X(k.x), Z(k.z), (k.outer + k.island) / 4, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = "#c9b896";
  for (const b of buildings) {
    g.save();
    g.translate(X(b.x), Z(b.z));
    g.rotate(-b.rot);
    g.fillRect(-b.w / 4, -b.d / 4, b.w / 2, b.d / 2);
    g.restore();
  }
  return c;
}

/* ------------------------------------------------------------ inserts */

function drawInsert(kind: string, top: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = 440;
  const g = c.getContext("2d")!;
  const rnd = (() => {
    let s = 7;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
  })();
  const dots = (cx: number, cy: number, r: number, dr: number, rubbed = false) => {
    g.fillStyle = "#2b2b2b";
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 - Math.PI / 2;
      g.beginPath();
      g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, dr, 0, Math.PI * 2);
      g.fill();
    }
    if (rubbed) {
      g.fillStyle = "rgba(160,150,130,.55)";
      g.beginPath();
      g.ellipse(cx, cy, dr * 2.6, dr * 2.1, 0.4, 0, Math.PI * 2);
      g.fill();
    } else {
      g.beginPath();
      g.arc(cx, cy, dr, 0, Math.PI * 2);
      g.fill();
    }
  };
  if (kind === "note") {
    g.fillStyle = "#f6f0e2";
    g.fillRect(40, 30, 560, 380);
    g.strokeStyle = "rgba(0,0,0,.08)";
    g.beginPath();
    g.moveTo(40, 220);
    g.lineTo(600, 220);
    g.stroke();
    g.fillStyle = "#1d2a44";
    g.font = "italic 40px Georgia, serif";
    g.textAlign = "center";
    g.fillText("The Maker is watching.", 320, 180);
    g.fillText("Welcome.", 320, 240);
    dots(320, 320, 28, 7);
  } else if (kind === "photo") {
    // A camera's screen: the matric class photo, rows of tiny gowned figures, and a gap at the back left.
    g.fillStyle = "#111";
    g.fillRect(0, 0, 640, 440);
    g.fillStyle = "#6f9a5a";
    g.fillRect(30, 30, 580, 380);
    g.fillStyle = "#b9764e";
    g.fillRect(30, 30, 580, 120);
    for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 16; k++) {
        if (row === 0 && k === 1) continue; // the gap, one person wide
        const x = 60 + k * 34 + (row % 2) * 12, y = 130 + row * 62;
        g.fillStyle = row === 0 && k === 0 ? "#2f8a4c" : "#1d1d24";
        g.fillRect(x - 11, y, 22, 40);
        g.fillStyle = ["#8d5b3c", "#a06a46", "#c68a5e", "#b5794f"][Math.floor(rnd() * 4)]!;
        g.beginPath();
        g.arc(x, y - 6, 9, 0, Math.PI * 2);
        g.fill();
      }
    }
    // A flag in the back row (the boy beside the gap), and the end of the bench.
    g.fillStyle = "#2f8a4c";
    g.fillRect(48, 96, 4, 40);
    g.fillRect(52, 96, 18, 12);
    g.strokeStyle = "rgba(255,255,255,.85)";
    g.lineWidth = 3;
    g.strokeRect(80, 110, 50, 70);
    // The kite: you, front row, gown blown up like a sail, in your own colours.
    g.fillStyle = top;
    g.beginPath();
    g.moveTo(330, 330);
    g.lineTo(390, 300);
    g.lineTo(380, 380);
    g.closePath();
    g.fill();
    g.fillStyle = "#fff";
    g.font = "700 18px system-ui";
    g.fillText("IMG_0412  ◀ ▶", 470, 404);
  } else if (kind === "logbook" || kind === "logbook_stub") {
    g.fillStyle = "#e8dcbc";
    g.fillRect(20, 20, 600, 400);
    g.strokeStyle = "rgba(60,90,140,.25)";
    for (let y = 60; y < 410; y += 22) {
      g.beginPath();
      g.moveTo(30, y);
      g.lineTo(610, y);
      g.stroke();
    }
    g.fillStyle = "#3a2a1a";
    g.font = "700 20px Georgia, serif";
    g.fillText("40", 590, 50);
    // Six circles in a ring joined by one line, each labelled in small capitals; the centre rubbed shiny.
    const cx = 320, cy = 230, R = 120;
    g.strokeStyle = "#2b2b2b";
    g.lineWidth = 2;
    g.beginPath();
    for (let k = 0; k <= 6; k++) {
      const a = (k / 6) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      if (k === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R;
      g.beginPath();
      g.arc(x, y, 16, 0, Math.PI * 2);
      g.stroke();
      // The place names are too small and faded to read (the story never says which six places).
      g.fillStyle = "rgba(43,43,43,.55)";
      const ly = y + (Math.sin(a) > 0 ? 30 : -30);
      for (let w = 0; w < 3; w++) g.fillRect(x - 26 + w * 19, ly, 14, 3);
    }
    const shine = g.createRadialGradient(cx, cy, 2, cx, cy, 30);
    shine.addColorStop(0, "rgba(255,255,255,.75)");
    shine.addColorStop(1, "rgba(232,220,188,0)");
    g.fillStyle = shine;
    g.beginPath();
    g.arc(cx, cy, 30, 0, Math.PI * 2);
    g.fill();
    if (kind === "logbook_stub") {
      // Page 41 is gone: a yellowed stub cut along the gutter.
      g.fillStyle = "#d8c690";
      g.fillRect(612, 20, 22, 400);
      g.strokeStyle = "#8a7a4a";
      g.beginPath();
      g.moveTo(634, 20);
      g.lineTo(634, 420);
      g.stroke();
    }
  } else if (kind === "kb_board") {
    g.fillStyle = "#1f2a24";
    g.fillRect(20, 20, 600, 400);
    g.fillStyle = "#e9eee9";
    g.font = "700 30px 'Comic Sans MS', 'Chalkboard', cursive";
    const lines = ["KB'S PRICES (TODAY)", "Sugar ........ ₦400", "Indomie ...... ₦250", "Candles ...... ₦150", "TORCH BATTERIES  ₦900 !!", "(no reason)"];
    lines.forEach((l, i) => g.fillText(l, 50, 80 + i * 58));
  } else if (kind === "plug_sign") {
    g.fillStyle = "#c9a46a";
    g.fillRect(40, 60, 560, 320);
    g.fillStyle = "#1d1d1d";
    g.font = "900 64px 'Arial Black', sans-serif";
    g.textAlign = "center";
    g.fillText("THE PLUG.", 320, 190);
    g.font = "700 40px 'Marker Felt', 'Comic Sans MS', sans-serif";
    g.fillText("I KNOW A GUY.", 320, 270);
  }
  return c;
}
