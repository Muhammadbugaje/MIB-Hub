/* Freshers School Life: a headless soak. It boots the game exactly as samaru_harness.js does, then
     ride  — drives fast round the ring road and the boulevard and counts walkers/cars that appear in view or in
             the way, and how many walkers get run over;
     soak  — plays for a long while with random but sensible inputs and checks invariants every frame.
   Usage: node samaru_soak.js <static/js/games dir> [ride|soak|both] [minutes]. Prints one JSON object. */
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "samaru_harness.js"), "utf8"), cut = src.indexOf("const out = { log: [] }");
const mode = process.argv[3] || "both", minutes = +process.argv[4] || 0;
const boot = new Function("require", "process", "__dirname", "module", "exports", src.slice(0, cut) + "\nreturn { Z: Z, S: S, D: D, api: api, GAME: GAME, keys: keys, pressed: pressed, STEP: STEP, store: store };");
const { Z, S, D, api, GAME, keys, pressed, STEP } = boot(require, process, __dirname, module, exports);
if (process.env.NOBRAWL) Z.brawl = null; // the old behaviour, for a before/after comparison
let seed = 12345; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const out = { ok: true }, errs = [];
function frame() { GAME.update(STEP, api); api.t += STEP; __pump(STEP * 1000); for (const k in pressed) pressed[k] = false; }
function begin() { const p = S.newPlayer("amina", "Soak"); p.home = "amina"; api._open = false; Z.begin(p, true); if (Z.guide && Z.guide.skip) Z.guide.skip(); Z.P.xp = S.xpForLevel(14); S.addXp(Z.P, 0); Z.P.money = 50000; if (Z.momentClear) Z.momentClear(); Object.keys(Z.P.friends).length || D.NPCS.forEach((n) => { Z.P.friends[n.id] = 40; }); }
function fakeCam() { Z.r3 = { ready: true, yaw: 0, pitch: .3, manual: 0, render: () => false, turn: (d) => { Z.r3.yaw += d; }, project: () => null, puff: () => {}, setQuality: () => {} }; }
function addCar(type, x, y, a) { const c = { id: Z.cars.length, type: type, x: x, y: y, a: a || 0, vx: 0, vy: 0, speed: 0, col: "#fff", hx: x, hy: y, ha: a || 0, free: true }; Z.cars.push(c); return c; }

/* ---------- the fast ride ---------- */
function ride(mins) {
  begin(); fakeCam(); const W = Z.W, me = Z.me, P = Z.P, B = W.bounds, r = { minutes: mins, pedSpawns: 0, pedInView: 0, pedInPath: 0, pedOnRoad: 0, carSpawns: 0, carInView: 0, carInPath: 0, hits: 0, km: 0 };
  // a loop of drivable road: gate → fountain → out to the ring → round it → back
  const pts = ["gate", "senate", "ee", "strip", "physics", "akenzua", "gate"].map((id) => Z.places[id]).filter(Boolean); let line = [];
  for (let i = 0; i + 1 < pts.length; i++) { const seg = S.route(W, pts[i].mx, pts[i].my, pts[i + 1].mx, pts[i + 1].my, true); line = line.concat(line.length ? seg.slice(2) : seg); }
  const car = addCar("car", line[0], line[1], 0); me.x = car.x; me.y = car.y; Z.enter(car); const speed = 22;
  const off0 = Z.offend; Z.offend = function (k) { if (k === "hitPed") r.hits++; return off0 ? off0.apply(Z, arguments) : null; };
  const seenP = new Set(), seenC = new Set(); let i = 2, t = 0; const total = mins * 60;
  function ahead(o, a) { const dx = o.x - car.x, dy = o.y - car.y, d = Math.hypot(dx, dy), fw = dx * Math.cos(a) + dy * Math.sin(a), sd = Math.abs(dy * Math.cos(a) - dx * Math.sin(a)); return { d: d, view: d < 130 && fw / (d || 1) > .25 && S.los(W, car.x, car.y, o.x, o.y), path: fw > 0 && fw < Math.max(40, speed * 6) && sd < 6 }; }
  while (t < total) {
    if (i >= line.length) i = 2; const dx = line[i] - car.x, dy = line[i + 1] - car.y, d = Math.hypot(dx, dy); if (d < 2) { i += 2; continue; }
    const a = Math.atan2(dy, dx), st = Math.min(d, speed * STEP); car.a = a; car.x += dx / d * st; car.y += dy / d * st; car.vx = Math.cos(a) * speed; car.vy = Math.sin(a) * speed; car.speed = speed; me.x = car.x; me.y = car.y; me.a = a; Z.r3.yaw = a; P.time = 600; P.hp = P.maxHp; me.fall = 0; if (!me.veh) { me.veh = car; } Z.callOff && Z.callOff(); r.km += st / 1000;
    for (let k = Z.traffic.length - 1; k >= 0; k--) { const q = Z.traffic[k], fx = (q.x - car.x) * Math.cos(a) + (q.y - car.y) * Math.sin(a); if (Math.hypot(q.x - car.x, q.y - car.y) < 14 && fx > -4) Z.traffic.splice(k, 1); } // this ride measures walkers: nothing may hold the car up
    const ix = car.x, iy = car.y; frame(); t += STEP; car.x = ix; car.y = iy; // the ride follows its line whatever the physics says
    for (const n of Z.peds) if (!seenP.has(n)) { seenP.add(n); r.pedSpawns++; const q = ahead(n, a); if (q.view) r.pedInView++; if (q.path) r.pedInPath++; const nr = S.nearRoad(W, n.x, n.y, 12, true); if (nr && nr.d < nr.r.w / 2 - .3) r.pedOnRoad++; }
    for (const n of Z.traffic) if (!seenC.has(n)) { seenC.add(n); r.carSpawns++; const q = ahead(n, a); if (q.d < 250 && q.view) r.carInView++; if (q.path) r.carInPath++; }
  }
  Z.offend = off0; r.km = +r.km.toFixed(1); if (me.veh) Z.exit(true); return r;
}

