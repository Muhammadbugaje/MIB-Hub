/* Headless run of the whole Freshers School Life campaign (m1–m120) with the story engine's solver.
   Usage: node samaru_story_harness.js <static/js/games dir> [pick] — pick = which choice option to take (0 or 1).
   Reuses the boot section of samaru_harness.js (stub DOM, fixed random seed, sim clock) so both load the same files. */
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "samaru_harness.js"), "utf8");
const boot = src.slice(0, src.indexOf("const out = { log: [] }"));
const mine = String.raw`
const out = { ok: true, log: [] }, PICK = +(process.argv[3] || 0);
try {
  run(.5);
  const ST = Z.story; out.merged = ST.merged; out.problems = ST.validate();
  out.unknownTypes = [...new Set(D.MISSIONS.flatMap((m) => m.steps.map((s) => s.t)))].filter((t) => ST.KNOWN.indexOf(t) < 0);
  out.ids = D.MISSIONS.filter((m) => !m.side).map((m) => m.id);
  const p = S.newPlayer("tunde", "Tester"); api._open = false; Z.begin(p, true); const P = Z.P; run(.2);
  let grind = 0, stuck = [], yearEnd = {};
  const main = D.MISSIONS.filter((m) => !m.side);
  for (const m of main) {
    if (P.m.done[m.id]) continue;
    if (P.m.active !== m.id) {
      const need = (m.need || {}).lvl || 0; if (P.lvl < need) { grind += S.xpForLevel(need) - P.xp; P.xp = S.xpForLevel(need); S.addXp(P, 0); }
      ((m.need || {}).flags || []).forEach((f) => { if (!P.flags[f]) { stuck.push(m.id + " needs flag " + f); P.flags[f] = 1; } });
      if (!P.m.active) Z.nextStory(true);
      if (P.m.active !== m.id) { stuck.push(m.id + " did not start (active " + P.m.active + ")"); if (P.m.active) { P.m.active = ""; } S.startMission(P, m); }
    }
    let g = 0; const steps0 = m.steps.length;
    while (P.m.active === m.id && g++ < steps0 * 6 + 10) { api._open = false; ST.solve("main", PICK); run(.03); }
    if (!P.m.done[m.id]) { stuck.push(m.id + " stuck at step " + P.m.step + " (" + (m.steps[P.m.step] || {}).t + ")"); P.m.done[m.id] = 1; P.m.active = ""; }
    out.log.push(m.id);
    yearEnd[m.year || (+m.id.slice(1) <= 36 ? 1 : 0)] = { lvl: P.lvl, money: P.money, id: m.id };
  }
  out.stuck = stuck; out.grindXp = grind; out.final = { lvl: P.lvl, xp: P.xp, money: P.money, done: main.filter((m) => P.m.done[m.id]).length, total: main.length, standing: ST.state(P).standing, flags: Object.keys(P.flags).length };
  out.years = yearEnd; out.makerFree = !!P.flags.maker_free;
  // the Maker gives a saying when he is free
  { const before = ST.queue.length; Z.emit({ t: "talk", npc: "maker" }); out.makerSays = ST.queue.length > before; }
  // relationships: opposite sex only; broke alone does not end it; absent and broke does; two-timing is found out
  { const q = S.newPlayer("tunde", "Rel"), ids = D.NPCS.filter((n) => n.voice === "female").map((n) => n.id), men = D.NPCS.filter((n) => n.voice === "male" && !n.romance).map((n) => n.id);
    const sv = Z.P; Z.P = q; ST.state(q); q.life = q.life || {}; q.life.sex = "m";
    out.rel = { sameSexRefused: !ST.date(q, men[0]), dated: ST.date(q, ids[0]) };
    q.money = 0; q.day += 8; let ev = ST.daily(q); out.rel.warnedNotDumped = ev.some((e) => e[0] === "warn") && ST.state(q).partner === ids[0];
    q.money = 100000; q.day += 7; ev = ST.daily(q); out.rel.richButAbsentKept = ST.state(q).partner === ids[0];
    q.money = 0; q.day += 1; ev = ST.daily(q); out.rel.brokeAndAbsentLeft = ST.state(q).partner !== ids[0];
    ST.date(q, ids[1]); ST.date(q, ids[2]); let caught = false; for (let d = 0; d < 40 && !caught; d++) { q.day++; ST.state(q).rel[ids[1]] && (ST.state(q).rel[ids[1]].last = q.day); ST.state(q).rel[ids[2]] && (ST.state(q).rel[ids[2]].last = q.day); caught = ST.daily(q).some((e) => e[0] === "caught"); }
    out.rel.twoTimingCaught = caught; Z.P = sv; }
  // old saves: a save at m36 with no story block loads and continues into m37
  { const old = JSON.parse(JSON.stringify(P)); delete old.story; old.m = { active: "", step: 0, n: 0, done: {} }; for (let i = 1; i <= 36; i++) old.m.done["m" + i] = 1; old.lvl = Math.max(old.lvl, 40); old.xp = S.xpForLevel(old.lvl);
    Z.begin(old, false); run(.1); out.migrate = { story: !!Z.P.story && !!Z.P.story.standing, next: Z.P.m.active }; }
  // a save from before the Year 1 rewrite, three steps into m12, restarts m12 from the top and is paid for those steps
  { const old = JSON.parse(JSON.stringify(Z.P)); delete old.story; old.m = { active: "m12", step: 3, n: 0, done: {} }; for (let i = 1; i <= 11; i++) old.m.done["m" + i] = 1; const cash = old.money;
    Z.begin(old, false); run(.1); out.migrate.y1 = { active: Z.P.m.active, step: Z.P.m.step, paid: Z.P.money - cash }; }
  // a new game asks for a room first, and the room sets the roommate and hostel
  { const np = S.newPlayer("amina", "Room"); Z.begin(np, true); run(.1); const st = Z.step(); out.room = { first: st && st.t, prompt: st && st.prompt, options: ST.options(st || {}).map((x) => x.o.roomie || "fate") };
    for (let g = 0; g < 3 && Z.step() && Z.step().t !== "choice"; g++) { api._open = false; ST.solve("main", 0); run(.03); }
    out.room.options = ST.options(Z.step() || {}).map((x) => x.o.roomie || "fate"); out.room.at = Z.P.m.step;
    api._open = false; ST.solve("main", 1); run(.05); out.room.roomie = ST.tok(Z.P, "@roomie"); out.room.home = Z.P.home; }
  // a mid-Year-2 save (m45 active, step 2) resumes there
  { const mid = JSON.parse(JSON.stringify(Z.P)); delete mid.story; for (let i = 37; i <= 44; i++) mid.m.done["m" + i] = 1; mid.m.active = "m45"; mid.m.step = Math.min(2, (D.MISSIONS.find((m) => m.id === "m45") || { steps: [1] }).steps.length - 1); mid.lvl = 150; mid.xp = S.xpForLevel(150);
    Z.begin(mid, false); run(.1); out.migrate.mid = Z.P.m.active + "/" + Z.P.m.step; }
  // side missions and encounters start and finish through the same machinery
  { const sm = (D.SIDE || [])[0]; out.side = { count: (D.SIDE || []).length, ambient: (D.AMBIENT || []).length, coop: (D.COOP || []).length };
    if (sm) { Z.P.m.active = ""; ST.state(Z.P).side = null; ST.startSide(sm); let g = 0; while (ST.state(Z.P).side && g++ < 60) { api._open = false; ST.solve("side", PICK); run(.03); } out.side.firstDone = !ST.state(Z.P).side; }
    const e = (D.AMBIENT || [])[0]; if (e && e.variants && e.variants[0]) { const m = ST.ambient(e, e.variants[0]); ST.offer(m, e.title, "help"); out.side.offerIsNotModal = !api._open; out.side.whoSpawned = !!Z.npc("amb_who"); Z.emit({ t: "talk", npc: "amb_who" }); out.side.acceptedByTalk = !!ST.state(Z.P).side; let g = 0; while (ST.state(Z.P).side && g++ < 30) { api._open = false; ST.solve("side", PICK); run(.03); } out.side.ambientDone = !ST.state(Z.P).side; } }
} catch (e) { out.ok = false; out.error = String(e && e.stack || e).split("\n").slice(0, 6).join(" | "); }
console.log(JSON.stringify(out)); process.exit(out.ok ? 0 : 1);
`;
eval(boot + mine);
