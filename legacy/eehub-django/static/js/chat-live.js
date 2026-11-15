/* EE Hub Messages: ONE shared poller per browser (round 7, M15).
 *
 * Every Messages tab joins a BroadcastChannel. One tab is the leader (Web Locks when available,
 * otherwise a localStorage heartbeat). Only the leader talks to the server:
 *   every 4 s while any visible tab has a chat open, 15 s while one shows the list, 60 s when all are hidden;
 *   GET updates.json?v=<user version>&k=<signed key>&t=<thread>:<version>:<last id>:<since>
 * "Nothing new" is answered from the server cache. Results go to every tab over the channel; each tab
 * applies what concerns it (EEChatLive.on("result", fn)). When the leader closes, another tab takes over.
 * Optional live mode (setting messaging.live_mode = sse): the leader holds one EventSource instead and
 * calls updates.json only when the server says something changed.
 */
(function () {
  "use strict";
  var root = document.querySelector("[data-wa]");
  if (!root || window.EEChatLive) return;
  var TAB = Math.random().toString(36).slice(2);
  var cfg = {
    url: root.getAttribute("data-updates-url"), stream: root.getAttribute("data-stream-url"),
    key: root.getAttribute("data-k") || "", uid: root.getAttribute("data-uid"),
    mode: root.getAttribute("data-live-mode") || "poll",
    open: (+root.getAttribute("data-every-open") || 4) * 1000,
    inbox: (+root.getAttribute("data-every-inbox") || 15) * 1000,
    hidden: (+root.getAttribute("data-every-hidden") || 60) * 1000
  };
  var v = +root.getAttribute("data-v") || 0;
  var handlers = [];
  var wants = {};            // tab id -> {threads: {id: state}, visible, chat, at}
  var leader = false;
  var timer = null, busy = false, es = null, lastPoll = 0;
  var bc = ("BroadcastChannel" in window) ? new BroadcastChannel("ee-chat-" + cfg.uid) : null;
  var threadState = null;    // fn() -> {id: {tv, after, since}} for this tab

  function send(msg) { msg.from = TAB; if (bc) bc.postMessage(msg); }
  function myWant() {
    return { threads: threadState ? threadState() : {}, visible: !document.hidden, chat: !!document.querySelector("[data-chat]"), at: Date.now() };
  }
  function announce() { var w = myWant(); wants[TAB] = w; send({ type: "want", want: w }); }

  function emit(data) { handlers.forEach(function (fn) { try { fn(data); } catch (e) { if (window.console) console.error(e); } }); }

  function delay() {
    var now = Date.now(), anyVisible = false, anyChat = false;
    Object.keys(wants).forEach(function (k) {
      var w = wants[k];
      if (now - w.at > 150000) { delete wants[k]; return; }
      if (w.visible) { anyVisible = true; if (w.chat) anyChat = true; }
    });
    if (!anyVisible) return cfg.hidden;
    return anyChat ? cfg.open : cfg.inbox;
  }

  function query() {
    var merged = {};
    Object.keys(wants).forEach(function (k) {
      var ts = wants[k].threads || {};
      Object.keys(ts).forEach(function (id) {
        var s = ts[id], m = merged[id];
        if (!m) merged[id] = { tv: s.tv, after: s.after, since: s.since };
        else { m.tv = Math.min(m.tv, s.tv); m.after = Math.min(m.after, s.after); m.since = Math.min(m.since, s.since); }
      });
    });
    var q = "?v=" + v + (cfg.key ? "&k=" + encodeURIComponent(cfg.key) : "");
    Object.keys(merged).slice(0, 6).forEach(function (id) {
      var s = merged[id];
      q += "&t=" + id + ":" + (s.tv || 0) + ":" + (s.after || 0) + ":" + (s.since || 0);
    });
    return q;
  }

  function poll() {
    if (!leader || busy) return;
    busy = true;
    lastPoll = Date.now();
    wants[TAB] = myWant();
    fetch(cfg.url + query(), { credentials: "same-origin", headers: { "Accept": "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        if (data.v) v = data.v;
        if (data.same) return;
        send({ type: "result", data: data });
        emit(data);
      })
      .catch(function () {})
      .finally(function () { busy = false; schedule(); });
  }

  function schedule() {
    clearTimeout(timer);
    if (!leader) return;
    if (cfg.mode === "sse" && "EventSource" in window) { openStream(); return; }
    timer = setTimeout(poll, delay());
  }

  function openStream() {
    if (es) return;
    es = new EventSource(cfg.stream + query());
    es.addEventListener("changed", function () { es.close(); es = null; poll(); });
    es.onerror = function () { if (es) { es.close(); es = null; } timer = setTimeout(function () { if (cfg.mode === "sse") openStream(); }, 3000); };
  }

  function becomeLeader() {
    if (leader) return;
    leader = true;
    send({ type: "leader" });
    send({ type: "roll" });       // ask every tab for its wants
    poll();
  }

  // --- election: Web Locks (held for the life of the tab) or a localStorage heartbeat ---
  if (navigator.locks && navigator.locks.request) {
    navigator.locks.request("ee-chat-leader-" + cfg.uid, function () {
      becomeLeader();
      return new Promise(function () {});    // never resolves: released when the tab closes
    });
  } else {
    var HB = "ee-chat-hb-" + cfg.uid;
    var beat = function () {
      var raw = null;
      try { raw = JSON.parse(localStorage.getItem(HB) || "null"); } catch (e) { raw = null; }
      var now = Date.now();
      if (!raw || raw.tab === TAB || now - raw.at > 8000) {
        try { localStorage.setItem(HB, JSON.stringify({ tab: TAB, at: now })); } catch (e) {}
        becomeLeader();
      } else if (leader && raw.tab !== TAB) { leader = false; clearTimeout(timer); }
    };
    beat();
    setInterval(beat, 3000);
    window.addEventListener("pagehide", function () {
      try { var raw = JSON.parse(localStorage.getItem(HB) || "null"); if (raw && raw.tab === TAB) localStorage.removeItem(HB); } catch (e) {}
    });
  }
  if (!bc) becomeLeader();     // no channel: every tab for itself (old browsers)

  if (bc) bc.onmessage = function (ev) {
    var m = ev.data || {};
    if (m.from === TAB) return;
    if (m.type === "want") { wants[m.from] = m.want; if (leader && m.want && m.want.visible && Date.now() - lastPoll > 1500 && m.urgent) poll(); }
    else if (m.type === "roll") announce();
    else if (m.type === "result") { if (m.data && m.data.v) v = m.data.v; emit(m.data); }
    else if (m.type === "poke") { if (leader) { if (m.want) wants[m.from] = m.want; poll(); } }
    else if (m.type === "leader") { if (leader && navigator.locks) { /* lock holder is the only leader */ } }
    else if (m.type === "bye") { delete wants[m.from]; }
  };
  window.addEventListener("pagehide", function () { send({ type: "bye" }); });
  document.addEventListener("visibilitychange", function () {
    announce();
    if (leader && !document.hidden && Date.now() - lastPoll > 2000) poll();
    else if (!leader && !document.hidden) send({ type: "poke", want: myWant() });
  });
  setInterval(announce, 30000);

  window.EEChatLive = {
    on: function (fn) { handlers.push(fn); },
    threads: function (fn) { threadState = fn; announce(); },
    /* after sending, editing or reacting: refresh now (the leader does it) */
    poke: function () { announce(); if (leader) poll(); else send({ type: "poke", want: myWant() }); },
    isLeader: function () { return leader; },
    version: function () { return v; }
  };
  announce();
})();
