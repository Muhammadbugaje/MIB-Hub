/**
 * Momentum Cup, headless.
 *
 * The game itself (apps/web/public/play/_shared/js/games/kickoff.js plus the
 * arcade runtime) is a plain browser script. This file gives it just enough of
 * a DOM to boot, then checks the rules of the match instead of its looks:
 *
 *   - a match runs to full time without the ball leaving the pitch;
 *   - a kick goes where you aim, not only where you happen to face;
 *   - the range the game prints for a kick matches where the ball really
 *     lands, within the model's own assumptions;
 *   - career upgrades cost coins, cap out, and reach the squad.
 */
/* The game is untyped legacy browser JS with a debug handle on `window`; a loose record type is the honest fit here. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

const GAMES = join(process.cwd(), "apps/web/public/play/_shared/js/games");
const noop = () => {};

type AnyRecord = Record<string, any>;

function ctx(): AnyRecord {
  const grad = { addColorStop: noop };
  return new Proxy({} as AnyRecord, {
    get: (t, k: string) =>
      k in t
        ? t[k]
        : k === "measureText"
          ? (s: string) => ({ width: String(s).length * 7 })
          : k === "createLinearGradient" || k === "createRadialGradient"
            ? () => grad
            : k === "createPattern"
              ? () => ({})
              : noop,
    set: (t, k: string, v) => {
      t[k] = v;
      return true;
    },
  });
}

function el(): AnyRecord {
  return {
    style: {},
    children: [],
    childNodes: [],
    hidden: true,
    innerHTML: "",
    value: "",
    textContent: "",
    classList: { add: noop, remove: noop, toggle: noop },
    addEventListener: noop,
    getContext: ctx,
    getAttribute: () => "",
    setAttribute: noop,
    removeAttribute: noop,
    querySelector: () => el(),
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540 }),
    appendChild: noop,
    insertBefore: noop,
    remove: noop,
    focus: noop,
    click: noop,
    closest: () => null,
    width: 960,
    height: 540,
  };
}

interface Booted {
  api: AnyRecord;
  game: AnyRecord;
  S: AnyRecord;
  MomentumCup: AnyRecord;
  Career: AnyRecord;
  UI: AnyRecord;
  overlay: AnyRecord;
  click: (act: string) => void;
  step: (frames: number) => void;
  dialogs: () => string;
}

/** Boot the real scripts once; each test then starts from the menu. */
function boot(): Booted {
  const g = globalThis as AnyRecord;
  const ls: Record<string, string> = {};
  const listeners: Record<string, Array<(e: AnyRecord) => void>> = {};
  let dlg: AnyRecord | null = null;

  const overlay: AnyRecord = {
    hidden: true,
    onclick: null,
    classList: { add: noop, remove: noop },
    _h: "",
    get innerHTML() {
      return this._h;
    },
    set innerHTML(v: string) {
      this._h = v;
      dlg = v
        ? Object.assign(el(), {
            attrs: {} as Record<string, string>,
            html: v,
            setAttribute(this: AnyRecord, k: string, x: string) {
              this.attrs[k] = x;
            },
            removeAttribute(this: AnyRecord, k: string) {
              delete this.attrs[k];
            },
            querySelector: () => null,
          })
        : null;
    },
    querySelector(sel: string) {
      if (this.hidden || !dlg) return null;
      if (sel === ".gm-dlg") return dlg;
      if (sel === "[data-cer]") return dlg.attrs["data-cer"] ? dlg : null;
      return null;
    },
  };

  const stage = Object.assign(el(), {
    getAttribute: (k: string) => (k === "data-gm-slug" ? "momentum-cup" : ""),
    querySelector: (s: string) => (s === "[data-gm-overlay]" ? overlay : s === ".gm-hero-skip" ? null : el()),
  });

  g.window = g;
  g.self = g;
  g.addEventListener = (n: string, f: (e: AnyRecord) => void) => {
    (listeners[n] = listeners[n] || []).push(f);
  };
  g.removeEventListener = noop;
  g.matchMedia = () => ({ matches: false, addEventListener: noop });
  g.requestAnimationFrame = noop;
  g.devicePixelRatio = 1;
  g.localStorage = {
    getItem: (k: string) => (k in ls ? ls[k] : null),
    setItem: (k: string, v: string) => {
      ls[k] = String(v);
    },
  };
  g.performance = { now: () => Date.now() };
  g.document = {
    documentElement: el(),
    body: el(),
    readyState: "complete",
    hidden: false,
    currentScript: null,
    head: el(),
    createElement: () => el(),
    addEventListener: (n: string, f: (e: AnyRecord) => void) => {
      (listeners[n] = listeners[n] || []).push(f);
    },
    querySelector: (s: string) =>
      s === "[data-gm-stage]" ? stage : /gm-me|gm-cast|gm-api|gm-filters|gm-villain|privacy|gm-empty/.test(s) ? null : el(),
    querySelectorAll: () => [],
  };
  g.setTimeout = (f: () => void) => {
    f();
    return 0;
  };

  const load = (file: string) => {
    new Function(readFileSync(join(GAMES, `${file}.js`), "utf8"))();
  };
  load("kickoff-career");
  load("arcade");
  load("kickoff");

  const D = g.EEArcadeDebug;
  const click = (act: string) => {
    const on = overlay.onclick;
    if (!on) return;
    on({
      target: {
        closest: () => ({
          getAttribute: (k: string) => (k === "data-act" ? act : "einstein"),
          parentNode: { children: [] },
        }),
      },
    });
  };
  return {
    api: D.api,
    game: D.game,
    S: g.MomentumCup.S,
    MomentumCup: g.MomentumCup,
    Career: g.MomentumCareer,
    UI: g.KickCareerUI,
    overlay,
    click,
    step: (n: number) => D.step(n),
    dialogs: () => String(overlay._h || ""),
  };
}

