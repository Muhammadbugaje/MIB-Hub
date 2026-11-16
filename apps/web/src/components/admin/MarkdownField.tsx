/**
 * Markdown editor with Write / Preview tabs, a small toolbar and a word
 * count (React island). It submits as a normal <textarea name=…>.
 */
import { useId, useRef, useState } from "react";
import { renderMarkdown } from "./markdown.ts";

interface Props {
  name: string;
  label: string;
  value?: string;
  hint?: string | undefined;
  error?: string | undefined;
  rows?: number;
  required?: boolean | undefined;
}

type Tool = { label: string; title: string; before: string; after?: string; line?: boolean };
const TOOLS: Tool[] = [
  { label: "H", title: "Heading", before: "## ", line: true },
  { label: "B", title: "Bold", before: "**", after: "**" },
  { label: "I", title: "Italic", before: "*", after: "*" },
  { label: "•", title: "Bulleted list", before: "- ", line: true },
  { label: "1.", title: "Numbered list", before: "1. ", line: true },
  { label: "❝", title: "Quote", before: "> ", line: true },
  { label: "</>", title: "Code", before: "`", after: "`" },
  { label: "Link", title: "Link", before: "[", after: "](https://)" },
];

export default function MarkdownField({ name, label, value = "", hint, error, rows = 14, required }: Props) {
  const id = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState(value);
  const [tab, setTab] = useState<"write" | "preview">("write");

  function apply(t: Tool) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = text.slice(s, e);
    let next: string;
    let caret: number;
    if (t.line) {
      const lineStart = text.lastIndexOf("\n", s - 1) + 1;
      next = text.slice(0, lineStart) + t.before + text.slice(lineStart);
      caret = e + t.before.length;
    } else {
      next = text.slice(0, s) + t.before + sel + (t.after ?? "") + text.slice(e);
      caret = s + t.before.length + sel.length;
    }
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return (
    <div className="hub-md">
      <div className="hub-md__head">
        <label className="hub-field__label" htmlFor={`${id}-ta`}>
          {label}
          {required && <span className="hub-req" aria-hidden="true">*</span>}
        </label>
        <div className="hub-seg" role="tablist" aria-label={`${label} mode`}>
          <button type="button" role="tab" aria-selected={tab === "write"} onClick={() => setTab("write")}>
            Write
          </button>
          <button type="button" role="tab" aria-selected={tab === "preview"} onClick={() => setTab("preview")}>
            Preview
          </button>
        </div>
      </div>
      <div className="hub-md__box">
        {tab === "write" && (
          <div className="hub-md__tools" role="toolbar" aria-label="Formatting">
            {TOOLS.map((t) => (
              <button key={t.title} type="button" title={t.title} aria-label={t.title} onClick={() => apply(t)}>
                {t.label}
              </button>
            ))}
          </div>
        )}
        <textarea
          ref={ref}
          id={`${id}-ta`}
          name={name}
          className="hub-md__ta"
          rows={rows}
          value={text}
          required={required && tab === "write"}
          hidden={tab !== "write"}
          onChange={(e) => setText(e.currentTarget.value)}
          aria-invalid={error ? true : undefined}
        />
        {tab === "preview" && (
          <div className="hub-prose hub-md__preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(text) || "<p class='hub-muted'>Nothing to preview yet.</p>" }} />
        )}
      </div>
      <p className="hub-field__hint">
        {hint ? `${hint} · ` : ""}
        {words} {words === 1 ? "word" : "words"} · Markdown: **bold**, *italic*, ## heading, - list, [link](https://…)
      </p>
      {error && <p className="hub-field__error">{error}</p>}
    </div>
  );
}
