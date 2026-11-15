"""Volt City (static/js/games/voltworld.js): electrostatics, capacitor maths, puzzle solvability and world reachability.

Runs the game's own JavaScript in Node, so the physics checked here is exactly the physics the game uses."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
WORLD = ROOT / "static/js/games/voltworld.js"
pytestmark = pytest.mark.skipif(not shutil.which("node"), reason="node not installed")


def run(body):
    """Evaluate `body` with V = the voltworld module; it must print one JSON value."""
    script = "const V = require(process.argv[1]);\n" + body
    res = subprocess.run(["node", "-e", script, str(WORLD)], capture_output=True, text=True, timeout=240)
    assert res.returncode == 0, res.stderr
    return json.loads(res.stdout)


def test_coulomb_magnitude_and_direction():
    out = run("""
const q = 2e-6, Q = 3e-6, r = 0.5;
const rep = V.coulomb(q, Q, r, 0, 0);          // like charges, q to the right of Q: pushed right
const att = V.coulomb(q, -Q, 0, -r, 0);        // unlike charges, q above Q (y down is +): pulled down toward Q
const far = V.coulomb(q, Q, 2 * r, 0, 0);
console.log(JSON.stringify({ rep, att, far, expect: V.K * q * Q / (r * r) }));""")
    expect = out["expect"]
    assert out["rep"][0] == pytest.approx(expect, rel=1e-9) and out["rep"][1] == 0
    assert out["att"][1] == pytest.approx(expect, rel=1e-9) and out["att"][0] == 0
    assert out["far"][0] == pytest.approx(expect / 4, rel=1e-9)  # inverse square
    assert expect == pytest.approx(0.2158, rel=1e-3)  # 8.99e9 * 2e-6 * 3e-6 / 0.25 N


def test_superposition_and_cancellation():
    out = run("""
const q = 1e-6, a = { x: -1, y: 0, q: 5e-6 }, b = { x: 1, y: 0, q: 5e-6 }, c = { x: 0, y: 1, q: -5e-6 };
const mid = V.forceOn(0, 0, q, [a, b], 0);                         // equal charges either side: cancel
const sum = V.forceOn(0, 0, q, [a, c], 0);                          // vector sum of two forces
const fa = V.coulomb(q, a.q, 0 - a.x, 0 - a.y, 0), fc = V.coulomb(q, c.q, 0 - c.x, 0 - c.y, 0);
const E = V.fieldAt(0.3, 0.2, [a, b, c], 0), F = V.forceOn(0.3, 0.2, 2e-6, [a, b, c], 0);
const Vp = V.potential(0, 0, [a, b], 0);
console.log(JSON.stringify({ mid, sum, fa, fc, E, F, Vp, k: V.K }));""")
    assert abs(out["mid"][0]) < 1e-12 and abs(out["mid"][1]) < 1e-12
    assert out["sum"][0] == pytest.approx(out["fa"][0] + out["fc"][0]) and out["sum"][1] == pytest.approx(out["fa"][1] + out["fc"][1])
    assert out["sum"][0] > 0 and out["sum"][1] > 0  # pushed away from +a (right), pulled toward -c (down)
    assert out["F"][0] == pytest.approx(2e-6 * out["E"][0]) and out["F"][1] == pytest.approx(2e-6 * out["E"][1])  # F = qE
    assert out["Vp"] == pytest.approx(2 * out["k"] * 5e-6 / 1)  # V = sum of kQ/r (a scalar)


def test_hero_obeys_coulomb_and_friction():
    out = run("""
