/**
 * Page and API guards: "you must be signed in" and "you need permission X".
 *
 * In an .astro page:
 *
 *   ---
 *   import { guard } from "../lib/guard.ts";
 *   const denied = guard(Astro, { permission: "admin.access" });
 *   if (denied) return denied;   // a redirect to sign-in, or the 403 page
 *   ---
 *
 * The decision itself (checkAccess) is a pure function so it can be tested
 * without a server. The viewer comes from src/middleware.ts.
 */
import type { Permission } from "./permissions.ts";

/** Who is looking at the page. Set on Astro.locals.viewer by the middleware. */
export interface Viewer {
  user: { id: string; name: string; email: string; role: string; image?: string | null } | null;
  /** "guest" when not signed in. */
  role: string;
  permissions: ReadonlySet<Permission>;
}

export interface Requirement {
  /** Require a signed-in user (implied by `permission`). */
  signedIn?: boolean;
  /** Require this permission. */
  permission?: Permission;
  /** Require ANY of these permissions. */
  anyOf?: Permission[];
}

export type AccessDecision =
  | { allowed: true }
  | { allowed: false; reason: "signed-out"; redirectTo: string }
  | { allowed: false; reason: "forbidden" };

export const SIGN_IN_PATH = "/auth/sign-in";

/** Only allow "next" to point back into this site (stops open-redirect tricks). */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

export function hasPermission(viewer: Viewer, permission: Permission): boolean {
  return viewer.permissions.has(permission);
}

/** The rule: signed out -> go sign in (and come back); signed in without permission -> forbidden. */
export function checkAccess(viewer: Viewer, req: Requirement, currentPath: string): AccessDecision {
  const needsUser = req.signedIn || !!req.permission || !!req.anyOf?.length;
  if (needsUser && !viewer.user) {
    return { allowed: false, reason: "signed-out", redirectTo: `${SIGN_IN_PATH}?next=${encodeURIComponent(safeNext(currentPath))}` };
  }
  if (req.permission && !viewer.permissions.has(req.permission)) return { allowed: false, reason: "forbidden" };
  if (req.anyOf?.length && !req.anyOf.some((p) => viewer.permissions.has(p))) return { allowed: false, reason: "forbidden" };
  return { allowed: true };
}

/** The bits of Astro's context the guard needs (keeps it testable). */
interface GuardContext {
  locals: { viewer: Viewer };
  url: URL;
  redirect(path: string, status?: 301 | 302 | 303 | 307 | 308): Response;
  rewrite(path: string): Promise<Response>;
}

/**
 * Use at the top of a page. Returns null when access is allowed, otherwise a
 * Response to return straight away (redirect to sign-in, or the 403 page).
 */
export function guard(ctx: GuardContext, req: Requirement): Response | Promise<Response> | null {
  const decision = checkAccess(ctx.locals.viewer, req, ctx.url.pathname + ctx.url.search);
  if (decision.allowed) return null;
  if (decision.reason === "signed-out") return ctx.redirect(decision.redirectTo, 303);
  // Show the 403 page at the same URL (src/pages/403.astro sets the status).
  return ctx.rewrite("/403");
}

/** For API routes: a JSON 401/403 instead of a redirect. */
export function guardApi(viewer: Viewer, req: Requirement): Response | null {
  const decision = checkAccess(viewer, req, "/");
  if (decision.allowed) return null;
  const status = decision.reason === "signed-out" ? 401 : 403;
  return Response.json({ error: decision.reason }, { status });
}
