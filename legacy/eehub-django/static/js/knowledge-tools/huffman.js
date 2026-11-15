/* EE Hub — entropy and Huffman coder (Round 7, R7E, course tool for EEEN 401).
   settings: {symbols: "A,B,C,D,E", probs: "0.4,0.2,0.2,0.1,0.1", rate: 1000} */
(function () {
  "use strict";
  var KT = window.KT, el = KT.el, F = KT.fmt;
  function huffman(p) {
    var nodes = p.map(function (x, i) { return { p: x, s: [i] }; }), code = p.map(function () { return ""; }), steps = [];
    if (p.length === 1) return { code: ["0"], steps: [] };
    while (nodes.length > 1) {
      nodes.sort(function (a, b) { return a.p - b.p || b.s.length - a.s.length; });
      var a = nodes.shift(), b = nodes.shift();
      a.s.forEach(function (i) { code[i] = "1" + code[i]; }); b.s.forEach(function (i) { code[i] = "0" + code[i]; });
      steps.push([a, b]);
      nodes.push({ p: a.p + b.p, s: b.s.concat(a.s) });
    }
    return { code: code, steps: steps };
  }
  KT.huffman = huffman;
  function build(mount, S) {
    var sy = S.symbols || "A,B,C,D,E", pr = S.probs || "0.4,0.2,0.2,0.1,0.1", rate = S.rate || 1000;
    var wrap = el("div", "kt-huffman"), row = el("div", "kt-row");
    var f1 = KT.ui.text({ label: "Symbols (comma separated, up to 8)", value: sy }, function (v) { sy = v; run(); }); f1.classList.add("kt-field");
    var f2 = KT.ui.text({ label: "Probabilities (sum to 1)", value: pr }, function (v) { pr = v; run(); }); f2.classList.add("kt-field");
    var f3 = KT.ui.text({ label: "Symbol rate r (symbols/s)", value: String(rate) }, function (v) { rate = +v; run(); }); f3.classList.add("kt-field");
    row.appendChild(f1); row.appendChild(f2); row.appendChild(f3); wrap.appendChild(row);
    var dl = el("dl", "kt-readouts"), err = el("p", "kt-error"), tb = el("div", "kt-tablebox"), steps = KT.Steps("Merge steps (two least likely first)");
    err.hidden = true; wrap.appendChild(err); wrap.appendChild(dl); wrap.appendChild(tb); wrap.appendChild(steps.el);
    mount.appendChild(wrap);
    function run() {
      var s = sy.split(",").map(function (x) { return x.trim(); }).filter(Boolean), p = pr.split(",").map(function (x) { return +KT.expr.num(KT.expr.run(x.trim() || "0")); });
      dl.innerHTML = ""; tb.innerHTML = ""; err.hidden = true;
      if (s.length !== p.length || s.length < 2 || s.length > 8) { err.hidden = false; err.textContent = "Give 2 to 8 symbols and the same number of probabilities."; return; }
      var sum = p.reduce(function (a, b) { return a + b; }, 0);
      if (Math.abs(sum - 1) > 1e-6 || p.some(function (x) { return !(x > 0); })) { err.hidden = false; err.textContent = "The probabilities must be positive and add up to 1 (now " + F.sig(sum, 6) + ")."; return; }
      var h = huffman(p), H = 0, Lb = 0;
      p.forEach(function (x, i) { H -= x * Math.log2(x); Lb += x * h.code[i].length; });
      [["Entropy H", F.sig(H, 5) + " bits/symbol"], ["Average length L̄", F.sig(Lb, 5) + " bits/symbol"], ["Efficiency η = H/L̄", F.sig(H / Lb * 100, 4) + " %"], ["Redundancy 1 − η", F.sig((1 - H / Lb) * 100, 4) + " %"], ["Information rate R = rH", F.value(rate * H, "eng", "bit/s")], ["Coded bit rate r·L̄", F.value(rate * Lb, "eng", "bit/s")]].forEach(function (q, i) {
        var c = el("div", "kt-readout" + (i === 2 ? " kt-readout--big" : "")); c.appendChild(el("dt", null, q[0])); c.appendChild(el("dd", null, q[1])); dl.appendChild(c);
      });
      var tw = el("div", "kt-tablewrap"), t = el("table", "kt-table"), hr = el("tr");
      ["Symbol", "p", "−log₂ p", "Codeword", "Length"].forEach(function (x) { var th = el("th", null, x); th.scope = "col"; hr.appendChild(th); });
      var th = el("thead"); th.appendChild(hr); t.appendChild(th); var body = el("tbody");
      s.forEach(function (x, i) { var r = el("tr"); [x, F.sig(p[i], 4), F.sig(-Math.log2(p[i]), 4), h.code[i], String(h.code[i].length)].forEach(function (v) { r.appendChild(el("td", null, v)); }); body.appendChild(r); });
      t.appendChild(body); tw.appendChild(t); tb.appendChild(tw);
      steps.update(h.steps.map(function (st, k) { var nm = function (n) { return "{" + n.s.map(function (i) { return s[i]; }).join("") + "} " + F.sig(n.p, 4); }; return "Merge " + nm(st[0]) + " (bit 1) with " + nm(st[1]) + " (bit 0) → " + F.sig(st[0].p + st[1].p, 4); }).concat(["Read each codeword from the root down to the symbol."]));
    }
    run();
  }
  KT.define("huffman", build);
})();
