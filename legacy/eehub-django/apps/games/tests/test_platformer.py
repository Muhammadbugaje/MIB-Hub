"""Kinetic Kingdom (platformer): level data, movement physics, completability and progression, checked in Node.

The reachability search (KineticLevels.solve) replays the game's own heroStep() physics from every reachable
standing cell, so "completable" means a real player with no power-ups, no mount, no wall jumps and no boss
abilities can reach the goal gate (and the secret gate on levels that have one), and that every formula fragment
lies on a path the hero's body actually passes through. games/tests/kk_harness.js runs the real game on the real
arcade runtime with a stub DOM: every level plays without errors, every boss can be beaten in its open windows,
and saves, unlocks, time attack, skipping and remix laps behave."""
import json
import shutil
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest

from memos.tests.helpers import world  # noqa: F401  (only instantiated once the game is registered)

JS = Path(__file__).resolve().parents[2] / "static/js/games"
node = pytest.mark.skipif(not shutil.which("node"), reason="node not installed")
SLUG = "kinetic-kingdom"


def run_node(code, timeout=600):
    res = subprocess.run(["node", "-e", code], capture_output=True, text=True, timeout=timeout, cwd=JS)
    assert res.returncode == 0, res.stderr
    return json.loads(res.stdout)


@node
def test_scripts_are_valid_javascript():
    for f in ("platformer.js", "platformer-levels.js"):
        res = subprocess.run(["node", "--check", str(JS / f)], capture_output=True, text=True)
        assert res.returncode == 0, res.stderr


@node
def test_every_level_parses_with_known_tiles_one_start_and_a_goal():
    out = run_node("""const KL=require('./platformer-levels.js');
console.log(JSON.stringify(KL.LEVELS.map(lv=>{const pl=KL.parse(lv), g=pl.grid.join('');
 const n=c=>g.split(c).length-1, doors={}; for(const d of '123456789'){ if(n(d)) doors[d]=n(d); }
 return {id:lv.id, world:lv.world, stage:lv.stage, boss:lv.boss||null, secret:!!lv.secret, unknown:pl.unknown, starts:pl.starts.length,
  goals:pl.goals.length, secrets:pl.secrets.length, bosses:n('@'), shards:n('*'), doors, rows:new Set(pl.grid.map(r=>r.length)).size,
  W:pl.W, main:pl.mainEnd, H:pl.H, arena:pl.arenaX==null?null:pl.arenaX, time:lv.time, name:lv.name, song:lv.song, trial:!!lv.trial};})))""")
    assert len(out) == 41
    for lv in out:
        assert lv["unknown"] == [], lv["id"]
        assert lv["starts"] == 1 and lv["goals"] >= 1, lv["id"]
        assert lv["rows"] == 1, lv["id"]                                  # rectangular grid
        assert lv["shards"] == 3, lv["id"]                                # three formula fragments per level
        assert all(v == 2 for v in lv["doors"].values()), lv["id"]        # doors come in pairs
        assert (lv["secrets"] >= 1) == lv["secret"], lv["id"]
        assert (lv["bosses"] == 1 and lv["arena"] is not None) == bool(lv["boss"]), lv["id"]
        assert lv["time"] >= (240 if lv["trial"] else 300) and lv["name"]
        if not lv["boss"] and not lv["trial"]:
            assert lv["main"] >= 240, lv["id"]                            # long levels, not corridors
        if lv["trial"]:
            assert lv["main"] >= 110 and lv["time"] >= 240, lv["id"]       # challenges: short and hard
    assert [lv["stage"] for lv in out] == list(range(1, 42))              # stages 1-16 keep their old numbers
    assert [lv["id"] for lv in out[:16]] == ["%d-%d" % (w, k) for w in range(1, 5) for k in range(1, 5)]
    # a different track for every level
    songs = {(lv["song"]["seed"], lv["song"]["style"]) for lv in out}
    assert len(songs) == 41


