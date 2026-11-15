/* Freshers School Life — Year 5 "Leaving" (500 level): missions m100–m120, the finale and the epilogue.
   Source: docs/story/scripts/Y5.md. Data only (contract: docs/story/ENGINE.md). Spoken lines get stable
   voice ids "Y5-mNNN-KK", numbered in file order within each mission (steps, then choice options, then
   "around"); narration lines (speaker "") are not voiced and get no id.

   Changes from the script, and why (each is also in docs/story/ENGINE_ISSUES.md under "Y5 needs"):
   - @super (the supervisor chosen in m101) is not an engine token: every @super beat is three steps
     branched with `if: "super_okonkwo" | "super_bello" | "super_khadija"`.
   - Rooms (library hidden room, Senate basement and roof, mall office and basement, porter's lodge,
     first-year room) use the building's place id; the engine has no rooms.
   - Old Campus and the ranger post use "oldcampus" when the map has it, else "checkpoint".
   - The pier and "the dark bend" photo spots use "dam" and "lowerdam".
   - Nulls and Chancellor Null use the shade and Count Entropy stand-ins (`enemy: "shade"` / `"entropy"`).
   - The boat ride on the Dam (m114) is a `go` to the Dam; the engine has no boat.
   - Crowd escorts (300 students in m112, the family tour in m118) escort one person (Aisha; Mum).
   - "Answer chosen by your highest standing" (m108 argument, m110 award, m115 refusal) is a player
     choice with one option per standing; the engine cannot pick by standing yet.
   - m104's third way needs high Community; the engine's options cannot be gated, so it is always shown.
   - m107's "no HUD, no objective" walk shows the objective "Walk" and is not rain-gated.
   - m110 beat 4 (two-timed seating) is left out: no earlier file sets `twotimed_caught`.
   - m117 beat 4 uses @best's line only: there is no partner flag to branch the @crush line on.
   - m106's fire drill is a run to the Fire Station plus a head count at the workshop.
   - Script XP is left to the engine (it computes XP from the gates); cash, standings and items are kept.
*/
(function () {
  "use strict";
  var root = typeof window !== "undefined" ? window : globalThis;
  var D = root.SamaruData; if (!D) return;
  D.STORY = D.STORY || [];

  var hasPlace = function (id) { return (D.PLACES || []).some(function (p) { return p.id === id; }); };
  var OLD = hasPlace("oldcampus") ? "oldcampus" : "checkpoint";
  var ALL5 = { academics: 5, street: 5, social: 5, community: 5, department: 5 };
  function L(sp, text) { return [sp, text]; }
  function N(text) { return ["", text]; }
  // One step per supervisor: the same beat, spoken by whoever you chose in m101.
  function bySuper(step, lines) {
    return ["okonkwo", "bello", "khadija"].map(function (who) {
      var s = {}; for (var k in step) s[k] = step[k];
      s.npc = who; s["if"] = "super_" + who;
      s.lines = (lines[who] || lines.all || []).map(function (l) { return [l[0] === "@super" ? who : l[0], l[1]]; });
      return s;
    });
  }
  function flat(a) { return [].concat.apply([], a.map(function (x) { return Array.isArray(x) && x.length && typeof x[0] === "object" && !Array.isArray(x[0]) ? x : [x]; })); }

  var NPCS = [
    { id: "fresher", name: "A fresher", role: "First-year student", at: "gate", skin: "#7a4a2b", hair: "low", top: "#f8fafc", voice: "male", pitch: 1.25, hi: ["Senior, please, where is the Senate?", "Good morning, senior."] },
    { id: "bedfresher", name: "A fresher", role: "First-year, in your old room", at: "danfodio", skin: "#6b4226", hair: "fade", top: "#93c5fd", voice: "male", pitch: 1.3, hi: ["Sorry, senior.", "The window sticks."] },
    { id: "oldfresher", name: "A fresher you once walked", role: "First-year student", at: "selfie", skin: "#a8724a", hair: "afro", top: "#fde68a", voice: "male", pitch: 1.2, hi: ["You won't remember me."] },
    { id: "taxboy", name: "The boy", role: "Second-year, collecting \"tax\"", at: "court", skin: "#5a361f", hair: "fade", top: "#ef4444", voice: "male", pitch: 1.05, hi: ["Tax is tax.", "It's tradition."] },
    { id: "miner", name: "A Mining student", role: "Mining Engineering", at: "dept_mining", skin: "#74472a", hair: "braids", top: "#f59e0b", voice: "female", pitch: 1.1, hi: ["Nobody ever asks Mining."] },
    { id: "fireofficer", name: "Fire Officer", role: "Fire service", at: "fire", skin: "#553320", hair: "cap", hairCol: "#b91c1c", top: "#b91c1c", voice: "male", pitch: .85, hi: ["Who is the senior here?"] },
    { id: "examiner", name: "External Examiner", role: "Project panel", at: "@dept", skin: "#6b4226", hair: "bald", top: "#1f2937", voice: "male", pitch: .8, hi: ["Hm."] },
    { id: "mum", cameo: true, name: "Mum", role: "Your mother", at: "gate", skin: "#7d4e2e", hair: "hijab", hairCol: "#16a34a", top: "#fef3c7", voice: "female", pitch: .95, hi: ["Have you eaten?", "You're thin."] },
    { id: "dad", cameo: true, name: "Dad", role: "Your father", at: "gate", skin: "#5e3a22", hair: "cap", hairCol: "#f8fafc", top: "#e2e8f0", voice: "male", pitch: .8, hi: ["Hm. It's a good gate."] },
    { id: "muhammad", name: "Muhammad", role: "A new student", at: "gate", skin: "#c99468", hair: "low", top: "#f8fafc", voice: "male", pitch: 1.3, hi: ["Excuse me. Sorry.", "I'm new."] },
    { id: "lucky", name: "Lucky", role: "Final-year student", at: "social", skin: "#85532f", hair: "fade", top: "#0ea5e9", voice: "male", pitch: 1.05, hi: ["Phone face down tonight.", "Call me instead."] },
    { id: "svitlana", name: "Svitlana", role: "Flying Club", at: "strip", skin: "#e8c4a0", hair: "bun", top: "#f97316", voice: "female", pitch: 1.05, hi: ["Mirror is ready."] },
    { id: "shehu", name: "Mrs. Shehu", role: "Librarian", at: "library", skin: "#6a4127", hair: "hijab", hairCol: "#334155", top: "#e2e8f0", voice: "female", pitch: .9, hi: ["Shh.", "I saw nothing."] },
    { id: "everyone", name: "Everyone", role: "The whole school", at: "selfie", skin: "#7a4a2b", hair: "low", top: "#f59e0b", voice: "male", pitch: 1, hi: ["UP NEPA!"] }
  ];

  var ITEMS = {
    finalist_jacket: { name: "MIB \"Finalist\" jacket", price: 0, text: "White and gold. Freshers step off the path." },
    finalist_clue: { name: "Finalist clue", price: 0, text: "One of Kabiru's hundred." },
    coil_design: { name: "Sixth-coil design", price: 0, text: "The Maker's notebook, decoded." },
    survey_map: { name: "Survey map", price: 0, text: "The professor's original survey of the campus." },
    copper_strap: { name: "Copper strap", price: 0, text: "From Emeka's first okada." },
    net_float: { name: "Net float", price: 0, text: "Baba Dam's, for the insulator." },
    beacon_lens: { name: "Beacon lens", price: 0, text: "The old airfield beacon." },
    pot_lid: { name: "Pot lid", price: 0, text: "Mama Nkechi's biggest. The top plate." },
    brass_weights: { name: "Brass weights", price: 0, text: "From Hajiya Ladi's scale." },
    soldering_iron: { name: "Mr. Ezekiel's soldering iron", price: 0, text: "Signed out. Never signed back in." },
    bronze_bracket: { name: "Bronze bracket", price: 0, text: "Cast by Kelechi. It goes where the gap is." },
    frame_kit: { name: "Coil frame kit", price: 0, text: "Twelve parts and a lot of bolts." },
    cold_letter: { name: "Cold letter", price: 0, text: "\"Convocation is cancelled.\" The paper is cold." },
    clearance_form: { name: "Clearance form", price: 0, text: "Six stamps. Every one a story." },
    dinner_ticket: { name: "Final-year dinner ticket", price: 3000, text: "Only at the MIB Store." },
    gown: { name: "Graduation gown", price: 0, text: "Sewn at cost by Alhaji Needle." },
    album: { name: "Photo album", price: 0, text: "Five photographs, five places." },
    signout_shirt: { name: "Sign-out shirt", price: 0, text: "White, covered in everybody's handwriting." },
    dept_section: { name: "A department's yes", price: 0, text: "One section of coil, promised." },
    groundnut_cone: { name: "Cone of groundnuts", price: 0, text: "From Kaka. \"For the others.\"" }
  };

  var M = [
    { id: "m100", ch: 25, sem: 1, title: "Finalist", gate: 106, giver: "kabiru", thread: "F", shape: "escort",
      intro: "Mission one hundred. Freshers call you \"senior\" and step off the path. Kabiru hides a hundred clues to prove you know the place. A day off.",
      need: { done: ["m99"] }, music: { start: "motif_school", end: "motif_school" },
      steps: [
        { t: "go", place: "gate", text: "Walk in through the Main Gate", lines: [N("Three freshers stop you before you reach the fountain."), L("fresher", "Senior, please, where is the Senate?"), L("fresher", "Senior, is it true you fought a generator?"), L("fresher", "Senior, you get garri?")] },
        { t: "escort", npc: "fresher", place: "senate", text: "Walk a fresher to the Senate", lines: [N("You catch yourself saying Malam Garba's lines.")] },
        { t: "turn", text: "Listen to DJ Kabiru on the radio", lines: [L("radio:kabiru", "One hundred things only a finalist would know. First: where did the suya man go?")] },
        { t: "collect", item: "finalist_clue", n: 10, at: "selfie", r: 380, text: "Find 10 of Kabiru's finalist clues", lines: [N("Sly's chair, the hidden library room, the dark bend (now lit), the pier, the upright stool. Each plays a three-second memory.")] },
        { t: "go", place: "@hostel", turn: true, text: "Go to your first-year room", lines: [N("The tenth is your own first-year room. Somebody else's bucket is on the bed."), L("bedfresher", "Sorry, senior. Is this your bed? The list says it's mine."), L("me", "It's yours. Look after the window; it sticks.")] }],
      reward: { cash: 5000, item: "finalist_jacket", flags: ["finalist"] },
      around: { radio: [["kabiru", "Finalists, your clearance forms will not sign themselves. I checked."]], walker: [], phone: [["kelechi", "Outside is fine. Nobody takes light. I don't trust it."]] } },

    { id: "m101", ch: 25, sem: 1, title: "The Maker's notebook", gate: 107, giver: "maker", thread: "D", shape: "choice",
      intro: "Choose a supervisor for your final-year project. Then the Maker gives you the book he has never shown anyone, half of it in a shorthand only your class could read.",
      need: { done: ["m100"] }, music: { start: "motif_work", turn: "motif_light", end: "motif_light" },
      steps: flat([
        { t: "talk", npc: "khadija", text: "See Dr. Khadija about the project list", lines: [L("khadija", "Three of us have space. Choose who you will argue with all year.")] },
        { t: "choice", prompt: "Choose your project supervisor", text: "Choose your project supervisor", options: [
          { label: "Dr. Okonkwo (exacting; best build help)", set: "super_okonkwo" },
          { label: "Prof. Bello (wandering; best theory; knew the professor)", set: "super_bello" },
          { label: "Dr. Khadija (firm; best with panels and paperwork)", set: "super_khadija" }] },
        { t: "go", place: "enggarden", text: "Go to the Maker in the Engineering Garden", lines: [L("maker", "Thirty years of notes. I stopped writing where I got stuck. Page two hundred and six.")] },
        { t: "quiz", subject: "ee", n: 6, pass: 4, turn: true, text: "Decode the Maker's shorthand", give: "coil_design", lines: [N("The shorthand is lecture shorthand: your lecturers' own abbreviations. Each right answer unlocks a page of the design.")] },
        bySuper({ t: "talk", text: "Show the notebook to your supervisor" }, {
          okonkwo: [L("@super", "This is his? …I was in the class below. We thought he was a story.")],
          bello: [L("@super", "Ah. Her handwriting in the margin. Now, where was I? I was twenty-five.")],
          khadija: [L("@super", "It's too big for one student. Good. Find me the others.")] })]),
      reward: { standing: { academics: 3 }, flags: ["design"] },
      around: { radio: [["radio:bugaje", "Six were planned."]], walker: ["Somebody's project is a whole Tesla coil. Mine is a questionnaire."], phone: [] } },

    { id: "m102", ch: 25, sem: 1, title: "Fresher tax, reversed", gate: 108, giver: "sly", thread: "F", shape: "choice",
      intro: "A new boy at the court is taxing freshers. Big Sly would like a word with him. He would like you there.",
      need: { done: ["m101"] }, music: { start: "motif_crew", end: "motif_crew" },
      steps: [
        { t: "talk", npc: "sly", text: "See Big Sly at the barber's", lines: [L("sly", "Sly hears there is a small boy at the court collecting \"fresher tax\"."), L("sly", "Sly invented that foolishness. Sly would like to un-invent it. Come.")] },
        { t: "go", place: "court", text: "Go to the basketball court with Sly", lines: [N("A second-year with Sly's old walk and none of his size. Aminu's classmates are queuing with their lunch money."), L("taxboy", "Tax is tax. Ask anybody. It's tradition.")] },
        { t: "look", npc: "taxboy", secs: 4, turn: true, text: "Size up the tax collector", lines: [N("He does not recognise either of you.")] },
        { t: "choice", prompt: "Talk to him, or spar?", text: "Talk to him, or spar", options: [
          { label: "Talk", set: "taxboy_talk", standing: { community: 4 }, lines: [L("sly", "Sit. I'll cut your hair and tell you how it ends. It ends in a chair like this one.")] },
          { label: "Spar by agreement, gloves on", set: "taxboy_spar", standing: { street: 4 } }] },
        { t: "fight", "if": "taxboy_spar", enemy: "bully", n: 1, at: "court", text: "Spar with him, gloves on", lines: [N("Bystanders make the crowd.")] },
        { t: "turn", "if": "taxboy_spar", text: "Hear Sly out", lines: [L("sly", "You get mind. Now give back the money, with change.")] },
        { t: "emote", emote: "wave", at: "court", text: "Wave the freshers off at the court", lines: [N("The freshers get their money back and one asks Sly for a selfie.")] }],
      reward: { cash: 2000, flags: ["tax_ended"] },
      around: { radio: [["radio:street", "The court is free. It was always free. Some people forgot."]], walker: ["The big barber gave me ₦50 extra. I don't know why. I'm keeping it."], phone: [] } },

    { id: "m103", ch: 25, sem: 1, title: "Sixth site", gate: 109, giver: "shehu", thread: "M", shape: "collect",
      intro: "The sixth plaque says only \"at the centre\". One reference is in a room the library does not admit to having, and four corners of campus have to be measured from.",
      need: { done: ["m102"] }, music: { start: "motif_road", turn: "sting_reveal", end: "motif_school" },
      steps: [
        { t: "go", place: "library", text: "Go to the Library", lines: [L("shehu", "Shh. …There is no such room. Third shelf, pull the atlas. I saw nothing.")] },
        { t: "find", item: "survey_map", at: "library", text: "Find the survey map in the hidden room", lines: [N("The professor's original survey, with Fatima reading in the corner."), L("fatima", "Actually, I found this room in first year. I'm glad you finally caught up.")] },
        { t: "go", place: "gate", text: "Take a sighting at the gate beacon" },
        { t: "go", place: "dam", text: "Take a sighting at the Dam marker" },
        { t: "go", place: "strip", text: "Take a sighting from the airfield tower" },
        { t: "go", place: "p2park", text: "Take a sighting at the Phase 2 water tank" },
        { t: "go", place: "library", turn: true, text: "Plot the four bearings in the hidden room", lines: [N("Back in the room, four lines on the map cross under one building."), L("fatima", "The Senate. Under the tower. Of course. Where else is \"the centre\" of a school?")] },
        { t: "go", place: "senate", text: "Go down under the Senate", lines: [L("garba", "I was told: one day a student will ask for this key. I have kept it oiled."), N("An empty round room with six bolts in the floor. Plaque: \"6.\"")] }],
      reward: { cash: 3000, standing: { academics: 3 }, flags: ["site6"] },
      around: { radio: [["kabiru", "Somebody was measuring the campus with a stick today. Engineers. We let them live among us."]], walker: ["There's a room under the Senate? I thought that was where they kept the come-back-tomorrows."], phone: [] } },

    { id: "m104", ch: 25, sem: 1, title: "Megawatt's offer", gate: 110, giver: "ada", thread: "D", shape: "delivery",
      intro: "The coil costs more than a keke. Raise it honestly, or let Chief Megawatt pay for all of it and put his name on the tower.",
      need: { done: ["m103"] }, music: { start: "motif_market", turn: "sting_reveal", end: "motif_market" },
      steps: [
        { t: "talk", npc: "ada", text: "Hear Ada's fundraising plan", lines: [L("ada", "Three things. A bake sale. A benefit show. Deliveries through my app with a levy. Go.")] },
        { t: "job", kind: "errand", text: "Sell puff-puff at the mall food court", lines: [N("Each fundraiser is a job: vehicle and banner where it has one.")] },
        { t: "job", kind: "errand", text: "Run the door at the Social Centre show", lines: [L("asiya", "The store will match whatever the students raise. Don't tell my accountant. I'm the accountant.")] },
        { t: "job", kind: "delivery", text: "Do deliveries through Ada's app" },
        { t: "turn", turn: true, text: "Check the fund", lines: [N("You are at forty per cent. An invitation arrives.")] },
        { t: "go", place: "market", text: "Go to the mall office", lines: [L("megawatt", "My dear! I hear you're building a tower thing. I'll pay. All of it. Today."), L("megawatt", "I only ask a small plaque. \"The Megawatt Coil\". Think big.")] },
        { t: "choice", prompt: "Answer Chief Megawatt", text: "Answer Chief Megawatt", options: [
          { label: "Refuse, and keep raising", set: "fund_raised", standing: { community: 5 } },
          { label: "Accept, with his name on it", set: "fund_megawatt_named" },
          { label: "\"Give it with no name, and I'll tell them who gave it.\"", set: "fund_anon", lines: [N("He thinks. He laughs. He does.")] }] },
        { t: "job", "if": "fund_raised", kind: "delivery", text: "Do two more fundraising jobs (1 of 2)" },
        { t: "job", "if": "fund_raised", kind: "errand", text: "Do two more fundraising jobs (2 of 2)" }],
      reward: { flags: ["fund_complete"] },
      around: { radio: [["kabiru", "Students are selling puff-puff for science. Buy two. One is for the coil. One is for you."]], walker: ["I gave ₦100. I want my name on one screw."], phone: [] } },

    { id: "m105", ch: 26, sem: 1, title: "Parts from everywhere", gate: 111, giver: "maker", thread: "F", shape: "collect",
      intro: "Six people each have one thing the coil needs. Each asks one small thing in return.",
      need: { done: ["m104"] }, music: { start: "motif_crew", end: "motif_crew" },
      steps: [
        { t: "talk", npc: "maker", text: "Get the parts list from the Maker", lines: [L("maker", "You can't buy these. You can only be given them.")] },
        { t: "talk", npc: "nkechi", text: "Ask Mama Nkechi for her pot lid", lines: [L("nkechi", "My biggest pot lid, for the top plate. Eat first. You're thin.")] },
        { t: "eat", place: "buka", text: "Eat at Mama Nkechi's buka", give: "pot_lid" },
        { t: "talk", npc: "ladi", text: "Ask Hajiya Ladi for brass weights", lines: [L("ladi", "Brass weights from my scale. Last price: greet your mother for me.")] },
        { t: "phone", contact: "mum", incoming: false, text: "Call your mother and greet her for Ladi", give: "brass_weights" },
        { t: "talk", npc: "emeka", text: "Ask Emeka for a copper strap", lines: [L("emeka", "Copper strap from my first okada. Ride with me once round the ring, like before.")] },
        { t: "convoy", npc: "emeka", place: "dam", veh: "okada", text: "Ride round the ring with Emeka", give: "copper_strap" },
        { t: "talk", npc: "baba", text: "Ask Baba Dam for a float", lines: [L("baba", "A float from my net, for the insulator. Mend one knot first.")] },
        { t: "look", place: "dam", secs: 6, text: "Mend a knot in Baba Dam's net", give: "net_float" },
        { t: "talk", npc: "uche", text: "Ask Captain Uche for the beacon lens", lines: [L("uche", "The old beacon lens. Say the checklist. Aloud.")] },
        { t: "quiz", subject: "gen", n: 3, pass: 3, npc: "uche", text: "Say the pre-flight checklist aloud", give: "beacon_lens" },
        { t: "talk", npc: "ezekiel", text: "See Mr. Ezekiel", give: "soldering_iron", lines: [N("He says nothing. He puts his own soldering iron in your hand and walks off.")] },
        { t: "go", place: "@hostel", turn: true, text: "Collect a parcel at the porter's lodge", give: "bronze_bracket", lines: [N("A seventh parcel, by post."), L("kelechi", "A bracket. I cast it from the leftover bronze. It goes where the gap is.")] },
        { t: "go", place: "enggarden", text: "Lay the parts out on the coil plaque", lines: [L("maker", "A pot lid. She will be in the ring for ever now. Good. That's correct.")] }],
      reward: { friend: { emeka: 3, baba: 3, uche: 3, nkechi: 3, ladi: 3, ezekiel: 3, kelechi: 3, maker: 3 }, flags: ["parts7"] },
      around: { radio: [["kabiru", "If an engineering student asks you for your pot lid this week, say yes. Don't ask."]], walker: [], phone: [["mum", "Do you need anything from the house? I have a very good spoon."]] } },

    { id: "m106", ch: 26, sem: 1, title: "Build week", gate: 113, giver: "ezekiel", thread: "D", shape: "build",
      intro: "Frame. Two thousand turns of copper. First power-on. A hum, a glow, a smell, and then the fire alarm.",
      need: { done: ["m105"] }, music: { start: "motif_work", turn: "tension_high", end: "quiet" },
      fail: { text: "It cannot be saved; the fire is the story. Try the step again.", resume: 0, wait: "now" },
      steps: flat([
        { t: "talk", npc: "ezekiel", night: true, text: "Sign out the frame kit from Mr. Ezekiel", give: "frame_kit", lines: [N("Three evenings, with a key holder present."), L("ezekiel", "Sign for every tool. Even that one. Even though it's mine. Especially.")] },
        { t: "build", parts: { frame_kit: 1 }, place: "ee", night: true, text: "Bolt the coil frame in the workshop" },
        { t: "rhythm", pass: 60, text: "Wind the copper on a steady beat", lines: [L("fatima", "Nineteen hundred and four. Don't speak to me. Nineteen hundred and five."), L("bola", "If I'd known engineering was knitting, I'd have come to class.")] },
        { t: "build", parts: { copper_strap: 1, net_float: 1, beacon_lens: 1, pot_lid: 1, brass_weights: 1, bronze_bracket: 1 }, place: "ee", night: true, text: "Seat the seven parts on the coil", lines: [N("The pot lid goes on top.")] },
        bySuper({ t: "talk", text: "Get your supervisor's sign-off" }, { all: [] }),
        { t: "turn", turn: true, text: "Power on the coil", lines: [N("A hum. A glow. For three seconds it is the most beautiful thing in the room. Then smoke.")] },
        { t: "go", place: "fire", limit: 90, text: "Run the fire drill: fetch the fire crew", lines: [N("Break glass. Walk, do not run. Count heads."), L("fireofficer", "Who is the senior here? You? Then you count. Loudly.")] },
        { t: "look", place: "ee", secs: 6, text: "Look at what is left of the coil", lines: [N("Dawn. A black frame. The pot lid has survived.")] }]),
      reward: { standing: { department: 3 }, flags: ["coil6_burnt"] },
      around: { radio: [["kabiru", "Fire service attended the engineering workshop. Everybody is fine. Somebody's project is not."]], walker: ["I heard it worked for three seconds. That's three more than mine."], phone: [] } },

    { id: "m107", ch: 26, sem: 1, title: "Failure", gate: 114, giver: "", thread: "D", shape: "routine",
      intro: "Your supervisor says start again. It is raining. Nobody is at the tea stall. Walk. At the forest edge, Kaka tells the story from the beginning for once.",
      need: { done: ["m106"] }, music: { start: "rain_only", end: "motif_elder" },
      steps: flat([
        bySuper({ t: "talk", text: "Hear your supervisor's verdict" }, { all: [
          L("@super", "It failed where the windings met. Each section is good. They don't agree with each other."),
          L("@super", "Start again. I'm sorry. That's the job.")] }),
        { t: "go", place: "shayi", text: "Walk", lines: [N("The tea stall is shuttered. Rain.")] },
        { t: "go", place: "gate", text: "Walk", lines: [N("The lamps lead toward the fence.")] },
        { t: "talk", npc: "kaka", turn: true, text: "Sit with Kaka under her tarpaulin", lines: [N("Under a tarpaulin, shelling groundnuts."),
          L("kaka", "Sit. This time I'll begin at the beginning."),
          L("kaka", "Six children. Clever, clever. Each one built a part alone, to be the best. I cooked for them."),
          L("kaka", "Six best parts. They didn't fit. They blamed each other. Five went home. One stayed."),
          L("kaka", "You people built yours the same way. Four clever ones in a room with the door shut."),
          L("kaka", "A pot of soup is not six cooks each making one spoon. Open the door.")] },
        { t: "turn", text: "Take the groundnuts", give: "groundnut_cone", lines: [N("She gives you three cones \"for the others\".")] }]),
      reward: { flags: ["lesson_together"] },
      around: { radio: [], walker: [], phone: [["@roomie", "Where are you? I've put garri to soak. For two. Come home."]] } },

    { id: "m108", ch: 26, sem: 1, title: "Everybody, again", gate: 115, giver: "@hod", thread: "D", shape: "social",
      intro: "Ten departments, one section of coil each, wound together in one hall. Go round the quad and ask. Some will say yes at once.",
      need: { done: ["m107"] }, music: { start: "motif_school", end: "motif_school" },
      steps: [
        { t: "talk", npc: "@hod", text: "Tell your HOD the idea", lines: [L("@hod", "One section each, wound in the same room, on the same day, to the same count. Go and ask.")] },
        { t: "talk", npc: "ahmad", text: "Ask Ahmad's department for a section", lines: [L("ahmad", "After the quiz you beat us in? …Fine. But our section goes at the top.")] },
        { t: "talk", npc: "miner", text: "Ask Mining Engineering for a section", lines: [L("miner", "Nobody ever asks Mining. Yes. Before you change your mind.")] },
        { t: "talk", npc: "bello", text: "Ask Physics for a section", lines: [L("bello", "Physics will supervise. That's a joke. We will bring biscuits.")] },
        { t: "collect", item: "dept_section", n: 7, at: "ee", places: ["ee", "chemeng", "physics", "maths", "compsci", "dept_civil", "dept_mech"], text: "Get a yes from the other departments", lines: [N("Every department has one line and one condition.")] },
        { t: "turn", turn: true, unless: "fund_megawatt_named", text: "Hear out two hesitant departments", lines: [N("Two departments hesitate: \"Whose coil is it?\"")] },
        { t: "turn", turn: true, "if": "fund_megawatt_named", text: "Hear out four hesitant departments", lines: [N("Four departments hesitate. The Megawatt name is on everybody's lips: \"Whose coil is it?\"")] },
        { t: "choice", prompt: "How do you win them over?", text: "Win the hesitant departments over", options: [
          { label: "Show them the design (Books)", set: "argue_books", standing: { academics: 1 } },
          { label: "You know their people (Street)", set: "argue_street", standing: { street: 1 } },
          { label: "A party after (Vibes)", set: "argue_vibes", standing: { social: 1 } },
          { label: "Say who it is for (Community)", set: "argue_community", standing: { community: 1 } },
          { label: "Your HOD asks theirs (Department)", set: "argue_department", standing: { department: 1 } }] },
        { t: "go", place: "kt", night: true, text: "Go to Kainji Theatre for the big wind", lines: [N("Twelve groups in one evening session, one beat.")] },
        { t: "rhythm", pass: 70, text: "Wind with all twelve groups on one beat", lines: [L("radio:kabiru", "Turn. Turn. Turn. I have never been so bored and so moved. Turn.")] },
        { t: "look", place: "kt", secs: 6, text: "Look at the twelve sections", lines: [N("Twelve sections that fit.")] }],
      reward: { cash: 5000, standing: { department: 6, community: 3 }, flags: ["coil6_rebuilt"] },
      around: { radio: [["kabiru", "If you were in Kainji tonight, you built something. Tell your children."]], walker: [], phone: [["maker", "I could hear the count from the garden. Twelve. She would have liked twelve."]] } },

    { id: "m109", ch: 26, sem: 1, title: "The Chancellor's shadow", gate: 117, giver: "garba", thread: "M", shape: "investigation",
      intro: "A letter on every board: \"Convocation is cancelled.\" No signature. The paper is cold. And you still need six clearance stamps.",
      need: { done: ["m108"] }, music: { start: "tension_low", turn: "sting_reveal", end: "motif_school" },
      steps: [
        { t: "go", place: "senate", text: "Go to the Senate", lines: [L("garba", "I did not post this. Nobody in this building posted this. Touch it.")] },
        { t: "collect", item: "cold_letter", n: 5, at: "senate", r: 300, text: "Find the cold letters on five notice boards", lines: [N("Each is colder. The fifth says: \"Stay.\"")] },
        { t: "fight", enemy: "shade", n: 4, at: "senate", text: "Push back the blank figures in gowns", lines: [N("Where they pass, signs go white. Lamps you built push them back.")] },
        { t: "look", place: "senate", secs: 5, turn: true, text: "Watch the Senate steps", lines: [N("Where Count Entropy stood in first year, something tall in a gown turns and goes in. It leaves no footprints.")] },
        { t: "go", place: "library", text: "Get the library clearance stamp" },
        { t: "talk", npc: "bursar", text: "Get the bursary clearance stamp", lines: [L("bursar", "Network.")] },
        { t: "go", place: "@hostel", text: "Get the hostel clearance stamp" },
        { t: "go", place: "@dept", text: "Get the department clearance stamp" },
        { t: "talk", npc: "hauwa", text: "Get the Sick Bay clearance stamp", lines: [L("hauwa", "Medically cleared. Eat. Sleep. Please. I will miss saying that to you.")] },
        { t: "talk", npc: "bilkisu", text: "Get the security clearance stamp", give: "clearance_form", lines: [L("bilkisu", "No outstanding warnings. …I've rounded down. Go.")] },
        { t: "talk", npc: "maker", text: "Tell the Maker about the letters", lines: [L("maker", "It's back. It always comes for the last year. It offers you the thing I took.")] }],
      reward: { cash: 3000, flags: ["null_seen", "cleared"] },
      around: { radio: [["radio:nightdrive", "Time: twenty-two hundred. Weather: clear. Stay."]], walker: ["Cancelled? After five years? I'll convocate myself in my room if I have to."], phone: [] } },

    { id: "m110", ch: 27, sem: 1, title: "Dinner night", gate: 118, giver: "yakubu", thread: "R", shape: "social",
      intro: "Final-year dinner. Who you walk in with, where you sit, and what award the class votes you. A night off before the end.",
      need: { done: ["m109"] }, music: { start: "motif_heart", end: "motif_school" },
      steps: [
        { t: "buy", item: "dinner_ticket", text: "Buy a dinner ticket at the MIB Store", lines: [L("mubarak", "Last ticket. I kept it. I'm allowed to keep one. I checked."), N("Wear something formal.")] },
        { t: "phone", npc: "@best", incoming: false, text: "Ask someone to walk in with you" },
        { t: "go", place: "social", night: true, text: "Go to the dinner at the Social Centre", lines: [N("Round tables, name cards, Alhaji Needle adjusting collars at the door.")] },
        { t: "choice", prompt: "Which award does the class vote you?", text: "Hear the class awards", turn: true, options: [
          { label: "Most Likely to Own the Mall (Street)", set: "award_street", lines: [L("yakubu", "\"Most Likely to Own the Mall.\"")] },
          { label: "Mother or Father of the Hostel (Community)", set: "award_community", lines: [L("yakubu", "\"Mother or Father of the Hostel.\"")] },
          { label: "First Class Head, No Class Shoes (Books)", set: "award_books", lines: [L("yakubu", "\"First Class Head, No Class Shoes.\"")] },
          { label: "Life of Every Party (Vibes)", set: "award_vibes", lines: [L("yakubu", "\"Life of Every Party, Including Ones Not Invited To.\"")] },
          { label: "The Department's Own (Department)", set: "award_department", lines: [L("yakubu", "\"The Department's Own.\"")] }] },
        { t: "awards", title: "Final-year dinner", text: "Watch the rest of the ceremony", lines: [N("Maryam reads a short piece. Lucky gives a toast with his phone face down.")] },
        { t: "emote", emote: "dance", at: "social", text: "Dance the last dance", lines: [N("Partner or the whole crew in a ring.")] }],
      reward: { flags: ["dinner5"] },
      around: { radio: [["radio:highlife", "A dedication to the graduating class from every aunty who ever sold them rice."]], walker: [], phone: [["mum", "Send a picture. Full length. I want to see the shoes."]] } },

    { id: "m111", ch: 27, sem: 1, title: "Project defence", gate: 120, giver: "@hod", thread: "D", shape: "quiz",
      intro: "The last test. Then you, a rebuilt coil under a cloth, and a panel that has failed better students. Then the last paper.",
      need: { done: ["m110"] }, music: { start: "sting_test", end: "motif_school" },
      fail: { text: "A weak answer is a pass with corrections. Try the question again.", resume: 2, wait: "now" },
      steps: [
        { t: "class", place: "kt", pass: 2, text: "Sit the last test in Kainji Theatre", lines: [N("Halfway through you look up and see the whole class has grown up.")] },
        { t: "go", place: "@dept", text: "Face the panel at your department", lines: [N("The panel: your HOD, an external examiner, and (unannounced) Mr. Ezekiel at the back.")] },
        { t: "quiz", subject: "ee", n: 8, pass: 4, npc: "examiner", text: "Defend your project to the panel", lines: [L("examiner", "Your first attempt burnt. Why should we trust the second?")] },
        { t: "choice", turn: true, prompt: "Why should they trust the second coil?", text: "Answer the external examiner", options: [
          { label: "\"Because I didn't build the second one. Twelve departments did.\"", set: "defence_team", standing: { department: 2 }, lines: [L("me", "Because I didn't build the second one. Twelve departments did."), L("examiner", "Hm. Uncover it.")] },
          { label: "\"The windings were rewound to a tighter tolerance.\"", set: "defence_tech", lines: [N("The examiner writes something down. You can't read it.")] },
          { label: "\"We used a better insulator from the Dam.\"", set: "defence_tech", lines: [N("The examiner nods slowly. Mr. Ezekiel shakes his head at the back.")] }] },
        { t: "go", place: "nelt", text: "Go to NELT for the final paper" },
        { t: "quiz", subject: "gen", n: 6, pass: 3, text: "Write the final paper in NELT", lines: [N("The last exam. You put the pen down.")] },
        { t: "turn", text: "Walk out of NELT", lines: [N("Somebody has already started the drums."), L("@roomie", "It's finished! We're finished! Why am I crying? It's harmattan.")] }],
      reward: { standing: { academics: 3, department: 3 }, flags: ["defended", "exams_done"] },
      around: { radio: [["kabiru", "To whoever just walked out of NELT for the last time: turn round. Look at it. Okay. Go."]], walker: [], phone: [["dad", "Is it over? All of it? …Well done. I'll tell your mother. She's standing here. She heard."]] } },

    { id: "m112", ch: 27, sem: 2, title: "The longest night", gate: 122, giver: "bilkisu", thread: "M", shape: "defend",
      intro: "Every light on campus goes at once and does not come back: lamps, mall, the long road, all five coils. Hold your hostel till the torches arrive, then walk three hundred students out.",
      need: { done: ["m111"] }, music: { start: "sting_dark", turn: "face_null", end: "motif_home" },
      fail: { text: "Bilkisu hauls you up. Stragglers wait at the lanterns.", resume: 1, wait: "now" },
      steps: [
        { t: "sleep", text: "Sleep in your hostel", lines: [N("Dark. Not a blackout: an absence. Even phones are dim."), L("@roomie", "I can't see my hand. I can't see my garri. This is serious.")] },
        { t: "defend", place: "@hostel", enemy: "shade", secs: 90, night: true, text: "Hold the hostel doors", lines: [N("Shades of every year at once. Freshers behind you.")] },
        { t: "talk", npc: "bilkisu", turn: true, text: "Meet the torches on the stairs", lines: [L("bilkisu", "Everybody out, in twos. I said walk. You: front. You know the way in the dark.")] },
        { t: "escort", npc: "aisha", place: "ee", night: true, text: "Lead the students to the Engineering quad", lines: [N("Three hundred students, between two lines of lanterns held by both fellowships."), L("sam", "Keep to the light. By His grace, and single file."), L("auwal", "Insha Allah, nobody is left behind. Count them at the fountain."), L("aisha", "I'm not scared. I'm walking fast for exercise.")] },
        { t: "listen", place: "ee", secs: 6, text: "Listen to Kabiru's battery radio", lines: [L("radio:kabiru", "I'm on battery. I'll keep talking as long as it lasts. Somebody stay with me.")] },
        { t: "talk", npc: "maker", text: "Find the Maker at the coil fence", lines: [N("He is standing, holding the fence."), L("maker", "It has pulled all five down to get at the gap. Light them again. In order. I'll hold the first.")] }],
      reward: { flags: ["longest_night"] },
      around: { radio: [["radio:freshfm", "If you can hear this, walk toward the engineering side. Bring whoever is next to you."]], walker: [], phone: [] } },

    { id: "m113", ch: 27, sem: 2, title: "Three by road", gate: 124, giver: "lawal", thread: "M", shape: "stealth",
      intro: "The Garden, the Mall and Old Campus, relit in one run. Everyone you met in Year 1 holds the first. Engr. Aliyu has the breaker for the second. The patrol's light is ahead of you for the third.",
      need: { done: ["m112"] }, music: { start: "motif_light", turn: "sting_coil", end: "sting_coil" },
      steps: [
        { t: "defend", place: "enggarden", enemy: "shade", secs: 75, night: true, music: "sting_coil", text: "Defend the first coil in the garden", lines: [N("Sly, Emeka, Bolaji, Baba Porter and Mai Shayi (armed with a kettle) beside you."), L("audu", "Tea first. Then— no. Fight first. Tea after.")], fail: { text: "Back up. The first coil is still yours to hold.", resume: 0, wait: "now" } },
        { t: "go", place: "market", night: true, text: "Ride to the dark mall", lines: [N("The mall is a black box. Chief Megawatt is outside with a torch, directing shoppers."), L("megawatt", "My dear! Tell me what to carry. No, truly. Tell me.")] },
        { t: "stealth", place: "market", guards: 2, night: true, music: "sting_coil", text: "Follow the chalk arrows to the breaker", lines: [N("Nulls erase the exit signs as you go; follow Aliyu's chalk arrows."), L("aliyu", "I'm at the breaker. When you seat it, shout. This time I switch it the right way.")], fail: { text: "The signs are gone again. Back to the mall door.", resume: 2, wait: "now" } },
        { t: "turn", turn: true, text: "Find a way to light Old Campus", lines: [N("The only generator that can jump Old Campus is at the ranger post, and the forest is the darkest place there is.")] },
        { t: "tail", npc: "lawal", place: OLD, near: 10, far: 60, night: true, text: "Follow the ranger's light through the forest", lines: [L("lawal", "Follow my light. Don't look at the trees. They're only trees. Mostly."), L("danladi", "MY GRANDMOTHER CORNERS FASTER! …I LOVE YOU ALL!")], fail: { text: "You lost the light. Ranger Lawal waits at the fence.", resume: 4, wait: "now" } },
        { t: "look", place: OLD, secs: 6, night: true, music: "sting_coil", text: "Jump the coil at Old Campus", lines: [N("At the bench with six stools. All six are upright now; somebody set them.")] }],
      reward: { flags: ["relit123"] },
      around: { radio: [["kabiru", "Three lights on my horizon. Battery at forty per cent. Keep going."]], walker: [], phone: [] } },

    { id: "m114", ch: 27, sem: 2, title: "Three by air and water", gate: 126, giver: "uche", thread: "M", shape: "flight",
      intro: "One pass over the tower beacon in a sky with no lights below. The eel lighting the spillway. And the school's coil carried up the inside of the Senate, floor by floor.",
      need: { done: ["m113"] }, music: { start: "motif_light", turn: "quiet", end: "motif_light" },
      steps: [
        { t: "ride", veh: "plane", night: true, text: "Take off from the dark airfield", lines: [L("uche", "You've done this. Checklist. Aloud. I'm right here.")] },
        { t: "flight", route: ["senate"], night: true, music: "sting_coil", text: "Make one pass over the tower beacon", lines: [N("Svitlana and Abdul on the mirror."), L("abdul", "Left. Left. Hold. …Check.")], fail: { text: "Missed it. Come round for another circuit.", resume: 1, wait: "now" } },
        { t: "go", place: "dam", night: true, text: "Go out on the Dam with Baba Dam", lines: [N("Baba Dam rows without a lamp."), L("baba", "The water hears. Tonight it also sees. Look."), N("The eel swims ahead of the boat and the spillway lights up behind it.")] },
        { t: "rhythm", pass: 50, music: "sting_coil", text: "Breathe with the eel" },
        { t: "go", place: "senate", turn: true, give: "coil", text: "Go to the Senate stairs", lines: [N("The new coil stands at the foot of the stairs, and forty students round it."), L("garba", "Six floors. No lift; they have taken light. We carry.")] },
        { t: "carry", item: "coil", place: "senate", text: "Carry the coil up six floors", lines: [N("Each floor a different crew takes a corner. Letters fall down the stairwell like snow: \"Stay.\" \"Cancelled.\" \"Stay.\""), L("ladi", "Last price! Nobody is dropping this thing! Lift!")] },
        { t: "build", parts: { coil: 1 }, place: "senate", text: "Seat the coil on the six bolts", lines: [N("In the round room. It does not light. Not yet.")] }],
      reward: { flags: ["relit45", "coil6_placed"] },
      around: { radio: [["kabiru", "Five. Battery at eleven per cent. I'm going to stop talking and just leave the microphone open."]], walker: [], phone: [] } },

    { id: "m115", ch: 28, sem: 2, title: "Chancellor Null", gate: 128, giver: "", thread: "M", shape: "boss",
      intro: "On the roof: a blank figure in a gown. It does not attack. It erases. Keep the coil lit. Then it offers you a letter.",
      need: { done: ["m114"] }, music: { start: "face_null", turn: "quiet", end: "quiet" },
      fail: { text: "Caught by the parapet. Climb back.", resume: 1, wait: "now" },
      steps: [
        { t: "go", place: "senate", night: true, text: "Go up to the Senate roof", lines: [N("It is facing the dark campus as if admiring it.")] },
        { t: "boss", enemy: "entropy", n: 1, at: "senate", night: true, text: "Relight the roof lamps", lines: [N("It erases: the lamps, the edges of your screen, your friends' name tags, the objective text. Each time a friend calls your name from below, a piece comes back."), L("@roomie", "Hey! I can't see you but I know you're up there! Don't be stupid!"), L("@best", "Come down when you're done! We're not going anywhere!")] },
        { t: "look", place: "senate", secs: 8, night: true, text: "Stand at the coil. Do not chase it", lines: [N("Every hit you throw at it erases something of yours instead.")] },
        { t: "turn", turn: true, text: "Take the letter it holds out", lines: [N("It stops. It holds out a letter, with your name on it, in your own handwriting."), N("\"Stay. Keep the light. You need never leave. You need never fail. You need never say goodbye.\"")] },
        { t: "choice", prompt: "Answer it", text: "Answer it", options: [
          { label: "\"I've read how this ends.\" (Books)", set: "refused_books", lines: [L("me", "I've read how this ends. He told me.")] },
          { label: "\"I've got places to be.\" (Street)", set: "refused_street", lines: [L("me", "I've got places to be. So does everybody down there.")] },
          { label: "\"It isn't mine to keep.\" (Community)", set: "refused_community", lines: [L("me", "It isn't mine to keep. It's theirs.")] },
          { label: "\"I came here to finish.\" (Vibes or Department)", set: "refused_finish", lines: [L("me", "I didn't come here to stay. I came here to finish.")] }] },
        { t: "turn", text: "Tear the letter", lines: [N("It has no weight. The figure is still there. It cannot be beaten by you. It was never yours to beat.")] }],
      reward: { flags: ["refused"] },
      around: { radio: [], walker: [], phone: [] } },

    { id: "m116", ch: 28, sem: 2, title: "The Maker's graduation", gate: 129, giver: "maker", thread: "M", shape: "escort",
      intro: "The ring needs one more thing closed: the first keeper has to let go of the first coil. He takes off the lab coat and walks out of the garden. Then the school dances till the birds start.",
      need: { done: ["m115"] }, music: { start: "quiet", turn: "motif_light", end: "motif_school" },
      steps: [
        { t: "phone", npc: "maker", incoming: true, text: "Answer the Maker's call", lines: [L("maker", "It won't close while I'm holding the first one. I understand it now. It's arithmetic."), L("maker", "Come and walk with me. I've forgotten the way to the Senate.")] },
        { t: "go", place: "enggarden", text: "Go to the Engineering Garden", lines: [N("He hangs the lab coat on the fence. He opens the gate. He has to try twice.")] },
        { t: "escort", npc: "maker", place: "senate", music: "quiet", text: "Walk the Maker to the Senate", lines: [N("The walk from your first day. No music. Footsteps. He looks at everything."), L("maker", "That fountain is new. …It's thirty years old? It's new to me."), L("asiya", "Uncle! You're outside! Wear a sweater!")] },
        { t: "look", place: "senate", secs: 8, turn: true, text: "Go up to the roof with him", lines: [N("He faces the figure in the gown. He takes the letter it once gave him out of his pocket, and gives it back."), L("maker", "I kept this for a long time. Thank you. I don't need it."), N("The missing note is played, once. The figure is simply not there.")] },
        { t: "look", place: "senate", secs: 6, text: "Look at the whole campus, lit", lines: [N("Six coils. Every lamp, every window, the fountain, the letters, the long road, the mall."), L("everyone", "UP NEPA!")] },
        { t: "go", place: "selfie", text: "Go to the Selfie Garden", lines: [N("Every station plays the School theme in its own style.")] },
        { t: "rhythm", pass: 60, text: "Dance in the Selfie Garden till the birds", lines: [L("radio:kabiru", "The sun is coming up, every lamp is on, and I have nothing clever to say. Well done.")] },
        { t: "emote", emote: "sit", at: "facgarden", text: "Sit with the Maker in the Faculty Garden", lines: [N("He sits on a bench outside the fence. From here on he follows his own day.")] }],
      reward: { cash: 100000, standing: ALL5, flags: ["ring_closed", "maker_free", "permanent_light", "maker_sayings"] },
      around: { radio: [["radio:bugaje", "A thing is finished when it no longer needs you."]], walker: [], phone: [["mum", "We heard on the radio. Is that your school? Is that YOU? Have you eaten?"]] } },

    { id: "m117", ch: 28, sem: 2, title: "Gown", gate: 130, giver: "needle", thread: "R", shape: "collect",
      intro: "A name on a board, a gown from the mall, and five photographs in five places with whoever mattered most there.",
      need: { done: ["m116"] }, music: { start: "motif_school", turn: "motif_heart", end: "motif_school" },
      steps: [
        { t: "go", place: "@dept", text: "Find your name on the results board", lines: [N("Your class comes from five years of Books."), L("khadija", "This is what you earned. Not a mark more, not a mark less. I'm proud of it.")] },
        { t: "talk", npc: "needle", text: "Collect your gown from Alhaji Needle", give: "gown", lines: [L("needle", "Gowns. I sew them at cost. Don't tell people; they'll think I've gone soft."), L("needle", "It's ready. Today. Don't look at me like that.")] },
        { t: "go", place: "selfie", text: "Take a photograph in the Selfie Garden", lines: [L("fatima", "Actually, I've never been in a photograph on purpose. Stand closer.")] },
        { t: "go", place: "checkpoint", text: "Take a photograph at the dark bend" },
        { t: "go", place: "dam", text: "Take a photograph on the pier" },
        { t: "go", place: "court", text: "Take a photograph at the court", lines: [L("bola", "Jump! I said jump, not hop! Again!")] },
        { t: "go", place: "@hostel", text: "Take a photograph in your first-year room" },
        { t: "talk", npc: "@best", turn: true, text: "Talk about after", lines: [L("@best", "We're going to be those people who call once a year and talk for six hours.")] },
        { t: "look", place: "@hostel", secs: 4, text: "Look through the album", give: "album", lines: [N("The five photographs are saved to the phone.")] }],
      reward: { flags: ["album", "degree"] },
      around: { radio: [["kabiru", "Photographers have outnumbered students. If you see grass, someone is posing on it."]], walker: [], phone: [["sibling", "Wear the cap straight. Mum says. I say tilt it."]] } },

    { id: "m118", ch: 28, sem: 2, title: "Convocation", gate: 130, giver: "garba", thread: "F", shape: "escort",
      intro: "The voices on the phone arrive in person. Show them round. Then the forecourt, your name, and in the row ahead a man with coily hair in a gown that fits.",
      need: { done: ["m117"] }, music: { start: "motif_home", end: "motif_school" },
      steps: [
        { t: "talk", npc: "mum", text: "Meet your family at the Main Gate", lines: [N("A hired bus. Your mother gets down first with a cooler."), L("mum", "Look at you. You're thin. Who has been feeding you? I want to thank them and blame them."), L("dad", "So this is the gate. Hm. It's a good gate.")] },
        { t: "escort", npc: "mum", place: "@hostel", text: "Show your family your hostel", lines: [L("mum", "So you are the one. I've brought food for the whole floor. Sit.")] },
        { t: "escort", npc: "mum", place: "@dept", text: "Show your family your department", lines: [L("dad", "I hear my child signs for your tools. …And returns them? Good.")] },
        { t: "escort", npc: "mum", place: "buka", text: "Take your family to Mama Nkechi's buka", lines: [L("nkechi", "Madam! This is my child too. We'll share.")] },
        { t: "go", place: "senate", text: "Take your seat at the Senate forecourt", lines: [N("Canopies. Malam Garba hands you a seat ticket he has kept dry in his cap."), L("garba", "Five years ago I gave you a file. Today I give you a chair. Sit in it properly.")] },
        { t: "look", npc: "maker", secs: 5, turn: true, text: "Look at the row ahead", lines: [N("A lab coat is not a gown, and he is not wearing the lab coat."), L("maker", "I recommend about five years. I took the scenic route.")] },
        { t: "walk", place: "senate", npc: "@best", text: "Walk when your name is read", lines: [N("Your name is read. The crew is louder than the band."), L("lily", "THAT'S OUR FRIEND!"), L("lyzzy", "WE KNEW THEM FIRST!")] },
        { t: "look", place: "senate", secs: 5, text: "Stand for the last name", lines: [N("The Maker's name is read last. It is read as \"The Maker\". Everybody stands.")] }],
      reward: { standing: { community: 5 }, flags: ["convocated"] },
      around: { radio: [["radio:highlife", "From the Senate porter's lodge, with pride, to every name read today."]], walker: ["Which one is the Tesla child? I want mine to greet them."], phone: [] } },

    { id: "m119", ch: 28, sem: 2, title: "Sign-out", gate: 130, giver: "@best", thread: "F", shape: "choice",
      intro: "A white shirt and a box of markers. What each friend writes depends on five years of what you did. Then your bed space, your bicycle and your notes need an heir.",
      need: { done: ["m118"] }, music: { start: "motif_crew", end: "motif_home" },
      steps: [
        { t: "talk", npc: "asiya", text: "Get a sign-out shirt at the MIB Store", give: "signout_shirt", lines: [L("asiya", "Sign-out whites. I told you I'd give you this one free. I don't forget.")] },
        { t: "social", place: "selfie", secs: 15, text: "Stand still in the Selfie Garden while they sign", lines: [N("They write."),
          L("@roomie", "\"Kept my garri. Half.\""), L("ada", "\"Three things: brains, heart, lateness.\""), L("bola", "\"Told me to go for it.\""),
          L("fatima", "\"Actually, the best of us.\""), L("sly", "\"You get mind. — Sly.\""), L("lucky", "\"Unfollow me. Call me instead.\""),
          L("maker", "\"Energy in. Light out. Thank you.\"")] },
        { t: "talk", npc: "oldfresher", turn: true, text: "Let a fresher sign your shirt", lines: [N("A stranger in first-year clothes asks to sign."), L("oldfresher", "You walked me to the Senate. In my first week. You won't remember.")] },
        { t: "talk", npc: "porter", text: "Go back to your room. Baba Porter has the list", lines: [N("The empty room. Baba Porter with the list."), L("porter", "Bed space no dey. …There is one. Yours. Who gets it?")] },
        { t: "choice", prompt: "Who gets your bed space?", text: "Choose your heir", options: [
          { label: "Aminu (he is at the gate with a bag)", set: "heir_aminu" },
          { label: "Aisha (she inherits your notes)", set: "heir_aisha" },
          { label: "Whoever has nowhere", set: "heir_nowhere" }] },
        { t: "choice", prompt: "What do you leave them?", text: "Choose your heirloom", options: [
          { label: "Your bicycle", set: "heirloom_bicycle" },
          { label: "Your notes", set: "heirloom_notes" },
          { label: "Mr. Ezekiel's soldering iron", set: "heirloom_iron", take: "soldering_iron" }] }],
      reward: { flags: ["signed_out", "ngplus_ready"] },
      around: { radio: [["kabiru", "To the graduating set. Go well. I'm not crying. It's harmattan."]], walker: [], phone: [["kelechi", "Did they leave a gap for me on the shirt? …Good. Write \"Look properly.\""]] } },

    { id: "m120", ch: 28, sem: 2, title: "Fresher", gate: 130, giver: "muhammad", thread: "F", shape: "routine",
      intro: "One last ride round all of it, with the credits rolling past lamps you put up. Then, some years later, a new student at the gate asks you the way to the Senate.",
      need: { done: ["m119"] }, music: { start: "motif_school", turn: "motif_school", end: "motif_school" },
      steps: [
        { t: "ride", text: "Ride", lines: [N("The whole map. Names roll at the roadside like signboards. People wave from where you first met them.")] },
        { t: "go", place: "gate", text: "Ride round the campus one last time", lines: [L("emeka", "My guy! Come back and visit! I'll be here! I own four kekes!"), L("lawal", "Go where you like. …Not too far. Old habits."), L("kaka", "You listened to the end. Take groundnut. For the road."), N("You ride out through the arch. Fade.")] },
        { t: "turn", turn: true, text: "Walk in through the gate", lines: [N("Some years later."), N("Morning. You are on foot, in ordinary clothes, coming in through the gate. The suya man is back. The lamps are on though it is day; someone forgot."), N("An old man is feeding birds at the fountain. He waves.")] },
        { t: "talk", npc: "muhammad", text: "Talk to the new student at the gate", lines: [N("A boy with a bag too big for him and a map upside down."), L("muhammad", "Excuse me. Sorry. Please, do you know where the Senate is?"), L("muhammad", "I'm new. I don't know anybody. Is it true they take light here?")] },
        { t: "escort", npc: "muhammad", place: "senate", text: "Walk him to the Senate", lines: [L("me", "Not any more. Come. It's the tall orange building. I'll show you.")] },
        { t: "turn", text: "Say goodbye at the Senate door", lines: [L("me", "Welcome, fresher."), N("{{GAME_NAME|upper}}"), N("A game by Muhammad Iliyasu Bugaje")] }],
      reward: { flags: ["story_done"] },
      around: { radio: [["radio:successor", "One last link, from Kabiru's successor: a voice you know."]], walker: [], phone: [] } }
  ];

  // Stable voice ids, in file order within each mission: steps' lines, then option lines, then "around".
  M.forEach(function (m) {
    var k = 0, num = m.id.slice(1);
    function tag(l) { if (l && l[0] !== "" && !l[2]) l[2] = "Y5-m" + num + "-" + (++k < 10 ? "0" + k : "" + k); }
    m.year = 5;
    m.steps.forEach(function (s) { (s.lines || []).forEach(tag); (s.options || []).forEach(function (o) { (o.lines || []).forEach(tag); }); });
    var a = m.around || {};
    (a.radio || []).forEach(tag); (a.phone || []).forEach(tag);
    a.walkerV = (a.walker || []).map(function (w) { var l = ["walker", w]; tag(l); return l[2]; }); // walker lines stay plain strings
  });

  D.STORY.push({ file: "y5", year: 5, npcs: NPCS, items: ITEMS, missions: M, side: [], ambient: [], coop: [] });
})();
