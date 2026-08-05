import { describe, expect, it } from "vitest";

import { API_BASE_PATH, BUSINESS_TIME_ZONE, DEFAULT_CURRENCY } from "./index";

describe("shared configuration", () => {
  it("keeps stable public defaults", () => {
    expect(API_BASE_PATH).toBe("/api/v1");
    expect(BUSINESS_TIME_ZONE).toBe("Asia/Shanghai");
    expect(DEFAULT_CURRENCY).toBe("CNY");
  });
});
