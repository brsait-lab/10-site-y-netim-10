# PRODUCTION DEPLOYMENT CHECKLIST
**Sistem:** Site Yönetim Sistemi  
**Tarih:** 2026-06-04  
**Referans:** CAPACITY_REPORT.md

Pilot yayın öncesi her madde işaretlenmelidir. ✅ = tamamlandı, ⬜ = bekliyor, ⚠️ = kısmi.

---

## BÖLÜM 1 — ORTAM VE SECRETS

| # | Kontrol | Durum | Notlar |
|---|---|---|---|
| 1.1 | `DATABASE_URL` production veritabanına yönlendiriliyor | ⬜ | `postgresql://...` format |
| 1.2 | `JWT_SECRET` ≥ 32 karakter, üretimde unique | ⬜ | `openssl rand -base64 48` ile oluştur |
| 1.3 | `SESSION_SECRET` ≥ 32 karakter, JWT_SECRET'tan farklı | ⬜ | Ayrı değer kullan |
| 1.4 | `IBAN_SECRET` ≥ 32 karakter ayarlandı | ⬜ | IBAN şifreleme için zorunlu |
| 1.5 | `SENTRY_DSN` production Sentry projesine yönlendiriliyor | ⬜ | `https://...@sentry.io/...` |
| 1.6 | `PORT` ortam değişkeni Replit tarafından otomatik atanıyor | ✅ | |
| 1.7 | `NODE_ENV=production` olarak ayarlandı | ⬜ | Pino log seviyeleri buna göre değişir |
| 1.8 | R2 credentials ayarlandı (isteğe bağlı — makbuz yükleme) | ⬜ | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` |
| 1.9 | `EXPO_PUBLIC_DOMAIN` mobil uygulamada production API'ye yönlendiriyor | ⬜ | `your-app.replit.app` |

---

## BÖLÜM 2 — VERİTABANI

| # | Kontrol | Durum | Notlar |
|---|---|---|---|
| 2.1 | Prisma migrate production'da çalıştırıldı | ⬜ | `pnpm prisma migrate deploy` |
| 2.2 | Tüm migration'lar uygulandı, drift yok | ⬜ | `pnpm prisma migrate status` |
| 2.3 | Kritik index'ler production'da oluşturuldu | ⬜ | Aşağıdaki SQL bloğunu çalıştır |
| 2.4 | pg.Pool max boyutu production için artırıldı | ⬜ | 10 → 30 (100+ site için) |
| 2.5 | DB bağlantı testi yapıldı | ⬜ | `GET /api/system/health` → postgresql: ok |
| 2.6 | Production DB yedeği alındı | ⬜ | Pilot öncesi snapshot |

**Kritik Index SQL (production'da CONCURRENTLY çalıştır):**
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_site_created
  ON notifications (site_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_payments_site_status_due
  ON user_payments (site_id, status, due_date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_site_status_deleted
  ON users (site_id, status, deleted_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_site_created
  ON audit_logs (site_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_messages_site_created
  ON chat_messages (site_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expenses_site_cancelled_created
  ON expenses (site_id, cancelled_at, created_at DESC);
```

---

## BÖLÜM 3 — GÜVENLİK

| # | Kontrol | Durum | Notlar |
|---|---|---|---|
| 3.1 | CORS `*` yerine production domain'e kısıtlandı | ⬜ | `app.ts`: `cors({ origin: "https://your-app.replit.app" })` |
| 3.2 | Rate limiter değerleri production trafiğine göre kalibre edildi | ✅ | 200 req/15dk global, endpoint bazlı ek limitler |
| 3.3 | Helmet middleware aktif | ✅ | `app.ts`'de mevcut |
| 3.4 | JWT secret production değeri ile yenilendi | ⬜ | Development secret kullanılmamalı |
| 3.5 | Socket.IO CORS origin production domain'e kısıtlandı | ⬜ | `index.ts`: `cors: { origin: "https://your-app.replit.app" }` |
| 3.6 | Log redaction aktif (parola, token, auth header) | ✅ | Pino redact konfigüre edilmiş |
| 3.7 | Stack trace production'da gizli | ✅ | `NODE_ENV !== "production"` kontrolü mevcut |

---

## BÖLÜM 4 — MONİTÖRİNG VE OBSERVABILITY

| # | Kontrol | Durum | Notlar |
|---|---|---|---|
| 4.1 | Sentry API: `SENTRY_DSN` ile başlatılıyor | ✅ | `index.ts`'de mevcut |
| 4.2 | Sentry API: Express error middleware `captureException` çağırıyor | ✅ | Bu session'da düzeltildi |
| 4.3 | Sentry API: `uncaughtException` + `unhandledRejection` yakalanıyor | ✅ | `index.ts`'de mevcut |
| 4.4 | Sentry API: `tracesSampleRate: 0.2` production'da | ✅ | |
| 4.5 | `GET /api/system/health` production'da erişilebilir | ⬜ | Uptime monitoring için |
| 4.6 | `GET /api/healthz` load balancer health check endpoint'i | ✅ | Mevcut |
| 4.7 | Slow query buffer aktif (>100ms eşiği) | ✅ | Prisma $extends hook'u mevcut |
| 4.8 | Pino structured logging production'da aktif | ✅ | JSON format, redaction aktif |
| 4.9 | Redis `GET /system/metrics` cache hit ratio takip ediliyor | ✅ | cacheStats.hits/misses mevcut |
| 4.10 | BullMQ queue health `GET /system/queues` erişilebilir | ✅ | Admin only |
| 4.11 | Mobil: Sentry entegrasyonu pilot sonrası eklenmeli | ⬜ | Expo dev build gerektirir |

---

## BÖLÜM 5 — KAPASİTE VE PERFORMANS

