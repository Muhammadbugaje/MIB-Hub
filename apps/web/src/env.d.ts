/// <reference types="astro/client" />

// What the middleware (src/middleware.ts) puts on Astro.locals.
declare namespace App {
  interface Locals {
    viewer: import("./lib/guard.ts").Viewer;
    session: import("./lib/auth.ts").Session | null;
  }
}

// Cloudflare's runtime module (only src/platform/workers.ts imports it; the
// Cloudflare build provides it). Declared loosely: bindings are read by name.
declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}

// The list of files under public/games/, made at build time (astro.config.mjs).
declare module "virtual:mib-public-files" {
  const files: string[];
  export default files;
}
