import { Module } from "@nestjs/common";

import { FakeOcrAdapter } from "./fake-ocr.adapter.js";
import { FakeNotificationAdapter } from "./fake-notification.adapter.js";
import { FakeScanAdapter } from "./fake-scan.adapter.js";
import {
  NOTIFICATION_ADAPTER,
  OCR_ADAPTER,
  SCAN_ADAPTER,
  STORAGE_ADAPTER,
} from "./integrations.types.js";
import { LocalStorageAdapter } from "./local-storage.adapter.js";

@Module({
  providers: [
    { provide: NOTIFICATION_ADAPTER, useClass: FakeNotificationAdapter },
    { provide: OCR_ADAPTER, useClass: FakeOcrAdapter },
    { provide: SCAN_ADAPTER, useClass: FakeScanAdapter },
    { provide: STORAGE_ADAPTER, useClass: LocalStorageAdapter },
  ],
  exports: [NOTIFICATION_ADAPTER, OCR_ADAPTER, SCAN_ADAPTER, STORAGE_ADAPTER],
})
export class IntegrationsModule {}
