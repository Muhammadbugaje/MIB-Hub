"""Hand-written words for the voice scripts: who each character is, and what each mission is about.

Nothing here is read by the game. `build_voice_scripts.py` uses it to make the scripts friendly for the
people recording: a cover name, a one-line tagline, a short "who you are" and, optionally, a voice note
that replaces the one in the bark pack. Edit freely and rebuild.
"""

# cast id: (name on the cover, tagline, who they are, optional voice note)
CHARACTERS = {
    "npc.abbas": ("Abbas", "His name is Abbas. The whole campus has agreed to call him John Carter.",
                  "An Electrical Engineering student who fixes anything with an engine and reads the world like a meter. "
                  "Patient, exact and impossible to rush. He corrects the nickname every single time, and it has never once worked."),
    "npc.aleeya": ("Aleeya", "The sweetest voice on campus, attached to the deadliest punchline.",
                   "An Architecture student who holds your bag, holds your place in the queue, and then describes you so "
                   "accurately that you need to sit down. Everybody's favourite person. Secretly writes stand-up."),
    "npc.aliyu": ("Engr. Aliyu", "A decent man, one envelope, and five years of sighing about it.",
                  "The university's works engineer, nicknamed \"Change-Over\" because he is the man who switches the campus "
                  "from mains to generator. Tired, kind and carrying a secret that is heavier than his toolbox."),
    "npc.aminu": ("Aminu", "Nine years old, front row, and already running the class.",
                  "A Primary 4 pupil at the Demonstration School, known as \"Small Sadiq\". He tests every new teacher, "
                  "asks the question nobody wants asked, and then hands you a drawing that changes the whole story.",
                  "A boy of about nine. Bright, cheeky, completely fearless with adults. Fast when he is winning, very "
                  "serious when something matters."),
    "npc.baba_dam": ("Baba Dam", "Fish don't hurry. Neither does he.",
                     "The old fisherman of the dam outside campus. He has a boat, a biscuit tin and all the time in the "
                     "world, and he says more with a pause than most lecturers say in a semester."),
    "npc.baba_porter": ("Baba Porter", "Sign here. And here. And don't lose it.",
                        "Mr. Okon, the hall porter, has seen every kind of fresher there is and has a ledger entry for "
                        "each of them. Gruff on the outside. On the inside, the reason the whole story starts."),
    "npc.bature": ("Bature", "Eats your garri, steals your jokes, and somehow tops two courses.",
                   "The roommate, when the player is male. A Mass Communication student and the clown of the room, who "
                   "hides every feeling he has inside a riddle. Away from his own face, on late-night radio, he turns out "
                   "to be very good indeed. You record the roommate's lines and Bature's own.",
                   "Male, about twenty. Fast and warm, the clown of the room. Opens with \"Riddle me this\", narrates life "
                   "like bad breaking news, counts stairs aloud. On the radio his voice drops: warm, calm and good. The "
                   "roommate's lines never say anything about being a boy or a girl, because Firdausi records them too."),
    "npc.big_baby": ("Big Baby", "Tiny. Terrifying. Adored.",
                     "She owns the salon in the market and the heart of the biggest man on campus. She has never raised "
                     "her voice, because one word from her does the work of a speech. That word is usually \"Bolaji.\""),
    "npc.bilkisu": ("Sgt. Bilkisu", "A whistle first. Then words. Then you're in trouble.",
                    "Head of campus security, known as \"Madam Whistle\". Fierce and fair, and nothing gets past her gate. "
                    "She also secretly washes the football captain's socks, and will deny it under oath."),
    "npc.bolaji": ("Bolaji", "Big Sly charges a fresher tax. Bolaji gives you the money back.",
                   "The biggest man on campus, who calls himself \"Sly\" and stands on the basketball court collecting two "
                   "hundred naira from freshers, with receipts. Under the big chest is a small soft heart, and over five "
                   "years it wins. Court boss, then barber, then mechanic, then the friend who turns up at 05:55."),
    "npc.dad": ("Dad", "Sends money. Attaches a lecture. Means \"I'm proud of you.\"",
                "The player's father, a retired accountant, heard mostly on the phone. Every transfer comes with a speech "
                "that begins \"When I was your age\". He is certain this is not the main gate. It is the main gate."),
    "npc.danladi": ("Coach Danladi", "Shouts in proverbs. Loves in laps.",
                    "The football coach. A whistle round his neck, a proverb for every mistake, and a heart he keeps well "
                    "hidden behind the touchline. \"Pass! Is the ball your inheritance?\""),
    "npc.dr_minus": ("Dr. Minus", "Good morning. Minus two.",
                     "Dr. Dangana, a Law lecturer who takes marks off the way other men clear their throats. He is not "
                     "cruel. He was failed unfairly once, a long time ago, and decided that must be how standards work."),
    "npc.emily": ("Emily", "Answers all bad news with one word: \"Strawberry?\"",
                  "A Crop Science student whose family grows strawberries beyond New Site. Always running, always slightly "
                  "out of breath, always cheerful, and unable to walk past a sad person without feeding them."),
    "npc.faty": ("Faty", "One joke a year. Written down. In pencil.",
                 "Half of the funniest married couple in the game. Her husband Lula tells the stories; she corrects them, "
                 "lovingly, and keeps the joke book. Nobody has ever been told what is on page nine."),
    "npc.firdausi": ("Firdausi", "Names the lizards. Runs your life. Says it's for your own good.",
                     "The roommate, when the player is female. A Microbiology student who wants to be a doctor, with an "
                     "electric fish in a tank and an opinion about everything you eat. You record the roommate's lines and "
                     "Firdausi's own.",
                     "Female, about nineteen. Brisk, teasing and protective. \"Oya\" to get people moving, \"Fidowsi!\" when "
                     "she is cross with herself. As the roommate she is the clown of the room: \"Riddle me this\", life "
                     "narrated like bad breaking news, stairs counted aloud. The roommate's lines never say anything about "
                     "being a boy or a girl, because Bature records them too."),
    "npc.garba": ("Malam Garba", "He says \"Hm.\" and means a paragraph.",
                  "The porter in the Senate basement, beside a steel door with no handle. Small man, large ledger. Almost "
                  "every line he has is \"Hm.\", and no two of them mean the same thing. This is the best acting job in the game."),
    "npc.hajiya_ladi": ("Hajiya Ladi", "Bring your book. Let her see your profit.",
                        "Head of the market traders. Formidable, fair and sparing with words. She reads account books on "
                        "Thursdays and reads people every day of the week."),
    "npc.hauwa": ("Nurse Hauwa", "Doctor is coming. Sit.",
                  "The night nurse at the teaching hospital. She has seen everything twice and was not impressed either "
                  "time. Flat, calm and far kinder than she sounds."),
    "npc.helen": ("Helen", "Ask her anything. She'll ask you who's asking.",
                  "A Physiotherapy student, volleyball captain, and the reason the bravest footballer on campus hides "
                  "behind a tree. Her friends call her \"IDK\". Calm, amused and never once fooled."),
    "npc.jega": ("Jega", "Left boot first. Always. Don't argue with success.",
                 "A tall footballer from a small northern town and the first real friend the player makes. Huge late laugh, "
                 "short sentences, Hausa and English in the same breath. He heads goalposts, fears paperwork, and grows up "
                 "into a captain."),
    "npc.kabiru": ("DJ Kabiru", "A voice like warm bread. You're on the Ring Road.",
                   "He runs Ring Road FM from two rooms with egg boxes on the walls. He talks off air exactly the way he "
                   "talks on air: low, slow and smiling."),
    "npc.kaka": ("Kaka", "Sit. Eat first. She already knows why you came.",
                 "The forest ranger's grandmother, very old, shelling groundnuts where the road ends and the trees begin. "
                 "She sees everything and mentions almost none of it."),
    "npc.kb": ("KB", "For your face today? Three hundred naira.",
               "He owns the corner shop and sets his prices by face and by mood, announced like a game-show host. Under the "
               "jokes he is a man who watches the sky. When his batteries get expensive, buy candles."),
    "npc.kelechi": ("Kelechi", "Clay doesn't rush. Neither does he.",
                    "A sculptor in Fine Arts, a year ahead of the player, with clay up to his elbows. He says very little, "
                    "and he noticed something in the Sculpture Garden that nobody else has seen in forty years."),
    "npc.khadija": ("Dr. Khadija", "My office. Now. Bring yourself.",
                    "The level adviser, later head of department. Stern, unhurried and, though she would never say so, "
                    "entirely on your side. Her sentences land like rubber stamps."),
    "npc.lawal": ("Ranger Lawal", "Greets every tree by name. Tells every student to go back.",
                  "The forest ranger, as stubborn as a baobab. Students call him \"Baba Ranger\", which he hates, mostly. "
                  "He starts the story saying \"Go back.\" He ends it saying \"Follow my light.\""),
    "npc.lily": ("Lily", "Whispers to plants. Speaks last. Is right.",
                 "A Botany student who lives in the greenhouse, and the quiet twin of the loudest reporter on campus. "
                 "Very soft, very patient. When she says it will rain, take an umbrella."),
    "npc.lula": ("Lula", "Turn left. No. The other left. Emotionally.",
                 "Retired, proud, and the storyteller half of the funniest married couple in the game. He gives directions "
                 "with total confidence and the wrong hand, and tells every story to his wife Faty as much as to you."),
    "npc.lyzzy": ("Lyzzy", "Don't move. Your face is a moment.",
                  "Mass Communication, campus TV, and a phone that is always recording. She narrates life like a live "
                  "broadcast and posts first, checks later. In Year 4 she learns to check first."),
    "npc.mai_shayi": ("Mai Shayi", "Sit. Tea first. Gist second.",
                      "Audu, the tea seller under the neem tree, has been pouring tea there since the tree was a stick. "
                      "He is the campus memory. Every mystery in the game ends with somebody saying: ask Mai Shayi."),
    "npc.maker": ("The Maker", "Forty years in one garden, keeping one light on.",
                  "The quiet old man in a lab coat who looks after a strange humming coil in the Engineering Garden. He "
                  "never graduated. He never left. He is the heart of the mystery, and by the end the whole campus is "
                  "standing in his garden with torches."),
    "npc.mama_nkechi": ("Mama Nkechi", "You have eaten? Don't lie to her.",
                        "She owns the buka, feeds half the campus on credit, and remembers every naira of it. Loud, loving, "
                        "and able to hear a lie from the other side of a pot of stew."),
    "npc.maryam": ("Maryam", "Judges you by your bookshelf. Offers yam anyway.",
                   "An English student who works at the campus bookshop. Thoughtful, dry and teasing. She reads old things "
                   "aloud in a soft reading voice, and offers yam in every situation, including emergencies."),
    "npc.megawatt": ("Chief Megawatt", "Let us not be emotional. Let us be commercial.",
                     "The businessman who built the shiny new mall. Big smile, warm voice, always selling, never quite "
                     "illegal. He is not a villain. He honestly believes everything he says, which is worse."),
    "npc.mrs_adebayo": ("Mrs. Adebayo", "Four passports. She has asked for four since 1994.",
                        "The Registry clerk behind the glass window. Bored, unhurried and unbeatable. She is not in the "
                        "queue. She is the queue."),
    "npc.mubarak": ("Mubarak", "Founder, CEO and only member of staff. Trust the Plug.",
                    "An Economics student who sells everything, to everyone, out of a basement, then a stall, then a "
                    "wheelbarrow. Fast market patter in Pidgin and English, always halfway through a pitch. Under the "
                    "hustle he is the most generous person in the game."),
    "npc.muhammad": ("Muhammad", "Says sorry before he helps you. And after.",
                     "A soft-spoken young man in a plain white shirt who turns up exactly when he is needed and is gone "
                     "when you look back. He knows things he shouldn't. He never explains. Players will argue about him "
                     "for years, and you never settle it for them."),
    "npc.muktar": ("Muktar", "Point of order! (There is always a point of order.)",
                   "A Law student, the favourite in the student election, and Nusaiba's rival in the moot court and at the "
                   "ballot box. A printed banner, a sound system and a great deal of confidence.",
                   "Early twenties. Smooth, loud and pleased with himself; a politician already. Speaks in slogans and "
                   "objections. Not a bad person, just one who has never yet lost."),
    "npc.mum": ("Mum", "Have you eaten? No, properly. What did you eat?",
                "The player's mother, heard mostly on the phone, usually on loudspeaker by mistake, in front of forty "
                "strangers. Love arrives as instructions, quickly, slightly too loud, one question ahead of the answer."),
    "npc.ngozi": ("Coach Ngozi", "Garri is not a food group.",
                  "The gym trainer. She counts everything out loud and believes every body is good at something. Tough, "
                  "upbeat and never unkind."),
    "npc.nusaiba": ("Nusaiba", "Point one: she's right. Point two: put it in writing.",
                    "A Law student who talks in complete sentences and numbered points, clicks her pen when she is "
                    "thinking, and bosses her friends around for their own good. She will be student president. She is "
                    "already taking minutes."),
    "npc.nwachukwu": ("Prof. Nwachukwu", "A.N., still not dead.",
                      "Professor Adaeze Nwachukwu designed the ring of coils forty years ago. Nobody in the game ever "
                      "meets her. They find her voice on an old tape and her handwriting in a letter, and she is still "
                      "the cleverest person in the room.",
                      "An older woman, recorded on tape decades ago. Brisk, funny and impatient with fear. She talks to "
                      "her students as if they can do it, because she is sure they can. A little crackle is welcome."),
    "npc.okonkwo": ("Dr. Okonkwo", "Page forty. Nobody ever failed for being brief.",
                    "The Electrical Engineering lecturer who becomes the player's project supervisor. Brisk, fair and "
                    "funnier than she lets anyone see. She never raises her voice. She doesn't have to."),
    "npc.pastor_sam": ("Pastor Sam", "Ask him. No, ask HIM.",
                       "The chapel pastor, and best friend of Ustaz Auwal since primary school. Big laugh, Pidgin when he "
                       "gets excited, and equal faith in food and football. The two of them finish each other's sentences."),
    "player": ("The Fresher", "One bag, your mother's instructions, and five years to survive.",
               "The hero of the game: a brand-new student who chases a goat on day one and never quite lives it down. "
               "The Fresher lets friends do the long talking. These are short lines, one to eight words, modest, dry and "
               "quietly funny. The player chooses a male or a female Fresher, so this script is recorded once in each voice."),
    "npc.shamsu": ("Shamsu", "Simple. (It is never simple.)",
                   "The top student in Electrical Engineering and the player's seat-mate. Neat, kind, earnest and a "
                   "little too fast when he is excited. Every answer begins \"Simple.\" He cannot tell a lie, not even a "
                   "small one, and one day that matters."),
    "special.jiya": ("Jiya", "The woman who came for six weeks, read the small print, and stayed five years.",
                     "A visiting fellow who did law, then software, and has never lost an argument or raised her voice. "
                     "She treats the whole campus like a contract, because nobody else will read it."),
    "special.madison": ("Madison", "Wait wait wait. Film this.",
                        "An exchange student at the language centre who turns everything into a dance trend, bargains in "
                        "three languages and narrates her own life like a video. Very fast. Very funny. Never still."),
    "special.mib": ("M.I. Bugaje", "Three letters at the top of every high-score table.",
                    "A calm man in white and gold who is seen rarely and explained never. He is very kind and very quiet. "
                    "He speaks in short lines that can be read two or three ways, and he is gone before the conversation "
                    "feels finished.",
                    "Calm, kind, quiet and faintly mysterious. A poet's short lines, with room around them. Never "
                    "hurries. Never explains."),
    "special.taty": ("Taty", "Never tired. Usually winning. Always with a cat.",
                     "A visiting sports-science student from Brazil who runs the dawn run club and Friday games night. A "
                     "stray cat called Pixel adopted her on day one. She laughs while she laps you."),
    "npc.tanko": ("Tanko", "Ask him anything. He'll answer: \"Which?\"",
                  "The riddler who sits by the garden gate, older than he acts and slyer than he looks. He asks riddles "
                  "and almost never gives the answers."),
    "npc.tunde": ("Tunde", "Doesn't talk much. Hands you a drawing instead.",
                  "A quiet Fine Arts student who draws where other people would speak. Most of his lines are two to five "
                  "words. When he does say something, it lands."),
    "npc.ustaz_auwal": ("Ustaz Auwal", "Ask him. (He means the pastor.)",
                        "The mosque teacher, and best friend of Pastor Sam since primary school. Gentle and dry, slower "
                        "than Sam and twice as stubborn about suya. The two of them finish each other's sentences."),
    "npc.wednesday": ("Wednesday", "See you Wednesday. You will, too.",
                      "A student about the player's age who is only ever met on a Wednesday. Calm, kind and slightly "
                      "uncanny, as if this conversation has happened before. Never explains.",
                      "Calm, kind, a little uncanny. Talks as if they have heard this conversation before, and gently "
                      "mixes up \"last week\" and \"next week\". Signs off \"See you Wednesday.\""),
    "npc.zainab": ("Dr. Zainab", "Did she stutter? Drink water. Doctor's orders.",
                   "A young doctor at the teaching hospital who roasts you while she treats you. Warm, quick and funny, "
                   "then clinical the moment it matters. She loves her two cats, Kimchi and Suya, and everything Korean. "
                   "Her friends call her \"Snow White\"."),
    # the public: several voices each
    "crowd.children": ("The Children", "Every student is a teacher. Every goat is a friend.",
                       "School pupils and town kids, five to eleven years old. Loud, honest and fast. If you have children "
                       "at home who would enjoy shouting into a phone, this is their script."),
    "crowd.fans": ("The Fans", "Drums, groundnuts, and no voice left by half-time.",
                   "The football crowd at the stadium and along the touchline. Any number of voices, the louder the "
                   "better. Record it with friends if you can."),
    "crowd.freshers": ("The Freshers", "Nervous, overdressed, and calling everybody \"senior\".",
                       "Brand-new students, seventeen to nineteen. Loud in a group, tiny on their own, and carrying a file "
                       "everywhere they go."),
    "crowd.hospital": ("The Hospital", "Calm nurses, patient patients, visitors with flasks.",
                       "The nurses, patients and visitors of the teaching hospital. Always kind. Illness is never the "
                       "joke; the waiting is."),
    "crowd.hostel": ("The Hostel", "Nosy, generous, and always borrowing salt.",
                     "The neighbours: corridor voices, the kitchen crowd, the water queue. Everybody knows everybody's "
                     "business and shares everybody's food."),
    "crowd.lecturers": ("The Staff", "Formal, tired, and dry as chalk.",
                        "Lecturers, registry and bursary staff, and departmental secretaries. They have heard every excuse "
                        "there is, and they are quietly proud of their students."),
    "crowd.riders": ("The Riders", "Philosophers of the pothole.",
                     "Okada riders, keke drivers, bus drivers and their conductors: shouting routes, squeezing seats, and "
                     "offering life advice at speed."),
    "crowd.security": ("Security", "A torch, a whistle, and a notebook nobody has seen them write in.",
                       "Campus guards, gatemen and the night patrol. Tired, dry and secretly kind."),
    "crowd.students": ("The Students", "Permanently hungry. Everything is breaking news.",
                       "Ordinary students, second year to final year, from any faculty. Quick and gossipy, with Pidgin and "
                       "Hausa mixed into the English."),
    "crowd.town": ("The Town", "A proverb or a complaint for every kind of weather.",
                   "The elders, mothers, artisans and tailors of the town around the campus. Unhurried, nosy and generous."),
    "crowd.traders": ("The Traders", "Never once lost an argument about price.",
                      "Market women, food sellers, kiosk men and mall attendants. Loud, quick and generous."),
    "crowd.worship": ("The Faithful", "On the way to prayers, in their best.",
                      "Ordinary people going to and from the mosque and the chapel: neighbours, mothers, students. Warm, "
                      "unhurried and respectful. Faith in this game is ordinary and never a joke."),
}

