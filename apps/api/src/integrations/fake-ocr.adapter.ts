import { Injectable } from "@nestjs/common";

import { OcrUnavailableError, type OcrAdapter } from "./integrations.types.js";

@Injectable()
export class FakeOcrAdapter implements OcrAdapter {
  async recognize(): Promise<{ text: string }> {
    const text = process.env.FAKE_OCR_TEXT;
    if (!text) {
      throw new OcrUnavailableError(
        "Fake OCR provider is not configured (set FAKE_OCR_TEXT)",
      );
    }
    return { text };
  }
}
