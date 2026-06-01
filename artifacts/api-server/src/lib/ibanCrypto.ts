/**
 * IBAN Encryption Module — AES-256-GCM
 *
 * Key management rules:
 *   - IBAN_SECRET is independent of JWT_SECRET and SESSION_SECRET.
 *   - Production: IBAN_SECRET is mandatory (startup validation enforced by secrets.ts).
 *   - Development: falls back to a built-in dev key with a console warning.
 *   - Minimum raw key length: 32 characters (enforced at startup by secrets.ts).
 *
 * Key rotation:
 *   - New key → set IBAN_SECRET to new value, move old value to IBAN_SECRET_PREV.
 *   - The module tries IBAN_SECRET first; if GCM auth-tag fails, retries with
 *     IBAN_SECRET_PREV (decryption only). Re-encrypt on next write to migrate.
 *   - Once all rows are migrated, remove IBAN_SECRET_PREV.
 *   - Encrypted format includes the `enc:v1:` version prefix so future algorithm
 *     upgrades can be introduced as `enc:v2:` without breaking existing records.
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm" as const;
const ENC_PREFIX = "enc:v1:";
const DEV_FALLBACK_KEY = "dev-iban-key-32-bytes-change-me!!!!!!!";

function resolveRawKey(envVarName: string): string | null {
  return process.env[envVarName] ?? null;
}

function deriveKey(raw: string): Buffer {
  return crypto.createHash("sha256").update(raw).digest();
}

function getActiveKey(): Buffer {
  const raw = resolveRawKey("IBAN_SECRET") ?? DEV_FALLBACK_KEY;
  return deriveKey(raw);
}

function getPrevKey(): Buffer | null {
  const raw = resolveRawKey("IBAN_SECRET_PREV");
  return raw ? deriveKey(raw) : null;
}

// ─── Encrypt ──────────────────────────────────────────────────────────────────

export function encryptIban(plaintext: string): string {
  if (!plaintext) return plaintext;
  if (plaintext.startsWith(ENC_PREFIX)) return plaintext;

  const key = getActiveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, tag, encrypted]);
  return ENC_PREFIX + combined.toString("base64");
}

// ─── Decrypt ──────────────────────────────────────────────────────────────────

export function decryptIban(ciphertext: string | null | undefined): string | undefined {
  if (!ciphertext) return undefined;
  if (!ciphertext.startsWith(ENC_PREFIX)) return ciphertext; // legacy plaintext

  const keysToTry: Buffer[] = [getActiveKey()];
  const prev = getPrevKey();
  if (prev) keysToTry.push(prev);

  const raw = Buffer.from(ciphertext.slice(ENC_PREFIX.length), "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);

  for (const key of keysToTry) {
    try {
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      return decipher.update(encrypted) + decipher.final("utf8");
    } catch {
      // Try next key
    }
  }

  console.error(
    "[IBAN] Decryption failed for all available keys. " +
      "If you rotated IBAN_SECRET, set IBAN_SECRET_PREV to the old value.",
  );
  return undefined;
}
