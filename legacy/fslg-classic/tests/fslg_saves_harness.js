/* Freshers School Life — save slots, headless (samaru-saves.js). Boots the game like samaru_harness.js and checks:
   round trips in every slot, autosave on sleep at the hostel (and not elsewhere), overwrite and delete through the slot
   screen with their confirmations, an old save migrated through a slot, saving refused in cutscenes and mid-step, slot
   isolation, a newer-build slot refused, a full device, private browsing, per-user keys, and the screen's markup.
   Usage: node fslg_saves_harness.js <static/js/games dir>. Prints one JSON object; exits 1 on a thrown error. */
"use strict";
const fs = require("fs"), path = require("path");
process.argv[2] = path.resolve(process.argv[2] || path.join(__dirname, "..", "..", "static", "js", "games"));
const src = fs.readFileSync(path.join(__dirname, "samaru_harness.js"), "utf8"), cut = src.indexOf("const out = { log: [] }");
const boot = new Function("require", "process", "__dirname", "module", "exports", src.slice(0, cut) + "\nreturn { Z: Z, S: S, D: D, api: api, run: run, store: store };");
const { Z, S, D, api, run, store } = boot(require, process, __dirname, module, exports);
const SV = Z.saves, out = { ok: true };
let html = ""; { const sh = api.show; api.show = function (h, on) { html = h; return sh.apply(this, arguments); }; }
const press = (a) => { if (!api._on) throw new Error("no dialog for " + a); api._on(a, { disabled: false, getAttribute: () => a, style: {}, classList: { add() {} } }); };
const raw = (id) => SV.mem[SV.key(id)] || null;
try {
  run(.3); if (Z.intro) Z.intro.noAuto = true;
  out.loaded = !!SV && SV.IDS.join(",") === "auto,1,2,3,4,5";
  const p = S.newPlayer("tunde", "Slots"); p.home = "ribadu"; api._open = false; Z.begin(p, true); if (Z.guide && Z.guide.skip) Z.guide.skip(); run(.5);
  const P = () => Z.P, me = Z.me;
  // a quiet moment between steps: finish whatever the first step is so nothing is "in progress"
  const quiet = () => { api._open = false; P().m.n = 0; if (Z.story) { Z.story.queue.length = 0; Z.story.sayT = 0; } Z.hideHud = false; if (Z.momentClear) Z.momentClear(); };
  quiet(); out.canSaveFresh = SV.canSave();
  // 1. round trip in every slot
  out.roundTrip = {};
  for (const id of SV.IDS) { quiet(); P().money = 1000 + SV.IDS.indexOf(id); P().day = 3 + SV.IDS.indexOf(id); const r = SV.save(id); P().money = 7; P().day = 99; const l = SV.load(id); run(.1);
    out.roundTrip[id] = r.ok && l.ok && P().money === 1000 + SV.IDS.indexOf(id) && P().day === 3 + SV.IDS.indexOf(id) && P().saveVersion === Z.SAVE_VERSION; }
  { const rec = SV.read("1"); out.card = rec && rec.meta; out.cardFields = !!rec && ["mission", "num", "year", "day", "time", "money", "lvl", "play"].every((k) => k in rec.meta) && typeof rec.at === "number"; }
  // 2. autosave on sleep: at the hostel yes, elsewhere no
  { quiet(); SV.remove("auto"); const h = Z.place(P().home); me.x = h.mx + 2; me.y = h.my + 2; if (me.veh) Z.exit(true); const d0 = P().day; Z.sleep(); run(.2); const a = SV.read("auto");
    out.autosave = { written: !!a, day: a && a.meta.day, afterSleep: !!a && a.meta.day > d0, result: SV.lastAuto };
    SV.remove("auto"); quiet(); const far = Z.place("dam"); me.x = far.mx; me.y = far.my; Z.sleep(); run(.2); out.autosave.notAway = !SV.read("auto"); }
  // 3. overwrite and delete through the screen (with confirmations)
  { quiet(); P().money = 4242; SV.save("2"); P().money = 5151; SV.open(null); out.screen = { slots: (html.match(/class='fs-slot'/g) || []).length, hasOver: html.indexOf("data-act='over:2'") > 0, hasSave: html.indexOf("data-act='save:4'") > 0 || !!SV.read("4"), back: html.indexOf("data-act='back'") > 0, last: /Last played/.test(html) };
    press("over:2"); out.screen.overAsks = /Overwrite Slot 2\?/.test(html) && SV.read("2").data.money === 4242; press("yes"); out.screen.overwritten = SV.read("2").data.money === 5151;
    press("del:2"); out.screen.delAsks = /Delete Slot 2\?/.test(html) && !!SV.read("2"); press("no"); out.screen.cancelKeeps = !!SV.read("2"); press("del:2"); press("yes"); out.screen.deleted = !SV.read("2");
    // loading mid-game asks first
    SV.save("5"); SV.open(null); press("load:5"); out.screen.loadAsks = /Load Slot 5\?/.test(html); press("no"); press("back"); out.screen.closed = !api._open; }
  // 4. an old save (before saveVersion, before the Year 1 rewrite) migrated through a slot
  { const old = JSON.parse(JSON.stringify(P())); delete old.saveVersion; old.v = 1; if (old.story) { delete old.story.ver; delete old.story.y1v; } old.m = { active: "m12", step: 3, n: 0, done: {} }; for (let i = 1; i <= 11; i++) old.m.done["m" + i] = 1;
    SV.mem[SV.key("4")] = JSON.stringify({ f: 1, id: "4", at: 1, meta: SV.meta(old), thumb: "", data: old }); const cash = old.money; const l = SV.load("4"); run(.2);
    out.migrate = { ok: l.ok, saveVersion: P().saveVersion, v: P().v, storyVer: P().story && P().story.ver, storyCurrent: !!P().story && P().story.ver === Z.story.SAVE_VERSION, active: P().m.active, step: P().m.step, paid: P().money - cash }; }
  // 5. refused in cutscenes and mid-step
  { quiet(); SV.remove("3"); const b = {}; Z.intro.on = true; b.film = SV.save("3"); Z.intro.on = false; Z.hideHud = true; b.cutscene = SV.save("3"); Z.hideHud = false;
    Z.story.queue.push(["me", "…"]); b.talking = SV.save("3"); Z.story.queue.length = 0; Z.story.sayT = 0;
    if (P().m.active) { P().m.n = 1; b.midStep = SV.save("3"); P().m.n = 0; }
    out.blocked = { film: !b.film.ok && /opening film/.test(b.film.why), cutscene: !b.cutscene.ok && /cutscene/.test(b.cutscene.why), talking: !b.talking.ok, midStep: !b.midStep || (!b.midStep.ok && /between steps/.test(b.midStep.why)), noWrite: !SV.read("3") };
    Z.mode = "title"; out.blocked.title = !SV.save("3").ok; Z.mode = "play"; quiet(); out.blocked.boundary = SV.save("3").ok; }
  // 6. isolation: loading slot 2 never changes slot 3
  { quiet(); P().money = 222; SV.save("2"); P().money = 333; SV.save("3"); const r3 = raw("3"); SV.load("2"); run(2); P().money += 5; Z.save(); quiet(); SV.save("1");
    out.isolation = { slot3Same: raw("3") === r3, loaded2: SV.read("2").data.money === 222 };
    const a = SV.read("2").data; a.money = -1; out.isolation.readIsCopy = SV.read("2").data.money === 222; }
  // 7. a slot from a newer build is refused and left alone
  { const rec = JSON.parse(raw("3")); rec.data.saveVersion = 99; SV.mem[SV.key("3")] = JSON.stringify(rec); const before = raw("3"); const l = SV.load("3"); out.newer = { refused: !l.ok && /newer/.test(l.why), untouched: raw("3") === before }; }
  // 8. a full device: the picture is dropped first; if it still does not fit, nothing is overwritten
  { const mem = {}; let limit = 1e9; global.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { if (String(v).length > limit) { const e = new Error("quota"); e.name = "QuotaExceededError"; throw e; } mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
    quiet(); SV.thumb = () => "data:image/jpeg;base64," + "A".repeat(9000); const ok = SV.save("1"); const size = mem[SV.key("1")].length; limit = size - 100; const small = SV.save("1"); const kept = mem[SV.key("1")]; limit = 50; const full = SV.save("1");
    out.quota = { persistent: SV.persistent, firstOk: ok.ok, droppedPicture: small.ok && small.noThumb, failsClearly: !full.ok && /no room/.test(full.why), keptOld: mem[SV.key("1")] === kept };
    // per user: the play page's data-gm-user names the key
    const q = document.querySelector; document.querySelector = (s) => s === "[data-gm-stage]" ? { getAttribute: (a) => a === "data-gm-user" ? "u42" : "" } : q(s); out.perUser = /:u42:1$/.test(SV.key("1")); document.querySelector = q;
    delete global.localStorage; SV.read("1"); out.privateNote = /not keeping saves/.test(SV.html()); }
  // 9. the screen: every button has an action, nothing tiny, readable labels
  { SV.open(null); const btns = html.match(/<button[^>]*>/g) || []; out.markup = { buttons: btns.length, allActs: btns.every((b) => /data-act='/.test(b)), minHeight: /min-height:44px/.test(html), smallScreen: /max-width:420px/.test(html), groups: (html.match(/role='group'/g) || []).length };
    press("back"); fs.writeFileSync(path.join(process.env.FSLG_SAVES_HTML_DIR || require("os").tmpdir(), "fslg-saves-screen.html"), html); }
} catch (e) { out.ok = false; out.error = String(e && e.stack || e).split("\n").slice(0, 6).join(" | "); }
console.log(JSON.stringify(out));
process.exit(out.ok ? 0 : 1);
