/* Freshers School Life — campus generator. Run: node games/mapgen/fslg_map.js
   Writes static/js/games/fslg-map.js. The campus is designed, not surveyed: a ring road, a palm boulevard from the
   Main Gate to a fountain, the Selfie Garden and Senate tower at the centre, hostels in the north corners, faculties
   across the middle, a lake, an airfield and staff quarters in the south, and a market town outside the gate.
   Units are metres, x east, y south. Roads are split at every junction so the road graph is connected. */
const fs = require("fs"), path = require("path");
const S = require("../../static/js/games/samaru-sim.js");
const rnd = S.rng(20261112);
const lines = [], buildings = [], areas = [], props = [], pois = [];
const R = Math.round;

/* ---------- roads ---------- */
function road(kind, w, name, pts) { lines.push({ k: kind, w, n: name || 0, p: pts.map((q) => [R(q[0]), R(q[1])]) }); }
function arc(kind, w, name, cx, cy, r, a0, a1, n) { const p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } road(kind, w, name, p); }
const E = 700, C = 150, P2 = Math.PI / 2;
// ring road with rounded corners
road("p", 12, "Ring Road", [[-E + C, -E], [E - C, -E]]); arc("p", 12, "Ring Road", E - C, -E + C, C, -P2, 0, 8);
road("p", 12, "Ring Road", [[E, -E + C], [E, E - C]]); arc("p", 12, "Ring Road", E - C, E - C, C, 0, P2, 8);
road("p", 12, "Ring Road", [[E - C, E], [-E + C, E]]); arc("p", 12, "Ring Road", -E + C, E - C, C, P2, Math.PI, 8);
road("p", 12, "Ring Road", [[-E, E - C], [-E, -E + C]]); arc("p", 12, "Ring Road", -E + C, -E + C, C, Math.PI, Math.PI * 1.5, 8);
// boulevard, fountain roundabout, avenues
road("p", 15, "Freshers Boulevard", [[0, -800], [0, -342]]);
for (let q = 0; q < 4; q++) arc("p", 10, "Fountain Circle", 0, -300, 42, -P2 + q * P2, q * P2, 6);
road("t", 10, "Unity Avenue", [[-E, -300], [-42, -300]]); road("t", 10, "Unity Avenue", [[42, -300], [E, -300]]);
road("t", 10, "Scholars Avenue", [[-E, 300], [E, 300]]);
[-350, 350].forEach((x) => road("t", 9, x < 0 ? "West Street" : "East Street", [[x, -E], [x, E]]));
[-175, 175].forEach((x) => road("r", 8, x < 0 ? "Garden Lane" : "Senate Lane", [[x, -E], [x, 300]]));
road("r", 8, "Library Road", [[-350, 120], [350, 120]]);
road("r", 7, "Hall Road West", [[-E, -500], [-350, -500]]); road("r", 7, "Hall Road East", [[350, -500], [E, -500]]);
road("r", 7, "Engineering Way", [[-E, 0], [-350, 0]]); road("r", 7, "Arts Way", [[350, 0], [E, 0]]);
road("r", 7, "Quarters Road", [[350, 500], [E, 500]]); road("r", 7, "Quarters Close", [[525, 300], [525, E]]);
road("p", 18, "Runway", [[-680, 560], [-350, 560]]);
road("s", 6, "Lake Walk", [[0, 300], [0, 392]]);
// footpaths
road("x", 4, "Selfie Walk", [[0, -258], [0, -30]]); road("x", 4, 0, [[-175, -160], [175, -160]]); road("x", 3, 0, [[-175, -245], [0, -160]]); road("x", 3, 0, [[175, -245], [0, -160]]);
road("x", 4, "Senate Plaza", [[-175, -30], [175, -30]]); road("x", 4, 0, [[0, 57], [0, 120]]);
road("x", 3, 0, [[-175, -380], [-120, -374], [-88, -372], [-56, -376], [0, -420]]); road("x", 3, 0, [[0, -380], [88, -380], [175, -380]]);
road("x", 3, "Engineering Walk", [[-525, 0], [-525, 50]]); road("x", 3, "Coil Walk", [[-525, 50], [-525, 128]]); road("x", 3, "Engineering Walk", [[-480, 140], [-350, 140]]);
road("x", 3, "Engineering Walk", [[-650, 50], [-394, 50], [-394, 250], [-650, 250], [-650, 50]]); road("x", 3, "Theatre Walk", [[-480, 50], [-480, 250]]);
road("x", 3, "NELT Walk", [[-520, 0], [-520, -132]]); road("x", 3, 0, [[350, -150], [525, -150], [700, -150]]); road("x", 3, 0, [[525, -300], [525, 0]]);
road("x", 3, 0, [[-350, 50], [-262, 50], [-175, 50]]); road("x", 3, 0, [[175, 40], [262, 40], [350, 40]]);
road("x", 3, "Lake Path", [[-350, 400], [-200, 392], [0, 392], [200, 392], [350, 400]]); road("x", 3, "Lake Path", [[-350, 640], [-180, 650], [0, 655], [180, 650], [350, 640]]);
// town outside the gate
road("p", 12, "Market Road", [[-620, -800], [620, -800]]);
[-400, -200, 200, 400].forEach((x) => road("r", 7, 0, [[x, -800], [x, -1040]]));
road("r", 7, 0, [[-400, -920], [-200, -920]]); road("r", 7, 0, [[200, -920], [400, -920]]); road("r", 7, 0, [[-400, -1040], [400, -1040]]);
road("x", 5, "Market Lane", [[0, -800], [0, -896]]); road("x", 4, "Mall Court", [[-84, -964], [84, -964], [84, -896], [-84, -896], [-84, -964]]); road("x", 4, "Mall Court", [[0, -896], [0, -921]]);
road("x", 4, "Mall West Gate", [[-200, -930], [-84, -930]]); road("x", 4, "Mall East Gate", [[84, -930], [200, -930]]);

// Phase 2: a long road south past the Lower Dam causeway, east through farmland, then north-east to the far hostels
road("t", 9, "Phase 2 Road", [[0, 700], [0, 880], [30, 925], [90, 948], [200, 955], [600, 955], [800, 930], [1000, 850], [1150, 720], [1250, 560], [1300, 440], [1320, 400]]);
road("t", 9, "Phase 2 Avenue", [[1320, 400], [1800, 400]]);
road("r", 7, "Dangote Road", [[1450, 160], [1450, 640]]); road("r", 7, "Dan Fodio Road", [[1650, 160], [1650, 640]]);
road("r", 7, "North Close", [[1450, 160], [1650, 160]]); road("r", 7, "South Close", [[1450, 640], [1650, 640]]);
road("x", 3, 0, [[1550, 160], [1550, 185]]); road("x", 3, 0, [[1550, 366], [1550, 400]]); road("x", 3, 0, [[1550, 400], [1550, 640]]);
road("x", 3, 0, [[1366, 400], [1366, 300]]); road("x", 3, 0, [[1650, 250], [1718, 250]]); road("x", 3, 0, [[1650, 552], [1700, 552]]);

