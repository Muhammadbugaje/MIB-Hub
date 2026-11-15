/* FSLG visual prototype — throwaway spike. Babylon.js 7.54.0, CC0 assets only (see CREDITS.md).
   index.html?s=A|B|C|D&w=1280&h=720[&v=tall]  — window.__ready flips true when assets loaded + frames rendered.
   Rendering is driven by timers (requestAnimationFrame never fires in an offscreen WKWebView). */
'use strict';
const Q = new URLSearchParams(location.search);
const SC = Q.get('s') || 'A', W = +Q.get('w') || 1280, H = +Q.get('h') || 720, VIEW = Q.get('v') || '';
const NIGHT = SC === 'C';
const canvas = document.getElementById('c');
canvas.width = W; canvas.height = H; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, antialias: true }, false);
engine.setHardwareScalingLevel(1);
const scene = new BABYLON.Scene(engine);
const V3 = BABYLON.Vector3, C3 = BABYLON.Color3;
const INFO = window.__info = { scene: SC, webgl: engine.webGLVersion, notes: [] };
const note = s => { INFO.notes.push(s); console.log(s); };

/* ---------- materials ---------- */
const MATS = [];
function texMat(name, tile, o = {}) {
  const m = new BABYLON.PBRMaterial(name + (o.tag || ''), scene);
  const T = f => { const t = new BABYLON.Texture('assets/tex/' + name + '/' + f + '.jpg', scene); t.uScale = t.vScale = 1 / tile; return t; };
  m.albedoTexture = T('diff'); m.bumpTexture = T('nor'); m.metallicTexture = T('arm');
  m.useAmbientOcclusionFromMetallicTextureRed = true; m.useRoughnessFromMetallicTextureGreen = true; m.useMetallnessFromMetallicTextureBlue = true;
  m.metallic = o.metal == null ? 1 : o.metal; m.roughness = o.rough || 1;
  m.bumpTexture.level = o.bump || 1;
  if (o.tint) m.albedoColor = o.tint;
  MATS.push(m); return m;
}
function flat(name, col, rough = 0.8, metal = 0) {
  const m = new BABYLON.PBRMaterial(name, scene); m.albedoColor = col; m.roughness = rough; m.metallic = metal; MATS.push(m); return m;
}
/* world-space box-projected UVs so textures keep real-world scale on every box */
function wuv(m) {
  m.computeWorldMatrix(true);
  const p = m.getVerticesData('position'), n = m.getVerticesData('normal'), wm = m.getWorldMatrix(), uv = [];
  for (let i = 0; i < p.length / 3; i++) {
    const w = V3.TransformCoordinates(new V3(p[3 * i], p[3 * i + 1], p[3 * i + 2]), wm);
    const ax = Math.abs(n[3 * i]), ay = Math.abs(n[3 * i + 1]), az = Math.abs(n[3 * i + 2]);
    if (ay >= ax && ay >= az) uv.push(w.x, w.z); else if (ax >= az) uv.push(w.z, w.y); else uv.push(w.x, w.y);
  }
  m.setVerticesData('uv', uv); return m;
}
const STATIC = [];  // meshes merged per material at the end
function box(name, x0, y0, z0, x1, y1, z1, mat, merge = true) {
  const b = BABYLON.MeshBuilder.CreateBox(name, { width: x1 - x0, height: y1 - y0, depth: z1 - z0 }, scene);
  b.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); b.material = mat; wuv(b);
  if (merge) STATIC.push(b); return b;
}
function mergeStatic() {
  const by = new Map();
  STATIC.forEach(m => { if (!by.has(m.material)) by.set(m.material, []); by.get(m.material).push(m); });
  const out = [];
  by.forEach((list, mat) => { const mm = BABYLON.Mesh.MergeMeshes(list, true, true); if (mm) { mm.material = mat; out.push(mm); } });
  return out;
}

/* ---------- loading helpers ---------- */
const load = (dir, file) => BABYLON.SceneLoader.LoadAssetContainerAsync(dir, file, scene);
/* cartoon characters: Quaternius "Ultimate Animated Character Pack" (CC0). Flat colour materials
   (Skin, Shirt, Pants, Hair, Face = white eye shapes) are recoloured per person; pupils are added on the head bone. */
const C2 = {}; let CHN = 0; const PEOPLE = [];
const SKIN = { light: new C3(0.93, 0.72, 0.58), tan: new C3(0.74, 0.5, 0.33), medium: new C3(0.55, 0.34, 0.2), brown: new C3(0.4, 0.23, 0.13), dark: new C3(0.27, 0.15, 0.09), deep: new C3(0.18, 0.1, 0.06) };
async function person(o) {
  if (!C2[o.type]) C2[o.type] = await load('assets/chars2/', o.type + '.gltf');
  const id = 'p' + (CHN++);
  const inst = C2[o.type].instantiateModelsToScene(n => n + '_' + id, true, { doNotInstantiate: true });
  const root = inst.rootNodes[0]; root.computeWorldMatrix(true);
  const meshes = root.getChildMeshes(false); meshes.forEach(m => m.computeWorldMatrix(true));
  const head = root.getDescendants(false).find(n => n.name === 'Head_' + id);
  const bb = root.getHierarchyBoundingVectors(true); const h0 = bb.max.y - bb.min.y;
  const base = n => n.replace(/_p\d+$/, '').replace(/\.\d+$/, '');
  const col = { Skin: SKIN[o.skin] || o.skin, Face: new C3(0.98, 0.97, 0.94), Shirt: o.shirt, Main: o.shirt, Pants: o.pants, Black: o.pants, Hair: o.hair || new C3(0.06, 0.045, 0.04), Belt: o.belt || new C3(0.12, 0.08, 0.05), Vest: o.vest, Details: o.detail, Detail: o.detail, Hat: o.hat };
  let face = null;
  meshes.forEach(m => { m.receiveShadows = true; const mt = m.material; if (!mt) return; const b = base(mt.name);
    if (col[b]) mt.albedoColor = col[b].toLinearSpace(); mt.metallic = 0; mt.roughness = b === 'Face' ? 0.3 : (b === 'Skin' ? 0.55 : 0.75); mt.maxSimultaneousLights = 12; if (b === 'Face') face = m; });
  // pupils + catchlights, built in rest pose then parented to the head bone
  if (face && head) {
    const raw = face.getPositionData(true, true); const wm = face.getWorldMatrix(); const all = [];
    for (let i = 0; i < raw.length; i += 3) { const v = V3.TransformCoordinates(new V3(raw[i], raw[i + 1], raw[i + 2]), wm); all.push([v.x, v.y, v.z]); }
    const ys = all.map(v => v[1]).sort((a, b) => a - b), ymid = (ys[0] + ys[ys.length - 1]) / 2;
    const cx0 = all.reduce((a, v) => a + v[0], 0) / all.length; const cl = [[], []];
    const br = [[], []]; all.forEach(v => { (v[1] < ymid ? cl : br)[v[0] > cx0 ? 0 : 1].push(v); });
    const bm = flat('brow' + id, (o.hair || new C3(0.06, 0.045, 0.04)).toLinearSpace().scale(0.6), 0.8);
    br.forEach(c => { if (!c.length) return; const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; c.forEach(v => { for (let j = 0; j < 3; j++) { mn[j] = Math.min(mn[j], v[j]); mx[j] = Math.max(mx[j], v[j]); } });
      const b = BABYLON.MeshBuilder.CreateBox('brow', { width: (mx[0] - mn[0]) * 1.05, height: (mx[1] - mn[1]) * 0.5, depth: Math.max(0.004, (mx[2] - mn[2]) + 0.004) }, scene);
      b.position = new V3((mn[0] + mx[0]) / 2, mx[1] - (mx[1] - mn[1]) * 0.2, (mn[2] + mx[2]) / 2); b.material = bm; head.computeWorldMatrix(true); b.setParent(head); meshes.push(b); });
    const zf = all.reduce((a, v) => Math.min(a, v[2]), 1e9), zb = all.reduce((a, v) => Math.max(a, v[2]), -1e9);
    const front = Math.abs(zf) > Math.abs(zb) ? -1 : 1;  // which world-z side the face points to
    const pm = flat('pupil' + id, new C3(0.02, 0.015, 0.012), 0.2), hm = flat('glint' + id, C3.White(), 0.1); hm.emissiveColor = new C3(0.6, 0.6, 0.6);
    head.computeWorldMatrix(true);
    cl.forEach((c, k) => { if (!c.length) return;
      const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; c.forEach(v => { for (let j = 0; j < 3; j++) { mn[j] = Math.min(mn[j], v[j]); mx[j] = Math.max(mx[j], v[j]); } });
      const r = 0.42 * (mx[0] - mn[0]); const cx = (mn[0] + mx[0]) / 2, cy = (mn[1] + mx[1]) / 2;
      const zs = front > 0 ? mx[2] : mn[2];
      const pu = BABYLON.MeshBuilder.CreateSphere('pupil', { diameter: 2 * r, segments: 12 }, scene); pu.material = pm; pu.position = new V3(cx, cy, zs - front * r * 0.45); pu.scaling.z = 0.7; pu.setParent(head); meshes.push(pu);
      const gl = BABYLON.MeshBuilder.CreateSphere('glint', { diameter: 0.55 * r, segments: 8 }, scene); gl.material = hm; gl.position = new V3(cx + r * 0.3, cy + r * 0.35, zs + front * r * 0.25); gl.setParent(head); meshes.push(gl);
    });
  }
  const sc = (o.h || 1.62) / h0, w = o.w || 1;
  root.rotationQuaternion = null; root.rotation.y = o.rot || 0; root.scaling.set(-sc * w, sc, sc * w);
  root.position.set(o.pos[0], o.y || 0, o.pos[1]);
  inst.animationGroups.forEach(a => a.stop());
  const ag = inst.animationGroups.find(a => base(a.name) === (o.anim || 'Idle')) || inst.animationGroups[0];
  ag.start(true); ag.pause();
  const P = { o, root, meshes, ag, p0: root.position.clone(),
    at(t) { const L = ag.to - ag.from; let f = (o.frame || 0) * L + t * 60 * (o.animRate || 1); f = o.hold ? Math.min(L, f) : f % L; ag.goToFrame(ag.from + f);
      if (o.speed) { const th = o.rot || 0; root.position.set(P.p0.x + Math.sin(th) * o.speed * t, P.p0.y, P.p0.z + Math.cos(th) * o.speed * t); } } };
  P.at(0); PEOPLE.push(P); caster(meshes);
  return P;
}
const setTime = t => PEOPLE.forEach(p => p.at(t));

