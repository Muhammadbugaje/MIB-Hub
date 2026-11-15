"""Logic Labyrinth (static/js/games/logicsim.js + logic-300.js + logic-400.js): the evaluator is a correct model of
digital logic, and every level is a real, solvable puzzle whose stated optimum (fewest gates, fewest moves) is exact.
The level checks use two independent searches: LogicSim.solve (pruned) and a plain exhaustive enumeration here."""
import functools
import itertools
import json
import shutil
import subprocess
from pathlib import Path

import pytest

from games import catalogue as C
from games import progress as P

JS = Path(__file__).resolve().parents[2] / "static/js/games"
pytestmark = pytest.mark.skipif(not shutil.which("node"), reason="node not installed")
LOAD = "const S=require('./logicsim.js'); require('./logic-300.js'); require('./logic-400.js');"


def run_node(code):
    res = subprocess.run(["node", "-e", LOAD + code], capture_output=True, text=True, timeout=600, cwd=JS)
    assert res.returncode == 0, res.stderr
    return json.loads(res.stdout)


EXPECT = {  # Python's own definition of each gate
    "AND": lambda a, b: a & b, "OR": lambda a, b: a | b, "NAND": lambda a, b: 1 - (a & b),
    "NOR": lambda a, b: 1 - (a | b), "XOR": lambda a, b: a ^ b, "XNOR": lambda a, b: 1 - (a ^ b),
}


def test_every_gate_type_and_de_morgan():
    out = run_node("""const g=S.gate, rows=[];
for (const a of [0,1]) for (const b of [0,1]) rows.push({a, b, AND:g('AND',a,b), OR:g('OR',a,b), NAND:g('NAND',a,b), NOR:g('NOR',a,b),
  XOR:g('XOR',a,b), XNOR:g('XNOR',a,b), NOTa:g('NOT',a), J:g('J',a,b), WIRE:g('WIRE',a),
  dm1:[g('NOT',g('AND',a,b)), g('OR',g('NOT',a),g('NOT',b))], dm2:[g('NOT',g('OR',a,b)), g('AND',g('NOT',a),g('NOT',b))],
  nandNot:g('NAND',a,a), norNot:g('NOR',a,a), nandOr:g('NAND',g('NAND',a,a),g('NAND',b,b)), norAnd:g('NOR',g('NOR',a,a),g('NOR',b,b)),
  xorFromNand:g('NAND',g('NAND',a,g('NAND',a,b)),g('NAND',g('NAND',a,b),b))});
console.log(JSON.stringify({rows, X:[g('AND',S.X,1), g('OR',0,S.X), g('NOT',S.X), g('XOR',S.X,S.X)]}))""")
    assert len(out["rows"]) == 4
    for r in out["rows"]:
        a, b = r["a"], r["b"]
        for name, f in EXPECT.items():
            assert r[name] == f(a, b), (name, a, b)
        assert r["NOTa"] == 1 - a and r["J"] == a and r["WIRE"] == a
        assert r["dm1"][0] == r["dm1"][1] and r["dm2"][0] == r["dm2"][1]          # De Morgan's theorems
        assert r["nandNot"] == r["norNot"] == 1 - a                              # tied inputs invert
        assert r["nandOr"] == a | b and r["norAnd"] == a & b                     # NAND / NOR are universal
        assert r["xorFromNand"] == a ^ b                                         # four-NAND XOR
    assert out["X"] == [2, 2, 2, 2]                                              # a floating input never fakes a 1


