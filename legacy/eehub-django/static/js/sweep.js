/* EE Hub design sweep (R7J): client-side filters, the phone filter sheet and print.

   <div data-ds-filterable>
     <input data-ds-q>                                   free-text search over data-ds-text
     <button class="ds-chip" data-ds-set="level:300">    one value per field ("" = all)
     <select data-ds-field="status">                     same, from a select
     <section data-ds-group> ... <article data-ds-item data-f-level="300" data-f-status="pending" data-ds-text="...">
     <span data-ds-shown></span>  <div data-ds-none hidden>
   Filter sheet on phones: <button data-ds-sheet="ID"> opens #ID (.ds-filters), [data-ds-sheet-close] closes.
   Print: <button data-ds-print>.
*/
(function () {
  "use strict";

  function initFilterable(root) {
    var state = {}, q = "";
    var items = Array.prototype.slice.call(root.querySelectorAll("[data-ds-item]"));
    var groups = root.querySelectorAll("[data-ds-group]");
    var shown = root.querySelectorAll("[data-ds-shown]");
    var none = root.querySelector("[data-ds-none]");
    var sheetBtn = root.querySelector("[data-ds-sheet]");

    function apply() {
      var n = 0, words = q.toLowerCase().split(/\s+/).filter(Boolean);
      items.forEach(function (it) {
        var ok = true;
        Object.keys(state).forEach(function (f) {
          if (!ok || !state[f]) return;
          var v = (it.getAttribute("data-f-" + f) || "").split(/\s+/);
          if (v.indexOf(state[f]) < 0) ok = false;
        });
        if (ok && words.length) {
          var t = (it.getAttribute("data-ds-text") || it.textContent || "").toLowerCase();
          ok = words.every(function (w) { return t.indexOf(w) >= 0; });
        }
        it.hidden = !ok;
        if (ok) n++;
      });
      Array.prototype.forEach.call(groups, function (g) {
        g.hidden = !g.querySelector("[data-ds-item]:not([hidden])");
      });
      Array.prototype.forEach.call(shown, function (s) { s.textContent = n; });
      if (none) none.hidden = n > 0;
      var active = Object.keys(state).some(function (k) { return !!state[k]; });
      if (sheetBtn) { if (active) sheetBtn.setAttribute("data-active", ""); else sheetBtn.removeAttribute("data-active"); }
    }

    root.addEventListener("click", function (e) {
      var b = e.target.closest("[data-ds-set]");
      if (!b || !root.contains(b)) return;
      e.preventDefault();
      var parts = b.getAttribute("data-ds-set").split(":"), f = parts[0], v = parts.slice(1).join(":");
      state[f] = v;
      root.querySelectorAll('[data-ds-set^="' + f + ':"]').forEach(function (o) {
        var on = o === b;
        o.classList.toggle("is-on", on);
        o.setAttribute("aria-pressed", on ? "true" : "false");
      });
      apply();
    });
    root.querySelectorAll("[data-ds-field]").forEach(function (s) {
      s.addEventListener("change", function () { state[s.getAttribute("data-ds-field")] = s.value; apply(); });
    });
    root.querySelectorAll("[data-ds-q]").forEach(function (inp) {
      inp.addEventListener("input", function () { q = inp.value; apply(); });
      if (inp.value) q = inp.value;
    });
    // initial chips marked .is-on
    root.querySelectorAll("[data-ds-set].is-on").forEach(function (b) {
      var p = b.getAttribute("data-ds-set").split(":"); state[p[0]] = p.slice(1).join(":");
    });
    apply();
  }

  function sheet(open, id) {
    var el = document.getElementById(id);
    if (!el) return;
    var bd = document.querySelector('.ds-sheet-backdrop[data-for="' + id + '"]');
    if (!bd) {
      bd = document.createElement("div");
      bd.className = "ds-sheet-backdrop"; bd.setAttribute("data-for", id);
      bd.addEventListener("click", function () { sheet(false, id); });
      document.body.appendChild(bd);
    }
    el.classList.toggle("is-open", open);
    bd.classList.toggle("is-open", open);
    document.querySelectorAll('[data-ds-sheet="' + id + '"]').forEach(function (b) { b.setAttribute("aria-expanded", open ? "true" : "false"); });
    if (open) { var f = el.querySelector("button, [href], input, select"); if (f) f.focus({ preventScroll: true }); }
  }

  document.addEventListener("click", function (e) {
    var o = e.target.closest("[data-ds-sheet]");
    if (o) { e.preventDefault(); sheet(true, o.getAttribute("data-ds-sheet")); return; }
    var c = e.target.closest("[data-ds-sheet-close]");
    if (c) { e.preventDefault(); var p = c.closest(".ds-filters"); if (p && p.id) sheet(false, p.id); return; }
    var pr = e.target.closest("[data-ds-print]");
    if (pr) { e.preventDefault(); window.print(); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    document.querySelectorAll(".ds-filters.is-open").forEach(function (el) { if (el.id) sheet(false, el.id); });
  });

  function boot() { document.querySelectorAll("[data-ds-filterable]").forEach(initFilterable); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
