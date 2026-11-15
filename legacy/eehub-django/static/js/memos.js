/* Memos: compose (memo / circular switch) and the desk action panels. */
(function () {
  "use strict";

  function initCompose() {
    var form = document.querySelector("[data-mm-compose]");
    if (!form) return;
    function sync() {
      var kind = (form.querySelector("[data-mm-kind]:checked") || {}).value || "memo";
      form.querySelectorAll("[data-mm-memo-only]").forEach(function (el) { el.hidden = kind === "circular"; });
      form.querySelectorAll("[data-mm-circular-only]").forEach(function (el) { el.hidden = kind !== "circular"; });
    }
    form.querySelectorAll("[data-mm-kind]").forEach(function (r) { r.addEventListener("change", sync); });
    sync();
  }

  function initActions() {
    var bar = document.querySelector("[data-mm-actions]");
    if (!bar) return;
    var panels = bar.querySelectorAll("[data-mm-panel]");
    function show(name) {
      panels.forEach(function (p) { p.hidden = p.getAttribute("data-mm-panel") !== name; });
      bar.querySelectorAll("[data-mm-open]").forEach(function (b) {
        b.classList.toggle("is-on", b.getAttribute("data-mm-open") === name);
        b.setAttribute("aria-expanded", b.getAttribute("data-mm-open") === name ? "true" : "false");
      });
      var p = bar.querySelector('[data-mm-panel="' + name + '"]');
      if (p) {
        var t = p.querySelector("textarea");
        if (t) t.focus();
      }
    }
    bar.querySelectorAll("[data-mm-open]").forEach(function (b) {
      b.setAttribute("aria-expanded", "false");
      b.addEventListener("click", function () {
        var name = b.getAttribute("data-mm-open");
        if (name === "minute") {
          var box = document.querySelector("[data-mm-minute] textarea");
          if (box) { box.scrollIntoView({ behavior: "smooth", block: "center" }); box.focus(); }
          show("");
          return;
        }
        show(b.classList.contains("is-on") ? "" : name);
      });
    });
    bar.querySelectorAll("[data-mm-cancel]").forEach(function (b) { b.addEventListener("click", function () { show(""); }); });
    var other = bar.querySelector("[data-mm-fwd-other]");
    bar.querySelectorAll("[data-mm-fwd-mode]").forEach(function (r) {
      r.addEventListener("change", function () {
        if (other) other.hidden = r.value !== "other" || !r.checked;
        if (r.value === "other" && r.checked) {
          var s = other && other.querySelector("[data-search]");
          if (s) s.focus();
        }
      });
    });
  }

  function initMinute() {
    var f = document.querySelector("[data-mm-minute]");
    if (!f) return;
    var t = f.querySelector("textarea");
    function grow() { t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 220) + "px"; }
    t.addEventListener("input", grow);
    t.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && t.value.trim()) { e.preventDefault(); f.requestSubmit ? f.requestSubmit() : f.submit(); }
    });
  }

  function init() { initCompose(); initActions(); initMinute(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
