/**
 * `npm run db:migrate`: create the local SQLite file if needed and apply every
 * migration in packages/db/migrations that has not run yet.
 */
import { createSqliteDb, migrateSqlite } from "../sqlite.ts";
import { databaseFile, loadRootEnv } from "./paths.ts";

loadRootEnv();
const file = databaseFile();
const db = createSqliteDb(file);
migrateSqlite(db);
db.$sqlite.close();
console.log(`Migrations applied to ${file}`);