async function model(name, opts = {}) {
  const c = await load('assets/models/' + name + '/', name + '.gltf');
  c.materials.forEach(m => { m.maxSimultaneousLights = 8; });
  return c;
}
function place(cont, pos, rot = 0, scale = 1, id = '') {
  const inst = cont.instantiateModelsToScene(n => n + id, false, { doNotInstantiate: true });  // clones share geometry; instances of off-scene sources cast no shadow
  const r = inst.rootNodes[0]; r.position = pos; r.rotationQuaternion = null; r.rotation.y = rot; r.scaling.x = -scale; r.scaling.y = scale; r.scaling.z = scale;
  const ms = r.getChildMeshes(false); ms.forEach(m => { m.receiveShadows = true; }); return { r, ms };
}

/* ---------- environment / lighting ---------- */
let SUN, SG, CAM, PIPE;
const CASTERS = [];
function caster(ms) { (Array.isArray(ms) ? ms : [ms]).forEach(m => { if (m.getTotalVertices && m.getTotalVertices() > 0) CASTERS.push(m); }); }

function sky(file, rotY, envLevel, skyLevel) {
  const hdr = new BABYLON.HDRCubeTexture('assets/hdri/' + file, scene, 256, false, true, false, true);
  hdr.rotationY = rotY; hdr.level = envLevel; scene.environmentTexture = hdr;
  const sb = BABYLON.MeshBuilder.CreateBox('sky', { size: 2000, sideOrientation: BABYLON.Mesh.BACKSIDE }, scene);
  const sm = new BABYLON.PBRMaterial('skyM', scene); const st = new BABYLON.HDRCubeTexture('assets/hdri/' + file, scene, 1024, false, false, false, false);
  st.rotationY = rotY; st.level = skyLevel; st.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;
  sm.reflectionTexture = st; sm.microSurface = 1; sm.disableLighting = true; sm.albedoColor = C3.Black(); sm.twoSidedLighting = true; if (!NIGHT && SC !== 'D') sm.reflectionColor = new C3(1.2, 0.93, 0.66);
  sb.material = sm; sb.infiniteDistance = true; sb.applyFog = false; sb.isPickable = false;
  return { hdr, sb, st };
}
function sunLight(dir, col, inten) {
  SUN = new BABYLON.DirectionalLight('sun', dir.normalize(), scene); SUN.diffuse = col; SUN.specular = col; SUN.intensity = inten;
  SUN.position = dir.scale(-120).add(new V3(5, 0, 2));
  return SUN;
}
function shadows(light, opts = {}) {
  let sg;
  if (engine.webGLVersion >= 2 && Q.get('csm') === '1') {
    sg = new BABYLON.CascadedShadowGenerator(opts.size || 2048, light);
    sg.numCascades = 4; sg.lambda = 0.82; sg.shadowMaxZ = opts.maxZ || 90; sg.stabilizeCascades = false; sg.autoCalcDepthBounds = false;
    sg.cascadeBlendPercentage = 0.1; sg.depthClamp = true;
    sg.filter = opts.pcss ? BABYLON.ShadowGenerator.FILTER_PCSS : BABYLON.ShadowGenerator.FILTER_PCF;
    sg.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;
    if (opts.pcss) { sg.contactHardeningLightSizeUVRatio = opts.light || 0.06; }
    note('shadows: CascadedShadowGenerator ' + (opts.pcss ? 'PCSS (contact hardening)' : 'PCF') + ' ' + (opts.size || 2048));
  } else {
    sg = new BABYLON.ShadowGenerator(+Q.get('shs') || opts.size2 || 4096, light);
    if (opts.pcss && Q.get('sh') !== 'pcf') { sg.useContactHardeningShadow = true; sg.contactHardeningLightSizeUVRatio = opts.light || 0.02; } else if (Q.get('sh') === 'poisson') sg.usePoissonSampling = true; else if (Q.get('sh') === 'blur') { sg.useBlurExponentialShadowMap = true; sg.blurKernel = 16; } else if (Q.get('sh') === 'plain') {} else sg.usePercentageCloserFiltering = true;
    sg.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;
    if (Q.get('auto') !== '1') { light.autoUpdateExtends = false; light.shadowMinZ = 1; light.shadowMaxZ = 260;
    const r = opts.range || [-45, 45, -30, 30]; light.orthoLeft = r[0]; light.orthoRight = r[1]; light.orthoBottom = r[2]; light.orthoTop = r[3]; }
    note('shadows: ShadowGenerator ' + (opts.pcss ? 'PCSS contact-hardening' : 'PCF') + ' ' + (opts.size2 || 4096));
  }
  sg.bias = opts.bias || 0.004; sg.normalBias = opts.nbias || 0.02; sg.darkness = opts.dark || 0;
  if (Q.get('tsh')) { sg.transparencyShadow = true; sg.enableSoftTransparentShadow = true; }
  return sg;
}
function postFX(cam, o = {}) {
  let ssao = null;
  if (o.ssao !== false && BABYLON.SSAO2RenderingPipeline.IsSupported) {
    try {
      ssao = new BABYLON.SSAO2RenderingPipeline('ssao', scene, { ssaoRatio: 0.75, blurRatio: 1 }, [cam], true);
      ssao.radius = o.aoRadius || 1.2; ssao.totalStrength = o.ao || 1.1; ssao.samples = 16; ssao.maxZ = o.aoMaxZ || 120; ssao.base = 0.12; ssao.expensiveBlur = true; ssao.minZAspect = 0.5;
      note('SSAO2 on');
    } catch (e) { note('SSAO2 failed: ' + e.message); }
  } else note('SSAO2 not supported here');
  const p = new BABYLON.DefaultRenderingPipeline('pipe', true, scene, [cam]);
  p.samples = engine.webGLVersion >= 2 ? 4 : 1;
  p.fxaaEnabled = true;
  p.imageProcessingEnabled = true;
  const ip = p.imageProcessing;
  ip.toneMappingEnabled = true; ip.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
  ip.exposure = o.exposure || 1.0; ip.contrast = o.contrast || 1.15;
  ip.vignetteEnabled = true; ip.vignetteWeight = o.vig || 2.2; ip.vignetteStretch = 0.4; ip.vignetteColor = new BABYLON.Color4(0.05, 0.02, 0, 0); ip.vignetteCameraFov = cam.fov;
  if (o.curves) { const cc = new BABYLON.ColorCurves(); Object.assign(cc, o.curves); ip.colorCurvesEnabled = true; ip.colorCurves = cc; }
  p.bloomEnabled = true; p.bloomThreshold = o.bloomT || 0.85; p.bloomWeight = o.bloomW || 0.25; p.bloomKernel = 64; p.bloomScale = 0.5;
  p.grainEnabled = true; p.grain.intensity = 5; p.grain.animated = false;
  if (o.dof) { p.depthOfFieldEnabled = true; p.depthOfFieldBlurLevel = BABYLON.DepthOfFieldEffectBlurLevel.High; Object.assign(p.depthOfField, o.dof); note('DoF on'); }
  if (o.sharpen) { p.sharpenEnabled = true; p.sharpen.edgeAmount = o.sharpen; }
  PIPE = p; return p;
}
function camera(pos, tgt, fov) {
  const c = new BABYLON.UniversalCamera('cam', pos, scene); c.setTarget(tgt); c.fov = fov; c.minZ = 0.1; c.maxZ = 2500;
  CAM = c; scene.activeCamera = c; return c;
}

