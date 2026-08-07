import { Module } from "@nestjs/common";

import { FakeNotificationAdapter } from "./fake-notification.adapter.js";
import { NOTIFICATION_ADAPTER, STORAGE_ADAPTER } from "./integrations.types.js";
import { StorageKeyService } from "./storage-key.service.js";
import { createStorageAdapter, loadStorageConfig } from "./storage.config.js";

@Module({
  providers: [
    { provide: NOTIFICATION_ADAPTER, useClass: FakeNotificationAdapter },
    StorageKeyService,
    {
      provide: STORAGE_ADAPTER,
      useFactory: () => createStorageAdapter(loadStorageConfig()),
    },
  ],
  exports: [NOTIFICATION_ADAPTER, STORAGE_ADAPTER, StorageKeyService],
})
export class IntegrationsModule {}
