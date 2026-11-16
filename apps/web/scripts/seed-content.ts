/**
 * Seed the Site v2 content: cheats and heroes from the old site (hashed),
 * the open-world cast, news, events, deals, house ads, store products,
 * credits, history, FAQs and the site's switches.
 *
 * Safe to run again: every step adds only what is missing and never
 * overwrites anything changed in the admin panel.
 *
 * Privacy: real people appear by first name only, with no photos (photos are
 * uploaded later by the owner, with consent, through the admin panel).
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Repos } from "@mib/db";
import { REPO_ROOT } from "../src/lib/env.ts";

const DAY = 86_400_000;
const now = Date.now();
const days = (n: number) => new Date(now + n * DAY);

/* --------------------------------------------------- cheats and heroes */

interface LegacyCheat {
  id: string;
  label: string;
  note?: string;
  how?: string;
  on: boolean;
  typed_sha256?: string;
  dial_sha256?: string;
}

async function seedCheatsAndHeroes(repos: Repos) {
  const cheats = JSON.parse(readFileSync(resolve(REPO_ROOT, "data/seed/cheats.json"), "utf8")) as {
    games: { slug: string; cheats: LegacyCheat[] }[];
  };
  let added = 0;
  for (const g of cheats.games) {
    for (const c of g.cheats) {
      const base = { gameSlug: g.slug, key: c.id, label: c.label, how: c.how || c.note || "", enabled: c.on, effect: { note: c.note ?? "" } };
      if (c.typed_sha256 && (await repos.cheats.importLegacy({ ...base, channel: "typed", legacyHash: c.typed_sha256 }))) added++;
      if (c.dial_sha256 && (await repos.cheats.importLegacy({ ...base, channel: "dial", legacyHash: c.dial_sha256 }))) added++;
    }
  }
  console.log(`  cheats: ${added} codes imported (old hashes, upgraded on first use)`);

  const heroes = JSON.parse(readFileSync(resolve(REPO_ROOT, "data/seed/heroes.json"), "utf8")) as {
    hashes: { scope: string; hash: string }[];
    hero_characters: { slug: string; name: string; full: string; combo: string; swipe: string; powers: string }[];
  };
  let h = 0;
  for (const row of heroes.hashes) {
    const reveal = heroes.hero_characters.find((c) => c.slug === row.scope) ?? heroes.hero_characters[0];
    const details: Record<string, string> = reveal ? { combo: reveal.combo, swipe: reveal.swipe, powers: reveal.powers } : {};
    if (await repos.heroes.importLegacy({ name: "M.I. BUGAJE", fullName: "Muhammad Iliyasu Bugaje", djangoHash: row.hash, gameSlug: row.scope, details })) h++;
  }
  // Per-game reveal moves and powers live in the game's settings (no secret in them).
  for (const c of heroes.hero_characters) {
    const current = await repos.gameSettings.get(c.slug);
    if (!current.heroReveal) await repos.gameSettings.update(c.slug, { heroReveal: { name: c.name, combo: c.combo, swipe: c.swipe, powers: c.powers } });
  }
  console.log(`  heroes: ${h} imported (Django hashes, re-hashed on first use)`);
}

/* ------------------------------------------------------------ characters */

