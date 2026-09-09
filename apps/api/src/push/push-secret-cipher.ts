import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { Injectable, ServiceUnavailableException } from "@nestjs/common";

@Injectable()
export class PushSecretCipher {
  encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key(), iv);
    const encrypted = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    return [iv, cipher.getAuthTag(), encrypted]
      .map((part) => part.toString("base64url"))
      .join(".");
  }

  decrypt(value: string): string {
    const [ivValue, tagValue, encryptedValue] = value.split(".");
    if (!ivValue || !tagValue || !encryptedValue) {
      throw new Error("Invalid encrypted Push subscription value");
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key(),
      Buffer.from(ivValue, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  }

  configured(): boolean {
    try {
      this.key();
      return true;
    } catch {
      return false;
    }
  }

  private key(): Buffer {
    const value = process.env.WEB_PUSH_ENCRYPTION_KEY?.trim();
    const key = value ? Buffer.from(value, "base64") : Buffer.alloc(0);
    if (key.length !== 32) {
      throw new ServiceUnavailableException(
        "WEB_PUSH_ENCRYPTION_KEY must be a base64-encoded 32-byte key",
      );
    }
    return key;
  }
}