// split every road wherever another road touches or crosses it
function onSeg(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy; if (!l2) return -1; const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2; if (t <= .001 || t >= .999) return -1; const qx = a[0] + dx * t, qy = a[1] + dy * t; return Math.hypot(p[0] - qx, p[1] - qy) < .75 ? t : -1; }
function cross(a, b, c, d) { const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0]; if (Math.abs(den) < 1e-9) return null; const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den; return t > .001 && t < .999 && u > -.001 && u < 1.001 ? t : null; }
const roads = [];
lines.forEach((L, li) => {
  let cur = [L.p[0]];
  for (let s = 0; s + 1 < L.p.length; s++) {
    const a = L.p[s], b = L.p[s + 1], cuts = [];
    lines.forEach((M, mi) => { if (mi === li) return; [M.p[0], M.p[M.p.length - 1]].forEach((e) => { const t = onSeg(e, a, b); if (t > 0) cuts.push(t); }); for (let q = 0; q + 1 < M.p.length; q++) { const t = cross(a, b, M.p[q], M.p[q + 1]); if (t != null) cuts.push(t); } });
    cuts.sort((x, y) => x - y).forEach((t) => { const pt = [R(a[0] + (b[0] - a[0]) * t), R(a[1] + (b[1] - a[1]) * t)], last = cur[cur.length - 1]; if (Math.hypot(pt[0] - last[0], pt[1] - last[1]) < 2) return; cur.push(pt); roads.push([L.k, L.w, L.n, cur.flat()]); cur = [pt]; });
    cur.push(b);
  }
  if (cur.length > 1 && Math.hypot(cur[0][0] - cur[cur.length - 1][0], cur[0][1] - cur[cur.length - 1][1]) > 1) roads.push([L.k, L.w, L.n, cur.flat()]);
});

/* ---------- buildings ---------- */
const ST = { // [wall, roof, roofType 0 flat / 1 gable]
  academic: [[0xf1e3c4, 0xd8cdb8, 0], [0xf4e7cc, 0xcfc3ad, 0], [0xeedcb5, 0xd4c8b0, 0]], hall: [[0xf7efe0, 0xb5482f, 1], [0xf3ead6, 0x2f6fb8, 1], [0xf6edd9, 0x2f8f5b, 1], [0xf5ead2, 0x8b5a2b, 1]],
  town: [[0xd9b98c, 0x9a4a32, 1], [0xcfa97a, 0x8b8f96, 1], [0xe3c9a0, 0x7d848c, 1], [0xbf9a73, 0xa8552f, 1], [0xd8c3a5, 0x6f7f8f, 1]], house: [[0xfde8c8, 0xb5482f, 1], [0xe8f0f7, 0x3b6ea5, 1], [0xf6e7d0, 0x4f7a4c, 1], [0xfbe3d3, 0x8b3f2a, 1], [0xf2efe6, 0x6b5b95, 1]],
  glass: [[0xdfeaf2, 0xc9d3dc, 0]], brick: [[0xc9744a, 0xd8cdb8, 0]], white: [[0xf8f6f0, 0x3f8f6a, 0]], orange: [[0xec8a3a, 0xd9762c, 0]], red: [[0xd94f3a, 0xe9e2d3, 0]], teal: [[0x1f9d8f, 0xf1ead8, 0]], purple: [[0x7c5cc4, 0xf1ead8, 0]], yellow: [[0xf2c14e, 0xd8cdb8, 0]]
};
function st(kind, i) { const a = ST[kind]; return a[(i == null ? Math.floor(rnd() * a.length) : i) % a.length]; }
function rect(name, cx, cy, w, d, h, rot, style) { const c = Math.cos(rot || 0), s = Math.sin(rot || 0), p = []; [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].forEach((q) => p.push(R(cx + q[0] * c - q[1] * s), R(cy + q[0] * s + q[1] * c))); buildings.push([name || 0, h, p, style]); }
function poly(name, pts, h, style) { buildings.push([name || 0, h, pts.flat().map(R), style]); }
function U(name, cx, cy, w, d, t, h, style, open) { // U-shaped block, open to the south (or north)
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - d / 2, y1 = cy + d / 2;
  poly(name, open === "n" ? [[x0, y0], [x0 + t, y0], [x0 + t, y1 - t], [x1 - t, y1 - t], [x1 - t, y0], [x1, y0], [x1, y1], [x0, y1]] : [[x0, y0], [x1, y0], [x1, y1], [x1 - t, y1], [x1 - t, y0 + t], [x0 + t, y0 + t], [x0 + t, y1], [x0, y1]], h, style);
}
function area(kind, name, pts) { areas.push([kind, name || 0, pts.flat().map(R)]); }
function box(kind, name, cx, cy, w, d) { area(kind, name, [[cx - w / 2, cy - d / 2], [cx + w / 2, cy - d / 2], [cx + w / 2, cy + d / 2], [cx - w / 2, cy + d / 2]]); }
function blob(kind, name, cx, cy, rx, ry, n, wob, seed) { const p = [], r = S.rng(seed || 5); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, k = 1 + (r() - .5) * wob; p.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); } area(kind, name, p); }
function prop(k, x, y, a, o) { props.push(Object.assign({ k, x: R(x * 10) / 10, y: R(y * 10) / 10, a: a || 0 }, o || {})); }
function row(k, x0, y0, x1, y1, gap, o) { const l = Math.hypot(x1 - x0, y1 - y0), n = Math.floor(l / gap); for (let i = 0; i <= n; i++) prop(k, x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, Math.atan2(y1 - y0, x1 - x0), o); }

