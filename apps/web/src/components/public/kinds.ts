/**
 * Small pure helpers for the public pages (games, news, events, support,
 * store, leaderboards). Kept free of Astro and the database so they are
 * easy to test (apps/web/test/public-pages.test.ts).
 */

/* ---- Posts ----------------------------------------------------------------- */

export const POST_KIND: Record<string, { label: string; plural: string; icon: string }> = {
  news: { label: "News", plural: "News", icon: "newspaper" },
  devlog: { label: "Devlog", plural: "Devlogs", icon: "book" },
  update: { label: "Update", plural: "Updates", icon: "megaphone" },
  press: { label: "Press", plural: "Press", icon: "quote" },
  promo: { label: "Store", plural: "Store news", icon: "bag" },
};
export const postKind = (kind: string) => POST_KIND[kind] ?? POST_KIND.news!;

/** Minutes to read a Markdown body (200 words a minute, at least 1). */
export function readingMinutes(markdown: string): number {
  const words = markdown.replace(/[#>*_`[\]()!-]/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/* ---- Events ---------------------------------------------------------------- */

export const EVENT_KIND: Record<string, { label: string; icon: string; tone: string }> = {
  tournament: { label: "Tournament", icon: "trophy", tone: "k-gold" },
  launch: { label: "Launch", icon: "rocket", tone: "k-volt" },
  community: { label: "Community", icon: "heart", tone: "k-green" },
  live: { label: "Live stream", icon: "mic", tone: "k-plum" },
  season: { label: "Season", icon: "gift", tone: "k-gold" },
};
export const eventKind = (kind: string) => EVENT_KIND[kind] ?? EVENT_KIND.community!;

export type EventState = "upcoming" | "live" | "ended";

/** Whether an event is still to come, running now, or over. An event with no end lasts a day. */
export function eventState(e: { startsAt: Date; endsAt: Date | null }, now = new Date()): EventState {
  const end = e.endsAt ?? new Date(e.startsAt.getTime() + 86_400_000);
  if (now < e.startsAt) return "upcoming";
  if (now <= end) return "live";
  return "ended";
}

/** Whole days, hours and minutes until a date (all 0 once it has passed). */
export function untilParts(to: Date, now = new Date()): { d: number; h: number; m: number } {
  const s = Math.max(0, Math.floor((to.getTime() - now.getTime()) / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60) };
}

/** "2 h", "3 days" — how long an event runs. */
export function durationLabel(start: Date, end: Date | null): string {
  if (!end) return "";
  const mins = Math.round((end.getTime() - start.getTime()) / 60000);
  if (mins <= 0) return "";
  if (mins < 60) return `${mins} min`;
  if (mins < 48 * 60) return `${Math.round(mins / 60)} h`;
  return `${Math.round(mins / 1440)} days`;
}

/** An .ics calendar file for one event (RFC 5545, UTC times, lines folded short). */
export function icsFor(
  e: { id: string; title: string; summary: string; location: string; startsAt: Date; endsAt: Date | null },
  url: string,
  siteName: string,
): string {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const text = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const end = e.endsAt ?? new Date(e.startsAt.getTime() + 60 * 60_000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${text(siteName)}//Events//EN`,
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${e.id}@${text(siteName).toLowerCase()}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(e.startsAt)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${text(e.title)}`,
    `DESCRIPTION:${text(`${e.summary}\n${url}`.trim())}`,
    `LOCATION:${text(e.location)}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

function fold(line: string): string {
  if (line.length <= 74) return line;
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 73) parts.push(line.slice(i, i + 73));
  return parts.join("\r\n ");
}

/* ---- Games ----------------------------------------------------------------- */

/** "Read the arc, get under it, dash, then fire." -> ["Read the arc", "Get under it", "Dash", "Fire"] */
export function loopSteps(howToPlay: string | undefined): string[] {
  if (!howToPlay) return [];
  return howToPlay
    .replace(/\.$/, "")
    .split(/,\s*(?:then\s+)?|\s+then\s+/i)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .slice(0, 8);
}

const KEYLIKE = /^(?:[A-Z0-9▲▼◀▶←→↑↓/–+-]{1,7}|Space|Shift|Enter|Esc|Tab|Ctrl|Mouse|mouse|Arrows|double-tap)$/;

/** "A/D move · W jump" -> [{ keys: "A/D", action: "move" }, { keys: "W", action: "jump" }] */
export function controlList(controls: string | undefined): { keys: string; action: string }[] {
  if (!controls) return [];
  return controls
    .split(/\s*·\s*/)
    .map((part) => {
      const text = part.trim();
      const m = /^(\S+)\s+(.+)$/.exec(text);
      // Only a key-like first word becomes a keycap ("A/D", "Space", "1–8"); "Tune gains" stays plain text.
      return m && KEYLIKE.test(m[1]!) ? { keys: m[1]!, action: m[2]! } : { keys: "", action: text };
    })
    .filter((c) => c.action);
}

/** Level ids from the tracker, for people: "3" -> "Level 3", "M024" -> "Mission 24". */
export function levelLabel(level: string): string {
  if (/^\d+$/.test(level)) return `Level ${Number(level)}`;
  const m = /^M0*(\d+)$/i.exec(level);
  if (m) return `Mission ${m[1]}`;
  return level.replace(/[-_]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** "1234" -> "1,234" */
export const fmt = (n: number) => Math.round(n).toLocaleString("en-NG");

/** 0.4567 -> "46%" */
export const pct = (x: number) => `${Math.round(x * 100)}%`;

/* ---- Support and store ----------------------------------------------------- */

export const TICKET_KIND: Record<string, { label: string; icon: string; hint: string }> = {
  help: { label: "Get help", icon: "life-buoy", hint: "Something is not working for you" },
  bug: { label: "Report a bug", icon: "shield-alert", hint: "A game or page is broken" },
  feedback: { label: "Feedback", icon: "star", hint: "Tell us what you think" },
  idea: { label: "An idea", icon: "sparkles", hint: "A game, a feature, a level" },
  account: { label: "My account", icon: "user-circle", hint: "Sign-in, email, deleting it" },
  payment: { label: "A payment", icon: "coins", hint: "A supporter order or a refund" },
  complaint: { label: "A complaint", icon: "megaphone", hint: "Someone or something was not fair" },
};

export const TICKET_STATUS: Record<string, { label: string; tone: string; note: string }> = {
  open: { label: "Received", tone: "k-volt", note: "It is in the queue. A person will read it." },
  pending: { label: "Waiting for you", tone: "k-gold", note: "We replied and need something from you." },
  resolved: { label: "Resolved", tone: "k-green", note: "We think this is sorted. Reply if it is not." },
  closed: { label: "Closed", tone: "k-plum", note: "This conversation is finished." },
};

export const ORDER_STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: "Waiting for confirmation", tone: "k-gold" },
  paid: { label: "Paid, thank you", tone: "k-green" },
  failed: { label: "Did not go through", tone: "k-plum" },
  refunded: { label: "Refunded", tone: "k-volt" },
  cancelled: { label: "Cancelled", tone: "k-plum" },
};

/** Ticket and order references look like "MIB-4F2K9" / "ORD-4F2K9". */
export function cleanRef(raw: string | null | undefined, prefix: "MIB" | "ORD"): string | null {
  const ref = (raw ?? "").trim().toUpperCase();
  return new RegExp(`^${prefix}-[A-Z0-9]{4,10}$`).test(ref) ? ref : null;
}

export const SUPPORT_ERRORS: Record<string, string> = {
  missing: "Please choose what it is about and write a subject (3+ letters) and a message (10+ letters).",
  email: "Please give an email address so we can reply.",
  slow: "That was a lot of messages in a short time. Please wait a few minutes and try again.",
  closed: "We are not taking new messages right now. The answers below may still help.",
};

/** Boost durations: 0 -> "Until used", 10 -> "10 min of play", 60 -> "1 h of play". */
export function boostDuration(minutes: number): string {
  if (!minutes) return "Lasts until used";
  if (minutes < 60) return `${minutes} min of play`;
  const h = minutes / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h of play`;
}

/** Event times are shown in West Africa Time, whatever the server's own zone. */
export const EVENT_TZ = "Africa/Lagos";
export function eventParts(d: Date): { wkd: string; day: string; mon: string; time: string; date: string; full: string } {
  const f = (o: Intl.DateTimeFormatOptions) => d.toLocaleString("en-GB", { timeZone: EVENT_TZ, ...o });
  const time = f({ hour: "2-digit", minute: "2-digit" });
  const date = f({ weekday: "short", day: "numeric", month: "short", year: "numeric" });
  return { wkd: f({ weekday: "short" }), day: f({ day: "numeric" }), mon: f({ month: "short" }).toUpperCase(), time, date, full: `${date}, ${time} WAT` };
}
