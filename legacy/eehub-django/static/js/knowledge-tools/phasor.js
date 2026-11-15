/* EE Hub — phasor and complex-number playground (Round 7, R7E, shared tool K8).
   settings: {z1: "3+4j", z2: "5∠-30", unit: "", labels: ["z₁","z₂"], rotate: true, f: 50}
   Accepts 3+4j, 3-j4, 5∠53.13, 5<53.13, 5 cis 30, or any expression (pol(5,30), sqrt(2)*j). */
(function () {
  "use strict";
  var KT = window.KT, E = KT.expr, el = KT.el, F = KT.fmt, C = KT.C, Cx = KT.Cx;

  function parseZ(s) {
    s = String(s || "").trim().replace(/\s+/g, "").replace(/−/g, "-");
    if (!s) throw new Error("empty");
    var m = /^([+-]?[\d.eE+-]+)(?:∠|<|\/_|cis|@)([+-]?[\d.eE+-]+)°?(rad)?$/.exec(s);
    if (m) return Cx.polar(+m[1], m[3] ? +m[2] : +m[2] * Math.PI / 180);
    s = s.replace(/(\d|\))\s*[ij](?![a-z])/g, "$1*j").replace(/(^|[+\-*/(])[ij](\d|\()/g, "$1j*$2").replace(/(^|[+\-*/(])i(?![a-z])/g, "$1j");
    var v = E.run(s);
    if (Array.isArray(v) || typeof v === "string") throw new Error("not a number");
    v = KT.isC(v) ? v : new C(+v, 0);
    if (!isFinite(v.re) || !isFinite(v.im)) throw new Error("not a number");
    return v;
  }
  KT.parseComplex = parseZ;
  function both(z, u) { return F.complex(z, "rect", u || "", 4) + "   =   " + F.complex(z, "polar", u || "", 4); }

  function build(mount, S) {
    var u = S.unit || "", L = S.labels || ["z₁", "z₂"];
    var wrap = el("div", "kt-phasor");
    var row = el("div", "kt-row");
    var f1 = KT.ui.text({ label: L[0] + "  (e.g. 3+4j or 5∠53.13)", value: S.z1 || "3+4j" }, upd);
    var f2 = KT.ui.text({ label: L[1] + "  (e.g. 2−j or 10∠−30)", value: S.z2 || "2-1j" }, upd);
    f1.classList.add("kt-field"); f2.classList.add("kt-field");
    row.appendChild(f1); row.appendChild(f2); wrap.appendChild(row);
    var op = "+";
    var ops = [["+", L[0] + " + " + L[1]], ["-", L[0] + " − " + L[1]], ["*", L[0] + " × " + L[1]], ["/", L[0] + " ÷ " + L[1]], ["c", "conj " + L[0]], ["r", "1 / " + L[0]]];
    wrap.appendChild(KT.ui.select({ label: "Show on the diagram", options: ops, value: "+" }, function (v) { op = v; upd(); }));
    var grid = el("div", "kt-grid2");
    var list = el("dl", "kt-readouts"); list.style.gridTemplateColumns = "1fr";
    var left = el("div"), right = el("div");
    left.appendChild(list); grid.appendChild(left); grid.appendChild(right);
    wrap.appendChild(grid);
    var plot = new KT.Plot(right, { title: "Argand / phasor diagram", square: true, maxh: 380, aria: "Phasor diagram of the two numbers and the result" });
    var tplot = null, anim = null, rot = !!S.rotate, T = 0;
    if (S.rotate !== false) {
      var tw = el("div", "kt-plots"); wrap.appendChild(tw);
      var cell = el("div", "kt-plotcell"); tw.appendChild(cell);
      tplot = new KT.Plot(cell, { title: "Time waveforms: v(t) = |z| cos(ωt + θ)", aria: "Time waveforms of the phasors" });
    }
    var err = el("p", "kt-error"); err.hidden = true; wrap.appendChild(err);
    mount.appendChild(wrap);
    var z1, z2, zr;

    function card(k, v) { var r = el("div", "kt-readout"); r.appendChild(el("dt", null, k)); r.appendChild(el("dd", null, v)); list.appendChild(r); }
    function upd() {
      try { z1 = parseZ(f1.querySelector("input").value); z2 = parseZ(f2.querySelector("input").value); err.hidden = true; }
      catch (e) { err.hidden = false; err.textContent = "Type numbers like 3+4j, 2−j5 or 10∠−30 (" + e.message + ")."; return; }
      zr = op === "+" ? Cx.add(z1, z2) : op === "-" ? Cx.sub(z1, z2) : op === "*" ? Cx.mul(z1, z2) : op === "/" ? Cx.div(z1, z2) : op === "c" ? new C(z1.re, -z1.im) : Cx.div(new C(1, 0), z1);
      list.innerHTML = "";
      card(L[0], both(z1, u)); card(L[1], both(z2, u));
      card(L[0] + " + " + L[1], both(Cx.add(z1, z2), u));
      card(L[0] + " − " + L[1], both(Cx.sub(z1, z2), u));
      card(L[0] + " × " + L[1], both(Cx.mul(z1, z2)) + "   (moduli multiply, angles add)");
      card(L[0] + " ÷ " + L[1], both(Cx.div(z1, z2)) + "   (moduli divide, angles subtract)");
      card("|" + L[0] + "|, arg " + L[0], F.sig(Cx.abs(z1), 5) + ",  " + F.sig(Cx.arg(z1) * 180 / Math.PI, 5) + "° = " + F.sig(Cx.arg(z1), 5) + " rad");
      card("Phase difference " + L[0] + " − " + L[1], F.sig((Cx.arg(z1) - Cx.arg(z2)) * 180 / Math.PI, 4) + "°  (" + (Cx.arg(z1) > Cx.arg(z2) ? L[0] + " leads" : L[0] + " lags") + ")");
      draw();
    }
    function draw() {
      if (!z1) return;
      var rotz = function (z) { return rot && anim && T ? Cx.mul(z, Cx.polar(1, T * 1.2)) : z; };
      var items = [{ z: rotz(z1), label: L[0], color: 0 }, { z: rotz(z2), label: L[1], color: 2 }];
      var name = { "+": L[0] + "+" + L[1], "-": L[0] + "−" + L[1], "*": L[0] + "·" + L[1], "/": L[0] + "/" + L[1], c: L[0] + "*", r: "1/" + L[0] }[op];
      items.push({ z: rotz(zr), label: name, color: 1 });
      if (op === "+") items.push({ z: rotz(z2), from: rotz(z1), label: "", color: 2, dash: true, nolegend: true, width: 1.6 });
      if (op === "-") items.push({ z: Cx.mul(rotz(z2), new C(-1, 0)), from: rotz(z1), label: "", color: 2, dash: true, nolegend: true, width: 1.6 });
      plot.set({ type: "argand", items: items, unit: u, hint: rot && anim && anim.playing ? "Phasors rotate at ω; the time plot is their projection on the real axis." : "" });
      if (tplot) {
        var ts = [], a = [], b = [], c = [], w = 2 * Math.PI;
        for (var i = 0; i <= 240; i++) { var t = i / 120; ts.push(t); a.push(Cx.abs(z1) * Math.cos(w * t + Cx.arg(z1))); b.push(Cx.abs(z2) * Math.cos(w * t + Cx.arg(z2))); c.push(Cx.abs(zr) * Math.cos(w * t + Cx.arg(zr))); }
        var ser = [{ x: ts, y: a, label: L[0] }, { x: ts, y: b, label: L[1], color: 2 }];
        if (op === "+" || op === "-") ser.push({ x: ts, y: c, label: name, color: 1, dash: true });
        var tnow = rot && anim ? ((T * 1.2) / w) % 2 : null;
        if (tnow != null && anim.playing) ser.push({ kind: "vline", x: tnow, color: 3 });
        tplot.set({ type: "xy", x: { label: "Time", unit: "cycles", min: 0, max: 2 }, y: { label: "Instantaneous value", unit: u }, series: ser });
      }
    }
    upd();
    if (S.rotate !== false) {
      anim = KT.animate(wrap, function (t) { T = t; draw(); }, { still: 0 });
      var bg = el("div", "btn-group kt-animbar"); bg.appendChild(anim.button);
      wrap.insertBefore(bg, grid.nextSibling);
    }
  }
  KT.define("phasor", build);
})();
