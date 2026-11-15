/* Headless checks for the Freshers School Life phone, texts, money from home and pockets (samaru-phone.js,
   samaru-texts.js, samaru-inv.js). Stub DOM, seeded random, a clock that only moves with simulated time.
   Usage: node samaru_phone_inv_harness.js <static/js/games dir>. Prints one JSON object; exits 1 on any thrown error. */
const path = require("path"), fs = require("fs"), dir = process.argv[2];
const noop = () => {};
function ctx() { const grad = { addColorStop: noop }; return new Proxy({}, { get: (t, k) => k in t ? t[k] : k === "measureText" ? (s) => ({ width: String(s).length * 7 }) : k === "createLinearGradient" || k === "createRadialGradient" ? () => grad : k === "createPattern" ? () => ({}) : noop, set: (t, k, v) => { t[k] = v; return true; } }); }
function el() { const e = { style: {}, children: [], hidden: true, innerHTML: "", value: "", classList: { add: noop, remove: noop, toggle: noop }, addEventListener: noop, getContext: ctx, getAttribute: () => "", setAttribute: noop, querySelector: () => el(), querySelectorAll: () => [], getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540 }), appendChild: noop, remove: noop, focus: noop, closest: () => null, width: 960, height: 540 }; return e; }
const store = {}, toasts = [];
global.window = global; global.self = global;
{ let seed = 777 >>> 0, simMs = 0, tid = 0; const q = [], T0 = 1.7e12;
  Math.random = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  Date.now = () => T0 + Math.floor(simMs);
  global.setTimeout = (fn, ms) => { q.push({ id: ++tid, at: simMs + (+ms || 0), fn: fn }); return tid; }; global.clearTimeout = (id) => { const i = q.findIndex((e) => e.id === id); if (i >= 0) q.splice(i, 1); };
  global.setInterval = () => 0; global.clearInterval = () => {};
  global.__pump = (ms) => { simMs += ms; for (let guard = 0; guard < 50; guard++) { let k = -1; for (let i = 0; i < q.length; i++) if (q[i].at <= simMs && (k < 0 || q[i].at < q[k].at)) k = i; if (k < 0) break; const e = q.splice(k, 1)[0]; e.fn(); } }; }
global.document = { querySelector: () => el(), querySelectorAll: () => [], createElement: () => el(), addEventListener: noop, body: el() };
global.performance = { now: () => Date.now() }; global.fetch = () => Promise.reject(new Error("offline"));
const keys = {}, pressed = {};
const api = { W: 960, H: 540, x: ctx(), t: 0, reduce: false, parts: [], shake: 0, esc: (s) => String(s),
  down: (...a) => a.some((k) => keys[k]), hit: (...a) => a.some((k) => pressed[k]), double: () => false,
  sound: { sfx: noop, say: noop, tone: noop, muted: true, ac: null }, burst: noop, kick: noop, buzz: noop, confetti: noop, flash: noop, zoom: noop, hitstop: noop, slowmo: noop,
  banner: noop, music: noop, panel: noop, useActions: noop, keyName: (k) => k,
  show: (html, on) => { api._open = true; api._on = on; api._html = html; }, hide: () => { api._open = false; }, overlayOpen: () => !!api._open,
  store: (k, v) => { if (v === undefined) return store[k] ? JSON.parse(store[k]) : null; store[k] = JSON.stringify(v); } };
