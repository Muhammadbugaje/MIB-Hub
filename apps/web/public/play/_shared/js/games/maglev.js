/* Maglev Rescue (EEEN 320: time-varying fields, magnetic force). Tune the gap controller that holds a magnetically
 * suspended pod under its rail, then carry it down the line through rail joints, payload changes and gusts.
 * Physics (F = K·(I/g)², unstable equilibrium, coil inductance, PID control): maglevsim.js. */
(function () {
  "use strict";
  var A = window.Arcade, Mg = window.MaglevSim, LK = window.LabKit, SLUG = "maglev-rescue", ACC = "#a78bfa";
  var save = LK.load(A, "maglev", { cleared: 0, stars: {}, best: 0, mib: false, gains: { kp: 1.5, kd: 20, ki: 0 }, opts: { hints: true, chart: true, calm: false } });
  function persist() { A.store("maglev", save); }
  var S = null, run = false, endless = null, gref = 10, CT = {}, API0 = null, tunedLv = null;
  var CH = /*CH[*/{"skip":["c4162bb9f48cb8bb2008abf1914dffcfdcfd7c725ab6434d5376114c431d30c8","8172afe645f1800cf43630d4fb879be4d05889e6980f033f5cc161888bd1db92"],"design":["470267b19a13246ce9dba8f514550fc81811533a6ad79fdefac7aad780a0472d","fccdec04470576dad705fb2e2df6b7b7c17338c4e02f3823cdf54d177fc8975c"],"shield":["df9a138dd7ab9d4b6174846fa36a6558fc81fe759c98b9af282595b146267d57","49b04e2eb7e1551644ebf8fda7aeaa08ea313ede73aff657b4c8d8e687e01822"],"calm":["500276ee561427387585e3f0e8ad8ec377ab18b341102c28d5754b2b31e75f3e","6343a9703d8fca25106c7df2f7966637d41fba1d2cdcbaed4a114035c269ecfb"],"light":["2ccc2edc5db1e411c8b0ba6e7efdb67491273eef49c656ec3ee254c6cf35a200","1908a96e392d9160902538b068e3105c9c5a617d1a9b9061f671eae4bb35ac81"],"unlock":["d36d1cdcb0ea6b3eb8c76c24ac598ade7d4d97005e6528b00fa74b030620ba52","6d53a03c8a5ce8dd3252867a7a2df87dbf54f4ca3ba0a78c7de6ee8f0cb6437f"],"slow":["e5675bcc7b2aee57ba9e327b40d04437f704edfecaf75c1a505ae8317ba3fc32","6ed18672c20927c824515e31d062e3a8860382584e9a425540e71e0cec24e3df"],"party":["2f883c56261217c7f9f6a4c97efa458ee3034b5fa96b63db13d329ca061f9efb","065910ea7a469a4090c12102c29d283ba54899d35375a9057e4f09ca57b09cd9"],"_combo":"3c739ab7ca6f1304f50a6c42919d9c0340913ac193a2ed1b430b4f33f14bfafd","_swipe":"11fcee443387660e35802488e4cc3c8645ed79b74e3fc5f52185d824ce56e6bc"}/*]CH*/;
  function heroOn() { return !!(API0 && API0.hero.active && save.mib); }
  function setupCheats(api) {
    API0 = api;
    api.cheats({
      skip: { label: "Deliver this pod", h: CH.skip, run: function () { if (S && !S.done) { S.done = true; S.win = true; S.why = "Delivered (skipped)."; } } },
      design: { label: "Engineer's gains fitted", h: CH.design, run: function () { if (S) S.gains = Mg.botGains(S.Lv); save.gains = Mg.botGains((S && S.Lv) || Mg.LEVELS[0]); persist(); } },
      shield: { label: "Rail contact forgiven", h: CH.shield, run: function () { CT.shield = 1; if (S) S.scrapes = 0; } },
      calm: { label: "Gusts and sensor noise off", h: CH.calm, run: function () { if (S) { S.Lv = Object.assign({}, S.Lv, { noise: 0 }); S.T = Object.assign({}, S.T, { gust: [] }); } } },
      light: { label: "Payloads removed", h: CH.light, run: function () { if (S) S.T = Object.assign({}, S.T, { load: [] }); } },
      unlock: { label: "Every line open", h: CH.unlock, run: function () { save.cleared = Math.max(save.cleared, Mg.LEVELS.length); persist(); } },
      slow: { label: "Slow motion", h: CH.slow, run: function () { api.slowmo(.5, 20); } },
      party: { label: "Confetti storm", h: CH.party, run: function () { api.confetti(400); } }
    });
    api.secret({ combo: CH._combo, swipe: CH._swipe, onReveal: function () { menu(api); } });
  }
  function drawStep(cv, gains, Lv) {
    if (!cv) return null; var x = cv.getContext("2d"), r = Mg.stepTest(gains, Lv), w = cv.width, h = cv.height;
    x.fillStyle = "#0b1520"; x.fillRect(0, 0, w, h);
    var py = function (v) { return h - 14 - (v - 8) / 8 * (h - 30); }, px = function (i) { return 10 + i / (r.trace.length - 1 || 1) * (w - 20); };
    x.fillStyle = "rgba(61,214,140,.15)"; x.fillRect(0, py(12.4), w, py(11.6) - py(12.4));
    x.strokeStyle = "rgba(255,255,255,.35)"; x.setLineDash([5, 4]); x.beginPath(); x.moveTo(0, py(12)); x.lineTo(w, py(12)); x.stroke(); x.setLineDash([]);
    x.strokeStyle = r.stable ? "#3dd68c" : "#ff6b6b"; x.lineWidth = 3; x.beginPath(); r.trace.forEach(function (v, i) { var Y = Math.max(4, Math.min(h - 4, py(v))); if (i) x.lineTo(px(i), Y); else x.moveTo(px(i), Y); }); x.stroke();
    x.fillStyle = "#e6f1ff"; x.font = "600 15px system-ui"; x.fillText("Gap after a 2 mm step (0.6 s)", 10, 18);
    return r;
  }
  function tune(api, Lv, go) {
    var g = save.gains, l = Mg.lin(Mg.M0, Mg.G0), html = "<h2>" + LK.esc(Lv.name) + "</h2><p>" + Lv.track.len + " m at " + Lv.track.v + " m/s · " + Lv.track.rail.length + " rail joints · " + Lv.track.load.length + " payload change" + (Lv.track.load.length === 1 ? "" : "s") + " · " + Lv.track.gust.length + " gust" + (Lv.track.gust.length === 1 ? "" : "s") +
      " · keep within ±" + (Lv.spec * 1000).toFixed(1) + " mm · coil limit " + Lv.imax + " A, " + Lv.vmax + " V" + (Lv.noise ? " · sensor noise " + (Lv.noise * 1000).toFixed(2) + " mm" : "") + ".</p>" +
      "<div class='lk-teach'>" + LK.esc(Lv.teach) + "</div>" +
      LK.slider("kp", "Kp (A per mm)", 0, 8, 0.05, g.kp, "A/mm") + LK.slider("kd", "Kd (A per mm/s)", 0, 120, 1, g.kd, "A·ms/mm") + LK.slider("ki", "Ki (A per mm·s)", 0, 80, 0.5, g.ki, "A/mm·s") +
      "<canvas class='lk-canvas' width='560' height='170' data-step aria-label='Step response preview'></canvas><p class='gm-small' data-verdict></p>" +
      (save.opts.hints ? "<p class='gm-small'>The magnet's pull grows as the gap closes, so Kp must exceed I0/g0 ≈ " + (l.a / l.b / 1000).toFixed(2) + " A/mm. Kd adds damping; Ki removes the sag from heavier payloads.</p>" : "") +
      "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='go'>Lift off</button>" + (heroOn() ? "<button class='gm-btn' data-act='auto'>MIB: fit engineer's gains</button>" : "") + "<button class='gm-btn' data-act='back'>Lines</button></div>";
    var refresh = function () { var root = LK.overlay(), r = drawStep(root && root.querySelector("[data-step]"), save.gains, Lv), v = root && root.querySelector("[data-verdict]");
      if (v && r) v.textContent = r.stable ? "Stable · overshoot " + r.overshoot.toFixed(0) + "% · settles at " + r.final.toFixed(1) + " mm" : "Unstable: the pod hits the rail or falls away. Raise Kp above " + (l.a / l.b / 1000).toFixed(2) + " A/mm and add Kd."; };
    api.show(html, function (a) { if (a === "back") return menu(api); if (a === "auto") { save.gains = Mg.botGains(Lv); persist(); return tune(api, Lv, go); } if (a === "go") { api.hide(); go(); } });
    LK.bindSliders(LK.overlay(), function (id, v) { save.gains[id] = v; persist(); refresh(); }); refresh();
  }
  function begin(api, Lv) { try { if (window.MIBPlay) MIBPlay.level(Lv.id); } catch (mibErr) {} /* MIB-Hub: play tracking */
    gref = 10; S = Mg.start(Lv, Object.assign({}, save.gains), gref); run = true; CT.shield = 0; tunedLv = Lv;
    api.useActions(["gup", "gdown", "retune"]); api.music(A.song(5100 + Lv.id * 11, Lv.id > 18 ? "boss" : Lv.id > 9 ? "synthwave" : "calm"));
    api.banner(Lv.name.toUpperCase(), { size: 70, sub: "Hold the gap", dur: 1.3 });
  }
  function play(api, k) { endless = null; var Lv = Mg.LEVELS[k]; tune(api, Lv, function () { begin(api, Lv); }); }
  function startEndless(api) { endless = { k: 0, dist: 0 }; var Lv = Mg.endlessLevel(0); tune(api, Lv, function () { begin(api, Lv); }); }
  function finish(api) {
    run = false; LK.clearHud(); var Lv = S.Lv, win = S.win, st = Mg.stars(S), k = Lv.id - 1, rmsmm = Mg.rms(S) * 1000;
    if (endless) {
      if (win) { endless.k++; endless.dist += S.T.len; api.sound.sfx("coin"); api.banner("STRETCH " + endless.k + " CLEAR", { size: 56, dur: 1 }); begin(api, Mg.endlessLevel(endless.k)); return; }
      var dist = Math.round(endless.dist + S.x), rec = dist > (save.best || 0); if (rec) { save.best = dist; persist(); }
      A.report(SLUG, { result: endless.k >= 5 ? "win" : "lose", stage: 1, score: dist });
      api.ceremony(rec && endless.k ? "newRecord" : endless.k >= 3 ? "win" : "lose", { title: rec ? "NEW RECORD!" : "GAUNTLET OVER", sub: endless.k + " stretches", score: dist, scoreLabel: "Metres carried", stats: [["Best", (save.best || 0) + " m"]], line: S.why,
        tip: "Faster stretches bring joints more often: raise the loop's bandwidth with Kp and keep Kd high enough to damp it.",
        then: function () { api.show("<h2>Gauntlet over</h2><p>" + LK.esc(S.why) + "</p><p>You carried the pod <b>" + dist + " m</b>.</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='again'>Again</button><button class='gm-btn' data-act='menu'>Lines</button></div>", function (a) { if (a === "again") startEndless(api); else menu(api); }); } });
      return;
    }
    if (win) { save.cleared = Math.max(save.cleared, k + 1); save.stars[Lv.id] = Math.max(save.stars[Lv.id] || 0, st); persist(); }
    A.report(SLUG, { result: win ? "win" : "lose", stage: Lv.id, score: Math.max(0, Math.round(1000 - rmsmm * 200)) + (win ? 300 + st * 100 : 0) });
    var last = k === Mg.LEVELS.length - 1, next = win && !last;
    api.ceremony(win ? (last ? "gameComplete" : st === 3 ? "newRecord" : "stageClear") : "lose", { title: win ? (last ? "LINE RESTORED!" : "DELIVERED!") : (S.scrapes >= 3 ? "RAIL STRIKE" : "POD DOWN"), sub: Lv.name, trophy: win ? (last ? "crown" : "medal") : "none",
      score: Math.round(S.x), scoreLabel: "Metres carried", stars: win ? st : null, stats: [["RMS gap error", rmsmm.toFixed(2) + " mm"], ["Worst error", (S.maxErr * 1000).toFixed(1) + " mm"], ["Rail contacts", S.scrapes], ["Coil energy", Math.round(S.energy) + " J"]],
      line: win ? (st === 3 ? "Silky. Not a single touch." : "Delivered. Tighter error or no contacts earns the next star.") : S.why,
      tip: Lv.teach, then: function () {
        api.show("<h2>" + (win ? "Pod delivered" : "Trip failed") + "</h2><p>" + LK.esc(S.why) + "</p><div class='lk-teach'>" + LK.esc(Lv.teach) + "</div>" +
          "<div class='gm-actions'>" + (next ? "<button class='gm-btn gm-btn--go' data-act='next'>Next line</button>" : "") + "<button class='gm-btn" + (next ? "" : " gm-btn--go") + "' data-act='retry'>Retune and retry</button><button class='gm-btn' data-act='menu'>Lines</button></div>",
          function (a) { if (a === "next") play(api, k + 1); else if (a === "retry") play(api, k); else menu(api); });
      } });
  }
  function menu(api) {
    run = false; LK.clearHud();
    api.show("<h2>Maglev Rescue</h2><p>Engineers are stranded down the maglev line. Each pod hangs under its rail on an electromagnet that pulls harder the closer it gets: left alone it slams into the rail or falls away. Tune the gap controller, then carry them home. " + save.cleared + " of " + Mg.LEVELS.length + " lines open.</p>" +
      LK.grid(Mg.LEVELS, save, heroOn()) +
      "<div class='gm-actions'><button class='gm-btn' data-act='endless'>Endless gauntlet" + (save.best ? " · best " + save.best + " m" : "") + "</button>" + (api.hero.active ? "<button class='gm-btn' data-act='mib' aria-pressed='" + !!save.mib + "'>" + (save.mib ? "M.I. BUGAJE on (perfect gains)" : "Play as M.I. BUGAJE") + "</button>" : "") + "</div>" +
      "<p class='gm-small'>Hints, the live chart and calm visuals are in Settings → Gameplay.</p>",
      function (a, el) { if (a === "lv") play(api, +el.getAttribute("data-k")); else if (a === "endless") startEndless(api); else if (a === "mib") { save.mib = !save.mib; persist(); menu(api); } });
  }
  function update(dt, api) {
    if (api.hero.inUse !== heroOn()) api.hero.use(heroOn());
    if (!run || !S || api.overlayOpen()) return;
    if (api.hit("gup")) gref = Math.min(16, gref + 0.5); if (api.hit("gdown")) gref = Math.max(6, gref - 0.5); S.gref = gref / 1000;
    var G = S.gains; if (api.hit("kpup")) G.kp = Math.min(8, G.kp + 0.1); if (api.hit("kpdn")) G.kp = Math.max(0, G.kp - 0.1); if (api.hit("kdup")) G.kd = Math.min(120, G.kd + 2); if (api.hit("kddn")) G.kd = Math.max(0, G.kd - 2);
    if (api.hit("retune")) { var Lv = S.Lv; run = false; tune(api, Lv, function () { S.gains = Object.assign({}, save.gains); run = true; }); return; }
    if (heroOn()) S.gains = Mg.botGains(S.Lv);
    var sc = S.scrapes; Mg.step(S, dt); if (CT.shield) S.scrapes = 0;
    if (S.scrapes > sc) { api.sound.sfx("hit"); api.kick(6); api.buzz(50); api.flash("#ff9d5c", .15); }
    var gap = (S.g - Mg.railAt(S.T, S.x)) * 1000, err = Math.abs(gap - gref);
    LK.hud([[S.Lv.name, ""], ["Gap", gap.toFixed(1) + " mm", err > S.Lv.spec * 1000 ? "bad" : err > S.Lv.spec * 500 ? "warn" : "ok"], ["Target", gref.toFixed(1) + " mm"], ["Coil", S.I.toFixed(1) + " A", S.I > S.Lv.imax * 0.95 ? "bad" : ""],
      ["Load", (Mg.massAt(S.T, S.x)).toFixed(0) + " kg"], ["Line", Math.round(S.x) + "/" + S.T.len + " m"], ["Contacts", S.scrapes + "/3", S.scrapes ? "warn" : ""], ["Kp", S.gains.kp.toFixed(2)], ["Kd", S.gains.kd.toFixed(0)], ["Ki", S.gains.ki.toFixed(1)]].concat(heroOn() ? [["MIB", "auto"]] : []), ACC);
    if (S.done) finish(api);
  }
  function draw(api) {
    var x = api.x, t = api.t, calm = save.opts.calm || api.reduce;
    var g = x.createLinearGradient(0, 0, 0, 540); g.addColorStop(0, "#130f26"); g.addColorStop(1, "#271c4a"); x.fillStyle = g; x.fillRect(0, 0, 960, 540);
    if (!S) return;
    var T = S.T, px = function (wx) { return 300 + (wx - S.x) * 22; }, railY = function (wx) { return 150 + Mg.railAt(T, wx) * 1000 * 6; }, w;
    // rail with joints
    x.fillStyle = "#58607a"; for (w = Math.floor(S.x - 16); w < S.x + 32; w += 0.5) { var X = px(w); if (X < -20 || X > 980) continue; x.fillRect(X, railY(w) - 18, 12, 18); }
    T.rail.forEach(function (e) { var X = px(e.x); if (X > -10 && X < 970) { x.fillStyle = "#ffb347"; x.fillRect(X - 2, railY(e.x) - 22, 4, 26); } });
    T.load.forEach(function (e) { var X = px(e.x); if (X > -10 && X < 970) { x.fillStyle = e.kg ? "#3dd68c" : "#7ef0ff"; x.font = "700 14px system-ui"; x.textAlign = "center"; x.fillText(e.kg ? "+" + e.kg + " kg" : "drop-off", X, 300); x.fillRect(X - 1, 250, 2, 36); } });
    T.gust.forEach(function (e) { var X = px(e.x); if (X > -60 && X < 1000 && !calm) { x.strokeStyle = "rgba(200,220,255,.5)"; x.lineWidth = 2; for (var k = 0; k < 3; k++) { var yy = 200 + k * 18 + Math.sin(t * 6 + k) * 4; x.beginPath(); x.moveTo(X, yy); x.lineTo(X + e.len * 22, yy + (e.n > 0 ? 8 : -8)); x.stroke(); } } });
    // pod hanging under the rail at the current gap (gap drawn 6 px per mm)
    var gap = (S.g - Mg.railAt(T, S.x)) * 1000, ry = railY(S.x), podY = ry + gap * 6, glow = Math.min(1, S.I / 30);
    x.strokeStyle = "rgba(167,139,250," + (0.3 + 0.6 * glow) + ")"; x.lineWidth = 2; x.setLineDash([4, 4]); // field lines across the air gap
    for (w = 0; w < 6; w++) { var fxl = 262 + w * 15; x.beginPath(); x.moveTo(fxl, ry + 1); x.lineTo(fxl, podY - 1); x.stroke(); } x.setLineDash([]);
    x.fillStyle = "#2b2f45"; x.fillRect(255, podY, 90, 14); x.fillStyle = "#e8ecf6"; x.beginPath(); x.moveTo(240, podY + 14); x.lineTo(360, podY + 14); x.quadraticCurveTo(380, podY + 40, 360, podY + 70); x.lineTo(240, podY + 70); x.quadraticCurveTo(220, podY + 40, 240, podY + 14); x.fill();
    x.fillStyle = "#7ef0ff"; for (w = 0; w < 4; w++) x.fillRect(250 + w * 26, podY + 26, 18, 16);
    var who = A.styled(heroOn() ? (A.byId.mib || A.cast[0]) : A.cast[0]); A.drawHead(x, who, 263, podY + 34, 9, 1, { mood: S.scrapes ? "sad" : "happy" });
    if (S.lastScrape && t > 0 && S.t - S.lastScrape < 0.15 && !calm) { x.fillStyle = "#ffd86b"; for (w = 0; w < 6; w++) x.fillRect(250 + Math.random() * 100, ry + Math.random() * 6, 3, 3); }
    // gap gauge
    x.fillStyle = "#e6f1ff"; x.font = "700 16px system-ui"; x.textAlign = "left"; x.fillText("gap " + gap.toFixed(1) + " mm", 372, ry + gap * 3 + 6);
    if (save.opts.chart) {
      var r = { x: 20, y: 352, w: 920, h: 176 }, h = S.hist, t0 = h.length ? h[0][0] : 0, t1 = h.length ? h[h.length - 1][0] : 1, sp = S.Lv.spec * 1000;
      LK.plot(x, r, [{ pts: h.map(function (p) { return [p[0], p[1]]; }), col: "#a78bfa", w: 2.5 }, { pts: h.map(function (p) { return [p[0], 6 + p[2] / S.Lv.imax * 10]; }), col: "rgba(255,216,107,.7)", w: 1.5 }],
        { x0: t0, x1: Math.max(t1, t0 + 1), y0: 4, y1: 18, band: [gref - sp, gref + sp], lines: [{ y: gref, col: "rgba(255,255,255,.4)" }], title: "Gap (mm) with the allowed band · coil current (scaled)", legend: [["gap", "#a78bfa"], ["current", "#ffd86b"]] });
    }
  }
  var game = {
    song: A.song(5100, "calm"), savePrefix: ["ee-arcade-maglev"],
    actions: [
      { id: "gup", label: "Larger gap target (+0.5 mm)", keys: ["ArrowDown", "KeyS"], touch: { label: "gap+", x: 8, y: 84 } },
      { id: "gdown", label: "Smaller gap target (−0.5 mm)", keys: ["ArrowUp", "KeyW"], touch: { label: "gap−", x: 8, y: 62 } },
      { id: "kpup", label: "Kp up", keys: ["KeyE"] }, { id: "kpdn", label: "Kp down", keys: ["KeyQ"] },
      { id: "kdup", label: "Kd up", keys: ["KeyD"] }, { id: "kddn", label: "Kd down", keys: ["KeyA"] },
      { id: "retune", label: "Pause and retune", keys: ["KeyT", "Enter"], touch: { label: "Tune", x: 92, y: 84 } }
    ],
    init: function (api) {
      LK.css(); setupCheats(api);
      if (api.settings && api.settings.add) [["hints", "Show hints", "Stability hints on the tuning screen.", true], ["chart", "Live gap chart", "Strip chart of gap and coil current while running.", true], ["calm", "Calm visuals", "No gust streaks or contact sparks.", false]].forEach(function (o) {
        api.settings.add({ id: o[0], tab: o[0] === "calm" ? "access" : "gameplay", label: o[1], type: "toggle", default: o[3], help: o[2], apply: function (v) { save.opts[o[0]] = !!v; } }); });
      api.panel("<p>An electromagnet pulls the pod's steel plate with <span class='gm-eq'>F = K·(I/g)²</span>, where <span class='gm-eq'>K = μ0·N²·A / 4</span>. The pod is in balance when this equals its weight, at <span class='gm-eq'>I0 = g·√(m·g/K)</span> (about 10 A for this 20 kg pod at 10 mm). That balance is unstable: closer means stronger pull. A feedback controller measures the gap and sets the coil current: <span class='gm-eq'>I = I_ff + Kp·e + Ki·∫e + Kd·ė</span>.</p>" +
        "<table><tr><td>Coil</td><td><span class='gm-eq'>L·dI/dt = V − R·I</span>, L ≈ 40 mH, R = 2 Ω</td></tr><tr><td>Stability (PD)</td><td><span class='gm-eq'>Kp &gt; I0/g0 ≈ 1 A/mm, Kd &gt; 0</span></td></tr></table>" +
        "<p class='gm-small'>Model: N = 400 turns, pole area 40 cm², rigid pod, 2 ms derivative filter, ideal current-sensing amplifier limited by its supply voltage. Course: EEEN 320, time-varying fields and magnetic force.</p>",
        "<p class='gm-small'>Keyboard: W/S gap target, Q/E Kp, A/D Kd, T retune. Phones: gap− gap+ and Tune.</p>");
      menu(api);
    },
    update: update, draw: draw, menu: function (api) { menu(api); }
  };
  A.run(game);
  window.MaglevRescue = { get S() { return S; }, save: save };
})();
