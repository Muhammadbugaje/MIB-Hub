"""Light Bender, Circuit Forge and Logic Labyrinth: the expanded puzzle games.

Every level is re-proved here with the games' own solvers (exhaustive searches), and the physics/logic engines are
checked against formulas computed independently in Python."""
import json
import math
import shutil
import subprocess
from pathlib import Path

import pytest

from games import catalogue as C
from games import progress as P

JS = Path(__file__).resolve().parents[2] / "static/js/games"
pytestmark = pytest.mark.skipif(not shutil.which("node"), reason="node not installed")


def run_node(code):
    res = subprocess.run(["node", "-e", code], capture_output=True, text=True, timeout=900, cwd=JS)
    assert res.returncode == 0, res.stderr
    return json.loads(res.stdout.strip().splitlines()[-1])


# ---------------------------------------------------------------- Light Bender
OPT = "const O=require('./opticsim.js'); require('./bender-levels.js');"


def test_light_bender_levels_are_solvable_with_exact_par():
    out = run_node(OPT + """
const rows=O.LEVELS.map((L,i)=>{const r=O.solve(L); return {i, name:L.name, ch:L.ch, count:r.count, par:r.par, stated:L.par==null?null:L.par,
  start:O.trace(L).all, kinds:{split:L.mirrors.some(m=>m.type==='split'), glass:!!(L.blocks||[]).length, prism:!!(L.prisms||[]).length, lens:!!(L.lenses||[]).length, filter:!!(L.filters||[]).length}};});
console.log(JSON.stringify({rows, chapters:O.CHAPTERS.map(c=>c.id), last:O.LEVELS[O.LEVELS.length-1].name}))""")
    rows = out["rows"]
    assert len(rows) >= 40
    assert [r["ch"] for r in rows] == sorted(r["ch"] for r in rows)            # chapters in order
    assert out["last"] == "Count Entropy's hall of mirrors"
    for r in rows:
        assert r["count"] >= 1 and not r["start"], r["name"]                    # solvable, not solved at the start
        if r["stated"] is not None:
            assert r["stated"] == r["par"], r["name"]                           # baked par is the true minimum
    by = {}
    for r in rows:
        by.setdefault(r["ch"], []).append(r)
    ids = out["chapters"]
    first = {k: min(r["ch"] for r in rows if r["kinds"][k]) for k in ("split", "glass", "prism", "lens", "filter")}
    assert first["split"] == ids.index("split") and first["glass"] == ids.index("glass")   # each element arrives in its own chapter
    assert first["prism"] == ids.index("prism") and first["lens"] == ids.index("lens") and first["filter"] == ids.index("colour")
    assert P.MAX_STAGE["light-bender"] == len(rows) == P.FINAL["light-bender"][1]
    assert "bender-levels" in C.BY_SLUG["light-bender"].extra["deps"]


