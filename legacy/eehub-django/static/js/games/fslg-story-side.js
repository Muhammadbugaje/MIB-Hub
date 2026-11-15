/* Freshers School Life — side missions s1–s50 and ambient encounters e1–e31.
   Sources: docs/story/scripts/SIDE.md and AMBIENT.md. Format: docs/story/ENGINE.md (§1, §2, §9). Data only.
   Voice ids are positional and stable: SD-sNN-KK (side mission NN, Kth spoken line), AM-eNN-vX-KK (encounter NN,
   variation X), AM-eNN-dc-01 (decline line), AM-eNN-th-X (thanks). Do not reorder lines without regenerating the
   voice script.

   Forced changes, with reasons (the writing itself is as scripted):
   - Places the map does not have are mapped to the nearest real id: Bursary/Registry → senate; post office counter
     → mk_gifts; Page Turner Books → mk_books; Sly's Cuts → mk_barber; The Floor → mk_dance; Chi-Tech and Bright
     Electricals → mk_electronics; Needle & Thread → mk_native; Game Room → mk_arcade; Racing Club → club;
     radio studio → radio; Mr. Ezekiel's house → quarters; the forest edge → checkpoint.
   - Script counts become steps the engine supports: "[buy ×6]" → six buy steps; "[talk ×3]" → three talk steps;
     "[escort ×6]" → six escort steps; "[find ×3]" → three find steps; "[routine ×6]" → a six-block routine.
   - Script step types the engine has no type for use the nearest one, and the gap is logged in ENGINE_ISSUES.md:
     prank → buy/talk/look; job (shift) → social; race on foot after a goat → tail Sgt. Bilkisu; hostel washing
     lines → go ×3 + find; routine on a bicycle (s18) → ride + look; knots (s29) → social sitting; shuttle route
     (s44) → go to five stops; the Sick Bay visit (s47) → buy + talk + social.
   - Absolute clock limits ("before four", "an hour before the final") become `limit` seconds of play.
   - s47's giver "@faithplace" is Pastor Sam at the chapel (he and Ustaz Auwal run the visit together, as in s46).
   - Encounters use three tokens the contract does not list yet ($who = the person who called out, $here = where
     it happened, $other = a second walker spawned nearby). Logged in ENGINE_ISSUES.md.
   - "Company" encounters (wait with me, watch my bag, cheer, take our picture, sit with me) use kind "escort"
     with look/watch/social steps; a "company" kind is requested in ENGINE_ISSUES.md.
   - Standing tracks follow the engine names: Books → academics, Vibes → social.
   - Side missions offered "from Act N" need the first mission of that year done (Act 2 m37, Act 3 m58,
     Act 4 m79, Act 5 m100).
   - The bible's fight bystander table (section 13) is included as `bystanders` for the crowd code. */
