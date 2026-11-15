/* course-fx: digital — full adder with propagating signals and a timing diagram (logic),
   traffic-light Moore machine (fsm), PLC ladder logic DOL starter (ladder). */
(function () {
  "use strict";
  var FX = window.CourseFX; if (!FX) return;
  var TAU = Math.PI * 2, sin = Math.sin, cos = Math.cos, PI = Math.PI;

  /* ---- gate symbols ---------------------------------------------------- */
  function gate(f, kind, x, y, w, h, on) {
    var c = f.c, col = on ? c.a : f.a(c.ink, 0.7), fill = f.a(on ? c.a : c.ink, on ? 0.16 : 0.06), ctx = f.ctx;
    ctx.save();
    if (on) f.glow(c.a, 12);
    ctx.beginPath();
    if (kind === "and") {
      ctx.moveTo(x, y); ctx.lineTo(x + w * 0.5, y); ctx.arc(x + w * 0.5, y + h / 2, h / 2, -PI / 2, PI / 2); ctx.lineTo(x, y + h); ctx.closePath();
    } else {
      ctx.moveTo(x, y); ctx.quadraticCurveTo(x + w * 0.6, y, x + w, y + h / 2); ctx.quadraticCurveTo(x + w * 0.6, y + h, x, y + h);
      ctx.quadraticCurveTo(x + w * 0.3, y + h / 2, x, y); ctx.closePath();
    }
    ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
    if (kind === "xor") { ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.quadraticCurveTo(x + w * 0.3 - 7, y + h / 2, x - 7, y + h); ctx.stroke(); }
    ctx.restore();
    f.text(kind.toUpperCase(), x + w * 0.42, y + h / 2, { size: 9.5, weight: 700, align: "center", color: on ? "#fff" : c.dim });
  }

  /* ================================================================= logic */
  var DELAY = 0.45;
  FX.define("logic", {
    aspect: 1.45, aspectSmall: 0.7,
    controls: [
      { key: "A", label: "A", type: "toggle", value: true },
      { key: "B", label: "B", type: "toggle", value: false },
      { key: "C", label: "C_in", type: "toggle", value: true }
    ],
    init: function (f) {
      var s = f.state;
      s.sig = {}; s.hist = []; s.clock = 0;
      ["A", "B", "C", "P", "G", "S", "T", "Co"].forEach(function (k) { s.sig[k] = { v: 0, at: -9, pend: null }; });
    },
    click: function (f, x, y) {
      var s = f.state;
      if (!s.inputs) return false;
      for (var k in s.inputs) { var p = s.inputs[k]; if (Math.hypot(x - p[0], y - p[1]) < 18) { f.v[k] = !f.v[k]; return true; } }
      return false;
    },
    draw: function (f) {
      var c = f.c, s = f.state, hero = f.mode === "hero", t = f.t;
      var inA, inB, inC;
      if (hero) { var n = Math.floor(t / 1.6) % 8; inA = n & 1; inB = (n >> 1) & 1; inC = (n >> 2) & 1; }
      else { inA = f.v.A ? 1 : 0; inB = f.v.B ? 1 : 0; inC = f.v.C ? 1 : 0; }
      var sig = s.sig;
      function set(k, v) { if (sig[k].v !== v) { sig[k].v = v; sig[k].at = t; } }
      set("A", inA); set("B", inB); set("C", inC);
      var gates = [["P", function () { return sig.A.v ^ sig.B.v; }], ["G", function () { return sig.A.v & sig.B.v; }],
        ["S", function () { return sig.P.v ^ sig.C.v; }], ["T", function () { return sig.P.v & sig.C.v; }], ["Co", function () { return sig.G.v | sig.T.v; }]];
      if (f.reduce && !f.playing) { for (var it = 0; it < 4; it++) gates.forEach(function (g) { set(g[0], g[1]()); }); }
      gates.forEach(function (g) {
        var want = g[1](), o = sig[g[0]];
        if (want !== o.v) { if (!o.pend || o.pend.v !== want) o.pend = { v: want, at: t + DELAY }; }
        else o.pend = null;
        if (o.pend && t >= o.pend.at) { set(g[0], o.pend.v); o.pend = null; }
      });
      s.clock += f.dt || 0;
      if (s.clock > 0.05) { s.clock = 0; s.hist.push([sig.A.v, sig.B.v, sig.C.v, sig.S.v, sig.Co.v]); if (s.hist.length > 240) s.hist.shift(); }
      f.clear();
      var small = f.w / f.h < 1.1;
      var top = 14, H = (hero ? 0.62 : small ? 0.5 : 0.58) * f.h, L = 14, W = f.w - 28;
      var X = function (u) { return L + u * W; }, Y = function (v) { return top + v * H; };
      var gw = Math.min(70, W * 0.12), gh = Math.min(46, H * 0.2);
      var G = {
        P: [X(0.3), Y(0.16)], G: [X(0.3), Y(0.62)], S: [X(0.56), Y(0.08)], T: [X(0.56), Y(0.44)], Co: [X(0.78), Y(0.53)]
      };
      var inp = { A: [X(0.03), Y(0.2)], B: [X(0.03), Y(0.38)], C: [X(0.03), Y(0.8)] };
      s.inputs = hero ? null : inp;
      var outs = { S: [X(0.97), Y(0.08) + gh / 2], Co: [X(0.97), Y(0.53) + gh / 2] };
      function inPin(g, k) { return [G[g][0] - 2, G[g][1] + gh * (k ? 0.75 : 0.25)]; }
      function outPin(g) { return [G[g][0] + gw, G[g][1] + gh / 2]; }
      function wire(src, from, to, midFrac) {
        var mx = from[0] + (to[0] - from[0]) * (midFrac || 0.5);
        var pts = [from, [mx, from[1]], [mx, to[1]], to];
        var sg = sig[src], age = (t - sg.at) / DELAY, on = sg.v;
        f.line(pts, f.a(on ? c.b : c.ink, on ? 0.35 : 0.25), 2);
        if (age >= 0 && age < 1 && !f.reduce) {
          // the change travels along the wire
          var p = FX.along(pts, age * 0.999); var part = [from];
          var Ltot = 0, segs = []; for (var i = 1; i < pts.length; i++) { segs.push(Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); Ltot += segs[i - 1]; }
          var d = age * Ltot, k = 0; while (k < segs.length && d > segs[k]) { part.push(pts[k + 1]); d -= segs[k]; k++; }
          part.push([p[0], p[1]]);
          f.line(part, on ? c.b : f.a(c.ink, 0.6), 2.6, { glow: on ? 10 : 0 });
          f.circle(p[0], p[1], 4, "#fff", null, 0, { glow: 14, glowColor: on ? c.b : c.c });
        } else if (on) f.line(pts, c.b, 2.4, { glow: 8 });
      }
      wire("A", inp.A, inPin("P", 0), 0.6); wire("B", inp.B, inPin("P", 1), 0.4);
      wire("A", inp.A, inPin("G", 0), 0.5); wire("B", inp.B, inPin("G", 1), 0.3);
      wire("P", outPin("P"), inPin("S", 0)); wire("C", inp.C, inPin("S", 1), 0.85);
      wire("P", outPin("P"), inPin("T", 0), 0.3); wire("C", inp.C, inPin("T", 1), 0.75);
      wire("G", outPin("G"), inPin("Co", 1)); wire("T", outPin("T"), inPin("Co", 0));
      wire("S", outPin("S"), outs.S); wire("Co", outPin("Co"), outs.Co);
      [["P", "xor"], ["G", "and"], ["S", "xor"], ["T", "and"], ["Co", "or"]].forEach(function (g) { gate(f, g[1], G[g[0]][0], G[g[0]][1], gw, gh, sig[g[0]].v); });
      Object.keys(inp).forEach(function (k) {
        var p = inp[k], on = sig[k].v;
        f.circle(p[0], p[1], 13, on ? c.b : "rgba(0,0,0,.4)", on ? "#fff" : f.a(c.ink, 0.6), 1.6, { glow: on ? 14 : 0, glowColor: c.b });
        f.text(String(on), p[0], p[1] + 0.5, { size: 12, weight: 800, align: "center", color: on ? "#1a1300" : c.ink, mono: true });
        f.text(k === "C" ? "C_in" : k, p[0] + 18, p[1] - 14, { size: 11, weight: 700, color: c.ink });
        if (!hero) f.hit({ x: p[0], y: p[1], r: 16 }, "Input " + (k === "C" ? "C_in" : k), "Click to flip it (or use the buttons below).");
      });
      Object.keys(outs).forEach(function (k) {
        var p = outs[k], on = sig[k].v;
        f.box(p[0] - 30, p[1] - 12, 30, 24, 7, on ? c.a : "rgba(0,0,0,.4)", on ? "#fff" : f.a(c.ink, 0.5), 1.4, { glow: on ? 14 : 0, glowColor: c.a });
        f.text(String(on), p[0] - 15, p[1] + 0.5, { size: 12, weight: 800, align: "center", color: on ? "#03140c" : c.ink, mono: true });
        f.text(k === "S" ? "Sum" : "C_out", p[0] - 15, p[1] - 22, { size: 10.5, align: "center", color: c.dim, weight: 700 });
      });
      ["P", "G", "S", "T", "Co"].forEach(function (k) { f.hit({ x: G[k][0], y: G[k][1], w: gw, h: gh }, { P: "XOR (A ⊕ B)", G: "AND (A·B): generate", S: "XOR: sum = A ⊕ B ⊕ C_in", T: "AND: propagate carry", Co: "OR: carry out" }[k], "Output changes " + DELAY * 1000 / 1000 + " s (slow-motion propagation delay) after its inputs."); });
      // timing diagram
      var ty = top + H + 18, th = f.h - ty - 10;
      if (th < 60) return;
      var rows = [["A", c.b], ["B", c.b], ["C_in", c.b], ["Sum", c.a], ["C_out", c.a]], rh = th / rows.length;
      f.box(L, ty - 6, W, th + 6, 8, c.panel, null);
      var lw = 46, hx0 = L + lw, hw = W - lw - 8, Hh = s.hist, n0 = 240 - Hh.length;
      rows.forEach(function (r, i) {
        var y0 = ty + i * rh, y1 = y0 + rh * 0.2, y2 = y0 + rh * 0.8;
        f.text(r[0], L + 8, (y1 + y2) / 2, { size: 10.5, mono: true, color: r[1], weight: 700 });
        f.seg(hx0, y2, hx0 + hw, y2, f.a(c.ink, 0.08), 1);
        if (Hh.length < 2) return;
        var pts = [];
        for (var j = 0; j < Hh.length; j++) {
          var x = hx0 + (n0 + j) / 240 * hw, yy = Hh[j][i] ? y1 : y2;
          if (j && Hh[j - 1][i] !== Hh[j][i]) pts.push([x, Hh[j - 1][i] ? y1 : y2]);
          pts.push([x, yy]);
        }
        f.line(pts, r[1], 1.8, { glow: 6 });
      });
      f.text(inA + " + " + inB + " + " + inC + " = " + (inA + inB + inC) + "  →  C_out S = " + ((inA + inB + inC) >> 1) + "" + ((inA + inB + inC) & 1), L + W - 46, top + 6, { size: 11.5, mono: true, align: "right", color: c.ink });
    }
  });

  /* =================================================================== fsm */
  var STATES = [
    { k: "NS_G", lab: "NS green", ns: "g", ew: "r", dur: 4.0 },
    { k: "NS_Y", lab: "NS amber", ns: "y", ew: "r", dur: 1.4 },
    { k: "EW_G", lab: "EW green", ns: "r", ew: "g", dur: 4.0 },
    { k: "EW_Y", lab: "EW amber", ns: "r", ew: "y", dur: 1.4 }
  ];
  var LC = { r: "#ff4d4d", y: "#ffc83d", g: "#3ddc84" };
  function lights(f, x, y, state, sc, vertical) {
    f.box(x - 9 * sc, y - 26 * sc, 18 * sc, 52 * sc, 5 * sc, "#0b0f0e", f.a(f.c.ink, 0.4), 1);
    ["r", "y", "g"].forEach(function (k, i) {
      var on = state === k;
      f.circle(x, y - 16 * sc + i * 16 * sc, 6 * sc, on ? LC[k] : f.a(LC[k], 0.15), null, 0, { glow: on ? 16 : 0, glowColor: LC[k] });
    });
  }
  FX.define("fsm", {
    aspect: 1.9, aspectSmall: 0.8,
    controls: [{ key: "ped", label: "Pedestrian request", type: "button" }],
    init: function (f) { var s = f.state; s.i = 0; s.tin = 0; s.req = false; s.cars = [0.1, 0.45, 0.8].map(function (p, i) { return { p: p, dir: i % 2 }; }); },
    onChange: function (f, key) { if (key === "ped") f.state.req = true; },
    draw: function (f) {
      var c = f.c, s = f.state, hero = f.mode === "hero", dt = f.dt || 0;
      s.tin += dt;
      var st = STATES[s.i], dur = st.dur;
      if (st.k === "NS_G" && s.req) dur = Math.min(dur, 1.6);
      if (s.tin >= dur) { s.tin = 0; s.i = (s.i + 1) % 4; if (STATES[s.i].k === "NS_Y") s.req = false; st = STATES[s.i]; }
      if (f.reduce && !f.playing) { s.i = 0; s.tin = 1.5; st = STATES[0]; }
      f.clear();
      var small = f.w / f.h < 1.25;
      // state diagram
      var cx = small ? f.w * 0.5 : f.w * 0.3, cy = small ? f.h * 0.27 : f.h * 0.5, R = Math.min(small ? f.w * 0.3 : f.w * 0.19, (small ? f.h * 0.21 : f.h * 0.33));
      var pos = STATES.map(function (_, i) { var a = -PI / 2 + i * PI / 2; return [cx + cos(a) * R, cy + sin(a) * R]; });
      var r = Math.max(22, R * 0.36);
      STATES.forEach(function (S, i) {
        var a = pos[i], b = pos[(i + 1) % 4], ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        var x1 = a[0] + cos(ang) * r, y1 = a[1] + sin(ang) * r, x2 = b[0] - cos(ang) * r, y2 = b[1] - sin(ang) * r;
        var mx = (x1 + x2) / 2 + cos(ang - PI / 2) * R * 0.18, my = (y1 + y2) / 2 + sin(ang - PI / 2) * R * 0.18;
        var active = i === s.i;
        f.ctx.save(); f.ctx.strokeStyle = active ? c.a : f.a(c.ink, 0.4); f.ctx.lineWidth = active ? 2.4 : 1.4;
        f.ctx.beginPath(); f.ctx.moveTo(x1, y1); f.ctx.quadraticCurveTo(mx, my, x2, y2); f.ctx.stroke(); f.ctx.restore();
        var ha = Math.atan2(y2 - my, x2 - mx);
        f.arrow(x2 - cos(ha) * 8, y2 - sin(ha) * 8, x2, y2, active ? c.a : f.a(c.ink, 0.5), 2, { head: 8 });
        var lab = S.k.indexOf("_G") > 0 ? (S.k === "NS_G" ? "T ≥ 4 s or ped" : "T ≥ 4 s") : "T ≥ 1.4 s";
        f.text(lab, mx + cos(ang - PI / 2) * 12, my + sin(ang - PI / 2) * 12, { size: 9.5, color: active ? c.a : c.dim, align: "center", mono: true });
      });
      STATES.forEach(function (S, i) {
        var p = pos[i], on = i === s.i;
        f.circle(p[0], p[1], r, on ? f.a(c.a, 0.22) : "rgba(0,0,0,.35)", on ? c.a : f.a(c.ink, 0.5), on ? 2.4 : 1.4, { glow: on ? 18 : 0, glowColor: c.a });
        f.text(S.lab, p[0], p[1] - 6, { size: 10.5, weight: 700, align: "center" });
        f.text("NS " + S.ns.toUpperCase() + " · EW " + S.ew.toUpperCase(), p[0], p[1] + 9, { size: 9, mono: true, align: "center", color: c.dim });
        if (on) { // timer ring
          f.ctx.save(); f.ctx.strokeStyle = c.b; f.ctx.lineWidth = 3; f.ctx.beginPath(); f.ctx.arc(p[0], p[1], r + 5, -PI / 2, -PI / 2 + TAU * Math.min(1, s.tin / dur)); f.ctx.stroke(); f.ctx.restore();
        }
        f.hit({ x: p[0], y: p[1], r: r }, "State: " + S.lab, "Moore machine: the outputs (the lights) depend only on the state.");
      });
      // junction
      var jx = small ? f.w * 0.5 : f.w * 0.75, jy = small ? f.h * 0.74 : f.h * 0.5, js = Math.min(small ? f.w * 0.42 : f.w * 0.2, small ? f.h * 0.22 : f.h * 0.42);
      var road = f.a(c.ink, 0.1), rw = js * 0.34;
      f.box(jx - js, jy - rw / 2, js * 2, rw, 2, road, null); f.box(jx - rw / 2, jy - js, rw, js * 2, 2, road, null);
      f.seg(jx - js, jy, jx - rw / 2, jy, f.a(c.ink, 0.3), 1, { dash: [6, 6] }); f.seg(jx + rw / 2, jy, jx + js, jy, f.a(c.ink, 0.3), 1, { dash: [6, 6] });
      f.seg(jx, jy - js, jx, jy - rw / 2, f.a(c.ink, 0.3), 1, { dash: [6, 6] }); f.seg(jx, jy + rw / 2, jx, jy + js, f.a(c.ink, 0.3), 1, { dash: [6, 6] });
      var sc = Math.max(0.6, js / 120);
      lights(f, jx - rw / 2 - 16 * sc, jy - rw / 2 - 30 * sc, st.ns, sc);
      lights(f, jx + rw / 2 + 16 * sc, jy + rw / 2 + 30 * sc, st.ew, sc);
      f.text("N–S", jx + rw / 2 + 6, jy - js + 10, { size: 10, color: c.dim }); f.text("E–W", jx - js + 4, jy - rw / 2 - 8, { size: 10, color: c.dim });
      // cars
      s.cars.forEach(function (car) {
        var go = car.dir === 0 ? st.ns === "g" : st.ew === "g";
        var stopLine = 0.5 - rw / (4 * js) - 0.06;
        if (go || car.p > stopLine + 0.02 || car.p < stopLine - 0.12) car.p += dt * 0.14;
        if (car.p > 1.05) car.p = -0.05;
        var x, y, w, h;
        if (car.dir === 0) { x = jx - rw / 4; y = jy - js + car.p * 2 * js; w = rw * 0.3; h = rw * 0.5; }
        else { x = jx - js + car.p * 2 * js; y = jy + rw / 4; w = rw * 0.5; h = rw * 0.3; }
        f.box(x - w / 2, y - h / 2, w, h, 3, car.dir ? c.c : c.b, null, 0, { glow: 6 });
      });
      if (s.req) f.text("pedestrian waiting", jx, jy + js + (small ? -4 : 14), { size: 10.5, color: c.b, align: "center", weight: 700 });
    }
  });

  /* ================================================================ ladder */
  FX.define("ladder", {
    aspect: 1.7, aspectSmall: 0.85,
    controls: [
      { key: "start", label: "Start (hold)", type: "button", hold: true },
      { key: "stop", label: "Stop (hold)", type: "button", hold: true },
      { key: "ol", label: "Overload trip", type: "toggle", value: false }
    ],
    init: function (f) { f.state.M = false; f.state.ang = 0; f.state.flow = 0; },
    draw: function (f) {
      var c = f.c, s = f.state, hero = f.mode === "hero";
      var start = !!f.v.start, stop = !!f.v.stop, ol = !!f.v.ol;
      if (hero) { var tt = f.t % 9; start = tt > 1 && tt < 1.6; stop = tt > 6.5 && tt < 7.1; ol = false; }
      // scan: rung 1
      var seal = (start || s.M) && !stop && !ol;
      s.M = seal;
      s.flow += (f.dt || 0) * 0.6;
      s.ang += (f.dt || 0) * (s.M ? 9 : 0);
      f.clear();
      var small = f.w / f.h < 1.2;
      var L = 30, Rr = f.w - (small ? 30 : f.w * 0.3), top = 34, gap = small ? (f.h - 70) / 3.4 : (f.h - 60) / 3.3;
      var on = c.a, off = f.a(c.ink, 0.45);
      f.seg(L, top - 16, L, top + gap * 2.6, c.b, 3, { glow: 8 });
      f.seg(Rr, top - 16, Rr, top + gap * 2.6, f.a(c.ink, 0.6), 3);
      f.text("L1 (24 V DC)", L - 4, top - 24, { size: 10, color: c.b });
      f.text("0 V", Rr, top - 24, { size: 10, color: c.dim, align: "center" });
      var Wd = Rr - L;
      function contact(x, y, nc, closed, lab, sub) {
        var w = Math.min(34, Wd * 0.07);
        f.seg(x - w / 2, y - 14, x - w / 2, y + 14, closed ? on : off, 2.6, { glow: closed ? 8 : 0 });
        f.seg(x + w / 2, y - 14, x + w / 2, y + 14, closed ? on : off, 2.6, { glow: closed ? 8 : 0 });
        if (nc) f.seg(x - w / 2 - 4, y + 14, x + w / 2 + 4, y - 14, closed ? on : off, 2);
        f.text(lab, x, y - 26, { size: 10.5, weight: 700, align: "center", color: c.ink });
        if (sub) f.text(sub, x, y + 26, { size: 9.5, align: "center", color: c.dim, mono: true });
        return w;
      }
      function coil(x, y, energised, lab) {
        f.ctx.save(); f.ctx.strokeStyle = energised ? on : off; f.ctx.lineWidth = 2.6; if (energised) f.glow(on, 12);
        f.ctx.beginPath(); f.ctx.arc(x - 8, y, 14, PI * 0.65, PI * 1.35); f.ctx.stroke(); f.ctx.beginPath(); f.ctx.arc(x + 8, y, 14, -PI * 0.35, PI * 0.35); f.ctx.stroke(); f.ctx.restore();
        f.text(lab, x, y - 26, { size: 10.5, weight: 700, align: "center" });
      }
      function wire(pts, live) { f.line(pts, live ? on : off, live ? 2.4 : 1.6, { glow: live ? 8 : 0 }); if (live) FX.flowDots(f, pts, s.flow, null, "#fff", 1.8); }
      // rung 1
      var y1 = top + 10, xs = [L + Wd * 0.16, L + Wd * 0.42, L + Wd * 0.6, L + Wd * 0.88];
      var p1 = start, p2 = s.M;
      var afterOr = (p1 || p2), afterStop = afterOr && !stop, afterOl = afterStop && !ol;
      wire([[L, y1], [xs[0] - 17, y1]], true);
      wire([[L + Wd * 0.06, y1], [L + Wd * 0.06, y1 + gap * 0.62], [xs[0] - 17, y1 + gap * 0.62]], true);
      contact(xs[0], y1, false, start, "Start", "I0.0");
      contact(xs[0], y1 + gap * 0.62, false, s.M, "Motor", "Q0.0");
      wire([[xs[0] + 17, y1], [xs[1] - 17, y1]], afterOr);
      wire([[xs[0] + 17, y1 + gap * 0.62], [L + Wd * 0.28, y1 + gap * 0.62], [L + Wd * 0.28, y1]], p2);
      contact(xs[1], y1, true, !stop, "Stop", "I0.1");
      wire([[xs[1] + 17, y1], [xs[2] - 17, y1]], afterStop);
      contact(xs[2], y1, true, !ol, "Overload", "I0.2");
      wire([[xs[2] + 17, y1], [xs[3] - 22, y1]], afterOl);
      coil(xs[3], y1, s.M, "Motor Q0.0");
      wire([[xs[3] + 22, y1], [Rr, y1]], false);
      // rung 2 and 3: lamps
      var y2 = y1 + gap * 1.45, y3 = y1 + gap * 2.25;
      wire([[L, y2], [xs[0] - 17, y2]], true); contact(xs[0], y2, false, s.M, "Motor", "Q0.0");
      wire([[xs[0] + 17, y2], [xs[3] - 22, y2]], s.M); coil(xs[3], y2, s.M, "Run lamp Q0.1");
      wire([[L, y3], [xs[0] - 17, y3]], true); contact(xs[0], y3, true, !s.M, "Motor", "Q0.0");
      wire([[xs[0] + 17, y3], [xs[3] - 22, y3]], !s.M); coil(xs[3], y3, !s.M, "Stopped lamp Q0.2");
      [y2, y3].forEach(function (yy) { f.seg(xs[3] + 22, yy, Rr, yy, off, 1.6); });
      f.hit({ x: xs[0] - 20, y: y1 + gap * 0.62 - 18, w: 40, h: 36 }, "Seal-in contact", "A contact of the motor's own output: once the motor starts it keeps the rung alive after Start is released.");
      f.hit({ x: xs[1] - 20, y: y1 - 18, w: 40, h: 36 }, "Stop (normally closed)", "Wired NC so that a broken wire also stops the motor — fail-safe.");
      // the motor
      if (!small) {
        var mx = Rr + (f.w - Rr) / 2, my = top + gap * 1.1, mr = Math.min((f.w - Rr) * 0.3, gap * 0.8);
        f.circle(mx, my, mr, f.a(s.M ? c.a : c.ink, 0.1), s.M ? c.a : off, 2, { glow: s.M ? 14 : 0 });
        for (var k = 0; k < 3; k++) { var a = s.ang + k * TAU / 3; f.seg(mx, my, mx + cos(a) * mr * 0.8, my + sin(a) * mr * 0.8, s.M ? c.a : off, 3); }
        f.text("M", mx, my + mr + 16, { size: 12, weight: 800, align: "center" });
        f.text(s.M ? "RUNNING" : ol ? "TRIPPED" : "STOPPED", mx, my + mr + 34, { size: 11, weight: 800, align: "center", color: s.M ? c.a : ol ? c.d : c.dim });
      }
    }
  });
})();
