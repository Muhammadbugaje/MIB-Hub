# CHARACTERS — how every character should look

Where this lives: `CHARACTERS.md`, project root (next to `CONTINUE.md`).
Source of truth in code: `games/work-in-progress/src/game/cast.ts` (looks, heights) and
`games/work-in-progress/src/game/voices.ts` (age, personality, voice).
If this document and the code disagree, the code is right — then fix one of them.

---

## 1. How a look is put together

Every human in the game is the **same skeleton and the same two base bodies** (a female and a male
mesh from the Universal Base Characters pack, `assets/people2/`). A character is defined entirely by
data on that body, so nothing here is a bespoke model:

| Ingredient | What it controls |
| --- | --- |
| `model` | Which outfit cut is generated on the body (see the slot table below). |
| `skin` | Base skin tint (hex). The face keeps its own shading. |
| `hair` | Hair colour. Ignored (hidden) when a hijab is worn. |
| `outfit` | One hex per clothing slot, in the order the model uses. |
| `headwear` | `none`, `cap` or `hijab`, plus its colour. |
| `height` | Height multiplier. Rule: **within ±6 %** of normal (0.94–1.06). |
| `width` | Extra width on x and z only. Used by exactly one character (Big Sly). |
| `extras` | Small carried/worn props: `folder glasses sunglasses pens camera phone volleyball ledger torch bumbag whistle apron labcoat stethoscope spanner notebook jersey10 bag`. |

### Outfit models and their slots (in order)

| `model` | Slots, in order |
| --- | --- |
| `manlong` | `[shirt (long kaftan), trousers]` |
| `mansuit` | `[shirt, trousers]` — a suit cut; slot 1 is the jacket/shirt body |
| `man` | `[shirt (polo/tee), sleeves, trousers, shoes, socks]` |
| `casual` | `[shirt, sleeves, trousers, shoes]` |
| `hoodie` | `[hoodie, trim, trousers]` |
| `farmer` | `[overalls, shirt, trousers, hat, scarf]` |
| `womancasual` | `[top, trousers, shoes, socks]` |
| `animwoman` | `[top, trousers, trim, shoes]` |
| `womandress` | `[dress, trim, belt]` |

Clothing is **not** a texture painted on the body. It is a real cloth shell cut out of the body
surface, pushed off the skin (shoes 8 mm, trousers 13 mm, tops 15 mm), smoothed, and given its own
fabric normals (`src/world/basebody.ts`). That is why fit and seams matter: a garment that looks
wrong is a geometry/stand-off problem, not a colour problem.

### Skin palette (`CAST_SKIN`)

| Name | Hex | Reads as |
| --- | --- | --- |
| `veryFair` | `#f1d6c2` | "Snow White" — **Zainab only, test-locked** |
| `fair` | `#e2b892` | pale golden |
| `light` | `#d9a77c` | light warm tan |
| `honey` | `#c68a5e` | warm honey brown |
| `caramel` | `#b5794f` | caramel brown |
| `medium` | `#a06a46` | medium brown |
| `tan` | `#8d5b3c` | tan brown |
| `deep` | `#7a4e34` | deep brown (darkest used) |

Project rule (owner, bible §2.5a): the authored cast leans fair to caramel; **nobody very dark**.
Hair: black `#141010`, dark brown `#2a1d16`, grey `#8f8a84`.

### Fashion rules that apply to everyone

- **Modest and ordinary.** No low necklines, no bare midriffs, no tight/see-through cloth, no logos
  beyond the football `jersey10` prop. Sleeves at least to the elbow, trousers or a long skirt.
- **Colours come from a campus in northern Nigeria:** mustard/gold, deep green, teal, indigo,
  burgundy, off-white, grey, black. Avoid neon.
- **Hijab wearers never show hair.** The hair mesh is switched off automatically; the hijab is built
  to the wearer's own head so it cannot float or clip.
