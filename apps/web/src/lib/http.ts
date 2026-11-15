/**
 * Small helpers shared by the API routes in src/pages/api/:
 * JSON responses, reading JSON or form bodies, the guest id cookie,
 * device detection and a simple in-memory rate limit.
 */
import type { AstroCookies } from "astro";

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export function fail(message: string, status = 400): Response {
  return json({ ok: false, error: message }, status);
}

/** Read a JSON or form body into a plain object of strings (and JSON values). */
export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) return ((await request.json()) ?? {}) as Record<string, unknown>;
    if (type.includes("form")) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of (await request.formData()).entries()) out[k] = typeof v === "string" ? v : v;
      return out;
    }
  } catch {
    return {};
  }
  return {};
}

export function str(v: unknown, max = 5000): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function int(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.round(n) : null;
}

const GUEST_COOKIE = "mib_gid";

/** A stable anonymous id for signed-out visitors (one year, httpOnly). */
export function guestId(cookies: AstroCookies): string {
  const existing = cookies.get(GUEST_COOKIE)?.value;
  if (existing && /^[a-f0-9-]{36}$/.test(existing)) return existing;
  const id = crypto.randomUUID();
  cookies.set(GUEST_COOKIE, id, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  return id;
}

export function deviceOf(userAgent: string | null): "mobile" | "tablet" | "desktop" {
  const ua = (userAgent ?? "").toLowerCase();
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/mobi|iphone|android/.test(ua)) return "mobile";
  return "desktop";
}

const buckets = new Map<string, { count: number; reset: number }>();

/** True when `key` has made more than `limit` calls in the last `windowMs`. */
export function rateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
    return false;
  }
  b.count++;
  return b.count > limit;
}

export function clientKey(request: Request, clientAddress?: string): string {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? clientAddress ?? "local";
}
