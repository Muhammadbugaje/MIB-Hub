/* Results: table filter tabs, upload drop zones, signature adjust. */
(function () {
  "use strict";

  // Filter tabs: <div data-rs-tabs><button data-show="all|issues|ok|fail"> + <table data-rs-rows> rows with data-kind tokens.
  document.querySelectorAll("[data-rs-tabs]").forEach(function (tabs) {
    var card = tabs.closest(".ee-card");
    var table = card && card.querySelector("[data-rs-rows]");
    if (!table) return;
    tabs.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-show]");
      if (!btn) return;
      var show = btn.getAttribute("data-show");
      tabs.querySelectorAll("[data-show]").forEach(function (b) {
        b.classList.toggle("is-on", b === btn);
        b.setAttribute("aria-pressed", b === btn ? "true" : "false");
      });
      table.querySelectorAll("tbody tr").forEach(function (tr) {
        var kinds = (tr.getAttribute("data-kind") || "").split(/\s+/);
        tr.hidden = !(show === "all" || kinds.indexOf(show) !== -1);
      });
    });
  });

  // Drop zones: show the chosen file name; drag and drop.
  document.querySelectorAll("[data-rs-drop]").forEach(function (zone) {
    var input = zone.querySelector("input[type=file]");
    var label = zone.querySelector("[data-rs-drop-name]");
    if (!input) return;
    function show() {
      if (input.files && input.files[0] && label) label.textContent = input.files[0].name;
    }
    input.addEventListener("change", show);
    ["dragenter", "dragover"].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add("is-over"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove("is-over"); });
    });
    zone.addEventListener("drop", function (e) {
      if (e.dataTransfer && e.dataTransfer.files.length) {
        input.files = e.dataTransfer.files;
        show();
      }
    });
  });

  // Signature: live value of the sensitivity slider; re-process on change.
  var adjust = document.querySelector("[data-rs-adjust]");
  if (adjust) {
    var range = adjust.querySelector("input[type=range]");
    var out = adjust.querySelector("[data-rs-sens]");
    var timer = null;
    function submitSoon() {
      clearTimeout(timer);
      timer = setTimeout(function () {
        adjust.classList.add("is-busy");
        adjust.requestSubmit ? adjust.requestSubmit() : adjust.submit();
      }, 450);
    }
    if (range && out) range.addEventListener("input", function () { out.textContent = range.value; });
    adjust.querySelectorAll("input").forEach(function (el) {
      if (el.type === "hidden") return;
      el.addEventListener("change", submitSoon);
    });
  }
})();
