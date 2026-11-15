# Revision 4 top-up: extra beats so every Y4/Y5 main mission reaches 60+ lines. Inserted after the first block.
X = {}
X["m80"] = """
y1. [talk: bature] Night shift: Bature brings a torch and a riddle for the long hours.
   - BATURE: What works all day and gets paid in experience? You. Welcome to IT. [v: ]
y2. [phone: maker_away] The garden lamps flicker on the way home. The Maker's bench is empty.
   - TUNDE (text): He's gone again. Two days. Everything hums wrong. [v: ]
y3. [emote: laugh] The site's goat (every site has a goat) eats your logbook's last page.
   - @BOSS: The goat has reviewed your work. It found it delicious. Rewrite it. [v: ]
"""
X["m81"] = """
y1. [talk: emily] Emily brings strawberries "for the famous person" and forgets to give them.
   - EMILY: I ate them on the way. I was nervous. Fame is scary. I bought more. I ate those too. [v: ]
y2. [emote: laugh] A lecturer stops mid-class to ask you for the leg thing.
   - LECTURER: Quickly. For science. …Thank you. Back to Ohm's law. [v: ]
"""
X["m82"] = """
y1. [phone] The video hits a hundred thousand views. Most comments are about the goats.
   - LYZZY: The goats have a fan page now. They have better skin than you. [v: ]
y2. [emote: laugh] Shamsu demands credit as "Goat Coordinator" in the description.
   - SHAMSU: Professor. Coordinator. Sheikh. In that order. [v: ]
"""
X["m84"] = """
y1. [talk: hauwa] Later, Nurse Hauwa gives you a first-aid card with your name on it.
   - NURSE HAUWA: Now you are a person who stops when others run. Keep the card. Keep the habit. [v: ]
y2. [phone] Your colleague texts a selfie with the bow-tie bandage.
   - COLLEAGUE (text): My mother says you are now her son. Sorry. She has many sons. [v: ]
y3. [emote: laugh] Bolaji asks if first aid works on hunger.
   - BOLAJI: Press here? Here? Where is the button for jollof? [v: ]
"""
X["m85"] = """
y1. [shop] If you bought nothing, KB raises the price of garri by ₦5 "to celebrate your discipline".
   - KB: Discipline is expensive. For other people. [v: ]
y2. [talk: firdausi] Firdausi checks you didn't spend it all on the okada.
   - FIRDAUSI: Show me the receipt. Not to judge. To judge a little. [v: ]
y3. [phone] Mum calls again. She heard about the okada. Mothers hear everything.
   - MUM: An okada? Helmet. Two helmets. Wear one on your knee. [v: ]
y4. [emote: laugh] Bature names the okada "Sixty Thousand" and blesses it with garri.
   - BATURE: In the name of soaked garri, go safely. [v: ]
"""
X["m88"] = """
y1. [emote: laugh] Alhaji Needle cries real tears during Aleeya's walk and denies it.
   - ALHAJI NEEDLE: Dust. Harmattan. My eyes are allergic to genius. [v: ]
"""
X["m89"] = """
y1. [talk: muhammad] Muhammad, the quiet one, sits beside you without a word and shares his water.
   - MUHAMMAD: People forget quickly. The truth is slow. It always arrives. [v: ]
y2. [emote: laugh] A fresher you supposedly shoved brings you a thank-you card. He's confused too.
   - FRESHER: I don't remember you shoving me. But everyone says you did. Sorry? [v: ]
"""
X["m90"] = """
y1. [listen] Night falls on the water. The garden coil hums faintly across the Dam.
   - BABA DAM: He's back. The quiet one. The water sounds different when he's back. [v: ]
y2. [phone: maker_return] The Maker's bench is occupied again. The lamps steady.
   - TUNDE (text): He came back. Didn't say where he went. Never does. [v: ]
y3. [emote: laugh] On shore, Bature has fallen asleep in a canoe and drifted twenty metres.
   - BATURE: (waking) I'm sailing! I'm a sailor now! Help! [v: ]
"""
X["m91"] = """
y1. [phone] The real clip posts. Views climb slowly. The truth is slow, as Muhammad said.
   - LYZZY: Slow is fine. Slow lasts. Fast is a remix. [v: ]
y2. [talk: hod] The HOD watches the real clip and closes the file without a word.
   - @HOD: Closed. And whoever sent me the first one, I hope they watch this one too. [v: ]
y3. [talk: twins] The twins whisper about who sent it. They have a guess. They keep it.
   - LILY: We think we know. We won't say. Saying things is how this started. [v: ]
y4. [emote: laugh] Chi-Tech bills you for "emotional repairs".
   - CHI-TECH: Phone repair, ₦3,000. Emotional repair, priceless. Pay the ₦3,000. [v: ]
"""
X["m92"] = """
y1. [talk: bature] Before it starts, Bature gives one piece of advice. It's good, for once.
   - BATURE: Truth tastes bad, like bitter leaf. But it doesn't come back up later. [v: ]
y2. [walk: love garden] After, walk the Love Garden alone or with whoever stayed.
   - LILY (passing): Hearts are like hedges. Cut them wrong and they grow back crooked. [v: ]
y3. [choice] Being single is a valid ending for this semester. Anyone can find someone new later.
   - FIRDAUSI: You're not finished. You're just between chapters. Read slowly. [v: ]
y4. [callback] If you two-timed and confessed, one of them may text in Y5 (flag `second_chance`).
   - FIRST (text, Y5): I saw you at the coil build. You looked honest. Coffee? Just coffee. [v: ]
y5. [talk: summy] Summy tells you she and Muktar broke up once in Year 2. For a week.
   - SUMMY: He made a committee to win me back. I said yes to stop the minutes. [v: ]
y6. [phone] Your phone buzzes with a meme from Lula and Faty Ajaka: two cakes, one fork.
   - FATY AJAKA (text): We made this about you. With love. Mostly love. [v: ]
y7. [emote: laugh] Back at the hostel, Bature has written a riddle about it.
   - BATURE: What has two dates and no calendar? You. Don't hit me. [v: ]
"""
X["m93"] = """
y1. [talk: mama nkechi] Afterwards, she gives you a plate and a recipe written on a receipt.
   - MAMA NKECHI: My mother's egusi. Don't share it. Share the food, not the recipe. [v: ]
y2. [emote: laugh] KB orders forty plates for his shop and resells them at a markup.
   - KB: I didn't win. I monetised the victory. [v: ]
"""
X["m94"] = """
y1. [talk: sadiya] After the count, Comrade Sadiya thanks you with a speech that's too long.
   - COMRADE SADIYA: …and finally, my eleventh point— [v: ]
   - BATURE: Comrade, the voters have gone home. The chairs are listening. [v: ]
y2. [phone] Your phone gets three thank-you messages and one "I know what you did".
   - UNKNOWN (text): I know what you did. You put posters on my board. Mine. Rude. [v: ]
"""
X["m95"] = """
y1. [phone] Mum calls at midnight because she felt something.
   - MUM: My chest said you were on water. Are you on water? Get off the water. [v: ]
y2. [emote: laugh] The eel follows Baba Dam's boat to his house and waits outside.
   - BABA DAM: Now I have a dog that swims. Thanks to you. [v: ]
"""
X["m97"] = """
y1. [phone] You post one thing: the Sick Bay fund link. It raises ₦180,000 in a week.
   - NURSE HAUWA (text): New bandages. Real ones. Not bow ties. Thank you. [v: ]
y2. [emote: laugh] Your follower count drops by half. Bature celebrates.
   - BATURE: Half the fans means double the garri per fan. Mathematics. [v: ]
"""
X["m98"] = """
y1. [talk: wednesday] Wednesday arrives at exactly the moment you think about her.
   - WEDNESDAY: It's Wednesday. I always come. Happy… whatever this is. [v: ]
y2. [talk: tunde] Tunde gives you a framed sketch of the whole room, drawn yesterday.
   - TUNDE: I drew the party before it happened. You're all exactly where I put you. [v: ]
y3. [talk: kb] KB brings soft drinks and a bill. Then tears up the bill.
   - KB: Today is free. Tomorrow prices go up. Something is coming again. I can feel it. [v: ]
y4. [emote: laugh] Bolaji gets cake on Abbas's face and calls him John Carter. Abbas lets it go. Once.
   - ABBAS: Today only. Because it's a party. Tomorrow I'm Abbas again. [v: ]
"""
X["m99"] = """
y1. [talk: maker] Late night, you check on the Maker. He has the faded jetty photograph in his hand.
   - THE MAKER: Where did you find this? …The fish never forgot either. [v: ]
y2. [choice] Ask about the girl in the photo, or sit with him in silence.
   - THE MAKER: Not tonight. Maybe never. Sit. That's enough. [v: ]
y3. [emote: laugh] Bature, eavesdropping behind a hedge, sneezes. Twice.
   - BATURE: Harmattan. Not spying. Never spying. Goodnight. [v: ]
"""
X["m100"] = """
y1. [talk: aleeya] Aleeya brings a Year 1 photo of you holding your registration form upside down.
   - ALEEYA: Look at your face. You were so lost. I kept it for a moment like this. [v: ]
y2. [emote: laugh] A fresher asks you for directions. You give them, and they go the wrong way.
   - BATURE: Five years, and your directions are still wrong. Consistency. [v: ]
"""
X["m101"] = """
y1. [talk: super] Your supervisor gives you a project title that is too long to say.
   - @SUPER: Read it aloud. Without breathing. That is your first test. [v: ]
y2. [emote: laugh] The Maker, surprisingly, uses a big word just to make Bature jealous.
   - THE MAKER: Your enthusiasm is sesquipedalian, young man. [v: ]
   - BATURE: Sir, that is not a word. That is a sneeze. [v: ]
"""
X["m102"] = """
y1. [talk: sgt. bilkisu] Sgt. Bilkisu watches from a distance and approves without saying so.
   - SGT. BILKISU: Bolaji. I arrested you in Year One. Now you stop the taxes. Hm. Good. [v: ]
y2. [emote: laugh] Bolaji's new apprentice cuts Bolaji's hair first. Badly.
   - BIG BABY: It's beautiful. It's a new style. It's called "Love Is Blind". [v: ]
"""
X["m104"] = """
y1. [talk: maker] Ask the Maker about Megawatt. He knew his father.
   - THE MAKER: His father also wanted his name on things. Ask what the name is for. [v: ]
y2. [phone] If honest, your goal hits ₦400,000 with an hour left. Then a final ₦7,000 from "IDK".
   - JEGA: She doesn't even like coils. She likes me. That's the same thing. [v: ]
y3. [emote: laugh] Megawatt, rejected, buys forty plates of garri from Bature's sale out of spite.
   - BATURE: Chief, thank you. Your spite has funded science. [v: ]
"""
X["m105"] = """
y1. [talk: emily's grandmother] At the farm, Emily's grandmother wants a story for her collection.
   - EMILY'S GRANDMOTHER: Tell me a story about my granddaughter that she doesn't know I know. [v: ]
   - EMILY: Grandma! [v: ]
y2. [talk: maker_return] The Maker comes back. The garden coil steadies. He looks thinner.
   - THE MAKER: I'm back. Nothing happened. Don't look at me like that. [v: ]
y3. [talk: nusaybah] Nusaybah lists every part on a clipboard, double-checks, and nods.
   - NUSAYBAH: Six parts. Six people. Six favours. This is a coil made of friendship. Gross. [v: ]
y4. [emote: laugh] The foreman counts his wood twice. A plank is missing. Bature is holding it.
   - BATURE: I'm guarding it. From the cliff tower. That tower eats wood. [v: ]
"""
X["m106"] = """
y1. [talk: aleeya] Aleeya organises a food rota for the winders.
   - ALEEYA: Rice at noon. Puff-puff at four. Moral support always. Bature, stop eating the rota. [v: ]
y2. [rhythm: night shift] Nusaybah winds through the night; you keep count.
   - NUSAYBAH: One thousand nine hundred and ninety-nine. Two thousand. Done. Don't hug me. [v: ]
y3. [emote: laugh] The next morning Lula's drawn-on eyebrows are three different shapes.
   - LULA AJAKA: They're expressive. Each one has a mood. [v: ]
"""
X["m108"] = """
y1. [talk: khalid] Later, ask Khalid where he went in Year 3.
   - KHALID: Home. My father was sick. I didn't want anyone to carry it. Now he's well. [v: ]
y2. [emote: laugh] Bature lists "Garri Engineering" on the final coil's credit plate. It's still there.
   - MR. EZEKIEL: Remove it. …No. Leave it. It's funny. History likes funny. [v: ]
"""
X["m109"] = """
y1. [emote: laugh] Malam Garba frames one cold letter "as a warning to future administrators".
   - MALAM GARBA: Never cancel convocation. That is the first rule of my religion. [v: ]
"""
X["m110"] = """
y1. [talk: yusuf] Yusuf, for once, doesn't joke. He mentions his maths prize, quietly.
   - YUSUF: I won the maths prize. Don't tell anyone. They'll stop laughing at my jokes. [v: ]
y2. [emote: laugh] Bature's thank-you speech for "Most Garri Consumed" thanks the garri by name.
   - BATURE: Ijebu, Ogun, Yellow, White. You were always there for me. [v: ]
"""
X["m111"] = """
y1. [talk: nusaybah] Outside the defence room, Nusaybah steadies your hands.
   - NUSAYBAH: Breathe in four. Hold four. Out four. Now talk like you know it. You do. [v: ]
y2. [phone] Mum texts "God is with you" eleven times, one for each minute of the defence.
   - MUM (text): God is with you. God is with you. Also eat something. [v: ]
y3. [emote: laugh] The external examiner, leaving, asks Bature for one of his riddles.
   - BATURE: What has a degree and no job? …Too soon, sir? Sorry, sir. [v: ]
"""
X["m112"] = """
y1. [talk: hauwa] At the Sick Bay, Nurse Hauwa works by candlelight with your old first-aid card.
   - NURSE HAUWA: You kept the habit. Good. Hold this torch. Higher. Perfect. [v: ]
y2. [turn] Dawn. The Maker returns. The first lamp on the boulevard comes back on its own.
   - THE MAKER: Long night. I'm sorry. I was looking for something. I didn't find it. [v: ]
y3. [emote: laugh] Bolaji is found asleep at the barricade, still holding a bucket.
   - BOLAJI: (waking) I was guarding! With my eyes closed! Advanced technique! [v: ]
"""
X["m113"] = """
y1. [talk: kb] KB's shop stays open all night; prices are, for once, normal.
   - KB: Normal prices. That means it's over. Or just beginning. I'm not a prophet. [v: ]
y2. [talk: tanko] Tanko is at the Old Campus gate as if waiting for you.
   - TANKO: The road remembers every foot. Yours is new. His is old. Hers was light. [v: ]
y3. [phone] District prosperity rises; the phone lists new stalls and new murals.
   - DJ KABIRU (radio): New mural at Phase Two! It's a goat. Of course it's a goat. [v: ]
y4. [emote: laugh] Shamsu's goats escape during the race and follow you to the finish.
   - SHAMSU: They are loyal. Like me. Professor Shamsu. Sheikh Biru. Goat Coordinator. [v: ]
"""
X["m114"] = """
y1. [emote: laugh] Captain Uche lands the plane on the runway's very end, in a cloud of dust.
   - CAPTAIN UCHE: Every landing you walk away from is a good one. That one was medium. [v: ]
"""
X["m115"] = """
y1. [talk: wednesday] Wednesday tells you she's seen this fight before, ending differently.
   - WEDNESDAY: Last time you said yes. You were sad for forty years. This time say no. [v: ]
y2. [talk: muhammad] Muhammad keeps a candle lit at the plaques, unmoving, the whole fight.
   - MUHAMMAD: I'll keep this one. It's the only thing I'm good at. Keeping. [v: ]
y3. [turn] The Chancellor's gown collapses into dust that smells of old paper.
   - NUSAYBAH: It was a letter all along. A very long letter with legs. [v: ]
y4. [emote: laugh] Bature, having hidden the whole time, claims he "distracted it psychologically".
   - BATURE: I was thinking very loudly at it. It worked. [v: ]
"""
X["m117"] = """
y1. [talk: twins] Lily and Lyzzy give you the last noticeboard story: it's about you.
   - LYZZY: We wrote you a happy ending. Don't read it till you leave the gate. [v: ]
y2. [photo] Tunde draws the five photos into one sketch, in case the phone dies.
   - TUNDE: Phones die. Drawings get old. Old is better than dead. [v: ]
y3. [talk: big baby] Big Baby asks Bolaji to be in your photo. He's shy for the first time ever.
   - BOLAJI: Me? In the photo? …Okay. Make me look strong. And kind. Mostly strong. [v: ]
y4. [choice] If you broke up and met someone new this year, both appear in different photos. Nobody fights.
   - @EX: Congratulations. I mean it. Take a photo with us both. Make it weird. [v: ]
y5. [emote: laugh] The gown is too long. Bature stands on it in every single photo.
   - BATURE: Accident. Five accidents. Same accident. [v: ]
"""
X["m118"] = """
y1. [talk: aunt] Your aunt asks every friend if they're married yet.
   - AUNT: You, the tall one with the bucket, are you married? Why not? [v: ]
   - BOLAJI: Ma, I'm working on it. Big Baby, are you hearing this? [v: ]
y2. [emote: laugh] Mum insists on a photo with Bature "because he looks hungry".
   - MUM: Come. Stand here. You look like you haven't eaten since Year One. [v: ]
"""
X["m119"] = """
y1. [talk: emily] Emily gives you a jar of strawberry jam from the farm, labelled "for later".
   - EMILY: Open it when you miss this place. You'll miss it on a Tuesday. Trust me. [v: ]
y2. [emote: laugh] Bature signs your shirt again, on the back, larger: "SEE YOU IN YEAR SIX".
   - BATURE: There's no Year Six. That's the joke. Or is it? Joke. [v: ]
"""
X["m120"] = """
y1. [walk] Your old bed space has a fresher on it now, unpacking garri.
   - NEW ROOMMATE (fresher): Is this yours? The garri? Can I…? [v: ]
   - YOU (option): It's tradition. Take it. Then buy more. [v: ]
y2. [talk: lily] A letter in your box from Lily: the Maker's reply to her, finally shown.
   - LILY (letter): He wrote: "Patience is a lamp that doesn't need wires." I kept it for you. [v: ]
y3. [phone] Group chat: everyone checking in from their new lives.
   - KHALID (text): New job. My notebook has a new page. You're on it. Owed nothing. [v: ]
   - FATY AJAKA (text): New joke book. First page is blank again. Lula is ready. [v: ]
y4. [turn] Tanko, at the gate, one last riddle as you leave.
   - TANKO: What leaves and stays? You. Go well. [v: ]
"""

