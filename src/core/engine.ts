import type { MessageProviderPort } from "../ports/message-provider.port.js";
import type { AIProviderPort } from "../ports/ai-provider.port.js";
import type { LoggerPort } from "../ports/logger.port.js";
import type { IntentHandler, IncomingMessage, AIContext, HandlerPorts, ConversationMessage } from "./types.js";
import { DomainEventType } from "./types.js";
import type { EventBus } from "./events.js";
import type { UserRegistry } from "./user-registry.js";

export interface EngineDeps {
  messaging: MessageProviderPort;
  ai: AIProviderPort;
  logger: LoggerPort;
  eventBus: EventBus;
  handlers: Map<string, IntentHandler>;
  timezone: string;
  userRegistry: UserRegistry;
  getOAuthUrl?: (phoneNumber: string) => string | null;
}

const MAX_HISTORY = 30;

export class Engine {
  private readonly processedMessages = new LRUSet<string>(1000);
  private readonly conversationHistory = new Map<string, ConversationMessage[]>();

  constructor(private readonly deps: EngineDeps) {}

  private getHistory(userId: string): ConversationMessage[] {
    return this.conversationHistory.get(userId) ?? [];
  }

  private addToHistory(userId: string, role: "user" | "assistant", content: string): void {
    const history = this.getHistory(userId);
    history.push({ role, content });
    if (history.length > MAX_HISTORY) history.shift();
    this.conversationHistory.set(userId, history);
  }

  async handleIncomingWebhook(rawBody: unknown): Promise<void> {
    const { messaging, ai, logger, eventBus } = this.deps;

    const message = messaging.parseIncoming(rawBody);
    if (!message) return;

    // Deduplicate
    if (this.processedMessages.has(message.id)) {
      logger.debug("Duplicate message, skipping", { messageId: message.id });
      return;
    }
    this.processedMessages.add(message.id);

    eventBus.emit(DomainEventType.MESSAGE_RECEIVED, { message });
    logger.info("Message received", { from: message.from, text: message.text });

    const user = this.deps.userRegistry.get(message.from);
    if (!user) {
      logger.warn("Message from unregistered user", { from: message.from });
      const oauthUrl = this.deps.getOAuthUrl?.(message.from);
      const text = oauthUrl
        ? `Welcome! To use this bot, connect your Google Calendar:\n${oauthUrl}`
        : "Sorry, you're not registered to use this bot.";
      await messaging.sendMessage({ to: message.from, text });
      return;
    }

    try {
      const context = this.buildAIContext(message.from, user.timezone);
      const intent = await ai.parseIntent(message.text, context);
      this.addToHistory(message.from, "user", message.text);

      eventBus.emit(DomainEventType.INTENT_PARSED, { intent, message });
      logger.info("Intent parsed", { type: intent.type, confidence: intent.confidence });

      const handler = this.deps.handlers.get(intent.type);
      if (!handler) {
        logger.warn("No handler for intent type", { type: intent.type });
        return;
      }

      const handlerPorts: HandlerPorts = {
        calendar: user.calendar,
        ai: this.deps.ai,
        logger: this.deps.logger,
      };

      const result = await handler.execute({
        intent,
        message,
        ports: handlerPorts,
        aiContext: context,
      });

      logger.debug("Handler result", { responseText: result.responseText.substring(0, 100) });

      await messaging.sendMessage({
        to: message.from,
        text: result.responseText,
      });

      this.addToHistory(message.from, "assistant", result.responseText);
      logger.info("Reply sent", { to: message.from });

      eventBus.emit(DomainEventType.REPLY_SENT, {
        to: message.from,
        text: result.responseText,
      });
    } catch (error) {
      logger.error("Error processing message", {
        messageId: message.id,
        error: error instanceof Error ? error.message : String(error),
      });

      eventBus.emit(DomainEventType.ERROR_OCCURRED, {
        error: error instanceof Error ? error : new Error(String(error)),
        context: `Processing message ${message.id}`,
      });

      await this.sendErrorReply(message);
    }
  }

  private async sendErrorReply(message: IncomingMessage): Promise<void> {
    try {
      await this.deps.messaging.sendMessage({
        to: message.from,
        text: "Sorry, something went wrong processing your message. Please try again.",
      });
    } catch {
      this.deps.logger.error("Failed to send error reply", { to: message.from });
    }
  }

  private buildAIContext(userId?: string, timezone?: string): AIContext {
    const tz = timezone ?? this.deps.timezone;
    return {
      timezone: tz,
      currentDate: new Date().toLocaleDateString("en-US", {
        timeZone: tz,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      conversationHistory: userId ? this.getHistory(userId) : undefined,
    };
  }
}

// Simple LRU set for deduplication
class LRUSet<T> {
  private items: T[] = [];

  constructor(private readonly maxSize: number) {}

  has(item: T): boolean {
    return this.items.includes(item);
  }

  add(item: T): void {
    if (this.items.length >= this.maxSize) {
      this.items.shift();
    }
    this.items.push(item);
  }
}
