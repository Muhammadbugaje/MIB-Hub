/* EE Hub research board. Vote and save buttons keep their id across HTMX
   swaps, so htmx restores keyboard focus by itself; this file announces the
   new count to screen readers. */
(function () {
  "use strict";
  var live;
  document.addEventListener("htmx:afterSettle", function (ev) {
    var b = ev.target && ev.target.querySelector && ev.target.querySelector(".rs-vote, .rs-save");
    if (!b) return;
    if (!live) {
      live = document.createElement("div");
      live.className = "sr-only";
      live.setAttribute("aria-live", "polite");
      document.body.appendChild(live);
    }
    live.textContent = b.getAttribute("aria-label") + (b.getAttribute("aria-pressed") === "true" ? ": on" : ": off");
  });
})();