// --- north-west: Ribadu/Alex Hall, Suleiman Hall, Mai Shayi, Sick Bay
[-650, -610, -570].forEach((y, i) => rect(i === 1 ? "Ribadu/Alex Hall" : 0, -500, y, 220, 16, 10, 0, st("hall", 0)));
box("garden", 0, -500, -535, 210, 20);
U("Suleiman Hall", -545, -420, 190, 90, 18, 10, st("hall", 1)); box("garden", 0, -545, -400, 150, 50);
rect("Mai Shayi Audu", -395, -470, 12, 9, 3.5, 0, st("town", 0)); rect("Sick Bay", -410, -360, 50, 28, 5, 0, [0xffffff, 0xd94f3a, 0]);
// --- Social Centre, courts, football field, Love Garden
rect("Social Centre", -262, -600, 110, 60, 9, 0, st("teal")); box("plaza", 0, -262, -545, 130, 30);
box("pitch", "Basketball Court", -300, -470, 30, 17); box("court", "Tennis Court", -300, -400, 14, 26); box("court", "Tennis Court", -270, -400, 14, 26); box("court", "Tennis Court", -240, -400, 14, 26); box("pitch", "Basketball Court", -225, -470, 30, 17);
box("field", "Football Field", -88, -560, 70, 110); rect("Pavilion", -88, -640, 60, 12, 5, 0, st("hall", 2));
blob("garden", "Love Garden", -88, -390, 72, 50, 22, .12, 3); 
// --- Shinkafi, Pepsi Garden, bank, bookshop, radio, chapel
box("plaza", "Shinkafi", 88, -560, 150, 190); poly("Shinkafi", [[30, -640], [146, -640], [146, -600], [70, -600], [70, -540], [30, -540]], 7, st("red")); rect("Game Arcade", 125, -520, 40, 44, 6, 0, st("purple")); rect("Shawarma Spot", 55, -490, 30, 16, 4.5, 0, st("yellow"));
blob("garden", "Pepsi Garden", 88, -385, 68, 42, 20, .1, 9); rect(0, 88, -397, 12, 10, 3.5, 0, [0x1d4ed8, 0xffffff, 1]);
rect("Bank (ATM)", 262, -640, 44, 28, 7, 0, st("glass")); rect("ABU Bookshop", 262, -570, 56, 32, 6, 0, st("brick")); rect("Campus Radio Studio", 240, -470, 30, 24, 6, 0, st("purple")); rect("Chapel of Redemption", 262, -370, 26, 50, 9, 0, [0xf2ead8, 0x7a3f2a, 1]);
// --- north-east: Queen Amina Hall, Akenzua Hall, buka, mosque
U("Queen Amina Hall", 525, -600, 220, 110, 18, 10, st("hall", 3), "n"); box("garden", 0, 525, -612, 170, 62);
[-455, -415, -375].forEach((y, i) => rect(i === 1 ? "Akenzua Hall" : 0, 480, y, 190, 16, 10, 0, st("hall", 2)));
rect("Mama Nkechi's Buka", 395, -340, 16, 12, 3.8, 0, st("town", 3)); rect("Central Mosque", 630, -390, 46, 46, 8, 0, st("white"));
// --- west, north block: NELT, Racing Club, the Chemical Engineering pilot plant, the Workshop
rect("NELT", -540, -185, 170, 96, 14, 0, [0xf4ead2, 0x1f6f8b, 1]); box("lawn", 0, -540, -100, 170, 56); box("plaza", 0, -520, -134, 60, 10);
rect("Racing Club", -640, -45, 60, 26, 6, 0, st("red")); box("plaza", 0, -600, -42, 150, 44);
rect("Chemical Engineering Pilot Plant", -410, -42, 80, 36, 10, 0, st("academic", 1)); rect("Workshop", -400, -215, 60, 50, 8, 0, st("brick"));
// --- west, south block: the Faculty of Engineering square. Ten departments round a quad; KT and WT stand side by side
// beside the Engineering Garden, where the Tesla coil is.
const DEPT = [];
function dept(id, name, cx, cy, w, d, h, style, dx, dy) { rect(name, cx, cy, w, d, h, 0, style); DEPT.push([id, name, cx + dx, cy + dy, dy ? P2 : 0]); }
dept("dept_elect", "Electrical Engineering", -592, 27, 116, 22, 12, st("academic", 0), 0, 14); dept("dept_comp", "Computer Engineering", -458, 27, 116, 22, 12, st("academic", 2), 0, 14);
dept("dept_mech", "Mechanical Engineering", -672, 80, 22, 58, 11, st("academic", 1), 14, 0); dept("dept_civil", "Civil Engineering", -672, 150, 22, 58, 11, st("academic", 0), 14, 0); dept("dept_agric", "Agricultural Engineering", -672, 220, 22, 58, 11, st("academic", 2), 14, 0);
dept("dept_metal", "Metallurgical Engineering", -611, 273, 78, 22, 11, st("academic", 1), 0, -14); dept("dept_mining", "Mining Engineering", -525, 273, 78, 22, 11, st("brick"), 0, -14); dept("dept_water", "Water Resources Engineering", -439, 273, 78, 22, 11, st("academic", 0), 0, -14);
dept("dept_telecom", "Telecommunications Engineering", -373, 88, 22, 70, 12, st("glass"), -14, 0); dept("dept_chem", "Chemical Engineering", -373, 200, 22, 86, 11, st("academic", 1), -14, 0);
poly("Kainji Theatre (KT)", [[-472, 74], [-430, 70], [-404, 84], [-404, 112], [-430, 126], [-472, 122]], 12, [0xc9744a, 0x7a3f2a, 0]);
poly("Wolfson Theatre (WT)", [[-472, 158], [-430, 154], [-404, 168], [-404, 196], [-430, 210], [-472, 206]], 12, [0xf1e3c4, 0x1f6f8b, 0]);
box("plaza", 0, -437, 140, 86, 196); blob("garden", "Engineering Garden", -562, 148, 76, 70, 24, .06, 11);
// --- centre-west: FSLT, Theatre CD, Faculty Garden, Faculty of Arts
poly("FSLT Lecture Theatre", [[-300, -250], [-225, -250], [-200, -220], [-200, -185], [-225, -155], [-300, -155], [-325, -185], [-325, -220]], 11, st("academic", 2));
rect("Theatre CD", -262, -85, 90, 44, 9, 0, st("brick")); blob("garden", "Faculty Garden", -262, 50, 62, 40, 18, .1, 17); U("Faculty of Arts", -262, 215, 130, 110, 20, 10, st("academic", 1), "n");
// --- centre: Selfie Garden, Senate, Library
box("lawn", "Selfie Garden", 0, -155, 300, 170); box("plaza", "Senate Plaza", 0, -30, 180, 50);
rect("Senate Building", 0, 30, 60, 46, 38, 0, [0xff9d4a, 0xd9762c, 0]); rect(0, -62, 40, 44, 30, 8, 0, st("academic", 0)); rect(0, 62, 40, 44, 30, 8, 0, st("academic", 0));
rect("Library", 0, 215, 130, 90, 14, 0, st("glass")); box("plaza", 0, 0, 155, 150, 26);
// --- centre-east: Physics, Maths, Geography Garden, Institute of Education
U("Department of Physics", 262, -205, 130, 80, 18, 11, st("academic", 2)); rect("Department of Mathematics", 262, -95, 120, 30, 11, 0, st("academic", 0));
blob("garden", "Geography Garden", 262, 40, 62, 38, 18, .1, 23); U("Institute of Education", 262, 215, 130, 110, 20, 10, st("academic", 0), "n");
// --- east: Sculpture Garden, Demonstration School, Fire Station
blob("park", "Sculpture Garden", 525, -150, 130, 105, 26, .08, 29); U("Demonstration Secondary School", 460, 160, 150, 110, 18, 8, st("house", 0)); rect("Department of Computer Science", 610, 46, 110, 44, 11, 0, st("glass")); box("lawn", 0, 610, 96, 110, 40); rect("Fire Station", 630, 200, 60, 40, 8, 0, st("red")); box("plaza", 0, 630, 255, 70, 40);
// --- south: flying club, the dam, staff quarters
rect("Flying Club Hangar", -520, 470, 70, 46, 10, 0, [0xcfd8dc, 0x607d8b, 1]); box("lawn", "Flying Club field", -515, 560, 340, 70); box("farmland", "Orchard", -525, 650, 260, 60);
blob("park", 0, 0, 525, 300, 160, 30, .06, 31); blob("water", "The Dam", 0, 525, 235, 105, 30, .1, 31);
rect("Dam Visitor Centre", -95, 405, 34, 12, 7, 0, [0xf1f5f2, 0x1f7a7a, 0]); // the aquarium gallery and swim challenge (samaru-water.js)
for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { rect(0, 395 + i * 62 + (i > 1 ? 36 : 0), 365 + j * 80, 30, 22, 4.5, 0, st("house", i + j)); rect(0, 395 + i * 62 + (i > 1 ? 36 : 0), 560 + j * 80, 30, 22, 4.5, 0, st("house", i + j + 2)); }
rect("Staff Club", 440, 470, 50, 24, 5, 0, st("house", 1));
// --- town and Samaru Market: a two-storey mall round an open court, with the old stalls and zinc roofs still round it
const MALL = [0xf3efe6, 0xc2410c, 0], MALL2 = [0xfaf7f0, 0x0f766e, 0];
rect("Samaru Market", 0, -985, 240, 30, 11, 0, MALL); rect("Samaru Market", -66, -875, 108, 30, 11, 0, MALL); rect("Samaru Market", 66, -875, 108, 30, 11, 0, MALL);
rect(0, -105, -954, 30, 32, 11, 0, MALL2); rect(0, -105, -906, 30, 32, 11, 0, MALL2); rect(0, 105, -954, 30, 32, 11, 0, MALL2); rect(0, 105, -906, 30, 32, 11, 0, MALL2);
[[-110, -990], [110, -990], [-110, -870], [110, -870]].forEach((q) => rect(0, q[0], q[1], 20, 20, 15, 0, [0xc2410c, 0xf3efe6, 0])); // corner towers
box("plaza", "Samaru Market", 0, -930, 180, 80); box("plaza", "Market Forecourt", 0, -831, 250, 48); box("plaza", "Car and Keke Park", -160, -930, 62, 130); box("plaza", "Old Market", 160, -930, 62, 130); box("pitch", "Dance Floor", 0, -930, 26, 18);
for (let gx = -560; gx <= 560; gx += 46) for (let gy = -1010; gy <= -850; gy += 52) { if (Math.abs(gx) < 215 || rnd() < .12) continue; let x = gx + (rnd() - .5) * 8, y = gy + (rnd() - .5) * 8; if ([-400, -200, 200, 400].some((sx) => Math.abs(x - sx) < 26) || Math.abs(y + 920) < 22 || Math.abs(y + 1040) < 22 || y > -826) continue; rect(0, x, y, 20 + rnd() * 14, 16 + rnd() * 10, 3.5 + rnd() * 2.5, 0, st("town")); }
for (let gx = -560; gx <= 560; gx += 60) { if (Math.abs(gx) < 60) continue; rect(0, gx, -1075, 30, 22, 4 + rnd() * 3, 0, st("town")); }
// the MIB Store: white and gold, on Unity Avenue a few steps from the fountain
rect("MIB Store", 250, -272, 56, 24, 7, 0, [0xfdfcf7, 0xd4a017, 0]); box("plaza", 0, 250, -289, 60, 8);

