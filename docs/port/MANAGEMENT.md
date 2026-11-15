# Port spec: management screens (games area + access matrix)

Source: the old Django site at `~/Downloads/eehub-2` (read-only). This file lists every management screen for the
arcade/game area and for people-and-access, so they can be rebuilt in MIB-Hub (Astro + React + Drizzle + Better Auth).
All paths below are relative to `eehub-2/` unless they start with `MIB-Hub/`. Line numbers are from the copy read on
15 Nov 2026.

No personal data is copied here. Where the old code holds a real person's name (the default name of the secret
character) or a plain code, this file points at the line and does not repeat the value.

---

## 0. Summary table

Arcade URLs sit under `/arcade/` (`eehub/urls.py:35`, `games/urls.py`). Access URLs sit under `/access/`
(`eehub/urls.py:12`, `accounts/access_urls.py`).

### 0.1 Arcade Management (games area)

| # | Screen | URL | View (URL name) | Who may open | Main actions |
|---|---|---|---|---|---|
| A1 | Games (home) | `/arcade/settings/` (`/arcade/manage/` redirects) | `settings_views.settings_home` (`games:settings`) | manager¹ | Game on/off, cheats on/off per game, site-wide defaults, access rules, secret-character code (set or generate) |
| A2 | One game (4 tabs) | `/arcade/settings/<slug>/?tab=general\|rules\|cheats\|hero` | `settings_views.settings_game` (`games:settings_game`) | manager¹ | General switches and access, rules editor, cheat-code editor, per-game secret code |
| A3 | All cheat codes | `/arcade/settings/codes/?q=` | `settings_views.all_codes` (`games:settings_codes`) | manager¹ | Search; link to edit; export |
| A4 | Secret character guide | `/arcade/settings/secret-character/` | `settings_views.guide` (`games:settings_guide`) | manager¹ | Read-only guide per game; export |
| A5 | Change log | `/arcade/settings/log/` | `settings_views.audit` (`games:settings_audit`) | manager¹ | Read-only, last 300 entries |
| A6 | Cheat-code export | `/arcade/settings/export/?format=` and `/arcade/settings/<slug>/export/?format=` | `settings_views.export` (`games:settings_export_all`, `games:settings_export`) | manager¹ | Download PDF / DOCX / XLSX / CSV, or the print page (A7) |
| A7 | Cheat-code print page | same URL with `?format=html` | renders `games/settings_print.html` | manager¹ | Print / save as PDF |
| A8 | Sounds | `/arcade/settings/sounds/` | `sounds.manage` (`games:settings_sounds`) | view: manager¹; upload/revert: super admin² | Play, download, revert, upload, export |
| A9 | Sounds print page | `/arcade/settings/sounds/?format=html` | `sounds._export` → `games/settings_sounds_print.html` | manager¹ | Print / save as PDF |
| A10 | FSLG Characters | `/arcade/settings/fslg/characters/` | `fslg_admin.page_characters` (`games:fslg_characters`) | super admin² | Edit looks, attitude, voice, reactions, lines per character; reset; history |
| A11 | FSLG Config | `/arcade/settings/fslg/config/` | `fslg_admin.page_config` (`games:fslg_config`) | super admin² | Name, initials, tagline, colours, currency; live preview; history/rollback |
| A12 | FSLG Credits | `/arcade/settings/fslg/credits/` | `fslg_admin.page_credits` (`games:fslg_credits`) | super admin² | Sections/entries editor, approve/visible flags, preview roll, history/rollback |

¹ **manager** = `games.cheats.can_manage(user)` (`games/cheats.py:42`): signed in **and** (super admin **or**
`user.has_perm("games.manage_game_settings")`). Everyone else gets **404** (not 403, so the section is not advertised).
² **super admin** = `accounts.access.is_super_admin(user)` (`accounts/access.py:153`): `is_authenticated and is_active and is_superuser`.

Plus the JSON APIs behind A8 and A10–A12 (section 3). Partials: `_settings_nav`, `_settings_access`,
`_settings_export`, `_settings_guide`, `_fslg_admin_head` (section 2.13).

### 0.2 People and access (`accounts` app, templates in `templates/access/`)

| # | Screen | URL | URL name | Required (any of) |
|---|---|---|---|---|
| P1 | Overview | `/access/` | `access:home` | `accounts.users_manage`, `offices_manage`, `matrix_edit`, `regno_manage` |
| P2 | Users list | `/access/users/` | `access:users` | `accounts.users_manage` |
| P3 | Add user | `/access/users/new/` | `access:user_create` | `accounts.users_manage` |
| P4 | Import users | `/access/users/import/` | `access:user_import` | `accounts.users_import` |
| P5 | User detail | `/access/users/<pk>/` | `access:user_detail` | `accounts.users_manage` |
| P6 | Edit user | `/access/users/<pk>/edit/` | `access:user_edit` | `accounts.users_manage` |
| P7 | Reset password | `/access/users/<pk>/reset-password/` | `access:user_reset_password` | `accounts.users_reset_password` + target rule |
| P8 | Lock/unlock (POST) | `/access/users/<pk>/toggle-active/` | `access:user_toggle_active` | `accounts.users_manage` |
| P9 | User profiles | `/access/users/<pk>/profiles/` | `access:user_profiles` | `accounts.users_manage` |
| P10 | Personal overrides | `/access/users/<pk>/overrides/` | `access:user_overrides` | view: `matrix_edit` or `users_manage`; edit: `matrix_edit` |
| P11 | Person search (HTMX fragment) | `/access/people/search/` | `access:person_search` | login + see 4.11 |
| P12 | Offices | `/access/offices/` | `access:offices` | `accounts.offices_manage` |
| P13 | New office | `/access/offices/new/` | `access:office_create` | `accounts.offices_manage` |
| P14 | Edit office | `/access/offices/<code>/edit/` | `access:office_edit` | `accounts.offices_manage` |
| P15 | Appoint to office | `/access/offices/<code>/appoint/` | `access:office_appoint` | login + delegation rule (`appointing.can_appoint`) |
| P16 | End appointment (POST) | `/access/appointments/<pk>/end/` | `access:appointment_end` | login + `appointing.can_appoint` for that office/level |
| P17 | **Permission matrix** | `/access/matrix/` | `access:matrix` | `accounts.matrix_edit` |
| P18 | Matrix cell toggle (HTMX POST) | `/access/matrix/toggle/` | `access:matrix_toggle` | `accounts.matrix_edit` |
| P19 | Matrix holders panel (HTMX GET) | `/access/matrix/holders/` | `access:matrix_holders` | `accounts.matrix_edit` |
| P20 | Profile role edit | `/access/profile-roles/<kind>/` | `access:profile_role_edit` | `accounts.matrix_edit` |
| P21 | Reg-number formats | `/access/regno/` | `access:regno_list` | `accounts.regno_manage` |
| P22 | New / edit format | `/access/regno/new/`, `/access/regno/<pk>/` | `access:regno_create`, `regno_edit` | `accounts.regno_manage` |
| P23 | Reg-number preview (HTMX) | `/access/regno/preview/` | `access:regno_preview` | `regno_manage` or `users_manage` (identify mode) |
| P24 | How access works | `/access/how/` | `access:how` | login |
| P25 | Appointments to review | `/access/review/` (+ POST `review/end-all/`) | `access:review_appointments`, `review_end_all` | `offices_appoint` or `offices_manage` |
| P26 | Grants | `/access/grants/` | `access:grants` | `grants.can_manage_grants` |
| P27 | New grant | `/access/grants/new/` | `access:grant_create` | `grants.can_manage_grants` |
| P28 | Revoke grant (POST) | `/access/grants/<pk>/revoke/` | `access:grant_revoke` | `grants.can_revoke` |
| P29 | My access | `/access/me/` | `access:my_access` | login |
| P30 | Delegation rules | `/access/delegation/` | `access:delegation` | `matrix_edit` or `offices_manage` |
| P31 | New / edit rule | `/access/delegation/new/`, `/access/delegation/<pk>/` | `access:delegation_create`, `delegation_edit` | `accounts.matrix_edit` |
| P32 | Access log | `/access/access-log/` | `access:access_log` | `accounts.access_log_view` |
| P33 | Classes | `/access/classes/` | `access:classes` | `accounts.classes_view` |
| P34 | Class detail | `/access/classes/<pk>/` | `access:class_detail` | `accounts.classes_view` |
| P35 | Class broadcast | `/access/classes/broadcast/` | `access:broadcast` | `accounts.class_broadcast` |
| P36 | Dashboard widget "Classes, reps and tutors" | (on dashboards) | `accounts/widgets.py` | `accounts.classes_view` |
| P37 | Module switched off | (any URL of a disabled module) | `accounts/middleware.py:42` `feature_off_response` | n/a |

