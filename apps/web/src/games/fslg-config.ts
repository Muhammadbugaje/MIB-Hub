import { ok, err } from "./arcade-api.ts";
import type { PlayCtx } from "./arcade-api.ts";
import type { Repos } from "@mib/db";

/** FSLG Config management – the single source of game branding that the super admin changes for everyone.
 *
 *  Docs: docs/MASTER_GAME_GUIDE.md §5, docs/port/MANAGEMENT.md A11
 *
 *  API:
 *    GET  /arcade/api/fslg/config          – read current config (live + defaults merged)
 *    PATCH /arcade/api/fslg/config         – update config (super admin only)
 *    POST /arcade/api/fslg/config/reset    – reset to defaults
 *
 *  The config JSON lives in two places:
 *    – fslg.config.js  (the ONE place they are written, loaded by samaru-data.js)
 *    – repos.gameSettings.effective("samaru-days")  (the runtime effective settings)
 *
 *  When the admin changes the config, the new values are written to both:
 *    1. D.CONFIG in samaru-overrides.js (live for this browser session)
 *    2. repos.gameSettings rows for samaru-days (persisted, available to all players)
 *
 *  The game reads the live config via Z.resolveText() and F.resolveText() in samaru-overrides.js.
 */

/** Read the game config – merges defaults from fslg.config.js with any live admin overrides. */
export async function getFslgConfig(ctx: PlayCtx): Promise<Reply> {
  try {
    const repos = ctx.repos as Repos;

    // Get the default config from fslg.config.js (client-side module)
    // The defaults are already embedded in the client script via GameConfigDefault
    // For the API, we read from game settings if available, otherwise use built-in defaults

    // Try to get effective game settings for samaru-days
    const settings = await repos.gameSettings.effective("samaru-days");

    // Build config object with defaults, overridden by settings if present
    const config = {
      gameName: settings?.data?.gameName || "Freshers School Life",
      gameShortName: settings?.data?.gameShortName || "FSLG",
      initialsOverride: settings?.data?.initialsOverride || "",
      tagline: settings?.data?.tagline || "One school, a thousand stories.",
      author: settings?.data?.author || "Muhammad Iliyasu Bugaje",
      primaryColour: settings?.data?.primaryColour || "#f59e0b",
      secondaryColour: settings?.data?.secondaryColour || "#0f766e",
      currencyName: settings?.data?.currencyName || "naira",
      currencySymbol: settings?.data?.currencySymbol || "₦",
      configVersion: settings?.data?.configVersion ?? 0,
    };

    return ok(config);
  } catch (e) {
    return err(`Failed to read FSLG config: ${(e as Error).message}`, 500);
  }
}

/** Update the FSLG config – super admin only.
 *  The body should contain partial config fields to update.
 *  On success, the new config is written to:
 *    1. repos.gameSettings for samaru-days (persisted)
 *    2. The client will pick up the change via BroadcastChannel / fetch interval
 */
export async function patchFslgConfig(ctx: PlayCtx, body: Record<string, unknown>): Promise<Reply> {
  try {
    const repos = ctx.repos as Repos;
    const viewer = ctx.viewer;

    // Check admin permission
    if (!viewer.permissions.has("admin.access")) {
      return err("Admin access required.", 403);
    }

    // Build the updated settings data
    const updates: Record<string, unknown> = {};

    if (body.gameName !== undefined) updates.gameName = String(body.gameName).slice(0, 99);
    if (body.gameShortName !== undefined) updates.gameShortName = String(body.gameShortName).slice(0, 12);
    if (body.initialsOverride !== undefined) {
      const initials = String(body.initialsOverride).replace(/[^A-Z0-9]/g, "").toUpperCase().slice(0, 6);
      updates.initialsOverride = initials;
    }
    if (body.tagline !== undefined) updates.tagline = String(body.tagline).slice(0, 120);
    if (body.primaryColour !== undefined) {
      const colour = String(body.primaryColour);
      if (/^#[0-9a-fA-F]{6}$/.test(colour)) updates.primaryColour = colour.toLowerCase();
    }
    if (body.secondaryColour !== undefined) {
      const colour = String(body.secondaryColour);
      if (/^#[0-9a-fA-F]{6}$/.test(colour)) updates.secondaryColour = colour.toLowerCase();
    }
    if (body.currencyName !== undefined) updates.currencyName = String(body.currencyName).slice(0, 99);
    if (body.currencySymbol !== undefined) updates.currencySymbol = String(body.currencySymbol).slice(0, 3);
    if (body.configVersion !== undefined) updates.configVersion = Number(body.configVersion);

    // Update the game settings
    await repos.gameSettings.upsert({
      where: { slug: "samaru-days" },
      updates: {
        data: updates,
        updatedAt: new Date(),
      },
      create: {
        slug: "samaru-days",
        data: updates,
        createdAt: new Date(),
      },
    });

    // Notify all open tabs via BroadcastChannel
    try {
      if (root.BroadcastChannel && !(root.process && root.process.versions && root.process.versions.node)) {
        const bc = new BroadcastChannel("fslg");
        bc.postMessage({ type: "config-updated", config: updates });
        bc.close();
      }
    } catch (e) {
      // BroadcastChannel not available, will pick up on next fetch interval
    }

    return ok({ success: true, config: updates });
  } catch (e) {
    return err(`Failed to update FSLG config: ${(e as Error).message}`, 500);
  }
}

/** Reset the FSLG config to defaults. */
export async function postFslgConfigReset(ctx: PlayCtx): Promise<Reply> {
  try {
    const repos = ctx.repos as Repos;
    const viewer = ctx.viewer;

    if (!viewer.permissions.has("admin.access")) {
      return err("Admin access required.", 403);
    }

    // Reset to defaults
    await repos.gameSettings.upsert({
      where: { slug: "samaru-days" },
      create: {
        slug: "samaru-days",
        data: {
          gameName: "Freshers School Life",
          gameShortName: "FSLG",
          initialsOverride: "",
          tagline: "One school, a thousand stories.",
          author: "Muhammad Iliyasu Bugaje",
          primaryColour: "#f59e0b",
          secondaryColour: "#0f766e",
          currencyName: "naira",
          currencySymbol: "₦",
          configVersion: 0,
        },
        createdAt: new Date(),
      },
      updates: {
        data: {
          gameName: "Freshers School Life",
          gameShortName: "FSLG",
          initialsOverride: "",
          tagline: "One school, a thousand stories.",
          author: "Muhammad Iliyasu Bugaje",
          primaryColour: "#f59e0b",
          secondaryColour: "#0f766e",
          currencyName: "naira",
          currencySymbol: "₦",
          configVersion: 0,
        },
        updatedAt: new Date(),
      },
    });

    return ok({ success: true, resetToDefaults: true });
  } catch (e) {
    return err(`Failed to reset FSLG config: ${(e as Error).message}`, 500);
  }
}