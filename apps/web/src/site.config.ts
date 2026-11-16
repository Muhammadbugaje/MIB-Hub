/**
 * Site-wide branding and navigation. Change the name here and it changes
 * everywhere (page titles, header, footer, emails).
 *
 * The admin panel can override some of these at runtime through the
 * `site_setting` table ("brand.name", "brand.tagline", "social.links", ...);
 * this file stays the default.
 */

/** Icon names come from src/components/Icon.astro. */
export interface NavLink {
  href: string;
  label: string;
  icon: string;
  /** One short line under the label in the dropdown. */
  hint?: string;
}

export interface NavGroup {
  label: string;
  /** Where the group's own label links on phones and in the footer. */
  href: string;
  items: NavLink[];
}

export const siteConfig = {
  /** Full name shown in the header, titles and emails. */
  name: "MIB-Hub",
  /** Short name for tight spaces (mobile header, app icon label). */
  shortName: "MIB-Hub",
  /** Letters drawn inside the logo mark. */
  initials: "MIB",
  tagline: "Original games you can play in your browser.",
  /** The small second line of the header lockup. */
  lockupTagline: "Original browser games",
  description:
    "MIB-Hub is the home of our games: arcade classics, puzzles and an open-world campus adventure, all playable in the browser.",
  /** The person behind the hub (credits and footer). */
  creator: "Muhammad Iliyasu Bugaje",
  /** Public URL in production (used for links in emails). Overridden by SITE_URL in .env. */
  url: "http://localhost:4321",
  /** Theme colours for the browser's address bar (match tokens.css --bg). */
  themeColor: { light: "#f5f2ed", dark: "#070b09" },

  /** Header navigation for public pages: dropdown groups, then plain links. */
  navGroups: [
    {
      label: "Games",
      href: "/games",
      items: [
        { href: "/games", label: "All games", icon: "gamepad", hint: "Arcade, versus, puzzles, open world" },
        { href: "/leaderboards", label: "Leaderboards", icon: "trophy", hint: "Top scores for every game" },
        { href: "/characters", label: "Characters", icon: "users", hint: "The open-world cast" },
      ],
    },
    {
      label: "News",
      href: "/news",
      items: [
        { href: "/news", label: "Latest news", icon: "newspaper", hint: "Devlogs, updates and launches" },
        { href: "/events", label: "Events", icon: "calendar", hint: "Tournaments and live sessions" },
      ],
    },
    {
      label: "Community",
      href: "/community",
      items: [
        { href: "/community", label: "Community & credits", icon: "heart", hint: "Founders, voices and supporters" },
        { href: "/about", label: "About & history", icon: "milestone", hint: "How the hub came to be" },
      ],
    },
  ] satisfies NavGroup[],
  navLinks: [
    { href: "/store", label: "Store", icon: "bag", hint: "Boosts and supporter tiers" },
    { href: "/support", label: "Support", icon: "life-buoy", hint: "Help centre and contact" },
  ] satisfies NavLink[],

  /** Words the home page hero types after the headline. Game titles are added from the database. */
  heroWords: ["Arcade.", "Versus.", "Puzzles.", "Open world."],

  footerNote: "Made with care in Nigeria.",
} as const;

export type SiteConfig = typeof siteConfig;

/** "Page title · MIB-Hub" */
export function pageTitle(title?: string): string {
  return title ? `${title} · ${siteConfig.name}` : `${siteConfig.name}: ${siteConfig.tagline}`;
}