const ws = V.makeState(0); ws.sources = [{ x: 30, y: 24.5, q: -120e-6 }]; ws.circles = [];
const near = V.newHero(28.5, 24.5, 1); for (let i = 0; i < 60; i++) V.heroStep(near, {}, ws, 1 / 120);   // 1.5 m: F > mu m g
const far = V.newHero(25, 24.5, 1); for (let i = 0; i < 60; i++) V.heroStep(far, {}, ws, 1 / 120);       // 5 m: static friction holds
const rep = V.newHero(28.5, 24.5, -1); for (let i = 0; i < 60; i++) V.heroStep(rep, {}, ws, 1 / 120);
console.log(JSON.stringify({ near: near.x - 28.5, far: far.x - 25, rep: rep.x - 28.5, F: near.F }));""")
    assert out["near"] > 0.05  # attracted toward the opposite pylon
    assert out["far"] == 0  # 0.97 N < mu m g = 3.1 N: the hero stays put
    assert out["rep"] < -0.05  # same sign: pushed away


def test_charged_crate_can_be_pushed_onto_the_plate_through_the_glass():
    out = run("""
const ws = V.makeState(0), c = Object.assign({ vx: 0, vy: 0 }, V.CRATES[0]);
const start = V.onPlate(c);
for (const [hx, hy] of [[36.6, 30.65], [34.65, 34.4]]) { const hero = [{ x: hx, y: hy, q: -V.HERO.q }]; for (let t = 0; t < 3; t += 1 / 120) V.crateStep(c, hero, ws, 1 / 120); }
console.log(JSON.stringify({ start: !!start, end: !!V.onPlate(c), heroOutside: !ws.solidTile(36, 30) && ws.solidTile(36, 31) }));""")
    assert out == {"start": False, "end": True, "heroOutside": True}


def test_capacitor_charge_energy_and_combinations():
    out = run("""
const r = V.CAP.rounds;
const q = V.capCheck(r[0], 0, 12);                       // 470 µF at 12 V
const series = V.capC(r[2], 0), parallel = V.capC(r[2], 1);
let Vt = 0; const C = 470e-6, R = 4700; for (let i = 0; i < 1000; i++) Vt = V.capCharge(Vt, 20, R, C, R * C / 1000);
const wins = r.map(R => { const w = []; for (let o = 0; o < V.capOptions(R); o++) w.push(V.capWindow(R, o)); return w; });
const ok = r.map(R => { let best = null; for (let o = 0; o < V.capOptions(R); o++) { const v = V.capNeedV(R, o); if (v < R.Vs && (!R.vmax || v <= R.vmax)) best = V.capCheck(R, o, v).ok; } return best; });
const over = V.capCheck(r[1], 0, V.capNeedV(r[1], 0));
console.log(JSON.stringify({ q, series, parallel, Vt, wins, ok, over }));""")
    assert out["q"]["q"] == pytest.approx(470e-6 * 12)  # q = CV = 5.64 mC
    assert out["q"]["E"] == pytest.approx(0.5 * 470e-6 * 144)  # U = ½CV² = 33.8 mJ
    assert out["q"]["ok"] is True
    assert out["series"] == pytest.approx(1 / (1 / 220e-6 + 1 / 330e-6)) and out["parallel"] == pytest.approx(550e-6)
    assert out["Vt"] == pytest.approx(20 * (1 - 2.718281828 ** -1), rel=1e-3)  # one time constant: 63.2 %
    assert all(out["ok"]), "every capacitor round has a valid option"
    assert all(max(w) >= 0.15 for w in out["wins"]), out["wins"]  # a human can stop inside the window
    assert out["over"]["ok"] is False  # 1000 µF would need 16.4 V, above the 12 V rating


def test_equipotential_mazes_solvable_and_need_energy():
    out = run("""
console.log(JSON.stringify(V.EQUI.levels.map(L => ({ path: V.eqSolve(L), poorer: V.eqSolve(Object.assign({}, L, { battery: L.battery - 1 })),
  w: V.EQUI.qProbe * L.step, ring: [V.eqBand(L, L.charges[0].c + 2, L.charges[0].r), V.eqBand(L, L.charges[0].c, L.charges[0].r + 2)] }))));""")
    for lv in out:
        assert lv["path"], "maze is solvable"
        assert lv["poorer"] is None, "maze needs the stored energy (W = qΔV is not free)"
    assert out[0]["ring"][0] == out[0]["ring"][1]  # equipotentials of a single point charge are circles
    assert out[0]["w"] == pytest.approx(2e-6 * 250)  # W = qΔV = 0.5 mJ per band


def test_electroscope_rounds():
    out = run("""
