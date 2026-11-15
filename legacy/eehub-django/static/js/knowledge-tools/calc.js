/* EE Hub — formula calculator / function plotter (Round 7, R7E).

   One configurable tool behind most course calculators. Everything comes from the slot settings:
     inputs   [{id, label, sym, unit, k (display→SI factor), min, max, step, value, scale:'log',
               type: range|number|select|toggle|text|table, options:[[value,label]], show}]
     defs     ["name = expr", "f(x) = expr", ...]            (evaluated in order)
     outputs  [{label, sym, expr, unit, fmt, show, big}]
     badges   [{expr, tone}]       tone is an expression giving ok|warn|bad|info
     steps    ["text with {expr} or {expr|fmt|unit}", ...]  or [{text, show}]
     plots    [{type:'xy', title, x:{var,min,max,n,label,unit,log}, y:{label,unit,min,max,log,zero},
                series:[{expr|x+y|px+py+t, kind, label, color, dash, show}], marks:[{x,y,label}]},
               {type:'bars', labels, values, ref:[{y,label}]}, {type:'phasor'|'argand', items:[{expr,label,from}]}]
     tables   [{title, n:'expr', cols:[{label, expr (uses i), fmt, unit}]}]
     animate  {var:'T', speed, still}
   Examples: knowledge/tools/catalog/l*.py (helpers in catalog/_h.py). */