const KIND: Record<string, "lead" | "friend" | "recurring" | "staff" | "family" | "special" | "mystery" | "public"> = {
  jega: "lead", shamsu: "lead", mubarak: "lead", nusaiba: "lead", zainab: "lead", roomie: "lead", bature: "lead", firdausi: "lead",
  maker: "mystery", muhammad: "mystery",
  bolaji: "friend", abbas: "friend", helen: "friend", aleeya: "friend", lyzzy: "friend", lily: "friend", emily: "friend", kelechi: "friend",
  lula: "recurring", faty: "recurring", tunde: "recurring", big_baby: "recurring", maryam: "recurring", wednesday: "recurring",
  baba_porter: "recurring", mai_shayi: "recurring", mama_nkechi: "recurring", hajiya_ladi: "recurring", garba: "recurring", tanko: "recurring",
  kaka: "recurring", baba_dam: "recurring", kb: "recurring", megawatt: "recurring", aliyu: "recurring", kabiru: "recurring",
  okonkwo: "staff", khadija: "staff", dr_minus: "staff", hauwa: "staff", mrs_adebayo: "staff", danladi: "staff", ngozi: "staff",
  bilkisu: "staff", lawal: "staff", pastor_sam: "staff", ustaz_auwal: "staff",
  mum: "family", dad: "family",
};
const ROLE: Record<string, string> = {
  jega: "The footballer", shamsu: "The genius", mubarak: "The hustler", nusaiba: "The organiser", zainab: "The doctor",
  roomie: "Your roommate", bature: "Your roommate (male player)", firdausi: "Your roommate (female player)",
  maker: "The keeper of the coil", muhammad: "A quiet young man in a white shirt",
  jiya: "The lawyer who became an engineer", taty: "Never tired, usually winning", madison: "Fast talk, faster feet", mib: "Kind, quiet, and three letters at the top of every table",
};
const SPECIAL: Record<string, { name: string; power: string; unlock: string }> = {
  jiya: { name: "Jiya", power: "Legal Immunity", unlock: "Code, event or achievement" },
  taty: { name: "Taty", power: "Never Tired", unlock: "Code, event or achievement" },
  madison: { name: "Madison", power: "Trend Setter", unlock: "Code, event or achievement" },
  mib: { name: "M.I. BUGAJE", power: "Undefeatable", unlock: "Owner only" },
};
const PLAYABLE: Record<string, { power: string; unlock: string }> = {
  jega: { power: "Left Boot First", unlock: "Win the Vice-Chancellor's Cup" },
  shamsu: { power: "Exam Brain", unlock: "Results day" },
  mubarak: { power: "Plug Deals", unlock: "Open the Plug Store" },
  nusaiba: { power: "Campaign Mode", unlock: "Elections week" },
  zainab: { power: "Doctor's Orders", unlock: "Finish Year 1, or code" },
};
const DISPLAY: Record<string, string> = {
  maker: "The Maker", zainab: "Dr. Zainab", okonkwo: "Dr. Okonkwo", khadija: "Dr. Khadija", dr_minus: "Dr. Minus", hauwa: "Nurse Hauwa",
  garba: "Malam Garba", megawatt: "Chief Megawatt", aliyu: "Engr. Aliyu", kabiru: "DJ Kabiru", lawal: "Ranger Lawal", bilkisu: "Sgt. Bilkisu",
  danladi: "Coach Danladi", ngozi: "Coach Ngozi", pastor_sam: "Pastor Sam", ustaz_auwal: "Ustaz Auwal", mrs_adebayo: "Mrs. Adebayo",
  kb: "KB", roomie: "Your roommate", big_baby: "Big Baby", mum: "Mum", dad: "Dad",
};
const title = (k: string) => DISPLAY[k] ?? k.split("_").map((w) => w[0]!.toUpperCase() + w.slice(1)).join(" ");

