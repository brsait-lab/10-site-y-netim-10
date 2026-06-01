/**
 * Central secrets validation module.
 * Call validateAllSecrets() once at startup (index.ts).
 *
 * Rules enforced:
 *   - Each secret (JWT_SECRET, SESSION_SECRET, IBAN_SECRET) must be set in production.
 *   - Each secret must be at least 32 characters.
 *   - All three must be DISTINCT from each other (runtime value comparison).
 *   - In development, missing/weak secrets emit warnings instead of crashing.
 */

const IS_PRODUCTION = process.env["NODE_ENV"] === "production";
const MIN_LENGTH = 32;

interface SecretSpec {
  envKey: string;
  label: string;
  devFallback: string;
}

const SECRETS: SecretSpec[] = [
  {
    envKey: "JWT_SECRET",
    label: "JWT imzalama anahtarı",
    devFallback: "dev-jwt-secret-change-me-before-prod!!",
  },
  {
    envKey: "SESSION_SECRET",
    label: "Oturum anahtarı",
    devFallback: "dev-session-secret-change-me-before-prod",
  },
  {
    envKey: "IBAN_SECRET",
    label: "IBAN şifreleme anahtarı",
    devFallback: "dev-iban-key-32-bytes-change-me!!!!!!!",
  },
];

function fatal(msg: string): never {
  throw new Error(`[SECRETS] STARTUP FAILURE: ${msg}`);
}

function warn(msg: string): void {
  console.warn(`[SECRETS] WARNING: ${msg}`);
}

function info(msg: string): void {
  console.info(`[SECRETS] ${msg}`);
}

export function validateAllSecrets(): void {
  const resolved: Record<string, string> = {};

  // ── 1. Presence & length checks ─────────────────────────────────────────────
  for (const { envKey, label, devFallback } of SECRETS) {
    const value = process.env[envKey];

    if (!value) {
      if (IS_PRODUCTION) {
        fatal(
          `${envKey} (${label}) ortam değişkeni üretim ortamında zorunludur. ` +
            "Replit Secrets üzerinden ekleyin ve yeniden deploy edin.",
        );
      }
      warn(
        `${envKey} (${label}) ayarlanmamış. Geliştirme ortamı için built-in ` +
          "fallback kullanılıyor. Bu değer üretime alınmadan mutlaka ayarlanmalıdır.",
      );
      resolved[envKey] = devFallback;
      continue;
    }

    if (value.length < MIN_LENGTH) {
      const msg =
        `${envKey} çok kısa (${value.length} karakter, minimum ${MIN_LENGTH}). ` +
        "En az 32 karakterlik rastgele bir değer kullanın.";
      if (IS_PRODUCTION) fatal(msg);
      warn(msg);
    }

    resolved[envKey] = value;
  }

  // ── 2. Distinctness checks (all pairs must differ) ───────────────────────────
  const pairs: [string, string][] = [
    ["JWT_SECRET", "SESSION_SECRET"],
    ["JWT_SECRET", "IBAN_SECRET"],
    ["SESSION_SECRET", "IBAN_SECRET"],
  ];

  for (const [a, b] of pairs) {
    if (resolved[a] === resolved[b]) {
      const msg =
        `${a} ve ${b} aynı değeri paylaşıyor. ` +
        "Her secret birbirinden bağımsız, farklı bir değere sahip olmalıdır.";
      if (IS_PRODUCTION) fatal(msg);
      warn(msg);
    }
  }

  // ── 3. Summary ───────────────────────────────────────────────────────────────
  const allSet = SECRETS.every(({ envKey }) => !!process.env[envKey]);
  if (allSet) {
    info("JWT_SECRET ✓  SESSION_SECRET ✓  IBAN_SECRET ✓  — tümü bağımsız ve geçerli.");
  }
}