/* ---------- scenery ---------- */
prop("gate", 0, -712, P2); prop("fountain", 0, -300, 0, { s: 1.4 }); prop("letters", 0, -92, 0, { text: "{{GAME_INITIALS}}" }); // from the game config at run time (samaru-overrides.js)
row("palm", -13, -690, -13, -356, 22); row("palm", 13, -690, 13, -356, 22);
for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + .314; prop("flag", Math.cos(a) * 27, -300 + Math.sin(a) * 27, a); }
row("flowers", -120, -225, 120, -225, 30); row("flowers", -120, -95, -30, -95, 30); row("flowers", 30, -95, 120, -95, 30);
[[-110, -190], [110, -190], [-110, -120], [110, -120], [-60, -160], [60, -160]].forEach((q) => prop("bench", q[0], q[1], q[0] < 0 ? 0 : Math.PI));
[[-100, -200], [100, -200], [-135, -150], [135, -150], [-100, -105], [100, -105]].forEach((q) => prop("tree", q[0], q[1], 0, { kind: 4 }));
prop("clock", 0, 150, 0); prop("senate", 0, 30, 0);
// love garden
prop("heart", -88, -390, 0); [[-120, -400], [-56, -400], [-88, -360], [-110, -370], [-66, -370]].forEach((q, i) => prop("bench", q[0], q[1], i)); row("flowers", -130, -420, -46, -420, 21); [[-140, -390], [-36, -390], [-88, -432], [-88, -350]].forEach((q) => prop("tree", q[0], q[1], 0, { kind: 4 }));
// sports
prop("goal", -88, -612, P2); prop("goal", -88, -508, -P2); prop("bleachers", -135, -560, 0); prop("bleachers", -41, -560, Math.PI);
[[-300, -470], [-225, -470]].forEach((c) => { prop("hoop", c[0] - 14, c[1], 0); prop("hoop", c[0] + 14, c[1], Math.PI); }); [-300, -270, -240].forEach((x) => prop("net", x, -400, 0));
prop("table", -200, -545, 0); prop("table", -215, -548, 1); prop("pingpong", -310, -548, 0); prop("pingpong", -325, -548, 0); prop("pool", -262, -548, 0);
// shinkafi and pepsi garden
[[40, -575], [60, -580], [85, -572], [110, -578], [45, -455], [70, -460], [100, -455], [130, -462], [150, -590]].forEach((q, i) => prop("umbrella", q[0], q[1], i, { c: i })); row("stall", 20, -470, 20, -610, 28); prop("sign", 88, -662, P2, { text: "SHINKAFI" });
[[60, -385], [116, -385], [70, -412], [88, -360]].forEach((q, i) => prop("umbrella", q[0], q[1], i, { c: i + 3 })); [[50, -400], [126, -370]].forEach((q) => prop("tree", q[0], q[1], 0, { kind: 0 }));
prop("mast", 222, -470, 0); prop("steeple", 262, -392, 0); prop("dome", 630, -390, 0); prop("minaret", 655, -365, 0);
// hostels
[[-500, -535], [-545, -400], [525, -612]].forEach((q) => { prop("bench", q[0] - 30, q[1], 0); prop("bench", q[0] + 30, q[1], 0); prop("tree", q[0], q[1], 0, { kind: 1 }); prop("flowers", q[0] - 60, q[1], 0); prop("flowers", q[0] + 60, q[1], 0); });
row("clothes", -640, -630, -420, -630, 55); row("clothes", 400, -435, 560, -435, 55);
// engineering garden: the coil stands at its centre (placed by the engine)
for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; if (i === 6) continue; prop(i % 2 ? "bench" : "flowers", -525 + Math.cos(a) * 26, 140 + Math.sin(a) * 22, a + P2); } [[-610, 110], [-610, 185], [-560, 92], [-560, 205], [-500, 205]].forEach((q) => prop("tree", q[0], q[1], 0, { kind: 1 }));
prop("bigsign", -476, 98, Math.PI, { text: "KT · KAINJI THEATRE", c: 0 }); prop("bigsign", -476, 182, Math.PI, { text: "WT · WOLFSON THEATRE", c: 1 }); prop("bigsign", -520, -132, P2, { text: "NELT", c: 2 });
prop("sign", -534, 8, P2, { text: "FACULTY OF ENGINEERING" });
DEPT.forEach((d) => prop("sign", d[2], d[3], d[4], { text: d[1].replace(" Engineering", "").toUpperCase() }));
[[-600, 60], [-450, 60], [-600, 240], [-450, 240]].forEach((q, i) => prop("bench", q[0], q[1], i)); row("flowers", -640, 44, -410, 44, 46);
prop("sign", 610, 20, P2, { text: "COMPUTER SCIENCE" }); prop("flowers", 580, 92, 0); prop("flowers", 640, 92, 0); prop("bench", 610, 100, 0);
row("flag", -665, -75, -615, -75, 12, { c: 1 }); prop("sign", -600, -66, P2, { text: "RACING CLUB" }); row("tyres", -670, -22, -540, -22, 18);
// gardens
[[-290, 50], [-234, 50], [-262, 30], [-262, 70]].forEach((q, i) => prop(i < 2 ? "bench" : "flowers", q[0], q[1], i)); prop("tree", -262, 50, 0, { kind: 0 });
[[234, 40], [290, 40]].forEach((q, i) => prop("bench", q[0], q[1], i * Math.PI)); prop("globe", 262, 40, 0); row("flowers", 230, 60, 294, 60, 16);
[[470, -200], [580, -205], [450, -120], [600, -110], [525, -230], [525, -75], [490, -160], [565, -150]].forEach((q, i) => prop("statue", q[0], q[1], i, { c: i })); [[430, -150], [620, -160], [525, -180], [540, -120]].forEach((q, i) => prop(i < 2 ? "bench" : "tree", q[0], q[1], i, { kind: 0 }));
// south
prop("windsock", -370, 530, 0); row("cone", -680, 548, -360, 548, 40); row("cone", -680, 572, -360, 572, 40); for (let i = 0; i < 9; i++) for (let j = 0; j < 2; j++) prop("tree", -640 + i * 29, 635 + j * 26, 0, { kind: 1, s: .7 });
prop("pier", 0, 408, P2); prop("boat", -60, 500, .4); prop("boat", 90, 560, 2.1); prop("watertower", -300, 410, 0); [[-150, 398], [150, 398], [-260, 520], [260, 520], [0, 650]].forEach((q, i) => prop("bench", q[0], q[1], i)); [[-200, 410], [200, 410], [-270, 600], [270, 600], [-100, 645], [100, 645]].forEach((q) => prop("palm", q[0], q[1], 0));
for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) prop(j % 2 ? "flowers" : "tree", 372 + i * 62 + (i > 1 ? 36 : 0), 392 + j * 66 + (j > 1 ? 60 : 0), 0, { kind: 1, s: .6 });
prop("firetruck", 630, 250, 0); prop("flag", 400, 110, 0); prop("flag", 520, 110, 0);
// market: the mall court, forecourt, parks and the old stalls
const STORES = [];
function store(id, name, x, y, nx, ny) { STORES.push([id, name, R((x + nx * 3.5) * 10) / 10, R((y + ny * 3.5) * 10) / 10, x, y]); }
[["mk_supermarket", "Supermarket"], ["mk_electronics", "Electronics"], ["mk_phones", "Phones & Gadgets"], ["mk_cinema", "Cinema"], ["mk_books", "Books & Stationery"], ["mk_pharmacy", "Pharmacy"], ["mk_arcade", "Games Room"]].forEach((q, i) => store(q[0], q[1], -78 + i * 26, -970, 0, 1));
[["mk_fashion", "Fashion"], ["mk_native", "Tailor & Native Wear"], ["mk_modest", "Modest Fashion"], ["mk_shoes", "Shoes"], ["mk_eyewear", "Eyewear"], ["mk_sports", "Sports"]].forEach((q, i) => store(q[0], q[1], [-78, -52, -26, 26, 52, 78][i], -890, 0, -1));
store("mk_barber", "Barber & Salon", -90, -954, 1, 0); store("mk_thrift", "Thrift (Okrika)", -90, -906, 1, 0); store("mk_gifts", "Gifts", 90, -954, -1, 0); store("mk_food", "Food Court", 90, -906, -1, 0);
prop("strip", 0, -969.8, P2, { w: 182, texts: STORES.slice(0, 7).map((q) => q[1].toUpperCase()) }); prop("strip", -52, -890.2, -P2, { w: 78, texts: STORES.slice(7, 10).map((q) => q[1].toUpperCase()).reverse() }); prop("strip", 52, -890.2, -P2, { w: 78, texts: STORES.slice(10, 13).map((q) => q[1].toUpperCase()).reverse() });
prop("strip", -89.8, -930, 0, { w: 80, texts: ["BARBER & SALON", "", "THRIFT"] }); prop("strip", 89.8, -930, Math.PI, { w: 80, texts: ["FOOD COURT", "", "GIFTS"] });
prop("mallgate", 0, -858, P2, { text: "SAMARU MARKET" }); prop("stage", 0, -946, P2); [[-70, -950], [70, -950], [-70, -910], [70, -910], [-30, -930], [30, -930]].forEach((q) => prop("palm", q[0], q[1], 0)); [[-45, -957], [45, -957], [-45, -903], [45, -903]].forEach((q, i) => prop("bench", q[0], q[1], i < 2 ? P2 : -P2)); [[-60, -930], [60, -930]].forEach((q) => prop("flowers", q[0], q[1], P2));
[[-100, -846], [-78, -846], [-56, -846], [-34, -846], [34, -846], [56, -846], [78, -846], [100, -846]].forEach((q, i) => prop("stall", q[0], q[1], Math.PI, { c: i })); [[-90, -826], [-50, -824], [50, -824], [90, -826]].forEach((q, i) => prop("umbrella", q[0], q[1], i, { c: i + 1 })); [[-118, -812], [-20, -814], [20, -814], [118, -812]].forEach((q) => prop("palm", q[0], q[1], 0));
prop("keke_stand", -160, -970, P2); prop("keke_stand", -160, -890, P2); row("cone", -186, -995, -186, -865, 26); prop("sign", -134, -868, P2, { text: "CAR & KEKE PARK" });
for (let i = 0; i < 3; i++) for (let j = 0; j < 5; j++) { if (j === 2) continue; prop(i === 1 ? "umbrella" : "stall", 142 + i * 18, -986 + j * 28, i ? Math.PI : 0, { c: i + j }); } prop("sign", 134, -868, P2, { text: "OLD MARKET" });
prop("keke_stand", 34, -745, 0); prop("sign", -26, -752, P2, { text: "WELCOME TO {{GAME_INITIALS}}" });
prop("bigsign", 250, -291, P2, { text: "MIB STORE", c: 3 }); prop("flowers", 228, -289, 0); prop("flowers", 272, -289, 0); prop("statue", 284, -289, 0, { c: 6 });
// avenue trees inside the ring and along the avenues
for (let x = -520; x <= 520; x += 40) { if (Math.abs(x) % 175 < 16 || Math.abs(x) < 30) continue; prop("tree", x, -E + 14, 0, { kind: 0 }); prop("tree", x, E - 14, 0, { kind: 0 }); }
for (let y = -520; y <= 520; y += 40) { if (Math.abs(Math.abs(y) - 300) < 20 || Math.abs(Math.abs(y) - 500) < 16 || Math.abs(y) < 16) continue; prop("tree", -E + 14, y, 0, { kind: 0 }); prop("tree", E - 14, y, 0, { kind: 0 }); }
for (let x = -660; x <= 660; x += 34) { if ([-350, -175, 175, 350].some((sx) => Math.abs(x - sx) < 16) || Math.abs(x) < 60) continue; prop("tree", x, -300 - 11, 0, { kind: 4, s: .7 }); prop("tree", x, 300 + 11, 0, { kind: 1, s: .8 }); }


