/* Freshers School Life — the phone in your hand.
   Pressing the phone key plays a pull-out: your student reaches into a pocket, brings the phone up and holds it
   (one hand while walking, looking down at it while standing); putting it away plays it backwards. Others see it:
   the pose rides on me.phoneK (0 away … 1 held), which samaru-anim.js reads on any figure, and multiplayer sends
   it as the "phone" emote. Walkers on campus pull theirs out too.
   The screen is a portrait handset over the game, which keeps running behind it: bottom-right on a computer,
   to the right of centre on a phone held sideways, bottom centre held upright, always clear of the move stick
   and the action buttons (see PH.fit). On a vehicle it only opens hands-free when stopped or slow.
   Apps: goals, map, jobs, contacts, messages, friends, bank (money from home), dial (service codes), camera,
   radio, multiplayer, pockets, timetable, games, profile, settings, help, quit. Keys while it is open: arrows move,
   Enter opens, Esc or Backspace goes back, the phone key puts it away. Touch: tap, swipe right to go back.
   A phone held out in a crowd can be snatched (rare; never during a mission): chase and tackle the thief, report
   it at the security post at the Main Gate or through a friend, or buy a cheap replacement.
   Public API (docs/story/ENGINE.md §14): Z.phone.open(app) · close() · toggle() · isOpen() · app(id) · press(id) ·
   pressLabel(re) · back() · lost() · replace() · recover(why) · call({ who, lines, incoming, then }) · fit(w, h).
   Nothing touches the DOM at load time. */
