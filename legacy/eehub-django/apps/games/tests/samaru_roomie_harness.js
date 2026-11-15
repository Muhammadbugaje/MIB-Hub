/* Every room choice, for both sexes (and "Let fate decide"): the chosen roommate, and only them, is in your room —
   on entering, after sleeping, and after saving and loading. Reuses the boot section of samaru_harness.js.
   Usage: node samaru_roomie_harness.js <static/js/games dir> */
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "samaru_harness.js"), "utf8");
const boot = src.slice(0, src.indexOf("const out = { log: [] }"));
const mine = String.raw`
const out = { ok: true, cases: [] };
try {
  run(.3); const ST = Z.story, I = Z.interior, ROOMIES = new Set(["bature", "sadiq", "muktar", "yusuf", "khalid", "firdausi", "nusaybah", "aleeya", "emily", "lily", "fatima"]);
  function roomPeople() { // who is in your room (people who came in because they live there, not friends walking with you)
    const c = Z.inside; if (!c) return null; return c.moved.filter((q) => !q.n.follow && !q.n.lead).map((q) => q.n.id).sort();
  }
  function enterRoom() { const home = Z.places[Z.P.home]; Z.me.x = home.mx; Z.me.y = home.my; run(.2); I.enter(home); for (let k = 0; !Z.inside && k < 60; k++) { if (Z.momentClear) Z.momentClear(); api._open = false; run(.2); } return roomPeople(); }
  function leave() { if (I.leaveNow) I.leaveNow(); else if (I.exit) I.exit(); run(.3); }
  for (const who of [["tunde", "m"], ["amina", "f"]]) {
    // how many choices does this sex get? (5 rooms + fate)
    const probe = S.newPlayer(who[0], "Probe"); api._open = false; Z.begin(probe, true); run(.1); let g = 0; while (Z.step() && Z.step().t !== "choice" && g++ < 6) { api._open = false; ST.solve("main", 0); run(.05); }
    const n = ST.options(Z.step()).length;
    for (let i = 0; i < n; i++) {
      const p = S.newPlayer(who[0], "Room" + i); p.life = { sex: who[1], dept: "elect", faith: "", acad: 100 }; api._open = false; Z.begin(p, true); run(.1);
      let k = 0; while (Z.step() && Z.step().t !== "choice" && k++ < 6) { api._open = false; ST.solve("main", 0); run(.05); }
      const opt = ST.options(Z.step())[i].o; api._open = false; ST.pick({ which: "main", id: "m1", i: Z.P.m.step, m: Z.mission(), st: Z.step() }, Z.step(), ST.options(Z.step())[i].i); run(.1);
      const chosen = ST.roomie(), c = { sex: who[1], option: opt.label, fate: !!opt.fate, roomie: chosen, home: Z.P.home };
      c.first = enterRoom(); leave();
      Z.sleep(); run(.5); c.afterSleep = enterRoom(); leave();
      Z.save(); const back = Z.load(); api._open = false; Z.begin(back, false); run(.2); c.reloaded = ST.roomie(); c.afterLoad = enterRoom(); leave();
      c.ok = [c.first, c.afterSleep, c.afterLoad].every((l) => l && l.length === 1 && l[0] === chosen) && c.reloaded === chosen && (opt.fate || chosen === opt.roomie) && ROOMIES.has(chosen);
      out.cases.push(c);
    }
  }
  // an old save from before the room choice keeps the roommate it had (Sadiq) and only him
  { const old = S.newPlayer("tunde", "Old"); old.m.done.m1 = 1; old.m.done.m2 = 1; delete old.story; api._open = false; Z.begin(old, false); run(.1); out.old = { roomie: ST.roomie(), room: enterRoom() }; leave(); }
} catch (e) { out.ok = false; out.error = String(e && e.stack || e).split("\n").slice(0, 6).join(" | "); }
console.log(JSON.stringify(out)); process.exit(out.ok ? 0 : 1);
`;
eval(boot + mine);
