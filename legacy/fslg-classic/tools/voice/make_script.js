#!/usr/bin/env node
/* Builds the voice recording script for Freshers School Life and splits it into voice roles (one person each).
   Writes docs/voice/lines.json (machine), docs/voice/RECORDING_SCRIPT.md (plain list) and static/audio/voice/tags.json.
   PDFs: tools/voice/make_pdfs.py.  Run:  node tools/voice/make_script.js  (Node: ~/.nvm/versions/node/v24.22.2/bin)

   What is read, in this order (one numbering per role, from the start of the game):
     1. the main story, m1 → m120: docs/story/scripts/Y1.md, Y1b.md, Y2.md … Y5.md
     2. side missions (SIDE.md), campus encounters (AMBIENT.md), co-op friends missions if they have dialogue
     3. the Maker's sayings (docs/story/02_BIBLE.md §18)
     4. lines the game speaks outside the story: barks, crowd and brawl reactions, security, radio idents, friends'
        small talk, lecture-hall lessons, named characters' greetings, the Engineering Garden plaques
   Every spoken line in the scripts ends with "[v: ]". Speakers are mapped to roles by the SPEAK table below.
   Tiers: A must record (all of Year 1, campus encounters, the Maker's sayings, constant in-game lines, and the first
   beat and turning point of every later main mission), B nice to have, C optional (radio and walker colour, variants). Each role is numbered tier by tier, A first, so a reader who stops early still lines up.
   Ids are a hash of the normalised text: a line's recording keeps working whatever its number. */
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..", ".."), JS = path.join(ROOT, "static", "js", "games"), OUT = path.join(ROOT, "docs", "voice"), STORY = path.join(ROOT, "docs", "story");
const read = (f) => { try { return fs.readFileSync(path.join(JS, f), "utf8"); } catch (e) { return ""; } };

// Same as V.norm / V.id in static/js/games/samaru-voice.js.
const norm = (t) => String(t == null ? "" : t).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
const id = (t) => { const s = norm(t); let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return "v" + ("0000000" + h.toString(16)).slice(-8) + s.length.toString(36); };
const hash = (t) => { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };

// Pull a literal ("[...]" or "{...}") that follows a marker out of a source file and evaluate it. Data only.
function literal(src, marker) {
  const at = src.indexOf(marker); if (at < 0) return null; let i = at + marker.length; while (i < src.length && src[i] !== "[" && src[i] !== "{") i++;
  const open = src[i], close = open === "[" ? "]" : "}"; let depth = 0, q = "", j = i;
  for (; j < src.length; j++) { const c = src[j]; if (q) { if (c === "\\") j++; else if (c === q) q = ""; continue; } if (c === '"' || c === "'") q = c; else if (c === open) depth++; else if (c === close && --depth === 0) break; }
  try { return (0, eval)("(" + src.slice(i, j + 1) + ")"); } catch (e) { return null; }
}
const strings = (v, out = []) => { if (typeof v === "string") out.push(v); else if (v && typeof v === "object") Object.values(v).forEach((x) => strings(x, out)); return out; };

