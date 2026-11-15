/**
 * Better Auth: email + password accounts and sessions.
 *
 * - Tables: packages/db/src/schema/auth.ts (user, session, account, verification).
 * - HTTP endpoints: src/pages/api/auth/[...all].ts mounts Better Auth at /api/auth/*.
 * - Our pages (sign in, register...) call `auth.api.*` on the server, so they
 *   work as plain HTML forms, even with JavaScript switched off.
 * - Password reset emails go through src/lib/mailer.ts.
 */
import * as schema from "@mib/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { siteConfig } from "../site.config.ts";
import { db } from "./db.ts";
import { env } from "./env.ts";
import { getMailer } from "./mailer.ts";

export const MIN_PASSWORD_LENGTH = 8;

export const auth = betterAuth({
  appName: siteConfig.name,
  baseURL: env.siteUrl,
  secret: env.authSecret,
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  user: {
    additionalFields: {
      // input: false means a visitor can never set their own role when registering.
      role: { type: "string", required: false, defaultValue: "player", input: false },
      banned: { type: "boolean", required: false, defaultValue: false, input: false },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    maxPasswordLength: 128,
    autoSignIn: true, // sign the new user in straight after registering
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60, // 1 hour
    async sendResetPassword({ user, url }) {
      await getMailer().send({
        to: user.email,
        subject: `Reset your ${siteConfig.name} password`,
        text: [
          `Hello ${user.name},`,
          "",
          `Someone (hopefully you) asked to reset the password for your ${siteConfig.name} account.`,
          "Open this link within one hour to choose a new password:",
          "",
          url,
          "",
          "If you did not ask for this, you can ignore this email; your password stays the same.",
        ].join("\n"),
      });
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days ("keep me signed in")
    updateAge: 60 * 60 * 24, // refresh the expiry once a day of use
  },
  advanced: {
    cookiePrefix: "mib",
  },
  telemetry: { enabled: false },
});

export type Session = typeof auth.$Infer.Session;

/** Turn a failed Better Auth response into a sentence for the form. */
export async function authErrorMessage(res: Response, fallback = "Something went wrong. Please try again."): Promise<string> {
  try {
    const body = (await res.clone().json()) as { message?: string; code?: string };
    switch (body.code) {
      case "INVALID_EMAIL_OR_PASSWORD":
        return "That email and password do not match an account.";
      case "USER_ALREADY_EXISTS":
      case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
        return "An account with that email already exists. Try signing in instead.";
      case "PASSWORD_TOO_SHORT":
        return `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`;
      case "INVALID_TOKEN":
        return "This reset link has expired or was already used. Ask for a new one.";
      case "INVALID_PASSWORD":
        return "Your current password is not right.";
      default:
        return body.message || fallback;
    }
  } catch {
    return fallback;
  }
}

/** A redirect that carries over the cookies Better Auth set (sign-in, sign-out). */
export function redirectWithCookies(location: string, from: Response): Response {
  const headers = new Headers({ Location: location });
  for (const cookie of from.headers.getSetCookie()) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}