async function seedCharacters(repos: Repos) {
  const barksDir = resolve(REPO_ROOT, "docs/voice/barks");
  const indexFile = resolve(REPO_ROOT, "docs/voice/scripts/INDEX.md");
  const counts = new Map<string, number>();
  if (existsSync(indexFile)) {
    for (const m of readFileSync(indexFile, "utf8").matchAll(/^\| `([a-z_]+)\.md` \| [^|]+ \| [^|]+ \| [^|]+ \| (\d+) \|/gm)) counts.set(m[1]!, Number(m[2]));
  }
  let added = 0;
  let sort = 0;
  const files = existsSync(barksDir) ? readdirSync(barksDir).filter((f) => f.endsWith(".md") && !f.startsWith("public_") && f !== "player.md") : [];
  for (const f of files.sort()) {
    const text = readFileSync(resolve(barksDir, f), "utf8");
    const key = (text.match(/^\*\*Id:\*\* *(\S+)/m) ?? [])[1];
    const voice = (text.match(/^\*\*Voice:\*\* *(.+)$/m) ?? [])[1] ?? "";
    if (!key || (await repos.characters.getByKey(key))) continue;
    const stem = key.replace(/^(npc|special)\./, "");
    const special = key.startsWith("special.") ? SPECIAL[stem] : undefined;
    const playable = PLAYABLE[stem];
    await repos.characters.upsertByKey({
      key,
      name: special?.name ?? title(stem),
      kind: special ? "special" : (KIND[stem] ?? "recurring"),
      role: ROLE[stem] ?? "",
      bio: voice,
      voice,
      power: special?.power ?? playable?.power ?? "",
      unlock: special?.unlock ?? playable?.unlock ?? "",
      playable: Boolean(special || playable),
      lockedByDefault: Boolean(special),
      // The owner reports that Jiya, Taty and Madison approved (15 Nov 2026); signed forms are kept offline.
      approved: Boolean(special),
      enabled: true,
      lineCount: counts.get(f.replace(/\.md$/, "")) ?? 0,
      sort: (special ? 50 : KIND[stem] === "lead" ? 0 : KIND[stem] === "mystery" ? 20 : 100) + sort++,
    });
    added++;
  }
  console.log(`  characters: ${added} added`);
}

/* ------------------------------------------------- news, events, deals */

const POSTS = [
  {
    slug: "welcome-to-mib-hub",
    kind: "news" as const,
    title: "Welcome to MIB-Hub",
    excerpt: "One home for every game we make: quick arcade rounds, puzzles, and a whole university to explore.",
    body: `MIB-Hub is the new home of our games. Everything from the old arcade is moving here, rebuilt for speed and for phones.\n\n**What is here today**\n- The full games catalogue, with leaderboards as each game arrives\n- Your account, with progress that follows you between devices\n- News, events and a help centre that a real person answers\n\n**What is coming**\nThe arcade games, one by one, and then the flagship: an open-world university you can live in for five years.\n\nThank you for being early. Tell us what you think from the Support page.`,
    tags: ["announcement"],
    pinned: true,
    daysAgo: 0,
  },
  {
    slug: "the-story-is-written",
    kind: "devlog" as const,
    title: "The story is written: 120 missions, five years",
    excerpt: "Every mission of the open-world game is scripted, checked and cross-referenced. Here is what that means.",
    body: `The open-world game now has its whole story on paper: **120 main missions** across five university years, with cutscenes for every one.\n\nThis week we ran a full continuity audit. A checking tool now reads every mission and flags anything out of place: a date in the wrong order, a line too long for subtitles, a clue in the wrong year. It found nothing left to fix.\n\nNo spoilers. Just this: the clock has been stopped at 6:06 for forty years, and somebody slips a note under one fresher's door every year.`,
    tags: ["open-world", "story"],
    gameSlug: "samaru-days",
    daysAgo: 1,
  },
  {
    slug: "casting-call-voices",
    kind: "update" as const,
    title: "Casting call: 57 voices wanted",
    excerpt: "Over 7,000 lines across 57 voice scripts. If you would like to voice a character, we would love to hear from you.",
    body: `The voice scripts are ready: every character has their own, with story lines, everyday chatter and replies for every year of the game.\n\n**How it works**\n1. Pick a character from the casting list.\n2. You get a PDF with your lines, a recording guide and a short volunteer agreement.\n3. Record at home on your phone, in a quiet room, and send the files back.\n\nVoicing is voluntary and unpaid. Everyone is credited by the name they choose. Contact us from the Support page and choose "Help".`,
    tags: ["voice", "community"],
    daysAgo: 2,
  },
  {
    slug: "arcade-port-roadmap",
    kind: "devlog" as const,
    title: "The arcade is moving: the roadmap",
    excerpt: "Sixteen games, one at a time, rebuilt for the new site. Momentum Cup goes first.",
    body: `Every arcade game from the old site is coming across, with your codes, secrets and settings intact.\n\n- **First:** Momentum Cup, the head-football favourite\n- **Then:** the versus games (Impulse Arena, Wavefront)\n- **Then:** the puzzles and the open-world sandboxes\n\nEach game gets real leaderboards, likes, and level statistics, so we can see which levels are too hard and fix them.`,
    tags: ["arcade", "roadmap"],
    daysAgo: 3,
  },
  {
    slug: "plug-store-preview",
    kind: "promo" as const,
    title: "A first look at the Plug Store",
    excerpt: "Turbo Sneakers, Zobo Max and the rare Time-Freeze Watch: timed boosts for the open-world game.",
    body: `In the open-world game, Mubarak's Plug Store sells **timed boosts** that work like cheats for a while, then run out.\n\nBoosts cost in-game money only, and nothing in the story can ever be bought. Friends will even give you one before a hard mission.\n\nSee the full catalogue on the Store page.`,
    tags: ["store", "open-world"],
    gameSlug: "samaru-days",
    daysAgo: 4,
  },
];

