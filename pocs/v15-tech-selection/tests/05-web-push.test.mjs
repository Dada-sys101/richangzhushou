import test from "node:test";
import assert from "node:assert/strict";
import { createECDH, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import webPushPackage from "web-push";
import {
  PUSH_DELIVERY_STATES,
  PUSH_ERROR_MESSAGES_ZH_CN,
  PUSH_LIMITS,
  PushError,
  buildPushIdempotencyKey,
  buildPushRequestInput,
  classifyPushFailure,
  classifyPushResponse,
  computeRetryDelayMs,
  executePushDelivery,
  normalizeDeepLink,
  normalizePushOptions,
  normalizePushPayload,
  validatePushSubscription,
  validateVapidConfig,
} from "../lib/web-push-core.mjs";
import { createWebPushRequestFactory } from "../lib/web-push-node.mjs";

const { generateVAPIDKeys } = webPushPackage;
mkdirSync("results", { recursive: true });
const result = {};

function base64url(buffer) {
  return Buffer.from(buffer).toString("base64url");
}

function subscriptionFixture(overrides = {}) {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    endpoint: "https://push.example.invalid/subscription-id",
    keys: {
      p256dh: base64url(ecdh.getPublicKey()),
      auth: base64url(randomBytes(16)),
    },
    ...overrides,
  };
}

function vapidFixture(overrides = {}) {
  const keys = generateVAPIDKeys();
  return {
    subject: "mailto:ops@example.invalid",
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
    ...overrides,
  };
}

function assertPushError(error, code) {
  return error instanceof PushError && error.code === code;
}

function repositoryHarness({ claimed = true } = {}) {
  const calls = {
    claims: [],
    attempts: [],
    results: [],
    deactivations: [],
  };
  return {
    calls,
    repository: {
      async claimPushDelivery(value) {
        calls.claims.push(value);
        return claimed;
      },
      async recordPushAttempt(value) {
        calls.attempts.push(value);
      },
      async recordPushResult(value) {
        calls.results.push(value);
      },
      async deactivatePushSubscription(value) {
        calls.deactivations.push(value);
      },
    },
  };
}

function deliveryInput(overrides = {}) {
  return {
    messageId: "message-1",
    subscriptionId: "subscription-1",
    subscription: subscriptionFixture(),
    payload: {
      title: "日常助手",
      body: "你有一条待办事项",
      deepLink: "/plans?source=push",
    },
    options: { ttl: 300, urgency: "normal", topic: "daily-assistant" },
    attempt: 1,
    now: () => Date.parse("2026-08-09T00:00:00.000Z"),
    ...overrides,
  };
}

test("server adapter generates encrypted VAPID request details without network delivery", async () => {
  const requestFactory = createWebPushRequestFactory(vapidFixture());
  const details = await requestFactory({
    subscription: subscriptionFixture(),
    payload: {
      title: "日常助手",
      body: "提醒内容",
      deepLink: "/plans?source=push",
    },
    options: { ttl: 300, urgency: "normal", topic: "daily-assistant" },
  });

  assert.equal(details.method, "POST");
  assert.ok(details.body.length > 0);
  assert.ok(details.headers.Authorization || details.headers.authorization);
  assert.equal(details.headers.TTL ?? details.headers.ttl, 300);
  result.serverRequest = {
    status: "PASS",
    method: details.method,
    bodyBytes: details.body.length,
    headerNames: Object.keys(details.headers).sort(),
  };
});

test("VAPID configuration and subscription validation expose stable errors", () => {
  const validVapid = vapidFixture();
  assert.deepEqual(validateVapidConfig(validVapid), validVapid);
  assert.throws(
    () => validateVapidConfig({ ...validVapid, subject: "ftp://invalid" }),
    (error) => assertPushError(error, "PUSH_VAPID_SUBJECT_INVALID"),
  );
  assert.throws(
    () =>
      validateVapidConfig({
        ...validVapid,
        privateKey: base64url(randomBytes(8)),
      }),
    (error) => assertPushError(error, "PUSH_VAPID_PRIVATE_KEY_INVALID"),
  );

  const validSubscription = subscriptionFixture();
  assert.equal(
    validatePushSubscription(validSubscription).endpoint,
    validSubscription.endpoint,
  );
  assert.throws(
    () =>
      validatePushSubscription({
        ...validSubscription,
        endpoint: "http://push.example.invalid/subscription-id",
      }),
    (error) => assertPushError(error, "PUSH_ENDPOINT_INSECURE"),
  );
  assert.throws(
    () =>
      validatePushSubscription({
        ...validSubscription,
        keys: {
          ...validSubscription.keys,
          p256dh: base64url(randomBytes(32)),
        },
      }),
    (error) => assertPushError(error, "PUSH_P256DH_INVALID"),
  );
  assert.throws(
    () =>
      validatePushSubscription({
        ...validSubscription,
        keys: {
          ...validSubscription.keys,
          auth: base64url(randomBytes(8)),
        },
      }),
    (error) => assertPushError(error, "PUSH_AUTH_SECRET_INVALID"),
  );
  result.validation = { status: "PASS" };
});

