import { Injectable } from "@nestjs/common";

import type { ScanAdapter } from "./integrations.types.js";

@Injectable()
export class FakeScanAdapter implements ScanAdapter {
  async scan(): Promise<{ status: "SCANNED" | "FAILED"; reason?: string }> {
    if (process.env.FAKE_SCAN_FAIL === "true") {
      return { status: "FAILED", reason: "Simulated scan failure" };
    }
    return { status: "SCANNED" };
  }
}
