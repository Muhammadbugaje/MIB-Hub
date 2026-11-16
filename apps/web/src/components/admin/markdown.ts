/**
 * A small, safe Markdown-to-HTML renderer for previews in the admin panel.
 * Supports: # headings, paragraphs, **bold**, *italic*, `code`, ``` blocks,
 * [links](https://…), - and 1. lists, > quotes, --- rules, ![images](…).
 * Everything is HTML-escaped first, and links allow only http(s), mailto and
 * site-relative URLs, so a post can never inject a script.
 */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function safeUrl(u: string): string | null {
  const url = u.trim();
  return /^(https?:\/\/|mailto:|\/(?!\/))/i.test(url) ? url : null;
}

function inline(text: string): string {
  let s = esc(text);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt: string, src: string) => {
    const u = safeUrl(src.replace(/&amp;/g, "&"));
    return u ? `<img src="${esc(u)}" alt="${alt}" loading="lazy" />` : alt;
  });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => {
    const u = safeUrl(href.replace(/&amp;/g, "&"));
    return u ? `<a href="${esc(u)}" rel="noopener noreferrer">${label}</a>` : label;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  s = s.replace(/(^|\W)_([^_\s][^_]*)_(?=\W|$)/g, "$1<em>$2</em>");
  return s;
}

export function renderMarkdown(src: string): string {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let para: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  let quote: string[] = [];
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.type}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.type}>`);
    list = null;
  };
  const flushQuote = () => {
    if (quote.length) out.push(`<blockquote>${inline(quote.join(" "))}</blockquote>`);
    quote = [];
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushQuote();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.startsWith("```")) {
      flushAll();
      const code: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? "").startsWith("```")) code.push(lines[i++] ?? "");
      out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      flushAll();
      const level = Math.min(6, (h[1] ?? "#").length + 1); // # -> h2 (the page title is the h1)
      out.push(`<h${level}>${inline(h[2] ?? "")}</h${level}>`);
      continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      flushAll();
      out.push("<hr />");
      continue;
    }
    const ul = /^\s*[-*+]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      flushPara();
      flushQuote();
      const type = ul ? "ul" : "ol";
      if (!list || list.type !== type) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push((ul ?? ol)![1] ?? "");
      continue;
    }
    const q = /^>\s?(.*)$/.exec(line);
    if (q) {
      flushPara();
      flushList();
      quote.push(q[1] ?? "");
      continue;
    }
    if (!line.trim()) {
      flushAll();
      continue;
    }
    flushList();
    flushQuote();
    para.push(line.trim());
  }
  flushAll();
  return out.join("\n");
}
