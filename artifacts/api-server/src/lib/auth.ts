import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

export interface AuthUser {
  userId: string;
  role: string;
  siteId: string;
  email: string;
  sessionVersion: number;
}

const JWT_SECRET = process.env["SESSION_SECRET"] ?? "dev-secret-change-me";
const BCRYPT_ROUNDS = 10;

export function signToken(payload: AuthUser): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): AuthUser {
  return jwt.verify(token, JWT_SECRET) as AuthUser;
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
