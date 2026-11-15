# Voices and Recording

Private to the owner. How to get Freshers School Life voiced by real people: who records what, how,
in what order, and with what permission. The hand-out PDFs are in `docs/voice/pdf/` and are
regenerated from the scripts with one command (section 7).

## 0. Revision 4: the scripts start at mission 1

The whole story has been rebranded from the beginning of the game. The recording scripts now start
at mission 1 (registration day and the room choice, `docs/story/scripts/Y1.md`) and run in order to
mission 120. The old pre-rebrand Year 1 lines (the original game's mission dialogue, the Sadiq-only
roommate and the female Bola) are **retired**: they are no longer in any hand-out, and any recordings
of them will not be used. If someone has already recorded from an older PDF, keep the file only for
lines that still appear word for word; the tool matches by the words, so unchanged lines keep working.

## 1. The idea in one paragraph

Every spoken line in the game and the story is fixed text with an id. Lines are grouped into **16 voice
roles**; each role is one person reading one PDF. Several characters share a role (a role is a voice
type, not a character), so a dozen friends can voice the whole game. Anything not yet recorded shows
as text in a speech bubble and plays a recorded **filler phrase** that fits the mood, never a robot
voice (unless the player switches that on).

## 2. Which PDF to give whom

| PDF | Give it to | Characters in it |
|---|---|---|
| `01_player_m.pdf` | You (the owner) | The player, male |
| `02_player_f.pdf` | A young woman, 17–22 | The player, female |
| `03_friend_a_m.pdf` | A young man, warm and easy | Bature (default roommate), Khalid, Tunde, Muhammad, Kelechi, Jega, Shamsu ("Professor Shamsu") |
| `04_friend_b_m.pdf` | A young man, a joker | Sadiq, Muktar, Yusuf, Abbas ("John Carter"), Lula, Yakubu, Abdul, Basit, Lucky |
| `05_friend_c_f.pdf` | A young woman, bright and quick | Ada, Nusaybah, Summy, Emily, Big Baby, Faty, Lily, Jasmin |
| `06_friend_d_f.pdf` | A young woman, calm and confident | Firdausi (default roommate), Fatima, Joy, Maryam, Lyzzy, Aleeya, Wednesday, IDK (Kaltume), Comrade Sadiya |
| `07_lecturer_m.pdf` | A man who can sound 40–60 | Prof. Bello, Mr. Ezekiel, Ustaz Auwal, examiners |
| `08_lecturer_f.pdf` | A woman who can sound 35–55 | Dr. Okonkwo, Dr. Khadija, Prof. Nwachukwu (tapes), Svitlana |
| `09_security_m.pdf` | A man with a firm voice | Corporal Peter, Ranger Lawal, guards, rangers |
| `10_dj.pdf` | Anyone with a radio voice | DJ Kabiru, DJ Sugar, radio adverts |
| `11_traders_m.pdf` | A man who can sound 30–60 | Malam Garba, Mai Shayi Audu, Emeka, Baba Dam, Coach Danladi, KB, Tanko, Chief Megawatt, Engr. Aliyu, Alhaji Needle, Chi-Tech, Baba Shuttle, Pastor Sam, Shuaibu, the foremen, Mallam Dogo |
| `12_traders_f.pdf` | A woman who can sound 30–60 | Mama Nkechi, Hajiya Ladi, Nurse Hauwa, Captain Uche, Aunty Asiya, Iya Risi, Kaka, Mrs. Adebayo, Mrs. Shehu, Sgt. Bilkisu, Clemantine, Foreman Asabe, Mum |
| `13_crowd.pdf` | Two or three people passing the phone | Walkers, bystanders, the ★ exclamations in `docs/HUMOUR.md` |
| `14_bullies_m.pdf` | A man with a heavier voice | Bolaji ("Big Sly"), Hassan |
| `15_maker_m.pdf` | You (the owner) | The Maker, including his sayings, Rumi lines and big words |
| `16_extras.pdf` | Anyone | Children, Aminu, Musa, small parts |
| `FILLER_PHRASES.pdf` | Everyone, once | Short reusable phrases by mood |
| `00_DIRECTOR_GUIDE.pdf` | You | Cast list, collecting files, checking |
| `ALL_ROLES.pdf` | You | Everything in one file |

If you want one person per character instead (Bature with his own voice, say), tell the voice tool:
add the character to its own role in `tools/voice/make_script.js` and rerun (section 7).

## 3. Recording instructions (printed inside every PDF)

1. A quiet room with soft things in it (a wardrobe, curtains). No fan.
2. Phone 15 cm from your mouth, slightly to the side.
3. Read each line once, in order. Do **not** read the numbers aloud.
4. Leave about a second and a half of silence between lines.
5. If you fluff a line, clap once and say it again. The tool keeps the last take.
6. Your own natural voice and normal Nigerian English. Pidgin and Hausa where written. No put-on accents.
7. Save the file as `<role>_<yourname>.m4a` (any format is fine) and send it.
8. Sessions longer than 20 minutes: break and start a new file `_2`.

## 4. Order of recording (tiers)

| Tier | What | Why first |
|---|---|---|
| **A** | Every ambient encounter, the Maker's sayings and Rumi lines, the first beat and the turning point of every main mission | Heard constantly or story-critical |
| **B** | The rest of the main missions; first and turning beats of side missions | The story |
| **C** | Radio, walkers and phone colour; other side-mission beats; conditional variants | Optional |

Record A for every role before anyone starts B. The director guide lists minutes per tier per role.

## 5. Consent

Each PDF has a consent line the reader signs (or says aloud at the start of the recording): that they
agree their voice is used in Freshers School Life and its trailers, that they may ask for it to be
removed later, and whether they want their first name in the credits. Keep the signed pages. Rules:

- Only adults record adult roles. Children's lines (Aminu, Jasmin) are read by adults in a light voice,
  or by a child only with a parent's written consent.
- Nobody's real voice is cloned, altered into someone else's, or generated. The tool only cleans, levels
  and adds honest effects (hall echo for lecturers, radio for DJs, megaphone for guards).
- A person who withdraws consent: delete their files from `voice_in/` and `static/audio/voice/` and rerun.

## 6. The filler scheme

When a line has no recording, the bubble shows the words and the game plays a recorded filler phrase
chosen by mood (happy, annoyed, sad, excited, neutral, worried, flirty, angry-light, tired) and use
(greet, agree, refuse, react, thank, warn). About 350 phrases in `docs/voice/FILLER_PHRASES.md`, read
by everyone once. Settings → Sound → "Fill unrecorded lines with": phrases (default), a short murmur,
or the robot voice.

## 7. Regenerating after the story changes

```
sh tools/voice/run.sh
```

This re-reads the story scripts (`docs/story/scripts/*.md`, from `Y1.md` onward), the game's own lines and the Maker's
sayings, rebuilds `docs/voice/lines.json` and `RECORDING_SCRIPT.md`, and rewrites every PDF in
`docs/voice/pdf/`. Ids come from the words, so unchanged lines keep their ids and their recordings.
New characters are mapped to roles in the `SPEAK` table in `tools/voice/make_script.js`; anyone not in
the table goes to the closest role by sex and type.

## 8. Current counts

Written by the tool at the last regeneration; see `docs/voice/RECORDING_SCRIPT.md` for the live numbers.