/* ---------- the long play ---------- */
function soak(mins) {
  begin(); fakeCam(); const W = Z.W, me = Z.me, P = Z.P, total = mins * 60, bad = {}, note = (k, v) => { const e = bad[k] || (bad[k] = { n: 0, eg: v }); e.n++; };
  const ids = new WeakMap(); let idn = 0; const uid = (o) => { if (!ids.has(o)) ids.set(o, ++idn); return ids.get(o); };
  const track = new Map(); let pairs = new Set(), later = []; const setTimeout0 = (f) => later.push(f); let tries = 0, t = 0, plan = null, planT = 0, stillT = 0, lx = me.x, ly = me.y, phase = 0; const vehs = ["bike", "okada", "keke", "car", "scooter", "skate"];
  const downed = (o) => o.fall > 0 && !o.kv && !(o.air > 0);
  function check() {
    const all = [["ped", Z.peds], ["npc", Z.npcs.filter((n) => !n.hidden)], ["guard", Z.guards], ["foe", Z.foes], ["traffic", Z.traffic]];
    if (!isFinite(me.x + me.y + me.a)) note("player NaN", [me.x, me.y]); if (!isFinite(P.hp + P.energy + P.hunger + P.money)) note("stat NaN", [P.hp, P.energy, P.hunger]);
    if (!me.veh && me.alt < .05 && !Z.inside && me.y < 3000 && S.insideBuilding(W, me.x, me.y)) note("player inside a building", [Math.round(me.x), Math.round(me.y)]);
    // sinking: nobody below the ground
    for (const o of Z.peds.concat(Z.npcs)) if ((o.air != null && o.air < -.01) || (o.z != null && o.z < -.01 && !o.sitIn)) note("below the ground", [o.id || "walker", o.air, o.z]);
    // clipping: two standing bodies in the same spot, or one standing inside you (scenes and riders excepted)
    if (Math.round(t * 120) % 60 === 0) { const nowPairs = new Set(); setTimeout0(() => { pairs = nowPairs; }); const body = Z.peds.filter((o) => !o.fall && !o.scene && !(o.dodge > 0)).concat(Z.npcs.filter((o) => !o.hidden && !o.riding && !o.onBike && !o.fall && o.y < 3000)); for (let a = 0; a < body.length; a++) { if (!me.veh && !Z.inside && Math.hypot(body[a].x - me.x, body[a].y - me.y) < .25) { const qa = track.get(body[a]) || {}; if (qa.inMe) note("standing inside the player", [body[a].id || "walker"]); qa.inMe = 1; track.set(body[a], qa); } else { const qa = track.get(body[a]); if (qa) qa.inMe = 0; } for (let b = a + 1; b < body.length; b++) if (Math.hypot(body[a].x - body[b].x, body[a].y - body[b].y) < .2 && (body[a].spd || 0) + (body[b].spd || 0) > .5) { const key = uid(body[a]) + ":" + uid(body[b]); if (pairs.has(key)) note("walking through each other", [body[a].id || "walker", body[b].id || "walker"]); nowPairs.add(key); } } }
    // friends walking with you keep up, and climb on when there is a seat
    if (Z.friends && !Z.inside) for (const f of Z.friends.companions()) { const fq = track.get(f) || {}; const d = Math.hypot(f.x - me.x, f.y - me.y); if (!me.veh && d > 15) { fq.far = (fq.far || 0) + STEP; if (fq.far > 10) { note("friend fell behind", [f.id, Math.round(d)]); fq.far = 0; } } else fq.far = 0;
      if (me.veh && me.alt < .05 && (S.VEH[me.veh.type].seats || 0) > 0 && !f.riding && !f.onBike) { fq.board = (fq.board || 0) + STEP; if (fq.board > 8) { note("friend did not get on", [f.id, me.veh.type, Math.round(d)]); fq.board = 0; } } else fq.board = 0; track.set(f, fq); }
    for (const [kind, list] of all) for (const o of list) {
      if (!isFinite(o.x + o.y + (o.a || 0))) { note(kind + " NaN", o.id || o.type || ""); continue; }
      if (kind !== "traffic" && kind !== "foe" && o.y < 3000 && S.insideBuilding(W, o.x, o.y)) /* interiors are laid out 6 km south, inside their own walls */ note(kind + " inside a building", [o.id || "", Math.round(o.x), Math.round(o.y)]);
      let q = track.get(o); if (!q) { q = { x: o.x, y: o.y, px: o.x, py: o.y, still: 0, down: 0 }; track.set(o, q); }
      const mv = Math.hypot(o.x - q.px, o.y - q.py); q.px = o.x; q.py = o.y; q.age = (q.age || 0) + STEP;
      if ((kind === "ped" || kind === "npc" || kind === "guard") && downed(o)) { q.down += STEP; if (q.down > .7 && mv > .004) note(kind + " moving while down", o.id || ""); } else q.down = 0;
      if (kind === "ped" && !o.fall && !(o.wave > 0) && !o.hold && !o.busy && !o.cr && !(o.scene && o.act !== "group" && o.act !== "jog")) { /* chatting circles, queues, sellers and people on their phones stand still on purpose */ if (Math.hypot(o.x - q.x, o.y - q.y) > 1.5) { q.x = o.x; q.y = o.y; q.still = 0; } else if ((q.still += STEP) > 20) { note("walker stuck 20 s", [Math.round(o.x), Math.round(o.y), o.st || "", "lead " + Math.hypot(o.w.x - o.x, o.w.y - o.y).toFixed(1), "side " + (o.side || 0).toFixed(1), "road " + o.w.road, o.onRoad ? "on road" : "off road", S.insideBuilding(W, o.w.x, o.w.y) ? "target in building" : "", "dPlayer " + Math.round(Math.hypot(o.x - me.x, o.y - me.y))]); q.still = 0; } }
      if (kind === "traffic" && !(o.ghost > 0)) for (const p2 of Z.traffic) if (p2 !== o && !(p2.ghost > 0) && Math.hypot(p2.x - o.x, p2.y - o.y) < 1.2) note("traffic overlapping", [Math.round(o.x), Math.round(o.y), o.type, p2.type, "v " + o.v.toFixed(1) + "/" + p2.v.toFixed(1), "da " + S.angDiff(o.a, p2.a).toFixed(1), "roads " + o.w.road + "/" + p2.w.road, "age " + ((track.get(o) || {}).age || 0).toFixed(0) + "/" + ((track.get(p2) || {}).age || 0).toFixed(0)]);
    }
  }
  function newPlan() {
    phase++; if (me.fall > 50) return; api._open = false; for (const k in keys) keys[k] = false; const roll = rnd();
    if (roll < .08) P.time = (P.time + 360) % 1440; // jump the clock: day and night both get played
    if (phase % 7 === 0) P.time = (Math.floor(phase / 7) * 150 + 360) % 1440; /* and a steady sweep through every hour */
    if (me.veh && rnd() < .5) { me.veh.vx = me.veh.vy = 0; me.veh.speed = 0; Z.exit(true); }
    const kind = roll < .3 ? "walk" : roll < .5 ? "sprint" : roll < .68 ? "ride" : roll < .78 ? "fight" : roll < .86 ? "place" : roll < .93 ? "friend" : "idle";
    plan = { kind: kind, t: 6 + rnd() * 14, dir: Math.floor(rnd() * 4) }; planT = 0;
    if (kind === "ride" && !me.veh) { const road = S.nearRoad(W, me.x, me.y, 300, true); if (road) { const c = addCar(vehs[Math.floor(rnd() * vehs.length)], road.x, road.y, 0); me.x = c.x; me.y = c.y; Z.enter(c); } }
    if (kind === "place") { const pl = Z.placeList[Math.floor(rnd() * Z.placeList.length)]; if (me.veh) { me.veh.x = pl.mx; me.veh.y = pl.my; me.veh.vx = me.veh.vy = 0; me.veh.speed = 0; Z.exit(true); } me.x = pl.mx; me.y = pl.my; try { Z.ui.place(pl); } catch (e) { errs.push("place " + pl.id + ": " + e.message); } api._open = false; plan.t = 2; }
    if (kind === "friend") { const n = Z.npc(["ada", "yakubu", "sadiq", "fatima"][Math.floor(rnd() * 4)]); if (n && Z.friends) { if (n.follow) Z.friends.release(n); else { n.x = me.x + 2; n.y = me.y + 1; Z.friends.follow(n, 120); } } }
    if (kind === "fight") plan.t = 10;
  }
  while (t < total) {
    if (!plan || planT > plan.t) newPlan();
    planT += STEP; const k = plan.kind, d = ["up", "right", "down", "left"][plan.dir];
    if (k === "walk" || k === "sprint" || k === "ride" || k === "fight" || k === "friend") { keys[d] = true; keys.run = k === "sprint"; if (rnd() < .004) { keys[d] = false; plan.dir = Math.floor(rnd() * 4); } if (rnd() < .003) pressed.jump = true; }
    if (k === "fight" && !me.veh) { if (rnd() < .05) pressed.attack = true; if (rnd() < .02) pressed.kick = true; keys.block = rnd() < .3 ? !keys.block : keys.block; }
    if (rnd() < .0008) pressed.act = true; if (rnd() < .0004) pressed.horn = true; if (rnd() < .0004) pressed.radio = true;
    try { frame(); } catch (e) { errs.push(String(e && e.stack || e).split("\n").slice(0, 3).join(" | ")); if (errs.length > 5) break; }
    if (api._open) api._open = false; // menus the random keys open are closed again
    if (t % .5 < STEP && Z.friends && Z.friends.act && rnd() < .5) { try { Z.friends.act(); } catch (e) { errs.push("friends.act " + e.message); } }
    t += STEP; check(); while (later.length) later.shift()();
    // the player must always be able to move within 5 s of asking
    const want = keys.up || keys.down || keys.left || keys.right; const moved = Math.hypot(me.x - lx, me.y - ly);
    if (want && me.fall < 50 && Z.mode === "play") { if (moved > .6) { lx = me.x; ly = me.y; stillT = 0; } else if ((stillT += STEP) > 1.25) { stillT = 0; tries++; keys[["up", "right", "down", "left"][plan.dir]] = false; plan.dir = (plan.dir + 1) % 4; if (tries >= 4) { note("player cannot move for 5 s", [Math.round(me.x), Math.round(me.y), me.veh ? me.veh.type : "foot", me.fall, plan.kind, me.veh ? "speed " + me.veh.speed.toFixed(1) : ""]); tries = 0; if (me.veh) { me.veh.vx = me.veh.vy = 0; me.veh.speed = 0; Z.exit(true); } } } if (moved > .6) tries = 0; } else { stillT = 0; lx = me.x; ly = me.y; }
  }
  return { minutes: mins, plans: phase, problems: bad, errors: errs.slice(0, 6), peds: Z.peds.length, cars: Z.traffic.length };
}

