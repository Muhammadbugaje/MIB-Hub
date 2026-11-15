/* EE Hub — theme-init.js
   Loaded synchronously in <head> (tiny, no dependencies) so the saved theme,
   view mode and motion preference are applied before the first paint —
   no white flash in dark mode. app.js / ui.js take over after load. */
(function () {
  var d = document.documentElement;
  try {
    // Follow the device's light/dark setting, unless the toggle was pressed
    // while the device was on the setting it has now (see app.js Theme).
    var os = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    var t = localStorage.getItem("ee-theme");
    if ((t !== "light" && t !== "dark") || localStorage.getItem("ee-theme-os") !== os) t = os;
    // A theme chosen in My profile follows the user to every device.
    var p = window.EE_PREFS || {};
    if ((p.theme === "light" || p.theme === "dark") && !localStorage.getItem("ee-theme")) t = p.theme;
    d.setAttribute("data-theme", t);
    if (p.motion) d.setAttribute("data-motion", "reduce");
    var v = localStorage.getItem("ee-view");
    if (v === "desktop" || v === "mobile") d.setAttribute("data-view", v);
    if (localStorage.getItem("ee-motion") === "reduce") d.setAttribute("data-motion", "reduce");
  } catch (e) { /* storage blocked: CSS falls back to prefers-color-scheme */ }
  d.className += " js";
})();
