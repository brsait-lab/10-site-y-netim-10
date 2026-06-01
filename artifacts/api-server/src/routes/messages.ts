import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth.js";

const router = Router();

const DEFAULT_MSG_LIMIT = 100;
const MAX_MSG_LIMIT = 500;

function maskSensitiveInfo(text: string): string {
  return text
    .replace(/(\+?90|0)?\s*5\d{2}\s*\d{3}\s*\d{2}\s*\d{2}/g, "***TELEFON***")
    .replace(/\b\d{10,11}\b/g, "***GİZLİ***")
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "***E-POSTA***")
    .replace(/\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b/g, "***IBAN***")
    .replace(/\bTR\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{2}\b/gi, "***IBAN***");
}

function toMessageDto(m: { id: string; chatId: string; fromId: string; fromName: string; content: string; createdAt: Date }) {
  return {
    id: m.id, chatId: m.chatId, fromId: m.fromId,
    fromName: m.fromName, content: m.content,
    createdAt: m.createdAt.toISOString(),
  };
}

router.get("/messages", requireAuth, async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).authUser;
  const chatId = req.query["chatId"] as string | undefined;

  const rawLimit = parseInt((req.query["limit"] as string) ?? "", 10);
  const rawOffset = parseInt((req.query["offset"] as string) ?? "0", 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(rawLimit, MAX_MSG_LIMIT) : DEFAULT_MSG_LIMIT;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  if (chatId) {
    const isParticipant = await prisma.chatParticipant.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!isParticipant) {
      res.status(403).json({ message: "Bu sohbete erişim yetkiniz yok." });
      return;
    }
    const rows = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: "asc" },
      take: limit,
      skip: offset,
    });
    return res.json(rows.map(toMessageDto));
  }

  const participations = await prisma.chatParticipant.findMany({
    where: { userId },
    select: { chatId: true },
  });
  const chatIds = participations.map((p) => p.chatId);

  if (chatIds.length === 0) {
    return res.json([]);
  }

  const rows = await prisma.message.findMany({
    where: { chatId: { in: chatIds } },
    orderBy: { createdAt: "asc" },
    take: limit,
    skip: offset,
  });
  res.json(rows.map(toMessageDto));
});

router.post("/messages", requireAuth, async (req: Request, res: Response) => {
  const { userId, email } = (req as AuthRequest).authUser;
  const body = req.body as { chatId: string; content: string };

  const chat = await prisma.chat.findUnique({ where: { id: body.chatId } });
  if (!chat) { res.status(404).json({ message: "Sohbet bulunamadı." }); return; }
  if (chat.status === "closed") { res.status(400).json({ message: "Kapalı bir sohbete mesaj gönderilemez." }); return; }

  const isParticipant = await prisma.chatParticipant.findUnique({
    where: { chatId_userId: { chatId: body.chatId, userId } },
  });
  if (!isParticipant) { res.status(403).json({ message: "Bu sohbete erişim yetkiniz yok." }); return; }

  const sender = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

  const row = await prisma.message.create({
    data: {
      chatId: body.chatId, fromId: userId,
      fromName: sender?.name ?? email,
      content: maskSensitiveInfo(body.content),
    },
  });
  res.status(201).json(toMessageDto(row));
});

export default router;
