/* EE Hub — flashcards (Round 7, R7E, shared tool). settings: {cards: [[front, back, tag?], ...], title_front, shuffle: true, timer: 0}
   Without settings.cards the deck comes from the page (key concepts and cheat codes, rendered by the template).
   "I know this" is remembered in this browser only (localStorage, best effort). */
(function () {
  "use strict";
  var KT = window.KT, el = KT.el;
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null"); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function build(mount, S, root) {
    var cards = (S.cards || []).map(function (c) { return { f: c[0], b: c[1], t: c[2] || "" }; });
    if (!cards.length) Array.prototype.forEach.call(root.querySelectorAll("[data-kt-cards] li"), function (li) { cards.push({ f: li.querySelector("b").textContent, b: li.querySelector("span").textContent, t: li.getAttribute("data-tag") || "" }); });
    if (!cards.length) { mount.appendChild(el("p", "kt-note", "No cards yet: add key concepts or cheat codes to this page.")); return; }
    var key = "kt-cards-" + (root.getAttribute("data-settings-id") || "") + "-" + cards.length, known = store(key) || {};
    var order = cards.map(function (_, i) { return i; }), pos = 0, onlyNew = false;
    var wrap = el("div", "kt-cards");
    var bar = el("div", "kt-row");
    var count = el("span", "kt-badge kt-badge--info"); bar.appendChild(count);
    var tags = cards.map(function (c) { return c.t; }).filter(function (t, i, a) { return t && a.indexOf(t) === i; }), tag = "";
    if (tags.length > 1) bar.appendChild(KT.ui.select({ label: "Topic", options: [["", "All"]].concat(tags.map(function (t) { return [t, t]; })), value: "" }, function (v) { tag = v; pos = 0; rebuild(); }));
    wrap.appendChild(bar);
    var card = el("div", "kt-card"), inner = el("button", "kt-card__in"); inner.type = "button";
    var front = el("div", "kt-card__f"), back = el("div", "kt-card__b");
    inner.appendChild(front); inner.appendChild(back); card.appendChild(inner); wrap.appendChild(card);
    var live = el("p", "kt-sr"); live.setAttribute("aria-live", "polite"); wrap.appendChild(live);
    var bg = el("div", "btn-group");
    function btn(t, f, ghost) { var b = el("button", "kt-btn" + (ghost ? " kt-btn--ghost" : ""), t); b.type = "button"; b.addEventListener("click", f); bg.appendChild(b); return b; }
    btn("← Back", function () { go(-1); }, true);
    var flipB = btn("Flip", flip, true);
    var knowB = btn("I know this", function () { var i = order[pos]; known[i] = !known[i]; store(key, known); paint(); if (known[i]) go(1); });
    btn("Next →", function () { go(1); }, true);
    btn("Shuffle", function () { for (var i = order.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = order[i]; order[i] = order[j]; order[j] = t; } pos = 0; paint(); }, true);
    var newB = btn("Only cards I don't know", function () { onlyNew = !onlyNew; newB.setAttribute("aria-pressed", String(onlyNew)); pos = 0; rebuild(); }, true);
    newB.setAttribute("aria-pressed", "false");
    wrap.appendChild(bg);
    mount.appendChild(wrap);
    var base = order.slice();
    function rebuild() { order = base.filter(function (i) { return (!tag || cards[i].t === tag) && (!onlyNew || !known[i]); }); if (!order.length) order = base.slice(); pos = 0; paint(); }
    function flip() { card.classList.toggle("is-flipped"); live.textContent = card.classList.contains("is-flipped") ? "Answer: " + cards[order[pos]].b : "Question: " + cards[order[pos]].f; }
    function go(d) { pos = (pos + d + order.length) % order.length; card.classList.remove("is-flipped"); paint(); }
    function paint() {
      var c = cards[order[pos]];
      front.innerHTML = ""; back.innerHTML = "";
      front.appendChild(el("small", null, (S.title_front || "Question") + " " + (pos + 1) + " / " + order.length + (c.t ? " · " + c.t : "")));
      var fb = el("b", "kx", c.f); front.appendChild(fb); front.appendChild(el("small", null, "Tap to flip"));
      back.appendChild(el("small", null, S.title_back || "Answer"));
      back.appendChild(el("p", "kx", c.b));
      var k = Object.keys(known).filter(function (i) { return known[i]; }).length;
      count.textContent = "Known " + k + " / " + cards.length;
      knowB.textContent = known[order[pos]] ? "✓ Known (undo)" : "I know this";
      inner.setAttribute("aria-label", "Card " + (pos + 1) + ": " + c.f + ". Press to flip.");
      if (window.renderMathInElement) [fb, back].forEach(function (n) { try { window.renderMathInElement(n, { delimiters: [{ left: "$", right: "$", display: false }], throwOnError: false }); } catch (e) { } });
    }
    inner.addEventListener("click", flip);
    wrap.addEventListener("keydown", function (e) { if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return; if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1); });
    paint();
  }
  KT.define("flashcards", build);
})();
