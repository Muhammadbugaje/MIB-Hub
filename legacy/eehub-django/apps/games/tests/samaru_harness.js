/* Headless run of Freshers School Life: a stub DOM and canvas, the real game scripts, and a scripted play-through.
   Usage: node samaru_harness.js <static/js/games dir>. Prints one JSON object; exits 1 on any thrown error. */
const path = require("path"), fs = require("fs"), dir = process.argv[2];
const noop = () => {};
function ctx() { const grad = { addColorStop: noop }; return new Proxy({}, { get: (t, k) => k in t ? t[k] : k === "measureText" ? (s) => ({ width: String(s).length * 7 }) : k === "createLinearGradient" || k === "createRadialGradient" ? () => grad : k === "createPattern" ? () => ({}) : noop, set: (t, k, v) => { t[k] = v; return true; } }); }
function el() { const e = { style: {}, children: [], hidden: true, innerHTML: "", value: "", classList: { add: noop, remove: noop, toggle: noop }, addEventListener: noop, getContext: ctx, getAttribute: () => "", setAttribute: noop, querySelector: () => el(), querySelectorAll: () => [], getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540 }), appendChild: noop, remove: noop, focus: noop, closest: () => null, width: 960, height: 540 }; return e; }
const store = {}, toasts = [], banners = [], shown = [];
global.window = global; global.self = global;
// Repeatable runs: one fixed random stream, a clock that only moves with simulated time, and timers that fire on that clock.
{ let seed = 20261112 >>> 0, simMs = 0, tid = 0; const q = [], T0 = 1.7e12;
  Math.random = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  Date.now = () => T0 + Math.floor(simMs);
  global.setTimeout = (fn, ms) => { q.push({ id: ++tid, at: simMs + (+ms || 0), fn: fn }); return tid; }; global.clearTimeout = (id) => { const i = q.findIndex((e) => e.id === id); if (i >= 0) q.splice(i, 1); };
  global.setInterval = () => 0; global.clearInterval = () => {};
  global.__pump = (ms) => { simMs += ms; for (let guard = 0; guard < 50; guard++) { let k = -1; for (let i = 0; i < q.length; i++) if (q[i].at <= simMs && (k < 0 || q[i].at < q[k].at)) k = i; if (k < 0) break; const e = q.splice(k, 1)[0]; e.fn(); } }; }
global.document = { querySelector: () => el(), querySelectorAll: () => [], createElement: () => el(), createDocumentFragment: () => el(), createTextNode: () => el(), addEventListener: noop, removeEventListener: noop, body: el(), head: el(), documentElement: el() };
global.performance = { now: () => Date.now() }; global.fetch = () => Promise.reject(new Error("offline"));
const keys = {}, pressed = {};
const api = { W: 960, H: 540, x: ctx(), t: 0, reduce: false, parts: [], shake: 0, esc: (s) => String(s),
  down: (...a) => a.some((k) => keys[k]), hit: (...a) => a.some((k) => pressed[k]), double: () => false,
  sound: { sfx: noop, say: noop, tone: noop, muted: true, ac: null }, burst: noop, kick: noop, buzz: noop, confetti: noop, flash: noop, zoom: noop, hitstop: noop, slowmo: noop,
  banner: (t, o) => banners.push(t + (o && o.sub ? " | " + o.sub : "")), music: noop, panel: noop, useActions: noop, keyName: (k) => k,
  show: (html, on) => { api._open = true; api._on = on; shown.push(html.slice(0, 60)); }, hide: () => { api._open = false; }, overlayOpen: () => !!api._open,
  store: (k, v) => { if (v === undefined) return store[k] ? JSON.parse(store[k]) : null; store[k] = JSON.stringify(v); } };
