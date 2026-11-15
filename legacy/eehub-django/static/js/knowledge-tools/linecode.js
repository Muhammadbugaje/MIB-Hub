/* EE Hub — line-code visualiser (Round 7, R7E, course tool for EEEN 401 and data-communication courses).
   settings: {bits: "1011000000001", code: "ami", codes: [...]}  Codes: unrz, nrzl, nrzi, ami, pseudo, manch, dmanch, b8zs, hdb3. */
(function () {
  "use strict";
  var KT = window.KT, el = KT.el;
  var NAMES = { unrz: "Unipolar NRZ", nrzl: "NRZ-L", nrzi: "NRZ-I", ami: "AMI (bipolar)", pseudo: "Pseudoternary", manch: "Manchester (IEEE 802.3)", dmanch: "Differential Manchester", b8zs: "B8ZS", hdb3: "HDB3" };
  // returns {levels: [[l1, l2], ...] per bit (two half-bit levels), tags: per bit "" | "V" | "B"}
  function encode(bits, code) {
    var L = [], tags = [], last = 1, lvl = 1, ones = 0, i;
    var b = bits.split("").map(Number);
    if (code === "unrz") b.forEach(function (x) { L.push([x, x]); tags.push(""); });
    else if (code === "nrzl") b.forEach(function (x) { var v = x ? -1 : 1; L.push([v, v]); tags.push(""); });       // 0 → +, 1 → − (Forouzan)
    else if (code === "nrzi") b.forEach(function (x) { if (x) lvl = -lvl; L.push([lvl, lvl]); tags.push(""); });
    else if (code === "manch") b.forEach(function (x) { L.push(x ? [-1, 1] : [1, -1]); tags.push(""); });         // IEEE 802.3: 1 = low→high
    else if (code === "dmanch") { var cur = 1; b.forEach(function (x) { if (!x) cur = -cur; L.push([cur, -cur]); cur = -cur; tags.push(""); }); }
    else if (code === "pseudo") { last = -1; b.forEach(function (x) { if (!x) { last = -last; L.push([last, last]); } else L.push([0, 0]); tags.push(""); }); }
    else {
      // AMI family: last = polarity of the last non-zero pulse
      last = -1;
      for (i = 0; i < b.length; i++) {
        if (code === "b8zs" && b.slice(i, i + 8).join("") === "00000000" && i + 8 <= b.length) {
          var p = last; // 000VB0VB
          var seq = [0, 0, 0, p, -p, 0, -p, p], tg = ["", "", "", "V", "B", "", "V", "B"];
          for (var k = 0; k < 8; k++) { L.push([seq[k], seq[k]]); tags.push(tg[k]); }
          last = p; i += 7; continue;
        }
        if (code === "hdb3" && b.slice(i, i + 4).join("") === "0000" && i + 4 <= b.length) {
          var v;
          if (ones % 2 === 1) { v = last; L.push([0, 0], [0, 0], [0, 0], [v, v]); tags.push("", "", "", "V"); }      // odd: 000V
          else { var B = -last; v = B; L.push([B, B], [0, 0], [0, 0], [v, v]); tags.push("B", "", "", "V"); }          // even: B00V
          last = v; ones = 0; i += 3; continue;
        }
        if (b[i]) { last = -last; L.push([last, last]); tags.push(""); ones++; } else { L.push([0, 0]); tags.push(""); }
      }
    }
    return { levels: L, tags: tags };
  }
  KT.linecode = { encode: encode };
  function build(mount, S) {
    var bits = S.bits || "101100000000101", code = S.code || "ami", codes = S.codes || Object.keys(NAMES);
    var wrap = el("div", "kt-linecode");
    var row = el("div", "kt-row");
    var t = KT.ui.text({ label: "Bit string (0 and 1, up to 40)", value: bits }, function (v) { bits = v; draw(); }); t.classList.add("kt-field"); row.appendChild(t);
    wrap.appendChild(row);
    var opts = codes.map(function (c) { return [c, NAMES[c]]; });
    wrap.appendChild(KT.ui.select({ label: "Line code", options: opts, value: code }, function (v) { code = v; draw(); }));
    var cell = el("div", "kt-plots"); wrap.appendChild(cell);
    var plot = new KT.Plot(cell, { title: "Waveform", aria: "Line-code waveform", aspect: 0.32, minh: 200, maxh: 280 });
    var dl = el("dl", "kt-readouts"); wrap.appendChild(dl);
    var err = el("p", "kt-error"); err.hidden = true; wrap.appendChild(err);
    mount.appendChild(wrap);
    function draw() {
      var b = String(bits).replace(/\s+/g, "");
      if (!/^[01]{1,40}$/.test(b)) { err.hidden = false; err.textContent = "Use only 0 and 1 (up to 40 bits)."; return; }
      err.hidden = true;
      var r = encode(b, code), n = b.length;
      plot.set({ type: "custom", draw: function (x, w, h, c, P) {
        var L = 30, R = 10, T = 26, B = 22, pw = w - L - R, ph = h - T - B, bw = pw / n;
        var Y = function (v) { return T + ph / 2 - v * ph * 0.38; };
        x.fillStyle = c.bg; x.fillRect(L, T, pw, ph);
        x.strokeStyle = c.grid; x.lineWidth = 1; x.beginPath();
        for (var i = 0; i <= n; i++) { x.moveTo(L + i * bw + 0.5, T); x.lineTo(L + i * bw + 0.5, T + ph); }
        x.stroke();
        x.strokeStyle = c.axis; x.beginPath(); x.moveTo(L, Y(0)); x.lineTo(L + pw, Y(0)); x.stroke();
        x.fillStyle = c.dim; x.font = "600 11px " + c.font; x.textAlign = "right"; x.textBaseline = "middle";
        x.fillText("+V", L - 4, Y(1)); x.fillText("0", L - 4, Y(0)); x.fillText("−V", L - 4, Y(-1));
        x.textAlign = "center"; x.font = "800 " + (bw < 16 ? 10 : 13) + "px " + c.mono;
        for (i = 0; i < n; i++) { x.fillStyle = c.ink; x.fillText(b[i], L + (i + 0.5) * bw, T - 12); if (r.tags[i]) { x.fillStyle = r.tags[i] === "V" ? c.ser[3] : c.ser[4]; x.fillText(r.tags[i], L + (i + 0.5) * bw, T + ph + 12); } }
        x.lineWidth = 2.6; x.lineJoin = "miter";
        var prev = null;
        for (i = 0; i < n; i++) {
          for (var hf = 0; hf < 2; hf++) {
            var v = r.levels[i][hf], x0 = L + (i + hf / 2) * bw, x1 = x0 + bw / 2;
            x.strokeStyle = r.tags[i] ? (r.tags[i] === "V" ? c.ser[3] : c.ser[4]) : c.ser[0];
            x.beginPath(); if (prev != null) { x.moveTo(x0, Y(prev)); x.lineTo(x0, Y(v)); } else x.moveTo(x0, Y(v)); x.lineTo(x1, Y(v)); x.stroke();
            prev = v;
          }
        }
        P.readout.textContent = (code === "b8zs" || code === "hdb3") ? "V = bipolar violation (same polarity as the previous pulse), B = balancing pulse." : "";
      } });
      var levels = [].concat.apply([], r.levels), dc = levels.reduce(function (a, v) { return a + v; }, 0) / levels.length, trans = 0;
      for (var i = 1; i < levels.length; i++) if (levels[i] !== levels[i - 1]) trans++;
      var longest = 0, run = 0; for (i = 0; i < r.levels.length; i++) { if (r.levels[i][0] === r.levels[i][1] && (i === 0 || r.levels[i][0] === r.levels[i - 1][1])) { run++; longest = Math.max(longest, run); } else run = 1; }
      dl.innerHTML = "";
      [["DC level (average, in V units)", (Math.round(dc * 1000) / 1000).toString()], ["Transitions", String(trans)], ["Longest flat run", longest + " bit" + (longest === 1 ? "" : "s") + (longest > 4 ? " — risk of losing clock sync" : "")],
        ["Signal levels used", code === "unrz" ? "2 (0, +V)" : /ami|pseudo|b8zs|hdb3/.test(code) ? "3 (−V, 0, +V)" : "2 (−V, +V)"]].forEach(function (p) { var c2 = el("div", "kt-readout"); c2.appendChild(el("dt", null, p[0])); c2.appendChild(el("dd", null, p[1])); dl.appendChild(c2); });
    }
    draw();
  }
  KT.define("linecode", build);
})();
