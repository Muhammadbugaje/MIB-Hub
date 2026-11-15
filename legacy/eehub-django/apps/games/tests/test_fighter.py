"""Impulse Arena (static/js/games/clash.js + clashdata.js): move data, physics, input parsing, combos, CPU and tower.

Most checks run the game's own simulation core in Node (clashdata.js is UMD), so they are fast and need no browser.
"""
import json
import shutil
import subprocess
from pathlib import Path

import pytest
from django.urls import reverse

from memos.tests.helpers import as_user, set_setting, world  # noqa: F401

JS = Path(__file__).resolve().parents[2] / "static/js/games"
node = pytest.mark.skipif(not shutil.which("node"), reason="node not installed")

# Small Node helpers shared by the checks: a scripted controller loop over the real simulation.
PRE = """const D=require('./clashdata.js');
const mk=(a,b,o)=>D.create(Object.assign({p1:a,p2:b,mode:'versus',seed:3,p2o:{cpu:false}},o||{}));
const run=(m,c,n,c2)=>{const ev=[];for(let i=0;i<n;i++){D.step(m,[c||{},c2||{}],1/120);ev.push(...m.ev);m.ev=[];}return ev;};
const fight=(m)=>{run(m,{},240);return m;};
"""


def run_node(code):
    res = subprocess.run(["node", "-e", PRE + code], capture_output=True, text=True, timeout=600, cwd=JS)
    assert res.returncode == 0, res.stderr
    return json.loads(res.stdout)


@node
def test_every_fighter_has_valid_unique_specials_and_finishers():
    out = run_node("""const out={};
for (const id of D.ORDER.concat(D.BOSSES)) { const sp=D.SPECIALS[id], fin=D.FINISHERS[id];
  out[id]={n:sp.length, valid:sp.every(s=>D.validInput(s.in)), keys:sp.map(s=>JSON.stringify(s.in)), sc:sp.map(s=>s.sc).filter(Boolean),
    caps:sp.every(s=>s.cap&&s.idea&&s.name), fin:!!fin&&D.validInput(fin.in), finKey:fin&&JSON.stringify(fin.in), mass:D.FIGHTERS[id].mass}; }
console.log(JSON.stringify(out))""")
    assert len(out) >= 24                                                     # 21 playable + 3 bosses (Nov 2026 roster)
    for who, d in out.items():
        assert d["n"] >= 5, who
        assert d["valid"] and d["caps"], who
        assert len(set(d["keys"])) == len(d["keys"]), who                     # no two specials share an input
        assert len(set(d["sc"])) == len(d["sc"]) and set(d["sc"]) <= {"F", "B", "D", "U"}, who
        assert d["fin"] and d["finKey"] not in d["keys"], who                 # finisher input never clashes with a special
        assert 50 <= d["mass"] <= 120, who


@node
def test_frame_data_is_positive_and_impulses_give_sane_knockback():
    out = run_node("""const masses=Object.values(D.FIGHTERS).map(f=>f.mass), bad=[], dv=[];
D.allMoves().forEach(m=>{ if(!(m.st>0&&m.act>0&&m.rec>0)) bad.push(m.who+':'+(m.id||m.name));
  if(m.J>0) masses.forEach(k=>dv.push(m.J/k)); });
console.log(JSON.stringify({bad, n:D.allMoves().length, lo:Math.min(...dv), hi:Math.max(...dv)}))""")
    assert out["bad"] == [] and out["n"] > 70
    assert out["lo"] >= 0.15 and out["hi"] <= 10                              # Δv = J/m between 0.15 and 10 m/s


@node
def test_a_hit_changes_velocity_by_j_over_m_and_friction_is_mu_g():
    out = run_node("""const m=fight(mk('newton','bohr')), a=m.f[0], b=m.f[1]; a.x=5; b.x=5.8;
let ev=run(m,{h:{HP:true}},1); ev=ev.concat(run(m,{},20)); const hit=ev.find(e=>e.type==='hit');
const v0=b.vx; run(m,{},12); const v1=b.vx;
console.log(JSON.stringify({J:hit.J, m:hit.m, dv:hit.dv, F:hit.F, dt:hit.dt, vx:v0, decel:(v0-v1)/(12/120)}))""")
    assert out["dv"] == pytest.approx(out["J"] / out["m"])                     # Δv = J/m
    assert out["F"] == pytest.approx(out["J"] / out["dt"])                     # F̄ = J/Δt
    assert out["m"] == 86 and out["J"] == 140
    assert out["decel"] == pytest.approx(0.6 * 9.8, rel=0.02)                  # a = μg while sliding


