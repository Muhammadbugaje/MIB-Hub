/* Freshers School Life — content validator (docs/MASTER_GAME_GUIDE.md §4.6).
   Boots the real game headlessly (the boot section of samaru_harness.js: stub DOM, fixed seed, sim clock), takes the
   merged story data the game itself uses (D.MISSIONS after ST.merge, D.NPCS, D.ITEMS, the map's places) and checks it.
   It also asks the live engine (Z.target, Z.stepStart, the go trigger) what the guide arrow and map marker would show
   for each step, so "the data says X but the arrow says Y" is caught, not only typos.

   Usage: node fslg_validator.js <static/js/games dir> [--md <report.md>] [--json <out.json>]
   Prints one JSON object on the last line: { ok, errors: [...], warnings: [...], review: [...], travel: [...], stats }.
   errors   = clear breakage (fail CI). Each has a stable `key` so known ones can be tracked in KNOWN_ISSUES.md.
   warnings = real but not blocking yet (systems not built: resolveText, cutscene meta on moments, seat anchors…).
   review   = fuzzy text-vs-place mismatches for a person to look at (never fail).
   Deterministic: no Date.now / Math.random in anything it computes (the boot seeds both). */
"use strict";
const fs = require("fs"), path = require("path");
const args = process.argv.slice(2), dir = path.resolve(args[0] || path.join(__dirname, "..", "..", "static", "js", "games"));
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const ROOT = path.resolve(dir, "..", "..", "..");
process.argv[2] = dir; // the harness boot reads its directory from argv[2]
const src = fs.readFileSync(path.join(__dirname, "samaru_harness.js"), "utf8"), cut = src.indexOf("const out = { log: [] }");
const boot = new Function("require", "process", "__dirname", "module", "exports", src.slice(0, cut) + "\nreturn { Z: Z, S: S, D: D, api: api, GAME: GAME, run: run, keys: keys, pressed: pressed };");

const out = { ok: true, errors: [], warnings: [], review: [], travel: [], stats: {}, probes: {} };
const E = (key, code, where, msg, owner) => out.errors.push({ key: code + ":" + key, code, where, msg, owner: owner || "" });
const W = (key, code, where, msg, owner) => out.warnings.push({ key: code + ":" + key, code, where, msg, owner: owner || "" });
const R = (code, where, msg, owner) => out.review.push({ code, where, msg, owner: owner || "" });
const arr = (v) => v == null ? [] : Array.isArray(v) ? v : [v];
const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

let G;
try { G = boot(require, process, __dirname, module, exports); } catch (e) { console.log(JSON.stringify({ ok: false, error: "boot: " + String(e && e.stack || e).split("\n").slice(0, 4).join(" | ") })); process.exit(1); }
const { Z, S, D, api, run } = G, ST = Z.story;
// The harness's script list is someone else's file; scripts the catalogue ships that it does not load are loaded here
// (after the boot) and reported, so the validator still sees e.g. samaru-overrides.js (config, resolveText).
try { const cat = fs.readFileSync(path.join(ROOT, "games", "catalogue.py"), "utf8"), m = /Game\("samaru-days"[\s\S]*?"deps": (\[[^\]]*\])/.exec(cat), deps = m ? JSON.parse(m[1]) : [], have = JSON.parse(/for \(const \w+ of (\[[^\]]+\])/.exec(src)[1]);
  out.stats.harnessMissing = deps.filter((d) => have.indexOf(d) < 0); out.stats.harnessExtra = have.filter((d) => deps.indexOf(d) < 0 && d !== "samaru");
  out.stats.harnessMissing.filter((f) => f !== "samaru-3d" /* WebGL view: headless runs use the map view */).forEach((f) => { try { (0, eval)(fs.readFileSync(path.join(dir, f + ".js"), "utf8")); } catch (e) { out.errors.push({ key: "LOAD:" + f, code: "LOAD", where: f, msg: "throws when loaded: " + String(e).slice(0, 120), owner: "" }); } });
} catch (e) { out.stats.harnessMissing = "unknown: " + e; }

