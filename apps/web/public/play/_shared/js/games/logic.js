/* Logic Labyrinth: a puzzle-platformer where doors, bridges, lasers and lifts obey digital logic (EEEN 307 at 300 level,
 * EEEN 405 at 400 level). The logic is evaluated by logicsim.js; each academic level's chapter is its own file
 * (logic-300.js, logic-400.js) and the server only sends the chapters the student's level opens.
 * Screen: HUD (y 0-42), wall schematic + live readout (y 46-290), platform room (y 296-540). */
(function () {
  "use strict";
  var A = window.Arcade, LS = window.LogicSim, LEVELS = LS.LEVELS, X = LS.X;
  var stage = document.querySelector("[data-gm-stage]"), locked = [];
  try { locked = JSON.parse(stage.getAttribute("data-gm-locked") || "[]"); } catch (e) {}
  var save = Object.assign({ stars: {}, who: "tesla", seen: {}, tut: false, tutSock: false }, A.store("logic") || {});
  function persist() { A.store("logic", save); }
  var FLOOR = 500, TOP = 296, LEDGE = 400, EXIT_X = 912, HW = 12, HH = 46;
  var COL = { on: "#3dd68c", off: "#4d687e", x: "#ff6b6b", ink: "#dfe7ee", dim: "#8fa3b3", gold: "#f6c445", cyan: "#7ef0ff", pink: "#ff6b9a" };
  var TILE_COL = ["#7ef0ff", "#f6c445", "#ff6b9a", "#a78bfa", "#3dd68c", "#ff9f43", "#9ad0ff"];
  var NAME = { door: "DOOR", scan: "SCANNER", laser: "LASER", bridge: "BRIDGE", steps: "LIFT" };
  var TAUNT = {
    300: "Welcome to my labyrinth, little engineer. Every door in here obeys logic, and I have scrambled all of it. Ones, zeros… mine!",
    400: "Gates? Child's play. Down here my circuits have MEMORY. My clocks tick, my flip-flops remember, and they remember to keep you out.",
    beat300: "Bah! XOR out of NAND gates… Lucky. You will never survive my clocks.",
    beat400: "Impossible! My tower counts both ways and still you… Order restored. For now. Entropy always comes back!",
    boss: ["Tick, tock… wrong way!", "Disorder always wins!", "Ones and zeros, all mine!", "Try counting backwards!", "Your gates are leaking!"]
  };
  var S = { L: null, hits: [] };

  /* ---------- helpers ---------- */
  function esc(s) { return A.esc(s); }
  function first(i) { return i === 0 || LEVELS[i - 1].level !== LEVELS[i].level; }
  function last(i) { return i === LEVELS.length - 1 || LEVELS[i + 1].level !== LEVELS[i].level; }
  function hero() { return A.styled(A.byId[save.who] || A.CAST[0]); }
  function note(t, life) { S.note = { t: t, life: life || 3.5 }; }
  function inputs() { return Object.assign({}, S.lev, S.seq ? S.seq.st : {}); }
  function starsFor(g, moves, hints) { var L = S.L, s = 3; if (g > L.best) s--; if (moves > L.par + 2) s--; if (hints >= 3) s = 1; return Math.max(1, s); }
  function lit(s) { return s === "" ? "?" : s[0] === "!" ? s.slice(1) + "'" : s; }
  function optLabel(o) { return o === "" ? "empty" : o === "WIRE" ? "wire" : o === "J" ? "jumper" : o[0] === "!" ? "not " + o.slice(1) : o; }
  function maxCode(L) { var m = 1; L.seq.runs.forEach(function (r) { r.states.forEach(function (s) { m = Math.max(m, s); }); }); return m; }

  /* ---------- level flow ---------- */
  function buildRoom(L) {
    var R = { levers: [], obs: [], pits: [], ledge: null, exitY: FLOOR }, pl = (L.levers || []).filter(function (l) { return !l.auto; });
    pl.forEach(function (l, k) { R.levers.push({ id: l.id, label: l.id, x: 84 + k * 62, ang: 0 }); });
    var cx = Math.max(430, 84 + pl.length * 62 + 30);
    L.obs.forEach(function (o, k) {
      var ob = { k: o.k, i: k, sig: o.sig, need: o.need, open: 0 };
      if (o.k === "bridge") { ob.x = cx + 10; ob.w = 150; R.pits.push([ob.x, ob.x + 150]); cx += 190; }
      else if (o.k === "steps") { ob.x = 600; ob.w = 84; ob.h = 0; R.ledge = 684; R.exitY = LEDGE; }
      else { ob.x = cx + 34; cx += 100; }
      R.obs.push(ob);
    });
    return R;
  }
  function today() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function unlocked(api, i) { return first(i) || !!save.all || !!(api && api.hero && api.hero.active) || (save.stars[LEVELS[i - 1].name] || 0) > 0 || (save.stars[LEVELS[i].name] || 0) > 0; }
  function start(api, i, Ld) { try { if (window.MIBPlay) MIBPlay.level(i + 1); } catch (mibErr) {} /* MIB-Hub: play tracking */
    if (!Ld && !unlocked(api, i)) { api.sound.sfx("block"); note("Clear the room before it first.", 3); return; }
    var L = Ld || LEVELS[i]; S.daily = !!Ld; S.i = Ld ? -1 : i; S.L = L; S.a = LS.blank(L); S.lev = LS.leverStart(L); S.socks = LS.sockets(L);
    S.sel = S.socks.length ? 0 : -1; S.pop = false; S.moves = 0; S.lastEdit = null; S.hints = 0; S.won = false; S.clearT = 0; S.shown = false;
    S.note = null; S.walkTo = null; S.flipAfter = null; S.taunt = null; S.tauntIn = 6; S.ok = false; S.falls = 0;
    S.room = buildRoom(L); S.h = { x: 34, y: FLOOR, vx: 0, vy: 0, ground: true, face: 1, stun: 0, walk: 0, on: null };
    if (L.mode === "seq") { var st = {}; L.seq.ffs.forEach(function (q) { st[q] = 0; }); S.seq = { st: st, t: 0, hist: [0], bad: false, flipIn: 4, max: maxCode(L), pulse: 0 }; } else S.seq = null;
    refresh(api, true);
    api.music(A.song(L.song[0], L.song[1], { bpm: L.song[1] === "calm" ? 92 : L.song[1] === "boss" ? 138 : undefined }));
    api.useActions(S.socks.length ? ["left", "right", "sock", "gate", "use", "jump"] : ["left", "right", "use", "jump"]);
    if (!Ld && first(i) && !save.seen[L.level] && !save.skipTaunts) entropySays(api, TAUNT[L.level] || TAUNT[300], "Chapter: " + L.course, function () { save.seen[L.level] = true; persist(); intro(api); });
    else intro(api);
  }
  function intro(api) {
    var L = S.L, how = L.kmap ? "Tap a term to switch it on or off (or press N to pick one and G to toggle). Your terms build the circuit." :
      S.socks.length ? "Tap a dashed socket (or press N) to pick it, then choose a gate from the pop-up (tap it, press 1–9, or G / ⟳ to cycle)." :
      "Walk to a lever and press E (●) to flip it. Analyse first: every flip counts as a move.";
    api.show("<h2>" + (S.daily ? "" : (S.i + 1) + ". ") + esc(L.name) + "</h2><p style='font-size:13px;opacity:.8'>" + esc(L.course) + " · " + L.level + " level · " + esc(L.concept) + "</p><p>" + esc(L.intro) + "</p><p style='font-size:13px;opacity:.85'>" + how +
      (L.mode === "table" ? " Flip the levers to test rows; the scanner checks every row." : "") + " Best: " + L.best + " gate" + (L.best === 1 ? "" : "s") + ", " + L.par + " move" + (L.par === 1 ? "" : "s") + ".</p>" +
      "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='go'>Enter the room</button><button class='gm-btn' data-act='map'>Level map</button></div>",
      function (a) { if (a === "map") map(api); else api.hide(); });
  }
  function entropySays(api, text, title, done) {
    api.show("<div style='display:flex;gap:14px;align-items:center;text-align:left'><canvas width='120' height='120' data-entropy style='width:96px;height:96px;flex:none'></canvas><div><h2 style='margin:0 0 6px'>Count Entropy</h2><p style='font-size:13px;opacity:.75;margin:0'>" + esc(title) + "</p></div></div><p style='font-style:italic'>“" + esc(text) + "”</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='ok'>Bring it on</button></div>",
      function () { done(); });
    var c = document.querySelector("[data-entropy]"); if (c) A.drawHead(c.getContext("2d"), A.VILLAIN, 60, 66, 40, 1, { mood: "fight" });
  }
  function refresh(api, silent) {
    var L = S.L; S.res = LS.check(L, S.a, S.lev); S.v = LS.evaluate(L, S.a, inputs());
    var ok = S.res.ok;
    if (!silent && ok && !S.ok) {
      var ob = S.room.obs[S.room.obs.length - 1];
      api.sound.sfx("power"); api.buzz(30); api.kick(4); api.burst(ob ? ob.x : 700, 400, COL.on, 26, 260);
      api.banner(L.mode === "levers" ? "OPEN!" : L.mode === "seq" ? "IN SYNC!" : "SCAN OK!", { size: 70, y: 400, col: "#9ffcd0", edge: "#0b5a3a", dur: 1.4 });
      if (L.mode !== "levers" && !save.tutSock) { save.tutSock = true; persist(); }
    } else if (!silent && !ok && S.ok) api.sound.sfx("block");
    S.ok = ok;
  }
  function edit(api, id, val) {
    if (S.won) return;
    var n = LS.node(S.L, id), old = S.a[id]; if (old === val) return;
    var a2 = Object.assign({}, S.a); a2[id] = val;
    if (!LS.fits(S.L, a2)) { note("No " + optLabel(val) + " gates left in the box."); api.sound.sfx("block"); return; }
    S.a = a2; if (S.lastEdit !== id) { S.moves++; S.lastEdit = id; }
    api.sound.sfx(n.k === "tile" ? "coin" : "click"); api.buzz(8);
    if (S.seq) { S.L.seq.ffs.forEach(function (q) { S.seq.st[q] = 0; }); S.seq.hist = [0]; S.seq.t = 0; S.seq.bad = false; }
    refresh(api);
  }
  function cycle(api, dir) {
    if (S.sel < 0) return; var n = S.socks[S.sel], o = LS.options(S.L, n), k = o.indexOf(S.a[n.id]);
    for (var j = 1; j <= o.length; j++) {
      var v = o[(k + dir * j + o.length * 2) % o.length], a2 = Object.assign({}, S.a); a2[n.id] = v;
      if (LS.fits(S.L, a2)) { edit(api, n.id, v); return; }
    }
  }
  function flip(api, id) {
    if (S.won) return; var l = (S.L.levers || []).filter(function (q) { return q.id === id; })[0]; if (!l || l.auto) return;
    S.lev[id] ^= 1; if (S.L.mode === "levers") S.moves++; S.lastEdit = null; api.sound.sfx("stomp"); api.buzz(12);
    if (!save.tut) S.tutFlipped = true; refresh(api);
  }
  /* cheats and the maker's hidden character: only hashes of the codes are shipped */
  var CH = /*CH[*/{"skip":["f7ca7b5e031856efe4f63a0512ce0099a52bd9ad6200c8fc51ea007abb4b01cd","aa90d153d17cfeea2ef1d6d2749ba2ff97de21e7cdee9efcdaabc8371aea28ea"],"solve":["17f858cd2a995832c083f8a2dd38f4cf9a764e980dd280978ffd299a58de1db0","eb2054bef36c585dcabb7775471dc9181dc6c3f754f0c1375eee21503a37d3d7"],"moves":["e3c8e77f9e06f3703ef2f17bcbbf84a083687ac51f0e414ac9a6b076337f7b73","effc3e47ccea45e069bff70ca837a0a128de6014eefe2f17154f75d718336d45"],"stars":["27b25ff1c145d4f0f8694aa81bcef745b592b3262435f92d9907dce9719b9cc3","07e5715c8ed0b9311fce563355d586f02b7a3b62149ec7f38d757e849f2c3fb7"],"last":["f296b11fedd5749cfe2993da79874976cabde82470065ea47bfdf7fb811b603c","af98f98d492bebbab284063f80092dc05989398b750d1ceaa84a7c9392f83acc"],"slow":["a2b893eb549e1bbc426215270a35359251548242977da6b1755edd470d73cf2d","8eed1b0b88e553f21a429ffacfb8dcc0c1c1fcc48fc5403ade58ff112f2965de"],"party":["3342977648ce159ef27c05c7d671ccbbce76522b20300db08c4d1538dad97468","a8949a65cf10f72ed96a48192ce134564da4266f8c4b4d2bfb393503921927b0"],"_combo":"49d49dd644eba3f8f857f0d43a484e9e9452c5db125c70914e91d67af6e31769","_swipe":"272f99a8081bf34c1ff30c4623a95a9ce11601bb2dcf5d9d0f4daaa742b5e6f2"}/*]CH*/, CT = {};
  function solveNow() { // the solver's own answer: fewest gates
    var r = LS.solve(S.L); if (!r || !r.sol) return false;
    S.a = Object.assign({}, r.sol.a); if (r.sol.lev != null) S.lev = r.sol.lev; S.res = LS.check(S.L, S.a, S.lev); S.v = LS.evaluate(S.L, S.a, inputs()); return true;
  }
  function setupCheats(api) {
    api.cheats({
      skip: { label: "Solve and finish this room", h: CH.skip, run: function () { if (S.L && !S.won && solveNow()) win(api); } },
      solve: { label: "Answer wired", h: CH.solve, run: function () { if (S.L && !S.won) solveNow(); } },
      moves: { label: "Move counter reset", h: CH.moves, run: function () { S.moves = 0; S.hints = 0; } },
      stars: { label: "Three stars for this room", h: CH.stars, run: function () { if (S.L) { save.stars[S.L.name] = 3; persist(); } } },
      last: { label: "Open every room and jump to the last", h: CH.last, run: function () { save.all = true; persist(); if (LEVELS.length) start(api, LEVELS.length - 1); } },
      slow: { label: "Slow motion", h: CH.slow, run: function () { api.slowmo(.5, 20); } },
      party: { label: "Confetti storm", h: CH.party, run: function () { api.confetti(400); api.sound.roar(false); } }
    });
    api.secret({ combo: CH._combo, swipe: CH._swipe, onReveal: function () { map(api); } });
  }
  function hint(api) {
    var L = S.L, n = Math.max(1, S.hints), list = L.hints.slice(0, n);
    if (!S.hints) S.hints = 1;
    api.show("<h2>Hints · " + esc(L.name) + "</h2>" + list.map(function (h, k) { return "<p>" + (k === 2 ? "<b>Answer:</b> " : "<b>" + (k + 1) + ".</b> ") + esc(h) + "</p>"; }).join("") +
      "<div class='gm-actions'>" + (n < 2 ? "<button class='gm-btn' data-act='more'>Another hint</button>" : n < 3 ? "<button class='gm-btn' data-act='more'>Show the answer (max 1 ★)</button>" : "") +
      "<button class='gm-btn gm-btn--go' data-act='back'>Back to the puzzle</button></div>",
      function (a) { if (a === "more") { S.hints = Math.min(3, n + 1); hint(api); } else api.hide(); });
  }
  function win(api) {
    var L = S.L, g = LS.gates(L, S.a), st = starsFor(g, S.moves, S.hints);
    S.won = true; S.clearT = 0; S.stars = st; S.gUsed = g;
    save.stars[L.name] = Math.max(save.stars[L.name] || 0, st); save.tut = true; persist();
    if (S.daily) { save.daily = save.daily || {}; save.daily[L.daily] = Math.max(save.daily[L.daily] || 0, st); persist(); }
    A.report("logic-labyrinth", { result: "win", stage: S.daily ? 1 : S.i + 1, score: st * 100 + L.level / 10 + Math.max(0, 30 - S.moves) });
    api.sound.sfx("power"); api.flash("#7ef0ff", .25);
    if (L.boss) api.sound.say("Count Entropy is beaten!");
  }
  function results(api) {
    var L = S.L, i = S.i, next = !S.daily && i + 1 < LEVELS.length, st = S.stars, g = S.gUsed, endCh = !S.daily && last(i);
    var line = endCh ? (L.level === 300 ? TAUNT.beat300 : TAUNT.beat400) : "";
    var cerDone = !S.daily && !next && !locked.length;
    api.ceremony(cerDone ? "gameComplete" : L.boss ? "win" : "stageClear", { title: cerDone ? "LABYRINTH OPEN!" : L.boss ? "BOSS BEATEN!" : "ROOM CLEAR!", sub: L.name, hero: hero(), trophy: cerDone ? "crown" : L.boss ? "medal" : "star", colors: ["#7ef0ff", "#3dd68c", "#bff8ff", "#ffffff"], stars: st, len: cerDone ? 5 : L.boss ? 3.4 : 2.6,
      score: Math.round(st * 100 + L.level / 10 + Math.max(0, 30 - S.moves)), stats: [["Gates", g + " (best " + L.best + ")"], ["Moves", S.moves + " (par " + L.par + ")"]].concat(S.hints ? [["Hints", S.hints]] : []),
      line: st === 3 ? "Fewest gates, inside par. Flawless logic." : "The door is open. Three stars need the fewest gates within par.", then: function () { api.show("<h2>" + "★".repeat(st) + "☆".repeat(3 - st) + " " + esc(L.name) + "</h2><p>Gates " + g + " (best " + L.best + ") · Moves " + S.moves + " (par " + L.par + ")" + (S.hints ? " · Hints " + S.hints : "") + "</p>" +
      "<p class='gm-formula' style='white-space:normal'>" + esc(L.explain) + "</p>" +
      (st < 3 ? "<p style='font-size:13px;opacity:.8'>" + (S.hints >= 3 ? "You revealed the answer, so this clear is worth 1 star. Try it again without." : g > L.best ? "Three stars need the fewest gates: can you save one?" : "Three stars need the job done within " + (L.par + 2) + " moves.") + "</p>" : "") +
      (endCh ? "<p><b>Count Entropy:</b> <i>“" + esc(line) + "”</i></p>" : "") +
      (cerDone ? "<p><b>Every lock in the labyrinth is open. Count Entropy's disorder is undone: that's digital logic mastered, from binary to flip-flops.</b></p>" : "") +
      (!S.daily && !next && locked.length ? "<p style='font-size:13px;opacity:.8'>The next chapter opens when your student record reaches " + locked[0].level + " level.</p>" : "") +
      "<div class='gm-actions'>" + (next ? "<button class='gm-btn gm-btn--go' data-act='next'>Next room</button>" : "") + "<button class='gm-btn' data-act='retry'>Replay</button><button class='gm-btn' data-act='map'>Level map</button></div>",
      function (a) { if (a === "next") start(api, i + 1); else if (a === "retry") { if (S.daily) start(api, -1, L); else start(api, i); } else map(api); }); } });
  }
  function map(api) {
    var byLv = {}; LEVELS.forEach(function (L, i) { (byLv[L.level] = byLv[L.level] || []).push(i); });
    var total = 0; LEVELS.forEach(function (L) { total += save.stars[L.name] || 0; }); var dd = (save.daily || {})[today()];
    var html = "<h2>Logic Labyrinth</h2><p>Count Entropy has scrambled the department's logic. Doors, bridges, lasers and lifts only answer to correct circuits. Flip levers, place gates, read the truth tables, and walk out. <b>★ " + total + " / " + LEVELS.length * 3 + "</b></p>" +
      "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='daily'>Daily room" + (dd ? " " + "★".repeat(dd) : "") + "</button></div><div style='display:grid;gap:12px;text-align:left'>";
    Object.keys(byLv).forEach(function (lv) {
      var L0 = LEVELS[byLv[lv][0]];
      html += "<div><b>" + lv + " level · " + esc(L0.course) + "</b><div class='gm-actions' style='justify-content:flex-start;margin-top:6px'>" + byLv[lv].map(function (i) {
        var L = LEVELS[i], st = save.stars[L.name] || 0, open = unlocked(api, i);
        return "<button class='gm-btn" + (st || !open ? "" : " gm-btn--go") + "' data-act='lv' data-i='" + i + "' title='" + esc(L.concept) + "'" + (open ? "" : " disabled aria-disabled='true'") + " style='min-height:44px'>" + (open ? (i + 1) + ". " + esc(L.name) + (st ? " " + "★".repeat(st) : "") : "🔒 " + (i + 1)) + "</button>"; }).join("") + "</div></div>";
    });
    locked.forEach(function (c) { html += "<div style='opacity:.6'><b>" + c.level + " level</b>: " + esc(c.name) + ". Opens when your student record reaches " + c.level + " level.</div>"; });
    var back = S.L && !S.won ? "<button class='gm-btn gm-btn--go' data-act='back'>Back to the room</button>" : "";
    api.show(html + "</div><div class='gm-actions'>" + back + "<button class='gm-btn' data-act='hero'>Change explorer</button></div>", function (a, el) {
      if (a === "lv") start(api, +el.getAttribute("data-i")); else if (a === "daily") { var D = LS.daily(today()); if (D) start(api, -1, D); } else if (a === "hero") title(api); else if (a === "back") api.hide(); });
  }
  function title(api) {
    api.show("<h2>Logic Labyrinth</h2><p>A puzzle-platformer of ones and zeros. Count Entropy has rewired every door, bridge, laser and lift in the department. Only correct logic opens them.</p>" + A.picker(api, save.who, "Choose your explorer") +
      "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='go'>Play</button></div>",
      function (a, el) {
        if (a === "pick") { save.who = el.getAttribute("data-id"); [].forEach.call(el.parentNode.children, function (b) { b.setAttribute("aria-pressed", b === el); }); persist(); }
        else if (a === "go") map(api);
      });
    A.paintFaces(document.querySelector("[data-gm-overlay]"));
  }

  /* ---------- room physics ---------- */
  function solids() {
    var R = S.room, s = [], x0 = 0;
    R.pits.slice().sort(function (p, q) { return p[0] - q[0]; }).forEach(function (p) { s.push({ x: x0, y: FLOOR, w: p[0] - x0, h: 80 }); x0 = p[1]; });
    s.push({ x: x0, y: FLOOR, w: (R.ledge || 960) - x0, h: 80 });
    if (R.ledge) s.push({ x: R.ledge, y: LEDGE, w: 960 - R.ledge, h: 200 });
    R.obs.forEach(function (ob) {
      if ((ob.k === "door" || ob.k === "scan") && ob.open < .98) s.push({ x: ob.x - 11, y: TOP, w: 22, h: (FLOOR - TOP) * (1 - ob.open), door: true });
      if (ob.k === "bridge" && ob.open > .02) s.push({ x: ob.x, y: FLOOR, w: ob.w * ob.open, h: 10 });
      if (ob.k === "steps") s.push(ob.plat = { x: ob.x, y: FLOOR - ob.h, w: ob.w, h: 12, dy: ob.dy || 0 });
    });
    return s;
  }
  function over(h, b) { return h.x + HW > b.x && h.x - HW < b.x + b.w && h.y > b.y && h.y - HH < b.y + b.h; }
  function pass(ob) {
    if (ob.k === "scan" || ob.k === "steps") return S.ok;
    return S.res.obs ? S.res.obs[ob.i] : false;
  }
  function physics(api, dt) {
    var h = S.h, R = S.room, ax = 0;
    if (h.stun > 0) { h.stun -= dt; h.vx = h.kb; }
    else {
      if (api.down("left")) { ax -= 1; S.walkTo = null; } if (api.down("right")) { ax += 1; S.walkTo = null; }
      if (S.walkTo != null) { var d = S.walkTo - h.x; if (Math.abs(d) < 4) { S.walkTo = null; if (S.flipAfter) { flip(api, S.flipAfter); S.flipAfter = null; } } else ax = d > 0 ? 1 : -1; }
      h.vx = ax * 210; if (ax) h.face = ax;
      if (api.hit("jump") && h.ground) { h.vy = -540; h.ground = false; api.sound.sfx("jump"); }
    }
    h.walk += Math.abs(h.vx) * dt;
    h.vy = Math.min(900, h.vy + 1700 * dt);
    if (h.on && h.on.dy) h.y += h.on.dy;
    var sol = solids(), py = h.y;
    h.x += h.vx * dt; h.x = Math.max(HW, Math.min(960 - HW, h.x));
    sol.forEach(function (b) { if (!over(h, b)) return; if (h.y - b.y < 3 && !b.door) return;
      if (b.door && h.vx === 0) { h.x = h.x < b.x + b.w / 2 ? b.x - HW - .1 : b.x + b.w + HW + .1; return; }
      if (h.vx > 0) h.x = b.x - HW - .01; else if (h.vx < 0) h.x = b.x + b.w + HW + .01; });
    h.y += h.vy * dt; h.ground = false; h.on = null;
    sol.forEach(function (b) { if (!over(h, b)) return;
      if (h.vy >= 0 && py <= b.y + 10) { h.y = b.y; h.vy = 0; h.ground = true; h.on = b; }
      else if (h.vy < 0) { h.y = b.y + b.h + HH; h.vy = 0; } });
    R.obs.forEach(function (ob) {
      if (ob.k === "laser" && !pass(ob) && h.stun <= 0 && Math.abs(h.x - ob.x) < HW + 5 && h.y > TOP + 30) {
        h.stun = .45; h.kb = h.x < ob.x ? -260 : 260; h.vy = -320; api.sound.sfx("zap"); api.buzz(60); api.kick(6); api.burst(ob.x, h.y - 24, "#ff5d5d", 16, 260);
        note("Zapped! The laser stays on until its signal reads " + ob.need + ".");
      }
    });
    if (h.y > 600) { S.falls++; h.x = 34; h.y = FLOOR; h.vx = h.vy = 0; S.walkTo = null; api.sound.sfx("hit"); api.buzz(40); note("You fell. A bridge only extends while its signal is 1."); }
    if (S.ok && !S.won && Math.abs(h.x - EXIT_X) < 22 && Math.abs(h.y - R.exitY) < 8) win(api);
  }
  function animate(api, dt) {
    S.room.obs.forEach(function (ob) {
      var p = pass(ob);
      if (ob.k === "steps") {
        var code = S.seq ? LS.stateCode(S.L, S.seq.st) : 0, tgt = (FLOOR - LEDGE) * code / S.seq.max, prev = ob.h;
        ob.h += Math.max(-150 * dt, Math.min(150 * dt, tgt - ob.h)); ob.dy = -(ob.h - prev); return;
      }
      var tg = ob.k === "laser" ? (p ? 0 : 1) : (p ? 1 : 0), sp = ob.k === "bridge" ? 1.6 : 2.2;
      ob.open += Math.max(-sp * dt, Math.min(sp * dt, tg - ob.open));
      if (ob.k === "laser" && ob.open > .5 && !api.reduce && Math.random() < .08) api.burst(ob.x, FLOOR - 4, "#ff7a7a", 2, 120);
    });
  }
  function seqTick(api, dt) {
    var q = S.seq, L = S.L; q.t += dt; q.pulse = Math.max(0, q.pulse - dt * 3);
    if (q.t < 1.1) return; q.t = 0; q.pulse = 1;
    if (L.boss && --q.flipIn <= 0) {
      q.flipIn = 3 + Math.floor(Math.random() * 3); S.lev.U ^= 1; api.sound.sfx("zap");
      S.taunt = { t: S.lev.U ? "Up you go… or not!" : TAUNT.boss[Math.floor(Math.random() * TAUNT.boss.length)], life: 2.4 };
      if (!api.reduce) api.burst(830, 360, "#c084fc", 12, 200);
      S.res = LS.check(L, S.a, S.lev);
    }
    var nx = LS.clock(L, S.a, q.st, S.lev);
    if (!nx) { q.bad = true; if (!S.note && S.moves) note("A flip-flop input is floating: fill every socket that feeds it."); }
    else { q.bad = false; q.st = nx; }
    q.hist.push(LS.stateCode(L, q.st)); if (q.hist.length > 12) q.hist.shift();
    api.sound.sfx("click"); S.v = LS.evaluate(L, S.a, inputs());
  }
  function nearLever() { var h = S.h, best = null; S.room.levers.forEach(function (l) { if (Math.abs(l.x - h.x) < 30 && Math.abs(h.y - FLOOR) < 4) best = l; }); return best; }

  /* ---------- drawing: gates ---------- */
  function gateShape(x, g, cx, cy, s) {
    var hw = 20 * s, hh = 16 * s, l = cx - hw, r = cx + hw, t = cy - hh, b = cy + hh;
    x.beginPath();
    if (g === "AND" || g === "NAND") { x.moveTo(l, t); x.lineTo(r - hh, t); x.arc(r - hh, cy, hh, -Math.PI / 2, Math.PI / 2); x.lineTo(l, b); x.closePath(); }
    else if (g === "NOT") { x.moveTo(l + 4 * s, t + 2 * s); x.lineTo(r - 4 * s, cy); x.lineTo(l + 4 * s, b - 2 * s); x.closePath(); }
    else { x.moveTo(l, t); x.quadraticCurveTo(cx + hw * .3, t, r, cy); x.quadraticCurveTo(cx + hw * .3, b, l, b); x.quadraticCurveTo(l + 9 * s, cy, l, t); x.closePath(); }
    return { l: g === "AND" || g === "NAND" || g === "NOT" ? l + (g === "NOT" ? 4 * s : 0) : l + 5 * s, r: g === "NOT" ? r - 4 * s : r, bubble: /^N|XNOR/.test(g) };
  }
  function drawGate(x, g, cx, cy, s, col, fill) {
    var sh = gateShape(x, g, cx, cy, s); x.fillStyle = fill || "#13222e"; x.fill(); x.strokeStyle = col; x.lineWidth = 2.2 * Math.max(.7, s); x.stroke();
    if (g === "XOR" || g === "XNOR") { x.beginPath(); x.moveTo(cx - 26 * s, cy - 16 * s); x.quadraticCurveTo(cx - 17 * s, cy, cx - 26 * s, cy + 16 * s); x.stroke(); }
    var tip = sh.r;
    if (sh.bubble) { x.beginPath(); x.arc(sh.r + 3.6 * s, cy, 3.6 * s, 0, 7); x.fillStyle = fill || "#13222e"; x.fill(); x.stroke(); tip = sh.r + 7.2 * s; }
    return { l: sh.l, tip: tip };
  }
  function geo(n) {
    var cx = n.at[0], cy = n.at[1];
    if (n.k === "eq") { var k = n.ins.length, hh = Math.max(24, k * 6 + 8); return { w: 132, h: hh * 2, ins: n.ins.map(function (_, j) { return [cx - 66, cy - (k - 1) * 6 + j * 12]; }), out: [cx + 66, cy] }; }
    if (n.k === "mux") return { w: 70, h: 170, ins: [0, 1, 2, 3].map(function (j) { return [cx - 35, cy - 60 + j * 40]; }), sel: [[cx - 12, cy + 80], [cx + 12, cy + 80]], out: [cx + 35, cy] };
    if (n.k === "ff") return { w: 64, h: 62, ins: [[cx - 32, cy - 12]], clk: [cx - 32, cy + 16], out: [cx + 32, cy - 12] };
    if (n.k === "src") return { w: 56, h: 32, ins: [], out: [cx + 28, cy] };
    if (n.k === "sock" && n.ins.length === 1) return { w: 52, h: 38, ins: [[cx - 26, cy]], out: [cx + 26, cy] };
    return { w: 60, h: 46, ins: [[cx - 30, cy - 10], [cx - 30, cy + 10]], out: [cx + 30, cy] };
  }
  function wireCol(v) { return v === 1 ? COL.on : v === X || v == null ? COL.x : COL.off; }
  function stroke(x, pts, v, t, reduce) {
    x.lineJoin = "round"; x.lineCap = "round";
    if (v === 1) { x.strokeStyle = "rgba(61,214,140,.25)"; x.lineWidth = 7; path(x, pts); x.stroke(); }
    x.strokeStyle = wireCol(v); x.lineWidth = v === 1 ? 3 : 2.2; if (v === X || v == null) x.setLineDash([5, 4]); path(x, pts); x.stroke(); x.setLineDash([]);
    if (v === 1 && !reduce) { // signal pulses flowing towards the gate
      var segs = [], len = 0; for (var i = 1; i < pts.length; i++) { var l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(l); len += l; }
      x.fillStyle = "#d9ffe9"; for (var d = (t * 90) % 26; d < len; d += 26) { var s = d, j = 0; while (j < segs.length && s > segs[j]) { s -= segs[j]; j++; } if (j >= segs.length) break; var f = segs[j] ? s / segs[j] : 0; x.beginPath(); x.arc(pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f, 1.8, 0, 7); x.fill(); }
    }
  }
  function path(x, pts) { x.beginPath(); pts.forEach(function (p, i) { if (i) x.lineTo(p[0], p[1]); else x.moveTo(p[0], p[1]); }); }
  function srcPin(L, id) {
    var lv = (L.levers || []).filter(function (l) { return l.id === id; })[0]; if (lv) return [lv.at[0] + 31, lv.at[1]];
    var n = LS.node(L, id); return n && n.at ? geo(n).out : null;
  }
  function lane(L, id) { if (!L._lanes) { L._lanes = {}; var k = 0; (L.levers || []).forEach(function (l) { L._lanes[l.id] = k++; }); L.nodes.forEach(function (n) { L._lanes[n.id] = k++; }); } return (L._lanes[id] || 0) % 5; }
  function route(L, sId, to, k, sel) {
    var p = srcPin(L, sId); if (!p) return null; var ln = lane(L, sId);
    if (sel) return [p, [to[0], p[1]], to];
    if (to[0] > p[0] + 8) { var mx = Math.max(p[0] + 6, to[0] - 10 - ln * 10); return [p, [mx, p[1]], [mx, to[1]], to]; }
    var up = 52 + ln * 4, ox = p[0] + 10 + ln * 6, ix = to[0] - 10 - ln * 8;
    return [p, [ox, p[1]], [ox, up], [ix, up], [ix, to[1]], to];
  }
  function drawExpr(x, str, px, py, size, col, align) { // letters followed by ' get an overbar
    var toks = [], s = String(str); for (var i = 0; i < s.length; i++) { var c = s[i]; if (c === "'" && toks.length) toks[toks.length - 1].neg = true; else toks.push({ c: c, neg: false }); }
    x.font = "700 " + size + "px system-ui, sans-serif"; var w = toks.reduce(function (a, t) { return a + x.measureText(t.c).width; }, 0), cx = align === "center" ? px - w / 2 : align === "right" ? px - w : px;
    x.textAlign = "left"; x.fillStyle = col; x.strokeStyle = col; x.lineWidth = Math.max(1.2, size / 12);
    toks.forEach(function (t) { var cw = x.measureText(t.c).width; x.fillText(t.c, cx, py); if (t.neg) { x.beginPath(); x.moveTo(cx + 1, py - size * .82); x.lineTo(cx + cw - 1, py - size * .82); x.stroke(); } cx += cw; });
    return w;
  }

  /* ---------- drawing: board ---------- */
  function hit(x, y, w, h, fn) { S.hits.push({ x: x, y: y, w: w, h: h, fn: fn }); }
  function drawBoard(api) {
    var x = api.x, L = S.L, t = api.t, v = S.v;
    x.fillStyle = "#0c1924"; x.fillRect(8, 46, 944, 244); x.strokeStyle = "#20374a"; x.lineWidth = 2; x.strokeRect(8, 46, 944, 244);
    x.strokeStyle = "rgba(126,240,255,.05)"; x.lineWidth = 1; for (var gx = 20; gx < 640; gx += 20) { x.beginPath(); x.moveTo(gx, 48); x.lineTo(gx, 288); x.stroke(); }
    x.fillStyle = "#0f2130"; x.fillRect(648, 50, 300, 236);
    if (L.kmap) { drawKmap(api); return; }
    // wires
    L.nodes.forEach(function (n) {
      if (!n.at) return; var G = geo(n);
      (n.ins || []).forEach(function (s, k) { if (L.bus && n.k === "sock") return; var r = route(L, s, G.ins[k]); if (r) stroke(x, r, LS.sig(v, s), t, api.reduce); });
      (n.sel || []).forEach(function (s, k) { var r = route(L, s, G.sel[k], k, true); if (r) stroke(x, r, v[s], t, api.reduce); });
    });
    // lever terminals
    (L.levers || []).forEach(function (l) {
      var on = S.lev[l.id], X0 = l.at[0], Y0 = l.at[1];
      x.fillStyle = on ? "rgba(61,214,140,.2)" : "#16283a"; x.strokeStyle = on ? COL.on : "#4b6478"; x.lineWidth = 2; rr(x, X0 - 31, Y0 - 12, 62, 24, 6); x.fill(); x.stroke();
      x.fillStyle = on ? "#c9ffe2" : COL.ink; x.font = "700 13px system-ui"; x.textAlign = "center"; x.fillText(l.id + " = " + on, X0, Y0 + 5);
      if (l.label && l.label !== l.id) { x.fillStyle = COL.dim; x.font = "11px system-ui"; x.fillText(l.label, X0, Y0 - 16); }
      if (!l.auto) hit(X0 - 31, Y0 - 13, 62, 26, function (api) { goFlip(api, l.id); });
    });
    // nodes
    var socks = S.socks;
    L.nodes.forEach(function (n) {
      if (!n.at) return; var G = geo(n), cx = n.at[0], cy = n.at[1], out = v[n.id], sel = S.sel >= 0 && socks[S.sel] === n;
      if (n.k === "gate" || n.k === "sock") {
        var g = n.k === "gate" ? n.g : S.a[n.id];
        if (n.k === "sock") {
          x.save(); x.setLineDash([5, 4]); x.strokeStyle = sel ? COL.cyan : "#5b748a"; x.lineWidth = sel ? 2.5 : 1.5; rr(x, cx - G.w / 2 - 4, cy - G.h / 2 - 4, G.w + 8, G.h + 8, 8); x.stroke(); x.restore();
          if (sel && !api.reduce) { x.strokeStyle = "rgba(126,240,255," + (.25 + .25 * Math.sin(t * 6)) + ")"; x.lineWidth = 2; rr(x, cx - G.w / 2 - 9, cy - G.h / 2 - 9, G.w + 18, G.h + 18, 10); x.stroke(); }
          hit(cx - G.w / 2 - 8, cy - G.h / 2 - 8, G.w + 16, G.h + 16, function (api) { tapSock(api, n); });
        }
        var col = n.k === "gate" ? "#c9d6e2" : "#ffe08a";
        if (!g) { x.fillStyle = "#5b748a"; x.font = "700 20px system-ui"; x.textAlign = "center"; x.fillText("?", cx, cy + 7); G.ins.forEach(function (p) { lead(x, p[0], p[1], p[0] + 8, p[1], X); }); }
        else if (g === "WIRE") { stroke(x, [G.ins[0], G.out], out, t, true); }
        else if (g === "J") { var vi = LS.sig(v, n.ins[0]); x.strokeStyle = wireCol(vi); x.lineWidth = 3; x.beginPath(); x.moveTo(G.ins[0][0], G.ins[0][1]); x.bezierCurveTo(cx, G.ins[0][1] - 14, cx, cy, G.out[0], G.out[1]); x.stroke();
          x.fillStyle = COL.dim; x.font = "10px system-ui"; x.textAlign = "center"; x.fillText("jumper", cx, cy + 20); }
        else {
          var gs = n.ins.length === 1 ? .78 : 1, d = drawGate(x, g, cx, cy, gs, col);
          G.ins.forEach(function (p, k) { lead(x, p[0], p[1], d.l + (g === "AND" || g === "NAND" || g === "NOT" ? 0 : 2), p[1], LS.sig(v, n.ins[k])); });
          lead(x, d.tip, cy, G.out[0], cy, out);
          if (g !== "NOT") { x.fillStyle = col; x.font = "600 10px system-ui"; x.textAlign = "center"; x.fillText(g, cx - 3, cy + 4); }
        }
        if (L.bus && n.k === "sock") { x.fillStyle = COL.dim; x.font = "10px system-ui"; x.textAlign = "right"; x.fillText("A", G.ins[0][0] - 2, G.ins[0][1] + 3); x.fillText("B", G.ins[1][0] - 2, G.ins[1][1] + 3); }
      } else if (n.k === "src") {
        var val = S.a[n.id];
        x.save(); if (!val) x.setLineDash([5, 4]); x.strokeStyle = sel ? COL.cyan : val ? "#ffe08a" : "#5b748a"; x.lineWidth = sel ? 2.5 : 1.8; x.fillStyle = "#13222e"; rr(x, cx - 28, cy - 16, 56, 32, 8); x.fill(); x.stroke(); x.restore();
        if (val) drawExpr(x, lit(val), cx, cy + 6, 16, wireCol(out), "center"); else { x.fillStyle = "#5b748a"; x.font = "700 18px system-ui"; x.textAlign = "center"; x.fillText("?", cx, cy + 6); }
        if (sel && !api.reduce) { x.strokeStyle = "rgba(126,240,255," + (.25 + .25 * Math.sin(t * 6)) + ")"; x.lineWidth = 2; rr(x, cx - 33, cy - 21, 66, 42, 10); x.stroke(); }
        hit(cx - 32, cy - 20, 64, 40, function (api) { tapSock(api, n); });
      } else if (n.k === "eq") {
        x.fillStyle = "#162a3a"; x.strokeStyle = "#9fb6c8"; x.lineWidth = 2; rr(x, cx - G.w / 2, cy - G.h / 2, G.w, G.h, 8); x.fill(); x.stroke();
        x.fillStyle = COL.ink; x.font = "700 14px system-ui"; x.textAlign = "center"; x.fillText(n.label, cx, cy + 5);
        lead(x, G.out[0], cy, G.out[0] + 10, cy, out);
      } else if (n.k === "mux") {
        x.fillStyle = "#162a3a"; x.strokeStyle = "#c9d6e2"; x.lineWidth = 2.2; x.beginPath(); x.moveTo(cx - 35, cy - 85); x.lineTo(cx + 35, cy - 60); x.lineTo(cx + 35, cy + 60); x.lineTo(cx - 35, cy + 85); x.closePath(); x.fill(); x.stroke();
        x.fillStyle = COL.ink; x.font = "700 13px system-ui"; x.textAlign = "center"; x.fillText("MUX", cx, cy + 4); x.font = "10px system-ui"; x.fillText("4 : 1", cx, cy + 18);
        var si = (v[n.sel[0]] === X || v[n.sel[1]] === X) ? -1 : v[n.sel[0]] * 2 + v[n.sel[1]];
        G.ins.forEach(function (p, k) { x.fillStyle = k === si ? COL.cyan : COL.dim; x.textAlign = "left"; x.fillText("D" + k, p[0] + 4, p[1] + 4); });
        x.fillStyle = COL.dim; x.textAlign = "center"; x.fillText("S1", G.sel[0][0], G.sel[0][1] - 6); x.fillText("S0", G.sel[1][0], G.sel[1][1] - 6);
        if (si >= 0) { x.strokeStyle = COL.cyan; x.lineWidth = 2; x.setLineDash([3, 3]); x.beginPath(); x.moveTo(G.ins[si][0] + 22, G.ins[si][1]); x.lineTo(cx + 30, cy); x.stroke(); x.setLineDash([]); }
      } else if (n.k === "ff") {
        x.fillStyle = "#162a3a"; x.strokeStyle = "#c9d6e2"; x.lineWidth = 2.2; rr(x, cx - 32, cy - 31, 64, 62, 6); x.fill(); x.stroke();
        x.fillStyle = COL.ink; x.font = "700 13px system-ui"; x.textAlign = "left"; x.fillText(n.t, cx - 27, cy - 8); x.textAlign = "right"; x.fillText(n.id, cx + 28, cy - 8);
        x.beginPath(); x.moveTo(cx - 32, cy + 9); x.lineTo(cx - 22, cy + 16); x.lineTo(cx - 32, cy + 23); x.stroke();
        var pl = S.seq ? S.seq.pulse : 0; x.strokeStyle = pl > .1 ? "rgba(246,196,69," + pl + ")" : "#5b748a"; x.lineWidth = 2; x.beginPath(); x.moveTo(cx - 32, cy + 16); x.lineTo(cx - 46, cy + 16); x.stroke();
        x.fillStyle = COL.dim; x.font = "9px system-ui"; x.textAlign = "right"; x.fillText("clk", cx - 47, cy + 19);
        x.fillStyle = out ? COL.on : "#35506a"; x.beginPath(); x.arc(cx + 18, cy + 15, 7, 0, 7); x.fill();
        x.fillStyle = "#06121a"; x.font = "700 10px system-ui"; x.textAlign = "center"; x.fillText(out, cx + 18, cy + 19);
      }
      // output flags: outputs that feed the room
      var tag = outTag(L, n.id);
      if (tag) {
        var feeds = L.nodes.some(function (m) { return (m.ins || []).indexOf(n.id) >= 0; }), fx = G.out[0] + (feeds ? -10 : 8), fy = feeds ? cy - G.h / 2 - 16 : cy;
        x.font = "700 11px system-ui"; var tw = x.measureText(tag + " " + (out === X ? "?" : out)).width + 12;
        x.fillStyle = out === 1 ? COL.on : out === X ? "#5a2630" : "#26394a"; rr(x, fx, fy - 10, tw, 20, 10); x.fill();
        x.fillStyle = out === 1 ? "#05170e" : COL.ink; x.textAlign = "left"; x.fillText(tag + " " + (out === X ? "?" : out), fx + 6, fy + 4);
      }
    });
    if (S.pop && S.sel >= 0 && S.socks[S.sel]) drawPop(api);
    drawReadout(api);
  }
  function outTag(L, id) {
    if (L.mode === "table") return L.table.outs[id] != null && !L.kmap ? id : null;
    if (L.mode === "seq") return null;
    var o = L.obs.filter(function (q) { return q.sig === id; })[0]; return o ? NAME[o.k] : null;
  }
  function lead(x, x1, y1, x2, y2, v) { x.strokeStyle = wireCol(v); x.lineWidth = 2.2; x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke(); }
  function rr(x, px, py, w, h, r) { x.beginPath(); x.moveTo(px + r, py); x.arcTo(px + w, py, px + w, py + h, r); x.arcTo(px + w, py + h, px, py + h, r); x.arcTo(px, py + h, px, py, r); x.arcTo(px, py, px + w, py, r); x.closePath(); }
  function drawPop(api) {
    var x = api.x, n = S.socks[S.sel], o = LS.options(S.L, n), u = LS.usage(S.L, S.a), inv = S.L.inv || {}, G = geo(n);
    var bw = 64, w = o.length * bw + 12, px = Math.max(12, Math.min(636 - w, n.at[0] - w / 2)), py = n.at[1] + G.h / 2 + 12;
    if (py + 70 > 288) py = n.at[1] - G.h / 2 - 82;
    x.fillStyle = "rgba(6,14,22,.96)"; x.strokeStyle = COL.cyan; x.lineWidth = 2; rr(x, px, py, w, 70, 10); x.fill(); x.stroke();
    o.forEach(function (op, k) {
      var bx = px + 6 + k * bw, cur = S.a[n.id] === op, a2 = Object.assign({}, S.a); a2[n.id] = op; var okFit = LS.fits(S.L, a2);
      x.fillStyle = cur ? "rgba(126,240,255,.18)" : "rgba(255,255,255,.04)"; rr(x, bx + 2, py + 6, bw - 4, 58, 8); x.fill();
      var col = okFit ? "#ffe08a" : "#4b5b68";
      if (LS.TWO.indexOf(op) >= 0 || op === "NOT") drawGate(x, op, bx + bw / 2, py + 27, .62, col);
      else if (n.k === "src" && op) drawExpr(x, lit(op), bx + bw / 2, py + 33, 16, col, "center");
      else { x.strokeStyle = col; x.lineWidth = 2; x.beginPath(); x.moveTo(bx + 14, py + 27); x.lineTo(bx + bw - 14, py + 27); x.stroke(); if (op === "") { x.fillStyle = col; x.font = "700 14px system-ui"; x.textAlign = "center"; x.fillText("✕", bx + bw / 2, py + 23); } }
      x.fillStyle = okFit ? COL.ink : "#5b6b78"; x.font = "600 10px system-ui"; x.textAlign = "center";
      var left = op === "NOT" ? (inv.NOT || 0) - (u.NOT || 0) : inv[op] != null ? inv[op] - (u[op] || 0) : null;
      x.fillText((k + 1) + " " + optLabel(op) + (left != null && op !== "WIRE" ? " ×" + left : ""), bx + bw / 2, py + 58);
      hit(bx, py, bw, 70, function (api) { edit(api, n.id, op); S.pop = false; });
    });
  }
  function drawReadout(api) {
    var x = api.x, L = S.L, R = S.res, X0 = 656, Y0 = 70;
    x.textAlign = "left"; x.fillStyle = COL.gold; x.font = "700 14px system-ui";
    if (L.mode === "levers") {
      x.fillText("Locks (live)", X0, Y0);
      L.obs.forEach(function (o, k) {
        var y = Y0 + 26 + k * 58, n = LS.node(L, o.sig), val = S.v[o.sig], ok = R.obs[k];
        x.fillStyle = ok ? "rgba(61,214,140,.14)" : "rgba(255,107,107,.1)"; rr(x, X0 - 4, y - 16, 290, 50, 8); x.fill();
        x.fillStyle = COL.ink; x.font = "700 14px system-ui"; x.fillText(NAME[o.k] + (o.k === "laser" ? " off when" : " opens when"), X0 + 4, y + 2);
        x.fillStyle = COL.dim; x.font = "12px system-ui"; x.fillText((n.label ? "comparator “" + n.label + "”" : n.g + " gate") + " reads " + o.need, X0 + 4, y + 22);
        x.textAlign = "right"; x.font = "700 15px system-ui"; x.fillStyle = ok ? COL.on : COL.x; x.fillText("now " + val + (ok ? " ✓" : " ✗"), X0 + 280, y + 12); x.textAlign = "left";
      });
    } else if (L.mode === "table" && L.seg) drawSegReadout(api);
    else if (L.mode === "table") {
      var T = L.table, outs = Object.keys(T.outs), cols = T.ins.length, rows = R.rows.length, rh = Math.min(22, 196 / (rows + 1)), cw = Math.min(30, 280 / (cols + outs.length * 2 + 1));
      var cur = T.ins.reduce(function (s, id) { return s * 2 + S.lev[id]; }, 0);
      x.fillText("Truth table · " + R.good + "/" + rows + " rows", X0, Y0 - 2);
      x.font = "700 12px system-ui"; x.textAlign = "center";
      T.ins.forEach(function (id, j) { x.fillStyle = COL.dim; x.fillText(id, X0 + 10 + j * cw, Y0 + 18); });
      outs.forEach(function (o, j) { var bx = X0 + 10 + (cols + .5 + j * 2) * cw; x.fillStyle = COL.gold; x.fillText(o, bx + cw / 2, Y0 + 18); x.fillStyle = COL.dim; x.font = "9px system-ui"; x.fillText("want  you", bx + cw / 2, Y0 + 7); x.font = "700 12px system-ui"; });
      R.rows.forEach(function (r, k) {
        var y = Y0 + 22 + (k + 1) * rh;
        if (k === cur) { x.fillStyle = "rgba(126,240,255,.16)"; x.fillRect(X0 - 4, y - rh + 5, 288, rh); }
        x.font = "600 " + Math.min(13, rh - 4) + "px ui-monospace, monospace";
        T.ins.forEach(function (id, j) { x.fillStyle = COL.ink; x.fillText(r.inp[id], X0 + 10 + j * cw, y); });
        outs.forEach(function (o, j) { var bx = X0 + 10 + (cols + .5 + j * 2) * cw, w = T.outs[o][k], g = r.got[o], m = w === "-" || +w === g;
          x.fillStyle = COL.dim; x.fillText(w === "-" ? "×" : w, bx, y); x.fillStyle = g === X ? COL.x : m ? COL.on : COL.x; x.fillText(g === X ? "?" : g, bx + cw, y); });
        x.fillStyle = r.ok ? COL.on : COL.x; x.fillText(r.ok ? "✓" : "✗", X0 + 278, y);
      });
    } else if (L.mode === "seq") drawSeqReadout(api);
  }
  var SEG = { 0: "abcdef", 1: "bc", 2: "abdeg", 3: "abcdg", 4: "bcfg", 5: "acdfg", 6: "acdefg", 7: "abc", 8: "abcdefg", 9: "abcdfg" };
  function seg7(x, cx, cy, s, on, colOn) { // on: function(letter) -> 0/1/X
    var w = 16 * s, h = 14 * s, th = 3.2 * s, P = { a: [[-w / 2, -h], [w / 2, -h]], b: [[w / 2, -h], [w / 2, 0]], c: [[w / 2, 0], [w / 2, h]], d: [[-w / 2, h], [w / 2, h]], e: [[-w / 2, 0], [-w / 2, h]], f: [[-w / 2, -h], [-w / 2, 0]], g: [[-w / 2, 0], [w / 2, 0]] };
    x.lineCap = "round"; x.lineWidth = th;
    "abcdefg".split("").forEach(function (k) { var o = on(k); x.strokeStyle = o === 1 ? colOn : o === X ? "rgba(255,107,107,.5)" : "rgba(255,255,255,.08)"; x.beginPath(); x.moveTo(cx + P[k][0][0], cy + P[k][0][1]); x.lineTo(cx + P[k][1][0], cy + P[k][1][1]); x.stroke(); });
  }
  function drawSegReadout(api) {
    var x = api.x, L = S.L, R = S.res, X0 = 656, Y0 = 68, cur = S.lev.A * 2 + S.lev.B;
    x.fillText("Display · " + R.good + "/4 codes", X0, Y0);
    x.font = "11px system-ui"; x.fillStyle = COL.dim; x.fillText("A B      want      yours", X0 + 4, Y0 + 20);
    R.rows.forEach(function (r, k) {
      var y = Y0 + 46 + k * 50, dig = +L.seg[k];
      if (k === cur) { x.fillStyle = "rgba(126,240,255,.16)"; x.fillRect(X0 - 4, y - 24, 288, 48); }
      x.fillStyle = COL.ink; x.font = "600 14px ui-monospace, monospace"; x.textAlign = "left"; x.fillText(r.inp.A + " " + r.inp.B, X0 + 4, y + 5);
      seg7(x, X0 + 92, y, 1.2, function (l) { return SEG[dig].indexOf(l) >= 0 ? 1 : 0; }, COL.gold);
      seg7(x, X0 + 170, y, 1.2, function (l) { return r.got[l]; }, r.ok ? COL.on : COL.x);
      x.fillStyle = r.ok ? COL.on : COL.x; x.font = "700 16px system-ui"; x.fillText(r.ok ? "✓" : "✗", X0 + 250, y + 6);
    });
  }
  function drawSeqReadout(api) {
    var x = api.x, L = S.L, R = S.res, X0 = 656, Y0 = 68, q = S.seq, sp = R.runs.length > 1 ? 52 : 64;
    x.fillText("State sequence from reset", X0, Y0);
    R.runs.forEach(function (run, k) {
      var spec = L.seq.runs[k], y = Y0 + 20 + k * sp;
      x.font = "11px system-ui"; x.fillStyle = COL.dim; x.fillText((spec.set ? "U = " + spec.set.U + (spec.set.U ? " (count up)" : " (count down)") : "Target") + " · gold = wanted, then yours", X0, y);
      x.font = "600 14px ui-monospace, monospace";
      spec.states.forEach(function (s, j) { var gx = X0 + j * 30; x.fillStyle = COL.gold; x.fillText(s, gx, y + 16); var g = run.got[j]; x.fillStyle = g == null ? "#5b6b78" : g === s ? COL.on : COL.x; x.fillText(g == null ? "?" : g, gx, y + 34); });
    });
    var y2 = Y0 + 20 + R.runs.length * sp + 6, code = LS.stateCode(L, q.st), bits = L.seq.ffs.map(function (f) { return q.st[f]; }).join("");
    x.font = "700 14px system-ui"; x.fillStyle = COL.ink; x.fillText("Now: " + L.seq.ffs.join("") + " = " + bits + " (" + code + ")" + (L.boss ? "   U = " + S.lev.U : ""), X0, y2);
    var wy = y2 + 14, off = (q.t / 1.1) * 23; // scrolling clock waveform with the states it produced
    x.save(); x.beginPath(); x.rect(X0, wy - 4, 284, 40); x.clip();
    x.strokeStyle = COL.gold; x.lineWidth = 2; x.beginPath();
    for (var k = -1; k < 13; k++) { var px = X0 + k * 23 - off; x.moveTo(px, wy + 12); x.lineTo(px, wy); x.lineTo(px + 11, wy); x.lineTo(px + 11, wy + 12); x.lineTo(px + 23, wy + 12); }
    x.stroke(); x.font = "600 11px ui-monospace, monospace";
    q.hist.forEach(function (s, k) { x.fillStyle = k === q.hist.length - 1 ? COL.cyan : COL.dim; x.fillText(s, X0 + 4 + (k - q.hist.length + 12) * 23 - off, wy + 28); });
    x.restore();
  }
  function drawKmap(api) {
    var x = api.x, L = S.L, plane = L.nodes.filter(function (n) { return n.k === "plane"; })[0], vars = L.table.ins, n = vars.length, want = L.table.outs[plane.id];
    var rv = vars.slice(0, Math.floor(n / 2)), cv = vars.slice(Math.floor(n / 2)), gray = function (k) { return k === 1 ? [0, 1] : [0, 1, 3, 2]; }, rs = gray(rv.length), cs = gray(cv.length), sz = n === 4 ? 44 : 52;
    var ox = 70, oy = 92, pos = plane.type === "pos", on = plane.tiles.map(function (id, k) { return { id: id, k: k, lits: LS.parseTerm(LS.node(L, id).term) }; }).filter(function (q) { return S.a[q.id] === "1"; });
    var cur = vars.reduce(function (s, id) { return s * 2 + S.lev[id]; }, 0);
    x.textAlign = "center"; x.fillStyle = COL.gold; x.font = "700 13px system-ui"; x.fillText(pos ? "K-map: cover the 0s" : "K-map: cover the 1s", ox + cs.length * sz / 2, 62);
    x.fillStyle = COL.dim; x.font = "600 12px system-ui"; x.textAlign = "right"; x.fillText(rv.join("") + " \\ " + cv.join(""), ox - 6, oy - 8);
    cs.forEach(function (c, j) { x.textAlign = "center"; x.fillText(bits(c, cv.length), ox + j * sz + sz / 2, oy - 8); });
    rs.forEach(function (r, i) {
      x.textAlign = "right"; x.fillStyle = COL.dim; x.fillText(bits(r, rv.length), ox - 6, oy + i * sz + sz / 2 + 4);
      cs.forEach(function (c, j) {
        var m = r * (1 << cv.length) + c, w = want[m], cx = ox + j * sz, cy = oy + i * sz, inp = {};
        vars.forEach(function (id, b) { inp[id] = (m >> (n - 1 - b)) & 1; });
        var cov = on.filter(function (q) { var val = q.lits.map(function (l) { return l.neg ? 1 - inp[l.v] : inp[l.v]; }); return pos ? val.every(function (b) { return !b; }) : val.every(function (b) { return b; }); });
        var target = pos ? "0" : "1", bad = (w === target && !cov.length) || (w !== target && w !== "-" && cov.length);
        x.fillStyle = bad ? "rgba(255,107,107,.22)" : "#122636"; x.fillRect(cx + 1, cy + 1, sz - 2, sz - 2);
        cov.forEach(function (q, z) { x.strokeStyle = TILE_COL[q.k % TILE_COL.length]; x.lineWidth = 2.5; rr(x, cx + 4 + z * 4, cy + 4 + z * 4, sz - 8 - z * 8, sz - 8 - z * 8, 6); x.stroke(); });
        if (m === cur) { x.strokeStyle = "#fff"; x.lineWidth = 2; x.strokeRect(cx + 1, cy + 1, sz - 2, sz - 2); }
        x.textAlign = "center"; x.font = "700 " + (n === 4 ? 16 : 18) + "px system-ui"; x.fillStyle = w === "-" ? COL.dim : w === target ? "#fff" : "#55697a"; x.fillText(w === "-" ? "×" : w, cx + sz / 2, cy + sz / 2 + 6);
        x.font = "9px system-ui"; x.fillStyle = "#5b748a"; x.fillText(m, cx + sz - 8, cy + 11);
      });
    });
    // term tiles
    var tx = 330, ty = 60, th = Math.min(32, 222 / plane.tiles.length);
    x.textAlign = "left"; x.fillStyle = COL.dim; x.font = "11px system-ui"; x.fillText(pos ? "Sum terms (tap to use)" : "Product terms (tap to use)", tx, ty - 4);
    plane.tiles.forEach(function (id, k) {
      var nd = LS.node(L, id), isOn = S.a[id] === "1", sel = S.sel >= 0 && S.socks[S.sel] === nd, y = ty + 4 + k * th, col = TILE_COL[k % TILE_COL.length];
      x.fillStyle = isOn ? "rgba(255,255,255,.1)" : "rgba(255,255,255,.03)"; x.strokeStyle = isOn ? col : sel ? COL.cyan : "#34495c"; x.lineWidth = isOn || sel ? 2.5 : 1.5; rr(x, tx, y, 170, th - 5, 7); x.fill(); x.stroke();
      x.fillStyle = col; x.beginPath(); x.arc(tx + 14, y + (th - 5) / 2, 5, 0, 7); isOn ? x.fill() : x.stroke();
      drawExpr(x, pos ? "(" + nd.term + ")" : nd.term, tx + 28, y + (th - 5) / 2 + 6, 15, isOn ? "#fff" : COL.dim, "left");
      x.font = "600 10px system-ui"; x.fillStyle = COL.dim; x.textAlign = "right"; x.fillText(k + 1, tx + 164, y + (th - 5) / 2 + 4);
      hit(tx, y, 170, th - 5, function (api) { S.sel = S.socks.indexOf(nd); edit(api, id, isOn ? "0" : "1"); });
    });
    // expression + cost (readout panel)
    var X0 = 656, Y0 = 70, terms = on.map(function (q) { return pos ? "(" + LS.node(L, q.id).term + ")" : LS.node(L, q.id).term; });
    x.textAlign = "left"; x.fillStyle = COL.gold; x.font = "700 14px system-ui"; x.fillText("Your circuit", X0, Y0);
    var expr = terms.length ? terms.join(pos ? "" : " + ") : (pos ? "1" : "0"), w1 = drawExpr(x, "F = ", X0, Y0 + 30, 16, COL.ink, "left");
    var parts = [], line = ""; (pos ? terms : terms.map(function (q, k) { return (k ? "+ " : "") + q; })).forEach(function (p) { if ((line + p).length > 20) { parts.push(line); line = ""; } line += p + " "; }); parts.push(line || expr);
    parts.forEach(function (p, k) { drawExpr(x, p.trim(), X0 + w1, Y0 + 30 + k * 22, 16, COL.ink, "left"); });
    var yy = Y0 + 44 + parts.length * 22, ones = 0, tot = 0;
    S.res.rows.forEach(function (r, k) { var w = want[k]; if (w === "-") return; tot++; if (r.ok) ones++; });
    x.font = "13px system-ui"; x.fillStyle = S.ok ? COL.on : COL.dim; x.fillText("Cells right: " + ones + "/" + tot + (S.ok ? "  ✓ exact cover" : ""), X0, yy);
    var g = LS.gates(L, S.a); x.fillStyle = COL.ink; x.fillText("Gates: " + g + " (best " + L.best + ")", X0, yy + 22);
    x.fillStyle = COL.dim; x.font = "11px system-ui"; x.fillText(pos ? "1 OR per sum term, 1 AND, 1 NOT per" : "1 AND per product term, 1 OR, 1 NOT per", X0, yy + 44); x.fillText("complemented variable.", X0, yy + 58);
    x.fillText("Current input row: m" + cur + " (white box)", X0, yy + 80);
  }
  function bits(v, n) { var s = ""; for (var i = n - 1; i >= 0; i--) s += (v >> i) & 1; return s; }

  /* ---------- drawing: room ---------- */
  function drawRoom(api) {
    var x = api.x, R = S.room, L = S.L, t = api.t, h = S.h;
    var g = x.createLinearGradient(0, TOP, 0, 540); g.addColorStop(0, "#101b2a"); g.addColorStop(1, "#0a121c"); x.fillStyle = g; x.fillRect(0, TOP, 960, 244);
    x.strokeStyle = "rgba(160,190,220,.06)"; x.lineWidth = 1; for (var by = TOP + 22; by < FLOOR; by += 22) { x.beginPath(); x.moveTo(0, by); x.lineTo(960, by); x.stroke(); for (var bx = (by / 22) % 2 ? 0 : 30; bx < 960; bx += 60) { x.beginPath(); x.moveTo(bx, by - 22); x.lineTo(bx, by); x.stroke(); } }
    hit(0, TOP + 90, 960, 154, function (api, mx) { S.walkTo = Math.max(HW, Math.min(948, mx)); S.flipAfter = null; S.pop = false; });
    wallInfo(api);
    // floor and pits
    solids().forEach(function (b) {
      if (b.door) return;
      if (b.h >= 80) { x.fillStyle = "#1d2b3a"; x.fillRect(b.x, b.y, b.w, 540 - b.y); x.fillStyle = "#2f4458"; x.fillRect(b.x, b.y, b.w, 6); x.fillStyle = "rgba(255,255,255,.05)"; for (var k = b.x; k < b.x + b.w; k += 40) x.fillRect(k, b.y + 6, 2, 34); }
    });
    R.pits.forEach(function (p) { var pg = x.createLinearGradient(0, FLOOR, 0, 540); pg.addColorStop(0, "#05080d"); pg.addColorStop(1, "#000"); x.fillStyle = pg; x.fillRect(p[0], FLOOR, p[1] - p[0], 40); });
    // levers
    R.levers.forEach(function (l) {
      var on = S.lev[l.id], tgt = on ? .6 : -.6; l.ang += (tgt - l.ang) * .25; var near = nearLever() === l;
      x.fillStyle = "#3a4f63"; rr(x, l.x - 16, FLOOR - 12, 32, 12, 4); x.fill();
      x.strokeStyle = "#b8c7d4"; x.lineWidth = 4; x.lineCap = "round"; x.beginPath(); x.moveTo(l.x, FLOOR - 8); x.lineTo(l.x + Math.sin(l.ang) * 30, FLOOR - 8 - Math.cos(l.ang) * 30); x.stroke();
      x.fillStyle = on ? COL.on : "#ff6b6b"; x.beginPath(); x.arc(l.x + Math.sin(l.ang) * 30, FLOOR - 8 - Math.cos(l.ang) * 30, 7, 0, 7); x.fill();
      x.fillStyle = near ? COL.cyan : COL.ink; x.font = "700 14px system-ui"; x.textAlign = "center"; x.fillText(l.label + "=" + on, l.x, FLOOR - 50);
      if (near && !S.won) { x.fillStyle = COL.cyan; x.font = "600 11px system-ui"; x.fillText("E / ● flip", l.x, FLOOR - 66); }
      hit(l.x - 26, FLOOR - 70, 52, 74, function (api) { goFlip(api, l.id); });
    });
    // obstacles
    R.obs.forEach(function (ob) {
      var p = pass(ob), lab = NAME[ob.k];
      if (ob.k === "door" || ob.k === "scan") {
        var hgt = (FLOOR - TOP) * (1 - ob.open);
        x.fillStyle = "#2a3c4f"; x.fillRect(ob.x - 16, TOP, 32, 8);
        var dg = x.createLinearGradient(ob.x - 11, 0, ob.x + 11, 0); dg.addColorStop(0, "#41566c"); dg.addColorStop(.5, "#6b8299"); dg.addColorStop(1, "#384b5e");
        x.fillStyle = dg; x.fillRect(ob.x - 11, TOP, 22, hgt);
        x.fillStyle = p ? COL.on : "#ff6b6b"; x.fillRect(ob.x - 3, TOP + Math.max(8, hgt - 30), 6, 12);
        if (ob.k === "scan") { x.fillStyle = "#0b1520"; rr(x, ob.x - 50, TOP + 76, 34, 40, 4); x.fill(); x.strokeStyle = S.ok ? COL.on : "#ff6b6b"; x.lineWidth = 2; x.stroke(); x.fillStyle = S.ok ? COL.on : "#ff9b9b"; x.font = "700 10px system-ui"; x.textAlign = "center";
          var sc = S.res.rows ? S.res.good + "/" + S.res.rows.length : S.ok ? "OK" : "…"; x.fillText(sc, ob.x - 33, TOP + 100);
          if (!api.reduce && !S.ok) { x.fillStyle = "rgba(255,107,107,.3)"; x.fillRect(ob.x - 48, TOP + 78 + ((t * 30) % 36), 30, 2); } }
      } else if (ob.k === "laser") {
        x.fillStyle = "#3a4f63"; x.fillRect(ob.x - 10, TOP, 20, 12); x.fillRect(ob.x - 10, FLOOR - 12, 20, 12);
        if (ob.open > .05) { var fl = api.reduce ? 1 : .75 + .25 * Math.sin(t * 40); x.globalAlpha = ob.open; x.fillStyle = "rgba(255,60,60," + .25 * fl + ")"; x.fillRect(ob.x - 7, TOP + 12, 14, FLOOR - TOP - 24); x.fillStyle = "#ffd0d0"; x.fillRect(ob.x - 1.5, TOP + 12, 3, FLOOR - TOP - 24); x.globalAlpha = 1; }
        x.fillStyle = p ? COL.on : "#ff6b6b"; x.beginPath(); x.arc(ob.x, TOP + 6, 3, 0, 7); x.fill();
      } else if (ob.k === "bridge") {
        var n = Math.round(10 * ob.open); for (var k = 0; k < n; k++) { x.fillStyle = k % 2 ? "#8a6a3e" : "#a07a46"; x.fillRect(ob.x + k * 15, FLOOR, 14, 10); }
        x.fillStyle = "#3a4f63"; x.fillRect(ob.x - 8, FLOOR - 4, 8, 14);
      } else if (ob.k === "steps") {
        x.fillStyle = "#1d2b3a"; x.fillRect(R.ledge, LEDGE, 960 - R.ledge, 140); x.fillStyle = "#2f4458"; x.fillRect(R.ledge, LEDGE, 960 - R.ledge, 6);
        x.strokeStyle = "#3a4f63"; x.lineWidth = 3; x.beginPath(); x.moveTo(ob.x + 6, TOP + 4); x.lineTo(ob.x + 6, FLOOR); x.moveTo(ob.x + ob.w - 6, TOP + 4); x.lineTo(ob.x + ob.w - 6, FLOOR); x.stroke();
        var max = S.seq.max; for (var f = 0; f <= max; f++) { var fy = FLOOR - (FLOOR - LEDGE) * f / max; x.fillStyle = "rgba(255,255,255,.25)"; x.fillRect(ob.x - 14, fy - 1, 8, 2); if (max <= 7) { x.fillStyle = COL.dim; x.font = "9px system-ui"; x.textAlign = "right"; x.fillText(f, ob.x - 16, fy + 3); } }
        var py = FLOOR - ob.h; x.fillStyle = S.seq.bad ? "#7a3a3a" : "#6b8299"; x.fillRect(ob.x, py, ob.w, 12); x.fillStyle = S.ok ? COL.on : COL.gold; x.fillRect(ob.x + 4, py + 4, ob.w - 8, 3);
        if (L.boss) { x.fillStyle = "#3d1f5c"; rr(x, ob.x - 70, FLOOR - 40, 40, 34, 6); x.fill(); x.fillStyle = "#c084fc"; x.font = "700 12px system-ui"; x.textAlign = "center"; x.fillText("U=" + S.lev.U, ob.x - 50, FLOOR - 18); }
      }
      x.fillStyle = p ? COL.on : "#ff9b9b"; x.font = "700 12px system-ui"; x.textAlign = "center";
      var lx = ob.k === "bridge" ? ob.x + 75 : ob.k === "steps" ? ob.x + ob.w / 2 : ob.x;
      if (ob.k !== "steps") x.fillText(lab + (p ? " ✓" : ""), lx, ob.k === "bridge" ? FLOOR + 30 : TOP + 58);
    });
    // exit portal
    var ex = EXIT_X, ey = R.exitY, on = S.ok, pr = api.reduce ? 0 : Math.sin(t * 4) * 3;
    x.save(); x.translate(ex, ey - 34);
    var pg2 = x.createRadialGradient(0, 0, 4, 0, 0, 40 + pr); pg2.addColorStop(0, on ? "rgba(126,240,255,.9)" : "rgba(120,130,140,.3)"); pg2.addColorStop(1, "rgba(126,240,255,0)");
    x.fillStyle = pg2; x.beginPath(); x.ellipse(0, 0, 26 + pr, 36 + pr, 0, 0, 7); x.fill();
    x.strokeStyle = on ? COL.cyan : "#566676"; x.lineWidth = 4; x.beginPath(); x.ellipse(0, 0, 20, 32, 0, 0, 7); x.stroke(); x.restore();
    x.fillStyle = on ? COL.cyan : "#7d8c99"; x.font = "700 11px system-ui"; x.textAlign = "center"; x.fillText(on ? "EXIT" : "LOCKED", ex, ey - 76);
    // Count Entropy (bosses)
    if (L.boss) {
      var ey2 = 344 + (api.reduce ? 0 : Math.sin(t * 2) * 6), exx = 820;
      x.strokeStyle = "rgba(192,132,252,.5)"; x.lineWidth = 2; x.beginPath(); x.ellipse(exx, ey2 + 26, 22, 6, 0, 0, 7); x.stroke();
      A.drawHead(x, A.VILLAIN, exx, ey2, 20, -1, { mood: S.won ? "sad" : "fight" });
      if (S.taunt && S.taunt.life > 0) { x.font = "600 12px system-ui"; var tw = x.measureText(S.taunt.t).width + 16; x.fillStyle = "rgba(61,31,92,.95)"; rr(x, exx - tw - 18, ey2 - 44, tw, 26, 10); x.fill(); x.fillStyle = "#f2e6ff"; x.textAlign = "left"; x.fillText(S.taunt.t, exx - tw - 10, ey2 - 27); }
    }
    // hero
    drawHero(api);
  }
  function wallInfo(api) {
    var x = api.x, L = S.L;
    if (L.adder) {
      var ins = L.adder.map(function (id) { return S.lev[id]; }), sum = ins.reduce(function (a, b) { return a + b; }, 0), outs = Object.keys(L.table.outs);
      x.fillStyle = "rgba(10,20,30,.8)"; rr(x, 16, TOP + 42, 330, 60, 10); x.fill(); x.strokeStyle = "#2f4458"; x.lineWidth = 2; x.stroke();
      x.textAlign = "left"; x.fillStyle = COL.ink; x.font = "700 20px ui-monospace, monospace"; x.fillText(ins.join(" + ") + " = " + bits(sum, 2) + "₂", 32, TOP + 68);
      var good = (S.v[outs[0]] === (sum & 1)) && (S.v[outs[1]] === (sum >> 1));
      x.font = "600 13px system-ui"; x.fillStyle = good ? COL.on : COL.x; x.fillText("Your " + outs[1] + " " + outs[0] + " = " + (S.v[outs[1]] === X ? "?" : S.v[outs[1]]) + (S.v[outs[0]] === X ? "?" : S.v[outs[0]]) + (good ? "  ✓ correct" : "  ✗"), 32, TOP + 90);
    } else if (L.seg) {
      var k = S.lev.A * 2 + S.lev.B;
      x.fillStyle = "rgba(10,20,30,.85)"; rr(x, 210, TOP + 40, 200, 74, 10); x.fill();
      x.fillStyle = COL.dim; x.font = "600 11px system-ui"; x.textAlign = "left"; x.fillText("VAULT CODE", 224, TOP + 58);
      L.seg.split("").forEach(function (d, j) { x.fillStyle = j === k ? COL.gold : "#55697a"; x.font = "700 22px ui-monospace, monospace"; x.fillText(d, 226 + j * 22, TOP + 90); });
      seg7(x, 370, TOP + 77, 1.6, function (l) { return S.v[l]; }, COL.on);
    }
  }
  function drawHero(api) {
    var x = api.x, h = S.h, c = hero(), t = api.t, sw = h.ground && Math.abs(h.vx) > 1 && !api.reduce ? Math.sin(h.walk / 9) * 7 : 0;
    var a = S.won ? Math.max(0, 1 - S.clearT * 1.2) : 1; if (a <= 0) return;
    x.save(); x.globalAlpha = a; x.translate(h.x, h.y);
    if (h.stun > 0 && !api.reduce) x.translate(Math.sin(t * 60) * 2, 0);
    x.strokeStyle = "#1b2430"; x.lineWidth = 5; x.lineCap = "round"; x.beginPath(); x.moveTo(-4, -14); x.lineTo(-4 + sw, 0); x.moveTo(4, -14); x.lineTo(4 - sw, 0); x.stroke();
    x.fillStyle = c.coat; rr(x, -11, -30, 22, 18, 5); x.fill();
    x.restore();
    A.drawHead(x, c, h.x, h.y - 40, 14, h.face, { mood: S.won ? "happy" : h.stun > 0 ? "sad" : undefined, blink: Math.sin(t * 1.3) > .985, hit: h.stun > 0 && !api.reduce });
    x.globalAlpha = 1;
  }
  function drawHud(api) {
    var x = api.x, L = S.L, g = LS.gates(L, S.a);
    x.fillStyle = "#07111a"; x.fillRect(0, 0, 960, 44);
    x.textAlign = "left"; x.fillStyle = "#fff"; x.font = "700 18px system-ui"; x.fillText((S.daily ? "" : (S.i + 1) + ". ") + L.name, 14, 21);
    x.fillStyle = "#9fdcff"; x.font = "12px system-ui"; x.fillText(L.course + " · " + L.concept, 14, 38);
    x.textAlign = "right"; x.font = "600 14px system-ui"; x.fillStyle = g > L.best ? COL.gold : COL.ink;
    if (S.socks.length) x.fillText("Gates " + g + " (best " + L.best + ")   ", 720, 27); x.fillStyle = S.moves > L.par + 2 ? COL.gold : COL.ink; x.fillText("Moves " + S.moves + " (par " + L.par + ")", 846, 27);
    [["?", 884, function (api) { hint(api); }], ["≡", 926, function (api) { map(api); }]].forEach(function (b) {
      x.fillStyle = "#16283a"; x.strokeStyle = "#4b6478"; x.lineWidth = 2; x.beginPath(); x.arc(b[1], 22, 17, 0, 7); x.fill(); x.stroke();
      x.fillStyle = COL.ink; x.font = "700 18px system-ui"; x.textAlign = "center"; x.fillText(b[0], b[1], 28); hit(b[1] - 20, 2, 40, 40, b[2]);
    });
  }
  function drawTips(api) {
    var x = api.x, msg = null, L = S.L;
    if (S.note && S.note.life > 0) msg = [S.note.t, "#ffe9a8"];
    else if (!save.tut && S.i === 0) msg = [!S.tutFlipped ? "Walk with A/D or ◀ ▶. Stand at a lever and press E (●) to flip it." : S.ok ? "The comparator reads 1, so the door opens. Walk into the glowing exit." : "Each lever is one bit. Which bits make 11?", COL.cyan];
    else if (!save.tutSock && S.socks.length && !L.kmap && L.mode === "table") msg = ["Tap a dashed socket (or press N, then 1–9 or G) to place a gate. Flip levers to test rows.", COL.cyan];
    if (!msg) return;
    x.font = "600 14px system-ui"; var w = Math.min(900, x.measureText(msg[0]).width + 30);
    x.globalAlpha = S.note && S.note.life > 0 ? Math.min(1, S.note.life) : 1;
    x.fillStyle = "rgba(4,12,18,.88)"; rr(x, 480 - w / 2, TOP + 6, w, 28, 8); x.fill(); x.fillStyle = msg[1]; x.textAlign = "center"; x.fillText(msg[0], 480, TOP + 25); x.globalAlpha = 1;
  }

  /* ---------- input ---------- */
  function goFlip(api, id) {
    var l = S.room.levers.filter(function (q) { return q.id === id; })[0]; if (!l || S.won) return;
    if (Math.abs(S.h.x - l.x) < 30 && Math.abs(S.h.y - FLOOR) < 4) flip(api, id); else { S.walkTo = l.x; S.flipAfter = id; }
  }
  function tapSock(api, n) {
    var k = S.socks.indexOf(n);
    if (S.sel !== k) { S.sel = k; S.pop = true; api.sound.sfx("click"); }
    else S.pop = !S.pop;
  }

  var game = {
    savePrefix: ["ee-arcade-logic"],
    song: A.song(300, "synthwave", { bpm: 112 }),
    actions: [
      { id: "left", label: "Walk left", keys: ["KeyA", "ArrowLeft"], touch: { label: "◀", x: 8, y: 88 } },
      { id: "right", label: "Walk right", keys: ["KeyD", "ArrowRight"], touch: { label: "▶", x: 24, y: 88 } },
      { id: "sock", label: "Next socket", keys: ["KeyN", "Tab"], touch: { label: "⇥", x: 42, y: 88 } },
      { id: "gate", label: "Change gate", keys: ["KeyG", "KeyF"], touch: { label: "⟳", x: 58, y: 88 } },
      { id: "use", label: "Flip lever", keys: ["KeyE", "ArrowDown"], touch: { label: "●", x: 76, y: 88 } },
      { id: "jump", label: "Jump", keys: ["KeyW", "ArrowUp", "Space"], touch: { label: "▲", x: 92, y: 88 } },
      { id: "clear", label: "Clear socket", keys: ["KeyX", "Backspace"] },
      { id: "hint", label: "Hint", keys: ["KeyH"] },
      { id: "map", label: "Level map", keys: ["KeyB"] }
    ],
    click: function (mx, my, api) {
      if (!S.L || api.overlayOpen() || S.won) return;
      for (var i = S.hits.length - 1; i >= 0; i--) { var b = S.hits[i]; if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) { b.fn(api, mx, my); return; } }
      S.pop = false;
    },
    init: function (api) {
      setupCheats(api);
      api.panel("<p>Every door, bridge, laser and lift in the labyrinth is driven by a real logic circuit, evaluated exactly as the theory says: 1 is high, 0 is low, and an empty socket floats (shown as ?).</p><table>" +
        "<tr><td>AND</td><td><span class='gm-eq'>A·B</span> is 1 only when both are 1</td></tr><tr><td>OR</td><td><span class='gm-eq'>A + B</span> is 1 when either is 1</td></tr>" +
        "<tr><td>NOT</td><td><span class='gm-eq'>Ā</span> inverts</td></tr><tr><td>XOR / XNOR</td><td><span class='gm-eq'>A ⊕ B</span> is 1 when they differ; XNOR when they match</td></tr>" +
        "<tr><td>NAND / NOR</td><td>AND / OR followed by NOT: each one alone is universal</td></tr><tr><td>De Morgan</td><td><span class='gm-eq'>(A·B)' = Ā + B̄</span>, <span class='gm-eq'>(A + B)' = Ā·B̄</span></td></tr>" +
        "<tr><td>Binary</td><td><span class='gm-eq'>N = Σ dᵢ 2ⁱ</span>; group 3 bits for octal, 4 for hex</td></tr><tr><td>Flip-flops</td><td>D: Q⁺ = D · T: Q⁺ = Q ⊕ T (on each clock edge)</td></tr></table>" +
        "<p style='font-size:13px'>Chapters follow EEEN 307 Digital Electronics (300 level) and EEEN 405 Digital Electronics II (400 level). Stars: fewest gates, moves within par + 2, and no revealed answer.</p>",
        "<table><tr><td>Walk / jump</td><td><kbd>A</kbd> <kbd>D</kbd> / <kbd>W</kbd> or <kbd>Space</kbd>, or tap the floor</td></tr><tr><td>Flip a lever</td><td>stand at it and press <kbd>E</kbd>, or tap it</td></tr>" +
        "<tr><td>Pick a socket</td><td>tap it, or <kbd>N</kbd></td></tr><tr><td>Place a gate</td><td>tap it in the pop-up, <kbd>1</kbd>–<kbd>9</kbd>, or <kbd>G</kbd> to cycle</td></tr><tr><td>Clear a socket</td><td><kbd>X</kbd></td></tr><tr><td>Hint</td><td><kbd>H</kbd> or the ? button</td></tr><tr><td>Level map</td><td><kbd>B</kbd> or ≡</td></tr></table>");
      if (api.settings && api.settings.add) {
        api.settings.add({ id: "ll_skipTaunts", tab: "gameplay", section: "Logic Labyrinth", label: "Skip Count Entropy's chapter speeches", type: "toggle", default: !!save.skipTaunts, apply: function (v) { save.skipTaunts = !!v; persist(); } });
        api.settings.add({ id: "ll_openAll", tab: "gameplay", section: "Logic Labyrinth", label: "Open every room (practice)", type: "toggle", default: !!save.all, help: "Lets you play rooms out of order. Stars still count.", apply: function (v) { save.all = !!v; persist(); } });
      }
      api.useActions(["left", "right", "sock", "gate", "use", "jump"]);
      title(api);
    },
    update: function (dt, api) {
      if (api.hero.inUse !== api.hero.active) api.hero.use(api.hero.active);
      if (S.note) { S.note.life -= dt; if (S.note.life <= 0) S.note = null; }
      if (S.taunt) S.taunt.life -= dt;
      if (!S.L || api.overlayOpen()) return;
      if (S.won) { S.clearT += dt; animate(api, dt); if (S.clearT > 1.7 && !S.shown) { S.shown = true; results(api); } return; }
      if (S.seq) seqTick(api, dt);
      if (S.L.boss && (S.tauntIn -= dt) <= 0) { S.tauntIn = 8 + Math.random() * 5; S.taunt = { t: TAUNT.boss[Math.floor(Math.random() * TAUNT.boss.length)], life: 2.6 }; }
      if (api.hit("hint")) { hint(api); return; }
      if (api.hit("map")) { map(api); return; }
      if (api.hit("use")) { var l = nearLever(); if (l) flip(api, l.id); }
      if (S.socks.length) {
        if (api.hit("sock")) { S.sel = (S.sel + 1) % S.socks.length; S.pop = !S.L.kmap; api.sound.sfx("click"); }
        if (api.hit("gate")) cycle(api, 1);
        if (api.hit("clear") && S.sel >= 0) edit(api, S.socks[S.sel].id, LS.options(S.L, S.socks[S.sel])[0]);
        var opts = S.sel >= 0 ? LS.options(S.L, S.socks[S.sel]) : [];
        for (var k = 0; k < 9; k++) if (api.hit("Digit" + (k + 1))) {
          if (S.L.kmap) { var nd = S.socks[k]; if (nd) { S.sel = k; edit(api, nd.id, S.a[nd.id] === "1" ? "0" : "1"); } }
          else if (opts[k] != null) { edit(api, S.socks[S.sel].id, opts[k]); S.pop = false; }
        }
      }
      physics(api, dt); animate(api, dt);
    },
    draw: function (api) {
      var x = api.x; S.hits = [];
      x.fillStyle = "#070d14"; x.fillRect(0, 0, 960, 540);
      if (!S.L) { var g = x.createLinearGradient(0, 0, 0, 540); g.addColorStop(0, "#0d1b2a"); g.addColorStop(1, "#060b12"); x.fillStyle = g; x.fillRect(0, 0, 960, 540);
        x.strokeStyle = "rgba(61,214,140,.25)"; x.lineWidth = 3; for (var k = 0; k < 7; k++) { x.beginPath(); x.moveTo(0, 90 + k * 60); x.lineTo(300 + k * 40, 90 + k * 60); x.lineTo(340 + k * 40, 120 + k * 60); x.lineTo(960, 120 + k * 60); x.stroke(); }
        drawGate(x, "NAND", 480, 250, 3, COL.cyan); return; }
      drawRoom(api); drawBoard(api); drawHud(api); drawTips(api);
    },
    menu: function (api) { map(api); }
  };
  A.run(game);
  window.LogicLabyrinth = { S: S, save: save, start: start, LEVELS: LEVELS, edit: edit, flip: flip };
})();
