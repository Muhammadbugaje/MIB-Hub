"""Tests for check_missions.py. Run from the repo root:  python3 -m unittest tools/story/test_check_missions.py"""
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_missions as cm  # noqa: E402

FMT = cm.format_lists(cm.FORMAT.read_text(encoding="utf-8"))
QUOTES = cm.rumi_quotes(cm.QUOTES.read_text(encoding="utf-8"))

STORY = " ".join(["word"] * 450)


def mission(num, when="Y1 · S1 Wk 2 · Mon · 09:00", title="Test", special="- None.", extra_say="",
            step7="", cast="PLAYER: player, ROOMIE: npc.roomie", body_extra=""):
    return f"""#### M{num:03d} · {title}
**When:** {when}. **Where:** gate. **Who:** you.
**Connects to:** nothing.
**Mystery:** plants C-NOTE.

**Story.** {STORY} {body_extra}

**Steps.**
1. `Walk` · `loc.gate.main` · completeWhen: `reach(x)`
2. `Walk` · `loc.gate.main` · completeWhen: `reach(x)`
3. `Walk` · `loc.gate.main` · completeWhen: `reach(x)`
4. `Walk` · `loc.gate.main` · completeWhen: `reach(x)`
{step7}

**Special characters.**
{special}

**Cutscenes.**
```cutscene
id: cut_m{num:03d}_open
type: full
maxDuration: 30
cast: {{ {cast} }}
timeline:
  - at: 1.0  say: {{ who: ROOMIE, id: m{num:03d}_open_01, text: "Hello.", mood: warm }}
{extra_say}
endState: {{}}
```
```cutscene
id: cut_m{num:03d}_close
type: full
maxDuration: 30
cast: {{ PLAYER: player }}
timeline:
  - at: 1.0  camera.cut: {{ shot: wide, from: a, look: b, dur: 2.0 }}
endState: {{}}
```

**Reward:** none.
"""


def run(*texts):
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "Y1.md"
        p.write_text("\n".join(texts), encoding="utf-8")
        missions = cm.parse_file(p)
    findings, _ = cm.check(missions, FMT, {}, QUOTES)
    return {f.code for f in findings if f.level == "ERROR"}, findings


class RealFiles(unittest.TestCase):
    def test_current_story_has_no_errors(self):
        findings, summary = cm.run()
        errors = [f"{f.where}: {f.msg}" for f in findings if f.level == "ERROR"]
        self.assertEqual(errors, [])
        self.assertEqual(summary["missions"], 120)
        self.assertEqual(len(summary["seal_items"]), 10)


class Detects(unittest.TestCase):
    def codes(self, *texts):
        return run(*texts)[0] - {"numbering"}

    def test_clean_mission(self):
        self.assertEqual(self.codes(mission(1)), set())

    def test_long_line(self):
        say = '  - at: 2.0  say: { who: ROOMIE, id: m001_open_02, text: "' + "a" * 91 + '", mood: warm }'
        self.assertIn("line-length", self.codes(mission(1, extra_say=say)))

    def test_same_id_different_words(self):
        say = '  - at: 2.0  say: { who: ROOMIE, id: m001_open_01, text: "Bye.", mood: warm }'
        self.assertIn("line-id-dup", self.codes(mission(1, extra_say=say)))

    def test_same_id_same_words_is_fine(self):
        sc = '- **[IF special.jiya]** helps. Lines: `m001_open_01` "Hello."\n- **[ELSE]** nobody.'
        self.assertNotIn("line-id-dup", self.codes(mission(1, special=sc)))

    def test_if_without_else(self):
        self.assertIn("else", self.codes(mission(1, special="- **[IF special.taty]** runs.")))

    def test_bad_mood_and_anim(self):
        say = ('  - at: 2.0  say: { who: ROOMIE, id: m001_open_02, text: "Hi.", mood: furious }\n'
               '  - at: 3.0  actor.anim: { who: ROOMIE, anim: backflip }')
        self.assertTrue({"mood", "anim"} <= self.codes(mission(1, extra_say=say)))

    def test_horns_is_allowed(self):
        say = '  - at: 3.0  actor.anim: { who: ROOMIE, anim: horns }'
        self.assertNotIn("anim", self.codes(mission(1, extra_say=say)))

    def test_optional_role_outside_if(self):
        say = '  - at: 2.0  say: { who: JIYA, id: m001_open_j01, text: "Right.", mood: dry }'
        codes = self.codes(mission(1, extra_say=say, cast="PLAYER: player, ROOMIE: npc.roomie, JIYA?: special.jiya"))
        self.assertIn("optional-role", codes)

    def test_optional_role_inside_if(self):
        say = ('  - if: special.jiya\n    then:\n'
               '      - at: 2.0  say: { who: JIYA, id: m001_open_j01, text: "Right.", mood: dry }')
        codes = self.codes(mission(1, extra_say=say, cast="PLAYER: player, ROOMIE: npc.roomie, JIYA?: special.jiya"))
        self.assertNotIn("optional-role", codes)

    def test_calendar_out_of_order(self):
        codes = self.codes(mission(1, when="Y1 · S1 Wk 4 · Sat · 16:00"), mission(2, when="Y1 · S1 Wk 4 · Tue · 17:00"))
        self.assertIn("calendar", codes)

    def test_calendar_strike_then_resumed_is_fine(self):
        codes = self.codes(mission(1, when="Y3 · Strike wk 28 · Sat · 18:00"),
                           mission(2, when="Y3 · resumed S1 Wk 2 · Thu · 09:00"))
        self.assertNotIn("calendar", codes)

    def test_heist_order(self):
        codes = self.codes(mission(1, title="A (Heist 1)"), mission(2, title="B (Heist 3)"))
        self.assertIn("heist", codes)

    def test_placeholder_and_banned_names(self):
        self.assertIn("placeholder", self.codes(mission(1, body_extra="[RUMI_Q5: paste]")))
        self.assertIn("banned", self.codes(mission(1, body_extra="Kaltume waved.")))

    def test_seal_fitted_early(self):
        step = "5. `Fit the Engineering Seal` · completeWhen: `use(item.seal_engineering)`"
        self.assertIn("seals", self.codes(mission(24, step7=step)))

    def test_zainab_never_dark(self):
        self.assertIn("zainab", self.codes(mission(1, body_extra="Zainab, dark-skinned, laughs.")))

    def test_rumi_must_be_verbatim(self):
        bad = mission(1, body_extra="rumi_q5: true")
        self.assertIn("rumi", self.codes(bad))
        q = QUOTES["Q5"]
        say = "\n".join(f'  - at: {2 + i}.0  say: {{ who: ROOMIE, id: m001_open_0{2 + i}, text: "{line}", mood: warm }}'
                        for i, line in enumerate(q))
        self.assertNotIn("rumi", self.codes(mission(1, body_extra="rumi_q5: true", extra_say=say)))


if __name__ == "__main__":
    unittest.main()