/* ---------- the faculty street (scenes A, B, C) ---------- */
async function campus() {
  const M = {
    plaster: texMat('painted_plaster_wall', 2.2, { tint: new C3(1.0, 0.93, 0.80), bump: 0.6 }),
    plasterG: texMat('painted_plaster_wall', 2.2, { tint: new C3(0.42, 0.55, 0.42), bump: 0.6, tag: 'g' }),   // painted green dado
    conc: texMat('concrete_wall_008', 3, { tint: new C3(0.95, 0.9, 0.82) }),
    floor: texMat('concrete_floor_worn_001', 2.5, { tint: new C3(0.9, 0.82, 0.74) }),
    frame: flat('frame', new C3(0.18, 0.11, 0.07), 0.5),
    glass: flat('glass', new C3(0.03, 0.045, 0.05), 0.04),
    dark: flat('inside', new C3(0.02, 0.018, 0.016), 0.9),
    door: flat('door', new C3(0.25, 0.14, 0.07), 0.55),
    rust: texMat('rusty_corrugated_iron', 1.5, { metal: 1 }),
    kiosk: texMat('painted_plaster_wall', 1.6, { tint: new C3(0.25, 0.55, 0.68), tag: 'k' }),
    tank: flat('tank', new C3(0.03, 0.03, 0.035), 0.35),
    post: flat('post', new C3(0.35, 0.35, 0.36), 0.5, 0.8)
  };
  M.glass.environmentIntensity = 1.3;
  /* ground: red laterite everywhere, compacted path + dry grass verges with soft edges */
  const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 700, height: 700, subdivisions: 4 }, scene);
  ground.material = texMat('withered_grass', 3, { tint: new C3(0.95, 0.82, 0.6) }); wuv(ground); ground.receiveShadows = true;
  const strip = (name, mat, w, d, x, z, y, soft) => {
    const g = BABYLON.MeshBuilder.CreateGround(name, { width: w, height: d, subdivisions: 1 }, scene); g.position.set(x, y, z);
    const uv0 = g.getVerticesData('uv').slice(); wuv(g); g.setVerticesData('uv2', uv0);
    const dt = new BABYLON.DynamicTexture(name + 'op', { width: 512, height: 128 }, scene, true); const cx = dt.getContext();
    const im = cx.createImageData(512, 128);
    for (let j = 0; j < 128; j++) for (let i = 0; i < 512; i++) {
      const v = j / 127, u = i / 511; const n = (Math.sin(i * 0.13) * 0.5 + Math.sin(i * 0.031 + j * 0.2) * 0.5 + Math.random() * 0.6) * 0.06;
      const edge = Math.min(v, 1 - v) * 2 + n; const ue = Math.min(u, 1 - u) * 12;
      const a = Math.max(0, Math.min(1, (edge - soft[0]) / soft[1])) * Math.min(1, ue);
      const k = 4 * (j * 512 + i); im.data[k] = im.data[k + 1] = im.data[k + 2] = 255; im.data[k + 3] = a * 255;
    }
    cx.putImageData(im, 0, 0); dt.update(); dt.hasAlpha = true; dt.coordinatesIndex = 1;
    mat.opacityTexture = dt; mat.useAlphaFromAlbedoTexture = false; g.material = mat; g.receiveShadows = true; return g;
  };
  strip('path', texMat('red_dirt_mud_01', 2.5, { tint: new C3(1.05, 0.78, 0.6), tag: 'p' }), 180, 7.5, 0, 0, 0.012, [0.05, 0.45]);
  strip('forecourt', texMat('red_laterite_soil_stones', 3, { tint: new C3(1.0, 0.85, 0.75), tag: 'f' }), 46, 6.5, 0, 6.0, 0.008, [0.0, 0.5]);
  strip('kioskyard', texMat('red_laterite_soil_stones', 3, { tint: new C3(1.0, 0.85, 0.75), tag: 'k' }), 16, 9, 7.5, -7.0, 0.006, [0.0, 0.6]);
  strip('greenpatch', texMat('sparse_grass', 2, { tint: new C3(1.0, 0.95, 0.7), tag: 'v' }), 40, 7, -30, -9, 0.004, [0.1, 0.6]);
  // concrete apron walkway in front of the block
  box('apron', -17, 0, 7.8, 17, 0.12, 9.0, M.floor);

  /* two-storey faculty block: rooms behind a veranda on both floors */
  const X0 = -16, X1 = 16, ZF = 9.0, ZW = 11.6, ZB = 18.5, F1 = 3.75, RF = 7.1;
  box('plinth', X0, 0, ZF, X1, 0.45, ZB, M.conc);
  box('verFloor', X0, 0.45, ZF, X1, 0.47, ZW, M.floor);
  box('rooms', X0, 0.45, ZW, X1, RF, ZB, M.plaster);
  box('dado', X0, 0.47, ZW - 0.03, X1, 1.4, ZW, M.plasterG);
  box('slab1', X0 - 0.3, F1, ZF - 0.25, X1 + 0.3, F1 + 0.28, ZB, M.conc);
  box('verFloor1', X0, F1 + 0.28, ZF, X1, F1 + 0.3, ZW, M.floor);
  box('dado1', X0, F1 + 0.3, ZW - 0.03, X1, F1 + 1.2, ZW, M.plasterG);
  box('roof', X0 - 0.6, RF, ZF - 0.6, X1 + 0.6, RF + 0.25, ZB + 0.6, M.conc);
  box('fascia', X0 - 0.6, RF + 0.25, ZF - 0.6, X1 + 0.6, RF + 0.95, ZF - 0.35, M.plaster);
  box('fasciaE', X0 - 0.6, RF + 0.25, ZF - 0.6, X0 - 0.35, RF + 0.95, ZB + 0.6, M.plaster);
  box('fasciaE2', X1 + 0.35, RF + 0.25, ZF - 0.6, X1 + 0.6, RF + 0.95, ZB + 0.6, M.plaster);
  // parapet on the first-floor veranda with a concrete coping and painted band
  box('parapet', X0, F1 + 0.28, ZF - 0.05, X1, F1 + 1.25, ZF + 0.15, M.plaster);
  box('band', X0, F1 + 0.28, ZF - 0.09, X1, F1 + 0.55, ZF - 0.05, M.plasterG);
  box('coping', X0 - 0.05, F1 + 1.25, ZF - 0.12, X1 + 0.05, F1 + 1.33, ZF + 0.2, M.conc);
  // end walls of the verandas
  box('endW', X0 - 0.25, 0.45, ZF, X0, RF, ZB, M.plaster); box('endE', X1, 0.45, ZF, X1 + 0.25, RF, ZB, M.plaster);
  const bays = [];
  for (let x = X0; x <= X1 + 0.01; x += 4) {
    box('col', x - 0.18, 0.45, ZF + 0.05, x + 0.18, F1, ZF + 0.41, M.plaster);
    box('colD', x - 0.19, 0.45, ZF + 0.04, x + 0.19, 1.3, ZF + 0.42, M.plasterG);
    box('col1', x - 0.16, F1 + 1.33, ZF + 0.05, x + 0.16, RF, ZF + 0.37, M.plaster);
    if (x < X1 - 0.01) bays.push(x + 2);
  }
  // louvre windows (glass blades in dark aluminium frames) + doors
  const blade = BABYLON.MeshBuilder.CreateBox('blade', { width: 1, height: 0.1, depth: 0.012 }, scene); blade.material = M.glass;
  const bladeMats = [];
  const LIT = [];
  const win = (cx, y0, w, h, lit) => {
    const z = ZW - 0.02;
    const pane = box('pane', cx - w / 2, y0, z - 0.02, cx + w / 2, y0 + h, z, lit ? null : M.dark, !lit);
    if (lit) { LIT.push(pane); }
    const t = 0.06;
    box('fr', cx - w / 2 - t, y0 - t, z - 0.1, cx + w / 2 + t, y0, z, M.frame); box('fr', cx - w / 2 - t, y0 + h, z - 0.1, cx + w / 2 + t, y0 + h + t, z, M.frame);
    box('fr', cx - w / 2 - t, y0, z - 0.1, cx - w / 2, y0 + h, z, M.frame); box('fr', cx + w / 2, y0, z - 0.1, cx + w / 2 + t, y0 + h, z, M.frame);
    box('fr', cx - 0.02, y0, z - 0.1, cx + 0.02, y0 + h, z, M.frame);
    box('sill', cx - w / 2 - 0.12, y0 - t - 0.06, z - 0.18, cx + w / 2 + 0.12, y0 - t, z, M.conc);
    for (let s = 0; s < 2; s++) for (let i = 0; i < Math.floor(h / 0.09); i++) {
      const m = BABYLON.Matrix.Compose(new V3(w / 2 - 0.03, 1, 1), BABYLON.Quaternion.RotationAxis(V3.Right(), -0.32), new V3(cx + (s ? 1 : -1) * (w / 4 + 0.005), y0 + 0.05 + i * 0.09, z - 0.06));
      bladeMats.push(m);
    }
  };
  bays.forEach((cx, i) => {
    [0.45, F1 + 0.3].forEach((fy, f) => {
      const doorBay = (i % 3 === 1);
      if (doorBay) {
        box('door', cx + 0.4, fy, ZW - 0.06, cx + 1.4, fy + 2.15, ZW, M.door);
        box('dfr', cx + 0.33, fy, ZW - 0.08, cx + 1.47, fy + 2.22, ZW - 0.02, M.frame);
        win(cx - 0.8, fy + 1.0, 1.1, 1.3, NIGHT && (i + f) % 2 === 0);
      } else {
        win(cx - 0.85, fy + 1.0, 1.4, 1.35, NIGHT && (i * 3 + f) % 4 === 1);
        win(cx + 0.85, fy + 1.0, 1.4, 1.35, NIGHT && (i * 3 + f) % 4 === 1);
      }
      box('fan', cx - 1.2, fy + 2.75, ZW - 0.02, cx + 1.2, fy + 3.05, ZW + 0.0, M.frame);  // vent strip above
    });
  });
  const bufM = new Float32Array(bladeMats.length * 16); bladeMats.forEach((m, i) => m.copyToArray(bufM, i * 16));
  blade.thinInstanceSetBuffer('matrix', bufM, 16); blade.receiveShadows = true;
  // stair tower with a breeze-block screen at the east end
  const TX0 = X1 + 0.25, TX1 = X1 + 4.2;
  box('tower', TX0, 0.45, ZF + 1.2, TX1, RF + 1.6, ZB - 2, M.plaster);
  box('towerCap', TX0 - 0.2, RF + 1.6, ZF + 1.0, TX1 + 0.2, RF + 1.85, ZB - 1.8, M.conc);
  box('towerHole', TX0 + 0.6, 1.2, ZF + 1.16, TX1 - 0.6, RF + 1.0, ZF + 1.2, M.dark);
  const bb = BABYLON.MeshBuilder.CreateBox('bb', { size: 1 }, scene); bb.material = M.plaster; const bbm = [];
  for (let y = 1.2; y <= RF + 1.0 + 0.01; y += 0.3) bbm.push(BABYLON.Matrix.Compose(new V3(TX1 - TX0 - 1.2, 0.07, 0.22), BABYLON.Quaternion.Identity(), new V3((TX0 + TX1) / 2, y, ZF + 1.08)));
  for (let x = TX0 + 0.6; x <= TX1 - 0.6 + 0.01; x += 0.3) bbm.push(BABYLON.Matrix.Compose(new V3(0.07, RF - 0.2, 0.22), BABYLON.Quaternion.Identity(), new V3(x, (1.2 + RF + 1.0) / 2, ZF + 1.08)));
  const bbb = new Float32Array(bbm.length * 16); bbm.forEach((m, i) => m.copyToArray(bbb, i * 16)); bb.thinInstanceSetBuffer('matrix', bbb, 16); bb.receiveShadows = true;
  // black water tank on the roof (every Nigerian campus roof has one)
  const tank = BABYLON.MeshBuilder.CreateCylinder('tank', { diameter: 1.7, height: 1.9, tessellation: 40 }, scene); tank.position.set(9, RF + 0.25 + 1.2, 15); tank.material = M.tank;
  box('tankStand', 8, RF + 0.25, 14, 10, RF + 0.3, 16, M.conc, true);
  [tank].forEach(m => { m.receiveShadows = true; caster(m); });
  // fascia lettering + sign board
  const letters = BABYLON.MeshBuilder.CreatePlane('letters', { width: 14, height: 0.62 }, scene);
  letters.position.set(-3, RF + 0.6, ZF - 0.62);
  const lt = new BABYLON.DynamicTexture('lt', { width: 2048, height: 92 }, scene, true); lt.hasAlpha = true;
  { const c = lt.getContext(); c.clearRect(0, 0, 2048, 92); c.font = 'bold 66px Helvetica, Arial, sans-serif'; c.fillStyle = '#5a3a22'; c.textAlign = 'center'; c.textBaseline = 'middle';
    if (c.letterSpacing !== undefined) c.letterSpacing = '10px'; c.fillText('FACULTY  OF  ENGINEERING', 1024, 50); lt.update(); }
  const lm = new BABYLON.PBRMaterial('lm', scene); lm.albedoTexture = lt; lm.useAlphaFromAlbedoTexture = true; lm.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHATEST; lm.alphaCutOff = 0.4; lm.roughness = 0.6; lm.metallic = 0.2;
  letters.material = lm; letters.receiveShadows = true;
  const sign = BABYLON.MeshBuilder.CreatePlane('sign', { width: 3.4, height: 1.25 }, scene); sign.position.set(-2.5, 2.05, 5.7);
  const stx = new BABYLON.DynamicTexture('st', { width: 1024, height: 376 }, scene, true);
  { const c = stx.getContext(); const g = c.createLinearGradient(0, 0, 0, 376); g.addColorStop(0, '#1d5a3a'); g.addColorStop(1, '#184a30'); c.fillStyle = g; c.fillRect(0, 0, 1024, 376);
    c.strokeStyle = '#f2efe4'; c.lineWidth = 10; c.strokeRect(18, 18, 988, 340); c.fillStyle = '#f5f2e8'; c.textAlign = 'center';
    c.font = 'bold 74px Helvetica, Arial, sans-serif'; c.fillText('FACULTY OF', 512, 130); c.fillText('ENGINEERING', 512, 220);
    c.font = '38px Helvetica, Arial, sans-serif'; c.fillText('Department of Electrical Engineering', 512, 300); stx.update(); }
  const sgm = new BABYLON.PBRMaterial('signM', scene); sgm.albedoTexture = stx; sgm.roughness = 0.45; sgm.metallic = 0; sign.material = sgm; sign.receiveShadows = true;
  box('signBack', -4.25, 1.4, 5.72, -0.75, 2.72, 5.78, M.post, true);
  box('signPostL', -4.0, 0, 5.74, -3.9, 1.45, 5.84, M.post); box('signPostR', -1.1, 0, 5.74, -1.0, 1.45, 5.84, M.post);
  caster(sign);

  /* kiosk across the road (generator + bulb for the night scene) */
  const KX = 7.5, KZ = -7.2;
  box('kioskBack', KX - 1.4, 0, KZ - 1.1, KX + 1.4, 2.4, KZ - 0.95, M.kiosk);
  box('kioskL', KX - 1.4, 0, KZ - 1.1, KX - 1.25, 2.4, KZ + 1.0, M.kiosk); box('kioskR', KX + 1.25, 0, KZ - 1.1, KX + 1.4, 2.4, KZ + 1.0, M.kiosk);
  box('kioskFront', KX - 1.4, 0, KZ + 0.85, KX + 1.4, 1.05, KZ + 1.0, M.kiosk);
  box('kioskTop', KX - 1.4, 2.0, KZ + 0.85, KX + 1.4, 2.4, KZ + 1.0, M.kiosk);
  box('counter', KX - 1.5, 1.05, KZ + 0.8, KX + 1.5, 1.1, KZ + 1.25, M.door);
  box('kioskIn', KX - 1.25, 0, KZ - 0.95, KX + 1.25, 0.05, KZ + 0.85, M.dark);
  box('shelf', KX - 1.2, 1.5, KZ - 0.95, KX + 1.2, 1.53, KZ - 0.6, M.door);
  const roof = BABYLON.MeshBuilder.CreateBox('kroof', { width: 3.4, height: 0.04, depth: 3.0 }, scene); roof.position.set(KX, 2.55, KZ + 0.1); roof.rotation.x = -0.12; roof.material = M.rust; wuv(roof); roof.receiveShadows = true; caster(roof);
  // goods on the shelf
  const goods = []; const gcol = [new C3(0.8, 0.12, 0.08), new C3(0.95, 0.75, 0.1), new C3(0.1, 0.35, 0.7), new C3(0.9, 0.9, 0.85)];
  for (let i = 0; i < 14; i++) { const g = BABYLON.MeshBuilder.CreateBox('good', { width: 0.12, height: 0.22 + (i % 3) * 0.05, depth: 0.12 }, scene); g.position.set(KX - 1.05 + i * 0.16, 1.53 + 0.12, KZ - 0.78); g.material = flat('g' + i, gcol[i % 4], 0.4); goods.push(g); }
  const kioskSign = BABYLON.MeshBuilder.CreatePlane('ks', { width: 2.6, height: 0.36 }, scene); kioskSign.position.set(KX, 2.2, KZ + 1.01); kioskSign.rotation.y = Math.PI;
  const kt = new BABYLON.DynamicTexture('kt', { width: 1024, height: 142 }, scene, true);
  { const c = kt.getContext(); c.fillStyle = '#f4d23c'; c.fillRect(0, 0, 1024, 142); c.fillStyle = '#1b1b1b'; c.font = 'bold 72px Helvetica, Arial, sans-serif'; c.textAlign = 'center'; c.fillText('MAMA T  PROVISIONS', 512, 98); kt.update(); }
  const ksm = new BABYLON.PBRMaterial('ksm', scene); ksm.albedoTexture = kt; ksm.roughness = 0.5; kioskSign.material = ksm; kioskSign.receiveShadows = true;
  const bulb = BABYLON.MeshBuilder.CreateSphere('bulb', { diameter: 0.11 }, scene); bulb.position.set(KX, 1.95, KZ + 0.5);
  const bm = new BABYLON.PBRMaterial('bulbM', scene); bm.emissiveColor = NIGHT ? new C3(1, 0.75, 0.42) : new C3(0.3, 0.28, 0.25); bm.emissiveIntensity = NIGHT ? 14 : 1; bm.albedoColor = C3.Black(); bulb.material = bm;
  const wire = BABYLON.MeshBuilder.CreateCylinder('wire', { diameter: 0.012, height: 0.42 }, scene); wire.position.set(KX, 2.2, KZ + 0.5); wire.material = M.frame;

  const merged = mergeStatic(); merged.forEach(m => { m.receiveShadows = true; caster(m); });
  caster([blade, bb, letters, ...goods]);

  /* props + vegetation (Poly Haven, CC0) */
  const [tree, bench, chair, gen, lamp, grass, shrub, crate] = await Promise.all(['island_tree_02', 'painted_wooden_bench', 'plastic_monobloc_chair_01', 'portable_generator', 'street_lamp_01', 'grass_bermuda_01', 'shrub_02', 'plastic_crate_01'].map(n => model(n)));
  tree.materials.forEach(m => { if (/leaves/.test(m.name)) { m.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHATEST; m.alphaCutOff = 0.45; m.useAlphaFromAlbedoTexture = true; m.backFaceCulling = false; m.twoSidedLighting = true;
    m.albedoColor = new C3(0.85, 0.95, 0.7); m.subSurface.isTranslucencyEnabled = true; m.subSurface.translucencyIntensity = 0.6; m.subSurface.tintColor = new C3(0.6, 0.8, 0.2); } });
  const trees = [[-9.5, 4.3, 0.3, 2.6], [5.5, 4.6, 2.1, 2.9], [-1.5, -5.6, 1.2, 2.4], [21, 4.2, 4.0, 2.7], [17, -6.2, 5.0, 2.8], [-22, -5.2, 3.3, 2.6], [32, 5.0, 0.9, 2.9]];
  trees.slice(0, +(Q.get('trees') ?? 5)).forEach((t, i) => { const p = place(tree, new V3(t[0], 0, t[1]), t[2], t[3], 't' + i); caster(p.ms); });
  { const p = place(bench, new V3(-9.0, 0, 3.3), +(Q.get('br') ?? -1.5708), 1.35, 'b'); caster(p.ms); }
  { const p = place(gen, new V3(KX + 2.3, 0, KZ + 0.6), 0.5, 1, 'g'); caster(p.ms); }
  [[KX - 2.2, KZ + 2.0, 2.6], [KX + 0.8, KZ + 2.3, 3.4], [KX - 0.9, KZ + 2.6, 3.0]].forEach((c, i) => { const p = place(chair, new V3(c[0], 0, c[1]), c[2], 1, 'c' + i); caster(p.ms); });
  [[KX + 1.9, KZ - 0.6], [KX + 1.9, KZ - 0.25]].forEach((c, i) => { const p = place(crate, new V3(c[0], i * 0.26, c[1]), 0.2 * i, 1.3, 'k' + i); caster(p.ms); });
  const steel = flat('steel', new C3(0.42, 0.42, 0.4), 0.45, 0.85);
  const lamps = [[-13, -4.2], [13, -4.2], [39, -4.2], [65, -4.2]].map((l, i) => {
    const pole = BABYLON.MeshBuilder.CreateCylinder('pole', { diameterTop: 0.09, diameterBottom: 0.16, height: 7, tessellation: 12 }, scene); pole.position.set(l[0], 3.5, l[1]); pole.material = steel;
    const arm = BABYLON.MeshBuilder.CreateCylinder('arm', { diameter: 0.06, height: 1.6, tessellation: 8 }, scene); arm.rotation.x = Math.PI / 2 - 0.15; arm.position.set(l[0], 6.95, l[1] + 0.75); arm.material = steel;
    const head = BABYLON.MeshBuilder.CreateBox('lhead', { width: 0.28, height: 0.12, depth: 0.6 }, scene); head.position.set(l[0], 7.05, l[1] + 1.55); head.material = steel;
    [pole, arm, head].forEach(m => { m.receiveShadows = true; caster(m); }); return { r: { position: new V3(l[0], 0, l[1]) } }; });
  // distant blocks, a water tower and cheap far trees to close the vista (fog hides the simplicity)
  const far = (x0, z0, x1, z1, h) => { box('farB', x0, 0, z0, x1, h, z1, M.plaster); box('farR', x0 - 0.5, h, z0 - 0.5, x1 + 0.5, h + 0.6, z1 + 0.5, M.conc);
    const zf = z0 < 0 ? z1 : z0; for (let y = 1.2; y < h - 1; y += 3.4) box('farW', x0 + 1, y, zf + (z0 < 0 ? 0 : -0.04), x1 - 1, y + 1.3, zf + (z0 < 0 ? 0.04 : 0), M.dark); };
  far(30, -26, 56, -18, 7.4); far(36, 14, 62, 22, 10.8); far(75, -24, 95, -16, 7.4);
  const wt = BABYLON.MeshBuilder.CreateCylinder('wtank', { diameter: 7, height: 4.5, tessellation: 32 }, scene); wt.position.set(105, 20, 30); wt.material = M.plaster;
  for (let i = 0; i < 4; i++) { const leg = BABYLON.MeshBuilder.CreateCylinder('wleg', { diameter: 0.5, height: 18, tessellation: 8 }, scene); leg.position.set(105 + (i % 2 ? 2.4 : -2.4), 9, 30 + (i < 2 ? 2.4 : -2.4)); leg.material = M.conc; }
  const canopyM = new BABYLON.PBRMaterial('canopy', scene); canopyM.albedoTexture = new BABYLON.Texture('assets/tex/sparse_grass/diff.jpg', scene); canopyM.albedoColor = new C3(0.13, 0.19, 0.07); canopyM.roughness = 0.9;
  const trunkM = flat('trunk', new C3(0.18, 0.13, 0.1), 0.9);
  const farTree = (x, z, s) => { const t = BABYLON.MeshBuilder.CreateCylinder('ft', { diameter: 0.5 * s, height: 3 * s, tessellation: 8 }, scene); t.position.set(x, 1.5 * s, z); t.material = trunkM;
    for (let k = 0; k < 4; k++) { const c = BABYLON.MeshBuilder.CreateIcoSphere('fc', { radius: (1.9 + (k % 2) * 0.7) * s, subdivisions: 2 }, scene); c.position.set(x + Math.sin(k * 2.1) * 1.6 * s, (3.6 + (k % 3) * 0.7) * s, z + Math.cos(k * 2.1) * 1.6 * s); c.scaling.y = 0.7; c.material = canopyM; caster(c); c.receiveShadows = true; } caster(t); };
  [[48, 6, 1.4], [60, -9, 1.6], [72, 7, 1.5], [85, -8, 1.3], [98, 9, 1.7], [110, -7, 1.5], [70, 18, 1.8], [120, 14, 1.6], [130, -12, 1.5], [26, -15, 1.3], [-40, 12, 1.6], [-50, -14, 1.5]].forEach(t => farTree(t[0], t[1], t[2]));
  // grass clumps + shrubs along the verges (thin instances of one clump)
  const gm = grass.meshes.filter(m => m.getTotalVertices() > 0);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  if (Q.get('clumps')) gm.forEach(src => {
    src.setParent(null); src.position.set(0, 0, 0); src.rotationQuaternion = null; src.rotation.set(0, 0, 0); src.scaling.set(1, 1, 1);
    const mats = [];
    for (let i = 0; i < 900; i++) {
      const side = rnd() < 0.55; const x = -45 + rnd() * 110; let z = side ? 4.3 + rnd() * 3.8 : -5.6 - rnd() * 5; if (z > 7.6 && x > -18 && x < 21) continue;
      if (Math.abs(z) < 3.6) continue;
      const s = 1.3 + rnd() * 1.8;
      mats.push(BABYLON.Matrix.Compose(new V3(s, s * (0.7 + rnd() * 0.8), s), BABYLON.Quaternion.RotationAxis(V3.Up(), rnd() * 6.28), new V3(x, 0, z)));
    }
    const b = new Float32Array(mats.length * 16); mats.forEach((m, i) => m.copyToArray(b, i * 16)); src.thinInstanceSetBuffer('matrix', b, 16); src.receiveShadows = true;
    if (src.material) { src.material.albedoColor = new C3(1.5, 1.25, 0.8); }
  });
  if (Q.get('clumps')) grass.addAllToScene();
  [[-14, 8.3], [-10.5, 8.4], [-2, 8.3], [2, 8.4], [10, 8.3], [14, 8.3]].forEach((s, i) => { const p = place(shrub, new V3(s[0], 0, s[1] - 0.6), i * 1.7, 0.85, 's' + i); caster(p.ms); });
  return { M, LIT, KX, KZ, bulb, lamps, ZF, F1 };
}

