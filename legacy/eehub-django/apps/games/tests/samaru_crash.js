/* Headless crash checks for Freshers School Life: the real game scripts, one scenario per collision pair.
   Usage: node samaru_crash.js <static/js/games dir>  → one JSON line { ok, cases: { name: {...} }, sounds: {...} }.
   Deterministic: fixed random stream, a clock that only moves with simulated time. */
const path = require("path"), fs = require("fs"), dir = process.argv[2];
const noop = () => {};
function ctx() { const grad = { addColorStop: noop }; return new Proxy({}, { get: (t, k) => k in t ? t[k] : k === "measureText" ? (s) => ({ width: String(s).length * 7 }) : k === "createLinearGradient" || k === "createRadialGradient" ? () => grad : k === "createPattern" ? () => ({}) : noop, set: (t, k, v) => { t[k] = v; return true; } }); }
function el() { return { style: {}, children: [], hidden: true, innerHTML: "", value: "", classList: { add: noop, remove: noop, toggle: noop }, addEventListener: noop, getContext: ctx, getAttribute: () => "", setAttribute: noop, querySelector: () => el(), querySelectorAll: () => [], getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540 }), appendChild: noop, remove: noop, focus: noop, closest: () => null, width: 960, height: 540 }; }
const store = {};
global.window = global; global.self = global;
{ let seed = 777 >>> 0, simMs = 0, tid = 0; const q = [], T0 = 1.7e12;
  Math.random = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  Date.now = () => T0 + Math.floor(simMs);
  global.setTimeout = (fn, ms) => { q.push({ id: ++tid, at: simMs + (+ms || 0), fn: fn }); return tid; }; global.clearTimeout = (id) => { const i = q.findIndex((e) => e.id === id); if (i >= 0) q.splice(i, 1); };
  global.setInterval = () => 0; global.clearInterval = () => {};
  global.__pump = (ms) => { simMs += ms; for (let guard = 0; guard < 50; guard++) { let k = -1; for (let i = 0; i < q.length; i++) if (q[i].at <= simMs && (k < 0 || q[i].at < q[k].at)) k = i; if (k < 0) break; const e = q.splice(k, 1)[0]; e.fn(); } }; }
global.document = { querySelector: () => el(), querySelectorAll: () => [], createElement: () => el(), addEventListener: noop, body: el() };
global.performance = { now: () => Date.now() }; global.fetch = () => Promise.reject(new Error("offline"));
const keys = {}, pressed = {}, heard = [];
const api = { W: 960, H: 540, x: ctx(), t: 0, reduce: false, parts: [], shake: 0, esc: (s) => String(s),
  down: (...a) => a.some((k) => keys[k]), hit: (...a) => a.some((k) => pressed[k]), double: () => false,
  sound: { sfx: (n, o) => heard.push({ n: n, t: api.t, g: o && o.gain }), say: noop, tone: noop, muted: true, ac: null, register: (m) => { api._reg = Object.keys(m); } }, burst: noop, kick: (m) => { api._kick = Math.max(api._kick || 0, m); }, buzz: noop, confetti: noop, flash: noop, zoom: noop, hitstop: noop, slowmo: noop,
  banner: noop, music: noop, panel: noop, useActions: noop, keyName: (k) => k,
  show: () => { api._open = true; }, hide: () => { api._open = false; }, overlayOpen: () => !!api._open,
  store: (k, v) => { if (v === undefined) return store[k] ? JSON.parse(store[k]) : null; store[k] = JSON.stringify(v); } };
