/* Freshers School Life: a headless benchmark of the simulation alone (no rendering).
   Boots the game as samaru_harness.js does, fills the world as a busy street would be, then times Z.update.
   Usage: node samaru_bench.js <static/js/games dir> [seconds]. Prints one JSON object: milliseconds per
   1/120 s sim step, per 60 Hz frame (two steps), and a breakdown. "of which" rows overlap the rows above them. */
const fs = require("fs"), path = require("path"), { performance } = require("perf_hooks");
const src = fs.readFileSync(path.join(__dirname, "samaru_harness.js"), "utf8"), cut = src.indexOf("const out = { log: [] }");
const boot = new Function("require", "process", "__dirname", "module", "exports", src.slice(0, cut) + "\nreturn { Z: Z, S: S, D: D, api: api, GAME: GAME, keys: keys, pressed: pressed, STEP: STEP };");
const { Z, S, D, api, GAME, keys, pressed, STEP } = boot(require, process, __dirname, module, exports);
const secs = +process.argv[3] || 60, now = () => performance.now();
function begin() { if (Z.intro) Z.intro.noAuto = true; /* the opening film would pause the world being measured */ const p = S.newPlayer("amina", "Bench"); p.home = "amina"; api._open = false; Z.begin(p, true); if (Z.guide && Z.guide.skip) Z.guide.skip(); Z.P.xp = S.xpForLevel(14); S.addXp(Z.P, 0); Z.P.money = 50000; if (Z.momentClear) Z.momentClear(); D.NPCS.forEach((n) => { Z.P.friends[n.id] = 40; }); }
Z.r3 = { ready: true, yaw: 0, pitch: .3, manual: 0, render: () => false, turn: (d) => { Z.r3.yaw += d; }, project: () => null, puff: () => {}, setQuality: () => {}, kick: () => {} };
begin();
const acc = {}, calls = {};
function wrap(obj, name, key) { if (!obj || typeof obj[name] !== "function") return; const f = obj[name]; acc[key] = 0; calls[key] = 0; obj[name] = function () { const t0 = now(); try { return f.apply(this, arguments); } finally { acc[key] += now() - t0; calls[key]++; } }; }
wrap(S, "route", "route finding"); wrap(S, "push", "collision (S.push)"); wrap(S, "nearRoad", "nearest road"); wrap(S, "wanderStep", "walker paths"); wrap(S, "los", "line of sight"); wrap(S, "tickNeeds", "needs");
["tick", "step"].forEach((k) => wrap(Z.friends, k, "friends." + k)); ["tick", "ped", "npc", "pace"].forEach((k) => wrap(Z.brawl, k, "brawl." + k));
wrap(Z.fx, "update", "fx"); wrap(Z.guide, "tick", "guide"); wrap(Z, "save", "autosave");
Z.prof = { now: now, people: 0, traffic: 0, foes: 0, security: 0 };
function frame() { GAME.update(STEP, api); api.t += STEP; if (typeof __pump === "function") __pump(STEP * 1000); for (const k in pressed) pressed[k] = false; }
// a busy scene: walk and sprint through the centre at midday, then drive the boulevard
const me = Z.me, P = Z.P; let steps = 0, total = 0, worst = 0, slow = 0, peak = { peds: 0, traffic: 0, npcs: 0, foes: 0, guards: 0 }; const half = secs / 2; let t = 0, turn = 0;
function run(dur, setup, each) { setup(); const end = t + dur; while (t < end) { P.time = 720; P.hp = P.maxHp; P.energy = 100; P.hunger = 100; if (me.fall > 0 && me.fall < 50) me.fall = 0; each(); const t0 = now(); frame(); const d = now() - t0; total += d; if (d > worst) worst = d; if (d > 4) slow++; steps++; t += STEP;
  peak.peds = Math.max(peak.peds, Z.peds.length); peak.traffic = Math.max(peak.traffic, Z.traffic.length); peak.npcs = Math.max(peak.npcs, Z.npcs.length); peak.foes = Math.max(peak.foes, Z.foes.length); peak.guards = Math.max(peak.guards, Z.guards.length); } }
for (let i = 0; i < 2400; i++) frame(); // warm up (JIT), let the street fill
const cpu0 = process.cpuUsage(); for (const k in acc) { acc[k] = 0; calls[k] = 0; } Z.prof.people = Z.prof.traffic = Z.prof.foes = Z.prof.security = 0;
run(half, () => { keys.KeyW = true; keys.ShiftLeft = true; }, () => { turn += STEP; if (turn > 6) { turn = 0; Z.r3.yaw += 1.3; } });
keys.KeyW = keys.ShiftLeft = false;
run(half, () => { const sp = Z.places.gate || Z.placeList[0], c = { id: Z.cars.length, type: "car", x: sp.mx, y: sp.my, a: Math.PI / 2, vx: 0, vy: 0, speed: 0, col: "#fff", hx: sp.mx, hy: sp.my, ha: 0, free: true }; Z.cars.push(c); me.x = c.x; me.y = c.y; Z.enter(c); keys.KeyW = true; }, () => { turn += STEP; keys.KeyA = turn % 9 > 8.2; });
const cpu = process.cpuUsage(cpu0); const per = (v) => +(v / steps).toFixed(4), out = { seconds: secs, steps: steps, msPerStep: per(total), msPer60HzFrame: +(total / steps * 2).toFixed(3), cpuMsPerStep: +((cpu.user + cpu.system) / 1000 / steps).toFixed(4), worstStepMs: +worst.toFixed(2), stepsOver4ms: slow, peak: peak, core: { people: per(Z.prof.people), traffic: per(Z.prof.traffic), "foes+things": per(Z.prof.foes), "jobs+race+security": per(Z.prof.security) }, ofWhich: {}, callsPerStep: {} };
out.core.rest = +(out.msPerStep - out.core.people - out.core.traffic - out.core["foes+things"] - out.core["jobs+race+security"]).toFixed(4);
Object.keys(acc).sort((a, b) => acc[b] - acc[a]).forEach((k) => { out.ofWhich[k] = per(acc[k]); out.callsPerStep[k] = +(calls[k] / steps).toFixed(2); });
console.log(JSON.stringify(out, null, 1));
