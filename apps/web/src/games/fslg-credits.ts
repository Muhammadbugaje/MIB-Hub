/** FSLG Credits management – end-of-game scroll editor.
 *
 *  Docs: docs/MASTER_GAME_GUIDE.md §5.5, docs/port/MANAGEMENT.md A12
 *
 *  Credit section structure:
 *    { title: string, visible: boolean, entries: [ { name, role, characterName, note, visible, approved, order } ] }
 *    outro: string
 *
 *  API (handled by arcade-[...path].ts):
 *    GET  /fslg/credits          – read current credits (super admin)
 *    POST /fslg/credits/save      – save credits changes (super admin)
 *    POST /fslg/credits/reset     – reset to defaults (super admin)
 */

/** Validate credits data – simplified validation. */
function validateCredits(d: Record<string, unknown>): { ok: boolean; errors: string[]; sanitized: Record<string, unknown> } {
  const errors: string[] = [];
  const s: Record<string, unknown> = {};

  // sections
  if (d.sections && typeof d.sections === "object") {
    const sections = Array.isArray(d.sections) ? d.sections : [d.sections];
    s.sections = sections.map((sec, i) => {
      const title = String(sec.title ?? "").slice(0, 60).trim();
      const visible = sec.visible !== false;
      const entries = (sec.entries && Array.isArray(sec.entries))
        ? sec.entries.filter((e: any) => typeof e === "object" && e && typeof e.name === "string" && e.name.trim())
          .map((e: any) => ({
            name: e.name.slice(0, 100).trim(),
            role: e.role !== undefined ? String(e.role).slice(0, 120) : undefined,
            characterName: e.characterName !== undefined ? String(e.characterName).slice(0, 60) : undefined,
            note: e.note !== undefined ? String(e.note).slice(0, 500) : undefined,
            visible: e.visible !== false,
            approved: e.approved !== false,
            order: Number(e.order) || 0,
          }))
        : [];
      return { title, visible, entries, order: sec.order ?? i };
    });
  } else {
    errors.push("Credits must have a 'sections' array.");
  }

  // outro
  if (d.outro !== undefined) {
    const outro = String(d.outro).slice(0, 500).trim();
    if (outro) s.outro = outro;
    else errors.push("Outro text cannot be empty.");
  }

  return {
    ok: errors.length === 0,
    errors,
    sanitized: s,
  };
}

/** Read the current credits configuration. */
export async function getFslgCredits(ctx: PlayCtx): Promise<Reply> {
  try {
    const repos = ctx.repos as Repos;
    const viewer = ctx.viewer;

    if (!viewer.permissions.has("admin.access")) {
      return err("Admin access required.", 403);
    }

    const settings = await repos.gameSettings.effective("samaru-days");

    let credits: Record<string, unknown> = {};
    if (settings?.data?.credits) {
      credits = settings.data.credits;
    }

    // Default credits if none set
    if (Object.keys(credits).length === 0) {
      credits = {
        sections: [
          {
            title: "Developers",
            entries: [{ name: "Muhammad Iliyasu Bugaje", role: "Creator" }],
          },
        ],
        outro: "Thank you for playing {{GAME_NAME}}.",
      };
    }

    return ok({ credits });
  } catch (e) {
    return err(`Failed to read FSLG credits: ${(e as Error).message}`, 500);
  }
}

/** Save credits configuration. */
export async function postFslgCreditsSave(ctx: PlayCtx, body: Record<string, unknown>): Promise<Reply> {
  try {
    const repos = ctx.repos as Repos;
    const viewer = ctx.viewer;

    if (!viewer.permissions.has("admin.access")) {
      return err("Admin access required.", 403);
    }

    const validation = validateCredits(body);
    if (!validation.ok) {
      return err(`Credits validation failed: ${validation.errors.join("; ")}`, 400);
    }

    // Get current settings
    const settings = await repos.gameSettings.effective("samaru-days");
    let existingCredits: Record<string, unknown> = {};
    if (settings?.data?.credits) {
      existingCredits = settings.data.credits;
    }

    // Merge: keep existing sections not being overwritten
    const newCredits: Record<string, unknown> = {
      ...existingCredits,
      ...validation.sanitized,
    };

    // Update the game settings
    await repos.gameSettings.upsert({
      where: { slug: "samaru-days" },
      create: {
        slug: "samaru-days",
        data: newCredits,
        createdAt: new Date(),
      },
      updates: {
        data: { ...(settings?.data || {}), ...newCredits },
        updatedAt: new Date(),
      },
    });

    return ok({ success: true });
  } catch (e) {
    return err(`Failed to save FSLG credits: ${(e as Error).message}`, 500);
  }
}

/** Reset credits to defaults. */
export async function postFslgCreditsReset(ctx: PlayCtx): Promise<Reply> {
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
          sections: [
            {
              title: "Developers",
              entries: [{ name: "Muhammad Iliyasu Bugaje", role: "Creator" }],
            },
          ],
          outro: "Thank you for playing {{GAME_NAME}}.",
        },
      },
      updates: {
        data: {
          sections: [
            {
              title: "Developers",
              entries: [{ name: "Muhammad Iliyasu Bugaje", role: "Creator" }],
            },
          ],
          outro: "Thank you for playing {{GAME_NAME}}.",
        },
      },
    });

    return ok({ success: true, resetToDefaults: true });
  } catch (e) {
    return err(`Failed to reset FSLG credits: ${(e as Error).message}`, 500);
  }
}