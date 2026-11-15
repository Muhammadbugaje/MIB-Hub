/* Drive Room (EEEN 524: introduction to electric drives). Read the job, pick a power converter that covers the
 * quadrants it needs within budget, tune the speed loop, then run the drive and watch it follow the speed profile.
 * Motor, converter and load models: drivesim.js. */
(function () {
  "use strict";
  var A = window.Arcade, D = window.DriveSim, LK = window.LabKit, SLUG = "drive-room", ACC = "#ffb347";
  var save = LK.load(A, "driveroom", { cleared: 0, stars: {}, best: 0, mib: false });
  function persist() { A.store("driveroom", save); }
  var S = null, run = false, endless = null, set = null, CT = {}, API0 = null, speedX = 1;
  var CH = /*CH[*/{"skip":["7f391dbc6dd4ca457d8a71e3e2d9270bb9521bbffcee92d84a2e6c26082b762e","bfd0069e77e643da823d5cc77b5c39a61f4a8c280caffdc2135a0e75aea27aad"],"auto":["3750a1566e8c8d359e060ce6fe81f05d8f7ae0a3ef34fdffda46172b2b4d2b8e","e1135f1519d9f4d32057b862c58ea2f0e821eedd3a1a58f666ba476b308327af"],"budget":["8421d5ad36c54d852e9cc4edee48f65e1d1133c699824db537006dc831053e38","997c07bc8e40f7cf0cbd4ec6adffc5713de2c9d6ab79c35efd6b14ad36df095e"],"notrip":["eaeeaffd16e4297cfa448b3a02cf103936b9813e785f42ec08f5d84b6a204051","c693a22f2378f18da64f7fad1cb46e524955f4cda52deb660b839973f3d8028d"],"tol":["5c55010da7e39dacf003746d8a4eb58ce281698ab64c3adb71b0c66654c5f37a","1a3d93f546755cffd484ababc46e0599fc74f203099926137258e390be25753d"],"unlock":["caca5654c75fb53493d07d9edf5dfdbcdc40c5c96b4e675ced60cbc8fdb533d0","6c56567db5090041ec78cb1eaee1bc40daa2f2dabc104c2fdcb7c5e985048ced"],"slow":["7a7040f479466153ca398b7537b204e1651231247b28a5e262973767f7252115","ce2c59de09a4d54c15df43a747e4d2e49fadb365943694a5d78fa00e77ffa4d7"],"party":["c5f942427f370cad83c05cb0ad404ad7713dc9d0b14d1dab4b63496c5c14e977","8993acc996cb7a6ac361e9fc253a72cc7fdbedbcd804d63279f4518541474a86"],"_combo":"9478a1de455bbea782798bddad4993518046cfb93473a1e222b5ca22097bec39","_swipe":"14bc77adff954f1a84b83d91122d5cb899213866f5ba19f007cae581794f4f5e"}/*]CH*/;
  function opt(id, d) { var s = API0 && API0.settings; var v = s && s.get ? s.get(id) : undefined; return v === undefined ? d : v; }
  function heroOn() { return !!(API0 && API0.hero.active && save.mib); }
  function setupCheats(api) {
    API0 = api;
    api.cheats({
      skip: { label: "Job done", h: CH.skip, run: function () { if (S && !S.done) { S.done = true; S.win = true; S.why = "Profile met (skipped)."; } } },
      auto: { label: "Engineer's settings fitted", h: CH.auto, run: function () { if (S) { set = D.botSet(S.L); S.set = set; S.C = D.BYCONV[set.conv]; } } },
      budget: { label: "+1000 budget", h: CH.budget, run: function () { CT.budget = (CT.budget || 0) + 1000; } },
      notrip: { label: "Overcurrent trip off", h: CH.notrip, run: function () { CT.notrip = 1; } },
      tol: { label: "Tolerance tripled", h: CH.tol, run: function () { CT.tol = 3; } },
      unlock: { label: "Every job open", h: CH.unlock, run: function () { save.cleared = Math.max(save.cleared, D.LEVELS.length); persist(); } },
      slow: { label: "Slow motion", h: CH.slow, run: function () { api.slowmo(.5, 20); } },
      party: { label: "Confetti storm", h: CH.party, run: function () { api.confetti(400); } }
    });
    api.secret({ combo: CH._combo, swipe: CH._swipe, onReveal: function () { menu(api); } });
  }
  function rpm(w) { return Math.round(w * 60 / (2 * Math.PI)); }
  function quadLabel(q) { return { 1: "I motoring", 2: "II forward braking", 3: "III reverse motoring", 4: "IV reverse braking" }[q]; }
  function job(L) { var j = Object.assign({}, L); if (CT.budget) j.budget += CT.budget; if (CT.tol) j.tol *= CT.tol; return j; }
  function profileCanvas(cv, L) {
    if (!cv) return; var x = cv.getContext("2d"), w = cv.width, h = cv.height, top = D.maxSpeed(L) || 1, k, M = D.MOTORS[L.motor];
    x.fillStyle = "#0b1520"; x.fillRect(0, 0, w, h);
    var py = function (v) { return h / 2 - v / (Math.max(top, M.wb) * 1.15) * (h / 2 - 14); }, px = function (t) { return 8 + t / L.time * (w - 16); };
    x.strokeStyle = "rgba(255,255,255,.2)"; x.beginPath(); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke();
    x.setLineDash([4, 4]); x.strokeStyle = "rgba(255,179,71,.5)"; [M.wb, -M.wb].forEach(function (v) { x.beginPath(); x.moveTo(0, py(v)); x.lineTo(w, py(v)); x.stroke(); }); x.setLineDash([]);
    x.strokeStyle = ACC; x.lineWidth = 3; x.beginPath(); for (k = 0; k <= 200; k++) { var t = L.time * k / 200, Y = py(D.refAt(L, t)); if (k) x.lineTo(px(t), Y); else x.moveTo(px(t), Y); } x.stroke();
    x.fillStyle = "#e6f1ff"; x.font = "600 14px system-ui"; x.fillText("Speed profile (dashed: base speed " + rpm(M.wb) + " rpm)", 10, 18);
  }
  function brief(api, L0, go) {
    var L = job(L0), M = D.MOTORS[L.motor], allowed = D.allowed(L);
    if (!set || !D.BYCONV[set.conv] || allowed.indexOf(D.BYCONV[set.conv]) < 0) set = { conv: (allowed[0] || D.CONVERTERS[0]).id, kp: +(M.J * 10 / M.Kphi).toFixed(2), ki: +(M.J * 10 / M.Kphi * 2).toFixed(2), ilim: Math.round(M.I * 1.5), fw: false };
    var need = null, kpMax = +(M.J * 60 / M.Kphi).toFixed(1);
    var render = function () {
      var html = "<h2>" + LK.esc(L.name) + "</h2><p><b>Motor</b> " + M.name + " · base " + rpm(M.wb) + " rpm · rated " + M.I + " A · J " + M.J + " kg·m². <b>Load</b> " + ({ conveyor: "conveyor (friction torque)", hoist: "hoist (gravity torque)", fan: "fan (T ∝ ω²)", winder: "winder (constant power)" })[L.kind] +
        ". <b>Supply</b> " + L.supplies.map(function (s) { return s === "dc" ? L.supply.vdc + " V DC bus" : s === "ac1" ? L.supply.vs + " V single-phase" : L.supply.vll + " V three-phase"; }).join(" or ") + ". <b>Budget</b> ₦" + L.budget + "k. <b>Tolerance</b> ±" + L.tol.toFixed(1) + "% RMS.</p>" +
        "<canvas class='lk-canvas' width='560' height='150' data-prof aria-label='Speed profile'></canvas>" +
        "<div class='lk-teach'>" + LK.esc(L.teach) + "</div><h3 style='margin:.4em 0'>Converter</h3><div class='lk-cards'>" +
        D.CONVERTERS.map(function (c) { var ok = allowed.indexOf(c) >= 0; return "<button type='button' class='gm-btn lk-card' data-act='conv' data-id='" + c.id + "' aria-pressed='" + (set.conv === c.id) + "'" + (ok ? "" : " disabled") + "><b>" + c.short + "</b><small>Quadrants " + c.quads.join(", ") + (isFinite(c.vmax(L.supply)) ? " · " + Math.round(c.vmax(L.supply)) + " V max" : "") + "</small><small>₦" + c.cost + "k" + (ok ? "" : c.cost > L.budget ? " · over budget" : " · wrong supply") + "</small></button>"; }).join("") + "</div>" +
        (need ? "<p class='gm-small'>This job needs quadrant" + (need.length > 1 ? "s " : " ") + need.map(quadLabel).join(", ") + ".</p>" : "<button type='button' class='gm-btn gm-btn--sm' data-act='quad'>Which quadrants does this job need?</button>") +
        "<h3 style='margin:.6em 0 .2em'>Speed controller</h3>" + LK.slider("kp", "Kp (A per rad/s)", 0, kpMax, kpMax > 20 ? 0.5 : 0.05, Math.min(kpMax, set.kp), "") + LK.slider("ki", "Ki (A per rad)", 0, kpMax * 8, kpMax > 20 ? 1 : 0.1, Math.min(kpMax * 8, set.ki), "") +
        LK.slider("ilim", "Current limit", Math.round(M.I * 0.5), Math.round(M.I * 2.2), 1, set.ilim, "A") +
        "<label class='lk-chip' style='background:rgba(255,255,255,.06);color:inherit'><input type='checkbox' data-fw" + (set.fw ? " checked" : "") + "> Field weakening above base speed</label>" +
        "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='go'>Run the drive</button>" + (heroOn() ? "<button class='gm-btn' data-act='auto'>MIB: engineer's settings</button>" : "") + "<button class='gm-btn' data-act='back'>Jobs</button></div>";
      api.show(html, function (a, el) {
        if (a === "back") return menu(api);
        if (a === "conv") { set.conv = el.getAttribute("data-id"); return render(); }
        if (a === "quad") { need = D.quadrants(L); return render(); }
        if (a === "auto") { set = D.botSet(L); return render(); }
        if (a === "go") { api.hide(); go(L); }
      });
      var root = LK.overlay(); profileCanvas(root && root.querySelector("[data-prof]"), L);
      LK.bindSliders(root, function (id, v) { set[id] = v; });
      var fw = root && root.querySelector("[data-fw]"); if (fw) fw.addEventListener("change", function () { set.fw = fw.checked; });
    };
    render();
  }
  function begin(api, L) {
    S = D.start(L, Object.assign({}, set)); run = true; speedX = 1; CT.notripDone = 0;
    api.useActions(["kpup", "kpdn", "fast"]); api.music(A.song(6200 + L.id * 5, L.id > 18 ? "boss" : L.id > 8 ? "funk" : "afro"));
    api.banner(L.name.toUpperCase(), { size: 66, sub: D.BYCONV[set.conv].short, dur: 1.2 });
  }
  function play(api, k) { endless = null; brief(api, D.LEVELS[k], function (L) { begin(api, L); }); }
  function startEndless(api) { endless = { k: 0 }; brief(api, D.endlessLevel(0), function (L) { begin(api, L); }); }
  function finish(api) {
    run = false; LK.clearHud(); var L = S.L, win = S.win, st = D.stars(S), k = L.id - 1, err = D.rmsPct(S), regen = S.eout > 0.02 * S.ein;
    if (endless) {
      if (win) { endless.k++; api.sound.sfx("coin"); var N = D.endlessLevel(endless.k); brief(api, N, function (L2) { begin(api, L2); }); return; }
      var rec = endless.k > (save.best || 0); if (rec) { save.best = endless.k; persist(); }
      A.report(SLUG, { result: endless.k >= 5 ? "win" : "lose", stage: 1, score: endless.k * 100 });
      api.ceremony(rec && endless.k ? "newRecord" : endless.k >= 3 ? "win" : "lose", { title: rec ? "NEW RECORD!" : "SHIFT OVER", sub: endless.k + " jobs", score: endless.k, scoreLabel: "Jobs completed", stats: [["Best", (save.best || 0) + " jobs"]], line: S.why,
        tip: "Before every job, check which quadrants it needs: braking and lowering loads need a converter that can carry them.",
        then: function () { api.show("<h2>Shift over</h2><p>" + LK.esc(S.why) + "</p><p>You completed <b>" + endless.k + "</b> jobs.</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='again'>New shift</button><button class='gm-btn' data-act='menu'>Jobs</button></div>", function (a) { if (a === "again") startEndless(api); else menu(api); }); } });
      return;
    }
    if (win) { save.cleared = Math.max(save.cleared, k + 1); save.stars[L.id] = Math.max(save.stars[L.id] || 0, st); persist(); }
    A.report(SLUG, { result: win ? "win" : "lose", stage: L.id, score: Math.max(0, Math.round(1000 - err * 80)) + (win ? 300 + st * 100 : 0) });
    var last = k === D.LEVELS.length - 1, next = win && !last;
    api.ceremony(win ? (last ? "gameComplete" : st === 3 ? "newRecord" : "stageClear") : "lose", { title: win ? (last ? "CHIEF ENGINEER!" : "PROFILE MET!") : (S.trip ? "TRIPPED!" : "OFF PROFILE"), sub: L.name, trophy: win ? (last ? "crown" : "medal") : "none",
      score: Math.round(err * 100) / 100, scoreLabel: "RMS speed error (%)", stars: win ? st : null, stats: [["Converter", D.BYCONV[S.set.conv].short + " ₦" + D.BYCONV[S.set.conv].cost + "k"], ["Peak current", Math.round(S.peak) + " A"], ["Energy in", (S.ein / 1000).toFixed(1) + " kJ"], ["Regenerated", (S.eout / 1000).toFixed(1) + " kJ"]],
      line: win ? (st === 3 ? "Tight tracking at a sensible price." : "On profile. " + (err > L.tol * 0.45 ? "Tighter tracking earns a star." : "A cheaper or regenerating drive earns a star.")) : S.why,
      tip: L.teach + (regen ? "" : ""), then: function () {
        api.show("<h2>" + (win ? "Job done" : "Job failed") + "</h2><p>" + LK.esc(S.why) + "</p><div class='lk-teach'>" + LK.esc(L.teach) + "</div>" +
          "<div class='gm-actions'>" + (next ? "<button class='gm-btn gm-btn--go' data-act='next'>Next job</button>" : "") + "<button class='gm-btn" + (next ? "" : " gm-btn--go") + "' data-act='retry'>Adjust and rerun</button><button class='gm-btn' data-act='menu'>Jobs</button></div>",
          function (a) { if (a === "next") play(api, k + 1); else if (a === "retry") play(api, k); else menu(api); });
      } });
  }
  function menu(api) {
    run = false; LK.clearHud();
    api.show("<h2>Drive Room</h2><p>The workshop's drives are down after Count Entropy's surge. For each job: read the motor and the load, choose a converter that can drive and brake it, tune the speed loop, and run it. " + save.cleared + " of " + D.LEVELS.length + " jobs open.</p>" +
      LK.grid(D.LEVELS, save, heroOn()) +
      "<div class='gm-actions'><button class='gm-btn' data-act='endless'>Endless shift" + (save.best ? " · best " + save.best + " jobs" : "") + "</button>" + (api.hero.active ? "<button class='gm-btn' data-act='mib' aria-pressed='" + !!save.mib + "'>" + (save.mib ? "M.I. BUGAJE on (engineer's settings)" : "Play as M.I. BUGAJE") + "</button>" : "") + "</div>",
      function (a, el) { if (a === "lv") play(api, +el.getAttribute("data-k")); else if (a === "endless") startEndless(api); else if (a === "mib") { save.mib = !save.mib; persist(); menu(api); } });
  }
  function update(dt, api) {
    if (api.hero.inUse !== heroOn()) api.hero.use(heroOn());
    if (!run || !S || api.overlayOpen()) return;
    if (api.hit("kpup")) S.set.kp *= 1.15; if (api.hit("kpdn")) S.set.kp /= 1.15; if (api.hit("kiup")) S.set.ki *= 1.15; if (api.hit("kidn")) S.set.ki /= 1.15; if (api.hit("fast")) speedX = speedX === 1 ? 2 : 1;
    if (heroOn()) { var b = D.botSet(S.L); S.set.kp = b.kp; S.set.ki = b.ki; }
    var M = S.M; if (CT.notrip) M = S.M = Object.assign({}, M, { I: 1e6 / 2.2 });
    D.step(S, dt * speedX * opt("simRate", 1));
    var wr = D.refAt(S.L, S.t), C = D.BYCONV[S.set.conv];
    LK.hud([[S.L.name, ""], ["t", S.t.toFixed(1) + "/" + S.L.time + " s"], ["Speed", rpm(S.w) + " rpm"], ["Target", rpm(wr) + " rpm"], ["Error", D.rmsPct(S).toFixed(1) + "%", D.rmsPct(S) > S.L.tol ? "bad" : D.rmsPct(S) > S.L.tol * 0.6 ? "warn" : "ok"],
      ["Ia", Math.round(S.ia) + " A", Math.abs(S.ia) > D.MOTORS[S.L.motor].I * 1.8 ? "bad" : ""], ["Va", Math.round(S.va) + " V"], ["φ", Math.round(S.phi * 100) + "%"], [C.short, ""], ["×" + speedX, ""]].concat(heroOn() ? [["MIB", "auto"]] : []), ACC);
    if (S.done) { if (S.trip) { api.sound.sfx("boom"); api.kick(10); } finish(api); }
  }
  function draw(api) {
    var x = api.x, t = api.t;
    var g = x.createLinearGradient(0, 0, 0, 540); g.addColorStop(0, "#1a1410"); g.addColorStop(1, "#2c2219"); x.fillStyle = g; x.fillRect(0, 0, 960, 540);
    if (!S) return;
    var L = S.L, M = D.MOTORS[L.motor], ang = (S.ang = (S.ang || 0) + S.w * 0.004);
    // machine: motor on the left, the load on its shaft
    x.save(); x.translate(130, 210); x.fillStyle = "#3c6e91"; x.fillRect(-70, -50, 120, 100); x.fillStyle = "#29506b"; for (var f = -40; f <= 40; f += 16) x.fillRect(-70, f, 120, 6);
    x.fillStyle = "#cfd8e3"; x.fillRect(50, -8, 50, 16); x.restore();
    x.save(); x.translate(270, 210);
    if (L.kind === "fan") { x.rotate(ang); x.fillStyle = "#9fb6c9"; for (var b = 0; b < 4; b++) { x.rotate(Math.PI / 2); x.beginPath(); x.ellipse(0, -40, 14, 40, 0, 0, 7); x.fill(); } }
    else { x.rotate(ang); x.fillStyle = "#8a6d4a"; x.beginPath(); x.arc(0, 0, 46, 0, 7); x.fill(); x.strokeStyle = "#e7c58f"; x.lineWidth = 4; for (var s2 = 0; s2 < 6; s2++) { x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(s2) * 46, Math.sin(s2) * 46); x.stroke(); } }
    x.restore();
    if (L.kind === "hoist") { var cy = 300 + ((S.pos = (S.pos || 0) - S.w * 0.0008) % 60 + 60) % 60; x.strokeStyle = "#cfd8e3"; x.lineWidth = 2; x.beginPath(); x.moveTo(316, 210); x.lineTo(316, cy); x.stroke(); x.fillStyle = "#c77d3a"; x.fillRect(296, cy, 40, 30); }
    if (L.kind === "conveyor" || L.kind === "winder") { x.fillStyle = "#4a3a2c"; x.fillRect(320, 250, 300, 14); x.fillStyle = "#e7c58f"; var off = ((S.pos2 = (S.pos2 || 0) + S.w * 0.05) % 40 + 40) % 40; for (var c = 0; c < 8; c++) x.fillRect(330 + c * 40 + off - 40, 236, 22, 14); }
    // four-quadrant diagram: the operating point (torque, speed)
    var qx = 790, qy = 200, qr = 110, T = S.M.Kphi * S.phi * S.ia, Tm = M.Kphi * M.I * 2, Wm = Math.max(M.wb, D.maxSpeed(L)) * 1.2;
    x.fillStyle = "rgba(6,14,22,.8)"; x.fillRect(qx - qr - 12, qy - qr - 30, 2 * qr + 24, 2 * qr + 44); x.strokeStyle = "rgba(255,255,255,.35)"; x.beginPath(); x.moveTo(qx - qr, qy); x.lineTo(qx + qr, qy); x.moveTo(qx, qy - qr); x.lineTo(qx, qy + qr); x.stroke();
    x.fillStyle = "rgba(230,241,255,.7)"; x.font = "700 14px system-ui"; x.textAlign = "center"; x.fillText("I", qx + qr / 2, qy - qr / 2); x.fillText("II", qx - qr / 2, qy - qr / 2); x.fillText("III", qx - qr / 2, qy + qr / 2); x.fillText("IV", qx + qr / 2, qy + qr / 2);
    x.fillText("torque →", qx + qr - 30, qy + 16); x.fillText("speed ↑", qx + 34, qy - qr + 6); x.fillStyle = "#e6f1ff"; x.font = "700 15px system-ui"; x.fillText("Operating quadrant", qx, qy - qr - 12);
    x.fillStyle = ACC; x.beginPath(); x.arc(qx + Math.max(-1, Math.min(1, T / Tm)) * qr, qy - Math.max(-1, Math.min(1, S.w / Wm)) * qr, 8, 0, 7); x.fill();
    // live chart: reference and actual speed, armature current
    var h = S.hist, r = { x: 20, y: 352, w: 920, h: 176 }, top = Math.max(M.wb, D.maxSpeed(L)) * 1.15;
    LK.plot(x, r, [{ pts: h.map(function (p) { return [p[0], p[1]]; }), col: "rgba(255,255,255,.7)", w: 2, dash: [6, 4] }, { pts: h.map(function (p) { return [p[0], p[2]]; }), col: ACC, w: 3 }, { pts: h.map(function (p) { return [p[0], p[3] / (M.I * 2.2) * top]; }), col: "#7ef0ff", w: 1.5 }],
      { x0: 0, x1: L.time, y0: -top, y1: top, lines: [{ y: 0 }], title: "Speed: target (dashed) and actual · armature current (scaled to the trip level)", legend: [["speed", ACC], ["current", "#7ef0ff"]] });
  }
  var game = {
    song: A.song(6200, "afro"), savePrefix: ["ee-arcade-driveroom"],
    actions: [
      { id: "kpup", label: "Speed Kp ×1.15", keys: ["KeyE", "ArrowUp"], touch: { label: "Kp+", x: 92, y: 62 } },
      { id: "kpdn", label: "Speed Kp ÷1.15", keys: ["KeyQ", "ArrowDown"], touch: { label: "Kp−", x: 92, y: 84 } },
      { id: "kiup", label: "Speed Ki ×1.15", keys: ["KeyD"] }, { id: "kidn", label: "Speed Ki ÷1.15", keys: ["KeyA"] },
      { id: "fast", label: "Run at ×2", keys: ["KeyF", "Space"], touch: { label: "×2", x: 8, y: 84 } }
    ],
    init: function (api) {
      LK.css(); setupCheats(api);
      if (api.settings && api.settings.add) {
        api.settings.add({ id: "simRate", tab: "gameplay", label: "Simulation pace", type: "slider", default: 1, min: 0.5, max: 1, step: 0.25, format: function (v) { return Math.round(v * 100) + "%"; }, help: "Slows the drive's clock so you can watch the transients." });
      }
      api.panel("<p>A separately excited DC motor: <span class='gm-eq'>Va = Ra·Ia + La·dIa/dt + Kφ·ω</span>, torque <span class='gm-eq'>T = Kφ·Ia</span>, and <span class='gm-eq'>J·dω/dt = T − TL − B·ω</span>. A power converter sets the average armature voltage: a 1-phase full converter gives <span class='gm-eq'>(2√2/π)·Vs·cos α</span>, a 3-phase full converter <span class='gm-eq'>(3√2/π)·VLL·cos α</span>, a chopper <span class='gm-eq'>D·Vdc</span>.</p>" +
        "<p>Full converters pass current one way only, so they cover quadrants I and IV (lifting and lowering a hoist). A class-A chopper only motors; class C adds forward braking; a class-E chopper or dual converter does all four. Above base speed, weakening the field keeps the back-emf within the supply.</p>" +
        "<p class='gm-small'>Model: average-value converters, ideal fast current loop (≈300 rad/s), speed PI with anti-windup, trip at 2.2× rated current. Course: EEEN 524, introduction to electric drives.</p>",
        "<p class='gm-small'>While running: Q/E speed Kp, A/D speed Ki, F or Space ×2 speed. Phones: Kp+ Kp− ×2.</p>");
      menu(api);
    },
    update: update, draw: draw, menu: function (api) { menu(api); }
  };
  A.run(game);
  window.DriveRoom = { get S() { return S; }, save: save };
})();
