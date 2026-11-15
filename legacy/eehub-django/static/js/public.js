/* EE Hub public website behaviour (no dependencies).
   - header: glass overlay becomes solid on scroll; dropdown menus; mobile drawer
   - hero: typewriter, calm mode (pause motion), slides, live scope readout
   - ticker / partner marquee, horizontal scrollers with arrow buttons
   - event countdown, contact form (JSON), album lightbox
   Respects prefers-reduced-motion. */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement;
  var reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function store(key, val) { try { if (val === undefined) return localStorage.getItem(key); if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, val); } catch (e) { return null; } }

  /* ---- Theme toggle (Round 6) ---------------------------------------------
     Public pages do not load ui.js, so the header/drawer sun-moon buttons were
     never bound and "dark mode did nothing". Bind them here (once) and keep
     aria-pressed in step; app.js EETheme does the switching and remembering. */
  function syncTheme(theme) {
    var dark = (theme || root.getAttribute("data-theme")) === "dark";
    $$("[data-theme-toggle]").forEach(function (b) {
      b.setAttribute("aria-pressed", dark ? "true" : "false");
      b.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
    });
  }
  if (!(window.EE && window.EE.themeToggle)) {
    doc.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-theme-toggle]");
      if (!b) return;
      e.preventDefault();
      // Make the switch cheap: no transitions or running animations for the
      // frames in which every colour on the page changes; scenes pause too.
      root.classList.add("theme-switching");
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        requestAnimationFrame(function () { root.classList.remove("theme-switching"); });
      }); });
      if (window.EETheme) window.EETheme.toggle();
      else {
        var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", next);
        store("ee-theme", next);
        syncTheme(next);
      }
    });
    window.addEventListener("theme:change", function (e) { syncTheme(e.detail && e.detail.theme); });
    syncTheme();
  }

  /* ---- Leftovers from other apps on the same address (Round 6) -------------
     During development several projects share http://127.0.0.1:8000. A service
     worker or caches left by another project can keep serving its pages, icons
     or title. Remove any worker that is not EE Hub's /sw.js and any cache whose
     name is not EE Hub's ("ee-…"). */
  try {
    if ("serviceWorker" in navigator && navigator.serviceWorker.getRegistrations) {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        regs.forEach(function (r) {
          var w = r.active || r.waiting || r.installing;
          if (w && new URL(w.scriptURL).pathname !== "/sw.js") r.unregister();
        });
      }).catch(function () {});
    }
    if (window.caches && caches.keys) {
      caches.keys().then(function (keys) {
        keys.forEach(function (k) { if (k.indexOf("ee-") !== 0) caches.delete(k); });
      }).catch(function () {});
    }
  } catch (e) { /* private mode / blocked storage */ }

  /* ---- Header ------------------------------------------------------------ */
  var nav = $("[data-pub-nav]");
  if (nav && nav.classList.contains("pub-nav--overlay")) {
    var onScroll = function () { nav.classList.toggle("is-scrolled", window.scrollY > 40); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
  function closeMenus(except) {
    $$(".pub-menu.is-open").forEach(function (m) {
      if (m === except) return;
      m.classList.remove("is-open");
      var b = m.querySelector("[data-pub-menu]"); if (b) b.setAttribute("aria-expanded", "false");
    });
  }
  doc.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-pub-menu]");
    if (btn) {
      var menu = btn.parentElement, open = !menu.classList.contains("is-open");
      closeMenus(menu);
      menu.classList.toggle("is-open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      return;
    }
    if (!e.target.closest(".pub-menu")) closeMenus();
  });

  var drawer = $("[data-pub-drawer]"), opener = $("[data-pub-drawer-open]");
  function setDrawer(open) {
    if (!drawer) return;
    drawer.classList.toggle("is-open", open);
    drawer.setAttribute("aria-hidden", open ? "false" : "true");
    if (opener) opener.setAttribute("aria-expanded", open ? "true" : "false");
    root.style.overflow = open ? "hidden" : "";
    if (open) { var f = drawer.querySelector("a, button"); f && setTimeout(function () { f.focus(); }, 60); }
    else if (opener) opener.focus();
  }
  doc.addEventListener("click", function (e) {
    if (e.target.closest("[data-pub-drawer-open]")) return setDrawer(true);
    if (e.target.closest("[data-pub-drawer-close]") || e.target === drawer) return setDrawer(false);
    if (drawer && drawer.classList.contains("is-open") && e.target.closest(".pub-drawer a")) {
      drawer.classList.remove("is-open"); root.style.overflow = "";
    }
  });
  doc.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    closeMenus();
    if (drawer && drawer.classList.contains("is-open")) setDrawer(false);
    closeLightbox();
  });

  /* ---- Motion state ---------------------------------------------------------
     One place decides whether the hero moves: reduced motion (system or profile),
     calm mode (button / setting), the tab being hidden, the hero being off screen. */
  var body = doc.body;
  if (root.getAttribute("data-motion") === "reduce") reduce = true;
  var calmSaved = store("ee-calm");
  if (calmSaved === "1") body.classList.add("is-calm");
  else if (calmSaved === "0") body.classList.remove("is-calm");
  function calm() { return reduce || body.classList.contains("is-calm"); }
  var heroEl = $("[data-hero]");
  var heroSeen = true;            // hero intersecting the viewport
  var motionListeners = [];
  function heroRunning() { return !calm() && !doc.hidden && heroSeen; }
  function motionChanged() {
    var on = heroRunning();
    if (heroEl) heroEl.classList.toggle("is-still", !on);
    motionListeners.forEach(function (fn) { fn(on); });
  }
  function onMotion(fn) { motionListeners.push(fn); }
  doc.addEventListener("visibilitychange", motionChanged);
  if (heroEl && "IntersectionObserver" in window) {
    new IntersectionObserver(function (en) { heroSeen = en[0].isIntersecting; motionChanged(); }, { threshold: 0 }).observe(heroEl);
  }
  doc.addEventListener("click", function (e) {
    if (!e.target.closest("[data-calm-toggle]")) return;
    body.classList.toggle("is-calm");
    store("ee-calm", body.classList.contains("is-calm") ? "1" : "0");
    syncCalmButtons();
    if (!calm()) buildLive();
    motionChanged();
  });
  function syncCalmButtons() {
    $$("[data-calm-toggle]").forEach(function (b) { b.setAttribute("aria-pressed", body.classList.contains("is-calm") ? "true" : "false"); });
  }
  syncCalmButtons();

  /* ---- Hero: live layers ------------------------------------------------------
     The still SVG paints first. When motion is allowed we fetch scene.json, decode the
     layer images off the main thread, and fade the live stage in on top:
       base.svg (never re-rasterised) · gears (CSS rotate) · halos (CSS scale/opacity)
       · one <canvas> for current pulses, particles and sparks · arc (CSS opacity) · waves (CSS translate)
     Everything animated is transform/opacity on its own compositor layer, except the canvas,
     which redraws ~100 strokes per frame with no filters. Pauses off screen / hidden / calm. */
  var scene = $("[data-hero-scene]"), live = null, liveBusy = false, sceneData = null;
  var phoneMq = window.matchMedia ? window.matchMedia("(max-width: 700px)") : { matches: false };
  function buildLive() {
    if (!scene || live || liveBusy || calm()) return;
    liveBusy = true;
    var prefix = scene.getAttribute("data-hero-live");
    var get = sceneData ? Promise.resolve(sceneData) : fetch(prefix + "scene.json", { credentials: "same-origin" }).then(function (r) { return r.json(); });
    get.then(function (data) {
      sceneData = data;
      return makeLive(data[phoneMq.matches ? "mobile" : "desktop"], prefix, phoneMq.matches ? "mobile" : "desktop");
    }).then(function (l) { live = l; liveBusy = false; })
      .catch(function () { liveBusy = false; });
  }

  function makeLive(cfg, prefix, variant) {
    var wrap = doc.createElement("div");
    wrap.className = "pub-live";
    var stage = doc.createElement("div");
    stage.className = "pub-live__stage";
    wrap.appendChild(stage);
    var imgs = [];
    function img(src, cls, box, parent) {
      var im = new Image();
      im.decoding = "async"; im.alt = ""; im.className = cls; im.src = prefix + src;
      if (box) { im.style.left = box.l + "%"; im.style.top = box.t + "%"; im.style.width = box.w + "%"; im.style.height = box.h + "%"; }
      (parent || stage).appendChild(im); imgs.push(im);
      return im;
    }
    img(variant + "-base.svg", "pub-live__base");
    var gears = doc.createElement("div"); gears.className = "pub-live__gears"; stage.appendChild(gears);
    var big = Math.max.apply(null, cfg.layers.gears.map(function (g) { return g.r; }));
    cfg.layers.gears.forEach(function (g, i) {
      var im = img(g.src, "pub-live__gear" + (i % 2 ? " is-rev" : ""), g, gears);
      im.style.setProperty("--dur", (48 * g.r / big).toFixed(1) + "s");
    });
    cfg.layers.halos.forEach(function (h, i) {
      var d = doc.createElement("i"); d.className = "pub-live__halo";
      d.style.cssText = "left:" + h.l + "%;top:" + h.t + "%;width:" + h.w + "%;height:" + h.h + "%;animation-delay:-" + (i * 1.3) + "s";
      stage.appendChild(d);
    });
    var cv = doc.createElement("canvas"); cv.className = "pub-live__cv";
    wrap.appendChild(cv);
    if (cfg.layers.arc) img(cfg.layers.arc.src, "pub-live__arc", cfg.layers.arc);
    if (cfg.layers.waves) {
      var wv = img(cfg.layers.waves.src, "pub-live__waves", cfg.layers.waves);
      wv.style.setProperty("--shift", cfg.layers.waves.shift + "%");
    }

    var painter = canvasPainter(cv, cfg);
    function layout() {
      var W = wrap.clientWidth, H = wrap.clientHeight;
      if (!W || !H) return;
      var k = Math.max(W / cfg.w, H / cfg.h), sw = cfg.w * k, sh = cfg.h * k;
      var ox = (W - sw) * cfg.pos[0], oy = (H - sh) * cfg.pos[1];
      stage.style.width = sw + "px"; stage.style.height = sh + "px";
      stage.style.transform = "translate(" + ox + "px," + oy + "px)";
      painter.resize(W, H, k, ox, oy);
    }
    scene.appendChild(wrap);
    layout();
    var ro = "ResizeObserver" in window ? new ResizeObserver(function () { layout(); }) : null;
    if (ro) ro.observe(wrap); else window.addEventListener("resize", layout);
    function run(on) { wrap.classList.toggle("is-paused", !on); painter.run(on); }
    onMotion(run);
    return Promise.all(imgs.map(function (im) { return im.decode ? im.decode().catch(function () {}) : Promise.resolve(); }))
      .then(function () {
        if (window.performance && performance.mark) performance.mark("ee-hero-live");
        run(heroRunning());
        painter.draw(0);  // first frame matches the still art
        requestAnimationFrame(function () {
          scene.classList.add("is-live");
          setTimeout(function () { scene.classList.add("is-settled"); }, 1000);
        });
        phoneMq.addEventListener && phoneMq.addEventListener("change", function () {
          // the phone and desktop art differ: rebuild for the other variant
          if (ro) ro.disconnect();
          painter.run(false); wrap.remove(); scene.classList.remove("is-live", "is-settled");
          live = null; motionListeners.splice(motionListeners.indexOf(run), 1); buildLive();
        }, { once: true });
        return wrap;
      });
  }

  function canvasPainter(cv, cfg) {
    var ctx = cv.getContext("2d", { alpha: true });
    var dpr = 1, k = 1, ox = 0, oy = 0, cw = 0, ch = 0;
    var raf = 0, last = 0, clock = 0, lowPower = false;
    var pulses = cfg.canvas.pulses.map(function (p) { p.path = new Path2D(p.d); return p; });
    var sprites = {};
    function sprite(col) {   // soft round glow, drawn once per colour (replaces the SVG blur filter)
      if (sprites[col]) return sprites[col];
      var c = doc.createElement("canvas"); c.width = c.height = 64;
      var g = c.getContext("2d"), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, col); grd.addColorStop(0.28, col); grd.addColorStop(0.42, hexA(col, 0.45)); grd.addColorStop(1, hexA(col, 0));
      g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
      return (sprites[col] = c);
    }
    function hexA(h, a) {
      var n = parseInt(h.slice(1), 16);
      return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")";
    }
    function stroke(p, s, color, width, alpha, phase) {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(s.dash);
      ctx.lineDashOffset = s.off - phase;
      ctx.stroke(p.path);
    }
    function draw(t) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      ctx.setTransform(k * dpr, 0, 0, k * dpr, ox * dpr, oy * dpr);
      ctx.lineCap = "round";
      for (var i = 0; i < pulses.length; i++) {
        var p = pulses[i], ph = (t / p.dur % 1) * p.period;
        if (p.halo) stroke(p, p.halo, "#38e1f5", p.halo.w, p.halo.a, ph);
        if (p.glow) {
          if (!lowPower) { stroke(p, p.glow, "#38e1f5", p.glow.w * 3.4, 0.14, ph); stroke(p, p.glow, "#5ee9fa", p.glow.w * 2, 0.3, ph); }
          stroke(p, p.glow, "#7ef0ff", p.glow.w, 1, ph);
        }
        if (p.core) stroke(p, p.core, "#f0feff", p.core.w, 1, ph);
      }
      ctx.setLineDash([]);
      var stars = cfg.canvas.stars;
      for (var j = 0; j < stars.length; j++) {
        var s = stars[j], a = 0.25 + 0.75 * (0.5 - 0.5 * Math.cos(6.2832 * t / s[4] + s[5])), r = s[2] * 1.7 + 3.2;
        ctx.globalAlpha = a;
        ctx.drawImage(sprite(s[3]), s[0] - r, s[1] - r, r * 2, r * 2);
      }
      var sp = cfg.canvas.sparks;
      for (var m = 0; m < sp.length; m++) {
        var q = sp[m], u = ((t + q[7]) % q[6]) / q[6], e = 1 - (1 - u) * (1 - u), rr = q[4] * 1.8 + 2.4;
        ctx.globalAlpha = u < 0.1 ? u * 10 : 1 - (u - 0.1) / 0.9;
        ctx.drawImage(sprite(q[5]), q[0] + q[2] * e - rr, q[1] + q[3] * e - rr, rr * 2, rr * 2);
      }
      ctx.globalAlpha = 1;
    }
    // Adaptive quality: watch the real frame rate for the first ~90 frames after each start.
    // Under ~45 fps the canvas drops its soft glow passes and paints every other frame;
    // under ~24 fps it freezes (gears, arc and waves keep turning on the compositor).
    var level = 0, sample = 0, sampleSum = 0, skip = false, warm = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      var dt = last ? now - last : 16.7;
      last = now;
      if (warm < 20) warm++;
      else if (sample < 90 && dt < 250) {
        sample++; sampleSum += dt;
        if (sample === 90) {
          var avg = sampleSum / 90;
          if (avg > 40 && level < 2) { level = 2; cancelAnimationFrame(raf); raf = 0; if (window.EE_DEBUG) console.log("hero canvas frozen", avg); return; }
          if (avg > 22 && level < 1) { level = 1; lowPower = true; sample = 0; sampleSum = 0; }
        }
      }
      clock += Math.min(dt, 50) / 1000;
      if (level >= 1) { skip = !skip; if (skip) return; }
      draw(clock);
    }
    return {
      resize: function (W, H, kk, x, y) {
        dpr = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(3e6 / (W * H)));  // soft glows: 1.5x is visually identical to 2x
        cw = cv.width = Math.round(W * dpr); ch = cv.height = Math.round(H * dpr);
        k = kk; ox = x; oy = y;
        draw(clock);
      },
      run: function (on) {
        if (on && !raf && level < 2) { last = 0; raf = requestAnimationFrame(frame); }
        else if (!on && raf) { cancelAnimationFrame(raf); raf = 0; }
      },
      draw: draw
    };
  }

  /* Parallax: pointer (subtle, two depths) and scroll; rAF-throttled, eased, transform-only. */
  if (scene && !reduce) {
    var px = 0, py = 0, tx = 0, ty = 0, sy = 0, pRaf = 0;
    var inner = heroEl && $(".pub-hero__inner", heroEl);
    var fine = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
    function pTick() {
      pRaf = 0;
      px += (tx - px) * 0.08; py += (ty - py) * 0.08;
      var still = Math.abs(tx - px) < 0.05 && Math.abs(ty - py) < 0.05;
      if (still) { px = tx; py = ty; }
      scene.style.transform = "translate3d(" + (px * -10).toFixed(2) + "px," + (py * -8 + sy * 0.14).toFixed(2) + "px,0)";
      var g = live && live.querySelector(".pub-live__gears");
      if (g) g.style.transform = "translate3d(" + (px * -9).toFixed(2) + "px," + (py * -7).toFixed(2) + "px,0)";
      if (inner) {
        inner.style.transform = sy ? "translate3d(0," + (sy * 0.08).toFixed(1) + "px,0)" : "";
        inner.style.opacity = sy ? Math.max(0.25, 1 - sy / 900).toFixed(3) : "";
      }
      if (!still) pRaf = requestAnimationFrame(pTick);
    }
    function kick() { if (!pRaf) pRaf = requestAnimationFrame(pTick); }
    if (fine && heroEl) {
      heroEl.addEventListener("pointermove", function (e) {
        if (calm()) return;
        var r = heroEl.getBoundingClientRect();
        tx = (e.clientX - r.left) / r.width - 0.5; ty = (e.clientY - r.top) / r.height - 0.5; kick();
      }, { passive: true });
      heroEl.addEventListener("pointerleave", function () { tx = ty = 0; kick(); });
    }
    window.addEventListener("scroll", function () {
      var y = window.scrollY;
      var h = heroEl ? heroEl.offsetHeight : 900;
      var next = y < h ? y : h;
      if (next !== sy) { sy = next; kick(); }
    }, { passive: true });
  }

  if (scene && !calm()) {
    // start after first paint so the still art and text are never delayed
    if ("requestIdleCallback" in window) requestIdleCallback(buildLive, { timeout: 900 });
    else setTimeout(buildLive, 300);
  }

  /* ---- Typewriter ------------------------------------------------------------
     The first word is in the HTML (no layout shift); this types the rest. */
  $$("[data-typewriter]").forEach(function (el) {
    var words;
    try { words = JSON.parse(el.getAttribute("data-typewriter")); } catch (e) { return; }
    if (!words || !words.length) return;
    function full() { el.innerHTML = words.map(function (w, k) { return '<span class="w' + (k % 6 + 1) + '">' + escapeHtml(w) + "</span>"; }).join(" "); }
    if (reduce) return full();
    var i = 0, pos = words[0].length, deleting = false, timer = 0, showingAll = false;
    function tick() {
      timer = 0;
      if (!heroRunning()) {
        if (calm() && !showingAll) { showingAll = true; full(); }
        return;   // resumed by onMotion
      }
      if (showingAll) { showingAll = false; i = 0; pos = 0; deleting = false; }
      var w = words[i % words.length];
      pos += deleting ? -1 : 1;
      el.innerHTML = '<span class="w' + (i % words.length % 6 + 1) + '">' + escapeHtml(w.slice(0, pos)) + "</span>";
      var delay = deleting ? 45 : 95;
      if (!deleting && pos >= w.length) { deleting = true; delay = 1500; }
      else if (deleting && pos <= 0) { deleting = false; i++; delay = 300; }
      timer = setTimeout(tick, delay);
    }
    onMotion(function (on) { if (!timer) timer = setTimeout(tick, on ? 400 : 0); });
    if (calm()) { showingAll = true; full(); } else { deleting = true; timer = setTimeout(tick, 2200); }
  });
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* ---- Live scope readout --------------------------------------------------- */
  var hz = $("[data-hz]");
  if (hz && !reduce) setInterval(function () {
    if (!heroRunning()) return;
    hz.textContent = (49.96 + Math.random() * 0.08).toFixed(2) + " Hz";
  }, 1200);
  motionChanged();

  /* ---- Pause section animations while off screen ------------------------------ */
  if ("IntersectionObserver" in window) {
    var secIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.target.classList.toggle("is-offscreen", !en.isIntersecting); });
    }, { rootMargin: "120px 0px" });
    $$(".pub-sec, .pub-ticker, .pub-numbers, [data-motion-zone]").forEach(function (el) { secIO.observe(el); });
  }

  /* ---- Hero slides ------------------------------------------------------------ */
  $$("[data-slides]").forEach(function (wrap) {
    var hero = wrap.closest("[data-hero]");
    var slides = $$("[data-slide]", wrap), copies = $$("[data-slide-copy]", hero), dots = $$("[data-slide-dot]", hero);
    if (slides.length < 2) return;
    var cur = 0, timer = null;
    function show(n) {
      cur = (n + slides.length) % slides.length;
      [slides, copies, dots].forEach(function (list) { list.forEach(function (el, k) { el.classList.toggle("is-active", k === cur); }); });
    }
    function start() { stop(); if (!reduce) timer = setInterval(function () { if (!calm()) show(cur + 1); }, 6500); }
    function stop() { if (timer) clearInterval(timer); timer = null; }
    dots.forEach(function (d) { d.addEventListener("click", function () { show(+d.getAttribute("data-slide-dot")); start(); }); });
    hero.addEventListener("mouseenter", stop); hero.addEventListener("mouseleave", start);
    start();
  });

  /* ---- Ticker and marquee ------------------------------------------------------------ */
  $$("[data-ticker]").forEach(function (run) {
    var vp = run.parentElement;
    if (run.scrollWidth <= vp.clientWidth || reduce) return;
    run.innerHTML += run.innerHTML.replace(/<a /g, '<a aria-hidden="true" tabindex="-1" ');
    run.style.setProperty("--dur", Math.max(25, Math.round(run.scrollWidth / 2 / 60)) + "s");
    run.classList.add("is-moving");
  });

  /* ---- Courses at 400/500 level: marquees + level switcher ------------------------
     Each row is cloned once (clone hidden from assistive tech, not focusable) and moved with a
     CSS transform; rows pause on hover/focus and off screen. Reduced motion: a still grid. */
  $$("[data-courses]").forEach(function (sec) {
    function arm(panel) {
      if (reduce) return;
      $$("[data-course-marquee]", panel).forEach(function (run) {
        if (run.classList.contains("is-moving")) return;
        var vp = run.parentElement;
        run.style.flexWrap = "nowrap"; run.style.width = "max-content";
        var fits = run.scrollWidth <= vp.clientWidth;
        run.style.flexWrap = ""; run.style.width = "";
        if (fits && run.children.length < 4) return;   // a short row stays still
        $$(":scope > li", run).forEach(function (li) {
          var c = li.cloneNode(true);
          c.setAttribute("aria-hidden", "true"); c.setAttribute("inert", "");
          $$("a", c).forEach(function (a) { a.setAttribute("tabindex", "-1"); });
          run.appendChild(c);
        });
        run.classList.add("is-moving");
      });
    }
    var sw = $("[data-level-switch]", sec), ind = sw && $(".pub-courses__ind", sw);
    var tabs = sw ? $$("[data-level-tab]", sw) : [];
    function place(btn) {
      if (!ind || !btn) return;
      ind.style.setProperty("--w", btn.offsetWidth + "px");
      ind.style.setProperty("--x", btn.offsetLeft + "px");
    }
    function select(btn, focus) {
      var key = btn.getAttribute("data-level-tab");
      tabs.forEach(function (t) {
        var on = t === btn;
        t.classList.toggle("is-active", on); t.setAttribute("aria-selected", on ? "true" : "false"); t.tabIndex = on ? 0 : -1;
      });
      place(btn);
      if (focus) btn.focus();
      var next = $('[data-level-panel="' + key + '"]', sec), cur = $(".pub-courses__panel.is-active", sec);
      if (!next || next === cur) return;
      function show() {
        if (cur) { cur.hidden = true; cur.classList.remove("is-active", "is-leaving"); }
        next.hidden = false; next.classList.add("is-active"); arm(next);
      }
      if (cur && !reduce) { cur.classList.add("is-leaving"); setTimeout(show, 240); } else show();
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(t); });
      t.addEventListener("keydown", function (e) {
        var d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!d) return;
        e.preventDefault(); select(tabs[(i + d + tabs.length) % tabs.length], true);
      });
    });
    if (sw) {
      place($(".is-active", sw));
      requestAnimationFrame(function () { sw.classList.add("is-ready"); });
      window.addEventListener("resize", function () { place($(".is-active", sw)); });
      if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { place($(".is-active", sw)); });
    }
    arm($(".pub-courses__panel.is-active", sec) || sec);
  });

  /* ---- Horizontal scrollers ------------------------------------------------------------ */
  function scrollerFor(id) { return doc.getElementById(id); }
  doc.addEventListener("click", function (e) {
    var b = e.target.closest("[data-scroll-prev], [data-scroll-next]");
    if (!b) return;
    var next = b.hasAttribute("data-scroll-next");
    var el = scrollerFor(b.getAttribute(next ? "data-scroll-next" : "data-scroll-prev"));
    if (!el) return;
    el.scrollBy({ left: (next ? 1 : -1) * Math.max(240, el.clientWidth * 0.7), behavior: reduce ? "auto" : "smooth" });
  });
  function syncArrows(el) {
    var id = el.id; if (!id) return;
    var max = el.scrollWidth - el.clientWidth - 2;
    $$('[data-scroll-prev="' + id + '"]').forEach(function (b) { b.disabled = el.scrollLeft <= 2; });
    $$('[data-scroll-next="' + id + '"]').forEach(function (b) { b.disabled = el.scrollLeft >= max; });
  }
  $$("[data-scroller]").forEach(function (el) {
    if (el.hasAttribute("data-scroll-end")) {
      var cur = el.querySelector(".is-current");
      if (cur) el.scrollLeft = Math.max(0, cur.offsetLeft - el.clientWidth / 2 + cur.clientWidth / 2);
    }
    el.addEventListener("scroll", function () { syncArrows(el); }, { passive: true });
    window.addEventListener("resize", function () { syncArrows(el); });
    syncArrows(el);
    // Drag to scroll with a mouse
    var down = false, sx = 0, sl = 0, moved = false;
    el.addEventListener("mousedown", function (e) { down = true; moved = false; sx = e.pageX; sl = el.scrollLeft; });
    window.addEventListener("mouseup", function () { down = false; });
    el.addEventListener("mousemove", function (e) { if (!down) return; var dx = e.pageX - sx; if (Math.abs(dx) > 4) moved = true; el.scrollLeft = sl - dx; });
    el.addEventListener("click", function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  });

  /* ---- Countdown ------------------------------------------------------------------------- */
  $$("[data-countdown]").forEach(function (el) {
    var t = Date.parse(el.getAttribute("data-countdown"));
    if (isNaN(t)) return;
    var parts = { d: $('[data-cd="d"]', el), h: $('[data-cd="h"]', el), m: $('[data-cd="m"]', el), s: $('[data-cd="s"]', el) };
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function render() {
      var diff = Math.max(0, Math.floor((t - Date.now()) / 1000));
      parts.d && (parts.d.textContent = Math.floor(diff / 86400));
      parts.h && (parts.h.textContent = pad(Math.floor(diff % 86400 / 3600)));
      parts.m && (parts.m.textContent = pad(Math.floor(diff % 3600 / 60)));
      parts.s && (parts.s.textContent = pad(diff % 60));
    }
    render(); setInterval(render, 1000);
  });

  /* ---- Contact form ------------------------------------------------------------------------ */
  doc.addEventListener("submit", function (e) {
    var form = e.target.closest("form[data-contact-form]");
    if (!form) return;
    e.preventDefault();
    var ok = $(".pub-cform__ok", form), err = $(".pub-cform__err", form), btn = $("[type=submit]", form);
    err.hidden = true;
    if (!form.checkValidity()) {
      err.textContent = "Please fill in your name, a valid e-mail and a message of at least 10 characters.";
      err.hidden = false; return;
    }
    btn.disabled = true;
    fetch(form.action, { method: "POST", body: new FormData(form), credentials: "same-origin", headers: { "Accept": "application/json", "X-Requested-With": "fetch" } })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: "Something went wrong. Please try again." }; }); })
      .then(function (data) {
        btn.disabled = false;
        if (data.ok) {
          $("[data-contact-ok]", form).textContent = data.message || "Thank you. We will reply soon.";
          ok.hidden = false; form.reset();
          if (window.EE && EE.Toast) EE.Toast.push("success", "Message sent", "");
        } else { err.textContent = data.error || "Please check your message."; err.hidden = false; }
      })
      .catch(function () { btn.disabled = false; err.textContent = "Network problem. Please try again."; err.hidden = false; });
  });

  /* ---- Lightbox ------------------------------------------------------------------------------ */
  var lb = null, lbItems = [], lbIdx = 0;
  function openLightbox(items, idx) {
    if (!lb) {
      lb = doc.createElement("div");
      lb.className = "pub-lightbox"; lb.setAttribute("role", "dialog"); lb.setAttribute("aria-modal", "true"); lb.setAttribute("aria-label", "Photo");
      lb.innerHTML = '<div><img alt=""><p></p></div><button type="button" data-lb-close aria-label="Close">✕</button>' +
        '<button type="button" data-lb-prev aria-label="Previous">‹</button><button type="button" data-lb-next aria-label="Next">›</button>';
      doc.body.appendChild(lb);
      lb.addEventListener("click", function (e) {
        if (e.target.closest("[data-lb-close]") || e.target === lb) return closeLightbox();
        if (e.target.closest("[data-lb-prev]")) return showLb(lbIdx - 1);
        if (e.target.closest("[data-lb-next]")) return showLb(lbIdx + 1);
      });
      doc.addEventListener("keydown", function (e) {
        if (!lb.classList.contains("is-open")) return;
        if (e.key === "ArrowLeft") showLb(lbIdx - 1);
        if (e.key === "ArrowRight") showLb(lbIdx + 1);
      });
    }
    lbItems = items; showLb(idx); lb.classList.add("is-open"); root.style.overflow = "hidden";
    $("[data-lb-close]", lb).focus();
  }
  function showLb(i) {
    lbIdx = (i + lbItems.length) % lbItems.length;
    var it = lbItems[lbIdx];
    $("img", lb).src = it.getAttribute("data-full");
    $("p", lb).textContent = it.getAttribute("data-caption") || "";
  }
  function closeLightbox() { if (lb && lb.classList.contains("is-open")) { lb.classList.remove("is-open"); root.style.overflow = ""; } }
  doc.addEventListener("click", function (e) {
    var p = e.target.closest("[data-full]");
    if (!p) return;
    e.preventDefault();
    var items = $$("[data-full]", p.closest("[data-gallery]") || doc);
    openLightbox(items, items.indexOf(p));
  });

  /* ---- Tabs (history timelines) ------------------------------------------------------------- */
  doc.addEventListener("click", function (e) {
    var t = e.target.closest(".pub-tabs [data-tab]");
    if (!t) return;
    var list = t.parentElement;
    $$("[data-tab]", list).forEach(function (b) {
      var on = b === t, panel = doc.getElementById(b.getAttribute("data-tab"));
      b.classList.toggle("is-active", on); b.setAttribute("aria-selected", on ? "true" : "false");
      if (panel) panel.hidden = !on;
    });
  });

  /* ---- Guide table of contents highlight ------------------------------------------------------ */
  var toc = $$(".pub-toc a");
  if (toc.length && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        toc.forEach(function (a) { a.classList.toggle("is-current", a.getAttribute("href") === "#" + en.target.id); });
      });
    }, { rootMargin: "-20% 0px -70% 0px" });
    toc.forEach(function (a) { var t = doc.getElementById(a.getAttribute("href").slice(1)); if (t) io.observe(t); });
  }
})();
