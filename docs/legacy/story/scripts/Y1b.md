# Year 1, second semester — Arriving (100 level): scripts m19–m36

Revision 4 (rebrand). Missions m1–m18 are in `Y1.md`. Format and rules: `../02_BIBLE.md` §14–19;
cast: `../CHARACTERS_BACKSTORY.md`; arc: `../STORYLINE.md`. Every spoken line ends with an empty voice
id `[v: ]` and is ≤ 90 characters. Tokens: `@roomie` (Bature or Firdausi by default; see the room
choice), `@hod`, `@hostel`, `@dept`, `@crush`, `@best`. **[switch]** marks a co-op beat where the player
can swap between themselves and the named companion; there is never a timer on a switch. Step types in
square brackets; NEW marks one the game does not have yet.

Year 1 rules kept here: the Maker speaks short and dry (no Rumi, no big words until Year 2); Count
Entropy never speaks; shades never speak; nobody dies; weapons are a stick, a cricket or baseball bat,
a thrown basketball, a slipper, a torch, a book or a bucket; no main mission makes the player hit an
ordinary student. Prosperity is tier 0 all year: unpainted walls, dim lamps, thin crowds.

---

### m19 — Up NEPA party
- Semester 2 · Gate 12 · Shape: rhythm · Giver: DJ Kabiru · Thread: F
- Places: Radio Studio, KB's shop, Shinkafi · Time: evening into night · Weather: clear, warm
- Needs: m18 done; The Floor rhythm game (reused at Shinkafi) · Music: `motif_school` →
  `party_shinkafi` → silence → `party_generator`

**Premise.** The light has stayed on for a whole week. DJ Kabiru says that deserves noise, and he
needs a crowd, a snack table and somebody brave enough to dance first.

**Why now.** After the Count was chased off the Senate steps (m17) and you flew (m18), the school
believes, for one week, that things are fixed. A party is how a campus says thank you.

**Beats**
1. [talk: kabiru] Talk to DJ Kabiru at the Radio Studio.
   - KABIRU: Seven days of light! Seven! My fridge is confused. It thinks it's abroad. [v: ]
   - KABIRU: Party at Shinkafi tonight. Up NEPA. I need snacks and I need a first dancer. [v: ]
   - BATURE: Riddle me this: what has two left feet and volunteers anyway? [v: ]
   - BATURE: Me. I'm the answer. I always am. [v: ]
2. [buy: chocolate ×2, chin-chin ×1] Buy snacks for the party at KB's shop.
   - KB: For your face today? Chocolate is ₦300. For his face, ₦500. [v: ]
   - BATURE: What is wrong with my face? [v: ]
   - KB: Nothing. It is just expensive. [v: ]
3. [go: shinkafi] Carry the snacks to Shinkafi before eight.
   Fairy lights on the umbrellas. Two speakers. A crowd pretending not to want to dance.
   - LULA: Faty, look. A party. With light. [v: ]
   - FATY: Lula, write that down. No, I'll write it. You'll lose it. [v: ]
4. [rhythm: party, 60 s] Dance first. Somebody has to.
   - CROWD: ★ Eh eh eh. [v: ]
   - CROWD: Main character energy! [v: ]
   - KABIRU (mic): Our fresher has opened the floor! The rest of you, shame! [v: ]
5. [turn] Mid-song, the speakers die. Then the fairy lights. Then all of Shinkafi.
   Two hundred students in the dark. Somebody laughs. Somebody shouts "NEPA!"
   - KABIRU: No. No no no. Seven days. We had seven days! [v: ]
   - WALKER: ★ Faaa! [v: ]
6. [switch: Lula] Keep the crowd from leaving while Kabiru finds a generator. Swap to Lula, who can
   make a room laugh; you go and find the generator with Bature.
   - LULA: Everybody! Phone torches up. Now we look like a church. [v: ]
   - LULA: Now everybody wave. Now we look like a confused church. [v: ]
   - CROWD: ★ Ahn ahn! [v: ]
7. [go: behind Shinkafi] Find the old generator behind the stalls. It won't start.
   - ABBAS: Don't touch it. You'll make it worse. Let me see. [v: ]
   - BOLAJI: John Carter is here! The engine is saved! [v: ]
   - ABBAS: My name is Abbas. Hold the torch. Higher. Not in my eye. [v: ]
8. [switch: Abbas] Swap to Abbas and clear the fuel line (hold to blow; release to cough).
   The generator coughs, chokes, and roars. The lights come back one umbrella at a time.
   - ABBAS: There. Dirty fuel. Somebody bought fuel from a man with no shop. [v: ]
   - BOLAJI: John Carter, I take back half of everything I said about you today. [v: ]
   - ABBAS: Only half? [v: ]
   - BOLAJI: The other half is for tomorrow. [v: ]
9. [rhythm: party, 90 s] Dance again. This time everyone joins.
   - KABIRU (mic): Light by generator! Light by John Carter! [v: ]
   - ABBAS: Abbas. [v: ]
   - CROWD: John Carter! John Carter! [v: ]

**More beats**
3a. [talk: aleeya] Aleeya is already at the snack table, arranging it so it looks bigger.
   - ALEEYA: You brought chocolate! Look at you. Put it here, near the light. [v: ]
   - ALEEYA: If nobody dances, we eat the chocolate. Either way, we win. [v: ]
4a. [talk: @crush] Someone you have been noticing is by the speaker. Ask them to dance, or don't.
   - PLAYER: Do you want to dance? [v: ]
   - @CRUSH (yes): Only if you go first. You already did. Okay. [v: ]
   - @CRUSH (not now): Not tonight. Ask me another time, maybe. [v: ]
   (If "not now", asking again this week gets the same answer, kindly. It is never a failure.)
8a. [emote: wave] Wave to Faty, who is writing something down by phone light.
   - FATY: Lula said "now we look like a confused church". Page nine. Dated. [v: ]
   - LULA: She writes everything. One day she'll sell it and leave me. [v: ]
   - FATY: One day I'll read it to you and you'll cry. [v: ]
9a. [quiet] Walk home with the crew. The generator hums behind you.
   - BATURE: Riddle me this: what goes off when you need it most? [v: ]
   - PLAYER: NEPA. [v: ]
   - BATURE: Wrong. Me, in class. NEPA is second. [v: ]

**Choice.** None.

**If it goes wrong.** Miss the rhythm game: the crowd still cheers ("Effort!") and you retry with a
slower song. Snacks not there by eight: Kabiru starts anyway; Aleeya covers the table with her own.

**Rewards.** ₦1,500, 700 XP, Vibes +3, Street +1. Friendship: Kabiru +4, Abbas +5, Lula and Faty +3.
Unlocks m20.
**Sets / pays.** Sets `party_up`, `faty_page_9`, `abbas_generator`, `crush_asked_once` (if asked).
Pays m17 (the light came back), m18 (people saw you fly) and m12 (Lula and Faty). Faty's pages are paid
in m118.
**Around it.**
- RADIO (Kabiru): Seven days of light. If you hear a bang, it's the celebration, not the transformer. [v: ]
- RADIO (Kabiru, later): Shout-out to John Carter. He says his name is Abbas. Noted. Ignored. [v: ]
- WALKER: I danced in the dark. Nobody saw. Best night of my life. [v: ]
- WALKER: Who sold that generator fuel? I want his number. To report him. [v: ]
- PHONE (Mum): I heard music in your voice. Are you studying or partying? [v: ]

---

### m20 — Profile picture
- Semester 2 · Gate 13 · Shape: collect · Giver: Lyzzy · Thread: R
- Places: Selfie Garden, Geography Garden, Love Garden, Sculpture Garden · Time: golden hour
- Needs: m19; photo mode (NEW: free camera, filters, caption, saves to the phone gallery)
- Music: `place_gardens_day`, `motif_lily` (soft), `sting_reveal` at the cape

**Premise.** Lyzzy says your profile picture is "a crime against your face". She will fix it, if you
pose at four gardens before the light goes.

**Why now.** After the party everyone is adding everyone. You are suddenly a person people look up.

**Beats**
1. [talk: lyzzy] Meet Lyzzy at the Selfie Garden. She has a ring light and a plan.
   - LYZZY: Don't move. Your face is a moment. A bad moment, but a moment. [v: ]
   - LYZZY: Four gardens. Four photos. Golden hour waits for nobody. [v: ]
   - LILY: She means well. She means well very loudly. [v: ]
2. [photo: selfie letters] Take a photo under the giant letters.
   - LYZZY: Chin down. No, the other down. Perfect. Don't breathe. [v: ]
   - BATURE (photobombing): Riddle me this: who appears in every photo uninvited? [v: ]
   - LYZZY: Bature. Get out of my composition. [v: ]
3. [photo: stone globe] Take a photo beside the stone globe in the Geography Garden.
   - LILY: Hold the globe like it's heavy. It is. That's not acting. [v: ]
4. [photo: heart hedge] Take a photo at the heart hedge in the Love Garden.
   - LYZZY: Alone at the heart? Brave. Romantic. Slightly sad. Love it. [v: ]
   - LILY: The roses are thirsty. One minute. (She waters them.) [v: ]
5. [go: sculpture] Go to the Sculpture Garden for the last photo.
   Twelve statues, long shadows. A boy on a bench is drawing.
   - TUNDE: Don't stand there. You're in my light. …No, stay. You're in it correctly. [v: ]
6. [turn] Lyzzy checks the photos. In every one, behind you, small and far away, the Senate
   weathervane wears something like a cape.
   - LYZZY: Who edited my photos? I didn't put a cape on the Senate. [v: ]
   - LILY: Nobody edited them. Look. [v: ]
   - BATURE: Riddle me this: what wears a cape and isn't a superhero? …I don't like this one. [v: ]
7. [photo: sculpture garden] Take the last photo anyway, with your back to the Senate.
   - LYZZY: Posted. Twelve likes already. Nine are from my other accounts. [v: ]

**More beats**
1a. [talk: lyzzy] She looks at your current picture and reapplies her lip gloss in shock.
   - LYZZY: Is that… a photo of your ceiling? With your thumb? [v: ]
   - PLAYER: The light was bad. [v: ]
   - LYZZY: The light was bad. The thumb was a choice. [v: ]
3a. [talk: emily] A girl with a sunhat and a basket is lost between the gardens.
   - EMILY: You again! Is this the Love Garden? I'm meant to meet my cousin. Strawberry? [v: ]
   - LYZZY: She has strawberries. Get her in the shot. Fruit is a mood. [v: ]
   - EMILY: My family grows them. Outside campus. Far. One day I'll show you. Really. [v: ]
5a. [look: statues] Tunde names three statues you haven't noticed yet, without looking up.
   - TUNDE: The two dancers. Back to back. On some anniversary, they turn. Nobody's seen it. [v: ]
   - TUNDE: That plinth is empty. The plaque says "for the one who comes next". Not me. Too shy. [v: ]
   - TUNDE: And the serpent. At dawn it points at the Engineering Garden. I've checked. Twice. [v: ]
5b. [emote: sit] Sit on the warm bench you found in m6. It is still warm, though it's evening.
   - BATURE: Why is the stone warm? Riddle me this: no. I don't want to know. [v: ]
6a. [talk: tunde] Tunde hands you a page. It is you, sitting on the bench. You only sat a minute ago.
   He drew it before you came.
   - TUNDE: I drew that this morning. I didn't know it was you. Now I do. Keep it. [v: ]
   - LILY: That's not strange. That's… okay, that's a little strange. [v: ]
7a. [quiet] The light goes gold, then grey. The cape on the weathervane is gone when you look again.
   - LILY: Things that are watched behave. Things that watch… I don't know. [v: ]

**Choice.** None.

