/* EE Hub — pwa.js (Round 5G)
   Installable app support. Everything here is optional: without a service
   worker (old browser, private mode, blocked) the site works exactly the same.

   - registers /sw.js (scope "/")
   - update flow: "A new version of EE Hub is ready — Refresh"
   - install: [data-pwa-install] buttons (profile menu, phone drawer) appear when
     the browser offers installation; on iPhone/iPad they explain "Add to Home Screen"
   - privacy: pages saved for offline use are deleted on sign-out or when a
     different person signs in on this device */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement;
  var PAGE_CACHE = "ee-pages-v1";
  var deferredPrompt = null;

  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function standalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
  }
  function isIOS() {
    var ua = navigator.userAgent || "";
    return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  }
  function clearSavedPages() {
    try { if (window.caches) caches.delete(PAGE_CACHE); } catch (e) {}
    try {
      if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "clear-pages" });
      }
    } catch (e) {}
  }
  if (standalone()) root.classList.add("is-standalone");

  /* ---- Privacy: a different person on this device -> forget saved pages ---------------- */
  (function () {
    var meta = doc.querySelector('meta[name="ee-user"]');
    if (!meta) return;
    var now = meta.getAttribute("content") || "";
    var before = null;
    try { before = localStorage.getItem("ee-sw-user"); } catch (e) {}
    if (before !== null && before !== now) clearSavedPages();
    try { localStorage.setItem("ee-sw-user", now); } catch (e) {}
  })();
  doc.addEventListener("submit", function (e) {
    var f = e.target;
    if (f && f.action && /\/accounts\/logout\/?/.test(f.action)) clearSavedPages();
  }, true);

  /* ---- Install --------------------------------------------------------------------------- */
  function showInstall(on) {
    $$("[data-pwa-install]").forEach(function (b) { b.hidden = !on; });
  }
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    showInstall(true);
  });
  window.addEventListener("appinstalled", function () {
    deferredPrompt = null;
    showInstall(false);
    if (window.EE && EE.Toast) EE.Toast.push("success", "EE Hub is installed", "Open it from your home screen or app list.");
  });
  if (isIOS() && !standalone()) showInstall(true);

  function iosSheet() {
    var sheet = doc.getElementById("ee-ios-install");
    if (!sheet) {
      sheet = doc.createElement("div");
      sheet.id = "ee-ios-install";
      sheet.className = "ee-install-sheet";
      sheet.setAttribute("role", "dialog");
      sheet.setAttribute("aria-modal", "true");
      sheet.setAttribute("aria-labelledby", "ee-ios-install-title");
      sheet.innerHTML =
        '<div class="ee-install-sheet__card">' +
        '<img src="/static/img/icons/icon-192.png" alt="" width="56" height="56">' +
        '<h2 id="ee-ios-install-title">Install EE Hub</h2>' +
        '<ol><li>Tap <b>Share</b> <span aria-hidden="true">(the square with an arrow)</span> in Safari.</li>' +
        '<li>Choose <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b>. EE Hub opens like an app.</li></ol>' +
        '<button type="button" class="btn btn-primary" data-sheet-close>Got it</button></div>';
      doc.body.appendChild(sheet);
      sheet.addEventListener("click", function (e) {
        if (e.target === sheet || e.target.closest("[data-sheet-close]")) sheet.classList.remove("is-open");
      });
      doc.addEventListener("keydown", function (e) { if (e.key === "Escape") sheet.classList.remove("is-open"); });
    }
    sheet.classList.add("is-open");
    var btn = sheet.querySelector("[data-sheet-close]");
    if (btn) btn.focus();
  }
  doc.addEventListener("click", function (e) {
    var b = e.target.closest("[data-pwa-install]");
    if (!b) return;
    e.preventDefault();
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (choice) {
        if (choice && choice.outcome === "accepted") showInstall(false);
        deferredPrompt = null;
      });
    } else if (isIOS()) {
      iosSheet();
    }
  });

  /* ---- Service worker + update flow ------------------------------------------------------ */
  if (!("serviceWorker" in navigator) || root.getAttribute("data-sw") === "off") return;
  if (!(location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) return;

  var reloading = false;
  function showUpdate(worker) {
    if (doc.getElementById("ee-update")) return;
    var bar = doc.createElement("div");
    bar.id = "ee-update";
    bar.className = "ee-update";
    bar.setAttribute("role", "status");
    bar.setAttribute("aria-live", "polite");
    bar.innerHTML =
      '<span class="ee-update__ic" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg></span>' +
      '<span class="ee-update__text">A new version of EE Hub is ready</span>' +
      '<button type="button" class="ee-update__go" data-update-go>Refresh</button>' +
      '<button type="button" class="ee-update__x" data-update-x aria-label="Later">&times;</button>';
    doc.body.appendChild(bar);
    requestAnimationFrame(function () { bar.classList.add("is-in"); });
    bar.addEventListener("click", function (e) {
      if (e.target.closest("[data-update-go]")) {
        e.target.closest("[data-update-go]").disabled = true;
        worker.postMessage({ type: "skip-waiting" });
        setTimeout(function () { if (!reloading) location.reload(); }, 3000);
      } else if (e.target.closest("[data-update-x]")) {
        bar.classList.remove("is-in");
        setTimeout(function () { bar.remove(); }, 250);
      }
    });
  }
  window.EEPwa = { showUpdate: showUpdate, clearSavedPages: clearSavedPages, isStandalone: standalone };

  // Reload only when an existing worker was replaced (the person pressed Refresh),
  // never on the very first install, when the new worker just claims the page.
  var hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", function () {
    if (reloading || !hadController) { hadController = true; return; }
    reloading = true;
    location.reload();
  });

  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).then(function (reg) {
      if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
      reg.addEventListener("updatefound", function () {
        var nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", function () {
          if (nw.state === "installed" && navigator.serviceWorker.controller) showUpdate(nw);
        });
      });
      // Look for a new version when the tab comes back, and every 30 minutes.
      doc.addEventListener("visibilitychange", function () { if (doc.visibilityState === "visible") reg.update().catch(function () {}); });
      setInterval(function () { reg.update().catch(function () {}); }, 30 * 60 * 1000);
    }).catch(function () { /* no worker: the site still works */ });
  });
})();
