import { describe, expect, it } from "vitest";

import { RECORD_SOURCES, USER_STATUSES } from "./enums.js";

describe("shared enums", () => {
  it("keeps capacity-occupying account states distinct", () => {
    expect(USER_STATUSES).toContain("ACTIVE");
    expect(USER_STATUSES).toContain("SUSPENDED");
    expect(USER_STATUSES).toContain("CLOSED");
  });

  it("keeps AI-assisted sources as record provenance", () => {
    expect(RECORD_SOURCES).toEqual([
      "MANUAL",
      "SHORTCUT",
      "OCR",
      "TEXT",
      "VOICE",
      "IMPORT",
    ]);
  });
});