@node
def test_every_world_has_a_boss_and_count_entropy_is_last():
    out = run_node("""const KL=require('./platformer-levels.js');
console.log(JSON.stringify({worlds:KL.WORLDS.map(w=>({id:w.id, name:w.name, card:!!(w.concept&&w.concept.title&&w.concept.body), song:w.song})),
 levels:KL.LEVELS.map(l=>({w:l.world, boss:l.boss||null, trial:!!l.trial, secret:!!l.secret}))}))""")
    assert len(out["worlds"]) == 7 and all(w["card"] for w in out["worlds"])
    for w in out["worlds"]:
        mine = [lv for lv in out["levels"] if lv["w"] == w["id"] and not lv["trial"]]
        assert len(mine) == (4 if w["id"] <= 4 else 6) and sum(1 for lv in mine if lv["boss"]) == 1
        assert mine[-1]["boss"]                                           # the boss closes each world
        assert any(lv["secret"] for lv in mine)                           # every world hides a secret exit
        assert sum(1 for lv in out["levels"] if lv["w"] == w["id"] and lv["trial"]) == 1   # and one challenge level
    story = [lv for lv in out["levels"] if not lv["trial"]]
    assert story[-1]["boss"] == "prime" and story[15]["boss"] == "entropy"
    assert len({lv["boss"] for lv in story if lv["boss"]}) == 7            # seven different bosses
    assert len(out["levels"]) >= 40


@node
def test_simulated_movement_matches_the_formulas_shown_on_screen():
    out = run_node("""const KL=require('./platformer-levels.js'), P=KL.P;
const flat=s=>({tile:(c,r)=>r>=10?(s||'#'):'.'});
function jump(vx0,run){const W=flat(), h=KL.newHero(5,9,true); h.ground=true; h.vx=vx0; let y0=h.y+h.h, top=1e9, t=0, x0=h.x, air=false, v0=0;
 for(let i=0;i<3000;i++){const ev=KL.heroStep(h,{r:run,run:run,jump:true,jumpHit:i===0},P.DT,W); if(ev.jump)v0=ev.jump; t+=P.DT; top=Math.min(top,h.y+h.h); if(!h.ground)air=true; else if(air)break;}
 return {v0, h:y0-top, t, dx:h.x-x0};}
function brake(surf,v){const W=flat(surf), h=KL.newHero(5,9,true); h.ground=true; h.surf=surf; h.vx=v; const x0=h.x; for(let i=0;i<9000&&h.vx>0;i++) KL.heroStep(h,{},P.DT,W); return h.x-x0;}
function spring(){const W={tile:(c,r)=>r>=10?(c===5?'S':'#'):'.'}, h=KL.newHero(5,8,true); h.vy=0; let top=1e9, launched=false, base=0;
 for(let i=0;i<3000;i++){const ev=KL.heroStep(h,{},P.DT,W); if(ev.spring&&!launched){launched=true; base=h.y+h.h;} if(launched) top=Math.min(top,h.y+h.h); if(launched&&h.vy>0&&h.y+h.h>base)break;} return base-top;}
function belt(){const W=flat('>'), h=KL.newHero(5,9,true); h.ground=true; h.surf='>'; for(let i=0;i<240;i++) KL.heroStep(h,{r:true},P.DT,W); return h.vx;}
function cut(){const W=flat(), h=KL.newHero(5,9,true); h.ground=true; let y0=h.y+h.h, top=1e9; for(let i=0;i<400;i++){KL.heroStep(h,{jump:i<12,jumpHit:i===0},P.DT,W); top=Math.min(top,h.y+h.h);} return y0-top;}
console.log(JSON.stringify({P:{G:P.G,JV:P.JUMP_V,JR:P.JUMP_RUN_V,RUN:P.RUN,WALK:P.WALK,MU:P.MU,MUI:P.MU_ICE,SV:P.SPRING_V,BELT:P.BELT,MAXF:P.MAX_FALL},
 walk:jump(0,false), run:jump(P.RUN,true), ice:brake('I',8), grass:brake('#',8), spring:spring(), belt:belt(), cut:cut()}))""")
    p = out["P"]
    g = p["G"]
    assert out["walk"]["v0"] == p["JV"] and out["run"]["v0"] == p["JR"]
    for k in ("walk", "run"):                                                  # h = v²/2g, t = 2v/g
        v = out[k]["v0"]
        assert out[k]["h"] == pytest.approx(v * v / (2 * g), rel=0.005)
        assert out[k]["t"] == pytest.approx(2 * v / g, abs=0.02)
    assert out["run"]["dx"] == pytest.approx(p["RUN"] * 2 * p["JR"] / g, rel=0.02)  # range = vx·t
    assert out["ice"] == pytest.approx(64 / (2 * p["MUI"] * g), rel=0.005)        # d = v²/2μg on ice
    assert out["grass"] == pytest.approx(64 / (2 * p["MU"] * g), rel=0.01)
    assert out["ice"] / out["grass"] == pytest.approx(p["MU"] / p["MUI"], rel=0.02)
    assert out["spring"] == pytest.approx(p["SV"] ** 2 / (2 * g), rel=0.01)        # ½mv² → mgh
    assert out["belt"] == pytest.approx(p["WALK"] + p["BELT"], rel=0.01)           # v = v_rel + u
    assert out["cut"] < 0.6 * out["walk"]["h"]                                   # variable jump height
    assert 2 < g / 9.8 < 5 and p["MAXF"] == 20                                   # disclosed scale


