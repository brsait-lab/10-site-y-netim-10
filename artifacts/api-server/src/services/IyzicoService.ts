/**
 * C8 — iyzico Payment Integration
 *
 * Türkiye'nin önde gelen ödeme altyapısı.
 * Sandbox: https://sandbox.iyzipay.com
 * Production: https://api.iyzipay.com
 *
 * Gerekli env değişkenleri:
 *   IYZICO_API_KEY     — iyzico API anahtarı
 *   IYZICO_SECRET_KEY  — iyzico gizli anahtar
 *   IYZICO_BASE_URL    — https://sandbox.iyzipay.com | https://api.iyzipay.com
 *   APP_BASE_URL       — webhook callback URL kökü (örn: https://your-api.replit.app/api)
 */

import { createHmac, randomUUID } from "node:crypto";
import { logger } from "../lib/logger.js";

const IYZICO_API_KEY = process.env["IYZICO_API_KEY"] ?? "";
const IYZICO_SECRET_KEY = process.env["IYZICO_SECRET_KEY"] ?? "";
const IYZICO_BASE_URL = process.env["IYZICO_BASE_URL"] ?? "https://sandbox.iyzipay.com";
const APP_BASE_URL = process.env["APP_BASE_URL"] ?? "http://localhost:8080/api";

function isConfigured(): boolean {
  return Boolean(IYZICO_API_KEY && IYZICO_SECRET_KEY);
}

/** iyzico HMAC-SHA256 authorization header */
function buildAuthHeader(body: string): { Authorization: string; "x-iyzi-rnd": string } {
  const rnd = randomUUID().replace(/-/g, "");
  const hashStr = `${IYZICO_API_KEY}${rnd}${IYZICO_SECRET_KEY}${body}`;
  const hash = createHmac("sha256", IYZICO_SECRET_KEY).update(hashStr).digest("base64");
  return {
    Authorization: `IYZWS ${IYZICO_API_KEY}:${hash}`,
    "x-iyzi-rnd": rnd,
  };
}

async function post<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const body = JSON.stringify(payload);
  const headers = {
    "Content-Type": "application/json",
    ...buildAuthHeader(body),
  };

  const resp = await fetch(`${IYZICO_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body,
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`iyzico API hatası ${resp.status}: ${text}`);
  }

  return resp.json() as T;
}

export interface CheckoutSession {
  checkoutFormContent: string;  // HTML form content (iframe veya redirect)
  token: string;
  tokenExpireTime: number;
  paymentPageUrl: string;
}

export interface CheckoutRequest {
  siteId: string;
  planId: string;
  planName: string;
  amount: number;           // kuruş (TRY × 100)
  buyerName: string;
  buyerSurname: string;
  buyerEmail: string;
  buyerPhone: string;
  buyerCity: string;
  interval: "monthly" | "yearly";
}

/** iyzico checkout formu oluştur */
export async function createCheckoutSession(req: CheckoutRequest): Promise<CheckoutSession | null> {
  if (!isConfigured()) {
    logger.warn("[IYZICO] API key yapılandırılmamış. Checkout devre dışı.");
    return null;
  }

  const payload = {
    locale: "tr",
    conversationId: req.siteId,
    price: (req.amount / 100).toFixed(2),
    paidPrice: (req.amount / 100).toFixed(2),
    currency: "TRY",
    basketId: `${req.siteId}-${req.planId}-${Date.now()}`,
    paymentGroup: "SUBSCRIPTION",
    callbackUrl: `${APP_BASE_URL}/subscription/webhook`,
    buyer: {
      id: req.siteId,
      name: req.buyerName,
      surname: req.buyerSurname,
      email: req.buyerEmail,
      identityNumber: "11111111111",   // test identity
      registrationAddress: req.buyerCity,
      city: req.buyerCity,
      country: "Turkey",
      gsmNumber: req.buyerPhone,
    },
    shippingAddress: {
      contactName: `${req.buyerName} ${req.buyerSurname}`,
      city: req.buyerCity,
      country: "Turkey",
      address: req.buyerCity,
    },
    billingAddress: {
      contactName: `${req.buyerName} ${req.buyerSurname}`,
      city: req.buyerCity,
      country: "Turkey",
      address: req.buyerCity,
    },
    basketItems: [
      {
        id: req.planId,
        name: `${req.planName} — ${req.interval === "monthly" ? "Aylık" : "Yıllık"} Plan`,
        category1: "SaaS",
        itemType: "VIRTUAL",
        price: (req.amount / 100).toFixed(2),
      },
    ],
  };

  try {
    const result = await post<CheckoutSession>("/payment/iyzipos/checkoutform/initialize/auth/ecommerce", payload);
    logger.info({ siteId: req.siteId, planId: req.planId }, "[IYZICO] Checkout session oluşturuldu");
    return result;
  } catch (err) {
    logger.error({ err, siteId: req.siteId }, "[IYZICO] Checkout session oluşturulamadı");
    return null;
  }
}

export interface PaymentResult {
  status: "success" | "failure";
  paymentId?: string;
  conversationId?: string;
  price?: number;
  currency?: string;
  errorCode?: string;
  errorMessage?: string;
}

/** iyzico checkout token'dan ödeme sonucunu al */
export async function getPaymentResult(token: string): Promise<PaymentResult | null> {
  if (!isConfigured()) return null;

  try {
    const result = await post<{
      status: string; paymentId?: string; conversationId?: string;
      price?: string; currency?: string; errorCode?: string; errorMessage?: string;
    }>("/payment/iyzipos/checkoutform/auth/ecommerce/detail", { locale: "tr", token });

    return {
      status: result.status === "success" ? "success" : "failure",
      paymentId: result.paymentId,
      conversationId: result.conversationId,
      price: result.price ? parseFloat(result.price) : undefined,
      currency: result.currency,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    };
  } catch (err) {
    logger.error({ err, token }, "[IYZICO] Ödeme detayı alınamadı");
    return null;
  }
}

/**
 * iyzico webhook imzasını doğrula.
 *
 * iyzico webhook body: { iyziEventType, iyziReferenceCode, token, paymentId }
 * Signature: HMAC-SHA256(secretKey + iyziEventType + iyziReferenceCode + merchantId)
 * Not: iyzico webhook imzalama implementasyonu sağlayıcıya göre değişebilir.
 * Bu implementasyon "X-IYZ-SIGNATURE" header doğrulaması yapar.
 */
export function validateWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
): boolean {
  if (!isConfigured()) return true; // Sandbox: bypass

  if (!signatureHeader) {
    logger.warn("[IYZICO] Webhook imzası eksik");
    return false;
  }

  try {
    const expected = createHmac("sha256", IYZICO_SECRET_KEY)
      .update(rawBody)
      .digest("base64");

    return expected === signatureHeader;
  } catch {
    return false;
  }
}

export { isConfigured as isIyzicoConfigured };
