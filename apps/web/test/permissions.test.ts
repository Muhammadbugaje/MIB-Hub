import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSIONS,
  ROLES,
  ROLE_INFO,
  ROLE_PERMISSIONS,
  assignableRoles,
  canManageRole,
  effectivePermissions,
} from "../src/lib/permissions.ts";

describe("role -> permission map", () => {
  it("gives the owner every permission", () => {
    expect([...effectivePermissions("owner")].sort()).toEqual([...ALL_PERMISSIONS].sort());
  });

  it("only lists known permissions", () => {
    for (const role of ROLES) for (const p of ROLE_PERMISSIONS[role]) expect(ALL_PERMISSIONS).toContain(p);
  });

  it("is cumulative: each role holds everything the role below holds", () => {
    const ladder = ["guest", "player", "moderator", "admin", "owner"] as const;
    for (let i = 1; i < ladder.length; i++) {
      const lower = effectivePermissions(ladder[i - 1]!);
      const higher = effectivePermissions(ladder[i]!);
      for (const p of lower) expect(higher.has(p), `${ladder[i]} should have ${p}`).toBe(true);
      expect(ROLE_INFO[ladder[i]!].rank).toBeGreaterThan(ROLE_INFO[ladder[i - 1]!].rank);
    }
  });

  it("keeps the admin area away from players and guests", () => {
    expect(effectivePermissions("player").has("admin.access")).toBe(false);
    expect(effectivePermissions("guest").has("admin.access")).toBe(false);
    expect(effectivePermissions("moderator").has("admin.access")).toBe(true);
  });

  it("maps the old Django game permissions", () => {
    // games.manage_game_settings -> games.manage_settings: admins, not moderators
    expect(effectivePermissions("admin").has("games.manage_settings")).toBe(true);
    expect(effectivePermissions("moderator").has("games.manage_settings")).toBe(false);
    // staff preview of disabled games
    expect(effectivePermissions("moderator").has("games.preview")).toBe(true);
    expect(effectivePermissions("player").has("games.preview")).toBe(false);
    // only the owner hands out single permissions
    expect(effectivePermissions("admin").has("roles.manage")).toBe(false);
  });

  it("treats an unknown role as a plain player", () => {
    expect(effectivePermissions("wizard")).toEqual(effectivePermissions("player"));
  });
});

describe("personal overrides", () => {
  const now = new Date("2026-11-15T12:00:00Z");

  it("adds grants and removes revokes", () => {
    const perms = effectivePermissions(
      "player",
      [
        { permission: "audit.view", effect: "grant" },
        { permission: "scores.submit", effect: "revoke" },
      ],
      now,
    );
    expect(perms.has("audit.view")).toBe(true);
    expect(perms.has("scores.submit")).toBe(false);
  });

  it("lets a revoke beat a grant of the same permission", () => {
    const perms = effectivePermissions(
      "player",
      [
        { permission: "audit.view", effect: "revoke" },
        { permission: "audit.view", effect: "grant" },
      ],
      now,
    );
    expect(perms.has("audit.view")).toBe(false);
  });

  it("ignores expired overrides and unknown permission names", () => {
    const perms = effectivePermissions(
      "player",
      [
        { permission: "audit.view", effect: "grant", expiresAt: new Date("2026-11-14T00:00:00Z") },
        { permission: "made.up", effect: "grant" },
      ],
      now,
    );
    expect(perms.has("audit.view")).toBe(false);
    expect(perms.size).toBe(ROLE_PERMISSIONS.player.length);
  });

  it("cannot take anything from the owner", () => {
    expect(effectivePermissions("owner", [{ permission: "admin.access", effect: "revoke" }], now).has("admin.access")).toBe(true);
  });
});

describe("who may manage whom", () => {
  it("only lets a higher rank manage a lower one", () => {
    expect(canManageRole("admin", "moderator")).toBe(true);
    expect(canManageRole("admin", "admin")).toBe(false);
    expect(canManageRole("moderator", "admin")).toBe(false);
    expect(canManageRole("owner", "owner")).toBe(true);
    expect(canManageRole("nobody", "player")).toBe(false);
  });

  it("never offers a role at or above your own (except to the owner)", () => {
    expect(assignableRoles("admin")).toEqual(["moderator", "player"]);
    expect(assignableRoles("owner")).toEqual(["owner", "admin", "moderator", "player"]);
    expect(assignableRoles("player")).toEqual([]);
  });
});