@node
def test_new_forces_match_their_formulas():
    """Updrafts (net force up), gusts (sideways force), moon gravity (h = v²/2g with g scaled) and the boss abilities."""
    out = run_node("""const KL=require('./platformer-levels.js'), P=KL.P;
function world(fn, gs){ return {gs:gs||1, air:true, tile:fn}; }
// standing in an updraft column 8 tiles tall on a floor at row 20: you rise to the top and float there
function updraft(){ const W=world((c,r)=>r>=20?'#':(r>=12?'|':'.')), h=KL.newHero(5,19,true); h.ground=true; let top=1e9, vmax=0;
 for(let i=0;i<1200;i++){KL.heroStep(h,{},P.DT,W); top=Math.min(top,h.y+h.h); vmax=Math.max(vmax,-h.vy);} return {top, vmax, floatY:h.y+h.h}; }
function gust(){ const Wg=world((c,r)=>r>=20?'#':'}'), W0=world((c,r)=>r>=20?'#':'.');
 function far(W){ const h=KL.newHero(5,19,true); h.ground=true; h.vx=P.RUN; const x0=h.x; let air=false; for(let i=0;i<600;i++){ const ev=KL.heroStep(h,{r:true,run:true,jump:true,jumpHit:i===0},P.DT,W); if(!h.ground)air=true; else if(air)break; } return h.x-x0; }
 return {with:far(Wg), without:far(W0)}; }
function moon(gs){ const W={gs, tile:(c,r)=>r>=20?'#':'.'}, h=KL.newHero(5,19,true); h.ground=true; const y0=h.y+h.h; let top=1e9;
 for(let i=0;i<2000;i++){ KL.heroStep(h,{jump:true,jumpHit:i===0},P.DT,W); top=Math.min(top,h.y+h.h); if(i>5&&h.ground)break; } return y0-top; }
function dash(){ const W={tile:(c,r)=>r>=20?'#':'.'}, h=KL.newHero(5,10,true); h.abil={dash:true}; h.face=1; KL.heroStep(h,{},P.DT,W); const ev=KL.heroStep(h,{dashHit:true},P.DT,W), vx=h.vx;
 const y=h.y; for(let i=0;i<10;i++) KL.heroStep(h,{},P.DT,W); return {ev:!!ev.dash, vx, dy:h.y-y}; }
function glide(){ const W={tile:(c,r)=>r>=40?'#':'.'}, h=KL.newHero(5,2,true); h.abil={glide:true}; let v=0; for(let i=0;i<240;i++){ KL.heroStep(h,{jump:true},P.DT,W); v=h.vy; } return v; }
function double(){ const W={tile:(c,r)=>r>=20?'#':'.'}, h=KL.newHero(5,19,true); h.ground=true; h.abil={double:true}; let jumps=0;
 for(let i=0;i<200;i++){ const ev=KL.heroStep(h,{jump:true,jumpHit:i===0||i===60},P.DT,W); if(ev.jump) jumps++; } return jumps; }
console.log(JSON.stringify({P:{G:P.G,UP:P.UP_A,UPMAX:P.UP_MAX,JV:P.JUMP_V,DASH:P.DASH_V,CAPE:P.CAPE_FALL}, up:updraft(), gust:gust(), moon:moon(0.55), earth:moon(1), dash:dash(), glide:glide(), double:double()}))""")
    p = out["P"]
    assert out["up"]["vmax"] == pytest.approx(p["UPMAX"], abs=0.05)            # rises at the balance speed
    assert 8 <= out["up"]["top"] and 20 - out["up"]["floatY"] == pytest.approx(8, abs=1.3)   # floats at the column top
    assert out["gust"]["with"] > out["gust"]["without"] * 1.2                    # a tailwind carries you further
    assert out["earth"] == pytest.approx(p["JV"] ** 2 / (2 * p["G"]), rel=0.01)   # h = v²/2g
    assert out["moon"] == pytest.approx(p["JV"] ** 2 / (2 * p["G"] * 0.55), rel=0.01)
    assert out["dash"]["ev"] and out["dash"]["vx"] == pytest.approx(p["DASH"]) and abs(out["dash"]["dy"]) < 1e-9   # no fall during a dash
    assert out["glide"] == pytest.approx(p["CAPE"])                              # terminal velocity on the cape
    assert out["double"] == 2


