"""Tests for build_voice_scripts.py. Run from the repo root:
    python3 -m unittest tools/voice/test_build_voice_scripts.py
"""
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


if __name__ == "__main__":
    unittest.main()


def test_guide_is_one_block_not_letters():
    """Regression: `out += GUIDE` once spread the guide one character per line."""
    md = bv.script_md("Test", ["npc.test"], "", [], [])
    assert "How to use this script" in md
    assert not any(len(l) == 1 and l.isalpha() for l in md.splitlines())
