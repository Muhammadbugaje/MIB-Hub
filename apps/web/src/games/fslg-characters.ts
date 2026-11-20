/** FSLG Characters management – per-NPC editor for appearance, attitude, voice, lines, barks.
 *
 *  Docs: docs/MASTER_GAME_GUIDE.md §5.4, docs/port/MANAGEMENT.md A10
 *
 *  Each NPC in D.NPCS has a `def` with fields:
 *    look: { skin, hair, hairCol, top, fit: { acc, hair }, mode }
 *    attitude: { preset, mood, bump, hit, honk }
 *    voice: { sex, pitch, tone, role }
 *    barks: { kind: [lines] }  (kind: hit, bump, honk, flee, fight, yield)
 *    lines: { [key: string]: text }  (spoken lines keyed by normalized text)
 *
 *  API:
 *    GET  /arcade/api/fslg/characters      – read all NPC definitions (super admin)
 *    POST /arcade/api/fslg/characters/save   – save NPC changes (super admin)
 *    POST /arcade/api/fslg/characters/reset  – reset all to defaults
 */

import { ok, err } from "./arcade-api.ts";
import type { PlayCtx } from "./arcade-api.ts";
import type { Repos } from "@mib/db";
import { v4 as uuidv4 } from "node:uuid";

/** Character look fields */
const HAIRS = (
  "low fade bald waves afro afrobig coily cornrows twists braidshort braids locs bun"
).split(" ");
const MODES = ("tee kaftan jersey coat".split(" "));
const PRESETS = (
  "friendly grumpy funny shy serious flirty calm loud wise proud"
).split(" ");
const MOODS = ("flee hit_back stand_up".split(" "));
const VOICE_ROLES = (
  ""
).split(""); // extended in validate_character

