/**
 * KRİTİK 5 — Cloudflare R2 Presigned Upload
 *
 * Gerekli ortam değişkenleri:
 *   R2_ACCOUNT_ID     — Cloudflare hesap ID'si
 *   R2_ACCESS_KEY_ID  — R2 erişim anahtarı ID
 *   R2_SECRET_KEY     — R2 gizli anahtar
 *   R2_BUCKET_NAME    — Bucket adı (örn: "site-receipts")
 *   R2_PUBLIC_URL     — Bucket public URL (örn: https://receipts.yourdomain.com)
 *
 * Bu değişkenler ayarlanmadan endpoint "not configured" hatası döner.
 */

import { Router, Request, Response } from "express";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth.js";
import { blockRoles } from "../middlewares/requireRole.js";
import crypto from "crypto";

const router = Router();

function getR2Client(): S3Client | null {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_KEY } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_KEY) return null;
  return new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_KEY,
    },
  });
}

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/webp",
  "application/pdf",
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ── POST /upload/presigned-url ────────────────────────────────────────────────
// Resident veya admin tarafından çağrılır.
// Body: { fileName: string, contentType: string, fileSizeBytes: number }
// Returns: { uploadUrl: string, fileUrl: string, expiresIn: number }

router.post(
  "/upload/presigned-url",
  requireAuth,
  blockRoles("merchant", "security"),
  async (req: Request, res: Response) => {
    const { userId, siteId } = (req as AuthRequest).authUser;
    const body = req.body as {
      fileName?: string;
      contentType?: string;
      fileSizeBytes?: number;
    };

    const { R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env;

    if (!R2_BUCKET_NAME || !R2_PUBLIC_URL) {
      res.status(503).json({
        message: "Dosya yükleme servisi henüz yapılandırılmamış. Lütfen yöneticiyle iletişime geçin.",
        code: "R2_NOT_CONFIGURED",
      });
      return;
    }

    const client = getR2Client();
    if (!client) {
      res.status(503).json({
        message: "Dosya yükleme servisi henüz yapılandırılmamış. Lütfen yöneticiyle iletişime geçin.",
        code: "R2_NOT_CONFIGURED",
      });
      return;
    }

    const { contentType, fileSizeBytes } = body;

    if (!contentType || !ALLOWED_MIME_TYPES.has(contentType)) {
      res.status(400).json({
        message: "Desteklenmeyen dosya türü. Yalnızca JPEG, PNG, WEBP ve PDF yüklenebilir.",
      });
      return;
    }

    if (fileSizeBytes && fileSizeBytes > MAX_FILE_SIZE_BYTES) {
      res.status(400).json({
        message: "Dosya boyutu 10 MB'ı geçemez.",
      });
      return;
    }

    const ext = contentType === "application/pdf" ? "pdf"
      : contentType === "image/png" ? "png"
      : contentType === "image/webp" ? "webp"
      : "jpg";

    const objectKey = `receipts/${siteId}/${userId}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: objectKey,
      ContentType: contentType,
      ...(fileSizeBytes ? { ContentLength: fileSizeBytes } : {}),
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });
    const fileUrl = `${R2_PUBLIC_URL.replace(/\/$/, "")}/${objectKey}`;

    res.json({
      uploadUrl,
      fileUrl,
      expiresIn: 300,
      objectKey,
    });
  },
);

export default router;
