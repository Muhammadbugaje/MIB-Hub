/** GET /go/ad/<id>: count a click on a promotion, then go to its link (same site or https only). */
import type { APIRoute } from "astro";
import { repos } from "../../../lib/db.ts";

export const GET: APIRoute = async ({ params, redirect }) => {
  const ad = await repos.ads.click(params.id ?? "");
  const link = ad?.linkUrl ?? "/";
  const safe = link.startsWith("/") && !link.startsWith("//") ? link : /^https:\/\//.test(link) ? link : "/";
  return redirect(safe, 302);
};