/** Start a quick match through the real menus. */
function startQuick(b: Booted): void {
  b.click("quick");
  b.click("go");
  b.click("kickoff");
}

describe("Momentum Cup match engine", () => {
  let b: Booted;
  beforeEach(() => {
    b = boot();
  });

  it("plays a quick match to full time without the ball escaping the pitch", () => {
    startQuick(b);
    const S = b.S;
    expect(S.mode).toBe("quick");
    S.p.forEach((p: AnyRecord) => {
      p.cpu = true;
      p.skill = 0.7;
    });
    S.time = S.len = 8; // a short match; the clock only runs while the ball is live
    const WM = 960 / 55;
    for (let i = 0; i < 90 * 120; i++) {
      b.step(1);
      const ball = S.ball;
      expect(Number.isFinite(ball.x) && Number.isFinite(ball.y)).toBe(true);
      expect(ball.x).toBeGreaterThanOrEqual(-0.5);
      expect(ball.x).toBeLessThanOrEqual(WM + 0.5);
      expect(ball.y).toBeGreaterThanOrEqual(-0.5);
      if (S.over) break;
    }
    expect(S.state).toBe("over");
    expect(Number.isInteger(S.score[0]) && Number.isInteger(S.score[1])).toBe(true);
  });

  it("sends the ball the way you are holding, even behind you", () => {
    startQuick(b);
    const { S, MomentumCup: M } = b;
    const p = S.p[0];
    p.cpu = false;
    S.state = "play";
    S.ball.hold = false;
    S.ball.x = p.x - 0.9; // behind the boot, on the wrong side for the old code
    S.ball.y = 0.3;
    S.ball.vx = 0;
    S.ball.vy = 0;
    p.face = 1;
    expect(M.reach(p, -1, S.ball)).toBe(true);
    expect(M.reach(p, 1, S.ball)).toBe(false);
    expect(M.kick(b.api, p, false, -1)).toBe(true);
    expect(p.face).toBe(-1);
    expect(S.ball.vx).toBeLessThan(0);
    // and the un-aimed kick still follows the facing
    p.kcool = 0;
    S.ball.x = p.x - 0.9;
    S.ball.y = 0.3;
    M.kick(b.api, p, false, 0);
    expect(S.ball.vx).toBeLessThan(0);
  });

  it("prints a range that matches where the ball actually lands", () => {
    startQuick(b);
    const { S, MomentumCup: M } = b;
    const p = S.p[0];
    p.cpu = false;
    S.p[1].cpu = false; // no CPU chasing the shot: the kick touches the ball and nothing else
    S.p[1].x = 0.6;
    S.p[1].y = 0;
    S.item = null;
    S.state = "play";
    S.ball.hold = false;
    p.x = 2.2; // a softer kick, so the flight ends on open turf well before the far goal
    p.c.power = 0.5;
    S.ball.x = p.x + 1.3; // in reach, but clear of the body, so the kick is the only thing that touches it
    S.ball.y = 0.3;
    S.ball.vx = 0;
    S.ball.vy = 0;
    M.kick(b.api, p, false, 1);
    const ghost = S.ghost;
    const x0 = S.ball.x;
    let landed = null;
    for (let i = 0; i < 600 && landed === null; i++) {
      b.step(1);
      if (i > 6 && S.ball.y <= 0.25) landed = S.ball.x;
    }
    expect(landed).not.toBeNull();
    const measured = Math.abs(landed! - x0);
    expect(measured).toBeGreaterThan(0);
    // exactly where the parabola says: struck from height y0 it travels a little further than the ground-to-ground R
    // the ball leaves the boot at 0.3 m and lands on the turf at 0.24 m
    const vy = Math.abs(ghost.vy), vx = Math.abs(ghost.vx), t = (vy + Math.sqrt(vy * vy + 2 * 9.8 * (0.3 - 0.24))) / 9.8;
    expect(Math.abs(measured - vx * t) / measured).toBeLessThan(0.04);
    expect(Math.abs(measured - ghost.R) / measured).toBeLessThan(0.15); // the printed R ignores the launch height
  });

  it("draws every state without throwing, including the shot guide", () => {
    const { S, api } = b;
    const D = (globalThis as AnyRecord).EEArcadeDebug;
    startQuick(b);
    // the guide is live during play when the ball is in reach
    const p = S.p[0];
    p.cpu = false;
    S.state = "play";
    S.ball.hold = false;
    S.ball.x = p.x + 0.8;
    S.ball.y = 0.4;
    b.step(2);
    expect(S.guide).toBe(true);
    for (const state of ["play", "kickoff", "celebrate", "intro"]) {
      S.state = state;
      if (state === "intro") S.intro = { p, P: p.P, t: 0.3, dur: 0.85 };
      expect(() => D.paint()).not.toThrow();
    }
    S.state = "over";
    S.post = { t: 2, win: 0, champ: true, podium: 1 };
    expect(() => D.paint()).not.toThrow();
    expect(() => b.game?.draw?.(api)).not.toThrow();
  });

  it("turns the shot guide on for matches and off from the setting", () => {
    startQuick(b);
    expect(b.S.guide).toBe(true);
    expect(b.api.settings.get("mcGuide")).toBe(true);
    b.click("menu");
    b.api.settings.set("mcGuide", false);
    startQuick(b);
    expect(b.S.guide).toBe(false);
  });
});

