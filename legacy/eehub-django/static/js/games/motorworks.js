/* Motorworks Trails (EEEN 309): walk a machine workshop, open a bay, set supply, field and load until the machine does
   its job. The machine model is motorsim.js (shared with the tests). Five halls of six bays, opened by stars, then an
   endless Night shift. */
(function () {
  "use strict";
  var A = window.Arcade, MS = window.MotorSim, J = MS.JOBS, RPM = MS.RPM;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  var save = A.store("motorworks") || { stars: {}, night: 0, seen: false };
  function persist() { A.store("motorworks", save); }
  var S = { mode: "hub", hall: 0, px: 140, py: 330, tx: null, ty: null, face: 1, b: null, sel: 0, night: null, note: null, hold: 0, walkT: 0 };
  var api0 = null, hero = function () { return api0 && api0.hero && api0.hero.inUse; }, noTrip = false;

  function total() { var n = 0; for (var k in save.stars) n += save.stars[k]; return n; }
  function hallOpen(h) { return hero() || S.allOpen || total() >= MS.GATE[h]; }
  function benchPos(i) { return { x: 250 + (i % 3) * 230, y: i < 3 ? 210 : 400 }; }
  function jobsIn(h) { return J.filter(function (j) { return j.hall === h + 1; }); }

  /* ---------- hub: the workshop floor ---------- */
  function hub(api) { S.mode = "hub"; S.b = null; api.useActions(["up", "down", "left", "right", "act", "menu"]); api.music(A.song(901 + S.hall, "lofi", { bpm: 84 })); }
  function nearBench() { var js = jobsIn(S.hall); for (var i = 0; i < js.length; i++) { var p = benchPos(i); if (Math.hypot(S.px - p.x, S.py - (p.y + 40)) < 70) return { i: i, job: js[i] }; } return null; }
  function nearDoor() { if (S.px > 880) return "next"; if (S.px < 70) return "prev"; return null; }
  function drawHub(api) {
    var x = api.x, js = jobsIn(S.hall), t = api.t;
    x.fillStyle = "#1b2026"; x.fillRect(0, 0, 960, 540);
    for (var gx = 0; gx < 960; gx += 60) for (var gy = 90; gy < 540; gy += 60) { x.fillStyle = (gx / 60 + gy / 60) % 2 ? "#242b33" : "#20262d"; x.fillRect(gx, gy, 60, 60); }
    x.fillStyle = "#2f3944"; x.fillRect(0, 0, 960, 90); x.fillStyle = "#f6c445"; x.fillRect(0, 86, 960, 4);
    x.fillStyle = "#fff"; x.font = "800 30px system-ui"; x.textAlign = "left"; x.fillText(MS.HALLS[S.hall], 24, 40);
    x.fillStyle = "#ffd86b"; x.font = "700 24px system-ui"; x.fillText("★ " + total() + " / " + J.length * 3 + (save.night ? "   Night shift best: " + save.night : ""), 24, 74);
    // doors
    [["prev", 0], ["next", 930]].forEach(function (d) { var ok = d[0] === "prev" ? S.hall > 0 : S.hall < 4 && hallOpen(S.hall + 1); x.fillStyle = ok ? "#3dd68c" : "#5a2f2f"; x.fillRect(d[1], 250, 30, 140);
      if (d[0] === "next" && S.hall < 4) { x.save(); x.translate(930, 320); x.rotate(-Math.PI / 2); x.fillStyle = "#fff"; x.font = "700 20px system-ui"; x.textAlign = "center"; x.fillText(ok ? "Hall " + (S.hall + 2) + " ▶" : "🔒 " + MS.GATE[S.hall + 1] + " ★", 0, -8); x.restore(); } });
    if (S.hall === 4 || total() >= 18) { x.fillStyle = "#26334a"; x.fillRect(780, 470, 150, 54); x.fillStyle = "#7ef0ff"; x.font = "700 20px system-ui"; x.textAlign = "center"; x.fillText("🌙 Night shift", 855, 504); }
    js.forEach(function (j, i) { var p = benchPos(i), st = save.stars[j.id] || 0, near = nearBench(); var hot = near && near.i === i;
      x.fillStyle = hot ? "#3b4a5c" : "#2d3742"; x.fillRect(p.x - 90, p.y - 50, 180, 100); x.strokeStyle = hot ? "#f6c445" : "#47566a"; x.lineWidth = 3; x.strokeRect(p.x - 90, p.y - 50, 180, 100);
      drawMachine(x, p.x - 40, p.y - 6, .55, MS.MACH[j.mach], t * (st ? 6 : 1.5));
      x.fillStyle = "#fff"; x.font = "700 18px system-ui"; x.textAlign = "center"; x.fillText(j.title, p.x, p.y + 76);
      x.fillStyle = "#ffd86b"; x.font = "700 20px system-ui"; x.fillText(st ? "★".repeat(st) + "☆".repeat(3 - st) : "NEW", p.x + 48, p.y - 18); });
    drawWorker(x, S.px, S.py, S.face, S.walkT, hero());
    var nb = nearBench(), nd = nearDoor();
    var hint = nb ? "E: open “" + nb.job.title + "”" : nd === "next" ? (S.hall < 4 && hallOpen(S.hall + 1) ? "E: go to Hall " + (S.hall + 2) : S.hall < 4 ? "Locked: " + MS.GATE[S.hall + 1] + " stars opens Hall " + (S.hall + 2) : "") : nd === "prev" ? "E: back to Hall " + S.hall : Math.hypot(S.px - 855, S.py - 497) < 90 && (S.hall === 4 || total() >= 18) ? "E: start the Night shift" : "Walk to a bench (arrows or tap the floor)";
    banner(x, hint);
  }
  function drawWorker(x, px, py, face, wt, mib) {
    var bob = Math.sin(wt * 10) * 3;
    x.fillStyle = "rgba(0,0,0,.35)"; x.beginPath(); x.ellipse(px, py + 28, 20, 7, 0, 0, 7); x.fill();
    x.fillStyle = mib ? "#f5f2ea" : "#2d6cdf"; x.fillRect(px - 14, py - 12 + bob, 28, 34);
    if (mib) { x.fillStyle = "#f6c445"; x.fillRect(px - 14, py + 2 + bob, 28, 5); }
    x.fillStyle = mib ? "#dcab80" : "#7a4a2a"; x.beginPath(); x.arc(px, py - 24 + bob, 13, 0, 7); x.fill();
    x.fillStyle = mib ? "#2a1a10" : "#f6c445"; x.beginPath(); x.arc(px, py - 30 + bob, 13, Math.PI, 0); x.fill(); // hard hat (or coily hair)
    x.fillStyle = "#111"; x.fillRect(px + face * 5 - 2, py - 26 + bob, 3, 3);
  }
  function banner(x, s) { x.fillStyle = "rgba(6,10,16,.88)"; x.fillRect(120, 492, 640, 40); x.fillStyle = "#ffe9a8"; x.font = "700 22px system-ui"; x.textAlign = "center"; x.fillText(s, 440, 520); }
  /* a DC machine: frame, rotor with a stripe so speed shows, and a coupling */
  function drawMachine(x, cx, cy, sc, m, ang) {
    x.save(); x.translate(cx, cy); x.scale(sc, sc);
    x.fillStyle = m.kind === "gen" ? "#3d6b4f" : m.kind === "series" ? "#6b4f3d" : m.kind === "pm" ? "#4f4f6b" : "#3d556b"; x.fillRect(-60, -45, 120, 90);
    x.fillStyle = "#cfd8e3"; x.beginPath(); x.arc(0, 0, 34, 0, 7); x.fill();
    x.save(); x.rotate(ang); x.fillStyle = "#2a3340"; x.fillRect(-32, -5, 64, 10); x.fillStyle = "#f6c445"; x.fillRect(20, -5, 12, 10); x.restore();
    x.fillStyle = "#8a96a6"; x.fillRect(60, -8, 40, 16); x.restore();
  }

  /* ---------- a bay ---------- */
  function openBay(api, job) {
    S.mode = "bench"; S.b = MS.bench(job); S.sel = 0; S.hold = 0; S.ang = 0; S.trace = []; S.done = false;
    api.useActions(["kprev", "knext", "minus", "plus", "hint", "back"]);
    api.music(A.song(930 + J.indexOf(job), job.night ? "synthwave" : "funk", { bpm: 96 }));
    var m = MS.MACH[job.mach];
    api.show("<h2>" + A.esc(job.title) + "</h2><p><b>" + A.esc(m.name) + "</b> · rated " + m.Va + " V, " + m.Ia + " A, " + m.rpm + " rpm</p><p>" + goalText(job) + "</p>" +
      "<p class='gm-small'>Pick a control with ◀ ▶ (Tab), change it with − + (Q E). Supplies ramp; they do not jump. The breaker trips at " + (job.breaker || m.Ia * 2) + " A.</p>" +
      "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='ok'>Start the test</button><button class='gm-btn' data-act='back'>Back to the hall</button></div>",
      function (a) { if (a === "back") return leave(api); api.hide(); });
  }
  function goalText(job) {
    var g = job.goal, p = [];
    if (g.rpm) p.push("hold the speed between <b>" + g.rpm[0] + " and " + g.rpm[1] + " rpm</b>");
    if (g.Vt) p.push("hold the terminal voltage between <b>" + g.Vt[0] + " and " + g.Vt[1] + " V</b>");
    if (g.P) p.push("deliver <b>" + g.P[0] + "–" + g.P[1] + " W</b>");
    if (g.Ia) p.push("armature current <b>" + (g.Ia[0] ? g.Ia[0] + "–" : "at most ") + g.Ia[1] + " A</b>");
    if (g.stop) p.push("bring it below <b>" + g.stop + " rpm within " + g.within + " s</b>");
    if (g.maxPeak) p.push("never let the current pass <b>" + g.maxPeak + " A</b>");
    if (g.after) p.push("after the load changes at " + (job.load.step ? job.load.step.at : g.after) + " s");
    return "Job: " + p.join(", ") + " for " + (g.hold || 2) + " s.";
  }
  function leave(api) { api.hide(); if (S.night) { endNight(api); return; } hub(api); }
  function knobs() { return S.b ? S.b.job.knobs.filter(function (n) { return !(S.b.job.lock && S.b.job.lock[n] != null); }) : []; }
  function nudge(api, dir) {
    var ks = knobs(); if (!ks.length) return; var n = ks[S.sel % ks.length], d = MS.KNOB[n];
    S.b.k[n] = Math.round(clamp((S.b.k[n] || 0) + dir * d.step, d.min, d.max) * 1000) / 1000; api.sound.sfx("click");
    if (n === "on" && S.b.k.on && S.b.trip) S.b.trip = false;
  }
  function benchUpdate(dt, api) {
    var b = S.b; if (!b || api.overlayOpen()) return;
    if (api.hit("knext")) { S.sel = (S.sel + 1) % Math.max(1, knobs().length); api.sound.sfx("click"); }
    if (api.hit("kprev")) { S.sel = (S.sel + knobs().length - 1) % Math.max(1, knobs().length); api.sound.sfx("click"); }
    var held = api.down("plus") ? 1 : api.down("minus") ? -1 : 0;
    if (api.hit("plus")) { nudge(api, 1); S.hold = -.35; } else if (api.hit("minus")) { nudge(api, -1); S.hold = -.35; }
    else if (held) { S.hold += dt * ((api.settings && api.settings.get && api.settings.get("repeat")) || 1); if (S.hold > .07) { S.hold = 0; nudge(api, held); } }
    if (api.hit("hint")) S.note = { t: b.job.idea, life: 7 };
    if (api.hit("back")) return leave(api);
    if (b.done || S.done) return;
    if (noTrip || hero()) { b.over = 0; b.trip = false; if (b.failed === "trip" || b.failed === "peak") b.failed = ""; b.peak = Math.min(b.peak, (b.job.goal.maxPeak || 1e9) - .1); }
    var was = b.trip; MS.step(b, dt);
    if (b.trip && !was) { api.sound.sfx("boom"); api.kick(10); api.flash("#ff4d4d", .25); S.note = { t: "Breaker tripped at " + Math.abs(b.Ia).toFixed(0) + " A. Ramp up gently or add starter resistance.", life: 4 }; }
    S.ang += b.w * dt; S.trace.push([MS.rpm(b), b.Ia]); if (S.trace.length > 240) S.trace.shift();
    if (b.done) win(api); else if (b.failed && b.failed !== "trip") lose(api, b.failed);
    else if (b.trip && b.t > (b.job.goal.within || 60)) lose(api, "trip");
  }
  function win(api) {
    var b = S.b, job = b.job, st = MS.stars(b); S.done = true;
    api.sound.sfx("power"); api.burst(300, 250, "#f6c445", 30, 320);
    if (job.night) return nightNext(api, st);
    var i = J.map(function (q) { return q.id; }).indexOf(job.id), prev = save.stars[job.id] || 0; save.stars[job.id] = Math.max(prev, st); save.seen = true; persist();
    A.report("motorworks", { result: "win", stage: i + 1, score: st * 100 + Math.max(0, Math.round(100 - b.at * 4)) });
    var all = J.every(function (j) { return save.stars[j.id]; }), m = MS.MACH[job.mach];
    var nums = m.kind === "gen" ? "E = kφ·ω = " + b.kp.toFixed(3) + " × " + b.w.toFixed(1) + " = " + b.E.toFixed(0) + " V; Vt = E − Ia·Ra = " + b.E.toFixed(0) + " − " + b.Ia.toFixed(1) + " × " + m.Ra + " = " + b.Vt.toFixed(0) + " V"
      : "E = Va − Ia·Ra = " + (b.a.Va || 0).toFixed(0) + " − " + b.Ia.toFixed(1) + " × " + m.Ra + " = " + b.E.toFixed(0) + " V, so ω = E/kφ = " + b.E.toFixed(0) + " / " + b.kp.toFixed(3) + " = " + b.w.toFixed(0) + " rad/s (" + MS.rpm(b).toFixed(0) + " rpm); T = kφ·Ia = " + b.T.toFixed(1) + " N·m";
    api.ceremony(all && !prev ? "gameComplete" : "stageClear", { title: all && !prev ? "WORKSHOP COMPLETE!" : "JOB DONE!", sub: job.title, trophy: all && !prev ? "crown" : "star", stars: st, colors: ["#f6c445", "#3dd68c", "#7ef0ff", "#fff"], len: all && !prev ? 5 : 2.6,
      score: st * 100, stats: [["Time", b.at.toFixed(1) + " s"], ["Peak current", b.peak.toFixed(1) + " A"], ["Energy", (b.energy / 1000).toFixed(1) + " kJ"]], line: st === 3 ? "Inside the target time." : "Done in " + b.at.toFixed(1) + " s. Par is " + job.par + " s.",
      then: function () { api.show("<h2>" + "★".repeat(st) + "☆".repeat(3 - st) + " " + A.esc(job.title) + "</h2><p>" + A.esc(job.idea) + "</p><p class='gm-formula' style='white-space:normal'>" + A.esc(nums) + "</p>" +
        (all && !prev ? "<p><b>Every machine in the workshop runs. The Night shift is open for as long as you can last.</b></p>" : "") +
        "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='hall'>Back to the hall</button><button class='gm-btn' data-act='retry'>Try for 3 ★</button></div>",
        function (a) { if (a === "retry") openBay(api, job); else leave(api); }); } });
  }
  var WHY = { trip: ["The breaker tripped.", "At standstill E = 0, so the current is Va ÷ resistance. Raise the supply slowly, or start with resistance in circuit."], runaway: ["The series motor ran away.", "With little load a series motor's field collapses and its speed climbs. Keep it loaded and the voltage low."],
    slow: ["Too slow.", "Use a smaller braking resistor (more current, more braking torque) — but not so small that the breaker trips."], peak: ["The current peak was too high.", "Cut the starter resistance in steps, waiting for the speed (and E) to rise between steps."] };
  function lose(api, why) {
    S.done = true; var w = WHY[why] || ["Not this time.", "Read the job again and watch the gauges."], job = S.b.job;
    if (job.night) return endNight(api);
    api.ceremony("lose", { title: w[0], sub: job.title, line: w[0], tip: w[1], then: function () { api.show("<h2>" + A.esc(w[0]) + "</h2><p>" + A.esc(w[1]) + "</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='retry'>Try again</button><button class='gm-btn' data-act='hall'>Back to the hall</button></div>",
      function (a) { if (a === "retry") openBay(api, job); else leave(api); }); } });
  }
  /* Night shift: one random job after another; each round is tighter. One failure ends the shift. */
  function startNight(api) { S.night = { round: 0, score: 0, seed: (Date.now() & 0xffff) || 7 }; openBay(api, MS.nightJob(0, S.night.seed)); }
  function nightNext(api, st) { var n = S.night; n.score += st * 100 + n.round * 25; n.round++; api.banner("ROUND " + (n.round + 1), { dur: 1.2 }); setTimeout(function () { if (S.night) openBay(api, MS.nightJob(n.round, n.seed)); }, 900); }
  function endNight(api) {
    var n = S.night; S.night = null; if (!n) return hub(api); var rec = n.score > (save.night || 0); if (rec) { save.night = n.score; persist(); }
    api.ceremony(rec ? "newRecord" : "lose", { title: rec ? "NEW RECORD!" : "Shift over", sub: "Night shift", score: n.score, stats: [["Jobs done", n.round]], line: n.round + " jobs before the shift ended.", tip: "Each round narrows the band. Watch the operating point on the curve.",
      then: function () { api.show("<h2>Night shift: " + n.score + " points</h2><p>" + n.round + " jobs done. Best: " + save.night + ".</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='again'>Another shift</button><button class='gm-btn' data-act='hall'>Back to the hall</button></div>", function (a) { if (a === "again") startNight(api); else { api.hide(); hub(api); } }); } });
  }

  /* gauges, the knobs and the torque–speed picture */
  function gauge(x, cx, cy, r, v, max, label, unit, warn) {
    x.strokeStyle = "#2b3542"; x.lineWidth = 14; x.beginPath(); x.arc(cx, cy, r, Math.PI * .75, Math.PI * 2.25); x.stroke();
    var f = clamp(Math.abs(v) / max, 0, 1); x.strokeStyle = warn ? "#ff5d5d" : "#3dd68c"; x.beginPath(); x.arc(cx, cy, r, Math.PI * .75, Math.PI * (.75 + 1.5 * f)); x.stroke();
    x.fillStyle = "#fff"; x.font = "800 34px system-ui"; x.textAlign = "center"; x.fillText((Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1)), cx, cy + 10);
    x.fillStyle = "#9fb3c8"; x.font = "700 18px system-ui"; x.fillText(label + " " + unit, cx, cy + r + 18);
  }
  function drawBench(api) {
    var x = api.x, b = S.b, job = b.job, m = b.m, g = job.goal;
    x.fillStyle = "#151a20"; x.fillRect(0, 0, 960, 540);
    x.fillStyle = "#fff"; x.font = "800 26px system-ui"; x.textAlign = "left"; x.fillText(job.title + (job.night ? "  ·  round " + (S.night.round + 1) : ""), 20, 36);
    x.fillStyle = "#ffd86b"; x.font = "700 18px system-ui"; x.fillText(m.name + "  ·  t = " + b.t.toFixed(1) + " s" + (b.hold > 0 && !b.done ? "  ·  holding " + b.hold.toFixed(1) + " / " + (g.hold || 2) + " s" : ""), 20, 62);
    drawMachine(x, 130, 160, 1.1, m, S.ang);
    // load drum
    x.fillStyle = "#5a6577"; x.fillRect(205, 135, 70, 50); x.fillStyle = "#fff"; x.font = "700 15px system-ui"; x.textAlign = "center";
    x.fillText(m.kind === "gen" ? "R " + (b.a.RL || 0).toFixed(0) + " Ω" : b.load.kind === "fan" ? "fan" : b.load.kind === "hoist" ? "hoist" : b.load.kind === "const" ? MS.loadTorque(b.load, 1, b.t).toFixed(0) + " N·m" : "free", 240, 166);
    var lim = job.breaker || m.Ia * 2, r = MS.rpm(b);
    gauge(x, 390, 150, 62, r, Math.max(2000, Math.abs(r)), "speed", "rpm", false);
    gauge(x, 560, 150, 50, b.Ia, lim, "Ia", "A", Math.abs(b.Ia) > lim * .8);
    gauge(x, 710, 150, 50, m.kind === "gen" ? b.Vt : (b.a.Va || 0), 240, m.kind === "gen" ? "Vt" : "Va", "V", false);
    gauge(x, 860, 150, 50, m.kind === "gen" ? b.P / 1000 : b.T, m.kind === "gen" ? 5 : 30, m.kind === "gen" ? "P" : "T", m.kind === "gen" ? "kW" : "N·m", false);
    // target band on a speed strip
    if (!(api.settings && api.settings.get && api.settings.get("plot") === false)) plot(x, 20, 250, 560, 210, b);
    // knobs
    var ks = knobs(); x.textAlign = "left";
    ks.forEach(function (n, i) { var d = MS.KNOB[n], y = 262 + i * 52, sel = i === S.sel % ks.length;
      x.fillStyle = sel ? "#2f4256" : "#222a33"; x.fillRect(600, y, 340, 44); if (sel) { x.strokeStyle = "#f6c445"; x.lineWidth = 3; x.strokeRect(600, y, 340, 44); }
      x.fillStyle = "#cfe3ff"; x.font = "700 18px system-ui"; x.fillText(d.label, 612, y + 28);
      var v = b.k[n], s = n === "on" || n === "brake" ? (v ? "ON" : "OFF") : (Math.abs(v) < 10 && v % 1 ? v.toFixed(2) : v.toFixed(0)) + " " + d.unit;
      x.fillStyle = "#fff"; x.font = "800 22px system-ui"; x.textAlign = "right"; x.fillText(s, 928, y + 29); x.textAlign = "left"; });
    if (b.trip) { x.fillStyle = "rgba(120,10,10,.85)"; x.fillRect(600, 470, 340, 40); x.fillStyle = "#fff"; x.font = "800 20px system-ui"; x.textAlign = "center"; x.fillText("BREAKER TRIPPED — reset with the supply", 770, 497); }
    if (S.note && S.note.life > 0) { x.fillStyle = "rgba(6,10,16,.92)"; x.fillRect(20, 470, 560, 60); x.fillStyle = "#ffe9a8"; x.font = "600 16px system-ui"; x.textAlign = "left"; wrap(x, S.note.t, 30, 492, 540, 20); }
    else { x.fillStyle = "#9fb3c8"; x.font = "600 17px system-ui"; x.textAlign = "left"; x.fillText(shortGoal(job), 20, 500); }
  }
  function shortGoal(job) { var g = job.goal; return "Goal: " + (g.rpm ? g.rpm[0] + "–" + g.rpm[1] + " rpm " : "") + (g.Vt ? g.Vt[0] + "–" + g.Vt[1] + " V " : "") + (g.P ? g.P[0] + "–" + g.P[1] + " W " : "") + (g.Ia ? "Ia ≤ " + g.Ia[1] + " A " : "") + (g.stop ? "stop < " + g.stop + " rpm in " + g.within + " s" : "") + "   (H: why)"; }
  function wrap(x, s, px, py, w, lh) { var words = s.split(" "), line = ""; words.forEach(function (wd) { var t = line ? line + " " + wd : wd; if (x.measureText(t).width > w) { x.fillText(line, px, py); py += lh; line = wd; } else line = t; }); if (line) x.fillText(line, px, py); }
  /* torque–speed plane: the motor's line through the present settings, the load curve, and where you are */
  function plot(x, px, py, w, h, b) {
    var m = b.m, job = b.job; x.fillStyle = "#0e1318"; x.fillRect(px, py, w, h); x.strokeStyle = "#2b3542"; x.lineWidth = 1; x.strokeRect(px, py, w, h);
    if (m.kind === "gen") { // terminal characteristic Vt against Ia
      var E = b.E; x.strokeStyle = "#7ef0ff"; x.lineWidth = 3; x.beginPath(); for (var i = 0; i <= 30; i++) { var Ia = i, Vt = E - Ia * m.Ra; var X = px + i / 30 * w, Y = py + h - clamp(Vt / 260, 0, 1) * h; if (i) x.lineTo(X, Y); else x.moveTo(X, Y); } x.stroke();
      if (job.goal.Vt) { x.fillStyle = "rgba(61,214,140,.18)"; var y1 = py + h - job.goal.Vt[1] / 260 * h, y0 = py + h - job.goal.Vt[0] / 260 * h; x.fillRect(px, y1, w, y0 - y1); }
      var dx = px + clamp(b.Ia / 30, 0, 1) * w, dy = py + h - clamp(b.Vt / 260, 0, 1) * h; x.fillStyle = "#f6c445"; x.beginPath(); x.arc(dx, dy, 9, 0, 7); x.fill();
      x.fillStyle = "#9fb3c8"; x.font = "600 15px system-ui"; x.textAlign = "left"; x.fillText("terminal volts (up) against load current (across): Vt = E − Ia·Ra", px + 8, py + 20); return;
    }
    var Tmax = 40, Wmax = 2600, sx = function (T) { return px + w / 2 + T / Tmax * (w / 2); }, sy = function (r) { return py + h / 2 - r / Wmax * (h / 2); };
    x.strokeStyle = "#2b3542"; x.beginPath(); x.moveTo(px + w / 2, py); x.lineTo(px + w / 2, py + h); x.moveTo(px, py + h / 2); x.lineTo(px + w, py + h / 2); x.stroke();
    if (job.goal.rpm) { x.fillStyle = "rgba(61,214,140,.18)"; var a = sy(job.goal.rpm[1]), c = sy(job.goal.rpm[0]); x.fillRect(px, a, w, c - a); }
    // motor: speed as a function of torque for the present supply and field
    if (m.kind !== "series" && b.kp) { var Va = b.a.brake ? 0 : (b.a.Va || 0), R = m.Ra + (b.a.Rst || 0) + (b.a.brake ? (b.a.Rb || 10) : 0); x.strokeStyle = "#7ef0ff"; x.lineWidth = 3; x.beginPath();
      for (var T = -Tmax; T <= Tmax; T += 2) { var wv = (Va - T / b.kp * R) / b.kp * RPM; var X = sx(T), Y = sy(wv); if (T > -Tmax) x.lineTo(X, Y); else x.moveTo(X, Y); } x.stroke(); }
    // load
    x.strokeStyle = "#ff9f5a"; x.lineWidth = 3; x.beginPath(); for (var rr = -Wmax; rr <= Wmax; rr += 50) { var TL = MS.loadTorque(b.load, rr / RPM, b.t), X2 = sx(TL), Y2 = sy(rr); if (rr > -Wmax) x.lineTo(X2, Y2); else x.moveTo(X2, Y2); } x.stroke();
    x.strokeStyle = "rgba(246,196,69,.6)"; x.lineWidth = 2; x.beginPath(); S.trace.forEach(function (p, i) { var X = sx(clamp(p[1] * (b.kp || 1), -Tmax, Tmax)), Y = sy(p[0]); if (i) x.lineTo(X, Y); else x.moveTo(X, Y); }); x.stroke();
    x.fillStyle = "#f6c445"; x.beginPath(); x.arc(sx(clamp(b.T, -Tmax, Tmax)), sy(MS.rpm(b)), 9, 0, 7); x.fill();
    x.fillStyle = "#9fb3c8"; x.font = "600 15px system-ui"; x.textAlign = "left"; x.fillText("speed (up) against torque (across): blue = motor, orange = load, dot = now", px + 8, py + 20);
  }

  /* ---------- cheats and the maker ---------- */
  var CH = /*CH[*/{"skip":["88eb8e09644e2f1ba9240372639bf5c5cd2dcb4d054f2d19873e3bd8ee01090d","a56112a7d8749c11ff3ab0235abab203d448c0bbe21f7cbabac6c702836bc787"],"solve":["6582529e0aa9e9c6a02c25c5c09c8ac863c4c1c18dc492c1ebcfad3e1143cc4b","12f5893f674ce3f5a309c8f809ddeb14a9887994b955313020025ed9db1be900"],"notrip":["66e220983db18be029d91c5ac91e025eeeafebc4d0a999160eaffaf5a4ce094a","9f099eb60956518c6887b9a8ddd5a9f116a3c0d7c132f9456c9676ef1f075d7f"],"stars":["20106ecfe56ff4dbdf5797704f2817acf855b53f70999db86492239bd1c936de","7e1442d670bfcf17f788ee3bc72bbef926a4b73176452c6f5a8ef06cba1a730b"],"halls":["6129ab8a42f35a39d7e0a4a2b95bbfbb1098ab5762be9b1e8b488ff3a0b5859c","2d351bd8c37267e76c6cbed4c9e1e996bea733b2f4d78e2c8d1269b5501cc263"],"night":["d68ac03b1849e17782075503721ee542f6c890caec66bcec3b8c4bf25e7823ec","448364ba013b7e20d2c4758138f224f8b0ff9663790296772e07eca706bd4120"],"slow":["203adc2c146f8637ae78c45d37be3acc4b5c73b1191e52491a02d725fe690468","d2d85eda0ac40004f6b2214f253517941b4bd7398f0bd9700139480831b3fb55"],"party":["b00b8a17b8ef6b8db50c4c36c415c5ee43f168bc3f24053adecb479b50e4450a","05bd493ccd2bc70d778b1763160672f0164d0faf1acff79dfc77b8c2696a0e42"],"_combo":"f65e5c8b9a60997b5e38701a478d8d1fc745abf132bf6005618801781d9e43ee","_swipe":"a4e50306aa1d10d23bd13992f727ba04e7d5956dac6af42903b30e7dd0b47e26"}/*]CH*/;
  function solveNow() { if (!S.b) return; var j = S.b.job; if (j.solve) Object.keys(j.solve).forEach(function (n) { S.b.k[n] = j.solve[n]; if (n !== "Va" && n !== "Pm" && n !== "If") S.b.a[n] = j.solve[n]; }); }
  function setupCheats(api) {
    api.cheats({
      skip: { label: "Finish this job", h: CH.skip, run: function () { if (S.b && !S.done) { S.b.done = true; S.b.at = Math.min(S.b.t || 1, S.b.job.par); win(api); } } },
      solve: { label: "Set the right controls", h: CH.solve, run: solveNow },
      notrip: { label: "Breakers never trip", h: CH.notrip, run: function () { noTrip = true; } },
      stars: { label: "Three stars for this job", h: CH.stars, run: function () { if (S.b && !S.b.job.night) { save.stars[S.b.job.id] = 3; persist(); } } },
      halls: { label: "Every hall open", h: CH.halls, run: function () { S.allOpen = true; } },
      night: { label: "Open the Night shift", h: CH.night, run: function () { startNight(api); } },
      slow: { label: "Slow motion", h: CH.slow, run: function () { api.slowmo(.5, 20); } },
      party: { label: "Confetti storm", h: CH.party, run: function () { api.confetti(400); } }
    });
    if (CH._combo) api.secret({ combo: CH._combo, swipe: CH._swipe, onReveal: function () { menu(api); } });
  }
  function menu(api) {
    api.show("<h2>Motorworks Trails</h2><p>A storm took the workshop's manager and left every machine half-wired. Walk the halls, open a bay, and set supply, field and load until each machine does its job. The DC machine maths is real: back-EMF, torque, field weakening, generators and braking.</p>" +
      "<p><b>★ " + total() + " / " + J.length * 3 + "</b>" + (save.night ? " · Night shift best " + save.night : "") + "</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='go'>" + (save.seen ? "Back to the workshop" : "Start") + "</button>" +
      (total() >= 18 || hero() ? "<button class='gm-btn' data-act='night'>🌙 Night shift</button>" : "") + "</div>", function (a) { api.hide(); if (a === "night") startNight(api); else hub(api); });
  }

  var game = {
    song: A.song(900, "lofi"),
    menu: function (api) { S.night = null; menu(api); },
    actions: [
      { id: "up", label: "Walk up", keys: ["ArrowUp", "KeyW"], touch: { label: "▲", x: 13, y: 70 } }, { id: "down", label: "Walk down", keys: ["ArrowDown", "KeyS"], touch: { label: "▼", x: 13, y: 90 } },
      { id: "left", label: "Walk left", keys: ["ArrowLeft", "KeyA"], touch: { label: "◀", x: 5, y: 80 } }, { id: "right", label: "Walk right", keys: ["ArrowRight", "KeyD"], touch: { label: "▶", x: 21, y: 80 } },
      { id: "act", label: "Open a bay / use a door", keys: ["KeyE", "Enter", "Space"], touch: { label: "E", x: 91, y: 82 } }, { id: "menu", label: "Workshop menu", keys: ["KeyM"], touch: { label: "☰", x: 93, y: 12 } },
      { id: "kprev", label: "Previous control", keys: ["ShiftLeft", "ArrowUp"], touch: { label: "◀", x: 64, y: 88 } }, { id: "knext", label: "Next control", keys: ["Tab", "ArrowDown"], touch: { label: "▶", x: 74, y: 88 } },
      { id: "minus", label: "Turn down", keys: ["KeyQ", "ArrowLeft", "Minus"], touch: { label: "−", x: 84, y: 88 } }, { id: "plus", label: "Turn up", keys: ["KeyE", "ArrowRight", "Equal"], touch: { label: "+", x: 94, y: 88 } },
      { id: "hint", label: "Why does this work?", keys: ["KeyH"], touch: { label: "?", x: 6, y: 12 } }, { id: "back", label: "Leave the bay", keys: ["KeyB", "Escape"], touch: { label: "⏏", x: 16, y: 12 } }
    ],
    click: function (mx, my, api) {
      if (api.overlayOpen()) return;
      if (S.mode === "hub") { S.tx = mx; S.ty = clamp(my, 120, 470); return; }
      if (S.mode === "bench" && mx > 600) { var i = Math.floor((my - 262) / 52), ks = knobs(); if (i >= 0 && i < ks.length) { if (S.sel % ks.length === i) nudge(api, mx > 770 ? 1 : -1); else S.sel = i; } }
    },
    init: function (api) {
      api0 = api; setupCheats(api);
      if (api.settings && api.settings.add) {
        api.settings.add({ id: "repeat", tab: "gameplay", label: "Knob repeat speed", type: "slider", default: 1, min: .5, max: 2, step: .25, format: function (v) { return Math.round(v * 100) + "%"; }, help: "How fast a held − or + keeps turning a control." });
        api.settings.add({ id: "plot", tab: "gameplay", label: "Torque–speed picture", type: "toggle", default: true, help: "Shows the motor and load curves with your operating point." });
      }
      api.panel("<p>Every bay runs the DC machine equations, recalculated 720 times a second.</p><table><tr><td>Back-EMF</td><td><span class='gm-eq'>E = kφ·ω</span></td></tr><tr><td>Armature</td><td><span class='gm-eq'>Va = E + Ia·(Ra + Rst)</span></td></tr><tr><td>Torque</td><td><span class='gm-eq'>T = kφ·Ia</span></td></tr><tr><td>Mechanics</td><td><span class='gm-eq'>J dω/dt = T − T_load − Bω</span></td></tr><tr><td>Generator</td><td><span class='gm-eq'>Vt = E − Ia·Ra</span></td></tr><tr><td>Dynamic braking</td><td><span class='gm-eq'>Ia = −E / (Ra + Rb)</span></td></tr></table>" +
        "<p class='gm-small'>Model: the field flux follows a saturating curve kφ = K·tanh(If/Is); armature inductance, brush drop and armature reaction are ignored; the breaker trips on 0.25 s above its setting or instantly at 1.6×. Course: EEEN 309, electromechanical energy conversion and DC machine construction.</p>",
        "<p class='gm-small'>Walk with the arrows or tap the floor. In a bay, ◀ ▶ picks a control and − + changes it; or tap a control, then tap its right half to raise it and its left half to lower it.</p>");
      menu(api);
    },
    update: function (dt, api) {
      if (api.hero.inUse !== api.hero.active) api.hero.use(api.hero.active);
      if (S.note) S.note.life -= dt;
      if (S.mode === "bench") return benchUpdate(dt, api);
      if (api.overlayOpen()) return;
      var vx = (api.down("right") ? 1 : 0) - (api.down("left") ? 1 : 0), vy = (api.down("down") ? 1 : 0) - (api.down("up") ? 1 : 0);
      if (vx || vy) S.tx = null; else if (S.tx != null) { var dx = S.tx - S.px, dy = S.ty - S.py, d = Math.hypot(dx, dy); if (d < 6) S.tx = null; else { vx = dx / d; vy = dy / d; } }
      var sp = 260 * dt; S.px = clamp(S.px + vx * sp, 40, 920); S.py = clamp(S.py + vy * sp, 120, 470); if (vx) S.face = vx > 0 ? 1 : -1; if (vx || vy) S.walkT += dt;
      if (api.hit("menu")) return menu(api);
      if (api.hit("act")) {
        var nb = nearBench(), nd = nearDoor();
        if (nb) return openBay(api, nb.job);
        if (nd === "next" && S.hall < 4) { if (hallOpen(S.hall + 1)) { S.hall++; S.px = 90; api.sound.sfx("power"); api.banner("HALL " + (S.hall + 1), { dur: 1.4 }); hub(api); } else { api.sound.sfx("block"); } return; }
        if (nd === "prev" && S.hall > 0) { S.hall--; S.px = 860; hub(api); return; }
        if (Math.hypot(S.px - 855, S.py - 497) < 90 && (S.hall === 4 || total() >= 18)) return startNight(api);
      }
    },
    draw: function (api) { if (S.mode === "bench" && S.b) drawBench(api); else drawHub(api); }
  };
  A.run(game);
  window.Motorworks = { S: S, save: save, jobs: J, openBay: function (j) { openBay(api0, j); }, startNight: function () { startNight(api0); } };
})();
