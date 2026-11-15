/* Round 6 course registration: open/close the "course from another department"
   dialog, remember whether the step guide is open. No dependencies. */
(function () {
  "use strict";
  function boot() {
    document.addEventListener("click", function (e) {
      var open = e.target.closest("[data-rg-open]");
      if (open) {
        var d = document.getElementById(open.getAttribute("data-rg-open"));
        if (d && d.showModal) { d.showModal(); var f = d.querySelector("input"); if (f) f.focus(); }
        return;
      }
      var close = e.target.closest("[data-rg-close]");
      if (close) { var dlg = close.closest("dialog"); if (dlg) dlg.close(); }
    });
    document.querySelectorAll("dialog.rg-dialog").forEach(function (d) {
      d.addEventListener("click", function (e) { if (e.target === d) d.close(); });
    });
    var guide = document.querySelector("[data-rg-guide]");
    if (guide) {
      try {
        var saved = localStorage.getItem("ee.rg.guide");
        if (saved === "0") guide.open = false;
        if (saved === "1") guide.open = true;
        guide.addEventListener("toggle", function () { try { localStorage.setItem("ee.rg.guide", guide.open ? "1" : "0"); } catch (err) { /* private mode */ } });
      } catch (err) { /* storage blocked */ }
    }
    if (location.hash === "#outside") {
      var sec = document.getElementById("outside");
      if (sec) sec.scrollIntoView({ block: "start" });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
