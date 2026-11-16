/* Freshers School Life — content: places, playable characters, campus people, story, class questions, food, shops,
   race routes, radio. Every person here is fictional. The school is designed for the game; its landmarks carry the names
   students know. Layout lives in games/mapgen/fslg_map.js. */
(function (root, f) { if (typeof module === "object" && module.exports) module.exports = f(); else root.SamaruData = f(); })(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var D = {};

  /* Music follows where you are and what time it is. Each zone has its own groove; morning, afternoon, sunset and
     night each get a different composition in it. */
  D.ZONES = {
    gate: { name: "Gate Hustle", style: "afro", bpm: 112, scale: "major", seed: 610 }, senate: { name: "Senate Fanfare", style: "anthem", bpm: 104, scale: "major", seed: 620 },
    quiet: { name: "Reading Room", style: "calm", bpm: 80, scale: "dorian", seed: 630 }, tech: { name: "Circuit Hours", style: "synthwave", bpm: 98, scale: "minor", seed: 640 },
    garden: { name: "Garden Breeze", style: "calm", bpm: 88, scale: "major", seed: 650 }, hostel: { name: "Hostel Gist", style: "funk", bpm: 100, scale: "mixolydian", seed: 660 },
    social: { name: "Centre Court", style: "amapiano", bpm: 112, scale: "dorian", seed: 670 }, shinkafi: { name: "Shinkafi Lights", style: "amapiano", bpm: 118, scale: "minor", seed: 680 },
    market: { name: "Market Day", style: "afro", bpm: 120, scale: "mixolydian", seed: 690 }, lake: { name: "Still Water", style: "calm", bpm: 72, scale: "dorian", seed: 700 },
    air: { name: "Clear Skies", style: "synthwave", bpm: 110, scale: "major", seed: 710 }, race: { name: "Pit Lane", style: "breaks", bpm: 126, scale: "minor", seed: 720 },
    quad: { name: "Slide Rule Shuffle", style: "funk", bpm: 106, scale: "dorian", seed: 730 }, phase2: { name: "Far Side Evenings", style: "amapiano", bpm: 108, scale: "major", seed: 740 }, road: { name: "Long Road", style: "afro", bpm: 96, scale: "mixolydian", seed: 750 }
  };
  D.TIMES = [[5, "Morning"], [11, "Afternoon"], [17, "Sunset"], [20.5, "Night"]];

  /* role: home (sleep, save; sex m, f or x for a hall with a wing each), class (subject), food (menu), shop (stock), heal, bank,
     jobs, rent, race, air, store (a shop with a door: [x, y] and face, the way you look walking in; mall: the building it is in), dept (a department: faculty, dept), lecture (a lecture theatre: seats), stop (campus shuttle) */
  D.PLACES = [
    { id: "gate", name: "Main Gate", x: 30, y: -735, role: "jobs", rent: ["bike", "scooter", "okada", "keke"], zone: "gate" },
    { id: "senate", name: "Senate Building", x: 0, y: -8, zone: "senate", text: "The orange tower at the heart of the school. Malam Garba keeps the door." },
    { id: "library", name: "Library", x: 0, y: 160, role: "class", subject: "gen", study: true, zone: "quiet" },
    { id: "bookshop", name: "Campus Bookshop", x: 262, y: -548, role: "shop", stock: ["torch", "notebook", "novel", "calculator", "airtime"], zone: "shinkafi" },
    { id: "ee", name: "Faculty of Engineering", x: -525, y: 10, role: "class", subject: "ee", zone: "quad", text: "Ten departments round one square. The Tesla coil hums in the garden; KT and WT stand side by side." },
    { id: "chemeng", name: "The Pilot Plant", /* not "Chemical Engineering": that is the department (dept_chem) */ x: -410, y: -18, role: "class", subject: "chem", zone: "tech" },
    { id: "physics", name: "Department of Physics", x: 262, y: -160, role: "class", subject: "phys", zone: "tech" },
    { id: "maths", name: "Department of Mathematics", x: 262, y: -72, role: "class", subject: "math", zone: "tech" },
    { id: "fslt", name: "FSLT Lecture Theatre", x: -262, y: -270, role: "class", subject: "gen", zone: "quiet" },
    { id: "theatre", name: "Theatre CD", x: -262, y: -55, zone: "quiet" },
    { id: "sculpture", name: "Sculpture Garden", x: 525, y: -150, zone: "garden", text: "Stone figures stand among the trees. They seem closer than last time." },
    { id: "akenzua", name: "Akenzua Hall", x: 480, y: -478, role: "home", sex: "m", zone: "hostel" },
    { id: "ribadu", name: "Ribadu/Alex Hall", x: -500, y: -520, role: "home", sex: "m", zone: "hostel" },
    { id: "amina", name: "Queen Amina Hall", x: 525, y: -680, role: "home", sex: "f", zone: "hostel" },
    { id: "suleiman", name: "Suleiman Hall", x: -545, y: -330, role: "home", sex: "m", zone: "hostel" },
    { id: "pepsi", name: "Pepsi Garden", x: 88, y: -372, role: "food", menu: ["zobo", "meatpie", "voltmalt", "water", "kunu"], zone: "garden" },
    { id: "court", name: "Basketball Court", x: -262, y: -470, zone: "social" },
    { id: "chapel", name: "Chapel of Redemption", x: 262, y: -330, zone: "quiet" },
    { id: "mosque", name: "Central Mosque", x: 630, y: -330, zone: "quiet" },
    { id: "sickbay", name: "Sick Bay", x: -410, y: -330, role: "heal", zone: "quiet", door: [-410, -346], face: 1.5708 },
    { id: "fire", name: "Fire Station", x: 630, y: 270, zone: "tech" },
    { id: "bank", name: "Bank (ATM)", x: 262, y: -672, role: "bank", zone: "shinkafi" },
    { id: "market", name: "Kanti Market", x: 5, y: -852, mall: true, role: "food", menu: ["suya", "masa", "kosai", "kilishi", "corn", "fura", "water"], stock: ["slipper", "chocolate", "perfume", "scarf", "kilishi"], zone: "market" },
    { id: "dam", name: "The Dam", x: 0, y: 400, zone: "lake", text: "The water is wide and still. Sit here at sunrise some time." },
    { id: "strip", name: "Flying Club field", x: -400, y: 545, role: "air", rent: ["plane"], zone: "air" },
    { id: "demo", name: "Demonstration Secondary School", x: 460, y: 110, zone: "quiet" },
    { id: "radio", name: "Campus Radio Studio", x: 195, y: -470, zone: "shinkafi" },
    { id: "club", name: "Racing Club", x: -600, y: -12, role: "race", rent: ["car", "sport", "okada"], zone: "race" },
    { id: "buka", name: "Mama Nkechi's Buka", x: 395, y: -318, role: "food", menu: ["macd600", "macd800", "jollof", "indomie", "meatpie", "zobo", "water"], zone: "hostel" },
    { id: "shayi", name: "Mai Shayi Audu", x: -372, y: -470, role: "food", menu: ["breadtea", "indomie", "kosai", "water"], zone: "hostel" },
    { id: "quarters", name: "Staff Quarters", x: 500, y: 500, zone: "garden", text: "Quiet bungalows and mango trees." },
    { id: "art", name: "Faculty of Arts", x: -262, y: 150, zone: "quiet" },
    { id: "education", name: "Institute of Education", x: 262, y: 150, zone: "quiet" },
    { id: "social", name: "Social Centre", x: -262, y: -545, role: "food", menu: ["macd600", "macd800", "macd1000", "zobo", "water"], zone: "social", text: "Tennis, ping-pong and the nine-ball table. The basketball courts are next door." },
    { id: "shinkafi", name: "Shinkafi", x: 100, y: -560, role: "food", menu: ["shawarma", "macd800", "macd1000", "macd1500", "macd2500", "jollof", "voltmalt", "water"], stock: ["chocolate", "airtime"], zone: "shinkafi", text: "Shawarma, games, food. Half the school is here after six." },
    { id: "selfie", name: "Selfie Garden", x: 0, y: -165, zone: "garden", text: "Wide lawns in front of the Senate, and the big {{GAME_INITIALS}} letters. Everybody's profile picture was taken here." },
    { id: "love", name: "Love Garden", x: -88, y: -382, zone: "garden", text: "Benches, shade, a heart-shaped hedge, and couples pretending to read." },
    { id: "enggarden", name: "Engineering Garden", x: -525, y: 140, zone: "quad", text: "A Tesla coil crackles in the middle of the lawn. Brass plaques stand around it." },
    { id: "facgarden", name: "Faculty Garden", x: -262, y: 52, zone: "garden", text: "Quiet between lectures." },
    { id: "geogarden", name: "Geography Garden", x: 262, y: 42, zone: "garden", text: "A stone globe turns slowly among the flowers." },
    { id: "dept_elect", name: "Electrical Engineering", x: -592, y: 41, role: "dept", faculty: "eng", dept: "Electrical", zone: "quad" },
    { id: "dept_comp", name: "Computer Engineering", x: -458, y: 41, role: "dept", faculty: "eng", dept: "Computer", zone: "quad" },
    { id: "dept_mech", name: "Mechanical Engineering", x: -658, y: 80, role: "dept", faculty: "eng", dept: "Mechanical", zone: "quad" },
    { id: "dept_civil", name: "Civil Engineering", x: -658, y: 150, role: "dept", faculty: "eng", dept: "Civil", zone: "quad" },
    { id: "dept_agric", name: "Agricultural Engineering", x: -658, y: 220, role: "dept", faculty: "eng", dept: "Agricultural", zone: "quad" },
    { id: "dept_metal", name: "Metallurgical Engineering", x: -611, y: 259, role: "dept", faculty: "eng", dept: "Metallurgical", zone: "quad" },
    { id: "dept_mining", name: "Mining Engineering", x: -525, y: 259, role: "dept", faculty: "eng", dept: "Mining", zone: "quad" },
    { id: "dept_water", name: "Water Resources Engineering", x: -439, y: 259, role: "dept", faculty: "eng", dept: "Water Resources", zone: "quad" },
    { id: "dept_telecom", name: "Telecommunications Engineering", x: -387, y: 88, role: "dept", faculty: "eng", dept: "Telecommunications", zone: "quad" },
    { id: "dept_chem", name: "Chemical Engineering", x: -387, y: 200, role: "dept", faculty: "eng", dept: "Chemical", zone: "quad" },
    { id: "kt", name: "Kainji Theatre (KT)", x: -476, y: 98, role: "lecture", seats: 300, zone: "quad", text: "KT. A raked lecture theatre: three hundred seats and one working fan." },
    { id: "wt", name: "Wolfson Theatre (WT)", x: -476, y: 182, role: "lecture", seats: 300, zone: "quad", text: "WT, side by side with KT. Come early or stand at the back." },
    { id: "nelt", name: "NELT", x: -520, y: -130, role: "lecture", seats: 800, zone: "quad", text: "The biggest lecture hall on campus. A whole level fits inside, and still people sit on the steps." },
    { id: "compsci", name: "Department of Computer Science", x: 610, y: 16, role: "dept", faculty: "sci", dept: "Computer Science", zone: "tech" },
    { id: "dangote", name: "Dangote Hostel", x: 1540, y: 172, role: "home", sex: "x", phase: 2, zone: "phase2", text: "Phase 2. A wing for men and a wing for women, a long way past the dam." },
    { id: "danfodio", name: "Dan Fodio Hostel", x: 1540, y: 412, role: "home", sex: "m", phase: 2, zone: "phase2" },
    { id: "p2shops", name: "Phase 2 Shops", x: 1392, y: 410, role: "shop", stock: ["notebook", "torch", "chocolate", "airtime", "slipper"], zone: "phase2", text: "Provisions, a barber and salon, POS and phone charging, and a laundry. Everything a far hostel needs." },
    { id: "p2canteen", name: "Phase 2 Canteen", x: 1444, y: 520, role: "food", menu: ["macd600", "macd800", "jollof", "indomie", "breadtea", "zobo", "water"], zone: "phase2" },
    { id: "p2park", name: "Phase 2 Shuttle Park", x: 1380, y: 392, role: "stop", zone: "phase2" },
    { id: "p2mosque", name: "Phase 2 Mosque", x: 1716, y: 250, zone: "phase2", text: "A small mosque for the far hostels." },
    { id: "p2chapel", name: "Phase 2 Chapel", x: 1700, y: 345, zone: "phase2", text: "A small chapel with a short steeple." },
    { id: "lowerdam", name: "Lower Dam Causeway", x: 12, y: 800, zone: "lake", text: "Water on both sides and a long road ahead. Phase 2 is that way." },
    { id: "checkpoint", name: "Phase 2 Checkpoint", x: 700, y: 932, zone: "road", text: "The boom is always up. The guard waves everybody through." },
    { id: "stalls", name: "Roadside Stalls", x: 1026, y: 822, role: "food", menu: ["corn", "kosai", "kilishi", "water"], zone: "road" },
    { id: "mk_supermarket", name: "Supermarket", x: -78, y: -966.5, role: "store", mall: "market", door: [-78, -970], face: -1.5708, zone: "market" },
    { id: "mk_electronics", name: "Electronics", x: -52, y: -966.5, role: "store", mall: "market", door: [-52, -970], face: -1.5708, zone: "market" },
    { id: "mk_phones", name: "Phones & Gadgets", x: -26, y: -966.5, role: "store", mall: "market", door: [-26, -970], face: -1.5708, zone: "market" },
    { id: "mk_cinema", name: "Cinema", x: 0, y: -966.5, role: "store", mall: "market", door: [0, -970], face: -1.5708, zone: "market" },
    { id: "mk_books", name: "Books & Stationery", x: 26, y: -966.5, role: "store", mall: "market", door: [26, -970], face: -1.5708, zone: "market" },
    { id: "mk_pharmacy", name: "Pharmacy", x: 52, y: -966.5, role: "store", mall: "market", door: [52, -970], face: -1.5708, zone: "market" },
    { id: "mk_arcade", name: "Games Room", x: 78, y: -966.5, role: "store", mall: "market", door: [78, -970], face: -1.5708, zone: "market" },
    { id: "mk_fashion", name: "Fashion", x: -78, y: -893.5, role: "store", mall: "market", door: [-78, -890], face: 1.5708, zone: "market" },
    { id: "mk_native", name: "Tailor & Native Wear", x: -52, y: -893.5, role: "store", mall: "market", door: [-52, -890], face: 1.5708, zone: "market" },
    { id: "mk_modest", name: "Modest Fashion", x: -26, y: -893.5, role: "store", mall: "market", door: [-26, -890], face: 1.5708, zone: "market" },
    { id: "mk_shoes", name: "Shoes", x: 26, y: -893.5, role: "store", mall: "market", door: [26, -890], face: 1.5708, zone: "market" },
    { id: "mk_eyewear", name: "Eyewear", x: 52, y: -893.5, role: "store", mall: "market", door: [52, -890], face: 1.5708, zone: "market" },
    { id: "mk_sports", name: "Sports", x: 78, y: -893.5, role: "store", mall: "market", door: [78, -890], face: 1.5708, zone: "market" },
    { id: "mk_barber", name: "Barber & Salon", x: -86.5, y: -954, role: "store", mall: "market", door: [-90, -954], face: 3.1416, zone: "market" },
    { id: "mk_thrift", name: "Thrift (Okrika)", x: -86.5, y: -906, role: "store", mall: "market", door: [-90, -906], face: 3.1416, zone: "market" },
    { id: "mk_gifts", name: "Gifts", x: 86.5, y: -954, role: "store", mall: "market", door: [90, -954], face: 0.0, zone: "market" },
    { id: "mk_food", name: "Food Court", x: 86.5, y: -906, role: "store", mall: "market", door: [90, -906], face: 0.0, zone: "market", menu: ["shawarma", "jollof", "macd1000", "meatpie", "zobo", "voltmalt", "water"] },
    { id: "mk_dance", name: "Dance Floor", x: 0, y: -930, role: "store", mall: "market", door: [0, -930], face: -1.5708, zone: "shinkafi", text: "An open floor in the middle of the mall court, with a small stage. It wakes up after dark." },
    { id: "mibstore", name: "MIB Store", x: 250, y: -288, role: "store", door: [250, -284], face: 1.5708, zone: "senate", text: "White and gold, with three letters over the door: M I B. The maker's own shop." },
    { id: "stop_market", name: "Shuttle stop: Kanti Market", x: 60, y: -809, role: "stop", zone: "market" },
    { id: "stop_gate", name: "Shuttle stop: Main Gate", x: -10, y: -730, role: "stop", zone: "gate" },
    { id: "stop_senate", name: "Shuttle stop: Senate", x: 182, y: -30, role: "stop", zone: "senate" },
    { id: "stop_social", name: "Shuttle stop: Social Centre", x: -182, y: -516, role: "stop", zone: "social" },
    { id: "stop_eng", name: "Shuttle stop: Engineering", x: -490, y: -6, role: "stop", zone: "quad" },
    { id: "stop_library", name: "Shuttle stop: Library", x: 70, y: 113, role: "stop", zone: "quiet" },
    { id: "stop_dam", name: "Shuttle stop: The Dam", x: 34, y: 308, role: "stop", zone: "lake" }
  ];


  /* The maker of the game and the site. One place to correct the spelling. */
  D.CREATOR = { short: "M.I. BUGAJE", full: "Muhammad Iliyasu Bugaje" };
  /* Plaques around the Tesla coil in the Engineering Garden. */
  D.HALL = [
    { name: "Nikola Tesla", years: "1856 to 1943", text: "The coil above you is his: a resonant transformer he built in 1891 that turns ordinary voltage into hundreds of thousands of volts and throws it into the air as sparks. Tesla designed the AC induction motor and the polyphase system that still carries power across whole countries. The unit of magnetic flux density, the tesla, carries his name." },
    { name: "Michael Faraday", years: "1791 to 1867", text: "A bookbinder's apprentice with almost no schooling. In 1831 he showed that a changing magnetic field drives a current: electromagnetic induction. Every generator and every transformer on this campus works because of that one experiment. The farad, the unit of capacitance, is named after him." },
    { name: "James Clerk Maxwell", years: "1831 to 1879", text: "He wrote the equations that tie electricity, magnetism and light together, and predicted that light itself is an electromagnetic wave. Radio, radar, Wi-Fi and the phone in your pocket all follow from those equations." },
    { name: "Georg Simon Ohm", years: "1789 to 1854", text: "A schoolteacher who measured, patiently, how current depends on voltage and resistance, and published V = IR in 1827. His own colleagues dismissed it at first. It is now the first line of every circuits course, including yours." },
    { name: "André-Marie Ampère", years: "1775 to 1836", text: "Within weeks of hearing that a current deflects a compass, he worked out the force between two current-carrying wires and founded electrodynamics. The ampere, the unit of current, honours him." },
    { name: D.CREATOR.full, years: "Kanti", me: true, text: "The engineer behind everything you are standing in. " + D.CREATOR.short + " built EE Hub, the department's whole online home, and then built {{GAME_NAME}} on top of it: this campus, these roads, the classes, the okadas, the shades and the story. The scientists on the other plaques explained how the world works. He used it to build a world. If you are enjoying the game, find him and say thank you." }
  ];
  D.FOOD = {
    suya: { name: "Suya", price: 500, hunger: 35, energy: 4 }, masa: { name: "Masa", price: 300, hunger: 25 }, kosai: { name: "Kosai", price: 200, hunger: 15 },
    kilishi: { name: "Kilishi", price: 700, hunger: 30, energy: 5 }, corn: { name: "Roasted corn", price: 150, hunger: 12 }, fura: { name: "Fura da nono", price: 400, hunger: 25, energy: 10 },
    jollof: { name: "Jollof rice and chicken", price: 800, hunger: 60, hp: 10 }, indomie: { name: "Indomie and egg", price: 600, hunger: 45, energy: 5 }, meatpie: { name: "Meat pie", price: 300, hunger: 20 },
    breadtea: { name: "Bread and tea", price: 350, hunger: 30, energy: 15 }, zobo: { name: "Cold zobo", price: 200, hunger: 5, energy: 12 }, kunu: { name: "Kunu", price: 250, hunger: 10, energy: 10 },
    macd600: { name: "MACD (small)", price: 600, hunger: 30 }, macd800: { name: "MACD (regular)", price: 800, hunger: 42, energy: 4 }, macd1000: { name: "MACD (large)", price: 1000, hunger: 55, energy: 6 },
    macd1500: { name: "MACD (special)", price: 1500, hunger: 75, energy: 8, hp: 8 }, macd2500: { name: "MACD (jumbo, to share)", price: 2500, hunger: 100, energy: 12, hp: 15 }, shawarma: { name: "Shawarma", price: 1200, hunger: 50, energy: 6 },
    voltmalt: { name: "Volt Malt", price: 500, hunger: 5, energy: 40 }, water: { name: "Pure water", price: 20, energy: 3 }
  };
  D.ITEMS = {
    torch: { name: "Torch", price: 1500, text: "Hold F to shine it. Shades caught in the beam freeze." },
    slipper: { name: "Mama's slipper", price: 300, text: "Press K to throw. It always comes back." },
    notebook: { name: "Notebook", price: 400, gift: true }, novel: { name: "Novel", price: 900, gift: true }, chocolate: { name: "Chocolate", price: 600, gift: true },
    perfume: { name: "Perfume oil", price: 1500, gift: true }, scarf: { name: "Ankara scarf", price: 1200, gift: true }, kilishi: { name: "Kilishi pack", price: 700, gift: true },
    calculator: { name: "Scientific calculator", price: 3500, text: "One wrong answer forgiven in every class." }, airtime: { name: "Airtime", price: 200, text: "One hangout call." },
    fuse: { name: "Feeder fuse", quest: true }, logbook: { name: "Substation logbook", quest: true }, key: { name: "Bronze key", quest: true }, coil: { name: "Induction coil", quest: true }, core: { name: "Relay core", quest: true },
    capacitor: { name: "Overcharged capacitor", quest: true }, ledger: { name: "Battery ledger", quest: true }, phonesack: { name: "Sack of stolen phones", quest: true }, dynamo: { name: "Humming dynamo", quest: true },
    winding: { name: "Copper winding", quest: true }, sparkgap: { name: "Spark gap", quest: true }, resonator: { name: "Resonator", quest: true, text: "It sings the opposite note." }, voltshard: { name: "Volt shard" }
  };

  /* Playable students. look: skin, hair (low, afro, braids, hijab, cap, locs, puff, fade, coily), top colour. voice: system voice pool + pitch. */
  D.CAST = [
    { id: "tunde", name: "Tunde Bakare", from: "Ibadan", skin: "#7a4a2b", hair: "fade", top: "#1f8a5b", voice: "male", pitch: 1.0, perk: "charm", blurb: "Talks his way into anything." },
    { id: "amina", name: "Amina Yusuf", from: "Kano", skin: "#8a5633", hair: "hijab", hairCol: "#7c3aed", top: "#f1e9ff", voice: "female", pitch: 1.1, perk: "brain", blurb: "First on the class list, every time." },
    { id: "chidi", name: "Chidi Okeke", from: "Enugu", skin: "#5e3a22", hair: "low", top: "#d9482b", voice: "male", pitch: .9, perk: "drive", blurb: "Grew up fixing okadas with his uncle." },
    { id: "zainab", name: "Zainab Bello", from: "Kaduna", skin: "#94603a", hair: "hijab", hairCol: "#0e7490", top: "#fde68a", voice: "female", pitch: 1.2, perk: "fit", blurb: "Kanti born. Knows every shortcut." },
    { id: "efe", name: "Efe Oghene", from: "Warri", skin: "#6b4226", hair: "afro", top: "#f59e0b", voice: "male", pitch: 1.15, perk: "charm", blurb: "No dull moment. Ever." },
    { id: "ngozi", name: "Ngozi Eze", from: "Owerri", skin: "#7d4e2e", hair: "braids", top: "#e11d74", voice: "female", pitch: 1.0, perk: "brain", blurb: "Solves it before the lecturer finishes." },
    { id: "musa", name: "Musa Danjuma", from: "Jos", skin: "#6a4127", hair: "cap", hairCol: "#f8fafc", top: "#e2e8f0", voice: "male", pitch: .85, perk: "fit", blurb: "Runs up Plateau hills for fun." },
    { id: "halima", name: "Halima Sani", from: "Sokoto", skin: "#d0a076", hair: "hijab", hairCol: "#be123c", top: "#fecdd3", voice: "female", pitch: 1.05, perk: "drive", blurb: "Quiet, until she is behind handlebars." },
    { id: "tamuno", name: "Tamuno George", from: "Port Harcourt", skin: "#4f301c", hair: "locs", top: "#2563eb", voice: "male", pitch: .95, perk: "fit", blurb: "Swimmer's lungs, dancer's feet." },
    { id: "kemi", name: "Kemi Adeyemi", from: "Lagos", skin: "#85532f", hair: "puff", top: "#22d3ee", voice: "female", pitch: 1.25, perk: "charm", blurb: "Lagos hustle in a campus world." },
    { id: "ibrahim", name: "Ibrahim Garba", from: "Kaduna", skin: "#c48f65", hair: "coily", top: "#84cc16", voice: "male", pitch: 1.05, perk: "brain", blurb: "Reads circuit diagrams like comics." },
    { id: "blessing", name: "Blessing Akpan", from: "Uyo", skin: "#663e24", hair: "afro", top: "#a855f7", voice: "female", pitch: .95, perk: "drive", blurb: "Calm hands on any steering." }
  ];
  /* The secret student. Never listed with the cast: he appears on the character screen only after the reveal, and can
     be chosen only with the secret code. White kaftan, white cap, gold glow. */
  D.HERO = { id: "bugaje", name: "M.I. BUGAJE", full: "Muhammad Iliyasu Bugaje", from: "the Maker of {{GAME_INITIALS}}", skin: "#d6a67c", hair: "coily", hairCol: "#1a1210", top: "#ffffff", mode: "kaftan", outfit: 1, glow: "#fde047", gold: true,
    voice: "male", pitch: .9, perk: "charm", hidden: true, blurb: "Cannot be hurt or caught. Never tired. Every machine from day one. One hit is enough." };
  /* Skin tones, deep to light. Walkers draw from all of them (about one in five from the two lightest). */
  D.SKINS = [{ id: "deep", name: "Deep", col: "#4f301c" }, { id: "dark", name: "Dark brown", col: "#6b4226" }, { id: "brown", name: "Brown", col: "#85532f" }, { id: "tan", name: "Tan", col: "#a06a42" }, { id: "olive", name: "Light olive", col: "#c48f65" }, { id: "light", name: "Light", col: "#d6a67c" }];
  D.OUTFITS = [{ name: "Campus casual", mode: "tee" }, { name: "Kaftan", mode: "kaftan" }, { name: "Ankara", mode: "ankara" }, { name: "Football jersey", mode: "jersey" }, { name: "Lab coat", mode: "coat" }];

  /* Campus people. at: place id (they stand near its marker; "@home" = your hostel). date: romance option with tastes. */
  D.NPCS = [
    { id: "sadiq", name: "Sadiq", role: "Your roommate", at: "@home", skin: "#74472a", hair: "low", top: "#0ea5e9", voice: "male", pitch: 1.1, hi: ["Roomie! How far?", "You don chop?", "No light again? I taya."], likes: { gift: "kilishi" } },
    { id: "garba", name: "Malam Garba", role: "Senate porter", at: "senate", skin: "#6b4226", hair: "cap", hairCol: "#fff", top: "#334155", voice: "male", pitch: .8, hi: ["Sannu da zuwa. Welcome.", "This campus has seen things, my child.", "Walk well."] },
    { id: "okonkwo", name: "Dr. Okonkwo", role: "EE lecturer", at: "ee", skin: "#5e3a22", hair: "fade", top: "#f8fafc", voice: "female", pitch: .9, hi: ["Kirchhoff does not negotiate.", "You are early. Good.", "Have you done the tutorial sheet?"] },
    { id: "bello", name: "Prof. Bello", role: "Physics", at: "physics", skin: "#7a4a2b", hair: "cap", hairCol: "#1e293b", top: "#fef3c7", voice: "male", pitch: .75, hi: ["Units, young one. Always units.", "Energy is never lost. Only your biro."] },
    { id: "emeka", name: "Emeka", role: "Okada rider", at: "gate", skin: "#5a361f", hair: "low", top: "#facc15", voice: "male", pitch: 1.0, hi: ["Oga, where you dey go?", "Hold body well o.", "This machine na my office."], likes: { gift: "kilishi" } },
    { id: "ada", name: "Ada", role: "Course mate", at: "ee", date: true, skin: "#7d4e2e", hair: "braids", top: "#f472b6", voice: "female", pitch: 1.15, hi: ["Did you get number four?", "Group study later?", "I heard something moved in the lab last night."], likes: { spot: "pepsi", okSpot: "sculpture", gift: "chocolate", talk: "dreams" }, hates: "gossip" },
    { id: "yakubu", name: "Yakubu", role: "Class rep", at: "fslt", date: true, skin: "#6a4127", hair: "coily", top: "#16a34a", voice: "male", pitch: .95, hi: ["Attendance sheet is with me.", "Lecture has been moved. Again.", "You watched the match?"], likes: { spot: "dam", okSpot: "court", gift: "novel", talk: "football" }, hates: "exams" },
    { id: "fatima", name: "Fatima", role: "Library regular", at: "library", date: true, skin: "#c99468", hair: "hijab", hairCol: "#0f766e", top: "#ccfbf1", voice: "female", pitch: 1.1, hi: ["Shh. Whisper.", "This shelf is the best one.", "Have you read Achebe?"], likes: { spot: "sculpture", okSpot: "pepsi", gift: "notebook", talk: "books" }, hates: "football" },
    { id: "bola", name: "Bolaji", role: "Skater", at: "court", date: true, skin: "#85532f", hair: "locs", top: "#fb923c", voice: "female", pitch: 1.0, hi: ["Kickflip first, talk later.", "The ring road at 6am. Pure peace.", "You skate?"], likes: { spot: "court", okSpot: "dam", gift: "scarf", talk: "music" }, hates: "exams" },
    { id: "kelechi", name: "Kelechi", role: "Sculpture student", at: "sculpture", date: true, skin: "#663e24", hair: "afro", top: "#a3e635", voice: "male", pitch: 1.1, hi: ["Stone remembers.", "Careful, that one is still wet.", "The statues moved again last night."], likes: { spot: "sculpture", okSpot: "dam", gift: "perfume", talk: "dreams" }, hates: "gossip" },
    { id: "nkechi", name: "Mama Nkechi", role: "Buka owner", at: "buka", skin: "#6b4226", hair: "puff", top: "#ef4444", voice: "female", pitch: .85, hi: ["My pikin, come chop.", "Rice don done!", "You dey lean o. Eat."] },
    { id: "audu", name: "Mai Shayi Audu", role: "Tea seller", at: "shayi", skin: "#724529", hair: "cap", hairCol: "#7dd3fc", top: "#f1f5f9", voice: "male", pitch: .9, hi: ["Shayi? Bread? Egg?", "I hear everything at this table.", "Night people buy the most tea."] },
    { id: "sly", name: "Big Sly", role: "Court boss", at: "court", skin: "#4f301c", hair: "fade", top: "#111827", voice: "male", pitch: .7, hi: ["Fresher. This court is mine.", "You get mouth o."] },
    { id: "kabiru", name: "DJ Kabiru", role: "Campus radio", at: "radio", skin: "#7a4a2b", hair: "afro", top: "#8b5cf6", voice: "male", pitch: 1.2, hi: ["You are tuned to Kanti FM!", "Request line is open.", "No dead air on my watch."] },
    { id: "hauwa", name: "Nurse Hauwa", role: "Sick Bay", at: "sickbay", skin: "#8a5633", hair: "hijab", hairCol: "#fff", top: "#bae6fd", voice: "female", pitch: 1.0, hi: ["Drink water. Sleep. Eat.", "You students and night reading."] },
    { id: "baba", name: "Baba Dam", role: "Fisherman", at: "dam", skin: "#553320", hair: "cap", hairCol: "#a16207", top: "#78716c", voice: "male", pitch: .65, hi: ["The water is listening.", "Fish don't bite when the lights go.", "Sit. Watch the sun."] },
    { id: "danladi", name: "Coach Danladi", role: "Racing club", at: "club", skin: "#6a4127", hair: "low", top: "#dc2626", voice: "male", pitch: .9, hi: ["Brake late. Turn early.", "Helmet first.", "The ring road separates riders from talkers."] },
    { id: "uche", name: "Captain Uche", role: "Flying club", at: "strip", skin: "#5e3a22", hair: "cap", hairCol: "#1d4ed8", top: "#e0f2fe", voice: "female", pitch: .9, hi: ["Level ten, then we talk about wings.", "Check the windsock.", "Kanti is beautiful from above."] },
    { id: "maker", name: "The Maker", role: "Keeper of the Tesla coil", at: "enggarden", skin: "#d6a67c", hair: "coily", top: "#0f766e", voice: "male", pitch: .9, hi: ["Tesla dreamed it. We build it.", "Read the plaques. Every one of them was a student once.", "Resonance, my friend. Everything has a note."] },
    { id: "ladi", name: "Hajiya Ladi", role: "Market trader", at: "market", skin: "#7d4e2e", hair: "hijab", hairCol: "#f59e0b", top: "#fef08a", voice: "female", pitch: .95, hi: ["Customer! Come and see.", "Last price.", "I will dash you one extra."] }
  ];
  D.TALK = { dreams: "Ask about their dreams", books: "Talk about books", football: "Talk about football", music: "Talk about music", exams: "Complain about exams", gossip: "Share campus gossip" };
  D.DATE_SPOTS = ["pepsi", "dam", "sculpture", "court", "love", "selfie", "shinkafi", "geogarden"];

  /* Enemies. Cartoon only: shades are living shadows that pop into sparks; people just get dizzy and run. */
  D.ENEMIES = {
    shade: { name: "Blackout shade", hp: 30, dmg: 6, speed: 3.3, r: .6, xp: 8, col: "#1b1035" },
    bully: { name: "Court boy", hp: 50, dmg: 8, speed: 4.1, r: .5, xp: 15, human: true, col: "#111827" },
    sly: { name: "Big Sly", hp: 240, dmg: 14, speed: 4.4, r: .7, xp: 150, human: true, boss: true, col: "#111827" },
    leviathan: { name: "The Dam Eel", hp: 420, dmg: 16, speed: 2.4, r: 1.6, xp: 300, boss: true, col: "#0e7490" },
    entropy: { name: "Count Entropy", hp: 640, dmg: 18, speed: 3.6, r: .8, xp: 600, boss: true, col: "#3d1f5c" }
  };

  /* Story. Step types: go, talk, eat, sleep, class (pass = right answers), buy, ride, fight, find, race, emote, job, stat.
     "@home" is the hostel you picked. say = [speaker id or "", line] shown when the step starts. */
  D.MISSIONS = [
    { id: "m1", ch: 1, title: "Welcome, fresher", intro: "Registration day. You wake up in your hostel with one bag, one admission letter and one very big school.", steps: [
      { t: "talk", npc: "sadiq", text: "Wake up and meet your roommate", say: ["sadiq", "So you are the one! I am Sadiq. Top bunk is mine. Everything else, we share. Registration is at the Senate: go early, the queue is wicked."] },
      { t: "go", place: "senate", text: "Go to the Senate Building to register", say: ["", "Follow the yellow line on your map. Sprint to get there faster."] },
      { t: "talk", npc: "garba", text: "Collect your file and clearance from Malam Garba", say: ["garba", "Fresher! Here is your file and your clearance slip. Take them to your department. One advice: when the light goes at night, stay inside."] },
      { t: "go", place: "@dept", text: "Take your file to your department", say: ["", "Your department and your lectures are on your phone: Phone, then Timetable."] }], reward: { cash: 500, xp: 60 } },
    { id: "m2", ch: 1, title: "Belle first", need: { done: ["m1"] }, intro: "Sadiq says nobody survives campus on an empty stomach.", steps: [
      { t: "eat", text: "Buy and eat something (look for the food icons)" },
      { t: "class", pass: 2, text: "Attend any class and get 2 answers right", say: ["", "Classes run 08:00 to 18:00 at the departments, the Library and FSLT."] },
      { t: "sleep", text: "Go back to your hostel and sleep" }], reward: { cash: 300, xp: 120 } },
    { id: "m3", ch: 1, title: "Two wheels", need: { done: ["m2"] }, intro: "The campus is three kilometres across. Your legs have complained.", steps: [
      { t: "talk", npc: "emeka", text: "Talk to Emeka at the Main Gate", say: ["emeka", "Legedis Benz no fit carry you forever. Take that bicycle. When your level rise, come for the real machine."] },
      { t: "ride", veh: "bike", text: "Get on a bicycle (press E beside one)" },
      { t: "go", place: "library", text: "Ride to the Library" }], reward: { cash: 300, xp: 100 } },
    { id: "m4", ch: 2, title: "They have taken light", need: { done: ["m3"] }, intro: "Night. The fans slow down. The whole hostel groans: NEPA!", steps: [
      { t: "go", place: "@home", night: true, text: "Be at your hostel after dark (19:00)" },
      { t: "talk", npc: "sadiq", text: "Talk to Sadiq", say: ["sadiq", "You see that thing by the gutter? Shadows that walk. Take my torch. Shine it, then slap am!"], give: "torch" },
      { t: "fight", enemy: "shade", n: 3, at: "@home", text: "Freeze shades with the torch (F) and hit them (J)" },
      { t: "talk", npc: "garba", text: "Tell Malam Garba what you saw", say: ["garba", "So they are back. Blackout shades. They follow a man in a tall hat. Somebody is pulling the fuses, child."] }], reward: { cash: 800, xp: 200 } },
    { id: "m5", ch: 2, title: "The missing fuse", need: { done: ["m4"] }, intro: "A feeder fuse does not walk away on its own.", steps: [
      { t: "find", item: "fuse", at: "fire", text: "Search around the Fire Station for the feeder fuse" },
      { t: "find", item: "logbook", at: "radio", text: "Search around the Radio Studio for the substation logbook" },
      { t: "talk", npc: "okonkwo", text: "Take both to Dr. Okonkwo", say: ["okonkwo", "This signature... C. Entropy. He is not stealing power. He is wasting it, on purpose. Come to class. You will need what I teach."] },
      { t: "class", pass: 3, place: "ee", text: "Pass an EE class at the Engineering Complex (3 right)" }], reward: { cash: 1000, xp: 260 } },
    { id: "m6", ch: 2, title: "Mai Shayi knows", need: { done: ["m5"] }, intro: "If it happened at night, the tea seller saw it.", steps: [
      { t: "talk", npc: "audu", text: "Talk to Mai Shayi Audu", say: ["audu", "Tall hat, purple coat. Every night he stands in the Sculpture Garden, and the statues turn to face him."] },
      { t: "go", place: "sculpture", night: true, text: "Go to the Sculpture Garden at night" },
      { t: "fight", enemy: "shade", n: 5, at: "sculpture", text: "Clear the shades from the garden" }], reward: { cash: 1200, xp: 320 } },
    { id: "m7", ch: 3, title: "Fresher tax", need: { done: ["m6"] }, intro: "Word is that someone at the Basketball Court is collecting 'tax' from freshers.", steps: [
      { t: "talk", npc: "sly", text: "Confront Big Sly at the Basketball Court", say: ["sly", "Every fresher pays. You? Double. Boys, collect."] },
      { t: "fight", enemy: "bully", n: 2, at: "court", text: "Stand your ground against the court boys" },
      { t: "talk", npc: "bola", text: "Talk to Bolaji", say: ["bola", "Nobody has stood up to Sly since last session. He respects speed. Beat his boys round the lecture theatres and he will have to listen."] }], reward: { cash: 800, xp: 300 } },
    { id: "m8", ch: 3, title: "Run am", need: { done: ["m7"] }, intro: "A bicycle race around the lecture theatres. Winner keeps the court.", steps: [
      { t: "race", race: "r1", text: "Win the Theatre Loop bicycle race (start at the Racing Club)" },
      { t: "talk", npc: "bola", text: "Tell Bolaji", say: ["bola", "You actually did it! Sly is fuming. He says: him and you, one on one, when you reach level 4."] }], reward: { cash: 1500, xp: 350 } },
    { id: "m9", ch: 3, title: "Sly's last stand", need: { done: ["m8"], lvl: 4 }, intro: "One on one. The whole court is watching.", steps: [
      { t: "fight", enemy: "sly", n: 1, at: "court", text: "Beat Big Sly at the Basketball Court" },
      { t: "talk", npc: "sly", text: "Talk to Sly", say: ["sly", "...You get heart. The tax is over. And fresher, those shadow things took my small brother's phone. When you go for the man in the hat, call me."] }], reward: { cash: 2500, xp: 500, flag: "slyAlly" } },
    { id: "m10", ch: 4, title: "Stone that points", need: { done: ["m9"] }, intro: "Kelechi swears the statues are pointing at something.", steps: [
      { t: "talk", npc: "kelechi", text: "Talk to Kelechi in the Sculpture Garden", say: ["kelechi", "Three statues, three directions. One faces the bell, one faces the minaret, the last faces where the water sleeps. Follow them in that order."] },
      { t: "go", place: "chapel", text: "Follow the first statue: the bell" },
      { t: "go", place: "mosque", text: "Follow the second statue: the minaret" },
      { t: "go", place: "dam", text: "Follow the third statue: where the water sleeps" },
      { t: "find", item: "key", at: "dam", text: "Search the dam shore" }], reward: { cash: 1500, xp: 420 } },
    { id: "m11", ch: 4, title: "Baba Dam", need: { done: ["m10"] }, intro: "An old fisherman watched you pick up the key.", steps: [
      { t: "talk", npc: "baba", text: "Talk to Baba Dam", say: ["baba", "That key opens the old pump house. But I do not know you. Work for the people of this campus first. Then come back."] },
      { t: "job", n: 3, text: "Complete 3 jobs from the Main Gate board or your phone" },
      { t: "talk", npc: "baba", text: "Return to Baba Dam", say: ["baba", "Good. Something lives in the pump house pipes now. It drinks the current. You will need a coil to draw it out. The racing club has one as a trophy."] }], reward: { cash: 2000, xp: 500 } },
    { id: "m12", ch: 5, title: "Licence", need: { done: ["m11"], lvl: 4 }, intro: "The Keke Grand Prix trophy is an induction coil the size of a yam.", steps: [
      { t: "talk", npc: "danladi", text: "Talk to Coach Danladi at the Racing Club", say: ["danladi", "You want my trophy? Earn it. First show me you can keep three wheels on the road."] },
      { t: "ride", veh: "keke", text: "Drive a keke (level 4 licence)" },
      { t: "race", race: "r2", text: "Win the Hostel Run in a keke" }], reward: { cash: 2500, xp: 600 } },
    { id: "m13", ch: 5, title: "Keke Grand Prix", need: { done: ["m12"] }, intro: "The whole ring road. Every keke in Kanti.", steps: [
      { t: "race", race: "r3", text: "Win the Ring Road Grand Prix in a keke" },
      { t: "talk", npc: "danladi", text: "Collect the trophy", say: ["danladi", "Champion! Take the coil. And come back. There are cups for every machine, and nobody has ever won them all."], give: "coil" }], reward: { cash: 5000, xp: 800 } },
    { id: "m14", ch: 6, title: "The dam at midnight", need: { done: ["m13"], lvl: 6 }, intro: "Coil. Key. Courage. And kilishi, because Baba says even monsters get hungry.", steps: [
      { t: "buy", item: "kilishi", text: "Buy a kilishi pack at Kanti Market" },
      { t: "go", place: "dam", night: true, text: "Go to the dam at night" },
      { t: "fight", enemy: "leviathan", n: 1, at: "dam", text: "Defeat the Dam Eel (dodge the marked strikes)" },
      { t: "find", item: "core", at: "dam", text: "Pick up what it dropped" }], reward: { cash: 6000, xp: 1200 } },
    { id: "m15", ch: 7, title: "The class of your life", need: { done: ["m14"] }, intro: "Dr. Okonkwo knows what the relay core is for.", steps: [
      { t: "talk", npc: "okonkwo", text: "Show Dr. Okonkwo the relay core", say: ["okonkwo", "He has wired the Senate tower as one giant resistor to burn the whole grid as heat. This core can trip his circuit, if you understand it. Sit down."] },
      { t: "class", pass: 4, place: "ee", text: "Score 4 or more in an EE class" }], reward: { cash: 2000, xp: 900 } },
    { id: "m16", ch: 7, title: "Gather the crew", need: { done: ["m15"] }, intro: "Nobody climbs the Senate tower alone.", steps: [
      { t: "talk", npc: "sadiq", text: "Ask Sadiq", say: ["sadiq", "Me? Fight? ...Okay, but I am holding the torch."] },
      { t: "talk", npc: "sly", text: "Ask Big Sly", say: ["sly", "I told you to call me. Let's go and collect HIS tax."] },
      { t: "talk", npc: "bola", text: "Ask Bolaji", say: ["bola", "I'll draw the shades off on my board. They can't catch me."] },
      { t: "talk", npc: "emeka", text: "Ask Emeka", say: ["emeka", "If e go bad, I dey outside with engine running."] }], reward: { cash: 1500, xp: 700 } },
    { id: "m17", ch: 7, title: "Count Entropy", need: { done: ["m16"], lvl: 7 }, intro: "Tonight the Senate tower glows purple. This ends on the forecourt.", steps: [
      { t: "go", place: "senate", night: true, text: "Go to the Senate Building at night" },
      { t: "fight", enemy: "shade", n: 8, at: "senate", text: "Break through his shades" },
      { t: "fight", enemy: "entropy", n: 1, at: "senate", text: "Defeat Count Entropy" },
      { t: "emote", emote: "dance", place: "senate", text: "UP NEPA! Dance in front of the Senate (press 2)" }], reward: { cash: 20000, xp: 2500, flag: "restored" } },
    /* Semester two: the long road. These never block each other. */
    { id: "m18", ch: 8, title: "Wings", need: { done: ["m17"], lvl: 10 }, intro: "Captain Uche said level ten.", steps: [
      { t: "talk", npc: "uche", text: "Talk to Captain Uche at the Flying Club field", say: ["uche", "Throttle up on a straight road, and she lifts at about 100 km/h. Slow down over open ground to land. Never over a roof."] },
      { t: "ride", veh: "plane", text: "Take the aircraft up" },
      { t: "go", place: "market", text: "Fly over Kanti Market" }], reward: { cash: 10000, xp: 1500 } },
    /* Act two (chapters 9-10): the light is back, the school breathes, and something starts to hum. */
    { id: "m19", ch: 9, title: "Up NEPA party", need: { done: ["m18"] }, intro: "The light has stayed on for a whole week. DJ Kabiru says that calls for noise.", steps: [
      { t: "talk", npc: "kabiru", text: "Talk to DJ Kabiru at the Radio Studio", say: ["kabiru", "One week of light! We are throwing a party at Shinkafi and you, hero, are bringing the sweets."] },
      { t: "buy", item: "chocolate", text: "Buy chocolate for the party (Shinkafi or the market)" },
      { t: "emote", emote: "dance", place: "shinkafi", text: "Dance at Shinkafi (press 2)" },
      { t: "eat", text: "Eat something. Shawarma is the correct answer." }], reward: { cash: 4000, xp: 1500 } },
    { id: "m20", ch: 9, title: "Profile picture", need: { done: ["m19"] }, intro: "Ada is editing the departmental magazine and the cover is still empty.", steps: [
      { t: "talk", npc: "ada", text: "Talk to Ada at the Engineering Complex", say: ["ada", "I need four pictures of you around the school. Stand, wave, smile. Selfie Garden first, everybody starts there."] },
      { t: "emote", emote: "wave", place: "selfie", text: "Wave at the giant letters in the Selfie Garden (press 1)" },
      { t: "emote", emote: "wave", place: "geogarden", text: "Wave beside the stone globe in the Geography Garden" },
      { t: "emote", emote: "wave", place: "love", text: "Wave at the heart hedge in the Love Garden" },
      { t: "talk", npc: "ada", text: "Show Ada the pictures", say: ["ada", "Cover star! Funny thing though: in every picture my phone lost two percent. It was full this morning."] }], reward: { cash: 3500, xp: 1600 } },
    { id: "m21", ch: 9, title: "Express delivery", need: { done: ["m20"] }, intro: "Market day. Everybody wants something carried and nobody wants to wait.", steps: [
      { t: "talk", npc: "emeka", text: "Talk to Emeka at the Main Gate", say: ["emeka", "Today the whole Kanti dey order. Four runs, sharp sharp. Finish fast and the customer go add something."] },
      { t: "job", n: 4, text: "Complete 4 jobs from the gate board or your phone" },
      { t: "talk", npc: "ladi", text: "Collect your thanks from Hajiya Ladi at the market", say: ["ladi", "You are faster than network! Take this. And tell that tea seller his radio has been making noise by itself."] }], reward: { cash: 6000, xp: 1800 } },
    { id: "m22", ch: 9, title: "Senate Sprint", need: { done: ["m21"], lvl: 12 }, intro: "Coach Danladi has drawn a new route: gate to Library, straight through the heart of the school.", steps: [
      { t: "talk", npc: "danladi", text: "Talk to Coach Danladi at the Racing Club", say: ["danladi", "The Senate Sprint. Short, fast, no excuses. Win it and I put your name on the board."] },
      { t: "race", race: "r4", text: "Win the Senate Sprint (start at the Racing Club)" },
      { t: "talk", npc: "danladi", text: "Report to Coach", say: ["danladi", "Name on the board! Strange thing: every stopwatch in this club died at the same second you crossed the line."] }], reward: { cash: 7000, xp: 2000 } },
    { id: "m23", ch: 10, title: "The hum", need: { done: ["m22"] }, intro: "A low hum hangs over the Engineering Garden at night. Batteries nearby go flat by morning.", steps: [
      { t: "talk", npc: "maker", text: "Talk to the Maker beside the Tesla coil", say: ["maker", "You hear it too. My coil is switched off, yet at night it sings. Something is charging itself through it. Come back after dark."] },
      { t: "go", place: "enggarden", night: true, text: "Return to the Engineering Garden at night" },
      { t: "fight", enemy: "shade", n: 6, at: "enggarden", text: "Drive the shades away from the coil" },
      { t: "find", item: "capacitor", at: "enggarden", text: "Search the lawn for what they were guarding" }], reward: { cash: 6000, xp: 2200 } },
    { id: "m24", ch: 10, title: "Two papers, one day", need: { done: ["m23"] }, intro: "The capacitor has numbers scratched on it. Prof. Bello says you will read them after you pass his test.", steps: [
      { t: "talk", npc: "bello", text: "Talk to Prof. Bello at Physics", say: ["bello", "Charge, voltage, energy. Units, young one. Pass physics, pass mathematics, same day, then we talk."] },
      { t: "class", pass: 4, place: "physics", text: "Score 4 or more in a Physics class" },
      { t: "class", pass: 4, place: "maths", text: "Score 4 or more in a Mathematics class" },
      { t: "talk", npc: "bello", text: "Return to Prof. Bello", say: ["bello", "Good. This capacitor has stored more energy than its size allows. Somebody is saving the campus's power in small small pieces. Find where the pieces go."] }], reward: { cash: 5000, xp: 2600 } },
    { id: "m25", ch: 10, title: "Paper trail", need: { done: ["m24"] }, intro: "Somebody has been buying every battery in Kanti. Somebody signs for them.", steps: [
      { t: "talk", npc: "audu", text: "Ask Mai Shayi Audu", say: ["audu", "A boy in a purple scarf. He buys batteries with new notes, every night after the bank closes. Follow the money."] },
      { t: "go", place: "bank", night: true, text: "Watch the Bank after dark" },
      { t: "find", item: "ledger", at: "bookshop", text: "He dropped something by the Bookshop. Find it." },
      { t: "talk", npc: "kabiru", text: "Take the ledger to DJ Kabiru", say: ["kabiru", "Eight hundred batteries, delivered 'to the water'. And listen to this, my transmitter picks up the same hum every midnight. It comes from the east."] }], reward: { cash: 7000, xp: 2800 } },
    { id: "m26", ch: 10, title: "East Side Drift", need: { done: ["m25"], lvl: 15 }, intro: "The purple scarves race on the east side. Winner asks one question.", steps: [
      { t: "ride", veh: "car", text: "Get behind the wheel of a car (Racing Club)" },
      { t: "race", race: "r7", text: "Win the East Side Drift" },
      { t: "talk", npc: "kelechi", text: "Ask Kelechi what the losers said", say: ["kelechi", "They were laughing while they lost. They said the Count is not gone. He is only in pieces, waiting in the water for a full charge."] }], reward: { cash: 9000, xp: 3000 } },
    /* Act three (chapter 11): pieces of the Count. */
    { id: "m27", ch: 11, title: "What the net caught", need: { done: ["m26"] }, intro: "Baba Dam's net came up heavy last night, and it was not fish.", steps: [
      { t: "talk", npc: "baba", text: "Talk to Baba Dam at the pier", say: ["baba", "Phones. Radios. Torch batteries. Hundreds, tied in sacks under my pier. And the shadows are guarding them."] },
      { t: "go", place: "dam", night: true, text: "Come back to The Dam at night" },
      { t: "fight", enemy: "shade", n: 8, at: "dam", text: "Clear the shades off the pier" },
      { t: "find", item: "phonesack", at: "dam", text: "Pull a sack out of the shallows" },
      { t: "talk", npc: "sly", text: "Bring Big Sly his small brother's phone", say: ["sly", "Na him phone be this! ...Fresher, I owe you twice now. Anything you need, the court is behind you."] }], reward: { cash: 8000, xp: 3200 } },
    { id: "m28", ch: 11, title: "Wingman", need: { done: ["m27"] }, intro: "Sadiq has been ironing the same shirt for forty minutes.", steps: [
      { t: "talk", npc: "sadiq", text: "Talk to Sadiq at the hostel", say: ["sadiq", "Roomie, I have a date. Me! At the Love Garden. I need perfume, I need a gift, and I need you to check the bench is not broken."] },
      { t: "buy", item: "perfume", text: "Buy perfume oil at Kanti Market" },
      { t: "buy", item: "scarf", text: "Buy an Ankara scarf at Kanti Market" },
      { t: "emote", emote: "sit", place: "love", text: "Test the bench in the Love Garden (press 3)" },
      { t: "talk", npc: "sadiq", text: "Deliver everything to Sadiq", say: ["sadiq", "You are the best roommate in this school. If she says yes, the top bunk is yours. For one week."] }], reward: { cash: 4000, xp: 3000 } },
    { id: "m29", ch: 11, title: "Night market", need: { done: ["m28"] }, intro: "The purple scarves have started collecting 'battery levy' from the market traders.", steps: [
      { t: "talk", npc: "ladi", text: "Talk to Hajiya Ladi", say: ["ladi", "They take our torches, our radios, even my grandson's toy car. Last price, they said. I say no price!"] },
      { t: "fight", enemy: "bully", n: 4, at: "market", text: "Chase the levy boys out of Kanti Market" },
      { t: "job", n: 2, text: "Help the traders catch up: complete 2 jobs" },
      { t: "eat", text: "Hajiya insists you eat before you go" }], reward: { cash: 9000, xp: 3400 } },
    { id: "m30", ch: 11, title: "Signal from the sky", need: { done: ["m29"], lvl: 18 }, intro: "From the air, Captain Uche says, you can see where the lights flicker first.", steps: [
      { t: "talk", npc: "uche", text: "Talk to Captain Uche at the Flying Club", say: ["uche", "Fly my survey line: the lake, the Sculpture Garden, the mosque, then the market. Watch the lamps under you."] },
      { t: "ride", veh: "plane", text: "Take the aircraft up" },
      { t: "go", place: "dam", text: "Fly over The Dam" },
      { t: "go", place: "sculpture", text: "Fly over the Sculpture Garden" },
      { t: "go", place: "mosque", text: "Fly over the Central Mosque" },
      { t: "go", place: "market", text: "Finish over Kanti Market" }], reward: { cash: 10000, xp: 3600 } },
    { id: "m31", ch: 11, title: "The second eel", need: { done: ["m30"], lvl: 20 }, intro: "The flicker starts at the lake. Baba says the first eel had a mother.", steps: [
      { t: "buy", item: "kilishi", text: "Buy a kilishi pack at Kanti Market" },
      { t: "go", place: "dam", night: true, text: "Go to The Dam at night" },
      { t: "fight", enemy: "leviathan", n: 1, at: "dam", text: "Defeat the Mother Eel (dodge the marked strikes)" },
      { t: "find", item: "dynamo", at: "dam", text: "Pick up what she was coiled around" }], reward: { cash: 15000, xp: 4500 } },
    /* Act four (chapter 12): resonance. */
    { id: "m32", ch: 12, title: "Six plaques", need: { done: ["m31"] }, intro: "The Maker has read the dynamo. He is smiling, which is worrying.", steps: [
      { t: "talk", npc: "maker", text: "Take the dynamo to the Maker", say: ["maker", "Tesla lit lamps with no wires by matching frequency. The Count is doing it backwards: he is drinking the grid by resonance. We will build something that sings the opposite note. First, learn it."] },
      { t: "class", pass: 5, place: "ee", text: "Get all 5 right in an EE class" },
      { t: "find", item: "winding", at: "chemeng", text: "Find copper winding near Chemical Engineering" },
      { t: "find", item: "sparkgap", at: "physics", text: "Find a spark gap near Physics" },
      { t: "talk", npc: "maker", text: "Bring the parts to the Maker", say: ["maker", "Winding, gap, capacitor, dynamo. Tesla, Faraday, Maxwell, Ohm and Ampère would all nod. One thing is missing: a generator strong enough to drive it."], give: "resonator" }], reward: { cash: 12000, xp: 5000 } },
    { id: "m33", ch: 12, title: "School Marathon", need: { done: ["m32"], lvl: 24 }, intro: "First prize in the School Marathon is the Racing Club's big generator. Every rider in town has entered.", steps: [
      { t: "talk", npc: "danladi", text: "Enter with Coach Danladi", say: ["danladi", "Market to gate, the long way round the whole school. Nobody wins this by luck. Brake late. Turn early."] },
      { t: "race", race: "r8", text: "Win the School Marathon" },
      { t: "talk", npc: "danladi", text: "Collect the generator", say: ["danladi", "Champion of everything! Emeka will carry the generator. Go and finish what you started, pikin."] }], reward: { cash: 25000, xp: 6000 } },
    { id: "m34", ch: 12, title: "Everybody", need: { done: ["m33"] }, intro: "The resonator needs hands in five places at once.", steps: [
      { t: "talk", npc: "baba", text: "Ask Baba Dam to watch the water", say: ["baba", "If anything comes out of this lake tonight, it meets my paddle."] },
      { t: "talk", npc: "uche", text: "Ask Captain Uche to watch from above", say: ["uche", "I will circle with my lights on. Follow them if you get lost."] },
      { t: "talk", npc: "nkechi", text: "Ask Mama Nkechi to feed the crew", say: ["nkechi", "Nobody fights darkness on an empty stomach. Rice for everybody, on the house. Only today!"] },
      { t: "talk", npc: "kabiru", text: "Ask DJ Kabiru to stay on air", say: ["kabiru", "When you switch that thing on, I will play it on every station. The whole school will sing the note."] },
      { t: "talk", npc: "garba", text: "Tell Malam Garba it is tonight", say: ["garba", "I have kept this door for thirty years, child. Tonight I will keep it open for you."] }], reward: { cash: 8000, xp: 5000 } },
    { id: "m35", ch: 12, title: "Blackout protocol", need: { done: ["m34"], lvl: 27 }, intro: "He knows. The east side goes dark first, then the studio.", steps: [
      { t: "go", place: "fire", night: true, text: "Get to the Fire Station at night" },
      { t: "fight", enemy: "shade", n: 10, at: "fire", text: "Hold the Fire Station" },
      { t: "go", place: "radio", night: true, text: "Run to the Radio Studio" },
      { t: "fight", enemy: "shade", n: 10, at: "radio", text: "Keep Kanti FM on air" },
      { t: "talk", npc: "kabiru", text: "Check on DJ Kabiru", say: ["kabiru", "Still live! He is at the coil, fresher. I can hear him on every frequency. Go!"] }], reward: { cash: 15000, xp: 7000 } },
    { id: "m36", ch: 12, title: "Convocation night", need: { done: ["m35"], lvl: 30 }, intro: "Count Entropy, fully charged, stands on the Senate steps. Behind you, the whole school.", steps: [
      { t: "go", place: "enggarden", night: true, text: "Start the resonator at the Tesla coil, at night" },
      { t: "fight", enemy: "shade", n: 12, at: "enggarden", text: "Protect the coil while it spins up" },
      { t: "go", place: "senate", night: true, text: "Follow the lightning to the Senate" },
      { t: "fight", enemy: "entropy", n: 1, at: "senate", text: "Defeat Count Entropy, for good" },
      { t: "talk", npc: "garba", text: "Talk to Malam Garba", say: ["garba", "It is finished. The light is yours now, all of you. Go and dance, graduate."] },
      { t: "emote", emote: "dance", place: "selfie", text: "Dance under the giant letters in the Selfie Garden" }], reward: { cash: 100000, xp: 15000, flag: "graduate" } },
    { id: "g1", ch: 8, side: true, title: "Kola collector", need: { done: ["m3"] }, intro: "Someone hid 170 kola nuts around campus, twenty of them out on the Phase 2 side.", steps: [{ t: "stat", stat: "tokens", val: 25, text: "Find 25 hidden kola nuts" }], reward: { cash: 3000, xp: 500 } },
    { id: "g2", ch: 8, side: true, title: "Kola merchant", need: { done: ["g1"] }, intro: "Keep looking behind buildings.", steps: [{ t: "stat", stat: "tokens", val: 75, text: "Find 75 hidden kola nuts" }], reward: { cash: 10000, xp: 1500 } },
    { id: "g3", ch: 8, side: true, title: "Kola king", need: { done: ["g2"] }, intro: "All of them. Every last one.", steps: [{ t: "stat", stat: "tokens", val: 150, text: "Find 150 of the 170 hidden kola nuts" }], reward: { cash: 50000, xp: 6000 } },
    { id: "g4", ch: 8, side: true, title: "Dean's list", need: { done: ["m2"] }, intro: "Attend. Answer. Repeat.", steps: [{ t: "stat", stat: "classes", val: 30, text: "Attend 30 classes" }], reward: { cash: 8000, xp: 2000 } },
    { id: "g5", ch: 8, side: true, title: "First class", need: { done: ["g4"] }, intro: "The convocation gown is waiting.", steps: [{ t: "stat", stat: "classes", val: 120, text: "Attend 120 classes" }], reward: { cash: 40000, xp: 8000 } },
    { id: "g6", ch: 8, side: true, title: "Hustler", need: { done: ["m3"] }, intro: "Small small jobs build big big pockets.", steps: [{ t: "stat", stat: "jobs", val: 25, text: "Complete 25 jobs" }], reward: { cash: 8000, xp: 1500 } },
    { id: "g7", ch: 8, side: true, title: "Chairman", need: { done: ["g6"] }, intro: "Everybody in Kanti has your number.", steps: [{ t: "stat", stat: "jobs", val: 150, text: "Complete 150 jobs" }], reward: { cash: 60000, xp: 9000 } },
    { id: "g8", ch: 8, side: true, title: "Night watch", need: { done: ["m4"] }, intro: "Every blackout, they come back.", steps: [{ t: "stat", stat: "shades", val: 100, text: "Defeat 100 shades" }], reward: { cash: 10000, xp: 2500 } },
    { id: "g9", ch: 8, side: true, title: "Light of Kanti", need: { done: ["g8"] }, intro: "They whisper your name and run.", steps: [{ t: "stat", stat: "shades", val: 600, text: "Defeat 600 shades" }], reward: { cash: 80000, xp: 12000 } },
    { id: "g10", ch: 8, side: true, title: "Podium", need: { done: ["m8"] }, intro: "Every route, every machine, three cups each.", steps: [{ t: "stat", stat: "races", val: 20, text: "Win 20 different race events" }], reward: { cash: 15000, xp: 3000 } },
    { id: "g11", ch: 8, side: true, title: "Unbeaten", need: { done: ["g10"] }, intro: "Nobody has ever won them all.", steps: [{ t: "stat", stat: "races", val: 192, text: "Win all 192 race events" }], reward: { cash: 250000, xp: 30000 } },
    { id: "g12", ch: 8, side: true, title: "Heart of the campus", need: { done: ["m1"] }, intro: "A campus is its people.", steps: [{ t: "stat", stat: "besties", val: 6, text: "Become besties (80+) with 6 people" }], reward: { cash: 12000, xp: 3000 } },
    { id: "g13", ch: 8, side: true, title: "Legend of Kanti", need: { done: ["m17"] }, intro: "Level 100. They will name a road after you.", steps: [{ t: "stat", stat: "level", val: 100, text: "Reach level 100" }], reward: { cash: 1000000, xp: 0 } },
    { id: "g14", ch: 8, side: true, title: "Road warrior", need: { done: ["m3"] }, intro: "Every road in the school, twice.", steps: [{ t: "stat", stat: "km", val: 50, text: "Ride or drive 50 km" }], reward: { cash: 8000, xp: 2000 } },
    { id: "g15", ch: 8, side: true, title: "Long-distance driver", need: { done: ["g14"] }, intro: "Kano and back, without leaving campus.", steps: [{ t: "stat", stat: "km", val: 500, text: "Ride or drive 500 km" }], reward: { cash: 60000, xp: 10000 } },
    { id: "g16", ch: 8, side: true, title: "Sweet talker", need: { done: ["m2"] }, intro: "Gardens were made for two.", steps: [{ t: "stat", stat: "dates", val: 10, text: "Go on 10 dates" }], reward: { cash: 10000, xp: 3000 } },
    { id: "g17", ch: 8, side: true, title: "Staylite", need: { done: ["m2"] }, intro: "A month on campus changes a person.", steps: [{ t: "stat", stat: "days", val: 30, text: "Spend 30 days at school" }], reward: { cash: 10000, xp: 3000 } },
    { id: "g18", ch: 8, side: true, title: "Final year", need: { done: ["g17"] }, intro: "You remember when that tree was small.", steps: [{ t: "stat", stat: "days", val: 120, text: "Spend 120 days at school" }], reward: { cash: 50000, xp: 10000 } },
    { id: "g19", ch: 8, side: true, title: "Winning habit", need: { done: ["m8"] }, intro: "First place, again and again.", steps: [{ t: "stat", stat: "wins", val: 60, text: "Finish first in 60 races" }], reward: { cash: 30000, xp: 6000 } },
    { id: "g20", ch: 8, side: true, title: "Chancellor's medal", need: { done: ["m36"] }, intro: "Level 150. Nobody has stood here before.", steps: [{ t: "stat", stat: "level", val: 150, text: "Reach level 150" }], reward: { cash: 5000000, xp: 0 } }
  ];

  /* Race routes: via = place ids joined along the roads. */
  D.ROUTES = [
    { id: "r1", name: "Theatre Loop", via: ["club", "fslt", "theatre", "club"] },
    { id: "r2", name: "Hostel Run", via: ["club", "suleiman", "ribadu", "social"] },
    { id: "r3", name: "Ring Road Grand Prix", via: ["club", "ribadu", "amina", "fire", "strip", "club"] },
    { id: "r4", name: "Senate Sprint", via: ["gate", "love", "fslt", "library"] },
    { id: "r5", name: "Dam Dash", via: ["library", "education", "quarters", "dam"] },
    { id: "r6", name: "Market Madness", via: ["club", "suleiman", "gate", "market"] },
    { id: "r7", name: "East Side Drift", via: ["bookshop", "akenzua", "sculpture", "demo", "education"] },
    { id: "r8", name: "School Marathon", via: ["market", "gate", "amina", "fire", "quarters", "strip", "club", "ribadu", "gate"] }
  ];

  D.RADIO = [
    { name: "Fresh FM 99.1", style: "afro", seed: 501, o: { bpm: 108, scale: "major" }, dj: "Fresh F M, ninety-nine point one. Your school, your sound." }, { name: "Amapiano Lounge", style: "amapiano", seed: 502, o: { bpm: 112 }, dj: "Amapiano Lounge. Log drums till morning." },
    { name: "Highlife Gold", style: "funk", seed: 503, o: { bpm: 100, scale: "mixolydian" }, dj: "Highlife Gold. The classics your daddy danced to." }, { name: "Arewa Calm", style: "calm", seed: 504, o: { bpm: 84, scale: "dorian" }, dj: "Arewa Calm. Breathe." },
    { name: "Night Drive", style: "synthwave", seed: 505, o: { bpm: 104 }, dj: "Night Drive. Lights low, windows down." }, { name: "Street Breaks", style: "breaks", seed: 506, o: { bpm: 128 }, dj: "Street Breaks. Hold tight." },
    { name: "Hostel Funk 88", style: "funk", seed: 508, o: { bpm: 112, scale: "dorian" }, dj: "Hostel Funk, eighty-eight. Room to room." }, { name: "Dub Plate", style: "dub", seed: 509, o: { bpm: 86, scale: "minor" }, dj: "Dub Plate. Heavy, heavy bass." },
    { name: "Bugaje Beats", style: "afro", seed: 510, o: { bpm: 124, scale: "mixolydian" }, dj: "Bugaje Beats. From the man who built this place." }, { name: "Parade Ground", style: "march", seed: 511, o: { bpm: 116, scale: "major" }, dj: "Parade Ground. Left, right, left." },
    { name: "8-Bit Buka (secret)", style: "chip", seed: 507, o: { bpm: 132, scale: "major" }, secret: true, dj: "Eight bit buka. You found us." }
  ];

  /* Things your character says out loud. */
  D.BARKS = {
    hungry: ["Hunger wan finish me.", "I need to chop something.", "My belle is making noise."], starving: ["I never chop since. I am going to fall."],
    tired: ["My legs have resigned.", "I need to sit down small.", "Sleep is calling me."], faint: ["Ye! Everything is turning..."],
    wave: ["How far!", "Sannu!", "Good afternoon o!", "Wetin dey sup!", "Ina kwana!"], dance: ["Ayy! Gbedu don enter body!", "Dem never see anything!"],
    levelup: ["Level don rise!", "I am moving up!"], money: ["Alert!", "Credit alert don land!"], hit: ["Ye!", "Chai!", "Ah ah!"], win: ["Na we dey reign!", "Easy!"],
    ride: ["Hold body!", "Let's move!"], scared: ["Wetin be that?!", "Shadow dey waka!"], ped: ["Ah ah! Oga, look road!", "You wan kill person?!", "Driver, take am easy!", "Haba!", "Na so you dey drive?"],
    token: ["Kola nut! He who brings kola brings life."], sleep: ["Finally. My bed."], eat: ["Belle full. Life is good.", "This one sweet die."]
  };

  /* Class questions. s: ee | phys | math | chem | gen. a = index of the right option. */
  var Q = [
    ["ee", "Ohm's law says V equals", ["I × R", "I / R", "I + R", "R / I"], 0], ["ee", "The unit of electrical resistance is the", ["ohm", "volt", "farad", "henry"], 0],
    ["ee", "Two 10 Ω resistors in series give", ["20 Ω", "5 Ω", "10 Ω", "100 Ω"], 0], ["ee", "Two 10 Ω resistors in parallel give", ["5 Ω", "20 Ω", "10 Ω", "0.2 Ω"], 0],
    ["ee", "Kirchhoff's current law is a statement of conservation of", ["charge", "energy", "momentum", "flux"], 0], ["ee", "Kirchhoff's voltage law is a statement of conservation of", ["energy", "charge", "mass", "current"], 0],
    ["ee", "Power dissipated in a resistor is", ["I²R", "IR", "I/R", "R/I²"], 0], ["ee", "A 12 V battery drives 2 A. The power delivered is", ["24 W", "6 W", "14 W", "10 W"], 0],
    ["ee", "The unit of capacitance is the", ["farad", "henry", "tesla", "siemens"], 0], ["ee", "The unit of inductance is the", ["henry", "farad", "weber", "ohm"], 0],
    ["ee", "In a purely inductive AC circuit the current", ["lags the voltage by 90°", "leads the voltage by 90°", "is in phase with the voltage", "is zero"], 0],
    ["ee", "In a purely capacitive AC circuit the current", ["leads the voltage by 90°", "lags the voltage by 90°", "is in phase with the voltage", "is zero"], 0],
    ["ee", "The mains frequency in Nigeria is", ["50 Hz", "60 Hz", "100 Hz", "25 Hz"], 0], ["ee", "A transformer works on the principle of", ["mutual induction", "self heating", "electrostatic attraction", "the photoelectric effect"], 0],
    ["ee", "A step-down transformer has", ["fewer secondary turns than primary turns", "more secondary turns", "equal turns", "no core"], 0],
    ["ee", "The RMS value of a sine wave with peak 10 V is about", ["7.07 V", "5 V", "10 V", "14.1 V"], 0], ["ee", "Maximum power is transferred to a load when the load resistance equals the", ["source resistance", "zero", "infinity", "twice the source resistance"], 0],
    ["ee", "A diode conducts mainly when it is", ["forward biased", "reverse biased", "unbiased", "earthed"], 0], ["ee", "The Boolean expression A AND NOT A equals", ["0", "1", "A", "NOT A"], 0],
    ["ee", "The binary number 1010 in decimal is", ["10", "8", "12", "5"], 0], ["ee", "A fuse protects a circuit against", ["excess current", "low voltage", "low frequency", "high resistance"], 0],
    ["ee", "Power factor is the cosine of the angle between", ["voltage and current", "power and energy", "resistance and reactance only in DC", "flux and speed"], 0],
    ["ee", "1 kWh is equal to", ["3.6 MJ", "1000 J", "3600 J", "36 kJ"], 0], ["ee", "Thevenin's theorem replaces a network with", ["a voltage source in series with a resistance", "a current source in series with a resistance", "two voltage sources", "a single capacitor"], 0],
    ["phys", "The SI unit of force is the", ["newton", "joule", "watt", "pascal"], 0], ["phys", "Acceleration due to gravity near the Earth's surface is about", ["9.8 m/s²", "98 m/s²", "0.98 m/s²", "8.9 m/s²"], 0],
    ["phys", "Newton's second law is", ["F = ma", "F = mv", "F = m/a", "F = mg²"], 0], ["phys", "Momentum is the product of mass and", ["velocity", "acceleration", "force", "distance"], 0],
    ["phys", "Kinetic energy is", ["½mv²", "mv", "mgh", "½mv"], 0], ["phys", "The speed of light in vacuum is about", ["3 × 10⁸ m/s", "3 × 10⁶ m/s", "3 × 10⁵ km/h", "3 × 10¹⁰ m/s"], 0],
    ["phys", "Work done is force multiplied by", ["distance moved in the direction of the force", "time", "mass", "velocity"], 0], ["phys", "The SI unit of power is the", ["watt", "joule", "newton", "volt"], 0],
    ["phys", "A projectile has its maximum range (level ground, no air) at a launch angle of", ["45°", "30°", "60°", "90°"], 0], ["phys", "Like charges", ["repel", "attract", "cancel", "merge"], 0],
    ["phys", "Coulomb's force between two charges varies with distance r as", ["1/r²", "1/r", "r²", "r"], 0], ["phys", "For a wave, speed equals frequency times", ["wavelength", "amplitude", "period", "phase"], 0],
    ["phys", "Snell's law relates angles of", ["refraction", "reflection only", "diffraction", "polarisation"], 0], ["phys", "The SI unit of pressure is the", ["pascal", "newton", "bar", "joule"], 0],
    ["phys", "An object in uniform circular motion accelerates towards the", ["centre", "tangent", "outside", "direction of motion"], 0], ["phys", "Lenz's law gives the induced current's", ["direction", "frequency", "colour", "mass"], 0],
    ["math", "The derivative of x² is", ["2x", "x", "x³/3", "2"], 0], ["math", "The integral of 2x dx is", ["x² + C", "2 + C", "x + C", "2x² + C"], 0],
    ["math", "sin²θ + cos²θ equals", ["1", "0", "2", "tan θ"], 0], ["math", "The derivative of sin x is", ["cos x", "−cos x", "−sin x", "tan x"], 0],
    ["math", "log₁₀ 1000 equals", ["3", "2", "10", "100"], 0], ["math", "The roots of x² − 5x + 6 = 0 are", ["2 and 3", "1 and 6", "−2 and −3", "5 and 6"], 0],
    ["math", "The determinant of the 2×2 identity matrix is", ["1", "0", "2", "−1"], 0], ["math", "j² (the imaginary unit squared) equals", ["−1", "1", "j", "0"], 0],
    ["math", "The derivative of eˣ is", ["eˣ", "x eˣ⁻¹", "ln x", "1/x"], 0], ["math", "The sum of the angles in a triangle is", ["180°", "360°", "90°", "270°"], 0],
    ["math", "A matrix with 2 rows and 3 columns has how many elements?", ["6", "5", "3", "2"], 0], ["math", "The slope of the line y = 3x + 2 is", ["3", "2", "5", "1/3"], 0],
    ["math", "7! / 6! equals", ["7", "42", "1", "13"], 0], ["math", "The magnitude of 3 + 4j is", ["5", "7", "1", "25"], 0],
    ["chem", "The chemical symbol for sodium is", ["Na", "S", "So", "N"], 0], ["chem", "The pH of pure water at 25 °C is", ["7", "0", "14", "1"], 0],
    ["chem", "Avogadro's number is about", ["6.02 × 10²³", "6.02 × 10²⁰", "3.14 × 10²³", "1.6 × 10⁻¹⁹"], 0], ["chem", "The most abundant gas in air is", ["nitrogen", "oxygen", "carbon dioxide", "argon"], 0],
    ["chem", "An atom's atomic number is its number of", ["protons", "neutrons", "nucleons", "shells"], 0], ["chem", "Copper is widely used for wiring because it is a good", ["conductor", "insulator", "semiconductor", "magnet"], 0],
    ["chem", "The chemical formula of water is", ["H₂O", "HO₂", "H₂O₂", "OH"], 0], ["chem", "Silicon is a", ["semiconductor", "noble gas", "halogen", "alkali metal"], 0],
    ["gen", "Nigeria's capital city is", ["Abuja", "Lagos", "Kano", "Ibadan"], 0], ["gen", "Nigeria became independent in", ["1960", "1963", "1970", "1914"], 0],
    ["gen", "Which of these is a Nigerian state?", ["Plateau", "Ashanti", "Darfur", "Katanga"], 0], ["gen", "The capital of Nigeria is", ["Abuja", "Lagos", "Kaduna", "Ibadan"], 0],
    ["gen", "Nigeria became independent in", ["1960", "1963", "1957", "1970"], 0], ["gen", "A CGPA of 4.50 and above (5-point scale) is a", ["first class", "second class upper", "second class lower", "third class"], 0],
    ["gen", "Which of these is a good way to cite someone's work?", ["Name the source", "Copy it quietly", "Change two words", "Remove the author"], 0], ["gen", "The River Niger meets the River Benue at", ["Lokoja", "Onitsha", "Jebba", "Yola"], 0],
    ["gen", "One naira is divided into", ["100 kobo", "10 kobo", "1000 kobo", "50 kobo"], 0], ["gen", "A good summary of a text should be", ["shorter and in your own words", "longer than the text", "a copy of the first page", "only the title"], 0],
    ["gen", "Which is a renewable source of energy?", ["Solar", "Coal", "Diesel", "Natural gas"], 0], ["gen", "The longest river in Nigeria is the", ["Niger", "Benue", "Kaduna", "Ogun"], 0]
  ];
  D.QUESTIONS = Q.map(function (q, i) { return { id: "q" + i, s: q[0], q: q[1], o: q[2], a: q[3] }; });
  D.SUBJECTS = { ee: "Electrical engineering", phys: "Physics", math: "Mathematics", chem: "Chemistry", gen: "General studies" };
  /* First names for walkers, classmates, shopkeepers, leaderboards and anyone new. The owner's friends come first, as
     friendly cameos: a first name only, nothing else about them. D.NAMES is the whole list; D.NAMES.m, .f and .n
     split it where the name makes that obvious (n = either). S.nameFor(D.NAMES, seed, sex) picks a stable one. */
  D.NAMES = (function () {
    var m = ["Ahmad", "Jega", "Mubarak", "Muktar", "Muhammad", "Ibrahim", "Hassan", "Abdul", "Abbas", "Auwal", "Aminu", "Micheal", "Shamsu", "Aliyu", "Basit",
        "Chinedu", "Tobi", "Emeka", "Segun", "Danjuma", "Kelvin", "Uche", "Femi", "Nnamdi", "Yusuf", "Bashir", "Obinna", "Kunle", "Ifeanyi", "Sani", "Kwame", "Kofi", "Tariq", "Omar", "Diego", "Mateo", "Arjun", "Wei", "Jin", "Lukas", "Pierre", "Daniel", "Samuel", "David"],
      f = ["Maryam", "Firdausi", "Lyzzy", "Joy", "Sadiya", "Amina", "Fatima", "Lily", "Aisha", "Asiya", "Khadija", "Bilkisu", "Clemantine", "Svitlana", "Jasmin",
        "Chioma", "Ngozi", "Halima", "Zainab", "Funke", "Adaeze", "Hauwa", "Temi", "Ifeoma", "Rahma", "Nafisa", "Kemi", "Blessing", "Amara", "Hadiza", "Ama", "Leila", "Noor", "Sofia", "Priya", "Mei", "Yuna", "Elena", "Chloe", "Grace", "Ruth", "Esther"],
      n = ["Sugar", "Lucky", "Sunny", "Favour", "Kelechi", "Bolaji", "Tolu", "Sam", "Alex", "Ari"], all = m.concat(f, n);
    all.m = m; all.f = f; all.n = n; return all;
  })();

  /* ---------- wardrobe ----------
     Everything a student can wear. Every item is modest by rule: nothing above the knee, nothing tight, nothing
     see-through (S.modest checks it and the tests enforce it). The brands are invented for the game.
     Colours: "#hex" or a print "ankara|#a|#b", "adire|#a|#b", "stripe|#a|#b", "check|#a|#b". */
  D.BRANDS = [
    { id: "mib", name: "MIB", line: "The M.I. BUGAJE signature line. White, gold, made to last.", col: "#ffffff", ink: "#b8860b", shape: "crest", glyph: "MIB" },
    { id: "dashr", name: "DASHR", line: "Sportswear for people who run for the bus.", col: "#ef4444", ink: "#ffffff", shape: "bolt", glyph: "D" },
    { id: "indigo", name: "Indigo Yard", line: "Denim and everyday basics.", col: "#1e3a8a", ink: "#e0e7ff", shape: "square", glyph: "IY" },
    { id: "tela", name: "Tela Sarki", line: "Native wear, cut by the king's tailor.", col: "#7c2d12", ink: "#fde68a", shape: "diamond", glyph: "TS" },
    { id: "haske", name: "Haske", line: "Modest fashion: abayas, gowns and scarves.", col: "#0f766e", ink: "#ccfbf1", shape: "arch", glyph: "H" },
    { id: "bds", name: "Bend-Down Select", line: "The thrift stall. Everything has a story.", col: "#a16207", ink: "#fef9c3", shape: "tag", glyph: "BDS" },
    { id: "gani", name: "Gani Optics", line: "Frames and shades. 'Gani' means 'see'.", col: "#111827", ink: "#fbbf24", shape: "ring", glyph: "G" },
    { id: "takalmi", name: "Takalmi Works", line: "Shoes for every road in the school.", col: "#4d7c0f", ink: "#f7fee7", shape: "sole", glyph: "T" },
    { id: "lantern", name: "Lantern Lane", line: "Asian-inspired jackets and tunics.", col: "#b91c1c", ink: "#fef2f2", shape: "circle", glyph: "LL" },
    { id: "coop", name: "Campus Co-op", line: "Lab coats, gowns, ID lanyards, school colours.", col: "#065f46", ink: "#ecfdf5", shape: "shield", glyph: "CC" }
  ];
  D.HAIRS = [["low", "Low cut"], ["fade", "Fade"], ["bald", "Clean shave"], ["waves", "Waves"], ["afro", "Small afro"], ["afrobig", "Big afro"], ["coily", "Coily curls"], ["cornrows", "Cornrows"], ["twists", "Twists"], ["braidshort", "Short braids"], ["braids", "Long braids"], ["locs", "Locs"], ["bun", "Bun"], ["ponytail", "Ponytail"], ["puff", "Puff"]];
  D.HAIR_COLS = ["#1a1210", "#2b1b12", "#4a2c17", "#6b3f1d", "#8d99a6", "#7c2d12", "#b45309"];
  D.BEARDS = [["", "Clean"], ["moustache", "Moustache"], ["goatee", "Goatee"], ["full", "Full beard"]];
  D.BROWS = [["flat", "Straight brows"], ["arch", "Arched brows"], ["thick", "Thick brows"]];
  D.EYES = [["round", "Round eyes"], ["wide", "Wide eyes"], ["calm", "Calm eyes"]];
  D.WARD_SLOTS = [["head", "Headwear"], ["eye", "Glasses"], ["top", "Top"], ["bottom", "Bottom"], ["one", "Full outfit"], ["outer", "Jacket"], ["shoes", "Shoes"], ["acc", "Extras"]];
  D.WARDROBE = (function () {
    var out = [], NEU = ["#f8fafc", "#111827", "#1e3a8a", "#7c2d12", "#065f46", "#6b7280"], BRIGHT = ["#ef4444", "#2563eb", "#16a34a", "#f59e0b", "#a855f7", "#0ea5e9"], EARTH = ["#f5f0e1", "#d6c7a1", "#8b5e34", "#3f6212", "#1f2937"], PRINT = ["ankara|#f59e0b|#1d4ed8", "ankara|#dc2626|#fde047", "ankara|#16a34a|#f97316", "adire|#1e3a8a|#dbeafe", "adire|#312e81|#a5b4fc"], DENIM = ["#1e3a5f", "#27446b", "#111827", "#64748b"];
    // id, name, slot, kind, brand, price, level, colours, extra
    function W(id, name, slot, kind, brand, price, lvl, cols, x) { var it = { id: id, name: name, slot: slot, kind: kind, brand: brand, price: price, lvl: lvl || 1, cols: cols, fit: "regular", modest: true }; if (slot === "bottom" || slot === "one") it.len = "ankle"; if (x) Object.keys(x).forEach(function (k) { it[k] = x[k]; }); out.push(it); }
    /* headwear */
    W("kufi", "Kufi cap", "head", "kufi", "tela", 600, 1, ["#f8fafc", "#111827", "#7dd3fc", "#a16207", "adire|#1e3a8a|#dbeafe"]);
    W("fila", "Fila", "head", "fila", "tela", 900, 2, ["#7c2d12", "#1e3a8a", "ankara|#16a34a|#f97316", "#f5f0e1"], { sex: "m" });
    W("zanna", "Embroidered tall cap", "head", "zanna", "tela", 1800, 4, ["check|#f8fafc|#b91c1c", "check|#f8fafc|#1d4ed8", "check|#fef3c7|#065f46"], { sex: "m" });
    W("ballcap", "Baseball cap", "head", "baseball", "dashr", 700, 1, BRIGHT.concat(["#111827", "#f8fafc"]));
    W("bucket", "Bucket hat", "head", "bucket", "bds", 500, 1, EARTH.concat(["adire|#1e3a8a|#dbeafe"]));
    W("beanie", "Beanie", "head", "beanie", "indigo", 500, 1, NEU);
    W("turban", "Turban", "head", "turban", "tela", 1500, 3, ["#f8fafc", "#1e3a8a", "#065f46", "#111827"], { sex: "m" });
    W("gele", "Gele", "head", "gele", "haske", 2200, 3, ["ankara|#dc2626|#fde047", "ankara|#f59e0b|#1d4ed8", "#be185d", "#0f766e", "#b8860b"], { sex: "f" });
    W("hijab", "Hijab", "head", "hijab", "haske", 800, 1, ["#7c3aed", "#0e7490", "#be123c", "#0f766e", "#f8fafc", "#111827"], { sex: "f" });
    W("hijablong", "Long hijab", "head", "hijablong", "haske", 1200, 2, ["#1d4ed8", "#111827", "#f5f0e1", "#9d174d", "#065f46"], { sex: "f" });
    W("scarf", "Headscarf", "head", "scarf", "bds", 400, 1, PRINT.concat(["#f59e0b"]), { sex: "f" });
    W("gradcap", "Graduation cap", "head", "grad", "coop", 2500, 25, ["#111827", "#1e3a8a"]);
    W("mibcap", "MIB signature cap", "head", "kufi", "mib", 4000, 5, ["#ffffff", "#fde047"]);
    /* eyewear */
    W("roundg", "Round frames", "eye", "round", "gani", 1500, 1, ["#111827", "#b8860b", "#7c2d12"]);
    W("squareg", "Square frames", "eye", "square", "gani", 1500, 1, ["#111827", "#1e3a8a", "#6b7280"]);
    W("pilot", "Pilot frames", "eye", "aviator", "gani", 2500, 4, ["#b8860b", "#9ca3af"]);
    W("shades", "Sunshades", "eye", "sun", "gani", 2000, 2, ["#111827", "#7c2d12", "#1e3a8a"]);
    W("readers", "Reading glasses", "eye", "reading", "gani", 1000, 1, ["#6b7280", "#111827"]);
    W("mibshades", "MIB gold shades", "eye", "sun", "mib", 8000, 8, ["#b8860b"]);
    /* tops */
    W("tee", "T-shirt", "top", "tee", "indigo", 800, 1, BRIGHT.concat(NEU));
    W("stripetee", "Striped T-shirt", "top", "tee", "bds", 600, 1, ["stripe|#f8fafc|#1e3a8a", "stripe|#f8fafc|#dc2626", "stripe|#fde68a|#16a34a", "stripe|#111827|#f59e0b"]);
    W("polo", "Polo shirt", "top", "polo", "indigo", 1400, 1, NEU.concat(BRIGHT));
    W("shirt", "Long-sleeve shirt", "top", "shirt", "indigo", 1800, 2, ["#f8fafc", "#bfdbfe", "#fecdd3", "check|#f8fafc|#2563eb", "check|#fef3c7|#b91c1c"]);
    W("hoodie", "Hoodie", "top", "hoodie", "dashr", 3000, 3, ["#111827", "#6b7280", "#1e3a8a", "#7c2d12", "#065f46", "#ef4444"]);
    W("jersey", "Football jersey", "top", "jersey", "dashr", 2500, 2, ["#16a34a", "#ef4444", "#2563eb", "#f59e0b", "stripe|#f8fafc|#065f46", "stripe|#111827|#dc2626"]);
    W("sweater", "Sweater", "top", "sweater", "bds", 1200, 1, EARTH.concat(["#7c2d12"]));
    W("dashiki", "Dashiki", "top", "dashiki", "tela", 2800, 2, PRINT);
    W("ankaratop", "Ankara shirt", "top", "shirt", "tela", 2400, 2, PRINT);
    W("senator", "Senator top", "top", "senator", "tela", 4500, 5, ["#1f2937", "#1e3a8a", "#7c2d12", "#f5f0e1", "#065f46"]);
    W("kaftantop", "Short kaftan top", "top", "senator", "tela", 3200, 3, ["#f8fafc", "#bae6fd", "#fde68a", "#d6c7a1"]);
    W("kurta", "Long tunic (kurta)", "top", "kurta", "lantern", 3000, 3, ["#f5f0e1", "#fde68a", "#0f766e", "#9d174d", "adire|#1e3a8a|#dbeafe"]);
    W("tang", "Mandarin-collar jacket", "top", "tang", "lantern", 4200, 4, ["#b91c1c", "#1e3a8a", "#111827", "#065f46", "#b8860b"]);
    W("wrapjkt", "Wrap jacket", "top", "wrap", "lantern", 3800, 4, ["#f5f0e1", "#1e3a8a", "#be185d", "#3f6212", "check|#f8fafc|#6b7280"]);
    W("longtunic", "Long tunic", "top", "kurta", "haske", 2600, 2, ["#f8fafc", "#fecdd3", "#ccfbf1", "#ddd6fe", "#111827"], { sex: "f" });
    W("mibtee", "MIB gold-trim tee", "top", "tee", "mib", 5000, 5, ["#ffffff", "#111827"], { trim: "#fde047" });
    W("fslgtee", "{{GAME_INITIALS}} school tee", "top", "tee", "mib", 2000, 1, ["#065f46", "#f8fafc", "#f59e0b"], { merch: true });
    W("mibcustom", "MIB custom-text shirt", "top", "tee", "mib", 6000, 3, ["#ffffff", "#111827", "#065f46", "#1e3a8a", "#b91c1c"], { custom: true, note: "Your own words on the chest, up to 12 letters." });
    W("mibpolo", "MIB polo", "top", "polo", "mib", 7000, 8, ["#ffffff", "#fde047", "#111827"], { trim: "#b8860b" });
    /* bottoms: all reach the knee or lower */
    W("trousers", "Trousers", "bottom", "trousers", "indigo", 1800, 1, ["#1f2937", "#374151", "#3b2f2f", "#1e3a5f", "#f5f0e1"]);
    W("jeans", "Jeans", "bottom", "jeans", "indigo", 2500, 1, DENIM);
    W("chinos", "Chinos", "bottom", "trousers", "indigo", 2200, 2, ["#d6c7a1", "#8b5e34", "#3f6212", "#1f2937"]);
    W("joggers", "Joggers", "bottom", "joggers", "dashr", 2000, 1, ["#111827", "#6b7280", "#1e3a8a", "#7c2d12"], { fit: "loose" });
    W("longshorts", "Knee-length shorts", "bottom", "shorts", "dashr", 1200, 1, ["#111827", "#1e3a8a", "#d6c7a1", "#065f46"], { len: "knee", fit: "loose" });
    W("longskirt", "Long skirt", "bottom", "skirt", "haske", 2400, 1, ["#111827", "#1e3a8a", "#7c2d12", "#0f766e", "check|#f8fafc|#6b7280"], { sex: "f", fit: "loose" });
    W("wrapper", "Wrapper", "bottom", "skirt", "tela", 2600, 2, PRINT, { sex: "f", fit: "loose" });
    W("sokoto", "Native trousers", "bottom", "trousers", "tela", 2000, 2, ["#f8fafc", "#bae6fd", "#1f2937", "#7c2d12", "#d6c7a1"], { fit: "loose" });
    W("mibtrousers", "MIB tailored trousers", "bottom", "trousers", "mib", 6000, 5, ["#ffffff", "#111827", "#b8860b"]);
    /* full outfits */
    W("kaftan", "Kaftan set", "one", "kaftan", "tela", 6000, 3, ["#f8fafc", "#bae6fd", "#fde68a", "#1f2937", "#7c2d12", "#d6c7a1"], { len: "calf", fit: "loose" });
    W("agbada", "Agbada", "one", "agbada", "tela", 15000, 10, ["#f8fafc", "#1e3a8a", "#7c2d12", "#b8860b", "adire|#1e3a8a|#dbeafe"], { fit: "loose", sex: "m" });
    W("jalabiya", "Jalabiya", "one", "jalabiya", "tela", 5000, 2, ["#f8fafc", "#e5e7eb", "#d6c7a1", "#bae6fd", "#1f2937"], { fit: "loose", sex: "m" });
    W("abaya", "Abaya", "one", "abaya", "haske", 7000, 3, ["#111827", "#1e3a8a", "#4c1d95", "#065f46", "#7c2d12", "#6b7280"], { fit: "loose", sex: "f" });
    W("gown", "Long gown", "one", "gown", "haske", 5500, 2, ["#be185d", "#0f766e", "#1d4ed8", "ankara|#dc2626|#fde047", "ankara|#f59e0b|#1d4ed8"], { fit: "loose", sex: "f" });
    W("native", "Blouse and wrapper", "one", "native", "tela", 8000, 4, PRINT, { fit: "loose", sex: "f" });
    W("khaki", "Service-year khaki", "one", "khaki", "coop", 4000, 40, ["#a39160"], { len: "ankle" });
    W("gradgown", "Graduation gown", "one", "grad", "coop", 9000, 25, ["#111827", "#1e3a8a", "#7c2d12"], { fit: "loose" });
    W("mibkaftan", "MIB white kaftan", "one", "kaftan", "mib", 25000, 10, ["#ffffff", "#fde047"], { len: "calf", fit: "loose", trim: "#fde047" });
    W("makerkaftan", "The Maker's kaftan", "one", "kaftan", "mib", 0, 1, ["#ffffff"], { len: "calf", fit: "loose", trim: "#fde047", locked: "bugaje" });
    /* jackets */
    W("blazer", "Blazer", "outer", "blazer", "indigo", 6000, 5, ["#111827", "#1e3a8a", "#6b7280", "#7c2d12", "#d6c7a1"]);
    W("labcoat", "Lab coat", "outer", "labcoat", "coop", 3000, 1, ["#f8fafc"]);
    W("cardigan", "Cardigan", "outer", "cardigan", "bds", 1500, 1, EARTH.concat(["#9d174d"]));
    W("trackjkt", "Track jacket", "outer", "jacket", "dashr", 3500, 3, ["#111827", "#ef4444", "#2563eb", "#16a34a", "stripe|#111827|#f8fafc"]);
    W("mibblazer", "MIB gold-button blazer", "outer", "blazer", "mib", 20000, 12, ["#ffffff", "#111827"], { trim: "#fde047" });
    /* shoes */
    W("sneaklow", "Low sneakers", "shoes", "low", "takalmi", 3000, 1, ["#f8fafc", "#111827", "#dc2626", "#2563eb", "#f59e0b", "#16a34a"]);
    W("sneakhigh", "High-top sneakers", "shoes", "high", "takalmi", 4000, 3, ["#f8fafc", "#111827", "#dc2626", "#7c3aed"]);
    W("sandals", "Leather sandals", "shoes", "sandal", "takalmi", 1500, 1, ["#8b5e34", "#3b2a1a", "#111827"]);
    W("palms", "Palm slippers", "shoes", "slipper", "takalmi", 1200, 1, ["#3b2a1a", "#8b5e34", "#f5f0e1", "#111827"]);
    W("loafers", "Loafers", "shoes", "loafer", "takalmi", 4500, 4, ["#3b2a1a", "#111827", "#7c2d12"]);
    W("boots", "Boots", "shoes", "boot", "takalmi", 5000, 4, ["#3b2a1a", "#111827", "#8b5e34"]);
    W("footy", "Football boots", "shoes", "footy", "dashr", 4000, 2, ["#111827", "#f8fafc", "#ef4444", "#22d3ee"]);
    W("blockheel", "Low block heels", "shoes", "heel", "haske", 3500, 3, ["#111827", "#7c2d12", "#be185d", "#f5f0e1"], { sex: "f" });
    W("flats", "Flats", "shoes", "flat", "haske", 2000, 1, ["#111827", "#f5f0e1", "#be185d", "#1e3a8a"], { sex: "f" });
    W("bathslip", "Rubber slippers", "shoes", "slipper", "bds", 300, 1, ["#2563eb", "#16a34a", "#dc2626", "#111827"]);
    W("mibsneak", "MIB white-gold sneakers", "shoes", "low", "mib", 12000, 8, ["#ffffff"], { trim: "#fde047" });
    /* extras */
    W("chain", "Neck chain", "acc", "chain", "bds", 1500, 2, ["#b8860b", "#9ca3af"]);
    W("beads", "Coral beads", "acc", "beads", "tela", 3000, 4, ["#dc2626", "#f97316", "#0f766e"]);
    W("watch", "Wristwatch", "acc", "watch", "gani", 3500, 3, ["#111827", "#b8860b", "#9ca3af"]);
    W("bracelet", "Bracelet", "acc", "bracelet", "bds", 600, 1, ["#b8860b", "#16a34a", "#dc2626", "#111827"]);
    W("backpack", "Backpack", "acc", "backpack", "indigo", 3000, 1, ["#111827", "#1e3a8a", "#dc2626", "#065f46", "#f59e0b"]);
    W("tote", "Tote bag", "acc", "tote", "bds", 900, 1, ["#f5f0e1", "ankara|#f59e0b|#1d4ed8", "adire|#1e3a8a|#dbeafe"]);
    W("tasbih", "Prayer beads", "acc", "tasbih", "tela", 500, 1, ["#8b5e34", "#065f46", "#111827"]);
    W("lanyard", "ID lanyard", "acc", "lanyard", "coop", 300, 1, ["#065f46", "#1e3a8a", "#dc2626"]);
    W("mibchain", "MIB gold chain", "acc", "chain", "mib", 15000, 10, ["#fde047"]);
    W("fslgbag", "{{GAME_INITIALS}} backpack", "acc", "backpack", "mib", 4500, 1, ["#065f46", "#f8fafc"], { merch: true });
    return out;
  })();
  /* Which brands each shop carries. Unknown shop ids get two brands picked from their name. */
  D.WARD_STORES = { mib: ["mib"], mibstore: ["mib"], market: ["tela", "bds", "takalmi"], bookshop: ["coop", "gani"], shinkafi: ["dashr", "indigo"], social: ["dashr"], thrift: ["bds"], tailor: ["tela"], modest: ["haske"], optics: ["gani"], shoes: ["takalmi"], lantern: ["lantern"], denim: ["indigo"], sport: ["dashr"], coop: ["coop"] };
  /* Ready-made outfits: the starter sets in the creator, the screenshot line-up, and signature looks for named people.
     Values are "item.colourIndex". */
  D.FITS = {
    casual: { top: "tee.1", bottom: "jeans.0", shoes: "sneaklow.0" },
    smart: { top: "shirt.0", bottom: "chinos.0", shoes: "loafers.0" },
    sporty: { top: "jersey.0", bottom: "joggers.0", shoes: "footy.0" },
    native: { one: "kaftan.1", head: "kufi.0", shoes: "palms.0" },
    modest: { one: "abaya.0", head: "hijab.1", shoes: "flats.0" },
    ankara: { one: "native.0", head: "gele.0", shoes: "blockheel.0" },
    agbada: { one: "agbada.1", head: "fila.1", shoes: "loafers.0" }, jalabiya: { one: "jalabiya.0", head: "turban.0", shoes: "sandals.0" },
    hoodie: { top: "hoodie.0", bottom: "jeans.1", shoes: "sneakhigh.0", acc: ["backpack.1"] }, blazer: { top: "shirt.0", outer: "blazer.1", bottom: "trousers.0", shoes: "loafers.1", eye: "squareg.0" },
    kurta: { top: "kurta.2", bottom: "sokoto.0", shoes: "sandals.1" }, tang: { top: "tang.0", bottom: "trousers.0", shoes: "loafers.1" },
    lab: { top: "polo.2", outer: "labcoat.0", bottom: "trousers.1", shoes: "sneaklow.1", eye: "roundg.0", acc: ["lanyard.0"] }, grad: { one: "gradgown.0", head: "gradcap.0", shoes: "loafers.1" },
    maker: { one: "makerkaftan.0", shoes: "palms.2", acc: ["mibchain.0"] }
  };
  D.STARTERS = [["casual", "Campus casual"], ["smart", "Smart"], ["sporty", "Sporty"], ["native", "Kaftan"], ["modest", "Abaya and hijab"], ["ankara", "Blouse and wrapper"]];
  return D;
});