@node
def test_blocking_keeps_the_impulse_but_quarters_force_and_damage():
    out = run_node("""const res={};
for (const blk of [false,true]) { const m=fight(mk('tesla','curie')), a=m.f[0], b=m.f[1]; a.x=5; b.x=5.8; const hp=b.hp;
  const ev=run(m,{h:{LP:true}},1,{blk}).concat(run(m,{},14,{blk})); const e=ev.find(e=>e.type==='hit'||e.type==='block');
  res[blk?'block':'hit']={type:e.type, J:e.J, F:e.F, dt:e.dt, dmg:hp-b.hp}; }
console.log(JSON.stringify(res))""")
    h, b = out["hit"], out["block"]
    assert h["type"] == "hit" and b["type"] == "block"
    assert b["J"] == h["J"] and b["dt"] == pytest.approx(4 * h["dt"])
    assert b["F"] == pytest.approx(h["F"] / 4) and b["dmg"] == pytest.approx(h["dmg"] / 4)


@node
def test_high_low_and_overhead_blocking_rules():
    out = run_node("""function one(move, ctrl2, setup){ const m=fight(mk('kai','faraday')), a=m.f[0], b=m.f[1]; a.x=5; b.x=5.75; if(setup) setup(m);
  const ev=run(m,move,1,ctrl2).concat(run(m,{},50,ctrl2)); const e=ev.find(e=>e.type==='hit'||e.type==='block'); return e?e.type:'whiff'; }
console.log(JSON.stringify({
  lowVsStand: one({d:true,h:{LK:true}}, {blk:true}), lowVsCrouch: one({d:true,h:{LK:true}}, {blk:true,d:true}),
  highVsCrouch: one({h:{HP:true}}, {d:true}), midVsCrouchBlock: one({h:{LP:true}}, {blk:true,d:true}),
  airVsCrouchBlock: one({h:{HK:true}}, {blk:true,d:true}, m=>{const a=m.f[0]; a.st='air'; a.y=0.9; a.vy=0; a.airAtk=false;}),
  airVsStandBlock: one({h:{HK:true}}, {blk:true}, m=>{const a=m.f[0]; a.st='air'; a.y=0.9; a.vy=0; a.airAtk=false;}),
  throwVsBlock: one({h:{LP:true}}, {blk:true}, m=>{m.f[1].x=5.5;}) }))""")
    assert out["lowVsStand"] == "hit" and out["lowVsCrouch"] == "block"
    assert out["highVsCrouch"] == "whiff" and out["midVsCrouchBlock"] == "block"
    assert out["airVsCrouchBlock"] == "hit" and out["airVsStandBlock"] == "block"
    assert out["throwVsBlock"] == "hit"                                       # throws beat blocking


@node
def test_motion_inputs_shortcuts_holds_and_super():
    out = run_node("""function tap(m, seq){ let ev=[]; for (const c of seq) ev=ev.concat(run(m,c,4)); return ev; }
const sp=(ev)=>{const e=ev.find(e=>e.type==='special'); return e?e.name+(e.ex?' EX':''):null;};
let m=fight(mk('newton','tesla')); const qcf=sp(tap(m,[{d:1},{d:1,r:1},{r:1},{r:1,h:{HP:1}}]).concat(run(m,{},2)));
m=fight(mk('einstein','tesla')); const bb=sp(tap(m,[{l:1},{},{l:1},{l:1,h:{LK:1}}]));
m=fight(mk('tesla','curie')); let ev=run(m,{h:{HP:1}},130).concat(run(m,{},2)); const hold=sp(ev);
m=fight(mk('curie','tesla')); const short=sp(run(m,{r:1,sp:1},2));
m=fight(mk('curie','tesla')); m.f[0].meter=0; const none=run(m,{sp:1},2).map(e=>e.type);
m=fight(mk('curie','tesla')); m.f[0].meter=80; run(m,{sp:1},2); run(m,{},2); const ex=sp(run(m,{r:1,sp:1},2)); const left=m.f[0].meter;
m=fight(mk('newton','tesla')); m.f[0].face=1; const slow=sp(tap(m,[{d:1}]).concat(run(m,{},90)).concat(tap(m,[{r:1,h:{HP:1}}])));
console.log(JSON.stringify({qcf, bb, hold, short, none, ex, left, slow}))""")
    assert out["qcf"] == "Momentum Cannon"                                    # ↓→ + HP
    assert out["bb"] == "Equivalence Hop"                                     # ←← + LK (cancels the back-dash)
    assert out["hold"] == "Death Ray"                                         # hold HP 1 s, release
    assert out["short"] == "Polonium Glow Shot"                               # → + ★ shortcut
    assert "nometer" in out["none"] and "special" not in out["none"]
    assert out["ex"] == "Polonium Glow Shot EX" and out["left"] == pytest.approx(30, abs=1)
    assert out["slow"] is None                                                # a stale motion does not fire a special


