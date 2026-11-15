import { describe, expect, it } from "vitest";
import { checkAccess, guard, guardApi, safeNext, type Viewer } from "../src/lib/guard.ts";
import { effectivePermissions } from "../src/lib/permissions.ts";

function viewer(role: string | null): Viewer {
  if (!role) return { user: null, role: "guest", permissions: effectivePermissions("guest") };
  return {
    user: { id: "u1", name: "Test User", email: "t@example.test", role },
    role,
    permissions: effectivePermissions(role),
  };
}

/** A fake Astro context that records what the guard asked for. */
function fakeAstro(v: Viewer, path = "/admin?tab=games") {
  const calls: string[] = [];
  return {
    calls,
    ctx: {
      locals: { viewer: v },
      url: new URL(`http://localhost${path}`),
      redirect: (to: string, status = 302) => {
        calls.push(`redirect ${status} ${to}`);
        return new Response(null, { status, headers: { Location: to } });
      },
      rewrite: async (to: string) => {
        calls.push(`rewrite ${to}`);
        return new Response(null, { status: 403 });
      },
    },
  };
}

describe("checkAccess", () => {
  it("lets anyone through when nothing is required", () => {
    expect(checkAccess(viewer(null), {}, "/")).toEqual({ allowed: true });
  });

  it("sends signed-out visitors to sign in, and back afterwards", () => {
    expect(checkAccess(viewer(null), { signedIn: true }, "/account/profile")).toEqual({
      allowed: false,
      reason: "signed-out",
      redirectTo: "/auth/sign-in?next=%2Faccount%2Fprofile",
    });
  });

  it("treats a permission requirement as also needing sign-in", () => {
    expect(checkAccess(viewer(null), { permission: "admin.access" }, "/admin")).toMatchObject({ reason: "signed-out" });
  });

  it("forbids signed-in users without the permission", () => {
    expect(checkAccess(viewer("player"), { permission: "admin.access" }, "/admin")).toEqual({ allowed: false, reason: "forbidden" });
    expect(checkAccess(viewer("moderator"), { permission: "admin.access" }, "/admin")).toEqual({ allowed: true });
  });

  it("supports any-of requirements", () => {
    expect(checkAccess(viewer("moderator"), { anyOf: ["games.manage", "audit.view"] }, "/")).toEqual({ allowed: true });
    expect(checkAccess(viewer("player"), { anyOf: ["games.manage", "audit.view"] }, "/")).toMatchObject({ reason: "forbidden" });
  });
});

describe("guard (page helper)", () => {
  it("returns null when allowed", () => {
    const { ctx, calls } = fakeAstro(viewer("owner"));
    expect(guard(ctx, { permission: "site.settings" })).toBeNull();
    expect(calls).toEqual([]);
  });

  it("redirects signed-out visitors with the page they wanted", async () => {
    const { ctx, calls } = fakeAstro(viewer(null));
    const res = await guard(ctx, { permission: "admin.access" });
    expect(res?.status).toBe(303);
    expect(calls).toEqual(["redirect 303 /auth/sign-in?next=%2Fadmin%3Ftab%3Dgames"]);
  });

  it("shows the 403 page to signed-in users without permission", async () => {
    const { ctx, calls } = fakeAstro(viewer("player"));
    const res = await guard(ctx, { permission: "admin.access" });
    expect(res?.status).toBe(403);
    expect(calls).toEqual(["rewrite /403"]);
  });
});

describe("guardApi", () => {
  it("answers 401 for signed-out and 403 for missing permission", async () => {
    expect(guardApi(viewer(null), { signedIn: true })?.status).toBe(401);
    expect(guardApi(viewer("player"), { permission: "users.manage" })?.status).toBe(403);
    expect(guardApi(viewer("admin"), { permission: "users.manage" })).toBeNull();
  });
});

describe("safeNext", () => {
  it("only allows paths on this site", () => {
    expect(safeNext("/play/momentum-cup")).toBe("/play/momentum-cup");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext(null, "/home")).toBe("/home");
  });
});
