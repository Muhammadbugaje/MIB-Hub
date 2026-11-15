/* Freshers School Life — options in the shared arcade settings screen (docs/ARCADE_SETTINGS.md).
   Z.opt(id, fallback) reads a value anywhere (falls back when the runtime has no registry, as in the Node harnesses).
   Z.settingsInit(api) is called once from samaru.js init; nothing runs at load time. */
(function () {
  "use strict";
  var Z = window.SamaruGame; if (!Z) return;
  Z.opt = function (id, d) { var s = Z.api && Z.api.settings; if (s && typeof s.get === "function") { var v = s.get(id); return v === undefined || v === null ? d : v; } return d; };
  function r3() { return Z.r3 || null; }
  Z.settingsInit = function (api) {
    var S = api.settings; if (!S || typeof S.add !== "function") return;
    var pct = function (v) { return Math.round(v * 100) + "%"; }, SEC = Z.resolveText ? Z.resolveText("{{GAME_NAME}}") : "This game"; // the game's name from its config
    function later(f) { return function (v) { var R = r3(); if (R && R.ready) f(R, v); else { var n = 0, t = setInterval(function () { R = r3(); if ((R && R.ready) || ++n > 600) { clearInterval(t); if (R && R.ready) f(R, v); } }, 500); } }; }
    // graphics
    var man = null; try { man = api.store("samaru-gfx-manual") ? api.store("samaru-gfx") : null; } catch (e) {}
    S.add({ id: "gfx", tab: "display", section: SEC, label: "Graphics", type: "choice", default: man || "auto",
      choices: [["auto", "Automatic"], ["high", "High"], ["mid", "Balanced"], ["low", "Fast"]], help: "Automatic lowers detail by itself if the game starts to stutter.",
      apply: later(function (R, v) { if (!R.setQuality) return; if (v === "auto") { R.autoOff = false; try { Z.api.store("samaru-gfx-manual", null); } catch (e) {} } else R.setQuality(v); }) });
    S.add({ id: "draw", tab: "display", section: SEC, label: "Draw distance", type: "choice", default: "normal", choices: [["normal", "Normal"], ["far", "Far (slower)"]], apply: later(function (R, v) { R.drawAdd = v === "far" ? 1 : 0; }) });
    S.add({ id: "shadows", tab: "display", section: SEC, label: "Shadows", type: "toggle", default: true,
      apply: later(function (R, v) { R.noShadows = !v; if (R.setQuality && R.tier) R.setQuality(R.tier, true); }) });
    S.add({ id: "crowd", tab: "gameplay", section: "Campus", label: "Crowd density", type: "slider", default: 1, min: .25, max: 1.5, step: .05, format: pct, help: "Fewer people is faster on older phones." });
    S.add({ id: "traffic", tab: "gameplay", section: "Campus", label: "Traffic density", type: "slider", default: 1, min: .25, max: 1.5, step: .05, format: pct });
    // camera
    S.add({ id: "camDist", tab: "controls", section: "Camera", label: "Camera distance", type: "slider", default: 1, min: .6, max: 1.8, step: .05, format: pct, apply: later(function (R, v) { R.camMul = v; }) });
    S.add({ id: "camHeight", tab: "controls", section: "Camera", label: "Camera height", type: "slider", default: 0, min: -.6, max: 2, step: .1, format: function (v) { return (v > 0 ? "+" : "") + v.toFixed(1) + " m"; }, apply: later(function (R, v) { R.camLift = v; }) });
    S.add({ id: "fov", tab: "controls", section: "Camera", label: "Field of view", type: "slider", default: 0, min: -10, max: 15, step: 1, format: function (v) { return (58 + v) + "°"; }, apply: later(function (R, v) { R.fovAdd = v; }) });
    S.add({ id: "follow", tab: "controls", section: "Camera", label: "Camera turns to follow you", type: "toggle", default: true, apply: later(function (R, v) { R.followOff = !v; }) });
    // look sensitivity and invert come from the shared Controls tab (game.look = true)
    function look() { Z.lookSens = +Z.opt("lookSens", 1) || 1; Z.invertY = !!Z.opt("invertY", false); if (Z.touch) Z.touch.sens = Z.lookSens; }
    look(); if (S.on) S.on(function (id) { if (id === "lookSens" || id === "invertY") look(); });
    // audio
    S.add({ id: "radioVol", tab: "audio", section: SEC, label: "Vehicle radio", type: "slider", default: 1, min: 0, max: 1, step: .05, format: pct, apply: function (v) { if (api.settings && Z.me && Z.me.veh) { api.settings.musicMul = v; if (api.sound.applySet) api.sound.applySet(); } } });
    S.add({ id: "fill", tab: "audio", section: SEC, label: "Lines nobody recorded", type: "choice", default: S.fill || (S.robot ? "robot" : "phrases"),
      choices: [["phrases", "Play a matching phrase"], ["murmur", "Short murmur"], ["robot", "Robot voice"]], help: "The words always show on screen.", apply: function (v) { S.fill = v; } });
    // HUD and help
    S.add({ id: "mapRot", tab: "display", section: "HUD", label: "Minimap turns with the camera", type: "toggle", default: true });
    S.add({ id: "hudMap", tab: "display", section: "HUD", label: "Show minimap", type: "toggle", default: true });
    S.add({ id: "hudSpeed", tab: "display", section: "HUD", label: "Show speedometer", type: "toggle", default: true });
    S.add({ id: "hudGoal", tab: "display", section: "HUD", label: "Show distance to your goal", type: "toggle", default: true });
    S.add({ id: "units", tab: "display", section: "HUD", label: "Speed units", type: "choice", default: "kmh", choices: [["kmh", "km/h"], ["mph", "mph"]] });
    S.add({ id: "tips", tab: "gameplay", section: "Help", label: "First-time tips", type: "toggle", default: true, help: "The walkthrough can be replayed from Phone → How to play." });
  };
})();
