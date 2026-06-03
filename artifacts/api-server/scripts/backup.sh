#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Site Yönetim Sistemi — Veritabanı Yedekleme Scripti
#
# Kullanım:
#   bash scripts/backup.sh
#
# Gerekli ortam değişkenleri:
#   DATABASE_URL       — PostgreSQL bağlantı dizesi
#   R2_ACCOUNT_ID      — Cloudflare R2 hesap ID
#   R2_ACCESS_KEY_ID   — R2 erişim anahtarı
#   R2_SECRET_KEY      — R2 gizli anahtar
#   R2_BUCKET_NAME     — Yedek bucket adı (örn: "site-backups")
#   BACKUP_ENCRYPT_KEY — GPG şifreleme parolası (opsiyonel, önerilir)
#
# Cron örnekleri (üretim sunucusunda):
#   Günlük  02:00  → 0 2 * * *   /app/scripts/backup.sh >> /var/log/backup.log 2>&1
#   Haftalık Pazar → 0 3 * * 0   /app/scripts/backup.sh >> /var/log/backup.log 2>&1
#   Aylık   01.    → 0 4 1 * *   /app/scripts/backup.sh >> /var/log/backup.log 2>&1
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="backup_${TIMESTAMP}.sql.gz"
ENCRYPTED_FILE="${BACKUP_FILE}.gpg"

echo "[$(date -u)] Backup başlatılıyor..."

# ── 1. Veritabanı dökümü ──────────────────────────────────────────────────────
if [ -z "${DATABASE_URL:-}" ]; then
  echo "[HATA] DATABASE_URL tanımlı değil." >&2
  exit 1
fi

echo "[$(date -u)] pg_dump çalışıyor..."
pg_dump "${DATABASE_URL}" \
  --no-owner \
  --no-acl \
  --format=plain \
  | gzip > "/tmp/${BACKUP_FILE}"

echo "[$(date -u)] Backup oluşturuldu: /tmp/${BACKUP_FILE} ($(du -sh /tmp/${BACKUP_FILE} | cut -f1))"

# ── 2. GPG şifreleme (opsiyonel) ──────────────────────────────────────────────
UPLOAD_FILE="${BACKUP_FILE}"
if [ -n "${BACKUP_ENCRYPT_KEY:-}" ]; then
  echo "[$(date -u)] Şifreleme uygulanıyor..."
  gpg --batch \
    --passphrase "${BACKUP_ENCRYPT_KEY}" \
    --symmetric \
    --cipher-algo AES256 \
    --output "/tmp/${ENCRYPTED_FILE}" \
    "/tmp/${BACKUP_FILE}"
  rm "/tmp/${BACKUP_FILE}"
  UPLOAD_FILE="${ENCRYPTED_FILE}"
  echo "[$(date -u)] Şifrelendi: /tmp/${UPLOAD_FILE}"
fi

# ── 3. R2'ye yükleme ──────────────────────────────────────────────────────────
if [ -n "${R2_ACCOUNT_ID:-}" ] && [ -n "${R2_ACCESS_KEY_ID:-}" ] && [ -n "${R2_SECRET_KEY:-}" ] && [ -n "${R2_BUCKET_NAME:-}" ]; then
  BACKUP_PREFIX="$(date +%Y/%m)"
  S3_PATH="s3://${R2_BUCKET_NAME}/backups/${BACKUP_PREFIX}/${UPLOAD_FILE}"

  echo "[$(date -u)] R2'ye yükleniyor: ${S3_PATH}"

  AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
  AWS_SECRET_ACCESS_KEY="${R2_SECRET_KEY}" \
  aws s3 cp \
    "/tmp/${UPLOAD_FILE}" \
    "${S3_PATH}" \
    --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" \
    --no-progress

  echo "[$(date -u)] R2'ye yükleme tamamlandı."
else
  echo "[UYARI] R2 yapılandırması eksik. Backup yalnızca yerel: /tmp/${UPLOAD_FILE}"
fi

# ── 4. Temizlik ───────────────────────────────────────────────────────────────
rm -f "/tmp/${BACKUP_FILE}" "/tmp/${ENCRYPTED_FILE}"

echo "[$(date -u)] Backup tamamlandı: ${UPLOAD_FILE}"

# ── 5. 30 günden eski backupları R2'de sil ────────────────────────────────────
# Not: Bu bölüm manuel olarak çalıştırılmalı veya ayrı bir job'a taşınmalı.
# aws s3 ls s3://${R2_BUCKET_NAME}/backups/ | awk '{print $4}' | \
#   while read key; do
#     created=$(aws s3api head-object --bucket "${R2_BUCKET_NAME}" --key "$key" \
#       --query 'LastModified' --output text)
#     # 30 günden eski ise sil
#   done
