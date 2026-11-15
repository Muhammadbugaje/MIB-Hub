/* Algorithm Garage (EEEN 316): program the workshop robot in MATLAB. Write a script, run it on the visible floor,
   then submit it against hidden floors. Programs run in the EE Hub MATLAB-compatible runner; robot model and jobs in
   garagesim.js. Five chapters (getting started, variables, arrays, control flow, mastery) and endless Work orders. */
(function () {
  "use strict";
  var A = window.Arcade, G = window.GarageSim, J = G.JOBS;
  var save = A.store("garage") || { stars: {}, code: {}, best: 0 };
  function persist() { A.store("garage", save); }
  var S = { i: -1, job: null, w: null, play: null, res: null, seed: 0, orders: null, note: null };
  var api0 = null, hero = function () { return api0 && api0.hero && api0.hero.inUse; };
  function total() { var n = 0; for (var k in save.stars) n += save.stars[k]; return n; }
  function opened(i) { return hero() || S.allOpen || i === 0 || !!save.stars[J[i - 1].id]; }

  /* ---------- menus ---------- */
  function list(api) {
    var html = "<h2>Algorithm Garage</h2><p>Count Entropy scrambled the workshop robot's memory. Rewrite its programs in MATLAB: plan, run, debug, optimise. Every line runs in the EE Hub MATLAB runner.</p><p><b>★ " + total() + " / " + J.length * 3 + "</b>" + (save.best ? " · Work orders best " + save.best : "") + "</p>";
    G.CHAPTERS.forEach(function (ch) { html += "<h3 style='margin:.7em 0 .3em'>" + A.esc(ch) + "</h3><div class='gm-actions' style='flex-wrap:wrap'>";
      J.forEach(function (j, i) { if (j.ch !== ch) return; var st = save.stars[j.id] || 0, ok = opened(i); html += "<button class='gm-btn" + (ok && !st ? " gm-btn--go" : "") + "' data-act='" + (ok ? "job" : "no") + "' data-i='" + i + "'" + (ok ? "" : " disabled") + ">" + (i + 1) + ". " + A.esc(j.title) + (st ? " " + "★".repeat(st) : ok ? "" : " 🔒") + "</button>"; });
      html += "</div>"; });
    html += "<div class='gm-actions'>" + (total() >= 30 || hero() ? "<button class='gm-btn' data-act='orders'>🧾 Work orders (endless)</button>" : "<button class='gm-btn' disabled>🧾 Work orders open at 30 ★</button>") + "</div>";
    api.show(html, function (a, el) { if (a === "job") open(api, +el.getAttribute("data-i")); else if (a === "orders") startOrders(api); });
  }
  function open(api, i, seed) {
    S.i = i; S.job = J[i]; S.seed = seed || 0; S.w = S.job.make(S.seed * 31 + 1); S.play = null; S.res = null;
    api.useActions(["code", "run", "speed", "list"]); api.music(A.song(1300 + i, ["lofi", "dub", "calm"][i % 3], { bpm: 86 }));
    editor(api);
  }
  var SNIPS = [["move(1)", "move(1)\n"], ["turnLeft()", "turnLeft()\n"], ["turnRight()", "turnRight()\n"], ["pick()", "pick()\n"], ["drop()", "drop()\n"], ["frontIsClear()", "frontIsClear()"], ["sense()", "sense()"], ["scan()", "scan()"], ["weight()", "weight()"],
    ["for", "for k = 1:3\n  \nend\n"], ["while", "while frontIsClear()\n  \nend\n"], ["if", "if sense() > 5\n  \nelse\n  \nend\n"], ["disp", "disp(x)\n"]];
  function code() { var j = S.job; return S.orders ? (S.orders.code[j.id] != null ? S.orders.code[j.id] : j.starter) : (save.code[j.id] != null ? save.code[j.id] : j.starter); }
  function setCode(c) { if (S.orders) S.orders.code[S.job.id] = c; else { save.code[S.job.id] = c; persist(); } }
  function editor(api, msg) {
    var j = S.job;
    api.show("<h2>" + (S.orders ? "Work order " + (S.orders.round + 1) + ": " : (S.i + 1) + ". ") + A.esc(j.title) + "</h2><p>" + A.esc(goalText(j)) + "</p><p class='gm-small'><b>Idea:</b> " + A.esc(j.teach) + "</p>" +
      (msg ? "<p style='color:#ffb4b4'><b>" + A.esc(msg) + "</b></p>" : "") +
      "<textarea data-gm-code spellcheck='false' autocapitalize='off' autocomplete='off' rows='9' style='width:100%;box-sizing:border-box;font:16px/1.45 ui-monospace,Menlo,Consolas,monospace;background:#0e1520;color:#e8f1ff;border:1px solid #2e3d52;border-radius:10px;padding:10px;tab-size:2'>" + A.esc(code()) + "</textarea>" +
      "<div class='gm-actions' style='flex-wrap:wrap;gap:6px;margin-top:6px'>" + SNIPS.map(function (s, k) { return "<button class='gm-btn gm-btn--sm' data-act='snip' data-k='" + k + "' style='font-family:ui-monospace,monospace'>" + A.esc(s[0]) + "</button>"; }).join("") + "</div>" +
      "<p class='gm-small'>3 ★ = it works, it uses at most " + j.par + " robot moves, and at most " + j.lines + " lines of code. Ctrl/⌘ + Enter runs.</p>" +
      "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='run'>▶ Run on this floor</button><button class='gm-btn gm-btn--go' data-act='submit'>✔ Submit (" + (j.cases || 1) + " floor" + ((j.cases || 1) > 1 ? "s" : "") + ")</button><button class='gm-btn' data-act='look'>Look at the floor</button><button class='gm-btn' data-act='reset'>Reset code</button><button class='gm-btn' data-act='list'>Jobs</button></div>",
      function (a, el) {
        var ta = document.querySelector("[data-gm-code]"); if (ta) setCode(ta.value);
        if (a === "snip" && ta) { var s = SNIPS[+el.getAttribute("data-k")][1], p = ta.selectionStart || ta.value.length; ta.value = ta.value.slice(0, p) + s + ta.value.slice(ta.selectionEnd || p); ta.focus(); ta.selectionStart = ta.selectionEnd = p + s.length; setCode(ta.value); return; }
        if (a === "reset") { setCode(S.job.starter); return editor(api); }
        if (a === "list") return S.orders ? endOrders(api) : list(api);
        if (a === "look") return api.hide();
        if (a === "run" || a === "submit") { api.hide(); go(api, a === "submit"); }
      });
    setTimeout(function () { var ta = document.querySelector("[data-gm-code]"); if (!ta) return; ta.addEventListener("keydown", function (e) {
      if (e.key === "Tab") { e.preventDefault(); var p = ta.selectionStart; ta.value = ta.value.slice(0, p) + "  " + ta.value.slice(ta.selectionEnd); ta.selectionStart = ta.selectionEnd = p + 2; }
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setCode(ta.value); api.hide(); go(api, false); } }); }, 0);
  }
  function goalText(j) {
    var map = { g1: "Drive to the green square.", g2: "Reach the green square round the corner.", g3: "Carry the part to bin A.", g4: "Reach the green square.", g5: "Deliver both parts to bin A.", g6: "Print the number on the floor two squares ahead.",
      v1: "Print the sum of the two numbers on the floor.", v2: "Read the floor, then move that many squares to the green one.", v3: "Pick the part and print twice its weight.", v4: "Move as far as the floor says, then print your column.",
      a1: "Print the sum of every number ahead.", a2: "Print the largest number ahead.", a3: "Stop on the square with the largest number.", a4: "Print how many squares ahead read 0.", a5: "Print the average of the numbers ahead, rounded.", a6: "Print the sum of the numbers ahead that are greater than 5.", a7: "Weigh all four parts; leave their weights in a vector called w.",
      c1: "Reach the green square with a for loop.", c2: "Drive until the wall, however far it is.", c3: "Parts over 5 kg go to bin H, the rest to bin L.", c4: "Put every part on the belt into bin A.", c5: "Find the way out of the maze.", c6: "Stop on the square that reads 0.",
      f1: "Weigh three parts and deliver them, lightest to bin 1, heaviest to bin 3.", f2: "Visit all fifteen floor squares and print their total.", f3: "Only parts over 6 kg go to bin H; leave the others where they are." };
    return "Job: " + (map[j.id] || "Finish the job.");
  }

  /* ---------- running ---------- */
  function go(api, submit) {
    var j = S.job, c = code(), ch;
    if (submit) ch = G.check(j, c, S.seed); else { var res = G.run(c, S.w); ch = { pass: res.ok && !!j.ok(res, S.w), cases: [{ ok: res.ok && !!j.ok(res, S.w), res: res, w0: S.w, why: res.error || "" }], actions: res.actions, lines: G.codeLines(c) }; }
    var show = ch.cases.filter(function (k) { return !k.ok; })[0] || ch.cases[0];
    S.res = { ch: ch, submit: submit, shown: show }; S.w = show.w0;
    S.play = { trace: show.res.trace, i: 0, f: 0, w: JSON.parse(JSON.stringify(show.w0)), done: false };
    api.sound.sfx("click");
  }
  function finishPlay(api) {
    var R = S.res, ch = R.ch, j = S.job, k = R.shown; S.play.done = true;
    if (!k.ok) { api.sound.sfx("block"); var why = k.res.error || (R.submit && ch.cases.length > 1 ? "Floor " + (ch.cases.indexOf(k) + 1) + " of " + ch.cases.length + ": the job is not done yet." : "The job is not done yet."); if (k.res.output) why += " Output: " + k.res.output.trim().slice(0, 80); return setTimeout(function () { editor(api, why); }, 500); }
    if (!R.submit) { api.sound.sfx("coin"); S.note = { t: "It works on this floor. Submit to test it on " + (j.cases || 1) + " floor" + ((j.cases || 1) > 1 ? "s" : "") + "." + (k.res.output ? " Output: " + k.res.output.trim().slice(0, 60) : ""), life: 6 }; return setTimeout(function () { editor(api); }, 900); }
    return win(api, G.stars(j, ch), ch);
  }
  function win(api, st, ch) {
    var j = S.job, i = S.i; api.sound.sfx("power");
    if (S.orders) return ordersNext(api, st);
    var prev = save.stars[j.id] || 0; save.stars[j.id] = Math.max(prev, st); persist();
    A.report("algorithm-garage", { result: "win", stage: i + 1, score: st * 100 + Math.max(0, 50 - ch.actions) });
    var all = J.every(function (x) { return save.stars[x.id]; }) && !prev && i === J.length - 1;
    api.ceremony(all ? "gameComplete" : "stageClear", { title: all ? "ROBOT RESTORED!" : "PROGRAM WORKS!", sub: j.title, trophy: all ? "crown" : "star", stars: st, colors: ["#7ef0ff", "#f6c445", "#3dd68c", "#fff"], len: all ? 5 : 2.4, score: st * 100,
      stats: [["Robot moves", ch.actions + " (par " + j.par + ")"], ["Lines", ch.lines + " (par " + j.lines + ")"], ["Floors passed", ch.cases.length]], line: st === 3 ? "Correct, short and efficient." : "Correct. " + (ch.actions > j.par ? "Fewer robot moves" : "Fewer lines") + " earns another star.",
      then: function () { api.show("<h2>" + "★".repeat(st) + "☆".repeat(3 - st) + " " + A.esc(j.title) + "</h2><p>" + A.esc(j.teach) + "</p>" + (all ? "<p><b>Every program is rewritten. Work orders keep coming for as long as you can keep up.</b></p>" : "") +
        "<div class='gm-actions'>" + (i + 1 < J.length ? "<button class='gm-btn gm-btn--go' data-act='next'>Next job</button>" : "") + "<button class='gm-btn' data-act='again'>Improve it</button><button class='gm-btn' data-act='list'>Jobs</button></div>",
        function (a) { if (a === "next") open(api, i + 1); else if (a === "again") open(api, i); else list(api); }); } });
  }
  /* Work orders: random jobs on fresh floors; a failed submission ends the run */
  function startOrders(api) { S.orders = { round: 0, score: 0, seed: (Date.now() & 0xffff) || 3, code: {} }; nextOrder(api); }
  function nextOrder(api) { var o = G.workOrder(S.orders.round, S.orders.seed); S.i = J.indexOf(o.job); S.job = o.job; S.seed = o.seed; S.w = o.job.make(o.seed * 31 + 1); S.play = null; api.useActions(["code", "run", "speed", "list"]); editor(api); }
  function ordersNext(api, st) { var o = S.orders; o.score += st * 100 + o.round * 30; o.round++; api.banner("ORDER " + (o.round + 1), { dur: 1.2 }); setTimeout(function () { if (S.orders) nextOrder(api); }, 900); }
  function endOrders(api) {
    var o = S.orders; S.orders = null; if (!o) return list(api); var rec = o.score > (save.best || 0); if (rec) { save.best = o.score; persist(); }
    api.ceremony(rec ? "newRecord" : "lose", { title: rec ? "NEW RECORD!" : "Shift over", score: o.score, stats: [["Orders done", o.round]], line: o.round + " work orders completed.", tip: "Reuse your loops: the same patterns keep coming back.",
      then: function () { api.show("<h2>Work orders: " + o.score + "</h2><p>Best " + save.best + ".</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='again'>New shift</button><button class='gm-btn' data-act='list'>Jobs</button></div>", function (a) { if (a === "again") startOrders(api); else list(api); }); } });
  }

  /* ---------- drawing ---------- */
  function draw(api) {
    var x = api.x; x.fillStyle = "#10161d"; x.fillRect(0, 0, 960, 540);
    var w = S.play ? S.play.w : S.w; if (!w) return;
    var H = w.grid.length, Wd = w.grid[0].length, cs = Math.min(64, Math.floor(Math.min(900 / Wd, 400 / H))), ox = Math.round(480 - Wd * cs / 2), oy = Math.round(290 - H * cs / 2);
    for (var r = 0; r < H; r++) for (var c = 0; c < Wd; c++) { var wall = w.grid[r][c] === "#", X = ox + c * cs, Y = oy + r * cs;
      x.fillStyle = wall ? "#2c3441" : (r + c) % 2 ? "#1c2530" : "#202a36"; x.fillRect(X, Y, cs - 1, cs - 1);
      if (wall) { x.fillStyle = "#38424f"; x.fillRect(X + 3, Y + 3, cs - 7, cs / 2 - 4); }
      var pv = w.paint[r + "," + c]; if (pv != null) { x.fillStyle = "#7ef0ff"; x.font = "800 " + Math.round(cs * .42) + "px ui-monospace,monospace"; x.textAlign = "center"; x.fillText(String(pv), X + cs / 2, Y + cs * .66); } }
    if (w.target) { x.strokeStyle = "#3dd68c"; x.lineWidth = 4; x.strokeRect(ox + w.target.c * cs + 4, oy + w.target.r * cs + 4, cs - 9, cs - 9); }
    w.bins.forEach(function (b) { var X = ox + b.c * cs, Y = oy + b.r * cs; x.fillStyle = "#3b2f1a"; x.fillRect(X + 4, Y + 4, cs - 9, cs - 9); x.strokeStyle = "#f6c445"; x.lineWidth = 3; x.strokeRect(X + 4, Y + 4, cs - 9, cs - 9); x.fillStyle = "#f6c445"; x.font = "800 " + Math.round(cs * .3) + "px system-ui"; x.textAlign = "center"; x.fillText(b.label, X + cs / 2, Y + cs * .62); });
    w.parts.forEach(function (p) { box(x, ox + p.c * cs + cs / 2, oy + p.r * cs + cs / 2, cs, p.w); });
    // robot
    var R = w.robot, rx = ox + R.c * cs + cs / 2, ry = oy + R.r * cs + cs / 2, pl = S.play;
    x.save(); x.translate(rx, ry); x.rotate((R.d - 1) * Math.PI / 2);
    x.fillStyle = hero() ? "#f5f2ea" : "#d9e6f5"; x.fillRect(-cs * .32, -cs * .3, cs * .64, cs * .6); x.fillStyle = hero() ? "#f6c445" : "#2d6cdf"; x.fillRect(cs * .12, -cs * .3, cs * .2, cs * .6);
    x.fillStyle = "#111"; x.beginPath(); x.arc(cs * .2, -cs * .12, cs * .06, 0, 7); x.arc(cs * .2, cs * .12, cs * .06, 0, 7); x.fill(); x.restore();
    if (w.held) box(x, rx, ry - cs * .45, cs * .7, w.held.w);
    // HUD
    var j = S.job; x.textAlign = "left"; x.fillStyle = "#fff"; x.font = "800 26px system-ui"; x.fillText(j ? (S.orders ? "Work order " + (S.orders.round + 1) + " · " : (S.i + 1) + ". ") + j.title : "", 18, 36);
    x.fillStyle = "#9fb3c8"; x.font = "700 19px system-ui"; x.fillText(j ? j.ch + " · ★ " + total() + (pl ? " · move " + Math.min(pl.i, pl.trace.length) + " / " + pl.trace.length : "") : "", 18, 62);
    if (S.note && S.note.life > 0) { x.fillStyle = "rgba(6,10,16,.92)"; x.fillRect(40, 486, 880, 46); x.fillStyle = "#ffe9a8"; x.font = "700 19px system-ui"; x.textAlign = "center"; x.fillText(S.note.t.length > 88 ? S.note.t.slice(0, 86) + "…" : S.note.t, 480, 516); }
    else if (!pl) { x.fillStyle = "#7f93a8"; x.font = "600 19px system-ui"; x.textAlign = "center"; x.fillText("C: write code · R: run · tap the floor to open the editor", 480, 520); }
  }
  function box(x, cx, cy, cs, w) { var s = cs * .42; x.fillStyle = "#8a5a2b"; x.fillRect(cx - s / 2, cy - s / 2, s, s); x.strokeStyle = "#c08a50"; x.lineWidth = 2; x.strokeRect(cx - s / 2, cy - s / 2, s, s); x.fillStyle = "#fff"; x.font = "800 " + Math.round(cs * .2) + "px system-ui"; x.textAlign = "center"; x.fillText(w + "kg", cx, cy + cs * .08); }
  /* replay the recorded trace one action at a time */
  function stepPlay(dt, api) {
    var p = S.play; if (!p || p.done) return; var spd = S.fast ? 18 : 5; p.f += dt * spd;
    while (p.f >= 1 && p.i < p.trace.length) { p.f -= 1; var a = p.trace[p.i++], w = p.w;
      if (a.k === "pick") { var idx = -1; w.parts.forEach(function (q, n) { if (q.r === a.r && q.c === a.c) idx = n; }); if (idx >= 0) w.held = w.parts.splice(idx, 1)[0]; api.sound.sfx("coin"); }
      else if (a.k === "drop") { if (w.held) { if (!(a.x && a.x.bin)) { w.held.r = a.r; w.held.c = a.c; w.parts.push(w.held); } else api.burst(480, 270, "#f6c445", 8, 120); } w.held = null; api.sound.sfx("click"); }
      else if (a.k === "bump") { api.kick(6); api.sound.sfx("block"); }
      w.robot.r = a.r; w.robot.c = a.c; w.robot.d = a.d; }
    if (p.i >= p.trace.length && p.f >= .6) finishPlay(api);
  }

  /* ---------- cheats and the maker ---------- */
  var CH = /*CH[*/{"skip":["dc00caa1ac720796757da2912ac2b23a192415119b2c39e86bdd85261f476dbb","0dfd7e488ebaf5f18a08c0883d11a009fcdc163d503c260d2d87d05e69e45219"],"solve":["2a544c175a2280e64210974e422792ad87b23101c026cf98a394581fbcb6676d","3302b0f16b138bdbd3f5e00eff007f16f269c157962dafe8a8323b2d64291e73"],"fast":["a766636102b1a9936841b87a69ffbd4b6439afef81b49664fa702b7a79b818e9","e12eba049b4da099089811617250f5ffa0dc3f40cbfb9ed820539ac9ee62eaf5"],"stars":["83c7d86d73845a3e381596a3d932fde0b63c4c8d248f176ad81b7545775cea40","0942857670031a683f900b88604d9db7285805ede291a4b782a7313820c9b56a"],"unlock":["25c70645c2f467f76cc0f760a96bd5d885418a883c83127ee55502ae9a85975c","0737806ce7fd01352d1e935c23b28811fd62ae352e10e238619633c019a87458"],"orders":["b52cf7db060e70af453be795acb27926ae92cad655bfc371a68adaeba5f51434","89dd93e16ddf89edeca1d6995bafc97dff6fac858536a22681c1eeda1ac4a53f"],"slow":["7b7459b125e7e2a9d2f9ff355e7b2e27ddd8bc74e891626ce10a2f059380fc58","8e1a59f864138b0b493bb1ec0cfa0541837d000bb57590dc5078fb983c425dde"],"party":["8108140c380948a79cb65739a3c5ce40deebf08a74418a7663d49dfb5e972d48","24d272b17904e24cda863cb92466c1d51b9cf141d1008e86403db43c27eabd4a"],"_combo":"9c70ca1bf0f94e1c762086026b718c6f7b1767658f355073c751feb482dc79d5","_swipe":"fca7a4c9bb306cc776dae948d06cea7e36ebad0264ad2dcbc4781913dcd722d8"}/*]CH*/;
  function setupCheats(api) {
    api.cheats({
      skip: { label: "Finish this job", h: CH.skip, run: function () { if (S.job) { setCode(S.job.solution); go(api, true); } } },
      solve: { label: "Show a working program", h: CH.solve, run: function () { if (S.job) { setCode(S.job.solution); editor(api, "A working program is in the editor."); } } },
      fast: { label: "Fast replay", h: CH.fast, run: function () { S.fast = true; } },
      stars: { label: "Three stars for this job", h: CH.stars, run: function () { if (S.job && !S.orders) { save.stars[S.job.id] = 3; persist(); } } },
      unlock: { label: "Every job open", h: CH.unlock, run: function () { S.allOpen = true; } },
      orders: { label: "Open Work orders", h: CH.orders, run: function () { startOrders(api); } },
      slow: { label: "Slow motion", h: CH.slow, run: function () { api.slowmo(.5, 20); } },
      party: { label: "Confetti storm", h: CH.party, run: function () { api.confetti(400); } }
    });
    if (CH._combo) api.secret({ combo: CH._combo, swipe: CH._swipe, onReveal: function () { list(api); } });
  }

  var game = {
    song: A.song(1299, "lofi"),
    savePrefix: ["ee-arcade-garage"],
    menu: function (api) { S.orders = null; list(api); },
    actions: [
      { id: "code", label: "Open the code editor", keys: ["KeyC", "Enter"], touch: { label: "✎", x: 80, y: 86 } }, { id: "run", label: "Run the program", keys: ["KeyR"], touch: { label: "▶", x: 92, y: 86 } },
      { id: "speed", label: "Fast replay on/off", keys: ["KeyF"], touch: { label: "⏩", x: 8, y: 86 } }, { id: "list", label: "Job list", keys: ["KeyM"], touch: { label: "☰", x: 93, y: 14 } }
    ],
    click: function (mx, my, api) { if (api.overlayOpen() || !S.job) return; if (!S.play || S.play.done) editor(api); },
    init: function (api) {
      api0 = api; setupCheats(api);
      if (api.settings && api.settings.add) api.settings.add({ id: "replay", tab: "gameplay", label: "Replay speed", type: "choice", default: "normal", choices: [["normal", "Normal"], ["fast", "Fast"]], apply: function (v) { S.fast = v === "fast"; } });
      api.panel("<p>Your program is real MATLAB, run line by line by the EE Hub MATLAB runner (the same one the MATLAB Academy uses), with the robot's commands added.</p><table><tr><td>Move</td><td><span class='gm-eq'>move(n)</span>, <span class='gm-eq'>turnLeft()</span>, <span class='gm-eq'>turnRight()</span></td></tr><tr><td>Handle parts</td><td><span class='gm-eq'>pick()</span>, <span class='gm-eq'>drop()</span>, <span class='gm-eq'>weight()</span></td></tr><tr><td>Sensors</td><td><span class='gm-eq'>frontIsClear()</span>, <span class='gm-eq'>sense()</span>, <span class='gm-eq'>scan()</span>, <span class='gm-eq'>pos()</span>, <span class='gm-eq'>heading()</span></td></tr></table>" +
        "<p class='gm-small'>Submissions are tested on several floors you have not seen, so a program must solve the problem, not one picture. Stars: correct, at most the par robot moves, at most the par lines. Course: EEEN 316, getting started, arrays and control flow.</p>",
        "<p class='gm-small'>Tap the floor (or ✎) to open the editor. The buttons under the editor type commands for you, so you can program on a phone without a keyboard.</p>");
      list(api);
    },
    update: function (dt, api) {
      if (api.hero.inUse !== api.hero.active) api.hero.use(api.hero.active);
      if (S.note) S.note.life -= dt;
      if (S.play && !S.play.done) return stepPlay(dt, api);
      if (api.overlayOpen() || !S.job) return;
      if (api.hit("code")) editor(api);
      if (api.hit("run")) go(api, false);
      if (api.hit("speed")) S.fast = !S.fast;
      if (api.hit("list")) S.orders ? endOrders(api) : list(api);
    },
    draw: draw
  };
  A.run(game);
  window.AlgorithmGarage = { S: S, save: save, open: function (i) { open(api0, i); }, go: function (sub) { go(api0, sub); } };
})();
