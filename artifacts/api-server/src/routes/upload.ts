/**
 * Cloudflare R2 Presigned Upload
 *
 * Gerekli ortam değişkenleri:
 *   R2_ACCOUNT_ID     — Cloudflare hesap ID'si
 *   R2_ACCESS_KEY_ID  — R2 erişim anahtarı ID
 *   R2_SECRET_KEY     — R2 gizli anahtar
 *   R2_BUCKET_NAME    — Bucket adı (örn: "site-receipts")
 *   R2_PUBLIC_URL     — Bucket public URL (örn: https://receipts.yourdomain.com)
 *
 * Güvenlik:
 *   - Yalnızca izin verilen MIME tiplerini kabul eder: JPEG, PNG, PDF
 *   - Dosya uzantısı MIME tipi ile eşleşmeli
 *   - Maksimum dosya boyutu: 10 MB
 *   - Presigned URL: 5 dakika (300 saniye) geçerli
 *   - Nesneler site/user bazlı dizin yapısında saklanır
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

// ── İzin verilen MIME tipleri (spec: jpg, jpeg, png, pdf) ────────────────────
const ALLOWED_MIME_TYPES = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"],
  ["image/png", "png"],
  ["application/pdf", "pdf"],
]);

// ── İzin verilen dosya uzantıları ────────────────────────────────────────────
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "pdf"]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

function getExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

// ── POST /upload/presigned-url ────────────────────────────────────────────────
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

    const { contentType, fileSizeBytes, fileName } = body;

    // ── MIME tipi doğrulaması ──────────────────────────────────────────────────
    if (!contentType || !ALLOWED_MIME_TYPES.has(contentType)) {
      res.status(400).json({
        message: "Desteklenmeyen dosya türü. Yalnızca JPEG, PNG ve PDF yüklenebilir.",
        allowedTypes: ["image/jpeg", "image/png", "application/pdf"],
      });
      return;
    }

    // ── Dosya uzantısı doğrulaması ─────────────────────────────────────────────
    if (fileName) {
      const ext = getExtension(fileName);
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        res.status(400).json({
          message: `Desteklenmeyen dosya uzantısı: .${ext}. Yalnızca .jpg, .jpeg, .png ve .pdf kabul edilir.`,
        });
        return;
      }
    }

    // ── Boyut kontrolü ────────────────────────────────────────────────────────
    if (fileSizeBytes !== undefined && fileSizeBytes > MAX_FILE_SIZE_BYTES) {
      res.status(400).json({
        message: `Dosya boyutu 10 MB'ı geçemez. Gönderilen: ${(fileSizeBytes / 1024 / 1024).toFixed(1)} MB.`,
      });
      return;
    }

    const ext = ALLOWED_MIME_TYPES.get(contentType) ?? "jpg";
    const objectKey = `receipts/${siteId}/${userId}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: objectKey,
      ContentType: contentType,
      ...(fileSizeBytes ? { ContentLength: fileSizeBytes } : {}),
    });

    // Presigned URL: 5 dakika geçerli
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
