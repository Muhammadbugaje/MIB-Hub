/* EE Hub — sort and match game (Round 7, R7E, shared tool).
   settings: {mode: "bins", bins: ["Internal", "External"], items: [["Staff skills", 0, "why"], ...]}
          or {mode: "order", items: ["first", "second", ...]}  (shown shuffled; put them in order)
   Tap a card, then tap a group (works with keyboard and screen readers); "Check" marks each card. */
(function () {
  "use strict";
  var KT = window.KT, el = KT.el;
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function build(mount, S) {
    var wrap = el("div", "kt-sorter"); mount.appendChild(wrap);
    var fb = el("p", "kt-note"); fb.setAttribute("aria-live", "polite");
    if (S.mode === "order") {
      var items = (S.items || []).map(function (t, i) { return { t: t, i: i }; }), cur = shuffle(items);
      var ol = el("ol", "kt-check"); wrap.appendChild(ol);
      var draw = function (marks) {
        ol.innerHTML = "";
        cur.forEach(function (it, k) {
          var li = el("li"), row = el("div", "kt-row"), lab = el("span", "kt-chipbtn" + (marks ? (it.i === k ? " is-ok" : " is-bad") : ""), (k + 1) + ". " + it.t);
          lab.style.flex = "1 1 200px";
          var up = el("button", "kt-iconbtn", "↑"), dn = el("button", "kt-iconbtn", "↓"); up.type = dn.type = "button";
          up.setAttribute("aria-label", "Move '" + it.t + "' up"); dn.setAttribute("aria-label", "Move '" + it.t + "' down");
          up.disabled = k === 0; dn.disabled = k === cur.length - 1;
          up.addEventListener("click", function () { var t = cur[k - 1]; cur[k - 1] = cur[k]; cur[k] = t; draw(); up.focus(); });
          dn.addEventListener("click", function () { var t = cur[k + 1]; cur[k + 1] = cur[k]; cur[k] = t; draw(); });
          row.appendChild(lab); var g = el("div", "btn-group"); g.appendChild(up); g.appendChild(dn); row.appendChild(g); li.appendChild(row); ol.appendChild(li);
        });
      };
      draw();
      var bg = el("div", "btn-group"), chk = el("button", "kt-btn", "Check the order"), sh = el("button", "kt-btn kt-btn--ghost", "Shuffle again"), ans = el("button", "kt-btn kt-btn--ghost", "Show the answer");
      chk.type = sh.type = ans.type = "button";
      chk.addEventListener("click", function () { var ok = cur.filter(function (it, k) { return it.i === k; }).length; draw(true); fb.textContent = ok + " of " + cur.length + " in the right place." + (ok === cur.length ? " Perfect!" : ""); });
      sh.addEventListener("click", function () { cur = shuffle(items); fb.textContent = ""; draw(); });
      ans.addEventListener("click", function () { cur = items.slice(); draw(true); fb.textContent = "This is the correct order."; });
      bg.appendChild(chk); bg.appendChild(sh); bg.appendChild(ans); wrap.appendChild(bg); wrap.appendChild(fb);
      return;
    }
    var bins = S.bins || [], cards = shuffle((S.items || []).map(function (x, i) { return { t: x[0], bin: x[1], why: x[2] || "", i: i, at: -1 }; }));
    var pool = el("div", "kt-pool"), sel = null;
    wrap.appendChild(el("p", "kt-note", "Tap a card, then tap the group it belongs to."));
    wrap.appendChild(pool);
    var binEls = bins.map(function (b, k) {
      var box = el("div", "kt-bin"), h = el("button", "kt-bin__h", b); h.type = "button";
      h.addEventListener("click", function () { if (!sel) { fb.textContent = "Pick a card first."; return; } sel.at = k; sel = null; draw(); });
      box.appendChild(h); return box;
    });
    var bw = el("div", "kt-bins"); binEls.forEach(function (b) { bw.appendChild(b); }); wrap.appendChild(bw);
    var marks = false;
    function chip(c) {
      var b = el("button", "kt-chipbtn" + (marks && c.at >= 0 ? (c.at === c.bin ? " is-ok" : " is-bad") : ""), c.t); b.type = "button";
      b.setAttribute("aria-pressed", String(sel === c));
      b.addEventListener("click", function () { sel = sel === c ? null : c; marks = false; draw(); });
      return b;
    }
    function draw() {
      pool.innerHTML = ""; binEls.forEach(function (b) { while (b.children.length > 1) b.removeChild(b.lastChild); b.classList.toggle("is-target", !!sel); });
      cards.forEach(function (c) { (c.at < 0 ? pool : binEls[c.at]).appendChild(chip(c)); });
      if (!cards.some(function (c) { return c.at < 0; })) pool.appendChild(el("span", "kt-note", "All cards placed — press Check."));
    }
    draw();
    var bg2 = el("div", "btn-group"), ck = el("button", "kt-btn", "Check"), rs = el("button", "kt-btn kt-btn--ghost", "Start again");
    ck.type = rs.type = "button";
    ck.addEventListener("click", function () {
      marks = true; draw();
      var placed = cards.filter(function (c) { return c.at >= 0; }), ok = placed.filter(function (c) { return c.at === c.bin; });
      var wrong = placed.filter(function (c) { return c.at !== c.bin; });
      fb.textContent = ok.length + " of " + cards.length + " correct." + (wrong.length ? " Fix: " + wrong.slice(0, 3).map(function (c) { return "“" + c.t + "” belongs in " + bins[c.bin] + (c.why ? " (" + c.why + ")" : ""); }).join("; ") + "." : ok.length === cards.length ? " Excellent!" : "");
    });
    rs.addEventListener("click", function () { cards = shuffle(cards); cards.forEach(function (c) { c.at = -1; }); marks = false; sel = null; fb.textContent = ""; draw(); });
    bg2.appendChild(ck); bg2.appendChild(rs); wrap.appendChild(bg2); wrap.appendChild(fb);
  }
  KT.define("sorter", build);
})();
