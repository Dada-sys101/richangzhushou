import { describe, expect, it } from "vitest";

import { HealthController } from "./health.controller.js";

describe("HealthController", () => {
  it("returns a non-sensitive liveness response", () => {
    expect(new HealthController().getHealth()).toEqual({
      service: "daily-assistant-api",
      status: "ok",
    });
  });
});
