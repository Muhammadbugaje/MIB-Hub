/**
 * Helpers for the signed-in pages (account and admin): describing form
 * fields once, reading and checking a posted form against that description,
 * one-time "toast" messages after a redirect, and the audit log.
 *
 * A typical admin page:
 *
 *   const FIELDS: FieldDef[] = [{ name: "title", label: "Title", type: "text", required: true }, ...];
 *   if (Astro.request.method === "POST") {
 *     const form = await Astro.request.formData();
 *     const { values, errors } = await parseFields(FIELDS, form);
 *     if (!hasErrors(errors)) {
 *       const row = await repos.faqs.create(values as NewFaq);
 *       await audit(Astro, "faq.create", "faq", row.id, undefined, row);
 *       return done(Astro, "Question added.", "/admin/faqs");
 *     }
 *   }
 *   ...<FormFields fields={FIELDS} values={values} errors={errors} />
 */
import type { AstroCookies } from "astro";
import { repos } from "./db.ts";
import { saveImage } from "./uploads.ts";

/* ------------------------------------------------------------- fields */

export type FieldType =
  | "text"
  | "textarea"
  | "markdown"
  | "select"
  | "switch"
  | "number"
  | "money"
  | "datetime"
  | "image"
  | "json"
  | "tags"
  | "color"
  | "url"
  | "email"
  | "slug";

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  /** For select: the choices (strings are used as both value and label). */
  options?: ReadonlyArray<string | FieldOption>;
  /** For select: allow "none" (stored as null). */
  allowEmpty?: boolean | string;
  /** For number/money: limits. */
  min?: number;
  max?: number;
  /** For text fields: maximum length (default 200; 20000 for long text). */
  maxLength?: number;
  /** For image: the uploads folder ("people", "covers"...). */
  folder?: string;
  /** For textarea/markdown/json: visible rows. */
  rows?: number;
  /** Take the full width of the form grid. */
  full?: boolean;
  /** For switch: the text beside it. */
  switchLabel?: string;
}

export type FormValues = Record<string, unknown>;
export type FormErrors = Record<string, string>;

export function optionList(def: FieldDef): FieldOption[] {
  return (def.options ?? []).map((o) => (typeof o === "string" ? { value: o, label: labelize(o) } : o));
}

