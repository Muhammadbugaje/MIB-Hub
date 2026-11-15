# Freshers School Life — Campaign Outline

One hundred and twenty main missions in five acts, fifty side missions, thirty ambient encounter
templates. Read `02_BIBLE.md` first. Full scripts are in `scripts/`. Co-op missions for 2–6 players
are in `05_FRIENDS_MISSIONS.md`.

**Revision 4.** Year 1 (m1–m36) has been written fresh from the first moment (room choice); see section 3.
**Revision 3.** `STORYLINE.md` now holds the revised arc with the new cast, heists, Hock Day, the dream
mission, the horse race and the twists; where the tables below differ from it, `STORYLINE.md` wins.

**Revision 2.** The owner approved the five-year story and asked for about 120 main missions instead
of 200. Year 1 keeps m1–m36 as built. Years 2–5 have 21 missions each (m37–m120). Missions that were
merged or cut from the first draft are noted in each act; nothing in the mystery was lost.

Contents

1. Shape of the whole
2. Notes on the existing 36 missions
3. Act 1 — Arriving (100 level), m1–m36
4. Act 2 — Money (200 level), m37–m57
5. Act 3 — Drift (300 level), m58–m78
6. Act 4 — Image (400 level), m79–m99
7. Act 5 — Leaving (500 level), m100–m120
8. Side missions s1–s50
9. Ambient encounter templates e1–e30
10. Pacing chart
11. Where things are introduced
12. Replay hooks

Column key for mission tables: **Shape** uses the bible's list. **Gate** is the minimum player level.

---

## 1. Shape of the whole

