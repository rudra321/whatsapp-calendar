import type { MessageProviderPort } from "../../ports/message-provider.port.js";
import type { IncomingMessage, OutgoingMessage } from "../../core/types.js";
import { MessageDeliveryError } from "../../core/errors.js";

const WHATSAPP_API_BASE = "https://graph.facebook.com/v25.0";

export class WhatsAppAdapter implements MessageProviderPort {
  constructor(
    private readonly accessToken: string,
    private readonly phoneNumberId: string,
    private readonly verifyToken: string,
  ) {}

  parseIncoming(rawBody: unknown): IncomingMessage | null {
    try {
      const body = rawBody as any;
      const entry = body?.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;

      // Skip status updates
      if (value?.statuses) return null;

      const message = value?.messages?.[0];
      if (!message || message.type !== "text") return null;

      return {
        id: message.id,
        from: message.from,
        text: message.text.body,
        timestamp: new Date(parseInt(message.timestamp, 10) * 1000),
        raw: rawBody,
      };
    } catch {
      return null;
    }
  }

  async sendMessage(message: OutgoingMessage): Promise<void> {
    const url = `${WHATSAPP_API_BASE}/${this.phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: message.to,
        type: "text",
        text: { body: message.text },
      }),
    });

    const responseBody = await response.text();

    if (!response.ok) {
      throw new MessageDeliveryError(
        `WhatsApp API error ${response.status}: ${responseBody}`,
      );
    }

    // Check for errors returned with 200 status (Meta API quirk)
    try {
      const json = JSON.parse(responseBody);
      if (json.error) {
        throw new MessageDeliveryError(
          `WhatsApp API error in response: ${responseBody}`,
        );
      }
    } catch (e) {
      if (e instanceof MessageDeliveryError) throw e;
    }
  }

  verifyWebhook(queryParams: Record<string, string>): string | null {
    const mode = queryParams["hub.mode"];
    const token = queryParams["hub.verify_token"];
    const challenge = queryParams["hub.challenge"];

    if (mode === "subscribe" && token === this.verifyToken) {
      return challenge ?? null;
    }
    return null;
  }
}