/* ---------- Phase 2: the far hostels, beyond the Lower Dam ---------- */
blob("water", "Lower Dam", -78, 800, 60, 58, 22, .05, 41); blob("water", "Lower Dam", 78, 800, 60, 58, 22, .05, 43); box("park", 0, 0, 800, 300, 150);
row("rail", -7, 746, -7, 854, 6); row("rail", 7, 746, 7, 854, 6); [[-150, 760], [150, 760], [-150, 850], [150, 850]].forEach((q) => prop("palm", q[0], q[1], 0)); prop("bench", -22, 728, 0); prop("bench", 22, 872, Math.PI); prop("boat", -80, 800, 1.2); prop("boat", 95, 815, 2.6, { c: 1 });
box("farmland", "Farms", 400, 905, 380, 66); box("farmland", "Farms", 400, 982, 380, 26); blob("farmland", "Farms", 905, 745, 86, 58, 16, .1, 47); blob("farmland", "Farms", 1010, 968, 120, 26, 14, .08, 49); blob("farmland", "Farms", 1180, 520, 50, 90, 14, .1, 51);
for (let x = 220; x <= 580; x += 45) { prop("tree", x, 943, 0, { kind: x % 90 ? 0 : 4 }); prop("tree", x + 20, 967, 0, { kind: 1, s: .8 }); }
[[640, 938], [760, 922], [860, 892], [930, 866], [1070, 800], [1180, 668], [1222, 618], [1262, 514], [1283, 452]].forEach((q, i) => prop(i % 3 === 2 ? "palm" : "tree", q[0] - 9, q[1] - 10, 0, { kind: i % 2 ? 4 : 0 }));
prop("checkpoint", 700, 942.5, Math.atan2(-25, 200)); prop("sign", 668, 958, Math.atan2(-25, 200), { text: "PHASE 2 · 1 KM" }); prop("sign", 16, 716, P2, { text: "TO PHASE 2 HOSTELS" });
[[1009, 830], [1024, 817], [1039, 804]].forEach((q, i) => prop("stall", q[0], q[1], Math.atan2(-130, 150) + P2, { c: i + 2 })); prop("umbrella", 1052, 792, 0, { c: 4 }); prop("umbrella", 998, 842, 0, { c: 1 });
// hostels
U("Dangote Hostel", 1550, 237, 160, 100, 18, 13, [0xf4ecdc, 0xb5482f, 1]); box("garden", 0, 1550, 252, 120, 60);
rect("Dangote Hostel (Female Wing)", 1550, 318, 160, 16, 13, 0, [0xf4ecdc, 0x8b3f6a, 1]); rect(0, 1550, 358, 150, 16, 13, 0, [0xf4ecdc, 0x8b3f6a, 1]); box("garden", 0, 1550, 338, 150, 20);
[440, 500, 560].forEach((y, i) => rect(i === 1 ? "Dan Fodio Hostel" : 0, i < 2 ? 1508 : 1592, y, 76, 16, 12, 0, [0xeef1e6, 0x2f8f5b, 1])); [440, 500, 560].forEach((y, i) => rect(0, i < 2 ? 1592 : 1508, y, 76, 16, 12, 0, [0xeef1e6, 0x2f8f5b, 1]));
rect(0, 1508, 612, 76, 16, 12, 0, [0xeef1e6, 0x2f8f5b, 1]); rect(0, 1592, 612, 76, 16, 12, 0, [0xeef1e6, 0x2f8f5b, 1]); box("garden", 0, 1508, 470, 70, 36); box("garden", 0, 1592, 470, 70, 36); box("garden", 0, 1508, 530, 70, 36); box("garden", 0, 1592, 530, 70, 36);
row("clothes", 1500, 216, 1600, 216, 50); row("clothes", 1480, 470, 1536, 470, 28); row("clothes", 1564, 530, 1620, 530, 28); row("clothes", 1480, 586, 1536, 586, 28);
[[1474, 302], [1626, 302], [1470, 596], [1630, 596]].forEach((q) => prop("tank", q[0], q[1], 0)); prop("watertower", 1760, 610, 0);
[[1520, 262], [1580, 262], [1550, 240]].forEach((q, i) => prop(i < 2 ? "bench" : "tree", q[0], q[1], 0, { kind: 1 })); prop("flowers", 1500, 275, 0); prop("flowers", 1600, 275, 0);
prop("bigsign", 1560, 174, P2, { text: "DANGOTE HOSTEL", c: 0 }); prop("bigsign", 1560, 414, P2, { text: "DAN FODIO HOSTEL", c: 1 });
// shops, canteen, shuttle park, pitch
["Provisions Store", "Barber & Salon", "POS & Phone Charging", "Laundry"].forEach((n, i) => rect(n, 1356 + i * 24, 420, 22, 16, 4.5, 0, st("town", i)));
box("plaza", "Phase 2 Shops", 1392, 446, 104, 24); [[1352, 446], [1380, 448], [1408, 446], [1434, 448]].forEach((q, i) => prop("umbrella", q[0], q[1], i, { c: i + 2 })); prop("kiosk", 1338, 446, 0, { c: 0 }); prop("kiosk", 1338, 452, 0, { c: 1 });
rect("Phase 2 Canteen", 1412, 520, 52, 34, 5.5, 0, st("yellow")); box("plaza", 0, 1412, 560, 52, 30); [[1398, 556], [1412, 564], [1426, 556]].forEach((q, i) => prop("table", q[0], q[1], i));
box("plaza", "Phase 2 Shuttle Park", 1375, 345, 110, 70); prop("busstop", 1380, 390, P2, { text: "PHASE 2" }); prop("keke_stand", 1350, 325, 0); prop("keke_stand", 1400, 325, 0); prop("sign", 1332, 386, P2, { text: "WELCOME TO PHASE 2" });
box("field", "Phase 2 Pitch", 1375, 235, 70, 110); prop("goal", 1375, 183, P2); prop("goal", 1375, 287, -P2); prop("bleachers", 1328, 235, 0);
// mosque, chapel, common room, court
rect("Phase 2 Mosque", 1740, 250, 34, 34, 7, 0, st("white")); prop("dome", 1740, 250, 0, { sc: .62 }); prop("minaret", 1762, 272, 0, { sc: .6 });
rect("Phase 2 Chapel", 1730, 345, 20, 36, 8, 0, [0xf2ead8, 0x7a3f2a, 1]); prop("steeple", 1730, 322, 0, { sc: .6 });
rect("Common Room", 1725, 450, 70, 28, 6, 0, st("teal")); box("pitch", "Basketball Court", 1725, 540, 30, 17); prop("hoop", 1711, 540, 0); prop("hoop", 1739, 540, Math.PI); blob("park", 0, 1730, 600, 56, 22, 14, .08, 53); prop("bench", 1705, 598, 0); prop("bench", 1750, 602, 2);
// trees and fields round the district
for (let x = 1330; x <= 1790; x += 46) { if (Math.abs(x - 1450) < 14 || Math.abs(x - 1650) < 14) continue; prop("tree", x, 130, 0, { kind: 0 }); prop("tree", x + 12, 668, 0, { kind: 1 }); }
for (let y = 190; y <= 620; y += 48) { if (Math.abs(y - 400) < 20) continue; prop("tree", 1822, y, 0, { kind: 4 }); if (y < 380) prop("tree", 1306, y, 0, { kind: 0 }); }
for (let x = 1340; x <= 1780; x += 40) { if (Math.abs(x - 1450) < 12 || Math.abs(x - 1650) < 12 || Math.abs(x - 1550) < 8) continue; prop("tree", x, 400 - 11, 0, { kind: 4, s: .7 }); }
box("farmland", "Farms", 1560, 80, 420, 70); box("farmland", "Farms", 1560, 730, 420, 80); box("farmland", "Farms", 1862, 400, 50, 420);

