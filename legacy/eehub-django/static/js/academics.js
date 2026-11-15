/* Assessment scheme builder: rows of component / weight / marked-out-of, live total and bar. */
(function () {
  "use strict";
  var COLORS = ["var(--brand-500, #1f8a5b)", "var(--accent, #d4a017)", "var(--volt, #13c4dc)", "#8b5cf6", "#f2683c", "#64748b"];
  function init(form) {
    var rows = form.querySelector(".ac-scheme__rows"), bar = form.querySelector(".ac-scheme__bar"),
        total = form.querySelector(".ac-scheme__total"), save = form.querySelector("[data-save]");
    function row(label, weight, max) {
      var r = document.createElement("div");
      r.className = "ac-scheme__row";
      r.innerHTML = '<input name="label" placeholder="e.g. Tests" aria-label="Component" maxlength="60">' +
        '<input name="weight" type="number" min="0" max="100" step="0.5" placeholder="Weight" aria-label="Weight in percent">' +
        '<input name="max" type="number" min="0" step="0.5" placeholder="Out of" aria-label="Marked out of">' +
        '<button type="button" class="btn btn-ghost btn-sm btn-danger" aria-label="Remove component">×</button>';
      r.children[0].value = label || ""; r.children[1].value = weight === undefined ? "" : weight; r.children[2].value = max === undefined ? "" : max;
      r.children[3].addEventListener("click", function () { r.remove(); update(); });
      r.addEventListener("input", update);
      rows.appendChild(r);
    }
    function load(list) { rows.innerHTML = ""; list.forEach(function (c) { row(c[0], c[1], c[2]); }); update(); }
    function update() {
      var sum = 0; bar.innerHTML = "";
      rows.querySelectorAll(".ac-scheme__row").forEach(function (r, i) {
        var w = parseFloat(r.children[1].value) || 0; sum += w;
        if (w > 0) { var s = document.createElement("span"); s.style.width = Math.min(w, 100) + "%"; s.style.background = COLORS[i % COLORS.length];
          s.title = (r.children[0].value || "Component") + " " + w + "%"; bar.appendChild(s); }
      });
      var ok = Math.abs(sum - 100) < 0.001;
      total.textContent = "Total " + (Math.round(sum * 10) / 10) + " / 100";
      total.className = "ac-scheme__total " + (ok ? "is-ok" : "is-bad");
      save.disabled = !ok;
    }
    form.querySelector("[data-add]").addEventListener("click", function () { row("", "", ""); update(); rows.lastChild.children[0].focus(); });
    form.querySelectorAll("[data-preset]").forEach(function (b) { b.addEventListener("click", function () { load(JSON.parse(b.dataset.preset)); }); });
    try { load(JSON.parse(form.dataset.scheme || "[]")); } catch (e) { load([]); }
  }
  document.querySelectorAll("form.ac-scheme").forEach(init);
})();
