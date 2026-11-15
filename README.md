# campus-game (working folder name)

This is the new standalone home of the open-world Nigerian university-life game. Until now it was called "Freshers School Life", or FSLG. The real name is not decided yet, so names are always written as tokens:

| Token | Meaning |
|---|---|
| `{{GAME_NAME}}` | The game's title (lives in config, never hard-coded) |
| `{{UNI_NAME}}` | The fictional university |
| `{{TOWN}}` | The town around it |

The game used to live inside the EE Hub Django project (`~/Downloads/eehub-2`). Stage 0 **copied** everything the game needs into this repo. Nothing in Django was moved, changed or deleted. All new work happens here.

## What is in here (Stage 0)

| Path | What it is |
|---|---|
| `docs/plan/` | The current plan: Master Game Guide **V3** (it wins when guides disagree) and **V2** (the engineering rulebook), Game Design V1, Story Bible V2, Social Media Journey, mission scripts (`missions/`), people story packs (first names only), character renders and the procedural Babylon character generator (`characters/`), and the visual prototype stills |
| `docs/legacy/` | Useful docs from the old game: the v1 guide, AUDIT, STATE, KNOWN_ISSUES, VALIDATOR_REPORT, FSLG_REVIEW, the cheats and humour docs, FABLE.md (the last handover), `story/` (bible, outline, backstories, scripts), `voice/` (recording script, lines, role PDFs) and `trailer/` (shot lists, VO scripts, render pipeline; no videos) |
| `legacy/fslg-classic/` | A **frozen, read-only** copy of the old three.js game's source, tests, tools, sound library and Django glue. It is a reference for the "Classic" freeze. Its rendering code is **not** carried over (see its README) |
| `docs/CARRY_OVER.md` | V3 §5 as an item-by-item inventory: where each thing is, the decision, and where it goes in the new monorepo |
| `docs/DJANGO_INVENTORY.md` | What still lives in Django (URLs, models, admin, settings, touchpoints) that this project must replace or link to |

No game code exists yet. That begins in Stage 1.

## The stage order (V3 §3)

| Stage | Name | Gate |
|---|---|---|
| **0** | Freeze, back up, audit (**this commit**) | Owner approves the audit and carry-over list |
| 1 | New home: TypeScript monorepo, website shell on Cloudflare, local SQLite, run guide, Classic embedded and playable | Website live |
| 2 | Engine bake-off: Babylon.js vs PlayCanvas, same scene, real measurements | **Engine decision** |
| 3 | Art direction and character pipeline | Look approved |
| 4 | Vertical slice: opening film → missions 1–3 → one district | **"This is the game"** |
| 5 | Soft launch (Early Access) | Go or no-go |
| 6 | Content waves | Each wave |
| 7 | Platform and money (each switched on separately) | Each switch-on |
| 8 | More games on the same platform | Per game |

Planned monorepo layout (V2 §19.2, V3 §6): `apps/web`, `apps/game-fsl`, `apps/dev-api`, `packages/{engine-core,engine-adapter,platform,config,data,ui-kit,tools}`, `content/<game>/`, `assets/<game>/`, `docs/`, `tests/`, `scripts/`.

## Rules (short version; the guides are the full version)

1. **Read first.** Start every session by reading `docs/plan/MASTER_GAME_GUIDE_V3.md`, then `docs/plan/MASTER_GAME_GUIDE_V2.md`. Where V3 and V2 disagree, V3 wins (V3 §4).
2. **Never touch the Django project.** Copy from it, read from it, export from it. No migrations, deletes or resets against it (V2 rule 13).
3. **No secrets.** No keys, passwords, tokens, `.env` files, databases or media uploads go in this repo. Use `.env.example` and placeholders (V2 rule 14).
4. **Privacy.**
   - Never commit photos of real people. The reference photos stay outside the repo, and `.gitignore` blocks the usual folders and formats.
   - Use first names only for real people.
   - Special characters need signed release forms before they appear (V3 §9.3).
5. **One source of truth, tokens for anything that changes.** That covers the name, the university, the town, the currency label and the credits (V2 §4–5).
6. **Small, exact edits, re-checked by tests** (this replaces V2's "complete files only"; see V3 §4).
7. **Every change ships with a check**: a validator rule, a bot assertion or a checklist item.
8. **Never invent results.** Screenshots, benchmarks and test results come from real runs.
9. **Verify anything that changes over time** (licences, hosting limits, prices) on the day you rely on it, and record the date.
10. **Git.**
    - Branch for work.
    - Tag before big changes.
    - Commit no build output.
    - Commit no large videos (list them by path instead; see `docs/CARRY_OVER.md`).
11. **macOS 12 note:** Playwright doesn't run on the owner's Mac. Use the offscreen WebKit screenshot pipeline (V3 §4).