/* ---------- shuttle stops: a shelter 2.5 m behind the kerb. STOPS is echoed in the report for samaru-data.js ---------- */
const STOPS = [];
function stop(id, name, x, y, nx, ny, w) { const off = w / 2 + 5.5; prop("busstop", x + nx * off, y + ny * off, Math.atan2(-ny, -nx), { text: name.toUpperCase() }); STOPS.push([id, name, R(x + nx * (w / 2 + 3)), R(y + ny * (w / 2 + 3))]); }
stop("stop_gate", "Main Gate", 0, -730, -1, 0, 15); stop("stop_senate", "Senate", 175, -30, 1, 0, 8); stop("stop_social", "Social Centre", -175, -516, -1, 0, 8);
stop("stop_market", "Samaru Market", 60, -800, 0, -1, 12); stop("stop_eng", "Engineering", -490, 0, 0, -1, 7); stop("stop_library", "Library", 70, 120, 0, -1, 8); stop("stop_dam", "The Dam", 34, 300, 0, 1, 10);


/* ---------- furniture stays beside the paths ----------
   Every solid prop has a footprint (circles in its own frame: local x is the way it faces). Anything standing on a
   footpath, a road, a place marker or a door is slid sideways off it and, if it is a seat, turned to face the path.
   The report below runs the same test again and fails the build if anything is still in the way. */
