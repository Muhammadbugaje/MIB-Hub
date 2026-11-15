/* Headless runs of Wavefront and Induction Dash on the real arcade runtime with a stub DOM.
   Usage: node wd_harness.js <static/js/games dir> <wavefront|dash> [width]
   Prints one JSON object; exits 1 on a thrown error. Deterministic: Math.random is seeded. */
const path = require("path"), fs = require("fs"), dir = process.argv[2], which = process.argv[3], WIDTH = +(process.argv[4] || 960);
const noop = () => {};
let seed = 12345; Math.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
let clock = 0; Date.now = () => 1700000000000 + clock;
function ctx() { const grad = { addColorStop: noop }; return new Proxy({}, { get: (t, k) => k in t ? t[k] : k === "measureText" ? (s) => ({ width: String(s).length * 7 }) : (k === "createLinearGradient" || k === "createRadialGradient" || k === "createPattern") ? () => grad : k === "getImageData" ? () => ({ data: new Uint8ClampedArray(4) }) : noop, set: (t, k, v) => { t[k] = v; return true; } }); }
function el() { return { style: {}, children: [], childNodes: [], hidden: true, innerHTML: "", value: "", textContent: "", classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, addEventListener: noop, removeEventListener: noop, getContext: ctx, getAttribute: () => "", setAttribute: noop, removeAttribute: noop, querySelector: () => el(), querySelectorAll: () => [], getBoundingClientRect: () => ({ left: 0, top: 0, width: WIDTH, height: WIDTH * 9 / 16 }), appendChild: noop, insertBefore: noop, remove: noop, focus: noop, click: noop, closest: () => null, width: 960, height: 540 }; }
const SLUG = which === "dash" ? "induction-dash" : "wavefront", ls = {}, listeners = {};
let dlg = "";
const ov = { hidden: true, onclick: null, classList: { add: noop, remove: noop }, _h: "", get innerHTML() { return this._h; }, set innerHTML(v) { this._h = v; dlg = v || ""; },
  querySelector: () => null, querySelectorAll: () => [] };
const canvas = el();
const stage = Object.assign(el(), { getAttribute: (k) => k === "data-gm-slug" ? SLUG : "", querySelector: (s) => s === "[data-gm-overlay]" ? ov : s === "[data-gm-canvas]" ? canvas : el() });
global.window = global; global.self = global;
global.addEventListener = (n, f) => { (listeners[n] = listeners[n] || []).push(f); }; global.removeEventListener = noop;
global.matchMedia = () => ({ matches: false, addEventListener: noop }); global.requestAnimationFrame = noop; global.devicePixelRatio = 1;
global.localStorage = { getItem: (k) => k in ls ? ls[k] : null, setItem: (k, v) => { ls[k] = String(v); }, removeItem: (k) => { delete ls[k]; } };
global.performance = { now: () => clock };
const timers = []; global.setTimeout = (f) => { timers.push(f); return timers.length; }; global.clearTimeout = noop;
global.document = { documentElement: el(), body: el(), readyState: "complete", hidden: false, currentScript: null, head: el(), createElement: () => el(),
  addEventListener: (n, f) => { (listeners[n] = listeners[n] || []).push(f); },
  querySelector: (s) => s === "[data-gm-stage]" ? stage : s === "[data-gm-overlay]" ? ov : s === "[data-gm-canvas]" ? canvas : /gm-me|gm-cast|gm-api|gm-filters|gm-villain|privacy|gm-empty/.test(s) ? null : el(), querySelectorAll: () => [] };
function load(f) { (0, eval)(fs.readFileSync(path.join(dir, f + ".js"), "utf8")); }
function click(act, attrs) { const on = ov.onclick; if (on) on({ target: { closest: () => ({ getAttribute: (k) => k === "data-act" ? act : (attrs || {})[k] || "", parentNode: { children: [] } }) } }); }
const out = {};
const reports = [];
try {
  load("arcade");
  const A = global.Arcade; A.report = (slug, r) => { reports.push(r); return Promise.resolve(null); };
  if (which === "dash") { load("inductionsim"); load("dash"); runDash(); } else { load("shooterdata"); load("shooter"); runWave(); }
  out.reports = reports.length;
  console.log(JSON.stringify(out)); process.exit(0);
} catch (e) { console.error(e && e.stack || e); process.exit(1); }

