/* Freshers School Life — guide module: the first-day walkthrough ("use this to do that") and one-time tips.
   Each walkthrough step is a small card with a picture of the control; it ticks itself off only when the player really does
   the thing. Progress lives in the save as P.guide = { s: step, done, hints: {id: 1} }; saves without it count as finished.
   The card is a DOM element on the stage (readable on a phone); the spotlight ring and the "go here" marker are drawn on
   the HUD canvas. Nothing here blocks play: the card hides itself whenever a menu or the big map is open. */
(function () {
  "use strict";
  var Z = window.SamaruGame, S = window.SamaruSim;
  if (!Z) return;
  var G = Z.guide = {}, card = null, cardKey = "", dev = "kb", wired = false, run = null, tip = null, tipWait = 4, pollT = 0, pulsed = null, shownSpot = null, shownMark = null, endT = 0, visible = false, lastP = null, lead = 0, placeT = 99, placeKey = "", wasTall = false, tallCls = false;
  var TAU = Math.PI * 2, XP_STEP = 5, XP_END = 40;
  var CSS = ".fg-card{position:absolute;left:50%;top:14.5%;transform:translateX(-50%);z-index:2;width:min(430px,calc(100% - 24px));max-width:60%;box-sizing:border-box;padding:9px 12px 10px;border-radius:14px;background:rgba(4,12,20,.86);border:1px solid rgba(126,240,255,.45);color:#eafcff;font:500 14px/1.35 system-ui,sans-serif;pointer-events:none;box-shadow:0 8px 24px rgba(0,0,0,.35);transition:border-color .2s,background .2s,opacity .25s}" +
    ".fg-card[hidden]{display:none}.fg-card.is-done{border-color:#86efac;background:rgba(6,40,22,.9)}.fg-card.is-tip{border-color:rgba(253,224,71,.6)}" +
    ".fg-top{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:10.5px;font-weight:800;letter-spacing:.08em;color:#7ef0ff;margin-bottom:5px}.fg-card.is-tip .fg-top{color:#fde047}.fg-card.is-done .fg-top{color:#86efac}" +
    ".fg-top button{pointer-events:auto;font:inherit;font-weight:700;letter-spacing:0;color:#cbd5e1;background:rgba(255,255,255,.1);border:0;border-radius:8px;padding:5px 9px;min-height:26px;cursor:pointer;margin-left:4px}.fg-top button:hover{background:rgba(255,255,255,.2)}" +
    ".fg-body{display:flex;align-items:center;gap:11px}.fg-keys{display:flex;align-items:center;gap:4px;flex:0 0 auto;flex-wrap:wrap;max-width:46%;justify-content:center}" +
    ".fg-k{display:inline-block;min-width:26px;padding:4px 7px;border-radius:7px;background:#f8fafc;color:#0f172a;font:800 13px/1.2 system-ui,sans-serif;text-align:center;box-shadow:0 3px 0 #94a3b8;box-sizing:border-box}" +
    ".fg-b{display:inline-grid;place-items:center;min-width:38px;height:38px;padding:0 7px;box-sizing:border-box;border-radius:19px;background:rgba(255,255,255,.14);border:2px solid #7ef0ff;font-size:11px;font-weight:800;letter-spacing:.03em;color:#fff;white-space:nowrap}" +
    ".fg-keys svg{display:block}.fg-plus{color:#94a3b8;font-weight:800}.fg-text{flex:1 1 auto;min-width:0}.fg-text b{display:block;color:#fff;font-size:15px}.fg-text span{color:rgba(234,252,255,.9)}" +
    ".fg-tick{display:inline-grid;place-items:center;width:38px;height:38px;border-radius:50%;background:#22c55e;color:#04140d;font-size:22px;font-weight:900;animation:fgpop .35s ease-out}" +
    ".fg-bar{height:4px;border-radius:2px;background:rgba(255,255,255,.14);margin-top:8px;overflow:hidden}.fg-bar i{display:block;height:100%;background:#22d3ee;border-radius:2px;transition:width .3s}" +
    ".fg-ok{pointer-events:auto;display:block;margin:8px 0 0 auto;font:700 13px system-ui,sans-serif;color:#04140d;background:#7ef0ff;border:0;border-radius:9px;padding:7px 16px;min-height:32px;cursor:pointer}" +
    ".fg-card.is-min{width:auto;max-width:none;padding:0;background:none;border:0;box-shadow:none}.fg-card.is-min .fg-pill{pointer-events:auto;font:800 12px system-ui,sans-serif;color:#04140d;background:#7ef0ff;border:0;border-radius:999px;padding:7px 13px;min-height:30px;cursor:pointer}" +
    ".fg-pulse{box-shadow:0 0 0 3px #22d3ee,0 0 16px 6px rgba(34,211,238,.6)!important;animation:fgpulse 1s ease-in-out infinite}.fg-card.is-touch{left:54.5%;max-width:43%}" +
    "@keyframes fgpulse{50%{box-shadow:0 0 0 8px rgba(34,211,238,.4),0 0 26px 12px rgba(34,211,238,.35)}}@keyframes fgpop{0%{transform:scale(.3)}70%{transform:scale(1.2)}100%{transform:scale(1)}}" +
    "@media (max-width:640px),(max-height:440px){.fg-card{font-size:12px;padding:6px 9px 7px;border-radius:11px;max-width:62%}.fg-text b{font-size:13px}.fg-top{font-size:9.5px;margin-bottom:3px}.fg-k{min-width:20px;padding:3px 5px;font-size:11px}.fg-b{min-width:30px;height:30px;font-size:10px;padding:0 5px}.fg-keys svg{width:34px;height:34px}.fg-bar{margin-top:5px;height:3px}.fg-body{gap:8px}}" +
    ".fg-card.is-tall,.fg-card.is-tall.is-touch{left:50%;max-width:none;width:calc(100% - 20px)}.fg-top .fg-go{color:#04140d;background:#7ef0ff}" +
    "@media (prefers-reduced-motion:reduce){.fg-pulse,.fg-tick{animation:none}}";

  /* ---------- small helpers ---------- */
  function P() { return Z.P; }
  function state() { var p = Z.P; if (!p) return null; if (!p.guide || typeof p.guide !== "object") p.guide = { done: 1, hints: {} }; if (!p.guide.hints) p.guide.hints = {}; return p.guide; }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function esc(s) { return Z.api && Z.api.esc ? Z.api.esc(String(s)) : String(s); }
  function three() { return !!(Z.r3 && Z.r3.ready); }
  function key(id) { var n = String(Z.api.keyName(id) || id).split(" / ")[0]; return "<kbd class='fg-k'>" + esc(n) + "</kbd>"; }
  var TOUCH_LABEL = { act: "USE", jump: "JUMP", attack: "HIT", run: "RUN", phone: "PHONE", torch: "TORCH", emote1: "WAVE", emote2: "DANCE", emote3: "SIT", horn: "HORN", radio: "RADIO", map: "MAP" };
  var PAD_LABEL = { jump: "A", attack: "B", act: "X", phone: "Y", radio: "LB", horn: "RB", run: "RT", emote1: "D↑", emote3: "D↓", emote2: "D→", torch: "D←", map: "BACK" };
  // The on-screen button that does an action right now: samaru-touch's own buttons (the small one changes with context,
  // the rest live behind MORE), or the arcade's stock touch keys if that module is absent.
  function touchBtn(id) {
    var B = Z.touch && Z.touch.buttons, b = null;
    if (B) { if (B.ctx && B.ctx._a === id && !B.ctx.hidden) return { el: B.ctx }; if (B.attack && B.attack._a === id) return { el: B.attack }; if (B[id] && id !== "attack") return { el: B[id] }; if (B["m_" + id]) return { el: B.more, tray: B["m_" + id] }; if (B.attack && id === "attack") return { el: B.attack }; }
    try { b = document.querySelector("[data-gm-touch] [data-id='" + id + "']"); } catch (_) {}
    return b && b.nodeType === 1 ? { el: b } : null;
  }
  function word(el, id) { var t = el && el.textContent ? el.textContent.trim() : ""; return esc(t && t !== "…" ? t : TOUCH_LABEL[id] || "●"); }
  function btn(id) {
    if (dev === "pad") return "<span class='fg-b'>" + esc(PAD_LABEL[id] || "●") + "</span>";
    var b = touchBtn(id); if (b && b.tray) return "<span class='fg-b'>" + word(b.el, "more") + "</span><span class='fg-plus'>›</span><span class='fg-b'>" + word(b.tray, id) + "</span>";
    return "<span class='fg-b'>" + word(b && b.el, id) + "</span>";
  }
  function ctl(id) { return dev === "kb" ? key(id) : btn(id); }
  function kb() { return dev === "kb"; }
  function stick(side, far) { var dx = far ? 13 : 7; return "<svg width='42' height='42' viewBox='0 0 42 42' aria-hidden='true'><circle cx='21' cy='21' r='18' fill='rgba(255,255,255,.08)' stroke='#7ef0ff' stroke-width='2'/><circle cx='" + (21 + (side === "R" ? dx : 0)) + "' cy='" + (21 - (side === "R" ? 0 : dx)) + "' r='8' fill='#f8fafc'/><text x='21' y='40' text-anchor='middle' font-size='7' font-weight='800' fill='#7ef0ff'>" + (side === "R" ? "RIGHT" : "LEFT") + "</text></svg>"; }
  function mouse(click) { return "<svg width='30' height='42' viewBox='0 0 30 42' aria-hidden='true'><rect x='4' y='3' width='22' height='36' rx='11' fill='#f8fafc' stroke='#94a3b8' stroke-width='2'/><path d='M15 3v14M4 17h22' stroke='#94a3b8' stroke-width='2'/>" + (click ? "<path d='M5 16V14a10 10 0 0 1 9-10v12z' fill='#22d3ee'/>" : "<path d='M0 24l-4 3 4 3M30 24l4 3-4 3' stroke='#7ef0ff' stroke-width='2' fill='none' transform='translate(0,-6)'/>") + "</svg>"; }
  function plus() { return "<span class='fg-plus'>+</span>"; }
  function sprintByStick() { return !!(Z.touch && Z.touch.sticks) && dev === "touch"; }
  function nearestNpc() { var me = Z.me, best = null, bd = 1e9; Z.npcs.forEach(function (n) { if (n.hidden) return; var d = dist(n, me); if (d < bd) { bd = d; best = n; } }); return best; }
  function nearestRide() { var me = Z.me, p = Z.P, best = null, bd = 1e9; Z.cars.forEach(function (c) { var sp = S.VEH[c.type]; if (!sp || p.lvl < sp.lvl || c.type === "plane") return; var d = dist(c, me) + (c.type === "bike" ? 0 : 14) + (sp.rent && !c.free && !p.flags["own_" + c.type] ? 60 : 0); if (d < bd) { bd = d; best = c; } }); return best; }

  /* ---------- the walkthrough ---------- */
  // Each step: title, text(dev), keys(dev) pictures, optional spot (HUD area), pulse (touch button id), mark() world target,
  // skip() to leave a step out, start(r), check(r, dt) polled every frame, ev(e) for game events, info: finished with "Got it".
  var STEPS = [
    { id: "look", title: "Look around", skip: function () { return !three(); },
      keys: function (d) { return d === "touch" ? "<span style='font-size:1.6em' aria-hidden='true'>👆 ⟷</span> <b>DRAG THE RIGHT SIDE</b>" : d !== "kb" ? stick("R") : mouse() + key("camL") + key("camR"); },
      text: function (d) { return d === "touch" ? "Drag on the right side of the screen to look around." : d === "pad" ? "Move the right stick to turn the camera." : "Click the game once to capture the mouse, then move it to look. Scroll zooms; the two keys turn the camera too."; },
      spot: function (d) { return d === "touch" ? "stickR" : ""; },
      start: function (r) { r.yaw = Z.r3.yaw; r.acc = 0; }, check: function (r) { var y = Z.r3.yaw; r.acc += Math.abs(y - r.yaw); r.yaw = y; return r.acc > .9; } },
    { id: "walk", title: "Walk", keys: function (d) { return d !== "kb" ? stick("L") : key("up") + key("left") + key("down") + key("right"); },
      text: function (d) { return d === "touch" ? "Drag anywhere on the left half of the screen: that is your move stick." : d === "pad" ? "Push the left stick the way you want to go." : "Walk a few steps. You go where the camera faces."; },
      spot: function (d) { return d === "touch" ? "stickL" : ""; },
      start: function (r) { r.x = Z.me.x; r.y = Z.me.y; r.acc = 0; }, check: function (r) { var me = Z.me, d = Math.hypot(me.x - r.x, me.y - r.y); if (!me.veh && d < 2) r.acc += d; r.x = me.x; r.y = me.y; return r.acc > 5; } },
    { id: "sprint", title: "Sprint", keys: function (d) { return d === "kb" ? key("run") + plus() + key("up") : sprintByStick() ? stick("L", 1) : stick("L") + plus() + btn("run"); },
      text: function (d) { return (d === "kb" ? "Hold it while you move." : sprintByStick() ? "Push the left stick right out to its rim to run." : d === "pad" ? "Hold the trigger while you move." : "Tap the run button while moving.") + " Running uses ENERGY faster."; },
      spot: function () { return sprintByStick() ? "stickL" : ""; }, pulse: function () { return sprintByStick() ? "" : "run"; }, spotK: 1,
      start: function (r) { r.acc = 0; }, check: function (r, dt) { var me = Z.me, fast = !me.veh && me.speed > 4.6; if (fast) r.acc += dt; return r.acc > .8; } },
    { id: "jump", title: "Jump", keys: function () { return ctl("jump"); }, pulse: "jump",
      text: function () { return "Jump. It clears open gutters and low kerbs."; }, check: function () { return Z.me.z > .05 && !Z.me.veh; } },
    { id: "talk", title: "Talk to someone", keys: function () { return ctl("act"); }, pulse: "act",
      text: function (d, r) { var n = r && r.npc; return "Walk up to " + (n ? esc(n.def.name) : "anyone") + " and press it. One button talks, enters places and rides."; },
      start: function (r) { r.npc = nearestNpc(); }, mark: function (r) { return r.npc ? { x: r.npc.x, y: r.npc.y, name: r.npc.def.name, h: 2.9 } : null; }, ev: function (e) { return e.t === "talk"; } },
    { id: "phone", title: "Your phone", keys: function () { return ctl("phone"); }, pulse: "phone",
      text: function () { return "Open your phone and tap <b style='display:inline;font-size:inherit'>Goals</b>. Jobs, contacts, radio and multiplayer are in there too."; }, ev: function (e) { return e.t === "ui:goals"; } },
    { id: "gps", title: "Follow the yellow line", spot: function () { return "map"; }, keys: function () { return "<svg width='42' height='42' viewBox='0 0 42 42' aria-hidden='true'><circle cx='21' cy='21' r='18' fill='#14532d' stroke='#f8fafc' stroke-width='2'/><path d='M10 30l8-8 4 3 9-13' stroke='#fde047' stroke-width='3.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/><circle cx='31' cy='12' r='3.5' fill='#fde047'/></svg>"; },
      text: function () { return "The line on the minimap leads to your goal. The star is the goal; its name and distance are below the map."; },
      skip: function () { return !Z.target || !Z.target(); }, start: function (r) { var t = Z.target(); r.d0 = t ? dist(t, Z.me) : 0; }, check: function (r) { var t = Z.target(); return !t || r.d0 - dist(t, Z.me) > 12 || dist(t, Z.me) < 14; } },
    { id: "bike", title: "Get on a bicycle", keys: function () { return ctl("act"); }, pulse: "act",
      text: function () { return "Bicycles and skateboards are free. Walk to one and press it. Faster machines need a licence level."; },
      skip: function () { return !!Z.me.veh || !nearestRide(); }, start: function (r) { r.car = nearestRide(); }, mark: function (r) { var c = r.car; return c ? { x: c.x, y: c.y, name: S.VEH[c.type].name, h: 2.2 } : null; }, check: function () { return !!Z.me.veh; } },
    { id: "ride", title: "Ride", keys: function (d) { return d !== "kb" ? stick("L") + btn("jump") : key("up") + key("down") + key("left") + key("right") + key("jump"); },
      text: function (d, r) { var where = r && r.to && r.to.name === "Fountain" ? "Ride down the boulevard to the fountain. " : "Ride to the marker. "; return where + (d !== "kb" ? "Point the left stick where you want to go. The big button is the brake." : "Up goes, down brakes, " + Z.api.keyName("jump").split(" / ")[0] + " is the handbrake."); },
      skip: function () { return !Z.me.veh; },
      start: function (r) { var me = Z.me, f = { x: 0, y: -334, name: "Fountain" }; r.x = me.x; r.y = me.y; r.acc = 0; if (Z.W && Z.W.designed && dist(f, me) < 600 && dist(f, me) > 60) r.to = f; },
      mark: function (r) { if (!Z.me.veh) { var c = nearestRide(); return c ? { x: c.x, y: c.y, name: "Get back on", h: 2.2 } : null; } return r.to ? { x: r.to.x, y: r.to.y, name: r.to.name, h: 3 } : null; },
      check: function (r) { var me = Z.me, d = Math.hypot(me.x - r.x, me.y - r.y); if (me.veh && d < 6) r.acc += d; r.x = me.x; r.y = me.y; return me.veh && (r.to ? dist(r.to, me) < 26 : r.acc > 140); } },
    { id: "radio", title: "Radio", keys: function () { return ctl("radio"); }, pulse: "radio", spot: function () { return "speedo"; },
      text: function () { return "Every bicycle, okada, keke and car has a radio. Change the station."; }, skip: function () { return !Z.me.veh || Z.me.veh.type === "skate"; }, ev: function (e) { return e.t === "ui:radio"; }, check: function () { return !Z.me.veh; } },
    { id: "off", title: "Get off", keys: function () { return ctl("act"); }, pulse: "act",
      text: function () { return "Slow to a stop, then press it to get off. Your machine stays where you leave it."; }, skip: function () { return !Z.me.veh; }, check: function () { return !Z.me.veh; } },
    { id: "punch", title: "Throw a punch", keys: function (d) { return d === "kb" ? key("attack") + mouse(1) : btn("attack"); }, pulse: "attack",
      text: function () { return "Punch the air. Three quick hits end in a heavy one. Leave bystanders alone or security comes."; }, check: function () { return Z.me.punch > 0; } },
    { id: "wave", title: "Wave", keys: function (d) { return d === "kb" ? key("emote1") + key("emote2") + key("emote3") : btn("emote1"); }, pulse: "emote1",
      text: function (d) { return d !== "kb" ? "Wave at people: they wave back and friendships grow. Dance and sit are" + (d === "pad" ? " on the D-pad too." : " under MORE.") : "Wave: people wave back and friendships grow. The next two keys dance and sit."; }, ev: function (e) { return e.t === "emote" && e.emote === "wave"; } },
    { id: "needs", title: "Food, energy and money", info: true, spot: function () { return "bars"; }, keys: function () { return "<svg width='46' height='40' viewBox='0 0 46 40' aria-hidden='true'><rect x='1' y='2' width='44' height='8' rx='4' fill='#ef4444'/><rect x='1' y='14' width='44' height='8' rx='4' fill='#3f3f46'/><rect x='1' y='14' width='30' height='8' rx='4' fill='#fb923c'/><rect x='1' y='26' width='44' height='8' rx='4' fill='#3f3f46'/><rect x='1' y='26' width='20' height='8' rx='4' fill='#38bdf8'/></svg>"; },
      text: function (d) { return "They run down as you move. Eat at any orange marker; sit (" + (d === "kb" ? Z.api.keyName("emote3").split(" / ")[0] : d === "pad" ? "D-pad down" : "MORE › SIT") + ") to rest. Run low and you get slow and weak, so eat before a long trip."; } },
    { id: "sleep", title: "Your hostel", info: true, spot: function () { return "map"; }, keys: function () { return "<svg width='42' height='42' viewBox='0 0 42 42' aria-hidden='true'><circle cx='21' cy='21' r='18' fill='#14532d' stroke='#f8fafc' stroke-width='2'/><rect x='14' y='14' width='14' height='14' rx='2' fill='#2563eb' stroke='#fff' stroke-width='2'/></svg>"; },
      text: function () { var h = Z.place && Z.place("@home"); return "The dark blue square is " + (h ? esc(h.name) : "your hostel") + ". Sleep there to restore everything and save. Classes (purple, 08:00 to 18:00) level you up."; } }
  ];
  G.STEPS = STEPS.map(function (s) { return s.id; });

  /* ---------- one-time tips after the walkthrough ---------- */
  var HINTS = [
    { id: "veh", title: "Riding and driving", when: function (p, me) { return !!me.veh && me.veh.type !== "plane"; }, keys: function (d) { return d !== "kb" ? stick("L") + btn("jump") + btn("radio") : key("up") + key("down") + key("jump") + key("horn") + key("radio"); }, text: function (d) { return d !== "kb" ? "Point the left stick to steer and go; pull back to brake. Buttons: handbrake, horn, radio. Stop before getting off." : "Up accelerates, down brakes and reverses. X (or left Ctrl) is the handbrake: hold it while steering to drift. Space hops a bicycle or skateboard. Then horn and radio. Stay on the road: grass and sand are slower."; } },
    { id: "plane", title: "Flying", when: function (p, me) { return !!me.veh && me.veh.type === "plane"; }, text: function () { return "Hold the throttle down the runway: the aircraft lifts off by itself at speed. To land, slow down over open ground, never over water or roofs."; } },
    { id: "shop", title: "Buying things", spot: "money", when: function (p, me, n) { return !!n.shop; }, text: function () { return "Your money is under the bars at the top left. Jobs, races and the daily alert at the bank bring more."; } },
    { id: "fight", title: "Fight", when: function () { return Z.foes.length > 0 && !Z.blackout; }, keys: function (d) { return d !== "kb" ? btn("attack") + stick("L") : key("attack") + key("throw"); }, text: function (d) { return d !== "kb" ? "Face the enemy and hit. Keep moving: red rings on the ground are attacks about to land." : "Face the enemy and hit; double-tap a direction to dodge. Red rings on the ground are attacks about to land."; } },
    { id: "blackout", title: "No light", when: function () { return !!Z.blackout; }, keys: function () { return ctl("torch") + ctl("attack"); }, text: function () { return "When the light goes, shades come out. Shine a torch to freeze them, then hit. The Bookshop sells torches. Or stay inside and sleep."; } },
    { id: "night", title: "Night", when: function (p) { return S.isNight(p) && !Z.blackout; }, spot: "map", text: function () { return "It is late. Sleep at your hostel to save and wake up fresh at 06:30."; } },
    { id: "quiz", title: "Classes", when: function (p, me, n) { return !!n.quiz; }, text: function () { return "Classes are five questions. Three right is a pass and raises your brain skill; every right answer is XP."; } },
    { id: "race", title: "Racing", when: function () { return !!Z.race; }, spot: "map", text: function () { return "Drive through the yellow rings in order. Finish ahead of all three riders to win the cup and open the next one."; } },
    { id: "date", title: "A date", when: function () { return !!(Z.date && Z.date.spot); }, spot: "map", text: function () { return "Lead your date to the spot on the map, then press the action button there. A gift and the right topic make it perfect."; } },
    { id: "hungry", title: "You are hungry", spot: "bars", when: function (p) { return p.hunger < 25; }, text: function () { return "FOOD is low. Orange markers on the map sell food: MACD, shawarma, suya, bread and tea."; } },
    { id: "tired", title: "You are tired", spot: "bars", when: function (p) { return p.energy < 22; }, keys: function () { return ctl("emote3"); }, text: function () { return "ENERGY is low. Stop running, sit down to rest" + ", drink something, or sleep at your hostel."; } },
    { id: "warn", title: "First warning", when: function (p, me, n) { return !!n.warn; }, text: function () { return "Security has noticed you. Trouble like hitting bystanders or reckless driving builds heat. Calm down and it fades by itself."; } },
    { id: "wanted", title: "Security is looking for you", spot: "map", when: function (p, me, n) { return !!n.wanted || p.wanted > 0; }, text: function () { return "Break their line of sight or outrun them and the heat cools down. Their patrols show on the minimap."; } },
    { id: "job", title: "Jobs", spot: "map", when: function (p) { return !!p.job; }, text: function () { return "The green beam is your job. Deliver before the timer for a 25% bonus."; } },
    { id: "net", title: "Multiplayer room", when: function () { return !!(Z.net && Z.net.on); }, keys: function (d) { return d !== "kb" ? btn("phone") : key("phone") + key("emote4"); }, text: function (d) { return "Friends who type the same code appear in cyan. Quick chat and group races are in Phone → Multiplayer" + (d !== "kb" ? "." : "; the sparring key lets you trade punches."); } }
  ];
  var notes = {}, sticky = {}; // notes last one poll; sticky ones (security events) wait until the tip has been shown

  /* ---------- the card ---------- */
  function ensure() {
    if (card) return card;
    try {
      var st = document.createElement("style"); st.textContent = CSS; (document.head || document.body).appendChild(st);
      var stage = document.querySelector("[data-gm-stage]") || document.body; card = document.createElement("div"); card.className = "fg-card"; card.hidden = true; card.setAttribute("role", "status"); stage.appendChild(card);
      card.addEventListener("click", function (e) { var b = e.target && e.target.closest ? e.target.closest("[data-fg]") : null; if (b) { e.preventDefault(); e.stopPropagation(); G.act(b.getAttribute("data-fg")); } });
      card.addEventListener("pointerdown", function (e) { if (e.target && e.target.closest && e.target.closest("[data-fg]")) e.stopPropagation(); });
    } catch (_) { card = card || { style: {}, hidden: true, className: "", innerHTML: "" }; }
    return card;
  }
  function wire() {
    if (wired) return; wired = true;
    try {
      if ((window.matchMedia && matchMedia("(pointer: coarse)").matches) || (Z.touch && Z.touch.active === true)) dev = "touch";
      document.addEventListener("keydown", function () { dev = "kb"; }, true);
      document.addEventListener("pointerdown", function (e) { if (e.pointerType === "touch" || e.pointerType === "pen") dev = "touch"; else if (e.pointerType === "mouse") dev = "kb"; }, true);
      document.addEventListener("touchstart", function () { dev = "touch"; }, { passive: true, capture: true });
    } catch (_) {}
    if (typeof Z.radioNext === "function" && !Z.radioNext.fg) { var rn = Z.radioNext; Z.radioNext = function () { var v = rn.apply(this, arguments); G.note("radio"); return v; }; Z.radioNext.fg = 1; }
  }
  function padPoll() { // a controller that is actually being used switches the wording to controller buttons
    if (!Z.touch || !Z.touch.pad || typeof navigator === "undefined" || !navigator.getGamepads) return; var l; try { l = navigator.getGamepads(); } catch (_) { return; }
    for (var i = 0; l && i < l.length; i++) { var g = l[i]; if (!g || !g.connected) continue; var used = false, j; for (j = 0; j < g.buttons.length; j++) if (g.buttons[j] && g.buttons[j].pressed) used = true; for (j = 0; j < Math.min(4, g.axes.length); j++) if (Math.abs(g.axes[j]) > .35) used = true; if (used) dev = "pad"; }
  }
  function pulse(id) {
    var b = id ? touchBtn(id) : null, el = b && b.el && b.el.classList ? b.el : null;
    if (pulsed === el) return; if (pulsed) pulsed.classList.remove("fg-pulse");
    pulsed = el; if (pulsed) pulsed.classList.add("fg-pulse");
  }
  function place(c) { // sit just under the goal line of the 960×540 picture, wherever the stage letterboxes it; above the picture on a tall phone
    placeT = 0; var st = c.parentNode, r = st && st.getBoundingClientRect ? st.getBoundingClientRect() : null; if (!r || !r.width || !c.style) return;
    var sc = Math.min(r.width / 960, r.height / 540), oy = (r.height - 540 * sc) / 2, tall = oy > 96, k = tall ? "b" + Math.round(r.height - oy + 6) : "t" + Math.round(oy + (r.width < 520 ? 182 : 78) * sc);
    if (k === placeKey && tall === wasTall) return; placeKey = k; wasTall = tall; tallCls = tall || r.width < 520;
    c.style.top = tall ? "auto" : k.slice(1) + "px"; c.style.bottom = tall ? k.slice(1) + "px" : "auto"; if (c.classList && c.classList.toggle) c.classList.toggle("is-tall", tallCls);
  }
  function hide() { if (card && !card.hidden) card.hidden = true; visible = false; pulse(null); shownSpot = null; shownMark = null; }
  function paint(key, cls, html) { var c = ensure(); key += dev; if (cardKey !== key) { cardKey = key; c.className = "fg-card" + cls + (dev === "touch" ? " is-touch" : "") + (tallCls ? " is-tall" : ""); placeT = 99; c.innerHTML = html; } if (c.hidden) c.hidden = false; visible = true; if (++placeT > 20) place(c); }
  function val(f, a, b) { return typeof f === "function" ? f(a, b) : f; }
  function render(g) {
    if (endT > 0) { paint("end", " is-done", "<div class='fg-top'><span>WALKTHROUGH COMPLETE · +" + XP_END + " XP</span></div><div class='fg-body'><div class='fg-keys'><span class='fg-tick'>✓</span></div><div class='fg-text'><b>You are ready, fresher.</b><span>Your goal is at the top of the screen. Follow the yellow line.</span></div></div>"); pulse(null); shownSpot = "goal"; shownMark = null; return; }
    if (!g.done && run) {
      var s = STEPS[run.i], n = run.i + 1, of = STEPS.length;
      if (g.min) { paint("min" + n, " is-min", "<button type='button' class='fg-pill' data-fg='max'>? Walkthrough " + n + "/" + of + "</button>"); pulse(null); shownSpot = null; shownMark = s.mark ? s.mark(run) : null; return; }
      if (run.wait > 0) { hide(); return; }
      var done = run.doneT > 0, k = "s" + run.i + dev + (done ? "d" : "") + (run.npc ? run.npc.id : "") + (sprintByStick() ? "e" : "") + (run.to ? "f" : "");
      paint(k, done ? " is-done" : "", "<div class='fg-top'><span>" + (done ? "NICE · +" + XP_STEP + " XP" : "WALKTHROUGH " + n + " / " + of) + "</span><span>" + (s.info && !done ? "<button type='button' class='fg-go' data-fg='ok'>Got it</button>" : "") + "<button type='button' data-fg='skip'>Skip all</button><button type='button' data-fg='min' aria-label='Hide'>–</button></span></div>" +
        "<div class='fg-body'><div class='fg-keys'>" + (done ? "<span class='fg-tick'>✓</span>" : val(s.keys, dev, run) || "") + "</div><div class='fg-text'><b>" + s.title + "</b><span>" + val(s.text, dev, run) + "</span></div></div>" +
        "<div class='fg-bar'><i style='width:" + Math.round((run.i + (done ? 1 : 0)) / of * 100) + "%'></i></div>");
      pulse(done || dev !== "touch" ? null : val(s.pulse, dev, run) || null); shownSpot = done ? null : val(s.spot, dev, run) || null; shownMark = !done && s.mark ? s.mark(run) : null; return;
    }
    if (tip) { var h = tip.h; paint("t" + h.id + dev, " is-tip", "<div class='fg-top'><span>TIP</span><span><button type='button' class='fg-go' data-fg='ok'>Got it</button></span></div><div class='fg-body'>" + (h.keys && val(h.keys, dev) ? "<div class='fg-keys'>" + val(h.keys, dev) + "</div>" : "") + "<div class='fg-text'><b>" + h.title + "</b><span>" + val(h.text, dev) + "</span></div></div>"); pulse(null); shownSpot = h.spot || null; shownMark = null; return; }
    hide();
  }

  /* ---------- flow ---------- */
  function begin(g) {
    while (g.s < STEPS.length && STEPS[g.s].skip && STEPS[g.s].skip()) g.s++;
    if (g.s >= STEPS.length) return finish(g);
    run = { i: g.s, t: 0, doneT: 0, wait: .35, hit: false }; var s = STEPS[run.i]; if (s.start) s.start(run);
  }
  function complete() { if (!run || run.doneT > 0) return; run.doneT = .95; var a = Z.api; try { a.sound.sfx("coin"); a.buzz(20); } catch (_) {} Z.xp(XP_STEP); G.log.push(STEPS[run.i].id); }
  function finish(g) { g.done = 1; g.s = STEPS.length; delete g.min; delete g.replay; run = null; endT = 7; tipWait = 12; var a = Z.api; try { a.sound.sfx("win"); a.confetti(70); } catch (_) {} Z.xp(XP_END); G.log.push("end"); Z.save(); }
  G.log = [];
  G.active = function () { var g = state(); return !!g && !g.done; };
  G.start = function () { var g = state(); if (!g) return; g.done = 0; g.s = 0; g.replay = 1; delete g.skip; delete g.min; run = null; tip = null; endT = 0; cardKey = ""; };
  G.skip = function () { var g = state(); if (!g || g.done) return; g.done = 1; g.skip = 1; delete g.min; run = null; endT = 0; hide(); Z.toast("Walkthrough skipped. Replay it any time from <b>Phone → How to play</b>."); Z.save(); };
  G.device = function (d) { if (d) dev = d; return dev; };
  G.act = function (a) {
    var g = state(); if (!g) return;
    if (a === "skip") return G.skip();
    if (a === "min") { g.min = 1; return; } if (a === "max") { delete g.min; return; }
    if (a === "ok") { if (!g.done && run && STEPS[run.i].info) complete(); else if (tip) { tip = null; tipWait = 6; } }
  };
  function handle(e) {
    var g = state(); if (!g) return;
    if (e.t === "ui:place" && e.pl) { var d = e.pl.def || {}; if ((d.menu && d.menu.length) || (d.stock && d.stock.length)) notes.shop = 1; }
    if (e.t === "ui:quiz") notes.quiz = 1;
    if (e.t === "warn") sticky.warn = 1; if (e.t === "wanted") sticky.wanted = 1;
    if (!g.done && run && run.doneT <= 0 && !(run.wait > 0)) { var s = STEPS[run.i]; if (s.ev && s.ev(e)) run.hit = true; }
  }
  G.on = function (ev) { if (ev && Z.P) handle(ev); };            // game events, from Z.emit
  G.note = function (kind, arg) { if (Z.P) handle({ t: "ui:" + kind, pl: arg }); }; // menu events, from samaru-ui.js
  G.tick = function (dt) {
    var g = state(); if (!g || Z.mode !== "play") { hide(); return; }
    wire(); padPoll();
    var a = Z.api, menu = a.overlayOpen() || Z.bigOpen();
    if (lastP !== Z.P) { lastP = Z.P; run = null; tip = null; endT = 0; lead = 0; tipWait = 4; notes = {}; }
    if (!g.done && !run && g.s === 0 && !g.replay) { // let the chapter banner clear and the 3D view finish loading first
      if (!menu) lead += dt; var loading = Z.r3 && !Z.r3.ready && !Z.r3err && lead < 12;
      if (lead < 3.6 || loading) { hide(); return; }
    }
    if (!g.done) {
      if (!run || run.i !== g.s) { begin(g); if (!run) { render(g); return; } }
      var s = STEPS[run.i];
      if (run.doneT > 0) { if (!menu) run.doneT -= dt; if (run.doneT <= 0) { g.s = run.i + 1; run = null; if (g.s >= STEPS.length) finish(g); } }
      else if (!menu) {
        if (run.wait > 0) run.wait -= dt;
        else { run.t += dt; if (run.hit || (s.check && s.check(run, dt)) || (s.info && run.t > 16)) complete(); }
      } else if (run.hit) complete();
    } else if (!menu) {
      if (endT > 0) endT -= dt;
      else if (tip) { tip.t += dt; if (tip.t > 11) { tip = null; tipWait = 6; } }
      else { tipWait -= dt; pollT -= dt; if (tipWait <= 0 && pollT <= 0 && !(Z.opt && Z.opt("tips", true) === false) && (!Z.focus || Z.focus.allow("tip") || sticky.warn || sticky.wanted)) { pollT = .5; var p = Z.P, me = Z.me; for (var i = 0; i < HINTS.length; i++) { var h = HINTS[i]; if (sticky.warn) notes.warn = 1; if (sticky.wanted) notes.wanted = 1; if (!g.hints[h.id] && h.when(p, me, notes)) { g.hints[h.id] = 1; delete sticky[h.id]; tip = { h: h, t: 0 }; G.log.push("tip:" + h.id); try { a.sound.sfx("click"); } catch (_) {} break; } } notes = {}; } }
    }
    if (menu) hide(); else render(g);
  };

  /* ---------- spotlight and world marker, on the HUD canvas (960 × 540) ---------- */
  function spotRect(id) {
    var r3 = three(), t = Z.touch, k;
    if (id === "bars") return { x: 8, y: 6, w: 162, h: 72 };
    if (id === "money") return { x: 8, y: 78, w: 130, h: 24 };
    if (id === "wanted") return { x: 10, y: 100, w: 72, h: 26 };
    if (id === "map") return { c: 1, x: 868, y: r3 ? 96 : 84, r: (r3 ? 78 : 66) + 6 };
    if (id === "goal") return { x: 200, y: 28, w: 560, h: 34 };
    if (id === "speedo") return { x: 800, y: 470, w: 150, h: 66 };
    if (id === "stickL" || id === "stickR") {
      k = null; try { k = t && t.rect ? t.rect(id === "stickL" ? "move" : "look") : null; } catch (_) {}
      if (dev !== "touch") return null;
      return k && isFinite(k.x) ? { c: 1, x: k.x + k.w / 2, y: k.y + k.h / 2, r: Math.max(k.w, k.h) / 2 + 8 } : (id === "stickL" ? { c: 1, x: 120, y: 420, r: 66 } : { x: 520, y: 150, w: 290, h: 220 });
    }
    return null;
  }
  function arrow(x, px, py, ang, col) { x.save(); x.translate(px, py); x.rotate(ang); x.fillStyle = col; x.strokeStyle = "rgba(0,0,0,.7)"; x.lineWidth = 3; x.beginPath(); x.moveTo(0, 0); x.lineTo(-11, -16); x.lineTo(-4, -16); x.lineTo(-4, -30); x.lineTo(4, -30); x.lineTo(4, -16); x.lineTo(11, -16); x.closePath(); x.stroke(); x.fill(); x.restore(); }
  G.draw = function (x, t) {
    if (!visible || !Z.P) return;
    var bob = Math.sin(t * 5) * 5, col = "#22d3ee", r = shownSpot ? spotRect(shownSpot) : null;
    if (r) {
      x.save(); x.strokeStyle = col; x.lineWidth = 3; x.setLineDash([9, 7]); x.lineDashOffset = -t * 26; x.shadowColor = col; x.shadowBlur = 12; x.beginPath();
      if (r.c) x.arc(r.x, r.y, r.r, 0, TAU); else if (x.roundRect) x.roundRect(r.x, r.y, r.w, r.h, 10); else x.rect(r.x, r.y, r.w, r.h);
      x.stroke(); x.setLineDash([]); x.restore();
      if (r.c) { if (r.y > 270) arrow(x, r.x, r.y - r.r - 8 + bob, 0, col); else arrow(x, r.x - r.r - 10 - Math.abs(bob), r.y, -Math.PI / 2, col); }
      else if (r.x < 300) arrow(x, r.x + r.w + 12 + Math.abs(bob), r.y + r.h / 2, Math.PI / 2, col); else if (r.y > 270) arrow(x, r.x + r.w / 2, r.y - 8 + bob, 0, col); else arrow(x, r.x + r.w / 2, r.y + r.h + 12 + Math.abs(bob), Math.PI, col);
    }
    var m = shownMark; if (!m) return;
    var me = Z.me, d = Math.hypot(m.x - me.x, m.y - me.y), label = m.name + (d > 12 ? " · " + (d >= 1000 ? (d / 1000).toFixed(1) + " km" : Math.round(d / 5) * 5 + " m") : ""), q = null, sx, sy, on;
    if (three()) { q = Z.r3.project(m.x, m.h || 2.6, m.y); sx = q ? q.x : -999; sy = q ? q.y : -999; } else { sx = Z.px(m.x, m.y); sy = Z.py(m.x, m.y) - 40; }
    on = sx > 40 && sx < 920 && sy > 150 && sy < 500;
    if (on) { arrow(x, sx, sy - 6 + bob, 0, col); x.font = "800 13px system-ui, sans-serif"; x.textAlign = "center"; x.lineWidth = 4; x.strokeStyle = "rgba(0,0,0,.75)"; x.strokeText(label, sx, sy - 44 + bob); x.fillStyle = "#a5f3fc"; x.fillText(label, sx, sy - 44 + bob); return; }
    // off screen or behind the camera: an arrow on a circle round the player, turned to the camera
    var dx = m.x - me.x, dy = m.y - me.y, ang;
    if (three()) { var yw = Z.r3.yaw, f = dx * Math.cos(yw) + dy * Math.sin(yw), rt = -dx * Math.sin(yw) + dy * Math.cos(yw); ang = Math.atan2(rt, f); } else ang = Math.atan2(dx, -dy);
    var ex = 480 + Math.sin(ang) * 190, ey = 300 - Math.cos(ang) * 120; x.save(); x.translate(ex + Math.sin(ang) * bob, ey - Math.cos(ang) * bob); x.scale(1.35, 1.35); arrow(x, 0, 0, ang + Math.PI, col); x.restore();
    x.font = "800 13px system-ui, sans-serif"; x.textAlign = "center"; x.lineWidth = 4; x.strokeStyle = "rgba(0,0,0,.75)"; var ly = ey + (Math.cos(ang) < -.5 ? -30 : 34); x.strokeText(label, ex, ly); x.fillStyle = "#a5f3fc"; x.fillText(label, ex, ly);
  };
  void P;
})();
