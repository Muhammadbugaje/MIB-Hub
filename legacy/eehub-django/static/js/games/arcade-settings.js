/* Arcade settings screen and phone-control layout editor, shared by every arcade game (docs/ARCADE_SETTINGS.md).
   arcade.js holds the option registry (api.settings.add/get/set) and calls ArcadeSettings.install(ctx) inside run(), before
   game.init. The screen opens ABOVE whatever dialog the game has open (its own layer, not api.show), pauses the game and
   restores exactly what was paused/open when it closes. Nothing runs at load time except defining ArcadeSettings. */
(function () {
  "use strict";
  var TABS = [["audio", "Audio"], ["sounds", "Sounds"], ["display", "Display"], ["controls", "Controls"], ["touch", "Phone controls"], ["gameplay", "Gameplay"], ["access", "Accessibility"], ["data", "Data"], ["about", "About"]];
  var CSS = ".gms{position:absolute;inset:0;z-index:40;display:flex;align-items:stretch;justify-content:center;background:rgba(4,10,20,.78);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);padding:max(10px,env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-left));font-size:calc(14px * var(--gm-text,1))}" +
    ".gms[hidden]{display:none}.gms-box{width:min(860px,100%);display:flex;flex-direction:column;background:#0d1726;border:1px solid rgba(126,240,255,.22);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.5);color:#e8f6ff;overflow:hidden}" +
    ".gms-head{display:flex;align-items:center;gap:10px;padding:10px 12px 0}.gms-head h2{margin:0;font-size:1.25em;color:#fff;flex:1;letter-spacing:-.01em}" +
    ".gms-tabs{display:flex;gap:4px;overflow-x:auto;padding:8px 10px;scrollbar-width:none;border-bottom:1px solid rgba(255,255,255,.08)}.gms-tabs::-webkit-scrollbar{display:none}" +
    ".gms-tab{flex:0 0 auto;min-height:40px;padding:0 14px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:transparent;color:#cfe8f5;font:inherit;font-weight:700;cursor:pointer}" +
    ".gms-tab[aria-selected=true]{background:#7ef0ff;color:#04202a;border-color:#7ef0ff}.gms-tab:focus-visible,.gms button:focus-visible,.gms input:focus-visible,.gms select:focus-visible{outline:3px solid #fde047;outline-offset:2px}" +
    ".gms-body{flex:1;overflow:auto;padding:12px 14px 18px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}.gms-sec{margin:0 0 14px}.gms-sec h3{margin:0 0 6px;font-size:.78em;letter-spacing:.09em;text-transform:uppercase;color:#7ef0ff}" +
    ".gms-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:6px 12px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.06);min-height:44px}.gms-row label,.gms-row .gms-l{font-weight:600}" +
    ".gms-row small{grid-column:1/-1;color:rgba(232,246,255,.62);font-size:.85em;margin-top:-4px}.gms-ctl{display:flex;align-items:center;gap:8px;justify-content:flex-end}" +
    ".gms input[type=range],.gms-edbar input[type=range]{-webkit-appearance:none;appearance:none;width:min(200px,40vw);height:30px;background:transparent;margin:0}.gms-edbar input[type=range]{width:110px}" +
    ".gms input[type=range]::-webkit-slider-runnable-track,.gms-edbar input[type=range]::-webkit-slider-runnable-track{height:6px;border-radius:3px;background:#3d5573}.gms input[type=range]::-moz-range-track,.gms-edbar input[type=range]::-moz-range-track{height:6px;border-radius:3px;background:#3d5573}" +
    ".gms input[type=range]::-webkit-slider-thumb,.gms-edbar input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:24px;height:24px;margin-top:-9px;border-radius:50%;background:#7ef0ff;border:2px solid #04202a}.gms input[type=range]::-moz-range-thumb,.gms-edbar input[type=range]::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:#7ef0ff;border:2px solid #04202a}" +
    ".gms output{min-width:3.4em;text-align:right;font-variant-numeric:tabular-nums;color:#fde047;font-weight:700}" +
    ".gms select{font:inherit;min-height:40px;padding:0 10px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:#13233a;color:#fff;max-width:46vw}" +
    ".gms-sw{position:relative;width:52px;height:30px;flex:0 0 auto}.gms-sw input{position:absolute;inset:0;opacity:0;margin:0;cursor:pointer}.gms-sw i{position:absolute;inset:0;border-radius:99px;background:#33445a;transition:background .15s}" +
    ".gms-sw i::after{content:'';position:absolute;left:3px;top:3px;width:24px;height:24px;border-radius:50%;background:#fff;transition:transform .15s}.gms-sw input:checked+i{background:#22c55e}.gms-sw input:checked+i::after{transform:translateX(22px)}.gms-sw input:focus-visible+i{outline:3px solid #fde047;outline-offset:2px}" +
    ".gms-b{min-height:40px;padding:0 14px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:#1b2c44;color:#fff;font:inherit;font-weight:700;cursor:pointer}.gms-b--go{background:#22c55e;border-color:#22c55e;color:#04220f}.gms-b--warn{background:#7f1d1d;border-color:#ef4444}" +
    ".gms-b--sm{min-height:36px;padding:0 10px;font-size:.92em}.gms kbd{display:inline-block;min-width:1.6em;padding:2px 7px;border-radius:6px;background:#22344d;border:1px solid rgba(255,255,255,.18);font:700 .9em ui-monospace,monospace}" +
    ".gms-foot{display:flex;gap:8px;justify-content:flex-end;padding:10px 12px;border-top:1px solid rgba(255,255,255,.08)}.gms-note{color:rgba(232,246,255,.7);font-size:.9em;line-height:1.45;margin:4px 0 10px}" +
    ".gms-flash{color:#86efac;font-weight:700;min-height:1.2em}.gms-x{width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.18);background:transparent;color:#fff;font-size:20px;cursor:pointer}" +
    "@media (max-width:540px){.gms-row{grid-template-columns:1fr}.gms-ctl{justify-content:flex-start;flex-wrap:wrap}.gms-row small{margin-top:0}}" +
    "@media (max-height:430px){.gms-head{padding-top:6px}.gms-tabs{padding:5px 8px}.gms-tab{min-height:36px}.gms-body{padding:8px 12px 12px}.gms-row{padding:6px 0}}" +
    /* layout editor */
    "[data-lay-hidden]{display:none!important}.gms-editing [data-lay]{outline:2px dashed rgba(126,240,255,.9);outline-offset:2px;touch-action:none;cursor:grab}" +
    ".gms-editing [data-lay-hidden]{display:block!important;opacity:.35!important}.gms-editing [data-lay].gms-sel{outline:3px solid #fde047}.gms-editing [data-lay].gms-bad{outline:3px solid #ef4444;background:rgba(239,68,68,.35)!important}" +
    ".gms-edbar{position:absolute;left:50%;top:max(8px,env(safe-area-inset-top));transform:translateX(-50%);z-index:45;display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:center;max-width:calc(100% - 16px);padding:8px;border-radius:14px;background:rgba(8,16,28,.92);border:1px solid rgba(126,240,255,.3);color:#e8f6ff;font:600 13px system-ui,sans-serif}" +
    ".gms-edbar .gms-b{min-height:38px}.gms-edsel{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;width:100%}.gms-edsel>b{flex:0 0 100%;overflow-wrap:anywhere;white-space:normal;line-height:1.25}.gms-edsel label{display:flex;align-items:center;gap:6px;white-space:nowrap}.gms-edsel input[type=range]{width:110px}.gms-ed-dim{position:absolute;inset:0;z-index:5;background:rgba(0,0,0,.4);pointer-events:none}" +
    ".gms-chip{position:absolute;z-index:44;transform:translate(-50%,-140%);padding:0 14px;min-height:40px;border-radius:999px;border:0;background:#fde047;color:#1a1300;font:800 13px system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.4)}" +
    /* display effects */
    "[data-gm-stage].gms-contrast .gm-dlg,[data-gm-stage].gms-contrast .fs-btn,[data-gm-stage].gms-contrast .gm-key{background:#000!important;color:#fff!important;border:2px solid #fff!important}" +
    "[data-gm-stage] .gm-dlg{font-size:calc(1em * var(--gm-text,1))}[data-gm-stage] .gm-touch,[data-gm-stage] .fs-touch{opacity:var(--gm-hud-alpha,1)}";
  var CB = { protan: "0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0", deutan: "0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0", tritan: "0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0" };

  function install(ctx) {
    var api = ctx.api, game = ctx.game, SET = ctx.SET, stage = ctx.stage, Sound = ctx.Sound, esc = api.esc || function (s) { return String(s); };
    var R = SET, tab = "audio", layer = null, open = false, wasPaused = false, flashMsg = "", capturing = null, padCapture = null;
    if (!document.getElementById("gms-css")) { var st = document.createElement("style"); st.id = "gms-css"; st.textContent = CSS; document.head.appendChild(st); }
    if (!document.getElementById("gms-svg")) {
      var svg = document.createElement("div"); svg.id = "gms-svg"; svg.setAttribute("aria-hidden", "true"); svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
      svg.innerHTML = "<svg width='0' height='0'>" + Object.keys(CB).map(function (k) { return "<filter id='gms-" + k + "' color-interpolation-filters='linearRGB'><feColorMatrix type='matrix' values='" + CB[k] + "'/></filter>"; }).join("") + "</svg>";
      document.body.appendChild(svg);
    }
    var touchDev = false; try { touchDev = matchMedia("(pointer: coarse)").matches; } catch (e) {}
    var hasActions = (game.actions || []).some(function (a) { return !a.hidden; });

    /* ---------- built-in options ---------- */
    function pct(v) { return Math.round(v * 100) + "%"; }
    function css() {
      var f = [], b = +R.get("bright") || 1, cb = R.get("cb"); if (b !== 1) f.push("brightness(" + b + ")"); if (cb && CB[cb]) f.push("url(#gms-" + cb + ")");
      stage.style.filter = f.join(" ");
      stage.style.setProperty("--gm-text", String(+R.get("textScale") || 1)); stage.style.setProperty("--gm-hud", String(+R.get("hudScale") || 1)); stage.style.setProperty("--gm-hud-alpha", String(+R.get("hudAlpha") || 1));
      stage.classList.toggle("gms-contrast", !!R.get("contrast"));
    }
    var add = function (o) { return R.add(o); };
    add({ id: "master", tab: "audio", section: "Volume", label: "Master volume", type: "slider", default: Sound.vol == null ? 1 : Sound.vol, min: 0, max: 1, step: .05, format: pct, apply: function (v) { if (Sound.setVol) Sound.setVol(v); } });
    add({ id: "music", tab: "audio", section: "Volume", label: "Music", type: "slider", default: SET.music, min: 0, max: 1, step: .05, format: pct, apply: function (v) { SET.music = v; Sound.applySet(); } });
    add({ id: "sfx", tab: "audio", section: "Volume", label: "Sound effects", type: "slider", default: SET.sfx, min: 0, max: 1, step: .05, format: pct, apply: function (v) { SET.sfx = v; Sound.applySet(); } });
    add({ id: "amb", tab: "audio", section: "Volume", label: "Ambience", type: "slider", default: 1, min: 0, max: 1, step: .05, format: pct, help: "Birds, crowds, wind and engines in the background, where a game has them.", apply: function (v) { SET.amb = v; } });
    add({ id: "voice", tab: "audio", section: "Voices", label: "Voices", type: "toggle", default: SET.voice !== false, apply: function (v) { SET.voice = v; } });
    add({ id: "subs", tab: "audio", section: "Voices", label: "Subtitles", type: "toggle", default: true });
    add({ id: "subSize", tab: "audio", section: "Voices", label: "Subtitle size", type: "slider", default: 1, min: .8, max: 1.6, step: .1, format: pct });
    add({ id: "bgMute", tab: "audio", section: "Other", label: "Mute when you switch away", type: "toggle", default: true });

    add({ id: "res", tab: "display", section: "Performance", label: "Resolution", type: "slider", default: 1, min: .6, max: 1, step: .05, format: pct, help: "Lower is smoother on older phones.", apply: function () { if (ctx.size) ctx.size(); } });
    add({ id: "fps30", tab: "display", section: "Performance", label: "Cap at 30 frames a second", type: "toggle", default: false, help: "Saves battery and keeps hot phones steadier." });
    add({ id: "fx", tab: "display", section: "Performance", label: "Effects", type: "choice", default: SET.fx || "high", choices: [["high", "Full"], ["low", "Fewer (older phones)"]], apply: function (v) { SET.fx = v; } });
    add({ id: "bright", tab: "display", section: "Picture", label: "Brightness", type: "slider", default: 1, min: .7, max: 1.3, step: .05, format: pct, apply: css });
    add({ id: "cb", tab: "display", section: "Picture", label: "Colour-blind filter", type: "choice", default: "none", choices: [["none", "Off"], ["protan", "Protanopia (red)"], ["deutan", "Deuteranopia (green)"], ["tritan", "Tritanopia (blue)"]], apply: css });
    add({ id: "shake", tab: "display", section: "Comfort", label: "Screen shake and zoom", type: "toggle", default: SET.shake !== false, apply: function (v) { SET.shake = v; } });
    add({ id: "flashes", tab: "display", section: "Comfort", label: "Bright flashes", type: "toggle", default: true });
    add({ id: "motion", tab: "display", section: "Comfort", label: "Motion", type: "choice", default: "auto", choices: [["auto", "Follow my device"], ["reduce", "Reduce motion"]], apply: function (v) { if (ctx.setReduce) ctx.setReduce(v === "reduce"); } });
    add({ id: "hudScale", tab: "display", section: "On-screen display", label: "HUD size", type: "slider", default: 1, min: .8, max: 1.5, step: .05, format: pct, apply: css });
    add({ id: "hudAlpha", tab: "display", section: "On-screen display", label: "HUD and button opacity", type: "slider", default: 1, min: .4, max: 1, step: .05, format: pct, apply: css });

    add({ id: "lookSens", tab: "controls", section: "Camera", label: "Look sensitivity", type: "slider", default: 1, min: .3, max: 2, step: .1, format: pct, when: function () { return !!game.look; } });
    add({ id: "invertY", tab: "controls", section: "Camera", label: "Invert up and down look", type: "toggle", default: false, when: function () { return !!game.look; } });
    add({ id: "buzz", tab: "controls", section: "Feel", label: "Vibration (phones)", type: "toggle", default: SET.buzz !== false, apply: function (v) { SET.buzz = v; } });
    add({ id: "padRumble", tab: "controls", section: "Feel", label: "Controller rumble", type: "toggle", default: true });

    add({ id: "textScale", tab: "access", section: "Reading", label: "Text size", type: "slider", default: 1, min: .9, max: 1.5, step: .05, format: pct, apply: css });
    add({ id: "contrast", tab: "access", section: "Reading", label: "High-contrast menus and buttons", type: "toggle", default: false, apply: css });
    add({ id: "speed", tab: "access", section: "Pace", label: "Game speed", type: "choice", default: 1, choices: [[1, "100%"], [.9, "90%"], [.8, "80%"]], help: "Slows the whole game down a little. Scores still count.", when: function () { return !game.fixedSpeed; } });
    css();

    /* ---------- render ---------- */
    function sw(id, on) { return "<span class='gms-sw'><input type='checkbox' role='switch' data-o='" + id + "'" + (on ? " checked" : "") + " aria-label='" + esc(id) + "'><i></i></span>"; }
    function optRow(o) {
      if (o.when && !o.when()) return ""; var v = R.get(o.id), ctl = "", lid = "gms-o-" + o.id;
      if (o.type === "toggle") ctl = sw(o.id, !!v).replace("aria-label='" + esc(o.id) + "'", "aria-labelledby='" + lid + "'");
      else if (o.type === "slider") ctl = "<input type='range' id='" + lid + "-i' data-o='" + o.id + "' min='" + o.min + "' max='" + o.max + "' step='" + (o.step || .1) + "' value='" + v + "' aria-labelledby='" + lid + "'><output data-out='" + o.id + "'>" + esc(o.format ? o.format(+v) : v) + "</output>";
      else if (o.type === "choice") ctl = "<select data-o='" + o.id + "' aria-labelledby='" + lid + "'>" + (o.choices || []).map(function (c) { return "<option value='" + esc(c[0]) + "'" + (String(c[0]) === String(v) ? " selected" : "") + ">" + esc(c[1]) + "</option>"; }).join("") + "</select>";
      else if (o.type === "key") ctl = "<kbd>" + esc(ctx.keyLabel(v || "")) + "</kbd> <button class='gms-b gms-b--sm' data-a='okey' data-id='" + o.id + "'>Change</button>";
      return "<div class='gms-row'><span class='gms-l' id='" + lid + "'>" + esc(o.label) + "</span><span class='gms-ctl'>" + ctl + "</span>" + (o.help ? "<small>" + esc(o.help) + "</small>" : "") + "</div>";
    }
    function options(t) {
      var list = R.list(t).filter(function (o) { return !o.when || o.when(); }), secs = [], by = {};
      list.forEach(function (o) { var s = o.section || ""; if (!by[s]) { by[s] = []; secs.push(s); } by[s].push(o); });
      return secs.map(function (s) { return "<div class='gms-sec'>" + (s ? "<h3>" + esc(s) + "</h3>" : "") + by[s].map(optRow).join("") + "</div>"; }).join("");
    }
    function keysHtml() {
      if (!hasActions) return "";
      var rows = (game.actions || []).filter(function (a) { return !a.hidden; }).map(function (a) {
        var tg = a.toggle ? "<select data-tg='" + a.id + "' aria-label='Hold or toggle " + esc(a.label) + "'><option value='hold'>Hold</option><option value='toggle'" + (toggled(a.id) ? " selected" : "") + ">Toggle</option></select> " : "";
        return "<div class='gms-row'><span class='gms-l'>" + esc(a.label) + "</span><span class='gms-ctl'>" + tg + "<b data-kb='" + a.id + "'>" + ctx.bound(a.id).map(function (k) { return "<kbd>" + esc(ctx.keyLabel(k)) + "</kbd>"; }).join(" ") + "</b><button class='gms-b gms-b--sm' data-a='bind' data-id='" + a.id + "'>Change</button></span></div>";
      }).join("");
      return "<div class='gms-sec'><h3>Keyboard</h3><p class='gms-note'>Press Change, then the key you want. A key already in use swaps over.</p>" + rows + "</div>";
    }
    function padHtml() {
      if (!hasActions || padOff()) return "";
      var m = padMap(), names = ["A / Cross", "B / Circle", "X / Square", "Y / Triangle", "LB / L1", "RB / R1", "LT / L2", "RT / R2"];
      return "<div class='gms-sec'><h3>Controller</h3><p class='gms-note'>Plug in or pair a controller. Left stick and D-pad move, Start pauses. Choose what each button does.</p>" +
        names.map(function (n, i) { return "<div class='gms-row'><span class='gms-l'>" + n + "</span><span class='gms-ctl'><select data-pad='" + i + "' aria-label='" + esc(n) + "'><option value=''>Nothing</option>" + padActions().map(function (a) { return "<option value='" + a.id + "'" + (m[i] === a.id ? " selected" : "") + ">" + esc(a.label) + "</option>"; }).join("") + "</select></span></div>"; }).join("") +
        "<div class='gms-row'><span class='gms-l'>Reset controller buttons</span><span class='gms-ctl'><button class='gms-b gms-b--sm' data-a='padreset'>Reset</button></span></div></div>";
    }
    function touchHtml() {
      var items = layItems(), n = items.length;
      return "<div class='gms-sec'><h3>Layout</h3><p class='gms-note'>" + (n ? "Drag every on-screen button and stick where your thumbs like them, pinch or use the slider to resize, fade or hide any of them. Layouts are saved separately for landscape and portrait. Tip: press and hold any button during play to come straight here." : "This screen shows no phone buttons right now. Start playing, then open Settings again to move them.") + "</p>" +
        "<div class='gms-row'><span class='gms-l'>Edit the layout</span><span class='gms-ctl'><button class='gms-b gms-b--go' data-a='layout'" + (n ? "" : " disabled") + ">Edit layout</button></span></div>" +
        "<div class='gms-row'><span class='gms-l'>Ready-made layouts</span><span class='gms-ctl' style='flex-wrap:wrap'>" + [["default", "Default"], ["left", "Left-handed"], ["compact", "Compact"], ["one", "One-handed"]].map(function (p) { return "<button class='gms-b gms-b--sm' data-a='preset' data-p='" + p[0] + "'" + (n ? "" : " disabled") + ">" + p[1] + "</button>"; }).join("") + "</span></div></div>" +
        "<div class='gms-sec'><h3>All buttons</h3>" + optRow({ id: "touchScale", label: "Size", type: "slider", min: .7, max: 1.5, step: .05, format: pct }) + optRow({ id: "touchAlpha", label: "Opacity", type: "slider", min: .3, max: 1, step: .05, format: pct }) + "</div>";
    }
    function dataHtml() {
      return "<div class='gms-sec'><h3>This game on this device</h3>" +
        "<div class='gms-row'><span class='gms-l'>Back up your save to a file</span><span class='gms-ctl'><button class='gms-b' data-a='export'>Export</button></span></div>" +
        "<div class='gms-row'><span class='gms-l'>Restore a save from a file</span><span class='gms-ctl'><button class='gms-b' data-a='import'>Import</button><input type='file' accept='application/json,.json' data-file hidden></span></div>" +
        "<div class='gms-row'><span class='gms-l'>Reset all settings to default</span><span class='gms-ctl'><button class='gms-b' data-a='resetset'>Reset settings</button></span></div>" +
        "<div class='gms-row'><span class='gms-l'>Delete this game's progress on this device</span><span class='gms-ctl'><button class='gms-b gms-b--warn' data-a='resetprog'>Reset progress</button></span><small>Your account's results and badges on the site are not touched.</small></div></div>";
    }
    function aboutHtml() {
      var title = (document.querySelector("[data-gm-title]") || document.querySelector("h1") || {}).textContent || ctx.slug, base = (window.Arcade && Arcade.Audio && Arcade.Audio.base) || "";
      var code = api.cheatIds && api.cheatIds().length ? "<div class='gms-sec'><h3>Code</h3><p class='gms-note'>Type a code here on a phone. On a keyboard you can just type it while playing.</p><div class='gms-row'><span class='gms-ctl' style='justify-content:flex-start'><input type='text' data-code autocomplete='off' autocapitalize='off' spellcheck='false' aria-label='Code' style='font:inherit;min-height:40px;padding:0 10px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:#13233a;color:#fff;width:170px'> <button class='gms-b' data-a='code'>Enter</button></span><span data-code-msg class='gms-flash'></span></div></div>" : "";
      return "<div class='gms-sec'><h3>" + esc(String(title).trim()) + "</h3><p class='gms-note'>Part of the EE Hub learning arcade, made by Muhammad Iliyasu Bugaje. Settings are kept on this device for this game only.</p>" +
        (base ? "<p class='gms-note'>Sound effects are free (CC0) recordings; see the <a href='" + esc(base + "CREDITS.md") + "' target='_blank' rel='noopener' style='color:#7ef0ff'>sound credits</a>.</p>" : "") + "</div>" + code;
    }
    function body() {
      if (tab === "controls") return keysHtml() + padHtml() + options("controls");
      if (tab === "touch") return touchHtml();
      if (tab === "access") return options("access") + "<div class='gms-sec'><h3>One hand</h3><div class='gms-row'><span class='gms-l'>Put every phone control on the right</span><span class='gms-ctl'><button class='gms-b gms-b--sm' data-a='preset' data-p='one'" + (layItems().length ? "" : " disabled") + ">One-handed layout</button></span></div></div>";
      if (tab === "data") return dataHtml() + options("data");
      if (tab === "about") return aboutHtml();
      if (tab === "sounds") return "<div data-snd-root></div>"; // filled by static/js/games/arcade-sounds.js after render
      var h = options(tab); return h || "<p class='gms-note'>This game has no extra options here.</p>";
    }
    function render(keepFocus) {
      if (!layer) { layer = document.createElement("div"); layer.className = "gms"; layer.hidden = true; layer.setAttribute("role", "dialog"); layer.setAttribute("aria-modal", "true"); layer.setAttribute("aria-label", "Settings"); stage.appendChild(layer); wire(); }
      var tabs = TABS.filter(function (t) { return (t[0] !== "touch" || touchDev || layItems().length || R.list("touch").length) && (t[0] !== "sounds" || !!(window.ArcadeSounds && window.Arcade && Arcade.Audio)); });
      if (!tabs.some(function (t) { return t[0] === tab; })) tab = "audio";
      var y = layer.querySelector(".gms-body") ? layer.querySelector(".gms-body").scrollTop : 0;
      layer.innerHTML = "<div class='gms-box'><div class='gms-head'><h2>Settings</h2><button class='gms-x' data-a='close' aria-label='Close settings'>✕</button></div>" +
        "<div class='gms-tabs' role='tablist'>" + tabs.map(function (t) { return "<button class='gms-tab' role='tab' data-tab='" + t[0] + "' aria-selected='" + (t[0] === tab) + "' tabindex='" + (t[0] === tab ? 0 : -1) + "'>" + t[1] + "</button>"; }).join("") + "</div>" +
        "<div class='gms-body' role='tabpanel'>" + body() + "</div><div class='gms-foot'><span class='gms-flash' style='flex:1;align-self:center' data-flash>" + esc(flashMsg) + "</span><button class='gms-b gms-b--go' data-a='close'>Done</button></div></div>";
      if (keepFocus) { layer.querySelector(".gms-body").scrollTop = y; var f = layer.querySelector(keepFocus); if (f) f.focus({ preventScroll: true }); }
      else { var t0 = layer.querySelector(".gms-tab[aria-selected=true]"); if (t0) t0.focus({ preventScroll: true }); }
      var ts = layer.querySelector(".gms-tab[aria-selected=true]"); if (ts && ts.scrollIntoView) try { ts.scrollIntoView({ block: "nearest", inline: "center" }); } catch (e) {}
      flashMsg = "";
      if (tab === "sounds") try { window.ArcadeSounds.mount(layer.querySelector("[data-snd-root]"), { flash: flash }); } catch (e) {}
    }
    function flash(m) { flashMsg = m; var f = layer && layer.querySelector("[data-flash]"); if (f) f.textContent = m; }

    /* ---------- events ---------- */
    function wire() {
      layer.addEventListener("click", function (e) {
        var t = e.target.closest("[data-tab]"); if (t) { tab = t.getAttribute("data-tab"); try { Sound.sfx("click"); } catch (_) {} render(".gms-tab[data-tab=" + tab + "]"); return; }
        var b = e.target.closest("[data-a]"); if (!b || b.disabled) return; var a = b.getAttribute("data-a");
        if (a === "close") return close();
        if (a === "layout") { close(true); editor(); return; }
        if (a === "preset") { preset(b.getAttribute("data-p")); flash("Layout applied. Use Edit layout to fine-tune it."); return; }
        if (a === "bind" || a === "okey") return bind(b.getAttribute("data-id"), a === "okey");
        if (a === "padreset") { delete SET.o.padMap; SET.save(); render(); return; }
        if (a === "export") return exportSave();
        if (a === "import") { var fi = layer.querySelector("[data-file]"); if (fi) fi.click(); return; }
        if (a === "resetset") { if (!confirm("Reset every setting for this game to its default?")) return; var keep = {}; SET.o = {}; SET.keys = {}; SET.touch = {}; SET.layout = {}; SET.touchScale = 1; SET.touchAlpha = .85; SET.save(); R.list().forEach(function (o) { R.reset(o.id); }); ctx.drawTouch(); refreshLayout(); css(); render(); flash("Settings reset."); return keep; }
        if (a === "resetprog") { if (!confirm("Delete this game's progress on this device? This cannot be undone.")) return; var n = 0; saveKeys().forEach(function (k) { if (k.indexOf("ee-arcade-set-") !== 0) { localStorage.removeItem(k); n++; } }); flash(n ? "Progress deleted. Reload the page to start fresh." : "There was no saved progress."); return; }
        if (a === "code") { var ci = layer.querySelector("[data-code]"), cm = layer.querySelector("[data-code-msg]"), ok = api.enterCode && api.enterCode(ci.value); cm.textContent = ok ? "Code accepted." : "Not a code."; ci.value = ""; return; }
      });
      layer.addEventListener("input", function (e) { var el = e.target, id = el.getAttribute("data-o"); if (!id) return; change(id, el); });
      layer.addEventListener("change", function (e) {
        var el = e.target, id = el.getAttribute("data-o"), tg = el.getAttribute("data-tg"), pd = el.getAttribute("data-pad");
        if (id && el.tagName === "SELECT") change(id, el);
        if (tg) { var t = SET.o.toggles || {}; t[tg] = el.value === "toggle"; SET.o.toggles = t; SET.save(); }
        if (pd != null) { var m = padMap(); m[pd] = el.value || null; SET.o.padMap = m; SET.save(); }
        if (el.hasAttribute("data-file") && el.files && el.files[0]) importSave(el.files[0]);
      });
      layer.addEventListener("keydown", function (e) {
        if (capturing) return;
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); return; }
        var t = e.target.closest && e.target.closest(".gms-tab");
        if (t && (e.key === "ArrowRight" || e.key === "ArrowLeft")) { e.preventDefault(); var all = [].slice.call(layer.querySelectorAll(".gms-tab")), i = all.indexOf(t) + (e.key === "ArrowRight" ? 1 : -1); i = (i + all.length) % all.length; tab = all[i].getAttribute("data-tab"); render(".gms-tab[data-tab=" + tab + "]"); }
        e.stopPropagation(); // keys typed in settings never reach the game
      });
    }
    function change(id, el) {
      var o = R.list().filter(function (q) { return q.id === id; })[0], v;
      if (el.type === "checkbox") v = el.checked; else if (el.type === "range") v = +el.value; else v = el.value;
      if (o && o.type === "choice" && o.choices && typeof o.choices[0][0] === "number") v = +v;
      if (id === "touchScale" || id === "touchAlpha") { SET[id] = v; SET.save(); ctx.drawTouch(); refreshLayout(); }
      else R.set(id, v);
      var out = layer.querySelector("[data-out='" + id + "']"); if (out) out.textContent = o && o.format ? o.format(v) : (id === "touchScale" || id === "touchAlpha" ? pct(v) : v);
    }
    function bind(id, other) {
      var lab = layer.querySelector("[data-kb='" + id + "']"); if (lab) lab.textContent = "Press a key… (Esc cancels)"; flash("Press the key you want.");
      capturing = function (e) {
        e.preventDefault(); e.stopPropagation(); document.removeEventListener("keydown", capturing, true); capturing = null; var code = e.code;
        if (code === "Escape") { render(); return; }
        if (other) { R.set(id, code); render(); return; }
        var clash = []; for (var o in ctx.actions) if (o !== id && ctx.bound(o).indexOf(code) >= 0) { var mine = ctx.bound(id); SET.keys[o] = ctx.bound(o).map(function (k) { return k === code ? mine[0] : k; }); clash.push(ctx.actions[o].label); }
        SET.keys[id] = [code]; SET.save(); render(); if (clash.length) flash("That key was used by " + clash.join(", ") + ", so they swapped.");
      };
      document.addEventListener("keydown", capturing, true);
    }

    /* ---------- open / close: a layer above the game's own dialogs; nothing of the game's is touched ---------- */
    function openUI(t) {
      if (editing) return; if (t) tab = t;
      if (!open) { wasPaused = ctx.paused(); ctx.paused(true); open = true; try { clearTimeout(Sound.timer); } catch (e) {} }
      render(); layer.hidden = false; api.settingsOpen = true;
    }
    function close(toEditor) {
      if (capturing) { document.removeEventListener("keydown", capturing, true); capturing = null; }
      if (!layer) return; layer.hidden = true; api.settingsOpen = false; try { if (window.ArcadeSounds) window.ArcadeSounds.closed(); } catch (e) {}
      if (open && !toEditor) { open = false; ctx.paused(wasPaused); }
      ctx.drawTouch(); refreshLayout(); try { (stage.querySelector("[data-gm-canvas]") || stage).focus({ preventScroll: true }); } catch (e) {}
    }

    /* ---------- data: export / import / reset ---------- */
    function pref(k) { return [].concat(game.savePrefix || []).some(function (p) { return k.indexOf(p) === 0; }); }
    function saveKeys() { var out = [], slug = ctx.slug, names = (game.saveKeys || []).concat(["ee-arcade-set-" + slug]); try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k.indexOf(slug) >= 0 || names.indexOf(k) >= 0 || pref(k)) out.push(k); } } catch (e) {} return out; }
    function exportSave() {
      var data = { game: ctx.slug, saved: new Date().toISOString(), keys: {} }; saveKeys().forEach(function (k) { data.keys[k] = localStorage.getItem(k); });
      var blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }), a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = ctx.slug + "-save.json"; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      flash("Saved " + Object.keys(data.keys).length + " item(s) to a file.");
    }
    function importSave(file) {
      var rd = new FileReader(); rd.onload = function () {
        try { var d = JSON.parse(rd.result); if (!d || d.game !== ctx.slug || typeof d.keys !== "object") { flash("That file is not a save for this game."); return; }
          if (!confirm("Replace this game's progress on this device with the file's?")) return;
          Object.keys(d.keys).forEach(function (k) { if (typeof d.keys[k] === "string" && (k.indexOf(ctx.slug) >= 0 || pref(k))) localStorage.setItem(k, d.keys[k]); });
          flash("Save restored. Reload the page to load it."); } catch (e) { flash("Could not read that file."); } };
      rd.readAsText(file);
    }

    /* ---------- hold or toggle ---------- */
    function toggled(id) { return !!(SET.o.toggles && SET.o.toggles[id]); }
    var latched = {};
    function toggleCodes() { var m = {}; (game.actions || []).forEach(function (a) { if (a.toggle && toggled(a.id)) { ctx.bound(a.id).forEach(function (k) { m[k] = a.id; }); m["@" + a.id] = a.id; } }); return m; }
    document.addEventListener("keydown", function (e) { if (open || editing || e.repeat) return; var id = toggleCodes()[e.code]; if (!id) return; if (latched[id]) { e.stopImmediatePropagation(); latched[id] = false; ctx.keys[e.code] = false; } else latched[id] = e.code; }, true);
    document.addEventListener("keyup", function (e) { var id = toggleCodes()[e.code]; if (id && latched[id]) e.stopImmediatePropagation(); }, true);
    ["pointerup", "pointercancel", "pointerleave", "pointerout"].forEach(function (n) { ctx.touch.addEventListener(n, function (e) { var b = e.target.closest && e.target.closest(".gm-key"), c = b && b.getAttribute("data-k"), id = c && toggleCodes()[c]; if (id && latched[id]) e.stopImmediatePropagation(); }, true); });
    ctx.touch.addEventListener("pointerdown", function (e) { var b = e.target.closest && e.target.closest(".gm-key"), c = b && b.getAttribute("data-k"), id = c && toggleCodes()[c]; if (!id) return; if (latched[id]) { e.stopImmediatePropagation(); latched[id] = false; ctx.keys[c] = false; b.classList.remove("is-down"); } else latched[id] = c; }, true);

    // while the screen is open, keys belong to it: Esc closes it (instead of toggling the game's pause), nothing reaches the game
    document.addEventListener("keydown", function (e) {
      if (!open || capturing || editing || layer.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
      if (!layer.contains(e.target)) { e.stopImmediatePropagation(); if (e.key === "Tab") { e.preventDefault(); var f = layer.querySelector(".gms-tab[aria-selected=true]"); if (f) f.focus(); } }
    }, true);

    /* ---------- background mute ---------- */
    var bgMuted = false;
    document.addEventListener("visibilitychange", function () { if (!R.get("bgMute")) return; try { if (document.hidden && !Sound.muted) { bgMuted = true; Sound.setMuted(true); } else if (!document.hidden && bgMuted) { bgMuted = false; Sound.setMuted(false); } } catch (e) {} });

    /* ---------- controller ---------- */
    function padOff() { return !!game.ownGamepad || !!(window.SamaruGame && window.SamaruGame.touch); }
    function padActions() { return (game.actions || []).filter(function (a) { return !a.hidden && ["up", "down", "left", "right"].indexOf(a.id) < 0; }); }
    function padMap() { if (SET.o.padMap) return Object.assign({}, SET.o.padMap); var m = {}, list = padActions(), order = [0, 1, 2, 3, 5, 4, 7, 6]; list.slice(0, 8).forEach(function (a, i) { m[order[i]] = a.id; }); return m; }
    var padHeld = {}, padLoop = false;
    function dirCode(d) { return ctx.actions[d] ? "@" + d : { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" }[d]; }
    function padSet(code, on) { if (on) { if (!padHeld[code]) { padHeld[code] = true; ctx.press(code); } } else if (padHeld[code]) { padHeld[code] = false; ctx.keys[code] = false; } }
    function pollPad() {
      var pads = navigator.getGamepads ? navigator.getGamepads() : [], gp = null; for (var i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { gp = pads[i]; break; }
      if (!gp) { padLoop = false; return; } requestAnimationFrame(pollPad);
      var b = function (i) { return !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > .5)); }, ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      if (open) { // the controller drives the settings screen
        var nav = { up: b(12) || ay < -.6, down: b(13) || ay > .6, a: b(0), back: b(1), lb: b(4), rb: b(5) };
        ["up", "down", "a", "back", "lb", "rb"].forEach(function (k) { if (nav[k] && !padHeld["n" + k]) { padHeld["n" + k] = true; navStep(k); } else if (!nav[k]) padHeld["n" + k] = false; }); return;
      }
      if (b(9) && !padHeld.start) { padHeld.start = true; document.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", key: "Escape" })); } else if (!b(9)) padHeld.start = false;
      if (b(8) && !padHeld.sel) { padHeld.sel = true; openUI(); } else if (!b(8)) padHeld.sel = false;
      padSet(dirCode("left"), b(14) || ax < -.45); padSet(dirCode("right"), b(15) || ax > .45); padSet(dirCode("up"), b(12) || ay < -.45); padSet(dirCode("down"), b(13) || ay > .45);
      var m = padMap(); for (var k in m) if (m[k] && ctx.actions[m[k]]) padSet("@" + m[k], b(+k));
    }
    function navStep(k) {
      var f = [].slice.call(layer.querySelectorAll(".gms-body button:not([disabled]), .gms-body input, .gms-body select, .gms-foot button")), i = f.indexOf(document.activeElement);
      if (k === "back") return close(); if (k === "a" && document.activeElement) return document.activeElement.click();
      if (k === "lb" || k === "rb") { var all = TABS.map(function (t) { return t[0]; }), j = all.indexOf(tab) + (k === "rb" ? 1 : -1); tab = all[(j + all.length) % all.length]; render(); return; }
      i = Math.max(0, Math.min(f.length - 1, i + (k === "down" ? 1 : -1))); if (f[i]) f[i].focus();
    }
    if (!padOff()) window.addEventListener("gamepadconnected", function () { if (!padLoop) { padLoop = true; requestAnimationFrame(pollPad); } });
    var buzz0 = api.buzz; api.buzz = function (p) { buzz0(p); if (!R.get("padRumble") || !navigator.getGamepads) return; try { var gp = [].filter.call(navigator.getGamepads(), function (g) { return g && g.connected; })[0], dur = Array.isArray(p) ? p.reduce(function (s, v) { return s + v; }, 0) : p || 20; if (gp && gp.vibrationActuator) gp.vibrationActuator.playEffect("dual-rumble", { duration: Math.min(400, dur), strongMagnitude: .6, weakMagnitude: .4 }); } catch (e) {} };

    /* ---------- phone-control layout: items, presets, editor ---------- */
    function orient() { return api.layout.orient(); }
    function layItems() { var seen = {}, out = []; [].forEach.call(stage.querySelectorAll("[data-lay]"), function (el) { var id = el.getAttribute("data-lay"); if (seen[id]) return; seen[id] = 1; out.push({ id: id, el: el, label: el.getAttribute("data-lay-label") || id }); }); return out; }
    function refreshLayout() { api.layout.refresh(); }
    function curState(it) { var r = stage.getBoundingClientRect(), b = it.el.getBoundingClientRect(), L = api.layout.get(it.id) || {}; return { x: (b.left + b.width / 2 - r.left) / r.width * 100, y: (b.top + b.height / 2 - r.top) / r.height * 100, s: L.s || 1, a: L.a == null ? 1 : L.a, h: !!L.h, w: b.width / (L.s || 1), hgt: b.height / (L.s || 1) }; }
    function writeLay(map) { SET.layout[orient()] = map; SET.save(); refreshLayout(); }
    function overlapFix(map, items) { // shrink then nudge until nothing overlaps
      var r = stage.getBoundingClientRect();
      function box(id) { var m = map[id], it = items.filter(function (q) { return q.id === id; })[0]; return { l: m.x / 100 * r.width - it.w0 * m.s / 2, t: m.y / 100 * r.height - it.h0 * m.s / 2, r: m.x / 100 * r.width + it.w0 * m.s / 2, b: m.y / 100 * r.height + it.h0 * m.s / 2 }; }
      for (var pass = 0; pass < 6; pass++) { var bad = false; items.forEach(function (a, i) { items.slice(i + 1).forEach(function (b) { if (map[a.id].h || map[b.id].h) return; var p = box(a.id), q = box(b.id); if (p.l < q.r && p.r > q.l && p.t < q.b && p.b > q.t) { bad = true; if (pass < 3) { map[a.id].s *= .9; map[b.id].s *= .9; } else map[b.id].y = Math.max(6, map[b.id].y - 4); } }); }); if (!bad) break; }
      return map;
    }
    function preset(p) {
      delete SET.layout[orient()]; refreshLayout(); if (p === "default") { SET.save(); return; }
      var items = layItems().map(function (it) { var s = curState(it); it.base = s; it.w0 = s.w; it.h0 = s.hgt; return it; }), map = {};
      items.forEach(function (it) { var b = it.base, x = b.x, y = b.y, s = 1;
        if (p === "left") x = 100 - x;
        else if (p === "compact") { s = .82; x = x < 50 ? x * .88 + 2 : 100 - (100 - x) * .88 - 2; y = y > 50 ? 100 - (100 - y) * .9 : y; }
        else if (p === "one") { s = .82; x = 50 + x * .48; }
        map[it.id] = { x: Math.max(3, Math.min(97, x)), y: Math.max(4, Math.min(96, y)), s: s, a: 1, h: false }; });
      writeLay(overlapFix(map, items));
    }
    var editing = false;
    function editor() {
      var items = layItems(); if (!items.length) { openUI("touch"); return; }
      editing = true; api.settingsOpen = true; var pausedBefore = wasPaused; ctx.paused(true);
      stage.classList.add("gms-editing"); var tl = stage.querySelector("[data-gm-touch]"); if (tl) tl.classList.add("is-on");
      api.layout.providers().forEach(function (p) { if (p.editing) try { p.editing(true); } catch (e) {} }); refreshLayout(); items = layItems();
      var r0 = stage.getBoundingClientRect(), map = {}, sel = null, ptrs = {}, start = null;
      items.forEach(function (it) { var s = curState(it); it.w0 = s.w; it.h0 = s.hgt; map[it.id] = { x: s.x, y: s.y, s: s.s, a: s.a, h: s.h }; place(it); });
      var dim = document.createElement("div"); dim.className = "gms-ed-dim"; stage.appendChild(dim);
      var bar = document.createElement("div"); bar.className = "gms-edbar"; stage.appendChild(bar);
      function place(it) { var m = map[it.id], e = it.el; e.style.left = m.x + "%"; e.style.top = m.y + "%"; e.style.right = "auto"; e.style.bottom = "auto"; e.style.transform = "translate(-50%,-50%)"; e.style.width = Math.round(it.w0 * m.s) + "px"; e.style.height = Math.round(it.h0 * m.s) + "px"; e.style.opacity = m.h ? "" : m.a; if (m.h) e.setAttribute("data-lay-hidden", ""); else e.removeAttribute("data-lay-hidden"); }
      function rect(it) { var r = stage.getBoundingClientRect(), m = map[it.id]; return { l: m.x / 100 * r.width - it.w0 * m.s / 2, t: m.y / 100 * r.height - it.h0 * m.s / 2, r: m.x / 100 * r.width + it.w0 * m.s / 2, b: m.y / 100 * r.height + it.h0 * m.s / 2 }; }
      function clashes(it) { if (map[it.id].h) return false; return clash(rect(it), items.filter(function (o) { return o !== it && !map[o.id].h; }).map(rect)); }
      function paintBar() {
        var it = sel, m = it && map[it.id];
        bar.innerHTML = (it ? "<div class='gms-edsel'><b>" + esc(it.label) + "</b><label>Size <input type='range' min='.6' max='1.6' step='.05' value='" + m.s + "' data-e='s'></label><label>Opacity <input type='range' min='.3' max='1' step='.05' value='" + m.a + "' data-e='a'></label><button class='gms-b gms-b--sm' data-e='hide'>" + (m.h ? "Show" : "Hide") + "</button></div>" : "<span>Drag a control. Two fingers on it to resize. Tap one to fade or hide it.</span>") +
          "<button class='gms-b gms-b--sm' data-e='default'>Default</button><button class='gms-b gms-b--sm' data-e='cancel'>Cancel</button><button class='gms-b gms-b--go gms-b--sm' data-e='save'>Save</button>";
      }
      function select(it) { if (sel) sel.el.classList.remove("gms-sel"); sel = it; if (it) it.el.classList.add("gms-sel"); paintBar(); }
      function pt(e) { var r = stage.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * 100, y: (e.clientY - r.top) / r.height * 100 }; }
      function down(e) {
        if (bar.contains(e.target)) return; e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        var el = e.target.closest && e.target.closest("[data-lay]"), it = el ? items.filter(function (q) { return q.el === el; })[0] : null;
        ptrs[e.pointerId] = pt(e);
        if (it) { if (sel !== it) select(it); start = { id: e.pointerId, p: pt(e), m: Object.assign({}, map[it.id]) }; }
        else if (sel && Object.keys(ptrs).length >= 2 && start) { var ids = Object.keys(ptrs), a = ptrs[ids[0]], b = ptrs[ids[1]]; start.d = Math.hypot(a.x - b.x, a.y - b.y) || 1; start.s0 = map[sel.id].s; }
        else if (!it && Object.keys(ptrs).length === 1) select(null);
        try { stage.setPointerCapture(e.pointerId); } catch (_) {}
      }
      function mv(e) {
        if (!ptrs[e.pointerId] || !sel || !start) return; e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); ptrs[e.pointerId] = pt(e);
        var m = map[sel.id], ids = Object.keys(ptrs);
        if (ids.length >= 2 && start.d) { var a = ptrs[ids[0]], b = ptrs[ids[1]]; m.s = Math.max(.6, Math.min(1.6, start.s0 * Math.hypot(a.x - b.x, a.y - b.y) / start.d)); }
        else if (+e.pointerId === +start.id) { var p = ptrs[e.pointerId]; m.x = Math.round(Math.max(3, Math.min(97, start.m.x + p.x - start.p.x))); m.y = Math.round(Math.max(4, Math.min(96, start.m.y + p.y - start.p.y))); }
        place(sel); sel.el.classList.toggle("gms-bad", clashes(sel));
      }
      function up(e) {
        if (!ptrs[e.pointerId]) return; e.stopPropagation(); e.stopImmediatePropagation(); delete ptrs[e.pointerId];
        if (sel && start && !Object.keys(ptrs).length) { if (clashes(sel)) { map[sel.id] = Object.assign({}, start.m); place(sel); flashBar("That spot overlaps another control, so it went back."); } sel.el.classList.remove("gms-bad"); start = null; paintBar(); }
        if (!Object.keys(ptrs).length) start = null;
      }
      function flashBar(t) { var s = bar.querySelector("span, .gms-edsel b"); if (s) { var o = s.textContent; s.textContent = t; setTimeout(function () { if (s.isConnected) s.textContent = o; }, 1600); } }
      function eat(e) { if (!bar.contains(e.target)) { e.stopPropagation(); e.stopImmediatePropagation(); if (e.cancelable) e.preventDefault(); } }
      window.addEventListener("pointerdown", down, true); window.addEventListener("pointermove", mv, true); window.addEventListener("pointerup", up, true); window.addEventListener("pointercancel", up, true);
      ["click", "touchstart", "touchmove", "contextmenu"].forEach(function (n) { window.addEventListener(n, eat, { capture: true, passive: false }); });
      bar.addEventListener("input", function (e) { var k = e.target.getAttribute("data-e"); if (!sel || !k) return; var m = map[sel.id], old = m[k]; m[k] = +e.target.value; place(sel); if (k === "s" && clashes(sel)) { m.s = old; place(sel); e.target.value = old; flashBar("Bigger would overlap another control."); } });
      bar.addEventListener("click", function (e) {
        var b = e.target.closest("[data-e]"); if (!b) return; var k = b.getAttribute("data-e");
        if (k === "hide" && sel) { map[sel.id].h = !map[sel.id].h; if (!map[sel.id].h && clashes(sel)) { map[sel.id].h = true; flashBar("Move another control first; this one would overlap."); } place(sel); paintBar(); return; }
        if (k === "default") { delete SET.layout[orient()]; SET.save(); finish(false, true); return; }
        finish(k === "save");
      });
      function finish(save, reopen) {
        window.removeEventListener("pointerdown", down, true); window.removeEventListener("pointermove", mv, true); window.removeEventListener("pointerup", up, true); window.removeEventListener("pointercancel", up, true);
        ["click", "touchstart", "touchmove", "contextmenu"].forEach(function (n) { window.removeEventListener(n, eat, { capture: true, passive: false }); });
        items.forEach(function (it) { it.el.classList.remove("gms-sel", "gms-bad"); it.el.style.cssText = it.el.style.cssText; });
        bar.remove(); dim.remove(); stage.classList.remove("gms-editing");
        if (save) { var out = {}; items.forEach(function (it) { var m = map[it.id]; out[it.id] = { x: +m.x.toFixed(1), y: +m.y.toFixed(1), s: +m.s.toFixed(2), a: +m.a.toFixed(2), h: !!m.h }; }); SET.layout[orient()] = out; SET.save(); }
        api.layout.providers().forEach(function (p) { if (p.editing) try { p.editing(false); } catch (e) {} });
        editing = false; ctx.drawTouch(); refreshLayout(); api.settingsOpen = false;
        if (reopen) { editor(); return; }
        if (open) { wasPaused = pausedBefore; openUI("touch"); flash(save ? "Layout saved for " + (orient() === "land" ? "landscape." : "portrait.") : "Layout unchanged."); } else ctx.paused(pausedBefore);
      }
      paintBar();
    }
    api.layoutTest = { items: layItems, preset: preset, edit: editor, state: curState }; // used by the test harness

    /* ---------- long-press any phone control → a chip that opens the editor ---------- */
    var lp = null, chip = null;
    stage.addEventListener("pointerdown", function (e) {
      if (editing || open || e.pointerType === "mouse") return; var el = e.target.closest && e.target.closest("[data-lay]"); if (!el) return;
      var x0 = e.clientX, y0 = e.clientY, id = e.pointerId; clearTimeout(lp && lp.t);
      lp = { id: id, x: x0, y: y0, t: setTimeout(function () { lp = null; showChip(x0, y0); }, 1100) };
    }, true);
    window.addEventListener("pointermove", function (e) { if (lp && e.pointerId === lp.id && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 12) { clearTimeout(lp.t); lp = null; } }, true);
    window.addEventListener("pointerup", function (e) { if (lp && e.pointerId === lp.id) { clearTimeout(lp.t); lp = null; } }, true);
    function showChip(x, y) {
      if (chip) chip.remove(); var r = stage.getBoundingClientRect(); chip = document.createElement("button"); chip.type = "button"; chip.className = "gms-chip"; chip.textContent = "Edit controls";
      chip.style.left = Math.max(70, Math.min(r.width - 70, x - r.left)) + "px"; chip.style.top = Math.max(60, y - r.top) + "px"; stage.appendChild(chip);
      chip.addEventListener("click", function (e) { e.stopPropagation(); chip.remove(); chip = null; wasPaused = ctx.paused(); open = false; editor(); });
      setTimeout(function () { if (chip) { chip.remove(); chip = null; } }, 3200);
    }

    return { open: function (t) { openUI(t); }, close: function () { close(); }, isOpen: function () { return open || editing; }, editor: editor, preset: preset };
  }
  // true when rectangle a ({l, t, r, b} in px) overlaps any of list by more than a 2 px hairline
  function clash(a, list) { return list.some(function (b) { return a.l < b.r - 2 && a.r > b.l + 2 && a.t < b.b - 2 && a.b > b.t + 2; }); }
  window.ArcadeSettings = { install: install, tabs: TABS, clash: clash };
})();
