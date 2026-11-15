/* course-fx: laboratory bench with identifiable instruments (bench), a building's electrical installation (wiring). */
(function () {
  "use strict";
  var FX = window.CourseFX; if (!FX) return;
  var TAU = Math.PI * 2, sin = Math.sin, cos = Math.cos, PI = Math.PI;

  function wave(kind, u) {
    var p = ((u % 1) + 1) % 1;
    if (kind === "square") return p < 0.5 ? 0.85 : -0.85;
    if (kind === "triangle") return p < 0.5 ? -0.9 + 3.6 * p : 2.7 - 3.6 * p;
    return 0.9 * sin(TAU * p);
  }

  /* ================================================================= bench */
  FX.define("bench", {
    aspect: 1.75, aspectSmall: 0.9,
    controls: [
      { key: "wf", label: "Generator", type: "select", value: "sine", options: [["sine", "Sine"], ["square", "Square"], ["triangle", "Triangle"]] },
      { key: "fq", label: "Frequency", min: 100, max: 5000, step: 50, value: 1000, unit: " Hz" },
      { key: "run", label: "Machine set on", type: "toggle", value: true }
    ],
    init: function (f) { f.state.ang = 0; f.state.spd = 0; f.state.flow = 0; },
    draw: function (f) {
      var c = f.c, s = f.state, hero = f.mode === "hero";
      var wf = hero ? ["sine", "square", "triangle"][Math.floor(f.t / 5) % 3] : (f.v.wf || "sine");
      var fq = hero ? 1000 : (f.v.fq || 1000), run = hero ? true : f.v.run !== false;
      s.spd += ((run ? 1 : 0) - s.spd) * Math.min(1, (f.dt || 0) * 0.8);
      s.ang += (f.dt || 0) * s.spd * 14;
      s.flow += (f.dt || 0) * 0.5;
      f.clear();
      var W = f.w, H = f.h, small = W / H < 1.2 || (hero && W < 560);
      // wall and bench
      var benchY = small ? H * 0.46 : H * 0.7;
      var g = f.ctx.createLinearGradient(0, benchY, 0, H);
      g.addColorStop(0, "rgba(160,120,70,.35)"); g.addColorStop(1, "rgba(60,40,20,.35)");
      f.ctx.save(); f.ctx.fillStyle = g; f.ctx.fillRect(0, benchY, W, H - benchY); f.ctx.restore();
      f.seg(0, benchY, W, benchY, "rgba(255,220,170,.35)", 2);
      var sc = small ? Math.min((W - 30) / 472, H / 600) : Math.min((W - 40) / 850, H / 330);
      function u(v) { return v * sc; }
      // ---- oscilloscope
      var ox = small ? 15 : 20, ow = u(230), oh = u(150), oy = benchY - oh;
      f.box(ox, oy, ow, oh, u(10), "#2a3036", "rgba(255,255,255,.18)", 1.2);
      var sx = ox + u(12), sy = oy + u(14), sw = u(140), sh = u(110);
      f.box(sx, sy, sw, sh, u(4), "#04140d", "rgba(120,255,190,.25)", 1);
      f.grid(sx, sy, sw, sh, sw / 10, "rgba(120,255,190,.08)");
      var cycles = fq / 1000 * 2.5, pts = [];
      var sweep = f.reduce ? 0 : f.t * 2;
      for (var k = 0; k <= 140; k++) { var uu = k / 140; pts.push([sx + uu * sw, sy + sh / 2 - wave(wf, uu * cycles + sweep * 0) * sh * 0.38]); }
      f.line(pts, "#7dffb6", 1.8, { glow: 12 });
      if (run) { var pts2 = []; for (var k2 = 0; k2 <= 140; k2++) { var u2 = k2 / 140; pts2.push([sx + u2 * sw, sy + sh * 0.78 - sin(TAU * (u2 * 2 + s.ang * 0.05)) * sh * 0.12 * s.spd]); } f.line(pts2, "#ffd23f", 1.4, { glow: 8 }); }
      for (var kn = 0; kn < 6; kn++) f.circle(sx + sw + u(22) + (kn % 2) * u(30), sy + u(16) + Math.floor(kn / 2) * u(32), u(9), "#454c53", "rgba(255,255,255,.3)", 1);
      f.text("CH1 " + (fq >= 1000 ? (fq / 1000).toFixed(2) + " kHz" : fq + " Hz"), sx + u(4), sy + sh - u(8), { size: Math.max(8, u(9)), mono: true, color: "#7dffb6" });
      f.hit({ x: ox, y: oy, w: ow, h: oh }, "Digital storage oscilloscope", "Shows voltage against time. CH1: the function generator; CH2 (yellow): the alternator output when the machine set runs.");
      // ---- function generator
      var gx = ox + ow + u(14), gw = u(150), gh = u(70), gy = benchY - gh;
      f.box(gx, gy, gw, gh, u(8), "#30363c", "rgba(255,255,255,.18)", 1.2);
      f.box(gx + u(10), gy + u(10), u(84), u(26), u(3), "#0b1a26", "rgba(94,200,255,.35)", 1);
      f.text((fq >= 1000 ? (fq / 1000).toFixed(3) + " kHz" : fq.toFixed(1) + " Hz"), gx + u(52), gy + u(23), { size: Math.max(8, u(11)), mono: true, color: "#5ec8ff", align: "center", glow: 6 });
      ["sine", "square", "triangle"].forEach(function (w, i) { f.box(gx + u(10) + i * u(30), gy + u(44), u(24), u(14), u(3), w === wf ? c.a : "#4a5157"); });
      f.circle(gx + gw - u(26), gy + gh / 2, u(16), "#4a5157", "rgba(255,255,255,.3)", 1.2);
      f.hit({ x: gx, y: gy, w: gw, h: gh }, "Function generator", "Produces sine, square and triangle signals of chosen frequency and amplitude.");
      // probe cable gen -> scope with signal dots
      var cable = [[gx + u(20), gy + gh], [gx + u(20), benchY + u(16)], [ox + ow * 0.7, benchY + u(16)], [ox + ow * 0.7, oy + oh]];
      f.line(cable, "rgba(94,200,255,.6)", 2);
      FX.flowDots(f, cable, s.flow, 5, "#5ec8ff", 2);
      // ---- multimeter
      var mx = gx + gw + u(14), mw = u(64), mh = u(110), my = benchY - mh;
      if (!small || true) {
        f.box(mx, my, mw, mh, u(10), "#e8b923", "rgba(0,0,0,.4)", 1.2);
        f.box(mx + u(8), my + u(10), mw - u(16), u(26), u(3), "#c9d6b5");
        var reading = run ? (229.4 + sin(f.t * 1.7) * 0.6 + sin(f.t * 5.3) * 0.2) : 0;
        f.text(reading.toFixed(1), mx + mw / 2, my + u(24), { size: Math.max(8, u(13)), mono: true, color: "#111", align: "center", weight: 700 });
        f.circle(mx + mw / 2, my + u(66), u(17), "#333", "#111", 1);
        f.seg(mx + mw / 2, my + u(66), mx + mw / 2 + u(10), my + u(56), "#ddd", 2);
        f.hit({ x: mx, y: my, w: mw, h: mh }, "Digital multimeter", "Measuring the alternator's terminal voltage (V AC). Also measures current, resistance and continuity.");
      }
      // ---- 3-phase supply panel (wall)
      var pw = u(150), ph = u(96), px = W - pw - (small ? 15 : 24) - (small ? 0 : u(40)), py = small ? benchY + u(20) : H * 0.06;
      f.box(px, py, pw, ph, u(8), "#2e3a33", "rgba(255,255,255,.2)", 1.2);
      f.text("3-PHASE SUPPLY 400 V", px + pw / 2, py + u(14), { size: Math.max(7, u(9)), weight: 700, align: "center", color: "#cfe" });
      ["#ff5d5d", "#ffd23f", "#4da3ff"].forEach(function (col, i) { f.circle(px + u(28) + i * u(30), py + u(42), u(9), col, null, 0, { glow: 12, glowColor: col }); f.text("RYB"[i], px + u(28) + i * u(30), py + u(60), { size: Math.max(7, u(9)), align: "center", color: "#cfe", weight: 700 }); });
      f.circle(px + pw - u(26), py + u(50), u(18), "#c62828", "#ffd23f", u(4), { glow: 8, glowColor: "#ff4d4d" });
      f.text("STOP", px + pw - u(26), py + u(50), { size: Math.max(6, u(7.5)), weight: 800, align: "center", color: "#fff" });
      f.hit({ x: px, y: py, w: pw, h: ph }, "Three-phase supply panel", "R, Y and B phase lamps, isolator and the emergency-stop button. Know where it is before you switch on.");
      // ---- transformer
      var tw = u(96), th = u(84), tx = small ? 15 : mx + mw + u(14), ty = small ? H - th - u(30) : benchY - th;
      f.box(tx, ty, tw, th, u(4), "#56606a", "rgba(255,255,255,.2)", 1);
      f.box(tx + u(14), ty + u(14), tw - u(28), th - u(28), u(2), "#1e2328");
      [[tx + u(4), "#c77d32"], [tx + tw - u(26), "#c77d32"]].forEach(function (cw) { for (var r = 0; r < 6; r++) f.box(cw[0], ty + u(16) + r * u(9), u(22), u(7), u(3), cw[1], "rgba(0,0,0,.4)", 0.8); });
      f.hit({ x: tx, y: ty, w: tw, h: th }, "Single-phase transformer", "Open- and short-circuit tests give its equivalent circuit and efficiency.");
      // ---- DC machine + alternator set
      var setW = u(230), mr = u(38);
      var mbx = small ? W - setW - 15 : Math.max(tx + tw + u(20), W - setW - 20), mby = small ? H - u(60) : benchY - u(10);
      f.box(mbx, mby + mr * 0.65, setW, u(12), u(3), "#3b4248");
      [[mbx + u(10), "#2f6b4f", "DC motor"], [mbx + setW - u(10) - mr * 2.2, "#2d4f7c", "Alternator"]].forEach(function (m, i) {
        f.box(m[0], mby - mr, mr * 2.2, mr * 1.7, u(14), m[1], "rgba(255,255,255,.25)", 1.2);
        for (var fn = 0; fn < 5; fn++) f.seg(m[0] + u(8), mby - mr + u(10) + fn * u(10), m[0] + mr * 2.2 - u(8), mby - mr + u(10) + fn * u(10), "rgba(0,0,0,.25)", 2);
        f.text(m[2], m[0] + mr * 1.1, mby + mr * 0.95 + u(8), { size: Math.max(8, u(10)), align: "center", color: c.ink, weight: 700 });
        f.hit({ x: m[0], y: mby - mr, w: mr * 2.2, h: mr * 1.7 }, i ? "Alternator (synchronous generator)" : "DC motor (prime mover)", i ? "Driven by the DC motor; its field current sets the generated voltage. Used for OCC/SCC tests and synchronising." : "Its speed is set by the armature voltage and field rheostat.");
      });
      // shaft coupling (rotating spokes)
      var cxp = mbx + setW / 2, cyp = mby - mr * 0.15;
      f.seg(mbx + u(10) + mr * 2.2, cyp, mbx + setW - u(10) - mr * 2.2, cyp, "#9aa3ab", u(6));
      f.circle(cxp, cyp, u(14), "#59626a", "#c7ced4", 1.2);
      for (var sp = 0; sp < 4; sp++) { var a = s.ang + sp * PI / 2; f.seg(cxp, cyp, cxp + cos(a) * u(13), cyp + sin(a) * u(13), "#e7ecef", 1.6); }
      f.text(Math.round(1500 * s.spd) + " rpm", cxp, cyp - u(24), { size: Math.max(8, u(10)), mono: true, align: "center", color: c.b });
      f.hit({ x: cxp - u(16), y: cyp - u(16), w: u(32), h: u(32) }, "Coupling and tachometer", "Shaft speed: " + Math.round(1500 * s.spd) + " rpm (synchronous speed of a 4-pole machine at 50 Hz).");
      if (!hero && !small) f.text("Point at any instrument to identify it", W - 46, H - 14, { size: 10.5, color: c.dim, align: "right" });
    }
  });

  /* ================================================================ wiring */
  var CIRCUITS = [
    { key: "lights", lab: "Lighting", mcb: 6, load: 0.6, col: "#f6c445" },
    { key: "sockets", lab: "Sockets (RCD)", mcb: 20, load: 2.8, col: "#5ec8ff" },
    { key: "cooker", lab: "Cooker", mcb: 32, load: 4.0, col: "#ff7a7a" },
    { key: "ac", lab: "Air-conditioner", mcb: 20, load: 1.9, col: "#3dd68c" }
  ];
  FX.define("wiring", {
    aspect: 1.6, aspectSmall: 0.85,
    controls: [
      { key: "lights", label: "Lights", type: "toggle", value: true },
      { key: "sockets", label: "Sockets", type: "toggle", value: true },
      { key: "cooker", label: "Cooker", type: "toggle", value: false },
      { key: "ac", label: "Air-con", type: "toggle", value: true },
      { key: "rcd", label: "Test RCD", type: "button" }
    ],
    init: function (f) { f.state.flow = 0; f.state.trip = -9; },
    onChange: function (f, k) { if (k === "rcd") f.state.trip = f.t; },
    draw: function (f) {
      var c = f.c, s = f.state, hero = f.mode === "hero";
      var on = {};
      CIRCUITS.forEach(function (ci, i) { on[ci.key] = hero ? (Math.floor(f.t / 2.5 + i) % 3 !== 0) : !!f.v[ci.key]; });
      var tripped = !hero && f.t - s.trip < 4 && s.trip > 0;
      if (tripped) on.sockets = false;
      s.flow += (f.dt || 0) * 0.5;
      f.clear();
      var small = f.w / f.h < 1.2;
      var px = 16, py = 16, pw = small ? f.w - 32 : f.w * 0.66, ph = small ? f.h * 0.62 : f.h - 32;
      var X = function (u) { return px + u * pw; }, Y = function (v) { return py + v * ph; };
      var wall = f.a(c.ink, 0.55);
      // rooms
      f.box(px, py, pw, ph, 4, "rgba(255,255,255,.02)", wall, 3);
      [[[0.45, 0], [0.45, 0.55]], [[0, 0.55], [0.7, 0.55]], [[0.7, 0.55], [0.7, 1]], [[0.45, 0.3], [1, 0.3]], [[0.82, 0.55], [1, 0.55]], [[0.82, 0.3], [0.82, 0.55]]].forEach(function (w) { f.seg(X(w[0][0]), Y(w[0][1]), X(w[1][0]), Y(w[1][1]), wall, 2.4); });
      [["Living room", 0.22, 0.27], ["Bedroom", 0.72, 0.14], ["Kitchen", 0.35, 0.78], ["Bedroom", 0.85, 0.78], ["Bath", 0.91, 0.42]].forEach(function (r) { f.text(r[0], X(r[1]), Y(r[2]), { size: small ? 9.5 : 11, align: "center", color: c.dim }); });
      // distribution board at the entrance
      var db = [X(0.02), Y(0.6)];
      f.box(db[0], db[1], 26, 46, 3, "#20262b", c.b, 1.6, { glow: 8, glowColor: c.b });
      f.text("DB", db[0] + 13, db[1] + 56, { size: 10, weight: 800, align: "center", color: c.b });
      f.hit({ x: db[0], y: db[1], w: 26, h: 46 }, "Distribution board", "Main switch, RCD and one MCB per final circuit.");
      var start = [db[0] + 26, db[1] + 23];
      var paths = {
        lights: [start, [X(0.08), db[1] + 23], [X(0.08), Y(0.1)], [X(0.95), Y(0.1)]],
        sockets: [start, [X(0.1), db[1] + 23], [X(0.1), Y(0.48)], [X(0.43), Y(0.48)], [X(0.43), Y(0.36)], [X(0.95), Y(0.36)], [X(0.95), Y(0.62)]],
        cooker: [start, [X(0.06), db[1] + 23], [X(0.06), Y(0.95)], [X(0.3), Y(0.95)]],
        ac: [start, [X(0.12), db[1] + 23], [X(0.12), Y(0.62)], [X(0.76), Y(0.62)], [X(0.76), Y(0.9)]]
      };
      CIRCUITS.forEach(function (ci) {
        var p = paths[ci.key], live = on[ci.key];
        f.line(p, f.a(ci.col, live ? 0.85 : 0.25), live ? 2 : 1.4, { dash: [6, 4], glow: live ? 6 : 0 });
        if (live) FX.flowDots(f, p, s.flow * (0.5 + ci.load / 4), null, ci.col, 2.2);
      });
      // points
      var lamp = function (x, y) { var lit = on.lights; f.circle(x, y, 8, lit ? f.a("#f6c445", 0.5) : "rgba(0,0,0,.3)", "#f6c445", 1.4, { glow: lit ? 18 : 0, glowColor: "#f6c445" }); f.seg(x - 5, y - 5, x + 5, y + 5, "#f6c445", 1.2); f.seg(x - 5, y + 5, x + 5, y - 5, "#f6c445", 1.2); };
      [[0.2, 0.1], [0.62, 0.1], [0.88, 0.1]].forEach(function (q) { lamp(X(q[0]), Y(q[1])); });
      [[0.3, 0.48], [0.6, 0.36], [0.95, 0.5]].forEach(function (q) { f.box(X(q[0]) - 7, Y(q[1]) - 6, 14, 12, 2, on.sockets ? f.a("#5ec8ff", 0.4) : "rgba(0,0,0,.3)", "#5ec8ff", 1.3); });
      f.box(X(0.3) - 14, Y(0.95) - 14, 28, 22, 3, on.cooker ? f.a("#ff7a7a", 0.4) : "rgba(0,0,0,.3)", "#ff7a7a", 1.4, { glow: on.cooker ? 12 : 0, glowColor: "#ff7a7a" });
      f.box(X(0.76) - 18, Y(0.9) - 8, 36, 14, 3, on.ac ? f.a("#3dd68c", 0.4) : "rgba(0,0,0,.3)", "#3dd68c", 1.4, { glow: on.ac ? 12 : 0, glowColor: "#3dd68c" });
      if (tripped) {
        var tt = f.t - s.trip;
        if (tt < 0.8) { var lx = X(0.6), ly = Y(0.36); f.circle(lx, ly, 10 + tt * 30, null, f.a(c.d, 1 - tt), 2); }
        f.text("RCD TRIPPED — 30 mA leakage detected", X(0.5), Y(0.5) + 4, { size: 11, weight: 800, align: "center", color: c.d });
      }
      // schedule panel
      var sx = small ? 16 : px + pw + 18, sy = small ? py + ph + 16 : py, sw = small ? f.w - 32 : f.w - sx - 16;
      var total = 0, maxd = 0;
      CIRCUITS.forEach(function (ci) { if (on[ci.key]) { total += ci.load; maxd += ci.key === "cooker" ? Math.min(ci.load, 1 + 0.3 * (ci.load - 1)) : ci.key === "sockets" ? ci.load * 0.4 + 0.5 : ci.load * (ci.key === "lights" ? 0.66 : 1); } });
      if (!small) {
        f.text("Distribution board", sx, sy + 8, { size: 12, weight: 800 });
        CIRCUITS.forEach(function (ci, i) {
          var y = sy + 30 + i * 34, live = on[ci.key];
          f.box(sx, y, 16, 24, 3, live ? ci.col : "#3a4046", null, 0, { glow: live ? 8 : 0, glowColor: ci.col });
          f.text(ci.lab, sx + 24, y + 7, { size: 11, weight: 700 });
          f.text(ci.mcb + " A MCB · " + ci.load.toFixed(1) + " kW", sx + 24, y + 19, { size: 10, mono: true, color: c.dim });
        });
        var ty = sy + 30 + 4 * 34 + 10;
        f.text("Connected " + total.toFixed(1) + " kW", sx, ty, { size: 11.5, mono: true });
        f.text("Max demand ≈ " + maxd.toFixed(1) + " kW", sx, ty + 18, { size: 11.5, mono: true, color: c.b, weight: 700 });
        f.text("I_b ≈ " + (maxd * 1000 / 230).toFixed(0) + " A at 230 V", sx, ty + 36, { size: 11.5, mono: true, color: c.ink });
      } else {
        f.text("Connected " + total.toFixed(1) + " kW · max demand ≈ " + maxd.toFixed(1) + " kW · I_b ≈ " + (maxd * 1000 / 230).toFixed(0) + " A", sx, sy + 8, { size: 10.5, mono: true, color: c.b });
      }
    }
  });
})();
