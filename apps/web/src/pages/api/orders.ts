/**
 * POST /api/orders: start a supporter payment or donation.
 * Until a payment provider is configured (switch "payments" off), the order is
 * recorded as "pending" with provider "manual" and the team follows up by
 * email. In-game boosts (currency "GAME") cannot be bought with real money.
 * Body: { sku, email?, dealCode? }
 */
import type { APIRoute } from "astro";
import { repos } from "../../lib/db.ts";
import { clientKey, fail, json, rateLimited, readBody, str } from "../../lib/http.ts";
import { siteSwitches } from "../../lib/site.ts";

export const POST: APIRoute = async ({ request, locals, redirect, clientAddress }) => {
  const isForm = !(request.headers.get("content-type") ?? "").includes("application/json");
  const switches = await siteSwitches();
  if (!switches.store) return fail("The store is closed right now.", 403);
  if (rateLimited(`order:${clientKey(request, clientAddress)}`, 10, 10 * 60_000)) return fail("Please wait a few minutes.", 429);
  const body = await readBody(request);
  const product = await repos.products.getBySku(str(body.sku, 80));
  if (!product || !product.active) return fail("That item is not available.", 404);
  if (product.currency === "GAME") return fail("Boosts are bought with in-game money, inside the game.", 400);
  const user = locals.viewer.user;
  const email = user?.email ?? str(body.email, 200);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Please give an email for the receipt.");
  let amount = product.priceKobo;
  const code = str(body.dealCode, 40);
  if (code) {
    const deal = await repos.deals.findByCode(code);
    if (deal && deal.percentOff > 0 && (!deal.productSku || deal.productSku === product.sku)) amount = Math.round((amount * (100 - deal.percentOff)) / 100);
  }
  const order = await repos.orders.create({
    userId: user?.id ?? null,
    email,
    productSku: product.sku,
    amountKobo: amount,
    currency: product.currency,
    status: "pending",
    provider: switches.payments ? "pending-provider" : "manual",
    dealCode: code,
    note: switches.payments ? "" : "Payments are not live yet: follow up by email.",
  });
  // TODO(payments): when a provider is chosen (e.g. Paystack), create its checkout here and return its URL.
  return isForm ? redirect(`/store/thanks?ref=${encodeURIComponent(order.ref)}`, 303) : json({ ok: true, ref: order.ref, status: order.status });
};
