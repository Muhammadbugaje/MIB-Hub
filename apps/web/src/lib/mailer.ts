/**
 * Sending email, behind a tiny interface so the provider can change.
 *
 * Today there is one driver, "console": it prints the email in the terminal
 * running `npm run dev`, which is all we need to test password resets.
 *
 * To add a real provider (Resend, Postmark, SMTP through a Worker...):
 *   1. write a function that returns a Mailer,
 *   2. add it to DRIVERS below,
 *   3. set MAIL_DRIVER in .env.
 */
import { env } from "./env.ts";

export interface Email {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface Mailer {
  send(email: Email): Promise<void>;
}

/** Prints emails to the terminal. Development only. */
export function consoleMailer(from: string, log: (line: string) => void = console.log): Mailer {
  return {
    async send(email) {
      log(
        [
          "",
          "──────────── email (console mailer) ────────────",
          `From:    ${from}`,
          `To:      ${email.to}`,
          `Subject: ${email.subject}`,
          "",
          email.text,
          "────────────────────────────────────────────────",
          "",
        ].join("\n"),
      );
    },
  };
}

const DRIVERS: Record<string, () => Mailer> = {
  console: () => consoleMailer(env.mailFrom),
  // TODO(platform): add a real provider for production, e.g. resend: () => resendMailer(...)
};

let cached: Mailer | null = null;

export function getMailer(): Mailer {
  if (cached) return cached;
  const make = DRIVERS[env.mailDriver];
  if (!make) throw new Error(`Unknown MAIL_DRIVER "${env.mailDriver}". Known: ${Object.keys(DRIVERS).join(", ")}`);
  if (env.isProd && env.mailDriver === "console") {
    console.warn("[mailer] MAIL_DRIVER=console in production: emails are only printed, not sent.");
  }
  cached = make();
  return cached;
}
