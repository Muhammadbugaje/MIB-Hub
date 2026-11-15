/* EE Hub Arcade — Wi-Fi play with no internet (Freshers School Life).
   Browsers cannot run a server, so the phones talk to each other directly over WebRTC data channels. One phone hosts;
   up to five friends join it (six players). There is no internet, so there is no server to introduce them either:
   the host's game shows a QR code holding its connection details, the friend scans it with the phone camera (or
   pastes the text), the friend's game shows an answer QR, and the host scans that. After that the game runs as if it
   were using the website's room relay: the host keeps the room (a copy of games/rooms.py) and answers everyone's
   room calls over the data channels, so the game code does not know the difference.

   Works when every phone is on the same local network. Many campus and public Wi-Fi networks stop devices talking
   to each other ("client isolation"); then turn on one phone's hotspot (it needs no data) and join everyone to it. */
(function (root) {
  "use strict";

  /* ---------- compact connection codes (a WebRTC offer or answer in ~150 characters) ---------- */
  var C = {};
  function b64u(bytes) { var s = ""; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return (typeof btoa === "function" ? btoa(s) : Buffer.from(s, "binary").toString("base64")).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function unb64u(t) { t = t.replace(/-/g, "+").replace(/_/g, "/"); while (t.length % 4) t += "="; var s = typeof atob === "function" ? atob(t) : Buffer.from(t, "base64").toString("binary"), out = []; for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i)); return out; }
  var SETUP = { actpass: "x", active: "a", passive: "p" }, SETUP_R = { x: "actpass", a: "active", p: "passive" };
  C.encode = function (sdp, kind) {
    var lines = String(sdp).split(/\r?\n/), ufrag = "", pwd = "", fp = "", setup = "actpass", cands = [];
    lines.forEach(function (l) {
      if (l.indexOf("a=ice-ufrag:") === 0) ufrag = ufrag || l.slice(12).trim();
      else if (l.indexOf("a=ice-pwd:") === 0) pwd = pwd || l.slice(10).trim();
      else if (l.indexOf("a=fingerprint:sha-256 ") === 0) fp = fp || l.slice(22).trim();
      else if (l.indexOf("a=setup:") === 0) setup = l.slice(8).trim();
      else if (l.indexOf("a=candidate:") === 0) {
        var p = l.slice(12).split(" "); // foundation comp proto priority addr port typ type ...
        if (p[1] !== "1" || String(p[2]).toLowerCase() !== "udp" || p[7] !== "host") return;
        var addr = p[4], m = /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})\.local$/i.exec(addr);
        cands.push((m ? "m" + (m[1] + m[2] + m[3] + m[4] + m[5]).toLowerCase() : addr) + "_" + p[5]);
      }
    });
    if (!ufrag || !pwd || !fp) throw new Error("This browser's connection details could not be read.");
    if (!cands.length) throw new Error("No local network address was found. Join a Wi-Fi network or a phone hotspot first.");
    var fpb = fp.split(":").map(function (h) { return parseInt(h, 16); });
    return ["2", kind === "answer" ? "a" : "o", ufrag, pwd, b64u(fpb), SETUP[setup] || "x", cands.slice(0, 4).join(",")].join("~");
  };
  C.decode = function (code) {
    var t = String(code || "").trim().replace(/^.*#[oa]=/, ""); try { t = decodeURIComponent(t); } catch (e) {}
    var f = t.split("~");
    if (f.length < 7 || f[0] !== "2") throw new Error("That is not a Wi-Fi play code.");
    var kind = f[1] === "a" ? "answer" : "offer", fp = unb64u(f[4]).map(function (b) { return (b < 16 ? "0" : "") + b.toString(16).toUpperCase(); }).join(":");
    var sdp = ["v=0", "o=- " + (1e9 + Math.floor(Math.random() * 8e9)) + " 2 IN IP4 127.0.0.1", "s=-", "t=0 0", "a=group:BUNDLE 0", "a=msid-semantic: WMS",
      "m=application 9 UDP/DTLS/SCTP webrtc-datachannel", "c=IN IP4 0.0.0.0"];
    f[6].split(",").forEach(function (c, i) {
      var k = c.lastIndexOf("_"), a = c.slice(0, k), port = c.slice(k + 1);
      if (/^m[0-9a-f]{32}$/.test(a)) a = a.slice(1, 9) + "-" + a.slice(9, 13) + "-" + a.slice(13, 17) + "-" + a.slice(17, 21) + "-" + a.slice(21) + ".local";
      sdp.push("a=candidate:" + (i + 1) + " 1 udp " + (2122260223 - i) + " " + a + " " + port + " typ host generation 0");
    });
    sdp.push("a=end-of-candidates", "a=ice-ufrag:" + f[2], "a=ice-pwd:" + f[3], "a=ice-options:trickle", "a=fingerprint:sha-256 " + fp,
      "a=setup:" + (SETUP_R[f[5]] || "actpass"), "a=mid:0", "a=sctp-port:5000", "a=max-message-size:262144", "");
    return { type: kind, sdp: sdp.join("\r\n") };
  };

  /* ---------- the room, kept by the host (same rules as games/rooms.py) ---------- */
  var VEH = ["", "skate", "bike", "scooter", "okada", "keke", "car", "sport", "plane"], EMO = ["", "wave", "dance", "sit", "spar"];
  function num(v, lo, hi, d) { v = +v; if (!isFinite(v)) return d || 0; return Math.max(lo, Math.min(hi, v)); }
  function cleanState(st) {
    st = st && typeof st === "object" ? st : {};
    var fit = typeof st.f === "string" && st.f.length <= 200 && /^[a-z0-9.,_]*$/.test(st.f) ? st.f : "", ch = String(st.c || "").slice(0, 12);
    return { f: fit, x: Math.round(num(st.x, -3000, 3000) * 10) / 10, y: Math.round(num(st.y, -3000, 3000) * 10) / 10, a: Math.round(num(st.a, -100, 100) * 100) / 100,
      v: VEH.indexOf(st.v) >= 0 ? st.v : "", s: Math.round(num(st.s, -80, 80) * 10) / 10, e: EMO.indexOf(st.e) >= 0 ? st.e : "",
      c: /^[A-Za-z0-9]+$/.test(ch) ? ch : "tunde", o: Math.floor(num(st.o, 0, 9)), l: Math.floor(num(st.l, 1, 150, 1)), z: st.z ? 1 : 0, h: Math.floor(num(st.h, 0, 999)) };
  }
  function cleanEvent(ev, now) {
    if (!ev || typeof ev !== "object") return null; var k = ev.k;
    if (k === "emote" && EMO.indexOf(ev.e) >= 0) return { k: k, e: ev.e };
    if (k === "chat") return { k: k, p: Math.floor(num(ev.p, 0, 9)) };
    if (k === "race") return { k: k, r: Math.floor(num(ev.r, 0, 7)), at: Math.floor(num(ev.at, now, now + 30000, now + 8000)) };
    if (k === "fin") return { k: k, id: String(ev.id || "").slice(0, 24), time: Math.round(num(ev.time, 0, 3600) * 10) / 10 };
    if (k === "hit") return { k: k, to: Math.floor(num(ev.to, 0, 1e9)), d: Math.floor(num(ev.d, 0, 20)) };
    return null;
  }
  function Room() { this.m = {}; this.st = {}; this.ev = []; this.seq = 0; }
  Room.prototype.sync = function (pid, data, nowMs) {
    var now = (nowMs == null ? Date.now() : nowMs) / 1000, nms = Math.floor(now * 1000), self = this, id;
    for (id in this.m) if (now - this.m[id].t >= 8) { delete this.m[id]; delete this.st[id]; }
    if (!this.m[pid] && Object.keys(this.m).length >= 6) throw new Error("That room is full (6 players).");
    var name = String((data && data.name) || "Player").replace(/[^A-Za-z0-9 '\-]/g, "").replace(/\s+/g, " ").trim().slice(0, 16) || "Player";
    this.m[pid] = { n: name, t: now }; this.st[pid] = cleanState(data && data.st);
    (Array.isArray(data && data.ev) ? data.ev.slice(0, 5) : []).forEach(function (raw) { var e = cleanEvent(raw, nms); if (e) { e.i = ++self.seq; e.f = pid; self.ev.push(e); } });
    this.ev = this.ev.slice(-40);
    var since = Math.floor(num(data && data.since, 0, 1e12)); if (since > this.seq) since = 0;
    var players = []; for (id in this.m) if (+id !== +pid && this.st[id]) players.push({ id: +id, n: this.m[id].n, st: this.st[id] });
    return { me: pid, now: nms, players: players, ev: this.ev.filter(function (e) { return e.i > since; }) };
  };

  var L = { codec: C, Room: Room, role: "", active: false, peers: [], room: null, nextId: 2, host: null, pending: {}, n: 0, onchange: null };
  if (typeof module !== "undefined" && module.exports) { module.exports = L; }
  if (typeof window === "undefined" || typeof document === "undefined") return;
  root.ArcadeLan = L;
  var doc = document, RTC = window.RTCPeerConnection;
  L.supported = !!RTC;

  function gather(pc) { // no internet means no trickle: wait for the local addresses, then hand over one code
    return new Promise(function (ok) {
      if (pc.iceGatheringState === "complete") return ok();
      var t = setTimeout(ok, 6000); pc.addEventListener("icegatheringstatechange", function () { if (pc.iceGatheringState === "complete") { clearTimeout(t); ok(); } });
    });
  }
  function newPC() { return new RTC({ iceServers: [] }); }
  function changed() { if (L.onchange) try { L.onchange(); } catch (e) {} }
  function joinGame() { var Z = window.SamaruGame; if (Z && Z.netJoin && !(Z.net && Z.net.on)) { try { Z.netJoin("WIFI"); } catch (e) {} } }

  /* host: one connection per friend */
  L.hostOffer = function () {
    L.role = "host"; L.active = true; L.room = L.room || new Room();
    var pc = newPC(), ch = pc.createDataChannel("room", { ordered: true }), peer = { pc: pc, ch: ch, id: L.nextId++, state: "waiting" };
    L.peers.push(peer);
    ch.onopen = function () { peer.state = "open"; ch.send(JSON.stringify({ hello: peer.id })); joinGame(); changed(); };
    ch.onclose = function () { peer.state = "closed"; changed(); };
    ch.onmessage = function (e) {
      var msg; try { msg = JSON.parse(e.data); } catch (err) { return; }
      if (msg.q == null) return;
      try { ch.send(JSON.stringify({ r: msg.q, ok: L.room.sync(peer.id, msg.b || {}) })); } catch (err) { try { ch.send(JSON.stringify({ r: msg.q, err: err.message })); } catch (e2) {} }
    };
    pc.onconnectionstatechange = function () { if (pc.connectionState === "failed") { peer.state = "failed"; changed(); } };
    return pc.createOffer().then(function (o) { return pc.setLocalDescription(o); }).then(function () { return gather(pc); }).then(function () { peer.code = C.encode(pc.localDescription.sdp, "offer"); return peer; });
  };
  L.hostAccept = function (code) {
    var desc = C.decode(code); if (desc.type !== "answer") throw new Error("That is the host's code. Paste your friend's answer code here.");
    var peer = L.peers.filter(function (p) { return p.state === "waiting"; }).pop(); if (!peer) throw new Error("Make a new invite first.");
    peer.state = "connecting"; changed();
    setTimeout(function () { if (peer.state === "connecting") { peer.state = "failed"; changed(); } }, 15000);
    return peer.pc.setRemoteDescription(desc);
  };

  /* friend: one connection to the host */
  L.join = function (code) {
    var desc = C.decode(code); if (desc.type !== "offer") throw new Error("That is an answer code. Scan or paste the host's code.");
    L.role = "guest"; var pc = newPC(); L.host = { pc: pc, state: "connecting" };
    pc.ondatachannel = function (ev) {
      var ch = L.host.ch = ev.channel;
      ch.onopen = function () { L.host.state = "open"; L.active = true; joinGame(); changed(); };
      ch.onclose = function () { L.host.state = "closed"; L.active = false; changed(); };
      ch.onmessage = function (e) {
        var msg; try { msg = JSON.parse(e.data); } catch (err) { return; }
        if (msg.hello) { L.me = msg.hello; return; }
        var p = L.pending[msg.r]; if (!p) return; delete L.pending[msg.r]; clearTimeout(p.t);
        if (msg.err) p.no(new Error(msg.err)); else p.ok(msg.ok);
      };
    };
    pc.onconnectionstatechange = function () { if (pc.connectionState === "failed") { L.host.state = "failed"; changed(); } };
    setTimeout(function () { if (L.host && L.host.state === "connecting") { L.host.state = "failed"; changed(); } }, 25000);
    return pc.setRemoteDescription(desc).then(function () { return pc.createAnswer(); }).then(function (a) { return pc.setLocalDescription(a); })
      .then(function () { return gather(pc); }).then(function () { L.host.code = C.encode(pc.localDescription.sdp, "answer"); return L.host; });
  };

  /* the game's room calls (POST …/api/room/) go to the host instead of the website while Wi-Fi play is on */
  L.request = function (body) {
    if (L.role === "host") { try { return Promise.resolve(L.room.sync(1, body)); } catch (e) { return Promise.reject(e); } }
    var h = L.host; if (!h || h.state !== "open") return Promise.reject(new Error("Not connected to the host."));
    return new Promise(function (ok, no) { var n = ++L.n; L.pending[n] = { ok: ok, no: no, t: setTimeout(function () { delete L.pending[n]; no(new Error("The host did not answer.")); }, 4000) }; h.ch.send(JSON.stringify({ q: n, b: body })); });
  };
  var realFetch = window.fetch;
  if (realFetch) window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    if (L.active && /\/api\/room\/$/.test(url.split("?")[0]) && init && String(init.method).toUpperCase() === "POST") {
      var body = {}; try { body = JSON.parse(init.body || "{}"); } catch (e) {}
      return L.request(body).then(function (d) { return new Response(JSON.stringify(d), { status: 200, headers: { "Content-Type": "application/json" } }); },
        function (e) { return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { "Content-Type": "application/json" } }); });
    }
    return realFetch.apply(this, arguments);
  };
  L.leave = function () {
    L.peers.forEach(function (p) { try { p.pc.close(); } catch (e) {} }); if (L.host) try { L.host.pc.close(); } catch (e) {}
    L.peers = []; L.host = null; L.room = null; L.active = false; L.role = ""; L.nextId = 2; changed();
  };

  /* ---------- the Wi-Fi play panel ---------- */
  var FAIL = "Could not connect. This Wi-Fi may stop phones talking to each other (common on campus and public Wi-Fi). Turn on one phone's hotspot (it works without data), connect every phone to it, and try again.";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function link(kind, code) { var u = doc.querySelector("[data-gm-lanpage]"); return location.origin + (u ? u.getAttribute("data-gm-lanpage") : "/arcade/lan/") + "#" + (kind === "offer" ? "o" : "a") + "=" + encodeURIComponent(code); }
  function qr(text) {
    if (!window.qrcode) return "";
    try { var q = window.qrcode(0, "L"); q.addData(text); q.make(); return "<img alt='Wi-Fi play QR code' width='240' height='240' style='image-rendering:pixelated;background:#fff;padding:8px;border-radius:12px;max-width:70vw;height:auto' src='" + q.createDataURL(6, 2) + "'>"; } catch (e) { return ""; }
  }
  function css() {
    if (doc.getElementById("gm-lan-css")) return; var s = doc.createElement("style"); s.id = "gm-lan-css";
    s.textContent = ".gm-lan{position:fixed;inset:0;z-index:9998;background:rgba(5,10,20,.72);display:flex;align-items:center;justify-content:center;padding:12px}.gm-lan__card{background:#fff;color:#14213d;border-radius:18px;max-width:520px;width:100%;max-height:92vh;overflow:auto;padding:18px 18px 22px;font:15px/1.45 system-ui,sans-serif}" +
      ".gm-lan__card h2{margin:0 0 6px;font-size:1.2rem}.gm-lan__card p{margin:8px 0}.gm-lan__card textarea{width:100%;min-height:72px;font:12px/1.35 ui-monospace,Menlo,monospace;border:1px solid #d6dbe6;border-radius:10px;padding:8px}" +
      ".gm-lan__row{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.gm-lan__row button{font:inherit;font-weight:700;min-height:44px;padding:10px 14px;border-radius:12px;border:1px solid #d6dbe6;background:#f4f6fb;cursor:pointer}.gm-lan__row button.go{background:#f59e0b;border-color:#f59e0b;color:#1b1300}" +
      ".gm-lan__qr{text-align:center}.gm-lan__bad{color:#b91c1c;font-weight:600}.gm-lan__ok{color:#15803d;font-weight:700}.gm-lan video{width:100%;border-radius:12px;background:#000}@media (prefers-color-scheme:dark){.gm-lan__card{background:#171e2d;color:#eef2f8}.gm-lan__row button{background:#222b3d;color:#eef2f8;border-color:#334}.gm-lan__card textarea{background:#0f1420;color:#eef2f8;border-color:#334}}";
    doc.head.appendChild(s);
  }
  var box, view = "home", note = "";
  function show(v, n) { view = v || view; note = n || ""; render(); }
  function render() {
    if (!box) return;
    var h = "<h2>Wi-Fi play (no internet)</h2>";
    if (!L.supported) h += "<p class='gm-lan__bad'>This browser cannot connect phones directly. Use a recent Chrome, Safari or Firefox.</p>";
    else if (view === "home") {
      h += "<p>Play with up to 5 friends on the same Wi-Fi, or on one phone's hotspot (no data needed). One phone hosts; everyone else joins it.</p>" +
        "<div class='gm-lan__row'><button class='go' data-l='host'>Host a game</button><button data-l='join'>Join a friend</button></div>";
    } else if (view === "host") {
      var open = L.peers.filter(function (p) { return p.state === "open"; }).length, wait = L.peers.filter(function (p) { return p.state === "waiting" || p.state === "connecting"; }).pop();
      h += "<p><b>" + (open + 1) + " of 6</b> players in your game." + (L.peers.some(function (p) { return p.state === "failed"; }) ? " <span class='gm-lan__bad'>" + esc(FAIL) + "</span>" : "") + "</p>";
      if (wait && wait.code && wait.state === "waiting") {
        h += "<p><b>1.</b> Your friend scans this with their phone camera (or you send them the code):</p><div class='gm-lan__qr'>" + qr(link("offer", wait.code)) + "</div>" +
          "<textarea readonly aria-label='Invite code'>" + esc(wait.code) + "</textarea>" +
          "<p><b>2.</b> Their phone shows an answer code. Scan it with <b>this</b> phone's camera, or paste it here:</p><textarea data-l-in aria-label='Answer code' placeholder='Paste the answer code'></textarea>" +
          "<div class='gm-lan__row'><button class='go' data-l='accept'>Connect</button>" + (window.BarcodeDetector ? "<button data-l='scan'>Scan answer here</button>" : "") + "<button data-l='copy'>Copy invite</button></div>";
      } else if (wait && wait.state === "connecting") h += "<p>Connecting…</p>";
      else if (open + 1 < 6) h += "<div class='gm-lan__row'><button class='go' data-l='invite'>" + (open ? "Invite another friend" : "Invite a friend") + "</button></div>";
      h += "<div class='gm-lan__row'><button data-l='close'>Back to the game</button><button data-l='leave'>Stop Wi-Fi play</button></div>";
    } else if (view === "join") {
      var hs = L.host;
      if (hs && hs.state === "open") h += "<p class='gm-lan__ok'>Connected to the host. You are in the game.</p><div class='gm-lan__row'><button class='go' data-l='close'>Play</button><button data-l='leave'>Leave</button></div>";
      else if (hs && hs.code && hs.state !== "failed") h += "<p>Show this to the host to scan with their phone camera, or send them the code:</p><div class='gm-lan__qr'>" + qr(link("answer", hs.code)) + "</div><textarea readonly aria-label='Answer code'>" + esc(hs.code) + "</textarea><div class='gm-lan__row'><button data-l='copyA'>Copy answer</button></div><p>Waiting for the host…</p>";
      else h += (hs && hs.state === "failed" ? "<p class='gm-lan__bad'>" + esc(FAIL) + "</p>" : "") + "<p>Scan the host's QR code with your phone camera, or paste the host's invite code:</p><textarea data-l-in aria-label='Invite code' placeholder='Paste the invite code'></textarea>" +
        "<div class='gm-lan__row'><button class='go' data-l='dojoin'>Join</button>" + (window.BarcodeDetector ? "<button data-l='scan'>Scan here</button>" : "") + "<button data-l='close'>Cancel</button></div>";
    }
    if (note) h += "<p class='gm-lan__bad'>" + esc(note) + "</p>";
    h += "<div data-l-cam></div>";
    box.querySelector(".gm-lan__card").innerHTML = h;
  }
  function copy(t) { try { navigator.clipboard.writeText(t); } catch (e) {} }
  function scan(done) {
    var host = box.querySelector("[data-l-cam]"), det = new window.BarcodeDetector({ formats: ["qr_code"] }), stop = false, stream;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(function (s) {
      stream = s; host.innerHTML = "<video playsinline muted></video>"; var v = host.querySelector("video"); v.srcObject = s; v.play();
      (function tick() { if (stop) return; det.detect(v).then(function (r) { if (r && r[0]) { stop = true; s.getTracks().forEach(function (t) { t.stop(); }); host.innerHTML = ""; done(r[0].rawValue); } else setTimeout(tick, 250); }, function () { setTimeout(tick, 400); }); })();
    }).catch(function () { show(null, "The camera is not available. Use the phone's camera app, or paste the code."); });
  }
  function open() {
    css(); if (!box) { box = doc.createElement("div"); box.className = "gm-lan"; box.innerHTML = "<div class='gm-lan__card' role='dialog' aria-modal='true' aria-label='Wi-Fi play'></div>"; doc.body.appendChild(box);
      box.addEventListener("click", function (e) {
        if (e.target === box) return close(); var b = e.target.closest("[data-l]"); if (!b) return; var a = b.getAttribute("data-l"), inp = box.querySelector("[data-l-in]");
        try {
          if (a === "host") { show("host"); if (!L.peers.length) L.hostOffer().then(function () { render(); }, function (err) { show("host", err.message); }); }
          else if (a === "invite") L.hostOffer().then(function () { render(); }, function (err) { show("host", err.message); });
          else if (a === "accept") L.hostAccept(inp ? inp.value : "").then(function () { render(); }, function (err) { show("host", err.message); });
          else if (a === "join") show("join");
          else if (a === "dojoin") L.join(inp ? inp.value : "").then(function () { render(); }, function (err) { show("join", err.message); });
          else if (a === "scan") scan(function (t) { if (view === "host") L.hostAccept(t).then(render, function (err) { show("host", err.message); }); else L.join(t).then(render, function (err) { show("join", err.message); }); });
          else if (a === "copy") { var w = L.peers.filter(function (p) { return p.state === "waiting"; }).pop(); if (w) copy(link("offer", w.code)); show(null, ""); }
          else if (a === "copyA") { if (L.host) copy(link("answer", L.host.code)); }
          else if (a === "leave") { L.leave(); show("home"); }
          else if (a === "close") close();
        } catch (err) { show(null, err.message); }
      }); }
    box.hidden = false; if (L.role === "host") view = "host"; else if (L.role === "guest") view = "join"; render();
  }
  function close() { if (box) box.hidden = true; }
  L.open = open; L.onchange = function () { if (box && !box.hidden) render(); };

  /* codes arriving from the camera: the QR opens /arcade/lan/ in a new tab, which passes the code here */
  try {
    var bc = new BroadcastChannel("ee-arcade-lan");
    bc.onmessage = function (e) {
      var d = e.data || {}; if (!d.code) return; bc.postMessage({ t: "ack" });
      open();
      if (d.t === "answer" && L.role === "host") L.hostAccept(d.code).then(render, function (err) { show("host", err.message); });
      else if (d.t === "offer" && L.role !== "host") { view = "join"; L.join(d.code).then(render, function (err) { show("join", err.message); }); }
    };
  } catch (e) {}
  doc.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("[data-gm-lan]")) open(); });
})(typeof window !== "undefined" ? window : this);
