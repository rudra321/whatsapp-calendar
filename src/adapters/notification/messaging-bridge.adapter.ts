import type { NotificationProviderPort } from "../../ports/notification-provider.port.js";
import type { MessageProviderPort } from "../../ports/message-provider.port.js";
import type { Notification } from "../../core/types.js";

export class MessagingBridgeNotifier implements NotificationProviderPort {
  constructor(private readonly messaging: MessageProviderPort) {}

  async sendNotification(notification: Notification): Promise<void> {
    let text = `*${notification.title}*\n${notification.body}`;

    if (notification.event) {
      const time = notification.event.isAllDay
        ? "All day"
        : notification.event.startTime.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          });
      text += `\n\n${notification.event.title} — ${time}`;
      if (notification.event.location) {
        text += `\n📍 ${notification.event.location}`;
      }
    }

    await this.messaging.sendMessage({
      to: notification.userId,
      text,
    });
  }
}
