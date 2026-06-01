/**
 * IBAN Encryption Module — AES-256-GCM
 *
 * Key management rules:
 *   - IBAN_SECRET must be set independently of SESSION_SECRET.
 *   - Production: IBAN_SECRET is mandatory. Missing key = startup crash.
 *   - Development: falls back to a built-in dev key with a console warning.
 *   - Minimum raw key length: 32 characters (256 bits before SHA-256 derivation).
 *
 * Key rotation:
 *   - New key → set IBAN_SECRET to new value, move old value to IBAN_SECRET_PREV.
 *   - The module tries IBAN_SECRET first; if GCM auth-tag fails, it retries with
 *     IBAN_SECRET_PREV (decryption only). Re-encrypt on next write to migrate.
 *   - Once all rows are migrated, remove IBAN_SECRET_PREV.
 *   - Encrypted format includes the `enc:v1:` version prefix so future algorithm
 *     upgrades can be introduced as `enc:v2:` without breaking existing records.
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm" as const;
const ENC_PREFIX = "enc:v1:";
const MIN_KEY_LENGTH = 32;
const DEV_FALLBACK_KEY = "dev-iban-key-32-bytes-change-me!";
const IS_PRODUCTION = process.env["NODE_ENV"] === "production";

// ─── Key resolution with validation ──────────────────────────────────────────

function resolveKey(envVarName: "IBAN_SECRET" | "IBAN_SECRET_PREV"): Buffer | null {
  const raw = process.env[envVarName];
  if (!raw) return null;
  return deriveKey(raw);
}

function deriveKey(raw: string): Buffer {
  return crypto.createHash("sha256").update(raw).digest();
}

/**
 * Returns the active encryption key.
 * Throws in production if IBAN_SECRET is missing.
 * Warns in development if using fallback.
 */
export function getActiveKey(): Buffer {
  const raw = process.env["IBAN_SECRET"];

  if (!raw) {
    if (IS_PRODUCTION) {
      throw new Error(
        "[IBAN] FATAL: IBAN_SECRET environment variable is not set. " +
          "Set it in Replit Secrets before deploying to production.",
      );
    }
    // Development fallback — always warn
    console.warn(
      "[IBAN] WARNING: IBAN_SECRET is not set. Using insecure development fallback key. " +
        "This MUST be replaced before production deployment.",
    );
    return deriveKey(DEV_FALLBACK_KEY);
  }

  if (raw.length < MIN_KEY_LENGTH) {
    const msg =
      `[IBAN] ${IS_PRODUCTION ? "FATAL" : "WARNING"}: ` +
      `IBAN_SECRET is too short (${raw.length} chars, minimum ${MIN_KEY_LENGTH}). ` +
      "Use a cryptographically random value of at least 32 characters.";
    if (IS_PRODUCTION) throw new Error(msg);
    console.warn(msg);
  }

  return deriveKey(raw);
}

// ─── Startup validation (call once from index.ts) ─────────────────────────────

export function validateIbanSecretAtStartup(): void {
  const raw = process.env["IBAN_SECRET"];
  const prev = process.env["IBAN_SECRET_PREV"];

  if (!raw) {
    if (IS_PRODUCTION) {
      throw new Error(
        "[IBAN] STARTUP FAILURE: IBAN_SECRET is required in production. " +
          "Add it via Replit Secrets and redeploy.",
      );
    }
    console.warn(
      "[IBAN] Development mode: IBAN_SECRET not set — using built-in fallback key. " +
        "All IBAN values encrypted with this key CANNOT be decrypted in production " +
        "without setting the same fallback string as IBAN_SECRET.",
    );
    return;
  }

  if (raw.length < MIN_KEY_LENGTH) {
    const msg =
      `[IBAN] IBAN_SECRET is weak (${raw.length}/${MIN_KEY_LENGTH} minimum chars). ` +
      "Replace with a 32+ character random string.";
    if (IS_PRODUCTION) throw new Error(msg);
    console.warn(msg);
  } else {
    console.info("[IBAN] IBAN_SECRET validated ✓");
  }

  if (prev) {
    console.info(
      "[IBAN] IBAN_SECRET_PREV detected — key rotation in progress. " +
        "Re-encrypt all IBAN rows and then remove IBAN_SECRET_PREV.",
    );
  }
}

// ─── Encrypt ──────────────────────────────────────────────────────────────────

export function encryptIban(plaintext: string): string {
  if (!plaintext) return plaintext;
  // Already encrypted — do not double-encrypt
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
  // Not encrypted (legacy plaintext row) — return as-is
  if (!ciphertext.startsWith(ENC_PREFIX)) return ciphertext;

  // Try active key first, then previous key (rotation support)
  const keysToTry: Buffer[] = [getActiveKey()];
  const prevKey = resolveKey("IBAN_SECRET_PREV");
  if (prevKey) keysToTry.push(prevKey);

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
      "If you rotated IBAN_SECRET, ensure IBAN_SECRET_PREV contains the old key.",
  );
  return undefined;
}