function step(n) { const D = global.EEArcadeDebug; for (let i = 0; i < n; i++) { D.step(1); clock += 1000 / 120; } }
function flush() { timers.splice(0).forEach((f) => f()); }
function tune(S, D) { // the bot's one bit of physics: set the frequency so the beam's wavelength lies in the nearest filter's pass band
  const p = S.ps[0]; let band = null, bd = 1e9;
  S.foes.forEach((e) => { if (e.alive && e.filter) { const d = Math.abs(e.x - p.x); if (d < bd) { bd = d; band = D.FILTERS[e.filter]; } } });
  if (S.boss && S.boss.filter) band = D.FILTERS[S.boss.filter];
  if (band) { const i = D.FREQS.findIndex((f) => { const nm = D.nm(f); return nm >= band[0] && nm <= band[1]; }); if (i >= 0) p.fi = i; }
}
function hold(ids) { const D = global.EEArcadeDebug; ["left", "right", "up", "down", "jump", "fire", "weapon"].forEach((k) => D.release(k)); ids.forEach((k) => D.press(k)); }

/* ---------- Wavefront ---------- */
function runWave() {
  const W = global.Wavefront, D = W.D, api = global.EEArcadeDebug.api;
  // old save without the new fields migrates
  out.migrated = typeof W.save.up === "object" && W.save.ph === 0 && Array.isArray(W.save.surv);
  W.save.opt.autoAim = "on"; if (api.settings && api.settings.set) api.settings.set("wf_autoAim", "on");
  out.stageCount = D.STAGES.length;
  // 1. every arena, mid-boss and boss in every stage resolves (no soft-lock), at this screen width; the bot is invulnerable
  out.events = [];
  const only = process.env.WD_ONLY || "";
  const pickK = process.env.WD_STAGES ? process.env.WD_STAGES.split(",").map(Number) : null, cap = +(process.env.WD_CAP || 240);
  for (let k = 0; k < D.STAGES.length && only !== "surv"; k++) { if (pickK && pickK.indexOf(k) < 0) continue;
    W.newRun(k, "solo"); api.hide(); W.begin(); global.EEArcadeDebug.paint();
    const S = W.S, evs = S.st.events.map((e, i) => [e, i]).filter(([e]) => e.t === "arena" || e.t === "mid" || e.t === "boss");
    const res = [];
    for (const [ev, i] of evs) {
      const p = S.ps[0]; S.god = true; const bd = S.st.bands.filter((q) => ev.x0 + 60 >= q.x0 && ev.x0 + 60 < q.x1)[0] || S.st.bands[0];
      S.st.events.forEach((e2, j) => { if (j < i) S.done[j] = true; }); S.lift = null; S.scroll = null; S.lock = null; S.wave = null; S.boss = null;
      p.x = ev.x0 + 60; p.y = bd.top + 60; p.vx = p.vy = 0; p.safe = { x: p.x, y: bd.bottom - 90 }; S.cam.y = bd.bottom - 540;
      ["sine", "spread", "emp", "lance"].forEach((w) => { p.wpn[w] = 3; });
      // drop to the ground below
      S.cam.x = Math.max(0, ev.x0 - 40); for (let t = 0; t < 30; t++) { step(4); global.EEArcadeDebug.paint(); }
      let t = 0, locked = false;
      hold(["right", "fire"]);
      while (t < cap * 120) { // cap s of game time per event at most
        step(6); t += 6; S.god = true; S.ps[0].lives = 9;
        if (t % 60 === 0) global.EEArcadeDebug.paint();
        if (S.lock) locked = true;
        // the bot strafes back and forth inside the arena and jumps now and then
        if (t % 360 === 0) hold([(t / 360) % 2 ? "left" : "right", "fire"]);
        if (t % 240 === 0) S.ps[0].cur = ["emp", "sine", "lance", "spread"][(t / 240) % 4]; // EMP gets past filter knights and wardens
        if (t % 60 === 0) tune(S, D); if (t % 150 === 0) { global.EEArcadeDebug.press("jump"); step(10); global.EEArcadeDebug.release("jump"); }
        if (locked && !S.lock && !S.boss && !S.wave) break;
        if (S.done[i] && !S.lock && !S.boss && !S.wave) { locked = true; break; }
      }
      res.push([ev.t, S.done[i] ? 1 : 0, !S.lock && !S.boss && !S.wave ? 1 : 0, Math.round(t / 120)]);
    }
    hold([]);
    out.events.push({ k, id: D.STAGES[k].id, res, bossDown: S.bossDown });
  }
  // 2. survival: waves escalate, modifiers arrive every 5th wave, a boss on the 10th; game over records a board row and earns photons
  W.save.ph = 0; W.save.surv = [];
  const before = reports.length;
  api.hide(); global.Wavefront.save.who = "einstein";
  // start survival through the menu path
  W.newRun(0, "solo"); // sets up players; now switch to survival
  const S0 = W.S; S0.ps = []; // clear
  // call the internal starter through the menu: pick "surv" then ok
  api.hide(); global.EEArcadeDebug.game.menu(api); click("surv"); click("ok"); click("go"); flush();
  const S = W.S; out.survStarted = !!S.surv; ["sine", "spread", "emp", "lance"].forEach((w) => { S.ps[0].wpn[w] = 3; });
  let maxWave = 0, mods = new Set(), sawBoss = false, sawMid = false, t = 0;
  hold(["fire"]);
  while (t < 120 * 900 && S.surv && S.surv.n < 11) { step(6); t += 6; S.god = true; if (t % 60 === 0) global.EEArcadeDebug.paint(); if (t % 300 === 0) hold([(t / 300) % 2 ? "left" : "right", "fire"]); if (t % 240 === 0) S.ps[0].cur = ["emp", "sine", "lance", "spread"][(t / 240) % 4]; if (t % 60 === 0) tune(S, D);
    out.waveAt = out.waveAt || {}; if (S.surv && !out.waveAt[S.surv.n]) out.waveAt[S.surv.n] = Math.round(t / 120);
    if (t % 150 === 0) { global.EEArcadeDebug.press("jump"); step(10); global.EEArcadeDebug.release("jump"); }
    maxWave = Math.max(maxWave, S.surv.n); S.surv.modList.forEach((m) => mods.add(m)); if (S.boss) { if (S.boss.isMid) sawMid = true; else sawBoss = true; } }
  if (process.env.WD_DBG) { const p0 = S.ps[0]; p0.cur = "emp"; hold(["fire"]); const hp0 = S.foes.map((e) => e.hp); const sh = []; const orig = global.Wavefront; step(600); out.dbg = { wpn: p0.wpn, hp0, hp1: S.foes.map((e) => e.hp), x: p0.x, rings: S.rings.length, fired: p0.shots, face: S.foes.map((e) => e.face) }; }
  out.surv = { maxWave, mods: [...mods], sawBoss, sawMid, hpScale: +(S.dif.hp).toFixed(3), secs: Math.round(t / 120), phase: S.phase, boss: S.boss ? [S.boss.key, Math.round(S.boss.x), Math.round(S.boss.y), Math.round(S.boss.hp), S.boss.ph, Math.round(S.boss.left)] : null, stuck: S.wave ? { wi: S.wave.wi, pend: S.wave.pend.length, foes: S.foes.filter((e) => e.alive).map((e) => [e.k, Math.round(e.x), Math.round(e.y), e.arena ? 1 : 0, Math.round(e.hp)]) } : null, cam: [Math.round(S.cam.x), Math.round(S.cam.y)], ov: api.overlayOpen(), dlg: dlg.slice(0, 120), pst: { dead: S.ps[0].dead, cool: S.ps[0].cool, cur: S.ps[0].cur, shield: S.ps[0].shield, vx: S.ps[0].vx }, p: [Math.round(S.ps[0].x), Math.round(S.ps[0].y)], out: S.ps.map((q) => q.out), lives: S.ps.map((q) => q.lives) };
  // now let the run end
  S.god = false; S.ps.forEach((p) => { p.lives = 0; p.dead = 0; p.out = false; }); const p = S.ps[0]; p.inv = 0; p.lives = 0; p.dead = 0;
  // kill directly
  for (let i = 0; i < 4 && !S.ps.every((q) => q.out); i++) { p.dead = 0.01; p.lives = 0; step(4); }
  flush(); step(120 * 12); flush();
  out.survOver = { phase: S.phase, board: W.save.surv.length, photons: W.save.ph, reported: reports.length - before, dialog: /Survival over/.test(dlg) };
  // 3. upgrades: buying in order, cost check, effects apply
  W.save.ph = 1000; W.save.up = {};
  global.EEArcadeDebug.game.menu(api); click("up"); click("buy", { "data-b": "armour", "data-i": "1" }); const skipped = !W.save.up.mend;
  click("buy", { "data-b": "armour", "data-i": "0" }); click("buy", { "data-b": "optics", "data-i": "0" });
  W.newRun(0, "solo"); out.upgrades = { skipped, plate: !!W.save.up.plate, hp: W.S.ps[0].hp, sine: W.S.ps[0].wpn.sine, ph: W.save.ph };
}

