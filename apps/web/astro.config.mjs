// Astro settings for the MIB-Hub website.
// https://docs.astro.build/en/reference/configuration-reference/
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import cloudflare from "@astrojs/cloudflare";
import node from "@astrojs/node";
import react from "@astrojs/react";
import { defineConfig } from "astro/config";

// Where the site is built for:
//   (default)          Cloudflare Workers: `npm run build` makes dist/ for `wrangler deploy`.
//   ASTRO_ADAPTER=node a plain Node server (dist/server/entry.mjs), if ever needed.
// `npm run dev` always runs on Node with the local SQLite file, whichever is set.
const useNode = process.env.ASTRO_ADAPTER === "node";

/**
 * `virtual:mib-public-files`: the list of files under public/games/, made at
 * build time. On Cloudflare there is no disk to look at, so the game cards
 * use this list to know which covers and screenshots exist.
 */
function publicFilesList() {
  const id = "virtual:mib-public-files";
  const gamesDir = fileURLToPath(new URL("./public/games", import.meta.url));
  return {
    name: "mib-public-files",
    resolveId: (source) => (source === id ? "\0" + id : undefined),
    load(loadId) {
      if (loadId !== "\0" + id) return undefined;
      let files = [];
      try {
        files = readdirSync(gamesDir, { recursive: true, withFileTypes: true })
          .filter((e) => e.isFile())
          .map((e) => "games/" + relative(gamesDir, join(e.parentPath, e.name)).split(sep).join("/"));
      } catch {
        /* no public/games folder */
      }
      return `export default ${JSON.stringify(files)};`;
    },
  };
}

export default defineConfig({
  // Every page is rendered on the server per request (needed for sign-in).
  // A page can opt into build-time rendering with `export const prerender = true`.
  output: "server",
  adapter: useNode
    ? node({ mode: "standalone" })
    : cloudflare({
        // Local dev runs on Node with SQLite (src/platform/node.ts), so it does
        // not need Wrangler's local emulator. (workerd also needs macOS 13.5+.)
        platformProxy: { enabled: false },
        // No image resizing at request time on Workers (the site serves its images as they are).
        imageService: "compile",
      }),
  integrations: [react()],
  server: { port: 4321, host: true },
  // Astro checks that form POSTs come from this same site (CSRF protection).
  security: { checkOrigin: true },
  devToolbar: { enabled: false },
  vite: {
    plugins: [publicFilesList()],
    // better-sqlite3 is a native Node module: never bundle it.
    // (The Cloudflare build never reaches it: see src/platform/.)
    ssr: { external: ["better-sqlite3"] },
    optimizeDeps: { exclude: ["better-sqlite3"] },
  },
});
