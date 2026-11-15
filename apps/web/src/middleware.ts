/**
 * Runs before every page and API route. It works out who is visiting and
 * what they may do, and puts it on Astro.locals.viewer for pages to use:
 *
 *   const { viewer } = Astro.locals;
 *   viewer.user         // null when signed out
 *   viewer.permissions  // Set of permission names (see lib/permissions.ts)
 */
import { defineMiddleware } from "astro:middleware";
import { auth } from "./lib/auth.ts";
import { repos } from "./lib/db.ts";
import type { Viewer } from "./lib/guard.ts";
import { effectivePermissions } from "./lib/permissions.ts";

const GUEST: Viewer = { user: null, role: "guest", permissions: effectivePermissions("guest") };

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.viewer = GUEST;
  context.locals.session = null;

  // Same-site check for form posts (defence in depth; Astro's checkOrigin does
  // this too in production builds). Browsers always send Origin on cross-site POSTs.
  const unsafe = !["GET", "HEAD", "OPTIONS"].includes(context.request.method);
  const origin = context.request.headers.get("origin");
  if (unsafe && origin && origin !== context.url.origin) {
    return new Response("Cross-site request blocked.", { status: 403 });
  }

  // Static files never need a session lookup.
  if (context.url.pathname.startsWith("/_astro/") || context.isPrerendered) return next();

  const session = await auth.api.getSession({ headers: context.request.headers });
  if (session && !session.user.banned) {
    const role = String(session.user.role ?? "player");
    const overrides = await repos.permissionOverrides.listActive(session.user.id);
    context.locals.session = session;
    context.locals.viewer = {
      user: { id: session.user.id, name: session.user.name, email: session.user.email, role, image: session.user.image },
      role,
      permissions: effectivePermissions(role, overrides),
    };
  }

  const response = await next();
  // Pages that depend on who is signed in must never be cached by a shared cache.
  if (context.locals.viewer.user && !response.headers.has("Cache-Control")) {
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
});