/* ---------- scenes ---------- */
async function sceneA(night) {
  const S = night
    ? sky('kloppenheim_02_puresky_2k.hdr', 4.68, 0.35, 0.16)
    : sky('belfast_sunset_puresky_2k.hdr', 3.74, 0.6, 1.15);
  if (!night) {
    sunLight(Q.get('sunhi') ? new V3(-0.3, -1, 0.3) : new V3(-0.42, -0.27, 0.87), new C3(1.0, 0.68, 0.40), 9.0);
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP2; scene.fogDensity = 0.0095; scene.fogColor = new C3(0.80, 0.62, 0.50);
  } else {
    sunLight(new V3(-0.94, -0.3, 0.17), new C3(0.62, 0.74, 1.0), 0.6);
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP2; scene.fogDensity = 0.012; scene.fogColor = new C3(0.035, 0.045, 0.07);
  }
  const tall = VIEW === 'tall';
  if (SC === 'B') camera(new V3(-3.4, 1.25, -1.2), new V3(-3.4, 0.95, 4.7), 0.6);
  else if (tall) camera(new V3(-19.5, 1.6, -1.4), new V3(-5, 4.2, 4.8), 1.05);
  else camera(new V3(-22, 1.75, -2.6), new V3(0, 3.3, 3.2), 0.78);
  const env = await campus();
  SG = shadows(SUN, { size: 2048, maxZ: SC === 'B' ? 30 : 95, pcss: !night, light: 0.015, bias: 0.003, nbias: 0.03, dark: night ? 0.15 : 0 });
  const H = Math.PI / 2;
  if (SC === 'B') {
    // tone range, light to deep, with lean and chubby builds
    const z = 4.6, line = [
      { type: 'Casual3_Female', skin: 'light', shirt: new C3(0.2, 0.45, 0.75), pants: new C3(0.15, 0.15, 0.2), hair: new C3(0.35, 0.2, 0.1), w: 0.9, h: 1.58 },
      { type: 'Casual_Male', skin: 'tan', shirt: new C3(0.92, 0.9, 0.85), pants: new C3(0.1, 0.13, 0.25), w: 0.88, h: 1.7 },
      { type: 'Suit_Female', skin: 'medium', shirt: new C3(0.95, 0.75, 0.2), pants: new C3(0.12, 0.12, 0.14), detail: new C3(0.8, 0.2, 0.1), h: 1.6 },
      { type: 'Casual_Bald', skin: 'brown', shirt: new C3(0.2, 0.55, 0.35), pants: new C3(0.3, 0.25, 0.18), w: 1.32, h: 1.64 },
      { type: 'Casual2_Female', skin: 'dark', shirt: new C3(0.9, 0.38, 0.1), pants: new C3(0.08, 0.3, 0.38), h: 1.6, w: 1.0 },
      { type: 'Casual2_Male', skin: 'deep', shirt: new C3(0.55, 0.15, 0.45), pants: new C3(0.12, 0.1, 0.1), h: 1.74, w: 1.0 }];
    for (let i = 0; i < line.length; i++) await person(Object.assign({ anim: 'Idle', frame: i * 0.17, pos: [-6.2 + i * 1.12, z + (i % 2) * 0.25], rot: Math.PI + (i - 2.5) * 0.08 }, line[i]));
  } else if (Q.get('cc')) {
    const who = Q.get('cc').split(','), outs = (Q.get('o') || '0').split(',').map(Number), px = +(Q.get('px') || -6), pz = +(Q.get('pz') || -0.4);
    window.CCH = [];
    for (let i = 0; i < who.length; i++) { const look = await (await fetch(who[i] + '.json?v=' + Date.now())).json(); const c = CC.build(scene, look, outs[i] || 0);
      c.root.position = new V3(px + (i - (who.length - 1) / 2) * 0.62, 0, pz); c.root.rotation.y = (i ? -1 : 1) * 0.18; c.meshes.forEach(m => { CASTERS.push(m); m.receiveShadows = true; if (m.material && m.material.sheen) { m.material.sheen.intensity *= 0.25; } }); window.CCH.push(c); }
    { const all = window.CCH.flatMap(c => c.meshes);
      const f = new BABYLON.DirectionalLight('ccFill', new V3(0.35, -0.45, 1), scene); f.diffuse = new C3(1, 0.86, 0.72); f.intensity = +(Q.get('fi') || 2.0); f.includedOnlyMeshes = all; SUN.excludedMeshes.push(...all);
      const rim = new BABYLON.DirectionalLight('ccRim', SUN.direction.clone(), scene); rim.diffuse = new C3(1, 0.7, 0.45); rim.intensity = 1.6; rim.includedOnlyMeshes = all;
      const r = new BABYLON.HemisphericLight('ccSky', new V3(0, 1, -0.3), scene); r.diffuse = new C3(1, 0.85, 0.75); r.groundColor = new C3(0.5, 0.3, 0.2); r.intensity = 0.5; r.includedOnlyMeshes = all;
      all.forEach(m => { if (m.material) m.material.maxSimultaneousLights = 8; }); }
    await person({ type: 'Casual3_Female', skin: 'light', shirt: new C3(0.25, 0.5, 0.8), pants: new C3(0.2, 0.2, 0.25), hair: new C3(0.3, 0.17, 0.08), anim: 'Walk', frame: 0.7, pos: [-1.5, 1.6], rot: H - 0.02, speed: 1.0, w: 0.9, h: 1.58 });
  } else {
    await person({ type: 'Casual2_Female', skin: 'dark', shirt: new C3(0.9, 0.4, 0.1), pants: new C3(0.08, 0.3, 0.38), anim: 'Walk', frame: 0.0, pos: [-10.0, -0.3], rot: -H + 0.04, speed: 1.05 });
    await person({ type: 'Casual_Male', skin: 'medium', shirt: new C3(0.93, 0.92, 0.88), pants: new C3(0.1, 0.13, 0.25), anim: 'Walk', frame: 0.45, pos: [-10.8, -1.05], rot: -H + 0.04, speed: 1.05, h: 1.72, w: 0.9 });
    await person({ type: 'Suit_Male', skin: 'deep', shirt: new C3(0.85, 0.85, 0.82), pants: new C3(0.15, 0.17, 0.22), anim: 'Walk', frame: 0.3, pos: [-4.5, 1.1], rot: H + 0.03, speed: 0.95, w: 1.28, h: 1.68 });
    await person({ type: 'Casual3_Female', skin: 'light', shirt: new C3(0.25, 0.5, 0.8), pants: new C3(0.2, 0.2, 0.25), hair: new C3(0.3, 0.17, 0.08), anim: 'Walk', frame: 0.7, pos: [-1.5, 1.6], rot: H - 0.02, speed: 1.0, w: 0.9, h: 1.58 });
    await person({ type: 'Casual_Bald', skin: 'brown', shirt: new C3(0.2, 0.55, 0.35), pants: new C3(0.3, 0.25, 0.18), anim: 'Idle', frame: 0.2, pos: [-8.4, 2.75], rot: Math.PI + 0.3, w: 1.3, h: 1.62 });
    await person({ type: 'Worker_Male', skin: 'dark', shirt: new C3(0.95, 0.6, 0.15), pants: new C3(0.2, 0.25, 0.4), vest: new C3(0.95, 0.75, 0.1), hat: new C3(0.95, 0.85, 0.2), anim: 'Idle', frame: 0.5, pos: [env.KX + 1.6, env.KZ + 1.6], rot: -2.4, h: 1.66 });
    await person({ type: 'Casual2_Female', skin: 'medium', shirt: new C3(0.6, 0.15, 0.4), pants: new C3(0.25, 0.1, 0.2), anim: 'Idle', frame: 0.1, pos: [env.KX - 0.5, env.KZ + 1.8], rot: 0.2, h: 1.56 });
  }
  if (night) {
    const k = new BABYLON.PointLight('kioskLight', new V3(env.KX, 1.85, env.KZ + 0.55), scene); k.diffuse = new C3(1.0, 0.68, 0.36); k.intensity = 160; k.range = 30;
    const ksg = new BABYLON.ShadowGenerator(1024, k); ksg.usePercentageCloserFiltering = true; ksg.bias = 0.01;
    CASTERS.forEach(m => { const b = m.getBoundingInfo().boundingSphere.centerWorld; if (V3.Distance(b, k.position) < 14) ksg.addShadowCaster(m); });
    const glow = new BABYLON.PointLight('genGlow', new V3(env.KX + 2.3, 0.9, env.KZ + 1.2), scene); glow.diffuse = new C3(1, 0.5, 0.2); glow.intensity = 6; glow.range = 5;
    // lit classrooms: fluorescent tubes behind louvres
    const wm = new BABYLON.PBRMaterial('litWin', scene); wm.albedoColor = C3.Black(); wm.emissiveColor = new C3(0.85, 1.0, 0.92); wm.emissiveIntensity = 4;
    env.LIT.forEach(m => { m.material = wm; });
    const wl = []; env.LIT.forEach((m, i) => { if (i % 2) return; const p = m.getBoundingInfo().boundingBox.centerWorld; const l = new BABYLON.SpotLight('wl' + i, new V3(p.x, p.y + 0.3, p.z + 0.4), new V3(0, -0.55, -1), 1.9, 2, scene); l.diffuse = new C3(0.8, 1, 0.9); l.intensity = 25; l.range = 10; wl.push(l); });
    // one working street lamp (sodium) and a cool moonlit sky
    const lp = env.lamps[0].r.position; const sl = new BABYLON.SpotLight('lamp', new V3(lp.x, 5.9, lp.z + 0.9), new V3(0, -1, 0.15), 1.4, 3, scene); sl.diffuse = new C3(1, 0.62, 0.3); sl.intensity = 180; sl.range = 20;
    MATS.concat(scene.materials).forEach(m => { m.maxSimultaneousLights = 12; });
    if (SC !== 'B') { CAM.position = new V3(19, 1.9, -1.5); CAM.setTarget(new V3(0, 2.4, 0.5)); CAM.fov = 1.0; }
  }
  CASTERS.forEach(m => SG.addShadowCaster(m));
  if (SC === 'B') postFX(CAM, { exposure: 1.05, contrast: 1.18, dof: { focalLength: 50, fStop: 2.8, focusDistance: 5900, lensSize: 50 }, vig: 2.6, aoRadius: 0.4, ao: 0.9, aoMaxZ: 40, curves: { globalSaturation: 8, highlightsHue: 30, highlightsDensity: 30, highlightsSaturation: 30, shadowsHue: 210, shadowsDensity: 15, shadowsSaturation: 20 } });
  else if (night) postFX(CAM, { exposure: 1.6, contrast: 1.2, bloomT: 0.6, bloomW: 0.6, vig: 2.8, curves: { shadowsHue: 220, shadowsDensity: 40, shadowsSaturation: 40, highlightsHue: 35, highlightsDensity: 20, highlightsSaturation: 20 } });
  else postFX(CAM, { exposure: 1.0, contrast: 1.18, curves: { globalSaturation: 5, highlightsHue: 32, highlightsDensity: 35, highlightsSaturation: 35, shadowsHue: 215, shadowsDensity: 18, shadowsSaturation: 25, midtonesHue: 30, midtonesDensity: 10, midtonesSaturation: 15 } });
}