console.log(JSON.stringify({ sol: V.SCOPE.rounds.filter(r => !r.quiz).map(r => V.scopeSolve(r)),
  idle: V.SCOPE.rounds.filter(r => !r.quiz).map(r => V.scopeDone(V.scopeNew(r), r)),
  quiz: [1, -1].map(rod => { const s = V.scopeNew(V.SCOPE.rounds[3]); const before = Math.abs(V.scopeDist(s, rod).leaves); return Math.abs(V.scopeDist(V.scopeAct(s, rod, 'near').s, rod).leaves) > before; }),
  contactSign: (() => { let s = V.scopeNew(V.SCOPE.rounds[0]); for (const a of ['near', 'touch', 'away']) s = V.scopeAct(s, -1, a).s; return Math.sign(s.N); })(),
  inductionSign: (() => { let s = V.scopeNew(V.SCOPE.rounds[1]); for (const a of ['near', 'ground', 'unground', 'away']) s = V.scopeAct(s, -1, a).s; return Math.sign(s.N); })() }));""")
    assert all(out["sol"]) and not any(out["idle"])
    assert out["sol"][1] == ["near", "ground", "unground", "away"]  # induction needs the earth step
    assert out["contactSign"] == -1 and out["inductionSign"] == 1  # contact keeps the rod's sign, induction the opposite
    assert out["quiz"] == [True, False]  # same-sign rod spreads the leaves further, opposite closes them


def test_storm_wave_needs_rods_and_can_be_won():
    out = run("""
const n = V.TD.pads.length, sets = []; for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) sets.push([a, b, c]);
console.log(JSON.stringify({ none: V.tdRun([]).won, wins: sets.filter(s => V.tdRun(s).won).length, total: sets.length,
  unguarded: sets.filter(s => s.every(i => Math.hypot(V.TD.pads[i][0] - V.TD.gen[0], V.TD.pads[i][1] - V.TD.gen[1]) > V.TD.protectR)).some(s => V.tdRun(s).won) }));""")
    assert out["none"] is False
    assert out["wins"] >= 1 and out["wins"] < out["total"]  # placement matters
    assert out["unguarded"] is False  # a rod must protect the generator from lightning


def test_every_crossing_flies_and_no_district_is_unreachable():
    out = run("""
