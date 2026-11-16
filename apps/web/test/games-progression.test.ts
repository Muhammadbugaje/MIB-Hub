import { describe, expect, it } from "vitest";
import { LEGACY_GAMES, isSaveKey, legacyScripts, saveKeyPrefixes, scriptUrl } from "../src/games/legacy.ts";
import {
  COOLDOWN_S,
  Rejected,
  applyResult,
  asDict,
  buyItem,
  cleanResult,
  equipItem,
  levelFor,
  readState,
  writeState,
  xpForLevel,
} from "../src/games/progression.ts";

const empty = () => readState({});

describe("legacy game manifest", () => {
  it("covers the 16 games from the old site", () => {
    expect(Object.keys(LEGACY_GAMES)).toHaveLength(16);
  });

  it("loads the runtime, then dependencies, then level packs, then the entry", () => {
    const urls = legacyScripts("circuit-forge", "forge", ["circuitsim", "circuit-100"]);
    expect(urls[0]).toBe("/play/_shared/js/games/arcade.js");
    expect(urls.slice(-6)).toEqual([
      "/play/_shared/js/games/circuit-100.js",
      "/play/_shared/js/games/circuit-200.js",
      "/play/_shared/js/games/circuit-300.js",
      "/play/_shared/js/games/circuit-400.js",
      "/play/_shared/js/games/circuit-500.js",
      "/play/_shared/js/games/forge.js",
    ]);
  });

  it("keeps folders for scripts outside js/games and refuses path tricks", () => {
    expect(scriptUrl("js/matlab/mlab")).toBe("/play/_shared/js/matlab/mlab.js");
    expect(scriptUrl("../../secret")).not.toContain("..");
  });

  it("returns nothing for a game that is not a legacy game", () => {
    expect(legacyScripts("demo-hello", "demo-hello", [])).toEqual([]);
  });

  it("knows which browser keys belong to a game's save", () => {
    expect(saveKeyPrefixes("light-bender")).toContain("ee-arcade-bender");
    expect(isSaveKey("light-bender", "ee-arcade-bender")).toBe(true);
    expect(isSaveKey("light-bender", "ee-arcade-set-light-bender")).toBe(true);
    expect(isSaveKey("light-bender", "ee-arcade-forge")).toBe(false);
    expect(isSaveKey("samaru-days", "ee-arcade-fslg-slot:u1:auto")).toBe(true);
    expect(isSaveKey("samaru-days", "ee-arcade-fslg-probe")).toBe(false);
  });
});

describe("arcade progression rules", () => {
  it("levels follow the old curve", () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(99)).toBe(1);
    expect(levelFor(100)).toBe(2);
    expect(xpForLevel(2)).toBe(100);
    expect(levelFor(xpForLevel(10))).toBe(10);
  });

  it("checks result reports", () => {
    expect(cleanResult({ game: "light-bender", result: "win", stage: 3, score: 99999 })).toMatchObject({
      stage: 3,
      score: 5000,
      mode: "solo",
      cheated: false,
    });
    expect(() => cleanResult({ game: "nope", result: "win" })).toThrow(Rejected);
    expect(() => cleanResult({ game: "light-bender", result: "maybe" })).toThrow(Rejected);
    expect(() => cleanResult({ game: "light-bender", result: "win", stage: 46 })).toThrow("Stage out of range.");
    expect(cleanResult({ game: "wavefront", result: "lose", hero: true }).cheated).toBe(true);
  });

  it("rewards a win, saves the score and awards badges", () => {
    const r = cleanResult({ game: "light-bender", result: "win", stage: 45, score: 420 });
    const out = applyResult(empty(), 0, r, { now: 1000, cheatsOnBoards: false });
    expect(out.earnedCoins).toBe(30 + 5 * 45);
    expect(out.earnedXp).toBe(out.earnedCoins * 2);
    expect(out.score).toBe(420);
    expect(out.newBadges).toEqual(expect.arrayContaining(["first-win", "optics-ace"]));
    expect(out.state.games["light-bender"]).toMatchObject({ plays: 1, wins: 1, best: 420, stages: [45] });
  });

  it("enforces the 15-second cooldown per game", () => {
    const r = cleanResult({ game: "induction-dash", result: "lose", score: 10 });
    const first = applyResult(empty(), 0, r, { now: 1000, cheatsOnBoards: false });
    expect(() => applyResult(first.state, 0, r, { now: 1000 + COOLDOWN_S - 1, cheatsOnBoards: false })).toThrow(Rejected);
    expect(() => applyResult(first.state, 0, r, { now: 1000 + COOLDOWN_S, cheatsOnBoards: false })).not.toThrow();
  });

  it("cheated runs earn nothing while cheats are kept off the boards, but the score is still kept (flagged)", () => {
    const r = cleanResult({ game: "wavefront", result: "win", stage: 2, score: 300, cheated: true });
    const off = applyResult(empty(), 0, r, { now: 1, cheatsOnBoards: false });
    expect(off).toMatchObject({ earnedCoins: 0, earnedXp: 0, counted: false, score: 300 });
    expect(off.state.games.wavefront!.best).toBe(0);
    const on = applyResult(empty(), 0, r, { now: 1, cheatsOnBoards: true });
    expect(on.earnedCoins).toBeGreaterThan(0);
  });

  it("two players on one device get half rewards and no leaderboard score", () => {
    const r = cleanResult({ game: "momentum-cup", result: "draw", stage: 1, score: 50, mode: "duo" });
    const out = applyResult(empty(), 0, r, { now: 1, cheatsOnBoards: false });
    expect(out.earnedCoins).toBe(7);
    expect(out.score).toBeNull();
  });

  it("runs the shop: buy, refuse twice, equip kits only", () => {
    expect(() => buyItem(empty(), 10, "kit-volt")).toThrow("You need 110 more coins.");
    const { state, price } = buyItem(empty(), 500, "kit-volt");
    expect(price).toBe(120);
    expect(() => buyItem(state, 500, "kit-volt")).toThrow("You already own this.");
    expect(equipItem(state, "kit-volt").equipped).toEqual({ kit: "kit-volt" });
    expect(equipItem(equipItem(state, "kit-volt"), "none-kit").equipped).toEqual({});
    expect(() => equipItem(state, "kit-gold")).toThrow("Buy this item first.");
  });

  it("stores its state inside the profile stats without losing other keys", () => {
    const stats = writeState({ bio: "hi" }, { ...empty(), badges: ["first-win"] });
    expect(stats.bio).toBe("hi");
    expect(readState(stats).badges).toEqual(["first-win"]);
    expect(readState({ arcade: "garbage" })).toEqual(empty());
  });

  it("describes the player the way the old games expect", () => {
    const d = asDict({ ...empty(), badges: ["first-win", "unknown"] }, { coins: 5, xp: 150, onLeaderboard: true });
    expect(d).toMatchObject({ coins: 5, xp: 150, level: 2, rank: "Apprentice", next_xp: 300, this_xp: 100 });
    expect(d.badges).toEqual([{ id: "first-win", name: "First win", text: "Won your first match or puzzle." }]);
    expect(d.shop.length).toBeGreaterThan(10);
  });
});
