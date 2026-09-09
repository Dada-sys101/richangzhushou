import { createHash } from "node:crypto";

import { Injectable } from "@nestjs/common";
import webpush from "web-push";

import { PrismaService } from "../prisma/prisma.service.js";
import { PushSecretCipher } from "../push/push-secret-cipher.js";
import {
  NotificationUnavailableError,
  type NotificationAdapter,
  type NotificationMessage,
} from "./integrations.types.js";

const DELIVERY_CLAIM_TIMEOUT_MS = 5 * 60 * 1000;

@Injectable()
export class WebPushNotificationAdapter implements NotificationAdapter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: PushSecretCipher,
  ) {}

  async send(message: NotificationMessage): Promise<{ delivered: boolean }> {
    if (
      process.env.V15_WEB_PUSH_ALLOWED !== "true" ||
      process.env.V15_LIVE_PUSH_ALLOWED !== "true"
    ) {
      return { delivered: false };
    }
    const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
    const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
    const subject = process.env.WEB_PUSH_VAPID_SUBJECT?.trim();
    if (!publicKey || !privateKey || !subject) {
      throw new NotificationUnavailableError("Web Push is not configured");
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { status: "ACTIVE", userId: message.userId },
    });
    if (subscriptions.length === 0) return { delivered: false };

    let delivered = false;
    let transientFailure = false;
    const payload = JSON.stringify({
      body: message.body,
      tag: `reminder-${message.scheduledAt.toISOString()}`,
      title: message.title,
      url: "/reminders",
    });
    for (const subscription of subscriptions) {
      const idempotencyKey = createHash("sha256")
        .update(
          `${message.reminderId ?? "notification"}:${message.scheduledAt.toISOString()}:${subscription.id}`,
        )
        .digest("hex");
      const delivery = await this.prisma.pushDelivery.upsert({
        create: {
          deepLink: "/reminders",
          idempotencyKey,
          payloadFingerprint: createHash("sha256")
            .update(payload)
            .digest("hex"),
          reminderId: message.reminderId,
          subscriptionId: subscription.id,
          userId: message.userId,
        },
        update: {},
        where: { idempotencyKey },
      });
      if (delivery.status === "ACCEPTED_BY_PUSH_SERVICE") {
        delivered = true;
        continue;
      }
      const claimed = await this.prisma.pushDelivery.updateMany({
        data: {
          attemptCount: { increment: 1 },
          lastAttemptAt: new Date(),
          status: "SENDING",
        },
        where: {
          id: delivery.id,
          OR: [
            { status: { in: ["QUEUED", "RETRY_SCHEDULED"] } },
            {
              lastAttemptAt: {
                lt: new Date(Date.now() - DELIVERY_CLAIM_TIMEOUT_MS),
              },
              status: "SENDING",
            },
          ],
        },
      });
      if (claimed.count === 0) continue;
      try {
        await webpush.sendNotification(
          {
            endpoint: this.cipher.decrypt(subscription.endpointCiphertext),
            keys: {
              auth: this.cipher.decrypt(subscription.authCiphertext),
              p256dh: this.cipher.decrypt(subscription.p256dhCiphertext),
            },
          },
          payload,
        );
        delivered = true;
        await this.prisma.$transaction([
          this.prisma.pushSubscription.update({
            data: { failureCount: 0, lastUsedAt: new Date() },
            where: { id: subscription.id },
          }),
          this.prisma.pushDelivery.update({
            data: {
              acceptedAt: new Date(),
              failureCategory: null,
              httpStatus: 201,
              status: "ACCEPTED_BY_PUSH_SERVICE",
            },
            where: { id: delivery.id },
          }),
        ]);
      } catch (error) {
        const statusCode = webPushStatusCode(error);
        if (statusCode === 404 || statusCode === 410) {
          await this.prisma.$transaction([
            this.prisma.pushSubscription.update({
              data: { failureCount: { increment: 1 }, status: "EXPIRED" },
              where: { id: subscription.id },
            }),
            this.prisma.pushDelivery.update({
              data: {
                failedAt: new Date(),
                failureCategory: "EXPIRED_SUBSCRIPTION",
                httpStatus: statusCode,
                status: "EXPIRED_SUBSCRIPTION",
              },
              where: { id: delivery.id },
            }),
          ]);
        } else {
          transientFailure = true;
          await this.prisma.pushDelivery.update({
            data: {
              failureCategory: "TRANSIENT_PROVIDER_ERROR",
              httpStatus: statusCode,
              status: "RETRY_SCHEDULED",
            },
            where: { id: delivery.id },
          });
        }
      }
    }
    if (transientFailure) {
      throw new NotificationUnavailableError("Web Push delivery failed");
    }
    return { delivered };
  }
}

function webPushStatusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) {
    return undefined;
  }
  return typeof error.statusCode === "number" ? error.statusCode : undefined;
}
