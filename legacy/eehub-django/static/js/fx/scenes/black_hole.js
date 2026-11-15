/* Black hole: a ray-marched Schwarzschild lens with a thin accretion disk.
   Each pixel's light ray is bent with the photon-orbit equation
   (a = -1.5 h^2 r / |r|^5), so the far side of the disk is lifted over and
   under the shadow and a thin photon ring appears. The disk turns
   differentially and the approaching side is Doppler-brightened. The hole sits
   to the right on wide screens so the hero copy stays readable. */
import { shaderScene } from "../gl.js";

const FS = `precision highp float;
varying vec2 vUv;
uniform vec2 uRes; uniform float uTime; uniform vec3 uMouse;
uniform vec3 uA, uB, uC, uBg;
uniform float uSteps;

float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  float a = hash(vec3(i, 1.0)), b = hash(vec3(i + vec2(1,0), 1.0)), c = hash(vec3(i + vec2(0,1), 1.0)), d = hash(vec3(i + vec2(1,1), 1.0));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y); }

vec3 stars(vec3 d){
  vec3 col = vec3(0.0);
  for (int k = 0; k < 2; k++) {
    float s = k == 0 ? 90.0 : 190.0;
    vec3 c = floor(d * s);
    float h = hash(c + float(k) * 13.1);
    if (h > 0.9965) {
      vec3 f = fract(d * s) - 0.5;
      float b = smoothstep(0.32, 0.0, length(f)) * (h - 0.9965) * 285.0;
      col += b * mix(vec3(1.0), uB, hash(c * 1.7));
    }
  }
  // faint nebula
  float n = noise(d.xy * 3.0 + d.z) * noise(d.yz * 5.0 - 2.0);
  col += mix(uC, uB, d.y * 0.5 + 0.5) * n * 0.06;
  return col;
}

void main(){
  float aspect = uRes.x / uRes.y;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  // keep the hole right of the copy on wide screens, centred on tall ones
  float shift = aspect > 1.2 ? min(0.46, (aspect - 1.0) * 0.55) : 0.0;
  p.x -= shift;
  p.y -= aspect > 1.2 ? 0.0 : (aspect < 0.8 ? 0.3 : 0.12);
  p += (uMouse.xy - 0.5) * 0.04 * uMouse.z;

  float camA = uTime * 0.035 + 0.6;
  float tilt = 0.16 + 0.04 * sin(uTime * 0.05);
  vec3 ro = vec3(sin(camA), 0.0, cos(camA)) * 34.0 + vec3(0.0, 34.0 * tilt, 0.0);
  vec3 fw = normalize(-ro);
  vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw));
  vec3 up = cross(fw, rt);
  float zoom = aspect > 1.2 ? 1.05 : 1.0;
  vec3 rd = normalize(fw * zoom * 1.6 + rt * p.x + up * p.y);

  vec3 pos = ro, dir = rd;
  vec3 h3 = cross(pos, dir);
  float h2 = dot(h3, h3);
  vec3 col = vec3(0.0);
  float alpha = 0.0;
  bool hole = false;
  float steps = uSteps;
  for (int i = 0; i < 140; i++) {
    if (float(i) >= steps) break;
    float r = length(pos);
    float dt = clamp(r * 0.09, 0.05, 1.6);
    vec3 prev = pos;
    vec3 acc = -1.5 * h2 * pos / pow(r, 5.0);
    dir += acc * dt;
    pos += dir * dt;
    float rn = length(pos);
    if (rn < 1.0) { hole = true; break; }
    // crossed the disk plane?
    if (prev.y * pos.y < 0.0) {
      float t = prev.y / (prev.y - pos.y);
      vec3 x = mix(prev, pos, t);
      float rr = length(x.xz);
      if (rr > 2.4 && rr < 10.5) {
        float ang = atan(x.z, x.x);
        float omega = 1.2 / pow(rr, 1.5);
        float swirl = ang + uTime * omega * 6.0;
        float bands = 0.55 + 0.45 * noise(vec2(rr * 2.6, swirl * 3.0)) * (0.6 + 0.4 * sin(rr * 7.0 + swirl * 2.0));
        float inner = smoothstep(2.4, 3.1, rr), outer = smoothstep(10.5, 6.0, rr);
        float temp = clamp((rr - 2.4) / 8.0, 0.0, 1.0);
        vec3 dc = mix(vec3(1.0, 0.96, 0.86), uA, smoothstep(0.0, 0.35, temp));
        dc = mix(dc, uC * 0.9, smoothstep(0.45, 1.0, temp));
        vec3 vel = normalize(vec3(-x.z, 0.0, x.x));
        float dop = 1.0 + 0.75 * dot(vel, -normalize(dir));
        float I = inner * outer * bands * dop * dop * (1.6 - temp) * 0.6;
        float a = clamp(I * 0.85, 0.0, 1.0) * (1.0 - alpha);
        col += dc * I * (1.0 - alpha);
        alpha += a;
        if (alpha > 0.98) break;
      }
    }
    if (rn > 60.0) break;
  }
  if (!hole) col += stars(normalize(dir)) * (1.0 - alpha);
  // photon-ring glow and a soft halo
  col += uBg;
  col = 1.0 - exp(-col * 1.15);
  float vig = smoothstep(1.4, 0.35, length(vUv - 0.5) * 1.4);
  col *= 0.55 + 0.45 * vig;
  gl_FragColor = vec4(col, 1.0);
}`;

export function create(canvas, opts) {
  const steps = opts.phone ? 80 : 120;
  return shaderScene(canvas, opts, FS, {
    scale: 0.6, phoneScale: 0.45, t0: 10,
    extra(gl, u) { gl.uniform1f(u.uSteps, steps); },
  });
}

export default create;