async function sceneD() {
  // the sun sits straight ahead (+z) over the reservoir
  sky('industrial_sunset_02_puresky_2k.hdr', +(Q.get('rot') ?? DROT), 0.7, 0.55);
  sunLight(new V3(-0.15, -0.10, -1), new C3(1.0, 0.6, 0.32), 5.0);
  scene.fogMode = BABYLON.Scene.FOGMODE_EXP2; scene.fogDensity = 0.0035; scene.fogColor = new C3(0.80, 0.62, 0.52);
  camera(new V3(-1.5, 1.45, -15), new V3(1.5, 2.2, 40), 0.85);
  const bank = BABYLON.MeshBuilder.CreateGround('bank', { width: 320, height: 90, subdivisions: 150, updatable: true }, scene); bank.position.z = -38;
  const pos = bank.getVerticesData('position');
  for (let i = 0; i < pos.length; i += 3) { const x = pos[i], z = pos[i + 2] - 38;
    const shore = -3 + 1.6 * Math.sin(x * 0.09) + 0.8 * Math.sin(x * 0.23 + 1.3);
    pos[i + 1] = Math.max(-1.4, Math.min(0.9, -0.16 * (z - shore))) + 0.06 * Math.sin(x * 1.3) * Math.sin(z * 1.1); }
  bank.updateVerticesData('position', pos); bank.createNormals(true); wuv(bank);
  bank.material = texMat('red_laterite_soil_stones', 3, { tint: new C3(1, 0.85, 0.75) }); bank.receiveShadows = true;
  const hillM = flat('hills', new C3(0.2, 0.15, 0.13), 0.95);
  for (let i = 0; i < 8; i++) { const h = BABYLON.MeshBuilder.CreateSphere('hill', { diameter: 1, segments: 24 }, scene); h.scaling.set(180 + i * 25, 16 + (i % 3) * 10, 70); h.position.set(-420 + i * 120, -3, 520 + (i % 2) * 60); h.material = hillM; }
  const water = BABYLON.MeshBuilder.CreateGround('water', { width: 2400, height: 2400, subdivisions: 32 }, scene); water.position.y = 0;
  const wm = new BABYLON.WaterMaterial('waterM', scene, new BABYLON.Vector2(1024, 1024));
  wm.bumpTexture = new BABYLON.Texture('assets/gen/water_nor.png', scene); wm.bumpTexture.uScale = wm.bumpTexture.vScale = 90;
  wm.windForce = -3; wm.waveHeight = 0.0; wm.bumpHeight = 0.08; wm.waveLength = 0.06; wm.windDirection = new BABYLON.Vector2(0.3, 1);
  wm.waterColor = new C3(0.16, 0.11, 0.08); wm.colorBlendFactor = 0.15; wm.waterColor2 = new C3(0.1, 0.07, 0.05); wm.colorBlendFactor2 = 0.1;
  wm.fresnelSeparate = true; wm.specularPower = 260; wm.specularColor = new C3(1, 0.68, 0.38);
  water.material = wm;
  // dam crest on the right running out across the water, with railings and lamp posts
  const conc = texMat('concrete_wall_008', 3, { tint: new C3(0.95, 0.85, 0.75) });
  const crest = box('crest', 14, -2, -12, 18, 1.3, 400, conc, false); crest.receiveShadows = true;
  const rail = flat('rail', new C3(0.55, 0.55, 0.55), 0.4, 0.9);
  const rp = BABYLON.MeshBuilder.CreateBox('rp', { width: 0.06, height: 1.0, depth: 0.06 }, scene); rp.material = rail; const rpm = [];
  for (let z = -11; z < 400; z += 2.5) rpm.push(BABYLON.Matrix.Translation(14.15, 1.8, z), BABYLON.Matrix.Translation(17.85, 1.8, z));
  const rb = new Float32Array(rpm.length * 16); rpm.forEach((m, i) => m.copyToArray(rb, i * 16)); rp.thinInstanceSetBuffer('matrix', rb, 16);
  const r1 = box('rail1', 14.12, 2.25, -12, 14.18, 2.3, 400, rail, false), r2 = box('rail2', 17.82, 2.25, -12, 17.88, 2.3, 400, rail, false);
  // reeds
  const reedM = new BABYLON.PBRMaterial('reedM', scene); reedM.albedoColor = new C3(0.45, 0.43, 0.17); reedM.roughness = 0.75; reedM.backFaceCulling = false; reedM.twoSidedLighting = true;
  reedM.subSurface.isTranslucencyEnabled = true; reedM.subSurface.translucencyIntensity = 0.9; reedM.subSurface.tintColor = new C3(0.9, 0.7, 0.2);
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const blades = [];
  for (let i = 0; i < 22; i++) {
    const h = 0.9 + rnd() * 1.2, a = rnd() * 6.28, r = rnd() * 0.22, lean = 0.05 + rnd() * 0.3, la = rnd() * 6.28;
    const path = []; for (let k = 0; k <= 6; k++) { const t = k / 6; path.push(new V3(Math.cos(a) * r + Math.cos(la) * lean * t * t * h, t * h, Math.sin(a) * r + Math.sin(la) * lean * t * t * h)); }
    blades.push(BABYLON.MeshBuilder.CreateTube('blade', { path, radiusFunction: (j) => 0.011 * (1 - j / 6.5), tessellation: 4, cap: 0 }, scene));
    if (i % 4 === 0) { const hd = BABYLON.MeshBuilder.CreateCapsule('head', { radius: 0.024, height: 0.2, tessellation: 6 }, scene); hd.position = path[5].clone(); blades.push(hd); }
  }
  const clump = BABYLON.Mesh.MergeMeshes(blades, true, true); clump.material = reedM; clump.receiveShadows = true;
  const cm = [];
  for (let i = 0; i < 520; i++) {
    const x = -45 + rnd() * 58; if (Math.abs(x + 1) < 4.5 && rnd() < 0.85) continue;   // keep a gap in front of the camera
    const shore = -3 + 1.6 * Math.sin(x * 0.09) + 0.8 * Math.sin(x * 0.23 + 1.3); const z = shore + (rnd() - 0.4) * 4;
    const s = 0.8 + rnd() * 0.7; cm.push(BABYLON.Matrix.Compose(new V3(s, s * (0.8 + rnd() * 0.5), s), BABYLON.Quaternion.RotationAxis(V3.Up(), rnd() * 6.28), new V3(x, -0.25, z)));
  }
  const cb = new Float32Array(cm.length * 16); cm.forEach((m, i) => m.copyToArray(cb, i * 16)); clump.thinInstanceSetBuffer('matrix', cb, 16);
  const [tree] = await Promise.all(['island_tree_02'].map(n => model(n)));
  tree.materials.forEach(m => { if (/leaves/.test(m.name)) { m.transparencyMode = BABYLON.PBRMaterial.PBRMATERIAL_ALPHATEST; m.alphaCutOff = 0.45; m.useAlphaFromAlbedoTexture = true; m.backFaceCulling = false; } });
  [[-13, -9, 0.4, 2.9], [-24, -14, 2, 2.6]].forEach((t, i) => { const p = place(tree, new V3(t[0], 0.8, t[1]), t[2], t[3], 'dt' + i); caster(p.ms); });
  const groundY = (x, z) => { const r = scene.pickWithRay(new BABYLON.Ray(new V3(x, 20, z), new V3(0, -1, 0), 40), m => m === bank); return r.hit ? r.pickedPoint.y : 0; };
  bank.computeWorldMatrix(true); bank.refreshBoundingInfo();
  await person({ type: 'Casual2_Male', skin: 'dark', shirt: new C3(0.92, 0.9, 0.84), pants: new C3(0.12, 0.12, 0.16), anim: 'Idle', frame: 0.3, pos: [-0.2, -6.4], y: groundY(-0.2, -6.4), rot: 0.15, h: 1.72 });
  await person({ type: 'Casual_Female', skin: 'medium', shirt: new C3(0.85, 0.3, 0.12), pants: new C3(0.1, 0.25, 0.35), anim: 'Idle', frame: 0.7, pos: [0.9, -6.1], y: groundY(0.9, -6.1), rot: -0.2, h: 1.6 });
  caster([clump, crest, rp, r1, r2]);
  SG = shadows(SUN, { size: 2048, maxZ: 80, bias: 0.004, nbias: 0.03, range: [-40, 40, -30, 30] });
  CASTERS.forEach(m => SG.addShadowCaster(m));
  [bank, clump, crest, ...PEOPLE.flatMap(p => p.meshes), ...scene.meshes.filter(m => m.name.startsWith('island') || m.name.includes('hill'))].forEach(m => wm.addToRenderList(m));
  wm.addToRenderList(scene.getMeshByName('sky'));
  postFX(CAM, { exposure: 0.85, contrast: 1.22, bloomT: 0.9, bloomW: 0.4, curves: { highlightsHue: 30, highlightsDensity: 30, highlightsSaturation: 30, shadowsHue: 230, shadowsDensity: 20, shadowsSaturation: 25 } });
}
const DROT = 0;
async function sceneS() {  // HDRI orientation check: sky only, camera looking down +z
  sky(Q.get('hdr') || 'industrial_sunset_02_puresky_2k.hdr', +(Q.get('rot') || 0), 1, 1);
  camera(new V3(0, 0, 0), new V3(0, 0.15, 1), 1.4); postFX(CAM, { ssao: false });
}