@node
def test_solver_rejects_impossible_layouts():
    """Negative controls: the search must fail a gap wider than the longest running jump and a ledge higher than
    the highest jump, and pass the same layouts made just possible."""
    out = run_node("""const KL=require('./platformer-levels.js'), P=KL.P;
const reach=P.RUN*P.flightTime(P.JUMP_RUN_V), up=P.maxHeight(P.JUMP_RUN_V);
function lv(id, fn){return {id, H:17, time:300, song:{seed:1,style:'chip'}, build:function(b){b.s(14,b=>b.e(2,'P')); fn(b); b.s(10,b=>b.e(5,'G')); b.end();}};}
const gap=n=>lv('gap'+n, b=>b.s(n,null,'pit'));
const wall=n=>lv('wall'+n, b=>{b.up(n);});
const spikes=lv('spk', b=>b.s(12,null,'spk'));
const r={reach, up, gaps:{}, walls:{}};
for(const n of [6,9,11,12]) r.gaps[n]=KL.solve(gap(n)).ok;
for(const n of [3,4,5]) r.walls[n]=KL.solve(wall(n)).ok;
r.spikes=KL.solve(spikes).ok; console.log(JSON.stringify(r));""")
    assert 9.5 < out["reach"] < 11 and 4 < out["up"] < 4.5
    assert out["gaps"] == {"6": True, "9": True, "11": False, "12": False}
    assert out["walls"] == {"3": True, "4": True, "5": False}
    assert out["spikes"] is False                                               # a full spike floor can't be crossed


