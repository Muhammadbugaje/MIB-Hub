/* Headless run of Kinetic Kingdom on the real arcade runtime with a stub DOM.
   Usage: node kk_harness.js <static/js/games dir> <mode>. Prints one JSON object; exits 1 on an uncaught error.
   Modes: "levels" plays every level for a while; "bosses" beats every boss by stomping in its open windows;
   "progress" checks save migration, unlocks, abilities, time attack and skipping. */
const path = require("path"), fs = require("fs"), dir = process.argv[2], mode = process.argv[3] || "levels";
const noop = () => {};
function ctx() { const grad = { addColorStop: noop }; return new Proxy({}, { get: (t, k) => k in t ? t[k] : k === "measureText" ? (s) => ({ width: String(s).length * 7 }) : k === "createLinearGradient" || k === "createRadialGradient" ? () => grad : k === "createPattern" ? () => ({}) : k === "canvas" ? { getBoundingClientRect: () => ({ width: 960, height: 540 }) } : noop, set: (t, k, v) => { t[k] = v; return true; } }); }
function el() { return { style: {}, children: [], childNodes: [], hidden: true, innerHTML: "", value: "", textContent: "", classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, addEventListener: noop, removeEventListener: noop, getContext: ctx, getAttribute: () => "", setAttribute: noop, removeAttribute: noop, querySelector: () => el(), querySelectorAll: () => [], getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540 }), appendChild: noop, insertBefore: noop, remove: noop, focus: noop, click: noop, closest: () => null, width: 960, height: 540 }; }
const SLUG = "kinetic-kingdom", ls = {}, listeners = {};
if (mode === "progress-old") ls["ee-arcade-kk"] = JSON.stringify({ who: "tesla", done: { "1-1": { best: 900 }, "1-2": { best: 800 } }, secrets: {}, shards: { "1-1": [true, true] }, sel: 2, hud: true, cards: {} });
let dlg = null;
const ov = { hidden: true, onclick: null, classList: { add: noop, remove: noop }, _h: "",
  get innerHTML() { return this._h; }, set innerHTML(v) { this._h = v; dlg = v ? Object.assign(el(), { attrs: {}, html: v, setAttribute(k, x) { this.attrs[k] = x; }, removeAttribute(k) { delete this.attrs[k]; }, querySelector: () => null }) : null; },
  querySelector(sel) { if (this.hidden || !dlg) return null; if (sel === ".gm-dlg") return dlg; if (sel === "[data-cer]") return dlg.attrs["data-cer"] ? dlg : null; return null; } };
const stage = Object.assign(el(), { getAttribute: (k) => k === "data-gm-slug" ? SLUG : "", querySelector: (s) => s === "[data-gm-overlay]" ? ov : s === ".gm-hero-skip" ? null : el() });
global.window = global; global.self = global;
global.addEventListener = (n, f) => { (listeners[n] = listeners[n] || []).push(f); }; global.removeEventListener = noop;
global.matchMedia = () => ({ matches: false, addEventListener: noop }); global.requestAnimationFrame = noop; global.devicePixelRatio = 1;
global.localStorage = { getItem: (k) => k in ls ? ls[k] : null, setItem: (k, v) => { ls[k] = String(v); }, removeItem: (k) => { delete ls[k]; }, key: (i) => Object.keys(ls)[i], get length() { return Object.keys(ls).length; } };
global.performance = { now: () => Date.now() };
global.document = { documentElement: el(), body: el(), readyState: "complete", hidden: false, currentScript: null, head: el(), createElement: () => el(),
  addEventListener: (n, f) => { (listeners[n] = listeners[n] || []).push(f); }, removeEventListener: noop,
  querySelector: (s) => s === "[data-gm-stage]" ? stage : /gm-me|gm-cast|gm-api|gm-filters|gm-villain|privacy|gm-empty/.test(s) ? null : el(), querySelectorAll: () => [] };
