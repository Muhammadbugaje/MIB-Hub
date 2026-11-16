/**
 * The admin panel's sections: one entry per page under /admin, grouped for
 * the sidebar. AppLayout builds the sidebar from this list (showing only the
 * sections the viewer has permission for), the dashboard shows them as
 * shortcuts, and the top-bar search finds them.
 *
 * Each page also calls guard() with the same permission; hiding a link is
 * not security.
 */
import type { Permission } from "./permissions.ts";
import type { AdminIconName } from "../components/admin/icons.ts";

export interface AdminSection {
  key: string;
  href: string;
  title: string;
  icon: AdminIconName;
  permission: Permission;
  summary: string;
  /** Extra words the top-bar search should match. */
  keywords?: string;
}

export interface AdminGroup {
  key: string;
  label: string;
  /** Colour of the group's icon tiles (a CSS gradient pair). */
  tone: "green" | "gold" | "volt" | "rose" | "violet" | "slate";
  sections: AdminSection[];
}

export const ADMIN_GROUPS: AdminGroup[] = [
  {
    key: "overview",
    label: "Overview",
    tone: "green",
    sections: [
      {
        key: "dashboard",
        href: "/admin",
        title: "Dashboard",
        icon: "chart",
        permission: "admin.access",
        summary: "Plays, players, hardest and most-liked levels, trends, tickets and revenue.",
        keywords: "analytics stats overview home",
      },
    ],
  },
  {
    key: "games",
    label: "Games",
    tone: "volt",
    sections: [
      {
        key: "games",
        href: "/admin/games",
        title: "Games",
        icon: "gamepad",
        permission: "games.manage",
        summary: "The catalogue: cards, status (hidden, demo, live), kill switches, order, art and per-game settings.",
        keywords: "catalogue arcade kill switch status",
      },
      {
        key: "cheats",
        href: "/admin/cheats",
        title: "Cheats & heroes",
        icon: "key",
        permission: "games.manage_settings",
        summary: "Cheat codes (stored hashed, never shown), access modes and the secret character.",
        keywords: "codes secret character hero",
      },
      {
        key: "characters",
        href: "/admin/characters",
        title: "Characters",
        icon: "mask",
        permission: "games.manage_content",
        summary: "The open-world cast: bios, voices, powers, unlocks, portraits and kill switches.",
        keywords: "cast npc portrait",
      },
      {
        key: "sounds",
        href: "/admin/sounds",
        title: "Sounds",
        icon: "music",
        permission: "games.manage_sounds",
        summary: "Replacement sounds for every player of a game (WAV, MP3 or M4A, up to 2 MB).",
        keywords: "audio sfx",
      },
      {
        key: "scores",
        href: "/admin/scores",
        title: "Leaderboards",
        icon: "trophy",
        permission: "scores.moderate",
        summary: "Review top scores, mark cheated runs and remove bad entries.",
        keywords: "scores moderation cheated",
      },
    ],
  },
  {
    key: "content",
    label: "Content",
    tone: "gold",
    sections: [
      {
        key: "news",
        href: "/admin/news",
        title: "News & posts",
        icon: "news",
        permission: "content.manage",
        summary: "News, updates, devlogs, press and promos, with a Markdown editor and scheduling.",
        keywords: "posts publications devlog blog",
      },
      {
        key: "events",
        href: "/admin/events",
        title: "Events",
        icon: "calendar",
        permission: "content.manage",
        summary: "Tournaments, launches and community nights.",
        keywords: "tournament launch",
      },
      {
        key: "deals",
        href: "/admin/deals",
        title: "Deals",
        icon: "tag",
        permission: "content.manage",
        summary: "Discounts, bundles and free boosts, with promo codes and dates.",
        keywords: "discount promo code",
      },
      {
        key: "promotions",
        href: "/admin/promotions",
        title: "Promotions",
        icon: "megaphone",
        permission: "content.manage",
        summary: "House promotions and sponsor slots: placement, schedule, weight, clicks and CTR.",
        keywords: "ads adverts banners sponsor",
      },
      {
        key: "people",
        href: "/admin/people",
        title: "Community & credits",
        icon: "users",
        permission: "content.manage",
        summary: "Founders, team, supporters, voices and testers, with photos and consent.",
        keywords: "people credits founders supporters",
      },
      {
        key: "history",
        href: "/admin/history",
        title: "History",
        icon: "clock",
        permission: "content.manage",
        summary: "The timeline on the About page.",
        keywords: "timeline about",
      },
      {
        key: "faqs",
        href: "/admin/faqs",
        title: "FAQs",
        icon: "help",
        permission: "content.manage",
        summary: "Help-centre questions and answers.",
        keywords: "questions help",
      },
    ],
  },
  {
    key: "players",
    label: "Players",
    tone: "rose",
    sections: [
      {
        key: "support",
        href: "/admin/support",
        title: "Support inbox",
        icon: "inbox",
        permission: "support.manage",
        summary: "Feedback, bug reports, complaints and help requests: reply, assign and resolve.",
        keywords: "tickets complaints feedback help",
      },
      {
        key: "store",
        href: "/admin/store",
        title: "Store & orders",
        icon: "cart",
        permission: "store.manage",
        summary: "Products and prices, and orders: mark paid or refunded.",
        keywords: "products orders payments revenue",
      },
      {
        key: "users",
        href: "/admin/users",
        title: "Users & roles",
        icon: "user-cog",
        permission: "users.view",
        summary: "Accounts, roles, bans and single-permission grants or revokes.",
        keywords: "accounts roles ban permissions",
      },
    ],
  },
  {
    key: "system",
    label: "System",
    tone: "slate",
    sections: [
      {
        key: "settings",
        href: "/admin/settings",
        title: "Settings & switches",
        icon: "sliders",
        permission: "site.settings",
        summary: "Site switches, special characters' kill switches, branding and social links.",
        keywords: "switches flags branding maintenance kill",
      },
      {
        key: "audit",
        href: "/admin/audit",
        title: "Audit log",
        icon: "list",
        permission: "audit.view",
        summary: "Who changed what, with old and new values (secrets redacted).",
        keywords: "log history changes",
      },
    ],
  },
];

/** Every section in one flat list. */
export const ADMIN_SECTIONS: AdminSection[] = ADMIN_GROUPS.flatMap((g) => g.sections);

export function adminSection(key: string): AdminSection | undefined {
  return ADMIN_SECTIONS.find((s) => s.key === key);
}

/** The groups, with only the sections these permissions allow (empty groups dropped). */
export function visibleGroups(permissions: ReadonlySet<Permission>): AdminGroup[] {
  return ADMIN_GROUPS.map((g) => ({ ...g, sections: g.sections.filter((s) => permissions.has(s.permission)) })).filter(
    (g) => g.sections.length > 0,
  );
}
