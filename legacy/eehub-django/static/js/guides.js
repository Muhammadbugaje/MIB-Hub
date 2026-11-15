/* Help and how-to (R6G): hub search + audience filter, screenshot lightbox. */
(function () {
  "use strict";
  var hub = document.querySelector("[data-guides-hub]");
  if (hub) {
    var input = hub.querySelector("[data-guides-search]");
    var chips = hub.querySelectorAll("[data-aud-filter]");
    var cards = hub.querySelectorAll("[data-guide]");
    var areas = hub.querySelectorAll("[data-guides-area]");
    var featured = hub.querySelector("[data-guides-featured]");
    var empty = hub.querySelector("[data-guides-empty]");
    var pressed = hub.querySelector('[data-aud-filter][aria-pressed="true"]');
    var aud = pressed ? pressed.getAttribute("data-aud-filter") : "all";
    var KEY = "ee-guides-aud";
    try { var saved = sessionStorage.getItem(KEY); if (saved && hub.querySelector('[data-aud-filter="' + saved + '"]')) aud = saved; } catch (e) {}
    var apply = function () {
      var q = (input && input.value || "").trim().toLowerCase();
      var words = q ? q.split(/\s+/) : [];
      var shown = 0;
      cards.forEach(function (c) {
        var okAud = aud === "all" || (aud === "mine" ? c.getAttribute("data-mine") === "1" : c.getAttribute("data-aud") === aud);
        var hay = c.getAttribute("data-search") || "";
        var okQ = words.every(function (w) { return hay.indexOf(w) !== -1; });
        var ok = okAud && okQ;
        c.hidden = !ok;
        if (ok) shown++;
      });
      areas.forEach(function (a) { a.hidden = !a.querySelector("[data-guide]:not([hidden])"); });
      if (featured) featured.hidden = !!q;
      if (empty) empty.hidden = shown > 0;
      chips.forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-aud-filter") === aud ? "true" : "false"); });
    };
    chips.forEach(function (b) {
      b.addEventListener("click", function () {
        aud = b.getAttribute("data-aud-filter");
        try { sessionStorage.setItem(KEY, aud); } catch (e) {}
        apply();
      });
    });
    if (input) {
      input.addEventListener("input", apply);
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { var first = hub.querySelector("[data-guide]:not([hidden])"); if (first) first.click(); }
      });
      var params = new URLSearchParams(location.search);
      if (params.get("q")) { input.value = params.get("q"); }
    }
    apply();
  }
  var box = document.querySelector("[data-guide-lightbox]");
  if (box && box.showModal) {
    var img = box.querySelector("img");
    document.addEventListener("click", function (e) {
      var a = e.target.closest("[data-guide-zoom]");
      if (!a) return;
      e.preventDefault();
      img.src = a.getAttribute("href");
      img.alt = (a.querySelector("img") || {}).alt || "";
      box.showModal();
    });
    box.addEventListener("click", function (e) { if (e.target === box || e.target.closest("[data-close]")) box.close(); });
  }
})();
