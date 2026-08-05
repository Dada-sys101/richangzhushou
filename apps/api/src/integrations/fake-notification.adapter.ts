import { Injectable } from "@nestjs/common";

import {
  NotificationUnavailableError,
  type NotificationAdapter,
  type NotificationMessage,
} from "./integrations.types.js";

@Injectable()
export class FakeNotificationAdapter implements NotificationAdapter {
  private readonly delivered: NotificationMessage[] = [];

  async send(message: NotificationMessage): Promise<{ delivered: boolean }> {
    if (process.env.FAKE_NOTIFICATION_FAIL === "true") {
      throw new NotificationUnavailableError(
        "Notification provider is temporarily unavailable",
      );
    }
    this.delivered.push(message);
    return { delivered: true };
  }

  deliveredMessages(): NotificationMessage[] {
    return [...this.delivered];
  }

  reset(): void {
    this.delivered.length = 0;
  }
}
