/* Freshers School Life — entry point: controls and the Arcade.run hook. The game itself is in samaru-core.js (loop),
   samaru-ui.js (menus), samaru-draw.js (rendering), samaru-sim.js (rules) and samaru-data.js (content). */
(function () {
  "use strict";
  var Z = window.SamaruGame;
  var game = {
    song: Arcade.song(500, "afro", { bpm: 100, scale: "major" }),
    bleed: true, // the 3D world fills the whole stage on wide phones; the HUD stays in the 16:9 middle
    actions: [
      { id: "up", label: "Up / accelerate", keys: ["KeyW", "ArrowUp"] }, { id: "down", label: "Down / brake", keys: ["KeyS", "ArrowDown"] },
      { id: "left", label: "Left", keys: ["KeyA", "ArrowLeft"] }, { id: "right", label: "Right", keys: ["KeyD", "ArrowRight"] },
      { id: "run", label: "Run", keys: ["ShiftLeft", "ShiftRight"] },
      { id: "jump", label: "Jump / hop (bicycle, skateboard); in deep water: dive / come up", keys: ["Space"] },
      { id: "drift", label: "Handbrake / drift", keys: ["KeyX", "ControlLeft"] },
      { id: "act", label: "Talk, enter, ride", keys: ["KeyE", "Enter"] },
      { id: "attack", label: "Punch (jab, cross, kick)", keys: ["KeyJ"] }, { id: "kick", label: "Kick (running: tackle)", keys: ["KeyL"] }, { id: "block", label: "Block (hold); block + punch = shove", keys: ["KeyB"] }, { id: "cancelJob", label: "Cancel the job you are on", keys: ["KeyX"] },
      { id: "throw", label: "Throw slipper", keys: ["KeyK"] },
      { id: "torch", label: "Torch", keys: ["KeyF"] },
      { id: "phone", label: "Phone", keys: ["KeyQ", "Tab"] },
      { id: "pocket", label: "Pockets (inventory)", keys: ["KeyI"] },
      { id: "hot1", label: "Quick slot 1 (eat or drink)", keys: ["Digit5"] }, { id: "hot2", label: "Quick slot 2", keys: ["Digit6"] }, { id: "hot3", label: "Quick slot 3", keys: ["Digit7"] },
      { id: "map", label: "Full map", keys: ["KeyN"] },
      { id: "camL", label: "Look left", keys: ["Comma"] }, { id: "camR", label: "Look right", keys: ["Period"] },
      { id: "emote1", label: "Wave", keys: ["Digit1"] }, { id: "emote2", label: "Dance", keys: ["Digit2"] },
      { id: "emote3", label: "Sit", keys: ["Digit3"] }, { id: "emote4", label: "Sparring stance (multiplayer)", keys: ["Digit4"] },
      { id: "horn", label: "Horn", keys: ["KeyH"] }, { id: "radio", label: "Radio station", keys: ["KeyR"] },
      { id: "coop", label: "Friends mission action", keys: ["KeyG"] }
    ],
    look: true, // the shared settings screen offers look sensitivity and invert-Y
    savePrefix: ["ee-arcade-fslg", "ee-arcade-samaru"], // Settings → Data exports, imports and resets these
    init: function (api) {
      Z.setup(api); if (Z.settingsInit) Z.settingsInit(api);
      var T = function (s) { return Z.resolveText ? api.esc(Z.resolveText(s)) : s; };
      api.panel("<p><b>" + T("{{GAME_NAME}}") + "</b> (" + T("{{GAME_INITIALS}}") + ") is a third-person school-life game set on a designed campus: a ring road, a palm boulevard from the Main Gate to the fountain, the Selfie Garden and Senate tower at the centre, hostels, faculties, Shinkafi, the Social Centre, seven gardens, a lake, an airfield and a market town outside the gate.</p>" +
        "<p>One real second is one game minute. Food and energy run down as you move; running costs more, sitting and sleeping restore. Vehicles use a simple momentum model: thrust along the heading, drag, and sideways grip that the handbrake reduces, so fast machines slide in bends. Off the road every machine is slower.</p>" +
        "<p class='gm-small'>Music changes with where you are and the time of day. Designed and built by Muhammad Iliyasu Bugaje. The students and staff in the story are fictional.</p>",
        "<p>Third-person 3D. <b>Click the game once</b> to capture the mouse: then just move the mouse to look, click to hit, scroll to zoom, Esc to release. On a phone the <b>left stick moves</b> (push it right to the rim to sprint) and <b>dragging a finger on the right side of the screen looks around</b>; Jump, Use and Hit sit under the right thumb, and FULL fills the screen. Tap or click the minimap to open the full map. A gamepad works too. Everything else is one button: <b>E</b>. Phone → Me switches graphics between High (shadows) and Fast.</p>" +
        "<p><b>Swimming.</b> Walk into deep water at The Dam to swim (slower than walking). <b>Shift</b> (or the stick at the rim) is the sprint stroke, which uses energy. <b>Space</b> (the phone's DIVE button) dives and comes back up; under water a breath bar runs down, and when it is empty you simply rise to the surface. Swim to any bank, the pier or the visitor-centre steps to climb out (<b>E</b> at the steps). The board by the steps starts the buoy swim.</p>");
      Z.ui.title();
    },
    update: function (dt) { Z.update(dt); },
    draw: function () { Z.draw(); },
    click: function (x, y) { Z.click(x, y); },
    menu: function () { Z.save(); Z.netLeave(); Z.ui.title(); },
    saves: function () { if (Z.saves) Z.saves.open(); } // the pause dialog's "Saves" (arcade.js)
  };
  Arcade.run(game);
})();
