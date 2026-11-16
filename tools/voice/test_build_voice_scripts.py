"""Tests for build_voice_scripts.py. Run from the repo root:
    python3 -m unittest tools/voice/test_build_voice_scripts.py
"""
import re
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_voice_scripts as bv  # noqa: E402

GOOD = """# Barks: Test
**Id:** npc.test
**Voice:** Calm.

## Filler
### greet
- `bk_test_f_greet_01` (warm) "Sannu! [Hello!]"
- `bk_test_f_greet_02` (dry) "You again." · when: night

## Year 3
### idle
- `bk_test_y3_idle_01` (sad) "No lectures. Still tired."
"""


def parse(text):
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "test.md"
        p.write_text(text, encoding="utf-8")
        errors = []
        actor, voice, lines = bv.parse_barks(p, errors)
    return actor, voice, lines, errors


class BarkParsing(unittest.TestCase):
    def test_good_file(self):
        actor, voice, lines, errors = parse(GOOD)
        self.assertEqual(errors, [])
        self.assertEqual(actor, "npc.test")
        self.assertEqual(len(lines), 3)
        self.assertEqual(lines[1].when, "night")
        self.assertEqual(lines[2].where, "Year 3 · idle")

    def test_bad_mood(self):
        self.assertTrue(parse(GOOD.replace("(sad)", "(furious)"))[3])

    def test_too_long(self):
        self.assertTrue(parse(GOOD.replace("No lectures. Still tired.", "a" * 91))[3])

    def test_id_must_match_stage_and_category(self):
        self.assertTrue(parse(GOOD.replace("bk_test_y3_idle_01", "bk_test_y2_idle_01"))[3])

    def test_event_ids_short_and_long_forms(self):
        ev = GOOD + '\n## Events\n### ev_strike\n- `bk_test_ev_strike_01` (sad) "No class."\n' \
                    '- `bk_test_ev_ev_strike_02` (sad) "Still no class."\n'
        self.assertEqual(parse(ev)[3], [])

    def test_unknown_category_and_stage(self):
        self.assertTrue(parse(GOOD.replace("### idle", "### dance"))[3])
        self.assertTrue(parse(GOOD.replace("## Year 3", "## Year 9"))[3])

    def test_malformed_line(self):
        self.assertTrue(parse(GOOD.replace('(warm) "Sannu! [Hello!]"', "(warm) Sannu"))[3])

    def test_banned_name(self):
        self.assertTrue(parse(GOOD.replace("No lectures.", "Kaltume says no lectures."))[3])

    def test_missing_header(self):
        self.assertTrue(parse(GOOD.replace("**Voice:** Calm.\n", ""))[3])


class StoryLines(unittest.TestCase):
    def test_every_line_has_a_speaker_and_text(self):
        lines = bv.story_lines()
        self.assertGreater(len(lines), 1900)
        self.assertEqual(len({ln.id for ln in lines}), len(lines))
        self.assertTrue(all(ln.who and ln.text for ln in lines))

    def test_special_play_lines_are_included(self):
        ids = {ln.id: ln.who for ln in bv.story_lines()}
        self.assertEqual(ids.get("m002_play_j01"), "special.jiya")

    def test_cue_is_previous_line(self):
        lines = {ln.id: ln for ln in bv.story_lines()}
        self.assertTrue(lines["m002_open_j01"].cue.startswith("Mrs. Adebayo:"))


    def test_every_say_in_the_missions_is_a_story_line(self):
        said = set()
        for f in bv.cm.YEAR_FILES:
            said |= set(re.findall(r"say: *\{[^\n]*?\bid: *(\w+)", f.read_text(encoding="utf-8")))
        self.assertGreater(len(said), 1700)
        self.assertEqual(said - {ln.id for ln in bv.story_lines()}, set())

    def test_special_play_lines_with_a_direction_are_kept(self):
        """Regression: `id` (to Jega) "line" was dropped, so Jiya and Taty each lost a dozen lines."""
        lines = {ln.id: ln for ln in bv.story_lines()}
        self.assertEqual(lines["m008_play_t04"].who, "special.taty")
        self.assertEqual(lines["m008_play_t04"].note, "to Jega")
        self.assertTrue(lines["m019_play_j03"].text.startswith("Oh, don't change the boots."))
        listed = set()
        for f in bv.cm.YEAR_FILES:
            listed |= set(re.findall(r"`(m\d{3}_play_[jtdb]\d{2})`", f.read_text(encoding="utf-8")))
        self.assertEqual(listed - set(lines), set())


