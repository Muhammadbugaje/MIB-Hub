/**
 * Users (read side and role changes), roles, permission overrides, the audit
 * log and site settings.
 *
 * Creating users and checking passwords is Better Auth's job, not ours: see
 * apps/web/src/lib/auth.ts.
 */
import { and, asc, count, desc, eq, gt, isNull, or } from "drizzle-orm";
import { auditLog, role, siteSetting, user, userPermissionOverride } from "../schema/index.ts";
import type { AppDb } from "../types.ts";

export type User = typeof user.$inferSelect;
export type Role = typeof role.$inferSelect;
export type AuditEntry = typeof auditLog.$inferSelect;
export type PermissionOverride = typeof userPermissionOverride.$inferSelect;

export function usersRepo(db: AppDb) {
  return {
    async findById(id: string): Promise<User | undefined> {
      return (await db.select().from(user).where(eq(user.id, id)).limit(1))[0];
    },
    async findByEmail(email: string): Promise<User | undefined> {
      return (await db.select().from(user).where(eq(user.email, email.trim().toLowerCase())).limit(1))[0];
    },
    async list(opts: { limit?: number; offset?: number } = {}): Promise<User[]> {
      return db
        .select()
        .from(user)
        .orderBy(asc(user.createdAt))
        .limit(opts.limit ?? 50)
        .offset(opts.offset ?? 0);
    },
    async count(): Promise<number> {
      return (await db.select({ n: count() }).from(user))[0]?.n ?? 0;
    },
    async setRole(id: string, roleKey: string): Promise<void> {
      await db.update(user).set({ role: roleKey, updatedAt: new Date() }).where(eq(user.id, id));
    },
    async setBanned(id: string, banned: boolean): Promise<void> {
      await db.update(user).set({ banned, updatedAt: new Date() }).where(eq(user.id, id));
    },
  };
}

export function rolesRepo(db: AppDb) {
  return {
    async list(): Promise<Role[]> {
      return db.select().from(role).orderBy(desc(role.rank));
    },
    /** Insert or refresh the built-in roles (used by the seed script). */
    async upsertMany(rows: Array<Pick<Role, "key" | "label" | "description" | "rank">>): Promise<void> {
      for (const r of rows) {
        await db
          .insert(role)
          .values({ ...r, builtIn: true })
          .onConflictDoUpdate({
            target: role.key,
            set: { label: r.label, description: r.description, rank: r.rank, updatedAt: new Date() },
          });
      }
    },
  };
}

export function permissionOverridesRepo(db: AppDb) {
  return {
    /** Overrides that count right now (not expired). */
    async listActive(userId: string, now = new Date()): Promise<PermissionOverride[]> {
      return db
        .select()
        .from(userPermissionOverride)
        .where(
          and(
            eq(userPermissionOverride.userId, userId),
            or(isNull(userPermissionOverride.expiresAt), gt(userPermissionOverride.expiresAt, now)),
          ),
        );
    },
    async add(input: {
      userId: string;
      permission: string;
      effect: "grant" | "revoke";
      expiresAt?: Date | null;
      reason?: string;
      createdBy?: string | null;
    }): Promise<PermissionOverride> {
      const rows = await db
        .insert(userPermissionOverride)
        .values({
          userId: input.userId,
          permission: input.permission,
          effect: input.effect,
          expiresAt: input.expiresAt ?? null,
          reason: input.reason ?? "",
          createdBy: input.createdBy ?? null,
        })
        .returning();
      return rows[0]!;
    },
    async remove(id: string): Promise<void> {
      await db.delete(userPermissionOverride).where(eq(userPermissionOverride.id, id));
    },
  };
}

/** Values that must never reach the audit log in plain form. */
const SECRET_KEYS = /(password|code|hash|salt|secret|token)/i;

/** Replace secret-looking fields with "(changed)" before logging. */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SECRET_KEYS.test(k) ? "(changed)" : redact(v)]),
    );
  }
  return value;
}

export function auditRepo(db: AppDb) {
  return {
    async record(entry: {
      actorId: string | null;
      action: string;
      targetType?: string;
      targetId?: string;
      before?: unknown;
      after?: unknown;
      note?: string;
      ip?: string | null;
    }): Promise<AuditEntry> {
      const rows = await db
        .insert(auditLog)
        .values({
          actorId: entry.actorId,
          action: entry.action,
          targetType: entry.targetType ?? "",
          targetId: entry.targetId ?? "",
          before: entry.before === undefined ? null : redact(entry.before),
          after: entry.after === undefined ? null : redact(entry.after),
          note: entry.note ?? "",
          ip: entry.ip ?? null,
        })
        .returning();
      return rows[0]!;
    },
    async list(opts: { limit?: number; targetType?: string; targetId?: string } = {}): Promise<AuditEntry[]> {
      const conditions = [];
      if (opts.targetType) conditions.push(eq(auditLog.targetType, opts.targetType));
      if (opts.targetId) conditions.push(eq(auditLog.targetId, opts.targetId));
      return db
        .select()
        .from(auditLog)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(auditLog.createdAt))
        .limit(opts.limit ?? 50);
    },
  };
}

export function siteSettingsRepo(db: AppDb) {
  return {
    async get<T>(key: string, fallback: T): Promise<T> {
      const rows = await db.select().from(siteSetting).where(eq(siteSetting.key, key)).limit(1);
      return rows[0] ? (rows[0].value as T) : fallback;
    },
    async set(key: string, value: unknown, actorId: string | null = null): Promise<void> {
      await db
        .insert(siteSetting)
        .values({ key, value, updatedBy: actorId })
        .onConflictDoUpdate({ target: siteSetting.key, set: { value, updatedBy: actorId, updatedAt: new Date() } });
    },
    async all(): Promise<Record<string, unknown>> {
      const rows = await db.select().from(siteSetting);
      return Object.fromEntries(rows.map((r) => [r.key, r.value]));
    },
  };
}
