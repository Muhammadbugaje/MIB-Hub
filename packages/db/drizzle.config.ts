// drizzle-kit settings: `npm run db:generate` reads the schema and writes a new
// numbered SQL migration into ./migrations. Never edit old migrations; add new ones.
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite", // SQLite and Cloudflare D1 share this dialect
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dbCredentials: { url: process.env.DATABASE_FILE ?? "../../apps/web/.data/dev.sqlite" },
  strict: true,
  verbose: true,
});
