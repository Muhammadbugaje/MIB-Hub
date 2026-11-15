/* Course catalogue: open a course in a side drawer (bottom sheet on phones)
   instead of leaving the list. Links still work without JavaScript. */
(function () {
  "use strict";
  function boot() {
    var drawer = document.getElementById("cat-drawer");
    if (!drawer || !drawer.showModal) return;
    var body = drawer.querySelector("[data-cat-body]"), full = drawer.querySelector("[data-cat-full]");
    var ctrl = null;
    function open(url, href) {
      if (ctrl) ctrl.abort();
      ctrl = window.AbortController ? new AbortController() : null;
      body.innerHTML = "";
      body.classList.add("is-loading");
      full.href = href;
      if (!drawer.open) drawer.showModal();
      fetch(url, { headers: { "X-Requested-With": "fetch" }, credentials: "same-origin", signal: ctrl ? ctrl.signal : undefined })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(function (html) { body.classList.remove("is-loading"); body.innerHTML = html; body.scrollTop = 0; drawer.scrollTop = 0; })
        .catch(function (err) { if (err && err.name === "AbortError") return; window.location.href = href; });
    }
    document.addEventListener("click", function (e) {
      var a = e.target.closest("[data-cat-open]");
      if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
        e.preventDefault();
        open(a.getAttribute("data-cat-open"), a.getAttribute("href"));
        return;
      }
      if (e.target.closest("[data-cat-close]")) drawer.close();
    });
    drawer.addEventListener("click", function (e) { if (e.target === drawer) drawer.close(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
