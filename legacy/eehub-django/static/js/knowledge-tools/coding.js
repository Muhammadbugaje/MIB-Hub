/* EE Hub — CRC and Hamming(7,4) step solver (Round 7, R7E, course tool for EEEN 342/401).
   settings: {data: "1101011011", gen: "10011", word: "1011"} */
(function () {
  "use strict";
  var KT = window.KT, el = KT.el;
  function crc(data, gen) {
    var r = gen.length - 1, d = (data + "0".repeat(r)).split("").map(Number), g = gen.split("").map(Number), steps = [];
    for (var i = 0; i + r < d.length; i++) {
      if (!d[i]) continue;
      var before = d.slice(i, i + g.length).join("");
      for (var k = 0; k < g.length; k++) d[i + k] ^= g[k];
      steps.push({ at: i, before: before, after: d.slice(i, i + g.length).join("") });
    }
    var rem = d.slice(d.length - r).join("");
    return { rem: rem, frame: data + rem, steps: steps };
  }
  function hamming(word) { // positions 1..7: p1 p2 d1 p4 d2 d3 d4 (even parity)
    var d = word.split("").map(Number), c = [0, 0, d[0], 0, d[1], d[2], d[3]];
    c[0] = c[2] ^ c[4] ^ c[6]; c[1] = c[2] ^ c[5] ^ c[6]; c[3] = c[4] ^ c[5] ^ c[6];
    return c;
  }
  function syndrome(c) { var s1 = c[0] ^ c[2] ^ c[4] ^ c[6], s2 = c[1] ^ c[2] ^ c[5] ^ c[6], s4 = c[3] ^ c[4] ^ c[5] ^ c[6]; return s4 * 4 + s2 * 2 + s1; }
  KT.coding = { crc: crc, hamming: hamming, syndrome: syndrome };
  function build(mount, S) {
    var data = S.data || "1101011011", gen = S.gen || "10011", word = S.word || "1011";
    var wrap = el("div", "kt-coding");
    var s1 = el("div", "kt-steps"); s1.appendChild(el("b", null, "CRC: mod-2 long division"));
    var r1 = el("div", "kt-row");
    var fa = KT.ui.text({ label: "Data bits", value: data }, function (v) { data = v; doCrc(); }), fb = KT.ui.text({ label: "Generator G(x) bits", value: gen }, function (v) { gen = v; doCrc(); });
    fa.classList.add("kt-field"); fb.classList.add("kt-field"); r1.appendChild(fa); r1.appendChild(fb); s1.appendChild(r1);
    var o1 = el("pre", "kt-out"); o1.setAttribute("aria-live", "polite"); s1.appendChild(o1);
    wrap.appendChild(s1);
    var s2 = el("div", "kt-steps"); s2.appendChild(el("b", null, "Hamming (7,4): encode, flip a bit, find it"));
    var fw = KT.ui.text({ label: "4 data bits", value: word }, function (v) { word = v; flipped = -1; doHam(); }); fw.classList.add("kt-field"); s2.appendChild(fw);
    var bits = el("div", "kt-bits"), o2 = el("p", "kt-out"); o2.setAttribute("aria-live", "polite");
    s2.appendChild(el("p", "kt-note", "Tap a bit to flip it (simulate a channel error).")); s2.appendChild(bits); s2.appendChild(o2);
    wrap.appendChild(s2);
    mount.appendChild(wrap);
    var flipped = -1;
    function doCrc() {
      if (!/^[01]+$/.test(data) || !/^1[01]+$/.test(gen) || data.length > 40 || gen.length > 17) { o1.textContent = "Use 0/1 only; the generator must start with 1 (up to 17 bits)."; return; }
      var r = crc(data, gen), pad = data + "0".repeat(gen.length - 1), lines = ["Append " + (gen.length - 1) + " zeros:  " + pad];
      r.steps.forEach(function (s) { lines.push(" ".repeat(20 + s.at) + s.before); lines.push(" ".repeat(18 + s.at) + "⊕ " + gen); lines.push(" ".repeat(20 + s.at) + s.after + "   (XOR)"); });
      lines.push("Remainder (CRC) = " + r.rem);
      lines.push("Transmitted frame = data + CRC = " + r.frame);
      var chk = crc(r.frame, gen).rem;
      lines.push("Receiver check: frame ÷ G leaves " + chk + (/^0+$/.test(chk) ? " → no error detected." : " → error!"));
      o1.textContent = lines.join("\n");
    }
    function doHam() {
      bits.innerHTML = "";
      if (!/^[01]{4}$/.test(word)) { o2.textContent = "Type exactly 4 bits."; return; }
      var c = hamming(word), rx = c.slice(); if (flipped >= 0) rx[flipped] ^= 1;
      var names = ["p1", "p2", "d1", "p4", "d2", "d3", "d4"];
      rx.forEach(function (b, i) {
        var bt = el("button"); bt.type = "button"; bt.textContent = String(b);
        bt.className = (i === 0 ? "p1" : i === 1 ? "p2" : i === 3 ? "p4" : "") + (i === flipped ? " err" : "");
        bt.setAttribute("aria-label", "Bit " + (i + 1) + " (" + names[i] + ") = " + b + ". Press to flip.");
        bt.title = names[i];
        bt.addEventListener("click", function () { flipped = flipped === i ? -1 : i; doHam(); });
        var w = el("div"); w.style.display = "grid"; w.style.justifyItems = "center"; w.appendChild(bt); w.appendChild(el("small", "kt-kbd", (i + 1) + " " + names[i]));
        bits.appendChild(w);
      });
      var s = syndrome(rx);
      o2.textContent = "Codeword sent: " + c.join("") + "   (p1 = d1⊕d2⊕d4, p2 = d1⊕d3⊕d4, p4 = d2⊕d3⊕d4)\nReceived: " + rx.join("") + "\nSyndrome s4 s2 s1 = " + s.toString(2).padStart(3, "0") + " = " + s + (s ? " → bit " + s + " is wrong; flip it back to correct." : " → no error.");
    }
    doCrc(); doHam();
  }
  KT.define("coding", build);
})();