class Scripts(unittest.TestCase):
    """The scripts as the people recording see them, built from the real missions and bark packs."""

    @classmethod
    def setUpClass(cls):
        errors = []
        voices, cls.barks = bv.load_barks(errors)
        assert not errors, errors
        cls.story = bv.story_lines()
        cls.info = bv.mission_info()
        cls.scripts, cls.small = bv.plan(cls.story, cls.barks, voices)
        cls.built = {k: bv.script_md(t, ids, v, st, bk, cls.info) for k, (t, ids, v, st, bk) in cls.scripts.items()}
        cls.built["small_parts"] = bv.small_parts_md(cls.small, cls.info)

    def test_every_line_lands_in_exactly_one_script(self):
        where = {}
        for key, (_, lines) in self.built.items():
            ids = [ln["id"] for s in lines["sections"] for ln in s["lines"]] + [ln["id"] for ln in lines["pending"]]
            self.assertEqual(len(ids), len(set(ids)), key)
            for i in ids:
                where.setdefault(i, []).append(key)
        roomie = {ln.id for ln in self.story + self.barks if ln.who == "npc.roomie"}
        for ln in self.story + self.barks:
            want = ["bature", "firdausi"] if ln.id in roomie else 1
            got = where.get(ln.id, [])
            self.assertEqual(got if ln.id in roomie else len(got), want, ln.id)
        self.assertEqual(set(where), {ln.id for ln in self.story + self.barks})

    def test_special_scripts_have_all_their_lines(self):
        for key, who in (("special_jiya", "special.jiya"), ("special_taty", "special.taty")):
            want = {ln.id for ln in self.story + self.barks if ln.who == who}
            got = {ln["id"] for s in self.built[key][1]["sections"] for ln in s["lines"]}
            self.assertEqual(got, want)

    def test_no_ids_or_codes_reach_the_reader(self):
        leak = re.compile(r"bk_|m\d{3}_|npc\.[a-z]|special\.[a-z]|prop\.[a-z]|crowd\.[a-z]|lang_|_soon|_done|_LINE|`|\{\{|§")
        for key, (md, _) in self.built.items():
            for n, line in enumerate(md.split("\n"), 1):
                self.assertIsNone(leak.search(line), f"{key}:{n}: {line[:120]}")
                self.assertNotEqual(len(line), 1, f"{key}:{n}: a line of one character")

    def test_numbers_restart_in_every_section_and_match_the_map(self):
        md, lines = self.built["jega"]
        blocks = re.split(r"^::: ", md, flags=re.M)[1:]
        self.assertEqual(len(blocks), len(lines["sections"]))
        for block, sec in zip(blocks, lines["sections"]):
            nums = [int(n) for n in re.findall(r"^:: (\d+) \|", block, re.M)]
            self.assertEqual(nums, list(range(1, len(sec["lines"]) + 1)))
            self.assertEqual(nums, [ln["n"] for ln in sec["lines"]])
            self.assertTrue(block.startswith(sec["section"]))
        self.assertEqual(lines["sections"][0]["file"], "Jega - Mission 1")

    def test_script_has_cover_guide_and_agreement(self):
        md, _ = self.built["abbas"]
        self.assertIn("<!-- cover: Abbas | ", md[:200])
        for part in ("# Meet Abbas", "# How to record", "# Mission lines", "# Common lines", "# Volunteer voice agreement"):
            self.assertIn(part, md)
        self.assertNotIn("My likeness", md)
        self.assertIn("My likeness", self.built["special_jiya"][0])
        self.assertIn("Story Pack", self.built["special_taty"][0])

    def test_every_script_has_a_tagline(self):
        for key, (title, ids, *_rest) in self.scripts.items():
            self.assertIn(ids[-1], bv.CHARACTERS, key)

    def test_guide_is_one_block_not_letters(self):
        """Regression: `out += GUIDE` once spread the guide one character per line."""
        md, _ = bv.script_md("Test", ["npc.test"], "", [], [], {})
        self.assertIn("How to record", md)
        self.assertFalse([ln for ln in md.splitlines() if len(ln) == 1])


class PlainEnglish(unittest.TestCase):
    def test_conditions(self):
        titles = {17: "Keke Grand Prix"}
        self.assertEqual(bv.plain_condition("night", titles), "only at night")
        self.assertEqual(bv.plain_condition("player_female, friendship>=3", titles), "to a female player, once you're good friends")
        self.assertEqual(bv.plain_condition("m017_done", titles), "after “Keke Grand Prix”")
        with self.assertRaises(ValueError):
            bv.plain_condition("moon_is_full", titles)

    def test_when(self):
        self.assertEqual(bv.when_text("Y1 · Freshers' Week · Tue · 08:00–16:00."), "Year 1, the first week")
        self.assertEqual(bv.when_text("Y3 · Strike wk 5 · Mon–Wed"), "Year 3, during the strike")
        self.assertEqual(bv.when_text("Y2 · S1 Wk 7 · Tue (test week)"), "Year 2, first semester, test week")
        self.assertEqual(bv.when_text("some years later · a resumption Monday"), "Some years later")

    def test_tokens_and_brackets(self):
        self.assertEqual(bv.show("Kai, {{PLAYER_NAME}}. Ask {{ROOMIE}}."), "Kai, (name). Ask Bature/Firdausi.")
        ln = bv.Line("x", "npc.jega", "warm", "[Going slowly does not stop you arriving.]", "M107 · c")
        self.assertEqual(bv.story_text(ln), "Going slowly does not stop you arriving.")
        self.assertIn("say it in English", bv.story_tag(ln))


if __name__ == "__main__":
    unittest.main()
