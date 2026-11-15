/* Headless checks for Motorworks Trails, Gridkeepers: Storm Map and Algorithm Garage: the physics and rules against
 * hand-worked values, every level solved by its reference answer, the endless modes, and each game's
 * menu → level → ceremony → report wiring with a stub runtime. Prints one JSON line.
 * Usage: node rm2_harness.js <static/js/games> */
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm");
const dir = path.resolve(process.argv[2]);
const M = require(path.join(dir, "motorsim.js")), G = require(path.join(dir, "gridsim.js")), R = require(path.join(dir, "garagesim.js"));
const out = {}, near = (a, b, tol) => Math.abs(a - b) <= tol;
function play(job, sched, secs) { const b = M.bench(job); let si = 0; for (let i = 0; i < 120 * secs && !b.done && !b.failed; i++) { while (si < sched.length && b.t >= sched[si][0]) { Object.assign(b.k, sched[si][1]); si++; } M.step(b, 1 / 120); } return b; }
function free(job, knobs, secs) { const j = Object.assign({}, job, { goal: { rpm: [1e9, 1e9] } }); return play(j, [[0, knobs]], secs || 12); }

/* ---------- Motorworks: DC machine relations ---------- */
{
  const r = {}, J = (id) => M.JOBS.find((j) => j.id === id);
  // steady state obeys Va = E + Ia·Ra, E = kφ·ω, T = kφ·Ia, and T balances the load
  const b = free(J("h1c"), { Va: 220 });
  r.kvl = near(b.a.Va, b.E + b.Ia * b.m.Ra, 1e-6);
  r.emf = near(b.E, b.kp * b.w, 1e-6);
  r.torque = near(b.T, b.kp * b.Ia, 1e-9) && near(b.T, 13 + b.m.B * b.w, .05);
  // no-load speed ≈ Va / kφ; half the voltage ≈ half the speed
  const n1 = free(J("h1a"), { Va: 220 }), n2 = free(J("h1a"), { Va: 110 });
  r.noLoad = near(n1.w, 220 / n1.kp, 220 / n1.kp * .02);
  r.halfVolts = near(M.rpm(n2) / M.rpm(n1), .5, .03);
  // field weakening: lower If → smaller kφ → faster, and more current for the same torque
  const s1 = free(J("h2a"), { Va: 220, If: 1 }), s2 = free(J("h2a"), { Va: 220, If: .6 });
  r.fieldWeakening = M.rpm(s2) > M.rpm(s1) * 1.2 && Math.abs(s2.Ia) > Math.abs(s1.Ia) * 1.2;
  // saturation: doubling the field current does not double kφ
  r.saturation = M.kphi(M.MACH.sep, 2, 0) < 2 * M.kphi(M.MACH.sep, 1, 0) * .8;
  // series motor: light load → much faster than heavy load (and it runs away unloaded)
  const l1 = free(J("h3b"), { Va: 200 }), l2 = free(Object.assign({}, J("h3b"), { load: { kind: "const", T: 25 } }), { Va: 200 });
  r.seriesCharacteristic = M.rpm(l1) > M.rpm(l2) * 1.4;
  const run = play(Object.assign({}, J("h3b"), { load: { kind: "none" }, goal: { rpm: [1e9, 1e9] } }), [[0, { Va: 220 }]], 20);
  r.seriesRunaway = run.failed === "runaway";
  // generator: Vt = E − Ia·Ra and Ia = E/(Ra + RL)
  const g = free(J("h4b"), { Pm: 1500, If: .98, RL: 40 });
  r.generator = near(g.Vt, g.E - g.Ia * g.m.Ra, 1e-6) && near(g.Ia, g.E / (g.m.Ra + 40), 1e-6);
  // starting straight on the line (no starter) trips the breaker; the stepped starter does not
  const dol = play(J("h1d"), [[0, { on: 1, Rst: 0 }]], 6);
  r.directOnLineTrips = dol.trip === true;
  // a small braking resistor trips on the hardest stop
  r.brakeTooHard = play(J("h5b"), [[0, { Rb: 1, brake: 1 }]], 6).failed !== "";
  // every bay is done by its reference setting, inside its time, without a trip
  r.bays = M.JOBS.length; r.halls = new Set(M.JOBS.map((j) => j.hall)).size;
  r.solved = M.JOBS.map((j) => { const b2 = play(j, j.stepped || [[0, j.solve]], 40); return b2.done && !b2.trip ? M.stars(b2) : 0; });
  r.ideas = M.JOBS.every((j) => j.idea && j.idea.length > 40);
  // the night shift: every round is a job the reference approach can attempt, and it gets tighter
  const n0 = M.nightJob(0, 5), n9 = M.nightJob(9, 5); r.nightTighter = (n9.par <= n0.par);
  out.motor = r;
}
/* ---------- Storm Map: protection, interlocks, load flow, solvability ---------- */
{
  const r = {};
  const net = G.make(0);
  // the storm left the faulted feeder's breaker open and the others closed
  const cbs = net.E.filter((e) => e.dev === "cb");
  r.tripped = cbs.some((e) => !e.closed) && cbs.some((e) => e.closed);
  const f = net.E.find((e) => e.fault === 2), cb = G.upstreamBreaker(net, f);
  // closing onto a permanent fault trips again
  const res = G.act(net, cb, "close"); r.closeOntoFaultTrips = !!res.tripped && !cb.closed;
  // earthing a live section is refused
  const liveEdge = net.E.find((e) => e.live && !e.tie); net.truck = liveEdge.a; r.earthRefused = !!G.can(net, liveEdge, "earth");
  // isolate its section, then earthing is allowed, then closing a switch that would energise it is blocked
  G.sectionBounds(net, f).forEach((b) => { if (b.closed) { net.truck = b.a; G.act(net, b, "open"); } });
  net.truck = f.b; r.isolated = G.isolated(net, f); r.earthOk = G.act(net, f, "earth").ok;
  // with every other breaker back in, no switch on the earthed section's boundary may be closed
  const bounds = G.sectionBounds(net, f); net.E.forEach((e) => { if (e.dev === "cb" && bounds.indexOf(e) < 0 && !e.closed) G.act(net, e, "close"); });
  const tries = bounds.filter((b) => !b.tie && !b.closed && (net.live[b.a] || net.live[b.b])).map((b) => { net.truck = b.a; const t = G.act(net, b, "close"); return !t.ok && t.violation === true && !b.closed; });
  r.interlock = tries.length > 0 && tries.every(Boolean) && f.earthed;
  // repair needs the earth; after repair and unearthing, re-closing restores everyone
  net.truck = f.b; f.known = true; r.repaired = G.act(net, f, "repair").ok && G.act(net, f, "unearth").ok;
  // voltage drop: every served node at or above 0.92 pu and below the 1.03 pu source
  G.recompute(net); r.voltage = Object.keys(net.served).every((n) => net.V[n] >= G.VMIN - 1e-9 && net.V[n] <= 1.03 + 1e-9);
  // two live feeders must not be joined
  const net2 = G.make(0); net2.E.forEach((e) => { e.fault = 0; if (e.dev === "cb") e.closed = true; }); G.recompute(net2);
  const tie = net2.E.find((e) => e.tie); net2.truck = tie.a; const loop = G.act(net2, tie, "close"); r.noLoops = !loop.ok && !tie.closed;
  // every campaign incident and a run of endless storms has a safe, complete restoration
  r.incidents = G.LEVELS;
  r.solved = []; for (let i = 0; i < G.LEVELS; i++) { const n = G.incident(i); r.solved.push(n.par < 1e9); }
  r.endless = []; for (let s = 1; s <= 8; s++) r.endless.push(G.incident(26 + s, s).par < 1e9);
  r.bigger = G.make(25).E.length > G.make(0).E.length * 4;
  r.lessons = G.LESSONS.length >= G.LEVELS && G.LESSONS.every((t) => t.length > 40);
  out.grid = r;
}
/* ---------- Algorithm Garage: the runner, the robot, every job ---------- */
{
  const r = {};
  r.jobs = R.JOBS.length; r.chapters = R.CHAPTERS.length;
  r.solved = R.JOBS.map((j) => [0, 1, 2, 5].every((s) => { const c = R.check(j, j.solution, s); return c.pass && R.stars(j, c) === 3; }));
  r.startersFail = R.JOBS.every((j) => !R.check(j, j.starter, 0).pass);
  const w = R.JOBS[0].make();
  r.deterministic = JSON.stringify(R.run("move(2); turnLeft()", w).trace) === JSON.stringify(R.run("move(2); turnLeft()", w).trace);
  r.wallError = /hit a wall/.test(R.run("move(20)", w).error || "");
  r.loopStopped = /too long|more than/.test(R.run("while true\n move(0)\nend", w).error || "");
  r.typo = /Unrecognized/.test(R.run("mvoe(1)", w).error || "");
  r.matlabSemantics = R.run("v = [3 1 2]; [s, k] = sort(v); disp(k(1))", w).output.trim() === "2";
  r.hiddenFloors = !R.check(R.JOBS.find((j) => j.id === "v2"), "move(1)\nmove(3)", 0).pass; // a hard-coded answer fails other floors
  r.workOrders = Array.from({ length: 12 }, (_, k) => { const o = R.workOrder(k, 9); return R.check(o.job, o.job.solution, o.seed).pass; });
  out.garage = r;
}
/* ---------- game wiring with a stub runtime ---------- */
function boot(files, exportName, drive) {
  const log = { reports: [], ceremonies: [], shows: 0, settings: [], htmls: [] };
  let game = null, onAct = null, overlay = false; const store = {};
  const api = {
    t: 0, reduce: true, x: new Proxy({}, { get: (o, k) => k === "createLinearGradient" || k === "createRadialGradient" ? () => ({ addColorStop() {} }) : k === "measureText" ? (s) => ({ width: String(s).length * 9 }) : () => {}, set: () => true }),
    hit: (id) => api._hit === id, down: () => false, useActions() {}, music() {}, banner() {}, burst() {}, confetti() {}, kick() {}, flash() {}, buzz() {}, hitstop() {}, slowmo() {}, zoom() {},
    sound: { sfx() {}, say() {}, roar() {} }, panel() {}, overlayOpen: () => overlay,
    show(html, on) { log.shows++; overlay = true; onAct = on; log.htmls.push(html.slice(0, 120)); }, hide() { overlay = false; },
    ceremony(kind, o) { log.ceremonies.push(kind); if (o && o.then) { overlay = false; o.then(); } },
    cheats(map) { log.cheatMap = map; return api; }, secret() { return api; },
    hero: { active: false, inUse: false, use(on) { api.hero.inUse = !!on; return on; } },
    settings: { add(o) { log.settings.push(o.id); if (o.apply) o.apply(o.default); }, get: () => undefined }
  };
  const A = { store: (k, v) => (v === undefined ? store[k] : (store[k] = v)), song: () => ({}), run: (g) => { game = g; }, report: (slug, p) => log.reports.push([slug, p]), esc: (s) => String(s), hash: () => "" };
  const ctx = { console, Math, JSON, Object, Array, String, Number, Proxy, Date, setTimeout: (f) => f(), document: { querySelector: () => null } };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx; ctx.Arcade = A; vm.createContext(ctx);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), ctx, { filename: f });
  game.init(api);
  const act = (a, attrs) => { const on = onAct; on(a, { getAttribute: (n) => (attrs || {})[n] }); };
  const steps = (n, done) => { for (let i = 0; i < n && !(done && done()); i++) { game.update(1 / 120, api); if (i % 30 === 0) game.draw(api); api.t += 1 / 120; } };
  drive(api, act, game, ctx[exportName], log, steps);
  delete log.cheatMap; delete log.htmls; return log;
}
try {
  out.motorGame = boot(["motorsim.js", "motorworks.js"], "Motorworks", (api, act, game, Gm, log, steps) => {
    act("go"); steps(10); const job = Gm.jobs[0]; Gm.openBay(job); act("ok");
    Object.assign(Gm.S.b.k, job.solve); steps(120 * 15, () => log.ceremonies.length > 0);
    log.win = log.ceremonies[0]; log.stars = Gm.save.stars[job.id];
    act("retry"); act("ok"); Gm.S.b.k.Va = 230; Gm.S.b.job = Object.assign({}, job, { goal: { rpm: [1e9, 1e9], within: 3, hold: 2 } }); steps(120 * 6, () => log.ceremonies.length > 1);
    log.loss = log.ceremonies[1];
  });
  out.stormGame = boot(["gridsim.js", "stormmap.js"], "StormMap", (api, act, game, Gs, log, steps) => {
    Gs.start(0); act("ok"); steps(5); log.cheatMap.skip.run(api); steps(5);
    log.win = log.ceremonies[0]; log.stars = Gs.save.stars[0];
    Gs.start(1); act("ok"); Gs.S.net.violations = 3; steps(5); log.loss = log.ceremonies[1];
  });
  out.garageGame = boot(["../matlab/mlab.js", "../matlab/mlab-lib.js", "garagesim.js", "garage.js"], "AlgorithmGarage", (api, act, game, Ga, log, steps) => {
    Ga.open(0); Ga.save.code[R.JOBS[0].id] = R.JOBS[0].solution; Ga.go(true); steps(120 * 10, () => log.ceremonies.length > 0);
    log.win = log.ceremonies[0]; log.stars = Ga.save.stars.g1;
    Ga.open(1); Ga.save.code[R.JOBS[1].id] = "move(9)"; Ga.go(true); steps(120 * 10, () => log.shows > 6); log.failShown = Ga.S.play && Ga.S.play.done;
  });
} catch (e) { out.error = String(e && e.stack || e); }
console.log(JSON.stringify(out));
