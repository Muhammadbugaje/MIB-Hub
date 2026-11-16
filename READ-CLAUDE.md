# READ-CLAUDE: handover into MIB-Hub

Read this first in every new Claude session in this folder. It explains what MIB-Hub is, what has already been done, where everything is, and what to do next.

Written 15 November 2026, when the project moved out of the old Django site (`~/Downloads/eehub-2`).

---

## 1. What MIB-Hub is

MIB-Hub is a website that hosts many browser games. It replaces the games part of the old Django site. Its flagship game is a 3D open-world Nigerian university-life game. The game's working name is still open; it uses the tokens `{{GAME_NAME}}`, `{{UNI_NAME}}` and `{{TOWN}}`.

The owner is new to TypeScript. Explain things simply, and give the owner PDFs rather than Markdown for documents they read.

**The old Django project is finished with.** Do not edit `~/Downloads/eehub-2`. Everything needed was copied here. Only read it if something turns out to be missing, then copy that across and note it in `docs/CARRY_OVER.md`.

## 2. Where everything is

| Path | What it is |
|---|---|
| `apps/web/` | The website: Astro 5 + React + TypeScript. Pages, auth, the admin panel and the game player. |
| `packages/db/` | The database: Drizzle ORM schema, migrations, and the repository layer (`repos.*`). |
| `packages/ui/` | The design system: colour, type and spacing tokens, dark and light themes, motion, the theme toggle. |
| `data/seed/` | Data moved from Django: `games.json` (16 games), `cheats.json` (151 codes, hashed), `heroes.json` (hero password hashes), `site_settings.json`. `data/seed/private/` holds the plain cheat codes and is git-ignored. |
| `docs/plan/` | The game plan: `MASTER_GAME_GUIDE_V3.md` (the master plan; v3 wins over v2), `STORY_BIBLE_V2.md`, `GAME_DESIGN_V1.md`, `SOCIAL_MEDIA_JOURNEY.md`, `missions/` (Y1–Y5, 120 missions, plus `FORMAT.md`), `people/` (Jiya and Taty story packs), `characters/` (cartoon renders and their generator). |
| `docs/port/` | Build specs for moving the old site: `GAMES.md` (every game), `MANAGEMENT.md` (49 admin screens), `GUIDES.md` (62 guides), `DESIGN.md` (the look). |
| `docs/ARCHITECTURE.md`, `docs/DATABASE.md`, `docs/DECISIONS.md` | How the code is laid out, how the database works locally and in production, and why each choice was made. |
| `docs/SETUP_GUIDE.md` and `.pdf` | The beginner's guide for the owner: install, run, accounts, database, deploy. |
| `legacy/fslg-classic/` | Frozen copy of the old campus game ("Classic"). Reference only; its rendering code is not carried over. |
| `games/work-in-progress/` | **The new open-world game ("Work in Progress", PlayCanvas 2.23.3).** Its source, tests, asset tools, `CREDITS.md` and `docs/RESEARCH.md` live here. `npm run build:wip` builds it into `apps/web/public/play-files/work-in-progress/` (kept apart from the `/play/work-in-progress` page route so Cloudflare never shadows the page); the play page shows it through `apps/web/src/games/work-in-progress.ts`. Stills: `tools/shot.py`. |
| `legacy/eehub-django/` | Frozen copy of all the old games' code, the site's CSS, fonts, images, sounds and templates, and the Django `games` and `accounts` apps. Reference for the port. |
| `~/Downloads/games-files/` | Outside the repo. Videos (trailers), screenshots, notes, voice files and design art. See its `INDEX.md`. Its videos and screenshots are hard links: editing one in place also changes the original. |

## 3. What works today

