# BARKS FORMAT v1: unscripted lines, filler and replies

**What a bark is.** A short line a character says outside a cutscene: when you greet them, bump into them, give them a gift, pick a reply in a choice wheel, when the light goes, when it rains, during exams or the strike, or just idling as you pass. Barks make the campus feel alive. Story lines (from `docs/plan/missions/`) and barks are merged into one voice script per character by `tools/voice/build_voice_scripts.py`.

**Read with:** `docs/plan/STORY_BIBLE_V2.md` §1.6 (tone), §2 (cast, arcs per year), §1.9 and §13.5 (Muhammad rules), §8 (special characters); `docs/plan/missions/FORMAT.md` §5 (moods) and §6 (special characters' voices).

## 1. File layout

One file per character in `docs/voice/barks/`, named by the cast id without the prefix: `jega.md` for `npc.jega`, `special_jiya.md` for `special.jiya`, `roomie.md` for `npc.roomie` (recorded by both Bature and Firdausi), `player.md` for the player. Public and crowd packs are `public_<group>.md` (for example `public_traders.md`) with the cast id `crowd.<group>`.

````
# Barks: Jega
**Id:** npc.jega
**Voice:** one or two sentences for the actor: age, accent, energy, catchphrases.

## Filler
### greet
- `bk_jega_greet_01` (warm) "Ina kwana! [Good morning!] You ate?"
- `bk_jega_greet_02` (excited) "My guy! Left boot first today?"

## Year 1
### idle
- `bk_jega_y1_idle_01` (proud) "Coach looked at me today. Twice. That's a contract."
````

## 2. The rules (the builder rejects a file that breaks 1–6)

1. **Headings.** `#` title, then the `**Id:**` and `**Voice:**` lines. `##` is a **stage**: `Filler` (any time), `Year 1` … `Year 5`, `Post-game`, or `Events`. `###` is a **category** from §3.
2. **Line form, exactly:** `` - `id` (mood) "text" `` with an optional ` · when: <condition>` after the closing quote. One line each.
3. **Ids:** `bk_<who>_<stage>_<category>_<NN>`, where stage is `f` (Filler), `y1`–`y5`, `post`, or `ev`. Examples: `bk_jega_f_greet_01`, `bk_jega_y3_idle_02`, `bk_pub_traders_ev_strike_01`. Under `## Events` the category already starts with `ev_`, so the short form `…_ev_strike_NN` is preferred; the long form `…_ev_ev_strike_NN` is also accepted (some packs use it). Every id is unique across all files. Never reuse an id; never renumber a recorded one.
4. **Mood** is one of FORMAT.md's: `neutral, warm, amused, bored, stern, sharp, shy, proud, scared, sad, excited, dry, whisper`.
5. **Length:** 90 characters at most, translation included. Most barks are 3–12 words. Barks are heard while walking past: short, clear and funny.
6. **Non-English** (Hausa, Pidgin, Yoruba, Igbo, Mandarin, Korean, Portuguese) is followed by its translation in square brackets: `"Sannu! [Hello!]"`. Every such line is a draft for a native speaker to check.
7. **Conditions** (`when:`) use flags already in the missions or simple state: `night`, `raining`, `blackout`, `exam_week`, `strike`, `ramadan`, `player_female`, `player_male`, `friendship>=3`, `m063_done`, `maker_away`, `blackout_soon` and `hard_night_soon` (a scripted blackout or hard night is due within a day: KB's prices), `lang_pt` (Taty's Portuguese, swappable if she becomes Italian), `results_good` and `results_bad` (the semester's results, for Mum and Dad). Keep them simple; the engine reads them later. A comma means **all** must hold: `when: player_female, friendship>=3`.

## 3. Categories

| Group | Categories |
|---|---|
| Social | `greet`, `bye`, `thanks`, `sorry`, `compliment`, `tease`, `follow` (walking with you), `wait` (you are slow), `lost` (you went the wrong way) |
| Replies (choice wheels and unscripted answers) | `yes`, `no`, `maybe`, `confused`, `agree`, `refuse`, `joke`, `ask` |
| Reactions | `hit` (bumped or knocked down; never hurt), `fall`, `win`, `lose`, `blackout`, `light_back`, `rain`, `heat`, `food`, `money` |
| Gifts | `gift_like`, `gift_dislike`, `gift_love` |
| World | `idle` (said to nobody as you pass), `night`, `callback` (a short nod to a past mission; name the mission in `when:`) |
| Events | `ev_freshers`, `ev_exam`, `ev_results`, `ev_strike`, `ev_ramadan`, `ev_christmas`, `ev_cup`, `ev_elections`, `ev_valentine`, `ev_harmattan`, `ev_convocation`, `ev_allowance`, `ev_market_day` |

## 4. How much each character needs

| Tier | Filler | Each year (5) | Events | Total about |
|---|---|---|---|---|
| Lead (Jega, Shamsu, Mubarak, Nusaiba, Zainab, {{ROOMIE}}) | 60–80 | 20–25 | 20–30 | 180–240 |
| Main friend, special character | 40 | 8–12 | 10–15 | 100–120 |
| Recurring | 20–25 | 3–6 | 5–8 | 50–70 |
| The Maker, Muhammad | see §5 | | | |
| Public groups | 30–60 per group across stages and events | | | |
| Player | 80–120 short replies (1–8 words), once per playable voice | | | |

## 5. Rules for the mystery

- **Never explain** a background mystery in a bark. A bark may notice (the clock, the cats, the cold) but never answer.
- **Muhammad** has very few barks (15–25 in all). He never explains, never lies, apologises for knowing, and only appears to those who can see him. Nobody else has a bark about him except "Who? There was nobody there fa." variants (`confused`).
- **The Maker** speaks carefully and briefly, sometimes grandly. His barks use the sayings in bible §10.3 and `docs/legacy/story/02_BIBLE.md` §18 where they fit. **No Rumi in barks**: Rumi is only for the fourteen story moments.
- **Special characters** (Jiya, Taty, Madison) are drafts for the real person to change. They never mention Muhammad, seals, coils or the bell.

## 6. Tone

Warm, fast and very funny. The joke is always the situation (sapa, garri, NEPA, queues, network, exams, hostel wahala), never a person's tribe, faith, body or money. Faith is ordinary and respected. Romance is modest and opposite-sex only. Zainab is very fair-skinned, and only her friends call her "Snow White", warmly. Kaltume is now **Helen** ("IDK"). Use place names from bible §1.7.
