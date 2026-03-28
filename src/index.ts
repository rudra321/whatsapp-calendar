import { loadConfig } from "./core/config.js";
import { createContainer } from "./container.js";
import { DomainEventType } from "./core/types.js";

const config = loadConfig();
const container = await createContainer(config);

const { http, engine, logger, eventBus, scheduler } = container;

// ─── Event logging ──────────────────────────────────────────────
eventBus.on(DomainEventType.MESSAGE_RECEIVED, ({ message }) => {
  logger.debug("Event: message received", { from: message.from });
});

eventBus.on(DomainEventType.ERROR_OCCURRED, ({ error, context }) => {
  logger.error("Event: error occurred", { error: error.message, context });
});

// ─── Routes ─────────────────────────────────────────────────────
http.get("/health", () => ({
  status: 200,
  body: {
    status: "ok",
    providers: {
      messaging: config.messageProvider,
      ai: config.aiProvider,
      calendar: config.calendarProvider,
      http: config.httpServer,
    },
    uptime: process.uptime(),
  },
}));

// WhatsApp webhook verification
http.get("/webhook", (ctx) => {
  if (!container.messaging.verifyWebhook) {
    return { status: 404, body: { error: "Webhook verification not supported" } };
  }
  const challenge = container.messaging.verifyWebhook(ctx.query);
  if (challenge) {
    return { status: 200, body: challenge };
  }
  return { status: 403, body: { error: "Verification failed" } };
});

// WhatsApp webhook incoming messages
http.post("/webhook", async (ctx) => {
  // Return 200 immediately, process async
  engine.handleIncomingWebhook(ctx.body).catch((err) => {
    logger.error("Unhandled webhook error", {
      error: err instanceof Error ? err.message : String(err),
    });
  });

  return { status: 200, body: { status: "ok" } };
});

// ─── OAuth callback ─────────────────────────────────────────────
const TOKEN_URL = "https://oauth2.googleapis.com/token";

http.get("/oauth/callback", async (ctx) => {
  const { code, state, error: oauthError } = ctx.query;

  if (oauthError) {
    logger.warn("OAuth denied by user", { error: oauthError });
    return { status: 400, body: "OAuth authorization was denied." };
  }

  if (!state || !code) {
    return { status: 400, body: "Missing code or state parameter." };
  }

  // Validate nonce
  const phoneNumber = container.oauthNonceStore.consume(state);
  if (!phoneNumber) {
    return { status: 400, body: "Invalid or expired link. Please message the bot again to get a new link." };
  }

  // Exchange code for tokens
  try {
    const tokenResponse = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.googleClientId,
        client_secret: config.googleClientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: `${config.appUrl}/oauth/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      logger.error("OAuth token exchange failed", { error: err });
      return { status: 500, body: "Failed to exchange authorization code. Please try again." };
    }

    const tokens = (await tokenResponse.json()) as { refresh_token?: string };
    if (!tokens.refresh_token) {
      logger.error("No refresh token in OAuth response");
      return { status: 500, body: "No refresh token received. Please try again." };
    }

    // Register / update user
    const name = phoneNumber; // default name to phone number; user can update later
    container.linkUser(phoneNumber, name, tokens.refresh_token);

    // Send WhatsApp confirmation
    container.messaging
      .sendMessage({
        to: phoneNumber,
        text: "Google Calendar connected! You can now send me messages to manage your calendar.",
      })
      .catch((err) => {
        logger.error("Failed to send OAuth confirmation", {
          error: err instanceof Error ? err.message : String(err),
        });
      });

    return { status: 200, body: "Google Calendar connected! You can close this tab and return to WhatsApp." };
  } catch (err) {
    logger.error("OAuth callback error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { status: 500, body: "Something went wrong. Please message the bot again to retry." };
  }
});

// ─── Start ──────────────────────────────────────────────────────
await http.listen(config.port);
logger.info(`wa-cal started on port ${config.port}`, {
  providers: {
    messaging: config.messageProvider,
    ai: config.aiProvider,
    calendar: config.calendarProvider,
  },
});

// Start scheduled jobs
scheduler.start();
logger.info("Scheduler started", {
  dailySummary: config.dailySummaryCron,
  reminderCheck: config.reminderCheckCron,
});
