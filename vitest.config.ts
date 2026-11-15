// Vitest runs every *.test.ts file in the apps and packages.
// `npm test` runs once; `npm run test:watch` re-runs on save.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"],
    environment: "node",
  },
});
