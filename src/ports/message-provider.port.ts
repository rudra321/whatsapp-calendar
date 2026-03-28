import type { IncomingMessage, OutgoingMessage } from "../core/types.js";

export interface MessageProviderPort {
  parseIncoming(rawBody: unknown): IncomingMessage | null;
  sendMessage(message: OutgoingMessage): Promise<void>;
  verifyWebhook?(queryParams: Record<string, string>): string | null;
}
