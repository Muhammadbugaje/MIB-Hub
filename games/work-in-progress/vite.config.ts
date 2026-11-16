/**
 * Builds the game into apps/web/public/play-files/work-in-progress/ as plain
 * static files (index.html + one JS bundle + assets). The website serves them
 * as they are; the page /play/work-in-progress shows them in an iframe.
 *
 * The folder is deliberately NOT /play/work-in-progress/: on Cloudflare static
 * assets a folder with the same path as a page route shadows (or redirects)
 * the page. The story data comes from docs/ through tools/story-plugin.ts.
 */
import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { storyPlugin } from "./tools/story-plugin.ts";

const OUT = resolve(__dirname, "../../apps/web/public/play-files/work-in-progress");

/** Cloudflare static hosting refuses files of 25 MiB or more: fail the build instead of the deploy. */
function sizeGuard(): Plugin {
  return {
    name: "wip-size-guard",
    closeBundle() {
      const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
      const big = walk(OUT).filter((f) => statSync(f).size >= 25 * 1024 * 1024);
      if (big.length) throw new Error(`Files too big for Cloudflare (>= 25 MiB): ${big.join(", ")}`);
    },
  };
}

export default defineConfig({
  base: "./",
  publicDir: "assets",
  build: {
    outDir: OUT,
    emptyOutDir: true,
    target: "es2020",
    assetsDir: "js",
    chunkSizeWarningLimit: 2600,
  },
  plugins: [storyPlugin(), sizeGuard()],
  server: { port: 5174 },
});
