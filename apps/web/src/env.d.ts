/// <reference types="astro/client" />

// What the middleware (src/middleware.ts) puts on Astro.locals.
declare namespace App {
  interface Locals {
    viewer: import("./lib/guard.ts").Viewer;
    session: import("./lib/auth.ts").Session | null;
  }
}
