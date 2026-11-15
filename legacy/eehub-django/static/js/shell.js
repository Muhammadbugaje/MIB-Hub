/* EE Hub — app shell behaviour (round 2, NBTE Phase 8 navigation).
   No dependencies. Works on top of app.js (group toggles), ui.js (drawer,
   focus trap) and apple.js (tab bar hides on scroll down).
   - Profile switch: the thumb slides to the chosen segment before the form
     submits, so the switch feels instant; one submit only.
   - The group holding the current page is always open, whatever was saved.
   - The 3+ profile sheet closes on Escape or a tap outside it.
   - The tab bar also hides while an input has focus on phones (keyboard up). */
(function () {
  "use strict";

  // ---- Profile switch ------------------------------------------------------
  document.addEventListener("click", function (e) {
    var seg = e.target.closest(".ee-pswitch__seg");
    if (!seg) return;
    if (seg.classList.contains("is-active")) { e.preventDefault(); return; }
    var form = seg.form;
    var track = seg.closest(".ee-pswitch__track");
    if (!form || !track || form.classList.contains("is-switching")) { e.preventDefault(); return; }
    e.preventDefault();
    track.style.setProperty("--i", seg.getAttribute("data-index") || "0");
    track.querySelectorAll(".ee-pswitch__seg").forEach(function (b) {
      var on = b === seg;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    form.classList.add("is-switching");
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(function () {
      if (form.requestSubmit) form.requestSubmit(seg);
      else {
        var h = document.createElement("input");
        h.type = "hidden"; h.name = "key"; h.value = seg.value;
        form.appendChild(h); form.submit();
      }
    }, reduce ? 0 : 220);
  });

  // Every switch form: submit once.
  document.addEventListener("submit", function (e) {
    var form = e.target.closest("form[data-profile-switch]");
    if (!form) return;
    if (form.dataset.sent) { e.preventDefault(); return; }
    form.dataset.sent = "1";
    form.classList.add("is-switching");
    if (window.EE && EE.PageLoader && EE.PageLoader.show) { try { EE.PageLoader.show(); } catch (err) {} }
  });
  // Back/forward cache: allow switching again.
  window.addEventListener("pageshow", function () {
    document.querySelectorAll("form[data-profile-switch]").forEach(function (f) {
      delete f.dataset.sent; f.classList.remove("is-switching");
    });
  });

  // ---- Keep the current group open ----------------------------------------
  function openActiveGroup() {
    document.querySelectorAll(".ee-nav .app-nav-group.has-active").forEach(function (g) {
      g.classList.add("is-open");
      var head = g.querySelector(".app-nav-group-head");
      if (head) head.setAttribute("aria-expanded", "true");
    });
  }

  // ---- 3+ profile sheet in the tab bar ------------------------------------
  function closeSheets(except) {
    document.querySelectorAll("details.app-tab-sheet[open]").forEach(function (d) {
      if (d !== except) d.removeAttribute("open");
    });
  }
  document.addEventListener("click", function (e) {
    closeSheets(e.target.closest("details.app-tab-sheet"));
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheets(null); });

  // ---- Tab bar out of the way while typing on a phone ---------------------
  var tabbar = document.querySelector("[data-tabbar]");
  function typing(el) { return el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) && !/^(checkbox|radio|button|submit)$/.test(el.type || ""); }
  if (tabbar) {
    document.addEventListener("focusin", function (e) { if (typing(e.target)) tabbar.classList.add("is-hidden-by-drawer"); });
    document.addEventListener("focusout", function () {
      setTimeout(function () {
        var shell = document.querySelector(".app-shell");
        if (!typing(document.activeElement) && !(shell && shell.classList.contains("sidebar-open"))) tabbar.classList.remove("is-hidden-by-drawer");
      }, 50);
    });
  }

  // ---- Short search placeholder on phones ---------------------------------
  function searchPlaceholder() {
    var box = document.querySelector("[data-ee-search]");
    if (!box || !window.matchMedia) return;
    if (!box.dataset.longPlaceholder) box.dataset.longPlaceholder = box.getAttribute("placeholder") || "";
    box.setAttribute("placeholder", window.matchMedia("(max-width: 640px)").matches ? "Search" : box.dataset.longPlaceholder);
  }

  function init() {
    setTimeout(openActiveGroup, 0);
    searchPlaceholder();
    if (window.matchMedia) {
      var mq = window.matchMedia("(max-width: 640px)");
      if (mq.addEventListener) mq.addEventListener("change", searchPlaceholder);
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