| Act | Level | Missions | Count | Theme | Face of Entropy | Coil lit | Finale |
|---|---|---|---|---|---|---|---|
| 1 | 100 | m1–m36 | 36 | Arriving | Count Entropy | Garden (1st) | Convocation night (the seniors') |
| 2 | 200 | m37–m57 | 21 | Money | Iron Mama | Mall (2nd) | Unplug Iron Mama; light for everybody |
| 3 | 300 | m58–m78 | 21 | Drift | The Long Silence | Old Campus (3rd) | The Idle King; lights on the long road |
| 4 | 400 | m79–m99 | 21 | Image | The Mirror | Tower (4th), Dam (5th) | The Mirror; log off |
| 5 | 500 | m100–m120 | 21 | Leaving | Chancellor Null | Senate (6th) | The longest night; convocation; sign-out |

Each act has two semesters and ends its year with results and promotion. Five threads take turns so
none is silent for more than four missions:

- **M** — mystery (Entropy, the coils)
- **D** — department and academics
- **F** — friendship and the crew
- **R** — romance, or its single-path twin
- **W** — world: the market, security, clubs, faith communities, the forest

Level gates assume the current curve (story XP alone reaches about level 41 at m36; cap 150). Targets:
Act 2 ends near 55, Act 3 near 80, Act 4 near 105, Act 5 near 130. Rewards must be tuned to that.

## 2. Notes on the existing 36 missions

**A1. Two line edits.** m36 "Convocation night" stays, but it becomes the seniors' convocation that a
fresher saved. Change Malam Garba's line "Go and dance, graduate." to "Go and dance. Fresher no more."
and the step text "Defeat Count Entropy, for good" to "Defeat Count Entropy". The reward flag
`graduate` should be renamed `year1` when the long story is built; saves that have it are treated as
having finished Act 1.

**A2. Chapters.** The existing chapter numbers 1–12 become "weeks" of Year 1. No other change.

**A3. Threads already planted in m1–m36 that later acts pay off:**

| Planted in | What | Paid in |
|---|---|---|
| m5 The missing fuse | Dr. Okonkwo knows the grid | m84, m101 |
| m6 Mai Shayi knows | Audu as informant | m41, m42, m83 |
| m9 Sly's last stand | Sly's respect | m46, m102 |
| m10 Stone that points | Kelechi's clue statues | m66 (the same marks at Old Campus) |
| m11, m14, m27, m31 | Baba Dam and the eel | m90, m95, m95, m114 |
| m18 Wings | Flight | m48, m74, m87, m87, m114 |
| m23 The hum | The Maker hears something under the ground | m44 (it is the mall generator) |
| m25 Paper trail | A bank trail that went nowhere | m49 (the contract file) |
| m32 Six plaques | The six sites named | every coil mission |
| m34 Everybody | The school turns out | m108, m112–m114 |

## 3. Act 1 — Arriving (100 level)

Revision 4: rewritten from the first moment of the game. Full scripts in `scripts/Y1.md` and
`scripts/Y1b.md`; the arc in `STORYLINE.md`. The game opens with the room choice in m1.

| id | Title | Thread | Shape | Places | Gate |
|---|---|---|---|---|---|
| m1 | Welcome, fresher | D | escort | Main Gate, @hostel, Senate, @dept | 1 |
| m2 | Belle first | F | routine | KB's shop, Mama Nkechi's buka, @hostel kitchen, your first lecture, @hostel | 1 |
| m3 | Two wheels | W | delivery | Main Gate, the bicycle stand, Page Turner Books, the Library | 1 |
| m4 | They have taken light | M | defend | @hostel, the corridor, the courtyard, Senate | 2 |
| m5 | The missing fuse | M | collect | Fire Station, Radio Studio, the electrical workshop, Engineering Complex | 2 |
| m6 | Mai Shayi knows | M | investigation | Audu's tea stall, the Sculpture Garden, the maker's bench | 3 |
| m7 | Fresher tax | F | boss | the Basketball Court, the mechanic yard | 3 |
| m8 | Run am | W | race | Racing Club, the Theatre Loop, the football pitch | 4 |
| m9 | Sly's last stand | F | boss | the Basketball Court, the mechanic yard, Mama Nkechi's buka | 4 |
| m10 | Stone that points | M | investigation | Sculpture Garden, Chapel, Central Mosque, The Dam shore | 5 |
| m11 | Baba Dam | W | delivery | The Dam pier, the civil workshop, the timber yard, the market, the pier | 5 |
| m12 | Licence | W | race | Racing Club, the hostels ring, the Main Gate | 5 |
| m13 | Keke Grand Prix | W | race | Racing Club, the Ring Road, the grandstand | 6 |
| m14 | The dam at midnight | M | boss | Samaru Market, the Dam at night, the ranger's path | 6 |
| m15 | The class of your life | D | quiz | Engineering Complex, Kainji Theatre, the electrical lab | 7 |
| m16 | Gather the crew | F | social | all over — @hostel, the yard, the pitch, KB's shop, the Art Gallery, Page Turner Books | 7 |
| m17 | Count Entropy | M | boss | Senate at night, the Senate steps, the Selfie Garden | 7 |
| m18 | Wings | W | flight | the Flying Club airfield, the runway, over the campus, over Samaru Market | 10 |
| m19 | Up NEPA party | F | rhythm | Radio Studio, KB's shop, Shinkafi | 12 |
| m20 | Profile picture | R | collect | Selfie Garden, Geography Garden, Love Garden, Sculpture Garden | 13 |
| m21 | Express delivery | W | delivery | Main Gate, Samaru Market, KB's shop, civil workshop, above the Dam | 14 |
| m22 | Senate Sprint | W | race | Racing Club, Freshers Boulevard, Senate ring, Fountain Circle | 15 |
| m23 | The hum | M | investigation | Engineering Garden, Engineering quad, Library steps | 16 |
| m24 | Two papers, one day | D | quiz | Physics, Mathematics, Library, Senate (registry window), Mama Nkechi's buka | 17 |
| m25 | Paper trail | M | investigation | Mai Shayi's stall, the Bank, Page Turner Books, Radio Studio | 18 |
| m26 | East Side Drift | W | race | Racing Club, east side roads, campus fence, forest edge | 19 |
| m27 | What the net caught | M | boss | The Dam pier, the shallows, Bolaji's corner at the court, Engineering Garden (dark) | 20 |
| m28 | Wingman | R | social | @hostel, Clemantine's Gift Corner, KB's shop, Radio Studio, Love Garden | 21 |
| m29 | Night market | W | defend | Samaru Market, the gate road, KB's shop | 22 |
| m30 | Signal from the sky | M | flight | Airfield, over the Dam, the Sculpture Garden, the Central Mosque, Samaru Market, Engineering | 23 |
| m31 | The second eel | M | boss (care) | Samaru Market (kilishi), The Dam at night, the shallows, Engineering Garden | 24 |
| m32 | Six plaques | M | collect | Engineering Garden, EE department, Chemical Engineering, Physics, electrical workshop, | 25 |
| m33 | School Marathon | W | race | Racing Club, the whole campus: boulevard, gardens, hostels, Dam road, Phase 2 turn, back to | 26 |
| m34 | Everybody | F | social | The Dam, the Airfield, Mama Nkechi's buka, Radio Studio, the Senate, Samaru Market, KB's | 27 |
| m35 | Blackout protocol | M | defend | Fire Station (substation), Radio Studio, the boulevard between them | 28 |
| m36 | Convocation night | M | boss | Engineering Garden, the boulevard, the Senate steps, the Selfie Garden | 30 |

## 4. Act 2 — Money (200 level)

**Theme.** You are no longer new. The market has become a mall, everything costs something, and
somebody has worked out that light can be sold.

**Mystery.** The mall never blinks. A van, a switch under the gate, a cable numbered 2. The second coil
lies under the mall, and a generator the size of a room is feeding on it.

**Department.** Your first department week; test week and exams. **Friendship.** The room; Bolaji's
skating; Big Sly goes straight. **Romance.** First dates become possible. **World.** The mall, the
arcade, the dance floor, the MIB Store, the shuttle strike, Phase 2 in the dark.

Merged from the first draft: the fresher you guide is now an ambient encounter; the three department
week missions are one; the feeder markers are found inside m42 and m53; the contract file and the
hearing are scenes in m49 and m56; exams and the long-vacation choice close m47 and m57.

| id | Title | One-line premise | Giver | Places | Thread | Shape | Gate |
|---|---|---|---|---|---|---|---|
| m37 | Stalite | You come back from the break and someone else's name is on your bed. Sort it with Baba Porter before dark. | @roomie | Hostel, Senate | F | social | 31 |
| m38 | Grand opening | The market has become a mall. Carry Hajiya Ladi's goods to her new shop and get lost on two floors. | Hajiya Ladi | Gate, Mall | W | delivery | 32 |
| m39 | New drip | Alhaji Needle measures you for your first native; Aunty Asiya at the MIB Store thinks you can do better. | Alhaji Needle | Mall, MIB Store | W | collect | 33 |
| m40 | Level two, round one | Basit holds every high score in the Game Room. He lets you pick the machine. | Basit | Mall: Game Room | W | rhythm | 34 |
| m41 | The mall never blinks | The whole campus goes dark. Across the road the mall is glowing. Go and look, then ask Mai Shayi. | Mai Shayi Audu | Hostel, Gate, Tea stall | M | investigation | 35 |
| m42 | Meter reader | Follow the Works van from the substation at dusk without being seen. | Mai Shayi Audu | Fire Station, Boulevard, Gate, Mall | M | tail | 36 |
| m43 | Department week | Quiz at Kainji, five-a-side on the pitch, and a dinner with a dress code, all in three days. | @hod | KT, pitch, Social Centre | D | quiz | 37 |
| m44 | Iron Mama hums | After closing, the hum is loudest under the mall. Get into the basement and see what is making it. | The Maker | Mall basement | M | stealth | 38 |
| m45 | Shuttle strike | The shuttle drivers have parked. Phase 2 is stranded. Emeka lends you a keke and a price list. | Emeka | Gate, Phase 2 road | W | delivery | 39 |
| m46 | Sly goes straight | Big Sly is opening a barber's chair in the mall. His old boys think that is funny. Stand at the door. | Big Sly | Mall: Sly's Cuts | F | defend | 40 |
| m47 | Test week | Three tests in two days, a night tutorial under the one working lamp, then the exam hall. | Dr. Khadija | KT, WT, Faculty Garden, NELT | D | quiz | 42 |
| m48 | Flying lesson two | Captain Uche wants your turns tidier. You want a photograph of the mall roof. Both can happen. | Captain Uche | Airfield, over the Mall | M | flight | 44 |
| m49 | Chief Megawatt | The mall's owner would like to sponsor your department, and to know why you fly over his roof. | Chief Megawatt | Mall office, Senate | M | choice | 45 |
| m50 | Bolaji's board | Skate contest in the mall car park. Bolaji needs a spotter, a cameraman and somebody to believe it. | Bolaji | Mall car park | F | rhythm | 46 |
| m51 | Change-Over | The driver runs. Through the market, on an okada. Then, at his own door, he explains. | Sgt. Bilkisu | Mall road, Stalls, Staff Quarters | M | chase | 47 |
| m52 | Phase 2 goes dark | A week without light on the far side. Water, torches and charged phones, in convoy, at night. | Iya Risi | P2 Park, Dangote, Dan Fodio | W | convoy | 48 |
| m53 | The second coil | The second plaque: under the mall. It needs three parts, and the best one is an MIB Store exclusive. | The Maker | Engineering Garden, Mall, MIB Store | M | collect | 49 |
| m54 | Love in the time of NEPA | A plan for the evening, then no light and no money. Candles, a bench, garri, and the best talk of the year. | @crush or @best | Love Garden or hostel roof | R | social | 50 |
| m55 | Unplug Iron Mama | A night shift with Sgt. Bilkisu earns the key. Then down the stairs to a generator that has grown teeth. | The Maker | Campus patrol, Mall basement | M | boss | 52 |
| m56 | Light for everybody | Three switches, three corners, ninety seconds apart. Then a panel in the Senate asks what you saw. | Engr. Aliyu or Sgt. Bilkisu | Gate, Fire Station, Engineering, Senate | M | race | 54 |
| m57 | Sign-out, small | Exams end in steady light. The final-years sign shirts. Choose your holiday job. | Kelechi | NELT, Selfie Garden, Gate | F | social | 55 |

## 5. Act 3 — Drift (300 level)

**Theme.** A strike empties the school. Without bells, tests or friends, what do you do with a day?

**Mystery.** Idlers settle in the empty halls. Beyond the fence, past the patrol, the forest hides Old
Campus, the third coil, and the tapes of the woman who built the ring.

**Department.** Group project: solar lamps for the long road to Phase 2. **Friendship.** The crew
scatters and returns; your roommate gets stuck; Bolaji nearly leaves. **Romance.** Distance, then a
crisis. **World.** The forest and patrol; Demonstration school; the Sick Bay; both fellowships.

Merged from the first draft: congress and goodbyes are one mission; hustles sit inside m60; Kaka is
met in m62; the tapes are found in m66; the moonlight match and the open mic are the weapons of m69;
the derby, the medicine flight and the road trip became side or friends missions; demo day and exams
close m78.

| id | Title | One-line premise | Giver | Places | Thread | Shape | Gate |
|---|---|---|---|---|---|---|---|
| m58 | Three hundred | Third year. A project group of four: two serious, one asleep in Pepsi Garden, one missing since Tuesday. | Dr. Khadija | Department, Pepsi Garden, Court | D | escort | 56 |
| m59 | Indefinite | A notice on the Senate door, a congress, and by evening a shuttle park full of bags. Six goodbyes. | Yakubu | Senate, Theatre CD, P2 Park | F | choice | 57 |
| m60 | Those who stayed | Count who is left. No allowance is coming. Build a day, and a hustle, out of that. | Mai Shayi Audu | Tea stall, Gate, Mall | W | routine | 58 |
| m61 | Small Sadiq | A boy at Demonstration school wants to be an engineer "like you". This time you ask the questions. | Aminu | Demonstration School | F | quiz | 59 |
| m62 | Past the last streetlight | With nothing to do you walk past the fence. Trees, a torch in your face, and an old woman selling groundnuts. | — | Fence, Forest edge | W | stealth | 60 |
| m63 | Empty halls | Something is sitting in Kainji Theatre. Row after row of it. Anyone who goes in sits down too. | The Maker | KT, WT | M | defend | 62 |
| m64 | The sit-down | Your roommate has not left the room in four days. Not ill. Just sitting. Cook, play music, open the window. | Nurse Hauwa | Hostel, Buka | F | care | 63 |
| m65 | Patrol games | Kaka said follow the white stones. The patrol walks a pattern. Torch off, stay low. | Kaka | Forest | W | stealth | 64 |
| m66 | Old Campus | Walls with trees through them, a third coil gone cold, and five reels of tape in five ruined rooms. | — | Old Campus, Mall: Sound Garden | M | investigation | 66 |
| m67 | The Maker's secret | You play him the last tape. He hears his own name, and for once he sits down. | The Maker | Engineering Garden | M | social | 67 |
| m68 | Night nurse | The Sick Bay generator is on its last cup. Fetch fuel like eggs, then stay the night: one nurse, six patients. | Nurse Hauwa | Stalls, Sick Bay | W | care | 68 |
| m69 | The Idle King | NELT is full of it. You cannot hit silence. Bring a football crowd, an open mic, three radios and a bell. | The Maker | Pitch, Social Centre, NELT | M | boss | 70 |
| m70 | Called off | The strike is over. The buses come back all at once, and Kabiru hides a treasure hunt to welcome them. | DJ Kabiru | P2 Park, whole campus | F | collect | 71 |
| m71 | Bolaji's choice | The mall wants Bolaji skating in its adverts full-time. She has a withdrawal form half filled in. | Bolaji | Court, Mall | F | choice | 72 |
| m72 | Workshop nights | Solar lamps for the Phase 2 road: a budget, a scrap hunt, and Mr. Ezekiel's rules. | Mr. Ezekiel | Department, Mall, Stalls, lab | D | build | 73 |
| m73 | Test run | The first lamp goes up at dusk on the darkest bend. By morning two are dead, cables cut clean. | Fatima | Phase 2 road, Stalls | D | defend | 74 |
| m74 | Ranger Lawal's debt | A patrol has not come back. He has turned you round three times. Tonight he asks you to walk in front. | Ranger Lawal | Forest hills | W | escort | 75 |
| m75 | The third coil wakes | Old Campus has no power. Your lamps do. Carry a panel through the forest and hold the clearing. | The Maker | Old Campus | M | defend | 76 |
| m76 | Heartbreak, or not | After months apart, somebody is not where they used to be. Listen first. Then say the true thing. | @crush or @best | Love Garden or Dam pier | R | choice | 77 |
| m77 | Wedding at the quarters | Malam Garba's daughter is marrying. An outfit, a gift, a place in the dance line, and Hajiya's daughter Aisha to register first. | Malam Garba | Mall, MIB Store, Staff Quarters | W | rhythm | 78 |
| m78 | Lights on the long road | Demo day, exams in a hurry, and then the last lamp: at dusk the whole road lights, pole by pole. | Fatima | Quad, NELT, Phase 2 road | D | convoy | 80 |

## 6. Act 4 — Image (400 level)

**Theme.** Industrial training, a first salary, and a camera on you that you did not ask for.

**Mystery.** Echoes: shades that wear a face. Two coils, one in the old control tower at the airfield
and one in the Dam spillway.

**Department.** SIWES: placement, logbook, the supervisor's visit, defence. **Friendship.** Fame pulls
you from your roommate; Lucky arrives, breaks things, and has to earn his way back. **Romance.**
Jealousy, attention, the double-booking reckoning. **World.** The fashion show; Mama Nkechi against the
food court; the union election.

Merged from the first draft: letter and placement are one mission; the brand deal sits inside m81;
the alibi hunt is the second half of m83; the supervisor's visit follows the accident in m84; Lucky's
truth follows the real clip in m91; the campaign, debate and vote are one election mission; the two
Dam missions are one; the defence closes m97; Kelechi's unveiling opens m99.

| id | Title | One-line premise | Giver | Places | Thread | Shape | Gate |
|---|---|---|---|---|---|---|---|
| m79 | IT letter | One letter, four stamps, three offices, a bank queue, and then a choice of where you train. | Mrs. Adebayo | Senate, department, Bank | D | choice | 81 |
| m80 | First day at work | Your supervisor hands you a broom, then a clipboard, then by evening a spanner. Fill the logbook. | Placement boss | Placement site | D | routine | 82 |
| m81 | Lucky goes viral | Somebody filmed your dance at The Floor. By lunch the school has seen it and a brand wants your feet. | Lily and Lyzzy | Mall, quad | F | choice | 83 |
| m82 | The collab | Lucky wants three stunts for one video. Then forty people want a picture and you only came for socks. | Lucky | Boulevard, Senate steps, Mall | F | prank | 84 |
| m83 | Echo | Mai Shayi says you were rude to him last night. You were asleep. Sgt. Bilkisu has three complaints with your face on them. | Mai Shayi Audu | Tea stall, Security post, Library, Buka | M | investigation | 85 |
| m84 | Workplace accident | A colleague is down. Stop the bleeding, drive gently, and be at your post when Dr. Okonkwo walks in. | Placement boss | Placement site, Sick Bay | D | care | 86 |
| m85 | Payday | Your first allowance. Home needs some. A friend needs some. You have wanted that jacket since Year 2. | Mum (phone) | Bank, Mall, MIB Store | F | choice | 87 |
| m86 | Old friends, new friends | Your roommate's birthday and Lucky's rooftop party are the same night. You can make both if nothing goes wrong. | @roomie, Lucky | Buka, Mall roof | F | race | 88 |
| m87 | Night flight | The old control tower has been locked since before Captain Uche. Its coil needs a beacon lined up from the air, in the dark. | Captain Uche | Airfield tower, night sky | M | flight | 90 |
| m88 | Fashion show | Alhaji Needle's collection on a runway through the mall, with an MIB capsule nobody was meant to see. | Alhaji Needle | Mall atrium | W | rhythm | 91 |
| m89 | Cancelled | A clip of "you" shoving a fresher. It is an Echo. Lucky posted it first and asked questions never. | Lily and Lyzzy | Quad, Hostel | F | social | 92 |
| m90 | Touch grass | Baba Dam does not own a phone. He owns a boat and a great deal of patience. Go fishing. Say nothing. | Baba Dam | Dam | W | routine | 93 |
| m91 | The real clip | Somebody's phone caught the real thing and fell in the fountain. Then you find Lucky on the roof with his own Echo. | Chi-Tech | Fountain, Mall, Hostel roof | M | collect | 94 |
| m92 | Double booking | Two people were promised the same evening. If it was you, face it. If it was your friend, help them face it. | @crush or @roomie | Shinkafi, Love Garden | R | social | 95 |
| m93 | Cook-off | The food court is half the price and the buka is half empty. Three dishes, the whole school voting with its mouth. | Mama Nkechi | Buka, Social Centre | W | rhythm | 96 |
| m94 | Election day | Posters, a debate card that says "second speaker", and a ballot box under the returning officer's chair. | Yakubu | Campus, Theatre CD | W | choice | 97 |
| m95 | The eel's bargain | The fifth coil is in the spillway. Baba Dam rows. The eel is not a monster tonight; it is guarding something warm. | Baba Dam | Dam, spillway | M | rhythm | 99 |
| m96 | The Mirror | A copy of you as tall as the FSLG letters. Hit it and it hits back. So do the one thing it cannot. | The Maker | Selfie Garden | M | boss | 101 |
| m97 | Log off | What do you do with being known? Then a logbook on a table and a panel in a row. | Joy | Radio studio, Department | F | choice | 102 |
| m98 | Sadiq's surprise | You owe your roommate an apology. Before you can give it, the whole room shouts "surprise". | @roomie | Hostel, Buka | F | social | 103 |
| m99 | One left | Kelechi signs his last statue and leaves. The Garden coil flickers. The Maker is sitting down again. | Aunty Asiya | Sculpture Garden, Engineering Garden | M | escort | 105 |

## 7. Act 5 — Leaving (500 level)

**Theme.** Final year. Finish the project, clear every office, say goodbye, and go.

**Mystery.** The sixth coil belongs under the Senate tower and has never been built. Building it is
your final-year project. Entropy returns in a gown with a letter that says stay.

**Department.** Topic, supervisor, three build weeks, failure, defence. **Friendship.** Everyone
contributes a part; everyone says goodbye in their own way. **Romance.** The dinner, the gown photos,
an honest talk about after. **World.** The whole school turns out for the longest night.

Merged from the first draft: topic and notebook are one mission; the literature search is inside m103;
fundraising and Megawatt's offer are one; the three build weeks are one long mission; Kaka's story
follows the failure; clearance follows the cancelled-convocation letter; the last test, defence and
exams are one; the six coils are relit in two missions of three; results and gown, parents and
ceremony, sign-out and hand-over, the last ride and the epilogue are paired.

| id | Title | One-line premise | Giver | Places | Thread | Shape | Gate |
|---|---|---|---|---|---|---|---|
| m100 | Finalist | Mission one hundred. Freshers call you "senior", and Kabiru hides a hundred clues to prove you know the place. | DJ Kabiru | Gate, whole campus | F | collect | 106 |
| m101 | The Maker's notebook | Choose a supervisor. Then he gives you the book he has never shown anyone, half of it in shorthand. | The Maker | Department, Engineering Garden | D | quiz | 107 |
| m102 | Fresher tax, reversed | A new boy at the court is taxing freshers. Big Sly would like a word with him. He would like you there. | Big Sly | Court | F | choice | 108 |
| m103 | Sixth site | The plaque says "at the centre". One reference in a room the library denies having, and four corners to measure from. | Mrs. Shehu | Library, Gate, Dam, Airfield, Phase 2 | M | collect | 109 |
| m104 | Megawatt's offer | The coil costs more than a keke. Raise it honestly, or let him pay and put his name on the tower. | Ada | Mall, Social Centre, MIB Store | D | choice | 110 |
| m105 | Parts from everywhere | Six people each have one thing the coil needs. Each asks one small thing in return. | The Maker | All over | F | collect | 111 |
| m106 | Build week | Frame, two thousand turns of copper, first power-on. A hum, a glow, a smell, and then the fire alarm. | Mr. Ezekiel | Workshop, Fire Station | D | build | 113 |
| m107 | Failure | Your supervisor says start again. It is raining. Walk. At the forest edge Kaka tells it from the beginning. | — | Workshop to the forest edge | D | routine | 114 |
| m108 | Everybody, again | Ten departments, one section of coil each. Go round the quad and ask. | @hod | Engineering quad | D | social | 115 |
| m109 | The Chancellor's shadow | A letter on every board: "Convocation is cancelled." No signature. And you still need six clearance stamps. | Malam Garba | Senate, six offices | M | investigation | 117 |
| m110 | Dinner night | Final-year dinner. Who you walk in with, where you sit, and what award the class votes you. | Yakubu | Mall, MIB Store, Social Centre | R | social | 118 |
| m111 | Project defence | The last test, a rebuilt coil under a cloth, a panel that has failed better students, and the last paper. | Supervisor | KT, Department, NELT | D | quiz | 120 |
| m112 | The longest night | Every light goes at once and does not come back. Hold your hostel, then walk three hundred students out between lanterns. | Sgt. Bilkisu | Hostel to Engineering quad | M | defend | 122 |
| m113 | Three by road | The Garden, the Mall and Old Campus, relit in one run, with the patrol's light ahead of you. | Ranger Lawal | Engineering Garden, Mall basement, Forest | M | race | 124 |
| m114 | Three by air and water | One pass over the tower beacon, the eel lighting the spillway, and the school's coil carried up the Senate stairs. | Captain Uche | Airfield, Dam, Senate tower | M | flight | 126 |
| m115 | Chancellor Null | On the roof: a blank figure in a gown. It does not attack. It erases. Then it offers you a letter. | — | Senate roof | M | boss | 128 |
| m116 | The Maker's graduation | The ring closes. He takes off the lab coat and walks out of the garden, and the school dances till the birds start. | The Maker | Engineering Garden, Boulevard, Selfie Garden | M | escort | 129 |
| m117 | Gown | A name on a board, a gown from the mall, and five photographs with whoever mattered most. | Alhaji Needle | Department, Mall, five spots | R | collect | 130 |
| m118 | Convocation | The voices on the phone arrive in person. Then the forecourt, your name, and a man with coily hair in a gown that fits. | Malam Garba | Gate, Hostel, Senate forecourt | F | social | 130 |
| m119 | Sign-out | A white shirt and a box of markers. Then your bed space, your bicycle and your notes need an heir. | @best | Selfie Garden, Hostel | F | choice | 130 |
| m120 | Fresher | One last ride round all of it. Then, some years later, a new student at the gate asks the way to the Senate. | Muhammad, a fresher | Whole map, Main Gate | F | escort | 130 |

## 8. Side missions s1–s50

Optional, available from the act shown, 5–12 minutes each. Each belongs to one person and makes them
more themselves. Five per friend form their friendship scenes; the rest are world stories.

| id | Title | Premise | Giver | Act | Shape | Moves |
|---|---|---|---|---|---|---|
| s1 | Sadiq's pot | His mother's soup recipe needs six things from the market and a pot nobody will admit to borrowing. | Sadiq | 1 | collect | Friendship |
| s2 | Sadiq sends money | He asks you to queue at the bank with him and not ask why. | Sadiq | 2 | social | Friendship; his secret |
| s3 | Firdausi's radio | Her radio only gets one station and it is the wrong one. Fix it without Mr. Ezekiel finding out whose tools. | Firdausi | 1 | build | Friendship |
| s4 | Ada's timetable | She has colour-coded your week. Follow it for one day. It is exhausting and it works. | Ada | 1 | routine | Books; friendship |
| s5 | Ada's fees | A deadline, a queue, and a quiet favour from Dr. Khadija that Ada must never hear about. | Ada | 2 | delivery | Her secret |
| s6 | Yakubu's attendance sheet | The sheet is missing and the lecturer wants it by four. Forty signatures, forty places. | Yakubu | 1 | collect | Department |
| s7 | Yakubu's poem | He left his file in Theatre CD with a poem in it. The Drama Club has found it. | Yakubu | 3 | stealth | His secret |
| s8 | Fatima's shelf | She shows you the hidden room. You may borrow one book. Choose carefully; she is watching. | Fatima | 2 | social | Her secret |
| s9 | Fatima speaks | She has to give a five-minute talk. Be her audience six times in six places. | Fatima | 3 | escort | Books; friendship |
| s10 | Bolaji's trick | She wants the stair set outside the Senate. Keep Malam Garba talking. | Bolaji | 1 | prank | Street |
| s11 | Bolaji's scripts | You find her exam scripts in her skate bag. All As. She would like you to forget this. | Bolaji | 3 | social | Her secret |
| s12 | Kelechi's clay | The good clay is at the Dam's edge. The Dam's edge is also where the goats are. | Kelechi | 1 | collect | Friendship |
| s13 | The eighth statue | Someone has painted a moustache on the unsigned statue. Kelechi is far too upset for a stranger's work. | Kelechi | 2 | investigation | His secret |
| s14 | Emeka's keke | He has saved for two years. Go with him to buy it and stop him paying the first price. | Emeka | 2 | social | Street |
| s15 | Emeka's matric number | He kept his old ID card. Walk with him to the registry to ask a question he has been afraid to ask. | Emeka | 4 | escort | His secret |
| s16 | Sly's clippers | His first customer is Malam Garba. His hands are shaking. Stand where he can see you. | Big Sly | 2 | social | Community |
| s17 | Joy's night show | The anonymous host has lost her voice. Read the dedications. Do not do an accent. | Joy | 2 | rhythm | Her secret |
| s18 | AB's checklist | He wants to rehearse his flight test on the ground, on bicycles, with arm signals. | AB | 2 | routine | Friendship |
| s19 | AB and the water | He will not get in Baba Dam's boat. Sit on the pier with him until he does, or does not. | AB | 4 | social | His secret |
| s20 | Basit's sister | He works two jobs. Cover one shift at the Game Room so he can make her visiting day. | Basit | 2 | routine | His secret |
| s21 | Basit loses | He has lost to a child. Console him. Do not laugh. Laugh a little. | Basit | 3 | social | Friendship |
| s22 | Maryam's noticeboard | Someone keeps pasting stories on the boards. She asks you to help catch the author. She is very calm about it. | Maryam | 2 | investigation | Her secret |
| s23 | Maryam's reading | Her first public reading, at Page Turner. Fill twelve chairs. | Maryam | 4 | collect | Vibes |
| s24 | Micheal's audition | The Drama Club needs a second actor for one scene. You have six lines and a fake beard. | Micheal | 2 | rhythm | Vibes; introduces Micheal |
| s25 | Lucky's first video | Before the followers: he films a "day in the life" and nothing happens in it. Help something happen. | Lucky | 4 | prank | Friendship |
| s26 | Mama Nkechi's recipe book | The book is falling apart. Chi-Tech can scan it. She will not let it out of the buka. | Mama Nkechi | 3 | escort | Her secret |
| s27 | Mai Shayi's kettle | The kettle is older than you. It has a hole. Bright Electricals cannot help. Baba Dam can. | Mai Shayi Audu | 2 | delivery | Community |
| s28 | Hajiya's ledger | Three students owe nothing because somebody always pays. Deliver three receipts and say nothing. | Hajiya Ladi | 3 | delivery | Her secret; Community |
| s29 | Baba Dam's net | Mend a net with him. He tells one riddle per knot. | Baba Dam | 1 | routine | Friendship |
| s30 | Nurse Hauwa's list | She keeps a list of students who came in three times. Check on four of them, as if by accident. | Nurse Hauwa | 3 | social | Community |
| s31 | Captain Uche's letter | An airline has written to her again. She asks you to post her reply. It is very short. | Captain Uche | 4 | delivery | Her secret |
| s32 | Coach Danladi's speech | Prize-giving. He must give a speech without shouting or crying. Rehearse him. | Coach Danladi | 3 | social | His secret |
| s33 | Kabiru off air | The studio mic is dead and he has to MC a wedding in person. He is terrified. | DJ Kabiru | 3 | escort | His secret |
| s34 | Madam Whistle's sprint | A bag-snatching goat. Sgt. Bilkisu outruns it, you, and a motorbike. | Sgt. Bilkisu | 2 | race | Her secret |
| s35 | Oga Pee's shortcuts | He shows you five shortcuts in exchange for five sticks of suya. | Corporal Peter | 2 | collect | Street; map shortcuts |
| s36 | Ranger Lawal's grandmother | Carry a parcel from the mall to the forest edge. He is too proud to say who it is for. | Ranger Lawal | 3 | delivery | His secret |
| s37 | Mr. Ezekiel's shelf | Every "condemned" instrument in the lab works. Help him carry one home to fix and one back. | Mr. Ezekiel | 3 | escort | His secret |
| s38 | Prof. Bello's desk | He has lost a letter. It is in his desk. Everything is in his desk. | Prof. Bello | 3 | collect | His secret |
| s39 | Dr. Okonkwo's class photo | An old photograph: a class in front of the coil. One face is very familiar. | Dr. Okonkwo | 4 | investigation | Her secret; the Maker |
| s40 | Aunty Asiya's supper | Take the Maker's food tonight; she has stocktake. He asks what the mall is like. | Aunty Asiya | 2 | delivery | The Maker |
| s41 | Needle's Thursday | It is ready. It is the wrong colour. It is perfect. | Alhaji Needle | 2 | social | Outfit |
| s42 | Chi-Tech's photos | A cracked phone with a stranger's family pictures. Find the owner from three clues in the gallery. | Chi-Tech | 3 | investigation | Community |
| s43 | Sugar's accounts | DJ Sugar has an accounting test tomorrow and a full floor tonight. Run the decks for one set. | DJ Sugar | 3 | rhythm | Her secret |
| s44 | Baba Shuttle's last trip | His bus is being retired. Ride the full route with him and name the regulars. | Mr. Linus | 4 | routine | Community |
| s45 | Iya Risi's plate | She leaves a covered plate every night. Find out who it is for. It is for whoever comes. Tonight it is you. | Iya Risi | 2 | social | Community |
| s46 | Clean-up Saturday | Both fellowships clean the Dam shore together. Fill ten sacks. Pastor Sam and Ustaz Auwal keep score. | Pastor Sam, Ustaz Auwal | 2 | collect | Community |
| s47 | The visit | Fellowship members visit the Sick Bay. Carry fruit, read a letter aloud, fix a fan. | @faithplace | 3 | care | Community |
| s48 | Sadiya's carry-over | She failed a course and thinks nobody knows. Tutor her at night, away from the posters. | Comrade Sadiya | 4 | quiz | Her secret |
| s49 | Jega's socks | The lucky socks are missing an hour before the final. They are on the hostel line. Which hostel? | Jega | 2 | chase | Friendship |
| s50 | Aminu's first day | Year 5. He has admission. Walk him to the Senate. Let him think he is leading. | Aminu | 5 | escort | Echo of m1 |

## 9. Ambient encounter templates e1–e30

Each row is a template. **Who** and **Where** are drawn at random from the lists; the **Twist** appears
about one time in five. All obey the rules in the bible, section 12.

| id | Template | Who (examples) | Where | Ask | Twist (1 in 5) | Help → | Decline → |
|---|---|---|---|---|---|---|---|
| e1 | Buy me something | Student in a queue; trader who cannot leave a stall | Near any shop | "Abeg, help me buy bread. Keep the change." | The change is ₦5 | +Community; small tip | They ask the next person |
| e2 | Late for a test | Student running with a file | Hostels, gate | "Drop me at NELT! Two minutes!" | It is the wrong hall | +Street; gratitude later | Seen running, then walking back |
| e3 | Phase 2 lift | Student with a bag at dusk | Gate, Senate stop | "Shuttle has closed. You dey go Phase 2?" | They pay with groundnuts | +Community | Waits; a keke stops |
| e4 | Lost fresher | New student with a map upside down | Boulevard, quad | "Please, where is the Senate?" | They are a visiting lecturer | +Community; +XP | Asks another; ends at the Dam |
| e5 | Walk me there | Blind student with a cane and strong opinions | Quad, library | "Lend me your elbow to Kainji. I'll do the talking." | He knows a shortcut you do not | +Community; a new shortcut | Finds another elbow at once |
| e6 | The dark stretch | Two students at the unlit bend | Phase 2 road (before m78) | "Can we walk with you past here?" | A shade does appear | +Community | They wait for a group |
| e7 | Fell off a bike | Rider on the ground, bike wheel spinning | Any road | "I'm fine. I'm fine. I'm not fine." | The bike is yours to return | +Community; Sick Bay run | Another walker stops |
| e8 | Fainted in the sun | Student on the kerb, friend fanning | Boulevard, court | "She hasn't eaten. Help me carry her." | She wakes and is embarrassed | +Community; Nurse Hauwa's thanks | A trader brings water |
| e9 | Twisted ankle | Footballer at the pitch | Pitch, court | "Sick Bay. Slowly. Slowly!" | He scores the winner next week and waves | +Community | Team-mates carry him |
| e10 | Teach me this | Course mate with a question | Library, gardens | One question from your courses | It is a question you got wrong last test | +Books | They ask Fatima |
| e11 | Teach me to ride | Fresher beside a bicycle | Hostel yard | "Hold the seat. Don't let go. You let go!" | They ride off with your bicycle, and come back | +Community; laugh | They wobble on alone |
| e12 | Teach me the step | Shy student outside The Floor | Mall, Shinkafi | "Show me that one move. Just that one." | They are better than you | +Vibes | They practise at a window |
| e13 | Lost ID card | Panicking student | Anywhere | "No ID, no exam. It's blue. Everything is blue." | It is in their own pocket | +Community | Found later on a noticeboard |
| e14 | Lost flash drive | Final-year with a project due | Labs, cafés | "My whole project. Black. This small." | Chi-Tech has it | +Department | They redo a chapter overnight |
| e15 | Runaway goat | Staff child chasing it | Staff quarters, gardens | "Catch it! Its name is Professor!" | It leads you to a kola nut | +Community; comedy | The goat eats a poster |
| e16 | Carry a note | Blushing student | Gardens, library | "Give her this. Don't read it." | The note is for you | Friendship with both | They deliver it themselves, badly |
| e17 | Does she like me? | Nervous course mate | Class doors | "Just ask her friend. Casually." | The friend likes them instead | +Vibes | They never find out |
| e18 | Sit with me while I ask | Friend rehearsing | Love Garden gate | "Just stand there. Not so close." | They say yes before he finishes | +Vibes; friendship | He goes alone; fifty-fifty |
| e19 | One bucket | Two students, one tap | Hostel yard | "I was first." "I was first." | The bucket belongs to neither | +Community (settle) | A third person takes the bucket |
| e20 | Queue-jumper | A line and one bold person | Bank, buka, bursary | "Are you seeing this?" | The jumper is an elder; everyone lets it go | +Community | Grumbling |
| e21 | ₦200 debt | Two friends not speaking | Hostel, court | "Tell him I said…" | It was ₦20 | +Community | They sulk till tomorrow |
| e22 | Whose socket? | Four phones, one socket | Lecture halls | "Mine was on 2%!" | The light goes; argument over | +Community | Rota written on the wall |
| e23 | Charge my phone | Student with a dead phone | Anywhere in a blackout | "One call. To my mum. Please." | The call is very long | +Community | Borrows another |
| e24 | Watch my bag | Student dashing to the toilet | Library, park | "Two minutes!" (it is five) | Someone tries to move it "to help" | +Community | They carry it along |
| e25 | Wait with me | Lone student at a stop at night | Shuttle stops | "Can you wait till it comes?" | You miss your own plan; they notice | +Community; friendship | Driver arrives quickly |
| e26 | Come and cheer | Friend with a match or a show | Pitch, Social Centre | "We need noise. Bring noise." | You are pulled in to play | +Vibes | They lose; nobody blames you |
| e27 | Push my car | Lecturer with a flat battery | Car parks | "Young man or woman, a small push." | It is your own lecturer; test tomorrow | +Department | Three others push |
| e28 | Deliver to my child | Parent at the gate with a cooler | Main Gate | "Give this to Chidinma, Queen Amina, room 14." | The cooler is for the whole room | +Community; a share of the food | The porter takes it |
| e29 | Take our picture | Group in matching outfits | Selfie Garden | "Snap us! Wait, wait, one more." | They pull you into the photo | +Vibes | A stranger takes it, cutting off heads |
| e30 | I am just tired | Student sitting alone, not on a phone | Any bench, late | "I'm okay. …Can you sit small?" | Nothing; you just sit | +Community; they remember you | Nurse Hauwa's list gains a name |

e30 is the important one. It has no objective, no reward on screen, and it is the encounter the Sick
Bay missions and the Idler year are about. Write it with care; never play it for laughs.

## 10. Pacing chart

Intensity 1 (quiet) to 5 (finale). Each act rises in two waves, with a breather after every peak and a
light mission at every number ending in 0.

```
Act 1  m1 ──────────────── m17 ──────────────── m36
       1 2 2 3 3 3 4 3 4 3 2 3 3 4 3 3 5 | 2 2 2 3 3 3 4 3 3 4 2 3 3 4 3 3 4 4 5

Act 2  m37 ──────────────────────────────────── m57
       1 2 1 1 3 3 3 4 3 3 3 | 3 3 2 4 4 3 2 5 4 1

Act 3  m58 ──────────────────────────────────── m78
       2 3 1 1 3 4 3 3 4 3 3 5 1 | 3 2 4 4 4 3 2 4

Act 4  m79 ──────────────────────────────────── m99
       1 1 3 3 4 4 2 3 4 2 | 3 1 3 3 3 2 4 5 3 2 3

Act 5  m100 ─────────────────────────────────── m120
       1 2 3 2 3 2 4 1 3 4 2 4 | 5 5 5 5 4 2 3 2 1
```

Rules the chart follows:

- No three missions in a row at 4 or above, except the Act 5 finale (m112–m116), which is one long night
  and should be playable in a single sitting of about an hour, with a save after each mission.
- After every 5 comes a 1 or 2 within two missions.
- Sadness beats (m59, m67, m76, m89, m99, m107, m116) are each followed by warmth within two missions.
- Missions ending in 0 are days off: m40 arcade, m50 skate contest, m60 a slow day, m70 the return,
  m80 first day at work, m90 fishing, m100 the hundred hunt, m110 dinner, m120 the last ride.

## 11. Where things are introduced

Since the first draft, these have been built and are no longer "new": the mall and its shops, the
MIB Store, wardrobe and fictional brands, five arcade mini-games, the dance-floor rhythm game, the
endless wilderness with a patrol that brings you back, walk-in interiors, night rules (lecture halls
locked except evening tutorials; shops open), job vehicles with an "on a job" banner, the one-activity
focus system, day and night crowd behaviour, and a zoomable map with waypoints. Rows below that name
them are kept for the mission where the story first uses each one.

### Already in the game

| Thing | First used |
|---|---|
| Walking, talking, eating, sleeping, classes | m1–m2 |
| Bicycle | m3 |
| Fighting shades; torch | m4 |
| Okada, scooter, races | m8–m12 |
| Keke | m13 |
| Bosses | m7, m14, m17 |
| Plane | m18 |
| Jobs | m11, m21 |
| Dates and emotes | m19–m20, m28 |
| Friends who walk with you; shuttle; walk-in rooms; lectures on the board; security heat | Year 1, free roam |

### New systems this outline needs

| System | First mission | What it is | Size |
|---|---|---|---|
| Mall, 15 stores, food court | m38 | A large building outside the gate with walk-in shops | Large |
| Wardrobe and outfits | m39 | Buy, own and change clothes; people react | Medium |
| Arcade mini-games (bat-and-ball, falling blocks, runner, plane shooter) | m40, m53 | Four small playable games inside the Game Room | Medium |
| Dance / rhythm mini-game | m40 | Timed button presses to a beat; reused for cooking, winding, the eel, runway | Medium (reused 9 times) |
| Tail step | m42 | Follow at a distance, unseen | Small |
| Football mini-game | m43 | Five-a-side, simple | Medium |
| Stealth step | m44 | Sight cones; hide; reused for rangers, crowds | Medium |
| Standing tracks | m47–m43 | Five meters fed by missions | Small |
| Relationship stages and scenes | m43, m54 | Friendship steps, romance stages, break-ups | Medium |
| Choice step with flags | m49 | Two or three options; flags read later | Small |
| Chase step | m51 | Pursue through crowds | Small |
| Convoy step | m52 | Lead or follow a group of vehicles | Small |
| Dispute-settling step | m55 | Hear two sides; pick a fair split | Small |
| Teach mode | m61 | You pick the question; the pupil answers | Small |
| Forest, rangers, Old Campus | m62–m66 | Endless generated bush; patrols; one fixed ruin | Large |
| Care step and Sick Bay interior | m64, m68 | Fetch, fan, talk; a walk-in clinic | Small |
| Careful-cargo step | m68 | Drive without bumps | Small |
| Build mini-game | m72 | Place parts in order; solder timing | Medium |
| Air drop and aerial photo | m48, m74 | Fly over a point and trigger | Small |
| Fame meter | m81 | Rises with filmed acts; crowds react | Small |
| First-aid sequence | m84 | Three timed steps, then careful driving | Small |
| Cooking mini-game | m93 | Rhythm variant | Small (reuse) |
| Debate step | m94 | Pick arguments against a clock | Small |
| Fishing mini-game | m90 | Wait, tug, reel | Small |
| Crowd escort | m112 | Lead many walkers | Small |
| Family on screen | m118 | Three new character models | Small |
| Generated sign-out shirt | m119 | Text chosen from five years of flags | Small |
| New game plus | m119 | Start again with wardrobe and one heirloom | Small |

### Vehicles, areas, interiors and mini-games by act

| Act | Vehicles featured | Areas opened | Interiors featured | Mini-games added |
|---|---|---|---|---|
| 1 | All existing | Main campus, Dam, airfield | Lecture halls, hostel room, library | Quizzes, races |
| 2 | Keke taxi; okada chase; shuttle | Mall; mall basement; Phase 2 in depth | 15 shops, Game Room, The Floor, Senate staff room | Bat-and-ball, shooter, dance, football, skating |
| 3 | Bicycle in the forest; plane cross-country; careful driving | Forest, ranger posts, Old Campus, Demonstration School | Sick Bay, department lab, workshop | Build, teaching, perform |
| 4 | Night flying; boat with Baba Dam; delivery rounds | Airfield tower, Dam spillway, placement sites | Tower, spillway, placement workplace | Runway, cooking, fishing, debate |
| 5 | Everything, in the six-coil relay | Senate tower interior and roof | Big workshop, Senate tower | Winding (rhythm), crowd escort |

## 12. Replay hooks

- **Twelve departments.** Department-thread missions change places, HOD lines and project details.
- **Five placements** in Year 4 change six missions.
- **Three supervisors** in Year 5 change lines and m111's panel.
- **Ten romance routes and a full single route**, each with four stage scenes and a "broke" scene.
- **Best friend** changes extra lines in five finales and the first line on your shirt.
- **Standings** decide your class of degree, your dinner award and one line from every major character.
- **Big choices that echo:** m49 (sponsorship), m51 (Aliyu), m59 (speak or listen), m71 (Bolaji), m81
  (brand deal), m85 (payday), m97 (fame), m102 (talk or spar), m104 (Megawatt's money), m119 (your heir).
- **New game plus:** start again as the fresher you handed your room to, keeping the wardrobe and one
  heirloom (the bicycle, the notes or the Maker's soldering iron), with seniors who remember "the one
  who lit the road".
- **Collectibles with stories:** kola nuts (existing), the professor's tapes, noticeboard stories by an
  anonymous author, Kelechi's marks on statues, shuttle regulars' names.
- **The sign-out shirt** is different every play-through and can be saved as a picture.
