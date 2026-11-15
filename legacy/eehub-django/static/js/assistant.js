/* Phase 9 · Ask EE Hub drawer and the inline AI suggestion buttons.
   Plain fetch (no HTMX needed), so it also works on the public site.
   Loaded by the Ask button and by each {% ai_action %}; it initialises once. */
(function () {
  "use strict";
  if (window.EEAssistant) return;
  window.EEAssistant = { version: 1 };

  function csrf(el) {
    var input = el && el.querySelector && el.querySelector("input[name=csrfmiddlewaretoken]");
    if (input && input.value) return input.value;
    if (el && el.dataset && el.dataset.csrf) return el.dataset.csrf;
    var m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  }
  function toast(type, title) { if (window.EE && EE.Toast) EE.Toast.push(type, title, ""); }
  function post(url, data, token) {
    return fetch(url, { method: "POST", body: data, credentials: "same-origin",
      headers: { "X-CSRFToken": token, "X-Assistant": "1" } }).then(function (r) {
      if (!r.ok) throw new Error(r.status === 403 ? "You can't use this here." : "Something went wrong (" + r.status + ").");
      return r.text();
    });
  }
  function frag(html) { var t = document.createElement("template"); t.innerHTML = html.trim(); return t.content; }
  function esc(s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

  /* ---------------------------------------------------------------- drawer */
  var drawer, lastFocus;
  function setup() {
    drawer = document.querySelector("[data-as-drawer]");
    if (drawer && drawer.parentNode !== document.body) document.body.appendChild(drawer); // escape the top bar's stacking context
  }
  function open() {
    if (!drawer) return;
    lastFocus = document.activeElement;
    drawer.hidden = false;
    document.documentElement.classList.add("is-scroll-locked");
    document.querySelectorAll("[data-as-open]").forEach(function (b) { b.setAttribute("aria-expanded", "true"); });
    requestAnimationFrame(function () { drawer.classList.add("is-open"); });
    setTimeout(function () { var q = drawer.querySelector("[data-as-input]"); if (q) q.focus(); }, 60);
  }
  function close() {
    if (!drawer || drawer.hidden) return;
    drawer.classList.remove("is-open");
    document.documentElement.classList.remove("is-scroll-locked");
    document.querySelectorAll("[data-as-open]").forEach(function (b) { b.setAttribute("aria-expanded", "false"); });
    setTimeout(function () { drawer.hidden = true; }, 220);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function grow(t) { t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 140) + "px"; }

  function ask(form) {
    var input = form.querySelector("[data-as-input]");
    var q = (input.value || "").trim();
    if (!q) return;
    var thread = drawer.querySelector("[data-as-thread]");
    var send = form.querySelector(".as-send");
    var pending = frag('<li class="as-turn"><div class="as-q"><span>' + esc(q) + '</span></div><div class="as-typing" aria-label="Looking for an answer"><i></i><i></i><i></i></div></li>').firstChild;
    thread.appendChild(pending);
    var intro = drawer.querySelector(".as-intro .as-chips"); if (intro) intro.hidden = true;
    var data = new FormData(form);
    input.value = ""; grow(input); send.disabled = true;
    var scroller = drawer.querySelector("[data-as-scroll]");
    scroller.scrollTop = scroller.scrollHeight;
    post(form.action, data, csrf(form)).then(function (html) {
      pending.replaceWith(frag(html));
    }).catch(function (e) {
      pending.querySelector(".as-typing").outerHTML = '<p class="as-a">' + esc(e.message) + "</p>";
    }).finally(function () {
      send.disabled = false; input.focus();
      var last = thread.lastElementChild;
      if (last) scroller.scrollTop += last.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 12;
    });
  }

  /* ------------------------------------------------------- inline actions */
  function runAction(btn) {
    var box = btn.closest("[data-as-action]");
    var out = box.querySelector("[data-as-out]");
    var data = new FormData();
    data.append("ref", box.dataset.ref || "");
    data.append("mode", btn.dataset.mode || "");
    data.append("target", box.dataset.target || "");
    (box.dataset.inputs || "").split(",").forEach(function (sel) {
      sel = sel.trim(); if (!sel) return;
      var el = document.querySelector(sel);
      if (el && el.name) data.append(el.name, el.value || "");
    });
    var label = btn.innerHTML;
    btn.classList.add("is-busy"); btn.setAttribute("aria-busy", "true");
    out.innerHTML = '<div class="as-typing" aria-label="Working"><i></i><i></i><i></i></div>';
    post(box.dataset.url, data, csrf(box)).then(function (html) {
      out.innerHTML = ""; out.appendChild(frag(html));
    }).catch(function (e) {
      out.innerHTML = '<div class="as-sugg is-error"><p class="as-sugg__err">' + esc(e.message) + "</p></div>";
    }).finally(function () { btn.classList.remove("is-busy"); btn.removeAttribute("aria-busy"); btn.innerHTML = label; });
  }
  function suggText(el) { var s = el.closest("[data-as-sugg]"); var t = s && s.querySelector("[data-as-text]"); return t ? t.value : ""; }
  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    var t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select();
    try { document.execCommand("copy"); } finally { t.remove(); }
    return Promise.resolve();
  }

  function fill(target, text) {
    target.value = text;
    target.dispatchEvent(new Event("input", { bubbles: true })); target.dispatchEvent(new Event("change", { bubbles: true }));
    target.classList.add("as-flash"); setTimeout(function () { target.classList.remove("as-flash"); }, 1300);
    target.scrollIntoView({ behavior: "smooth", block: "center" }); target.focus();
    toast("success", "Text added. Check it before you send.");
  }

  /* --------------------------------------------------------------- events */
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t.closest("[data-as-open]")) { e.preventDefault(); setup(); open(); return; }
    if (drawer && t.closest("[data-as-close]")) { e.preventDefault(); close(); return; }
    var ex = t.closest("[data-as-example]");
    if (ex && drawer) { var f = drawer.querySelector("[data-as-form]"); f.querySelector("[data-as-input]").value = ex.textContent.trim(); ask(f); return; }
    var act = t.closest(".as-act__btn");
    if (act) { e.preventDefault(); runAction(act); return; }
    var use = t.closest("[data-as-use]");
    if (use) {
      var target = document.querySelector(use.dataset.target);
      if (!target) { toast("error", "The text box was not found. Use Copy instead."); return; }
      var text = suggText(use);
      if (!target.value.trim()) { fill(target, text); return; }
      if (!window.EEConfirm || typeof window.EEConfirm.open !== "function") {
        console.error("[Assistant] Confirmation dialog is unavailable; text was not replaced.");
        toast("error", "Could not open confirmation", "Reload the page and try again.");
        return;
      }
      window.EEConfirm.open({ title: "Replace the text in the box?", body: "What you have written there now is replaced by the suggestion.", confirmLabel: "Replace" })
        .then(function (ok) { if (ok) fill(target, text); })
        .catch(function (error) { console.error("[Assistant] Could not open confirmation dialog", error); });
      return;
    }
    var cp = t.closest("[data-as-copy]");
    if (cp) { copy(suggText(cp)).then(function () { toast("success", "Copied"); }); return; }
    var dis = t.closest("[data-as-dismiss]");
    if (dis) { var s = dis.closest("[data-as-sugg]"); if (s) s.remove(); }
  });

  document.addEventListener("submit", function (e) {
    var f = e.target;
    if (f.matches("[data-as-form]")) { e.preventDefault(); ask(f); return; }
    if (f.matches("[data-as-vote]")) {
      e.preventDefault();
      var data = new FormData(f);
      if (e.submitter) data.append(e.submitter.name, e.submitter.value);
      post(f.action, data, csrf(f)).then(function (html) { f.innerHTML = html; }).catch(function () { f.remove(); });
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && drawer && !drawer.hidden) { close(); return; }
    var t = e.target;
    if (e.key === "Enter" && !e.shiftKey && t.matches && (t.matches("[data-as-input]") || t.matches("[data-as-submit-enter]"))) {
      e.preventDefault();
      var form = t.form;
      if (form && form.matches("[data-as-form]")) ask(form); else if (form) form.requestSubmit ? form.requestSubmit() : form.submit();
    }
    if (e.key === "Tab" && drawer && !drawer.hidden) {   // keep focus inside the open drawer
      var items = drawer.querySelectorAll("a[href], button:not([disabled]), textarea, input:not([type=hidden])");
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  document.addEventListener("input", function (e) { if (e.target.matches && e.target.matches("[data-as-input]")) grow(e.target); });

  if (document.readyState !== "loading") setup(); else document.addEventListener("DOMContentLoaded", setup);
})();