- **One scale for every human.** Height varies a little; heads do not.
- **Props are small and optional.** They identify a role at a glance.

---

## 2. The cast, one by one

Format: **Body** (model, height) · **Skin** · **Hair** · **Outfit** (slot by slot) · **Headwear** ·
**Extras** · **Should read as**.

### Family

**Mum** — `npc.mum`, 48, Northern Nigerian mother; quick, loving, every sentence an instruction.
- Body: `womandress`, normal height, comfortable/full build.
- Skin: medium `#a06a46`. Hair: black (under the hijab).
- Outfit: long dress deep green `#2f6f5a`; trim golden-yellow `#e0a526`; belt gold `#d4af37`.
- Headwear: hijab, mustard `#e0a526`.
- Should read as: a solid, warm mother in a gold-trimmed green dress and matching gold hijab —
  someone who feeds you before she asks your name.

**Dad** — `npc.dad`, 52, Nigerian father; slow, proud, deep, enjoys his own stories.
- Body: `mansuit`, height ×1.02 (broad).
- Skin: tan `#8d5b3c`. Hair: black.
- Outfit: off-white `#e9e4d8` shirt and trousers (a light kaftan/suit, not a white onesie — read it as
  loose cotton).
- Headwear: soft cap, burgundy `#7a2e3b`.
- Should read as: a big, calm man in pale cotton with a wine-coloured cap.

**Bature** — `npc.roomie.m` (male roommate), student.
- Body: `man`, height ×0.95 (shorter than the player).
- Skin: deep `#7a4e34`. Hair: black.
- Outfit: yellow `#f2c230` tee, yellow sleeves, black `#2b2b2b` trousers, off-white shoes and socks.
- Should read as: the short, cheerful roommate in a yellow tee.

**Firdausi** — `npc.roomie.f` (female roommate), student.
- Body: `womancasual`, height ×0.96.
- Skin: deep `#7a4e34`. Hair: black (hidden).
- Outfit: rose `#e98a8a` top, indigo-navy `#3a3a5a` trousers, off-white `#f4f1ea` shoes and socks.
- Headwear: hijab, burgundy `#7a2e3b`.
- Should read as: a small, tidy roommate in rose and navy.

### Campus staff, gate and porters

**Gate guard** — `npc.gate_guard`, 45, bored, unhurried.
- Body: `manlong`, normal. Skin: deep `#7a4e34`. Hair: black.
- Outfit: khaki `#7d7350` uniform shirt; dark olive `#4f4a36` trousers.
- Headwear: cap, dark olive `#4f4a36`.
- Should read as: a man in surplus khaki who has seen every excuse already.

**Baba Porter** — `npc.baba_porter`, 60, gruff, short of breath, exact.
- Body: `manlong`, normal. Skin: tan `#8d5b3c`. Hair: grey `#8f8a84`.
- Outfit: faded blue `#4f6a8a` shirt; dark slate `#2e3a48` trousers.
- Headwear: cap, dark slate.
- Should read as: an older porter in fading blue, cap pulled down.

**Malam Garba** — `npc.garba`, 62, Senate porter; "Hm." is a paragraph.
- Body: `manlong`, height ×0.95. Skin: tan. Hair: grey.
- Outfit: muted brown `#8a5a3a` top and trousers.
- Headwear: white `#f4f1ea` cap.
- Extras: ledger. Should read as: a small, upright man with a ledger and no interest in your problem.

**SUG porter** — `npc.sug_porter`, 58, older porter back from the mosque.
- Body: `manlong`, normal. Skin: tan. Hair: grey.
- Outfit: deep green `#1f6b52` shirt; black trousers. Headwear: white cap.

