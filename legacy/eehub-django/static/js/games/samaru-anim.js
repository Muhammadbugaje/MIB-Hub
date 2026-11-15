/* Freshers School Life — characters: the jointed cartoon figure and everything it does with its body.
   samaru-3d.js calls Z.anim.init(THREE, helpers) once and gets back { rig, pose }.
   The figure faces +x; limbs swing about z (positive = forward), y is up, +z is its right-hand side.
   Locomotion is driven by the ground speed the figure is really covering, and the stride phase advances by
   distance, so feet keep pace with the ground. Everything else (sit, ride, jump, punch, hit...) is a pose
   layered over that with an eased weight, so nothing snaps; every change of body state (sitting down, falling,
   getting up, getting on or off a machine) plays an authored transition clip, described further down.
   Nothing here runs at load time except building those clip tables (plain data). */
(function () {
  "use strict";
  var Z = window.SamaruGame, A = Z.anim = {}, TAU = Math.PI * 2, NOO = {};
  /* gait tables, keyed by gait: stand, stroll, the player's walk, flat-out sprint. The two top speeds come from
     SamaruSim.FOOT when it exists, and the stride lengths follow them, so a faster sprint still plants its feet. */
  var KV = [0, .45, 1, 2], FT = { walk: 3.5, run: 6.4 }, G = {
    step: [.5, .7, 1.05, 1.75],   // metres covered per footfall: worked out from the swing below (see feet()), so feet stay planted
    hip: [0, .38, .53, .8],       // thigh swing: the swing plus the carry stays within 35 degrees walking, 50 degrees flat out
    hof: [0, .03, .07, .07],      // thigh carried forward
    sk: [1, 1.48, 1.48, 1.56],             // stride calibration against the measured stance foot (games/tests/samaru_anim.js feet_*)
    ksw: [0, .7, .95, 1.8],       // knee fold while the leg swings through
    k0: [.04, .08, .14, .3],      // knee never quite straight
    arm: [0, .34, .55, 1.0],      // shoulder swing
    aof: [0, 0, -.05, -.18],      // arms carried a little behind when pumping
    el: [.12, .22, .5, 1.5],      // elbow bend
    out: [.07, .07, .1, .2],      // elbows away from the ribs
    lean: [0, -.03, -.09, -.3],   // forward lean
    bw: [0, .022, .02, 0],        // walk bob: tallest with the legs passing
    br: [0, 0, .028, .085],       // run bob: tallest in flight, legs split
    tw: [0, .09, .14, .3],        // chest counter-rotation
    sway: [0, .035, .03, .02]     // hip roll
  };
  /* the ground a planted foot covers per footfall is the chord of the thigh swing: 2 L cos(carry) sin(swing), L the leg (.84 rig units) */
  function feet() { var F = (window.SamaruSim || {}).FOOT; if (F && F.walk > 0 && F.run > F.walk) { FT.walk = F.walk; FT.run = F.run; } for (var i = 1; i < 4; i++) G.step[i] = 2 * .84 * Math.cos(G.hof[i]) * Math.sin(G.hip[i]) * G.sk[i]; }
  A.G = G; // for the calibration test
  function key(a, v) { if (v >= KV[3]) return a[3]; for (var i = 1; i < 4; i++) if (v <= KV[i]) return a[i - 1] + (a[i] - a[i - 1]) * (v - KV[i - 1]) / (KV[i] - KV[i - 1]); return a[3]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function wrap(a) { return ((a + Math.PI * 3) % TAU + TAU) % TAU - Math.PI; }
  /* 0 idle … 1 walk … 2 sprint, continuous */
  A.gait = function (v) { feet(); return v <= FT.walk ? Math.max(0, v) / FT.walk : Math.min(2, 1 + (v - FT.walk) / (FT.run - FT.walk)); };
  A.KEYS = ["hL", "kL", "fL", "hR", "kR", "fR", "sL", "eL", "sR", "eR", "xL", "xR", "lean", "roll", "twist", "bend", "y", "fwd", "side", "nod", "look", "yL", "yR"]; // yL/yR: the shoulder turning the arm across the body or out (reaching sideways)

  A.init = function (T, h) {
    var geo = h.geo, mat = h.mat, box = h.box, hex = h.hex, R = h.R, K = A.KEYS, mats = {};
    function sm(col) { return mats[col] || (mats[col] = new T.MeshLambertMaterial({ color: col })); } // smooth-shaded, one per colour
    function cap(r, len) { var k = "c" + r + "," + len; return geo[k] || (geo[k] = new T.CapsuleGeometry(r, len, 5, 14)); }
    function ball(r) { var k = "s" + r; return geo[k] || (geo[k] = new T.SphereGeometry(r, 18, 12)); }
    function put(parent, g, col, x, y, z, o) { var m = new T.Mesh(g, o ? mat(col, o) : sm(col)); m.position.set(x || 0, y || 0, z || 0); parent.add(m); return m; }
    function grp(parent, x, y, z) { var g = new T.Group(); g.position.set(x || 0, y || 0, z || 0); parent.add(g); return g; }
    function shade(g) { g.traverse(function (o) { if (o.isMesh && !o.material.transparent) o.castShadow = true; }); }
    var PANTS = [0x1f2937, 0x1e3a5f, 0x3b2f2f, 0x374151, 0x26324a], SHOES = [0xf8fafc, 0x111827, 0xdc2626, 0x2563eb, 0xf59e0b];

    /* What a character wears comes from the wardrobe (samaru-wardrobe.js): W.spec(look, mode) says which colours,
       prints, shells and extras to draw. The skeleton below is unchanged; only its clothing differs. */
    function cm(c) { // a plain colour or a print → a shared material
      if (typeof c === "number") return sm(c); c = c || "#888888"; var W = Z.wardrobe;
      if (c.indexOf("|") < 0) return sm(hex(c)); if (!W || R.quality === "low") return sm(hex(c.split("|")[1]));
      return mats[c] || (mats[c] = new T.MeshLambertMaterial({ map: W.tex(T, c) }));
    }
    function pm(parent, g, c, x, y, z) { var m = new T.Mesh(g, cm(c)); m.position.set(x || 0, y || 0, z || 0); parent.add(m); return m; }
    function cyl(rt, rb, h, n) { var k = "wy" + rt + "," + rb + "," + h + "," + (n || 16); return geo[k] || (geo[k] = new T.CylinderGeometry(rt, rb, h, n || 16)); }
    function tor(rad, tube, seg) { var k = "wt" + rad + "," + tube + "," + (seg || 20); return geo[k] || (geo[k] = new T.TorusGeometry(rad, tube, 6, seg || 20)); }
    function prim(c) { return hex(String(c).indexOf("|") < 0 ? c : String(c).split("|")[1]); }
    function shoeOn(ft, sp, skin) {
      var k = sp.shoe.kind, c = sp.shoe.c, sole = sp.shoe.trim || (k === "low" || k === "high" || k === "footy" ? (prim(c) === 0xf8fafc || prim(c) === 0xffffff ? "#cbd5e1" : "#f1f5f9") : "#1f2937");
      if (k === "sandal" || k === "slipper") { var f = put(ft, cap(.062, .15), skin, .075, -.02); f.rotation.z = Math.PI / 2; f.scale.set(.7, 1, 1.05); pm(ft, box(.3, .035, .16), c, .075, -.062); pm(ft, box(.05, .075, .17), c, .11, -.012); if (k === "sandal") pm(ft, box(.03, .06, .17), c, -.03, -.01); return; }
      var sh = pm(ft, cap(.07, .15), c, .075, -.012); sh.rotation.z = Math.PI / 2; sh.scale.set(k === "flat" || k === "heel" || k === "loafer" ? .66 : .82, 1, 1.12);
      pm(ft, box(.3, k === "boot" ? .05 : .035, .16), sole, .075, -.062);
      if (k === "high") pm(ft, cap(.068, .05), c, 0, .05); else if (k === "boot") pm(ft, cap(.074, .12), c, 0, .09); else if (k === "heel") pm(ft, box(.07, .06, .1), sole, -.04, -.085); else if (k === "footy") [-.02, .15].forEach(function (x) { pm(ft, box(.03, .03, .13), "#111827", x, -.09); });
    }
    function hairOn(r, sp, hair, capped) {
      var st = sp.hair, dome = geo.dome || (geo.dome = new T.SphereGeometry(.28, 18, 10, 0, TAU, 0, 1.2)), i, a;
      if (st === "bald") return;
      if (capped) { if (st !== "fade") put(r.head, dome, hair, -.02, .3); if (st === "braids" || st === "locs" || st === "braidshort" || st === "ponytail") for (i = -2; i <= 2; i++) put(r.head, cap(.03, st === "braids" ? .36 : .2), hair, -.25 - Math.abs(i) * .005, st === "braids" ? .12 : .22, i * .09); return; }
      if (st === "afro" || st === "afrobig") { var big = st === "afrobig"; put(r.head, geo["afro" + big] || (geo["afro" + big] = new T.IcosahedronGeometry(big ? .4 : .32, 3)), hair, big ? -.11 : -.09, big ? .52 : .46); }
      else if (st === "puff") { put(r.head, dome, hair, -.02, .31); put(r.head, geo.puff || (geo.puff = new T.IcosahedronGeometry(.2, 3)), hair, -.12, .66); }
      else if (st === "coily" || st === "twists") { var n = st === "coily" ? 22 : 16, rb = st === "coily" ? .075 : .085; put(r.head, dome, hair, -.02, .3); for (i = 0; i < n; i++) { a = i * 2.399; var cr = Math.sqrt((i + .5) / n), cy = Math.sqrt(1 - cr * cr * .86); put(r.head, ball(rb), hair, -.03 + Math.cos(a) * cr * .25, .31 + cy * .27, Math.sin(a) * cr * .25); } if (st === "twists") for (i = -2; i <= 2; i++) put(r.head, cap(.034, .1), hair, -.26, .26, i * .09); }
      else if (st === "cornrows") { put(r.head, dome, hair, -.02, .3); for (i = -2; i <= 2; i++) { a = i * .36; var cr2 = put(r.head, cap(.03, .24), hair, -.04, .31 + .275 * Math.cos(a), .275 * Math.sin(a)); cr2.rotation.z = Math.PI / 2 - .25; } }
      else if (st === "bun") { put(r.head, dome, hair, -.02, .31); put(r.head, ball(.12), hair, -.2, .6); }
      else if (st === "ponytail") { put(r.head, dome, hair, -.02, .31); put(r.head, ball(.085), hair, -.28, .44); put(r.head, cap(.055, .2), hair, -.33, .24).rotation.z = -.2; }
      else { var dm = put(r.head, st === "fade" ? (geo.fade || (geo.fade = new T.SphereGeometry(.278, 18, 10, 0, TAU, 0, .95))) : dome, hair, -.02, .31); dm.rotation.z = .18;
        if (st === "waves" && R.quality !== "low") for (i = 0; i < 3; i++) { var wv = put(r.head, tor(.2 - i * .055, .012, 16), hair, -.03, .47 + i * .045); wv.rotation.x = Math.PI / 2; wv.scale.set(1, 1, .6); }
        if (st === "braids" || st === "locs" || st === "braidshort") for (i = -2; i <= 2; i++) put(r.head, cap(st === "locs" ? .038 : .03, st === "braids" ? .36 : .2), hair, -.25 - Math.abs(i) * .005, st === "braids" ? .12 : .22, i * .09); }
    }
    function headOn(r, hw) {
      var k = hw.kind, c = hw.c, m;
      if (k === "kufi") pm(r.head, cyl(.2, .235, .2), c, -.01, .55);
      else if (k === "fila") { m = pm(r.head, cyl(.21, .24, .24), c, -.01, .56); m.rotation.x = .22; pm(r.head, ball(.1), c, -.02, .6, .16).scale.set(1, .7, 1); }
      else if (k === "zanna") pm(r.head, cyl(.19, .238, .3), c, -.01, .6);
      else if (k === "baseball") { m = pm(r.head, geo.dome, c, -.01, .33); m.scale.setScalar(1.05); pm(r.head, box(.22, .022, .3), c, .31, .45); pm(r.head, ball(.025), c, -.01, .625); }
      else if (k === "bucket") { pm(r.head, cyl(.215, .25, .17), c, -.01, .54); pm(r.head, cyl(.3, .37, .05), c, -.01, .455); }
      else if (k === "beanie") { m = pm(r.head, geo.dome, c, -.015, .34); m.scale.set(1.06, 1.1, 1.06); pm(r.head, tor(.262, .03), c, -.015, .42).rotation.x = Math.PI / 2; pm(r.head, ball(.05), c, -.015, .665); }
      else if (k === "turban") { m = pm(r.head, ball(.3), c, -.03, .47); m.scale.set(1, .66, 1); m = pm(r.head, tor(.235, .075), c, -.03, .44); m.rotation.x = Math.PI / 2; pm(r.head, cap(.05, .16), c, -.28, .28).rotation.z = -.2; }
      else if (k === "gele") { m = pm(r.head, ball(.295), c, -.04, .4); m.scale.set(1, .8, 1); m = pm(r.head, cyl(.36, .2, .3, 12), c, -.07, .64); m.scale.set(.6, 1, 1.12); m.rotation.z = .18; m = pm(r.head, box(.05, .3, .56), c, -.14, .72); m.rotation.z = .5; }
      else if (k === "hijab" || k === "hijablong") { m = pm(r.head, ball(.31), c, -.045, .31); m.scale.set(1, 1.06, 1.02); pm(r.head, cyl(.2, .36, .34), c, -.02, -.06); if (k === "hijablong") pm(r.head, cyl(.3, .4, .34), c, -.02, -.3).scale.set(.8, 1, 1.1); }
      else if (k === "scarf") { m = pm(r.head, ball(.298), c, -.06, .35); m.scale.set(1, .95, 1); pm(r.head, ball(.07), c, -.33, .2); }
      else if (k === "grad") { pm(r.head, cyl(.2, .225, .1), c, -.01, .55); pm(r.head, box(.5, .025, .5), c, -.01, .615); pm(r.head, cap(.012, .14), "#fde047", .2, .53, .2); }
    }
    function glassesOn(r, e) {
      var k = e.kind, c = e.c, rad = k === "reading" ? .042 : k === "aviator" ? .064 : .055, y = k === "reading" ? .33 : .345, g = k === "square" ? (geo.sqf || (geo.sqf = new T.TorusGeometry(.066, .011, 4, 4))) : tor(rad, .01, 16);
      [-1, 1].forEach(function (s) { var f = pm(r.head, g, c, .268, y, s * .1); f.rotation.y = Math.PI / 2; if (k === "square") f.rotation.x = Math.PI / 4; if (k === "aviator") f.scale.set(1, .88, 1);
        if (k === "sun") { var d = new T.Mesh(geo.lens || (geo.lens = new T.CircleGeometry(.054, 14)), mat(0x0b0f19, "b")); d.rotation.y = Math.PI / 2; d.position.set(.27, y, s * .1); r.head.add(d); }
        pm(r.head, box(.26, .012, .012), c, .14, y + .01, s * .168); });
      pm(r.head, box(.012, .012, .09), c, .272, y + .012, 0);
    }
    function extrasOn(r, sp) {
      sp.acc.forEach(function (a) { var k = a.kind, c = a.c, m;
        if (k === "chain" || k === "beads") { m = pm(r.chest, tor(k === "beads" ? .14 : .13, k === "beads" ? .024 : .012), c, .035, .5); m.rotation.x = Math.PI / 2; m.rotation.y = .42; }
        else if (k === "watch") { m = pm(r.aL.el, tor(.062, .016, 12), c, 0, -.25); m.rotation.x = Math.PI / 2; pm(r.aL.el, cyl(.03, .03, .02, 10), "#e5e7eb", 0, -.25, -.066).rotation.x = Math.PI / 2; }
        else if (k === "bracelet") pm(r.aR.el, tor(.064, .012, 12), c, 0, -.25).rotation.x = Math.PI / 2;
        else if (k === "backpack") { pm(r.chest, box(.17, .38, .34), c, -.25, .24); pm(r.chest, box(.05, .16, .24), "#111827", -.345, .16); [-1, 1].forEach(function (s) { pm(r.chest, box(.34, .04, .05), c, -.02, .47, s * .15); }); }
        else if (k === "tote") { pm(r.chest, box(.07, .28, .3), c, 0, -.12, .37); pm(r.chest, box(.03, .56, .03), c, 0, .2, .33); }
        else if (k === "tasbih") pm(r.aR.el, tor(.05, .009, 14), c, .03, -.36).rotation.y = Math.PI / 2;
        else if (k === "lanyard") { m = pm(r.chest, tor(.13, .007), c, .05, .44); m.rotation.x = Math.PI / 2; m.rotation.y = .6; pm(r.chest, box(.012, .09, .065), "#f8fafc", .172, .27); }
      });
    }

    function rig(look, mode, opt) {
      opt = opt || {};
      var sp = (Z.wardrobe && Z.wardrobe.spec(look, mode)) || { skin: look.skin, hair: look.hair || "low", hairCol: look.hairCol || "#1a1210", torso: look.top, sleeves: "short", collar: "ring", legs: "#1f2937", shoe: { kind: "low", c: "#f8fafc" }, acc: [], front: "" };
      var g = new T.Group(), skin = hex(sp.skin), hair = hex(sp.hairCol), low = R.quality === "low", sh = sp.shell, body = sh && sh.k !== "tunic";
      var seed = (skin * 7 + prim(sp.torso) * 13 + hair) >>> 0, legC = sp.legs, lowC = sp.shorts ? skin : sp.legs, ac = sp.sleeveC || sp.torso, trim = sp.trim || "#f8fafc";
      var r = { g: g, c: {}, w: {}, ph: (seed % 628) / 100, seed: (seed % 100) / 10, v: 0, av: 0, a: 0 };
      r.body = grp(g);
      /* hips and legs */
      r.hips = grp(r.body);
      pm(r.hips, ball(.2), body ? prim(sh.c) : legC, 0, .96).scale.set(.82, .7, 1.14);
      function leg(z) {
        var hp = grp(r.hips, 0, .92, z); pm(hp, cap(.1, .24), legC, 0, -.21);
        var kn = grp(hp, 0, -.44, 0); pm(kn, ball(.092), legC, 0, 0); pm(kn, cap(.078, .22), lowC, 0, -.19); put(kn, cap(.06, .04), skin, 0, -.36);
        var ft = grp(kn, 0, -.4, 0); shoeOn(ft, sp, skin);
        return { hp: hp, kn: kn, ft: ft };
      }
      r.lL = leg(-.115); r.lR = leg(.115);
      /* gowns, kaftans, skirts and long tops: one shell on the hips. It leans and widens with the stride, and gathers
         up when both thighs lift (sitting, riding) so the legs carry the cloth instead of poking through it. */
      function shell(s, wide) {
        var len = s.len, top0 = 1.02, m = pm(r.hips, cyl(.2, +(.2 + len * (s.k === "tunic" ? .1 : .2)).toFixed(3), len, 16), s.c, 0, top0 - len / 2), sx = .86 * (wide || 1);
        m.scale.set(sx, 1, 1.2);
        var rb = .2 + len * (s.k === "tunic" ? .1 : .2), fs = {}, fo = {}; m.userData.cloth = 1;
        /* swung from the waist with a little lag, flared just enough that the legs stay inside it (A.shellFit); seated it drapes over the thighs */
        m.onBeforeRender = function () { A.shellFit(r.lL.hp.rotation.z, r.lL.kn.rotation.z, r.lR.hp.rotation.z, r.lR.kn.rotation.z, len, rb, sx, fs, r.dtA || .016, fo); var hh = len * fo.sy / 2;
          this.rotation.z = fo.th; this.scale.set(fo.sx, fo.sy, 1.2); this.position.set(Math.sin(fo.th) * hh, top0 - Math.cos(fo.th) * hh, 0); };
        return m;
      }
      if (sh) r.shell = shell(sh, sh.open ? 1.04 : 1); if (sp.tunic2) shell({ k: "tunic", c: sp.tunic2.c, len: sp.tunic2.len }, 1.05);
      /* chest, turning on the waist */
      r.chest = grp(r.body, 0, 1.0, 0);
      r.torso = pm(r.chest, cap(.19, .3), sp.torso, 0, .25); r.torso.scale.set(.84, 1, 1.26);
      pm(r.chest, ball(.1), ac, 0, .5, -.27); pm(r.chest, ball(.1), ac, 0, .5, .27);
      if (sp.open) { pm(r.chest, box(.06, .46, .2), sp.open, .15, .24); if (sp.front === "lapel") [-1, 1].forEach(function (s) { var lp = pm(r.chest, box(.02, .3, .06), sp.torso, .172, .36, s * .1); lp.rotation.x = s * .3; }); }
      if (sp.front === "jersey") { put(r.chest, box(.33, .3, .2), 0xffffff, 0, .26); put(r.chest, box(.34, .05, .5), 0xffffff, 0, .06, 0, "t"); }
      else if (sp.front === "buttons" || sp.front === "zip") { if (sp.front === "zip") pm(r.chest, box(.012, .44, .016), "#e5e7eb", .166, .26); else for (var bi = 0; bi < 4; bi++) pm(r.chest, ball(.016), sp.trim || "#f8fafc", .163, .44 - bi * .105); if (sp.trim) pm(r.chest, box(.012, .46, .05), sp.trim, .158, .25); }
      else if (sp.front === "frogs") for (var fi = 0; fi < 3; fi++) pm(r.chest, box(.014, .018, .13), "#fde047", .165, .42 - fi * .12);
      else if (sp.front === "stole") [-1, 1].forEach(function (s) { pm(r.chest, box(.03, .62, .075), trim, .16, .18, s * .09); });
      else if (sp.front === "yoke") pm(r.chest, box(.03, .2, .14), "#f8fafc", .158, .42);
      else if (sp.front === "pocket") pm(r.chest, box(.02, .1, .26), ac, .165, .08);
      else if (sp.trim && !sp.open) pm(r.chest, box(.012, .44, .03), sp.trim, .164, .26);
      if (sp.text && !low && Z.wardrobe) { var tp = new T.Mesh(geo.txtp || (geo.txtp = new T.PlaneGeometry(.4, .1)), mats["tx" + sp.text + sp.torso] || (mats["tx" + sp.text + sp.torso] = new T.MeshBasicMaterial({ map: Z.wardrobe.textTex(T, sp.text, sp.torso), transparent: true, depthWrite: false }))); tp.rotation.y = Math.PI / 2; tp.position.set(.172, .34, 0); r.chest.add(tp); } // your own words on a custom shirt
      if (sp.wings) { var wg = pm(r.chest, ball(.3), sp.torso, -.01, .16); wg.scale.set(.66, 1.28, 1.78); pm(r.chest, box(.03, .3, .22), trim === "#f8fafc" ? "#fde047" : trim, .175, .36); }
      var cl = sp.collar;
      if (cl === "ring" || cl === "polo" || cl === "thick") { pm(r.chest, cl === "thick" ? tor(.09, .035, 14) : (geo.collar || (geo.collar = new T.TorusGeometry(.085, .022, 6, 14))), cl === "thick" ? sp.torso : sp.open ? sp.open : (sp.trim || "#f8fafc"), 0, .545).rotation.x = Math.PI / 2; if (cl === "polo") pm(r.chest, box(.02, .12, .05), sp.trim || "#f8fafc", .165, .47); }
      else if (cl === "shirt") [-1, 1].forEach(function (s) { var cc = pm(r.chest, box(.09, .03, .1), sp.torso, .09, .555, s * .07); cc.rotation.y = s * .5; cc.rotation.z = -.3; });
      else if (cl === "mandarin") pm(r.chest, cyl(.088, .1, .065, 14), sp.torso, 0, .565);
      else if (cl === "hood") { var hd0 = pm(r.chest, ball(.15), sp.torso, -.13, .54); hd0.scale.set(.8, .9, 1.1); pm(r.chest, tor(.1, .03, 14), sp.torso, 0, .545).rotation.x = Math.PI / 2; }
      else if (cl === "wrap") { var wr = pm(r.chest, box(.02, .44, .06), sp.trim || "#f8fafc", .166, .32); wr.rotation.x = .55; }
      else if (cl === "v") pm(r.chest, box(.02, .09, .09), skin, .16, .5).rotation.x = Math.PI / 4;
      put(r.chest, cap(.066, .08), skin, 0, .58);
      /* head: a big friendly one with a proper face */
      r.head = grp(r.chest, 0, .56, 0);
      var hd = put(r.head, ball(.27), skin, 0, .3); hd.scale.set(.96, 1.04, .94);
      put(r.head, ball(.055), skin, 0, .29, -.255); put(r.head, ball(.055), skin, 0, .29, .255);
      var ey = sp.eyes === "wide" ? [.7, 1.3, 1.05] : sp.eyes === "calm" ? [.6, .78, .95] : [.6, 1.1, .9], brow = sp.brow === "arch" ? .42 : .12, capped = !!(sp.head && !sp.hideHair);
      r.eyes = []; [-1, 1].forEach(function (s) { var e = put(r.head, ball(.052), 0xffffff, .222, .345, s * .1); e.scale.set(ey[0], ey[1], ey[2]); var pu = put(r.head, ball(.03), 0x1a1210, .25, .34, s * .1); r.eyes.push(e, pu); var bw = put(r.head, box(.02, sp.brow === "thick" ? .03 : .018, .085), hair, .25, .425, s * .1); bw.rotation.x = s * brow; });
      put(r.head, ball(.04), skin, .27, .27); var mo = put(r.head, box(.02, .028, .12), 0x7a1f1f, .252, .185); mo.rotation.x = 0;
      if (sp.beard === "moustache" || sp.beard === "full") put(r.head, box(.022, .032, .16), hair, .262, .228);
      if (sp.beard === "goatee") put(r.head, ball(.055), hair, .2, .075).scale.set(1, 1.2, 1); else if (sp.beard === "full") put(r.head, ball(.2), hair, .035, .125).scale.set(1, .92, 1.02);
      if (!sp.hideHair) hairOn(r, sp, hair, capped);
      if (sp.head) headOn(r, sp.head);
      if (sp.eye && !low) glassesOn(r, sp.eye);
      if (opt.hat) { put(r.head, geo.brim || (geo.brim = new T.CylinderGeometry(.42, .42, .05, 18)), 0x1a1228, 0, .56); put(r.head, geo.hat || (geo.hat = new T.CylinderGeometry(.25, .27, .55, 18)), 0x2a1f3d, 0, .84); put(r.head, ball(.045), 0xff3355, .25, .34, -.1, "b"); put(r.head, ball(.045), 0xff3355, .25, .34, .1, "b"); }
      /* arms */
      function arm(z) {
        var lg = sp.sleeves !== "short", shd = grp(r.chest, 0, .5, z); if (lg) pm(shd, cap(.068, .22), ac, 0, -.16); else { put(shd, cap(.068, .22), skin, 0, -.16); pm(shd, cap(.084, .07), ac, 0, -.07); }
        var el = grp(shd, 0, -.32, 0); if (lg) { pm(el, ball(.066), ac, 0, 0); pm(el, cap(.058, .2), ac, 0, -.14); } else { put(el, ball(.066), skin, 0, 0); put(el, cap(.058, .2), skin, 0, -.14); }
        put(el, ball(.074), skin, .005, -.31).scale.set(1, 1.18, .8);
        if (sp.sleeves === "wide") pm(el, cyl(.075, .135, .25, 12), ac, 0, -.14).userData.cloth = 1;
        return { sh: shd, el: el };
      }
      r.aL = arm(-.3); r.aR = arm(.3);
      if (!low) extrasOn(r, sp);
      r.torch = put(r.aR.el, box(.22, .07, .07), 0xfde047, .08, -.34, 0, "b"); r.torch.visible = false;
      /* a phone in the right palm, screen towards the face (samaru-phone.js: o.phoneK 0 away … 1 held; o.film) */
      r.phone = grp(r.aR.el, .05, -.4, 0); put(r.phone, box(.024, .23, .115), 0x0f172a); put(r.phone, box(.006, .2, .096), 0x93c5fd, .014, .004, 0, "b"); r.phone.visible = false; // cartoon scale, like the big heads
      r.shadow = new T.Mesh(geo.blob || (geo.blob = new T.CircleGeometry(.5, 16)), mat(0x000000, "t")); r.shadow.rotation.x = -Math.PI / 2; r.shadow.position.y = .08; g.add(r.shadow);
      if (look.glow) { var au = new T.Mesh(geo.aura || (geo.aura = new T.RingGeometry(.42, .95, 32)), mats["aura" + look.glow] || (mats["aura" + look.glow] = new T.MeshBasicMaterial({ color: hex(look.glow), transparent: true, opacity: .6, depthWrite: false, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }))); au.rotation.x = -Math.PI / 2; au.position.y = .16; au.renderOrder = 3; g.add(au); } // the Maker's gold ring on the ground
      g.scale.setScalar(opt.scale || 1.08); r.s0 = g.scale.x; g.userData.rig = r; shade(g);
      try { g.updateMatrixWorld(true); var hb = new T.Box3().setFromObject(r.head), hp = new T.Vector3(); r.hips.getWorldPosition(hp); r.hTop = Math.max(.5, (hb.max.y - hp.y) / g.scale.y - .92); } /* the body origin sits .92 below the hip joint (see seated) */ catch (e) { r.hTop = 0; } // head and hair top above the hips, for fitting under a roof
      return g;
    }

    var q = {}, o2 = {};
    /* debug view (Z.anim.setDebug(true), or ?animdebug in the address): limbs and body solid red, cloth layers see-through blue,
       so a leg or arm poking through clothing shows at once */
    var DBG = null; function debugPaint(g, on) { if (!DBG) DBG = { body: new T.MeshBasicMaterial({ color: 0xdc2626 }), cloth: new T.MeshBasicMaterial({ color: 0x2563eb, transparent: true, opacity: .45, depthWrite: false }) };
      g.traverse(function (m) { if (!m.isMesh || m === g.userData.rig.shadow) return; if (on) { if (!m.userData.m0) m.userData.m0 = m.material; m.material = m.userData.cloth ? DBG.cloth : DBG.body; } else if (m.userData.m0) m.material = m.userData.m0; }); }
    if (A.debug == null) try { A.debug = /animdebug/.test(window.location.search); } catch (e) { A.debug = false; }
    /* Riding: the machine says where the saddle, grips and pedals are (in its own space); the figure is solved to
       them. Hips go on the seat, each leg and arm is a two-bone reach in the fore-aft plane, and the back leans
       only as far as the hands need. Returns pose keys. */
    function reach(dx, dy, l1, l2, out) { var d = Math.min(Math.max(Math.hypot(dx, dy), .06), (l1 + l2) * .995), phi = Math.atan2(dx, -dy); out[0] = phi; out[1] = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)); out[2] = Math.PI - Math.acos(clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1)); return Math.hypot(dx, dy); }
    var RC = [0, 0, 0];
    function seated(r, an, st, vs) {
      var role0 = st.pil && an.pillion ? an.pillion : an, roof = role0.roof || (role0 !== an ? an.roof : 0), base = (r.s0 || 1.08) * (an.scale || 1); r.fit = roof && r.hTop ? clamp((roof - role0.seat[1]) / (r.hTop * base), .6, 1) : 1; // under a roof a tall figure (or a big afro) is drawn a little smaller so the head stays inside
      var sc = base * r.fit, role = role0, seat = role.seat, p = {}, up = st.sprint && an.pedal ? 1 : 0, i, k;
      var hx = seat[0] / sc + up * .1, hy = seat[1] / sc + up * .12, lean = (role.lean == null ? -.12 : role.lean) - (st.tuck ? .2 : 0) - up * .16 - Math.min(.1, vs * (an.tuck || 0)), bend = role.bend == null ? -.06 : role.bend, grip = role === an ? an.grip : role.grip, wh = role === an && !st.pil && an.wheel && an.wheel.c ? an.wheel : null, foot = role.foot, mx = role.maxLean == null ? (an.maxLean == null ? lean - .25 : an.maxLean) : role.maxLean, sx = 0, sy = 0, cl, sl, dx, dy;
      if (wh) grip = wh.c; // at the wheel: lean only as far as the rim needs
      if (grip) for (k = 0; k < 10; k++) { cl = Math.cos(lean); sl = Math.sin(lean); var cb = Math.cos(lean + bend), sb = Math.sin(lean + bend); sx = hx - .08 * sl - .5 * sb; sy = hy + .08 * cl + .5 * cb; if (Math.hypot(grip[0] / sc - sx, grip[1] / sc - sy) < .615 || lean <= mx) break; lean -= .05; }
      cl = Math.cos(lean); sl = Math.sin(lean); p.lean = lean; p.bend = bend; p.fwd = hx + .92 * sl; p.y = hy - .92 * cl; p.side = (role.side || 0) / sc; p.roll = 0; p.twist = 0; p.nod = -(lean + bend) * .3;
      if (!grip) { var cb0 = Math.cos(lean + bend), sb0 = Math.sin(lean + bend); sx = hx - .08 * sl - .5 * sb0; sy = hy + .08 * cl + .5 * cb0; } // the shoulders
      /* one hand to a point (rig units, the machine's space): two-bone reach in the body's plane, the arm swung out or in to the side */
      /* the arm turns at the shoulder toward the target (yaw), then the two bones reach it in that plane */
      function hand(L, tx, ty, tz) { var a2 = lean + bend, gx = tx - sx, gy = ty - sy, ex = gx * Math.cos(a2) + gy * Math.sin(a2), ey = -gx * Math.sin(a2) + gy * Math.cos(a2), ez = tz - p.side - (L ? -.3 : .3), rho = Math.max(.05, Math.hypot(ex, ez));
        reach(rho * (ex < 0 ? -1 : 1), ey, .32, .31, RC); var yw = clamp(Math.atan2(L ? -ez : ez, Math.abs(ex)), -1.2, 1.2);
        if (L) { p.sL = RC[0] - RC[1]; p.eL = RC[2]; p.xL = .08; p.yL = yw; } else { p.sR = RC[0] - RC[1]; p.eR = RC[2]; p.xR = .08; p.yR = yw; } }
      if (wh) { /* steering wheel: hands at ten to two on the rim, turning with it; past about 50 degrees they stop following and the
                   rim slides through them (shuffle steering: the hands never cross) */
        var wa = an.wheelA || 0, hr = clamp(wa, -.9, .9), slip = Math.abs(wa) - .9, rr = wh.r || .15;
        for (k = 0; k < 2; k++) { var ph0 = (k ? 1.05 : -1.05) + hr; hand(!k, wh.c[0] / sc - .02, (wh.c[1] + rr * Math.cos(ph0)) / sc + (slip > 0 ? Math.sin(slip * 9 + k * Math.PI) * .012 : 0), (wh.c[2] + rr * Math.sin(ph0)) / sc); } }
      else if (grip) { var gz = (grip[2] || .25) / sc; hand(true, grip[0] / sc, grip[1] / sc, p.side - gz); hand(false, grip[0] / sc, grip[1] / sc, p.side + gz); } // handlebar grips
      else if (role !== an && !(an.roof || an.door)) { var wx2 = (an.seat[0] + .08) / sc, wy2 = (an.seat[1] + .32) / sc; hand(true, wx2, wy2, p.side - .19); hand(false, wx2, wy2, p.side + .19); } // riding pillion: hold the rider's waist
      else { p.sL = p.sR = .5 - lean; p.eL = p.eR = .75; p.xL = p.xR = .06; p.yL = p.yR = 0; p.knees = 1; }
      for (i = 0; i < 2; i++) { var fx, fy;
        if (an.pedal && role === an) { var ca = (an.crankA || 0) + (i ? 0 : Math.PI); fx = (an.pedal.c[0] + Math.cos(ca) * an.pedal.r) / sc; fy = (an.pedal.c[1] + Math.sin(ca) * an.pedal.r) / sc + .075; }
        else if (foot) { fx = foot[0] / sc; fy = foot[1] / sc + .075; } else { fx = hx + .42; fy = hy - .36; }
        dx = (fx - hx) * cl + (fy - hy) * sl; dy = -(fx - hx) * sl + (fy - hy) * cl; reach(dx, dy, .44, .4, RC);
        var hh = RC[0] + RC[1], kk2 = -RC[2]; if (i) { p.hR = hh; p.kR = kk2; p.fR = clamp(-(hh + kk2) - lean, -.7, .9); } else { p.hL = hh; p.kL = kk2; p.fL = clamp(-(hh + kk2) - lean, -.7, .9); } }
      if (p.knees) { delete p.knees; for (i = 0; i < 2; i++) { var th2 = (i ? p.hR : p.hL) + lean; hand(!i, hx + .4 * Math.sin(th2), hy - .4 * Math.cos(th2) + .1, p.side + (i ? .15 : -.15)); } } // a passenger: hands resting on the knees
      return p;
    }
    function mix(p, w) { if (w <= .001) return; for (var k in p) q[k] += (p[k] - q[k]) * w; wpush(w); }
    /* upper-body actions (wave, phone, eat, torch, carry, filming): mixed like any layer, and remembered so that when a clip
       owns the body (sitting down, getting into a car) the arms and head still do them on top */
    var UB = [], UBN = 0, ARM = { sL: 1, sR: 1, eL: 1, eR: 1, xL: 1, xR: 1, nod: 1 };
    function ub(p, w) { mix(p, w); if (w > .001) { UB[UBN] = p; UB[UBN + 1] = w; UBN += 2; } }
    function ubOver() { for (var i = 0; i < UBN; i += 2) { var p = UB[i], w = UB[i + 1]; for (var k in p) if (ARM[k]) q[k] += (p[k] - q[k]) * w; } }
    /* st: { vel, z, vz, sit, ride, veh, vsp, stand, fall, air, dance, wave, torch, atk, combo, wind, throwT, tired, big, o }
       vel: ground speed if the caller knows it (else it is measured from how far the figure moved);
       atk: 0..1 progress of a strike, combo 0 jab / 1 cross / 2 kick; o: the entity, read for hitT/hitA/bumpT/bumpA. */
    function pose(g, x, y, a, st, t) {
      var r = g.userData.rig;
      /* far from the camera and just walking or standing: joints are re-solved every other frame (the body still moves every frame) */
      if (r.on && !r.near && !r.clip && r.mode === "stand" && st.ride == null && !st.fall && !st.sit && !(st.o && st.o.getUpT > 0) && t - r.last < .05 && ((Math.floor(t * 60) + (r.seed * 10 | 0)) & 1) && !nearCam(x, y, st)) {
        var rt0 = r.root; if (rt0) { rt0.x = x + (r.ox || 0); rt0.z = y + (r.oz || 0); g.position.set(rt0.x, rt0.y, rt0.z); } return; }
      var c = r.c, w = r.w, o = st.o || NOO, i, k, first = !r.on, dt = first ? .016 : clamp(t - r.last, .001, .1); r.on = 1; r.last = t; r.dtA = dt; WL.length = 0; WL.push(1); UBN = 0;
      if (r.snapGen == null) r.snapGen = A.snapGen; var snap = !first && (!!o.animSnap || r.snapGen !== A.snapGen); r.snapGen = A.snapGen; if (o.animSnap) o.animSnap = 0; // Z.anim.snap: straight to the end pose
      /* state blends: 95% done in 3/rate s, so rates of 15-20 are the 150-200 ms of MASTER_GAME_GUIDE 10.2, 24-30 in a fight; fatigue alone creeps in */
      function ease(n, target, rate) { return (w[n] = first || snap || w[n] == null ? target : w[n] + (target - w[n]) * (1 - Math.exp(-dt * rate))); }
      /* heading: the body turns toward where it is going rather than snapping, and remembers how fast it is turning */
      var riding = st.ride != null, down = st.fall > 0 || st.fall === true, gu = o.getUpT > 0 ? Math.min(1, o.getUpT) : 0, zz = st.z || 0;
      /* which body state: riding, down, getting up, sitting (on what), or on their feet */
      var sitK = !st.sit ? "" : st.sit === "chair" || st.sit === "bench" || zz > .05 ? "chair" : st.sit === "kneel" || o.act === "pray" ? "kneel" : "ground";
      if (sitK && !first && r.mode === "sit" && r.px != null && Math.hypot(x - r.px, y - r.py) / dt > .8 && Math.hypot(x - r.px, y - r.py) < 2) sitK = ""; // flagged as sitting but being moved along: stand and walk, never slide across the floor seated
      var mode = riding ? "ride" : down ? "fall" : gu > 0 ? "getup" : sitK ? "sit" : "stand", pm = first ? mode : r.mode || mode, near = nearCam(x, y, st); r.near = near;
      if (first || riding) { r.ra = first ? a : r.a; r.a = a; r.av = 0; } else { var da = wrap(a - r.a), kk = 1 - Math.exp(-dt * (r.clip ? 9 : 18)); r.a += da * kk; r.av += (da * kk / dt - r.av) * (1 - Math.exp(-dt * 9)); }
      /* ground speed (a change of state can move the entity in one jump: that is not speed) */
      var d = first || pm !== mode ? 0 : Math.hypot(x - r.px, y - r.py); r.px = x; r.py = y;
      var vt = riding || sitK || down || gu > 0 ? 0 : st.vel != null ? st.vel : o.spd != null ? Math.abs(o.spd) : d > 2.5 ? r.v : d / dt; vt = Math.min(vt, 14);
      var pv = r.v; r.v = first ? vt : r.v + (vt - r.v) * (1 - Math.exp(-dt * (vt > r.v ? 11 : 13))); if (r.v < .06 && vt < .06) r.v = 0;
      var v = r.v, acc = clamp((vt - v) * .035, -.14, .2), gt = A.gait(v);
      if (pv > FT.walk * 1.25 && vt < 1.2 && !(r.skid > 0) && !r.skidded) { r.skid = .3; r.skidded = 1; } if (vt > 2) r.skidded = 0; if (r.skid > 0) r.skid -= dt;
      r.ph += v * dt / (key(G.step, gt) * (r.s0 || 1.08)) * Math.PI; // a bigger figure takes longer strides
      var ph = r.ph, sn = Math.sin(ph), cs = Math.cos(ph), m = Math.min(1, v / 1.1), run = clamp(gt - 1, 0, 1), idle = 1 - m, s0 = r.seed;
      var hA = key(G.hip, gt), hO = key(G.hof, gt), kS = key(G.ksw, gt), k0 = key(G.k0, gt), aA = key(G.arm, gt), el = key(G.el, gt), swL = Math.max(0, Math.cos(ph + run * .5)), swR = Math.max(0, -Math.cos(ph + run * .5));
      /* locomotion: left leg leads on sin, right leg half a cycle later; arms oppose legs */
      q.hL = hO + sn * hA; q.hR = hO - sn * hA;
      q.kL = -(k0 + kS * Math.pow(swL, 1.25)) - Math.max(0, sn) * .1 * m; q.kR = -(k0 + kS * Math.pow(swR, 1.25)) - Math.max(0, -sn) * .1 * m;
      q.fL = clamp(-(q.hL + q.kL) * .7 + sn * .28 * m, -.75, .9); q.fR = clamp(-(q.hR + q.kR) * .7 - sn * .28 * m, -.75, .9);
      q.sL = key(G.aof, gt) - sn * aA; q.sR = key(G.aof, gt) + sn * aA;
      q.eL = el + Math.max(0, -sn) * (.25 + run * .3) + idle * Math.sin(t * 1.3 + s0) * .03; q.eR = el + Math.max(0, sn) * (.25 + run * .3) - idle * Math.sin(t * 1.3 + s0) * .03;
      q.xL = q.xR = key(G.out, gt) + idle * Math.sin(t * 1.7 + s0) * .02;
      q.lean = key(G.lean, gt) - acc; q.twist = sn * key(G.tw, gt) + idle * Math.sin(t * .45 + s0) * .05;
      q.roll = cs * key(G.sway, gt) + clamp(r.av * v * .03, -.34, .34);
      q.bend = run * -.06; q.side = 0; q.fwd = 0; q.look = 0; q.yL = q.yR = 0;
      q.y = (key(G.bw, gt) - key(G.br, gt)) * Math.cos(2 * ph) + key(G.br, gt) * .45 - run * .035 + idle * Math.sin(t * 2.1 + s0) * .006;
      q.nod = idle * Math.sin(t * .7 + s0) * .05 + run * .06;
      /* lean from the hips, not the ankles: the legs keep swinging about the vertical (so a leading foot is not tipped into the
         ground mid-swing) and the hips stay over the spot the figure stands on */
      q.hL -= q.lean; q.hR -= q.lean; q.fwd = .92 * Math.sin(q.lean);
      /* a footfall is the leading foot at the front of its swing (ph = pi/2 + n pi): the "step" event, for footstep sounds and dust */
      var fl = Math.floor((r.ph - HP) / Math.PI); if (r.pf != null && fl !== r.pf && v > .5 && mode === "stand" && zz <= 0 && EV.step) emit("step", { o: o, foot: fl & 1 ? "R" : "L", speed: v, run: gt > 1.3, x: x, y: y }); r.pf = fl;
      /* standing about: the weight settles on one leg for a few seconds, the other knee eases, then it moves across. Feet stay put. */
      if (idle > .01) { var wsh = clamp(Math.sin(t * .21 + s0 * 1.9) * 2.4, -1, 1) * idle, wl = Math.max(0, wsh), wr = Math.max(0, -wsh); q.roll += wsh * .03; q.twist += wsh * .035; q.y -= (wl + wr) * .008; q.hL += wl * .07; q.kL -= wl * .15; q.fL += wl * .08; q.hR += wr * .07; q.kR -= wr * .15; q.fR += wr * .08; }
      /* turning on the spot: small steps instead of skating round on planted feet */
      if (near && mode === "stand" && v < .5 && Math.abs(r.av) > .9) { var ts = clamp((Math.abs(r.av) - .9) / 1.5, 0, 1) * (1 - v / .5); r.tph = (r.tph || 0) + Math.min(4, Math.abs(r.av)) * dt * 2.4; var tsn = Math.sin(r.tph); q.hL += tsn * .2 * ts; q.hR -= tsn * .2 * ts; q.kL -= Math.max(0, Math.cos(r.tph)) * .45 * ts; q.kR -= Math.max(0, -Math.cos(r.tph)) * .45 * ts; q.y += Math.abs(Math.cos(r.tph)) * .01 * ts; }
      /* worn out or starving: shoulders drop, head hangs, the stride shortens */
      var tw = ease("tired", st.tired ? 1 : 0, 3); if (tw > .01) { q.lean -= .05 * tw; q.bend -= .08 * tw; q.nod -= .1 * tw; q.y -= .012 * tw; q.sL *= 1 - .3 * tw; q.sR *= 1 - .3 * tw; q.hL *= 1 - .12 * tw; q.hR *= 1 - .12 * tw; }
      /* braking hard out of a sprint: heels dig in, weight thrown back */
      if (r.skid > 0) { var sk = Math.sin(clamp(r.skid / .3, 0, 1) * Math.PI); mix({ hL: .62, kL: -.12, fL: .35, hR: -.3, kR: -.62, fR: -.2, lean: .3, y: -.1, sL: -.5, sR: -.3, xL: .7, xR: .7, eL: .5, eR: .5, twist: .25, nod: -.1 }, Math.min(1, sk * 1.3)); }
      /* in the air: stretch off the ground, tuck at the top, reach for the landing */
      var aw = ease("air", zz > 0 && !sitK ? 1 : 0, 26);
      if (aw > .01) { var u = clamp((st.vz == null ? 0 : st.vz) / 5.4, -1, 1), up = Math.max(0, u), dn = Math.max(0, -u), ap = 1 - Math.abs(u);
        o2.hL = up * -.2 + ap * 1.15 + dn * .45; o2.kL = up * -.12 + ap * -1.6 + dn * -.55; o2.hR = up * .15 + ap * .75 + dn * .1; o2.kR = up * -.5 + ap * -1.35 + dn * -.3; o2.fL = up * -.6 + dn * .25; o2.fR = up * -.6 + dn * .2;
        o2.sL = o2.sR = up * 2.7 + ap * 1.5 + dn * .5; o2.eL = o2.eR = up * .15 + ap * .9 + dn * .3; o2.xL = o2.xR = up * .25 + ap * .35 + dn * 1.05; o2.lean = up * -.12 + ap * -.2 + dn * -.05; o2.twist = 0; o2.nod = up * .15 - dn * .12; mix(o2, aw); o2 = {}; }
      if ((r.pz || 0) > .05 && zz === 0 && !r.wasSit) { r.land = .24; if (EV.land) emit("land", { o: o, soft: r.pz < .6, x: x, y: y }); } r.pz = zz; r.wasSit = !!sitK; if (r.land > 0) { r.land -= dt; var ld = Math.sin(clamp(r.land / .24, 0, 1) * Math.PI * .5); q.y -= .2 * ld; q.hL += .55 * ld; q.hR += .55 * ld; q.kL -= .95 * ld; q.kR -= .95 * ld; q.fL += .3 * ld; q.fR += .3 * ld; q.lean -= .16 * ld; q.sL -= .5 * ld; q.sR -= .5 * ld; q.xL += .3 * ld; q.xR += .3 * ld; }
      q.y += zz * 1.1;
      /* sitting on the ground or a bench */
      if (sitK) { r.sitK = sitK; r.seatZ = zz; } var SP = A.SITS[r.sitK || "chair"];
      /* a raised seat (a lecture tier: st.z is the seat surface, its row's floor 0.3 below): hips on the seat, the legs
         solved so the feet rest on that floor rather than hanging in the air or sinking through the tier */
      if (r.sitK === "chair" && r.seatZ > .05) { var sc0 = r.s0 || 1.08, PC = r.pc || (r.pc = {}), k3; for (k3 in SP) PC[k3] = SP[k3]; PC.lean = .04; PC.y = r.seatZ / sc0 - .77; var hy0 = PC.y + .92, fy = Math.max(0, r.seatZ - SEATH) / sc0 + .08, ddx = .4, ddy = fy - hy0; reach(ddx, ddy, .44, .4, RC); PC.hL = PC.hR = RC[0] + RC[1]; PC.kL = PC.kR = -RC[2]; PC.fL = PC.fR = clamp(-(PC.hL + PC.kL), -.6, .6); SP = PC; }
      mix(SP, ease("sit", sitK ? 1 : 0, 18));
      /* riding: each machine has its own seat */
      var rw = ease("ride", riding ? 1 : 0, first ? 99 : 18); if (riding) r.anc = st.anc || null;
      if (rw > .01) { var vs = Math.abs(st.vsp || 0), rp;
        if (r.anc && !r.anc.stand) rp = seated(r, r.anc, st, vs);
        else if (st.stand || st.veh === "skate") { var bl = Math.sin(t * 1.1 + s0) * .03 * Math.min(1, vs / 3); rp = { hL: .42, kL: -.8, fL: .38, hR: .1, kR: -.78, fR: .68, sL: .15, sR: .1, xL: .95 + bl, xR: .95 - bl, eL: .3, eR: .3, lean: -.1 - Math.min(.12, vs * .012), roll: 0, twist: 0, bend: -.04, nod: .06, fwd: 0, side: 0, y: (r.anc ? r.anc.seat[1] / (r.s0 || 1.08) : st.ride || 0) - .1 }; }
        else { rp = { hL: 1.2, kL: -1.35, fL: .15, hR: 1.2, kR: -1.35, fR: .15, sL: 1.08, sR: 1.08, eL: .35, eR: .35, xL: .2, xR: .2, lean: -.2, roll: 0, twist: 0, bend: -.12, nod: .14, fwd: 0, side: 0 }; rp.y = st.ride || 0; }
        /* at the wheel: hands turn it the way the car is turning (yaw rate), the body leans out of the corner */
        if (riding && r.anc && r.anc.roof && !st.pil) { var yr = clamp(wrap(a - (r.ra == null ? a : r.ra)) / dt, -3, 3); r.yr = (r.yr || 0) + (yr - (r.yr || 0)) * (1 - Math.exp(-dt * 8)); rp.sL += r.yr * .1; rp.sR -= r.yr * .1; rp.eL -= r.yr * .05; rp.eR += r.yr * .05; rp.roll = (rp.roll || 0) - r.yr * .025; }
        mix(rp, rw); }
      /* dancing: two moves that trade places */
      var dw = ease("dance", st.dance ? 1 : 0, 16);
      if (dw > .01) { var dd = t * 8, s1 = Math.sin(dd), s2 = Math.sin(dd * .5), mv = Math.sin(t * .9) > 0;
        mix(mv ? { y: Math.abs(s1) * .12 - .04, twist: s2 * .7, roll: s2 * .14, sL: 2.3 + s1 * .6, sR: 2.3 - s1 * .6, eL: .7 + Math.sin(dd * 2) * .5, eR: .7 - Math.sin(dd * 2) * .5, xL: .3, xR: .3, hL: Math.max(0, s1) * .6, hR: Math.max(0, -s1) * .6, kL: -Math.max(0, s1) * 1.1 - .2, kR: -Math.max(0, -s1) * 1.1 - .2, lean: s2 * .12, nod: s1 * .12, side: s2 * .08 }
          : { y: -.12 + Math.abs(s2) * .1, twist: s1 * .35, roll: s1 * .2, side: s1 * .1, sL: .9 + s1 * .5, sR: .9 - s1 * .5, eL: 1.6, eR: 1.6, xL: .35, xR: .35, hL: .35 + s1 * .12, hR: .35 - s1 * .12, kL: -.75, kR: -.75, fL: .3, fR: .3, lean: -.12, bend: s2 * .15, nod: Math.sin(dd) * .15 }, dw); }
      /* a win: bouncing with both fists in the air. A loss: head down, shoulders gone. */
      var cw = ease("cheer", st.cheer ? 1 : 0, 18); if (cw > .01) { var cb2 = t * 9, hop = Math.abs(Math.sin(cb2)), pm = Math.sin(cb2 * 2); mix({ y: hop * .2 - .05, sL: 2.85 + pm * .25, sR: 2.85 - pm * .25, xL: .35, xR: .35, eL: .5 - pm * .4, eR: .5 + pm * .4, hL: .15 + (1 - hop) * .35, hR: .15 + (1 - hop) * .35, kL: -.3 - (1 - hop) * .7, kR: -.3 - (1 - hop) * .7, fL: -hop * .5, fR: -hop * .5, lean: .08, bend: .1, nod: .3, twist: Math.sin(cb2 * .5) * .25, roll: 0 }, cw); }
      var sw2 = ease("sad", st.sad ? 1 : 0, 15); if (sw2 > .01) { var sb = Math.sin(t * 1.4 + s0); mix({ nod: -.5, bend: -.2, lean: -.04, y: -.06, sL: .12 + sb * .03, sR: .12 - sb * .03, eL: .08, eR: .08, xL: .03, xR: .03, hL: .12, hR: .04, kL: -.26, kR: -.14, twist: sb * .05, roll: sb * .03, side: sb * .01 }, sw2); }
      /* a raised hand, a torch, a wind-up, a throw */
      var ww = ease("wave", st.wave ? 1 : 0, 18); if (ww > .01) ub({ xL: 2.45, sL: .1, eL: .25, nod: .1, roll: -.06, twist: -.12 }, ww);
      var hg = ease("hug", st.hug ? 1 : 0, 15); if (hg > .01) { var hs = Math.sin(t * 1.7); mix({ sL: 1.3, sR: 1.3, xL: .62, xR: .62, eL: 1.85, eR: 1.85, lean: .14, nod: -.06, roll: hs * .07, twist: hs * .06 + .12, side: hs * .02 }, hg); } /* both arms round someone's back, swaying */
      var cy2 = ease("carry", st.carry ? 1 : 0, 16); if (cy2 > .01) ub({ sR: .08, eR: .06, xR: .12, roll: .05 }, cy2); /* a bag hanging from the right hand */
      var tc = ease("torch", st.torch ? 1 : 0, 18); if (tc > .01) ub({ sR: 1.25, eR: .15 }, tc);
      var wd = ease("wind", st.wind ? 1 : 0, 24); if (wd > .01) mix({ sR: -.9, eR: 1.9, xR: .35, sL: 1.0, eL: 1.5, twist: -.6, lean: .08, hL: .35, kL: -.35, hR: -.25, kR: -.2 }, wd);
      if (st.throwT > 0) { var th = clamp(st.throwT / .3, 0, 1), wn = th > .55 ? (1 - th) / .45 : 1, rl = th > .55 ? 0 : 1 - th / .55; mix({ sR: 3.0 - rl * 1.9, eR: 1.2 - rl * 1.1, xR: .3, twist: -.55 + rl * 1.0, lean: .08 - rl * .22, sL: .9 - rl * .8, eL: .6, hL: .4, kL: -.3, hR: -.3, kR: -.25 }, wn); }
      /* strikes: jab with the left, cross with the right, then a front kick. Out fast, back slower, hips behind it. */
      var at = st.atk || 0, pw = ease("atk", at > 0 ? 1 : 0, at > 0 ? 60 : 9);
      if (pw > .01) { if (at > 0) { r.combo = st.combo || 0; r.ext = at < .4 ? Math.sin(at / .4 * Math.PI * .5) : Math.cos((at - .4) / .6 * Math.PI * .5); } else r.ext = (r.ext || 0) * Math.exp(-dt * 16); var e = r.ext || 0, cb = r.combo || 0;
        var gp = cb === 2 ? { hR: .25 + e * 1.3, kR: -1.5 + e * 1.4, fR: -.5 * e, hL: -.1, kL: -.28, fL: .1, lean: .1 + e * .32, twist: -.25 * e, sL: 1.0, eL: 1.75, sR: .7 - e * .9, eR: 1.5, xL: .25, xR: .25 + e * .5, y: -.03, fwd: e * .08, nod: .15 * e }
          : cb === 1 ? { sR: .95 + e * .62, eR: 1.8 - e * 1.75, xR: .12, sL: .85, eL: 1.85, xL: .2, twist: e * .75 - .1, lean: -.1 - e * .1, fwd: e * .16, hL: .45, kL: -.4, hR: -.4, kR: -.3 - e * .2, fR: -.3 * e, y: -.05, nod: .05 }
          : { sL: .95 + e * .62, eL: 1.8 - e * 1.75, xL: .12, sR: .85, eR: 1.85, xR: .2, twist: -e * .5 + .08, lean: -.08 - e * .06, fwd: e * .1, hL: .4, kL: -.38, hR: -.35, kR: -.3, y: -.04, nod: .05 };
        mix(gp, pw); }
      /* struck or bumped: thrown away from where the blow came from */
      var hk = o.hitT > 0 ? clamp(o.hitT / .35, 0, 1) : 0, bk = o.bumpT > 0 ? clamp(o.bumpT / .35, 0, 1) * .55 : 0;
      if (hk > 0 || bk > 0) { var rel = hk >= bk ? wrap((o.hitA == null ? r.a : o.hitA) - r.a) : wrap((o.bumpA == null ? r.a : o.bumpA) - r.a), s = Math.max(hk, bk), sw = Math.sin(s * Math.PI * .5), cx = Math.cos(rel), sz = Math.sin(rel);
        q.fwd -= cx * .2 * sw; q.side -= sz * .2 * sw; q.lean += cx * .5 * sw; q.roll -= sz * .45 * sw; q.bend += cx * .25 * sw; q.nod += cx * .45 * sw; q.twist += sz * .5 * sw; q.y -= .07 * sw;
        q.xL += .9 * sw; q.xR += .9 * sw; q.sL += -cx * .7 * sw; q.sR += -cx * .7 * sw; q.eL += .5 * sw; q.eR += .5 * sw; q.kL -= .3 * sw; q.kR -= .3 * sw; q.hL += cx * .3 * sw; q.hR -= cx * .15 * sw; }
      /* flat out */
      /* guard up, hands up, phone out, brushing the dust off */
      var bl = ease("block", o.block ? 1 : 0, 30); if (bl > .01) mix({ sL: 1.15, eL: 2.05, xL: .3, sR: 1.15, eR: 2.05, xR: .3, lean: -.06, nod: .12, hL: .3, kL: -.4, hR: -.25, kR: -.3, y: -.05 }, bl);
      if (o.st === "fight" && !(st.atk > 0) && !st.wind) mix({ sL: .95, eL: 1.9, xL: .2, sR: .85, eR: 1.85, xR: .2, hL: .35, kL: -.35, hR: -.3, kR: -.3, y: -.04, twist: .15 }, .8);
      if (o.st === "yield") mix({ sL: 2.9, sR: 2.9, xL: .5, xR: .5, eL: .35, eR: .35, nod: -.2, lean: -.12, kL: -.25, kR: -.25 }, .9);
      if (o.film) ub({ sR: 1.45, eR: .5, xR: -.15, nod: -.08 }, .9);
      /* the phone: a hand to the hip pocket, then up in front of the chest; standing still, both hands and head down to it */
      var pk = riding || st.sit ? 0 : o.phoneK || (o.emote === "phone" ? 1 : 0), pw2 = ease("phone", pk, 30);
      if (pw2 > .01) { var reachW = pw2 < .5 ? Math.sin(pw2 / .5 * Math.PI * .5) : Math.cos((pw2 - .5) / .5 * Math.PI * .5), holdW = clamp((pw2 - .45) / .55, 0, 1), still = 1 - clamp(v / 1.2, 0, 1), tap = Math.sin(t * 7 + s0) * .03 * still;
        ub({ sR: -.2, eR: .45, xR: .28, twist: -.06, roll: .03 }, reachW * .9);
        ub({ sR: .42 + tap, eR: 1.72, xR: -.34, nod: -.2 }, holdW);
        if (still > .01) ub({ sL: .5, eL: 1.62, xL: -.32, nod: -.46, bend: -.05 }, holdW * still); }
      /* eating from your pocket: hand to mouth, a little chew */
      var ew = ease("eat", o.eatT > 0 ? 1 : 0, 18); if (ew > .01) ub({ sR: .65, eR: 2.45, xR: -.32, nod: .08 + Math.sin(t * 14) * .04 }, ew);
      if (o.dustT > 0) { var du = Math.sin(t * 20); mix({ sR: .5 + du * .25, eR: 1.3, xR: -.35, sL: .3, eL: .9, xL: -.2, nod: -.35, bend: -.18, lean: .1 }, Math.min(1, o.dustT * 4)); }
      /* layers other modules add (Z.anim.layer) */
      for (i = 0; i < A.layers.length; i++) { var LY = A.layers[i], lp = null; try { lp = LY.f(o, st, t, r); } catch (e) { lp = null; } if (lp) (r.lp || (r.lp = {}))[LY.n] = lp; var lw = ease("L" + LY.n, lp ? 1 : 0, LY.rate); if (lw > .01 && r.lp && r.lp[LY.n]) mix(r.lp[LY.n], lw); }
      /* flat out: on the back or face down, whichever way they went over */
      mix(A.LIE[r.lie || "back"], ease("fall", down ? 1 : 0, 18));
      /* ---- the root: where the figure stands, which way it faces, how big it is drawn ---- */
      var S2 = window.SamaruSim, gy = riding ? (st.ry || 0) : Z.W && S2 && S2.groundY && st.local !== true ? S2.groundY(Z.W, x, y) : 0; r.gy = first || riding || r.gy == null ? gy : r.gy + (gy - r.gy) * (1 - Math.exp(-dt * 14));
      if (!r.s0) r.s0 = g.scale.x; var sT = r.s0 * (riding && r.anc && r.anc.scale ? r.anc.scale * (r.fit || 1) : 1), TY = r.gy + (st.air || 0);
      var rt = r.root || (r.root = { x: x, y: TY, z: y, yaw: r.a, s: sT });
      if (riding) { var lv = r.lv || (r.lv = { q: {} }); lv.x = x; lv.y = y; lv.a = a; lv.ry = st.ry || 0; lv.an = r.anc; lv.pil = !!st.pil; lv.vo = st.vo || null; lv.s = sT; lv.kind = vKind(r.anc, st.veh); lv.q.fwd = q.fwd; lv.q.lean = q.lean; lv.q.y = q.y; lv.q.side = q.side; hipXY(lv.q); } /* the last seat, for getting off */
      /* a change of state starts a clip */
      if (!first && pm !== mode && st.hop !== false) startClip(r, pm, mode, st, o, x, y, a, sitK, sT); else if (first) r.clip = null;
      if (o.animPlay) { if (CL[o.animPlay]) begin(r, CL[o.animPlay], {}, x, y); o.animPlay = null; }
      if (first && down) { r.lieA = r.a; r.pin = { x: x, z: y }; }
      r.mode = mode;
      if (snap && r.clip) { var sc1 = r.clip; if (sc1.C.lie) r.pin = { x: x, z: y }; if (sc1.C.lift && sc1.vo) sc1.vo.tipA = 0; if (sc1.C.door && sc1.vo && sc1.drv) sc1.vo.doorT = 0; r.clip = null; }
      var cl = r.clip, cwt = mode === "fall" || (mode === "sit" && sitK !== "chair") ? 1 : 0;
      if (cl) { cl.u += cl.C.gu && gu > 0 ? Math.max(0, Math.min(.999, gu) - cl.u) : dt * (cl.app && cl.u < cl.u1 ? cl.u1 / (cl.u1 * cl.C.d + cl.app) : cl.lev && cl.u > cl.u2 ? (1 - cl.u2) / ((1 - cl.u2) * cl.C.d + cl.lev) : 1 / cl.C.d) * (cl.C.hurry && v > 1.2 ? 2.6 : 1) * (st.quick && cl.C.veh ? 1.8 : 1);
        if (cl.u >= 1 || (cl.C.veh && !cl.C.out && !riding)) { if (cl.C.lie) r.pin = { x: rt.x, z: rt.z }; if (cl.C.lift && cl.vo) cl.vo.tipA = 0; r.clip = cl = null; } }
      if (cl && (EV.land || EV.seat) && !cl.ev) { var cc = pl(cl.C.contact, cl.u); if (cc >= .99 && cl.u > .2) { cl.ev = 1; if (cl.C.lie) emit("land", { o: o, body: true, x: x, y: y }); else if (/^sit/.test(cl.C.name)) emit("seat", { o: o, x: x, y: y }); } } // the body meets the ground or the seat
      if (cl) { /* the clip's pose, then a path for the hips; walking steps while the hips travel */
        hipXY(q); A.evalClip(cl.C, cl.u, cl.src, q, CQ); clipRoot(r, cl, x, y, a, TY, sT, CQ, dt, q);
        cl.wk = (cl.wk || 0) + (pl(cl.C.walk, cl.u) * Math.min(1, cl.hs / .7) - (cl.wk || 0)) * (1 - Math.exp(-dt * 7)); var wk = cl.wk; if (wk > .01) { r.ph += cl.hs * dt / (key(G.step, A.gait(cl.hs)) * (r.s0 || 1.08)) * Math.PI; stride(cl.hs, r.ph, O3); for (k in O3) CQ[k] += (O3[k] - CQ[k]) * wk * (k === "sL" || k === "sR" ? .5 : 1); }
        for (i = 0; i < K.length; i++) q[K[i]] = CQ[K[i]]; wpush(1); if (!cl.C.veh && !cl.C.lie && !cl.C.gu && !cl.C.air) ubOver(); cwt = pl(cl.C.contact, cl.u);
        if (o !== NOO) { o.animBusy = 1; if (cl.C.door) { var dr = pl(cl.C.door, cl.u), vo = cl.vo; o.animDoor = dr; if ((EV.doorOpen || EV.doorClose) && ((dr > .05) !== !!cl.dOpen)) { cl.dOpen = dr > .05; emit(cl.dOpen ? "doorOpen" : "doorClose", { o: o, vo: cl.vo, x: x, y: y }); } if (vo && cl.drv && vo.doorT != null) vo.doorT = dr < .002 ? 0 : dr >= .999 ? .6 : dr >= (cl.pdr || 0) ? .8 - .2 * dr : .25 * dr; cl.pdr = dr; }
          if (cl.C.lift) { o.animLift = sstep(seg(cl.u, cl.C.lift[0], cl.C.lift[1])); if (cl.vo && cl.tip0) cl.vo.tipA = cl.tip0 * (1 - o.animLift); } } }
      else { if (o !== NOO && o.animBusy) { o.animBusy = 0; o.animDoor = 0; o.animLift = undefined; }
        if (mode === "fall") { if (!r.pin || Math.hypot(r.pin.x - x, r.pin.z - y) > 3) { r.pin = { x: x, z: y }; r.lieA = lieYaw(x, y, r.a, r.lie !== "front", sT); } rt.x = r.pin.x; rt.z = r.pin.z; rt.yaw = r.lieA == null ? r.a : r.lieA; } /* down is down: no crawling along the floor */
        else { /* a sudden small shove from game logic (a hit, a wall push, a seat): absorbed and eased out, not a pop */
          var jx = r.tx0 == null || first ? 0 : r.tx0 - x, jz = r.tx0 == null || first ? 0 : r.tz0 - y, jd = Math.hypot(jx, jz);
          if (jd > .25 + (r.v + 2) * dt * 1.5 && jd < 3) { r.ox = (r.ox || 0) + jx; r.oz = (r.oz || 0) + jz; }
          if (r.ox || r.oz) { var W2 = 11, ax = -W2 * W2 * r.ox - 2 * W2 * (r.vx || 0), az = -W2 * W2 * r.oz - 2 * W2 * (r.vz || 0); r.vx = (r.vx || 0) + ax * dt; r.vz = (r.vz || 0) + az * dt; r.ox += r.vx * dt; r.oz += r.vz * dt; if (Math.abs(r.ox) + Math.abs(r.oz) + Math.abs(r.vx) + Math.abs(r.vz) < 2e-3) r.ox = r.oz = r.vx = r.vz = 0; } /* critically damped: eases out without a jerk */
          rt.x = x + (r.ox || 0); rt.z = y + (r.oz || 0); rt.yaw = r.a; }
        rt.y = TY; rt.s = first || riding || snap ? sT : rt.s + (sT - rt.s) * (1 - Math.exp(-dt * 14)); }
      r.tx0 = x; r.tz0 = y; if (cl || riding || snap || mode === "fall") r.ox = r.oz = r.vx = r.vz = 0;
      if ((st.air || 0) > .05) cwt = 0;
      r.tiltW = cl || !riding ? 0 : first ? 1 : Math.min(1, (r.tiltW || 0) + dt * 3); // how much of the machine's lean the rider takes (samaru-3d): none while getting on or off
      /* who they look at: someone talking near them, you if you are close, or (for you) where the camera points */
      var lk = 0; if (near && !cl && (mode === "stand" || mode === "sit")) { var la = lookAt(o, x, y); if (la == null && o === Z.me && v < .3 && Z.r3 && Z.r3.yaw != null) la = Z.r3.yaw; if (la != null) { var rel = wrap(la - r.a); lk = Math.abs(rel) > 2.3 ? 0 : clamp(-rel, -1.1, 1.1) * (la === (Z.r3 && Z.r3.yaw) ? .55 : 1); } }
      r.lk = (r.lk || 0) + (lk - (r.lk || 0)) * (1 - Math.exp(-dt * 4)); q.look += r.lk; if (Math.abs(r.lk) > .8) q.twist -= (r.lk - Math.sign(r.lk) * .8) * .5;
      /* a light spring on top so layers settle instead of clicking into place (clips are already smooth, so they drive directly) */
      var kq = first || cl || snap ? 1 : 1 - Math.exp(-dt * 38);
      for (i = 0; i < K.length; i++) { k = K[i]; c[k] = c[k] == null ? q[k] : c[k] + (q[k] - c[k]) * kq; }
      /* feet, knees, hands and head never below the ground; lying or sitting on it, the body rests on it rather than hovering */
       r.yAdj = 0; if (near && !riding && sitK !== "chair" && !(cl && (cl.C.noLift || (cl.C.veh && (cl.C.out ? cl.u < .55 : cl.u > .3))))) { var lo = A.fk(c, null, !cl && mode === "stand" && v > 1.2 && aw < .01); r.yAdj = lo < 0 ? -lo : -lo * cwt; }
      if (A.trace) r.wts = WL.slice();
      g.position.set(rt.x, rt.y, rt.z); g.rotation.set(0, -rt.yaw, 0); if (Math.abs(g.scale.x - rt.s) > 1e-4) g.scale.setScalar(rt.s);
      if (!!r.dbg !== !!A.debug) { r.dbg = !!A.debug; debugPaint(g, r.dbg); }
      var b = r.body; b.position.set(c.fwd, c.y + r.yAdj, c.side); b.rotation.set(c.roll, 0, c.lean);
      r.hips.rotation.y = -c.twist * .45; r.chest.rotation.set(-c.roll * .5, c.twist, c.bend);
      r.lL.hp.rotation.z = c.hL; r.lL.kn.rotation.z = c.kL; r.lL.ft.rotation.z = c.fL; r.lR.hp.rotation.z = c.hR; r.lR.kn.rotation.z = c.kR; r.lR.ft.rotation.z = c.fR;
      var wv = ww > .3 ? Math.sin(t * 12) * .5 * ww : 0;
      r.aL.sh.rotation.set(c.xL, c.yL || 0, c.sL); r.aL.el.rotation.set(wv, 0, c.eL + wv); r.aR.sh.rotation.set(-c.xR, -(c.yR || 0), c.sR); r.aR.el.rotation.z = c.eR;
      r.head.rotation.set(-c.roll * .4, -c.twist * .75 + c.look, c.nod - (c.lean + c.bend) * .55); r.head.scale.setScalar(st.big ? 1.9 : 1);
      var br = 1 + Math.sin(t * (2.2 + run * 5) + s0) * (.012 + run * .012); r.torso.scale.y = br; r.torso.scale.x = .84 * (2 - br);
      /* blinking, near the camera */
      if (near && r.eyes) { var per = 2.9 + s0 % 2.6, bp = (t + s0 * 1.37) % per, bk = bp < .15 ? Math.sin(bp / .15 * Math.PI) : 0; if (bk > 0 || r.blk) { for (i = 0; i < r.eyes.length; i++) { var em = r.eyes[i]; if (em.userData.sy == null) em.userData.sy = em.scale.y; em.scale.y = em.userData.sy * (1 - .9 * bk); } r.blk = bk > 0; } }
      /* leaving (walking into a hall): fade out instead of being squashed flat */
      if (st.fade != null && st.fade < 1) { if (!r.fm) { r.fm = []; g.traverse(function (m) { if (m.isMesh && m.material && !m.material.transparent && m !== r.shadow) { m.material = m.material.clone(); m.material.transparent = true; r.fm.push(m.material); } }); } for (i = 0; i < r.fm.length; i++) r.fm[i].opacity = clamp(st.fade, 0, 1); }
      r.torch.visible = !!st.torch; if (r.phone) r.phone.visible = !st.torch && (w.phone > .45 || !!o.film); r.shadow.visible = !R.shadows && !riding && !(st.fade < .4); r.shadow.position.y = .08 - (rt.y - r.gy) / rt.s; r.shadow.scale.setScalar(1 / (1 + zz * .6) * (mode === "fall" ? 1.3 : 1));
    }
    return { rig: rig, pose: pose, shade: shade, cap: cap, ball: ball, put: put };
  };

  /* ----- clothing over the legs (MASTER_GAME_GUIDE 11.1) -----
     A gown, robe, skirt or long top is a cone hung from the waist (top radius .2, bottom rb, length len, in the hips' space).
     Each frame it swings toward the middle of the two thighs through a critically damped spring (follow-through: ~0.1 s lag),
     and its width is the smallest flare (never less than the cut, sx0) that keeps every sampled point of both legs (thigh,
     knee, shin, ankle, with their thickness, plus 4% room) inside the cloth above the hem. Legs leave through the hem, never
     through the side. Seated, it shortens and drapes forward over the thighs instead. st keeps the spring; out gets
     { th, sx, sy, miss } (miss > 0: how far a leg would still poke out at the widest allowed flare). */
  var SF = [[.5, 0, .1], [1, 0, .092], [1, .33, .08], [1, .66, .075], [1, 1, .06]], SD = [], SN = [];
  A.shellFit = function (hL, kL, hR, kR, len, rb, sx0, st, dt, out) {
    var av = (hL + hR) / 2, sit = clamp((Math.abs(av) - .45) / .55, 0, 1), keep = Math.min(1, .42 / len), sy = 1 - sit * (1 - keep), thT = av * (.42 * (1 - sit) + .5 * sit);
    if (st.th == null) { st.th = thT; st.tv = 0; } var W = 16, d = Math.min(dt, .05); st.tv += (-W * W * (st.th - thT) - 2 * W * st.tv) * d; st.th += st.tv * d; var th = st.th;
    var ux = Math.sin(th), uy = -Math.cos(th), sx = sx0, miss = 0, hem = len * sy, h0 = hem, n = 0, i, j, CAP = len > .7 ? 2 : 1.75;
    if (sit < .6) for (i = 0; i < 2; i++) { var h = i ? hR : hL, k = i ? kR : kL, kx = .44 * Math.sin(h), ky = .92 - .44 * Math.cos(h), ax = kx + .4 * Math.sin(h + k), ay = ky - .4 * Math.cos(h + k);
      for (j = 0; j < SF.length; j++) { var f = SF[j], px = f[0] < 1 ? kx * f[0] : kx + (ax - kx) * f[1], py = f[0] < 1 ? .92 + (ky - .92) * f[0] : ky + (ay - ky) * f[1], vx = px, vy = py - 1.02, dep = vx * ux + vy * uy;
        if (dep <= 0 || dep >= h0) continue; SD[n] = dep; SN[n++] = (Math.abs(vx * -uy + vy * ux) + f[2]) * 1.04; } }
    /* a leg too far out for any sensible flare (a knee up, a kick, a fall): the cloth rides up to just above where it leaves */
    for (j = 0; j < n; j++) if (SN[j] / (.2 + (rb - .2) * SD[j] / h0) > CAP && SD[j] * .94 < hem) hem = Math.max(.1, SD[j] * .94);
    for (j = 0; j < n; j++) if (SD[j] < hem) { var need = SN[j] / (.2 + (rb - .2) * SD[j] / hem); if (need > CAP) { miss = Math.max(miss, (need - CAP) * .2); need = CAP; } if (need > sx) sx = need; }
    /* hitched up at once when a leg needs it, let down slowly; flared at once, narrowed slowly: no flapping from stride to stride */
    var fy = hem / len; st.fy = st.fy == null || fy < st.fy ? fy : st.fy + (fy - st.fy) * (1 - Math.exp(-d * 2.5)); st.fx = st.fx == null || sx > st.fx ? sx : st.fx + (sx - st.fx) * (1 - Math.exp(-d * 4));
    out.th = th; out.sx = st.fx; out.sy = st.fy; out.miss = miss; return out;
  };

  /* ================= transitions between body states =================
     Every change of state (stand, sit, fall, getting up, riding) plays a short authored clip. A clip is a list of
     keyframes in normalised time; "s" is the pose the body was really in when the clip began and "d" is the live pose
     of the state it is going to, so a clip can start or be cut off anywhere without a pop. Keys a frame leaves out drift
     from s to d. Values pass through a C1 cubic (time-aware Catmull-Rom), so limbs do not stop dead on each key.
     Clips move the hips, not the feet: "hx"/"hy" are the hip joint's offset, and the root follows a path for the hips
     (to the door, onto the seat, off the bike), so turning while sitting pivots about the seat and nobody slides.
     Hooks for other modules:  Z.anim.clip(name, seconds, keys, opt) adds a clip; Z.anim.play(o, name) plays it on an
     entity once; Z.anim.layer(name, fn) adds a pose layer (fn(o, st, t) returns a pose or null; it eases in and out).
     Read back:  o.animLift (0..1 while lifting a fallen bike up: the bike can follow it), o.animBusy (a clip is running),
     o.animDoor (0..1: how far the person is holding the door open). */
  var HP = Math.PI / 2, CL = A.CLIPS = {}, CK = null, SEATH = .3; // SEATH: a raised seat's surface above its own floor (samaru-interior I.SEAT)
  function trap(e, a) { var v = 1 / (1 - a); return e < a ? .5 * v * e * e / a : e < 1 - a ? v * (e - a / 2) : 1 - .5 * v * (1 - e) * (1 - e) / a; }
  function sstep(u) { u = u < 0 ? 0 : u > 1 ? 1 : u; return u * u * (3 - 2 * u); }
  function seg(u, a, b) { return clamp((u - a) / (b - a), 0, 1); }
  function lerpA(a, b, k) { return a + wrap(b - a) * k; }
  function pl(arr, u) { if (!arr) return 0; if (u <= arr[0][0]) return arr[0][1]; for (var i = 1; i < arr.length; i++) if (u <= arr[i][0]) { var p = arr[i - 1], n = arr[i]; return p[1] + (n[1] - p[1]) * (u - p[0]) / ((n[0] - p[0]) || 1); } return arr[arr.length - 1][1]; }
  function hipXY(p) { p.hx = p.fwd - .92 * Math.sin(p.lean); p.hy = p.y + .92 * Math.cos(p.lean) - .92; return p; }
  function chans() { if (!CK) { CK = []; A.KEYS.forEach(function (k) { if (k !== "fwd" && k !== "y") CK.push(k); }); CK.push("hx", "hy"); } return CK; }
  A.clip = function (name, d, keys, opt) { opt = opt || {}; opt.name = name; opt.d = d; opt.k = keys; CL[name] = opt; return opt; };
  A.play = function (o, name) { if (o && CL[name]) o.animPlay = name; };
  A.setDebug = function (on) { A.debug = !!on; };
  /* cutscene skip: Z.anim.snap(o) puts one entity, Z.anim.snap() everyone, straight into the end pose of whatever it is doing
     (a running transition finishes, every blend lands on its target) on the next frame */
  A.snapGen = 0; A.snap = function (o) { if (o) o.animSnap = 1; else A.snapGen++; };
  /* animation events: Z.anim.on(name, fn) with name "step" (a footfall: { o, foot, speed, run, x, y }), "land" (feet after a jump,
     or the body hitting the ground in a fall: { o, body }), "seat" (hips reach a seat), "doorOpen" / "doorClose" ({ o, vo }) */
  var EV = {}; A.on = function (name, fn) { (EV[name] || (EV[name] = [])).push(fn); };
  function emit(name, e) { var l = EV[name]; if (l) for (var i = 0; i < l.length; i++) try { l[i](e); } catch (er) {} }
  A.layers = []; A.layer = function (name, fn, rate) { A.layers.push({ n: name, f: fn, rate: rate || 10 }); };
  function kv(fr, k, src, dst) { var p = fr[1]; if (p === "s") return src[k]; if (p === "d") return dst[k]; var v = p[k]; if (v === "s") return src[k]; if (v === "d") return dst[k]; if (v == null) return src[k] + (dst[k] - src[k]) * sstep(fr[0]); return v; }
  /* the pose a clip gives at time u (0..1) between src and dst, written into out (with fwd and y rebuilt from the hips) */
  A.evalClip = function (C, u, src, dst, out) {
    var ks = C.k, n = ks.length, i = 0, ch = chans(); while (i < n - 2 && u > ks[i + 1][0]) i++;
    var t0 = ks[i][0], t1 = ks[i + 1][0], h = (t1 - t0) || 1, s = clamp((u - t0) / h, 0, 1), s2 = s * s, s3 = s2 * s, pa = ks[i - 1], pb = ks[i + 2];
    var h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = 3 * s2 - 2 * s3, h11 = s3 - s2;
    for (var j = 0; j < ch.length; j++) { var k = ch[j], p0 = kv(ks[i], k, src, dst), p1 = kv(ks[i + 1], k, src, dst), dl = p1 - p0, m0 = 0, m1 = 0;
      if (pa) { m0 = (p1 - kv(pa, k, src, dst)) / (t1 - pa[0]) * h; if (m0 * dl <= 0) m0 = 0; else if (Math.abs(m0) > 3 * Math.abs(dl)) m0 = 3 * dl; } // no overshoot past a key
      if (pb) { m1 = (kv(pb, k, src, dst) - p0) / (pb[0] - t0) * h; if (m1 * dl <= 0) m1 = 0; else if (Math.abs(m1) > 3 * Math.abs(dl)) m1 = 3 * dl; }
      out[k] = h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1; }
    out.fwd = out.hx + .92 * Math.sin(out.lean); out.y = out.hy - .92 * Math.cos(out.lean) + .92; return out;
  };

  /* lying still: on the back (head behind where they stood) or face down (head ahead), hips over the spot */
  var SUP = { hx: 0, hy: -.77, lean: 1.5, bend: 0, roll: 0, twist: .06, side: 0, hL: .42, kL: -.85, fL: -1.0, hR: .05, kR: -.12, fR: -.35, sL: .05, sR: -.05, xL: .85, xR: .65, eL: .45, eR: .25, nod: .8, look: .35 };
  var PRO = { hx: 0, hy: -.77, lean: -1.5, bend: 0, roll: 0, twist: 0, side: 0, hL: -.06, kL: -.3, fL: -1.3, hR: .05, kR: -.6, fR: -1.2, sL: 2.75, sR: 2.5, xL: .78, xR: .85, eL: 1.3, eR: 1.55, nod: -.55, look: 1.15 };
  function based(p) { var o = {}, k; for (k in p) if (k !== "hx" && k !== "hy") o[k] = p[k]; o.fwd = p.hx + .92 * Math.sin(p.lean); o.y = p.hy - .92 * Math.cos(p.lean) + .92; return o; }
  A.LIE = { back: based(SUP), front: based(PRO) };
  /* sitting: on a chair or bench (hips on the seat), on the ground (knees up, a hand behind), kneeling */
  A.SITS = {
    chair: { hL: 1.45, hR: 1.45, kL: -1.45, kR: -1.45, fL: .1, fR: .1, sL: .55, sR: .55, eL: .5, eR: .5, xL: .08, xR: .08, y: -.5, lean: .08, twist: 0, roll: 0, bend: -.06, fwd: 0, side: 0 },
    ground: { hL: 1.72, kL: -1.12, fL: -.72, hR: 1.55, kR: -1.38, fR: -.3, sL: -.3, eL: .04, xL: .3, sR: .95, eR: 1.15, xR: .12, lean: .14, bend: -.12, twist: .1, roll: 0, nod: .06, side: 0, fwd: .13, y: -.75 },
    kneel: { hL: 1.42, kL: -2.95, fL: -1.45, hR: 1.42, kR: -2.95, fR: -1.45, sL: .45, eL: 1.35, xL: -.22, sR: .45, eR: 1.35, xR: -.22, lean: 0, bend: -.22, twist: 0, roll: 0, nod: -.32, side: 0, fwd: 0, y: -.66 } };

  var STANDISH = { hy: 0, lean: 0, bend: -.05, roll: 0, twist: 0, side: 0, hL: .05, kL: -.12, fL: .05, hR: .05, kR: -.12, fR: .05, sL: .12, sR: .12, eL: .3, eR: .3, xL: .08, xR: .08, nod: .04, look: 0 };
  function sw(p, q) { var o = {}, k; for (k in p) o[k] = p[k]; for (k in q) o[k] = q[k]; return o; }
  /* --- sitting down and standing up --- */
  A.clip("sitGround", 1.2, [[0, "s"], [.2, { hy: -.03, bend: -.1, hL: .22, kL: -.3, hR: -.06, kR: -.12, nod: .05, look: 0 }],
    [.48, { hy: -.42, lean: 0, bend: -.42, hL: 1.5, kL: -2.05, fL: .55, hR: 1.45, kR: -2.0, fR: .55, sL: .42, sR: .38, eL: .95, eR: 1.0, xL: .3, xR: .3, nod: .22, twist: 0, roll: 0, side: 0 }],
    [.74, { hy: -.68, lean: .2, bend: -.2, hL: 1.75, kL: -1.6, fL: -.15, hR: 1.62, kR: -1.62, fR: -.1, sL: -.5, sR: -.35, eL: .1, eR: .14, xL: .3, xR: .28, nod: .12 }],
    [1, "d"]], { contact: [[0, 0], [.4, 0], [.62, 1]], hip: [0, .42], yaw: [0, .38], walk: [[0, 1], [.32, 1], [.42, 0]], hurry: 1 });
  A.clip("sitKneel", 1.0, [[0, "s"], [.3, { hy: -.2, bend: -.2, hL: .9, kL: -.9, hR: .1, kR: -.2, look: 0 }], [.6, { hy: -.45, bend: -.2, hL: 1.3, kL: -1.9, hR: .2, kR: -2.0, fR: -1.2, sL: .4, sR: .4 }], [1, "d"]],
    { contact: [[0, 0], [.5, 0], [.75, 1]], hip: [0, .35], yaw: [0, .35], walk: [[0, 1], [.25, 1], [.35, 0]], hurry: 1 });
  A.clip("sitChair", .95, [[0, "s"], [.24, { hy: -.03, hL: -.15, kL: -.22, hR: .25, kR: -.35, bend: -.05, look: 0 }],
    [.55, { lean: 0, bend: -.45, hL: 1.0, kL: -1.2, fL: .2, hR: 1.0, kR: -1.2, fR: .2, sL: .3, sR: .3, eL: .3, eR: .3, xL: .35, xR: .35, nod: .2 }],
    [.8, { bend: -.2, hL: 1.35, kL: -1.4, hR: 1.35, kR: -1.4, sL: .4, sR: .4, xL: .25, xR: .25 }], [1, "d"]],
    { hip: [0, .5], yaw: [0, .45], walk: [[0, 1], [.3, 1], [.45, 0]], hurry: 1, noLift: 1 });
  A.clip("standGround", 1.0, [[0, "s"],
    [.3, { hy: -.6, lean: -.05, bend: -.5, hL: 1.95, kL: -2.35, fL: .45, hR: 1.7, kR: -2.25, fR: .45, sL: -.25, eL: .1, xL: .35, sR: 1.05, eR: .35, xR: .15, nod: .3, look: 0 }],
    [.6, { hy: -.36, lean: 0, bend: -.45, hL: 1.35, kL: -1.95, fL: .6, hR: 1.35, kR: -1.95, fR: .6, sL: .4, sR: .5, eL: .9, eR: .9, xL: .2, xR: .2, nod: .2, twist: 0 }],
    [.84, { hy: -.08, bend: -.15, hL: .35, kL: -.45, fL: .1, hR: .35, kR: -.45, fR: .1, sL: .2, sR: .2, eL: .25, eR: .25, nod: .05 }], [1, "d"]],
    { contact: [[0, 1], [.5, 1], [.72, 0]], hip: [.2, .8], yaw: [.5, 1], hurry: 1 });
  A.clip("standKneel", .8, [[0, "s"], [.4, { hy: -.4, bend: -.3, hL: 1.4, kL: -1.6, fL: .2, hR: .1, kR: -1.9, fR: -1.1, sL: .7, eL: 1.2, sR: .3, look: 0 }], [.75, { hy: -.1, bend: -.15, hL: .4, kL: -.5, hR: .2, kR: -.4 }], [1, "d"]],
    { contact: [[0, 1], [.45, 1], [.7, 0]], hip: [.2, .8], yaw: [.5, 1], hurry: 1 });
  A.clip("standChair", .8, [[0, "s"], [.35, { hy: "s", lean: "s", bend: -.55, nod: .25, sL: .5, sR: .5, eL: .6, eR: .6, xL: .3, xR: .3, hL: 1.25, kL: -1.6, hR: 1.25, kR: -1.6, fL: .4, fR: .4, look: 0 }],
    [.7, { lean: 0, bend: -.25, hL: .5, kL: -.6, hR: .5, kR: -.6, sL: .2, sR: .2, eL: .4, eR: .4 }], [1, "d"]],
    { hip: [.3, .9], yaw: [.4, 1], hurry: 1, noLift: 1 }); /* chair heights differ (a lecture tier is 1.8 m up): hip height runs straight from seat to floor */
  /* --- going down --- */
  A.clip("fallBack", .72, [[0, "s"], [.2, { hy: -.06, lean: .32, bend: .2, hL: .55, kL: -.35, fL: .2, hR: -.2, kR: -.25, sL: 1.3, sR: 1.0, xL: .65, xR: .6, eL: .4, eR: .45, nod: .35, look: 0 }],
    [.45, { hy: -.58, lean: .85, bend: -.25, hL: 1.25, kL: -.9, fL: -.3, hR: .95, kR: -.55, fR: -.2, sL: .7, sR: .55, xL: .95, xR: .9, eL: .3, eR: .3, nod: .45 }],
    [.7, { hy: -.74, lean: 1.48, bend: .05, hL: .95, kL: -1.0, fL: -.6, hR: .7, kR: -.5, fR: -.4, sL: .45, sR: .3, xL: 1.05, xR: 1.0, eL: .3, eR: .3, nod: .7 }], [1, "d"]],
    { contact: [[0, 0], [.35, 0], [.6, 1]], lie: "back" });
  A.clip("faint", 1.3, [[0, "s"], [.3, { hy: -.3, lean: 0, bend: -.3, hL: .7, kL: -1.3, fL: .3, hR: .6, kR: -1.2, fR: .3, sL: .1, sR: .1, xL: .2, xR: .2, eL: .2, eR: .2, nod: -.5, look: 0 }],
    [.55, { hy: -.62, lean: .3, roll: .35, bend: -.2, hL: 1.3, kL: -1.9, hR: 1.1, kR: -1.7, sL: .05, sR: .3, xL: .5, xR: .4, nod: -.2 }],
    [.8, { hy: -.75, lean: 1.3, roll: .2, hL: .7, kL: -1.0, hR: .4, kR: -.6, xL: .9, xR: .7, nod: .5 }], [1, "d"]],
    { contact: [[0, 0], [.4, 0], [.6, 1]], lie: "back" });
  A.clip("fallFront", .66, [[0, "s"], [.25, { hy: -.1, lean: -.4, bend: -.2, hL: .9, kL: -.6, fL: .1, hR: -.5, kR: -.6, fR: -.3, sL: 1.6, sR: 1.4, xL: .5, xR: .5, eL: .3, eR: .3, nod: .2, look: 0 }],
    [.5, { hy: -.5, lean: -1.0, bend: -.2, hL: .6, kL: -1.2, fL: -.5, hR: .3, kR: -1.0, fR: -.5, sL: 1.8, sR: 1.8, eL: .4, eR: .4, xL: .3, xR: .3, nod: .4 }],
    [.75, { hy: -.75, lean: -1.45, bend: 0, hL: 0, kL: -.5, fL: -1.0, hR: .1, kR: -.6, fR: -1.0, sL: 2.2, sR: 2.0, eL: .9, eR: 1.0, nod: -.2, look: .6 }], [1, "d"]],
    { contact: [[0, 0], [.4, 0], [.65, 1]], lie: "front" });
  function tumble(name, dir) {
    A.clip(name, 1.25, [[0, "s"], [.14, { hy: -.05, lean: dir * .55, bend: dir * .25, roll: .35, twist: .3, sL: 2.5, sR: 1.5, xL: 1.0, xR: .8, eL: .5, eR: .3, hL: 1.05, kL: -1.3, fL: 0, hR: -.35, kR: -.5, fR: -.3, nod: dir * .3, look: 0 }],
      [.36, { hy: -.15, lean: dir * 1.15, bend: -dir * .1, roll: -.3, twist: -.25, sL: 1.4, sR: 2.6, xL: .6, xR: 1.25, eL: .3, eR: .7, hL: .25, kL: -.35, hR: 1.05, kR: -1.45, nod: 0 }],
      [.56, { hy: -.76, lean: dir * 1.58, bend: 0, roll: .28, twist: .1, sL: .9, sR: 1.3, xL: 1.1, xR: .9, eL: .4, eR: .4, hL: .6, kL: -.7, hR: .3, kR: -.9 }],
      [.68, { hy: -.66, lean: dir * 1.45, roll: -.18, twist: 0, hL: .3, kL: -.5, hR: .7, kR: -1.0 }], [1, "d"]],
      { contact: [[0, 0], [.48, 0], [.56, 1]], lie: dir > 0 ? "back" : "front", air: 1 });
  }
  tumble("tumbleBack", 1); tumble("tumbleFront", -1);
  /* off a bike, okada, scooter or board: still folded as if seated, the body tips over the side and drops, rolls onto its back */
  function offBike(name, sd) {
    A.clip(name, 1.0, [[0, "s"], [.13, { roll: sd * .5, lean: -.1, bend: -.15, hL: 1.0, kL: -1.2, hR: 1.1, kR: -1.3, sL: 1.6, sR: 1.3, xL: .8, xR: .8, eL: .4, eR: .4, nod: .2, look: 0, side: 0 }],
      [.36, { hy: -.7, roll: sd * 1.25, lean: .3, bend: 0, twist: 0, hL: .9, kL: -1.1, hR: .5, kR: -.7, sL: 2.2, sR: .9, xL: 1.1, xR: .7, eL: .3, eR: .5, nod: .3 }],
      [.62, { hy: -.6, roll: sd * .95, lean: .85 }], [.82, { hy: -.76, roll: sd * .25, lean: 1.42, hL: .6, kL: -.9, hR: .2, kR: -.3 }], [1, "d"]],
      { contact: [[0, 0], [.3, 0], [.38, 1]], lie: "back", hip: [0, .5], yaw: [.12, .7] });
  }
  offBike("offBikeL", -1); offBike("offBikeR", 1);
  /* --- getting up: from the back (sit up, roll to a knee, push off it) and from the front (push-up, knees under, rise) --- */
  A.clip("upBack", 1.05, [[0, "s"], [.2, { hx: 0, hy: -.72, lean: .75, bend: -.45, roll: 0, twist: 0, hL: .9, kL: -1.6, fL: .2, hR: .6, kR: -.9, fR: 0, sL: -.7, sR: .5, xL: .25, xR: .2, eL: .1, eR: .6, nod: .3, look: 0 }],
    [.45, { hy: -.55, lean: -.1, roll: .2, twist: -.45, bend: -.4, hL: 1.6, kL: -2.3, fL: .4, hR: 0, kR: -2.0, fR: -1.2, sL: .3, eL: .2, xL: .6, sR: .8, eR: .8, xR: .2, nod: .2 }],
    [.7, { hy: -.42, lean: -.15, roll: 0, twist: -.15, bend: -.35, hL: 1.5, kL: -1.6, fL: .1, hR: -.2, kR: -1.6, fR: -.3, sL: .9, eL: 1.4, xL: .15, sR: .4, eR: .5, xR: .1, nod: .15 }],
    [.88, { hy: -.12, lean: -.05, twist: 0, bend: -.25, hL: .6, kL: -.7, fL: .1, hR: -.1, kR: -.4, fR: 0, sL: .5, eL: .9, sR: .2, eR: .4, nod: .05 }], [1, "d"]],
    { contact: [[0, 1], [.6, 1], [.82, 0]], hip: [.25, .95], yaw: [.3, .9], gu: 1, hurry: 1 });
  A.clip("upFront", 1.05, [[0, "s"], [.24, { hx: 0, hy: -.62, lean: -1.2, bend: -.1, roll: 0, twist: 0, sL: 1.5, sR: 1.5, eL: .15, eR: .15, xL: .25, xR: .25, hL: .1, kL: -.3, fL: -1.3, hR: .1, kR: -.3, fR: -1.3, nod: .3, look: 0 }],
    [.46, { hy: -.55, lean: -.72, bend: -.35, hL: 1.6, kL: -2.25, fL: -.4, hR: 1.5, kR: -2.25, fR: -.4, sL: 1.2, eL: .1, sR: 1.2, eR: .1, nod: .35 }],
    [.7, { hy: -.42, lean: -.2, bend: -.35, hL: 1.5, kL: -1.6, fL: .1, hR: -.15, kR: -1.6, fR: -.3, sL: .9, eL: 1.4, xL: .15, sR: .5, eR: .6, xR: .1, nod: .15 }],
    [.88, { hy: -.12, lean: -.08, bend: -.25, hL: .6, kL: -.7, fL: .1, hR: -.1, kR: -.4, fR: 0, sL: .5, eL: .9, sR: .2, eR: .4, nod: .05 }], [1, "d"]],
    { contact: [[0, 1], [.6, 1], [.82, 0]], hip: [.25, .95], yaw: [.4, .9], gu: 1, hurry: 1 });
  /* --- machines. Path points (vehicle space): P0 start, D the door, B beside the saddle, PK beside a fallen bike, S the seat, F where you end up --- */
  function cab(name, ds) { var A1 = ds < 0 ? "R" : "L", A2 = ds < 0 ? "L" : "R", reach = {}, push = {}; reach["s" + A1] = .55; reach["x" + A1] = 1.05; reach["e" + A1] = .5; push["s" + A1] = -.15; push["x" + A1] = .85; push["e" + A1] = .35; reach["s" + A2] = .1; push["s" + A2] = .15;
    A.clip("in" + name, 1.7, [[0, "s"], [.24, STANDISH], [.36, sw(STANDISH, reach)], [.48, sw(STANDISH, { hy: -.04, bend: -.2, sL: .35, sR: .35, eL: .35, eR: .35, xL: .35, xR: .35, hL: .25, kL: -.35, hR: .25, kR: -.35, nod: -.05 })],
      [.64, { hy: -.32, lean: 0, bend: -.6, nod: -.15, hL: 1.15, kL: -1.45, fL: .3, hR: 1.15, kR: -1.45, fR: .3, sL: .5, sR: .5, eL: .5, eR: .5, xL: .3, xR: .3, side: 0, twist: 0, roll: 0, look: 0 }],
      [.8, { hy: "d", lean: "d", bend: -.3, nod: 0, hL: 1.75, kL: -1.7, fL: .2, hR: 1.65, kR: -1.8, fR: .2, sL: .6, sR: .6, eL: .6, eR: .6, xL: .2, xR: .2, side: "d" }], [1, "d"]],
      { veh: "cab", path: [[0, "P0"], [.24, "D"], [.46, "D"], [.8, "S"]], yawP: [[0, "Y0"], [.1, "W"], [.2, "W"], [.3, "A"], [.4, "A"], [.5, "OUT"], [.78, "OUT"], [.95, "A"]], sc: [.46, .7], ry: [0, .5], walk: [[0, 1], [.24, 1], [.3, 0]], door: [[.28, 0], [.38, 1], [.84, 1], [.96, 0]] });
    A.clip("out" + name, 1.5, [[0, "s"], [.2, { hy: "s", lean: "s", side: "s", bend: -.3, nod: 0, hL: 1.75, kL: -1.7, fL: .2, hR: 1.65, kR: -1.8, fR: .2, sL: .6, sR: .6, eL: .6, eR: .6, xL: .2, xR: .2, look: 0 }],
      [.42, { hy: -.32, lean: 0, side: 0, bend: -.6, nod: -.15, hL: 1.15, kL: -1.45, fL: .3, hR: 1.15, kR: -1.45, fR: .3, sL: .5, sR: .5, eL: .5, eR: .5, xL: .3, xR: .3, twist: 0, roll: 0 }],
      [.6, sw(STANDISH, { hy: -.04, bend: -.18, hL: .2, kL: -.3, hR: .2, kR: -.3, sL: .3, sR: .3 })], [.78, sw(STANDISH, push)], [1, "d"]],
      { veh: "cab", out: 1, path: [[0, "P0"], [.12, "P0"], [.55, "D"], [.66, "D"], [.95, "F"]], yawP: [[0, "Y0"], [.2, "OUT"], [.6, "OUT"], [.74, "A"], [.86, "A"], [1, "YF"]], sc: [.32, .56], ry: [.3, .6], walk: [[.6, 0], [.68, 1], [.95, 1], [1, 0]], door: [[.08, 0], [.2, 1], [.76, 1], [.9, 0]] });
  }
  cab("CabL", -1); cab("CabR", 1);
  var OVER = { hy: .04, lean: -.12, bend: -.3, hR: 1.95, kR: -2.25, fR: .35, hL: -.05, kL: -.12, fL: .05, sL: 1.2, sR: 1.2, eL: .4, eR: .4, xL: .12, xR: .05, twist: .12, roll: 0, side: 0, nod: .05, look: 0 };
  var GRIP = sw(STANDISH, { bend: -.18, sL: 1.05, sR: 1.05, eL: .45, eR: .45, xL: .12, xR: .05 });
  A.clip("inTwo", .95, [[0, "s"], [.3, GRIP], [.56, OVER], [1, "d"]],
    { veh: "two", path: [[0, "P0"], [.3, "B"], [.4, "B"], [.82, "S"]], yawP: [[0, "Y0"], [.1, "W"], [.2, "W"], [.34, "A"]], ry: [0, .6], walk: [[0, 1], [.22, 1], [.38, 0]] });
  A.clip("outTwo", 1.0, [[0, "s"], [.28, { hL: -.05, kL: -.12, fL: .05, bend: -.25, look: 0 }], [.52, OVER], [.78, sw(GRIP, { sR: .6, eR: .3 })], [1, "d"]],
    { veh: "two", out: 1, path: [[0, "P0"], [.18, "P0"], [.62, "B"], [.72, "B"], [1, "F"]], yawP: [[0, "Y0"], [.15, "A"], [.72, "A"], [1, "YF"]], ry: [.1, .6], walk: [[.72, 0], [.8, 1], [1, 1]] });
  A.clip("inSkate", .5, [[0, "s"], [.45, { hy: .03, hL: .5, kL: -.75, fL: .3, sL: .3, sR: .2, xL: .5, xR: .5, look: 0 }], [1, "d"]],
    { veh: "skate", path: [[0, "P0"], [.8, "S"]], yawP: [[0, "Y0"], [.7, "A"]], ry: [0, .7] });
  A.clip("outSkate", .42, [[0, "s"], [.5, { hy: .03, hR: .5, kR: -.75, fR: .3, look: 0 }], [1, "d"]],
    { veh: "skate", out: 1, path: [[0, "P0"], [.85, "F"]], yawP: [[0, "Y0"], [.85, "YF"]], ry: [0, .8] });
  function mirror(p) { if (typeof p !== "object") return p; var o = {}, k, MR = { hL: "hR", hR: "hL", kL: "kR", kR: "kL", fL: "fR", fR: "fL", sL: "sR", sR: "sL", eL: "eR", eR: "eL", xL: "xR", xR: "xL" }; for (k in p) { var v = p[k], nk = MR[k] || k; o[nk] = typeof v === "number" && (k === "twist" || k === "roll" || k === "look" || k === "side") ? -v : v; } return o; }
  function lift(name, R) { var m = R ? mirror : function (p) { return p; };
  A.clip(name, 2.1, [[0, "s"], [.17, STANDISH],
    [.32, { hy: -.4, bend: -.62, lean: 0, hL: 1.35, kL: -1.95, fL: .5, hR: .95, kR: -1.55, fR: .4, sL: 1.35, sR: 1.55, eL: .25, eR: .3, xL: .15, xR: .1, nod: .25, twist: 0, roll: 0, side: 0, look: 0 }],
    [.42, { hy: -.4, bend: -.62, hL: 1.35, kL: -1.95, fL: .5, hR: .95, kR: -1.55, fR: .4, sL: 1.35, sR: 1.55, eL: .25, eR: .3, nod: .25 }],
    [.58, { hy: -.12, bend: -.32, hL: .55, kL: -.75, fL: .15, hR: .45, kR: -.65, fR: .1, sL: 1.0, sR: 1.1, eL: .6, eR: .6, nod: .1 }],
    [.68, m(GRIP)], [.84, m(OVER)], [1, "d"]],
    { veh: "two", lift: [.42, .64], bs: R ? 1 : -1, path: [[0, "P0"], [.17, "PK"], [.68, "PK"], [.76, "B"], [.92, "S"]], yawP: [[0, "Y0"], [.08, "W"], [.12, "W"], [.22, "TOP"], [.6, "TOP"], [.72, "A"]], ry: [.6, .9], walk: [[0, 1], [.16, 1], [.22, 0]] }); }
  lift("liftBike", 0); lift("liftBikeR", 1);

  /* ----- forward kinematics of the figure, for keeping it on the ground. Same joint layout as rig() ----- */
  function M3() { return [1, 0, 0, 0, 1, 0, 0, 0, 1]; }
  var Mb = M3(), Mh = M3(), Ml = M3(), Mk = M3(), Mf = M3(), Mc = M3(), Ms = M3(), Me = M3(), Mhd = M3(), Mx = M3(), PB = [0, 0, 0], P1 = [0, 0, 0], P2 = [0, 0, 0], P3 = [0, 0, 0], P4 = [0, 0, 0];
  function eul(x, y, z, m) { var cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z); // three.js Euler "XYZ"
    m[0] = cy * cz; m[1] = -cy * sz; m[2] = sy; m[3] = cx * sz + sx * sy * cz; m[4] = cx * cz - sx * sy * sz; m[5] = -sx * cy; m[6] = sx * sz - cx * sy * cz; m[7] = sx * cz + cx * sy * sz; m[8] = cx * cy; return m; }
  function mm(a, b, o) { for (var i = 0; i < 9; i += 3) { var a0 = a[i], a1 = a[i + 1], a2 = a[i + 2]; o[i] = a0 * b[0] + a1 * b[3] + a2 * b[6]; o[i + 1] = a0 * b[1] + a1 * b[4] + a2 * b[7]; o[i + 2] = a0 * b[2] + a1 * b[5] + a2 * b[8]; } return o; }
  function tp(m, p, x, y, z, o) { o[0] = p[0] + m[0] * x + m[1] * y + m[2] * z; o[1] = p[1] + m[3] * x + m[4] * y + m[5] * z; o[2] = p[2] + m[6] * x + m[7] * y + m[8] * z; return o; }
  /* lowest point of the figure (soles, knees, hips, back, hands, head) above its own floor, in rig units; pts collects the points */
  A.fk = function (c, pts, feet) {
    var lo = 1e9, s, L; function pt(p, r, nm) { var v = p[1] - r; if (v < lo) lo = v; if (pts) pts.push([nm, p[0], p[1], p[2], r]); }
    eul(c.roll, 0, c.lean, Mb); PB[0] = c.fwd; PB[1] = c.y; PB[2] = c.side; mm(Mb, eul(0, -c.twist * .45, 0, Mx), Mh); pt(tp(Mh, PB, 0, .96, 0, P1), .15, "hips");
    for (s = -1; s <= 1; s += 2) { L = s < 0; tp(Mh, PB, 0, .92, s * .115, P1); mm(Mh, eul(0, 0, L ? c.hL : c.hR, Mx), Ml); pt(tp(Ml, P1, 0, -.44, 0, P2), .09, "knee"); mm(Ml, eul(0, 0, L ? c.kL : c.kR, Mx), Mk); tp(Mk, P2, 0, -.4, 0, P3); mm(Mk, eul(0, 0, L ? c.fL : c.fR, Mx), Mf); pt(tp(Mf, P3, .22, -.08, 0, P4), 0, "toe"); pt(tp(Mf, P3, -.07, -.08, 0, P4), 0, "heel"); }
    if (feet) return lo; // walking: only the soles matter
    tp(Mb, PB, 0, 1, 0, P1); mm(Mb, eul(-c.roll * .5, c.twist, c.bend, Mx), Mc); pt(tp(Mc, P1, 0, .12, 0, P2), .16, "waist"); pt(tp(Mc, P1, 0, .4, 0, P2), .17, "chest");
    for (s = -1; s <= 1; s += 2) { L = s < 0; tp(Mc, P1, 0, .5, s * .3, P2); pt(P2, .1, "shoulder"); mm(Mc, eul(L ? c.xL : -c.xR, L ? (c.yL || 0) : -(c.yR || 0), L ? c.sL : c.sR, Mx), Ms); pt(tp(Ms, P2, 0, -.32, 0, P3), .066, "elbow"); mm(Ms, eul(0, 0, L ? c.eL : c.eR, Mx), Me); pt(tp(Me, P3, .005, -.31, 0, P4), .074, "hand"); }
    tp(Mc, P1, 0, .56, 0, P2); mm(Mc, eul(-c.roll * .4, -c.twist * .75 + (c.look || 0), c.nod - (c.lean + c.bend) * .55, Mx), Mhd); pt(tp(Mhd, P2, 0, .3, 0, P3), .27, "head");
    return lo;
  };

  /* ----- roots ----- */
  var CABS = { keke: 1, car: 1, taxi: 1, bus: 1, pickup: 1, sport: 1, plane: 1 };
  function vKind(an, type) { return type === "skate" ? "skate" : CABS[type] ? "cab" : !an ? "two" : an.stand ? "skate" : an.door || an.roof ? "cab" : "two"; } // by machine first: a passenger's own seat anchor may not say
  function free(x, y) { var S = window.SamaruSim, W = Z.W; if (!S || !W || !S.push) return true; try { return !S.push(W, x, y, .22).hit && !(S.insideBuilding && S.insideBuilding(W, x, y)); } catch (e) { return true; } }
  /* which way to lie so head and feet stay out of walls */
  function lieYaw(x, y, a, back, s) { var tries = [0, .5, -.5, 1.1, -1.1, 1.8, -1.8, Math.PI], hd = back ? -1 : 1;
    for (var i = 0; i < tries.length; i++) { var ya = a + tries[i], cx = Math.cos(ya) * s, cy = Math.sin(ya) * s; if (free(x + cx * .95 * hd, y + cy * .95 * hd) && free(x - cx * .85 * hd, y - cy * .85 * hd) && free(x + cx * .5 * hd, y + cy * .5 * hd)) return ya; }
    return a; }
  /* vehicle-space point → world, and back */
  function v2w(F, f, l, o) { var ca = Math.cos(F.a), sa = Math.sin(F.a); o.x = F.x + f * ca - l * sa; o.z = F.y + f * sa + l * ca; return o; }
  function w2v(F, x, z, o) { var dx = x - F.x, dz = z - F.y, ca = Math.cos(F.a), sa = Math.sin(F.a); o.f = dx * ca + dz * sa; o.l = -dx * sa + dz * ca; return o; }
  function nearCam(x, y, st) { if (st.near != null) return !!st.near; var R = Z.r3; if (!R || R.tx == null) return true; var dx = x - R.tx, dy = y - R.ty; return dx * dx + dy * dy < 1225; }
  /* who to look at: someone talking nearby, else (for the people around you) you, else (for you) where the camera looks */
  function lookAt(o, x, y) { var B = Z.bubbles, best = null, bd = 49, i, d2, so, me = Z.me;
    if (B) for (i = 0; i < B.length; i++) { so = B[i].o === "me" ? me : B[i].o; if (!so || so === o || so.x == null) continue; d2 = (so.x - x) * (so.x - x) + (so.y - y) * (so.y - y); if (d2 < bd && d2 > .09) { bd = d2; best = so; } }
    if (!best && me && o !== me && !me.veh && me.x != null) { d2 = (me.x - x) * (me.x - x) + (me.y - y) * (me.y - y); if (d2 < 10 && d2 > .09) best = me; }
    return best ? Math.atan2(best.y - y, best.x - x) : null; }

  /* ----- running clips ----- */
  var WL = [], CQ = {}, O3 = {}, V1 = { f: 0, l: 0 }, V2 = { f: 0, l: 0 }, W1 = { x: 0, z: 0 };
  function wpush(w) { for (var i = 0; i < WL.length; i++) WL[i] *= 1 - w; WL.push(w); } // layer weights: always sum to 1
  /* a walking stride for a given speed and phase (legs and arm swing only), for steps taken inside a clip */
  function stride(sp, ph, out) { var gt = A.gait(sp), sn = Math.sin(ph), hA = key(G.hip, gt), hO = key(G.hof, gt), kS = key(G.ksw, gt), k0 = key(G.k0, gt), aA = key(G.arm, gt), swL = Math.max(0, Math.cos(ph)), swR = Math.max(0, -Math.cos(ph));
    out.hL = hO + sn * hA; out.hR = hO - sn * hA; out.kL = -(k0 + kS * Math.pow(swL, 1.25)); out.kR = -(k0 + kS * Math.pow(swR, 1.25)); out.fL = clamp(-(out.hL + out.kL) * .7, -.75, .9); out.fR = clamp(-(out.hR + out.kR) * .7, -.75, .9); out.sL = -sn * aA; out.sR = sn * aA; return out; }
  function roleOf(an, pil) { return pil && an && an.pillion ? an.pillion : an || {}; }
  function dsOf(an, pil) { var s = roleOf(an, pil).side || 0; return s > .02 ? 1 : -1; } // which side the door (or the step-on) is
  function startClip(r, pm, mode, st, o, x, y, a, sitK, sT) {
    var C = null, info = {}, lv = r.lv, w = r.w;
    w.sit = mode === "sit" ? 1 : 0; w.ride = mode === "ride" ? 1 : 0; w.fall = mode === "fall" ? 1 : 0; // the destination pose is the whole state, at once
    if (mode === "sit") C = CL[sitK === "chair" ? "sitChair" : sitK === "kneel" ? "sitKneel" : "sitGround"];
    else if (mode === "stand" || mode === "getup") {
      if (pm === "getup") return; // the getting-up clip simply runs on
      if (pm === "sit") C = CL[r.sitK === "chair" ? "standChair" : r.sitK === "kneel" ? "standKneel" : "standGround"];
      else if (pm === "fall") C = CL[r.lie === "front" ? "upFront" : "upBack"];
      else if (pm === "ride" && lv) { C = CL[lv.kind === "cab" ? (dsOf(lv.an, lv.pil) < 0 ? "outCabL" : "outCabR") : lv.kind === "skate" ? "outSkate" : "outTwo"]; info.F = { x: lv.x, y: lv.y, a: lv.a }; info.lv = lv; info.vo = lv.vo; }
    } else if (mode === "fall") {
      var push = o.kv && (o.kx || o.ky) ? Math.atan2(o.ky, o.kx) : o.hitT > 0 && o.hitA != null ? o.hitA : o.bumpT > 0 && o.bumpA != null ? o.bumpA : null, ahead = push != null && Math.cos(wrap(push - r.a)) > .2, ya = r.a;
      if (pm === "ride" && lv && lv.kind !== "cab") { var tip = lv.vo && lv.vo.tip ? lv.vo.tip : 0, sd = tip ? -Math.sign(tip) : push != null && Math.sin(wrap(push - lv.a)) > 0 ? 1 : -1; C = CL[sd > 0 ? "offBikeR" : "offBikeL"]; ya = lv.a; }
      else if (st.fall >= 50 || o.fall >= 50) C = CL.faint;
      else if (o.kv || (st.air || 0) > .02) { C = CL[ahead ? "tumbleFront" : "tumbleBack"]; if (push != null) ya = ahead ? push : push + Math.PI; }
      else if (push != null) C = CL[ahead ? "fallFront" : "fallBack"];
      else C = CL.fallFront; // tripped
      r.lie = C.lie; r.lieA = lieYaw(x, y, ya, C.lie !== "front", sT); r.pin = null;
    } else if (mode === "ride" && st.anc) {
      var an = st.anc, kd = vKind(an, st.veh), vo = st.vo;
      if (kd === "two" && vo && Math.abs(vo.tipA || 0) > .3 && !st.pil) { C = CL[(vo.tipA || 0) > 0 ? "liftBikeR" : "liftBike"]; info.top = (vo.tipA || 0) > 0 ? 1 : -1; info.tip0 = vo.tipA; }
      else C = CL[kd === "cab" ? (dsOf(an, st.pil) < 0 ? "inCabL" : "inCabR") : kd === "skate" ? "inSkate" : "inTwo"];
      info.vo = vo; info.an = an; info.pil = !!st.pil; info.vt = st.veh;
    }
    if (C) begin(r, C, info, x, y);
  }
  function begin(r, C, info, x, y) {
    var c = r.c, rt = r.root, cl = { C: C, u: 0, src: {}, hs: 0 }, k; if (!rt || c.lean == null) return;
    if (Math.hypot(rt.x - x, rt.z - y) > (C.veh ? 7 : 3.5)) { r.clip = null; return; } // a jump across the map is not a step
    for (k in c) cl.src[k] = c[k]; cl.src.y += r.yAdj || 0; hipXY(cl.src);
    cl.y0 = rt.yaw; cl.s0 = rt.s; cl.ry0 = rt.y; var ca = Math.cos(rt.yaw), sa = Math.sin(rt.yaw), hx = cl.src.hx * rt.s, hz = (c.side || 0) * rt.s;
    cl.hx0 = cl.px = rt.x + hx * ca - hz * sa; cl.hz0 = cl.pz = rt.z + hx * sa + hz * ca;
    for (k in info) cl[k] = info[k];
    if (C.veh) { var F = cl.F || { x: x, y: y, a: r.a }, an = cl.an || (cl.lv && cl.lv.an), pil = cl.pil != null ? cl.pil : cl.lv && cl.lv.pil;
      var VS = window.SamaruSim && SamaruSim.VEH && SamaruSim.VEH[cl.vt]; cl.vl = VS && VS.len ? VS.len : 2.6; cl.ds = dsOf(an, pil); cl.door = (an && an.door) || (C.veh === "cab" ? 1.15 : .62); cl.drv = cl.ds < 0 && !pil; w2v(F, cl.hx0, cl.hz0, V1); cl.p0 = { f: V1.f, l: V1.l }; }
    r.clip = cl;
  }
  /* named points of a vehicle clip's path, in the vehicle's space */
  function vpt(cl, nm, F, dq, sT, x, y, o) {
    var lvq = cl.lv && cl.lv.q, sf = cl.C.out ? (lvq ? cl.lv.s * lvq.hx : cl.p0.f) : sT * dq.hx;
    if (nm === "P0") { o.f = cl.p0.f; o.l = cl.p0.l; }
    else if (nm === "D") { o.f = sf; o.l = cl.ds * cl.door; }
    else if (nm === "B") { o.f = sf; o.l = (cl.C.bs || -1) * .62; }
    else if (nm === "PK") { o.f = sf + .05; o.l = (cl.top || 1) * .66; }
    else if (nm === "S") { if (cl.C.out) { o.f = cl.p0.f; o.l = cl.p0.l; } else { o.f = sT * dq.hx; o.l = sT * dq.side; } }
    else { w2v(F, x, y, o); } // F: where the game put you
    return o;
  }
  function vyaw(cl, nm, F, r) { return nm === "Y0" ? cl.y0 : nm === "W" ? (cl.yw == null ? cl.y0 : cl.yw) : nm === "A" ? F.a : nm === "OUT" ? F.a + cl.ds * HP : nm === "TOP" ? F.a - (cl.top || 1) * HP : r.a; }
  function clipRoot(r, cl, x, y, a, TY, sT, CQ, dt, dq) {
    var C = cl.C, u = cl.u, rt = r.root, s, yaw, hx, hz, i;
    if (C.veh) {
      var F = cl.F || { x: x, y: y, a: a }, P = C.path, n = P.length; i = 0; while (i < n - 1 && u > P[i + 1][0]) i++;
      if (cl.app == null) { vpt(cl, P[1][1], F, dq, sT, x, y, V2); var cf = cl.vl || 2.2; /* starting on the far side: round the nearer end, not through the car */
        if (C.veh === "cab" && !C.out && cl.p0.l * cl.ds < -.3) cl.corner = { f: (cl.p0.f >= V2.f ? 1 : -1) * (cf / 2 + .6), l: 0 };
        var dl = cl.corner ? Math.hypot(cl.corner.f - cl.p0.f, cl.corner.l - cl.p0.l) + Math.hypot(V2.f - cl.corner.f, V2.l - cl.corner.l) : Math.hypot(V2.f - cl.p0.f, V2.l - cl.p0.l);
        cl.u1 = P[1][0]; cl.app = C.out ? 0 : Math.max(0, dl / 2.4 - cl.u1 * C.d);
        if (C.out) { vpt(cl, P[n - 2][1], F, dq, sT, x, y, V1); vpt(cl, "F", F, dq, sT, x, y, V2); if (C.veh === "cab" && V2.l * cl.ds < -.3) cl.corner2 = { f: (V2.f >= V1.f ? 1 : -1) * (cf / 2 + .6), l: 0 };
          var d2 = cl.corner2 ? Math.hypot(cl.corner2.f - V1.f, cl.corner2.l - V1.l) + Math.hypot(V2.f - cl.corner2.f, V2.l - cl.corner2.l) : Math.hypot(V2.f - V1.f, V2.l - V1.l); cl.u2 = P[n - 2][0]; cl.lev = Math.max(0, d2 / 2.4 - (P[n - 1][0] - cl.u2) * C.d); } }
      vpt(cl, P[i][1], F, dq, sT, x, y, V1); if (i < n - 1) { vpt(cl, P[i + 1][1], F, dq, sT, x, y, V2); var e = seg(u, P[i][0], P[i + 1][0]); e = (i === 0 && cl.app > .2) || (i === n - 2 && cl.lev > .2) ? trap(e, .2) : sstep(e); /* a long walk: speed up, keep a pace, slow down */
        var cn = i === 0 ? cl.corner : i === n - 2 ? cl.corner2 : null; if (cn) { var c1 = Math.hypot(cn.f - V1.f, cn.l - V1.l), c2 = Math.hypot(V2.f - cn.f, V2.l - cn.l), ec = e * (c1 + c2); if (ec < c1) { V2.f = cn.f; V2.l = cn.l; e = ec / (c1 || 1); } else { V1.f = cn.f; V1.l = cn.l; e = (ec - c1) / (c2 || 1); } }
        V1.f += (V2.f - V1.f) * e; V1.l += (V2.l - V1.l) * e; }
      v2w(F, V1.f, V1.l, W1); hx = W1.x; hz = W1.z;
      if (cl.yw == null) { vpt(cl, P[1][1], F, dq, sT, x, y, V2); var dd = Math.hypot(V2.f - cl.p0.f, V2.l - cl.p0.l); v2w(F, V2.f, V2.l, W1); cl.yw = dd > .45 ? Math.atan2(W1.z - cl.hz0, W1.x - cl.hx0) : cl.y0; }
      var Y = C.yawP, m = Y.length, yv = vyaw(cl, Y[0][1], F, r), yp; yaw = yv; for (i = 1; i < m; i++) { yp = yv; yv = yp + wrap(vyaw(cl, Y[i][1], F, r) - yp); if (u <= Y[i][0]) { yaw = yp + (yv - yp) * sstep(seg(u, Y[i - 1][0], Y[i][0])); break; } yaw = yv; }
      s = cl.s0 + (sT - cl.s0) * sstep(seg(u, C.sc ? C.sc[0] : 0, C.sc ? C.sc[1] : .5));
    } else {
      var yT = r.mode === "fall" ? (r.lieA == null ? r.a : r.lieA) : r.a, ca0 = Math.cos(yT), sa0 = Math.sin(yT), k = sstep(seg(u, C.hip ? C.hip[0] : 0, C.hip ? C.hip[1] : .6));
      var tx = x + sT * (dq.hx * ca0 - dq.side * sa0), tz = y + sT * (dq.hx * sa0 + dq.side * ca0);
      if (cl.app == null) { cl.u1 = C.hip ? C.hip[1] : .6; cl.app = C.gu || C.lie ? 0 : Math.max(0, Math.hypot(tx - cl.hx0, tz - cl.hz0) / 2.4 - cl.u1 * C.d); }
      hx = cl.hx0 + (tx - cl.hx0) * k; hz = cl.hz0 + (tz - cl.hz0) * k;
      yaw = lerpA(cl.y0, yT, sstep(seg(u, C.yaw ? C.yaw[0] : 0, C.yaw ? C.yaw[1] : .5))); s = cl.s0 + (sT - cl.s0) * k;
    }
    cl.hs = Math.hypot(hx - cl.px, hz - cl.pz) / Math.max(dt, .001); cl.px = hx; cl.pz = hz;
    var ry = C.ry || [0, .5], ce = Math.cos(yaw), se = Math.sin(yaw), ox = s * CQ.hx, oz = s * CQ.side;
    rt.x = hx - (ox * ce - oz * se); rt.z = hz - (ox * se + oz * ce); rt.yaw = yaw; rt.s = s; rt.y = cl.ry0 + (TY - cl.ry0) * sstep(seg(u, ry[0], ry[1]));
  }
})();
