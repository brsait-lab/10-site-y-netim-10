import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth.js";
import { blockRoles } from "../middlewares/requireRole.js";
import { addAuditLog } from "../lib/audit.js";

const router = Router();

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

function vendorToDto(v: Awaited<ReturnType<typeof prisma.vendor.findFirst>>) {
  if (!v) return null;
  return {
    id: v.id, userId: v.userId, name: v.name, category: v.category,
    description: v.description, phone: v.phone, address: v.address,
    latitude: v.latitude ?? undefined, longitude: v.longitude ?? undefined,
    status: v.status, createdAt: v.createdAt.toISOString(),
  };
}

function requestToDto(r: Awaited<ReturnType<typeof prisma.vendorRequest.findFirst>>) {
  if (!r) return null;
  return {
    id: r.id, siteId: r.siteId, requestedBy: r.requestedBy,
    vendorId: r.vendorId ?? undefined, title: r.title,
    description: r.description, status: r.status,
    assignedAt: r.assignedAt?.toISOString(),
    completedAt: r.completedAt?.toISOString(),
    createdAt: r.createdAt.toISOString(),
  };
}

router.get("/vendor-categories", async (_req: Request, res: Response) => {
  const cats = await prisma.vendorCategory.findMany({ orderBy: { name: "asc" } });
  res.json(cats.map((c) => ({
    id: c.id, name: c.name, description: c.description,
    createdAt: c.createdAt.toISOString(),
  })));
});

router.get("/vendors", requireAuth, async (req: Request, res: Response) => {
  const { userId, role } = (req as AuthRequest).authUser;

  if (role === "merchant") {
    const vendor = await prisma.vendor.findFirst({ where: { userId } });
    return res.json(vendor ? [vendorToDto(vendor)] : []);
  }

  const rawLimit = parseInt((req.query["limit"] as string) ?? "", 10);
  const rawOffset = parseInt((req.query["offset"] as string) ?? "0", 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  const vendors = await prisma.vendor.findMany({
    where: { status: "active" },
    orderBy: { name: "asc" },
    take: limit,
    skip: offset,
  });
  res.json(vendors.map(vendorToDto));
});

router.post("/vendors", requireAuth, async (req: Request, res: Response) => {
  const { userId } = (req as AuthRequest).authUser;
  const body = req.body as {
    name: string; category: string; description?: string;
    phone?: string; address?: string; latitude?: number; longitude?: number;
  };

  const existing = await prisma.vendor.findFirst({ where: { userId } });
  if (existing) {
    res.status(400).json({ message: "Bu kullanıcı için zaten bir esnaf profili mevcut." });
    return;
  }

  const vendor = await prisma.vendor.create({
    data: {
      userId, name: body.name, category: body.category,
      description: body.description ?? "", phone: body.phone ?? "",
      address: body.address ?? "", latitude: body.latitude,
      longitude: body.longitude, status: "active",
    },
  });
  res.status(201).json(vendorToDto(vendor));
});

router.patch("/vendors/:id", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { userId } = (req as AuthRequest).authUser;
  const body = req.body as {
    name?: string; category?: string; description?: string;
    phone?: string; address?: string; latitude?: number; longitude?: number; status?: string;
  };

  const vendor = await prisma.vendor.findUnique({ where: { id } });
  if (!vendor) { res.status(404).json({ message: "Esnaf bulunamadı." }); return; }
  if (vendor.userId !== userId) { res.status(403).json({ message: "Bu esnaf profilini düzenleme yetkiniz yok." }); return; }

  const updated = await prisma.vendor.update({ where: { id }, data: body });
  res.json(vendorToDto(updated));
});

router.get("/vendor-requests", requireAuth, async (req: Request, res: Response) => {
  const { userId, siteId, role } = (req as AuthRequest).authUser;

  const rawLimit = parseInt((req.query["limit"] as string) ?? "", 10);
  const rawOffset = parseInt((req.query["offset"] as string) ?? "0", 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;
  const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

  if (role === "merchant") {
    const vendor = await prisma.vendor.findFirst({ where: { userId } });
    if (!vendor) return res.json([]);
    const requests = await prisma.vendorRequest.findMany({
      where: { vendorId: vendor.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });
    return res.json(requests.map(requestToDto));
  }

  const requests = await prisma.vendorRequest.findMany({
    where: { siteId },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });
  res.json(requests.map(requestToDto));
});

router.post("/vendor-requests", requireAuth, async (req: Request, res: Response) => {
  const { userId, siteId } = (req as AuthRequest).authUser;
  const body = req.body as { vendorId?: string; title: string; description: string };

  const request = await prisma.vendorRequest.create({
    data: {
      siteId, requestedBy: userId,
      vendorId: body.vendorId ?? null,
      title: body.title, description: body.description,
      status: body.vendorId ? "assigned" : "pending",
      assignedAt: body.vendorId ? new Date() : null,
    },
  });

  await addAuditLog({
    siteId,
    action: "vendor_request_created",
    performedBy: userId,
    note: `Talep: ${body.title}${body.vendorId ? ` — esnaf ID: ${body.vendorId}` : " — esnaf atanmadı"}`,
  });

  res.status(201).json(requestToDto(request));
});

router.patch("/vendor-requests/:id/status", requireAuth, blockRoles("resident", "security"), async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { siteId, role, userId } = (req as AuthRequest).authUser;
  const { status } = req.body as { status: string };

  const request = await prisma.vendorRequest.findUnique({ where: { id } });
  if (!request) { res.status(404).json({ message: "Talep bulunamadı." }); return; }

  if (role === "admin" && request.siteId !== siteId) {
    res.status(403).json({ message: "Bu talep bu siteye ait değil." });
    return;
  }

  if (role === "merchant") {
    const vendor = await prisma.vendor.findFirst({ where: { userId } });
    if (!vendor || request.vendorId !== vendor.id) {
      res.status(403).json({ message: "Yalnızca size atanmış talepleri güncelleyebilirsiniz." });
      return;
    }
  }

  const updated = await prisma.vendorRequest.update({
    where: { id },
    data: { status, completedAt: status === "completed" ? new Date() : undefined },
  });

  await addAuditLog({
    siteId: request.siteId,
    action: "vendor_request_updated",
    performedBy: userId,
    note: `Talep durum: ${request.status} → ${status} — "${request.title}"`,
  });

  res.json(requestToDto(updated));
});

export default router;
