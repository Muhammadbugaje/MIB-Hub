/* Freshers School Life — Year 4 story (m79–m99), "Image", 400 level. Source: docs/story/scripts/Y4.md
   Data only (see docs/story/ENGINE.md). Voice ids are Y4-mNN-NN, stable.

   Changes from the script, with reasons (game constraints):
   - @place has no engine token: each placement step is written five times with `if: "placement_<id>"`.
     Places: mall plant room → market, dam station → dam, airfield → strip, campus radio → radio,
     Works → fire (the substation is the only Works site on the map). Bosses: mall and Works → aliyu,
     dam → baba (Baba Dam stands in for "Baba Dam's neighbour", who has no character), airfield → uche,
     radio → kabiru. The "stern stranger" for a mall placement without Aliyu's probation is not possible
     because flags from Year 2 cannot change a choice's boss; Aliyu is always the mall boss.
   - "Engineering quad" → `ee` (Faculty of Engineering, the quad centre); "security post" → `gate`;
     "Kanti Sports" → `mk_sports`; "Mall roof" → `market`; "tower stairs"/"spillway" → `strip`/`dam`;
     the hostel roof → `@hostel`. The map has no other ids.
   - Unnamed speakers (A COLLEAGUE, A FAN, WALKER, EVERYONE, FIRST/SECOND) are narration lines ("")
     prefixed with who speaks, except the colleague and the fan, who are small new people.
   - Echoes and the Mirror use the `shade` enemy (no `echo` enemy exists). The unwinnable Mirror fight
     is a 30-second `defend`; copying behaviour is not modelled. Logged in ENGINE_ISSUES.md.
   - New mechanics written with the nearest step: stamp gauntlet → go/talk chain; logbook routine →
     a choice; fishing → `look` at the Dam; the run between two parties → a timed `go`; payday sliders →
     four choice options; the debate → a timed choice whose options decide the election; the boat →
     `go` to the Dam; "escort ×5" → one `escort` with Lucky; "carry, four people" → `carry`.
   - m92 Version A (you are two-timing) needs a romance flag the engine does not expose; only Version B
     is playable. Version A is preserved in ENGINE_ISSUES.md.
   - Muhammad (m81) is the Kanti Sports shopkeeper here, as scripted; the roster reserves the name for
     the fresher in the last mission. Kept as written; id `muhammad`.
   - XP is left to the engine (computed from gates). */
