/* course-fx: power electronics — buck/boost converter (buck), thyristor firing angle (thyristor), sinusoidal PWM (spwm). */
(function () {
  "use strict";
  var FX = window.CourseFX; if (!FX) return;
  var TAU = Math.PI * 2, sin = Math.sin, cos = Math.cos, PI = Math.PI;

  /* ---- circuit symbols --------------------------------------------------- */
  var S = {
    battery: function (f, x, y1, y2, col) {
      var m = (y1 + y2) / 2, w = 14;
      f.seg(x, y1, x, m - 6, col, 2); f.seg(x, m + 6, x, y2, col, 2);
      f.seg(x - w, m - 6, x + w, m - 6, col, 2.4); f.seg(x - w * 0.55, m + 6, x + w * 0.55, m + 6, col, 3.4);
    },
    switchH: function (f, x1, x2, y, closed, col) {
      f.circle(x1, y, 3, col); f.circle(x2, y, 3, col);
      var ang = closed ? 0 : -0.5, L = x2 - x1;
      f.seg(x1, y, x1 + cos(ang) * L, y + sin(ang) * L, closed ? f.c.a : col, 2.4, { glow: closed ? 10 : 0 });
    },
    switchV: function (f, x, y1, y2, closed, col) {
      f.circle(x, y1, 3, col); f.circle(x, y2, 3, col);
      var ang = closed ? PI / 2 : PI / 2 - 0.5, L = y2 - y1;
      f.seg(x, y1, x + cos(ang) * L, y1 + sin(ang) * L, closed ? f.c.a : col, 2.4, { glow: closed ? 10 : 0 });
    },
    diode: function (f, x1, y1, x2, y2, on, col) { // anode (x1,y1) -> cathode (x2,y2)
      var mx = (x1 + x2) / 2, my = (y1 + y2) / 2, ang = Math.atan2(y2 - y1, x2 - x1), s = 9;
      var ux = cos(ang), uy = sin(ang), nx = -uy, ny = ux;
      f.seg(x1, y1, mx - ux * s, my - uy * s, col, 2); f.seg(mx + ux * s, my + uy * s, x2, y2, col, 2);
      f.line([[mx - ux * s + nx * s, my - uy * s + ny * s], [mx - ux * s - nx * s, my - uy * s - ny * s], [mx + ux * s, my + uy * s]], on ? f.c.a : col, 1.8, { close: true, fill: f.a(on ? f.c.a : col, on ? 0.5 : 0.15), glow: on ? 10 : 0 });
      f.seg(mx + ux * s + nx * s, my + uy * s + ny * s, mx + ux * s - nx * s, my + uy * s - ny * s, on ? f.c.a : col, 2.2);
    },
    inductor: function (f, x1, x2, y, col, glow) {
      var n = 4, w = (x2 - x1) / n, x = f.ctx;
      x.save(); x.strokeStyle = col; x.lineWidth = 2.2; if (glow) f.glow(col, 10);
      x.beginPath(); for (var i = 0; i < n; i++) x.arc(x1 + w * (i + 0.5), y, w / 2, PI, 0); x.stroke(); x.restore();
    },
    inductorV: function (f, x, y1, y2, col) {
      var n = 4, h = (y2 - y1) / n, c = f.ctx;
      c.save(); c.strokeStyle = col; c.lineWidth = 2.2; c.beginPath();
      for (var i = 0; i < n; i++) c.arc(x, y1 + h * (i + 0.5), h / 2, -PI / 2, PI / 2); c.stroke(); c.restore();
    },
    cap: function (f, x, y1, y2, col, level) {
      var m = (y1 + y2) / 2, w = 13;
      f.seg(x, y1, x, m - 5, col, 2); f.seg(x, m + 5, x, y2, col, 2);
      f.seg(x - w, m - 5, x + w, m - 5, col, 2.6); f.seg(x - w, m + 5, x + w, m + 5, col, 2.6);
      if (level) f.box(x - w + 1, m - 4, 2 * w - 2, 8, 1, f.a(f.c.b, 0.2 + 0.5 * level), null, 0, { glow: 8, glowColor: f.c.b });
    },
    res: function (f, x, y1, y2, col, glow) {
      var m = (y1 + y2) / 2, h = Math.min(40, (y2 - y1) * 0.5), pts = [[x, y1], [x, m - h / 2]];
      for (var i = 1; i <= 6; i++) pts.push([x + (i % 2 ? 7 : -7), m - h / 2 + h * i / 6.5]);
      pts.push([x, m + h / 2], [x, y2]);
      f.line(pts, glow ? f.c.b : col, 2, { glow: glow ? 10 : 0 });
    }
  };
  FX.sym = S;

  var along = FX.along, flowDots = FX.flowDots;

  /* ================================================================== buck */
  FX.define("buck", {
    aspect: 1.55, aspectSmall: 0.72,
    controls: [
      { key: "topo", label: "Topology", type: "select", value: "buck", options: [["buck", "Buck"], ["boost", "Boost"]] },
      { key: "D", label: "Duty ratio D", min: 0.1, max: 0.85, step: 0.01, value: 0.5, fmt: function (v) { return v.toFixed(2); } }
    ],
    init: function (f) { f.state.ph = 0; f.state.flow = 0; },
    draw: function (f) {
      var c = f.c, s = f.state, hero = f.mode === "hero";
      var topo = hero ? (Math.floor(f.t / 9) % 2 ? "boost" : "buck") : (f.v.topo || "buck");
      var D = hero ? 0.45 + 0.15 * sin(f.t * 0.4) : (f.v.D || 0.5);
      var period = 1.6; // seconds per switching period (slow motion)
      s.ph += (f.dt || 0) / period;
      var ph = f.reduce && !f.playing ? 0.3 : s.ph;
      var frac = ph % 1, on = frac < D;
      var Vin = 24, Vo = topo === "buck" ? D * Vin : Vin / (1 - D);
      f.clear();
      var small = f.w / f.h < 1.2;
      var cx0 = 18, cy0 = hero ? 30 : 16, cw = f.w - 36, ch = (hero ? 0.46 : small ? 0.42 : 0.5) * f.h;
      var X = function (u) { return cx0 + u * cw; }, Y = function (v) { return cy0 + v * ch; };
      var wire = f.a(c.ink, 0.6), top = 0.2, bot = 0.88;
      var iL = 0.55 + (on ? (frac / D - 0.5) : (0.5 - (frac - D) / (1 - D))) * 0.5; // normalised inductor current
      s.flow += (f.dt || 0) * (0.25 + iL * 0.5);
      var paths;
      if (topo === "buck") {
        f.line([[X(0.06), Y(top)], [X(0.16), Y(top)]], wire, 2); f.line([[X(0.28), Y(top)], [X(0.36), Y(top)]], wire, 2);
        f.line([[X(0.6), Y(top)], [X(0.88), Y(top)]], wire, 2); f.line([[X(0.06), Y(bot)], [X(0.88), Y(bot)]], wire, 2);
        S.battery(f, X(0.06), Y(top), Y(bot), c.ink);
        S.switchH(f, X(0.16), X(0.28), Y(top), on, wire);
        S.diode(f, X(0.36), Y(bot), X(0.36), Y(top), !on, wire);
        S.inductor(f, X(0.38), X(0.58), Y(top), c.c, true);
        f.seg(X(0.36), Y(top), X(0.38), Y(top), wire, 2); f.seg(X(0.58), Y(top), X(0.6), Y(top), wire, 2);
        S.cap(f, X(0.7), Y(top), Y(bot), wire, Vo / 40);
        S.res(f, X(0.88), Y(top), Y(bot), wire, true);
        paths = on ? [[X(0.06), Y(bot)], [X(0.06), Y(top)], [X(0.88), Y(top)], [X(0.88), Y(bot)], [X(0.06), Y(bot)]]
          : [[X(0.36), Y(bot)], [X(0.36), Y(top)], [X(0.88), Y(top)], [X(0.88), Y(bot)], [X(0.36), Y(bot)]];
        f.text("S", X(0.22), Y(top) - 18, { size: 11, weight: 700, align: "center" });
        f.text("D", X(0.36) + 14, Y(0.54), { size: 11, weight: 700 });
        f.text("L", X(0.48), Y(top) - 20, { size: 11, weight: 700, align: "center", color: c.c });
      } else {
        f.line([[X(0.06), Y(top)], [X(0.1), Y(top)]], wire, 2); f.line([[X(0.32), Y(top)], [X(0.46), Y(top)]], wire, 2);
        f.line([[X(0.62), Y(top)], [X(0.88), Y(top)]], wire, 2); f.line([[X(0.06), Y(bot)], [X(0.88), Y(bot)]], wire, 2);
        S.battery(f, X(0.06), Y(top), Y(bot), c.ink);
        S.inductor(f, X(0.1), X(0.32), Y(top), c.c, true);
        S.switchV(f, X(0.4), Y(top + 0.22), Y(bot - 0.22), on, wire);
        f.seg(X(0.4), Y(top), X(0.4), Y(top + 0.22), wire, 2); f.seg(X(0.4), Y(bot - 0.22), X(0.4), Y(bot), wire, 2);
        S.diode(f, X(0.46), Y(top), X(0.62), Y(top), !on, wire);
        S.cap(f, X(0.72), Y(top), Y(bot), wire, Math.min(1, Vo / 80));
        S.res(f, X(0.88), Y(top), Y(bot), wire, true);
        paths = on ? [[X(0.06), Y(bot)], [X(0.06), Y(top)], [X(0.4), Y(top)], [X(0.4), Y(bot)], [X(0.06), Y(bot)]]
          : [[X(0.06), Y(bot)], [X(0.06), Y(top)], [X(0.88), Y(top)], [X(0.88), Y(bot)], [X(0.06), Y(bot)]];
        f.text("L", X(0.21), Y(top) - 20, { size: 11, weight: 700, align: "center", color: c.c });
        f.text("S", X(0.4) + 14, Y(0.54), { size: 11, weight: 700 });
        f.text("D", X(0.54), Y(top) - 18, { size: 11, weight: 700, align: "center" });
      }
      flowDots(f, paths, s.flow, null, on ? c.a : c.c);
      f.text(Vin + " V", X(0.06) + 20, Y(0.54), { size: 11.5, mono: true });
      f.text("V_o = " + Vo.toFixed(1) + " V", X(0.8), Y(top) - 18, { size: 12.5, mono: true, align: "center", color: c.b, weight: 700 });
      f.text(on ? "switch ON: source charges L" : "switch OFF: L freewheels" + (topo === "boost" ? " into the load" : " through D"), X(0.5), Y(bot) + 18, { size: 11, align: "center", color: on ? c.a : c.c });
      // waveforms
      var wy = cy0 + ch + 34, wh = f.h - wy - 12, rows = 3, rh = (wh - 2 * 8) / rows;
      var span = 3, x0 = 18, w = f.w - 36;
      var labels = [["gate", c.a], ["i_L", c.c], ["v_o", c.b]];
      for (var r = 0; r < rows; r++) {
        var y0 = wy + r * (rh + 8);
        f.box(x0, y0, w, rh, 6, f.c.panel, null);
        f.text(labels[r][0], x0 + 8, y0 + 11, { size: 10.5, color: labels[r][1], weight: 700 });
        var pts = [];
        for (var k = 0; k <= 300; k++) {
          var tt = ph - span + span * k / 300, fr = ((tt % 1) + 1) % 1, val;
          if (r === 0) val = fr < D ? 0.85 : 0.1;
          else if (r === 1) val = 0.2 + (fr < D ? fr / D : 1 - (fr - D) / (1 - D)) * 0.6;
          else { var start = Math.min(1, Math.max(0, (tt + 30) / 30)); val = 0.5 + 0.12 * (fr < D ? (fr / D - 0.5) : (0.5 - (fr - D) / (1 - D))) * 0.5; }
          pts.push([x0 + w * k / 300, y0 + rh - val * rh]);
        }
        f.line(pts, labels[r][1], 2, { glow: 6 });
      }
      f.seg(x0 + w, wy, x0 + w, wy + wh, f.a(c.ink, 0.5), 1, { dash: [3, 3] });
      f.text("D = " + D.toFixed(2) + "   " + (topo === "buck" ? "V_o = D·V_in" : "V_o = V_in/(1−D)"), x0 + w - 8, wy - 12, { size: 11.5, mono: true, align: "right" });
    }
  });

  /* ============================================================= thyristor */
  FX.define("thyristor", {
    aspect: 2.0, aspectSmall: 0.95,
    controls: [{ key: "a", label: "Firing angle α", min: 0, max: 175, step: 1, value: 45, unit: "°" }],
    draw: function (f) {
      var c = f.c, ac = f.opts.variant === "ac", al = (f.v.a == null ? 45 : f.v.a) * PI / 180;
      if (f.mode === "hero") al = (60 + 50 * sin(f.t * 0.4)) * PI / 180;
      f.clear();
      var small = f.w / f.h < 1.3;
      var lx = small ? 0 : f.w * 0.26;
      var pl = f.plot(lx + 16, 16, f.w - lx - 32, f.h - (small ? 120 : 48), [0, 3 * TAU], [-1.25, 1.25], { nx: 12, ny: 4, xl: "ωt", yl: ac ? "load voltage" : "converter output voltage" });
      var vo = function (th) {
        if (ac) { var m = th % PI; return m >= al ? sin(th) : 0; }
        var tp = ((th - al) % PI + PI) % PI + al; return sin(tp);
      };
      f.curve(pl, sin, 0, 3 * TAU, 300, f.a(c.ink, 0.25), 1.2, { dash: [4, 4] });
      f.curve(pl, function (th) { return -sin(th); }, 0, 3 * TAU, 300, f.a(c.ink, 0.12), 1, { dash: [4, 4] });
      var prog = f.reduce ? 1 : ((f.t * 0.18) % 1.15);
      var end = Math.min(1, prog) * 3 * TAU;
      // fill area
      var x = f.ctx; x.save(); x.beginPath(); x.moveTo(pl.X(0), pl.Y(0));
      for (var k = 0; k <= 400; k++) { var th = end * k / 400; x.lineTo(pl.X(th), pl.Y(vo(th))); }
      x.lineTo(pl.X(end), pl.Y(0)); x.closePath(); x.fillStyle = f.a(c.a, 0.18); x.fill(); x.restore();
      f.curve(pl, vo, 0, end, Math.max(20, Math.round(400 * end / (3 * TAU))), c.a, 2.6, { glow: 10 });
      // gate pulses
      for (var n = 0; n < 6; n++) {
        var g = al + n * PI; if (g > 3 * TAU) break;
        f.seg(pl.X(g), pl.Y(-1.2), pl.X(g), pl.Y(-1.0), c.b, 3, { glow: 10 });
      }
      f.text("gate pulses", pl.X(al) + 6, pl.Y(-1.1), { size: 10, color: c.b });
      var avg, lab;
      if (ac) { avg = Math.sqrt(1 / 2 * (1 - al / PI + sin(2 * al) / (2 * PI))) / Math.SQRT1_2; lab = "V_rms = " + (avg * 100).toFixed(0) + " % of supply"; }
      else { avg = 2 / PI * cos(al); lab = "V_avg = (2V_m/π) cos α = " + avg.toFixed(2) + " V_m"; f.seg(pl.X(0), pl.Y(avg), pl.X(3 * TAU), pl.Y(avg), c.c, 1.6, { dash: [6, 4] }); }
      f.text(lab, pl.x0 + pl.w - 46, pl.y0 + 14, { size: 12, mono: true, align: "right", color: ac ? "#fff" : c.c });
      // left panel: thyristor symbol and load
      var px = small ? f.w * 0.5 : lx * 0.5, py = small ? f.h - 56 : f.h * 0.5;
      var gateOn = (prog * 3 * TAU % PI) - al;
      var firing = gateOn >= 0 && gateOn < 0.35;
      var sc = small ? 0.8 : 1;
      var ty = py - 30 * sc;
      f.line([[px - 16 * sc, ty - 10 * sc], [px + 16 * sc, ty - 10 * sc], [px, ty + 12 * sc]], firing ? c.b : c.ink, 2, { close: true, fill: f.a(firing ? c.b : c.ink, 0.25), glow: firing ? 14 : 0 });
      f.seg(px - 16 * sc, ty + 12 * sc, px + 16 * sc, ty + 12 * sc, c.ink, 2.4);
      f.seg(px, ty - 30 * sc, px, ty - 10 * sc, c.ink, 2); f.seg(px, ty + 12 * sc, px, ty + 34 * sc, c.ink, 2);
      f.seg(px + 6 * sc, ty + 6 * sc, px + 22 * sc, ty + 22 * sc, c.b, 1.8); f.text("G", px + 26 * sc, ty + 24 * sc, { size: 11, color: c.b, weight: 700 });
      if (ac) {
        var bright = avg * avg;
        f.circle(px, ty + 58 * sc, 14 * sc, f.a(c.b, 0.15 + 0.7 * bright), c.ink, 1.5, { glow: 30 * bright, glowColor: c.b });
        f.text("lamp", px, ty + 84 * sc, { size: 10.5, color: c.dim, align: "center" });
      } else if (!small) {
        f.text("thyristor bridge", px, ty + 52, { size: 11, color: c.dim, align: "center" });
        f.text("α = " + Math.round(al * 180 / PI) + "°", px, ty + 72, { size: 15, weight: 800, align: "center", color: c.b, mono: true });
        f.text(al > PI / 2 ? "inverting (regenerating)" : "rectifying", px, ty + 92, { size: 11, align: "center", color: al > PI / 2 ? c.d : c.a });
      }
    }
  });

  /* ================================================================== spwm */
  function tri(x) { var u = ((x % 1) + 1) % 1; return u < 0.5 ? 4 * u - 1 : 3 - 4 * u; }
  FX.define("spwm", {
    aspect: 1.8, aspectSmall: 0.8,
    controls: [
      { key: "ma", label: "Modulation index mₐ", min: 0.1, max: 1.3, step: 0.01, value: 0.8, fmt: function (v) { return v.toFixed(2); } },
      { key: "mf", label: "Carrier ratio m_f", type: "select", value: 15, options: [[9, "9"], [15, "15"], [21, "21"]] }
    ],
    draw: function (f) {
      var c = f.c, ma = f.v.ma == null ? 0.8 : f.v.ma, mf = f.v.mf || 15;
      if (f.mode === "hero") { ma = 0.8; mf = 15; }
      f.clear();
      var ph = f.reduce ? 0 : f.t * 0.12;
      var x0 = 16, w = f.w - 32, gap = 10, h1 = (f.h - 32 - 2 * gap) * 0.42, h2 = (f.h - 32 - 2 * gap) * 0.22, h3 = (f.h - 32 - 2 * gap) * 0.36;
      var y1 = 16, y2 = y1 + h1 + gap, y3 = y2 + h2 + gap;
      var p1 = f.plot(x0, y1, w, h1, [0, 1], [-1.4, 1.4], { nx: 8, ny: 4, yl: "reference & carrier" });
      var p2 = f.plot(x0, y2, w, h2, [0, 1], [-1.3, 1.3], { nx: 8, ny: 2, yl: "leg voltage" });
      var p3 = f.plot(x0, y3, w, h3, [0, 1], [-1.4, 1.4], { nx: 8, ny: 4, yl: "filtered output" });
      var ref = function (u) { return ma * sin(TAU * (u + ph)); };
      var car = function (u) { return tri((u + ph) * mf); };
      f.curve(p1, car, 0, 1, 600, f.a(c.ink, 0.45), 1.1);
      f.curve(p1, ref, 0, 1, 200, c.b, 2.4, { glow: 8 });
      var pts = [], N = 900, avgPts = [], win = Math.round(N / mf), buf = [];
      for (var k = 0; k <= N; k++) {
        var u = k / N, sw = ref(u) > car(u) ? 1 : -1;
        pts.push([p2.X(u), p2.Y(sw)]);
        buf.push(sw); if (buf.length > win) buf.shift();
        var m = buf.reduce(function (a, b) { return a + b; }, 0) / buf.length;
        avgPts.push([p3.X(u - 0.5 / mf), p3.Y(m)]);
      }
      f.line(pts, c.a, 1.6, { glow: 6 });
      f.curve(p3, function (u) { return Math.max(-1.27, Math.min(1.27, ref(u))); }, 0, 1, 200, f.a(c.b, 0.5), 1.4, { dash: [5, 4] });
      f.line(avgPts.slice(win), c.c, 2.4, { glow: 8 });
      f.text("mₐ = " + ma.toFixed(2) + (ma > 1 ? "  over-modulation" : "") + "   V₁ ∝ mₐ", x0 + w - 46, y1 + 12, { size: 11.5, mono: true, align: "right", color: ma > 1 ? c.d : c.ink });
    }
  });
})();