(function () {
  "use strict";
  var root = typeof window !== "undefined" ? window : globalThis;
  var D = root.SamaruData || (root.SamaruData = {});
  D.STORY = D.STORY || [];

  function L(who, text) { return [who, text]; }
  function st(t, o, text, lines) { var s = { t: t, text: text }; for (var k in o) s[k] = o[k]; if (lines && lines.length) s.lines = lines; return s; }
  function turn(lines, text) { return { t: "turn", text: text || "", lines: lines || [], turn: true }; }
  var ACT = { 1: null, 2: "m37", 3: "m58", 4: "m79", 5: "m100" };
  function sm(id, title, act, giver, where, shape, music, intro, steps, reward) {
    return { id: id, side: true, repeat: false, year: act, title: title, giver: giver, where: where, shape: shape, music: music,
      intro: intro, need: ACT[act] ? { done: [ACT[act]] } : {}, steps: steps, reward: reward };
  }

  /* ---------- people the side missions and encounters need (skipped if another file already has them) ---------- */
  function P(id, name, role, at, skin, hair, top, voice, pitch, hi, extra) {
    var o = { id: id, name: name, role: role, at: at, skin: skin, hair: hair, top: top, voice: voice, pitch: pitch, hi: hi };
    for (var k in (extra || {})) o[k] = extra[k]; return o;
  }
  var npcs = [
    P("firdausi", "Firdausi", "Roommate", "amina", "#c99468", "hijab", "#fde68a", "female", 1.1, ["Roomie! You're back.", "Did you eat? Eat.", "That radio again…"], { hairCol: "#0e7490" }),
    P("abdul", "Abdul (AB)", "Flying Club cadet", "strip", "#6a4127", "low", "#e0f2fe", "male", 1.0, ["Checklist first.", "Wind is from the east today.", "AB. Just AB."]),
    P("basit", "Basit", "Game Room attendant", "mk_arcade", "#7a4a2b", "fade", "#22d3ee", "male", 1.05, ["Coins at the counter.", "Don't bang the machine.", "One more game, then I close."]),
    P("jasmin", "Jasmin", "Basit's sister", "quarters", "#85532f", "braids", "#f9a8d4", "female", 1.3, ["Is Basit coming?", "I made a card.", "Hello!"]),
    P("maryam", "Maryam", "Writer", "mk_books", "#c48f65", "hijab", "#ddd6fe", "female", 1.05, ["Have you read the boards today?", "Every place here is a story.", "Shh, I'm thinking."], { hairCol: "#6d28d9" }),
    P("micheal", "Micheal", "Drama Club director", "theatre", "#5e3a22", "afro", "#f97316", "male", 1.0, ["Projection! From the belly!", "Everyone is an actor.", "Rehearsal at six."], { romance: "f" }),
    P("joy", "Joy", "Student", "radio", "#7d4e2e", "braids", "#fef3c7", "female", 1.1, ["Hi.", "Nice night.", "Do you listen to the late show?"]),
    P("lucky", "Lucky", "Content creator", "selfie", "#6b4226", "fade", "#facc15", "male", 1.15, ["Smile, you're on camera!", "Like and follow.", "I need a story today."]),
    P("chitech", "Chi-Tech", "Phone repairer", "mk_electronics", "#5a361f", "low", "#334155", "male", .95, ["Screen or battery?", "Give me ten minutes.", "Everything can be fixed."]),
    P("ezekiel", "Mr. Ezekiel", "Lab technologist", "dept_elect", "#553320", "bald", "#f8fafc", "male", .8, ["Sign the book.", "Who touched my scope?", "Condemned? Hm."]),
    P("khadija", "Dr. Khadija", "Lecturer", "dept_elect", "#94603a", "hijab", "#f1f5f9", "female", .95, ["Office hours are for asking.", "Close the door, please.", "How is the project?"], { hairCol: "#1e293b" }),
    P("adebayo", "Mrs. Adebayo", "Registry officer", "senate", "#7a4a2b", "bun", "#c7d2fe", "female", .9, ["Photocopy?", "Next.", "Fill it in black ink."]),
    P("clement", "Mr. Clement", "Bank teller", "bank", "#6a4127", "low", "#1d4ed8", "male", .9, ["Network is slow.", "Next customer.", "Account number?"]),
    P("porter", "Baba Porter", "Hostel porter", "akenzua", "#4f301c", "cap", "#78716c", "male", .7, ["Bed space no dey.", "Sign the book.", "Lights out by twelve."], { hairCol: "#f8fafc" }),
    P("linus", "Mr. Linus (Baba Shuttle)", "Shuttle driver", "stop_gate", "#5e3a22", "cap", "#0f766e", "male", .85, ["Shift in, shift in!", "Next stop.", "Hold the rail."], { hairCol: "#0f172a" }),
    P("risi", "Iya Risi", "Phase 2 canteen", "p2canteen", "#7d4e2e", "bun", "#fb923c", "female", .85, ["Rice or beans?", "Sit down, eat.", "Last plate is covered."]),
    P("pastorsam", "Pastor Sam", "Chapel fellowship", "chapel", "#5a361f", "low", "#e2e8f0", "male", .9, ["God bless you.", "Saturday clean-up!", "Come and sit."]),
    P("auwal", "Ustaz Auwal", "Mosque fellowship", "mosque", "#8a5633", "cap", "#f8fafc", "male", .85, ["Assalamu alaikum.", "Insha Allah.", "Saturday, the Dam shore."], { hairCol: "#ffffff" }),
    P("sadiya", "Comrade Sadiya", "Student union", "senate", "#a06a42", "hijab", "#fecaca", "female", 1.0, ["Great students!", "Aluta continua!", "Sign the petition."], { hairCol: "#16a34a" }),
    P("jega", "Jega", "Hall football captain", "court", "#6b4226", "fade", "#16a34a", "male", 1.0, ["Final is on Saturday.", "We go win.", "Where are my socks?"]),
    P("aminu", "Aminu", "Fresher", "gate", "#85532f", "low", "#bfdbfe", "male", 1.2, ["Is this the Senate?", "I just got admission!", "Which way?"]),
    P("bilkisu", "Sgt. Bilkisu (Madam Whistle)", "Campus security", "gate", "#6b4226", "hijab", "#1e3a8a", "female", .9, ["Walk, don't run.", "I am watching.", "Pheeep!"], { hairCol: "#1e3a8a" }),
    P("peter", "Corporal Peter (Oga Pee)", "Campus security", "gate", "#4f301c", "low", "#1e3a8a", "male", .85, ["Where you dey go?", "I know every hedge here.", "Suya first."]),
    P("lawal", "Ranger Lawal", "Forest ranger", "checkpoint", "#7a4a2b", "cap", "#4d7c0f", "male", .9, ["Don't go deep.", "Turn back before dark.", "The forest is not a playground."], { hairCol: "#3f6212" }),
    P("kaka", "Kaka", "Lawal's grandmother, at the forest edge", "lowerdam", "#6b4226", "hijab", "#a16207", "female", .75, ["Sannu, my child.", "Sit, rest.", "Have you eaten?"], { hairCol: "#fef3c7" }),
    P("asiya", "Aunty Asiya", "MIB Store manager", "mibstore", "#c48f65", "hijab", "#fde68a", "female", 1.0, ["Welcome to MIB.", "Exclusive. Only here.", "Mind the glass."], { hairCol: "#ca8a04" }),
    P("needle", "Alhaji Needle", "Tailor", "mk_native", "#6a4127", "cap", "#14b8a6", "male", .8, ["Come Thursday.", "Arms up.", "I know your size by looking."], { hairCol: "#f8fafc" }),
    P("sugar", "DJ Sugar", "DJ and accounting student", "mk_dance", "#85532f", "braids", "#ec4899", "female", 1.15, ["On the one!", "Debit, credit.", "Keep the floor full."]),
    P("shehu", "Mrs. Shehu", "Librarian", "library", "#7a4a2b", "hijab", "#cbd5e1", "female", .85, ["Shh.", "Return it by Friday.", "Quiet, please."], { hairCol: "#475569" }),
    P("seller", "Keke seller", "Seller", "stalls", "#5a361f", "cap", "#eab308", "male", .9, ["Last price!", "Clean engine.", "Test am."], { hairCol: "#111827" }),
    P("greenfingers", "A fresher with green fingers", "Fresher", "sculpture", "#85532f", "low", "#86efac", "male", 1.2, ["It wasn't me.", "Okay, it was me.", "Sorry."]),
    P("photoowner", "The phone's owner", "Student", "amina", "#a06a42", "braids", "#c4b5fd", "female", 1.05, ["Have you seen a cracked phone?", "Please.", "Thank you."]),
    P("patient", "A patient", "Patient", "sickbay", "#6b4226", "low", "#e2e8f0", "male", .95, ["Thank you for coming.", "The fan is broken.", "Read it slowly."]),
    P("caller", "A caller", "Radio caller", "radio", "#85532f", "braids", "#fde68a", "female", 1.1, ["Hello?", "Is this the show?", "Thank you."]),
    P("debtor", "A student", "Student", "suleiman", "#6a4127", "low", "#fca5a5", "male", 1.0, ["Me?", "Paid? By who?", "Okay o."])
  ];

  var items = {
    ugu: { name: "Ugu leaves", price: 200, text: "For Sadiq's mother's soup." }, crayfish: { name: "Crayfish", price: 300, text: "For the soup." },
    stockfish: { name: "Stockfish", price: 600, text: "For the soup." }, pepper: { name: "Pepper", price: 100, text: "For the soup." },
    palmoil: { name: "Palm oil", price: 400, text: "For the soup." }, seasoning: { name: "Seasoning cubes", price: 100, text: "For the soup." },
    pot: { name: "Sadiq's pot", quest: true }, soup: { name: "Mama's soup", quest: true, text: "A week of home." },
    radio: { name: "Firdausi's radio", quest: true }, screwdriver: { name: "Lab screwdriver", quest: true },
    feeform: { name: "Deadline extension form", quest: true }, signature: { name: "Signature", quest: true }, poem: { name: "Yakubu's poem", quest: true },
    scripts: { name: "Exam scripts (all As)", quest: true }, clay: { name: "Dam clay", quest: true },
    paintdrips: { name: "Paint drips", quest: true }, brush: { name: "Green brush", quest: true },
    kettle: { name: "Audu's kettle", quest: true }, receipt: { name: "“Paid in full” receipt", quest: true },
    shortcut: { name: "Shortcut", quest: true, text: "A gap in a hedge or a back gate." }, shawl: { name: "New shawl", quest: true },
    instrument: { name: "“Condemned” oscilloscope", quest: true }, oldsandwich: { name: "Sandwich (old)", quest: true },
    medal: { name: "Medal", quest: true }, goatbell: { name: "Goat's bell", quest: true }, bellosletter: { name: "Letter from Prof. Nwachukwu", quest: true },
    classphoto: { name: "Old class photo", quest: true }, coveredplate: { name: "Covered plate", quest: true },
    greenset: { name: "Needle's green set", text: "Rare outfit. It was meant to be blue." }, crackedphone: { name: "Cracked phone", quest: true },
    hostelphoto: { name: "Clue: a hostel in the background", quest: true }, deptshirt: { name: "Clue: a department shirt", quest: true },
    dogclue: { name: "Clue: a dog", quest: true }, paste: { name: "Clue: paste", quest: true }, papertype: { name: "Clue: Page Turner paper", quest: true },
    handwriting: { name: "Clue: handwriting match", quest: true }, invite: { name: "Reading invitation", quest: true },
    uchesletter: { name: "Captain Uche's reply", quest: true }, sack: { name: "Rubbish sack", quest: true }, fruit: { name: "Bag of fruit", price: 500, text: "For a patient." },
    socks: { name: "Jega's lucky socks", quest: true }, cake: { name: "Cake", price: 1500, text: "A surprise." },
    timetablecard: { name: "Ada's colour timetable", text: "Green lectures, blue food, red: don't skip, purple: rest." },
    bread: { name: "Bread", price: 300 }, sweets: { name: "Sweets", price: 100 }, purewater: { name: "Pure water", price: 20 },
    idcard: { name: "Someone's ID card", quest: true }, flashdrive: { name: "Flash drive “Final final FINAL”", quest: true },
    goat: { name: "Professor the goat", quest: true, text: "Caught. Gently." }, note: { name: "Folded note", quest: true },
    cooler: { name: "Cooler of soup", quest: true, text: "It knows if you open it." }, garri: { name: "Cup of garri", price: 100, text: "Soak it or drink it. Both are correct." },
    groundnuts: { name: "Groundnuts", price: 100, text: "Garri's best friend." },
    suyastick: { name: "Five sticks of suya", price: 500, text: "Corporal Peter's price for five shortcuts." }
  };

  /* ---------- side missions s1–s50 ---------- */
  var side = [
    sm("s1", "Sadiq's pot", 1, "sadiq", "@hostel", "collect", "motif_home", "His mother's soup needs six things from the market, and the pot nobody will admit to borrowing.", [
      st("talk", { npc: "sadiq" }, "Talk to Sadiq", [L("sadiq", "My mother sent the recipe by voice note. It is eleven minutes. Listen with me.")]),
      st("buy", { item: "ugu" }, "Buy ugu leaves at Hajiya Ladi's"), st("buy", { item: "crayfish" }, "Buy crayfish"), st("buy", { item: "stockfish" }, "Buy stockfish"),
      st("buy", { item: "pepper" }, "Buy pepper"), st("buy", { item: "palmoil" }, "Buy palm oil"), st("buy", { item: "seasoning" }, "Buy seasoning"),
      st("find", { item: "pot", at: "buka" }, "Find the pot in Mama Nkechi's back room", [L("", "It is in Mama Nkechi's back room, with a note in Sadiq's handwriting: “Borrowed. Sorry.”"), L("nkechi", "I knew it was him. He returned it with soup inside. Take it.")]),
      st("eat", { place: "@hostel" }, "Eat the soup with Sadiq", [L("sadiq", "It tastes like home. Small. Home, but small.")])],
      { friend: { sadiq: 6 }, item: "soup", count: 7 }),

    sm("s2", "Sadiq sends money", 2, "sadiq", "@hostel", "social", "motif_home", "He asks you to queue at the bank with him and not ask why.", [
      st("walk", { npc: "sadiq", place: "bank" }, "Queue at the bank with Sadiq", [L("sadiq", "Don't ask. Just stand. Standing is support.")]),
      st("talk", { npc: "clement" }, "Wait at the counter", [L("clement", "Network. …Transfer done.")]),
      turn([L("sadiq", "Yes, Mama. It's there. No, I've eaten. I've eaten.")], "On the way out his phone rings."),
      st("eat", { place: "@hostel" }, "Share garri with Sadiq", [L("sadiq", "Half goes home. Always. Now you know. Pass the sugar.")])],
      { friend: { sadiq: 8 }, flags: ["secret_sadiq"] }),

    sm("s3", "Firdausi's radio", 1, "firdausi", "amina", "build", "radio_wrong_station", "Her radio gets one station and it is the wrong one. Fix it without Mr. Ezekiel finding out whose tools.", [
      st("talk", { npc: "firdausi", give: "radio" }, "Talk to Firdausi", [L("firdausi", "It only plays Parade Ground. Coach Danladi is shouting into my dreams.")]),
      st("stealth", { place: "dept_elect", guards: 1, give: "screwdriver" }, "Borrow a screwdriver while Mr. Ezekiel is at lunch"),
      st("build", { parts: { radio: 1 }, place: "@hostel" }, "Re-seat the tuning coil"),
      st("talk", { npc: "ezekiel", take: "screwdriver", turn: true }, "Return the screwdriver", [L("", "He is standing by the hook."), L("ezekiel", "Who touched it? …Did it work? Hm. Sign next time.")])],
      { friend: { firdausi: 6 }, standing: { academics: 1 }, flags: ["firdausi_arewa_calm"] }),

    sm("s4", "Ada's timetable", 1, "ada", "ee", "routine", "motif_work", "She has colour-coded your week. Follow it for one day.", [
      st("talk", { npc: "ada", give: "timetablecard" }, "Talk to Ada", [L("ada", "Green is lectures. Blue is food. Red is “you will want to skip this; don't”.")]),
      st("routine", { at: [["kt", 8], ["buka", 10], ["@dept", 12], ["library", 14], ["social", 17], ["@hostel", 21]] }, "Keep Ada's six blocks, from the 8 a.m. tutorial"),
      turn([L("ada", "Purple is rest. It's the most important colour. Go.")], "At 9 p.m. the last block is purple.")],
      { friend: { ada: 5 }, standing: { academics: 3 } }),

    sm("s5", "Ada's fees", 2, "ada", "ee", "delivery", "tension_low", "A deadline, a queue, and a quiet favour from Dr. Khadija that Ada must never hear about.", [
      st("talk", { npc: "ada" }, "Talk to Ada", [L("ada", "Two days. I have most of it. Most is not all.")]),
      st("talk", { npc: "khadija", give: "feeform" }, "See Dr. Khadija at the department", [L("khadija", "Close the door. This form extends a deadline. You didn't get it from me.")]),
      st("delivery", { item: "feeform", place: "senate", limit: 300 }, "Run the form to the Bursary before four"),
      st("talk", { npc: "ada", turn: true }, "Tell Ada the news", [L("ada", "They extended it! Some miracle. Do you know who?")]),
      st("choice", { prompt: "Tell her who helped?", options: [{ label: "Tell her", set: "ada_thanked_khadija" }, { label: "Keep Dr. Khadija's secret", set: "khadija_secret_kept" }] }, "Tell her, or keep the secret")],
      { friend: { ada: 8 }, standing: { community: 2 } }),

    sm("s6", "Yakubu's attendance sheet", 1, "yakubu", "fslt", "collect", "comic_march", "The sheet is missing and the lecturer wants it by four. Forty signatures in forty places.", [
      st("talk", { npc: "yakubu" }, "Talk to Yakubu", [L("yakubu", "For the record, it was in my file. For the record, my file has a hole.")]),
      st("collect", { item: "signature", n: 40, at: "selfie", r: 260, limit: 600 }, "Collect forty signatures across campus"),
      st("talk", { npc: "yakubu", turn: true }, "Bring Yakubu the sheet", [L("", "One signature is a goat's hoof print."), L("yakubu", "…We will not speak of that one.")])],
      { friend: { yakubu: 5 }, standing: { department: 2 } }),

    sm("s7", "Yakubu's poem", 3, "yakubu", "fslt", "stealth", "tension_low", "He left his file in Theatre CD with a poem in it. The Drama Club has found it.", [
      st("talk", { npc: "yakubu" }, "Talk to Yakubu", [L("yakubu", "There is a page. It rhymes. It must not be read aloud.")]),
      st("stealth", { place: "theatre", guards: 2, give: "poem" }, "Slip past the cast before Micheal performs it"),
      st("talk", { npc: "micheal", turn: true }, "Face Micheal", [L("", "Micheal reads one line before you snatch it, and the room goes quiet, because it is good."), L("micheal", "Who wrote this? I want to direct it.")]),
      st("choice", { prompt: "The poem:", options: [{ label: "Give it back to Yakubu", set: "yakubu_poem_kept" }, { label: "Let Micheal stage it", set: "yakubu_poem_staged" }] }, "Give it back, or let Micheal stage it")],
      { friend: { yakubu: 8 }, standing: { social: 2 } }),

    sm("s8", "Fatima's shelf", 2, "fatima", "library", "social", "two_notes", "She shows you the hidden room. You may borrow one book.", [
      st("walk", { npc: "fatima", place: "library" }, "Go with Fatima to the library", [L("fatima", "Pull the atlas. Not that one. The heavy one.")]),
      st("choice", { prompt: "Borrow one book", options: [{ label: "A novel", set: "fatima_book_novel" }, { label: "An old engineering text", set: "fatima_book_engineering" }, { label: "A book of proverbs", set: "fatima_book_proverbs" }] }, "Choose one of three books"),
      turn([L("fatima", "Actually, that's the one I would have chosen. Don't tell anyone.")])],
      { friend: { fatima: 6 }, flags: ["hidden_room_open"] }),

    sm("s9", "Fatima speaks", 3, "fatima", "library", "escort", "motif_crew", "She has to give a five-minute talk. Be her audience six times in six places.", [
      st("escort", { npc: "fatima", place: "love" }, "Be Fatima's audience in the Love Garden", [L("fatima", "Actually… no. Again. Actually, the reason is…")]),
      st("escort", { npc: "fatima", place: "dam" }, "Listen again on the pier"),
      st("escort", { npc: "fatima", place: "kt" }, "Again, in an empty KT row"),
      st("escort", { npc: "fatima", place: "court" }, "Again, at the court"),
      st("escort", { npc: "fatima", place: "buka" }, "Again, at the buka"),
      st("escort", { npc: "fatima", place: "enggarden", turn: true }, "One last time, by the coil", [L("", "On the sixth, Bolaji and Sadiq sit down to listen too, uninvited."), L("fatima", "Five minutes. Exactly. I didn't say “actually” once.")])],
      { friend: { fatima: 8 }, standing: { academics: 2 }, flags: ["fatima_rehearsed"] }),

    sm("s10", "Bolaji's trick", 1, "bola", "court", "prank", "street_breaks", "He wants the stair set outside the Senate. Keep Malam Garba talking.", [
      st("talk", { npc: "garba" }, "Ask Malam Garba for a proverb", [L("garba", "The river that forgets its source will dry. …You want another? You're strange today.")]),
      st("talk", { npc: "garba" }, "Ask for another"),
      st("talk", { npc: "garba" }, "Ask what it means"),
      turn([L("", "A clatter. A cheer. He turns. Bolaji is standing on her board, innocent."), L("garba", "Young lady. Was that you? …Was it clean? Then I saw nothing.")])],
      { friend: { bola: 6 }, standing: { street: 2 } }),

    sm("s11", "Bolaji's scripts", 3, "bola", "court", "social", "motif_crew", "You find his exam scripts in his skate bag. All As.", [
      st("find", { item: "scripts", at: "court" }, "Look in Bolaji's skate bag", [L("bola", "Give that here. …You saw.")]),
      st("talk", { npc: "bola", take: "scripts" }, "Talk to Bolaji", [L("bola", "If they know I'm good at it, they'll want me to only be that.")]),
      st("choice", { prompt: "Bolaji's secret", options: [{ label: "Keep his secret", set: "bolaji_secret_kept" }, { label: "Tell him to be both, loudly", set: "bolaji_be_both" }] }, "Keep his secret, or tell him to be both")],
      { friend: { bola: 8 } }),

    sm("s12", "Kelechi's clay", 1, "kelechi", "sculpture", "collect", "dam", "The good clay is at the Dam's edge. So are the goats.", [
      st("collect", { item: "clay", n: 5, at: "dam", r: 40 }, "Dig five lumps of clay while the goats try to eat your bag"),
      st("talk", { npc: "kelechi", take: "clay", turn: true }, "Bring the clay to Kelechi", [L("kelechi", "Look at them properly. That one has a face like a professor. I'll use it.")])],
      { friend: { kelechi: 5 }, flags: ["goat_sculpture"] }),

    sm("s13", "The eighth statue", 2, "kelechi", "sculpture", "investigation", "tension_low", "Someone painted a moustache on the unsigned statue. Kelechi is far too upset for a stranger's work.", [
      st("find", { item: "paintdrips", at: "sculpture" }, "Find paint drips"),
      st("find", { item: "brush", at: "sculpture" }, "Find the brush in a hedge"),
      st("talk", { npc: "greenfingers" }, "Talk to the fresher with green fingers", [L("greenfingers", "It was a dare. I'm sorry. I'll clean it.")]),
      st("talk", { npc: "kelechi", turn: true }, "Tell Kelechi", [L("kelechi", "…It's mine. The eighth. I never signed it. Don't tell anyone.")])],
      { friend: { kelechi: 8 }, flags: ["kelechi_eighth"] }),

    sm("s14", "Emeka's keke", 2, "emeka", "gate", "social", "motif_market", "He has saved for two years. Go with him to buy it and stop him paying the first price.", [
      st("walk", { npc: "emeka", place: "stalls" }, "Go with Emeka to the stalls"),
      st("talk", { npc: "seller" }, "Meet the keke seller", [L("seller", "Last price, ₦600,000."), L("emeka", "Done!")]),
      st("choice", { prompt: "Haggle", options: [{ label: "Point out the tyres", set: "haggle_1" }, { label: "Say nothing", set: "haggle_none" }] }, "Point out the tyres"),
      st("choice", { prompt: "Haggle", options: [{ label: "Point out the seat", set: "haggle_2" }, { label: "Say nothing", set: "haggle_none2" }] }, "Point out the seat"),
      st("choice", { prompt: "Haggle", options: [{ label: "Point out the very honest rust", set: "haggle_3" }, { label: "Say nothing", set: "haggle_none3" }] }, "Point out the rust"),
      turn([L("emeka", "My guy, you saved me a whole month. I'll name it after you. No. After my mother.")])],
      { friend: { emeka: 5 }, standing: { street: 3 }, flags: ["emeka_keke"] }),

    sm("s15", "Emeka's matric number", 4, "emeka", "gate", "escort", "motif_home", "He kept his old ID card. Walk with him to ask a question he has been afraid to ask.", [
      st("walk", { npc: "emeka", place: "senate" }, "Walk slowly with Emeka to the Registry", [L("emeka", "Maybe tomorrow. …No. Today. Walk slowly.")]),
      st("talk", { npc: "adebayo" }, "Ask Mrs. Adebayo", [L("adebayo", "Withdrawn, not expelled. There is a part-time form. Bring a photocopy.")]),
      turn([L("emeka", "A form. All this time it was only a form.")])],
      { friend: { emeka: 10 }, flags: ["emeka_part_time"] }),

    sm("s16", "Sly's clippers", 2, "sly", "mk_barber", "social", "motif_crew", "His first paying customer after opening is a fussy professor. Steady his hands.", [
      st("talk", { npc: "sly" }, "Talk to Big Sly at his shop", [L("sly", "Sly can fight ten boys. Sly cannot do one hairline in front of Prof. Bello.")]),
      st("rhythm", { song: "steady", pass: 60 }, "Hand him the tools on the beat"),
      turn([L("bello", "Now, where was I? …Very good. I'll come back. I'll bring the Dean.")])],
      { standing: { community: 2 }, flags: ["sly_staff_discount"] }),

    sm("s17", "Joy's night show", 2, "joy", "radio", "rhythm", "arewa_calm", "The anonymous host has lost her voice. Read the dedications. Do not do an accent.", [
      st("talk", { npc: "joy", night: true }, "Meet Joy at the studio", [L("", "She writes on paper: “Read these. Slowly. Like a friend.”")]),
      st("rhythm", { song: "read", pass: 50 }, "Read five dedications on the cue light", [L("me", "To everyone in Suleiman Hall without water: someone out there has a bucket.")]),
      st("phone", { npc: "caller", incoming: true, turn: true }, "Take the call", [L("caller", "Is this the usual host? You sound different. Nicer? No, same. Thank you.")])],
      { friend: { joy: 8 }, flags: ["secret_joy"] }),

    sm("s18", "AB's checklist", 2, "abdul", "strip", "routine", "airfield", "He wants to rehearse his flight test on the ground, on bicycles, with arm signals.", [
      st("ride", { veh: "bike" }, "Get on a bicycle"),
      st("look", { place: "strip", secs: 30, r: 60 }, "Follow AB's arm signals round the taxiway", [L("abdul", "Left bank. That's left. Your other left. Check.")]),
      st("talk", { npc: "uche", turn: true }, "Face Captain Uche", [L("", "Captain Uche watches the whole thing."), L("uche", "Ridiculous. Do it again.")])],
      { friend: { abdul: 6 }, standing: { department: 1 } }),

    sm("s19", "AB and the water", 4, "abdul", "strip", "social", "water_only", "He will not get in Baba Dam's boat. Sit on the pier with him until he does, or does not.", [
      st("emote", { emote: "sit", at: "dam" }, "Sit on the pier with AB", [L("abdul", "I fell in a river when I was six. Nobody laughed. That was worse.")]),
      st("choice", { prompt: "AB stares at the boat.", options: [{ label: "Wait", set: "ab_waited" }, { label: "Hold out a hand", set: "ab_hand" }] }, "Wait, or hold out a hand"),
      turn([L("", "He puts one foot in the boat."), L("baba", "One foot is a start. Two is fishing.")])],
      { friend: { abdul: 10 }, flags: ["ab_boat"] }),

    sm("s20", "Basit's sister", 2, "basit", "mk_arcade", "routine", "chiptune", "He works two jobs. Cover one shift so he can make his sister Jasmin's visiting day.", [
      st("talk", { npc: "basit" }, "Take over Basit's shift"),
      st("social", { place: "mk_arcade", secs: 90 }, "Run the Game Room: change, a jam, a joystick fight"),
      st("phone", { npc: "jasmin", incoming: true, turn: true }, "Answer the phone", [L("jasmin", "He came! He brought chin-chin! Thank you, whoever you are.")])],
      { friend: { basit: 8 }, cash: 600, flags: ["secret_basit"] }),

    sm("s21", "Basit loses", 3, "basit", "mk_arcade", "social", "chiptune_sad", "He has lost to a child. Console him. Do not laugh. Laugh a little.", [
      st("talk", { npc: "basit" }, "Talk to Basit", [L("basit", "Nine years old. Nine. She didn't even look at the screen.")]),
      st("choice", { prompt: "Console him", options: [{ label: "Sympathy", set: "basit_sympathy" }, { label: "Rematch the child", set: "basit_rematch" }] }, "Sympathy, or a rematch"),
      st("arcade", { game: "kola", if: "basit_rematch" }, "Play the child at Kola Stack (and lose too)"),
      turn([L("basit", "…She's good. I'll coach her. Best of three.")])],
      { friend: { basit: 6 }, standing: { social: 1 } }),

    sm("s22", "Maryam's noticeboard", 2, "maryam", "mk_books", "investigation", "tension_low", "Someone keeps pasting stories on the boards. She asks you to help catch the author.", [
      st("find", { item: "paste", at: "senate" }, "Find the paste by the Senate board"),
      st("find", { item: "papertype", at: "mk_books" }, "Match the paper at Page Turner"),
      st("find", { item: "handwriting", at: "library" }, "Match the handwriting"),
      st("talk", { npc: "maryam", turn: true }, "Confront the author", [L("", "The handwriting is hers."), L("maryam", "Took you long enough. Have you read them, at least?")])],
      { friend: { maryam: 8 }, flags: ["maryam_stories"] }),

    sm("s23", "Maryam's reading", 4, "maryam", "mk_books", "collect", "quiet", "Her first public reading. Fill twelve chairs.", [
      st("collect", { item: "invite", n: 12, at: "selfie", r: 220 }, "Invite twelve people"),
      st("go", { place: "mk_books", turn: true }, "Go to the reading", [L("", "Fourteen come. Mrs. Shehu sits at the back."), L("shehu", "Shh. …Again. Read it again.")])],
      { friend: { maryam: 8 }, standing: { social: 3 }, flags: ["maryam_reading"] }),

    sm("s24", "Micheal's audition", 2, "micheal", "theatre", "rhythm", "stage_drum", "The Drama Club needs a second actor for one scene. You have six lines and a fake beard.", [
      st("rhythm", { song: "lines", pass: 60 }, "Hit your six cues", [L("micheal", "Louder. Louder. Not that loud. Perfect.")]),
      st("talk", { npc: "micheal", turn: true }, "Take a bow", [L("", "The beard falls off on line five. The audience roars."), L("micheal", "Keep it. That's the show now.")])],
      { friend: { micheal: 5 }, standing: { social: 3 }, flags: ["micheal_met"] }),

    sm("s25", "Lucky's first video", 4, "lucky", "selfie", "prank", "phone_groove", "Before the followers, his “day in the life” video has nothing happening in it.", [
      st("talk", { npc: "lucky" }, "Talk to Lucky", [L("lucky", "I woke up. I ate garri. I went to class. Nobody will watch this.")]),
      st("buy", { item: "cake" }, "Buy a surprise cake"),
      st("talk", { npc: "peter" }, "Talk Corporal Peter into a fake lecture"),
      st("look", { place: "quarters", secs: 6 }, "Film a goat cameo at the Staff Quarters"),
      turn([L("lucky", "The goat part is the best part. The goat is the star. I'm fine with that.")])],
      { friend: { lucky: 5 }, flags: ["lucky_first_video"] }),

    sm("s26", "Mama Nkechi's recipe book", 3, "nkechi", "buka", "escort", "highlife", "The book is falling apart. Chi-Tech can scan it. She will not let it out of the buka.", [
      st("talk", { npc: "chitech" }, "Ask Chi-Tech to bring his scanner"),
      st("escort", { npc: "chitech", place: "buka" }, "Bring Chi-Tech to the buka", [L("nkechi", "Careful. That page has his thumbprint in pepper.")]),
      turn([L("chitech", "Done. Free. Family photos and family recipes are always free.")])],
      { friend: { nkechi: 8 }, flags: ["recipes_scanned"] }),

    sm("s27", "Mai Shayi's kettle", 2, "audu", "shayi", "delivery", "dam", "The kettle has a hole. Bright Electricals cannot help. Baba Dam can.", [
      st("talk", { npc: "audu", give: "kettle" }, "Take the kettle from Mai Shayi Audu"),
      st("delivery", { item: "kettle", place: "dam" }, "Take it to Baba Dam"),
      st("talk", { npc: "baba", turn: true }, "Let Baba Dam patch it", [L("", "He patches it with a fishing weight and resin."), L("baba", "Tell him he still owes me tea from 1998.")]),
      st("talk", { npc: "audu", take: "kettle" }, "Bring it back to Audu", [L("audu", "He said that? …He's right. First cup is his. Second is yours.")])],
      { standing: { community: 3 } }),

    sm("s28", "Hajiya's ledger", 3, "ladi", "market", "delivery", "motif_market", "Three students owe nothing because somebody always pays. Deliver three receipts and say nothing.", [
      st("talk", { npc: "ladi", give: "receipt" }, "Take the receipts from Hajiya Ladi"),
      st("delivery", { item: "receipt", place: "suleiman" }, "Deliver a receipt in Suleiman Hall", [L("debtor", "Paid? By who?"), L("me", "I'm just the delivery.")]),
      st("delivery", { item: "receipt", place: "akenzua" }, "Deliver one in Akenzua Hall"),
      st("delivery", { item: "receipt", place: "danfodio" }, "Deliver one in Dan Fodio Hostel"),
      st("talk", { npc: "ladi", turn: true }, "Report back", [L("ladi", "Last price for them: zero. Don't tell my daughter; she'll want a discount.")])],
      { standing: { community: 4 }, flags: ["secret_ladi"] }),

    sm("s29", "Baba Dam's net", 1, "baba", "dam", "routine", "water", "Mend a net with him. He tells one riddle per knot.", [
      st("social", { place: "dam", secs: 40, emote: "sit" }, "Tie five knots with Baba Dam", [L("baba", "What has a mouth and never eats? …The river. Next knot.")]),
      turn([L("", "He gets one of yours wrong."), L("baba", "Hm. I will think about it for a year.")])],
      { friend: { baba: 5 } }),

    sm("s30", "Nurse Hauwa's list", 3, "hauwa", "sickbay", "social", "motif_home", "Check on four students from her list, as if by accident.", [
      st("social", { place: "buka", secs: 20 }, "Share a meal with the first one"),
      st("social", { place: "shinkafi", secs: 20 }, "Make the second one laugh"),
      st("walk", { npc: "debtor", place: "love" }, "Take the third one for a walk"),
      st("social", { place: "@hostel", secs: 20 }, "Sit with the fourth while they call home"),
      st("talk", { npc: "hauwa", turn: true }, "Report to Nurse Hauwa", [L("hauwa", "You didn't tell them I sent you? Good. That's the medicine.")])],
      { standing: { community: 5 } }),

    sm("s31", "Captain Uche's letter", 4, "uche", "strip", "delivery", "airfield", "An airline has written to her again. She asks you to post her reply. It is very short.", [
      st("talk", { npc: "uche", give: "uchesletter" }, "Take Captain Uche's reply", [L("uche", "Don't read it. …It says “No, thank you.” Checklist done.")]),
      st("delivery", { item: "uchesletter", place: "mk_gifts" }, "Post it at the mall counter")],
      { friend: { uche: 6 } }),

    sm("s32", "Coach Danladi's speech", 3, "danladi", "club", "social", "parade_ground", "He must give a prize-giving speech without shouting or crying. Rehearse him.", [
      st("talk", { npc: "danladi" }, "Rehearse him", [L("danladi", "I AM VERY PROUD— (quieter) I am very proud of— (cries)")]),
      st("talk", { npc: "danladi" }, "Rehearse him again"),
      st("talk", { npc: "danladi" }, "One more time"),
      st("look", { place: "club", secs: 8, night: true, turn: true }, "Watch the prize-giving", [L("", "On the night he shouts and cries. Everybody loves it.")])],
      { friend: { danladi: 6 }, standing: { street: 1 } }),

    sm("s33", "Kabiru off air", 3, "kabiru", "radio", "escort", "highlife_band", "The studio mic is dead and he must MC a wedding in person. He is terrified.", [
      st("escort", { npc: "kabiru", place: "quarters" }, "Walk DJ Kabiru to the wedding", [L("kabiru", "People will look at me. Radio people are not for looking at.")]),
      st("watch", { npc: "kabiru", secs: 10, turn: true }, "Watch him MC", [L("", "He holds an unplugged microphone for courage and is brilliant.")])],
      { friend: { kabiru: 6 }, flags: ["secret_kabiru"] }),

    sm("s34", "Madam Whistle's sprint", 2, "bilkisu", "market", "race", "chase", "A goat snatches a trader's bag. Sgt. Bilkisu outruns it, you, and a motorbike.", [
      st("tail", { npc: "bilkisu", place: "market", near: 0, far: 60 }, "Try to keep up with Sgt. Bilkisu"),
      st("talk", { npc: "bilkisu", turn: true }, "Catch your breath", [L("bilkisu", "State champion, 2009. Don't tell the boys. They'll want races.")])],
      { friend: { bilkisu: 6 }, flags: ["secret_bilkisu"] }),

    sm("s35", "Oga Pee's shortcuts", 2, "peter", "gate", "collect", "street_breaks", "He trades five shortcuts for five sticks of suya.", [
      st("buy", { item: "suyastick" }, "Buy five sticks of suya for Corporal Peter"),
      st("talk", { npc: "peter" }, "Trade the suya for his shortcuts"),
      st("collect", { item: "shortcut", n: 5, at: "senate", r: 300 }, "Find his five shortcuts"),
      st("talk", { npc: "peter", turn: true }, "Report back", [L("peter", "Now you know everything I know. Which is a lot. With eyes closed.")])],
      { standing: { street: 2 }, flags: ["map_shortcuts_5"] }),

    sm("s36", "Lawal's grandmother", 3, "lawal", "checkpoint", "delivery", "motif_elder", "Carry a parcel from the mall to the forest edge. He is too proud to say who it is for.", [
      st("go", { place: "mk_gifts", give: "shawl" }, "Collect the parcel at the mall"),
      st("delivery", { item: "shawl", place: "checkpoint" }, "Carry it to the forest edge"),
      st("talk", { npc: "kaka", take: "shawl", turn: true }, "Give it to the old woman waiting there", [L("kaka", "He sent you? He could have come. He's shy. He gets it from his grandfather.")])],
      { friend: { lawal: 6, kaka: 4 } }),

    sm("s37", "Mr. Ezekiel's shelf", 3, "ezekiel", "dept_elect", "escort", "motif_work", "Every “condemned” instrument in the lab works. Help him carry one home and one back.", [
      st("talk", { npc: "ezekiel", give: "instrument" }, "Talk to Mr. Ezekiel", [L("ezekiel", "Condemned. Hm. Condemned by whom? By people who don't own screwdrivers.")]),
      st("carry", { item: "instrument", place: "quarters" }, "Carry the instrument to his house"),
      st("look", { place: "quarters", secs: 6, turn: true }, "Look inside", [L("", "His house is full of fixed oscilloscopes.")])],
      { friend: { ezekiel: 8 }, flags: ["secret_ezekiel"] }),

    sm("s38", "Prof. Bello's desk", 3, "bello", "physics", "collect", "comic", "He has lost a letter. It is in his desk. Everything is in his desk.", [
      st("find", { item: "oldsandwich", at: "physics" }, "Search the desk: a sandwich (old)"),
      st("find", { item: "medal", at: "physics" }, "A medal"),
      st("find", { item: "goatbell", at: "physics" }, "A goat's bell"),
      st("find", { item: "bellosletter", at: "physics" }, "The letter"),
      st("talk", { npc: "bello", take: "bellosletter", turn: true }, "Give it to Prof. Bello", [L("", "It is from Prof. Nwachukwu."), L("bello", "Now, where was I? …I was young. Thank you.")])],
      { friend: { bello: 6 }, flags: ["bello_letter"] }),

    sm("s39", "Dr. Okonkwo's class photo", 4, "okonkwo", "ee", "investigation", "motif_light", "An old photograph: a class in front of the coil. One face is very familiar.", [
      st("find", { item: "classphoto", at: "ee" }, "Find the photo behind her certificates"),
      st("talk", { npc: "okonkwo", turn: true }, "Show Dr. Okonkwo", [L("okonkwo", "That's him. The Maker. Before he was “the”. We thought he'd be famous.")])],
      { friend: { okonkwo: 6 }, flags: ["maker_photo"] }),

    sm("s40", "Aunty Asiya's supper", 2, "asiya", "mibstore", "delivery", "motif_light", "Take the Maker's food tonight; she has stocktake. He asks what the mall is like.", [
      st("talk", { npc: "asiya", give: "coveredplate" }, "Take the covered plate from Aunty Asiya"),
      st("delivery", { item: "coveredplate", place: "enggarden", careful: true }, "Take it to the Maker"),
      st("talk", { npc: "maker", take: "coveredplate" }, "Tell him about the mall", [L("maker", "An escalator? That only goes up? Ambitious. Tell me more.")])],
      { friend: { maker: 5, asiya: 3 } }),

    sm("s41", "Needle's Thursday", 2, "needle", "mk_native", "social", "motif_market", "It is ready. It is the wrong colour. It is perfect.", [
      st("talk", { npc: "needle", give: "greenset" }, "Collect your outfit from Alhaji Needle", [L("needle", "You asked for blue. This is green. Blue was wrong for you. Wear it.")])],
      { standing: { social: 2 } }),

    sm("s42", "Chi-Tech's photos", 3, "chitech", "mk_electronics", "investigation", "tension_low", "A cracked phone with a stranger's family pictures. Find the owner from three clues.", [
      st("talk", { npc: "chitech", give: "crackedphone" }, "Take the cracked phone from Chi-Tech"),
      st("find", { item: "hostelphoto", at: "amina" }, "Clue: the hostel in the background"),
      st("find", { item: "deptshirt", at: "dept_civil" }, "Clue: the department shirt"),
      st("find", { item: "dogclue", at: "quarters" }, "Clue: the dog"),
      st("talk", { npc: "photoowner", take: "crackedphone", turn: true }, "Return the phone", [L("photoowner", "My grandmother's last photos. I thought they were gone.")])],
      { standing: { community: 4 } }),

    sm("s43", "Sugar's accounts", 3, "sugar", "mk_dance", "rhythm", "house_set", "She has an accounting test tomorrow and a full floor tonight. Run the decks for one set.", [
      st("rhythm", { song: "dj_set", pass: 60, night: true }, "Run the decks and keep the floor full"),
      turn([L("sugar", "(from a corner, with a textbook) On the one! …Debit, credit. On the one!")])],
      { friend: { sugar: 6 }, flags: ["secret_sugar"] }),

    sm("s44", "Baba Shuttle's last trip", 4, "linus", "stop_gate", "routine", "motif_road", "His bus is being retired. Ride the full route with him and name the regulars.", [
      st("talk", { npc: "linus" }, "Board Baba Shuttle's bus", [L("linus", "That one's mother rode with me. And her mother. Shift for them.")]),
      st("go", { place: "stop_senate" }, "Senate stop: name the first regular"),
      st("go", { place: "stop_social" }, "Social Centre stop: name the second"),
      st("go", { place: "stop_eng" }, "Engineering stop: name the third"),
      st("go", { place: "stop_library" }, "Library stop: name the fourth"),
      st("go", { place: "stop_dam", turn: true }, "The Dam: the last regular", [L("", "At the last stop everyone gets off and claps.")])],
      { standing: { community: 4 } }),

    sm("s45", "Iya Risi's plate", 2, "risi", "p2canteen", "social", "motif_home", "She leaves a covered plate every night. Find out who it is for.", [
      st("watch", { place: "p2canteen", secs: 40, r: 30, night: true }, "Watch the covered plate from a distance"),
      st("talk", { npc: "risi", turn: true }, "Go to the counter", [L("", "Nobody comes. It gets late."), L("risi", "It's for whoever comes. Tonight it's you. Eat.")]),
      st("eat", { place: "p2canteen" }, "Eat")],
      { standing: { community: 3 } }),

    sm("s46", "Clean-up Saturday", 2, "pastorsam", "chapel", "collect", "motif_crew", "Both fellowships clean the Dam shore together. Fill ten sacks.", [
      st("collect", { item: "sack", n: 10, at: "dam", r: 60 }, "Fill ten sacks on the Dam shore", [L("pastorsam", "Chapel has six."), L("auwal", "Mosque has seven. Insha Allah, eight.")]),
      turn([L("", "It ends in a draw, and kunu for everyone.")])],
      { standing: { community: 5 } }),

    sm("s47", "The visit", 3, "pastorsam", "chapel", "care", "motif_home", "Fellowship members visit the Sick Bay. Carry fruit, read a letter aloud, fix a fan.", [
      st("buy", { item: "fruit" }, "Buy fruit for the patients"),
      st("talk", { npc: "patient", take: "fruit" }, "Read the letter aloud at the Sick Bay", [L("patient", "Read it slowly. It's from my mother. She writes slowly.")]),
      st("social", { place: "sickbay", secs: 20 }, "Fix the ward's fan")],
      { standing: { community: 4 } }),

    sm("s48", "Sadiya's carry-over", 4, "sadiya", "senate", "quiz", "two_notes", "She failed a course and thinks nobody knows. Tutor her at night, away from the posters.", [
      st("teach", { subject: "gen", n: 5, pass: 3, npc: "sadiya", night: true }, "Tutor her in the library", [L("sadiya", "Great students. …I'm not great at this one.")]),
      turn([L("", "She passes the resit."), L("sadiya", "Great! (She answers herself.)")])],
      { friend: { sadiya: 6 }, standing: { academics: 2 } }),

    sm("s49", "Jega's socks", 2, "jega", "court", "chase", "chase", "The lucky socks are missing an hour before the final. They are on a hostel line.", [
      st("go", { place: "akenzua", limit: 480 }, "Check Akenzua Hall's washing lines"),
      st("go", { place: "suleiman" }, "Check Suleiman Hall's lines"),
      st("go", { place: "ribadu" }, "Check Ribadu/Alex Hall's lines"),
      st("find", { item: "socks", at: "quarters" }, "Check Sgt. Bilkisu's line", [L("bilkisu", "They were on the floor. I washed them. You're welcome.")]),
      st("talk", { npc: "jega", take: "socks" }, "Get them to Jega before kick-off")],
      { friend: { jega: 6 }, flags: ["jega_final_won"],
        around: { radio: [["kabiru", "Jega's hall wins the final! Something about socks."]] } }),

    sm("s50", "Aminu's first day", 5, "aminu", "gate", "escort", "motif_school", "He has admission. Walk him to the Senate. Let him think he is leading.", [
      st("walk", { npc: "aminu", place: "senate" }, "Follow Aminu to the Senate", [L("aminu", "This way. I think. Is it this way? I knew that.")]),
      st("talk", { npc: "garba", turn: true }, "Greet Malam Garba", [L("garba", "Another one. Welcome, my child. …And you. You came back.")])],
      { friend: { aminu: 10 }, flags: ["aminu_first_day"] })
  ];

  /* ---------- ambient encounters e1–e31 ---------- */
  // Each variant: who (look), ask (the line they call out), steps (1–2), thanks. Twist ≈ one time in five.
  var W = function (voice, top) { return { voice: voice, top: top }; };
  function E(id, title, kind, where, time, variants, help, decline, twist, extra) {
    var e = { id: id, title: title, kind: kind, where: where, time: time, variants: variants, help: help, decline: decline, twist: twist };
    for (var k in (extra || {})) e[k] = extra[k]; return e;
  }
  function v(who, ask, steps, thanks, setup) { var o = { who: who, ask: ask, steps: steps, thanks: thanks || "" }; if (setup) o.setup = setup; return o; }
  var AMB = ["$here"];

  var ambient = [
    E("e1", "Buy me something", "errand", ["market", "buka", "p2shops", "shinkafi", "mk_food"], "day", [
      v(W("male", "#60a5fa"), "Abeg, help me buy bread. Keep the change.", [{ t: "buy", item: "bread", text: "Buy bread for them" }], "God bless you.", "A student in a queue"),
      v(W("female", "#f59e0b"), "Bring me pure water from that side. My legs are paid for.", [{ t: "buy", item: "purewater", text: "Buy pure water for the trader" }], "Ehen. Thank you.", "A trader who can't leave her stall"),
      v(W("female", "#f472b6"), "Mummy said buy sweets. Mummy didn't say how. Help me.", [{ t: "buy", item: "sweets", text: "Buy sweets for the child" }], "Thank you!", "A lecturer's child")],
      { cash: 100, standing: { community: 1 } }, "They ask the next person.", { chance: .2, text: "The change is ₦5.", cash: 5 }),

    E("e2", "Late for a test", "lift", ["nelt", "kt", "wt", "senate", "selfie", "stop_library"], "day", [
      v(W("male", "#22c55e"), "Drop me at NELT! Two minutes! I'll pray for you!", [{ t: "escort", npc: "$who", place: "nelt", limit: 120, text: "Get them to NELT, fast" }], "I'll pray for you! Twice!"),
      v(W("female", "#a855f7"), "KT, not WT! People always take me to WT!", [{ t: "escort", npc: "$who", place: "kt", limit: 120, text: "Get them to KT (not WT)" }], "KT! You're a legend."),
      v(W("male", "#f97316"), "My department. Any department. I forgot which hall.", [{ t: "escort", npc: "$who", place: "@dept", limit: 150, text: "Get them to their department" }], "This one! I think.")],
      { cash: 0, standing: { street: 1 }, note: "They wave later" }, "Seen running, then walking back.", { chance: .2, text: "Wrong hall; go again.", again: "wt" }),

    E("e3", "Phase 2 lift", "lift", ["stop_gate", "stop_senate", "stop_library", "p2park"], "night", [
      v(W("male", "#0ea5e9"), "Shuttle has closed. You dey go Phase 2?", [{ t: "escort", npc: "$who", place: "dangote", veh: "any", text: "Give them a lift to Phase 2" }], "Thank you, my guy."),
      v(W("female", "#fb7185"), "Dangote side. I'll pay in groundnuts.", [{ t: "escort", npc: "$who", place: "dangote", veh: "any", text: "Give them a lift to Dangote" }], "Here. Groundnuts. As promised."),
      v(W("female", "#fde047"), "Dan Fodio. Drive slowly; I have eggs.", [{ t: "escort", npc: "$who", place: "danfodio", veh: "any", careful: true, text: "Drive them to Dan Fodio gently" }], "Not one egg broken. Respect.")],
      { cash: 0, standing: { community: 1 } }, "A keke stops for them.", { chance: .2, text: "They pay in groundnuts.", give: "groundnuts" }),

    E("e4", "Lost fresher", "escort", ["gate", "stop_gate", "selfie", "senate"], "day", [
      v(W("male", "#bfdbfe"), "Please, where is the Senate?", [{ t: "walk", npc: "$who", place: "senate", text: "Show them the Senate" }], "Thank you! It's so tall."),
      v(W("female", "#c4b5fd"), "Which one is the library? They all look like libraries.", [{ t: "walk", npc: "$who", place: "library", text: "Show them the library" }], "Oh. That's a library."),
      v(W("male", "#86efac"), "I'm looking for the Engineering… square? Circle?", [{ t: "walk", npc: "$who", place: "ee", text: "Show them the Faculty of Engineering" }], "A square! I knew it.")],
      { cash: 0, xp: 20, standing: { community: 1 } }, "They end up at the Dam.", { chance: .2, text: "It's a visiting lecturer.", standing: { academics: 1 } }),

    E("e5", "Walk me there", "escort", ["selfie", "senate", "library", "stop_library", "fslt"], "day", [
      v(W("female", "#f8fafc"), "Lend me your elbow to Kainji. I'll do the talking.", [{ t: "walk", npc: "$who", place: "kt", text: "Walk them to Kainji Theatre" }], "Perfect. You walk like a bus. Smooth."),
      v(W("male", "#e2e8f0"), "Left at the noisy tree. You'll see. I mean, you'll hear.", [{ t: "walk", npc: "$who", place: "library", text: "Walk them to the library" }], "Hear that? Library fan. We're here."),
      v(W("female", "#fef3c7"), "Don't count steps for me. I've counted them since first year.", [{ t: "walk", npc: "$who", place: "nelt", text: "Walk them to NELT" }], "Four hundred and twelve. Told you.")],
      { cash: 0, standing: { community: 2 }, flags: ["shortcut_blind_friend"] }, "They find another elbow at once.",
      { chance: .2, text: "They know a shortcut you don't." }, { note: "Rule 6: competent, funny, in charge of the conversation. Never played for pity." }),

    E("e6", "The dark stretch", "escort", ["stop_library", "social", "shinkafi", "facgarden", "geogarden"], "night", [
      v(W("female", "#fda4af"), "Can we walk with you past here?", [{ t: "walk", npc: "$who", place: "social", text: "Walk them past the dark stretch" }], "Thank you. That part is always dark."),
      v(W("male", "#93c5fd"), "The lamp is dead again. Stay close.", [{ t: "walk", npc: "$who", place: "shinkafi", text: "Walk them to Shinkafi's lights" }], "Light! Okay. I'm fine now."),
      v(W("female", "#d9f99d"), "Talk loudly. Shades don't like talk.", [{ t: "walk", npc: "$who", place: "library", text: "Walk them to the library, talking loudly" }], "See? Nothing. Because we talked.")],
      { cash: 0, standing: { community: 1 } }, "They wait for a group.", { chance: .2, text: "A shade does appear.", spawn: "shade" },
      { notAfter: "m78" }),

    E("e7", "Fell off a bike", "care", ["pepsi", "court", "selfie", "stop_eng", "facgarden"], "any", [
      v(W("male", "#fca5a5"), "I'm fine. I'm fine. I'm not fine.", [{ t: "care", npc: "$who", place: "sickbay", text: "First aid, then the Sick Bay" }], "Nurse says I'll live. Thank you."),
      v(W("female", "#fdba74"), "My knee has opened. Sick Bay, please, gently.", [{ t: "care", npc: "$who", place: "sickbay", text: "First aid, then the Sick Bay, gently" }], "Gently. You did it gently."),
      v(W("male", "#a5b4fc"), "Forget me, check the bike!", [{ t: "care", npc: "$who", place: "sickbay", text: "First aid, then the Sick Bay" }], "And the bike? …Okay. Thank you.")],
      { cash: 0, standing: { community: 2 } }, "Another walker stops.", { chance: .2, text: "You're asked to return the bike.", then: { t: "ride", veh: "bike", text: "Return their bicycle" } }),

    E("e8", "Fainted in the sun", "care", ["selfie", "senate", "court", "market", "pepsi"], "day", [
      v(W("female", "#fde68a"), "She hasn't eaten. Help me carry her.", [{ t: "care", npc: "$who", place: "sickbay", text: "Help carry her to the Sick Bay" }], "Thank you. She's drinking water now.", "A friend kneels beside her"),
      v(W("male", "#bae6fd"), "Fan him. Fan harder. Use your file.", [{ t: "care", npc: "$who", place: "sickbay", text: "Fan him, then the Sick Bay" }], "He's awake. Thank you.", "A friend kneels beside him"),
      v(W("female", "#ddd6fe"), "Did I fall? Did anybody film it?", [{ t: "care", npc: "$who", place: "sickbay", text: "Get them to the Sick Bay" }], "Nobody filmed it? Good. Thank you.", "The student, waking")],
      { cash: 0, standing: { community: 2 }, line: ["hauwa", "Thank you. Sit them in the shade next time, and give them something sweet."] }, "A trader brings water.", { chance: .2, text: "They wake, embarrassed." },
      { hot: true }),

    E("e9", "Twisted ankle", "care", ["court", "social", "pepsi"], "day", [
      v(W("male", "#fca5a5"), "Sick Bay. Slowly. Slowly!", [{ t: "care", npc: "$who", place: "sickbay", text: "Help them to the Sick Bay" }], "Slowly was perfect."),
      v(W("female", "#86efac"), "Carry me like a hero. Not like a bag of rice.", [{ t: "care", npc: "$who", place: "sickbay", text: "Carry them like a hero" }], "Hero. Confirmed."),
      v(W("male", "#fde047"), "The match is on Saturday. Tell me it's not broken.", [{ t: "care", npc: "$who", place: "sickbay", text: "Get them to the Sick Bay" }], "Sprained! Not broken! Saturday!")],
      { cash: 0, standing: { community: 2 } }, "Teammates carry them.", { chance: .2, text: "They score the winner next week and wave." }),

    E("e10", "Teach me this", "teach", ["library", "kt", "wt", "nelt", "@dept"], "any", [
      v(W("male", "#a5f3fc"), "One question from Circuits. Just one.", [{ t: "teach", subject: "ee", n: 1, pass: 1, npc: "$who", text: "Explain one Circuits question" }], "That's it? That's all it was?"),
      v(W("female", "#fbcfe8"), "How does this formula work? Not why. How.", [{ t: "teach", subject: "phys", n: 1, pass: 1, npc: "$who", text: "Explain how the formula works" }], "How. Got it. Not why."),
      v(W("male", "#bbf7d0"), "My test is in an hour. Explain like I'm a fresher. I am a fresher.", [{ t: "teach", subject: "gen", n: 1, pass: 1, npc: "$who", text: "Explain it like they're a fresher" }], "I understand! I'm a smart fresher now.")],
      { cash: 0, standing: { academics: 1 } }, "They ask Fatima.", { chance: .2, text: "It's one you got wrong." }),

    E("e11", "Teach me to ride", "teach", ["pepsi", "social", "court", "facgarden"], "day", [
      v(W("female", "#fde68a"), "Hold the seat. Don't let go. You let go!", [{ t: "look", npc: "$who", secs: 15, r: 6, text: "Hold the seat while they ride" }], "I rode! Alone! Did you see?"),
      v(W("male", "#c7d2fe"), "I'm not scared. I'm respecting the bicycle.", [{ t: "look", npc: "$who", secs: 15, r: 6, text: "Run beside them" }], "The bicycle respects me back."),
      v(W("female", "#fecaca"), "Is it normal for the bicycle to go where it wants?", [{ t: "look", npc: "$who", secs: 15, r: 6, text: "Steady them" }], "It went where I wanted! Once!")],
      { cash: 0, standing: { community: 1 } }, "They wobble on alone.", { chance: .2, text: "They ride off with your bicycle, then come back." }),

    E("e12", "Teach me the step", "teach", ["social", "shinkafi", "mk_dance", "@hostel"], "night", [
      v(W("male", "#f0abfc"), "Show me that one move. Just that one.", [{ t: "social", place: "$here", secs: 20, emote: "dance", text: "Show them the move" }], "Like this? …Like this!"),
      v(W("female", "#99f6e4"), "My hall has a dance-off. I have two left feet and one week.", [{ t: "social", place: "$here", secs: 20, emote: "dance", text: "Teach them a step" }], "One right foot now. Progress."),
      v(W("male", "#fed7aa"), "Slowly. Slower. Now fast. No, slowly.", [{ t: "social", place: "$here", secs: 20, emote: "dance", text: "Dance it slowly, then fast" }], "Okay. I'm ready. I'm not ready. I'm ready.")],
      { cash: 0, standing: { social: 1 } }, "They practise at a shop window.", { chance: .2, text: "They're better than you." }),

    E("e13", "Lost ID card", "find", AMB.concat(["buka", "library", "senate"]), "any", [
      v(W("female", "#93c5fd"), "No ID, no exam. It's blue. Everything is blue!", [{ t: "find", item: "idcard", at: "$here", text: "Find their blue ID card" }], "My face! My terrible face! Thank you!"),
      v(W("male", "#a7f3d0"), "It has my worst photo on it. Find it before anybody sees.", [{ t: "find", item: "idcard", at: "$here", text: "Find the ID card" }], "Did you look at the photo? Don't answer."),
      v(W("female", "#fde68a"), "I had it at the buka. Then I had rice. Then I didn't have it.", [{ t: "find", item: "idcard", at: "buka", text: "Find the ID card at the buka" }], "Under the rice. Of course.")],
      { cash: 0, standing: { community: 1 } }, "Found later on a notice board.", { chance: .2, text: "It's in their own pocket." }),

    E("e14", "Lost flash drive", "find", ["library", "@dept", "mk_electronics", "nelt"], "any", [
      v(W("male", "#d4d4d8"), "My whole project. Black. This small.", [{ t: "find", item: "flashdrive", at: "$here", text: "Find the black flash drive" }], "My year! You found my year!"),
      v(W("female", "#c4b5fd"), "If I lose it, I lose a year. No pressure.", [{ t: "find", item: "flashdrive", at: "$here", text: "Find the flash drive" }], "No pressure. Ha. Thank you."),
      v(W("male", "#fcd34d"), "It says “Final final FINAL”. Don't open it.", [{ t: "find", item: "flashdrive", at: "$here", text: "Find “Final final FINAL”" }], "You didn't open it? …You opened it.")],
      { cash: 0, standing: { department: 1 } }, "They redo a chapter overnight.", { chance: .2, text: "Chi-Tech has it.", then: { t: "talk", npc: "chitech", text: "Get it from Chi-Tech" } }),

    E("e15", "Runaway goat", "find", ["quarters", "facgarden", "geogarden", "dam"], "day", [
      v(W("male", "#fde047"), "Catch it! Its name is Professor!", [{ t: "find", item: "goat", at: "$here", text: "Catch Professor the goat" }], "Professor! Bad goat! Thank you!", "A child"),
      v(W("female", "#f9a8d4"), "It ate my homework. Really. Look at its face.", [{ t: "find", item: "goat", at: "$here", text: "Catch the goat" }], "Look at its face. Guilty.", "A child"),
      v(W("male", "#bae6fd"), "Don't chase. Call it softly. “Professor…”", [{ t: "find", item: "goat", at: "$here", text: "Call it softly and catch it" }], "See? Softly works.", "A child")],
      { cash: 0, standing: { community: 1 } }, "The goat eats a poster.", { chance: .2, text: "It leads you to a kola nut.", token: true }),

    E("e16", "Carry a note", "match", AMB.concat(["love", "library", "shinkafi"]), "any", [
      v(W("male", "#fca5a5"), "Give her this. Don't read it.", [{ t: "talk", npc: "$other", give: "note", take: "note", text: "Give the note to her" }], "Did she smile? Don't tell me. Tell me."),
      v(W("female", "#bfdbfe"), "Give him this. If he laughs, take it back.", [{ t: "talk", npc: "$other", give: "note", take: "note", text: "Give the note to him" }], "He didn't laugh? He didn't laugh!"),
      v(W("male", "#d9f99d"), "It's not a love note. It's a… note of interest.", [{ t: "talk", npc: "$other", give: "note", take: "note", text: "Deliver the note of interest" }], "Interest was… returned?")],
      { cash: 0, standing: { social: 1 }, friend: { $who: 2, $other: 2 } }, "They deliver it themselves, badly.", { chance: .2, text: "The note is for you.", onlyIfSingle: true }),

    E("e17", "Does she like me?", "match", AMB.concat(["love", "selfie", "shinkafi"]), "any", [
      v(W("male", "#a5b4fc"), "Just ask her friend. Casually.", [{ t: "talk", npc: "$other", text: "Ask her friend, casually" }], "And? And? Casually, what did she say?"),
      v(W("female", "#fbcfe8"), "Find out if he's seeing anybody. Like a detective.", [{ t: "talk", npc: "$other", text: "Find out, like a detective" }], "Single? Detective, you're hired."),
      v(W("male", "#99f6e4"), "Don't say my name. Describe me nicely.", [{ t: "talk", npc: "$other", text: "Describe them nicely" }], "Nicely? How nicely?")],
      { cash: 0, standing: { social: 1 } }, "They never find out.", { chance: .2, text: "The friend likes them instead." }),

    E("e18", "Sit with me while I ask", "match", ["love", "selfie", "dam", "shinkafi"], "night", [
      v(W("female", "#fecaca"), "Just stand there. Not so close.", [{ t: "look", npc: "$who", secs: 20, r: 6, text: "Stand nearby. Not too close" }], "She said yes! Or maybe. Yes-maybe!"),
      v(W("male", "#c7d2fe"), "If I freeze, cough twice.", [{ t: "look", npc: "$who", secs: 20, r: 6, text: "Stand by; cough if they freeze" }], "I didn't freeze! You didn't cough!"),
      v(W("female", "#fde68a"), "I've written it on my hand. It's smudged.", [{ t: "look", npc: "$who", secs: 20, r: 6, text: "Stand by while they ask" }], "The smudge said the right thing.")],
      { cash: 0, standing: { social: 1 }, friend: { $who: 2 } }, "They go alone; fifty-fifty.", { chance: .2, text: "They say yes before he finishes." }),

    E("e19", "One bucket", "settle", ["@hostel", "akenzua", "suleiman", "amina", "dangote", "danfodio"], "day", [
      v(W("male", "#93c5fd"), "I was first.", [{ t: "choice", prompt: "Two students, one bucket.", options: [{ label: "First come, first served", standing: { community: 1 } }, { label: "Share it: half each", standing: { community: 2 } }, { label: "Write a tap rota", standing: { community: 2 } }], text: "Settle it fairly" }], "Fine. Fair. Fine.", "Two students, one bucket. The other says: “I was first.”"),
      v(W("female", "#fcd34d"), "She has three buckets. I have one dream.", [{ t: "choice", prompt: "Three buckets against one dream.", options: [{ label: "She lends one bucket", standing: { community: 2 } }, { label: "Queue properly", standing: { community: 1 } }], text: "Settle it fairly" }], "One dream, one bucket. Thank you."),
      v(W("male", "#86efac"), "The tap is free. The water is not.", [{ t: "choice", prompt: "Whose water?", options: [{ label: "Share the water", standing: { community: 2 } }, { label: "Take turns", standing: { community: 1 } }], text: "Settle it fairly" }], "Water for everybody. Small small.")],
      { cash: 0, standing: { community: 1 } }, "A third person takes the bucket.", { chance: .2, text: "It belongs to neither." }),

    E("e20", "Queue-jumper", "settle", ["bank", "buka", "mk_food", "p2canteen", "senate"], "day", [
      v(W("female", "#fda4af"), "Are you seeing this?", [{ t: "choice", prompt: "Someone has jumped the queue.", options: [{ label: "Send them to the back, politely", standing: { community: 2 } }, { label: "Let it go", standing: {} }], text: "Deal with the queue-jumper" }], "Thank you. Some of us have lectures."),
      v(W("male", "#a5b4fc"), "Oga, the queue starts there. There. Far.", [{ t: "choice", prompt: "The queue starts far away.", options: [{ label: "Point them to the back", standing: { community: 2 } }, { label: "Let it go", standing: {} }], text: "Deal with the queue-jumper" }], "There. Far. Correct."),
      v(W("female", "#fef08a"), "We have been here since morning. Morning of yesterday.", [{ t: "choice", prompt: "Since yesterday morning.", options: [{ label: "Speak up for the queue", standing: { community: 2 } }, { label: "Let it go", standing: {} }], text: "Deal with the queue-jumper" }], "Morning of yesterday is avenged.")],
      { cash: 0, standing: { community: 1 } }, "Grumbling.", { chance: .2, text: "It's an elder; everyone lets it go." }),

    E("e21", "₦200 debt", "settle", AMB.concat(["@hostel", "buka", "court"]), "any", [
      v(W("male", "#fdba74"), "Tell him I said…", [{ t: "choice", prompt: "A ₦200 debt.", options: [{ label: "Talk to the borrower", standing: { community: 2 } }, { label: "Pay it yourself", money: -200, standing: { community: 1 } }, { label: "Split it", money: -100, standing: { community: 1 } }], text: "Settle the ₦200 debt" }], "Settled. My peace of mind is back."),
      v(W("female", "#c4b5fd"), "He borrowed my charger and my peace of mind.", [{ t: "choice", prompt: "A charger and ₦200.", options: [{ label: "Talk to the borrower", standing: { community: 2 } }, { label: "Pay it yourself", money: -200, standing: { community: 1 } }], text: "Settle the debt" }], "Charger returned. Peace returned."),
      v(W("male", "#99f6e4"), "It's not the money. It's the principle. It's also the money.", [{ t: "choice", prompt: "The principle (and the money).", options: [{ label: "Talk to the borrower", standing: { community: 2 } }, { label: "Split it", money: -100, standing: { community: 1 } }], text: "Settle the debt" }], "Principle: satisfied. Money: satisfied.")],
      { cash: 0, standing: { community: 1 } }, "They sulk till tomorrow.", { chance: .2, text: "It was ₦20." }),

    E("e22", "Whose socket?", "settle", ["library", "@hostel", "nelt"], "any", [
      v(W("female", "#bfdbfe"), "Mine was on 2%!", [{ t: "choice", prompt: "Four phones, one socket.", options: [{ label: "Draw up a rota", standing: { community: 2 } }, { label: "Lowest battery first", standing: { community: 1 } }], text: "Sort out the socket" }], "Rota. On the wall. Done."),
      v(W("male", "#fde68a"), "I have a presentation. You have WhatsApp.", [{ t: "choice", prompt: "Presentation versus WhatsApp.", options: [{ label: "Presentation first, then a rota", standing: { community: 2 } }, { label: "Rota from now", standing: { community: 1 } }], text: "Sort out the socket" }], "Presentation saved. WhatsApp can wait."),
      v(W("female", "#fecdd3"), "There are four phones and one socket. This is a crisis.", [{ t: "choice", prompt: "A crisis.", options: [{ label: "Fifteen minutes each", standing: { community: 2 } }, { label: "Lend your power bank", standing: { community: 2 } }], text: "Sort out the socket" }], "Crisis over. You're the UN.")],
      { cash: 0, standing: { community: 1 } }, "A rota is written on the wall.", { chance: .2, text: "The light goes; argument over." }),

    E("e23", "Charge my phone", "give", AMB.concat(["library", "stop_gate", "p2park"]), "any", [
      v(W("female", "#fbcfe8"), "One call. To my mum. Please.", [{ t: "choice", prompt: "Lend your phone or power bank?", options: [{ label: "Lend the power bank", standing: { community: 1 } }, { label: "Let them call from your phone", money: -50, standing: { community: 1 } }], text: "Help them call home" }], "Mummy says thank you."),
      v(W("male", "#a7f3d0"), "Just enough to send one message. One.", [{ t: "choice", prompt: "One message.", options: [{ label: "Lend the power bank", standing: { community: 1 } }, { label: "Let them use your phone", money: -20, standing: { community: 1 } }], text: "Help them send one message" }], "Sent. One. Thank you."),
      v(W("female", "#fde68a"), "Power bank? You're an angel. A rich angel.", [{ t: "choice", prompt: "A rich angel?", options: [{ label: "Lend the power bank", standing: { community: 1 } }], text: "Lend your power bank" }], "Angel. Confirmed.")],
      { cash: 0, standing: { community: 1 } }, "They borrow another.", { chance: .2, text: "The call is very long." }),

    E("e24", "Watch my bag", "escort", ["library", "buka", "mk_food", "kt", "nelt", "court"], "any", [
      v(W("male", "#93c5fd"), "Two minutes! (It is five.)", [{ t: "watch", place: "$here", secs: 120, r: 6, text: "Watch the bag" }], "Five minutes is two minutes in student time."),
      v(W("female", "#fca5a5"), "Don't let anybody near it. Especially the goat.", [{ t: "watch", place: "$here", secs: 120, r: 6, text: "Guard the bag (watch for goats)" }], "No goat? Good."),
      v(W("male", "#d9f99d"), "Everything I own is in there. And my lunch.", [{ t: "watch", place: "$here", secs: 120, r: 6, text: "Watch the bag and the lunch" }], "Lunch intact! Thank you.")],
      { cash: 0, standing: { community: 1 } }, "They carry it along.", { chance: .2, text: "Someone tries to move it “to help”." }, { company: true }),

    E("e25", "Wait with me", "escort", ["stop_gate", "stop_senate", "stop_social", "stop_eng", "stop_library", "stop_dam", "stop_market", "p2park"], "night", [
      v(W("female", "#c7d2fe"), "Can you wait till it comes?", [{ t: "watch", npc: "$who", secs: 90, r: 6, text: "Wait with them for the shuttle" }], "There it is. Thank you for waiting."),
      v(W("male", "#fed7aa"), "It's quiet tonight. Talk to me about anything.", [{ t: "watch", npc: "$who", secs: 90, r: 6, text: "Sit and talk till it comes" }], "Anything was perfect."),
      v(W("female", "#bbf7d0"), "My friend is late. Pretend to be my friend.", [{ t: "watch", npc: "$who", secs: 90, r: 6, text: "Be their friend for a bit" }], "You're a better friend than my friend.")],
      { cash: 0, standing: { community: 1 }, friend: { $who: 2 } }, "The driver arrives quickly.", { chance: .2, text: "You miss your own plan; they notice." }, { company: true }),

    E("e26", "Come and cheer", "escort", ["court", "social", "club"], "day", [
      v(W("male", "#86efac"), "We need noise. Bring noise.", [{ t: "watch", place: "court", secs: 120, r: 30, text: "Cheer at the court" }], "That noise was ours. We won!"),
      v(W("female", "#f9a8d4"), "If you cheer, we'll win. That's science.", [{ t: "watch", place: "social", secs: 120, r: 30, text: "Cheer at the Social Centre" }], "Science works!"),
      v(W("male", "#fde047"), "Shout my name. Not my nickname.", [{ t: "watch", place: "club", secs: 120, r: 30, text: "Cheer at the Racing Club" }], "You shouted my name! Correctly!")],
      { cash: 0, standing: { social: 1 } }, "They lose; nobody blames you.", { chance: .2, text: "You're pulled in to play.", then: { t: "sports", sport: "five-a-side", at: "court", text: "Play for them" } }, { company: true }),

    E("e27", "Push my car", "errand", ["@dept", "ee", "senate", "quarters", "kt"], "day", [
      v(W("male", "#e2e8f0"), "Young man, young woman, a small push.", [{ t: "look", npc: "$who", secs: 8, r: 4, text: "Push the car (third push)" }], "It's alive! Thank you."),
      v(W("female", "#fef3c7"), "It starts on the third push. Always the third.", [{ t: "look", npc: "$who", secs: 8, r: 4, text: "Push three times" }], "Third push. Always."),
      v(W("male", "#cbd5e1"), "Don't tell my students I drive this.", [{ t: "look", npc: "$who", secs: 8, r: 4, text: "Push the car" }], "Remember: you saw nothing.")],
      { cash: 0, standing: { department: 1 } }, "Three others push.", { chance: .2, text: "It's your own lecturer; test tomorrow." }),

    E("e28", "Deliver to my child", "errand", ["gate", "stop_gate", "market"], "day", [
      v(W("female", "#fde68a"), "Give this to Chidinma, Queen Amina, room 14.", [{ t: "delivery", item: "cooler", place: "amina", careful: true, text: "Deliver the cooler to Queen Amina" }], "Tell her Mummy says eat.", "A parent at the gate"),
      v(W("female", "#bbf7d0"), "Tell him his mother says eat. Then give him the cooler.", [{ t: "delivery", item: "cooler", place: "akenzua", careful: true, text: "Deliver the cooler to Akenzua" }], "His mother says eat. You heard me.", "A parent at the gate"),
      v(W("male", "#fca5a5"), "Don't open it. It's soup. It knows if you open it.", [{ t: "delivery", item: "cooler", place: "suleiman", careful: true, text: "Deliver the soup to Suleiman, unopened" }], "It knows. Remember.", "A parent at the gate")],
      { cash: 0, standing: { community: 1 }, food: true }, "The porter takes it.", { chance: .2, text: "The cooler is for the whole room." }),

    E("e29", "Take our picture", "escort", ["selfie", "love", "dam", "sculpture", "enggarden", "senate"], "any", [
      v(W("female", "#f0abfc"), "Snap us! Wait, wait, one more.", [{ t: "look", npc: "$who", secs: 5, r: 8, text: "Take their picture" }], "Perfect. One more. No, perfect."),
      v(W("male", "#a5f3fc"), "From below. Make us look tall.", [{ t: "look", npc: "$who", secs: 5, r: 8, text: "Take it from below" }], "We look like giants. Thank you."),
      v(W("female", "#fde68a"), "Get the letters in. All the letters.", [{ t: "look", place: "selfie", secs: 5, r: 12, text: "Get all the giant letters in" }], "All the letters! Even the G!")],
      { cash: 0, standing: { social: 1 } }, "A stranger takes it, cutting off heads.", { chance: .2, text: "They pull you into the photo." }, { company: true }),

    E("e30", "I am just tired", "escort", AMB.concat(["love", "facgarden", "dam", "selfie"]), "any", [
      v(W("female", "#e2e8f0"), "I'm okay. …Can you sit small?", [{ t: "social", place: "$here", secs: 60, emote: "sit", text: "" }], ""),
      v(W("male", "#e2e8f0"), "Don't ask me anything. Just stay a bit.", [{ t: "social", place: "$here", secs: 60, emote: "sit", text: "" }], ""),
      v(W("female", "#e2e8f0"), "Everybody is so busy. I'm busy being still.", [{ t: "social", place: "$here", secs: 60, emote: "sit", text: "" }], "")],
      { cash: 0, standing: { community: 1 }, hidden: true, remember: true }, "Nurse Hauwa's list gains a name.", null,
      { company: true, noMarker: true, noSting: true, note: "No objective marker, no reward shown, no music sting. Never play this for laughs." }),

    E("e31", "You get garri?", "give", ["@hostel", "akenzua", "suleiman", "amina", "ribadu", "dangote", "danfodio"], "any", [
      v(W("male", "#fde68a"), "How far? You get garri?", [{ t: "choice", prompt: "An empty cup, held out.", options: [{ label: "Give a cup of garri", friend: { $who: 3 }, set: "garri_given" }, { label: "“We are both in it, then.”", set: "garri_shared_hunger" }], text: "Garri?" }], "You're a real one.", "Standing in your doorway with an empty cup, saying nothing. Then:"),
      v(W("female", "#fed7aa"), "I'm not hungry. I'm just asking who has garri. For research.", [{ t: "choice", prompt: "For research.", options: [{ label: "Give a cup of garri", friend: { $who: 3 }, set: "garri_given" }, { label: "“We are both in it, then.”", set: "garri_shared_hunger" }], text: "Garri?" }], "The research is going well."),
      v(W("male", "#d9f99d"), "One cup. I'll pay you back in gratitude.", [{ t: "choice", prompt: "Paid in gratitude.", options: [{ label: "Give a cup of garri", friend: { $who: 3 }, set: "garri_given" }, { label: "“We are both in it, then.”", set: "garri_shared_hunger" }], text: "Garri?" }], "Gratitude: paid in full.")],
      { cash: 0, friend: { $who: 3 }, remember: "allowance_day" }, "We are both in it, then.", { chance: .2, text: "They bring groundnuts to go with it.", give: "groundnuts" },
      { needItem: "garri" })
  ];

  // Spawn rules from the bible, section 12 (tunable in one place; the engine enforces them).
  var ambientRules = { minGap: 180, twistChance: .2, rememberAfter: 2, giftAfter: 5, declineFree: true,
    never: ["mission_limit", "fight", "chase", "moment", "job", "lecture"], startsWith: "person" };

  // Bible section 13: bystander roles in a fight, with example lines (for the crowd/brawl code).
  var bystanders = [
    { role: "watcher", share: .35, lines: ["Ah ah!", "Wetin happen?"] },
    { role: "filmer", share: .15, lines: ["Wait, wait, I'm recording."] },
    { role: "laugher", share: .10, lines: ["Two of you no get work?"] },
    { role: "separator", share: .15, lines: ["E don do! Leave am!"] },
    { role: "caller", share: .10, lines: ["Security! Madam Whistle!"] },
    { role: "hype", share: .10, courtOnly: true, lines: ["Fight! Fight!"] },
    { role: "elder", share: .05, staffOnly: true, lines: ["Both of you. My office."] }
  ];

  /* ---------- stable voice ids ---------- */
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  side.forEach(function (m) {
    var k = 0, num = pad(+m.id.slice(1));
    m.steps.forEach(function (s) { (s.lines || []).forEach(function (l) { if (l[0] !== "") l[2] = "SD-s" + num + "-" + pad(++k); }); });
  });
  ambient.forEach(function (e) {
    var num = pad(+e.id.slice(1));
    e.variants.forEach(function (va, i) { var X = "ABC".charAt(i); va.askId = "AM-e" + num + "-v" + X + "-01"; if (va.thanks) va.thanksId = "AM-e" + num + "-th-" + X; });
    if (e.decline) e.declineId = "AM-e" + num + "-dc-01";
    if (e.help && e.help.line) e.help.line[2] = "AM-e" + num + "-hp-01";
  });

  D.STORY.push({ file: "side", year: 0, npcs: npcs, items: items, missions: [], side: side, ambient: ambient,
    ambientRules: ambientRules, bystanders: bystanders, coop: [] });
})();
