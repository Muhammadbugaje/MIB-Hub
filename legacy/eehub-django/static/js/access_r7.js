/* Round 7 access screens (R7A): the grant form's person picker and "what" switch. */
(function () {
  "use strict";
  function initGrant(form) {
    var hidden = form.querySelector("[data-grant-user]");
    var chosen = form.querySelector("[data-chosen]");
    var search = form.querySelector("[data-person-search]");
    form.addEventListener("click", function (e) {
      var b = e.target.closest("[data-pick-person]");
      if (b) {
        hidden.value = b.getAttribute("data-pick-person");
        chosen.querySelector("[data-chosen-name]").textContent = b.getAttribute("data-name");
        chosen.querySelector("[data-chosen-meta]").textContent = b.getAttribute("data-email") || "";
        var ini = b.querySelector(".avatar");
        chosen.querySelector("[data-chosen-initials]").textContent = ini ? ini.textContent : "";
        chosen.hidden = false; search.hidden = true;
        return;
      }
      if (e.target.closest("[data-chosen-clear]")) {
        hidden.value = ""; chosen.hidden = true; search.hidden = false;
        var input = search.querySelector("input"); if (input) input.focus();
      }
    });
    form.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && e.target.matches('input[type="search"]')) e.preventDefault();
    });
    var radios = form.querySelectorAll('input[name="what"]');
    function sync() {
      var v = (form.querySelector('input[name="what"]:checked') || {}).value || "perms";
      form.querySelectorAll("[data-what]").forEach(function (el) { el.hidden = el.getAttribute("data-what") !== v; });
    }
    radios.forEach(function (r) { r.addEventListener("change", sync); });
    sync();
  }
  function initBroadcast(form) {
    function sync() {
      var v = (form.querySelector('input[name="audience"]:checked') || {}).value || "level";
      form.querySelectorAll("[data-audience]").forEach(function (el) { el.hidden = el.getAttribute("data-audience") !== v; });
    }
    form.querySelectorAll('input[name="audience"]').forEach(function (r) { r.addEventListener("change", sync); });
    sync();
  }
  function boot() {
    document.querySelectorAll("[data-grant-form]").forEach(initGrant);
    document.querySelectorAll("[data-broadcast-form]").forEach(initBroadcast);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
