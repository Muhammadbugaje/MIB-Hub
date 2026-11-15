"""Wavefront (side-scrolling run-and-gun, PHYS 124 / PHYS 122): wave physics and stage data, checked in Node.

No database or `world` fixture: these tests only run static/js/games/shooterdata.js (UMD) through Node."""
import json
import math
import shutil
import subprocess
from pathlib import Path

import pytest

JS = Path(__file__).resolve().parents[2] / "static/js/games"
node = pytest.mark.skipif(not shutil.which("node"), reason="node not installed")

# attack names implemented by the boss engine in shooter.js
ATTACKS = {"fan", "aim", "slam", "lob", "summon", "mines", "sweep", "rain", "bombs", "heads", "spectrum", "ring", "disorder", "charge"}


def run_node(code):
    res = subprocess.run(["node", "-e", code], capture_output=True, text=True, timeout=120, cwd=JS)
    assert res.returncode == 0, res.stderr
    return json.loads(res.stdout)


@node
def test_scripts_parse():
    for f in ("shooter.js", "shooterdata.js"):
        res = subprocess.run(["node", "--check", f], capture_output=True, text=True, cwd=JS)
        assert res.returncode == 0, res.stderr
    src = (JS / "shooter.js").read_text()
    assert 'A.report("wavefront"' in src                                       # results reach the server
    assert "useActions(TOUCH)" in src and "API.reduce" in src                  # phone buttons, reduced motion


@node
def test_wave_relations_c_f_lambda_and_photon_energy():
    out = run_node("""const D=require('./shooterdata.js');
console.log(JSON.stringify(D.FREQS.map(f=>({f, nm:D.nm(f), lam:D.lambda(f), ev:D.photonEV(f), k:D.damageFactor(f), px:D.drawnLambda(f)}))))""")
    for row in out:
        assert row["f"] * row["lam"] == pytest.approx(2.998e8, rel=1e-9)        # c = fλ
        assert 380 <= row["nm"] <= 750                                          # visible light only
        assert row["ev"] == pytest.approx(6.626e-34 * row["f"] / 1.602e-19)     # E = hf
        assert row["k"] == pytest.approx(row["f"] / 5e14)                       # damage ∝ hf
        assert row["px"] == pytest.approx(row["nm"] * 0.06)                     # drawn wave keeps the ratio
    nms = [r["nm"] for r in out]
    assert nms == sorted(nms, reverse=True)                                     # higher f, shorter λ


@node
def test_grating_angles_follow_d_sin_theta_equals_n_lambda():
    out = run_node("""const D=require('./shooterdata.js');
const res=[]; D.WEAPONS.spread.d.forEach(d=>D.FREQS.forEach(f=>{const lam=D.lambda(f); res.push({d,lam,orders:D.gratingAngles(lam,d,2)});}));
console.log(JSON.stringify({res, red:D.gratingAngles(697e-9,1.1e-6,2).map(o=>o.n)}))""")
    for row in out["res"]:
        d, lam = row["d"], row["lam"]
        got = {o["n"]: o["theta"] for o in row["orders"]}
        for n in range(-2, 3):
            s = n * lam / d
            if abs(s) > 1:
                assert n not in got                                             # impossible orders omitted
            else:
                assert got[n] == pytest.approx(math.asin(s), abs=1e-12)         # θ = asin(nλ/d)
                assert d * math.sin(got[n]) == pytest.approx(n * lam, rel=1e-9, abs=1e-18)
        assert got[0] == 0
    assert out["red"] == [-1, 0, 1]                                             # 697 nm on 1.1 µm: n = ±2 do not exist


@node
def test_malus_law_and_unpolarised_light():
    out = run_node("""const D=require('./shooterdata.js'); const r=[];
for(let a=0;a<180;a+=15) for(const p of [0,45,90,135]) r.push({a,p,t:D.transmit(a,p)});
console.log(JSON.stringify({r, un:D.transmit(30,null), m:[0,0.3,1,Math.PI/2].map(t=>D.malus(t))}))""")
    for row in out["r"]:
        assert row["t"] == pytest.approx(math.cos(math.radians(row["a"] - row["p"])) ** 2, abs=1e-12)  # I = I₀cos²θ
    assert out["un"] == 0.5
    assert out["m"] == pytest.approx([1, math.cos(0.3) ** 2, math.cos(1) ** 2, 0], abs=1e-12)


@node
def test_double_slit_fringes_y_equals_n_lambda_L_over_d():
    out = run_node("""const D=require('./shooterdata.js'); const d=D.WEAPONS.lance.slit, rows=[];
for(const f of D.FREQS) for(const L of [200,400,620]) for(let n=-3;n<=3;n++){const lam=D.lambda(f), y=D.fringeY(n,lam,L,d);
 rows.push({n,lam,L,d,y,bright:D.fringeI(y,lam,L,d),dark:D.fringeI(D.fringeY(n+0.5,lam,L,d),lam,L,d)});}
console.log(JSON.stringify(rows))""")
    for r in out:
        assert r["y"] == pytest.approx(r["n"] * r["lam"] * r["L"] / r["d"], rel=1e-12, abs=1e-12)
        assert r["bright"] == pytest.approx(1, abs=1e-9)                       # bright fringe
        assert r["dark"] == pytest.approx(0, abs=1e-9)                         # dark halfway between
    spacing = 600e-9 * 400 / 4e-6
    assert spacing == pytest.approx(60)                                        # the worked example on the concept card