`need(*perms)` (`accounts/access_views.py:47`) = `login_required` + user holds **any** of the perms, else
`PermissionDenied` (403). All checks go through `user.has_perm`, answered by the resolver in `accounts/access.py`
(section 4.1).

**Screen count: 12 arcade screens (A1–A12) + 37 access screens/fragments (P1–P37) = 49.**

---

## 1. Shared arcade rules

### 1.1 Gates

- **Whole arcade switch.** `core/features.py:105` declares feature `games` ("Learning arcade") with
  `default=False`. When off, `accounts/middleware.py:31-39` serves `access/feature_off.html` for every URL in the
  `games` namespace, including Arcade Management (HTMX gets 204 + toast; JSON gets 404).
- **Manager gate** `manager_required` (`games/settings_views.py:23`): `C.can_manage(user)` or `Http404`; adds
  `Cache-Control: no-store`. Used by A1–A9.
- **Super-admin gate** `super_admin_page` (`games/fslg_admin.py:598`): `is_super_admin` or `Http404`; adds
  `no-store`. Used by A10–A12. The FSLG links in the nav partial only render for the super admin
  (`games/templatetags/fslg_tags.py`, `{% fslg_super %}`).
- **Sidebar entries** (`games/nav.py`): "Arcade Management" appears twice (group `games` and group `system`) when
  `can_manage` is true.
- **How the permission is given.** `games.manage_game_settings` is declared on `GameSettings.Meta.permissions`
  (`games/models.py:72`). It is **not** in the access matrix catalogue (`capability_catalogue()` only reads the
  `accounts`, `core` and `config` apps, `accounts/access_views.py:109`), not in the override picker and not grantable
  as a time-boxed grant (`accounts/grants.py:61` reads `accounts`, `core`, `config`, `registration`). The only way
  to give it is Django admin → user permissions or a Django group, which is what the help box on A1 says. MIB-Hub
  should put it in the normal role/permission UI.

### 1.2 Storage model: `games.GameSettings` (`games/models.py:63`)

| Field | Type | Notes |
|---|---|---|
| `slug` | char(40), unique | a game slug, or `"*"` for site-wide values (`C.GLOBAL`) |
| `data` | JSON | the owner's overrides only; defaults come from `games/cheat_defaults/<slug>.json` |
| `updated` | datetime auto | |

`AUDIT_EXCLUDE_FIELDS = ("data",)`: the generic audit never stores the JSON (it holds codes and a password hash);
`cheats.update()` writes its own redacted entry. The DB has 2 rows (`*` and `samaru-days`).

Keys used inside `data` (all optional; missing = follow default):

| Key | Where | Meaning |
|---|---|---|
| `enabled` | game | game visible to players (default true) |
| `cheats_enabled` | game and `*` | master switch (`*`) AND per-game switch; both must be on (`cheats.cheats_enabled`) |
| `cheats_on_boards` | game (tri-state) and `*` | cheat results count on leaderboards (default false) |
| `hero_enabled` | game (tri-state) and `*` | secret character available (default true) |
| `cheat_access`, `cheat_users` | game and `*` | who may use codes: `everyone` / `signed` / `staff` / `named` + list of user ids |
| `hero_access`, `hero_users` | game and `*` | who may use the secret character: `code` / `signed` / `staff` / `named` + ids |
| `cheats` | game | `{cheat_id: {typed?, dial?, how?, off?}}` overrides |
| `rules` | game | `{rule_key: value}` only where different from default |
| `hero_hash` | game and `*` | Django `make_password` hash of the normalised secret code |
| `starter_off` | game | retire the dev-only starter code |

Defaults file (`games/cheat_defaults/<slug>.json`, 16 files, schema in its `README.md`): `cheats[]`
(`id,label,typed,dial,note,how`), `hero{name,full,combo,swipe,powers,shortcuts,where,code?}`, `rules[]`
(`key,label,type∈int|float|bool|choice,default,min,max,choices,help,group`). Only `samaru-days.json` declares rules
(17); cheats per game range 6–31. Parsing and clamping: `cheats.defaults()` / `_clean_rule()` (`games/cheats.py`).

Normalisation and checks (`games/cheats.py`): `norm()` lower-cases and strips all whitespace; minimum code length 4
(`MIN_CODE`); dial codes only `[0-9*#]`; no code may be reused by two cheats in one game (`validate_cheats`, line 288);
secret code minimum 8 normalised chars (`_hero_form`, `settings_views.py:66`). The play page receives only
`sha256(slug + ":" + norm(code))` hashes (`page_config`, line 274); the secret code is checked on the server by
`games/views.py:277 api_hero` with a try limit per profile and per IP (`HERO_TRIES` per ten minutes).

