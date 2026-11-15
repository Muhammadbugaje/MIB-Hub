/* Promotion / graduation lists: live count of ticked students and "tick all ready". */
(function () {
  "use strict";
  var picks = Array.prototype.slice.call(document.querySelectorAll("[data-lc-pick]"));
  var count = document.querySelector("[data-lc-count]");
  function refresh() { if (count) count.textContent = picks.filter(function (p) { return p.checked; }).length; }
  picks.forEach(function (p) { p.addEventListener("change", refresh); });
  var ready = document.querySelector("[data-lc-ready]");
  if (ready) ready.addEventListener("click", function () { picks.forEach(function (p) { p.checked = p.dataset.ready === "1"; }); refresh(); });
  var none = document.querySelector("[data-lc-none]");
  if (none) none.addEventListener("click", function () { picks.forEach(function (p) { p.checked = false; }); refresh(); });
  refresh();
})();
