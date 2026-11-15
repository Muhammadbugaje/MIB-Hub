/* Momentum Cup career, headless. Part 1: bot careers through the pure rules (kickoff-career.js), seeded.
   Part 2: the real arcade runtime and kickoff.js with a stub DOM: create a club, play a league match, finish it,
   reach the ceremony and the post-match screen, and check the save. Usage: node momentum_career_harness.js <games js dir>.
   Prints one JSON object; exits 1 on any thrown error. */
const path = require("path"), fs = require("fs"), dir = process.argv[2], defs = process.argv[3];
const noop = () => {};
function ctx() { const grad = { addColorStop: noop }; return new Proxy({}, { get: (t, k) => k in t ? t[k] : k === "measureText" ? (s) => ({ width: String(s).length * 7 }) : k === "createLinearGradient" || k === "createRadialGradient" ? () => grad : k === "createPattern" ? () => ({}) : noop, set: (t, k, v) => { t[k] = v; return true; } }); }
function el() { const e = { style: {}, children: [], childNodes: [], hidden: true, innerHTML: "", value: "", textContent: "", classList: { add: noop, remove: noop, toggle: noop }, addEventListener: noop, getContext: ctx, getAttribute: () => "", setAttribute: noop, removeAttribute: noop, querySelector: () => el(), querySelectorAll: () => [], getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540 }), appendChild: noop, insertBefore: noop, remove: noop, focus: noop, click: noop, closest: () => null, width: 960, height: 540 }; return e; }
const SLUG = "momentum-cup", ls = {}, listeners = {};
let dlg = null;
const ov = { hidden: true, onclick: null, classList: { add: noop, remove: noop }, _h: "",
  get innerHTML() { return this._h; }, set innerHTML(v) { this._h = v; dlg = v ? Object.assign(el(), { attrs: {}, html: v, setAttribute(k, x) { this.attrs[k] = x; }, removeAttribute(k) { delete this.attrs[k]; }, querySelector: () => null }) : null; },
  querySelector(sel) { if (this.hidden || !dlg) return null; if (sel === ".gm-dlg") return dlg; if (sel === "[data-cer]") return dlg.attrs["data-cer"] ? dlg : null; return null; } };
const stage = Object.assign(el(), { getAttribute: (k) => k === "data-gm-slug" ? SLUG : "", querySelector: (s) => s === "[data-gm-overlay]" ? ov : s === ".gm-hero-skip" ? null : el() });
global.window = global; global.self = global;
global.addEventListener = (n, f) => { (listeners[n] = listeners[n] || []).push(f); }; global.removeEventListener = noop;
global.matchMedia = () => ({ matches: false, addEventListener: noop }); global.requestAnimationFrame = noop; global.devicePixelRatio = 1;
global.localStorage = { getItem: (k) => k in ls ? ls[k] : null, setItem: (k, v) => { ls[k] = String(v); } };
global.performance = { now: () => Date.now() };
global.document = { documentElement: el(), body: el(), readyState: "complete", hidden: false, currentScript: null, head: el(), createElement: () => el(),
  addEventListener: (n, f) => { (listeners[n] = listeners[n] || []).push(f); },
  querySelector: (s) => s === "[data-gm-stage]" ? stage : /gm-me|gm-cast|gm-api|gm-filters|gm-villain|privacy|gm-empty/.test(s) ? null : el(), querySelectorAll: () => [] };
