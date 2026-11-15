/* Headless checks for Freshers School Life water: swimming, breath, banks and steps, vehicles in the lake, fish
   staying in the water, walkers kept out, the Dam Visitor Centre and the buoy-swim timer.
   Usage: node samaru_water_harness.js <static/js/games dir>. Prints one JSON object. */
const path = require("path"), fs = require("fs"), dir = process.argv[2];
const noop = () => {};
function ctx() { const grad = { addColorStop: noop }; return new Proxy({}, { get: (t, k) => k in t ? t[k] : k === "measureText" ? (s) => ({ width: String(s).length * 7 }) : k === "createLinearGradient" || k === "createRadialGradient" ? () => grad : k === "createPattern" ? () => ({}) : noop, set: (t, k, v) => { t[k] = v; return true; } }); }
function el() { const e = { style: {}, children: [], hidden: true, innerHTML: "", value: "", classList: { add: noop, remove: noop, toggle: noop }, addEventListener: noop, getContext: ctx, getAttribute: () => "", setAttribute: noop, querySelector: () => el(), querySelectorAll: () => [], getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540 }), appendChild: noop, remove: noop, focus: noop }; return e; }
const store = {}, toasts = [];
global.window = global; global.self = global;
{ let seed = 20261114 >>> 0, simMs = 0, tid = 0; const q = [];
  Math.random = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  Date.now = () => 1.7e12 + Math.floor(simMs);
  global.setTimeout = (fn, ms) => { q.push({ id: ++tid, at: simMs + (+ms || 0), fn: fn }); return tid; }; global.clearTimeout = (id) => { const i = q.findIndex((e) => e.id === id); if (i >= 0) q.splice(i, 1); };
  global.setInterval = () => 0; global.clearInterval = noop;
  global.__pump = (ms) => { simMs += ms; for (let g = 0; g < 50; g++) { let k = -1; for (let i = 0; i < q.length; i++) if (q[i].at <= simMs && (k < 0 || q[i].at < q[k].at)) k = i; if (k < 0) break; q.splice(k, 1)[0].fn(); } }; }
global.document = { querySelector: () => el(), querySelectorAll: () => [], createElement: () => el(), addEventListener: noop, body: el() };
global.performance = { now: () => Date.now() }; global.fetch = () => Promise.reject(new Error("offline"));
const keys = {}, pressed = {}, sounds = [];
const api = { W: 960, H: 540, x: ctx(), t: 0, reduce: false, parts: [], shake: 0, esc: (s) => String(s),
  down: (...a) => a.some((k) => keys[k]), hit: (...a) => a.some((k) => pressed[k]), double: () => false,
  sound: { sfx: (n) => sounds.push(n), say: noop, tone: noop, muted: true, ac: null, register: noop }, burst: noop, kick: noop, buzz: noop, confetti: noop, flash: noop, zoom: noop, hitstop: noop, slowmo: noop,
  banner: noop, music: noop, panel: noop, useActions: noop, keyName: (k) => ({ act: "E", jump: "Space", run: "Shift" }[k] || k),
  show: (html, on) => { api._open = true; api._on = on; api._html = html; }, hide: () => { api._open = false; }, overlayOpen: () => !!api._open,
  store: (k, v) => { if (v === undefined) return store[k] ? JSON.parse(store[k]) : null; store[k] = JSON.stringify(v); } };
