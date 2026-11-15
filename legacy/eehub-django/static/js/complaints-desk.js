/* Complaints form: show the course / "about" field for the chosen category; hide "anonymous" where not allowed. */
(function () {
  "use strict";
  function init() {
    var form = document.querySelector("[data-cp-form]");
    if (!form) return;
    function sync() {
      var r = form.querySelector('input[name="category"]:checked');
      var about = r ? r.getAttribute("data-about") : "";
      form.querySelectorAll("[data-cp-about]").forEach(function (el) {
        el.hidden = (el.getAttribute("data-cp-about") || "").split(" ").indexOf(about) === -1;
      });
      var anon = form.querySelector("[data-cp-anon]");
      if (anon) {
        var ok = !r || r.getAttribute("data-anon") === "1";
        anon.hidden = !ok;
        if (!ok) { var cb = anon.querySelector("input"); if (cb) cb.checked = false; }
      }
    }
    form.addEventListener("change", function (e) { if (e.target.name === "category") sync(); });
    sync();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