def test_optics_physics():
    out = run_node(OPT + """
const lens={src:{x:100,y:200,ang:0},mirrors:[],lenses:[{x:400,y:270,len:300,ang:90,f:150}],targets:[],walls:[]};
const t1=O.trace(lens), s=t1.segs[1];   // after the lens: where does the ray cross the axis y = 270?
const k=(270-s[1])/(s[3]-s[1]), cross=s[0]+(s[2]-s[0])*k;
const glass={src:{x:100,y:100,ang:20},mirrors:[],blocks:[{x:200,y:0,w:300,h:540,n:2.42}],targets:[],walls:[]};
const e=O.trace(glass).events[0];
const tirL={src:{x:100,y:300,ang:0},mirrors:[],prisms:[{n:1.5,pts:[[300,200],[500,400],[300,400]]}],targets:[],walls:[]};
const tir=O.trace(tirL).events.some(v=>v.kind==='tir');
const split={src:{x:100,y:270,ang:0},mirrors:[{x:400,y:270,len:80,ang:45,type:'split'}],targets:[{x:800,y:270,r:20},{x:400,y:520,r:20}],walls:[]};
const sp=O.trace(split);
const filt={src:{x:100,y:270,ang:0,col:7},mirrors:[],filters:[{x:400,y:270,len:80,ang:90,col:1}],targets:[{x:800,y:270,r:20,col:1}],walls:[]};
const filt2=Object.assign({},filt,{targets:[{x:800,y:270,r:20,col:2}]});
const daily=['2026-11-14','2026-12-25','2027-01-01'].map(d=>{const L=O.daily(d), L2=O.daily(d); return {ok:!!L, same:JSON.stringify(L)===JSON.stringify(L2), count:L?O.solve(L).count:0, start:L?O.trace(L).all:true};});
console.log(JSON.stringify({cross, inc:e.inc, ref:e.ref, tir, split:sp.all, f1:O.trace(filt).all, f2:O.trace(filt2).all, daily}))""")
    assert out["cross"] == pytest.approx(400 + 150, rel=1e-3)  # a ray parallel to the axis crosses it one focal length (150) past the lens
    assert math.sin(math.radians(out["inc"])) == pytest.approx(2.42 * math.sin(math.radians(out["ref"])), rel=1e-6)          # Snell, diamond
    assert out["tir"]                                         # 45° inside n = 1.5 glass exceeds the 41.8° critical angle
    assert out["split"]                                       # a splitter lights both receivers
    assert out["f1"] and not out["f2"]                        # a red filter feeds a red receiver, never a green one
    for d in out["daily"]:
        assert d["ok"] and d["same"] and d["count"] >= 1 and not d["start"]


# ---------------------------------------------------------------- Circuit Forge
CF = "const C=require('./circuitsim.js'); ['100','200','300','400','500'].forEach(l=>require('./circuit-'+l+'.js'));"


def test_every_circuit_has_exactly_one_answer():
    out = run_node(CF + """
const res=C.LEVELS.map(L=>{const s=C.solutions(L), sets=new Set(s.map(f=>Object.values(f).map(v=>JSON.stringify(v)).sort().join('+')));
  return {name:L.name, level:L.level, sets:sets.size, empty:C.check(L,{}).ok, goals:L.goals.length, explain:!!L.explain};});
console.log(JSON.stringify(res))""")
    assert len(out) >= 50
    assert [r["level"] for r in out] == sorted(r["level"] for r in out)
    for r in out:
        assert r["sets"] == 1 and not r["empty"], r["name"]
    lv = [r["level"] for r in out]
    assert P.STAGE_LEVEL["circuit-forge"] == lv and P.MAX_STAGE["circuit-forge"] == len(out) == P.FINAL["circuit-forge"][1]
    assert "circuit-100" in C.BY_SLUG["circuit-forge"].extra["deps"]


