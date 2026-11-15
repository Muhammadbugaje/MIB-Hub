/* Waves: an oscilloscope landscape. Rows of phosphor traces recede to the
   horizon; each row is the superposition of three phases (L1/L2/L3, 120° apart)
   plus travelling harmonics, so the terrain breathes like a power system.
   Nearer rows hide the ones behind them (hidden-line), which gives the depth.
   A scope graticule and a bright reference trace sit in the sky. */
import { shaderScene } from "../gl.js";

const FS = `precision highp float;
varying vec2 vUv;
uniform vec2 uRes; uniform float uTime; uniform vec3 uMouse;
uniform vec3 uA, uB, uC, uBg;
uniform float uRows;

float h(float x, float z, float t) {
  float k = 6.2831853;
  float a = sin(x * 2.3 * k * 0.5 + t * 1.1 + z * 4.0);
  float b = sin(x * 2.3 * k * 0.5 + t * 1.1 + z * 4.0 + 2.0944);
  float c = sin(x * 2.3 * k * 0.5 + t * 1.1 + z * 4.0 - 2.0944);
  float three = a * 0.55 + b * 0.3 + c * 0.15;
  float harm = sin(x * 7.1 - t * 1.7 + z * 9.0) * 0.22 + sin(x * 13.3 + t * 0.9 - z * 5.0) * 0.08;
  float ridge = exp(-pow((x - 0.35 - 0.25 * sin(t * 0.21)) * 1.4, 2.0));            // a mountain of energy mid-frame
  float m = exp(-pow((x - (uMouse.x - 0.5) * 2.6) * 2.4, 2.0)) * uMouse.z;   // pointer lifts the field
  return (three + harm) * (0.35 + 0.65 * ridge) + ridge * 0.9 + m * 0.9;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  float px = 1.0 / uRes.y;
  vec3 col = uBg;

  // sky: graticule + a reference trace
  vec2 g = vec2(uv.x * aspect, uv.y) * 10.0;
  vec2 gf = abs(fract(g) - 0.5);
  float grid = smoothstep(0.49, 0.5, max(gf.x, gf.y));
  float sky = smoothstep(0.45, 0.85, uv.y);
  col += mix(uA, uB, uv.x) * grid * 0.05 * sky;
  float env = smoothstep(0.3, 0.6, uv.x) * smoothstep(1.02, 0.8, uv.x);
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    float ty = 0.8 + 0.055 * sin(uv.x * 14.0 - uTime * 2.2 + fk * 2.0944);
    float td = abs(uv.y - ty);
    vec3 tc = k == 0 ? uA : (k == 1 ? uB : uC);
    col += tc * (exp(-td * td / (px * px * 2.0)) * 0.5 + exp(-td / (px * 14.0)) * 0.08) * env;
  }

  // terrain
  float rows = uRows;
  float occ = -1.0;
  vec3 acc = vec3(0.0);
  for (int j = 0; j < 64; j++) {
    float fj = float(j);
    if (fj >= rows) break;
    float z = fj / rows;                          // 0 near .. 1 far
    float persp = 1.0 / (1.0 + z * 2.6);
    float base = 0.56 - 0.66 * persp;            // screen baseline of the row
    float xw = (uv.x - 0.5) * aspect / persp * 0.55;
    float amp = 0.12 * persp;
    if (abs(uv.y - base) > amp * 3.2 + px * 24.0) continue;   // this row cannot reach the pixel
    float y = base + amp * h(xw, z, uTime);
    float d = uv.y - y;
    if (uv.y < occ - px * 0.5) continue;         // hidden behind a nearer row
    float fade = (1.0 - z) * (1.0 - z);
    float line = exp(-d * d / (px * px * 1.8)) + exp(-abs(d) / (px * 7.0)) * 0.18;
    vec3 c = mix(uA, uB, smoothstep(0.0, 0.9, z));
    c = mix(c, uC, smoothstep(0.75, 1.4, (y - base) / max(amp, 1e-4)) * 0.8);
    acc += c * line * (0.25 + 0.95 * fade);
    occ = max(occ, y);
  }
  col += acc;
  // glow on the horizon
  col += mix(uA, uB, 0.5) * exp(-abs(uv.y - 0.5) * 9.0) * 0.06;
  float vig = smoothstep(1.3, 0.3, length((uv - vec2(0.6, 0.45)) * vec2(1.2, 1.0)));
  col *= 0.5 + 0.5 * vig;
  col = 1.0 - exp(-col * 1.3);
  gl_FragColor = vec4(col, 1.0);
}`;

export function create(canvas, opts) {
  const rows = opts.phone ? 26 : 38;
  return shaderScene(canvas, opts, FS, {
    scale: 0.75, phoneScale: 0.6, t0: 4,
    extra(gl, u) { gl.uniform1f(u.uRows, rows); },
  });
}

export default create;
