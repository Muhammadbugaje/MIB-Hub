/* Phase 2 teaching pages: live unit counter on the course form, link/upload
   switch on class shelves, copy buttons. No dependencies. */
(function () {
  "use strict";

  // ---- Course registration: live unit meter -------------------------------
  function initMeter(form) {
    var min = +form.dataset.min || 0, max = +form.dataset.max || 24;
    var rmin = +form.dataset.restrictedMin || 0, hasR = !!form.dataset.hasRestricted;
    var totals = form.querySelectorAll("[data-total]"), bar = form.querySelector("[data-bar]");
    var states = form.querySelectorAll("[data-state]"), msgs = form.querySelector("[data-msgs]");
    var submit = form.querySelector("[data-submit]");
    function update() {
      var t = 0, r = 0;
      form.querySelectorAll("input[type=checkbox][data-units]").forEach(function (cb) {
        var li = cb.closest(".tp-course");
        if (li) li.classList.toggle("is-on", cb.checked);
        if (cb.checked) {
          t += +cb.dataset.units || 0;
          if (cb.dataset.kind === "restricted") r += +cb.dataset.units || 0;
        }
      });
      totals.forEach(function (el) { el.textContent = t; });
      if (bar) { bar.style.width = Math.min(100, (100 * t) / max) + "%"; bar.parentElement.classList.toggle("is-over", t > max); }
      var errs = [];
      if (t > max) errs.push(t + " units is more than the maximum of " + max + " per semester (carry-overs included).");
      if (t < min) errs.push("Add " + (min - t) + " more unit" + (min - t === 1 ? "" : "s") + " to reach the minimum of " + min + ".");
      if (rmin && hasR && r < rmin) errs.push("Choose at least " + rmin + " units of restricted electives (" + r + " so far).");
      states.forEach(function (state) {
        state.className = "tp-meter__state " + (t > max ? "is-over" : t < min ? "is-low" : errs.length ? "is-low" : "is-ok");
        state.textContent = t > max ? "Too many" : t < min ? "Below minimum" : errs.length ? "Check electives" : "Ready";
      });
      if (msgs) {
        msgs.innerHTML = "";
        errs.forEach(function (e) { var li = document.createElement("li"); li.className = "is-err"; li.textContent = e; msgs.appendChild(li); });
      }
      if (submit) { submit.disabled = errs.length > 0; submit.title = errs.length ? errs[0] : ""; }
    }
    form.addEventListener("change", update);
    var go = form.querySelector("[data-scroll-meter]");
    if (go) go.addEventListener("click", function () { form.querySelector("[data-meter]").scrollIntoView({ behavior: "smooth", block: "center" }); });
    update();
  }

  // ---- Shelves: link vs upload ----------------------------------------------
  function initSource(form) {
    var buttons = form.querySelectorAll("[data-src]");
    function show(which) {
      buttons.forEach(function (b) { b.classList.toggle("is-on", b.dataset.src === which); b.setAttribute("aria-pressed", b.dataset.src === which ? "true" : "false"); });
      form.querySelectorAll("[data-src-pane]").forEach(function (p) {
        var on = p.dataset.srcPane === which;
        p.hidden = !on;
        p.querySelectorAll("input").forEach(function (i) { if (!on) i.value = ""; });
      });
    }
    buttons.forEach(function (b) { b.addEventListener("click", function () { show(b.dataset.src); }); });
    show(form.dataset.preferLinks === "0" ? "file" : "link");
  }

  // ---- Copy buttons -----------------------------------------------------------
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-copy]");
    if (!btn) return;
    var text = btn.getAttribute("data-copy");
    var done = function () { if (window.EE && EE.Toast && EE.Toast.push) EE.Toast.push("success", "Link copied", "Paste it into your calendar app."); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () {});
    else { var i = btn.parentElement.querySelector("input"); if (i) { i.select(); document.execCommand("copy"); done(); } }
  });

  function boot() {
    document.querySelectorAll("form[data-reg]").forEach(initMeter);
    document.querySelectorAll("form[data-sh-add]").forEach(initSource);
    var today = document.getElementById("today");
    if (today && window.matchMedia("(max-width: 760px)").matches && !location.hash) today.scrollIntoView({ block: "start" });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
