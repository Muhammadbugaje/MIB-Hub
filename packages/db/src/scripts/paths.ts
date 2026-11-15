/**
 * Where the local database file lives, for the Node scripts.
 * Default: apps/web/.data/dev.sqlite (gitignored). Override with DATABASE_FILE in .env.
 */
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

/** Load the repo-root .env into process.env (Node 21.7+ built-in), if it exists. */
export function loadRootEnv(): void {
  try {
    process.loadEnvFile(resolve(REPO_ROOT, ".env"));
  } catch {
    /* no .env: fine, defaults apply */
  }
}

export function databaseFile(): string {
  const file = process.env.DATABASE_FILE || "apps/web/.data/dev.sqlite";
  return isAbsolute(file) ? file : resolve(REPO_ROOT, file);
}
