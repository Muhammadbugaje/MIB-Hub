/* EE Hub — course-fx core: the small engine behind the animated figures on course pages.

   Markup (rendered by templates/academics/public/_fx.html):
     <figure class="cfx" data-fx="rmf" data-fx-mode="hero|figure" data-fx-opts='{"variant":"dq"}'>
       <div class="cfx__screen"><canvas></canvas></div> ... <div class="cfx__controls"></div>
     </figure>
   Visuals register with CourseFX.define(name, {controls, init, draw, click, still}) in the family files
   (machines.js, power.js, ...). draw(f) gets a frame object with the 2-D context, size, time and helpers.

   - one requestAnimationFrame loop; a canvas only animates while on screen and the tab is visible
   - device-pixel ratio capped (1.5 on phones, 2 elsewhere)
   - reduced motion (OS setting, html[data-motion=reduce]) => a still frame; controls still redraw it
   - every animated figure has a pause/play button (WCAG 2.2.2)
   - pointer/tap tooltips for regions a visual marks with f.hit(...)
   No dependencies. */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement;
  var FX = window.CourseFX = window.CourseFX || {};
  FX.defs = FX.defs || {};
  FX.define = function (name, def) { FX.defs[name] = def; };
  var TAU = Math.PI * 2;
  FX.TAU = TAU;

  function reduced() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) ||
      root.getAttribute("data-motion") === "reduce" || root.getAttribute("data-course-fx") === "still";
  }

  /* ---- colour helpers ----------------------------------------------------- */
  var rgbCache = {};
  function toRgb(c) {
    if (rgbCache[c]) return rgbCache[c];
    var m, out = [255, 255, 255];
    c = (c || "").trim();
    if ((m = /^#([0-9a-f]{3})$/i.exec(c))) out = [parseInt(m[1][0] + m[1][0], 16), parseInt(m[1][1] + m[1][1], 16), parseInt(m[1][2] + m[1][2], 16)];
    else if ((m = /^#([0-9a-f]{6})/i.exec(c))) out = [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
    else if ((m = /rgba?\(([^)]+)\)/.exec(c))) out = m[1].split(",").slice(0, 3).map(function (x) { return parseFloat(x); });
    rgbCache[c] = out;
    return out;
  }
  function alpha(c, a) { var r = toRgb(c); return "rgba(" + r[0] + "," + r[1] + "," + r[2] + "," + a + ")"; }
  FX.alpha = alpha;
  FX.lerp = function (a, b, t) { return a + (b - a) * t; };
  FX.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  FX.ease = function (t) { t = FX.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  // small deterministic random for repeatable "noise"
  FX.rng = function (seed) { var s = seed >>> 0 || 1; return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; };
  FX.gauss = function (r) { var u = r() || 1e-6, v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };

  function along(path, u) {
    var L = 0, segs = [];
    for (var i = 1; i < path.length; i++) { var l = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); segs.push(l); L += l; }
    var d = ((u % 1) + 1) % 1 * L, k = 0;
    while (k < segs.length - 1 && d > segs[k]) { d -= segs[k]; k++; }
    var t = segs[k] ? d / segs[k] : 0;
    return [path[k][0] + (path[k + 1][0] - path[k][0]) * t, path[k][1] + (path[k + 1][1] - path[k][1]) * t, L];
  }
  FX.along = along;
  function flowDots(f, path, phase, n, col, r) {
    var L = along(path, 0)[2], cnt = n || Math.max(4, Math.round(L / 26));
    for (var i = 0; i < cnt; i++) { var p = along(path, phase + i / cnt); f.circle(p[0], p[1], r || 2.6, col, null, 0, { glow: 10, glowColor: col }); }
  }
  FX.flowDots = flowDots;

  function readColours(host) {
    var cs = getComputedStyle(host);
    function v(n, d) { var x = cs.getPropertyValue(n).trim(); return x || d; }
    return {
      a: v("--fx-a", "#3dd68c"), b: v("--fx-b", "#f6c445"), c: v("--fx-c", "#5ec8ff"), d: v("--fx-d", "#ff6b6b"),
      ink: v("--fx-ink", "#e9f3ee"), dim: v("--fx-dim", "#8aa39a"), grid: v("--fx-grid", "rgba(255,255,255,.07)"),
      bg: v("--fx-bg", "#07130f"), panel: v("--fx-panel", "rgba(255,255,255,.04)"),
      mono: v("--fx-mono", "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"),
      sans: v("--fx-sans", "Inter, system-ui, sans-serif")
    };
  }

  /* ---- the frame object passed to draw() ----------------------------------- */
  function Frame(inst) { this.inst = inst; }
  var P = Frame.prototype;
  P.clear = function () { this.ctx.clearRect(0, 0, this.w, this.h); };
  P.a = function (c, al) { return alpha(c, al); };
  P.glow = function (c, blur) { this.ctx.shadowColor = c; this.ctx.shadowBlur = this.lowPower ? 0 : (blur == null ? 12 : blur); };
  P.noGlow = function () { this.ctx.shadowBlur = 0; this.ctx.shadowColor = "transparent"; };
  P.line = function (pts, color, width, o) {
    o = o || {};
    var x = this.ctx;
    if (!pts || pts.length < 2) return;
    x.save();
    x.beginPath();
    x.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]);
    if (o.close) x.closePath();
    if (o.fill) { x.fillStyle = o.fill; x.fill(); }
    x.strokeStyle = color; x.lineWidth = width || 2; x.lineJoin = "round"; x.lineCap = "round";
    if (o.dash) x.setLineDash(o.dash);
    if (o.alpha != null) x.globalAlpha = o.alpha;
    if (o.glow) this.glow(color, o.glow === true ? 10 : o.glow);
    if (color) x.stroke();
    x.restore();
  };
  P.seg = function (x1, y1, x2, y2, color, width, o) { this.line([[x1, y1], [x2, y2]], color, width, o); };
  P.circle = function (cx, cy, r, fill, stroke, lw, o) {
    var x = this.ctx;
    x.save();
    if (o && o.glow) this.glow(o.glowColor || fill || stroke, o.glow === true ? 12 : o.glow);
    x.beginPath(); x.arc(cx, cy, Math.max(0, r), 0, TAU);
    if (fill) { x.fillStyle = fill; x.fill(); }
    if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw || 1.5; if (o && o.dash) x.setLineDash(o.dash); x.stroke(); }
    x.restore();
  };
  P.rr = function (x0, y0, w, h, r) {
    var x = this.ctx; r = Math.min(r || 0, w / 2, h / 2);
    x.beginPath(); x.moveTo(x0 + r, y0); x.arcTo(x0 + w, y0, x0 + w, y0 + h, r); x.arcTo(x0 + w, y0 + h, x0, y0 + h, r);
    x.arcTo(x0, y0 + h, x0, y0, r); x.arcTo(x0, y0, x0 + w, y0, r); x.closePath();
  };
  P.box = function (x0, y0, w, h, r, fill, stroke, lw, o) {
    var x = this.ctx;
    x.save();
    if (o && o.glow) this.glow(o.glowColor || stroke || fill, o.glow === true ? 12 : o.glow);
    this.rr(x0, y0, w, h, r);
    if (fill) { x.fillStyle = fill; x.fill(); }
    if (stroke) { x.strokeStyle = stroke; x.lineWidth = lw || 1.5; if (o && o.dash) x.setLineDash(o.dash); x.stroke(); }
    x.restore();
  };
  P.text = function (s, tx, ty, o) {
    o = o || {};
    var x = this.ctx;
    x.save();
    x.font = (o.weight || 500) + " " + (o.size || 12) + "px " + (o.mono ? this.c.mono : this.c.sans);
    x.fillStyle = o.color || this.c.ink;
    x.textAlign = o.align || "left";
    x.textBaseline = o.baseline || "middle";
    if (o.glow) this.glow(o.glowColor || o.color || this.c.ink, o.glow === true ? 8 : o.glow);
    if (o.alpha != null) x.globalAlpha = o.alpha;
    x.fillText(s, tx, ty);
    x.restore();
  };
  P.arrow = function (x1, y1, x2, y2, color, width, o) {
    o = o || {};
    var x = this.ctx, ang = Math.atan2(y2 - y1, x2 - x1), len = Math.hypot(x2 - x1, y2 - y1);
    var hl = Math.min(o.head || 9, len * 0.45);
    x.save();
    if (o.glow) this.glow(color, o.glow === true ? 10 : o.glow);
    x.strokeStyle = color; x.fillStyle = color; x.lineWidth = width || 2; x.lineCap = "round";
    if (o.alpha != null) x.globalAlpha = o.alpha;
    x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2 - Math.cos(ang) * hl * 0.6, y2 - Math.sin(ang) * hl * 0.6); x.stroke();
    x.beginPath(); x.moveTo(x2, y2);
    x.lineTo(x2 - hl * Math.cos(ang - 0.42), y2 - hl * Math.sin(ang - 0.42));
    x.lineTo(x2 - hl * Math.cos(ang + 0.42), y2 - hl * Math.sin(ang + 0.42));
    x.closePath(); x.fill();
    x.restore();
  };
  P.grid = function (x0, y0, w, h, step, color) {
    var x = this.ctx, i;
    x.save(); x.strokeStyle = color || this.c.grid; x.lineWidth = 1; x.beginPath();
    for (i = x0; i <= x0 + w + 0.5; i += step) { x.moveTo(Math.round(i) + 0.5, y0); x.lineTo(Math.round(i) + 0.5, y0 + h); }
    for (i = y0; i <= y0 + h + 0.5; i += step) { x.moveTo(x0, Math.round(i) + 0.5); x.lineTo(x0 + w, Math.round(i) + 0.5); }
    x.stroke(); x.restore();
  };
  /* A plot box: returns {X(v), Y(v), x0,y0,w,h} and draws a light frame, zero lines and labels. */
  P.plot = function (x0, y0, w, h, xr, yr, o) {
    o = o || {};
    var self = this;
    var X = function (v) { return x0 + (v - xr[0]) / (xr[1] - xr[0]) * w; };
    var Y = function (v) { return y0 + h - (v - yr[0]) / (yr[1] - yr[0]) * h; };
    if (o.frame !== false) {
      self.box(x0, y0, w, h, 6, o.fill || self.c.panel, null);
      if (o.grid !== false) {
        var nx = o.nx || 8, ny = o.ny || 4, i, x = self.ctx;
        x.save(); x.strokeStyle = self.c.grid; x.lineWidth = 1; x.beginPath();
        for (i = 1; i < nx; i++) { var gx = Math.round(x0 + w * i / nx) + 0.5; x.moveTo(gx, y0); x.lineTo(gx, y0 + h); }
        for (i = 1; i < ny; i++) { var gy = Math.round(y0 + h * i / ny) + 0.5; x.moveTo(x0, gy); x.lineTo(x0 + w, gy); }
        x.stroke(); x.restore();
      }
      if (yr[0] < 0 && yr[1] > 0) self.seg(x0, Y(0), x0 + w, Y(0), self.a(self.c.ink, 0.25), 1);
      if (o.xl) self.text(o.xl, x0 + w - 4, y0 + h - 9, { size: 10, color: self.c.dim, align: "right" });
      if (o.yl) self.text(o.yl, x0 + 6, y0 + 10, { size: 10, color: self.c.dim });
    }
    return { X: X, Y: Y, x0: x0, y0: y0, w: w, h: h };
  };
  P.curve = function (pl, fn, a, b, n, color, width, o) {
    var pts = [], i, v;
    n = n || 160;
    for (i = 0; i <= n; i++) { v = a + (b - a) * i / n; var y = fn(v); if (isFinite(y)) pts.push([pl.X(v), pl.Y(y)]); }
    this.line(pts, color, width, o);
    return pts;
  };
  P.hit = function (shape, label, desc) { shape.label = label; shape.desc = desc || ""; this.inst.hits.push(shape); };
  P.over = function (shape) {
    var p = this.pointer;
    if (!p || !p.inside) return false;
    if (shape.r != null) return Math.hypot(p.x - shape.x, p.y - shape.y) <= shape.r;
    return p.x >= shape.x && p.x <= shape.x + shape.w && p.y >= shape.y && p.y <= shape.y + shape.h;
  };

  /* ---- instances ------------------------------------------------------------ */
  var instances = [];

  function Inst(host) {
    var self = this;
    this.host = host;
    this.name = host.getAttribute("data-fx");
    this.def = FX.defs[this.name];
    this.mode = host.getAttribute("data-fx-mode") || "figure";
    try { this.opts = JSON.parse(host.getAttribute("data-fx-opts") || "{}") || {}; } catch (e) { this.opts = {}; }
    this.screen = host.querySelector(".cfx__screen") || host;
    this.canvas = this.screen.querySelector("canvas");
    if (!this.canvas) { this.canvas = doc.createElement("canvas"); this.screen.appendChild(this.canvas); }
    this.canvas.setAttribute("aria-hidden", "true");
    this.ctx = this.canvas.getContext("2d");
    this.vals = {};
    this.hits = [];
    this.t = 0;
    this.visible = false;
    var ms = host.closest("[data-fx-motion]");
    var motion = ms ? ms.getAttribute("data-fx-motion") : "full";
    this.reduce = reduced() || motion === "off";
    this.speed = motion === "reduced" ? 0.55 : 1;
    this.playing = !this.reduce;
    this.f = new Frame(this);
    this.f.opts = this.opts;
    this.f.mode = this.mode;
    this.f.v = this.vals;
    this.f.state = {};
    this.f.pointer = null;
    this.c = readColours(host);
    host.classList.add("cfx--live");
    this.buildControls();
    this.buildPause();
    this.tip = doc.createElement("div");
    this.tip.className = "cfx__tip";
    this.tip.hidden = true;
    this.screen.appendChild(this.tip);
    this.bindPointer();
    this.resize();
    if (this.def.init) this.def.init(this.f);
    if (this.reduce) this.t = this.def.still != null ? this.def.still : 2.4;
    this.draw(0);
    if ("ResizeObserver" in window) new ResizeObserver(function () { self.resize(); self.draw(0); }).observe(this.screen);
  }

  Inst.prototype.controlSpec = function () {
    var d = this.def;
    if (this.mode === "hero") return [];
    if (this.opts.controls === false) return [];
    var spec = typeof d.controls === "function" ? d.controls(this.opts) : (d.controls || []);
    return spec || [];
  };

  Inst.prototype.buildControls = function () {
    var self = this, spec = this.controlSpec();
    spec.forEach(function (c) { self.vals[c.key] = c.value != null ? c.value : (c.type === "toggle" ? false : c.min); });
    if (!spec.length) return;
    var box = this.host.querySelector(".cfx__controls");
    if (!box) { box = doc.createElement("div"); box.className = "cfx__controls"; this.screen.insertAdjacentElement("afterend", box); }
    var uid = "cfx" + Math.random().toString(36).slice(2, 7);
    spec.forEach(function (c, i) {
      var id = uid + "-" + i, wrap = doc.createElement("div");
      wrap.className = "cfx-ctl cfx-ctl--" + (c.type || "range");
      if (c.type === "select") {
        wrap.innerHTML = '<span class="cfx-ctl__lab"></span><div class="cfx-seg" role="radiogroup"></div>';
        wrap.firstChild.textContent = c.label;
        var seg = wrap.lastChild;
        seg.setAttribute("aria-label", c.label);
        c.options.forEach(function (o) {
          var b = doc.createElement("button");
          b.type = "button"; b.textContent = o[1]; b.setAttribute("role", "radio");
          b.setAttribute("aria-checked", String(o[0] === self.vals[c.key]));
          b.addEventListener("click", function () {
            self.vals[c.key] = o[0];
            Array.prototype.forEach.call(seg.children, function (x) { x.setAttribute("aria-checked", String(x === b)); });
            self.changed(c.key);
          });
          seg.appendChild(b);
        });
      } else if (c.type === "toggle" || c.type === "button") {
        var b = doc.createElement("button");
        b.type = "button"; b.className = "cfx-btn"; b.textContent = c.label;
        if (c.type === "toggle") { b.setAttribute("aria-pressed", String(!!self.vals[c.key])); self.toggles = (self.toggles || []).concat([[c.key, b]]); }
        if (c.hold) {
          var down = function (e) { e.preventDefault(); self.vals[c.key] = true; b.setAttribute("aria-pressed", "true"); self.changed(c.key); };
          var up = function () { if (!self.vals[c.key]) return; self.vals[c.key] = false; b.setAttribute("aria-pressed", "false"); self.changed(c.key); };
          b.addEventListener("pointerdown", down); b.addEventListener("pointerup", up); b.addEventListener("pointerleave", up);
          b.addEventListener("keydown", function (e) { if (e.key === " " || e.key === "Enter") down(e); });
          b.addEventListener("keyup", up);
        } else {
          b.addEventListener("click", function () {
            if (c.type === "toggle") { self.vals[c.key] = !self.vals[c.key]; b.setAttribute("aria-pressed", String(self.vals[c.key])); }
            else self.vals[c.key] = (self.vals[c.key] || 0) + 1;
            self.changed(c.key);
          });
        }
        wrap.appendChild(b);
      } else {
        wrap.innerHTML = '<label class="cfx-ctl__lab"></label><input type="range"><output class="cfx-ctl__out"></output>';
        var lab = wrap.children[0], inp = wrap.children[1], out = wrap.children[2];
        lab.textContent = c.label; lab.setAttribute("for", id);
        inp.id = id; inp.min = c.min; inp.max = c.max; inp.step = c.step || 1; inp.value = self.vals[c.key];
        var show = function () { out.textContent = c.fmt ? c.fmt(+inp.value) : inp.value + (c.unit || ""); inp.style.setProperty("--p", ((inp.value - c.min) / (c.max - c.min) * 100).toFixed(1) + "%"); };
        show();
        inp.addEventListener("input", function () { self.vals[c.key] = +inp.value; show(); self.changed(c.key); });
      }
      box.appendChild(wrap);
    });
  };

  Inst.prototype.changed = function (key) {
    if (this.def.onChange) this.def.onChange(this.f, key);
    if (!this.playing || !this.visible) this.draw(0);
  };

  Inst.prototype.buildPause = function () {
    var self = this, b = doc.createElement("button");
    b.type = "button";
    b.className = "cfx__pause";
    var set = function () {
      b.setAttribute("aria-label", self.playing ? "Pause animation" : "Play animation");
      b.setAttribute("aria-pressed", String(!self.playing));
      b.innerHTML = self.playing
        ? '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>'
        : '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M7 5l12 7-12 7z" fill="currentColor"/></svg>';
    };
    set();
    b.addEventListener("click", function () { self.playing = !self.playing; set(); kick(); });
    this.screen.appendChild(b);
  };

  Inst.prototype.bindPointer = function () {
    var self = this, cv = this.canvas;
    function pos(e) {
      var r = cv.getBoundingClientRect();
      self.f.pointer = { x: e.clientX - r.left, y: e.clientY - r.top, inside: true };
    }
    cv.addEventListener("pointermove", function (e) { pos(e); self.tipUpdate(); if (!self.playing) self.draw(0); });
    cv.addEventListener("pointerleave", function () { if (self.f.pointer) self.f.pointer.inside = false; self.tip.hidden = true; if (!self.playing) self.draw(0); });
    cv.addEventListener("pointerdown", function (e) {
      pos(e);
      if (self.def.click && self.def.click(self.f, self.f.pointer.x, self.f.pointer.y) !== false) {
        (self.toggles || []).forEach(function (tg) { tg[1].setAttribute("aria-pressed", String(!!self.vals[tg[0]])); });
        if (!self.playing) self.draw(0);
      }
      self.tipUpdate();
    });
  };

  Inst.prototype.tipUpdate = function () {
    var p = this.f.pointer, hit = null;
    if (p && p.inside) for (var i = this.hits.length - 1; i >= 0; i--) { if (this.f.over(this.hits[i])) { hit = this.hits[i]; break; } }
    this.canvas.style.cursor = hit ? "pointer" : "";
    if (!hit) { this.tip.hidden = true; return; }
    if (this.tip._for !== hit.label) {
      this.tip.innerHTML = "<b></b><span></span>";
      this.tip.firstChild.textContent = hit.label;
      this.tip.lastChild.textContent = hit.desc;
      this.tip._for = hit.label;
    }
    this.tip.hidden = false;
    var tw = this.tip.offsetWidth, th = this.tip.offsetHeight;
    var x = FX.clamp(p.x + 14, 6, this.f.w - tw - 6), y = p.y + 16;
    if (y + th > this.f.h - 4) y = p.y - th - 12;
    this.tip.style.transform = "translate(" + Math.round(x) + "px," + Math.round(Math.max(4, y)) + "px)";
  };

  Inst.prototype.resize = function () {
    if (this.mode !== "hero" && this.def.aspect) {
      var narrow = this.host.clientWidth < 560;
      var ar = narrow ? (this.def.aspectSmall || Math.max(0.9, this.def.aspect * 0.7)) : this.def.aspect;
      var want = String(ar);
      if (this.screen._ar !== want) { this.screen.style.aspectRatio = want; this.screen._ar = want; }
    }
    var w = this.screen.clientWidth, h = this.screen.clientHeight;
    if (!w || !h) return;
    var dpr = Math.min(window.devicePixelRatio || 1, w < 600 ? 1.5 : 2);
    this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = w + "px"; this.canvas.style.height = h + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.f.w = w; this.f.h = h; this.f.small = w < 520; this.f.dpr = dpr;
  };

  Inst.prototype.draw = function (dt) {
    if (!this.f.w) return;
    var f = this.f;
    f.ctx = this.ctx; f.c = this.c; f.t = this.t; f.dt = dt; f.playing = this.playing; f.reduce = this.reduce;
    f.lowPower = f.small && this.mode === "hero" && instances.length > 3;
    this.hits.length = 0;
    this.ctx.save();
    try { this.def.draw(f); } catch (e) { if (window.console) console.warn("course-fx " + this.name, e); this.playing = false; }
    this.ctx.restore();
    if (f.pointer && f.pointer.inside) this.tipUpdate();
  };

  /* ---- loop ---------------------------------------------------------------- */
  var running = false, last = 0;
  function frame(now) {
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    var any = false;
    if (!doc.hidden) {
      instances.forEach(function (it) {
        if (it.visible && it.playing) { var d = dt * it.speed; it.t += d; it.draw(d); any = true; }
      });
    }
    if (any) requestAnimationFrame(frame); else { running = false; last = 0; }
  }
  function kick() { if (!running) { running = true; last = 0; requestAnimationFrame(frame); } }
  doc.addEventListener("visibilitychange", function () { if (!doc.hidden) kick(); });

  function start() {
    var hosts = doc.querySelectorAll("[data-fx]");
    if (!hosts.length) return;
    var io = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var it = en.target._cfx;
        if (!it) return;
        it.visible = en.isIntersecting;
        if (it.visible) kick();
      });
    }, { rootMargin: "80px 0px" }) : null;
    Array.prototype.forEach.call(hosts, function (h) {
      var name = h.getAttribute("data-fx");
      if (!FX.defs[name] || h._cfx) return;
      try {
        var it = new Inst(h);
        h._cfx = it;
        instances.push(it);
        if (io) io.observe(h); else { it.visible = true; }
      } catch (e) { if (window.console) console.warn("course-fx", name, e); }
    });
    kick();
    // theme switches: re-read colours and redraw
    var mo = new MutationObserver(function () {
      instances.forEach(function (it) { it.c = readColours(it.host); it.draw(0); });
    });
    mo.observe(root, { attributes: true, attributeFilter: ["data-theme", "data-motion"] });
  }
  FX.start = start;
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start); else setTimeout(start, 0);
})();
