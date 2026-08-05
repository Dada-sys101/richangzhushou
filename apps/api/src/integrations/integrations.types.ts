export class OcrUnavailableError extends Error {
  constructor(message = "OCR provider is temporarily unavailable") {
    super(message);
    this.name = "OcrUnavailableError";
  }
}

export interface OcrAdapter {
  recognize(data: Buffer, mimeType: string): Promise<{ text: string }>;
}

export interface StorageAdapter {
  put(key: string, data: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

export interface ScanAdapter {
  scan(
    data: Buffer,
    mimeType: string,
  ): Promise<{ status: "SCANNED" | "FAILED"; reason?: string }>;
}

export const STORAGE_ADAPTER = Symbol("STORAGE_ADAPTER");
export const OCR_ADAPTER = Symbol("OCR_ADAPTER");
export const SCAN_ADAPTER = Symbol("SCAN_ADAPTER");
