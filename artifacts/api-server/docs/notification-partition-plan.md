# NotificationRead — PostgreSQL Partition Stratejisi

## PHASE B TASK 2 — Tasarım Belgesi

> **Durum:** Planlama aşaması. Migration henüz uygulanmadı.
> Bu belge üretim geçişi için SQL tasarımını içermektedir.

---

## Mevcut Durum

`notification_reads` tablosu `notificationId + userId` unique constraint ile düz bir tablo olarak çalışıyor.

**Problem:** 500+ site, her site 1000 kullanıcı, günde 10 bildirim → aylık ~5M satır eklenmesi bekleniyor.

**Eşik:** ~50M satır üzeri sorgu performansı ciddi ölçüde düşer.

---

## Hedef Mimari — Aylık Range Partitioning

```sql
-- 1. Mevcut tabloyu yedekle
ALTER TABLE notification_reads RENAME TO notification_reads_archive_pre_partition;

-- 2. Ana partition tablosunu oluştur
CREATE TABLE notification_reads (
  id              UUID NOT NULL DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL,
  user_id         UUID NOT NULL,
  read_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notification_reads_unique UNIQUE (notification_id, user_id, read_at)
) PARTITION BY RANGE (read_at);

-- 3. Partition'ları oluştur (her ay için)
CREATE TABLE notification_reads_2025_01
  PARTITION OF notification_reads
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE notification_reads_2025_02
  PARTITION OF notification_reads
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

-- (sonraki aylar için devam eder — otomasyon aşağıda)

-- 4. Her partition'a index ekle
CREATE INDEX idx_nr_2025_01_notification ON notification_reads_2025_01 (notification_id);
CREATE INDEX idx_nr_2025_01_user ON notification_reads_2025_01 (user_id);
```

---

## Otomatik Partition Oluşturma

```sql
-- Her ay başında çalıştırılacak fonksiyon
CREATE OR REPLACE FUNCTION create_notification_reads_partition(target_month DATE)
RETURNS void AS $$
DECLARE
  partition_name TEXT;
  start_date DATE;
  end_date DATE;
BEGIN
  start_date := date_trunc('month', target_month);
  end_date   := start_date + INTERVAL '1 month';
  partition_name := 'notification_reads_' || to_char(start_date, 'YYYY_MM');

  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF notification_reads
     FOR VALUES FROM (%L) TO (%L)',
    partition_name, start_date, end_date
  );

  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON %I (notification_id)',
    'idx_' || partition_name || '_notif', partition_name
  );

  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON %I (user_id)',
    'idx_' || partition_name || '_user', partition_name
  );

  RAISE NOTICE 'Partition oluşturuldu: %', partition_name;
END;
$$ LANGUAGE plpgsql;

-- Kullanım (BullMQ scheduler'dan çağrılacak, her ay 1'inde):
SELECT create_notification_reads_partition(now() + INTERVAL '1 month');
```

---

## Archive Stratejisi

Eski partition'ları arşive taşımak için:

```sql
-- 6 aydan eski partition'ları archive şemasına taşı
CREATE SCHEMA IF NOT EXISTS archive;

-- Örnek: 2024 Ocak partition'ını taşı
ALTER TABLE notification_reads_2024_01 NO INHERIT notification_reads;
ALTER TABLE notification_reads_2024_01 SET SCHEMA archive;

-- Opsiyonel: pg_dump ile dışarı al, sonra DROP TABLE ile sil
```

---

## Unique Constraint Değişikliği

Mevcut: `@@unique([notificationId, userId])` — partition anahtarı olmayan alanlar üzerinde global unique.

Partitioned tablolarda global unique constraint partition key'i içermek zorundadır:

```sql
-- Yeni unique: (notification_id, user_id, read_at)
-- read_at partition key olduğu için dahil edilmeli.
-- Bu, aynı kullanıcı aynı bildirimi farklı zamanlarda tekrar okuyamazsa sorun çıkarmaz.
-- Uygulama katmanında "zaten okunmuş" kontrolü yapılmalı.
```

---

## Uygulama Katmanı Değişiklikleri

Migration uygulandığında Prisma şemasına eklenecekler:

```prisma
model NotificationRead {
  id             String   @id @default(uuid())
  notificationId String   @map("notification_id")
  userId         String   @map("user_id")
  readAt         DateTime @default(now()) @map("read_at")

  // Partition key olduğu için unique sadece uygulama katmanında
  // @@unique kaldırılır, upsert yerine insert-if-not-exists kullanılır

  @@index([notificationId])
  @@index([userId])
  @@index([readAt])  // partition pruning için
  @@map("notification_reads")
}
```

---

## Beklenen Performans Etkisi

| Senaryo | Mevcut (düz tablo) | Partition sonrası |
|---|---|---|
| 50M satır için `SELECT` | ~2-5s | ~50-200ms (tek ay sorgusu) |
| Aylık archive süresi | Yok | <1 dakika (sadece o partition) |
| `DELETE` eski kayıtlar | Saat sürebilir | `DROP TABLE partition_X` (anlık) |

---

## Risk Değerlendirmesi

| Risk | Önem | Azaltma |
|---|---|---|
| Migration sırasında downtime | Orta | `pg_partman` ile online migration |
| Unique constraint kayması | Yüksek | Uygulama katmanında kontrol |
| Partition atlanması (ay geçişi) | Düşük | Scheduler + monitoring |
| Prisma partition desteği | Orta | raw query veya Supabase migration |

---

## Öneri — Uygulama Zamanlaması

- **Eşik:** 10M satır üzeri veya sorgu süresi >500ms
- **Araç:** `pg_partman` ile otomatik partition yönetimi
- **Migration:** Blue-green deploy ile sıfır downtime
