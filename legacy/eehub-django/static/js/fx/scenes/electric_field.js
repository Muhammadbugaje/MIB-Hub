/* Electric field: glowing field lines between drifting point charges.
   Field lines of 2-D point charges are level sets of the stream function
   psi = sum(q_i * angle_i); with integer charges and an integer number of
   lines the 2*pi jumps of atan cancel, so the pattern is seamless. Pulses
   flow along the lines from + to - (driven by the potential), equipotentials
   are drawn faintly, and the pointer is an extra test charge. */
import { shaderScene } from "../gl.js";

const N = 6;

const FS = `precision highp float;
varying vec2 vUv;
uniform vec2 uRes; uniform float uTime; uniform vec3 uMouse;
uniform vec3 uA, uB, uC, uBg;
uniform vec3 uQ[${N + 1}];
const float K = 18.0;           // field lines per unit charge
const float TAU = 6.2831853;

void main(){
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float psi = 0.0, phi = 0.0;
  vec2 g = vec2(0.0);
  float near = 0.0, glowPos = 0.0, glowNeg = 0.0;
  for (int i = 0; i < ${N + 1}; i++) {
    vec3 c = uQ[i];
    if (c.z == 0.0) continue;
    vec2 d = p - c.xy;
    float r2 = dot(d, d) + 1e-5;
    psi += c.z * atan(d.y, d.x);
    phi += c.z * 0.5 * log(r2);
    g += c.z * vec2(-d.y, d.x) / r2;
    float h = 0.0009 / r2;
    if (c.z > 0.0) glowPos += h; else glowNeg += h;
    near = max(near, exp(-sqrt(r2) * 9.0));
  }
  float px = 1.0 / uRes.y;
  float gm = length(g) + 1e-4;

  // field lines: distance (in screen units) to the nearest level set of psi
  float v = psi * K / TAU;
  float dLine = abs(fract(v + 0.5) - 0.5) / (gm * K / TAU);
  float w = px * 1.15;
  float line = exp(-dLine * dLine / (w * w)) * 0.9 + exp(-dLine / (px * 9.0)) * 0.22;
  // fade very dense bundles near the charges so they do not burn out
  line *= smoothstep(1400.0, 60.0, gm);

  // pulses travelling along the lines (+ -> -): a moving band in the potential
  float flow = fract(phi * 1.6 - uTime * 0.55);
  float pulse = smoothstep(0.0, 0.06, flow) * smoothstep(0.32, 0.06, flow);

  // faint equipotentials
  float e = phi * 2.2;
  float dEq = abs(fract(e + 0.5) - 0.5) / (gm * 2.2);
  float eq = exp(-dEq * dEq / (w * w * 1.6)) * 0.13;

  float side = clamp(0.5 + 0.5 * (-phi * 0.9) / sqrt(1.0 + phi * phi * 0.81), 0.0, 1.0);   // + side -> a, - side -> b
  vec3 hue = mix(uB, uA, side);

  vec3 col = uBg;
  // dotted engineering grid
  vec2 gp = fract(gl_FragCoord.xy / (uRes.y * 0.045)) - 0.5;
  col += 0.035 * smoothstep(0.08, 0.0, length(gp)) * mix(uA, uB, vUv.x);
  col += hue * line * (0.32 + 1.2 * pulse);
  col += mix(uC, hue, 0.5) * eq;
  col += uA * min(glowPos, 3.0) * 0.55 + uB * min(glowNeg, 3.0) * 0.55;
  col += vec3(1.0) * near * 0.35;
  // soft vignette keeps the copy readable on the left
  float vig = smoothstep(1.25, 0.25, length((vUv - vec2(0.62, 0.5)) * vec2(1.3, 1.0)));
  col *= 0.42 + 0.58 * vig;
  col = 1.0 - exp(-col * 1.25);
  gl_FragColor = vec4(col, 1.0);
}`;

export function create(canvas, opts) {
  const q = new Float32Array((N + 1) * 3);
  const charges = [];
  for (let i = 0; i < N; i++) {
    charges.push({
      q: i % 2 === 0 ? 1 : -1,
      ax: 0.25 + 0.5 * ((i * 0.618) % 1), ay: 0.14 + 0.18 * ((i * 0.37) % 1),
      fx: 0.07 + 0.045 * i, fy: 0.11 + 0.03 * ((i * 7) % 5), ph: i * 1.7,
      cx: ((i / (N - 1)) - 0.5) * 1.1 + 0.18, cy: (i % 3 - 1) * 0.16,
    });
  }
  return shaderScene(canvas, opts, FS, {
    scale: 0.8, phoneScale: 0.6, t0: 3,
    extra(gl, u, t, dt, ptr) {
      const aspect = canvas.width / Math.max(1, canvas.height);
      const sx = Math.min(1, aspect / 1.6);
      charges.forEach((c, i) => {
        q[i * 3] = (c.cx + Math.sin(t * c.fx + c.ph) * c.ax * 0.5) * sx * (aspect > 1 ? 1 : 0.9);
        q[i * 3 + 1] = c.cy + Math.cos(t * c.fy + c.ph * 1.3) * c.ay;
        q[i * 3 + 2] = c.q;
      });
      // the pointer: a positive test charge while it is over the scene
      const on = ptr.active > 0.35;
      q[N * 3] = (ptr.x - 0.5) * aspect; q[N * 3 + 1] = 0.5 - ptr.y; q[N * 3 + 2] = on ? 1 : 0;
      gl.uniform3fv(u.uQ, q);
    },
  });
}

export default create;
