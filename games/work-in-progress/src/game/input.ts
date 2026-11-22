/**
 * Input: keyboard, mouse and touch, read into one simple state each frame.
 *
 *   WASD / arrows   move          Shift   run          mouse drag / right stick   look
 *   wheel           zoom          C       showcase camera
 *   T               time speed    N       jump to night/day     M   sound on/off
 *   H               hide the HUD  Esc / Enter / Space during a cutscene: skip
 *
 * On a touch screen: a joystick on the left half, drag on the right half to
 * look, and a RUN button. Events are queued and read once per frame so a key
 * tap between two frames is never lost (input buffering, plan §5.9).
 */
export interface InputState {
  moveX: number;
  moveY: number;
  run: boolean;
  /** Alt: walk slowly. */
  walk?: boolean;
  /** Space held (a short tap is a short hop). */
  jumpHeld?: boolean;
  /** Primary attack (punch). */
  punch?: boolean;
  /** Secondary attack (kick). */
  kick?: boolean;
  /** Guard: reduces damage, can parry. */
  block?: boolean;
  /** Handbrake when driving (drift). */
  handbrake?: boolean;
  lookDX: number;
  lookDY: number;
  zoom: number;
  pressed: Set<string>;
}

export class Input {
  private keys = new Set<string>();
  private pressedQ = new Set<string>();
  private lookX = 0;
  private lookY = 0;
  private wheel = 0;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private stick = { id: -1, ox: 0, oy: 0, x: 0, y: 0 };
  private lookTouch = { id: -1, x: 0, y: 0 };
  private touchRun = false;
  private showStick = false;
  private showRun = false;
  private stickEl: HTMLElement | null = null;
  private knobEl: HTMLElement | null = null;
  private runEl: HTMLElement | null = null;
  readonly touch: boolean;
  private off: (() => void)[] = [];