const EVENTS = [
  { slug: "momentum-cup-launch-tournament", kind: "tournament" as const, title: "Momentum Cup launch tournament", summary: "The first leaderboard race on MIB-Hub. Top three on the board win a supporter badge.", location: "Online", gameSlug: "momentum-cup", start: 14, end: 21, prize: "Supporter badge for the top three" },
  { slug: "voice-recording-week", kind: "community" as const, title: "Voice recording week", summary: "Record your character's lines with a little help: a daily check-in and a quick review of your first takes.", location: "Online", start: 7, end: 14, prize: "Your name in the credits" },
  { slug: "open-world-first-look", kind: "live" as const, title: "Open-world first look", summary: "A live walk through the first ten minutes of the campus, with the team.", location: "Online stream", gameSlug: "samaru-days", start: 45, end: 45.1, prize: "" },
  { slug: "black-friday-at-the-plug", kind: "season" as const, title: "Black Friday at the Plug", summary: "Half-price boosts for one day, in game and on the site.", location: "In game", gameSlug: "samaru-days", start: 10, end: 11, prize: "50% off boosts" },
];

const PRODUCTS = [
  ["boost.turbo-sneakers", "Turbo Sneakers", "+35% run speed.", 80000, 10],
  ["boost.zobo-max", "Zobo Max", "Infinite stamina.", 60000, 10],
  ["boost.iron-lungs-gum", "Iron Lungs Gum", "Breath ×3 underwater.", 30000, 0],
  ["boost.ghost-hoodie", "Ghost Hoodie", "Security ignores you.", 150000, 10],
  ["boost.lawyers-card", "Lawyer's Card", "Your next fine or arrest is cancelled.", 250000, 0],
  ["boost.brain-booster-tea", "Brain Booster Tea", "Hints in tests and puzzles.", 70000, 60],
  ["boost.charm-spray", "Charm Spray", "+Charm in conversations.", 100000, 30],
  ["boost.bike-nitro", "Bike Nitro", "Bike and okada sprint never tires.", 90000, 10],
  ["boost.lucky-kola", "Lucky Kola", "Better finds for an hour.", 150000, 60],
  ["boost.full-tank", "Full Tank", "Vehicle fuel and repair.", 50000, 0],
  ["boost.time-freeze-watch", "Time-Freeze Watch", "Mission timers pause. Rare.", 600000, 2],
] as const;

