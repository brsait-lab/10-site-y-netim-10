/**
 * PHASE 11 — PRIORITY 2: Notification Pipeline Activation
 *
 * Doğrudan Prisma erişimi kaldırıldı.
 * Gerçek akış: Route → NotificationService → DB + QueueService → PushService
 *
 * NotificationService.send() çağrısı:
 *   1. DB'ye notification kaydı oluşturur
 *   2. QueueService'e push_notification job'u ekler
 *   3. QueueService → PushService.sendToTargets() çağırır
 */

import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth.js";
import { blockRoles } from "../middlewares/requireRole.js";
import { addAuditLog } from "../lib/audit.js";
import { requireActiveSubscription } from "../middlewares/requireActiveSubscription.js";
import { notificationService } from "../services/NotificationService.js";

const router = Router();

const SECURITY_OPERATIONAL_TYPES = ["parking", "elevator", "security_info", "cargo_density"] as const;

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

function toDto(
  n: Awaited<ReturnType<typeof prisma.notification.findFirst>>,
  readByIds: string[] = [],
) {
  if (!n) return null;
  return {
    id: n.id, type: n.type, title: n.title, message: n.message,
    fromUserId: n.fromUserId, fromName: n.fromName,
    toRoles: n.toRoles ?? undefined, toUserIds: n.toUserIds ?? undefined,
    siteId: n.siteId,
    readBy: readByIds,
    createdAt: n.createdAt.toISOString(),
  };
}

router.get("/notifications", requireAuth, blockRoles("merchant"), async (req: Request, res: Response) => {
  const { siteId } = (req as AuthRequest).authUser;

  const rawLimit = parseInt((req.query["limit"] as string) ?? "", 10);
  const rawOffset = parseInt((req.query["offset"] as string) ?? "0", 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  const rows = await notificationService.getForSite(siteId, limit, offset);

  if (rows.length === 0) {
    res.json([]);
    return;
  }

  const notifIds = rows.map((n) => n.id);
  const reads = await prisma.notificationRead.findMany({
    where: { notificationId: { in: notifIds } },
    select: { notificationId: true, userId: true },
  });

  const readMap = new Map<string, string[]>();
  for (const r of reads) {
    const existing = readMap.get(r.notificationId);
    if (existing) existing.push(r.userId);
    else readMap.set(r.notificationId, [r.userId]);
  }

  res.json(rows.map((n) => toDto(n, readMap.get(n.id) ?? [])));
});

// PHASE 11 PRIORITY 2: Route → NotificationService → QueueService → PushService
// PHASE 11 PRIORITY 3: requireActiveSubscription() eklendi
// PHASE 1: fromUserId ve fromName artık body'den alınmıyor.
router.post(
  "/notifications",
  requireAuth,
  blockRoles("merchant"),
  requireActiveSubscription(),
  async (req: Request, res: Response) => {
    const { userId, role, siteId: tokenSiteId } = (req as AuthRequest).authUser;
    const body = req.body as {
      type: string; title: string; message: string;
      toRoles?: string[]; toUserIds?: string[];
    };

    if (role === "resident") {
      const allowedTypes = ["noise", "package", "general"];
      if (!allowedTypes.includes(body.type)) {
        res.status(403).json({ message: "Sakinler gürültü, kargo veya genel bildirim gönderebilir." });
        return;
      }

      if (body.type === "noise") {
        const targetUserId = body.toUserIds?.[0];
        if (targetUserId) {
          const dayStart = new Date();
          dayStart.setHours(0, 0, 0, 0);
          const count = await prisma.notification.count({
            where: {
              fromUserId: userId,
              type: "noise",
              toUserIds: { has: targetUserId },
              createdAt: { gte: dayStart },
            },
          });
          if (count >= 1) {
            res.status(429).json({ message: "Aynı kişiye bugün zaten gürültü bildirimi gönderdiniz." });
            return;
          }
        }
      }

      if (body.type === "package") {
        const toRoles = body.toRoles ?? [];
        const toUserIds = body.toUserIds ?? [];
        const targetsSecurity =
          toRoles.includes("security") ||
          (toUserIds.length > 0 &&
            (await prisma.user.count({
              where: { id: { in: toUserIds }, role: { not: "security" }, siteId: tokenSiteId },
            })) === 0);

        if (!targetsSecurity || toRoles.some((r) => r !== "security")) {
          res.status(403).json({ message: "Kargo bildirimi yalnızca güvenlik görevlilerine gönderilebilir." });
          return;
        }
      }
    }

    if (role === "security") {
      const isOperational = (SECURITY_OPERATIONAL_TYPES as readonly string[]).includes(body.type);
      const toRoles = body.toRoles ?? [];
      if (!isOperational || toRoles.includes("merchant")) {
        if (toRoles.includes("merchant")) {
          res.status(403).json({ message: "Güvenlik görevlisi esnafa bildirim gönderemez." });
          return;
        }
      }
    }

    // PHASE 1: Sender kimliği her zaman token + DB'den alınır
    const sender = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    const fromName = sender?.name ?? "Bilinmiyor";

    // PHASE 11 PRIORITY 2: NotificationService → QueueService → PushService pipeline
    const result = await notificationService.send({
      siteId: tokenSiteId,
      type: body.type,
      title: body.title,
      message: body.message,
      fromUserId: userId,
      fromName,
      toRoles: body.toRoles,
      toUserIds: body.toUserIds,
    });

    await addAuditLog({
      siteId: tokenSiteId,
      action: "notification_sent",
      performedBy: userId,
      note: `Tür: ${body.type} — "${body.title}" — hedef roller: ${(body.toRoles ?? []).join(",")} — push: ${result.pushSent}`,
    });

    const row = await prisma.notification.findUnique({ where: { id: result.id } });
    res.status(201).json(toDto(row, []));
  },
);

router.patch("/notifications/:id/read", requireAuth, blockRoles("merchant"), async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { userId, siteId } = (req as AuthRequest).authUser;

  const exists = await prisma.notification.findUnique({ where: { id }, select: { id: true, siteId: true } });
  if (!exists || exists.siteId !== siteId) { res.status(404).json({ message: "Bildirim bulunamadı." }); return; }

  await notificationService.markRead(id, userId);

  res.status(204).end();
});

export default router;