(function () {
  "use strict";
  var D = window.SamaruData; D.STORY = D.STORY || [];
  D.STORY.push({
    file: "y4", year: 4,
    npcs: [
      { id: "registrar", name: "Mrs. Folake Adebayo", role: "Registry officer", at: "senate", skin: "#6b4226", hair: "bun", top: "#7c3aed", voice: "female", pitch: .95, hi: ["Where is your photocopy?", "Come back tomorrow.", "Triplicate. Always triplicate."] },
      { id: "bursar", name: "Mr. Clement", role: "Bursary clerk", at: "bank", skin: "#5e3a22", hair: "low", top: "#e2e8f0", voice: "male", pitch: .85, hi: ["Network.", "Receipt?", "The system is down. It is always down."] },
      { id: "khadija", name: "Dr. Khadija Mahmud", role: "Level adviser", at: "ee", skin: "#8a5633", hair: "hijab", hairCol: "#1e3a8a", top: "#f1f5f9", voice: "female", pitch: .95, hi: ["Rules are rules. Now, sit. Tell me.", "Have you seen your result?", "No student of mine is left behind."] },
      { id: "lucky", name: "Lucky", role: "Campus influencer", at: "ee", skin: "#74472a", hair: "fade", top: "#f97316", voice: "male", pitch: 1.2, hi: ["Guys, guys, guys—", "Don't move. Content.", "Like and subscribe, my brother."] },
      { id: "lily", name: "Lily", role: "Course mate (twin)", at: "ee", skin: "#7d4e2e", hair: "braids", top: "#22d3ee", voice: "female", pitch: 1.15, hi: ["We heard…", "Lyzzy, tell them.", "We noticed in week three."] },
      { id: "lyzzy", name: "Lyzzy", role: "Course mate (twin)", at: "ee", skin: "#7d4e2e", hair: "braids", top: "#a78bfa", voice: "female", pitch: 1.15, hi: ["…what Lily said.", "We have notes.", "We gave it till week six."] },
      { id: "sugar", name: "DJ Sugar", role: "Runs The Floor", at: "mk_dance", skin: "#663e24", hair: "afro", top: "#ec4899", voice: "female", pitch: 1.1, hi: ["On the one!", "Full floor, no fights.", "Shoulders! Yes!"] },
      { id: "bilkisu", name: "Sgt. Bilkisu", role: "Head of campus security", at: "gate", skin: "#5a361f", hair: "hijab", hairCol: "#1f2937", top: "#334155", voice: "female", pitch: .9, hi: ["First warning.", "I said walk.", "Nobody gets hurt on my shift."] },
      { id: "librarian", name: "Mrs. Shehu", role: "Librarian", at: "library", skin: "#7a4a2b", hair: "hijab", hairCol: "#7c2d12", top: "#fde68a", voice: "female", pitch: .9, hi: ["Shh.", "Whisper.", "Books back by Friday."] },
      { id: "abdul", name: "Abdul \"AB\"", role: "Flying Club cadet", at: "strip", romance: "f", skin: "#c99468", hair: "low", top: "#1d4ed8", voice: "male", pitch: 1.0, hi: ["Check.", "Copy that.", "Wind's from the east today."] },
      { id: "svitlana", name: "Svitlana", role: "Exchange student, Flying Club", at: "strip", skin: "#f1c7a5", hair: "bun", hairCol: "#facc15", top: "#e0f2fe", voice: "female", pitch: 1.05, hi: ["Jollof today? Please say jollof.", "In my country we say… no, I made it up.", "I am holding torch."] },
      { id: "mubarak", name: "Mubarak", role: "MIB Store assistant", at: "mibstore", skin: "#7d4e2e", hair: "low", top: "#f8fafc", voice: "male", pitch: 1.0, hi: ["I'm only informing you.", "Original. Made in Bugaje.", "That one is one of ten."] },
      { id: "asiya", name: "Aunty Asiya", role: "MIB Store manager", at: "mibstore", skin: "#d2a07a", hair: "hijab", hairCol: "#eab308", top: "#ffffff", voice: "female", pitch: 1.0, hi: ["Nice bike, abi?", "Money is stored effort.", "Have you seen my uncle today?"] },
      { id: "needle", name: "Alhaji Musa Needle", role: "Tailor", at: "mk_native", skin: "#6a4127", hair: "cap", hairCol: "#16a34a", top: "#fef3c7", voice: "male", pitch: .85, hi: ["Come back Thursday.", "Stand straight.", "A hem is a promise."] },
      { id: "chitech", name: "Chi-Tech", role: "Phone repairer", at: "mk_phones", skin: "#5e3a22", hair: "low", top: "#0ea5e9", voice: "male", pitch: 1.15, hi: ["It's the charging port.", "Drop it, I'll look.", "Network or battery? Both."] },
      { id: "aisha", name: "Aisha", role: "Fresher, Hajiya Ladi's daughter", at: "selfie", skin: "#8a5633", hair: "hijab", hairCol: "#db2777", top: "#fbcfe8", voice: "female", pitch: 1.2, hi: ["I'm a fresher. Nobody listens.", "Is that really you?", "Mama said greet you."] },
      { id: "sadiya", name: "Comrade Sadiya", role: "Student union president", at: "theatre", skin: "#6b4226", hair: "hijab", hairCol: "#dc2626", top: "#111827", voice: "female", pitch: 1.0, hi: ["Great students!", "Aluta!", "The students have spoken."] },
      { id: "joy", name: "Joy", role: "Campus radio intern", at: "radio", romance: "m", skin: "#7a4a2b", hair: "afro", top: "#fde047", voice: "female", pitch: 1.05, hi: ["Three, two… sorry. Habit.", "You're on air. Kidding.", "I have a list."] },
      { id: "aliyu", name: "Engr. Aliyu", role: "Works and Maintenance", at: "fire", skin: "#5a361f", hair: "cap", hairCol: "#ca8a04", top: "#1e40af", voice: "male", pitch: .85, hi: ["Change-over, change-over.", "My salary is late again.", "Don't touch that panel."] },
      { id: "muhammad", name: "Muhammad", role: "Kanti Sports shopkeeper", at: "mk_sports", skin: "#74472a", hair: "low", top: "#22c55e", voice: "male", pitch: 1.0, hi: ["They are good shoes.", "Size?", "Try them on."] },
      { id: "colleague", name: "Colleague", role: "Placement technician", at: "fire", skin: "#663e24", hair: "low", top: "#64748b", voice: "male", pitch: 1.0, hi: ["IT student? Sweep first.", "We don't speak of the kettle.", "Mind the live panel."] },
      { id: "fan", name: "A fan", role: "Student", at: "market", skin: "#7d4e2e", hair: "braids", top: "#f472b6", voice: "female", pitch: 1.25, hi: ["Do the move!", "Can I get a picture?", "It's them!"] }
    ],
    items: {
      stamp: { name: "Office stamp", price: 0, text: "One of four on your IT letter." },
      goats: { name: "A keke of goats", price: 0, text: "Colleagues, not content." },
      showticket: { name: "Fashion show ticket", price: 500, text: "MIB Store. Admit one model." },
      rice: { name: "Bag of uncooked rice", price: 0, text: "For drying a drowned phone." },
      connector: { name: "Screen connector", price: 0, text: "From the MIB Store's back shelf." },
      posters: { name: "Campaign posters", price: 0, text: "Comrade Sadiya, again." },
      fish: { name: "Fresh fish", price: 0, text: "For the eel's supper." },
      statue: { name: "Kelechi's sculpture", price: 0, text: "Heavy. Lift slowly." }
    },
    missions: [
      /* ---------------- Chapter 21 ---------------- */
      { id: "m79", ch: 21, year: 4, sem: 1, title: "IT letter", gate: 81, giver: "registrar", thread: "D", shape: "collect",
        intro: "One letter, four stamps, three offices, two \"come back tomorrow\"s and a bank queue. Then a choice of where you train for six months.",
        need: { done: ["m78"] }, music: { start: "motif_work", end: "motif_work" },
        steps: [
          { t: "talk", npc: "registrar", text: "Start the IT letter at the registry", lines: [["registrar", "Where is your photocopy? Of the form you have not yet collected? Exactly.", "Y4-m79-01"]] },
          { t: "go", place: "@dept", text: "Get the department stamp", give: "stamp" },
          { t: "talk", npc: "bursar", text: "Get the bursary stamp", lines: [["bursar", "Network.", "Y4-m79-02"], ["bursar", "…It has come. Quickly, before it goes.", "Y4-m79-03"]] },
          { t: "go", place: "bank", text: "Queue at the bank for the teller's stamp", turn: true, lines: [["", "At the bank, the queue is forty people and one is a goat."], ["garba", "Patience, my child. The one who queues well, eats well.", "Y4-m79-04"]] },
          { t: "talk", npc: "registrar", text: "Take the stamps back to the registry", give: "stamp" },
          { t: "talk", npc: "khadija", text: "See Dr. Khadija about the placement list", lines: [["khadija", "Five places. Choose where you will learn, not where you will be comfortable.", "Y4-m79-05"]] },
          { t: "choice", text: "Pick an industrial-training placement", prompt: "Where will you train for six months?", options: [
            { label: "Mall plant room (Engr. Aliyu)", set: ["placement_mall", "boss_aliyu"], boss: "aliyu" },
            { label: "Dam station (Baba Dam)", set: ["placement_dam", "boss_baba"], boss: "baba" },
            { label: "Airfield (Captain Uche)", set: ["placement_air", "boss_uche"], boss: "uche" },
            { label: "Campus radio (DJ Kabiru)", set: ["placement_radio", "boss_kabiru"], boss: "kabiru" },
            { label: "Works and Maintenance (Engr. Aliyu)", set: ["placement_works", "boss_aliyu"], boss: "aliyu" }] }],
        fail: { text: "The office is closed. Come back tomorrow. (Really.)", resume: 0, wait: "tomorrow" },
        reward: { cash: 1500, standing: { department: 2 } },
        around: { radio: [["kabiru", "Four hundred level, your IT letters are ready. \"Ready\" is doing a lot of work there.", "Y4-m79-06"]], walker: ["I have been in this queue since I was a fresher."] } },

      { id: "m80", ch: 21, year: 4, sem: 1, title: "First day at work", gate: 82, giver: "@boss", thread: "D", shape: "routine",
        intro: "Your supervisor hands you a broom. Then a clipboard. Then, by Friday, a spanner. Fill the logbook every day, or all of it on Friday night with a different pen.",
        need: { done: ["m79"] }, music: { start: "motif_work", end: "motif_work" },
        steps: [
          { t: "go", place: "market", if: "placement_mall", text: "Report at the mall plant room at eight", lines: [["@boss", "IT student? Good. Sweep. Then we see who you are.", "Y4-m80-01"]] },
          { t: "go", place: "dam", if: "placement_dam", text: "Report at the dam station at eight", lines: [["@boss", "IT student? Good. Sweep. Then we see who you are.", "Y4-m80-02"]] },
          { t: "go", place: "strip", if: "placement_air", text: "Report at the airfield at eight", lines: [["@boss", "IT student? Good. Sweep. Then we see who you are.", "Y4-m80-03"]] },
          { t: "go", place: "radio", if: "placement_radio", text: "Report at the radio studio at eight", lines: [["@boss", "IT student? Good. Sweep. Then we see who you are.", "Y4-m80-04"]] },
          { t: "go", place: "fire", if: "placement_works", text: "Report at the Works substation at eight", lines: [["@boss", "IT student? Good. Sweep. Then we see who you are.", "Y4-m80-05"]] },
          { t: "job", kind: "errand", text: "Sweep, read the gauges, fetch the right spanner", lines: [["", "On a job: site overalls on. The \"on a job\" banner shows your tasks."]] },
          { t: "choice", text: "Keep the logbook this week", prompt: "Each evening the logbook waits.", options: [
            { label: "Write it up every evening", set: "logbook_honest", standing: { academics: 1 } },
            { label: "Fill all five days on Friday night", set: "logbook_friday" }] },
          { t: "talk", npc: "colleague", text: "Answer the Friday fault call", turn: true, give: "fuse", lines: [["", "Friday: a real fault, and everyone senior is at lunch."], ["colleague", "Don't touch it. …Do you know what it is? Then touch it. Carefully.", "Y4-m80-06"]] },
          { t: "build", parts: { fuse: 1 }, place: "market", if: "placement_mall", text: "Tighten, reset and restart the unit" },
          { t: "build", parts: { fuse: 1 }, place: "dam", if: "placement_dam", text: "Tighten, reset and restart the unit" },
          { t: "build", parts: { fuse: 1 }, place: "strip", if: "placement_air", text: "Tighten, reset and restart the unit" },
          { t: "build", parts: { fuse: 1 }, place: "radio", if: "placement_radio", text: "Tighten, reset and restart the unit" },
          { t: "build", parts: { fuse: 1 }, place: "fire", if: "placement_works", text: "Tighten, reset and restart the unit" },
          { t: "talk", npc: "@boss", if: "logbook_honest", text: "Hand your boss the logbook", lines: [["@boss", "Five days, five pens' worth of truth. Good. Monday you get keys.", "Y4-m80-07"]] },
          { t: "talk", npc: "@boss", if: "logbook_friday", text: "Hand your boss the logbook", lines: [["@boss", "Same ink. Same hand. Same hour. I was a student too. Do better.", "Y4-m80-08"]] }],
        reward: { cash: 3000, standing: { department: 3 } },
        around: { phone: [["@roomie", "You have a job with a uniform? Bring food from there. All jobs have food.", "Y4-m80-09"]], walker: ["The last IT student broke the kettle. We don't speak of it."] } },

      { id: "m81", ch: 21, year: 4, sem: 1, title: "Lucky goes viral", gate: 83, giver: "lily", thread: "F", shape: "social",
        intro: "Somebody filmed your dance at The Floor and put a beat under it. By lunch the whole school has seen it, and a brand wants your feet.",
        need: { done: ["m80"] }, music: { start: "place_floor", turn: "sting_reveal", end: "motif_crew" },
        steps: [
          { t: "rhythm", text: "Dance one song at The Floor", lines: [["sugar", "On the one! Who is that? Give them space!", "Y4-m81-01"]] },
          { t: "sleep", text: "Sleep it off at your hostel" },
          { t: "go", place: "ee", text: "Walk to the Engineering quad", turn: true, lines: [["", "People are doing your move back at you."], ["lily", "You're trending.", "Y4-m81-02"], ["lyzzy", "We sent it to four groups. You're welcome.", "Y4-m81-03"], ["lucky", "Guys, guys, guys— it's them! I filmed it! Tell them I filmed it!", "Y4-m81-04"]] },
          { t: "talk", npc: "lucky", text: "Hear Lucky's plans for you", lines: [["lucky", "Kanti Sports wants you in their shoes. Zobo Fizz wants you holding a bottle. I take ten per cent.", "Y4-m81-05"]] },
          { t: "go", place: "mk_sports", text: "Go to Kanti Sports in the mall", lines: [["muhammad", "They are good shoes. I would say so even if I were not paid to.", "Y4-m81-06"]] },
          { t: "choice", text: "Decide on the brand deals", prompt: "Muhammad holds out a box.", options: [
            { label: "Take the shoes only (you like them)", set: ["deal_shoes", "fame"], standing: { social: 3 } },
            { label: "Take the drink money too", set: ["deal_drink", "fame"], money: 5000 },
            { label: "Take nothing", set: ["deal_none", "fame"], standing: { community: 2 } }] }],
        reward: { cash: 0, standing: { fame: 5 } },
        around: { radio: [["kabiru", "Trending on campus: a certain somebody at The Floor. You know yourself.", "Y4-m81-07"]], phone: [["phone:sibling", "IS THAT YOU? Mum has watched it eleven times. Send more.", "Y4-m81-08"]] } },

      { id: "m82", ch: 21, year: 4, sem: 1, title: "The collab", gate: 84, giver: "lucky", thread: "F", shape: "prank",
        intro: "Lucky wants three stunts for one video: a wheelie down the boulevard, a wave from the Senate steps, a keke full of goats. Then you go to buy socks and forty people want a picture.",
        need: { done: ["m81"] }, music: { start: "chase", turn: "sting_reveal", end: "motif_crew" },
        fail: { text: "Mobbed. You pose for forty photographs and lose an hour.", resume: 7, wait: "now", cost: { energy: 10 } },
        steps: [
          { t: "ride", veh: "bike", text: "Pop a wheelie past the fountain", lines: [["lucky", "Again! I had my thumb on the lens!", "Y4-m82-01"]] },
          { t: "emote", emote: "wave", at: "senate", text: "Wave from the Senate steps", lines: [["garba", "Is this for school? …Carry on. But greet first.", "Y4-m82-02"]] },
          { t: "go", place: "stalls", text: "Collect the goats at the roadside stalls", give: "goats" },
          { t: "ride", veh: "keke", text: "Get in the keke with the goats" },
          { t: "delivery", item: "goats", place: "gate", careful: true, text: "Drive the goats to the Main Gate, gently", fail: { text: "A goat jumped out. Round them up and try again.", resume: 2, wait: "now" } },
          { t: "go", place: "market", text: "Go and buy socks at the mall", turn: true, lines: [["", "A whisper. Then a crowd."], ["fan", "It's them! Do the move! Do the move!", "Y4-m82-03"]] },
          { t: "stealth", place: "mk_barber", guards: 2, text: "Slip through the crowd to Sly's barber chair", lines: [["sly", "Sly has you. Sit. Nobody looks at a man in a cape.", "Y4-m82-04"]] },
          { t: "go", place: "stop_market", text: "Reach the mall exit without running" },
          { t: "phone", npc: "@roomie", incoming: true, text: "Answer your roommate", lines: [["@roomie", "I saw the goat video. You have time for goats. Hm. Okay.", "Y4-m82-05"]] }],
        reward: { cash: 3000, standing: { social: 4, fame: 5 }, friend: { "@roomie": -2 }, flags: ["collab_done"] },
        around: { radio: [["kabiru", "A reminder that goats are not content. They are colleagues.", "Y4-m82-06"]], walker: ["I touched their sleeve. I'm not washing this hand."] } },

      { id: "m83", ch: 21, year: 4, sem: 1, title: "Echo", gate: 85, giver: "audu", thread: "M", shape: "investigation",
        intro: "Mai Shayi says you were rude to him last night. You were asleep last night. Sgt. Bilkisu has three complaints with your face on them.",
        need: { done: ["m82"] }, music: { start: "face_mirror", turn: "tension_low", end: "motif_school" },
        fail: { text: "It walks off wearing your walk. A fourth complaint appears. Try again tonight.", resume: 6, wait: "dusk" },
        steps: [
          { t: "talk", npc: "audu", text: "Ask Mai Shayi Audu why he won't pour", lines: [["audu", "Last night you pushed my bench and laughed. No tea.", "Y4-m83-01"], ["audu", "…You didn't? Hm. It laughed like you. But it did not greet. You always greet.", "Y4-m83-02"]] },
          { t: "go", place: "gate", text: "Go to the security post at the Main Gate" },
          { t: "talk", npc: "bilkisu", text: "Hear Sgt. Bilkisu's complaints", lines: [["bilkisu", "Three complaints. Same face. Same night. Three places at once. Explain.", "Y4-m83-03"]] },
          { t: "talk", npc: "librarian", text: "Get your alibi from Mrs. Shehu at the Library", lines: [["librarian", "Shh. …Yes. Eight till ten. They turned pages too loudly.", "Y4-m83-04"]] },
          { t: "talk", npc: "nkechi", text: "Get your alibi from Mama Nkechi (you paid a debt)" },
          { t: "talk", npc: "@roomie", text: "Get your alibi from your roommate (you snored)" },
          { t: "go", place: "court", night: true, text: "Go to the basketball court after dark", turn: true, lines: [["", "Under a dead lamp: yourself, doing your dance move slightly wrong, over and over."]] },
          { t: "fight", enemy: "shade", n: 1, at: "court", text: "Beat the Echo: do what it hasn't seen", lines: [["", "It copies the last move it saw. Greet it, block, or emote, and it stalls."]] },
          { t: "talk", npc: "bilkisu", text: "Report back to Sgt. Bilkisu", lines: [["bilkisu", "I saw it too. I'm writing \"under investigation\". I don't have a box for this.", "Y4-m83-05"]] }],
        reward: { cash: 3000, standing: { community: 2 }, flags: ["echo_seen"] },
        around: { radio: [["kabiru", "A reminder that not everything you watch on a phone happened the way it looks.", "Y4-m83-06"]], walker: ["I greeted you yesterday and you looked through me. Was that you?"] } },

      /* ---------------- Chapter 22 ---------------- */
      { id: "m84", ch: 22, year: 4, sem: 1, title: "Workplace accident", gate: 86, giver: "@boss", thread: "D", shape: "care",
        intro: "A colleague is down. Stop the bleeding, keep them talking, drive to the Sick Bay gently. And be back at your post when Dr. Okonkwo walks in unannounced.",
        need: { done: ["m83"] }, music: { start: "tension_mid", turn: "motif_work", end: "quiet" },
        steps: [
          { t: "talk", npc: "colleague", text: "Answer the shout from the workshop floor", turn: true, lines: [["colleague", "My hand! It was off! I swear it was off!", "Y4-m84-01"]] },
          { t: "care", npc: "colleague", place: "sickbay", text: "First aid, then drive gently to the Sick Bay", lines: [["", "Switch off the supply; press and wrap; raise the arm. Then no hard bumps."], ["colleague", "Tell me something. Anything. Tell me about that goat video.", "Y4-m84-02"]], fail: { text: "Rough driving: he yelps, Hauwa scolds you. Try again, gently.", resume: 1, wait: "now" } },
          { t: "talk", npc: "hauwa", text: "Hand him over to Nurse Hauwa", lines: [["hauwa", "Clean wrap. Who taught you? …I did? Good. I'm an excellent teacher.", "Y4-m84-03"]] },
          { t: "go", place: "market", if: "placement_mall", text: "Get back to your post", lines: [["", "Dr. Okonkwo is standing at your bench reading your logbook."]] },
          { t: "go", place: "dam", if: "placement_dam", text: "Get back to your post", lines: [["", "Dr. Okonkwo is standing at your bench reading your logbook."]] },
          { t: "go", place: "strip", if: "placement_air", text: "Get back to your post", lines: [["", "Dr. Okonkwo is standing at your bench reading your logbook."]] },
          { t: "go", place: "radio", if: "placement_radio", text: "Get back to your post", lines: [["", "Dr. Okonkwo is standing at your bench reading your logbook."]] },
          { t: "go", place: "fire", if: "placement_works", text: "Get back to your post", lines: [["", "Dr. Okonkwo is standing at your bench reading your logbook."]] },
          { t: "quiz", subject: "ee", n: 4, pass: 3, npc: "okonkwo", text: "Answer Dr. Okonkwo's questions on the fault", lines: [["okonkwo", "Why was it live? Don't tell me who. Tell me why. Are we together?", "Y4-m84-04"]], set: "siwes_visit_good" },
          { t: "turn", text: "Hear Dr. Okonkwo's verdict", lines: [["okonkwo", "Hm. Next question. …There is no next question. That was a compliment.", "Y4-m84-05"]] }],
        reward: { cash: 3000, standing: { department: 4, community: 3 } },
        around: { phone: [["@boss", "He's fine. Six stitches. He says you talk too much while driving. Good work.", "Y4-m84-06"]], walker: ["Okonkwo went to somebody's IT place without warning. Pray for them."] } },

      { id: "m85", ch: 22, year: 4, sem: 1, title: "Payday", gate: 87, giver: "mum", thread: "F", shape: "choice",
        intro: "Your first real allowance: ₦60,000. Home needs some. A friend needs some. And the MIB Store has had a white and gold okada in the window since Year 2.",
        need: { done: ["m84"] }, music: { start: "motif_home", turn: "motif_market", end: "motif_home" },
        steps: [
          { t: "go", place: "bank", text: "Collect your allowance at the bank", lines: [["bursar", "Network. …It has paid. Congratulations. Next.", "Y4-m85-01"]] },
          { t: "phone", contact: "mum", incoming: true, text: "Answer Mum", lines: [["phone:mum", "You've been paid? Don't send us anything. Your father's generator is fine. It is not fine. Don't send.", "Y4-m85-02"]] },
          { t: "talk", npc: "@roomie", text: "Meet your roommate at the buka", lines: [["@roomie", "My cousin's fees are due Friday. I'm not asking. I'm only saying it aloud near you.", "Y4-m85-03"]] },
          { t: "go", place: "mibstore", text: "Look at the okada in the MIB Store", turn: true, lines: [["mubarak", "White and gold. One of ten. I'm only informing you.", "Y4-m85-04"], ["asiya", "Money is stored effort. Spend it on what stores well. My uncle says that. I say: nice bike.", "Y4-m85-05"]] },
          { t: "choice", text: "Split the ₦60,000", prompt: "How do you split ₦60,000?", options: [
            { label: "Mostly home (₦30k home, ₦15k friend, ₦15k you)", set: "payday_home", money: 15000, standing: { community: 3 }, lines: [["phone:dad", "The generator is working. Your mother is telling the street.", "Y4-m85-06"]] },
            { label: "Mostly your friend (₦15k home, ₦30k friend, ₦15k you)", set: "payday_friend", money: 15000, friend: { "@roomie": 6 } },
            { label: "Even thirds (₦20k each)", set: ["payday_home", "payday_friend"], money: 20000, standing: { community: 1 }, friend: { "@roomie": 3 } },
            { label: "Mostly you (₦10k home, ₦10k friend, ₦40k you)", set: "payday_self", money: 40000, standing: { social: 3 } }] }],
        reward: { cash: 0 },
        around: { radio: [["radio", "MIB Store. Original. Made in Bugaje.", "Y4-m85-07"]] } },

      { id: "m86", ch: 22, year: 4, sem: 1, title: "Old friends, new friends", gate: 88, giver: "@roomie", thread: "F", shape: "race",
        intro: "Your roommate's birthday at the buka and Lucky's rooftop party are the same night. You can make both if nothing goes wrong.",
        need: { done: ["m85"] }, music: { start: "motif_crew", end: "motif_crew" },
        fail: { text: "Late to both: you get half of each and the worst of both.", resume: 4, wait: "now" },
        steps: [
          { t: "phone", npc: "@roomie", incoming: true, text: "Answer your roommate", lines: [["@roomie", "Seven. Mama Nkechi's. Small thing. Just come.", "Y4-m86-01"]] },
          { t: "phone", npc: "lucky", incoming: true, text: "Answer Lucky", lines: [["lucky", "Eight! Roof! There will be a drone! You're the reason people are coming!", "Y4-m86-02"]] },
          { t: "buy", item: "chocolate", text: "Buy a birthday gift" },
          { t: "eat", place: "buka", text: "Sit and eat at the buka by seven", lines: [["nkechi", "You, sit. You're thin. Fame is not food.", "Y4-m86-03"]] },
          { t: "go", place: "market", limit: 60, text: "Get to the mall roof before 7:50", turn: true, lines: [["", "Traffic, a shuttle, fans. Leave now or miss the drone shot."]] },
          { t: "look", place: "market", secs: 6, text: "Join Lucky's party on the roof", lines: [["lucky", "They're here! Guys, guys, guys—", "Y4-m86-04"]] },
          { t: "choice", text: "It's 8:40. The buka is cutting the cake", prompt: "At 8:40 the buka is cutting the cake.", options: [
            { label: "Ride back for the cake", set: "birthday_back", friend: { "@roomie": 5, lucky: -3 } },
            { label: "Stay for the photographs", set: "birthday_missed", standing: { fame: 4 }, friend: { "@roomie": -5 }, lines: [["", "You return to an empty buka and a slice under a bowl with a note: \"It's fine.\""]] }] }],
        reward: { cash: 0 },
        around: { radio: [["radio", "Happy birthday to a certain roommate. Caller says the celebrant's friend is \"very busy these days\".", "Y4-m86-05"]], walker: ["I was at the roof thing. Who was it for? Nobody knew."] } },

      { id: "m87", ch: 22, year: 4, sem: 1, title: "Night flight", gate: 90, giver: "uche", thread: "M", shape: "flight",
        intro: "The old control tower has been locked since before Captain Uche. The fourth plaque is inside, and its coil needs a beacon lined up from the air, in the dark, on three passes.",
        need: { done: ["m86"] }, music: { start: "place_airfield_night", turn: "sting_coil", end: "motif_light" },
        fail: { text: "Missed pass: go round. The beam holds its progress.", resume: 5, wait: "now" },
        steps: [
          { t: "talk", npc: "uche", text: "See Captain Uche at the Flying Club", lines: [["uche", "\"For the tower. Not for you.\" That was the note. I have wondered for nine years.", "Y4-m87-01"]] },
          { t: "go", place: "strip", night: true, text: "Climb the old control tower", lines: [["", "Dust, a radio set, a coil the height of a door. Plaque: \"4. Where the sky is watched.\""], ["abdul", "The beacon mirror is out of line. Somebody has to be up there to see it. Check.", "Y4-m87-02"]] },
          { t: "fight", enemy: "shade", n: 3, at: "strip", text: "Get past the Echoes on the stairs", lines: [["", "Three figures wear your flying jacket. Do what they have not seen."]] },
          { t: "ride", veh: "plane", text: "Take off by runway lamps only", lines: [["svitlana", "I am holding torch on the mirror. Tell me left, tell me right. Also I am hungry.", "Y4-m87-03"]] },
          { t: "flight", route: ["strip", "dam", "strip"], text: "Fly through the beacon beam, three passes" },
          { t: "flight", route: ["enggarden", "strip"], text: "Line up the beam on the last pass", turn: true, lines: [["", "The beam locks. Every Echo on the field turns to look at it, and is gone."]] },
          { t: "go", place: "strip", text: "Land on the runway", lines: [["uche", "Nicely done. …I'm not going to say \"do it again\". Not tonight.", "Y4-m87-04"]] }],
        reward: { cash: 15000, standing: { academics: 1, street: 1, social: 1, community: 1, department: 1 }, flags: ["coil4"] },
        around: { radio: [["radio", "Four.", "Y4-m87-05"]], phone: [["maker", "I had forgotten the sky one could sing. Good. Rest.", "Y4-m87-06"]] } },

      { id: "m88", ch: 22, year: 4, sem: 1, title: "Fashion show", gate: 91, giver: "needle", thread: "W", shape: "rhythm",
        intro: "Alhaji Needle's collection on a runway through the mall. He needs a model who can walk and turn. Aunty Asiya has smuggled an MIB capsule into the line-up.",
        need: { done: ["m87"] }, music: { start: "place_floor", end: "sting_pass" },
        steps: [
          { t: "talk", npc: "needle", text: "Find Alhaji Needle at his tailor shop", lines: [["needle", "You are famous now? Good. Famous people stand straight. Stand straight.", "Y4-m88-01"]] },
          { t: "buy", item: "showticket", text: "Buy a show ticket at the MIB Store", lines: [["asiya", "Wear number seven for me. It's not on his list. It will be.", "Y4-m88-02"]] },
          { t: "rhythm", text: "Walk the runway: walk, pause, turn on the beat", lines: [["sugar", "On the one! Shoulders! Yes!", "Y4-m88-03"]] },
          { t: "talk", npc: "svitlana", text: "Help Svitlana backstage", turn: true, lines: [["", "Backstage, Svitlana's outfit has lost a button and she is on next."], ["svitlana", "In my country we say: no button, no problem. We do not say that. I made it up. Help.", "Y4-m88-04"]] },
          { t: "choice", text: "Decide about your sash", prompt: "Svitlana is on next.", options: [
            { label: "Lend her your sash and walk plain", set: "show_sash", standing: { community: 3 }, friend: { svitlana: 8 } },
            { label: "Keep your look", set: "show_look", standing: { social: 4 } }] },
          { t: "rhythm", text: "Walk number seven, the MIB capsule", lines: [["needle", "That is not mine. …It is good. I am angry that it is good.", "Y4-m88-05"]] }],
        reward: { cash: 4000 },
        around: { radio: [["radio", "The mall has a runway tonight. The escalator is jealous.", "Y4-m88-06"]], walker: ["Needle and the MIB woman are not speaking. They are both smiling. It is terrifying."] } },

      /* ---------------- Chapter 23 ---------------- */
      { id: "m89", ch: 23, year: 4, sem: 2, title: "Cancelled", gate: 92, giver: "lily", thread: "F", shape: "social",
        intro: "A clip of \"you\" shoving a fresher. It is an Echo. Lucky posted it first and asked questions never.",
        need: { done: ["m88"] }, music: { start: "quiet", turn: "sting_break", end: "quiet" },
        steps: [
          { t: "go", place: "ee", text: "Walk into the Engineering quad", lines: [["", "Nobody does the move today. People step aside."], ["lily", "We didn't send this one.", "Y4-m89-01"], ["lyzzy", "We want that on record. This one, we didn't send.", "Y4-m89-02"]] },
          { t: "phone", npc: "lucky", incoming: false, text: "Call Lucky", lines: [["lucky", "Guys, guys— leave a message, and like and subscribe.", "Y4-m89-03"]] },
          { t: "go", place: "@hostel", text: "Walk back to your hostel", turn: true, lines: [["", "A long walk. Walker: \"I used to like them.\""]] },
          { t: "turn", if: "deal_drink", text: "Keep walking", lines: [["", "Walker: \"If you took the drink money, you can take a fresher's lunch.\""]] },
          { t: "talk", npc: "@roomie", if: "birthday_back", text: "Talk to your roommate", lines: [["@roomie", "I know it's not you. You came back for cake. That thing wouldn't.", "Y4-m89-04"]] },
          { t: "talk", npc: "@roomie", if: "birthday_missed", text: "Talk to your roommate", lines: [["@roomie", "I don't think it's you. I'd like to be surer. That's all.", "Y4-m89-05"]] },
          { t: "eat", place: "buka", text: "Go to the buka", lines: [["nkechi", "Eat. People talk. Rice does not.", "Y4-m89-06"]] }],
        fail: { text: "You started a fight with a heckler. Bystanders filmed it. Walk away this time.", resume: 2, wait: "now" },
        reward: { cash: 0, standing: { fame: -6, social: -8 }, flags: ["cancelled"] },
        around: { radio: [["kabiru", "I'm not going to comment on a video. I'm going to play a song. A long one.", "Y4-m89-07"]], phone: [["phone:mum", "I saw something. I don't believe it. Have you eaten?", "Y4-m89-08"]] } },

      { id: "m90", ch: 23, year: 4, sem: 2, title: "Touch grass", gate: 93, giver: "baba", thread: "W", shape: "routine",
        intro: "Baba Dam does not own a phone. He owns a boat and a great deal of patience. Go fishing. Say nothing. A day off.",
        need: { done: ["m89"] }, music: { start: "quiet", end: "quiet" },
        steps: [
          { t: "talk", npc: "baba", text: "Meet Baba Dam at the boat", lines: [["baba", "The water hears. So today we don't talk. Sit that side.", "Y4-m90-01"]] },
          { t: "look", place: "dam", secs: 20, text: "Fish from the boat. No score. No timer." },
          { t: "turn", text: "Listen", lines: [["baba", "The eel has been restless. Something warm under the wall has woken. Not today's matter.", "Y4-m90-02"]] },
          { t: "look", place: "dam", secs: 15, text: "Fish a while longer" },
          { t: "eat", place: "dam", text: "Eat roast fish on the bank", lines: [["baba", "When they shout your name, they don't know you. When they curse it, they still don't.", "Y4-m90-03"], ["baba", "The fish doesn't know your name. See how peaceful.", "Y4-m90-04"]] },
          { t: "phone", npc: "chitech", incoming: true, text: "Switch your phone back on", lines: [["", "Forty-one messages. One matters."], ["chitech", "Somebody brought a wet phone. Your face is in it. The REAL one. Come.", "Y4-m90-05"]] }],
        reward: { cash: 0, standing: { community: 2 }, friend: { baba: 6 }, flags: ["rested"] },
        around: {} },

      { id: "m91", ch: 23, year: 4, sem: 2, title: "The real clip", gate: 94, giver: "chitech", thread: "M", shape: "collect",
        intro: "Somebody's phone caught the real thing and fell in the fountain. Chi-Tech can save it for three favours. Then you find Lucky on the hostel roof with an Echo of his own.",
        need: { done: ["m90"] }, music: { start: "tension_low", end: "motif_crew" },
        steps: [
          { t: "talk", npc: "chitech", text: "See Chi-Tech at the phone shop", lines: [["chitech", "It's the charging port. It's always the charging port. Also it was under water.", "Y4-m91-01"], ["chitech", "I need rice (a bag, uncooked), a part from the MIB Store, and the owner's permission.", "Y4-m91-02"]] },
          { t: "talk", npc: "ladi", text: "Get a bag of rice from Hajiya Ladi", give: "rice" },
          { t: "talk", npc: "mubarak", text: "Get a screen connector from Mubarak", give: "connector" },
          { t: "talk", npc: "aisha", text: "Find the phone's owner by the fountain", lines: [["aisha", "I saw it happen! I was going to tell people. Then my phone drowned. I'm a fresher; nobody listens.", "Y4-m91-03"]] },
          { t: "watch", place: "mk_phones", secs: 6, text: "Watch the recovered clip", take: "rice", lines: [["", "Two of you in frame: one shoving, one twenty metres behind, carrying books."]] },
          { t: "go", place: "@hostel", text: "Climb to your hostel roof", turn: true, lines: [["", "Lucky is on the water tank. Below, a second Lucky is telling jokes to a crowd, and they are landing."], ["lucky", "It's funnier than me. Look at them. They can't tell.", "Y4-m91-04"], ["lucky", "I posted yours without checking. Because checking is slow and first is first.", "Y4-m91-05"], ["lucky", "I'm broke, you know. All of this, and I eat garri most nights. Don't tell them.", "Y4-m91-06"]] },
          { t: "choice", text: "Decide who posts the real clip", prompt: "He holds out his phone.", options: [
            { label: "Let him post it, with an apology", set: ["clip_real", "lucky_ally"], friend: { lucky: 8 } },
            { label: "Post it yourself", set: ["clip_real", "lucky_rival"], standing: { social: 2 } }] }],
        reward: { cash: 2000, standing: { social: 4 }, flags: ["aisha_fresher"] },
        around: { radio: [["kabiru", "New video. Watch to the end. Then watch your own mouth next time. I'm talking to me too.", "Y4-m91-07"]], walker: ["So there were two of them? I KNEW the dancing one was too nice."] } },

      { id: "m92", ch: 23, year: 4, sem: 2, title: "Double booking", gate: 95, giver: "@roomie", thread: "R", shape: "social",
        intro: "Two people were promised the same evening. This time it is your roommate, and you have to help them face it.",
        need: { done: ["m91"] }, music: { start: "motif_heart", end: "sting_friend" },
        steps: [
          { t: "phone", npc: "@roomie", incoming: true, text: "Answer your roommate", lines: [["@roomie", "I have done something. Come. Bring nothing sharp.", "Y4-m92-01"]] },
          { t: "go", place: "shinkafi", text: "Meet your roommate at Shinkafi", lines: [["@roomie", "I didn't say yes to both. I just didn't say no to either. That's different.", "Y4-m92-02"]] },
          { t: "look", place: "shinkafi", secs: 6, text: "Watch both dates arrive", turn: true },
          { t: "talk", npc: "@roomie", text: "Coach your roommate: first sentence" },
          { t: "talk", npc: "@roomie", text: "Coach your roommate: second sentence" },
          { t: "talk", npc: "@roomie", text: "Coach your roommate: the truth", lines: [["", "One of them laughs. The other takes the suya and goes. It is fair."]], set: "twotimed_clean" }],
        reward: { cash: 0, friend: { "@roomie": 4 } },
        around: { radio: [["radio", "Tonight's letter is from two people who discovered they had one thing in common.", "Y4-m92-03"]], walker: ["They split the bill between themselves and left him with the bones."] } },

      { id: "m93", ch: 23, year: 4, sem: 2, title: "Cook-off", gate: 96, giver: "nkechi", thread: "W", shape: "rhythm",
        intro: "The food court is half the price and the buka is half empty. She will not ask for help. Ask her anyway. Three dishes, the whole school voting with its mouth.",
        need: { done: ["m92"] }, music: { start: "motif_market", end: "motif_market" },
        steps: [
          { t: "go", place: "buka", text: "Go to Mama Nkechi's buka", lines: [["", "Six empty tables."], ["nkechi", "I'm fine. Sit. You're thin. …They sell rice in a paper box. A box!", "Y4-m93-01"]] },
          { t: "talk", npc: "kabiru", text: "Ask DJ Kabiru to host a cook-off", lines: [["kabiru", "Buka versus food court. Live. I'll commentate. I've been practising on football.", "Y4-m93-02"]] },
          { t: "talk", npc: "ladi", text: "Get pepper from Hajiya Ladi" },
          { t: "talk", npc: "baba", text: "Get fish from Baba Dam", give: "fish" },
          { t: "go", place: "stalls", text: "Get palm oil from the roadside stalls", take: "fish" },
          { t: "rhythm", text: "Cook on the beat: jollof, egusi, garri deluxe", lines: [["nkechi", "Stir like you mean it! That pot can hear doubt!", "Y4-m93-03"]] },
          { t: "look", place: "mk_food", secs: 6, text: "Watch the food court chef taste hers", turn: true, lines: [["", "The food court's chef tastes hers, puts down his spoon, and asks for the recipe."], ["nkechi", "It's in a book. In my husband's hand. You can't have it. You can have a job.", "Y4-m93-04"]] },
          { t: "social", place: "social", secs: 20, text: "Wait for the school's vote at the Social Centre", lines: [["", "The school votes. Your cooking tips it. (If it doesn't, the buka still fills: everybody tasted it.)"]] }],
        reward: { cash: 4000, standing: { community: 4 }, flags: ["buka_saved"] },
        around: { radio: [["kabiru", "She is stirring. He is plating. Somebody at the back has fainted from the smell.", "Y4-m93-05"]], walker: ["Garri deluxe. With milk. And ice. I have seen the future."] } },

      /* ---------------- Chapter 24 ---------------- */
      { id: "m94", ch: 24, year: 4, sem: 2, title: "Election day", gate: 97, giver: "yakubu", thread: "W", shape: "delivery",
        intro: "Comrade Sadiya is running again and Yakubu is her manager. Posters, a debate card that says \"second speaker\", and a ballot box that turns out to be under the returning officer's chair.",
        need: { done: ["m93"] }, music: { start: "motif_work", end: "motif_school" },
        steps: [
          { t: "job", kind: "errand", text: "Put up Sadiya's posters around campus", give: "posters", lines: [["yakubu", "For the record, I measured the walls. We have eleven per cent more wall.", "Y4-m94-01"]] },
          { t: "go", place: "theatre", text: "Go to Theatre CD for debate night", take: "posters", lines: [["sadiya", "Great students! (Great!)", "Y4-m94-02"]] },
          { t: "turn", text: "Read the card Yakubu hands you", lines: [["", "Yakubu hands you a card: you are second speaker."]] },
          { t: "choice", clock: 30, text: "Make your argument before the clock runs out", prompt: "Pick your strongest point.", options: [
            { label: "Lights on every path, and a date for it", set: "sadiya_won", standing: { community: 2 } },
            { label: "Water in the hostels before the strike talk", set: "sadiya_won", standing: { community: 2 } },
            { label: "The other side wears ugly shirts", set: "sadiya_lost", standing: { social: -1 } }] },
          { t: "social", place: "senate", secs: 20, text: "Settle disputes at the polling point", lines: [["", "A queue-jumper, a \"missing\" box (it's under the chair), two agents fighting over a pen."], ["bilkisu", "Nobody has thrown anything. In my experience that is a successful election.", "Y4-m94-03"]] },
          { t: "talk", npc: "sadiya", if: "sadiya_won", text: "Hear the result from Comrade Sadiya", lines: [["sadiya", "Great students! …I have a carry-over. I'm telling you because you didn't ask.", "Y4-m94-04"]] },
          { t: "talk", npc: "sadiya", if: "sadiya_lost", text: "Hear the result from Comrade Sadiya", lines: [["sadiya", "The students have spoken. Loudly. And wrongly. But loudly.", "Y4-m94-05"]] }],
        reward: { cash: 2500, standing: { community: 3, social: 2 } },
        around: { radio: [["kabiru", "Election season. Posters are covering posters that are covering posters.", "Y4-m94-06"]], walker: ["I voted. Then I voted for best jollof. That one mattered."] } },

      { id: "m95", ch: 24, year: 4, sem: 2, title: "The eel's bargain", gate: 99, giver: "baba", thread: "M", shape: "investigation",
        intro: "The fifth coil is in the spillway under the Dam wall. Baba Dam will row you. He says the eel will decide. It is not a monster tonight; it is an old animal guarding something warm.",
        need: { done: ["m94"] }, music: { start: "motif_elder", turn: "sting_coil", end: "motif_light" },
        fail: { text: "The eel bumps the boat. You get wet. Start the feeding again.", resume: 5, wait: "now" },
        steps: [
          { t: "talk", npc: "baba", text: "Meet Baba Dam at the water", night: true, give: "fish", lines: [["baba", "You fought it twice. Tonight you bring it supper. That is how debts are paid.", "Y4-m95-01"]] },
          { t: "talk", npc: "abdul", text: "Find Abdul on the pier", lines: [["abdul", "I fly. I don't float. There's a difference. Check.", "Y4-m95-02"]] },
          { t: "choice", text: "Ask Abdul to come, or go without him", prompt: "Abdul will not get in the boat.", options: [
            { label: "\"Hold the rope; I'll hold the other end\"", set: "abdul_came", friend: { abdul: 6 } },
            { label: "Go without him", set: "abdul_stayed", friend: { abdul: 3 } }] },
          { t: "go", place: "dam", text: "Row to the spillway under the Dam wall", give: "coil", lines: [["", "A tunnel, a ladder, a chamber. Plaque: \"5. Where the water is held.\" The coil is wrapped in the sleeping eel."]] },
          { t: "look", place: "dam", secs: 6, text: "Keep still", turn: true, lines: [["", "It wakes, and looks at you, and does not strike."]] },
          { t: "rhythm", text: "Toss fish on the slow beat of its breathing", take: "fish" },
          { t: "build", parts: { coil: 1 }, place: "dam", text: "Connect the coupling under the water", lines: [["", "The chamber lights from below. The eel swims a circle through the glow and settles again."], ["baba", "It will keep that one for you. Better than a padlock.", "Y4-m95-03"]] }],
        reward: { cash: 15000, standing: { academics: 1, street: 1, social: 1, community: 1, department: 1 }, flags: ["coil5"] },
        around: { radio: [["radio", "Five.", "Y4-m95-04"]], phone: [["maker", "Five. I am sitting down. It's all right. I'm only sitting.", "Y4-m95-05"]] } },

      { id: "m96", ch: 24, year: 4, sem: 2, title: "The Mirror", gate: 101, giver: "maker", thread: "M", shape: "boss",
        intro: "A copy of you as tall as the giant letters, made of every clip ever filmed of you. Hit it and it hits back. So do the one thing it cannot.",
        need: { done: ["m95"] }, music: { start: "face_mirror", turn: "motif_crew", end: "quiet" },
        steps: [
          { t: "talk", npc: "maker", text: "See the Maker in the Engineering Garden", lines: [["maker", "It is made of how you look. It has never seen what you are for. Show it.", "Y4-m96-01"]] },
          { t: "go", place: "selfie", night: true, text: "Go to the Selfie Garden", lines: [["", "It stands in the letters. A crowd is filming. Echoes of other students ring the lawn."]] },
          { t: "defend", place: "selfie", enemy: "shade", secs: 30, text: "Face the Mirror", lines: [["", "Anything you do, it does bigger."]] },
          { t: "care", npc: "aisha", place: "selfie", text: "Help the fresher who was knocked down", turn: true, lines: [["", "A fresher is knocked down by an Echo and nobody moves, because everyone is filming. It is Aisha."], ["", "The Mirror tries to copy you. It bends down to nobody. It has nobody."]] },
          { t: "escort", npc: "lucky", place: "selfie", text: "Pull people out of the ring with Lucky", lines: [["lucky", "Guys, guys, guys— put it down. Put the phone DOWN. Help that one.", "Y4-m96-02"]] },
          { t: "emote", emote: "wave", at: "selfie", text: "Greet the Mirror, properly", lines: [["", "It cannot answer. It goes out like a screen."], ["bilkisu", "I'm writing \"resolved\". I still don't have a box for it.", "Y4-m96-03"]] }],
        fail: { text: "The Maker phones, once: \"Look at the crowd.\"", resume: 3, wait: "now" },
        reward: { cash: 18000, standing: { community: 6, social: 8 }, flags: ["mirror_down"] },
        around: { radio: [["kabiru", "Nobody filmed the end. I think that was the end.", "Y4-m96-04"]], phone: [["@roomie", "I was there. At the back. I held somebody's bag. I'm basically a hero.", "Y4-m96-05"]] } },

      { id: "m97", ch: 24, year: 4, sem: 2, title: "Log off", gate: 102, giver: "joy", thread: "F", shape: "choice",
        intro: "What do you do with being known? Then a logbook on a table and a panel in a row: the industrial-training defence.",
        need: { done: ["m96"] }, music: { start: "motif_crew", turn: "sting_test", end: "sting_level" },
        steps: [
          { t: "go", place: "radio", text: "Go to the Campus Radio studio", lines: [["joy", "Three, two… sorry. Habit. Your channel has more listeners than this station. That's embarrassing for us.", "Y4-m97-01"], ["joy", "Give it to the radio. Or keep it small. Or close it. But decide; don't drift.", "Y4-m97-02"]] },
          { t: "choice", text: "Decide what to do with your channel", prompt: "Your channel.", options: [
            { label: "Hand it to the radio", set: "fame_radio", standing: { community: 4 }, friend: { joy: 6 }, lines: [["joy", "This is Joy. Not anonymous any more. Hello. Properly.", "Y4-m97-03"]] },
            { label: "Keep it small and honest", set: "fame_small", standing: { social: 3 } },
            { label: "Close it", set: "fame_closed", standing: { academics: 2 } }] },
          { t: "go", place: "@dept", text: "Get to your department: the defence is today", turn: true, lines: [["lily", "It's today.", "Y4-m97-04"], ["lyzzy", "We told three people to remind you. Did none of them?", "Y4-m97-05"]] },
          { t: "quiz", subject: "ee", n: 6, pass: 4, npc: "khadija", text: "Defend your placement to the panel", lines: [["khadija", "Tell us one thing you learned that is not in this book.", "Y4-m97-06"]] },
          { t: "choice", text: "Give your free answer", prompt: "One thing you learned that is not in the book.", options: [
            { label: "The accident: switch off first, then help", set: "defence_accident", standing: { department: 2 } },
            { label: "The Friday fault you fixed", set: "defence_fault", standing: { department: 2 } },
            { label: "The logbook: what an honest record is for", set: "defence_logbook", standing: { academics: 2 } }] },
          { t: "turn", text: "Wait for the panel", lines: [["okonkwo", "Hm. That will do. That will do very well.", "Y4-m97-07"]], set: "year5" }],
        reward: { cash: 0, standing: { department: 5 } },
        around: { phone: [["phone:dad", "Five hundred level. So next year we come and sit under canopy. I'm buying the cloth.", "Y4-m97-08"]] } },

      { id: "m98", ch: 24, year: 4, sem: 2, title: "Sadiq's surprise", gate: 103, giver: "@roomie", thread: "F", shape: "social",
        intro: "You owe your roommate an apology for most of this year. Before you can give it, the whole room shouts \"surprise\".",
        need: { done: ["m97"] }, music: { start: "motif_home", turn: "motif_crew", end: "motif_crew" },
        steps: [
          { t: "buy", item: "kilishi", text: "Buy something small they like" },
          { t: "go", place: "@hostel", text: "Go up to your room and rehearse on the stairs", lines: [["me", "I was a bad friend this year. No. I've been busy. No. I'm sorry. Just that.", "Y4-m98-01"]] },
          { t: "turn", text: "Open the door", lines: [["", "The door opens on darkness, then every torch in the corridor."], ["", "Everyone: \"SURPRISE!\""], ["@roomie", "You passed IT! And you're less famous! Two blessings!", "Y4-m98-02"]] },
          { t: "talk", npc: "@roomie", if: "birthday_back", text: "Say it anyway, in the noise", lines: [["@roomie", "I know. You came back for the cake. I counted that.", "Y4-m98-03"]] },
          { t: "talk", npc: "@roomie", if: "birthday_missed", text: "Say it anyway, in the noise", lines: [["@roomie", "I know. I kept the note. I'll throw it away now.", "Y4-m98-04"]] },
          { t: "eat", place: "buka", text: "Eat with the crew at the buka", lines: [["sly", "Sly proposes a toast. With malt. To the one who can't be copied.", "Y4-m98-05"]] }],
        reward: { cash: 0, friend: { "@roomie": 10, ada: 2, yakubu: 2, fatima: 2, bola: 2, kelechi: 2, lucky: 2 }, flags: ["roomie_mended"] },
        around: { radio: [["radio", "Caller reports a surprise party on the second floor. Caller was not invited. Caller is hurt.", "Y4-m98-06"]], phone: [["phone:mum", "Who is shouting? A party? On a school night? …Greet them for me.", "Y4-m98-07"]] } },

      { id: "m99", ch: 24, year: 4, sem: 2, title: "One left", gate: 105, giver: "asiya", thread: "M", shape: "escort",
        intro: "Kelechi's final piece is under a sheet and too heavy for one. He signs this one, and leaves a year ahead of you. That evening the Garden coil flickers, and the Maker is sitting down again.",
        need: { done: ["m98"] }, music: { start: "motif_crew", turn: "motif_light", end: "quiet" },
        steps: [
          { t: "talk", npc: "kelechi", text: "Help Kelechi in the Sculpture Garden", give: "statue", lines: [["kelechi", "Look at it properly. No, don't. Not yet. Lift.", "Y4-m99-01"]] },
          { t: "carry", item: "statue", place: "sculpture", text: "Carry the sculpture to its plinth, slowly" },
          { t: "emote", emote: "wave", at: "sculpture", text: "Unveil the sculpture", lines: [["", "Six figures passing something hand to hand. The sixth reaches toward an empty space."], ["kelechi", "I left a gap. For whoever comes next. This one, I'm signing.", "Y4-m99-02"]] },
          { t: "talk", npc: "kelechi", text: "Say goodbye to Kelechi", lines: [["kelechi", "I'm done. It's strange. You'll see. Don't rush it; don't run from it.", "Y4-m99-03"]] },
          { t: "phone", npc: "asiya", incoming: true, text: "Answer Aunty Asiya", turn: true, lines: [["asiya", "Come to the garden. He won't tell me what's wrong. He'll tell you.", "Y4-m99-04"]] },
          { t: "go", place: "enggarden", text: "Go to the Engineering Garden", lines: [["", "The first coil dims and brightens like breathing. He is on the plinth."], ["maker", "Five are lit. They pull on the first. On me. It's arithmetic. I'm not afraid of arithmetic.", "Y4-m99-05"], ["maker", "The sixth has never been built. If it is not built, the ring pulls until something gives.", "Y4-m99-06"], ["maker", "You'll need a final-year project. I have a suggestion.", "Y4-m99-07"]] },
          { t: "emote", emote: "sit", at: "enggarden", text: "Sit with him and Aunty Asiya" }],
        reward: { cash: 0, friend: { kelechi: 10 }, flags: ["kelechi_gone", "sixth_needed"] },
        around: { radio: [["radio", "A machine that needs one keeper is not finished.", "Y4-m99-08"]], phone: [["kelechi", "I'm at the gate. I didn't look back. That's a lie. I looked back.", "Y4-m99-09"]] } }
    ]
  });
})();