def test_boxes_flip_flops_and_kmap_planes():
    out = run_node("""const L={mode:'table',levers:[{id:'A'},{id:'B'},{id:'C'},{id:'D'}],nodes:[
  {id:'E',k:'eq',ins:['A','B','C','D'],val:11},{id:'M',k:'mux',ins:['A','B','C','D'],sel:['A','B']},
  {id:'t1',k:'tile',term:"A'B"},{id:'t2',k:'tile',term:'CD'},{id:'F',k:'plane',type:'sop',tiles:['t1','t2']},
  {id:'u1',k:'tile',term:"A+B'"},{id:'G',k:'plane',type:'pos',tiles:['u1']}]};
const res=S.combos(['A','B','C','D']).map(c=>{const v=S.evaluate(L,{t1:'1',t2:'1',u1:'1'},c); return [c.A,c.B,c.C,c.D,v.E,v.M,v.F,v.G];});
const F={mode:'seq',seq:{ffs:['Q1','Q0']},nodes:[{id:'Q1',k:'ff',t:'T',ins:['t1']},{id:'Q0',k:'ff',t:'D',ins:['d0']},
  {id:'t1',k:'src',opts:['1']},{id:'d0',k:'sock',ins:['Q0']}],inv:{NOT:1}};
let st={Q1:0,Q0:0}; const seq=[]; for(let i=0;i<5;i++){seq.push(S.stateCode(F,st)); st=S.clock(F,{t1:'1',d0:'NOT'},st,{});}
console.log(JSON.stringify({res, seq, floating:S.clock(F,{t1:'',d0:'NOT'},{Q1:0,Q0:0},{})}))""")
    for a, b, c, d, e, m, f, g in out["res"]:
        assert e == (8 * a + 4 * b + 2 * c + d == 11)
        assert m == [a, b, c, d][2 * a + b]                    # 4-to-1 MUX picks data input S1S0
        assert f == ((1 - a) & b | c & d)                      # SOP plane: OR of product terms
        assert g == (a | (1 - b))                              # POS plane: AND of sum terms
    assert out["seq"] == [0, 3, 0, 3, 0]                       # T toggles (Q1), D copies Q̄0 (Q0)
    assert out["floating"] is None                             # a floating flip-flop input stops the clock


def exhaustive(level):
    """Plain enumeration over every socket assignment (and every lever setting in levers mode)."""
    return run_node(f"""const L=S.LEVELS[{level}], socks=S.sockets(L), opts=socks.map(n=>S.options(L,n));
const levs = L.mode==='levers' ? S.combos((L.levers||[]).map(l=>l.id)) : [S.leverStart(L)];
let count=0, best=Infinity, par=Infinity; const idx=opts.map(()=>0);
while (true) {{
  const a={{}}; socks.forEach((n,i)=>a[n.id]=opts[i][idx[i]]);
  if (S.fits(L,a)) for (const lv of levs) if (S.check(L,a,lv).ok) {{ count++; best=Math.min(best,S.gates(L,a)); par=Math.min(par,S.moves(L,a,lv)); }}
  let k=0; while (k<idx.length && ++idx[k]===opts[k].length) {{ idx[k]=0; k++; }} if (k===idx.length) break;
}}
console.log(JSON.stringify({{count, best, par}}))""")


@functools.lru_cache(maxsize=None)
def levels():
    return run_node("""console.log(JSON.stringify(S.LEVELS.map((L,i)=>{const r=S.solve(L), st=S.check(L,S.blank(L));
  const sol=r.sol, chk=S.check(L,sol.a,sol.lev||undefined);
  return {i, name:L.name, level:L.level, course:L.course, mode:L.mode, best:L.best, par:L.par, count:r.count, sbest:r.best, spar:r.par,
    startOk:st.ok, solOk:chk.ok, solGates:S.gates(L,sol.a), solFits:S.fits(L,sol.a), hints:L.hints.length, intro:!!L.intro, explain:!!L.explain,
    song:L.song, socks:S.sockets(L).length};})))""")


def test_level_list_and_courses():
    ls = levels()
    assert len(ls) >= 40
    assert [x["level"] for x in ls] == [300] * 22 + [400] * 18
    assert all(x["course"] == "EEEN 307: Digital Electronics" for x in ls if x["level"] == 300)
    assert all(x["course"] == "EEEN 405: Digital Electronics II" for x in ls if x["level"] == 400)
    assert all(x["hints"] == 3 and x["intro"] and x["explain"] for x in ls)
    seeds = [tuple(x["song"]) for x in ls]
    assert len(set(s[0] for s in seeds)) == len(seeds) and {s[1] for s in seeds} <= {"calm", "synthwave", "chip", "boss"}
    assert {x["mode"] for x in ls} == {"levers", "table", "seq"}


