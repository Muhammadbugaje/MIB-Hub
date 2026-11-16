/* Freshers School Life — Year 3 story (m58–m78), 300 level, "Drift": the strike year.
   Source: docs/story/scripts/Y3.md. Engine contract: docs/story/ENGINE.md. Data only.
   Voice ids: "Y3-mNN-KK", numbered per mission in order (steps, then choice-option lines, then "around").

   Changes from the script, and why (gaps are also listed in docs/story/ENGINE_ISSUES.md under "Y3 needs"):
   - Places the map does not have (ENGINE.md §7) use the nearest existing one:
       campus fence → gate · forest / ridge / flooded stream → lowerdam · Old Campus ruins and the ranger post
       → checkpoint · the dark bend / long road to Phase 2 → checkpoint and p2park · football pitch → social ·
       the quad → enggarden · fountain → selfie · Mall "Sound Garden" speaker shop → mk_electronics ·
       mall management office → market · Registry → senate.
   - Enemies: Idlers and the Long Silence do not exist; Idlers use "shade" and the Long Silence uses "entropy"
     (boss). The "stay standing / beat it with noise" rules are not modelled; the steps are ordinary
     defend/fight/boss steps with the scripted lines kept.
   - Multi-part beats are split into one step per action (six goodbyes, three greetings, two hustles, three
     open-mic acts, two exam papers). "Pick two hustles" is two choice steps (the second skips the first pick).
   - "Check your balance" (bank) has no deposit, so it is a short `look` at the bank.
   - Treasure hunt clues, marked stones and reels are `collect` steps around one place with a wide radius.
   - m63 needs "a radio item or a friend": not enforced (no radio item exists).
   - m68's four jerrycans are one careful `delivery` (the engine has no count on delivery).
   - m76's single path (no partner) is not branched; speakers use @crush, which the engine resolves
     (the script's @best variant lines are kept in a comment there).
   - m77 is set on "Friday and Saturday"; days are not enforced. The native-outfit requirement is not
     enforced (the script's fallback, Alhaji Needle lending one, makes it optional anyway).
   - m78 promotes to 400 level via the engine's promotion on mission flags; `year4` is set as scripted.
   - Standing tracks: the script's Books → academics, Vibes → social, "all standings" → every track.
*/
(function () {
  "use strict";
  var D = (typeof window !== "undefined" ? window : globalThis).SamaruData; if (!D) return;
  D.STORY = D.STORY || [];

  function L(who, text) { return [who, text]; }

  var NPCS = [
    { id: "khadija", name: "Dr. Khadija", role: "Level adviser", at: "dept_elect", skin: "#7a4a2b", hair: "hijab", hairCol: "#1e3a8a", top: "#f8fafc", voice: "female", pitch: .95, hi: ["Groups are final.", "A budget, a drawing, a reason.", "Come with questions, not excuses."] },
    { id: "jega", name: "Jega", role: "Football captain", at: "pepsi", skin: "#6a4127", hair: "low", top: "#16a34a", voice: "male", pitch: 1.0, hi: ["I'm awake. I was reviewing.", "Lucky socks on.", "Five-a-side later?"] },
    { id: "sadiya", name: "Comrade Sadiya", role: "Union president", at: "theatre", skin: "#7d4e2e", hair: "hijab", hairCol: "#dc2626", top: "#fef2f2", voice: "female", pitch: 1.05, hi: ["Great students!", "Aluta continua.", "Come to congress."] },
    { id: "joy", name: "Joy", role: "Radio intern", at: "radio", romance: "m", skin: "#85532f", hair: "braids", top: "#a855f7", voice: "female", pitch: 1.15, hi: ["Fresh FM, how far?", "Send your requests.", "I'm reading the news today!"] },
    { id: "chitech", name: "Chi-Tech", role: "Phone repairs", at: "mk_phones", skin: "#5e3a22", hair: "low", top: "#0ea5e9", voice: "male", pitch: 1.05, hi: ["Hold this. Don't touch anything else.", "Tired but honest.", "Screen don crack again?"] },
    { id: "aminu", name: "Aminu", role: "Pupil at Demonstration school", at: "demo", skin: "#7a4a2b", hair: "low", top: "#f8fafc", voice: "male", pitch: 1.5, hi: ["Are you the engineer?", "Can you make jollof?", "Uncle! Uncle!"] },
    { id: "lawal", name: "Ranger Lawal", role: "Forest patrol", at: "lowerdam", skin: "#5a361f", hair: "cap", hairCol: "#3f6212", top: "#4d7c0f", voice: "male", pitch: .85, hi: ["Go back.", "Follow my light if you see it.", "Bush, hills, and me."] },
    { id: "ranger2", name: "Ranger Basit", role: "Forest patrol", at: "lowerdam", skin: "#6a4127", hair: "cap", hairCol: "#3f6212", top: "#4d7c0f", voice: "male", pitch: 1.0, hi: ["Short cut. Long cut.", "Thank you, student.", "My ankle remembers you."] },
    { id: "kaka", name: "Kaka", role: "Groundnut seller", at: "gate", skin: "#6b4226", hair: "hijab", hairCol: "#f97316", top: "#fde68a", voice: "female", pitch: .8, hi: ["Groundnut? Sit.", "It is not a short story.", "Where was I?"] },
    { id: "porter", name: "Baba Porter", role: "Hostel porter", at: "ribadu", skin: "#553320", hair: "cap", hairCol: "#78716c", top: "#78716c", voice: "male", pitch: .75, hi: ["Bed space no dey.", "Sign the book.", "Lights out means lights out."] },
    { id: "ezekiel", name: "Mr. Ezekiel", role: "Lab technologist", at: "dept_elect", skin: "#553320", hair: "low", top: "#cbd5e1", voice: "male", pitch: .8, hi: ["Sign for every tool.", "Never say 'it should work'.", "Window open when you solder."] },
    { id: "maryam", name: "Maryam", role: "Page Turner Books", at: "mk_books", romance: "m", skin: "#c99468", hair: "hijab", hairCol: "#7c3aed", top: "#ede9fe", voice: "female", pitch: 1.1, hi: ["Have you read anything this year?", "Give. Carefully.", "New noticeboard story is up."] },
    { id: "sam", name: "Pastor Sam", role: "Chaplain", at: "chapel", skin: "#5e3a22", hair: "low", top: "#1e293b", voice: "male", pitch: .9, hi: ["By His grace.", "Whoever loses buys the kunu.", "Sunday, eight o'clock."] },
    { id: "auwal", name: "Ustaz Auwal", role: "Teaches at the mosque", at: "mosque", skin: "#6b4226", hair: "cap", hairCol: "#f8fafc", top: "#f8fafc", voice: "male", pitch: .85, hi: ["Insha Allah.", "We are one short.", "Assalamu alaikum."] },
    { id: "peter", name: "Corporal Peter", role: "Campus security", at: "gate", skin: "#5a361f", hair: "cap", hairCol: "#1e3a8a", top: "#1e3a8a", voice: "male", pitch: 1.0, hi: ["First warning. It's good, abi?", "Move along, move along.", "Don't tell Madam."] },
    { id: "adebayo", name: "Mrs. Adebayo", role: "Registry", at: "senate", skin: "#7d4e2e", hair: "bun", top: "#fde68a", voice: "female", pitch: .9, hi: ["Next.", "Different forms.", "Bring two passport photos."] },
    { id: "manager", name: "Mall manager", role: "Kanti Market management", at: "market", skin: "#74472a", hair: "fade", top: "#111827", voice: "male", pitch: .95, hi: ["Exams are not content.", "Full-time means full-time.", "Content, content."] },
    { id: "scrap", name: "Scrap dealer", role: "Scrap yard", at: "stalls", skin: "#4f301c", hair: "low", top: "#78716c", voice: "male", pitch: .75, hi: ["Copper is copper.", "I buy what they bring.", "No questions."] },
    { id: "lily", name: "Lily", role: "One of the twins", at: "selfie", skin: "#a8724a", hair: "braids", top: "#f472b6", voice: "female", pitch: 1.2, hi: ["We heard.", "We know already.", "Ask us anything."] },
    { id: "lyzzy", name: "Lyzzy", role: "One of the twins", at: "selfie", skin: "#a8724a", hair: "braids", top: "#60a5fa", voice: "female", pitch: 1.2, hi: ["We always hear.", "She's lying. I'm Lyzzy.", "Hi hi."] },
    { id: "asiya", name: "Aunty Asiya", role: "MIB Store manager", at: "mibstore", skin: "#d0a07a", hair: "hijab", hairCol: "#ca8a04", top: "#fffbeb", voice: "female", pitch: .95, hi: ["Welcome to MIB.", "The store never has a sale.", "My uncle says hello. He doesn't, but I'm saying it."] },
    { id: "clemantine", name: "Clemantine", role: "Gift Corner", at: "mk_gifts", skin: "#c99468", hair: "bun", top: "#fda4af", voice: "female", pitch: 1.05, hi: ["Not red. Red is for apology.", "The roses are listening.", "Bonjour, sannu, hello."] },
    { id: "aisha", name: "Aisha", role: "Fresher, Hajiya Ladi's daughter", at: "market", skin: "#7d4e2e", hair: "hijab", hairCol: "#f59e0b", top: "#fef08a", voice: "female", pitch: 1.25, hi: ["Is there really a lightning machine?", "Which way is the Senate?", "I'm a fresher!"] },
    { id: "nwachukwu", name: "Prof. Nwachukwu (tape)", role: "A voice on the old reels", at: "enggarden", skin: "#6b4226", hair: "bun", top: "#e2e8f0", voice: "female", pitch: .9, hi: ["…", "…", "…"] },
    { id: "patient", name: "A first-year patient", role: "Sick Bay", at: "sickbay", skin: "#7a4a2b", hair: "low", top: "#e2e8f0", voice: "male", pitch: 1.2, hi: ["Thank you.", "Is it morning?", "I feel better small."] },
    { id: "shuttle", name: "Baba Shuttle", role: "Shuttle driver", at: "p2park", skin: "#553320", hair: "cap", hairCol: "#facc15", top: "#facc15", voice: "male", pitch: .8, hi: ["Shift! Shift for your neighbour!", "Phase 2, Phase 2!", "Enter, enter."] },
    { id: "risi", name: "Iya Risi", role: "Phase 2 food seller", at: "p2canteen", skin: "#6b4226", hair: "bun", top: "#22c55e", voice: "female", pitch: .85, hi: ["I will leave the plate out anyway.", "Come and chop.", "Rice and stew, small money."] },
    { id: "needle", name: "Alhaji Needle", role: "Tailor", at: "mk_native", skin: "#5e3a22", hair: "cap", hairCol: "#f8fafc", top: "#f8fafc", voice: "male", pitch: .8, hi: ["Ready since last Thursday.", "Measure twice.", "Come for fitting."] }
  ];

  var ITEMS = {
    groundnuts: { name: "Cone of groundnuts", price: 100, text: "Kaka gave you two." },
    marked_stone: { name: "Marked white stone", price: 0, text: "A line is cut on top." },
    plaque3: { name: "Plaque rubbing (3)", price: 0, text: "\"3. The first laboratory.\"" },
    reel: { name: "Tape reel", price: 0, text: "Old, brittle, labelled in a brisk hand." },
    tape5: { name: "The fifth reel", price: 0, text: "There is a name on it." },
    clue: { name: "Hunt clue", price: 0, text: "One of Kabiru's riddles." },
    scripts: { name: "Bolaji's exam scripts", price: 0, text: "All As." },
    panel: { name: "Solar panel", price: 3500, text: "Bright Electricals' smallest." },
    battery: { name: "Battery", price: 1500, text: "Tired but honest." },
    pole: { name: "Lamp pole", price: 0, text: "From the scrap yard behind the stalls." },
    lamp: { name: "Solar lamp head", price: 0, text: "Group Light Work's first." },
    jerrycan: { name: "Jerrycans of fuel", price: 0, text: "Drive as if eggs were in the back." },
    tracks: { name: "Boot prints", price: 0, text: "They leave the path." },
    rope: { name: "Rope", price: 0, text: "Rangers' rope, heavy and wet." },
    connector: { name: "The Maker's connector", price: 0, text: "Made the year he should have graduated." },
    panel_kit: { name: "Panel and battery", price: 0, text: "Heavy. Four of you carry it." },
    wedding_gift: { name: "Wedding gift", price: 2500, text: "Not red." }
  };

  var M = [

  /* ---------- m58 — Three hundred ---------- */
  { id: "m58", ch: 17, year: 3, sem: 1, gate: 56, title: "Three hundred", giver: "khadija", thread: "D", shape: "escort",
    intro: "Third year. The notice board puts you in a project group of four: two serious, one asleep in Pepsi Garden, one not seen since Tuesday.",
    need: { done: ["m57"] }, music: { start: "motif_work", end: "motif_crew" },
    steps: [
      { t: "talk", npc: "khadija", text: "Read the group list with Dr. Khadija", lines: [L("khadija", "Groups are final. Do not come to me with \"but she is my friend\"."), L("fatima", "Actually, we are four. I have only ever seen two of us.")] },
      { t: "talk", npc: "jega", text: "Find Jega asleep in Pepsi Garden", lines: [L("jega", "I'm awake. I was reviewing. With my eyes.")] },
      { t: "escort", npc: "jega", place: "@dept", text: "Walk Jega back to the department", fail: { text: "Jega sat down. Go back for him.", resume: 2, wait: "now" } },
      { t: "talk", npc: "bola", turn: true, text: "Find Bolaji skating at the court", lines: [L("bola", "Group work? With Fatima? She will make a timetable for my breathing.")] },
      { t: "go", place: "@dept", text: "Hold the first group meeting", lines: [L("fatima", "Item one. A name for the group."), L("bola", "\"Light Work.\" Because it is about light. And because it will not be.")] }],
    fail: { text: "Jega sits down on the way if you run too far ahead; go back for him.", resume: 2, wait: "now" },
    reward: { cash: 2000, standing: { department: 3 }, flags: ["team_lightwork"] },
    around: { radio: [L("kabiru", "Three hundred level. The year the handouts get thicker and the jokes get thinner.")], walker: ["Group of four. I am doing the work of five."], phone: [] } },

  /* ---------- m59 — Indefinite ---------- */
  { id: "m59", ch: 17, year: 3, sem: 1, gate: 57, title: "Indefinite", giver: "yakubu", thread: "F", shape: "choice",
    intro: "A sheet of paper on the Senate door. A congress at Theatre CD. By evening the shuttle park is full of bags, and you have six goodbyes to say before the last bus.",
    need: { done: ["m58"] }, music: { start: "tension_low", turn: "motif_home", end: "motif_home" },
    steps: [
      { t: "go", place: "senate", text: "Read the notice on the Senate door", lines: [L("yakubu", "For the record, it says \"indefinite\". That is not a number of days.")] },
      { t: "go", place: "theatre", text: "Go to the congress at Theatre CD", lines: [L("sadiya", "Great students! (Great!) Our lecturers are not our enemies!")] },
      { t: "choice", prompt: "The microphone comes your way.", text: "Speak at congress, or listen", options: [
        { label: "Speak", set: "spoke_congress", standing: { social: 3 }, friend: { sadiya: 3 } },
        { label: "Listen", set: "listened_congress", standing: { academics: 1 }, friend: { yakubu: 3 } }] },
      { t: "go", place: "p2park", turn: true, text: "Go to the shuttle park", lines: [L("", "It is real. Buses. Bags. Mothers on phones.")] },
      { t: "talk", npc: "ada", npcAt: "p2park", text: "Say goodbye to Ada", lines: [L("ada", "Three things. Read. Rest. Don't disappear.")] },
      { t: "talk", npc: "fatima", npcAt: "p2park", text: "Say goodbye to Fatima" },
      { t: "talk", npc: "yakubu", npcAt: "p2park", text: "Say goodbye to Yakubu" },
      { t: "talk", npc: "bola", npcAt: "p2park", text: "Say goodbye to Bolaji", lines: [L("bola", "I'm not crying. It's harmattan.")] },
      { t: "talk", npc: "kelechi", npcAt: "p2park", text: "Say goodbye to Kelechi", lines: [L("kelechi", "Look at this place properly while it is quiet.")] },
      { t: "talk", npc: "joy", npcAt: "p2park", text: "Say goodbye to Joy" },
      { t: "go", place: "@hostel", text: "Go back to your hostel", lines: [L("", "The corridor is silent. One radio, far away."), L("@roomie", "I'm staying. Transport money is garri money. We stay.")] }],
    fail: { text: "Missed a goodbye? They'll message you instead.", resume: 4, wait: "now" },
    reward: { cash: 0, flags: ["strike_on"] },
    around: { radio: [L("kabiru", "This is Fresh FM, broadcasting to… I can see four people from this window.")], walker: [], phone: [L("mum", "Come home. …You're staying? Then eat. Promise me you will eat.")] } },

  /* ---------- m60 — Those who stayed ---------- */
  { id: "m60", ch: 17, year: 3, sem: 1, gate: 58, title: "Those who stayed", giver: "audu", thread: "W", shape: "routine",
    intro: "Count who is left: a tea seller, a nurse, a porter, a man with a coil, and you. No allowance is coming. Build a day, and a hustle, out of that.",
    need: { done: ["m59"] }, music: { start: "motif_home", end: "motif_home" },
    steps: [
      { t: "talk", npc: "audu", text: "Have morning tea with Audu", lines: [L("audu", "Tea first. …There is nobody to talk about. Drink slowly.")] },
      { t: "talk", npc: "hauwa", text: "Greet Nurse Hauwa at the Sick Bay", lines: [L("hauwa", "You stayed. Good. Eat. Sleep. Please. And check on your roommate.")] },
      { t: "talk", npc: "porter", text: "Greet Baba Porter at the hostel" },
      { t: "talk", npc: "maker", text: "Greet the Maker in the Engineering Garden", lines: [L("maker", "An empty school runs down faster. Come by. I like the noise you make.")] },
      { t: "look", place: "bank", secs: 4, turn: true, text: "Check your balance at the bank", lines: [L("", "Your balance is not a number you can live on.")] },
      { t: "choice", prompt: "Pick your first way to earn.", text: "Pick your first hustle", options: [
        { label: "Keke runs with Emeka", set: "hustle_keke", standing: { street: 1 }, lines: [L("emeka", "Keke. Morning runs. I take thirty per cent, because I am fair.")] },
        { label: "Tutoring at Demonstration school", set: "hustle_tutor", standing: { academics: 1 } },
        { label: "Shifts at the mall", set: "hustle_mall", standing: { social: 1 } },
        { label: "Phone repairs with Chi-Tech", set: "hustle_repair", standing: { department: 1 }, lines: [L("chitech", "Hold this screwdriver. Don't touch anything else. Congratulations, you're a technician.")] }] },
      { t: "choice", prompt: "Pick your second way to earn.", text: "Pick your second hustle", options: [
        { label: "Keke runs with Emeka", set: "hustle_keke2", standing: { street: 1 } },
        { label: "Tutoring at Demonstration school", set: "hustle_tutor2", standing: { academics: 1 } },
        { label: "Shifts at the mall", set: "hustle_mall2", standing: { social: 1 } },
        { label: "Phone repairs with Chi-Tech", set: "hustle_repair2", standing: { department: 1 } }] },
      { t: "job", text: "Do one shift of your first hustle" },
      { t: "job", text: "Do one shift of your second hustle" },
      { t: "eat", text: "Eat garri in the evening", lines: [L("@roomie", "Groundnut? In this economy?")] }],
    reward: { cash: 0, flags: ["hustle_a", "hustle_b", "vac_job_paid"] },
    around: { radio: [L("kabiru", "Day nine. I have played every track twice. Send requests. Send anything.")], walker: ["Students have gone. Even the goats look bored."], phone: [] } },

  /* ---------- m61 — Small Sadiq ---------- */
  { id: "m61", ch: 17, year: 3, sem: 1, gate: 59, title: "Small Sadiq", giver: "aminu", thread: "F", shape: "quiz",
    intro: "A boy at Demonstration school wants to be an engineer \"like you\". This time you ask the questions, and choose how to explain when he gets one wrong.",
    need: { done: ["m60"] }, music: { start: "motif_crew", end: "motif_crew" },
    steps: [
      { t: "go", place: "demo", text: "Go to Demonstration school", lines: [L("", "A classroom with chalk dust and one pupil who has stayed behind."), L("aminu", "Are you the engineer? Uncle Sadiq said an engineer is coming."), L("aminu", "Can you make light? Can you make a car? Can you make jollof?")] },
      { t: "teach", subject: "gen", n: 5, pass: 3, npc: "aminu", text: "Teach Aminu: ask him five questions",
        fail: { text: "He's gone quiet. He's small. Go easy, and try again.", resume: 1, wait: "now" } },
      { t: "talk", npc: "aminu", turn: true, text: "Hear Aminu out", lines: [L("aminu", "Is it not so? You said so yourself. Last time. Differently.")] },
      { t: "talk", npc: "aminu", text: "Talk with Aminu", lines: [L("", "He copies how you stand."), L("aminu", "When I come to your school, will you show me the Senate?"), L("me", "I'll show you.")] }],
    fail: { text: "Impatient answers: he goes quiet, and the lesson ends early.", resume: 1, wait: "now" },
    reward: { cash: 1500, standing: { academics: 3, community: 2 }, flags: ["met_aminu"] },
    around: { radio: [], walker: ["He has been telling the whole school an engineer is his friend."], phone: [L("@roomie", "That is my cousin. If he is rude, flog him with words only.")] } },

  /* ---------- m62 — Past the last streetlight ---------- */
  { id: "m62", ch: 17, year: 3, sem: 1, gate: 60, title: "Past the last streetlight", giver: "", thread: "W", shape: "stealth",
    intro: "With nothing to do you walk past the fence. Trees, then more trees. Then a torch in your face. Then an old woman selling groundnuts where the path ends.",
    need: { done: ["m61"] }, music: { start: "quiet", turn: "motif_elder", end: "motif_elder" },
    steps: [
      { t: "go", place: "gate", text: "Walk out past the campus fence" },
      { t: "go", place: "lowerdam", text: "Keep walking into the trees", lines: [L("", "The school's music falls away.")] },
      { t: "talk", npc: "lawal", turn: true, text: "Face the torch in the trees", lines: [L("lawal", "Go back."), L("lawal", "Nothing out here for students. Bush, hills, and me. Go back.")] },
      { t: "choice", prompt: "Turn back, or push on?", text: "Turn back, or push on", options: [
        { label: "Turn back", set: "turned_back" },
        { label: "Push on", set: "pushed_on", lines: [L("", "Two more rangers appear. You are walked to the fence, unharmed, mildly lectured.")] }] },
      { t: "talk", npc: "kaka", text: "Sit with the groundnut seller at the gate", lines: [L("kaka", "Groundnut? Sit. It is not a short story."), L("kaka", "…and that is why they left the old place. Where was I? I began in the middle."), L("kaka", "Follow the white stones. Not today. He is watching today.")] },
      { t: "buy", item: "groundnuts", text: "Buy a cone of groundnuts from Kaka" }],
    fail: { text: "There is no failing. Being brought back is the lesson.", resume: 4, wait: "now" },
    reward: { cash: 0, flags: ["met_lawal", "met_kaka", "old_campus_rumour"] },
    around: { radio: [], walker: ["You went outside? There is nothing outside. That is why it is outside."], phone: [L("@roomie", "You brought groundnut? Then tonight we are rich.")] } },

  /* ---------- m63 — Empty halls ---------- */
  { id: "m63", ch: 18, year: 3, sem: 1, gate: 62, title: "Empty halls", giver: "maker", thread: "M", shape: "defend",
    intro: "Something is sitting in Kainji Theatre. Row after row of it. Anyone who goes in sits down too.",
    need: { done: ["m62"] }, music: { start: "face_silence", end: "quiet" },
    steps: [
      { t: "talk", npc: "maker", text: "Talk to the Maker", lines: [L("maker", "An empty hall is an invitation. Mr. Ezekiel has the key. Take a radio.")] },
      { t: "talk", npc: "ezekiel", text: "Get Mr. Ezekiel to open Kainji Theatre", lines: [L("ezekiel", "Who touched it? Nobody. That is the problem. Nobody has touched anything.")] },
      { t: "go", place: "kt", turn: true, text: "Go inside Kainji Theatre", lines: [L("", "Grey seated figures in every row, facing a blank board. Your steps slow. Sit?")] },
      { t: "defend", place: "kt", enemy: "shade", secs: 45, text: "Stay on your feet in Kainji Theatre",
        fail: { text: "You sat down. Mr. Ezekiel drags you out by the collar, grumbling.", resume: 3, wait: "now" } },
      { t: "fight", enemy: "shade", n: 10, at: "kt", text: "Clear Kainji Theatre with noise" },
      { t: "fight", enemy: "shade", n: 5, at: "wt", text: "Clear Wolfson Theatre", lines: [L("", "You clear half, and the radio battery dies."), L("me", "There are too many. And it's so quiet.")] },
      { t: "talk", npc: "maker", text: "Report to the Maker", lines: [L("maker", "You cannot hit silence. You can only outnumber it. We need the people back.")] }],
    fail: { text: "Sit for thirty seconds and Mr. Ezekiel drags you out by the collar.", resume: 3, wait: "now" },
    reward: { cash: 3000, flags: ["idlers_seen"] },
    around: { radio: [L("kabiru", "If you are sitting alone right now: stand up. Open the door. That's the show.")], walker: ["I don't sweep Kainji any more. The chairs look at me."], phone: [] } },

  /* ---------- m64 — The sit-down ---------- */
  { id: "m64", ch: 18, year: 3, sem: 1, gate: 63, title: "The sit-down", giver: "hauwa", thread: "F", shape: "care",
    intro: "Your roommate has not left the room in four days. Not ill. Just sitting. No fight will fix it. Cook, play music, open the window, and stay.",
    need: { done: ["m63"] }, music: { start: "motif_home", end: "motif_crew" },
    steps: [
      { t: "talk", npc: "hauwa", text: "Talk to Nurse Hauwa", lines: [L("hauwa", "Your roommate's name is on my list. Not sick. Tired in a different place."), L("hauwa", "Don't lecture. Don't fix. Just be there, and bring food.")] },
      { t: "talk", npc: "@roomie", text: "Go to your room and see your roommate", lines: [L("", "The curtain is shut. There is a faint grey shape in the corner chair."), L("@roomie", "I'm fine. I'm resting. I've been resting since Monday.")] },
      { t: "look", place: "@hostel", secs: 8, text: "Open the window, put the radio on, sweep", lines: [L("", "Three small acts. The grey shape thins.")] },
      { t: "talk", npc: "nkechi", text: "Get two plates from Mama Nkechi", lines: [L("nkechi", "For that one? Take two plates. Tell them I am counting the days.")] },
      { t: "care", npc: "@roomie", place: "@hostel", turn: true, text: "Sit and eat together", lines: [L("@roomie", "…Everybody went. I didn't know a place could be this quiet.")] },
      { t: "escort", npc: "@roomie", place: "social", text: "Walk your roommate to the pitch", lines: [L("", "Pastor Sam and Ustaz Auwal are arguing over who picks first."), L("auwal", "We are one short. Insha Allah, you can kick?"), L("sam", "By His grace, and by 4-4-2, come.")] }],
    fail: { text: "Too much pushing. They turned to the wall. Come back tomorrow and try gently.", resume: 4, wait: "tomorrow" },
    reward: { cash: 0, standing: { community: 5 }, friend: { "@roomie": 8 }, flags: ["roomie_up"] },
    around: { radio: [L("radio", "Somebody opened a window today. I felt it from here.")], walker: [], phone: [L("@roomie", "I slept. Properly. Thank you. Bring groundnut.")] } },

  /* ---------- m65 — Patrol games ---------- */
  { id: "m65", ch: 18, year: 3, sem: 1, gate: 64, title: "Patrol games", giver: "kaka", thread: "W", shape: "stealth",
    intro: "Kaka said follow the white stones. There are a great many white stones. The patrol walks a pattern. Torch off, stay low, move when the beam swings away.",
    need: { done: ["m64"] }, music: { start: "tension_low", end: "tension_low" },
    steps: [
      { t: "talk", npc: "kaka", night: true, text: "Meet Kaka at the gate at dusk", lines: [L("kaka", "White stones with a line cut on top. The others are only stones."), L("kaka", "My grandson walks that bush. He is stubborn. He gets it from me.")] },
      { t: "stealth", place: "lowerdam", guards: 2, night: true, text: "Cross the first clearing unseen" },
      { t: "collect", item: "marked_stone", n: 5, at: "lowerdam", r: 120, text: "Find five marked white stones" },
      { t: "talk", npc: "lawal", turn: true, text: "Freeze: three torches turn your way", lines: [L("", "You step on a dry branch."), L("lawal", "I know it's you. I can smell groundnut.")] },
      { t: "stealth", place: "checkpoint", guards: 3, night: true, text: "Stay low and reach the ridge", lines: [L("", "From the last stone, across a valley, the outline of roofless walls against the sky.")] }],
    fail: { text: "Caught. Walked back to the fence with a lecture and the rangers' tea. Your stones are kept.", resume: 1, wait: "dusk" },
    reward: { cash: 2000, standing: { street: 3 }, flags: ["stones_done"] },
    around: { radio: [], walker: ["Some student is very committed to being lost."], phone: [L("@roomie", "You went to the bush at night? And I am the one on the nurse's list?")] } },

  /* ---------- m66 — Old Campus ---------- */
  { id: "m66", ch: 18, year: 3, sem: 1, gate: 66, title: "Old Campus", giver: "", thread: "M", shape: "investigation",
    intro: "Walls with trees growing through them. A plaque with the same marks as Kelechi's statues. A third coil, cold. And five reels of tape in five ruined rooms.",
    need: { done: ["m65"] }, music: { start: "quiet", turn: "sting_reveal", end: "motif_light" },
    steps: [
      { t: "go", place: "checkpoint", text: "Walk into Old Campus at first light" },
      { t: "find", item: "plaque3", at: "checkpoint", text: "Read the plaque on the gatepost", lines: [L("", "\"3. The first laboratory.\" The carved marks match Kelechi's statues."), L("me", "Kelechi's stones. They were pointing here the whole time.")] },
      { t: "collect", item: "reel", n: 5, at: "checkpoint", r: 60, text: "Find five tape reels in the ruined rooms" },
      { t: "look", place: "checkpoint", secs: 5, turn: true, text: "Look at the stools in the old lab", lines: [L("", "Six stools round a bench. Five are knocked over. One is set neatly upright.")] },
      { t: "talk", npc: "maryam", text: "Take the reels to Maryam", lines: [L("maryam", "Have you read anything this year, or only tapes? Give. Carefully.")] },
      { t: "listen", place: "mk_electronics", secs: 10, text: "Play the tapes at the speaker shop", lines: [L("nwachukwu", "Day forty. Six of you, six coils, and not one of you will share a spanner."), L("nwachukwu", "I am proud of every one of you separately. That is the problem."), L("nwachukwu", "The ring fails where the people fail. Write that down.")] },
      { t: "look", place: "mk_electronics", secs: 3, give: "tape5", text: "Keep the last reel, unplayed", lines: [L("maryam", "There's a name on this one. I think it is not for me to hear first.")] }],
    fail: { text: "The patrol stops you on the way back. Lawal looks at the reels a long moment and lets you pass.", resume: 4, wait: "now" },
    reward: { cash: 3000, standing: { academics: 3 }, friend: { maryam: 4 }, flags: ["plaque3", "tapes"] },
    around: { radio: [L("radio", "If you are waiting for someone else to switch it on: so are they.")], walker: ["Somebody was playing an old woman's voice in the speaker shop. I got goose pimples."], phone: [] } },

  /* ---------- m67 — The Maker's secret ---------- */
  { id: "m67", ch: 18, year: 3, sem: 1, gate: 67, title: "The Maker's secret", giver: "maker", thread: "M", shape: "social",
    intro: "You play him the last tape. He hears his own name, and for the first time since you met him, he sits down.",
    need: { done: ["m66"] }, music: { start: "quiet", end: "quiet" },
    steps: [
      { t: "talk", npc: "maker", text: "Bring the tape to the Maker", lines: [L("maker", "Where did you get that machine? …Where did you get that tape?")] },
      { t: "listen", npc: "maker", secs: 10, take: "tape5", text: "Play the last tape", lines: [L("nwachukwu", "Last entry. They have all gone home. All but one."), L("nwachukwu", "He says he will keep the first coil running until the others come back."), L("nwachukwu", "I told him: a thing is finished when it no longer needs you. He did not write it down.")] },
      { t: "talk", npc: "maker", turn: true, text: "Sit with the Maker on the plinth", lines: [L("maker", "I was the sixth stool."), L("maker", "My project was the ring. You cannot submit one sixth of a project. So I stayed."), L("maker", "I thought if I left, the light would go. I may have been right. I never tested it.")] },
      { t: "choice", prompt: "Ask him one thing.", text: "Ask the Maker one question", options: [
        { label: "Why didn't you leave?", set: "asked_maker_why", lines: [L("maker", "Good question. I have had a long time and I still do not know. Ask me in two years.")] },
        { label: "Were they your friends?", set: "asked_maker_friends", lines: [L("maker", "Good question. I have had a long time and I still do not know. Ask me in two years.")] },
        { label: "What happens to you if the ring is done?", set: "asked_maker_after", lines: [L("maker", "Good question. I have had a long time and I still do not know. Ask me in two years.")] }] },
      { t: "emote", emote: "sit", at: "enggarden", text: "Sit beside him for a while" }],
    reward: { cash: 0, friend: { maker: 10 }, flags: ["maker_truth"] },
    around: { radio: [L("radio", "…(No sentence this hour. Just the music.)")], walker: [], phone: [L("asiya", "He ate everything tonight. What did you say to him?")] } },

  /* ---------- m68 — Night nurse ---------- */
  { id: "m68", ch: 19, year: 3, sem: 1, gate: 68, title: "Night nurse", giver: "hauwa", thread: "W", shape: "delivery",
    intro: "The Sick Bay generator is on its last cup. Fetch four jerrycans, driving as if eggs were in the back. Then stay the night: one nurse, six patients, no light.",
    need: { done: ["m67"] }, music: { start: "motif_road", turn: "quiet", end: "motif_home" },
    steps: [
      { t: "talk", npc: "hauwa", text: "Talk to Nurse Hauwa", lines: [L("hauwa", "The fuel man will not come during a strike. You have wheels. Please.")] },
      { t: "go", place: "stalls", text: "Drive to the roadside stalls for fuel", give: "jerrycan" },
      { t: "delivery", item: "jerrycan", place: "sickbay", careful: true, text: "Bring the jerrycans to the Sick Bay, gently",
        fail: { text: "Spilled. Go back to the stalls for more. (Twice, and Emeka brings the rest, laughing.)", resume: 1, wait: "now" } },
      { t: "look", place: "sickbay", secs: 3, take: "jerrycan", text: "Pour the fuel and start the generator", lines: [L("", "Pour, pull the cord, light.")] },
      { t: "care", npc: "patient", place: "sickbay", text: "Work the night shift with Nurse Hauwa", lines: [L("patient", "Everybody went home. I didn't have transport. Then I got malaria."), L("patient", "Is it true the lecture halls are full of ghosts? Don't tell me. Tell me.")] },
      { t: "look", place: "sickbay", secs: 4, turn: true, night: true, text: "Look at the doorway", lines: [L("", "At three the generator coughs and stops. In the dark doorway, an Idler is sitting.")] },
      { t: "rhythm", pass: 400, text: "Hum along with Nurse Hauwa", lines: [L("", "Do not fight. Hauwa starts to hum. You join."), L("", "Patients clap along. The shape thins and goes."), L("hauwa", "Good. That is medicine too. Don't tell the pharmacists.")] },
      { t: "sleep", place: "sickbay", text: "Sleep on the Sick Bay bench till dawn" }],
    fail: { text: "Fuel spilled. Go back for more.", resume: 1, wait: "now" },
    reward: { cash: 2500, standing: { community: 6 }, friend: { hauwa: 6 }, flags: ["night_nurse"] },
    around: { radio: [L("kabiru", "To the Sick Bay: I can see your light from the studio. Whoever did that, respect.")], walker: [], phone: [L("mum", "You slept in a hospital? Are you sick? You're helping? …That's my child.")] } },

  /* ---------- m69 — The Idle King ---------- */
  { id: "m69", ch: 19, year: 3, sem: 1, gate: 70, title: "The Idle King", giver: "maker", thread: "M", shape: "boss",
    intro: "NELT is full of it. You cannot hit silence, so bring a football crowd, an open mic, three radios and a bell.",
    need: { done: ["m68"] }, music: { start: "face_silence", turn: "tension_high", end: "motif_school" },
    steps: [
      { t: "talk", npc: "maker", text: "Hear the Maker's plan", lines: [L("maker", "The largest hall holds the largest quiet. Fill it. With anything.")] },
      { t: "sports", sport: "five-a-side", at: "social", text: "Play in the moonlight football match", lines: [L("", "Floodlit by car headlamps. Every trader and guard on campus comes to watch."), L("sam", "Whoever loses buys the kunu. I have already bought the kunu.")] },
      { t: "talk", npc: "sly", text: "Ask Big Sly to sing at the open mic" },
      { t: "talk", npc: "nkechi", text: "Ask Mama Nkechi to tell a story" },
      { t: "talk", npc: "peter", text: "Ask Corporal Peter to do impressions", lines: [L("peter", "\"First warning.\" It's good, abi? Don't tell her.")] },
      { t: "rhythm", pass: 600, text: "Keep the open mic on the beat at the Social Centre" },
      { t: "escort", npc: "sadiya", place: "nelt", turn: true, text: "Lead the whole crowd to NELT", lines: [L("", "Radios up. Mr. Ezekiel opens the doors.")] },
      { t: "boss", enemy: "entropy", n: 1, at: "nelt", text: "Keep the bell, three radios and the chant going", lines: [L("", "A seated grey giant fills the stage. Every row is Idlers."), L("", "Ring the bell, set three radios on three stations, start a chant."), L("sadiya", "GREAT STUDENTS! (GREAT!)")] },
      { t: "emote", emote: "dance", at: "nelt", text: "Laugh. It's just a hall again", lines: [L("", "The hall is just a hall. Somebody starts laughing and cannot stop.")] }],
    fail: { text: "You sat down, and the crowd hauled you up. A dead radio resets the count, not the fight.", resume: 7, wait: "now" },
    reward: { cash: 12000, standing: { community: 5, social: 3 }, flags: ["silence_broken"] },
    around: { radio: [L("radio", "We can hear you from here.")], walker: [], phone: [L("joy", "Kabiru says the campus made noise tonight. I'm coming back. Strike or no strike.")] } },

  /* ---------- m70 — Called off ---------- */
  { id: "m70", ch: 19, year: 3, sem: 2, gate: 71, title: "Called off", giver: "kabiru", thread: "F", shape: "collect",
    intro: "The strike is over. The buses come back all at once, and Kabiru has hidden a treasure hunt across campus to welcome everybody. A day off.",
    need: { done: ["m69"] }, music: { start: "motif_crew", end: "motif_school" },
    steps: [
      { t: "go", place: "p2park", text: "Welcome everyone back at the shuttle park", lines: [L("bola", "I'm back! Did you miss me? Don't answer, I can see it."), L("ada", "Three things. I read. I rested. I did not disappear. You?")] },
      { t: "phone", contact: "kabiru", incoming: true, text: "Answer DJ Kabiru's treasure-hunt call", lines: [L("kabiru", "Ten clues, ten places. First crew to the fountain eats on me. Terms apply.")] },
      { t: "collect", item: "clue", n: 9, at: "senate", r: 450, text: "Solve nine clues around campus with your crew", lines: [L("fatima", "Actually, \"the place that points\" is the Sculpture Garden. Obviously.")] },
      { t: "talk", npc: "maker", turn: true, text: "Get the last clue from the Maker", lines: [L("maker", "I was told to hand this over only to someone noisy.")] },
      { t: "go", place: "selfie", text: "Race to the fountain", lines: [L("lily", "We finished an hour ago."), L("lyzzy", "We weren't even playing.")] }],
    reward: { cash: 3000, standing: { social: 3 }, friend: { ada: 2, fatima: 2, yakubu: 2, bola: 2, kelechi: 2, joy: 2, "@roomie": 2 }, flags: ["strike_off", "hunt_outfit"] },
    around: { radio: [L("kabiru", "They've called it off! Come back! Bring your bags! Bring my listeners!")], walker: ["Fourteen weeks of lectures in seven. Lunch is now theoretical."], phone: [] } },

  /* ---------- m71 — Bolaji's choice ---------- */
  { id: "m71", ch: 19, year: 3, sem: 2, gate: 72, title: "Bolaji's choice", giver: "bola", thread: "F", shape: "choice",
    intro: "The mall wants Bolaji skating in its adverts full-time. He has a withdrawal form half filled in.",
    need: { done: ["m70"] }, music: { start: "motif_crew", end: "motif_crew" },
    steps: [
      { t: "talk", npc: "bola", text: "Find Bolaji at the basketball court", lines: [L("", "He is not skating. He is sitting on the board."), L("bola", "They'll pay me. Monthly. To skate. Do you know what that sentence means to me?"), L("bola", "I just have to stop this. School. It's only two more years of sitting down.")] },
      { t: "talk", npc: "manager", text: "Ask the mall manager about the contract", lines: [L("manager", "Full-time means full-time. Students have exams. Exams are not content.")] },
      { t: "find", item: "scripts", at: "court", turn: true, text: "Pick up Bolaji's exam scripts at the Basketball Court", lines: [L("", "His exam scripts fall out of his bag. All As."), L("bola", "Give me that. …I don't want to be good at it. If I'm good at it I have to stay.")] },
      { t: "choice", prompt: "What do you tell him?", text: "Tell Bolaji what you think", options: [
        { label: "Ask them for part-time. You can do both.", set: "bolaji_parttime", friend: { bola: 8 } },
        { label: "It's your life. I'll help you carry your things.", set: "bolaji_deferred", friend: { bola: 8 } }] },
      { t: "walk", place: "senate", npc: "bola", text: "Walk with Bolaji to the Registry", lines: [L("adebayo", "Withdrawal? Or deferment? They are different forms. One of them, I can lose.")] }],
    reward: { cash: 0, flags: ["bolaji_decided"] },
    around: { radio: [L("radio", "Whatever she decides, she lands on her feet. She always has.")], walker: ["Bolaji with a form? I thought she was allergic to paper."], phone: [] } },

  /* ---------- m72 — Workshop nights ---------- */
  { id: "m72", ch: 19, year: 3, sem: 2, gate: 73, title: "Workshop nights", giver: "ezekiel", thread: "D", shape: "build",
    intro: "Group Light Work's project: solar lamps for the dark road to Phase 2. Dr. Khadija wants a budget, a drawing and a reason. Mr. Ezekiel wants his tools signed for.",
    need: { done: ["m71"] }, music: { start: "motif_work", end: "motif_work" },
    steps: [
      { t: "talk", npc: "khadija", text: "Pitch the lamp project to Dr. Khadija", lines: [L("khadija", "A budget. A drawing. A reason. In that order."), L("fatima", "The reason is the bend where the convoy was attacked. Page two.")] },
      { t: "buy", item: "panel", text: "Buy a solar panel at Bright Electricals" },
      { t: "buy", item: "battery", text: "Buy a battery from Chi-Tech", lines: [L("chitech", "These batteries are tired but honest. Like me.")] },
      { t: "collect", item: "pole", n: 3, at: "stalls", r: 60, text: "Collect three poles behind the stalls" },
      { t: "talk", npc: "ezekiel", turn: true, text: "Join Mr. Ezekiel's evening tutorial in the lab", lines: [L("", "The lab is locked at night. Mr. Ezekiel is the evening tutorial."), L("ezekiel", "Sign for every tool. Solder with the window open. Never say \"it should work\".")] },
      { t: "build", parts: { panel: 1, battery: 1, pole: 1 }, place: "@dept", give: "lamp", text: "Build the lamp head in the lab",
        fail: { text: "Bad solder. The lamp flickers; redo that joint.", resume: 5, wait: "now" } },
      { t: "look", place: "@dept", secs: 4, text: "Switch the lamp on", lines: [L("jega", "It should work."), L("ezekiel", "Out. …Sit down. I was joking. Mostly."), L("", "The lamp lights the whole lab.")] },
      { t: "talk", npc: "ezekiel", text: "Hear Mr. Ezekiel's verdict", lines: [L("ezekiel", "Whose joint is this? It's clean. Hm. Don't let it enter your head.")] }],
    fail: { text: "Bad solder: the lamp flickers. Redo that step.", resume: 5, wait: "now" },
    reward: { cash: 2000, standing: { department: 5 }, friend: { ezekiel: 4 }, flags: ["lamp_built"] },
    around: { radio: [L("kabiru", "Something is glowing in an engineering lab after hours. For once, on purpose.")], walker: ["Mr. Ezekiel smiled. I have a witness."], phone: [] } },

  /* ---------- m73 — Test run ---------- */
  { id: "m73", ch: 20, year: 3, sem: 2, gate: 74, title: "Test run", giver: "fatima", thread: "D", shape: "defend",
    intro: "The first lamp goes up at dusk on the darkest bend. It comes on. Everything that hates light comes too. By morning two more lamps are dead, cables cut clean.",
    need: { done: ["m72"] }, music: { start: "tension_mid", turn: "tension_low", end: "tension_low" },
    steps: [
      { t: "carry", item: "lamp", place: "checkpoint", text: "Carry the lamp to the dark bend", lines: [L("bola", "If this falls on me, write \"he died as he lived: under protest\".")] },
      { t: "defend", place: "checkpoint", enemy: "shade", secs: 90, night: true, text: "Hold the bend while the lamp charges",
        fail: { text: "The lamp was smashed. Rebuilding takes a day.", resume: 1, wait: "tomorrow" } },
      { t: "sleep", text: "Sleep till morning" },
      { t: "go", place: "checkpoint", turn: true, text: "Check the lamps on the bend", lines: [L("", "Two lamps you installed yesterday afternoon are dark. The cables are cut with a tool."), L("fatima", "Actually, shades don't own pliers.")] },
      { t: "tail", npc: "scrap", place: "stalls", text: "Follow the scrap cart without being seen" },
      { t: "talk", npc: "scrap", text: "Talk to the scrap dealer", lines: [L("scrap", "I buy what they bring. Lamp, no lamp, copper is copper.")] },
      { t: "choice", prompt: "Report him, or bargain?", text: "Report the scrap dealer, or bargain", options: [
        { label: "Report him to Sgt. Bilkisu", set: "scrap_reported", standing: { community: 3 } },
        { label: "Bargain: he supplies poles and says the lamps are his", set: "scrap_partner", standing: { street: 3 } }] }],
    fail: { text: "Lamp destroyed in the defence: rebuilding takes a day.", resume: 1, wait: "tomorrow" },
    reward: { cash: 3000, standing: { department: 3 }, flags: ["lamp_tested"] },
    around: { radio: [L("kabiru", "One lamp on the long road. One. It looks like a star that got lost.")], walker: ["I walked past it twice just to be seen by it."], phone: [] } },

  /* ---------- m74 — Ranger Lawal's debt ---------- */
  { id: "m74", ch: 20, year: 3, sem: 2, gate: 75, title: "Ranger Lawal's debt", giver: "lawal", thread: "W", shape: "escort",
    intro: "A patrol has not come back. He has turned you round three times. Tonight he comes to the fence and asks you to walk in front, because you know the white stones.",
    need: { done: ["m73"] }, music: { start: "motif_elder", end: "motif_elder" },
    steps: [
      { t: "talk", npc: "lawal", night: true, text: "Meet Ranger Lawal by the fence", lines: [L("", "At the fence, hat in hand."), L("lawal", "Two of my men. Since afternoon. The radio is only rain."), L("lawal", "You know the old path better than my map. I'm asking.")] },
      { t: "escort", npc: "lawal", place: "lowerdam", text: "Lead Ranger Lawal along the white stones" },
      { t: "find", item: "tracks", at: "lowerdam", text: "Find the boot prints off the path" },
      { t: "look", place: "lowerdam", secs: 4, turn: true, text: "Reach the flooded stream", lines: [L("", "The stream is in flood. One ranger is on the far bank with a twisted ankle."), L("", "The other will not leave him.")] },
      { t: "carry", item: "rope", place: "lowerdam", give: "rope", text: "Fix the rope and bring them across", lines: [L("ranger2", "I told him it was a short cut. It was a long cut.")],
        fail: { text: "Swept downstream. You wash up twenty metres down, wet and embarrassed. Try again.", resume: 4, wait: "now" } },
      { t: "escort", npc: "ranger2", place: "checkpoint", text: "Walk the injured ranger to the ranger post", lines: [L("lawal", "My grandmother says you buy her groundnuts and listen to the end."), L("lawal", "Go where you like out there. Follow my light if you see it.")] }],
    fail: { text: "Swept at the crossing. Try again.", resume: 4, wait: "now" },
    reward: { cash: 3000, standing: { community: 5 }, flags: ["forest_pass"] },
    around: { radio: [L("kabiru", "Rain. Finally. The dust has been owing us.")], walker: ["He came home wet and polite. What did you do to him?"], phone: [] } },

  /* ---------- m75 — The third coil wakes ---------- */
  { id: "m75", ch: 20, year: 3, sem: 2, gate: 76, title: "The third coil wakes", giver: "maker", thread: "M", shape: "carry",
    intro: "Old Campus has no power. Your project lamps do. Carry a panel and battery through the forest and hold the clearing while the third coil takes its first charge in forty years.",
    need: { done: ["m74"] }, music: { start: "motif_light", turn: "tension_high", end: "sting_coil" },
    steps: [
      { t: "talk", npc: "maker", give: "connector", text: "Take the Maker's connector", lines: [L("maker", "I made this the year I should have graduated. It fits. I never got to see it fit.")] },
      { t: "go", place: "@dept", give: "panel_kit", text: "Pick up the panel and battery at the department" },
      { t: "carry", item: "panel_kit", place: "checkpoint", text: "Carry the panel to Old Campus with your crew", lines: [L("", "Through the forest; rangers wave you past."), L("@roomie", "I left my bed for this. I want that noted.")] },
      { t: "look", place: "checkpoint", secs: 4, text: "Set the stool upright and bolt the panel on", lines: [L("", "Set the upright stool back at the bench. Bolt the panel to the coil.")] },
      { t: "defend", place: "checkpoint", enemy: "shade", secs: 120, turn: true, text: "Hold the clearing till the needle hits the mark", lines: [L("", "The sun is going. The panel has ten minutes of light left to give.")],
        fail: { text: "Retreat to the ridge. The charge is kept; come back at dusk.", resume: 4, wait: "dusk" } },
      { t: "build", parts: { connector: 1, panel_kit: 1 }, place: "checkpoint", text: "Fit the Maker's connector to the coil", lines: [L("", "The coil hums. Far off, the Garden coil answers, and under the mall, a third note.")] },
      { t: "phone", npc: "maker", incoming: true, text: "Answer the Maker's call", lines: [L("maker", "Three. I can hear three. …Thank you. I don't say it enough.")] }],
    fail: { text: "Retreat to the ridge; return at next dusk with the charge kept.", resume: 4, wait: "dusk" },
    reward: { cash: 15000, standing: { academics: 2, street: 2, social: 2, community: 2, department: 2 }, flags: ["coil3"] },
    around: { radio: [L("radio", "Three.")], walker: [], phone: [L("kaka", "I saw the light from my door. I knew that light. Come and eat groundnut.")] } },

  /* ---------- m76 — Heartbreak, or not ---------- */
  /* Single path (no partner) in the script: @best: "You've been in the bush and the lab all term. Pier. Six." —
     meet at the Dam pier; the scene is about the friendship and has only the repair option. Not branched yet. */
  { id: "m76", ch: 20, year: 3, sem: 2, gate: 77, title: "Heartbreak, or not", giver: "@crush", thread: "R", shape: "choice",
    intro: "After months apart, somebody is not where they used to be. Listen first. Then say the true thing.",
    need: { done: ["m75"] }, music: { start: "motif_heart", end: "motif_heart" },
    steps: [
      { t: "phone", npc: "@crush", incoming: true, text: "Read the message", lines: [L("@crush", "Can we talk? Not on the phone.")] },
      { t: "go", place: "love", text: "Meet them in the Love Garden at sunset", lines: [L("", "They are early. That is new.")],
        fail: { text: "You didn't turn up. They ended it by message, with reasons.", resume: 1, wait: "tomorrow" } },
      { t: "listen", npc: "@crush", secs: 12, text: "Listen. Don't interrupt", lines: [L("@crush", "When everybody left, you stayed, and you didn't call. I checked my phone like a fool."), L("@crush", "Then I come back and you are saving the world with Fatima and a soldering iron."), L("@crush", "I'm not asking you to stop. I'm asking where I am in it.")] },
      { t: "talk", npc: "@crush", turn: true, text: "Hear the hard question", lines: [L("@crush", "And you never have any. I don't mind garri. I mind not being told.")] },
      { t: "choice", prompt: "Say the true thing.", text: "Say the true thing", options: [
        { label: "I got it wrong. Here is what I will do differently.", set: "rel_y3_repair" },
        { label: "I think we are better as friends.", set: "rel_y3_friends", breakup: true },
        { label: "I need this year for the work.", set: "rel_y3_pause", breakup: true }] }],
    reward: { cash: 0, flags: ["heart_y3"] },
    around: { radio: [L("radio", "A letter tonight from someone who said the true thing and survived.")], walker: ["We heard. We always hear. We're sorry. Or congratulations."], phone: [] } },

  /* ---------- m77 — Wedding at the quarters ---------- */
  { id: "m77", ch: 20, year: 3, sem: 2, gate: 78, title: "Wedding at the quarters", giver: "garba", thread: "W", shape: "rhythm",
    intro: "Malam Garba's daughter is marrying. You need an outfit, a gift and a place in the dance line. But first Hajiya Ladi's daughter Aisha has admission, and her mother cannot leave the shop.",
    need: { done: ["m76"] }, music: { start: "motif_elder", end: "motif_school" },
    steps: [
      { t: "talk", npc: "ladi", text: "Hear Hajiya Ladi's favour", lines: [L("ladi", "She got in! My Aisha! And registration is today and my shop is full. You know the way.")] },
      { t: "escort", npc: "aisha", place: "senate", text: "Walk Aisha to the Senate", lines: [L("aisha", "Is it true they take light every night? Is it true there is a man with a lightning machine?"), L("garba", "Another one. Welcome, my child. And you: tomorrow. Do not be late.")] },
      { t: "escort", npc: "aisha", place: "@dept", text: "Walk Aisha to her department" },
      { t: "buy", item: "wedding_gift", text: "Buy a wedding gift at Gift Corner or the MIB Store", lines: [L("clemantine", "For a wedding? Not red. Red is for apology. Take the white.")] },
      { t: "go", place: "quarters", text: "Go to the wedding at the Staff Quarters", lines: [L("", "Canopies, coolers, aunties.")] },
      { t: "rhythm", pass: 500, text: "Dance up to the couple and spray", lines: [L("@roomie", "Spray small! This is not your wedding!")] },
      { t: "look", place: "quarters", secs: 6, turn: true, text: "Look to the edge of the canopy", lines: [L("", "At the very edge of the canopy, for one minute only, a man in a lab coat."), L("garba", "He came. In thirty years he has not left that garden. He came."), L("maker", "I can hear three coils. I thought I could spare an hour.")] }],
    fail: { text: "No native outfit? Alhaji Needle lends one, \"ready since last Thursday\".", resume: 4, wait: "now" },
    reward: { cash: 0, standing: { community: 4, social: 3 }, friend: { garba: 6 }, flags: ["aisha_fresher", "maker_left_once"] },
    around: { radio: [L("radio", "A dedication from the Senate porter's lodge to the newest couple in Staff Quarters.")], walker: [], phone: [L("mum", "You went to a wedding? Did you eat? Did you bring take-away? Who raised you?")] } },

  /* ---------- m78 — Lights on the long road ---------- */
  { id: "m78", ch: 20, year: 3, sem: 2, gate: 80, title: "Lights on the long road", giver: "fatima", thread: "D", shape: "convoy",
    intro: "Demo day on the quad, exams in a hurry, and then the last lamp. At dusk the whole road to Phase 2 lights up, pole by pole, and everybody rides it.",
    need: { done: ["m77"] }, music: { start: "motif_work", turn: "sting_test", end: "sting_level" },
    steps: [
      { t: "go", place: "enggarden", text: "Present your project on the quad", lines: [L("", "Projects on tables. The Dean stops at yours."), L("fatima", "I can't. You talk. I'll point.")] },
      { t: "talk", npc: "fatima", turn: true, text: "Step back and let Fatima present", lines: [L("fatima", "Actually… the reason is on page two. It is a bend in the road where our friends were afraid."), L("", "She presents. It is the best five minutes of the day.")] },
      { t: "class", pass: 3, place: "nelt", text: "Sit the first exam paper at NELT",
        fail: { text: "Failed paper: it carries over, as before.", resume: 2, wait: "tomorrow" } },
      { t: "class", pass: 3, place: "nelt", text: "Sit the second exam paper at NELT" },
      { t: "collect", item: "pole", n: 1, at: "stalls", r: 60, text: "Fetch the last pole from the stalls" },
      { t: "build", parts: { pole: 1 }, place: "p2park", text: "Plant pole forty on the Phase 2 side" },
      { t: "convoy", npc: "shuttle", place: "p2park", veh: "bike", text: "Lead the convoy down the newly lit road", lines: [L("", "Bicycles, kekes, the shuttle and one skateboard, as the lamps come on ahead of you."), L("shuttle", "Shift! Shift for your neighbour! Everybody shift, there is light for all!"), L("risi", "I will leave the plate out anyway. Old habits.")] },
      { t: "talk", npc: "maker", text: "Talk to the Maker at the year's end", lines: [L("", "He spreads a map on the plaque."), L("maker", "Three lit. Three dark. One is in the sky. One is under water."), L("maker", "And one has never been built. But that is a final-year problem.")] }],
    fail: { text: "Failed paper: carry-over, as in second year.", resume: 2, wait: "tomorrow" },
    reward: { cash: 10000, standing: { department: 6 }, flags: ["road_lit", "year4"] },
    around: { radio: [L("kabiru", "Forty lamps. Students built them. I am not crying. It's harmattan. In June.")], walker: [], phone: [L("dad", "Your mother says you put light on a road. A whole road? …Send a picture.")] } }
  ];

  /* stable voice ids: per mission, in order through steps, choice-option lines, then around (radio, phone) */
  M.forEach(function (m) {
    var k = 0;
    function tag(l) { k++; if (l.length < 3) l.push("Y3-" + m.id + "-" + (k < 10 ? "0" : "") + k); }
    m.steps.forEach(function (s) { (s.lines || []).forEach(tag); (s.options || []).forEach(function (o) { (o.lines || []).forEach(tag); }); });
    (m.around.radio || []).forEach(tag); (m.around.phone || []).forEach(tag);
  });

  D.STORY.push({ file: "y3", year: 3, npcs: NPCS, items: ITEMS, missions: M });
})();