global.window = global; require("../../static/js/games/samaru-data.js"); const PLACES = (global.SamaruData || {}).PLACES || [];
const FOOT = { bench: [[-.6, 0, .55], [.6, 0, .55]], table: [[0, 0, 1]], pingpong: [[0, 0, 1.5]], pool: [[0, 0, 1.5]], sign: [[0, -2.6, .3], [0, 2.6, .3], [0, 0, .25]], bigsign: [[0, -5.2, .35], [0, 5.2, .35]], stall: [[-1, .2, 1.3], [1, .2, 1.3]], umbrella: [[0, 0, 1.4]], flowers: [[-1.4, 0, .8], [0, 0, .8], [1.4, 0, .8]], kiosk: [[0, 0, 1.4]], statue: [[0, 0, 1.1]], globe: [[0, 0, 1.6]], tyres: [[0, 0, .7]], flag: [[0, 0, .3]], tank: [[0, 0, 1.5]], busstop: [[-.4, -2, 1.5], [-.4, 0, 1.5], [-.4, 2, 1.5], [1.1, 3.4, .3]], keke_stand: [[-3, 0, 1.8], [0, 0, 1.8], [3, 0, 1.8]], clothes: [[-3, 0, .2], [3, 0, .2]], hoop: [[0, 0, .4]], goal: [[0, -3.6, .3], [0, 3.6, .3]], cone: [[0, 0, .3]], tree: [[0, 0, .6]], palm: [[0, 0, .5]], stage: [[0, -3, 3.2], [0, 3, 3.2]], bleachers: [[-1.6, -16, 2.4], [-1.6, -8, 2.4], [-1.6, 0, 2.4], [-1.6, 8, 2.4], [-1.6, 16, 2.4]], heart: [[0, 0, 7.5]], clock: [[0, 0, 2]], watertower: [[0, 0, 2.6]], mast: [[0, 0, .6]], windsock: [[0, 0, .3]], firetruck: [[-2, 0, 1.6], [2, 0, 1.6]], checkpoint: [[0, -8.4, 1.7]], mallgate: [[0, -12.6, 1.7], [0, 12.6, 1.7]], gate: [[0, -13, 2.1], [0, 13, 2.1]] };
const FIXED = { gate: 1, mallgate: 1, checkpoint: 1, heart: 1, clock: 1, watertower: 1, mast: 1, firetruck: 1, bleachers: 1, goal: 1, hoop: 1, stage: 1, busstop: 1, bigsign: 1, cone: 1, keke_stand: 1 }; // placed by hand; reported, never moved
const TW = S.buildWorld({ bounds: [-800, -1120, 1900, 1010], roads, buildings, areas: [], props: [] });
const SPOTS = []; PLACES.forEach((pl) => { const nr = S.nearRoad(TW, pl.x, pl.y, 140); let mx = pl.x, my = pl.y; if (nr) { const dx = pl.x - nr.x, dy = pl.y - nr.y, l = Math.hypot(dx, dy) || 1, off = Math.min(nr.r.w / 2 + 3, l); mx = nr.x + dx / l * off; my = nr.y + dy / l * off; } const f = S.push(TW, mx, my, 1.4); SPOTS.push({ x: f.x, y: f.y, r: 2.2, n: pl.id }); if (pl.door) SPOTS.push({ x: pl.door[0], y: pl.door[1], r: 2.6, n: pl.id + " door" }); });
function circles(q) { const c = Math.cos(q.a || 0), s2 = Math.sin(q.a || 0), k = q.sc || 1; return (FOOT[q.k] || []).map((f) => ({ x: q.x + (f[0] * c - f[1] * s2) * k, y: q.y + (f[0] * s2 + f[1] * c) * k, r: f[2] * k })); }
// what a prop is standing on: {x, y (where to move away from), need (clear distance), d, what}
function clash(q) { let worst = null; circles(q).forEach((c) => { const n = S.nearRoad(TW, c.x, c.y, 14); if (n) { const need = n.r.w / 2 + c.r + (n.r.k === "x" ? .25 : .1); if (n.d < need && (!worst || need - n.d > worst.need - worst.d)) worst = { x: n.x, y: n.y, cx: c.x, cy: c.y, need, d: n.d, what: (n.r.k === "x" ? "path " : "road ") + (n.r.n || ""), path: n }; } SPOTS.forEach((sp) => { const d = Math.hypot(c.x - sp.x, c.y - sp.y), need = sp.r + c.r; if (d < need && (!worst || need - d > worst.need - worst.d)) worst = { x: sp.x, y: sp.y, cx: c.x, cy: c.y, need, d, what: "place " + sp.n }; }); }); return worst; }
let nudged = 0; const SEAT = { bench: 1 };
props.forEach((q) => { if (!FOOT[q.k] || FIXED[q.k]) return; let h = clash(q), guard = 0, moved = false, last = null;
  while (h && guard++ < 10) { let dx = h.cx - h.x, dy = h.cy - h.y, l = Math.hypot(dx, dy); if (l < .05) { const rr = h.path ? h.path.r : null; if (rr) { const p = rr.p, sx = p[h.path.s + 2] - p[h.path.s], sy = p[h.path.s + 3] - p[h.path.s + 1], sl = Math.hypot(sx, sy) || 1; dx = -sy / sl; dy = sx / sl; } else { dx = 1; dy = 0; } l = 1; }
    const step = h.need - h.d + .35; let nx = q.x + dx / l * step, ny = q.y + dy / l * step; if (S.insideBuilding(TW, nx, ny) || S.push(TW, nx, ny, .8).hit) { nx = q.x - dx / l * (h.need + h.d + .35); ny = q.y - dy / l * (h.need + h.d + .35); }
    q.x = R(nx * 10) / 10; q.y = R(ny * 10) / 10; moved = true; if (h.path) last = h; h = clash(q); }
  if (moved) { nudged++; if (SEAT[q.k] && last) { const ux = last.x - q.x, uy = last.y - q.y; q.a = R(Math.atan2(-ux, uy) * 100) / 100; } } });
// seats that were already clear but have a path right beside them should face it too
props.forEach((q) => { if (!SEAT[q.k]) return; const n = S.nearRoad(TW, q.x, q.y, 5); if (n && n.r.k === "x" && n.d > .2) q.a = R(Math.atan2(-(n.x - q.x), n.y - q.y) * 100) / 100; });
const inWay = []; props.forEach((q) => { if (!FOOT[q.k] || q.k === "gate" || q.k === "mallgate") return; const h = clash(q); if (h) inWay.push(q.k + "@" + q.x + "," + q.y + " on " + h.what); });

