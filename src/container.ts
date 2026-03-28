import type { AppConfig } from "./core/config.js";
import { EventBus } from "./core/events.js";
import { Engine } from "./core/engine.js";
import { Scheduler } from "./core/scheduler.js";
import { UserRegistry } from "./core/user-registry.js";
import type { UserConfig } from "./core/user-registry.js";
import { OAuthNonceStore } from "./core/oauth-nonce-store.js";
import { buildHandlerRegistry } from "./handlers/_registry.js";

// Adapters — this is the ONLY file that imports them
import { ConsoleLogger } from "./adapters/logger/console.adapter.js";
import { HonoAdapter } from "./adapters/http/hono.adapter.js";
import { GroqAdapter } from "./adapters/ai/groq.adapter.js";
import { WhatsAppAdapter } from "./adapters/messaging/whatsapp.adapter.js";
import { GoogleCalendarAdapter } from "./adapters/calendar/google.adapter.js";
import { MessagingBridgeNotifier } from "./adapters/notification/messaging-bridge.adapter.js";
import { JsonFileUserStore } from "./adapters/persistence/json-file.adapter.js";

// Ports
import type { LoggerPort } from "./ports/logger.port.js";
import type { HttpServerPort } from "./ports/http-server.port.js";
import type { AIProviderPort } from "./ports/ai-provider.port.js";
import type { MessageProviderPort } from "./ports/message-provider.port.js";
import type { CalendarProviderPort } from "./ports/calendar-provider.port.js";
import type { NotificationProviderPort } from "./ports/notification-provider.port.js";

export interface Container {
  config: AppConfig;
  logger: LoggerPort;
  http: HttpServerPort;
  ai: AIProviderPort;
  messaging: MessageProviderPort;
  notification: NotificationProviderPort;
  userRegistry: UserRegistry;
  engine: Engine;
  eventBus: EventBus;
  scheduler: Scheduler;
  oauthNonceStore: OAuthNonceStore;
  userStore: JsonFileUserStore;
  getOAuthUrl: (phoneNumber: string) => string | null;
  linkUser: (phoneNumber: string, name: string, refreshToken: string) => void;
}

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const CALENDAR_SCOPES = "https://www.googleapis.com/auth/calendar";

export async function createContainer(config: AppConfig): Promise<Container> {
  // Infrastructure
  const logger = createLogger(config);
  const eventBus = new EventBus();

  // Adapters
  const http = createHttpServer(config);
  const ai = createAIProvider(config);
  const messaging = createMessagingProvider(config);
  const notification = createNotificationProvider(config, messaging);

  // Persistence
  const userStore = new JsonFileUserStore(config.dataDir);
  const oauthNonceStore = new OAuthNonceStore();

  // User registry — merge env var users + JSON file users (env var wins on duplicates)
  const userRegistry = new UserRegistry();
  const persistedUsers = userStore.load();

  // Build a merged user list: start with persisted, overlay with env var
  const mergedUsers = new Map<string, UserConfig>();
  for (const pu of persistedUsers) {
    mergedUsers.set(pu.phoneNumber, pu);
  }
  for (const eu of config.users) {
    mergedUsers.set(eu.phoneNumber, eu);
  }

  for (const userConfig of mergedUsers.values()) {
    const calendar = createCalendarProvider(
      config,
      userConfig.googleRefreshToken,
      userConfig.timezone ?? config.timezone,
      logger,
    );
    userRegistry.register({
      phoneNumber: userConfig.phoneNumber,
      name: userConfig.name,
      timezone: userConfig.timezone ?? config.timezone,
      calendar,
    });
    logger.info("Registered user", { name: userConfig.name, phone: userConfig.phoneNumber });
  }

  // OAuth helpers
  function getOAuthUrl(phoneNumber: string): string | null {
    if (!config.appUrl) return null;
    const nonce = oauthNonceStore.create(phoneNumber);
    const params = new URLSearchParams({
      client_id: config.googleClientId,
      redirect_uri: `${config.appUrl}/oauth/callback`,
      response_type: "code",
      scope: CALENDAR_SCOPES,
      access_type: "offline",
      prompt: "consent",
      state: nonce,
    });
    return `${GOOGLE_AUTH_URL}?${params}`;
  }

  function linkUser(phoneNumber: string, name: string, refreshToken: string): void {
    const timezone = config.timezone;
    const calendar = createCalendarProvider(config, refreshToken, timezone, logger);

    if (userRegistry.has(phoneNumber)) {
      userRegistry.update(phoneNumber, { calendar });
      logger.info("Re-linked user calendar", { phone: phoneNumber });
    } else {
      userRegistry.register({ phoneNumber, name, timezone, calendar });
      logger.info("Linked new user", { name, phone: phoneNumber });
    }

    userStore.save({ phoneNumber, name, googleRefreshToken: refreshToken, timezone });
  }

  // Core
  const handlers = buildHandlerRegistry();
  const engine = new Engine({
    messaging,
    ai,
    logger,
    eventBus,
    handlers,
    timezone: config.timezone,
    userRegistry,
    getOAuthUrl,
  });

  const scheduler = new Scheduler({
    userRegistry,
    notification,
    logger,
    eventBus,
    timezone: config.timezone,
    dailySummaryCron: config.dailySummaryCron,
    reminderCheckCron: config.reminderCheckCron,
  });

  return {
    config,
    logger,
    http,
    ai,
    messaging,
    notification,
    userRegistry,
    engine,
    eventBus,
    scheduler,
    oauthNonceStore,
    userStore,
    getOAuthUrl,
    linkUser,
  };
}

// ─── Factory functions ──────────────────────────────────────────

function createLogger(_config: AppConfig): LoggerPort {
  return new ConsoleLogger();
}

function createHttpServer(_config: AppConfig): HttpServerPort {
  return new HonoAdapter();
}

function createAIProvider(config: AppConfig): AIProviderPort {
  switch (config.aiProvider) {
    case "groq":
      return new GroqAdapter(config.groqApiKey, config.groqModel);
    default:
      throw new Error(`Unknown AI provider: ${config.aiProvider}`);
  }
}

function createMessagingProvider(config: AppConfig): MessageProviderPort {
  switch (config.messageProvider) {
    case "whatsapp":
      return new WhatsAppAdapter(
        config.whatsappAccessToken,
        config.whatsappPhoneNumberId,
        config.whatsappVerifyToken,
      );
    default:
      throw new Error(`Unknown message provider: ${config.messageProvider}`);
  }
}

function createCalendarProvider(
  config: AppConfig,
  refreshToken: string,
  timezone: string,
  logger: LoggerPort,
): CalendarProviderPort {
  switch (config.calendarProvider) {
    case "google":
      return new GoogleCalendarAdapter(
        config.googleClientId,
        config.googleClientSecret,
        refreshToken,
        timezone,
        logger,
      );
    default:
      throw new Error(`Unknown calendar provider: ${config.calendarProvider}`);
  }
}

function createNotificationProvider(
  config: AppConfig,
  messaging: MessageProviderPort,
): NotificationProviderPort {
  switch (config.notificationProvider) {
    case "messaging-bridge":
      return new MessagingBridgeNotifier(messaging);
    default:
      throw new Error(`Unknown notification provider: ${config.notificationProvider}`);
  }
}
