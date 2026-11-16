/**
 * The minigames of Missions 1-10 (FORMAT.md §4 names): queue, bargain, cook,
 * steady_hand, lecture, scuffle, and the timing shots used by football
 * (pass, shoot, corner). Each runs in a small panel over the 3D view (the
 * scene keeps playing behind it), works with keyboard, mouse and touch, and
 * resolves a promise with its result. None of them can be failed for good:
 * a miss is retried kindly, as the format asks.
 *
 * The scoring rules are pure functions at the bottom (tested).
 */
import { MissionUi } from "./mission-ui.ts";

export interface MiniInput {
  /** Keys pressed this frame (lower case), plus "tap" for touches and "click". */
  pressed: Set<string>;
  moveX: number;
  moveY: number;
  /** Mouse/touch look delta this frame (px). */
  lookDX: number;
  lookDY: number;
}

interface Running {
  update(dt: number, inp: MiniInput): boolean;
  finish(): void;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

const ACTION = ["e", " ", "enter", "tap", "click"];
const hit = (inp: MiniInput) => ACTION.some((k) => inp.pressed.has(k));

export class Minigames {
  private run: Running | null = null;
  /** Clicks on panel buttons arrive here (they also count as "click"). */
  private clicked = false;
  /** Hooks for 3D reactions (the scuffle's shoves, football kicks). */
  hooks: { scuffle?: (ev: "telegraph" | "shove" | "blocked" | "knocked" | "getup") => void; kick?: (kind: string, good: boolean) => void } = {};

  constructor(private ui: MissionUi) {
    ui.mini.addEventListener("click", (e) => {
      e.stopPropagation();
      this.clicked = true;
    });
  }

  get active(): boolean {
    return !!this.run;
  }

  update(dt: number, inp: MiniInput): void {
    if (!this.run) return;
    if (this.clicked) inp.pressed.add("click");
    this.clicked = false;
    if (this.run.update(dt, inp)) {
      const r = this.run;
      this.run = null;
      r.finish();
    }
  }

  private open(title: string, body: string): HTMLElement {
    const m = this.ui.mini;
    m.innerHTML = "";
    m.append(el("h3", "", title));
    if (body) m.append(el("p", "", body));
    m.hidden = false;
    return m;
  }

  private close(): void {
    this.ui.mini.hidden = true;
    this.ui.mini.innerHTML = "";
  }

  /* ------------------------------------------------------------ queue */

  /** Hold your place: the queue shuffles forward; when someone tries to cut in, say "Excuse me" in time. */
  queue(ahead = 8, seconds = 26): Promise<{ lost: number }> {
    return new Promise((resolve) => {
      const m = this.open("The Senate queue", "Hold your place. If someone slips in front of you, say so (E / Space / tap).");
      const big = el("div", "big");
      const note = el("p");
      m.append(big, note);
      let t = 0, left = ahead, lost = 0, cut = -1, nextCut = 5 + Math.random() * 3, shuffle = 0;
      this.run = {
        update: (dt, inp) => {
          t += dt;
          shuffle += dt;
          if (shuffle > seconds / (ahead + 2) && left > 0 && cut < 0) {
            shuffle = 0;
            left--;
          }
          if (cut < 0 && t > nextCut && left > 1) {
            cut = 1.8;
            nextCut = t + 6 + Math.random() * 4;
          }
          if (cut >= 0) {
            cut -= dt;
            note.textContent = "Someone is slipping in front of you! Say \"Excuse me!\"";
            note.style.color = "#f2b33d";
            if (hit(inp)) {
              cut = -1;
              note.textContent = "\"Excuse me. There is a queue.\" They step back, embarrassed.";
              note.style.color = "";
            } else if (cut < 0) {
              lost++;
              left++;
              note.textContent = "Too slow. One more person ahead of you. Sapa of patience.";
              note.style.color = "";
            }
          }
          big.textContent = left === 0 ? "You're next!" : `${left} ahead of you`;
          return left === 0 && t > 3;
        },
        finish: () => {
          this.close();
          resolve({ lost });
        },
      };
    });
  }

  /* ------------------------------------------------------------ bargain */

