'use strict';
const Q = new URLSearchParams(location.search);
const W = +Q.get('w') || 900, H = +Q.get('h') || 1200;
const canvas = document.getElementById('c'); canvas.width = W; canvas.height = H; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, antialias: true }, false);
const scene = new BABYLON.Scene(engine); const V3 = BABYLON.Vector3;
window.__info = {};
(async () => {
  try {
    const who = (Q.get('who') || 'jiya').split(','), outs = (Q.get('o') || '0').split(',').map(Number);
    const bg = BABYLON.Color3.FromHexString(Q.get('bg') ? '#' + Q.get('bg') : '#efe3d6').toLinearSpace();
    scene.clearColor = new BABYLON.Color4(bg.r, bg.g, bg.b, 1);
    const hdr = new BABYLON.HDRCubeTexture('assets/hdri/belfast_sunset_puresky_2k.hdr', scene, 128, false, true, false, true); hdr.level = 0.55; hdr.rotationY = 1.2; scene.environmentTexture = hdr;
    // cyclorama
    const cyc = BABYLON.MeshBuilder.CreateGround('floor', { width: 40, height: 40 }, scene);
    const back = BABYLON.MeshBuilder.CreateCylinder('cyc', { diameter: 16, height: 12, tessellation: 64, sideOrientation: BABYLON.Mesh.BACKSIDE }, scene); back.position.y = 6;
    const bm = new BABYLON.PBRMaterial('bgm', scene); bm.albedoColor = bg; bm.roughness = 1; bm.metallic = 0; bm.environmentIntensity = 0.6; cyc.material = bm; back.material = bm; cyc.receiveShadows = true;
    const key = new BABYLON.DirectionalLight('key', new V3(0.55, -0.75, 0.9), scene); key.intensity = 2.1; key.diffuse = new BABYLON.Color3(1, 0.93, 0.85); key.position = new V3(-6, 9, -9);
    const rim = new BABYLON.DirectionalLight('rim', new V3(-0.6, -0.35, -0.75), scene); rim.intensity = 1.4; rim.diffuse = new BABYLON.Color3(1, 0.85, 0.7);
    const fill = new BABYLON.HemisphericLight('fill', new V3(0, 1, -0.4), scene); fill.intensity = 0.4; fill.groundColor = new BABYLON.Color3(0.45, 0.35, 0.3);
    const sg = new BABYLON.ShadowGenerator(2048, key); sg.usePercentageCloserFiltering = true; sg.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH; sg.bias = 0.0015; sg.normalBias = 0.01; sg.darkness = 0.55;
    key.shadowMinZ = 1; key.shadowMaxZ = 30;
    const chars = [];
    for (let i = 0; i < who.length; i++) {
      const look = await (await fetch(who[i] + '.json?v=' + Date.now())).json();
      const c = CC.build(scene, look, outs[i] || 0); chars.push(c);
      if (!Q.get('nosh')) c.meshes.forEach(m => sg.addShadowCaster(m));
    }
    const cam = new BABYLON.UniversalCamera('cam', new V3(0, 1, -5), scene); cam.minZ = 0.05; scene.activeCamera = cam;
    const p = new BABYLON.DefaultRenderingPipeline('pipe', true, scene, [cam]); p.samples = 4; p.fxaaEnabled = true; p.imageProcessingEnabled = true;
    p.imageProcessing.toneMappingEnabled = true; p.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES; p.imageProcessing.exposure = +Q.get('exp') || 0.88; p.imageProcessing.contrast = 1.18;
    p.bloomEnabled = true; p.bloomThreshold = 0.9; p.bloomWeight = 0.15;
    p.imageProcessing.vignetteEnabled = true; p.imageProcessing.vignetteWeight = 1.2;
    window.view = (name, a) => {
      a = a || {};
      if (chars.length > 1) { chars.forEach((c, i) => { c.root.position.x = (i - (chars.length - 1) / 2) * (a.gap || 0.62); c.root.rotation.y = (a.rots || [])[i] || 0; }); }
      const c = chars[0], h = c.root.scaling.y;
      if (chars.length === 1) c.root.rotation.y = a.rot || 0;
      if (name === 'full') { cam.fov = 0.32; cam.position = new V3(0, h * 0.55, -h * 3.6); cam.setTarget(new V3(0, h * 0.5, 0)); }
      if (name === 'portrait') { cam.fov = 0.3; const y = h * 0.86; cam.position = new V3(a.cx || 0, y + 0.03, -1.45); cam.setTarget(new V3(0, y - 0.01, 0)); }
      if (name === 'face') { cam.fov = 0.12; const y = h * 0.9; cam.position = new V3(0, y, -1.3); cam.setTarget(new V3(0, y - 0.005, 0)); }
      if (name === 'bust') { cam.fov = 0.3; cam.position = new V3(0, h * 0.9, -2.0); cam.setTarget(new V3(0, h * 0.885, 0)); }
      if (name === 'lineup') { cam.fov = 0.34; cam.position = new V3(0, 0.98, -6.3); cam.setTarget(new V3(0, 0.9, 0)); }
      if (name === 'pair') { cam.fov = 0.34; cam.position = new V3(0, 0.9, -4.6); cam.setTarget(new V3(0, 0.85, 0)); }
      if (name === 'custom') { cam.fov = a.fov; cam.position = new V3(...a.pos); cam.setTarget(new V3(...a.tgt)); }
      for (let i = 0; i < 3; i++) scene.render(); return 1;
    };
    window.snap = (type) => { scene.render(); return canvas.toDataURL(type || 'image/jpeg', 0.9); };
    window.view('full');
    let n = 0; const tick = () => { scene.render(); n++; if ((scene.isReady() && n > 8) || n > 80) { window.__ready = true; return; } setTimeout(tick, 30); }; tick();
  } catch (e) { window.__err.push('boot ' + e.message + ' ' + e.stack); window.__ready = 'error'; }
})();