async function seedContentRows(repos: Repos) {
  let n = 0;
  for (const p of POSTS) {
    if (await repos.posts.getBySlug(p.slug)) continue;
    const { daysAgo, ...rest } = p;
    await repos.posts.upsertBySlug({ ...rest, status: "published", publishedAt: new Date(now - daysAgo * DAY - 3600_000) });
    n++;
  }
  console.log(`  posts: ${n} added`);

  n = 0;
  for (const e of EVENTS) {
    if (await repos.events.getBySlug(e.slug)) continue;
    const { start, end, ...rest } = e;
    await repos.events.upsertBySlug({ ...rest, status: "published", startsAt: days(start), endsAt: days(end) });
    n++;
  }
  console.log(`  events: ${n} added`);

  if (!(await repos.deals.listAll()).length) {
    await repos.deals.create({ title: "Founding supporter", description: "Back MIB-Hub early and get a founder badge, your name on the Community page, and our thanks forever.", kind: "bundle", ctaLabel: "Become a supporter", ctaUrl: "/store#support", sort: 0 });
    await repos.deals.create({ title: "Half-price boosts at the Plug", description: "Every boost at half price for one day when the open-world game launches.", kind: "boost", percentOff: 50, code: "PLUG50", gameSlug: "samaru-days", ctaLabel: "See boosts", ctaUrl: "/store", startsAt: days(10), endsAt: days(11), sort: 1 });
    await repos.deals.create({ title: "Free Zobo Max", description: "A free stamina boost before your first hard mission. On the house, from Bolaji.", kind: "free", gameSlug: "samaru-days", ctaLabel: "How to claim", ctaUrl: "/news/plug-store-preview", sort: 2 });
    console.log("  deals: 3 added");
  }

  if (!(await repos.ads.listAll()).length) {
    await repos.ads.create({ placement: "home_hero", title: "Momentum Cup is coming home", body: "Big-headed scientists. Seven arenas. One cup.", linkUrl: "/games/momentum-cup", ctaLabel: "See the game", weight: 3 });
    await repos.ads.create({ placement: "home_strip", title: "Voice a character", body: "57 voices wanted for the open-world game.", linkUrl: "/news/casting-call-voices", ctaLabel: "Read the casting call", weight: 2 });
    await repos.ads.create({ placement: "arcade_top", title: "Launch tournament", body: "Climb the Momentum Cup board in its first week.", linkUrl: "/events/momentum-cup-launch-tournament", ctaLabel: "Event details" });
    await repos.ads.create({ placement: "game_side", title: "Become a founding supporter", body: "Your name on the Community page.", linkUrl: "/store#support", ctaLabel: "Support MIB-Hub" });
    console.log("  ads: 4 house promos added");
  }

  n = 0;
  for (const [i, [sku, t, desc, price, minutes]] of PRODUCTS.entries()) {
    if (await repos.products.getBySku(sku)) continue;
    // Boosts are priced in IN-GAME naira (currency "GAME"): no real money at launch (GAME_DESIGN_V1 §7.3).
    await repos.products.upsertBySku({ sku, kind: "boost", title: t, description: desc, priceKobo: price, currency: "GAME", gameSlug: "samaru-days", durationMin: minutes, sort: i });
    n++;
  }
  const support = [
    ["support.coffee", "Buy the team a coffee", "A small thank-you that keeps the lights on.", 100000],
    ["support.founder", "Founding supporter", "A founder badge, your name on the Community page, and early news.", 500000],
    ["support.patron", "Patron", "Everything above, plus a mention in the game's credits.", 2000000],
  ] as const;
  for (const [i, [sku, t, desc, price]] of support.entries()) {
    if (await repos.products.getBySku(sku)) continue;
    await repos.products.upsertBySku({ sku, kind: "supporter", title: t, description: desc, priceKobo: price, currency: "NGN", sort: 100 + i });
    n++;
  }
  console.log(`  products: ${n} added (boosts in in-game naira; supporter tiers in NGN, payments off until a provider is set)`);
}

/* ---------------------------------------- credits, history, FAQ, switches */

