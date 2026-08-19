/**
 * Shared-passphrase gate.
 *
 * The cookie doesn't store the passphrase — it stores an HMAC derived from it.
 * Someone who steals the cookie gets in, but they don't learn the passphrase
 * itself, and changing LEVIATHAN_PASSPHRASE invalidates every cookie at once.
 *
 * This is one shared secret for everyone, not per-user accounts. It exists to
 * stop strangers from spending your API balance — not to tell two people apart.
 *
 * TODO(you): real sign-in is the upgrade. Once you have it, collections can be
 * per-user and RLS can go on in Supabase.
 */

export const GATE_COOKIE = "lev_gate";

const MESSAGE = "leviathan-gate-v1";

/** Derive the cookie value from the passphrase. Same input, same output. */
export async function gateToken(passphrase: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(MESSAGE));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compare without leaking timing. A plain `a === b` returns faster the earlier
 * it finds a mismatch, which is measurable over enough requests and lets an
 * attacker recover the value one character at a time.
 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
