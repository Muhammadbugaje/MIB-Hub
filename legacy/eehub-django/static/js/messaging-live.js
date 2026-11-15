/* EE Hub messaging additions on top of NBTE's messaging.js / thread-send.js:
 * - live updates: the thread polls for new messages (and "seen" ticks) while the tab is visible;
 * - the members / files panel toggle;
 * - compose: character count and Ctrl+Enter.
 */
(function () {
  "use strict";

  function initThread() {
    var root = document.querySelector("[data-messaging-thread]");
    if (!root) return;
    var thread = root.querySelector("[data-thread]");
    var url = root.getAttribute("data-poll-url");
    var lastId = parseInt(root.getAttribute("data-last-id") || "0", 10) || 0;
    var timer = null;
    var busy = false;
    var interval = 6000;

    function maxId() {
      thread.querySelectorAll("[data-message-id]").forEach(function (el) {
        var id = parseInt(el.getAttribute("data-message-id"), 10);
        if (id > lastId) lastId = id;
      });
      return lastId;
    }

    function nearBottom() {
      return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160;
    }

    function dedupe() {
      var seen = {};
      thread.querySelectorAll("[data-message-id]").forEach(function (el) {
        var id = el.getAttribute("data-message-id");
        if (seen[id]) el.remove(); else seen[id] = true;
      });
    }

    function poll() {
      if (busy || document.hidden || !url) return;
      busy = true;
      fetch(url + "?after=" + maxId(), { credentials: "same-origin", headers: { "Accept": "application/json" } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (!data) return;
          var stick = nearBottom();
          var pending = thread.querySelector("[data-pending]");
          (data.messages || []).forEach(function (m) {
            if (thread.querySelector('[data-message-id="' + m.id + '"]')) return;
            if (m.mine && pending) return;            // thread-send.js is inserting it
            var wrap = document.createElement("div");
            wrap.innerHTML = (m.html || "").trim();
            var el = wrap.firstElementChild;
            if (!el) return;
            var empty = thread.querySelector(".msg-empty-thread");
            if (empty && !empty.textContent.match(/latest/)) empty.remove();
            el.classList.add("msg-new");
            thread.appendChild(el);
          });
          (data.seen || []).forEach(function (id) {
            var s = thread.querySelector('[data-message-id="' + id + '"] [data-seen]');
            if (s) s.hidden = false;
          });
          dedupe();
          maxId();
          if (stick && (data.messages || []).length) window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
          var badges = document.querySelectorAll('[data-nav-badge="messages"]');
          badges.forEach(function (b) { b.textContent = data.unread_total || ""; b.hidden = !data.unread_total; });
        })
        .catch(function () { /* offline: try again next time */ })
        .finally(function () { busy = false; });
    }

    if (window.MutationObserver) new MutationObserver(dedupe).observe(thread, { childList: true });
    timer = window.setInterval(poll, interval);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) poll(); });
    // first paint: start at the latest message
    window.requestAnimationFrame(function () { window.scrollTo(0, document.documentElement.scrollHeight); });

    var info = document.querySelector("[data-mx-info]");
    document.querySelectorAll("[data-mx-info-toggle]").forEach(function (b) {
      b.addEventListener("click", function () {
        if (!info) return;
        var open = !info.classList.contains("is-open");
        info.classList.toggle("is-open", open);
        document.querySelectorAll("[data-mx-info-toggle]").forEach(function (x) { x.setAttribute("aria-expanded", open ? "true" : "false"); });
      });
    });
  }

  function initCompose() {
    var f = document.querySelector("[data-compose-form]");
    if (!f) return;
    var b = f.querySelector("[data-body]");
    var c = f.querySelector("[data-char-count]");
    if (!b) return;
    b.addEventListener("input", function () { if (c) c.textContent = b.value.length + " character" + (b.value.length === 1 ? "" : "s"); });
    b.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); if (f.requestSubmit) f.requestSubmit(); else f.submit(); }
    });
  }

  function init() { initThread(); initCompose(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
