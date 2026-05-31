import { Request, Response, NextFunction } from "express";
import { verifyToken, AuthUser } from "../lib/auth.js";

export interface AuthRequest extends Request {
  authUser: AuthUser;
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers["authorization"];
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Yetkilendirme başlığı eksik." });
    return;
  }
  const token = header.slice(7);
  try {
    (req as AuthRequest).authUser = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ message: "Geçersiz veya süresi dolmuş token." });
  }
}
