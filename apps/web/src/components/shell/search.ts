/**
 * Site search: one pure function that ranks games, news, events, characters
 * and help answers against what the visitor typed. No database code here, so
 * it is easy to test (apps/web/test/search.test.ts). The /search page loads
 * the rows through repos and passes them in.
 */

export type SearchKind = "game" | "post" | "event" | "character" | "faq";

/** One thing that can be found. */
export interface SearchDoc {
  kind: SearchKind;
  /** Where the result links to. */
  href: string;
  title: string;
  /** One line shown under the title. */
  summary: string;
  /** Extra words that should match but are not shown (tags, genre, category). */
  keywords?: string;
  /** Long text that matches weakly (article body, full answer). */
  body?: string;
  /** Icon name from Icon.astro, or an image path that starts with "/". */
  icon: string;
  /** Small label on the right ("Arcade", "Devlog", "3 Dec"). */
  tag?: string;
}

export interface SearchHit extends SearchDoc {
  score: number;
}

export interface SearchGroup {
  kind: SearchKind;
  label: string;
  hits: SearchHit[];
  /** How many matched before the per-group limit was applied. */
  total: number;
}

export const SEARCH_GROUPS: { kind: SearchKind; label: string }[] = [
  { kind: "game", label: "Games" },
  { kind: "post", label: "News" },
  { kind: "event", label: "Events" },
  { kind: "character", label: "Characters" },
  { kind: "faq", label: "Help" },
];

/** Lower-case, strip accents and punctuation: "Zobo-Max!" -> "zobo max". */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The words of a query (at most 6, each at least 1 character). */
export function queryTerms(query: string): string[] {
  return normalise(query).split(" ").filter(Boolean).slice(0, 6);
}

function scoreTerm(term: string, title: string, keywords: string, body: string): number {
  if (title === term) return 120;
  if (title.startsWith(term)) return 100;
  if (title.split(" ").some((w) => w.startsWith(term))) return 70;
  if (title.includes(term)) return 45;
  if (keywords.split(" ").some((w) => w.startsWith(term))) return 24;
  if (keywords.includes(term)) return 14;
  if (body.split(" ").some((w) => w.startsWith(term))) return 8;
  return 0;
}

/** Score one document. 0 means "not a match" (every word must match somewhere). */
export function scoreDoc(doc: SearchDoc, terms: string[]): number {
  if (terms.length === 0) return 0;
  const title = normalise(doc.title);
  const keywords = normalise(`${doc.keywords ?? ""} ${doc.tag ?? ""}`);
  const body = normalise(`${doc.summary} ${doc.body ?? ""}`);
  let total = 0;
  for (const term of terms) {
    const s = scoreTerm(term, title, keywords, body);
    if (s === 0) return 0;
    total += s;
  }
  // The whole phrase in the title is the best match of all.
  if (terms.length > 1 && title.includes(terms.join(" "))) total += 60;
  return total;
}

/** Rank `docs` against `query` and return them grouped, best first. */
export function searchDocs(docs: SearchDoc[], query: string, perGroup = 6): SearchGroup[] {
  const terms = queryTerms(query);
  if (terms.length === 0 || terms.join("").length < 2) return [];
  const groups: SearchGroup[] = [];
  for (const { kind, label } of SEARCH_GROUPS) {
    const hits = docs
      .filter((d) => d.kind === kind)
      .map((d) => ({ ...d, score: scoreDoc(d, terms) }))
      .filter((d) => d.score > 0)
      .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
    if (hits.length) groups.push({ kind, label, hits: hits.slice(0, perGroup), total: hits.length });
  }
  // Put the group with the single best hit first.
  return groups.sort((a, b) => (b.hits[0]?.score ?? 0) - (a.hits[0]?.score ?? 0));
}

export function countHits(groups: SearchGroup[]): number {
  return groups.reduce((n, g) => n + g.total, 0);
}

/**
 * Split `text` into plain and matching parts so the page can wrap matches
 * in <mark>. Matching ignores case; only word starts are highlighted.
 */
export function highlight(text: string, query: string): { text: string; hit: boolean }[] {
  const terms = queryTerms(query).filter((t) => t.length > 1);
  if (terms.length === 0) return [{ text, hit: false }];
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`\\b(${escaped.join("|")})`, "gi");
  const parts: { text: string; hit: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) parts.push({ text: text.slice(last, at), hit: false });
    parts.push({ text: m[0], hit: true });
    last = at + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), hit: false });
  return parts;
}
