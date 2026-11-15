# Cutscene format (for script writers)

Cutscenes are written in the mission scripts (`docs/story/scripts/*.md`) as small screenplay blocks. `tools/story/build_cutscenes.py`
turns them into game data (`static/js/games/fslg-cutscenes-*.js`, generated, never hand-edited); the Cutscene Director
(`static/js/games/samaru-cutscene.js`) plays them with the real player (current outfit), the companions who are with the player,
and the real campus people. The same lines feed the story PDFs and the voice scripts, so every spoken line keeps the usual form
`- SPEAKER: text [v: ]` (≤ 90 characters).

Check a file at any time (writes nothing): `.venv/bin/python tools/story/build_cutscenes.py --check docs/story/scripts/Y1.md`

## 1. Where a block goes

At the very end of a mission's section (after **Around it.**, before the `---`). Place, ambient, vehicle and event cutscenes that
belong to no mission go in `docs/story/scripts/CUTSCENES.md`.

```
#### cut_m7_brief — Briefing: trouble at the court
- Type: brief · Hook: brief · Stage: here · Cast: FRIEND_1=@roomie
- End: stays
> shot wide; FRIEND_1 enters
- @ROOMIE: They say the court belongs to somebody. Since when does a court belong? [v: ]
> shot close PLAYER; PLAYER shrugs
- PLAYER: Since somebody said it loudly. Let's go and see. [v: ]
```

Id: `cut_<mission>_<name>` for missions (`cut_m7_brief`, `cut_m7_result`, `cut_m7_slyfalls`), `cut_enter_<place>`, `cut_amb_<name>`,
`cut_veh_<name>`, `cut_event_<name>`. Lower case, digits, underscores. The mission is the `### mN` section the block sits in.

## 2. Header lines (one or two `- Key: value · Key: value` lines right under the heading)

| Key | Values | Default |
|---|---|---|
| `Type` | `brief` `result` `full` `entry` `vehicle` `event` `ambient` `finale` | `full` |
| `Hook` | `brief` (before the mission's first step) · `result` (after its last step) · `before beat N` · `after beat N` · `enter beat N` (when you arrive at that beat's place or person). Year 2–5 and side files, whose data is hand-written, use `step N` instead of `beat N` (N = the step's number in the data file). | none |
| `Trigger` | for cutscenes with no hook: `go <place>` (first arrival) · `ride <vehicle>` · `event blackout` `event lightback` `event rain` `event morning` `event night` `event swim` `event levelup` · `near <place> <metres>` | none |
| `Stage` | `here` (played around the player, wherever they are; other people walk up) · `at <place>` (the player is there, or is taken there through a fade) · `cutaway <place>` (the camera goes there without the player; the player stays put) | `here` |
| `Cast` | `ROLE=id` pairs for generic roles, `|` for fallbacks, `?` = optional: `FRIEND_1=@roomie`, `LECTURER=@hod|okonkwo`, `FRIEND_2=?` | names are cast by themselves |
| `Extras` | a number (0–10) of background students placed round the scene; fewer on weak phones | 0 |
| `End` | the end state, the same whether watched or skipped: `stays` (player where the cutscene found them) · `at mark` (where the scene put them) · `at <place>`; then optional `; faces ROLE`, `; sets flag_a, flag_b`, `; time HH:MM` | `stays` |
| `Once` | `yes` / `no` (ambient ones may repeat) | `yes` |
| `Lock` | `yes` / `no` (`no` = the player keeps control; only lines, gestures and a gentle push-in) | by type: ambient no, others yes |
| `Needs` | `companion` · `day` · `night` · `flag <name>` · `noflag <name>` | none |

Rules: every cutscene is skippable; 10–40 seconds (4–9 spoken lines); one idea per cutscene; `End` must hold everything that
lasts (position, flags, time) because a skip jumps straight to it. A cutscene never gives items or money: rewards stay in the mission.

## 3. Who can speak

- `PLAYER`, `@ROOMIE`, `@BEST`, `@CRUSH`, `@HOD`, and any named person exactly as in the scripts (`BABA PORTER`, `MALAM GARBA`).
- Generic roles (cast from who is really there): `FRIEND_1`, `FRIEND_2`, `FRIEND_3` (companions walking with the player, else the
  `Cast` fallback, else the line is dropped), `LECTURER` (the head of the player's department), `GIVER` (the mission's giver).
- Voices with no body: `PHONE (Mum)`, `RADIO (Kabiru)`, `CROWD`, `WALKER`. They are heard and subtitled; nobody is placed.
- Companions with the player always stand in the scene and react, even with no lines.

## 4. Directions (`> …`, several separated by `;`)

Camera (a line with no shot before it gets one automatically: wide first, then closes on whoever speaks):

| Direction | Picture |
|---|---|
| `shot wide` | everyone, full figures, the place behind them |
| `shot two` | the two main people, waist up |
| `shot close ROLE` | head and shoulders |
| `shot over ROLE` | over the listener's shoulder at ROLE |
| `shot low ROLE` | from below (big, proud or threatening) |
| `shot high` | from above the scene |
| `shot orbit` / `shot orbit ROLE` | a slow circle |
| `shot follow ROLE` | behind someone who is walking |
| `shot place <place>` | an establishing view of a building or landmark |
| `push in` / `pull out` | a slow move on the current shot |
| `pan to ROLE` / `pan to <place>` | turn the current shot |
| `shake` | a small bump (dropped when reduced motion is on) |

People:

| Direction | What happens |
|---|---|
| `ROLE enters` / `ROLE exits` | walks in from off-camera / walks away |
| `ROLE walks to ROLE` · `ROLE runs to ROLE` · `ROLE walks to centre` | moves there (stops an arm's length away) |
| `ROLE faces ROLE` / `ROLE faces camera` | turns |
| `ROLE waves` `cheers` `slumps` `dances` `sits` `stands` `points` `nods` `shakes head` `shrugs` `salutes` `claps` `thinks` `laughs` `gasps` `bows` `facepalms` `phones` `hands on hips` `hugs` | the gesture (about 2.5 s; `sits`, `phones`, `hands on hips` hold until `stands` or the end) |
| `extras cheer` · `extras gasp` · `extras wave` · `extras dance` | the background students react |

Screen, sound and world (all undone when the cutscene ends unless `End` says otherwise):

| Direction | What happens |
|---|---|
| `caption Some text` | a narration line on screen (not spoken, not recorded) |
| `title "BIG TEXT" "small text"` | a title card |
| `fade out` / `fade in` | through black |
| `wait 1.5` | hold, in seconds |
| `sfx <name>` | a game sound (`power` `special` `coin` `lose` `whistle` `click` `horn`) |
| `music <cue>` | a cue from `04_MUSIC.md` |
| `world night` · `world day` · `world time 19:30` · `world blackout on` · `world blackout off` · `world rain on` · `world rain off` | for the length of the scene |

## 5. Style

Show, then tell: open on a picture (a wide shot, a person arriving), then the line. Keep one joke per cutscene and give it room.
A briefing answers "what is the problem and where do I go"; a result shows what changed and gives one warm or funny button line.
Stay with the character voices in `CHARACTERS_BACKSTORY.md`. Modest, non-lethal, original; humour never mocks a group.
