/* Welfare case page: confirm "did not attend" (it raises a fine) and show the
   default amount of the chosen fine type. Uses EEConfirm from dialog.js. */
(function () {
  "use strict";
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-wl-confirm]");
    if (!btn || btn.dataset.wlOk === "1") return;
    e.preventDefault();
    if (!window.EEConfirm || typeof window.EEConfirm.open !== "function") {
      console.error("[Welfare] Confirmation dialog is unavailable; action was not submitted.");
      return;
    }
    window.EEConfirm.open({ title: "Record as did not attend?", body: btn.dataset.wlConfirm, confirmLabel: "Record", tone: "danger" })
      .then(function (ok) {
        if (!ok) return;
        btn.dataset.wlOk = "1";
        if (btn.form && typeof btn.form.requestSubmit === "function") btn.form.requestSubmit(btn); else btn.click();
      }).catch(function (error) { console.error("[Welfare] Could not open confirmation dialog", error); });
  });
  function syncAmount(sel) {
    var form = sel.closest("form");
    var amt = form && form.querySelector("[data-wl-amount]");
    var opt = sel.options[sel.selectedIndex];
    if (amt && opt) amt.placeholder = opt.dataset.amount && opt.dataset.amount !== "0" ? "Default ₦" + Number(opt.dataset.amount).toLocaleString() : "Enter the amount";
  }
  document.addEventListener("change", function (e) { if (e.target.matches("[data-wl-type]")) syncAmount(e.target); });
  document.querySelectorAll("[data-wl-type]").forEach(syncAmount);
})();