global.Arcade = { song: () => ({}), toast: (h) => toasts.push(h), report: noop, run: (g) => { global.GAME = g; g.init(api); } };
const list = JSON.parse(/for \(const \w+ of (\[[^\]]+\])/.exec(fs.readFileSync(path.join(__dirname, "samaru_harness.js"), "utf8"))[1]);
const codes = list.map((f) => [f, fs.readFileSync(path.join(dir, f + ".js"), "utf8")]);
for (const c of codes) { (0, eval)(c[1]); if (c[0] === "fslg-map") global.SamaruMap = global.SamaruMap || module.exports; }
const Z = global.SamaruGame, S = global.SamaruSim, D = global.SamaruData, I = Z.inv, F = Z.phone, X = Z.texts;
const STEP = 1 / 60;
function run(sec, each) { for (let i = 0; i < sec * 60; i++) { if (each) each(i); GAME.update(STEP, api); api.t += STEP; __pump(STEP * 1000); for (const k in pressed) pressed[k] = false; if (i % 6 === 0) GAME.draw(api); } }
function act(a) { const on = api._on; if (!on) throw new Error("no dialog open for " + a); on(a, { disabled: false, getAttribute: () => a, style: {}, classList: { add: noop } }); }
function actLabel(re) { const rows = [...(api._html || "").matchAll(/data-act='(i\d+)'[^>]*>([\s\S]*?)<\/button>/g)], hit = rows.find((r) => re.test(r[2].replace(/<[^>]+>/g, " "))); if (!hit) throw new Error("no row " + re); act(hit[1]); }
function fresh(name) { const p = S.newPlayer("tunde", name || "Tunde"); p.home = "akenzua"; const g = Z.places.gate; p.x = g.mx; p.y = g.my + 6; Z.api.hide(); Z.begin(p, true); if (Z.intro && Z.intro.on && Z.intro.end) Z.intro.end(); if (Z.guide && Z.guide.active()) Z.guide.skip(); api._open = false; return Z.P; }
const J = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "cheat_defaults", "samaru-days.json"), "utf8"));
const out = {};
try {
  run(.5);
  let P = fresh();
  const me = Z.me;
  /* ---------- pockets ---------- */
  const inv = out.inv = {};
  inv.kit = { edrink: I.count("edrink"), water: I.count("water"), puffpuff: I.count("puffpuff"), bread: I.count("bread") }; inv.kitSlots = I.used(); inv.cap = I.capacity();
  inv.quick = P.pockets.slots.slice(0, 3).map((s) => s && s.id);
  inv.added = I.add("puffpuff", 10); inv.stacks = P.pockets.slots.filter((s) => s && s.id === "puffpuff").map((s) => s.n).sort((a, b) => b - a); inv.stackMax = I.stackOf("puffpuff");
  // fill to the brim: the rest does not fit, and you are told
  toasts.length = 0; let k = 0; while (I.used() < I.capacity() && k++ < 60) I.add("cement", 16);
  inv.fullNow = I.used() === I.capacity(); inv.fitsMore = I.fits("wood", 1); inv.addFull = I.add("wood", 3); inv.fullToast = toasts.some((t) => /pockets are full/i.test(t)); inv.woodCount = I.count("wood");
  // more room with levels and the backpack
  P.lvl = 5; I.sync(); inv.capL5 = I.capacity(); P.lvl = 21; inv.capL21 = I.capacity(); P.money = 10000; inv.bag = I.buyBag(); inv.capBag = I.capacity(); P.lvl = 90; inv.capMax = I.capacity(); P.lvl = 1; I.sync();
  inv.overflowKept = I.over(); I.take("cement", I.count("cement")); I.sync(); inv.afterTake = I.used();
  // eating restores food and energy, plays the eat pose, uses one up
  P.hunger = 20; P.energy = 30; const pp0 = I.count("puffpuff"); inv.ate = I.use("puffpuff"); inv.hunger = P.hunger; inv.energyAfterPuff = P.energy; inv.eatPose = me.eatT > 0; inv.puffLeft = pp0 - I.count("puffpuff");
  P.energy = 30; I.use("edrink"); inv.energyDrink = P.energy; inv.cementNotEdible = !I.use("cement") && !I.edible("cement");
  // the panel works by id: open, pick a slot, eat
  I.open(); const sIdx = P.pockets.slots.findIndex((s) => s && s.id === "bread"); I.press("slot:" + sIdx); inv.panelShowsEat = /data-pi='use'[^>]*>Eat/.test(I.html); P.hunger = 10; I.press("use"); inv.panelAte = P.hunger > 10; inv.panelGrid = (I.html.match(/data-pi='slot:/g) || []).length; I.close();
  // move, swap, split
  I.add("water", 6); const wi = P.pockets.slots.findIndex((s) => s && s.id === "water"); const nW = P.pockets.slots[wi].n; const sp = I.split(wi); inv.split = sp !== false && P.pockets.slots[wi].n + P.pockets.slots[sp].n === nW;
  const empty = P.pockets.slots.findIndex((s, i) => !s && i < I.capacity()); inv.moved = I.move(wi, empty) && P.pockets.slots[empty] && P.pockets.slots[empty].id === "water"; inv.merged = I.move(sp, empty) && P.pockets.slots[empty].n === nW && !P.pockets.slots[sp];
  // drop it on the ground, walk off, come back: picked up again; left alone it disappears
  const bi = P.pockets.slots.findIndex((s) => s && s.id === "water"), wN = I.count("water"); I.drop(bi, 2); inv.dropped = I.count("water") === wN - 2 && I.ground.length === 1;
  run(.3); inv.notStraightBack = I.ground.length === 1; const g = I.ground[0]; me.x = g.x + 4; me.y = g.y; run(.2); me.x = g.x; me.y = g.y; run(.2); inv.pickedUp = I.ground.length === 0 && I.count("water") === wN;
  I.drop(P.pockets.slots.findIndex((s) => s && s.id === "water"), 1); me.x += 6; run(.2); I.ground[0].t = 299.5; run(1); inv.despawned = I.ground.length === 0;
  // quest items and tools: on you, never in a slot, never dropped
  P.inv.fuse = 1; P.inv.torch = 1; I.sync(); inv.questNotSlotted = !P.pockets.slots.some((s) => s && (s.id === "fuse" || s.id === "torch")); inv.questNoDrop = !I.droppable("fuse") && !I.droppable("torch"); inv.questAlwaysAdds = I.add("logbook", 1) === 1;
  // the story writes P.inv directly: the slots follow
  P.inv.cable = 3; I.sync(); inv.storyWrite = P.pockets.slots.some((s) => s && s.id === "cable" && s.n === 3); inv.api = { has: I.has("cable", 3), notHas: !I.has("cable", 4), take: I.take("cable", 2) && I.count("cable") === 1, takeTooMany: !I.take("cable", 5) && I.count("cable") === 1 };
  // gifts: likes matter, the partner glows, it needs the person nearby
  const ada = Z.npc("ada"); P.friends.ada = 30; P.skills.charm = 0; ada.x = me.x + 1.5; ada.y = me.y; I.add("chocolate", 2); I.add("notebook", 1); I.add("cement", 1);
  const a0 = S.affinity(P, "ada"); const gLike = I.give("ada", "chocolate"); const gPlain = I.give("ada", "notebook"); const gOdd = I.give("ada", "cement");
  inv.gift = { liked: gLike, plain: gPlain, odd: gOdd, likedMore: gLike > gPlain && gPlain > gOdd, rose: S.affinity(P, "ada") > a0, used: I.count("chocolate") === 1 && I.count("notebook") === 0, nearby: I.nearby(6).some((n) => n.id === "ada") };
  I.open(); I.press("slot:" + P.pockets.slots.findIndex((s) => s && s.id === "chocolate")); I.press("gift"); inv.giftList = /data-pi='to:ada'/.test(I.html); const ac = S.affinity(P, "ada"); I.press("to:ada"); inv.giftByPanel = S.affinity(P, "ada") > ac && I.count("chocolate") === 0; I.close();
  // shops sell into the pockets
  P.money = 5000; const m0 = P.money; Z.ui.place(Z.places.market); actLabel(/Buy for your pockets/); actLabel(/^\s*Garri pack/); inv.shopBought = I.count("garri") === 1 && P.money === m0 - I.def("garri").price; api._open = false;
  Z.ui.place(Z.places.pepsi); inv.packAtFood = /Buy for your pockets/.test(api._html); api._open = false;
  /* ---------- save, load, migration ---------- */
  Z.save(); const saved = Z.load(); inv.saved = saved.pockets && saved.pockets.slots.filter(Boolean).length === P.pockets.slots.filter(Boolean).length && saved.inv.garri === 1;
  const old = JSON.parse(JSON.stringify(saved)); delete old.pockets; delete old.phone; old.day = 6; ["edrink", "water", "puffpuff", "bread"].forEach((x) => delete old.inv[x]);
  store["fslg-save"] = JSON.stringify(old); const lo = Z.load(); Z.begin(lo); if (Z.intro && Z.intro.on && Z.intro.end) Z.intro.end(); P = Z.P;
  inv.migrated = !!P.pockets && I.count("edrink") === 2 && I.count("bread") === 1 && I.count("garri") === 1 && P.pockets.tut.old === 1; Z.begin(Z.load()); inv.kitOnce = I.count("edrink") === 2; P = Z.P; api._open = false;
  /* ---------- the pocket lesson ---------- */
  P = fresh("Lesson"); const tut = out.tut = {}; tut.waits = !P.pockets.tut.s; run(10); tut.started = P.pockets.tut.s === 1; tut.text = /pocket/i.test(I.tutHtml || "");
  I.open(); tut.afterOpen = P.pockets.tut.s === 2; I.press("slot:0"); I.press("use"); tut.afterEat = P.pockets.tut.s === 3; I.close(); run(.2); tut.ahead = /in advance/.test(I.tutHtml || ""); I.tutOk(); tut.done = !!P.pockets.tut.done;
  { const p2 = fresh("Intro"); Z.intro = Z.intro || {}; const was = Z.intro.on, tk = Z.intro.tick; Z.intro.tick = () => {}; Z.intro.on = true; p2.pockets.tut.s = 0; run(12); tut.waitsForIntro = p2.pockets.tut.s === 0 && !F.isOpen(); F.open(); tut.noPhoneInIntro = !F.isOpen(); Z.intro.on = was; Z.intro.tick = tk; }
  // the low-food nudge names what is in your pocket
  P = Z.P; P.pockets.tut.done = 1; toasts.length = 0; P.hunger = 12; run(5); tut.nudge = toasts.some((t) => /in your pocket/.test(t)); P.hunger = 80;
  /* ---------- the phone ---------- */
  const ph = out.phone = {};
  P = fresh("Phone"); run(.5);
  Z.ui.phone(); ph.opens = F.isOpen(); run(.6); ph.pose = me.phoneK > .95;
  ph.apps = F.APPS.map((a) => a.id); ph.home = F.labels().length >= F.APPS.length;
  const views = {};
  ["goals", "jobs", "contacts", "messages", "friends", "bank", "dial", "camera", "radio", "net", "me", "settings", "quit"].forEach((a) => { F.press("app:" + a); views[a] = F.view === a && F.html.length > 40; F.back(); });
  ph.views = views; ph.backHome = F.view === "home";
  F.pressLabel(/Goals/); ph.goalsByLabel = /Goals/.test(F.html) && /Chapter|Next:|complete/.test(F.html); F.back();
  // the big map, pockets and help leave the phone
  F.press("app:map"); ph.mapOpens = Z.bigOpen() && !F.isOpen(); Z.bigSet(false); run(.2);
  Z.ui.phone(); F.press("app:pockets"); ph.pocketsOpen = I.isOpen() && !F.isOpen(); I.close();
  Z.ui.phone(); F.press("app:help"); ph.help = api._open && /How to play/.test(api._html) && /Pockets/.test(api._html); act("ok"); api._open = false; run(.1); ph.helpBack = F.isOpen(); F.close(true);
  // dial codes work exactly as before: a real code from the defaults, then a wrong one
  const cash = J.cheats.find((c) => c.id === "cash"); Z.ui.phone(); F.press("app:dial"); const mny = P.money; for (const ch of cash.dial) F.press("dial:k" + ch); F.press("dial:call"); ph.dialCash = P.money > mny && !F.isOpen() && P.cheated;
  Z.ui.phone(); F.press("app:dial"); for (const ch of "*100#") F.press("dial:k" + ch); F.press("dial:call"); ph.dialWrong = F.isOpen() && /Invalid/.test(F.html); F.close(true);
  // contacts call a friend for ₦50 as before
  P.friends.sadiq = 40; P.money = 1000; Z.ui.phone(); F.press("app:contacts"); ph.callRow = /contacts:call:sadiq/.test(F.html); F.press("contacts:call:sadiq"); ph.called = P.money === 950; run(.1);
  // radio, jobs, profile keep working
  Z.ui.phone(); F.press("app:jobs"); ph.jobRows = (F.html.match(/data-pa='jobs:take:/g) || []).length; F.press("jobs:take:0"); ph.tookJob = !!P.job; if (Z.jobs) Z.jobs.cancel(true); else P.job = null; run(.1);
  Z.ui.phone(); F.press("app:me"); const o0 = P.outfit || 0; F.press("me:outfit"); ph.outfit = (P.outfit || 0) !== o0; F.close(true); run(.6); ph.putAway = me.phoneK < .05;
  // on a vehicle: hands-free only when slow; never while fast
  { const bike = Z.cars.find((c) => c.type === "bike"); me.x = bike.x + 1; me.y = bike.y; run(.1); pressed.act = true; run(.2); ph.onBike = !!me.veh; if (me.veh) { me.veh.speed = 9; Z.ui.phone(); ph.fastBlocked = !F.isOpen(); me.veh.speed = 0; Z.ui.phone(); ph.slowOpens = F.isOpen(); run(.3); ph.noPoseOnBike = me.phoneK < .05; me.veh.speed = 9; me.veh.vx = Math.cos(me.veh.a) * 9; me.veh.vy = Math.sin(me.veh.a) * 9; keys.up = true; run(.2); keys.up = false; ph.closesWhenFast = !F.isOpen(); me.veh.speed = 0; me.veh.vx = me.veh.vy = 0; run(.2); pressed.act = true; run(.3); } }
  /* ---------- texts ---------- */
  const tx = out.texts = {};
  function textRun(seedName) { const p = fresh(seedName); p.friends.ada = 45; p.friends.sadiq = 30; p.partner = ""; p.time = 9 * 60; I.state(p).tut.done = 1; const seen = []; for (let i = 0; i < 14; i++) { p.time += 37; const m = X.deliver(); if (m) seen.push(m.who + ":" + m.text); } return seen; }
  const r1 = textRun("Same"), r2 = textRun("Same"); tx.det = JSON.stringify(r1) === JSON.stringify(r2) && r1.length > 5; tx.sample = r1.slice(0, 4); tx.whoVaries = new Set(r1.map((s) => s.split(":")[0])).size >= 2;
  P = Z.P; const ada2 = Z.npc("ada"); const m = X.send("ada", "Test: where you dey?", { replies: [["On my way!", 3, "Run!"], ["Ignore", -2, "Seen."]] }); tx.unread = X.unread() > 0; const f0 = S.affinity(P, "ada"); X.reply(m.id, 0); tx.replyUp = S.affinity(P, "ada") > f0; tx.answered = X.thread("ada").some((q) => q.text === "Run!");
  const m2 = X.send("ada", "Again", { replies: [["Hmm", -2, "Seen."]] }); const f1 = S.affinity(P, "ada"); X.reply(m2.id, 0); tx.replyDown = S.affinity(P, "ada") < f1; tx.noDoubleReply = !X.reply(m2.id, 0);
  Z.ui.phone(); F.press("app:messages"); tx.threadRow = /messages:open:ada/.test(F.html); F.press("messages:open:ada"); tx.threadView = /fp-bub/.test(F.html); const m3 = X.send("ada", "Third", { replies: [["Okay", 1, "Good."]] }); F.render(); tx.quickReplies = new RegExp("messages:reply:" + m3.id + ":0").test(F.html); F.press("messages:reply:" + m3.id + ":0"); tx.repliedByTap = m3.replied === 0; F.close(true); void ada2;
  // the scheduler: texts arrive while you play, never during the intro or with no phone
  P.time = 10 * 60; I.state(P).tut.done = 1; const s0 = P.phone.msgs.length; P.phone.nextAt = PH_abs() - 1; run(1.2); tx.scheduled = P.phone.msgs.length > s0;
  /* ---------- money from home ---------- */
  const mo = out.money = {};
  P = fresh("Money"); P.life.att = 8; P.life.missed = 1; P.day = 3; P.time = 18 * 60; const mon0 = P.money;
  const odds0 = X.odds("mum"); const a1 = X.ask("mum", "call"); mo.first = a1.ok; mo.firstYes = a1.yes; mo.line = a1.line;
  const a2 = X.ask("dad", "text"); mo.cooldown = !a2.ok && /today|just now|on the way/.test(a2.why || "");
  if (a1.yes) { mo.pending = X.pending().length === 1; mo.notYet = P.money === mon0; P.time += 200; run(1); mo.credited = P.money > mon0 && X.thread("alert").some((q) => /Credit alert/.test(q.text)); }
  // asking every day wears thin: the odds fall, and a no blocks that person for two days
  let yes = 0, asked = 0; for (let d = 0; d < 6; d++) { P.day += 1; P.time = 12 * 60; X.pending().length && (P.time += 300, run(.6)); const who = ["mum", "dad", "uncle"][d % 3]; const r = X.ask(who, "text"); if (r.ok) { asked++; if (r.yes) yes++; } }
  mo.odds0 = +odds0.p.toFixed(2); mo.oddsLater = +X.odds("mum").p.toFixed(2); mo.oddsFall = X.odds("mum").p < odds0.p; mo.asked = asked; mo.notAlwaysYes = yes < asked || asked < 6;
  mo.amount = odds0.amt; mo.amountSane = odds0.amt >= 1500 && odds0.amt <= 12000;
  { const p = fresh("Term"); p.day = 61; const ot = X.odds("dad"); p.day = 75; const on = X.odds("dad"); mo.termHelps = ot.p > on.p && ot.amt > on.amt; }
  { const p = fresh("Det"); p.day = 4; p.time = 700; const r = X.ask("uncle", "call"); const p2 = fresh("Det"); p2.day = 4; p2.time = 700; const r2 = X.ask("uncle", "call"); mo.deterministic = r.yes === r2.yes && r.amt === r2.amt && r.line === r2.line; }
  Z.ui.phone(); F.press("app:bank"); mo.bankRows = /bank:who:mum/.test(F.html) && /bank:who:uncle/.test(F.html); F.press("bank:who:dad"); mo.whoView = /bank:call:dad|said no|asked|on the way/.test(F.html); F.close(true);
  /* ---------- snatches ---------- */
  const sn = out.snatch = {};
  P = fresh("Snatch"); P.time = 21 * 60; const gate = Z.places.market || Z.places.gate; me.x = gate.mx; me.y = gate.my; run(4);
  sn.peds = Z.peds.length; Z.peds.filter((n) => !n.cr && !n.gone).slice(0, 6).forEach((n, i) => { n.x = me.x + 6 + i; n.y = me.y + (i % 2 ? 4 : -4); }); sn.crowd = Z.peds.filter((n) => Math.hypot(n.x - me.x, n.y - me.y) < 18).length; sn.chanceNight = F.snatchChance(); P.time = 13 * 60; sn.chanceNoon = F.snatchChance(); P.time = 21 * 60; Z.ui.phone(); run(1); sn.warned = toasts.some((t) => /crowds at night/.test(t)) && P.phone.warned.crowd === 1;
  const ok = F.startSnatch(); sn.started = ok; let guard = 0; while (F.snatch() && F.snatch().st === "approach" && guard++ < 900) run(.05);
  sn.taken = F.lost() && !F.isOpen() && me.phoneK < .05; Z.ui.phone(); sn.cantOpen = !F.isOpen(); sn.thiefHasIt = F.snatch() && F.snatch().n.phoneK > .5;
  // tackle: catch up with him
  if (F.snatch()) { const th = F.snatch().n; for (let i = 0; i < 60 && F.snatch(); i++) { me.x = th.x - .5; me.y = th.y; run(.05); } }
  sn.recovered = !F.lost() && !F.snatch(); Z.ui.phone(); sn.worksAgain = F.isOpen(); F.close(true);
  // another day: he gets away; you report it at the security post, and security finds it later (or you buy one)
  P.phone.snAt = -1e9; P.day += 3; P.time = 21 * 60; me.x = gate.mx; me.y = gate.my; run(4); Z.ui.phone(); run(.6); { const pd = Z.peds.find((n) => !n.cr && !n.scene && !n.st && !(n.fall > 0) && !n.gone); if (pd) { me.x = pd.x + 10; me.y = pd.y; } } sn.started2 = F.startSnatch(); guard = 0; while (F.snatch() && F.snatch().st === "approach" && guard++ < 900) run(.05);
  sn.taken2 = F.lost(); me.x += 150; for (let i = 0; i < 80 && F.snatch(); i++) run(1); sn.escaped = F.lost() && !F.snatch() && !!P.phone.lost.escaped;
  Z.ui.place(Z.places.gate); sn.reportRow = /Report your stolen phone/.test(api._html); actLabel(/Report your stolen phone/); api._open = false; sn.reported = !!P.phone.lost.reported;
  if (P.phone.lost.find) { P.time += P.phone.lost.find + 5; run(.6); sn.foundLater = !F.lost(); } else { P.money = 9000; sn.foundLater = F.replace() && !F.lost(); }
  // never during a mission that needs the phone, never while you are busy, and rare by design
  { const p = Z.P; p.phone.snAt = -1e9; Z.ui.phone(); const savedFocus = Z.focus.current; Z.focus.current = () => ({ kind: "mission" }); sn.noneOnMission = !F.snatchOk(); Z.focus.current = savedFocus; F.close(true); sn.rare = sn.chanceNight < .02 && (sn.crowd < 3 || (sn.chanceNight > 0 && sn.chanceNoon < sn.chanceNight)); p.phone.snAt = PH_abs(); sn.cooldown = !F.snatchOk(); }
  // a friend can lend you their phone to report it
  { const p = Z.P; p.phone.lost = { day: p.day, t: PH_abs(), by: "snatch", reported: 0 }; p.friends.sadiq = 30; Z.ui.talk(Z.npc("sadiq")); sn.friendRow = /Borrow their phone/.test(api._html); actLabel(/Borrow their phone/); sn.friendReport = !!p.phone.lost.reported; api._open = false; p.phone.lost = null; }
  // other people use phones too
  let seenPhones = 0; run(40, () => { if (Z.peds.some((n) => n.phoneK > .5)) seenPhones++; }); sn.pedPhones = seenPhones > 0;
  out.toasts = toasts.slice(-6);
  out.errs = [I.uerr, F.uerr, X.uerr, F.err].filter(Boolean).map(String);
  out.ok = true;
} catch (e) { out.ok = false; out.error = String(e && e.stack || e).split("\n").slice(0, 5).join(" | "); }
function PH_abs() { return Z.phone.absMin(); }
console.log(JSON.stringify(out));
process.exit(out.ok ? 0 : 1);