test("payload, deep-link and delivery-option safety boundaries are enforced", () => {
  assert.equal(normalizeDeepLink("/plans?id=1"), "/plans?id=1");
  for (const unsafe of [
    "https://evil.invalid",
    "//evil.invalid",
    "/a\\b",
    "/a\n",
  ])
    assert.throws(
      () => normalizeDeepLink(unsafe),
      (error) => assertPushError(error, "PUSH_DEEP_LINK_UNSAFE"),
    );

  assert.throws(
    () => normalizePushPayload({ title: "x".repeat(121) }),
    (error) => assertPushError(error, "PUSH_TITLE_TOO_LARGE"),
  );
  assert.throws(
    () => normalizePushPayload({ title: "ok", body: "x".repeat(513) }),
    (error) => assertPushError(error, "PUSH_BODY_TOO_LARGE"),
  );
  assert.throws(
    () =>
      normalizePushPayload({
        title: "ok",
        body: "ok",
        data: { blob: "测".repeat(PUSH_LIMITS.maxPayloadBytes) },
      }),
    (error) => assertPushError(error, "PUSH_PAYLOAD_TOO_LARGE"),
  );
  assert.throws(
    () => normalizePushOptions({ ttl: PUSH_LIMITS.maxTtlSeconds + 1 }),
    (error) => assertPushError(error, "PUSH_TTL_INVALID"),
  );
  assert.throws(
    () => normalizePushOptions({ urgency: "urgent" }),
    (error) => assertPushError(error, "PUSH_URGENCY_INVALID"),
  );
  assert.throws(
    () => normalizePushOptions({ topic: "invalid topic" }),
    (error) => assertPushError(error, "PUSH_TOPIC_INVALID"),
  );

  const input = buildPushRequestInput({
    subscription: subscriptionFixture(),
    payload: { title: "ok", deepLink: "/" },
    options: { TTL: 0, urgency: "very-low", topic: "topic_1" },
  });
  assert.equal(input.options.TTL, 0);
  assert.equal(input.options.urgency, "very-low");
  result.safety = { status: "PASS", payloadBytes: input.payload.payloadBytes };
});

test("HTTP and network failures are classified for endpoint lifecycle and retry", () => {
  assert.deepEqual(classifyPushResponse({ statusCode: 201 }), {
    state: "SENT",
    retryable: false,
    terminal: true,
    statusCode: 201,
  });
  assert.equal(classifyPushResponse({ statusCode: 410 }).state, "EXPIRED");
  assert.equal(
    classifyPushResponse({ statusCode: 410 }).deactivateSubscription,
    true,
  );
  const rateLimited = classifyPushResponse({
    statusCode: 429,
    headers: { "retry-after": "2" },
  });
  assert.equal(rateLimited.state, "RATE_LIMITED");
  assert.equal(rateLimited.retryAfterMs, 2000);
  assert.equal(
    classifyPushResponse({ statusCode: 503 }).state,
    "FAILED_TRANSIENT",
  );
  assert.equal(
    classifyPushResponse({ statusCode: 400 }).state,
    "FAILED_PERMANENT",
  );
  assert.equal(classifyPushFailure(new Error("network down")).retryable, true);
  result.classification = { status: "PASS" };
});

test("retry delay is bounded and honors Retry-After", () => {
  assert.equal(computeRetryDelayMs({ attempt: 1 }), 30_000);
  assert.equal(computeRetryDelayMs({ attempt: 2 }), 60_000);
  assert.equal(
    computeRetryDelayMs({ attempt: 20 }),
    PUSH_LIMITS.maxRetryDelayMs,
  );
  assert.equal(
    computeRetryDelayMs({ attempt: 1, retryAfterMs: 999_999_999 }),
    PUSH_LIMITS.maxRetryDelayMs,
  );
  assert.equal(
    buildPushIdempotencyKey({
      messageId: "message/1",
      subscriptionId: "sub 1",
    }),
    "push:message%2F1:sub%201",
  );
  result.retry = { status: "PASS", maxAttempts: PUSH_LIMITS.maxAttempts };
});

test("successful delivery is claimed, audited and marked sent", async () => {
  const harness = repositoryHarness();
  let transportCalls = 0;
  const delivery = await executePushDelivery(
    deliveryInput({
      repository: harness.repository,
      requestFactory: async () => ({ method: "POST" }),
      transport: async () => {
        transportCalls += 1;
        return { statusCode: 201, headers: {} };
      },
    }),
  );
  assert.equal(delivery.state, PUSH_DELIVERY_STATES.sent);
  assert.equal(transportCalls, 1);
  assert.equal(harness.calls.claims.length, 1);
  assert.equal(
    harness.calls.attempts[0].state,
    PUSH_DELIVERY_STATES.sending,
  );
  assert.equal(harness.calls.results[0].state, PUSH_DELIVERY_STATES.sent);
  result.successLifecycle = { status: "PASS" };
});

