import { z } from "zod";

const userSchema = z.object({
  phoneNumber: z.string().min(1),
  name: z.string().min(1),
  googleRefreshToken: z.string().min(1),
  timezone: z.string().optional(),
});

const configSchema = z.object({
  // Provider selection
  messageProvider: z.string().default("whatsapp"),
  aiProvider: z.string().default("groq"),
  calendarProvider: z.string().default("google"),
  notificationProvider: z.string().default("messaging-bridge"),
  httpServer: z.string().default("hono"),

  // WhatsApp
  whatsappAccessToken: z.string().min(1),
  whatsappPhoneNumberId: z.string().min(1),
  whatsappVerifyToken: z.string().min(1),

  // Groq
  groqApiKey: z.string().min(1),
  groqModel: z.string().default("llama-3.3-70b-versatile"),

  // Google Calendar
  googleClientId: z.string().min(1),
  googleClientSecret: z.string().min(1),

  // Users (optional — can also be loaded from JSON file at runtime)
  users: z.preprocess(
    (val) => {
      if (!val || val === "") return [];
      return typeof val === "string" ? JSON.parse(val) : val;
    },
    z.array(userSchema).default([]),
  ),

  // App
  appUrl: z.string().optional(),
  dataDir: z.string().default("./data"),
  port: z.coerce.number().default(3000),
  timezone: z.string().default("Asia/Kolkata"),
  dailySummaryCron: z.string().default("0 8 * * *"),
  reminderCheckCron: z.string().default("* * * * *"),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(): AppConfig {
  return configSchema.parse({
    messageProvider: process.env.MESSAGE_PROVIDER,
    aiProvider: process.env.AI_PROVIDER,
    calendarProvider: process.env.CALENDAR_PROVIDER,
    notificationProvider: process.env.NOTIFICATION_PROVIDER,
    httpServer: process.env.HTTP_SERVER,

    whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN,

    groqApiKey: process.env.GROQ_API_KEY,
    groqModel: process.env.GROQ_MODEL,

    googleClientId: process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,

    users: process.env.USERS,

    appUrl: process.env.APP_URL,
    dataDir: process.env.DATA_DIR,
    port: process.env.PORT,
    timezone: process.env.TIMEZONE,
    dailySummaryCron: process.env.DAILY_SUMMARY_CRON,
    reminderCheckCron: process.env.REMINDER_CHECK_CRON,
  });
}
