/* EE Hub — number base converter and two's-complement lab (Round 7, R7E, shared tool K8).
   settings: {value: "45.625", from: 10, frac_bits: 8, codes: true, twos: true, bits: 8, ascii: true} */
(function () {
  "use strict";
  var KT = window.KT, el = KT.el;
  var DIG = "0123456789ABCDEF";

  function parseIn(s, base) {
    s = String(s || "").trim().toUpperCase().replace(/[\s_]/g, "");
    var neg = s[0] === "-"; if (neg) s = s.slice(1);
    var parts = s.split("."), ip = parts[0] || "0", fp = parts[1] || "", v = 0;
    for (var i = 0; i < ip.length; i++) { var d = DIG.indexOf(ip[i]); if (d < 0 || d >= base) throw new Error("'" + ip[i] + "' is not a base-" + base + " digit"); v = v * base + d; }
    var f = 0, p = 1 / base;
    for (i = 0; i < fp.length; i++) { d = DIG.indexOf(fp[i]); if (d < 0 || d >= base) throw new Error("'" + fp[i] + "' is not a base-" + base + " digit"); f += d * p; p /= base; }
    return (neg ? -1 : 1) * (v + f);
  }
  function toBase(x, base, fbits) {
    var neg = x < 0; x = Math.abs(x);
    var ip = Math.floor(x), fp = x - ip, s = ip.toString(base).toUpperCase(), steps = [], fsteps = [];
    var q = ip; if (q === 0) steps.push("0"); while (q > 0) { steps.push(q + " ÷ " + base + " = " + Math.floor(q / base) + " r " + DIG[q % base]); q = Math.floor(q / base); }
    if (fp > 0) {
      var out = "", k = 0;
      while (fp > 1e-12 && k < (fbits || 8)) { var y = fp * base, d = Math.floor(y + 1e-12); fsteps.push(fp.toPrecision(6).replace(/0+$/, "") + " × " + base + " = " + y.toPrecision(6).replace(/\.?0+$/, "") + " → " + DIG[d]); out += DIG[d]; fp = y - d; k++; }
      s += "." + out + (fp > 1e-12 ? "…" : "");
    }
    return { s: (neg ? "−" : "") + s, steps: steps, fsteps: fsteps };
  }
  function bcd(n) { return String(Math.floor(Math.abs(n))).split("").map(function (d) { return (+d).toString(2).padStart(4, "0"); }).join(" "); }
  function xs3(n) { return String(Math.floor(Math.abs(n))).split("").map(function (d) { return (+d + 3).toString(2).padStart(4, "0"); }).join(" "); }
  function gray(n) { n = Math.floor(Math.abs(n)); return (n ^ (n >> 1)).toString(2); }
  function fromGray(g) { var n = 0; for (var i = 0; i < g.length; i++) n = (n << 1) | (+g[i] ^ (n & 1)); return n; }
  function twos(v, w) { var m = Math.pow(2, w); v = ((v % m) + m) % m; return v.toString(2).padStart(w, "0"); }
  KT.base = { parse: parseIn, to: toBase, bcd: bcd, xs3: xs3, gray: gray, fromGray: fromGray, twos: twos };

  function build(mount, S) {
    var wrap = el("div", "kt-base"), from = S.from || 10, fb = S.frac_bits || 8, val = S.value != null ? String(S.value) : "45.625";
    var row = el("div", "kt-row");
    var inp = KT.ui.text({ label: "Number", value: val }, function (v) { val = v; run(); }); inp.classList.add("kt-field");
    row.appendChild(inp);
    var opts = [[2, "Binary"], [8, "Octal"], [10, "Decimal"], [16, "Hex"]];
    if (S.codes !== false) opts.push(["bcd", "BCD"], ["gray", "Gray"], ["xs3", "Excess-3"]);
    row.appendChild(KT.ui.select({ label: "It is written in", options: opts, value: from }, function (v) { from = v; run(); }));
    wrap.appendChild(row);
    var dl = el("dl", "kt-readouts"); wrap.appendChild(dl);
    var err = el("p", "kt-error"); err.hidden = true; wrap.appendChild(err);
    var steps = KT.Steps("Conversion working"); wrap.appendChild(steps.el);
    mount.appendChild(wrap);
    function card(k, v, big) { var x = el("div", "kt-readout" + (big ? " kt-readout--big" : "")); x.appendChild(el("dt", null, k)); x.appendChild(el("dd", null, v)); dl.appendChild(x); }
    function group(s, n) { var p = s.split("."), i = p[0].replace(/^−/, ""), out = ""; while (i.length > n) { out = " " + i.slice(-n) + out; i = i.slice(0, -n); } return (p[0][0] === "−" ? "−" : "") + i + out + (p[1] ? "." + p[1].replace(new RegExp("(.{" + n + "})", "g"), "$1 ").trim() : ""); }
    function run() {
      dl.innerHTML = ""; err.hidden = true;
      var x;
      try {
        if (from === "bcd" || from === "xs3") { var g = val.replace(/\s+/g, ""); if (g.length % 4) throw new Error("use groups of 4 bits"); x = +g.match(/.{4}/g).map(function (q) { var d = parseInt(q, 2) - (from === "xs3" ? 3 : 0); if (d < 0 || d > 9) throw new Error(q + " is not a valid code group"); return d; }).join(""); }
        else if (from === "gray") { if (!/^[01]+$/.test(val.trim())) throw new Error("Gray code uses 0 and 1"); x = fromGray(val.trim()); }
        else x = parseIn(val, +from);
        if (!isFinite(x)) throw new Error("not a number");
      } catch (e) { err.hidden = false; err.textContent = "Check the number — " + e.message; steps.update([]); return; }
      var b = toBase(x, 2, fb), o = toBase(x, 8, Math.ceil(fb / 3)), h = toBase(x, 16, Math.ceil(fb / 4));
      card("Decimal", String(+x.toPrecision(15)), true);
      card("Binary", group(b.s, 4)); card("Octal", o.s); card("Hexadecimal", h.s);
      if (S.codes !== false && x >= 0) { card("BCD (8421)", bcd(x)); card("Excess-3", xs3(x)); card("Gray code (integer part)", gray(x)); }
      if (S.ascii !== false && Number.isInteger(x) && x >= 32 && x < 127) card("ASCII character", "'" + String.fromCharCode(x) + "'");
      if (S.twos !== false && Number.isInteger(x) && Math.abs(x) < 32768) {
        var w = Math.abs(x) < 128 ? 8 : 16;
        card(w + "-bit two's complement", x >= 0 ? twos(x, w) : twos(x, w) + "  (invert " + twos(-x, w) + " → " + twos(~(-x), w) + ", add 1)");
      }
      var st = [];
      if (+from !== 10 && from !== "bcd" && from !== "xs3" && from !== "gray") st.push("To decimal: Σ dᵢ × " + from + "^i = " + (+x.toPrecision(15)));
      st.push("Integer part to binary — divide by 2, read the remainders upward:");
      b.steps.slice(0, 16).forEach(function (s) { st.push("   " + s); });
      if (b.fsteps.length) { st.push("Fraction part — multiply by 2, read the carries downward:"); b.fsteps.forEach(function (s) { st.push("   " + s); }); }
      st.push("Octal = group the binary in 3s from the point; hex = group in 4s.");
      steps.update(st);
    }
    run();
    if (S.twos !== false) {
      var lab = el("div", "kt-steps"), head = el("div", "kt-steps__head"); head.appendChild(el("b", null, "Two's-complement adder (8 bits)")); lab.appendChild(head);
      var r2 = el("div", "kt-row"), a = -45, bb = 23, op = "+";
      var fa = KT.ui.text({ label: "A (−128 … 127)", value: String(a) }, function (v) { a = parseInt(v, 10); add(); }); fa.classList.add("kt-field");
      var fbx = KT.ui.text({ label: "B (−128 … 127)", value: String(bb) }, function (v) { bb = parseInt(v, 10); add(); }); fbx.classList.add("kt-field");
      r2.appendChild(fa); r2.appendChild(KT.ui.select({ label: "Operation", options: [["+", "A + B"], ["-", "A − B"]], value: "+" }, function (v) { op = v; add(); })); r2.appendChild(fbx);
      lab.appendChild(r2);
      var o2 = el("pre", "kt-out"); o2.setAttribute("aria-live", "polite"); lab.appendChild(o2);
      wrap.appendChild(lab);
      function add() {
        if (!(a >= -128 && a <= 127 && bb >= -128 && bb <= 127)) { o2.textContent = "Both numbers must be between −128 and 127."; return; }
        var B = op === "+" ? bb : -bb, ab = twos(a, 8), bbits = twos(B, 8), carry = 0, sum = "", cs = "";
        for (var i = 7; i >= 0; i--) { var s = +ab[i] + +bbits[i] + carry; sum = (s & 1) + sum; carry = s >> 1; cs = carry + cs; }
        var res = parseInt(sum, 2); if (res > 127) res -= 256;
        var ovf = (a >= 0) === (B >= 0) && (res >= 0) !== (a >= 0);
        o2.textContent = "carries  " + cs + "\n  A      " + ab + "   (" + a + ")\n" + (op === "-" ? "−B → +(" + (-bb) + ")  " : "+ B      ") + bbits + "   (" + B + ")\n         --------\n  sum    " + sum + "   (" + res + ")" +
          "\nCarry out of bit 7 = " + carry + " (ignored).  Overflow: " + (ovf ? "YES — the true answer " + (a + B) + " does not fit in 8 bits" : "no") +
          "\nSign-magnitude of A: " + (a < 0 ? "1" : "0") + twos(Math.abs(a), 7) + "   one's complement: " + (a < 0 ? twos(~(-a), 8).replace(/./g, function (c) { return c; }) : ab);
      }
      add();
    }
  }
  KT.define("base", build);
})();
