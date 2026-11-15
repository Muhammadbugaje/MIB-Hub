// Node checks for static/js/games/arcade-lan.js: connection codes survive the round trip and stay short enough for a
// QR code, and the host's room behaves like games/rooms.py. Prints one JSON line.
const path = require("path");
const L = require(path.join(__dirname, "..", "..", "static", "js", "games", "arcade-lan.js"));
const out = { ok: true };
try {
  const chromeOffer = [
    "v=0", "o=- 4611731400430051336 2 IN IP4 127.0.0.1", "s=-", "t=0 0", "a=group:BUNDLE 0", "a=extmap-allow-mixed", "a=msid-semantic: WMS",
    "m=application 9 UDP/DTLS/SCTP webrtc-datachannel", "c=IN IP4 0.0.0.0",
    "a=candidate:2779223711 1 udp 2113937151 3f2b7c1e-9a4d-4b8e-a6c2-1d0e5f7a9b3c.local 54400 typ host generation 0 network-cost 999",
    "a=candidate:1234 1 udp 2113939711 192.168.43.17 61122 typ host generation 0 network-cost 999",
    "a=candidate:999 1 tcp 1518280447 192.168.43.17 9 typ host tcptype active generation 0",
    "a=ice-ufrag:Xb3Q", "a=ice-pwd:4Fh8T2kLmN9pQrStUvWxYz01", "a=ice-options:trickle",
    "a=fingerprint:sha-256 6B:8B:5D:EA:59:04:20:23:29:C8:87:1C:CD:87:32:BE:DD:8C:66:A5:8E:50:55:EA:8C:D3:B6:5C:09:5C:6F:A5",
    "a=setup:actpass", "a=mid:0", "a=sctp-port:5000", "a=max-message-size:262144", ""].join("\r\n");
  const code = L.codec.encode(chromeOffer, "offer");
  const back = L.codec.decode(code);
  const again = L.codec.encode(back.sdp, "offer");
  const url = "https://example.edu/arcade/lan/#o=" + encodeURIComponent(code);
  out.code = code; out.len = code.length; out.urlLen = url.length;
  out.roundTrip = again === code;
  out.fromUrl = L.codec.encode(L.codec.decode(url).sdp, "offer") === code;
  out.keeps = ["a=ice-ufrag:Xb3Q", "a=ice-pwd:4Fh8T2kLmN9pQrStUvWxYz01", "6B:8B:5D:EA", "3f2b7c1e-9a4d-4b8e-a6c2-1d0e5f7a9b3c.local 54400", "192.168.43.17 61122", "a=setup:actpass"].every(s => back.sdp.includes(s));
  out.noTcp = !back.sdp.includes("tcptype");
  out.type = back.type;
  const ans = L.codec.decode(L.codec.encode(chromeOffer.replace("a=setup:actpass", "a=setup:active"), "answer"));
  out.answer = ans.type === "answer" && ans.sdp.includes("a=setup:active");
  try { L.codec.decode("hello"); out.badRejected = false; } catch (e) { out.badRejected = true; }
  // the room
  const R = new L.Room(), t0 = 1_700_000_000_000;
  const a = R.sync(1, { name: "Host", st: { x: 1, y: 2, v: "bike", c: "tunde" } }, t0);
  const b = R.sync(2, { name: "Ada <b>", st: { x: 9e9, y: 3, v: "rocket" }, ev: [{ k: "chat", p: 3 }, { k: "evil" }] }, t0 + 100);
  const c = R.sync(1, { name: "Host", st: { x: 1, y: 2 }, since: 0 }, t0 + 200);
  out.room = { firstAlone: a.players.length === 0, seesOther: c.players.length === 1 && c.players[0].n === "Ada b", clamped: c.players[0].st.x === 3000 && c.players[0].st.v === "",
    events: c.ev.length === 1 && c.ev[0].k === "chat" && c.ev[0].f === 2 };
  for (let i = 3; i <= 6; i++) R.sync(i, { name: "P" + i, st: {} }, t0 + 300);
  try { R.sync(7, { name: "Seven", st: {} }, t0 + 400); out.room.fullRejected = false; } catch (e) { out.room.fullRejected = /full/.test(e.message); }
  const later = R.sync(1, { name: "Host", st: {} }, t0 + 9000);
  out.room.staleDropped = later.players.length === 0;
} catch (e) { out.ok = false; out.error = String(e && e.stack || e); }
console.log(JSON.stringify(out));
