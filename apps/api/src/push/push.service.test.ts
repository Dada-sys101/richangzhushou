import { describe, expect, it } from "vitest";

import { endpointHash } from "./push.service.js";

describe("endpointHash", () => {
  it("creates a stable non-reversible lookup key without storing endpoints in indexes", () => {
    const endpoint = "https://push.example.test/subscription/secret";
    const hash = endpointHash(endpoint);
    expect(hash).toHaveLength(64);
    expect(hash).toBe(endpointHash(endpoint));
    expect(hash).not.toContain("secret");
  });
});
