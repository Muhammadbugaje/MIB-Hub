/* Freshers School Life — Year 2 story (m37–m57). Source: docs/story/scripts/Y2.md
   Data only; the engine is samaru-story.js (contract: docs/story/ENGINE.md).

   Changes from the script, and why (everything else is as written):
   - Places: the map has no "mall roof café", "mall office", "basement" or "plant room", so those scenes use
     mk_food (roof café) and market (office, basement, plant room). Shops: Game Room = mk_arcade, Glow Up Salon /
     Sly's Cuts = mk_barber, Hajiya Ladi's Provisions = mk_supermarket, Bright Electricals = mk_electronics.
     The "darkest bend" on the Phase 2 road is the checkpoint.
   - Standings: the script's Vibes → social, Books → academics (the engine's track names).
   - XP is left to the engine (it computes XP from the gate). Extra rewards the engine cannot pay (arcade
     tokens, free haircuts, the secret radio station, the outfit item, promotion to 300 level, "all standings
     +2") are written as flags so later content can honour them; see ENGINE_ISSUES.md "Y2 needs".
   - m40, m47, m50: lines that depend on how a mini-game or exam went ("you won" / "you lost") need a result
     flag the engine does not set; the step plays the winning line and the other is listed in ENGINE_ISSUES.md.
   - m41 "Hummers" and m55 Hummers use the `shade` enemy (no hummer enemy exists). Iron Mama "cannot be hit
     down": her four plugs are four `find` steps in the marker order, which is the script's mechanic.
   - m41 "sleep interrupted": a night `go` to your hostel (a real sleep would skip to morning).
   - m42 the van: tailing Engr. Aliyu himself (the tail step follows a person; he is driving).
   - m45 four loads / two loads of passengers: `job` taxi with n 4 and n 2.
   - m46 "shove them off or talk them down" and "nod": a choice, then `watch` at the chair for 20 s.
   - m48 six rings: the circuit is flown over strip → lowerdam → dam → strip; photo passes are a low flight
     over the market, twice; landing is a flight back to the strip.
   - m52 loading up: `collect` 3 supplies at the market (shop stock is not guaranteed for story items).
   - m54 the ₦340 balance is narration (the engine cannot set your money); @crush vs @best uses the m43
     dinner choice flags. Buying garri, groundnut and a candle uses new items.
   - m56 the 90-second switching run: three `go` steps with `limit: 90` (race only takes r1–r8). The
     sponsorship-form answer has only one honest answer per path (own up if signed, explain if refused), so it
     is a story beat (`turn` with `if`), not a one-option choice.
*/
(function () {
  "use strict";
  var root = typeof self !== "undefined" ? self : this, D = root.SamaruData;
  if (!D) return;
  D.STORY = D.STORY || [];

  // Stable voice ids, numbered in reading order within each mission: Y2-m37-01, Y2-m37-02, …
  var cur = "", n = 0;
  function mid(id) { cur = id; n = 0; return id; }
  function v() { n++; return "Y2-" + cur + "-" + (n < 10 ? "0" : "") + n; }
  function L(who, text) { return [who, text, v()]; }
  function N(text) { return ["", text, ""]; } // narration: shown, not voiced

  var items = {
    slip: { name: "Allocation slip", price: 0, text: "Proof that the bed is yours." },
    crate: { name: "Hajiya Ladi's crate", price: 0, text: "Yams. Or books. Probably yams." },
    fabric: { name: "Three yards of fabric", price: 3500, text: "For Alhaji Needle. Ready Thursday. Which Thursday?" },
    cap: { name: "Cap", price: 1500, text: "To go with the native." },
    kerb_plate: { name: "Warm kerb plate", price: 0, text: "Steel, in the kerb by the gate. It hums." },
    cable_marker: { name: "Cable marker 2", price: 0, text: "A fat cable, an arrow and the number 2." },
    dinner_ticket: { name: "Department dinner ticket", price: 2500, text: "Corporate or native. Jeans will be turned back with love." },
    plaque2: { name: "Second plaque (rubbing)", price: 0, text: "\"2.\" Bolted to the old market wall." },
    contract_file: { name: "Power contract cover sheet", price: 0, text: "Supplier: Works Dept. (Engr. A.). Rate: almost nothing." },
    supplies: { name: "Relief supplies", price: 0, text: "Water, torches and charged power banks for Phase 2." },
    marker_1: { name: "Cable marker 1", price: 0, text: "By the substation." },
    marker_3: { name: "Cable marker 3", price: 0, text: "By the road." },
    copper: { name: "Fine copper wire", price: 2500, text: "From Bright Electricals." },
    garri: { name: "Garri (one cup)", price: 150, text: "Soak it well. Let it swell." },
    groundnut: { name: "Groundnut", price: 100, text: "Garri's best friend." },
    candle: { name: "Candle", price: 90, text: "For when NEPA takes it." },
    basement_key: { name: "Basement key", price: 0, text: "Sgt. Bilkisu's. She does not hand keys to students." },
    plug1: { name: "Plug 1 pulled", price: 0, text: "Feeder one." },
    plug2: { name: "Plug 2 pulled", price: 0, text: "Feeder two." },
    plug3: { name: "Plug 3 pulled", price: 0, text: "Feeder three." },
    plug_mains: { name: "Mains pulled", price: 0, text: "The last one." },
    markers: { name: "Sign-out markers", price: 800, text: "For writing on white shirts." },
    signout_shirt: { name: "Sign-out white shirt", price: 0, text: "Aunty Asiya's one free thing." }
  };

  var npcs = [
    { id: "porter", name: "Baba Porter", role: "Hostel porter (Mr. Okon)", at: "@hostel", skin: "#6b4226", hair: "low", top: "#64748b", voice: "male", pitch: .85, hi: ["Bed space no dey. …Come.", "Sign the book.", "Who is squatting?"] },
    { id: "needle", name: "Alhaji Needle", role: "Tailor, Needle & Thread", at: "mk_native", skin: "#85532f", hair: "cap", hairCol: "#f5f5f4", top: "#f5f5f4", voice: "male", pitch: .9, hi: ["Come back Thursday.", "Stand straight.", "Measured twice."] },
    { id: "asiya", name: "Aunty Asiya", role: "Manager, MIB Store", at: "mibstore", skin: "#c48f65", hair: "hijab", hairCol: "#ffffff", top: "#d4af37", voice: "female", pitch: 1.05, hi: ["Original. No be mall quality.", "Welcome to MIB.", "No sale. Ever."] },
    { id: "mubarak", name: "Mubarak", role: "Assistant, MIB Store", at: "mibstore", skin: "#a06a42", hair: "fade", top: "#ffffff", voice: "male", pitch: 1.1, hi: ["I'm just informing you.", "That one is limited.", "Prices are prices."] },
    { id: "maryam", name: "Maryam", role: "Page Turner Books", at: "mk_books", skin: "#85532f", hair: "hijab", hairCol: "#7c3aed", top: "#a78bfa", voice: "female", pitch: 1.05, romance: "m", hi: ["Have you read this one?", "Careful with the spines.", "Books are not yams."] },
    { id: "lily", name: "Lily", role: "Course mate (a twin)", at: "@dept", skin: "#a06a42", hair: "braids", top: "#f472b6", voice: "female", pitch: 1.2, hi: ["We heard…", "We saw it first.", "Tell people."] },
    { id: "lyzzy", name: "Lyzzy", role: "Course mate (the twin with glasses)", at: "@dept", skin: "#a06a42", hair: "braids", top: "#fb7185", glasses: true, voice: "female", pitch: 1.18, hi: ["…first.", "We have notes.", "Officially."] },
    { id: "basit", name: "Basit", role: "Game Room champion", at: "mk_arcade", skin: "#85532f", hair: "low", top: "#22c55e", voice: "male", pitch: 1.05, romance: "f", hi: ["Rematch.", "Best of three.", "Number one on all five."] },
    { id: "khadija", name: "Dr. Khadija", role: "Level adviser (Dr. Khadija Mahmud)", at: "@dept", skin: "#85532f", hair: "hijab", hairCol: "#1e3a8a", top: "#1e40af", voice: "female", pitch: .95, hi: ["Rules are rules.", "Sit. Tell me.", "Do it again."] },
    { id: "ahmad", name: "Ahmad", role: "Rival quiz captain", at: "kt", skin: "#a06a42", hair: "low", top: "#0ea5e9", voice: "male", pitch: 1, hi: ["May the best department win.", "Good luck. You'll need it.", "Rematch? No."] },
    { id: "jega", name: "Jega", role: "Football captain", at: "court", skin: "#6b4226", hair: "low", top: "#16a34a", voice: "male", pitch: .9, hi: ["We go again.", "Lucky socks.", "Pass to feet."] },
    { id: "aliyu", name: "Engr. Aliyu", role: "Works and Maintenance", at: "quarters", skin: "#6b4226", hair: "low", top: "#1d4ed8", voice: "male", pitch: .85, hi: ["I only switched it over.", "Works Department.", "Not now."] },
    { id: "peter", name: "Corporal Peter", role: "Campus guard", at: "gate", skin: "#4f301c", hair: "cap", hairCol: "#334155", top: "#334155", voice: "male", pitch: .95, hi: ["I'm not sleeping, I'm observing.", "Suya?", "Move along. Slowly."] },
    { id: "bilkisu", name: "Sgt. Bilkisu", role: "Head of campus security", at: "gate", skin: "#85532f", hair: "hijab", hairCol: "#0f172a", top: "#334155", voice: "female", pitch: .95, hi: ["First warning.", "I said walk.", "Nobody hurt on my shift."] },
    { id: "megawatt", name: "Chief Megawatt", role: "Mall developer (Chief Sunday Obaro)", at: "market", skin: "#6b4226", hair: "cap", hairCol: "#b45309", top: "#b45309", voice: "male", pitch: .8, hi: ["My dear, think big.", "Zobo? Malt?", "I like students."] },
    { id: "registrar", name: "Mrs. Adebayo", role: "Registry officer", at: "senate", skin: "#85532f", hair: "bun", hairCol: "#7c2d12", top: "#9a3412", voice: "female", pitch: 1, hi: ["Where is your photocopy?", "Come back tomorrow.", "Triplicate."] },
    { id: "bursar", name: "Mr. Clement", role: "Bursary clerk", at: "bank", skin: "#6b4226", hair: "low", top: "#e2e8f0", voice: "male", pitch: .95, hi: ["Network.", "Receipt?", "System is down."] },
    { id: "linus", name: "Baba Shuttle", role: "Shuttle driver (Mr. Linus)", at: "p2park", skin: "#4f301c", hair: "cap", hairCol: "#ca8a04", top: "#ca8a04", voice: "male", pitch: .85, hi: ["Shift! Shift for your neighbour.", "Exact change.", "Phase 2, Phase 2!"] },
    { id: "risi", name: "Iya Risi", role: "Phase 2 canteen", at: "p2canteen", skin: "#6b4226", hair: "bun", hairCol: "#15803d", top: "#16a34a", voice: "female", pitch: 1.05, hi: ["Food don finish. …Wait.", "Come back before dark.", "Sit."] },
    { id: "muktar", name: "Muktar", role: "Dan Fodio hall chairman", at: "danfodio", skin: "#85532f", hair: "low", top: "#0f766e", voice: "male", pitch: 1, hi: ["Officially.", "The water rota is on the board.", "I am the chairman."] },
    { id: "hassan", name: "Hassan", role: "Big Sly's old boy", at: "court", skin: "#6b4226", hair: "fade", top: "#f97316", voice: "male", pitch: 1.05, hi: ["Oga Sly!", "We're only playing.", "Barber!"] },
    { id: "abbas", name: "Abbas", role: "Big Sly's old boy", at: "court", skin: "#85532f", hair: "low", top: "#facc15", voice: "male", pitch: 1.1, hi: ["Is that a real clipper?", "Hassan, wait.", "We're only playing."] },
    { id: "abdul", name: "Abdul", role: "Flying Club cadet (\"AB\")", at: "strip", skin: "#a06a42", hair: "low", top: "#0284c7", voice: "male", pitch: 1, romance: "f", hi: ["Check.", "Copy that.", "Checklist first."] },
    { id: "clemantine", name: "Clemantine", role: "Gift Corner and Flowers", at: "mk_gifts", skin: "#d6a67c", hair: "bun", hairCol: "#3f2a1d", top: "#fda4af", voice: "female", pitch: 1.1, hi: ["Bonjour, chéri.", "Take a rose for luck.", "The roses listen."] }
  ];

  var M = [];

  /* m37 — Stalite */
  M.push({ id: mid("m37"), ch: 13, year: 2, sem: 1, gate: 31, title: "Stalite", giver: "@roomie", thread: "F", shape: "social",
    intro: "You come back from the break and somebody else's name is on your bed. Sort it out with Baba Porter before dark, and find out what \"stalite\" means.",
    need: { done: ["m36"] },
    music: { start: "motif_school", turn: "place_hostel_sunset", end: "sting_friend" },
    steps: [
      { t: "go", place: "@hostel", text: "Go back to your room", lines: [
        N("The door is open. A stranger's bucket is on your bed."),
        L("@roomie", "You're back! Don't shout. There is a small situation."),
        L("@roomie", "The list says this bed belongs to \"Musa B.\" You are not Musa B.")] },
      { t: "talk", npc: "porter", text: "Ask Baba Porter about the list", lines: [
        L("porter", "Bed space no dey. I told all of you: come early."),
        L("porter", "Bring your allocation slip from the Senate. Then we talk.")] },
      { t: "talk", npc: "garba", text: "Get your allocation slip at the Senate", give: "slip", lines: [
        L("garba", "Ah. Fresher no more. You have grown small."),
        L("garba", "Second years are \"stalites\". Returning light. Here. Your slip.")] },
      { t: "talk", npc: "porter", turn: true, take: "slip", text: "Show Baba Porter the slip", lines: [
        N("Musa B. is sitting on the steps with his bag, a first-year, close to tears."),
        L("porter", "The slip is correct. So this boy has nowhere. Hm.")] },
      { t: "choice", prompt: "Decide what happens to Musa", text: "Decide what happens to Musa", options: [
        { label: "He can squat with us till he is sorted", set: "musa_squat", standing: { community: 4 } },
        { label: "Baba Porter, you have a spare mattress", set: "porter_mattress", standing: { street: 2 } }] },
      { t: "sleep", place: "@hostel", text: "Sleep in your own bed", lines: [
        L("@roomie", "Welcome back. I kept your garri. Half of it. I kept half.")] }],
    fail: { text: "Not back by midnight: you sleep on a bench and wake stiff.", resume: 3, wait: "morning", cost: { energy: 10 } },
    reward: { cash: 2000, friend: { "@roomie": 5 }, flags: ["year2"] },
    around: {
      radio: [L("kabiru", "Welcome back, stalites. Freshers, the tall orange building is the Senate.")],
      walker: ["Second year. I'm practically a lecturer."],
      phone: [L("mum", "Have you reached? Have you eaten? Who is that boy in the background?")] } });

  /* m38 — Grand opening */
  M.push({ id: mid("m38"), ch: 13, year: 2, sem: 1, gate: 32, title: "Grand opening", giver: "ladi", thread: "W", shape: "delivery",
    intro: "The market is now a mall. Hajiya Ladi's goods are at the gate, her new shop is upstairs, and the only escalator goes up.",
    need: { done: ["m37"] },
    music: { start: "motif_market", turn: "sting_reveal", end: "place_mall_afternoon" },
    steps: [
      { t: "talk", npc: "ladi", text: "Meet Hajiya Ladi", lines: [
        L("ladi", "My customer! You see what they have done to my market?"),
        L("ladi", "Carry these. Shop fourteen. No, one. They changed the numbers.")] },
      { t: "carry", item: "crate", place: "mk_supermarket", n: 3, text: "Carry three loads to Hajiya Ladi's shop", lines: [
        N("You pass Needle & Thread, Chi-Tech, Page Turner, Kanti Sports, the Game Room."),
        L("needle", "You! You have shoulders. Come back, I will measure you."),
        L("maryam", "Careful. Those are books, not yams. Oh. They are yams.")] },
      { t: "turn", text: "The escalator stops", lines: [
        N("The escalator stops with you on it. The lights do not even flicker."),
        L("ladi", "They say this place never loses light. Never. I don't trust \"never\".")] },
      { t: "carry", item: "crate", place: "mk_food", text: "Take the last crate up to the roof café" },
      { t: "talk", npc: "ladi", text: "Collect your pay from Hajiya Ladi", lines: [
        L("ladi", "Last price for you, always. Today that price is thank you."),
        L("ladi", "Joke. Take. And greet your mother.")] }],
    fail: { text: "You dropped a crate. Pick it up. Hajiya deducts ₦100, loudly.", resume: 1, wait: "now", cost: { money: 100 } },
    reward: { cash: 3000, standing: { street: 2 }, flags: ["mall_open", "plant_never_loses_light"] },
    around: {
      radio: [L("kabiru", "Fifteen shops, two floors, one escalator that only goes up.")],
      walker: ["I came to buy pepper and I'm leaving with a phone case.", "Where is the suya man? What have they done with the suya man?"] } });

  /* m39 — New drip */
  M.push({ id: mid("m39"), ch: 13, year: 2, sem: 1, gate: 33, title: "New drip", giver: "needle", thread: "W", shape: "collect",
    intro: "Alhaji Needle will sew your first native. It will be ready Thursday. Meanwhile Aunty Asiya at the MIB Store thinks mall clothes are for people who have not seen better.",
    need: { done: ["m38"] },
    music: { start: "place_mall_afternoon", turn: "sting_step", end: "sting_step" },
    steps: [
      { t: "talk", npc: "needle", text: "Get measured at Needle & Thread", lines: [
        L("needle", "Stand straight. Not like a question mark. Good."),
        L("needle", "Bring three yards and a cap. Come back Thursday.")] },
      { t: "buy", item: "fabric", text: "Buy three yards of fabric at Zaria Drip" },
      { t: "buy", item: "cap", text: "Buy a cap at Kanti Sports" },
      { t: "go", place: "mibstore", text: "Aunty Asiya waves you into the MIB Store", lines: [
        L("asiya", "Mall quality. Hm. Feel this one. Original. Made in Bugaje."),
        L("mubarak", "That jacket is the price of a bicycle. I'm just informing you.")] },
      { t: "talk", npc: "needle", turn: true, take: "fabric", text: "It is Thursday. Collect your native", lines: [
        L("needle", "I said Thursday. I did not say which.")] },
      { t: "emote", emote: "wave", at: "selfie", text: "Next Thursday: wear it in the Selfie Garden", lines: [
        L("lily", "New cloth!"),
        L("lyzzy", "We saw it first. Tell people we saw it first.")] }],
    fail: { text: "Not enough money: Needle keeps the fabric \"on trust\" and the mission waits.", resume: 1, wait: "now" },
    reward: { standing: { social: 3 }, flags: ["first_outfit", "outfit_first_native"] },
    around: {
      radio: [L("advert", "Needle & Thread. Measured twice. Ready Thursday.")],
      walker: ["Is that new? It's new. Turn round."],
      phone: [L("@roomie", "You bought cloth? In week one? We will eat garri by week two.")] } });

  /* m40 — Level two, round one */
  M.push({ id: mid("m40"), ch: 13, year: 2, sem: 1, gate: 34, title: "Level two, round one", giver: "basit", thread: "W", shape: "arcade",
    intro: "Basit holds every high score in the Game Room. He lets you pick the machine. A day off.",
    need: { done: ["m39"] },
    music: { start: "radio_off", turn: "arcade_chiptune", end: "sting_pass" },
    steps: [
      { t: "go", place: "mk_arcade", text: "Find the Game Room", lines: [
        L("basit", "New face. You play? Everybody says they play."),
        L("basit", "Pick a machine. Any. I'm number one on all five.")] },
      { t: "arcade", game: "kola", pass: 1500, text: "Beat the target score on a machine" },
      { t: "turn", text: "Basit puts in a coin", lines: [
        N("You pass the target. Basit puts in a coin without a word."),
        L("basit", "Best of three.")] },
      { t: "arcade", game: "kola", pass: 1, n: 2, text: "Play two more rounds against Basit's ghost" },
      { t: "talk", npc: "basit", text: "Win or lose, talk to Basit after", lines: [
        L("basit", "Rematch. Tomorrow. Bring water.")], linesLost: [
        L("basit", "Close. Not close. But you looked close.")] }],
    fail: { text: "Losing is a valid ending; Basit respects that you stayed for all three.", resume: 3, wait: "now" },
    reward: { cash: 1500, standing: { social: 2 }, friend: { basit: 5 }, flags: ["met_basit", "arcade_open", "station_8bit_buka"] },
    around: {
      walker: ["He has not left that machine since the mall opened.", "My brother beat him once. He was six. Basit did not speak for a week."] } });

  /* m41 — The mall never blinks */
  M.push({ id: mid("m41"), ch: 13, year: 2, sem: 1, gate: 35, title: "The mall never blinks", giver: "audu", thread: "M", shape: "investigation",
    intro: "The whole campus goes dark at once. Across the road the mall is glowing like a ship.",
    need: { done: ["m40"] },
    music: { start: "sting_dark", turn: "motif_dark", end: "face_ironmama" },
    steps: [
      { t: "go", place: "@hostel", night: true, text: "Read in your room until the light goes", lines: [
        N("The light goes while you are reading."),
        L("@roomie", "They have taken it. I was ironing. One sleeve.")] },
      { t: "go", place: "gate", night: true, text: "Go to the gate: why is the sky bright?", lines: [
        N("From the gate: every campus lamp dead, every mall window lit.")] },
      { t: "fight", enemy: "shade", n: 3, at: "gate", night: true, text: "Clear the rattling things by the gate kerb", lines: [
        N("A new kind of shade, with a metal chest, charging in straight lines. People will call them Hummers.")] },
      { t: "talk", npc: "audu", text: "Ask Mai Shayi what he has seen", lines: [
        L("audu", "Tea first. Then talk."),
        L("audu", "Before the mall: light went and came like a tired man."),
        L("audu", "Now it goes at the same minute every night. Somebody is keeping time.")] },
      { t: "find", item: "kerb_plate", at: "gate", turn: true, text: "Look where the Hummers stood at the Main Gate", lines: [
        N("A steel plate in the kerb, warm, humming."),
        L("me", "It's the same hum. From the garden.")] }],
    fail: { text: "Knocked out: you come round at the tea stall with Audu fanning you.", resume: 2, wait: "now" },
    reward: { cash: 2500, standing: { community: 2 }, flags: ["mall_bright", "hummers_seen"] },
    around: {
      radio: [L("kabiru", "If your bulb just died, you're locked in to the only station still talking.")],
      walker: ["The mall has light. The mall always has light."],
      phone: [L("mum", "Is there light there? There's none here. Have you eaten?")] } });

  /* m42 — Meter reader */
  M.push({ id: mid("m42"), ch: 14, year: 2, sem: 1, gate: 36, title: "Meter reader", giver: "audu", thread: "M", shape: "tail",
    intro: "Every evening, just before the campus goes dark, a Works van leaves the substation and drives to the mall. Follow it without being seen.",
    need: { done: ["m41"], flags: ["mall_bright"] },
    music: { start: "tension_low", turn: "sting_reveal", end: "radio_off" },
    steps: [
      { t: "talk", npc: "audu", text: "Hear what Mai Shayi has counted", lines: [
        L("audu", "Six evenings. Same white van. It leaves the fire station side, then light goes."),
        L("audu", "I sell tea. I don't follow vans. You have legs.")] },
      { t: "watch", place: "fire", secs: 6, text: "Wait near the substation until the van moves", lines: [
        L("aliyu", "Yes. Yes, I'm coming. I said I'm coming.")] },
      { t: "tail", npc: "aliyu", place: "gate", near: 25, far: 60, veh: "car", text: "Follow the van, 25–60 m back. No horn", music: "tension_low", lines: [
        N("Streetlamps behind it go out one by one as it passes.")] },
      { t: "turn", text: "At the gate the driver lifts the kerb plate", lines: [
        N("At the gate the driver lifts the kerb plate, throws a switch, and drives on."),
        L("peter", "I'm not sleeping. I'm observing.")] },
      { t: "tail", npc: "aliyu", place: "market", near: 25, far: 60, veh: "car", text: "Follow him to the door marked PLANT ROOM", music: "tension_mid" },
      { t: "find", item: "cable_marker", at: "gate", text: "Look under the kerb plate at the Main Gate", lines: [
        N("A fat cable, an arrow, a number: 2."),
        L("me", "Two. Two of what?")] },
      { t: "talk", npc: "audu", text: "Report to Mai Shayi", lines: [
        L("audu", "Somebody is not stealing light. Somebody is posting it.")] }],
    fail: { text: "He's seen you. He loops the fountain and parks. Try again at dusk.", resume: 1, wait: "dusk" },
    reward: { cash: 4000, standing: { street: 3, community: 1 }, friend: { audu: 5 }, flags: ["saw_switch", "marker_2"] },
    around: {
      radio: [L("kabiru", "Shout-out to the mall. How do you people do it? No, seriously. How?")],
      walker: ["Light just went. I was in the middle of ironing."] } });

  /* m43 — Department week */
  M.push({ id: mid("m43"), ch: 14, year: 2, sem: 1, gate: 37, title: "Department week", giver: "@hod", thread: "D", shape: "quiz",
    intro: "Your first department week: a quiz against the department next door, a five-a-side, and a dinner with a dress code and a speech.",
    need: { done: ["m42"] },
    music: { start: "motif_work", turn: "race", end: "motif_heart" },
    steps: [
      { t: "talk", npc: "khadija", text: "Find Dr. Khadija (you are about to be volunteered)", lines: [
        L("khadija", "You. Quiz team. Don't look behind you; I mean you.")] },
      { t: "quiz", subject: "ee", n: 6, pass: 4, npc: "ahmad", text: "Win the quiz against Ahmad's team in KT", lines: [
        L("ahmad", "May the best department win. That is us. But good luck."),
        L("yakubu", "For the record, we are two points ahead. For the record.")] },
      { t: "sports", sport: "five-a-side", at: "court", text: "Play one half of five-a-side for Jega", lines: [
        L("jega", "We go again. Pass to feet. Not to the goat.")] },
      { t: "buy", item: "dinner_ticket", turn: true, text: "Buy a dinner ticket at the MIB Store", lines: [
        N("Tickets are sold only at the MIB Store, and the dress code is firm."),
        L("mubarak", "One ticket. Corporate or native. Jeans will be turned back with love.")] },
      { t: "go", place: "social", text: "Attend the department dinner at the Social Centre", take: "dinner_ticket", lines: [
        L("@hod", "I will be brief."),
        N("(She is not brief.)"),
        L("@roomie", "Is the rice coming before or after the speech? This is important.")] },
      { t: "choice", prompt: "Who do you sit with?", text: "Choose who to sit with at dinner", options: [
        { label: "Sit with your crush", set: "dinner_with_crush", partner: "@crush" },
        { label: "Sit with the crew", set: "dinner_with_crew", friend: { "@best": 3 } }] },
      { t: "emote", emote: "dance", at: "social", text: "Join the dance line" }],
    fail: { text: "No outfit? Mubarak lends you a tie \"on deposit\". The week goes on.", resume: 4, wait: "now" },
    reward: { cash: 5000, standing: { department: 6, social: 2 }, flags: ["deptweek_won"] },
    around: {
      radio: [L("kabiru", "May the best department win. And may the worst one at least bring food.")],
      walker: ["Their HOD spoke for forty minutes. The jollof had gone cold with respect."] } });

  /* m44 — Iron Mama hums */
  M.push({ id: mid("m44"), ch: 14, year: 2, sem: 1, gate: 38, title: "Iron Mama hums", giver: "maker", thread: "M", shape: "stealth",
    intro: "The Maker has listened to the ground for a year. He sends you where he cannot go: under the mall, after closing, to see what is making the hum.",
    need: { done: ["m43"], flags: ["marker_2"] },
    music: { start: "motif_light", turn: "face_ironmama", end: "radio_off" },
    steps: [
      { t: "talk", npc: "maker", text: "Tell The Maker about the cable", lines: [
        L("maker", "Two. Yes. There are six plaques. You have only been reading the first."),
        L("maker", "I cannot leave this fence. You can. Go and look. Only look.")] },
      { t: "stealth", place: "market", guards: 2, night: true, text: "Slip into the mall basement past the watchmen", music: "quiet", lines: [
        N("You slip in behind the cleaners' cart. Two watchmen and their radio."),
        L("crowd:watchman", "If the generator ever goes off, I'm going home. I'm not checking.")] },
      { t: "find", item: "plaque2", at: "market", turn: true, text: "Find what is behind the generator", lines: [
        N("The plant room. A generator the size of a room. Cables enter it like roots. Hummers sleep against it for warmth. On its casing, hand-painted: IRON MAMA."),
        N("Behind it, bolted to the old market wall: a plaque. \"2.\"")] },
      { t: "go", place: "enggarden", text: "Leave before the Hummers wake" },
      { t: "talk", npc: "maker", text: "Report to The Maker at dawn", lines: [
        L("maker", "She built the second one under the market. They built a mall on her."),
        L("maker", "Good. Now we know where. We do not yet know who.")] }],
    fail: { text: "Seen by a watchman: \"Shop opens at nine.\" You are escorted out politely. Try again tomorrow night.", resume: 1, wait: "tomorrow" },
    reward: { cash: 3500, standing: { academics: 1 }, flags: ["ironmama_seen", "plaque2"] },
    around: {
      radio: [L("bugaje", "Six were planned. Count what you can see.")],
      walker: ["You look like you didn't sleep. Was it reading or was it wahala?"] } });

  /* m45 — Shuttle strike */
  M.push({ id: mid("m45"), ch: 14, year: 2, sem: 1, gate: 39, title: "Shuttle strike", giver: "emeka", thread: "W", shape: "delivery",
    intro: "The shuttle drivers have parked over unpaid allowances. Phase 2 is four kilometres away and full of stranded students. Emeka lends you a keke and a price list.",
    need: { done: ["m44"] },
    music: { start: "motif_road", turn: "talk", end: "motif_road" },
    steps: [
      { t: "talk", npc: "emeka", text: "Take Emeka's keke (you are on a job)", lines: [
        L("emeka", "My guy! Shuttle no dey. Today, keke is king."),
        L("emeka", "₦150 per head. Don't cheat them. Don't let them cheat you.")] },
      { t: "job", kind: "taxi", n: 4, text: "Carry four loads of passengers to Phase 2", lines: [
        L("crowd:passenger", "Driver, shift! Shift for your neighbour!"),
        L("crowd:passenger", "I have a test at two. If I fail, it is this keke.")] },
      { t: "talk", npc: "linus", turn: true, text: "Talk to Baba Shuttle at the Phase 2 park", lines: [
        N("At the park, Baba Shuttle sits on his bus step, not driving."),
        L("linus", "Three months. They say \"next week\". I have a family that eats this week.")] },
      { t: "choice", prompt: "Baba Shuttle asks you to carry the drivers' letter to the Senate", text: "Carry the letter, or keep carrying students?", options: [
        { label: "Carry the drivers' letter to Malam Garba", set: "strike_letter", standing: { community: 4 } },
        { label: "Keep ferrying students", set: "strike_ferry", standing: { street: 3 }, money: 1500 }] },
      { t: "talk", npc: "garba", if: "strike_letter", text: "Give Malam Garba the drivers' letter" },
      { t: "job", kind: "taxi", n: 2, text: "Bring the last students home before dark", lines: [
        L("risi", "You brought my children back. Sit. Food don finish. …Wait.")] }],
    fail: { text: "You crashed with passengers. They get out and walk, muttering. Fare lost.", resume: 1, wait: "now" },
    reward: { cash: 2000, flags: ["p2_jobs_open", "plant_people_not_paid"] },
    around: {
      radio: [L("kabiru", "Phase 2, we are thinking of you. From here. Where it is near.")],
      walker: ["I walked it. I am a different person now."] } });

  /* m46 — Sly goes straight */
  M.push({ id: mid("m46"), ch: 14, year: 2, sem: 1, gate: 40, title: "Sly goes straight", giver: "sly", thread: "F", shape: "defend",
    intro: "Big Sly is opening a barber's chair in the mall. His old court boys think that is the funniest thing they have heard. Stand at the door.",
    need: { done: ["m45"] },
    music: { start: "fight_people", turn: "motif_crew", end: "sting_friend" },
    steps: [
      { t: "talk", npc: "sly", text: "Find Big Sly at his new chair in the mall", lines: [
        N("Sly is polishing a mirror for the fourth time."),
        L("sly", "Sly is nervous. Don't tell anybody Sly is nervous."),
        L("sly", "First customer comes at four. You stand there. Look serious.")] },
      { t: "defend", place: "mk_barber", enemy: "bully", secs: 60, text: "Stand at the door while Hassan and Abbas arrive", lines: [
        L("hassan", "Oga Sly! Barber! Cut my hair and my school fees!")] },
      { t: "choice", prompt: "Hassan and Abbas are still laughing", text: "Shove them off, or talk them down", options: [
        { label: "Shove them off", set: "sly_shoved", standing: { street: 1 } },
        { label: "Talk them down", set: "sly_talked", standing: { community: 1 }, lines: [L("abbas", "We're only playing. …Is that a real clipper?")] }] },
      { t: "turn", text: "The first customer walks in", lines: [
        N("The first customer walks in. It is Malam Garba."),
        L("garba", "Young man. Low cut. And take your time; a good thing is not rushed."),
        N("Sly's hands shake. You stand where he can see you.")] },
      { t: "watch", place: "mk_barber", secs: 20, text: "Stay till the haircut is done", lines: [
        L("garba", "Hm. Clean. I will tell the Registrar."),
        L("sly", "You get mind, standing there. Sly will not forget.")] }],
    fail: { text: "The boys got past you and knocked over a chair. Sly rights it. Stand firm.", resume: 1, wait: "now" },
    reward: { cash: 2000, standing: { community: 3 }, friend: { sly: 5 }, flags: ["sly_shop", "free_haircuts", "hassan_abbas_apprentices"] },
    around: {
      radio: [L("hostelfunk", "Caller says Big Sly is a barber now. Caller, are you well?")],
      walker: ["He did my hairline. I have never been so afraid and so satisfied."] } });

  /* m47 — Test week */
  M.push({ id: mid("m47"), ch: 15, year: 2, sem: 1, gate: 42, title: "Test week", giver: "khadija", thread: "D", shape: "quiz",
    intro: "Three tests in two days, Ada's night tutorial under the one working lamp, and then first-semester exams in NELT.",
    need: { done: ["m46"] },
    music: { start: "sting_test", turn: "sting_dark", end: "sting_result_good" },
    steps: [
      { t: "class", pass: 2, place: "kt", text: "Sit the first test in KT", lines: [
        L("okonkwo", "Pens down means pens down. I can hear a pen.")] },
      { t: "class", pass: 2, place: "wt", text: "Sit the second test in WT" },
      { t: "go", place: "facgarden", night: true, text: "Join Ada's evening tutorial in the Faculty Garden", lines: [
        N("The halls are locked at night, so this tutorial is outdoors."),
        L("ada", "Biko, focus. Three topics, one lamp, two hours.")] },
      { t: "turn", text: "The lamp dies", lines: [
        N("The lamp dies. Shades drift in from the hedges."),
        L("fatima", "Actually, I can't read in the dark. Nobody can. That is the point of dark.")] },
      { t: "defend", place: "facgarden", enemy: "shade", secs: 120, night: true, text: "Keep your torch on the notes for two minutes" },
      { t: "class", pass: 2, text: "Sit the third test on no sleep" },
      { t: "quiz", subject: "ee", n: 8, pass: 5, text: "Write the first-semester exam in NELT", lines: [
        N("The lights flicker once. Everyone looks up. Nobody stops writing.")] },
      { t: "talk", npc: "khadija", text: "Get your results from Dr. Khadija", lines: [
        L("khadija", "This is what I expect. Now do it again.")], linesLost: [
        L("khadija", "Sit. Tell me what happened. Then we fix it.")] }],
    fail: { text: "A failed paper becomes a carry-over. The story goes on.", resume: 7, wait: "now" },
    reward: { standing: { academics: 5 }, friend: { ada: 5, fatima: 3 }, flags: ["sem2_1_result"] },
    around: {
      walker: ["Three tests. Two days. One brain."],
      phone: [L("dad", "How was the paper? And the generator there, is it diesel or petrol?")] } });

  /* m48 — Flying lesson two */
  M.push({ id: mid("m48"), ch: 15, year: 2, sem: 2, gate: 44, title: "Flying lesson two", giver: "uche", thread: "M", shape: "flight",
    intro: "Captain Uche wants your turns tidier. You want a photograph of the mall roof. Both can happen in one flight.",
    need: { done: ["m47"] },
    music: { start: "place_airfield_morning", turn: "sting_reveal", end: "place_airfield_morning" },
    steps: [
      { t: "talk", npc: "uche", text: "Do the pre-flight checks with Captain Uche", lines: [
        L("uche", "Checklist. Aloud. I want to hear every item."),
        L("abdul", "She will make you do it twice. Check.")] },
      { t: "flight", route: ["strip", "lowerdam", "dam", "strip"], text: "Fly the practice circuit cleanly", lines: [
        L("uche", "Nicely done. Do it again.")] },
      { t: "flight", route: ["market", "gate", "market"], low: true, turn: true, set: "roof_photo", text: "Pass low over the mall roof twice for the photo", lines: [
        N("From above: one thick cable crosses the road from the campus fence to the roof, painted the same grey as the tarmac.")] },
      { t: "flight", route: ["strip"], text: "Land at the airfield without a bounce" },
      { t: "talk", npc: "uche", text: "Show Captain Uche the picture", lines: [
        L("uche", "That was not on my circuit."),
        L("uche", "…Show me the picture. Hm. Somebody painted that cable to hide it.")] }],
    fail: { text: "Missed the photo. Go round again.", resume: 2, wait: "now" },
    reward: { cash: 3000, standing: { street: 1 }, friend: { uche: 4, abdul: 3 }, flags: ["roof_photo"] },
    around: {
      radio: [L("kabiru", "Harmattan is here. Vaseline has become currency.")],
      walker: ["Somebody was flying very low today. Looking for what?"] } });

  /* m49 — Chief Megawatt */
  M.push({ id: mid("m49"), ch: 15, year: 2, sem: 2, gate: 45, title: "Chief Megawatt", giver: "megawatt", thread: "M", shape: "choice",
    intro: "The mall's owner invites you up. He would like to sponsor your department. He would also like to know why you fly over his roof.",
    need: { done: ["m48"], flags: ["roof_photo"] },
    music: { start: "talk", turn: "motif_market", end: "talk" },
    steps: [
      { t: "talk", npc: "megawatt", text: "Answer Chief Megawatt's invitation at the mall", lines: [
        L("megawatt", "My dear! Sit. Zobo? Malt? Think big, I always say."),
        L("megawatt", "I hear your department needs a projector. I like students. I was one, briefly.")] },
      { t: "choice", prompt: "He slides a sponsorship form across the desk", text: "Sign the sponsorship form?", options: [
        { label: "Sign it (a projector for the department)", set: "megawatt_signed", standing: { department: 5 } },
        { label: "Refuse, politely", set: "megawatt_refused", standing: { department: -1, community: 3 } }] },
      { t: "turn", text: "He asks about the aeroplane", lines: [
        L("megawatt", "My power is cheap because my engineer is clever. I don't ask how. Do you?")] },
      { t: "talk", npc: "garba", text: "Ask Malam Garba for the power contract", lines: [
        L("registrar", "Where is your photocopy? And your reason? \"Curiosity\" is not a reason."),
        L("garba", "Patience, my child. Some files are found by waiting near them.")] },
      { t: "find", item: "contract_file", at: "senate", set: "contract_seen", text: "Read the file's cover sheet while she fetches a stamp", lines: [
        N("Supplier: \"Works Dept. (Engr. A.)\". Rate: almost nothing.")] }],
    fail: { text: "Mrs. Adebayo caught you reading. \"You did not see that.\" (You did.)", resume: 4, wait: "now" },
    reward: { cash: 2000, flags: ["contract_seen"] },
    around: {
      radio: [L("advert", "Samaru Market Mall. We never close our eyes.")],
      walker: ["He gave our hall a water tank. With his face on it."] } });

  /* m50 — Bolaji's board */
  M.push({ id: mid("m50"), ch: 15, year: 2, sem: 2, gate: 46, title: "Bolaji's board", giver: "bola", thread: "F", shape: "rhythm",
    intro: "A skate contest in the mall car park. Bolaji needs a spotter, somebody to film, and somebody to believe it. A day off.",
    need: { done: ["m49"] },
    music: { start: "radio_streetbreaks", turn: "crowd", end: "sting_pass" },
    steps: [
      { t: "talk", npc: "bola", text: "Find Bolaji taping his wrists in the mall car park", lines: [
        L("bola", "Oya! You came. Hold my phone. Don't cut off my head."),
        L("bola", "If I fall, you did not see it. If I land it, you saw everything.")] },
      { t: "rhythm", pass: 600, text: "Keep her in frame through the first run" },
      { t: "turn", text: "A boy from town lands a trick she has never tried", lines: [
        L("bola", "Shey you see am? I can do that. I think. I have thought about it.")] },
      { t: "choice", prompt: "What should Bolaji do?", text: "Play safe, or go for it?", options: [
        { label: "Play safe and place", set: "bolaji_contest_safe", friend: { bola: 2 } },
        { label: "Go for it", set: "bolaji_contest_goforit", friend: { bola: 3 } }] },
      { t: "rhythm", pass: 700, text: "Call the timing for her second run" },
      { t: "talk", npc: "bola", text: "Talk to Bolaji after the contest", lines: [
        L("bola", "I DID IT. Tell my mother. Don't tell my mother.")], linesLost: [
        L("bola", "Second is fine. Second with style. Did you get the fall? Delete it.")] }],
    fail: { text: "You lost the shot. She's going again.", resume: 1, wait: "now" },
    reward: { cash: 2000, standing: { social: 3 }, friend: { bola: 6 } },
    around: {
      radio: [L("streetbreaks", "Trick of the week belongs to a certain engineering student. You know yourself.")],
      walker: ["The security man clapped. Then remembered he is security."] } });

  /* m51 — Change-Over */
  M.push({ id: mid("m51"), ch: 15, year: 2, sem: 2, gate: 47, title: "Change-Over", giver: "bilkisu", thread: "M", shape: "chase",
    intro: "You know the driver's name now. He sees you coming and runs, through the market, on an okada. At his own door he stops running.",
    need: { done: ["m50"], flags: ["contract_seen"] },
    music: { start: "talk", turn: "chase", end: "quiet" },
    steps: [
      { t: "talk", npc: "bilkisu", text: "Show Sgt. Bilkisu the photograph and the file name", lines: [
        L("bilkisu", "Engr. Aliyu. Works. Twenty years. Hm. I don't like this."),
        L("bilkisu", "I ask the questions. You only point. Understood?")] },
      { t: "watch", place: "market", secs: 6, text: "Wait by the plant room door on the mall service road" },
      { t: "chase", npc: "aliyu", turn: true, text: "He bolts! Follow without hitting anyone", music: "chase", lines: [
        L("crowd:trader", "My tomatoes! Are you people mad?")] },
      { t: "go", place: "quarters", text: "Find his house in the Staff Quarters", lines: [
        N("His okada is lying outside a small house. A child's bicycle beside it.")] },
      { t: "talk", npc: "aliyu", text: "Talk to Engr. Aliyu on his step", music: "quiet", lines: [
        L("aliyu", "I only switched it over. One hour. Then two. Then every night."),
        L("aliyu", "They owe us six months. He paid on time. That is the whole story."),
        L("aliyu", "I left the markers. I think I wanted somebody to follow them.")] },
      { t: "choice", prompt: "Sgt. Bilkisu has not arrived yet", text: "Decide what Aliyu does next", options: [
        { label: "Come with me now and tell her yourself", set: "aliyu_now", standing: { community: 3 } },
        { label: "You have till morning to put it right", set: "aliyu_morning", standing: { street: 3 } }] }],
    fail: { text: "You hit someone and lost him. Heat is up. Try again at dusk.", resume: 1, wait: "dusk" },
    reward: { cash: 4000 },
    around: {
      walker: ["Somebody rode through the market like the devil was collecting rent."],
      phone: [L("@roomie", "Bilkisu was here asking for you. What did you do? Was it good or bad?")] } });

  /* m52 — Phase 2 goes dark */
  M.push({ id: mid("m52"), ch: 16, year: 2, sem: 2, gate: 48, title: "Phase 2 goes dark", giver: "risi", thread: "W", shape: "convoy",
    intro: "While the feeder is being argued over, Phase 2 has had no light for a week. Water, torches and charged phones go out in convoy on the long road at night.",
    need: { done: ["m51"] },
    music: { start: "motif_road", turn: "tension_low", end: "motif_home" },
    steps: [
      { t: "phone", npc: "risi", incoming: true, text: "Answer Iya Risi's call", lines: [
        L("risi", "My children are reading with phone light. The phones have died. Come.")] },
      { t: "collect", item: "supplies", n: 3, at: "market", text: "Load up water, torches and power banks at the mall", lines: [
        L("ladi", "Take. Pay when there is light. I know where you sleep.")] },
      { t: "convoy", npc: "linus", place: "checkpoint", veh: "keke", night: true, text: "Lead the convoy down the long road", lines: [
        N("Emeka's keke, Baba Shuttle's bus and two bicycles fall in behind you."),
        L("linus", "I'm on strike. This is not driving. This is visiting.")] },
      { t: "defend", place: "checkpoint", enemy: "shade", secs: 60, night: true, turn: true, text: "Keep the Hummers off the convoy at the dark bend", lines: [
        N("At the darkest bend the lead lamp dies and Hummers come out of the culvert.")] },
      { t: "go", place: "dangote", text: "Hand out supplies at Dangote Hostel" },
      { t: "go", place: "danfodio", take: "supplies", text: "Hand out supplies at Dan Fodio Hostel", lines: [
        L("muktar", "Dan Fodio thanks you. Officially. I am the chairman. That was official."),
        L("risi", "Sit. All of you. Garri and groundnut. Tonight it is a feast.")] }],
    fail: { text: "A vehicle fell too far behind. Wait for it, then go on.", resume: 2, wait: "now" },
    reward: { cash: 3000, standing: { community: 6 }, flags: ["p2_relief", "dark_bend_marked"] },
    around: {
      radio: [L("kabiru", "To the convoy on the long road: the whole station is riding with you.")],
      walker: ["They came at midnight with water. I will name a child after that keke."] } });

  /* m53 — The second coil */
  M.push({ id: mid("m53"), ch: 16, year: 2, sem: 2, gate: 49, title: "The second coil", giver: "maker", thread: "M", shape: "collect",
    intro: "The Maker reads the second plaque aloud. The coil under the mall needs three parts. Two are sold upstairs. The third is an MIB Store exclusive.",
    need: { done: ["m52"], flags: ["plaque2"] },
    music: { start: "motif_light", turn: "talk", end: "motif_light" },
    steps: [
      { t: "talk", npc: "maker", text: "Hear The Maker read the second plaque", lines: [
        L("maker", "\"Two: beneath the market, where people gather.\" She liked people."),
        L("maker", "Find feeder markers one and three. Then three parts. I will write them down.")] },
      { t: "find", item: "marker_1", at: "fire", text: "Find feeder marker one by the substation" },
      { t: "find", item: "marker_3", at: "demo", text: "Find feeder marker three by the road at the Demonstration School" },
      { t: "buy", item: "copper", text: "Buy fine copper at Bright Electricals", lines: [
        L("clemantine", "Not here, chéri. I sell flowers. Try the bulb man. Take a rose for luck.")] },
      { t: "buy", item: "fuse", text: "Buy a fuse at Hajiya Ladi's" },
      { t: "talk", npc: "mubarak", turn: true, text: "Ask at the MIB Store for the resonator crystal", lines: [
        N("The third part costs more than you have."),
        L("asiya", "Original. No be mall quality. And no, there is no discount."),
        L("mubarak", "There is one discount. I'm not allowed to use it. …Who is it for?")] },
      { t: "talk", npc: "asiya", give: "resonator", text: "Tell Aunty Asiya who it is for", lines: [
        L("asiya", "For my uncle? You should have opened with that. Take it. Bring him his supper.")] },
      { t: "talk", npc: "maker", text: "Deliver the parts to The Maker", lines: [
        L("maker", "Energy in, light out. Now we need a key, and a night.")] }],
    fail: { text: "Short of money for the parts: do any job; the mission waits.", resume: 3, wait: "now" },
    reward: { standing: { academics: 2 }, friend: { maker: 5, asiya: 3 }, flags: ["coil2_parts"] },
    around: {
      radio: [L("bugaje", "A machine that needs one keeper is not finished.")],
      walker: ["The MIB Store gave somebody a discount. I don't believe it. I want names."] } });

  /* m54 — Love in the time of NEPA */
  M.push({ id: mid("m54"), ch: 16, year: 2, sem: 2, gate: 50, title: "Love in the time of NEPA", giver: "@crush", thread: "R", shape: "social",
    intro: "A plan for the evening. Then no light, and no money either. Candles, a bench, one cup of garri and two spoons, and the best conversation of the year.",
    need: { done: ["m53"] },
    music: { start: "motif_heart", turn: "sting_dark", end: "sting_heart" },
    steps: [
      { t: "phone", npc: "@crush", incoming: true, if: "dinner_with_crush", text: "Read the plan for tonight", lines: [
        L("@crush", "Seven o'clock. Shinkafi. Don't be late. I will know.")] },
      { t: "phone", npc: "@best", incoming: true, unless: "dinner_with_crush", text: "Read the plan for tonight", lines: [
        L("@best", "Seven. Roof. I have gist that cannot be typed.")] },
      { t: "go", place: "bank", text: "Check your balance at the bank", lines: [
        L("bursar", "Network."),
        N("It comes back: ₦340.")] },
      { t: "buy", item: "garri", turn: true, text: "It is garri week. Buy garri", lines: [
        L("ladi", "Ah. Week four. Take sugar. Don't tell anybody I gave you sugar.")] },
      { t: "buy", item: "groundnut", text: "Buy groundnut" },
      { t: "buy", item: "candle", text: "Buy a candle" },
      { t: "social", place: "love", secs: 20, emote: "sit", night: true, text: "Sit together in the Love Garden as the lamps die", music: "quiet", lines: [
        N("The lamps die as you sit down."),
        L("@crush", "Garri? On a date? …Is there groundnut? Then it's a date."),
        L("@crush", "Soak it well. Let it swell. That's how one cup becomes two.")] },
      { t: "choice", prompt: "About the money", text: "What do you say about being broke?", options: [
        { label: "Tell the truth about money", set: "honest_broke", friend: { "@best": 8 } },
        { label: "Pretend you \"forgot your wallet\"", set: "hid_broke", friend: { "@best": 2 } }] },
      { t: "emote", emote: "sit", at: "love", take: "candle", text: "Stay till the candle is done" }],
    fail: { text: "You were an hour late. Say sorry. The evening is shorter and cooler.", resume: 6, wait: "now" },
    reward: { standing: { social: 2 }, flags: ["garri_date"] },
    around: {
      radio: [L("arewacalm", "To everyone sitting in the dark with someone tonight: you're fine.")],
      walker: ["Garri has never left me. I can't say the same for people."] } });

  /* m55 — Unplug Iron Mama */
  M.push({ id: mid("m55"), ch: 16, year: 2, sem: 2, gate: 52, title: "Unplug Iron Mama", giver: "maker", thread: "M", shape: "boss",
    intro: "Sgt. Bilkisu has the only key to the basement, and she does not hand keys to students. Earn it on a night shift. Then go down to a generator that has grown teeth.",
    need: { done: ["m54"], flags: ["coil2_parts", "ironmama_seen"] },
    music: { start: "tension_mid", turn: "face_ironmama", end: "sting_coil" },
    steps: [
      { t: "talk", npc: "bilkisu", text: "Ask Sgt. Bilkisu for the basement key", lines: [
        L("bilkisu", "No. …Ride with me tonight. If you're still awake at three, we talk.")] },
      { t: "routine", at: [["@hostel", 21], ["library", 22], ["amina", 23]], give: "basement_key", text: "Ride the night patrol: hostel, library, Queen Amina", lines: [
        N("A noise at the hostel: two boys and a bucket. A goat in the library porch. A first-year locked out."),
        L("peter", "I'm not sleeping. I'm observing. With my eyes closed."),
        L("bilkisu", "You didn't shout at any of them. Hm. Here.")] },
      { t: "go", place: "market", night: true, take: "basement_key", text: "Go down to the mall basement with the crew", lines: [
        N("Down the stairs: you, your roommate, Sly, Bolaji and Emeka.")] },
      { t: "fight", enemy: "shade", n: 8, at: "market", night: true, text: "Clear the Hummers from the corridor" },
      { t: "find", item: "plug1", at: "market", turn: true, text: "Iron Mama can't be hit down. Pull plug 1", lines: [
        N("She cannot be hit down. Four plugs feed her: pull them in the order of the feeder markers. Wrong order and she surges."),
        L("sly", "Sly will hold this side. Go!")] },
      { t: "find", item: "plug2", at: "market", text: "Pull plug 2" },
      { t: "find", item: "plug3", at: "market", text: "Pull plug 3", lines: [
        L("emeka", "My guy, if this thing eats me, tell my keke I loved it.")] },
      { t: "find", item: "plug_mains", at: "market", text: "Pull the mains" },
      { t: "build", parts: { copper: 1, fuse: 1, resonator: 1 }, place: "market", text: "Fit copper, fuse and crystal into the coil", lines: [
        N("The coil wakes. The mall goes dark for one second, then comes back softer.")] },
      { t: "turn", text: "Catch your breath", music: "quiet", lines: [
        N("Nobody dances yet. Somebody's stomach rumbles."),
        L("@roomie", "Is the food court open? I'm asking for the team.")] }],
    fail: { text: "Knocked out: you wake on the stairs. Plugs already pulled stay pulled.", resume: 3, wait: "now" },
    reward: { cash: 15000, standing: { academics: 2, street: 2, social: 2, community: 2, department: 2 }, flags: ["coil2"] },
    around: {
      radio: [L("kabiru", "The mall just blinked. I repeat: the mall blinked.")],
      phone: [L("maker", "It is lit. I felt it from here. Good. Again tomorrow.")] } });

  /* m56 — Light for everybody */
  M.push({ id: mid("m56"), ch: 16, year: 2, sem: 2, gate: 54, title: "Light for everybody", giver: "aliyu", thread: "M", shape: "race",
    intro: "The feeder must be switched back at three corners of campus, ninety seconds apart. Then a panel in the Senate asks what you saw, and reads your own choices back to you.",
    need: { done: ["m55"], flags: ["coil2"] },
    music: { start: "race", turn: "sting_upnepa", end: "talk" },
    steps: [
      { t: "talk", npc: "aliyu", if: "aliyu_now", text: "Get the switching order from Engr. Aliyu", lines: [
        L("aliyu", "Gate, then fire station, then the quad. Ninety seconds or it trips.")] },
      { t: "talk", npc: "bilkisu", unless: "aliyu_now", text: "Get the switching order from Sgt. Bilkisu", lines: [
        N("Aliyu restored one feeder overnight and confessed at dawn. Sgt. Bilkisu has his notes."),
        L("aliyu", "Gate, then fire station, then the quad. Ninety seconds or it trips.")] },
      { t: "go", place: "gate", text: "Throw the first switch at the gate", music: "race" },
      { t: "go", place: "fire", limit: 90, text: "Fire station switch: 90 seconds!" },
      { t: "go", place: "ee", limit: 90, text: "Quad switch: 90 seconds!" },
      { t: "turn", text: "Lamps come on behind you", lines: [
        N("Lamps come on behind you along the boulevard, in order, like a wave."),
        L("crowd:walker", "UP NEPA!")] },
      { t: "go", place: "senate", text: "Attend the hearing at the Senate", lines: [
        L("crowd:panel", "Tell us, in your own words, what you saw.")] },
      { t: "choice", prompt: "The panel asks about Engr. Aliyu", text: "Answer about Engr. Aliyu", options: [
        { label: "Speak for his character", set: "spoke_for_aliyu" },
        { label: "Only the facts", set: "facts_only" }] },
      { t: "turn", if: "megawatt_signed", set: "owned_form", text: "Own up to the sponsorship form", lines: [
        N("The panel reads out your signature on the sponsorship form. You own up to it.")] },
      { t: "turn", if: "megawatt_refused", set: "explained_refusal", text: "Explain why you refused his money", lines: [
        N("The panel asks why you refused his money. You explain.")] },
      { t: "turn", text: "After the hearing", lines: [
        L("megawatt", "I never asked where it came from. That, I am told, is the offence."),
        L("garba", "You told it straight. That is rarer than first class.")] }],
    fail: { text: "You missed a switch window and the feeder tripped. Start again from the gate.", resume: 2, wait: "now" },
    reward: { cash: 8000, standing: { community: 4 }, flags: ["mall_power_honest", "drivers_paid"] },
    around: {
      radio: [L("kabiru", "Steady light. I don't know what to do with my hands.")],
      walker: ["The shuttle men have been paid. Baba Shuttle hooted for one full minute."] } });

  /* m57 — Sign-out, small */
  M.push({ id: mid("m57"), ch: 16, year: 2, sem: 2, gate: 55, title: "Sign-out, small", giver: "kelechi", thread: "F", shape: "quiz",
    intro: "Second-semester exams in steady light. Then the final-years sign out in white shirts, and you hold the markers. Then a holiday to fill.",
    need: { done: ["m56"] },
    music: { start: "sting_test", turn: "motif_crew", end: "sting_level" },
    steps: [
      { t: "quiz", subject: "ee", n: 8, pass: 5, text: "Write the second-semester exam in NELT", lines: [
        N("Someone at the back starts to clap when the lights stay on.")] },
      { t: "buy", item: "markers", text: "Buy sign-out markers at the MIB Store", lines: [
        L("asiya", "Sign-out whites. One day you will buy your own. That one, I will give you free.")], give: "signout_shirt" },
      { t: "social", place: "selfie", secs: 20, text: "Hold the markers in the Selfie Garden", lines: [
        L("kelechi", "Look at it properly. In three years this is you."),
        L("crowd:senior", "Write something! No, not there. Somebody's mother will read this.")] },
      { t: "turn", text: "A senior hands you her pen", lines: [
        N("A senior you never met hands you her pen."),
        L("crowd:senior", "You're the one from the basement. Write your name. So I remember who put the light on.")] },
      { t: "talk", npc: "emeka", text: "Talk to Emeka at the gate about the holiday", lines: [
        L("emeka", "Long vac. You can't sit at home counting ceiling. Work somewhere.")] },
      { t: "choice", prompt: "Pick a holiday job", text: "Pick a holiday job", options: [
        { label: "A mall shop", set: "vac_job_mall", standing: { social: 2 } },
        { label: "The Dam, with Baba Dam", set: "vac_job_dam", standing: { community: 2 } },
        { label: "The airfield", set: "vac_job_airfield", standing: { department: 2 } },
        { label: "The radio station", set: "vac_job_radio", standing: { social: 2 } }] }],
    fail: { text: "A paper went badly. It becomes a carry-over; the year still ends.", resume: 1, wait: "now" },
    reward: { flags: ["year3", "promote_300", "plant_m119"] },
    around: {
      radio: [L("kabiru", "To the graduating set: go well. To everyone else: see you after the break.")],
      phone: [L("mum", "You are coming home? I have cooked. I cooked last week in case.")] } });

  D.STORY.push({ file: "y2", year: 2, npcs: npcs, items: items, missions: M, side: [], ambient: [], coop: [] });
})();