# mission number: a few plain words about what is going on
MISSIONS = {
    1: "The first day. The family car at the gate, one bag, a runaway goat, and a note under the door that night.",
    2: "Registration: four offices, four queues, four passport photographs.",
    3: "Cooking jollof on a borrowed hotplate. Then the lights go out for the first time.",
    4: "Matriculation is at ten. The tailor says the gown will be ready \"Thursday\". Today is Friday.",
    5: "The first lecture, in the wrong theatre. The two theatres look the same and their signs are swapped.",
    6: "Tea at Mai Shayi's bench at night, three campus legends, and a quiet old man in a garden.",
    7: "Big Sly is charging freshers 200 naira to cross the basketball court. He gives receipts.",
    8: "Football trials at five o'clock. Jega picks the Fresher because of the goat.",
    9: "Jega heads the goalpost instead of the ball. A walk to the teaching hospital, and Dr. Zainab.",
    10: "Mubarak has a business opportunity in the Student Union basement. Come alone. Bring legs.",
    11: "Three tests in four days, and a tutorial for forty people under one working lamp.",
    12: "The night before the first exam, the whole campus goes dark, and something moves in it.",
    13: "Results day. A sheet of paper, a box of pins, and a phone call home.",
    14: "Sly challenges the Fresher to a fair spar, with rules and a referee.",
    15: "A Sunday at the dam with an old fisherman who does not hurry.",
    16: "Midnight at the dam. The water is singing.",
    17: "The keke (three-wheeled taxi) driving test, with a married couple arguing in the back seat.",
    18: "Bature auditions for campus radio. The station is two rooms with egg boxes on the walls.",
    19: "The football final. Education are a player short, and somebody has read the rule book.",
    20: "A sculptor has noticed something odd about the Sculpture Garden: six plaques, and room for a seventh.",
    21: "The bravest footballer on campus is hiding behind a tree outside the women's hall. He needs a wingman.",
    22: "The Maker asks for something he has never asked for: everybody. The Fresher goes knocking on doors.",
    23: "Four exam papers in nine days. Somebody has moved a mattress into the library.",
    24: "The last night of Year 1. Half the school marches to the garden with torches, and the first coil lights.",
    25: "First day back. A new fresher is asleep in the Fresher's bed, and suddenly everybody says \"senior\".",
    26: "A shiny three-storey mall has swallowed half the market. Grand opening day.",
    27: "Mubarak's business has a real stall now. The sign-painter ran out of board.",
    28: "Learning to ride an okada (motorbike taxi). The bike is called Patience, because she needs it.",
    29: "A bad week of power cuts. Every time the campus goes dark, the mall gets brighter.",
    30: "Following a white Works van at night to find out who is switching the lights off.",
    31: "Nusaiba's moot court. Morning in the law library, afternoon in front of Dr. Minus.",
    32: "Under the mall in a borrowed grey hoodie, following a cable to something that hums.",
    33: "Faculty Week in Engineering: bunting, a quiz, a football match and a dinner.",
    34: "Sly opens a barber's kiosk next to Big Baby's salon. He needs a first customer.",
    35: "Three late tests, and an official warning letter from the department.",
    36: "Bature's late-night radio show, \"Riddles After Dark\". Tonight's riddle is about the power cuts.",
    37: "The cup semi-final. Jega is captain, and there is a scout in the stand with a notebook.",
    38: "The works engineer has a confession. Report him, or let him own up himself?",
    39: "The far hostels have had no light and no water for three days. A night convoy of jerrycans.",
    40: "Valentine's Day, with 300 naira in the bank.",
    41: "The coil under the mall is missing three parts that nobody makes any more. So they get made.",
    42: "A night at the teaching hospital when the power fails. Dr. Zainab needs hands.",
    43: "Planning a heist on the bedroom floor, with cups of garri for buildings.",
    44: "The heist. One long night at the mall, and sixty keys to put back before six.",
    45: "A power bank from Mubarak's stall starts smoking in a lecture. His business collapses.",
    46: "A formal hearing on Senate paper. Somebody has told on the Fresher.",
    47: "Exam week. A hard paper at eight, and Shamsu's robot to carry across campus by eleven.",
    48: "The last Friday. The leavers sign each other's white shirts.",
    49: "Third year. A fresher says \"Good morning, senior\" and the Fresher looks behind to see who he means.",
    50: "The lecturers go on strike, \"indefinitely\". The student congress is a shouting match.",
    51: "Two weeks into the strike. Most people have gone home. These are the ones who stayed.",
    52: "Mubarak is selling garri from a polished wheelbarrow. Strike economics.",
    53: "Teaching Primary 4 at the Demonstration School. Thirty-one faces and a silence that is clearly a plan.",
    54: "Dawn on the faculty farm. Animals do not go on strike.",
    55: "Walking past the last streetlight on the ring road, into the forest.",
    56: "The empty lecture halls during the strike. By day, dust. By night, grey figures sitting in the seats.",
    57: "The roommate has stopped getting up. Friends sit down in the room, one by one, and stay.",
    58: "A free clinic in town. A queue round the building before sunrise.",
    59: "Sneaking through the forest fence at night, past the patrol.",
    60: "The old laboratory in the forest, by daylight. A plaque, a tape, and a voice from forty years ago.",
    61: "The Maker is back. He finally tells the story of the six coils.",
    62: "Shamsu runs a study group so the strike costs nobody a year. And he has something to confess.",
    63: "A football match on a ploughed field in town. Jega's knee.",
    64: "A night on the half-empty hospital wards.",
    65: "Nights in the workshop, building a street lamp. Bolaji turns out to be a gifted carpenter.",
    66: "A moonlit football match to wake up a campus that has stopped moving.",
    67: "The strike is called off. One bus arrives at the gate. Then twenty.",
    68: "Who padlocked the lecture halls? Mubarak finds his own receipt.",
    69: "The rains have come. A flooded stream in the forest, and a debt to the ranger.",
    70: "Thirty-one schoolchildren walk into the forest at dawn and sing an old coil awake.",
    71: "A wedding at the staff quarters. Four hundred plastic chairs and a dance.",
    72: "Two semesters of exams squeezed into three weeks, then the long road home lit up.",
    73: "Fourth year starts in the Registry queue. This time the Fresher brought a folding chair.",
    74: "First day of work placement at the Works yard. It starts with a broom.",
    75: "A video of the Fresher dancing goes viral.",
    76: "A stunt video with a campus influencer and eleven goats.",
    77: "A copy of the Fresher is on the basketball court at night, doing the dance slightly wrong.",
    78: "Jega's knee, months later. Dawn rehab sessions with Bolaji knocking at 05:55.",
    79: "Nusaiba runs for student president. Posters, a walkabout and a budget of 4,000 naira.",
    80: "The same Wednesday, three times. It is also the roommate's birthday.",
    81: "A second heist: the old observatory, a four-minute window at ten past one in the morning.",
    82: "A fake clip of the Fresher goes round a lecture hall, phone by phone.",
    83: "A forty-eight-hour hackathon. Sixty laptops and one extension cable.",
    84: "A day on the dam with no phone. Baba Dam keeps it in a biscuit tin.",
    85: "The election. A televised debate, polling day, and a recount.",
    86: "The first real pay day: sixty thousand naira, and three ways to spend it.",
    87: "The national engineering finals. Shamsu irons his team shirt twice.",
    88: "Jega's comeback, in the cup final.",
    89: "A Ramadan cook-off. A mountain of onions and a very small knife.",
    90: "Five in the morning in the Life Sciences lab, with Firdausi and an electric fish.",
    91: "Aleeya's degree show opens at six. It is two o'clock, and things are going wrong.",
    92: "The mall after closing. A hundred reflections in the glass, all slightly late.",
    93: "Two people both expect the Fresher at seven. Fame sends its bill.",
    94: "Dr. Zainab has an offer from Seoul and an email she hasn't sent.",
    95: "Defending the work-placement logbook in front of a panel.",
    96: "Kelechi finishes his last sculpture, at dusk, in the Sculpture Garden.",
    97: "Final year. The Fresher leans on the gate and watches a new family car arrive.",
    98: "The final-year project is approved: build the sixth coil. The Maker's old notebook.",
    99: "A new bully is taxing freshers on the court. Bolaji is not pleased.",
    100: "Nusaiba's exam script has vanished and she is marked absent.",
    101: "The third heist: through the Senate basement and Door 7, into the old tunnel.",
    102: "Chief Megawatt offers Mubarak five million naira for the Plug.",
    103: "The sixth coil needs ten parts nobody sells. Ten faculties each give one.",
    104: "Build week in the mechanical workshop, day and night.",
    105: "The coil fails. A long walk in the rain.",
    106: "It was never the wiring. Going back to every friend, to build it together.",
    107: "A football academy wants Jega now. A pen, a contract and a bus ticket.",
    108: "An envelope under the door, on very good paper. It says one word: \"Stay\".",
    109: "The finalists' dinner. The tailor delivers on time, for once.",
    110: "The project defence. Forty slides, of which eleven are allowed.",
    111: "The longest night. All five lit coils go out, one after another.",
    112: "Relighting three coils by road, in the dark, on Bolaji's okada.",
    113: "Relighting two more: one at the observatory, one out on the dam.",
    114: "Five in the morning. Ten friends carry ten seals down a tunnel to an old door.",
    115: "Chancellor Null, in the dark. The Fresher calls every friend by name.",
    116: "The ring closes. The clock strikes. The Maker walks out of his garden.",
    117: "Final results, and graduation photographs.",
    118: "Graduation day. The family car at the gate again.",
    119: "The day after. Everybody signs everybody's white shirt.",
    120: "Some years later. A visit, and a new fresher at the gate.",
}