async function seedCommunity(repos: Repos) {
  const people = [
    { name: "Muhammad Iliyasu Bugaje", group: "founder" as const, title: "Founder and creator", bio: "Designs, writes and builds the games. Three letters at the top of every high-score table.", since: "2026", consent: true, sort: 0 },
    { name: "Jiya", group: "voice" as const, title: "Voice and character: Jiya", bio: "Lawyer turned software engineer, and unbeatable at chess.", consent: true, sort: 10 },
    { name: "Taty", group: "voice" as const, title: "Voice and character: Taty", bio: "Never tired, usually winning, always with a cat.", consent: true, sort: 11 },
    { name: "Madison", group: "voice" as const, title: "Voice and character: Madison", bio: "Fast talk, faster feet; everything is content.", consent: true, sort: 12 },
    { name: "Zainab", group: "voice" as const, title: "Voice and character: Dr. Zainab", bio: "A doctor, a cat person, and the sharpest kind person you will meet.", consent: true, sort: 13 },
  ];
  let n = 0;
  for (const p of people) {
    if (await repos.people.findByName(p.name, p.group)) continue;
    await repos.people.create(p);
    n++;
  }
  console.log(`  people: ${n} added (no photos; the owner uploads them with consent)`);

  const timeline = [
    { dateLabel: "Before 2026", date: new Date("2025-06-01"), title: "A learning arcade", body: "It started as an arcade of small physics and engineering games for students, inside a school portal." },
    { dateLabel: "Nov 2026", date: new Date("2026-11-05"), title: "The arcade grows up", body: "Momentum Cup, Impulse Arena and the rest became proper games: music, juice, settings and leaderboards." },
    { dateLabel: "Nov 2026", date: new Date("2026-11-11"), title: "The open-world game gets its name", body: "The campus adventure became a full 3D world, with a story to match." },
    { dateLabel: "Nov 2026", date: new Date("2026-11-13"), title: "The first trailer", body: "A music-only trailer, so the creator could record the voice-over himself." },
    { dateLabel: "15 Nov 2026", date: new Date("2026-11-15"), title: "MIB-Hub is born", body: "The games moved to their own home: one site, many games, and a community around them." },
  ];
  n = 0;
  for (const h of timeline) {
    if (await repos.history.findByTitle(h.title)) continue;
    await repos.history.create(h);
    n++;
  }
  console.log(`  history: ${n} added`);

  const faqs: [string, string, string][] = [
    ["Getting started", "Do I need an account to play?", "No. Every game can be played as a guest. An account keeps your progress and scores across devices and puts you on the leaderboards."],
    ["Getting started", "Is MIB-Hub free?", "Yes. All games are free to play. Supporter tiers are optional and only say thank you; they never unlock story or make you stronger in competitive modes."],
    ["Getting started", "Which devices work?", "Any modern browser on a laptop, desktop, tablet or phone. Some games are best with a keyboard; each game's page says which controls it supports."],
    ["Getting started", "How do I install it like an app?", "On a phone, open the site and choose \"Add to Home Screen\" from your browser's menu."],
    ["Accounts", "I forgot my password.", "Choose \"Forgot password\" on the sign-in page. We send you a link to set a new one."],
    ["Accounts", "Can I change my display name?", "Yes, from your profile. The name on leaderboards changes everywhere at once."],
    ["Accounts", "How do I delete my account?", "Open a ticket on the Support page and choose \"Account\". We delete it, with your scores, within seven days."],
    ["Games", "My progress disappeared.", "Progress saves on your device first and then to your account when you are signed in. Sign in on the same browser and it comes back. If it does not, open a ticket and tell us the game."],
    ["Games", "A game is too hard.", "Tell us which level from the game's page or the Support page. We watch which levels people get stuck on and adjust them."],
    ["Games", "Do cheat codes work on leaderboards?", "Cheats are allowed for fun, but runs that used them are marked and do not count on the public boards."],
    ["Games", "When does the open-world game come out?", "It is in production now. Follow the News page for development updates, trailers and the first playable slice."],
    ["Store and supporters", "What is the Plug Store?", "The shop inside the open-world game. It sells timed boosts for in-game money. Nothing in the story can ever be bought."],
    ["Store and supporters", "How do supporter payments work?", "Supporter tiers are optional and paid in naira. Online payment opens soon; until then you can register your interest and we will contact you."],
    ["Store and supporters", "Can I get a refund?", "Yes, within 14 days for any supporter payment. Open a ticket with your order reference."],
    ["Community", "How can I voice a character?", "Read the casting call on the News page, then contact us from Support. You get a script PDF with a recording guide and a short volunteer agreement."],
    ["Community", "How do I report a player or a problem?", "Use the Support page and choose \"Complaint\". We read every report and reply by email."],
    ["Privacy", "What do you track?", "When you play, we record which game and level you played, how long, and whether you finished. It helps us fix hard levels. We never sell data and never track you on other sites."],
    ["Privacy", "Are real people in the games?", "Some characters are inspired by real friends who agreed to it, and who can withdraw at any time."],
  ];
  n = 0;
  for (const [i, [category, question, answer]] of faqs.entries()) {
    if (await repos.faqs.findByQuestion(question)) continue;
    await repos.faqs.create({ category, question, answer, sort: i });
    n++;
  }
  console.log(`  faqs: ${n} added`);

  const switches: Record<string, unknown> = {
    "switch.registration": true,
    "switch.guestPlay": true,
    "switch.tickets": true,
    "switch.store": true,
    "switch.payments": false,
    "switch.ads": true,
    "switch.leaderboards": true,
    "switch.likes": true,
    "switch.tracking": true,
    "switch.special.jiya": true,
    "switch.special.taty": true,
    "switch.special.madison": true,
    "switch.special.zainab": true,
    "brand.accent": "#0071e3",
    "brand.announcement": "",
    "payments.provider": "manual",
    "social.links": {},
  };
  const current = await repos.siteSettings.all();
  n = 0;
  for (const [key, value] of Object.entries(switches)) {
    if (!(key in current)) {
      await repos.siteSettings.set(key, value);
      n++;
    }
  }
  console.log(`  switches and settings: ${n} added`);
}

