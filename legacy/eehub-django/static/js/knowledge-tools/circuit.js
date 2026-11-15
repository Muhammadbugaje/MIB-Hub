/* EE Hub — series/parallel circuit solver (Round 7, R7E, shared tool K8).
   settings: {net: "s(R1, p(R2, s(L1, C1)))",
              elements: {R1: {type: "R", value: 10}, L1: {type: "L", value: 0.1}, C1: {type: "C", value: 100e-6}},
              source: {kind: "ac"|"dc", V: 230, f: 50}, editable: true, sweep: true}
   s(...) = in series, p(...) = in parallel. Values in Ω, H and F. */
(function () {
  "use strict";
  var KT = window.KT, el = KT.el, F = KT.fmt, C = KT.C, Cx = KT.Cx;
  var NS = "http://www.w3.org/2000/svg";

  function parseNet(src) {
    var s = String(src || "").replace(/\s+/g, ""), i = 0;
    function node() {
      var m = /^([sp])\(/i.exec(s.slice(i));
      if (m) {
        i += 2; var kids = [];
        while (true) { kids.push(node()); if (s[i] === ",") { i++; continue; } if (s[i] === ")") { i++; break; } throw new Error("expected , or ) at " + (i + 1)); }
        return { op: m[1].toLowerCase(), kids: kids };
      }
      m = /^[A-Za-z][A-Za-z0-9_]*/.exec(s.slice(i));
      if (!m) throw new Error("expected an element name at " + (i + 1));
      i += m[0].length;
      return { name: m[0] };
    }
    var t = node();
    if (i !== s.length) throw new Error("unexpected text after position " + i);
    return t;
  }
  function zOf(e, w) {
    var v = +e.value;
    if (e.type === "R") return new C(v, 0);
    if (e.type === "L") return new C(0, Math.max(w * v, 1e-12));
    if (e.type === "C") return w === 0 ? new C(1e15, 0) : new C(0, -1 / (w * v));
    if (e.type === "Z") return new C(+e.re || 0, +e.im || 0);
    return new C(v, 0);
  }
  function Z(n, els, w) {
    if (n.name) { var e = els[n.name]; if (!e) throw new Error("no value for " + n.name); return zOf(e, w); }
    if (n.op === "s") return n.kids.reduce(function (a, k) { return Cx.add(a, Z(k, els, w)); }, new C(0, 0));
    var y = n.kids.reduce(function (a, k) { return Cx.add(a, Cx.div(new C(1, 0), Z(k, els, w))); }, new C(0, 0));
    return Cx.div(new C(1, 0), y);
  }
  // distribute: node gets current I (series) or voltage V (parallel)
  function solve(n, els, w, I, out) {
    var z = Z(n, els, w), V = Cx.mul(I, z);
    if (n.name) { out.push({ name: n.name, type: els[n.name].type, z: z, V: V, I: I }); return; }
    if (n.op === "s") n.kids.forEach(function (k) { solve(k, els, w, I, out); });
    else n.kids.forEach(function (k) { solve(k, els, w, Cx.div(V, Z(k, els, w)), out); });
  }
  KT.circuit = { parse: parseNet, Z: Z, solve: solve };

  /* ---- schematic -------------------------------------------------------------- */
  function layout(n) {
    if (n.name) return { n: n, w: 1, h: 1 };
    var kids = n.kids.map(layout);
    if (n.op === "s") return { n: n, kids: kids, w: kids.reduce(function (a, k) { return a + k.w; }, 0), h: Math.max.apply(null, kids.map(function (k) { return k.h; })) };
    return { n: n, kids: kids, w: Math.max.apply(null, kids.map(function (k) { return k.w; })) + 0.5, h: kids.reduce(function (a, k) { return a + k.h; }, 0) };
  }
  function svg(tag, attrs, parent) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function drawEl(g, name, type, x, y, U, label) {
    var cx = x + U / 2, w = U * 0.62;
    svg("line", { x1: x, y1: y, x2: cx - w / 2, y2: y, class: "w" }, g); svg("line", { x1: cx + w / 2, y1: y, x2: x + U, y2: y, class: "w" }, g);
    if (type === "R" || type === "Z") {
      var pts = [], k; for (k = 0; k <= 12; k++) pts.push((cx - w / 2 + w * k / 12) + "," + (y + (k === 0 || k === 12 ? 0 : (k % 2 ? -1 : 1) * U * 0.1)));
      svg("polyline", { points: pts.join(" "), class: "e" }, g);
    } else if (type === "L") {
      var d = "M" + (cx - w / 2) + "," + y; for (k = 0; k < 4; k++) d += " a" + (w / 8) + "," + (w / 8) + " 0 0 1 " + (w / 4) + ",0";
      svg("path", { d: d, class: "e" }, g);
    } else if (type === "C") {
      svg("line", { x1: cx - w / 2, y1: y, x2: cx - 4, y2: y, class: "w" }, g); svg("line", { x1: cx + 4, y1: y, x2: cx + w / 2, y2: y, class: "w" }, g);
      svg("line", { x1: cx - 4, y1: y - U * 0.17, x2: cx - 4, y2: y + U * 0.17, class: "e" }, g); svg("line", { x1: cx + 4, y1: y - U * 0.17, x2: cx + 4, y2: y + U * 0.17, class: "e" }, g);
    }
    var t = svg("text", { x: cx, y: y - U * 0.24, "text-anchor": "middle", class: "t" }, g); t.textContent = name;
    if (label) { var t2 = svg("text", { x: cx, y: y + U * 0.34, "text-anchor": "middle", class: "v" }, g); t2.textContent = label; }
  }
  function place(g, L, x, y, U, els, vlabel) {
    // y = the wire line of this block; returns nothing
    if (L.n.name) { drawEl(g, L.n.name, els[L.n.name].type, x, y, U, vlabel(L.n.name)); return; }
    if (L.n.op === "s") { var cx = x; L.kids.forEach(function (k) { place(g, k, cx, y, U, els, vlabel); cx += k.w * U; }); return; }
    var top = y - L.h * U / 2 + L.kids[0].h * U / 2, cy = y - L.h * U / 2, xl = x + U * 0.25, xr = x + L.w * U - U * 0.25;
    svg("line", { x1: x, y1: y, x2: xl, y2: y, class: "w" }, g); svg("line", { x1: xr, y1: y, x2: x + L.w * U, y2: y, class: "w" }, g);
    var ys = [];
    L.kids.forEach(function (k) {
      var ky = cy + k.h * U / 2; ys.push(ky);
      place(g, k, xl, ky, U, els, vlabel);
      if (xl + k.w * U < xr) svg("line", { x1: xl + k.w * U, y1: ky, x2: xr, y2: ky, class: "w" }, g);
      cy += k.h * U;
    });
    svg("line", { x1: xl, y1: ys[0], x2: xl, y2: ys[ys.length - 1], class: "w" }, g); svg("line", { x1: xr, y1: ys[0], x2: xr, y2: ys[ys.length - 1], class: "w" }, g);
    svg("circle", { cx: xl, cy: y, r: 2.6, class: "d" }, g); svg("circle", { cx: xr, cy: y, r: 2.6, class: "d" }, g);
  }

  function build(mount, S) {
    var els = JSON.parse(JSON.stringify(S.elements || { R1: { type: "R", value: 10 }, L1: { type: "L", value: 0.1 }, C1: { type: "C", value: 100e-6 } }));
    var src = Object.assign({ kind: "ac", V: 230, f: 50 }, S.source || {}), netText = S.net || "s(R1, L1, C1)", tree = null;
    var wrap = el("div", "kt-calc kt-circuit");
    var top = el("div", "kt-calc__top"), ctl = el("div", "kt-controls"), res = el("div", "kt-results");
    top.appendChild(ctl); top.appendChild(res); wrap.appendChild(top);
    var diag = el("div", "kt-plot kt-schem"); diag.setAttribute("role", "img");
    wrap.insertBefore(diag, top);
    var tableBox = el("div", "kt-tablebox"); wrap.appendChild(tableBox);
    var sweepBox = S.sweep ? el("div", "kt-plots") : null;
    if (sweepBox) wrap.appendChild(sweepBox);
    mount.appendChild(wrap);
    var vals = {}, ctlEls = {}, pend = false;
    function changed() { if (pend) return; pend = true; requestAnimationFrame(function () { pend = false; update(); }); }
    if (S.editable !== false) {
      var nt = KT.ui.text({ label: "Network: s(…) = series, p(…) = parallel", value: netText }, function (v) { netText = v; rebuildEls(); changed(); });
      ctl.appendChild(nt);
    }
    if (S.kinds !== false) ctl.appendChild(KT.ui.select({ label: "Source", options: [["dc", "DC"], ["ac", "AC (sinusoidal)"]], value: src.kind }, function (v) { src.kind = v; fbox.hidden = v === "dc"; changed(); }));
    ctl.appendChild(KT.ui.range({ id: "V", label: src.kind === "dc" ? "Source voltage" : "Source voltage (rms)", unit: "V", min: 0.1, max: S.vmax || 1000, value: src.V, scale: "log" }, function (v) { src.V = v; changed(); }));
    var fbox = KT.ui.range({ id: "f", label: "Frequency", unit: "Hz", min: 1, max: S.fmax || 1e6, value: src.f, scale: "log" }, function (v) { src.f = v; changed(); });
    fbox.hidden = src.kind === "dc";
    ctl.appendChild(fbox);
    var elBox = el("div", "kt-controls"); ctl.appendChild(elBox);
    var UNIT = { R: "Ω", L: "H", C: "F" }, RANGE = { R: [0.01, 1e6], L: [1e-6, 10], C: [1e-12, 1] };
    function rebuildEls() {
      try { tree = parseNet(netText); } catch (e) { tree = null; return; }
      var names = []; (function walk(n) { if (n.name) names.push(n.name); else n.kids.forEach(walk); })(tree);
      elBox.innerHTML = "";
      names.forEach(function (nm) {
        if (!els[nm]) { var t = nm[0].toUpperCase(); els[nm] = { type: UNIT[t] ? t : "R", value: t === "L" ? 0.01 : t === "C" ? 1e-5 : 100 }; }
        var e = els[nm], r = RANGE[e.type] || [0.01, 1e6];
        elBox.appendChild(KT.ui.range({ id: nm, label: nm, unit: UNIT[e.type] || "Ω", min: r[0], max: r[1], value: e.value, scale: "log", free: true }, function (v) { e.value = v; changed(); }));
      });
    }
    rebuildEls();
    var list = el("dl", "kt-readouts"), err = el("p", "kt-error"); err.hidden = true;
    res.appendChild(list); res.appendChild(err);
    var sweepPlot = sweepBox ? new KT.Plot(sweepBox, { title: "Source current against frequency", aria: "Current against frequency" }) : null;
    function card(k, v, big) { var r = el("div", "kt-readout" + (big ? " kt-readout--big" : "")); r.appendChild(el("dt", null, k)); r.appendChild(el("dd", null, v)); list.appendChild(r); }

    function update() {
      list.innerHTML = ""; err.hidden = true; tableBox.innerHTML = "";
      if (!tree) { err.hidden = false; err.textContent = "Write the network like s(R1, p(R2, C1))."; return; }
      var w = src.kind === "dc" ? 0 : 2 * Math.PI * src.f, out = [];
      var Zt, I;
      try { Zt = Z(tree, els, w); I = Cx.div(new C(src.V, 0), Zt); solve(tree, els, w, I, out); }
      catch (e) { err.hidden = false; err.textContent = e.message; return; }
      var Sx = Cx.mul(new C(src.V, 0), new C(I.re, -I.im));
      card(src.kind === "dc" ? "Equivalent resistance" : "Equivalent impedance Z", src.kind === "dc" ? F.value(Zt.re, "eng", "Ω") : F.complex(Zt, "polar", "Ω", 4) + "  (" + F.complex(Zt, "rect", "", 4) + ")", true);
      card("Source current I", src.kind === "dc" ? F.value(I.re, "eng", "A") : F.complex(I, "polar", "A", 4));
      card("Real power P", F.value(Sx.re, "eng", "W"));
      if (src.kind !== "dc") {
        card("Reactive power Q", F.value(Sx.im, "eng", "VAr"));
        card("Apparent power S", F.value(Cx.abs(Sx), "eng", "VA"));
        var pf = Sx.re / Cx.abs(Sx);
        card("Power factor", F.sig(pf, 4) + (Math.abs(Sx.im) < 1e-9 * Cx.abs(Sx) ? " (unity)" : Sx.im > 0 ? " lagging" : " leading"));
      }
      // element table
      var tw = el("div", "kt-tablewrap"), t = el("table", "kt-table"), th = el("thead"), hr = el("tr");
      ["Element", src.kind === "dc" ? "R (Ω)" : "Z", "Voltage", "Current", "P (W)"].concat(src.kind === "dc" ? [] : ["Q (VAr)"]).forEach(function (h) { var x = el("th", null, h); x.scope = "col"; hr.appendChild(x); });
      th.appendChild(hr); t.appendChild(th);
      var tb = el("tbody"), sumP = 0;
      out.forEach(function (o) {
        var s = Cx.mul(o.V, new C(o.I.re, -o.I.im)); sumP += s.re;
        var r = el("tr");
        [o.name, src.kind === "dc" ? (o.type === "C" ? "open" : o.type === "L" ? "short" : F.sig(o.z.re, 4)) : F.complex(o.z, "rect", "", 3),
          src.kind === "dc" ? F.value(o.V.re, "eng", "V") : F.complex(o.V, "polar", "V", 4), src.kind === "dc" ? F.value(o.I.re, "eng", "A") : F.complex(o.I, "polar", "A", 4),
          F.sig(s.re, 4)].concat(src.kind === "dc" ? [] : [F.sig(s.im, 4)]).forEach(function (v) { r.appendChild(el("td", null, v)); });
        tb.appendChild(r);
      });
      t.appendChild(tb); tw.appendChild(t);
      tableBox.appendChild(el("h4", "kt-h4", "Every element (phasors as rms ∠ angle)"));
      tableBox.appendChild(tw);
      tableBox.appendChild(el("p", "kt-note", "Check: the element powers add up to the source power: Σ P = " + F.sig(sumP, 5) + " W = Re(V·I*) = " + F.sig(Sx.re, 5) + " W."));
      // schematic
      var L = layout(tree), U = 74, pad = 26, W = (L.w + 1.4) * U + pad * 2, H = L.h * U + U * 0.9 + pad;
      diag.innerHTML = "";
      var s = svg("svg", { viewBox: "0 0 " + W + " " + H, width: "100%", class: "kt-schem__svg" });
      var g = svg("g", {}, s), y = pad + L.h * U / 2, x0 = pad + U * 0.9;
      // source
      var sx = pad + U * 0.35;
      svg("circle", { cx: sx, cy: y, r: U * 0.26, class: "e" }, g);
      var st = svg("text", { x: sx, y: y + 5, "text-anchor": "middle", class: "t" }, g); st.textContent = src.kind === "dc" ? "+ −" : "~";
      svg("line", { x1: sx, y1: y - U * 0.26, x2: sx, y2: pad * 0.6, class: "w" }, g);
      svg("line", { x1: sx, y1: pad * 0.6, x2: x0, y2: pad * 0.6, class: "w" }, g);
      svg("line", { x1: x0, y1: pad * 0.6, x2: x0, y2: y, class: "w" }, g);
      place(g, L, x0, y, U, els, function (nm) { var o = out.filter(function (q) { return q.name === nm; })[0]; return o ? F.value(Cx.abs(o.V), "eng", "V") : ""; });
      var xe = x0 + L.w * U, yb = H - pad * 0.5;
      svg("line", { x1: xe, y1: y, x2: xe + U * 0.3, y2: y, class: "w" }, g);
      svg("line", { x1: xe + U * 0.3, y1: y, x2: xe + U * 0.3, y2: yb, class: "w" }, g);
      svg("line", { x1: xe + U * 0.3, y1: yb, x2: sx, y2: yb, class: "w" }, g);
      svg("line", { x1: sx, y1: yb, x2: sx, y2: y + U * 0.26, class: "w" }, g);
      diag.appendChild(s);
      diag.setAttribute("aria-label", "Schematic: " + netText + " fed by a " + (src.kind === "dc" ? "DC" : "AC") + " source");
      if (sweepPlot && src.kind !== "dc") {
        var fs = [], is = [], f0 = null, best = 0;
        for (var i = 0; i <= 300; i++) {
          var f = Math.pow(10, -0 + 6 * i / 300), zz = Z(tree, els, 2 * Math.PI * f), ii = src.V / Cx.abs(zz);
          fs.push(f); is.push(ii); if (ii > best) { best = ii; f0 = f; }
        }
        sweepPlot.set({ type: "xy", x: { label: "Frequency", unit: "Hz", log: true, min: 1, max: 1e6, sym: "f" }, y: { label: "|I|", unit: "A", log: true }, series: [{ x: fs, y: is, label: "|I(f)|" }, { kind: "vline", x: src.f, label: "now", color: 2 }] });
      }
    }
    update();
  }
  KT.define("circuit", build);
})();
