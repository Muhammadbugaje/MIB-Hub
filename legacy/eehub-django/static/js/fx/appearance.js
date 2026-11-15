/* Settings → Appearance: live preview dialog and selected-card state (Round 6, R6A). */
(function () {
  "use strict";
  var page = document.querySelector("[data-appearance]");
  if (!page) return;
  var dlg = page.querySelector("[data-preview-dialog]");
  var frame = page.querySelector("[data-preview-frame]");
  var stage = page.querySelector("[data-preview-stage]");
  var title = page.querySelector("[data-preview-title]");
  var open = page.querySelector("[data-preview-open]");

  function palette() {
    var p = page.querySelector('input[name="appearance.scene_palette"]:checked');
    return p ? p.value : "";
  }
  page.addEventListener("click", function (e) {
    var b = e.target.closest("[data-preview]");
    if (b) {
      e.preventDefault(); e.stopPropagation();
      var url = b.getAttribute("data-preview") + (palette() && palette() !== "custom" ? "?palette=" + palette() : "");
      title.textContent = "Preview: " + b.getAttribute("data-title");
      open.href = url;
      frame.src = url;
      if (dlg.showModal) dlg.showModal(); else window.open(url, "_blank");
      return;
    }
    var size = e.target.closest("[data-size]");
    if (size) {
      page.querySelectorAll("[data-size]").forEach(function (x) { x.classList.toggle("is-on", x === size); });
      stage.classList.toggle("is-phone", size.getAttribute("data-size") === "phone");
      return;
    }
    if (e.target.closest("[data-preview-close]")) { dlg.close(); }
  });
  if (dlg) {
    dlg.addEventListener("close", function () { frame.src = "about:blank"; });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
  }
  // keep the "selected" ring in step on browsers without :has()
  page.addEventListener("change", function (e) {
    if (e.target.name === "appearance.hero_scene") {
      page.querySelectorAll(".apx-scene").forEach(function (c) { c.classList.toggle("is-on", c.querySelector("input").checked); });
    }
    if (e.target.matches("[data-colour]")) {
      var chip = page.querySelector('[data-swatch="custom"]');
      if (chip) chip.style.setProperty("--" + e.target.getAttribute("data-colour"), e.target.value);
      var custom = page.querySelector('input[name="appearance.scene_palette"][value="custom"]');
      if (custom) custom.checked = true;
    }
  });
})();
