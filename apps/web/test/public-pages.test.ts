import { describe, expect, it } from "vitest";
import { castProfile, charSlug, groupOf, keysForSlug, publicCast } from "../src/components/public/cast.ts";
import {
  boostDuration,
  cleanRef,
  controlList,
  durationLabel,
  eventParts,
  eventState,
  icsFor,
  levelLabel,
  loopSteps,
  postKind,
  readingMinutes,
  untilParts,
} from "../src/components/public/kinds.ts";
import { renderMarkdown } from "../src/components/public/markdown.ts";

describe("public pages: games", () => {
  it("splits a how-to-play line into steps", () => {
    expect(loopSteps("Read the arc, get under it, dash, then fire.")).toEqual(["Read the arc", "Get under it", "Dash", "Fire"]);
    expect(loopSteps("Tune, transmit, beat the noise, decode.")).toEqual(["Tune", "Transmit", "Beat the noise", "Decode"]);
    expect(loopSteps(undefined)).toEqual([]);
  });

  it("turns key-like words into keycaps and leaves plain words alone", () => {
    expect(controlList("A/D move · double-tap dash · Space jump")).toEqual([
      { keys: "A/D", action: "move" },
      { keys: "double-tap", action: "dash" },
      { keys: "Space", action: "jump" },
    ]);
    expect(controlList("Tune gains · Tap to drive")).toEqual([
      { keys: "", action: "Tune gains" },
      { keys: "", action: "Tap to drive" },
    ]);
  });

  it("names levels and missions for people", () => {
    expect(levelLabel("3")).toBe("Level 3");
    expect(levelLabel("M024")).toBe("Mission 24");
    expect(levelLabel("boss_room")).toBe("Boss room");
  });
});

describe("public pages: events", () => {
  const start = new Date("2026-12-01T18:00:00Z");
  const end = new Date("2026-12-01T20:00:00Z");

  it("knows whether an event is upcoming, live or ended", () => {
    expect(eventState({ startsAt: start, endsAt: end }, new Date("2026-12-01T17:00:00Z"))).toBe("upcoming");
    expect(eventState({ startsAt: start, endsAt: end }, new Date("2026-12-01T19:00:00Z"))).toBe("live");
    expect(eventState({ startsAt: start, endsAt: end }, new Date("2026-12-01T21:00:00Z"))).toBe("ended");
    // no end date: it lasts a day
    expect(eventState({ startsAt: start, endsAt: null }, new Date("2026-12-02T10:00:00Z"))).toBe("live");
  });

  it("counts down in days, hours and minutes, never below zero", () => {
    expect(untilParts(start, new Date("2026-11-30T16:30:00Z"))).toEqual({ d: 1, h: 1, m: 30 });
    expect(untilParts(start, new Date("2027-01-01T00:00:00Z"))).toEqual({ d: 0, h: 0, m: 0 });
  });

  it("labels lengths", () => {
    expect(durationLabel(start, end)).toBe("2 h");
    expect(durationLabel(start, new Date(start.getTime() + 7 * 86_400_000))).toBe("7 days");
    expect(durationLabel(start, null)).toBe("");
  });

  it("shows times in West Africa Time", () => {
    const p = eventParts(start); // 18:00 UTC = 19:00 WAT
    expect(p.time).toBe("19:00");
    expect(p.full).toMatch(/19:00 WAT$/);
  });

  it("writes a valid calendar file with escaped text", () => {
    const ics = icsFor({ id: "e1", title: "Cup; final, live", summary: "Bring snacks", location: "Online", startsAt: start, endsAt: end }, "https://x.test/events/cup", "MIB-Hub");
    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("DTSTART:20261201T180000Z");
    expect(ics).toContain("DTEND:20261201T200000Z");
    expect(ics).toContain("SUMMARY:Cup\\; final\\, live");
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    for (const line of ics.split("\r\n")) expect(line.length).toBeLessThanOrEqual(75);
  });
});

describe("public pages: support and store", () => {
  it("accepts only well-formed references", () => {
    expect(cleanRef(" mib-4f2k9 ", "MIB")).toBe("MIB-4F2K9");
    expect(cleanRef("ORD-4F2K9", "MIB")).toBeNull();
    expect(cleanRef("MIB-<script>", "MIB")).toBeNull();
    expect(cleanRef(null, "ORD")).toBeNull();
  });

  it("describes boost durations", () => {
    expect(boostDuration(0)).toBe("Lasts until used");
    expect(boostDuration(10)).toBe("10 min of play");
    expect(boostDuration(60)).toBe("1 h of play");
    expect(boostDuration(90)).toBe("1.5 h of play");
  });

  it("estimates reading time and knows post kinds", () => {
    expect(readingMinutes("word ".repeat(450))).toBe(2);
    expect(readingMinutes("")).toBe(1);
    expect(postKind("promo").label).toBe("Store");
    expect(postKind("nope").label).toBe("News");
  });
});

describe("public pages: the cast", () => {
  it("never prints casting notes", () => {
    const p = castProfile({ key: "npc.jega", role: "The footballer", kind: "lead" });
    expect(p.role).toBe("The footballer");
    // unknown character: falls back to the role column (stage notes stripped), then the group
    expect(castProfile({ key: "npc.new", role: "Your roommate (male player)", kind: "lead" }).role).toBe("Your roommate");
    expect(castProfile({ key: "npc.new", role: "", kind: "staff" }).role).toBe("Staff");
    expect(groupOf("unknown").label).toBe("Everyone else");
  });

  it("makes short URLs that lead back to the key", () => {
    expect(charSlug("npc.mai_shayi")).toBe("mai-shayi");
    expect(keysForSlug("mai-shayi")).toContain("npc.mai_shayi");
    expect(keysForSlug(charSlug("special.jiya"))).toContain("special.jiya");
    expect(keysForSlug("../etc")).toEqual([]);
  });

  it("hides the roommate slot, unapproved specials and switched-off specials", () => {
    const all = [
      { key: "npc.jega", name: "Jega", kind: "lead" as const, approved: false },
      { key: "npc.roomie", name: "Your roommate", kind: "lead" as const, approved: false },
      { key: "special.jiya", name: "Jiya", kind: "special" as const, approved: true },
      { key: "special.taty", name: "Taty", kind: "special" as const, approved: false },
      { key: "npc.zainab", name: "Dr. Zainab", kind: "lead" as const, approved: false },
    ];
    expect(publicCast(all, {}).map((c) => c.key)).toEqual(["npc.jega", "special.jiya", "npc.zainab"]);
    expect(publicCast(all, { jiya: false, zainab: false }).map((c) => c.key)).toEqual(["npc.jega"]);
  });
});

describe("public pages: markdown", () => {
  it("escapes HTML and drops unsafe links", () => {
    const html = renderMarkdown('# Hi\n\n<script>alert(1)</script> [x](javascript:alert(1)) [ok](/games) ![a](data:x)');
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data:x");
    expect(html).toContain('<a href="/games" rel="noopener noreferrer">ok</a>');
    expect(html).toContain("<h2>Hi</h2>");
  });

  it("renders lists, quotes and emphasis", () => {
    const html = renderMarkdown("- one\n- **two**\n\n> said\n\n1. a\n2. *b*");
    expect(html).toContain("<ul><li>one</li><li><strong>two</strong></li></ul>");
    expect(html).toContain("<blockquote>said</blockquote>");
    expect(html).toContain("<ol><li>a</li><li><em>b</em></li></ol>");
  });
});
