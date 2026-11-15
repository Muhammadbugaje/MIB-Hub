/* Impulse Arena — career: the Circuit (10 chapters × 10 rungs, then endless prestige), survival, time attack,
   combo trials, fighter levels, costumes, titles and unlocks. Pure functions (UMD) so the Node tests can run them. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./clashdata.js"));
  else root.ClashCareer = factory(root.ClashData);
})(typeof self !== "undefined" ? self : this, function (D) {
  "use strict";
  var VERSION = 2;

  /* ---------- who you start with, and what each chapter unlocks ---------- */
  var STARTERS = ["newton", "tesla", "einstein", "curie", "faraday", "bohr", "groove", "kai", "volta", "ohm", "ampere", "galileo"];
  // The story: a term of the inter-faculty Impulse Circuit. Static Sule, a cocky 300-level student, turns up in every chapter.
  var CHAPTERS = [
    { n: 1, name: "Freshers' Bout", boss: "inertia", unlock: "maxwell", blurb: "Your first night in the Circuit. Professor Inertia guards the door and does not like to move." },
    { n: 2, name: "Lab Week", boss: "overload", unlock: "kepler", blurb: "Every socket in the lab is full. Baron Overload says that is fine. It is not fine." },
    { n: 3, name: "Night of the Coils", boss: "inertia", unlock: "hertz", blurb: "The coil hall hums after dark. Inertia is back, heavier and grumpier." },
    { n: 4, name: "The Foundry", boss: "overload", unlock: "archimedes", blurb: "Hot metal, loud fans and a Baron who refuses to let the fuse blow." },
    { n: 5, name: "Clock Tower", boss: "entropy", unlock: "alhazen", blurb: "Count Entropy has scrambled the clock tower. Beat him and the bosses become playable." },
    { n: 6, name: "Observatory Nights", boss: "inertia", unlock: "hypatia", blurb: "Star charts, cold air and an old professor who never changes velocity." },
    { n: 7, name: "The Accelerator", boss: "overload", unlock: "lovelace", blurb: "Particles go round at nearly light speed; the Baron wants more power anyway." },
    { n: 8, name: "Exam Season", boss: "entropy", unlock: "noether", blurb: "Nobody has slept. Entropy loves it." },
    { n: 9, name: "Rival's Revenge", boss: "static", unlock: "static", blurb: "Static Sule has been training all term. This time he is the boss." },
    { n: 10, name: "Order and Disorder", boss: "entropy", unlock: "overload", blurb: "The final night of the Circuit. Win it and the whole roster is yours." }
  ];
  var BOSS_UNLOCK_CHAPTER = 5; // beating chapter 5 makes Inertia and Entropy playable (the old "tower champion" reward)

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function pick(list, seed) { return list[seed % list.length]; }

  /* ---------- the Circuit ----------
     Chapter c (0-based, endless): 10 rungs. Rungs 1–4 and 6–7 regular fights, 5 the rival Static Sule, 8 a "spotlight" fight
     against that chapter's featured scientist, 9 a mirror match, 10 the chapter boss. Global rung g = 10c + n (1…100, then
     prestige). The CPU gets sharper every rung; in prestige rounds it also takes less damage. */
  function skillFor(g, kind) {
    var base = 0.12 + 0.8 * Math.min(1, (g - 1) / 99);
    if (kind === "boss") base += 0.05; else if (kind === "rival") base += 0.03;
    return Math.round(clamp(base, 0.1, 0.97) * 1000) / 1000;
  }
  function prestigeOf(c) { return Math.floor(c / CHAPTERS.length); }
  function cpuTake(c) { var p = prestigeOf(c); return p ? Math.max(0.55, 1 / (1 + 0.15 * p)) : 1; } // prestige: CPU shrugs off more
  function circuit(c, player) {
    var ch = CHAPTERS[c % CHAPTERS.length], p = prestigeOf(c), pool = D.ORDER.filter(function (id) { return id !== player && id !== "static"; }), rungs = [];
    var seed = hash(player + ":" + c);
    for (var n = 1; n <= 10; n++) {
      var g = c * 10 + n, r = { chapter: c, n: n, g: g, prestige: p, kind: "fight" };
      if (n === 10) { r.opp = ch.boss === player ? "entropy" : ch.boss; r.kind = "boss"; }
      else if (n === 5) { r.opp = player === "static" ? "overload" : "static"; r.kind = "rival"; }
      else if (n === 9) { r.opp = player; r.mirror = true; r.kind = "mirror"; }
      else if (n === 8 && ch.unlock !== player && D.FIGHTERS[ch.unlock] && !D.FIGHTERS[ch.unlock].boss) { r.opp = ch.unlock; r.kind = "spotlight"; }
      else r.opp = pick(pool, seed + n * 7919);
      r.skill = skillFor(Math.min(g, 100) + p * 3, r.kind === "boss" ? "boss" : r.kind === "rival" ? "rival" : "");
      r.cpuTake = cpuTake(c);
      r.arena = r.kind === "boss" ? (r.opp === "entropy" ? "clock" : D.FIGHTERS[r.opp].arena) : r.mirror ? "accel" : D.FIGHTERS[r.opp].arena;
      r.rounds = r.kind === "boss" && c >= 4 ? 3 : 2;
      rungs.push(r);
    }
    return rungs;
  }
  function rungAt(g, player) { var c = Math.floor((g - 1) / 10); return circuit(c, player)[(g - 1) % 10]; }
  function chapterName(c) { var ch = CHAPTERS[c % CHAPTERS.length], p = prestigeOf(c); return (p ? "Prestige " + p + " · " : "") + "Chapter " + ch.n + ": " + ch.name; }

  /* ---------- survival and time attack ---------- */
  function survivalOpp(k, player, seed) { // k = 1, 2, 3 … one round each, health carries over
    var pool = D.ORDER.filter(function (id) { return id !== player; }), boss = k % 5 === 0;
    var opp = boss ? pick(D.BOSSES.filter(function (b) { return b !== player; }), hash("s" + seed + k)) : pick(pool, hash(seed + ":" + k));
    return { k: k, opp: opp, boss: boss, skill: Math.round(clamp(0.28 + 0.035 * k + (boss ? 0.05 : 0), 0.2, 0.96) * 1000) / 1000,
      arena: D.FIGHTERS[opp].arena, heal: 30, cpuTake: k > 20 ? Math.max(0.6, 1 - 0.02 * (k - 20)) : 1 };
  }
  var TA_COUNT = 8;
  function timeAttack(player, seed) {
    var pool = D.ORDER.filter(function (id) { return id !== player; }), out = [], h = hash("ta" + player + (seed || 0));
    for (var i = 0; i < TA_COUNT; i++) out.push({ i: i + 1, opp: i === TA_COUNT - 1 ? "entropy" : pool[(h + i * 104729) % pool.length], skill: Math.round((0.4 + i * 0.05) * 1000) / 1000 });
    out.forEach(function (o) { o.arena = D.FIGHTERS[o.opp].arena; });
    return out;
  }

  /* ---------- combo trials: six per fighter, built from the engine's real chains and each fighter's own specials ---------- */
  function firstSpec(id, kinds) { var l = D.SPECIALS[id] || []; for (var i = 0; i < l.length; i++) if (kinds.indexOf(l[i].kind) >= 0 && Array.isArray(l[i].in)) return l[i]; return null; }
  function trialsFor(id) {
    var follow = firstSpec(id, ["rush", "strike", "proj", "beam"]), rise = firstSpec(id, ["rise"]), sup = D.SUPERS[id], out = [];
    out.push({ id: "t1", name: "Lab Jab", steps: ["hp", "hp", "lp"], hint: "HP, HP, LP — press the next button as each hit lands." });
    out.push({ id: "t2", name: "Low to high", steps: ["lk", "hk"], hint: "LK then HK: low, then high." });
    out.push({ id: "t3", name: "Tri-Strike", steps: ["lp", "hp", "hk"], hint: "LP, HP, HK in one string." });
    if (follow) out.push({ id: "t4", name: "Cancel into " + follow.name, steps: ["lp", "lp", "hp", follow.id], hint: "LP, LP, HP, then " + D.seqString(follow.in) + " while the HP connects." });
    if (rise) out.push({ id: "t5", name: "Launch and " + rise.name, steps: ["upper", rise.id], hint: "↓ + HP launches; cancel it into " + D.seqString(rise.in) + "." });
    if (sup) out.push({ id: "t6", name: "Finish with " + sup.name, steps: ["hk", "lk", "super"], hint: "HK, LK, then the super (↓→↓→ + HK, or ★ + block). Meter is full in trials." });
    return out;
  }
  // Does a run of landed hits (move/special ids in combo order, starting at hit 1) complete a trial? Returns progress 0…n.
  function trialProgress(trial, hits) { var k = 0; for (var i = 0; i < hits.length && k < trial.steps.length; i++) { if (hits[i] === trial.steps[k]) k++; else return k; } return k; }

  /* ---------- levels, costumes and titles ---------- */
  var MAX_LEVEL = 50;
  function level(xp) { return Math.min(MAX_LEVEL, 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 80))); }
  function xpForLevel(l) { return 80 * (l - 1) * (l - 1); }
  var COSTUMES = [{ lvl: 1, name: "Classic" }, { lvl: 5, name: "Lab coat", coat: "#e5e7eb" }, { lvl: 12, name: "Night shift", coat: "#1e293b" },
    { lvl: 20, name: "Harmattan", coat: "#b45309" }, { lvl: 30, name: "Shadow", coat: "#111318", eye: "#ff3355" }, { lvl: 50, name: "Gold", coat: "#d4a017" }];
  function costumes(p, id) { var l = level((p.xp || {})[id] || 0); return COSTUMES.map(function (c, i) { return { i: i, name: c.name, lvl: c.lvl, open: l >= c.lvl }; }); }
  function dress(look, idx) { var c = COSTUMES[idx | 0]; if (!c || !idx) return look; var o = Object.assign({}, look); if (c.coat) o.coat = c.coat; if (c.eye) o.eye = c.eye; return o; }
  var TITLES = [
    { id: "fresher", name: "Fresher Fighter", test: function () { return true; } },
    { id: "regular", name: "Lab Regular", test: function (p) { return p.chapters >= 3; } },
    { id: "breaker", name: "Tower Breaker", test: function (p) { return p.chapters >= 5; } },
    { id: "legend", name: "Circuit Legend", test: function (p) { return p.chapters >= 10; } },
    { id: "prestige", name: "Prestige Fighter", test: function (p) { return p.chapters >= 20; } },
    { id: "survivor", name: "Survivor", test: function (p) { return (p.survival || 0) >= 10; } },
    { id: "iron", name: "Iron Scientist", test: function (p) { return (p.survival || 0) >= 25; } },
    { id: "speed", name: "Speed of Light", test: function (p) { return Object.keys(p.ta || {}).some(function (k) { return p.ta[k] <= 300; }); } },
    { id: "scholar", name: "Combo Scholar", test: function (p) { return trialsDone(p) >= 20; } },
    { id: "professor", name: "Combo Professor", test: function (p) { return trialsDone(p) >= 80; } },
    { id: "polymath", name: "Polymath", test: function (p) { return Object.keys(p.xp || {}).filter(function (k) { return level(p.xp[k]) >= 10; }).length >= 10; } },
    { id: "veteran", name: "Veteran", test: function (p) { return (p.wins || 0) >= 200; } },
    { id: "centurion", name: "Centurion", test: function (p) { return (p.best || 0) >= 100; } }
  ];
  function trialsDone(p) { var n = 0, t = p.trials || {}; Object.keys(t).forEach(function (k) { n += (t[k] || []).length; }); return n; }
  function titles(p) { return TITLES.filter(function (t) { return t.test(p); }).map(function (t) { return t.id; }); }
  function titleName(id) { for (var i = 0; i < TITLES.length; i++) if (TITLES[i].id === id) return TITLES[i].name; return TITLES[0].name; }

  /* ---------- the saved profile ---------- */
  function fresh() { return { v: VERSION, char: "newton", g: 1, best: 0, chapters: 0, xp: {}, wins: 0, losses: 0, unlocked: {}, costume: {}, title: "fresher", survival: 0, ta: {}, trials: {}, settings: {} }; }
  // Old saves: clash-tower {char, rung, best, done} and clash-champ (true after beating the old 10-rung tower).
  function migrate(saved, oldTower, oldChamp) {
    var p = Object.assign(fresh(), saved && typeof saved === "object" ? saved : {});
    ["xp", "unlocked", "costume", "ta", "trials", "settings"].forEach(function (k) { if (!p[k] || typeof p[k] !== "object") p[k] = {}; });
    if (!saved || !saved.v) {
      if (oldTower && oldTower.char && D.FIGHTERS[oldTower.char]) { p.char = oldTower.char; p.g = clamp(oldTower.rung | 0 || 1, 1, 10); p.best = clamp(oldTower.best | 0, 0, 10); }
      if (oldChamp) { p.chapters = Math.max(p.chapters, 1); p.best = Math.max(p.best, 10); p.g = Math.max(p.g, 11); p.unlocked.maxwell = 1; p.unlocked.inertia = 1; p.unlocked.entropy = 1; }
    }
    if (!D.FIGHTERS[p.char]) p.char = "newton";
    p.g = Math.max(1, p.g | 0); p.v = VERSION;
    return p;
  }
  function isUnlocked(p, id) {
    if (STARTERS.indexOf(id) >= 0) return true;
    if (p.unlocked && p.unlocked[id]) return true;
    if ((id === "inertia" || id === "entropy") && p.chapters >= BOSS_UNLOCK_CHAPTER) return true;
    return false;
  }
  function howToUnlock(id) {
    for (var i = 0; i < CHAPTERS.length; i++) if (CHAPTERS[i].unlock === id) return "clear Circuit chapter " + CHAPTERS[i].n;
    if (id === "inertia" || id === "entropy") return "clear Circuit chapter " + BOSS_UNLOCK_CHAPTER;
    return "keep playing";
  }
  // Record a finished match. info: {mode, char, won, draw, perfect, finisher, combo, rung (circuit g), streak (survival), seconds (time attack)}
  function record(p, info) {
    var before = titles(p), out = { xp: 0, levelUp: null, unlocks: [], titles: [], chapterCleared: null };
    var id = info.char, x = info.won ? 100 : info.draw ? 50 : 35;
    if (info.mode === "circuit" && info.won) x += Math.min(150, (info.rung || 1) * 2);
    if (info.mode === "survival") x = info.won ? 60 + Math.min(90, (info.streak || 0) * 3) : 25;
    if (info.mode === "trial") x = info.firstTime ? 80 : 0;
    if (info.mode === "duo" || info.mode === "training") x = info.mode === "duo" ? 30 : 0;
    if (info.perfect) x += 50; if (info.finisher) x += 40; if ((info.combo || 0) >= 5) x += 20;
    var l0 = level(p.xp[id] || 0); p.xp[id] = (p.xp[id] || 0) + x; out.xp = x; var l1 = level(p.xp[id]); if (l1 > l0) out.levelUp = l1;
    if (info.mode !== "duo" && info.mode !== "training" && info.mode !== "trial") { if (info.won) p.wins++; else if (!info.draw) p.losses++; }
    if (info.mode === "circuit" && info.won) {
      var g = info.rung; p.best = Math.max(p.best, g); p.g = Math.max(p.g, g + 1);
      if (g % 10 === 0) {
        var c = g / 10 - 1, ch = CHAPTERS[c % CHAPTERS.length]; p.chapters = Math.max(p.chapters, c + 1); out.chapterCleared = c;
        if (!isUnlocked(p, ch.unlock)) { p.unlocked[ch.unlock] = 1; out.unlocks.push(ch.unlock); }
        if (c + 1 === BOSS_UNLOCK_CHAPTER) ["inertia", "entropy"].forEach(function (b) { if (!p.unlocked[b]) { p.unlocked[b] = 1; out.unlocks.push(b); } });
      }
    }
    if (info.mode === "survival") p.survival = Math.max(p.survival || 0, info.streak || 0);
    if (info.mode === "timeattack" && info.won && info.seconds > 0) p.ta[id] = p.ta[id] ? Math.min(p.ta[id], info.seconds) : info.seconds;
    var after = titles(p); out.titles = after.filter(function (t) { return before.indexOf(t) < 0; });
    return out;
  }
  // What the server is told: the Circuit rung (capped at 100 — prestige keeps reporting 100), else stage 1.
  function reportStage(info) { return info.mode === "circuit" ? clamp(info.rung | 0, 1, 100) : 1; }

  return { VERSION: VERSION, STARTERS: STARTERS, CHAPTERS: CHAPTERS, BOSS_UNLOCK_CHAPTER: BOSS_UNLOCK_CHAPTER, circuit: circuit, rungAt: rungAt, chapterName: chapterName,
    skillFor: skillFor, prestigeOf: prestigeOf, cpuTake: cpuTake, survivalOpp: survivalOpp, timeAttack: timeAttack, TA_COUNT: TA_COUNT, trialsFor: trialsFor,
    trialProgress: trialProgress, level: level, xpForLevel: xpForLevel, MAX_LEVEL: MAX_LEVEL, COSTUMES: COSTUMES, costumes: costumes, dress: dress, TITLES: TITLES,
    titles: titles, titleName: titleName, trialsDone: trialsDone, fresh: fresh, migrate: migrate, isUnlocked: isUnlocked, howToUnlock: howToUnlock, record: record, reportStage: reportStage };
});
