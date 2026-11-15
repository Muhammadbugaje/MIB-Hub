/* Headless checks for Freshers School Life student life: creator choices, timetable, lectures, migration.
   Usage: node samaru_life_harness.js <static/js/games dir>. Prints one JSON object. */
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
const Z = global.SamaruGame, S = global.SamaruSim, D = global.SamaruData;
const STEP = 1 / 60;
function run(sec, each) { for (let i = 0; i < sec * 60; i++) { if (each) each(i); GAME.update(STEP, api); api.t += STEP; for (const k in pressed) pressed[k] = false; if (i % 3 === 0) GAME.draw(api); } }
function tap(k) { pressed[k] = true; }
function run(sec) { for (let i = 0; i < sec * 60; i++) { GAME.update(STEP, api); api.t += STEP; for (const k in pressed) pressed[k] = false; if (i % 3 === 0) GAME.draw(api); } }
function act(a) { const on = api._on; if (!on) throw new Error("no dialog open for " + a); on(a, { disabled: false, getAttribute: () => a, style: {}, classList: { add: noop } }); }
const out = {};
try {
  const L = Z.life; L.delay = 0; run(.3);
  // creator: sex filters the hostels, and the choices land on the new student
  api._on("new"); const first = api._html; act("x:f"); const fem = api._html; act("x:m"); const mal = api._html;
  const names = (sex) => L.hostels(sex).map((h) => h.name);
  out.hostelsF = names("f"); out.hostelsM = names("m");
  const onlyM = out.hostelsM.filter((n) => !out.hostelsF.includes(n)), onlyF = out.hostelsF.filter((n) => !out.hostelsM.includes(n));
  out.filterF = out.hostelsF.every((n) => fem.includes(n)) && onlyM.length > 0 && onlyM.every((n) => !fem.includes(">" + n));
  out.filterM = out.hostelsM.every((n) => mal.includes(n)) && onlyF.length > 0 && onlyF.every((n) => !mal.includes(">" + n));
  out.creatorHasRows = /Department/.test(first) && /Faith/.test(first) && /100 level/.test(first);
  act("x:f"); act("d:civil"); act("f:muslim"); const home = L.hostels("f")[0].id; act("h:" + home); act("go");
  let P = Z.P; out.created = { sex: P.life.sex, dept: P.life.dept, faith: P.life.faith, acad: P.life.acad, home: P.home === home };
  const hp = Z.places[home]; out.startsAtGate = Math.hypot(Z.me.x - Z.places.gate.mx, Z.me.y - Z.places.gate.my) < 30; out.m1 = D.MISSIONS[0].steps.map((s) => s.t + ":" + (s.place || s.npc)); out.count = D.MISSIONS.filter((m) => /^m\d+$/.test(m.id)).length;
  Z.save(); const back = Z.load(); out.persist = back.life.dept === "civil" && back.life.faith === "muslim" && back.life.sex === "f";
  out.deptPlace = !!Z.place("@dept"); out.deptText = (D.MISSIONS[0].steps.find((s) => s.place === "@dept") || {}).text;
  // every department and level gives a full week of resolvable entries
  let bad = 0, perDay = []; L.DEPTS.forEach((d) => [100, 200, 300, 400, 500].forEach((a) => { const q = S.newPlayer("tunde", "T"); q.life = { dept: d.id, acad: a, faith: "christian" }; const sv = Z.P; Z.P = q; L.week(q).forEach((day, i) => { const cl = day.filter((e) => e.kind === "class"); if (i < 5) { perDay.push(cl.length); if (cl.some((e) => e.start < 480 || e.end > 1080)) bad++; } else if (cl.length) bad++; day.forEach((e) => { if (!L.resolve(e.place)) bad++; }); for (let k = 1; k < cl.length; k++) if (cl[k].start < cl[k - 1].end) bad++; }); Z.P = sv; }));
  out.weekBad = bad; out.minClasses = Math.min(...perDay); out.maxClasses = Math.max(...perDay);
  // a simulated Monday (day 1), visiting each entry in order
  api._open = false; const today = L.today(P), order = [], me = Z.me; out.todayKinds = today.map((e) => e.kind);
  out.prayerToday = today.some((e) => e.kind === "prayer"); let xp0 = P.xp;
  for (const e of today) {
    const n = L.next(); order.push(n && !n.tomorrow ? n.i : -1); if (e.kind === "sleep") break;
    const pl = Z.places[L.resolve(e.place)]; P.time = Math.max(P.time, e.start - 5); me.x = pl.mx; me.y = pl.my + 4; P.energy = 90; P.hunger = 90;
    if (e.kind === "class") {
      out.attending = out.attending || !!L.attending(pl.id); const items = []; L.placeItems(pl, items); if (!items[0] || items[0].act !== "lecture") throw new Error("no lecture row at " + pl.id);
      L.lecture(pl, items[0].entry); out.hallShown = out.hallShown || /data-hall/.test(api._html); act("s0"); let guard = 0; while (/Keep listening|Any questions/.test(api._html) && guard++ < 9) act("n");
      out.asked = (out.asked || 0) + 1; guard = 0; while (/Question \d of/.test(api._html) && guard++ < 9) act("0"); out.summary = /attendance/.test(api._html); act("ok"); api._open = false;
    } else { run(1.2); }
  }
  out.order = order; out.inOrder = order.every((v, i) => v === i); out.allDone = today.every((e) => e.kind === "sleep" || P.life.done.k[e.i]);
  out.att = P.life.att; out.streak = P.life.streak; out.classesToday = today.filter((e) => e.kind === "class").length; out.xpGained = P.xp > xp0; out.statClasses = P.stats.classes;
  out.nextIsSleep = (L.next() || {}).kind === "sleep"; P.life.follow = 1; const tg = Z.target(), hm = Z.place("@home"); out.followLeadsHome = !!tg && Math.hypot(tg.x - hm.mx, tg.y - hm.my) < 1;
  const d0 = P.day; Z.sleep(); out.newDay = P.day === d0 + 1 && Object.keys(P.life.done.k).length === 0 && !P.life.follow; api._open = false;
  // missing a class costs only the streak
  const t2 = L.today(P), c2 = t2.find((e) => e.kind === "class"); me.x = hm.mx; me.y = hm.my; P.time = c2.end - 5; run(1.2); out.missed = (P.life.missed === 1 && P.life.streak === 0 && toasts.some((t) => /You missed/.test(t))) || (!!P.life.done.miss[c2.i] && toasts.some((t) => /went on without you/.test(t))); // the jobs system may excuse it out.missedWhy = [P.life.missed, P.life.streak, toasts.slice(-3), Z.mode, P.day, c2.dow, L.dow(P), Object.keys(P.life.done.miss)];
  // promotion with the story
  for (let i = 1; i <= 8; i++) P.m.done["m" + i] = 1; run(1.2); out.promoted = P.life.acad; out.newCourses = L.today(P, 1).concat(L.today(P, 2)).some((e) => e.course && /2\d\d/.test(e.course.code));
  // ---- walk-in interiors: logical rooms that work without the 3D view ----
  {
    const I = Z.interior, io = {}; out.interior = io; I.fast = 30; api._open = false;
    const q = S.newPlayer("tunde", "Inside"); q.home = L.hostels("m")[0].id; q.life = { sex: "m", dept: "elect", faith: "none", acad: 100 }; q.guide = { s: 99, done: 1, hints: {} }; Z.begin(q, true); P = Z.P; api._open = false; run(.3);
    io.types = {}; Z.placeList.forEach((pl) => { const t = I.typeOf(pl); if (t) io.types[t] = (io.types[t] || 0) + 1; });
    const cls = L.today(P).find((e) => e.kind === "class" && I.typeOf(Z.places[L.resolve(e.place)]) === "theatre") || L.week(P).flat().find((e) => e.kind === "class" && I.typeOf(Z.places[L.resolve(e.place)]) === "theatre");
    while (L.dow(P) !== cls.dow) { P.day++; } P.time = cls.start - 5; run(.2);
    const hall = Z.places[L.resolve(cls.place)]; me.x = hall.mx + 1; me.y = hall.my + 1; const ox = me.x, oy = me.y; run(.2);
    io.promptOutside = /^Enter /.test(Z.prompt()); pressed.act = true; run(.6); io.entered = !!Z.inside && Z.inside.type === "theatre"; io.noMenuAtDoor = !api._open;
    const c = Z.inside; io.farAway = Math.abs(me.y - oy) > 3000; const far = S.push(Z.W, me.x + 500, me.y + 500, .4); io.walls = Math.abs(far.x - c.ox) <= c.room.w / 2 && far.y - c.oy <= c.room.d; io.camWall = !!S.insideBuilding(Z.W, c.ox + 400, c.oy) && !S.insideBuilding(Z.W, c.ox, c.oy + 3);
    io.crowd = c.room.crowd.length; io.seats = c.room.seats.length; io.pedsCleared = Z.peds.length === 0;
    const seat = c.room.spots.find((s) => s.k === "seat" && s.row === 2); me.x = c.ox + seat.x; me.y = c.oy + seat.y; run(.1); io.seatPrompt = Z.prompt(); pressed.act = true; run(.2);
    io.sat = !!me.sit && me.z > 0; io.lecture = !!I.lec; let guard = 0, asked = 0, painted = 0;
    while (I.lec && guard++ < 400) { run(.1); try { I.boardPaint(api.x, 1024, 320, I.lec, {}); painted++; } catch (e) { io.paintErr = String(e); } if (I.lec && I.lec.phase === "ask" && !I.lec.open) { io.raisePrompt = Z.prompt(); pressed.act = true; run(.05); } if (api._open && I.lec && I.lec.open) { asked++; act("0"); } else if (api._open && /attendance/.test(api._html)) { io.summary = true; act("ok"); api._open = false; } }
    io.asked = asked; io.painted = painted > 5; io.lectureDone = !I.lec && P.life.att === 1 && !!P.life.done.k[cls.i]; io.stoodUp = !me.sit;
    const ex = c.room.spots.find((s) => s.k === "exit"); me.x = c.ox + ex.x; me.y = c.oy + ex.y; run(.1); pressed.act = true; run(.7); io.left = !Z.inside && Math.hypot(me.x - ox, me.y - oy) < 2;
    // hostel room: the bed opens the hostel menu; a save made inside keeps your outside position
    const home = Z.places[P.home]; me.x = home.mx; me.y = home.my; run(.2); I.enter(home); run(.6); for (let wq = 0; !Z.inside && wq < 80; wq++) { if (Z.momentClear) Z.momentClear(); if (Z.mini && Z.mini.close) Z.mini.close(); api._open = false; run(.2); } io.hostel = !!Z.inside && Z.inside.type === "hostel"; Z.save(); const sv = Z.load(); io.saveOutside = Math.abs(sv.y - home.my) < 5;
    const c2 = Z.inside, bed = c2.room.spots.find((s) => s.label === "Your bed"); me.x = c2.ox + bed.x; me.y = c2.oy + bed.y; run(.1); pressed.act = true; run(.2); io.bedMenu = api._open && /Sleep until/.test(api._html); api._open = false;
    const tok = c2.room.spots.find((s) => s.k === "token"), m0 = P.money; me.x = c2.ox + tok.x; me.y = c2.oy + tok.y; run(.1); I.act(); I.act(); io.tokenOnce = P.money === m0 + 200; I.leaveNow();
    // library: quiet rule and the hidden room
    const lib = Z.places.library; me.x = lib.mx; me.y = lib.my; const eLib = I.enter(lib); run(.6); for (let wq = 0; !Z.inside && wq < 80; wq++) { if (Z.momentClear) Z.momentClear(); if (Z.mini && Z.mini.close) Z.mini.close(); api._open = false; run(.2); } for (let wq = 0; !Z.inside && wq < 80; wq++) { if (Z.momentClear) Z.momentClear(); if (Z.mini && Z.mini.close) Z.mini.close(); api._open = false; run(.2); } if (!Z.inside) throw new Error("library entry failed: " + JSON.stringify([eLib, I.typeOf(lib), !!I.cur, !!I.trans, me.veh ? 1 : 0, me.fall, me.alt, P.time, toasts.slice(-2)])); const c3 = Z.inside, sec = c3.room.spots.find((s) => s.k === "secret"), pq = c3.room.spots.find((s) => s.k === "plaque");
    me.x = c3.ox + pq.x; me.y = c3.oy + pq.y; const blocked = S.push(Z.W, me.x, me.y, .4); io.secretShut = Math.hypot(blocked.x - me.x, blocked.y - me.y) > 1; me.x = c3.ox + sec.x; me.y = c3.oy + sec.y; run(.1); I.act(); io.secretOpen = c3.open; const free = S.push(Z.W, c3.ox + pq.x, c3.oy + pq.y, .4); io.secretReach = Math.hypot(free.x - c3.ox - pq.x, free.y - c3.oy - pq.y) < .01;
    me.cs = 8; I.update(.1); io.shush = toasts.some((t) => /Shhh/.test(t)); I.leaveNow();
    io.every = Z.placeList.filter((pl) => I.typeOf(pl)).every((pl) => { const r = I.build(pl); return r && r.spots.some((s) => s.k === "exit") && r.spots.every((s) => { const cc = { room: r, ox: 0, oy: 0, open: true }; return true; }); });
    { // every room type, three times round: in, move about, out; plus the ways of getting stuck
      const lp = {}; io.loop = lp; const seen = {}; Z.placeList.forEach((pl) => { const t = I.typeOf(pl); if (t && !seen[t]) seen[t] = pl; }); let bad = [];
      const walkOut = () => { const c = Z.inside, ex = c.room.spots.find((s) => s.k === "exit"); me.x = c.ox + ex.x; me.y = c.oy + ex.y; run(.1); pressed.act = true; run(.7); };
      Object.keys(seen).forEach((t) => { const pl = seen[t]; for (let k = 0; k < 3; k++) { api._open = false; P.time = t === "dance" ? 1200 : 660; if (Z.mini && Z.mini.close) Z.mini.close(); if (Z.momentClear) Z.momentClear(); for (let an = 0; an < 12; an++) { const pt = S.push(Z.W, pl.mx + Math.cos(an * .7) * (1 + an * .45), pl.my + Math.sin(an * .7) * (1 + an * .45), .5); me.x = pt.x; me.y = pt.y; run(.1); if (/^Enter /.test(Z.prompt())) break; } const x0 = me.x, y0 = me.y; pressed.act = true; run(.6); if (!Z.inside || Z.inside.type !== t) { bad.push(t + " in " + k); if (Z.inside) I.leaveNow(); continue; }
          const c = Z.inside, a0 = { x: me.x, y: me.y }; keys.up = true; run(1); keys.up = false; keys.left = true; run(.6); keys.left = false; if (Math.hypot(me.x - a0.x, me.y - a0.y) < .5) bad.push(t + " cannot move"); if (!S.insideBuilding || S.insideBuilding(Z.W, me.x, me.y)) bad.push(t + " in wall");
          walkOut(); if (Z.inside || Math.hypot(me.x - x0, me.y - y0) > 2) { bad.push(t + " out " + k); I.leaveNow(); } } });
      lp.types = Object.keys(seen).length; lp.bad = bad;
      // leave in the middle of a lecture
      const th = Z.places[L.resolve(cls.place)]; P.day += 7; P.life.done = null; L.ensure(P); P.time = cls.start - 5; const att0 = P.life.att; me.x = th.mx; me.y = th.my; run(.2); I.enter(th); run(.6); for (let wq = 0; !Z.inside && wq < 80; wq++) { if (Z.momentClear) Z.momentClear(); if (Z.mini && Z.mini.close) Z.mini.close(); api._open = false; run(.2); } let cc = Z.inside, st = cc.room.spots.find((s) => s.k === "seat" && s.row === 1); me.x = cc.ox + st.x; me.y = cc.oy + st.y; run(.1); pressed.act = true; run(.3);
      lp.midStarted = !!I.lec; keys.left = true; run(.6); keys.left = false; lp.midLeft = !I.lec && !me.sit && P.life.att === att0; walkOut(); lp.midOut = !Z.inside;
      // nobody raises a hand: the lecture still ends by itself
      P.time = cls.start - 5; I.enter(th); run(.6); for (let wq = 0; !Z.inside && wq < 80; wq++) { if (Z.momentClear) Z.momentClear(); if (Z.mini && Z.mini.close) Z.mini.close(); api._open = false; run(.2); } cc = Z.inside; me.x = cc.ox + st.x; me.y = cc.oy + st.y; run(.1); pressed.act = true; run(.3); I.fast = 40; let g2 = 0; while (I.lec && !(api._open && /attendance/.test(api._html)) && g2++ < 300) run(.1); lp.selfEnds = api._open && /0 \/ 3/.test(api._html); if (api._open) act("ok"); api._open = false; I.fast = 30; run(.2); lp.selfFree = !I.lec && !me.sit; walkOut();
      // moved out by something else (shuttle, phone call, mission): tidy up and stay where you were put
      I.enter(th); run(.6); for (let wq = 0; !Z.inside && wq < 80; wq++) { if (Z.momentClear) Z.momentClear(); if (Z.mini && Z.mini.close) Z.mini.close(); api._open = false; run(.2); } me.x = 10; me.y = -300; run(.2); lp.teleport = !Z.inside && Math.abs(me.y + 300) < 30;
      // stranded in interior space with no room: brought home
      me.x = -533; me.y = 6022; run(.2); lp.stranded = me.y < 3000;
      // out of bounds or wedged while pushing: back to the door
      I.enter(th); run(.6); for (let wq = 0; !Z.inside && wq < 80; wq++) { if (Z.momentClear) Z.momentClear(); if (Z.mini && Z.mini.close) Z.mini.close(); api._open = false; run(.2); } cc = Z.inside; me.y = cc.oy + 900; run(.1); lp.oob = Math.abs(me.y - cc.oy - 2.4) < 1.5; const tv = cc.room.solids[0]; cc.room.solids.push({ x0: -50, y0: 0, x1: 50, y1: 60 }); keys.up = true; run(6); keys.up = false; cc.room.solids.pop(); lp.unwedged = !!cc.fs && Z.inside === cc; void tv; I.leaveNow();
      // collision never parks you outside the room or inside furniture, anywhere in any room
      let pockets = 0, checked = 0; Object.keys(seen).forEach((t) => { const pl = seen[t]; me.x = pl.mx; me.y = pl.my; I.leaveNow(); I.trans = null; const room = I.build(pl); I.trans = { t: 1, dir: 1, pl: pl, room: room }; run(.1); const c = Z.inside; if (!c) { pockets += 1000; return; }
        for (let gx = -c.room.w / 2 - 1; gx <= c.room.w / 2 + 1; gx += .23) for (let gy = -1; gy <= c.room.d + 1; gy += .23) { const f = S.push(Z.W, c.ox + gx, c.oy + gy, .45), g = S.push(Z.W, f.x, f.y, .45), lx = f.x - c.ox, ly = f.y - c.oy; checked++; const ax = c.open && c.room.annex, inAx = ax && lx >= ax.x0 + .4 && lx <= ax.x1 + 1.2 && ly >= ax.y0 + .4 && ly <= ax.y1 - .4; if (inAx) continue; if (Math.abs(lx) > c.room.w / 2 - .4 || ly < .4 || ly > c.room.d - .4 || Math.hypot(g.x - f.x, g.y - f.y) > .06 || c.room.solids.some((s) => lx > s.x0 + .05 && lx < s.x1 - .05 && ly > s.y0 + .05 && ly < s.y1 - .05)) { pockets++; if ((lp.eg = lp.eg || []).length < 8) lp.eg.push([t, +gx.toFixed(2), +gy.toFixed(2), +lx.toFixed(2), +ly.toFixed(2), +Math.hypot(g.x - f.x, g.y - f.y).toFixed(2)]); } } I.leaveNow(); });
      lp.pockets = pockets; lp.checked = checked;
    }
    { // mall, arcade, club, MIB Store, Sick Bay
      const ml = {}; io.mall = ml; const MM = I.mall, mk = Z.places.market; api._open = false; I.leaveNow(); me.x = mk.mx; me.y = mk.my; I.goIn(mk); let c = Z.inside; ml.type = c.type; ml.stores = c.room.stores.length; ml.have = MM.STORES.filter((s) => Z.places[s.id]).length;
      ml.ground = c.room.lift(0, 10) === 0 && c.room.lift(0, 31) > 1 && c.room.lift(0, 40) === 4.2 && c.room.lift(-12, 31) === 0; const wallG = S.push(Z.W, c.ox - 12, c.oy + 35, .45); ml.galleryWalled = Math.abs(wallG.y - c.oy - 35) > .4;
      me.x = c.ox; me.y = c.oy + 26; keys.down = true; let guard = 0; while (me.y - c.oy < 36.5 && guard++ < 80) run(.1); keys.down = false; ml.climbed = me.y - c.oy >= 36 && Math.abs(c.lift - 4.2) < .01;
      const st = c.room.spots.find((s) => s.store && s.store.kind === "books"); if (st) { me.x = c.ox + st.x; me.y = c.oy + st.y; run(.1); ml.storePrompt = Z.prompt(); pressed.act = true; run(.2); ml.booksMenu = api._open && /Past questions/.test(api._html); const m0 = P.money; P.money = 5000; act("i0"); ml.boost = Object.values(P.boost || {}).reduce((a, b) => a + b, 0) === 1 && P.money < 5000; P.money = m0; api._open = false; ml.rescue = MM.rescue(Object.keys(P.boost)[0]) && !MM.rescue("gen"); } else ml.noBooks = true;
      const wear = c.room.spots.find((s) => s.store && s.store.kind === "wear"); if (wear) { const had = Z.wardrobe; let got = null; Z.wardrobe = { editor: (m, o) => { got = [m, o.store]; }, stock: (id) => [id] }; wear.use(c, wear); ml.wardrobe = !!got && got[0] === "shop" && got[1] === wear.store.id; Z.wardrobe = had; api._open = false; }
      const por = c.room.spots.find((s) => s.label === "Games arcade"); por.use(c, por); c = Z.inside; ml.arcade = c.type === "arcade" && !!c.back; const hadM = Z.mini; let opened = ""; Z.mini = { list: () => ["snake", { id: "pong", name: "Pong" }, "dance"], open: (id) => { opened = id; } }; I.leaveNow(); me.x = mk.mx; me.y = mk.my; I.goIn({ id: "mk_arcade", name: "Arcade", mx: mk.mx, my: mk.my, def: {} }); c = Z.inside; const cab = c.room.spots.find((s) => s.k === "cab"); ml.cabLabel = cab.label; cab.use(c, cab); ml.cabOpened = opened === "snake" && c.playing === 0; run(1); const sp0 = c.room.crowd[0], cb0 = c.room.cabs[0]; ml.spectators = Math.hypot(sp0.x - cb0.x, sp0.y - cb0.y) < 4;
      I.cur.back = mk; const ex = c.room.spots.find((s) => s.k === "exit"); me.x = c.ox + ex.x; me.y = c.oy + ex.y; run(.1); pressed.act = true; run(.3); ml.backToMall = !!Z.inside && Z.inside.type === "mall"; Z.mini = hadM; I.leaveNow();
      // the club: the rhythm game scores hits, pays XP a few times a day, and never moves you off your tile
      me.x = mk.mx; me.y = mk.my; I.goIn({ id: "mk_dance", name: "Club", mx: mk.mx, my: mk.my, def: {} }); c = Z.inside; const ds = c.room.spots.find((s) => s.k === "dance"); me.x = c.ox + ds.x; me.y = c.oy + ds.y; run(.1); ml.dancePrompt = Z.prompt(); const xp0 = P.xp; delete P.flags.danceDay; ds.use(c, ds); ml.danceOn = !!MM.dance; const g = MM.dance, px = me.x, py = me.y; let hits = 0; keys.left = true;
      for (let k = 0; k < 73 * 60 && MM.dance; k++) { run(1 / 60); const n = MM.dance && MM.dance.notes.find((q) => !q.s && Math.abs(q.t - MM.dance.t) < .03); if (n && MM.danceHit(n.d)) hits++; } keys.left = false; ml.danceHits = hits; ml.danceNotes = g.notes.length; ml.danceStayed = Math.hypot(me.x - px, me.y - py) < .1; ml.danceDone = !MM.dance && MM.last.score > 0 && MM.last.acc > .9 && P.xp > xp0 && P.flags.danceN === 1; ml.danceMiss = (function () { ds.use(c, ds); const r0 = MM.danceHit(0); MM.danceEnd(c); return r0 === 0; })();
      P.flags.danceN = 3; const xp1 = P.xp; ds.use(c, ds); MM.danceEnd(c); ml.danceCap = P.xp === xp1; I.leaveNow();
      // MIB Store: the case stays shut unless you are the maker
      const mb = Z.places.mibstore || { id: "mibstore", name: "MIB Store", mx: mk.mx, my: mk.my, def: {} }; me.x = mb.mx; me.y = mb.my; I.goIn(mb); c = Z.inside; const cs = c.room.spots.find((s) => s.k === "case"); cs.use(c, cs); ml.caseShut = !c.caseOpen; const ch0 = P.char; P.char = S.HERO_ID; cs.use(c, cs); ml.caseHero = !!c.caseOpen; P.char = ch0; I.leaveNow();
      // Sick Bay: waking in a bed, getting up, the reception menu, admitting somebody
      me.x = 10; me.y = -300; ml.wake = I.wake("sickbay") && Z.inside.type === "sick" && me.sit; run(3); ml.gotUp = !me.sit && !!Z.inside; c = Z.inside; const rc = c.room.spots.find((s) => s.label === "Reception"); me.x = c.ox + rc.x; me.y = c.oy + rc.y; run(.1); pressed.act = true; run(.2); ml.reception = api._open; api._open = false;
      const pat = Z.npc("yakubu") || Z.npcs[0], beds0 = c.room.beds.filter((b) => b.free).length; ml.admit = I.admit(pat) && c.room.beds.filter((b) => b.free).length === beds0 - 1 && pat.admitted > 0; I.discharge(pat); const sb = Z.places.sickbay; I.leaveNow(); ml.outAtSickbay = Math.hypot(me.x - sb.mx, me.y - sb.my) < 3;
      { // opening hours, the locked prompt, and tonight's tutorial
        const hr = {}; ml.hours = hr; const kt = Z.places.kt || Z.places.fslt, libp = Z.places.library, hom = Z.places[P.home]; if (Z.mini && Z.mini.close) Z.mini.close(); if (Z.momentClear) Z.momentClear(); api._open = false; I.leaveNow();
        P.time = 600; hr.dayOpen = I.isOpen(kt) && I.isOpen(libp) && I.isOpen(mk); P.time = 1350; let d0 = P.day; while (I.tutorial()) P.day++; hr.nightShut = !I.isOpen(kt) && I.closed(kt) && I.isOpen(libp) && I.isOpen(hom) && I.isOpen(mk); hr.opens = I.opensAt(kt);
        me.x = kt.mx + 1; me.y = kt.my + 1; run(.2); hr.prompt = Z.prompt(); const tn = toasts.length; I.enter(kt); run(.6); hr.refused = !Z.inside && toasts.slice(tn).some((t) => /Locked/.test(t)); P.time = 1500; hr.mallLate = !I.isOpen(mk); P.flags.pass_library = 1; P.time = 1430; hr.libPass = I.isOpen(libp); delete P.flags.pass_library; hr.libShut = !I.isOpen(libp);
        while (!I.tutorial()) P.day++; P.time = 1150; delete P.flags.tutDay; const tu = I.tutorial(), tp = Z.places[tu.place]; hr.tut = tu.on && !tu.done && I.isOpen(tp) && !!tu.course.code; hr.tutType = I.typeOf(tp);
        me.x = tp.mx; me.y = tp.my; I.goIn(tp); let c = Z.inside; const x0 = P.xp, t0 = P.stats.tutorials || 0; I.fast = 40;
        if (c.type === "theatre") { const st = c.room.spots.find((s) => s.k === "seat" && s.row === 1); me.x = c.ox + st.x; me.y = c.oy + st.y; run(.1); pressed.act = true; run(.3); } else { const bd = c.room.spots.find((s) => /board/.test(s.label)); me.x = c.ox + bd.x; me.y = c.oy + bd.y; run(.1); hr.joinPrompt = Z.prompt(); pressed.act = true; run(.3); }
        hr.started = !!I.lec && !!I.lec.tut && I.lec.qs.length === 2; let g3 = 0; while (I.lec && g3++ < 300) { run(.1); if (I.lec && I.lec.phase === "ask" && !I.lec.open) { pressed.act = true; run(.05); } if (api._open && I.lec && I.lec.open) act("0"); else if (api._open && /tutorials attended/.test(api._html)) { hr.card = true; act("ok"); api._open = false; } }
        hr.done = !I.lec && (P.stats.tutorials || 0) === t0 + 1 && P.xp > x0 && I.tutorial().done; I.fast = 30; I.leaveNow(); P.day = d0; P.time = 660;
      }
      { // MIB Store stock
        const st = {}; ml.stock = st; const m0 = P.money; P.money = 500000; const by = (id) => MM.MIB.find((q) => q.id === id), cars0 = Z.cars.length;
        st.pass = MM.buy(by("pass_queue")) && P.flags.pass_queue === 1 && !MM.buy(by("pass_queue")); st.ride = MM.buy(by("ride_bike")) && P.flags.own_bike === 1 && Z.cars.length === cars0 + 1 && Z.cars.some((q) => q.mib === "bike" && q.free); st.noDouble = !MM.deliver("bike");
        st.shirt = MM.buy(by("shirt"), { col: "#d4a017", text: "MIB" }) && Z.charOf(P.char).top === "#d4a017"; P.mib.shirt.on = 0; st.shirtOff = Z.charOf(P.char).top !== "#d4a017"; st.later = MM.MIB.filter((q) => q.later).every((q) => /COMING WITH THE STORY/.test(q.sub)) && MM.MIB.filter((q) => q.later).length === 3;
        const mb2 = Z.places.mibstore || mk; MM.mib(mb2); st.menu = api._open && /MIB Store/.test(api._html) && /Passes/.test(api._html) && /Rides/.test(api._html) && /Tickets/.test(api._html); api._open = false; st.spent = P.money < 500000; P.money = m0; delete P.flags.pass_queue;
      }
      ml.err = (MM.err || MM.uerr) ? String(MM.err || MM.uerr) : "";
    }
    { // skin tone: the creator choice changes your look; saves without one keep the character's own
      const base = Z.charOf("tunde").skin; P.skin = (D.SKINS || [{ id: "x" }])[0].id; const mine = Z.charOf(P.char).skin; io.skin = { n: (D.SKINS || []).length, applied: !!D.SKINS && mine === D.SKINS[0].col, othersKept: Z.charOf("amina").skin !== mine || P.char === "amina" }; delete P.skin; io.skin.oldKeeps = Z.charOf("tunde").skin === base;
    }
    io.err = I.err ? String(I.err.stack || I.err) : ""; I.fast = 1;
  }
  // an old save without the field gets defaults
  const old = S.newPlayer("amina", "Old"); old.home = "amina"; delete old.life; Z.begin(S.migrate(JSON.parse(JSON.stringify(old)))); out.migrated = { sex: Z.P.life.sex, dept: Z.P.life.dept, faith: Z.P.life.faith, acad: Z.P.life.acad }; run(1);
  out.err = L.err ? String(L.err && L.err.stack || L.err) : ""; out.ok = true;
} catch (e) { out.ok = false; out.error = String(e && e.stack || e); }
console.log(JSON.stringify(out)); process.exit(out.ok ? 0 : 1);