global.Arcade = { song: () => ({}), toast: noop, report: noop, run: (g) => { global.GAME = g; g.init(api); } };
for (const code of ["fslg-map", "samaru-sim", "samaru-data", "fslg-story-y1", "fslg-story-y2", "fslg-story-y3", "fslg-story-y4", "fslg-story-y5", "fslg-story-side", "fslg-story-coop", "samaru-draw", "samaru-core", "samaru-story", "samaru-intro", "samaru-anim", "samaru-wardrobe", "samaru-veh", "samaru-fx", "samaru-touch", "samaru-settings", "samaru-guide", "samaru-moment", "samaru-life", "samaru-interior", "samaru-mall", "samaru-friends", "samaru-brawl", "samaru-jobs", "samaru-crowd", "samaru-city", "samaru-ui", "samaru-inv", "samaru-phone", "samaru-texts", "samaru-travel", "samaru-wild", "samaru-map", "samaru-voice", "samaru-minigames", "samaru-audio", "samaru-water", "samaru"].map((f) => [f, fs.readFileSync(path.join(dir, f + ".js"), "utf8")])) { const f = code[0]; (0, eval)(code[1]); if (f === "fslg-map") global.SamaruMap = global.SamaruMap || module.exports; }
const Z = global.SamaruGame, S = global.SamaruSim, V = Z.veh;
const STEP = 1 / 120, out = { ok: true, cases: {} };
let mine = { traffic: new Set(), cars: new Set(), peds: new Set() };
function clean() { // only the machines and people a scenario put there
  for (let i = Z.traffic.length - 1; i >= 0; i--) if (!mine.traffic.has(Z.traffic[i]) && !Z.traffic[i].remount) Z.traffic.splice(i, 1);
  for (let i = Z.peds.length - 1; i >= 0; i--) if (!mine.peds.has(Z.peds[i]) && !Z.peds[i].look._spill) { const p = Z.peds[i]; if (V.spills.some((s) => s.p === p)) { mine.peds.add(p); continue; } Z.peds.splice(i, 1); }
  if (global.__noAmb) for (let i = Z.npcs.length - 1; i >= 0; i--) if (/^amb_/.test(Z.npcs[i].id)) Z.npcs.splice(i, 1);
  Z.foes.length = 0; Z.P.time = 720; Z.P.sec = Z.P.sec || {}; Z.P.hp = Z.P.maxHp; Z.P.energy = 100; Z.P.hunger = 100;
}
function run(sec, each) { for (let i = 0; i < Math.round(sec * 120); i++) { clean(); if (each) each(i); GAME.update(STEP, api); api.t += STEP; __pump(STEP * 1000); for (const k in pressed) pressed[k] = false; } }
function capsule(o) { const d = V.dims(o), r = d.wid / 2, h = Math.max(0, d.len / 2 - r); return { x: o.x, y: o.y, a: o.a || 0, h, r }; }
function gap(a, b) { // surface distance between two capsules (negative = overlap)
  const A = capsule(a), B = capsule(b), ca = Math.cos(A.a), sa = Math.sin(A.a), cb = Math.cos(B.a), sb = Math.sin(B.a); let best = 1e9;
  for (let i = 0; i <= 20; i++) { const s = -1 + i / 10, px = A.x + ca * A.h * s, py = A.y + sa * A.h * s; for (let j = 0; j <= 20; j++) { const t = -1 + j / 10, qx = B.x + cb * B.h * t, qy = B.y + sb * B.h * t; best = Math.min(best, Math.hypot(px - qx, py - qy)); } }
  return +(best - A.r - B.r).toFixed(3);
}
function inWall(o) { const A = capsule(o), ca = Math.cos(A.a), sa = Math.sin(A.a); let worst = 0; for (const s of [-1, 0, 1]) { const px = A.x + ca * A.h * s, py = A.y + sa * A.h * s, n = S.push(Z.W, px, py, A.r - .06); if (n.hit) worst = Math.max(worst, Math.hypot(n.x - px, n.y - py)); } return +worst.toFixed(3); }
const W = () => Z.W;
// an open patch of ground with nothing within R metres
function clearSpot(R) { for (let k = 0; k < 3000; k++) { const a = k * 2.39996, rr = 20 + k * .9, x = 30 + Math.cos(a) * rr, y = -200 + Math.sin(a) * rr; if (S.inWater(W(), x, y) || S.insideBuilding(W(), x, y)) continue; let ok = true; for (let q = 0; q < 16 && ok; q++) { const qa = q * Math.PI / 8; for (const d of [R * .33, R * .66, R]) if (S.push(W(), x + Math.cos(qa) * d, y + Math.sin(qa) * d, 1).hit || S.inWater(W(), x + Math.cos(qa) * d, y + Math.sin(qa) * d)) ok = false; } if (ok) return { x, y }; } throw new Error("no clear spot"); }
// a straight drivable stretch with room either side
function roadSpot() { const Wd = W(); for (const r of Wd.roads) { if (!r.drive || r.w < 6) continue; const p = r.p; let dd = 0; for (let s = 0; s + 3 < p.length; s += 2) { const L = Math.hypot(p[s + 2] - p[s], p[s + 3] - p[s + 1]); if (L > 70) { const a = Math.atan2(p[s + 3] - p[s + 1], p[s + 2] - p[s]), mx = (p[s] + p[s + 2]) / 2, my = (p[s + 1] + p[s + 3]) / 2; let ok = true; for (let u = -30; u <= 30 && ok; u += 5) { const x = mx + Math.cos(a) * u, y = my + Math.sin(a) * u; if (S.push(Wd, x, y, 3).hit || S.inWater(Wd, x, y)) ok = false; } if (ok) return { x: mx, y: my, a, r, d: dd + L / 2 }; } dd += L; } } throw new Error("no road"); }
const P0 = S.newPlayer("amina", "Tester"); P0.home = "amina"; P0.lvl = 20; P0.money = 1e6; api._open = false; Z.begin(P0, true); api._open = false;
const me = Z.me; Z.P.lvl = 20; Z.P.money = 1e6;
let carSeq = 0;
function park(type, x, y, a, extra) { const c = Object.assign({ id: 900 + carSeq++, type, x, y, a, vx: 0, vy: 0, speed: 0, col: "#e5e7eb", hx: x, hy: y, ha: a, free: true }, extra || {}); Z.cars.push(c); mine.cars.add(c); return c; }
function ride(c) { if (me.veh) Z.exit(true); me.x = c.x; me.y = c.y; me.fall = 0; me.kvx = me.kvy = 0; Z.enter(c); return c; }
function traffic(type, spot, ahead, vk) { const w = { road: spot.r.i, fwd: true, d: spot.d + ahead, x: 0, y: 0, a: 0, drive: true }; S.wanderStep(W(), w, 0, S.rng(5), spot.r.w * .23); const t = { w, type, col: "#1d4ed8", sp: 0, v: 0, x: w.x, y: w.y, a: w.a, pri: 9000 + carSeq++, look: { skin: "#8d5524", top: "#16a34a" }, vk }; Z.traffic.push(t); mine.traffic.add(t); return t; }
function reset() { if (me.veh) Z.exit(true); for (const c of mine.cars) { const i = Z.cars.indexOf(c); if (i >= 0) Z.cars.splice(i, 1); } for (const c of Z.cars.filter((c) => c.dropped)) Z.cars.splice(Z.cars.indexOf(c), 1); mine = { traffic: new Set(), cars: new Set(), peds: new Set() }; Z.traffic.length = 0; Z.peds.length = 0; V.spills.length = 0; V.log.length = 0; heard.length = 0; api._kick = 0; me.fall = 0; me.kvx = me.kvy = 0; for (const k in keys) keys[k] = false; }
function names(from) { return [...new Set(heard.filter((h) => h.t >= (from || 0)).map((h) => h.n))]; }
const METAL_OLD = ["crash_light", "crash_metal", "metal", "metal_heavy"];
function head(o) { return { x: +o.x.toFixed(2), y: +o.y.toFixed(2), a: +(o.a || 0).toFixed(3) }; }