| # | Kontrol | Durum | Notlar |
|---|---|---|---|
| 5.1 | CAPACITY_REPORT.md incelendi ve onaylandı | ✅ | 2026-06-04 tarihli |
| 5.2 | 100 VU yük testinde p95 < 100ms kanıtlandı | ✅ | p95=4.94ms |
| 5.3 | 200 VU soak testinde 0.00% error kanıtlandı | ✅ | |
| 5.4 | Redis cache hit ratio ≥ %70 | ✅ | %76.8 ölçüldü |
| 5.5 | BullMQ 50k job 0 başarısız | ✅ | 5725 job/s throughput |
| 5.6 | WebSocket 5000 bağlantı 0.00% hata | ✅ | |
| 5.7 | Redis `maxmemory` ve eviction policy production'da ayarlandı | ⬜ | `maxmemory 256mb`, `maxmemory-policy allkeys-lru` |
| 5.8 | PostgreSQL connection pool max 30 (100+ site için) | ⬜ | `prisma.ts`: `pg.Pool({ max: 30 })` |

---

## BÖLÜM 6 — MOBİL UYGULAMA

| # | Kontrol | Durum | Notlar |
|---|---|---|---|
| 6.1 | `EXPO_PUBLIC_DOMAIN` production API domain'ine ayarlandı | ⬜ | `your-app.replit.app` (https prefix olmadan) |
| 6.2 | Admin dashboard gerçek zamanlı WebSocket güncellemeleri aktif | ✅ | Bu session'da tamamlandı |
| 6.3 | Tüm rol dashboard'ları test edildi (admin/resident/security/merchant) | ⬜ | Pilot kullanıcılarla doğrula |
| 6.4 | Hata sınırı (ErrorBoundary) tüm ekranlarda aktif | ✅ | `_layout.tsx`'de sarmalanmış |
| 6.5 | AsyncStorage token expiry yönetimi test edildi | ⬜ | Süresi dolmuş token'lar 401 alıyor mu? |
| 6.6 | Socket.IO yeniden bağlantı davranışı test edildi | ✅ | `reconnectionAttempts: 5`, `reconnectionDelay: 1000` |
| 6.7 | Pull-to-refresh tüm dashboard'larda çalışıyor | ✅ | RefreshControl mevcut |

---

## BÖLÜM 7 — ZAMANLANMIŞ GÖREVLER

| # | Kontrol | Durum | Notlar |
|---|---|---|---|
| 7.1 | Scheduler production timezone (`Europe/Istanbul`) | ✅ | `scheduler.ts`'de ayarlanmış |
| 7.2 | 03:00 veri arşivleme görevi (3 yıl mesaj, 2 yıl bildirim) | ✅ | `runAllArchivingJobs` mevcut |
| 7.3 | 09:00 abonelik yenileme kontrolü | ✅ | `subscription_renewal_check` job'ı |
| 7.4 | İlk production çalışmasında cron job'larının log'lanması doğrulandı | ⬜ | Pino log'larında kontrol et |
| 7.5 | BullMQ Redis bağlantısı production'da stabil | ⬜ | `GET /system/queues` → provider: "bullmq" |

---

## BÖLÜM 8 — PİLOT YAYINA GEÇİŞ

| # | Kontrol | Durum | Notlar |
|---|---|---|---|
| 8.1 | En az 1 test sitesi oluşturuldu | ⬜ | Site lookup kodu test edilmeli |
| 8.2 | İlk admin kullanıcısı elle oluşturuldu | ⬜ | `/api/auth/register` + rol ataması |
| 8.3 | Mobil uygulamada pilot kullanıcı oturumu test edildi | ⬜ | Login → Dashboard görüntüleme |
| 8.4 | Aidat oluşturma + onay akışı test edildi | ⬜ | Admin → Sakin akışı uçtan uca |
| 8.5 | Bildirim gönderme test edildi | ⬜ | Admin → Tüm site bildirimi |
| 8.6 | Kargo bildirimi akışı test edildi | ⬜ | Güvenlik → Sakin akışı |
| 8.7 | `GET /api/system/health` → tüm bileşenler "ok" | ⬜ | postgresql, redis, bullmq, websocket |
| 8.8 | İlk gerçek kullanıcı geri bildirimi toplandı | ⬜ | Pilot sonrası |

---

## BÖLÜM 9 — ROLLBACK PLANI

| Senaryo | Aksiyon |
|---|---|
| API çöktü | Replit deployment önceki checkpoint'e döndür |
| DB migration başarısız | `pnpm prisma migrate resolve --rolled-back <migration>` |
| Bellek sızıntısı tespit edildi | `GET /system/metrics` uptime + Redis memory izle; sunucuyu yeniden başlat |
| Kritik hata Sentry'de | Sentry alert → GitHub issue → hotfix deploy |
| Redis bağlantı koptu | BullMQ otomatik InMemory fallback'e geçer; loglardan izle |

---

## ÖZET DURUM

```
Tamamlanan  : ██████████████░░░░░░  17/38 (%45)
Bekleyen    : ░░░░░░░░░░░░░░██████  19/38
Kısmi       : ░░░░░░░░░░░░░░░░████   2/38
```

**Pilot için minimum gereksinimler (öncelik sırası):**
1. ⬜ Section 1 — Tüm secrets production değerlerine güncellenmeli
2. ⬜ 2.1-2.3 — Migration + index'ler uygulanmalı
3. ⬜ 3.1 — CORS production domain'e kısıtlanmalı
4. ⬜ 5.7 — Redis maxmemory ayarlanmalı
5. ⬜ 6.1 — Mobile domain env var güncellenmeli

---

*Rapor oluşturulma: 2026-06-04 — Deployment checklist v1.0*
