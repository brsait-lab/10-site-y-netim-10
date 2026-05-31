import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth.js";

const router = Router();

function maskSensitiveInfo(text: string): string {
  return text
    .replace(/(\+?90|0)?\s*5\d{2}\s*\d{3}\s*\d{2}\s*\d{2}/g, "***TELEFON***")
    .replace(/\b\d{10,11}\b/g, "***GİZLİ***")
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "***E-POSTA***");
}

router.get("/messages", requireAuth, async (req: Request, res: Response) => {
  const chatId = req.query["chatId"] as string | undefined;
  const rows = chatId
    ? await prisma.message.findMany({ where: { chatId } })
    : await prisma.message.findMany();
  res.json(rows.map((m) => ({
    id: m.id, chatId: m.chatId, fromId: m.fromId,
    fromName: m.fromName, content: m.content,
    createdAt: m.createdAt.toISOString(),
  })));
});

router.post("/messages", requireAuth, async (req: Request, res: Response) => {
  const { userId, email } = (req as AuthRequest).authUser;
  const body = req.body as { chatId: string; content: string };

  const sender = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

  const row = await prisma.message.create({
    data: {
      chatId: body.chatId, fromId: userId,
      fromName: sender?.name ?? email,
      content: maskSensitiveInfo(body.content),
    },
  });
  res.status(201).json({
    id: row.id, chatId: row.chatId, fromId: row.fromId,
    fromName: row.fromName, content: row.content,
    createdAt: row.createdAt.toISOString(),
  });
});

export default router;