  constructor(private el: HTMLElement, private canvas: HTMLCanvasElement) {
    this.touch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
    const on = <K extends keyof WindowEventMap>(t: EventTarget, type: K | string, f: (e: never) => void, opts?: AddEventListenerOptions) => {
      t.addEventListener(type, f as EventListener, opts);
      this.off.push(() => t.removeEventListener(type, f as EventListener, opts));
    };
    on(window, "keydown", (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      this.pressedQ.add(k);
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    });
    on(window, "keyup", (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase()));
    on(window, "blur", () => this.keys.clear());
    on(canvas, "mousedown", (e: MouseEvent) => {
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    on(window, "mouseup", () => (this.dragging = false));
    on(window, "mousemove", (e: MouseEvent) => {
      if (!this.dragging) return;
      this.lookX += e.clientX - this.lastX;
      this.lookY += e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    on(canvas, "wheel", (e: WheelEvent) => {
      this.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
    on(canvas, "contextmenu", (e: Event) => e.preventDefault());
    on(el, "touchstart", (e: TouchEvent) => this.touchStart(e), { passive: false });
    on(el, "touchmove", (e: TouchEvent) => this.touchMove(e), { passive: false });
    on(el, "touchend", (e: TouchEvent) => this.touchEnd(e));
    on(el, "touchcancel", (e: TouchEvent) => this.touchEnd(e));
  }

  /** Show the on-screen joystick and run button (phones and tablets). */
  mountTouchUi(host: HTMLElement): void {
    const stick = document.createElement("div");
    stick.className = "wip-stick";
    const knob = document.createElement("div");
    knob.className = "wip-knob";
    stick.append(knob);
    const run = document.createElement("button");
    run.className = "wip-run";
    run.type = "button";
    run.textContent = "RUN";
    const punch = document.createElement("button");
    punch.className = "wip-punch";
    punch.type = "button";
    punch.textContent = "P";
    const kick = document.createElement("button");
    kick.className = "wip-kick";
    kick.type = "button";
    kick.textContent = "K";
    const block = document.createElement("button");
    block.className = "wip-block";
    block.type = "button";
    block.textContent = "B";
    run.addEventListener("touchstart", (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.touchRun = !this.touchRun;
      run.classList.toggle("on", this.touchRun);
    }, { passive: false });
    punch.addEventListener("touchstart", (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.tap("punch");
    }, { passive: false });
    kick.addEventListener("touchstart", (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.tap("kick");
    }, { passive: false });
    block.addEventListener("touchstart", (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.tap("block");
    }, { passive: false });
    host.append(stick, punch, kick, block, run);
    this.stickEl = stick;
    this.runEl = run;
    this.knobEl = knob;
  }

  /** Show the on-screen joystick and run button (phones and tablets). */
  showStickUI(on: boolean): void {
    this.showStick = on;
    if (this.stickEl) {
      this.stickEl.style.opacity = on ? "1" : "0";
      // ".wip-stick.on" is what the CSS uses to fade the stick in (opacity: 1).
      // Toggling only "active" (box-shadow) left the stick invisible on phones.
      this.stickEl.classList.toggle("on", on);
      this.stickEl.classList.toggle("active", on);
    }
  }

  showRunUI(on: boolean): void {
    this.showRun = on;
    if (this.runEl) {
      this.runEl.classList.toggle("on", on);
      this.runEl.classList.toggle("active", on);
    }
  }

  /** Touches on menus, panels and form controls belong to the page (tap, scroll), never to the stick or camera. */
  private static isUi(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el) return false;
    const uiSelectors = [
      "button, a, input, select, textarea, label",
      "[role=button], [data-ui]",
      ".wip-menu, .mn-screen, .mn-panel, .mn-body, .mn-side, .mn-scrim, .mn-item, .mn",
      ".wip-chips .wip-chip--text",
      ".wip-opts",
      ".wip-play",
      ".wip-stick, .wip-knob, .wip-run, .wip-punch, .wip-kick, .wip-block",
    ];
    return uiSelectors.some(selector => el.closest(selector));
  }

  private touchStart(e: TouchEvent): void {
    let game = false;
    for (const t of Array.from(e.changedTouches)) {
      if (Input.isUi(t.target)) continue;
      game = true;
      if (t.clientX < window.innerWidth * 0.50 && this.stick.id < 0) {
        this.stick = { id: t.identifier, ox: t.clientX, oy: t.clientY, x: t.clientX, y: t.clientY };
        if (this.stickEl) {
          this.stickEl.style.left = `${t.clientX - 60}px`;
          this.stickEl.style.top = `${t.clientY - 60}px`;
          this.stickEl.classList.add("on");
        }
      } else if (t.clientX >= window.innerWidth * 0.50 && this.lookTouch.id < 0) {
        this.lookTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
      }
      this.pressedQ.add("tap");
    }
    // Only claim touches that drive the game, so menus and settings can still scroll on phones.
    if (game) e.preventDefault();
  }

  private touchMove(e: TouchEvent): void {
    let game = false;
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.stick.id || t.identifier === this.lookTouch.id) game = true;
      if (t.identifier === this.stick.id) {
        this.stick.x = t.clientX;
        this.stick.y = t.clientY;
        const dx = Math.max(-50, Math.min(50, t.clientX - this.stick.ox)), dy = Math.max(-50, Math.min(50, t.clientY - this.stick.oy));
        if (this.knobEl) this.knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
      } else if (t.identifier === this.lookTouch.id) {
        this.lookX += (t.clientX - this.lookTouch.x) * 1.4;
        this.lookY += (t.clientY - this.lookTouch.y) * 1.4;
        this.lookTouch.x = t.clientX;
        this.lookTouch.y = t.clientY;
      }
    }
    if (game) e.preventDefault();
  }

  private touchEnd(e: TouchEvent): void {
    for (const t of Array.from(e.changedTouches)) {
      if (t.identifier === this.stick.id) {
        this.stick.id = -1;
        this.stickEl?.classList.remove("on");
        if (this.knobEl) this.knobEl.style.transform = "";
      }
      if (t.identifier === this.lookTouch.id) this.lookTouch.id = -1;
    }
    // Also prevent default for game touches when ending
    const game = Array.from(e.changedTouches).some((t) => {
      if (t.clientX < window.innerWidth * 0.45 && this.stick.id < 0) return true;
      if (t.clientX >= window.innerWidth * 0.45) return true;
      return false;
    });
    if (game) e.preventDefault();
  }

  /** A key press for one frame (screenshot scripts: a jump). */
  tap(key: string): void {
    this.pressedQ.add(key);
  }

  /** Hold a key down (tests and screenshot scripts). */
  hold(key: string, on = true): void {
    if (on) this.keys.add(key);
    else this.keys.delete(key);
  }

  /** Read and clear this frame's input. */
  read(): InputState {
    let mx = 0, my = 0;
    const k = this.keys;
    if (k.has("a") || k.has("arrowleft")) mx -= 1;
    const p = k.has("f") || this.keys.has("f");
    const ki = k.has("g") || this.keys.has("g");
    const b = k.has("b") || this.keys.has("b");
    const hb = k.has(" ");
    if (p !== this.keys.has("f")) this.pressedQ.add("punch");
    if (ki !== this.keys.has("g")) this.pressedQ.add("kick");
    if (b !== this.keys.has("b")) this.pressedQ.add("block");
    if (k.has("d") || k.has("arrowright")) mx += 1;
    if (k.has("w") || k.has("arrowup")) my += 1;
    if (k.has("s") || k.has("arrowdown")) my -= 1;
    if (this.stick.id >= 0) {
      mx = Math.max(-1, Math.min(1, (this.stick.x - this.stick.ox) / 50));
      my = Math.max(-1, Math.min(1, -(this.stick.y - this.stick.oy) / 50));
    }
    const l = Math.hypot(mx, my);
    if (l > 1) {
      mx /= l;
      my /= l;
    }
    const stickFar = this.stick.id >= 0 && l > 0.92;
    const out: InputState = {
      moveX: mx, moveY: my,
      run: k.has("shift") || this.touchRun || stickFar,
      walk: k.has("alt"),
      jumpHeld: k.has(" "),
      handbrake: k.has(" "),
      punch: this.pressedQ.has("punch"),
      kick: this.pressedQ.has("kick"),
      block: this.pressedQ.has("block"),
      lookDX: this.lookX, lookDY: this.lookY, zoom: this.wheel,
      pressed: new Set(this.pressedQ),
    };
    this.lookX = this.lookY = this.wheel = 0;
    this.pressedQ.clear();
    return out;
  }

  dispose(): void {
    for (const f of this.off) f();
  }
}