@node
def test_every_level_is_completable_with_real_jump_physics():
    ids = run_node("const KL=require('./platformer-levels.js');console.log(JSON.stringify(KL.LEVELS.map(l=>l.id)))")

    def solve(lid):
        return run_node("""const KL=require('./platformer-levels.js'); const lv=KL.LEVELS.find(l=>l.id===%s), s=KL.solve(lv);
console.log(JSON.stringify({id:lv.id, ok:s.ok, secret:s.secret, cells:s.cells, needSecret:!!lv.secret, shards:s.shards, total:s.shardTotal, miss:s.missShards}))""" % json.dumps(lid))

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(solve, ids))
    for r in results:
        assert r["ok"], r["id"] + " goal unreachable"
        if r["needSecret"]:
            assert r["secret"], r["id"] + " secret gate unreachable"
        assert r["cells"] > 50
        assert r["total"] == 3 and r["shards"] == 3, "%s fragments not reachable: %s" % (r["id"], r["miss"])


def run_harness(mode, timeout=600):
    res = subprocess.run(["node", str(Path(__file__).with_name("kk_harness.js")), str(JS), mode], capture_output=True, text=True, timeout=timeout)
    out = json.loads(res.stdout.strip().splitlines()[-1])
    assert out["errors"] == [], out["errors"]
    return out


@node
def test_every_level_plays_on_the_real_runtime():
    out = run_harness("levels")
    assert len(out["levels"]) == 41
    for lid, r in out["levels"].items():
        assert not r["nan"] and r["ents"] >= 0, lid
    assert out["levels"]["6-1"]["gs"] == 0.55 and out["levels"]["7-3"]["gs"] == 0.7 and out["levels"]["5-1"]["gs"] == 1


@node
def test_every_boss_can_be_beaten_in_its_open_windows():
    out = run_harness("bosses")
    assert set(out["bosses"]) == {"1-4", "2-4", "3-4", "4-4", "5-6", "6-6", "7-6"}
    for lid, b in out["bosses"].items():
        assert b["beaten"] and b["hits"] == b["max"] and b["gate"], (lid, b)


@node
def test_progression_saves_unlocks_time_attack_skip_and_laps():
    old = run_harness("progress-old")
    assert old["migrated"]["v"] == 2 and old["migrated"]["who"] == "tesla"     # a scientist already in use stays open
    out = run_harness("progress")
    assert out["trialLockedAtStart"] and out["trialOpenAfterBoss"]
    assert out["abilitiesAtStart"] == {"dash": False, "glide": False, "shock": False, "double": False}
    assert out["abilitiesAfter"] == {"dash": True, "glide": True, "shock": False, "double": False}
    assert not out["einsteinOpenAtStart"] and out["einsteinOpenAfter"]
    assert out["ghostLoaded"] and out["attack"]["second"] < out["attack"]["first"] and out["attack"]["ghostFrames"] > 10
    assert not out["attack"]["reportedDone"]                                     # time attack never files a clear
    assert out["skip"]["done"]["skipped"] and out["skip"]["nextOpen"]
    assert out["lap"] == 2 and 0 <= out["completion"] <= 100


def test_catalogue_entry_and_stage_count_once_registered():
    from games import catalogue, progress
    game = catalogue.BY_SLUG.get(SLUG)
    if not game:
        pytest.skip("kinetic-kingdom is not in games/catalogue.py yet")
    assert game.playable and game.script == "platformer" and "platformer-levels" in game.extra.get("deps", [])
    assert progress.MAX_STAGE.get(SLUG) == 41
    assert progress.FINAL[SLUG] == ("kingdom-restored", 16)                 # the original badge still means beating 4-4


@pytest.fixture
def on(request):
    from games import catalogue
    if SLUG not in catalogue.BY_SLUG:
        pytest.skip("kinetic-kingdom is not in games/catalogue.py yet")
    world = request.getfixturevalue("world")
    from memos.tests.helpers import set_setting
    set_setting("features.games", True)
    return world


def test_play_page_loads_the_level_file(on):
    from django.urls import reverse
    from memos.tests.helpers import as_user
    c = as_user(on["student"], "student")
    r = c.get(reverse("games:play", args=[SLUG]))
    assert r.status_code == 200
    html = r.content.decode()
    assert "js/games/platformer-levels.js" in html and "js/games/platformer.js" in html
    assert html.index("platformer-levels.js") < html.index("js/games/platformer.js")
