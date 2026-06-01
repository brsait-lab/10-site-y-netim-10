import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const ENC_PREFIX = "enc:v1:";

function getKey(): Buffer {
  const raw = process.env["IBAN_SECRET"] ?? process.env["SESSION_SECRET"] ?? "dev-iban-key-32-bytes-change-me!";
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptIban(plaintext: string): string {
  if (!plaintext || plaintext.startsWith(ENC_PREFIX)) return plaintext;

  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, tag, encrypted]);
  return ENC_PREFIX + combined.toString("base64");
}

export function decryptIban(ciphertext: string | null | undefined): string | undefined {
  if (!ciphertext) return undefined;
  if (!ciphertext.startsWith(ENC_PREFIX)) return ciphertext;

  try {
    const key = getKey();
    const combined = Buffer.from(ciphertext.slice(ENC_PREFIX.length), "base64");

    const iv = combined.subarray(0, 12);
    const tag = combined.subarray(12, 28);
    const encrypted = combined.subarray(28);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    return decipher.update(encrypted) + decipher.final("utf8");
  } catch {
    return undefined;
  }
}