@node
def test_combo_string_counter_and_damage_scaling():
    out = run_node("""const m=fight(mk('bohr','curie')), a=m.f[0], b=m.f[1]; a.x=5; b.x=5.7; let ev=[];
for (const btn of ['HP','HP','LP']) { ev=ev.concat(run(m,{h:{[btn]:true}},1)); ev=ev.concat(run(m,{},15)); }
ev=ev.concat(run(m,{},40)); const hits=ev.filter(e=>e.type==='hit');
const up=fight(mk('kai','faraday')); up.f[0].x=5; up.f[1].x=5.7; const ue=run(up,{d:true,h:{HP:true}},1).concat(run(up,{},30)); const launched=up.f[1].st;
console.log(JSON.stringify({combo:hits.map(h=>h.combo), dmg:hits.map(h=>h.dmg), chain:ev.some(e=>e.type==='chain'&&e.name==='Lab Jab'), end:ev.find(e=>e.type==='comboEnd'), launched, up:ue.some(e=>e.type==='hit'&&/Uppercut/.test(e.label))}))""")
    assert out["combo"] == [1, 2, 3] and out["chain"]
    d = out["dmg"]
    assert d[1] == pytest.approx(d[0] * 0.9) and d[2] / d[1] < 0.6           # 2nd hit ×0.9, LP after HP is lighter and ×0.8
    assert out["end"]["hits"] == 3
    assert out["up"] and out["launched"] == "juggle"                          # uppercut launches for juggles


@node
def test_half_life_cloud_and_falling_apple_follow_the_formulas():
    out = run_node("""const m=fight(mk('curie','bohr')), b=m.f[1]; b.dot={d0:16,t:0,dealt:0}; const hp0=b.hp; run(m,{},120); const after1=hp0-b.hp; run(m,{},600);
const m2=fight(mk('newton','faraday')); m2.f[1].x=9; m2.f[1].cpu=null; let ev=run(m2,{d:1},4).concat(run(m2,{},4),run(m2,{d:1},4),run(m2,{d:1,h:{HP:1}},2),run(m2,{},240));
const bonk=ev.find(e=>e.type==='bonk'), thud=ev.find(e=>e.type==='thud');
console.log(JSON.stringify({after1, hp:hp0-b.hp, v:bonk.v, y:bonk.y, vg:thud.v, hit:ev.some(e=>e.type==='hit'&&e.label==='Falling Apple')}))""")
    assert out["after1"] == pytest.approx(8, rel=0.02)                        # half of 16 in the first second
    assert out["hp"] == pytest.approx(16, rel=0.02)                           # the whole dose arrives over time
    assert out["hit"] and out["v"] == pytest.approx((2 * 9.8 * (4 - out["y"])) ** 0.5, rel=0.03)  # v = √(2gh) at head height
    assert out["vg"] == pytest.approx((2 * 9.8 * 4) ** 0.5, rel=0.03)                               # and at the floor, h = 4 m


@node
def test_cpu_vs_cpu_matches_always_finish():
    out = run_node("""const ids=D.ORDER.concat(D.BOSSES), res=[];
for (let i=0;i<ids.length;i++) { const r=D.simulate(ids[i], ids[(i*3+1)%ids.length], {seed:100+i, s1:0.2+0.08*i, s2:0.9-0.07*i});
  res.push({over:r.over, s:r.seconds, rounds:r.rounds.length, worst:r.worst, wins:r.wins}); }
console.log(JSON.stringify(res))""")
    for r in out:
        assert r["over"] and r["s"] < 4 * 60 + 40                             # never stuck: best of 3 (max 4 rounds) ends
        assert 2 <= r["rounds"] <= 4 and max(r["wins"]) >= 1
        assert r["worst"]["t"] < 6                                            # no attack/hitstun/knock-down state lasts > 6 s


