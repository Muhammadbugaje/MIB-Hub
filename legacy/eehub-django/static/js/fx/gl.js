/* EE Hub visual themes: small shared helpers for the hand-written scenes
   (electric field, waves, black hole, galaxy). No dependencies.

   A scene module exports `create(canvas, opts)` and returns
     { start(), stop(), resize(cssW, cssH, dpr), destroy(), still?() }
   The host (fx/scenes.js) decides when it runs: on screen, tab visible,
   motion allowed. opts = { palette: {a, b, c, bg}, phone, motion, quality } */

export const PALETTES = {
  // EE brand: gold, volt (cyan), a soft violet and the deep green-black of the hero
  brand:    { a: "#e6c867", b: "#38e1f5", c: "#a78bfa", bg: "#04100c" },
  // Layers' "Coral" pair: electric blue to violet on near-black
  electric: { a: "#25b8ff", b: "#b04dff", c: "#ff5ad1", bg: "#04050c" },
  // Warm: amber to rose (power, heat)
  ember:    { a: "#ffb547", b: "#ff4f6d", c: "#ffd27a", bg: "#0b0506" },
  // Cool greens: ABU green to mint
  campus:   { a: "#4ade80", b: "#38e1f5", c: "#e6c867", bg: "#03110b" },
};

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return [1, 1, 1];
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function palette(name, a, b) {
  const p = Object.assign({ name: PALETTES[name] ? name : (name === "custom" ? "custom" : "brand") }, PALETTES[name] || PALETTES.brand);
  if (name === "custom") {
    p.a = a || PALETTES.brand.a;
    p.b = b || PALETTES.brand.b;
  }
  return p;
}

export function getGL(canvas, attrs) {
  const params = Object.assign({ alpha: false, antialias: false, depth: false, stencil: false,
    premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: "high-performance" }, attrs || {});
  return canvas.getContext("webgl", params) || canvas.getContext("experimental-webgl", params);
}

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    gl.deleteShader(s);
    throw new Error("shader: " + log);
  }
  return s;
}

export function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("link: " + gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const name = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, "");
    u[name] = gl.getUniformLocation(p, name);
  }
  return { p, u };
}

export const QUAD_VS = `attribute vec2 aPos; varying vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

/** A full-screen triangle pair bound to attribute 0 of `prog`. */
export function quad(gl, prog) {
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog.p, "aPos");
  return function draw() {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };
}

/** requestAnimationFrame loop with a clamped dt; start/stop are idempotent.
    `draw(dt, t)` gets seconds. `fpsCap` (e.g. 30 on phones) skips frames. */
export function loop(draw, fpsCap) {
  let raf = 0, last = 0, t = 0, acc = 0;
  const minStep = fpsCap ? 1 / fpsCap : 0;
  function tick(now) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (minStep) { acc += dt; if (acc < minStep) return; }
    const step = minStep ? Math.min(0.05, acc) : dt;
    acc = 0;
    t += step;
    draw(step, t);
  }
  return {
    start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } },
    stop() { if (raf) cancelAnimationFrame(raf); raf = 0; },
    get time() { return t; },
    set time(v) { t = v; },
    running() { return !!raf; },
  };
}

/** Size a canvas's backing store for its CSS box (scale < 1 renders below
    native resolution; shaders are soft, so 0.5–0.75 looks the same and is fast). */
export function fit(canvas, cssW, cssH, dpr, scale) {
  const w = Math.max(1, Math.round(cssW * dpr * (scale || 1)));
  const h = Math.max(1, Math.round(cssH * dpr * (scale || 1)));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  return [w, h];
}

/** Smoothed pointer in 0..1 canvas space, read from window (canvases sit behind content). */
export function pointer(canvas) {
  const s = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, active: 0, ta: 0 };
  function onMove(e) {
    const r = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    if (!p || !r.width) return;
    const x = (p.clientX - r.left) / r.width, y = (p.clientY - r.top) / r.height;
    if (x < -0.1 || x > 1.1 || y < -0.1 || y > 1.1) { s.ta = 0; return; }
    s.tx = x; s.ty = y; s.ta = 1;
  }
  function onLeave() { s.ta = 0; }
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("touchmove", onMove, { passive: true });
  document.addEventListener("pointerleave", onLeave);
  s.update = function (dt) {
    const k = 1 - Math.exp(-dt * 4);
    s.x += (s.tx - s.x) * k; s.y += (s.ty - s.y) * k; s.active += (s.ta - s.active) * k;
  };
  s.destroy = function () {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("touchmove", onMove);
    document.removeEventListener("pointerleave", onLeave);
  };
  return s;
}

/** Standard full-screen-shader scene: compiles `fs`, feeds uRes/uTime/uMouse/uA/uB/uC/uBg
    and any extra uniforms from `extra(gl, u, t)`. */
export function shaderScene(canvas, opts, fs, cfg) {
  cfg = cfg || {};
  const gl = getGL(canvas);
  if (!gl) throw new Error("no webgl");
  const prog = program(gl, QUAD_VS, fs);
  const draw = quad(gl, prog);
  const pal = opts.palette;
  const A = hexToRgb(pal.a), B = hexToRgb(pal.b), C = hexToRgb(pal.c), BG = hexToRgb(pal.bg);
  const ptr = pointer(canvas);
  const scale = opts.phone ? (cfg.phoneScale || 0.5) : (cfg.scale || 0.75);
  let cssW = 1, cssH = 1, dpr = 1;
  const speed = opts.motion === "reduced" ? 0.25 : 1;

  function render(dt, t) {
    ptr.update(dt);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(prog.p);
    const u = prog.u;
    gl.uniform2f(u.uRes, canvas.width, canvas.height);
    gl.uniform1f(u.uTime, t * speed + (cfg.t0 || 0));
    if (u.uMouse) gl.uniform3f(u.uMouse, ptr.x, 1 - ptr.y, ptr.active);
    if (u.uA) gl.uniform3fv(u.uA, A);
    if (u.uB) gl.uniform3fv(u.uB, B);
    if (u.uC) gl.uniform3fv(u.uC, C);
    if (u.uBg) gl.uniform3fv(u.uBg, BG);
    if (cfg.extra) cfg.extra(gl, u, t * speed, dt, ptr);
    draw();
  }
  const lp = loop(render, opts.phone ? 40 : 0);
  return {
    start() { lp.start(); },
    stop() { lp.stop(); },
    still() { render(0.016, lp.time || 0); },
    resize(w, h, d) {
      cssW = w; cssH = h; dpr = d;
      fit(canvas, cssW, cssH, dpr, scale);
      if (!lp.running()) render(0.016, lp.time);
    },
    destroy() { lp.stop(); ptr.destroy(); const ext = gl.getExtension("WEBGL_lose_context"); ext && ext.loseContext(); },
  };
}
