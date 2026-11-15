/* Headless checks for Signal Surfer, Maglev Rescue and Drive Room: physics against known values, every level solved
 * by the reference engineer, endless modes that get harder, and each game's menu → level → ceremony → report wiring
 * with a stub runtime. Prints one JSON line. Usage: node lab_harness.js <static/js/games> */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const dir = path.resolve(process.argv[2]);
const Sg = require(path.join(dir, "signalsim.js")), Mg = require(path.join(dir, "maglevsim.js")), D = require(path.join(dir, "drivesim.js"));
const out = {};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

/* ---------- Signal Surfer physics ---------- */
{
  const r = {};
  r.erfc0 = near(Sg.erfc(0), 1, 1e-6);
  r.erfc1 = near(Sg.erfc(1), 0.157299, 1e-5);
  r.ber96 = Sg.ber(Sg.undb(9.6));                                   // textbook ≈ 1e-5
  r.berZero = Sg.ber(0) === 0.5;
  r.pg1km = Sg.db(Sg.pathGain(1000, 2.4e9));                       // ≈ −100 dB
  r.pgDistance = near(Sg.db(Sg.pathGain(2000, 1e9)) - Sg.db(Sg.pathGain(1000, 1e9)), -6.02, 0.01);
  let shannonOk = true, floorOk = true;
  const L0 = Sg.LEVELS[24];
  for (const f of [0.5e9, 1e9, 2e9, 4e9]) for (const rb of Sg.RATES) for (const pt of [1e-3, 1e-2, 0.1, 0.5]) {
    const k = Sg.link(L0, { pt, f, rb }, 3.3); if (k.goodput > k.capacity * 1.0001 + 1) shannonOk = false;
    if (Sg.noisePSD(L0, f, 3.3) < Sg.KT0 * Sg.undb(L0.nf) * 0.999) floorOk = false;
  }
  r.shannon = shannonOk; r.floor = floorOk;
  r.levels = Sg.LEVELS.length;
  r.solved = Sg.LEVELS.map((L) => Sg.botRun(L, 0.1).win);
  r.endless = []; for (let k = 0; k < 10; k++) r.endless.push(Sg.botRun(Sg.endlessLevel(k), 0.1).win);
  r.harder = Sg.endlessLevel(9).jams.length > Sg.endlessLevel(0).jams.length && Sg.endlessLevel(9).msg > Sg.endlessLevel(0).msg;
  r.teach = Sg.LEVELS.every((L) => L.teach && L.teach.length > 30);
  out.surfer = r;
}
/* ---------- Maglev physics ---------- */
{
  const r = {};
  r.balance = near(Mg.force(Mg.I0, Mg.G0), Mg.M0 * Mg.GRAV, 1e-6);
  r.K = near(Mg.K, Mg.MU0 * Mg.N * Mg.N * Mg.AREA / 4, 1e-12);
  const l = Mg.lin(Mg.M0, Mg.G0); r.kpMin = l.a / l.b / 1000;     // ≈ I0/g0 in A/mm
  r.kpMinIsI0g0 = near(r.kpMin, Mg.I0 / Mg.G0 / 1000, 1e-9);
  // unstable without control: hold I0 fixed, nudge the gap 0.1 mm closer, the pod is pulled into the rail
  let g = Mg.G0 - 1e-4, v = 0; for (let i = 0; i < 2000 && g > 0.001; i++) { v += (Mg.GRAV - Mg.force(Mg.I0, g) / Mg.M0) * 1e-4; g += v * 1e-4; }
  r.openLoopUnstable = g <= 0.001;
  r.weakKpFails = !Mg.stepTest({ kp: r.kpMin * 0.8, kd: 40, ki: 0 }).stable;
  r.noDampingFails = !Mg.stepTest({ kp: 3, kd: 0, ki: 0 }).stable;
  r.designStable = Mg.stepTest(Mg.design(70, 0.75, false)).stable;
  r.levels = Mg.LEVELS.length;
  r.solved = Mg.LEVELS.map((L) => Mg.botRun(L).win);
  r.endless = []; for (let k = 0; k < 10; k++) r.endless.push(Mg.botRun(Mg.endlessLevel(k)).win);
  r.harder = Mg.endlessLevel(9).track.rail.length > Mg.endlessLevel(0).track.rail.length;
  // integral action removes the sag from a payload: PD alone leaves a steady error, PID does not
  const heavy = { id: 0, track: { len: 60, v: 4, rail: [], load: [{ x: 5, kg: 8 }], gust: [] }, noise: 0, imax: 60, vmax: 150, spec: 0.003 };
  const pd = Mg.start(heavy, Mg.design(70, 0.75, false), 10), pid = Mg.start(heavy, Mg.design(70, 0.75, true), 10);
  while (!pd.done) Mg.step(pd, 1 / 60); while (!pid.done) Mg.step(pid, 1 / 60);
  r.sagPD = Math.abs(pd.hist[pd.hist.length - 1][1] - 10); r.sagPID = Math.abs(pid.hist[pid.hist.length - 1][1] - 10);
  r.teach = Mg.LEVELS.every((L) => L.teach && L.teach.length > 30);
  out.maglev = r;
}
/* ---------- Drive Room physics ---------- */
{
  const r = {}, s = { vs: 230, vll: 415, vdc: 300 };
  r.v1 = near(D.BYCONV.f1.vmax(s), 0.9003 * 230, 0.1);              // (2√2/π)·Vs
  r.v3 = near(D.BYCONV.f3.vmax(s), 1.3505 * 415, 0.2);              // (3√2/π)·VLL
  r.quadsOK = D.BYCONV.f3.quads.join() === "1,4" && D.BYCONV.c1a.quads.join() === "1" && D.BYCONV.c2q.quads.join() === "1,2" && D.BYCONV.dual.quads.length === 4;
  r.hoistDown = D.quadrants(D.LEVELS[10]).join();                  // "Hoist down" needs I and IV
  r.reverse = D.quadrants(D.LEVELS[14]).indexOf(3) >= 0;
  // steady state without load: Va = Kφ·ω + Ra·Ia with Ia ≈ B·ω/Kφ
  const M = D.MOTORS.small, flat = { id: 0, motor: "small", supply: { vdc: 300 }, supplies: ["dc"], budget: 9999, kind: "conveyor", t0: 0, profile: [[0, 100], [3, 100]], time: 3, tol: 50 };
  const S0 = D.start(flat, { conv: "c1a", kp: 2, ki: 20, ilim: 40, fw: false }); S0.w = 100; while (!S0.done) D.step(S0, 0.02);
  r.steady = near(S0.va, M.Kphi * S0.w + M.Ra * S0.ia, 1.5) && near(S0.w, 100, 1);
  // a class-A chopper cannot brake: the fast slow-down level tracks far worse than with a two-quadrant chopper
  const L6 = D.LEVELS[5], a = D.start(L6, Object.assign(D.botSet(L6), { conv: "c1a" })), c = D.start(L6, Object.assign(D.botSet(L6), { conv: "c2q" }));
  while (!a.done) D.step(a, 0.02); while (!c.done) D.step(c, 0.02);
  r.brakeLesson = D.rmsPct(a) > D.rmsPct(c) * 2 && c.win && c.eout > 0;
  r.levels = D.LEVELS.length;
  r.solved = D.LEVELS.map((L) => D.botRun(L).win);
  r.endless = []; for (let k = 0; k < 30; k++) r.endless.push(D.botRun(D.endlessLevel(k)).win);
  r.harder = D.endlessLevel(29).tol < D.endlessLevel(0).tol;
  r.teach = D.LEVELS.every((L) => L.teach && L.teach.length > 30);
  out.drive = r;
}
/* ---------- game wiring with a stub runtime ---------- */
function play(file, deps, exportName, drive) {
  const log = { reports: [], ceremonies: [], shows: 0, settings: [], errors: [] };
  let game = null, onAct = null, overlay = false;
  const store = {};
  const api = {
    t: 0, reduce: true, x: new Proxy({}, { get: (o, k) => k === "createLinearGradient" || k === "createRadialGradient" ? () => ({ addColorStop() {} }) : k === "measureText" ? () => ({ width: 40 }) : () => {}, set: () => true }),
    hit: (id) => api._hit === id, down: () => false, useActions() {}, music() {}, banner() {}, burst() {}, confetti() {}, kick() {}, flash() {}, buzz() {}, hitstop() {}, slowmo() {}, zoom() {},
    sound: { sfx() {}, say() {}, roar() {} }, panel() {}, overlayOpen: () => overlay,
    show(html, on) { log.shows++; overlay = true; onAct = on; log.last = html; }, hide() { overlay = false; },
    ceremony(kind, o) { log.ceremonies.push(kind); if (o && o.then) { overlay = false; o.then(); } },
    cheats(map) { log.cheatMap = map; return api; }, secret() { return api; },
    hero: { active: false, inUse: false, use(on) { api.hero.inUse = !!on; return on; } },
    settings: { add(o) { log.settings.push(o.id); if (o.apply) o.apply(o.default); }, get: () => undefined }
  };
  const A = { store: (k, v) => (v === undefined ? store[k] : (store[k] = v)), song: () => ({}), run: (g) => { game = g; }, report: (slug, p) => log.reports.push([slug, p]), cast: [{ coat: "#123" }], byId: {},
    styled: (c) => c, drawHead() {}, esc: (s) => String(s) };
  const ctx = { window: {}, globalThis: null, console, Math, JSON, Object, Array, String, Number, Proxy, document: undefined };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.window.Arcade = A; vm.createContext(ctx);
  for (const f of deps.concat([file])) vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), ctx, { filename: f });
  game.init(api);
  const act = (a, attrs) => { const el = { getAttribute: (n) => (attrs || {})[n] }; const on = onAct; on(a, el); };
  drive(api, act, game, ctx[exportName], log);
  return log;
}
function runLevel(api, game, done, maxSteps) { let n = 0; while (!done() && n < maxSteps) { game.update(1 / 120, api); if (n % 60 === 0) game.draw(api); api.t += 1 / 120; n++; } return n; }
try {
  out.surferGame = play("surfer.js", ["labkit.js", "signalsim.js"], "SignalSurfer", (api, act, game, G, log) => {
    act("lv", { "data-k": "0" }); act("go");                         // brief → transmit
    log.cheatMap.engineer.run(api);                                    // let the auto-engineer fly it
    runLevel(api, game, () => !G.R || G.R.done || log.ceremonies.length > 0, 120 * 40);
    log.firstWin = log.ceremonies[0]; log.cleared = G.save.cleared;
    act("retry"); act("go"); G.R.cfg.pt = 1e-4; G.R.cfg.rb = 8e6;      // starve the link: it must fail
    runLevel(api, game, () => log.ceremonies.length > 1, 120 * 40);
    log.loss = log.ceremonies[1];
  });
  out.maglevGame = play("maglev.js", ["labkit.js", "maglevsim.js"], "MaglevRescue", (api, act, game, G, log) => {
    G.save.gains = Mg.design(70, 0.75, true);
    act("lv", { "data-k": "0" }); act("go");
    runLevel(api, game, () => log.ceremonies.length > 0, 120 * 60);
    log.firstWin = log.ceremonies[0]; log.cleared = G.save.cleared;
    G.save.gains = { kp: 0.5, kd: 5, ki: 0 };                        // below the stability limit: the pod must fall or strike
    act("retry"); act("go");
    runLevel(api, game, () => log.ceremonies.length > 1, 120 * 60);
    log.loss = log.ceremonies[1];
  });
  out.driveGame = play("driveroom.js", ["labkit.js", "drivesim.js"], "DriveRoom", (api, act, game, G, log) => {
    act("lv", { "data-k": "0" }); log.cheatMap.auto.run(api); act("go");
    log.cheatMap.auto.run(api);
    runLevel(api, game, () => log.ceremonies.length > 0, 120 * 30);
    log.firstWin = log.ceremonies[0]; log.cleared = G.save.cleared;
    act("retry"); act("go"); G.S.set.kp = 0.001; G.S.set.ki = 0;      // a speed loop that barely acts: off profile
    runLevel(api, game, () => log.ceremonies.length > 1, 120 * 30);
    log.loss = log.ceremonies[1];
  });
} catch (e) { out.error = String(e && e.stack || e); }
for (const k of ["surferGame", "maglevGame", "driveGame"]) if (out[k]) { delete out[k].last; delete out[k].cheatMap; }
console.log(JSON.stringify(out));
