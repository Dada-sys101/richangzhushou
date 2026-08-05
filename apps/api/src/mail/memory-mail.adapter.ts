import { Injectable } from "@nestjs/common";

import type { RecoveryMail, RecoveryMailKind } from "./mail.adapter.js";
import { MailAdapter } from "./mail.adapter.js";

interface StoredMail extends RecoveryMail {
  sentAt: Date;
}

/**
 * In-memory fake used by tests and local development. It never writes the
 * recovery token to logs, stdout, or any persistent store.
 */
@Injectable()
export class MemoryMailAdapter implements MailAdapter {
  private readonly messages: StoredMail[] = [];

  async sendRecovery(mail: RecoveryMail): Promise<void> {
    this.messages.push({ ...mail, sentAt: new Date() });
  }

  getLatestToken(email: string, kind: RecoveryMailKind): string | null {
    for (let index = this.messages.length - 1; index >= 0; index -= 1) {
      const message = this.messages[index];
      if (!message) {
        continue;
      }
      if (message.email === email && message.kind === kind) {
        return message.token;
      }
    }
    return null;
  }

  getMessageCount(): number {
    return this.messages.length;
  }

  reset(): void {
    this.messages.length = 0;
  }
}
