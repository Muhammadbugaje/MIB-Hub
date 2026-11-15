/* EE Hub: small behaviours on top of the NBTE runtime (app.js, ui.js, dialog.js).
   - "/" or Ctrl/Cmd+K focuses the top search box
   - Quick sign-in modal for any link marked [data-signin-modal]
   - [data-copy] buttons copy text
   - Auto-submit for <select data-autosubmit> outside polish.js
*/
(function () {
  "use strict";

  // ---- Keyboard search ------------------------------------------------------
  document.addEventListener("keydown", function (e) {
    var t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    var box = document.querySelector("[data-ee-search]");
    if (!box) return;
    if ((e.key === "/" && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) {
      e.preventDefault(); box.focus(); box.select();
    }
  });

  // ---- Quick sign-in modal ------------------------------------------------------
  function modal() { return document.getElementById("ee-signin"); }
  var signinOpener = null;
  function openSignin(e) {
    var m = modal();
    if (!m) return;                       // page has no modal: follow the link
    if (e) e.preventDefault();
    signinOpener = document.activeElement;
    m.classList.add("is-open");
    m.setAttribute("aria-hidden", "false");
    var first = m.querySelector("input[name=identifier]");
    setTimeout(function () { first && first.focus(); }, 30);
    document.documentElement.style.overflow = "hidden";
  }
  function closeSignin() {
    var m = modal(); if (!m) return;
    var wasOpen = m.classList.contains("is-open");
    m.classList.remove("is-open"); m.setAttribute("aria-hidden", "true");
    document.documentElement.style.overflow = "";
    if (wasOpen && signinOpener && signinOpener.focus) { try { signinOpener.focus(); } catch (err) {} }
    signinOpener = null;
  }
  document.addEventListener("click", function (e) {
    var trigger = e.target.closest("[data-signin-modal]");
    if (trigger) return openSignin(e);
    if (e.target.closest("[data-signin-close]") || e.target === modal()) closeSignin();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSignin(); });
  document.addEventListener("submit", function (e) {
    var form = e.target.closest("form[data-signin-form]");
    if (!form) return;
    e.preventDefault();
    var err = form.querySelector(".ee-signin__error"), btn = form.querySelector("[type=submit]");
    btn && (btn.disabled = true, btn.dataset.label = btn.textContent, btn.textContent = "Signing in…");
    fetch(form.action, { method: "POST", body: new FormData(form), credentials: "same-origin",
                         headers: { "Accept": "application/json", "X-Requested-With": "fetch" } })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: "Something went wrong." }; }); })
      .then(function (data) {
        if (data.ok) { window.location.href = data.redirect || "/dashboard/"; return; }
        if (err) { err.textContent = data.error || "Sign-in failed."; err.classList.add("is-shown"); }
        btn && (btn.disabled = false, btn.textContent = btn.dataset.label);
      })
      .catch(function () {
        if (err) { err.textContent = "Network problem. Please try again."; err.classList.add("is-shown"); }
        btn && (btn.disabled = false, btn.textContent = btn.dataset.label);
      });
  });
  if (/[?&]signin=1\b/.test(location.search)) document.addEventListener("DOMContentLoaded", function () { openSignin(); });

  // ---- Copy buttons ------------------------------------------------------------------
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-copy]");
    if (!b) return;
    navigator.clipboard && navigator.clipboard.writeText(b.getAttribute("data-copy")).then(function () {
      if (window.EE && EE.Toast) EE.Toast.push("success", "Copied", "");
    });
  });

  window.EEHub = { openSignin: openSignin, closeSignin: closeSignin };
})();
