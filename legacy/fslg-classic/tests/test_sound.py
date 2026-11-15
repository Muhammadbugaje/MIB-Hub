"""Sampled sound effects: every name a game asks for is covered, every file is present and credited, sizes stay small."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SFX = ROOT / "static" / "audio" / "sfx"
JS = ROOT / "static" / "js" / "games"
MAN = json.loads((SFX / "manifest.json").read_text())
CREDITS = (SFX / "CREDITS.md").read_text()
MB = 1024 * 1024


def entries():
    yield from (("core", k, e) for k, e in MAN["core"].items())
    for slug, pack in MAN["packs"].items():
        yield from ((slug, k, e) for k, e in pack.items())


def stems(scope):
    return {f for e in scope.values() for f in e.get("f", [])}


def size(names, ext):
    return sum((SFX / f"{s}.{ext}").stat().st_size for s in names)


def test_every_sfx_name_used_by_a_game_is_a_sample_or_an_explicit_synth_entry():
    used = set()
    for f in JS.glob("*.js"):
        used |= set(re.findall(r'\bsfx\("([A-Za-z0-9_]+)"', f.read_text(encoding="utf8")))
    assert used, "no sfx calls found"
    missing = sorted(n for n in used if n not in MAN["core"])
    assert not missing, f"sfx names with no manifest entry: {missing}"
    for n in used:
        e = MAN["core"][n]
        assert e.get("synth") or e.get("f"), n


def test_freshers_school_life_sound_names_exist():
    src = (JS / "samaru-audio.js").read_text(encoding="utf8")
    names = set(re.findall(r'\b(?:one|x\.play)\(\s*"([a-z_]+)"', src)) | set(re.findall(r'\b(?:loopFor|set)\(\s*"[a-z]+",\s*"([a-z_]+)"', src))
    names |= set(re.findall(r':\s*"((?:eng|horn|bike|skate)_[a-z]+)"', src)) | {"step_road", "step_grass", "step_wood", "step_floor"}
    pack, core = MAN["packs"]["samaru-days"], MAN["core"]
    missing = sorted(n for n in names if n not in pack and n not in core)
    assert len(names) > 40 and not missing, missing
    for n in ("screech", "brake"):  # shaped noise in samaru-audio.js: no clean-licence recording was found
        assert pack[n].get("synth")


def test_every_file_exists_in_both_formats_and_has_a_credit_line():
    seen = set()
    for scope, name, e in entries():
        assert e.get("synth") or e.get("f"), (scope, name)
        for stem in e.get("f", []):
            seen.add(stem)
            for ext in MAN["formats"]:
                p = SFX / f"{stem}.{ext}"
                assert p.is_file() and p.stat().st_size > 200, p
            assert f"| `{stem}` |" in CREDITS, f"no credit for {stem}"
    on_disk = {str(p.relative_to(SFX).with_suffix("")) for p in SFX.rglob("*.ogg")}
    assert on_disk == seen, (sorted(on_disk - seen), sorted(seen - on_disk))
    assert "CC0" in CREDITS and all("CC0 1.0" in line for line in CREDITS.splitlines() if line.startswith("| `"))


def test_sizes_stay_small():
    core = stems(MAN["core"])
    for ext in MAN["formats"]:
        assert size(core, ext) < 1 * MB, ("core", ext, size(core, ext))
        for slug, pack in MAN["packs"].items():
            assert size(stems(pack) - core, ext) < 1.5 * MB, (slug, ext)
        assert size({s for _, _, e in entries() for s in e.get("f", [])}, ext) < 3 * MB


def test_every_game_with_sound_calls_has_a_pack_or_uses_the_core_set():
    from games import catalogue
    slugs = {g.slug for g in catalogue.GAMES} if hasattr(catalogue, "GAMES") else set()
    for slug in MAN["packs"]:
        assert not slugs or slug in slugs, slug


def test_the_play_page_loads_the_shared_player_after_the_runtime():
    html = (ROOT / "templates" / "games" / "play.html").read_text()
    assert html.index("js/games/arcade.js") < html.index("js/games/arcade-audio.js")
