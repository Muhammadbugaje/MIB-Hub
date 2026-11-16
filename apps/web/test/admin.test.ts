/**
 * Tests for the admin panel's pure helpers: sample analytics, the Markdown
 * renderer used in previews, and the section list.
 */
import { describe, expect, it } from "vitest";
import { buildDemoData, seededRandom } from "../src/lib/admin-demo.ts";
import { renderMarkdown } from "../src/components/admin/markdown.ts";
import { ADMIN_SECTIONS, visibleGroups } from "../src/lib/admin-sections.ts";
import { effectivePermissions, isPermission } from "../src/lib/permissions.ts";

describe("buildDemoData", () => {
  const now = new Date("2026-11-16T12:00:00Z");
  const data = buildDemoData([{ slug: "a" }, { slug: "b", weight: 0.3 }], { days: 10, now, rand: seededRandom(7) });

  it("marks every row as demo and stays inside the window", () => {
    expect(data.events.length).toBeGreaterThan(50);
    expect(data.events.every((e) => e.demo)).toBe(true);
    expect(data.likes.every((l) => l.demo && l.voter.startsWith("guest:"))).toBe(true);
    const oldest = Math.min(...data.events.map((e) => e.createdAt.getTime()));
    expect(now.getTime() - oldest).toBeLessThan(11 * 86_400_000);
  });

  it("gives every session a start and an end, and every level try a result", () => {
    const starts = data.events.filter((e) => e.kind === "start").length;
    expect(data.events.filter((e) => e.kind === "end").length).toBe(starts);
    const tries = data.events.filter((e) => e.kind === "level_start").length;
    const results = data.events.filter((e) => e.kind === "level_complete" || e.kind === "level_fail").length;
    expect(results).toBe(tries);
  });

  it("is repeatable with the same seed and plays the popular game more", () => {
    const again = buildDemoData([{ slug: "a" }, { slug: "b", weight: 0.3 }], { days: 10, now, rand: seededRandom(7) });
    expect(again.events.length).toBe(data.events.length);
    const plays = (s: string) => data.events.filter((e) => e.kind === "start" && e.gameSlug === s).length;
    expect(plays("a")).toBeGreaterThan(plays("b"));
  });

  it("never repeats a like for the same voter and level", () => {
    const keys = data.likes.map((l) => `${l.gameSlug}|${l.level}|${l.voter}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("renderMarkdown", () => {
  it("renders headings, emphasis, lists and links", () => {
    const html = renderMarkdown("# Hi\n\n**bold** and *it*\n\n- one\n- two\n\n[site](https://x.test)");
    expect(html).toContain("<h2>Hi</h2>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>it</em>");
    expect(html).toContain("<ul><li>one</li><li>two</li></ul>");
    expect(html).toContain('<a href="https://x.test"');
  });

  it("escapes HTML and drops unsafe links", () => {
    const html = renderMarkdown('<script>alert(1)</script> [x](javascript:alert(1)) ![i](data:x)');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data:x");
  });
});

describe("admin sections", () => {
  it("uses real permissions and unique keys", () => {
    expect(ADMIN_SECTIONS.every((s) => isPermission(s.permission))).toBe(true);
    expect(new Set(ADMIN_SECTIONS.map((s) => s.key)).size).toBe(ADMIN_SECTIONS.length);
  });

  it("shows players nothing, moderators some and the owner everything", () => {
    expect(visibleGroups(effectivePermissions("player"))).toEqual([]);
    const mod = visibleGroups(effectivePermissions("moderator")).flatMap((g) => g.sections.map((s) => s.key));
    expect(mod).toContain("support");
    expect(mod).not.toContain("settings");
    const owner = visibleGroups(effectivePermissions("owner")).flatMap((g) => g.sections.map((s) => s.key));
    expect(owner.length).toBe(ADMIN_SECTIONS.length);
  });
});
