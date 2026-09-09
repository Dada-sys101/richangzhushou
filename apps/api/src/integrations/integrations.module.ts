import { Module } from "@nestjs/common";
import { PushModule } from "../push/push.module.js";

import { FakeNotificationAdapter } from "./fake-notification.adapter.js";
import { NOTIFICATION_ADAPTER, STORAGE_ADAPTER } from "./integrations.types.js";
import { StorageKeyService } from "./storage-key.service.js";
import { createStorageAdapter, loadStorageConfig } from "./storage.config.js";
import { WebPushNotificationAdapter } from "./web-push-notification.adapter.js";

@Module({
  imports: [PushModule],
  providers: [
    FakeNotificationAdapter,
    WebPushNotificationAdapter,
    {
      provide: NOTIFICATION_ADAPTER,
      inject: [FakeNotificationAdapter, WebPushNotificationAdapter],
      useFactory: (
        fake: FakeNotificationAdapter,
        push: WebPushNotificationAdapter,
      ) =>
        process.env.V15_LIVE_PUSH_ALLOWED === "true" &&
        process.env.V15_WEB_PUSH_ALLOWED === "true"
          ? push
          : fake,
    },
    StorageKeyService,
    {
      provide: STORAGE_ADAPTER,
      useFactory: () => createStorageAdapter(loadStorageConfig()),
    },
  ],
  exports: [NOTIFICATION_ADAPTER, STORAGE_ADAPTER, StorageKeyService],
})
export class IntegrationsModule {}