const SOUND = "Use your own natural voice and your normal Nigerian English. Speak Pidgin, Hausa, Yoruba or Igbo exactly where it is written. Do not put on a voice or an accent.";
// One role = one person. owner: roles the maker of the game records himself. kind: what the game asks for when it wants this sort of voice.
const ROLES = [
  { id: "player_m", label: "The Player (male)", owner: true, who: "A young man, 17 to 22. The owner records this one.", chars: "The student you play, when the player picks a male character.", sound: "A fresher who grows up over five years: lively, cheeky, kind. Short shouts should sound called-out, not read." },
  { id: "player_f", label: "The Player (female)", who: "A young woman, 17 to 22.", chars: "The student you play, when the player picks a female character.", sound: "A fresher who grows up over five years: lively, cheeky, kind. Short shouts should sound called-out, not read." },
  { id: "bature_m", label: "Bature (male roommate)", who: "A young man, 18 to 22, the funniest voice you know.", sound: "Bature is the default roommate and the companion on most missions: a joker, loyal, always eating your garri. Warm and quick." },
  { id: "firdausi_f", label: "Firdausi and the girls' roommates", who: "A young woman, 18 to 22, warm and chatty.", sound: "Firdausi is the default roommate for female players and knows everybody. The other roommates in this role are each a little different: Aleeya secretly funny, Emily sweet and far away in Phase 2." },
  { id: "bolaji_m", label: "Bolaji \"Big Sly\" and the tough guys", who: "A young man with a heavier voice, 20 to 26.", sound: "Bolaji is the court boss who turns into your barber and mechanic: slow, confident, scary at first and soft later. Never swear; slow is scarier than loud." },
  { id: "men_a", label: "Young men A", who: "A young man, 18 to 24.", sound: "Course mates and roommate options. Sadiq quiet, Muktar a born chairman, Yusuf charming, Khalid steady, Shamsu the brilliant, devout one who explains everything (\u201cProfessor Shamsu\u201d). Change your manner, not your voice." },
  { id: "men_b", label: "Young men B", who: "A young man, 18 to 25, a different sort of voice from Young men A.", sound: "Abbas the student mechanic, Kelechi the sculptor, Tunde the quiet artist, Lula the gentle listener. Easy and friendly." },
  { id: "men_c", label: "Young men C", who: "A young man, 18 to 25, a third sort of voice.", sound: "Jega the football captain, Yakubu the class rep, Lucky the influencer, the Flying Club cadet and the arcade champion. Confident." },
  { id: "women_a", label: "Young women A", who: "A young woman, 18 to 24.", sound: "Nusaybah the engineer-psychologist, Lyzzy the twin, Fatima from the library, Big Baby, Summy, IDK, Joy. Bright and quick." },
  { id: "women_b", label: "Young women B", who: "A young woman, 18 to 24, a different sort of voice from Young women A.", sound: "Lily the gentle twin, Wednesday (deadpan), Maryam from the bookshop, Faty with the loud laugh, Ada, Comrade Sadiya. Calm and clear." },
  { id: "lecturer_m", label: "Lecturers and elders (male)", who: "A man who can sound 45 to 70.", sound: "Teachers and old men with something to say: Prof. Bello, Mr. Ezekiel, Ustaz Auwal, Tanko the riddler. Unhurried and sure. Lecture-hall lines get a hall echo afterwards." },
  { id: "staff_f", label: "Lecturers and staff (female)", who: "A woman who can sound 35 to 60.", sound: "Dr. Okonkwo, Dr. Khadija, the registry and the library, Nurse Hauwa, and Sgt. Bilkisu, head of security. Clear and firm; kind under it." },
  { id: "staff_m", label: "Campus staff and security (male)", who: "A man who can sound 30 to 60.", sound: "Porters, the bursary, the coaches, the works engineer, the shuttle driver, and the guards and forest rangers. Each a little different, still your own voice. Guard shouts should really be shouted.", x: ["mega"] },
  { id: "traders_m", label: "Traders and town (male)", who: "A man who can sound 30 to 65.", sound: "Mai Shayi Audu, Baba Dam the fisherman, Emeka the okada rider, Alhaji Needle, Chi-Tech, KB the sing-song shopkeeper, Mallam Dogo. Working people: warm and quick." },
  { id: "traders_f", label: "Traders and town (female)", who: "A woman who can sound 30 to 70.", sound: "Mama Nkechi, Hajiya Ladi, Aunty Asiya, Captain Uche, Iya Risi, Kaka at the forest edge, your mum on the phone. Warm, sharp, motherly." },
  { id: "dj", label: "Radio DJs", who: "Anyone with a good radio voice, male or female.", sound: "DJ Kabiru and the station voices. Smooth and confident, smiling as you speak. On-air lines get a radio effect afterwards.", kind: "dj" },
  { id: "crowd", label: "Crowd, walkers and small parts", who: "Anyone. Two or three people can pass the phone round.", sound: "People walking past who react, comment and ask for help; children and one-line parts. Surprised, annoyed, amused: short and real." },
  { id: "maker_m", label: "The Maker", owner: true, who: "Muhammad Iliyasu Bugaje himself. The owner records this one.", sound: "The Maker, keeper of the Tesla coil: calm, dry, kind and exact, a man showing visitors round something he built. When he quotes Rumi, slow down and let the old words land." }
];
const role = {}; ROLES.forEach((r) => { role[r.id] = r; r.lines = []; r.cast = {}; });

