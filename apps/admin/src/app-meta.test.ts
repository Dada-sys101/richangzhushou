import { describe, expect, it } from "vitest";

import { APP_META } from "./app-meta";

describe("admin app metadata", () => {
  it("identifies the admin shell", () => {
    expect(APP_META.platform).toBe("admin-web");
  });
});
