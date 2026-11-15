/* Headless walk through the Freshers School Life walkthrough: a new student does every step with synthesised input,
   from "look around" to the hand-over to mission one; then the skip, replay, old-save and one-time-tip paths.
   Usage: node samaru_guide_harness.js <static/js/games dir>. Prints one JSON object; exits 1 on any thrown error. */
const path = require("path"), fs = require("fs"), dir = process.argv[2];
const noop = () => {};
function ctx() { const grad = { addColorStop: noop }; return new Proxy({}, { get: (t, k) => k in t ? t[k] : k === "measureText" ? (s) => ({ width: String(s).length * 7 }) : k === "createLinearGradient" || k === "createRadialGradient" ? () => grad : k === "createPattern" ? () => ({}) : noop, set: (t, k, v) => { t[k] = v; return true; } }); }
function el() { const e = { style: {}, children: [], hidden: true, innerHTML: "", value: "", classList: { add: noop, remove: noop, toggle: noop }, addEventListener: noop, getContext: ctx, getAttribute: () => "", setAttribute: noop, querySelector: () => el(), querySelectorAll: () => [], getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540 }), appendChild: noop, remove: noop, focus: noop, closest: () => null, width: 960, height: 540 }; return e; }
const store = {}, toasts = [];
const cards = []; // every element the guide creates, so the test can read the card text
global.window = global; global.self = global;
global.document = { querySelector: () => el(), querySelectorAll: () => [], createElement: () => { const e = el(); cards.push(e); return e; }, addEventListener: noop, body: el() };
global.performance = { now: () => Date.now() }; global.fetch = () => Promise.reject(new Error("offline"));
const keys = {}, pressed = {};
const api = { W: 960, H: 540, x: ctx(), t: 0, reduce: false, parts: [], shake: 0, esc: (s) => String(s),
  down: (...a) => a.some((k) => keys[k]), hit: (...a) => a.some((k) => pressed[k]), double: () => false,
  sound: { sfx: noop, say: noop, tone: noop, muted: true, ac: null }, burst: noop, kick: noop, buzz: noop, confetti: noop, flash: noop, zoom: noop, hitstop: noop, slowmo: noop,
  banner: noop, music: noop, panel: noop, useActions: noop, keyName: (k) => ({ up: "W / ↑", run: "Shift", act: "E / Enter", jump: "Space" }[k] || k),
  show: (html, on) => { api._open = true; api._on = on; api._html = html; }, hide: () => { api._open = false; }, overlayOpen: () => !!api._open,
  store: (k, v) => { if (v === undefined) return store[k] ? JSON.parse(store[k]) : null; store[k] = JSON.stringify(v); } };
