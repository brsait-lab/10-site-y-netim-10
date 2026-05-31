import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "./requireAuth.js";

/**
 * Middleware that blocks access if the authenticated user's role
 * is in the `blockedRoles` list. Must be used after `requireAuth`.
 */
export function blockRoles(...blockedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { role } = (req as AuthRequest).authUser;
    if (blockedRoles.includes(role)) {
      res.status(403).json({ message: "Bu işlem için yetkiniz bulunmuyor." });
      return;
    }
    next();
  };
}

/**
 * Middleware that only allows access if the authenticated user's role
 * is in the `allowedRoles` list. Must be used after `requireAuth`.
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { role } = (req as AuthRequest).authUser;
    if (!allowedRoles.includes(role)) {
      res.status(403).json({ message: "Bu işlem için yetkiniz bulunmuyor." });
      return;
    }
    next();
  };
}