@node
def test_tower_arenas_and_weapons():
    out = run_node("""const t=D.tower('newton'); const w=Object.entries(D.WEAPONS).map(([k,v])=>({k, shop:v.shop, price:v.price, uses:v.uses, rate:v.dmg/(v.st+v.act+v.rec)}));
const best=Math.max(...['lp','hp','lk','hk'].map(k=>D.NORMALS[k].dmg/(D.NORMALS[k].st+D.NORMALS[k].act+D.NORMALS[k].rec)));
console.log(JSON.stringify({n:t.length, opp:t.map(r=>r.opp), skill:t.map(r=>r.skill), mirror:t.filter(r=>r.mirror).length, arenas:D.ARENAS.map(a=>[a.id,a.style,a.seed]), rungArenas:t.map(r=>r.arena), w, best}))""")
    assert out["n"] == 10 and out["opp"][4] == "inertia" and out["opp"][9] == "entropy"
    regular = [o for i, o in enumerate(out["opp"]) if i not in (4, 9)]
    assert len(regular) == 8 and "newton" not in regular[:7] and out["mirror"] == 1
    assert all(b > a for a, b in zip(out["skill"], out["skill"][1:]))         # difficulty rises every rung
    styles = {"anthem", "afro", "amapiano", "funk", "synthwave", "chip", "dub", "march", "boss", "calm", "breaks"}
    assert len(out["arenas"]) >= 5 and len({a[2] for a in out["arenas"]}) == len(out["arenas"]) and all(a[1] in styles for a in out["arenas"])
    assert dict((a[0], a[1]) for a in out["arenas"])[out["rungArenas"][9]] == "boss"
    for w in out["w"]:
        assert w["shop"] == "wpn-" + w["k"] and 100 <= w["price"] <= 300 and w["uses"] <= 10
        assert w["rate"] <= out["best"] * 1.25                                # weapons trade speed for reach, not pay-to-win


def test_play_page_loads_the_fighter_and_its_data(world, settings):  # noqa: F811
    from games import progress as P
    set_setting("features.games", True)
    c = as_user(world["student"], "student")
    r = c.get(reverse("games:play", args=["impulse-arena"]))
    assert r.status_code == 200
    assert b"js/games/clashdata" in r.content and b"js/games/clash" in r.content
    assert P.MAX_STAGE["impulse-arena"] == 100
    out = P.record(world["student"], {"game": "impulse-arena", "result": "win", "stage": 10, "score": 900}, now=1.0)
    assert any(b["id"] == "arena-champion" for b in out["badges"])


# ---------- Nov 2026 expansion: roster, supers, buffer, handicap, throw tech, career, trials, anti-spam ----------
CAREER = """const C=require('./clashcareer.js');\n"""


@node
def test_roster_supers_and_personalities():
    out = run_node("""const ids=D.ORDER.concat(D.BOSSES);
console.log(JSON.stringify({n:ids.length, playable:D.ORDER.length, sup:ids.filter(i=>D.SUPERS[i]&&D.validInput(D.SUPERS[i].in)).length,
  ai:ids.filter(i=>['balanced','zoner','rush','grappler','tricky'].includes(D.FIGHTERS[i].ai)).length,
  looks:D.ROSTER2.every(i=>{const l=D.FIGHTERS[i].look; return l&&l.name&&l.fact&&l.skin&&l.style;}), arenas:ids.every(i=>D.ARENA[D.FIGHTERS[i].arena])}))""")
    assert out["n"] >= 24 and out["playable"] >= 20
    assert out["sup"] == out["n"] and out["ai"] == out["n"] and out["looks"] and out["arenas"]