const out = { designed: 1, name: "{{GAME_NAME}}", townY: -790, bounds: [-800, -1120, 1900, 1010], core: [-800, -1120, 800, 800], flat: [[-800, -1120, 800, 800], [1270, 30, 1900, 790], [-210, 790, 1300, 1010], [800, 420, 1300, 800]], limit: [-40000, -40000, 40000, 40000], roads, buildings, areas, props, pois };
let tokensMoved = 0;
/* kola nuts: the first 150 are frozen where they were before the campus grew (saves store them by index); any that a
   new building, road or pond now covers is moved to the nearest free ground. Twenty more are hidden in the new areas. */
{
  const W0 = S.buildWorld(out), old = JSON.parse(fs.readFileSync(path.join(__dirname, "fslg_tokens.json"), "utf8")), tk = [];
  const free = (x, y) => { if (S.inWater(W0, x, y)) return null; const f = S.push(W0, x, y, 1.4); if (S.insideBuilding(W0, f.x, f.y) || S.inWater(W0, f.x, f.y)) return null; const n = S.nearRoad(W0, f.x, f.y, 70); if (!n) return null; if (n.d < n.r.w / 2 + 2) { const l = n.d || 1; return free2(n.x + (f.x - n.x) / l * (n.r.w / 2 + 3), n.y + (f.y - n.y) / l * (n.r.w / 2 + 3)); } return [R(f.x * 10) / 10, R(f.y * 10) / 10]; };
  const free2 = (x, y) => { const f = S.push(W0, x, y, 1.4); return S.insideBuilding(W0, f.x, f.y) || S.inWater(W0, f.x, f.y) ? null : [R(f.x * 10) / 10, R(f.y * 10) / 10]; };
  let moved = 0;
  old.forEach((q) => { let p = free(q[0], q[1]); for (let r = 6; !p && r < 80; r += 6) for (let a = 0; a < 8 && !p; a++) p = free(q[0] + Math.cos(a * .785) * r, q[1] + Math.sin(a * .785) * r); if (!p) p = q; if (p[0] !== q[0] || p[1] !== q[1]) moved++; tk.push(p); });
  const tr = S.rng(20261113), zones = [[1300, 140, 1840, 680, 11], [0, 720, 1300, 1000, 6], [-690, 10, -360, 290, 3]]; let guard = 0;
  if (tk.length < 170) zones.forEach((z) => { let n = 0; while (n < z[4] && guard++ < 20000) { const p = free(z[0] + tr() * (z[2] - z[0]), z[1] + tr() * (z[3] - z[1])); if (!p || tk.some((t) => Math.hypot(t[0] - p[0], t[1] - p[1]) < 45)) continue; tk.push(p); n++; } });
  out.tokens = tk; tokensMoved = moved; fs.writeFileSync(path.join(__dirname, "fslg_tokens.json"), JSON.stringify(tk)); // frozen: later map edits cannot move them
}
const js = JSON.stringify(out);
fs.writeFileSync(path.join(__dirname, "../../static/js/games/fslg-map.js"), "/* Freshers School Life campus. Generated by games/mapgen/fslg_map.js; do not edit by hand. Units: metres, x east, y south. */\n(function(r,f){var m=f();if(typeof module===\"object\"&&module.exports)module.exports=m;r.SamaruMap=m;})(typeof self!==\"undefined\"?self:this,function(){return " + js + ";});\n");
// report: graph connectivity and buildings that sit on a road
const W = S.buildWorld(out); let reach = 0; const g = S.nearestNode(W, 0, -712, true); for (let i = 0; i < W.nodes.length; i++) if (i === g || S.pathNodes(W, g, i, false)) reach++;
const bad = []; W.b.forEach((b) => { for (let k = 0; k < b.p.length; k += 2) { const n = S.nearRoad(W, b.p[k], b.p[k + 1], 20); if (n && n.r.k !== "x" && n.d < n.r.w / 2 + 2) { bad.push((b.n || "building") + "@" + b.p[k] + "," + b.p[k + 1] + " " + n.r.n); break; } } const n2 = S.nearRoad(W, b.cx, b.cy, 20); if (n2 && n2.d < n2.r.w / 2) bad.push("centre " + (b.n || "b") + "@" + R(b.cx) + "," + R(b.cy)); });
console.log(JSON.stringify({ stores: STORES }));
console.log(JSON.stringify({ tokens: out.tokens.length, tokensMoved, stops: STOPS, depts: DEPT.map((d) => [d[0], d[2], d[3]]) }));
// hard checks: no road or footpath through a building, every place reachable by road from the gate, nothing solid on a carriageway
const cut = []; W.roads.forEach((r, ri) => { for (let k = 0; k + 3 < r.p.length; k += 2) { const ax = r.p[k], ay = r.p[k + 1], bx = r.p[k + 2], by = r.p[k + 3], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 1.5)); for (let t = 0; t <= n; t++) { const hit = S.insideBuilding(W, ax + (bx - ax) * t / n, ay + (by - ay) * t / n); if (hit) { cut.push("road " + ri + " (" + (r.n || r.k) + ") through " + (hit.n || "building") + " @" + R(ax + (bx - ax) * t / n) + "," + R(ay + (by - ay) * t / n)); return; } } } });
const PL = PLACES, gd = S.nearestNode(W, 0, -712, true), cutoff = [];
PL.forEach((pl) => { const n = S.nearestNode(W, pl.x, pl.y, true), nr = S.nearRoad(W, pl.x, pl.y, 140); if (n < 0 || (n !== gd && !S.pathNodes(W, gd, n, true))) cutoff.push(pl.id + " no drivable route"); if (!nr) cutoff.push(pl.id + " no road within 140 m"); else { const dx = pl.x - nr.x, dy = pl.y - nr.y, l = Math.hypot(dx, dy) || 1, off = Math.min(nr.r.w / 2 + 3, l), f = S.push(W, nr.x + dx / l * off, nr.y + dy / l * off, 1.4); if (S.insideBuilding(W, f.x, f.y)) cutoff.push(pl.id + " marker inside a building"); } });
const SOFT = { gate: 1, checkpoint: 1, rail: 1, cone: 1 }, onRoad = []; props.forEach((q) => { if (SOFT[q.k]) return; const n = S.nearRoad(W, q.x, q.y, 20); if (n && n.r.k !== "x" && n.d < n.r.w / 2 - .2) onRoad.push(q.k + "@" + q.x + "," + q.y + " on " + (n.r.n || n.r.k)); });
console.log(JSON.stringify({ crossings: cut.slice(0, 12), ncross: cut.length, cutoff, onRoad: onRoad.slice(0, 12), nOnRoad: onRoad.length }));
const inFlat = (x, y) => out.flat.some((f) => x >= f[0] + 6 && x <= f[2] - 6 && y >= f[1] + 6 && y <= f[3] - 6), hilly = [];
W.roads.forEach((r) => { for (let k = 0; k < r.p.length; k += 2) if (!inFlat(r.p[k], r.p[k + 1])) { hilly.push("road " + (r.n || r.k) + "@" + r.p[k] + "," + r.p[k + 1]); break; } }); W.b.forEach((b) => { for (let k = 0; k < b.p.length; k += 2) if (!inFlat(b.p[k], b.p[k + 1])) { hilly.push("building " + (b.n || "") + "@" + b.p[k] + "," + b.p[k + 1]); break; } });
areas.forEach((a) => { for (let k = 0; k < a[2].length; k += 2) if (!inFlat(a[2][k], a[2][k + 1])) { hilly.push("area " + (a[1] || a[0]) + "@" + a[2][k] + "," + a[2][k + 1]); break; } }); props.forEach((q) => { if (!inFlat(q.x, q.y)) hilly.push("prop " + q.k + "@" + q.x + "," + q.y); });
console.log(JSON.stringify({ outsideFlatGround: hilly.slice(0, 12), n: hilly.length }));
console.log(JSON.stringify({ furnitureMoved: nudged, inTheWay: inWay.slice(0, 20), nInWay: inWay.length }));
if (hilly.length || inWay.length) process.exitCode = 1;
if (cut.length || cutoff.length || onRoad.length || bad.length || reach !== W.nodes.length) process.exitCode = 1;
console.log(JSON.stringify({ roads: roads.length, nodes: W.nodes.length, reach, buildings: buildings.length, areas: areas.length, props: props.length, bytes: js.length, bad: bad.slice(0, 20), nbad: bad.length }));
