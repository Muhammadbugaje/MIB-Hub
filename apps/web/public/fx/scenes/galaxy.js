/* Galaxy: a spiral-arm particle galaxy (WebGL points, additive light).
   Stars are placed along logarithmic arms with a gaussian spread, a dense
   bulge and a sprinkle of bright star-forming knots; the vertex shader turns
   them differentially (inner stars faster), the camera drifts and tilts. */
import { getGL, program, hexToRgb, loop, fit, pointer } from "../gl.js";

const VS = `precision highp float;
attribute vec4 aStar;   // radius, angle, height, size
attribute vec2 aTone;   // colour mix, twinkle seed
uniform float uTime, uScale, uAspect, uTilt, uYaw;
uniform vec2 uShift;
uniform vec3 uA, uB, uC;
varying vec3 vCol; varying float vA;
void main(){
  float r = aStar.x;
  float th = aStar.y - uTime * 0.16 / (0.18 + r) + uYaw;
  vec3 p = vec3(cos(th) * r, aStar.z, sin(th) * r);
  // tilt the disc toward the camera
  float ct = cos(uTilt), st = sin(uTilt);
  p = vec3(p.x, p.y * ct - p.z * st, p.y * st + p.z * ct);
  float z = 3.1 - p.z;
  vec2 s = p.xy / z * 2.05;
  s.x /= uAspect;
  gl_Position = vec4(s + uShift, 0.0, 1.0);
  float tw = 0.75 + 0.25 * sin(uTime * (1.5 + aTone.y * 3.0) + aTone.y * 40.0);
  gl_PointSize = max(1.0, aStar.w * uScale / z);
  bool gas = aTone.x > 1.05 && aTone.x < 1.5;
  vec3 c = aTone.x < 0.0 ? mix(vec3(1.0, 0.95, 0.85), uA, 0.35)
         : (aTone.x > 1.5 ? uC : (gas ? mix(uB, uC, (aTone.x - 1.05) * 2.2) : mix(uA, uB, aTone.x)));
  vCol = c;
  vA = (gas ? 0.05 : tw * (aTone.x < 0.0 ? 0.7 : (aTone.x > 1.5 ? 1.0 : 0.85))) * smoothstep(1.35, 0.9, r);
}`;

const FS = `precision mediump float;
varying vec3 vCol; varying float vA;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.0, d);
  a *= a;
  gl_FragColor = vec4(vCol * a * vA, 1.0);
}`;

