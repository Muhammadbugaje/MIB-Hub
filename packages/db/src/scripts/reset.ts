/**
 * `npm run db:reset` (development only): delete the local SQLite file so the
 * next db:migrate + db:seed start from nothing. Refuses to run in production
 * or against anything that is not a local file.
 */
import { existsSync, rmSync } from "node:fs";
import { databaseFile, loadRootEnv } from "./paths.ts";

loadRootEnv();
if (process.env.NODE_ENV === "production" || process.env.DATABASE_DRIVER === "d1") {
  console.error("Refusing to reset: this looks like production.");
  process.exit(1);
}
const file = databaseFile();
for (const f of [file, `${file}-wal`, `${file}-shm`]) {
  if (existsSync(f)) rmSync(f);
}
console.log(`Deleted ${file}`);