**Mrs. Adebayo** — `npc.mrs_adebayo`, 55, Yoruba registry clerk; bored, flat, final.
- Body: `womandress`, normal. Skin: medium. Hair: black (hidden).
- Outfit: dark indigo `#1f3c66` dress; off-white `#e9e4d8` trim; gold `#d4af37` belt.
- Headwear: hijab matching the dress `#1f3c66`. Extras: glasses.
- Should read as: a clerk behind glass — navy, gold at the edges, reading glasses, unimpressed.

**Mr. Clement** — `npc.mr_clement`, 50, bursary officer; one word at a time.
- Body: `mansuit`, normal. Skin: honey `#c68a5e`. Hair: black.
- Outfit: slate-grey `#56606a` shirt; black `#2b2b2b` trousers. Extras: glasses.

**The Maker** — `npc.maker`, 75, quiet and exact; every word weighed.
- Body: `mansuit`, normal. Skin: light `#d9a77c`. Hair: grey.
- Outfit: pale grey `#c9ccc8` shirt; slate `#56606a` trousers. Extras: labcoat.
- Should read as: an old man in a worn white coat who only speaks when it matters.

### Students, the friend group

**Muhammad** — `npc.muhammad`, 20, soft-spoken, nearly a whisper.
- Body: `manlong`, normal. Skin: tan. Hair: black.
- Outfit: off-white `#fbfbf8` shirt; black trousers.
- Should read as: neat, quiet, bright white kaftan.

**Idris** — `npc.idris`, 18, the shy fresher.
- Body: `hoodie`, normal. Skin: honey. Hair: black.
- Outfit: slate `#56606a` hoodie, black trim `#2b2b2b`, indigo `#1f3c66` trousers.
- Should read as: a hoodie pulled up, hands in pockets.

**Mubarak** — `npc.mubarak`, 19, Pidgin-English salesman; everything is premium.
- Body: `casual`, normal. Skin: deep `#7a4e34`. Hair: black.
- Outfit: mustard `#e0a526` shirt, burgundy `#a83232` sleeves, indigo `#1f3c66` trousers,
  off-white shoes. Extras: sunglasses, bumbag.
- Should read as: the loudest person on the walkway — gold and burgundy, shades, bumbag.

**Lyzzy** — `npc.lyzzy`, 19, Mass Comm twin; delighted, quick, loud.
- Body: `animwoman`, normal. Skin: caramel. Hair: black.
- Outfit: rose `#e98a8a` top, off-white `#f4f1ea` trousers, orange `#d9622b` trim, off-white shoes.
- Extras: camera. Should read as: bright, bouncy, permanently holding a camera.

**Lily** — `npc.lily`, 19, Botany twin; very soft, slow, sure.
- Body: `animwoman`, normal. Skin: caramel. Hair: black.
- Outfit: green `#2f8a4c` top, off-white trousers `#e9e4d8`, sand `#c9b896` trim, brown `#8a5a3a` shoes.
- Should read as: Lyzzy's calmer mirror — green and sand, no camera.

**Aleeya** — `npc.aleeya`, 19, Architecture student; supportive, then the punchline.
- Body: `womancasual`, height ×1.05 (tall). Skin: light. Hair: black (hidden).
- Outfit: violet `#5b4ba8` top, black trousers, off-white shoes and socks.
- Headwear: hijab, soft lilac `#c9b8e8`.
- Should read as: the tall friend in purple and a pale lilac hijab.

**Maryam** — `npc.maryam`, 20, English student at the bookshop; thoughtful, teasing.
- Body: `womancasual`, normal. Skin: light. Hair: black (hidden).
- Outfit: teal `#3e8e9e` top, black trousers, brown shoes and socks.
- Headwear: hijab matching the top `#3e8e9e`. Extras: bag.
- Should read as: teal from top to hijab, a bag of books on one shoulder.

**Shamsu** — `npc.shamsu`, 19, earnest genius, over-explains in a whisper.
- Body: `manlong`, normal. Skin: honey. Hair: black.
- Outfit: off-white `#f4f1ea` shirt and trousers. Headwear: white cap.
- Extras: glasses, pens. Should read as: a pressed white kaftan, glasses, pens in the pocket.

