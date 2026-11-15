# Real voices for Freshers School Life

The game no longer reads lines with a machine voice. Every spoken line is either a **real person's recording**
(yours and your friends') or, until someone records it, a short wordless murmur with the words shown in the speech
bubble. Nothing is synthesised or cloned, and no voices are taken from the internet.

## What there is to record

- **18 voice roles** covering the whole game from the first day: all 120 missions (`docs/story/scripts/Y1.md`,
  `Y1b.md`, `Y2.md` … `Y5.md`), the side missions, the campus encounters, the Maker's sayings, and the lines the game
  speaks around campus (barks, crowd, security, radio idents, lecture-hall lessons, greetings). Each role is numbered
  once, tier by tier: **A** must record (all of Year 1, encounters, sayings, the lines heard constantly, and the first
  beat and turning point of every later mission), **B** nice to have, **C** optional. Readers do A first and stop
  when they run out of time; what they send still lines up.
- **Filler phrases** (`FILLER_PHRASES.pdf`, source `FILLER_PHRASES.md`): ~350 short reusable phrases tagged with a
  mood and a use. Anyone can record them, the more people the better. When a line has no recording, the game shows
  its words and plays one of these that fits ("Haba!", "How far?", a laugh), never the same one twice in a minute
  for the same character.

## Three steps

1. **Hand out the PDFs.** `docs/voice/pdf/` has one PDF per voice role (16 roles), each with the recording
   instructions and a consent line inside, plus `00_DIRECTOR_GUIDE.pdf` for you (cast list, how to collect files,
   checklist) and `ALL_ROLES.pdf` with everything. Give each person one role. *The Player (male)* and *The Maker*
   are marked as yours.
2. **Collect the recordings into `voice_in/`**, each named `<role>_<name>.m4a` (any audio format), for example
   `bature_m_musa.m4a`; filler phrases as `filler_m_<name>.m4a` (a man) or
   `filler_f_<name>.m4a` (a woman). Several sittings: add `_1`, `_2` to the name.
3. **Run one command** from the project folder:

   ```sh
   sh tools/voice/run.sh
   ```

   It refreshes the script and PDFs, cuts every file into clips, cleans and levels them, writes them to
   `static/audio/voice/` with a `manifest.json`, and writes `voice_review/index.html`. Open that page, play each
   clip and check it sits beside the right line. Reload the game: recorded lines are now spoken.

The tool's own environment is in `tools/voice/.venv` (numpy and a bundled ffmpeg); the command recreates it if missing.

## How a recording is read

A person's files are read in name order as one long take of their role: the 1st sound is line 1, the 2nd is line 2,
and so on. Lines are separated by silence (0.7 s or more). **A single clap means "that take was bad"**: the sound
just before the clap is thrown away and the next one takes its place.

## If a file is out of step

The review page marks people whose number of clips differs from the number of lines. Create
`voice_in/offsets.json` and run the command again:

```json
{
  "friend_a_m@musa": { "skip": [12], "merge": [30], "start": 1, "gap": 0.7 }
}
```

- `skip`: clip numbers to drop (a fluffed take with no clap, a cough).
- `merge`: clip numbers to join with the next clip (a pause that was too long inside a line).
- `start`: the line number the first clip belongs to, if the person began part-way through.
- `gap`: seconds of silence that separate two lines (raise it if lines are being cut in two, lower it if two lines stick together).

## More than one voice per role

Two people can record the same role (`crowd_amina.m4a`, `crowd_john.m4a`). The game spreads the speakers across
characters, and each character keeps the same voice every time. Shouts and small talk that many characters use
appear in several roles on purpose, so around campus the same line is heard in different voices. Roles ending
`_m` and `_f` are used for male and female characters; `crowd`, `dj` and `extras` are used for anyone.

## What the tool does to a voice

Cutting on silence, trimming, removing rumble below 80 Hz, a gentle noise gate, and the same loudness for every
clip. Then honest effects only: a radio band for DJ idents, a megaphone version of security shouts for chases, a
hall echo for lecturers, and for crowd lines two extra takes shifted 5% up and down in pitch.

## In the game

- Settings → Sound → **Voices** turns all speech on or off.
- Settings → Sound → **Fill unrecorded lines with**: *phrases* (default: a recorded filler phrase that fits, or a
  murmur if none fits), *murmur* (a short wordless sound), or *robot voice* (the browser's machine voice).
- Lines that contain a name or a number the game fills in while playing cannot be matched to a recording; they stay as bubbles.

## When the game's lines change, and Part 2

`sh tools/voice/run.sh` regenerates the script and PDFs first. A line's id comes from its words, so recordings of
lines that did not change keep working. New lines are appended scene by scene, so an existing recording of a role
can drift out of step after the script changes: keep people's original files, and re-run with `offsets.json` or
ask for the new lines only.

The story scripts are read every time. Every spoken line ends `[v: ]`; speakers are mapped to roles by the `SPEAK`
table in `tools/voice/make_script.js`, and the director's guide lists who plays whom. "Your roommate" lines are
recorded by Bature and Firdausi (the defaults); with another roommate chosen they fall back to a filler phrase in the
right voice. Lines that contain a name filled in during play (`@hostel`, `@dept`) are left out. On-air lines get the
radio effect and lecture-hall lessons the hall echo, line by line.
