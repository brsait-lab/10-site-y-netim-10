import type { BullMQQueueProvider } from "../services/BullMQQueueProvider.js";

let _provider: BullMQQueueProvider | null = null;

export function setBullMQProvider(p: BullMQQueueProvider): void {
  _provider = p;
}

export function getBullMQProvider(): BullMQQueueProvider | null {
  return _provider;
}