describe("Momentum Cup career upgrades", () => {
  let b: Booted;
  beforeEach(() => {
    b = boot();
  });

  it("costs coins, caps at five levels and lifts the squad", () => {
    const C = b.Career;
    const P = C.create({ name: "Manager", club: "Test FC", seed: 5 });
    P.coins = 1e6;
    const before = C.squadPower(P);
    const costs: number[] = [];
    for (let i = 0; i < 5; i++) {
      costs.push(C.upgradeCost(P, "power"));
      expect(C.buyUpgrade(P, "power")).toBe(true);
    }
    expect(costs).toEqual([...costs].sort((x, y) => x - y)); // each level costs more
    expect(C.upgradeLevel(P, "power")).toBe(5);
    expect(C.upgradeCost(P, "power")).toBe(0);
    expect(C.buyUpgrade(P, "power")).toBe(false); // maxed
    expect(C.upgradeMult(P, "power")).toBeCloseTo(1.2, 5);
    expect(C.squadPower(P)).toBeGreaterThan(before);
  });

  it("cannot buy without the coins", () => {
    const C = b.Career;
    const P = C.create({ name: "Manager", club: "Broke FC", seed: 6 });
    P.coins = 0;
    expect(C.buyUpgrade(P, "speed")).toBe(false);
    expect(C.upgradeLevel(P, "speed")).toBe(0);
  });

  it("applies the upgrades to the match character and shows the screen", () => {
    const C = b.Career;
    const P = C.create({ name: "Manager", club: "Test FC", seed: 7 });
    P.coins = 1e6;
    C.buyUpgrade(P, "power");
    b.UI.P = P;
    const plain = b.MomentumCup.player(b.UI.careerChar("k0", 1, P.club, 1), 0);
    P.upgrades.power = 5;
    const boosted = b.MomentumCup.player(b.UI.careerChar("k0", 1, P.club, 1), 0);
    expect(boosted.c.power).toBeGreaterThan(plain.c.power);
    b.click("career");
    b.click("make");
    expect(b.dialogs()).toContain("Upgrades");
  });
});

