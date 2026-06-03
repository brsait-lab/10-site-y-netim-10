/**
 * PHASE 6: Chat Service — Provider-based architecture
 *
 * Bugünkü polling sistemi korunur. Ancak chat katmanı provider tabanlı
 * hale getirilir. 100+ site sonrasında WebSocket'e geçiş kolaylaşır.
 *
 * Kullanım:
 *   const provider = chatService.getProvider();
 *   const messages = await provider.getMessages(chatId, { since, limit });
 *
 * Geçiş yolu:
 *   chatService.useProvider(new WebSocketChatProvider(io));
 *   Rota kodu değişmez.
 *
 * WebSocket altyapısı için socket.io bağımlılığı zaten mevcuttur.
 */

import { prisma } from "../lib/prisma.js";

export interface ChatMessage {
  id: string;
  chatId: string;
  fromId: string;
  fromName: string;
  content: string;
  createdAt: string;
}

export interface GetMessagesOptions {
  since?: Date;
  limit?: number;
  offset?: number;
}

export interface SendMessageOptions {
  chatId: string;
  fromId: string;
  fromName: string;
  content: string;
}

export interface ChatProvider {
  getMessages(chatId: string, options?: GetMessagesOptions): Promise<ChatMessage[]>;
  sendMessage(options: SendMessageOptions): Promise<ChatMessage>;
  onMessageSent?: (chatId: string, message: ChatMessage) => void;
}

// ── Polling Provider (mevcut davranış) ────────────────────────────────────────

class PollingChatProvider implements ChatProvider {
  async getMessages(chatId: string, options: GetMessagesOptions = {}): Promise<ChatMessage[]> {
    const { since, limit = 50, offset = 0 } = options;

    const rows = await prisma.message.findMany({
      where: {
        chatId,
        ...(since ? { createdAt: { gt: since } } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: Math.min(limit, 200),
      skip: offset,
    });

    return rows.map((m) => ({
      id: m.id,
      chatId: m.chatId,
      fromId: m.fromId,
      fromName: m.fromName,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async sendMessage(options: SendMessageOptions): Promise<ChatMessage> {
    const row = await prisma.message.create({
      data: {
        chatId: options.chatId,
        fromId: options.fromId,
        fromName: options.fromName,
        content: options.content,
      },
    });

    const message: ChatMessage = {
      id: row.id,
      chatId: row.chatId,
      fromId: row.fromId,
      fromName: row.fromName,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
    };

    this.onMessageSent?.(options.chatId, message);
    return message;
  }

  onMessageSent?: (chatId: string, message: ChatMessage) => void;
}

// ── WebSocket Provider (gelecek — socket.io hazır) ────────────────────────────
// socket.io bağımlılığı package.json'da mevcuttur.
// Bu sınıf, geçiş için iskelet (scaffold) olarak tutulmaktadır.

export class WebSocketChatProvider extends PollingChatProvider {
  constructor(
    private io: { to(room: string): { emit(event: string, data: unknown): void } },
  ) {
    super();
    this.onMessageSent = (chatId, message) => {
      this.io.to(`chat:${chatId}`).emit("new_message", message);
    };
  }
}

// ── Chat Service ──────────────────────────────────────────────────────────────

class ChatService {
  private provider: ChatProvider;

  constructor() {
    this.provider = new PollingChatProvider();
  }

  getProvider(): ChatProvider {
    return this.provider;
  }

  useProvider(provider: ChatProvider): void {
    this.provider = provider;
  }

  async getMessages(chatId: string, options?: GetMessagesOptions): Promise<ChatMessage[]> {
    return this.provider.getMessages(chatId, options);
  }

  async sendMessage(options: SendMessageOptions): Promise<ChatMessage> {
    return this.provider.sendMessage(options);
  }
}

export const chatService = new ChatService();
