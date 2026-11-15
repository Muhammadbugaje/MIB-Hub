/* People directories (round 7, R7B): filter sheet on phones, auto-apply filters on
   desktop, copy the temporary password, and show the right fields when adding staff. */
(function () {
  "use strict";
  var phone = window.matchMedia("(max-width: 859.98px)");

  // On phones the filter sheet lives under <body> so no transformed ancestor traps
  // its fixed position; its fields stay in the filter form through form="...".
  function portalSheet() {
    var sheet = document.querySelector("[data-pp-sheet]");
    var form = document.getElementById("pp-filter-form");
    if (!sheet || !form || !phone.matches || sheet.parentNode === document.body) return;
    sheet.querySelectorAll("input, select, button[type=submit]").forEach(function (el) { el.setAttribute("form", form.id); });
    document.body.appendChild(sheet);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", portalSheet); else portalSheet();

  function openSheet(sheet) {
    if (!sheet) return;
    var scrim = document.createElement("div");
    scrim.className = "pp-scrim";
    scrim.addEventListener("click", function () { closeSheet(sheet); });
    document.body.appendChild(scrim);
    sheet._scrim = scrim;
    sheet.classList.add("is-open");
    var first = sheet.querySelector("select, input, button");
    if (first) first.focus();
    document.documentElement.style.overflow = "hidden";
  }
  function closeSheet(sheet) {
    if (!sheet) return;
    sheet.classList.remove("is-open");
    if (sheet._scrim) { sheet._scrim.remove(); sheet._scrim = null; }
    document.documentElement.style.overflow = "";
    var opener = document.querySelector("[data-pp-sheet-open]");
    if (opener) opener.focus();
  }

  document.addEventListener("click", function (e) {
    var open = e.target.closest("[data-pp-sheet-open]");
    if (open) { openSheet(document.querySelector("[data-pp-sheet]")); return; }
    var close = e.target.closest("[data-pp-sheet-close]");
    if (close) { closeSheet(close.closest("[data-pp-sheet]")); return; }
    var copy = e.target.closest("[data-pp-copy-btn]");
    if (copy) {
      var code = document.querySelector("[data-pp-copy]");
      if (code && navigator.clipboard) {
        navigator.clipboard.writeText(code.textContent.trim()).then(function () {
          copy.textContent = "Copied";
        });
      }
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      var s = document.querySelector("[data-pp-sheet].is-open");
      if (s) closeSheet(s);
    }
  });

  // Desktop: a changed filter applies at once.
  document.addEventListener("change", function (e) {
    var form = e.target.closest("[data-pp-filters]") || (e.target.form && e.target.form.matches("[data-pp-filters]") ? e.target.form : null);
    if (!form || phone.matches) return;
    if (e.target.matches("select, input[type=checkbox]")) {
      if (form.requestSubmit) form.requestSubmit(); else form.submit();
    }
  });

  // Add staff: rank for lecturers, designation for the others.
  function syncAddStaff(form) {
    var kind = form.querySelector("[name=kind]");
    if (!kind) return;
    var academic = kind.value === "academic";
    var rank = form.querySelector("[data-field=rank]");
    var desig = form.querySelector("[data-field=designation]");
    if (rank) rank.hidden = !academic;
    if (desig) desig.hidden = academic;
  }
  document.querySelectorAll("[data-pp-addstaff]").forEach(function (form) {
    syncAddStaff(form);
    form.addEventListener("change", function (e) { if (e.target.name === "kind") syncAddStaff(form); });
  });
})();