try {
  run(.5);
  const open = clearSpot(24);
  // 1. car into a parked car, head on, about 12 m/s
  { reset(); const a = ride(park("car", open.x, open.y, 0)), b = park("car", open.x + 11, open.y, 0), b0 = head(b); a.vx = 12; const t0 = api.t; let minGap = 9, peakImp = 0;
    run(1.2, () => { keys.up = true; minGap = Math.min(minGap, gap(a, b)); });
    keys.up = false; run(1); const imp = V.log.find((e) => e.kind === "parked"); peakImp = imp ? imp.imp : 0;
    out.cases.carCar = { gap: gap(a, b), minGap, pushedX: +(b.x - b0.x).toFixed(2), names: names(t0), imp: peakImp, kick: api._kick, speedAfter: +Math.hypot(a.vx, a.vy).toFixed(2) };
    // and away again: reverse out
    keys.down = true; run(1.5); keys.down = false; out.cases.carCar.reversed = +(open.x + 11 - b.x + (b.x - a.x)).toFixed(2); out.cases.carCar.free = gap(a, b) > .3; }
  // 2. glancing: a car brushing past the side of a parked car keeps moving and does not stick
  { reset(); const a = ride(park("car", open.x - 8, open.y + 1.2, 0)), b = park("car", open.x + 4, open.y - .6, 0); a.vx = 10;
    run(2, () => { keys.up = true; }); keys.up = false;
    out.cases.glance = { gap: gap(a, b), past: a.x > b.x + 2, speed: +Math.hypot(a.vx, a.vy).toFixed(2), spinB: +Math.abs(b.a).toFixed(3) }; }
  // 3. car into a parked bicycle: the bicycle is thrown and falls on its side; light rattle, no metal clang
  { reset(); const a = ride(park("car", open.x - 6, open.y, 0)), b = park("bike", open.x + 4, open.y + .3, Math.PI / 2), b0 = head(b); a.vx = 11; const t0 = api.t; let maxTip = 0;
    run(1.5, (i) => { keys.up = i < 60; maxTip = Math.max(maxTip, Math.abs(b.tipA || 0)); }); keys.up = false; run(2);
    out.cases.carBike = { moved: +Math.hypot(b.x - b0.x, b.y - b0.y).toFixed(2), dirX: +(b.x - b0.x).toFixed(2), tip: +Math.abs(b.tip || 0).toFixed(2), maxTip: +maxTip.toFixed(2), rest: !b.loose, gap: gap(a, b), carSpeed: +Math.hypot(a.vx, a.vy).toFixed(2), names: names(t0), inWall: inWall(b) };
    // pick it up again
    keys.down = true; run(1); keys.down = false; run(.5); Z.exit(true); me.x = b.x + 1; me.y = b.y; Z.enter(b); run(.6); out.cases.carBike.pickedUp = me.veh === b && Math.abs(b.tipA || 0) < .05; }
  // 3b. picking a fallen bike up: it rises with the hands (me.animLift from samaru-anim), not before
  { reset(); const fb = park("bike", open.x, open.y, 0, { tip: -1.45, tipA: -1.45 }); me.x = open.x + 1; me.y = open.y; Z.enter(fb); const r = {};
    me.animBusy = 1; me.animLift = undefined; run(.3, () => { me.animBusy = 1; }); r.heldDown = +Math.abs(fb.tipA).toFixed(2);
    run(.05, () => { me.animBusy = 1; me.animLift = .5; }); r.half = +Math.abs(fb.tipA).toFixed(2);
    run(.05, () => { me.animBusy = 1; me.animLift = 1; }); r.up = +Math.abs(fb.tipA || 0).toFixed(3); me.animBusy = 0; me.animLift = undefined;
    const fb2 = park("bike", open.x + 5, open.y, 0, { tip: 1.45, tipA: 1.45 }); Z.exit(true); me.x = fb2.x + 1; me.y = fb2.y; Z.enter(fb2); run(.6); r.noAnimUp = +Math.abs(fb2.tipA || 0).toFixed(3);
    out.cases.lift = r; }
  // 4. car into a parked okada (lighter metal + plastic) and a skateboard
  for (const ty of ["okada", "skate"]) { reset(); const a = ride(park("car", open.x - 6, open.y, 0)), b = park(ty, open.x + 4, open.y, Math.PI / 2); a.vx = 10; const t0 = api.t; run(1.2, (i) => { keys.up = i < 50; }); keys.up = false; run(1);
    out.cases["car_" + ty] = { names: names(t0), moved: +(b.x - open.x - 4).toFixed(2), gap: gap(a, b), tip: +Math.abs(b.tip || 0).toFixed(2) }; }
  // 5. you on a bicycle, into the side of a car: thrown off, you fall and get up, the bicycle goes down
  { reset(); const car = park("car", open.x + 6, open.y, Math.PI / 2), bk = ride(park("bike", open.x - 4, open.y, 0)); bk.vx = 8.5; const t0 = api.t; let fell = 0;
    run(1.2, () => { keys.up = true; if (me.fall > 0) fell = Math.max(fell, me.fall); }); keys.up = false;
    out.cases.bikeIntoCar = { thrown: !me.veh, fell: +fell.toFixed(2), bikeTip: +Math.abs(bk.tip || 0).toFixed(2), names: names(t0), carMoved: +Math.hypot(car.x - open.x - 6, car.y - open.y).toFixed(3), gapBikeCar: gap(bk, car), meInCar: gap({ x: me.x, y: me.y, a: 0, ped: 1 }, car) < -.05, hp: Z.P.hp > 0 };
    run(4); out.cases.bikeIntoCar.upAgain = !me.fall; }
  // 6. traffic: a car rear-ends an okada → the rider comes off, gets up and rides on; a bus is heavy
  const road = roadSpot();
  { reset(); const t = traffic("okada", road, 14); t.sp = 0; t.v = 0; me.x = road.x; me.y = road.y; const a = ride(park("car", t.x - Math.cos(t.a) * 12, t.y - Math.sin(t.a) * 12, t.a)); a.vx = Math.cos(t.a) * 11; a.vy = Math.sin(t.a) * 11; const t0 = api.t;
    let spilled = null, riderDown = 0; run(1.2, (i) => { keys.up = i < 40; if (!spilled && V.spills.length) spilled = V.spills[0]; if (spilled && spilled.p.fall > 0) riderDown = 1; });
    keys.up = false; keys.down = true; run(1.5); keys.down = false; Z.exit(true); me.x = a.x - Math.cos(t.a) * 20; me.y = a.y - Math.sin(t.a) * 20; // step well back and watch
    const dropped = spilled && spilled.c; let rode = false; run(14, () => { if (spilled && !Z.peds.includes(spilled.p) && Z.traffic.some((q) => q.remount && q.type === "okada")) rode = true; });
    out.cases.carOkadaTraffic = { spilled: !!spilled, riderDown: !!riderDown, bikeTipped: dropped ? Math.abs(dropped.tip || 0) > 1 : false, names: names(t0), rodeOn: rode }; }
  { reset(); const t = traffic("car", road, 14, "bus"); t.sp = 0; t.v = 0; const a = ride(park("car", t.x - Math.cos(t.a) * 12, t.y - Math.sin(t.a) * 12, t.a)); a.vx = Math.cos(t.a) * 12; a.vy = Math.sin(t.a) * 12; const t0 = api.t, b0 = head(t);
    let minGap = 9; run(1.2, (i) => { keys.up = i < 30; if (Z.traffic.includes(t)) minGap = Math.min(minGap, gap(a, t)); }); keys.up = false; const stunned = t.stun > 0 || t.honk === 0;
    run(2.5); out.cases.carBus = { names: names(t0), busMoved: +Math.hypot(t.x - b0.x, t.y - b0.y).toFixed(2), carBounce: +Math.hypot(a.vx, a.vy).toFixed(2), gap: gap(a, t), minGap, stunned, honked: heard.some((h) => h.n === "horn_bus" && h.t > t0) }; }
  { reset(); const t = traffic("car", road, 14); t.sp = 0; t.v = 0; const a = ride(park("car", t.x - Math.cos(t.a) * 12, t.y - Math.sin(t.a) * 12, t.a)); a.vx = Math.cos(t.a) * 12; a.vy = Math.sin(t.a) * 12; const t0 = api.t, b0 = head(t);
    run(1.2, (i) => { keys.up = i < 30; }); keys.up = false; keys.down = true; run(.8); keys.down = false; run(2.5);
    out.cases.carTraffic = { names: names(t0), shoved: +(((t.x - b0.x) * Math.cos(b0.a) + (t.y - b0.y) * Math.sin(b0.a))).toFixed(2), gap: gap(a, t), honked: heard.some((h) => /^horn_/.test(h.n) && h.t > t0) }; }
  // 7. walls: square on stops you with a jolt; at a shallow angle you slide along; never inside
  { reset(); const b = Z.W.b.find((q) => { const cx = (q.x0 + q.x1) / 2; return q.x1 - q.x0 > 14 && q.y1 - q.y0 > 14 && !S.push(Z.W, q.x0 - 9, (q.y0 + q.y1) / 2, 4).hit && !S.inWater(Z.W, q.x0 - 9, (q.y0 + q.y1) / 2) && cx; });
    const y = (b.y0 + b.y1) / 2, x = b.x0 - 10; const a = ride(park("car", x, y, 0)); a.vx = 15; const t0 = api.t; let maxIn = 0;
    run(1.5, () => { keys.up = true; maxIn = Math.max(maxIn, inWall(a)); }); keys.up = false; const sp = Math.hypot(a.vx, a.vy);
    out.cases.carWall = { names: names(t0), maxIn, speedAfter: +sp.toFixed(2), kick: api._kick, imp: (V.log.find((e) => e.kind === "wall") || {}).imp || 0 };
    keys.down = true; run(1.2); keys.down = false; out.cases.carWall.backedOff = a.x < b.x0 - 3;
    // glancing, 25 degrees into the same wall: keeps going along it
    reset(); const GA = Math.PI / 2 - .42, g = ride(park("car", b.x0 - 4.5, y - 8, GA)); g.vx = Math.cos(GA) * 14; g.vy = Math.sin(GA) * 14; const g0 = api.t; let gIn = 0;
    run(1.2, () => { keys.up = true; gIn = Math.max(gIn, inWall(g)); }); keys.up = false;
    out.cases.glanceWall = { maxIn: gIn, speed: +Math.hypot(g.vx, g.vy).toFixed(2), along: +(g.y - (y - 8)).toFixed(2), names: names(g0) };
    // a bicycle and a skateboard into the wall: their own sounds, no metal
    for (const ty of ["bike", "skate", "okada"]) { reset(); const k = ride(park(ty, x + 2, y, 0)); k.vx = 6.5; const k0 = api.t, mx = { v: 0 }; run(1.5, () => { keys.up = true; mx.v = Math.max(mx.v, inWall(k)); }); keys.up = false; out.cases[ty + "Wall"] = { names: names(k0), maxIn: mx.v, riding: me.veh === k }; } }
  // 8. walkers: a slow nudge makes them stumble aside; fast, they go down (and get up)
  { reset(); const a = ride(park("car", open.x - 5, open.y, 0)); const p = { w: null, x: open.x + 1, y: open.y + .2, a: 0, spd: 0, look: { skin: "#8d5524" }, sp: 0, side: 0, walk: 0, fall: 0, wave: 0, flee: 0, k: 0 }; const nr = S.nearRoad(Z.W, p.x, p.y, 80); p.w = S.wanderStart(Z.W, S.rng(3), { x: nr.x, y: nr.y, r: nr.r }, false); p.w.x = p.x; p.w.y = p.y; Z.peds.push(p); mine.peds.add(p);
    a.vx = 2.5; const t0 = api.t; let minGap = 9; run(2, (i) => { keys.up = false; a.vx = Math.max(a.vx, i < 120 ? 2.5 : 0); minGap = Math.min(minGap, gap(a, { x: p.x, y: p.y, a: 0, ped: 1 })); });
    out.cases.pedSlow = { names: names(t0), fell: p.fall > 0 || !!p.wasDown, minGap, moved: +Math.hypot(p.x - open.x - 1, p.y - open.y - .2).toFixed(2) };
    reset(); const a2 = ride(park("car", open.x - 8, open.y, 0)); const q = Object.assign({}, p, { x: open.x - 8 + 4.2, y: open.y, fall: 0, wasDown: 0, kx: 0, ky: 0, kv: 0, st: "" }); q.w = Object.assign({}, p.w); Z.peds.push(q); mine.peds.add(q); a2.vx = 9; const t1 = api.t; let down = 0;
    run(1, () => { keys.up = true; if (q.fall > 0) down = 1; }); keys.up = false; run(6);
    out.cases.pedFast = { names: names(t1), down: !!down, upAgain: !(q.fall > 0) && !(q.getUpT > 0) }; }
  // 9. plants: a hedge bends away and springs back, with leaves and a rustle; a big trunk is solid (crash code)
  { reset(); const mk16 = (x, y) => { const a = new Float32Array(16); a[0] = 3; a[5] = 1; a[10] = 1; a[15] = 1; a[12] = x; a[13] = .5; a[14] = y; return a; };
    const hm = { instanceMatrix: { array: mk16(open.x + 3, open.y), needsUpdate: false } }, grp = { userData: {} }, hedge = { k: "hedge", x: open.x + 3, y: open.y, a: Math.PI / 2, half: 1.5, r: .5, h: 1, parts: [{ m: hm, i: 0 }] };
    const trunk = { k: "trunk", x: open.x + 3, y: open.y + 14, r: .36, h: 8, parts: [] }; V.plants(null, grp, [hedge, trunk]);
    const a = ride(park("car", open.x - 4, open.y, 0)); a.vx = 8; const t0 = api.t; let maxB = 0, topX = 0;
    run(1.5, (i) => { keys.up = i < 40; maxB = Math.max(maxB, hedge.b); topX = Math.max(topX, hm.instanceMatrix.array[4]); });
    keys.up = false; run(2.5); const back = Math.abs(hedge.b) < .01 && Math.abs(hm.instanceMatrix.array[12] - (open.x + 3)) < 1e-3;
    out.cases.hedge = { maxBend: +maxB.toFixed(3), leanedForward: topX > .05, back, names: names(t0), through: a.x > open.x + 4.5, plants: V.plantCount() };
    reset(); const c = ride(park("car", open.x + 3, open.y + 6, Math.PI / 2)); c.vy = 11; const t1 = api.t; let worst = 9;
    run(1.5, () => { keys.up = true; worst = Math.min(worst, Math.hypot(c.x - trunk.x, c.y - trunk.y) - .36 - V.dims(c).wid / 2); }); keys.up = false;
    out.cases.trunk = { names: names(t1), worstGap: +worst.toFixed(3), stoppedBefore: c.y < trunk.y };
    V.unplant(grp); out.cases.hedge.unplanted = V.plantCount() === 0; }
  // 10. the horn: walkers ahead look round and step aside; traffic ahead gives way
  { reset(); const a = ride(park("car", open.x - 6, open.y, 0)); const mkp = (x, y) => { const p = { w: null, x, y, a: Math.PI / 2, spd: 0, look: { skin: "#8d5524" }, sp: 0, side: 0, walk: 0, fall: 0, wave: 0, flee: 0, k: 0 }; const nr = S.nearRoad(Z.W, x, y, 80); p.w = S.wanderStart(Z.W, S.rng(4), { x: nr.x, y: nr.y, r: nr.r }, false); p.w.x = x; p.w.y = y; Z.peds.push(p); mine.peds.add(p); return p; };
    const p1 = mkp(open.x + 3, open.y + .5), p2 = mkp(open.x + 6, open.y - 1), far = mkp(open.x - 20, open.y); const y1 = p1.y, y2 = p2.y, a1 = p1.a; let looked = 0;
    pressed.horn = true; run(1.5, (i) => { if (i === 20 && Math.abs(S.angDiff(p1.a, a1)) > .3) looked = 1; });
    out.cases.horn = { reacted: V.log.filter((e) => e.kind === "horn").map((e) => e.imp)[0], looked: !!looked, aside1: +Math.abs(p1.y - y1).toFixed(2), aside2: +Math.abs(p2.y - y2).toFixed(2), farMoved: +Math.hypot(far.x - open.x + 20, far.y - open.y).toFixed(2), down: p1.fall > 0 || p2.fall > 0 }; }
  { reset(); const t = traffic("car", road, 14); t.sp = 8; t.v = 8; const a = ride(park("car", t.x - Math.cos(t.a) * 9, t.y - Math.sin(t.a) * 9, t.a)); a.vx = Math.cos(t.a) * 8; a.vy = Math.sin(t.a) * 8; pressed.horn = true; let vmin = 9; run(1.5, () => { vmin = Math.min(vmin, t.v); }); out.cases.hornTraffic = { slowed: +vmin.toFixed(2), yield: t.yieldT != null }; }
  // 11. friends ride along: they walk to a free seat and get in; on a bicycle they follow on foot; a paid ride takes them too
  { for (let i = Z.npcs.length - 1; i >= 0; i--) if (/^amb_/.test(Z.npcs[i].id)) Z.npcs.splice(i, 1); if (Z.story && Z.story.stopAmbient) Z.story.stopAmbient(); // story walk-ons would take seats too
    global.__noAmb = true;
    const pals = Z.npcs.filter((n) => n.def && !n.hidden).slice(0, 3); const keep = new Set(pals);
    const join = (n, x, y) => { Z.npcs.forEach((o) => { if (!keep.has(o)) { o.follow = false; o.rideV = null; o.seatI = null; o.riding = false; } }); n.x = x; n.y = y; n.follow = true; n.ft = 9999; n.lead = null; n.riding = false; n.rideV = null; n.seatAnc = null; n.rt = null; };
    const fr = {};
    { reset(); const car = ride(park("car", open.x, open.y, 0)); join(pals[0], open.x - 9, open.y + 6); let maxStep = 0, px = pals[0].x, py = pals[0].y, boarded = -1;
      run(8, (i) => { car.vx = car.vy = 0; const n = pals[0]; if (!n.rideV) maxStep = Math.max(maxStep, Math.hypot(n.x - px, n.y - py)); else if (boarded < 0) boarded = i / 120; px = n.x; py = n.y; });
      fr.car = { boarded: +boarded.toFixed(2), seat: pals[0].seatI, anc: !!pals[0].seatAnc, visible: !pals[0].hidden, maxStep: +maxStep.toFixed(3) };
      Z.exit(true); run(1); fr.car.offAfterExit = !pals[0].rideV && !pals[0].riding && Math.hypot(pals[0].x - me.x, pals[0].y - me.y) < 6; }
    { reset(); const ok = ride(park("okada", open.x, open.y, 0)); join(pals[0], open.x - 3, open.y + 2); join(pals[1], open.x - 3, open.y - 2); join(pals[2], open.x - 4, open.y);
      run(6, () => { ok.vx = ok.vy = 0; }); fr.okada = { riders: pals.filter((n) => n.rideV === ok).length, seats: pals.filter((n) => n.rideV === ok).map((n) => n.seatI).sort(), third: pals[2].rideV ? "riding" : "on foot", loadK: +(ok.loadK || 1).toFixed(2), mass: V.mass(ok) };
      keys.up = true; run(2); keys.up = false; fr.okada.stillOn = pals.filter((n) => n.rideV === ok).length; Z.exit(true); run(.5); }
    { reset(); const kk = ride(park("keke", open.x, open.y, 0)); pals.forEach((n, i) => join(n, open.x - 3 - i, open.y + 3)); run(7, () => { kk.vx = kk.vy = 0; }); fr.keke = { riders: pals.filter((n) => n.rideV === kk).length, seats: pals.map((n) => n.seatI) }; Z.exit(true); run(.5); }
    { reset(); const bk = ride(park("bike", open.x, open.y, 0)); join(pals[0], open.x - 3, open.y + 1); let maxGap = 0, onBike = 0; run(10, (i) => { keys.up = i < 300; if (pals[0].rideV) onBike = 1; maxGap = Math.max(maxGap, Math.hypot(pals[0].x - me.x, pals[0].y - me.y)); });
      keys.up = false; run(4); fr.bike = { boarded: !!onBike, ownBike: !!pals[0].onBike, gapEnd: +Math.hypot(pals[0].x - me.x, pals[0].y - me.y).toFixed(1), maxGap: +maxGap.toFixed(1) }; }
    { reset(); Z.exit(true); const stops = Z.travel.stops(); const from = stops[0]; me.x = from.mx; me.y = from.my; join(pals[0], from.mx + 2, from.my + 1); pals[1].follow = pals[2].follow = false; run(.3); const m0 = Z.P.money; const go = Z.travel.go(stops[stops.length - 1].id, { mode: "ride" }); let rode = 0;
      run(3, () => { if (pals[0].rideV && pals[0].rideV.shuttle) rode = 1; }); const paid = m0 - Z.P.money, one = Z.travel.fare(Z.travel.path(from.mx, from.my, stops[stops.length - 1].mx, stops[stops.length - 1].my).len, false);
      fr.shuttle = { started: go, rode: !!rode, paid, one, seat: pals[0].seatI }; if (me.veh) Z.exit(true); run(1); fr.shuttle.off = !pals[0].rideV; }
    pals.forEach((n) => { n.follow = false; n.rideV = null; n.seatAnc = null; }); out.cases.friends = fr; }
  // 12. traffic loads
  { reset(); me.x = road.x; me.y = road.y; const t1 = traffic("keke", road, 30), t2 = traffic("okada", road, 50); run(.1); out.cases.loads = { keke: t1.pax, okada: t2.pax, kekeMax: V.seats(t1).length, okadaMax: V.seats(t2).length }; }
  // 13. sound table and registration
  out.sounds = { table: {
      car_car: V.sounds("car", "car", 8, 0).map((q) => q.n), car_car_soft: V.sounds("car", "car", 2, 0).map((q) => q.n), car_bus: V.sounds("car", "bus", 9, 0).map((q) => q.n),
      car_bicycle: V.sounds("car", "bicycle", 9, 0).map((q) => q.n), bicycle_wall: V.sounds("bicycle", "wall", 7, 0).map((q) => q.n), skate_wall: V.sounds("skate", "wall", 5, 0).map((q) => q.n),
      moto_car: V.sounds("moto", "car", 7, 0).map((q) => q.n), car_wall: V.sounds("car", "wall", 9, 0).map((q) => q.n), car_pole: V.sounds("car", "pole", 6, 0).map((q) => q.n),
      car_ped: V.sounds("car", "ped", 6, 0).map((q) => q.n), car_scrape: V.sounds("car", "wall", 2, 8).map((q) => q.n), hard: V.sounds("car", "car", 18, 0).map((q) => q.n) },
    registered: api._reg || [], leanOrder: /g\.rotation\.order = "YXZ"/.test(fs.readFileSync(path.join(dir, "samaru-veh.js"), "utf8")) };
  out.metalOld = METAL_OLD;
} catch (e) { out.ok = false; out.error = String(e && e.stack || e); }
console.log(JSON.stringify(out));