(function () {
  "use strict";
  var KT = window.KT, E = KT.expr, el = KT.el, F = KT.fmt;

  function evalSafe(src, sc, dflt) { try { return E.run(src, sc); } catch (e) { return dflt === undefined ? NaN : dflt; } }
  function shown(item, sc) { return item.show == null || E.truthy(evalSafe(item.show, sc, 0)); }
  function arrOf(v) { return Array.isArray(v) ? v : [v]; }
  function nums(v) { return arrOf(v).map(function (x) { return KT.isC(x) ? (Math.abs(x.im) < 1e-9 * Math.max(1, Math.abs(x.re)) ? x.re : NaN) : +x; }); }
  function tone(t) { t = String(t || "info"); return /^(ok|warn|bad|info)$/.test(t) ? t : "info"; }

  function build(mount, S, rootEl) {
    var inputs = S.inputs || [], vals = {}, ctlEls = {};
    var wrap = el("div", "kt-calc" + ((S.plots || []).length ? " kt-calc--plots" : ""));
    var top = el("div", "kt-calc__top");
    var ctlBox = el("div", "kt-controls");
    ctlBox.setAttribute("role", "group");
    ctlBox.setAttribute("aria-label", "Inputs");
    var outBox = el("div", "kt-results");
    var outList = el("dl", "kt-readouts");
    var badgeBox = el("div", "kt-badges");
    badgeBox.setAttribute("aria-live", "polite");
    var errBox = el("p", "kt-error"); errBox.hidden = true;
    outBox.appendChild(badgeBox); outBox.appendChild(outList); outBox.appendChild(errBox);
    top.appendChild(ctlBox); top.appendChild(outBox);
    wrap.appendChild(top);
    if (!inputs.length) top.classList.add("kt-calc__top--noin");

    var pending = false;
    function changed() { if (pending) return; pending = true; (window.requestAnimationFrame || setTimeout)(function () { pending = false; update(); }); }

    KT.buildInputs(ctlBox, inputs, vals, ctlEls, changed);

    // presets: [{label, values:{id: value}}]
    if (S.presets && S.presets.length) {
      var pg = el("div", "kt-presets"), pl = el("span", "kt-ctl__lab", S.presets_label || "Examples");
      var bg = el("div", "btn-group");
      S.presets.forEach(function (p) {
        var b = el("button", "kt-btn kt-btn--ghost", p.label); b.type = "button";
        b.addEventListener("click", function () {
          Object.keys(p.values || {}).forEach(function (id) {
            var c = ctlEls[id], inp = inputs.filter(function (x) { return x.id === id; })[0];
            if (!c || !inp) return;
            if (c.set) c.set(+p.values[id]);
            else { vals[id] = p.values[id]; var btns = c.querySelectorAll("[role=radio]"); Array.prototype.forEach.call(btns, function (x, i) { x.setAttribute("aria-checked", String((inp.options[i] || [])[0] == p.values[id])); }); var sel = c.querySelector("select"); if (sel) inp.options.forEach(function (o, i) { if (o[0] == p.values[id]) sel.value = String(i); }); }
          });
          changed();
        });
        bg.appendChild(b);
      });
      pg.appendChild(pl); pg.appendChild(bg);
      ctlBox.insertBefore(pg, ctlBox.firstChild);
    }

    // readouts
    var outEls = (S.outputs || []).map(function (o) {
      var row = el("div", "kt-readout" + (o.big ? " kt-readout--big" : ""));
      var dt = el("dt"); dt.textContent = o.label || o.expr;
      if (o.sym) { dt.appendChild(doc().createTextNode(" ")); dt.appendChild(el("i", "kt-sym", o.sym)); }
      var dd = el("dd");
      row.appendChild(dt); row.appendChild(dd);
      outList.appendChild(row);
      return { o: o, row: row, dd: dd };
    });
    function doc() { return document; }

    // plots
    var plots = (S.plots || []).map(function (p) {
      var holder = el("div", "kt-plotcell");
      return { p: p, holder: holder };
    });
    if (plots.length) {
      var pw = el("div", "kt-plots" + (plots.length > 1 ? " kt-plots--multi" : ""));
      plots.forEach(function (pp) {
        pw.appendChild(pp.holder);
        var opt = { title: pp.p.title, aspect: pp.p.aspect, square: pp.p.type === "phasor" || pp.p.type === "argand" || pp.p.square, maxh: pp.p.maxh,
          aria: (pp.p.title || "Plot") + (pp.p.x && pp.p.x.label ? ": " + (pp.p.y && pp.p.y.label ? pp.p.y.label + " against " : "") + pp.p.x.label : "") };
        pp.plot = new KT.Plot(pp.holder, opt);
      });
      wrap.appendChild(pw);
    }
    // tables
    var tables = (S.tables || []).map(function (t) {
      var box = el("div", "kt-tablebox");
      if (t.title) box.appendChild(el("h4", "kt-h4", t.title));
      var tw = el("div", "kt-tablewrap"), tb = el("table", "kt-table");
      tw.appendChild(tb); box.appendChild(tw); wrap.appendChild(box);
      return { t: t, box: box, tb: tb };
    });
    var steps = null;
    if (S.steps && S.steps.length) { steps = KT.Steps(S.steps_title || "Step-by-step working"); wrap.appendChild(steps.el); }
    if (S.note) { var n = el("p", "kt-note"); n.textContent = S.note; wrap.appendChild(n); }
    mount.appendChild(wrap);

    var scope = null, anim = null, T = 0;
    function makeScope() {
      var sc = new KT.Scope();
      Object.keys(vals).forEach(function (k) { sc.v[k] = vals[k]; });
      if (S.animate) sc.v[S.animate["var"] || "T"] = T;
      var err = null;
      (S.defs || []).forEach(function (d) { try { E.define(sc, d); } catch (e) { if (!err) err = e.message; var m = /^\s*([A-Za-z_Ͱ-Ͽ][\w']*)\s*=/.exec(d); if (m) sc.v[m[1]] = NaN; } });
      sc.err = err;
      return sc;
    }
    function update() {
      scope = makeScope();
      var sc = scope;
      // inputs that show/hide
      inputs.forEach(function (inp) { if (inp.show != null) ctlEls[inp.id].hidden = !shown(inp, sc); });
      outEls.forEach(function (x) {
        var ok = shown(x.o, sc);
        x.row.hidden = !ok;
        if (!ok) return;
        var v = evalSafe(x.o.expr, sc);
        x.dd.textContent = F.value(v, x.o.fmt || "auto", x.o.unit || "");
      });
      badgeBox.innerHTML = "";
      (S.badges || []).forEach(function (b) {
        if (!shown(b, sc)) return;
        var txt = evalSafe(b.expr, sc, "");
        if (txt === "" || txt == null || (typeof txt === "number" && isNaN(txt))) return;
        var sp = el("span", "kt-badge kt-badge--" + tone(b.tone ? evalSafe(b.tone, sc, "info") : "info"), String(txt));
        badgeBox.appendChild(sp);
      });
      errBox.hidden = !sc.err;
      if (sc.err) errBox.textContent = "Check the inputs — " + sc.err;
      tables.forEach(function (t) { drawTable(t, sc); });
      if (steps) steps.update(S.steps.filter(function (s) { return typeof s === "string" || shown(s, sc); }).map(function (s) { return KT.interpolate(typeof s === "string" ? s : s.text, sc); }));
      drawPlots();
    }
    function drawTable(tt, sc) {
      var t = tt.t;
      var n = Math.min(400, Math.max(0, Math.round(+evalSafe(t.n, sc, 0))));
      var cols = t.cols || [], tb = tt.tb;
      tb.innerHTML = "";
      var thead = el("thead"), tr = el("tr");
      cols.forEach(function (c) { var th = el("th", null, c.label); th.scope = "col"; if (c.unit) th.appendChild(el("span", "kt-unit", c.unit)); tr.appendChild(th); });
      thead.appendChild(tr); tb.appendChild(thead);
      var body = el("tbody");
      var hl = t.highlight ? t.highlight : null;
      for (var i = 0; i < n; i++) {
        var row = el("tr"), rs = sc.child({ i: i });
        if (hl && E.truthy(evalSafe(hl, rs, 0))) row.className = "is-hl";
        cols.forEach(function (c) { var td = el("td", null, F.value(evalSafe(c.expr, rs), c.fmt || "sig4", "")); row.appendChild(td); });
        body.appendChild(row);
      }
      tb.appendChild(body);
    }
    function sampleX(xa, sc) {
      var lo = +evalSafe(xa.min, sc), hi = +evalSafe(xa.max, sc), n = Math.min(2000, xa.n || 300), out = [];
      if (!(isFinite(lo) && isFinite(hi)) || lo === hi) return [];
      for (var i = 0; i <= n; i++) out.push(xa.log ? lo * Math.pow(hi / lo, i / n) : lo + (hi - lo) * i / n);
      return out;
    }
    function drawPlots() {
      if (!plots.length) return;
      var sc = scope;
      if (S.animate) { sc = scope.child(); sc.v[S.animate["var"] || "T"] = T; }
      plots.forEach(function (pp) {
        var p = pp.p;
        if (!shown(p, sc)) { pp.holder.hidden = true; return; }
        pp.holder.hidden = false;
        if (p.type === "bars") {
          pp.plot.set({ type: "bars", labels: arrOf(Array.isArray(p.labels) ? p.labels : evalSafe(p.labels, sc, [])), values: nums(evalSafe(p.values, sc, [])),
            colors: p.colors ? (Array.isArray(p.colors) ? p.colors : arrOf(evalSafe(p.colors, sc, []))) : null, color: p.color, fmt: p.fmt,
            y: resolveAxis(p.y, sc), x: p.x, ref: (p.ref || []).map(function (r) { return { y: +evalSafe(r.y, sc), label: r.label ? KT.interpolate(r.label, sc) : "" }; }), hint: p.hint });
          return;
        }
        if (p.type === "phasor" || p.type === "argand") {
          var items = [];
          (p.items || []).forEach(function (it) {
            if (!shown(it, sc)) return;
            if (it.many) { // expression giving an array of complex points
              arrOf(evalSafe(it.many, sc, [])).forEach(function (z, i) { items.push({ z: z, label: it.label ? (it.label + (i)) : "", color: it.color, point: it.point, nolegend: it.nolegend }); });
              return;
            }
            var z = evalSafe(it.expr, sc, 0), f0 = it.from ? evalSafe(it.from, sc, 0) : null;
            items.push({ z: z, from: f0, label: it.label, color: it.color, dash: it.dash, unit: it.unit, point: it.point, nolegend: it.nolegend });
          });
          pp.plot.set({ type: p.type, items: items, unit: p.unit, scale: p.scale ? +evalSafe(p.scale, sc) : 0, poly: p.poly ? arrOf(evalSafe(p.poly, sc, [])) : null,
            ring: p.ring ? +evalSafe(p.ring, sc) : 0, hint: p.hint ? KT.interpolate(p.hint, sc) : "" });
          return;
        }
        var xa = p.x || {}, xv = xa["var"] || "x", xs = sampleX(xa, sc), series = [];
        (p.series || []).forEach(function (s, si) {
          if (!shown(s, sc)) return;
          var col = s.color != null ? s.color : si;
          var kind = s.kind || "line";
          if (kind === "vline" || kind === "hline") {
            var at = arrOf(evalSafe(s.at, sc, NaN));
            at.forEach(function (a, ai) { series.push({ kind: kind, x: +a, y: +a, label: s.label ? KT.interpolate(s.label, sc.child({ k: ai })) : "", color: col, row: s.row || 0 }); });
            return;
          }
          var X, Y, Y2 = null;
          if (s.px) { // parametric
            var t0 = +evalSafe(s.t[0], sc), t1 = +evalSafe(s.t[1], sc), n = s.n || 300, tv = s.tvar || "t";
            X = []; Y = [];
            for (var i = 0; i <= n; i++) { var ts = sc.child(); ts.v[tv] = t0 + (t1 - t0) * i / n; X.push(+E.num(evalSafe(s.px, ts))); Y.push(+E.num(evalSafe(s.py, ts))); }
          } else if (s.x != null && s.y != null) {
            X = nums(evalSafe(s.x, sc, [])); Y = nums(evalSafe(s.y, sc, []));
          } else {
            var lo = s.from != null ? +evalSafe(s.from, sc) : -Infinity, hi = s.to != null ? +evalSafe(s.to, sc) : Infinity;
            X = []; Y = [];
            var ast = E.parse(s.expr), ast2 = s.base ? E.parse(s.base) : null, cs = sc.child();
            if (ast2) Y2 = [];
            var list = xs;
            if (s.from != null || s.to != null) { list = xs.filter(function (v) { return v >= lo && v <= hi; }); if (isFinite(lo)) list.unshift(lo); if (isFinite(hi)) list.push(hi); }
            list.forEach(function (x) {
              cs.v[xv] = x;
              var y; try { y = E.evaluate(ast, cs); } catch (e) { y = NaN; }
              X.push(x); Y.push(nums(y)[0]);
              if (ast2) { var y2; try { y2 = E.evaluate(ast2, cs); } catch (e) { y2 = NaN; } Y2.push(nums(y2)[0]); }
            });
          }
          series.push({ kind: kind, x: X, y: Y, y2: Y2, label: s.label ? KT.interpolate(s.label, sc) : "", color: col, dash: s.dash, width: s.width, fill: s.fill, alpha: s.alpha,
            unit: s.unit, nolegend: s.nolegend, nocross: s.nocross, labels: s.labels ? arrOf(evalSafe(s.labels, sc, [])).map(String) : null, colors: s.colors ? arrOf(evalSafe(s.colors, sc, [])) : null });
        });
        var marks = [];
        (p.marks || []).forEach(function (m) {
          if (!shown(m, sc)) return;
          var mx = arrOf(evalSafe(m.x, sc, NaN)), my = arrOf(evalSafe(m.y, sc, NaN));
          mx.forEach(function (v, i) { marks.push({ x: +E.num(v), y: +E.num(my[i] != null ? my[i] : my[0]), label: m.label ? KT.interpolate(m.label, sc.child({ k: i })) : "", color: m.color }); });
        });
        pp.plot.set({ type: "xy", x: Object.assign({}, xa, { min: xa.fixed === false ? null : evalSafe(xa.min, sc, null), max: xa.fixed === false ? null : evalSafe(xa.max, sc, null) }),
          y: resolveAxis(p.y, sc), series: series, marks: marks, hint: p.hint });
      });
    }
    function resolveAxis(a, sc) {
      a = a || {};
      var o = Object.assign({}, a);
      if (a.min != null) o.min = +evalSafe(a.min, sc, null);
      if (a.max != null) o.max = +evalSafe(a.max, sc, null);
      if (o.min != null && !isFinite(o.min)) o.min = null;
      if (o.max != null && !isFinite(o.max)) o.max = null;
      return o;
    }
    update();
    if (S.animate && plots.length) {
      anim = KT.animate(wrap, function (t) { T = t; drawPlots(); }, { still: S.animate.still != null ? S.animate.still : 0.3, speed: S.animate.speed || 1 });
      var bar = el("div", "btn-group kt-animbar");
      bar.appendChild(anim.button);
      wrap.insertBefore(bar, wrap.querySelector(".kt-plots"));
    }
  }
  KT.define("calc", build);
  KT.define("plot", build);
})();
