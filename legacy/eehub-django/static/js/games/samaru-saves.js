/* Freshers School Life — save slots: five manual slots, one automatic slot (written when you sleep at your hostel) and the
   "Last played" save the game already keeps (api.store "fslg-save", written every 15 s and at every mission end).
   Every slot holds the whole player object plus a small card: a 160×90 JPEG snapshot, the mission, year, day, in-game time,
   money, level, play time and the real date. Loading always goes through Z.upgrade (saveVersion migrations, samaru-core.js),
   so a slot written by an older build loads like an old "Continue" save; a slot from a newer build is refused, untouched.

   Storage: localStorage, one key per slot ("ee-arcade-fslg-slot:<user>:<slot>"), per user on this device (the play page's
   data-gm-user). Every access is in try/catch. When storage is full the slot is written without its picture; if that also
   fails, nothing is overwritten and the player is told. Without localStorage (private browsing, headless tests) slots live
   in memory for this tab and the screen says so. Slots are not sent to the server: /arcade/api/sync/ only carries results.

   Saving is refused during the opening film, a moment, a conversation, a step with hud: false (a cutscene beat), races,
   jobs, dates, chases and flights, and inside a mission except between steps (no progress counted in the current step and
   no running clock). Entry points: Z.saves.open(back) from the title screen, the phone ("Saves") and the pause dialog.
   Nothing runs at load time except attaching Z.saves and wrapping Z.sleep and Z.update, so it also runs headless. */