global.Arcade = { song: () => ({}), toast: (h) => toasts.push(h), report: noop, run: (g) => { global.GAME = g; g.init(api); } };
// the same script list as the main harness, read from it so the two cannot drift apart
const list = JSON.parse(/for \(const \w+ of (\[[^\]]+\])/.exec(fs.readFileSync(path.join(__dirname, "samaru_harness.js"), "utf8"))[1]);
for (const f of list) { const code = fs.readFileSync(path.join(dir, f + ".js"), "utf8"); (0, eval)(code); if (f === "fslg-map") global.SamaruMap = global.SamaruMap || module.exports; }
const Z = global.SamaruGame, S = global.SamaruSim, D = global.SamaruData, G = Z.guide;
const STEP = 1 / 60;
function run(sec, each) { for (let i = 0; i < sec * 60; i++) { if (each) each(i); GAME.update(STEP, api); api.t += STEP; for (const k in pressed) pressed[k] = false; if (i % 3 === 0) GAME.draw(api); } }
function tap(k) { pressed[k] = true; }
function act(a) { const F = global.SamaruGame && SamaruGame.phone; if (F && F.isOpen() && !api._open && F.act(a)) return; const on = api._on; if (!on) throw new Error("no dialog open for " + a); on(a, { disabled: false, getAttribute: () => a, style: {}, classList: { add: noop } }); }
// pick a menu row by its label, not its position, so new phone tabs cannot shift the test
function actLabel(re) { const F = global.SamaruGame && SamaruGame.phone; if (F && F.isOpen() && !api._open) { if (!F.pressLabel(re)) throw new Error("no phone app matching " + re + " in: " + F.labels().join(" | ")); return; } const html = api._html || "", rows = [...html.matchAll(/data-act='(i\d+)'[^>]*>([\s\S]*?)<\/button>/g)], hit = rows.find((r) => re.test(r[2].replace(/<[^>]+>/g, " "))); if (!hit) throw new Error("no menu row matching " + re + " in: " + rows.map((r) => r[2].replace(/<[^>]+>/g, " ").trim().slice(0, 30)).join(" | ")); act(hit[1]); }
function card() { const c = cards.filter((e) => /fg-card/.test(e.className || "")).pop(); return c && !c.hidden ? c.innerHTML : ""; }
function title() { const m = /<b>([^<]+)<\/b>/.exec(card()); return m ? m[1] : ""; }
const out = { seen: [], devices: {} };
try {
  run(.5);
  // a fake 3D view so the camera step runs: the camera keys turn its yaw exactly as the real engine does
  Z.r3 = { ready: true, yaw: 1.57, pitch: .3, render: () => false, turn(d) { this.yaw += d; }, project: () => ({ x: 480, y: 300 }) };
  // what the creator does for a new student
  const p = S.newPlayer("amina", "Tester"); p.home = "amina"; const g0 = Z.places.gate; p.x = g0.mx; p.y = g0.my + 6; p.guide = { s: 0, hints: {} }; api._open = false; Z.begin(p, true);
  const P = Z.P, me = Z.me, xp0 = P.xp;
  out.total = G.STEPS.length; out.startsActive = G.active(); out.hiddenAtFirst = card() === "";
  run(4.2); // the chapter banner clears first
  const at = (id) => { if (G.STEPS[P.guide.s] !== id) throw new Error("expected step " + id + ", at " + G.STEPS[P.guide.s] + " (" + title() + ")"); out.seen.push(title()); };
  const settle = () => run(1.6);

  at("look"); G.device("kb"); run(.1); out.devices.kb = card().indexOf("fg-k") > 0; G.device("touch"); run(.1); out.devices.touch = /RIGHT/.test(card()) && !/fg-k'/.test(card()); G.device("pad"); run(.1); out.devices.pad = /right stick/.test(card()); G.device("kb"); run(.1);
  out.noFreeTick = P.guide.s === 0; keys.camR = true; run(1); keys.camR = false; settle();
  at("walk"); keys.up = true; run(2.5); keys.up = false; settle();
  at("sprint"); keys.up = true; run(1.5); out.walkIsNotSprint = G.STEPS[P.guide.s] === "sprint"; keys.run = true; run(1.6); keys.up = keys.run = false; settle();
  at("jump"); tap("jump"); run(.3); settle();
  at("talk"); const n = Z.npcs.slice().sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0]; out.talkTo = n.def.name; out.talkDist = Math.round(Math.hypot(n.x - me.x, n.y - me.y));
  me.x = n.x + 1.2; me.y = n.y; run(.1); tap("act"); run(.2); out.menuHidesCard = api._open && card() === ""; api._open = false; settle();
  at("phone"); tap("phone"); run(.2); out.phoneAloneIsNotEnough = G.STEPS[P.guide.s] === "phone"; actLabel(/^\s*Goals/); act("b"); api._open = false; if (Z.phone && Z.phone.isOpen()) Z.phone.close(true); settle();
  at("gps"); const tg = Z.target(), d0 = Math.hypot(tg.x - me.x, tg.y - me.y); out.gpsTarget = tg.name; const back = S.push(Z.W, g0.mx, g0.my + 6, .6); me.x = back.x; me.y = back.y; run(.2);
  { const a = Math.atan2(tg.y - me.y, tg.x - me.x), f = S.push(Z.W, me.x + Math.cos(a) * 16, me.y + Math.sin(a) * 16, .5); me.x = f.x; me.y = f.y; } run(.2); settle(); void d0;
  at("bike"); const bike = Z.cars.filter((c) => c.type === "bike").sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0]; out.bikeDist = Math.round(Math.hypot(bike.x - me.x, bike.y - me.y));
  me.x = bike.x + 1; me.y = bike.y; run(.1); tap("act"); run(.2); out.riding = !!me.veh && me.veh.type; settle();
  at("ride"); out.rideTo = /fountain/.test(card()) ? "fountain" : "marker"; keys.up = true; run(2); keys.up = false; out.notThereYet = G.STEPS[P.guide.s] === "ride"; me.veh.x = 0; me.veh.y = -340; me.veh.vx = me.veh.vy = 0; me.veh.speed = 0; run(.3); settle();
  at("radio"); tap("radio"); run(.2); settle();
  at("off"); me.veh.vx = me.veh.vy = 0; me.veh.speed = 0; run(.3); tap("act"); run(.2); out.onFoot = !me.veh; settle();
  at("punch"); me.cool = 0; tap("attack"); run(.1); settle();
  at("wave"); tap("emote1"); run(.2); settle();
  at("needs"); out.infoHasButton = /data-fg='ok'/.test(card()); G.act("ok"); settle();
  at("sleep"); G.act("ok"); run(1.2);
  out.done = !!P.guide.done && !G.active(); out.endCard = /ready/.test(card()); out.log = G.log.slice(); out.xp = P.xp - xp0; out.mission = P.m.active; out.missionStep = P.m.step;
  run(8); out.endCardLeaves = card() === "" || /TIP/.test(card());
  // the progress is in the save, and an old save without the field loads as "finished"
  Z.save(); const saved = Z.load(); out.savedDone = !!(saved && saved.guide && saved.guide.done);
  const old = S.newPlayer("tunde", "Old"); out.oldHasNoField = old.guide === undefined; Z.begin(S.migrate(JSON.parse(JSON.stringify(old)))); run(5); out.oldSaveNoTutorial = !G.active() && !/WALKTHROUGH/.test(card());
  // one-time tips: hunger fires once, then never again
  const Q = Z.P; { const far = Z.places.dam; Z.me.x = far.mx; Z.me.y = far.my + 20; } Q.hunger = 10; run(8); /* tips wait while a mission target is close; mission one now starts beside the gate */ out.tip = /hungry/.test(card()); G.act("ok"); run(.2); out.tipDismissed = !/hungry/.test(card()); Q.guide.hints = Object.assign({}, Q.guide.hints); const hints1 = Object.keys(Q.guide.hints).length; run(20); out.tipOnce = G.log.filter((l) => l === "tip:hungry").length === 1; out.hintsSaved = hints1 >= 1;
  // security events from the game raise their own one-time tips
  Z.emit({ t: "warn" }); run(14); out.warnTip = G.log.indexOf("tip:warn") >= 0; G.act("ok"); Z.emit({ t: "wanted" }); run(14); out.wantedTip = G.log.indexOf("tip:wanted") >= 0; G.act("ok"); run(.2);
  // replay from the menu, minimise, then skip
  Z.ui.phone(); actLabel(/^\s*(How to play|Help)\b/); out.helpOffersReplay = /Replay the walkthrough/.test(api._html); act("tut"); run(1); out.replays = G.active() && Z.P.guide.s === 0;
  G.act("min"); run(.2); out.minimised = /fg-pill/.test(card()); G.act("max"); run(.2); out.restored = /WALKTHROUGH 1/.test(card());
  G.act("skip"); run(.5); out.skipped = !G.active() && !/WALKTHROUGH/.test(card()) && toasts.some((t) => /skipped/.test(t));
  out.ok = true;
} catch (e) { out.ok = false; out.error = String(e && e.stack || e).split("\n").slice(0, 6).join(" | "); }
console.log(JSON.stringify(out)); process.exit(out.ok ? 0 : 1);