**If it goes wrong.** Golden hour ends before four photos: Lyzzy sighs ("Tomorrow. Same time. Better
face.") and the mission resumes the next evening at the garden you missed.

**Rewards.** ₦1,000, 650 XP, Vibes +4. Friendship: Lyzzy +5, Lily +3, Tunde +4, Emily +2. Item:
Tunde's sketch (collectible 1 of 30). Photo mode unlocked. Unlocks m21.
**Sets / pays.** Sets `cape_seen_1`, `tunde_sketch_bench`, `statues_three`, `sat_warm_bench`. Pays m6
(`maker_bench`, `saw_fish_girl`) and m17 (`count_invented_hint`). `tunde_sketch_bench` is paid in m96
(the real you); `cape_seen_1` is paid in m36 (the twist) and every year after.
**Around it.**
- RADIO (Kabiru): New profile pictures everywhere. The Selfie Garden queue is longer than registration. [v: ]
- RADIO (Kabiru): Somebody keeps sending me a cape emoji. Stop it. It's not funny. It's a little funny. [v: ]
- WALKER: Lyzzy posted you. You're famous now. Small famous. Hostel famous. [v: ]
- WALKER: The Senate had a cape? In my photo too. I thought it was a bird. [v: ]
- PHONE (Lyzzy, message): New pic is up. You're welcome. Delete the ceiling one. Today. [v: ]

---

### m21 — Express delivery
- Semester 2 · Gate 14 · Shape: delivery · Giver: Emeka · Thread: W
- Places: Main Gate, Samaru Market, KB's shop, civil workshop, above the Dam · Time: morning
- Needs: m20; jobs board; backpack inventory (NEW: 5-slot hotbar and a 20-slot grid, weight limit,
  visible backpack on the character); okada licence · Music: `motif_market`, `job_ride`

**Premise.** Emeka the okada rider has sprained his wrist on the busiest morning of the month. Four
deliveries, his bike, your backpack, and his phone ringing the whole time.

**Why now.** You have a licence and a reputation. Emeka trusts both, a little.

**Beats**
1. [talk: emeka] Meet Emeka at the Main Gate. His wrist is in a bandage made of a scarf.
   - EMEKA: My wrist said no this morning. My customers did not say no. [v: ]
   - EMEKA: Four drops. Take my okada. If it falls, you fall with it. Joke. Half joke. [v: ]
   - BATURE: I'll ride behind. For balance. Spiritual balance. [v: ]
2. [buy: backpack] Buy a backpack at KB's shop; you can't carry four parcels in your hands.
   - KB: For your face today, ₦2,000. It has pockets inside the pockets. [v: ]
   - BATURE: Is the pocket inside the pocket also ₦2,000? [v: ]
   - KB: That one is free. Like advice. [v: ]
3. [job: delivery ×3] On a job. Deliver three parcels: yam to Page Turner Books, a phone to
   Chi-Tech's table, a cooler to the Sick Bay.
   - MARYAM: Yam! Who sent yam to a bookshop? …It was me. I ordered it. Thank you. [v: ]
   - CHI-TECH: Put it there. Don't shake it. It's the charging port. It's always the port. [v: ]
   - NURSE HAUWA: Ice for the Sick Bay. You're an angel. Wipe your feet. [v: ]
4. [turn] The fourth parcel is not a parcel. It is twelve planks of wood, roped, for "the cliff".
   Nobody at the gate knows what cliff.
   - EMEKA (phone): Cliff? There's only the ridge above the Dam. Go. Before he calls again. [v: ]
5. [switch: Khalid] The planks are too long for the okada. Khalid, passing, offers to carry them on
   his shoulder while you ride ahead to clear the path; swap to him for the climb.
   - KHALID: I'll carry it. No, it's fine. Yes, I'm sure. Okay, I'm carrying it. [v: ]
   - BATURE: Riddle me this: who says yes before you finish asking? Khalid. [v: ]
6. [go: cliff ridge] Take the wood to the ridge above the Dam.
   A woman in a hard hat is hammering a stake into rock. Beside her, a drawing pinned to a board:
   a tall wooden tower, older paper than she is.
   - FOREMAN ASABE: You again. The pier still stands. Now you bring wood. Bless you. [v: ]
   - FOREMAN ASABE: Twelve planks. I needed two hundred. Still. Twelve is a start. [v: ]
7. [build: stakes ×4] Help Foreman Asabe drive the first four stakes. (Hold to swing; release on the mark.)
   - FOREMAN ASABE: Straight. No, straighter. Your stake is lying to us. [v: ]
   - KHALID: Mine is straight. I think. Is it? It's straight. [v: ]
8. [talk: emeka] Bring Emeka his okada and his money.
   - EMEKA: All four? Even the cliff? Hm. You can ride for me any day my wrist complains. [v: ]

**More beats**
3a. [look: backpack] Open your backpack between drops: five slots on the hotbar, more inside.
   - BATURE: Can I put my garri in your bag? It will be safer with you. From me. [v: ]
   - PLAYER: Your garri is already in my bag. [v: ]
   - BATURE: Then my work here is done. [v: ]
6a. [look: drawing] Read the drawing on the board. A wooden tower, numbered floors, and in the corner,
   initials in faded pencil.
   - FOREMAN ASABE: My father drew that. Thirty years ago. They started it. They ran out. [v: ]
   - FOREMAN ASABE: Everyone runs out of wood. The trick is to keep coming back. [v: ]
7a. [talk: asabe] Ask what the tower is for.
   - FOREMAN ASABE: To see. From up there you see the whole ring. My father said "ring". I never asked. [v: ]
   - BATURE: Riddle me this: what has a top and no top yet? This tower. [v: ]
   - FOREMAN ASABE: That's not a riddle. That's a description. Hold the plank. [v: ]
8a. [quiet] Ride back down. The four stakes are small against the sky.
   - KHALID: We'll finish it one day. I'll carry the wood. Don't argue. [v: ]

**Choice.** None.

**If it goes wrong.** A parcel is damaged (crash or drop): the customer laughs, pays half, and Emeka's
phone gets a complaint ("Your rider is enthusiastic"). The mission continues. Fall off the okada: walk
to the drop; Emeka sends Bature with a bicycle.

**Rewards.** ₦3,500, 800 XP, Street +3, Community +2. Friendship: Emeka +5, Khalid +4, Asabe +3.
Backpack unlocked. Unlocks m22 and the workshop side chain (wood, sand, cement).
**Sets / pays.** Sets `backpack`, `cliff_stakes`, `tower_drawing`. Pays m11 (`met_asabe`, the pier). Plants the wooden cliff
tower: started here, built further in Year 3, revisited in Year 4, never finished ("we ran out of wood").
**Around it.**
- RADIO (Kabiru): Emeka's okada was seen with a stranger on it. Emeka, blink twice if you're okay. [v: ]
- RADIO (Kabiru): Somebody delivered wood to a cliff. On campus. I don't know either. [v: ]
- WALKER: Backpacks are in. Even the lecturers have them. Prof. Bello has two. [v: ]
- WALKER: Who's building on the ridge? My grandfather said they tried that before. [v: ]
- PHONE (Emeka, message): My wrist says thank you. My wallet says thank you. My okada says be gentle. [v: ]

---

### m22 — Senate Sprint
- Semester 2 · Gate 15 · Shape: race · Giver: Coach Danladi · Thread: W
- Places: Racing Club, Freshers Boulevard, Senate ring, Fountain Circle · Time: noon · Weather: harmattan haze
- Needs: m21; bicycle or scooter; Bolaji on his skateboard as pacer · Music: `race_build`, `motif_bolaji`

**Premise.** The Senate Sprint is one lap of the Senate and back, the shortest race on campus and the
dirtiest. Coach Danladi enters you. Bolaji enters himself.

**Why now.** Danladi saw the deliveries. He thinks you have "legs and no sense", which he says is
how champions start.

**Beats**
1. [talk: danladi] Talk to Coach Danladi at the Racing Club.
   - DANLADI: One lap. Senate and back. Shortest race, longest arguments. [v: ]
   - DANLADI: You. You have legs and no sense. That is how champions start. [v: ]
2. [talk: bolaji] Bolaji is at the start line on a skateboard, eating suya.
   - BOLAJI: Sly is racing. On a board. Because Sly does not need wheels with engines. [v: ]
   - BOLAJI: John Carter, hold my suya. Don't eat it. I counted it. [v: ]
   - ABBAS: My name is Abbas, and I'm only holding it because I'm hungry. [v: ]
3. [race: senate sprint] Win the Senate Sprint. (Bolaji pushes, then coasts down the boulevard.)
   - CROWD: No gree for anybody! [v: ]
   - BOLAJI (passing): Sly says bye-bye! [v: ]
4. [turn] At the Senate ring your chain snaps. Bolaji skates past, then stops, and comes back.
   - BOLAJI: Your chain? Today? Sly will not win like this. It's not sweet. [v: ]
   - BOLAJI: John Carter! Come! A bicycle needs you! [v: ]
5. [switch: Abbas] Swap to Abbas and fix the chain at the roadside (three taps on the link pins).
   - ABBAS: Pin. Pin. Pin. Done. You owe me, and he owes me suya. [v: ]
   - BOLAJI: I owe you nothing, John Carter. I owe you… one suya. Small one. [v: ]
6. [race: senate sprint, restart from the ring] Finish the race. Bolaji waits, then races you fair.
   - BOLAJI: Now we race properly. If you win, I clap. If I win, you clap louder. [v: ]
7. [talk: danladi] Report to Coach at the finish.
   - DANLADI (win): Legs, sense, and a friend who came back. Three. Rare. [v: ]
   - DANLADI (lose): You lost to a man on a plank. Come back Thursday. Bring sense. [v: ]

**More beats**
1a. [talk: danladi] He shows you the route on a chalkboard drawn in the dust.
   - DANLADI: The fountain is a roundabout, not a shortcut. Remember that. Everybody forgets. [v: ]
   - BATURE: Riddle me this: what goes round and round and still gets there? Me, in this race. [v: ]
2a. [talk: big baby] A small voice from the stands.
   - BIG BABY: Bolaji. [v: ]
   (Bolaji stops eating, wipes his mouth, stands up straight.)
   - BOLAJI: Yes, Baby. [v: ]
   - BIG BABY: No falling. I'm not carrying you home again. [v: ]
   - BOLAJI: Sly does not fall. Sly… slides with style. [v: ]
3a. [ride: boulevard] The palms flash past. Harmattan dust in the light. Your bell rings on its own
   over the bumps.
   - BOLAJI: Bicycle bells! I hate bicycle bells! [v: ]
6a. [emote: cheer] Whoever wins, Bolaji claps. Loudly.
   - BOLAJI: Clap for them! Clap! Sly said clap! [v: ]
   - CROWD: ★ Eh eh eh. [v: ]
   - CROWD: Big Sly is clapping? Who did this to him? [v: ]
7a. [talk: bolaji] He gives Abbas the small suya. It is very small.
   - BOLAJI: For you, John Carter. Don't say I'm not generous. [v: ]
   - ABBAS: This is one piece of onion. [v: ]
   - BOLAJI: It's the spirit of the suya. [v: ]

**Choice.** None.

**If it goes wrong.** Lose the race: the loss scene plays (Bolaji claps anyway) and Danladi offers a
rematch on any Thursday. Cutting through the fountain: disqualified, with Danladi's chalkboard line.

**Rewards.** Win: ₦3,000, 900 XP, Street +4. Lose: ₦800, 500 XP, Street +1. Friendship: Bolaji +5,
Abbas +3, Danladi +3. Unlocks m23.
**Sets / pays.** Sets `sprint_won` or `sprint_lost`, `bolaji_came_back`. Pays m9 (Sly is an ally now).
`bolaji_came_back` returns in m102, when he stops the next fresher tax.
**Around it.**
- RADIO (Kabiru): The Senate Sprint! Big Sly on a skateboard. I repeat. On a skateboard. [v: ]
- RADIO (Kabiru): Coach Danladi says the fountain is not a shortcut. He says it every year. [v: ]
- WALKER: Did Sly stop to help? I need to lie down. [v: ]
- WALKER: John Carter fixed a chain in eight seconds. I timed it. [v: ]
- PHONE (Coach Danladi): Thursday. Racing Club. Bring your legs. Leave your excuses. [v: ]

---

### m23 — The hum
- Semester 2 · Gate 16 · Shape: investigation · Giver: the Maker · Thread: M
- Places: Engineering Garden, Engineering quad, Library steps · Time: night · Weather: clear, still
- Needs: m22 · Music: `motif_maker`, `tension_low`, `sting_reveal` at the direction of the hum

**Premise.** The Maker says the ground has started humming. He wants you to listen with him, at night,
when the campus is quiet enough to hear what is under it.

**Why now.** The light came back after the Count, but it flickers. The Maker has noticed a new note
under the old one.

**Beats**
1. [talk: maker] Talk to the Maker beside the Tesla coil.
   He does not turn round. The coil hums one steady note.
   - THE MAKER: You came. Good. Do you hear it? [v: ]
   - PLAYER: The coil? [v: ]
   - THE MAKER: Under the coil. Come back tonight. Bring someone who listens. [v: ]
2. [talk: nusaybah] Find someone who listens. Nusaybah is in the quad, correcting a classmate's
   circuit drawing without being asked.
   - NUSAYBAH: Wait. Look again. That resistor is facing the wrong way. And so are you. [v: ]
   - NUSAYBAH: A hum under the ground? Like at the Dam? Tonight? …Fine. I'm curious. [v: ]
3. [go: enggarden, night] Return to the Engineering Garden after dark.
   The garden is darker than the path. Shapes at the fence that are not bushes.
   - BATURE: Riddle me this: what's in the garden that wasn't there at lunch? …Run? [v: ]
4. [fight: shade ×6] Drive the shades away from the coil. (Torch, then a stick from the hedge.)
   - THE MAKER: Don't chase them. Push them back. They only want the dark. [v: ]
5. [listen: three spots] Stand still at three spots and listen. (Hold to listen; the hum gets louder
   on the right path.) NEW: listen step.
   - NUSAYBAH: There. Louder by the wall. Not the coil. Further. [v: ]
6. [turn] At the third spot, the hum is clearly coming from outside the garden: north, toward the
   gate, toward the market.
   - NUSAYBAH: That's not a hum. That's a machine. A big one. Running. [v: ]
   - THE MAKER: Something is drinking from the same well. I don't know what. Yet. [v: ]
7. [find: capacitor] Search the lawn where the shades were standing. One of them was standing on
   something: an old capacitor, half-buried, still warm.
   - THE MAKER: That is mine. From long ago. They were guarding it. Or keeping it from me. [v: ]

**More beats**
1a. [talk: aunty asiya] On your way out, the MIB Store's manager is bringing a covered plate to the
   garden gate. She leaves it on the post and does not go in.
   - AUNTY ASIYA: For my uncle. He won't eat if I watch. Don't watch either. [v: ]
   - BATURE: Your uncle? He's your uncle? [v: ]
   - AUNTY ASIYA: Everyone's somebody's something. Go. [v: ]
3a. [talk: wednesday] At the garden gate, Wednesday, black umbrella open although there is no rain.
   - WEDNESDAY: You're late. Not for tonight. In general. [v: ]
   - WEDNESDAY: It's Wednesday. Things happen on Wednesday. See you Wednesday. [v: ]
   - BATURE: Today is Wednesday. [v: ]
   - WEDNESDAY: Then see you next Wednesday. [v: ]
   (She leaves a crow feather on the gatepost.)
5a. [talk: nusaybah] Between listening spots, Nusaybah studies the Maker instead of the ground.
   - NUSAYBAH: He knows more than he says. People who know more stand very still. [v: ]
   - PLAYER: You're standing very still. [v: ]
   - NUSAYBAH: …Look again. At the ground. Not at me. [v: ]
7a. [quiet] The Maker puts the capacitor in his coat pocket and looks north for a long time.
   - THE MAKER: Go and sleep. The ground will still be humming tomorrow. So will I. [v: ]
   - BATURE: Riddle me this: who doesn't sleep? …Him. That's not a riddle. That's worrying. [v: ]

**Choice.** None.

**If it goes wrong.** Torch battery dies during the fight: the shades push you to the gate and the
Maker says, "Batteries. Then come back." Retry from beat 3 with a free battery from Asiya.

**Rewards.** ₦1,500, 900 XP, Books +2, Department +2. Friendship: Nusaybah +5, the Maker +3. Item:
old capacitor. Unlocks m24.
**Sets / pays.** Sets `hum_heard`, `wednesday_feather_1`, `asiya_plate`. Pays m4 (the fan stopped
before the light). `hum_heard` is paid in m44 (it is the mall's generator, Iron Mama). Wednesday's
feathers lead to her weekly walk (s53).
**Around it.**
- RADIO (Kabiru): Students near Engineering report humming. It's not me. I'm off air. Goodnight. [v: ]
- RADIO (Kabiru): A girl with an umbrella says see you Wednesday. It's Wednesday. I'm scared. [v: ]
- WALKER: The ground is humming? My stomach is humming. Different problem. [v: ]
- WALKER: The man with the coil never sleeps. My uncle saw him in the nineties. Same coat. [v: ]
- PHONE (Nusaybah, message): The hum is at 50 cycles. That's mains. Somebody has a lot of power. [v: ]

---

### m24 — Two papers, one day
- Semester 2 · Gate 17 · Shape: quiz · Giver: Prof. Bello · Thread: D
- Places: Physics, Mathematics, Library, Senate (registry window), Mama Nkechi's buka · Time: morning to
  evening · Weather: hot
- Needs: m23; lectures and quiz flow · Music: `place_library_day`, `exam_tension`, `sting_win`

**Premise.** Physics test at nine. Mathematics test at nine. Same day, same hour, opposite ends of the
academic side. Prof. Bello says "manage". Muktar says "committee".

**Why now.** Mid-semester tests arrive like rain in harmattan: suddenly, and all at once.

**Beats**
1. [talk: bello] Talk to Prof. Bello at Physics about the clash.
   - BELLO: Two papers, one hour? Then you have one hour twice. Manage. [v: ]
   - BELLO: Or go to registry and beg. Registry enjoys begging. [v: ]
2. [talk: muktar] Muktar is outside with a clipboard, already forming a committee.
   - MUKTAR: Point of order. Forty students have this clash. That is a constituency. [v: ]
   - MUKTAR: I need someone to collect signatures. I need someone to look sad at the window. [v: ]
   - BATURE: I can look sad. I've been practising since garri week. [v: ]
3. [switch: Muktar] Swap to Muktar to organise the crowd into a queue at the registry window while
   you collect signatures in the quad. (Muktar's ability: organise; the queue forms itself.)
   - MUKTAR: Single file! Alphabetical! Bature, you're "B", stop standing at "Z". [v: ]
   - MRS. ADEBAYO: Who organised this? It's… beautiful. Fine. Maths moves to two o'clock. [v: ]
4. [go: library] Study in the library before nine.
   - FATIMA: Shh. This is my table. That is my chair. You may borrow the air. [v: ]
   - MARYAM: Do you want yam? I brought yam. For revision. Yam is revision food. [v: ]
5. [class: physics, pass 4] Score 4 or more in the Physics test.
   - SHAMSU: Units first. Prof. Bello marks the units before he reads the answer. [v: ]
6. [turn] At the Maths hall the board says the test is a different paper: last year's, by mistake.
   Half the room panics. Yusuf, at the back, is calmly writing.
   - YUSUF: Don't look at me. I'm guessing. I'm a guesser. Very famous guesser. [v: ]
   - NUSAYBAH: He isn't guessing. Look at his page. Look again. [v: ]
7. [class: maths, pass 4] Score 4 or more in Mathematics anyway.
8. [talk: bello] Return to Prof. Bello with both results.
   - BELLO: Both? On the same day? Hm. You managed. Don't tell anyone it's possible. [v: ]

**More beats**
4a. [eat: garri] Your stomach complains. It is garri week. Bature pours with ceremony.
   - BATURE: Soak it well. Let it swell. That is how one cup becomes two. [v: ]
   - FATIMA: You can't eat in the library. …Is that groundnut? Give me one. [v: ]
   - BATURE: Groundnut? In this economy? One. Because it's you. [v: ]
5a. [talk: yusuf] Before Maths, Yusuf leans on the doorframe. Three girls are laughing at his jokes.
   - YUSUF: You look like someone who says yes. Lend me a pen. A blue one. With confidence. [v: ]
   - PLAYER: You don't have a pen? [v: ]
   - YUSUF: I have charm. Charm doesn't write. [v: ]
7a. [talk: yusuf] After the test, he hands back your pen and a page you didn't see him write: the
   full worked answer to question five.
   - YUSUF: I didn't do that. A ghost did it. Funny ghost. Good at integration. [v: ]
   - PLAYER: You're good at maths. [v: ]
   - YUSUF: Shh. Nobody wants a funny mathematician. Keep my secret, I keep your pen. [v: ]
8a. [eat: buka] Mama Nkechi feeds everyone who sat both papers, free.
   - MAMA NKECHI: You, sit. You're thin. Two papers? Two plates. [v: ]
   - BATURE: I sat zero papers. [v: ]
   - MAMA NKECHI: Then zero plates. …Sit. I'm joking. Sit. [v: ]

**Choice.** At the registry window: "Sign the petition" (Department +3; Muktar remembers you as a
committee member) / "Just sit both papers back to back" (Books +3; Bello remembers you as stubborn).

**If it goes wrong.** Fail a test: Bello gives a resit slot "next Tuesday, early, with sense"; the
mission completes after the resit. The quiz never blocks the story.

**Rewards.** ₦1,000, 1,000 XP, Books +4 (or +3/+3 by choice). Friendship: Muktar +4, Yusuf +3, Fatima
+2, Maryam +3. Unlocks m25.
**Sets / pays.** Sets `y1_tests`, `yusuf_maths_hint`, `committee_member` or `bello_stubborn`. Pays m15
(the class of your life). `yusuf_maths_hint` is paid in Y3 (friendship scene 5) and m72.
**Around it.**
- RADIO (Kabiru): Two papers, one day. Registry has blinked. I repeat, registry has blinked. [v: ]
- RADIO (Kabiru): If you sat last year's maths paper, congratulations, you're a year ahead. [v: ]
- WALKER: Who is this Muktar? He made me stand in alphabetical order. I felt safe. [v: ]
- WALKER: Yusuf finished early again. He says he guessed. Nobody guesses integration. [v: ]
- PHONE (Dad): Results? …And the generator at home is fine. Your mother says eat. [v: ]

---

### m25 — Paper trail
- Semester 2 · Gate 18 · Shape: investigation · Giver: Mai Shayi Audu · Thread: M
- Places: Mai Shayi's stall, the Bank, Page Turner Books, Radio Studio · Time: dusk into night
- Needs: m24; stealth basics (NEW: stay out of a watcher's sight cone; crouch behind cover)
- Music: `motif_audu`, `tension_low`, `sting_reveal` at the torn pages

**Premise.** Mai Shayi has noticed a man in a good suit who visits the Bank after closing, every time
the light goes. He would like to know why. He would like you to find out, quietly, after your tea.

**Why now.** The hum (m23) says somebody has a lot of power. Mai Shayi says somebody has a lot of money.
The two are often the same somebody.

**Beats**
1. [talk: audu] Hear what Mai Shayi has noticed.
   - AUDU: Tea first. Then talk. [v: ]
   - AUDU: A man in a suit. Bank, after closing. Every time they take light. [v: ]
   - AUDU: Banks close. Men go home. This one does not. I sell tea. You have legs. [v: ]
2. [go: bank, night] Wait near the Bank after dark. The street lamp outside it is the only one on.
   - BATURE: Riddle me this: why does the bank have light and my room doesn't? …Money. [v: ]
3. [stealth: bank side] Get close enough to see without being seen by Corporal Peter.
   - PETER: I'm not sleeping. I'm observing with my eyes closed. [v: ]
   - BATURE (whisper): He is sleeping. [v: ]
4. [watch: bank door] Watch the man come out with a ledger under his arm.
   He walks fast toward the bookshop. Something falls from the ledger. He does not notice.
5. [find: ledger pages at mk_books] Find what he dropped by Page Turner Books.
   - MARYAM (through the window): You're crawling outside my shop. Is this a book thing? [v: ]
   - MARYAM: …It's a ledger. Come in. Bring it in. Don't drip on it. [v: ]
6. [turn] Inside, under the reading lamp, the pages are columns of numbers and one word repeated:
   "TRANSFER". Every page that would say *to whom* has been torn out.
   - MARYAM: Somebody tore these carefully. You don't tear carefully unless you're scared. [v: ]
   - BATURE: Riddle me this: what has numbers and no names? …I hate this game today. [v: ]
7. [talk: kabiru] Take the ledger pages to DJ Kabiru.
   - KABIRU: I can't read this on air. It's numbers. Nobody dances to numbers. [v: ]
   - KABIRU: But I'll keep it. In the studio safe. It's a biscuit tin. It's very safe. [v: ]

**More beats**
1a. [eat: tea] Mai Shayi pours from a great height. Not one drop misses.
   - AUDU: Thirty years pouring. Never missed. Ask me about money, I miss. Tea, never. [v: ]
   - BATURE: Teach me. [v: ]
   - AUDU: Thirty years. Sit. [v: ]
3a. [stealth: hedge] Crouch behind the hedge as a guard torch sweeps past.
   - BATURE (whisper): If he finds us, say we're looking for my contact lens. [v: ]
   - PLAYER (whisper): You don't wear contact lenses. [v: ]
   - BATURE (whisper): That's why we're still looking. [v: ]
5a. [talk: maryam] Maryam closes the shop blinds and hands you each a piece of roasted yam.
   - MARYAM: Investigations need yam. It's in every good book. Chapter one, yam. [v: ]
   - MARYAM: I'll file you under "mystery". Bature is under "comedy". [v: ]
   - BATURE: I'm under comedy? I'm hurt. Put me under "romance". [v: ]
   - MARYAM: There's no shelf for that. [v: ]
6a. [look: noticeboard] Outside the bookshop, someone has pinned a short anonymous story to the
   noticeboard: "The Man Who Counted Light". It's about a banker who sells the dark.
   - BATURE: Who writes these? Every week. No name. [v: ]
   - MARYAM (not looking up): No idea. Probably someone with a lot of time and yam. [v: ]
7a. [quiet] Walk back past Mai Shayi's stall. He is still there, kettle on, looking at the Bank.
   - AUDU: Torn pages. Hm. Somebody is not hiding money. Somebody is hiding a name. [v: ]
   - AUDU: Drink. Go and sleep. Names come out. They always come out. In time. [v: ]

**Choice.** None.

**If it goes wrong.** Spotted by Corporal Peter: he wakes, shines his torch, and says "Go and read,"
and the man leaves by the back; retry the next night the light goes (or from the phone: "Wait for a
blackout"). The ledger pages are still there.

**Rewards.** ₦1,200, 1,000 XP, Street +2, Community +2. Friendship: Audu +5, Maryam +4, Kabiru +2.
Unlocks m26.
**Sets / pays.** Sets `ledger_torn`, `kabiru_tin`, `noticeboard_story_1`. Pays m6 (Mai Shayi knows).
`ledger_torn` goes nowhere in Year 1, on purpose; it is paid in m49 (the contract file).
`noticeboard_story_1` is the first hint that Maryam writes the stories (revealed s22).
**Around it.**
- RADIO (Kabiru): I have a biscuit tin full of evidence. I'm not saying what of. Biscuits, maybe. [v: ]
- RADIO (Kabiru): New story on the bookshop noticeboard. Somebody out there can write. Who are you? [v: ]
- WALKER: The Bank had light again last night. The Bank always has light. [v: ]
- WALKER: Corporal Peter says he was observing. With snoring. Advanced observing. [v: ]
- PHONE (Audu, voice note): Bring bread tomorrow. And your ears. [v: ]

---

### m26 — East Side Drift
- Semester 2 · Gate 19 · Shape: race · Giver: Kelechi · Thread: W
- Places: Racing Club, east side roads, campus fence, forest edge · Time: late afternoon · Weather:
  first rain of the year (NEW: wet roads, puddles, umbrellas)
- Needs: m25; car licence; handbrake drift · Music: `race_build`, `rain_first`, `motif_ranger`

**Premise.** The East Side Drift is a car race round the tightest corners on campus. Kelechi lost it
last year to a senior who "drove like a poem". He wants to know what the losers say about him.

**Why now.** You have a car licence and a reputation for coming back for people. Kelechi needs both.

**Beats**
1. [talk: kelechi] Talk to Kelechi in the Sculpture Garden. He is carving and won't stop.
   - KELECHI: The East Side Drift. Six corners. I lost on the fifth. I want to know why. [v: ]
   - KELECHI: Ask the losers what they said about me. Losers talk. Winners don't listen. [v: ]
2. [talk: danladi] Ask Coach Danladi for a car. He refuses.
   - DANLADI: A fresher? In my club car? Before the rains? No. [v: ]
3. [switch: Yusuf] Swap to Yusuf to charm Coach into lending the car while you check the tyres.
   (Yusuf's ability: charm a gatekeeper.)
   - YUSUF: Coach. You look like someone who says yes. [v: ]
   - DANLADI: I look like someone who says no. [v: ]
   - YUSUF: That's what I said. You look like someone who says no, and means yes. [v: ]
   - DANLADI: …One race. One. If it comes back scratched, you come back scratched. [v: ]
4. [ride: car] Get behind the wheel at the Racing Club.
5. [race: east side drift] Win the East Side Drift. (Handbrake on X, or the DRIFT button.)
   - CROWD: ★ Gbas gbos! [v: ]
   - CROWD: That's so cringe! (as somebody spins out) [v: ]
6. [turn] On the fourth lap the sky opens. The first rain of the year turns the east side into a river.
   Cars slide. The race becomes a careful race.
   - DANLADI (megaphone): Rain! Slow down! Nobody slows down! Why do I bother? [v: ]
7. [race: finish in the rain] Finish. Wet roads grip less; the handbrake grips even less.
8. [talk: losers] Ask the losers what they said about Kelechi.
   - RACER: Kelechi? He brakes like he's carving. Very careful. Very slow. Very art. [v: ]
   - RACER: He looks at the corner too long. Like it owes him money. [v: ]
9. [talk: kelechi] Tell Kelechi.
   - KELECHI: "Like it owes him money." Hm. That's my whole problem. Corners and art. [v: ]

**More beats**
2a. [talk: danladi] Danladi points at the sky as if it has personally disappointed him.
   - DANLADI: The rains are coming. When the rains come, the road becomes soap. [v: ]
   - BATURE: Riddle me this: what's slippery, falls from the sky, and ruins races? …Coach's mood. [v: ]
6a. [go: fence edge] You slide wide at the last corner and stop near the campus fence, by the forest.
   A man in ranger khaki with a torch is standing in the rain as if rain is optional.
   - RANGER LAWAL: You again. Go back. [v: ]
   - PLAYER: I'm just turning— [v: ]
   - RANGER LAWAL: Go back. Past this fence is bush. The bush doesn't care that you're fast. [v: ]
6b. [talk: lawal] Bature, in the passenger seat, recognises him.
   - BATURE: Good evening, Ranger Lawal! [v: ]
   - RANGER LAWAL: I'm not a tour guide. [v: ]
   - BATURE: Sheikh Biru! Lecture us on trees! [v: ]
   - RANGER LAWAL: …That one is an iroko. Go back. [v: ]
8a. [look: umbrellas] The rain has emptied the paths. Students run under awnings with books on their
   heads; a girl in a black dress walks slowly, umbrella already open.
   - WEDNESDAY (passing): I opened it this morning. Nobody listens. [v: ]
9a. [quiet] Kelechi stops carving and looks at the statue he is working on: a figure mid-turn.
   - KELECHI: I've been carving it wrong. It should be leaning into the corner. Not looking at it. [v: ]
   - KELECHI: Thank you. Tell nobody I said thank you. Artists have a reputation. [v: ]

**Choice.** None.

**If it goes wrong.** Lose: the loss scene (Danladi: "The rain won. Not you.") and a rematch on any dry
evening. Scratch the club car: Danladi's line plays, the car is fixed free by Abbas, and Yusuf owes him.

**Rewards.** Win: ₦4,000, 1,100 XP, Street +4. Lose: ₦1,000, 600 XP, Street +1. Friendship: Kelechi +4,
Yusuf +3, Lawal +2. Unlocks m27 and rain weather.
**Sets / pays.** Sets `drift_y1`, `lawal_rain`, `rain_first`, `kelechi_lean`. Pays m14 (`lawal_go_back`)
and m14 (the ranger's "Go back"). Ranger Lawal turns you back again in Year 3; `kelechi_lean` returns in m99
(his signed sculpture).
**Around it.**
- RADIO (Kabiru): First rain! Everybody run! Nobody run! Walk carefully and look cool! [v: ]
- RADIO (Kabiru): Shamsu from Electrical asks students to stop calling him Sheikh Biru. Noted, Sheikh. [v: ]
- WALKER: My shoes are wet. My soul is wet. The rain has entered my spirit. [v: ]
- WALKER: Who taught the fresher to drift? It was the rain. The rain taught them. [v: ]
- PHONE (Mum): Is it raining there? Wear something. Don't stand under trees. Have you eaten? [v: ]

---

### m27 — What the net caught
- Semester 2 · Gate 20 · Shape: boss · Giver: Baba Dam · Thread: M
- Places: The Dam pier, the shallows, Bolaji's corner at the court, Engineering Garden (dark)
- Time: night · Weather: humid after rain · Needs: m26; `maker_away` begins (scheduled absence)
- Music: `place_dam_night`, `motif_eel`, `tension_mid`, `sting_reveal`

**Premise.** Something in the water at the Dam took Baba Dam's net and dragged it under. Tonight the
net came back, and it is full of something that is not fish. The coil in the Engineering Garden is
dark, and nobody has seen the Maker for two days.

**Why now.** This is the first time the Maker is gone. Blackouts double. The shades thicken by the
water. Baba Dam needs hands.

**Beats**
1. [go: enggarden] Pass the Engineering Garden on the way. The coil is silent. The fence gate is
   chained. Aunty Asiya's covered plate sits on the post, untouched.
   - AUNTY ASIYA: Two days. He's never missed supper. Not once. Don't ask me where. I don't know. [v: ]
   - BATURE: Riddle me this: where does a man go who never goes anywhere? [v: ]
   - AUNTY ASIYA: If you find the answer, bring it here. With him. [v: ]
2. [talk: baba] Talk to Baba Dam at the pier.
   - BABA DAM: The water hears. Tonight, the water is shouting. [v: ]
   - BABA DAM: My net went down at sunset. It came up at moonrise. Heavy. Come and see. [v: ]
3. [go: dam, night] Come back to the Dam at night.
   The pier is crowded with shades, more than you've ever seen in one place.
   - BOLAJI: Sly heard there's trouble. Sly came. Sly brought a cricket bat. [v: ]
4. [fight: shade ×8] Clear the shades off the pier. Bolaji swings wide; you push with the torch.
   - BOLAJI: Shades! Go back to your dark! This pier is for fishing and Sly! [v: ]
   - CROWD (bank): Leave am! [v: ]
5. [switch: Bolaji] Swap to Bolaji to haul the net onto the pier. It is too heavy for anyone else.
   (Bolaji's strength; hold to pull, release to rest.)
   - BOLAJI: Heavy! Very heavy! Is it a goat? Please don't be a goat. [v: ]
6. [turn] In the net: a sack, tangled tight. Inside the sack, a dozen phones, a radio, a tablet,
   and a small, cracked phone with a sticker of a football on the back. Bolaji goes very quiet.
   - BOLAJI: That's my small brother's. He lost it… a month ago. He said someone took it. [v: ]
   - BABA DAM: Things that go into the water at night don't go by themselves. [v: ]
7. [care: the net] Something large and dark moves in the shallows and pulls at the far end of the net.
   Do not fight it. Free the net from the post so it can go. (NEW: care step; gentle cutting.)
   - BABA DAM: Leave her. She only wants her water back. Cut it. Slowly. [v: ]
8. [talk: bolaji] Bring Bolaji his small brother's phone, dried, the next morning at the court.
   - BOLAJI: He cried when he lost it. He'll cry when he gets it. Sly will not cry. Sly is… [v: ]
   - BOLAJI: …Sly is fine. Go. Thank you. Go before Sly is not fine. [v: ]

**More beats**
2a. [talk: baba] Baba Dam won't say what "her" is.
   - BABA DAM: In the water there are things older than the school. Some of them are mothers. [v: ]
   - BATURE: Riddle me this: what's long, wet and a mother? …No. I don't want to know. [v: ]
4a. [fight: shades by the boats] Two shades drift toward the boats. Abbas, behind you, throws a
   bucket of water at them, which does nothing, then a torch beam, which does.
   - ABBAS: Light! Not water! Why did I bring water to a lake? [v: ]
   - BOLAJI: John Carter has invented wet darkness! Applause! [v: ]
6a. [look: phones] Read the sack's tag: a number, and the letter T, burned into canvas.
   - ABBAS: Somebody is collecting phones and throwing them in the Dam. That's not theft. [v: ]
   - ABBAS: That's somebody who doesn't want people to call each other in the dark. [v: ]
7a. [look: the water] When the net is free, the shape slides away. Two small lights, like eyes, stay
   on the surface for a moment, then go out.
   - BOLAJI: Sly saw nothing. Sly will be sleeping with his light on tonight. [v: ]
8a. [quiet] On the walk home, the whole east side is dark. Only the Bank and the market glow.
   - AUDU (on his stall, as you pass): The Maker away, the dark comes calling. Every time. [v: ]
   - AUDU: Don't ask where he goes. Nobody knows. Even the dark doesn't know. [v: ]

**Choice.** At the pier, with the sack: "Hand the other phones to Sgt. Bilkisu" (Community +3; owners
get phones back over the next week as walker lines) / "Give them to Chi-Tech to recover the photos
first" (Vibes +3; Chi-Tech returns family photos free, and says so).

**If it goes wrong.** Torch dies or Bolaji is knocked down: the shades push everyone off the pier and
Baba Dam says "The water is patient. Come back." Retry the same night from beat 3.

**Rewards.** ₦2,000, 1,200 XP, Community +3, Street +2. Friendship: Bolaji +8, Baba Dam +4, Abbas +3.
Item: cricket bat (non-lethal weapon). Unlocks m28.
**Sets / pays.** Sets `maker_away` (on), `eel_net`, `bolaji_brother_phone`, `phones_bilkisu` or
`phones_chitech`, `sack_T`. Pays m11 (Baba Dam). `eel_net` is paid in m31. `sack_T` is never explained.
**Around it.**
- RADIO (Kabiru): The coil in the garden is off. If you have a candle, light it. If you have two, share. [v: ]
- RADIO (Kabiru): Big Sly seen hugging a phone at the court. I said nothing. I saw nothing. [v: ]
- WALKER: The Maker is gone? He's never gone. He's like the Senate. You don't lose the Senate. [v: ]
- WALKER: My phone is back! I lost it in a blackout. It smells of fish. I love it. [v: ]
- PHONE (Asiya, message): Still no supper eaten. If you see a man in a lab coat, tell him to eat. [v: ]

---

### m28 — Wingman
- Semester 2 · Gate 21 · Shape: social · Giver: Sadiq · Thread: R
- Places: @hostel, Clemantine's Gift Corner, KB's shop, Radio Studio, Love Garden · Time: afternoon to
  dusk · Weather: dry · Needs: m27; gifts (m16) with "listened" (a gift counts double only if the
  person mentioned wanting it to you before, as in m3) · Music: `motif_love`, `place_gardens_dusk`

**Premise.** Sadiq likes Joy, the radio intern. Sadiq has never said more than "Toh" to her. He would
like help, as long as the help does not involve him speaking.

**Why now.** With the Maker gone and the lights unreliable, everyone wants a reason to stay out late
and talk. Sadiq has found his.

**Beats**
1. [talk: sadiq] Talk to Sadiq at the hostel. He is ironing one sleeve.
   - SADIQ: Toh. There is a girl. Joy. At the radio. She laughs at Kabiru's jokes. [v: ]
   - SADIQ: Nobody laughs at Kabiru's jokes. She must be kind. I'm not brave. Help. [v: ]
2. [talk: joy] Visit the Radio Studio and listen to Joy. Ask nothing. Just listen.
   - JOY: Kabiru, your jingle is out of tune. …I'm joking. It's always out of tune. [v: ]
   - JOY: Harmattan kills my lips. Somebody bring me shea butter, I'll marry them. [v: ]
   - JOY: And the Love Garden bench is my favourite place. It's quiet. Nobody sits there. [v: ]
3. [buy: shea butter] Buy shea butter at KB's shop. (She mentioned it: it counts.)
   - KB: For a love matter? ₦400. For a friendship matter, ₦600. Love is discounted. [v: ]
4. [buy: flowers] Buy flowers at Clemantine's. (Optional. She didn't mention flowers.)
   - CLEMANTINE: Roses? For who? …Hm. Take the yellow. The red ones are too loud for Sadiq. [v: ]
5. [emote: sit, at love] Test the bench in the Love Garden. Make sure it is quiet. It is.
6. [turn] You bring Sadiq the gift. He has written a speech. It is four pages. He cannot read it
   without shaking. And Joy is already walking into the Love Garden, toward the bench.
   - SADIQ: She's here. Now? Now now? I'm not ready. I'm wearing one ironed sleeve. [v: ]
7. [switch: Sadiq] Swap to Sadiq. Walk to the bench. Say the one line he can manage. You stand by
   the hedge as moral support (and to make faces).
   - SADIQ: Toh. Hello. I brought shea butter. Because of the harmattan. And your lips. [v: ]
   - SADIQ: …Not your lips. The harmattan's lips. I'll go. [v: ]
   - JOY: You listened. Nobody listens on the radio. Sit. Don't go. [v: ]
8. [talk: sadiq] Afterward, hear how it went.
   - SADIQ (tea): She said tea, tomorrow. Tea! I'm going to iron both sleeves. [v: ]
   - SADIQ (later): She said "not now, maybe later". That's okay. She smiled. I'll wait. [v: ]

**More beats**
1a. [talk: @roomie] Your roommate has opinions.
   - BATURE: Riddle me this: what's quiet, sleepy, and in love? Sadiq. That's not even a riddle. [v: ]
   - FIRDAUSI: Sadiq is my cousin. If he cries, I'll blame you. Help him properly. [v: ]
2a. [talk: joy] Joy notices you listening.
   - JOY: Are you here for Kabiru? He's not here. He's never here. He's a voice. [v: ]
   - PLAYER: I'm just… listening. [v: ]
   - JOY: That's rare. Most people come in and talk. Sit, if you want. [v: ]
4a. [talk: clemantine] Clemantine wraps the flowers and talks to them in French.
   - CLEMANTINE: I tell them where they're going. Flowers like to know. [v: ]
   - CLEMANTINE: Every Friday I put the ones nobody bought on a bench. A special one. [v: ]
5a. [look: @crush] On the bench path you pass @crush. If you have spoken before, they stop.
   - @CRUSH: You again. Are you following me? …I'm joking. Walk with me to the gate? [v: ]
   - @CRUSH (if "not now" was said in m19): Ask me again next week. I meant it kindly. [v: ]
7a. [look: the hedge] You make faces behind the hedge. Joy sees. Joy laughs. Sadiq thinks she's
   laughing at him and almost leaves. Then she says why.
   - JOY: Your friend is making a face like a goat. Is he okay? [v: ]
   - SADIQ: He's always like that. We're used to it. [v: ]
8a. [quiet] At dusk the Love Garden lamps stay off: the Maker's absence. Couples sit anyway, by phone
   light.
   - SADIQ: It's dark and I'm happy. Is that allowed? [v: ]
   - BATURE: Riddle me this: what shines without light? …Sadiq. Today. Disgusting. [v: ]

**Choice.** None. Joy's answer depends on whether you gave the gift she asked for (tea tomorrow) or
only flowers (not now, maybe later). Both are fine endings; neither is a failure.

**If it goes wrong.** Sadiq runs before he speaks: he hides at KB's, and you can talk him back the next
evening. Pestering Joy for him gets her line "Let him say it himself," and the beat resets.

**Rewards.** ₦800, 900 XP, Vibes +3. Friendship: Sadiq +6, Joy +4, Clemantine +2. Unlocks m29.
**Sets / pays.** Sets `sadiq_joy_tea` or `sadiq_joy_later`, `listened_joy`, `clemantine_bench`. Pays m16
(`gift_system`) and m3 (listening). `sadiq_joy_*` returns in Y3 (his sit-down) and m110. `clemantine_bench` is the
Maker's bench in the Sculpture Garden (her Friday flowers).
**Around it.**
- RADIO (Joy, a rare turn on the mic): Somebody brought me shea butter. That's all. Back to Kabiru. [v: ]
- RADIO (Kabiru): The Love Garden lamps are off. Couples, please sit at a respectable distance. Two phones. [v: ]
- WALKER: Sadiq spoke to a girl? Sadiq? Speaks? [v: ]
- WALKER: The Maker's been gone three days. Even the Love Garden is dark. Romance is suffering. [v: ]
- PHONE (Sadiq, message): Toh. Thank you. Both sleeves. [v: ]

---

### m29 — Night market
- Semester 2 · Gate 22 · Shape: defend · Giver: Hajiya Ladi · Thread: W
- Places: Samaru Market, the gate road, KB's shop · Time: night · Weather: dry, dusty
- Needs: m28; `maker_away` still on; fights with friends helping; bystanders (fight audience)
- Music: `motif_market` (dark), `fight_light`, `sting_win`

**Premise.** With the Maker gone four days and the market dark at night, a gang of older boys calling
themselves "the levy" are going stall to stall, collecting a "light fee" for lamps that don't exist.

**Why now.** The dark makes people afraid; afraid people pay. Hajiya Ladi will not pay.

**Beats**
1. [talk: ladi] Talk to Hajiya Ladi at her stall. She is counting money without looking at it.
   - HAJIYA LADI: Light fee. Light fee! For which light? There is no light. Last price: zero. [v: ]
   - HAJIYA LADI: They come at nine. My traders are scared. I am not scared. I am annoyed. [v: ]
2. [talk: muktar at market] Muktar arrives with a clipboard and the hall's emergency lanterns.
   - MUKTAR: Point of order. If there's no light, we make light. Lanterns. Every third stall. [v: ]
3. [switch: Muktar] Swap to Muktar to organise the traders into a lantern line while you carry lanterns
   to the far end. (Muktar's ability: organise a crowd.)
   - MUKTAR: Hajiya, lantern one. Mama, lantern two. No, don't argue. It's minuted. [v: ]
4. [turn] At nine, five boys with sticks walk in from the gate road. Their leader taps a trader's
   table with a bat. Then he sees you.
   - LEVY BOY: Fresher. You're in the wrong market. Light fee. ₦1,000. Or go home. [v: ]
   - BATURE: Riddle me this: what charges for light and brings none? …You. Sorry. It's a riddle. [v: ]
5. [fight: bully ×5] Chase the levy boys out of Samaru Market. They started it. (Stick, slipper, bat.)
   Friends come: Bolaji from the left, Jega from the right with a football, Khalid behind you.
   - BOLAJI: Sly heard a fee! Sly has a fee too! It's called leave! [v: ]
   - JEGA: Head's up! (He heads the ball into the leader's chest. It is perfect.) [v: ]
   - CROWD: ★ Gbas gbos! [v: ]
   - CROWD: I'm recording! [v: ]
6. [talk: levy leader] He is on the ground, unhurt, embarrassed. He gets up and dusts off.
   - LEVY BOY: Okay! Okay! We're going. It's just… nobody pays us when there's light. [v: ]
   - HAJIYA LADI: Then go and find work for when there is light. Go. [v: ]
7. [job ×2] Help the traders catch up: complete two market jobs (carry, deliver).
   - TRADER: You chased them and now you're carrying my onions? Who raised you? [v: ]
8. [eat] Hajiya insists you eat before you go.
   - HAJIYA LADI: Sit. Eat. You fought for my market. I feed whoever fights for my market. [v: ]

**More beats**
3a. [switch: Khalid] Swap to Khalid to carry a fallen stall back onto its legs while the traders
   watch. (Khalid's ability: carry the heavy thing.)
   - KHALID: I've got it. No, I've got it. Yes, I'm sure. It's heavy. I've got it. [v: ]
   - TRADER: That boy is a forklift. Who is his mother? I want to thank her. [v: ]
5a. [look: bystanders] The fight has an audience. Some film, some laugh, one old woman throws
   a slipper at the levy leader from her stall.
   - OLD WOMAN: And don't come back! I've been throwing slippers since your father was a levy boy! [v: ]
   - CROWD: ★ Faaa! [v: ]
   - CROWD: Emotional damage! [v: ]
6a. [talk: jega] Jega picks up his football and kisses it.
   - JEGA: The ball never misses. I miss. The ball never. [v: ]
   - BATURE: Riddle me this: who is Jega's girlfriend? [v: ]
   - JEGA: IDK. [v: ]
   - BATURE: You don't know? [v: ]
   - JEGA: No. IDK. [v: ]
7a. [talk: kb] Back at KB's shop, the torch batteries have gone up in price.
   - KB: For your face today, ₦800 a battery. The dark is expensive. I don't make the rules. [v: ]
   - PLAYER: You do make the rules. It's your shop. [v: ]
   - KB: Then the rules are expensive. [v: ]
8a. [quiet] The lantern line glows down the market. It's not light. It's people choosing to stay.
   - MUKTAR: This should be minuted. I'll minute it. "Tonight, the market stayed." [v: ]
   - HAJIYA LADI: Minute that I paid zero. Underline it. [v: ]

**Choice.** After the fight: "Let the levy boys work the lantern line for a week" (Community +4;
two of them become stall helpers you see later) / "Report them to Sgt. Bilkisu" (Street +2, Community
+1; Madam Whistle walks them off, whistling).

**If it goes wrong.** Knocked down: quick get-up (light damage); friends hold the line and the fight
resets from beat 5. Hitting a trader by accident: they shout, the crowd gasps, heat +1; the mission
continues. Nobody is badly hurt; nobody dies.

**Rewards.** ₦3,000, 1,300 XP, Community +4, Street +3. Friendship: Hajiya Ladi +6, Muktar +4, Jega +3,
Bolaji +3, Khalid +3. Item: lantern. Unlocks m30.
**Sets / pays.** Sets `levy_gone`, `lantern_line`, `levy_helpers` or `levy_reported`, `kb_battery_price`.
Pays m7 (fresher tax: the same tactics, older boys). `kb_battery_price` is a joke now; from Year 2 KB's
prices are warnings (revealed m109).
**Around it.**
- RADIO (Kabiru): Samaru Market had no light and no levy tonight. One of those is good news. [v: ]
- RADIO (Kabiru): Jega headed a man. With a ball. I wasn't there. I'm still proud. [v: ]
- WALKER: Hajiya paid zero. Zero! She's a legend. I'm going to pay zero for everything now. [v: ]
- WALKER: An old woman threw a slipper so hard it came back. Like a boomerang. Respect. [v: ]
- PHONE (Hajiya Ladi, voice note): You have a stall in my heart. It's not for sale. [v: ]

---

### m30 — Signal from the sky
- Semester 2 · Gate 23 · Shape: flight · Giver: Captain Uche · Thread: M (light mission: every tenth)
- Places: Airfield, over the Dam, the Sculpture Garden, the Central Mosque, Samaru Market, Engineering
  Garden · Time: dusk · Weather: clear, warm wind · Needs: m29; aircraft licence (m18); aerial photo
  (photo mode from the air) · Music: `flight_open`, `motif_school` (full), `sting_maker_return`

**Premise.** Captain Uche wants a dusk flight "for the joy of it", a loop over the campus at the
golden hour. Bring a camera. She has a feeling about the view.

**Why now.** After a week of dark and fights, the school needs one beautiful evening. It is the tenth
mission; it is meant to feel like a day off. Then, from the air, you see something nobody on the
ground could.

**Beats**
1. [talk: uche] Talk to Captain Uche at the Flying Club.
   - UCHE: One loop. No tricks. No heroics. Joy only. That's an order. [v: ]
   - UCHE: Take Bature. He's never flown. I want to see his face. [v: ]
   - BATURE: My face is fine on the ground. My face prefers the ground. [v: ]
2. [ride: plane] Take the aircraft up. (Nose up at speed; gentle climb.)
   - BATURE: Riddle me this: why is the ground getting smaller? …Don't answer. I know. [v: ]
3. [flight: over the Dam] Fly over the Dam. The water is gold.
   - BATURE: It's beautiful. I'm going to be sick. Both. At the same time. [v: ]
4. [flight: over the Sculpture Garden] Fly over the Sculpture Garden. Take a photo.
5. [flight: over the Central Mosque] Fly over the Central Mosque at the call to prayer. Take a photo.
6. [flight: over Samaru Market] Finish over Samaru Market. Take a photo.
7. [turn] From up here, with the light low, you see the six spots you photographed on your first
   flight. Tonight four of them glow faintly, as if something under them is waking. And at the centre, the Senate, with a small shape on its weathervane.
   Then, below, the coil in the Engineering Garden flashes, once, twice, and stays on.
   - UCHE (radio): Are you seeing what I'm seeing? The garden. It's lit. [v: ]
   - BATURE: He's back! Riddle me this: who's back? HE'S BACK! [v: ]
8. [go: enggarden] Land and go straight to the Engineering Garden.
   The Maker is inside the fence, coat on, as if he had never left. The plate on the post is empty.
   - THE MAKER: You're out of breath. Sit down. [v: ]
   - PLAYER: Where were you? [v: ]
   - THE MAKER: Here. Mostly. Did the market hold? Good. Sit. [v: ]

**More beats**
1a. [talk: abdul] A Flying Club cadet salutes you, then Bature, then the plane.
   - ABDUL: Captain says you have a soft hand. I have a soft stomach. We're a good team. [v: ]
   - ABDUL: Check your flaps. Check your friend. He's green. [v: ]
3a. [look: below] The wooden stakes on the ridge above the Dam are tiny from up here, and someone has
   added two more since you were there.
   - BATURE: Look! The tower! Four stakes, six stakes. One day, a tower. In maybe fifty years. [v: ]
5a. [look: the mosque] The call to prayer rises to meet you. Uche goes quiet on the radio until it ends.
   - UCHE: Every evening, from up here. Best sound in the world. Sorry. Carry on. [v: ]
6a. [photo: the whole campus] Take a wide photo of the campus from above. It saves to the gallery with
   the date, the place, and the people present: you, Bature, a very small Senate.
7a. [look: the cape] When you look again at the weathervane, the shape is gone.
   - BATURE: Did you see a cape on the Senate? [v: ]
   - PLAYER: Yes. [v: ]
   - BATURE: Okay. Good. I thought it was just me. That's worse, actually. [v: ]
8a. [talk: maker] He looks at your photos for a long time. He stops at the one of the four places.
   - THE MAKER: A ring. Yes. Somebody drew that once. A long time ago. [v: ]
   - THE MAKER: Go. Eat. Asiya's plate is empty because I ate it. Don't tell her I said so. [v: ]
8b. [quiet] Outside the fence, Aunty Asiya is crying a little and pretending it is dust.
   - AUNTY ASIYA: Harmattan. In my eye. Both eyes. Go. [v: ]

**Choice.** None.

**If it goes wrong.** Too low or too fast near buildings: soft bounce and Uche's line ("Joy only, I
said!"); continue from the last place. Landing badly: one bounce, a cheer from the cadets, mission
continues. Nothing in this mission can be failed for good.

**Rewards.** ₦1,500, 1,000 XP, Vibes +3, Community +2. Friendship: Uche +4, Bature +4, the Maker +4,
Asiya +3. Photos saved to the gallery. Unlocks m31.
**Sets / pays.** Sets `maker_away` (off), `maker_back_1`, `ring_glow_seen`, `cape_seen_2`. Pays m18
(`six_spots_photo`). `maker_back_1` is never explained, by design; `ring_glow_seen` is paid in m32.
**Around it.**
- RADIO (Kabiru): The coil is back on! Engineering Garden lit! Somebody tell Asiya! [v: ]
- RADIO (Kabiru): Where did he go? Nobody knows. He came back. That's all I need. [v: ]
- WALKER: The light came back the same minute the plane passed. Coincidence. Probably. [v: ]
- WALKER: Bature says he flew. He's still green. He says it's his natural colour now. [v: ]
- PHONE (Uche, message): Joy only, I said. You followed orders. Mostly. Good flight. [v: ]

---

### m31 — The second eel
- Semester 2 · Gate 24 · Shape: boss (care) · Giver: Baba Dam · Thread: M
- Places: Samaru Market (kilishi), The Dam at night, the shallows, Engineering Garden
- Time: night · Weather: humid, a storm far off · Needs: m30; care step; dodge (marked strikes)
- Music: `place_dam_night`, `motif_eel` (full), `boss_water`, `sting_calm`

**Premise.** The thing in the water that pulled Baba Dam's net is a mother eel, very old and very
large. Since the Maker's absence, the shades have been gathering on her, and she is lashing at
anything near the pier. Baba Dam does not want her killed. He wants her calm.

**Why now.** The net (m27) showed someone is throwing things into her water. The shades followed. The
Maker is back; the Dam is not.

**Beats**
1. [talk: baba] Talk to Baba Dam at the pier. He is mending the net you cut.
   - BABA DAM: She's angry. Not at us. At the dark sitting on her back. [v: ]
   - BABA DAM: Bring kilishi. She likes it. Don't ask how I know. [v: ]
2. [buy: kilishi] Buy a kilishi pack at Samaru Market.
   - HAJIYA LADI: Kilishi for an eel? …The best one, then. An eel deserves respect. [v: ]
3. [go: dam, night] Go to the Dam at night. Baba Dam is on the pier with a lantern.
   - BATURE: Riddle me this: what's long, angry and in the water? Please say a boat. [v: ]
4. [defend: the pier, 90 s] She surfaces, coils round the end of the pier and strikes at the boards
   where the shades crowd. Her strikes are marked by ripples. Dodge them; push the shades off her
   with the torch. Do not hit her.
   - BABA DAM: Not her! The shades! Light on the shades! [v: ]
   - BOLAJI (arriving with the cricket bat): Sly is here! Which one do I hit? [v: ]
   - BABA DAM: Not the big one! [v: ]
   - BOLAJI: The big one is the only one I can see! [v: ]
5. [switch: Bature] Swap to Bature. He hates water. He walks to the end of the pier anyway, holds out
   the kilishi, and tells her a riddle. (Bature's ability: a joke that disarms a tense creature.)
   - BATURE: Riddle me this: what's old, wet, and too beautiful to be this angry? You. [v: ]
   - BATURE: That's not a riddle. That's a compliment. Please don't eat me. [v: ]
6. [turn] She stops. She takes the kilishi from his hand, very gently. The shades on her back fall
   away into the water like ink. She uncoils from the pier post, and where she was coiled, half in the
   mud, is a heavy iron drum with copper inside it.
   - BABA DAM: She wasn't attacking the pier. She was guarding that. All this time. [v: ]
7. [find: dynamo] Pick up what she was coiled around: an old dynamo, wrapped in rotted canvas
   stamped with the same burned T as the phone sack.
   - ABBAS: That's a generator core. Old. Hand-wound. Somebody built this. By hand. [v: ]
8. [talk: maker] Take the dynamo to the Maker.
   - THE MAKER: Mine. From before. I dropped it in the water thirty years ago. On purpose. [v: ]
   - PLAYER: Why? [v: ]
   - THE MAKER: So nobody would use it without me. The eel kept my promise better than I did. [v: ]

**More beats**
1a. [talk: baba] Baba Dam won't say her name.
   - BABA DAM: She has a name. It's long. It's in a language the water speaks. Not me. [v: ]
4a. [look: the bank] Students on the bank are filming. One is praying. One is eating puff-puff.
   - CROWD: ★ Omo! [v: ]
   - CROWD: Is that a snake? Is that a train? Is that a snake train? [v: ]
   - LYZZY: Nobody post this! …I'm posting it. [v: ]
6a. [look: her eyes] For one moment she looks at Bature, then at you. Then she sinks and is gone.
   - BATURE: She liked my riddle. An eel liked my riddle. I'm putting this on my CV. [v: ]
   - BOLAJI: Sly was very brave tonight. Sly will now go and sit down for a long time. [v: ]
7a. [look: the T] Abbas runs a thumb over the burned T.
   - ABBAS: Same mark as the phones. Somebody uses this water as a cupboard. [v: ]
   - BABA DAM: The water is not a cupboard. The water is a mother. Tell your somebody. [v: ]
8a. [talk: maker] He turns the dynamo over in his hands. For a moment he looks much younger.
   - THE MAKER: Someone I knew used to say the eel was the Dam's guard. I laughed. They were right. [v: ]
   - PLAYER: Who? [v: ]
   - THE MAKER: Go and sleep. You've been in the water. You smell like it. [v: ]
8b. [quiet] Walking home, the Dam is quiet. Two small lights on the surface, then gone.
   - BABA DAM (far behind): The water! [v: ]
   (He never says goodbye. Only "the water".)

**Choice.** None.

**If it goes wrong.** You hit the eel: she dives, the shades swarm the pier, and Baba Dam says "Not her.
Again. Gently." Retry from beat 4 the same night. Knocked into the water: you climb out wet, −10
energy, Bolaji laughing; continue.

**Rewards.** ₦2,500, 1,400 XP, Community +3. Friendship: Baba Dam +6, Bature +5, Bolaji +3, the Maker
+3. Item: dynamo (story). Unlocks m32.
**Sets / pays.** Sets `eel_friend`, `dynamo`, `sack_T_2`, `someone_i_knew`. Pays m27 (`eel_net`) and m14
(`eel_1`). From here the eel is an animal, never a monster again; from Year 4 she is a guardian (m90,
m95, m114). "Someone I knew" is left open on purpose; Year 1's only sister line stays in m11.
**Around it.**
- RADIO (Kabiru): A giant eel took kilishi from a student. If you see her, be polite. [v: ]
- RADIO (Kabiru): Bature has asked me to say he is "eel-certified". I don't know what that means. [v: ]
- WALKER: Lyzzy posted the eel. Forty thousand views. The eel is more famous than me. [v: ]
- WALKER: Baba Dam says the eel is a mother. My mother is also long and angry. Respect. [v: ]
- PHONE (Bolaji, voice note): Sly does not fear eels. Sly respects eels. From a distance. Goodnight. [v: ]

---

### m32 — Six plaques
- Semester 2 · Gate 25 · Shape: collect · Giver: the Maker · Thread: M
- Places: Engineering Garden, EE department, Chemical Engineering, Physics, electrical workshop,
  mechanical workshop · Time: day · Weather: clear · Needs: m31; workshops (wood, copper, parts);
  class flow · Music: `motif_maker`, `workshop_day`, `sting_reveal` at the plaques

**Premise.** The Maker has the dynamo. To use it he needs three more things: a perfect answer, copper
winding and a spark gap. And once the coil is opened, you see what is written round its base.

**Why now.** The ring seen from the air (m30) was not imagined. The Maker has decided you can know a
little more.

**Beats**
1. [talk: maker] Talk to the Maker. He has drawn a circuit in the dust with a stick.
   - THE MAKER: The dynamo works. The coil doesn't, with it. It needs three things. [v: ]
   - THE MAKER: An answer. Copper. A gap for the spark to jump. In that order. [v: ]
2. [class: ee, pass 5] Get all five right in an EE class. (The answer he needs is in the lecture.)
   - SHAMSU: Five out of five? Sit by me. Don't copy. Listen. That is the whole trick. [v: ]
   - DR. OKONKWO: Five out of five? In my class? Who are you and what have you done? [v: ]
3. [find: winding at chemeng] Find copper winding behind the Pilot Plant. It's in a skip behind the pilot
   plant, under a lot of things that are not copper.
   - FOREMAN IKENNA: Off before you touch. Always off. Even in a skip. Especially in a skip. [v: ]
4. [find: spark gap at physics] Find a spark gap near Physics. Prof. Bello has one on a shelf "for teaching".
   - BELLO: It's for teaching. Fine. Teach the coil. Bring it back. Don't bring it back. [v: ]
5. [switch: Abbas] Swap to Abbas in the electrical workshop to wind the copper onto the dynamo's
   core. (Abbas's ability: repair; a rhythm of turns.)
   - ABBAS: Count with me. One, two, three… Don't count. You're putting me off. [v: ]
   - IKENNA: John Carter can wind! Who knew? [v: ]
   - ABBAS: My name is Abbas. And I knew. [v: ]
6. [talk: maker] Bring the parts to the Maker. He opens the coil's base plate to fit them.
7. [turn] Under the base plate, round the old iron ring, six small brass plaques, green with age. Each
   has words on it. The Maker reads them aloud, slowly, as if he hasn't for a long time.
   - THE MAKER: "Where the first light was kept." That's here. [v: ]
   - THE MAKER: "Beneath the market, where people gather." [v: ]
   - THE MAKER: "The first laboratory." "Where the sky is watched." "Where the water is held." [v: ]
   - THE MAKER: "At the centre." [v: ]
8. [collect: plaque rubbings ×6 at enggarden] Make a rubbing of each plaque on paper for your phone gallery.
   - NUSAYBAH: Page forty's six circles. Now they have names. One here. Five out there. [v: ]
   - THE MAKER: Somebody did. Several somebodies. It didn't work. Then it did, a little. Here. [v: ]

**More beats**
1a. [talk: maker] He wipes the stick, then draws again, smaller.
   - THE MAKER: You'll want to know what it's for. Light. That's all. It's always just light. [v: ]
3a. [build: clear the skip] Haul wood and scrap out of the skip to reach the copper. The wood goes to
   the civil workshop pile "for the cliff".
   - KHALID: I'll carry the wood. Don't argue. [v: ]
   - ASABE (phone): More wood? Bless you. That's sixteen planks. Only one hundred and eighty-four to go. [v: ]
4a. [talk: tanko] Outside Physics, Tanko stops you again, as he did in the Sculpture Garden.
   - TANKO: What sits at the centre and is never sat on? [v: ]
   - PLAYER: I don't know. [v: ]
   - TANKO: Which? Still learning. Good. [v: ]
   (He hands you a riddle slip and walks away. It says only: "Count the plaques again.")
   - BATURE: He stole my job. My job is riddles. He's doing it wrong. Deeply. [v: ]
5a. [talk: foreman danjuma] In the mechanical workshop next door, Foreman Danjuma admires the core.
   - DANJUMA: Hand-wound. Old school. Measure, then measure your measure. Good. [v: ]
   - DANJUMA: I built the first campus keke from scrap. In this room. Don't tell the Senate. [v: ]
7a. [look: plaques] Count them again, as the riddle slip says. Six. You count again: six. The ring of
   iron has room for a seventh. There is nothing there. Just a clean space where something could go.
   - BATURE: Riddle me this: why does a ring of six have a seat for seven? …I don't know this one. [v: ]
   - THE MAKER: Neither do I. Put the plate back. [v: ]
8a. [quiet] The coil hums with the dynamo in it, steadier than before.
   - THE MAKER: One. Lit, a little. The others are dark. They've been dark a long time. [v: ]
   - NUSAYBAH: Then we light them. [v: ]
   - THE MAKER: You're a first year. [v: ]
   - NUSAYBAH: Yes. And? [v: ]

**Choice.** None.

**If it goes wrong.** Fewer than five in the EE class: Dr. Okonkwo offers a repeat at the next lecture;
the mission waits. Touching the winding without switching off: Ikenna's line, a small zap (−5 health),
and you try again.

**Rewards.** ₦2,000, 1,500 XP, Books +3, Department +3. Friendship: Abbas +4, Nusaybah +4, Ikenna +2,
Danjuma +2, the Maker +3. Items: plaque rubbings (gallery), Tanko's riddle slip (collectible 1).
Unlocks m33.
**Sets / pays.** Sets `plaques_six`, `ring_named`, `seventh_space`, `tanko_slip_1`, `cliff_wood_16`. Pays
m30 (`ring_glow_seen`), m5 (`logbook_p40`), m10 (`six_dots`) and m15 (`knows_ring`). Every coil mission pays `plaques_six`;
`seventh_space` is paid in m108 (Nusaybah notices the seventh plaque) and m116.
**Around it.**
- RADIO (Kabiru): Six plaques under the coil. Six places. If you know a seventh, keep it to yourself. [v: ]
- RADIO (Kabiru): An old man in a coat is giving out riddles. If he asks you one, say "Which?" [v: ]
- WALKER: Prof. Bello lent someone his spark gap. Prof. Bello never lends. Is the world ending? [v: ]
- WALKER: John Carter wound a whole dynamo. I saw it. He wouldn't let me count. [v: ]
- PHONE (Nusaybah, message): Six sites. I've marked them on the map. Wait. Look again. One is under the market. [v: ]

---

### m33 — School Marathon
- Semester 2 · Gate 26 · Shape: race · Giver: Coach Danladi · Thread: W
- Places: Racing Club, the whole campus: boulevard, gardens, hostels, Dam road, Phase 2 turn, back to
  the Senate · Time: early morning · Weather: harmattan, cool, dusty · Needs: m32; on foot (no
  vehicles) · Music: `race_long`, `motif_school`, `sting_win`

**Premise.** The School Marathon is the whole campus on foot. Coach Danladi's prize this year is a
generator, donated by the traders. You need it. The coil needs it. Everyone else needs it too.

**Why now.** The coil is lit "a little". To light it properly, the Maker needs steady power. A
generator would do.

**Beats**
1. [talk: danladi] Enter with Coach Danladi at the Racing Club.
   - DANLADI: Whole campus. On foot. No bicycles, no okadas, no skateboards. Bolaji. [v: ]
   - BOLAJI: Sly is not even holding a skateboard. …This is a tray. [v: ]
2. [race: school marathon] Run the School Marathon. Pace yourself: sprinting costs energy, and the
   course is long.
   - CROWD: No gree for anybody! [v: ]
   - LULA (three-legged with Faty): We're winning! We're not winning! We're together! [v: ]
   - FATY: Write that down! I can't, I'm running! [v: ]
3. [race: checkpoint 2, the Dam road] Keep going past the Dam. Baba Dam is at the water's edge.
   - BABA DAM: The water! [v: ]
4. [turn] At the far turn by the Phase 2 road you are empty: no energy, no water, and the next
   checkpoint is a kilometre away. A young man in a clean white shirt is standing alone by the road
   with a bottle of water, as if he was waiting for you.
   - MUHAMMAD: Excuse me. Sorry. Here. [v: ]
   - PLAYER: You again. Thank you. Who are you? [v: ]
   - MUHAMMAD: Drink. You're nearly there. [v: ]
   (When you look back, the road is empty. His shoes left no dust.)
5. [race: finish] Finish the School Marathon at the Senate.
   - JEGA (overtaking, walking backwards, counting): Forty-one, forty-two passes. Not you. Me. [v: ]
6. [talk: danladi] Collect the generator (or the runner-up prize).
   - DANLADI (win): Whole campus, on foot. The generator is yours. Don't sell it. [v: ]
   - DANLADI (lose): Second. Third. Fifth. You still finished. Here: Hajiya says take it anyway. [v: ]

**More beats**
1a. [talk: big baby] At the start line, Big Baby is holding a sign that says only "BOLAJI."
   - BIG BABY: Bolaji. [v: ]
   - BOLAJI: Yes, Baby. [v: ]
   - BIG BABY: No tray. [v: ]
   - BOLAJI: …No tray. [v: ]
2a. [talk: @roomie] Your roommate runs beside you for the first kilometre.
   - BATURE: Riddle me this: what has legs, no breath, and regrets? Me. Now. [v: ]
   - FIRDAUSI: I'll see you at the finish. I'm taking the shuttle. Joke. I'm running. Slowly. [v: ]
3a. [look: the gardens] The course passes the Sculpture Garden. Tunde is drawing the runners. He holds
   up a page as you pass: it's you, at the finish, arms up. You haven't finished yet.
   - TUNDE: Go! I already drew the end! Don't make me erase it! [v: ]
4a. [eat: emily's strawberry] At the Phase 2 turn, Emily is handing out strawberries.
   - EMILY: Strawberry? It's not water. It's better. It's a strawberry. [v: ]
5a. [look: the crowd] The whole school lines the boulevard. People you've helped shout your name:
   Emeka from the gate, Hajiya Ladi, Musa-from-nowhere, the old woman with the slipper.
   - OLD WOMAN: Run! Or I'll throw this! [v: ]
   - CROWD: ★ Waaa! [v: ]
6a. [quiet] At the Senate steps, flat on your back, the sky white with dust.
   - BATURE: Riddle me this: who gave you water? You said a boy. There was no boy. I was behind you. [v: ]
   - PLAYER: There was a boy. White shirt. [v: ]
   - BATURE: …Okay. I'm going to lie here too. For different reasons. [v: ]

**Choice.** None.

**If it goes wrong.** Out of energy before a checkpoint: you walk (slowly) and finish anyway; the
runner-up prize still includes the generator ("Hajiya says take it anyway"). Using a vehicle:
disqualified with Danladi's line; restart at the next Saturday's race.

**Rewards.** Win: ₦5,000, 1,600 XP, Street +4, Community +2. Finish: ₦1,500, 1,000 XP, Street +2.
Item: generator (both). Friendship: Danladi +3, Tunde +3, Emily +3, Bolaji +2. Unlocks m34.
**Sets / pays.** Sets `generator_won`, `muhammad_marathon`, `tunde_sketch_finish`. Pays m1 and m3
(`met_muhammad`, `met_muhammad_2`). The gentle stranger keeps appearing every year, in m114 and m120.
Never explained.
**Around it.**
- RADIO (Kabiru): The marathon! Bolaji disqualified for a tray. Lula and Faty disqualified for love. [v: ]
- RADIO (Kabiru): Did anyone see a boy in white handing out water at the far turn? Nobody? Okay. [v: ]
- WALKER: I ran the marathon. I'm a different person now. A tired person. [v: ]
- WALKER: Tunde drew the winner before the race. He's not allowed to draw the exam results. [v: ]
- PHONE (Mum): Your father says don't run so much. You'll finish your shoes. Have you eaten? [v: ]

---

### m34 — Everybody
- Semester 2 · Gate 27 · Shape: social · Giver: the Maker · Thread: F
- Places: The Dam, the Airfield, Mama Nkechi's buka, Radio Studio, the Senate, Samaru Market, KB's
  shop, @hostel, the court · Time: one long day · Weather: harmattan · Needs: m33; companions with
  skills; gifts (listened) · Music: `motif_school` building one layer per person who says yes

**Premise.** The Maker has a generator, a dynamo and a coil that hums. He says that on convocation
night, when the seniors graduate and the whole campus lights up, the dark will come for the light.
He can't hold it alone. You will need everybody.

**Why now.** The parts are in place. What's missing is people. It always was.

**Beats**
1. [talk: maker] Talk to the Maker.
   - THE MAKER: Convocation night. Every light on campus, all at once. The dark notices that. [v: ]
   - THE MAKER: I can't hold it alone. I tried. For a long time. Ask everybody. [v: ]
   - PLAYER: Everybody who? [v: ]
   - THE MAKER: Everybody you've helped. You'll find it's more than you think. [v: ]
2. [talk: baba] Ask Baba Dam to watch the water.
   - BABA DAM: She'll watch. I'll watch her watch. The water hears. [v: ]
3. [talk: uche] Ask Captain Uche to watch from above.
   - UCHE: One loop at dusk, one at midnight. If the dark comes from the north, I'll radio. [v: ]
4. [talk: nkechi] Ask Mama Nkechi to feed the crew.
   - MAMA NKECHI: Feed them? I'll feed them till they cry. You, sit. You're thin. [v: ]
5. [talk: kabiru] Ask DJ Kabiru to stay on air all night.
   - KABIRU: All night? On air? With my voice? …Yes. Obviously yes. I was born for this. [v: ]
6. [turn] At the Senate, Malam Garba refuses. Convocation is the Senate's night; there will be no
   "crowd of students and an old man with a coil" anywhere near his steps.
   - MALAM GARBA: No. The Senate is not a stage. This is a convocation, not a carnival. [v: ]
7. [switch: Aleeya] Swap to Aleeya to persuade Malam Garba. (Aleeya's ability: persuade.)
   - ALEEYA: Malam, you've kept every file for thirty years. You remember everyone. [v: ]
   - ALEEYA: Do you remember a student who stayed behind? Who never got his file? [v: ]
   - MALAM GARBA: …I remember. [v: ]
   - MALAM GARBA: Fine. The steps are yours from midnight. Not one minute before. [v: ]
8. [talk: garba] Tell Malam Garba it is tonight.
   - MALAM GARBA: Tonight. Hm. I'll leave the side door open. I never leave it open. Tonight. [v: ]

**More beats**
2a. [give: gift] If you listened earlier, bring Baba Dam hooks (he mentioned them); he gives you a
   lucky fishing knot for your backpack. Otherwise he just nods.
5a. [talk: kb] KB, asked to stock torches and batteries for the night, prices by mood.
   - KB: For everybody? For the school? …Cost price. Don't tell anyone. My reputation. [v: ]
5b. [switch: KB] Swap to KB to get the one thing nobody can find: forty candles at midnight.
   (KB's ability: trade for the impossible item.)
   - KB: Chi-Tech owes me. Hajiya owes me. Chi-Tech owes Hajiya. Circle. Forty candles. Done. [v: ]
6a. [talk: muktar] Muktar arrives with the hall committee, in matching T-shirts that say "EVERYBODY".
   - MUKTAR: Point of order. We printed shirts. We didn't know what for. It felt right. [v: ]
6b. [talk: lula and faty] Lula and Faty volunteer as "morale".
   - LULA: We'll stand at the back and make everyone laugh. That's our weapon. [v: ]
   - FATY: And I'll write down everyone who came. In the book. Page eleven. [v: ]
7a. [talk: jega] Jega and the hall football team offer to stand at the Senate's corners.
   - JEGA: We go again. Whatever it is. Left boot first. [v: ]
   - BATURE: What's IDK's name? [v: ]
   - JEGA: IDK. [v: ]
8a. [talk: bolaji] Bolaji, Abbas and Hassan at the court.
   - BOLAJI: Sly will hold the coil. Sly and John Carter. [v: ]
   - ABBAS: Abbas. [v: ]
   - HASSAN: Oga Sly said— I forgot what he said. We're coming. [v: ]
8b. [quiet] At dusk you walk back to the garden. Behind you, one by one, people fall into step.
   - THE MAKER: I said everybody. I didn't believe it. Hm. Sit. Eat Mama Nkechi's food. [v: ]

**Choice.** None. Who stands where tonight depends on the friendships you've built: anyone above
"Friend" joins; anyone below sends a message instead ("I'll pray for you", "I'll watch on the radio").

**If it goes wrong.** A person refuses (low friendship): they send a line by phone and the mission
continues; the finale is only a little emptier. Missing Garba's yes: Aleeya tries again at dusk.

**Rewards.** ₦2,000, 1,500 XP, Community +5, Vibes +2. Friendship: +2 with everyone who says yes,
Aleeya +5, Malam Garba +4. Unlocks m35.
**Sets / pays.** Sets `everybody_*` (one flag per person), `garba_side_door`, `everybody_shirts`,
`faty_page_11`. Pays m16 (gather the crew). `everybody_*` is paid in m108 and m112–m114; `garba_side_door`
in m103 (the Senate heist) and m116.
**Around it.**
- RADIO (Kabiru): Tonight I'm on air till sunrise. Bring snacks. Bring friends. Bring candles. [v: ]
- RADIO (Kabiru): KB is selling candles at cost price. I repeat. KB. Cost price. Check the sky. [v: ]
- WALKER: Everybody's going to the garden. I don't know why. I'm going. [v: ]
- WALKER: Malam Garba left a door open. I've been here three years. That's a first. [v: ]
- PHONE (Asiya, message): He ate supper. Two plates. Whatever you're doing, keep doing it. [v: ]

---

### m35 — Blackout protocol
- Semester 2 · Gate 28 · Shape: defend · Giver: Sgt. Bilkisu · Thread: M
- Places: Fire Station (substation), Radio Studio, the boulevard between them · Time: night · Weather:
  harmattan wind · Needs: m34; the generator (m33) · Music: `tension_mid`, `defend_light`, `radio_on_air`

**Premise.** Three nights before convocation, the whole grid fails. Sgt. Bilkisu calls it a blackout
protocol: hold the Fire Station substation until the Works crew can switch over, and keep the radio
on air so the campus knows what to do.

**Why now.** The dark has noticed the plan. It is testing the edges.

**Beats**
1. [talk: bilkisu] Answer Sgt. Bilkisu's whistle at the gate.
   - BILKISU: Blackout protocol! Two places. Substation and radio. Everybody else, inside. [v: ]
   - BILKISU: You. You're not inside. You never are. Fine. Fire Station. Go. [v: ]
2. [go: fire, night] Get to the Fire Station at night with the generator on a handcart.
   - KHALID: I'll push. You steer. Don't argue. [v: ]
3. [defend: fire station, 120 s] Hold the Fire Station while the generator warms up. The shades come
   in waves along the fence. Torch, bat, light.
   - BOLAJI: Sly has a bat and a grudge! [v: ]
   - ENGR. ALIYU (inside, shouting): I only switched it over! I'm switching it back! Wait! [v: ]
4. [go: radio, night] Run to the Radio Studio. Kabiru is on air by candlelight.
   - KABIRU (on air): If you can hear me, you have batteries. Congratulations. Stay inside. [v: ]
5. [turn] The studio's transmitter dies mid-sentence. The campus goes quiet in a way you can hear.
   - KABIRU: No. No no no. If the radio stops, people panic. People panic, people go out. [v: ]
   - KABIRU: People go out, the dark gets them. Fix it. Somebody fix it. [v: ]
6. [switch: Abbas] Swap to Abbas to bridge the transmitter to the generator's spare line.
   (Abbas's ability: repair.)
   - ABBAS: Hold the torch. Higher. In front of me, not in my soul. [v: ]
   - BOLAJI (outside): John Carter, hurry! The shades are queueing! [v: ]
7. [defend: radio studio, 120 s] Keep Samaru FM on air while Abbas works.
   - KABIRU (back on air): We're back! Thanks to a man called… [v: ]
   - ABBAS (off mic): Abbas. [v: ]
   - KABIRU (on air): …John Carter! [v: ]
8. [talk: kabiru] Check on DJ Kabiru when the grid comes back at dawn.
   - KABIRU: I talked for nine hours. My voice is gone. My heart is full. Is that a song? [v: ]

**More beats**
1a. [talk: bilkisu] Madam Whistle blows the whistle at Bature for standing still.
   - BILKISU: You! Why are you standing like a lamp post? Move or light up! [v: ]
   - BATURE: Riddle me this: what's loud, round and— [v: ]
   - BILKISU: Don't finish that riddle. [v: ]
3a. [look: the fence] For a moment, along the fence, the shades seem to stand in a line, then a shape
   behind them, taller, with something that might be a cape. Then it's gone.
   - BOLAJI: Sly saw nothing. Sly wants to go home. Sly is staying. [v: ]
5a. [talk: kabiru] While the transmitter is down, he asks you to talk to the campus through a
   megaphone from the studio roof, so nobody comes out.
   - PLAYER (megaphone): Stay inside! It's fine! Mostly! [v: ]
   - CROWD (far off): ★ Eh eh eh. [v: ]
7a. [switch: Bolaji] Swap to Bolaji to hold the studio door while the shades push. (Bolaji's strength.)
   - BOLAJI: This door is closed. Sly has decided. [v: ]
8a. [quiet] Dawn. You sit on the studio steps. Joy brings tea. Sadiq is with her.
   - JOY: You kept us on air. Here. Tea first. Then talk. That's what Mai Shayi says. [v: ]
   - SADIQ: Toh. Both sleeves. [v: ]
   (He's wearing a fully ironed shirt.)

**Choice.** At dawn, Engr. Aliyu asks you not to mention he "switched over" the wrong line at the
start. "Keep it between us" (Street +2; he owes you, which he pays in Year 2) / "Tell Bilkisu"
(Community +2; Bilkisu gives him a talking-to and a whistle in the ear).

**If it goes wrong.** The substation falls: the campus goes fully dark for the rest of the night, Kabiru
runs on batteries, and you retry the substation at the next blackout (phone: "Wait for the next
blackout"). The radio falls: same; nobody is hurt.

**Rewards.** ₦3,000, 1,700 XP, Community +4, Street +2. Friendship: Kabiru +5, Abbas +4, Bilkisu +3, Joy
+2, Sadiq +2. Unlocks m36.
**Sets / pays.** Sets `radio_held`, `substation_held`, `aliyu_owes` or `aliyu_told`, `cape_seen_3`. Pays
m4 (they have taken light) and m25 (`kabiru_tin`: the biscuit tin survived). `aliyu_owes`/`aliyu_told`
is paid in m51 (Aliyu "now" or "in the morning").
**Around it.**
- RADIO (Kabiru, croaking): Nine hours. Thank you, campus. Thank you, John Carter. Thank you, tea. [v: ]
- RADIO (Kabiru): Three days to convocation. Seniors, iron your gowns. Freshers, iron something. [v: ]
- WALKER: The radio stopped and I heard the silence. Never again. Talk forever, Kabiru. [v: ]
- WALKER: Madam Whistle whistled at a shade. The shade left. Respect. [v: ]
- PHONE (Bilkisu, message): Blackout protocol complete. You were not inside. Noted. Well done. [v: ]

---

### m36 — Convocation night
- Semester 2 · Gate 30 · Shape: boss · Giver: the Maker · Thread: M · Year 1 finale
- Places: Engineering Garden, the boulevard, the Senate steps, the Selfie Garden · Time: night into
  dawn · Weather: clear, harmattan stars · Needs: m35; generator, dynamo, coil; everybody (m34)
- Music: `motif_school` (all layers), `boss_entropy`, `sting_coil_1`, `party_convocation`, `sting_dawn`

**Premise.** Convocation night. The seniors graduate; every light on campus goes on at once; and Count
Entropy, fully grown on a year of the school's fear, stands on the Senate steps. Behind you, the whole
school.

**Why now.** Everything you did this year was to get to this night with enough light and enough people.

**Beats**
1. [talk: maker] Meet the Maker at the coil. He has put on a clean lab coat.
   - THE MAKER: Tonight we start the resonator. It will take a while to sing. Keep them off it. [v: ]
   - THE MAKER: When it sings, the light goes where it's needed. Follow it. [v: ]
2. [go: enggarden, night] Start the resonator at the Tesla coil. (Hold to spin up; release at the hum.)
   - NUSAYBAH: Wait. Look again. The pitch is rising. That's correct. Keep going. [v: ]
3. [defend: the coil, 150 s] Protect the coil while it spins up. Shades from every side.
   Your friends hold their corners (whoever said yes in m34): Bolaji and Abbas at the coil, Jega's team
   at the hedges, Muktar's committee with lanterns, Lula and Faty at the back being morale.
   - BOLAJI: Sly and John Carter! Holding the light! [v: ]
   - ABBAS: Abbas! Holding the light! [v: ]
   - LULA: Everybody laugh! The dark hates laughing! I read it somewhere. [v: ]
   - CROWD: ★ Gbas gbos! [v: ]
4. [switch: any companion] Swap freely between yourself and whoever is beside you to cover the coil's
   four sides. (Bature jokes, Bolaji holds, Abbas repairs a cable, Jega heads a ball at a shade, Khalid
   carries the generator closer, Aleeya keeps the crowd calm.)
   - BATURE: Riddle me this: what's afraid of the dark? …Not us. Not tonight. [v: ]
5. [turn] The coil sings. Lightning leaps from its crown, but not at the shades: it arcs away across
   the campus, lamp to lamp, toward the Senate. The shades turn and follow it.
   - THE MAKER: There. It's found him. Follow the light. Go! [v: ]
6. [go: senate, night] Follow the lightning to the Senate. The boulevard lamps blaze as you pass.
   The seniors in gowns stand back on the lawn. The Count is on the steps: taller than last time, a
   cape that moves without wind, and a face you almost recognise.
7. [fight: entropy] Defeat Count Entropy, for tonight. (He never speaks. Dodge the marked sweeps; keep
   your friends' lights on him; the coil's lightning strikes where you point.)
   - CROWD: ★ Waaa! [v: ]
   - JEGA: We go again! [v: ]
   - ALEEYA (to the crowd): Phones up! Torches up! Everybody! [v: ]
8. [talk: garba] When the Count breaks into dark and is gone, talk to Malam Garba on the steps.
   - MALAM GARBA: Thirty years I've stood on these steps. Never seen that. Never want to again. [v: ]
   - MALAM GARBA: Go and dance. Fresher no more. [v: ]
9. [emote: dance, at selfie] Dance under the giant letters in the Selfie Garden.
   - KABIRU (on air, live): The coil is lit! The first light! Up NEPA! Up everybody! [v: ]

**More beats**
1a. [talk: asiya] Aunty Asiya brings the Maker a plate and, for the first time, puts it in his hands
   instead of on the post.
   - AUNTY ASIYA: Eat before you save the world. You'll save it better. [v: ]
   - THE MAKER: …Thank you. [v: ]
3a. [look: the hedges] Wednesday is standing by the hedge with her umbrella open. It is not raining. It
   is not Wednesday.
   - WEDNESDAY: I know. I came anyway. Don't make it a thing. [v: ]
3b. [switch: Khalid] Swap to Khalid to carry the generator three metres closer when the cable runs
   short. (Khalid's ability: carry.)
   - KHALID: I've got it. I've got it. I've got it. [v: ]
6a. [look: the seniors] A senior in a gown, mortar board crooked, salutes you as you run past.
   - SENIOR: Fresher! Is this convocation or a film? [v: ]
   - BATURE: Both! Riddle me this: what's both? This! [v: ]
7a. [look: the face] Halfway through, the Count's face turns toward you in the light. For a moment it
   is made of things you recognise: the fear of the registration queue, the first blackout, the
   court, the dark Dam. Then it is just a mask again.
7b. [switch: Bature] Swap to Bature for the last strike. He stands in front of the Count and does the
   bravest thing he knows.
   - BATURE: Riddle me this: what's big, dark and scared of a fresher? [v: ]
   - BATURE: You. You are. Look at you. [v: ]
   (The coil's lightning lands where he points.)
8a. [talk: audu] Mai Shayi Audu is on the Senate lawn with his kettle, pouring tea for the seniors.
   - AUDU: Tea first. Then talk. [v: ]
   - AUDU: You know who gave that thing a cape? Us. First years. Long ago. We were scared. [v: ]
   - AUDU: So we drew it a face. It kept the face. Fear keeps whatever you give it. [v: ]
8b. [look: the weathervane] Look up at the Senate. On the weathervane, in the coil's light, a small
   shape with a cape, very still. Then the light shifts and it's gone. Or it isn't. It's hard to say.
   - BATURE: Riddle me this: is it gone? …Don't answer. Let's dance. [v: ]
9a. [talk: faty] Faty, in the Selfie Garden, writes by coil light. Lula is beside her.
   - FATY: Page twelve. "Tonight, everybody came." [v: ]
   - LULA: And a joke. Write a joke. [v: ]
   - FATY: That was the joke. Nobody thought everybody would come. [v: ]
9b. [talk: maker] At dawn, the Maker is still at the coil. It is singing softly, one steady note.
   - THE MAKER: One. That's one. There were meant to be six. [v: ]
   - PLAYER: Then we find the other five. [v: ]
   - THE MAKER: You're still a first year. [v: ]
   - PLAYER: Not for long. [v: ]
   - THE MAKER: …No. Not for long. Go and sleep. I'll keep it on. For tonight. [v: ]
9c. [quiet] Walk back to the hostel at sunrise with your roommate. Every lamp on the boulevard is on,
   though the sun is up. Nobody has switched them off.
   - BATURE: Riddle me this: what do you call a fresher who lit a coil? …Second year. Almost. [v: ]
   - FIRDAUSI: Next year we'll be stalites. Returning light. Malam Garba will love that. [v: ]
   - @ROOMIE: Go and sleep. I'll keep your garri safe. Half of it. [v: ]

**Choice.** None.

**If it goes wrong.** The coil is overrun: the resonator slows, the Maker says "Again. They're tired
too," and the defence restarts from beat 3 with your friends' health restored. Knocked out by the Count:
a quick get-up on the steps beside Malam Garba ("Up. The seniors are watching."); the fight resumes.
Nobody dies; nobody is lost.

**Rewards.** ₦10,000, 3,000 XP, every standing +3. Friendship: +3 with everyone present; the Maker +6.
Item: "Everybody" shirt. Prosperity: the first coil lit raises every district to tier 1 at the start of
Year 2 (fresh paint on the boulevard). Unlocks m37 (Year 2) after the break.
**Sets / pays.** Sets `year1` (replaces the old `graduate` flag; saves that have `graduate` are treated
as `year1`), `coil1`, `count_tonight`, `cape_still_watching`, `faty_page_12`, `asiya_plate_hand`. Pays
m17 (`count_face_1`, `count_invented_hint`), m23 (the hum: the resonator), m31 (dynamo), m32 (`plaques_six`), m33 (generator), m34
(`everybody_*`), m35 (`radio_held`). The Year 1 twist is spoken here (Audu): the Count's face was the
freshers' own invention, and it is still watching. `cape_still_watching` recurs all five years.
`coil1` is relit in m113. The Count does not appear again until m109.
**Around it.**
- RADIO (Kabiru): Convocation night. The seniors graduated. The freshers lit a coil. Everybody danced. [v: ]
- RADIO (Kabiru, dawn): Good morning. The lamps are still on. Nobody touch them. Let them have this. [v: ]
- WALKER (senior, in a gown): I graduated and a fresher stole my night. Best night of my life. [v: ]
- WALKER: Did you see the cape on the weathervane? After? …No? Good. Me neither. [v: ]
- PHONE (Mum): I saw a video. Was that you? With the lightning? Have you eaten? Come home. [v: ]
- PHONE (Dad): Your mother saw a video. Results? …Also, well done. Your mother says I must say it. [v: ]

---
