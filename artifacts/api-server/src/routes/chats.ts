import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth.js";
import { blockRoles } from "../middlewares/requireRole.js";

const router = Router();

function chatToDto(c: Awaited<ReturnType<typeof prisma.chat.findFirst>>) {
  if (!c) return null;
  return {
    id: c.id,
    siteId: c.siteId,
    title: c.title,
    status: c.status,
    createdBy: c.createdBy,
    closedBy: c.closedBy ?? undefined,
    closedAt: c.closedAt?.toISOString(),
    createdAt: c.createdAt.toISOString(),
  };
}

// All roles can list their own chats (vendors only see chats they were invited to)
router.get("/chats", requireAuth, async (req: Request, res: Response) => {
  const { userId, siteId } = (req as AuthRequest).authUser;

  const participations = await prisma.chatParticipant.findMany({
    where: { userId },
    select: { chatId: true },
  });
  const chatIds = participations.map((p) => p.chatId);

  const chats = await prisma.chat.findMany({
    where: {
      id: { in: chatIds },
      siteId,
      NOT: { deletedFor: { has: userId } },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(chats.map(chatToDto));
});

router.get("/chats/:id/participants", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { userId } = (req as AuthRequest).authUser;

  const chat = await prisma.chat.findUnique({ where: { id } });
  if (!chat) { res.status(404).json({ message: "Sohbet bulunamadı." }); return; }

  const isParticipant = await prisma.chatParticipant.findUnique({
    where: { chatId_userId: { chatId: id, userId } },
  });
  if (!isParticipant) { res.status(403).json({ message: "Bu sohbete erişim yetkiniz yok." }); return; }

  const participants = await prisma.chatParticipant.findMany({ where: { chatId: id } });
  res.json(participants.map((p) => ({
    id: p.id,
    chatId: p.chatId,
    userId: p.userId,
    joinedAt: p.joinedAt.toISOString(),
  })));
});

// Vendors CANNOT create chats — only admin, resident, security can initiate
router.post("/chats", requireAuth, blockRoles("merchant"), async (req: Request, res: Response) => {
  const { userId, siteId } = (req as AuthRequest).authUser;
  const body = req.body as { title: string; participantIds: string[] };

  if (!body.title?.trim()) {
    res.status(400).json({ message: "Sohbet başlığı zorunludur." });
    return;
  }

  const chat = await prisma.chat.create({
    data: {
      siteId,
      title: body.title.trim(),
      createdBy: userId,
      status: "open",
      deletedFor: [],
    },
  });

  const participantIds = Array.from(new Set([userId, ...(body.participantIds ?? [])]));
  await prisma.chatParticipant.createMany({
    data: participantIds.map((uid) => ({ chatId: chat.id, userId: uid })),
    skipDuplicates: true,
  });

  res.status(201).json(chatToDto(chat));
});

// Vendors cannot close chats either — only the creator / admin can
router.patch("/chats/:id/close", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { userId, role } = (req as AuthRequest).authUser;

  const chat = await prisma.chat.findUnique({ where: { id } });
  if (!chat) { res.status(404).json({ message: "Sohbet bulunamadı." }); return; }
  if (chat.status === "closed") { res.status(400).json({ message: "Sohbet zaten kapalı." }); return; }

  // Vendors can't close chats
  if (role === "merchant") {
    res.status(403).json({ message: "Sohbet kapatma yetkiniz yok." });
    return;
  }

  const updated = await prisma.chat.update({
    where: { id },
    data: { status: "closed", closedBy: userId, closedAt: new Date() },
  });
  res.json(chatToDto(updated));
});

router.delete("/chats/:id", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { userId } = (req as AuthRequest).authUser;

  const chat = await prisma.chat.findUnique({ where: { id } });
  if (!chat) { res.status(404).json({ message: "Sohbet bulunamadı." }); return; }

  const isParticipant = await prisma.chatParticipant.findUnique({
    where: { chatId_userId: { chatId: id, userId } },
  });
  if (!isParticipant) { res.status(403).json({ message: "Bu sohbete erişim yetkiniz yok." }); return; }

  if (!chat.deletedFor.includes(userId)) {
    await prisma.chat.update({
      where: { id },
      data: { deletedFor: [...chat.deletedFor, userId] },
    });
  }
  res.status(204).end();
});

export default router;
