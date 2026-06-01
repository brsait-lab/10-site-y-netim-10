import { Request, Response, NextFunction } from "express";
import { verifyToken, AuthUser } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";

export interface AuthRequest extends Request {
  authUser: AuthUser;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers["authorization"];
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Yetkilendirme başlığı eksik." });
    return;
  }
  const token = header.slice(7);
  let decoded: AuthUser;
  try {
    decoded = verifyToken(token);
  } catch {
    res.status(401).json({ message: "Geçersiz veya süresi dolmuş token." });
    return;
  }

  // Session version check: invalidates tokens issued before a transfer or forced logout
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { sessionVersion: true, deletedAt: true },
  });

  if (!user || user.deletedAt) {
    res.status(401).json({ message: "Hesap bulunamadı veya silinmiş." });
    return;
  }

  if ((decoded.sessionVersion ?? 0) !== user.sessionVersion) {
    res.status(401).json({ message: "Oturum sonlandırıldı. Lütfen tekrar giriş yapın." });
    return;
  }

  (req as AuthRequest).authUser = decoded;
  next();
}
