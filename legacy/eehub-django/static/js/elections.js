/* EE Hub elections: countdowns, the phone-first ballot (chips, abstain rules,
   seat limits), receipt copy (F2: copies the plain code, shows "Copied"),
   print, and hiding the winners card. Everything works without JS too. */
(function () {
  "use strict";

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function countdowns() {
    var els = document.querySelectorAll("[data-countdown]");
    if (!els.length) return;
    function tick() {
      els.forEach(function (el) {
        var end = Date.parse(el.getAttribute("data-countdown"));
        if (isNaN(end)) return;
        var s = Math.max(0, Math.floor((end - Date.now()) / 1000));
        var d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
        el.textContent = (d ? d + "d " : "") + pad(h) + ":" + pad(m) + ":" + pad(sec);
      });
    }
    tick();
    setInterval(tick, 1000);
  }

  function ballot() {
    var form = document.querySelector("[data-ballot]");
    if (!form) return;
    var posts = form.querySelectorAll("[data-post]");
    function sync(post) {
      var chip = document.querySelector('[data-chip="' + post.getAttribute("data-post") + '"]');
      var any = post.querySelector("input:checked");
      if (chip) chip.classList.toggle("el-chip--done", !!any);
      post.classList.toggle("is-answered", !!any);
    }
    posts.forEach(function (post) {
      var max = parseInt(post.getAttribute("data-max") || "0", 10);
      post.addEventListener("change", function (ev) {
        var t = ev.target;
        if (t.type === "checkbox") {
          var boxes = post.querySelectorAll("input[type=checkbox]");
          if (t.hasAttribute("data-abstain") && t.checked) {
            boxes.forEach(function (i) { if (i !== t) i.checked = false; });
          } else if (t.checked) {
            boxes.forEach(function (i) { if (i.hasAttribute("data-abstain")) i.checked = false; });
            var n = post.querySelectorAll("input[type=checkbox]:checked:not([data-abstain])").length;
            if (max && n > max) {
              t.checked = false;
              if (window.EE && EE.Toast) EE.Toast.show ? EE.Toast.show("Choose at most " + max + ".") : null;
            }
          }
        }
        sync(post);
      });
      sync(post);
    });
    form.addEventListener("submit", function (ev) {
      var missing = Array.prototype.filter.call(posts, function (p) { return !p.querySelector("input:checked"); });
      if (missing.length) {
        ev.preventDefault();
        var first = missing[0];
        missing.forEach(function (p) { p.classList.add("is-missing"); });
        var note = first.querySelector(".el-post__err");
        if (!note) {
          note = document.createElement("p");
          note.className = "el-post__err";
          note.setAttribute("role", "alert");
          first.querySelector(".el-post__opts").insertAdjacentElement("beforebegin", note);
        }
        note.textContent = "Make a choice for this post, or choose to abstain.";
        first.scrollIntoView({ behavior: "smooth", block: "start" });
        var inp = first.querySelector("input");
        if (inp) inp.focus({ preventScroll: true });
      }
    });
    form.addEventListener("change", function (ev) {
      var p = ev.target.closest("[data-post]");
      if (p) { p.classList.remove("is-missing"); var n = p.querySelector(".el-post__err"); if (n) n.remove(); }
    });
    var err = document.getElementById("el-error");
    if (err) err.focus();
  }

  /* F2: copy the plain code (never "#..." or the selector), with a fallback for
     http pages where navigator.clipboard is not available. */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy") ? resolve() : reject(); } catch (e) { reject(e); }
      document.body.removeChild(ta);
    });
  }

  function receipt() {
    document.querySelectorAll("[data-copy-code]").forEach(function (b) {
      b.addEventListener("click", function () {
        var code = (b.getAttribute("data-copy-code") || "").replace(/^#/, "").trim();
        copyText(code).then(function () {
          var label = b.querySelector("span");
          if (label) label.textContent = "Copied";
          b.classList.add("is-copied");
          if (window.EE && EE.Toast && EE.Toast.success) EE.Toast.success("Receipt code copied: " + code);
          setTimeout(function () { if (label) label.textContent = "Copy"; b.classList.remove("is-copied"); }, 4000);
        }, function () {
          var out = document.getElementById("el-code");
          if (out && window.getSelection) {
            var r = document.createRange(); r.selectNodeContents(out);
            var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
          }
        });
      });
    });
    document.querySelectorAll("[data-print]").forEach(function (b) { b.addEventListener("click", function () { window.print(); }); });
    var h = document.getElementById("done-h");
    if (h) h.focus({ preventScroll: true });
  }

  function winners() {
    document.querySelectorAll("[data-winners-hide]").forEach(function (f) {
      f.addEventListener("submit", function (ev) {
        if (!window.fetch) return;
        ev.preventDefault();
        fetch(f.action, { method: "POST", body: new FormData(f), headers: { "HX-Request": "true" }, credentials: "same-origin" })
          .then(function (r) {
            if (!r.ok) { f.submit(); return; }
            var w = f.closest(".ee-widget") || f.closest(".elw");
            if (w) w.remove();
          });
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () { countdowns(); ballot(); receipt(); winners(); });
})();
