# 01 · Year 1 Character Bible

**What this is:** every character who appears, speaks, or is referenced on screen in Year 1 (M001–M024), described so that a modeller, a prompt engineer or a downstream AI can produce the same person every time.

**Status tags:** `CANON` (exact in `cast.ts`/`CHARACTERS.md`), `LOCKED` (test-enforced), `PROPOSED` (this package's model-ready value, awaiting sign-off), `CONDITIONAL` (real-person special character), `ALIAS` (resolves to another look).

**Golden rules**

- One skeleton, two base bodies (female/male, `assets/people2/`), no bespoke meshes.
- Height multiplier stays within **0.94–1.06**. Width is x/z only and belongs to **Big Sly alone**.
- Hijab hides hair automatically. Never show hair under a hijab.
- Modest clothing, sleeves to at least the elbow, campus palette, no neon.
- Skin leans fair-to-caramel; **nobody very dark**. Dr. Zainab is `LOCKED` at `#f1d6c2`.
- `PROPOSED` is not canon. Get sign-off before publishing or merchandising it.

---

## 1. The player (variable)

### `player` — The Fresher · `VARIABLE`

- **Body:** player-built in the character editor. Either base body; model, skin, hair, outfit, headwear and name are the player's choices.
- **Default read:** a first-year student, 18, one bag, ordinary clothes, a phone, and the expression of somebody who has been told the gate is the main gate.
- **Height:** player-controlled within the same human scale; do not exceed ±6 % of the cast.
- **Voice:** `player.m` or `player.f` — short lines, dry, rarely more than a sentence. The player is not a quipper; the world is funny around them.
- **Acting rule:** the fresher listens. In cutscenes they are the camera's anchor, not the loudest person. Reactions are small: a blink, a half-step back, a look down at the note.
- **Wardrobe in Year 1:** whatever the player chose, plus mission-specific state: dusty after the goat chase (M001), wet to the chest (M016), exam-tired (M023), formal for convocation (M024).
- **Model note:** every cutscene anchor named `PLAYER` follows the player's current look. Never bake a fixed player appearance into a scene.

---

## 2. Family and the room

### `npc.mum` — Mum · 48 · `CANON`

- **Body:** `womandress`, height 1.00, comfortable/full build.
- **Skin / hair:** medium `#a06a46`; black `#141010` (hidden).
- **Outfit:** dress deep green `#2f6f5a` · trim golden-yellow `#e0a526` · belt gold `#d4af37`.
- **Headwear:** hijab, mustard `#e0a526`.
- **Extras:** none.
- **Silhouette:** solid, warm, upright; a woman who fills a doorway and a phone call.
- **Voice / acting:** Northern Nigerian mother, 48; quick, loving, every sentence an instruction. Pitch 1.12, rate 1.06. She talks with her hands and her eyebrows; when she is worried she becomes more organised, not softer.
- **Y1:** M001 (gate, room, window), M013 (phone), M022 (voice).
- **Model notes:** the dress is a cone cut; keep the belt high so the silhouette reads "wrapper and blouse", not "tent". The hijab must sit close at the temples.

### `npc.dad` — Dad · 52 · `CANON`

- **Body:** `mansuit`, height ×1.02, broad.
- **Skin / hair:** tan `#8d5b3c`; black.
- **Outfit:** off-white `#e9e4d8` shirt · off-white `#e9e4d8` trousers (loose cotton, not a white onesie).
- **Headwear:** soft cap, burgundy `#7a2e3b`.
- **Extras:** none.
- **Silhouette:** big, calm, slow; stands with weight on one leg, hands behind his back.
- **Voice / acting:** Nigerian father, 52; slow, proud, deep, enjoys his own stories. Pitch 0.78, rate 0.90. He delivers a lecture as if it were a gift, and is offended when nobody unwraps it.
- **Y1:** M001, M013 (phone).
- **Model notes:** soften the male base's gym shoulders for him; he should read strong but not sculpted. The cap sits low, hiding the hairline.

### `npc.roomie.m` — Bature · 19 · `CANON`

- **Body:** `man`, height ×0.95, slight.
- **Skin / hair:** deep `#7a4e34`; black.
- **Outfit:** yellow `#f2c230` tee · yellow `#f2c230` sleeves · black `#2b2b2b` trousers · off-white `#e9e4d8` shoes · off-white `#e9e4d8` socks.
- **Headwear:** none.
- **Extras:** none (biscuits are a hand prop, added per scene).
- **Silhouette:** short, compact, always slightly mid-gesture.
- **Voice / acting:** young Hausa-English joker, 19; quick, playful, rises on punchlines. Pitch 1.08, rate 1.10. He narrates badly and confidently. Physical comedy: he eats while talking, points with his chin, and never sits still for a full sentence.
- **Y1:** M001, M003, M006, M007, M008, M011, M012, M013, M014, M015, M016, M018 (as `npc.bature`), M022, M023.
- **Model notes:** the yellow tee is the identifying colour; keep it clean in interiors and slightly dusty outdoors. He is the male-player roomie only.

### `npc.roomie.f` — Firdausi · 19 · `CANON`

- **Body:** `womancasual`, height ×0.96.
- **Skin / hair:** deep `#7a4e34`; black (hidden).
- **Outfit:** rose `#e98a8a` top · indigo-navy `#3a3a5a` trousers · off-white `#f4f1ea` shoes · off-white `#f4f1ea` socks.
- **Headwear:** hijab, burgundy `#7a2e3b`.
- **Extras:** none.
- **Silhouette:** small, tidy, precise; moves like she has already planned the route.
- **Voice / acting:** brisk young northern woman, 19; teasing, protective. Pitch 1.16, rate 1.08. She manages the player's life out loud. Physical comedy: folds clothes while delivering bad news, closes doors with her heel.
- **Y1:** the female-player equivalent of every Bature scene above, and M018 (as `npc.bature` in the script; resolve by player sex).
- **Model notes:** rose + navy + burgundy hijab must stay distinct from Lyzzy's rose outfit. Firdausi is tidier: no loose sleeves.

### `npc.partner_or_roomie` — Your person · `ALIAS`

- **Resolves to:** `npc.roomie.m` (Bature) for a male player, `npc.roomie.f` (Firdausi) for a female player, or the chosen romance interest if the player has one.
- **Use:** M021 only (the wingman mission). Never create a separate model.
- **Acting note:** they are the person who knows the player best; the performance should feel like a private joke, not a date.

> **Script note:** `npc.bature` is a public/script alias for the male roomie. Resolve it to `npc.roomie.m`; never build a second Bature.

---

## 3. Gate, hall and administration

### `npc.gate_guard` — Gate guard · 45 · `CANON`

- **Body:** `manlong`, 1.00.
- **Skin / hair:** deep `#7a4e34`; black.
- **Outfit:** khaki `#7d7350` uniform shirt · dark olive `#4f4a36` trousers.
- **Headwear:** cap, dark olive `#4f4a36`. **Extras:** none.
- **Silhouette:** a rectangular man in surplus khaki; cap pulled down; hands on a barrier he does not intend to lift.
- **Voice / acting:** Hausa-accented security man, 45; bored, unhurried. Pitch 0.70, rate 0.86. He has heard every excuse and is saving his energy for none of them.
- **Y1:** M001.
- **Model notes:** keep the uniform baggy; the comedy is in the stillness.

### `npc.baba_porter` — Baba Porter (Mr. Okon) · 60 · `CANON`

- **Body:** `manlong`, 1.00, lean.
- **Skin / hair:** tan `#8d5b3c`; grey `#8f8a84`.
- **Outfit:** faded blue `#4f6a8a` shirt · dark slate `#2e3a48` trousers.
- **Headwear:** cap, dark slate `#2e3a48`. **Extras:** none.
- **Silhouette:** thin, angular, cap down, one arm permanently ready for a bag.
- **Voice / acting:** older Nigerian porter, 60; gruff, exact, short breath between phrases. Pitch 0.66, rate 0.84, pause 0.22. He does not stop walking to talk. Every line is a procedure.
- **Y1:** M001, M003, M022.
- **Model notes:** the Ghana-must-go bag is a scene prop, not an extra; it must ride on his head without intersecting the cap.

### `npc.garba` — Malam Garba · 62 · `CANON`

- **Body:** `manlong`, ×0.95, small and upright.
- **Skin / hair:** tan `#8d5b3c`; grey.
- **Outfit:** muted brown `#8a5a3a` shirt · muted brown `#8a5a3a` trousers.
- **Headwear:** white `#f4f1ea` cap. **Extras:** ledger.
- **Silhouette:** a small vertical line behind a large desk; the ledger is the only thing that moves.
- **Voice / acting:** Senate porter, 62; "Hm." is a paragraph. Pitch 0.62, rate 0.80, pause 0.35. He looks at people a beat too long. The stamp hand stops in mid-air.
- **Y1:** M002, M024.
- **Model notes:** ledger must have a visible dark cover and cream pages; it is the scene's only warm object.

### `npc.mrs_adebayo` — Mrs. Adebayo · 55 · `CANON`

- **Body:** `womandress`, 1.00.
- **Skin / hair:** medium `#a06a46`; black (hidden).
- **Outfit:** dark indigo `#1f3c66` dress · off-white `#e9e4d8` trim · gold `#d4af37` belt.
- **Headwear:** hijab matching the dress `#1f3c66`. **Extras:** glasses.
- **Silhouette:** a clerk behind glass: navy, gold at the edges, reading glasses, no wasted motion.
- **Voice / acting:** Yoruba registry clerk, 55; bored, flat, final. Pitch 0.86, rate 0.88, pause 0.20. She repeats the requirement without raising her voice. She never looks up from the form.
- **Y1:** M002.
- **Model notes:** glasses must catch light; the counter hides everything below the waist, so the dress cut only needs to read at the shoulders.

### `npc.mr_clement` — Mr. Clement · 50 · `CANON`

- **Body:** `mansuit`, 1.00.
- **Skin / hair:** honey `#c68a5e`; black.
- **Outfit:** slate-grey `#56606a` shirt/jacket · black `#2b2b2b` trousers.
- **Headwear:** none. **Extras:** glasses.
- **Silhouette:** narrow, pressed, a man made of forms.
- **Voice / acting:** bursary officer, 50; one word at a time. Pitch 0.84, rate 0.82. "Network." He waits for the word to do its work.
- **Y1:** M002.
- **Model notes:** no tie in the slot list; keep the collar closed and plain.

### `npc.sug_porter` — SUG porter · 58 · `CANON`

- **Body:** `manlong`, 1.00.
- **Skin / hair:** tan `#8d5b3c`; grey.
- **Outfit:** deep green `#1f6b52` shirt · black `#2b2b2b` trousers.
- **Headwear:** white `#f4f1ea` cap. **Extras:** none.
- **Silhouette:** a man coming back from prayers, still carrying the calm.
- **Voice / acting:** older porter, 58; flat, practical, faintly amused. Pitch 0.72, rate 0.88.
- **Y1:** M010.
- **Model notes:** the green is the SUG colour; keep it distinct from Jega's football green.

### `npc.eng_clerk` — Results clerk · 30s · `PROPOSED`

- **Body:** `womancasual`, 1.00.
- **Skin / hair:** medium `#a06a46`; black (hidden).
- **Outfit:** indigo `#1f3c66` top · black `#2b2b2b` trousers · off-white `#f4f1ea` shoes · off-white `#f4f1ea` socks.
- **Headwear:** hijab, cream `#e9e4d8`. **Extras:** folder.
- **Silhouette:** efficient, half-hidden by a noticeboard; the folder is a shield.
- **Voice / acting:** registry-adjacent, tired, kind underneath. Short sentences, no eye contact until the result is found.
- **Y1:** M013.
- **Model note:** do not reuse Mrs. Adebayo's exact navy/cream; this clerk is younger and softer.

### `npc.khadija` — Dr. Khadija · 52 · `PROPOSED`

- **Body:** `womandress`, height ×1.04, tall and upright.
- **Skin / hair:** medium `#a06a46`; black (hidden).
- **Outfit:** navy office abaya `#1f3c66` · cream trim `#e9e4d8` · gold belt `#d4af37`.
- **Headwear:** hijab, navy `#1f3c66`. **Extras:** glasses.
- **Silhouette:** a vertical, uncluttered line; shoulders back; files squared under one arm.
- **Voice / acting:** northern woman, 50s; stern, unhurried, on your side. Short sentences that land like stamps. "My office. Now. Bring yourself." She straightens objects while listening.
- **Y1:** M013.
- **Model notes:** she must read older than Nusaiba and Aleeya at a glance: darker palette, no jewellery, flat shoes. Glasses are essential.

### `npc.dean_eng` — Dean of Engineering · 60 · `PROPOSED`

- **Body:** `mansuit`, 1.00.
- **Skin / hair:** tan `#8d5b3c`; grey.
- **Outfit:** black `#2b2b2b` suit · off-white `#e9e4d8` shirt.
- **Headwear:** none. **Extras:** glasses.
- **Silhouette:** broad, ceremonial, slightly tired; a man who has given this speech before and will give it again.
- **Voice / acting:** formal, warm at the edges, projectorial. Speaks in completed paragraphs; pauses for applause that may not come.
- **Y1:** M024.
- **Model notes:** the only character besides the Maker who should look comfortable in a suit. Keep the grey hair and glasses.

### `npc.examiner` — Licence examiner · 50 · `PROPOSED`

- **Body:** `mansuit`, 1.00.
- **Skin / hair:** honey `#c68a5e`; grey.
- **Outfit:** slate `#56606a` suit · black `#2b2b2b` trousers.
- **Headwear:** cap, black `#2b2b2b`. **Extras:** folder.
- **Silhouette:** a clipboard with legs; stands too close to the keke.
- **Voice / acting:** bureaucratic, nasal, delighted by rules. Reads offences aloud as if they were poetry.
- **Y1:** M017.
- **Model notes:** keep him physically unremarkable; the comedy is the authority, not the body.

### `npc.bilkisu` — Sgt. Bilkisu · 40 · `OUT OF SCOPE (Y1)`

- Head of campus security; does not appear in Year 1. Do not add her to a Y1 scene. Listed here only so a downstream AI does not confuse her with the gate guard.

---

## 4. Friends, classmates and the friend group

### `npc.aleeya` — Aleeya · 19 · `CANON`

- **Body:** `womancasual`, ×1.05, tall.
- **Skin / hair:** light `#d9a77c`; black (hidden).
- **Outfit:** violet `#5b4ba8` top · black `#2b2b2b` trousers · off-white `#f4f1ea` shoes · off-white `#f4f1ea` socks.
- **Headwear:** hijab, soft lilac `#c9b8e8`. **Extras:** none (a shoulder bag is scene-specific; do not make it permanent).
- **Silhouette:** tall, soft-shouldered, always carrying something for somebody else.
- **Voice / acting:** architecture student, 19; supportive, then the punchline. Pitch 1.06, rate 1.02. She laughs before her own jokes and stops herself. Warm, open posture; offers food and holds bags without being asked.
- **Y1:** M002, M017.
- **Model notes:** lilac hijab + violet top is a two-tone read; keep the trousers black so she does not become "the purple person".

### `npc.muhammad` — Muhammad · 20 · `CANON`

- **Body:** `manlong`, 1.00, neat.
- **Skin / hair:** tan `#8d5b3c`; black.
- **Outfit:** off-white `#fbfbf8` shirt · black `#2b2b2b` trousers.
- **Headwear:** none. **Extras:** none.
- **Silhouette:** bright white vertical; shoes always clean; hands loose at his sides.
- **Voice / acting:** soft-spoken, unhurried, apologetic; nearly a whisper. Pitch 0.96, rate 0.86, volume 0.72, pause 0.30. He says "sorry" before helping. He is never startled and never in a hurry.
- **Y1:** M001 (background at the gate), M002, M011, M016, M024.
- **Model notes:** the white must stay clean in every scene, including the dam at night — that is the point of him. Do not give him dirt, sweat or a bag.

### `npc.shamsu` — Shamsu · 19 · `CANON`

- **Body:** `manlong`, 1.00, slim.
- **Skin / hair:** honey `#c68a5e`; black.
- **Outfit:** off-white `#f4f1ea` shirt · off-white `#f4f1ea` trousers.
- **Headwear:** white `#f4f1ea` cap. **Extras:** glasses, pens.
- **Silhouette:** a pressed white kaftan, glasses, three pens; narrow shoulders; stands very still when thinking.
- **Voice / acting:** earnest genius, 19; precise diction, a whisper that explains too much. Pitch 1.00, rate 1.04. He answers the question he wishes you had asked. Adjusts his glasses with one finger; writes in the air while talking.
- **Y1:** M005, M008, M011, M012, M019, M023, M024.
- **Model notes:** pens must sit in the chest pocket without z-fighting. Glasses are identity; never remove them for a "cool" beat.

### `npc.nusaiba` — Nusaiba · 19 · `CANON`

- **Body:** `womancasual`, 1.00.
- **Skin / hair:** light `#d9a77c`; black (hidden).
- **Outfit:** indigo `#1f3c66` top · black `#2b2b2b` trousers · black `#2b2b2b` shoes · black `#2b2b2b` socks.
- **Headwear:** off-white `#e9e4d8` hijab. **Extras:** folder.
- **Silhouette:** navy with a cream hijab; folder held square; a walking agenda.
- **Voice / acting:** law student, 19; clear, complete sentences, courtroom polite. Pitch 1.02, rate 0.98. She numbers her points out loud. She does not fidget; she waits.
- **Y1:** M005, M012, M019.
- **Model notes:** the folder is always present in M005/M012; in M019 she can leave it. Keep her posture straighter than Aleeya's.

### `npc.maryam` — Maryam · 20 · `CANON`

- **Body:** `womancasual`, 1.00.
- **Skin / hair:** light `#d9a77c`; black (hidden).
- **Outfit:** teal `#3e8e9e` top · black `#2b2b2b` trousers · brown `#8a5a3a` shoes · brown `#8a5a3a` socks.
- **Headwear:** hijab matching the top `#3e8e9e`. **Extras:** bag.
- **Silhouette:** teal from top to hijab, a bag of books on one shoulder, head tilted as she reads while walking.
- **Voice / acting:** English student, 20; thoughtful, teasing. Pitch 1.04, rate 0.98. She asks "Have you read…?" and means it. Offers yam in any crisis. Stillness with a book; sudden focus when a sentence interests her.
- **Y1:** M004 (bookshop/lawn), and ambient campus.
- **Model notes:** the bag must hang low and heavy; it is part of her silhouette. Keep the teal distinct from Zainab's scrubs.

### `npc.lyzzy` — Lyzzy · 19 · `CANON`

- **Body:** `animwoman`, 1.00.
- **Skin / hair:** caramel `#b5794f`; black.
- **Outfit:** rose `#e98a8a` top · off-white `#f4f1ea` trousers · orange `#d9622b` trim · off-white `#f4f1ea` shoes.
- **Headwear:** none. **Extras:** camera.
- **Silhouette:** bright, bouncy, permanently holding a camera; free hand always About to gesture.
- **Voice / acting:** Mass Comm twin, 19; delighted, quick, loud. Pitch 1.20, rate 1.14, volume 1.0. "Don't move! Your face is a moment!" She narrates other people's lives. Reapplies lip gloss in moments of shock.
- **Y1:** M004, M018, M020.
- **Model notes:** the camera is a small black box with a lens ring; it must read at 10 m. Never let the strap clip through the shoulder.

### `npc.lily` — Lily · 19 · `CANON`

- **Body:** `animwoman`, 1.00.
- **Skin / hair:** caramel `#b5794f`; black.
- **Outfit:** green `#2f8a4c` top · off-white `#e9e4d8` trousers · sand `#c9b896` trim · brown `#8a5a3a` shoes.
- **Headwear:** none. **Extras:** none (watering can is a scene prop).
- **Silhouette:** Lyzzy's calmer mirror: green and sand, hands usually lower, weight on one hip.
- **Voice / acting:** Botany twin, 19; very soft, slow, sure. Pitch 1.10, rate 0.84, volume 0.70, pause 0.30. She speaks last and is right. Whispers to plants; apologises to weeds.
- **Y1:** M004, M020.
- **Model notes:** same face structure as Lyzzy but a different centre of gravity. Do not make them identical twins in posture; identical in features only.

### `npc.idris` — Idris · 18 · `CANON`

- **Body:** `hoodie`, 1.00.
- **Skin / hair:** honey `#c68a5e`; black.
- **Outfit:** slate `#56606a` hoodie · black `#2b2b2b` trim · indigo `#1f3c66` trousers.
- **Headwear:** none. **Extras:** none (hood up is an animation state).
- **Silhouette:** hoodie pulled up, hands in pockets, shoulders rounded.
- **Voice / acting:** shy fresher, 18; small voice. Pitch 1.06, rate 0.90, volume 0.75. He answers in the fewest words and looks at the floor, then at the door.
- **Y1:** M003.
- **Model notes:** the hood is part of the hoodie mesh; do not add a separate hat.

### `npc.abbas` — Abbas ("John Carter") · 20 · `CANON`

- **Body:** `farmer`, 1.00.
- **Skin / hair:** honey `#c68a5e`; black.
- **Outfit:** blue overalls `#2a5fa8` · off-white `#e9e4d8` shirt · indigo `#1f3c66` trousers · blue `#2a5fa8` hat · blue `#2a5fa8` scarf.
- **Headwear:** farmer hat (from the model), blue. **Extras:** spanner.
- **Silhouette:** patient, exact, a spanner in one hand like a pen; stands as if measuring the floor.
- **Voice / acting:** mechanical-engineering student, 20; flat and exact, like a clock. Pitch 0.88, rate 0.90. Corrects his own name quietly. Never rushes a repair or a sentence.
- **Y1:** M005, M007, M014.
- **Model notes:** the farmer model's hat + scarf must not read "farmhand"; the blue overalls make him the workshop. Keep the spanner small.

### `npc.wednesday` — Wednesday · 20 · `CANON`

- **Body:** `animwoman`, 1.00.
- **Skin / hair:** light `#d9a77c`; dark brown `#2a1d16`.
- **Outfit:** slate `#56606a` top · black `#2b2b2b` trousers · off-white `#e9e4d8` trim · black `#2b2b2b` shoes.
- **Headwear:** none. **Extras:** none (a book is scene-specific).
- **Silhouette:** grey and black, hair over the face, eyes on a page; still in a way that makes other people move.
- **Voice / acting:** calm, uncanny, kind; never looks up. Pitch 0.94, rate 0.82, volume 0.75, pause 0.30. Short, final sentences. "See you Wednesday." She is not spooky; she is the only person not performing.
- **Y1:** M005, M018.
- **Model notes:** hair must fall forward and hide the eyes without clipping the face. Keep her out of direct sunlight in compositions.

### `npc.tunde` — Tunde Aro · 20 · `PROPOSED`

- **Body:** `hoodie`, ×0.98, thin.
- **Skin / hair:** medium `#a06a46`; black (short twists).
- **Outfit:** paint-speckled slate `#56606a` hoodie · charcoal `#2b2b2b` trim · charcoal `#2b2b2b` trousers.
- **Headwear:** none. **Extras:** notebook (sketchbook).
- **Silhouette:** narrow, slightly stooped, a sketchbook against the chest like a shield.
- **Voice / acting:** quiet, kind; describes things by colour. Pitch 1.02, rate 0.90, volume 0.78. He hands you a drawing instead of finishing a sentence.
- **Y1:** M011.
- **Model notes:** `PROPOSED` because `cast.ts` stops at M010. Keep him within the palette; the legacy backstory says "dark skin", which conflicts with the project's nobody-very-dark rule — use `medium` and flag the conflict for the owner.

### `npc.kelechi` — Kelechi · 21 · `PROPOSED`

- **Body:** `farmer`, ×1.04, long-limbed.
- **Skin / hair:** caramel `#b5794f`; black (high afro).
- **Outfit:** clay-stained brown overalls `#8a6a48` · sand `#c9b896` shirt · olive `#4f4a36` trousers · sand `#c9b896` hat · no scarf (set scarf to the overalls brown if the model demands a colour).
- **Headwear:** farmer hat, sand. **Extras:** none (a chisel is scene-specific).
- **Silhouette:** tall, loose, clay on the forearms; hands always slightly in front of him, shaping something invisible.
- **Voice / acting:** sculpture student, 21; slow, amused, Igbo flavour. Pitch 0.92, rate 0.86. "Clay doesn't rush." He describes people as stone and means it kindly.
- **Y1:** M020.
- **Model notes:** the overalls should look worked-in, not clean. `PROPOSED`; the model needs a high-afro hair variant that the current hair mesh may not provide — if unavailable, use short black hair and note the gap.

### `npc.basit` — Basit · 20 · `PROPOSED`

- **Body:** `casual`, 1.00, slim.
- **Skin / hair:** caramel `#b5794f`; black (high fade).
- **Outfit:** teal `#3e8e9e` game tee · burgundy `#a83232` sleeves · black `#2b2b2b` trousers · off-white `#f4f1ea` shoes.
- **Headwear:** cap backwards, black `#2b2b2b`. **Extras:** none (tokens are a hand prop).
- **Silhouette:** compact, forward-leaning, hands ready for a controller.
- **Voice / acting:** arcade champion, 20; playful, competitive, Hausa flavour. "Rematch." "Best of three." He blows on tokens; refuses odd-numbered machines.
- **Y1:** M017.
- **Model notes:** `PROPOSED`; the backwards cap is a rotation of the cap mesh, not a second model.

### `npc.helen` — Helen ("IDK") · 22 · `CANON`

- **Body:** `animwoman`, ×0.95, short, athletic.
- **Skin / hair:** caramel `#b5794f`; black.
- **Outfit:** blue `#2a5fa8` top · black `#2b2b2b` trousers · off-white `#f4f1ea` trim · off-white `#f4f1ea` shoes.
- **Headwear:** none. **Extras:** volleyball.
- **Silhouette:** compact, balanced, a ball on one hip; stands like she is about to move sideways.
- **Voice / acting:** volleyball captain, 22; calm, amused, unhurried; answers questions with questions. "Who's asking?" Pitch 1.08, rate 1.0. She lets a silence do the work.
- **Y1:** M008, M021.
- **Model notes:** the ball must be held, not floating. Her short height is canon; do not "correct" it.

### `npc.jega` — Jega · 19 · `CANON`

- **Body:** `casual`, ×1.05, lean footballer.
- **Skin / hair:** tan `#8d5b3c`; black.
- **Outfit:** green `#2f8a4c` shirt · white `#f4f1ea` sleeves · white `#f4f1ea` trousers · black `#2b2b2b` shoes.
- **Headwear:** none. **Extras:** `jersey10`.
- **Silhouette:** lean, long-strided, number 10 on the back; one boot always slightly forward.
- **Voice / acting:** Hausa-English footballer, 19; warm, quick, code-switches. Pitch 0.92, rate 1.06. Superstitious about the left boot. He talks while jogging and expects you to keep up.
- **Y1:** M008, M009, M012, M019, M021.
- **Model notes:** `jersey10` is a prop layer; make sure the number reads from behind and does not stretch at the shoulders.

### `npc.mubarak` — Mubarak ("the Plug") · 19 · `CANON`

- **Body:** `casual`, 1.00.
- **Skin / hair:** deep `#7a4e34`; black.
- **Outfit:** mustard `#e0a526` shirt · burgundy `#a83232` sleeves · indigo `#1f3c66` trousers · off-white `#f4f1ea` shoes.
- **Headwear:** none. **Extras:** sunglasses, bumbag.
- **Silhouette:** the loudest person on the walkway: gold and burgundy, shades, bumbag, hands busy.
- **Voice / acting:** Pidgin-English salesman, 19; fast, bright, everything is premium. Pitch 1.04, rate 1.16. He turns every sentence into a pitch and every price into a story.
- **Y1:** M004, M010, M012.
- **Model notes:** sunglasses must sit on the face, not float. The bumbag is worn cross-body; it is his shop.

### `npc.bolaji` — Bolaji / Big Sly · 25 · `CANON`

- **Body:** `hoodie`, ×1.06, **width ×1.18** — the only wide character.
- **Skin / hair:** tan `#8d5b3c`; black.
- **Outfit:** black `#2b2b2b` hoodie · burgundy `#a83232` trim · black `#2b2b2b` trousers.
- **Headwear:** none. **Extras:** none.
- **Silhouette:** genuinely huge; shoulders first, then the rest of him; hands like a bouncer's, posture like a nervous host.
- **Voice / acting:** 25; huge, performative, third person; secretly gentle. Pitch 0.55, rate 0.92. "Sly is sorry." Cracks his knuckles, then apologises to them.
- **Y1:** M007, M012, M014.
- **Model notes:** width applies to x/z only. Do not scale the head; keep the head at normal size so the body reads huge. He must not clip through doorframes in M012; widen the door clearance or use a side-on staging.

### `npc.hassan` — Hassan · 20 · `CANON`

- **Body:** `manlong`, ×0.98, thin.
- **Skin / hair:** honey `#c68a5e`; black.
- **Outfit:** sky blue `#86b7e0` shirt · slate `#56606a` trousers.
- **Headwear:** none. **Extras:** notebook.
- **Silhouette:** narrow, blue shirt, always writing; a deputy who has already recorded your name.
- **Voice / acting:** 20; bored clerk voice. Pitch 1.12, rate 1.02. Reads offences from a notebook he never opens.
- **Y1:** M007, M014.
- **Model notes:** the notebook is always in the left hand; the pen is implied, not modelled.

### `npc.lula` — Lula Ajaka · 60 · `PROPOSED`

- **Body:** `manlong`, ×0.98, round.
- **Skin / hair:** honey `#c68a5e`; grey `#8f8a84`.
- **Outfit:** sand `#c9b896` kaftan · olive `#4f4a36` trousers.
- **Headwear:** cap, sand `#c9b896`. **Extras:** none.
- **Silhouette:** round, soft, a storyteller's belly and a hand permanently mid-gesture.
- **Voice / acting:** 60; soft, the best listener on campus; repeats your last three words back, kindly. Gives directions with total confidence and the wrong hand.
- **Y1:** M017.
- **Model notes:** `PROPOSED`. The legacy/seeded bio calls him "sixties, retired"; the mission plays him as part of a couple on a keke. Keep him older than the students but physically capable of the comedy. No beard extra exists; if a beard is required, it needs a new mesh, not a colour.

### `npc.faty` — Faty Ajaka · 58 · `PROPOSED`

- **Body:** `womandress`, ×0.97, round.
- **Skin / hair:** caramel `#b5794f`; black (hidden).
- **Outfit:** rust `#d9622b` dress · mustard `#e0a526` trim · gold `#d4af37` belt.
- **Headwear:** hijab, burgundy `#a83232`. **Extras:** glasses.
- **Silhouette:** round face, round glasses, a laugh that starts before the joke lands.
- **Voice / acting:** quick, loud laugh; "Write that down!" She keeps the joke book. Sits close to Lula, corrects him with love and a pencil.
- **Y1:** M017.
- **Model notes:** `PROPOSED`. Glasses are essential. Keep her palette distinct from Mama Nkechi's orange/green and Big Baby's rose/black.

### `npc.small_boy` — Ball boy · 11 · `PROPOSED / RIG GAP`

- **Body:** no child rig exists. If he must be on screen, use the shortest allowed adult scale (0.94), `casual`, honey `#c68a5e`, black hair, green `#2f8a4c` shirt, black shorts/trousers, off-white shoes.
- **Silhouette:** small, quick, always at the edge of the pitch.
- **Voice / acting:** a shout, not a scene; he retrieves the ball and is gone.
- **Y1:** M019.
- **Model note:** do **not** scale the shared adult rig below 0.94; it breaks the one-scale rule and the animation. Either add a child body or keep him at the frame edge / off-screen voice.

### `npc.sophomore` — A customer · 20 · `CANON`

- **Body:** `hoodie`, 1.00.
- **Skin / hair:** caramel `#b5794f`; black.
- **Outfit:** teal `#3e8e9e` hoodie · cream `#f4f1ea` trim · black `#2b2b2b` trousers.
- **Headwear:** none. **Extras:** none.
- **Silhouette:** a second-year with a complaint and a receipt.
- **Voice / acting:** bored, entitled, not cruel. Pitch 0.98, rate 1.00.
- **Y1:** M010.
- **Model notes:** deliberately generic; he is a queue, not a character.

### `npc.kabiru` — DJ Kabiru · 48 · `PROPOSED`

- **Body:** `manlong`, 1.00, solid.
- **Skin / hair:** medium `#a06a46`; black with grey (use grey `#8f8a84` for the read).
- **Outfit:** burgundy `#7a2e3b` shirt · black `#2b2b2b` trousers.
- **Headwear:** none. **Extras:** phone (a stand-in for headphones; if headphones are added, they are a new prop).
- **Silhouette:** a voice with a body: broad, relaxed, one hand on the desk, one on the fader.
- **Voice / acting:** station head, late 40s; velvet on air, shy off air. Pitch 0.82, rate 0.88. "You're on the Ring Road." Speaks in station idents.
- **Y1:** M018.
- **Model notes:** `PROPOSED`; he is the only Year 1 character who needs a broadcast booth performance, so keep his gestures small and below the desk line.

---

## 5. Lecturers, medical and sport staff

### `npc.law_lecturer` — Law lecturer · 58 · `CANON`

- **Body:** `mansuit`, 1.00.
- **Skin / hair:** honey `#c68a5e`; grey `#8f8a84`.
- **Outfit:** black `#2b2b2b` suit · black `#2b2b2b` trousers.
- **Headwear:** none. **Extras:** glasses.
- **Silhouette:** a dark suit and a pause; hands behind the back; enjoys the room before he speaks.
- **Voice / acting:** dry senior lecturer, 58; enjoys the room's laughter. Pitch 0.82, rate 0.90. He delivers the wrong-theatre joke as if it were case law.
- **Y1:** M005.
- **Model notes:** all-black suit needs a slight fabric sheen or he becomes a silhouette. Keep the glasses.

### `npc.okonkwo` — Dr. Okonkwo · 45 · `CANON`

- **Body:** `womandress`, 1.00.
- **Skin / hair:** caramel `#b5794f`; black.
- **Outfit:** burgundy `#7a2e3b` dress · off-white `#e9e4d8` trim · gold `#d4af37` belt.
- **Headwear:** none. **Extras:** glasses.
- **Silhouette:** upright, brisk, a lecturer who has already graded you in her head.
- **Voice / acting:** Igbo engineering lecturer, 45; brisk, dry, fair. Pitch 0.90, rate 0.98. "Page forty." She writes on the board without turning around.
- **Y1:** M005, M020.
- **Model notes:** burgundy + gold reads senior; keep her distinct from Dr. Khadija's navy and Hajiya Ladi's violet.

### `npc.zainab` — Dr. Zainab · 25 · `LOCKED`

- **Body:** `womancasual`, 1.00.
- **Skin / hair:** **`#f1d6c2` — LOCKED, "Snow White", never darken or warm it.** Hair black (hidden).
- **Outfit:** teal `#3e8e9e` scrubs top · teal `#3e8e9e` trousers · off-white `#f4f1ea` shoes · off-white `#f4f1ea` socks.
- **Headwear:** hijab, black `#2b2b2b`. **Extras:** stethoscope, torch.
- **Silhouette:** bright, pale, precise; teal scrubs, black hijab, stethoscope round the neck; stands with her weight forward, ready to leave.
- **Voice / acting:** young house officer, 25; warm, quick, clinical when it matters. Pitch 1.08, rate 1.06. "Doctor's orders." She diagnoses you with her eyebrows before she speaks.
- **Y1:** M009 (A&E), M018 (voice on the radio), M019 (medical cover), M023 (hospital).
- **Model notes:** a test asserts her skin tone. Do not change it for lighting, colour grade, "realism" or a night scene; if the scene is dark, lift the key light, not the skin. The hijab's face oval leaves a sliver of far cheek at the temples — check in 3/4 view.

### `npc.hauwa` — Nurse Hauwa · 40 · `CANON`

- **Body:** `womandress`, 1.00.
- **Skin / hair:** medium `#a06a46`; black (hidden).
- **Outfit:** off-white `#f4f1ea` dress · light blue `#86b7e0` trim · light blue `#86b7e0` belt.
- **Headwear:** white `#f4f1ea` hijab. **Extras:** none.
- **Silhouette:** white and blue, tired but immaculate, at 3 a.m.; a clipboard where other people have hands.
- **Voice / acting:** night nurse, 40; unshockable, flat. Pitch 0.90, rate 0.90. "Doctor is coming. Sit." She has seen worse and will see worse again before breakfast.
- **Y1:** M009.
- **Model notes:** keep the whites clean; the blue trim is the only colour. Do not give her a cape or a coat.

### `npc.ngozi` — Coach Ngozi · 35 · `PROPOSED`

- **Body:** `animwoman`, 1.00, athletic.
- **Skin / hair:** caramel `#b5794f`; black (pulled back).
- **Outfit:** teal `#3e8e9e` top · black `#2b2b2b` trousers · off-white `#f4f1ea` trim · off-white `#f4f1ea` shoes.
- **Headwear:** none. **Extras:** whistle.
- **Silhouette:** compact, coiled, a whistle and a stopwatch; never sits on the bench properly.
- **Voice / acting:** gym trainer, 35; dry, commanding, secretly encouraging. "Garri is not a food group." Counts reps as if they were a personal insult.
- **Y1:** M014.
- **Model notes:** `PROPOSED`; teal keeps her in the sports palette without matching Zainab's scrubs. Whistle is a neck prop.

### `npc.danladi` — Coach Danladi · 50 · `CANON`

- **Body:** `manlong`, 1.00, barrel-chested.
- **Skin / hair:** tan `#8d5b3c`; black.
- **Outfit:** red `#a83232` shirt · black `#2b2b2b` trousers.
- **Headwear:** cap, black `#2b2b2b`. **Extras:** whistle.
- **Silhouette:** a wall of red on the touchline; arms crossed until the exact moment he explodes.
- **Voice / acting:** football coach, 50; shouts in proverbs. Pitch 0.76, rate 1.00, volume 1.0. "Pass! Is the ball your inheritance?" He times everything, including meals.
- **Y1:** M008, M019.
- **Model notes:** the whistle must be visible against the red shirt; use a light cord.

---

## 6. Traders, workers and the town

### `npc.mama_nkechi` — Mama Nkechi · 50 · `CANON`

- **Body:** `womandress`, ×0.94 (short), broad.
- **Skin / hair:** caramel `#b5794f`; black (hidden).
- **Outfit:** orange `#d9622b` dress · green `#2f8a4c` trim · gold `#e0a526` belt.
- **Headwear:** hijab, green `#2f8a4c`. **Extras:** apron.
- **Silhouette:** short, wide, bright orange; a pot in one hand and judgment in the other.
- **Voice / acting:** Igbo buka owner, 50; warm, loud, threatens with love. Pitch 0.94, rate 1.00. "You have eaten? Don't lie to me." She feeds first, asks later.
- **Y1:** M003.
- **Model notes:** the apron must sit over the dress, not replace it. She is the warmest colour in any scene; protect her orange from the grade.

### `npc.suya_man` — Suya man · 40 · `CANON`

- **Body:** `manlong`, 1.00.
- **Skin / hair:** tan `#8d5b3c`; black.
- **Outfit:** off-white `#f4f1ea` shirt · grey-blue `#56606a` trousers.
- **Headwear:** white `#f4f1ea` cap. **Extras:** none (grill and skewers are scene props).
- **Silhouette:** pale cotton, soot at the cuffs, standing over a grill; arms wide when the goat lands.
- **Voice / acting:** Hausa grill man, 40; panicked shout. Pitch 1.0, rate 1.15, volume 1.0. "Not the yaji! NOT THE YAJI!" He is a one-line aria.
- **Y1:** M001.
- **Model notes:** soot is a texture/stain, not a separate outfit. Do not make him a chef; he is a street grill.

### `npc.malam_sule` — Malam Sule · 55 · `CANON`

- **Body:** `farmer`, 1.00.
- **Skin / hair:** tan `#8d5b3c`; grey.
- **Outfit:** brown `#8a6a48` overalls · sand `#c9b896` shirt · dark olive `#4f4a36` trousers · sand `#c9b896` hat · red `#a83232` scarf.
- **Headwear:** farmer hat, sand. **Extras:** none.
- **Silhouette:** weathered, patient, a man who has caught this goat before and will catch it again.
- **Voice / acting:** Hausa farmhand, 55; weary, dry, kind underneath. Pitch 0.74, rate 0.86, pause 0.20. "People don't, you know." He says the odd line as if repeating it for someone behind you.
- **Y1:** M001.
- **Model notes:** the red scarf is the only saturated thing on him; keep it. The hat must read rural, not academic.

### `npc.needle` — Alhaji Needle · 60 · `CANON`

- **Body:** `mansuit`, 1.00.
- **Skin / hair:** tan `#8d5b3c`; grey.
- **Outfit:** off-white `#e9e4d8` shirt/jacket · off-white `#e9e4d8` trousers.
- **Headwear:** cap, green `#2f8a4c`. **Extras:** glasses.
- **Silhouette:** immaculate off-white, a tape measure round the neck, a tailor's calm.
- **Voice / acting:** Hausa tailor, 60; warm, unbothered, blesses everything. Pitch 0.80, rate 0.88. "Come back Thursday." He decides your colour for you.
- **Y1:** M004.
- **Model notes:** add the tape measure as a thin scene prop if possible; otherwise the white + green cap reads tailor.

### `npc.mai_shayi` — Mai Shayi Audu · 70 · `CANON`

- **Body:** `manlong`, ×0.96, thin.
- **Skin / hair:** tan `#8d5b3c`; grey.
- **Outfit:** sand `#c9b896` shirt · sand `#c9b896` trousers.
- **Headwear:** cap, burgundy `#7a2e3b`. **Extras:** none (kettle is a scene prop).
- **Silhouette:** small, thin, sandy cotton, a kettle always near; sits like the bench belongs to him.
- **Voice / acting:** old tea seller, 70; slow, warm, storyteller's pauses. Pitch 0.70, rate 0.80, pause 0.40. "Tea first. Gist second." He pours from a great height.
- **Y1:** M006, M024.
- **Model notes:** the oldest-looking character in Year 1; use grey hair and a slight stoop, but keep the height rule.

### `npc.hajiya_ladi` — Hajiya Ladi · 58 · `CANON`

- **Body:** `womandress`, 1.00.
- **Skin / hair:** medium `#a06a46`; black (hidden).
- **Outfit:** violet `#5b4ba8` dress · mustard `#e0a526` trim · gold `#d4af37` belt.
- **Headwear:** mustard `#e0a526` hijab. **Extras:** none.
- **Silhouette:** the market's queen: violet and gold, upright, unhurried; counts money without looking.
- **Voice / acting:** head of the traders, 58; formidable, fair, measured. Pitch 0.80, rate 0.86, pause 0.25. "Last price." She does not haggle; she decides.
- **Y1:** M010.
- **Model notes:** violet + mustard is a strong read; keep the gold to the belt so she does not become a Christmas tree.

### `npc.tanko` — Tanko · 45 · `CANON`

- **Body:** `man`, 1.00.
- **Skin / hair:** tan `#8d5b3c`; black.
- **Outfit:** brown `#8a5a3a` shirt · sand `#c9b896` sleeves · olive `#4f4a36` trousers · black `#2b2b2b` shoes · black `#2b2b2b` socks.
- **Headwear:** cap, sand `#c9b896`. **Extras:** none.
- **Silhouette:** a gatepost with a riddle; hands folded, eyes amused, no hurry in any limb.
- **Voice / acting:** riddler, 45; deep, amused, gives nothing. Pitch 0.72, rate 0.88, pause 0.30. "Which?" He answers a question with a better question.
- **Y1:** M006, M020.
- **Model notes:** keep him still; the comedy is the pause. Do not give him a staff or a mystical prop.

### `npc.big_baby` — Big Baby · 26 · `CANON`

- **Body:** `womandress`, ×0.94 (smallest adult), compact.
- **Skin / hair:** medium `#a06a46`; black (hidden).
- **Outfit:** rose `#e98a8a` dress · black `#2b2b2b` trim · gold `#d4af37` belt.
- **Headwear:** black `#2b2b2b` hijab. **Extras:** apron.
- **Silhouette:** very small, very still, pink and black; the stillest person in any room.
- **Voice / acting:** salon owner, 26; quiet, final, terrifying. Pitch 0.88, rate 0.78, pause 0.40. "Bolaji. Outside." She does not raise her voice; the room lowers itself.
- **Y1:** M007, M014.
- **Model notes:** smallest adult in the game; do not make her childlike. The apron and the gold belt are the read.

### `npc.kb` — KB · 45 · `CANON`

- **Body:** `man`, 1.00.
- **Skin / hair:** honey `#c68a5e`; black.
- **Outfit:** slate `#56606a` shirt · off-white `#e9e4d8` sleeves · black `#2b2b2b` trousers · black `#2b2b2b` shoes · black `#2b2b2b` socks.
- **Headwear:** none. **Extras:** none.
- **Silhouette:** a shop counter with a face; one eyebrow permanently pricing you.
- **Voice / acting:** corner-shop owner, 45; sly, prices by your face. Pitch 0.90, rate 1.00. "For your face today? ₦300." He never gives the same price twice.
- **Y1:** M010 (shop), mentioned in M003/M012.
- **Model notes:** no apron; he is not a trader with a stall, he is a kiosk. Keep him plain so the prices do the character work.

### `npc.baba_dam` — Baba Dam · 70 · `PROPOSED`

- **Body:** `manlong`, ×0.95, lean and weathered.
- **Skin / hair:** deep `#7a4e34` (darkest used); grey `#8f8a84`.
- **Outfit:** faded blue `#4f6a8a` smock · slate `#2e3a48` trousers.
- **Headwear:** cap, slate `#2e3a48`. **Extras:** none (boat, hooks and tin are scene props).
- **Silhouette:** a thin old man in faded blue, standing as if the water is always moving under him.
- **Voice / acting:** old fisherman, 70; slow and salty; speaks like the water moves. Pitch 0.70, rate 0.78, pause 0.40. "Fish don't hurry." "The water hears." He never says goodbye, only "the water".
- **Y1:** M015, M016.
- **Model notes:** `PROPOSED`. Legacy backstory says "very dark, very old"; the current project rule forbids very dark skin, so this package uses `deep` and flags the conflict. Do not solve it by making him pale.

### `npc.lawal` — Ranger Lawal · 40 · `PROPOSED`

- **Body:** `casual`, ×1.02, lean.
- **Skin / hair:** tan `#8d5b3c`; black (beard implied).
- **Outfit:** khaki `#7d7350` shirt · dark olive `#4f4a36` sleeves · olive `#4f4a36` trousers · black `#2b2b2b` shoes.
- **Headwear:** cap, dark olive `#4f4a36`. **Extras:** torch.
- **Silhouette:** khaki and a torch beam; stands in the treeline before you see him.
- **Voice / acting:** forest ranger, 40; quiet, stubborn as a baobab. Pitch 0.84, rate 0.84. "Go back." Later, "Follow my light." He greets trees by name.
- **Y1:** M015.
- **Model notes:** `PROPOSED`; a beard is not in the extras list, so either add a beard mesh or keep him clean-shaven and let the cap/torch carry the role.

### `npc.aliyu` — Engr. Aliyu ("Change-Over") · 45 · `PROPOSED`

- **Body:** `farmer`, 1.00 (overalls read "works").
- **Skin / hair:** honey `#c68a5e`; black.
- **Outfit:** works blue `#2a5fa8` overalls · sand `#c9b896` shirt · slate `#2e3a48` trousers · yellow `#f2c230` hat · no scarf (use slate if required).
- **Headwear:** farmer hat, yellow (stands in for a hard hat). **Extras:** torch.
- **Silhouette:** a decent man in overalls, slightly sweaty, a hard hat he keeps forgetting.
- **Voice / acting:** works engineer, 45; nervous. Pitch 0.86, rate 0.94. "I only switched it over." He explains too much and looks at the exit.
- **Y1:** M023.
- **Model notes:** `PROPOSED`. The farmer hat is a hard-hat stand-in; if a hard-hat mesh is added, replace it and keep the yellow.

### `npc.emeka` — Emeka · 28 · `PROPOSED`

- **Body:** `man`, 1.00.
- **Skin / hair:** tan `#8d5b3c`; black.
- **Outfit:** orange `#d9622b` shirt · black `#2b2b2b` sleeves · black `#2b2b2b` trousers · black `#2b2b2b` shoes · black `#2b2b2b` socks.
- **Headwear:** cap, orange `#d9622b`. **Extras:** none.
- **Silhouette:** a keke driver: cap, keys, one hand always ready to argue about a fare.
- **Voice / acting:** okada/keke rider, 28; fast, cheerful, philosophical about potholes. Pitch 1.0, rate 1.10.
- **Y1:** M017.
- **Model notes:** `PROPOSED`; the keke is a vehicle, not an extra. Keep him visually separate from the suya man (different hat colour and silhouette).

### `npc.maker` — The Maker · 75 · `CANON`

- **Body:** `mansuit`, 1.00, thin and upright.
- **Skin / hair:** light `#d9a77c`; grey `#8f8a84`.
- **Outfit:** pale grey `#c9ccc8` shirt/jacket · slate `#56606a` trousers.
- **Headwear:** none. **Extras:** labcoat.
- **Silhouette:** an old man in a worn white coat; narrow, still, hands visible; he takes up less space than his reputation.
- **Voice / acting:** 75; quiet, exact, dry; every word weighed. Pitch 0.58, rate 0.78, volume 0.80, pause 0.50. Short lines before the ring closes. Never a joke, never a fighter.
- **Y1:** M006, M009 (garden, hospital), M012, M015, M020, M022, M024.
- **Model notes:** the labcoat must look worn, not clinical. He is not a scientist in a clean lab; he is a caretaker in a garden. Keep his hands and face lit; he is the mystery, not a shadow.

---

## 7. Crowds and voices without bodies

### `crowd.students` — A senior / campus students · `CANON`

- **Body:** `casual`, 1.00. **Skin / hair:** caramel `#b5794f`; black.
- **Outfit:** black `#2b2b2b` shirt · orange `#d9622b` sleeves · slate `#56606a` trousers · off-white `#f4f1ea` shoes.
- **Headwear:** none. **Extras:** phone.
- **Use:** unnamed students on walkways, queues, lecture theatres, the boulevard. Always leave at least three visible near the player so the campus feels inhabited.
- **Model note:** this is a template, not a person. Vary skin (fair–deep palette), outfit colours from the campus palette, and height within ±6 %.

### `crowd.freshers` — Freshers · `VOICE + CROWD`

- **Visual:** use `crowd.students` variants with fresher signals: lanyards, paper files, over-dressed shirts, name tags, parents in the background at M001–M004.
- **Voice:** a crowd shout, young, overlapping. Pitch 1.10, rate 1.10, volume 1.0. "Faaa!" is the canonical shout.
- **Y1:** M001, M002, M003, M004.

### `crowd.families` — Families · `PROPOSED`

- **Visual:** four variants built from existing adult looks: mother in a green/gold wrapper, father in a light kaftan and cap, an aunt in indigo, a younger sibling in a school-uniform read (shirt + trousers). Keep all modest and within palette.
- **Use:** M024 convocation crowd. They are proud, phone-camera-raising, and slightly lost.
- **Model note:** do not reuse the principal cast's exact outfits; families should read as a crowd, not as doubles.

### `crowd.fans` — Stadium fans · `PROPOSED`

- **Visual:** three variants in faculty colours (green/white, blue/white, red/black), caps, one drum, one vuvuzela-like horn (prop). Faces painted in two variants maximum.
- **Use:** M019 final. They must read as a wall of colour behind the goal, not as individuals.
- **Model note:** crowd LOD can be lower; keep the palette blocks readable at distance.

### `prop.radio` — The radio · `VOICE ONLY`

- **Visual:** a small bedside radio in M003, a studio transmitter in M018. No character rig.
- **Voice:** a woman through static, 60; calm, amused, counting. Pitch 0.90, rate 0.78, volume 0.70, pause 0.45. She counts down from seven.
- **Rule:** never give the radio a face, a portrait or a "person" label. It is a prop and a voice.

---

## 8. Special characters (conditional only)

> **Hard rule:** all three are real people. Their content lives only inside `[IF special.jiya]`, `[IF special.taty]`, `[IF special.madison]` with a generic `[ELSE]`. They are never romance options, never in marketing or public screenshots, and a kill switch must remove them at once. Their current looks are placeholders until each person approves.

### `special.jiya` — Jiya · 27 · `CONDITIONAL`

- **Body:** `animwoman`, ×1.05, tall and slim.
- **Skin / hair:** light `#d9a77c`; long wavy dark brown `#3b2618` with caramel ends.
- **Outfit:** red `#a83232` top · black `#2b2b2b` trousers · off-white `#f4f1ea` shoes · off-white `#f4f1ea` socks.
- **Headwear:** cap, red `#a83232` (sunglasses pushed up on it). **Extras:** sunglasses.
- **Silhouette:** tall, composed, a lawyer's stillness with a gamer's hoodie energy; one hand holds a coffee like a case file.
- **Voice / acting:** calm British delivery; never shouts; polite, long roasts. "With respect, and I mean none." She wins arguments by standing still.
- **Y1 (conditional):** M002, M007, M017, M019 cutscenes; barks in M005, M011, M022, M023, M024.
- **Model note:** placeholder look only. Do not use her in a non-conditional render.

### `special.taty` — Taty · 24 · `CONDITIONAL`

- **Body:** `animwoman`, 1.00, fit and lively.
- **Skin / hair:** fair `#e2b892`; long straight black.
- **Outfit:** black `#2b2b2b` top · black `#2b2b2b` trousers · rose `#e98a8a` trim · off-white `#f4f1ea` shoes.
- **Headwear:** none. **Extras:** none (a cat in the hood is a scene prop).
- **Silhouette:** forward-leaning runner; a cat-shaped bulge in the hood; never still.
- **Voice / acting:** Brazilian, warm, cheeky, competitive; laughs while lapping you. "Bora!" "One more lap. I lied, two." She teases with affection.
- **Y1 (conditional):** M008, M012, M014, M016 cutscenes; barks in M001, M006, M015, M019, M022, M023, M024.
- **Model note:** placeholder look only.

### `special.madison` — Madison · 22 · `CONDITIONAL`

- **Body:** `animwoman`, 1.00, lean.
- **Skin / hair:** fair `#e2b892`; black.
- **Outfit:** off-white `#f4f1ea` top · violet `#5b4ba8` trousers · yellow `#f2c230` trim · black `#2b2b2b` shoes.
- **Headwear:** none. **Extras:** phone.
- **Silhouette:** streetwear, phone up, mid-step; a person who has already started filming.
- **Voice / acting:** very fast; Mandarin and English mid-sentence; narrates her life. "Aiya!" "Wait wait wait, film this." She turns everything into a trend.
- **Y1 (conditional):** M004 cutscene; barks in M010, M018, M021, M022, M024.
- **Model note:** placeholder look only.

> **M.I. BUGAJE (MIB)** is a special, rare owner character and does **not** appear in Year 1. Do not add him.

---

## 9. Non-human characters and character-props

### `prop.goat_sarki` — Sarki the goat · `CANON AS PROP`

- **Look:** white-faced goat, brown-and-white body, curved horns, brass bell at the neck. Bell is the audio identity (`goat_bell_fast`).
- **Scale:** shoulder roughly waist-high on the player; can stand on a suya table without clipping.
- **Rig:** quadruped, not the human skeleton. Head-butts, rears, trots, eats paper, stares.
- **Acting:** the goat is a comedian with dignity. It waits at corners, chooses the most inconvenient route, and looks the player in the eye before moving.
- **Y1:** M001.
- **Model note:** do not reuse the human rig. If no quadruped exists, block the scene with a placeholder and flag it — do not shrink a human.

### `prop.eel` — The eel · `CANON AS PROP`

- **Look:** long, dark olive-black eel, pale belly, one visible eye, a body that keeps going. Length ~3 m in the deep water; only sections are seen.
- **Movement:** slow coil, sudden turn, a head that investigates rather than attacks.
- **Y1:** M016.
- **Model note:** underwater fog and caustics do most of the work. Never show the whole animal in one shot.

### `prop.cats_ring` — The ring of cats · `CANON AS PROP`

- **Look:** seven campus cats of mixed colour (ginger, black, white-socked, grey, calico) sitting in a ring, facing **outward** in M006 and **inward** in M018.
- **Rule:** no cat is a named character; they are a system. Keep their spacing even.
- **Model note:** seven separate low-poly cats with idle tails; do not clone one model visibly.

### `prop.old_transmitter` — The old transmitter · `CANON AS PROP`

- **Look:** a pre-digital broadcast transmitter in the Ring Road FM basement: grey-green metal, bakelite knobs, a glowing valve, a frequency dial that goes past the station's own number.
- **Y1:** M018.
- **Model note:** it must look older than the station and heavier than the room. The glow is the only warm light in the scene.

---

## 10. Principal model sheets (build these first)

These ten carry the most screen time and the most risk. Each sheet adds geometry, posture and animation notes beyond the data.

### The Fresher (`player`)

- **Face:** player-authored. Default expression: attentive, slightly behind the moment.
- **Posture:** weight on the back foot, shoulders loose, hands in pockets or holding a bag/phone.
- **Walk:** ordinary, slightly hurried; the run is a student run, not an athlete's.
- **Key poses:** looking up at the clock tower; kneeling for the note; holding a torch; standing in a crowd with a raised phone.
- **LOD:** highest detail on face/hands; the player is the camera's neighbour.

### Bature (`npc.roomie.m`) and Firdausi (`npc.roomie.f`)

- **Faces:** open, expressive, a little younger than the player. Bature's default is a grin already forming; Firdausi's is a decision already made.
- **Posture:** Bature leans, slouches, occupies the other bed. Firdausi sits upright, folds, sorts.
- **Walk:** Bature bounces; Firdausi clicks.
- **Key poses:** Bature eating biscuits while talking; Firdausi closing a door with her heel.
- **Contrast:** same age, opposite momentum. Never stage them identically.

### Jega (`npc.jega`)

- **Face:** lean, warm, a footballer's squint in sunlight.
- **Posture:** one boot forward, hands loose, ready to jog.
- **Walk/run:** long stride, easy acceleration; the left boot ritual is a repeated micro-animation (tap, tap, tie).
- **Key poses:** tying the left boot; heading a ball; offering a hand up; standing beside Helen without touching her.
- **LOD:** jersey number must survive at distance.

### Shamsu (`npc.shamsu`)

- **Face:** sharp, earnest, glasses; a permanent slight frown of concentration.
- **Posture:** still, narrow, hands often clasped or writing in the air.
- **Walk:** quick, slightly hunched, carrying too many books.
- **Key poses:** adjusting glasses; explaining to a page; looking up from a seat as if called in class.

### Mubarak (`npc.mubarak`)

- **Face:** bright, forward, sunglasses; a grin that is already a transaction.
- **Posture:** wide stance, hands presenting an invisible product.
- **Walk:** a strut with a purpose; stops suddenly to pitch.
- **Key poses:** opening the bumbag; offering a torch; counting notes; backing away from Hajiya Ladi.

### Nusaiba (`npc.nusaiba`)

- **Face:** alert, composed, courtroom-neutral.
- **Posture:** straight, folder square, feet together.
- **Walk:** measured; she arrives early.
- **Key poses:** raising one finger for "point one"; reading a rule; standing beside Jiya like a small committee.

### Dr. Zainab (`npc.zainab`)

- **Face:** very fair, bright, young; the only face that must never be graded darker.
- **Posture:** forward-weighted, ready to leave; stethoscope adjusted absent-mindedly.
- **Walk:** fast, clinical, squeaky shoes on hospital lino.
- **Key poses:** torch in the eye; checking a pulse; looking at the Maker in the garden and not saying his name.
- **LOD:** face is the priority; the stethoscope is the silhouette.

### The Maker (`npc.maker`)

- **Face:** old, narrow, quiet; eyes that have been looking at the same thing for forty years.
- **Posture:** upright but economical; hands visible, often holding a tool or a cup.
- **Walk:** slow, deliberate, no wasted step.
- **Key poses:** standing at the garden gate; sitting on the bench; looking away from Muhammad; lighting the coil.
- **LOD:** the labcoat hem and hands matter more than the face at distance.

### Muhammad (`npc.muhammad`)

- **Face:** calm, soft, slightly apologetic; always clean.
- **Posture:** open, still, hands loose.
- **Walk:** unhurried; appears in the edge of frame before anyone notices.
- **Key poses:** stepping aside; offering a hand; standing in a crowd without disturbing it.
- **Rule:** no dirt, no sweat, no dramatic lighting. He is the least theatrical person in every scene.

### Bolaji / Big Sly (`npc.bolaji`)

- **Face:** broad, young, performing confidence; eyes checking whether the joke landed.
- **Posture:** shoulders first, then a slight apologetic slump.
- **Walk:** heavy, wide, careful in doorways.
- **Key poses:** cracking knuckles; apologising to his hands; stepping between two people; sitting on a bench that is too small.
- **LOD:** width is x/z only; head stays normal.

---

## 11. Performance and movement library

Year 1 uses a small, repeatable vocabulary. Reuse these rather than inventing new animations per scene.

| Token | Use | Notes |
|---|---|---|
| `idle` | default | breathing, blinking, small weight shifts |
| `talk` | dialogue | lip-flap + one hand gesture; do not loop mechanically |
| `walk` | travel | 2.3 m/s; feet matched to ground speed |
| `run` | chase / sport | 7 m/s; only for player, goat, Jega, Taty, Basit |
| `sit` | benches, desks, beds | feet flat, hands on knees or lap |
| `kneel` | the note, the tin, the pier | one knee, head down |
| `carry` | porter, bags, generator | both arms or head-carry for Baba Porter |
| `eat` | biscuits, jollof, suya | small, repeated; mouth closed |
| `point` | directions, accusations | whole arm, not just finger |
| `wave` | greeting, goodbye | short, elbow-led |
| `nod` | agreement | one clear beat, then stillness |
| `shock` | the note, the eel, the Count | freeze, then a half-step back |
| `laugh` | Bature, Jega, Lyzzy | head back, shoulders; silent laugh for Lily |
| `cheer` | stadium, convocation | arms up, two beats |
| `phone` | calls, filming | one hand to ear, or both hands horizontal |
| `write` | Garba, Shamsu, Hassan | look down, small hand circle |
| `hug` | Mum, Bolaji, Helen | full contact, held a beat too long |
| `sleep` | hostel, exam week | curled or flat, no snore animation |

**Rules**

- Every `say` line needs a `talk` state; do not leave a speaker in `idle` with a moving mouth.
- Crowd extras use `idle`/`walk` only; never give a crowd member a close-up gesture.
- The goat, eel and cats use their own rigs and must not inherit human animations.
- If an animation token is missing, use the nearest listed token and flag the gap; do not invent a new token name in a cutscene file.

---

## 12. Voice summary (all Year 1 speakers)

This is the casting sheet. `voices.ts` is authoritative for profiles 1–10; the per-character voice notes fill the rest.

| Speaker (script name) | Cast ID | Age | Voice in one line | Pitch / rate |
|---|---|---|---|---|
| The Fresher | `player.m` / `player.f` | 18 | Short lines; the world is funny around them | 1.00 / 1.00 (m), 1.05 / 1.00 (f) |
| Mum | `npc.mum` | 48 | Loving instructions, every sentence a task | 1.12 / 1.06 |
| Dad | `npc.dad` | 52 | Slow, proud, enjoys his own stories | 0.78 / 0.90 |
| Bature | `npc.roomie.m` | 19 | Quick Hausa-English joker; rises on punchlines | 1.08 / 1.10 |
| Firdausi | `npc.roomie.f` | 19 | Brisk, teasing, protective | 1.16 / 1.08 |
| Gate guard | `npc.gate_guard` | 45 | Bored, unhurried, has heard it all | 0.70 / 0.86 |
| Baba Porter | `npc.baba_porter` | 60 | Gruff, exact, short of breath | 0.66 / 0.84 |
| Malam Garba | `npc.garba` | 62 | "Hm." is a paragraph | 0.62 / 0.80 |
| Mrs. Adebayo | `npc.mrs_adebayo` | 55 | Flat, final, behind glass | 0.86 / 0.88 |
| Mr. Clement | `npc.mr_clement` | 50 | One word at a time | 0.84 / 0.82 |
| SUG porter | `npc.sug_porter` | 58 | Practical, calm, back from prayers | 0.72 / 0.88 |
| Aleeya | `npc.aleeya` | 19 | Compliment, then the punchline | 1.06 / 1.02 |
| Muhammad | `npc.muhammad` | 20 | Soft, apologetic, almost a whisper | 0.96 / 0.86 |
| Shamsu | `npc.shamsu` | 19 | Precise whisper that over-explains | 1.00 / 1.04 |
| Nusaiba | `npc.nusaiba` | 19 | Courtroom polite; numbered points | 1.02 / 0.98 |
| Maryam | `npc.maryam` | 20 | Thoughtful, teasing, book-led | 1.04 / 0.98 |
| Lyzzy | `npc.lyzzy` | 19 | Delighted, quick, loud | 1.20 / 1.14 |
| Lily | `npc.lily` | 19 | Very soft, slow, sure | 1.10 / 0.84 |
| Idris | `npc.idris` | 18 | Small voice, few words | 1.06 / 0.90 |
| Abbas | `npc.abbas` | 20 | Flat, exact, like a clock | 0.88 / 0.90 |
| Wednesday | `npc.wednesday` | 20 | Calm, uncanny, kind; never looks up | 0.94 / 0.82 |
| Tunde | `npc.tunde` | 20 | Quiet; describes things by colour | 1.02 / 0.90 |
| Kelechi | `npc.kelechi` | 21 | Slow, amused, Igbo flavour | 0.92 / 0.86 |
| Basit | `npc.basit` | 20 | Playful, competitive, rematch | 1.04 / 1.04 |
| Helen | `npc.helen` | 22 | Calm; answers a question with a question | 1.08 / 1.00 |
| Jega | `npc.jega` | 19 | Warm, quick, code-switches | 0.92 / 1.06 |
| Mubarak | `npc.mubarak` | 19 | Fast Pidgin salesman; everything is premium | 1.04 / 1.16 |
| Bolaji | `npc.bolaji` | 25 | Huge, performative, third person | 0.55 / 0.92 |
| Hassan | `npc.hassan` | 20 | Bored clerk with a notebook | 1.12 / 1.02 |
| Lula | `npc.lula` | 60 | Soft, repeats your last three words | 0.80 / 0.86 |
| Faty | `npc.faty` | 58 | Quick, loud laugh; "Write that down!" | 0.96 / 1.02 |
| Law lecturer | `npc.law_lecturer` | 58 | Dry; enjoys the room's laughter | 0.82 / 0.90 |
| Dr. Okonkwo | `npc.okonkwo` | 45 | Brisk, dry, fair | 0.90 / 0.98 |
| Dr. Zainab | `npc.zainab` | 25 | Warm, quick, clinical | 1.08 / 1.06 |
| Nurse Hauwa | `npc.hauwa` | 40 | Unshockable, flat | 0.90 / 0.90 |
| Coach Ngozi | `npc.ngozi` | 35 | Dry, commanding, secretly kind | 0.94 / 1.00 |
| Coach Danladi | `npc.danladi` | 50 | Shouts in proverbs | 0.76 / 1.00 |
| Mama Nkechi | `npc.mama_nkechi` | 50 | Warm thunder; feeds first | 0.94 / 1.00 |
| Suya man | `npc.suya_man` | 40 | Panicked shout | 1.00 / 1.15 |
| Malam Sule | `npc.malam_sule` | 55 | Weary, dry, kind underneath | 0.74 / 0.86 |
| Alhaji Needle | `npc.needle` | 60 | Warm, unbothered, blessing everything | 0.80 / 0.88 |
| Mai Shayi | `npc.mai_shayi` | 70 | Slow, warm, storyteller's pauses | 0.70 / 0.80 |
| Hajiya Ladi | `npc.hajiya_ladi` | 58 | Formidable, fair, measured | 0.80 / 0.86 |
| Tanko | `npc.tanko` | 45 | Deep, amused, gives nothing | 0.72 / 0.88 |
| Big Baby | `npc.big_baby` | 26 | Quiet, final, terrifying | 0.88 / 0.78 |
| KB | `npc.kb` | 45 | Sly; prices by your face | 0.90 / 1.00 |
| Baba Dam | `npc.baba_dam` | 70 | Slow, salty, the water's voice | 0.70 / 0.78 |
| Ranger Lawal | `npc.lawal` | 40 | Quiet, stubborn; "Go back." | 0.84 / 0.84 |
| Engr. Aliyu | `npc.aliyu` | 45 | Nervous; "I only switched it over." | 0.86 / 0.94 |
| Emeka | `npc.emeka` | 28 | Fast, cheerful rider | 1.00 / 1.10 |
| The Maker | `npc.maker` | 75 | Quiet, exact; every word weighed | 0.58 / 0.78 |
| The radio | `prop.radio` | 60 | A woman through static, counting | 0.90 / 0.78 |
| Dr. Khadija | `npc.khadija` | 52 | Stern, unhurried; stamps | 0.88 / 0.88 |
| Dean of Engineering | `npc.dean_eng` | 60 | Ceremonial, paragraph-shaped | 0.80 / 0.86 |
| Licence examiner | `npc.examiner` | 50 | Bureaucratic, delighted by rules | 0.92 / 1.00 |
| Results clerk | `npc.eng_clerk` | 30s | Tired, kind underneath | 0.96 / 0.96 |
| DJ Kabiru | `npc.kabiru` | 48 | Velvet on air, shy off air | 0.82 / 0.88 |
| Ball boy | `npc.small_boy` | 11 | A shout at the edge of the pitch | 1.10 / 1.10 |
| Customer | `npc.sophomore` | 20 | Bored, entitled, not cruel | 0.98 / 1.00 |
| Fans | `crowd.fans` | — | Drums, groundnuts, no voice by half-time | 1.05 / 1.10 |
| Families | `crowd.families` | — | Proud, phone-raising, slightly lost | 1.00 / 1.00 |
| Freshers | `crowd.freshers` | 18 | Overlapping crowd shout | 1.10 / 1.10 |
| Jiya | `special.jiya` | 27 | Calm British; polite, long roasts | 1.00 / 1.00 |
| Taty | `special.taty` | 24 | Warm, cheeky, competitive | 1.14 / 1.10 |
| Madison | `special.madison` | 22 | Very fast; two languages mid-sentence | 1.24 / 1.24 |

---

## 13. Model weaknesses you must design around

Straight from the current build, so nobody promises a fidelity the engine cannot deliver:

1. **Shoes** are the foot surface pushed out 8 mm; they read as thick socks, not leather. Do not design a scene around a shoe detail.
2. **Hands** have no nails or knuckle detail. Keep hand props simple and avoid close-ups of fingers.
3. **The male base is very muscular.** Ordinary men need softened shoulders; only Big Sly should look gym-shaped.
4. **Trousers** can show knee/crotch shape and a dotted stitch line at the waist. High-contrast trousers make it worse; choose mid-tones.
5. **Skirts are cones.** `womandress` reads as a flared cone, not folds and a hem. Use belts and trim to break the cone.
6. **Hijab hems** are calm but flat across the chest; on very pale skin (Zainab) a sliver of far cheek can appear at the temples. Check 3/4 views.
7. **Facial animation** (blink, breathe, lip-flap) exists but is subtle. Do not rely on a micro-expression to carry a beat; use posture, pause and camera.
8. **No child rig.** `npc.small_boy` is a flagged gap, not a scaled adult.
9. **No beard mesh** in the extras list. Lula, Lawal and Baba Dam need either a new mesh or a clean-shaven compromise.
10. **No headphones mesh.** Kabiru uses a phone stand-in until one is added.

**When a look is impossible, do not silently substitute.** Use the nearest legal value, mark the entry `PROPOSED / GAP`, and list the missing mesh in `05_SCENE_AND_ASSET_MANIFEST.md` §7.

