import { Router, Request, Response } from "express";
import { db, sitesTable } from "@workspace/db";

const router = Router();

router.get("/sites", async (_req: Request, res: Response) => {
  const sites = await db.select().from(sitesTable);
  res.json(
    sites.map((s) => ({
      id: s.id,
      name: s.name,
      address: s.address,
      adminId: s.adminId,
      createdAt: s.createdAt.toISOString(),
    })),
  );
});

export default router;