describe("Momentum Cup custom players and outfits", () => {
  let b: Booted;
  beforeEach(() => {
    b = boot();
  });

  it("designs a player, signs them and puts them in the squad", () => {
    const C = b.Career;
    const P = C.create({ name: "Manager", club: "Test FC", seed: 11 });
    P.coins = 2000;
    const spec = C.makeCustom(P, { name: "Ada Vector", power: "curve", bio: "Left foot like a ruler", price: 900 });
    expect(spec).not.toBeNull();
    expect(C.customList(P)).toHaveLength(1);
    expect(C.customOwned(P, spec!.id)).toBe(false);
    expect(C.setSquad(P, [spec!.id])).toBe(false); // unsigned players cannot be fielded
    expect(C.signCustom(P, spec!.id)).toBe(true);
    expect(P.coins).toBe(1100);
    expect(C.customOwned(P, spec!.id)).toBe(true);
    expect(C.setSquad(P, [spec!.id])).toBe(true);
    const player = C.customPlayerOf(P, spec!.id);
    expect(player.name).toBe("Ada Vector");
    expect(player.pw).toBe("curve");
    expect(C.rating(player, 1)).toBeGreaterThan(0);
  });

  it("will not sign without the coins, and unlocks free with the right flag", () => {
    const C = b.Career;
    const P = C.create({ name: "Manager", club: "Broke FC", seed: 12 });
    P.coins = 10;
    const spec = C.makeCustom(P, { name: "Costly", price: 5000 })!;
    expect(C.signCustom(P, spec.id)).toBe(false);
    expect(C.customOwned(P, spec.id)).toBe(false);
    expect(C.unlockCustom(P, spec.id)).toBe(true); // the code check happens before this call
    expect(C.customOwned(P, spec.id)).toBe(true);
  });

  it("keeps a studio character signed when the owner edits the catalogue", () => {
    const C = b.Career;
    const P = C.create({ name: "Manager", club: "Studio FC", seed: 13 });
    C.syncStudio(P, [{ id: "s1", name: "Signature One", price: 1200, power: "curve", bio: "First edition" }]);
    expect(C.custom(P, "s1")!.studio).toBe(true);
    expect(C.customOwned(P, "s1")).toBe(false);
    C.unlockCustom(P, "s1");
    C.syncStudio(P, [{ id: "s1", name: "Signature One", price: 1500, power: "curve", bio: "Second edition" }]);
    expect(C.custom(P, "s1")!.price).toBe(1500);
    expect(C.customOwned(P, "s1")).toBe(true); // never removed from the club by a price change
  });

  it("buys an outfit once, then wears it", () => {
    const C = b.Career;
    const P = C.create({ name: "Manager", club: "Kit FC", seed: 14 });
    P.coins = 1000;
    expect(C.ownsKit(P, "k0")).toBe(true);
    expect(C.buyKit(P, "k1")).toBe(true);
    expect(P.coins).toBe(750);
    expect(C.buyKit(P, "k1")).toBe(false); // already owned
    expect(C.equipKit(P, "k1")).toBe(true);
    const kit = C.kitById("k1")!;
    expect(P.club.c1).toBe(kit.c1);
    expect(P.club.c2).toBe(kit.c2);
    expect(C.equipKit(P, "k7")).toBe(false); // not owned yet
  });

  it("pays match coins into a purse, and the purse joins a new career", () => {
    expect(b.UI.wallet()).toBe(0);
    expect(b.UI.credit(150)).toBe(150);
    expect(b.UI.wallet()).toBe(150);
    b.click("career");
    b.click("make");
    expect(b.UI.P.coins).toBe(550); // 400 starting coins + the purse
    expect(b.UI.wallet()).toBe(550);
  });

  it("dashes on a second tap of the same direction inside the window", () => {
    const M = b.MomentumCup;
    const p = { tapDir: 0, tapT: 0 };
    expect(M.dbg.tapDash(p, -1, 10)).toBe(false); // first tap arms it
    expect(M.dbg.tapDash(p, -1, 10.2)).toBe(true); // second tap inside 260 ms dashes
    expect(M.dbg.tapDash(p, -1, 10.2)).toBe(false); // and the counter resets
    expect(M.dbg.tapDash(p, 1, 10.2)).toBe(false); // a different direction arms, never dashes
    expect(M.dbg.tapDash(p, 1, 10.9)).toBe(false); // too slow: outside the window
  });

  it("reads the owner's studio rules and clamps silly values", () => {
    const R = b.MomentumCup.readRules({
      config: { rules: { gravity: 99, ballSize: 1.3, matchLength: 10, coinRate: 2, xpRate: 0.5, dashWindow: 0.3, powerRate: 4 } },
    });
    expect(R.gravity).toBe(1.6);
    expect(R.ball).toBe(1.3);
    expect(R.len).toBe(2);
    expect(R.coins).toBe(2);
    expect(R.xp).toBe(0.5);
    expect(R.dashWindow).toBe(0.3);
    expect(R.power).toBe(2.5);
    expect(b.Career.COIN_RATE).toBe(2);
    expect(b.Career.XP_RATE).toBe(0.5);
    // the Game Studio page stores the block under `mc`, with the catalogue beside it
    const R2 = b.MomentumCup.readRules({ config: { rules: { mc: { gravity: 0.8 }, studioCharacters: [{ id: "s1", name: "One" }] } } });
    expect(R2.gravity).toBe(0.8);
    expect(R2.studio).toHaveLength(1);
  });
});
