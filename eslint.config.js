// ESLint (flat config). `npm run lint` checks TypeScript, React and .astro files.
import js from "@eslint/js";
import astro from "eslint-plugin-astro";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/.astro/**", "legacy/**", "docs/**", "packages/db/migrations/**",
      // The old EE Hub games, copied as they are (they were checked in that project).
      "apps/web/public/play/_shared/js/**", "apps/web/public/play/_shared/vendor/**",
      // Work in Progress: the built game (its source in games/work-in-progress is linted).
      "apps/web/public/play-files/**", "apps/web/public/play-files-dev/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // Allow unused names that start with "_" (handy when destructuring to drop a field).
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
];