def test_circuit_physics_matches_the_formulas():
    out = run_node(CF + """
const n3=[[0,0],[0,0],[0,0]];
const rc={nodes:n3,f:1000,els:[{k:'E',a:1,b:0,E:1,r:1e-6},{k:'R',a:1,b:2,R:1600},{k:'C',a:2,b:0,C:100e-9}],goals:[{what:'gain',a:2,b:0,src:0,lo:0,hi:9},{what:'tau',el:2,lo:0,hi:9}],tray:[]};
const rl={nodes:n3,f:50,els:[{k:'E',a:1,b:0,E:230,r:1e-6},{k:'R',a:1,b:2,R:20},{k:'L',a:2,b:0,L:0.05}],goals:[{what:'pf',el:0,lo:0,hi:9},{what:'Iac',el:1,lo:0,hi:99}],tray:[]};
const led={nodes:n3,els:[{k:'E',a:1,b:0,E:9,r:1e-6},{k:'R',a:1,b:2,R:330},{k:'D',a:2,b:0,Vf:2,rd:10}],goals:[{what:'I',el:2,lo:0,hi:9}],tray:[]};
const off={nodes:n3,els:[{k:'E',a:1,b:0,E:1.5,r:1e-6},{k:'R',a:1,b:2,R:330},{k:'D',a:2,b:0,Vf:2,rd:10}],goals:[{what:'I',el:2,lo:0,hi:9}],tray:[]};
const op=(kind,rin,rf,vin)=>{const l=C.opamp(kind,{k:'E',E:vin,r:1e-3,role:'cell'},{k:'R',R:rin,role:'fixed'},{k:'R',R:rf,role:'fixed'}); return C.check({nodes:l.nodes,els:l.els,goals:[{what:'V',a:3,b:0,lo:-99,hi:99}],tray:[]},{}).values[0];};
const req=C.reqBetween(4,[{k:'R',a:0,b:1,R:4},{k:'R',a:1,b:2,R:8},{k:'R',a:1,b:2,R:24},{k:'R',a:2,b:3,R:0}],0,3);
const days=['2026-11-14','2026-12-25','2027-01-01','2027-03-03'].map(d=>{const L=C.daily(d); return {ok:!!L, n:L?C.solutions(L).length:0, start:L?C.check(L,{}).ok:true};});
console.log(JSON.stringify({rc:C.check(rc,{}).values, rl:C.check(rl,{}).values, led:C.check(led,{}).values[0], off:C.check(off,{}).values[0],
  inv:op('inv',1000,10000,0.5), non:op('non',1000,9000,0.5), req, days}))""")
    w = 2 * math.pi * 1000
    assert out["rc"][0] == pytest.approx(1 / math.sqrt(1 + (w * 1600 * 100e-9) ** 2), rel=1e-4)   # |Vc/Vin| of an RC low-pass
    assert out["rc"][1] == pytest.approx(1600 * 100e-9, rel=1e-4)                               # τ = RC
    z = complex(20, 2 * math.pi * 50 * 0.05)
    assert out["rl"][0] == pytest.approx(20 / abs(z), rel=1e-4) and out["rl"][1] == pytest.approx(230 / abs(z), rel=1e-4)
    assert out["led"] == pytest.approx(7 / 340, rel=1e-4) and out["off"] == pytest.approx(0, abs=1e-9)   # LED on above Vf, off below
    assert out["inv"] == pytest.approx(-5, rel=1e-3) and out["non"] == pytest.approx(5, rel=1e-3)        # −Rf/Rin and 1 + Rf/R1
    assert out["req"] == pytest.approx(4 + 8 * 24 / 32, rel=1e-6)
    for d in out["days"]:
        assert d["ok"] and 1 <= d["n"] <= 2 and not d["start"]


# ---------------------------------------------------------------- Logic Labyrinth daily room
def test_logic_daily_rooms_are_fair():
    out = run_node("""const S=require('./logicsim.js');
const days=['2026-11-14','2026-12-25','2027-01-01','2027-02-02','2027-06-30'].map(d=>{const L=S.daily(d), L2=S.daily(d), r=S.solve(L);
  return {same:JSON.stringify(L)===JSON.stringify(L2), count:r.count, par:r.par, stated:L.par, start:S.check(L,S.blank(L)).ok, hints:L.hints.length};});
console.log(JSON.stringify(days))""")
    for d in out:
        assert d["same"] and 1 <= d["count"] <= 2 and d["par"] == d["stated"] >= 2 and not d["start"] and d["hints"] == 3


def test_scripts_parse():
    for f in ("opticsim.js", "bender-levels.js", "bender.js", "circuitsim.js", "circuit-100.js", "circuit-200.js", "circuit-300.js",
              "circuit-400.js", "circuit-500.js", "forge.js", "logicsim.js", "logic-300.js", "logic-400.js", "logic.js"):
        res = subprocess.run(["node", "--check", str(JS / f)], capture_output=True, text=True)
        assert res.returncode == 0, (f, res.stderr)