**Nusaiba** — `npc.nusaiba`, 19, Law student; clear, courtroom polite.
- Body: `womancasual`, normal. Skin: light. Hair: black (hidden).
- Outfit: indigo `#1f3c66` top, black trousers, black shoes and socks.
- Headwear: off-white `#e9e4d8` hijab. Extras: folder.
- Should read as: navy with a cream hijab, folder held square.

**Wednesday** — `npc.wednesday`, 20, calm, uncanny, kind; never looks up.
- Body: `animwoman`, normal. Skin: light. Hair: dark brown `#2a1d16`.
- Outfit: slate `#56606a` top, black trousers `#2b2b2b`, off-white `#e9e4d8` trim, black shoes.
- Should read as: grey and black, hair over the face, eyes on a page.

**Hassan** — `npc.hassan`, 20, thin deputy with a notebook; bored clerk voice.
- Body: `manlong`, height ×0.98. Skin: honey. Hair: black.
- Outfit: sky blue `#86b7e0` shirt; slate `#56606a` trousers. Extras: notebook.
- Should read as: narrow, blue shirt, always writing.

**KB** — `npc.kb`, 45, corner-shop owner; sly, prices by your face.
- Body: `man`, normal. Skin: honey. Hair: black.
- Outfit: slate `#56606a` shirt, off-white sleeves, black trousers, black shoes, black socks.

**A customer** — `npc.sophomore`, 20, a second-year with a complaint.
- Body: `hoodie`, normal. Skin: caramel. Hair: black.
- Outfit: teal `#3e8e9e` hoodie, cream `#f4f1ea` trim, black trousers.

### Lecturers and medical

**Mrs. Adebayo** and **Mr. Clement** are above (registry, bursary).

**Law lecturer** — `npc.law_lecturer`, 58, dry; enjoys the room's laughter.
- Body: `mansuit`, normal. Skin: honey. Hair: grey.
- Outfit: black `#2b2b2b` on black `#2b2b2b` — a dark suit. Extras: glasses.

**Dr. Okonkwo** — `npc.okonkwo`, 45, Igbo engineering lecturer; brisk, dry, fair.
- Body: `womandress`, normal. Skin: caramel. Hair: black.
- Outfit: burgundy `#7a2e3b` dress, off-white `#e9e4d8` trim, gold `#d4af37` belt. Extras: glasses.
- Should read as: a lecturer who has already graded you in her head.

**Dr. Zainab** — `npc.zainab`, 25, young house officer; warm, quick, clinical when it matters.
- Body: `womancasual`, normal. Skin: **very fair `#f1d6c2` — LOCKED, "Snow White", never change it.**
- Hair: black (hidden).
- Outfit: teal `#3e8e9e` scrubs top and trousers, off-white shoes and socks.
- Headwear: black `#2b2b2b` hijab.
- Extras: stethoscope, torch.
- Should read as: the bright, pale doctor — teal scrubs, black hijab, stethoscope round the neck.
  A test asserts her skin tone; do not darken it.

**Nurse Hauwa** — `npc.hauwa`, 40, night nurse; unshockable, flat.
- Body: `womandress`, normal. Skin: medium. Hair: black (hidden).
- Outfit: off-white `#f4f1ea` dress, light blue `#86b7e0` trim and belt.
- Headwear: white `#f4f1ea` hijab.
- Should read as: white and blue, tired but immaculate, at 3 a.m.

### Traders, market, food

**Mama Nkechi** — `npc.mama_nkechi`, 50, Igbo buka owner; warm, loud, threatens with love.
- Body: `womandress`, normal. Skin: caramel. Hair: black (hidden).
- Outfit: orange `#d9622b` dress, green `#2f8a4c` trim, gold `#e0a526` belt.
- Headwear: hijab, green `#2f8a4c`. Extras: apron. Height listener 0.94 (she is short).
- Should read as: a short, loud woman in bright orange with a green head-tie and a working apron.

