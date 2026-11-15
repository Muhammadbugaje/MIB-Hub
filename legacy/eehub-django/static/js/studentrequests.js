/* Student requests: print, and "a minute is required" for return / decline. */
(function () {
  "use strict";
  function init() {
    document.querySelectorAll("[data-rq-print]").forEach(function (b) { b.addEventListener("click", function () { window.print(); }); });
    var form = document.querySelector("[data-rq-decide]");
    if (form) {
      var note = form.querySelector("textarea[name=note]");
      form.querySelectorAll("[data-rq-needs-note]").forEach(function (btn) {
        btn.addEventListener("click", function (e) {
          if (note && !note.value.trim()) {
            e.preventDefault();
            e.stopImmediatePropagation();
            note.setAttribute("aria-invalid", "true");
            note.placeholder = "Write a minute first: say what is missing, or why you decline.";
            note.focus();
            if (window.EE && EE.Toast) EE.Toast.show ? EE.Toast.show("Write a minute first.", "warning") : null;
          }
        }, true);
      });
    }
    if (location.hash === "#decide") {
      var t = document.querySelector("#decide textarea");
      if (t) t.focus();
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
