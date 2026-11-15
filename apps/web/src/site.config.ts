/**
 * Site-wide branding and links. Change the name here and it changes
 * everywhere (page titles, header, footer, emails).
 *
 * Later the admin panel can override these at runtime through the
 * `site_setting` table (keys "brand.name", "brand.tagline", ...); this file
 * stays the default.
 */
export const siteConfig = {
  /** Full name shown in the header, titles and emails. */
  name: "MIB-Hub",
  /** Short name for tight spaces (mobile header, app icon label). */
  shortName: "MIB-Hub",
  /** Letters drawn inside the logo mark. */
  initials: "MIB",
  tagline: "Original games you can play in your browser.",
  description:
    "MIB-Hub is the home of our games: arcade classics, puzzles and an open-world campus adventure, all playable in the browser.",
  /** The person behind the hub (credits and footer). */
  creator: "Muhammad Iliyasu Bugaje",
  /** Public URL in production (used for links in emails). Overridden by SITE_URL in .env. */
  url: "http://localhost:4321",
  /** Theme colours for the browser's address bar (match tokens.css --bg). */
  themeColor: { light: "#f5f2ed", dark: "#070b09" },
  /** Header navigation for public pages. */
  nav: [
    { href: "/", label: "Home" },
    { href: "/#games", label: "Games" },
    // TODO(public-pages): add Devlog, Credits, Community, Press kit (V3 §12.1).
  ],
  footerNote: "Made with care in Nigeria.",
} as const;

export type SiteConfig = typeof siteConfig;

/** "Page title · MIB-Hub" */
export function pageTitle(title?: string): string {
  return title ? `${title} · ${siteConfig.name}` : `${siteConfig.name}: ${siteConfig.tagline}`;
}
