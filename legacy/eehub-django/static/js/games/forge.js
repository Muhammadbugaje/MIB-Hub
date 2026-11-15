/* Circuit Forge: circuit-building puzzles that grow with the student, 100 to 500 level. Each academic level's chapter
 * is a separate file the server only sends when the student's recorded level allows it. Physics: circuitsim.js
 * (nodal analysis, DC and AC). Fill every slot from the tray, switch on, and meet every goal on the meters.
 * Modes: the workshop (circuits unlock in order inside each chapter), a daily circuit and a free lab bench. */
(function () {
  "use strict";
  var A = window.Arcade, C = window.CircuitSim, S = { fill: {}, sel: -1, on: 0, res: null, tries: 0, hints: 0, mode: "menu" };
  var save = A.store("forge") || {}; save.stars = save.stars || {}; save.daily = save.daily || {}; save.opt = Object.assign({ dots: true, volts: false }, save.opt || {});
  var stage = document.querySelector("[data-gm-stage]"), locked = [];
  try { locked = JSON.parse(stage.getAttribute("data-gm-locked") || "[]"); } catch (e) {}
  function persist() { A.store("forge", save); }
  var LV = C.LEVELS;
  function slots(L) { return C.slotsOf(L); }
  function label(L, v) { if (v && typeof v === "object") return v.label || v.k; var j = L.tray.indexOf(v); if (L.labels && j >= 0) return L.labels[j]; var x = v / L.scale; return (Math.round(x * 100) / 100) + " " + L.unit; }
  function used(L, v) { return Object.keys(S.fill).some(function (k) { return S.fill[k] === v; }); }
  function fmt(v, u, g) { if (g && g.scale) { v /= g.scale; } var a = Math.abs(v); if (!isFinite(v)) return "∞ " + u; if (a < 1e-7) return "0 " + u; return (a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : a >= 0.01 ? v.toFixed(a < 1 ? 3 : 2) : v.toExponential(1)) + (u ? " " + u : ""); }
  function today() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function firstOfLevel(i) { return i === 0 || LV[i - 1].level !== LV[i].level; }
  function unlocked(api, i) { return firstOfLevel(i) || !!save.all || !!(api && api.hero && api.hero.active) || (save.stars[LV[i - 1].name] || 0) > 0 || (save.stars[LV[i].name] || 0) > 0; }
  function txt(api) { if (!S.cvW || api.t - (S.cvT || -9) > 1) { S.cvT = api.t; try { var c = document.querySelector("[data-gm-stage] canvas"); S.cvW = c ? c.getBoundingClientRect().width : 960; } catch (e) { S.cvW = 960; } } var ts = 1; try { ts = (api.settings && api.settings.get && api.settings.get("textScale")) || 1; } catch (e) {} return Math.min(1.7, Math.max(1, 520 / Math.max(1, S.cvW))) * ts; }

  /* cheats and the maker's hidden character: only hashes of the codes are shipped */
  var CH = /*CH[*/{"skip":["ca6af08515f9e2bba3a6c97ff7268e9cc21a0c24823ec050f49ee6bd4924b27b","86dca4527ffdd7b0e53e7959fd57438f75e5b2d371bd5b8c3029d05a154610b9"],"solve":["778c4817c34439917be47e457abd8681a5069781b090ab7b2674d556f80967df","4a4adf5c82a84b0154d64b897779e7a20b93c9ee5ccccebda436ed123a0d9805"],"tries":["28b0a2c602ba295d7213acc4c909913addceecd556959f50f1530f9a9317dd05","7476aa5d56302734d5d85cc2f09a59fbfbd7a806616606a39f8ea8b1443aa44c"],"stars":["1a9c2420bed4e66a6329c414468bf672b272d6b9d751f35fdc01e74bd3a99e57","a55fbc80c2a60b55fd829403d3d5a1332f6b1d864314ca9c6749f88271c66414"],"last":["fb5e3639c1ff7ee35ff2359195d04929053843af56628ebe41aae378631cfef0","90b9d698c228eb6013321a1f6ec04f6bcfd24f55fdc259c9a524b3dcc82c9621"],"slow":["bff664d31e8dac830e6d61caa5a4a9896b7451bd10b63c7867f19b59cd8816a5","60df989a4e403414460cd5f76e318ecb48ef6808f4941eb08905692e587f4a65"],"party":["58335ffe38e8363aab8703450286182ec304b5134c48a9a7b3d7178b22211925","cec7eb54daa0ce18d2780fdf8e290dc47898db87c13886c2cae1484343b97fc6"],"_combo":"757afbe938f018b7466b487953ac60e290339ad15faf959a071e62a4fb3b4e27","_swipe":"327dae1f8105d6f323bd809848b579c971644de9d4d3a6f64cd82096e222ec87"}/*]CH*/;
  function solveNow() { var s = C.solutions(S.L, 1)[0]; if (s) { S.fill = s; S.res = null; } return !!s; }
  function setupCheats(api) {
    api.cheats({
      skip: { label: "Solve and finish this circuit", h: CH.skip, run: function () { if (S.L && !S.lab && solveNow()) { S.tries = Math.max(1, S.tries); S.res = C.check(S.L, S.fill); verdict(api); } } },
      solve: { label: "Right parts fitted", h: CH.solve, run: function () { if (S.L && !S.lab) solveNow(); } },
      tries: { label: "Switch-on counter reset", h: CH.tries, run: function () { S.tries = 0; S.hints = 0; } },
      stars: { label: "Three stars for this circuit", h: CH.stars, run: function () { if (S.L && S.mode === "play") { save.stars[S.L.name] = 3; persist(); } } },
      last: { label: "Open every circuit and jump to the last", h: CH.last, run: function () { save.all = true; persist(); start(api, LV.length - 1); } },
      slow: { label: "Slow motion", h: CH.slow, run: function () { api.slowmo(.5, 20); } },
      party: { label: "Confetti storm", h: CH.party, run: function () { api.confetti(400); api.sound.roar(false); } }
    });
    api.secret({ combo: CH._combo, swipe: CH._swipe, onReveal: function () { map(api); } });
  }
  function begin(api, L, idx) {
    S.idx = idx; S.L = L; S.fill = {}; S.sel = slots(L)[0]; S.on = 0; S.res = null; S.tries = 0; S.blown = 0; S.hints = 0; S.lab = !!L.lab;
    api.useActions(["slot", "on", "clear", "hint", "map"]);
    api.music(A.song(600 + (idx == null ? 77 : idx) * 13, idx === LV.length - 1 ? "boss" : ["calm", "dub", "synthwave", "afro", "calm"][(L.level / 100 - 1) | 0] || "calm"));
  }
  function start(api, idx) {
    if (!unlocked(api, idx)) { api.sound.sfx("block"); note("Fix the circuit before this one first."); return; }
    var L = LV[idx]; begin(api, L, idx); S.mode = "play";
    api.show("<h2>" + (idx + 1) + ". " + A.esc(L.name) + "</h2><p>" + A.esc(L.text) + "</p><p class='gm-small'>" + A.esc(L.course) + " · " + L.level + " level · " + L.goals.length + " goal" + (L.goals.length > 1 ? "s" : "") + "</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='ok'>Build it</button></div>", function () { api.hide(); });
  }
  function startDaily(api) {
    var d = today(), L = S.dailyC && S.dailyC.d === d ? S.dailyC.L : C.daily(d); S.dailyC = { d: d, L: L }; if (!L) return;
    begin(api, L, null); S.mode = "daily";
    api.show("<h2>Daily circuit · " + d + "</h2><p>" + A.esc(L.text) + "</p>" + (save.daily[d] ? "<p>Your best today: " + "★".repeat(save.daily[d]) + "</p>" : "") + "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='ok'>Build it</button></div>", function () { api.hide(); });
  }
  var LAB = (function () {
    var lay = C.ring({ k: "E", E: 12, r: 0.001, role: "cell", name: "12 V bench supply" }, [{ k: "R", R: null, role: "slot", name: "A" }, { k: "R", R: null, role: "slot", name: "B" }, { k: "R", R: null, role: "slot", name: "C" }, { k: "R", R: 0, role: "ammeter" }]);
    return { lab: true, level: 100, name: "Free lab bench", course: "Try anything", unit: "Ω", scale: 1, nodes: lay.nodes, els: lay.els, goals: [], goal: null, text: "Fit any parts in A, B and C, switch on and read every meter. Empty slots are open circuits.",
      tray: [10, 100, 1000, { k: "C", C: 1e-4, label: "100 µF" }, { k: "L", L: 0.1, label: "0.1 H" }, { k: "D", Vf: 2, rd: 10, Imax: 0.03, label: "red LED" }, { k: "E", E: 3, r: 0.1, label: "3 V cell" }, { k: "W", label: "wire" }] };
  })();
  function lab(api) { begin(api, LAB, null); S.mode = "lab"; api.hide(); note("Lab bench: tap a slot, tap a part, then ⏻. Parts can be reused here."); }
  function assign(api, v) {
    if (S.on || S.sel < 0) return; var L = S.L;
    if (!S.lab && used(L, v) && S.fill[S.sel] !== v) { note("That part is already in another slot."); api.sound.sfx("block"); return; }
    S.fill[S.sel] = v; api.sound.sfx("click"); S.res = null;
    var sl = slots(L), next = sl.filter(function (i) { return S.fill[i] == null; })[0]; if (next != null) S.sel = next;
  }
  function note(t) { S.note = { t: t, life: 4.5 }; }
  function switchOn(api) {
    var L = S.L; if (S.on) return;
    if (!S.lab && slots(L).some(function (i) { return S.fill[i] == null; })) { note("Fill every slot first: an empty slot is an open circuit."); api.sound.sfx("block"); return; }
    S.tries++; S.res = C.check(L, S.fill); S.on = S.lab ? 0.6 : 1.6; api.sound.sfx(S.res.blown ? "hit" : "zap");
    if (S.res.blown) { S.blown = 1; api.kick(6); api.flash("#fff3c4", .2); api.buzz(120); api.sound.sfx("boom"); var p = blowPos(); api.burst(p[0], p[1], "#ffd86b", 24, 300); }
  }
  function blowPos() { var L = S.L, i = L.els.findIndex(function (e, k) { var r = S.res && S.res.els[k]; return e.role === "lamp" || (r && r.k === "D"); }); if (i < 0) return [480, 270]; var e = L.els[i], a = L.nodes[e.a], b = L.nodes[e.b]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
  function goalText(g) { return g.label + (g.lo === 0 && g.hi < 0.01 ? " below " + fmt(g.hi * 1000, "m" + g.unit) : " " + fmt(g.lo, g.unit, g) + " – " + fmt(g.hi, g.unit, g)); }
  function verdict(api) {
    var L = S.L, r = S.res, idx = S.idx, daily = S.mode === "daily";
    if (S.lab) return;
    if (r.ok) {
      var stars = S.hints >= 3 ? 1 : S.tries === 1 ? 3 : S.tries <= 3 ? 2 : 1;
      if (daily) save.daily[L.daily] = Math.max(save.daily[L.daily] || 0, stars); else save.stars[L.name] = Math.max(save.stars[L.name] || 0, stars);
      save.tut = true; persist();
      A.report("circuit-forge", { result: "win", stage: daily ? 1 : idx + 1, score: stars * 100 + L.level });
      var next = !daily && idx + 1 < LV.length, chEnd = next && LV[idx + 1].level !== L.level, final = !daily && !next;
      var readings = L.goals.map(function (g, k) { return [g.label, fmt(r.values[k], g.unit, g)]; });
      api.ceremony(final ? "gameComplete" : "stageClear", { title: daily ? "DAILY CIRCUIT!" : final ? "WORKSHOP CLEARED!" : chEnd ? "CHAPTER DONE!" : "FIXED!", sub: L.name, trophy: final ? "crown" : chEnd ? "medal" : "star", colors: ["#f6c445", "#ffd86b", "#7ef0ff", "#ffffff"], stars: stars, len: final ? 5 : 2.6,
        score: stars * 100 + L.level, stats: readings.concat([["Switch-ons", S.tries]]), line: stars === 3 ? "First try. The numbers were right before you threw the switch." : "It works. Fewer switch-ons earn more stars.",
        then: function () { api.show("<h2>" + "★".repeat(stars) + "☆".repeat(3 - stars) + " " + A.esc(L.name) + "</h2><p>" + readings.map(function (q, k) { return A.esc(q[0]) + ": <b>" + q[1] + "</b> (goal " + fmt(L.goals[k].lo, L.goals[k].unit, L.goals[k]) + " to " + fmt(L.goals[k].hi, L.goals[k].unit, L.goals[k]) + ")"; }).join("<br>") + "<br>Solved in " + S.tries + " switch-on" + (S.tries > 1 ? "s" : "") + (S.hints ? " with " + S.hints + " hint" + (S.hints > 1 ? "s" : "") : "") + ".</p>" + explain(L) +
          (chEnd ? "<p><b>" + L.level + "-level chapter complete.</b></p>" : "") + (!daily && !next && locked.length ? "<p class='gm-small'>The next chapter opens when your student record reaches " + locked[0].level + " level.</p>" : "") +
          "<div class='gm-actions'>" + (next ? "<button class='gm-btn gm-btn--go' data-act='next'>Next circuit</button>" : "") + "<button class='gm-btn' data-act='retry'>Replay</button><button class='gm-btn' data-act='map'>Chapter map</button></div>",
          function (a) { if (a === "next") start(api, idx + 1); else if (a === "retry") { if (daily) startDaily(api); else start(api, idx); } else map(api); }); } });
    } else {
      var k = r.oks.indexOf(false), g = L.goals[Math.max(0, k)], v = r.values[Math.max(0, k)];
      var why = r.blown ? "Something burned out: it took more than its rating. Add resistance." : k < 0 ? "Close, but not yet." : v > g.hi ? g.label + " is too high (" + fmt(v, g.unit, g) + "). Think about what lowers it." : g.label + " is too low (" + fmt(v, g.unit, g) + ").";
      if (g.what === "I" && g.hi < 0.01 && !r.blown) why = "The meter still reads " + fmt(v * 1000, "mA") + ". Not balanced yet.";
      note(why); api.sound.sfx("lose");
    }
  }
  var OLD = {
    "Voltage divider": "V_out = 12 × 5 / (10 + 5) = 4 V. Sensors and ADC inputs use dividers like this.",
    "Ladder network": "8 ∥ (4 + 4) = 4 Ω, plus 2 Ω gives 6 Ω, so 10 / 6 = 1.67 A. Reduce ladders from the far end.",
    "Maximum power transfer": "P = V² R / (R + R_th)² peaks when R = R_th: 12² × 6 / 12² = 6 W. Half the power is lost in the source.",
    "Loading a DC generator": "I_a = 230 / (11 + 0.5) = 20 A, V = 230 − 20 × 0.5 = 220 V.",
    "Motor starter": "I = 220 / (5.5 + 0.5) = 36.7 A. As the motor speeds up its back emf rises and the starter is cut out step by step.",
    "Size the socket circuit": "2.5 mm²: R = ρ·2L/A = 0.41 Ω. The drop is about 8 V (3.5%), within the 4% limit. 1.5 mm² drops 5.6%.",
    "The cooker circuit": "6 mm²: R = 0.29 Ω, drop about 8.8 V (3.8%). 4 mm² drops 5.6%, too much for this rule.",
    "Limit the fault current": "I_f = 1 / (0.1 + 0.1) = 5 pu, just within the breaker's rating.",
    "Two in-feeds": "X_th = 0.2 ∥ 0.3 = 0.12 pu, so I_f = 1 / (0.12 + 0.15) = 3.7 pu."
  };
  function explain(L) { var m = L.explain || OLD[L.name]; return m ? "<p class='gm-formula' style='white-space:normal'>" + A.esc(m) + "</p>" : ""; }
  /* progressive hints: 1 the idea, 2 which slot is wrong and which way to go, 3 fit one right part (one star at most) */
  function partSize(v) { if (v == null) return null; if (typeof v === "number") return v; return v.R != null ? v.R : v.C != null ? v.C : v.L != null ? v.L : v.E != null ? v.E : null; }
  function hint(api) {
    if (!S.L || S.lab) return; var L = S.L; S.hints = Math.min(3, S.hints + 1);
    if (S.hints === 1) { note("Hint 1: " + L.text); return; }
    var sols = C.solutions(L, 6); if (!sols.length) return;
    var best = sols[0], bad = slots(L).filter(function (i) { return best[i] !== S.fill[i]; });
    sols.forEach(function (s) { var b2 = slots(L).filter(function (i) { return s[i] !== S.fill[i]; }); if (b2.length < bad.length) { best = s; bad = b2; } });
    if (!bad.length) { note("Every part is right. Switch on!"); return; }
    var i = bad[0], nm = L.els[i].name || "the glowing slot"; S.sel = i;
    if (S.hints === 2) { var want = partSize(best[i]), have = partSize(S.fill[i]); note("Hint 2: " + nm + " needs a different part" + (want != null && have != null && typeof want === typeof have && (best[i].k || "R") === ((S.fill[i] && S.fill[i].k) || "R") ? " (" + (want > have ? "bigger" : "smaller") + " than what is there)" : "") + "." + (bad.length > 1 ? " " + (bad.length - 1) + " more slot" + (bad.length > 2 ? "s" : "") + " to fix after that." : "")); }
    else { Object.keys(S.fill).forEach(function (k) { if (S.fill[k] === best[i]) delete S.fill[k]; }); S.fill[i] = best[i]; S.res = null; note("Hint 3: I fitted " + label(L, best[i]) + " in " + nm + ". This attempt can earn one star."); }
    api.sound.sfx("click");
  }
  function map(api) {
    S.mode = "menu"; S.L = null;
    var byLv = {}; LV.forEach(function (L, i) { (byLv[L.level] = byLv[L.level] || []).push(i); });
    var total = 0; LV.forEach(function (L) { total += save.stars[L.name] || 0; });
    var html = "<h2>Circuit Forge</h2><p>Count Entropy has been swapping parts all over the department. Fill every slot, switch on and meet every goal on the meters. New chapters open as you move up a level. <b>★ " + total + " / " + LV.length * 3 + "</b></p>" +
      "<div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='daily'>Daily circuit" + (save.daily[today()] ? " " + "★".repeat(save.daily[today()]) : "") + "</button><button class='gm-btn' data-act='lab'>Free lab bench</button></div><div style='display:grid;gap:12px;text-align:left'>";
    Object.keys(byLv).forEach(function (lv) {
      html += "<div><b>" + lv + " level</b><div class='gm-actions' style='justify-content:flex-start;margin-top:6px'>" + byLv[lv].map(function (i) { var L = LV[i], st = save.stars[L.name] || 0, open = unlocked(api, i);
        return "<button class='gm-btn" + (st || !open ? "" : " gm-btn--go") + "' data-act='lv' data-i='" + i + "' title='" + A.esc(L.course) + "'" + (open ? "" : " disabled aria-disabled='true'") + " style='min-height:44px'>" + (open ? (i + 1) + ". " + A.esc(L.name) + (st ? " " + "★".repeat(st) : "") : "🔒 " + (i + 1)) + "</button>"; }).join("") + "</div></div>";
    });
    locked.forEach(function (c) { html += "<div style='opacity:.6'><b>" + c.level + " level</b>: " + A.esc(c.name) + ". Opens when your student record reaches " + c.level + " level.</div>"; });
    api.show(html + "</div>", function (a, el) { if (a === "lv") start(api, +el.getAttribute("data-i")); else if (a === "daily") startDaily(api); else if (a === "lab") lab(api); });
  }

  /* ---------- drawing ---------- */
  function path(L, e) { var a = L.nodes[e.a], b = L.nodes[e.b]; if (e.bend) return [a, [a[0], a[1] + e.bend], [b[0], b[1] + e.bend], b]; return [a, b]; }
  function mid(p) { if (p.length === 4) return [(p[1][0] + p[2][0]) / 2, p[1][1]]; return [(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2]; }
  function zig(x, cx, cy, ang, w) { x.save(); x.translate(cx, cy); x.rotate(ang); x.beginPath(); x.moveTo(-w, 0); for (var k = 0; k < 6; k++) x.lineTo(-w + (k + .5) * w / 3, k % 2 ? 9 : -9); x.lineTo(w, 0); x.stroke(); x.restore(); }
  function sym(x, kind, cx, cy, ang, col, extra) { // a component symbol centred on (cx, cy) along angle ang
    x.save(); x.translate(cx, cy); x.rotate(ang); x.strokeStyle = col; x.fillStyle = col; x.lineWidth = 2.5;
    if (kind === "R") { x.restore(); zig(x, cx, cy, ang, 26); return; }
    if (kind === "C") { x.beginPath(); x.moveTo(-30, 0); x.lineTo(-5, 0); x.moveTo(5, 0); x.lineTo(30, 0); x.stroke(); x.lineWidth = 3.5; x.beginPath(); x.moveTo(-5, -14); x.lineTo(-5, 14); x.moveTo(5, -14); x.lineTo(5, 14); x.stroke(); }
    else if (kind === "L") { x.beginPath(); x.moveTo(-30, 0); for (var k = 0; k < 4; k++) x.arc(-18 + k * 12, 0, 6, Math.PI, 0); x.lineTo(30, 0); x.stroke(); }
    else if (kind === "E") { x.beginPath(); x.moveTo(-30, 0); x.lineTo(-6, 0); x.moveTo(6, 0); x.lineTo(30, 0); x.stroke(); x.lineWidth = 3; x.beginPath(); x.moveTo(-6, -15); x.lineTo(-6, 15); x.stroke(); x.lineWidth = 6; x.beginPath(); x.moveTo(6, -8); x.lineTo(6, 8); x.stroke(); }
    else if (kind === "D") { var glow = extra || 0; if (glow > 0) { var rg = x.createRadialGradient(0, 0, 2, 0, 0, 40); rg.addColorStop(0, "rgba(255,80,80," + glow + ")"); rg.addColorStop(1, "rgba(255,80,80,0)"); x.fillStyle = rg; x.fillRect(-40, -40, 80, 80); x.fillStyle = col; }
      x.beginPath(); x.moveTo(-30, 0); x.lineTo(-10, 0); x.moveTo(10, 0); x.lineTo(30, 0); x.stroke(); x.beginPath(); x.moveTo(-10, -12); x.lineTo(-10, 12); x.lineTo(10, 0); x.closePath(); x.globalAlpha = glow > 0 ? 1 : .35; x.fill(); x.globalAlpha = 1; x.stroke(); x.beginPath(); x.moveTo(10, -12); x.lineTo(10, 12); x.stroke(); }
    else if (kind === "W") { x.beginPath(); x.moveTo(-30, 0); x.lineTo(30, 0); x.stroke(); }
    x.restore();
  }
  function kindOf(e) { return e.k === "R" ? "R" : e.k; }
  function draw(api) {
    var x = api.x, L = S.L, t = api.t, k = txt(api), ks = Math.min(k, 1.4);
    var g = x.createLinearGradient(0, 0, 0, 540); g.addColorStop(0, "#0d1b24"); g.addColorStop(1, "#08121a"); x.fillStyle = g; x.fillRect(0, 0, 960, 540);
    x.strokeStyle = "rgba(126,240,255,.05)"; x.lineWidth = 1; for (var gx = 0; gx < 960; gx += 24) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, 540); x.stroke(); } for (var gy = 0; gy < 540; gy += 24) { x.beginPath(); x.moveTo(0, gy); x.lineTo(960, gy); x.stroke(); }
    if (!L) return;
    var R = S.res, sol = R && R.sol, ac = R && R.ac, live = S.on > 0 || (R && !R.blown && (R.ok || S.lab)), els = R ? R.els : L.els;
    L.els.forEach(function (e, i) {
      if (e.k === "OA") { // op-amp triangle with its three connections
        var P = L.nodes[e.p], M = L.nodes[e.m], O = L.nodes[e.o], tx = O[0] - 120, ty = O[1], my = e.flip ? ty + 26 : ty - 26, py = e.flip ? ty - 26 : ty + 26;
        var route = function (from, yy, col) { x.moveTo(from[0], from[1]); x.lineTo(col, from[1]); x.lineTo(col, yy); x.lineTo(tx, yy); };
        x.strokeStyle = "#7d8a96"; x.lineWidth = 3; x.beginPath(); route(M, my, e.flip ? M[0] : tx - 24); route(P, py, tx - 44); x.moveTo(tx + 90, ty); x.lineTo(O[0], ty); x.lineTo(O[0], O[1]); x.stroke();
        x.fillStyle = "#13222d"; x.strokeStyle = "#dfe7ee"; x.lineWidth = 2.5; x.beginPath(); x.moveTo(tx, ty - 48); x.lineTo(tx, ty + 48); x.lineTo(tx + 90, ty); x.closePath(); x.fill(); x.stroke();
        x.fillStyle = "#dfe7ee"; x.font = "700 16px system-ui"; x.textAlign = "center"; x.fillText("−", tx + 12, my + 6); x.fillText("+", tx + 12, py + 6); x.font = "12px system-ui"; x.fillText("op-amp", tx + 40, ty + 5);
        return;
      }
      var p = path(L, e), m = mid(p), ang = Math.atan2(p[p.length - 1][1] - p[0][1], p[p.length - 1][0] - p[0][0]);
      var I = sol ? sol.i[i] : 0, hot = live && Math.abs(I) > 1e-6;
      x.strokeStyle = hot ? "#e9c46a" : "#7d8a96"; x.lineWidth = 3; x.beginPath(); p.forEach(function (q, kk) { if (kk) x.lineTo(q[0], q[1]); else x.moveTo(q[0], q[1]); }); x.stroke();
      if (hot && !api.reduce && save.opt.dots) { // moving charge dots: speed ∝ log current, direction = conventional current
        var len = 0, segs = []; for (var kq = 1; kq < p.length; kq++) { var l = Math.hypot(p[kq][0] - p[kq - 1][0], p[kq][1] - p[kq - 1][1]); segs.push(l); len += l; }
        var sp = 30 + 40 * Math.log10(1 + Math.abs(I) * 10), off = ((t * sp) % 24) * (I >= 0 ? 1 : -1);
        x.fillStyle = "#ffe48a"; for (var d = ((off % 24) + 24) % 24; d < len; d += 24) { var s = d, j = 0; while (j < segs.length && s > segs[j]) { s -= segs[j]; j++; } if (j >= segs.length) break; var f = s / segs[j]; x.beginPath(); x.arc(p[j][0] + (p[j + 1][0] - p[j][0]) * f, p[j][1] + (p[j + 1][1] - p[j][1]) * f, 2.6, 0, 7); x.fill(); }
      }
      if (e.role !== "wire") { x.fillStyle = "#0d1b24"; x.fillRect(m[0] - 36, m[1] - 20, 72, 40); }
      x.strokeStyle = "#dfe7ee"; x.fillStyle = "#dfe7ee"; x.lineWidth = 2.5; x.font = "600 13px system-ui"; x.textAlign = "center";
      var vert = Math.abs(Math.sin(ang)) > .5, tag = function (s2, col) { x.fillStyle = col || "#dfe7ee"; x.font = "600 13px system-ui"; if (vert) { x.textAlign = "left"; x.fillText(s2, m[0] + 28, m[1] + 5); x.textAlign = "center"; } else x.fillText(s2, m[0], m[1] - 26); };
      if (e.role === "cell") { sym(x, "E", m[0], m[1], ang, "#dfe7ee"); tag((e.name ? e.name + ": " : "") + (L.unit === "pu" ? e.E + " pu" : Math.abs(e.E) + " V") + (e.r > 0.01 && L.unit !== "pu" ? ", r = " + e.r + " Ω" : "")); }
      else if (e.role === "ac") { x.fillStyle = "#13222d"; x.beginPath(); x.arc(m[0], m[1], 18, 0, 7); x.fill(); x.stroke(); x.beginPath(); for (var q = -12; q <= 12; q++) x.lineTo(m[0] + q, m[1] - 7 * Math.sin(q / 12 * Math.PI)); x.stroke(); tag(e.name || "AC"); }
      else if (e.role === "fixed" || e.role === "cap" || e.role === "ind") { sym(x, e.k === "C" ? "C" : e.k === "L" ? "L" : "R", m[0], m[1], ang, "#dfe7ee"); tag(e.name || e.R + " Ω"); }
      else if (e.role === "led") { var on = live && sol && I > 1e-4, gl = on ? Math.min(1, I / (e.Imax || .02)) : 0; sym(x, "D", m[0], m[1], ang, S.blown ? "#555" : "#ff6b6b", S.blown ? 0 : gl); tag(e.name || "LED"); }
      else if (e.role === "slot") {
        var sel = S.sel === i, v = S.fill[i], pe = R && R.els[i];
        x.save(); x.setLineDash(v == null ? [6, 5] : []); x.strokeStyle = sel ? "#7ef0ff" : v == null ? "#9aa8b5" : "#f6c445"; x.lineWidth = sel ? 3 : 2; x.strokeRect(m[0] - 38, m[1] - 20, 76, 40); x.restore();
        if (v != null) { var pk = typeof v === "number" ? "R" : v.k, glow2 = pk === "D" && live && sol && sol.i[i] > 1e-4 ? Math.min(1, sol.i[i] / .02) : 0; sym(x, pk, m[0], m[1], 0, "#f6c445", glow2); x.fillStyle = "#f6c445"; x.font = "600 " + Math.round(12 * ks) + "px system-ui"; x.fillText(label(L, v), m[0], m[1] + 36); }
        else { x.fillStyle = "#9aa8b5"; x.font = "700 18px system-ui"; x.fillText("?", m[0], m[1] + 6); }
        if (e.name) { x.fillStyle = "#9aa8b5"; x.font = "12px system-ui"; x.fillText(e.name, m[0], m[1] - 26); }
        if (sel && !api.reduce) { x.strokeStyle = "rgba(126,240,255," + (.3 + .3 * Math.sin(t * 6)) + ")"; x.strokeRect(m[0] - 44, m[1] - 26, 88, 52); }
        if (S.lab && live && sol && v != null) { x.fillStyle = "#7ef0ff"; x.font = "600 11px ui-monospace, monospace"; x.fillText(fmt(Math.abs(sol.i[i]), "A") + " · " + fmt(sol.v[e.a] - sol.v[e.b], "V"), m[0], m[1] + 50); }
      }
      else if (e.role === "lamp") {
        var Pw = sol ? I * I * e.R : 0, glow = S.blown ? 0 : live ? Math.min(1, Pw / (e.pmax * .7)) : 0;
        if (glow > 0) { var rg = x.createRadialGradient(m[0], m[1], 4, m[0], m[1], 70); rg.addColorStop(0, "rgba(255,220,120," + glow + ")"); rg.addColorStop(1, "rgba(255,220,120,0)"); x.fillStyle = rg; x.fillRect(m[0] - 70, m[1] - 70, 140, 140); }
        x.fillStyle = S.blown ? "#333" : glow > 0 ? "#fff3c4" : "#1b2a35"; x.beginPath(); x.arc(m[0], m[1], 18, 0, 7); x.fill(); x.stroke();
        x.beginPath(); x.moveTo(m[0] - 12, m[1] - 12); x.lineTo(m[0] + 12, m[1] + 12); x.moveTo(m[0] + 12, m[1] - 12); x.lineTo(m[0] - 12, m[1] + 12); x.stroke();
        tag(e.name || "lamp " + e.R + " Ω");
      }
      else if (e.role === "ammeter" || e.role === "galvo" || e.role === "motor") {
        x.fillStyle = "#13222d"; x.beginPath(); x.arc(m[0], m[1], 18, 0, 7); x.fill(); x.stroke(); x.fillStyle = "#dfe7ee"; x.font = "800 15px system-ui"; x.fillText(e.role === "ammeter" ? "A" : e.role === "galvo" ? "G" : "M", m[0], m[1] + 5);
        if (e.role === "galvo") { var defl = sol && live ? Math.max(-1, Math.min(1, I * 300)) : 0; x.strokeStyle = "#ff6b6b"; x.beginPath(); x.moveTo(m[0], m[1] + 12); x.lineTo(m[0] + Math.sin(defl) * 16, m[1] + 12 - Math.cos(defl) * 16); x.stroke(); }
        if (e.role === "motor") tag(e.name || "motor");
        if (live && sol && e.role !== "motor") { x.font = "600 12px ui-monospace, monospace"; x.fillStyle = "#7ef0ff"; var Ishow = ac && L.f ? C.cabs(ac.ci[i]) : Math.abs(I); x.fillText(fmt(Ishow, L.unit === "pu" ? "pu" : "A"), m[0], m[1] + 34); }
      }
      else if (e.role === "fault") { x.strokeStyle = "#ff6b6b"; x.lineWidth = 3; x.beginPath(); x.moveTo(m[0] - 6, m[1] - 18); x.lineTo(m[0] + 6, m[1] - 2); x.lineTo(m[0] - 6, m[1] + 2); x.lineTo(m[0] + 6, m[1] + 18); x.stroke(); tag("3-φ fault", "#ff9b9b"); }
    });
    L.nodes.forEach(function (n, ni) { x.fillStyle = "#dfe7ee"; x.beginPath(); x.arc(n[0], n[1], 3.5, 0, 7); x.fill();
      if (save.opt.volts && live && sol && !L.f) { x.fillStyle = "#9fe0ff"; x.font = "600 11px ui-monospace, monospace"; x.textAlign = "left"; x.fillText(fmt(sol.v[ni], L.unit === "pu" ? "pu" : "V"), n[0] + 6, n[1] - 6); } });
    // header + goals
    x.textAlign = "left"; x.fillStyle = "#fff"; x.font = "700 " + Math.round(18 * ks) + "px system-ui"; x.fillText((S.mode === "daily" ? "Daily · " : S.lab ? "" : (S.idx + 1) + ". ") + L.name, 24, 30 * ks);
    x.fillStyle = "#9fdcff"; x.font = Math.round(13 * ks) + "px system-ui"; x.fillText(L.course + (S.lab ? "" : " · " + L.level + " level"), 24, 30 * ks + 18 * ks);
    x.textAlign = "right"; L.goals.forEach(function (gg, gi) { var y = 30 * ks + gi * 40 * ks; x.fillStyle = "#f6c445"; x.font = "600 " + Math.round(14 * ks) + "px system-ui"; x.fillText("Goal: " + goalText(gg), 936, y);
      if (R && !S.on) { x.fillStyle = R.oks[gi] ? "#3dd68c" : "#ff8080"; x.fillText((R.oks[gi] ? "✓ " : "✗ ") + fmt(R.values[gi], gg.unit, gg), 936, y + 19 * ks); } });
    // tray
    var n = L.tray.length, step = Math.min(130, 860 / n), w = Math.min(112, step - 8), x0 = 480 - (n - 1) * step / 2;
    x.textAlign = "center"; L.tray.forEach(function (v, kk) { var bx = x0 + kk * step, by = 490, u = !S.lab && used(L, v) && !(S.fill[S.sel] === v);
      x.fillStyle = u ? "rgba(255,255,255,.05)" : "rgba(246,196,69,.14)"; x.strokeStyle = u ? "#3a4652" : "#f6c445"; x.lineWidth = 2; x.beginPath(); x.roundRect ? x.roundRect(bx - w / 2, by - 24, w, 48, 10) : x.rect(bx - w / 2, by - 24, w, 48); x.fill(); x.stroke();
      x.fillStyle = u ? "#5a6672" : "#fff"; var lb = (kk + 1) + "  " + label(L, v), fs = Math.round(14 * ks); x.font = "700 " + fs + "px system-ui"; while (x.measureText(lb).width > w - 8 && fs > 9) { fs--; x.font = "700 " + fs + "px system-ui"; } x.fillText(lb, bx, by + 5); });
    var tips = ["Tap a dashed slot (or press N) to select it.", "Now tap a part below (or press 1–" + n + ") to fit it.", "Press Space (⏻) to switch on and read the meters."];
    var emptyN = slots(L).filter(function (i) { return S.fill[i] == null; }).length, tut = emptyN ? (S.sel >= 0 && S.fill[S.sel] == null ? 1 : 0) : (R ? 3 : 2);
    if (tut < 3 && !save.tut && !S.lab) { var tsz = Math.round(13 * ks); x.fillStyle = "rgba(4,12,18,.85)"; x.fillRect(180, 440, 600, tsz + 10); x.fillStyle = "#7ef0ff"; x.textAlign = "center"; x.font = "600 " + tsz + "px system-ui"; x.fillText("Tutorial: " + tips[tut], 480, 440 + tsz + 2); }
    if (S.note && S.note.life > 0) { x.globalAlpha = Math.min(1, S.note.life); var fsn = Math.round(13.5 * ks), lines = wrap(x, S.note.t, 780, fsn), h = lines.length * fsn * 1.35 + 12; x.fillStyle = "rgba(4,12,18,.92)"; x.fillRect(80, 462 - h, 800, h); x.fillStyle = "#ffd2d2"; x.textAlign = "center"; x.font = "600 " + fsn + "px system-ui"; lines.forEach(function (ln, j) { x.fillText(ln, 480, 462 - h + 6 + fsn + j * fsn * 1.35); }); x.globalAlpha = 1; }
  }
  function wrap(x, s, w, fs) { x.font = "600 " + fs + "px system-ui"; var words = String(s).split(" "), out = [], cur = ""; words.forEach(function (wd) { var t2 = cur ? cur + " " + wd : wd; if (x.measureText(t2).width > w && cur) { out.push(cur); cur = wd; } else cur = t2; }); if (cur) out.push(cur); return out.slice(0, 4); }
  function hitSlot(mx, my) { var L = S.L, out = -1; slots(L).forEach(function (i) { var m = mid(path(L, L.els[i])); if (Math.abs(mx - m[0]) < 46 && Math.abs(my - m[1]) < 30) out = i; }); return out; }

  var game = { savePrefix: ["ee-arcade-forge"], song: A.song(599, "calm"), menu: function (api) { map(api); },
    actions: [{ id: "slot", label: "Next slot", keys: ["KeyN", "Tab"], touch: { label: "⇥", x: 8, y: 70 } }, { id: "on", label: "Switch on", keys: ["Space", "Enter"], touch: { label: "⏻", x: 92, y: 60 } },
      { id: "clear", label: "Clear slot", keys: ["KeyX", "Backspace"], touch: { label: "✕", x: 8, y: 50 } }, { id: "hint", label: "Hint", keys: ["KeyH"], touch: { label: "?", x: 92, y: 40 } }, { id: "map", label: "Chapter map", keys: ["KeyB"], touch: { label: "▦", x: 92, y: 20 } }],
    click: function (mx, my, api) {
      if (!S.L || api.overlayOpen()) return; var s = hitSlot(mx, my); if (s >= 0) { S.sel = s; api.sound.sfx("click"); return; }
      var n = S.L.tray.length, step = Math.min(130, 860 / n), w = Math.min(112, step - 8), x0 = 480 - (n - 1) * step / 2;
      S.L.tray.forEach(function (v, kk) { if (Math.abs(mx - (x0 + kk * step)) < w / 2 && Math.abs(my - 490) < 26) assign(api, v); });
    },
    init: function (api) {
      setupCheats(api);
      api.panel("<p>Every circuit obeys Ohm's law and Kirchhoff's laws. The game solves the real circuit with nodal analysis (complex phasors for AC), so whatever you build behaves exactly as the theory says.</p><table><tr><td>Ohm's law</td><td><span class='gm-eq'>V = IR</span></td></tr><tr><td>Series</td><td><span class='gm-eq'>R = R₁ + R₂</span> (Ω)</td></tr><tr><td>Parallel</td><td><span class='gm-eq'>1/R = 1/R₁ + 1/R₂</span></td></tr><tr><td>Real cell</td><td><span class='gm-eq'>V = E − Ir</span> (V)</td></tr><tr><td>Power</td><td><span class='gm-eq'>P = I²R = V²/R</span> (W)</td></tr><tr><td>Bridge balance</td><td><span class='gm-eq'>P/Q = R/S</span></td></tr><tr><td>Time constant</td><td><span class='gm-eq'>τ = R_th C</span></td></tr><tr><td>Reactance</td><td><span class='gm-eq'>X_C = 1/(2πfC)</span>, <span class='gm-eq'>X_L = 2πfL</span></td></tr><tr><td>Resonance</td><td><span class='gm-eq'>f₀ = 1/(2π√LC)</span></td></tr><tr><td>Op-amps</td><td>inverting <span class='gm-eq'>−R_f/R_in</span>, non-inverting <span class='gm-eq'>1 + R_f/R₁</span></td></tr></table><p class='gm-small'>Model: ideal wires and meters; lamps are fixed resistors; LEDs drop a fixed forward voltage plus a small resistance; op-amps are ideal (very high gain); 400-level cables use ρ(copper) = 1.72 × 10⁻⁸ Ω·m with resistive loads; 500-level faults use reactance magnitudes in per unit. Chapters: PHYS 162 and PHYS 122 (100), ENGG 205 (200), EEEN 309 and AC circuits (300), op-amps and EEEN 415 (400), power factor and EEEN 527 (500).</p>",
        "<p class='gm-small'>Tap a slot, then tap a part in the tray (or press 1–8). Every goal on the right must turn green.</p>");
      if (api.settings && api.settings.add) {
        api.settings.add({ id: "cf_dots", tab: "display", section: "Circuit Forge", label: "Moving current dots", type: "toggle", default: save.opt.dots, apply: function (v) { save.opt.dots = !!v; persist(); } });
        api.settings.add({ id: "cf_volts", tab: "gameplay", section: "Circuit Forge", label: "Show node voltages after switching on", type: "toggle", default: save.opt.volts, apply: function (v) { save.opt.volts = !!v; persist(); } });
        api.settings.add({ id: "cf_all", tab: "gameplay", section: "Circuit Forge", label: "Open every circuit (practice)", type: "toggle", default: !!save.all, help: "Play circuits out of order. Chapters above your student level still need that level.", apply: function (v) { save.all = !!v; persist(); } });
      }
      map(api);
    },
    update: function (dt, api) {
      if (api.hero.inUse !== api.hero.active) api.hero.use(api.hero.active);
      if (S.note) S.note.life -= dt;
      if (!S.L || api.overlayOpen()) return;
      if (S.on > 0) { S.on -= dt; if (S.on <= 0) { S.on = 0; verdict(api); } return; }
      var sl = slots(S.L);
      if (api.hit("slot")) { S.sel = sl[(sl.indexOf(S.sel) + 1) % sl.length]; }
      for (var k = 0; k < S.L.tray.length; k++) if (api.hit("Digit" + (k + 1))) assign(api, S.L.tray[k]);
      if (api.hit("clear")) { delete S.fill[S.sel]; S.res = null; S.blown = 0; }
      if (api.hit("on")) { S.blown = 0; switchOn(api); }
      if (api.hit("hint")) hint(api);
      if (api.hit("map")) map(api);
    },
    draw: draw
  };
  A.run(game);
  window.CircuitForge = { S: S, save: save, unlocked: function (i) { return unlocked(null, i); } };
})();
