/**
 * Community, content and analytics tables (Site v2, 15 Nov 2026).
 *
 *   post            news, updates, devlogs, press releases and promos
 *   event           tournaments, launches, community nights (with dates)
 *   deal            discounts, bundles and free boosts shown on the site
 *   ad              house promotion slots (placement + schedule + counters)
 *   person          founders, team, supporters, contributors, voices (credits page)
 *   history         the timeline on the About page
 *   faq             help-centre questions and answers
 *   ticket          feedback, bug reports, complaints and help requests
 *   ticket_message  the conversation on a ticket
 *   character       the open-world game's cast (bios, unlocks, kill switch)
 *   play_event      the play tracker: every start, level result and quit
 *   game_like       a player's like for a game (or one level of it)
 *   product         things that can be bought or claimed (boosts, cosmetics, support)
 *   order           a purchase or donation, with its payment provider reference
 *
 * Images are stored as URLs (a path under /uploads in development, R2 later).
 * Real people's photos are only ever uploaded through the admin panel by the
 * owner, with consent; they are never committed to git.
 */
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { user } from "./auth.ts";
import { bool, id, json, timestamp, timestamps } from "./helpers.ts";

export const POST_KINDS = ["news", "update", "devlog", "press", "promo"] as const;
export const PUBLISH_STATUSES = ["draft", "published", "archived"] as const;

export const post = sqliteTable(
  "post",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    kind: text("kind", { enum: POST_KINDS }).notNull().default("news"),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull().default(""),
    /** Markdown (headings, lists, links, bold/italic). */
    body: text("body").notNull().default(""),
    coverUrl: text("cover_url").notNull().default(""),
    /** Optional game this post is about. */
    gameSlug: text("game_slug"),
    tags: json<string[]>("tags")
      .notNull()
      .$defaultFn(() => []),
    status: text("status", { enum: PUBLISH_STATUSES }).notNull().default("draft"),
    pinned: bool("pinned").notNull().default(false),
    publishedAt: timestamp("published_at"),
    authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
    views: integer("views").notNull().default(0),
    ...timestamps(),
  },
  (t) => [index("post_status_pub_idx").on(t.status, t.publishedAt)],
);

export const EVENT_KINDS = ["tournament", "launch", "community", "live", "season"] as const;

export const event = sqliteTable(
  "event",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    kind: text("kind", { enum: EVENT_KINDS }).notNull().default("community"),
    title: text("title").notNull(),
    summary: text("summary").notNull().default(""),
    body: text("body").notNull().default(""),
    coverUrl: text("cover_url").notNull().default(""),
    location: text("location").notNull().default("Online"),
    gameSlug: text("game_slug"),
    startsAt: timestamp("starts_at").notNull(),
    endsAt: timestamp("ends_at"),
    /** Prize, entry rules, or anything else shown as a short line. */
    prize: text("prize").notNull().default(""),
    status: text("status", { enum: PUBLISH_STATUSES }).notNull().default("draft"),
    ...timestamps(),
  },
  (t) => [index("event_starts_idx").on(t.startsAt)],
);

export const DEAL_KINDS = ["discount", "bundle", "boost", "free", "partner"] as const;