function load(f) { (0, eval)(fs.readFileSync(path.join(dir, f + ".js"), "utf8")); }
function click(act) { const on = ov.onclick; if (on) on({ target: { closest: () => ({ getAttribute: (k) => k === "data-act" ? act : "einstein", parentNode: { children: [] } }) } }); }
function key(k, code) { (listeners.keydown || []).forEach((f) => f({ key: k, code: code || "Key" + k.toUpperCase(), target: {}, preventDefault: noop })); }
const out = {};
try {
  const C = require(path.resolve(dir, "kickoff-career.js"));
  // ---- part 1: rules ----
  out.players = C.PLAYERS.length; out.clubs = C.CLUBS.length; out.powers = Object.keys(C.POWERS).length;
  out.rarity = C.PLAYERS.reduce((a, p) => (a[p.rarity] = (a[p.rarity] || 0) + 1, a), {});
  out.uniqueNames = new Set(C.PLAYERS.map((p) => p.name)).size;
  out.careers = {};
  [-0.1, 0, 0.1].forEach((sk) => { out.careers[sk] = [1, 2, 3, 4, 5].map((seed) => { const r = C.simulate(seed, sk, 700), P = r.P; return { grandAt: r.grandAt, rung: P.legends.rung, coins: P.coins, level: P.level, trophies: P.cabinet.length, seasons: P.seasonNo, roster: Object.keys(P.roster).length }; }); });
  const r = C.simulate(1, 0, 700); out.curve = [1, 50, 100, 150, 200, 300, 500, 700].map((m) => r.curve[m - 1]).filter(Boolean);
  out.repeat = JSON.stringify(C.simulate(7, 0, 200).P.stats) === JSON.stringify(C.simulate(7, 0, 200).P.stats);
  // legends keep getting harder for ever
  const L = C.create({ name: "x", club: "y", seed: 3 }); L.legends.open = true;
  out.legends = [0, 10, 50, 100, 200].map((n) => { L.legends.rung = n; const o = C.opponent(L, C.legendsFixture(L)); return [n, +o.skill.toFixed(3), +o.stat.toFixed(3), o.mods.length]; });
  // unlocks: rares need the Regional League, legends are earned only
  const U = C.create({ name: "u", club: "v", seed: 9 }); U.coins = 1e6;
  const rare = C.PLAYERS.find((p) => p.rarity === "rare"), leg = C.PLAYERS.find((p) => p.rarity === "legendary");
  out.unlock = { rareAtCampus: C.scout(U, rare.id), legendBuy: C.scout(U, leg.id) };
  U.tier = 1; out.unlock.rareAtRegional = C.scout(U, rare.id);
  U.cabinet.push({ kind: "league", tier: 0 }); out.unlock.legendByTrophy = C.unlocks(U).some((e) => e.kind === "unlock" && e.id === leg.id);
  // migration: an old classic-cup save carries over
  const M0 = C.migrate(null, { cupBest: 6, fav: "tesla" }); out.migrate = { classic: M0.cabinet.some((t) => t.id === "classic"), fav: M0.originals.indexOf("tesla") >= 0, season: !!M0.season, v: M0.v };
  const old = JSON.parse(JSON.stringify(M0)); delete old.options; delete old.legends; const M1 = C.migrate(old, {}); out.migrate.fills = !!(M1.options && M1.legends && M1.options.len === 75);

  // ---- part 2: the real game ----
  global.MomentumCareer = C; load("arcade"); load("kickoff");
  const D = global.EEArcadeDebug, api = D.api, S = global.MomentumCup.S, UI = global.KickCareerUI;
  const timers = []; global.setTimeout = (f) => { timers.push(f); return 0; };
  out.menuHasCareer = /data-act='career'/.test(dlg && dlg.html || "");
  click("career"); out.createScreen = /Start your career/.test(dlg.html); click("make");
  out.hub = /Play next match/.test(dlg.html) && /Campus League/.test(dlg.html);
  const P = UI.P; out.saved = !!ls["ee-arcade-kick-career"];
  click("play"); out.prematch = /Kick off/.test(dlg.html) && /Win chance/.test(dlg.html); click("go");
  out.match = { mode: S.mode, state: S.state, p0: S.p[0].c.name, p1: S.p[1].c.name, kit: S.p[0].c.coat === P.club.c1, powerName: S.p[0].P.name };
  D.step(240); out.match.played = S.state === "play";
  S.halfDone = true; S.score = [3, 1]; S.time = .01; D.step(30); timers.splice(0).forEach((f) => f());
  out.cer = D.cer() && D.cer().kind; D.step(120 * 9);
  out.dbg = [S.state, S.over, !!S.post, String(dlg && dlg.html).slice(0, 160)]; out.post = /Continue/.test(dlg && dlg.html || ""); out.after = { played: P.stats.played, won: P.stats.won, coins: P.coins, pts: P.season.table.you.pts };
  click("hub"); out.backToHub = /Play next match/.test(dlg && dlg.html || "");
  // a level league match may end as a draw; a knockout goes to sudden death
  click("play"); click("go"); D.step(240); S.halfDone = true; S.score = [1, 1]; S.time = .01; D.step(30); timers.splice(0).forEach((f) => f()); D.step(120 * 9);
  out.draw = P.stats.drawn === 1; click("hub");
  // every engine power runs without throwing
  click("play"); click("go"); D.step(240); const MCup = global.MomentumCup; out.powersRun = {};
  Object.keys(C.POWERS).forEach((k) => { const id = C.PLAYERS.find((q) => q.pw === k).id, p = MCup.player(UI.careerChar(id, 1, P.club, 1), 0);
    S.p[0] = p; S.state = "play"; S.over = false; S.halfDone = true; S.time = 60; p.meter = 1; api.press ? 0 : 0; p.power = p.P.dur; p.powerMax = p.P.dur;
    S.ball.hold = false; S.ball.x = p.x + .4; S.ball.y = .3; S.ball.vx = 0; S.ball.vy = 0; MCup.kick(api, p, false);
    let ok = true; try { D.step(300); } catch (e) { ok = String(e); } out.powersRun[k] = [p.pk, ok, isFinite(S.ball.x) && isFinite(S.ball.y)]; });
  console.log(JSON.stringify(out)); process.exit(0);
} catch (e) { console.error(e && e.stack || e); process.exit(1); }
