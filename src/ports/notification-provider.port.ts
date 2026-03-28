import type { Notification } from "../core/types.js";

export interface NotificationProviderPort {
  sendNotification(notification: Notification): Promise<void>;
}
