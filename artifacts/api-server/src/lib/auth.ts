import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

export interface AuthUser {
  userId: string;
  role: string;
  siteId: string;
  email: string;
  sessionVersion: number;
}

const IS_PRODUCTION = process.env["NODE_ENV"] === "production";

/**
 * JWT signing key.
 * Uses JWT_SECRET exclusively — SESSION_SECRET is no longer a fallback.
 * In development, falls back to a built-in key with a warning (startup validator
 * also warns). In production, startup crashes if JWT_SECRET is unset.
 */
function getJwtSecret(): string {
  const secret = process.env["JWT_SECRET"];
  if (!secret) {
    if (IS_PRODUCTION) {
      throw new Error("[AUTH] JWT_SECRET is required in production.");
    }
    return "dev-jwt-secret-change-me-before-prod!!";
  }
  return secret;
}

const BCRYPT_ROUNDS = 10;

export function signToken(payload: AuthUser): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "24h" });
}

export function verifyToken(token: string): AuthUser {
  return jwt.verify(token, getJwtSecret()) as AuthUser;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function generateId(): string {
  return crypto.randomUUID();
}
