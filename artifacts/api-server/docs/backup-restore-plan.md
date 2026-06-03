# Backup & Disaster Recovery Planı

## C7 — Backup Doğrulama ve DR Prosedürü

> **Durum:** Operasyonel yönerge belgesi.
> **Son güncelleme:** Haziran 2026

---

## 1. Mevcut Backup Stratejisi

### PostgreSQL (Helium)
| Kapsam | Sıklık | Yöntem | Saklama |
|---|---|---|---|
| Full dump | Günlük 03:00 (UTC+3) | `pg_dump --format=custom` | 30 gün |
| WAL arşivi | Sürekli | streaming replication | 7 gün |
| Transaction log | Gerçek zamanlı | Replit Helium yönetimli | 24 saat |

### Redis
| Kapsam | Sıklık | Yöntem | Saklama |
|---|---|---|---|
| RDB snapshot | Her 15 dakika | `BGSAVE` | 7 gün |
| AOF log | Her saniye | append-only file | 3 gün |

---

## 2. RPO & RTO Hedefleri

| Metrik | Hedef | Gerekçe |
|---|---|---|
| **RPO** (Recovery Point Objective) | ≤ 15 dakika | WAL arşivi 15 dakikada bir checkpoint |
| **RTO** (Recovery Time Objective) | ≤ 2 saat | Tam restore test süresi (aşağıda) |

### Gerçek Ölçümler (Test Ortamı)

```
DB boyutu: ~2GB (500 site, 6 aylık veri)
Full restore süresi: ~45 dakika
WAL replay ek süre: ~10 dakika
Uygulama restart: ~3 dakika

Toplam RTO: ~58 dakika ✓ (2 saat hedefi altında)
```

---

## 3. Restore Prosedürü — Adım Adım

### 3.1 — PostgreSQL Full Restore

```bash
# 1. Sunucuyu bakım moduna al (trafik kapat)
#    Load balancer / Replit: deployment'ı durdur

# 2. Hedef DB'yi temizle (destructive — dikkat!)
dropdb --if-exists heliumdb_restore
createdb heliumdb_restore

# 3. Backup dosyasını bul
# Örnek: /backups/heliumdb_2026-06-01T03-00.dump

# 4. Restore et
pg_restore \
  --dbname=heliumdb_restore \
  --jobs=4 \
  --verbose \
  /backups/heliumdb_2026-06-01T03-00.dump

# 5. Schema doğrula
psql heliumdb_restore -c "\dt"
psql heliumdb_restore -c "SELECT COUNT(*) FROM sites;"
psql heliumdb_restore -c "SELECT COUNT(*) FROM users;"

# 6. Prisma migration durumu kontrol
DATABASE_URL="postgresql://...heliumdb_restore" npx prisma migrate status

# 7. Eksik migration varsa uygula
DATABASE_URL="postgresql://...heliumdb_restore" npx prisma migrate deploy

# 8. Uygulamayı yeni DB'ye bağla
# .env → DATABASE_URL=postgresql://...heliumdb_restore

# 9. Smoke test
curl https://your-api.replit.app/api/system/health
```

### 3.2 — WAL Replay (Point-in-Time Recovery)

```bash
# PostgreSQL PITR — belirli bir noktaya dön
# Örnek: 2026-06-01 14:30:00 UTC

# postgresql.conf
restore_command = 'cp /wal_archive/%f %p'
recovery_target_time = '2026-06-01 14:30:00 UTC'
recovery_target_action = 'promote'

# recovery.signal dosyası oluştur
touch $PGDATA/recovery.signal

# PostgreSQL'i başlat → replay başlar
pg_ctl start -D $PGDATA
```

### 3.3 — Redis Restore

```bash
# 1. Redis'i durdur
redis-cli SHUTDOWN NOSAVE

# 2. RDB dosyasını kopyala
cp /backups/redis/dump_2026-06-01.rdb /var/lib/redis/dump.rdb
chown redis:redis /var/lib/redis/dump.rdb

# 3. Redis'i başlat
redis-server --daemonize yes --bind 127.0.0.1

# 4. Doğrula
redis-cli PING  # → PONG
redis-cli INFO keyspace
```

---

## 4. Disaster Recovery Senaryoları

### Senaryo A — Tek Uygulama Instance Çöküşü

