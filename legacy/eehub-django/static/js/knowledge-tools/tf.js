/* EE Hub — Bode and step-response plotter (Round 7, R7E, shared tool K8).

   settings:
     inputs/defs   as in calc (sliders for K, ζ, ωn, Kp, …)
     num, den      expressions giving coefficient arrays (highest power first), e.g. "[wn^2]", "[1, 2*z*wn, wn^2]"
     plants        [{label, num, den}] — preset plants (a segmented choice); overrides num/den
     editable      true → text boxes for the numerator/denominator coefficients
     pid           {kp:"Kp", ki:"Ki", kd:"Kd"} — PID controller C(s) = (Kd s² + Kp s + Ki)/s in the loop
     ctrl          {num, den} — any other controller (lead/lag) as coefficient-array expressions
     loop          "open" | "closed" | "choose"  (unity feedback; default open)
     show          ["step", "bode", "pz", "routh", "margins"]
     tmax          expression for the step plot length (s); auto from the poles when omitted
     outputs       extra calc-style readouts (can use the step/margin results: tr, tp, ts, Mp, yss, pm, gm, wgc, wpc)
*/
(function () {
  "use strict";
  var KT = window.KT, E = KT.expr, el = KT.el, F = KT.fmt, TF = KT.tf, C = KT.C, Cx = KT.Cx;

  function coeffs(v) { return (Array.isArray(v) ? v : [v]).map(function (x) { return +E.num(x); }); }
  function parseList(s, sc) {
    s = String(s || "").trim();
    if (!s) return [];
    if (s[0] !== "[") s = "[" + s + "]";
    return coeffs(E.run(s, sc));
  }
  function polyStr(c, v) {
    v = v || "s";
    var n = c.length - 1, parts = [];
    c.forEach(function (a, i) {
      var p = n - i;
      if (Math.abs(a) < 1e-12) return;
      var mag = F.sig(Math.abs(a), 4), term = (Math.abs(Math.abs(a) - 1) < 1e-12 && p > 0) ? "" : mag;
      term += p > 1 ? v + toSup(p) : p === 1 ? v : "";
      parts.push((a < 0 ? "− " : (parts.length ? "+ " : "")) + term);
    });
    return parts.join(" ") || "0";
  }
  function toSup(n) { return String(n).split("").map(function (d) { return "⁰¹²³⁴⁵⁶⁷⁸⁹"[+d]; }).join(""); }
  function rootStr(z) { return KT.isC(z) ? F.complex(z, "rect", "", 4) : F.sig(z, 4); }

  function build(mount, S) {
    var vals = {}, ctlEls = {}, show = S.show || ["step", "bode", "pz"];
    var wrap = el("div", "kt-calc kt-tf");
    var top = el("div", "kt-calc__top"), ctl = el("div", "kt-controls"), res = el("div", "kt-results");
    top.appendChild(ctl); top.appendChild(res); wrap.appendChild(top);
    var plantIdx = 0, loop = S.loop === "closed" ? 1 : 0;
    var pending = false;
    function changed() { if (pending) return; pending = true; requestAnimationFrame(function () { pending = false; update(); }); }
    if (S.plants && S.plants.length) {
      ctl.appendChild(KT.ui.select({ id: "_plant", label: "Plant G(s)", options: S.plants.map(function (p, i) { return [i, p.label]; }), value: 0 }, function (v) { plantIdx = +v; changed(); }));
    }
    if (S.loop === "choose") ctl.appendChild(KT.ui.select({ id: "_loop", label: "Response shown", options: [[0, "Open loop G(s)"], [1, "Closed loop (unity feedback)"]], value: 0 }, function (v) { loop = +v; changed(); }));
    var numBox = null, denBox = null;
    if (S.editable) {
      numBox = KT.ui.text({ label: "Numerator coefficients (highest power of s first)", value: S.num_text || "1", placeholder: "e.g. 10" }, changed);
      denBox = KT.ui.text({ label: "Denominator coefficients", value: S.den_text || "1, 3, 2", placeholder: "e.g. 1, 6, 11, 6" }, changed);
      ctl.appendChild(numBox); ctl.appendChild(denBox);
    }
    KT.buildInputs(ctl, S.inputs || [], vals, ctlEls, changed);

    var eq = el("p", "kt-out"); eq.setAttribute("aria-live", "polite");
    var badges = el("div", "kt-badges");
    var list = el("dl", "kt-readouts");
    var err = el("p", "kt-error"); err.hidden = true;
    res.appendChild(eq); res.appendChild(badges); res.appendChild(list); res.appendChild(err);
    var plotsBox = el("div", "kt-plots kt-plots--multi");
    wrap.appendChild(plotsBox);
    function cell() { var c = el("div", "kt-plotcell"); plotsBox.appendChild(c); return c; }
    var pStep = show.indexOf("step") >= 0 ? new KT.Plot(cell(), { title: "Step response", aria: "Step response against time" }) : null;
    var pMag = show.indexOf("bode") >= 0 ? new KT.Plot(cell(), { title: "Bode magnitude", aria: "Bode magnitude in decibels against frequency" }) : null;
    var pPh = show.indexOf("bode") >= 0 ? new KT.Plot(cell(), { title: "Bode phase", aria: "Bode phase in degrees against frequency" }) : null;
    var pPz = show.indexOf("pz") >= 0 ? new KT.Plot(cell(), { title: "Poles (×) and zeros (○) in the s-plane", aria: "Pole-zero map", square: true, maxh: 340 }) : null;
    var routhBox = null;
    if (show.indexOf("routh") >= 0) { routhBox = el("div", "kt-tablebox"); wrap.appendChild(routhBox); }
    mount.appendChild(wrap);

    function readout(label, value) { var r = el("div", "kt-readout"), dt = el("dt", null, label), dd = el("dd", null, value); r.appendChild(dt); r.appendChild(dd); list.appendChild(r); }

    function update() {
      var sc = KT.scopeFrom(vals, S.defs);
      err.hidden = true;
      var G, Cc, num, den;
      try {
        var plant = S.plants && S.plants.length ? S.plants[plantIdx] : S;
        num = S.editable ? parseList(numBox.querySelector("input").value, sc) : coeffs(E.run(plant.num, sc));
        den = S.editable ? parseList(denBox.querySelector("input").value, sc) : coeffs(E.run(plant.den, sc));
        if (!den.length || den.every(function (x) { return x === 0; })) throw new Error("The denominator cannot be zero.");
        if (num.some(isNaN) || den.some(isNaN)) throw new Error("A coefficient is not a number.");
      } catch (e) { err.hidden = false; err.textContent = "Check the transfer function — " + (e.message || e); return; }
      var cn = [1], cd = [1], ctrlTxt = "";
      if (S.pid) {
        var kp = +E.num(sc.v[S.pid.kp] || 0), ki = +E.num(sc.v[S.pid.ki] || 0), kd = +E.num(sc.v[S.pid.kd] || 0);
        if (ki !== 0) { cn = [kd, kp, ki]; cd = [1, 0]; } else { cn = [kd, kp]; cd = [1]; }
        ctrlTxt = "C(s) = " + (ki !== 0 ? "(" + polyStr(cn) + ") / s" : polyStr(cn));
      } else if (S.ctrl) {
        cn = coeffs(E.run(S.ctrl.num, sc)); cd = coeffs(E.run(S.ctrl.den, sc));
        ctrlTxt = "C(s) = (" + polyStr(cn) + ") / (" + polyStr(cd) + ")";
      }
      var Ln = TF.polymul(cn, num), Ld = TF.polymul(cd, den);
      var closed = loop === 1 || !!S.pid || S.loop === "closed";
      var Tn = closed ? Ln : num, Td = closed ? TF.polyadd(Ld, Ln) : den;
      // strip leading zeros
      while (Tn.length > 1 && Math.abs(Tn[0]) < 1e-14) Tn.shift();
      while (Td.length > 1 && Math.abs(Td[0]) < 1e-14) Td.shift();
      var poles = TF.roots(Td), zeros = TF.roots(Tn);
      var stable = poles.every(function (p) { return (KT.isC(p) ? p.re : p) < -1e-9; });
      var marginal = !stable && poles.every(function (p) { return (KT.isC(p) ? p.re : p) < 1e-9; });
      eq.textContent = (ctrlTxt ? ctrlTxt + "\n" : "") + "G(s) = (" + polyStr(num) + ") / (" + polyStr(den) + ")" + (closed ? "\nT(s) = (" + polyStr(Tn) + ") / (" + polyStr(Td) + ")" : "");
      badges.innerHTML = "";
      var b = el("span", "kt-badge kt-badge--" + (stable ? "ok" : marginal ? "warn" : "bad"), stable ? "Stable: all poles in the left half-plane" : marginal ? "Marginally stable: poles on the jω axis" : "Unstable: a pole in the right half-plane");
      badges.appendChild(b);
      list.innerHTML = "";
      var slow = Infinity;
      poles.forEach(function (p) { var re = Math.abs(KT.isC(p) ? p.re : p); if (re > 1e-9) slow = Math.min(slow, re); });
      var tmax = S.tmax ? +E.num(E.run(S.tmax, sc)) : (stable ? Math.min(400, Math.max(0.02, 7 / slow)) : 20);
      var res = TF.step(Tn, Td, tmax, 500);
      var dc = Math.abs(TF.polyval(Td, 0)) > 1e-14 ? TF.polyval(Tn, 0) / TF.polyval(Td, 0) : NaN;
      var info = TF.info(res.t, res.y, stable ? dc : null);
      var mg = TF.margins(Ln, Ld);
      sc.v.tr = info.tr; sc.v.tp = info.tp; sc.v.ts = info.ts; sc.v.Mp = info.mp; sc.v.yss = dc; sc.v.ess = 1 - dc;
      sc.v.pm = mg.pm; sc.v.gm = mg.gm; sc.v.wgc = mg.wgc; sc.v.wpc = mg.wpc;
      readout("Poles", poles.map(rootStr).join(",  ") || "none");
      if (zeros.length) readout("Zeros", zeros.map(rootStr).join(",  "));
      if (show.indexOf("step") >= 0) {
        readout("Final value", stable ? F.sig(dc, 4) : "— (not stable)");
        if (stable && closed) readout("Steady-state error (step)", F.sig(1 - dc, 4));
        readout("Rise time 10–90 %", stable ? F.value(info.tr, "eng", "s") : "—");
        readout("Peak overshoot Mp", stable ? F.sig(info.mp, 3) + " %" : "—");
        readout("Peak time tp", stable && info.mp > 0.05 ? F.value(info.tp, "eng", "s") : "—");
        readout("Settling time (2 %)", stable ? F.value(info.ts, "eng", "s") : "—");
      }
      if (show.indexOf("bode") >= 0 || show.indexOf("margins") >= 0) {
        readout("Gain crossover ωgc", isFinite(mg.wgc) ? F.sig(mg.wgc, 4) + " rad/s" : "none");
        readout("Phase margin", isFinite(mg.pm) ? F.sig(mg.pm, 4) + "°" : "∞");
        readout("Phase crossover ωpc", isFinite(mg.wpc) ? F.sig(mg.wpc, 4) + " rad/s" : "none");
        readout("Gain margin", isFinite(mg.gm) ? F.sig(mg.gm, 4) + " dB" + (isFinite(mg.gm) ? "  (×" + F.sig(Math.pow(10, mg.gm / 20), 4) + ")" : "") : "∞");
      }
      (S.outputs || []).forEach(function (o) {
        if (o.show && !E.truthy((function () { try { return E.run(o.show, sc); } catch (e) { return 0; } })())) return;
        var v; try { v = E.run(o.expr, sc); } catch (e) { v = NaN; }
        readout(o.label, F.value(v, o.fmt || "auto", o.unit || ""));
      });
      if (pStep) {
        var series = [{ kind: "line", x: res.t, y: res.y, label: closed ? "closed-loop y(t)" : "y(t)" }];
        if (stable) series.push({ kind: "hline", y: dc, label: "final " + F.sig(dc, 3), color: 1 });
        var marks = stable && info.mp > 0.05 ? [{ x: info.tp, y: info.peak, label: "Mp " + F.sig(info.mp, 3) + "%" }] : [];
        if (stable && isFinite(info.ts) && info.ts > 0) series.push({ kind: "vline", x: info.ts, label: "ts", color: 2 });
        pStep.set({ type: "xy", x: { label: "Time t", unit: "s", min: 0, max: tmax, sym: "t" }, y: { label: "Output y(t)", robust: !stable }, series: series, marks: marks });
      }
      if (pMag) {
        var wl = S.wmin ? +E.run(S.wmin, sc) : 1e-2, wh = S.wmax ? +E.run(S.wmax, sc) : 1e3;
        var allr = poles.concat(zeros, TF.roots(Ld), TF.roots(Ln)).map(function (z) { return Cx.abs(KT.isC(z) ? z : new C(z, 0)); }).filter(function (v) { return v > 1e-9; });
        if (!S.wmin && allr.length) { wl = Math.pow(10, Math.floor(Math.log10(Math.min.apply(null, allr))) - 1); wh = Math.pow(10, Math.ceil(Math.log10(Math.max.apply(null, allr))) + 1); }
        var W = [], M = [], P = [], unwrap = 0, last = null;
        for (var i = 0; i <= 400; i++) {
          var w = wl * Math.pow(wh / wl, i / 400), g = TF.evalAt(Ln, Ld, new C(0, w)); g = KT.isC(g) ? g : new C(g, 0);
          var ph = Cx.arg(g) * 180 / Math.PI;
          if (last != null) { while (ph + unwrap - last > 180) unwrap -= 360; while (ph + unwrap - last < -180) unwrap += 360; }
          ph += unwrap; last = ph;
          W.push(w); M.push(20 * Math.log10(Cx.abs(g))); P.push(ph);
        }
        // start the phase near its low-frequency value in (-360, 180]
        var shift = 360 * Math.round(P[0] / 360); if (P[0] - shift > 90) shift += 360;
        if (shift) P = P.map(function (v) { return v - shift; });
        var ms = [{ kind: "line", x: W, y: M, label: "|L(jω)|" }, { kind: "hline", y: 0, label: "0 dB", color: 3 }];
        if (isFinite(mg.wgc)) ms.push({ kind: "vline", x: mg.wgc, label: "ωgc", color: 2 });
        pMag.set({ type: "xy", x: { label: "Frequency ω", unit: "rad/s", log: true, min: wl, max: wh, sym: "ω" }, y: { label: "Magnitude", unit: "dB", robust: true }, series: ms });
        var ps = [{ kind: "line", x: W, y: P, label: "∠L(jω)", color: 1 }, { kind: "hline", y: -180, label: "−180°", color: 3 }];
        if (isFinite(mg.wpc)) ps.push({ kind: "vline", x: mg.wpc, label: "ωpc", color: 2 });
        pPh.set({ type: "xy", x: { label: "Frequency ω", unit: "rad/s", log: true, min: wl, max: wh, sym: "ω" }, y: { label: "Phase", unit: "°" }, series: ps });
      }
      if (pPz) {
        function re(z) { return KT.isC(z) ? z.re : z; } function im(z) { return KT.isC(z) ? z.im : 0; }
        var pts = poles.concat(zeros), lim = Math.max(1, Math.max.apply(null, pts.map(function (z) { return Math.max(Math.abs(re(z)), Math.abs(im(z))); }).concat([0]))) * 1.25;
        pPz.set({ type: "custom", draw: function (x, w, h, c, plot) {
          var f = plot.frame({ x: { label: "Real σ", unit: "1/s" }, y: { label: "Imag jω", unit: "rad/s" } }, c, [-lim, lim], [-lim, lim]);
          x.fillStyle = "rgba(220,38,38,.06)"; x.fillRect(f.X(0), f.T, f.L + f.pw - f.X(0), f.ph);
          x.lineWidth = 2.6; x.strokeStyle = c.ser[3];
          poles.forEach(function (p) { var px = f.X(re(p)), py = f.Y(im(p)); x.beginPath(); x.moveTo(px - 6, py - 6); x.lineTo(px + 6, py + 6); x.moveTo(px + 6, py - 6); x.lineTo(px - 6, py + 6); x.stroke(); });
          x.strokeStyle = c.ser[2];
          zeros.forEach(function (z) { x.beginPath(); x.arc(f.X(re(z)), f.Y(im(z)), 6, 0, 2 * Math.PI); x.stroke(); });
          plot.readout.textContent = "Shaded: right half-plane (unstable).";
        } });
      }
      if (routhBox) {
        var r = TF.routh(Td);
        routhBox.innerHTML = "";
        routhBox.appendChild(el("h4", "kt-h4", "Routh array of " + polyStr(Td)));
        var tw = el("div", "kt-tablewrap"), t = el("table", "kt-table"), tb = el("tbody");
        r.rows.forEach(function (row, i) {
          var tr = el("tr"), th = el("th", null, "s" + toSup(Td.length - 1 - i)); th.scope = "row"; tr.appendChild(th);
          row.forEach(function (v) { tr.appendChild(el("td", null, F.sig(v, 4))); });
          if (r.special.some(function (s) { return s.row === i; })) tr.className = "is-hl";
          tb.appendChild(tr);
        });
        t.appendChild(tb); tw.appendChild(t); routhBox.appendChild(tw);
        routhBox.appendChild(el("p", "kt-note", "First-column sign changes = " + r.changes + " → " + r.changes + " pole(s) in the right half-plane." + (r.special.length ? " Highlighted rows used the ε or auxiliary-polynomial rule." : "")));
      }
    }
    update();
  }
  KT.define("tf", build);
})();
