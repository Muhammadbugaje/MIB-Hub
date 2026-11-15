/* EE Hub — living.js (Round 5G): public news, events and gallery.
   - gallery lightbox: keyboard (arrows, Home/End, Esc), swipe, counter, slideshow,
     focus kept inside and returned to the picture on close, neighbours preloaded
   - "More" share button uses the phone's share sheet when there is one */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement;
  function $(s, c) { return (c || doc).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || doc).querySelectorAll(s)); }
  var reduce = (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) || root.getAttribute("data-motion") === "reduce";

  /* ---- Native share ------------------------------------------------------------------ */
  if (navigator.share) {
    $$("[data-native-share]").forEach(function (b) {
      b.hidden = false;
      b.addEventListener("click", function () {
        navigator.share({ title: b.getAttribute("data-share-title") || doc.title, url: b.getAttribute("data-share-url") || location.href }).catch(function () {});
      });
    });
  }

  /* ---- Lightbox ---------------------------------------------------------------------- */
  var lb = null, items = [], idx = 0, opener = null, timer = null, touch = null;
  var ICON = {
    close: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    prev: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    next: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
    play: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg>',
    pause: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>'
  };

  function build() {
    lb = doc.createElement("div");
    lb.className = "lv-lb";
    lb.setAttribute("role", "dialog");
    lb.setAttribute("aria-modal", "true");
    lb.setAttribute("aria-label", "Picture viewer");
    lb.innerHTML =
      '<div class="lv-lb__top"><span class="lv-lb__count" aria-live="polite"></span>' +
      '<span class="lv-lb__tools"><button type="button" class="lv-lb__btn" data-lb-play aria-label="Start slideshow">' + ICON.play + '</button>' +
      '<button type="button" class="lv-lb__btn" data-lb-close aria-label="Close (Esc)">' + ICON.close + '</button></span></div>' +
      '<figure class="lv-lb__stage"><img alt=""><figcaption></figcaption></figure>' +
      '<button type="button" class="lv-lb__nav lv-lb__nav--prev" data-lb-prev aria-label="Previous picture">' + ICON.prev + '</button>' +
      '<button type="button" class="lv-lb__nav lv-lb__nav--next" data-lb-next aria-label="Next picture">' + ICON.next + '</button>';
    doc.body.appendChild(lb);
    lb.addEventListener("click", function (e) {
      if (e.target.closest("[data-lb-close]") || e.target === lb || e.target.classList.contains("lv-lb__stage")) return close();
      if (e.target.closest("[data-lb-prev]")) { stop(); return show(idx - 1, -1); }
      if (e.target.closest("[data-lb-next]")) { stop(); return show(idx + 1, 1); }
      if (e.target.closest("[data-lb-play]")) return timer ? stop() : play();
    });
    lb.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); stop(); show(idx - 1, -1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); stop(); show(idx + 1, 1); }
      else if (e.key === "Home") { e.preventDefault(); stop(); show(0, -1); }
      else if (e.key === "End") { e.preventDefault(); stop(); show(items.length - 1, 1); }
      else if (e.key === "Tab") {           // keep focus inside the viewer
        var f = $$("button", lb).filter(function (b) { return b.offsetParent !== null; });
        if (!f.length) return;
        var i = f.indexOf(doc.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    });
    // Swipe left/right to move, down to close.
    lb.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1) { touch = null; return; }
      touch = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    }, { passive: true });
    lb.addEventListener("touchmove", function (e) {
      if (!touch || reduce) return;
      var dx = e.touches[0].clientX - touch.x;
      $("img", lb).style.transform = "translateX(" + dx * 0.6 + "px)";
    }, { passive: true });
    lb.addEventListener("touchend", function (e) {
      if (!touch) return;
      var t = e.changedTouches[0], dx = t.clientX - touch.x, dy = t.clientY - touch.y;
      $("img", lb).style.transform = "";
      touch = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) { stop(); show(idx + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1); }
      else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) close();
    });
  }

  function preload(i) {
    var it = items[(i + items.length) % items.length];
    if (it) { var im = new Image(); im.src = it.getAttribute("data-lb-src"); }
  }

  function show(i, dir) {
    idx = (i + items.length) % items.length;
    var it = items[idx], img = $("img", lb), cap = $("figcaption", lb);
    var caption = it.getAttribute("data-lb-caption") || "";
    if (!reduce) {
      img.classList.remove("is-in-l", "is-in-r");
      void img.offsetWidth;
      img.classList.add(dir < 0 ? "is-in-l" : "is-in-r");
    }
    img.src = it.getAttribute("data-lb-src");
    img.alt = caption || ("Picture " + (idx + 1));
    cap.textContent = caption;
    cap.hidden = !caption;
    $(".lv-lb__count", lb).textContent = (idx + 1) + " / " + items.length;
    var single = items.length < 2;
    $$(".lv-lb__nav, [data-lb-play]", lb).forEach(function (b) { b.hidden = single; });
    preload(idx + 1); preload(idx - 1);
  }

  function play() {
    var b = $("[data-lb-play]", lb);
    b.innerHTML = ICON.pause; b.setAttribute("aria-label", "Pause slideshow");
    timer = setInterval(function () { show(idx + 1, 1); }, 4000);
  }
  function stop() {
    if (!timer) return;
    clearInterval(timer); timer = null;
    var b = $("[data-lb-play]", lb);
    b.innerHTML = ICON.play; b.setAttribute("aria-label", "Start slideshow");
  }

  function open(list, i, from, autoplay) {
    if (!lb) build();
    items = list; opener = from || null;
    show(i, 1);
    lb.classList.add("is-open");
    root.classList.add("lv-lb-open");
    $("[data-lb-close]", lb).focus();
    if (autoplay && items.length > 1) play();
  }
  function close() {
    if (!lb || !lb.classList.contains("is-open")) return;
    stop();
    lb.classList.remove("is-open");
    root.classList.remove("lv-lb-open");
    if (opener && opener.focus) opener.focus();
  }

  doc.addEventListener("click", function (e) {
    var p = e.target.closest("[data-lb-src]");
    if (p) {
      e.preventDefault();
      var list = $$("[data-lb-src]", p.closest("[data-lb-gallery]") || doc);
      return open(list, list.indexOf(p), p, false);
    }
    var s = e.target.closest("[data-lb-start]");
    if (s) {
      var all = $$("[data-lb-src]");
      if (all.length) open(all, 0, s, true);
    }
  });
})();
