/* EE Hub CBT: examiner pages (question form, live monitor). */
(function () {
  "use strict";

  // ---- question form: show the fields for the chosen kind ----------------
  var form = document.querySelector("[data-qform]");
  if (form) {
    var parts = form.querySelectorAll("[data-for]");
    var sync = function () {
      var k = (form.querySelector("input[name=kind]:checked") || {}).value || "single";
      parts.forEach(function (p) {
        var on = p.getAttribute("data-for").split(" ").indexOf(k) >= 0;
        p.hidden = !on;
      });
      form.querySelectorAll(".cb-kind").forEach(function (l) {
        var i = l.querySelector("input"); l.classList.toggle("is-on", !!(i && i.checked));
      });
      // one-answer questions: ticking one right answer clears the others
      form.dataset.kind = k;
    };
    form.addEventListener("change", function (e) {
      if (e.target.name === "kind" || e.target.name === "tf_answer") sync();
      if (form.dataset.kind === "single" && /^correct_\d$/.test(e.target.name) && e.target.checked) {
        form.querySelectorAll("input[name^=correct_]").forEach(function (c) { if (c !== e.target) c.checked = false; });
      }
    });
    sync();
  }

  // ---- live monitor --------------------------------------------------------
  // HTMX polls the panel every 5 s unless the invigilator is busy with it.
  window.cbtMonitorIdle = function () {
    if (document.hidden) return false;
    if (document.querySelector(".ee-confirm")) return false;
    if (document.querySelector(".cb-menu[open]")) return false;
    var a = document.activeElement;
    return !(a && a.closest && a.closest("#cb-mon") && a.matches("input, select, textarea"));
  };
  document.addEventListener("click", function (e) {
    document.querySelectorAll(".cb-menu[open]").forEach(function (m) { if (!m.contains(e.target)) m.removeAttribute("open"); });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") document.querySelectorAll(".cb-menu[open]").forEach(function (m) { m.removeAttribute("open"); });
  });
})();
