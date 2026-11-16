/* Signal Surfer (EEEN 342: overview of telecommunication systems, noise). Ride a radio signal from the transmitter to the
 * receiver: tune the carrier away from interference, set the transmit power, and pick a bit rate the channel can carry.
 * Channel physics (Friis path loss, thermal noise, BPSK bit errors, Shannon's limit): signalsim.js. */
(function () {
  "use strict";
  var A = window.Arcade, Sg = window.SignalSim, LK = window.LabKit, SLUG = "signal-surfer", ACC = "#7ef0ff";
  var save = LK.load(A, "surfer", { cleared: 0, stars: {}, best: 0, mib: false, opts: { assist: false, hints: true, calm: false } });
  function persist() { A.store("surfer", save); }
  var R = null, run = false, endless = null, rep = {}, pops = [], tAuto = 0, CT = {}, API0 = null;
  /* cheats and the maker's hidden character: only hashes of the codes are shipped */
  var CH = /*CH[*/{"skip":["8c814f0fdfd1e44e4d3e9a9067e3c1e57250a16db903fd3df0c34e40c932553e","eb6fa2f5919bb00475a93c491dcf0317cc80f67172654b9ca4a8b7d5bd17e6b6"],"battery":["a6888d799575e8de1c0cb52c1d522a4ef1e999917e2f7fc0528801818e1ae93d","3de240374d475b295c93e2a9e44a9bc7e5062fda4a13cea40fb72e8c56f9e56d"],"time":["461a12d0e52b6ff252bc2957308df9fb4bdea651ac01568c9201d8dab7399d7f","b706670eb9808fc23fa3c3dfc1d78b4d3689b86a75a6629d3c41d4bef4999552"],"clear":["ecd0df61ab6ec52f15699c620de9f2695d9557173b9b5e320517c7ecbefbd7d6","6e80a860fff84ddaba44ea3aa6022ff87eb70abc4798e47f55cfdca7e67617ab"],"engineer":["0a0842d10b64cfe95f3c6346b309165f8b7ffd7f405ed1ae3ce9666c8e99f973","aeb07823843680eab66f8745e06a3c921f47b436ff9ecd0d8bedc10c16655db1"],"unlock":["01510191d394694f339403c9afac4925945f4627706ca76de7609d2d3c11b05f","4ca0a1d69f82e0116d6de30100858a42681def2cbc2475e3dad005612cb95669"],"slow":["06eb89c34b28ab03c042076a90c4c8bcf9dd5d8f76e6b82b8de53171dc0338e7","22edf1123ac3847cfca7a2a81e8b4d5133745502647358099fead184f1bcdf74"],"party":["955db8c0f7d96672bff75fd47cc327d0c4c27da5620e648b64d78f3cf5142a58","f59fc77fa337cdcc2fd65f9001b765923019633c00d69b572bfa6566b63f6612"],"_combo":"ffcd3759c697bb93630b5a4dd4bbeb21447e58f20277c309afa52cd5f881ae9f","_swipe":"78241b6e0b4a14427e65fdf6ef344f1716d7103af3ef028b1621776bd2f707dd"}/*]CH*/;
  function heroOn() { return !!(API0 && API0.hero.active && save.mib); }
  function setupCheats(api) {
    API0 = api;
    api.cheats({
      skip: { label: "Deliver this message", h: CH.skip, run: function () { if (R && !R.done) { R.sent = R.L.msg; Sg.step(R, 0.001); } } },
      battery: { label: "Battery refilled", h: CH.battery, run: function () { if (R) R.energy = 0; } },
      time: { label: "+20 seconds", h: CH.time, run: function () { if (R) R.L = Object.assign({}, R.L, { time: R.L.time + 20 }); } },
      clear: { label: "Interference cleared", h: CH.clear, run: function () { if (R) R.L = Object.assign({}, R.L, { jams: [] }); } },
      engineer: { label: "Auto-engineer for 30 s", h: CH.engineer, run: function () { CT.auto = 30; } },
      unlock: { label: "Every channel open", h: CH.unlock, run: function () { save.cleared = Math.max(save.cleared, Sg.LEVELS.length); persist(); } },
      slow: { label: "Slow motion", h: CH.slow, run: function () { api.slowmo(.5, 20); } },
      party: { label: "Confetti storm", h: CH.party, run: function () { api.confetti(400); } }
    });
    api.secret({ combo: CH._combo, swipe: CH._swipe, onReveal: function () { menu(api); } });
  }
  function ghz(f) { return (f / 1e9).toFixed(2) + " GHz"; }
  function mbps(r) { return (r / 1e6 >= 1 ? (r / 1e6).toFixed(0) : (r / 1e6).toFixed(2)) + " Mb/s"; }
  function brief(api, L, go) {
    var lk = Sg.link(L, { pt: L.pmax, f: 1e9, rb: 1e6 }, 0);
    api.show("<h2>" + LK.esc(L.name) + "</h2><p>Send <b>" + (L.msg / 1e6).toFixed(0) + " Mb</b> over <b>" + (L.d >= 1000 ? (L.d / 1000).toFixed(1) + " km" : L.d + " m") + "</b> in <b>" + L.time + " s</b>. Transmitter up to <b>" + Sg.dbm(L.pmax).toFixed(0) + " dBm</b> (" + (L.pmax * 1000).toFixed(0) + " mW), battery " + L.battery + " J, receiver noise figure " + L.nf + " dB" + (L.jams.length ? ", " + L.jams.length + " interferer" + (L.jams.length > 1 ? "s" : "") : "") + (L.fade ? ", fades up to " + L.fade + " dB" : "") + ".</p>" +
      "<div class='lk-teach'>" + LK.esc(L.teach) + "</div>" +
      "<p class='gm-formula'>Pr = Pt·(c / 4πdf)² · loss &nbsp; Eb/N0 = Pr / (N0·Rb) &nbsp; BER = ½·erfc(√(Eb/N0))</p>" +
      (save.opts.hints ? "<p class='gm-small'>At full power, 1 GHz and 1 Mb/s this link gives Eb/N0 ≈ " + lk.ebn0db.toFixed(1) + " dB. Aim for about 10 dB: below 7 dB packets start failing.</p>" : "") +
      "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='go'>Transmit</button><button class='gm-btn' data-act='back'>Channels</button></div>",
      function (a) { if (a === "back") return menu(api); api.hide(); go(); });
  }
  function begin(api, L) { try { if (window.MIBPlay) MIBPlay.level(L.id); } catch (mibErr) {} /* MIB-Hub: play tracking */
    R = Sg.start(L); R.cfg.pt = Math.min(R.cfg.pt, L.pmax); run = true; pops = []; tAuto = 0; CT.auto = 0;
    api.useActions(["fdown", "fup", "pdown", "pup", "rdown", "rup"]); api.music(A.song(3400 + L.id * 7, L.id > 20 ? "synthwave" : L.id > 10 ? "breaks" : "funk"));
    api.banner(L.name.toUpperCase(), { size: 70, sub: (L.msg / 1e6).toFixed(0) + " Mb to deliver", dur: 1.4 });
  }
  function play(api, k) { var L = Sg.LEVELS[k]; endless = null; brief(api, L, function () { begin(api, L); }); }
  function startEndless(api) { endless = { k: 0, total: 0 }; var L = Sg.endlessLevel(0); brief(api, L, function () { begin(api, L); }); }
  function finish(api) {
    run = false; LK.clearHud(); var L = R.L, win = R.win, st = Sg.stars(R), k = L.id - 1, mb = R.sent / 1e6;
    if (endless) {
      if (win) { endless.total += L.msg / 1e6; endless.k++; api.sound.sfx("coin"); api.banner("RELAY " + endless.k + " DONE", { size: 60, dur: 1.1 }); var N = Sg.endlessLevel(endless.k); begin(api, N); return; }
      var tot = endless.total + mb, rec = tot > (save.best || 0); if (rec) { save.best = Math.round(tot); persist(); }
      A.report(SLUG, { result: endless.k >= 5 ? "win" : "lose", stage: 1, score: Math.round(tot) });
      api.ceremony(rec && endless.k > 0 ? "newRecord" : endless.k >= 3 ? "win" : "lose", { title: rec ? "NEW RECORD!" : "RELAY OVER", sub: endless.k + " messages", score: Math.round(tot), scoreLabel: "Megabits delivered",
        stats: [["Messages", endless.k], ["Best", (save.best || 0) + " Mb"]], line: R.why, tip: "In the endless relay the channel worsens each message. Keep Eb/N0 near 10 dB and spend the battery only where you must.",
        then: function () { api.show("<h2>Relay over</h2><p>" + LK.esc(R.why) + "</p><p>You delivered <b>" + Math.round(tot) + " Mb</b> across " + endless.k + " complete messages.</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='again'>Again</button><button class='gm-btn' data-act='menu'>Channels</button></div>", function (a) { if (a === "again") startEndless(api); else menu(api); }); } });
      return;
    }
    if (win) { save.cleared = Math.max(save.cleared, k + 1); save.stars[L.id] = Math.max(save.stars[L.id] || 0, st); persist(); }
    A.report(SLUG, { result: win ? "win" : "lose", stage: L.id, score: Math.round(mb * 10) + (win ? 500 + st * 100 : 0) });
    var last = k === Sg.LEVELS.length - 1, next = win && !last;
    api.ceremony(win ? (last ? "gameComplete" : st === 3 ? "newRecord" : "stageClear") : "lose", { title: win ? (last ? "SIGNAL MASTER!" : "RECEIVED!") : "LINK LOST", sub: L.name, trophy: win ? (last ? "crown" : "star") : "none",
      score: Math.round(mb), scoreLabel: "Megabits delivered", stars: win ? st : null, stats: [["Time", R.t.toFixed(1) + " s"], ["Battery used", Math.round(100 * R.energy / L.battery) + "%"], ["Bit errors", (R.errs / 1e6).toFixed(2) + " Mb resent"]],
      line: win ? (st === 3 ? "Fast and frugal: a textbook link." : "Message through. " + (R.t > L.time * 0.7 ? "Faster next time for a star." : "Use less battery for a star.")) : "You got " + Math.round(100 * Math.min(1, R.sent / L.msg)) + "% of the message across.",
      tip: L.teach, then: function () {
        api.show("<h2>" + (win ? "Message received" : "Link lost") + "</h2><p>" + LK.esc(R.why) + "</p><div class='lk-teach'>" + LK.esc(L.teach) + "</div>" +
          "<div class='gm-actions'>" + (next ? "<button class='gm-btn gm-btn--go' data-act='next'>Next channel</button>" : "") + "<button class='gm-btn" + (next ? "" : " gm-btn--go") + "' data-act='retry'>" + (win ? "Play again" : "Try again") + "</button><button class='gm-btn' data-act='menu'>Channels</button></div>",
          function (a) { if (a === "next") play(api, k + 1); else if (a === "retry") play(api, k); else menu(api); });
      } });
  }
  function menu(api) {
    run = false; LK.clearHud(); var heroAll = heroOn();
    api.show("<h2>Signal Surfer</h2><p>Count Entropy's noise has cut the campus relays. Carry each message from the transmitter to the receiver: tune the carrier, set the power, choose the bit rate. " + save.cleared + " of " + Sg.LEVELS.length + " channels open.</p>" +
      LK.grid(Sg.LEVELS, save, heroAll) +
      "<div class='gm-actions'><button class='gm-btn' data-act='endless'>Endless relay" + (save.best ? " · best " + save.best + " Mb" : "") + "</button>" + (api.hero.active ? "<button class='gm-btn' data-act='mib' aria-pressed='" + !!save.mib + "'>" + (save.mib ? "M.I. BUGAJE on (auto-engineer)" : "Play as M.I. BUGAJE") + "</button>" : "") + "</div>" +
      "<p class='gm-small'>Power assist, hints and calm visuals are in Settings → Gameplay.</p>",
      function (a, el) { if (a === "lv") play(api, +el.getAttribute("data-k")); else if (a === "endless") startEndless(api); else if (a === "mib") { save.mib = !save.mib; persist(); menu(api); } });
  }
  function held(api, id, dt) { // tap = one step; hold = repeat every 0.1 s after 0.3 s
    if (api.hit(id)) { rep[id] = 0; return 1; }
    if (!api.down(id)) { rep[id] = 0; return 0; }
    rep[id] = (rep[id] || 0) + dt; if (rep[id] > 0.3) { rep[id] -= 0.1; return 1; } return 0;
  }
  function update(dt, api) {
    if (api.hero.inUse !== heroOn()) api.hero.use(heroOn());
    if (!run || !R || api.overlayOpen()) return;
    var c = R.cfg, L = R.L, ri = Sg.RATES.indexOf(c.rb);
    if (held(api, "fup", dt)) c.f = Math.min(Sg.FMAX, c.f + 0.05e9); if (held(api, "fdown", dt)) c.f = Math.max(Sg.FMIN, c.f - 0.05e9);
    if (held(api, "pup", dt)) c.pt = Math.min(L.pmax, c.pt * Sg.undb(1)); if (held(api, "pdown", dt)) c.pt = Math.max(1e-4, c.pt / Sg.undb(1));
    if (api.hit("rup")) c.rb = Sg.RATES[Math.min(Sg.RATES.length - 1, ri + 1)]; if (api.hit("rdown")) c.rb = Sg.RATES[Math.max(0, ri - 1)];
    CT.auto = Math.max(0, (CT.auto || 0) - dt); tAuto -= dt;
    if ((heroOn() || CT.auto > 0) && tAuto <= 0) { R.cfg = Sg.best(R); tAuto = 0.5; }
    else if (save.opts.assist && tAuto <= 0) { var lk = Sg.link(L, c, R.t), want = Sg.undb(10) / Math.max(1e-9, lk.ebn0); c.pt = Math.max(1e-4, Math.min(L.pmax, c.pt * Math.pow(want, 0.5))); tAuto = 0.25; }
    var before = R.errs; Sg.step(R, dt);
    if (R.errs - before > R.cfg.rb * dt * 0.3 && Math.random() < 0.3) pops.push({ x: 140 + 680 * Math.min(1, R.sent / L.msg), y: 250, life: 0.6 });
    pops.forEach(function (p) { p.life -= dt; p.y -= 40 * dt; }); pops = pops.filter(function (p) { return p.life > 0; });
    var k = R.last; if (k) LK.hud([[L.name, ""], ["Sent", (R.sent / 1e6).toFixed(1) + "/" + (L.msg / 1e6).toFixed(0) + " Mb", R.sent >= L.msg * 0.8 ? "ok" : ""], ["Time", Math.max(0, L.time - R.t).toFixed(0) + " s", L.time - R.t < 8 ? "warn" : ""],
      ["Battery", Math.max(0, Math.round(100 - 100 * R.energy / L.battery)) + "%", R.energy > L.battery * 0.8 ? "bad" : ""], ["Pt", Sg.dbm(c.pt).toFixed(0) + " dBm"], ["f", ghz(c.f)], ["Rate", mbps(c.rb)],
      ["Eb/N0", k.ebn0db.toFixed(1) + " dB", k.ebn0db < 7 ? "bad" : k.ebn0db < 9.5 ? "warn" : "ok"], ["BER", k.ber < 1e-9 ? "<1e-9" : k.ber.toExponential(1)]].concat(heroOn() ? [["MIB", "auto"]] : []), ACC);
    if (R.done) finish(api);
  }
  function draw(api) {
    var x = api.x, t = api.t, L = R ? R.L : Sg.LEVELS[0], calm = save.opts.calm || api.reduce;
    var g = x.createLinearGradient(0, 0, 0, 540); g.addColorStop(0, "#081a2b"); g.addColorStop(1, "#13324a"); x.fillStyle = g; x.fillRect(0, 0, 960, 540);
    // transmitter and receiver
    x.strokeStyle = "#9fb6c9"; x.lineWidth = 4; x.beginPath(); x.moveTo(80, 330); x.lineTo(100, 150); x.lineTo(120, 330); x.moveTo(88, 260); x.lineTo(112, 260); x.moveTo(93, 205); x.lineTo(107, 205); x.stroke();
    x.fillStyle = "#ffd86b"; x.beginPath(); x.arc(100, 146, 7, 0, 7); x.fill();
    x.fillStyle = "#9fb6c9"; x.beginPath(); x.ellipse(870, 230, 22, 46, -0.4, 0, 7); x.fill(); x.fillStyle = "#13324a"; x.beginPath(); x.ellipse(876, 228, 14, 36, -0.4, 0, 7); x.fill(); x.fillRect(866, 270, 8, 60);
    if (!R) return;
    var k = R.last || Sg.link(L, R.cfg, R.t), q = Math.max(0, Math.min(1, (k.ebn0db + 4) / 20)), amp = 18 + 60 * q, lam = 30 + 60 * (1 - (R.cfg.f - Sg.FMIN) / (Sg.FMAX - Sg.FMIN)), noise = calm ? 0 : Math.max(0, 1 - q) * 26;
    x.lineWidth = 3; x.strokeStyle = k.ebn0db < 7 ? "#ff6b6b" : k.ebn0db < 9.5 ? "#ffb347" : ACC; x.beginPath();
    var fx = 0, i; for (i = 0; i <= 120; i++) { var px = 110 + i * 6.3, py = 240 + Math.sin((px - t * 220) / lam * 2 * Math.PI) * amp * (0.35 + 0.65 * Math.sin(i / 120 * Math.PI)) + (noise ? (Math.random() - 0.5) * noise : 0); if (i) x.lineTo(px, py); else x.moveTo(px, py); }
    x.stroke();
    var prog = Math.min(1, R.sent / L.msg), sx = 110 + prog * 750, sy = 240 + Math.sin((sx - t * 220) / lam * 2 * Math.PI) * amp * (0.35 + 0.65 * Math.sin(prog * Math.PI)) - 22;
    x.fillStyle = "#f6c445"; x.save(); x.translate(sx, sy + 18); x.rotate(Math.cos((sx - t * 220) / lam * 2 * Math.PI) * 0.3); x.fillRect(-24, -3, 48, 6); x.restore();
    var who = A.styled(heroOn() ? (A.byId.mib || A.cast[0]) : A.cast[(L.id || 0) % A.cast.length]); x.fillStyle = who.coat || "#2b6cb0"; x.fillRect(sx - 8, sy - 4, 16, 18); A.drawHead(x, who, sx, sy - 16, 13, 1, { mood: k.ebn0db < 7 ? "sad" : "happy" });
    pops.forEach(function (p) { x.globalAlpha = Math.max(0, p.life / 0.6); x.fillStyle = "#ff6b6b"; x.font = "800 18px system-ui"; x.textAlign = "center"; x.fillText("✗", p.x, p.y); }); x.globalAlpha = 1;
    // spectrum analyser: noise floor vs frequency, the carrier marker, and a scale in dB above thermal
    var r = { x: 20, y: 352, w: 920, h: 176 }, pts = [], th = Sg.KT0 * Sg.undb(L.nf), f, top = 30;
    for (f = Sg.FMIN; f <= Sg.FMAX; f += 0.04e9) pts.push([f / 1e9, Sg.db(Sg.noisePSD(L, f, R.t) / th)]);
    var P = LK.plot(x, r, [{ pts: pts, col: "#c084fc", w: 2 }], { x0: Sg.FMIN / 1e9, x1: Sg.FMAX / 1e9, y0: 0, y1: top, title: "Spectrum: noise above thermal (dB) · 0.4 to 6 GHz", legend: [["noise", "#c084fc"], ["your carrier", "#f6c445"]] });
    var cx = P.px(R.cfg.f / 1e9); x.strokeStyle = "#f6c445"; x.lineWidth = 3; x.beginPath(); x.moveTo(cx, r.y + 20); x.lineTo(cx, r.y + r.h - 4); x.stroke();
    x.fillStyle = "#f6c445"; x.font = "700 15px system-ui"; x.textAlign = cx > 800 ? "right" : "left"; x.fillText(ghz(R.cfg.f), cx + (cx > 800 ? -6 : 6), r.y + 40);
    x.fillStyle = "rgba(230,241,255,.75)"; x.font = "600 13px system-ui"; x.textAlign = "left"; for (f = 1; f <= 6; f++) x.fillText(f + " GHz", P.px(f) - 16, r.y + r.h - 8);
  }
  var game = {
    song: A.song(3400, "funk"), savePrefix: ["ee-arcade-surfer"],
    actions: [
      { id: "fup", label: "Carrier frequency up", keys: ["ArrowUp", "KeyW"], touch: { label: "f▲", x: 8, y: 62 } },
      { id: "fdown", label: "Carrier frequency down", keys: ["ArrowDown", "KeyS"], touch: { label: "f▼", x: 8, y: 84 } },
      { id: "pup", label: "Transmit power up (1 dB)", keys: ["ArrowRight", "KeyD"], touch: { label: "P+", x: 92, y: 62 } },
      { id: "pdown", label: "Transmit power down (1 dB)", keys: ["ArrowLeft", "KeyA"], touch: { label: "P−", x: 80, y: 84 } },
      { id: "rup", label: "Bit rate up", keys: ["KeyE", "Period"], touch: { label: "R+", x: 92, y: 84 } },
      { id: "rdown", label: "Bit rate down", keys: ["KeyQ", "Comma"], touch: { label: "R−", x: 20, y: 84 } }
    ],
    init: function (api) {
      LK.css(); setupCheats(api);
      if (api.settings && api.settings.add) [["assist", "Power assist", "Keeps Eb/N0 near 10 dB for you; you still choose frequency and rate.", false], ["hints", "Show hints", "Link-budget hints in each briefing.", true], ["calm", "Calm visuals", "No noise jitter on the wave.", false]].forEach(function (o) {
        api.settings.add({ id: o[0], tab: o[0] === "calm" ? "access" : "gameplay", label: o[1], type: "toggle", default: o[3], help: o[2], apply: function (v) { save.opts[o[0]] = !!v; } }); });
      api.panel("<p>A radio link loses power with distance and frequency (Friis): <span class='gm-eq'>Pr = Pt·(c / 4πdf)²</span>, plus extra loss from walls and terrain. The receiver adds thermal noise <span class='gm-eq'>N0 = kT0·F</span> (−174 dBm/Hz times the noise figure), and interferers raise the floor near their frequencies.</p>" +
        "<table><tr><td>Energy per bit over noise</td><td><span class='gm-eq'>Eb/N0 = Pr / (N0·Rb)</span></td></tr><tr><td>BPSK bit error rate</td><td><span class='gm-eq'>BER = ½·erfc(√(Eb/N0))</span></td></tr><tr><td>1000-bit packet goodput</td><td><span class='gm-eq'>Rb·(1 − BER)^1000</span></td></tr><tr><td>Shannon's limit</td><td><span class='gm-eq'>C = B·log₂(1 + S/N)</span></td></tr></table>" +
        "<p class='gm-small'>Model: free space with a per-level excess loss, BPSK, a slow deterministic fade, transmitter efficiency 35 %. Course: EEEN 342, overview of telecommunication systems and noise.</p>",
        "<p class='gm-small'>Phones: f▲ f▼ tune, P+ P− power, R+ R− bit rate. Move or resize buttons in Settings → Phone buttons.</p>");
      menu(api);
    },
    update: update, draw: draw, menu: function (api) { menu(api); }
  };
  A.run(game);
  window.SignalSurfer = { get R() { return R; }, save: save, play: function (api, k) { play(api, k); } };
})();
