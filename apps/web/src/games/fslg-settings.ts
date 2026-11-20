/** FSLG Game Settings – cheat codes, rules, hero system, and game toggles.
 *
 *  Docs: docs/MASTER_GAME_GUIDE.md §5.3, docs/port/MANAGEMENT.md
 *
 *  Data structure stored in repos.gameSettings.effective("samaru-days").data:
 *
 *  {
 *    // Cheat system
 *    cheatsEnabled: true,
 *    cheatsOnBoards: true,
 *    heroEnabled: true,
 *
 *    // Hero code system
 *    heroReveal: { name: string; combo: string; swipe: string; powers: string },
 *
 *    // 17 samaru-days rules (from cheat_defaults/samaru-days.json)
 *    rules: {
 *      warnings: { type: "int", default: 5, min: 3, max: 6 },
 *      window: { type: "int", default: 20, min: 5, max: 120 },
 *      warnExpire: { type: "int", default: 40, min: 10, max: 600 },
 *      guards: { type: "int", default: 2, min: 1, max: 4 },
 *      guardSpeed: { type: "float", default: 0.86, min: 0.3, max: 0.97 },
 *      sight: { type: "int", default: 45, min: 8, max: 200 },
 *      search: { type: "int", default: 12, min: 2, max: 120 },
 *      decay: { type: "float", default: 1.2, min: 0.05, max: 20 },
 *      fine: { type: "int", default: 200, min: 0, max: 100000 },
 *      fareBase: { type: "int", default: 100, min: 0, max: 5000 },
 *      farePerKm: { type: "int", default: 40, min: 0, max: 5000 },
 *      fareMax: { type: "int", default: 200, min: 0, max: 20000 },
 *      kekeFactor: { type: "float", default: 1.5, min: 1, max: 5 },
 *      wildWarn: { type: "int", default: 400, min: 50, max: 5000 },
 *      wildLimit: { type: "int", default: 1500, min: 300, max: 20000 },
 *      wildPatience: { type: "int", default: 22, min: 5, max: 300 },
 *      wildFine: { type: "int", default: 150, min: 0, max: 100000 }
 *    },
 *
 *  API:
 *    GET  /arcade/api/fslg/settings      – read current settings (super admin)
 *    PATCH /arcade/api/fslg/settings      – update settings (super admin)
 *    POST /arcade/api/fslg/settings/reset  – reset to defaults (super admin)
 */

import { ok, err } from "./arcade-api.ts";
import type { PlayCtx } from "./arcade-api.ts";
import type { Repos } from "@mib/db";

const DEFAULT_RULES = {
  warnings: { type: "int", default: 5, min: 3, max: 6 },
  window: { type: "int", default: 20, min: 5, max: 120 },
  warnExpire: { type: "int", default: 40, min: 10, max: 600 },
  guards: { type: "int", default: 2, min: 1, max: 4 },
  guardSpeed: { type: "float", default: 0.86, min: 0.3, max: 0.97 },
  sight: { type: "int", default: 45, min: 8, max: 200 },
  search: { type: "int", default: 12, min: 2, max: 120 },
  decay: { type: "float", default: 1.2, min: 0.05, max: 20 },
  fine: { type: "int", default: 200, min: 0, max: 100000 },
  fareBase: { type: "int", default: 100, min: 0, max: 5000 },
  farePerKm: { type: "int", default: 40, min: 0, max: 5000 },
  fareMax: { type: "int", default: 200, min: 0, max: 20000 },
  kekeFactor: { type: "float", default: 1.5, min: 1, max: 5 },
  wildWarn: { type: "int", default: 400, min: 50, max: 5000 },
  wildLimit: { type: "int", default: 1500, min: 300, max: 20000 },
  wildPatience: { type: "int", default: 22, min: 5, max: 300 },
  wildFine: { type: "int", default: 150, min: 0, max: 100000 },
};