**Suya man** — `npc.suya_man`, 40, Hausa grill man; panicked shout.
- Body: `manlong`, normal. Skin: tan. Hair: black.
- Outfit: off-white `#f4f1ea` shirt; grey-blue `#56606a` trousers. Headwear: white cap.
- Should read as: pale cotton, soot at the cuffs, standing over a grill.

**Malam Sule** — `npc.malam_sule`, 55, Hausa farmhand; weary, dry, kind underneath.
- Body: `farmer`, normal. Skin: tan. Hair: grey.
- Outfit: brown `#8a6a48` overalls, sand `#c9b896` shirt, dark olive `#4f4a36` trousers,
  sand `#c9b896` hat, red `#a83232` scarf.

**Alhaji Needle** — `npc.needle`, 60, Hausa tailor; warm, unbothered, blesses everything.
- Body: `mansuit`, normal. Skin: tan. Hair: grey.
- Outfit: off-white `#e9e4d8` on off-white. Headwear: green `#2f8a4c` cap. Extras: glasses.

**Mai Shayi Audu** — `npc.mai_shayi`, 70, old tea seller; slow, warm, tells stories.
- Body: `manlong`, height ×0.96. Skin: tan. Hair: grey.
- Outfit: sand `#c9b896` shirt and trousers. Headwear: burgundy `#7a2e3b` cap.
- Should read as: a small, thin old man in sandy cotton, kettle always near.

**Hajiya Ladi** — `npc.hajiya_ladi`, 58, head of the market traders; formidable, fair, measured.
- Body: `womandress`, normal. Skin: medium. Hair: black (hidden).
- Outfit: violet `#5b4ba8` dress, mustard `#e0a526` trim, gold `#d4af37` belt.
- Headwear: mustard `#e0a526` hijab.
- Should read as: the market's queen — violet and gold, upright, unhurried.

**Tanko** — `npc.tanko`, 45, riddler at the gate; deep, amused, gives nothing.
- Body: `man`, normal. Skin: tan. Hair: black.
- Outfit: brown `#8a5a3a` shirt, sand `#c9b896` sleeves, olive `#4f4a36` trousers, black shoes and socks.
- Headwear: sand `#c9b896` cap.

**Big Sly (Bolaji)** — `npc.bolaji`, 25, huge, performative, third person; secretly gentle.
- Body: `hoodie`, height ×1.06, **width ×1.18** — the only genuinely huge man.
- Skin: tan `#8d5b3c`. Hair: black.
- Outfit: black `#2b2b2b` hoodie, burgundy `#a83232` trim, black trousers.

### Sport

**Jega** — `npc.jega`, 19, Hausa-English footballer; warm, quick, code-switches.
- Body: `casual`, height ×1.05. Skin: tan. Hair: black.
- Outfit: green `#2f8a4c` shirt, white `#f4f1ea` sleeves, white trousers, black shoes.
- Extras: `jersey10`. Should read as: a lean footballer in green and white with the number 10.

**Coach Danladi** — `npc.danladi`, 50, shouts in proverbs.
- Body: `manlong`, normal. Skin: tan. Hair: black.
- Outfit: red `#a83232` shirt; black trousers. Headwear: black cap. Extras: whistle.

**Helen** — `npc.helen`, 22 (volleyball), short (×0.95), caramel skin, black hair.
- Body: `animwoman`. Outfit: blue `#2a5fa8` top, black trousers, off-white shoes and socks.
- Extras: volleyball.

### Shop and salon

**Big Baby** — `npc.big_baby`, 26, tiny salon owner; quiet, final, terrifying.
- Body: `womandress`, height ×0.94 (the smallest adult). Skin: medium. Hair: black (hidden).
- Outfit: rose `#e98a8a` dress, black `#2b2b2b` trim, gold `#d4af37` belt.
- Headwear: black hijab `#2b2b2b`. Extras: apron.
- Should read as: very small, very still, in pink and black.

