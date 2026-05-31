import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/sites", async (_req: Request, res: Response) => {
  const sites = await prisma.site.findMany();
  res.json(sites.map((s) => ({
    id: s.id, name: s.name, address: s.address,
    adminId: s.adminId, createdAt: s.createdAt.toISOString(),
  })));
});

export default router;
