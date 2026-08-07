import { describe, expect, it } from "vitest";

import { APP_META } from "./app-meta";

describe("web app metadata", () => {
  it("identifies the PWA shell", () => {
    expect(APP_META).toEqual({
      name: "日常助手",
      nameEn: "Daily Assistant",
      platform: "web-pwa",
    });
  });
});