- `npm run dev` starts the site at http://localhost:4321.
- Register, sign in, sign out, forgot and reset password (the reset link prints in the terminal), and the profile page.
- Dark and light themes that follow the system, with a toggle that remembers the choice.
- `/admin`: only owner and admin roles can open it; players get a 403. It shows the overview; each section is marked "soon".
- The database seeds the 16 games, the owner account (from `.env`), cheats and heroes.
- Checks: `npm run typecheck`, `npm run lint`, `npm test` (53 tests) and `npm run build` all pass as of commit `8b1f12d`.
- `npm run db:studio` opens the local database in the browser (Drizzle Studio). `docs/HOW_TO_RUN.pdf` is the owner's one-page guide to running everything.
- **Story audit done (15 Nov 2026).** `tools/story/check_missions.py` checks all 120 missions (0 errors, 0 warnings; 17 tests in `tools/story/test_check_missions.py`). `docs/plan/STORY_AUDIT.md` (and `.pdf`) lists every fix, what is still open (§5), the clue ledger and 10 owner questions. `docs/plan/MISSION_SCRIPTS.pdf` is the full readable script. Rebuild PDFs with `.venv/bin/python tools/story/md2pdf.py`.

## 4. What to do next, in order

1. **(DONE 15 Nov 2026; see `docs/plan/STORY_AUDIT.md`. Open items are in its §5 and §7.)** **Story audit, before any game code.** The whole story is written, but the writers left a list of known inconsistencies:
   - the seal count at M60;
   - where the seals go: the garden coil (M024) or the door under the clock (M114);
   - the two Aishas: keep it as a deliberate, unexplained hint, and confirm with the owner;
   - Year 4 dates out of order (M93/M94);
   - heist numbering (M44, M81, M101);
   - Jega's recovery time (M78);
   - the M56 reward;
   - Rakiya, the M71 bride, is missing from the bible;
   - bible §8.9 is missing M115, M117 and M119;
   - Rumi placeholders `[RUMI_Q5]` and `[RUMI_Q6]` in Y2: paste them verbatim from `docs/legacy/story/QUOTES.md`;
   - add the `horns` anim to FORMAT.md.

   Then do a full continuity and clue pass. Write `tools/story/check_missions.py` for the mechanical checks, and write `docs/plan/STORY_AUDIT.md` with fixes, a clue ledger and at most 10 owner questions. Rebuild the story PDFs afterwards.
2. **Port the games** (`docs/port/GAMES.md`). First, make the two hashing schemes compatible.
   - The seed data keeps the **old Django hashes**: hero passwords are Django pbkdf2, and the cheat codes use the old game scripts' scheme.
   - The new schema expects scrypt and salted SHA-256.
   - So add a verifier that accepts the old format and re-hashes to the new one on first successful use. Don't ask anyone to reset codes.

   Then the porting itself: Each game mounts through `apps/web/src/games/contract.ts` and is registered in `registry.ts`. Assets come from `legacy/eehub-django/static/`. Add the platform API routes for saves, scores and progress.
3. **Management panel** (`docs/port/MANAGEMENT.md`). Build each section in `apps/web/src/lib/admin-sections.ts`. Call `repos.audit.record` on every write.
4. **Public pages and guides** (`docs/port/DESIGN.md`, `GUIDES.md`): a polished landing page, the arcade, leaderboards, and how-to guides for players and admins.
5. **Asset plan** for the new 3D game. Use free assets (Kenney and Quaternius are CC0; Poly Haven and ambientCG for textures; Sketchfab and Poly Pizza per-model licence; Mixamo animations), refined to look original. Keep a credits file with the source and licence of every asset. Set size budgets per model, use LODs, compressed textures and instancing, and stream by area. Aim for lots of variety: vehicles (cars, okada, keke, danfo), shops, props.
6. **Characters (Stage 3, art direction).** The procedural characters in `docs/plan/characters/` are only a likeness sketch. The owner dislikes the noses and the glassy hair. Real game characters need proper modelled meshes, not code-built ones; see section 6.
7. **Engine: PlayCanvas (owner decision, 16 Nov 2026; no bake-off).** Then the vertical slice: a walkable campus chunk full of NPCs first, then missions about 10 at a time with subtitle text, and voices plugged in by line id later. Look: a whole new look, more professional and realistic but still cartoonish and fun, and light on the browser.