// Speaker label (upper case, without its parenthesis) → role(s). Two roles: the line has a male and a female version.
const SPEAK = {
  PLAYER: ["player_m", "player_f"], YOU: ["player_m", "player_f"], "@ROOMIE": ["bature_m", "firdausi_f"], BATURE: "bature_m", FIRDAUSI: "firdausi_f", ALEEYA: "firdausi_f", EMILY: "firdausi_f",
  "@CRUSH": ["men_c", "women_b"], "@BEST": ["bature_m", "firdausi_f"], "@CRUSH OR @BEST": ["men_c", "women_b"],
  BOLAJI: "bolaji_m", "BIG SLY": "bolaji_m", HASSAN: "bolaji_m", BULLY: "bolaji_m",
  SADIQ: "men_a", MUKTAR: "men_a", YUSUF: "men_a", KHALID: "men_a", MICHEAL: "men_a", MUBARAK: "men_a", MUSA: "men_a",
  ABBAS: "men_b", KELECHI: "men_b", TUNDE: "men_b", LULA: "men_b", "LULA AJAKA": "men_b", MUHAMMAD: "men_b", AHMAD: "men_b",
  JEGA: "men_c", YAKUBU: "men_c", LUCKY: "men_c", ABDUL: "men_c", AB: "men_c", BASIT: "men_c",
  NUSAYBAH: "women_a", LYZZY: "women_a", FATIMA: "women_a", "BIG BABY": "women_a", SUMMY: "women_a", IDK: "women_a", KALTUME: "women_a", JOY: "women_a",
  LILY: "women_b", "LILY AND LYZZY": ["women_b", "women_a"], WEDNESDAY: "women_b", MARYAM: "women_b", FATY: "women_b", "FATY AJAKA": "women_b", ADA: "women_b", AISHA: "women_b", "COMRADE SADIYA": "women_b", SVITLANA: "women_b", JASMIN: "women_b",
  "PROF. BELLO": "lecturer_m", BELLO: "lecturer_m", "MR. EZEKIEL": "lecturer_m", EZEKIEL: "lecturer_m", "USTAZ AUWAL": "lecturer_m", TANKO: "lecturer_m", "EXTERNAL EXAMINER": "lecturer_m", "PANEL CHAIR": "lecturer_m", "PASTOR SAM": "lecturer_m",
  "DR. OKONKWO": "staff_f", OKONKWO: "staff_f", "DR. KHADIJA": "staff_f", KHADIJA: "staff_f", "@HOD": "staff_f", "PROF. NWACHUKWU": "staff_f", "MRS. ADEBAYO": "staff_f", "MRS. SHEHU": "staff_f", "NURSE HAUWA": "staff_f", HAUWA: "staff_f", "SGT. BILKISU": "staff_f", BILKISU: "staff_f", "FOREMAN ASABE": "staff_f",
  "MALAM GARBA": "staff_m", GARBA: "staff_m", "BABA PORTER": "staff_m", "MR. CLEMENT": "staff_m", "COACH DANLADI": "staff_m", DANLADI: "staff_m", "ENGR. ALIYU": "staff_m", ALIYU: "staff_m", "BABA SHUTTLE": "staff_m", "CHIEF MEGAWATT": "staff_m",
  "FOREMAN DANJUMA": "staff_m", "FOREMAN IKENNA": "staff_m", "CORPORAL PETER": "staff_m", PETER: "staff_m", "RANGER LAWAL": "staff_m", LAWAL: "staff_m", SHAMSU: "men_a", WATCHMAN: "staff_m", "FIRE OFFICER": "staff_m", GUARD: "staff_m", SECURITY: "staff_m", DAD: "staff_m", "@BOSS": "staff_m", "@SUPER": ["lecturer_m", "staff_f"],
  AUDU: "traders_m", "MAI SHAYI AUDU": "traders_m", "BABA DAM": "traders_m", EMEKA: "traders_m", "ALHAJI NEEDLE": "traders_m", "CHI-TECH": "traders_m", KB: "traders_m", "MALLAM DOGO": "traders_m", SHUAIBU: "traders_m", "THE OWNER": "traders_m", MANAGER: "traders_m", "SCRAP DEALER": "traders_m",
  MUM: "traders_f", DAD: "staff_m", "MAMA NKECHI": "traders_f", "HAJIYA LADI": "traders_f", "AUNTY ASIYA": "traders_f", ASIYA: "traders_f", "CAPTAIN UCHE": "traders_f", UCHE: "traders_f", "IYA RISI": "traders_f", KAKA: "traders_f", CLEMANTINE: "traders_f", MUM: "traders_f", TRADER: "traders_f",
  "DJ KABIRU": "dj", KABIRU: "dj", "DJ SUGAR": "dj", RADIO: "dj",
  "THE MAKER": "maker_m", MAKER: "maker_m",
  "PASTOR SAM AND USTAZ AUWAL": "lecturer_m", "MRS. EZEKIEL": "staff_f", ASABE: "staff_f", "MAI SHAYI": "traders_m", "MR. LINUS": "staff_m", LINUS: "staff_m",
  CROWD: "crowd", "THE CROWD": "crowd", EVERYONE: "crowd", WALKER: "crowd", AMINU: "crowd", "LITTLE SIBLING": "crowd", CHILD: "crowd", "THE BOY": "crowd", FRESHER: "crowd", "A FRESHER": "crowd", "THE FRESHER": "crowd"
};
const NICE = { "@CRUSH OR @BEST": "your crush or best friend", "@ROOMIE": "your roommate", "@CRUSH": "your crush", "@BEST": "your best friend", "@HOD": "your head of department", "@BOSS": "your boss", "@SUPER": "your supervisor", PLAYER: "you", YOU: "you" };
const pretty = (s) => s.replace(/\b([A-Z])([A-Z'’.-]+)/g, (x, a, b) => a + b.toLowerCase()).replace(/^Dj\b/, "DJ").replace(/\bKb\b/, "KB").replace(/\bIdk\b/, "IDK").replace(/\bAb\b/, "AB").replace(/\bChi-tech\b/, "Chi-Tech");
// A speaker label → { roles, who, note, fx }.
function speaker(raw) {
  const label = raw.replace(/^\([^)]*\)\s*/, "").replace(/[`*★]/g, "").trim(), m = /^([^(]+?)\s*\((.*)\)\s*$/.exec(label), base = (m ? m[1] : label).trim().toUpperCase(), inner = m ? m[2] : "";
  if (base === "RADIO") { const who = inner.split(",")[0].trim(); return { roles: /maker/i.test(who) ? ["maker_m"] : ["dj"], who: "Radio" + (who ? " (" + who + ")" : ""), note: inner.split(",").slice(1).join(",").trim() || (/automated/i.test(inner) ? "a flat automated voice" : "on air"), fx: "radio" }; }
  if (base === "PHONE") { const parts = inner.split(","), r = speaker(parts[0].trim().replace(/^@roomie$/i, "@ROOMIE")); return Object.assign(r, { who: r.who + " on the phone", note: ["on the phone"].concat(parts.slice(1).map((x) => x.trim())).join(", ") }); }
  if (base === "WALKER") { const w = inner.split(",")[0].replace(/^an? /i, "").trim().toUpperCase(), named = SPEAK[w] || SPEAK[w.split(" ")[0]];
    return { roles: [].concat(named || (/GUARD|RANGER/.test(w) ? "staff_m" : /TEACHER/.test(w) ? "staff_f" : /TRADER|CLEANER/.test(w) ? "traders_f" : /PARENT/.test(w) ? "traders_m" : "crowd")), who: named ? pretty(w) : "A passer-by" + (inner ? " (" + inner.split(",")[0] + ")" : ""), note: "overheard in passing" }; }
  const note = inner && !/^if\b/i.test(inner) ? inner : inner.replace(/`/g, "");
  if (base === "@SUPER" && inner) return { roles: [/bello/i.test(inner) ? "lecturer_m" : "staff_f"], who: "Your supervisor (" + inner + ")", note: "" };
  if (/^BATURE$/.test(base) && /radio/i.test(inner)) return { roles: ["bature_m"], who: "Bature", note: "on the radio", fx: "radio" };
  let r = SPEAK[base], words = base.split(/\s+/);
  if (!r) r = SPEAK[words[words.length - 1]] || SPEAK[words[0]];
  if (!r) { const NAMES = D.NAMES || [], f = (NAMES.f || []).some((x) => x.toUpperCase() === words[words.length - 1]), mm = (NAMES.m || []).some((x) => x.toUpperCase() === words[words.length - 1]);
    r = /CHILD|BOY|GIRL|PUPIL|SIBLING|KID/.test(base) ? "crowd" : /OFFICER|GUARD|RANGER/.test(base) ? "staff_m" : f ? (hash(base) % 2 ? "women_a" : "women_b") : mm ? ["men_a", "men_b", "men_c"][hash(base) % 3] : "crowd"; }
  const who = NICE[base] ? NICE[base].replace(/^./, (c) => c.toUpperCase()) : /^(A|AN|THE) /.test(base) || r === "crowd" ? pretty(label.replace(/\s*\(.*\)$/, "")) : pretty(base);
  return { roles: [].concat(r), who: who, note: note };
}

/* ---------- collecting ---------- */
let order = 0; const seen = {}, clash = [], skipped = [];
function put(rid, scene, ctx, line) {
  if (!line.text || !norm(line.text) || /[{}<>]/.test(line.text)) return; const r = role[rid], i = id(line.text);
  if (seen[i] && seen[i] !== norm(line.text)) clash.push([line.text, seen[i]]); seen[i] = norm(line.text);
  const old = r.lines.find((l) => l.id === i); if (old) { if (line.tier < old.tier) old.tier = line.tier; return; }
  r.lines.push(Object.assign({ id: i, scene: scene, context: ctx || "", o: order++ }, line));
  if (line.who) r.cast[line.who] = (r.cast[line.who] || 0) + 1;
}
const clean = (t) => { let note = "", s = t.replace(/[`*_★]/g, "").trim(); const tail = /\s*\(([^()]*)\)\s*$/.exec(s);
  if (tail && !/^["“]/.test(s.slice(tail.index).trim())) { note = tail[1]; s = s.slice(0, tail.index).trim(); }
  if (/^["“]/.test(s)) s = s.replace(/^["“]/, "").replace(/["”]\s*$/, "").replace(/["”]\s*["“]/g, " ").replace(/["“”]/g, "");
  return { text: s.replace(/\s+/g, " ").trim(), note: note }; };
const D = require(path.join(JS, "samaru-data.js"));

// 1–2. The story scripts.
function ingest(file, kind) {
  const src = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n") : []; let scene = "", ctx = "", beat = 0, turn = false, around = false, prevWho = null;
  for (let k = 0; k < src.length; k++) { const L = src[k];
    const h = /^###\s+([msef])(\d+)\s+[—-]\s+(.+)$/i.exec(L);
    if (h) { scene = ({ m: "Mission ", s: "Side mission ", e: "Encounter ", f: "Friends mission " })[h[1].toLowerCase()] + h[2] + ": " + h[3].trim(); ctx = ""; beat = 0; turn = false; around = false; prevWho = null; continue; }
    if (/^\*\*Premise\.\*\*/.test(L)) { ctx = L.replace(/^\*\*Premise\.\*\*\s*/, "") + (src[k + 1] && !/^\s*$|^\*\*|^\d+\./.test(src[k + 1]) ? " " + src[k + 1].trim() : ""); ctx = ctx.split(/(?<=[.!?])\s/).slice(0, 2).join(" "); }
    if (/^\*\*Around it\.\*\*/.test(L)) around = true; else if (/^\*\*/.test(L)) around = false;
    const b = /^\s*(\d+)\.\s*(.*)$/.exec(L); if (b && !/^\s*-/.test(L)) { beat = +b[1]; turn = /\[turn\]/.test(b[2]); }
    if (!/\[v:\s*\]/.test(L) || !scene) continue;
    const body = L.replace(/\s*\[v:\s*\].*$/, ""); let who, said;
    const amb = /^\s*-\s*([ABC])\.\s*(?:([^:"“]{1,60}):\s*)?(["“].*)$/.exec(body);
    if (amb) { who = amb[2] && !/^same$/i.test(amb[2].trim()) ? amb[2].trim() : amb[2] ? prevWho : null; prevWho = who; said = amb[3]; }
    else { const m = /(?:^|\s)-\s+((?:\([^)]*\)\s*)?[A-Z@★][A-Za-z@.'’ \-★]*?(?:\s*\([^)]*\))?):\s+(.+)$/.exec(body) || /^\s*-?\s*((?:\([^)]*\)\s*)?@?[A-Z][A-Za-z0-9@.'’ \-]*?(?:\s*\([^)]*\))?):\s+(.+)$/.exec(body);
      if (!m) { skipped.push(body.trim().slice(0, 90)); continue; } who = m[1]; said = m[2]; }
    const c = clean(said); if (/@[a-z]/.test(c.text)) { skipped.push("(name filled in during play) " + c.text.slice(0, 70)); continue; }
    const sp = who ? speaker(who) : { roles: ["crowd"], who: "Somebody nearby", note: "" }, conditional = /\(if `/i.test(who || "");
    const tier = kind === "ambient" || (kind === "year1" && !around && !conditional) ? "A" : around || conditional ? "C" : kind === "main" ? (beat <= 1 || turn ? "A" : "B") : (beat <= 1 || turn ? "B" : "C");
    sp.roles.forEach((rid) => { let w = sp.who; if (/roommate/i.test(w)) w = rid === "bature_m" ? "Bature (your roommate)" : rid === "firdausi_f" ? "Firdausi (your roommate)" : w;
      else if (sp.roles.length > 1 && /crush|best friend/i.test(w)) w += rid.startsWith("men") || rid === "bature_m" ? " (a young man)" : " (a young woman)";
      const tone = [sp.note, c.note].filter(Boolean).join("; ");
      put(rid, scene, ctx, { text: c.text, tier: tier, who: w, tone: w + (tone ? ": " + tone : ""), fx: sp.fx || "" }); });
  }
}
// Year 1 is what every player plays first, so all of its mission lines are tier A.
["INTRO", "Y1", "Y1b", "Y2", "Y3", "Y4", "Y5"].forEach((y) => ingest(path.join(STORY, "scripts", y + ".md"), /^(Y1|INTRO)/.test(y) ? "year1" : "main"));
ingest(path.join(STORY, "scripts", "SIDE.md"), "side"); ingest(path.join(STORY, "scripts", "AMBIENT.md"), "ambient"); ingest(path.join(STORY, "05_FRIENDS_MISSIONS.md"), "side");

// 3. The Maker's sayings.
(function sayings() { const f = path.join(STORY, "02_BIBLE.md"), bible = fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "", at = bible.indexOf("## 18."); if (at < 0) return;
  const sec = bible.slice(at, bible.indexOf("\n## ", at + 5)); let m; const re = /^\d+\.\s+"(.+)"\s*$/gm;
  while ((m = re.exec(sec))) put("maker_m", "The Maker's sayings", "After the ring is lit, the Maker walks the campus free. Talking to him gives one saying. Dry, kind and exact; a smile you can hear.", { text: m[1], tier: "A", who: "The Maker", tone: "a saying" }); })();

// 4. Lines the game speaks outside the story.
const G = (rids, scene, ctx, list, tier, tone, fx) => (list || []).forEach((t) => [].concat(rids).forEach((rid) => put(rid, scene, ctx, { text: t, tier: tier, who: "", tone: tone || "", fx: fx || "" })));
const PLAYERS = ["player_m", "player_f"], FRIENDS = ["bature_m", "firdausi_f", "men_b", "women_b"], PEOPLE = ["crowd", "traders_m", "traders_f", "men_a", "women_a"];
const TONE = { hungry: "tired of being hungry", starving: "weak", tired: "worn out", wave: "cheerful greeting, called out", dance: "hyped", levelup: "proud", money: "delighted", hit: "short pain shout", win: "triumphant", ride: "eager", scared: "frightened whisper-shout", token: "wise, amused", sleep: "relieved sigh", eat: "satisfied" };
const SC = { hungry: "Body talk", starving: "Body talk", tired: "Body talk", sleep: "Body talk", eat: "Body talk", wave: "Greetings", hit: "Fights and frights", scared: "Fights and frights", win: "Good moments", levelup: "Good moments", money: "Good moments", dance: "Good moments", token: "Good moments", ride: "On the road" };
const CTX = { "Body talk": "Out and about: you are hungry, tired or finally resting. You are talking to yourself.", "Greetings": "You wave and call out to someone across the road.", "Fights and frights": "You have just been hit, or something scared you at night.", "Good moments": "Something good just happened: money came in, you levelled up, you won.", "On the road": "You are getting on a bike or into a car." };
const A_BARKS = { wave: 1, hit: 1, hungry: 1, tired: 1, ride: 1, money: 1 };
Object.keys(D.BARKS || {}).forEach((k) => { if (k === "faint") return; if (k === "ped") return G(PEOPLE, "Around campus: bad driving", "A car or bike has nearly hit you. You shout at the driver.", D.BARKS[k], "A", "shouting at a careless driver");
  G(PLAYERS, "Around campus: " + (SC[k] || "other").toLowerCase(), CTX[SC[k]] || "", D.BARKS[k], A_BARKS[k] ? "A" : "B", TONE[k]); });
G(PLAYERS, "Around campus: quick shouts to friends", "Short phrases you call out to other players in multiplayer.", literal(read("samaru-ui.js"), "Z.CHAT = "), "B", "called out");
const SAY = literal(read("samaru-brawl.js"), "var SAY = ") || {};
const BR = { hurt: [PEOPLE, "Somebody hit you for no reason", "shocked and hurt"], scared: [PEOPLE, "Somebody hit you for no reason", "frightened, backing away"], yield: [PEOPLE.concat("bolaji_m"), "You have lost a fight", "giving up"], up: [PEOPLE, "Getting up after being knocked down", "sore, complaining"],
  car: [PEOPLE, "Bad driving", "furious at a driver"], dodge: [PEOPLE, "Bad driving", "jumping out of the way"], gasp: [PEOPLE, "Watching a fight", "shocked bystander"], film: [["crowd", "men_c"], "Watching a fight", "amused, filming on a phone"], shout: [PEOPLE, "Watching a fight", "shouting for help"],
  back: [["bolaji_m", "men_c", "crowd"], "Fighting back", "angry, hitting back"], tough: [["bolaji_m"], "Fighting back", "calm threat"], enough: [["bolaji_m"], "After winning a fight", "cold, finished with you"], warn: [["bolaji_m"], "After winning a fight", "warning as you run"],
  friendNo: [FRIENDS, "Your friend (the player) starts a fight", "upset with your friend"], friendIn: [FRIENDS, "Your friend (the player) is attacked", "stepping in to defend"], npc: [FRIENDS.concat("traders_m", "traders_f", "staff_f"), "Someone you know hits you", "betrayed"], guard: [["staff_m", "staff_f"], "Someone attacks a guard", "outraged"] };
const BCTX = { "Somebody hit you for no reason": "You were walking past and a student hit you.", "You have lost a fight": "You have had enough and you give up.", "Getting up after being knocked down": "You are picking yourself up off the ground.", "Watching a fight": "A fight has broken out near you.", "Fighting back": "Somebody hit you and you are not having it.", "After winning a fight": "The other person is down or running.", "Your friend (the player) starts a fight": "Your friend is hitting an innocent person and you want them to stop.", "Your friend (the player) is attacked": "Somebody is beating your friend.", "Someone you know hits you": "A student you know has just hit you.", "Someone attacks a guard": "A student has just hit a security officer.", "Bad driving": "A car or bike has nearly hit you. You shout at the driver." };
Object.keys(SAY).forEach((k) => { const b = BR[k] || [["crowd"], "Other fight lines", ""]; G(b[0], "Around campus: " + b[1].toLowerCase(), BCTX[b[1]] || "", SAY[k], /hurt|car|dodge|gasp/.test(k) ? "A" : "B", b[2]); });
G(PEOPLE, "Around campus: bumped in the walkway", "The player has walked or run straight into you.", literal(read("samaru-fx.js"), "OOPS = "), "A", "surprised, a bit annoyed");
const GUARD = literal(read("samaru-voice.js"), "V.GUARD = ") || {};
const GS = { warn: ["Security: warnings", "A student is misbehaving. You shout a warning from a distance.", "warning shout"], final: ["Security: warnings", "", "last warning, cold"], wanted: ["Security: the chase", "The student ignored every warning. You are running after them.", "chasing, shouting"], seen: ["Security: the chase", "", "spotting them again"], escaped: ["Security: the chase", "", "giving up, out of breath"], caught: ["Security: caught", "You have caught the student.", "stern"] };
Object.keys(GUARD).forEach((k) => G("staff_m", (GS[k] || [])[0] || "Security", (GS[k] || [])[1], GUARD[k], k === "warn" || k === "wanted" || k === "final" ? "A" : "B", (GS[k] || [])[2]));
G("staff_m", GS.warn[0], GS.warn[1], literal(read("samaru-core.js"), "var WARN = "), "A", "warning shout");
(read("samaru-core.js").match(/Security: \\"([^"\\]+)\\"/g) || []).forEach((m) => G("staff_m", GS.wanted[0], GS.wanted[1], [m.replace(/^Security: \\"|\\"$/g, "")], "A", "shouted"));
(D.RADIO || []).forEach((r) => G("dj", "Radio: station idents", "One short ident per station, said between songs.", [r.dj], "A", r.name + " (" + r.style + " music)", "radio"));
const FR = read("samaru-friends.js");
G(FRIENDS, "Around campus: small talk", "Chatting with a course mate while you walk.", literal(FR, "var CHAT = "), "B", "small talk");
G(FRIENDS, "Around campus: walking together", "You are leading the player somewhere, or leaving to get on with your day.", (literal(FR, "var WAIT = ") || []).concat(literal(FR, "var BYE = ") || []), "B", "friendly");
["samaru-friends.js", "samaru-core.js"].forEach((f) => { const src = read(f); let m;
  const one = /\bsay\(\s*(?:n|o\.n)\s*,\s*(?:\w+\s*\?\s*)?"((?:[^"\\]|\\.)+)"\s*(?:\)|:)/g; while ((m = one.exec(src))) G(FRIENDS, "Around campus: walking together", "", [m[1].replace(/\\(.)/g, "$1")], "B", "friendly");
  const pk = /pick\(\[((?:\s*"(?:[^"\\]|\\.)+"\s*,?)+)\]\)/g; while ((m = pk.exec(src))) G(FRIENDS, "Around campus: walking together", "", (0, eval)("[" + m[1] + "]"), "B", "friendly"); });
strings(literal(read("samaru-life.js"), "L.LESSONS = ") || {}).forEach((t) => G(["lecturer_m", "staff_f"], "In the lecture hall", "You are teaching a full lecture theatre. Three sentences make one short lesson.", [t], "B", "teaching, unhurried", "hall"));
(D.NPCS || []).forEach((n) => { const sp = speaker(n.name); (n.hi || []).forEach((t) => sp.roles.forEach((rid) => put(rid, "Greetings around campus", "The player walks up and says hello.", { text: t, tier: "B", who: sp.who, tone: sp.who + ", " + (n.role || "").toLowerCase() }))); });
["samaru-core.js", "samaru-ui.js"].forEach((f) => { const re = /Z\.say\(("me"|[\w.]+(?:\("[\w-]*"\))?), "((?:[^"\\]|\\.)+)"/g, src = read(f); let m;
  while ((m = re.exec(src))) { const t = m[2].replace(/\\(.)/g, "$1"); if (m[1] === '"me"') G(PLAYERS, "Around campus: other", "", [t], "C", "to yourself"); else { const n = (/npc\("([\w-]+)"\)/.exec(m[1]) || [])[1], d = (D.NPCS || []).find((x) => x.id === n);
    if (d) speaker(d.name).roles.forEach((rid) => put(rid, "Greetings around campus", "", { text: t, tier: "C", who: d.name, tone: d.name })); else if (!/^n$|^p$/.test(m[1])) G("crowd", "Odd lines", "One-off lines from visitors and strangers.", [t], "C", m[1] === "Z.cameo" ? "a visiting Sir Isaac Newton" : ""); } } });
(D.HALL || []).forEach((h) => put("maker_m", "The six plaques in the Engineering Garden", "Each plaque is read aloud when the player stands at it. Read like a guide in a museum, slowly. These are long: one breath per sentence is fine, but keep every pause under half a second.", { text: h.text, tier: "C", who: "The Maker", tone: "plaque: " + h.name }));

/* ---------- the filler phrase bank (docs/voice/FILLER_PHRASES.md): everyone reads "For everyone", plus their own section ---------- */
const filler = { all: [], m: [], f: [] };
(function fillers() { const f = path.join(OUT, "FILLER_PHRASES.md"); if (!fs.existsSync(f)) return; let part = "", scene = null; const got = {};
  fs.readFileSync(f, "utf8").split("\n").forEach((L) => { let m;
    if ((m = /^##\s+(.+)$/.exec(L))) { part = /^men/i.test(m[1]) ? "m" : /^women/i.test(m[1]) ? "f" : /everyone/i.test(m[1]) ? "all" : ""; scene = null; return; }
    if (!part) return;
    if ((m = /^###\s+(.+)$/.exec(L))) { filler[part].push((scene = { title: m[1].trim(), context: "", lines: [] })); return; }
    if (scene && (m = /^\*(.+)\*\s*$/.exec(L))) { scene.context = m[1].trim(); return; }
    if (scene && (m = /^-\s+(.+?)\s+·\s+([\w-]+)\s+·\s+([\w-]+)\s*$/.exec(L))) { const t = m[1].trim(), i = id(t); if (got[part + i] || got["all" + i]) return; got[part + i] = 1;
      scene.lines.push({ id: i, text: t, tone: m[2] + ", " + m[3], tier: "A", mood: m[2], use: m[3] }); } }); })();

/* ---------- lines the super admin edited (Arcade Management → FSLG Characters) ----------
   docs/voice/line_overrides.json is written by `python manage.py fslg_voice_overrides`. The new words replace the old ones
   in the script, marked NEEDS RE-RECORD; the id follows the new words, which is what the game looks the clip up by. */
const OVR = (() => { try { return JSON.parse(fs.readFileSync(path.join(OUT, "line_overrides.json"), "utf8")).lines || {}; } catch (e) { return {}; } })(); let rerecord = 0;
ROLES.forEach((r) => r.lines.forEach((l) => { const o = OVR[l.id]; if (!o || !o.t || /[{}<>]/.test(o.t)) return; l.text = o.t; l.id = id(o.t); l.tone = (l.tone ? l.tone + "; " : "") + "NEEDS RE-RECORD: the words were changed"; l.rerecord = true; rerecord++; }));

/* ---------- number and write ---------- */
const WPM = 140, count = { A: 0, B: 0, C: 0 }, out = { version: 4, note: "Generated by tools/voice/make_script.js. Do not edit by hand.", roles: [], groups: [] };
const mins = (lines) => { let w = 0; lines.forEach((l) => { w += l.text.split(/\s+/).length; }); return lines.length ? Math.max(1, Math.round((w / WPM + lines.length * 2.5 / 60) * 1.6)) : 0; }; // reading + pauses, plus retakes
ROLES.forEach((r) => { if (!r.lines.length) return;
  const sorted = ["A", "B", "C"].flatMap((t) => r.lines.filter((l) => l.tier === t).sort((a, b) => a.o - b.o)), scenes = [];
  sorted.forEach((l, i) => { l.n = String(i + 1); count[l.tier]++; const last = scenes[scenes.length - 1]; if (last && last.title === l.scene && last.tier === l.tier) last.lines.push(l); else scenes.push({ title: l.scene, context: l.context, tier: l.tier, lines: [l] }); });
  const flat = sorted.map((l) => { const o = { n: l.n, id: l.id, tier: l.tier, text: l.text, tone: l.tone, scene: l.scene }; if (l.fx) o.fx = l.fx; if (l.rerecord) o.rerecord = true; return o; });
  const tiers = { A: mins(flat.filter((l) => l.tier === "A")), B: mins(flat.filter((l) => l.tier === "B")), C: mins(flat.filter((l) => l.tier === "C")) };
  const cast = Object.keys(r.cast).map((k) => k.replace(/ on the phone$| \(a young (wo)?man\)$/, "")).filter((k, i, a) => k && a.indexOf(k) === i).sort((a, b) => (r.cast[b] || 0) - (r.cast[a] || 0));
  const o = { id: r.id, label: r.label, owner: !!r.owner, who: r.who, characters: r.chars || cast.slice(0, 18).join(", ") + (cast.length > 18 ? " and others" : ""), cast: cast, sound: r.sound + " " + SOUND,
    x: r.x || [], kind: r.kind || "", minutes: mins(flat), tiers: tiers, scenes: scenes.map((s) => ({ title: s.title, context: s.context, tier: s.tier, lines: s.lines.map((l) => flat[+l.n - 1]) })), lines: flat };
  out.roles.push(o); out.groups.push({ id: r.id, label: r.label, fx: "", x: o.x, kind: o.kind, lines: flat }); });
// Filler phrase bank: one group per voice (the shared phrases, then that voice's own section) plus "filler" for an unknown voice.
const fillerOf = (secs) => { let k = 0; const fl = []; secs.forEach((s) => s.lines.forEach((l) => { fl.push({ n: "F" + (++k), id: l.id, tier: "A", text: l.text, tone: l.tone, mood: l.mood, use: l.use, scene: s.title }); })); return fl; };
if (filler.all.length) { const both = fillerOf(filler.all.concat(filler.m, filler.f)), nOf = {}; both.forEach((l) => { nOf[l.id + "|" + l.scene] = l.n; });
  const sc = []; both.forEach((l) => { const last = sc[sc.length - 1]; if (last && last.title === l.scene) last.lines.push(l); else { const src = filler.all.concat(filler.m, filler.f).find((s) => s.title === l.scene); sc.push({ title: l.scene, context: src ? src.context : "", lines: [l] }); } });
  out.filler = { minutes: mins(fillerOf(filler.all)), shared: fillerOf(filler.all).length, men: filler.m.reduce((a, s) => a + s.lines.length, 0), women: filler.f.reduce((a, s) => a + s.lines.length, 0), scenes: sc, lines: both };
  [["filler_m", "Filler phrases (male voice)", filler.all.concat(filler.m)], ["filler_f", "Filler phrases (female voice)", filler.all.concat(filler.f)], ["filler", "Filler phrases (any voice)", filler.all]].forEach((g) =>
    out.groups.push({ id: g[0], label: g[1], fx: "", x: [], kind: "filler", lines: fillerOf(g[2]).map((l) => Object.assign(l, { n: nOf[l.id + "|" + l.scene] || l.n })) })); }
out.counts = count; out.unique = Object.keys(seen).length; out.skipped = skipped; out.rerecord = rerecord;
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "lines.json"), JSON.stringify(out, null, 1) + "\n");

// What the game needs at run time to choose a stand-in phrase: mood and use for every line whose tone note says so.
const TAG = [[/flirt|romanc|crush|smile you/i, "flirty"], [/furious|angry|outrag|threat|cold|stern|shout(ed|ing) at/i, "angry-light"], [/annoy|irritat|complain|fed up/i, "annoyed"], [/sad|sorry|hurt|betray|tears|weak|mourn/i, "sad"], [/worr|scared|fright|nervous|whisper|careful|dark/i, "worried"],
  [/hyped|triumph|excit|delight|cheer|shock|surpris|called out/i, "excited"], [/happy|proud|warm|cheerful|friendly|amused|satisf|relieved|smil/i, "happy"], [/tired|worn|sleep|dizzy|sigh|out of breath/i, "tired"]];
const USE = [[/greet|hello|says hello/i, "greet"], [/warning|warn/i, "warn"], [/chas|hurry/i, "hurry"], [/teach|lecture/i, "lecture"], [/on air|radio|ident/i, "crowd"], [/on the phone/i, "phone"], [/fight|hit|attack/i, "fight"], [/pain|shout/i, "react"]];
const tags = {}; out.roles.forEach((r) => r.lines.forEach((l) => { const t = (l.tone || "") + " " + (l.scene || ""); const mo = (TAG.find((x) => x[0].test(t)) || [])[1] || "", us = (USE.find((x) => x[0].test(t)) || [])[1] || ""; if (mo || us) tags[l.id] = mo + "|" + us; }));
const AUDIO = path.join(ROOT, "static", "audio", "voice"); fs.mkdirSync(AUDIO, { recursive: true }); fs.writeFileSync(path.join(AUDIO, "tags.json"), JSON.stringify(tags) + "\n");

const esc = (s) => String(s).replace(/\|/g, "\\|");
let md = "# Freshers School Life — voice recording script\n\nGenerated by `tools/voice/make_script.js` from the story scripts (`docs/story/scripts/`) and the game's own lines. **" + out.roles.length + " voice roles, " + out.roles.reduce((a, r) => a + r.lines.length, 0) + " recordings of " + out.unique + " different lines** (tier A " + count.A + ", B " + count.B + ", C " + count.C + "). " +
  "Each role has its own hand-out PDF in `docs/voice/pdf/` with the instructions inside; this file is the plain list.\n\n| Role | Who | Lines (A/B/C) | Minutes (A / all) |\n|---|---|---|---|\n";
out.roles.forEach((r) => { const c = (t) => r.lines.filter((l) => l.tier === t).length; md += "| " + r.label + (r.owner ? " (owner)" : "") + " | " + esc(r.who) + " | " + r.lines.length + " (" + c("A") + "/" + c("B") + "/" + c("C") + ") | " + r.tiers.A + " / " + r.minutes + " |\n"; });
md += "\nRecord in order, Tier A first. Do not read the numbers aloud. Leave about a second and a half of silence between lines. If you fluff a line, clap once and say it again. Save as `<role>_<yourname>.m4a` (any audio format) and drop it in `voice_in/`.\n\n";
out.roles.forEach((r) => { md += "## " + r.label + " — `" + r.id + "`\n\n**Who:** " + r.who + " **Characters:** " + (r.characters || "—") + "\n\n";
  r.scenes.forEach((sc) => { md += "### Tier " + sc.tier + " · " + sc.title + "\n\n" + (sc.context ? "*" + sc.context + "*\n\n" : "") + "| No. | Say this | Who / how | id |\n|---|---|---|---|\n"; sc.lines.forEach((l) => { md += "| " + l.n + " | " + esc(l.text) + " | " + esc(l.tone) + " | `" + l.id + "` |\n"; }); md += "\n"; }); });
fs.writeFileSync(path.join(OUT, "RECORDING_SCRIPT.md"), md);
if (clash.length) { console.error("ID CLASH", clash); process.exit(1); }
console.log(JSON.stringify({ counts: count, unique: out.unique, skipped: skipped.length, filler: out.filler && [out.filler.shared, out.filler.men, out.filler.women, out.filler.minutes],
  roles: out.roles.map((r) => [r.id, r.lines.length, ["A", "B", "C"].map((t) => r.lines.filter((l) => l.tier === t).length).join("/"), r.tiers.A + "/" + r.minutes + "m"]) }));