@node
def test_super_buffer_handicap_and_throw_tech():
    out = run_node("""function tap(m, seq){ let ev=[]; for (const c of seq) ev=ev.concat(run(m,c,4)); return ev; }
let m=fight(mk('volta','newton')); m.f[0].meter=100; const sup=tap(m,[{d:1},{d:1,r:1},{r:1},{d:1},{d:1,r:1},{r:1,h:{HK:1}}]).concat(run(m,{},2)).find(e=>e.type==='super');
const left=m.f[0].meter;
m=fight(mk('volta','newton')); m.f[0].meter=40; const nosup=tap(m,[{d:1},{d:1,r:1},{r:1},{d:1},{d:1,r:1},{r:1,h:{HK:1}}]).some(e=>e.type==='super');
m=fight(mk('kai','bohr')); m.f[0].meter=100; const phone=run(m,{sp:1,blk:1},2).some(e=>e.type==='super');
// buffer: press LP 4 frames before a heavy kick ends; the jab still comes out
m=fight(mk('newton','bohr')); m.f[1].x=9; run(m,{h:{HK:1}},1); const n=Math.round(D.frames(D.NORMALS.hk)*120); run(m,{},n-8); const buf=run(m,{h:{LP:1}},1).concat(run(m,{},20)).filter(e=>e.type==='move').map(e=>e.id);
// handicap: the same hit does less to a fighter who takes 0.67x damage
const dmg=(tm)=>{const mm=D.create({p1:'newton',p2:'bohr',mode:'versus',seed:3,p2o:{cpu:false,takeMul:tm}}); run(mm,{},240); mm.f[0].x=5; mm.f[1].x=5.7; const e=run(mm,{h:{HP:1}},1).concat(run(mm,{},20)).find(e=>e.type==='hit'); return e.dmg;};
const d1=dmg(1), d2=dmg(0.67);
// throw tech: the held fighter presses LP straight away
m=fight(mk('ohm','tesla')); m.f[0].x=5; m.f[1].x=5.5; run(m,{h:{LP:1}},1); const held=m.f[1].st; const tech=run(m,{},2,{h:{LP:1}}).concat(run(m,{},60)).some(e=>e.type==='tech');
// a throw never grabs a rival who is blocking
m=fight(mk('ohm','tesla')); m.f[0].x=5; m.f[1].x=5.5; run(m,{},1,{blk:1,l:0,r:1}); const noBlockThrow=run(m,{h:{LP:1}},1,{blk:1,r:1}).every(e=>e.type!=='throw');
console.log(JSON.stringify({sup:!!sup, name:sup&&sup.name, left, nosup, phone, buf, d1, d2, held, tech, noBlockThrow}))""")
    assert out["sup"] and out["name"] == "Hundred-Cell Pile" and out["left"] == 0 and not out["nosup"] and out["phone"]
    assert out["buf"] == ["lp"]                                              # the press 8 steps before the kick ended was remembered
    assert out["d2"] == pytest.approx(out["d1"] * 0.67, rel=0.02)
    assert out["held"] == "held" and out["tech"] and out["noBlockThrow"]


@node
def test_one_projectile_on_screen_and_plain_projectiles_do_not_knock_down():
    out = run_node("""let m=fight(mk('newton','faraday')); m.f[1].x=11.5; m.f[1].cpu=null;
function qcf(){ return run(m,{d:1},4).concat(run(m,{d:1,r:1},4),run(m,{r:1,h:{HP:1}},2),run(m,{},90)); }
const a=qcf(), b=qcf(); const fired=a.concat(b).filter(e=>e.type==='proj').length, busy=b.some(e=>e.type==='projbusy');
m=fight(mk('newton','faraday')); m.f[0].x=4; m.f[1].x=6.2; m.f[1].cpu=null; const ev=run(m,{d:1},4).concat(run(m,{d:1,r:1},4),run(m,{r:1,h:{HP:1}},2),run(m,{},90));
console.log(JSON.stringify({fired, busy, st: ev.some(e=>e.type==='hit') ? 'hit' : 'miss', kd: ev.some(e=>e.type==='land'&&e.side===1&&e.hard)}))""")
    assert out["fired"] == 1 and out["busy"]
    assert out["st"] == "hit" and not out["kd"]


@node
def test_simple_spam_loops_do_not_beat_a_sharp_cpu():
    res = subprocess.run(["node", str(Path(__file__).with_name("clash_bots.js")), "0.7", "8"], capture_output=True, text=True, timeout=600)
    assert res.returncode == 0, res.stderr
    rates = json.loads(res.stdout.strip().splitlines()[-1])
    for bot in ("walkJab", "sweep", "jumpKick", "throwSpam", "turtle"):
        assert rates[bot] <= 0.4, (bot, rates)                                # mashing one move loses most of the time
    for bot in ("upper", "fireball", "heavyMash"):
        assert rates[bot] <= 0.65, (bot, rates)                               # zoning and heavy pressure are fair tactics, not auto-wins


