import { createHash } from "node:crypto";

import {
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service.js";
import type {
  DeletePushSubscriptionDto,
  SavePushSubscriptionDto,
} from "./dto/push-subscription.dto.js";
import { PushSecretCipher } from "./push-secret-cipher.js";

@Injectable()
export class PushService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: PushSecretCipher,
  ) {}

  config() {
    const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ?? "";
    const enabled =
      process.env.V15_WEB_PUSH_ALLOWED === "true" &&
      process.env.V15_LIVE_PUSH_ALLOWED === "true" &&
      this.cipher.configured() &&
      Boolean(publicKey);
    return { enabled, publicKey: enabled ? publicKey : null };
  }

  async status(userId: string) {
    const subscriptions = await this.prisma.pushSubscription.count({
      where: { status: "ACTIVE", userId },
    });
    return { ...this.config(), subscribed: subscriptions > 0, subscriptions };
  }

  async save(userId: string, dto: SavePushSubscriptionDto, userAgent?: string) {
    if (!this.config().enabled) {
      throw new ServiceUnavailableException("Web Push is not enabled");
    }
    const hash = endpointHash(dto.endpoint);
    const existing = await this.prisma.pushSubscription.findUnique({
      select: { userId: true },
      where: { endpointHash: hash },
    });
    if (existing && existing.userId !== userId) {
      throw new ConflictException(
        "This browser subscription belongs to another account",
      );
    }
    await this.prisma.pushSubscription.upsert({
      create: {
        authCiphertext: this.cipher.encrypt(dto.keys.auth),
        endpointCiphertext: this.cipher.encrypt(dto.endpoint),
        endpointHash: hash,
        p256dhCiphertext: this.cipher.encrypt(dto.keys.p256dh),
        failureCount: 0,
        status: "ACTIVE",
        userAgent: userAgent?.slice(0, 255),
        userId,
      },
      update: {
        authCiphertext: this.cipher.encrypt(dto.keys.auth),
        endpointCiphertext: this.cipher.encrypt(dto.endpoint),
        failureCount: 0,
        p256dhCiphertext: this.cipher.encrypt(dto.keys.p256dh),
        status: "ACTIVE",
        userAgent: userAgent?.slice(0, 255),
      },
      where: { endpointHash: hash },
    });
    return this.status(userId);
  }

  async remove(userId: string, dto: DeletePushSubscriptionDto): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({
      where: { endpointHash: endpointHash(dto.endpoint), userId },
    });
  }
}

export function endpointHash(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex");
}
