/**
 * Hashing for cheat codes. Uses the Web Crypto API, which exists in Node 20+,
 * in browsers and on Cloudflare Workers, so the same code runs everywhere.
 *
 * Why salted SHA-256 and not scrypt? Cheat codes are checked often during
 * play and are not account passwords; a per-code random salt stops anyone
 * with a copy of the database from matching codes against a list of guesses
 * made once for all rows. Hero codes (which unlock a powerful character)
 * use real password hashing (scrypt) instead: see the heroes repository.
 */

/** How codes are compared: lower-cased, all whitespace removed (Django cheats.norm). */
export function normaliseCode(code: string): string {
  return String(code ?? "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** A new random salt (16 bytes, hex). */
export function newSalt(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(16)));
}

/** sha256(salt + ":" + gameSlug + ":" + normalised code), as hex. */
export async function hashCode(gameSlug: string, code: string, salt: string): Promise<string> {
  const input = new TextEncoder().encode(`${salt}:${gameSlug}:${normaliseCode(code)}`);
  return toHex(await crypto.subtle.digest("SHA-256", input));
}

/** Compare two hex strings in constant time (no early exit that leaks timing). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyCode(gameSlug: string, code: string, salt: string, expectedHash: string): Promise<boolean> {
  return safeEqual(await hashCode(gameSlug, code, salt), expectedHash);
}
