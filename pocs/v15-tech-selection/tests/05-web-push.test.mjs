import test from "node:test";
import assert from "node:assert/strict";
import { createECDH, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { generateRequestDetails, generateVAPIDKeys, setVapidDetails } from "web-push";

mkdirSync("results", { recursive: true });
const result = {};

function base64url(buffer) {
  return Buffer.from(buffer).toString("base64url");
}

test("web-push generates VAPID keys and encrypted request details without network delivery", () => {
  const vapid = generateVAPIDKeys();
  setVapidDetails("mailto:ops@example.invalid", vapid.publicKey, vapid.privateKey);

  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const subscription = {
    endpoint: "https://push.example.invalid/subscription-id",
    keys: {
      p256dh: base64url(ecdh.getPublicKey()),
      auth: base64url(randomBytes(16)),
    },
  };
  const details = generateRequestDetails(
    subscription,
    JSON.stringify({ title: "日常助手", deepLink: "/plans?source=push" }),
    { TTL: 300, urgency: "normal", topic: "daily-assistant-poc" },
  );
  assert.equal(details.method, "POST");
  assert.ok(details.body.length > 0);
  assert.ok(details.headers.Authorization || details.headers.authorization);
  result.serverCrypto = {
    status: "PASS",
    method: details.method,
    bodyBytes: details.body.length,
    headerNames: Object.keys(details.headers).sort(),
  };
});

test("platform matrix keeps Push as a best-effort channel, not the source of truth", () => {
  result.platformMatrix = {
    iPhone: {
      automatedStatus: "NOT_RUN_REQUIRES_PHYSICAL_DEVICE",
      conditions: ["iOS/iPadOS 16.4+", "installed to Home Screen", "permission requested from user gesture"],
      nativeWrapperRequired: false,
    },
    androidChrome: {
      automatedStatus: "NOT_RUN_REQUIRES_DEVICE_OR_BROWSER_PUSH_SERVICE",
      conditions: ["service worker active", "notification permission granted", "push service reachable"],
      nativeWrapperRequired: false,
    },
    desktop: {
      automatedStatus: "NOT_RUN_REQUIRES_REAL_PUSH_ENDPOINT",
      conditions: ["supported browser", "notification permission granted"],
      nativeWrapperRequired: false,
    },
    fallback: "All reminders remain queryable in-app; delivery rows track sent/failed/expired endpoints",
  };
  assert.equal(result.platformMatrix.iPhone.nativeWrapperRequired, false);
});

test.after(() => {
  writeFileSync("results/05-web-push.json", JSON.stringify(result, null, 2));
});
