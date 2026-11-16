/**
 * Builds the game into apps/web/public/play/work-in-progress/ as plain static
 * files (index.html + one JS bundle + assets). The website serves them as
 * they are; /play/work-in-progress shows them inside the site's play page.
 */
import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

const OUT = resolve(__dirname, "../../apps/web/public/play/work-in-progress");

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
  plugins: [sizeGuard()],
  server: { port: 5174 },
});