global.Arcade = { song: () => ({}), toast: (h) => toasts.push(h), report: noop, run: (g) => { global.GAME = g; g.init(api); } };
for (const code of ["fslg-map", "samaru-sim", "samaru-data", "fslg.config", "fslg-story-y1", "fslg-story-y2", "fslg-story-y3", "fslg-story-y4", "fslg-story-y5", "fslg-story-side", "fslg-story-coop", "fslg-story-choices", "fslg-story-likes", "samaru-draw", "samaru-core", "samaru-story", "samaru-overrides", "samaru-intro", "samaru-anim", "samaru-wardrobe", "samaru-veh", "samaru-fx", "samaru-touch", "samaru-settings", "samaru-guide", "samaru-moment", "samaru-life", "samaru-interior", "samaru-mall", "samaru-friends", "samaru-brawl", "samaru-jobs", "samaru-crowd", "samaru-city", "samaru-ui", "samaru-inv", "samaru-phone", "samaru-texts", "samaru-travel", "samaru-wild", "samaru-map", "samaru-voice", "samaru-minigames", "samaru-audio", "samaru-water", "samaru-kit", "samaru-switch", "samaru-conseq", "samaru-romance", "samaru-prosper", "samaru-cook", "samaru-workshop", "samaru-maker", "samaru-weather", "samaru-worldlife", "samaru-saves", "samaru"].map((f) => [f, fs.readFileSync(path.join(dir, f + ".js"), "utf8")])) { const f = code[0]; (0, eval)(code[1]); if (f === "fslg-map") global.SamaruMap = global.SamaruMap || module.exports; } // every script is read before any runs: one consistent snapshot
const Z = global.SamaruGame, S = global.SamaruSim, D = global.SamaruData;
const STEP = 1 / 120; let frames = 0;
function run(sec, each) { for (let i = 0; i < sec * 120; i++) { if (each) each(i); GAME.update(STEP, api); api.t += STEP; __pump(STEP * 1000); for (const k in pressed) pressed[k] = false; if (i % 4 === 0) { GAME.draw(api); frames++; } } }
function tap(k) { pressed[k] = true; }
function act(a) { const on = api._on; if (!on) throw new Error("no dialog open for " + a); on(a, { disabled: false, getAttribute: () => a, style: {}, classList: { add: noop } }); }
const out = { log: [] }, pending = [];
try {
  run(1); // title screen
  { // cheat codes are matched by hash: every default in games/cheat_defaults works, nothing else does, and the secret student is gated
    const J = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "cheat_defaults", "samaru-days.json"), "utf8")), T = S.CHEAT_DEFAULT;
    out.cheats = { n: J.cheats.length, known: J.cheats.every((c) => S.cheatById(c.id)), table: T.length === S.CHEATS.length,
      typed: J.cheats.every((c) => (S.cheatMatch(T, "WASDWW" + c.typed.toUpperCase(), "typed") || {}).id === c.id), dial: J.cheats.every((c) => (S.cheatMatch(T, " " + c.dial + " ", "dial") || {}).id === c.id),
      word: (S.cheatMatch(T, J.cheats[0].typed, "dial") || {}).id === J.cheats[0].id, wrong: !S.cheatMatch(T, "*100#", "dial") && !S.cheatMatch(T, "OWAMBEJOLLOFDANGOTE", "typed") && !S.cheatMatch(T, "", "dial"),
      config: (S.cheatMatch([{ id: "cash", typed: S.codeHash("New Code 9"), dial: S.codeHash("*1*2#") }], "xxnewcode9", "typed") || {}).id === "cash" };
    const U = Z.ui, H = J.hero; act("new"); out.hero = { hiddenAtFirst: !U.heroSeen() && !U.heroOpen() };
    "x y z".split(" ").forEach((k) => U.heroToken(k)); out.hero.noiseKeepsHidden = !U.heroSeen();
    H.combo.split(" ").forEach((k) => U.heroToken(k)); out.hero.comboReveals = U.heroSeen() && !U.heroOpen();
    act("c:" + D.HERO.id); out.hero.asksForCode = /bugaje/.test(shown[shown.length - 1]);
    pending.push(U.heroVerify("not the code").then((ok) => { out.hero.wrongRefused = !ok; }), (() => { const real = "server-only-code"; api.hero = { verify: (c) => Promise.resolve(c === real) }; const p = Promise.all([U.heroVerify(real), U.heroVerify("nope")]).then(([a, b]) => { out.hero.rightAccepted = a && !b; }); delete api.hero; return p; })(), U.heroVerify("anything").then((ok) => { out.hero.offlineRefuses = !ok; }));
    out.hero.swipeHash = S.seqMatch(H.swipe.replace(/ /g, ""), S.HERO_DEFAULT.swipe); out.hero.notInCast = !D.CAST.some((c) => c.id === D.HERO.id);
    const hp = S.newPlayer(D.HERO.id, ""); S.tickNeeds(hp, .1, {}); hp.energy = 0; S.tickNeeds(hp, .1, { run: true, moving: true });
    out.hero.powers = hp.god && hp.lvl >= 10 && hp.energy === 100 && hp.money > 1e6 && !!hp.flags.onehit && !!hp.flags.sjump && S.offend(hp, Object.keys(S.RULES.heat)[0]) === null && S.speedFactor(hp) > 1;
    U.inCreator = null; api._open = false;
  }
  const p = S.newPlayer("amina", "Tester"); p.home = "amina"; api._open = false; Z.begin(p, true);
  const P = Z.P, me = Z.me;
  out.places = Z.placeList.length; out.cars = Z.cars.length; out.tokens = Z.tokens.length; out.hazards = Z.hazards.length;
  out.badPlaces = Z.placeList.filter((q) => S.insideBuilding(Z.W, q.mx, q.my)).map((q) => q.id);
  out.mission0 = P.m.active;
  keys.right = true; keys.run = true; run(4); keys.right = false; keys.run = false; out.walked = +(me.x - P.x).toFixed(1);
  { // thumb sticks: the left one moves you (and sprints at the rim), the right one turns and tilts the camera
    const had = Z.r3, x0 = me.x, y0 = me.y; Z.r3 = { yaw: 0, pitch: .3, ready: false };
    Z.touch.set("move", 0, 1); Z.touch.set("look", 1, .6); run(2); const sprint = !!Z.runLock;
    out.touch = { moved: +Math.hypot(me.x - x0, me.y - y0).toFixed(1), yaw: +Z.r3.yaw.toFixed(2), pitch: +Z.r3.pitch.toFixed(2), sprint: sprint, sens: Z.touch.sensName() };
    Z.touch.set("move", .5, 0); run(.2); out.touch.walkOnly = !Z.runLock;
    Z.touch.set("move", null); Z.touch.set("look", null); run(.3); out.touch.released = !Z.stick.on && !Z.runLock; Z.r3 = had;
  }
  tap("jump"); run(1); tap("attack"); run(.5); tap("emote1"); run(.5); tap("emote2"); run(.5); tap("emote3"); run(1);
  { // street life: walkers and traffic glide, stay out of walls and off each other, and keep to the road
    const W = Z.W, x0 = me.x, y0 = me.y, t0 = P.time, prev = new Map(), r = { pedIn: 0, npcIn: 0, pedJump: 0, pedTurn: 0, carJump: 0, carTurn: 0, carOff: 0, carOverlap: 0, pedOverlap: 0 }; let sx = 30, sy = -330;
    for (let k = 0; k < 400; k++) { const a = k * 2.4, rr = 4 + k * .25, qx = 30 + Math.cos(a) * rr, qy = -330 + Math.sin(a) * rr, nr = S.nearRoad(W, qx, qy, 40); if (!S.insideBuilding(W, qx, qy) && nr && nr.d > nr.r.w / 2 + 8) { sx = qx; sy = qy; break; } }
    run(30, (i) => { me.x = sx; me.y = sy; P.time = 600;
      Z.peds.forEach((n) => { const q = prev.get(n); if (q && !n.fall && !n.flee) { if (Math.hypot(n.x - q.x, n.y - q.y) > .08) r.pedJump++; if (Math.abs(S.angDiff(n.a, q.a)) > .25) r.pedTurn++; } prev.set(n, { x: n.x, y: n.y, a: n.a }); if (S.insideBuilding(W, n.x, n.y)) r.pedIn++; });
      Z.npcs.forEach((n) => { if (!n.hidden && S.insideBuilding(W, n.x, n.y)) r.npcIn++; });
      Z.traffic.forEach((t, k) => { const q = prev.get(t); if (q) { if (Math.hypot(t.x - q.x, t.y - q.y) > .2) r.carJump++; if (Math.abs(S.angDiff(t.a, q.a)) > .12) r.carTurn++; } prev.set(t, { x: t.x, y: t.y, a: t.a }); const nr = S.nearRoad(W, t.x, t.y, 40, true); if (!nr || nr.d > nr.r.w / 2 + 1) r.carOff++; for (let j = k + 1; j < Z.traffic.length; j++) if (Math.hypot(Z.traffic[j].x - t.x, Z.traffic[j].y - t.y) < 1.6) r.carOverlap++; });
      if (i % 30 === 0) for (let a = 0; a < Z.peds.length; a++) for (let b = a + 1; b < Z.peds.length; b++) if (Math.hypot(Z.peds[a].x - Z.peds[b].x, Z.peds[a].y - Z.peds[b].y) < .3) r.pedOverlap++; });
    r.peds = Z.peds.length; r.cars = Z.traffic.length; r.moving = Z.peds.filter((n) => n.spd > .5).length; out.street = r; me.x = x0; me.y = y0; P.time = t0; Z.peds.length = 0; Z.traffic.length = 0;
    // a remote player reported four times a second is drawn without jumps and turns the short way round
    const rp = {}; let jump = 0, px = null, turned = 0; for (let i = 0; i < 480; i++) { if (i % 30 === 0) { const tt = i / 120; S.netApply(rp, { x: 100 + tt * 6, y: 50, a: tt < 2 ? 3.1 : -3.1, s: 6 }); } const a0 = rp.a; S.netStep(rp, STEP); if (px != null && Math.abs(rp.x - px) > .12) jump++; if (i > 60) turned = Math.max(turned, Math.abs(S.angDiff(rp.a, a0))); px = rp.x; }
    out.remote = { jump: jump, turned: +turned.toFixed(3), x: +rp.x.toFixed(1), spd: +rp.spd.toFixed(1) };
  }
  // every place menu opens and closes
  Z.placeList.forEach((pl) => { Z.ui.place(pl); api._open = false; });
  // every person can be talked to
  Z.npcs.forEach((n) => { Z.ui.talk(n); api._open = false; });
  { const F = Z.phone; Z.ui.phone(); ["goals", "contacts", "jobs", "radio", "net", "me", "messages", "friends", "bank", "camera", "settings", "dial"].forEach((a) => { F.app(a); F.back(); }); F.app("help"); act("ok"); api._open = false; if (F.isOpen()) F.close(true); }
  // walk the whole story with the skip code, checking each mission completes
  const skip = S.CHEATS.find((c) => c.id === "skip"); let guard = 0; const order = [];
  while (guard++ < 2000) {
    if (!P.m.active) { run(.1); if (!P.m.active) { const next = S.nextMission(P, D.MISSIONS); if (!next) { const blocked = D.MISSIONS.find((m) => !m.side && !P.m.done[m.id]); if (!blocked) break; P.xp = S.xpForLevel(blocked.need.lvl); S.addXp(P, 0); continue; } Z.nextStory(); } }
    const id = P.m.active; if (order[order.length - 1] !== id) order.push(id); Z.cheat(skip); run(.05);
  }
  out.story = order; out.storyDone = S.storyProgress(P, D.MISSIONS);
  // every vehicle drives; the aircraft takes off and lands
  P.xp = S.xpForLevel(12); S.addXp(P, 0); P.money = 1e6; out.veh = {};
  for (const t of S.VEH_ORDER) { const spot = S.randomRoadPoint(Z.W, S.rng(5 + t.length), true); me.x = spot.x; me.y = spot.y; Z.cheat({ id: t === "bike" || t === "scooter" ? "okada" : t, text: "" }); const car = Z.cars[Z.cars.length - 1]; car.type = t; Z.enter(car); keys.up = true; let top = 0, alt = 0; run(9, () => { top = Math.max(top, Math.abs(car.speed)); alt = Math.max(alt, me.alt); }); keys.up = false; keys.down = true; run(6); keys.down = false; out.veh[t] = { top: +top.toFixed(1), alt: +alt.toFixed(2) }; if (Z.me.veh) { me.alt = 0; car.vx = car.vy = 0; car.speed = 0; Z.exit(true); } }
  // a race from start to result
  me.fall = 0; P.hp = P.maxHp; Z.startRace(D.ROUTES[0], "bike", "bronze"); out.raceLen = Math.round(Z.race.len); out.raceGates = Z.race.gates.length; run(4); const R = Z.race; let rt = 0;
  while (Z.race && rt++ < 3000) { const g = R.gates[R.gate]; me.veh.x = g.x; me.veh.y = g.y; run(.02); } out.raceWon = !!P.races[R.id];
  // jobs of every kind
  out.jobs = {}; for (const k of S.JOBS) { const pts = Z.placeList.map((q) => ({ id: q.id, name: q.name, x: q.mx, y: q.my })); const j = S.makeJob(pts, S.rng(9), P.lvl, k); Z.takeJob(j); if (k === "taxi") { Z.cheat({ id: "keke", text: "" }); Z.enter(Z.cars[Z.cars.length - 1]); } const before = P.stats.jobs;
    if (k === "lost") { me.x = j.hide.x; me.y = j.hide.y; if (me.veh) { me.veh.x = me.x; me.veh.y = me.y; } run(.2); } else { for (const tg of [j.a, j.b]) { me.x = tg.x; me.y = tg.y; if (me.veh) { me.veh.x = me.x; me.veh.y = me.y; me.veh.vx = me.veh.vy = 0; me.veh.speed = 0; } run(.2); } } out.jobs[k] = P.stats.jobs - before; if (me.veh) Z.exit(true); }
  // night, blackout, shades, every boss
  Z.cheat(S.CHEATS.find((c) => c.id === "night")); Z.cheat(S.CHEATS.find((c) => c.id === "nepa")); me.x = 0; me.y = -60; run(20); out.shades = Z.foes.length; out.blackout = Z.blackout;
  P.god = true; for (const b of ["sly", "leviathan", "entropy", "bully"]) { const f = Z.spawnFoe(b, me.x + 3, me.y, false); run(6, (i) => { if (i % 40 === 0) tap("attack"); }); f.hp = 1; me.a = Math.atan2(f.y - me.y, f.x - me.x); me.x = f.x - Math.cos(me.a); me.y = f.y - Math.sin(me.a); me.cool = 0; tap("attack"); run(.3); }
  P.god = false; Z.cheat(S.CHEATS.find((c) => c.id === "light"));
  // needs: an empty energy bar never knocks you over; you walk, cannot sprint, and get your breath back standing still
  { if (me.veh) Z.exit(true); me.fall = 0; Z.foes.length = 0; const f0 = P.stats.faints, x1 = me.x, y1 = me.y; P.energy = .3; P.hunger = 0; P.hp = P.maxHp; keys.right = true; keys.run = true; run(6); keys.right = false; keys.run = false;
    const tired = { faints: P.stats.faints - f0, fall: me.fall, moved: +Math.hypot(me.x - x1, me.y - y1).toFixed(1), hp: Math.round(P.hp / P.maxHp * 100), sprint: S.canSprint(P) }; run(8); tired.rested = +P.energy.toFixed(1); tired.sprintAgain = S.canSprint(P); out.tired = tired;
    // only a lost fight puts you down, and getting up costs nothing
    const cash = P.money; P.hunger = 80; P.hp = 1; Z.hurt(50, { x: me.x + 1, y: me.y }); out.ko = { down: me.fall > 50, moment: Z.momentBusy() }; S.faint(P); out.ko.hp = Math.round(P.hp); out.ko.fee = cash - P.money; out.ko.faints = P.stats.faints - f0; me.fall = 0; Z.momentClear(); }
  // security: small things are ignored, warnings come first, a chase can be outrun, and callOff clears it all
  { const R = S.RULES, sec = {}, W = Z.W; Z.callOff(); Z.guards.length = 0; Z.foes.length = 0; P.god = false; me.fall = 0; P.energy = 100; P.hunger = 100; P.hp = P.maxHp; if (me.veh) Z.exit(true);
    { const sp = Z.places.selfie; me.x = sp.mx; me.y = sp.my; } // always from the same open lawn, whatever the story did before
    const seen = []; const emit0 = Z.emit; Z.emit = function (ev) { if (/^(warn|wanted|escaped|caught)$/.test(ev.t)) seen.push(ev.t); return emit0(ev); };
    for (let k = 0; k < 40; k++) { Z.offend("bump"); Z.offend("kerb"); } Z.offend("shove"); run(3); sec.minor = { guards: Z.guards.length, warns: P.sec.warns, state: P.sec.state };
    let n = 0; while (!P.sec.state && n++ < 200) { Z.offend("shove"); if (P.sec.state) break; run(.2); } sec.warnsBefore = seen.filter((e) => e === "warn").length; sec.allowed = R.warnings; sec.chase = P.sec.state === "chase";
    // run for it: sprint away along the road until they give up
    const road = S.nearRoad(W, me.x, me.y, 200); me.x = road.x; me.y = road.y; run(2); sec.spawned = Z.guards.length; sec.spawnDist = Math.round(Math.min(...Z.guards.map((g) => Math.hypot(g.x - me.x, g.y - me.y)).concat([999])));
    let secs = 0, caught = false; const g0 = Z.guards[0]; while (P.sec.state && secs < 90) { const g = Z.guards.find((q) => q.st !== "leave") || g0, away = g ? Math.atan2(me.y - g.y, me.x - g.x) : 0; P.energy = 100; const nx = S.push(W, me.x + Math.cos(away) * S.FOOT.run * .25, me.y + Math.sin(away) * S.FOOT.run * .25, .45); me.x = nx.x; me.y = nx.y; me.speed = S.FOOT.run; run(.25, () => { me.speed = S.FOOT.run; }); secs += .25; }
    sec.escapedIn = secs; sec.events = seen.filter((e) => e !== "warn"); sec.after = { state: P.sec.state, warns: P.sec.warns };
    // caught standing still: a small fine, no teleport
    Z.callOff(); P.sec.warns = R.warnings; P.sec.since = 0; P.sec.heat = 95; Z.offend("hitPed"); const cash = P.money, cx = me.x, cy = me.y; let wait = 0; while (P.sec.state && wait++ < 400) { me.speed = 0; run(.25); }
    sec.caught = { events: seen.slice(-1)[0], fine: cash - P.money, moved: +Math.hypot(me.x - cx, me.y - cy).toFixed(1), secs: wait * .25 };
    P.sec.warns = R.warnings; P.sec.since = 0; Z.offend("hitPed"); run(3); Z.callOff(); sec.off = { state: P.sec.state, heat: P.sec.heat, warns: P.sec.warns, guards: Z.guards.length, wanted: P.wanted };
    // guards never stand still mid-chase: 20 chases from 47 m with you strolling away, buildings in between or not
    { let stalls = 0, worst = 0, runs = 0; for (let tr = 0; tr < 20; tr++) { Z.callOff(); Z.momentClear(); if (me.veh) Z.exit(true); me.fall = 0; P.hp = P.maxHp; const q = S.randomRoadPoint(W, Math.random, false), ww = S.wanderStart(W, Math.random, q, false); S.wanderStep(W, ww, 0, Math.random, q.r.w / 2 + 1.5); me.x = ww.x; me.y = ww.y; P.sec.warns = R.warnings; P.sec.since = 0; Z.offend("hitPed");
        let gx = me.x, gy = me.y; for (let k = 0; k < 30; k++) { const a = Math.random() * 6.283; gx = me.x + Math.cos(a) * 47; gy = me.y + Math.sin(a) * 47; if (!S.insideBuilding(W, gx, gy)) break; } Z.guards.length = 0; Z.guards.push({ x: gx, y: gy, a: 0, spd: 0, walk: 0, st: "chase", hold: 0, guard: 1 }); const g = Z.guards[0]; let px = g.x, py = g.y, still = 0, tt = 0; runs++;
        while (tt < 30 && P.sec.state) { S.wanderStep(W, ww, 2.2 * STEP, Math.random, q.r.w / 2 + 1.5); const n = S.push(W, ww.x, ww.y, .45); me.a = Math.atan2(n.y - me.y, n.x - me.x); me.x = n.x; me.y = n.y; me.speed = 2.2; run(STEP, () => { P.time = 600; me.speed = 2.2; }); tt += STEP; const mv = Math.hypot(g.x - px, g.y - py); px = g.x; py = g.y; if (mv < .003 && P.sec.state === "chase" && !(g.fall > 0)) { still += STEP; worst = Math.max(worst, still); } else still = 0; }
        if (worst > 2) stalls++; worst = 0; } sec.stall = { runs: runs, stalls: stalls }; Z.callOff(); Z.guards.length = 0; }
    sec.rules = S.setRules({ warnings: 9, heat: { shove: 3 }, bogus: 1 }).warnings; S.setRules({ warnings: 5, heat: { shove: 9 } }); Z.emit = emit0; Z.momentClear(); out.security = sec; }
  // friends: a companion keeps up on foot and on wheels, a leader gets you there, and everyone keeps a day of their own
  { const W = Z.W, F = Z.friends, fr = {}, n = Z.npc("ada"), t0 = P.time; Z.callOff(); Z.foes.length = 0; Z.peds.length = 0; Z.traffic.length = 0; if (me.veh) Z.exit(true); me.fall = 0; P.friends.ada = 60; P.energy = 100; P.hunger = 100; P.time = 600; Z.momentClear();
    const A = Z.places.senate, B = Z.places.library, C = Z.places.physics, line = S.route(W, A.mx, A.my, B.mx, B.my, false).concat(S.route(W, B.mx, B.my, C.mx, C.my, false).slice(2));
    me.x = line[0]; me.y = line[1]; n.x = me.x + 2; n.y = me.y + 1; Z.npcs.forEach((q) => { q.follow = false; q.lead = null; }); F.follow(n, 900);
    let walked = 0, worst = 0, inside = 0, i = 2; const sp = S.FOOT.walk;
    while (i < line.length && walked < 420) { const dx = line[i] - me.x, dy = line[i + 1] - me.y, d = Math.hypot(dx, dy); if (d < .6) { i += 2; continue; } const st = Math.min(d, sp * STEP * 6); me.a = Math.atan2(dy, dx); me.x += dx / d * st; me.y += dy / d * st; me.speed = sp; walked += st; run(.05, () => { me.speed = sp; P.time = 600; }); if (walked > 15) worst = Math.max(worst, Math.hypot(n.x - me.x, n.y - me.y)); if (S.insideBuilding(W, n.x, n.y)) inside++; }
    me.speed = 0; run(2); fr.follow = { walked: Math.round(walked), worst: +worst.toFixed(1), inside: inside, still: n.follow, spd: n.spd < .5 };
    // on your pillion, then on their own bicycle, then back on foot
    const road = S.nearRoad(W, me.x, me.y, 200); me.x = road.x; me.y = road.y; n.x = me.x + 1.5; n.y = me.y; const mk = (type) => { const c = { id: Z.cars.length, type: type, x: me.x + 1, y: me.y + 1, a: 0, vx: 0, vy: 0, speed: 0, col: "#fff", hx: me.x, hy: me.y, ha: 0, free: true }; Z.cars.push(c); return c; };
    const ok = mk("okada"); P.xp = Math.max(P.xp, S.xpForLevel(12)); S.addXp(P, 0); Z.enter(ok); run(1); fr.pillion = { riding: !!n.riding, on: n.rideV === ok, gap: +Math.hypot(n.x - ok.x, n.y - ok.y).toFixed(1) };
    Z.exit(true); run(1.5); fr.off = { riding: !!n.riding, gap: +Math.hypot(n.x - me.x, n.y - me.y).toFixed(1), inside: !!S.insideBuilding(W, n.x, n.y) };
    const bk = mk("bike"); Z.enter(bk); keys.up = true; run(8, () => { P.time = 600; }); keys.up = false; run(2); fr.bike = { own: !!n.onBike && !!n.bike && n.rideV === n.bike, foot: !n.rideV && !n.onBike, gap: +Math.hypot(n.x - me.x, n.y - me.y).toFixed(1) }; Z.exit(true); run(1.5); fr.bike.off = !n.onBike; F.release(n);
    // "lead me to": the player simply walks after the friend
    const dest = Z.places.library, start = S.nearRoad(W, Z.places.senate.mx, Z.places.senate.my, 200); me.x = start.x; me.y = start.y; n.x = me.x + 2; n.y = me.y; let led = false; const emit1 = Z.emit; Z.emit = function (ev) { if (ev.t === "lead") led = ev.place; return emit1(ev); };
    F.lead(n, dest.id); let secs = 0; while (n.lead && secs < 400) { const dx = n.x - me.x, dy = n.y - me.y, d = Math.hypot(dx, dy); if (d > 3) { const q = S.push(W, me.x + dx / d * sp * .1, me.y + dy / d * sp * .1, .45); me.a = Math.atan2(dy, dx); me.x = q.x; me.y = q.y; me.speed = sp; } else me.speed = 0; run(.1, () => { P.time = 600; }); secs += .1; }
    Z.emit = emit1; fr.lead = { arrived: led, secs: Math.round(secs), meToPlace: Math.round(Math.hypot(me.x - dest.mx, me.y - dest.my)), walksOn: n.follow }; F.release(n);
    // a day in the life: with nobody watching, friends still get to where the hour puts them
    me.x = Z.W.bounds[0] + 30; me.y = Z.W.bounds[3] - 30; const seenP = {}, lateBy = []; ["ada", "yakubu", "sadiq"].forEach((id) => { seenP[id] = {}; });
    for (const h of [6.2, 8.2, 11.2, 13.2, 15.2, 17.2, 19.2, 21.2, 23.2]) { run(25, () => { P.time = h * 60; me.x = Z.W.bounds[0] + 30; me.y = Z.W.bounds[3] - 30; api._open = false; }); for (const id in seenP) { const q = Z.npc(id), rt = q && Z.friends.ensure(q); if (!rt) { (fr.noRoutine = fr.noRoutine || []).push(id + " at " + h); continue; } seenP[id][rt.place] = 1; lateBy.push(rt.there ? 0 : Math.round(Math.hypot(rt.tx - q.x, rt.ty - q.y))); } }
    fr.day = { places: Object.keys(seenP).map((id) => Object.keys(seenP[id]).length), late: lateBy.filter((d) => d > 0).length, inside: Z.npcs.filter((q) => S.insideBuilding(W, q.x, q.y)).length };
    // an offer out of the blue, accepted with E
    Z.npcs.forEach((q) => { q.follow = false; q.lead = null; q.coming = false; }); P.time = 17 * 60; me.x = start.x; me.y = start.y; me.speed = 0; F.soon(); let offered = 0; for (let s = 0; s < 200 && !offered; s++) { run(1, () => { P.time = 17 * 60; }); const o = F.offer(); if (o && o.st === "ask") offered = 1; }
    if (offered) { tap("act"); run(.1); } fr.offer = { made: !!offered, leading: Z.npcs.some((q) => q.lead) }; Z.npcs.forEach((q) => { if (q.lead || q.follow) F.release(q); }); P.time = t0; out.friends = fr; }
  // people react: knocked down means down, still, up again; timid run, ordinary hit back and leave, tough square up and yield
  { const W = Z.W, B = Z.brawl, br = {}; Z.callOff(); Z.foes.length = 0; Z.traffic.length = 0; Z.npcs.forEach((q) => { if (q.follow || q.lead) Z.friends.release(q); }); if (me.veh) Z.exit(true); me.fall = 0; P.god = false; P.hp = P.maxHp; P.energy = 100; P.hunger = 100; Z.momentClear();
    const q0 = S.nearRoad(W, Z.places.library.mx, Z.places.library.my, 200), spot = S.push(W, q0.x + Math.cos(0) * (q0.r.w / 2 + 3), q0.y + (q0.r.w / 2 + 3), .5);
    const mk = (mood) => { const w = S.wanderStart(W, S.rng(7), { x: q0.x, y: q0.y, r: q0.r }, false); S.wanderStep(W, w, 0, S.rng(8), q0.r.w / 2 + 1.5); const n = { w: w, x: spot.x + 1.1, y: spot.y, a: Math.PI, spd: 0, look: { skin: "#6b4226", hair: "low", top: "#fff" }, sp: 1.5, side: q0.r.w / 2 + 1.5, walk: 0, fall: 0, wave: 0, flee: 0, k: 1, mood: mood, hp: [3, 6, 10][mood], maxHp: [3, 6, 10][mood], back: 0, cd: 0, st: "" }; Z.peds.length = 0; Z.peds.push(n); me.x = spot.x; me.y = spot.y; me.a = 0; me.fall = 0; me.cool = 0; me.inv = 0; P.hp = P.maxHp; Z.callOff(); return n; };
    const hold = () => { Z.callOff(); P.time = 600; Z.traffic.length = 0; if (Z.peds.length > 1) Z.peds.length = 1; };
    // 1. a kick puts them down: still on the ground, then up through a get-up, then walking again
    { const n = mk(1); n.hp = 99; n.maxHp = 99; B.hit(n, 0, true, "tackle"); let lie = 0, movedDown = 0, gotUp = 0, px = n.x, py = n.y, upAt = 0, tt = 0; run(9, () => { hold(); const landed = n.fall > 0 && !n.kv; if (landed) { lie += STEP; if (lie > .1) movedDown = Math.max(movedDown, Math.hypot(n.x - px, n.y - py)); } px = n.x; py = n.y; if (n.getUpT > 0) gotUp = 1; tt += STEP; if (!upAt && !n.fall && !n.getUpT && !n.dustT && tt > .5) upAt = tt; });
      br.down = { lay: +lie.toFixed(1), movedWhileDown: +movedDown.toFixed(3), gotUp: gotUp, standing: n.fall === 0 && !n.getUpT, upAfter: +upAt.toFixed(1) }; }
    // 2. run over by a car: down for longer, up again, limping, and nobody stays on the floor
    { const n = mk(1); const c = { id: Z.cars.length, type: "car", x: me.x, y: me.y, a: 0, vx: 0, vy: 0, speed: 0, col: "#fff", hx: me.x, hy: me.y, ha: 0, free: true }; Z.cars.push(c); Z.enter(c); c.x = n.x - 2.2; c.y = n.y; c.vx = 12; c.vy = 0; c.speed = 12; me.x = c.x; me.y = c.y; n.dodge = 0; n.scT = 99; B.ped(n, STEP, Math.hypot(n.x - c.x, n.y - c.y)); const fell = n.fall; c.vx = c.vy = 0; c.speed = 0; c.x -= 30; Z.exit(true); me.x = spot.x - 30; let lie = 0; run(12, () => { hold(); if (n.fall > 0 && !n.kv) lie += STEP; });
      br.car = { fell: +fell.toFixed(1), lay: +lie.toFixed(1), up: n.fall === 0 && !n.getUpT, limp: n.limp > 0, heat: P.sec.heat >= 0 }; }
    // 3. timid: runs
    { const n = mk(0); n.hp = 3; const d0 = Math.hypot(n.x - me.x, n.y - me.y); B.hit(n, 0, false, "punch"); const hp0 = P.hp; run(10, hold); br.timid = { away: +(Math.hypot(n.x - me.x, n.y - me.y) - d0).toFixed(1), hurtYou: Math.round(hp0 - P.hp), up: n.fall === 0 }; }
    // 4. ordinary: hits back once or twice, then walks off; and lets you go if you walk away
    { const n = mk(1); B.hit(n, 0, false, "punch"); const hp0 = P.hp; let sawWind = 0; run(12, () => { hold(); if (n.wind > 0) sawWind = 1; me.x = n.x - 1.2; me.y = n.y; me.a = 0; me.fall = 0; }); br.normal = { hitBack: n.back, lost: Math.round(hp0 - P.hp), windUp: sawWind, state: n.st || "walking" };
      const n2 = mk(1); B.hit(n2, 0, false, "punch"); run(.6, hold); me.x -= 14; run(2, hold); br.normal.letGo = n2.st !== "fight"; }
    // 5. tough: squares up; blocking takes the sting out; keep swinging and they put their hands up
    { const n = mk(2); B.hit(n, 0, false, "punch"); const hp0 = P.hp; run(5, () => { hold(); me.x = n.x - 1.2; me.y = n.y; me.a = 0; me.fall = 0; }); const open = hp0 - P.hp, backs = n.back;
      const n3 = mk(2); B.hit(n3, 0, false, "punch"); keys.block = true; const hp1 = P.hp; run(5, () => { hold(); me.x = n3.x - 1.2; me.y = n3.y; me.a = 0; me.fall = 0; }); keys.block = false; const blocked = hp1 - P.hp, b3 = n3.back;
      const n4 = mk(2); let yielded = 0, maxLoss = 0; const hp2 = P.hp; for (let k = 0; k < 40 && !yielded; k++) { me.x = n4.x - 1.1; me.y = n4.y; me.a = 0; me.fall = 0; me.cool = 0; if (!(n4.fall > 0) && !(n4.getUpT > 0)) B.strike(false, "punch"); run(.6, hold); if (n4.st === "yield" || (n4.st === "flee" && n4.hits > 2)) yielded = 1; maxLoss = Math.max(maxLoss, hp2 - P.hp); }
      br.tough = { hitBack: backs, lost: Math.round(open), perHit: +(open / Math.max(1, backs)).toFixed(1), blockedLost: Math.round(blocked), blockedHits: b3, yields: yielded, fightCost: Math.round(maxLoss), alive: P.hp > 0 }; }
    // 6. your moves: kick and block are real inputs; a running kick is a tackle
    { const n = mk(1); n.hp = 99; me.cool = 0; tap("kick"); run(.05, hold); br.moves = { kick: me.combo === 2 && me.punch > 0, kicked: n.hits === 1 }; keys.block = true; run(.1, hold); br.moves.block = !!me.block; keys.block = false; run(.1, hold); br.moves.unblock = !me.block;
      const hasKey = GAME.actions.some((a) => a.id === "kick") && GAME.actions.some((a) => a.id === "block"); br.moves.bound = hasKey; }
    Z.peds.length = 0; Z.callOff(); P.hp = P.maxHp; me.fall = 0; Z.momentClear(); out.brawl = br; }
  // jobs come with their vehicle, chain through stops, pay tips, can be cancelled; and focus holds other prompts back
  { const W = Z.W, J = Z.jobs, F = Z.focus, jb = {}; Z.callOff(); Z.foes.length = 0; Z.peds.length = 0; Z.traffic.length = 0; Z.npcs.forEach((q) => { if (q.follow || q.lead) Z.friends.release(q); }); if (me.veh) Z.exit(true); me.fall = 0; P.job = null; Z.momentClear(); P.time = 600; P.flags.excused = 0;
    const pts = Z.placeList.map((q) => ({ id: q.id, name: q.name, x: q.mx, y: q.my })), at = Z.places.gate, go = (t) => { const v = me.veh; if (v) { v.x = t.x; v.y = t.y; v.vx = v.vy = 0; v.speed = 0; } me.x = t.x; me.y = t.y; run(.4, () => { P.time = 600; }); };
    me.x = at.mx; me.y = at.my; const idle = F.current().kind, offerOk = F.allow("friend-offer");
    const j = S.makeJob(pts, S.rng(21), P.lvl, "taxi"), extra = pts.find((q) => q.id !== j.a.id && q.id !== j.b.id && Math.hypot(q.x - j.b.x, q.y - j.b.y) > 150); j.chain = [{ id: extra.id, name: extra.name, x: extra.x, y: extra.y }]; j.legPay = 300; const cars0 = Z.cars.length, cash0 = P.money, rated0 = P.stats.rated || 0;
    Z.takeJob(j); jb.given = { veh: j.veh && j.veh.type, parked: Z.cars.length - cars0, near: j.veh ? +Math.hypot(j.veh.x - me.x, j.veh.y - me.y).toFixed(1) : -1, fee: j.fee, waiting: !!(j.pax && j.pax.pax === "wait" && Z.peds.includes(j.pax)), total: j.total };
    jb.focus = { kind: F.current().kind, idle: idle, offerIdle: offerOk, offer: F.allow("friend-offer"), strip: F.allow("lecture-strip"), warn1: F.allow("class-warning", "t"), warn2: F.allow("class-warning", "t"), moment: F.allow("moment"), excuse1: F.excuse(), excuse2: F.excuse() };
    const jv = j.veh; Z.enter(jv); jb.rides = me.veh === jv; const b1 = j.b.id; go(j.a); run(1.5, () => { P.time = 600; }); jb.pickup = { stage: j.stage, aboard: !!(j.pax && j.pax.pax === "in") && !Z.peds.includes(j.pax) };
    go(j.b); jb.chain = { legs: j.legs, earned: j.earned, moved: j.b.id !== b1, still: P.job === j, fare: !!j.pax };
    run(1.5, () => { P.time = 600; }); go(j.b); run(.5); jb.done = { over: !P.job, vehGone: !Z.cars.includes(jv), onFoot: !me.veh, paid: P.money - cash0, atLeast: j.pay + 300 - j.fee, rated: (P.stats.rated || 0) - rated0, out: Z.peds.some((q) => q.freed), stars: P.stats.stars > 0 };
    // cancel: the delivery okada goes back and nothing is lost
    Z.momentClear(); const d = S.makeJob(pts, S.rng(22), P.lvl, "delivery"), cash1 = P.money; Z.takeJob(d); const dv = d.veh; Z.enter(dv); run(.2); tap("cancelJob"); run(.2); jb.cancel = { veh: dv && dv.type, over: !P.job, vehGone: !Z.cars.includes(dv), onFoot: !me.veh, cost: cash1 - P.money, focus: F.current().kind };
    // a job vehicle is not a free ride
    const stray = { id: Z.cars.length, type: "keke", x: me.x + 1, y: me.y, a: 0, vx: 0, vy: 0, speed: 0, col: "#facc15", hx: me.x, hy: me.y, ha: 0, free: true, job: true }; Z.cars.push(stray); Z.enter(stray); jb.locked = !me.veh; Z.cars.splice(Z.cars.indexOf(stray), 1); Z.peds.length = 0; Z.momentClear(); out.jobsPlus = jb; }
  // the hour shows in the people: queues at noon, a kick-about and couples at dusk, prayer rows, patrols at night
  { const W = Z.W, C = Z.crowd, cr = { acts: {}, inside: 0, sitMoved: 0, trees: 0 }, t0 = P.time; Z.callOff(); if (me.veh) Z.exit(true); Z.npcs.forEach((q) => { if (q.follow || q.lead) Z.friends.release(q); });
    const near = (kind) => { const pl = Z.placeList.find((q) => C.kindOf(q) === kind); if (!pl) return null; for (let k = 0; k < 60; k++) { const a = k * 1.1, x = pl.mx + Math.cos(a) * 80, y = pl.my + Math.sin(a) * 80; if (!S.insideBuilding(W, x, y)) return { x: x, y: y }; } return { x: pl.mx + 80, y: pl.my }; };
    for (const [h, kind] of [[8, "class"], [13.2, "food"], [13.2, "mosque"], [17.5, "pitch"], [17.5, "garden"], [20, "social"], [23.5, "market"], [23.5, "home"]]) { const at = near(kind); if (!at) { cr.acts[h + ":" + kind] = ["no such place"]; continue; } Z.peds.length = 0; C.reset(); const prev = new Map();
      run(8, () => { P.time = h * 60; me.x = at.x; me.y = at.y; me.speed = 0; Z.traffic.length = 0; for (const n of Z.peds) { if (!n.scene) continue; if (S.insideBuilding(W, n.x, n.y)) cr.inside++; const q = prev.get(n); if (q && n.sit && Math.hypot(n.x - q.x, n.y - q.y) > .01) cr.sitMoved++; prev.set(n, { x: n.x, y: n.y }); } });
      const sc = C.scenes(); cr.acts[h + ":" + kind] = [...new Set(Object.keys(sc).map((k) => sc[k].act))].sort(); cr.people = Math.max(cr.people || 0, Z.peds.filter((n) => n.scene).length); }
    const plan = (h, d) => C.plan(h, d).map((q) => q.at + ":" + q.act); cr.sunday = plan(9, 7).includes("chapel:chat") && !plan(9, 3).includes("chapel:chat"); cr.night = plan(2, 3).length <= 3 && plan(13, 3).length >= 3;
    const trees = (W.props || []).filter((q) => q.k === "tree" || q.k === "palm"); Z.npcs.forEach((n) => { if (!n.hidden && trees.some((t) => Math.hypot(t.x - n.x, t.y - n.y) < 1.4)) cr.trees++; }); cr.rigs = Z.npcs.every((n) => n.look && n.look.skin && n.look.top) && Z.peds.every((n) => n.look && n.look.skin);
    Z.peds.length = 0; C.reset(); P.time = t0; out.crowd = cr; }
  // combat respects walls: no blows through a building corner, and enemies find their way round buildings to you
  { const W = Z.W, cb = { found: false }; Z.callOff(); Z.foes.length = 0; Z.peds.length = 0; if (me.veh) Z.exit(true); me.fall = 0; P.god = false; P.hp = P.maxHp; Z.momentClear();
    let A = null, B = null; const B0 = W.bounds, rr = S.rng(77);
    for (let k = 0; k < 400000 && !A; k++) { const ax = B0[0] + rr() * (B0[2] - B0[0]), ay = B0[1] + rr() * (B0[3] - B0[1]); if (S.insideBuilding(W, ax, ay)) continue; const t = rr() * 6.283, bx = ax + Math.cos(t) * 2, by = ay + Math.sin(t) * 2, px = (ax + bx) / 2, py = (ay + by) / 2; if (!S.insideBuilding(W, px, py)) continue;
      if (S.insideBuilding(W, bx, by) || S.inWater(W, ax, ay) || S.inWater(W, bx, by)) continue; A = { x: ax, y: ay }; B = { x: bx, y: by }; } /* two people 2 m apart with a wall between them */
    if (A) { cb.found = true; const hold = () => { me.x = A.x; me.y = A.y; me.a = Math.atan2(B.y - A.y, B.x - A.x); me.fall = 0; P.time = 600; Z.callOff(); };
      // your punch at an enemy on the far side of the corner
      let f = Z.spawnFoe("bully", B.x, B.y, false); f.x = B.x; f.y = B.y; f.frozen = 99; const hp0 = f.hp; hold(); me.cool = 0; tap("attack"); run(.1, hold); cb.throughWall = Math.round(hp0 - f.hp); Z.foes.length = 0;
      // and its blow at you
      f = Z.spawnFoe("bully", B.x, B.y, false); f.x = B.x; f.y = B.y; f.st = "wind"; f.t = .41; f.cd = 9; const php = P.hp; hold(); run(.05, () => { hold(); f.x = B.x; f.y = B.y; }); cb.hurtThroughWall = Math.round(php - P.hp); Z.foes.length = 0;
      // control: the same punch with a clear line lands
      const C2 = S.push(W, A.x + Math.cos(me.a + Math.PI) * 1.4, A.y + Math.sin(me.a + Math.PI) * 1.4, .6); f = Z.spawnFoe("bully", C2.x, C2.y, false); f.x = C2.x; f.y = C2.y; f.frozen = 99; const hp1 = f.hp; me.x = A.x; me.y = A.y; me.a = Math.atan2(C2.y - A.y, C2.x - A.x); me.cool = 0; tap("attack"); run(.1, () => { me.x = A.x; me.y = A.y; me.a = Math.atan2(C2.y - A.y, C2.x - A.x); P.time = 600; Z.callOff(); }); cb.clearHit = Math.round(hp1 - f.hp); Z.foes.length = 0; }
    // enemies start 30-40 m away with a building between: they must come round to you within 25 s
    let reached = 0, tries = 0; for (let k = 0; k < 4000 && tries < 10; k++) { const q = S.randomRoadPoint(W, rr, false); if (!q) continue; const ww = S.wanderStart(W, rr, q, false); S.wanderStep(W, ww, 0, rr, q.r.w / 2 + 1.5); const a = rr() * 6.283, fx = ww.x + Math.cos(a) * 35, fy = ww.y + Math.sin(a) * 35; if (S.insideBuilding(W, fx, fy) || S.inWater(W, fx, fy) || S.los(W, ww.x, ww.y, fx, fy) || S.insideBuilding(W, ww.x, ww.y)) continue; tries++;
      Z.foes.length = 0; P.hp = P.maxHp; const g = Z.spawnFoe("bully", fx, fy, false); g.x = fx; g.y = fy; let ok = false, tt = 0; while (tt < 25 && !ok) { run(.25, () => { me.x = ww.x; me.y = ww.y; me.fall = 0; P.hp = P.maxHp; P.time = 600; Z.callOff(); }); tt += .25; if (Math.hypot(g.x - me.x, g.y - me.y) < g.def.r + 2) ok = true; } if (ok) reached++; }
    cb.chase = { tries: tries, reached: reached }; Z.foes.length = 0; P.hp = P.maxHp; Z.momentClear(); out.combat = cb; }
  // moments: every kind stages and ends, and a loss offers a retry that E takes
  { let tried = 0; const kinds = ["mission", "goal", "job", "level", "unlock", "finale", "raceWin", "raceLose", "fail", "ko"]; kinds.forEach((k) => Z.moment(k, { title: "T", cash: 500, xp: 40, lvl: 5, unlocks: ["Car"], name: "N", podium: [{ name: "A", time: 9 }, { name: "You", me: 1 }, { name: "B" }], place: 2, retry: () => { tried++; } }));
    run(1.5); const first = Z.momentBusy(); run(45); const drained = !Z.momentBusy(); const poses = {}; if (me.veh) Z.exit(true); me.fall = 0; Z.foes.length = 0; for (const k of ["mission", "level", "promotion", "raceWin", "escaped", "goal", "raceLose", "fail", "caught", "ko"]) { Z.momentClear(); me.emote = ""; me.emoteT = 0; const b0 = banners.length; Z.moment(k, { title: "T", lvl: 3, name: "N", cash: 10, xp: 5 }); run(.3); poses[k] = [me.emote, banners.length > b0]; run(12); poses[k].push(!Z.momentBusy()); } out.momentPoses = poses; Z.moment("raceLose", { name: "N", place: 3, retry: () => { tried++; } }); run(1); tap("act"); run(.1); out.moments = { started: first, retried: tried, drained: drained && !Z.momentBusy() }; }
  { // wardrobe: every item is valid and modest, outfits survive save and network, walkers get valid outfits, the shop charges once
    const Wd = Z.wardrobe, items = D.WARDROBE, by = {}; items.forEach((it) => { by[it.id] = it; });
    const w = out.wardrobe = { n: items.length, brands: D.BRANDS.length, valid: items.every(S.itemValid), modest: items.every(S.modest), unique: Object.keys(by).length === items.length,
      lengths: items.filter((it) => it.slot === "bottom" || it.slot === "one").every((it) => ["knee", "calf", "ankle"].indexOf(it.len) >= 0 && it.fit !== "tight"), brandsKnown: items.every((it) => Wd.brand(it.brand)),
      rejects: !S.modest({ slot: "bottom", len: "mini", modest: true }) && !S.modest({ slot: "top", fit: "tight", modest: true }) && !S.modest({ slot: "top", sheer: true, modest: true }) };
    w.presets = Object.keys(D.FITS).every((k) => { const f = S.fitClean(D.FITS[k], items); return Object.keys(D.FITS[k]).every((s) => s === "acc" ? f.acc.length === D.FITS[k].acc.length : f[s] === D.FITS[k][s]); });
    let okN = 0, kinds = {}; for (let i = 0; i < 200; i++) { const f = S.randomFit(items, 1000 + i * 7, { sex: i % 2 ? "f" : "m", hijab: i % 6 === 1 }); const worn = ["head", "eye", "top", "bottom", "one", "outer", "shoes"].map((k) => f[k]).concat(f.acc).filter(Boolean);
      if (worn.every((v) => by[S.wornId(v)] && S.wornCol(v) < by[S.wornId(v)].cols.length && (!by[S.wornId(v)].sex || by[S.wornId(v)].sex === (i % 2 ? "f" : "m"))) && f.shoes && (f.one || (f.top && f.bottom)) && JSON.stringify(S.fitClean(S.fitUnpack(S.fitPack(f)), items)) === JSON.stringify(f) && Wd.spec({ skin: "#6b4226", fit: f }, "tee").torso) okN++; kinds[f.one ? by[S.wornId(f.one)].kind : by[S.wornId(f.top)].kind] = 1; }
    w.walkers = okN; w.variety = Object.keys(kinds).length;
    const fit = S.fitClean(Object.assign({ hair: "coily", hc: 2, beard: "goatee" }, D.FITS.blazer, { acc: ["watch.1", "backpack.0"] }), items), packed = S.fitPack(fit); w.packLen = packed.length; w.packSafe = /^[a-z0-9.,]*$/.test(packed) && packed.length <= 200;
    w.net = JSON.stringify(S.fitClean(S.fitUnpack(S.pack(Object.assign({}, P, { fit: fit }), me).f), items)) === JSON.stringify(fit);
    const money0 = P.money = 50000, lvl0 = P.lvl; P.lvl = 20; P.closet = {}; P.fit = null;
    Wd.editor("shop", () => {}, { store: "market" }); Wd.act("t:one"); Wd.act("i:kaftan"); Wd.act("c:2"); w.tryOn = P.fit.one === "kaftan.2" && !Wd.owns("kaftan"); Wd.act("buy"); w.bought = Wd.owns("kaftan") && P.money === money0 - by.kaftan.price; Wd.act("t:shoes"); Wd.act("i:loafers"); Wd.act("done");
    w.unpaidReturned = !Wd.owns("loafers") && S.wornId(P.fit.shoes) !== "loafers" && P.fit.one === "kaftan.2" && !api._open; w.noDouble = !Wd.buy("kaftan").ok; P.lvl = 1; w.gate = !Wd.buy("agbada").ok; P.lvl = 20;
    Wd.editor("closet", () => {}); Wd.act("s:0"); Wd.act("t:hair"); Wd.act("h:afro"); Wd.act("l:0"); Wd.act("done"); w.slots = P.fits.length === 1 && P.fit.hair !== "afro";
    Z.save(); const back = Z.load(); w.saved = !!back && JSON.stringify(back.fit) === JSON.stringify(P.fit) && !!back.closet.kaftan;
    const old = S.newPlayer("tunde", "Old"); delete old.fit; delete old.closet; delete old.fits; const mg = S.migrate(old); w.oldSave = !!mg && mg.fit == null && !!mg.closet && Array.isArray(mg.fits) && !!Wd.fitOf(mg).shoes;
    w.hero = Wd.owns("makerkaftan", S.newPlayer("bugaje", "")) && !Wd.owns("makerkaftan", P) && Wd.stock("mib").every((it) => it.brand === "mib" && !it.locked) && Wd.stock("mib").length >= 8 && Wd.fromLook(D.HERO, "kaftan").one === "makerkaftan.0";
    w.stock = Wd.stock("anything-else").length > 0 && Wd.stock("market").length > 10; w.flat = Wd.flat({ skin: "#6b4226", fit: fit }).glasses === "square";
    // custom-text shirt, the text filter, and stable first names
    P.lvl = 20; P.money = 50000; Wd.editor("shop", () => {}, { store: "mibstore" }); Wd.act("t:top"); Wd.act("i:mibcustom"); Wd.act("buy"); Wd.act("x:Up NEPA!"); const t1 = P.fit.txt; Wd.act("x:f u c k"); const t2 = P.fit.txt; Wd.act("done");
    w.shirt = t1 === "up nepa" && t2 === "up nepa" && Wd.spec(Wd.lookOf(P, Z.charOf(P.char)), "tee").text === "up nepa" && S.fitUnpack(S.fitPack(P.fit)).txt === "up nepa";
    w.filter = S.shirtText("ABCDEFGHIJKLMNOP") === "abcdefghijkl" && S.shirtText("<b>hi</b>") === "bhib" && S.shirtText("sh1t happens") === "" && S.shirtText("Essex") === "essex" && S.shirtText("") === "";
    w.noTextElsewhere = !S.fitClean({ top: "tee.0", txt: "hello" }, items).txt;
    const nm = D.NAMES, ped = { look: { skin: "#6b4226", top: "#fff", hair: "low", voice: "female", pitch: 1 }, k: 4, x: me.x + 1, y: me.y }, n1 = Wd.nameOf(ped);
    w.names = nm.length >= 80 && ["Ahmad", "Jega", "Maryam", "Firdausi", "Lyzzy", "Svitlana", "Sugar", "Lucky", "Clemantine", "Micheal"].every((x) => nm.indexOf(x) >= 0) && nm.f.concat(nm.n).indexOf(n1) >= 0 && Wd.nameOf(ped) === n1 && Wd.greet(ped) === n1 && S.nameFor(nm, 5, "m") === S.nameFor(nm, 5, "m") && new Set(nm).size === nm.length;
    w.bolaji = Z.npc("bola").def.name === "Bolaji";
    P.money = money0; P.lvl = lvl0; P.fit = null; api._open = false;
  }
  // remaining cheats, the map, saving and loading
  S.CHEATS.forEach((c) => { if (c.id !== "skip" && c.id !== "missions") Z.cheat(c); }); out.cheatFlags = !!(P.flags.calloff && P.flags.sjump && P.flags.notire && P.flags.onehit) && P.lvl === S.MAX_LEVEL;
  Z.cheat(S.cheatById("missions")); act("i20"); out.picked = P.m.active === "m21" && !!P.m.done.m20 && !P.m.done.m21; api._open = false;
  P.cheated = true; out.boards = { closed: !Z.boardsOpen() }; api.config = { cheatsOnBoards: true }; out.boards.open = Z.boardsOpen(); delete api.config; run(1); tap("map"); run(.5); GAME.click(480, 270, api); run(.5); out.bigmap = { waypoint: !!Z.waypoint, err: Z.bigmap.err || "", hits: Z.bigmap.hits.length, open: Z.bigOpen() }; Z.bigmap.tap(480, 300); const gp = Z.places.gate; Z.bigmap.cx = gp.mx; Z.bigmap.cy = gp.my; GAME.draw(api); Z.bigmap.tap(480, 300); out.bigmap.card = !!Z.bigmap.sel && Z.bigmap.sel.id === "gate"; out.bigmap.info = Z.bigmap.info(gp).does.length > 4; GAME.draw(api); Z.bigmap.tap(60, 510); out.bigmap.routed = !!Z.waypoint && /Gate/.test(Z.waypoint.name || ""); { const BM = Z.bigmap, kt = Z.places.kt, sel = () => { BM.sel = kt; BM.cx = kt.mx; BM.cy = kt.my; GAME.draw(api); }, hit = (id) => BM.hits.filter((h) => h.id === id).pop(), mid = (h) => [h.x + h.w / 2, h.y + h.h / 2];
    Z.waypoint = null; sel(); let h = hit("route"); GAME.click(...mid(h), api); out.bigmap.routeClick = !!Z.waypoint && /Kainji/.test(Z.waypoint.name) && !BM.sel;
    Z.waypoint = null; sel(); h = hit("route"); BM.tap(...mid(h)); out.bigmap.routeTap = !!Z.waypoint && /Kainji/.test(Z.waypoint.name);
    sel(); h = hit("unsel"); GAME.click(...mid(h), api); out.bigmap.closeClick = !BM.sel; sel(); h = hit("unsel"); BM.tap(...mid(h)); out.bigmap.closeTap = !BM.sel;
    const sh0 = Z.places.stop_eng, at = Z.places.stop_gate; me.x = at.mx; me.y = at.my; BM.sel = sh0; BM.cx = sh0.mx; BM.cy = sh0.my; GAME.draw(api); h = hit("shuttle"); P.money = 1000; GAME.click(...mid(h), api); out.bigmap.shuttleClick = !!Z.travel.active && Z.travel.active.dest === sh0; run(30, () => { api._open = false; });
    Z.bigSet(true); GAME.draw(api); me.x = at.mx; me.y = at.my; BM.sel = sh0; GAME.draw(api); h = hit("shuttle"); BM.tap(...mid(h)); out.bigmap.shuttleTap = !!Z.travel.active; run(30, () => { api._open = false; }); Z.bigSet(true); GAME.draw(api);
    h = hit("close"); GAME.click(...mid(h), api); out.bigmap.xClick = !Z.bigOpen(); Z.bigSet(true); GAME.draw(api); h = hit("close"); BM.tap(...mid(h)); out.bigmap.xTap = !Z.bigOpen(); Z.bigSet(true); GAME.draw(api); }
  Z.bigmap.q = "kain"; GAME.draw(api); out.bigmap.search = Z.bigmap.results.length === 1 && Z.bigmap.results[0].id === "kt"; Z.bigmap.q = ""; Z.bigmap.off.food = true; GAME.draw(api); const k0 = Z.bigmap.k; Z.bigmap.zoom(1.5); out.bigmap.zoom = Z.bigmap.k > k0; Z.bigmap.off = {}; out.bigmap.cats = Z.placeList.every((q) => !!Z.bigmap.catOf(q)); out.bigmap.err = Z.bigmap.err || ""; Z.bigmap.close(); out.bigmap.closed = !Z.bigOpen(); run(.5);
  Z.save(); const back = Z.load(); out.saveOk = !!back && back.name === "Tester" && back.lvl === P.lvl;
  // a class, a date, a hangout
  P.time = 600; Z.ui.place(Z.places.ee); act("i0"); for (let q = 0; q < 5; q++) { const html = api._on; act("0"); } out.classes = P.stats.classes;
  // campus shuttle: a skipped trip and a ride-along both end at the stop, the fare is taken, and the bus drives off
  { const T = Z.travel, far = Z.places.p2park, g = Z.places.stop_gate, sh = { stops: T.stops().length }, god = P.god, shut = () => { api._open = false; }; P.god = false; // other systems may open a dialog mid-ride; the trip must not depend on that api._open = false; if (me.veh) Z.exit(true); me.x = g.mx; me.y = g.my; P.money = 1000;
    Z.ui.place(g); sh.menu = api._open && /Shuttle stop/.test(shown[shown.length - 1]); api._open = false;
    const len = T.path(me.x, me.y, far.mx, far.my).len; sh.km = Math.round(len / 100) / 10; sh.fare = T.fare(len); sh.keke = T.fare(len, true);
    const m0 = P.money; sh.started = T.go("p2park", { mode: "skip" }); sh.paid = m0 - P.money; run(25, shut); sh.skipArrived = !T.active && Math.hypot(me.x - far.mx, me.y - far.my) < 8 && !me.veh;
    const lib = Z.places.stop_library, dam = Z.places.stop_dam; me.x = lib.mx; me.y = lib.my; T.go("stop_dam", { mode: "ride" }); run(3, shut); sh.riding = !!T.active && me.veh === T.active.bus; sh.v3 = me.veh ? Math.round(me.veh.speed * 10) / 10 : -1; run(110, shut);
    sh.rideArrived = !T.active && Math.hypot(me.x - dam.mx, me.y - dam.my) < 8 && !me.veh; run(6, shut); sh.busGone = !Z.cars.some((c) => c.shuttle); P.money = 0; sh.broke = !T.go("stop_gate", { mode: "skip" }); P.god = god; out.shuttle = sh; }
  // the wild: walk out past the west fence. The ground stays continuous, the patrol warns twice, gives chase, and brings you back
  { const Wd = Z.wild, WW = Z.W, god = P.god, shut = () => { api._open = false; }, w = { stages: [], maxStep: 0, nan: 0, maxD: 0, maxH: 0, back: null }; P.god = false; api._open = false; if (me.veh) Z.exit(true); if (Wd.reset) Wd.reset(); Wd.last = "";
    me.x = -798; me.y = 40; P.energy = 100; P.hunger = 0; let ph = S.groundY(WW, me.x, me.y), px = me.x, py = me.y; keys.left = true;
    run(330, () => { shut(); const h = S.groundY(WW, me.x, me.y), mv = Math.hypot(me.x - px, me.y - py); if (!isFinite(h) || !isFinite(me.x) || !isFinite(me.y)) w.nan++; if (mv < 2) w.maxStep = Math.max(w.maxStep, Math.abs(h - ph)); ph = h; px = me.x; py = me.y; w.maxH = Math.max(w.maxH, h); w.maxD = Math.max(w.maxD, Wd.depth());
      if (Wd.last && w.stages[w.stages.length - 1] !== Wd.last) w.stages.push(Wd.last); if (w.back == null && /escorted|ko/.test(Wd.last)) { w.back = Math.round(Wd.depth()); keys.left = false; } });
    keys.left = false; w.home = Wd.depth() === 0 && !Wd.st; w.trucks = Z.cars.filter((c) => c.patrol).length; w.maxStep = +w.maxStep.toFixed(3); w.maxD = Math.round(w.maxD); w.maxH = Math.round(w.maxH); w.flatCampus = S.wildH(WW, 0, 0) === 0 && S.wildH(WW, 1500, 400) === 0 && S.wildH(WW, 600, 955) === 0;
    w.rocks = S.wildRocks(WW, -2400, 300).length + S.wildRocks(WW, 300, -3000).length + S.wildRocks(WW, 4000, 4000).length; w.same = S.wildH(WW, -1733.5, 412.25) === S.wildH(WW, -1733.5, 412.25) && S.wildH(WW, -1733.5, 412.25) > 0; P.god = god; out.wild = w; }
  out.frames = frames; out.level = P.lvl; out.toasts = toasts.length; out.banners = banners.length; out.ok = true;
} catch (e) { out.ok = false; out.error = String(e && e.stack || e).split("\n").slice(0, 6).join(" | "); }
Promise.all(pending).catch((e) => { out.ok = false; out.error = String(e); }).then(() => { console.log(JSON.stringify(out)); process.exit(out.ok ? 0 : 1); });