**The Maker**, **KB**, **Mama Nkechi** are above.

### Crowd filler

**A senior** — `crowd.students`. Body `casual`; caramel skin, black hair.
- Outfit: black shirt, orange `#d9622b` sleeves, slate `#56606a` trousers, off-white shoes.
- Extras: phone. Used for unnamed students on the walkways; always leave at least three of these
  visible near the player so the campus feels inhabited.

---

## 3. Special characters (conditional only)

These three are real people who have not yet approved a look. **All of their content must stay
inside `[IF special.jiya]` / `[IF special.taty]` / `[IF special.madison]` blocks with a generic
fallback**, per `READ-CLAUDE.md`. Their current looks are placeholders and must not leak into any
non-conditional scene, marketing image, screenshot meant for anyone but the owner, or commit message.

**Jiya** — `special.jiya`. Body `animwoman`, height ×1.05. Skin light `#d9a77c`, brown hair `#3b2618`.
- Outfit: red `#a83232` top, black trousers, off-white shoes and socks. Cap `#a83232`. Extras: sunglasses.

**Taty** — `special.taty`. Body `animwoman`, normal height. Skin fair `#e2b892`, black hair.
- Outfit: black top, black trousers, rose `#e98a8a` trim, off-white shoes.

**Madison** — `special.madison`. Body `animwoman`, normal height. Skin fair `#e2b892`, black hair.
- Outfit: off-white `#f4f1ea` top, violet `#5b4ba8` trousers, yellow `#f2c230` trim, black shoes.
  Extras: phone.

---

## 4. What is still rough (honest list)

1. **Hands and shoes.** Shoes are the foot surface pushed out 8 mm; they read as thick socks, not
   leather. Hands have no nails or knuckle detail.
2. **The male base is very muscular** — shoulders and arms are gym-shaped. Big Sly is the only one who
   should look like that; ordinary men should be softened (`width` less than 1, or a smoother base).
3. **Trouser anatomy.** The cloth still shows a little knee and crotch shape, and a dotted stitch line
   can appear at the waist where the top and bottom garment seams meet.
4. **Skirts are cones.** `womandress` produces a flared cone rather than a skirt with folds and a hem.
5. **Hijab hems** are calm now but still slightly flat across the chest; the face oval leaves a sliver
   of the far cheek visible at the temples on very pale skin (Zainab).
6. **No facial animation shown above.** Blinking, breathing and lip-flap exist in `src/anim/` but the
   portraits are single frames; check them in motion with `?cast=<id>&anim=talk`.

## 5. How to see a character

```bash
export PATH=~/.nvm/versions/node/v24.22.2/bin:$PATH
cd /Users/macbookair/Downloads/MIB-Hub
WIP_OUT=dev npm run build:wip          # writes apps/web/public/play-files-dev/...
npm run dev                            # http://localhost:4321 (start as a background process)

# full body portrait
WIP_OUT=dev ~/Downloads/eehub-2/.venv/bin/python -I \
  games/work-in-progress/tools/shot.py /tmp/zainab.jpg \
  "cast=npc.zainab&anim=idle&t=1.2&lod=0&cz=2.6&cy=1.3&ly=1.15&yaw=0.12" --width 700 --height 900

# head close-up (add &headwear=none to hide the hijab for debugging)
WIP_OUT=dev ~/Downloads/eehub-2/.venv/bin/python -I \
  games/work-in-progress/tools/shot.py /tmp/zainab_head.jpg \
  "cast=npc.zainab&anim=idle&t=1&lod=0&cz=0.85&cy=1.6&ly=1.58" --width 800 --height 800
```

Cast renders live in `~/Downloads/games-files/screenshots/wip/characters/` (outside git, by design).
