"""Second batch: Induction Dash, Circuit Forge (100–500 level chapters), Light Bender."""
import json
import shutil
import subprocess
from pathlib import Path

import pytest
from django.urls import reverse

from games import progress as P
from memos.tests.helpers import as_user, set_setting, world  # noqa: F401

JS = Path(__file__).resolve().parents[2] / "static/js/games"
node = pytest.mark.skipif(not shutil.which("node"), reason="node not installed")


def run_node(code):
    res = subprocess.run(["node", "-e", code], capture_output=True, text=True, timeout=600, cwd=JS)
    assert res.returncode == 0, res.stderr
    return json.loads(res.stdout)


@pytest.fixture
def on(world):
    set_setting("features.games", True)
    return world


@node
def test_induction_physics_is_consistent():
    out = run_node("""const I=require('./inductionsim.js'), P=I.P, v=14;
console.log(JSON.stringify({emf:I.emf(v), E:I.energy(v), work:(P.B*P.B*P.L*P.L*v/P.R)*P.d, mvdv:P.m*v*I.dv(),
 stages:I.STAGES.map(s=>({target:s.target, pot:I.potential(s, I.CRUISE)}))}))""")
    assert out["emf"] == pytest.approx(2 * 1 * 14)                 # ε = BLv
    assert out["E"] == pytest.approx(out["work"])                 # E = F d
    assert out["E"] == pytest.approx(out["mvdv"])                 # equals kinetic energy lost (first order)
    for s in out["stages"]:
        assert s["target"] <= 0.65 * s["pot"]                     # reachable without collecting every coil


@node
def test_every_circuit_level_has_a_unique_answer():
    out = run_node("""const C=require('./circuitsim.js'); ['100','200','300','400','500'].forEach(l=>require('./circuit-'+l+'.js'));
const res=C.LEVELS.map(L=>{const slots=L.els.map((e,i)=>e.role==='slot'?i:-1).filter(i=>i>=0), sols=new Set();
 const rec=(k,fill,used)=>{if(k===slots.length){if(C.check(L,fill).ok)sols.add(slots.map(s=>fill[s]).sort().join('+'));return;}
  L.tray.forEach((v,j)=>{if(!used.includes(j))rec(k+1,{...fill,[slots[k]]:v},[...used,j]);});};
 rec(0,{},[]); return {level:L.level, sols:sols.size, empty:C.check(L,{}).ok};});
const s=C.solve(3,[{k:'E',a:1,b:0,E:10,r:1e-3},{k:'R',a:1,b:2,R:2},{k:'R',a:2,b:0,R:3}]);
console.log(JSON.stringify({res, series:s.i[1], mid:s.v[2]}))""")
    assert [r["level"] for r in out["res"]] == [100] * 13 + [200] * 12 + [300] * 11 + [400] * 8 + [500] * 7
    assert all(r["sols"] == 1 and not r["empty"] for r in out["res"])
    assert out["series"] == pytest.approx(2.0, rel=1e-3) and out["mid"] == pytest.approx(6.0, rel=1e-3)  # Ohm + divider


@node
def test_optics_laws_and_levels():
    out = run_node("""const O=require('./opticsim.js'); require('./bender-levels.js');
const mirror={src:{x:100,y:100,ang:0},mirrors:[{x:300,y:100,len:80,ang:45}],targets:[{x:300,y:500,r:5}],walls:[]};
const r1=O.trace(mirror);
const glass={src:{x:100,y:100,ang:30},mirrors:[],blocks:[{x:200,y:0,w:300,h:540,n:1.5}],targets:[{x:-50,y:-50,r:1}],walls:[]};
const r2=O.trace(glass);
const hand=Object.values(O.HAND), levels=hand.map(L=>{let n=0;const o=[...Array(12).keys()].map(k=>k*15);
 const rec=(i,a)=>{if(i===L.mirrors.length){if(O.trace(L,a).all)n++;return;}for(const v of o)rec(i+1,a.concat(v));};rec(0,[]);
 return {n, start:O.trace(L).all, tir:false};});
let tir=false; {const L=O.HAND.pipe; tir=O.trace(L,[135,150]).events.some(e=>e.kind==='tir');}
console.log(JSON.stringify({hit:r1.all, inc:r1.events[0].inc, enter:r2.events[0], levels, tir}))""")
    assert out["hit"] and out["inc"] == pytest.approx(45, abs=1e-6)            # i = r = 45° sends the beam down
    e = out["enter"]
    import math
    assert math.sin(math.radians(e["inc"])) == pytest.approx(1.5 * math.sin(math.radians(e["ref"])), rel=1e-6)  # Snell
    assert all(lv["n"] == 1 and not lv["start"] for lv in out["levels"])       # the hand-made levels: exactly one solution, not pre-solved
    assert out["tir"]                                                          # the light-pipe level really uses TIR


def test_new_games_render_with_their_physics_files(on):
    c = as_user(on["student"], "student")
    for slug, files in {"induction-dash": ["dash", "inductionsim"], "light-bender": ["bender", "opticsim"], "circuit-forge": ["forge", "circuitsim"], "wavefront": ["shooter", "shooterdata"], "kinetic-kingdom": ["platformer", "platformer-levels"], "impulse-arena": ["clash", "clashdata"]}.items():
        r = c.get(reverse("games:play", args=[slug]))
        assert r.status_code == 200, slug
        for f in files:
            assert f"js/games/{f}".encode() in r.content


def test_circuit_chapters_follow_the_students_level(on):
    from people.models import StudentProfile
    sp = StudentProfile.objects.filter(person__user=on["student"]).first()
    c = as_user(on["student"], "student")
    page = c.get(reverse("games:play", args=["circuit-forge"])).content.decode()
    level = sp.level.number
    for lv in (200, 300, 400, 500):
        assert (f"circuit-{lv}" in page) == (lv <= level), lv
    locked = json.loads(page.split('data-gm-locked="')[1].split('"')[0].replace("&quot;", '"'))
    assert [x["level"] for x in locked] == [lv for lv in (200, 300, 400, 500) if lv > level]


def test_chapter_stage_above_level_is_rejected(on):
    u = on["student"]
    with pytest.raises(P.Rejected):
        P.record(u, {"game": "circuit-forge", "result": "win", "stage": 14, "score": 100}, now=1.0, max_level=100)
    ok = P.record(u, {"game": "circuit-forge", "result": "win", "stage": 51, "score": 100}, now=1.0, max_level=500)
    assert any(b["id"] == "master-electrician" for b in ok["badges"])
    c = as_user(u, "student")
    r = c.post(reverse("games:api_result"), json.dumps({"game": "circuit-forge", "result": "win", "stage": 51}), content_type="application/json")
    assert r.status_code == 400 and "above your level" in r.json()["error"]


def test_final_stage_badges(on):
    u = on["student"]
    a = P.record(u, {"game": "induction-dash", "result": "win", "stage": 30, "score": 10}, now=1.0)
    b = P.record(u, {"game": "light-bender", "result": "win", "stage": 45, "score": 10}, now=1.0)
    ids = {x["id"] for x in b["badges"]}
    assert {"dash-champion", "optics-ace"} <= ids and "all-rounder" not in ids and a
