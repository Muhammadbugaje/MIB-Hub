/* EE Hub — offline.js: the offline page lists pages saved by the service worker
   and shows the saved timetable's "up next" card. Reads only this device's cache. */
(function () {
  "use strict";
  var doc = document, PAGE_CACHE = "ee-pages-v1";
  function $(s) { return doc.querySelector(s); }

  function ago(ms) {
    if (!ms) return "";
    var m = Math.round((Date.now() - ms) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return m + " min ago";
    var h = Math.round(m / 60);
    if (h < 24) return h + " h ago";
    var d = Math.round(h / 24);
    return d + " day" + (d === 1 ? "" : "s") + " ago";
  }

  // Connection pill + automatic reload when the network returns.
  function net(back) {
    var pill = $("[data-net-pill]"), label = $("[data-net-label]");
    if (pill) pill.classList.toggle("is-online", !!back);
    // Connected to a network but EE Hub did not answer (server or Wi-Fi portal problem).
    if (label) label.textContent = back ? "Back online" : navigator.onLine ? "EE Hub is not reachable" : "No connection";
  }
  window.addEventListener("online", function () { net(true); setTimeout(function () { location.reload(); }, 800); });
  window.addEventListener("offline", function () { net(false); });
  net(false);
  var retry = $("[data-retry]");
  if (retry) retry.addEventListener("click", function () { location.reload(); });

  if (!window.caches) return;
  caches.open(PAGE_CACHE).then(function (cache) {
    return cache.keys().then(function (reqs) {
      return Promise.all(reqs.map(function (r) {
        return cache.match(r).then(function (res) {
          return res.text().then(function (html) { return { url: new URL(r.url), res: res, html: html }; });
        });
      }));
    });
  }).then(function (pages) {
    var list = $("[data-saved-list]"), empty = $("[data-saved-empty]");
    pages = pages.filter(function (p) { return p.url.pathname !== "/offline/"; });
    pages.sort(function (a, b) { return (+b.res.headers.get("X-EE-Saved-At") || 0) - (+a.res.headers.get("X-EE-Saved-At") || 0); });
    pages.forEach(function (p) {
      var dom = new DOMParser().parseFromString(p.html, "text/html");
      var title = (dom.title || p.url.pathname).replace(/\s·\s[^·]+$/, "");
      var li = doc.createElement("li"), a = doc.createElement("a"), t = doc.createElement("span"), s = doc.createElement("small");
      a.href = p.url.pathname + p.url.search;
      t.textContent = title;
      s.textContent = ago(+p.res.headers.get("X-EE-Saved-At"));
      a.appendChild(t); a.appendChild(s); li.appendChild(a); list.appendChild(li);

      if (p.url.pathname === "/timetable/") {
        var box = $("[data-today]"), next = dom.querySelector(".tt-next"), legend = dom.querySelectorAll(".tt-legend li");
        box.hidden = false;
        if (next) {
          var n = $("[data-today-next]");
          ["small", "strong", "span"].forEach(function (tag) {
            var src = next.querySelector(tag);
            if (src) { var el = doc.createElement(tag); el.textContent = src.textContent.trim(); n.appendChild(el); }
          });
          n.hidden = false;
        }
        var ul = $("[data-today-legend]");
        Array.prototype.slice.call(legend, 0, 12).forEach(function (li2) {
          var c = li2.querySelector("b"), item = doc.createElement("li");
          item.textContent = (c ? c.textContent : li2.textContent).trim();
          ul.appendChild(item);
        });
        $("[data-today-meta]").textContent = "Saved " + ago(+p.res.headers.get("X-EE-Saved-At")) +
          ". Changes made since then will show when you are back online.";
      }
    });
    if (empty) empty.hidden = pages.length > 0;
  }).catch(function () {});
})();