  /**
   * Bargaining: the seller starts high, you offer; their patience runs down
   * with every cheeky offer; Charm makes them like you. Returns the price.
   */
  bargain(o: { seller: string; item: string; start: number; floor: number; charm: number; line?: (k: string) => string }): Promise<{ price: number }> {
    return new Promise((resolve) => {
      const m = this.open(`Bargain with ${o.seller}`, `${o.item}. They want ₦${o.start}.`);
      const big = el("div", "big", `₦${o.start}`);
      const say = el("p", "", "");
      const btns = el("div", "btns");
      m.append(big, say, btns);
      let price = o.start, patience = 3 + Math.min(2, o.charm), round = 0, done = false;
      const offerBtn = (label: string, f: number) => {
        const b = el("button", "", label);
        b.type = "button";
        b.onclick = () => act(f);
        btns.append(b);
      };
      const act = (f: number) => {
        if (done) return;
        if (f === 1) {
          done = true;
          return;
        }
        round++;
        const r = bargainStep(price, o.floor, f, patience, o.charm, round);
        price = r.price;
        patience = r.patience;
        say.textContent = r.text;
        big.textContent = `₦${price}`;
        if (r.final) {
          done = true;
          setTimeout(() => (this.run = null, this.close(), resolve({ price })), 900);
        }
      };
      offerBtn("Offer half (1)", 0.5);
      offerBtn("Meet in the middle (2)", 0.8);
      offerBtn("Deal (3)", 1);
      this.run = {
        update: (_dt, inp) => {
          if (inp.pressed.has("1")) act(0.5);
          if (inp.pressed.has("2")) act(0.8);
          if (inp.pressed.has("3")) act(1);
          return done && price === price && round >= 0 && !btns.isConnected ? true : done;
        },
        finish: () => {
          this.close();
          resolve({ price });
        },
      };
    });
  }

  /* ------------------------------------------------------------ timing bar (cook, football) */

  /** Press when the marker is in the green: `beats` attempts, returns how many landed. */
  timing(o: { title: string; text: string; beats: number; zone?: [number, number]; speed?: number; stopAfter?: number; need?: number; label?: (i: number, good: boolean) => string; onBeat?: (i: number, good: boolean) => void }): Promise<{ good: number; tries: number; stopped: boolean }> {
    return new Promise((resolve) => {
      const m = this.open(o.title, o.text);
      const bar = el("div", "bar");
      const zone = el("i");
      const mark = el("b");
      const [z0, z1] = o.zone ?? [0.4, 0.6];
      zone.style.left = `${z0 * 100}%`;
      zone.style.width = `${(z1 - z0) * 100}%`;
      bar.append(zone, mark);
      const msg = el("p", "", "Press E, Space or tap when the marker is in the green.");
      const count = el("p", "", "");
      m.append(bar, msg, count);
      let t = 0, good = 0, tries = 0, cool = 0;
      const speed = o.speed ?? 1.1;
      this.run = {
        update: (dt, inp) => {
          t += dt;
          cool -= dt;
          const p = 0.5 - 0.5 * Math.cos(t * speed * Math.PI);
          mark.style.left = `${p * 100}%`;
          if (cool <= 0 && hit(inp)) {
            tries++;
            const ok = p >= z0 && p <= z1;
            if (ok) good++;
            o.onBeat?.(tries, ok);
            msg.textContent = o.label ? o.label(tries, ok) : ok ? "Yes!" : "Not quite.";
            cool = 0.35;
          }
          count.textContent = `${good} of ${tries}${o.need ? ` (need ${o.need})` : ""}`;
          if (o.stopAfter !== undefined && tries >= o.stopAfter) return true;
          return tries >= o.beats;
        },
        finish: () => {
          this.close();
          resolve({ good, tries, stopped: o.stopAfter !== undefined && tries >= o.stopAfter });
        },
      };
    });
  }

  /* ------------------------------------------------------------ steady hand */

