/**
 * Merkezi rate limiter konfigürasyonu.
 * Her endpoint grubuna özel istek sınırı tanımlar.
 * Brute force, spam ve DoS saldırılarına karşı koruma.
 */

import { rateLimit } from "express-rate-limit";

const base = {
  standardHeaders: true,
  legacyHeaders: false,
};

/**
 * Login / Register: 5 istek/dakika (IP bazlı)
 * Brute force saldırılarına karşı.
 */
export const authLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  max: 5,
  message: { message: "Çok fazla giriş denemesi. 1 dakika sonra tekrar deneyin." },
});

/**
 * Site join-code lookup: 10 istek/dakika
 * Kaba kuvvet ile join code keşfini engeller.
 */
export const siteLookupLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  max: 10,
  message: { message: "Çok fazla arama isteği. Lütfen bekleyin." },
});

/**
 * Mesajlar: 30 istek/dakika
 * Sohbet spam koruması.
 */
export const messageLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  max: 30,
  message: { message: "Çok hızlı mesaj gönderiyorsunuz. Lütfen biraz bekleyin." },
});

/**
 * Bildirimler: 20 istek/dakika
 * Bildirim spam koruması.
 */
export const notificationLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  max: 20,
  message: { message: "Çok fazla bildirim gönderildi. Lütfen bekleyin." },
});

/**
 * Aidat işlemleri (oluşturma, ödeme, onay, red): 10 istek/dakika
 * Finansal işlem bütünlüğü için.
 */
export const paymentLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  max: 10,
  message: { message: "Çok fazla finansal işlem isteği. Lütfen bekleyin." },
});

/**
 * Dosya yükleme (presigned URL): 10 istek/dakika
 * Gereksiz R2 imza üretimini engeller.
 */
export const uploadLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  max: 10,
  message: { message: "Çok fazla yükleme isteği. Lütfen bekleyin." },
});

/**
 * Vendor talepleri: 10 istek/dakika
 */
export const vendorRequestLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  max: 10,
  message: { message: "Çok fazla talep gönderildi. Lütfen bekleyin." },
});