(function () {
  "use strict";
  var Z = window.SamaruGame, S = window.SamaruSim, D = window.SamaruData; if (!Z) return;
  var PH = Z.phone = {}, TAU = Math.PI * 2;
  PH.REPLACE = 3000;
  var shell = null, scr = null, built = false, dock = null, view = [], focus = 0, html = "", st = "away", outT = 0, lastT = 0, swipe = null;
  PH.html = ""; PH.log = [];

  /* ---------- small helpers ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function naira(n) { return "₦" + Math.round(n).toLocaleString(); }
  function toast(h) { try { if (Z.toast) Z.toast(h); } catch (e) {} PH.lastToast = h; }
  function sfx(n) { try { Z.api.sound.sfx(n); } catch (e) {} }
  function buzz(ms) { try { Z.api.buzz(ms); } catch (e) {} }
  function P() { return Z.P; }
  function realDom() { return typeof document !== "undefined" && document.body && typeof document.body.insertBefore === "function" && typeof window.getComputedStyle === "function"; }
  function stageEl() { try { return document.querySelector("[data-gm-stage]"); } catch (e) { return null; } }
  function reduce() { try { return !!(Z.api && Z.api.reduce) || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  PH.state = function (p) {
    p = p || P(); if (!p) return null; var s = p.phone; if (!s || typeof s !== "object") s = p.phone = {};
    if (!Array.isArray(s.msgs)) s.msgs = []; if (!Array.isArray(s.photos)) s.photos = []; if (!s.warned || typeof s.warned !== "object") s.warned = {}; if (!s.home || typeof s.home !== "object") s.home = {}; if (!(s.seq >= 0)) s.seq = 0; if (s.lost === undefined) s.lost = null;
    return s;
  };
  PH.lost = function () { var s = PH.state(); return !!(s && s.lost); };
  function absMin(p) { p = p || P(); return (p.day || 1) * 1440 + (p.time || 0); }
  PH.absMin = absMin;

  /* ---------- the app list ---------- */
  var G = { // white line glyphs on a 24 grid
    goals: "<path d='M6 21V4M6 4h11l-2 4 2 4H6' />", map: "<path d='M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14' />", jobs: "<rect x='3' y='7' width='18' height='13' rx='2'/><path d='M9 7V5h6v2M3 13h18' />",
    contacts: "<circle cx='12' cy='8' r='4'/><path d='M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7' />", messages: "<path d='M4 5h16v11H9l-5 4z' /><path d='M8 9h8M8 12h5' />", friends: "<circle cx='8' cy='9' r='3'/><circle cx='16.5' cy='8' r='2.6'/><path d='M2.5 20c0-3.4 2.4-5.4 5.5-5.4s5.5 2 5.5 5.4M13 14.6c3.6-.6 7.5 1 7.5 5.4' />",
    bank: "<path d='M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18' />", dial: "<g fill='#fff' stroke='none'><circle cx='6' cy='5' r='1.7'/><circle cx='12' cy='5' r='1.7'/><circle cx='18' cy='5' r='1.7'/><circle cx='6' cy='11' r='1.7'/><circle cx='12' cy='11' r='1.7'/><circle cx='18' cy='11' r='1.7'/><circle cx='6' cy='17' r='1.7'/><circle cx='12' cy='17' r='1.7'/><circle cx='18' cy='17' r='1.7'/><circle cx='12' cy='22' r='1.4'/></g>",
    camera: "<rect x='3' y='7' width='18' height='13' rx='2'/><path d='M8 7l2-3h4l2 3' /><circle cx='12' cy='13.5' r='3.6'/>", radio: "<rect x='3' y='9' width='18' height='11' rx='2'/><path d='M6 9l11-5' /><circle cx='15.5' cy='14.5' r='2.6'/><path d='M6 13h4M6 16h4' />",
    net: "<path d='M2 9a14 14 0 0 1 20 0M5.5 12.5a9 9 0 0 1 13 0M9 16a4 4 0 0 1 6 0' /><circle cx='12' cy='19.5' r='1.2' fill='#fff'/>", pockets: "<rect x='4' y='8' width='16' height='13' rx='4'/><path d='M8.5 8V6a3.5 3.5 0 0 1 7 0v2M8 13h8' />",
    life: "<rect x='3' y='5' width='18' height='16' rx='2'/><path d='M3 10h18M8 3v4M16 3v4M7 14h3M7 17h3M13 14h3' />", mini: "<rect x='2.5' y='8' width='19' height='10' rx='5'/><path d='M7 11v4M5 13h4' /><circle cx='16' cy='12' r='1' fill='#fff'/><circle cx='18' cy='14' r='1' fill='#fff'/>",
    me: "<rect x='3' y='5' width='18' height='14' rx='2'/><circle cx='9' cy='11' r='2.5'/><path d='M5.5 16.5c.8-2 2-2.8 3.5-2.8s2.7.8 3.5 2.8M14 9h4M14 12.5h4' />", saves: "<path d='M5 3.5h11l3.5 3.5v13.5H5z'/><path d='M8 3.5v5h7v-5M8 20.5v-6h8v6' />",
    settings: "<circle cx='12' cy='12' r='3.2'/><path d='M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1' />",
    help: "<circle cx='12' cy='12' r='9.5'/><path d='M9.4 9.4a2.7 2.7 0 1 1 3.6 2.6c-.7.3-1 .9-1 1.6v.6' /><circle cx='12' cy='17.5' r='1' fill='#fff'/>", quit: "<path d='M12 3v8M6.3 6.6a8 8 0 1 0 11.4 0' />",
    report: "<path d='M12 3l9 16H3z' /><path d='M12 9v5' /><circle cx='12' cy='16.8' r='1' fill='#fff'/>", back: "<path d='M15 5l-7 7 7 7' />", home: "<circle cx='12' cy='12' r='7'/>"
  };
  function glyph(k, sz) { return "<svg viewBox='0 0 24 24' width='" + (sz || 26) + "' height='" + (sz || 26) + "' fill='none' stroke='#fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>" + (G[k] || G.help) + "</svg>"; }
  var APPS = PH.APPS = [
    { id: "goals", name: "Goals", col: "#f59e0b,#b45309" }, { id: "map", name: "Map", col: "#22c55e,#15803d" }, { id: "jobs", name: "Jobs", col: "#0ea5e9,#0369a1" }, { id: "contacts", name: "Contacts", col: "#64748b,#334155" },
    { id: "messages", name: "Messages", col: "#4ade80,#16a34a" }, { id: "friends", name: "Friends", col: "#f472b6,#be185d" }, { id: "bank", name: "Bank", col: "#facc15,#a16207" }, { id: "dial", name: "Dial", col: "#34d399,#047857" },
    { id: "camera", name: "Camera", col: "#a3a3a3,#404040" }, { id: "radio", name: "Radio", col: "#fb923c,#c2410c" }, { id: "net", name: "Multiplayer", short: "Online", col: "#818cf8,#4338ca" }, { id: "pockets", name: "Pockets", col: "#fdba74,#c2410c" },
    { id: "life", name: "Timetable", short: "Classes", col: "#c084fc,#7e22ce" }, { id: "mini", name: "Games", col: "#f87171,#b91c1c" }, { id: "me", name: "Profile", col: "#2dd4bf,#0f766e" }, { id: "saves", name: "Saves", col: "#38bdf8,#0369a1" }, { id: "settings", name: "Settings", col: "#94a3b8,#475569" },
    { id: "help", name: "Help", col: "#60a5fa,#1d4ed8" }, { id: "quit", name: "Quit", col: "#475569,#1e293b" }
  ];
  function appById(id) { for (var i = 0; i < APPS.length; i++) if (APPS[i].id === id) return APPS[i]; return null; }
  function badge(id) { var T = Z.texts; if (id === "messages" && T && T.unread) return T.unread(); if (id === "bank" && T && T.pending && T.pending().length) return "•"; if (id === "jobs" && P() && P().job) return "•"; return 0; }

  /* ---------- CSS ---------- */
  var CSS = ".fp-phone{position:absolute;z-index:7;box-sizing:border-box;border-radius:34px;padding:9px;background:linear-gradient(145deg,#2b2f36,#0b0d10 55%,#24272d);box-shadow:0 24px 60px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.12),inset 0 0 0 2px #050608;transform-origin:70% 100%;transition:transform .32s cubic-bezier(.2,.9,.25,1.05),opacity .2s;-webkit-tap-highlight-color:transparent;touch-action:manipulation;user-select:none;-webkit-user-select:none;font:500 14px/1.3 system-ui,-apple-system,'Segoe UI',sans-serif;color:#f8fafc}" +
    ".fp-phone h3,.fp-phone h4,.fp-phone p,.fp-phone b,.fp-phone small,.fp-phone span,.fp-phone em{color:inherit;letter-spacing:normal}.fp-scr{color:#f8fafc}.fp-phone[hidden]{display:none}.fp-phone.is-away{transform:translateY(115%) rotate(4deg);opacity:0;pointer-events:none}.fp-phone.is-snatch{transform:translate(40%,30%) rotate(28deg) scale(.7);opacity:0;transition:transform .35s ease-in,opacity .35s}" +
    ".fp-phone.skin1{background:linear-gradient(145deg,#f6d77a,#9a6b14 55%,#e8c45c)}.fp-phone.skin2{background:linear-gradient(90deg,#15803d 0 33%,#f8fafc 33% 66%,#15803d 66%)}.fp-phone.skin3{background:linear-gradient(145deg,rgba(226,232,240,.55),rgba(148,163,184,.35))}" +
    ".fp-scr{position:relative;width:100%;height:100%;border-radius:26px;overflow:hidden;background:#0b1220;display:flex;flex-direction:column}" +
    ".fp-wall{position:absolute;inset:0;background:radial-gradient(120% 70% at 20% 0%,#1d4ed8 0,rgba(29,78,216,0) 60%),radial-gradient(90% 60% at 100% 100%,#be185d 0,rgba(190,24,93,0) 60%),linear-gradient(160deg,#0f172a,#111827);opacity:.95}" +
    ".fp-notch{position:absolute;left:50%;top:7px;width:30%;height:18px;margin-left:-15%;border-radius:12px;background:#000;z-index:3}" +
    ".fp-bar{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:8px 16px 4px;font:700 12px/1 system-ui;letter-spacing:.02em;min-height:26px;box-sizing:border-box}.fp-bar span{display:flex;align-items:center;gap:5px}.fp-hf{font-size:10px;padding:2px 6px;border-radius:999px;background:#16a34a}" +
    ".fp-main{position:relative;z-index:1;flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;scrollbar-width:none}.fp-main::-webkit-scrollbar{display:none}" +
    ".fp-in{animation:fpIn .22s cubic-bezier(.2,.9,.3,1)}.fp-out{animation:fpOut .2s ease-out}@keyframes fpIn{from{transform:scale(.9);opacity:0}to{transform:none;opacity:1}}@keyframes fpOut{from{transform:translateX(-14%);opacity:0}to{transform:none;opacity:1}}" +
    ".fp-clock{text-align:center;padding:6px 0 10px}.fp-clock b{display:block;font:300 44px/1 system-ui,-apple-system,sans-serif;letter-spacing:-.02em}.fp-clock small{display:block;margin-top:4px;font-size:12.5px;opacity:.85;font-weight:600}.fp-clock.is-small{padding:0 0 6px}.fp-clock.is-small b{font-size:30px}.fp-clock.is-small small{margin-top:2px;font-size:11.5px}" +
    ".fp-grid{display:grid;grid-template-columns:repeat(var(--cols,4),minmax(0,1fr));gap:10px 2px;padding:4px 8px 14px}.fp-app{position:relative;display:flex;flex-direction:column;align-items:center;gap:5px;min-height:64px;padding:4px 0;border:0;background:none;color:#fff;font:600 11px/1.1 system-ui;cursor:pointer;border-radius:14px}" +
    ".fp-app i{display:flex;align-items:center;justify-content:center;width:var(--ic,48px);height:var(--ic,48px);border-radius:28%;box-shadow:0 4px 10px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.3)}.fp-app span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px;letter-spacing:-.01em;text-shadow:0 1px 2px rgba(0,0,0,.6)}" +
    ".fp-app em,.fp-dot{position:absolute;top:0;right:calc(50% - 30px);min-width:19px;height:19px;padding:0 5px;box-sizing:border-box;border-radius:999px;background:#ef4444;color:#fff;font:800 11px/19px system-ui;font-style:normal;text-align:center;box-shadow:0 0 0 2px #0b1220}" +
    ".fp-phone button:focus{outline:none}.fp-phone .is-f{outline:3px solid #7dd3fc;outline-offset:2px}.fp-app.is-f{outline-offset:-1px}" +
    ".fp-banner{display:flex;gap:8px;align-items:center;margin:0 10px 10px;padding:10px 12px;border-radius:14px;border:0;width:calc(100% - 20px);box-sizing:border-box;text-align:left;color:#fff;font:700 13px/1.25 system-ui;min-height:44px;cursor:pointer;background:rgba(239,68,68,.9)}.fp-banner.is-money{background:rgba(22,163,74,.85)}.fp-banner small{display:block;font-weight:500;opacity:.9}" +
    ".fp-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:6px;padding:4px 8px 8px;background:linear-gradient(#0b1220 70%,rgba(11,18,32,0))}.fp-head h3{margin:0;font:800 18px/1.1 system-ui;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".fp-back{display:flex;align-items:center;justify-content:center;min-width:44px;height:44px;border-radius:12px;border:0;background:rgba(255,255,255,.1);cursor:pointer}" +
    ".fp-body{padding:0 10px 14px;display:grid;gap:8px}.fp-row{display:flex;align-items:center;gap:10px;width:100%;min-height:48px;padding:8px 10px;box-sizing:border-box;border-radius:14px;border:0;background:rgba(255,255,255,.07);color:#fff;text-align:left;font:600 13.5px/1.25 system-ui;cursor:pointer}" +
    ".fp-row:hover{background:rgba(255,255,255,.12)}.fp-row:disabled{opacity:.45;cursor:default}.fp-row b{display:block;font-weight:800}.fp-row small{display:block;font-weight:500;opacity:.8;font-size:12px;margin-top:1px}.fp-row .fp-t{flex:1;min-width:0}.fp-row .fp-r{font-weight:800;font-size:12px;opacity:.9;white-space:nowrap}" +
    ".fp-row.is-go{background:linear-gradient(135deg,#16a34a,#15803d)}.fp-row.is-warn{background:rgba(239,68,68,.85)}.fp-av{flex:0 0 38px;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:800 15px system-ui;color:#fff}" +
    ".fp-card{padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.07)}.fp-card h4{margin:0 0 4px;font:800 14px system-ui}.fp-card p{margin:0;font-size:12.5px;opacity:.88}.fp-meter{height:6px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden;margin-top:6px}.fp-meter i{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,#f472b6,#fb7185)}" +
    ".fp-bal{padding:14px;border-radius:16px;background:linear-gradient(135deg,#a16207,#ca8a04 60%,#eab308);color:#1c1917}.fp-bal small{display:block;font-weight:700;opacity:.8}.fp-bal b{display:block;font:800 30px/1.1 system-ui;margin-top:2px}" +
    ".fp-bubbles{display:flex;flex-direction:column;gap:6px}.fp-bub{max-width:82%;padding:8px 11px;border-radius:16px;font-size:13.5px;line-height:1.3;background:rgba(255,255,255,.12);align-self:flex-start;border-bottom-left-radius:5px}.fp-bub.me{align-self:flex-end;background:#16a34a;border-bottom-left-radius:16px;border-bottom-right-radius:5px}.fp-bub small{display:block;font-size:10.5px;opacity:.7;margin-top:2px}" +
    ".fp-quick{display:grid;gap:6px;margin-top:4px}.fp-quick button{min-height:44px;border-radius:22px;border:1px solid rgba(74,222,128,.6);background:rgba(22,163,74,.18);color:#dcfce7;font:700 13px system-ui;padding:6px 12px;cursor:pointer;text-align:center}" +
    ".fp-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.fp-pad button{min-height:52px;border-radius:50%;aspect-ratio:1;max-width:66px;justify-self:center;width:100%;border:0;background:rgba(255,255,255,.13);color:#fff;font:400 24px/1 system-ui;cursor:pointer}.fp-num{width:100%;box-sizing:border-box;padding:10px;border-radius:12px;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.35);color:#fff;font:600 24px/1.2 system-ui;text-align:center;letter-spacing:.06em}" +
    ".fp-call{min-height:52px;border-radius:26px;border:0;background:#16a34a;color:#fff;font:800 15px system-ui;cursor:pointer}.fp-call.is-end{background:#dc2626}" +
    ".fp-view{position:relative;aspect-ratio:3/4;border-radius:14px;overflow:hidden;background:linear-gradient(180deg,#38bdf8,#0ea5e9 45%,#65a30d 46%,#3f6212);display:flex;align-items:flex-end;justify-content:center;padding:10px}.fp-view:before{content:'';position:absolute;inset:14px;border:2px solid rgba(255,255,255,.6);border-radius:10px}.fp-view b{position:relative;font:800 12px system-ui;background:rgba(0,0,0,.45);padding:3px 8px;border-radius:8px}" +
    ".fp-shot{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.fp-shot div{aspect-ratio:1;border-radius:8px;padding:5px;box-sizing:border-box;font:700 9.5px/1.15 system-ui;display:flex;align-items:flex-end;background:linear-gradient(160deg,#0ea5e9,#65a30d)}" +
    ".fp-home{position:relative;z-index:2;display:flex;justify-content:center;padding:6px 0 7px}.fp-home button{width:38%;height:22px;border:0;background:none;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}.fp-home button:after{content:'';display:block;width:100%;height:5px;border-radius:3px;background:rgba(255,255,255,.75)}" +
    ".fp-toastin{position:absolute;left:8px;right:8px;top:30px;z-index:4;padding:9px 11px;border-radius:14px;background:rgba(30,41,59,.96);box-shadow:0 8px 20px rgba(0,0,0,.45);font:600 12.5px/1.3 system-ui;transition:transform .25s,opacity .25s}.fp-toastin[hidden]{display:none}" +
    ".fp-ring{animation:fpRing .5s 3}@keyframes fpRing{20%{transform:rotate(-4deg)}40%{transform:rotate(4deg)}60%{transform:rotate(-3deg)}80%{transform:rotate(2deg)}}" +
    ".fp-dock{position:absolute;z-index:5;left:calc(14px + env(safe-area-inset-left,0px));bottom:calc(14px + env(safe-area-inset-bottom,0px));display:flex;gap:8px;align-items:flex-end}.fp-dock[hidden]{display:none}.fp-dock button{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;width:52px;height:52px;border-radius:14px;border:1px solid rgba(255,255,255,.2);background:rgba(4,12,20,.72);color:#fff;font:700 10px/1 system-ui;cursor:pointer;padding:4px}.fp-dock button i{display:block;width:26px;height:26px}.fp-dock kbd{font:800 9px/1 system-ui;color:#cbd5e1;background:none;border:0;box-shadow:none;padding:0;margin:0;min-width:0;opacity:.85}.fp-dock .fp-hs{width:44px;height:44px;padding:5px;background:rgba(4,12,20,.55)}.fp-dock .fp-hs kbd{position:absolute;left:3px;top:2px;color:#fdba74}.fp-dock .fp-hs b{position:absolute;right:3px;bottom:1px;font:800 11px system-ui;text-shadow:0 1px 2px #000}" +
    ".fp-dock em,.fs-btn .fp-badge{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 4px;box-sizing:border-box;border-radius:999px;background:#ef4444;color:#fff;font:800 11px/18px system-ui;font-style:normal;text-align:center}" +
    ".fs-btn.fp-hide{visibility:hidden;pointer-events:none}@media (prefers-reduced-motion:reduce){.fp-phone,.fp-phone.is-snatch{transition:none}.fp-in,.fp-out,.fp-ring{animation:none}}";

  /* ---------- placement: keep clear of the sticks, the buttons, the minimap ---------- */
  function rectOf(el, sr) { if (!el || el.hidden || !el.getBoundingClientRect) return null; try { if (el.hasAttribute && el.hasAttribute("data-lay-hidden")) return null; if (el.offsetParent === null && getComputedStyle(el).position !== "fixed") return null; } catch (e) {} var r = el.getBoundingClientRect(); if (!r.width || !r.height) return null; return { x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height }; }
  // the small tool buttons (pockets, more, pause, full screen) step aside while the handset or the pockets are out
  var TOOLS = ["pocket", "more", "pause", "full"];
  PH.tools = function (keep) { var T = Z.touch; if (!T || !T.buttons) return; TOOLS.concat(["phone"]).forEach(function (id) { var b = T.buttons[id]; if (b && b.classList) b.classList.toggle("fp-hide", !!keep && id !== keep && !(id === "phone" && keep !== "pocket")); }); PH._toolsKeep = keep || ""; };
  function avoid(sr, kind) {
    var out = [], T = Z.touch, n0, port = sr.height > sr.width * 1.05; if (T && T.active) {
      try { if (T.refresh) T.refresh(); } catch (e) {} n0 = out.length;
      for (var id in T.buttons) { var b = T.buttons[id]; if (!b || id === "closemap" || b._tray) continue; if (TOOLS.indexOf(id) >= 0 || (id === "phone" && kind === "pocket")) continue; var lay = b.parentNode; if (lay && lay.hidden) continue; var r = rectOf(b, sr); if (r) out.push(r); }
      var mv = T.sticks && T.sticks.move; if (mv && mv.el) { var rs = rectOf(mv.el, sr); if (rs) out.push({ x: rs.x - 10, y: rs.y - 10, w: rs.w + 20, h: rs.h + 20 }); }
      if (out.length === n0) { var kk = clamp(Math.min(sr.height / 390, sr.width / 700), .8, 1.5); out.push({ x: sr.width - 290 * kk, y: sr.height - 210 * kk, w: 290 * kk, h: 210 * kk }, { x: 0, y: sr.height - 190 * kk, w: 190 * kk, h: 190 * kk }); } // not laid out yet: where the buttons will be
    }
    if (dock && !dock.hidden) { var rd = rectOf(dock, sr); if (rd) out.push(rd); }
    if (port || kind === "pocket") return out; // held upright the picture is a band across the middle: the handset may cover it, never the controls
    var sc = Math.min(sr.width / 960, sr.height / 540), ox = (sr.width - 960 * sc) / 2, oy = (sr.height - 540 * sc) / 2, r3 = Z.r3 && Z.r3.ready, mR = (r3 ? 82 : 70) * sc, mY = (r3 ? 96 : 84) * sc;
    out.push({ x: ox + 868 * sc - mR, y: oy + mY - mR, w: mR * 2, h: mR * 2, hud: 1 }); // the minimap
    out.push({ x: 0, y: oy, w: ox + 175 * sc, h: 100 * sc, hud: 1 }); // health, food, energy and money
    out.push({ x: ox + 300 * sc, y: oy, w: 360 * sc, h: 78 * sc, hud: 1 }); // the clock and the goal line
    try { var me = Z.me, a = r3 && Z.r3.project ? Z.r3.project(me.x, .1, me.y) : null, b2 = a ? Z.r3.project(me.x, 2.3, me.y) : null; if (a && b2 && kind !== "pocket") { var cx = ox + a.x * sc, top = oy + b2.y * sc, bot = oy + a.y * sc, hw = Math.max(24, (bot - top) * .3); out.push({ x: cx - hw, y: top, w: hw * 2, h: bot - top, hud: 1 }); } } catch (e) {} // your student
    return out;
  }
  function hits(a, list, pad) { for (var i = 0; i < list.length; i++) { var b = list[i]; if (a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y) return true; } return false; }
  // Find a w×h spot for the handset (kind "phone") or the pockets panel (kind "pocket"). Returns { x, y, w, h } in stage pixels.
  PH.fit = function (w, h, kind) {
    var stg = stageEl(); if (!stg || !stg.getBoundingClientRect) return null; var sr = stg.getBoundingClientRect(), W = sr.width, H = sr.height; if (!W || !H) return null;
    var port = H > W * 1.05, touch = !!(Z.touch && Z.touch.active), m = 10, phone = kind !== "pocket", ratio = .5;
    var maxH = phone ? Math.min(620, H - 2 * m, port ? H * .56 : touch ? H : H * .84) : Math.min(h, H - 2 * m), minH = phone ? Math.min(300, H - 2 * m) : Math.min(240, H - 2 * m);
    function scan(list) {
      for (var s = 1; s > .3; s -= .06) {
        var hh = Math.round(Math.max(minH, maxH * s)), ww = phone ? Math.round(clamp(hh * ratio, 214, 320)) : Math.min(w, W - 2 * m);
        if (ww > W - 2 * m) ww = W - 2 * m; var cand = [], x, y;
        if (port) { for (y = H - hh - m; y >= m; y -= 8) cand.push([Math.round((W - ww) / 2), y]); }
        else { for (x = W - ww - (touch ? m : 20); x >= m; x -= 8) { cand.push([x, H - hh - (touch ? m : 20)]); cand.push([x, Math.round((H - hh) / 2)]); cand.push([x, m]); } }
        for (var i = 0; i < cand.length; i++) { var r = { x: cand[i][0], y: cand[i][1], w: ww, h: hh }; if (!hits(r, list, 6)) return r; }
        if (hh <= minH) break;
      }
      return null;
    }
    var full = avoid(sr, kind), ctl = full.filter(function (q) { return !q.hud; });
    return scan(full) || scan(ctl) || (port ? { x: Math.round((W - Math.min(w, W - 20)) / 2), y: m, w: Math.min(w, W - 20), h: Math.min(maxH, H - 2 * m) } : { x: W - Math.min(w, 320) - m, y: m, w: Math.min(w, 320), h: H - 2 * m });
  };

  /* ---------- building the handset ---------- */
  function build() {
    if (built || !realDom()) return !!shell; var stg = stageEl(); if (!stg) return false; built = true;
    var css = document.createElement("style"); css.textContent = CSS; (document.head || document.body).appendChild(css);
    shell = document.createElement("div"); shell.className = "fp-phone is-away"; shell.hidden = true; shell.setAttribute("role", "dialog"); shell.setAttribute("aria-label", "Phone"); shell.id = "fslg-phone";
    shell.innerHTML = "<div class='fp-scr'><div class='fp-wall'></div><div class='fp-notch'></div><div class='fp-bar' data-fp-bar></div><div class='fp-toastin' data-fp-toast hidden></div><div class='fp-main' data-fp-main></div><div class='fp-home'><button type='button' data-pa='home' aria-label='Home screen'></button></div></div>";
    stg.appendChild(shell); scr = shell.querySelector("[data-fp-main]");
    shell.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-pa]"); if (!b || b.disabled) return; e.preventDefault(); e.stopPropagation(); PH.press(b.getAttribute("data-pa")); });
    shell.addEventListener("pointerdown", function (e) { e.stopPropagation(); if (PH.kb) { PH.kb = false; paintFocus(); } if (e.pointerType !== "mouse") swipe = { x: e.clientX, y: e.clientY, t: Date.now() }; });
    shell.addEventListener("pointerup", function (e) { if (!swipe) return; var dx = e.clientX - swipe.x, dy = e.clientY - swipe.y; swipe = null; if (dx > 70 && Math.abs(dy) < 50 && view.length > 1) PH.back(); else if (dy > 90 && Math.abs(dx) < 50 && view.length <= 1 && scr && scr.scrollTop <= 0) PH.close(); });
    shell.addEventListener("input", function (e) { if (e.target && e.target.hasAttribute && e.target.hasAttribute("data-fp-dial")) PH.dialBuf = e.target.value; if (e.target && e.target.hasAttribute && e.target.hasAttribute("data-fp-room")) PH.roomBuf = e.target.value; });
    // keys while the phone is out: these never reach the game, so the arrows do not walk you away
    window.addEventListener("keydown", keys, true);
    // the desktop dock: phone and pockets buttons with the quick slots, bottom-left
    dock = document.createElement("div"); dock.className = "fp-dock"; dock.hidden = true; stg.appendChild(dock);
    dock.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    dock.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-dk]"); if (!b) return; e.preventDefault(); e.stopPropagation(); var a = b.getAttribute("data-dk"); if (a === "phone") PH.toggle(); else if (a === "pocket") { if (Z.inv) Z.inv.toggle(); } else if (Z.inv) Z.inv.hot(+a.slice(3)); });
    return true;
  }
  function keys(e) {
    if (!PH.isOpen()) return; var k = e.code, inInput = e.target && e.target.closest && e.target.closest("input, textarea");
    if (inInput) { if (k === "Escape") { stop(e); PH.back(); } else if (k === "Enter") { stop(e); PH.press(e.target.hasAttribute("data-fp-room") ? "net:join" : "dial:call"); } return; }
    var acts = actions(), n = acts.length, home = view.length <= 1, cols = PH.cols || 4; PH.kb = true;
    if (k === "ArrowRight") focus = home ? Math.min(n - 1, focus + 1) : Math.min(n - 1, focus + 1);
    else if (k === "ArrowLeft") focus = Math.max(0, focus - 1);
    else if (k === "ArrowDown") focus = Math.min(n - 1, focus + (home && focus >= PH.gridFrom ? cols : 1));
    else if (k === "ArrowUp") focus = Math.max(0, focus - (home && focus - cols >= PH.gridFrom ? cols : 1));
    else if (k === "Enter" || k === "NumpadEnter") { if (acts[focus]) PH.press(acts[focus]); }
    else if (k === "Escape" || k === "Backspace") PH.back();
    else return;
    stop(e); paintFocus();
  }
  function stop(e) { e.preventDefault(); e.stopImmediatePropagation(); }
  function actions() { var out = [], m = /data-pa='([^']+)'/g, r; while ((r = m.exec(html))) if (r[1] !== "home") out.push(r[1]); return out; }
  function paintFocus() { if (!scr || !scr.querySelectorAll) return; var list = scr.querySelectorAll("[data-pa]"), j = 0; [].forEach.call(list, function (b) { var on = j === focus; if (b.classList) b.classList.toggle("is-f", !!(on && PH.kb)); if (on && PH.kb && b.scrollIntoView) try { b.scrollIntoView({ block: "nearest" }); } catch (e) {} j++; }); }

  /* ---------- rendering ---------- */
  function statusBar() {
    var p = P(), me = Z.me, bat = clamp(Math.round(100 - ((p.time - 390 + 1440) % 1440) / 1440 * 70), 12, 100), hf = me && me.veh;
    return "<span>" + S.clock(p) + (hf ? " <i class='fp-hf'>HANDS-FREE</i>" : "") + "</span><span><svg width='16' height='11' viewBox='0 0 16 11' aria-label='signal'><rect x='0' y='7' width='3' height='4' fill='#fff'/><rect x='4.3' y='5' width='3' height='6' fill='#fff'/><rect x='8.6' y='2.5' width='3' height='8.5' fill='#fff'/><rect x='12.9' y='0' width='3' height='11' fill='" + (Z.inside ? "rgba(255,255,255,.35)" : "#fff") + "'/></svg> <svg width='24' height='11' viewBox='0 0 24 11' aria-label='battery " + bat + "%'><rect x='.5' y='.5' width='20' height='10' rx='2.5' fill='none' stroke='#fff'/><rect x='2' y='2' width='" + (17 * bat / 100).toFixed(1) + "' height='7' rx='1.4' fill='" + (bat < 25 ? "#f87171" : "#fff") + "'/><rect x='21.5' y='3.5' width='2' height='4' rx='1' fill='#fff'/></svg></span>";
  }
  function head(title) { return "<div class='fp-head'><button type='button' class='fp-back' data-pa='back' aria-label='Back'>" + glyph("back", 22) + "</button><h3>" + title + "</h3></div>"; }
  function row(act, title, sub, right, cls, off, av) { return "<button type='button' class='fp-row" + (cls ? " " + cls : "") + "' data-pa='" + act + "'" + (off ? " disabled" : "") + ">" + (av || "") + "<span class='fp-t'><b>" + title + "</b>" + (sub ? "<small>" + sub + "</small>" : "") + "</span>" + (right ? "<span class='fp-r'>" + right + "</span>" : "") + "</button>"; }
  PH.row = row; PH.head = head;
  function avatar(name, col) { return "<span class='fp-av' style='background:" + (col || "#475569") + "'>" + esc(String(name || "?").charAt(0).toUpperCase()) + "</span>"; }
  PH.avatar = avatar;
  function homeHtml() {
    var p = P(), w = shell ? shell.clientWidth : 300, cols = w < 250 ? 3 : 4; PH.cols = cols;
    var ban = "", banners = 0;
    if (Z.city && Z.city.active && Z.city.active()) { ban += "<button type='button' class='fp-banner' data-pa='report'>" + glyph("report", 22) + "<span>Trouble nearby<small>Report it: security comes faster and knows where to look</small></span></button>"; banners++; }
    var pend = Z.texts && Z.texts.pending ? Z.texts.pending() : []; if (pend.length) { ban += "<button type='button' class='fp-banner is-money' data-pa='app:bank'>" + glyph("bank", 22) + "<span>Money on the way<small>" + esc(pend[0].fromName) + " is sending something</small></span></button>"; banners++; }
    PH.gridFrom = banners;
    return "<div class='fp-clock" + (shell && shell.clientHeight < 440 ? " is-small" : "") + "'><b>" + S.clock(p) + "</b><small>Day " + p.day + " · " + naira(p.money) + " · Level " + p.lvl + "</small></div>" + ban +
      "<div class='fp-grid' style='--cols:" + cols + "'>" + APPS.map(function (a) { var c = a.col.split(","), bd = badge(a.id); return "<button type='button' class='fp-app' data-pa='app:" + a.id + "' aria-label='" + a.name + (bd ? ", " + bd + " new" : "") + "'><i style='background:linear-gradient(145deg," + c[0] + "," + c[1] + ")'>" + glyph(a.id) + "</i><span>" + (a.short && w < 280 ? a.short : a.name) + "</span>" + (bd ? "<em>" + bd + "</em>" : "") + "</button>"; }).join("") + "</div>";
  }
  var R = PH.R = {}; // app renderers: R[id](sub) → inner html; actions go through PH.press
  function render(anim) {
    var p = P(); if (!p) return; var top = view[view.length - 1] || { app: "home" }, inner;
    try { inner = top.app === "home" ? homeHtml() : (R[top.app] ? R[top.app](top) : head(esc(top.app)) + "<div class='fp-body'><p>…</p></div>"); }
    catch (e) { PH.err = e; inner = head("Oops") + "<div class='fp-body'><div class='fp-card'><p>Something went wrong in this app.</p></div></div>"; if (typeof console !== "undefined") console.error(e); }
    html = inner; PH.html = inner; PH.view = top.app;
    if (!scr) return; var bar = shell.querySelector("[data-fp-bar]"); if (bar) bar.innerHTML = statusBar();
    scr.innerHTML = "<div class='" + (anim === "in" ? "fp-in" : anim === "out" ? "fp-out" : "") + "'>" + inner + "</div>"; if (anim) scr.scrollTop = 0;
    var away = shell.classList.contains("is-away"), ring = shell.classList.contains("fp-ring"); shell.className = "fp-phone" + (p.phoneSkin ? " skin" + p.phoneSkin : "") + (away ? " is-away" : "") + (ring ? " fp-ring" : ""); paintFocus();
    var di = scr.querySelector("[data-fp-dial]"); if (di && !(Z.touch && Z.touch.active)) try { di.focus({ preventScroll: true }); } catch (e) { }
  }
  PH.render = render;
  PH.refresh = function () { if (PH.isOpen()) render(); };

  /* ---------- open, close, navigate ---------- */
  PH.isOpen = function () { return st === "out" || st === "pulling"; };
  function canOpen(quiet) {
    var p = P(), me = Z.me; if (!p || Z.mode !== "play") return false;
    if (Z.intro && Z.intro.on) return false;
    if (PH.lost()) { if (!quiet) { var s = PH.state(); toast("<b>Your phone is gone.</b> " + (s.lost.reported ? "Security is looking for it." : "Chase the thief, report it at the security post (Main Gate) or through a friend,") + " or buy a cheap replacement at the market or a shop (" + naira(PH.REPLACE) + ")."); sfx("block"); } return false; }
    if (me && me.veh && Math.abs(me.veh.speed || 0) > 3.2) { if (!quiet) { toast("Eyes on the road. Slow down or stop to use your phone hands-free."); sfx("block"); } return false; }
    if (me && me.fall) return false;
    return true;
  }
  PH.open = function (app) {
    if (!canOpen()) return false; build(); var p = P(), was = PH.isOpen(); view = [{ app: "home" }]; focus = 0;
    if (!was) { st = "pulling"; outT = 0; Z.me.phoneOut = 1; sfx("click"); PH.state(p); warnCrowd(); }
    if (shell) { shell.hidden = false; place(); if (!was) { shell.classList.add("is-away"); void shell.offsetWidth; } render("in"); if (reduce()) shell.classList.remove("is-away"); else setTimeout(function () { if (PH.isOpen() && shell) shell.classList.remove("is-away"); }, 140); } /* the hand reaches the pocket first, then the screen slides up */
    else render();
    if (Z.inv && Z.inv.isOpen && Z.inv.isOpen()) Z.inv.close();
    PH.tools("phone"); if (shell) place();
    try { if (document.exitPointerLock && document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
    if (app) PH.app(app);
    PH.log.push("open"); return true;
  };
  PH.close = function (fast) {
    if (!PH.isOpen()) return; st = "away"; Z.me.phoneOut = 0; if (PH._toolsKeep === "phone") PH.tools(""); if (fast) Z.me.phoneK = 0; view = []; PH.view = "";
    if (shell) { shell.classList.add("is-away"); var s = shell; setTimeout(function () { if (!PH.isOpen()) s.hidden = true; }, reduce() ? 0 : 330); }
    PH.log.push("close");
  };
  PH.toggle = function () { if (PH.isOpen()) PH.close(); else PH.open(); return PH.isOpen(); };
  PH.app = function (id, sub) {
    if (!PH.isOpen()) return false; var a = appById(id); PH.log.push("app:" + id);
    var direct = { map: 1, pockets: 1, mini: 1, life: 1, help: 1, report: 1, saves: 1 };
    if (direct[id]) return launch(id);
    view.push({ app: id, sub: sub || "" }); focus = 0; render("in"); void a; return true;
  };
  PH.go = function (sub, data) { var top = view[view.length - 1]; if (!top) return; view.push({ app: top.app, sub: sub, data: data }); focus = 0; render("in"); };
  PH.back = function () { if (view.length > 1) { view.pop(); focus = 0; render("out"); } else PH.close(); };
  PH.top = function () { return view[view.length - 1] || null; };
  // apps that leave the phone: the big map, the pockets, menus that need the full screen
  function reopen() { if (Z.api.overlayOpen()) Z.api.hide(); PH.open(); }
  function launch(id) {
    var U = Z.ui;
    if (id === "map") { PH.close(); if (Z.bigSet) Z.bigSet(true); return true; }
    if (id === "pockets") { PH.close(); if (Z.inv) Z.inv.open(); return true; }
    if (id === "report") { if (Z.city && Z.city.report) Z.city.report(); render(); return true; }
    PH.close(true);
    if (id === "mini") { if (Z.mini) Z.mini.open(null, { free: true, frame: "tv" }); return true; }
    if (id === "life") { if (Z.life && Z.life.menu) Z.life.menu(reopen); return true; }
    if (id === "help") { U.help(reopen); return true; }
    if (id === "saves" && Z.saves) { Z.saves.open(reopen); return true; }
    return false;
  }
  // one control, by its id. Everything on the screen is a data-pa id, so tests and keys share this path.
  PH.press = function (a) {
    if (!PH.isOpen()) return false; PH.log.push(a);
    if (a === "home") { view = [{ app: "home" }]; focus = 0; render("out"); return true; }
    if (a === "back") { PH.back(); return true; }
    if (a === "report") return launch("report");
    if (a.indexOf("app:") === 0) return PH.app(a.slice(4));
    var top = view[view.length - 1], app = a.split(":")[0], h = PH.H[app];
    if (h) { h(a.slice(app.length + 1), top); return true; }
    return false;
  };
  PH.H = {}; // action handlers by app
  PH.pressLabel = function (re) { var m = /data-pa='([^']+)'[^>]*>([\s\S]*?)<\/button>/g, r; while ((r = m.exec(html))) { var t = r[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " "); if (re.test(t)) { PH.press(r[1]); return r[1]; } } return null; };
  PH.labels = function () { var out = [], m = /data-pa='([^']+)'[^>]*>([\s\S]*?)<\/button>/g, r; while ((r = m.exec(html))) out.push(r[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()); return out; };
  // the old menu-style entry points (samaru-ui.js and tests): "b"/"back" go back
  PH.act = function (a) { if (!PH.isOpen()) return false; if (a === "b" || a === "back") { PH.back(); return true; } return PH.press(a); };
  function place() { if (!shell) return; var r = PH.fit(300, 600, "phone"); if (!r) return; shell.style.left = r.x + "px"; shell.style.top = r.y + "px"; shell.style.width = r.w + "px"; shell.style.height = r.h + "px"; shell.style.fontSize = clamp(r.w / 21, 12.5, 15) + "px"; shell.style.setProperty("--ic", Math.round(clamp((r.w - 34) / (r.w < 250 ? 3 : 4) - 8, 38, 54)) + "px"); PH.rect = r; }
  PH.place = place;

  /* ---------- the apps ---------- */
  var U = function () { return Z.ui; };
  R.goals = function () {
    if (Z.guide && Z.guide.note) Z.guide.note("goals");
    var p = P(), m = Z.mission(), stp = Z.step(), next = D.MISSIONS.filter(function (q) { return !q.side && !p.m.done[q.id]; })[0], sp = S.storyProgress(p, D.MISSIONS);
    var top = m ? "<div class='fp-card'><h4>Chapter " + m.ch + ": " + esc(m.title) + "</h4><p>" + esc(stp ? stp.text : "") + "</p></div>" : next ? "<div class='fp-card'><h4>Next: " + esc(next.title) + "</h4><p>" + (next.need && next.need.lvl > p.lvl ? "Opens at level " + next.need.lvl + ". You are level " + p.lvl + "." : "Starting soon.") + "</p></div>" : "<div class='fp-card'><h4>The story is complete.</h4><p>The long goals below are all that is left. Good luck.</p></div>";
    var gl = Z.goalList().map(function (g) { return "<div class='fp-card'><h4>" + esc(g.m.title) + "</h4><p>" + esc(g.m.steps[0].text) + "</p><div class='fp-meter'><i style='width:" + Math.round(100 * Math.min(1, g.have / g.need)) + "%;background:linear-gradient(90deg,#f59e0b,#fde047)'></i></div><p style='margin-top:4px'>" + g.have + " / " + g.need + " · " + naira(g.m.reward.cash) + "</p></div>"; }).join("");
    return head("Goals") + "<div class='fp-body'>" + top + "<div class='fp-card'><p>Story " + sp.done + "/" + sp.total + " · kola nuts " + p.stats.tokens + "/" + S.TOKEN_COUNT + "</p></div>" + gl + "</div>";
  };
  R.jobs = function () {
    var p = P(); if (p.job) return head("Jobs") + "<div class='fp-body'><div class='fp-card'><h4>Job in progress</h4><p>" + esc(S.jobText(p.job)) + "</p></div>" + row("jobs:cancel", "Cancel this job", "The job vehicle goes back; finished stops are paid", "", "is-warn") + "</div>";
    var offers = Z.offers(null); PH._offers = offers;
    return head("Jobs") + "<div class='fp-body'><div class='fp-card'><p>Pay grows with distance and your level. Finish fast for a 25% bonus.</p></div>" + offers.map(function (j, i) { return row("jobs:take:" + i, { delivery: "Delivery", taxi: "Taxi run", lost: "Lost property", errand: "Errand" }[j.kind] + " · " + naira(j.pay), esc(j.kind === "lost" ? "Find " + j.what + " near " + j.b.name : j.kind === "taxi" ? j.a.name + " → " + j.b.name + " (okada, keke or car)" : j.a.name + " → " + j.b.name) + " · +" + j.xp + " XP"); }).join("") + "</div>";
  };
  PH.H.jobs = function (a) { var p = P(); if (a === "cancel") { if (Z.jobs) Z.jobs.cancel(true); else p.job = null; render(); return; } var k = a.split(":"); if (k[0] === "take" && PH._offers && PH._offers[+k[1]]) { var j = PH._offers[+k[1]]; PH.close(); Z.takeJob(j); } };
  function homeContacts() { return (Z.texts && Z.texts.HOME) || []; }
  R.contacts = function () {
    var p = P(), ids = Object.keys(p.friends).filter(function (id) { return Z.npc(id); }).sort(function (a, b) { return p.friends[b] - p.friends[a]; });
    return head("Contacts") + "<div class='fp-body'>" + homeContacts().map(function (h) { return row("contacts:home:" + h.id, esc(h.name), "Family · call or text", "📞", "", false, avatar(h.name, h.col)); }).join("") +
      "<div class='fp-card'><p>" + (ids.length ? "Calling costs ₦50 of airtime. Friends (20+) will come and find you." : "Talk to people around campus to get their numbers.") + "</p></div>" +
      ids.map(function (id) { var n = Z.npc(id), a = p.friends[id], off = a < 20 || p.money < 50 || n.follow || (id === "sly" && !p.flags.slyAlly); return row("contacts:call:" + id, esc(n.def.name) + (p.partner === id ? " ♥" : ""), esc(n.def.role) + " · " + S.friendTier(a) + " " + Math.round(a) + "/100" + (a < 20 ? " · not close enough to call out" : ""), off ? "" : "📞", "", off, avatar(n.def.name, n.look && n.look.top)); }).join("") + "</div>";
  };
  PH.H.contacts = function (a) { var k = a.split(":"), p = P(); if (k[0] === "home") { view.push({ app: "bank", sub: "who", data: k[1] }); focus = 0; render("in"); return; } if (k[0] === "call") { var n = Z.npc(k[1]); if (!n || p.money < 50) return; Z.money(-50); PH.close(); sfx("click"); Z.hangout(n); } };
  R.friends = function (top) {
    var p = P(), ids = Object.keys(p.friends).filter(function (id) { return Z.npc(id) && p.friends[id] > 0; }).sort(function (a, b) { return (b === p.partner) - (a === p.partner) || p.friends[b] - p.friends[a]; });
    if (top.sub === "one") return friendOne(top.data);
    return head("Friends") + "<div class='fp-body'>" + (ids.length ? ids.map(function (id) { var n = Z.npc(id), a = p.friends[id]; return "<button type='button' class='fp-row' data-pa='friends:one:" + id + "'>" + avatar(n.def.name, n.look && n.look.top) + "<span class='fp-t'><b>" + esc(n.def.name) + (p.partner === id ? " <span style='color:#f9a8d4'>♥</span>" : "") + "</b><small>" + S.friendTier(a) + " · " + esc(where(n)) + "</small><span class='fp-meter'><i style='width:" + Math.round(a) + "%'></i></span></span></button>"; }).join("") : "<div class='fp-card'><p>No friends yet. Talk to people around campus: chat once a day, wave, eat together.</p></div>") + "</div>";
  };
  function where(n) { var me = Z.me; if (n.follow) return "with you"; if (n.hidden) return "away"; var d = Math.hypot(n.x - me.x, n.y - me.y), best = null, bd = 1e9; Z.placeList.forEach(function (pl) { if (pl.role === "stop") return; var e = Math.hypot(pl.mx - n.x, pl.my - n.y); if (e < bd) { bd = e; best = pl; } }); return (best && bd < 90 ? "near " + best.name : "around campus") + " · " + (d < 1000 ? Math.round(d / 10) * 10 + " m" : (d / 1000).toFixed(1) + " km"); }
  PH.where = where;
  function friendOne(id) {
    var p = P(), n = Z.npc(id); if (!n) return head("Friend") + "<div class='fp-body'></div>"; var a = S.affinity(p, id), lk = n.def.likes || {}, likes = lk.gift && Z.inv ? Z.inv.def(lk.gift).name : "";
    return head(esc(n.def.name)) + "<div class='fp-body'><div class='fp-card' style='display:flex;gap:10px;align-items:center'>" + avatar(n.def.name, n.look && n.look.top) + "<div style='flex:1'><h4>" + esc(n.def.name) + (p.partner === id ? " ♥" : "") + "</h4><p>" + esc(n.def.role) + " · " + S.friendTier(a) + " " + Math.round(a) + "/100</p><div class='fp-meter'><i style='width:" + Math.round(a) + "%'></i></div></div></div>" +
      "<div class='fp-card'><p>📍 " + esc(where(n)) + (likes && a >= 50 ? "<br>🎁 Loves: " + esc(likes) : "") + "</p></div>" +
      row("friends:invite:" + id, n.follow ? "Already with you" : "Invite to hang out", a >= 20 ? "Free text: they come and find you" : "Needs Friend (20)", "", n.follow || a < 20 ? "" : "is-go", n.follow || a < 20 || (id === "sly" && !p.flags.slyAlly)) +
      row("friends:text:" + id, "Messages", "Open your chat with " + esc(n.def.name.split(" ")[0])) + "</div>";
  }
  PH.H.friends = function (a) { var k = a.split(":"); if (k[0] === "one") return PH.go("one", k[1]); if (k[0] === "invite") { if (Z.texts && Z.texts.invite) Z.texts.invite(k[1]); render(); return; } if (k[0] === "text") { view.push({ app: "messages", sub: "thread", data: k[1] }); focus = 0; render("in"); } };
  R.radio = function () { var p = P(); return head("Radio") + "<div class='fp-body'><div class='fp-card'><p>Every bicycle, scooter, okada, keke and car has one. Press " + esc(Z.api.keyName("radio")) + " while riding to change station.</p></div>" + D.RADIO.filter(function (r) { return !r.secret || p.eggs.radio; }).map(function (r, i) { return row("radio:" + i, esc(r.name), esc(r.style), "▶"); }).join("") + "</div>"; };
  PH.H.radio = function (a) { var p = P(), list = D.RADIO.filter(function (r) { return !r.secret || p.eggs.radio; }), r = list[+a]; if (!r) return; Z.api.music(Arcade.song(r.seed, r.style, r.o)); toast("♪ <b>" + esc(r.name) + "</b>"); try { if (Z.guide && Z.guide.note) Z.guide.note("radio"); } catch (e) {} };
  R.dial = function () {
    return head("Dial") + "<div class='fp-body'><input type='text' class='fp-num' data-fp-dial inputmode='tel' maxlength='24' placeholder='" + (PH.dialErr ? "Invalid MMI code" : "Service code") + "' value='" + esc(PH.dialBuf || "") + "' aria-label='Number'>" +
      "<div class='fp-pad'>" + ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map(function (k) { return "<button type='button' data-pa='dial:k" + k + "' aria-label='" + k + "'>" + k + "</button>"; }).join("") + "</div>" +
      "<div style='display:grid;grid-template-columns:1fr 1fr;gap:8px'><button type='button' class='fp-call' data-pa='dial:call'>Call</button><button type='button' class='fp-call is-end' data-pa='dial:clr'>Clear</button></div></div>";
  };
  PH.dialBuf = "";
  PH.H.dial = function (a) {
    if (a[0] === "k") { PH.dialBuf = (PH.dialBuf + a.slice(1)).slice(0, 24); PH.dialErr = 0; sfx("click"); return render(); }
    if (a === "clr") { PH.dialBuf = ""; PH.dialErr = 0; return render(); }
    if (a === "call") { var v = PH.dialBuf; try { var inp = scr && scr.querySelector("[data-fp-dial]"); if (inp) v = inp.value; } catch (e) {} var c = S.cheatMatch(Z.cheatTable(), v, "dial"); PH.dialBuf = ""; if (!c) { if (window.MIBPlay && MIBPlay.checkCheat) MIBPlay.checkCheat(String(v), "dial").then(function (id) { var cc = id && S.cheatById(id); if (cc) { PH.close(); Z.cheat(cc); } }, function () {}); /* MIB-Hub: server-checked codes */ sfx("block"); PH.dialErr = 1; return render(); } PH.dialErr = 0; PH.close(); Z.cheat(c); }
  };
  R.me = function () {
    var p = P(), s = p.stats, ch = Z.charOf(p.char);
    return head("Profile") + "<div class='fp-body'><div class='fp-card'><h4>" + esc(p.name) + " · " + esc(ch.name.split(" ")[0]) + "</h4><p>Level " + p.lvl + " " + S.title(p.lvl) + " · " + p.xp.toLocaleString() + " XP · next level at " + S.xpForLevel(p.lvl + 1).toLocaleString() + "</p></div>" +
      "<div class='fp-card'><p>Day " + p.day + " · " + s.km.toFixed(1) + " km · " + s.classes + " classes · " + s.jobs + " jobs · " + s.races + " races won · " + s.shades + " shades · " + s.dates + " dates · " + s.tokens + " kola nuts · " + Object.keys(p.eggs).length + "/8 easter eggs · fainted " + s.faints + " times" + (p.partner && Z.npc(p.partner) ? " · with " + esc(Z.npc(p.partner).def.name) : "") + (p.cheated ? " · <b>codes used: off the leaderboard</b>" : "") + "</p></div>" +
      row("me:outfit", "Clothes", D.OUTFITS[p.outfit || 0].name, "›") + row("me:tone", "Voice", ["Natural", "Deep", "Bright"][p.voiceTone || 0], "›") + row("me:vi", "Speaker", "Voice " + ((p.voiceI || 0) + 1), "›") + row("me:hear", "Hear it", "", "▶") + "</div>";
  };
  PH.H.me = function (a) { var p = P(); if (a === "outfit") p.outfit = ((p.outfit || 0) + 1) % D.OUTFITS.length; else if (a === "tone") p.voiceTone = ((p.voiceTone || 0) + 1) % 3; else if (a === "vi") p.voiceI = ((p.voiceI || 0) + 1) % 6; else if (a === "hear") { Z.bark("wave"); return; } render(); };
  R.settings = function () {
    var p = P(), r3 = Z.r3 && Z.r3.ready, sk = ["Classic black", "Gold case", "Green-white-green", "Clear case"];
    return head("Settings") + "<div class='fp-body'>" + (r3 ? row("settings:gfx", "Graphics", Z.r3.tierName ? Z.r3.tierName() : Z.r3.quality === "high" ? "High" : "Fast", "›") : "") + (Z.touch ? row("settings:look", "Look stick", Z.touch.sensName(), "›") : "") +
      row("settings:case", "Phone case", sk[p.phoneSkin || 0] + " · buy more at the mall phone shop", "›") +
      (Z.guide ? row("settings:tut", Z.guide.active() ? "Skip the walkthrough" : "Replay the walkthrough", "The first-day lessons") : "") + (Z.inv ? row("settings:pocket", "Replay the pockets lesson", "Eating from your pockets") : "") +
      (Z.api.openSettings ? row("settings:all", "All settings", "Sound, display, controls, phone layout", "›") : "") + "</div>";
  };
  PH.H.settings = function (a) {
    var p = P();
    if (a === "gfx") { if (Z.r3.cycle) Z.r3.cycle(); else Z.r3.setQuality(Z.r3.quality === "high" ? "low" : "high"); }
    else if (a === "look") Z.touch.cycleSens();
    else if (a === "case") { var own = [0, 1, 2, 3].filter(function (i) { return i === 0 || p.flags["phone" + i]; }), k = own.indexOf(p.phoneSkin || 0); p.phoneSkin = own[(k + 1) % own.length]; }
    else if (a === "tut") { PH.close(); if (Z.guide.active()) Z.guide.skip(); else Z.guide.start(); return; }
    else if (a === "pocket") { var s = Z.inv.state(); s.tut = { s: 1 }; PH.close(); return; }
    else if (a === "all") { PH.close(true); Z.api.openSettings(); return; }
    render();
  };
  R.quit = function () { return head("Quit") + "<div class='fp-body'><div class='fp-card'><p>Your game saves first. You can carry on from the title screen.</p></div>" + row("quit:go", "Save and go to the title screen", "", "", "is-warn") + "</div>"; };
  PH.H.quit = function (a) { if (a === "go") { PH.close(true); Z.save(); Z.netLeave(); Z.ui.title(); } };
  R.camera = function (top) {
    var p = P(), s = PH.state(p), here = nearPlace();
    return head("Camera") + "<div class='fp-body'><div class='fp-view'><b>" + esc(here) + " · " + S.clock(p) + "</b></div>" + row("camera:snap", "📸 Take a photo", "Saved to your gallery", "", "is-go") +
      (s.photos.length ? "<div class='fp-shot'>" + s.photos.slice(-9).reverse().map(function (ph) { return "<div style='background:" + ph.bg + "'>" + esc(ph.where) + "<br>Day " + ph.day + " " + ph.clock + "</div>"; }).join("") + "</div>" : "<div class='fp-card'><p>No photos yet.</p></div>") + "</div>";
    void top;
  };
  function nearPlace() { var me = Z.me, best = null, bd = 1e9; Z.placeList.forEach(function (pl) { if (pl.role === "stop") return; var d = Math.hypot(pl.mx - me.x, pl.my - me.y); if (d < bd) { bd = d; best = pl; } }); return best && bd < 120 ? best.name : "Campus"; }
  PH.H.camera = function (a) {
    if (a !== "snap") return; var p = P(), s = PH.state(p), dk = S.darkness ? S.darkness(p.time) : 0, bg = dk > .5 ? "linear-gradient(160deg,#1e1b4b,#0f172a)" : "linear-gradient(160deg,#38bdf8,#0ea5e9 50%,#65a30d 51%,#3f6212)";
    s.photos.push({ where: nearPlace(), day: p.day, clock: S.clock(p), bg: bg }); if (s.photos.length > 24) s.photos.shift();
    try { Z.api.flash("#ffffff", .5); } catch (e) {} sfx("click"); buzz(15); try { Z.emit({ t: "photo", place: nearPlace() }); } catch (e) {} render();
  };
  R.net = function () {
    var N = Z.net, peers = Object.keys(N.peers);
    if (!N.on) return head("Multiplayer") + "<div class='fp-body'><div class='fp-card'><p>Up to six players share one campus. Everyone opens this game on the same Wi-Fi (the same EE Hub address) and types the same room code.</p></div>" + (N.err ? "<div class='fp-card' style='color:#fca5a5'><p>" + esc(N.err) + "</p></div>" : "") + "<input type='text' class='fp-num' data-fp-room maxlength='8' placeholder='ROOM CODE' value='" + esc(PH.roomBuf || N.code || "") + "' aria-label='Room code' style='text-transform:uppercase'>" + row("net:join", "Join or create", "", "", "is-go") + "<div class='fp-card'><p>You see each other walk, ride, wave and dance; chat with quick phrases, race together and spar (" + esc(Z.api.keyName("emote4")) + "). Shades, jobs and story stay your own.</p></div></div>";
    var inv = N.invite && N.invite.at > Date.now() + N.offset ? N.invite : null;
    return head("Room " + esc(N.code)) + "<div class='fp-body'><div class='fp-card'><p>" + (peers.length ? "With you: " + peers.map(function (id) { return "<b>" + esc(N.peers[id].name) + "</b> (L" + (N.peers[id].lvl || 1) + ")"; }).join(", ") : "Nobody else yet. Share the code.") + "</p></div>" +
      (inv ? row("net:joinrace", "Join the race", "Starting soon", "", "is-go") : "") + row("net:race", "Start a group race", "Bicycles, Theatre Loop") + row("net:coop", "Friends missions", "", "›") +
      "<div class='fp-quick'>" + Z.CHAT.map(function (c, i) { return "<button type='button' data-pa='net:c" + i + "'>" + esc(c) + "</button>"; }).join("") + "</div>" + row("net:leave", "Leave room", "", "", "is-warn") + "</div>";
  };
  PH.H.net = function (a) {
    var N = Z.net;
    if (a === "join") { var v = PH.roomBuf || ""; try { var inp = scr && scr.querySelector("[data-fp-room]"); if (inp) v = inp.value; } catch (e) {} if (Z.netJoin(v)) { PH.close(); toast("Joining room <b>" + esc(Z.net.code) + "</b>…"); } else { N.err = "Use at least 3 letters or numbers."; render(); } return; }
    if (a === "leave") { Z.netLeave(); return render(); }
    if (a[0] === "c") { var i = +a.slice(1); N.out.push({ k: "chat", p: i }); Z.say("me", Z.CHAT[i]); return; }
    if (a === "coop") { if (window.FSLGCoop) { PH.close(true); FSLGCoop.menu(reopen); } return; }
    if (a === "race") { var at = Date.now() + N.offset + 8000; N.out.push({ k: "race", r: 0, at: at }); PH.close(); Z.startRace(D.ROUTES[0], "bike", "bronze", at); return; }
    if (a === "joinrace") { var iv = N.invite; if (!iv) return; PH.close(); Z.startRace(D.ROUTES[iv.r || 0], "bike", "bronze", iv.at); N.invite = null; }
  };
  // the maker's dial: every cheat as a button (the secret student keeps his own menu)
  var oDial = R.dial; R.dial = function (top) { if (S.isHero(P())) { return head("Dial") + "<div class='fp-body'><div class='fp-card'><p>Maker's menu: every code as a button.</p></div>" + S.CHEATS.map(function (q, i) { return row("dial:hero" + i, esc(q.label), esc(q.text)); }).join("") + "</div>"; } return oDial(top); };
  var oDialH = PH.H.dial; PH.H.dial = function (a) { if (a.indexOf("hero") === 0) { var c = S.CHEATS[+a.slice(4)]; if (c) { PH.close(); Z.cheat(c); } return; } return oDialH(a); };

  /* ---------- incoming notifications on the handset ---------- */
  PH.notify = function (title, text, kind) { // a ping: vibrate, sound, a toast, and a banner on the handset when it is out
    var p = P(); if (!p) return; sfx(kind === "money" ? "coin" : "click"); buzz(kind === "call" ? [80, 60, 80] : 35);
    if (!PH.isOpen()) toast("<b>" + (kind === "money" ? "💸 " : "💬 ") + esc(title) + "</b><br>" + esc(text)); else if (shell) { var t = shell.querySelector("[data-fp-toast]"); if (t) { t.innerHTML = "<b>" + esc(title) + "</b><br>" + esc(text); t.hidden = false; clearTimeout(PH._tt); PH._tt = setTimeout(function () { t.hidden = true; }, 3200); } render(); }
    if (shell) { shell.classList.remove("fp-ring"); void shell.offsetWidth; if (!reduce()) shell.classList.add("fp-ring"); }
    PH.pinged = (PH.pinged || 0) + 1;
  };
  // the story's calls can ring here: Z.phone.call({ who: "Mum", lines: [...], incoming: true, then: fn })
  PH.call = function (o) {
    o = o || {}; if (!PH.isOpen() && !PH.open()) { if (o.then) o.then(false); return false; }
    view.push({ app: "call", sub: "", data: o }); focus = 0; render("in"); buzz([80, 60, 80]); sfx("click"); return true;
  };
  R.call = function (top) { var o = top.data || {}; return "<div class='fp-body' style='padding-top:40px;text-align:center'><div class='fp-av' style='margin:0 auto;width:84px;height:84px;font-size:34px;flex-basis:84px;background:#334155'>" + esc(String(o.who || "?").charAt(0)) + "</div><h3 style='margin:12px 0 2px;font:800 22px system-ui'>" + esc(o.who || "Unknown") + "</h3><p style='opacity:.8;margin:0 0 30px'>" + (o.incoming === false ? "Call?" : "is calling…") + "</p><button type='button' class='fp-call' data-pa='call:yes'>" + (o.incoming === false ? "Call" : "Answer") + "</button>" + (o.optional ? "<button type='button' class='fp-call is-end' data-pa='call:no' style='margin-top:8px'>Decline</button>" : "") + "</div>"; };
  PH.H.call = function (a, top) { var o = top && top.data || {}; view.pop(); if (a === "yes") { PH.close(); if (o.lines && Z.story && Z.story.say) Z.story.say(o.lines); if (o.then) o.then(true); } else { render(); if (o.then) o.then(false); } };

  /* ---------- the phone in your hand: pull out, hold, put away ---------- */
  function animTick(dt) {
    var me = Z.me; if (!me) return; var want = PH.isOpen() && !me.veh ? 1 : 0, k = me.phoneK || 0, rate = reduce() ? 8 : 2.2;
    if (want > k) k = Math.min(1, k + dt * rate); else if (want < k) k = Math.max(0, k - dt * rate * 1.3);
    me.phoneK = k; if (st === "pulling" && (k >= .99 || me.veh)) st = "out";
    if (PH.isOpen()) outT += dt; else outT = 0;
  }
  // walkers with phones: a few pull theirs out for a while (pose only; the crowd module still moves them)
  var pedT = 0;
  function pedPhones(dt) {
    pedT -= dt; var peds = Z.peds, i, n; for (i = 0; i < peds.length; i++) { n = peds[i]; if (n.phT > 0) { n.phT -= dt; n.phoneK = Math.min(1, (n.phoneK || 0) + dt * 2); if (n.phT <= 0 || n.cr || n.fall > 0 || n.st) n.phT = 0; } else if (n.phoneK > 0) n.phoneK = Math.max(0, n.phoneK - dt * 2.5); }
    if (pedT > 0) return; pedT = 1.5; var p = P(), slot = Math.floor(absMin(p));
    for (i = 0; i < peds.length; i++) { n = peds[i]; if (n.phT > 0 || n.cr || n.scene || n.fall > 0 || n.st || n.pax || n.film) continue; if (S.hash(slot + i * 7, (n.k || 0) + 31) < .035) n.phT = 6 + S.hash(slot, i) * 14; }
  }

  /* ---------- snatches: a phone held out in a crowd ---------- */
  var sn = null; PH.snatch = function () { return sn; };
  function crowdNear(r) { var me = Z.me, c = 0; for (var i = 0; i < Z.peds.length; i++) { var n = Z.peds[i]; if (!n.cr && !n.gone && Math.hypot(n.x - me.x, n.y - me.y) < r) c++; } return c; }
  function night(p) { var h = p.time / 60; return h >= 20 || h < 5; }
  function zoneMul() { var me = Z.me, best = null, bd = 1e9; Z.placeList.forEach(function (pl) { var d = Math.hypot(pl.mx - me.x, pl.my - me.y); if (d < bd) { bd = d; best = pl; } }); if (!best || bd > 120) return 1; var z = best.def.zone || ""; return /market|gate|social|shinkafi|road/.test(z) ? 2 : /quiet|lake|garden|senate/.test(z) ? .5 : /hostel|phase2/.test(z) ? .8 : 1; }
  function warnCrowd() { var p = P(), s = PH.state(p); if (s.warned.crowd || Z.intro && Z.intro.on) return; if (night(p) && crowdNear(18) >= 3) { s.warned.crowd = 1; setTimeout(function () { toast("<b>Careful using your phone in crowds at night.</b> Snatchers look for a phone held out in the open."); }, 600); } }
  PH.snatchOk = function () {
    var p = P(), me = Z.me, s = PH.state(p); if (!p || Z.mode !== "play" || s.lost || sn) return false; if (Z.intro && Z.intro.on) return false;
    if (me.veh || Z.inside || me.fall || Z.race || p.job || Z.date) return false;
    var stp = Z.step && Z.step(); if (stp && (stp.t === "phone" || stp.phone)) return false;
    if (Z.focus && Z.focus.current && Z.focus.current().kind !== "roam") return false;
    if (Z.city && ((Z.city.allowed && !Z.city.allowed()) || (Z.city.incident && Z.city.incident()))) return false;
    if (s.snAt && absMin(p) - s.snAt < 2 * 1440) return false; // at most once every two days
    if (Z.guide && Z.guide.active && Z.guide.active()) return false;
    return true;
  };
  PH.snatchChance = function () { var p = P(), c = crowdNear(18); if (c < 3) return 0; return .0006 * zoneMul() * (night(p) ? 2.5 : 1) * Math.min(2, c / 5); };
  PH.SNATCH_MIN_OUT = 2.5;
  function snatchRoll(dt) {
    if (!PH.isOpen() || outT < PH.SNATCH_MIN_OUT) return; PH._snT = (PH._snT || 0) - dt; if (PH._snT > 0) return; PH._snT = 1;
    if (!PH.snatchOk()) return; var p = P(), ch = PH.snatchChance(); if (!ch) return; var s = PH.state(p); s.roll = (s.roll || 0) + 1;
    if (S.hash(Math.floor(absMin(p)), s.roll) < ch || PH.forceSnatch) { PH.forceSnatch = 0; PH.startSnatch(); }
  }
  PH.startSnatch = function () {
    var me = Z.me, p = P(), best = null, bs = -1, yaw = Z.r3 && Z.r3.ready ? Z.r3.yaw : me.a;
    for (var i = 0; i < Z.peds.length; i++) { var n = Z.peds[i]; if (n.cr || n.scene || n.fall > 0 || n.st || n.pax || n.gone || n.hall) continue; var d = Math.hypot(n.x - me.x, n.y - me.y); if (d < 5 || d > 26) continue; var behind = -Math.cos(Math.atan2(n.y - me.y, n.x - me.x) - yaw); var sc = behind + 1 - d / 40; if (sc > bs) { bs = sc; best = n; } }
    if (!best) return false; best.cr = "snatcher"; best.scene = null; best.phT = 0; best.film = false; best.sit = false; best.hits0 = best.hits || 0;
    sn = { n: best, st: "approach", t: 0, seen: 0, grab: 0 }; PH.state(p).snAt = absMin(p); return true;
  };
  function snatchStep(dt) {
    if (!sn) return; var me = Z.me, n = sn.n, p = P(), W = Z.W; sn.t += dt;
    if (Z.peds.indexOf(n) < 0) { if (sn.st === "run") escaped(); sn = null; return; }
    var d = Math.hypot(n.x - me.x, n.y - me.y);
    if (sn.st === "approach") {
      if (!PH.isOpen() || me.veh || sn.t > 14) { n.cr = null; sn = null; return; } // you put it away in time
      S.walkTo(W, n, me.x - Math.cos(me.a) * .6, me.y - Math.sin(me.a) * .6, 4.6, dt, null, .4); n.walk = (n.walk || 0) + (n.spd || 0) * dt * 2.6;
      if (d < 1.15) grab(); return;
    }
    if (sn.st === "run") {
      if ((n.hits || 0) > sn.n.hits0 || (n.fall > 0 && d < 4.5)) return caught();
      if (d < 1.1 && !me.veh) { sn.grab += dt; if (sn.grab > .45) { n.fall = 1.6; return caught(); } } else sn.grab = Math.max(0, sn.grab - dt);
      var tired = sn.t > 18 ? .78 : 1, sp = S.FOOT.run * .8 * tired; sn.rt = (sn.rt || 0) - dt;
      if (!sn.goal || sn.rt <= 0 || Math.hypot(sn.goal.x - n.x, sn.goal.y - n.y) < 2) { sn.rt = 1.6; var base = Math.atan2(n.y - me.y, n.x - me.x), pick = null, ps = -1e9; for (var k = 0; k < 9; k++) { var a = base + (k - 4) * .35, r = 16 + S.hash(k, Math.floor(sn.t * 10)) * 8, x = n.x + Math.cos(a) * r, y = n.y + Math.sin(a) * r; if (S.insideBuilding(W, x, y) || S.inWater(W, x, y)) continue; var sc = Math.hypot(x - me.x, y - me.y) - Math.abs(k - 4) * 1.5; if (sc > ps) { ps = sc; pick = { x: x, y: y }; } } sn.goal = pick || { x: n.x + Math.cos(base) * 12, y: n.y + Math.sin(base) * 12 }; }
      if (!(n.fall > 0)) { S.walkTo(W, n, sn.goal.x, sn.goal.y, sp, dt, null, .4); var q = S.push(W, n.x, n.y, .4); n.x = q.x; n.y = q.y; n.walk = (n.walk || 0) + (n.spd || 0) * dt * 2.6; }
      var see = d < 40 && S.los(W, me.x, me.y, n.x, n.y); if (see) sn.seen = sn.t;
      if ((sn.t - sn.seen > 6 && sn.t > 8) || sn.t > 60 || d > 90) escaped();
    }
  }
  function grab() {
    var me = Z.me, n = sn.n, p = P(), s = PH.state(p); sn.st = "run"; sn.t = 0; sn.seen = 0;
    s.lost = { day: p.day, t: absMin(p), by: "snatch", reported: 0 }; s.snatched = (s.snatched || 0) + 1;
    if (shell) { shell.classList.add("is-snatch"); var sh = shell; setTimeout(function () { sh.classList.remove("is-snatch"); }, 400); }
    st = "away"; view = []; me.phoneOut = 0; me.phoneK = 0; n.phoneK = 1; n.phT = 999; me.hitT = .35; me.hitA = Math.atan2(me.y - n.y, me.x - n.x);
    if (shell) { var b = shell; setTimeout(function () { if (!PH.isOpen()) b.hidden = true; }, 380); }
    try { Z.say(n, "Thank you o!"); } catch (e) {} sfx("dash"); buzz(120);
    toast("<b>Your phone was snatched!</b> Run after him: get close and tackle or punch to get it back.");
    try { Z.emit({ t: "crime", kind: "snatch", phase: "start", you: true }); } catch (e) {}
    PH.log.push("snatched");
  }
  function caught() {
    var n = sn.n, p = P(), s = PH.state(p); s.lost = null; sn = null; n.phoneK = 0; n.phT = 0; s.recovered = (s.recovered || 0) + 1;
    try { Z.say(n, "Sorry! Sorry! Take am, take your phone!"); } catch (e) {} n.st = ""; setTimeout(function () { n.cr = null; n.gone = true; }, 4000);
    sfx("goal"); buzz(40); try { Z.xp(20); } catch (e) {} if (Z.city && Z.city.state) { var cs = Z.city.state(); if (cs) { cs.rep += 2; cs.caught++; } }
    toast("<b>You got your phone back!</b> +20 XP. Maybe keep it in your pocket in crowds."); try { Z.emit({ t: "crime", kind: "snatch", phase: "caught", by: "you", you: true }); } catch (e) {}
    if (Z.texts && Z.texts.backOnline) Z.texts.backOnline(); PH.log.push("recovered");
  }
  function escaped() {
    var p = P(), s = PH.state(p), n = sn && sn.n; if (n) { n.cr = null; n.gone = true; } sn = null; if (s.lost) s.lost.escaped = 1;
    toast("<b>He got away with your phone.</b> Report it at the security post by the Main Gate, or ask a friend to call it in. A cheap phone costs " + naira(PH.REPLACE) + " at the market and shops.");
    try { Z.emit({ t: "crime", kind: "snatch", phase: "escaped", you: true }); } catch (e) {} PH.log.push("escaped");
  }
  // report from the security post (the Main Gate) or through a friend: often found within a day
  PH.report = function (how) {
    var p = P(), s = PH.state(p); if (!s.lost || s.lost.reported) return false; s.lost.reported = absMin(p); s.lost.how = how || "post";
    s.lost.find = S.hash(p.day * 31 + s.snatched, 404) < .7 ? 240 + Math.floor(S.hash(p.day, 405) * 480) : 0; // found 4 to 12 game hours later, seven times in ten
    toast("<b>Reported.</b> Security has the description" + (how === "friend" ? " (thanks to your friend's phone)" : "") + ". They will call you if they find it."); sfx("click"); return true;
  };
  PH.recover = function (why) { var s = PH.state(); if (!s.lost) return false; s.lost = null; if (sn) { sn.n.cr = null; sn = null; } toast(why || "<b>Security found your phone!</b> They dropped it at your hostel. Nothing missing, just a scratched case."); sfx("goal"); if (Z.texts && Z.texts.backOnline) Z.texts.backOnline(); return true; };
  PH.replace = function () { var p = P(), s = PH.state(p); if (!s.lost) return false; if (p.money < PH.REPLACE) { toast("A replacement phone is " + naira(PH.REPLACE) + "."); return false; } p.money -= PH.REPLACE; p.phoneSkin = 0; s.lost = null; sfx("coin"); toast("<b>New (cheap) phone!</b> Your SIM brought your contacts back. Apps work again."); if (Z.texts && Z.texts.backOnline) Z.texts.backOnline(); return true; };
  function lostTick() { var p = P(), s = PH.state(p); if (!s.lost || !s.lost.reported || !s.lost.find) return; if (absMin(p) - s.lost.reported >= s.lost.find) PH.recover(); }
  // rows for place menus and the talk menu (samaru-ui.js calls these)
  PH.placeItems = function (pl, items) { var s = PH.state(); if (!s || !s.lost) return; if (pl.id === "gate" || pl.role === "security") items.push({ label: "Report your stolen phone", sub: s.lost.reported ? "Already reported. They will call when they find it." : "The security post takes the description", off: !!s.lost.reported, go: !s.lost.reported, run: function () { PH.report("post"); Z.ui.place(pl); } }); };
  PH.talkItems = function (n, items) { var p = P(), s = PH.state(p); if (!s || !s.lost || s.lost.reported) return; if (S.affinity(p, n.id) < 5) return; items.push({ label: "Borrow their phone to report the theft", sub: "Call security about your stolen phone", run: function () { PH.report("friend"); try { Z.say(n, "Here, use mine. Call them now!"); } catch (e) {} Z.ui.talk(n); } }); };

  /* ---------- the HUD: badges on the phone buttons, the desktop dock ---------- */
  var dockKey = "";
  function hud() {
    var T = Z.touch, n = Z.texts && Z.texts.unread ? Z.texts.unread() : 0, lost = PH.lost();
    try { var b = T && T.buttons && T.buttons.phone; if (b && b.appendChild) { var bd = b.querySelector(".fp-badge"); if (n && !lost) { if (!bd) { bd = document.createElement("i"); bd.className = "fp-badge"; b.appendChild(bd); } if (bd.textContent !== String(n)) bd.textContent = n; } else if (bd) bd.remove(); b.style.opacity = lost ? ".45" : ""; } } catch (e) {}
    if (!dock) return; var show = Z.mode === "play" && !(T && T.active) && !Z.api.overlayOpen() && !(Z.intro && Z.intro.on) && !(Z.bigOpen && Z.bigOpen()) && !(Z.mini && Z.mini.active && Z.mini.active());
    if (dock.hidden === show) dock.hidden = !show; if (!show) return;
    var s = Z.inv ? Z.inv.state() : null, key = n + ":" + lost + ":" + (s ? s.slots.slice(0, 3).map(function (q) { return q ? q.id + q.n : "-"; }).join(",") : ""); if (key === dockKey) return; dockKey = key;
    var k = function (a) { try { return esc(String(Z.api.keyName(a)).split(" / ")[0]); } catch (e) { return ""; } };
    dock.innerHTML = "<button type='button' data-dk='phone' aria-label='Phone'><i>" + glyph("dial", 26).replace("stroke='#fff'", "stroke='#fff'") + "</i><kbd>" + k("phone") + "</kbd>" + (n && !lost ? "<em>" + n + "</em>" : "") + "</button>" +
      (Z.inv ? "<button type='button' data-dk='pocket' aria-label='Pockets'><i>" + Z.inv.iconOf("bag", "#c2410c") + "</i><kbd>" + k("pocket") + "</kbd></button>" + [0, 1, 2].map(function (i) { var q = s.slots[i]; return "<button type='button' class='fp-hs' data-dk='hot" + i + "' aria-label='Quick slot " + (i + 5) + (q ? ": " + esc(Z.inv.def(q.id).name) : "") + "'><kbd>" + (i + 5) + "</kbd>" + (q ? Z.inv.icon(q.id) + (q.n > 1 ? "<b>" + q.n + "</b>" : "") : "") + "</button>"; }).join("") : "");
  }
  PH.dockHtml = function () { return dock ? dock.innerHTML : ""; };

  /* ---------- per frame ---------- */
  PH.tick = function (dt) {
    var p = P(), me = Z.me; if (!p || Z.mode !== "play") { if (PH.isOpen()) PH.close(true); return; } PH.state(p);
    if (Z.intro && Z.intro.on) { if (PH.isOpen()) PH.close(true); me.phoneK = 0; return; }
    if (PH.isOpen()) {
      if (Z.api.overlayOpen() || (Z.bigOpen && Z.bigOpen()) || me.fall || me.punch > 0 || (Z.mini && Z.mini.active && Z.mini.active())) PH.close(true);
      else if (me.veh && Math.abs(me.veh.speed || 0) > 4.5) { PH.close(); toast("Phone away: eyes on the road."); }
    }
    if ((PH._toolsKeep === "phone" && !PH.isOpen()) || (PH._toolsKeep === "pocket" && !(Z.inv && Z.inv.isOpen()))) PH.tools("");
    animTick(dt); pedPhones(dt); snatchRoll(dt); snatchStep(dt); lostTick();
    lastT -= dt; if (lastT <= 0) { lastT = .5; hud(); if (PH.isOpen() && shell) { var bar = shell.querySelector("[data-fp-bar]"); if (bar) bar.innerHTML = statusBar(); place(); var mm = Math.floor(p.time); if (PH.view === "home" && mm !== PH._min) render(); PH._min = mm; } }
  };

  /* ---------- hooks ---------- */
  var oBegin = Z.begin; if (oBegin) Z.begin = function (p) { try { PH.close(true); sn = null; if (Z.me) Z.me.phoneK = 0; PH.state(p); } catch (e) { PH.err = e; } return oBegin.apply(Z, arguments); };
  var oUpd = Z.update; if (oUpd) Z.update = function (dt) { var r = oUpd.apply(Z, arguments); try { if (!built && Z.mode === "play") build(); PH.tick(dt); } catch (e) { if (!PH.uerr) { PH.uerr = e; if (typeof console !== "undefined") console.error(e); } } return r; };
  void TAU;
})();