@node
def test_career_circuit_unlocks_survival_trials_and_migration():
    res = subprocess.run(["node", "-e", PRE + CAREER + """
const ch1=C.circuit(0,'newton'), ch5=C.circuit(4,'newton'), pre=C.circuit(12,'newton');
const kinds=ch1.map(r=>r.kind), skills=[...Array(100)].map((_, i)=>C.rungAt(i+1,'volta').skill);
let p=C.migrate(null, {char:'tesla', rung:7, best:6}, false); const mig={char:p.char, g:p.g, best:p.best, maxwell:C.isUnlocked(p,'maxwell')};
let q=C.migrate(null, {char:'bohr', rung:3, best:10}, true); const champ={g:q.g, bosses:C.isUnlocked(q,'entropy'), maxwell:C.isUnlocked(q,'maxwell')};
// play a whole Circuit: winning every rung unlocks one fighter per chapter and the bosses at chapter 5
let r=C.fresh(), unlocks=[], cleared=[];
for (let g=1; g<=100; g++) { const o=C.record(r,{mode:'circuit', char:'newton', won:true, rung:g}); unlocks.push(...o.unlocks); if(o.chapterCleared!=null) cleared.push(o.chapterCleared); }
const allOpen=D.ORDER.concat(D.BOSSES).every(id=>C.isUnlocked(r,id));
const surv=[1,5,10,25].map(k=>C.survivalOpp(k,'newton',7)), ta=C.timeAttack('newton');
const trials=D.ORDER.concat(D.BOSSES).map(id=>C.trialsFor(id)), bad=[];
trials.forEach((list,i)=>{ const id=D.ORDER.concat(D.BOSSES)[i]; list.forEach(t=>t.steps.forEach(s=>{ if(!(D.NORMALS[s]||s==='super'||D.SPECIALS[id].some(x=>x.id===s))) bad.push(id+':'+s); })); });
console.log(JSON.stringify({kinds, boss:ch1[9].opp, boss5:ch5[9].opp, rounds5:ch5[9].rounds, preTake:pre[0].cpuTake, preSkill:pre[0].skill, up:skills.every((s,i)=>i===0||s>=skills[i-1]-0.06),
  first:skills[0], last:skills[99], mig, champ, unlocks, cleared:cleared.length, allOpen, level:C.level(r.xp.newton), titles:C.titles(r),
  surv:surv.map(s=>[s.opp,s.boss,s.skill]), ta:ta.length, taLast:ta[ta.length-1].opp, trials:trials.map(t=>t.length), bad,
  prog:C.trialProgress({steps:['hp','hp','lp']},['hp','hp','lp']), stage:C.reportStage({mode:'circuit',rung:137})}))"""], capture_output=True, text=True, timeout=600, cwd=JS)
    assert res.returncode == 0, res.stderr
    out = json.loads(res.stdout)
    assert out["kinds"][4] == "rival" and out["kinds"][8] == "mirror" and out["kinds"][9] == "boss" and out["boss"] == "inertia" and out["boss5"] == "entropy"
    assert out["rounds5"] == 3 and out["preTake"] < 1 and out["preSkill"] >= out["last"] - 0.05
    assert out["up"] and out["first"] < 0.2 and out["last"] > 0.9                # 100 rungs, steadily harder
    assert out["mig"] == {"char": "tesla", "g": 7, "best": 6, "maxwell": False}
    assert out["champ"]["g"] >= 11 and out["champ"]["bosses"] and out["champ"]["maxwell"]
    assert out["cleared"] == 10 and len(out["unlocks"]) >= 10 and out["allOpen"]
    assert out["level"] > 10 and "legend" in out["titles"] and "centurion" in out["titles"]
    assert out["surv"][0][2] < out["surv"][3][2] and out["surv"][1][1] and out["ta"] == 8 and out["taLast"] == "entropy"
    assert min(out["trials"]) >= 5 and out["bad"] == [] and out["prog"] == 3 and out["stage"] == 100


def test_circuit_stage_cap_and_badges(world, settings):  # noqa: F811
    from games import progress as P
    set_setting("features.games", True)
    out = P.record(world["student"], {"game": "impulse-arena", "result": "win", "stage": 100, "score": 900}, now=1.0)
    ids = {b["id"] for b in out["badges"]}
    assert {"arena-champion", "arena-legend"} <= ids
    r = world["student"]
    with pytest.raises(P.Rejected):
        P.record(r, {"game": "impulse-arena", "result": "win", "stage": 101, "score": 900}, now=100.0)