/** Validate a character definition */
function validateCharacter(d: Record<string, unknown>): { ok: boolean; errors: string[]; sanitized: Record<string, unknown> } {
  const errors: string[] = [];
  const s: Record<string, unknown> = {};

  // name
  if (d.name !== undefined && d.name !== null) {
    const name = String(d.name).slice(0, 40).trim();
    if (!name) errors.push("Character name is required.");
    else s.name = name;
  }

  // role
  if (d.role !== undefined && d.role !== null) {
    const role = String(d.role).slice(0, 60).trim();
    s.role = role;
  }

  // look
  if (d.look) {
    const lk = d.look;
    if (lk.skin !== undefined) s.look = { ...s.look, skin: String(lk.skin).slice(0, 30) };
    if (lk.hair !== undefined) {
      const hair = String(lk.hair);
      if (HAIRS.includes(hair)) s.look = { ...s.look, hair };
      else errors.push(`Hair style must be one of: ${HAIRS.join(", ")}`);
    }
    if (lk.hairCol !== undefined) {
      const col = String(lk.hairCol);
      if (/^#[0-9a-fA-F]{6}$/.test(col)) s.look = { ...s.look, hairCol: col.toLowerCase() };
      else errors.push("Hair colour must be a hex color like #ff0000");
    }
    if (lk.top !== undefined) s.look = { ...s.look, top: String(lk.top).slice(0, 30) };
    if (lk.mode !== undefined) {
      const mode = String(lk.mode);
      if (MODES.includes(mode)) s.look = { ...s.look, mode };
      else errors.push(`Mode must be one of: ${MODES.join(", ")}`);
    }
    if (lk.fit !== undefined) {
      const fit = lk.fit;
      if (typeof fit === "object") {
        s.look = { ...s.look, fit: { acc: (fit.acc || []).slice(0, 3).map((x: string) => String(x).slice(0, 24)), hair: String(fit.hair || "low") } };
      } else {
        s.look = { ...s.look, fit: { acc: [], hair: String(fit || "low") } };
      }
    }
  }

  // attitude
  if (d.attitude) {
    const at = d.attitude;
    if (at.preset !== undefined) {
      const preset = String(at.preset);
      if (PRESETS.includes(preset)) s.attitude = { ...s.attitude, preset };
      else errors.push(`Preset must be one of: ${PRESETS.join(", ")}`);
    }
    if (at.mood !== undefined) {
      const mood = String(at.mood);
      if (MOODS.includes(mood)) s.attitude = { ...s.attitude, mood };
      else errors.push(`Mood must be one of: ${MOODS.join(", ")}`);
    }
    if (at.bump !== undefined) s.attitude = { ...s.attitude, bump: String(at.bump) };
    if (at.hit !== undefined) s.attitude = { ...s.attitude, hit: String(at.hit) };
    if (at.honk !== undefined) s.attitude = { ...s.attitude, honk: String(at.honk) };
  }

  // voice
  if (d.voice) {
    const vo = d.voice;
    if (vo.sex !== undefined && vo.sex !== null) {
      const sex = String(vo.sex).toLowerCase();
      if (sex === "male" || sex === "female") s.voice = { ...s.voice, sex };
      else errors.push("Voice sex must be 'male' or 'female'");
    }
    if (vo.pitch !== undefined) {
      const pitch = Number(vo.pitch);
      if (!isNaN(pitch) && pitch > 0 && pitch <= 2) s.voice = { ...s.voice, pitch: Math.round(pitch * 1000) / 1000 };
      else errors.push("Pitch must be between 0 and 2");
    }
    if (vo.tone !== undefined) {
      const tone = String(vo.tone);
      if (/^(deep|warm|natural|bright)$/.test(tone)) s.voice = { ...s.voice, tone };
      else errors.push("Tone must be one of: deep, warm, natural, bright");
    }
    if (vo.role !== undefined) {
      const role = String(vo.role);
      // extend VOICE_ROLES dynamically
      VOICE_ROLES.push(role);
      s.voice = { ...s.voice, role };
    }
  }

  // barks
  if (d.barks && typeof d.barks === "object") {
    s.barks = {};
    for (const [kind, lines] of Object.entries(d.barks) as [string, string][]) {
      const kindLower = kind.toLowerCase();
      if (kindLower === "hit" || kindLower === "bump" || kindLower === "honk" || kindLower === "flee" || kindLower === "fight" || kindLower === "yield") {
        // Validate each line ≤ 120 chars
        const validLines: string[] = [];
        const arr = Array.isArray(lines) ? lines : [lines];
        for (const line of arr) {
          const txt = String(line).slice(0, 120).trim();
          if (txt) validLines.push(txt);
        }
        if (validLines.length > 0) s.barks = { ...s.barks, [kindLower]: validLines };
      }
    }
    if (Object.keys(s.barks).length === 0) delete s.barks;
  }

  // lines (spoken lines)
  if (d.lines && typeof d.lines === "object") {
    const entries: [string, string][] = [];
    for (const [key, value] of Object.entries(d.lines) as [string, unknown][]) {
      if (typeof value === "string") {
        const txt = String(value).slice(0, 400).trim();
        if (txt) entries.push([key, txt]);
      }
    }
    if (entries.length > 0) s.lines = Object.fromEntries(entries);
  }

  return {
    ok: errors.length === 0,
    errors,
    sanitized: s,
  };
}

/** Read all NPC definitions from the database. */
export async function getFslgCharacters(ctx: PlayCtx): Promise<Reply> {
  try {
    const repos = ctx.repos as Repos;
    const viewer = ctx.viewer;

    if (!viewer.permissions.has("admin.access")) {
      return err("Admin access required.", 403);
    }

    // Get all NPC definitions from the game data
    // In the DB, we store them in gameSettings or a dedicated table
    // For now, read from the effective game settings
    const settings = await repos.gameSettings.effective("samaru-days");

    let npcs: Record<string, unknown> = {};
    if (settings?.data?.npcs) {
      npcs = settings.data.npcs;
    }

    // If no NPCs in settings, return empty (game will use its own defaults)
    if (Object.keys(npcs).length === 0) {
      return ok({ npcs: {}, count: 0 });
    }

    return ok({ npcs, count: Object.keys(npcs).length });
  } catch (e) {
    return err(`Failed to read FSLG characters: ${(e as Error).message}`, 500);
  }
}

/** Save NPC character changes. */
export async function postFslgCharactersSave(ctx: PlayCtx, body: Record<string, unknown>): Promise<Reply> {
  try {
    const repos = ctx.repos as Repos;
    const viewer = ctx.viewer;

    if (!viewer.permissions.has("admin.access")) {
      return err("Admin access required.", 403);
    }

    const { key, data } = body as { key: string; data: Record<string, unknown> };

    if (!key || !data) {
      return err("NPC key and data are required.", 400);
    }

    // Validate the character data
    const validation = validateCharacter(data);
    if (!validation.ok) {
      return err(`Character validation failed: ${validation.errors.join("; ")}`, 400);
    }

    // Get current settings
    const settings = await repos.gameSettings.effective("samaru-days");
    let npcs: Record<string, unknown> = {};
    if (settings?.data?.npcs) {
      npcs = { ...settings.data.npcs };
    }

    // Save or update the NPC
    npcs[key] = validation.sanitized;

    // Update the game settings
    await repos.gameSettings.upsert({
      where: { slug: "samaru-days" },
      create: {
        slug: "samaru-days",
        data: { npcs },
        createdAt: new Date(),
      },
      updates: {
        data: { npcs },
        updatedAt: new Date(),
      },
    });

    return ok({ success: true, key, count: Object.keys(npcs).length });
  } catch (e) {
    return err(`Failed to save FSLG character: ${(e as Error).message}`, 500);
  }
}

/** Reset all NPC characters to defaults. */
export async function postFslgCharactersReset(ctx: PlayCtx): Promise<Reply> {
  try {
    const repos = ctx.repos as Repos;
    const viewer = ctx.viewer;

    if (!viewer.permissions.has("admin.access")) {
      return err("Admin access required.", 403);
    }

    // Reset NPCs to empty (game will use its own defaults)
    await repos.gameSettings.upsert({
      where: { slug: "samaru-days" },
      create: {
        slug: "samaru-days",
        data: { npcs: {} },
        createdAt: new Date(),
      },
      updates: {
        data: { npcs: {} },
        updatedAt: new Date(),
      },
    });

    return ok({ success: true, reset: true });
  } catch (e) {
    return err(`Failed to reset FSLG characters: ${(e as Error).message}`, 500);
  }
}