  /** Hold the pen torch on the cut while it drifts: four stitches of three seconds each. */
  steady(stitches = 4): Promise<{ retries: number }> {
    return new Promise((resolve) => {
      const m = this.open("Hold the torch steady", "Keep the light inside the ring (mouse, drag or WASD). Breathe. Don't drift.");
      const c = el("canvas");
      c.width = 360;
      c.height = 220;
      c.style.cssText = "display:block;width:100%;max-width:360px;margin:8px auto;border-radius:12px;background:#0b0d10";
      const msg = el("p", "", "");
      m.append(c, msg);
      const g = c.getContext("2d")!;
      let x = 0, y = 0, vx = 0, vy = 0, t = 0, hold = 0, done = 0, retries = 0, out = 0;
      this.run = {
        update: (dt, inp) => {
          t += dt;
          // The hand drifts (a wandering push), the player counters.
          vx += (Math.sin(t * 1.3) * 0.9 + Math.sin(t * 3.1 + 1) * 0.5) * dt * (1 + done * 0.25);
          vy += (Math.cos(t * 1.1) * 0.8 + Math.sin(t * 2.7) * 0.4) * dt * (1 + done * 0.25);
          vx += (inp.lookDX * 0.004 + inp.moveX * 1.6 * dt) * 1;
          vy += (inp.lookDY * 0.004 - inp.moveY * 1.6 * dt) * 1;
          vx *= Math.exp(-2.2 * dt);
          vy *= Math.exp(-2.2 * dt);
          x += vx * dt * 60;
          y += vy * dt * 60;
          x = Math.max(-150, Math.min(150, x));
          y = Math.max(-90, Math.min(90, y));
          const inside = Math.hypot(x, y) < 34;
          if (inside) {
            hold += dt;
            out = 0;
          } else {
            out += dt;
            if (out > 0.6 && hold > 0) {
              hold = 0;
              retries++;
              msg.textContent = "\"Again. Breathe first.\"";
            }
          }
          if (hold >= 3) {
            done++;
            hold = 0;
            msg.textContent = done < stitches ? `Stitch ${done}. Good. Keep still.` : "Fourth stitch. The generator coughs back to life.";
          }
          // Draw: the cut, the ring, the light.
          g.fillStyle = "#0b0d10";
          g.fillRect(0, 0, 360, 220);
          g.strokeStyle = "rgba(255,255,255,.5)";
          g.lineWidth = 2;
          g.beginPath();
          g.arc(180, 110, 34, 0, Math.PI * 2);
          g.stroke();
          g.strokeStyle = "#a83232";
          g.beginPath();
          g.moveTo(165, 104);
          g.lineTo(196, 116);
          g.stroke();
          for (let k = 0; k < done; k++) {
            g.strokeStyle = "#2b2b2b";
            g.beginPath();
            g.moveTo(170 + k * 7, 100 + k * 3);
            g.lineTo(172 + k * 7, 118 + k * 3);
            g.stroke();
          }
          const grd = g.createRadialGradient(180 + x, 110 + y, 2, 180 + x, 110 + y, 42);
          grd.addColorStop(0, "rgba(255,248,220,.85)");
          grd.addColorStop(1, "rgba(255,248,220,0)");
          g.fillStyle = grd;
          g.beginPath();
          g.arc(180 + x, 110 + y, 42, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = "#9be38a";
          g.fillRect(20, 200, (hold / 3) * 320, 6);
          return done >= stitches;
        },
        finish: () => {
          this.close();
          resolve({ retries });
        },
      };
    });
  }

  /* ------------------------------------------------------------ lecture */

  /** Catch the key lines as Dr. Okonkwo says them, then answer when the question reaches your row. */
  lecture(): Promise<{ score: number }> {
    const LINES: { t: string; key: boolean }[] = [
      { t: "Today: resistors in series and in parallel.", key: false },
      { t: "In series, resistances add: R = R1 + R2.", key: true },
      { t: "Somebody's phone is ringing. It is not mine.", key: false },
      { t: "In parallel, the reciprocals add: 1/R = 1/R1 + 1/R2.", key: true },
      { t: "Shamsu, you may stop nodding.", key: false },
      { t: "Two equal resistors in parallel give half of one.", key: true },
      { t: "Write that down. I said write.", key: false },
      { t: "Current divides; voltage across parallel branches is the same.", key: true },
    ];
    return new Promise((resolve) => {
      const m = this.open("Survive the lecture", "Press E, Space or tap on the KEY lines only. Then answer the question.");
      const line = el("p");
      line.style.cssText = "font-size:18px;min-height:52px;color:#fff";
      const tally = el("p");
      m.append(line, tally);
      let i = -1, t = 99, caught = 0, wrong = 0, taken = false, phase: "lines" | "question" | "done" = "lines", answer = -1;
      const next = () => {
        i++;
        t = 0;
        taken = false;
        if (i >= LINES.length) {
          phase = "question";
          line.textContent = "Dr. Okonkwo: \"Row six. Two 10-ohm resistors in parallel?\"";
          const btns = el("div", "btns");
          ["20 ohms", "5 ohms", "10 ohms"].forEach((a, k) => {
            const b = el("button", "", `${a} (${k + 1})`);
            b.type = "button";
            b.onclick = () => (answer = k);
            btns.append(b);
          });
          m.append(btns);
          return;
        }
        const L = LINES[i]!;
        line.textContent = L.t;
        line.style.color = L.key ? "#f2b33d" : "#fff";
      };
      this.run = {
        update: (dt, inp) => {
          t += dt;
          if (phase === "lines") {
            if (t > 2.6) next();
            else if (hit(inp) && !taken && i >= 0) {
              taken = true;
              if (LINES[i]!.key) caught++;
              else wrong++;
            }
            tally.textContent = `Notes: ${caught} key lines${wrong ? ` · ${wrong} doodles` : ""}`;
          } else if (phase === "question") {
            for (const k of ["1", "2", "3"]) if (inp.pressed.has(k)) answer = Number(k) - 1;
            if (answer >= 0) {
              phase = "done";
              line.textContent = answer === 1 ? "\"Correct. Somebody in row six is awake.\"" : "\"No. Shamsu, tell them.\" Shamsu: \"Simple. Five.\"";
              t = 0;
            }
          } else if (t > 1.6) return true;
          return false;
        },
        finish: () => {
          this.close();
          resolve({ score: lectureScore(caught, wrong, answer === 1) });
        },
      };
    });
  }

  /* ------------------------------------------------------------ scuffle */

  /** Three rounds against Big Sly: he cracks his knuckles, says sorry, then shoves. Block (Space) or sidestep (A/D). */
  scuffle(rounds = 3): Promise<{ knocks: number }> {
    return new Promise((resolve) => {
      const m = this.open("Stand your ground", "Watch his knuckles. When he shoves: Space to block, or A / D to sidestep. You can't win yet. Just survive.");
      const big = el("div", "big", "Round 1");
      const msg = el("p");
      m.append(big, msg);
      let round = 1, t = 0, state: "wait" | "tele" | "shove" | "down" = "wait", next = 1.6, knocks = 0;
      this.run = {
        update: (dt, inp) => {
          t += dt;
          if (state === "wait" && t > next) {
            state = "tele";
            t = 0;
            msg.textContent = "He cracks his knuckles. \"…Sorry.\"";
            this.hooks.scuffle?.("telegraph");
          } else if (state === "tele" && t > 0.9 + Math.random() * 0.02) {
            state = "shove";
            t = 0;
            msg.textContent = "SHOVE!";
            this.hooks.scuffle?.("shove");
          } else if (state === "shove") {
            const blocked = inp.pressed.has(" ") || inp.pressed.has("tap") || inp.pressed.has("click") || inp.pressed.has("a") || inp.pressed.has("d") || inp.pressed.has("arrowleft") || inp.pressed.has("arrowright");
            if (blocked && t < 0.55) {
              this.hooks.scuffle?.("blocked");
              msg.textContent = "You hold. He moves the width of a coin. \"He has pushed. He has also pushed.\"";
              round++;
              state = "wait";
              t = 0;
              next = 1.2 + Math.random();
            } else if (t >= 0.55) {
              knocks++;
              this.hooks.scuffle?.("knocked");
              msg.textContent = "Down you go. Stars. Shake your head. Get up (the round repeats).";
              state = "down";
              t = 0;
            }
          } else if (state === "down" && t > 2.2) {
            this.hooks.scuffle?.("getup");
            state = "wait";
            t = 0;
            next = 1.2;
          }
          big.textContent = round > rounds ? "Survived" : `Round ${round} of ${rounds}`;
          return round > rounds && state === "wait" && t > 0.8;
        },
        finish: () => {
          this.close();
          resolve({ knocks });
        },
      };
    });
  }

  /** Cancel whatever is running (mission abort). */
  cancel(): void {
    if (!this.run) return;
    this.run = null;
    this.close();
  }
}

/* ------------------------------------------------------------ pure scoring (tested) */

/**
 * One bargaining round: the offer is `f` of the current price. A cheeky offer
 * (well under the floor) costs patience; the seller meets you part way, never
 * below the floor; Charm softens them. With no patience left they name a
 * final price.
 */
export function bargainStep(price: number, floor: number, f: number, patience: number, charm: number, round: number): { price: number; patience: number; text: string; final: boolean } {
  const offer = Math.round(price * f);
  const meet = 0.45 + Math.min(0.25, charm * 0.08);
  let next = Math.round(price - (price - Math.max(offer, floor)) * meet);
  next = Math.max(floor, Math.round(next / 10) * 10);
  let p = patience;
  if (offer < floor) p -= 1;
  if (round >= 4 || p <= 0) return { price: Math.max(floor, next), patience: 0, text: "\"Last price. Take it or leave it, my friend.\"", final: true };
  const text = offer < floor ? "\"Ah! You want to kill me? Add something.\"" : "\"Hmm. For you, specially…\"";
  return { price: next, patience: p, text, final: next <= floor };
}

/** Lecture score 0..1: key lines caught, minus doodles, plus the right answer. */
export function lectureScore(caught: number, wrong: number, right: boolean): number {
  return Math.max(0, Math.min(1, caught / 4 * 0.7 - wrong * 0.08 + (right ? 0.3 : 0)));
}
