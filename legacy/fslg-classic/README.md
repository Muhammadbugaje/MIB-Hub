# fslg-classic: frozen reference copy of the old game

This is a copy of the old three.js "Freshers School Life" (FSLG) game. It was taken on 15 Nov 2026 from `~/Downloads/eehub-2`, and that Django project was left untouched.

**It is reference only.**
- Do not develop here, and do not import from here into new code.
- It exists so we can:
  - freeze and embed the old game as **"Classic"** in Stage 1 (V3 §3 and §16, step 2);
  - read the old rules, data and tests while rebuilding them on the new engine.

**The rendering code is NOT carried over (V3 §5, "Left behind").** That means:
- the custom three.js renderer;
- the blocky jointed characters;
- the 2D-era drawing;
- the animation polish done in this engine.

The design, data, writing and rules carry over as data or as specs. `docs/CARRY_OVER.md` gives the decision for every file.

## Layout (mirrors the Django project's paths)

| Here | From eehub-2 | Notes |
|---|---|---|
| `static/js/games/samaru-*.js`, `fslg-*.js`, `fslg.config.js` | same | The game source: 59 files, loaded in the order of `django/games/catalogue.py` (`samaru-days` → `extra.deps`) |
| `static/js/games/arcade*.js` | same | The shared arcade runtime that the game page loads: settings, audio, sounds, offline and LAN |
| `static/vendor/three@0.158.0`, `qrcode-generator@1.4.4` | same | MIT licences included. Only `three.module.min.js` is kept (the play page loads that one) |
| `static/audio/` | same | The CC0 SFX library (`sfx/CREDITS.md`), the intro score and the recorded intro voice lines with manifests |
| `static/img/samaru-days-*.png` | `static/img/games/` | Home-screen icons (generated) |
| `tests/` | `games/tests/` | The validator, bot, harnesses, soak and bench (Node), plus the pytest wrappers. The wrappers need Django; the `.js` files run on Node alone |
| `tools/story`, `tools/voice`, `tools/sfx`, `tools/intro` | `tools/` | The generators for story JS, voice scripts and PDFs, SFX and the intro score. `tools/voice/.venv` was left out |
| `django/games/` | `games/` | The Django glue as a spec for the new admin, data layer and API: models, views, URLs, `fslg_admin` (editors), cheats, sounds, rooms (LAN), offline packages, bundle builder, map generator, management commands and the FSLG content migration |
| `django/templates/games/` | `templates/games/` | The play page and the Arcade Management templates. `fslg-admin.css` sits next to them |

## Not copied
- `fslg.bundle.js` is a build output; rebuild it with `django/games/bundle.py`.
- The trailers and the opening film (mp4) are listed in `docs/CARRY_OVER.md`.
- The database, media uploads and `.env` were left out (rules: no secrets, no personal data).
- The other arcade games are not part of this project.

## Running it frozen (Stage 1 task, not done yet)
The game expects:
- a page that provides `data-gm-*` attributes (see `django/templates/games/play.html`);
- the `Arcade` runtime;
- three.js at the path in `data-gm-three`.

Stage 1 will add a small static play page that loads these files in catalogue order, so Classic runs without Django.
