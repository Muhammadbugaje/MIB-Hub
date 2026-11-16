/**
 * Server settings read from environment variables. Server-only: never
 * import this from a React island.
 *
 * Locally they come from the repo-root .env file (see /.env.example).
 * On Cloudflare they come from wrangler.jsonc `vars` and from secrets
 * (`wrangler secret put`); see docs/DEPLOY_CLOUDFLARE.md.
 */
import { databaseFile, isProd, readVar, REPO_ROOT } from "#platform";
import { siteConfig } from "../site.config.ts";

export { REPO_ROOT };

function authSecret(): string {
  const secret = readVar("BETTER_AUTH_SECRET");
  if (secret && secret.length >= 32) return secret;
  if (isProd) throw new Error("BETTER_AUTH_SECRET must be set (32+ characters) in production.");
  console.warn("[env] BETTER_AUTH_SECRET is not set: using an insecure development secret.");
  return "dev-only-insecure-secret-do-not-use-in-production";
}

export const env = {
  isProd,
  /** The SQLite file locally; a label on Cloudflare (which uses D1). See docs/DATABASE.md. */
  databaseFile,
  siteUrl: readVar("SITE_URL") || siteConfig.url,
  authSecret: authSecret(),
  /** "console" prints emails to the terminal / the Worker log. See src/lib/mailer.ts. */
  mailDriver: readVar("MAIL_DRIVER") || "console",
  mailFrom: readVar("MAIL_FROM") || `${siteConfig.name} <no-reply@localhost>`,
};
