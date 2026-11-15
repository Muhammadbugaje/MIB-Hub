/**
 * POST /api/tickets: feedback, bug reports, complaints and help requests.
 * Works as a JSON API and as a plain HTML form post (then it redirects to
 * /support/thanks?ref=…). Signed-out visitors must give an email.
 * A hidden "website" field is a honeypot: bots fill it, people do not.
 */
import type { APIRoute } from "astro";
import { TICKET_KINDS } from "@mib/db";
import { repos } from "../../lib/db.ts";
import { clientKey, fail, int, json, rateLimited, readBody, str } from "../../lib/http.ts";
import { siteSwitches } from "../../lib/site.ts";

export const POST: APIRoute = async ({ request, locals, redirect, clientAddress }) => {
  const isForm = !(request.headers.get("content-type") ?? "").includes("application/json");
  const back = (q: string) => redirect(`/support?${q}#contact`, 303);
  if (!(await siteSwitches()).tickets) return isForm ? back("error=closed") : fail("Support is closed right now.", 403);
  if (rateLimited(`ticket:${clientKey(request, clientAddress)}`, 5, 10 * 60_000)) return isForm ? back("error=slow") : fail("Please wait a few minutes.", 429);
  const body = await readBody(request);
  if (str(body.website)) return isForm ? redirect("/support/thanks", 303) : json({ ok: true }); // honeypot
  const user = locals.viewer.user;
  const kind = str(body.kind, 20);
  const subject = str(body.subject, 160);
  const message = str(body.body ?? body.message, 8000);
  const email = user?.email ?? str(body.email, 200);
  if (!(TICKET_KINDS as readonly string[]).includes(kind) || subject.length < 3 || message.length < 10) {
    return isForm ? back("error=missing") : fail("Please choose a type and write a subject and a message.");
  }
  if (!user && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return isForm ? back("error=email") : fail("Please give an email so we can reply.");
  const rating = int(body.rating);
  const t = await repos.tickets.create({
    kind: kind as (typeof TICKET_KINDS)[number],
    subject,
    body: message,
    userId: user?.id ?? null,
    name: user?.name ?? str(body.name, 120),
    email,
    gameSlug: str(body.gameSlug, 80) || null,
    pageUrl: str(body.pageUrl, 500) || (request.headers.get("referer") ?? ""),
    userAgent: (request.headers.get("user-agent") ?? "").slice(0, 300),
    rating: rating && rating >= 1 && rating <= 5 ? rating : null,
    priority: kind === "payment" || kind === "account" ? "high" : "normal",
  });
  return isForm ? redirect(`/support/thanks?ref=${encodeURIComponent(t.ref)}`, 303) : json({ ok: true, ref: t.ref });
};
