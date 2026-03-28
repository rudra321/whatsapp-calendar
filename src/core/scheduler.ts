import { Cron } from "croner";
import type { NotificationProviderPort } from "../ports/notification-provider.port.js";
import type { LoggerPort } from "../ports/logger.port.js";
import type { EventBus } from "./events.js";
import { DomainEventType } from "./types.js";
import type { UserRegistry } from "./user-registry.js";

export interface SchedulerDeps {
  userRegistry: UserRegistry;
  notification: NotificationProviderPort;
  logger: LoggerPort;
  eventBus: EventBus;
  timezone: string;
  dailySummaryCron: string;
  reminderCheckCron: string;
}

export class Scheduler {
  private readonly sentReminders = new Set<string>();
  private jobs: Cron[] = [];

  constructor(private readonly deps: SchedulerDeps) {}

  start(): void {
    // Daily summary cron
    this.jobs.push(
      new Cron(this.deps.dailySummaryCron, { timezone: this.deps.timezone }, () => {
        this.sendDailySummary().catch((err) => {
          this.deps.logger.error("Daily summary failed", {
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }),
    );

    // Reminder check cron (every minute)
    this.jobs.push(
      new Cron(this.deps.reminderCheckCron, { timezone: this.deps.timezone }, () => {
        this.checkReminders().catch((err) => {
          this.deps.logger.error("Reminder check failed", {
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }),
    );

    this.deps.logger.info("Scheduler started");
  }

  stop(): void {
    for (const job of this.jobs) {
      job.stop();
    }
    this.jobs = [];
    this.deps.logger.info("Scheduler stopped");
  }

  private async sendDailySummary(): Promise<void> {
    const { userRegistry, notification, logger } = this.deps;

    for (const user of userRegistry.getAll()) {
      try {
        const startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date();
        endDate.setHours(23, 59, 59, 999);

        const events = await user.calendar.listEvents({ startDate, endDate });

        const dateStr = new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          timeZone: user.timezone,
        });

        let body: string;
        if (events.length === 0) {
          body = `No events scheduled for today. Enjoy your free day!`;
        } else {
          const list = events
            .map((e) => {
              const time = e.isAllDay
                ? "All day"
                : `${formatTime(e.startTime)} - ${formatTime(e.endTime)}`;
              const location = e.location ? ` @ ${e.location}` : "";
              return `• ${time} — ${e.title}${location}`;
            })
            .join("\n");
          body = `You have ${events.length} event(s) today:\n\n${list}`;
        }

        await notification.sendNotification({
          userId: user.phoneNumber,
          title: `📅 ${dateStr}`,
          body,
        });

        logger.info("Daily summary sent", { user: user.name, eventCount: events.length });
      } catch (err) {
        logger.error("Daily summary failed for user", {
          user: user.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  private async checkReminders(): Promise<void> {
    const { userRegistry, notification, logger } = this.deps;

    const now = new Date();
    const thirtyMinutesLater = new Date(now.getTime() + 30 * 60 * 1000);

    for (const user of userRegistry.getAll()) {
      try {
        const events = await user.calendar.listEvents({
          startDate: now,
          endDate: thirtyMinutesLater,
        });

        for (const event of events) {
          if (event.isAllDay) continue;

          const minutesUntil = Math.round(
            (event.startTime.getTime() - now.getTime()) / (60 * 1000),
          );

          // Send reminder at ~15 minutes before
          if (minutesUntil <= 15 && minutesUntil > 0) {
            const reminderKey = `${user.phoneNumber}:${event.id}-15`;
            if (this.sentReminders.has(reminderKey)) continue;
            this.sentReminders.add(reminderKey);

            await notification.sendNotification({
              userId: user.phoneNumber,
              title: `⏰ Reminder`,
              body: `Starting in ${minutesUntil} minutes`,
              event,
            });

            logger.info("Reminder sent", { user: user.name, eventId: event.id, minutesUntil });
          }
        }
      } catch (err) {
        logger.error("Reminder check failed for user", {
          user: user.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Clean up old reminders (keep set from growing unbounded)
    if (this.sentReminders.size > 500) {
      this.sentReminders.clear();
    }
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
