import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth.js";
import { blockRoles } from "../middlewares/requireRole.js";

const router = Router();

// ─── List admin transfer history for the current site ─────────────────────────
router.get(
  "/admin-transfers",
  requireAuth,
  blockRoles("resident", "security", "merchant"),
  async (req: Request, res: Response) => {
    const { siteId } = (req as AuthRequest).authUser;

    const transfers = await prisma.adminTransfer.findMany({
      where: { siteId },
      orderBy: { transferredAt: "desc" },
    });

    res.json(
      transfers.map((t) => ({
        id: t.id,
        siteId: t.siteId,
        oldAdminId: t.oldAdminId,
        newAdminId: t.newAdminId,
        reason: t.reason ?? undefined,
        transferredAt: t.transferredAt.toISOString(),
      })),
    );
  },
);

export default router;
