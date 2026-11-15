/* EE Hub Messages (round 7, R7G): the WhatsApp-style list and chat.
 * Live data arrives through window.EEChatLive (chat-live.js, one poller per browser). */
(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var wa = $("[data-wa]");
  var chat = $("[data-chat]");
  var csrf = (function () { var i = $("input[name=csrfmiddlewaretoken]"); return i ? i.value : ""; })();
  var toast = function (msg, type) {
    var T = window.EEToast || (window.EE && EE.Toast);
    if (T && T.push) T.push(type === "error" ? "error" : "success", msg, "", { duration: 3000, dedupe: false });
    else if (type === "error" && window.EEAlert && EEAlert.open) {
      EEAlert.open({ title: "Could not complete that action", body: msg }).catch(function (error) {
        console.error("[Chat] Could not show error dialog", error);
      });
    } else if (type === "error") console.error("[Chat] Could not complete that action:", msg);
  };

  function post(url, data) {
    var fd = data instanceof FormData ? data : new FormData();
    if (!(data instanceof FormData) && data) Object.keys(data).forEach(function (k) {
      var val = data[k];
      if (Array.isArray(val)) val.forEach(function (x) { fd.append(k, x); }); else fd.append(k, val);
    });
    if (!fd.has("csrfmiddlewaretoken")) fd.append("csrfmiddlewaretoken", csrf);
    return fetch(url, { method: "POST", body: fd, credentials: "same-origin",
      headers: { "X-Requested-With": "XMLHttpRequest", "Accept": "application/json", "X-CSRFToken": csrf } })
      .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); });
  }
  function frag(html) { var t = document.createElement("template"); t.innerHTML = (html || "").trim(); return t.content; }

  /* ------------------------------------------------------------------ list */
  function initList() {
    var list = $("[data-wa-list]");
    if (!list) return;
    var search = $("[data-wa-search]", list), filter = "all";
    function apply() {
      var q = (search && search.value || "").trim().toLowerCase(), shown = 0;
      $$("[data-row]", list).forEach(function (r) {
        var k = r.getAttribute("data-kind"), cat = r.getAttribute("data-cat");
        var ok = (!q || r.getAttribute("data-search").indexOf(q) >= 0) &&
          (filter === "all" || (filter === "unread" && +r.getAttribute("data-unread") > 0) ||
           (filter === "course" && cat === "course") || (filter === "direct" && k === "direct") ||
           (filter === "groups" && k !== "direct" && cat !== "course"));
        r.hidden = !ok; if (ok) shown++;
      });
      var e = $("[data-wa-filter-empty]", list); if (e) e.hidden = shown > 0 || !$$("[data-row]", list).length;
    }
    if (search) search.addEventListener("input", apply);
    $$("[data-wa-filters] button", list).forEach(function (b) {
      b.addEventListener("click", function () {
        $$("[data-wa-filters] button", list).forEach(function (x) { x.classList.toggle("is-on", x === b); });
        filter = b.getAttribute("data-filter"); apply();
      });
    });
    var stale = false;
    function refresh() {
      if (document.hidden) { stale = true; return; }
      stale = false;
      var box = $("[data-wa-list-scroll]", list);
      fetch(box.getAttribute("data-list-url"), { credentials: "same-origin" }).then(function (r) { return r.ok ? r.text() : null; })
        .then(function (html) { if (html) { var st = box.scrollTop; box.innerHTML = html; box.scrollTop = st; apply(); } });
    }
    document.addEventListener("visibilitychange", function () { if (!document.hidden && stale) refresh(); });
    if (window.EEChatLive) EEChatLive.on(function (d) { if (d.inbox) refresh(); });
    var pd = $("[data-prefs-dialog]");
    $$("[data-open-prefs]").forEach(function (b) { b.addEventListener("click", function () { b.closest("details") && b.closest("details").removeAttribute("open"); pd && pd.showModal(); }); });
  }

  function setBadges(n) {
    $$('a[href="/messages/"] .app-nav-badge, a[href="/messages/"] .app-tab__badge').forEach(function (b) { b.textContent = n > 99 ? "99+" : n; b.hidden = !n; });
    var t = document.title.replace(/^\(\d+\) /, "");
    document.title = n ? "(" + n + ") " + t : t;
  }
  if (window.EEChatLive) EEChatLive.on(function (d) { if (typeof d.unread === "number") setBadges(d.unread); });

  /* ------------------------------------------------------------------ dialogs */
  $$("[data-close-dialog]").forEach(function (b) { b.addEventListener("click", function () { var d = b.closest("dialog"); if (d) d.close(); }); });
  $$("dialog.wa-dialog").forEach(function (d) { d.addEventListener("click", function (e) { if (e.target === d) d.close(); }); });
  function dlg(name) { return $('[data-dlg="' + name + '"]'); }

  /* ------------------------------------------------------------------ lightbox, voice (also on gallery pages) */
  var lb = $("[data-lightbox-view]");
  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-lightbox]");
    if (!a || !lb) return;
    e.preventDefault();
    $("[data-lightbox-img]", lb).src = a.getAttribute("data-full");
    $("[data-lightbox-cap]", lb).textContent = a.getAttribute("data-caption") || "";
    lb.hidden = false;
  });
  if (lb) {
    lb.addEventListener("click", function (e) { if (e.target === lb || e.target.closest("[data-lightbox-close]")) lb.hidden = true; });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") lb.hidden = true; });
  }
  var playing = null;
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".wa-voice__play");
    if (!btn) return;
    var box = btn.closest("[data-voice]");
    if (!box._audio) {
      box._audio = new Audio(box.getAttribute("data-src"));
      box._audio.preload = "none";
      box._audio.addEventListener("timeupdate", function () {
        var a = box._audio, d = a.duration && isFinite(a.duration) ? a.duration : +box.getAttribute("data-duration") || 1;
        box.style.setProperty("--p", Math.min(100, a.currentTime / d * 100) + "%");
        $(".wa-voice__bar", box).style.width = Math.min(100, a.currentTime / d * 100) + "%";
        var s = Math.floor(a.currentTime); $(".wa-voice__time", box).textContent = Math.floor(s / 60) + ":" + ("0" + s % 60).slice(-2);
      });
      box._audio.addEventListener("ended", function () { btn.innerHTML = playIcon; $(".wa-voice__bar", box).style.width = "0"; });
      var seek = $(".wa-voice__seek", box);
      seek.addEventListener("input", function () { var a = box._audio; if (a.duration && isFinite(a.duration)) a.currentTime = seek.value / 100 * a.duration; });
    }
    var a = box._audio;
    if (a.paused) { if (playing && playing !== a) playing.pause(); a.play(); playing = a; btn.innerHTML = pauseIcon; }
    else { a.pause(); btn.innerHTML = playIcon; }
  });
  var playIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
  var pauseIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';

  initList();
  if (!chat) return;

  /* ================================================================== the open chat */
  var tid = chat.getAttribute("data-thread");
  var base = chat.getAttribute("data-base");
  var scroller = $("[data-scroll]", chat), box = $("[data-msgs]", chat);
  var features = (chat.getAttribute("data-features") || "").split(" ");
  var on = function (f) { return features.indexOf(f) >= 0; };
  var st = { tv: +chat.getAttribute("data-tv") || 0, last: +chat.getAttribute("data-last-id") || 0,
             oldest: +chat.getAttribute("data-oldest-id") || 0, hasOlder: chat.getAttribute("data-has-older") === "1",
             since: Date.parse(chat.getAttribute("data-now")) / 1000 || Date.now() / 1000,
             delivered: chat.getAttribute("data-delivered"), read: chat.getAttribute("data-read") };
  var fab = $("[data-to-bottom]", chat), fabCount = $("[data-fab-count]", chat), unseen = 0;

  function nearBottom() { return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 140; }
  function toBottom(smooth) { scroller.scrollTo({ top: scroller.scrollHeight, behavior: smooth ? "smooth" : "auto" }); }

  // day separators (WhatsApp "TODAY" chips)
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  function dayLabel(iso) {
    var d = new Date(iso + "T12:00:00"), t = new Date(); t.setHours(12, 0, 0, 0);
    var diff = Math.round((t - d) / 864e5);
    if (diff === 0) return "Today"; if (diff === 1) return "Yesterday";
    if (diff < 7 && diff > 0) return DAYS[d.getDay()];
    return d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  }
  function days() {
    $$(".wa-day", box).forEach(function (d) { d.remove(); });
    var prev = null;
    $$("[data-mid]", box).forEach(function (el) {
      var d = el.getAttribute("data-day");
      if (d && d !== prev) { var s = document.createElement("div"); s.className = "wa-day"; s.innerHTML = "<span>" + dayLabel(d) + "</span>"; box.insertBefore(s, el); }
      prev = d;
    });
  }
  function maxId() { $$("[data-mid]", box).forEach(function (el) { var i = +el.getAttribute("data-mid"); if (i > st.last && !el.classList.contains("is-pending")) st.last = i; }); return st.last; }

  function ticks() {
    var dv = st.delivered ? Date.parse(st.delivered) / 1000 : 0, rd = st.read ? Date.parse(st.read) / 1000 : 0;
    $$('.wa-row[data-mine] [data-tick]', box).forEach(function (t) {
      var ts = +t.closest("[data-ts]").getAttribute("data-ts"), cls = "is-sent";
      if (rd && ts <= rd) cls = "is-read"; else if (dv && ts <= dv) cls = "is-delivered";
      if (!t.classList.contains(cls)) {
        t.className = "wa-tick " + cls;
        t.innerHTML = cls === "is-sent" ? '<svg viewBox="0 0 16 11" width="16" height="11" aria-hidden="true"><path d="M11.1.6 4.8 7 2.2 4.4l-1 1L4.8 9l7.3-7.4z" fill="currentColor"/></svg>'
          : '<svg viewBox="0 0 16 11" width="16" height="11" aria-hidden="true"><path d="M11.1.6 4.8 7 2.2 4.4l-1 1L4.8 9l7.3-7.4zM15 .6 8.7 7l-.8-.8-1 1L8.7 9 16 1.6z" fill="currentColor"/></svg>';
        t.setAttribute("aria-label", cls.slice(3));
      }
    });
  }
  function windowCheck() {        // edit / delete-for-everyone close after the window
    var now = Date.now();
    $$("[data-can-change]", box).forEach(function (el) { if (Date.parse(el.getAttribute("data-can-change")) < now) el.removeAttribute("data-can-change"); });
  }
  setInterval(windowCheck, 30000);

  function upsert(html, isNew) {
    var f = frag(html), el = f.firstElementChild;
    if (!el) return null;
    var id = el.getAttribute("data-mid"), old = box.querySelector('[data-mid="' + id + '"]');
    if (old) { old.replaceWith(el); return el; }
    if (!isNew) return null;
    var pend = box.querySelector(".wa-row.is-pending");
    if (el.hasAttribute("data-mine") && pend) { pend.replaceWith(el); return el; }
    el.classList.add("is-new");
    box.appendChild(el);
    return el;
  }

  // live updates
  if (window.EEChatLive) {
    EEChatLive.threads(function () { var o = {}; o[tid] = { tv: st.tv, after: maxId(), since: Math.floor(st.since) }; return o; });
    EEChatLive.on(function (d) {
      var t = d.threads && d.threads[tid];
      if (!t) return;
      if (t.gone) { location.href = "/messages/"; return; }
      var stick = nearBottom(), added = 0;
      (t.new || []).forEach(function (m) { if (upsert(m.html, true)) { added++; if (!m.mine && !stick) unseen++; } });
      (t.changed || []).forEach(function (m) { upsert(m.html, false); });
      if (t.receipts) { st.delivered = t.receipts.delivered; st.read = t.receipts.read; }
      if (typeof t.pins === "string") { var pw = $("[data-pins-wrap]", chat); if (pw && pw.innerHTML.trim() !== t.pins.trim()) { pw.innerHTML = t.pins; initPins(); } }
      if (t.tv) st.tv = t.tv;
      if (d.now) st.since = d.now - 2;
      maxId();
      if (added) { days(); if (stick) toBottom(true); }
      ticks();
      if (unseen && fab) { fab.hidden = false; fabCount.hidden = false; fabCount.textContent = unseen; }
      if (t.readonly && $("[data-compose]", chat)) location.reload();
    });
  }

  // first paint
  days(); ticks();
  var anchor = location.hash.match(/^#m(\d+)$/);
  if (anchor) jump(+anchor[1]); else toBottom(false);
  requestAnimationFrame(function () { if (!anchor) toBottom(false); });

  // older messages on scroll up
  var olderEl = $("[data-older]", chat), loadingOlder = false;
  function loadOlder() {
    if (loadingOlder || !st.hasOlder) return;
    loadingOlder = true;
    var h = scroller.scrollHeight;
    fetch(base + "older/?before=" + st.oldest, { credentials: "same-origin" }).then(function (r) { return r.json(); }).then(function (d) {
      box.insertBefore(frag(d.html), box.firstChild);
      st.oldest = d.oldest_id; st.hasOlder = d.has_older;
      if (!d.has_older && olderEl) olderEl.hidden = true;
      days(); ticks();
      scroller.scrollTop += scroller.scrollHeight - h;
    }).finally(function () { loadingOlder = false; });
  }
  scroller.addEventListener("scroll", function () {
    if (scroller.scrollTop < 300) loadOlder();
    if (fab) { var nb = nearBottom(); fab.hidden = nb; if (nb) { unseen = 0; fabCount.hidden = true; } }
  }, { passive: true });
  if (fab) fab.addEventListener("click", function () { toBottom(true); });

  function flash(el) { el.classList.remove("is-flash"); void el.offsetWidth; el.classList.add("is-flash"); }
  function jump(id) {
    var el = box.querySelector('[data-mid="' + id + '"]');
    if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); flash(el); return; }
    fetch(base + "around/" + id + "/", { credentials: "same-origin" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d) return;
      box.innerHTML = d.html; st.oldest = d.oldest_id; st.hasOlder = d.has_older;
      if (olderEl) olderEl.hidden = !d.has_older;
      days(); ticks();
      var t = box.querySelector('[data-mid="' + id + '"]');
      if (t) { t.scrollIntoView({ block: "center" }); flash(t); }
      if (d.has_newer) { // show a way back to the latest
        fab.hidden = false; fab.onclick = function () { location.href = base; };
      }
    });
  }
  box.addEventListener("click", function (e) {
    var q = e.target.closest("[data-jump]");
    if (q) { e.preventDefault(); jump(+q.getAttribute("data-jump")); }
  });

  /* ---- pins ---- */
  function initPins() {
    var p = $("[data-pins]", chat);
    if (!p) return;
    var items = $$("[data-pin]", p), bars = $$(".wa-pins__bars i", p), i = 0;
    var cyc = $("[data-pin-cycle]", p);
    cyc.addEventListener("click", function () {
      jump(+items[i].getAttribute("data-pin"));
      i = (i + 1) % items.length;
      items.forEach(function (x, k) { x.classList.toggle("is-on", k === i); });
      bars.forEach(function (x, k) { x.classList.toggle("is-on", k === i); });
    });
    var x = $("[data-unpin]", p);
    if (x) x.addEventListener("click", function () {
      var mid = items[i].getAttribute("data-pin");
      post(base + "m/" + mid + "/pin/", { unpin: "1" }).then(function (d) { if (d.ok) { $("[data-pins-wrap]", chat).innerHTML = d.pins || ""; initPins(); EEChatLive && EEChatLive.poke(); } });
    });
  }
  initPins();

  /* ---- search in chat ---- */
  var sbox = $("[data-search]", chat);
  if (sbox) {
    var sin = $("[data-search-input]", sbox), sres = $("[data-search-results]", sbox), sto = null;
    $$("[data-open-search]").forEach(function (b) { b.addEventListener("click", function () { sbox.hidden = false; sin.focus(); }); });
    $("[data-close-search]", sbox).addEventListener("click", function () { sbox.hidden = true; sres.innerHTML = ""; sin.value = ""; });
    sin.addEventListener("input", function () {
      clearTimeout(sto);
      sto = setTimeout(function () {
        var q = sin.value.trim();
        if (q.length < 2) { sres.innerHTML = ""; return; }
        fetch(sbox.getAttribute("data-url") + "?q=" + encodeURIComponent(q), { credentials: "same-origin" }).then(function (r) { return r.json(); }).then(function (d) {
          sres.innerHTML = "";
          if (!d.results.length) { sres.innerHTML = '<li><button type="button" disabled>No messages found</button></li>'; return; }
          d.results.forEach(function (r) {
            var li = document.createElement("li"), b = document.createElement("button");
            b.type = "button";
            var small = document.createElement("small"); small.textContent = r.who + " · " + r.when;
            var span = document.createElement("span");
            var i = r.text.toLowerCase().indexOf(q.toLowerCase());
            if (i >= 0) { span.append(r.text.slice(0, i)); var m = document.createElement("mark"); m.textContent = r.text.slice(i, i + q.length); span.append(m, r.text.slice(i + q.length)); }
            else span.textContent = r.text;
            b.append(small, span);
            b.addEventListener("click", function () { sbox.hidden = true; jump(r.id); });
            li.appendChild(b); sres.appendChild(li);
          });
        });
      }, 250);
    });
  }

  /* ---- info pane ---- */
  var info = $("[data-info-pane]");
  function loadInfo() {
    return fetch(info.getAttribute("data-url"), { credentials: "same-origin" }).then(function (r) { return r.text(); }).then(function (html) {
      info.innerHTML = html; bindInfo();
    });
  }
  function openInfo() { info.hidden = false; wa.classList.add("has-info"); loadInfo(); }
  function closeInfo() { info.hidden = true; wa.classList.remove("has-info"); if (location.search.indexOf("info=1") >= 0) history.replaceState(null, "", base); }
  $$("[data-open-info]").forEach(function (b) { b.addEventListener("click", function () { var d = b.closest("details"); if (d) d.removeAttribute("open"); openInfo(); }); });
  if (info && !info.hidden) loadInfo();
  function bindInfo() {
    $$("[data-close-info]", info).forEach(function (b) { b.addEventListener("click", closeInfo); });
    $$("[data-ajax-form]", info).forEach(bindAjaxForm);
    $$("[data-open-wall]", info).forEach(function (b) { b.addEventListener("click", function () { var d = dlg("wall"); if (d) d.showModal(); }); });
    $$("[data-copy]", info).forEach(function (b) { b.addEventListener("click", function () { var i = b.closest(".wa-invite").querySelector("[data-copy-src]"); navigator.clipboard && navigator.clipboard.writeText(i.value); i.select(); toast("Link copied"); }); });
    var ms = $("[data-member-search]", info);
    if (ms) ms.addEventListener("input", function () { var q = ms.value.toLowerCase(); $$("[data-members] li", info).forEach(function (li) { li.hidden = q && li.getAttribute("data-name").indexOf(q) < 0; }); });
  }
  $$("[data-open-wall]").forEach(function (b) { b.addEventListener("click", function () { var d = b.closest("details"); if (d) d.removeAttribute("open"); var w = dlg("wall"); if (w) w.showModal(); }); });

  /* ---- ajax forms (dialogs, info) ---- */
  var msgTarget = null;
  function bindAjaxForm(f) {
    if (f._bound) return; f._bound = true;
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var url = f.getAttribute("action");
      var act = f.getAttribute("data-msg-action");
      if (act && msgTarget) url = base + "m/" + msgTarget + "/" + act + "/";
      var fd = new FormData(f);
      if (e.submitter && e.submitter.name) fd.append(e.submitter.name, e.submitter.value);
      var btns = $$("button[type=submit], button:not([type])", f); btns.forEach(function (b) { b.disabled = true; });
      post(url, fd).then(function (d) {
        if (!d.ok) { toast(d.error || "That did not work.", "error"); return; }
        var dg = f.closest("dialog"); if (dg) { dg.close(); f.reset(); }
        if (act === "remind") toast("Reminder set for " + (d.when || "later"));
        else if (act === "report") toast("Reported. Thank you.");
        else if (act === "forward") toast("Forwarded to " + d.sent + " chat" + (d.sent === 1 ? "" : "s"));
        if (d.url) { navigator.clipboard && navigator.clipboard.writeText(d.url).catch(function () {}); toast("Invite link copied"); }
        if (f.hasAttribute("data-reload-info")) loadInfo();
        if (window.EEChatLive) EEChatLive.poke();
      }).catch(function () { toast("Network problem. Try again.", "error"); })
        .finally(function () { btns.forEach(function (b) { b.disabled = false; }); });
    });
  }
  $$("[data-ajax-form]").forEach(bindAjaxForm);
  var addOpt = $("[data-add-option]");
  if (addOpt) addOpt.addEventListener("click", function () {
    var wrap = $("[data-poll-opts]"), n = wrap.children.length + 1;
    if (n > 12) return;
    var l = document.createElement("label"); l.className = "wa-field";
    l.innerHTML = "<span>Option " + n + "</span><input name=\"option\" maxlength=\"100\">";
    wrap.appendChild(l); l.querySelector("input").focus();
  });

  /* ---- composer ---- */
  var compose = $("[data-compose]", chat);
  var form = compose && $("[data-send-form]", compose);
  var body = form && $("[data-body]", form);
  var replyTo = form && $("[data-reply-to]", form);
  var editing = null, files = [];
  function grow() { body.style.height = "auto"; body.style.height = Math.min(body.scrollHeight, 140) + "px"; state(); }
  function state() { compose.classList.toggle("is-empty", !body.value.trim() && !files.length); }
  if (compose) {
    body.addEventListener("input", grow); state();
    var enterSends = chat.getAttribute("data-enter-sends") === "1" && !matchMedia("(pointer: coarse)").matches;
    body.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey && (enterSends || e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); }
      if (e.key === "Escape") { cancelReply(); cancelEdit(); }
    });
    form.addEventListener("submit", function (e) { e.preventDefault(); submit(); });
    var attach = $("[data-attach]", compose);
    $("[data-open-attach]", compose).addEventListener("click", function (e) { e.stopPropagation(); attach.hidden = !attach.hidden; });
    document.addEventListener("click", function (e) { if (attach && !attach.hidden && !e.target.closest("[data-attach]")) attach.hidden = true; });
    $$("[data-dialog]", compose).forEach(function (b) { b.addEventListener("click", function () { attach.hidden = true; var d = dlg(b.getAttribute("data-dialog")); if (d) d.showModal(); }); });
    $$("[data-pick-photo], [data-pick-doc]", compose).forEach(function (inp) {
      inp.addEventListener("change", function () { addFiles(Array.prototype.slice.call(inp.files), inp.hasAttribute("data-pick-photo")); inp.value = ""; attach.hidden = true; });
    });
    $("[data-cancel-reply]", compose).addEventListener("click", cancelReply);
    $("[data-cancel-edit]", compose).addEventListener("click", cancelEdit);
    initVoice();
  }

  var preview = compose && $("[data-preview]", compose);
  var maxBytes = (+chat.getAttribute("data-max-mb") || 10) * 1048576;
  function addFiles(list, photos) {
    var compress = chat.getAttribute("data-compress") === "1" && window.EEChatMedia;
    list.forEach(function (f) {
      var item = { file: f, original: f.size, photo: photos || /^image\//.test(f.type), busy: true };
      files.push(item); renderPreview();
      var done = function (r) { item.file = r.file; item.original = r.original; item.busy = false; renderPreview(); };
      if (item.photo && compress) EEChatMedia.compress(f, { maxPx: +chat.getAttribute("data-photo-px") || 1600, targetKB: +chat.getAttribute("data-photo-kb") || 350 }).then(done);
      else done({ file: f, original: f.size });
    });
  }
  function kb(n) { return n < 1048576 ? Math.round(n / 1024) + " KB" : (n / 1048576).toFixed(1) + " MB"; }
  function renderPreview() {
    preview.innerHTML = ""; preview.hidden = !files.length; state();
    files.forEach(function (it, i) {
      var d = document.createElement("div"); d.className = "wa-preview__it";
      if (it.photo) { var img = document.createElement("img"); img.src = URL.createObjectURL(it.file); img.alt = ""; d.appendChild(img); }
      else { var s = document.createElement("span"); s.className = "wa-doc__ic"; s.textContent = (it.file.name.split(".").pop() || "FILE").slice(0, 4).toUpperCase(); d.appendChild(s); }
      var em = document.createElement("em");
      em.textContent = it.busy ? "Compressing…" : (it.photo && it.original > it.file.size ? kb(it.file.size) + " (from " + kb(it.original) + ")" : (it.file.name || "") + " · " + kb(it.file.size));
      d.appendChild(em);
      var x = document.createElement("button"); x.type = "button"; x.setAttribute("aria-label", "Remove"); x.textContent = "×";
      x.addEventListener("click", function () { files.splice(i, 1); renderPreview(); });
      d.appendChild(x); preview.appendChild(d);
    });
  }

  function pendingBubble(text) {
    var el = document.createElement("div");
    el.className = "wa-row is-mine is-pending is-new";
    el.setAttribute("data-mine", "1"); el.setAttribute("data-mid", "p" + Date.now());
    el.innerHTML = '<div class="wa-bubble"><div class="wa-text"></div><div class="wa-meta"><time>' +
      new Date().toTimeString().slice(0, 5) + '</time><span class="wa-tick"><svg viewBox="0 0 24 24" width="13" height="13"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="2" fill="none"/></svg></span></div></div>';
    el.querySelector(".wa-text").textContent = text || (files.length ? "Sending " + files.length + " file" + (files.length > 1 ? "s" : "") + "…" : "");
    box.appendChild(el); toBottom(true);
    return el;
  }

  function submit(extra) {
    if (editing) return saveEdit();
    var text = body.value.trim();
    if (files.some(function (f) { return f.busy; })) { toast("Still compressing photos…"); return; }
    if (!text && !files.length && !extra) return;
    var total = files.reduce(function (s, f) { return s + f.file.size; }, 0);
    if (total > maxBytes) { toast("Files must total no more than " + Math.round(maxBytes / 1048576) + " MB.", "error"); return; }
    var fd = new FormData();
    fd.append("body", text);
    if (replyTo.value) fd.append("reply_to", replyTo.value);
    files.forEach(function (f) { fd.append("attachments", f.file, f.file.name || "photo.webp"); fd.append("original_bytes", f.original); });
    if (extra) Object.keys(extra).forEach(function (k) { fd.append(k, extra[k][0], extra[k][1]); });
    if (extra && extra.duration) fd.set("duration", extra.duration);
    var pend = pendingBubble(text);
    body.value = ""; files = []; renderPreview(); cancelReply(); grow();
    post(form.getAttribute("action"), fd).then(function (d) {
      if (!d.ok) { pend.classList.add("is-failed"); var e = document.createElement("div"); e.className = "wa-fail"; e.textContent = d.error || "Not sent."; pend.appendChild(e); return; }
      var el = frag(d.html).firstElementChild;
      var dup = box.querySelector('[data-mid="' + d.id + '"]');
      if (dup) pend.remove(); else pend.replaceWith(el);
      maxId(); days(); ticks(); toBottom(true);
      if (window.EEChatLive) EEChatLive.poke();
    }).catch(function () { pend.classList.add("is-failed"); });
  }

  function startReply(row) {
    replyTo.value = row.getAttribute("data-mid");
    $("[data-reply-who]", compose).textContent = row.hasAttribute("data-mine") ? "You" : row.getAttribute("data-sender");
    var t = row.querySelector("[data-text]");
    $("[data-reply-text]", compose).textContent = t ? t.textContent.slice(0, 140) : ({ image: "Photo", file: "Document", voice: "Voice note", poll: "Poll", event: "Event" }[row.getAttribute("data-kind")] || "Message");
    $("[data-reply-strip]", compose).hidden = false; body.focus();
  }
  function cancelReply() { if (!compose) return; replyTo.value = ""; $("[data-reply-strip]", compose).hidden = true; }
  function startEdit(row) {
    var t = row.querySelector("[data-text]"); if (!t) return;
    editing = row.getAttribute("data-mid");
    body.value = t.innerText; grow();
    $("[data-edit-text]", compose).textContent = t.textContent.slice(0, 140);
    $("[data-edit-strip]", compose).hidden = false; body.focus();
  }
  function cancelEdit() { if (!compose || !editing) return; editing = null; body.value = ""; grow(); $("[data-edit-strip]", compose).hidden = true; }
  function saveEdit() {
    var id = editing, text = body.value.trim(); if (!text) return;
    post(base + "m/" + id + "/edit/", { body: text }).then(function (d) {
      if (!d.ok) { toast(d.error, "error"); return; }
      upsert(d.html, false); cancelEdit(); EEChatLive && EEChatLive.poke();
    });
  }

  /* ---- voice notes ---- */
  function initVoice() {
    var mic = $("[data-mic]", compose), rec = $("[data-rec]", compose);
    if (!mic || !window.EEChatMedia) return;
    var r = EEChatMedia.recorder(), tick = null, max = +chat.getAttribute("data-voice-max") || 180;
    if (!r.supported) { mic.remove(); state(); return; }
    function stopUI() { clearInterval(tick); rec.hidden = true; form.hidden = false; }
    mic.addEventListener("click", function () {
      r.start().then(function () {
        form.hidden = true; rec.hidden = false;
        var tEl = $("[data-rec-time]", rec);
        tick = setInterval(function () { var s = Math.floor(r.elapsed()); tEl.textContent = Math.floor(s / 60) + ":" + ("0" + s % 60).slice(-2); if (s >= max) $("[data-rec-send]", rec).click(); }, 250);
      }).catch(function () { toast("Allow the microphone to record a voice note.", "error"); });
    });
    $("[data-rec-cancel]", rec).addEventListener("click", function () { r.cancel(); stopUI(); });
    $("[data-rec-send]", rec).addEventListener("click", function () {
      r.stop().then(function (res) {
        stopUI();
        if (!res || res.seconds < 1) return;
        var ext = /ogg/.test(res.type) ? ".ogg" : /mp4/.test(res.type) ? ".m4a" : ".webm";
        submit({ voice: [res.blob, "voice-note" + ext], duration: String(res.seconds) });
      });
    });
  }

  /* ---- message menu: chevron, right-click, long-press ---- */
  var ctx = $("[data-ctx]"), ctxRow = null, backdrop = null;
  function openCtx(row, x, y) {
    if (!ctx || row.classList.contains("is-deleted") || row.classList.contains("is-pending")) return;
    closeCtx(); ctxRow = row; row.classList.add("is-selected");
    var mine = row.hasAttribute("data-mine");
    $$("[data-own-only]", ctx).forEach(function (b) { b.hidden = !(mine && row.hasAttribute("data-can-change") && row.querySelector("[data-text]")); });
    $$("[data-others-only]", ctx).forEach(function (b) { b.hidden = mine; });
    var sl = $("[data-star-label]", ctx); if (sl) sl.textContent = row.hasAttribute("data-starred") ? "Unstar" : "Star";
    var pl = $("[data-pin-label]", ctx); if (pl) pl.textContent = row.hasAttribute("data-pinned") ? "Unpin" : "Pin";
    var cp = $('[data-act="copy"]', ctx); if (cp) cp.hidden = !row.querySelector("[data-text]");
    var mineR = $$(".wa-react.is-mine", row).map(function (b) { return b.getAttribute("data-react"); });
    $$("[data-ctx-react]", ctx).forEach(function (b) { b.classList.toggle("is-mine", mineR.indexOf(b.getAttribute("data-ctx-react")) >= 0); });
    var rs = $("[data-ctx-reacts]", ctx); if (rs) rs.hidden = !!(wa && chat.querySelector(".wa-readonly"));
    backdrop = document.createElement("div"); backdrop.className = "wa-ctx-backdrop"; backdrop.addEventListener("click", closeCtx);
    document.body.appendChild(backdrop);
    ctx.hidden = false;
    var w = ctx.offsetWidth, h = ctx.offsetHeight, vw = innerWidth, vh = innerHeight;
    ctx.style.left = Math.max(10, Math.min(x, vw - w - 10)) + "px";
    ctx.style.top = Math.max(10, Math.min(y, vh - h - 10)) + "px";
    var first = ctx.querySelector("button:not([hidden])"); if (first) first.focus({ preventScroll: true });
  }
  function closeCtx() { if (ctx) ctx.hidden = true; if (backdrop) { backdrop.remove(); backdrop = null; } if (ctxRow) ctxRow.classList.remove("is-selected"); }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeCtx(); });
  box.addEventListener("click", function (e) {
    var b = e.target.closest("[data-menu]");
    if (b) { var r = b.getBoundingClientRect(); openCtx(b.closest(".wa-row"), r.left - 180, r.bottom + 4); }
  });
  box.addEventListener("contextmenu", function (e) {
    var row = e.target.closest(".wa-row"); if (!row || e.target.closest("a")) return;
    e.preventDefault(); openCtx(row, e.clientX, e.clientY);
  });
  var press = null;
  box.addEventListener("touchstart", function (e) {
    var row = e.target.closest(".wa-row"); if (!row) return;
    var t = e.touches[0];
    press = setTimeout(function () { press = null; if (navigator.vibrate) navigator.vibrate(12); openCtx(row, t.clientX - 100, t.clientY - 140); }, 480);
  }, { passive: true });
  ["touchend", "touchmove", "touchcancel"].forEach(function (ev) { box.addEventListener(ev, function () { if (press) { clearTimeout(press); press = null; } }, { passive: true }); });
  // swipe right to reply (phones)
  var sx = 0, sy = 0, srow = null;
  box.addEventListener("touchstart", function (e) { var r = e.target.closest(".wa-row"); srow = r; sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  box.addEventListener("touchmove", function (e) {
    if (!srow || !compose) return;
    var dx = e.touches[0].clientX - sx, dy = Math.abs(e.touches[0].clientY - sy);
    if (dx > 0 && dx < 90 && dy < 30) srow.style.transform = "translateX(" + dx + "px)";
  }, { passive: true });
  box.addEventListener("touchend", function (e) {
    if (!srow) return;
    var dx = (e.changedTouches[0].clientX - sx);
    srow.style.transform = "";
    if (dx > 70 && compose && on("replies") && !srow.classList.contains("is-deleted")) startReply(srow);
    srow = null;
  }, { passive: true });

  if (ctx) ctx.addEventListener("click", function (e) {
    var row = ctxRow; if (!row) return;
    var id = row.getAttribute("data-mid");
    var rb = e.target.closest("[data-ctx-react]");
    if (rb) { closeCtx(); react(id, rb.getAttribute("data-ctx-react")); return; }
    var b = e.target.closest("[data-act]"); if (!b) return;
    var act = b.getAttribute("data-act"); closeCtx(); msgTarget = id;
    if (act === "reply") startReply(row);
    else if (act === "copy") { var t = row.querySelector("[data-text]"); if (t && navigator.clipboard) navigator.clipboard.writeText(t.innerText).then(function () { toast("Copied"); }); }
    else if (act === "edit") startEdit(row);
    else if (act === "star") post(base + "m/" + id + "/star/").then(function (d) { if (d.ok) { upsert(d.html, false); toast(d.starred ? "Starred" : "Unstarred"); } });
    else if (act === "pin") post(base + "m/" + id + "/pin/", row.hasAttribute("data-pinned") ? { unpin: "1" } : {}).then(function (d) {
      if (!d.ok) { toast(d.error, "error"); return; }
      $("[data-pins-wrap]", chat).innerHTML = d.pins || ""; initPins();
      row.toggleAttribute("data-pinned"); EEChatLive && EEChatLive.poke();
    });
    else if (act === "remind") dlg("remind").showModal();
    else if (act === "report") dlg("report").showModal();
    else if (act === "forward") openForward(id);
    else if (act === "delete") {
      var d = dlg("delete"), every = $('[data-delete-scope="everyone"]', d);
      every.hidden = !((row.hasAttribute("data-mine") && row.hasAttribute("data-can-change")) || (chat.getAttribute("data-is-admin") === "1" && chat.getAttribute("data-kind") !== "direct"));
      d.showModal();
    }
  });
  $$("[data-delete-scope]").forEach(function (b) {
    b.addEventListener("click", function () {
      var scope = b.getAttribute("data-delete-scope"), id = msgTarget;
      b.closest("dialog").close();
      post(base + "m/" + id + "/delete/", { scope: scope }).then(function (d) {
        if (!d.ok) { toast(d.error, "error"); return; }
        if (scope === "me") { var el = box.querySelector('[data-mid="' + id + '"]'); if (el) el.remove(); days(); }
        else upsert(d.html, false);
        EEChatLive && EEChatLive.poke();
      });
    });
  });

  function react(id, emoji) {
    post(base + "m/" + id + "/react/", { emoji: emoji }).then(function (d) { if (d.ok) { upsert(d.html, false); EEChatLive && EEChatLive.poke(); } else toast(d.error, "error"); });
  }
  box.addEventListener("click", function (e) {
    var r = e.target.closest("[data-react]");
    if (r && chat.getAttribute("data-can-post") !== "" ) { react(r.closest("[data-mid]").getAttribute("data-mid"), r.getAttribute("data-react")); return; }
    var opt = e.target.closest(".wa-poll__opt");
    if (opt && !opt.disabled) {
      var poll = opt.closest("[data-poll]"), multi = poll.getAttribute("data-multiple") === "1";
      var chosen = multi ? $$(".wa-poll__opt.is-mine", poll).map(function (o) { return o.getAttribute("data-option"); }) : [];
      var oid = opt.getAttribute("data-option"), i = chosen.indexOf(oid);
      if (multi) { if (i >= 0) chosen.splice(i, 1); else chosen.push(oid); }
      else chosen = opt.classList.contains("is-mine") ? [] : [oid];
      post(poll.getAttribute("data-poll"), { option: chosen }).then(function (d) { if (d.ok) { upsert(d.html, false); EEChatLive && EEChatLive.poke(); } else toast(d.error, "error"); });
      return;
    }
    var g = e.target.closest("[data-going]");
    if (g) post(g.getAttribute("data-going")).then(function (d) { if (d.ok) { upsert(d.html, false); EEChatLive && EEChatLive.poke(); } });
  });

  function openForward(id) {
    var d = dlg("forward"), ul = $("[data-fw-list]", d), s = $("[data-fw-search]", d);
    ul.innerHTML = '<li class="wa-fw__loading">Loading chats…</li>';
    d.showModal();
    fetch(base + "m/" + id + "/forward/", { credentials: "same-origin", headers: { "Accept": "application/json" } }).then(function (r) { return r.json(); }).then(function (data) {
      ul.innerHTML = "";
      (data.targets || []).forEach(function (t) {
        var li = document.createElement("li"), l = document.createElement("label");
        var cb = document.createElement("input"); cb.type = "checkbox"; cb.name = "to"; cb.value = t.id;
        var av = document.createElement("span"); av.className = "wa-row__av msg-avatar-" + t.color; av.textContent = t.initials;
        var nm = document.createElement("span"); nm.textContent = t.title;
        l.append(cb, av, nm); li.appendChild(l); li.setAttribute("data-name", t.title.toLowerCase()); ul.appendChild(li);
        cb.addEventListener("change", function () { if ($$("input:checked", ul).length > 5) { cb.checked = false; toast("Up to 5 chats."); } });
      });
      if (!ul.children.length) ul.innerHTML = '<li class="wa-fw__loading">No chats you can post in.</li>';
    });
    s.oninput = function () { var q = s.value.toLowerCase(); $$("li[data-name]", ul).forEach(function (li) { li.hidden = q && li.getAttribute("data-name").indexOf(q) < 0; }); };
  }
})();
