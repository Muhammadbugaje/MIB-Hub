/* Trailer capture helpers: loaded only by the frozen capture page, never by the site. */
var Z, S, D, PI = Math.PI, H2 = Math.PI / 2;
function boot() { Z = SamaruGame; S = SamaruSim; D = EEArcadeDebug; var p = S.newPlayer((window.SamaruData && SamaruData.HERO) ? SamaruData.HERO.id : 'musa', 'M.I.'); p.home = 'ribadu'; Z.api.hide(); Z.begin(p, true); Z.P.lvl = 150; Z.P.money = 9e6; if (Z.r3.setQuality) Z.r3.setQuality('high'); if (Z.guide && Z.guide.skip) Z.guide.skip(); window.LOG = []; var ex = Z.exit; Z.exit = function (f) { LOG.push('exit f=' + f + ' hp=' + Z.P.hp + ' ' + (new Error().stack || '').split('\n').slice(1, 4).join(' | ')); return ex.apply(this, arguments); }; window.OUT = document.createElement('canvas'); OUT.width = 1920; OUT.height = 1080; return 1; }
function keys(list) { ['up','down','left','right','run','jump','attack','kick','block','emote1','emote2','horn','map'].forEach(function (k) { if (list.indexOf(k) >= 0) D.press(k); else D.release(k); }); }
function expo(v) { if (Z.r3.renderer) Z.r3.renderer.toneMappingExposure = v; }
function fresh(time) { keys([]); try { if (Z.mini && Z.mini.active()) Z.mini.close(); } catch (e) {} try { if (Z.bigmap && Z.bigmap.isOpen) Z.bigmap.close(); } catch (e) {} try { Z.api.hide(); } catch (e) {} try { document.querySelectorAll('.gm-stage canvas').forEach(function (c) { c.style.visibility = ''; }); } catch (e) {} try { if (Z.P.job && Z.jobs && Z.jobs.cancel) Z.jobs.cancel(true); } catch (e) {} try { if (Z.interior && Z.interior.cur) Z.interior.leaveNow(); } catch (e) {} if (Z.me.veh) Z.exit(true); Z.me.alt = 0; try { Z.callOff(); } catch (e) {} try { Z.momentClear(); } catch (e) {} Z.foes.length = 0; if (time != null) Z.P.time = time * 60; Z.P.energy = 100; Z.P.hunger = 0; Z.P.hp = Z.P.maxHp || 100; Z.P.god = false; Z.P.money = 9e6; expo(1.08); }
function cam(yaw, pitch, zoom) { Z.r3.yaw = yaw; if (pitch != null) Z.r3.pitch = pitch; if (zoom != null) Z.r3.zoom = zoom; Z.r3.manual = 9999; }
function settle(n) { for (var i = 0; i < n; i++) { D.step(4); D.paint(); } }
function put(x, y, a, time) { fresh(time); Z.me.x = x; Z.me.y = y; Z.me.a = a; cam(a, .2, 1); settle(40); return Math.round(Z.me.x) + ',' + Math.round(Z.me.y); }
function putp(id, ang, back, time) { var p = Z.places[id]; return put(p.mx - Math.cos(ang) * back, p.my - Math.sin(ang) * back, ang, time); }
function ride(type) { var c = null; Z.cars.forEach(function (v) { if (v.type === type && !c && v !== Z.me.veh) c = v; }); if (!c) return 'no ' + type; c.x = Z.me.x; c.y = Z.me.y; c.a = Z.me.a; c.free = true; c.vx = c.vy = 0; Z.enter(c); return Z.me.veh ? type : 'refused ' + type; }
function hd() { return Z.me.veh ? Z.me.veh.a : Z.me.a; }
function lerp(a, b, k) { return a + (b - a) * k; }
var PRE = null, POST = null, HUD = false, SUB = 4, NO3D = false;
function shot(pre, post, hud, sub, no3d) { NO3D = !!no3d; PRE = pre ? new Function('i', 'n', 'k', pre) : null; POST = post ? new Function('i', 'n', 'k', post) : null; HUD = !!hud; SUB = sub || 4; return 1; }
function adv(i, n) { var k = n > 1 ? i / (n - 1) : 0; if (PRE) PRE(i, n, k); D.step(SUB); if (POST) POST(i, n, k); D.paint(); return 1; }
function frame(i, n) { adv(i, n); var cs = document.querySelectorAll('.gm-stage canvas'), x = OUT.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 1920, 1080);
  for (var j = 0; j < cs.length; j++) { var c = cs[j]; if (c.hasAttribute('data-gm-canvas') || NO3D) continue; x.drawImage(c, 0, 0, 1920, 1080); }
  if (HUD) x.drawImage(document.querySelector('[data-gm-canvas]'), 0, 0, 1920, 1080); return OUT.toDataURL('image/jpeg', .9); }

