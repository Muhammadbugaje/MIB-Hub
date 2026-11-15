// Astro settings for the MIB-Hub website.
// https://docs.astro.build/en/reference/configuration-reference/
import node from "@astrojs/node";
import react from "@astrojs/react";
import { defineConfig } from "astro/config";

export default defineConfig({
  // Every page is rendered on the server per request (needed for sign-in).
  // A page can opt into build-time rendering with `export const prerender = true`.
  output: "server",
  // Runs as a Node server today. For Cloudflare Pages, swap in @astrojs/cloudflare
  // (see docs/DEPLOY.md); nothing else in the app should need to change.
  adapter: node({ mode: "standalone" }),
  integrations: [react()],
  server: { port: 4321, host: true },
  // Astro checks that form POSTs come from this same site (CSRF protection).
  security: { checkOrigin: true },
  devToolbar: { enabled: false },
  vite: {
    // better-sqlite3 is a native Node module: never bundle it.
    ssr: { external: ["better-sqlite3"] },
    optimizeDeps: { exclude: ["better-sqlite3"] },
  },
});