/* ---------- trailer shots: camera keys [pos, target, fov], t0 = scene time at the first frame ---------- */
const SHOTS = {
  A: { a_open: { dur: 7, t0: 0, keys: [[[-31, 7.5, -7], [0, 2.6, 4], 0.8], [[-22, 1.9, -2.6], [0, 3.1, 3.2], 0.78]] },
       a_walk: { dur: 7, t0: 0, follow: 1 },
       a_facade: { dur: 6, t0: 3, keys: [[[-13, 2.0, 1.2], [-8, 3.2, 9], 0.85], [[-3, 2.2, 1.6], [2, 3.4, 9], 0.85]] },
       a_kiosk: { dur: 5, t0: 9, keys: [[[-3, 1.7, -2.4], [7.5, 1.5, -7], 0.8], [[1.8, 1.55, -3.6], [7.5, 1.4, -7], 0.7]] },
       a_trees: { dur: 6, t0: 14, keys: [[[-7.5, 0.5, 1.0], [-6, 6, 4.5], 1.1], [[-6.5, 0.55, 1.2], [-1, 5.5, 5], 1.1]] } },
  B: { b_line: { dur: 8, t0: 0, keys: [[[-6.5, 1.35, 1.2], [-3.4, 1.0, 4.7], 0.62], [[-3.4, 1.3, 0.4], [-3.4, 1.0, 4.7], 0.62], [[-0.3, 1.35, 1.2], [-3.4, 1.0, 4.7], 0.62]], dofTrack: [-3.4, 1.0, 4.7] },
       b_faces: { dur: 5, t0: 4, keys: [[[-2.3, 1.45, 2.4], [-2.3, 1.35, 4.8], 0.6], [[-2.3, 1.45, 3.3], [-2.3, 1.4, 4.8], 0.6]], dofTrack: [-2.3, 1.4, 4.8] } },
  C: { c_kiosk: { dur: 8, t0: 0, keys: [[[-7, 1.6, -1.2], [7.5, 1.6, -6.6], 0.9], [[1.5, 1.5, -3.5], [7.5, 1.5, -7.0], 0.8]] },
       c_block: { dur: 7, t0: 2, keys: [[[-4, 1.7, -3], [-12, 3.5, 11], 0.85], [[-2, 1.7, -3], [8, 3.5, 11], 0.85]] },
       c_street: { dur: 6, t0: 0, keys: [[[-22, 1.7, -2.6], [0, 2.6, 2], 0.8], [[-19, 1.65, -2.3], [0, 2.5, 1.5], 0.8]] } },
  D: { d_sun: { dur: 9, t0: 0, keys: [[[-1.5, 1.4, -16], [1.5, 2.4, 40], 0.85], [[-0.7, 1.55, -10.8], [1.0, 2.0, 40], 0.8]] },
       d_reeds: { dur: 6, t0: 3, keys: [[[-16, 0.55, -5.2], [-6, 1.0, 30], 0.95], [[-9, 0.65, -5.6], [2, 1.2, 30], 0.95]] },
       d_crest: { dur: 6, t0: 6, keys: [[[15.2, 2.9, 34], [0, 1.2, -6], 0.85], [[15.6, 3.0, 22], [-1, 1.1, -6.5], 0.85]] } }
};
const ease = k => k * k * (3 - 2 * k);
function camAt(S, k) {
  const K = S.keys, segs = K.length - 1, x = ease(k) * segs, j = Math.min(segs - 1, Math.floor(x)), f = x - j;
  const a = K[j], b = K[j + 1], L = (u, v) => new V3(u[0] + (v[0] - u[0]) * f, u[1] + (v[1] - u[1]) * f, u[2] + (v[2] - u[2]) * f);
  CAM.position = L(a[0], b[0]); CAM.setTarget(L(a[1], b[1])); CAM.fov = a[2] + (b[2] - a[2]) * f;
}
window.shotList = () => Object.keys(SHOTS[SC] || {}).map(n => n + ':' + SHOTS[SC][n].dur).join(',');
window.frame = (name, i, fps) => {
  const S = SHOTS[SC][name], n = Math.round(S.dur * fps), k = n > 1 ? i / (n - 1) : 0, t = S.t0 + i / fps;
  setTime(t);
  if (S.follow) { const a = PEOPLE[0].root.position, b = PEOPLE[1].root.position, c = a.add(b).scale(0.5);
    CAM.position = new V3(c.x - 4.6 + k * 0.8, 1.35, c.z - 2.4 + k * 0.6); CAM.setTarget(new V3(c.x, 1.05, c.z)); CAM.fov = 0.7; }
  else camAt(S, k);
  if (S.dofTrack && PIPE && PIPE.depthOfFieldEnabled) PIPE.depthOfField.focusDistance = V3.Distance(CAM.position, new V3(...S.dofTrack)) * 1000;
  if (PIPE) PIPE.imageProcessing.vignetteCameraFov = CAM.fov;
  scene.render(); return canvas.toDataURL('image/jpeg', 0.93);
};

