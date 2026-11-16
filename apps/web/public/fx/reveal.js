/* MIB-Hub (ported from EE Hub) — scroll & text motion for the public website (no dependencies).

   What it does (all IntersectionObserver-driven, transform/opacity only):
   * every section (.pub-sec, .pub-numbers, .abu-sec, .hb-level …) rises in as it
     enters; its eyebrow, heading and lead follow in sequence;
   * section headings and page-hero titles "pop up" word by word;
   * cards, people, events, news rows… stagger in as they appear;
   * parallax accents ([data-fx-parallax] and a few decorative elements);
   * pointer tilt + glare on feature cards (fine pointers only);
   * a scroll progress hairline and a scroll-velocity skew for marquees;
   * mounts animated scenes ([data-fx-scene]) through fx/scenes.js (ES module).

   Switches: Settings → Appearance and motion (body data-fx-motion / -text / -scroll),
   the device's reduced-motion setting and the profile's "reduce motion" all turn
   the motion off; content is never hidden without JavaScript (.fx-on gate). */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement, body = doc.body;
  if (!body || root.classList.contains("fx-on") || root.classList.contains("fx-static")) return;

  function mq(q) { return !!(window.matchMedia && window.matchMedia(q).matches); }
  var motion = body.getAttribute("data-fx-motion") || "full";
  var reduceOS = mq("(prefers-reduced-motion: reduce)") || root.getAttribute("data-motion") === "reduce";
  var textOn = body.getAttribute("data-fx-text") !== "0";
  var scrollOn = body.getAttribute("data-fx-scroll") !== "0";
  var fine = mq("(hover: hover) and (pointer: fine)");

  // Scenes are mounted whatever the scroll switches say (motion "off" / reduced
  // motion are handled inside the scene host: no scene, or one still frame).
  if (doc.querySelector("[data-fx-scene]") && body.getAttribute("data-fx-src") && motion !== "off") {
    var s = doc.createElement("script");
    s.type = "module";
    s.src = body.getAttribute("data-fx-src");
    doc.head.appendChild(s);
  }

  if (motion === "off" || reduceOS || !("IntersectionObserver" in window)) {
    root.classList.add("fx-static");
    return;
  }
  root.classList.add("fx-on");
  if (motion === "reduced") root.classList.add("fx-gentle");
  if (textOn) root.classList.add("fx-text");
  if (scrollOn) root.classList.add("fx-scroll");

  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }

  /* ---------------------------------------------------------- word splitting */
  // Text nodes become <span class="fx-w"><span class="fx-wi">word</span></span>;
  // inline elements (gradient highlights, links) move as one unit so their
  // background-clip text effects survive. The heading keeps its accessible text.
  function split(el, d0) {
    if (!el || el.__fxSplit || el.closest("[data-fx-nosplit]")) return;
    el.__fxSplit = true;
    var i = 0, nodes = Array.prototype.slice.call(el.childNodes);
    var label = (el.textContent || "").replace(/\s+/g, " ").trim();
    nodes.forEach(function (n) {
      if (n.nodeType === 3) {
        var parts = n.textContent.split(/(\s+)/), frag = doc.createDocumentFragment();
        parts.forEach(function (p) {
          if (!p) return;
          if (/^\s+$/.test(p)) { frag.appendChild(doc.createTextNode(" ")); return; }
          var w = doc.createElement("span"); w.className = "fx-w"; w.setAttribute("aria-hidden", "true");
          var inner = doc.createElement("span"); inner.className = "fx-wi"; inner.textContent = p;
          inner.style.setProperty("--i", i++);
          w.appendChild(inner); frag.appendChild(w);
        });
        n.parentNode.replaceChild(frag, n);
      } else if (n.nodeType === 1 && !/^(BR|SVG|IMG)$/i.test(n.tagName)) {
        var wrap = doc.createElement("span"); wrap.className = "fx-w"; wrap.setAttribute("aria-hidden", "true");
        n.parentNode.insertBefore(wrap, n);
        var innerEl = doc.createElement("span"); innerEl.className = "fx-wi"; innerEl.style.setProperty("--i", i++);
        wrap.appendChild(innerEl); innerEl.appendChild(n);
      }
    });
    if (label) {
      var sr = doc.createElement("span"); sr.className = "sr-only"; sr.textContent = label;
      el.insertBefore(sr, el.firstChild);
    }
    el.classList.add("fx-split");
    if (d0) el.style.setProperty("--d0", d0 + "ms");
  }

  /* ---------------------------------------------------------- hero (on load) */
  var hero = doc.querySelector(".pub-hero, .abu-hero");
  if (hero && textOn) {
    var t = hero.querySelector(".pub-hero__title, h1");
    if (t && !t.closest("[data-slide-copy]:not(.is-active)")) { split(t, 140); root.classList.add("fx-hero"); }
    var lead = hero.querySelector(".pub-hero__lead.pub-only-wide, .abu-hero p");
    if (lead && lead.textContent.length < 400) { split(lead, 620); lead.classList.add("fx-split--soft"); }
    requestAnimationFrame(function () { requestAnimationFrame(function () { hero.classList.add("fx-in"); }); });
    setTimeout(function () { hero.classList.add("fx-in"); }, 300); // renderers that never tick rAF
  }

  /* ---------------------------------------------------------- sections */
  var SECTION = "main .pub-sec, main .pub-numbers, main .pub-courses, main .abu-sec, main .hb-level, main .pub-phero, main .pub-page > .pub-wrap > section";
  var HEADS = "h2, .pub-phero h1";
  var UPS = ".pub-eyebrow, .pub-sh > div > p, .pub-numbers__head > p, .pub-phero__sub, .pub-phero__meta, .pub-sh__more, .pub-crumbs, .abu-h + p, .abu-muted, .pub-lead";
  var sections = $$(SECTION).filter(function (s) { return !s.closest(".pub-hero"); });
  sections.forEach(function (sec) {
    sec.classList.add("fx-sec");
    if (textOn) {
      var h = sec.querySelector(HEADS);
      if (h && h.textContent.length < 160) split(h, 90);
    }
    $$(UPS, sec).slice(0, 6).forEach(function (u, k) {
      if (u.closest(".fx-item") || u.hasAttribute("data-reveal")) return;
      u.classList.add("fx-up"); u.style.setProperty("--k", k);
    });
  });
  var secIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      secIO.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -12% 0px", threshold: 0.04 });
  sections.forEach(function (s) { secIO.observe(s); });

  // requestAnimationFrame, with a timer behind it for renderers that never tick it.
  function soon(fn) {
    var done = false;
    function run() { if (!done) { done = true; fn(); } }
    setTimeout(run, 120);
    return requestAnimationFrame(run);
  }

  /* ---------------------------------------------------------- staggered items */
  var ITEMS = [
    ".pub-card", ".pub-person", ".pub-prog", ".pub-evrow", ".pub-vtl__card", ".pub-hod", ".pub-aw", ".pub-quote",
    ".pub-tile", ".pub-ql__item", ".pub-org", ".pub-ni", ".pub-feat", ".pub-vm", ".pub-why__card", ".pub-num",
    ".pub-lv", ".pub-ev", ".pub-ms", ".pub-mini", ".pub-next", ".pub-vote", ".pub-abu__facts > *", ".pub-contact__info > *",
    ".abu-card", ".abu-quote", ".abu-node", ".abu-scale", ".abu-pen", ".hb-stat", ".hb-sem", ".pub-panel", "[data-fx-item]"
  ].map(function (s) { return "main " + s; }).join(",");
  var items = $$(ITEMS).filter(function (el) {
    return !el.hasAttribute("data-reveal") && !el.closest(".pub-hero") && !(el.parentElement && el.parentElement.closest(ITEMS));
  });
  var batch = [], flush = 0;
  var itemIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      itemIO.unobserve(e.target);
      batch.push(e.target);
    });
    if (batch.length && !flush) flush = soon(function () {
      // items that arrive together stagger left-to-right, top-to-bottom
      batch.sort(function (a, b) {
        var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        return (ra.top - rb.top) || (ra.left - rb.left);
      }).forEach(function (el, n) {
        el.style.setProperty("--fx-delay", Math.min(n, 10) * 70 + "ms");
        el.classList.add("is-in");
      });
      batch = []; flush = 0;
    });
  }, { rootMargin: "0px 0px -6% 0px", threshold: 0.06 });
  items.forEach(function (el) {
    // already on screen at load (e.g. after a reload mid-page): show without waiting
    el.classList.add("fx-item");
    itemIO.observe(el);
  });

  /* ---------------------------------------------------------- parallax */
  var PAR = "[data-fx-parallax], main .pub-abu__img, main .pub-vm__wm, main .pub-numbers__head, main .abu-hero__ring";
  var par = scrollOn ? $$(PAR).filter(function (el) { return !el.closest(".pub-hero"); }) : [];
  var visible = new Set();
  if (par.length) {
    var parIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) visible.add(e.target); else visible.delete(e.target); });
    });
    par.forEach(function (el) { parIO.observe(el); });
  }

  /* ---------------------------------------------------------- scroll loop */
  var bar = null;
  if (scrollOn) {
    bar = doc.createElement("div"); bar.className = "fx-progress"; bar.setAttribute("aria-hidden", "true");
    body.appendChild(bar);
  }
  var marquees = $$(".fx-marquee, .pub-marquee, .pub-ticker");
  var lastY = window.scrollY, vel = 0, ticking = false, vh = window.innerHeight;
  window.addEventListener("resize", function () { vh = window.innerHeight; }, { passive: true });
  function frame() {
    ticking = false;
    var y = window.scrollY, dy = y - lastY; lastY = y;
    vel += (dy - vel) * 0.25;
    if (bar) {
      var max = Math.max(1, root.scrollHeight - vh);
      bar.style.transform = "scaleX(" + Math.min(1, y / max).toFixed(4) + ")";
    }
    visible.forEach(function (el) {
      var r = el.getBoundingClientRect();
      var speed = parseFloat(el.getAttribute("data-fx-parallax")) || 0.12;
      var off = ((r.top + r.height / 2) - vh / 2) * -speed;
      el.style.translate = "0 " + off.toFixed(1) + "px";
    });
    var skew = Math.max(-8, Math.min(8, vel * 0.18));
    marquees.forEach(function (m) { m.style.setProperty("--fx-skew", skew.toFixed(2) + "deg"); });
    if (Math.abs(vel) > 0.2) { ticking = true; requestAnimationFrame(frame); }
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  if (scrollOn) { window.addEventListener("scroll", onScroll, { passive: true }); frame(); }

  /* ---------------------------------------------------------- tilt + glare */
  if (fine && scrollOn && motion === "full") {
    var TILT = "main .pub-why__card, main .pub-vm, main .pub-prog, main .pub-org, main .pub-aw, main .pub-ql__item, main .pub-num, main .pub-card, main .abu-card, [data-fx-tilt]";
    $$(TILT).forEach(function (card) {
      card.classList.add("fx-tilt");
      var g = doc.createElement("span"); g.className = "fx-glare"; g.setAttribute("aria-hidden", "true");
      card.appendChild(g);
      var raf = 0, ev = null;
      function apply() {
        raf = 0;
        if (!ev) { card.style.removeProperty("--fx-rx"); card.style.removeProperty("--fx-ry"); card.classList.remove("is-tilting"); return; }
        var r = card.getBoundingClientRect();
        var x = (ev.clientX - r.left) / r.width, yy = (ev.clientY - r.top) / r.height;
        card.style.setProperty("--fx-rx", ((0.5 - yy) * 6).toFixed(2) + "deg");
        card.style.setProperty("--fx-ry", ((x - 0.5) * 8).toFixed(2) + "deg");
        card.style.setProperty("--fx-mx", (x * 100).toFixed(1) + "%");
        card.style.setProperty("--fx-my", (yy * 100).toFixed(1) + "%");
        card.classList.add("is-tilting");
      }
      card.addEventListener("pointermove", function (e) { ev = e; if (!raf) raf = requestAnimationFrame(apply); });
      card.addEventListener("pointerleave", function () { ev = null; if (!raf) raf = requestAnimationFrame(apply); });
    });
  }

  window.EEFx = Object.assign(window.EEFx || {}, { split: split });
})();
