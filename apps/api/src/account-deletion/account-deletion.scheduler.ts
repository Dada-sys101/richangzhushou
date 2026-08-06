import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";

import { AccountDeletionService } from "./account-deletion.service.js";

@Injectable()
export class AccountDeletionScheduler implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly accountDeletionService: AccountDeletionService,
  ) {}

  onModuleInit(): void {
    if (process.env.ACCOUNT_DELETION_SCHEDULER_ENABLED === "true") {
      const intervalMs = Number(
        process.env.ACCOUNT_DELETION_SCHEDULER_INTERVAL_MS ?? 60_000,
      );
      this.timer = setInterval(() => {
        void this.accountDeletionService.runCleanup();
      }, intervalMs);
      this.timer.unref?.();
    }
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