/** "home_hero" -> "Home hero" */
export function labelize(s: string): string {
  const t = s.replace(/[_-]+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Date -> "2026-11-16T09:30" for <input type="datetime-local">. Uses the server's local time. */
export function toLocalInput(d: Date | null | undefined): string {
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseLocalInput(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The value a field shows in its input (dates, tags, JSON and money formatted for editing). */
export function displayValue(def: FieldDef, v: unknown): string {
  if (v === null || v === undefined) return "";
  switch (def.type) {
    case "datetime":
      return v instanceof Date ? toLocalInput(v) : String(v);
    case "tags":
      return Array.isArray(v) ? v.join(", ") : String(v);
    case "json":
      return typeof v === "string" ? v : JSON.stringify(v, null, 2);
    case "money":
      return typeof v === "number" ? String(v / 100) : String(v);
    default:
      return String(v);
  }
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Read a posted form against field definitions. Returns typed values (Date,
 * number, boolean, string[], object, image URL) and a message per bad field.
 * Image fields: "<name>" carries the current URL, "<name>__file" a new file,
 * "<name>__remove" clears it.
 */
export async function parseFields(defs: FieldDef[], form: FormData): Promise<{ values: FormValues; errors: FormErrors }> {
  const values: FormValues = {};
  const errors: FormErrors = {};
  for (const def of defs) {
    const raw = form.get(def.name);
    const text = typeof raw === "string" ? raw.trim() : "";
    const max = def.maxLength ?? (["textarea", "markdown", "json"].includes(def.type) ? 20000 : 200);
    const need = (ok: boolean) => {
      if (!ok && def.required) errors[def.name] = `${def.label} is required.`;
    };
    switch (def.type) {
      case "switch":
        values[def.name] = form.get(def.name) === "on" || form.get(def.name) === "true";
        break;
      case "number":
      case "money": {
        if (text === "") {
          need(false);
          values[def.name] = def.required ? null : 0;
          break;
        }
        const n = Number(text.replace(/,/g, ""));
        if (!Number.isFinite(n)) {
          errors[def.name] = "Enter a number.";
          break;
        }
        if (def.min !== undefined && n < def.min) errors[def.name] = `Use ${def.min} or more.`;
        if (def.max !== undefined && n > def.max) errors[def.name] = `Use ${def.max} or less.`;
        values[def.name] = def.type === "money" ? Math.round(n * 100) : Math.round(n);
        break;
      }
      case "datetime": {
        const d = parseLocalInput(text);
        if (text && !d) errors[def.name] = "Enter a valid date and time.";
        need(!!d);
        values[def.name] = d;
        break;
      }
      case "select": {
        const opts = optionList(def).map((o) => o.value);
        if (text === "" && def.allowEmpty) {
          need(false);
          values[def.name] = null;
        } else if (!opts.includes(text)) {
          errors[def.name] = "Choose one of the options.";
        } else values[def.name] = text;
        break;
      }
      case "tags":
        values[def.name] = text
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 30);
        need((values[def.name] as string[]).length > 0);
        break;
      case "json": {
        if (!text) {
          values[def.name] = {};
          need(false);
          break;
        }
        try {
          const parsed: unknown = JSON.parse(text);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) errors[def.name] = "Use a JSON object, like { \"key\": 1 }.";
          else values[def.name] = parsed;
        } catch (e) {
          errors[def.name] = `That is not valid JSON (${e instanceof Error ? e.message.replace(/^JSON\.parse: /, "") : "parse error"}).`;
        }
        break;
      }
      case "image": {
        const file = form.get(`${def.name}__file`);
        let url = text;
        if (form.get(`${def.name}__remove`) === "on") url = "";
        if (file instanceof File && file.size > 0) {
          try {
            url = await saveImage(file, def.folder ?? "misc");
          } catch (e) {
            errors[def.name] = e instanceof Error ? e.message : "Upload failed.";
          }
        }
        if (url && !url.startsWith("/") && !/^https:\/\//.test(url)) errors[def.name] = "Use an uploaded image or an https:// link.";
        need(!!url);
        values[def.name] = url;
        break;
      }
      default: {
        if (text.length > max) errors[def.name] = `Keep it under ${max} characters.`;
        need(text.length > 0);
        if (text && def.type === "slug" && !SLUG_RE.test(text)) errors[def.name] = "Use lower-case letters, digits and dashes (like my-game).";
        if (text && def.type === "email" && !EMAIL_RE.test(text)) errors[def.name] = "Enter a valid email.";
        if (text && def.type === "color" && !COLOR_RE.test(text)) errors[def.name] = "Use a colour like #1a6b45.";
        if (text && def.type === "url" && !/^(https?:\/\/|\/|mailto:)/.test(text)) errors[def.name] = "Use a link starting with https:// or /.";
        values[def.name] = text;
      }
    }
  }
  return { values, errors };
}

export function hasErrors(errors: FormErrors): boolean {
  return Object.keys(errors).length > 0;
}

/* ----------------------------------------------------------- form bits */

export function fStr(form: FormData, name: string, max = 5000): string {
  const v = form.get(name);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function fBool(form: FormData, name: string): boolean {
  const v = form.get(name);
  return v === "on" || v === "true" || v === "1";
}

/* -------------------------------------------------------------- flash */

export const FLASH_COOKIE = "mib_flash";
export type Tone = "success" | "danger" | "info" | "warning";

/** Queue a toast for the next page view (read and cleared by AppLayout's script). */
export function flash(cookies: AstroCookies, message: string, tone: Tone = "success"): void {
  cookies.set(FLASH_COOKIE, JSON.stringify({ m: message.slice(0, 300), t: tone }), {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60,
  });
}

interface Ctx {
  cookies: AstroCookies;
  redirect(path: string, status?: 301 | 302 | 303 | 307 | 308): Response;
  url: URL;
  locals: App.Locals;
  request: Request;
  clientAddress?: string;
}

/** Toast + redirect (Post/Redirect/Get), so a refresh never re-posts the form. */
export function done(ctx: Ctx, message: string, to?: string, tone: Tone = "success"): Response {
  flash(ctx.cookies, message, tone);
  return ctx.redirect(to ?? ctx.url.pathname + ctx.url.search, 303);
}

/* -------------------------------------------------------------- audit */

function ipOf(ctx: Ctx): string | null {
  const h = ctx.request.headers;
  const fromHeader = h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (fromHeader) return fromHeader;
  try {
    return ctx.clientAddress ?? null;
  } catch {
    return null;
  }
}

/** Record an admin write in the audit log. Secrets are redacted by the repo. */
export async function audit(
  ctx: Ctx,
  action: string,
  targetType: string,
  targetId: string,
  before?: unknown,
  after?: unknown,
  note?: string,
): Promise<void> {
  await repos.audit.record({
    actorId: ctx.locals.viewer.user?.id ?? null,
    action,
    targetType,
    targetId,
    before,
    after,
    note: note ?? "",
    ip: ipOf(ctx),
  });
}

/** Only the keys whose values changed (for compact audit entries). */
export function changed<T extends Record<string, unknown>>(before: T | undefined, after: Partial<T>): { before: Partial<T>; after: Partial<T> } {
  const b: Partial<T> = {};
  const a: Partial<T> = {};
  for (const k of Object.keys(after) as (keyof T)[]) {
    const x = before?.[k];
    const y = after[k];
    const same = x instanceof Date && y instanceof Date ? x.getTime() === y.getTime() : JSON.stringify(x) === JSON.stringify(y);
    if (!same) {
      b[k] = x;
      a[k] = y as T[keyof T];
    }
  }
  return { before: b, after: a };
}

/* ------------------------------------------------------------ display */

export function initials(name: string | null | undefined): string {
  return (
    (name ?? "?")
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

/** 12345 -> "12,345"; 1234567 -> "1.2M" */
export function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (Math.abs(n) >= 100_000) return `${Math.round(n / 1000)}k`;
  return n.toLocaleString("en-GB");
}

export function pct(x: number, digits = 0): string {
  return `${(x * 100).toFixed(digits)}%`;
}

/* ------------------------------------------------------------ status pills */

export type PillTone = "green" | "gold" | "red" | "blue" | "volt" | "plum" | "";

const TONES: Record<string, PillTone> = {
  // publishing
  published: "green",
  draft: "gold",
  archived: "",
  // games
  live: "green",
  demo: "blue",
  hidden: "",
  // tickets
  open: "red",
  pending: "gold",
  resolved: "green",
  closed: "",
  // orders
  paid: "green",
  failed: "red",
  refunded: "plum",
  cancelled: "",
  // priority
  urgent: "red",
  high: "gold",
  normal: "blue",
  low: "",
};

/** The colour of a status pill for a status word ("published", "open", "paid"...). */
export function tone(status: string): PillTone {
  return TONES[status] ?? "";
}

/** "hub-pill hub-pill--green" for a status word. */
export function pillClass(status: string): string {
  const t = tone(status);
  return t ? `hub-pill hub-pill--${t}` : "hub-pill";
}

/** Good morning / afternoon / evening, by the server's clock. */
export function greeting(d = new Date()): string {
  const h = d.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