/* v3 helpers */
function roll(n, k) { keys(k || ['up']); for (var i = 0; i < n; i++) D.step(4); }
function pals() { var c = 0; Z.npcs.forEach(function (n) { if (c >= 2 || n.hidden) return; n.x = Z.me.x + (c ? 1.6 : -1.6); n.y = Z.me.y - 1.2; n.lx = n.x; n.ly = n.y; try { Z.friends.follow(n, 99999); } catch (e) {} n.follow = true; c++; }); return c; }
function solo() { Z.npcs.forEach(function (n) { n.follow = false; n.lead = null; }); }
function inside(ids, time) { solo(); ids = [].concat(ids); for (var j = 0; j < ids.length; j++) { var pl = Z.places[ids[j]]; if (!pl) continue; put(pl.mx, pl.my, H2, time == null ? 11 : time); if (ids[j] !== Z.P.home && pl.role === 'home') Z.P.home = ids[j]; if (!Z.interior.typeOf(pl)) continue; Z.interior.enter(pl); for (var i = 0; i < 90 && !Z.interior.cur; i++) D.step(4); if (Z.interior.cur) { settle(20); Z.r3.manual = 9999; return ids[j] + ':' + Z.interior.cur.type; } } return 'no room'; }
function rival() { for (var i = 0; i < 200 && !Z.peds.length; i++) D.step(4); var p = Z.peds[0]; if (!p) return 'no ped'; p.x = Z.me.x; p.y = Z.me.y + 1.5; p.lx = p.x; p.ly = p.y; p.a = -H2; Z.brawl.mood(p); p.mood = 2; p.maxHp = p.hp = 10; window.RV = p; return 'ped'; }
function crowd(dy) { var m = Z.me, c = 0; Z.peds.slice(0, 5).forEach(function (p, j) { p.x = m.x + (j % 2 ? 2.6 : -2.6) + (j === 4 ? 2.6 : 0); p.y = m.y + dy + j * 5; p.lx = p.x; p.ly = p.y; c++; }); return c; }

/* extended-cut helpers */
function wildPt(d) { var W = Z.W; for (var y = 600; y < 4000; y += 10) if (S.wildD(W, 0, y) > d) return { x: 0, y: y }; for (var x = 600; x < 6000; x += 10) if (S.wildD(W, x, 0) > d) return { x: x, y: 0 }; return null; }
function seat() { var c = Z.interior.cur; if (!c) return 'out'; var best = null, bd = 1e9; c.room.spots.forEach(function (s) { if (s.k !== 'seat') return; var d = Math.hypot(s.x + c.ox - Z.me.x, s.y + c.oy - Z.me.y); if (d < bd) { bd = d; best = s; } }); if (!best) return 'no seat ' + c.room.spots.map(function (s) { return s.k; }).join(','); Z.me.x = best.x + c.ox; Z.me.y = best.y + c.oy; Z.interior.act(); return 'sat ' + !!Z.me.sit + ' lec=' + (Z.interior.lec ? Z.interior.lec.phase : 'none'); }
function ui() { var o = document.querySelector('[data-gm-overlay]'); return o && !o.hidden ? 'overlay' : 'none'; }

function tutDay() { for (var d = 1; d < 60; d++) { Z.P.day = d; Z.P.time = 19.2 * 60; var t = Z.interior.tutorial(); if (t) return t.place; } return null; }
function mall(id, time) { var r = inside('market', time == null ? 12 : time); if (id && id !== 'market' && Z.interior.cur) { var pl = Z.places[id]; if (pl && Z.interior.hop(pl)) { for (var i = 0; i < 60 && Z.interior.trans; i++) D.step(4); settle(10); Z.r3.manual = 9999; return id + ':' + (Z.interior.cur && Z.interior.cur.type); } return r + ' hop failed'; } return r; }

function lecture() { for (var d = 1; d < 15; d++) for (var hr = 8; hr < 17; hr++) { Z.P.day = d; Z.P.time = hr * 60 + 5; var ids = ['kt', 'wt', 'nelt']; for (var j = 0; j < ids.length; j++) { var n = null; try { n = Z.life.attending(ids[j]); } catch (e) {} if (!n) continue; var r = inside(ids[j], hr + 5 / 60); Z.P.day = d; var s = seat(); if (Z.interior.lec) return r + ' d' + d + ' h' + hr + ' ' + s; } } return 'no lecture found'; }