global.Arcade = { song: () => ({}), toast: (h) => toasts.push(h), report: noop, run: (g) => { global.GAME = g; g.init(api); } };
const list = JSON.parse(/for \(const \w+ of (\[[^\]]+\])/.exec(fs.readFileSync(path.join(__dirname, "samaru_harness.js"), "utf8"))[1]);
const src = list.map((f) => [f, fs.readFileSync(path.join(dir, f + ".js"), "utf8")]);
for (const [f, code] of src) { (0, eval)(code); if (f === "fslg-map") global.SamaruMap = global.SamaruMap || module.exports; }
const Z = global.SamaruGame, S = global.SamaruSim, Wa = Z.water, STEP = 1 / 60;
function run(sec, each) { for (let i = 0; i < sec * 60; i++) { if (each) each(i); GAME.update(STEP, api); api.t += STEP; __pump(STEP * 1000); for (const k in pressed) pressed[k] = false; if (i % 3 === 0) GAME.draw(api); } }
function clear() { for (const k in keys) keys[k] = false; api._open = false; if (Z.momentClear) Z.momentClear(); }
const out = { ok: true };
try {
  run(.5);
  const p = S.newPlayer("amina", "Swimmer"); p.home = "amina"; p.guide = { s: 99, done: 1, hints: {} }; api._open = false; Z.begin(p, true); if (Z.intro && Z.intro.on && Z.intro.end) Z.intro.end(); api._open = false; run(.3); clear();
  const P = Z.P, me = Z.me, L = Wa.main(), st = Wa.site(); P.lvl = 60; P.money = 1e5;
  out.lake = { name: L.name, maxD: L.maxD, lakes: Wa.lakes().length, deepMid: +Wa.depth(L.cx, L.cy).toFixed(2), dryOutside: Wa.depth(L.x0 - 20, L.cy) === 0, shelf: Wa.depth(st.edge.x, st.edge.y + 1) < Wa.depth(st.edge.x, st.edge.y + 8) };
  out.place = !!Z.places.damcentre && Z.interior.typeOf(Z.places.damcentre) === "aquarium";
  // ---- walk in from the bank: wading, then swimming ----
  P.time = 12 * 60; P.energy = 100; me.x = st.top.x; me.y = st.top.y; me.a = Math.PI / 2; run(.2); out.startDry = !Wa.swimming();
  let waded = false; keys.down = true; run(9, () => { if (!Wa.swimming() && Wa.depth(me.x, me.y) > .2) waded = true; }); keys.down = false; run(.3);
  out.swim = { waded: waded, on: Wa.swimming(), depth: +Wa.depth(me.x, me.y).toFixed(2), splash: sounds.includes("splash") || sounds.includes("splash_small"), toast: toasts.some((t) => /Swimming/.test(t)) };
  { const x0 = me.x, y0 = me.y; keys.down = true; run(2); keys.down = false; out.swim.speed = +(Math.hypot(me.x - x0, me.y - y0) / 2).toFixed(2); out.swim.slower = out.swim.speed < S.FOOT.walk * .8 && out.swim.speed > .8; }
  { const e0 = P.energy; keys.down = true; keys.run = true; run(2); keys.down = keys.run = false; out.swim.sprintCost = +(e0 - P.energy).toFixed(2); }
  // no jumping in deep water: the jump key dives instead
  pressed.jump = true; run(.1); out.dive = { want: me.swim.want > 0, z: me.z }; run(3); const s1 = Wa.state(); out.dive.under = s1.under; out.dive.breathFalls = s1.breath < 1;
  { const hp0 = P.hp; let minB = 1, surfaced = false; run(RULESafe() + 8, () => { const s = Wa.state(); minB = Math.min(minB, s.breath); }); const s2 = Wa.state(); surfaced = !s2.under; out.breath = { ranOut: minB <= 0, surfaced: surfaced, hpKept: P.hp >= hp0, toast: toasts.some((t) => /Out of breath/.test(t)) }; run(4); out.breath.refilled = Wa.state().breath > .95; }
  pressed.jump = true; run(.1); run(1.5); pressed.jump = true; run(.1); run(2); out.dive.toggleUp = !Wa.state().under && me.swim.want === 0;
  out.breath.secs = S.RULES.swimBreath; out.breath.lowWarn = toasts.some((t) => /Air low/.test(t)) && sounds.includes("pluck");
  // ---- the diving spot at the end of the pier ----
  { clear(); const pe = Wa.pierEnd(); me.x = pe.x; me.y = pe.y; run(.3); const d = { prompt: Z.prompt(), onDeck: !Wa.swimming() }; pressed.act = true; run(.3); d.airborne = me.z > .3; run(1); d.inWater = Wa.swimming(); d.under = Wa.state().under; run(3); d.surfaced = !Wa.state().under; d.counted = (P.stats.dives || 0) === 1; out.diveSpot = d; }
  // ---- a friend walking with you swims with you ----
  { const n = Z.npcs.find((q) => !q.hidden && q.id !== "lifeguard" && !q.def.boss); me.x = L.cx; me.y = L.cy; n.x = me.x + 2; n.y = me.y + 1; n.follow = true; run(3); out.friend = { stays: Wa.depth(n.x, n.y) > S.RULES.swimWade, swims: !!(n.swimS && n.swimS.on) }; n.follow = false; run(.6); out.friend.outAfter = Wa.depth(n.x, n.y) < .6; }
  // ---- deep water outside the lifeguard's area warns once ----
  out.deepWarn = toasts.some((t) => /Deep water/.test(t));
  // ---- climb out at a bank: swim east until dry ----
  { me.x = L.x1 - 20; me.y = L.cy; run(.3); const was = Wa.swimming(); keys.right = true; let t = 0; while (Wa.swimming() && t++ < 30) run(.5); run(1.5); keys.right = false; run(.3); out.bank = { was: was, out: !Wa.swimming(), dryish: Wa.depth(me.x, me.y) < 1, wet: Wa.state().wet, sound: sounds.includes("water_out") }; }
  // ---- climb out at the steps ----
  { me.x = st.edge.x; me.y = st.edge.y + 3; run(.3); out.steps = { swimming: Wa.swimming(), prompt: Z.prompt() }; pressed.act = true; run(.2); out.steps.out = !Wa.swimming() && me.y < st.edge.y; }
  // ---- walkers keep out of deep water ----
  { const n = Z.npcs.find((q) => !q.hidden && q.id !== "lifeguard"); n.x = L.cx + 10; n.y = L.cy; n.hx = n.x; n.hy = n.y; run(.6); out.npcOut = Wa.depth(n.x, n.y) < .6; }
  // ---- fish: in the water, below the surface, moving, scattered over the species ----
  { me.x = st.top.x; me.y = st.top.y; run(.2); const f0 = Wa.fish.map((f) => [f.x, f.y]); let bad = 0, deepBad = 0, jumps = 0; run(60, (i) => { if (i % 6) return; Wa.fish.forEach((f) => { if (f.jump) { jumps++; return; } if (!S.inWater(Z.W, f.x, f.y) || Wa.depth(f.x, f.y) < .5) bad++; if (f.d < .2 || f.d > Wa.depth(f.x, f.y) + .01) deepBad++; }); });
    const moved = Wa.fish.filter((f, i) => Math.hypot(f.x - f0[i][0], f.y - f0[i][1]) > 2).length;
    out.fish = { n: Wa.fish.length, species: new Set(Wa.fish.map((f) => f.sp.id)).size, bad: bad, deepBad: deepBad, moved: moved, jumped: jumps > 0, ducks: Wa.ducks.length, egrets: (Wa.egrets || []).length };
    // far from the dam nothing is simulated
    const fx = Wa.fish[0].x; me.x = 0; me.y = -600; run(2); out.fish.idleFar = Wa.fish[0].x === fx; }
  // ---- a car driven into the lake stops; you swim clear; it is towed back ----
  { const car = Z.cars.find((c) => c.type === "car") || Z.cars[0]; clear(); me.x = st.top.x - 12; me.y = st.top.y - 2; run(.2); car.x = me.x; car.y = me.y; car.a = Math.PI / 2; car.vx = car.vy = 0; car.speed = 0; const hx = car.hx, hy = car.hy; Z.enter(car); run(.9);
    const inCar = me.veh === car; keys.up = true; let t = 0; while (me.veh && t++ < 40) run(.25); keys.up = false; run(.6);
    out.car = { inCar: inCar, stopped: Math.abs(car.speed) < .01 && !car.vx && !car.vy, ejected: !me.veh, swimming: Wa.swimming(), inLake: S.inWater(Z.W, car.x, car.y), drowned: !!car.drown, toast: toasts.some((q) => /engine floods/.test(q)) };
    const pc = { x: car.x, y: car.y }; run(2); out.car.stays = Math.hypot(car.x - pc.x, car.y - pc.y) < .01;
    Z.enter(car); out.car.refused = !me.veh;
    me.x = st.top.x; me.y = st.top.y - 30; run(S.RULES.swimTow + 2); out.car.towed = !car.drown && Math.hypot(car.x - hx, car.y - hy) < 1; }
  // ---- the lifeguard keeps his chair ----
  { me.x = st.top.x; me.y = st.top.y; run(.5); const lg = Z.npc("lifeguard"); out.lifeguard = !!lg && Math.hypot(lg.x - st.chair.x, lg.y - st.chair.y) < 2; }
  // ---- the Dam Visitor Centre ----
  { const I = Z.interior, io = {}; out.centre = io; const pl = Z.places.damcentre; clear(); P.time = 2 * 60; me.x = pl.mx; me.y = pl.my; run(.2); io.lockedAtNight = /^Locked/.test(Z.prompt());
    P.time = 11 * 60; run(.2); io.prompt = Z.prompt(); pressed.act = true; run(.6); for (let w = 0; !Z.inside && w < 40; w++) { clear(); run(.2); }
    const c = Z.inside; io.entered = !!c && c.type === "aquarium"; io.tank = c && c.room.tank > 10; io.panels = c ? c.room.spots.filter((s) => s.k === "panel").map((s) => s.pid) : [];
    io.cantReachTank = (() => { const f = S.push(Z.W, c.ox, c.oy + c.room.d - 1, .4); return f.y - c.oy < c.room.tank; })();
    const reads = {}; ["purpose", "dam", "treat", "safety", "fish", "swim"].forEach((id) => { const sp = c.room.spots.find((s) => s.pid === id); me.x = c.ox + sp.x; me.y = c.oy + sp.y; run(.1); const pr = Z.prompt(); pressed.act = true; run(.1); reads[id] = { prompt: /^Read/.test(pr), open: !!api._open, html: (api._html || "").replace(/<[^>]+>/g, " ").slice(0, 4000) }; if (api._on) api._on("ok", { getAttribute: () => "ok" }); api._open = false; });
    io.read = Object.keys(reads).filter((k) => reads[k].open && reads[k].prompt); io.damText = /spillway/i.test(reads.dam.html) && /intake/i.test(reads.dam.html); io.treatText = /Filtration/.test(reads.treat.html) && /Chlorine/.test(reads.treat.html);
    io.fishText = ["tilapia", "catfish", "Nile perch"].every((w) => reads.fish.html.indexOf(w) >= 0) && /Clarias/.test(reads.fish.html); io.safetyText = /alone/.test(reads.safety.html) && /bilharzia/.test(reads.safety.html); io.inspired = /inspired by/.test(reads.purpose.html);
    io.allBonus = !!P.flags.dc_all;
    const seat = c.room.spots.find((s) => s.k === "seat"); me.x = c.ox + seat.x; me.y = c.oy + seat.y; run(.1); io.seatPrompt = Z.prompt(); pressed.act = true; run(.3); io.sat = !!me.sit; keys.down = true; run(.4); keys.down = false;
    const ex = c.room.spots.find((s) => s.k === "exit"); me.x = c.ox + ex.x; me.y = c.oy + ex.y; run(.1); pressed.act = true; run(.7); io.left = !Z.inside && Math.hypot(me.x - pl.mx, me.y - pl.my) < 3; io.err = String(I.err || ""); }
  // ---- the buoy swim: board, countdown, buoys in order, a best time ----
  { const r = {}; out.race = r; clear(); me.x = st.board.x; me.y = st.board.y; run(.2); r.prompt = Z.prompt(); pressed.act = true; run(.1); r.count = Wa.cur && Wa.cur.state === "count"; run(3.2); r.running = Wa.cur && Wa.cur.state === "run"; r.target = (Z.target() || {}).name;
    const h = Wa.cur; me.x = st.edge.x; me.y = st.edge.y + 6; run(2); r.swimming = Wa.swimming();
    // skipping buoy 2 does not count: the gates go in order
    me.x = st.gates[1].x; me.y = st.gates[1].y; run(.3); r.order = h.gate === 0;
    st.gates.forEach((g, i) => { me.x = g.x + .5; me.y = g.y; run(1 + i * .5); }); r.done = h.state === "done" && !Wa.cur; r.t = +h.t.toFixed(2); r.best = Wa.best(); r.splits = h.splits.length; r.reward = toasts.some((q) => /Buoy swim: /.test(q));
    // a slower second swim keeps the record; a faster one replaces it
    const b1 = Wa.best(); const h2 = Wa.challenge(); run(3.2); st.gates.forEach((g) => { me.x = g.x; me.y = g.y; run(3); }); r.slowerKeeps = Wa.best() === b1 && h2.t > b1;
    const h3 = Wa.challenge(); run(3.2); st.gates.forEach((g) => { me.x = g.x; me.y = g.y; run(.4); }); r.fasterSets = Wa.best() < b1 && Math.abs(Wa.best() - h3.t) < .02;
    // leaving the water for long abandons it
    Wa.challenge(); run(3.2); me.x = st.top.x; me.y = st.top.y - 4; run(14); r.abandon = !Wa.cur && toasts.some((q) => /abandoned/.test(q));
    // the general race API: two laps over two gates
    const ga = [{ x: L.cx - 20, y: L.cy, r: 4 }, { x: L.cx + 20, y: L.cy, r: 4 }]; let fin = null; const rc = Wa.race({ gates: ga, laps: 2, onFinish: (q) => { fin = q.t; } }).start(); [0, 1, 0, 1].forEach((k) => { me.x = ga[k].x; me.y = ga[k].y; run(.5); }); r.api = { laps: rc.lap, done: rc.state === "done", time: fin != null && fin > 1.5, splits: rc.splits.length }; }
  // ---- out of the water: back to normal ----
  { clear(); me.x = st.top.x; me.y = st.top.y; run(1); pressed.jump = true; run(.1); out.landJump = me.z > 0 || me.vz > 0; }
  out.err = String(Wa.err || Wa.perr || Z.interior.err || ""); out.sounds = [...new Set(sounds.filter((n) => /splash|swim|bubbles|water_out|gasp/.test(n)))].sort();
} catch (e) { out.ok = false; out.error = String(e && e.stack || e); }
function RULESafe() { return S.RULES.swimBreath; }
console.log(JSON.stringify(out));
