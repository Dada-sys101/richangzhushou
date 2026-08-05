import { Injectable } from "@nestjs/common";

import { ApiException } from "./api-error.js";

@Injectable()
export class RateLimiterService {
  private readonly windows = new Map<string, number[]>();

  consume(key: string, limit: number, windowMs: number): void {
    const now = Date.now();
    const cutoff = now - windowMs;
    const hits = (this.windows.get(key) ?? []).filter((t) => t > cutoff);
    if (hits.length >= limit) {
      this.windows.set(key, hits);
      throw new ApiException("RATE_LIMITED", 429, "Too many requests");
    }
    hits.push(now);
    this.windows.set(key, hits);
  }

  reset(): void {
    this.windows.clear();
  }
}
