/* EE Hub — "alive" behaviours (Round 4). No dependencies.
   * Count-up for KPI numbers (.ee-kpi__num, .pg-kpi__num, [data-alive-count])
     that do not already use polish.js [data-countup]. The final text is in
     the HTML, so screen readers and no-JS users get the real value.
   * Rings (--p / --pct custom property) fill from zero.
   * Stagger for dashboard widgets that use [data-reveal].
   * Skeleton shimmer on htmx swap targets while a request is in flight.
   * Animated ink under underline tab bars (.pg-tabs, .p6-tabs, [data-ink]).
   * Success check after a form save (Django success message).
   * Marks the page settled so later htmx swaps do not re-stagger rows.
   Everything is skipped when the user prefers reduced motion, by OS setting
   or the in-app setting (html[data-motion="reduce"]). */
(function () {
  "use strict";
  var root = document.documentElement;
  function reduced() {
    return root.getAttribute("data-motion") === "reduce" ||
      (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  var raf = window.requestAnimationFrame || function (f) { return setTimeout(function () { f(Date.now()); }, 16); };
  var ease = function (t) { return 1 - Math.pow(1 - t, 3); };
  var IO = "IntersectionObserver" in window;

  /* ------------------------------------------------------------ count-up */
  var NUM_RE = /^(\D*?)(-?[\d,]*\.?\d+)(\D*)$/;
  function countUp(el) {
    if (el.__aliveCounted) return;
    el.__aliveCounted = true;
    var text = (el.textContent || "").trim();
    var m = NUM_RE.exec(text);
    if (!m || el.children.length > 1) return;
    var raw = m[2].replace(/,/g, "");
    var target = parseFloat(raw);
    if (!isFinite(target) || target === 0 || Math.abs(target) > 1e9) return;
    var decimals = (raw.split(".")[1] || "").length;
    var grouped = m[2].indexOf(",") !== -1 || Math.abs(target) >= 10000;
    var node = null;                                 // count inside the text node; keep any inner <small>
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 3 && /\d/.test(n.nodeValue)) { node = n; break; }
    }
    if (!node) return;
    var original = node.nodeValue;
    var nm = /(-?[\d,]*\.?\d+)/.exec(original);
    if (!nm) return;
    var before = original.slice(0, nm.index), after = original.slice(nm.index + nm[0].length);
    function fmt(v) {
      var s = v.toFixed(decimals);
      if (grouped) {
        var parts = s.split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        s = parts.join(".");
      }
      return s;
    }
    // Hold the box at its final width so nothing beside it moves.
    var w = el.getBoundingClientRect().width;
    if (getComputedStyle(el).display === "inline") el.style.display = "inline-block";
    el.style.minWidth = w + "px";
    el.classList.add("alive-counting");
    var dur = Math.min(1400, 550 + Math.log10(Math.abs(target) + 1) * 200), start = null;
    el.setAttribute("aria-label", text);
    function step(ts) {
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / dur);
      node.nodeValue = before + fmt(target * ease(t)) + after;
      if (t < 1) raf(step);
      else { node.nodeValue = original; el.classList.remove("alive-counting"); el.removeAttribute("aria-label"); }
    }
    node.nodeValue = before + fmt(0) + after;
    raf(step);
  }

  /* --------------------------------------------------------------- rings */
  function ringUp(el) {
    if (el.__aliveRing) return;
    el.__aliveRing = true;
    var prop = el.style.getPropertyValue("--p") ? "--p" : (el.style.getPropertyValue("--pct") ? "--pct" : null);
    if (!prop) return;
    var raw = el.style.getPropertyValue(prop).trim();
    var m = /^(-?[\d.]+)(.*)$/.exec(raw);
    if (!m) return;
    var target = parseFloat(m[1]), unit = m[2];
    if (!isFinite(target) || target <= 0) return;
    var start = null, dur = 1000;
    function step(ts) {
      if (start === null) start = ts;
      var t = Math.min(1, (ts - start) / dur);
      el.style.setProperty(prop, (target * ease(t)).toFixed(2) + unit);
      if (t < 1) raf(step); else el.style.setProperty(prop, raw);
    }
    el.style.setProperty(prop, "0" + unit);
    raf(step);
  }

  var watcher = IO ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      watcher.unobserve(e.target);
      if (e.target.__aliveKind === "ring") ringUp(e.target); else countUp(e.target);
    });
  }, { threshold: 0.2 }) : null;

  var COUNT_SEL = ".ee-kpi__num, .pg-kpi__num, .pg-kpi > b, .pg-kpi > strong, .rs-kpi__num, .ac-kpi__num, .kpi-num, [data-alive-count]";
  var RING_SEL = ".cb-ring, .pn-banner__ring, [data-alive-ring]";

  function scanNumbers(scope) {
    if (reduced() || !watcher) return;
    (scope || document).querySelectorAll(COUNT_SEL).forEach(function (el) {
      if (el.hasAttribute("data-countup") || el.closest("[data-countup], [data-no-count]") || el.__aliveSeen) return;
      el.__aliveSeen = true; el.__aliveKind = "num";
      watcher.observe(el);
    });
    (scope || document).querySelectorAll(RING_SEL).forEach(function (el) {
      if (el.__aliveSeen) return;
      el.__aliveSeen = true; el.__aliveKind = "ring";
      watcher.observe(el);
    });
  }

  /* -------------------------------------------- stagger [data-reveal] */
  function staggerReveals(scope) {
    var groups = new Map();
    (scope || document).querySelectorAll("[data-reveal]").forEach(function (el) {
      if (el.style.transitionDelay || el.hasAttribute("data-reveal-delay")) return;
      var p = el.parentElement;
      var n = groups.get(p) || 0;
      groups.set(p, n + 1);
      if (n) el.style.transitionDelay = Math.min(n, 6) * 40 + "ms";
    });
  }

  /* --------------------------------------------------- htmx skeletons */
  function targetOf(evt) {
    var d = evt.detail || {};
    return d.target || (d.elt && d.elt.closest && d.elt);
  }
  document.addEventListener("htmx:beforeRequest", function (evt) {
    if (reduced()) return;
    var t = targetOf(evt), elt = evt.detail && evt.detail.elt;
    if (!t || !t.classList || t === document.body || t.tagName === "BODY") return;
    if (elt && elt.closest && elt.closest("form") && t.contains(elt)) return;   // typing in a form inside the target
    if (t.offsetHeight < 40 || t.offsetHeight > 2400) return;
    t.__aliveTimer = setTimeout(function () { t.classList.add("alive-loading"); t.setAttribute("aria-busy", "true"); }, 140);
  });
  function clearLoading(evt) {
    var t = targetOf(evt);
    if (!t || !t.classList) return;
    clearTimeout(t.__aliveTimer);
    t.classList.remove("alive-loading");
    if (t.getAttribute("aria-busy") === "true") t.removeAttribute("aria-busy");
  }
  document.addEventListener("htmx:afterRequest", clearLoading);
  document.addEventListener("htmx:responseError", clearLoading);
  document.addEventListener("htmx:sendError", clearLoading);
  document.addEventListener("htmx:afterSettle", function (evt) {
    var t = targetOf(evt);
    if (t && t.querySelectorAll) { scanNumbers(t); initInk(t); }
  });

  /* ------------------------------------------------------------ tab ink */
  var INK_SEL = ".pg-tabs, .p6-tabs, [data-ink]";
  var ACTIVE_SEL = ".is-on, .is-active, [aria-selected='true'], [aria-current='page']";
  function inkKey(bar) { return "ee-ink:" + location.pathname.split("/").slice(0, 3).join("/") + ":" + bar.className; }
  function placeInk(bar, ink, animate) {
    var active = null;
    for (var i = 0; i < bar.children.length; i++) {
      var c = bar.children[i];
      if (c !== ink && c.matches(ACTIVE_SEL)) { active = c; break; }
    }
    if (!active) { ink.style.opacity = "0"; return; }
    ink.style.opacity = "1";
    var x = active.offsetLeft, w = active.offsetWidth;
    if (!animate) ink.style.transition = "none";
    ink.style.width = "1px";
    ink.style.transform = "translateX(" + x + "px) scaleX(" + w + ")";
    if (!animate) { void ink.offsetWidth; ink.style.transition = ""; }
    try { sessionStorage.setItem(inkKey(bar), x + "," + w); } catch (e) {}
  }
  function initInk(scope) {
    (scope || document).querySelectorAll(INK_SEL).forEach(function (bar) {
      if (bar.__aliveInk) return;
      var hasActive = false;
      for (var i = 0; i < bar.children.length; i++) if (bar.children[i].matches(ACTIVE_SEL)) hasActive = true;
      if (!hasActive) return;
      bar.__aliveInk = true;
      var ink = document.createElement("span");
      ink.className = "alive-ink";
      ink.setAttribute("aria-hidden", "true");
      bar.classList.add("alive-has-ink");
      bar.appendChild(ink);
      var prev = null;
      try { prev = sessionStorage.getItem(inkKey(bar)); } catch (e) {}
      if (prev && !reduced()) {
        var p = prev.split(",");
        ink.style.transition = "none";
        ink.style.transform = "translateX(" + p[0] + "px) scaleX(" + p[1] + ")";
        void ink.offsetWidth;
        ink.style.transition = "";
        raf(function () { raf(function () { placeInk(bar, ink, true); }); });
      } else {
        placeInk(bar, ink, false);
      }
      // In-page tabs (aria-selected / class toggles) slide the ink too.
      if ("MutationObserver" in window) {
        new MutationObserver(function () { placeInk(bar, ink, !reduced()); })
          .observe(bar, { attributes: true, subtree: true, attributeFilter: ["class", "aria-selected", "aria-current"] });
      }
      window.addEventListener("resize", function () { placeInk(bar, ink, false); });
    });
  }

  /* --------------------------------------------------- success check */
  function successCheck() {
    if (reduced()) return;
    // app.js turns Django messages into toasts before this runs; read either.
    var msg = document.querySelector("[data-toast='success'], .toast.toast-success, .messages .success");
    if (!msg || !document.querySelector(".app-content")) return;
    var label = "Saved";                  // the toast beside it carries the message
    var el = document.createElement("div");
    el.className = "alive-success";
    el.setAttribute("aria-hidden", "true");   // the toast already announces it
    el.innerHTML = '<svg viewBox="0 0 30 30"><circle cx="15" cy="15" r="13"/><circle cx="15" cy="15" r="12"/><path d="M9.5 15.5l3.8 3.8L21 11.6"/></svg><span></span>';
    el.querySelector("span").textContent = label;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2400);
  }

  /* ----------------------------------------------------------- boot */
  function boot() {
    staggerReveals(document);
    scanNumbers(document);
    initInk(document);
    successCheck();
    setTimeout(function () { document.body.classList.add("alive-settled"); }, 900);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.EEAlive = { countUp: countUp, scan: scanNumbers, ink: initInk };
})();
