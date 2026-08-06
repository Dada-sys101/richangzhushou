import { Module } from "@nestjs/common";

import { FakeNotificationAdapter } from "./fake-notification.adapter.js";
import { NOTIFICATION_ADAPTER, STORAGE_ADAPTER } from "./integrations.types.js";
import { LocalStorageAdapter } from "./local-storage.adapter.js";

@Module({
  providers: [
    { provide: NOTIFICATION_ADAPTER, useClass: FakeNotificationAdapter },
    { provide: STORAGE_ADAPTER, useClass: LocalStorageAdapter },
  ],
  exports: [NOTIFICATION_ADAPTER, STORAGE_ADAPTER],
})
export class IntegrationsModule {}