/* ------------------------------------------------- Work in Progress */

/** The new open-world game's first playable slice (added once; admin edits are kept). */
async function seedWorkInProgress(repos: Repos) {
  if (await repos.games.getBySlug("work-in-progress")) return console.log("  work in progress: already there");
  await repos.games.upsert({
    slug: "work-in-progress",
    title: "Work in Progress",
    description: "An early look at the new campus game: walk a living university town with roads, shops, a market, traffic, crowds, birds and a full day and night. Missions come next.",
    category: "open-world",
    level: 0,
    accent: "#e8742c",
    status: "live",
    enabled: true,
    entry: "work-in-progress",
    sort: 59,
    assetsPath: "/play-files/work-in-progress/",
    meta: {
      genre: "3D open world (early build)",
      howToPlay: "Choose your look, watch the arrival at the campus gate (or skip it), then explore: the campus quad, the clock that stopped at 6:06, the shops, the market and the roads. Press C for the showcase camera and T to speed up time.",
      controls: "WASD or arrows move · Shift run · drag to look · wheel zoom · C showcase · T time speed · N day/night · M sound · Esc skip film",
      modes: ["Free roam", "Showcase camera"],
      tags: ["open", "new"],
      sessionLength: "As long as you like",
    },
  });
  console.log("  work in progress: added");
}

export async function seedContent(repos: Repos) {
  await seedWorkInProgress(repos);
  await seedCheatsAndHeroes(repos);
  await seedCharacters(repos);
  await seedContentRows(repos);
  await seedCommunity(repos);
}
