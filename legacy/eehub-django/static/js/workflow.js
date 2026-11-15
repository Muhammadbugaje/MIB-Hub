/* Phase 5 shared: EEConfirm for a single submit button (dialog.js confirms whole forms only).
 * <button type="submit" data-confirm="…" data-confirm-title="…" data-confirm-action="…"> */
(function () {
  "use strict";
  var bypass = new WeakSet();
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-confirm]");
    if (!btn || !btn.form || btn.form.hasAttribute("data-confirm") || btn.type !== "submit") return;
    if (bypass.has(btn)) { bypass.delete(btn); return; }
    if (e.defaultPrevented) return;
    e.preventDefault();
    if (!window.EEConfirm || typeof window.EEConfirm.open !== "function") {
      console.error("[Workflow] Confirmation dialog is unavailable; action was not submitted.");
      return;
    }
    window.EEConfirm.open({
      title: btn.dataset.confirmTitle, body: btn.dataset.confirm,
      confirmLabel: btn.dataset.confirmAction || "Confirm",
      tone: btn.dataset.confirmTone || "default"
    }).then(function (ok) {
      if (!ok) return;
      bypass.add(btn);
      if (btn.form.requestSubmit) btn.form.requestSubmit(btn); else btn.click();
    }).catch(function (error) { console.error("[Workflow] Could not open confirmation dialog", error); });
  });
})();