# Third pass: a closing line for missions that sat just under 60.
Z = {
 "m93": '''z1. [radio] Kabiru announces the result with a drumroll he does with his mouth.
   - DJ KABIRU (radio): Mama Nkechi wins! Food court, please accept your loss with pepper. [v: ]''',
 "m94": '''z1. [radio] The result goes out on campus radio with a goat bleat for Bature.
   - DJ KABIRU (radio): And a special award to the goat. He was the only honest candidate. [v: ]''',
 "m98": '''z1. [sleep] The room falls asleep in a heap. Bature, last awake, eats the last slice.
   - BATURE (whisper): Happy surprise. To me. [v: ]''',
 "m99": '''z1. [radio] Kabiru plays a slow song for Kelechi's last night on campus.
   - DJ KABIRU (radio): For the sculptor. Eight statues, one signature. Go well. [v: ]''',
 "m100": '''z1. [radio] Kabiru announces that you found all hundred clues. He sounds proud.
   - DJ KABIRU (radio): One hundred out of one hundred. Somebody give this person garri. [v: ]''',
 "m104": '''z1. [phone] The goal reached, Muktar sends meeting minutes about the fundraiser. Nobody reads them.
   - MUKTAR (text): Item one: we won. Item two: Bature owes the stall ₦3,000. [v: ]''',
 "m112": '''z1. [radio] Kabiru's generator brings the campus radio back first.
   - DJ KABIRU (radio): We're back. The lights aren't, but the music is. Priorities. [v: ]''',
 "m117": '''z1. [radio] Kabiru reads every graduating name on air, slowly.
   - DJ KABIRU (radio): …and Bature. Yes, him. I'm as surprised as you are. [v: ]''',
}
