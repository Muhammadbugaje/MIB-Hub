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

/**
 * Marker salt for codes imported from the old Django site, which stored
 * sha256(gameSlug + ":" + normalised code) with no salt (games/cheats.py sha()).
 * Such rows are upgraded to a fresh random salt the first time the code is
 * used correctly (see cheatsRepo.match), so nobody has to reset a code.
 */
export const LEGACY_SALT = "legacy-sha256";

/** sha256(salt + ":" + gameSlug + ":" + normalised code), as hex (legacy rows: no salt). */
export async function hashCode(gameSlug: string, code: string, salt: string): Promise<string> {
  const text = salt === LEGACY_SALT ? `${gameSlug}:${normaliseCode(code)}` : `${salt}:${gameSlug}:${normaliseCode(code)}`;
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

/** Is this a Django PBKDF2 password hash ("pbkdf2_sha256$iterations$salt$hash")? */
export function isDjangoHash(stored: string): boolean {
  return stored.startsWith("pbkdf2_sha256$");
}

/** Check a password against a Django PBKDF2-SHA256 hash, with Web Crypto. */
export async function verifyDjangoPbkdf2(stored: string, password: string): Promise<boolean> {
  const [algo, iterText, salt, expected] = stored.split("$");
  const iterations = Number(iterText);
  if (algo !== "pbkdf2_sha256" || !salt || !expected || !Number.isFinite(iterations) || iterations < 1) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations }, key, 256);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(bits)));
  return safeEqual(b64, expected);
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
