/**
 * Phone play: the shared full screen (public/play/_shared/mib/mib-full.js) and
 * the round Sega-style pad (public/play/_shared/mib/mib-pad.js). Their pure
 * helpers run here without a browser; the DOM parts were checked at phone
 * sizes with scripts/screenshot.py.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WIP_START } from "../src/games/work-in-progress.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
function load(file: string, name: string): Any {
  const code = readFileSync(join(import.meta.dirname, "../public/play/_shared/mib", file), "utf8");
  const win: Record<string, unknown> = {};
  new Function("window", code)(win);
  return win[name];
}
const F = load("mib-full.js", "MIBFull");
const P = load("mib-pad.js", "MIBPad");

describe("full screen: which taps start or resume play", () => {
  it("treats Play, Start, Resume and the games' go buttons as starts", () => {
    for (const act of ["play", "start", "resume", "go", "retry", "versus", "training", "rematch", "kickoff"]) {
      expect(F.isStartAction({ act })).toBe(true);
    }
    expect(F.isStartAction({ go: true, text: "Let's go" })).toBe(true);
    expect(F.isStartAction({ text: "▶ Play" })).toBe(true);
    expect(F.isStartAction({ text: "Continue Amina · 3/10" })).toBe(true);
  });
  it("leaves settings, menus and closing buttons alone", () => {
    for (const act of ["settings", "done", "quit", "menu", "back", "close", "help", "layout"]) {
      expect(F.isStartAction({ act, go: true })).toBe(false);
    }
    expect(F.isStartAction({ text: "Settings" })).toBe(false);
    expect(F.isStartAction(null)).toBe(false);
  });
  it("uses the CSS full screen when the browser has no Fullscreen API (iPhone)", () => {
    expect(F.wantsPseudo({ hasApi: false })).toBe(true);
    expect(F.wantsPseudo({ hasApi: true, enabled: false })).toBe(true);
    expect(F.wantsPseudo({ hasApi: true, enabled: true })).toBe(false);
    expect(F.wantsPseudo({ hasApi: true, enabled: true, forcePseudo: true })).toBe(true);
  });
  it("knows portrait from landscape", () => {
    expect(F.inPortrait(390, 844)).toBe(true);
    expect(F.inPortrait(844, 390)).toBe(false);
    expect(F.inPortrait(1000, 1020)).toBe(false);
  });
  it("Work in Progress: its Play / Continue / New game buttons count as starts", () => {
    expect(WIP_START.test("Continue Amina · 3/10")).toBe(true);
    expect(WIP_START.test("New game")).toBe(true);
    expect(WIP_START.test("Settings")).toBe(false);
    expect(WIP_START.test("Credits")).toBe(false);
  });
});

describe("the round pad", () => {
  const on = (d: Any) => ["up", "down", "left", "right"].filter((k) => d[k]).join("+");
  it("gives 8 directions, diagonals included (y grows downward)", () => {
    expect(on(P.dir8(0, -1))).toBe("up");
    expect(on(P.dir8(0, 1))).toBe("down");
    expect(on(P.dir8(-1, 0))).toBe("left");
    expect(on(P.dir8(1, 0))).toBe("right");
    expect(on(P.dir8(0.7, -0.7))).toBe("up+right");
    expect(on(P.dir8(-0.7, 0.7))).toBe("down+left");
    expect(on(P.dir8(-0.7, -0.7))).toBe("up+left");
    expect(on(P.dir8(0.7, 0.7))).toBe("down+right");
  });
  it("has a dead zone in the middle", () => {
    expect(on(P.dir8(0.1, 0.1))).toBe("");
    expect(P.dir8(0, 0).sector).toBe(-1);
    expect(on(P.dir8(0.3, 0, 0.22))).toBe("right");
  });
  it("splits the circle into equal 45-degree slices", () => {
    // 20 degrees off straight right is still right; 25 degrees is the corner.
    const at = (deg: number) => on(P.dir8(Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)));
    expect(at(-20)).toBe("right");
    expect(at(-25)).toBe("up+right");
    expect(at(-65)).toBe("up+right");
    expect(at(-70)).toBe("up");
  });
  it("presses one button, both on the gap between two, and the nearest when just outside", () => {
    // A diamond: centres 66 px apart along the diagonals, radius 30.
    const b = [
      { id: "top", x: 0, y: -47, r: 30 },
      { id: "right", x: 47, y: 0, r: 30 },
      { id: "bottom", x: 0, y: 47, r: 30 },
      { id: "left", x: -47, y: 0, r: 30 },
    ];
    expect(P.hits(b, 0, -47)).toEqual(["top"]);
    expect(P.hits(b, 23.5, -23.5).sort()).toEqual(["right", "top"]);
    expect(P.hits(b, 0, -90)).toEqual(["top"]);
    expect(P.hits(b, 0, -140)).toEqual([]);
  });
});
