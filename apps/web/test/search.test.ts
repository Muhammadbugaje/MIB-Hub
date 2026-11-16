import { describe, expect, it } from "vitest";
import { countHits, highlight, normalise, queryTerms, scoreDoc, searchDocs, type SearchDoc } from "../src/components/shell/search.ts";

const docs: SearchDoc[] = [
  { kind: "game", href: "/games/momentum-cup", title: "Momentum Cup", summary: "Head-football in seven arenas.", keywords: "versus physics", icon: "x" },
  { kind: "game", href: "/games/light-bender", title: "Light Bender", summary: "45 laser puzzles.", keywords: "puzzle optics", icon: "x" },
  { kind: "post", href: "/news/cup", title: "The cup tournament opens", summary: "Climb the board.", body: "Momentum Cup week one.", icon: "x" },
  { kind: "faq", href: "/support", title: "Do I need an account to play?", summary: "No. Every game can be played as a guest.", keywords: "Getting started", icon: "x" },
];

describe("search", () => {
  it("normalises case, accents and punctuation", () => {
    expect(normalise("Zobo-Max!  Café")).toBe("zobo max cafe");
    expect(queryTerms("  The   CUP ")).toEqual(["the", "cup"]);
  });

  it("returns nothing for an empty or one-letter query", () => {
    expect(searchDocs(docs, "")).toEqual([]);
    expect(searchDocs(docs, "a")).toEqual([]);
  });

  it("ranks a title match above a body match", () => {
    const groups = searchDocs(docs, "momentum");
    expect(groups[0]?.kind).toBe("game");
    expect(groups[0]?.hits[0]?.title).toBe("Momentum Cup");
    expect(groups.find((g) => g.kind === "post")?.hits[0]?.href).toBe("/news/cup");
  });

  it("needs every word to match", () => {
    expect(scoreDoc(docs[0]!, ["momentum", "laser"])).toBe(0);
    expect(scoreDoc(docs[0]!, ["momentum", "cup"])).toBeGreaterThan(scoreDoc(docs[0]!, ["momentum"]));
  });

  it("matches keywords and counts every hit", () => {
    const groups = searchDocs(docs, "puzzle");
    expect(groups).toHaveLength(1);
    expect(groups[0]?.hits[0]?.title).toBe("Light Bender");
    expect(countHits(searchDocs(docs, "cup"))).toBe(2);
  });

  it("limits each group but reports the full total", () => {
    const many: SearchDoc[] = Array.from({ length: 9 }, (_, i) => ({ kind: "game", href: `/g/${i}`, title: `Cup ${i}`, summary: "", icon: "x" }));
    const [group] = searchDocs(many, "cup", 3);
    expect(group?.hits).toHaveLength(3);
    expect(group?.total).toBe(9);
  });

  it("marks matching word starts for highlighting", () => {
    expect(highlight("Momentum Cup", "cup")).toEqual([
      { text: "Momentum ", hit: false },
      { text: "Cup", hit: true },
    ]);
    expect(highlight("Plain", "")).toEqual([{ text: "Plain", hit: false }]);
  });
});