(function () {
  "use strict";
  var Z = window.SamaruGame, S = window.SamaruSim;
  if (!Z || !S) return;
  var SV = Z.saves = { N: 5, FORMAT: 1, mem: {}, persistent: null, back: null };
  SV.IDS = ["auto", "1", "2", "3", "4", "5"];
  var MOVING = { tail: 1, chase: 1, escort: 1, convoy: 1, walk: 1, delivery: 1, carry: 1, care: 1, stealth: 1, defend: 1, flight: 1, routine: 1, race: 1, keep: 1 };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function user() { try { var st = document.querySelector("[data-gm-stage]"), u = st && st.getAttribute && st.getAttribute("data-gm-user"); u = String(u || "").replace(/[^\w-]/g, "").slice(0, 40); return u || "guest"; } catch (e) { return "guest"; } }
  SV.key = function (id) { return "ee-arcade-fslg-slot:" + user() + ":" + id; };
  function store() { try { var s = window.localStorage; if (!s) return null; s.setItem("ee-arcade-fslg-probe", "1"); s.removeItem("ee-arcade-fslg-probe"); return s; } catch (e) { return null; } }
  SV.read = function (id) {
    if (id === "last") { var p = null; try { p = Z.api && Z.api.store("fslg-save"); } catch (e) {} return p ? { id: "last", at: 0, meta: SV.meta(p), thumb: "", data: p, last: true } : null; }
    var s = store(), k = SV.key(id); SV.persistent = !!s;
    try { var raw = s ? s.getItem(k) : SV.mem[k]; var r = raw ? JSON.parse(raw) : null; return r && r.data ? r : null; } catch (e) { return null; }
  };
  function write(id, rec) {
    var s = store(), k = SV.key(id), txt; SV.persistent = !!s;
    try { txt = JSON.stringify(rec); } catch (e) { return { ok: false, why: "This game could not be written down (" + e.message + ")." }; }
    if (!s) { SV.mem[k] = txt; return { ok: true, memory: true }; }
    try { s.setItem(k, txt); return { ok: true }; } catch (e) {
      if (rec.thumb) { rec.thumb = ""; try { s.setItem(k, JSON.stringify(rec)); return { ok: true, noThumb: true }; } catch (e2) {} }
      return { ok: false, why: "There is no room left to save on this device. Delete a slot, or free some browser storage, and try again." };
    }
  }
  SV.remove = function (id) { var s = store(), k = SV.key(id); try { if (s) s.removeItem(k); delete SV.mem[k]; return true; } catch (e) { return false; } };

  /* ---------- what a slot card shows ---------- */
  SV.meta = function (P) {
    var D = window.SamaruData || {}, m = null, id = P.m && P.m.active;
    (D.MISSIONS || []).forEach(function (q) { if (q.id === id) m = q; });
    if (!m && P.m) { var done = P.m.done || {}; (D.MISSIONS || []).some(function (q) { if (!q.side && !done[q.id]) { m = q; return true; } return false; }); }
    var c = S.clock ? S.clock(P) : "";
    return { mission: m ? m.title : "Free roam", num: m && /^m\d+$/.test(m.id) ? +m.id.slice(1) : 0, active: !!id, step: P.m ? P.m.step + 1 : 0, year: (m && m.year) || 1,
      day: P.day || 1, time: c, money: Math.round(P.money || 0), lvl: P.lvl || 1, play: Math.round(P.playS || 0), name: P.name || "", saveVersion: P.saveVersion || 0 };
  };
  function money(n) { return "₦" + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function played(s) { var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? h + " h " + (m < 10 ? "0" : "") + m + " min" : m + " min"; }
  function when(at) { if (!at) return ""; try { return new Date(at).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (e) { return new Date(at).toISOString().slice(0, 16).replace("T", " "); } }

  /* ---------- the snapshot: the frame on screen, shrunk to 160×90 ---------- */
  SV.thumb = function () {
    try {
      if (typeof document === "undefined" || !document.createElement) return "";
      var stage = document.querySelector("[data-gm-stage]"), list = stage && stage.querySelectorAll ? stage.querySelectorAll("canvas") : [], c = document.createElement("canvas");
      c.width = 160; c.height = 90; var x = c.getContext && c.getContext("2d"); if (!x || !c.toDataURL || !list.length) return "";
      if (Z.r3 && Z.r3.ready && Z.r3.render) { try { Z.r3.render(Z.api ? Z.api.t : 0); } catch (e) {} } // a WebGL frame is only readable right after it is drawn
      x.fillStyle = "#0b1220"; x.fillRect(0, 0, 160, 90);
      Array.prototype.forEach.call(list, function (cv) { var w = cv.width, h = cv.height; if (!w || !h || cv.offsetParent === null) return; var k = Math.max(160 / w, 90 / h), dw = w * k, dh = h * k; try { x.drawImage(cv, (160 - dw) / 2, (90 - dh) / 2, dw, dh); } catch (e) {} });
      var url = c.toDataURL("image/jpeg", .6); return url && url.length < 24000 ? url : "";
    } catch (e) { return ""; }
  };

  /* ---------- when saving is allowed ---------- */
  SV.canSave = function () {
    var P = Z.P, me = Z.me, no = function (why) { return { ok: false, why: why }; };
    if (!P || Z.mode !== "play") return no("Start or continue a game first.");
    if (Z.intro && Z.intro.on) return no("You can't save while the opening film is playing.");
    if (Z.hideHud) return no("You can't save during a cutscene.");
    if (Z.momentBusy && Z.momentBusy()) return no("Wait for the moment on screen to finish.");
    if (Z.story && Z.story.busy && Z.story.busy()) return no("Wait for the conversation to finish.");
    if (Z.race || (Z.water && Z.water.cur && /run|count/.test(Z.water.cur.state))) return no("Finish the race first.");
    if (P.job) return no("Finish or drop your job first.");
    if (Z.date && Z.date.spot) return no("Finish your date first.");
    if (me && me.veh && me.alt > .05) return no("Land first.");
    if (P.sec && /chase|search/.test(P.sec.state || "")) return no("Lose security first.");
    if (P.m && P.m.active) { var st = Z.step && Z.step(); if ((P.m.n || 0) > 0 || (st && (st.limit || MOVING[st.t]))) return no("In a mission you can save between steps. Finish this step first: " + (Z.objText && st ? Z.objText(st) : st ? st.text : "")); }
    var sd = Z.story && Z.story.state ? Z.story.state(P).side : null; if (sd && (sd.n || 0) > 0) return no("Finish this step of your side job first.");
    return { ok: true };
  };

  SV.save = function (id, opt) {
    opt = opt || {}; var can = SV.canSave(); if (!can.ok) return can;
    if (SV.IDS.indexOf(String(id)) < 0) return { ok: false, why: "No such slot." };
    var P = Z.P; try { if (Z.save) Z.save(); } catch (e) {} // also refreshes "Last played" and the position
    var data; try { data = JSON.parse(JSON.stringify(P)); } catch (e) { return { ok: false, why: "This game could not be copied." }; }
    data.saveVersion = Z.SAVE_VERSION || 1;
    var rec = { f: SV.FORMAT, id: String(id), at: Date.now(), meta: SV.meta(data), thumb: opt.thumb === false ? "" : SV.thumb(), data: data };
    var r = write(String(id), rec); r.id = String(id); return r;
  };
  SV.load = function (id) {
    var rec = SV.read(String(id)); if (!rec) return { ok: false, why: "That slot is empty." };
    var copy; try { copy = JSON.parse(JSON.stringify(rec.data)); } catch (e) { return { ok: false, why: "That save is damaged." }; }
    var p = Z.upgrade ? Z.upgrade(copy) : copy; if (!p) return { ok: false, why: Z.loadError || "That save could not be read." };
    if (Z.api && Z.api.overlayOpen && Z.api.overlayOpen()) Z.api.hide();
    Z.begin(p, false); try { if (Z.save) Z.save(); } catch (e) {}
    return { ok: true, id: String(id) };
  };
  SV.list = function () { return ["last"].concat(SV.IDS).map(function (id) { return { id: id, rec: SV.read(id) }; }); };

  // autosave: whenever you sleep at your own hostel
  if (Z.sleep && !Z.sleep._saves) { var oSleep = Z.sleep; Z.sleep = function () {
    var r = oSleep.apply(this, arguments);
    try { var P = Z.P, h = P && Z.place(P.home); if (h && Math.hypot(P.x - h.mx, P.y - h.my) < 60) { var res = SV.save("auto"); SV.lastAuto = res; if (res.ok) Z.toast("Autosaved."); } } catch (e) { SV.lastAuto = { ok: false, why: String(e) }; }
    return r; }; Z.sleep._saves = 1; }
  // play time, counted only while you are in the world
  if (Z.update && !Z.update._saves) { var oUp = Z.update; Z.update = function (dt) { var P = Z.P; if (P && Z.mode === "play" && dt > 0 && dt < 1) P.playS = (P.playS || 0) + dt; return oUp.apply(this, arguments); }; Z.update._saves = 1; }

  /* ---------- the slot screen ---------- */
  var CSS = "<style>.fs-list{display:grid;gap:10px;width:100%;max-width:760px;min-width:0;margin:0 auto;text-align:left}" +
    ".fs-slot{display:grid;grid-template-columns:128px minmax(0,1fr);min-width:0;gap:10px 14px;align-items:center;padding:10px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14)}" +
    ".fs-thumb{width:128px;height:72px;border-radius:9px;overflow:hidden;background:#0b1220 linear-gradient(135deg,#13233b,#0b1220);display:grid;place-items:center;color:rgba(255,255,255,.55);font-size:12px}" +
    ".fs-thumb img{width:100%;height:100%;object-fit:cover;display:block}.fs-info{min-width:0;line-height:1.35}.fs-info b{display:block;font-size:15px;overflow-wrap:anywhere}" +
    ".fs-info small{display:block;font-size:13px;opacity:.85}.fs-slot .gm-actions{grid-column:1/-1;justify-content:flex-start;margin:0;gap:8px}.fs-slot .gm-btn{min-height:44px;padding:8px 16px}" +
    ".fs-note{max-width:760px;margin:0 auto 10px;font-size:14px;padding:8px 12px;border-radius:10px;background:rgba(250,204,21,.14);border:1px solid rgba(250,204,21,.4)}" +
    "@media (min-width:700px){.fs-slot{grid-template-columns:128px minmax(0,1fr) auto}.fs-slot .gm-actions{grid-column:auto;flex-wrap:nowrap;justify-content:flex-end}}" +
    "@media (max-width:420px){.fs-slot{grid-template-columns:96px minmax(0,1fr);padding:8px}.fs-thumb{width:96px;height:54px}.fs-info b{font-size:14px}}</style>";
  function label(id) { return id === "last" ? "Last played" : id === "auto" ? "Autosave" : "Slot " + id; }
  function card(id, rec, can, inGame) {
    var m = rec && rec.meta, thumb = rec && rec.thumb ? "<img src='" + esc(rec.thumb) + "' alt=''>" : (rec ? "No picture" : "Empty"), btn = [];
    if (rec) btn.push("<button class='gm-btn" + (inGame ? "" : " gm-btn--go") + "' data-act='load:" + id + "'>Load</button>");
    if (/^\d$/.test(id) && inGame) btn.push(rec ? "<button class='gm-btn' data-act='over:" + id + "'" + (can.ok ? "" : " disabled aria-disabled='true' style='opacity:.45'") + ">Overwrite</button>" : "<button class='gm-btn gm-btn--go' data-act='save:" + id + "'" + (can.ok ? "" : " disabled aria-disabled='true' style='opacity:.45'") + ">Save here</button>");
    if (rec && id !== "last") btn.push("<button class='gm-btn' data-act='del:" + id + "'>Delete</button>");
    var lines = rec ? "<b>" + esc(label(id)) + " · " + (m.num ? "Mission " + m.num + ": " : "") + esc(m.mission) + "</b>" +
      "<small>" + esc((m.name ? m.name + " · " : "") + "Year " + m.year + " · Day " + m.day + " · " + m.time) + "</small>" +
      "<small>" + esc(money(m.money) + " · Level " + m.lvl + " · " + played(m.play) + " played") + "</small>" +
      "<small>" + (rec.at ? "Saved " + esc(when(rec.at)) : "Saved as you play") + "</small>"
      : "<b>" + esc(label(id)) + "</b><small>" + (id === "auto" ? "Written when you sleep at your hostel." : "Empty.") + "</small>";
    return "<div class='fs-slot' role='group' aria-label='" + esc(label(id)) + "'><div class='fs-thumb' aria-hidden='true'>" + thumb + "</div><div class='fs-info'>" + lines + "</div>" + (btn.length ? "<div class='gm-actions'>" + btn.join("") + "</div>" : "") + "</div>";
  }
  SV.html = function (msg) {
    var inGame = !!(Z.P && Z.mode === "play"), can = inGame ? SV.canSave() : { ok: false, why: "" }, list = SV.list(), notes = [];
    if (msg) notes.push(msg);
    if (inGame && !can.ok) notes.push(can.why);
    if (SV.persistent === false) notes.push("This browser is not keeping saves (private browsing?). Slots last until you close this tab.");
    return CSS + "<h2>Saves</h2>" + notes.map(function (n) { return "<p class='fs-note' role='status'>" + esc(n) + "</p>"; }).join("") +
      "<div class='fs-list'>" + list.filter(function (s) { return s.id !== "last" || s.rec; }).map(function (s) { return card(s.id, s.rec, can, inGame); }).join("") + "</div>" +
      "<div class='gm-actions'><button class='gm-btn' data-act='back'>Back</button></div>";
  };
  function confirm(title, text, yes, onYes) {
    Z.api.show(CSS + "<h2>" + esc(title) + "</h2><p>" + esc(text) + "</p><div class='gm-actions'><button class='gm-btn gm-btn--go' data-act='yes'>" + esc(yes) + "</button><button class='gm-btn' data-act='no'>Cancel</button></div>",
      function (a) { if (a === "yes") onYes(); else render(); });
  }
  function render(msg) {
    Z.api.show(SV.html(msg), function (a) {
      var p = String(a).split(":"), act = p[0], id = p[1], inGame = !!(Z.P && Z.mode === "play");
      if (act === "back") { SV.close(); return; }
      if (act === "save") { var r = SV.save(id); render(r.ok ? "Saved to " + label(id) + "." + (r.noThumb ? " (Storage is nearly full, so without a picture.)" : "") : r.why); return; }
      if (act === "over") { confirm("Overwrite " + label(id) + "?", "The game saved there will be replaced by this one.", "Overwrite", function () { var r = SV.save(id); render(r.ok ? "Saved to " + label(id) + "." : r.why); }); return; }
      if (act === "del") { confirm("Delete " + label(id) + "?", "This save will be gone for good.", "Delete", function () { SV.remove(id); render(label(id) + " deleted."); }); return; }
      if (act === "load") { var go = function () { var r = SV.load(id); if (!r.ok) render(r.why); else if (Z.toast) Z.toast("Loaded " + label(id) + "."); };
        if (inGame) confirm("Load " + label(id) + "?", "Anything since your last save in this game will be lost.", "Load", go); else go(); }
    });
  }
  SV.open = function (back) { SV.back = back || null; SV.read("1"); render(); return true; };
  SV.close = function () { var b = SV.back; SV.back = null; if (Z.api && Z.api.hide) Z.api.hide(); if (b) b(); };
})();
