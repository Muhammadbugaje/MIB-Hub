/** GET /events/<slug>.ics: a calendar file for one published event. */
import type { APIRoute } from "astro";
import { icsFor } from "../../components/public/kinds.ts";
import { repos } from "../../lib/db.ts";
import { siteConfig } from "../../site.config.ts";

export const GET: APIRoute = async ({ params, url }) => {
  const slug = params.slug ?? "";
  const event = /^[a-z0-9-]{1,120}$/.test(slug) ? await repos.events.getBySlug(slug) : undefined;
  if (!event || event.status !== "published") return new Response("No such event.", { status: 404 });
  const body = icsFor(event, new URL(`/events/${event.slug}`, url).toString(), siteConfig.name);
  return new Response(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${event.slug}.ics"`,
      "cache-control": "public, max-age=300",
    },
  });
};
