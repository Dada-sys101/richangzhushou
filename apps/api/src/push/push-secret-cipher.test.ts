import { afterEach, describe, expect, it } from "vitest";

import { PushSecretCipher } from "./push-secret-cipher.js";

const previousKey = process.env.WEB_PUSH_ENCRYPTION_KEY;

afterEach(() => {
  if (previousKey === undefined) delete process.env.WEB_PUSH_ENCRYPTION_KEY;
  else process.env.WEB_PUSH_ENCRYPTION_KEY = previousKey;
});

describe("PushSecretCipher", () => {
  it("encrypts subscription secrets with authenticated randomized ciphertext", () => {
    process.env.WEB_PUSH_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
      "base64",
    );
    const cipher = new PushSecretCipher();
    const first = cipher.encrypt("https://push.example.test/secret");
    const second = cipher.encrypt("https://push.example.test/secret");
    expect(first).not.toBe(second);
    expect(cipher.decrypt(first)).toBe("https://push.example.test/secret");
  });

  it("fails closed when the encryption key is missing", () => {
    delete process.env.WEB_PUSH_ENCRYPTION_KEY;
    const cipher = new PushSecretCipher();
    expect(cipher.configured()).toBe(false);
    expect(() => cipher.encrypt("secret")).toThrow(/32-byte key/);
  });
});
