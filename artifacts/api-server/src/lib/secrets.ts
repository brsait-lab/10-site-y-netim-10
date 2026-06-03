/**
 * Merkezi secret doğrulama modülü.
 * Başlangıçta validateAllSecrets() çağrılır (index.ts).
 *
 * Üretimde fail-fast: eksik veya zayıf secret varsa uygulama başlamaz.
 * Geliştirmede: uyarı verir, devam eder.
 *
 * Zorunlu secretlar:
 *   JWT_SECRET, SESSION_SECRET, IBAN_SECRET — her biri ≥ 32 karakter, birbirinden farklı
 *   DATABASE_URL — her zaman zorunlu
 *
 * Üretimde ek zorunlu ortam değişkenleri:
 *   R2_ACCESS_KEY_ID, R2_SECRET_KEY, R2_BUCKET_NAME — R2 yapılandırıldıysa zorunlu
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

/** Üretimde uygulamanın başlamamasına neden olan hatalar. */
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
  // ── 1. DATABASE_URL: her ortamda zorunlu ─────────────────────────────────────
  if (!process.env["DATABASE_URL"]) {
    // Her zaman fatal — DB olmadan uygulama çalışamaz
    fatal("DATABASE_URL ortam değişkeni eksik. Veritabanı bağlantısı kurulamaz.");
  }

  // ── 2. Kriptografik secretlar: üretimde zorunlu, geliştirmede fallback ───────
  const resolved: Record<string, string> = {};

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

  // ── 3. Secretlar birbirinden farklı olmalı ───────────────────────────────────
  const pairs: [string, string][] = [
    ["JWT_SECRET", "SESSION_SECRET"],
    ["JWT_SECRET", "IBAN_SECRET"],
    ["SESSION_SECRET", "IBAN_SECRET"],
  ];

  for (const [a, b] of pairs) {
    if (resolved[a] && resolved[b] && resolved[a] === resolved[b]) {
      const msg =
        `${a} ve ${b} aynı değeri paylaşıyor. ` +
        "Her secret birbirinden bağımsız, farklı bir değere sahip olmalıdır.";
      if (IS_PRODUCTION) fatal(msg);
      warn(msg);
    }
  }

  // ── 4. R2 konfigürasyon uyarıları (üretimde zorunlu, geliştirmede opsiyonel) ─
  const r2Keys = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_KEY", "R2_BUCKET_NAME", "R2_PUBLIC_URL"];
  const missingR2 = r2Keys.filter((k) => !process.env[k]);

  if (missingR2.length > 0 && IS_PRODUCTION) {
    warn(
      `R2 dosya yükleme devre dışı: ${missingR2.join(", ")} eksik. ` +
        "Dekont yükleme özelliği çalışmayacak.",
    );
  } else if (missingR2.length > 0) {
    warn(`R2 yapılandırılmamış (${missingR2.join(", ")}). Dekont yükleme URL paste modunda çalışır.`);
  }

  // ── 5. Özet ──────────────────────────────────────────────────────────────────
  const allCryptoSet = SECRETS.every(({ envKey }) => !!process.env[envKey]);
  const r2Ready = missingR2.length === 0;

  info(
    `DATABASE_URL ✓  ` +
      `JWT_SECRET ${allCryptoSet ? "✓" : "⚠"}  ` +
      `SESSION_SECRET ${allCryptoSet ? "✓" : "⚠"}  ` +
      `IBAN_SECRET ${allCryptoSet ? "✓" : "⚠"}  ` +
      `R2 ${r2Ready ? "✓" : "⚠ (devre dışı)"}`,
  );
}