**Every write goes through `cheats.update(slug, actor, note, **changes)`** (line 324): merges keys (None removes),
builds a diff (codes and hash written as "(set)/(changed)/(cleared)", never plain), saves, writes
`core.AuditLogEntry(action=UPDATE, model_label="games.GameSettings", changes=diff, note=note)`.

---

## 2. Arcade screens in detail

### 2.1 A1 Games home — `/arcade/settings/` (`settings_home`, `settings_views.py:78`; template `games/settings_home.html`)

**Shows**
- Header with back link to the arcade and the export buttons (`_settings_export.html`, base = `games:settings_export_all`).
- Lead text + nav (`_settings_nav.html`, `at="home"`).
- One-time banner with a freshly generated secret code (`shown_code`, popped from session key
  `arcade_hero_code_once`). On the first visit ever, `C.ensure_hero_code()` creates the site-wide code and flashes it.
- Collapsible "How to use Arcade Management" help (6 bullet points).
- **Games table** (one row per playable game, `_summary()` line 43): title + level + genre, Status (On/Off),
  Cheats (On/Off, effective), On leaderboards (Counted/Kept off), Secret character (Available/Off), Codes (count, N
  off, N edited), Rules (count, N edited), actions.
- **Settings for every game** form (the `*` row).
- **Secret character code** card.

**Actions** (all `POST /arcade/settings/` with `action=`; redirect back on success; errors re-render):

| `action` | Fields | Effect |
|---|---|---|
| `toggle` | `slug` | flip `enabled` for that game |
| `toggle_cheats` | `slug` | flip the game's own `cheats_enabled` |
| `defaults` | checkboxes `cheats_enabled`, `cheats_on_boards`, `hero_enabled`; `cheat_access` + `cheat_users` (textarea of sign-in e-mails); `hero_access` + `hero_users` | updates `*` row; unknown e-mails and `named` with nobody are errors (`_access_from`, line 52) |
| `hero_set` | `code`, `code2` (password inputs, min 8) | sets `*`.`hero_hash`; old code stops working |
| `hero_new` | — | generates `XXXX-XXXX-XXXX` from an unambiguous alphabet (`cheats.new_code`), stores the hash, shows it once |

### 2.2 A2 One game — `/arcade/settings/<slug>/` (`settings_game`, line 118; template `games/settings_game.html`)

404 if the slug is unknown or the game is not `playable`. Tabs from `TABS` (line 16): `general`, `rules`, `cheats`,
`hero` (label "Secret character"). Header has a Play link and export buttons for this game only.
All forms `POST` to the same URL with hidden `action` and `tab`; success redirects to `?tab=<tab>`.

| Tab | Shows | `action` / fields | Effect |
|---|---|---|---|
| General | Game on; Cheat codes on in this game (warns if the master switch is off); selects for leaderboards and secret character with "Follow the site-wide setting (…)" / on / off and the effective value; access rule pickers with a "Follow the site-wide rule" option | `general`: `enabled`, `cheats_enabled`, `cheats_on_boards`∈`""\|on\|off`, `hero_enabled`∈`""\|on\|off`, `cheat_access`/`cheat_users`, `hero_access`/`hero_users` | `update(slug, …)`; tri-state `""` removes the key (follow default) |
| Rules | Grouped table: label + help, input by type (checkbox / select / number with min, max, step), default, "edited" tag, per-row Reset | `rules`: `rule-<key>` per rule; `reset=<key>` or `reset=*` | values coerced (`cheats.coerce`), out-of-range → error; only non-default values stored; empty → key removed |
| Cheat codes | Table: label + note, typed code, dial code (`inputmode=tel`), "How to trigger" (placeholder = generated text), On switch, edited tag + Reset | `cheats`: `typed-<id>`, `dial-<id>`, `how-<id>`, `on-<id>`; `reset=<id>` or `reset=*` (JS confirm) | `validate_cheats` then store only differences; reset `*` clears all |
| Secret character | The guide for this game (`_settings_guide.html`), optional "Retire the starter code" button; "Give this game its own code" form; "Go back to the site-wide code" button | `hero_set` (`code`,`code2`), `hero_clear`, `starter_off` | per-game `hero_hash` set/removed; `starter_off=true` |

### 2.3 A3 All cheat codes — `/arcade/settings/codes/` (`all_codes`, line 220; `games/settings_codes.html`)