const res = {};
for (let k = 0; k <= 6; k++) {
  const r = V.reachable(k, { open: { 'gate:36,38': true } });
  res[k] = { consoles: V.CONSOLES.filter(c => r.seen[Math.floor(c.x) + ',' + Math.floor(c.y)]).map(c => c.id), landed: Object.keys(r.landed),
    back: Object.values(r.landed).every(l => l.area) };
}
const crossings = V.CROSSINGS.map(c => { const l = V.flyCrossing(c, V.makeState(5)); return [c.id, l.area, c.to, l.fell]; });
const r6 = V.reachable(6, { open: { 'gate:36,38': true } });
const crystals = V.CRYSTALS.filter(c => !r6.seen[Math.floor(c[0]) + ',' + Math.floor(c[1])]);
const solidStart = V.makeState(0).solidTile(Math.floor(V.START[0]), Math.floor(V.START[1]));
console.log(JSON.stringify({ res, crossings, crystals, solidStart }));""")
    assert out["solidStart"] is False
    for cid, area, want, fell in out["crossings"]:
        assert not fell and area == want, (cid, area, want)
    need = {"relay": ["relayA", "relayB"], "docks": ["cap"], "gardens": ["equi"], "heights": ["td"], "quarter": ["scope"], "tower": ["boss"]}
    order = ["relay", "docks", "gardens", "heights", "quarter", "tower"]
    for k, d in enumerate(order):  # with k districts restored, district k+1's challenges are reachable
        assert set(need[d]) <= set(out["res"][str(k)]["consoles"]), (d, out["res"][str(k)])
    assert not out["crystals"], "every charge crystal can be reached"
    assert "cap" not in out["res"]["0"]["consoles"] and "boss" not in out["res"]["4"]["consoles"]  # gates really gate


def test_districts_and_stages():
    out = run("console.log(JSON.stringify(V.DISTRICTS.map(d => [d.id, d.stage, d.song])))")
    assert [d[1] for d in out] == [1, 2, 3, 4, 5, 6]  # MAX_STAGE["volt-city"] must be 6
    assert len({tuple(d[2]) for d in out}) == 6  # every district has its own music seed/style


def test_game_script_parses_and_uses_shared_physics():
    src = (ROOT / "static/js/games/fieldbound.js").read_text()
    assert subprocess.run(["node", "--check", str(ROOT / "static/js/games/fieldbound.js")], capture_output=True).returncode == 0
    assert "V.heroStep" in src and "V.coulomb" in src and 'A.report("volt-city"' in src and "api.reduce" in src


# ---------------- the Outer Ring, the ladder and the sandbox (static/js/games/voltlab.js) ----------------
LAB = ROOT / "static/js/games/voltlab.js"
SIM = ROOT / "static/js/games/fieldsim.js"


def lab(body):
    script = "require(process.argv[2]); const L = require(process.argv[1]);\n" + body
    res = subprocess.run(["node", "-e", script, str(LAB), str(SIM)], capture_output=True, text=True, timeout=240)
    assert res.returncode == 0, res.stderr
    return json.loads(res.stdout)


def test_magnetic_force_turns_without_changing_speed():
    out = lab("""const lv = {src: [0, 3], dir: [1, 0], dst: [99, 99], walls: [], fixed: [{c: 1, r: 3, s: 1}, {c: 2, r: 3, s: 1}, {c: 1, r: 2, s: 1}, {c: 2, r: 2, s: 1}, {c: 1, r: 1, s: 1}, {c: 2, r: 1, s: 1}]};
    let speeds = [], pts = []; L.magSimulate(lv, [], (p) => { speeds.push(Math.hypot(p.vx, p.vy)); if (p.x > 0.1 && p.x < 0.3 && p.y > 0.1 && p.y < 0.35) pts.push([p.x, p.y]); });
    // the arc inside the field: its centre sits r above the entry point (0.1, 0.35) for a + charge in an "into" field
    const r = L.MAG.r, cx = 0.1, cy = 0.35 - r, d = pts.map(q => Math.hypot(q[0] - cx, q[1] - cy));
    console.log(JSON.stringify({vmin: Math.min(...speeds), vmax: Math.max(...speeds), r, dmin: Math.min(...d), dmax: Math.max(...d), up: pts.length && pts[pts.length - 1][1] < 0.35}))""")
    assert abs(out["r"] - 1e-7 * 1.5 / (2e-6 * 0.5)) < 1e-12
    assert out["vmax"] - out["vmin"] < 1e-9  # F = qv x B does no work
    assert out["up"] and out["dmax"] - out["r"] < 0.004 and out["r"] - out["dmin"] < 0.004  # a circle of radius mv/(qB)


def test_capacitor_circuit_gauss_and_selector_formulas():
    out = lab("""const p = {A: 0.02, V: 100}; const C = L.dielC(p, 3, 2); const bad = L.dielCheck({A: 0.02, V: 4000, C: L.dielC({A: 0.02}, 0, 0), tol: 0.05}, [0, 0]);
    const ohm = L.ohmCheck({emf: 12, RL: 100, I: 12 / (100 + 22 + 47), Pmax: 0.5, tol: 0.01}, [1, 3, "ser"]);
    const par = L.ohmNet([5, 5, "par"]) , g = L.gaussFlux({charges: [{x: .5, y: .5, q: 2e-9}, {x: .52, y: .45, q: -1e-9}, {x: .95, y: .9, q: 5e-9}], loop: [[.3, .3], [.7, .3], [.7, .7], [.3, .7]]});
    const sel = L.selCheck({v: 500 / 0.01 / 0.05}, [4, 4]);
    console.log(JSON.stringify({C, bad: bad.ok, why: bad.why, ohm: ohm.ok, par, g, sel: sel.ok}))""")
    assert abs(out["C"] - 3.7 * 8.854e-12 * 0.02 / 0.2e-3) < 1e-15  # C = k e0 A / d
    assert out["bad"] is False and "breaks down" in out["why"]  # 4000 V over 0.05 mm of air is 80 MV/m
    assert out["ohm"] and abs(out["par"] - 50) < 1e-9  # two 100 ohm in parallel = 50 ohm
    assert abs(out["g"] - 1e-9 / 8.854e-12) < 1  # only the enclosed +2 nC and -1 nC count
    assert out["sel"]  # v = E/B = (500 V / 1 cm) / 0.05 T = 1e6 m/s


def test_every_outer_ring_puzzle_is_solvable_and_needs_the_player():
    out = lab("""const res = []; L.OUTER.forEach(d => d.puzzles.forEach((s, i) => { const p = L.make(s); const r = p ? L.check(p, p.solution) : {ok: false};
      let bare = null; if (p && (p.kind === 'probe' || p.kind === 'mag')) bare = L.check(p, []).ok;
      let n = null; if (p && p.kind === 'diel') n = L.dielSolve(p).length; if (p && p.kind === 'ohm') n = L.ohmSolve(p).length; if (p && p.kind === 'sel') n = L.selSolve(p).length;
      res.push([d.stage, d.id, i, p ? p.kind : null, r.ok, bare, n, !!s.boss]); }));
      console.log(JSON.stringify(res))""")
    assert [r[0] for r in out if r[2] == 0] == [7, 8, 9, 10, 11, 12]
    for stage, did, i, kind, ok, bare, n, boss in out:
        assert kind and ok, (did, i, kind)
        assert bare in (None, False), (did, i)  # the field the player builds is what gets the charge home
        assert n is None or 1 <= n <= 3, (did, i, n)  # few enough right answers that you have to reason
    assert all(sum(1 for r in out if r[1] == d and r[7]) == 1 for d in {r[1] for r in out})  # one boss per district
    assert len({r[3] for r in out}) == 7  # every puzzle kind appears in the Ring


def test_ladder_is_endless_deterministic_and_gets_harder():
    out = lab("""const rows = []; for (let n = 1; n <= 140; n++) { const p = L.ladder(n); rows.push([n, p ? p.kind : null, p ? L.check(p, p.solution).ok : false, p && p.give ? p.give : null, p && p.walls ? p.walls.length : null, p && p.tol ? p.tol : null]); }
      const a = JSON.stringify(L.ladder(37)), b = JSON.stringify(L.ladder(37));
      console.log(JSON.stringify({rows, same: a === b, reward: [L.ladderReward(1), L.ladderReward(80)]}))""")
    assert out["same"]
    for n, kind, ok, give, walls, tol in out["rows"]:
        assert kind and ok, (n, kind)
    boards = [r for r in out["rows"] if r[1] == "probe"]
    assert boards[0][3] <= boards[-1][3] and boards[0][4] < boards[-1][4]  # more charges and walls further up
    assert out["reward"][1] > out["reward"][0]


def test_game_uses_the_lab_and_dialogs_cannot_dead_end():
    src = (ROOT / "static/js/games/fieldbound.js").read_text()
    assert src.count("api.show(") == 1  # every dialog goes through dlg(), which resumes after Settings/Pause replace it
    assert "S.after" in src and "VL.make" in src and "VL.ladder" in src and "openSandbox" in src and "openUpgrades" in src
    assert src.count("api.settings.add(") >= 2 and "Volt City options" not in src  # options live in the shared Settings screen
    cat = (ROOT / "games/catalogue.py").read_text()
    assert '"fieldsim", "voltworld", "voltlab"' in cat  # loaded by the page (and the offline package), not injected
