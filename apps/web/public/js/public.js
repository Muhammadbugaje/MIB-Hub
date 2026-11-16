/* MIB-Hub public website behaviour (no dependencies). Ported from EE Hub's
   static/js/public.js: the header (scroll state, dropdown menus, phone drawer),
   the search panel, "Pause motion", the hero typewriter, the LIVE ticker,
   horizontal scrollers, countdowns and count-up numbers.

   Everything here is progressive: the page reads and works without it.
   The theme toggle lives in src/components/ThemeToggle.astro (it shares its
   logic with packages/ui/src/theme.ts). */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement, body = doc.body;
  if (!body) return;
  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  if (root.getAttribute("data-motion") === "reduce") reduce = true;

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function store(key, val) {
    try {
      if (val === undefined) return localStorage.getItem(key);
      if (val === null) localStorage.removeItem(key);
      else localStorage.setItem(key, val);
    } catch { /* storage blocked: the choice lasts for this page only */ }
    return null;
  }

  /* ---- Header: scroll state ------------------------------------------------ */
  var nav = $("[data-pub-nav]");
  if (nav) {
    var onScroll = function () { nav.classList.toggle("is-scrolled", window.scrollY > 40); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---- Header: dropdown menus (hover and focus work in CSS; click for touch) - */
  function closeMenus(except) {
    $$(".pub-menu.is-open").forEach(function (m) {
      if (m === except) return;
      m.classList.remove("is-open");
      var b = m.querySelector("[data-pub-menu]");
      if (b) b.setAttribute("aria-expanded", "false");
    });
  }
  doc.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-pub-menu]");
    if (btn) {
      var menu = btn.parentElement, open = !menu.classList.contains("is-open");
      closeMenus(menu);
      menu.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      return;
    }
    if (!e.target.closest(".pub-menu")) closeMenus();
  });

  /* ---- Phone drawer ---------------------------------------------------------- */
  var drawer = $("[data-pub-drawer]"), opener = $("[data-pub-drawer-open]");
  function setDrawer(open) {
    if (!drawer) return;
    drawer.classList.toggle("is-open", open);
    drawer.setAttribute("aria-hidden", open ? "false" : "true");
    if (opener) opener.setAttribute("aria-expanded", open ? "true" : "false");
    root.style.overflow = open ? "hidden" : "";
    if (open) {
      var f = drawer.querySelector("a, button");
      if (f) setTimeout(function () { f.focus(); }, 60);
    } else if (opener) opener.focus();
  }
  doc.addEventListener("click", function (e) {
    if (e.target.closest("[data-pub-drawer-open]")) return setDrawer(true);
    if (e.target.closest("[data-pub-drawer-close]") || e.target === drawer) return setDrawer(false);
    if (drawer && drawer.classList.contains("is-open") && e.target.closest(".pub-drawer a")) {
      drawer.classList.remove("is-open");
      root.style.overflow = "";
    }
  });

  /* ---- Search panel -----------------------------------------------------------
     The header's search button is a plain link to /search. With JavaScript it
     opens this panel instead, and results appear as you type (the same page,
     asked for as a fragment). Enter still goes to the full results page. */
  var search = $("[data-pub-search]");
  var searchInput = search && $("input[type=search]", search);
  var searchOut = search && $("[data-search-results]", search);
  var searchIdle = search && $("[data-search-idle]", search);
  var searchTimer = 0, searchSeq = 0, searchLast = "", searchFrom = null;
  function setSearch(open) {
    if (!search) return;
    if (open) searchFrom = doc.activeElement;
    search.classList.toggle("is-open", open);
    search.setAttribute("aria-hidden", open ? "false" : "true");
    root.style.overflow = open ? "hidden" : "";
    if (open) setTimeout(function () { searchInput.focus(); searchInput.select(); }, 40);
    else if (searchFrom && searchFrom.focus) searchFrom.focus();
  }
  function runSearch() {
    var q = searchInput.value.trim();
    if (q === searchLast) return;
    searchLast = q;
    if (q.length < 2) {
      searchOut.innerHTML = "";
      searchOut.hidden = true;
      if (searchIdle) searchIdle.hidden = false;
      return;
    }
    var seq = ++searchSeq;
    search.classList.add("is-busy");
    fetch("/search?fragment=1&q=" + encodeURIComponent(q), { headers: { Accept: "text/html" }, credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.text() : ""; })
      .then(function (html) {
        if (seq !== searchSeq) return;
        var box = doc.createElement("div");
        box.innerHTML = html;
        var found = box.querySelector("[data-search-fragment]");
        searchOut.innerHTML = found ? found.innerHTML : "";
        searchOut.hidden = !found;
        if (searchIdle) searchIdle.hidden = !!found;
      })
      .catch(function () { /* offline: Enter still opens the full page */ })
      .then(function () { if (seq === searchSeq) search.classList.remove("is-busy"); });
  }
  if (search && searchInput && searchOut) {
    doc.addEventListener("click", function (e) {
      var open = e.target.closest("[data-search-open]");
      if (open) { e.preventDefault(); setSearch(true); return; }
      if (e.target.closest("[data-search-close]") || e.target === search) setSearch(false);
    });
    searchInput.addEventListener("input", function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(runSearch, 170);
    });
    doc.addEventListener("keydown", function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "") || (e.target && e.target.isContentEditable);
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setSearch(true); }
      else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); setSearch(true); }
    });
  }

  doc.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    closeMenus();
    if (drawer && drawer.classList.contains("is-open")) setDrawer(false);
    if (search && search.classList.contains("is-open")) setSearch(false);
  });

  /* ---- Motion state -----------------------------------------------------------
     One place decides whether the hero moves: reduced motion (device or the
     site's own switch), "Pause motion", the tab being hidden, the hero being
     off screen. fx/scenes.js watches body.is-calm for the canvas scene. */
  var calmSaved = store("mib-calm");
  if (calmSaved === "1") body.classList.add("is-calm");
  function calm() { return reduce || body.classList.contains("is-calm"); }
  var heroEl = $("[data-hero]");
  var heroSeen = true;
  var motionListeners = [];
  function heroRunning() { return !calm() && !doc.hidden && heroSeen; }
  function motionChanged() {
    var on = heroRunning();
    if (heroEl) heroEl.classList.toggle("is-still", !on);
    motionListeners.forEach(function (fn) { fn(on); });
  }
  function onMotion(fn) { motionListeners.push(fn); }
  doc.addEventListener("visibilitychange", motionChanged);
  if (heroEl && "IntersectionObserver" in window) {
    new IntersectionObserver(function (en) { heroSeen = en[0].isIntersecting; motionChanged(); }, { threshold: 0 }).observe(heroEl);
  }
  function syncCalmButtons() {
    var on = body.classList.contains("is-calm");
    $$("[data-calm-toggle]").forEach(function (b) {
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.setAttribute("aria-label", on ? "Play motion" : "Pause motion");
    });
  }
  doc.addEventListener("click", function (e) {
    if (!e.target.closest("[data-calm-toggle]")) return;
    body.classList.toggle("is-calm");
    store("mib-calm", body.classList.contains("is-calm") ? "1" : "0");
    syncCalmButtons();
    motionChanged();
  });
  syncCalmButtons();

  /* ---- Typewriter ----------------------------------------------------------------
     The first word is in the HTML (no layout shift); this types the rest. */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  $$("[data-typewriter]").forEach(function (el) {
    var words;
    try { words = JSON.parse(el.getAttribute("data-typewriter")); } catch { return; }
    if (!words || !words.length || reduce) return;
    var i = 0, pos = words[0].length, deleting = false, timer = 0;
    function tick() {
      timer = 0;
      if (!heroRunning()) return; // resumed by onMotion
      var w = words[i % words.length];
      pos += deleting ? -1 : 1;
      el.innerHTML = '<span class="w' + ((i % words.length) % 6 + 1) + '">' + escapeHtml(w.slice(0, Math.max(0, pos))) + "</span>";
      var delay = deleting ? 38 : 82;
      if (!deleting && pos >= w.length) { deleting = true; delay = 1700; }
      else if (deleting && pos <= 0) { deleting = false; i++; delay = 280; }
      timer = setTimeout(tick, delay);
    }
    onMotion(function (on) { if (on && !timer) timer = setTimeout(tick, 400); });
    deleting = true;
    timer = setTimeout(tick, 2200);
  });
  motionChanged();

  /* ---- Pause section animations while off screen --------------------------------- */
  if ("IntersectionObserver" in window) {
    var secIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.target.classList.toggle("is-offscreen", !en.isIntersecting); });
    }, { rootMargin: "120px 0px" });
    $$(".pub-sec, .pub-ticker, .pub-numbers, .pub-band, [data-motion-zone]").forEach(function (el) { secIO.observe(el); });
  }

  /* ---- LIVE ticker ------------------------------------------------------------------ */
  $$("[data-ticker]").forEach(function (run) {
    var vp = run.parentElement;
    if (reduce || !run.children.length) return;
    // Repeat the items until they fill the strip, then once more for a seamless loop.
    var one = run.innerHTML, guard = 0;
    while (run.scrollWidth < vp.clientWidth * 1.1 && guard++ < 8) run.innerHTML += one.replace(/<a /g, '<a aria-hidden="true" tabindex="-1" ');
    run.innerHTML += run.innerHTML.replace(/<a (?!aria-hidden)/g, '<a aria-hidden="true" tabindex="-1" ');
    run.style.setProperty("--dur", Math.max(24, Math.round(run.scrollWidth / 2 / 62)) + "s");
    run.classList.add("is-moving");
  });

  /* ---- Horizontal scrollers ---------------------------------------------------------- */
  doc.addEventListener("click", function (e) {
    var b = e.target.closest("[data-scroll-prev], [data-scroll-next]");
    if (!b) return;
    var next = b.hasAttribute("data-scroll-next");
    var el = doc.getElementById(b.getAttribute(next ? "data-scroll-next" : "data-scroll-prev"));
    if (!el) return;
    el.scrollBy({ left: (next ? 1 : -1) * Math.max(240, el.clientWidth * 0.7), behavior: reduce ? "auto" : "smooth" });
  });
  function syncArrows(el) {
    var id = el.id;
    if (!id) return;
    var max = el.scrollWidth - el.clientWidth - 2;
    $$('[data-scroll-prev="' + id + '"]').forEach(function (b) { b.disabled = el.scrollLeft <= 2; });
    $$('[data-scroll-next="' + id + '"]').forEach(function (b) { b.disabled = el.scrollLeft >= max; });
  }
  $$("[data-scroller]").forEach(function (el) {
    el.addEventListener("scroll", function () { syncArrows(el); }, { passive: true });
    window.addEventListener("resize", function () { syncArrows(el); });
    syncArrows(el);
    // Drag to scroll with a mouse
    var down = false, sx = 0, sl = 0, moved = false;
    el.addEventListener("mousedown", function (e) { down = true; moved = false; sx = e.pageX; sl = el.scrollLeft; });
    window.addEventListener("mouseup", function () { down = false; });
    el.addEventListener("mousemove", function (e) {
      if (!down) return;
      var dx = e.pageX - sx;
      if (Math.abs(dx) > 4) moved = true;
      el.scrollLeft = sl - dx;
    });
    el.addEventListener("click", function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  });

  /* ---- Countdown ------------------------------------------------------------------------ */
  $$("[data-countdown]").forEach(function (el) {
    var t = Date.parse(el.getAttribute("data-countdown"));
    if (isNaN(t)) return;
    var parts = { d: $('[data-cd="d"]', el), h: $('[data-cd="h"]', el), m: $('[data-cd="m"]', el), s: $('[data-cd="s"]', el) };
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function render() {
      var diff = Math.max(0, Math.floor((t - Date.now()) / 1000));
      if (parts.d) parts.d.textContent = Math.floor(diff / 86400);
      if (parts.h) parts.h.textContent = pad(Math.floor((diff % 86400) / 3600));
      if (parts.m) parts.m.textContent = pad(Math.floor((diff % 3600) / 60));
      if (parts.s) parts.s.textContent = pad(diff % 60);
    }
    render();
    setInterval(render, 1000);
  });

  /* ---- Count-up numbers --------------------------------------------------------------------
     <b data-countup="1234">1,234</b>: the final text is already in the HTML. */
  function countUp(el) {
    var target = parseFloat(el.getAttribute("data-countup"));
    if (isNaN(target) || reduce) return;
    var start = null, dur = Math.min(1600, 600 + Math.log10(Math.abs(target) + 1) * 180);
    var done = el.textContent;
    function step(ts) {
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = t < 1 ? Math.round(target * eased).toLocaleString("en-NG") : done;
      if (t < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  }
  if ("IntersectionObserver" in window && !reduce) {
    var countIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        countIO.unobserve(en.target);
        countUp(en.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    $$("[data-countup]").forEach(function (el) { countIO.observe(el); });
  }

  /* ---- Cover art that is not there yet -----------------------------------------------------
     Game cards paint an accent gradient and the game's icon first; the cover
     photo sits on top. If the file is missing, the image removes itself. */
  $$("img[data-art]").forEach(function (img) {
    function gone() { img.remove(); }
    if (img.complete && img.naturalWidth === 0) gone();
    else img.addEventListener("error", gone);
  });
})();