test("duplicate delivery claim skips request generation and transport", async () => {
  const harness = repositoryHarness({ claimed: false });
  let factoryCalls = 0;
  let transportCalls = 0;
  const delivery = await executePushDelivery(
    deliveryInput({
      repository: harness.repository,
      requestFactory: async () => {
        factoryCalls += 1;
        return {};
      },
      transport: async () => {
        transportCalls += 1;
        return { statusCode: 201 };
      },
    }),
  );
  assert.equal(delivery.state, PUSH_DELIVERY_STATES.skippedDuplicate);
  assert.equal(factoryCalls, 0);
  assert.equal(transportCalls, 0);
  assert.equal(harness.calls.attempts.length, 0);
  result.idempotency = { status: "PASS" };
});

test("expired endpoint is deactivated and not retried", async () => {
  const harness = repositoryHarness();
  const delivery = await executePushDelivery(
    deliveryInput({
      repository: harness.repository,
      requestFactory: async () => ({}),
      transport: async () => ({ statusCode: 410 }),
    }),
  );
  assert.equal(delivery.state, PUSH_DELIVERY_STATES.expired);
  assert.equal(delivery.retryable, false);
  assert.equal(harness.calls.deactivations.length, 1);
  assert.equal(harness.calls.deactivations[0].reason, "EXPIRED_ENDPOINT");
  result.expired = { status: "PASS" };
});

test("rate limits and transient failures schedule bounded retries", async () => {
  const rateHarness = repositoryHarness();
  const rateLimited = await executePushDelivery(
    deliveryInput({
      repository: rateHarness.repository,
      requestFactory: async () => ({}),
      transport: async () => ({
        statusCode: 429,
        headers: { "retry-after": "2" },
      }),
    }),
  );
  assert.equal(rateLimited.state, PUSH_DELIVERY_STATES.retryScheduled);
  assert.equal(rateLimited.retryDelayMs, 2000);
  assert.equal(rateLimited.nextAttempt, 2);
  assert.equal(rateLimited.failureClass, "RATE_LIMITED");

  const networkHarness = repositoryHarness();
  const networkFailure = await executePushDelivery(
    deliveryInput({
      repository: networkHarness.repository,
      requestFactory: async () => ({}),
      transport: async () => {
        throw new Error("temporary network failure");
      },
    }),
  );
  assert.equal(networkFailure.state, PUSH_DELIVERY_STATES.retryScheduled);
  assert.equal(networkFailure.retryDelayMs, PUSH_LIMITS.baseRetryDelayMs);
  result.transient = { status: "PASS" };
});

test("retry exhaustion and validation errors become permanent audited failures", async () => {
  const exhaustedHarness = repositoryHarness();
  const exhausted = await executePushDelivery(
    deliveryInput({
      repository: exhaustedHarness.repository,
      attempt: PUSH_LIMITS.maxAttempts,
      requestFactory: async () => ({}),
      transport: async () => ({ statusCode: 503 }),
    }),
  );
  assert.equal(exhausted.state, PUSH_DELIVERY_STATES.failedPermanent);
  assert.equal(exhausted.reason, "PUSH_RETRY_EXHAUSTED");

  const invalidHarness = repositoryHarness();
  const invalid = await executePushDelivery(
    deliveryInput({
      repository: invalidHarness.repository,
      requestFactory: async () => {
        throw new PushError("PUSH_PAYLOAD_INVALID");
      },
      transport: async () => ({ statusCode: 201 }),
    }),
  );
  assert.equal(invalid.state, PUSH_DELIVERY_STATES.failedPermanent);
  assert.equal(invalid.retryable, false);
  assert.equal(invalidHarness.calls.results[0].state, "FAILED_PERMANENT");
  result.permanentFailure = { status: "PASS" };
});

test("platform matrix keeps Push best-effort and physical delivery manual", () => {
  result.platformMatrix = {
    iPhone: {
      automatedStatus: "NOT_RUN_REQUIRES_PHYSICAL_DEVICE",
      conditions: [
        "iOS/iPadOS 16.4+",
        "installed to Home Screen",
        "permission requested from user gesture",
      ],
      nativeWrapperRequired: false,
    },
    androidChrome: {
      automatedStatus: "NOT_RUN_REQUIRES_DEVICE_OR_BROWSER_PUSH_SERVICE",
      conditions: [
        "service worker active",
        "notification permission granted",
        "push service reachable",
      ],
      nativeWrapperRequired: false,
    },
    desktop: {
      automatedStatus: "NOT_RUN_REQUIRES_REAL_PUSH_ENDPOINT",
      conditions: ["supported browser", "notification permission granted"],
      nativeWrapperRequired: false,
    },
    fallback:
      "All reminders remain queryable in-app; delivery rows track sent, retry, failed and expired endpoints",
  };
  assert.equal(result.platformMatrix.iPhone.nativeWrapperRequired, false);
  assert.ok(PUSH_ERROR_MESSAGES_ZH_CN.PUSH_PAYLOAD_TOO_LARGE);
});

test.after(() => {
  writeFileSync("results/05-web-push.json", JSON.stringify(result, null, 2));
});