@node
def test_emp_inverse_square_and_spin_gravity():
    out = run_node("""const D=require('./shooterdata.js'); console.log(JSON.stringify({a:D.empFactor(40,40),b:D.empFactor(80,40),c:D.empFactor(120,40),g:D.spinG(0.5,20)}))""")
    assert out["a"] == 1 and out["b"] == pytest.approx(0.25) and out["c"] == pytest.approx(1 / 9)
    assert out["g"] == pytest.approx(0.5 ** 2 * 20)


@node
def test_stages_are_complete_and_ordered():
    out = run_node("""const D=require('./shooterdata.js');
console.log(JSON.stringify({bosses:Object.keys(D.BOSSES), mids:Object.keys(D.MIDS), enemies:Object.keys(D.ENEMIES), weapons:Object.keys(D.WEAPONS), filters:Object.keys(D.FILTERS),
 stages:D.STAGES.map((s,k)=>{const b=D.build(k); return {name:s.name, songs:[s.song[0],s.bossSong[0]], len:b.len, spawns:b.spawns.map(o=>[o.x,o.k,o.drop||null,o.filter||null]),
  events:b.events.map(e=>[e.t,e.x,e.boss||null,(e.waves||[]).map(w=>w[0])]), boss:b.boss, finish:b.finish, secrets:b.secrets, items:b.items.length,
  bad:b.solids.concat(b.props).filter(q=>!(q.w>0&&q.h>0)).length, bands:b.bands.length, again:JSON.stringify(D.build(k).spawns)===JSON.stringify(b.spawns)};})}))""")
    st = out["stages"]
    assert len(st) >= 7                                                          # MAX_STAGE for wavefront
    assert len({s["songs"][0] for s in st} | {s["songs"][1] for s in st}) == 2 * len(st)  # unique stage + boss tracks
    for s in st:
        xs = [sp[0] for sp in s["spawns"]]
        assert xs and all(b > a for a, b in zip(xs, xs[1:])), s["name"]          # spawns in increasing x order
        assert all(sp[1] in out["enemies"] for sp in s["spawns"])
        assert all(sp[2] is None or sp[2] in out["weapons"] for sp in s["spawns"])
        assert all(sp[3] is None or sp[3] in out["filters"] for sp in s["spawns"])
        assert s["boss"] and s["boss"]["kind"] in out["bosses"]                  # a boss
        assert s["boss"]["x"] < s["finish"] <= s["len"]                          # and a finish after it
        kinds = [e[0] for e in s["events"]]
        assert "mid" in kinds and kinds.count("boss") == 1                        # mid-boss + multi-phase boss
        assert all(e[2] in out["mids"] for e in s["events"] if e[0] == "mid")
        assert all(w in out["enemies"] for e in s["events"] for w in e[3])
        assert s["secrets"] >= 1 and s["items"] >= s["secrets"]
        assert s["bad"] == 0 and s["bands"] > 0 and s["again"]                  # deterministic, no empty boxes
        assert 9000 <= s["len"] <= 16000                                          # long stages
        assert any(sp[2] for sp in s["spawns"])                                   # weapon carriers
    themes = {e[0] for s in st for e in s["events"]}
    assert {"arena", "mid", "boss", "lift", "scroll"} <= themes                    # set pieces: elevator, auto-scroll


@node
def test_enemy_and_weapon_numbers_are_sane():
    out = run_node("""const D=require('./shooterdata.js'); console.log(JSON.stringify({E:D.ENEMIES,W:D.WEAPONS,M:D.MIDS,B:D.BOSSES,S:D.STAGES.map(s=>s.secs.map(x=>x[0]))}))""")
    for k, e in out["E"].items():
        assert e["hp"] > 0, k                                                     # no zero-HP enemies
        assert 0 <= e["rate"] <= 5 and math.isfinite(e["rate"]), k               # finite fire rates
        assert e["w"] > 0 and e["h"] > 0 and e["score"] > 0
    for k, w in out["W"].items():
        for r in w.get("rate", []):
            assert 0 < r <= 20, k                                                 # no infinite fire rates
        assert all(v > 0 for v in w.get("dmg", [1]))
    assert out["W"]["sine"]["speed"] > 0 and out["W"]["spread"]["weights"] == sorted(out["W"]["spread"]["weights"], reverse=True)
    for table in (out["M"], out["B"]):
        for k, b in table.items():
            assert b["hp"] and all(h > 0 for h in b["hp"]), k
            assert len(b["phases"]) == len(b["hp"]), k
            for ph in b["phases"]:
                assert ph["every"] >= 0.5 and ph["att"]                           # bosses cannot fire endlessly fast
                assert {a[0] for a in ph["att"]} <= ATTACKS, k
    assert all(len(b["hp"]) >= 2 for b in out["B"].values())                     # every stage boss is multi-phase
    secs = {s for st in out["S"] for s in st}
    assert {"run", "climb", "lift", "falls", "maze", "roof", "space"} <= secs    # varied stages