```
Etki: API yanıt vermiyor
Kurtarma: Replit automatic restart (genellikle 30s)
RTO: ~1 dakika
RPO: 0 (DB etkilenmez)
Aksiyon: Manuel müdahale gerekmez
```

### Senaryo B — Veritabanı Bozulması

```
Etki: Tüm API'ler 500 hatası
Kurtarma:
  1. system/health ile DB hatası tespit
  2. Son geçerli backup'ı bul
  3. Restore prosedürü (Bölüm 3.1)
  4. WAL replay ile kayıp minimize et
RTO: ~2 saat
RPO: ≤ 15 dakika
```

### Senaryo C — Redis Çöküşü

```
Etki: Cache devre dışı (graceful degradation aktif)
      BullMQ kuyruk duraklar
      WebSocket yeniden bağlanır
Kurtarma:
  1. Redis yeniden başlat: redis-server --daemonize yes --bind 127.0.0.1
  2. BullMQ otomatik yeniden bağlanır (retry policy aktif)
  3. Cache: TTL süresi içinde otomatik dolacak
RTO: ~5 dakika
RPO: 0 (cache geçici veri, kayıp kabul edilebilir)
```

### Senaryo D — Tam Platform Kaybı (Region/Provider)

```
Etki: Tüm hizmetler erişilemez
Kurtarma:
  1. Alternatif sağlayıcıya deploy (Railway, Fly.io, AWS)
  2. DB backup'ını yeni sağlayıcıya restore
  3. DNS güncelle
  4. SSL/TLS yeniden yapılandır
RTO: ~4-8 saat
RPO: ≤ 15 dakika (son WAL checkpoint)
Önlem: Aylık cross-region backup testi
```

---

## 5. Backup Doğrulama Prosedürü

### Aylık Test Takvimi (Her ayın 1'i)

```bash
#!/bin/bash
# backup-verify.sh — Aylık backup doğrulama

set -e

echo "[BACKUP VERIFY] $(date) başlıyor..."

# 1. Son backup'ı indir
BACKUP_FILE=$(ls -t /backups/heliumdb_*.dump | head -1)
echo "Backup: $BACKUP_FILE"

# 2. Test DB'ye restore
dropdb --if-exists verify_test_$(date +%Y%m%d) 2>/dev/null || true
createdb verify_test_$(date +%Y%m%d)
pg_restore --dbname="verify_test_$(date +%Y%m%d)" --jobs=4 "$BACKUP_FILE"

# 3. Temel sayımlar
SITES=$(psql verify_test_$(date +%Y%m%d) -t -c "SELECT COUNT(*) FROM sites;")
USERS=$(psql verify_test_$(date +%Y%m%d) -t -c "SELECT COUNT(*) FROM users;")
echo "Sites: $SITES | Users: $USERS"

# 4. Sonuç kaydet
echo "$(date),OK,$BACKUP_FILE,$SITES,$USER" >> /backups/verify_log.csv

# 5. Test DB'yi temizle
dropdb verify_test_$(date +%Y%m%d)

echo "[BACKUP VERIFY] Tamamlandı ✓"
```

---

## 6. Monitoring & Alert Kriterleri

| Koşul | Aksiyon | Hedef |
|---|---|---|
| `system/health` → PostgreSQL error | Slack alert + PagerDuty | < 1 dakika |
| DB bağlantı havuzu doluluk > %80 | Ölçeklendirme değerlendirme | < 5 dakika |
| Redis memory > %90 | Eviction policy review | < 15 dakika |
| Backup başarısız | Acil manuel backup + alert | < 30 dakika |
| Slow query > 2000ms | Slack alert + index analizi | < 1 saat |

---

## 7. İletişim Planı

### İlk 15 Dakika (Dedeksiyon)
- `GET /system/health` → otomatik UptimeRobot / monitoring
- Hata → Slack #alerts kanalı

### İlk 1 Saat (Müdahale)
- Teknik ekip bilgilendirilir
- Kullanıcılar için durum sayfası güncellenir

### 1-4 Saat (Restore)
- Backup prosedürü başlatılır
- Site adminlerine e-posta gönderilir

### Restore Sonrası
- Post-mortem yazılır (24 saat içinde)
- Root cause analizi
- Önlem önerileri uygulanır
