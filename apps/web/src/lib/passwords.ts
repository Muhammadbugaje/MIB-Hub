/**
 * Password hashing for accounts (Better Auth) and hero codes.
 *
 * New hashes: PBKDF2-SHA256 via Web Crypto (packages/db/src/crypto.ts), which
 * fits inside the Cloudflare Workers Free plan's 10 ms CPU limit per request.
 *
 * Older hashes still sign in, and are replaced by a fresh PBKDF2 hash at that
 * moment (`needsRehash`):
 *   - scrypt "salt:key" (Better Auth's default, used before 16 Nov 2026);
 *     checking one costs far more than 10 ms, so it may fail once on the
 *     free plan: re-hash live accounts ahead of time (scripts/owner-password-sql.ts);
 *   - PBKDF2 with fewer rounds than PBKDF2_ITERATIONS (if it is ever raised);
 *   - Django "pbkdf2_sha256$..." (old site hero codes; Node only, see crypto.ts).
 */
import { hashPbkdf2, isDjangoHash, isPbkdf2Hash, pbkdf2Iterations, PBKDF2_ITERATIONS, verifyDjangoPbkdf2, verifyPbkdf2 } from "@mib/db";
import { verifyPassword as verifyScrypt } from "better-auth/crypto";

/** Better Auth's scrypt format: "<salt hex>:<key hex>". */
export function isScryptHash(stored: string): boolean {
  return /^[0-9a-f]+:[0-9a-f]+$/.test(stored);
}

export function hashPassword(plain: string): Promise<string> {
  return hashPbkdf2(plain);
}

export async function verifyPassword(stored: string, plain: string): Promise<boolean> {
  if (!stored || typeof plain !== "string") return false;
  if (isPbkdf2Hash(stored)) return verifyPbkdf2(stored, plain);
  if (isDjangoHash(stored)) return verifyDjangoPbkdf2(stored, plain);
  if (isScryptHash(stored)) {
    try {
      return await verifyScrypt({ hash: stored, password: plain });
    } catch {
      return false;
    }
  }
  return false;
}

/** Should a hash that just matched be swapped for a fresh PBKDF2 one? */
export function needsRehash(stored: string): boolean {
  return !isPbkdf2Hash(stored) || pbkdf2Iterations(stored) < PBKDF2_ITERATIONS;
}

/** The hasher the repositories use for hero codes (packages/db PasswordHasher). */
export const passwordHasher = {
  hash: hashPassword,
  verify: verifyPassword,
  needsRehash,
};
