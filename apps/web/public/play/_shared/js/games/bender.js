/* Light Bender: laser puzzles across seven chapters (PHYS 124, PHYS 162): plane mirrors, beam splitters, refraction in
 * water, glass and diamond, prisms and total internal reflection, thin lenses and colour filters. Ray tracing, the level
 * generator and the solver live in opticsim.js; the levels are in bender-levels.js (baked and re-proved by the tests).
 * Modes: the campaign (levels unlock in order), a daily puzzle the same for everyone, and a free optics lab. */
(function () {
  "use strict";
  var A = window.Arcade, O = window.OpticSim, LV = O.LEVELS;
  var S = { angs: [], sel: 0, moves: 0, lit: 0, hints: 0, mode: "menu" };
  var save = A.store("bender") || {}; save.stars = save.stars || {}; save.daily = save.daily || {}; save.opt = Object.assign({ labels: true, anim: true, cb: false, big: false }, save.opt || {});
  function persist() { A.store("bender", save); }
  var COL = { 1: "#ff5a5a", 2: "#4dff7a", 3: "#ffe45a", 4: "#5ab0ff", 5: "#ff6bf0", 6: "#5af0ff", 7: "#fff2f2" }, CNAME = { 1: "red", 2: "green", 3: "yellow", 4: "blue", 5: "magenta", 6: "cyan", 7: "white" }, CLET = { 1: "R", 2: "G", 3: "Y", 4: "B", 5: "M", 6: "C", 7: "W" };
  function today() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function heroOn(api) { return !!(api && api.hero && api.hero.active); }
  function unlocked(api, i) { return i === 0 || !!save.all || heroOn(api) || (save.stars[LV[i - 1].name] || 0) > 0 || (save.stars[LV[i].name] || 0) > 0; }
  function txt(api) { // text scale so the HUD stays readable on a phone (the 960-wide canvas shrinks to ~0.4)
    if (!S.cvW || api.t - (S.cvT || -9) > 1) { S.cvT = api.t; try { var c = document.querySelector("[data-gm-stage] canvas"); S.cvW = c ? c.getBoundingClientRect().width : 960; } catch (e) { S.cvW = 960; } }
    var k = Math.min(2.4, Math.max(1, 520 / Math.max(1, S.cvW))), ts = 1; try { ts = (api.settings && api.settings.get && api.settings.get("textScale")) || 1; } catch (e) {} return (save.opt.big ? k * 1.25 : k) * ts;
  }
  function par(L) { if (L.par == null) L.par = O.solve(L).par; return L.par; }
  function begin(api, L, i) { try { if (window.MIBPlay) MIBPlay.level(i + 1); } catch (mibErr) {} /* MIB-Hub: play tracking */
    S.i = i; S.L = L; S.mode = "play"; S.angs = L.mirrors.map(function (m) { return m.ang; }); S.rot = O.rotIdx(L); S.sel = S.rot[0] || 0; S.moves = 0; S.lit = 0; S.done = false; S.hints = 0; S.tr = O.trace(L, S.angs);
    api.useActions(["ccw", "cw", "next", "hint", "map"]);
    var n = i == null ? 77 : i, boss = !!L.boss; api.music(A.song(500 + n * 11, boss ? "boss" : ["calm", "dub", "synthwave"][n % 3], { bpm: boss ? 128 : 88 + (n % 8) * 4 }));
  }
  function start(api, i) {
    if (!unlocked(api, i)) { api.sound.sfx("block"); return; }
    var L = LV[i]; begin(api, L, i);
    var ch = O.CHAPTERS[L.ch], firstOfCh = i === 0 || LV[i - 1].ch !== L.ch;
    api.show("<h2>" + (i + 1) + ". " + A.esc(L.name) + "</h2><p class='gm-small'>" + A.esc(ch.name) + " · " + A.esc(L.course) + "</p>" + (firstOfCh ? "<p><b>New:</b> " + A.esc(ch.tip) + "</p>" : "") + "<p>" + A.esc(L.hint) + "</p>" +
      "<p class='gm-small'>Tap a mirror to select it, tap again (or E) to turn it 15°. Q turns the other way, N picks the next mirror, H gives a hint. Par: " + par(L) + " turns.</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='ok'>Aim the laser</button></div>", function () { api.hide(); });
  }
  function startDaily(api) {
    var d = today(), L = S.dailyCache && S.dailyCache.d === d ? S.dailyCache.L : O.daily(d); S.dailyCache = { d: d, L: L };
    if (!L) { api.sound.sfx("block"); return; }
    begin(api, L, null); S.mode = "daily";
    api.show("<h2>Daily beam · " + d + "</h2><p>Everyone gets the same puzzle today. Par: " + par(L) + " turns." + (save.daily[d] ? " Your best today: " + "★".repeat(save.daily[d]) + "." : "") + "</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='ok'>Go</button></div>", function () { api.hide(); });
  }
  /* cheats and the maker's hidden character: only hashes of the codes are shipped */
  var CH = /*CH[*/{"skip":["d62092392f17b281667588cf0c3530ef66ef41b9b46a86af4748deed77302212","20afe04be1680ed30fadebc01374443b443d44f851486df33cec859a1a94ff2f"],"solve":["32cf1e91b3b4b5e329a468b14334b931745c5f7be48d24b193a611e9e76f7204","5a8b81a780a63966fd8e2bb708d968b8aa8eb8f826557d858968b9bcbe9f6450"],"moves":["73a38db1a1aff9105e2852139261f15097d3f07c9dbbe42e558530ec19c2f60e","cbbd14090249acb86481033bd1e18612471bb86e6170189561411311a38c7f54"],"stars":["d0302d90a9b47fcd0d12b3a3df6cc980c0b37493f4acbb76832d88c4bca9a11f","4e45b88f79987b385a907b6906a7addffabe383b8715707f7a18ac6d36583f18"],"last":["af04894fc7425596ddf21514ddf9f68427b2503fb4c4e18bdb2dd9523f5adc28","9d539f463a2649d6c831c3a5921912793c2512a0437174767765a689696fe8bd"],"slow":["3bd7f9b9344683e0669f41d3f364f39d10a4495e867d39766d9206422e2db962","f20186ef255da234850c7231811675dbece616fa8361b6fed1a6302af5495669"],"party":["289c8593b53426271ddea6430531b84d9bf1149dab2bad5d702e4adc487420e2","66f7bd1f00c956783740650ced3806bb18e1eab4b5c6cfb22df632bc01cf3cfc"],"_combo":"787da0e99dd41846749d26c70e76274bdba3b1ca22af3d591b0ddf177fcb63ee","_swipe":"ece6032cf0821547d13d88528b24719f771802a2135c433f5fefffec7a5bb2c6"}/*]CH*/;
  function solveNow() { var n = O.nearest(S.L, S.angs); if (n) { S.angs = n.angs; S.tr = O.trace(S.L, S.angs); } return !!n; }
  function setupCheats(api) {
    api.cheats({
      skip: { label: "Solve and finish this level", h: CH.skip, run: function () { if (S.L && !S.done && S.mode !== "lab" && solveNow()) win(api); } },
      solve: { label: "Show the solution", h: CH.solve, run: function () { if (S.L && !S.done && S.mode !== "lab") solveNow(); } },
      moves: { label: "Turn counter reset", h: CH.moves, run: function () { S.moves = 0; S.hints = 0; } },
      stars: { label: "Three stars for this level", h: CH.stars, run: function () { if (S.L && S.mode === "play") { save.stars[S.L.name] = 3; persist(); } } },
      last: { label: "Open every level and jump to the last", h: CH.last, run: function () { save.all = true; persist(); start(api, LV.length - 1); } },
      slow: { label: "Slow motion", h: CH.slow, run: function () { api.slowmo(.5, 20); } },
      party: { label: "Confetti storm", h: CH.party, run: function () { api.confetti(400); api.sound.roar(false); } }
    });
    api.secret({ combo: CH._combo, swipe: CH._swipe, onReveal: function () { map(api); } });
  }
  function turn(api, dir) {
    if (S.done) return;
    if (S.mode === "lab") { var it = S.lab.sel; if (!it || it.ang == null) return; it.ang = ((it.ang + dir * 15) % 360 + 360) % 360; if (it.kind === "mirror" || it.kind === "split") it.ang %= 180; labTrace(); api.sound.sfx("click"); return; }
    if (!S.L || S.L.mirrors[S.sel].rot === false) return;
    S.angs[S.sel] = ((S.angs[S.sel] + dir * 15) % 180 + 180) % 180; S.moves++; S.tr = O.trace(S.L, S.angs); api.sound.sfx("click"); S.tutTurned = true;
  }
  function nextSel() { if (S.mode === "lab") { var it = S.lab.items, k = it.indexOf(S.lab.sel); S.lab.sel = it[(k + 1) % it.length] || null; return; } var r = S.rot, k2 = r.indexOf(S.sel); S.sel = r[(k2 + 1) % r.length]; }
  function note(t, life) { S.note = { t: t, life: life || 4 }; }
  /* progressive hints: 1 the idea, 2 which mirror is wrong and by how much, 3 turn it for you (one star at most) */
  function hint(api) {
    if (S.mode === "lab" || S.done || !S.L) return; var L = S.L; S.hints = Math.min(3, S.hints + 1);
    if (S.hints === 1) { note("Hint 1: " + L.hint, 6); api.sound.sfx("click"); return; }
    var n = O.nearest(L, S.angs); if (!n) return;
    var wrong = S.rot.filter(function (i) { return O.angDist(n.angs[i], S.angs[i]) > 0; });
    if (!wrong.length) { note("Every mirror is already right.", 4); return; }
    var i = wrong[0], dd = ((n.angs[i] - S.angs[i]) % 180 + 180) % 180, steps = dd <= 90 ? dd / 15 : (180 - dd) / 15, dir = dd <= 90 ? "clockwise (E)" : "anticlockwise (Q)";
    S.sel = i;
    if (S.hints === 2) note("Hint 2: the glowing mirror needs " + steps + " turn" + (steps === 1 ? "" : "s") + " " + dir + "." + (wrong.length > 1 ? " " + (wrong.length - 1) + " more mirror" + (wrong.length === 2 ? "" : "s") + " to fix after that." : ""), 7);
    else { S.angs[i] = n.angs[i]; S.moves += steps; S.tr = O.trace(L, S.angs); note("Hint 3: I turned that mirror for you. This attempt can earn one star.", 6); }
    api.sound.sfx("click");
  }
  function explain(tr) {
    var seen = {}, out = [];
    tr.events.forEach(function (e) {
      var s = e.kind === "reflect" ? "Reflection: i = r = " + e.inc.toFixed(0) + "°" : e.kind === "split" ? "Beam splitter: one beam reflects (i = r = " + e.inc.toFixed(0) + "°), one passes straight on" :
        e.kind === "tir" ? "Total internal reflection at " + e.inc.toFixed(1) + "° (critical angle " + (Math.asin(1 / e.n) * 180 / Math.PI).toFixed(1) + "° for n = " + e.n + ")" :
        e.kind === "enter" ? "Into n = " + e.n + ": " + e.inc.toFixed(1) + "° → " + e.ref.toFixed(1) + "°" : e.kind === "leave" ? "Out of n = " + e.n + ": " + e.inc.toFixed(1) + "° → " + e.ref.toFixed(1) + "°" :
        e.kind === "lens" ? (e.f > 0 ? "Converging" : "Diverging") + " lens, f = " + Math.abs(e.f) + " px: hit " + Math.abs(e.h).toFixed(0) + " px off centre" : e.kind === "filter" ? CNAME[e.from] + " light through a filter → " + (CNAME[e.to] || "blocked") : null;
      if (s && !seen[s] && out.length < 9) { seen[s] = 1; out.push(s); }
    });
    return out;
  }
  function win(api) {
    S.done = true; var L = S.L, p = par(L), stars = S.hints >= 3 ? 1 : S.moves <= p ? 3 : S.moves <= p + 3 ? 2 : 1, i = S.i, daily = S.mode === "daily";
    if (daily) save.daily[L.daily] = Math.max(save.daily[L.daily] || 0, stars); else save.stars[L.name] = Math.max(save.stars[L.name] || 0, stars);
    save.tut = true; persist();
    api.sound.sfx("power"); L.targets.forEach(function (tg) { api.burst(tg.x, tg.y, tg.col ? COL[tg.col] : "#ffd86b", 24, 320); }); api.zoom(.08, L.targets[0].x, L.targets[0].y);
    A.report("light-bender", daily ? { result: "win", stage: 1, score: stars * 100 } : { result: "win", stage: i + 1, score: stars * 100 + Math.max(0, 50 - S.moves) });
    var next = !daily && i + 1 < LV.length, ev = explain(S.tr), chEnd = !daily && next && LV[i + 1].ch !== L.ch, final = !daily && !next;
    var has = function (k) { return S.tr.events.some(function (e) { return e.kind === k; }); };
    var lesson = has("tir") ? "Optical fibres carry internet traffic exactly this way: light stays trapped by total internal reflection." : has("lens") ? "Cameras, spectacles and microscopes all use the thin-lens rule 1/f = 1/u + 1/v." :
      has("filter") ? "Stage lights and camera sensors use colour filters: each passes only part of white light." : has("enter") ? "Snell's law n₁ sin θ₁ = n₂ sin θ₂ explains lenses, prisms and why a pool looks shallower than it is." : "Periscopes, solar concentrators and laser alignment rigs all rely on the law of reflection.";
    api.ceremony(final ? "gameComplete" : "stageClear", { title: daily ? "DAILY BEAM!" : final ? "ALL RECEIVERS LIT!" : chEnd ? "CHAPTER CLEAR!" : "LIT!", sub: daily ? L.daily : (i + 1) + ". " + L.name, trophy: final ? "crown" : chEnd ? "medal" : "star", colors: ["#ffd86b", "#ff6b6b", "#7ef0ff", "#ffffff"], stars: stars, len: final ? 5 : chEnd ? 3.4 : 2.6,
      score: stars * 100 + Math.max(0, 50 - S.moves), stats: [["Turns", S.moves], ["Par", p], ["Hints", S.hints]], line: stars === 3 ? "Perfect: within par." : "Solved in " + S.moves + " turns. Par is " + p + ".",
      then: function () { api.show("<h2>" + "★".repeat(stars) + "☆".repeat(3 - stars) + " Receiver" + (L.targets.length > 1 ? "s" : "") + " powered</h2><p>" + S.moves + " turn" + (S.moves === 1 ? "" : "s") + " (par " + p + ")" + (S.hints ? " · " + S.hints + " hint" + (S.hints > 1 ? "s" : "") : "") + ". The beam's journey:</p><p class='gm-formula' style='white-space:normal;text-align:left'>" + ev.map(A.esc).join("<br>") + "</p><p>" + lesson + "</p>" +
        (chEnd ? "<p><b>Chapter complete: " + A.esc(O.CHAPTERS[L.ch].name) + ".</b> Next: " + A.esc(O.CHAPTERS[LV[i + 1].ch].name) + ".</p>" : "") + (final ? "<p><b>Count Entropy's hall of mirrors is beaten. Every receiver is lit.</b></p>" : "") +
        "<div class='gm-actions'>" + (next ? "<button class='gm-btn gm-btn--go' data-act='next'>Next level</button>" : "") + "<button class='gm-btn' data-act='retry'>Replay</button><button class='gm-btn' data-act='map'>Levels</button></div>",
        function (a) { if (a === "next") start(api, i + 1); else if (a === "retry") { if (daily) startDaily(api); else start(api, i); } else map(api); }); } });
  }
  function options(api) {
    var o = save.opt, row = function (k, label) { return "<label style='display:flex;gap:10px;align-items:center;margin:10px 0;min-height:44px'><input type='checkbox' data-o='" + k + "'" + (o[k] ? " checked" : "") + " style='width:24px;height:24px'> " + label + "</label>"; };
    api.show("<h2>Light Bender options</h2><div style='text-align:left;max-width:480px;margin:0 auto'>" + row("labels", "Show angles on the beam") + row("anim", "Animated beam") + row("cb", "Colour letters on filters and receivers (colour-blind help)") + row("big", "Larger text") + "</div>" +
      "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='done'>Done</button><button class='gm-btn' data-act='reset'>Reset progress</button></div>", function (a) {
        if (a === "reset") { if (window.confirm && !window.confirm("Clear all Light Bender stars?")) return; save.stars = {}; save.daily = {}; save.all = false; persist(); return map(api); }
        [].forEach.call(document.querySelectorAll("[data-o]"), function (el) { o[el.getAttribute("data-o")] = el.checked; }); persist(); map(api); });
  }
  function map(api) {
    S.mode = "menu"; S.L = null; S.tr = null;
    var total = 0; LV.forEach(function (L) { total += save.stars[L.name] || 0; });
    var html = "<h2>Light Bender</h2><p>Count Entropy smashed the solar receivers and scattered the optics. Guide the laser home; every angle is calculated for real. <b>★ " + total + " / " + LV.length * 3 + "</b></p>" +
      "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='daily'>Daily beam" + (save.daily[today()] ? " " + "★".repeat(save.daily[today()]) : "") + "</button><button class='gm-btn' data-act='lab'>Free optics lab</button><button class='gm-btn' data-act='opt'>Options</button></div>";
    O.CHAPTERS.forEach(function (c, ci) {
      var idx = []; LV.forEach(function (L, i) { if (L.ch === ci) idx.push(i); });
      html += "<div style='margin-top:10px;text-align:left'><b>" + (ci + 1) + ". " + A.esc(c.name) + "</b> <span class='gm-small'>" + A.esc(c.course) + "</span><div class='gm-actions' style='justify-content:flex-start;margin-top:4px'>" +
        idx.map(function (i) { var L = LV[i], st = save.stars[L.name] || 0, open = unlocked(api, i); return "<button class='gm-btn" + (st || !open ? "" : " gm-btn--go") + "' data-act='lv' data-i='" + i + "'" + (open ? "" : " disabled aria-disabled='true'") + " style='min-width:44px;min-height:44px'>" + (open ? (i + 1) + ". " + A.esc(L.name) + (st ? " " + "★".repeat(st) : "") : "🔒 " + (i + 1)) + "</button>"; }).join("") + "</div></div>";
    });
    api.show(html, function (a, el) { if (a === "lv") start(api, +el.getAttribute("data-i")); else if (a === "daily") startDaily(api); else if (a === "lab") lab(api); else if (a === "opt") options(api); });
  }
  /* ---------- free optics lab: drag anything, turn it, add or remove pieces ---------- */
  var PAL = [["mirror", "Mirror"], ["split", "Splitter"], ["glass", "Glass"], ["prism", "Prism"], ["lens+", "Lens +"], ["lens-", "Lens −"], ["fR", "Red gel"], ["fG", "Green gel"], ["fB", "Blue gel"], ["target", "Receiver"], ["del", "Remove"], ["exit", "Exit"]];
  function lab(api) {
    S.mode = "lab"; S.L = null; S.done = false; api.hide(); api.useActions(["ccw", "cw", "next", "map"]);
    if (!S.lab) S.lab = { items: [{ kind: "mirror", x: 360, y: 270, ang: 45 }, { kind: "glass", x: 560, y: 160, w: 160, h: 100, n: 1.5 }, { kind: "target", x: 820, y: 120 }], sel: null };
    labTrace(); note("Free lab: drag pieces, tap one to select it, Q/E or tap again to turn it. Add pieces from the bar below.", 6);
  }
  function labLevel() {
    var L = { src: { x: 46, y: 270, ang: 0, col: 7 }, mirrors: [], blocks: [], prisms: [], lenses: [], filters: [], targets: [], walls: [] };
    S.lab.items.forEach(function (it) {
      if (it.kind === "mirror" || it.kind === "split") { var m = { x: it.x, y: it.y, len: 80, ang: it.ang }; if (it.kind === "split") m.type = "split"; L.mirrors.push(m); }
      else if (it.kind === "glass") L.blocks.push({ x: it.x - it.w / 2, y: it.y - it.h / 2, w: it.w, h: it.h, n: it.n });
      else if (it.kind === "prism") { var s = 120, a = O.rad(it.ang); L.prisms.push({ n: 1.5, pts: [[-.33, -.33], [.67, -.33], [-.33, .67]].map(function (q) { var x0 = q[0] * s, y0 = q[1] * s; return [it.x + x0 * Math.cos(a) - y0 * Math.sin(a), it.y + x0 * Math.sin(a) + y0 * Math.cos(a)]; }) }); }
      else if (it.kind === "lens") L.lenses.push({ x: it.x, y: it.y, len: 96, ang: it.ang, f: it.f });
      else if (it.kind === "filter") L.filters.push({ x: it.x, y: it.y, len: 70, ang: it.ang, col: it.col });
      else if (it.kind === "target") L.targets.push({ x: it.x, y: it.y, r: 24 });
    });
    return L;
  }
  function labTrace() { S.labL = labLevel(); S.tr = O.trace(S.labL); }
  function labAdd(api, k) {
    var it = k === "mirror" || k === "split" ? { kind: k, ang: 45 } : k === "glass" ? { kind: "glass", w: 150, h: 100, n: 1.5 } : k === "prism" ? { kind: "prism", ang: 0 } : k === "lens+" ? { kind: "lens", ang: 90, f: 160 } : k === "lens-" ? { kind: "lens", ang: 90, f: -160 } :
      k[0] === "f" ? { kind: "filter", ang: 90, col: { fR: 1, fG: 2, fB: 4 }[k] } : { kind: "target" };
    it.x = 420 + (S.lab.items.length % 5) * 40; it.y = 200 + (S.lab.items.length % 4) * 30; S.lab.items.push(it); S.lab.sel = it; labTrace(); api.sound.sfx("click");
  }
  function palRect(k) { var w = 76, gap = 4, x0 = 480 - (PAL.length * (w + gap) - gap) / 2; return { x: x0 + k * (w + gap), y: 492, w: w, h: 44 }; }
  function labClick(api, mx, my, e) {
    for (var k = 0; k < PAL.length; k++) { var r = palRect(k); if (mx > r.x && mx < r.x + r.w && my > r.y && my < r.y + r.h) {
      var id = PAL[k][0]; if (id === "exit") return map(api); if (id === "del") { if (S.lab.sel) { S.lab.items.splice(S.lab.items.indexOf(S.lab.sel), 1); S.lab.sel = null; labTrace(); } return; } return labAdd(api, id); } }
    var hit = null, bd = 70; S.lab.items.forEach(function (it) { var d = Math.hypot(it.x - mx, it.y - my); if (d < bd) { bd = d; hit = it; } });
    if (!hit) { S.lab.sel = null; return; }
    var was = S.lab.sel === hit; S.lab.sel = hit; if (!was) api.sound.sfx("click");
    if (!e || e.clientX == null) { if (was) turn(api, 1); return; }
    // drag with the pointer, converting screen movement to board units; a tap on the selected piece turns it
    var el = e.target && e.target.getBoundingClientRect ? e.target : null, rect = el ? el.getBoundingClientRect() : { width: 960, height: 540 }, sc = 1 / Math.max(.05, Math.min(rect.width / 960, rect.height / 540)), x0 = e.clientX, y0 = e.clientY, ix = hit.x, iy = hit.y, moved = 0;
    var mv = function (ev) { var dx = (ev.clientX - x0) * sc, dy = (ev.clientY - y0) * sc; moved = Math.max(moved, Math.abs(dx) + Math.abs(dy)); hit.x = Math.round(Math.max(60, Math.min(900, ix + dx))); hit.y = Math.round(Math.max(40, Math.min(470, iy + dy))); labTrace(); };
    var up = function () { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); if (moved < 6 && was) turn(api, 1); };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  }
  /* ---------- drawing ---------- */
  function wrap(x, s, w, fs) { x.font = "600 " + fs + "px system-ui"; var words = String(s).split(" "), out = [], cur = ""; words.forEach(function (wd) { var t2 = cur ? cur + " " + wd : wd; if (x.measureText(t2).width > w && cur) { out.push(cur); cur = wd; } else cur = t2; }); if (cur) out.push(cur); return out.slice(0, 5); }
  function draw(api) {
    var x = api.x, t = api.t, L = S.mode === "lab" ? S.labL : S.L, k = txt(api);
    var g = x.createRadialGradient(480, 270, 50, 480, 270, 620); g.addColorStop(0, "#14202c"); g.addColorStop(1, "#070c12"); x.fillStyle = g; x.fillRect(0, 0, 960, 540);
    if (!L) return;
    (L.walls || []).forEach(function (w) { x.fillStyle = "#2a3340"; x.fillRect(w.x, w.y, w.w, w.h); x.save(); x.beginPath(); x.rect(w.x, w.y, w.w, w.h); x.clip(); x.strokeStyle = "#3b4757"; x.lineWidth = 2; for (var q = -w.h; q < w.w; q += 14) { x.beginPath(); x.moveTo(w.x + q, w.y + w.h); x.lineTo(w.x + q + w.h, w.y); x.stroke(); } x.restore(); });
    O.glassList(L).forEach(function (gl) { var tint = gl.n > 2 ? "rgba(220,240,255,.22)" : gl.n < 1.4 ? "rgba(90,160,255,.18)" : "rgba(126,220,255,.16)";
      x.fillStyle = tint; x.strokeStyle = "rgba(160,230,255,.75)"; x.lineWidth = 2; x.beginPath(); gl.pts.forEach(function (p, j) { if (j) x.lineTo(p[0], p[1]); else x.moveTo(p[0], p[1]); }); x.closePath(); x.fill(); x.stroke();
      var cx = gl.pts.reduce(function (s, p) { return s + p[0]; }, 0) / gl.pts.length, cy = gl.pts.reduce(function (s, p) { return s + p[1]; }, 0) / gl.pts.length;
      x.fillStyle = "rgba(210,240,255,.85)"; x.font = "600 " + Math.round(12 * k) + "px system-ui"; x.textAlign = "center"; x.fillText((gl.n > 2 ? "diamond" : gl.n < 1.4 ? "water" : "glass") + " n=" + gl.n, cx, cy + 4); });
    (L.lenses || []).forEach(function (ln) { var e = O.ends(ln), a = O.rad(ln.ang), nx = -Math.sin(a), ny = Math.cos(a), b = (ln.f > 0 ? 1 : -1) * 22;
      x.fillStyle = "rgba(170,230,255,.28)"; x.strokeStyle = "#bfeaff"; x.lineWidth = 2; x.beginPath();
      if (ln.f > 0) { x.moveTo(e[0], e[1]); x.quadraticCurveTo(ln.x + nx * b, ln.y + ny * b, e[2], e[3]); x.quadraticCurveTo(ln.x - nx * b, ln.y - ny * b, e[0], e[1]); }
      else { var w2 = 12; x.moveTo(e[0] + nx * w2, e[1] + ny * w2); x.quadraticCurveTo(ln.x + nx * 2, ln.y + ny * 2, e[2] + nx * w2, e[3] + ny * w2); x.lineTo(e[2] - nx * w2, e[3] - ny * w2); x.quadraticCurveTo(ln.x - nx * 2, ln.y - ny * 2, e[0] - nx * w2, e[1] - ny * w2); x.closePath(); }
      x.fill(); x.stroke();
      [1, -1].forEach(function (s) { x.fillStyle = "rgba(191,234,255,.7)"; x.beginPath(); x.arc(ln.x + nx * Math.abs(ln.f) * s, ln.y + ny * Math.abs(ln.f) * s, 3, 0, 7); x.fill(); });
      x.fillStyle = "#bfeaff"; x.font = Math.round(11 * k) + "px system-ui"; x.textAlign = "center"; x.fillText("f = " + (ln.f > 0 ? "+" : "−") + Math.abs(ln.f), ln.x, ln.y - ln.len / 2 - 10); });
    (L.filters || []).forEach(function (f) { var e = O.ends(f); x.strokeStyle = COL[f.col]; x.globalAlpha = .8; x.lineWidth = 10; x.beginPath(); x.moveTo(e[0], e[1]); x.lineTo(e[2], e[3]); x.stroke(); x.globalAlpha = 1;
      if (save.opt.cb) { x.fillStyle = "#000"; x.font = "800 " + Math.round(12 * k) + "px system-ui"; x.textAlign = "center"; x.fillText(CLET[f.col], f.x, f.y + 4); } });
    L.targets.forEach(function (tg, ti) { var on = S.tr && S.tr.hit[ti], c = tg.col ? COL[tg.col] : "#ffd86b"; var rg = x.createRadialGradient(tg.x, tg.y, 2, tg.x, tg.y, tg.r * 2.4); rg.addColorStop(0, on ? c : "rgba(255,220,110,.12)"); rg.addColorStop(1, "rgba(0,0,0,0)"); x.globalAlpha = on ? .8 : 1; x.fillStyle = rg; x.fillRect(tg.x - tg.r * 2.4, tg.y - tg.r * 2.4, tg.r * 4.8, tg.r * 4.8); x.globalAlpha = 1;
      x.fillStyle = on ? c : "#23201a"; x.strokeStyle = c; x.lineWidth = 3; x.beginPath(); x.arc(tg.x, tg.y, tg.r, 0, 7); x.fill(); x.stroke();
      if (tg.col) { x.fillStyle = on ? "#111" : c; x.font = "800 " + Math.round(12 * k) + "px system-ui"; x.textAlign = "center"; x.fillText(save.opt.cb ? CLET[tg.col] : "●", tg.x, tg.y + 4); } });
    if (S.tr) { x.lineCap = "round"; var whiteBeam = !!L.src.col; S.tr.segs.forEach(function (s) { var c = s[4] === 7 || !s[4] ? (whiteBeam ? "#f4f7ff" : null) : COL[s[4]]; [[10, .18], [5, .45], [2, 1]].forEach(function (st) { x.globalAlpha = st[1]; x.strokeStyle = c || (st[0] === 2 ? "#ffd0d0" : "#ff5050"); x.lineWidth = st[0]; x.beginPath(); x.moveTo(s[0], s[1]); x.lineTo(s[2], s[3]); x.stroke(); }); x.globalAlpha = 1; });
      if (!api.reduce && save.opt.anim) { x.fillStyle = "#fff"; S.tr.segs.forEach(function (s) { var l = Math.hypot(s[2] - s[0], s[3] - s[1]); for (var d = (t * 220) % 40; d < l; d += 40) { x.beginPath(); x.arc(s[0] + (s[2] - s[0]) * d / l, s[1] + (s[3] - s[1]) * d / l, 2, 0, 7); x.fill(); } }); }
      if (save.opt.labels) S.tr.events.slice(0, 14).forEach(function (e) { var s = e.kind === "reflect" || e.kind === "split" ? "i=r=" + e.inc.toFixed(0) + "°" : e.kind === "tir" ? "TIR " + e.inc.toFixed(0) + "°" : e.kind === "enter" || e.kind === "leave" ? e.inc.toFixed(0) + "°→" + e.ref.toFixed(0) + "°" : e.kind === "wrong" ? "wrong colour" : null; if (!s) return;
        x.fillStyle = e.kind === "tir" ? "#7ef0ff" : e.kind === "wrong" ? "#ff8a8a" : "#fff"; x.font = "600 " + Math.round(11 * k) + "px ui-monospace, monospace"; x.textAlign = "left"; x.fillText(s, e.x + 8, e.y - 8); }); }
    x.save(); x.translate(L.src.x, L.src.y); x.rotate(O.rad(L.src.ang)); x.fillStyle = "#3a3f4a"; x.fillRect(-46, -14, 46, 28); x.fillStyle = L.src.col ? "#fff" : "#ff4d4d"; x.fillRect(-6, -5, 8, 10); x.restore();
    var lab = S.mode === "lab", labSel = lab && S.lab.sel;
    L.mirrors.forEach(function (m, i) {
      var ang = lab ? m.ang : S.angs[i], a = O.rad(ang), h = m.len / 2, cx = Math.cos(a) * h, cy = Math.sin(a) * h, sel = !lab && i === S.sel, fixed = m.rot === false;
      if (sel) { x.strokeStyle = "rgba(126,240,255," + (api.reduce ? .5 : .35 + .25 * Math.sin(t * 6)) + ")"; x.lineWidth = 3; x.beginPath(); x.arc(m.x, m.y, h + 12, 0, 7); x.stroke(); }
      x.strokeStyle = fixed ? "#3d4652" : "#5c6b7a"; x.lineWidth = 9; x.lineCap = "butt"; x.beginPath(); x.moveTo(m.x - cx, m.y - cy); x.lineTo(m.x + cx, m.y + cy); x.stroke();
      if (m.type === "split") { x.setLineDash([7, 5]); x.strokeStyle = "#cfe8ff"; x.lineWidth = 4; x.beginPath(); x.moveTo(m.x - cx, m.y - cy); x.lineTo(m.x + cx, m.y + cy); x.stroke(); x.setLineDash([]); }
      else { x.strokeStyle = "#e9f6ff"; x.lineWidth = 4; x.beginPath(); x.moveTo(m.x - cx, m.y - cy); x.lineTo(m.x + cx, m.y + cy); x.stroke(); }
      if (!lab) { x.fillStyle = sel ? "#7ef0ff" : "#9aa8b5"; x.font = "600 " + Math.round(11 * k) + "px system-ui"; x.textAlign = "center"; x.fillText(ang + "°", m.x, m.y + h + 18 + 6 * k); }
    });
    if (labSel) { x.strokeStyle = "#7ef0ff"; x.lineWidth = 2; x.setLineDash([5, 4]); x.beginPath(); x.arc(labSel.x, labSel.y, 60, 0, 7); x.stroke(); x.setLineDash([]); }
    x.textAlign = "left";
    var hy = 26 * Math.min(k, 1.5);
    if (lab) {
      PAL.forEach(function (p, j) { var r = palRect(j); x.fillStyle = p[0] === "exit" ? "#4a1f1f" : "#1d2a38"; x.fillRect(r.x, r.y, r.w, r.h); x.strokeStyle = "#47617a"; x.strokeRect(r.x, r.y, r.w, r.h); x.fillStyle = "#e6f3ff"; x.font = "600 " + Math.round(12 * Math.min(k, 1.25)) + "px system-ui"; x.textAlign = "center"; x.fillText(p[1], r.x + r.w / 2, r.y + 27); });
      x.textAlign = "left"; x.fillStyle = "#fff"; x.font = "700 " + Math.round(16 * k) + "px system-ui"; x.fillText("Free optics lab", 16, hy);
    } else {
      x.fillStyle = "#fff"; x.font = "700 " + Math.round(16 * k) + "px system-ui"; x.fillText((S.mode === "daily" ? "Daily · " : (S.i + 1) + ". ") + S.L.name, 16, hy);
      x.fillStyle = "#9fdcff"; x.font = Math.round(13 * k) + "px system-ui"; x.fillText("Turns " + S.moves + " · par " + par(S.L) + (S.hints ? " · hints " + S.hints : ""), 16, hy + 18 * k);
    }
    if (!save.tut && !S.tutTurned && S.mode === "play") { var th = 34 * Math.min(k, 1.6); x.fillStyle = "rgba(4,12,18,.8)"; x.fillRect(330, 540 - th - 4, 620, th); x.fillStyle = "#7ef0ff"; x.textAlign = "center"; x.font = "600 " + Math.round(13 * k) + "px system-ui"; x.fillText("Tap the glowing mirror (or press E) to turn it 15°.", 640, 540 - th / 2 + 1); }
    if (S.note && S.note.life > 0) { var fs = Math.round(13 * k), lines = wrap(x, S.note.t, 720, fs); x.fillStyle = "rgba(4,12,18,.92)"; var hgt = lines.length * fs * 1.35 + 14, y0 = (lab ? 486 : 532) - hgt; x.fillRect(100, y0, 760, hgt); x.fillStyle = "#ffe9a8"; x.textAlign = "center"; x.font = "600 " + fs + "px system-ui"; lines.forEach(function (ln, j) { x.fillText(ln, 480, y0 + 7 + fs + j * fs * 1.35); }); }
  }
  var game = { savePrefix: ["ee-arcade-bender"], song: A.song(499, "calm"), menu: function (api) { map(api); },
    actions: [{ id: "ccw", label: "Turn anticlockwise", keys: ["KeyQ", "ArrowLeft"], touch: { label: "⟲", x: 8, y: 84 } }, { id: "cw", label: "Turn clockwise", keys: ["KeyE", "ArrowRight"], touch: { label: "⟳", x: 21, y: 84 } },
      { id: "next", label: "Next mirror", keys: ["KeyN", "Tab"], touch: { label: "⇥", x: 34, y: 84 } }, { id: "hint", label: "Hint", keys: ["KeyH"], touch: { label: "?", x: 80, y: 84 } }, { id: "map", label: "Levels", keys: ["KeyB"], touch: { label: "▦", x: 92, y: 84 } }],
    click: function (mx, my, api, e) {
      if (api.overlayOpen()) return;
      if (S.mode === "lab") return labClick(api, mx, my, e);
      if (!S.L || S.done) return;
      var best = -1, bd = Infinity; S.L.mirrors.forEach(function (m, i) { if (m.rot === false) return; var d = Math.hypot(mx - m.x, my - m.y); if (d < m.len / 2 + 22 && d < bd) { bd = d; best = i; } });
      if (best >= 0) { if (S.sel === best) turn(api, 1); else { S.sel = best; api.sound.sfx("click"); } }
    },
    init: function (api) {
      setupCheats(api);
      api.panel("<p>The laser follows the real laws of optics, recalculated every time you turn a mirror.</p><table><tr><td>Reflection</td><td><span class='gm-eq'>i = r</span> (from the normal)</td></tr><tr><td>Turning a mirror by θ</td><td>turns the reflected beam by <span class='gm-eq'>2θ</span></td></tr><tr><td>Snell's law</td><td><span class='gm-eq'>n₁ sin θ₁ = n₂ sin θ₂</span></td></tr><tr><td>Critical angle</td><td><span class='gm-eq'>sin θc = 1/n</span>: 41.8° glass, 48.8° water, 24.4° diamond</td></tr><tr><td>Thin lens</td><td>slope changes by <span class='gm-eq'>−h/f</span>; parallel rays meet at the focus</td></tr><tr><td>Filters</td><td>pass only the colours they share with the beam</td></tr></table><p class='gm-small'>Model: thin ideal mirrors silvered on both sides, ideal 50/50 splitters, glass with no absorption or partial reflection, ideal thin lenses (paraxial rule applied at every height), a perfectly narrow beam, mirrors turn in 15° steps. Course: PHYS 124 reflection, lenses and colour; PHYS 162 refraction.</p>",
        "<p class='gm-small'>Tap a mirror to select it; tap it again to turn it 15°. In the free lab, drag pieces around.</p>");
      if (api.settings && api.settings.add) {
        [["labels", "Show angles on the beam"], ["anim", "Animated beam"], ["cb", "Colour letters on filters and receivers", "Colour-blind help: R, G, B written on every gel and receiver."], ["big", "Larger puzzle text"]].forEach(function (o) {
          api.settings.add({ id: "lb_" + o[0], tab: o[0] === "cb" || o[0] === "big" ? "access" : "gameplay", section: "Light Bender", label: o[1], type: "toggle", default: save.opt[o[0]], help: o[2],
            apply: function (v) { save.opt[o[0]] = !!v; persist(); } });
        });
      }
      map(api);
    },
    update: function (dt, api) {
      if (api.hero.inUse !== api.hero.active) api.hero.use(api.hero.active);
      if (S.note) S.note.life -= dt;
      if (api.overlayOpen() || S.mode === "menu") return;
      if (S.mode === "lab") { if (api.hit("next")) nextSel(); if (api.hit("cw")) turn(api, 1); if (api.hit("ccw")) turn(api, -1); if (api.hit("map")) map(api); return; }
      if (!S.L || S.done) return;
      if (api.hit("next")) nextSel();
      if (api.hit("cw")) turn(api, 1);
      if (api.hit("ccw")) turn(api, -1);
      if (api.hit("hint")) hint(api);
      if (api.hit("map")) return map(api);
      if (S.tr && S.tr.all) { S.lit += dt; if (S.lit > .6) win(api); } else S.lit = 0;
    },
    draw: draw
  };
  A.run(game);
  window.LightBender = { S: S, par: par, unlocked: function (i) { return unlocked(null, i); }, save: save };
})();

// changed
