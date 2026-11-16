/**
 * `npm run d1:owner-password -w @mib/web -- --remote` (or `--local`):
 * set the owner's password in the Cloudflare D1 database to OWNER_PASSWORD
 * from your .env, stored in the new PBKDF2 format.
 *
 * Why: accounts made before 16 Nov 2026 have scrypt hashes, which take far
 * more CPU time to check than the Workers Free plan allows (10 ms), so the
 * first sign-in could fail. This re-hashes the owner's row ahead of time.
 * Other accounts upgrade by themselves at their next sign-in.
 *
 * It changes ONE row: the owner's email + password account (provider
 * "credential"). It never prints the password or the hash. The SQL goes into
 * a temporary file in the git-ignored apps/web/.data/ folder, which is
 * deleted straight after Wrangler has run it.
 */
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hashPbkdf2 } from "@mib/db";

const webDir = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const repoRoot = resolve(webDir, "../..");
const sqlFile = resolve(webDir, ".data/d1-owner-password.sql");

const sql = (v: string) => `'${v.replace(/'/g, "''")}'`;

async function main() {
  const where = process.argv.includes("--remote") ? "--remote" : process.argv.includes("--local") ? "--local" : null;
  if (!where) {
    console.error("Say which database: add -- --remote (the live site) or -- --local (wrangler dev).");
    process.exit(2);
  }
  try {
    process.loadEnvFile(resolve(repoRoot, ".env"));
  } catch {
    /* settings may already be in the environment */
  }
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD;
  if (!email || !password) {
    console.error("Set OWNER_EMAIL and OWNER_PASSWORD in .env first.");
    process.exit(2);
  }

  const hash = await hashPbkdf2(password);
  const stamp = Date.now();
  const owner = `"user_id" = (SELECT "id" FROM "user" WHERE "email" = ${sql(email)})`;
  mkdirSync(resolve(webDir, ".data"), { recursive: true });
  writeFileSync(sqlFile, `UPDATE "account" SET "password" = ${sql(hash)}, "updated_at" = ${stamp} WHERE "provider_id" = 'credential' AND ${owner};\n`);
  chmodSync(sqlFile, 0o600);
  const wrangler = (args: string[]) =>
    execFileSync("npx", ["wrangler", "d1", "execute", "mib-hub", where, ...args, "--json"], { cwd: webDir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  try {
    wrangler([`--file=${sqlFile}`]);
    // Read back (no secret in this query): is the owner's row now PBKDF2, stamped just now?
    const check = JSON.parse(
      wrangler([
        "--command",
        `SELECT COUNT(*) AS "n" FROM "account" WHERE "provider_id" = 'credential' AND ${owner} AND "password" LIKE 'pbkdf2-sha256$%' AND "updated_at" = ${stamp}`,
      ]),
    ) as { results?: { n?: number }[] }[];
    const changes = Number(check.at(-1)?.results?.[0]?.n ?? 0);
    if (changes === 1) console.log(`Owner password re-hashed (PBKDF2) in the ${where.slice(2)} D1 database: 1 row updated.`);
    else {
      console.error(`Expected to update 1 row, updated ${changes}. Is the owner (OWNER_EMAIL) in that database? Run the seed first.`);
      process.exitCode = 1;
    }
  } finally {
    rmSync(sqlFile, { force: true });
  }
}

main().catch((err: unknown) => {
  // Wrangler's own error text only (never the SQL, which holds the hash).
  const e = err as { stderr?: string; message?: string };
  console.error(String(e.stderr || e.message || err).replace(/pbkdf2-sha256\$[^'"\s]+/g, "[hash]"));
  rmSync(sqlFile, { force: true });
  process.exit(1);
});
