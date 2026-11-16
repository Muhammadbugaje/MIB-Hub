/**
 * Builds the PlayCtx (see arcade-api.ts) for an API request, from the real
 * database, the signed-in viewer and the site switches. Server-only.
 */
import type { APIContext } from "astro";
import { repos } from "../lib/db.ts";
import { env } from "../lib/env.ts";
import { clientKey, json, rateLimited } from "../lib/http.ts";
import { siteSwitches } from "../lib/site.ts";
import type { PlayCtx, Reply } from "./arcade-api.ts";

export async function playCtx(c: APIContext): Promise<PlayCtx> {
  const who = c.locals.viewer.user?.id ?? clientKey(c.request, c.clientAddress);
  return {
    repos,
    viewer: c.locals.viewer,
    switches: await siteSwitches(),
    now: Date.now(),
    secret: env.authSecret,
    cookies: {
      get: (name) => c.cookies.get(name)?.value,
      set: (name, value, maxAge) =>
        c.cookies.set(name, value, { path: "/", httpOnly: true, sameSite: "lax", secure: env.isProd, maxAge }),
    },
    limited: (key, limit, windowMs) => rateLimited(`${key}|${who}`, limit, windowMs),
  };
}

export function send(r: Reply): Response {
  const res = json(r.body, r.status);
  for (const [k, v] of Object.entries(r.headers ?? {})) res.headers.set(k, v);
  return res;
}

/** Read a JSON body, refusing anything bigger than `max` bytes. */
export async function jsonBody(request: Request, max: number): Promise<{ body: Record<string, unknown>; bytes: number } | null> {
  const text = await request.text();
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > max) return { body: {}, bytes };
  if (!text) return { body: {}, bytes };
  try {
    const v: unknown = JSON.parse(text);
    return v && typeof v === "object" && !Array.isArray(v) ? { body: v as Record<string, unknown>, bytes } : null;
  } catch {
    return null;
  }
}
