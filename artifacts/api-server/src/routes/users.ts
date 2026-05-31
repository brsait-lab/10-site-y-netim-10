import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth.js";
import { toUserDto } from "./auth.js";

const router = Router();

router.get("/users", requireAuth, async (req: Request, res: Response) => {
  const { siteId: tokenSiteId } = (req as AuthRequest).authUser;
  const querySiteId = (req.query["siteId"] as string | undefined) ?? tokenSiteId;

  const users = await prisma.user.findMany({ where: { siteId: querySiteId } });
  res.json(users.map(toUserDto));
});

router.patch("/users/:id", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const updates = req.body as {
    name?: string; phone?: string; unitNo?: string; plates?: string[];
    businessName?: string; businessCategory?: string;
    businessDescription?: string; businessAddress?: string;
    latitude?: number; longitude?: number;
  };

  try {
    const updated = await prisma.user.update({ where: { id }, data: updates });
    res.json(toUserDto(updated));
  } catch {
    res.status(404).json({ message: "Kullanıcı bulunamadı." });
  }
});

router.patch("/users/:id/approve", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  try {
    const updated = await prisma.user.update({ where: { id }, data: { status: "active" } });
    res.json(toUserDto(updated));
  } catch {
    res.status(404).json({ message: "Kullanıcı bulunamadı." });
  }
});

router.patch("/users/:id/reject", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  try {
    const updated = await prisma.user.update({ where: { id }, data: { status: "rejected" } });
    res.json(toUserDto(updated));
  } catch {
    res.status(404).json({ message: "Kullanıcı bulunamadı." });
  }
});

export default router;