// deterministic: the game uses Math.random only for cosmetics and boss aim jitter
let seed = 12345; Math.random = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
function load(f) { (0, eval)(fs.readFileSync(path.join(dir, f + ".js"), "utf8")); }
const out = { errors: [] };
try {
  load("arcade"); load("platformer-levels"); load("platformer");
  const D = global.EEArcadeDebug, api = D.api, K = global.KineticKingdom, LV = K.LV;
  const close = () => { for (let i = 0; i < 6 && api.overlayOpen(); i++) { api.hide(); D.step(2); } };
  [1, 2, 3, 4, 5, 6, 7].forEach((w) => { K.S["card" + w] = true; }); // skip the world intro cards
  const start = (i, m) => { for (let k = 0; k < 5; k++) { close(); D.step(2); close(); K.startLevel(i, m); close(); if (K.L && K.L.lv === LV[i] && K.S.mode === "play") return; D.step(30); } throw new Error("could not start " + LV[i].id); };
  const bad = (h) => !isFinite(h.x) || !isFinite(h.y) || !isFinite(h.vx) || !isFinite(h.vy);
  if (mode === "levels") {
    out.levels = {};
    LV.forEach((lv, i) => {
      start(i); const L = K.L; let maxX = 0, nan = false;
      K.G.lives = 99;
      for (let f = 0; f < 120 * 25; f++) {
        // run right, jump every second (hold for 0.4 s), dash sometimes
        D.press("right"); D.press("run"); if (f % 120 === 0) D.press("jump"); if (f % 120 === 48) D.release("jump");
        D.step(1); const h = K.L && K.L.hero; if (!h) break; if (bad(h)) { nan = true; break; } maxX = Math.max(maxX, h.x);
        if (api.overlayOpen()) close();
        if (K.S.mode !== "play") break;
      }
      D.release("right"); D.release("run"); D.release("jump");
      out.levels[lv.id] = { maxX: Math.round(maxX), nan, ents: K.L ? K.L.ents.length : -1, gs: K.L ? K.L.pl.gs : null };
    });
  } else if (mode === "bosses") {
    out.bosses = {};
    LV.forEach((lv, i) => {
      if (!lv.boss || (process.argv[4] && process.argv[4] !== lv.id)) return;
      start(i); const L = K.L, h = L.hero, b = L.boss; K.G.lives = 99; if (!b) throw new Error("no boss in " + lv.id);
      // walk into the arena so it locks
      h.x = L.pl.arenaX + 3; h.y = 2; h.vy = 0; let t = 0, hits = 0, last = b.hp, cd = 0;
      for (let f = 0; f < 120 * 120 && b.alive; f++) {
        D.step(1); t += 1 / 120; if (api.overlayOpen()) close();
        const hh = K.L.hero; if (hh.dead) { hh.dead = 0; hh.inv = 2; }
        hh.inv = Math.max(hh.inv, .5); // the test hero is not the subject here: keep it alive
        // drop onto the boss from just above it whenever it is open to a stomp (then let the fall happen)
        cd -= 1 / 120; if (K.bossVulnerable() && cd <= 0) { cd = .35; hh.x = b.x + b.w / 2 - hh.w / 2; hh.y = b.y - hh.h - .15; hh.vy = 6; hh.vx = 0; hh.pounding = false; hh.ground = false; }
        if (b.hp < last) { hits++; last = b.hp; }
        if (process.argv[5] && f % 60 === 0) console.error(JSON.stringify([f, K.L.locked, b.st, +b.dizzy.toFixed(2), +b.inv.toFixed(2), K.bossVulnerable(), +b.x.toFixed(1), +b.y.toFixed(1), +hh.x.toFixed(1), +hh.y.toFixed(1), +hh.vy.toFixed(1), K.S.mode, !!K.L.clear]));
      }
      const gate = K.L.gates.some((g) => !g.hidden);
      out.bosses[lv.id] = { kind: lv.boss, beaten: !b.alive, secs: Math.round(t), hits, max: b.max, gate };
    });
  } else {
    const K2 = K, S = K.S, save = K.save;
    out.migrated = { v: save.v, chars: save.chars, who: K.who().id, fails: typeof save.fails, lap: save.lap };
    const idx = (id) => LV.findIndex((l) => l.id === id);
    out.trialLockedAtStart = !K.unlocked(idx("X1"));
    out.abilitiesAtStart = K.abilities();
    out.einsteinOpenAtStart = K.charOpen("einstein");
    save.done["1-4"] = { best: 1 }; save.done["2-4"] = { best: 1 };
    out.trialOpenAfterBoss = K.unlocked(idx("X1")) && !K.unlocked(idx("X3"));
    out.abilitiesAfter = K.abilities();
    out.einsteinOpenAfter = K.charOpen("einstein") && !K.charOpen("bohr");
    // time attack: clear a level twice; the faster run becomes the best and leaves a ghost
    start(0, "attack"); for (let f = 0; f < 600; f++) { D.press("right"); D.step(1); } K.debugClear(); for (let f = 0; f < 400; f++) { D.step(1); } close();
    const t1 = save.best["1-1"]; const g1 = JSON.parse(ls["ee-arcade-kk-g-1-1"] || "null");
    start(0, "attack"); out.ghostLoaded = !!(K.L.ghost && K.L.ghost.f && K.L.ghost.f.length > 10);
    for (let f = 0; f < 200; f++) { D.press("right"); D.step(1); } K.debugClear(); for (let f = 0; f < 400; f++) D.step(1); close();
    out.attack = { first: t1, second: save.best["1-1"], ghostFrames: g1 ? g1.f.length : 0, reportedDone: !!save.done["1-1"] };
    // skipping: after enough failures the level can be skipped and the next one opens
    api.settings.set("kkSkip", "3"); save.fails["1-3"] = 3; S.sel = idx("1-3"); K.mapAct("skip");
    out.skip = { done: save.done["1-3"], nextOpen: K.unlocked(idx("1-4")) };
    // laps
    save.done["7-6"] = { best: 1 }; save.lapMax = 3; K.mapAct("lap"); out.lap = save.lap;
    out.completion = K.completion();
  }
} catch (e) { out.errors.push(String(e && e.stack || e)); }
console.log(JSON.stringify(out));
process.exit(out.errors.length ? 1 : 0);
