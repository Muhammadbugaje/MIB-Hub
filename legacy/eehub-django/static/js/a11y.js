/* EE Hub — a11y.js (Round 5F)
   Small, shared accessibility helpers loaded by every base template.
   - Open modal dialogs trap Tab; click-only tabs get arrow keys; dropdown
     menus open and move with the arrow keys.
   - Scroll containers (wide tables, file lists) that actually scroll become
     keyboard-reachable regions with a name (WCAG 2.1.1, axe
     scrollable-region-focusable).
   Runs on load, on resize and after HTMX swaps. No dependencies. */
(function () {
  "use strict";
  var SEL = ".ee-table-wrap, .p6-table-wrap, .table-wrap, .files-folders, .app-content .ee-list, [data-scroll-region]";
  var FOCUSABLE = "a[href], button:not([disabled]), input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex='-1'])";

  function nameFor(el) {
    var cap = el.querySelector("caption");
    if (cap && cap.textContent.trim()) return cap.textContent.trim();
    var card = el.closest(".ee-card, section, .card");
    var h = card && card.querySelector("h1, h2, h3, h4");
    if (h && h.textContent.trim()) return h.textContent.trim().replace(/\s+/g, " ") + (el.querySelector("table") ? " table" : " list");
    return el.querySelector("table") ? "Scrollable table" : "Scrollable list";
  }

  function scrolls(el) {
    var s = getComputedStyle(el);
    var x = /(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 1;
    var y = /(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1;
    return x || y;
  }

  function apply(root) {
    (root || document).querySelectorAll(SEL).forEach(function (el) {
      if (el.hasAttribute("data-a11y-region")) {
        if (!scrolls(el)) { el.removeAttribute("tabindex"); el.removeAttribute("data-a11y-region"); }
        return;
      }
      if (el.hasAttribute("tabindex") || !scrolls(el)) return;
      // A region whose content is already focusable can be scrolled by tabbing through it.
      if (el.querySelector(FOCUSABLE) && !el.querySelector("table")) return;
      el.setAttribute("tabindex", "0");
      el.setAttribute("data-a11y-region", "");
      if (el.tagName === "DIV" && !el.hasAttribute("role")) el.setAttribute("role", "region");
      if (!el.hasAttribute("aria-label") && !el.hasAttribute("aria-labelledby")) el.setAttribute("aria-label", nameFor(el));
    });
  }

  /* ---- Keyboard: modal focus trap ---------------------------------------
     Any open [aria-modal="true"] dialog keeps Tab inside it (2.4.3). Dialogs
     that already trap (EEConfirm, ui.js sheets) are unaffected: the focus
     is already inside and stays there. */
  function shown(el) {
    if (!el || el.closest("[aria-hidden='true'], [hidden], [inert]")) return false;
    var s = getComputedStyle(el), r = el.getBoundingClientRect();
    return s.visibility !== "hidden" && s.display !== "none" && r.width > 0 && r.height > 0 &&
      r.right > 0 && r.left < window.innerWidth && r.bottom > 0 && r.top < window.innerHeight;
  }
  function focusables(root) {
    return Array.prototype.filter.call(root.querySelectorAll(FOCUSABLE), function (el) {
      return el.tabIndex >= 0 && shown(el) && !el.disabled;
    });
  }
  function openModal() {
    var all = document.querySelectorAll("[aria-modal='true']"), top = null;
    for (var i = 0; i < all.length; i++) if (shown(all[i])) top = all[i];
    return top;
  }
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Tab" || e.defaultPrevented) return;
    var m = openModal(); if (!m) return;
    var f = focusables(m); if (!f.length) return;
    var first = f[0], last = f[f.length - 1], a = document.activeElement;
    if (!m.contains(a)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
    else if (e.shiftKey && a === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
  });

  /* ---- Keyboard: tabs that only handle clicks get arrow keys ------------ */
  document.addEventListener("keydown", function (e) {
    if (e.defaultPrevented) return;
    var tab = e.target.closest && e.target.closest("[role='tab']");
    if (!tab) return;
    var list = tab.closest("[role='tablist']"); if (!list) return;
    var tabs = Array.prototype.slice.call(list.querySelectorAll("[role='tab']"));
    var i = tabs.indexOf(tab), n = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") n = tabs[(i + 1) % tabs.length];
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = tabs[(i - 1 + tabs.length) % tabs.length];
    else if (e.key === "Home") n = tabs[0];
    else if (e.key === "End") n = tabs[tabs.length - 1];
    if (!n) return;
    e.preventDefault(); n.focus(); n.click();
  });

  /* ---- Keyboard: dropdown menus (top bar profile switcher, bell) -------- */
  function menuItems(menu) {
    return Array.prototype.filter.call(menu.querySelectorAll("a[href], button:not([disabled])"), shown);
  }
  document.addEventListener("keydown", function (e) {
    if (e.defaultPrevented) return;
    var trig = e.target.closest && e.target.closest("[data-dropdown-trigger]");
    if (trig && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      var menu = document.getElementById(trig.getAttribute("data-dropdown-trigger"));
      if (!menu) return;
      e.preventDefault();
      if (trig.getAttribute("aria-expanded") !== "true") trig.click();
      setTimeout(function () { var it = menuItems(menu); if (it.length) (e.key === "ArrowUp" ? it[it.length - 1] : it[0]).focus(); }, 60);
      return;
    }
    var inMenu = e.target.closest && e.target.closest("[data-dropdown-menu]");
    if (!inMenu || ["ArrowDown", "ArrowUp", "Home", "End"].indexOf(e.key) < 0) return;
    var items = menuItems(inMenu), k = items.indexOf(document.activeElement);
    if (!items.length) return;
    e.preventDefault();
    if (e.key === "Home") k = 0; else if (e.key === "End") k = items.length - 1;
    else k = (k + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[k].focus();
  });

  var t;
  function soon() { clearTimeout(t); t = setTimeout(function () { apply(document); }, 150); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { apply(document); });
  else apply(document);
  window.addEventListener("load", soon);
  window.addEventListener("resize", soon);
  document.addEventListener("htmx:afterSwap", soon);
})();
