# Arcade cheat and rule defaults

One file per game: `<slug>.json` (the slug from `games/catalogue.py`).

```json
{
  "cheats": [{"id": "coins", "label": "1000 coins", "typed": "richkid", "dial": "*7391*44#", "note": "optional"}],
  "hero":   {"name": "M.I. BUGAJE", "combo": "Up Up Down Down Left Right", "swipe": "Swipe a Z on the title screen"},
  "rules":  [{"key": "lives", "label": "Starting lives", "type": "int", "default": 3, "min": 1, "max": 9},
             {"key": "difficulty", "label": "Difficulty", "type": "choice", "default": "normal", "choices": ["easy", "normal", "hard"]}]
}
```

`rules` is optional; types are `int`, `float`, `bool`, `choice`. These are only the defaults: the owner edits codes
and rules at `/arcade/settings/`, and overrides are stored in the database (`games.GameSettings`). The page never
receives a plain code, only `sha256(slug + ":" + code)` with the code lower-cased and whitespace removed.
A missing or broken file means "no cheats, no rules" for that game; it never breaks the page.
