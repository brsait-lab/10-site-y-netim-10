import { Router, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, messagesTable, usersTable } from "@workspace/db";
import { requireAuth, AuthRequest } from "../middlewares/requireAuth.js";
import { generateId } from "../lib/auth.js";

const router = Router();

function maskSensitiveInfo(text: string): string {
  return text
    .replace(/(\+?90|0)?\s*5\d{2}\s*\d{3}\s*\d{2}\s*\d{2}/g, "***TELEFON***")
    .replace(/\b\d{10,11}\b/g, "***GİZLİ***")
    .replace(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      "***E-POSTA***",
    );
}

function toDto(m: typeof messagesTable.$inferSelect) {
  return {
    id: m.id,
    chatId: m.chatId,
    fromId: m.fromId,
    fromName: m.fromName,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  };
}

router.get("/messages", requireAuth, async (req: Request, res: Response) => {
  const chatId = req.query["chatId"] as string | undefined;

  const rows = chatId
    ? await db
        .select()
        .from(messagesTable)
        .where(eq(messagesTable.chatId, chatId))
    : await db.select().from(messagesTable);

  res.json(rows.map(toDto));
});

router.post("/messages", requireAuth, async (req: Request, res: Response) => {
  const { userId, email } = (req as AuthRequest).authUser;
  const body = req.body as {
    chatId: string;
    content: string;
  };

  const [sender] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  const [row] = await db
    .insert(messagesTable)
    .values({
      id: generateId(),
      chatId: body.chatId,
      fromId: userId,
      fromName: sender?.name ?? email,
      content: maskSensitiveInfo(body.content),
    })
    .returning();

  res.status(201).json(toDto(row!));
});

export default router;
