/**
 * Hashing for cheat codes. Uses the Web Crypto API, which exists in Node 20+,
 * in browsers and on Cloudflare Workers, so the same code runs everywhere.
 *
 * Why salted SHA-256 and not scrypt? Cheat codes are checked often during
 * play and are not account passwords; a per-code random salt stops anyone
 * with a copy of the database from matching codes against a list of guesses
 * made once for all rows. Hero codes (which unlock a powerful character)
 * and account passwords use PBKDF2 instead (below): see the heroes repository.
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

/**
 * Check a password against a Django PBKDF2-SHA256 hash, with Web Crypto.
 *
 * The old site's hero hashes use 1,200,000 rounds. Cloudflare Workers refuse
 * more than 100,000 rounds (and that many would blow the free plan's 10 ms
 * CPU limit anyway), so on the live site such a hash can never match: it
 * returns false instead of crashing. On Node (npm run dev) it works, and the
 * caller re-hashes to the cheap format on first correct use.
 */
export async function verifyDjangoPbkdf2(stored: string, password: string): Promise<boolean> {
  const [algo, iterText, salt, expected] = stored.split("$");
  const iterations = Number(iterText);
  if (algo !== "pbkdf2_sha256" || !salt || !expected || !Number.isFinite(iterations) || iterations < 1) return false;
  try {
    const bits = await pbkdf2Bits(password, new TextEncoder().encode(salt), iterations, false);
    const b64 = btoa(String.fromCharCode(...bits));
    return safeEqual(b64, expected);
  } catch (err) {
    console.warn(`[crypto] could not check a Django hash with ${iterations} rounds here: ${(err as Error).message}`);
    return false;
  }
}

/* ------------------------------------------------- account passwords */

/**
 * Passwords (accounts and hero codes): PBKDF2-SHA256 through Web Crypto,
 * which is built into Cloudflare Workers (native code), Node and browsers.
 *
 * Stored as "pbkdf2-sha256$<rounds>$<salt hex>$<hash hex>". The dash keeps
 * it apart from the old Django hashes ("pbkdf2_sha256$..."), and the rounds
 * are written into each hash, so PBKDF2_ITERATIONS can be raised later: older
 * hashes still check, and are upgraded at the next correct sign-in.
 *
 * Why 20,000 rounds: the Workers Free plan stops a request after 10 ms of CPU
 * time, and Workers refuse more than 100,000 rounds. 20,000 rounds leaves room
 * for the rest of the sign-in inside that budget (measured figures in
 * docs/DEPLOY_CLOUDFLARE.md). OWASP asks for 600,000 for PBKDF2-SHA256, so
 * these hashes are cheaper to guess if the database ever leaked: see
 * docs/DEPLOY_CLOUDFLARE.md "Passwords" for the trade-off.
 */
export const PBKDF2_ITERATIONS = 20_000;
export const PBKDF2_PREFIX = "pbkdf2-sha256";
/** Workers' own ceiling for PBKDF2 rounds. */
export const PBKDF2_MAX_ITERATIONS = 100_000;

async function pbkdf2Bits(password: string, salt: Uint8Array, iterations: number, normalise = true): Promise<Uint8Array> {
  const text = normalise ? password.normalize("NFKC") : password;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(text), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as Uint8Array<ArrayBuffer>, iterations }, key, 256);
  return new Uint8Array(bits);
}

function fromHex(hex: string): Uint8Array | null {
  if (!/^(?:[0-9a-f]{2})+$/.test(hex)) return null;
  return Uint8Array.from(hex.match(/../g) ?? [], (h) => parseInt(h, 16));
}

/** Hash a password: "pbkdf2-sha256$<rounds>$<salt>$<hash>". */
export async function hashPbkdf2(password: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `${PBKDF2_PREFIX}$${iterations}$${toHex(salt)}$${toHex(await pbkdf2Bits(password, salt, iterations))}`;
}

/** Is this one of our PBKDF2 hashes? */
export function isPbkdf2Hash(stored: string): boolean {
  return stored.startsWith(`${PBKDF2_PREFIX}$`);
}

/** The rounds written into one of our PBKDF2 hashes (0 when it is not one). */
export function pbkdf2Iterations(stored: string): number {
  if (!isPbkdf2Hash(stored)) return 0;
  const n = Number(stored.split("$")[1]);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

/** Check a password against one of our PBKDF2 hashes. */
export async function verifyPbkdf2(stored: string, password: string): Promise<boolean> {
  const [prefix, , saltHex, hashHex] = stored.split("$");
  const iterations = pbkdf2Iterations(stored);
  const salt = fromHex(saltHex ?? "");
  if (prefix !== PBKDF2_PREFIX || !salt || !hashHex || iterations < 1 || iterations > PBKDF2_MAX_ITERATIONS) return false;
  return safeEqual(toHex(await pbkdf2Bits(password, salt, iterations)), hashHex);
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