/** Read the current game settings. */
export async function getFslgSettings(ctx: PlayCtx): Promise<Reply> {
  try {
    const repos = ctx.repos as Repos;
    const viewer = ctx.viewer;

    if (!viewer.permissions.has("admin.access")) {
      return err("Admin access required.", 403);
    }

    const settings = await repos.gameSettings.effective("samaru-days");

    let data: Record<string, unknown> = {};
    if (settings?.data) {
      data = settings.data;
    }

    // Ensure all rule fields exist with defaults
    const rules: Record<string, unknown> = {};
    for (const [key, def] of Object.entries(DEFAULT_RULES)) {
      rules[key] = data?.rules?.[key] ?? def.default;
    }

    const result = {
      cheatsEnabled: data?.cheatsEnabled !== false,
      heroEnabled: data?.heroEnabled !== false,
      cheatsOnBoards: data?.cheatsOnBoards !== false,
      heroReveal: data?.heroReveal || { name: "M.I. BUGAJE", combo: "", swipe: "", powers: "" },
      rules,
    };

    return ok(result);
  } catch (e) {
    return err(`Failed to read FSLG settings: ${(e as Error).message}`, 500);
  }
}

/** Update the FSLG game settings. */
export async function patchFslgSettings(ctx: PlayCtx, body: Record<string, unknown>): Promise<Reply> {
  try {
    const repos = ctx.repos as Repos;
    const viewer = ctx.viewer;

    if (!viewer.permissions.has("admin.access")) {
      return err("Admin access required.", 403);
    }

    const updates: Record<string, unknown> = {};

    // Cheat system
    if (body.cheatsEnabled !== undefined) updates.cheatsEnabled = body.cheatsEnabled === true;
    if (body.heroEnabled !== undefined) updates.heroEnabled = body.heroEnabled === true;
    if (body.cheatsOnBoards !== undefined) updates.cheatsOnBoards = body.cheatsOnBoards === true;

    // Hero reveal
    if (body.heroReveal && typeof body.heroReveal === "object") {
      updates.heroReveal = {
        name: String(body.heroReveal.name).slice(0, 80),
        combo: String(body.heroReveal.combo).slice(0, 80),
        swipe: String(body.heroReveal.swipe).slice(0, 80),
        powers: String(body.heroReveal.powers).slice(0, 200),
      };
    }

    // Rules
    if (body.rules && typeof body.rules === "object") {
      const rules: Record<string, unknown> = {};
      for (const [key, def] of Object.entries(DEFAULT_RULES)) {
        const val = body.rules[key];
        if (val !== undefined) {
          if (def.type === "int") {
            const n = Number(val);
            if (!isNaN(n) && n >= def.min && n <= def.max) rules[key] = n;
          } else if (def.type === "float") {
            const n = Number(val);
            if (!isNaN(n) && n >= def.min && n <= def.max) rules[key] = Math.max(def.min, Math.min(def.max, n));
          }
        }
      }
      updates.rules = rules;
    }

    // Update the game settings
    await repos.gameSettings.upsert({
      where: { slug: "samaru-days" },
      create: {
        slug: "samaru-days",
        data: updates,
        createdAt: new Date(),
      },
      updates: {
        data: { ...(settings?.data || {}), ...updates },
        updatedAt: new Date(),
      },
    });

    // Notify all open tabs
    try {
      if (root.BroadcastChannel && !(root.process && root.process.versions && root.process.versions.node)) {
        const bc = new BroadcastChannel("fslg");
        bc.postMessage({ type: "settings-updated", updates });
        bc.close();
      }
    } catch (e) {
      // ignore
    }

    return ok({ success: true, updates });
  } catch (e) {
    return err(`Failed to update FSLG settings: ${(e as Error).message}`, 500);
  }
}

/** Reset the FSLG game settings to defaults. */
export async function postFslgSettingsReset(ctx: PlayCtx): Promise<Reply> {
  try {
    const repos = ctx.repos as Repos;
    const viewer = ctx.viewer;

    if (!viewer.permissions.has("admin.access")) {
      return err("Admin access required.", 403);
    }

    await repos.gameSettings.upsert({
      where: { slug: "samaru-days" },
      create: {
        slug: "samaru-days",
        data: {
          cheatsEnabled: true,
          heroEnabled: true,
          cheatsOnBoards: true,
          heroReveal: { name: "M.I. BUGAJE", combo: "", swipe: "", powers: "" },
          rules: { ...DEFAULT_RULES },
        },
        createdAt: new Date(),
      },
      updates: {
        data: {
          cheatsEnabled: true,
          heroEnabled: true,
          cheatsOnBoards: true,
          heroReveal: { name: "M.I. BUGAJE", combo: "", swipe: "", powers: "" },
          rules: { ...DEFAULT_RULES },
        },
        updatedAt: new Date(),
      },
    });

    return ok({ success: true, resetToDefaults: true });
  } catch (e) {
    return err(`Failed to reset FSLG settings: ${(e as Error).message}`, 500);
  }
}