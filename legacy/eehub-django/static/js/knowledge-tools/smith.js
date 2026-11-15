/* EE Hub — Smith chart (Round 7, R7E, course tool for EEEN 522 and transmission-line courses).
   settings: {z0: 50, rl: 100, xl: 50, len: 0.125}  len in wavelengths (0 … 0.5) toward the generator. */
(function () {
  "use strict";
  var KT = window.KT, el = KT.el, F = KT.fmt, C = KT.C, Cx = KT.Cx;
  function solve(z0, zl, len) {
    var g = Cx.div(Cx.sub(zl, new C(z0, 0)), Cx.add(zl, new C(z0, 0))), m = Cx.abs(g);
    var bl = 2 * Math.PI * len, t = Math.tan(bl);
    var zin = Math.abs(Math.cos(bl)) < 1e-12 ? Cx.div(new C(z0 * z0, 0), zl) : Cx.mul(new C(z0, 0), Cx.div(Cx.add(zl, new C(0, z0 * t)), Cx.add(new C(z0, 0), Cx.mul(new C(0, t), zl))));
    var gin = Cx.mul(g, Cx.polar(1, -2 * bl));
    var th = Cx.arg(g), dmax = ((th / (4 * Math.PI)) % 0.5 + 0.5) % 0.5, dmin = (dmax + 0.25) % 0.5;
    return { g: g, m: m, swr: m < 1 ? (1 + m) / (1 - m) : Infinity, rl: m > 0 ? -20 * Math.log10(m) : Infinity, zin: zin, gin: gin, yin: Cx.div(new C(1, 0), zin), dmax: dmax, dmin: dmin };
  }
  KT.smith = { solve: solve };
  function build(mount, S) {
    var v = { z0: S.z0 || 50, rl: S.rl != null ? S.rl : 100, xl: S.xl != null ? S.xl : 50, len: S.len != null ? S.len : 0.125 };
    var wrap = el("div", "kt-calc"), top = el("div", "kt-calc__top"), ctl = el("div", "kt-controls"), res = el("div", "kt-results");
    top.appendChild(ctl); top.appendChild(res); wrap.appendChild(top);
    function upd() { draw(); }
    ctl.appendChild(KT.ui.range({ label: "Line impedance Z₀", unit: "Ω", min: 10, max: 600, value: v.z0, step: 1 }, function (x) { v.z0 = x; upd(); }));
    ctl.appendChild(KT.ui.range({ label: "Load resistance R_L", unit: "Ω", min: 0, max: 1000, value: v.rl, step: 1 }, function (x) { v.rl = x; upd(); }));
    ctl.appendChild(KT.ui.range({ label: "Load reactance X_L", unit: "Ω", min: -1000, max: 1000, value: v.xl, step: 1 }, function (x) { v.xl = x; upd(); }));
    ctl.appendChild(KT.ui.range({ label: "Distance toward the generator", unit: "λ", min: 0, max: 0.5, value: v.len, step: 0.005 }, function (x) { v.len = x; upd(); }));
    var dl = el("dl", "kt-readouts"); res.appendChild(dl);
    var cell = el("div", "kt-plots"); wrap.appendChild(cell);
    var plot = new KT.Plot(cell, { title: "Smith chart (normalised to Z₀)", square: true, maxh: 520, aria: "Smith chart showing the load, the VSWR circle and the input impedance" });
    mount.appendChild(wrap);
    function card(k, x, big) { var c = el("div", "kt-readout" + (big ? " kt-readout--big" : "")); c.appendChild(el("dt", null, k)); c.appendChild(el("dd", null, x)); dl.appendChild(c); }
    function draw() {
      var zl = new C(v.rl, v.xl), r = solve(v.z0, zl, v.len), zn = Cx.div(zl, new C(v.z0, 0)), zin = r.zin;
      dl.innerHTML = "";
      card("Γ at the load", F.sig(r.m, 4) + " ∠ " + F.sig(Cx.arg(r.g) * 180 / Math.PI, 4) + "°", true);
      card("VSWR s = (1+|Γ|)/(1−|Γ|)", F.sig(r.swr, 4));
      card("Return loss", isFinite(r.rl) ? F.sig(r.rl, 4) + " dB" : "∞ (matched)");
      card("z_L = Z_L / Z₀", F.complex(zn, "rect", "", 4));
      card("Z_in at " + F.sig(v.len, 3) + "λ", F.complex(zin, "rect", "Ω", 4));
      card("Y_in", F.complex(r.yin, "rect", "S", 4));
      card("First V_max / V_min from the load", F.sig(r.dmax, 3) + "λ / " + F.sig(r.dmin, 3) + "λ");
      plot.set({ type: "custom", draw: function (x, w, h, c) {
        var R = Math.min(w, h) / 2 - 18, cx = w / 2, cy = h / 2;
        var P = function (g) { return [cx + g.re * R, cy - g.im * R]; };
        x.fillStyle = c.bg; x.beginPath(); x.arc(cx, cy, R, 0, 2 * Math.PI); x.fill();
        x.save(); x.beginPath(); x.arc(cx, cy, R, 0, 2 * Math.PI); x.clip();
        x.strokeStyle = c.grid; x.lineWidth = 1.2;
        [0.2, 0.5, 1, 2, 5].forEach(function (rr) { x.beginPath(); x.arc(cx + rr / (1 + rr) * R, cy, R / (1 + rr), 0, 2 * Math.PI); x.stroke(); });
        [0.2, 0.5, 1, 2, 5].forEach(function (xx) { [1, -1].forEach(function (sg) { x.beginPath(); x.arc(cx + R, cy - sg * R / xx, R / xx, 0, 2 * Math.PI); x.stroke(); }); });
        x.restore();
        x.strokeStyle = c.axis; x.lineWidth = 1.5; x.beginPath(); x.arc(cx, cy, R, 0, 2 * Math.PI); x.stroke();
        x.beginPath(); x.moveTo(cx - R, cy); x.lineTo(cx + R, cy); x.stroke();
        x.fillStyle = c.dim; x.font = "600 10px " + c.font; x.textAlign = "center"; x.textBaseline = "top";
        [0, 0.2, 0.5, 1, 2, 5].forEach(function (rr) { x.fillText(String(rr), cx + (rr - 1) / (rr + 1) * R, cy + 3); });
        [0.5, 1, 2].forEach(function (xx) { var g = Cx.div(new C(-1 + xx * xx, 2 * xx), new C(1 + xx * xx, 0)); var p = P(g); x.fillText("+j" + xx, p[0] + (g.re > 0 ? 10 : -10), p[1] - 14); var p2 = P(new C(g.re, -g.im)); x.fillText("−j" + xx, p2[0] + (g.re > 0 ? 10 : -10), p2[1] + 4); });
        // VSWR circle
        x.strokeStyle = c.ser[2]; x.setLineDash([5, 4]); x.beginPath(); x.arc(cx, cy, Math.min(1, r.m) * R, 0, 2 * Math.PI); x.stroke(); x.setLineDash([]);
        // rotation arc toward generator (clockwise)
        x.strokeStyle = c.ser[1]; x.lineWidth = 3; x.beginPath();
        var a0 = Cx.arg(r.g); x.arc(cx, cy, Math.min(1, r.m) * R, -a0, -a0 + 4 * Math.PI * v.len, false); x.stroke();
        var pl = P(r.g), pi = P(r.gin);
        [[pl, c.ser[0], "z_L"], [pi, c.ser[3], "z_in"]].forEach(function (q) { x.fillStyle = q[1]; x.beginPath(); x.arc(q[0][0], q[0][1], 6, 0, 2 * Math.PI); x.fill(); x.fillStyle = c.ink; x.font = "700 12px " + c.font; x.textAlign = "left"; x.textBaseline = "bottom"; x.fillText(q[2], q[0][0] + 8, q[0][1] - 4); });
        var yp = P(Cx.mul(r.gin, new C(-1, 0))); x.strokeStyle = c.ser[4]; x.lineWidth = 2; x.beginPath(); x.arc(yp[0], yp[1], 5, 0, 2 * Math.PI); x.stroke();
        x.fillStyle = c.ink; x.fillText("y_in", yp[0] + 8, yp[1] - 4);
        plot.readout.textContent = "Orange arc: moving " + F.sig(v.len, 3) + "λ toward the generator (clockwise, 0.5λ = one full turn). Dashed circle: constant VSWR.";
      } });
    }
    draw();
  }
  KT.define("smith", build);
})();
