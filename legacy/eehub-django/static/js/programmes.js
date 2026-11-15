/* Phase 8 (SIWES, projects, careers, e-library): small page helpers. */
(function () {
  "use strict";
  function toast(msg, kind) { if (window.EE && EE.Toast && EE.Toast.push) EE.Toast.push(kind || "success", msg, ""); }
  // Copy buttons: <input data-pg-copy-src> + <button data-pg-copy>
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-pg-copy]");
    if (!btn) return;
    var box = btn.parentElement.querySelector("[data-pg-copy-src]") || document.querySelector(btn.getAttribute("data-pg-copy"));
    if (!box) return;
    var text = box.value || box.textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () {
      toast("Copied.");
    }, function () { box.select && box.select(); document.execCommand && document.execCommand("copy"); toast("Copied."); });
  });
  // Placement form: picking a directory company fills and locks its name.
  var form = document.querySelector("[data-pg-placement]");
  if (form) {
    var pick = form.querySelector("[name=company_pick]"), name = form.querySelector("[name=company_name]");
    var sync = function () {
      if (!pick || !name) return;
      var on = !!pick.value;
      if (on) name.value = pick.options[pick.selectedIndex].text;
      name.readOnly = on;
    };
    pick && pick.addEventListener("change", sync); sync();
  }
  // Panel score sheet: live total.
  var sheet = document.querySelector("[data-pg-sheet]");
  if (sheet) {
    var out = sheet.querySelector("[data-pg-total]");
    var sum = function () {
      var t = 0;
      sheet.querySelectorAll("[data-pg-mark]").forEach(function (i) { var v = parseFloat(i.value); if (!isNaN(v)) t += v; });
      out.textContent = Math.round(t * 100) / 100;
    };
    sheet.addEventListener("input", sum); sum();
  }
  // Auto-submit selects marked data-pg-autosubmit.
  document.querySelectorAll("select[data-pg-autosubmit]").forEach(function (s) { s.addEventListener("change", function () { s.form.submit(); }); });
})();
