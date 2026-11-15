/* The opening film's logic, headless (the 3D view is not loaded, so the film is started by hand): the car arrives,
   you get out with the bags, the porter takes them, the room choice is m1's own, the chosen roommate is at the hostel,
   the parents leave, control returns with m1 moved on; SKIP works before and after the choice; old saves never get it.
   Usage: node samaru_intro_harness.js <static/js/games dir> */
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "samaru_harness.js"), "utf8");
const boot = src.slice(0, src.indexOf("const out = { log: [] }"));
const mine = String.raw`
const out = { ok: true };
try {
  run(.3); const I = Z.intro, ST = Z.story;
  function fresh(name) { const p = S.newPlayer("tunde", name); p.life = { sex: "m", dept: "elect", faith: "", acad: 100 }; api._open = false; Z.begin(p, true); run(.05); }
  // 1. the whole film, choosing the second room (Sadiq)
  fresh("Film"); out.autoWithout3d = I.on; out.started = I.start(false); const beats = []; let chose = false, carried = { me: false, porter: false, dad: false }, hugged = false, waved = false;
  const phases = [], shots = new Set(), caps = new Set(), cards = new Set(), narr = new Set(); let logoSeen = false, roomSeen = false, bagsByBed = false;
  for (let i = 0; i < 6000 && I.on; i++) {
    if (phases[phases.length - 1] !== I.ph) phases.push(I.ph); if (I.ph === "arrive" && beats[beats.length - 1] !== I.k) beats.push(I.k);
    if (I.ph === "brief") shots.add(I.bi); if (I.capText) caps.add(I.capText); if (I.cardText) cards.add(I.cardText); if (I.narr) narr.add(I.narr.k); if (I.logoOn) logoSeen = true; if (I.ph === "arrive" && I.k === 4 && Z.inside && Z.inside.type === "hostel") { roomSeen = true; bagsByBed = bagsByBed || I.fbags.every((b) => b.at && I.bed && Math.hypot(b.at.x - I.bed.x, b.at.y - I.bed.y) < 1.6); }
    if (I.k === 3 && api._open && !chose) { chose = true; act("o1"); }
    if (Z.me.carry) carried.me = true; if (I.porter && I.porter.carry) carried.porter = true; if (I.dad && I.dad.carry) carried.dad = true; if (Z.me.emote === "hug") hugged = true; if (Z.me.emote === "wave" && I.k === 6) waved = true;
    run(.05);
  }
  const watched = I.endState();
  const P = Z.P, home = Z.places[P.home];
  out.film = { roomSeen, bagsByBed, outsideAfter: !Z.inside, phases, briefShots: shots.size, captions: caps.size, cards: cards.size, narration: [...narr].sort(), logoSeen, subtitles: I.subLog.length, beats, ended: !I.on, chose, roomie: ST.roomie(), home: P.home, introDone: !!ST.state(P).introDone, m1Step: P.m.active + ":" + (Z.step() || {}).t, nearHome: Math.hypot(Z.me.x - home.mx, Z.me.y - home.my) < 12,
    carried, hugged, waved, carGone: !Z.cars.some((c) => c.intro), parentsGone: !Z.npc("intro_mum") && !Z.npc("intro_dad"), camFree: !(Z.r3 && Z.r3.shot), control: Z.mode === "play" && !I.on, noTemps: !Z.npcs.some((n) => n.temp) && !Z.cars.some((c) => c.intro) && !(Z.guards || []).some((g) => g.intro), timeBack: Z.P.time < 9 * 60 };
  // 2. SKIP before the choice: the story starts at the gate with the choice still to come
  fresh("SkipEarly"); I.start(false); run(12); I.skip(); run(.3); const asked = !!api._open && I.on; if (api._open) act("o1"); run(.3);
  const skipped = I.endState(), same = Object.keys(watched).filter((k) => k !== "time" && JSON.stringify(watched[k]) !== JSON.stringify(skipped[k]));
  out.skipEarly = { askedTheRoomFirst: asked, off: !I.on, sameEndStateAsWatching: same.length === 0, differs: same.join(","), timeRestored: Math.abs(skipped.time - watched.time) < 60, noCar: !Z.cars.some((c) => c.intro) };
  out.meta = I.META && I.META.skippable === true && I.META.maxDuration > 0 && typeof I.META.endState === "string";
  { fresh("Dog"); I.start(false); I.clock = I.META.maxDuration + 1; run(.2); if (api._open) act("o0"); run(.3); out.watchdog = !I.on; }
  // 2b. SKIP while the room-choice dialog is open
  fresh("SkipDlg"); I.start(false); for (let i = 0; i < 3000 && I.on && !api._open; i++) run(.05); const dlg = !!api._open; I.skip(); run(.1); const stillAsking = !!api._open && !Z.story.state(Z.P).roomie; if (api._open) act("o0"); run(.3); out.skipDialog = { dialogWasOpen: dlg, stillAsksTheRoom: stillAsking, off: !I.on, atHome: I.endState().atHome }; // skipping during the choice still needs a room, then lands at the hostel
  // 3. SKIP after the choice: you are at your hostel, choice kept
  fresh("SkipLate"); I.start(false); for (let i = 0; i < 3000 && I.on && !(I.ph === "arrive" && I.k >= 3); i++) run(.05); for (let i = 0; i < 200 && I.on && !api._open; i++) run(.05); if (api._open) act("o0"); run(.2); I.skip(); run(.1);
  const h2 = Z.places[Z.P.home]; out.skipLate = { off: !I.on, roomie: ST.roomie(), nearHome: Math.hypot(Z.me.x - h2.mx, Z.me.y - h2.my) < 12 };
  // 4. an old save never plays it; a replay changes nothing in the save
  const old = S.newPlayer("tunde", "Old"); old.m.done.m1 = 1; old.m.active = "m2"; api._open = false; Z.begin(old, false); run(.05); out.oldWanted = I.wanted(Z.P, false);
  const before = JSON.stringify(Z.P.m) + Z.P.home; I.start(true); for (let i = 0; i < 6000 && I.on; i++) { if (api._open) api._open = false; run(.05); } out.replay = { ended: !I.on, unchanged: JSON.stringify(Z.P.m) + Z.P.home === before };
} catch (e) { out.ok = false; out.error = String(e && e.stack || e).split("\n").slice(0, 6).join(" | "); }
console.log(JSON.stringify(out)); process.exit(out.ok ? 0 : 1);
`;
eval(boot + mine);