export const deal = sqliteTable("deal", {
  id: id(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  kind: text("kind", { enum: DEAL_KINDS }).notNull().default("discount"),
  /** e.g. 50 for "50% off"; 0 when not a percentage deal. */
  percentOff: integer("percent_off").notNull().default(0),
  /** Optional promo code players type at checkout or in game. */
  code: text("code").notNull().default(""),
  gameSlug: text("game_slug"),
  productSku: text("product_sku"),
  ctaLabel: text("cta_label").notNull().default("Get it"),
  ctaUrl: text("cta_url").notNull().default(""),
  imageUrl: text("image_url").notNull().default(""),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  active: bool("active").notNull().default(true),
  sort: integer("sort").notNull().default(0),
  ...timestamps(),
});

export const AD_PLACEMENTS = ["home_hero", "home_strip", "arcade_top", "game_side", "news_inline"] as const;

export const ad = sqliteTable(
  "ad",
  {
    id: id(),
    placement: text("placement", { enum: AD_PLACEMENTS }).notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    imageUrl: text("image_url").notNull().default(""),
    linkUrl: text("link_url").notNull().default(""),
    ctaLabel: text("cta_label").notNull().default("Learn more"),
    /** "house" = our own promo; "partner" = a sponsor (shown with a "Sponsored" label). */
    source: text("source", { enum: ["house", "partner"] })
      .notNull()
      .default("house"),
    /** Higher weight = shown more often when several ads share a placement. */
    weight: integer("weight").notNull().default(1),
    startsAt: timestamp("starts_at"),
    endsAt: timestamp("ends_at"),
    active: bool("active").notNull().default(true),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    ...timestamps(),
  },
  (t) => [index("ad_placement_idx").on(t.placement, t.active)],
);

export const PERSON_GROUPS = ["founder", "team", "supporter", "contributor", "voice", "tester", "partner"] as const;

export const person = sqliteTable(
  "person",
  {
    id: id(),
    /** First names only for real people unless they ask otherwise (privacy rule). */
    name: text("name").notNull(),
    group: text("group", { enum: PERSON_GROUPS }).notNull().default("contributor"),
    /** e.g. "Founder & creator", "Voice of Jiya", "Gold supporter". */
    title: text("title").notNull().default(""),
    bio: text("bio").notNull().default(""),
    photoUrl: text("photo_url").notNull().default(""),
    /** e.g. { "x": "https://…", "site": "https://…" } */
    links: json<Record<string, string>>("links")
      .notNull()
      .$defaultFn(() => ({})),
    /** Supporter tier label, e.g. "Gold". */
    tier: text("tier").notNull().default(""),
    /** Year or date text shown as "since …". */
    since: text("since").notNull().default(""),
    /** True once the person has agreed to appear (photo and name). */
    consent: bool("consent").notNull().default(false),
    visible: bool("visible").notNull().default(true),
    sort: integer("sort").notNull().default(0),
    ...timestamps(),
  },
  (t) => [index("person_group_idx").on(t.group, t.sort)],
);

export const history = sqliteTable("history", {
  id: id(),
  /** Display date, e.g. "Nov 2026" or "2024". */
  dateLabel: text("date_label").notNull(),
  /** Sort key (any date inside the period). */
  date: timestamp("date").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  imageUrl: text("image_url").notNull().default(""),
  visible: bool("visible").notNull().default(true),
  ...timestamps(),
});

export const faq = sqliteTable("faq", {
  id: id(),
  category: text("category").notNull().default("General"),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  sort: integer("sort").notNull().default(0),
  published: bool("published").notNull().default(true),
  ...timestamps(),
});

export const TICKET_KINDS = ["feedback", "bug", "complaint", "help", "idea", "account", "payment"] as const;
export const TICKET_STATUSES = ["open", "pending", "resolved", "closed"] as const;

export const ticket = sqliteTable(
  "ticket",
  {
    id: id(),
    /** Short public reference, e.g. "MIB-1042". */
    ref: text("ref").notNull().unique(),
    kind: text("kind", { enum: TICKET_KINDS }).notNull().default("help"),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    status: text("status", { enum: TICKET_STATUSES }).notNull().default("open"),
    priority: text("priority", { enum: ["low", "normal", "high", "urgent"] })
      .notNull()
      .default("normal"),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    /** For signed-out visitors. */
    name: text("name").notNull().default(""),
    email: text("email").notNull().default(""),
    gameSlug: text("game_slug"),
    /** Page the visitor was on, and their browser, for bug reports. */
    pageUrl: text("page_url").notNull().default(""),
    userAgent: text("user_agent").notNull().default(""),
    /** 1–5 stars for feedback. */
    rating: integer("rating"),
    assigneeId: text("assignee_id").references(() => user.id, { onDelete: "set null" }),
    ...timestamps(),
  },
  (t) => [index("ticket_status_idx").on(t.status, t.createdAt)],
);

export const ticketMessage = sqliteTable(
  "ticket_message",
  {
    id: id(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => ticket.id, { onDelete: "cascade" }),
    authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
    fromStaff: bool("from_staff").notNull().default(false),
    /** Staff-only note, never shown to the player. */
    internal: bool("internal").notNull().default(false),
    body: text("body").notNull(),
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("ticket_msg_ticket_idx").on(t.ticketId)],
);

export const CHARACTER_KINDS = ["lead", "friend", "recurring", "staff", "family", "special", "mystery", "public"] as const;

export const character = sqliteTable(
  "character",
  {
    id: id(),
    /** Cast id from the scripts, e.g. "npc.jega", "special.jiya". */
    key: text("key").notNull().unique(),
    gameSlug: text("game_slug").notNull().default("samaru-days"),
    name: text("name").notNull(),
    kind: text("kind", { enum: CHARACTER_KINDS }).notNull().default("recurring"),
    /** One-line role, e.g. "The footballer". */
    role: text("role").notNull().default(""),
    bio: text("bio").notNull().default(""),
    /** Voice notes for the actor. */
    voice: text("voice").notNull().default(""),
    catchphrases: json<string[]>("catchphrases")
      .notNull()
      .$defaultFn(() => []),
    /** Power when playable, e.g. "Legal Immunity". */
    power: text("power").notNull().default(""),
    /** How it unlocks, e.g. "Finish Year 1, or code". Empty = not playable. */
    unlock: text("unlock").notNull().default(""),
    playable: bool("playable").notNull().default(false),
    /** Locked at the start of the game (special characters). */
    lockedByDefault: bool("locked_by_default").notNull().default(false),
    /** Kill switch: hides the character everywhere at once. */
    enabled: bool("enabled").notNull().default(true),
    /** The real person has approved their look and lines (special characters). */
    approved: bool("approved").notNull().default(false),
    portraitUrl: text("portrait_url").notNull().default(""),
    /** Number of voice lines (story + barks), from the voice scripts. */
    lineCount: integer("line_count").notNull().default(0),
    sort: integer("sort").notNull().default(0),
    data: json<Record<string, unknown>>("data")
      .notNull()
      .$defaultFn(() => ({})),
    ...timestamps(),
  },
  (t) => [index("character_kind_idx").on(t.kind, t.sort)],
);

export const PLAY_EVENT_KINDS = ["start", "end", "level_start", "level_complete", "level_fail", "quit"] as const;

/**
 * The play tracker. One row per thing that happened. Aggregates (plays per
 * game, hardest levels, trends) are computed from these rows by
 * repos.analytics. Rows marked meta.demo = true are sample data and can be
 * cleared from the admin dashboard.
 */
export const playEvent = sqliteTable(
  "play_event",
  {
    id: id(),
    gameSlug: text("game_slug").notNull(),
    kind: text("kind", { enum: PLAY_EVENT_KINDS }).notNull(),
    /** Level or mission id, e.g. "3" or "M024". Empty for whole-game events. */
    level: text("level").notNull().default(""),
    /** Groups the events of one play session (random id made by the browser). */
    sessionId: text("session_id").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    guestId: text("guest_id"),
    durationMs: integer("duration_ms"),
    score: integer("score"),
    /** "desktop" | "mobile" | "tablet" */
    device: text("device").notNull().default(""),
    demo: bool("demo").notNull().default(false),
    meta: json<Record<string, unknown>>("meta")
      .notNull()
      .$defaultFn(() => ({})),
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    index("play_game_created_idx").on(t.gameSlug, t.createdAt),
    index("play_game_level_idx").on(t.gameSlug, t.level, t.kind),
    index("play_session_idx").on(t.sessionId),
  ],
);

export const gameLike = sqliteTable(
  "game_like",
  {
    id: id(),
    gameSlug: text("game_slug").notNull(),
    level: text("level").notNull().default(""),
    /** A signed-in user's id, or "guest:<id>" for visitors. */
    voter: text("voter").notNull(),
    demo: bool("demo").notNull().default(false),
    createdAt: timestamp("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [uniqueIndex("game_like_uq").on(t.gameSlug, t.level, t.voter)],
);

export const PRODUCT_KINDS = ["boost", "cosmetic", "character", "supporter", "donation"] as const;

export const product = sqliteTable("product", {
  id: id(),
  sku: text("sku").notNull().unique(),
  kind: text("kind", { enum: PRODUCT_KINDS }).notNull().default("boost"),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  /** Price in kobo (₦1 = 100 kobo). 0 = free to claim. */
  priceKobo: integer("price_kobo").notNull().default(0),
  currency: text("currency").notNull().default("NGN"),
  gameSlug: text("game_slug"),
  imageUrl: text("image_url").notNull().default(""),
  /** For boosts: how long it lasts, in minutes of play. */
  durationMin: integer("duration_min").notNull().default(0),
  active: bool("active").notNull().default(true),
  sort: integer("sort").notNull().default(0),
  data: json<Record<string, unknown>>("data")
    .notNull()
    .$defaultFn(() => ({})),
  ...timestamps(),
});

export const ORDER_STATUSES = ["pending", "paid", "failed", "refunded", "cancelled"] as const;

export const order = sqliteTable(
  "order",
  {
    id: id(),
    ref: text("ref").notNull().unique(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    email: text("email").notNull().default(""),
    productSku: text("product_sku").notNull(),
    quantity: integer("quantity").notNull().default(1),
    amountKobo: integer("amount_kobo").notNull(),
    currency: text("currency").notNull().default("NGN"),
    status: text("status", { enum: ORDER_STATUSES }).notNull().default("pending"),
    /** "manual" until a payment provider (e.g. Paystack) is configured. */
    provider: text("provider").notNull().default("manual"),
    providerRef: text("provider_ref").notNull().default(""),
    dealCode: text("deal_code").notNull().default(""),
    note: text("note").notNull().default(""),
    ...timestamps(),
  },
  (t) => [index("order_status_idx").on(t.status, t.createdAt)],
);