GET `q` searches game title, label, note, typed, dial and how-text (case-insensitive). Shows per game: cheats
on/off tag, Edit link (`?tab=cheats`), table of label/note, typed, dial, how to trigger, state (On only if the cheat
and the game's cheats are on). Count line "N codes matching …". Export buttons for all games. **Plain codes are shown
here** (staff-only page).

### 2.4 A4 Secret character guide — `/arcade/settings/secret-character/` (`guide`, line 231; `games/settings_guide.html`)

"The short version" (3 steps: reveal move, choose him, type the code) and, if no site-wide code exists yet, a hint to
open the Games page once. Then one card per playable game rendering `_settings_guide.html` with data from `_guide()`
(line 206): reveal combo (keyboard/controller), swipe (phone), where to enter the code, which code (site-wide or own;
on a DEBUG copy the starter code is printed), who may use him (+ named people's e-mails), powers, test-run shortcuts,
leaderboard effect, how to change the code, lock-out rule (8 wrong tries → 10 minutes). "Settings" button links to
`?tab=hero`. Export buttons include this guide in every format.

### 2.5 A5 Change log — `/arcade/settings/log/` (`audit`, line 236; `games/settings_audit.html`)

Reads `core.AuditLogEntry` where `model_label="games.GameSettings"`, newest first, first 300, skipping CREATE.
Columns: When, Who (`actor_repr`), Game (`"All games"` for `*`, title, or "(removed)"), What (`note` + "key: old →
new" pairs, excluding `data`/`updated`). Note: sound uploads (`games.GlobalSound`) and FSLG edits
(`games.FSLGContent`) are audited too but **do not appear here**; FSLG has its own History panels.

Model `core.AuditLogEntry` fields used: `timestamp, actor, actor_repr, action, model_label, object_pk, object_repr,
changes (JSON), note`.

### 2.6 A6/A7 Cheat-code export — `/arcade/settings/export/` and `/arcade/settings/<slug>/export/` (`export`, line 423)

`GET ?format=pdf|docx|xlsx|csv|html` (default `pdf`; anything else 404). Writes an audit entry
`AuditLogEntry.OTHER` "Arcade cheat codes exported (<fmt>)" on the game or `*` row. File name
`arcade-cheat-codes-<slug|all>-YYYYMMDD.<ext>`, `Content-Disposition: attachment`.

| Format | Builder | Content |
|---|---|---|
| pdf | `_pdf` (reportlab, landscape A4) | Title, "Confidential" line with time and exporter e-mail; per game: cheats on/off and leaderboard sentence, table (What it does, Type, Dial, How to trigger, State), secret-character table (`_guide_lines`); footer stamp + page number. Latin-1 only (₦→N, →→->) |
| docx | `_docx` (python-docx, landscape) | Same content, "Light Grid Accent 1" tables, code columns in Courier bold, footer stamp |
| xlsx | `_xlsx` (openpyxl) | Sheet "Cheat codes" (Game, What it does, Note, Typed code, Dial code, How to trigger, State), sheet "Secret character" (Game, Topic, Details), sheet "About"; cells starting with `= + - @` prefixed with `'` (formula-injection guard) |
| csv | `_csv` | Same rows as the first sheet, BOM-prefixed UTF-8, same injection guard |
| html | `games/settings_print.html` (standalone page, `noindex`) | Print button, Back link, same content as the PDF |

Fallbacks: if the xlsx library is missing → csv; if pdf/docx library is missing → the HTML print page. The secret
code itself is never exported (only "site-wide" or "own code"), but cheat codes are, in plain text.

The `_settings_export.html` partial shows PDF, Word, Excel, Print (no CSV button, though CSV works).

### 2.7 A8 Sounds — `/arcade/settings/sounds/` (`sounds.manage`, `games/sounds.py:319`; `games/settings_sounds.html`)

Gate: `manager_required` to view; **POST requires `is_super_admin` or 404**; upload/revert forms only render when
`sup` is true.

**Shows**: lead text explaining priority (switched off > player's own file > this file > the default recording >
synth); table "Replaced for everyone": sound name + original file name, game, `<audio controls preload=none>`, file
(format, KB, seconds), replaced by + when, Download (`?v=<version>&download=1`) and Revert. Upload card (super admin):
game select (playable games), sound name with a datalist of known names (`_known_names()` reads
`static/audio/sfx/manifest.json` plus fixed names), file input (WAV/MP3/M4A).

**Actions**
| Request | Effect |
|---|---|
| `POST action=upload, slug, name, file` | `sounds.save()`: validates the name (`^[a-z0-9_][a-z0-9_.:-]{0,79}$`), size ≤ 2 MB, format sniffed from the file's own headers (WAV/MP3/M4A), 0.05–120 s; stores the file in restricted storage; bumps `version`; deletes the old file; audit `OTHER` note |
| `POST action=revert, slug, name` | deletes the row and the file; audit note |
| `GET ?format=pdf\|docx\|xlsx\|html` | export (`_export`, line 352). csv → 404. Columns: Game, Sound, Format, Size (KB), Seconds, Replaced by, When, Original file name. File `arcade-sounds-YYYYMMDD.<ext>`; html renders `settings_sounds_print.html` (A9) |

**Model `games.GlobalSound`** (`games/models.py:115`): `slug`, `name`, `file` (FileField, `restricted_storage`,
`uuid_upload_to`), `content_type`, `size`, `duration`, `original_name`, `version`, `uploaded_by` (FK user),
`updated`. Unique (`slug`, `name`). 0 rows in the DB.

Related JSON endpoints (used by the in-game Sounds tab, `static/js/games/arcade-sounds.js`) in section 3.

### 2.8 A10 FSLG Characters — `/arcade/settings/fslg/characters/` (`page_characters`, `fslg_admin.py:702`; `games/fslg_characters.html`)

Client-side editor (`static/js/games/fslg-admin.js`, 302 lines). The page loads the game's own data scripts
(`DATA_SCRIPTS`, line 691: map, sim, data, config, five story years, side, coop, draw, core, story, overrides,
wardrobe, anim) and three.js, so it lists exactly the people the game has.

**Shows**: left list with search (name, role, a line they say) and role filter (Everybody, Students, Staff,
Traders and town, Family, Story cast, Changed by you); right pane editor for the picked person. Voice-role options
come from `VOICE_ROLES`. Text notes that edited lines are marked "needs re-record" in the voice script.

**Editable fields** (validated by `validate_character`, line 359; only differences stored):
`name` (≤40), `nick[]` (≤4 × 24), `role` (≤60), `bio` (≤400), `look{skin, hair∈HAIRS, hairCol, top, mode∈MODES,
fit{slot→item}, acc[≤3], beard, brow, eyes, scale .85–1.2}`, `att{preset∈PRESETS, mood∈MOODS, bump, hit, honk,
speed .6–1.6, friend, romance, routine[≤8 × [place,hour]], likes[≤6], dislikes[≤6], hateTopic}`,
`barks{bump|hit|honk|flee|fight|yield: ≤4 lines × 120}`, `voice{sex, pitch .5–1.6, tone, role}`,
`lines{lineKey: {t, o, g}}` (≤800; a new line must keep every `{{TOKEN}}` the original used), `base{name, sex}`.
Max 96 KB per character. Text is stripped of tags.

**Actions**: Save (`POST /arcade/api/fslg/save/` `{kind:"character", key:<npc id>, data, note}`), Reset to the
game's version (`/reset/`, JS confirm), History with "Roll back to this" (`/history/`, `/rollback/`).

### 2.9 A11 FSLG Config — `/arcade/settings/fslg/config/` (`page_config`, line 707; `games/fslg_config.html`)

**Form fields** (`CONFIG_FIELDS`, line 54): `gameName` (1–60), `gameShortName` (1–12), `initialsOverride` (0–6
letters/digits, upper-cased; empty = automatic from the name), `tagline` (0–120, may contain tokens), `author`
(0–80; validated though not on the form), `primaryColour`, `secondaryColour` (`#rrggbb`), `currencyName` (1–20),
`currencySymbol` (0–3). Only the tagline may contain `{{TOKENS}}` (`GAME_NAME, GAME_SHORT, GAME_INITIALS, TAGLINE,
CURRENCY, PLAYER_NAME, AUTHOR`). Defaults are read from the line starting `{"gameName"` in
`static/js/games/fslg.config.js` and passed to the page as JSON (`fa-defaults`).
**Live preview**: title, billboard canvas, gate-sign canvas, giant letters, browser tab, home-screen label, money.
**Actions**: "Save for everyone" (save `kind:"config"`), "Back to the original name" (reset), optional change-log
note, History panel with rollback.

### 2.10 A12 FSLG Credits — `/arcade/settings/fslg/credits/` (`page_credits`, line 712; `games/fslg_credits.html`)

**Shows**: search, "+ Section", sections with entries (drag or arrow reorder, delete section with confirm), warning
box (duplicates, empty fields from `credit_warnings`), closing line, change-log note, "Save for everyone",
"Play the credits" preview roll, History.
**Data** (`validate_credits`, line 263): `{sections[≤30]: {id, title≤60, order, visible, entries[]}, outro≤200}`;
entry `{id, name≤80 (required), role≤120, note≤200, link (http/https), characterName≤60, order, visible,
approved}`; ≤1000 entries; ≤256 KB. **Players only see entries that are `visible` and `approved`** (consent rule,
`credits()`, line 336). The default credit list (`_seed_credits`, line 312) contains real names: do not copy it into
MIB-Hub fixtures; rebuild it from consented data.

### 2.11 FSLG storage (both models in `games/models.py`)

`FSLGContent`: `kind` (`config` / `credits` / `character`), `key` (npc id for characters, else ""), `data` (JSON:
only the changes), `version`, `updated_by`, `updated`; unique (`kind`, `key`); `AUDIT_EXCLUDE_FIELDS=("data",)`.
`FSLGContentVersion`: `kind`, `key`, `version`, `data` (whole override after the change; `{}` = defaults), `note`,
`by`, `created`; newest first; trimmed to the last 50 per (`kind`, `key`) (`MAX_HISTORY`).
Every save/reset/rollback: transaction + `select_for_update`, version +1, a version row, and an audit entry with a
field-level diff (`_diff`, max 60 paths, values cut to 300 chars). Rollback = save of the old data with note "Rolled
back to version N" (so it can be undone). Both tables have 0 rows in the DB.

### 2.12 Partials

| Partial | Used by | Content |
|---|---|---|
| `_settings_nav.html` | A1–A5, A8, A10–A12 | Tabs: Games, All cheat codes, Secret character guide, Sounds, Change log; plus FSLG Characters / Config / Credits for the super admin only |
| `_settings_access.html` | A1, A2 General | Params `kind, label, choices, value, users, follow`. A select `<kind>_access` (optional "Follow the site-wide rule (…)") and a textarea `<kind>_users` (one sign-in e-mail per line) |
| `_settings_export.html` | A1, A2, A3, A4, A8 | Download links `?format=pdf`, `docx`, `xlsx`, `html` on a given `base` URL |
| `_settings_guide.html` | A2 hero tab, A4 | The secret-character guide for one game (`gd`), see 2.4 |
| `_fslg_admin_head.html` | A10–A12 | Hidden `#fslg-admin` element with `data-api`, `data-csrf`, `data-three`, `data-page`, then the game data scripts and `fslg-admin.js` |

Styling: `static/css/games-settings.css` (`gs-*`), `static/css/fslg-admin.css` (`fa-*`).

---

## 3. Arcade JSON APIs (used by the screens and the games)

| Method + URL | View | Auth | Request → response |
|---|---|---|---|
| GET `/arcade/api/fslg/` | `fslg_admin.api_bundle` (line 609) | any player (signed in or guest), else 403 | `{schema, v, config, credits, characters, can_edit}`; `?all=1` for the super admin includes hidden/unapproved credits. `ETag "fslg-<schema>-<v>-<sup>"`, 304 on match, `Cache-Control: private, no-cache` |
| POST `/arcade/api/fslg/save/` | `api_save` (line 635) | super admin, else 403 | JSON `{kind, key, data, note}`; body ≤ 400 KB (413) → `{ok, version, v, data, warnings? (credits), config? (config)}`; validation error → 400 `{error}` |
| POST `/arcade/api/fslg/reset/` | `api_reset` | super admin | `{kind, key}` → `{ok, version, v}` |
| POST `/arcade/api/fslg/rollback/` | `api_rollback` | super admin | `{kind, key, version}` → `{ok, version, v, data}` |
| GET `/arcade/api/fslg/history/?kind=&key=` | `api_history` | super admin | `{history: [{version, note, by, at, data}]}` |
| GET `/arcade/api/sounds/<slug>/` | `sounds.api_sounds` (line 236) | any player | `{can_global, max_bytes, max_seconds, sounds:[{name,url,v,type,size,dur,at,by}]}`, `no-store` |
| POST `/arcade/api/sounds/<slug>/` | same | super admin (403) | multipart `name`, `file` → `{ok, sound}` |
| POST `/arcade/api/sounds/<slug>/revert/` | `api_sound_revert` | super admin | `name` → `{ok}` |
| GET `/arcade/api/sounds/<slug>/file/<name>/` | `sound_file` (line 271) | any player or manager, else 404 | the file; `?download=1` = attachment; `private, max-age=86400`, `nosniff` |
| POST `/arcade/api/hero/` | `views.api_hero` (`games/views.py:277`) | can play the game | `{slug, code}` → `{ok, name}` / `{ok:false}` / `{wait:true}` after too many tries |

`cheats.page_config(slug, request)` is embedded in each play page as `data-gm-config` (hashes, switches, rules,
hero combo) – the game-side half of A1/A2.

---

## 4. People and access in detail

### 4.1 The permission resolver (`accounts/access.py`)

```
effective permissions (for the ACTIVE profile kind) =
    ProfileRole(kind).permissions
  ∪ permissions of every current office appointment in that kind (or office.profile_kind == "any")
  ∪ the user's direct Django permissions and groups
  ∪ PermissionOverride(effect=grant, not expired)
  ∪ AccessGrant running now (profile_kind "" or this kind)
  − PermissionOverride(effect=revoke)
  − DEPARTMENT_ONLY_PERMS for an external ("service") lecturer, unless granted explicitly
Superuser: every permission.
```
Cached per user + kind in the shared cache (60 s, never past the next grant/override start or end), invalidated by
`invalidate(user)` after every change. `is_super_admin` is the only superuser test allowed in code (a test scans for
direct `is_superuser` reads). Profiles: `student`, `lecturer`, `staff`, `alumni`, plus `admin` for superusers or staff
with no profile (`available_profiles`).

`holders_of(perm)` (line 303) lists who effectively holds one permission: current office holders, every member of a
profile role ("Every student"), active personal grants, running access grants, superusers.

### 4.2 Models (all in `accounts/models.py`)

| Model | Key fields | DB rows |
|---|---|---|
| `CAPABILITY_GROUPS` (line 171) + `Capability` (unmanaged, holds the custom permissions) | 12 groups × items `(codename, label)`, each group has a "phase" badge | 75 codenames in `accounts` |
| `ProfileRole` (line 286) | `kind` (unique, one of PROFILE_KINDS), `name`, `description`, `permissions` M2M Permission, `dashboard_widgets` JSON | 4 |
| `Office` (line 304) | `code` (slug, unique), `name`, `short_name`, `description`, `category` (leadership, academic, coordination, committee, support, student, association, custom), `profile_kind` (+ `any`), `allowed_profile_kinds` JSON, `level_must_match`, `scope_kind` (department, programme, level, class, committee, self), `permissions` M2M, `rank`, `max_holders` (0 = no limit per scope), `dashboard_widgets` JSON, `icon`, `color`, `is_template`, `is_system`, `is_active`, `created_from` FK self | 48 |
| `Appointment` (line 374, soft delete) | `person`, `office`, `profile_kind`, `scope_programme`, `scope_level`, `scope_label`, `start_date`, `end_date`, `is_acting`, `appointed_by`, `note` | — |
| `PermissionOverride` (line 417) | `user`, `permission`, `effect` grant/revoke, `reason` (required), `expires_at`, `granted_by` | 0 |
| `DelegationRule` (line 440) | `grantor_office`, `offices` M2M, `office_categories` JSON, `except_offices` M2M, `permissions` M2M, `any_held_permission`, `scope_rule` any/same_level, `max_days`, `note`, `is_active` | 6 |
| `AccessGrant` (line 492) | `user`, `profile_kind`, `permissions` M2M, `office`, `appointment`, `scope_level`, `scope_label`, `reason`, `starts_at`, `ends_at`, `granted_by`, `granted_via` (rule), `revoked_at/by`, `revoke_reason`, `source_type/id/label` | 6 |
| `AccessLogEntry` (line 555) | `at`, `user`, `user_repr`, `impersonator`, `profile_kind`, `kind`, `model_label`, `object_pk`, `object_repr`, `subject` (Person), `path`, `ip`, `note` | — |
| `RegNumberCategory` (line 602) | `name`, `code`, `profile_kind`, `programme`, `samples`, `pattern`, `auto_pattern`, `priority`, `is_active` | — |
| `User` / `Person` | `email`, `login_id`, `must_change_password`, `default_profile`, `is_active`, `is_staff`, `is_superuser`; person names, gender, phone, personal e-mail | — |

Capability groups: People and access (16), Settings and system (3), Public website (8), Academics (7), Results (8),
CBT (3), Memos and requests (6), Welfare and feedback (6), Promotion and graduation (4), Community and research (3),
SIWES/FYP/careers (7), Laboratories (4). The matrix adds a "System tools" group built from non-`accounts`
permissions used by seeded offices plus `core.manage_files`, `core.view_audit_log`, `core.handle_contact_messages`,
`core.use_import_export`, `config.confirm_setting_change`, `config.change_configentry`
(`_system_extra_labels`, `access_views.py:100`).

### 4.3 P17 Permission matrix — `/access/matrix/` (`matrix`, `access_views.py:437`; `access/matrix.html`)

**Gate**: `@need("accounts.matrix_edit")`.

**Shows**
- Page header ("Permissions attach to profile roles and offices, never to people…"), link to Offices, sub-nav
  (`_subnav.html`, `section="matrix"`).
- Toolbar (GET form): office category segmented control (`?category=all|leadership|…`, default `leadership`),
  permission filter `q` (matches label or `app.codename`), "Hide profile roles" checkbox (`roles=0`, auto-submit).
- Table: corner "Permission"; columns = the 4 profile roles (unless hidden) then active offices of the chosen
  category ordered by category, -rank, name. Each column head is a button showing icon, short label and (offices) the
  current holder count. Rows grouped by capability group (with "Phase N" badge); each row head shows label + code.
- Cells: `_matrix_cell.html`, a toggle button (`aria-pressed`) per (column, permission).
- Legend (Granted / Not granted / "Click a header to see holders").
- Side panel `#matrix-holders` ("Who effectively has it") + note linking every profile-role edit page.
- JS: `static/js/access.js`; styles via `access/_assets.html`.

**HTMX calls**
| Trigger | Request | Response |
|---|---|---|
| Click a cell | `hx-post /access/matrix/toggle/` with `hx-vals {"col": "role:<kind>"\|"office:<code>", "perm": <Permission pk>}`, `hx-swap=outerHTML`, `hx-disabled-elt=this` | `matrix_toggle` (line 467): 404 for an unknown column or a permission outside the catalogue; adds/removes the M2M row; audit `update` on the role/office with `changes={"permission": {old,new,code}}` and note `matrix: granted|removed <code>`; `invalidate`; re-renders `_matrix_cell.html`; toast via `HX-Trigger` ("Granted: …" / "Removed: …") |
| Click a column head | `hx-get /access/matrix/holders/?col=<key>` → `#matrix-holders` | office: current holders (name, Office/Acting, scope, since year, link to user if viewer has `users_manage`), permission count, "Edit →" link; role: total profiles of that kind (active students only), first 20 shown |
| Click a row head | `hx-get /access/matrix/holders/?perm=<app.codename>` | `holders_of()` list: name, via (Office: X / Profile role / Personal grant / Grant until date / Superuser), scope/reason |

`_matrix_holders.html` renders all three modes; `_holders_list.html` is a smaller variant.

### 4.4 `_perm_picker.html` and `_widget_picker.html` (used by P14 and P20)

Perm picker: search box, "N selected", "Open all"; one `<details>` per capability group (open if any ticked or first)
with phase badge, `on/total` count and an "All" checkbox; each item a checkbox `name="perms" value="app.codename"`.
Saved by `_save_permissions` (line 145): sets the M2M to chosen ∪ (existing permissions outside the catalogue),
returns added/removed counts. Widget picker: ordered list of dashboard widgets (`dashboards.widgets.REGISTRY`),
checkbox `name="widgets"`, drag or up/down to reorder, "needs permission" hint; saved to `dashboard_widgets`.

### 4.5 P20 Profile role edit — `/access/profile-roles/<kind>/` (`profile_role_edit`, line 539)

`matrix_edit`. 404 unless `kind` in PROFILE_KINDS; creates the role if missing. `ProfileRoleForm` (name,
description) + perm picker + widget picker (defaults from `DEFAULT_PROFILE_WIDGETS[kind]`). POST saves all three,
`invalidate`, message "X saved (N added, M removed)". Side links to the other roles.

### 4.6 P12–P16 Offices

- **P12 Offices** (`offices`, line 671): GET filters `q` (name, short name, code, description), `category`, `show`
  = `templates` or `inactive`. Grouped by category, each office with holder count and permission count; links to
  edit, appoint, new office, matrix; list of templates.
- **P13 New office** (`office_create`): `?from=<code>` pre-fills from a template (`template`) or copies an office
  (`copy_from`, name "(copy)"). From a template it copies description, category, profile_kind, scope_kind, rank,
  max_holders, icon, color, dashboard widgets and permissions; else default widgets
  `office_profile, quick_actions, office_holders, calendar, notifications`. Redirects to edit.
- **P14 Edit office** (`office_edit`): `OfficeForm` + perm picker (saved only if `matrix_edit` or `offices_manage`,
  i.e. always here) + widget picker; current holders with End buttons (hidden unless the viewer may appoint);
  allowed-profiles text; copies made from it; link to the office dashboard (`dashboards:office`). `POST
  action=delete` refused for `is_system` offices or offices with any appointment history.
- **P15 Appoint** (`office_appoint`): open to anyone a `DelegationRule` lets appoint here (super admin always).
  `AppointForm` (person picked through the HTMX person search, profile_kind, scope programme/level/label,
  start/end date, acting, note). Saved through `appointing.appoint()` which enforces eligibility and delegation
  (errors shown on the form). Shows current holders (filtered to the levels the actor may serve) and a "full" flag
  when `max_holders` is reached.
- **P16 End appointment**: `POST reason` (≤200); a future appointment is cancelled, a current one ends today.

### 4.7 P2–P11 Users

- **P2 Users**: GET `q` (e-mail, login id, names, reg number, staff numbers; up to 5 terms), `kind`
  (student/lecturer/staff/alumni/none/superuser), `active` 1/0, `office` (current holders of an office code);
  25 per page; each row shows profile chips and current offices.
- **P3 Add user** (`UserCreateForm` + `ProfileForm` prefix `p`): creates `User` (password typed or generated,
  `must_change_password` per site setting) + `Person` + first profile; the temporary password is shown once on the
  detail page (session stash).
- **P4 Import users**: `?template=1` downloads `ee-hub-users-template.xlsx`; `POST action=preview` (upload, dry run,
  rejected rows listed) then `action=commit` (confirm dialog). Uses the `users` spec of `core.importexport`; link to
  the shared import/export wizard if the viewer has `core.use_import_export`.
- **P5 User detail**: person, profiles (open and closed), effective permissions per profile (grouped by capability
  group + "other"), appointments (End button), overrides, last 8 audit entries, the one-time temporary password,
  buttons Edit / Profiles / Overrides / Reset password / Lock. Viewing writes an access-log entry.
- **P6 Edit user**: e-mail, login id, names, gender, phone, personal e-mail; `is_staff` only changeable by the super
  admin.
- **P7 Reset password**: `can_reset_password(actor, target)` = `users_reset_password` and (actor is super admin or
  target is not a superuser). `method=generate|set` (≥8 chars); always sets `must_change_password=True`; audited.
- **P8 Lock/unlock**: cannot lock yourself; only the super admin may lock a superuser.
- **P9 Profiles**: `action=add` (ProfileForm with reg-number identify via `regno_preview`), `close` (soft delete; if
  it was the last profile of that kind, its appointments end) and `reopen` (refused if another open student profile
  has the same reg number).
- **P10 Personal overrides** (`user_overrides`, line 593; `access/user_overrides.html`): list "In place" (effect,
  label, code, reason, by, expiry, dimmed if expired, Remove button with confirm). Add form (only with
  `matrix_edit`): `permission` (catalogue only), `effect` grant/revoke, `reason`, `expires_on` (stored as 23:59 local
  that day). `update_or_create` per (user, permission). POST without `matrix_edit` → 403.
- **P11 Person search** (`_person_results.html`, HTMX, ≥2 chars, ≤12 results): with `?office=<code>` only people
  eligible for that office (and only if the actor may appoint to it); otherwise requires `offices_appoint`,
  `users_manage`, `grants_manage` or `matrix_edit`. `?need=user` limits to people with an account.

### 4.8 P21–P23 Registration-number formats

List (with an HTMX "identify a number" box), create/edit (`RegNumberCategoryForm`: name, code, profile kind,
programme, samples, pattern, auto pattern, priority, active; live HTMX preview of the pattern against the samples and
a test value; `action=delete` refused when students use the format). Not game-related; listed for completeness.

### 4.9 Round-7 screens (`accounts/access_r7_views.py`, templates `access/r7/`)

| Screen | Content and actions |
|---|---|
| P24 How (`how.html`) | Static explainer: the formula, who may hold an office, delegation, grants, classes and announcements, access log, switching modules off |
| P25 Review (`review.html`) | Appointments that break eligibility rules (`appointing.wrong_appointments()`) with the reason; End one (P16) or "End all" (POST, only those the actor may end) |
| P26 Grants (`grants.html`) | Tabs current / ended / revoked / all with counts, search, 25 per page; Revoke (POST with reason). Viewers without `grants_manage`/`matrix_edit`/super admin only see grants they gave or received |
| P27 New grant (`grant_form.html`) | Person search (HTMX), what = permissions (only those the actor may grant: super admin all of accounts/core/config/registration; others only what they hold and a rule allows) or an office; scope level; profile kind; reason; start/end (default 14 days; site max `access.grant_max_days`, default 180). Saved through `grants.give()` |
| P29 My access (`my_access.html`) | My current appointments, grants I hold, grants I gave (with Revoke), offices I may appoint to, my delegation rules |
| P30/P31 Delegation (`delegation.html`, `delegation_form.html`) | List of rules per grantor office with resulting offices and permissions; edit form (`DelegationRuleForm`) and delete (confirm). Only `accounts`-app capability permissions can be put in a rule |
| P32 Access log (`access_log.html`) | Filters kind, q, period 7/30/90/all days; 40 per page; top 5 viewers this week; total this week |
| P33/P34 Classes (`classes.html`, `class_detail.html`) | Levels the viewer may see (`visible_levels`) with student counts, class reps and tutors; class list with search (50 per page); contact columns only with `student_contacts_view` (each view logged) |
| P35 Broadcast (`broadcast.html`) | Audience level or course offering (current semester), kind announcement/reminder, title, body; preview with recipient count, then confirm; cap `access.broadcast_max_recipients` (600); sends notifications and audits |
| P36 Widget (`widgets/class_lists.html`) | Dashboard card: up to 8 classes with rep names and tutor count, "Send an announcement" if `class_broadcast` |

### 4.10 P1 Overview (`access/home.html`)

Counts (users, active, students, lecturers, staff, alumni, offices, current appointments, reg formats, live overrides,
must-change-password, running grants, appointments to review), 8 recent appointments, 8 recent audit entries for
access models, and shortcut tiles filtered by permission (Add user, Import, All users, Offices, New office, Matrix,
Reg numbers, To review, Grants, Delegation, Access log, Modules and features).

`_subnav.html` tabs (each shown only with its permission): Overview, Users (`users_manage`), Offices
(`offices_manage`), To review (`offices_manage`/`offices_appoint`), Grants (`grants_manage`/`matrix_edit`),
Delegation (`matrix_edit`/`offices_manage`), Permission matrix (`matrix_edit`), Access log (`access_log_view`),
Registration numbers (`regno_manage`).

---

## 5. Port notes for MIB-Hub

### 5.1 What to keep, what to drop

- MIB-Hub is the game's own site, not the department portal. Port **A1–A12 in full**. From the access app, port the
  **model** (roles, permissions, matrix, overrides, time-boxed grants, audit) but not the department-specific screens
  (offices for HOD/Exam Officer, reg-number formats, classes, broadcast, appointments review). A slimmed matrix of
  **roles × permissions** covers the game's needs (V2 §25 lists super admin, editor, moderator, player).
- Rename "FSLG" in URLs and code to a neutral `game` (the name is a token, `{{GAME_NAME}}`).
- Do not migrate `GameSettings` data: it holds a password hash and live codes (`DJANGO_INVENTORY.md` §2, open
  question 1). Re-enter or export deliberately and redacted.
- The default secret-character name (`games/cheats.py:20`, `HERO_DEFAULT`) is a real person's name: keep it in
  config, not in code or fixtures.
- **Drop the DEBUG starter code** (`games/cheats.py:371`, `DEBUG_STARTERS`, a plain-text stand-in code accepted when
  `DEBUG` is on). In MIB-Hub use a seeded dev-only env value (`.env.example` placeholder), never a literal.
- Plain cheat codes ship in `games/cheat_defaults/*.json` and `docs/ARCADE_CHEATS.md` / `FSLG_CHEATS.md` by design
  (owner-private). In MIB-Hub keep defaults in a server-only package (`packages/data` server entry), never in the
  client bundle; send only hashes, as `page_config` does.

### 5.2 Suggested routes (Astro pages + React islands; API routes as Astro endpoints)

| Old | New page | Notes |
|---|---|---|
| `/arcade/settings/` | `/admin/arcade` | games table + site-wide defaults + secret code |
| `/arcade/settings/<slug>/?tab=` | `/admin/arcade/games/[slug]/[tab]` (`general`, `rules`, `cheats`, `hero`) | tab in the path, not the query |
| `/arcade/settings/codes/` | `/admin/arcade/codes?q=` | |
| `/arcade/settings/secret-character/` | `/admin/arcade/secret-character` | |
| `/arcade/settings/log/` | `/admin/audit?area=arcade` | one audit screen for all areas, filter by area/entity (fixes the "sounds and game edits missing from the log" gap) |
| `/arcade/settings/export/`, `/<slug>/export/` | `GET /api/admin/arcade/export?game=&format=pdf\|docx\|xlsx\|csv` + page `/admin/arcade/print?game=` | keep the formula-injection guard and the "Confidential" stamp |
| `/arcade/settings/sounds/` | `/admin/sounds` | |
| `/arcade/settings/fslg/characters/` | `/admin/game/characters` and `/admin/game/characters/[id]` | |
| `/arcade/settings/fslg/config/` | `/admin/game/config` | |
| `/arcade/settings/fslg/credits/` | `/admin/game/credits` | |
| `/access/matrix/` | `/admin/access/matrix` | roles × permissions |
| `/access/users/…` | `/admin/users`, `/admin/users/[id]`, `/admin/users/[id]/overrides` | Better Auth admin plugin covers list, ban (lock), set role, impersonate, set password |
| `/access/grants/…` | `/admin/access/grants` | optional (time-boxed editor access) |
| `/access/me/` | `/account/access` | |

API (all JSON, all checked on the server):

| Old | New |
|---|---|
| POST `/arcade/settings/` actions | `PATCH /api/admin/arcade/settings` (site-wide), `PATCH /api/admin/arcade/games/[slug]`, `PUT …/[slug]/rules`, `PUT …/[slug]/cheats`, `POST …/[slug]/hero-code` (`{code}` or `{generate:true}`), `DELETE …/[slug]/hero-code` |
| `/arcade/api/fslg/` | `GET /api/game/bundle` (ETag on a content revision number) |
| `/arcade/api/fslg/save|reset|rollback|history/` | `PUT /api/admin/game/content/[kind]/[key?]`, `POST …/reset`, `POST …/rollback {version}`, `GET …/history` |
| `/arcade/api/sounds/<slug>/…` | `GET /api/sounds/[game]`, `POST /api/admin/sounds/[game]` (multipart), `DELETE /api/admin/sounds/[game]/[name]`, `GET /api/sounds/[game]/[name]` (file, R2/object storage) |
| `/arcade/api/hero/` | `POST /api/arcade/hero` (rate-limited per user and per IP) |
| `/access/matrix/toggle/` | `PUT /api/admin/access/roles/[role]/permissions/[perm]` / `DELETE` |
| `/access/matrix/holders/` | `GET /api/admin/access/holders?role=` or `?perm=` |

### 5.3 Auth mapping (Better Auth)

- `is_super_admin` → Better Auth admin plugin role `superadmin` (or `admin` with `adminUserIds`).
- `games.manage_game_settings` → a permission statement, e.g. `arcade: ["manage"]`, given to an `editor` role via
  `createAccessControl`; check with `auth.api.userHasPermission` in every endpoint, never only in the UI.
- Keep the **404, not 403** behaviour for admin pages if the owner wants the section unadvertised.
- FSLG editors (A10–A12), sound uploads and reverts stay **superadmin-only** unless the owner widens them; consider
  permissions `game_content: ["edit"]`, `sounds: ["replace"]`.
- PermissionOverride (grant/revoke with reason and expiry) and AccessGrant (time-boxed) are worth keeping as a small
  `permission_override` table if editors are added; the resolver formula in 4.1 is the spec.

### 5.4 Drizzle tables (suggested)

`game_settings (slug pk, data json, updated_at)` · `game_content (kind, key, data json, version, updated_by,
updated_at; unique kind+key)` · `game_content_version (id, kind, key, version, data, note, by, created_at)` ·
`global_sound (game, name, object_key, content_type, size, duration, original_name, version, uploaded_by,
updated_at; unique game+name)` · `audit_log (id, at, actor_id, actor_label, action, entity, entity_id, changes json,
note)` · `role_permission (role, permission)` · optional `permission_override`, `access_grant`.

### 5.5 Behaviour checklist for the rebuild

1. Site-wide row + per-game rows, tri-state "follow" semantics for leaderboards, hero, access.
2. Code rules: normalise (lower-case, no spaces), ≥4 chars, dial `[0-9*#]`, unique per game, secret code ≥8, stored
   hashed (Argon2/scrypt), shown once when generated, never logged or exported.
3. Audit every write with a redacted diff; one audit screen.
4. Exports in PDF, DOCX, XLSX, CSV and a print page; "Confidential" stamp with time and exporter; injection guard.
5. Sounds: server-side sniffing of WAV/MP3/M4A, ≤2 MB, 0.05–120 s, versioned URLs, revert deletes the file.
6. Game content: validate on the server (schema, sizes, tag stripping, token preservation), version + history (keep
   50) + rollback-as-new-version, bundle ETag.
7. Credits: only `visible && approved` reach players.
8. Matrix: optimistic toggle per cell with server confirmation and a toast; holders side panel.
