/* EE Hub — course study pages and the study hub (Round 7, R7D).
   - tabs ([data-kp-tabs]) with #hash state, "All" sheet, lazy KaTeX per panel
   - worked examples one step at a time, copy LaTeX, star to My formulas
   - cheat-code filter and shuffle, quiz with instant feedback (score saved privately)
   - suggestion sheet, live search on the hub, flashcards, GPA calculator, exam timer
   No dependencies (KaTeX auto-render is optional). */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement;
  root.classList.add("kp-js");
  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  function csrf() {
    var m = doc.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
    if (m) return decodeURIComponent(m[1]);
    var i = $("input[name=csrfmiddlewaretoken]");
    if (i) return i.value;
    try { return JSON.parse(doc.body.getAttribute("hx-headers") || "{}")["X-CSRFToken"] || ""; } catch (e) { return ""; }
  }
  function post(url, data) {
    return fetch(url, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-CSRFToken": csrf(), "X-Requested-With": "fetch" }, body: JSON.stringify(data || {}) })
      .then(function (r) { return r.json().catch(function () { return { ok: false }; }).then(function (j) { j._status = r.status; return j; }); });
  }
  function toast(msg, kind) {
    if (window.EE && EE.Toast && EE.Toast.show) { try { EE.Toast.show(msg, kind || "success"); return; } catch (e) {} }
    var t = doc.createElement("div"); t.className = "kp-toast"; t.textContent = msg; t.setAttribute("role", "status");
    t.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:300;padding:10px 16px;border-radius:12px;background:#0a2a1f;color:#fff;font-weight:600;box-shadow:0 10px 30px rgba(0,0,0,.25)";
    doc.body.appendChild(t); setTimeout(function () { t.remove(); }, 2200);
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ---- maths ------------------------------------------------------------- */
  var DELIMS = [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }, { left: "\\(", right: "\\)", display: false }, { left: "\\[", right: "\\]", display: true }];
  function maths(scope) {
    if (!scope || scope._kpMath || !window.katex) return;
    scope._kpMath = true;
    $$("[data-ktex]", scope).forEach(function (el) {
      try { window.katex.render(el.getAttribute("data-ktex"), el, { displayMode: true, throwOnError: false, strict: "ignore" }); } catch (e) {}
    });
    $$("[data-tex]:not(.is-tex)", scope).forEach(function (el) {
      try { window.katex.render(el.getAttribute("data-tex"), el, { displayMode: true, throwOnError: false, strict: "ignore" }); el.classList.add("is-tex"); } catch (e) {}
    });
    if (window.renderMathInElement) {
      $$(".kx", scope).forEach(function (el) {
        try { window.renderMathInElement(el, { delimiters: DELIMS, throwOnError: false, strict: "ignore" }); } catch (e) {}
      });
    }
  }
  function whenKatex(fn) {
    if (window.katex && window.renderMathInElement) return fn();
    var n = 0, t = setInterval(function () { if ((window.katex && window.renderMathInElement) || ++n > 80) { clearInterval(t); if (window.katex) fn(); } }, 60);
  }

  /* ---- tabs --------------------------------------------------------------- */
  function tabs() {
    var kp = $("[data-kp]"), bar = $("[data-kp-tablist]");
    if (!kp || !bar) return;
    var panels = $$(".kp-panel", kp), tabsEls = $$(".kp-tab", bar);
    var keys = tabsEls.map(function (t) { return t.getAttribute("data-tab"); });
    var ink = $(".kp-ink", bar);
    if (!ink) { ink = doc.createElement("span"); ink.className = "kp-ink"; ink.setAttribute("aria-hidden", "true"); bar.appendChild(ink); }
    function moveInk(settle) {
      var t = $('.kp-tab[aria-selected="true"]', bar);
      if (!t) return;
      var pad = 12, w = Math.max(1, t.offsetWidth - pad * 2);
      if (settle) bar.classList.add("is-settling");
      ink.style.transform = "translateX(" + (t.offsetLeft + pad) + "px) scaleX(" + w + ")";
      bar.classList.add("has-ink");
      if (settle) requestAnimationFrame(function () { requestAnimationFrame(function () { bar.classList.remove("is-settling"); }); });
    }
    var inkRaf = 0;
    window.addEventListener("resize", function () { if (!inkRaf) inkRaf = requestAnimationFrame(function () { inkRaf = 0; moveInk(true); }); }, { passive: true });
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { moveInk(true); });
    function show(key, push, scroll) {
      if (keys.indexOf(key) < 0) key = keys[0];
      var from = keys.indexOf(kp.getAttribute("data-tab")), to = keys.indexOf(key);
      kp.style.setProperty("--kp-dir", from < 0 || from === to ? "0" : (to > from ? "1" : "-1"));
      panels.forEach(function (p) { var on = p.getAttribute("data-panel") === key; p.classList.toggle("is-active", on); if (on) whenKatex(function () { maths(p); }); });
      tabsEls.forEach(function (t) {
        var on = t.getAttribute("data-tab") === key;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        if (on && t.scrollIntoView) { var sc = bar, l = t.offsetLeft - sc.clientWidth / 2 + t.clientWidth / 2; sc.scrollTo({ left: l, behavior: reduce ? "auto" : "smooth" }); }
      });
      moveInk(!bar.classList.contains("has-ink"));
      $$("#kp-sheet-tabs a").forEach(function (a) { a.classList.toggle("is-current", a.getAttribute("data-tab-link") === key); });
      kp.setAttribute("data-tab", key);
      if (push && history.replaceState) history.replaceState(null, "", "#" + key);
      if (scroll) {
        var nav = $("[data-kp-tabs]"), top = nav.getBoundingClientRect().top + window.pageYOffset - (parseInt(getComputedStyle(nav).top, 10) || 0);
        if (window.pageYOffset > top) window.scrollTo({ top: top, behavior: reduce ? "auto" : "smooth" });
      }
      window.dispatchEvent(new Event("resize")); // let canvases in the shown panel size themselves
      // the prerequisite map draws its wires only when visible
      if (key === "overview" && window.dispatchEvent) setTimeout(function () { window.dispatchEvent(new Event("resize")); }, 60);
    }
    bar.addEventListener("click", function (e) {
      var t = e.target.closest(".kp-tab"); if (!t) return;
      e.preventDefault(); show(t.getAttribute("data-tab"), true, true);
    });
    bar.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      var i = keys.indexOf(kp.getAttribute("data-tab")) + (e.key === "ArrowRight" ? 1 : -1);
      i = (i + keys.length) % keys.length; show(keys[i], true, false); tabsEls[i].focus(); e.preventDefault();
    });
    doc.addEventListener("click", function (e) {
      var a = e.target.closest("[data-tab-link]"); if (!a) return;
      e.preventDefault(); closeSheets(); show(a.getAttribute("data-tab-link"), true, true);
    });
    // Nov 2026: jump to one element inside a panel (an interactive-lab tool from the overview tiles):
    // open its tab, scroll it into view and flash it so the eye lands on it.
    function jumpTo(el, smooth) {
      var p = el.closest(".kp-panel"); if (!p) return false;
      show(p.getAttribute("data-panel"), false, false);
      setTimeout(function () {
        el.scrollIntoView({ block: "start", behavior: smooth && !reduce ? "smooth" : "auto" });
        var box = el.classList.contains("kp-tool") ? el : el.closest(".kp-tool");
        if (box) { box.classList.remove("is-flash"); void box.offsetWidth; box.classList.add("is-flash"); setTimeout(function () { box.classList.remove("is-flash"); }, 1500); }
        var f = el.querySelector && el.querySelector("input, select, button, textarea");
        if (f && smooth) { try { f.focus({ preventScroll: true }); } catch (err) {} }
      }, 40);
      return true;
    }
    doc.addEventListener("click", function (e) {
      var a = e.target.closest("[data-lab-jump]"); if (!a) return;
      var id = (a.getAttribute("href") || "").replace(/^#/, ""), el = id && doc.getElementById(id);
      if (!el) return;
      e.preventDefault(); closeSheets();
      if (history.replaceState) history.replaceState(null, "", "#" + id);
      jumpTo(el, true);
    });
    function fromHash() {
      var h = (location.hash || "").slice(1);
      if (!h) return show(keys[0], false, false);
      if (keys.indexOf(h) >= 0) return show(h, false, false);
      var el = doc.getElementById(h);
      if (!(el && jumpTo(el, false))) show(keys[0], false, false);
    }
    window.addEventListener("hashchange", fromHash);
    fromHash();
    // panels not active still get their maths when printed
    window.addEventListener("beforeprint", function () { panels.forEach(maths); });
  }

  /* ---- sheets ------------------------------------------------------------- */
  var lastFocus = null;
  function openSheet(id) {
    var s = doc.getElementById(id); if (!s) return null;
    lastFocus = doc.activeElement; s.hidden = false; doc.body.style.overflow = "hidden";
    var f = $("textarea, input:not([type=hidden]), select, button", s); if (f) setTimeout(function () { f.focus(); }, 30);
    return s;
  }
  function closeSheets() {
    $$(".kp-sheet").forEach(function (s) { s.hidden = true; });
    doc.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  window.KPSheet = { open: openSheet, close: closeSheets };
  doc.addEventListener("click", function (e) {
    var o = e.target.closest("[data-kp-open]"); if (o) { e.preventDefault(); openSheet(o.getAttribute("data-kp-open")); return; }
    if (e.target.closest("[data-kp-close]") || e.target.classList.contains("kp-sheet")) { if (!e.target.closest("[data-tab-link]")) e.preventDefault(); closeSheets(); }
  });
  doc.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheets(); });

  /* ---- suggestions --------------------------------------------------------- */
  doc.addEventListener("click", function (e) {
    var b = e.target.closest("[data-kp-suggest]"); if (!b) return;
    var s = doc.getElementById("kp-sheet-suggest"); if (!s) return;
    var cheat = b.getAttribute("data-kind") === "cheat";
    $("[data-suggest-section]", s).value = b.getAttribute("data-kp-suggest");
    $("[data-suggest-kind]", s).value = cheat ? "cheat" : "edit";
    $("[data-suggest-tag]", s).hidden = !cheat;
    $("[data-suggest-title]", s).textContent = cheat ? "Suggest a cheat code" : "Suggest a correction";
    $("[data-suggest-label]", s).textContent = cheat ? "Your cheat code (a mnemonic, shortcut, trap or check)" : "What should change?";
    openSheet("kp-sheet-suggest");
  });

  /* ---- worked examples ------------------------------------------------------ */
  function examples() {
    $$("[data-kp-ex]").forEach(function (ex) {
      var steps = $$(".kp-ex__steps > li", ex), ans = $(".kp-ex__ans", ex), next = $("[data-ex-next]", ex), all = $("[data-ex-all]", ex), reset = $("[data-ex-reset]", ex);
      if (!next) return;
      var shown = 0;
      function label() {
        if (shown >= steps.length) { next.hidden = true; all.hidden = true; if (reset) reset.hidden = false; if (ans) ans.hidden = false; return; }
        next.lastChild.textContent = shown === 0 ? "Show the first step" : "Next step (" + (shown + 1) + " of " + steps.length + ")";
      }
      next.addEventListener("click", function () { if (shown < steps.length) { steps[shown].hidden = false; maths(steps[shown]); shown++; } label(); });
      all.addEventListener("click", function () { steps.forEach(function (s) { s.hidden = false; }); shown = steps.length; label(); });
      if (reset) reset.addEventListener("click", function () { steps.forEach(function (s) { s.hidden = true; }); if (ans) ans.hidden = true; shown = 0; next.hidden = false; all.hidden = false; reset.hidden = true; label(); });
      label();
    });
  }

  /* ---- formulas: copy + My formulas ----------------------------------------- */
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (ok) { var ta = doc.createElement("textarea"); ta.value = text; doc.body.appendChild(ta); ta.select(); try { doc.execCommand("copy"); } catch (e) {} ta.remove(); ok(); });
  }
  doc.addEventListener("click", function (e) {
    var c = e.target.closest("[data-copy-tex]");
    if (c) {
      var card = c.closest(".kp-formula"), tex = card && $("[data-ktex]", card);
      if (!tex) return;
      copyText(tex.getAttribute("data-ktex")).then(function () { toast("LaTeX copied"); if (c.classList.contains("kp-ibtn")) { c.classList.add("is-done"); setTimeout(function () { c.classList.remove("is-done"); }, 1200); } });
      return;
    }
    var s = e.target.closest("[data-save-formula]");
    if (s) {
      var host = s.closest("[data-save-url]") || $("[data-save-url]");
      if (!host || host.getAttribute("data-signed-in") !== "1") { toast("Sign in to keep My formulas", "info"); return; }
      var url = host.getAttribute("data-save-url").replace(/\/0\/save\/$/, "/" + s.getAttribute("data-save-formula") + "/save/");
      post(url, {}).then(function (j) {
        if (!j.ok) return toast("Could not save that formula", "error");
        s.classList.toggle("is-on", j.saved); s.setAttribute("aria-pressed", j.saved ? "true" : "false");
        toast(j.saved ? "Added to My formulas" : "Removed from My formulas");
      });
    }
  });

  /* ---- filter + shuffle ------------------------------------------------------ */
  function filters() {
    $$("[data-kp-filter]").forEach(function (g) {
      var sel = g.getAttribute("data-kp-filter");
      g.addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b) return;
        $$("button", g).forEach(function (x) { x.classList.toggle("is-on", x === b); });
        var f = b.getAttribute("data-f");
        $$(sel).forEach(function (el) { el.hidden = !!f && el.getAttribute("data-f") !== f; });
      });
    });
    $$("[data-kp-shuffle]").forEach(function (b) {
      b.addEventListener("click", function () {
        var box = $(b.getAttribute("data-kp-shuffle")); if (!box) return;
        var items = Array.prototype.slice.call(box.children);
        for (var i = items.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = items[i]; items[i] = items[j]; items[j] = t; }
        items.forEach(function (el) { box.appendChild(el); });
        toast("Shuffled");
      });
    });
  }

  /* ---- quiz -------------------------------------------------------------------- */
  function quiz() {
    var box = $("[data-kp-quiz]"); if (!box) return;
    var data; try { data = JSON.parse($("[data-quiz-json]", box).textContent); } catch (e) { return; }
    if (!data.length) return;
    var kp = $("[data-kp]"), url = kp && kp.getAttribute("data-quiz-url");
    var stage = $("[data-quiz-stage]", box), prog = $("[data-quiz-progress]", box), score = $("[data-quiz-score]", box), fill = $("[data-quiz-fill]", box);
    var i = 0, right = 0, answers = {}, started = Date.now();
    function md(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/(\$\$?[^$]+\$\$?)/g, '<span class="kx">$1</span>'); }
    function render() {
      prog.textContent = "Question " + (i + 1) + " of " + data.length;
      fill.style.width = (100 * i / data.length) + "%";
      var q = data[i];
      stage.innerHTML = '<div class="kp-q"><div class="kp-q__prompt">' + md(q.prompt) + '</div><div class="kp-q__opts" role="group" aria-label="Options">' +
        q.options.map(function (o, k) { return '<button type="button" class="kp-q__opt" data-k="' + k + '"><b>' + "ABCDE"[k] + "</b><span>" + md(o) + "</span></button>"; }).join("") +
        '</div><div data-why></div></div>';
      maths(stage); stage._kpMath = false;
    }
    function finish() {
      fill.style.width = "100%";
      var pct = Math.round(100 * right / data.length);
      stage.innerHTML = '<div class="kp-q__done"><span class="kp-ring" style="--p:' + pct + '"><b>' + pct + '%</b></span><h3>' + right + " of " + data.length + " right</h3>" +
        '<p class="kp-muted" data-saved>' + (pct >= 80 ? "Excellent — you're ready for this topic." : pct >= 50 ? "Good start. Read the explanations, then try again." : "Go through the concepts and cheat codes, then try again.") + "</p>" +
        '<div class="btn-group" style="justify-content:center"><button type="button" class="pub-btn pub-btn--primary" data-again>Try again</button><a class="pub-btn pub-btn--ghost" href="#cheats" data-tab-link="cheats">Cheat codes</a></div></div>';
      $("[data-again]", stage).addEventListener("click", function () { i = 0; right = 0; answers = {}; score.textContent = "0 right"; started = Date.now(); render(); });
      if (url) post(url, { mode: "quiz", answers: answers, seconds: Math.round((Date.now() - started) / 1000) }).then(function (j) {
        var p = $("[data-saved]", stage); if (p && j.saved) p.textContent += " Saved privately to your progress.";
      });
    }
    stage.addEventListener("click", function (e) {
      var b = e.target.closest(".kp-q__opt");
      if (b && !b.disabled) {
        var q = data[i], k = +b.getAttribute("data-k");
        answers[q.id] = k;
        $$(".kp-q__opt", stage).forEach(function (x) { x.disabled = true; var xk = +x.getAttribute("data-k"); if (xk === q.answer) x.classList.add("is-right"); else if (xk === k) x.classList.add("is-wrong"); });
        var ok = k === q.answer; if (ok) right++;
        score.textContent = right + " right";
        var why = $("[data-why]", stage);
        why.innerHTML = '<div class="kp-q__why"><b>' + (ok ? "Correct." : "Not quite — the answer is " + "ABCDE"[q.answer] + ".") + "</b>" + md(q.explanation || "") + '</div><button type="button" class="pub-btn pub-btn--primary kp-q__next" data-next>' + (i + 1 < data.length ? "Next question" : "See my score") + "</button>";
        maths(why); why._kpMath = false;
        var n = $("[data-next]", why); n.focus();
        return;
      }
      if (e.target.closest("[data-next]")) { i++; if (i < data.length) render(); else finish(); }
    });
    render();
  }

  /* ---- hub live search --------------------------------------------------------- */
  function liveSearch() {
    $$("[data-kh-search]").forEach(function (form) {
      var input = $("input", form), out = $("[data-kh-results]", form), url = form.getAttribute("data-kh-search"), timer, idx = -1;
      if (!input || !out) return;
      input.addEventListener("input", function () {
        clearTimeout(timer); var q = input.value.trim();
        if (q.length < 2) { out.hidden = true; return; }
        timer = setTimeout(function () {
          fetch(url + "?format=json&q=" + encodeURIComponent(q), { credentials: "same-origin" }).then(function (r) { return r.json(); }).then(function (j) {
            if (!j.results.length) { out.innerHTML = '<p class="kp-muted" style="padding:10px">Nothing found. Press Enter for the full search.</p>'; out.hidden = false; return; }
            out.innerHTML = j.results.map(function (r) { return '<a href="' + esc(r.url) + '"><small>' + esc(r.kind) + "</small><span><b>" + esc(r.title) + "</b><i>" + esc(r.sub) + "</i></span></a>"; }).join("");
            out.hidden = false; idx = -1;
          }).catch(function () {});
        }, 180);
      });
      input.addEventListener("keydown", function (e) {
        var links = $$("a", out); if (out.hidden || !links.length) return;
        if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); idx = (idx + (e.key === "ArrowDown" ? 1 : -1) + links.length) % links.length; links.forEach(function (a, k) { a.classList.toggle("is-on", k === idx); }); }
        if (e.key === "Enter" && idx >= 0) { e.preventDefault(); location.href = links[idx].href; }
        if (e.key === "Escape") out.hidden = true;
      });
      doc.addEventListener("click", function (e) { if (!form.contains(e.target)) out.hidden = true; });
    });
  }

  /* ---- flashcards -------------------------------------------------------------- */
  function flashcards() {
    var box = $("[data-kf]"); if (!box) return;
    var cards = JSON.parse($("[data-kf-cards]", box).textContent || "[]"), known = new Set(JSON.parse($("[data-kf-known]", box).textContent || "[]"));
    var signed = box.getAttribute("data-signed-in") === "1", stateUrl = box.getAttribute("data-state-url");
    if (!signed) { try { JSON.parse(localStorage.getItem("kp-known") || "[]").forEach(function (k) { known.add(k); }); } catch (e) {} }
    var hideKnown = false, deck = cards.slice(), i = 0;
    var card = $("[data-kf-card]", box), front = $("[data-kf-front]", box), back = $("[data-kf-back]", box), tag = $("[data-kf-tag]", box), count = $("[data-kf-count]", box), kn = $("[data-kf-known-count]", box);
    function key(c) { return c.kind + ":" + c.id; }
    function visible() { return hideKnown ? deck.filter(function (c) { return !known.has(key(c)); }) : deck; }
    function show() {
      var v = visible(); kn.textContent = cards.filter(function (c) { return known.has(key(c)); }).length + " known";
      if (!v.length) { $("[data-kf-stage]", box).hidden = true; $("[data-kf-done]", box).hidden = false; count.textContent = "0 left"; return; }
      $("[data-kf-stage]", box).hidden = false; $("[data-kf-done]", box).hidden = true;
      if (i >= v.length) i = 0; if (i < 0) i = v.length - 1;
      var c = v[i]; card.classList.remove("is-flipped");
      front.innerHTML = c.front_html; back.innerHTML = c.back_html; front._kpMath = back._kpMath = false;
      tag.className = "kp-tag kp-tag--" + c.tag; tag.textContent = (c.kind === "concept" ? "Concept" : c.tag.charAt(0).toUpperCase() + c.tag.slice(1)) + " · " + c.code;
      count.textContent = (i + 1) + " of " + v.length;
      whenKatex(function () { maths(front); maths(back); });
    }
    function mark(isKnown) {
      var v = visible(); if (!v.length) return; var c = v[i];
      if (isKnown) known.add(key(c)); else known.delete(key(c));
      if (signed) post(stateUrl, { kind: c.kind, id: c.id, known: isKnown });
      else { try { localStorage.setItem("kp-known", JSON.stringify(Array.from(known))); } catch (e) {} }
      if (!(hideKnown && isKnown)) i++;
      show();
    }
    card.addEventListener("click", function () { card.classList.toggle("is-flipped"); });
    card.addEventListener("keydown", function (e) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); card.classList.toggle("is-flipped"); } });
    $("[data-kf-know]", box).addEventListener("click", function () { mark(true); });
    $("[data-kf-again]", box).addEventListener("click", function () { mark(false); });
    $("[data-kf-prev]", box).addEventListener("click", function () { i--; show(); });
    $("[data-kf-next]", box).addEventListener("click", function () { i++; show(); });
    $("[data-kf-shuffle]", box).addEventListener("click", function () { for (var a = deck.length - 1; a > 0; a--) { var b = Math.floor(Math.random() * (a + 1)); var t = deck[a]; deck[a] = deck[b]; deck[b] = t; } i = 0; show(); toast("Shuffled"); });
    $("[data-kf-hide]", box).addEventListener("change", function (e) { hideKnown = e.target.checked; i = 0; show(); });
    $("[data-kf-reset]", box).addEventListener("click", function () { hideKnown = false; $("[data-kf-hide]", box).checked = false; i = 0; show(); });
    doc.addEventListener("keydown", function (e) { if (e.target.closest("input,textarea,select")) return; if (e.key === "ArrowRight") { i++; show(); } if (e.key === "ArrowLeft") { i--; show(); } });
    show();
  }

  /* ---- GPA calculator ----------------------------------------------------------- */
  function gpa() {
    var box = $("[data-kg]"); if (!box) return;
    var scale = JSON.parse($("[data-kg-scale]", box).textContent), classes = JSON.parse($("[data-kg-classes]", box).textContent), courses = JSON.parse($("[data-kg-courses]", box).textContent);
    var rows = $("[data-kg-rows]", box), lv = $("[data-kg-level]", box), sem = $("[data-kg-sem]", box);
    var out = { gpa: $("[data-kg-gpa]", box), units: $("[data-kg-units]", box), cgpa: $("[data-kg-cgpa]", box), cls: $("[data-kg-class]", box) };
    var prevU = $("[data-kg-prev-units]", box), prevG = $("[data-kg-prev-cgpa]", box);
    function point(g) { for (var k = 0; k < scale.length; k++) if (scale[k][0] === g) return +scale[k][3]; return null; }
    function opts() { return '<option value="">–</option>' + scale.map(function (s) { return '<option value="' + esc(s[0]) + '">' + esc(s[0]) + " (" + s[3] + ")</option>"; }).join(""); }
    function addRow(c) {
      var d = doc.createElement("div"); d.className = "kg-row";
      d.innerHTML = '<div class="kg-name">' + (c ? "<b>" + esc(c.code) + "</b><small>" + esc(c.title) + "</small>" : '<input type="text" placeholder="Course" aria-label="Course">') + '</div><input type="number" min="0" max="12" value="' + (c ? c.units : 2) + '" aria-label="Units" data-u><select aria-label="Grade" data-g>' + opts() + '</select><button type="button" class="kp-ibtn kg-del" aria-label="Remove">×</button>';
      rows.appendChild(d);
    }
    function load() {
      rows.innerHTML = "";
      courses.filter(function (c) { return String(c.level) === lv.value && String(c.sem) === sem.value; }).forEach(addRow);
      if (!rows.children.length) addRow(null);
      calc();
    }
    function cls(v) { var s = classes.slice().sort(function (a, b) { return b[1] - a[1]; }); for (var k = 0; k < s.length; k++) if (v >= s[k][1]) return s[k][0]; return "Below the lowest class"; }
    function calc() {
      var U = 0, Q = 0;
      $$(".kg-row", rows).forEach(function (r) { var g = $("[data-g]", r).value, u = +$("[data-u]", r).value || 0, p = point(g); if (g && p !== null) { U += u; Q += u * p; } });
      var g = U ? Q / U : 0;
      out.gpa.textContent = U ? g.toFixed(2) : "—"; out.units.textContent = U + " units graded";
      var pu = +prevU.value || 0, pg = +prevG.value || 0, TU = U + pu, c = TU ? (Q + pu * pg) / TU : 0;
      out.cgpa.textContent = TU ? c.toFixed(2) : "—"; out.cls.textContent = TU ? cls(+c.toFixed(2)) : "";
    }
    rows.addEventListener("input", calc); rows.addEventListener("change", calc);
    rows.addEventListener("click", function (e) { var d = e.target.closest(".kg-del"); if (d) { d.closest(".kg-row").remove(); calc(); } });
    $("[data-kg-add]", box).addEventListener("click", function () { addRow(null); });
    lv.addEventListener("change", load); sem.addEventListener("change", load); prevU.addEventListener("input", calc); prevG.addEventListener("input", calc);
    load();
  }

  /* ---- exam mode ------------------------------------------------------------------ */
  function exam() {
    var box = $("[data-kx]"); if (!box) return;
    var url = box.getAttribute("data-quiz-url"), mcq = JSON.parse($("[data-kx-mcq]", box).textContent || "[]");
    var paper = $("[data-kx-paper]", box), startBox = $("[data-kx-startbox]", box), timerEl = $("[data-kx-timer]", box), clock = $("[data-kx-clock]", box);
    var end = 0, tick = null, began = 0, done = false;
    function fmt(s) { s = Math.max(0, s); var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ":" : "") + (m < 10 && h ? "0" : "") + m + ":" + (x < 10 ? "0" : "") + x; }
    $$("[data-kx-start]", box).forEach(function (b) {
      b.addEventListener("click", function () {
        var mins = +b.getAttribute("data-kx-start"), n = +b.getAttribute("data-kx-n") || 99;
        $$(".kx-q[data-kx-part=theory]", paper).forEach(function (q, k) { q.hidden = k >= n; });
        startBox.hidden = true; paper.hidden = false; timerEl.hidden = false; began = Date.now(); end = began + mins * 60000;
        whenKatex(function () { maths(paper); });
        tick = setInterval(function () { var left = Math.round((end - Date.now()) / 1000); clock.textContent = fmt(left); timerEl.classList.toggle("is-low", left < 300); if (left <= 0) finish(true); }, 500);
        window.scrollTo({ top: box.getBoundingClientRect().top + window.pageYOffset - 80 });
      });
    });
    paper.addEventListener("click", function (e) {
      var b = e.target.closest(".kp-q__opt"); if (!b || done) return;
      $$(".kp-q__opt", b.parentNode).forEach(function (x) { x.classList.remove("is-picked"); x.setAttribute("aria-pressed", "false"); });
      b.classList.add("is-picked"); b.setAttribute("aria-pressed", "true");
      b.closest(".kx-q").setAttribute("data-picked", b.getAttribute("data-k"));
    });
    $("[data-kx-finish]", box).addEventListener("click", function () { finish(false); });
    function finish(timeUp) {
      if (done) return; done = true; clearInterval(tick); timerEl.hidden = true;
      var answers = {}, right = 0;
      $$(".kx-q[data-kx-part=mcq]", paper).forEach(function (q) {
        var id = q.getAttribute("data-id"), info = mcq.filter(function (m) { return String(m.id) === id; })[0], k = q.getAttribute("data-picked");
        $$(".kp-q__opt", q).forEach(function (x) { x.disabled = true; var xk = +x.getAttribute("data-k"); if (info && xk === info.answer) x.classList.add("is-right"); else if (String(xk) === k) x.classList.add("is-wrong"); });
        if (k !== null) answers[id] = +k;
        if (info && k !== null && +k === info.answer) right++;
        var w = $(".kx-why", q); if (w) w.hidden = false;
      });
      $$(".kx-sol, .kx-self", paper).forEach(function (s) { s.hidden = false; });
      $("[data-kx-finish]", box).hidden = true;
      var res = $("[data-kx-result]", box); res.hidden = false;
      $("[data-kx-mcq-score]", res).textContent = right + " of " + $$(".kx-q[data-kx-part=mcq]", paper).length;
      $("[data-kx-time]", res).textContent = timeUp ? "Time is up." : "Finished in " + fmt(Math.round((Date.now() - began) / 1000)) + ".";
      whenKatex(function () { paper._kpMath = false; maths(paper); });
      res.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
      var save = $("[data-kx-save]", res);
      save.addEventListener("click", function () {
        var self = {};
        $$(".kx-q[data-kx-part=theory]:not([hidden])", paper).forEach(function (q, k) { var v = q.getAttribute("data-self"); if (v) self["t" + k] = v === "1"; });
        post(url, { mode: "exam", answers: answers, self: self, seconds: Math.round((Date.now() - began) / 1000) }).then(function (j) {
          save.disabled = true; save.textContent = j.saved ? "Saved privately (" + j.score + "/" + j.total + ")" : "Sign in to save — score " + j.score + "/" + j.total;
        });
      });
    }
    paper.addEventListener("click", function (e) {
      var s = e.target.closest("[data-self]"); if (!s || !done) return;
      var q = s.closest(".kx-q"); q.setAttribute("data-self", s.getAttribute("data-self"));
      $$("[data-self]", q).forEach(function (x) { x.classList.toggle("pub-btn--primary", x === s); x.classList.toggle("pub-btn--ghost", x !== s); });
    });
  }

  /* ---- vault / any page with formulas outside panels -------------------------------- */
  function looseMaths() {
    $$("[data-kp-maths]").forEach(function (el) { whenKatex(function () { maths(el); }); });
  }

  function start() { tabs(); examples(); filters(); quiz(); liveSearch(); flashcards(); gpa(); exam(); looseMaths();
    // side cards (formula of the day, mini cheats) are outside the panels
    var side = $(".kp-side"); if (side) whenKatex(function () { maths(side); });
    var hero = $(".kp-hero"); if (hero) whenKatex(function () { maths(hero); });
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else start();
})();