# Speakers without a script of their own (they appear in "Small parts"): nicer names than their cast ids.
SMALL_NAMES = {
    "npc.partner_or_roomie": "The Fresher's date (or the roommate)", "npc.partner": "The Fresher's date",
    "npc.sibling": "The little sibling", "npc.needle": "Alhaji Needle, the tailor", "npc.chitech": "Chi-Tech, the phone repairer",
    "npc.sugar": "DJ Sugar", "npc.dj_sugar": "DJ Sugar", "npc.sadiya": "Comrade Sadiya", "npc.aisha": "Aisha",
    "npc.aliyu_daughter": "Engr. Aliyu's daughter", "npc.jega_mother": "Jega's mother", "npc.shamsu_father": "Shamsu's father",
    "npc.shamsu_mother": "Shamsu's mother", "npc.megawatt_lawyer": "Chief Megawatt's lawyer", "npc.asiya": "Aunty Asiya",
    "npc.iya_risi": "Iya Risi", "npc.baba_shuttle": "Baba Shuttle", "npc.oga_sharp": "Oga Sharp", "npc.musa_b": "Musa B.",
    "npc.danjuma": "Foreman Danjuma", "npc.asabe": "Foreman Asabe", "npc.ikenna": "Foreman Ikenna",
    "npc.dean_agric": "The Dean of Agriculture", "npc.dean_arts": "The Dean of Arts", "npc.dean_comp": "The Dean of Computing",
    "npc.dean_eng": "The Dean of Engineering", "npc.dean_envd": "The Dean of Environmental Design",
    "npc.dean_law": "The Dean of Law", "npc.dean_life": "The Dean of Life Sciences", "npc.dean_phys": "The Dean of Physical Sciences",
    "npc.fresher_a": "A fresher (first voice)", "npc.fresher_b": "A fresher (second voice)", "npc.fresher_c": "A fresher (third voice)",
    "npc.messenger_fresher": "A fresher with a message", "npc.fourth_row_boy": "The boy in the fourth row",
    "npc.gate_guard": "The gate guard", "npc.good_shoes": "The man in the good shoes", "npc.examiner": "The keke examiner",
    "npc.headmistress": "The headmistress", "npc.judge_a": "A judge", "npc.law_lecturer": "A Law lecturer",
    "npc.minute_taker": "The minute-taker", "npc.new_boss": "The new court boss", "npc.old_caller": "An old man phoning the radio",
    "npc.old_trader": "An old market trader", "npc.registrar": "The Registrar", "npc.scout": "The football scout",
    "npc.sign_painter": "The sign-painter", "npc.small_boy": "A small boy", "npc.sophomore": "A second-year student",
    "npc.suya_man": "The suya seller", "npc.vice_chancellor": "The Vice-Chancellor", "npc.wary_student": "A wary student",
    "npc.lucky": "Lucky, the influencer", "npc.emeka": "Emeka, king of the okada riders", "npc.bello": "Prof. Bello",
    "npc.ab": "AB", "npc.cmd": "The Chief Medical Director", "npc.mr_clement": "Mr. Clement", "npc.mrs_shehu": "Mrs. Shehu",
    "npc.malam_sule": "Malam Sule", "npc.sule": "Sule",
    "crowd.conductors": "Bus conductors (a crowd)", "crowd.footballers": "Footballers (a crowd)",
    "crowd.hostel_far": "The far hostels (a crowd, shouting)", "crowd.patients": "Patients", "crowd.primary4": "Primary 4 (children, all together)",
    "crowd.rangers": "The young rangers (children)", "crowd.staff": "An exam invigilator",
    "prop.radio": "A woman's voice on the radio", "prop.old_transmitter": "A woman's voice on an old transmitter",
    "prop.phone_unknown": "A voice on the phone, unknown number", "prop.robot": "Shamsu's robot",
    "prop.echo_player": "The Fresher's copy (an Echo)",
}