/* ---------- boot + timer-driven rendering ---------- */
window.view = (name, a) => { a = a || {}; CAM.position = new V3(...a.pos); CAM.setTarget(new V3(...a.tgt)); CAM.fov = a.fov || 0.6; if (PIPE) PIPE.imageProcessing.vignetteCameraFov = CAM.fov; for (let i = 0; i < 4; i++) scene.render(); return 1; };
window.renderN = n => { for (let i = 0; i < n; i++) scene.render(); return 1; };
window.snap = (type) => { scene.render(); return canvas.toDataURL(type || 'image/jpeg', 0.9); };
(async () => {
  try {
    if (SC === 'D') await sceneD(); else if (SC === 'S') await sceneS(); else await sceneA(NIGHT);
    INFO.meshes = scene.meshes.length; if (SG) { const sm = SG.getShadowMap(); INFO.sh = { rl: sm.renderList.length, rlNames: sm.renderList.slice(0, 12).map(m => m.name + (m.isEnabled() ? '' : '(off)') + (m.isVisible ? '' : '(inv)')), size: sm.getSize(), ortho: [SUN.orthoLeft, SUN.orthoRight, SUN.orthoBottom, SUN.orthoTop], pos: SUN.position.asArray().map(Math.round), recv: scene.meshes.filter(m => m.receiveShadows).length }; } INFO.lights = scene.lights.length;
    let n = 0;
    const tick = () => {
      try { scene.render(); } catch (e) { window.__err.push('render ' + e.message); }
      n++; INFO.n = n; INFO.ms = Math.round(performance.now() - (INFO.t0 || performance.now())); INFO.t0 = performance.now(); INFO.isReady = scene.isReady();
      if ((scene.isReady() && n > (+Q.get('warm') || 12)) || n > 60) { INFO.frames = n; INFO.ready = scene.isReady(); window.__ready = true; return; }
      setTimeout(tick, 30);
    };
    tick();
  } catch (e) { window.__err.push('boot ' + e.message + ' ' + e.stack); window.__ready = 'error'; }
})();
