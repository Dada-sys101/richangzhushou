import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { Injectable } from "@nestjs/common";

import type { StorageAdapter } from "./integrations.types.js";

@Injectable()
export class LocalStorageAdapter implements StorageAdapter {
  private readonly baseDir: string;

  constructor() {
    this.baseDir =
      process.env.LOCAL_STORAGE_DIR ??
      path.resolve(process.cwd(), ".local-storage");
  }

  async put(key: string, data: Buffer): Promise<void> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolve(key));
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "ENOENT") {
        throw error;
      }
    }
  }

  private resolve(key: string): string {
    const normalized = path.normalize(key);
    if (path.isAbsolute(normalized) || normalized.startsWith("..")) {
      throw new Error(`Unsafe object key: ${key}`);
    }
    return path.join(this.baseDir, normalized);
  }
}