**Owner requests added 15 Nov 2026 (after the audit), in this order:**
- **(First pass DONE 15 Nov 2026: 56 scripts, 1,977 story lines and 4,855 barks; `docs/voice/scripts/INDEX.md`, PDFs in `docs/voice/pdf/`, format in `docs/voice/BARKS_FORMAT.md`; rebuild with `.venv/bin/python tools/voice/build_voice_scripts.py --pdf`.)** **Voice scripts:** one dedicated script per voiced character (at least 15–20 named characters), plus general public scripts. Include unscripted filler lines and multiple-choice replies, and give every NPC varied things to say for each year and stage, so the world feels alive. Generate the per-character scripts from the mission files with `tools/voice/`. Hand-write the barks and filler.
- **(Plan DONE 15 Nov 2026: `docs/plan/ASSET_AND_MOTION_PLAN.md` and `.pdf`; its 7 opening decisions need the owner's OK.)** **Game feel:** assets, animation, motion and physics for running, driving and (cartoon, non-lethal) scuffles. It must be smooth. Repeat none of the old game's mistakes; the list is in `docs/legacy/KNOWN_ISSUES.md`, `FSLG_REVIEW.md` and `AUDIT.md`. This belongs with step 5 and step 7.
- **Site:** a play tracker and analytics (plays, hardest and most-liked levels, trends); a full management panel (characters, sounds, settings, cheats, switches); player feedback, complaints, help and support; news and publications, update promos, deals, ads, events and payments.
- **Community:** founders, top supporters and credits, added dynamically with photos; history. Premium design with gaming vibes. This extends steps 3 and 4.

## 5. Rules (from the owner and the master guides)

- **Privacy:**
  - Real people's photos never go into git or anywhere online. The Jiya and Taty reference photos stay in `eehub-2/docs/jiya` and `docs/taty` and are never copied.
  - Use first names only.
  - Never import real users' accounts, profiles or scores from Django.
- **Special characters** (Jiya, Taty, Zainab, Madison) appear only in `[IF special.x]` blocks with fallbacks. They need signed consent before anything public uses them. The public trailer leaves them out.
- **Zainab** is very fair-skinned, nicknamed "Snow White" by friends. Never draw her dark.
- **Kaltume is renamed Helen** (`npc.helen`); "IDK" stays her nickname.
- **Fictional university and town.** No real university names or logos in the game. `legacy/eehub-django/static/img` contains a real university crest; never reuse it.
- **Content:** modest clothing, non-lethal, opposite-sex romance only, humour never mocks groups, Rumi quotes verbatim only.
- **No secrets in git.** `.env` stays local; cheat codes and hero passwords are stored hashed.
- **Code style:** small, exact edits; tests for every system; pinned dependency versions; a commit message ending in the co-author line.
- **Disk is tight** on this Mac (often under 3 GB free). Check `df -h /System/Volumes/Data` before big installs or renders.

## 6. Notes on the cartoon characters

`docs/plan/characters/generator/` (plus `fable/generator/`) is a Babylon.js script that builds characters from shapes: spheres, tubes and ribbons. It was quick for likeness sketches, but it has a low ceiling:
- the nose is built from primitive shapes, so it never looks natural;
- the hair is ribbons with a shiny material, so it reads as glass or plastic.

Recommended path for real game characters:
1. **Start from a proper base mesh**, then style faces, hair and outfits on it. Options:
   - VRoid Studio: free; exports VRM and loads into Babylon. Anime-leaning.
   - A CC0 base from Quaternius, refined in Blender.
   - A commissioned 3D artist, for the leads.
2. **Hair:** use hair cards with a painted strand texture, alpha, and a rough, non-glossy material (low specular, no clearcoat).
3. **Noses:** a soft sculpted shape in the mesh, plus shading, or a simple stylised nose as in most cartoon games.
4. **One rig and one animation set** (Mixamo-compatible) shared by every character.

## 7. Running it

See `docs/SETUP_GUIDE.pdf`. In short:

```
export PATH=~/.nvm/versions/node/v24.22.2/bin:$PATH
npm install
cp .env.example .env      # then fill it in
npm run db:migrate && npm run db:seed
npm run dev               # http://localhost:4321
```

**Screenshots:** Playwright does not work on this Mac (macOS 12). Use `scripts/screenshot.py` (an offscreen WKWebView via pyobjc) with the Python at `~/Downloads/eehub-2/.venv/bin/python -I`. Or create a local venv with `pyobjc-framework-WebKit`.

**Note:** in `.env`, wrap values that contain spaces in quotes, e.g. `OWNER_NAME="Dev Owner"`. Otherwise `source .env` in a shell fails.
