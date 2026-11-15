/* E-mail preview page (superusers): switch e-mail and light / dark / plain text / phone width. */
(function () {
  "use strict";
  var box = document.querySelector("[data-email-preview]");
  if (!box) return;
  var frame = box.querySelector("[data-frame]"), key = null, mode = "light";
  var base = location.pathname.replace(/\/$/, "") + "/";
  function load() {
    var q = mode === "text" ? "?format=text" : mode === "dark" ? "?scheme=dark" : "";
    frame.src = base + key + "/" + q;
    frame.classList.toggle("is-phone", mode === "phone");
  }
  function pick(btn) {
    box.querySelectorAll(".em-prev__item").forEach(function (b) {
      var on = b === btn; b.classList.toggle("is-active", on); b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    key = btn.getAttribute("data-key");
    box.querySelector("[data-subject]").textContent = btn.getAttribute("data-e-subject");
    box.querySelector("[data-when]").textContent = btn.getAttribute("data-e-when");
    box.querySelector("[data-template]").textContent = btn.getAttribute("data-e-template");
    load();
  }
  box.addEventListener("click", function (e) {
    var it = e.target.closest(".em-prev__item");
    if (it) return pick(it);
    var m = e.target.closest("[data-mode]");
    if (m) {
      mode = m.getAttribute("data-mode");
      box.querySelectorAll("[data-mode]").forEach(function (b) {
        var on = b === m; b.classList.toggle("is-active", on); b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      load();
    }
  });
  var first = box.querySelector(".em-prev__item");
  if (first) pick(first);
})();
