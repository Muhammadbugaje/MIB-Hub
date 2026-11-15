/* EE Hub — Act as another user (Nov 2026).
   Live results: typing, picking a profile or changing a filter refreshes the list in place
   (GET ?partial=1) and keeps the address bar in step, so Back and bookmarks work.
   Without JavaScript the form submits normally. */
(function () {
  "use strict";
  var form = document.querySelector("[data-imp-filters]");
  var box = document.getElementById("imp-results");
  if (!form || !box || !window.fetch) return;
  var clear = form.querySelector("[data-imp-clear]");
  var timer = null, ctrl = null;

  function params() {
    var p = new URLSearchParams(new FormData(form));
    Array.from(p.keys()).forEach(function (k) { if (!p.get(k) || (k === "sort" && p.get(k) === "name")) p.delete(k); });
    return p;
  }
  function load(url, push) {
    if (ctrl) ctrl.abort();
    ctrl = window.AbortController ? new AbortController() : null;
    box.classList.add("is-loading");
    var u = new URL(url, location.href); u.searchParams.set("partial", "1");
    fetch(u.toString(), { credentials: "same-origin", headers: { "X-Requested-With": "fetch" }, signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (html) {
        box.innerHTML = html;
        box.classList.remove("is-loading");
        u.searchParams.delete("partial");
        if (push !== false && history.replaceState) history.replaceState(null, "", u.pathname + (u.search || ""));
      })
      .catch(function (e) { if (e && e.name === "AbortError") return; box.classList.remove("is-loading"); form.submit(); });
  }
  function refresh(delay) {
    clearTimeout(timer);
    var p = params();
    if (clear) clear.hidden = !Array.from(p.keys()).some(function (k) { return k !== "sort"; });
    timer = setTimeout(function () { load(form.action + (p.toString() ? "?" + p.toString() : "")); }, delay || 0);
  }
  form.addEventListener("input", function (e) { if (e.target.matches("[data-imp-q]")) refresh(250); });
  form.addEventListener("change", function (e) {
    if (e.target.name === "kind") {
      form.querySelectorAll(".imp-kind").forEach(function (l) { l.classList.toggle("is-on", l.querySelector("input").checked); });
    }
    if (!e.target.matches("[data-imp-q]")) refresh(0);
  });
  form.addEventListener("submit", function (e) { e.preventDefault(); refresh(0); });
  if (clear) clear.addEventListener("click", function (e) {
    e.preventDefault(); form.reset();
    form.querySelectorAll("input[type=search]").forEach(function (i) { i.value = ""; });
    form.querySelectorAll("select").forEach(function (s) { s.selectedIndex = 0; });
    var all = form.querySelector('input[name=kind][value=""]'); if (all) all.checked = true;
    form.querySelectorAll(".imp-kind").forEach(function (l) { l.classList.toggle("is-on", l.querySelector("input").checked); });
    refresh(0);
  });
  box.addEventListener("click", function (e) {
    var a = e.target.closest("[data-imp-page], .sys-pager a, [data-show-all] a, a[href*='all=1']");
    if (!a || !a.getAttribute("href") || a.getAttribute("href").charAt(0) === "#") return;
    e.preventDefault(); load(a.href); box.scrollIntoView({ block: "start", behavior: "smooth" });
  });
  // "/" focuses the search box (the site-wide shortcut opens the global search otherwise)
  var q = form.querySelector("[data-imp-q]");
  if (q && q.value) { var n = q.value.length; try { q.setSelectionRange(n, n); } catch (err) {} }
})();