try {
  run(.3);
  if (Z.intro) Z.intro.noAuto = true;
  // A fixed test student: male, Bature's room (Ribadu). Tokens (@roomie, @hostel, @dept…) resolve against this player.
  const p = S.newPlayer("tunde", "Validator"); p.home = "ribadu"; api._open = false; Z.begin(p, true);
  if (Z.guide && Z.guide.skip) Z.guide.skip();
  const P = Z.P; ST.state(P).roomie = "bature"; ST.applyRoomie(P); run(.2);
  // Self-test: FSLG_VALIDATOR_INJECT=1 puts back the bugs the outside review (docs/FSLG_REVIEW.md) found, so the test can
  // prove the validator catches each of them even after the content and engine are fixed.
  if (process.env.FSLG_VALIDATOR_INJECT) {
    const mis = (id) => D.MISSIONS.find((m) => m.id === id), stp = (id, f) => (mis(id) || { steps: [] }).steps.find(f);
    const inj = out.injected = [];
    const put = (id, f, k, v) => { const s = stp(id, f); if (s) { s[k] = v; inj.push(id + "." + (mis(id).steps.indexOf(s) + 1) + " " + k + "=" + v); } };
    put("m1", (s) => s.t === "find" && s.item === "backpack", "at", "gate");            // review §1.1
    put("m4", (s) => s.t === "find" && s.item === "torch", "at", "gate");               // review §1.1
    put("m10", (s) => s.t === "find" || s.t === "collect", "at", "gate");                // review §1.2
    put("m32", (s) => (s.t === "find" || s.t === "collect") && /winding|copper/.test(s.item + s.text), "at", "gate"); // review §1.2
    const mar = D.NPCS.find((n) => n.id === "maryam"); if (mar) { mar.at = "fire"; inj.push("npc maryam at=fire"); } // review §1.3
    // review §2: the go trigger cached the place across steps; restoring the cache after stepStart reproduces it exactly
    const os = Z.stepStart; Z.stepStart = function () { const lp = Z.lastPlace; const r = os.apply(this, arguments); Z.lastPlace = lp; return r; }; inj.push("Z.stepStart keeps Z.lastPlace");
    // review §3.1: the arrow pointed at the place centre, not at the item
    const ot = Z.target; Z.target = function () { const st = Z.step && Z.step(); if (st && st.t === "find" && Z.quest) { const q = Z.place(st.at); if (q) return { x: q.mx, y: q.my, name: q.name }; } return ot.apply(this, arguments); }; inj.push("Z.target ignores Z.quest");
  }
  out.stats.player = { home: P.home, roomie: ST.tok(P, "@roomie"), dept: (Z.place("@dept") || {}).id || "" };

  /* ---------------- dictionaries ---------------- */
  const places = {}; Z.placeList.forEach((q) => { places[q.id] = q; });
  const placeIds = new Set(Object.keys(places)), npcIds = new Set(D.NPCS.map((n) => n.id));
  const TOKEN_RE = /^(@(roomie|best|crush|partner|hod|boss|hostel|home|dept|super|place)|\$(who|here|other))$/;
  const SPEAKER_OK = (s) => !s || s === "me" || s === "radio" || /^(crowd|phone|radio):/.test(s) || /^(mum|dad|advert|uncle)$/.test(s) || /^intro_/.test(s);
  const resolvePlace = (id) => { if (id == null || id === "") return null; if (Array.isArray(id)) return null; const r = Z.place(id); return r ? { id: r.id, x: r.mx, y: r.my, name: r.name } : null; };
  const npcDef = (id) => { const t = ST.tok(P, id); return D.NPCS.find((n) => n.id === t) || null; };
  const npcHome = (id) => { const n = npcDef(id); return n ? resolvePlace(n.at) : null; };
  // a token is known when the engine resolves it to a real place (ST.tok), not just because Z.place falls back to your hostel
  const placeKnown = (v) => v == null || placeIds.has(v) || TOKEN_RE.test(v) || !!ST.PLACE_ALIAS[v] || (/^[@$]/.test(v) && ST.tok(P, v) !== v && placeIds.has(ST.tok(P, v)));
  const npcKnown = (v) => v == null || npcIds.has(v) || npcIds.has(ST.tok(null, v)) || TOKEN_RE.test(v);
  const EMOTES = new Set(["wave", "dance", "sit", "cheer", "phone", "point", "clap", "bow", "pray", "shrug", "laugh", "cry", "salute"]);
  const ITEMS = D.ITEMS, ENEMIES = D.ENEMIES, RACES = new Set((D.ROUTES || []).map((r) => r.id)), VEH = S.VEH;
  const main = D.MISSIONS.filter((m) => !m.side), side = (D.SIDE || []), legacySide = D.MISSIONS.filter((m) => m.side && side.indexOf(m) < 0);
  out.stats.missions = { main: main.length, side: side.length, legacyGoals: legacySide.length, ambient: (D.AMBIENT || []).length, coop: (D.COOP || []).length, steps: main.reduce((a, m) => a + m.steps.length, 0), places: placeIds.size, npcs: npcIds.size, items: Object.keys(ITEMS).length };

  /* ---------------- 1. ids: unknown and duplicate ---------------- */
  { const seen = {}; [].concat(D.MISSIONS, side.filter((m) => D.MISSIONS.indexOf(m) < 0), D.AMBIENT || [], D.COOP || []).forEach((m) => { if (!m || !m.id) return; if (seen[m.id] && seen[m.id] !== m) E(m.id, "DUP_ID", m.id, "mission/encounter id used twice", "story"); seen[m.id] = m; });
    const ns = {}; D.NPCS.forEach((n) => { if (ns[n.id]) E(n.id, "DUP_NPC", n.id, "npc id defined twice in D.NPCS", "story"); ns[n.id] = 1; });
    const ps = {}; D.PLACES.forEach((q) => { if (ps[q.id]) E(q.id, "DUP_PLACE", q.id, "place id defined twice", "map"); ps[q.id] = 1; });
    const names = {}; D.PLACES.forEach((q) => { const k = q.name.toLowerCase(); (names[k] = names[k] || []).push(q.id); });
    // two places that a player would call by the same words (e.g. "Chemical Engineering")
    const core = (n) => n.toLowerCase().replace(/\(.*?\)/g, "").replace(/\b(pilot plant|department of|faculty of|the)\b/g, "").replace(/\s+/g, " ").trim();
    const cores = {}; D.PLACES.forEach((q) => { const k = core(q.name); (cores[k] = cores[k] || []).push(q.id); });
    Object.keys(cores).forEach((k) => { if (cores[k].length > 1) W(cores[k].join("+"), "SAME_NAME", cores[k].join(", "), "places a player would call by the same name \"" + k + "\" (text can name the wrong one)", "map"); });
    // place markers whose 13 m go-trigger circles overlap: the nearer one wins, so the other may never fire from that spot
    const L = Z.placeList; for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const dd = Math.hypot(L[i].mx - L[j].mx, L[i].my - L[j].my); if (dd < 13) W(L[i].id + "+" + L[j].id, "ZONE_OVERLAP", L[i].id + " / " + L[j].id, "go-trigger zones (13 m) overlap: markers " + dd.toFixed(1) + " m apart", "map"); }
    const inB = Z.placeList.filter((q) => S.insideBuilding(Z.W, q.mx, q.my)).map((q) => q.id); inB.forEach((id) => E(id, "MARKER_IN_WALL", id, "place marker is inside a building footprint (go trigger may be unreachable)", "map"));
  }

  /* ---------------- 2. references in every step ---------------- */
  const KNOWN = ST.KNOWN, flagSetAt = {}; // flag -> first "mission.step" that sets it (main order)
  (ST.ENGINE_FLAGS || []).forEach((f) => { flagSetAt[f] = "engine"; });
  const all = main.concat(side);
  all.forEach((m) => {
    if (!m.steps || !m.steps.length) E(m.id, "EMPTY_MISSION", m.id, "mission has no steps", "story");
    ((m.need || {}).done || []).forEach((id) => { if (!D.MISSIONS.some((q) => q.id === id) && !side.some((q) => q.id === id)) E(m.id + "<" + id, "BAD_NEED", m.id, "need.done points to unknown mission " + id, "story"); });
    if (m.giver && !npcKnown(m.giver)) (SPEAKER_OK(m.giver) ? W : E)(m.id + ".giver", "BAD_NPC", m.id, (SPEAKER_OK(m.giver) ? "giver is a speaker label, not a person: " : "unknown giver ") + m.giver, "story");
    if (m.where && !placeKnown(m.where)) E(m.id + ".where", "BAD_PLACE", m.id, "unknown where " + m.where, "story");
    m.steps.forEach((s, j) => {
      const at = m.id + "." + (j + 1), loc = (v, f) => { if (v != null && !placeKnown(v)) E(at + "." + f, "BAD_PLACE", at, f + " '" + v + "' is not a place on the map", "story"); };
      if (KNOWN.indexOf(s.t) < 0) E(at, "BAD_TYPE", at, "unknown step type " + s.t, "story");
      loc(s.place, "place"); if (!Array.isArray(s.at)) loc(s.at, "at");
      if (s.t === "flight") arr(s.route).forEach((q, k) => loc(q, "route[" + k + "]"));
      if (s.t === "routine") arr(s.at).forEach((e, k) => loc(e && e[0], "at[" + k + "]"));
      if (s.npc != null && !npcKnown(s.npc)) E(at + ".npc", "BAD_NPC", at, "unknown npc " + s.npc, "story");
      if (s.npc && npcIds.has(ST.tok(P, s.npc)) && (npcDef(s.npc) || {}).retired) E(at + ".retired", "RETIRED_NPC", at, "step uses retired npc " + s.npc, "story");
      ["item", "give", "take"].forEach((f) => { if (s[f] && !ITEMS[s[f]]) E(at + "." + f, "BAD_ITEM", at, f + " '" + s[f] + "' is not an item", "story"); });
      for (const k in (s.parts || {})) if (!ITEMS[k]) E(at + ".part." + k, "BAD_ITEM", at, "part '" + k + "' is not an item", "story");
      if (s.enemy && !ENEMIES[s.enemy]) E(at + ".enemy", "BAD_ENEMY", at, "unknown enemy " + s.enemy, "story");
      if (s.t === "race" && !s.race) W(at + ".race", "RACE_ANY", at, "race step names no race id (any race completes it; the guide sends you to the Racing Club)", "story");
      if (s.race && !RACES.has(s.race)) E(at + ".race", "BAD_RACE", at, "unknown race " + s.race, "story");
      if (s.veh && !VEH[s.veh]) E(at + ".veh", "BAD_VEH", at, "unknown vehicle " + s.veh, "story");
      if (s.t === "ride" && !s.veh) W(at + ".veh", "RIDE_ANY", at, "ride step names no vehicle", "story");
      if (s.emote && !EMOTES.has(s.emote)) E(at + ".emote", "BAD_EMOTE", at, "unknown emote/animation " + s.emote, "anim");
      if (s.t === "emote" && !s.at && !s.npc) W(at + ".emote", "EMOTE_ANYWHERE", at, "emote step has no place or person: it completes anywhere (\"" + s.text + "\")", "story");
      arr(s.lines).concat(s.say ? [s.say] : []).forEach((l) => { if (Array.isArray(l) && l[0] && !SPEAKER_OK(l[0]) && !npcKnown(l[0])) E(at + ".speaker." + l[0], "BAD_SPEAKER", at, "unknown speaker " + l[0], "story"); });
      arr(s.options).forEach((o, k) => { if (o.partner && !npcKnown(o.partner)) E(at + ".opt" + k, "BAD_NPC", at, "option partner " + o.partner, "story"); if (o.home && !placeKnown(o.home)) E(at + ".opt" + k + ".home", "BAD_PLACE", at, "option home " + o.home, "story"); if (o.roomie && !npcKnown(o.roomie)) E(at + ".opt" + k + ".roomie", "BAD_NPC", at, "option roomie " + o.roomie, "story"); });
      if (s.music && typeof s.music !== "string") W(at + ".music", "BAD_MUSIC", at, "music cue is not a name", "audio");
      if ((s.t === "choice" || s.t === "choose" || s.t === "vote") && arr(s.options).length < 2) E(at + ".opts", "BAD_CHOICE", at, "choice with fewer than two options", "story");
      if (s.fail && s.fail.resume != null && (s.fail.resume < 0 || s.fail.resume >= m.steps.length)) E(at + ".resume", "BAD_RESUME", at, "fail.resume " + s.fail.resume + " is outside the mission", "story");
      if (!s.text && ["turn", "choice", "choose", "vote"].indexOf(s.t) < 0) W(at + ".text", "NO_TEXT", at, "step has no objective text", "story");
      if (s.text && s.text.length > 90) W(at + ".long", "LONG_TEXT", at, "objective text is " + s.text.length + " characters (contract: ≤ 60)", "story");
    });
    if (m.fail && m.fail.resume != null && (m.fail.resume < 0 || m.fail.resume >= m.steps.length)) E(m.id + ".resume", "BAD_RESUME", m.id, "fail.resume outside the mission", "story");
    const rw = m.reward || {}; if (rw.item && !ITEMS[rw.item]) E(m.id + ".reward", "BAD_ITEM", m.id, "reward item " + rw.item, "story");
    for (const n in (rw.friend || {})) if (!npcKnown(n)) E(m.id + ".friend." + n, "BAD_NPC", m.id, "reward friend " + n, "story");
  });
  // npc homes on the map
  D.NPCS.forEach((n) => { if (n.at && !placeKnown(n.at)) E("npc." + n.id, "BAD_PLACE", "npc " + n.id, "npc home '" + n.at + "' is not a place", "story"); });

  /* ---------------- 3. graph: reachable, no loops, no dead ends, flags set before use ---------------- */
  { const byId = {}; main.forEach((m) => { byId[m.id] = m; });
    const state = {}, order = []; let cyc = null;
    const visit = (m, stack) => { if (state[m.id] === 2) return; if (state[m.id] === 1) { cyc = cyc || stack.concat(m.id).join(" → "); return; } state[m.id] = 1; ((m.need || {}).done || []).forEach((id) => byId[id] && visit(byId[id], stack.concat(m.id))); state[m.id] = 2; order.push(m.id); };
    main.forEach((m) => visit(m, [])); if (cyc) E("cycle", "LOOP", cyc, "need.done forms a loop", "story");
    // reachable: m1 has no needs; every other main mission's needs must be reachable
    const reach = { }; let changed = true; while (changed) { changed = false; main.forEach((m) => { if (reach[m.id]) return; const nd = (m.need || {}).done || []; if (nd.every((id) => reach[id] || !byId[id] && side.some((q) => q.id === id))) { reach[m.id] = 1; changed = true; } }); }
    main.forEach((m) => { if (!reach[m.id]) E(m.id, "UNREACHABLE", m.id, "cannot be reached from m1 through need.done", "story"); });
    // dead end: a main mission (not the last) that no later mission depends on
    const needed = {}; main.forEach((m) => ((m.need || {}).done || []).forEach((id) => { needed[id] = 1; }));
    main.slice(0, -1).forEach((m) => { if (!needed[m.id]) E(m.id, "DEAD_END", m.id, "no mission follows it (nothing needs it)", "story"); });
    // level gates must not go down
    let lv = 0; main.forEach((m) => { const l = (m.need || {}).lvl || 0; if (l < lv) W(m.id, "GATE_DOWN", m.id, "level gate " + l + " is below the previous " + lv, "story"); lv = Math.max(lv, l); });
    // flags: set somewhere before use (main order; side flags count as set when the side mission is available)
    const setBy = (f, where) => { if (!flagSetAt[f]) flagSetAt[f] = where; };
    main.forEach((m) => {
      ((m.need || {}).flags || []).forEach((f) => { if (!flagSetAt[f]) E(m.id + ".need." + f, "FLAG_NEVER_SET", m.id, "needs flag " + f + " that nothing sets before it", "story"); });
      m.steps.forEach((s, j) => { const at = m.id + "." + (j + 1);
        [s.if, s.unless].forEach((f) => { if (f && !flagSetAt[f]) E(at + ".flag." + f, "FLAG_NEVER_SET", at, "if/unless flag " + f + " is never set before this step", "story"); });
        arr(s.set).forEach((f) => setBy(f, at)); arr(s.options).forEach((o) => { arr(o.set).forEach((f) => setBy(f, at)); if (o.partner) setBy("has_partner", at); if (o.boss) setBy("boss_" + o.boss, at); });
        if (s.t === "awards" || s.title) {} });
      arr((m.reward || {}).flags).concat(arr((m.reward || {}).flag)).forEach((f) => setBy(f, m.id));
    });
    // every step skipped: a mission whose steps all carry if/unless on flags the same choice sets exclusively still has a path
    main.forEach((m) => { if (m.steps.length && m.steps.every((s) => s.if || s.unless)) W(m.id, "ALL_CONDITIONAL", m.id, "every step is conditional: a player matching none sees an empty mission", "story"); });
  }

  /* ---------------- 4. where each step happens, the scene, stalls, leaks, travel ---------------- */
  const HOME = (id) => id === "@home" || id === "@hostel";
  const endLoc = (s) => { // where the player stands when the step completes (null = unchanged / anywhere)
    const t = s.t, pl = (v) => resolvePlace(v);
    if (["go", "look", "watch", "listen", "social", "stealth", "defend", "build", "carry", "delivery", "escort", "walk", "convoy", "tail", "care", "bank", "eat", "class"].indexOf(t) >= 0 && s.place) return pl(s.place);
    if (["find", "collect", "fight", "boss", "emote", "sports"].indexOf(t) >= 0 && s.at && !Array.isArray(s.at)) return pl(s.at);
    if (t === "sleep") return pl(s.place || "@home");
    if (t === "flight") return pl(arr(s.route).slice(-1)[0]);
    if (t === "routine") return pl((arr(s.at).slice(-1)[0] || [])[0]);
    if (s.npc && s.npcAt && ["talk", "quiz", "teach", "listen", "look", "watch", "care"].indexOf(t) >= 0) return pl(s.npcAt); // the engine moves the person there for this step (samaru-story.js start())
    if (s.npc && ["talk", "quiz", "teach", "chase", "listen", "look", "watch", "care"].indexOf(t) >= 0) return npcHome(s.npc);
    return null;
  };
  // probe the engine once: does a go step to the place you are standing at fire without moving?
  { const m = main[0], g = Z.places.senate, me = Z.me; const save = { a: P.m.active, s: P.m.step, n: P.m.n };
    me.x = g.mx; me.y = g.my; if (me.veh) Z.exit(true); run(.5);
    const fake = { id: "__probe", title: "probe", steps: [{ t: "talk", npc: "garba", text: "probe" }, { t: "go", place: "senate", text: "probe" }], reward: {}, need: { done: [] } };
    D.MISSIONS.push(fake); P.m.active = "__probe"; P.m.step = 1; P.m.n = 0; Z.stepStart(); run(1.5);
    out.probes.goWhileStanding = P.m.active !== "__probe" || P.m.step !== 1 ? "fires" : "stalls";
    D.MISSIONS.splice(D.MISSIONS.indexOf(fake), 1); delete P.m.done.__probe; P.m.active = save.a; P.m.step = save.s; P.m.n = save.n; void m;
  }
  const stallIsBug = out.probes.goWhileStanding === "stalls";
  // 4a. text names a place: a dictionary of what players read
  const NAMES = []; { const add = (re, id) => NAMES.push({ re: new RegExp("\\b(" + re + ")\\b", "i"), id });
    Z.placeList.forEach((q) => { if (q.role === "stop") return; const n = q.name.replace(/\s*\(.*?\)/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); add(n, q.id); });
    [["senate", "senate"], ["sick ?bay", "sickbay"], ["main gate|the gate", "gate"], ["basketball court|the court", "court"], ["racing club", "club"], ["flying club|airstrip|runway", "strip"], ["the dam|dam pier|the pier", "dam"], ["fire station", "fire"], ["radio studio|campus radio", "radio"],
      ["page turner|bookshop", "mk_books|bookshop"], ["the market|samaru market", "market"], ["chapel", "chapel"], ["central mosque", "mosque"], ["selfie garden|the fountain", "selfie"], ["sculpture garden", "sculpture"], ["library", "library"], ["shinkafi", "shinkafi"],
      ["buka|mama nkechi", "buka"], ["mai shayi", "shayi"], ["love garden", "love"], ["phase 2", "p2shops|p2canteen|p2park|p2mosque|p2chapel|dangote|danfodio|checkpoint|stalls"], ["your (hostel|room|bed)|the hostel|your hall", "@home"], ["social centre", "social"], ["pepsi garden", "pepsi"],
      ["physics", "physics"], ["chemical engineering", "chemeng|dept_chem"], ["staff quarters", "quarters"], ["mib store", "mibstore"], ["bank|atm", "bank"], ["nelt", "nelt"], ["engineering garden", "enggarden"], ["visitor centre", "damcentre"], ["the stalls|roadside stalls", "stalls"], ["the mall|mall", "market|mk_food|mk_supermarket|mk_electronics"],
      // stand-ins the content files use until the map has the real place (docs/story/ENGINE_ISSUES.md)
      ["substation|works yard", "fire"], ["old campus|ranger post|dark bend", "checkpoint"], ["ridge|forest|flooded stream|the stream", "lowerdam"]].forEach((a) => add(a[0], a[1]));
  }
  const namesIn = (t) => { const hit = new Set(); NAMES.forEach((n) => { if (n.re.test(t || "")) n.id.split("|").forEach((id) => hit.add(id)); }); return hit; };
  const sameOrNear = (a, set) => { for (const id of set) { const q = resolvePlace(id); if (q && a && (q.id === a.id || d2(q, a) < 60)) return true; } return false; };
  // npc homes on the map, and a role that names a place far from where the person stands (e.g. "works at Page Turner Books" at the Fire Station)
  D.NPCS.forEach((n) => { if (n.retired || !n.role || !n.at || n.at.charAt(0) === "@") return; const h = resolvePlace(n.at); if (!h) return; const nm = [...namesIn(n.role)].filter((id) => id.charAt(0) !== "@"); if (!nm.length) return; const near = nm.some((id) => { const q = resolvePlace(id); return q && d2(q, h) < 120; }); if (!near) { const q = resolvePlace(nm[0]); const msg = "role \"" + n.role + "\" names " + (q ? q.name : nm[0]) + " but they stand at " + h.name + " (" + (q ? Math.round(d2(q, h)) : "?") + " m away)"; if (/\b(works?|runs?|at|keeps?|owns?|sells?)\b/i.test(n.role)) E("npc." + n.id + ".at", "NPC_AT", "npc " + n.id, msg, "story"); else R("NPC_AT", "npc " + n.id, msg, "story"); } });
  let prevEnd = resolvePlace("gate"); // m1 starts at the Main Gate
  // One path through the story: the first option open to this (male) player at every choice; steps whose if/unless
  // does not hold on that path are skipped, so the five copies of a placement step do not count as five trips.
  const pathFlags = new Set(ST.ENGINE_FLAGS ? [] : []); let skipped = 0, stalls = [];
  const onPath = (s) => (!s.if || pathFlags.has(s.if)) && (!s.unless || !pathFlags.has(s.unless));
  const takeChoice = (s) => { const o = arr(s.options).find((x) => !x.sex || x.sex === "m") || arr(s.options)[0]; if (o) arr(o.set).forEach((f) => pathFlags.add(f)); arr(s.set).forEach((f) => pathFlags.add(f)); };
  main.forEach((m, mi) => {
    let scene = prevEnd, sceneSrc = "previous mission", pos = prevEnd; const pts = prevEnd ? [Object.assign({ step: 0 }, prevEnd)] : [];
    m.steps.forEach((s, j) => {
      if (!onPath(s)) { skipped++; return; }
      if (s.options) takeChoice(s); else arr(s.set).forEach((f) => pathFlags.add(f));
      const at = m.id + "." + (j + 1), here = endLoc(s), named = namesIn(s.text);
      // stall: a go step to the place you are already standing at (the go trigger only fires when the nearest place changes)
      if (s.t === "go" && here && pos && here.id === pos.id && !s.night) stalls.push(at);
      if (stallIsBug && s.t === "go" && here && pos && here.id === pos.id && !s.night) E(at, "GO_STALL", at, "go '" + s.place + "' while already standing at " + pos.id + " (previous step ends there): the go trigger never fires until you walk away and back", "core (Z.stepStart/lastPlace) + story");
      // find/collect/look placed by the generator's default ('gate') or away from the scene, and the text does not name it
      if (["find", "collect", "look", "watch"].indexOf(s.t) >= 0) {
        const tgt = resolvePlace(s.at || s.place);
        if (tgt && scene && tgt.id !== scene.id && d2(tgt, scene) > 60) {
          const textSaysTarget = sameOrNear(tgt, named), textSaysScene = sameOrNear(scene, named);
          const clear = !textSaysTarget && (named.size === 0 || textSaysScene) && (tgt.id === "gate" || (/^(find|collect)$/.test(s.t) && d2(tgt, scene) > 400)) && !(s.t === "collect" && (s.places || /\b(around|across|all over|other|each|every)\b/i.test(s.text)));
          if (!clear && !textSaysTarget) R("FIND_OFF_SCENE", at, s.t + " '" + (s.item || "") + "' at " + tgt.id + "; scene " + scene.id + " (" + sceneSrc + ", " + Math.round(d2(tgt, scene)) + " m); text \"" + s.text + "\"", "story");
          if (clear) E(at, "FIND_OFF_SCENE", at, s.t + " '" + (s.item || "") + "' is placed at " + tgt.id + " but the scene is at " + scene.id + " (" + sceneSrc + ", " + Math.round(d2(tgt, scene)) + " m away) and the text \"" + s.text + "\" does not name " + tgt.name, +m.id.slice(1) <= 36 ? "story (build_y1.py last_place / script at-tags)" : "story (fslg-story-y" + (m.year || "?") + ".js data)");
          else if (!textSaysTarget && named.size && !textSaysScene) R("FIND_TEXT", at, s.t + " at " + tgt.id + " but text names " + [...named].join("/") + ": \"" + s.text + "\"", "story");
        }
        if (tgt && tgt.id === "gate" && !named.has("gate") && !(scene && scene.id === "gate")) E(at + ".gate", "DEFAULT_GATE", at, s.t + " is placed at the Main Gate, which neither the scene nor the text mentions (\"" + s.text + "\")", +m.id.slice(1) <= 36 ? "story (build_y1.py default)" : "story (fslg-story-y" + (m.year || "?") + ".js data)");
      }
      // text names one place, the step goes elsewhere
      if (here && named.size && ["go", "find", "collect", "look", "talk", "watch", "listen", "social", "fight", "build", "carry", "delivery", "escort", "walk", "eat", "sleep", "defend"].indexOf(s.t) >= 0 && !sameOrNear(here, named)) {
        const ids = [...named], strong = ids.length === 1 && /^(go|find|collect)$/.test(s.t) && !/\b(from|past|leave|leaving|away from|back from|after|instead of|above|beyond|behind|near|opposite|towards?|across|out of)\b/i.test(s.text);
        const tp = resolvePlace(ids[0]); const far = tp && d2(tp, here) > 200;
        if (strong && far) E(at + ".text", "TEXT_PLACE", at, "text \"" + s.text + "\" names " + tp.name + " but the step's place is " + here.name + " (" + Math.round(d2(tp, here)) + " m apart)", "story");
        else R("TEXT_PLACE", at, "text \"" + s.text + "\" names " + ids.join("/") + "; step location is " + here.id + (s.npc ? " (npc " + s.npc + " lives there)" : ""), "story");
      }
      if (here) { pos = here; pts.push(Object.assign({ step: j + 1 }, here)); scene = here; sceneSrc = "step " + (j + 1) + " " + s.t; }
    });
    // travel: sum of legs vs. the shortest open tour of the same places from the same start
    if (pts.length > 2) {
      let walk = 0, back = 0; for (let i = 1; i < pts.length; i++) { walk += d2(pts[i - 1], pts[i]); if (i > 1 && pts[i].id === pts[i - 2].id && pts[i].id !== pts[i - 1].id) back++; }
      const uniq = []; pts.slice(1).forEach((q) => { if (!uniq.some((u) => u.id === q.id)) uniq.push(q); });
      const start = pts[0]; let best = Infinity;
      if (uniq.length <= 8) { const perm = (rest, cur, acc) => { if (acc >= best) return; if (!rest.length) { best = acc; return; } rest.forEach((q, k) => perm(rest.slice(0, k).concat(rest.slice(k + 1)), q, acc + d2(cur, q))); }; perm(uniq, start, 0); }
      else { let cur = start, rest = uniq.slice(); best = 0; while (rest.length) { let k = 0; rest.forEach((q, i) => { if (d2(cur, q) < d2(cur, rest[k])) k = i; }); best += d2(cur, rest[k]); cur = rest[k]; rest.splice(k, 1); } }
      out.travel.push({ id: m.id, title: m.title, steps: m.steps.length, metres: Math.round(walk), tour: Math.round(best), excess: Math.round(walk - best), ratio: +(walk / Math.max(1, best)).toFixed(2), backtracks: back, route: pts.map((q) => q.id).join(" → ") });
    }
    prevEnd = pos; void mi;
    arr((m.reward || {}).flags).forEach((f) => pathFlags.add(f));
  });
  out.stats.pathSkippedSteps = skipped; out.stats.goWhereYouStand = stalls; // harmless while the probe says "fires"
  out.travel.sort((a, b) => b.excess - a.excess);
  out.stats.travelKm = { year1: +(out.travel.filter((t) => +t.id.slice(1) <= 36).reduce((a, t) => a + t.metres, 0) / 1000).toFixed(1), all: +(out.travel.reduce((a, t) => a + t.metres, 0) / 1000).toFixed(1) };

  /* ---------------- 5. live: what the guide arrow, map marker and HUD show for every main step ---------------- */
  { const me = Z.me, keep = { a: P.m.active, s: P.m.step, n: P.m.n }; let checked = 0;
    if (me.veh) Z.exit(true); P.job = null;
    main.forEach((m) => m.steps.forEach((s, j) => {
      const at = m.id + "." + (j + 1); P.m.active = m.id; P.m.step = j; P.m.n = 0; Z.quest = null;
      try { Z.stepStart(); } catch (e) { E(at + ".start", "STEP_START_THROWS", at, "Z.stepStart threw: " + String(e).slice(0, 120), "core"); return; }
      let tg = null; try { tg = Z.target(); } catch (e) { E(at + ".target", "TARGET_THROWS", at, "Z.target threw: " + String(e).slice(0, 120), "core"); return; }
      if (tg === Z.waypoint) tg = null; checked++;
      let marker = null; try { const live = Z.bigmap && Z.bigmap.live ? Z.bigmap.live() : []; marker = live.find((q) => q.cat === "mission") || null; } catch (e) { E(at + ".map", "MAP_THROWS", at, "map live markers threw: " + String(e).slice(0, 120), "map"); }
      if (tg && !marker) E(at + ".marker", "NO_MAP_MARKER", at, "guide has a target but the map shows no mission marker", "map");
      if (tg && marker && Math.hypot(marker.x - tg.x, marker.y - tg.y) > 1) E(at + ".marker", "MARKER_DIFFERS", at, "map marker and guide target disagree", "map");
      const want = s.place || (!Array.isArray(s.at) && s.at) || null, wantP = resolvePlace(want), npc = s.npc ? Z.npc(ST.tok(P, s.npc)) : null;
      if (s.t === "find" && Z.quest) {
        if (!tg || Math.hypot(tg.x - Z.quest.x, tg.y - Z.quest.y) > 13) E(at + ".gem", "FIND_BEACON_OFF_GEM", at, "guide points " + (tg ? Math.round(Math.hypot(tg.x - Z.quest.x, tg.y - Z.quest.y)) + " m from" : "nowhere near") + " the item, which is drawn only within 18 m", "core (Z.target)");
        if (S.inWater && S.inWater(Z.W, Z.quest.x, Z.quest.y)) E(at + ".water", "GEM_IN_WATER", at, "find item spawns in water", "core");
      }
      if (wantP && !tg) E(at + ".nobeacon", "NO_BEACON", at, s.t + " step at " + wantP.id + " has no guide arrow / map marker", "core (Z.target)");
      else if (wantP && tg && !npc && d2(tg, wantP) > 25 && s.t !== "find" && s.t !== "collect") E(at + ".target", "TARGET_DIFFERS", at, "guide points at " + (tg.name || "?") + " but the step's place is " + wantP.name + " (" + Math.round(d2(tg, wantP)) + " m)", "core (Z.target)");
      else if (wantP && tg && npc && d2(tg, wantP) > 25) R("TARGET_NPC", at, s.t + ": guide follows " + npc.def.name + " while the destination is " + wantP.name, "core (Z.target)");
      if (!wantP && s.npc && !npc) E(at + ".npc", "NPC_NOT_SPAWNED", at, "npc " + s.npc + " (" + ST.tok(P, s.npc) + ") is not in the world: no target, cannot talk", "story");
      if (!wantP && !tg && /^(ride|class|eat|buy|race|job|sports)$/.test(s.t)) W(at + ".nobeacon", "NO_BEACON", at, s.t + " step has no guide arrow (\"" + s.text + "\")", "core (Z.target)");
      { const shown = typeof Z.objText === "function" ? Z.objText(s) : (s.text || ""); // what the HUD paints (Z.objective().text)
        if (/[@$][a-z_]+|\{\{/.test(shown)) E(at + ".hud", "HUD_TOKEN", at, "HUD objective shows a raw token: \"" + shown + "\"", "core HUD / config (resolveText)");
        if (typeof Z.objective === "function") { const ob = Z.objective(); if (ob.text !== shown || (tg && (!ob.target || ob.target.x !== tg.x || ob.target.y !== tg.y))) E(at + ".obj", "OBJECTIVE_DIFFERS", at, "Z.objective() disagrees with the step text or the arrow", "core"); } }
    }));
    P.m.active = keep.a; P.m.step = keep.s; P.m.n = keep.n; Z.quest = null; Z.stepStart(); out.stats.liveStepsChecked = checked;
  }

  /* ---------------- 6. cutscenes ---------------- */
  { const cuts = []; if (Z.intro && Z.intro.META) cuts.push(["opening (samaru-intro.js)", Z.intro.META]);
    cuts.forEach(([n, c]) => { ["endState", "maxDuration", "skippable"].forEach((f) => { if (c[f] == null) E(n + "." + f, "CUT_META", n, "cutscene lacks " + f, "story/intro"); }); });
    const momentSrc = fs.readFileSync(path.join(dir, "samaru-moment.js"), "utf8"); const kinds = /var KIND = \{([\s\S]*?)\};/.exec(momentSrc);
    if (kinds) { const ks = [...kinds[1].matchAll(/(\w+): \{/g)].map((x) => x[1]); W("moments", "CUT_META", "samaru-moment.js KIND", ks.length + " moments (" + ks.join(", ") + ") have dur but no endState/maxDuration/skippable fields (they queue and never pause, so they cannot trap the player)", "moments owner"); }
    const hooks = main.reduce((a, m) => a + m.steps.filter((s) => s.cutsceneBefore || s.cutsceneAfter || s.cutsceneOnEnter).length, 0);
    W("hooks", "CUT_HOOKS", "all steps", "no story step has cutsceneBefore/After/OnEnter (" + hooks + "); story beats are 'turn' steps and lines, not Director cutscenes (Phase 4)", "story");
    out.stats.cutscenes = { declared: cuts.length, moments: kinds ? [...kinds[1].matchAll(/(\w+): \{/g)].length : 0, stepHooks: hooks, turnSteps: main.reduce((a, m) => a + m.steps.filter((s) => s.t === "turn" || s.turn).length, 0) };
  }

  /* ---------------- 7. vehicles: seat anchors and head clearance ---------------- */
  { const SE = (Z.veh && Z.veh.SEATS) || null, HEAD = .98; // seated hip-to-crown of a 1.8 m figure at scale 1 (metres)
    if (!SE) W("seats", "VEH_SEATS", "samaru-veh.js", "no Z.veh.SEATS table: seat anchors cannot be checked", "vehicles");
    else (Z.veh.kinds || Object.keys(VEH)).forEach((k) => {
      const seats = SE[k]; if (!seats) { W(k, "VEH_SEATS", k, "vehicle kind has no seat table", "vehicles"); return; }
      const cap = (VEH[k] || {}).seats; if (!seats.length && cap > 0 && !(VEH[k] || {}).two) W(k + ".empty", "VEH_SEATS", k, "S.VEH says " + cap + " seat(s) but the seat table is empty (driver anchor only in the 3D mesh)", "vehicles");
      seats.forEach((st, i) => { if (!st.seat) { E(k + "." + i, "VEH_ANCHOR", k + " seat " + i, "seat without an anchor", "vehicles"); return; }
        if (st.roof != null) { const top = st.seat[1] + HEAD * (st.scale || 1); if (top > st.roof + .02) E(k + "." + i + ".head", "VEH_HEAD", k + " seat " + i, "head top " + top.toFixed(2) + " m is above the roof " + st.roof + " m", "vehicles"); } });
    });
  }

  /* ---------------- 8. text tokens and the game name ---------------- */
  { const has = typeof Z.resolveText === "function" || typeof Z.text === "function";
    const FS = global.FSLG && typeof global.FSLG.resolveText === "function" ? global.FSLG : null; if (FS && typeof Z.resolveText !== "function") Z.resolveText = (t) => FS.resolveText(t);
    if (typeof Z.resolveText !== "function") W("resolveText", "NO_RESOLVETEXT", "samaru-story.js", "no Z.resolveText yet (Z.text exists: " + (typeof Z.text === "function") + "); token checks use Z.text", "config");
    const resolve = typeof Z.resolveText === "function" ? Z.resolveText : Z.text; let tokenTexts = 0;
    const texts = []; all.forEach((m) => { texts.push([m.id + ".title", m.title], [m.id + ".intro", m.intro]); m.steps.forEach((s, j) => { texts.push([m.id + "." + (j + 1), s.text]); arr(s.lines).forEach((l) => Array.isArray(l) && texts.push([m.id + "." + (j + 1) + ".line", l[1]])); }); });
    texts.forEach(([w, t]) => { if (!t || t.indexOf("{{") < 0) return; tokenTexts++; if (has) { const r = resolve(t); if (/\{\{\w+\}\}/.test(r)) E(w + ".tok", "TOKEN_UNRESOLVED", w, "token does not resolve: " + /\{\{\w+\}\}/.exec(r)[0], "config"); } });
    // hard-coded game name / initials in player-facing code and data (§5.3); listed per file, warning until the config pass
    const NAME_RE = /Freshers School Life|FRESHERS SCHOOL LIFE|(?<![.\w])FSLG(?![.\w(])|Samaru Days/g /* the global API object FSLG.x is code, not a name */, per = {};
    fs.readdirSync(dir).filter((f) => /^(samaru|fslg)-.*\.js$/.test(f) && !/bundle/.test(f)).forEach((f) => { const lines = fs.readFileSync(path.join(dir, f), "utf8").split("\n"); lines.forEach((ln, i) => { const code = ln.replace(/\/\*.*?\*\//g, "").replace(/^\s*(\/\/|\*|\/\*).*$/, ""); const mm = code.match(NAME_RE); if (mm) (per[f] = per[f] || []).push(i + 1); }); });
    Object.keys(per).forEach((f) => W("name." + f, "HARDCODED_NAME", f, "game name/initials as a literal on line(s) " + per[f].slice(0, 12).join(", ") + (per[f].length > 12 ? " … (" + per[f].length + ")" : ""), "config"));
    if (out.stats.harnessMissing && out.stats.harnessMissing.length) W("harness", "HARNESS_LIST", "games/tests/samaru_harness.js", "harness script list lacks catalogue deps: " + out.stats.harnessMissing.join(", ") + " (loaded by the validator after boot; headless tests do not exercise them)", "test owner");
    out.stats.resolveText = typeof Z.resolveText === "function" ? (FS ? "FSLG.resolveText" : "Z.resolveText") : "missing";
    out.stats.tokenTexts = tokenTexts; out.stats.hardcodedNameFiles = Object.keys(per).length;
  }

  /* ---------------- 9. sounds and animations named in code ---------------- */
  { const known = new Set(); try { const ar = fs.readFileSync(path.join(dir, "arcade.js"), "utf8"), i = ar.indexOf("Sound.sfx = function"), blk = ar.slice(i, i + 6000); [...blk.matchAll(/\n\s*(\w+): function/g)].forEach((x) => known.add(x[1])); } catch (e) {}
    try { const man = JSON.parse(fs.readFileSync(path.join(ROOT, "static", "audio", "sfx", "manifest.json"), "utf8")); Object.keys(man.core || {}).forEach((k) => known.add(k)); Object.keys((man.packs || {})["samaru-days"] || {}).forEach((k) => known.add(k)); } catch (e) {}
    const used = {}; fs.readdirSync(dir).filter((f) => /^(samaru|fslg)-.*\.js$/.test(f) && !/bundle/.test(f)).forEach((f) => { const t = fs.readFileSync(path.join(dir, f), "utf8"); [...t.matchAll(/sfx\("([a-z_0-9]+)"/g)].forEach((x) => { (used[x[1]] = used[x[1]] || new Set()).add(f); }); });
    Object.keys(used).forEach((n) => { if (known.size && !known.has(n)) E("sfx." + n, "BAD_SOUND", [...used[n]].join(", "), "sfx('" + n + "') is not a synth effect or a manifest sound", "audio"); });
    out.stats.sounds = { used: Object.keys(used).length, known: known.size };
    const clips = new Set(Object.keys((Z.anim && Z.anim.CLIPS) || {})); const usedC = {}; fs.readdirSync(dir).filter((f) => /^samaru-.*\.js$/.test(f)).forEach((f) => { const t = fs.readFileSync(path.join(dir, f), "utf8"); [...t.matchAll(/anim\.play\([^,]+,\s*"(\w+)"/g)].forEach((x) => { (usedC[x[1]] = usedC[x[1]] || new Set()).add(f); }); });
    Object.keys(usedC).forEach((c) => { if (clips.size && !clips.has(c)) E("clip." + c, "BAD_ANIM", [...usedC[c]].join(", "), "animation clip '" + c + "' does not exist", "anim"); });
    out.stats.anim = { clips: clips.size, played: Object.keys(usedC).length };
  }

  /* ---------------- 10. save format ---------------- */
  { const sv = JSON.parse(JSON.stringify(P)); out.stats.save = { playerV: sv.v, storyVer: (sv.story || {}).ver, storyY1v: (sv.story || {}).y1v, sizeBytes: JSON.stringify(sv).length, key: "fslg-save" };
    if (sv.saveVersion == null) W("saveVersion", "SAVE_VERSION", "samaru-sim.js S.migrate / samaru-story.js", "save has no top-level saveVersion (player v=" + sv.v + ", story.ver=" + (sv.story || {}).ver + "): two version numbers, and S.migrate only fills defaults", "core"); }
} catch (e) { out.ok = false; out.error = String(e && e.stack || e).split("\n").slice(0, 6).join(" | "); }

/* ---------------- known issues: tracked errors that do not fail CI on their own (KNOWN_ISSUES.md ids) ---------------- */
const KNOWN = [
  // m1/m4 (KI-001), the go stall (KI-003) and the find arrow (KI-012) are fixed: they are not listed, so a regression fails loudly
  [/^(FIND_OFF_SCENE|DEFAULT_GATE):m(26|41|42|53|71)\./, "KI-002"],
  [/^HUD_TOKEN:/, "KI-004"], [/^TEXT_PLACE:/, "KI-005"], [/^NO_BEACON:/, "KI-006"],
  [/^NPC_AT:/, "KI-011"]
];
out.errors.forEach((e) => { const k = KNOWN.find((x) => x[0].test(e.key)); if (k) e.known = k[1]; });
out.newErrors = out.errors.filter((e) => !e.known).length;
out.counts = { errors: out.errors.length, newErrors: out.newErrors, warnings: out.warnings.length, review: out.review.length };
out.ok = out.ok !== false;

/* ---------------- report ---------------- */
function md() {
  const by = (list) => { const g = {}; list.forEach((x) => { (g[x.code] = g[x.code] || []).push(x); }); return g; };
  const L = ["# FSLG validator report", "", "Generated by `games/tests/fslg_validator.js` (run by `games/tests/test_fslg_validator.py`). Deterministic: the same files give the same report.",
    "Do not edit by hand; re-run `node games/tests/fslg_validator.js static/js/games --md docs/VALIDATOR_REPORT.md`.", "",
    "Test player: male, roommate " + (out.stats.player || {}).roomie + ", hostel " + (out.stats.player || {}).home + ". Engine probe: a `go` step to the place you are standing at **" + out.probes.goWhileStanding + "**.", "",
    "## Summary", "", "| | count |", "|---|---|", "| errors (clear breakage) | " + out.counts.errors + " |", "| of which tracked in KNOWN_ISSUES.md | " + (out.counts.errors - out.counts.newErrors) + " |", "| new (untracked) errors | " + out.counts.newErrors + " |", "| warnings | " + out.counts.warnings + " |", "| for review (fuzzy) | " + out.counts.review + " |", "",
    "Stats: `" + JSON.stringify(out.stats) + "`", ""];
  if (out.error) L.push("**Validator crashed:** " + out.error, "");
  const sect = (title, list) => { L.push("## " + title, ""); const g = by(list); if (!list.length) L.push("None.", ""); Object.keys(g).sort().forEach((c) => { L.push("### " + c + " (" + g[c].length + ")", ""); g[c].forEach((x) => L.push("- `" + x.where + "` " + x.msg.replace(/\|/g, "/") + (x.owner ? " — *" + x.owner + "*" : "") + (x.known ? " — tracked " + x.known : ""))); L.push(""); }); };
  sect("Errors", out.errors); sect("Warnings", out.warnings);
  L.push("## Back-and-forth: worst 15 missions", "", "Straight-line metres walked between step locations (from where the previous mission ended) against the shortest open tour of the same places from the same start. `backtracks` = A → B → A legs.", "", "| mission | title | steps | walked m | tour m | excess m | ratio | backtracks | route |", "|---|---|---|---|---|---|---|---|---|");
  out.travel.slice(0, 15).forEach((t) => L.push("| " + [t.id, t.title, t.steps, t.metres, t.tour, t.excess, t.ratio, t.backtracks, t.route].join(" | ") + " |")); L.push("");
  sect("For review (text names a different place; not failing)", out.review);
  return L.join("\n") + "\n";
}
if (opt("--md")) fs.writeFileSync(path.resolve(opt("--md")), md());
if (opt("--json")) fs.writeFileSync(path.resolve(opt("--json")), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out));
process.exit(out.ok ? 0 : 1);
