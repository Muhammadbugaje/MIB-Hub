/**
 * Runtime site settings: the switches (feature flags and kill switches) and
 * branding overrides stored in `site_setting` and edited in /admin/settings.
 *
 *   const s = await siteSwitches();
 *   if (!s.tickets) ...
 *
 * Defaults here are used when a key has never been saved.
 */
import { repos } from "./db.ts";

export const SWITCH_DEFAULTS = {
  registration: true,
  guestPlay: true,
  tickets: true,
  store: true,
  payments: false,
  ads: true,
  leaderboards: true,
  likes: true,
  tracking: true,
  maintenance: false,
} as const;

export type SwitchKey = keyof typeof SWITCH_DEFAULTS;
export type Switches = Record<SwitchKey, boolean>;

/** Every switch, with its label and help text, for the settings page. */
export const SWITCH_INFO: Record<SwitchKey, { label: string; help: string }> = {
  registration: { label: "New accounts", help: "Let visitors create accounts." },
  guestPlay: { label: "Guest play", help: "Let signed-out visitors play games." },
  tickets: { label: "Support tickets", help: "Accept feedback, complaints and help requests." },
  store: { label: "Store", help: "Show the store page and supporter tiers." },
  payments: { label: "Online payments", help: "Take real payments. Off until a payment provider is configured." },
  ads: { label: "Promotions", help: "Show house promotions and sponsor slots." },
  leaderboards: { label: "Leaderboards", help: "Show public leaderboards." },
  likes: { label: "Likes", help: "Let players like games and levels." },
  tracking: { label: "Play tracking", help: "Record plays and level results for the statistics." },
  maintenance: { label: "Maintenance mode", help: "Show a maintenance notice to everyone except staff." },
};

export async function siteSwitches(): Promise<Switches> {
  const all = await repos.siteSettings.all();
  const out = { ...SWITCH_DEFAULTS } as Switches;
  for (const key of Object.keys(SWITCH_DEFAULTS) as SwitchKey[]) {
    const v = all[`switch.${key}`];
    if (typeof v === "boolean") out[key] = v;
  }
  return out;
}

/** Special characters' kill switches ("switch.special.<name>"), default on. */
export async function specialSwitches(): Promise<Record<string, boolean>> {
  const all = await repos.siteSettings.all();
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(all)) if (k.startsWith("switch.special.")) out[k.slice(15)] = v !== false;
  return out;
}

/** Format kobo as naira: 250000 -> "₦2,500". In-game prices use "GAME". */
export function formatPrice(kobo: number, currency = "NGN"): string {
  if (kobo === 0) return "Free";
  const naira = (kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 });
  return currency === "GAME" ? `₦${naira} in game` : `₦${naira}`;
}

/** "3 Dec" / "3 Dec 2027" (year only when not this year). */
export function formatDate(d: Date | null | undefined, opts: { time?: boolean } = {}): string {
  if (!d) return "";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
  return opts.time ? `${date}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : date;
}

/** "just now", "5 min ago", "3 h ago", "2 days ago", then a date. */
export function timeAgo(d: Date): string {
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.round(s / 86400)} days ago`;
  return formatDate(d);
}