def test_every_level_is_solvable_never_presolved_and_optimum_is_exact():
    for x in levels():
        assert x["count"] >= 1, x["name"]                                   # solvable within its inventory
        assert not x["startOk"], x["name"]                                  # not solved in its starting state
        assert x["solOk"] and x["solFits"], x["name"]                       # the solver's answer really works
        assert x["sbest"] == x["best"] == x["solGates"], x["name"]          # stated fewest gates is achieved and minimal
        assert x["spar"] == x["par"], x["name"]                             # stated par (fewest moves) is exact


@pytest.mark.parametrize("i", range(40))
def test_independent_exhaustive_search_agrees(i):
    ls = levels()
    ex = exhaustive(i)
    assert ex["count"] == ls[i]["count"] >= 1
    assert ex["best"] == ls[i]["best"] and ex["par"] == ls[i]["par"]


def test_catalogue_and_progress_match_the_levels_once_registered():
    g = C.BY_SLUG.get("logic-labyrinth")
    if not (g and g.playable):
        pytest.skip("logic-labyrinth is not registered as playable yet")
    ls = levels()
    assert g.script == "logic" and "logicsim" in g.extra["deps"]
    assert {lv: s for lv, (s, _) in g.extra["packs"].items()} == {300: "logic-300", 400: "logic-400"}
    assert P.MAX_STAGE["logic-labyrinth"] == len(ls)
    assert P.STAGE_LEVEL["logic-labyrinth"] == [x["level"] for x in ls]


def test_game_script_parses():
    for f in ("logicsim.js", "logic-300.js", "logic-400.js", "logic.js"):
        res = subprocess.run(["node", "--check", str(JS / f)], capture_output=True, text=True)
        assert res.returncode == 0, (f, res.stderr)


def test_python_cross_check_of_key_tables():
    """The truth tables written into the levels are the textbook functions (computed here in Python)."""
    out = run_node("console.log(JSON.stringify(Object.fromEntries(S.LEVELS.filter(L=>L.table).map(L=>[L.name, L.table]))))")
    rows3 = list(itertools.product([0, 1], repeat=3))
    t = out["Parity guard"]["outs"]
    assert t["P"] == "".join(str(a ^ b ^ c) for a, b, c in rows3) and t["O"] == "".join(str(1 - (a ^ b ^ c)) for a, b, c in rows3)
    fa = out["Full adder"]["outs"]
    assert fa["S"] == "".join(str((a + b + c) % 2) for a, b, c in rows3) and fa["Co"] == "".join(str((a + b + c) // 2) for a, b, c in rows3)
    assert out["Half adder"]["outs"] == {"S": "0110", "C": "0001"}
    assert out["De Morgan's door"]["outs"] == {"F": "1110", "G": "1000"}
    assert out["Multiplexer path"]["outs"]["F"] == "".join("1" if m in (1, 2, 6, 7) else "0" for m in range(8))
    km = out["K-map: don't cares"]["outs"]["F"]
    assert km == "".join("1" if m in (1, 3, 7, 11, 15) else "-" if m in (0, 2, 5) else "0" for m in range(16))
    assert out["Product of sums"]["outs"]["F"] == "".join("0" if m in (0, 2, 3) else "1" for m in range(8))
    seg = {0: "abcdef", 1: "bc", 2: "abdeg", 3: "abcdg", 4: "bcfg", 5: "acdfg", 6: "acdefg", 7: "abc", 8: "abcdefg", 9: "abcdfg"}
    sd = out["Seven-segment decoder"]["outs"]
    assert all(sd[s] == "".join("1" if s in seg[int(d)] else "0" for d in "5221") for s in "abcdefg")