/* ---------- the living city: incidents start at a sane rate, every one ends, none while you are busy ---------- */
function city(mins) {
  begin(); fakeCam(); const W = Z.W, me = Z.me, P = Z.P, C = Z.city, r = { minutes: mins, started: {}, ended: {}, byYou: 0, longest: 0, stuck: 0, movedDown: 0, busyStarts: 0, rumours: 0, heard: 0 };
  const evs = []; const emit0 = Z.emit; Z.emit = function (ev) { if (ev && ev.t === "crime") evs.push({ k: ev.kind, p: ev.phase, by: ev.by || "", t: api.t }); return emit0.apply(Z, arguments); };
  // stroll round the centre, all day and night: a friend with you so gossip has somewhere to go
  const q0 = S.nearRoad(W, Z.places.senate.mx, Z.places.senate.my, 200), w = S.wanderStart(W, Math.random, { x: q0.x, y: q0.y, r: q0.r }, false); S.wanderStep(W, w, 0, Math.random, q0.r.w / 2 + 1.5); me.x = w.x; me.y = w.y;
  const fr = Z.npc("ada") || Z.npcs.find((n) => Z.friends.isFriend(n)); if (fr) { P.friends[fr.id] = 60; fr.x = me.x + 2; fr.y = me.y; Z.friends.follow(fr, 1e5); }
  let t = 0, open = new Map(); const total = mins * 60, prev = new Map();
  while (t < total) {
    P.time = (600 + t * 2) % 1440; P.hp = P.maxHp; P.energy = 100; P.hunger = 100; Z.callOff();
    S.wanderStep(W, w, 1.6 * STEP, Math.random, q0.r.w / 2 + 1.5); const n0 = S.push(W, w.x, w.y, .45); me.a = Math.atan2(n0.y - me.y, n0.x - me.x); me.x = n0.x; me.y = n0.y; me.speed = 1.6;
    frame(); t += STEP; if (api._open) api._open = false;
    const I = C.incident(); if (I) { if (!open.has(I.id)) open.set(I.id, t); r.longest = Math.max(r.longest, t - open.get(I.id)); [I.thief, I.victim, I.a, I.b].concat(I.chasers || []).forEach((n) => { if (!n || Z.traffic.includes(n)) return; const q = prev.get(n), landed = n.fall > 0 && !n.kv; if (q && landed && q.landed && Math.hypot(n.x - q.x, n.y - q.y) > .004) r.movedDown++; prev.set(n, { x: n.x, y: n.y, landed: landed }); }); }
  }
  evs.forEach((e) => { if (e.p === "start") r.started[e.k] = (r.started[e.k] || 0) + 1; else if (e.p !== "filmed") { r.ended[e.p] = (r.ended[e.p] || 0) + 1; if (e.by === "you") r.byYou++; } });
  r.total = evs.filter((e) => e.p === "start").length; r.finished = evs.filter((e) => /caught|escaped|settled|fizzled/.test(e.p)).length; r.rumours = C.rumours().length; r.heard = Object.keys(C.state().heard).length; r.longest = Math.round(r.longest);
  // busy: on a job nothing starts
  const evs2 = evs.length; P.job = { kind: "errand", a: { x: me.x, y: me.y, name: "A" }, b: { x: me.x + 500, y: me.y, name: "B" }, stage: 0, pay: 100, xp: 1, time: 0, limit: 0, what: "x" }; C.reset(); C.setGap(0); let t2 = 0; while (t2 < 300) { P.time = 1260; frame(); t2 += STEP; } r.busyStarts = evs.slice(evs2).filter((e) => e.p === "start").length; P.job = null;
  // you stop a thief yourself
  C.reset(); Z.peds.length = 0; for (let k = 0; k < 6000 && !C.incident(); k++) { P.time = 720; frame(); if (k % 60 === 0 && Z.peds.length > 8 && !C.incident()) C.start("snatch"); }
  const I = C.incident(); let caught = ""; const cash0 = P.money, trail = []; if (I && I.thief) { for (let k = 0; k < 3000 && C.incident() === I && !/caught|escaped|fizzled/.test(I.st); k++) { const th = I.thief; if (I.st === "flee") { if (!trail.length) { const nb = S.push(W, th.x - Math.cos(th.a) * 6, th.y - Math.sin(th.a) * 6, .45); me.x = nb.x; me.y = nb.y; } trail.push({ x: th.x, y: th.y }); const d = Math.hypot(th.x - me.x, th.y - me.y); if (d > 1.4) { while (trail.length > 1 && Math.hypot(trail[0].x - me.x, trail[0].y - me.y) < 1) trail.shift(); const g = S.los(W, me.x, me.y, th.x, th.y) ? th : trail[0]; me.a = Math.atan2(g.y - me.y, g.x - me.x); const nx = S.push(W, me.x + Math.cos(me.a) * S.FOOT.run * STEP, me.y + Math.sin(me.a) * S.FOOT.run * STEP, .45); me.x = nx.x; me.y = nx.y; me.speed = S.FOOT.run; } else { me.a = Math.atan2(th.y - me.y, th.x - me.x); me.speed = 0; me.cool = 0; Z.brawl.strike(false, "punch"); } } /* you run the way they ran */ frame(); } caught = I.st + ":" + evs.filter((e) => e.p === "caught").map((e) => e.by).slice(-1)[0]; }
  r.youCatch = { kind: I ? I.kind : "", result: caught, paid: P.money - cash0 };
  Z.emit = emit0; return r;
}

try { if (mode === "city") out.city = city(minutes || 30); if (mode === "ride" || mode === "both") out.ride = ride(minutes || 5); if (mode === "soak" || mode === "both") out.soak = soak(minutes || 30); } catch (e) { out.ok = false; out.error = String(e && e.stack || e).split("\n").slice(0, 5).join(" | "); }
console.log(JSON.stringify(out));
process.exit(0);
