/**
 * Server settings read from environment variables (and the repo-root .env
 * file in development). Server-only: never import this from a React island.
 *
 * Every variable is listed in /.env.example with an explanation.
 */
import { existsSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { siteConfig } from "../site.config.ts";

/** Walk up from the current folder to the repo root (the folder with package-lock.json). */
function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 6; i++) {
    if (existsSync(resolve(dir, "package-lock.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

export const REPO_ROOT = findRepoRoot(process.cwd());

try {
  // Node 21.7+ built-in .env loader. Values already in the environment win.
  process.loadEnvFile(resolve(REPO_ROOT, ".env"));
} catch {
  /* no .env file: defaults below apply */
}

const isProd = process.env.NODE_ENV === "production";

function databaseFile(): string {
  const file = process.env.DATABASE_FILE || "apps/web/.data/dev.sqlite";
  return isAbsolute(file) ? file : resolve(REPO_ROOT, file);
}

function authSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (isProd) throw new Error("BETTER_AUTH_SECRET must be set (32+ characters) in production.");
  console.warn("[env] BETTER_AUTH_SECRET is not set: using an insecure development secret.");
  return "dev-only-insecure-secret-do-not-use-in-production";
}

export const env = {
  isProd,
  /** "sqlite" (local file) or "d1" (Cloudflare). See docs/DATABASE.md. */
  databaseDriver: (process.env.DATABASE_DRIVER || "sqlite") as "sqlite" | "d1",
  databaseFile: databaseFile(),
  siteUrl: process.env.SITE_URL || siteConfig.url,
  authSecret: authSecret(),
  /** "console" prints emails to the terminal. See src/lib/mailer.ts. */
  mailDriver: process.env.MAIL_DRIVER || "console",
  mailFrom: process.env.MAIL_FROM || `${siteConfig.name} <no-reply@localhost>`,
};