const BG_FS = `precision mediump float;
varying vec2 vUv; uniform vec3 uBg, uA, uB; uniform vec2 uShift; uniform float uAspect;
void main(){
  vec2 p = (vUv * 2.0 - 1.0 - uShift) * vec2(uAspect, 1.0);
  float g = exp(-dot(p, p) * 2.2);
  vec3 col = uBg + mix(uB, uA, g) * g * 0.16;
  gl_FragColor = vec4(col, 1.0);
}`;
const BG_VS = `attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

function mulberry(a) {
  return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function gauss(r) { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2831853 * r()); }

export function create(canvas, opts) {
  const gl = getGL(canvas);
  if (!gl) throw new Error("no webgl");
  const N = opts.phone ? 26000 : 70000;
  const ARMS = 4;
  const rng = mulberry(20261022);
  const star = new Float32Array(N * 4), tone = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const kind = rng();
    let r, ang, h, size, mix;
    if (kind < 0.16) {                       // bulge
      r = Math.abs(gauss(rng)) * 0.16;
      ang = rng() * 6.2831853; h = gauss(rng) * 0.06 * (1 - r * 3); size = 1.2 + rng() * 2.2; mix = -1;
    } else {
      r = Math.pow(rng(), 0.72) * 1.25 + 0.05;
      const arm = Math.floor(rng() * ARMS);
      const spread = gauss(rng) * (0.1 + 0.32 * r) * 0.55;
      ang = arm * (6.2831853 / ARMS) + Math.log(r + 0.05) * 2.4 + spread / Math.max(r, 0.12);
      h = gauss(rng) * 0.025;
      size = 1.1 + Math.pow(rng(), 3) * 3.4;
      mix = Math.max(0, Math.min(1, Math.pow(r / 1.15, 1.5) + gauss(rng) * 0.12));
      if (rng() < 0.012) { mix = 2; size *= 2.2; }         // bright star-forming knots
      else if (rng() < 0.05) { mix = 1.06 + rng() * 0.4; size = 26 + rng() * 50; h *= 3; }   // glowing gas along the arms
    }
    star.set([r, ang, h, size], i * 4);
    tone.set([mix, rng()], i * 2);
  }
  const prog = program(gl, VS, FS);
  const bg = program(gl, BG_VS, BG_FS);
  const bufS = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bufS); gl.bufferData(gl.ARRAY_BUFFER, star, gl.STATIC_DRAW);
  const bufT = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bufT); gl.bufferData(gl.ARRAY_BUFFER, tone, gl.STATIC_DRAW);
  const quadBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const locS = gl.getAttribLocation(prog.p, "aStar"), locT = gl.getAttribLocation(prog.p, "aTone"), locQ = gl.getAttribLocation(bg.p, "aPos");
  const pal = opts.palette, A = hexToRgb(pal.a), B = hexToRgb(pal.b), C = hexToRgb(pal.c), BG = hexToRgb(pal.bg);
  const ptr = pointer(canvas);
  const speed = opts.motion === "reduced" ? 0.3 : 1;
  let dpr = 1;

  function render(dt, t) {
    ptr.update(dt);
    const w = canvas.width, h = canvas.height, aspect = w / h;
    const shift = aspect > 1.2 ? [Math.min(0.42, (aspect - 1) * 0.55), 0.0] : [0, aspect < 0.8 ? 0.42 : 0.18];
    gl.viewport(0, 0, w, h);
    gl.disable(gl.BLEND);
    gl.useProgram(bg.p);
    gl.uniform3fv(bg.u.uBg, BG); gl.uniform3fv(bg.u.uA, A); gl.uniform3fv(bg.u.uB, B);
    gl.uniform2fv(bg.u.uShift, shift); gl.uniform1f(bg.u.uAspect, aspect);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf); gl.enableVertexAttribArray(locQ); gl.vertexAttribPointer(locQ, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.disableVertexAttribArray(locQ);

    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(prog.p);
    const u = prog.u;
    const tt = t * speed + 6;
    gl.uniform1f(u.uTime, tt);
    gl.uniform1f(u.uScale, h * 0.0042 * (aspect < 1 ? 1.25 : 1));
    gl.uniform1f(u.uAspect, aspect < 1 ? aspect * 1.35 : aspect);
    gl.uniform1f(u.uTilt, 0.62 + 0.06 * Math.sin(tt * 0.07) + (ptr.y - 0.5) * 0.25 * ptr.active);
    gl.uniform1f(u.uYaw, (ptr.x - 0.5) * 0.6 * ptr.active);
    gl.uniform2fv(u.uShift, shift);
    gl.uniform3fv(u.uA, A); gl.uniform3fv(u.uB, B); gl.uniform3fv(u.uC, C);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufS); gl.enableVertexAttribArray(locS); gl.vertexAttribPointer(locS, 4, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufT); gl.enableVertexAttribArray(locT); gl.vertexAttribPointer(locT, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, N);
    gl.disableVertexAttribArray(locS); gl.disableVertexAttribArray(locT);
  }
  const lp = loop(render, opts.phone ? 40 : 0);
  return {
    start() { lp.start(); },
    stop() { lp.stop(); },
    resize(cssW, cssH, d) { dpr = d; fit(canvas, cssW, cssH, dpr, opts.phone ? 0.9 : 1); if (!lp.running()) render(0.016, lp.time); },
    destroy() { lp.stop(); ptr.destroy(); const e = gl.getExtension("WEBGL_lose_context"); if (e) e.loseContext(); },
  };
}

export default create;
