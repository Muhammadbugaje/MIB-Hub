/* Settings → Backups (ported from NBTE Phase 8). Copy buttons, mount picker,
   destination-kind fields, section highlight and the run button state. */
(function () {
  "use strict";

  function toast(kind, title, body) {
    if (window.EE && EE.Toast && EE.Toast.push) EE.Toast.push(kind, title, body || "");
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("[data-bk-copy]");
    if (btn) {
      var el = document.querySelector(btn.getAttribute("data-bk-copy"));
      if (el && navigator.clipboard) {
        navigator.clipboard.writeText(el.textContent.trim()).then(function () {
          toast("success", "Copied to the clipboard");
        });
      }
      return;
    }
    var mount = e.target.closest && e.target.closest("[data-bk-mount]");
    if (mount) {
      var form = mount.closest("form");
      var input = form && form.querySelector("[data-bk-mount-input]");
      if (input) { input.value = mount.getAttribute("data-bk-mount"); input.focus(); }
      if (form) form.querySelectorAll("[data-bk-mount]").forEach(function (b) { b.classList.toggle("is-picked", b === mount); });
    }
  });

  /* show only the fields for the chosen kind */
  function syncKind(form) {
    var picked = form.querySelector("[data-bk-kind]:checked");
    var kind = picked ? picked.value : "local";
    form.querySelectorAll(".bk-kindfields").forEach(function (box) {
      var on = box.getAttribute("data-kind") === kind;
      box.hidden = !on;
      box.querySelectorAll("input, select").forEach(function (i) { i.disabled = !on; });
    });
  }
  function initForms(root) {
    (root || document).querySelectorAll("[data-bk-dest-form]").forEach(function (form) {
      if (form.dataset.bkReady) return;
      form.dataset.bkReady = "1";
      syncKind(form);
      form.addEventListener("change", function (e) { if (e.target.matches("[data-bk-kind]")) syncKind(form); });
    });
  }

  /* section highlight, as on the main settings page */
  function initNav() {
    var links = document.querySelectorAll("[data-sh-nav] a[href^='#']");
    if (!("IntersectionObserver" in window) || !links.length) return;
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) { a.classList.remove("is-active"); });
        if (byId[en.target.id]) byId[en.target.id].classList.add("is-active");
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    Object.keys(byId).forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
  }

  /* while a run is in progress the button is off; when it finishes, it comes back */
  function initRunButton() {
    var form = document.querySelector("[data-bk-run-form]");
    var runBtn = form && form.querySelector("button[type=submit]");
    if (!runBtn || runBtn.hasAttribute("data-no-destination")) return;
    var wasBusy = false;
    setInterval(function () {
      var p = document.getElementById("bk-progress");
      var busy = !!(p && p.hasAttribute("hx-get"));
      if (!form.classList.contains("htmx-request")) runBtn.disabled = busy;
      if (wasBusy && !busy && p) {
        var status = p.getAttribute("data-bk-status");
        if (status === "succeeded") toast("success", "Backup finished");
        else if (status === "partial") toast("warning", "Backup finished with problems");
        else if (status === "failed") toast("error", "Backup failed");
      }
      wasBusy = busy;
    }, 1000);
  }

  function init() { initForms(); initNav(); initRunButton(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  document.addEventListener("htmx:afterSwap", function (e) { initForms(e.target); });
})();