/* ---------- Induction Dash ---------- */
function runDash() {
  const G = global.InductionDash, I = global.InductionSim, api = global.EEArcadeDebug.api;
  out.migrated = typeof G.save.medals === "object" && Array.isArray(G.save.endless) && Array.isArray(G.save.carts);
  out.tracks = I.TRACKS.length; out.zones = I.ZONES.length;
  // physics: energy harvested equals kinetic energy lost, for every cart
  out.physics = I.CARTS.map((c) => { const v = 14, E = I.energy(v, c), dv = I.dv(c), m = c.m; const ke = 0.5 * m * (v * v - (v - dv) * (v - dv)); return { id: c.id, E: +E.toFixed(6), dv: +dv.toFixed(6), keLoss: +ke.toFixed(6) }; });
  // every track: the bot (lane picker that dodges hazards and seeks coils) finishes it and reaches the target on the starting cart
  out.runs = [];
  for (let k = 0; k < I.TRACKS.length; k++) {
    G.save.cleared = I.TRACKS.length; G.start(k, "basic"); api.hide(); const S = G.S;
    let t = 0;
    while (S.run && !S.over && t < 120 * 400) { G.bot(); step(2); t += 2; }
    flush();
    out.runs.push({ k, id: I.TRACKS[k].id, done: !!S.over, win: !!S.win, E: Math.round(S.energy), target: I.TRACKS[k].target, hearts: S.hearts, secs: Math.round(t / 120), medal: G.save.medals[I.TRACKS[k].id] || 0 });
  }
  // ghost: the best run is recorded and replayed on the next attempt
  G.start(0, "basic"); api.hide(); out.ghost = { have: !!(G.S.ghost && G.S.ghost.length > 10) };
  // endless: speed keeps rising, chunks keep coming, a leaderboard row is written
  G.save.endless = [];
  G.startEndless("basic"); api.hide(); const S = G.S; let t = 0, v0 = S.cruise;
  while (S.run && !S.over && t < 120 * 240) { G.bot(); step(2); t += 2; if (t === 120 * 60) out.cruise60 = +S.cruise.toFixed(2); }
  if (!S.over) { S.hearts = 0; step(4); } flush(); step(120 * 10); flush();
  out.endless = { v0, cruise: +S.cruise.toFixed(2), dist: Math.round(S.dist), rows: G.save.endless.length, ended: !!S.over, secs: Math.round(t / 120) };
  out.carts = I.CARTS.map((c) => c.id); out.unlockRule = I.CARTS.map((c) => c.need);
}
