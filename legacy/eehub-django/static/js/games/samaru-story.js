/* Freshers School Life — story engine for Years 2–5 (m37–m120), side missions, ambient encounters and the
   friends-mission list. Content lives in fslg-story-*.js as data (contract: docs/story/ENGINE.md); this file merges
   it into D.MISSIONS at load time, resolves tokens (@roomie, @dept…), adds the new step types (choice, tail, escort,
   stealth, quiz, flight, routine…), standing tracks, relationships, fail/resume, and a solver the headless tests use. */
(function () {
  "use strict";
  var Z = window.SamaruGame, S = window.SamaruSim, D = window.SamaruData;
  if (!Z || !S || !D) return;
  var ST = Z.story = { issues: [], ctx: {}, queue: [] }, TAU = Math.PI * 2;
  // One config object for anything that may change (MASTER_GAME_GUIDE §5); text uses {{TOKENS}} and goes through Z.text.
  D.CONFIG = D.CONFIG || { configVersion: 0 }; // defaults: fslg.config.js (the one place the name is written); live values: samaru-overrides.js
  Z.text = function (t) { var C = D.CONFIG || {}, P = Z.P || {}; return String(t == null ? "" : t).replace(/\{\{(\w+)\}\}/g, function (m, k) { var v = { GAME_NAME: C.gameName, GAME_SHORT: C.gameShortName, GAME_INITIALS: C.initialsOverride || C.initials, TAGLINE: C.tagline, AUTHOR: C.author, CURRENCY: C.currencyName, PLAYER_NAME: P.name || "Fresher" }[k]; return v == null ? m : v; }); };
  var TRACKS = ["academics", "street", "social", "community", "department", "fame"];
  var KNOWN = "go talk eat sleep buy ride fight boss find race emote job class stat turn choice choose vote look watch listen social walk escort convoy tail chase stealth delivery carry collect build care quiz teach rhythm arcade sports flight routine defend keep bank phone awards switch".split(" ");
  ST.KNOWN = KNOWN;
  var MAKER = ["Energy in, light out. The rest is commentary.", "A thing is finished when it no longer needs you.", "I kept one light on for a long time. You taught me to share the switch.", "Nobody lights a ring alone. I checked. For years.", "The dark is not an enemy. It is what is there before somebody bothers.", "Start small. A torch has never been embarrassed by the sun.", "If you are tired, rest. If you are stuck, move. Learn which one it is.", "The best machine I ever built was a queue of people passing parts.", "Read the manual. Then read the person.", "You will forget the grade. You will remember who lent you a pen.", "Every expert was once the one asking where the Senate is.", "Measure twice. Then ask someone to measure. Then cut.", "A carry-over is a second lecture you paid for with pride.", "Money is stored effort. Spend it on what stores well: skills, friends, shoes.", "The loudest person in the room is usually running on low battery.", "Be the reason the fresher finds the hall.", "I used to think staying was loyalty. Sometimes leaving is how you keep faith.", "Light travels fast. Kindness travels further.", "When they take light, sit near people. That is the whole trick.", "Entropy always wins in the end. So enjoy the middle and tidy as you go.", "A good question is worth two answers and one cup of tea.", "Do not confuse being seen with being known.", "The coil hums at one note. Find yours. It need not be loud.", "Borrow tools. Return them cleaner. This is most of ethics.", "Your friends are your backup generator. Service them regularly.", "The shortest path is rarely the one with the best suya.", "I have watched forty first days. Every one of them looked like fear and was actually hope.", "Garri week comes to us all. Share the cup.", "A lecture is someone handing you ten years in fifty minutes. Sit up.", "Whatever you practise at night is who you are by morning.", "Fame is a lamp pointed at you. Useful is a lamp you hold.", "Greet the porter. He was here before you and will be here after.", "You cannot solder in a hurry. The same is true of trust.", "If the plan needs a hero, it is a bad plan. Draw it again with a team.", "The school is not the buildings. I learned this late. Learn it early.", "It is allowed to be proud of something small.", "Call home. They do not need news. They need your voice.", "The exam ends. The understanding is yours to keep.", "When you leave, leave something switched on.", "I was a student here for longer than was sensible. I recommend about five years.", "Stand where the fresher can see you. That is what seniors are for.", "Some days the bravest thing is to open the door and go to class.", "A switch has two positions. People have more. Be patient with them.", "Thank you. I do not say it enough, and I had a lot of time to practise."];
  ST.MAKER = MAKER;
  function clone(o) { var c = {}; for (var k in o) c[k] = o[k]; return c; }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function arr(v) { return v == null ? [] : Array.isArray(v) ? v : [v]; }

  /* ---------- merge the content files (runs once, now: after the data files, before setup) ---------- */
  ST.merge = function () {
    var reg = D.STORY || [], main = [], side = [], amb = [], coop = [], ids = {}, npcIds = {}, placeIds = {};
    // a new Year 1 file retires the built-in m1–m36 (long goals stay)
    if (reg.some(function (r) { return r.replaceYear1; })) { ST.oldY1 = D.MISSIONS.filter(function (m) { return !m.side && /^m([1-9]|[12]\d|3[0-6])$/.test(m.id); }); for (var q = D.MISSIONS.length - 1; q >= 0; q--) if (ST.oldY1.indexOf(D.MISSIONS[q]) >= 0) D.MISSIONS.splice(q, 1); }
    reg.forEach(function (r) {
      (r.retire || []).forEach(function (id) { D.NPCS.forEach(function (n) { if (n.id === id) n.retired = true; }); }); // kept (other code indexes people by position) but never shown
      for (var pid in (r.patch || {})) D.NPCS.forEach(function (n) { if (n.id === pid) { var pt = r.patch[pid]; for (var f in pt) if (f !== "id") n[f] = pt[f]; } });
    });
    D.MISSIONS.forEach(function (m) { ids[m.id] = 1; }); D.NPCS.forEach(function (n) { npcIds[n.id] = 1; }); D.PLACES.forEach(function (p) { placeIds[p.id] = 1; });
    reg.slice().sort(function (a, b) { return (a.year || 9) - (b.year || 9); }).forEach(function (r) {
      (r.npcs || []).forEach(function (n) { if (!n || !n.id || npcIds[n.id]) return; if (!placeIds[n.at] && String(n.at).charAt(0) !== "@") { ST.issues.push(r.file + ": npc " + n.id + " at unknown place " + n.at); n.at = "gate"; } n.hi = n.hi && n.hi.length ? n.hi : ["Hello."]; n.voice = n.voice || "male"; n.pitch = n.pitch || 1; D.NPCS.push(n); npcIds[n.id] = 1; });
      for (var k in (r.items || {})) if (!D.ITEMS[k]) D.ITEMS[k] = r.items[k];
      (r.missions || []).forEach(function (m) { if (ids[m.id]) { ST.issues.push(r.file + ": duplicate id " + m.id); return; } ids[m.id] = 1; m.year = m.year || r.year; main.push(m); });
      side = side.concat(r.side || []); amb = amb.concat(r.ambient || []); coop = coop.concat(r.coop || []);
      if (r.ambientRules) D.AMBIENT_RULES = r.ambientRules; if (r.bystanders) D.BYSTANDERS = r.bystanders;
    });
    main.sort(function (a, b) { return num(a.id) - num(b.id); });
    // gates → level needed, and XP that carries the story to the next gate
    var prevGate = 0;
    main.forEach(function (m, i) {
      m.need = m.need || {}; if (!m.need.done) m.need.done = i ? [main[i - 1].id] : num(m.id) > 1 ? ["m" + (num(m.id) - 1)] : [];
      // the scripts' gates run 31→130; the game's curve fits Years 2–5 into levels 41→110 (Year 1 ends near 41)
      var g = m.gate ? ST.gateLevel(m.gate) : prevGate || 0; if (g) m.need.lvl = Math.max(m.need.lvl || 0, g); prevGate = g;
      m.ch = m.ch || ((m.year || 2) === 1 ? Math.ceil(num(m.id) / 3) : 12 + (m.year || 2) * 4 - 7); m.reward = m.reward || {};
      m.steps = (m.steps || []).filter(Boolean); m.steps.forEach(prep);
    });
    // story XP: exactly enough to carry a player who only does the story from one gate to the next (side play is a bonus);
    // the gap is paid at the gate (not g + 1), so the curve does not run ahead of the gates
    // (a script's own XP figure is kept when it is bigger, so small missions still feel rewarding)
    main.forEach(function (m, i) { var g = m.need.lvl || 1, nx = main[i + 1] ? main[i + 1].need.lvl || g : Math.min((S.MAX_LEVEL || 150), g + 1); m.reward.xp = Math.max(m.reward.xp || 0, 150, Math.round((S.xpForLevel(Math.max(nx, g)) - S.xpForLevel(g)) * 1.02)); if (i && !m.year) m.year = main[i - 1].year; });
    var y1 = main.filter(function (m) { return num(m.id) <= 36; }), rest = main.filter(function (m) { return num(m.id) > 36; });
    Array.prototype.unshift.apply(D.MISSIONS, y1); Array.prototype.push.apply(D.MISSIONS, rest);
    side.forEach(function (m) { m.side = true; m.steps = (m.steps || []).filter(Boolean); m.steps.forEach(prep); m.reward = m.reward || {}; });
    D.SIDE = side; D.AMBIENT = amb; D.COOP = coop; ST.merged = { main: main.length, side: side.length, ambient: amb.length, coop: coop.length };
    // overlays (fslg-story-choices.js): script choices and [switch] beats slotted into missions by an anchor, never by a bare index
    var ov = 0, cq = []; reg.forEach(function (r) { (r.overlay || []).forEach(function (o) { if (ST.overlay(o, main, side, r.file)) ov++; }); cq = cq.concat(r.conseq || []); });
    D.CONSEQ = cq; ST.merged.overlay = ov; main.concat(side).forEach(function (m) { m.steps.forEach(function (s) { s.scene = ST.sceneMeta(s); }); });
  };
  // One overlay entry: { id: "m55", after: "text of an existing step" | before: "…" | at: "end" | "last", step: {…} }.
  // "end" = just before the mission's last step; "last" = after it. A missing anchor is a reported problem, not a guess.
  ST.overlay = function (o, main, side, file) {
    var m = null; main.concat(side).forEach(function (q) { if (q.id === o.id) m = q; }); if (!m || !o.step) { ST.issues.push((file || "overlay") + ": overlay for unknown mission " + o.id); return false; }
    var i = -1, key = String(o.after || o.before || "").toLowerCase();
    if (key) { for (var k = 0; k < m.steps.length; k++) if (!m.steps[k].ov && String(m.steps[k].text || "").toLowerCase().indexOf(key) >= 0) { i = o.after ? k + 1 : k; break; } if (i < 0) { ST.issues.push((file || "overlay") + ": " + o.id + " has no step with text \"" + key + "\""); return false; } }
    else i = o.at === "last" ? m.steps.length : Math.max(1, m.steps.length - 1);
    var st = clone(o.step); st.ov = 1; prep(st); m.steps.splice(i, 0, st); return true;
  };
  // Cutscene metadata for every story moment (MASTER_GAME_GUIDE §6.4, KI-023): what the world looks like after it
  // (endState), the longest it may hold the player (maxDuration, seconds; a watchdog enforces it) and whether it can be skipped.
  // Story beats never move the player or lock input, so the end state is "the step is complete and its flags are set".
  ST.sceneMeta = function (s) {
    var lines = arr(s.lines).length + (s.say ? 1 : 0), talk = 0; arr(s.lines).forEach(function (l) { if (Array.isArray(l) && l[1]) talk += Math.max(2.2, 1.2 + String(l[1]).length * .055); });
    var beat = s.t === "turn" || s.turn || s.t === "awards" || s.title || s.t === "switch" || s.t === "phone" || s.t === "choice" || s.t === "choose" || s.t === "vote" || lines > 0; if (!beat) return null;
    var hold = s.t === "turn" || s.t === "awards"; // the only beats that wait on their own clock
    return { kind: s.t === "turn" || s.turn ? "beat" : s.t === "awards" ? "ceremony" : s.t === "switch" ? "switch" : s.t === "phone" ? "call" : /^(choice|choose|vote)$/.test(s.t) ? "choice" : "lines",
      endState: { stepDone: hold, flags: arr(s.set), give: s.give || "", take: s.take || "", player: "where they stand", camera: "gameplay", input: "free" },
      maxDuration: Math.ceil((hold ? (s.t === "awards" ? 8 : 4) : 0) + talk + 4), skippable: true, ambient: !hold };
  };
  ST.MOMENT_META = { // the result cards in samaru-moment.js: they queue, never lock input, and end by themselves
    mission: 3.8, goal: 3, job: 2.6, level: 4.4, unlock: 3.6, finale: 11, promotion: 4, raceWin: 4.6, raceLose: 5, escaped: 3, caught: 3.4, fail: 3.6, ko: 2.8 };
  Object.keys(ST.MOMENT_META).forEach(function (k) { ST.MOMENT_META[k] = { endState: { player: "where they stand", camera: "gameplay", input: "free", card: "gone" }, maxDuration: ST.MOMENT_META[k] + 1, skippable: true, ambient: true }; });
  ST.skipScene = function () { // E during a beat: drop the rest of its lines and let the step finish (same end state as watching)
    if (!ST.busy()) return false; ST.queue.length = 0; ST.sayT = 0; try { Z.sub("", "", .01); } catch (e) {} ST.skipped = (ST.skipped || 0) + 1; return true;
  };
  ST.GATE = { from: [31, 130], to: [41, 104] };
  ST.gateLevel = function (g) { var a = ST.GATE.from, b = ST.GATE.to; if (g < a[0]) return Math.min(g, b[0]); return Math.min(S.MAX_LEVEL || 150, Math.round(b[0] + (Math.min(g, a[1]) - a[0]) * (b[1] - b[0]) / (a[1] - a[0]))); };
  function num(id) { return +String(id).replace(/\D/g, "") || 0; }
  function prep(s) { if (s.t === "flight" && s.route) s.n = s.route.length; if (s.t === "routine" && s.at && Array.isArray(s.at)) s.n = s.at.length; if (s.t === "boss") s.n = 1; if (s.t === "choose" || s.t === "vote") s.options = s.options || []; if (KNOWN.indexOf(s.t) < 0) ST.issues.push("unknown step type " + s.t); }

  /* ---------- tokens ---------- */
  function sex(P) { try { if (Z.life && Z.life.ensure) return Z.life.ensure(P).sex; } catch (e) {} var ch = Z.charOf ? Z.charOf(P.char) : null; return ch && ch.voice === "female" ? "f" : "m"; }
  ST.sex = sex;
  ST.tok = function (P, v) {
    if (typeof v !== "string") return v; if (ALIAS[v]) return ALIAS[v]; if (PLACE_ALIAS[v] && !(Z.places && Z.places[v])) return PLACE_ALIAS[v];
    if (v.charAt(0) !== "@" || !P) return v; var s = P.story || {};
    switch (v) {
      case "@roomie": return s.roomie || (sex(P) === "f" ? (has("firdausi") ? "firdausi" : "fatima") : has("bature") ? "bature" : "sadiq");
      case "@best": return s.best || (sex(P) === "f" ? (has("firdausi") ? "firdausi" : ST.tok(P, "@roomie")) : has("bature") ? "bature" : ST.tok(P, "@roomie"));
      case "@crush": return s.crush || s.partner || ST.tok(P, "@best");
      case "@partner": return s.partner || s.crush || ST.tok(P, "@best");
      case "@hod": return has("hod_" + deptId(P)) ? "hod_" + deptId(P) : has("hod") ? "hod" : "okonkwo";
      case "@boss": return s.boss || (has("uche") ? "uche" : "garba");
      case "@hostel": return "@home";
      case "@dept": return deptId(P);
      case "@super": return flagPick(P, "super_", "okonkwo");
      case "@hostelshop": return hostelShop(P); // the shop or food stall nearest your own hostel (KB's shop "by the hostel gate")
      case "@place": var pk = flagPick(P, "placement_", "mall"); return { mall: "market", dam: "dam", airfield: "strip", strip: "strip", radio: "radio", works: "fire" }[pk] || pk;
      default: return ALIAS[v] || v;
    }
  };
  function flagPick(P, pre, def) { for (var f in P.flags) if (P.flags[f] && f.indexOf(pre) === 0) return f.slice(pre.length); return def; }
  // encounter people and spots ($who, $here, $other) live only while the encounter runs; place aliases for script names
  var ALIAS = { $who: "amb_who", $other: "amb_other", $here: "amb_here", sly: "bola", bolaji: "bola" };
  var PLACE_ALIAS = { pitch: "court", quad: "enggarden", fountain: "selfie", oldcampus: "checkpoint", forest_edge: "lowerdam", rangerpost: "checkpoint", p2bend: "checkpoint", fence: "gate", pier: "dam" };
  ST.PLACE_ALIAS = PLACE_ALIAS;
  function hostelShop(P) { var H = Z.place && Z.place(P.home || "@home"), best = null, bd = 1e9; if (!H) return "social"; (Z.placeList || []).forEach(function (q) { if (!/^(food|shop)$/.test(q.role) || /^mk_/.test(q.id)) return; var d = Math.hypot(q.mx - H.mx, q.my - H.my); if (d < bd) { bd = d; best = q; } }); return best ? best.id : "social"; }
  function has(id) { return D.NPCS.some(function (n) { return n.id === id; }); }
  function deptId(P) { try { if (Z.life && Z.life.deptPlace) return Z.life.deptPlace(); } catch (e) {} return "ee"; }
  ST.resolve = function (P, st) { if (!st) return st; var c = clone(st); ["npc", "place", "at", "giver"].forEach(function (k) { if (c[k]) c[k] = ST.tok(P, c[k]); }); if (c.place === "@home" && P && P.home && c.t !== "go") c.place = P.home; return c; };

  /* ---------- wrap the rules: matching, gating, completion ---------- */
  var origMatch = S.stepMatches;
  S.stepMatches = function (step, ev) {
    if (!step || !ev) return false;
    if (step.t === "emote" && step.at && ev.t === "emote" && !ev.auto) { var ep = Z.P && Z.place && Z.place(ST.tok(Z.P, step.at)), em = Z.me; if (ep && em && Math.hypot(em.x - ep.mx, em.y - ep.my) > 30) return false; } // an emote with a place counts there
    if (origMatch(step, ev)) return true;
    var P = Z.P, r = ST.resolve(P, step);
    if (r.t === "eat" || r.t === "sleep" || r.t === "class") delete r.place;
    if (r.t === "boss" && ev.t === "fight") { r.t = "fight"; return origMatch(r, ev); }
    if ((r.t === "choose" || r.t === "vote") && ev.t === "choice") r.t = "choice";
    return origMatch(r, ev);
  };
  var origOpen = S.missionOpen;
  S.missionOpen = function (p, m) {
    if (!origOpen(p, m)) return false; var need = m.need || {};
    if ((need.flags || []).some(function (f) { return !p.flags[f]; })) return false;
    if ((need.notFlags || []).some(function (f) { return p.flags[f]; })) return false; return true;
  };
  function skip(p, st) { if (!st) return false; if (st.if && !p.flags[st.if]) return true; if (st.unless && p.flags[st.unless]) return true; return false; }
  ST.auto = function (st) { // an event that completes this step at once (skips and the test solver use it)
    var P = Z.P, r = ST.resolve(P, st), ev = { t: r.t === "boss" ? "fight" : r.t, n: r.n || 1, night: true, score: 1e9, auto: true };
    ["place", "npc", "item", "enemy", "veh", "emote", "race"].forEach(function (k) { if (r[k] != null) ev[k] = r[k]; });
    if (r.t === "stat") { ev.stat = r.stat; ev.value = r.val; }
    if (r.t === "go" && st.place === "@home") ev.place = "@home"; if (r.t === "eat" || r.t === "sleep" || r.t === "class") delete ev.place;
    return ev;
  };
  var origEvent = S.missionEvent;
  S.missionEvent = function (p, missions, ev) {
    var m0 = p.m.active, i0 = p.m.step, st0 = cur(missions, m0, i0), r = origEvent(p, missions, ev);
    if (!r) return r;
    if ((r.step || r.done) && st0) finishStep(p, st0, m0, i0);
    var guard = 0;
    while (r && r.step && skip(p, r.step) && guard++ < 50) { var nx = origEvent(p, missions, ST.auto(r.step)); if (!nx) break; if (nx.done) { r = nx; break; } r = nx; }
    if (r && r.done) doneExtra(p, r.done);
    return r;
  };
  var origStart = S.startMission;
  S.startMission = function (p, m) { origStart(p, m); var g = 0; while (skip(p, m.steps[p.m.step]) && p.m.step < m.steps.length - 1 && g++ < 50) p.m.step++; };
  function cur(missions, id, i) { if (!id) return null; for (var k = 0; k < missions.length; k++) if (missions[k].id === id) return missions[k].steps[i]; return null; }
  function finishStep(p, st, mid, idx) {
    arr(st.set).forEach(function (f) { p.flags[f] = 1; });
    if (st.take && p.inv[st.take]) p.inv[st.take]--;
    if (st.parts) for (var k in st.parts) p.inv[k] = Math.max(0, (p.inv[k] || 0) - st.parts[k]);
  }
  function story(p) {
    var s = p.story; if (!s || typeof s !== "object") s = p.story = {};
    if (!s.standing) { s.standing = {}; } TRACKS.forEach(function (t) { if (!(s.standing[t] >= -100)) s.standing[t] = 0; });
    s.picks = s.picks || {}; s.rel = s.rel || {}; s.exes = s.exes || []; s.partners = s.partners || []; s.savings = s.savings || 0; s.heard = s.heard || 0; s.sideDone = s.sideDone || {}; s.ambDone = s.ambDone || {};
    return s;
  }
  ST.state = story;
  function doneExtra(p, m) {
    var rw = m.reward || {}, s = story(p);
    arr(rw.flags).forEach(function (f) { p.flags[f] = 1; });
    for (var t in (rw.standing || {})) s.standing[t] = Math.max(-100, Math.min(100, (s.standing[t] || 0) + rw.standing[t]));
    for (var n in (rw.friend || {})) S.bond(p, ST.tok(p, n), rw.friend[n]);
    if (m.year) s.year = Math.max(s.year || 1, m.year);
    if (m.id === "m116") p.flags.maker_free = 1;
  }
  ST.apply = function (p, o) { // effects of a picked choice option
    var s = story(p); arr(o.set).forEach(function (f) { p.flags[f] = 1; });
    for (var t in (o.standing || {})) s.standing[t] = Math.max(-100, Math.min(100, (s.standing[t] || 0) + o.standing[t]));
    for (var n in (o.friend || {})) S.bond(p, ST.tok(p, n), o.friend[n]);
    if (o.money) p.money = Math.max(0, p.money + o.money);
    if (o.partner) ST.date(p, ST.tok(p, o.partner)); if (o.breakup) ST.breakup(p, s.partner, "you");
    if (o.best) s.best = ST.tok(p, o.best); if (o.boss) s.boss = o.boss;
    if (o.roomie) { s.roomie = o.roomie; ST.applyRoomie(p); if (o.home && Z.places && Z.places[o.home]) { p.home = o.home; try { var lf = Z.life && Z.life.ensure && Z.life.ensure(p); if (lf) lf.hostel = o.home; } catch (e) {} } }
  };

  /* ---------- relationships (bible §10): opposite-sex only, broke is not a reason, neglect and cheating are ---------- */
  function npcDef(id) { for (var i = 0; i < D.NPCS.length; i++) if (D.NPCS[i].id === id) return D.NPCS[i]; return null; }
  ST.canDate = function (p, id) { var d = npcDef(id); if (!d) return false; var want = d.romance || (d.voice === "female" ? "m" : "f"); return want === sex(p); };
  ST.date = function (p, id) {
    var s = story(p); if (!id || !ST.canDate(p, id)) return false;
    if (s.partner && s.partner !== id) { if (s.partners.indexOf(s.partner) < 0) s.partners.push(s.partner); s.twoTiming = true; }
    s.partner = id; s.crush = id; if (s.partners.indexOf(id) < 0) s.partners.push(id); s.rel[id] = s.rel[id] || { since: p.day, last: p.day, warn: 0 }; s.rel[id].last = p.day; return true;
  };
  ST.together = function (p, id) { var s = story(p); if (s.rel[id]) { s.rel[id].last = p.day; s.rel[id].warn = 0; } };
  ST.breakup = function (p, id, why) {
    var s = story(p); if (!id) return; s.partners = s.partners.filter(function (x) { return x !== id; }); if (s.exes.indexOf(id) < 0) s.exes.push(id); delete s.rel[id];
    if (s.partner === id) s.partner = s.partners[0] || ""; if (!s.partners.length) s.twoTiming = false; S.bond(p, id, why === "cheat" ? -25 : -10); s.lastBreak = why; return why;
  };
  ST.daily = function (p) { // once per new day
    var s = story(p), out = [];
    s.partners.slice().forEach(function (id) {
      var r = s.rel[id] || (s.rel[id] = { since: p.day, last: p.day, warn: 0 }), gap = p.day - r.last;
      if (gap >= 7 && !r.warn) { r.warn = 1; out.push(["warn", id]); }
      if (gap >= 14 && (p.money < 500 || gap >= 21)) out.push(["leave", ST.breakup(p, id, "neglect") && id]); // being broke alone never does it; broke AND absent does
    });
    if (s.twoTiming && s.partners.length > 1 && S.hash(p.day, s.partners.length * 7) < .3) { var all = s.partners.slice(); all.forEach(function (id) { ST.breakup(p, id, "cheat"); }); p.flags.twotimed_caught = 1; out.push(["caught", all]); }
    return out;
  };

  /* ---------- runtime: one context for the main story, one for a side mission or ambient encounter ---------- */
  function placeOf(id) { var P = Z.P; id = ST.tok(P, id); return id ? Z.place(id) : null; }
  function npcOf(id) { var P = Z.P; return id ? Z.npc(ST.tok(P, id)) : null; }
  function near(target, r) { var me = Z.me; if (!target) return false; var x = target.mx != null ? target.mx : target.x, y = target.my != null ? target.my : target.y; return Math.hypot(me.x - x, me.y - y) < (r || 13); }
  ST.say = function (lines) { // queue spoken lines as subtitles and voices
    var P = Z.P; arr(lines).forEach(function (l) { if (Array.isArray(l) && l[1] && !(l[3] && !(P && P.flags[l[3]]))) ST.queue.push(l); }); // a 4th field is a flag the line needs (e.g. room_bature)
  };
  function speak(dt) {
    if (ST.sayT > 0) { ST.sayT -= dt; return; } var l = ST.queue.shift(); if (!l) return; var P = Z.P, who = ST.tok(P, l[0] || ""), n = who && who !== "me" ? Z.npc(who) : null;
    var text = String(l[1]), dur = Math.max(2.2, 1.2 + text.length * .055); ST.sayT = dur;
    try { if (n && Z.say) Z.say(n, text); else if (who === "me" && Z.say) Z.say("me", text); else if (Z.api && Z.api.sound && who) Z.api.sound.say(text, { voice: "male" }); } catch (e) {}
    var cap = function (s) { s = String(s).replace(/_/g, " "); return s.charAt(0).toUpperCase() + s.slice(1); }, tail = who.indexOf(":") > 0 ? who.slice(who.indexOf(":") + 1) : "";
    var label = n ? n.def.name : who === "me" ? (P.name || "You") : who.indexOf("phone:") === 0 ? "📞 " + cap(tail) : who === "radio" || who.indexOf("radio:") === 0 ? "📻 " + cap(tail) : who.indexOf("crowd:") === 0 ? cap(tail) : who ? cap(who) : "";
    try { Z.sub(n ? n.id : "", n ? text : (label ? label + ": " : "") + text, dur); } catch (e2) {}
  };
  ST.busy = function () { return ST.queue.length > 0 || ST.sayT > 0; };
  function ctxKey(c) { return c.which + ":" + c.id + ":" + c.i; }
  function contexts() {
    var P = Z.P, out = [], m = Z.mission ? Z.mission() : null;
    if (m && P.m.active) out.push({ which: "main", id: m.id, i: P.m.step, m: m, st: m.steps[P.m.step] });
    var sd = story(P).side; if (sd) { var sm = ST.sideDef(sd.id); if (sm && sm.steps[sd.step]) out.push({ which: "side", id: sd.id, i: sd.step, m: sm, st: sm.steps[sd.step] }); }
    return out;
  }
  ST.sideDef = function (id) { var list = (D.SIDE || []).concat(D.AMBIENT_RUN || []); for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; };
  function fire(c, ev) { ev.t = ev.t || c.st.t; if (c.which === "side") return ST.sideEvent(ev); ev.story = true; Z.emit(ev); }
  ST.fire = fire;

  // side missions and encounters run on their own small tracker, fed by the same events
  ST.sideEvent = function (ev) {
    var P = Z.P, s = story(P), sd = s.side; if (!sd) return null; var m = ST.sideDef(sd.id); if (!m) { s.side = null; return null; }
    var st = m.steps[sd.step]; if (!S.stepMatches(st, ev)) return null;
    sd.n += ev.n || 1; if (sd.n < (st.n || 1)) { Z.toast(m.title + ": " + sd.n + " / " + st.n); return { progress: sd.n }; }
    finishStep(P, st); if (st.give) P.inv[st.give] = (P.inv[st.give] || 0) + 1; sd.step++; sd.n = 0; if (st.lines && st.t === "talk") ST.say(st.lines);
    while (m.steps[sd.step] && skip(P, m.steps[sd.step])) sd.step++;
    if (sd.step < m.steps.length) { var nx = m.steps[sd.step]; Z.toast("<b>Next:</b> " + (nx.text || "")); if (nx.t !== "talk") ST.say(nx.lines || (nx.say ? [nx.say] : [])); return { step: nx }; }
    s.side = null; var rw = m.reward || {}; P.money += rw.cash || 0; if (rw.xp) Z.xp(rw.xp); if (rw.item) P.inv[rw.item] = (P.inv[rw.item] || 0) + (rw.count || 1); if (rw.flag) P.flags[rw.flag] = 1;
    doneExtra(P, m); if (m.amb) { s.ambDone[m.amb] = (s.ambDone[m.amb] || 0) + 1; if (m.thanks) ST.say([["amb_who", m.thanks]]); if (m.twist) Z.toast(m.twist); setTimeout(clearTemps, 6000); } else s.sideDone[m.id] = 1;
    if (!m.hidden) { try { Z.moment("job", { title: m.title, cash: rw.cash || 0, xp: rw.xp || 0 }); } catch (e) {} } if (Z.save) Z.save(); return { done: m };
  };
  ST.startSide = function (m) { var P = Z.P, s = story(P); if (s.side) return false; s.side = { id: m.id, step: 0, n: 0 }; while (m.steps[s.side.step] && skip(P, m.steps[s.side.step])) s.side.step++; var st = m.steps[s.side.step]; Z.toast("<b>" + m.title + "</b><br>" + ((st && st.text) || "")); if (st && st.t !== "talk") ST.say(st.lines || (st.say ? [st.say] : [])); return true; };
  ST.cancelSide = function () { var s = story(Z.P); s.side = null; clearTemps(); };
  ST.sideOpen = function (m) { var P = Z.P, s = story(P); if (s.sideDone[m.id] && !m.repeat) return false; var need = m.need || {}; if (need.lvl && P.lvl < need.lvl) return false; if ((need.done || []).some(function (id) { return !P.m.done[id]; })) return false; if ((need.flags || []).some(function (f) { return !P.flags[f]; })) return false; return true; };

  // the per-step driver
  ST.tick = function (dt) {
    var P = Z.P, me = Z.me; if (!P || !me || Z.mode !== "play") return; var s0 = story(P); speak(dt);
    flag(P, "has_partner", !!s0.partner); flag(P, "two_timing", !!(s0.twoTiming && s0.partners.length > 1)); flag(P, "strike", !!(P.flags.strike_on && !P.flags.strike_off));
    strikeHooks(); (Z.npcs || []).forEach(function (n) { if (n.def && n.def.retired && !n.hidden) n.hidden = true; }); // every tick: other modules un-hide people (rides, rooms)
    if (ST.day !== P.day) { if (ST.day != null && !Z.social /* samaru-romance.js runs the fuller daily rules and speaks for itself */) ST.daily(P).forEach(function (e) { var nm = (npcDef(e[1]) || {}).name || ""; if (e[0] === "warn") ST.say([["phone:" + nm, "You have been scarce. Seven days. Are we still a thing?"]]); else if (e[0] === "leave" && e[1]) Z.toast("<b>" + nm + " has ended it.</b> Too long without a word."); else if (e[0] === "caught") Z.toast("<b>They found out about each other.</b> Both of them are done with you."); }); ST.day = P.day; }
    try { var sk = Z.step && Z.step(); if (sk && (sk.t === "turn" || sk.t === "awards") && ST.busy() && Z.api.hit && Z.api.hit("act") && !(Z.prompt && Z.prompt())) ST.skipScene(); } catch (eSk) {} // every beat is skippable
    maker(dt); cameos();
    contexts().forEach(function (c) { var k = ctxKey(c), r = ST.ctx[c.which]; if (!r || r.key !== k) { if (r && r.sw && Z.sw && Z.sw.leave) Z.sw.leave(r); if (r && r.npcBack) { var b = r.npcBack; b.n.hx = b.hx; b.n.hy = b.hy; } r = ST.ctx[c.which] = { key: k, t: 0, n: 0, i: 0, started: false }; start(c, r); } r.t += dt; drive(c, r, dt); });
    if (!contexts().some(function (c) { return c.which === "side"; })) ST.ctx.side = null;
    if (ST.pending) { ST.pending.t -= dt; if (ST.pending.t <= 0) ST.decline(); }
    offers(dt);
  };
  function flag(P, f, on) { if (on) P.flags[f] = 1; else if (P.flags[f]) delete P.flags[f]; }
  ST.ENGINE_FLAGS = ["has_partner", "two_timing", "twotimed_caught", "strike", "last_result_lost", "maker_free"];
  // the strike (Year 3, strike_on → strike_off): no lectures, a thinner crowd, the timetable paused
  function strikeHooks() {
    var L = Z.life; if (L && !L._strike && L.next) { var on = L.next, oa = L.attending; L.next = function () { return Z.P && Z.P.flags.strike ? null : on.apply(this, arguments); }; if (oa) L.attending = function () { return Z.P && Z.P.flags.strike ? null : oa.apply(this, arguments); }; L._strike = 1; }
    var C = Z.crowd; if (C && !C._strike) { C._strike = 1; C.scale = function () { return Z.P && Z.P.flags.strike ? .45 : 1; }; }
  }
  // People marked cameo (your parents, say) are only in the world while a mission that uses them is running.
  function cameos() {
    var key = contexts().map(function (c) { return c.id; }).join(","); if (ST.cameoKey === key && ST.cameoN === (Z.npcs || []).length) return; ST.cameoKey = key; ST.cameoN = (Z.npcs || []).length;
    var used = {}; contexts().forEach(function (c) { (c.m.steps || []).forEach(function (s) { if (s.npc) used[ST.tok(Z.P, s.npc)] = 1; }); });
    (Z.npcs || []).forEach(function (n) { if (n.def && n.def.cameo) n.hidden = !used[n.id]; });
  }
  function start(c, r) {
    var st = c.st, P = Z.P; if (!st) return;
    if (st.turn) { try { Z.api.sound.sfx("special"); Z.api.banner("!", { sub: st.text || "", dur: 1.4, size: 60 }); } catch (e) {} }
    if (c.which === "main" && st.lines && st.t !== "talk" && !(Z.intro && Z.intro.on)) ST.say(st.lines);
    var mu = c.m.music || {}; ST.cue(st.music || (st.turn && mu.turn) || (c.i === 0 && mu.start) || null);
    var t = st.t, n;
    if (t === "talk" && st.npcAt && (n = npcOf(st.npc))) { var wp = placeOf(st.npcAt); if (wp) { r.npcBack = { n: n, x: n.x, y: n.y, hx: n.hx, hy: n.hy }; var fw = S.push(Z.W, wp.mx + 2.5, wp.my + 2.5, .6); n.x = n.hx = fw.x; n.y = n.hy = fw.y; } }
    if (t === "delivery" || t === "carry") { if (st.item && (P.inv[st.item] || 0) < (st.count || 1)) P.inv[st.item] = st.count || 1; }
    if (st.title) { try { Z.api.banner(st.title, { sub: st.titleSub || "", dur: 5, size: Math.min(80, 1100 / st.title.length) }); } catch (e) {} }
    Z.hideHud = st.hud === false;
    if ((t === "walk" || t === "escort" || t === "convoy") && (n = npcOf(st.npc))) { try { if (Z.friends && Z.friends.follow && Z.friends.isFriend && Z.friends.isFriend(n)) { Z.friends.follow(n, 900); r.friend = true; } } catch (e) {} n.story = "follow"; }
    if ((t === "tail" || t === "chase") && (n = npcOf(st.npc))) { var tg = placeOf(st.place) || placeOf("gate"); n.story = t; r.path = t === "tail" && tg ? S.route(Z.W, n.x, n.y, tg.mx, tg.my) : null; r.pi = 2; }
    if (t === "collect") { var pl = placeOf(st.at || st.place), got = c.which === "main" ? (P.m.n || 0) : ((story(P).side || {}).n || 0), kept = story(P).collect, gotI = kept && kept.key === ctxKey(c) ? kept.got : null; r.left = []; for (var i = 0; i < (st.n || 1); i++) { if (gotI ? gotI.indexOf(i) >= 0 : i < got) continue; /* after a reload only the ones not yet found (indices saved in story.collect) */ if (st.places && st.places.length) pl = placeOf(st.places[i % st.places.length]) || pl; var a = S.hash(i, 77) * TAU, rr = 6 + S.hash(i, 13) * (st.places ? 12 : (st.r || 40)), f = pl ? S.push(Z.W, pl.mx + Math.cos(a) * rr, pl.my + Math.sin(a) * rr, 1) : { x: Z.me.x, y: Z.me.y }; for (var ck = 1; pl && ck < 12 && (S.inWater(Z.W, f.x, f.y) || S.insideBuilding(Z.W, f.x, f.y)); ck++) f = S.push(Z.W, pl.mx + Math.cos(a + ck * 2.4) * Math.max(5, rr - ck * 3), pl.my + Math.sin(a + ck * 2.4) * Math.max(5, rr - ck * 3), 1); r.left.push({ x: f.x, y: f.y, i: i }); } nextPick(st, r); }
    if (t === "defend") { r.spawn = 0; }
    if (t === "switch" && Z.sw && Z.sw.begin) Z.sw.begin(c, r, st);
    if (t === "phone") r.asked = false;
    if (t === "keep") { r.day0 = P.day; }
    if (t === "care") r.aid = 0;
    r.started = true;
  }
  function nextPick(st, r) { var me = Z.me, best = null, bd = 1e9; r.left.forEach(function (q) { var d = Math.hypot(q.x - me.x, q.y - me.y); if (d < bd) { bd = d; best = q; } }); r.cur = best; Z.quest = best ? { item: st.item, x: best.x, y: best.y, cx: best.x, cy: best.y, r: 30 } : null; }
  function fail(c, r, why) {
    var P = Z.P, st = c.st, f = st.fail || c.m.fail || {}, cost = f.cost || {};
    if (cost.energy) P.energy = Math.max(0, Math.min(100, P.energy + cost.energy)); if (cost.money) P.money = Math.max(0, P.money + cost.money);
    try { Z.moment("fail", { title: c.m.title, sub: f.text || why || "Try again." }); } catch (e) { Z.toast(f.text || why || "Try again."); }
    var to = f.resume != null ? f.resume : c.i;
    if (c.which === "main") { P.m.step = Math.max(0, Math.min(to, c.m.steps.length - 1)); P.m.n = 0; if (Z.stepStart) Z.stepStart(); } else { var s = story(P); if (s.side) { s.side.step = Math.max(0, Math.min(to, c.m.steps.length - 1)); s.side.n = 0; } }
    arr(st.npc).forEach(function (id) { var n = npcOf(id); if (n) n.story = ""; }); ST.ctx[c.which] = null;
  }
  function moveNpc(n, tx, ty, sp, dt) { var dx = tx - n.x, dy = ty - n.y, d = Math.hypot(dx, dy); if (d < .05) { n.spd = 0; return d; } var s = Math.min(d, sp * dt); var f = S.push(Z.W, n.x + dx / d * s, n.y + dy / d * s, .5); n.x = f.x; n.y = f.y; n.a = Math.atan2(dy, dx); n.spd = sp; return d - s; }
  function drive(c, r, dt) {
    var st = c.st, P = Z.P, me = Z.me, t = st.t, n, pl, d;
    if (st.limit && r.t > st.limit) return fail(c, r, "Out of time.");
    switch (t) {
      case "turn": if ((!ST.busy() && r.t > 3) || r.t > ((st.scene && st.scene.maxDuration) || 30)) { if (ST.busy()) ST.skipScene(); /* the watchdog: a beat can never hold the player */ fire(c, { t: "turn" }); } break;
      case "switch": if (Z.sw && Z.sw.drive) Z.sw.drive(c, r, dt, st); else if (r.t > .5) fire(c, { t: "switch", npc: st.npc && ST.tok(P, st.npc) }); break;
      case "choice": case "choose": case "vote": if (!r.asked && !ST.busy() && !(Z.intro && Z.intro.on) && !(Z.api.overlayOpen && Z.api.overlayOpen())) { r.asked = true; ST.ask(c, st); } break;
      case "look": case "watch": case "listen": case "social":
        pl = st.npc ? npcOf(st.npc) : placeOf(st.place || st.at);
        if (pl && near(pl, st.r || (t === "social" ? 25 : 20))) { r.n += dt * (t === "social" && (me.sit || me.emote === "dance") ? 2 : 1); if (r.n >= (st.secs || (t === "social" ? 20 : 6))) fire(c, { t: t, place: st.place, npc: st.npc && ST.tok(P, st.npc) }); }
        break;
      case "walk": case "escort": case "convoy":
        n = npcOf(st.npc); pl = placeOf(st.place);
        if (n && !r.friend) { if (me.veh && t !== "walk") { n.x = me.x - Math.cos(me.a) * 2; n.y = me.y - Math.sin(me.a) * 2; } else moveNpc(n, me.x - Math.cos(me.a) * 1.8, me.y - Math.sin(me.a) * 1.8, Math.max(3, Math.hypot(me.vx || 0, me.vy || 0) * 1.05 || 4.9), dt); }
        if (n) { d = dist(n, me); r.lag = d > 80 ? (r.lag || 0) + dt : 0; if (r.lag > 15) return fail(c, r, "You lost them."); }
        if (t === "walk" && me.veh) { if (!r.warned) { r.warned = 1; Z.toast("Walk this one. On foot."); } break; }
        if (pl && near(pl, 15) && (!n || dist(n, me) < 20)) { if (n) n.story = ""; fire(c, { t: t, place: st.place }); }
        break;
      case "tail":
        n = npcOf(st.npc); pl = placeOf(st.place); if (!n || !pl) { fire(c, { t: t }); break; }
        var sp = st.veh || me.veh ? 9 : 3.6, path = r.path || [n.x, n.y, pl.mx, pl.my];
        if (r.pi < path.length) { var left = moveNpc(n, path[r.pi], path[r.pi + 1], sp, dt); if (left < .3) r.pi += 2; }
        d = dist(n, me); r.close = d < (st.near || 25) ? (r.close || 0) + dt : 0; r.far = d > (st.far || 60) ? (r.far || 0) + dt : 0;
        if (r.close > 3 || r.horn) { n.story = ""; return fail(c, r, "Too close. They've seen you."); }
        if (r.far > 10) { n.story = ""; return fail(c, r, "You lost them."); }
        if (r.pi >= path.length || near({ x: n.x, y: n.y, mx: pl.mx, my: pl.my }, 0) || Math.hypot(n.x - pl.mx, n.y - pl.my) < 6) { n.story = ""; fire(c, { t: t, place: st.place }); }
        break;
      case "chase":
        n = npcOf(st.npc); if (!n) { fire(c, { t: t }); break; } d = dist(n, me);
        if (d < 2.5) { n.story = ""; fire(c, { t: t, npc: n.id }); break; }
        if (d < 40) moveNpc(n, n.x + (n.x - me.x) / d * 5, n.y + (n.y - me.y) / d * 5, S.FOOT.run * .86, dt);
        break;
      case "stealth": pl = placeOf(st.place); if (r.seen) return fail(c, r, "Security spotted you."); if (pl && near(pl, 13)) fire(c, { t: t, place: st.place }); break;
      case "delivery": case "carry": pl = placeOf(st.place);
        if (t === "carry" && me.veh) { if (!r.warned) { r.warned = 1; Z.toast("You can't ride with that in your arms."); } break; }
        if ((st.careful || st.count) && me.veh) { var v = Math.hypot(me.veh.vx || 0, me.veh.vy || 0) || Math.abs(me.veh.speed || 0);
          if (r.v != null && (r.v - v) / Math.max(dt, 1e-3) > 22) { r.v = null; if (st.count) { r.spilt = (r.spilt || 0) + 1; Z.toast("Spilt one. " + (st.count - r.spilt) + " of " + st.count + " left."); if (r.spilt > (st.spill || 0)) return fail(c, r, "Too much spilt."); } else return fail(c, r, "Crash. It broke."); } else r.v = v; }
        if (pl && near(pl, 13)) fire(c, { t: t, place: st.place, item: st.item });
        break;
      case "build": pl = placeOf(st.place); if (pl && near(pl, 13)) { var ok = true; for (var k in (st.parts || {})) if ((P.inv[k] || 0) < st.parts[k]) ok = false; if (ok) fire(c, { t: t, place: st.place }); else if (!r.warned) { r.warned = 1; Z.toast("You don't have all the parts yet."); } } break;
      case "care":
        n = npcOf(st.npc); pl = placeOf(st.place || "sickbay");
        if (n && r.aid < 3) { if (dist(n, me) < 3 && Z.api.down && Z.api.down("act")) { r.aid += dt; if (r.aid >= 3) { Z.toast("First aid done. Get them to " + (pl ? pl.name : "the Sick Bay") + "."); n.story = "follow"; } } break; }
        if (n && r.aid >= 3) { if (me.veh) { n.x = me.x; n.y = me.y; } else moveNpc(n, me.x - 1.5, me.y - 1.5, 4, dt); }
        if (pl && near(pl, 15)) { if (n) { n.story = ""; try { if (Z.interior && Z.interior.admit) Z.interior.admit(n); } catch (e) {} } fire(c, { t: t, npc: st.npc && ST.tok(P, st.npc), place: st.place }); }
        break;
      case "quiz": case "teach":
        pl = st.npc ? npcOf(st.npc) : st.place ? placeOf(st.place) : null;
        if (!r.asked && (!pl || near(pl, 8)) && !ST.busy() && !(Z.api.overlayOpen && Z.api.overlayOpen())) { r.asked = true; ST.quiz(c, st); }
        break;
      case "rhythm": if (P.flags.danceBest >= (st.pass || 1) && r.best0 == null) r.best0 = P.flags.danceBest; if (!r.hint && !ST.busy()) { r.hint = 1; Z.toast("Head to the dance floor at Samaru Market and dance to the beat."); } break;
      case "arcade": case "sports":
        var game = t === "arcade" ? st.game : st.sport === "tabletennis" ? "tabletennis" : null;
        if (game && Z.mini && Z.mini.open && !r.asked) { pl = placeOf(st.at || st.place || (t === "arcade" ? "mk_arcade" : null)); if (!pl || near(pl, 15)) { r.asked = true; ST.wantGame = { c: c.which, game: game, pass: st.pass }; Z.mini.open(game, { free: true }); } }
        if (!game) { pl = placeOf(st.at || st.place || "court"); if (pl && near(pl, 40)) { r.n += dt; if (r.n >= (st.secs || 45)) { Z.toast("<b>Full time.</b> You played your part."); fire(c, { t: t }); } } }
        break;
      case "flight":
        if (!me.veh || me.veh.type !== "plane") break; var route = st.route || [], tgt = placeOf(route[r.i]); if (!tgt) break;
        if (Math.hypot(me.x - tgt.mx, me.y - tgt.my) < 70 && (!st.low || (me.alt || 0) < .45)) { r.i++; try { Z.api.sound.sfx("coin"); } catch (e) {} fire(c, { t: t, n: 1 }); }
        break;
      case "routine":
        var h = P.time / 60; (st.at || []).forEach(function (e, j) { r.got = r.got || {}; if (r.got[j]) return; var q = placeOf(e[0]); if (q && h >= e[1] && h < e[1] + 1 && near(q, 20)) { r.got[j] = 1; fire(c, { t: t, n: 1 }); } });
        break;
      case "defend":
        pl = placeOf(st.place); if (!pl) { fire(c, { t: t }); break; }
        if (!near(pl, 40)) { r.away = (r.away || 0) + dt; if (r.away > 10) return fail(c, r, "You left them to it."); break; } r.away = 0; r.n += dt;
        r.spawn -= dt; if (r.spawn <= 0 && Z.spawnFoe && D.ENEMIES[st.enemy || "bully"]) { r.spawn = 9; var a = Math.random() * TAU; try { Z.spawnFoe(st.enemy || "bully", pl.mx + Math.cos(a) * 25, pl.my + Math.sin(a) * 25, true); } catch (e) {} }
        if (r.n >= (st.secs || 60)) fire(c, { t: t, place: st.place });
        break;
      case "keep":
        var val = st.stat === "money" || !st.stat ? P.money : P.inv[st.stat] || 0; if (val < (st.min || 0)) return fail(c, r, "You dipped below what you promised to keep.");
        if (P.day - r.day0 >= (st.days || 1)) fire(c, { t: t });
        break;
      case "bank": pl = placeOf(st.place || "bank"); if (pl && near(pl, 13)) { if (P.money >= (st.amount || 0)) { P.money -= st.amount || 0; story(P).savings += st.amount || 0; fire(c, { t: t }); } else if (!r.warned) { r.warned = 1; Z.toast("You need ₦" + (st.amount || 0) + " to put away."); } } break;
      case "buy": // story items are sold where the script says (at/place), or at any shop, food stall or store
        if (r.bought || (Z.api.overlayOpen && Z.api.overlayOpen())) break; var itm = D.ITEMS[st.item]; if (!itm) break;
        var shop = st.at || st.place ? placeOf(st.at || st.place) : (Z.placeList || []).filter(function (q) { return /^(store|food|shop)$/.test(q.role) && near(q, 13); })[0];
        if (shop && near(shop, 13)) { if (r.offered !== shop.id) { r.offered = shop.id; ST.sell(c, st, itm); } } else r.offered = null;
        break;
      case "phone": if (!r.asked && !ST.busy() && !(Z.api.overlayOpen && Z.api.overlayOpen())) { r.asked = true; ST.call(c, st); } break;
      case "awards": if (!r.asked) { r.asked = true; try { Z.moment("finale", { sub: st.title || c.m.title }); } catch (e) {} } if ((r.t > 5 && !ST.busy()) || r.t > ((st.scene && st.scene.maxDuration) || 30)) fire(c, { t: t }); break;
    }
  }
  // events from the rest of the game that drive the new step types
  var origEmit = Z.emit;
  Z.emit = function (ev) {
    var P = Z.P; if (!P || !ev) return origEmit(ev);
    contexts().forEach(function (c) {
      var st = c.st, r = ST.ctx[c.which]; if (!st || !r) return;
      if (st.t === "collect" && ev.t === "find" && ev.item === st.item && r.cur) { var sc = story(Z.P); if (!sc.collect || sc.collect.key !== ctxKey(c)) sc.collect = { key: ctxKey(c), got: [] }; sc.collect.got.push(r.cur.i); r.left = r.left.filter(function (q) { return q !== r.cur; }); fire(c, { t: "collect", item: st.item, n: 1 }); if (r.left.length) nextPick(st, r); else Z.quest = null; }
      if (st.t === "stealth" && (ev.t === "warn" || ev.t === "wanted")) r.seen = true;
      if (st.t === "tail" && ev.t === "horn") r.horn = true;
      if (st.t === "rhythm" && ev.t === "emote" && ev.emote === "dance" && ev.place === "mk_dance" && (st.soft || (P.flags.danceBest || 0) >= (st.pass || 1))) fire(c, { t: "rhythm", score: P.flags.danceBest });
      if (st.t === "talk" && ev.t === "talk" && (st.lines || st.linesLost) && S.stepMatches(st, ev) && !(Z.intro && Z.intro.on)) ST.say(P.flags.last_result_lost && st.linesLost ? st.linesLost : st.lines);
      if (st.t === "buy" && ev.t === "buy" && ev.item === st.item) ST.ctx[c.which] && (ST.ctx[c.which].bought = 1);
    });
    if (ev.t === "talk" && ev.npc === "maker" && P.flags.maker_free) { var s = story(P), line = MAKER[s.heard % MAKER.length]; s.heard++; ST.say([["maker", line]]); }
    if (ev.t === "talk" && story(P).rel[ev.npc]) ST.together(P, ev.npc);
    if (ev.t === "talk" && !ev.story && !story(P).side) {
      if (ST.pending && ST.pending.who === ev.npc) ST.accept();
      else { var sg = (D.SIDE || []).filter(function (m) { return ST.tok(P, m.giver) === ev.npc && ST.sideOpen(m); })[0]; if (sg && !ST.pending) ST.offer(sg, sg.title, sg.intro || ""); }
    }
    if (story(P).side && !ev.story) ST.sideEvent(ev);
    return origEmit(ev);
  };
  ST.miniResult = function (id, res) { var w = ST.wantGame; if (!w || w.game !== id) return; ST.wantGame = null; var c = contexts().filter(function (q) { return q.which === w.c; })[0]; if (!c) return; var won = w.pass ? res.score >= w.pass : res.won !== false; flag(Z.P, "last_result_lost", !won);
    if (won || c.st.soft || c.st.anyResult) fire(c, { t: c.st.t, score: 1e9 }); else { Z.toast("Not this time. Try again."); var r = ST.ctx[c.which]; if (r) r.asked = false; } };

  /* ---------- dialogs: choices, quizzes, calls ---------- */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]; }); }
  function allowed(P, o) { if (o.sex && o.sex !== sex(P)) return false; var n = o.need || {}, s = story(P); for (var t in (n.standing || {})) if ((s.standing[t] || 0) < n.standing[t]) return false; if ((n.flags || []).some(function (f) { return !P.flags[f]; })) return false; return true; }
  function topTrack(P) { var s = story(P).standing, best = null; TRACKS.forEach(function (t) { if (best == null || (s[t] || 0) > (s[best] || 0)) best = t; }); return best; }
  ST.options = function (st) { var P = Z.P; return (st.options || []).map(function (o, i) { return { o: o, i: i }; }).filter(function (x) { return allowed(P, x.o); }); };
  ST.pick = function (c, st, i) { // used by the dialog and by the tests
    var P = Z.P, o = (st.options || [])[i], r = ST.ctx[c.which] || {}; if (!o) return;
    if (o.fate) { var pool = ST.options(st).filter(function (x) { return x.o.roomie; }); if (o.lines) ST.say(o.lines); if (pool.length) { i = pool[Math.floor(S.hash(P.day + 7, (P.name || "").length) * pool.length)].i; o = st.options[i]; } } story(P).picks[c.id + "." + c.i + (r.picked ? "." + r.picked.length : "")] = i; ST.apply(P, o); if (o.lines) ST.say(o.lines);
    r.picked = (r.picked || []).concat(i); ST.lastPick = { id: c.id, i: i, flags: arr(o.set), label: o.label, rumour: o.rumour || null, day: P.day };
    var lg = story(P).log || (story(P).log = []); lg.push([c.id, P.day, String(o.label || "").slice(0, 60)]); if (lg.length > 60) lg.shift(); // the choices you made, for the consequences ledger
    try { if (Z.kit && Z.kit.listeners.picked) Z.kit.listeners.picked.forEach(function (fn) { fn(ST.lastPick, P); }); } catch (ePk) {}
    if ((st.pick || 1) > r.picked.length && ST.options(st).filter(function (x) { return r.picked.indexOf(x.i) < 0; }).length) { r.asked = false; return; } // pick two: ask again
    fire(c, { t: st.t === "choose" || st.t === "vote" ? st.t : "choice", pick: i });
  };
  ST.ask = function (c, st) {
    var P = Z.P, r = ST.ctx[c.which] || {}, opts = ST.options(st).filter(function (x) { return !(r.picked || []).some(function (k) { return k === x.i; }); });
    if (!opts.length) return fire(c, { t: st.t });
    if (st.byStanding) { var tt = topTrack(P), hit = opts.filter(function (x) { return x.o.track === tt; })[0] || opts[0]; Z.toast("<b>" + esc(hit.o.label) + "</b>"); return ST.pick(c, st, hit.i); }
    Z.api.show("<h2>" + esc(st.prompt || st.text || "Your call") + "</h2>" + ((st.pick || 1) > 1 ? "<p class='gm-small'>Pick " + st.pick + ".</p>" : "") + (st.clock ? "<p class='gm-small'>Quick — the clock is running.</p>" : "") + "<div class='gm-actions' style='display:flex;flex-direction:column;align-items:stretch;width:min(520px,100%);max-width:520px;margin:0 auto;gap:8px;grid-template-columns:none'>" + opts.map(function (x, k) { return "<button class='gm-btn" + (k ? "" : " gm-btn--go") + "' style='min-height:48px;height:auto;aspect-ratio:auto;padding:10px 14px;font-size:16px;width:100%;flex:none' data-act='o" + x.i + "'>" + esc(x.o.label) + "</button>"; }).join("") + "</div>",
      function (a) { Z.api.hide(); ST.pick(c, st, +String(a).slice(1) || 0); });
  };
  ST.quiz = function (c, st) {
    var P = Z.P, qs = S.pickQuestions(D.QUESTIONS, Math.random, st.n || 3, st.subject, P.seenQ), qi = 0, right = 0, who = st.npc ? (npcOf(st.npc) || { def: { name: "" } }).def.name : "";
    function ask() {
      if (qi >= qs.length) { Z.api.hide(); var ok = right >= (st.pass || Math.ceil(qs.length * .6)); Z.toast(ok ? "<b>" + right + " / " + qs.length + ".</b> " + (st.t === "teach" ? who + " gets it now." : "Well done.") : "<b>" + right + " / " + qs.length + ".</b> Not enough. Try again."); flag(P, "last_result_lost", !ok); if (ok || st.soft) fire(c, { t: st.t, score: ok ? right : 1e9 }); else { var r = ST.ctx[c.which]; if (r) r.asked = false; } return; }
      var q = qs[qi]; if (P.seenQ) P.seenQ[q.id] = 1;
      var struck = -1; try { if (Z.sw && Z.sw.takeHint && Z.sw.takeHint()) { for (var w = 0; w < q.o.length; w++) if (w !== q.a) struck = w; ST.lastHint = q.id; } } catch (eH) {} // a friend's tutorial (Fatima, Ada, Shamsu) strikes out one wrong answer
      Z.api.show("<p class='gm-small'>" + (st.t === "teach" ? "Explain it to " + esc(who) + " · " : "") + "Question " + (qi + 1) + " of " + qs.length + (struck >= 0 ? " · tutorial: one wrong answer struck out" : "") + "</p><h2 style='font-size:clamp(17px,3.2vw,24px)'>" + esc(q.q) + "</h2><div class='gm-actions' style='flex-direction:column;align-items:stretch;max-width:520px;margin:0 auto'>" + q.o.map(function (o, i) { return "<button class='gm-btn' data-act='a" + i + "'" + (i === struck ? " disabled style='opacity:.4;text-decoration:line-through'" : "") + ">" + esc(o) + "</button>"; }).join("") + "</div>",
        function (a) { if (+String(a).slice(1) === q.a) { right++; try { Z.api.sound.sfx("coin"); } catch (e) {} } else { try { Z.api.sound.sfx("block"); } catch (e) {} } qi++; ask(); });
    }
    ask();
  };
  ST.sell = function (c, st, itm) {
    var P = Z.P, price = itm.price || 0;
    Z.api.show("<h2>" + esc(itm.name) + "</h2><p>" + esc(itm.text || "") + "</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='y'>Buy · ₦" + price.toLocaleString() + "</button><button class='gm-btn' data-act='n'>Not now</button></div>",
      function (a) { Z.api.hide(); if (a !== "y") return; if (P.money < price) { Z.toast("You need ₦" + price.toLocaleString() + "."); return; } P.money -= price; P.inv[st.item] = (P.inv[st.item] || 0) + 1; try { Z.api.sound.sfx("coin"); } catch (e) {} Z.emit({ t: "buy", item: st.item }); });
  };
  ST.call = function (c, st) {
    var who = st.contact || (st.npc ? (npcOf(st.npc) || { def: { name: st.npc } }).def.name : "Someone");
    Z.api.show("<h2>📞 " + esc(who) + "</h2><p>" + (st.incoming === false ? "Make the call?" : "is calling…") + "</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='y'>" + (st.incoming === false ? "Call" : "Answer") + "</button></div>",
      function () { Z.api.hide(); ST.say(st.lines || []); fire(c, { t: "phone", npc: st.npc && ST.tok(Z.P, st.npc) }); });
  };

  /* ---------- side missions and ambient encounters: offers ---------- */
  function free() { var P = Z.P; if ((Z.intro && Z.intro.on) || story(P).side || ST.pending || Z.race || P.job || Z.date || Z.blackout || (Z.mini && Z.mini.active && Z.mini.active())) return false; try { if (Z.focus && Z.focus.allow && !Z.focus.allow("ambient")) return false; } catch (e) {} return !(Z.api.overlayOpen && Z.api.overlayOpen()); }
  function offers(dt) {
    ST.offerT = (ST.offerT == null ? 60 : ST.offerT) - dt; if (ST.offerT > 0 || !free() || (Z.P.m.active && Z.step && Z.step() && Z.step().limit) || (Z.foes && Z.foes.some(function (f) { return f.quest; }))) return; ST.offerT = 25;
    var P = Z.P, me = Z.me, side = (D.SIDE || []).filter(function (m) { var pl = placeOf(m.where || (m.steps[0] && (m.steps[0].place || m.steps[0].at))); return ST.sideOpen(m) && pl && near(pl, 60); })[0];
    if (side) return ST.offer(side, side.title, side.intro || (side.steps[0] && side.steps[0].text) || "");
    var amb = D.AMBIENT || [], h = P.time / 60, night = h < 6 || h >= 19, here = amb.filter(function (e) { if (e.time === "day" && night || e.time === "night" && !night) return false;
      if (e.notAfter && P.m.done[e.notAfter]) return false; if (e.hot && (h < 12 || h > 16)) return false; if (e.needItem && !(P.inv[e.needItem] > 0)) return false; return arr(e.where).some(function (id) { var q = placeOf(id); return q && near(q, 80); }); });
    if (!here.length || Math.random() > .5) return; var e = here[Math.floor(Math.random() * here.length)], v = (e.variants || [])[Math.floor(Math.random() * (e.variants || []).length)]; if (!v) return;
    ST.offerT = ST.gap(); var m = ST.ambient(e, v); if (m) { if (v.setup) ST.say([["", v.setup]]); ST.offer(m, e.title, v.ask || ""); }
  };
  ST.ambient = function (e, v) { // a one-off mission built from an encounter template, with its people spawned beside you
    var steps = (v.steps || []).filter(Boolean).map(clone); if (!steps.length) steps = [{ t: "go", place: arr(e.where)[0], text: e.title }];
    var help = e.help || {}, tw = e.twist && Math.random() < (e.twist.chance || .2);
    if (tw && e.twist.then) steps = steps.concat(arr(e.twist.then).map(clone)); steps.forEach(prep);
    var m = { id: "amb_" + e.id, amb: e.id, title: e.title, steps: steps, who: v.who || {}, thanks: v.thanks, decline: e.decline, hidden: !!help.hidden,
      reward: { cash: (help.cash != null ? help.cash : 150) + (tw ? (e.twist.cash || 0) : 0), xp: help.xp != null ? help.xp : 40, standing: help.standing || { community: 1 }, flags: arr(help.flags), item: tw && e.twist.give ? e.twist.give : help.item }, twist: tw ? e.twist.text : "" };
    D.AMBIENT_RUN = [m]; spawnTemps(m, e, v); return m;
  };
  function tempNpc(id, look, x, y) {
    var base = Z.npcs && Z.npcs[0]; if (!base) return null; var old = Z.npc(id); if (old) Z.npcs.splice(Z.npcs.indexOf(old), 1);
    var voice = look.voice || "male", names = D.NAMES || [], nm = look.name || (names.length ? String(names[Math.floor(Math.random() * names.length)]) : "Student");
    var def = { id: id, name: nm, role: "Student", at: "gate", skin: look.skin || (voice === "female" ? "#8a5633" : "#6b4226"), hair: look.hair || (voice === "female" ? "braids" : "low"), top: look.top || "#64748b", voice: voice, pitch: 1, hi: ["Hello."], temp: true };
    var n = clone(base); n.id = id; n.def = def; n.look = { skin: def.skin, hair: def.hair, top: def.top }; var f = S.push(Z.W, x, y, .6); n.x = n.hx = f.x; n.y = n.hy = f.y; n.follow = false; n.story = ""; n.k = Z.npcs.length; n.temp = true; Z.npcs.push(n); return n;
  }
  function spawnTemps(m, e, v) {
    var me = Z.me; if (!me || !Z.places) return; var a = me.a || 0;
    Z.places.amb_here = { id: "amb_here", name: "here", mx: me.x, my: me.y, def: {}, role: "" };
    tempNpc("amb_who", m.who, me.x + Math.cos(a) * 3, me.y + Math.sin(a) * 3);
    var json = JSON.stringify(m.steps); if (json.indexOf("$other") >= 0 || json.indexOf("amb_other") >= 0) { var b = Math.random() * TAU; tempNpc("amb_other", {}, me.x + Math.cos(b) * 30, me.y + Math.sin(b) * 30); }
  }
  function clearTemps() { if (Z.npcs) for (var i = Z.npcs.length - 1; i >= 0; i--) if (Z.npcs[i].temp) Z.npcs.splice(i, 1); if (Z.places) delete Z.places.amb_here; }
  ST.clearTemps = clearTemps;
  // an offer is a person calling out, never a pop-up: talk to them within 30 s to help; walk on and it lapses
  ST.offer = function (m, title, ask) {
    var who = m.amb ? "amb_who" : ST.tok(Z.P, m.giver) || ""; if (ask) ST.say([[who, ask]]);
    ST.pending = { m: m, who: who, t: 30 }; Z.toast("<b>" + esc(title) + "</b><br><small>Talk to " + (m.amb ? "them" : "them again") + " (E) to help.</small>");
  };
  ST.decline = function () { var p = ST.pending; if (!p) return; ST.pending = null; ST.offerT = ST.gap(); if (p.m.amb) { if (p.m.decline) ST.say([[p.who, p.m.decline]]); setTimeout(clearTemps, 5000); } };
  ST.accept = function () { var p = ST.pending; if (!p) return false; ST.pending = null; return ST.startSide(p.m); };
  ST.gap = function () { var r = (D.AMBIENT_RULES || {}).minGap; return r || 180; };

  /* ---------- the Maker, walking free after the ring ---------- */
  function maker(dt) {
    var P = Z.P; if (!P.flags.maker_free && !P.m.done.m116) return; P.flags.maker_free = 1; var n = Z.npc("maker"); if (!n) return;
    var h = P.time / 60, at = h < 9 ? "shayi" : h < 16 ? "facgarden" : h < 19 ? "dam" : "selfie"; if (P.m.done.m120) at = "selfie";
    var pl = placeOf(at); if (!pl || n.story) return; if (Math.hypot(n.x - pl.mx, n.y - pl.my) > 4) moveNpc(n, pl.mx + 3, pl.my + 2, 1.4, dt); else n.spd = 0;
  }

  /* ---------- music cues: map the script names onto what the game already plays ---------- */
  // sting_* → a stinger now; tension_* / motif_* / place_* are remembered as ST.lastCue for the music system (zone music
  // keeps playing; the music owner can layer on ST.lastCue). No new audio files are needed.
  ST.cue = function (name) { if (!name || typeof name !== "string") return; try { if (/^sting_/.test(name)) Z.api.sound.sfx(/fail|loss|sad/.test(name) ? "lose" : "special"); } catch (e) {} ST.lastCue = name; };

  /* ---------- the friends-mission list (the multiplayer tab reads this) ---------- */
  ST.coop = function (players) { return (D.COOP || []).filter(function (f) { var p = f.players || [2, 6]; return !players || (players >= p[0] && players <= p[1]); }); };

  /* ---------- checks the tests run ---------- */
  ST.validate = function () {
    var probs = [], places = {}, npcs = {}, items = D.ITEMS, flags = {}, seen = {}, eng = ST.ENGINE_FLAGS.forEach(function (f) { flags[f] = 1; }), races = { r1: 1, r2: 1, r3: 1, r4: 1, r5: 1, r6: 1, r7: 1, r8: 1 }, toks = /^(@(roomie|best|crush|partner|hod|boss|hostel|home|dept|super|place|hostelshop)|\$(who|here|other)|pitch|quad|fountain|oldcampus|forest_edge|rangerpost|p2bend|fence|pier)$/;
    D.PLACES.forEach(function (p) { places[p.id] = 1; }); D.NPCS.forEach(function (n) { npcs[n.id] = 1; });
    function chkPlace(m, v) { if (v != null && !places[v] && !toks.test(v)) probs.push(m.id + ": unknown place " + v); }
    function chkNpc(m, v) { if (v != null && !npcs[v] && !npcs[ST.tok(null, v)] && !toks.test(v)) probs.push(m.id + ": unknown npc " + v); }
    var main = D.MISSIONS.filter(function (m) { return !m.side; });
    main.forEach(function (m, i) {
      if (m.id !== "m" + (i + 1)) probs.push("ids not continuous at " + m.id + " (expected m" + (i + 1) + ")");
      ((m.need || {}).done || []).forEach(function (id) { if (!seen[id]) probs.push(m.id + ": needs " + id + " which is not earlier"); });
      ((m.need || {}).flags || []).forEach(function (f) { if (!flags[f]) probs.push(m.id + ": needs flag " + f + " never set before"); });
      check(m); seen[m.id] = 1; arr((m.reward || {}).flags).concat(arr((m.reward || {}).flag)).forEach(function (f) { flags[f] = 1; });
    });
    (D.SIDE || []).forEach(check);
    function check(m) {
      (m.steps || []).forEach(function (s, j) {
        if (KNOWN.indexOf(s.t) < 0) probs.push(m.id + "." + j + ": unknown step type " + s.t);
        chkPlace(m, s.place); chkPlace(m, s.at && !Array.isArray(s.at) ? s.at : null); chkNpc(m, s.npc);
        if (s.item && !items[s.item]) probs.push(m.id + "." + j + ": unknown item " + s.item);
        if (s.enemy && !D.ENEMIES[s.enemy]) probs.push(m.id + "." + j + ": unknown enemy " + s.enemy);
        if (s.race && !races[s.race]) probs.push(m.id + "." + j + ": unknown race " + s.race);
        if (s.veh && !S.VEH[s.veh]) probs.push(m.id + "." + j + ": unknown vehicle " + s.veh);
        if (s.t === "flight") (s.route || []).forEach(function (p) { chkPlace(m, p); });
        if (s.t === "routine") (s.at || []).forEach(function (e) { chkPlace(m, e[0]); });
        for (var k in (s.parts || {})) if (!items[k]) probs.push(m.id + "." + j + ": unknown part " + k);
        if (s.if && !flags[s.if]) probs.push(m.id + "." + j + ": if-flag " + s.if + " never set before");
        if (s.unless && !flags[s.unless]) probs.push(m.id + "." + j + ": unless-flag " + s.unless + " never set before");
        if ((s.t === "choice" || s.t === "choose" || s.t === "vote") && (!s.options || s.options.length < 2)) probs.push(m.id + "." + j + ": choice needs two options");
        (s.options || []).forEach(function (o) { arr(o.set).forEach(function (f) { flags[f] = 1; }); if (o.partner) chkNpc(m, o.partner); });
        arr(s.set).forEach(function (f) { flags[f] = 1; });
        if (s.t === "switch") { if (!s.npc && !(s.team && s.team.length)) probs.push(m.id + "." + j + ": switch needs npc or team"); arr(s.team).forEach(function (id) { chkNpc(m, id); }); arr(s.tasks).concat(s.task ? [s.task] : []).forEach(function (q) { chkPlace(m, q.place); chkNpc(m, q.npc); if (q.who && q.who !== "me") chkNpc(m, q.who); if (q.set) arr(q.set).forEach(function (f) { flags[f] = 1; }); }); }
        arr(s.lines).forEach(function (l) { if (Array.isArray(l) && l[0] && l[0] !== "me" && l[0].indexOf(":") < 0 && l[0] !== "radio") chkNpc(m, l[0]); });
      });
    }
    return probs.concat(ST.issues);
  };

  /* ---------- solver: completes any step from its data (headless tests; never used in play) ---------- */
  ST.solve = function (which, pickIndex) {
    var c = contexts().filter(function (q) { return q.which === (which || "main"); })[0]; if (!c) return false; var st = c.st;
    if (st.t === "choice" || st.t === "choose" || st.t === "vote") {
      var ok = ST.options(st); if (!ok.length) { fire(c, { t: st.t }); return true; }
      if (st.byStanding) { ST.ask(c, st); return true; }
      var r = ST.ctx[c.which] || (ST.ctx[c.which] = { key: ctxKey(c), t: 0 }), left = ok.filter(function (x) { return (r.picked || []).indexOf(x.i) < 0; }), x = left[Math.min(left.length - 1, pickIndex || 0)] || ok[0];
      ST.pick(c, st, x.i); return true;
    }
    var P = Z.P; if (st.t === "build") for (var k in (st.parts || {})) P.inv[k] = Math.max(P.inv[k] || 0, st.parts[k]);
    if (st.t === "bank" && P.money < (st.amount || 0)) P.money = st.amount;
    var ev = ST.auto(st); ev.n = st.n || 1; ev.score = 1e9; fire(c, ev); return true;
  };

  ST.merge();
  // Where the guide line, minimap star and HUD distance point. Read from the step (MASTER_GAME_GUIDE §4.1): a live
  // search item first (the gem, not the place it is near), then the step's own place, then sensible defaults for steps
  // that name no place (a vehicle of the right type, your lecture).
  ST.targetOf = function (st) {
    var P = Z.P, me = Z.me; if (!st || !P) return null;
    if (Z.quest && (st.t === "find" || st.t === "collect")) return { x: Z.quest.x, y: Z.quest.y, name: "Search here" };
    if (st.t === "ride") { var best = null, bd = 1e9; (Z.cars || []).forEach(function (c) { if (c.type !== st.veh || c.intro || c.job) return; var d = Math.hypot(c.x - me.x, c.y - me.y); if (d < bd) { bd = d; best = c; } });
      if (best) return { x: best.x, y: best.y, name: (S.VEH[st.veh] && S.VEH[st.veh].name) || st.veh }; var rp = placeOf(st.at || { plane: "strip", keke: "gate", car: "club", sport: "club" }[st.veh] || "gate"); return rp ? { x: rp.mx, y: rp.my, name: rp.name } : null; }
    if ((st.t === "talk" || st.t === "care" || st.t === "chase" || st.t === "tail") && st.npc && st.npc.charAt(0) === "@") { var tn = npcOf(st.npc); if (tn) return { x: tn.x, y: tn.y, name: tn.def.name }; }
    if (st.t === "class" && !st.place && !st.at) { var nx = null; try { nx = Z.life && Z.life.next && Z.life.next(); } catch (e) {} var cp = placeOf((nx && nx.place) || "@dept"); return cp ? { x: cp.mx, y: cp.my, name: cp.name } : null; }
    return undefined; // the engine's own rule (place, at, npc)
  };
  if (Z.target && !Z.target._story) { var otg = Z.target; Z.target = function () { if (!Z.race && !(Z.P && Z.P.job) && !(Z.date && Z.date.spot)) { var tg = ST.targetOf(Z.step && Z.step()); if (tg !== undefined) return tg || otg.apply(this, arguments); } return otg.apply(this, arguments); }; Z.target._story = 1; }
  /* ---------- the roommate: exactly one person lives in your room, the one you chose (or fate chose) ---------- */
  ST.roomie = function () { return Z.P ? ST.tok(Z.P, "@roomie") : ""; };
  ST.roomieName = function () { var d = npcDef(ST.roomie()); return d ? d.name : ""; };
  ST.applyRoomie = function (P) {
    if (!P) return; var id = ST.tok(P, "@roomie");
    D.NPCS.forEach(function (n) {
      if (n._homeAt === undefined) n._homeAt = n.at; // where the data put them
      var want = n.id === id ? "@home" : n._homeAt === "@home" || n._homeAt === "@hostel" ? (n.awayAt || (n.id === "sadiq" ? "dept_elect" : "selfie")) : n._homeAt;
      if (n.at !== want) { n.at = want; var e = Z.npc && Z.npc(n.id), pl = e && Z.place(want); if (e && pl && !e.follow && !e.lead) { var f = S.push(Z.W, pl.mx + 2, pl.my + 2, .6); e.x = e.hx = f.x; e.y = e.hy = f.y; } }
    });
  };
  // places named by token (@dept, @hostel…) resolve for everyone, and an unknown id never crashes a caller
  if (Z.place && !Z.place._story) { var op = Z.place; Z.place = function (id) { var v = op(ST.tok(Z.P, id)); if (!v && typeof id === "string" && id.charAt(0) === "@") v = op(id === "@dept" ? "ee" : "@home"); return v; }; Z.place._story = 1; }
  // save migration: old saves get the story block on first touch (story() fills every field)
  // Year 1 was rewritten (revision 4). A save from before it that is still inside Year 1 restarts its current mission from the
  // top (same number, same place in the story) and is paid for the steps it had done; saves past m36 carry on untouched.
  // Story saves are versioned (MASTER_GAME_GUIDE §4.5). Version 1: story block before the Year 1 rewrite; 2: Year 1 revision 4.
  // Version 3: script choices and [switch] beats were slotted into missions (overlays), so a save that is part-way through
  // one of those missions has its step index moved past the new steps in front of it.
  ST.SAVE_VERSION = 3;
  ST.MIGRATIONS = { 1: function (p) { return ST.migrateY1(p); }, 2: function (p) { ST.migrateOverlay(p); return null; } };
  ST.shiftIndex = function (m, old) { var k = old; if (!m) return k; for (var i = 0; i < m.steps.length && i <= k; i++) if (m.steps[i].ov) k++; return Math.min(k, m.steps.length - 1); };
  ST.migrateOverlay = function (p) {
    var a = p.m && p.m.active, m = null; D.MISSIONS.forEach(function (q) { if (q.id === a) m = q; }); if (m && p.m.step > 0) p.m.step = ST.shiftIndex(m, p.m.step);
    var sd = story(p).side; if (sd && sd.step > 0) sd.step = ST.shiftIndex(ST.sideDef(sd.id), sd.step);
  };
  ST.migrate = function (p, fresh) { var s = story(p), out = null; if (fresh) { s.ver = ST.SAVE_VERSION; s.y1v = 4; return null; } var v = s.ver || (s.y1v === 4 ? 2 : 1); while (v < ST.SAVE_VERSION) { var r = ST.MIGRATIONS[v] ? ST.MIGRATIONS[v](p) : null; out = out || r; v++; } s.ver = ST.SAVE_VERSION; return out; };
  ST.migrateY1 = function (p) {
    var s = story(p); if (s.y1v === 4) return null; s.y1v = 4; if (!ST.oldY1) return null;
    var a = p.m && p.m.active, n = num(a); if (!a || n < 1 || n > 36 || !p.m.step) return null;
    var steps = p.m.step; p.m.step = 0; p.m.n = 0; p.money += 300 * steps; S.addXp(p, 120 * steps);
    return { mission: a, steps: steps };
  };
  // People who share a home spot stand on a ring round it, at least 2 m apart, so they never walk back
  // and forth through each other on the way "home" (the soak test's invariant).
  ST.spaceHomes = function () {
    var groups = {}; (Z.npcs || []).forEach(function (n) { if (!n.def || n.temp || n.follow || n.lead) return; var pl = Z.place(n.def.at); if (!pl) return; (groups[pl.id] = groups[pl.id] || { pl: pl, list: [] }).list.push(n); });
    Object.keys(groups).forEach(function (k) { var g = groups[k]; if (g.list.length < 2) return; g.list.sort(function (a, b) { return a.k - b.k; });
      g.list.forEach(function (n, i) { var ring = Math.floor(i / 6), j = i % 6, ang = j / 6 * TAU + ring * .5 + S.hash(g.pl.mx | 0, 3), r = 3.2 + ring * 2.4, f = S.push(Z.W, g.pl.mx + Math.cos(ang) * r, g.pl.my + Math.sin(ang) * r, .6);
        for (var t = 0; t < 8 && g.list.slice(0, i).some(function (o) { return Math.hypot(o.hx - f.x, o.hy - f.y) < 2; }); t++) f = S.push(Z.W, g.pl.mx + Math.cos(ang + t * .7) * (r + t * .6), g.pl.my + Math.sin(ang + t * .7) * (r + t * .6), .6);
        var moved = Math.hypot(n.x - n.hx, n.y - n.hy) < 1.5; n.hx = f.x; n.hy = f.y; if (moved) { n.x = f.x; n.y = f.y; } }); });
  };
  if (Z.begin && !Z.begin._story) { var ob = Z.begin; Z.begin = function (p, fresh) { ST.ctx = {}; /* a loaded game rebuilds step state (collect items, tails) from the save */ story(p); var mg = ST.migrate(p, fresh); if (!fresh && !story(p).roomie && p.m && p.m.done && p.m.done.m1) story(p).roomie = sex(p) === "f" ? (has("firdausi") ? "firdausi" : "fatima") : "sadiq"; ST.applyRoomie(p); var out = ob.apply(this, arguments); try { ST.spaceHomes(); } catch (e) {} if (mg) { try { Z.toast("<b>Year 1 has been rewritten.</b> " + mg.mission.toUpperCase() + " starts again from the top; you keep ₦" + (300 * mg.steps) + " and " + (120 * mg.steps) + " XP for what you had done."); if (Z.stepStart) Z.stepStart(); } catch (e) {} } return out; }; Z.begin._story = 1; }
})();
