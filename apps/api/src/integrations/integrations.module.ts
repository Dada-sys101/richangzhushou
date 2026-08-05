import { Module } from "@nestjs/common";

import { FakeOcrAdapter } from "./fake-ocr.adapter.js";
import { FakeScanAdapter } from "./fake-scan.adapter.js";
import {
  OCR_ADAPTER,
  SCAN_ADAPTER,
  STORAGE_ADAPTER,
} from "./integrations.types.js";
import { LocalStorageAdapter } from "./local-storage.adapter.js";

@Module({
  providers: [
    { provide: OCR_ADAPTER, useClass: FakeOcrAdapter },
    { provide: SCAN_ADAPTER, useClass: FakeScanAdapter },
    { provide: STORAGE_ADAPTER, useClass: LocalStorageAdapter },
  ],
  exports: [OCR_ADAPTER, SCAN_ADAPTER, STORAGE_ADAPTER],
})
export class IntegrationsModule {}
