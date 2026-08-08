const textEncoder = new TextEncoder();

export const PUSH_LIMITS = Object.freeze({
  maxPayloadBytes: 3000,
  maxTitleCharacters: 120,
  maxBodyCharacters: 512,
  maxTtlSeconds: 28 * 24 * 60 * 60,
  maxTopicCharacters: 32,
  maxAttempts: 5,
  baseRetryDelayMs: 30_000,
  maxRetryDelayMs: 60 * 60 * 1000,
});

export const PUSH_DELIVERY_STATES = Object.freeze({
  pending: "PENDING",
  sending: "SENDING",
  sent: "SENT",
  expired: "EXPIRED",
  retryScheduled: "RETRY_SCHEDULED",
  failedPermanent: "FAILED_PERMANENT",
  skippedDuplicate: "SKIPPED_DUPLICATE",
});

export const PUSH_URGENCIES = Object.freeze([
  "very-low",
  "low",
  "normal",
  "high",
]);

export class PushError extends Error {
  constructor(code, details = {}, options = undefined) {
    super(code, options);
    this.name = "PushError";
    this.code = code;
    this.details = details;
  }
}

function pushError(code, details = {}, options = undefined) {
  return new PushError(code, details, options);
}

function nonEmpty(name, value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw pushError("PUSH_REQUIRED_VALUE_MISSING", { name });
  }
  return value.trim();
}

function decodeBase64Url(value, name) {
  const normalized = nonEmpty(name, value);
  if (!/^[A-Za-z0-9_-]+$/u.test(normalized)) {
    throw pushError("PUSH_KEY_INVALID", { name, reason: "NOT_BASE64URL" });
  }
  try {
    return Buffer.from(normalized, "base64url");
  } catch (error) {
    throw pushError(
      "PUSH_KEY_INVALID",
      { name, reason: "DECODE_FAILED" },
      { cause: error },
    );
  }
}

function validateSubject(subject) {
  const value = nonEmpty("subject", subject);
  if (/^mailto:[^@\s]+@[^@\s]+$/u.test(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol === "https:") return value;
  } catch {
    // Normalized below into a stable error code.
  }
  throw pushError("PUSH_VAPID_SUBJECT_INVALID", { subject: value });
}

export function validateVapidConfig(config) {
  if (!config || typeof config !== "object") {
    throw pushError("PUSH_VAPID_CONFIG_INVALID");
  }
  const subject = validateSubject(config.subject);
  const publicKey = nonEmpty("publicKey", config.publicKey);
  const privateKey = nonEmpty("privateKey", config.privateKey);
  const publicBytes = decodeBase64Url(publicKey, "publicKey");
  const privateBytes = decodeBase64Url(privateKey, "privateKey");
  if (publicBytes.length !== 65 || publicBytes[0] !== 4) {
    throw pushError("PUSH_VAPID_PUBLIC_KEY_INVALID", {
      length: publicBytes.length,
    });
  }
  if (privateBytes.length !== 32) {
    throw pushError("PUSH_VAPID_PRIVATE_KEY_INVALID", {
      length: privateBytes.length,
    });
  }
  return { subject, publicKey, privateKey };
}

export function validatePushSubscription(subscription) {
  if (!subscription || typeof subscription !== "object") {
    throw pushError("PUSH_SUBSCRIPTION_INVALID");
  }
  const endpoint = nonEmpty("endpoint", subscription.endpoint);
  let endpointUrl;
  try {
    endpointUrl = new URL(endpoint);
  } catch (error) {
    throw pushError(
      "PUSH_ENDPOINT_INVALID",
      { endpoint },
      { cause: error },
    );
  }
  if (endpointUrl.protocol !== "https:") {
    throw pushError("PUSH_ENDPOINT_INSECURE", { endpoint });
  }
  const p256dh = nonEmpty("p256dh", subscription.keys?.p256dh);
  const auth = nonEmpty("auth", subscription.keys?.auth);
  const p256dhBytes = decodeBase64Url(p256dh, "p256dh");
  const authBytes = decodeBase64Url(auth, "auth");
  if (p256dhBytes.length !== 65 || p256dhBytes[0] !== 4) {
    throw pushError("PUSH_P256DH_INVALID", { length: p256dhBytes.length });
  }
  if (authBytes.length !== 16) {
    throw pushError("PUSH_AUTH_SECRET_INVALID", { length: authBytes.length });
  }
  return {
    endpoint: endpointUrl.toString(),
    keys: { p256dh, auth },
  };
}

export function normalizeDeepLink(value) {
  if (value === undefined || value === null || value === "") return "/";
  const deepLink = nonEmpty("deepLink", value);
  if (
    !deepLink.startsWith("/") ||
    deepLink.startsWith("//") ||
    deepLink.includes("\\") ||
    /[\u0000-\u001F\u007F]/u.test(deepLink)
  ) {
    throw pushError("PUSH_DEEP_LINK_UNSAFE", { deepLink });
  }
  return deepLink;
}

export function normalizePushPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw pushError("PUSH_PAYLOAD_INVALID");
  }
  const title = nonEmpty("title", payload.title);
  if (title.length > PUSH_LIMITS.maxTitleCharacters) {
    throw pushError("PUSH_TITLE_TOO_LARGE", { actual: title.length });
  }
  const body = String(payload.body ?? "");
  if (body.length > PUSH_LIMITS.maxBodyCharacters) {
    throw pushError("PUSH_BODY_TOO_LARGE", { actual: body.length });
  }
  const normalized = {
    title,
    body,
    deepLink: normalizeDeepLink(payload.deepLink),
    tag: payload.tag ? String(payload.tag).slice(0, 64) : undefined,
    data:
      payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
        ? payload.data
        : undefined,
  };
  const json = JSON.stringify(normalized);
  const payloadBytes = textEncoder.encode(json).length;
  if (payloadBytes > PUSH_LIMITS.maxPayloadBytes) {
    throw pushError("PUSH_PAYLOAD_TOO_LARGE", {
      actual: payloadBytes,
      limit: PUSH_LIMITS.maxPayloadBytes,
    });
  }
  return { value: normalized, json, payloadBytes };
}

export function normalizePushOptions(options = {}) {
  const ttl = options.ttl ?? options.TTL ?? 300;
  if (
    !Number.isSafeInteger(ttl) ||
    ttl < 0 ||
    ttl > PUSH_LIMITS.maxTtlSeconds
  ) {
    throw pushError("PUSH_TTL_INVALID", { ttl });
  }
  const urgency = options.urgency ?? "normal";
  if (!PUSH_URGENCIES.includes(urgency)) {
    throw pushError("PUSH_URGENCY_INVALID", { urgency });
  }
  const topic = options.topic ?? null;
  if (
    topic !== null &&
    (typeof topic !== "string" ||
      topic.length < 1 ||
      topic.length > PUSH_LIMITS.maxTopicCharacters ||
      !/^[A-Za-z0-9_-]+$/u.test(topic))
  ) {
    throw pushError("PUSH_TOPIC_INVALID", { topic });
  }
  return { TTL: ttl, urgency, ...(topic ? { topic } : {}) };
}

export function buildPushRequestInput({ subscription, payload, options }) {
  return {
    subscription: validatePushSubscription(subscription),
    payload: normalizePushPayload(payload),
    options: normalizePushOptions(options),
  };
}

function retryAfterMilliseconds(headers = {}, nowMs = Date.now()) {
  const raw = headers["retry-after"] ?? headers["Retry-After"];
  if (raw === undefined || raw === null) return null;
  const value = String(raw).trim();
  if (/^\d+$/u.test(value)) return Number(value) * 1000;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, parsed - nowMs);
}

export function classifyPushResponse(response, nowMs = Date.now()) {
  const statusCode = Number(response?.statusCode ?? response?.status);
  const headers = response?.headers ?? {};
  if (!Number.isInteger(statusCode)) {
    return {
      state: "FAILED_TRANSIENT",
      retryable: true,
      reason: "PUSH_RESPONSE_STATUS_MISSING",
      statusCode: null,
      retryAfterMs: null,
    };
  }
  if (statusCode >= 200 && statusCode < 300) {
    return {
      state: PUSH_DELIVERY_STATES.sent,
      retryable: false,
      terminal: true,
      statusCode,
    };
  }
  if (statusCode === 404 || statusCode === 410) {
    return {
      state: PUSH_DELIVERY_STATES.expired,
      retryable: false,
      terminal: true,
      deactivateSubscription: true,
      statusCode,
    };
  }
  if (statusCode === 429) {
    return {
      state: "RATE_LIMITED",
      retryable: true,
      terminal: false,
      statusCode,
      retryAfterMs: retryAfterMilliseconds(headers, nowMs),
    };
  }
  if ([408, 425].includes(statusCode) || statusCode >= 500) {
    return {
      state: "FAILED_TRANSIENT",
      retryable: true,
      terminal: false,
      statusCode,
      retryAfterMs: retryAfterMilliseconds(headers, nowMs),
    };
  }
  return {
    state: PUSH_DELIVERY_STATES.failedPermanent,
    retryable: false,
    terminal: true,
    statusCode,
  };
}

export function classifyPushFailure(error, nowMs = Date.now()) {
  const statusCode = error?.statusCode ?? error?.status;
  if (statusCode !== undefined) {
    return classifyPushResponse(
      { statusCode, headers: error?.headers ?? {} },
      nowMs,
    );
  }
  return {
    state: "FAILED_TRANSIENT",
    retryable: true,
    terminal: false,
    statusCode: null,
    retryAfterMs: null,
    reason: error instanceof Error ? error.message : String(error),
  };
}

export function computeRetryDelayMs({ attempt, retryAfterMs = null }) {
  if (!Number.isSafeInteger(attempt) || attempt < 1) {
    throw pushError("PUSH_ATTEMPT_INVALID", { attempt });
  }
  if (retryAfterMs !== null) {
    if (!Number.isFinite(retryAfterMs) || retryAfterMs < 0) {
      throw pushError("PUSH_RETRY_AFTER_INVALID", { retryAfterMs });
    }
    return Math.min(retryAfterMs, PUSH_LIMITS.maxRetryDelayMs);
  }
  return Math.min(
    PUSH_LIMITS.baseRetryDelayMs * 2 ** (attempt - 1),
    PUSH_LIMITS.maxRetryDelayMs,
  );
}

export function buildPushIdempotencyKey({ messageId, subscriptionId }) {
  const message = nonEmpty("messageId", messageId);
  const subscription = nonEmpty("subscriptionId", subscriptionId);
  return `push:${encodeURIComponent(message)}:${encodeURIComponent(subscription)}`;
}

function requireRepository(repository) {
  const methods = [
    "claimPushDelivery",
    "recordPushAttempt",
    "recordPushResult",
  ];
  for (const method of methods) {
    if (typeof repository?.[method] !== "function") {
      throw pushError("PUSH_REPOSITORY_METHOD_MISSING", { method });
    }
  }
}

function publicResult(classification, extra = {}) {
  return {
    state: classification.state,
    retryable: Boolean(classification.retryable),
    statusCode: classification.statusCode ?? null,
    ...extra,
  };
}

export async function executePushDelivery({
  messageId,
  subscriptionId,
  subscription,
  payload,
  options,
  attempt = 1,
  requestFactory,
  transport,
  repository,
  now = () => Date.now(),
}) {
  requireRepository(repository);
  if (typeof requestFactory !== "function") {
    throw pushError("PUSH_REQUEST_FACTORY_REQUIRED");
  }
  if (typeof transport !== "function") {
    throw pushError("PUSH_TRANSPORT_REQUIRED");
  }
  if (!Number.isSafeInteger(attempt) || attempt < 1) {
    throw pushError("PUSH_ATTEMPT_INVALID", { attempt });
  }

  const idempotencyKey = buildPushIdempotencyKey({
    messageId,
    subscriptionId,
  });
  const claimed = await repository.claimPushDelivery({
    idempotencyKey,
    messageId,
    subscriptionId,
    attempt,
  });
  if (!claimed) {
    return {
      state: PUSH_DELIVERY_STATES.skippedDuplicate,
      retryable: false,
      statusCode: null,
      idempotencyKey,
    };
  }

  const startedAt = now();
  await repository.recordPushAttempt({
    idempotencyKey,
    messageId,
    subscriptionId,
    attempt,
    state: PUSH_DELIVERY_STATES.sending,
    startedAt,
  });

  let classification;
  try {
    const request = await requestFactory({ subscription, payload, options });
    const response = await transport(request);
    classification = classifyPushResponse(response, now());
  } catch (error) {
    classification =
      error instanceof PushError
        ? {
            state: PUSH_DELIVERY_STATES.failedPermanent,
            retryable: false,
            terminal: true,
            statusCode: null,
            reason: error.code,
          }
        : classifyPushFailure(error, now());
  }

  let result;
  if (classification.deactivateSubscription) {
    await repository.deactivatePushSubscription?.({
      subscriptionId,
      reason: "EXPIRED_ENDPOINT",
      statusCode: classification.statusCode,
    });
    result = publicResult(classification, { idempotencyKey, attempt });
  } else if (classification.retryable && attempt < PUSH_LIMITS.maxAttempts) {
    const retryDelayMs = computeRetryDelayMs({
      attempt,
      retryAfterMs: classification.retryAfterMs ?? null,
    });
    result = {
      state: PUSH_DELIVERY_STATES.retryScheduled,
      retryable: true,
      statusCode: classification.statusCode ?? null,
      idempotencyKey,
      attempt,
      nextAttempt: attempt + 1,
      retryDelayMs,
      nextAttemptAt: new Date(now() + retryDelayMs).toISOString(),
      failureClass: classification.state,
    };
  } else if (classification.retryable) {
    result = {
      state: PUSH_DELIVERY_STATES.failedPermanent,
      retryable: false,
      statusCode: classification.statusCode ?? null,
      idempotencyKey,
      attempt,
      reason: "PUSH_RETRY_EXHAUSTED",
      failureClass: classification.state,
    };
  } else {
    result = publicResult(classification, { idempotencyKey, attempt });
  }

  await repository.recordPushResult({
    ...result,
    messageId,
    subscriptionId,
    completedAt: now(),
  });
  return result;
}

export const PUSH_ERROR_MESSAGES_ZH_CN = Object.freeze({
  PUSH_VAPID_CONFIG_INVALID: "推送服务配置无效",
  PUSH_VAPID_SUBJECT_INVALID: "VAPID 联系地址无效",
  PUSH_VAPID_PUBLIC_KEY_INVALID: "VAPID 公钥无效",
  PUSH_VAPID_PRIVATE_KEY_INVALID: "VAPID 私钥无效",
  PUSH_SUBSCRIPTION_INVALID: "推送订阅无效",
  PUSH_ENDPOINT_INVALID: "推送地址无效",
  PUSH_ENDPOINT_INSECURE: "推送地址必须使用 HTTPS",
  PUSH_P256DH_INVALID: "推送订阅公钥无效",
  PUSH_AUTH_SECRET_INVALID: "推送订阅认证密钥无效",
  PUSH_PAYLOAD_INVALID: "推送内容无效",
  PUSH_PAYLOAD_TOO_LARGE: "推送内容超过允许大小",
  PUSH_DEEP_LINK_UNSAFE: "推送跳转地址不安全",
  PUSH_TTL_INVALID: "推送有效期无效",
  PUSH_URGENCY_INVALID: "推送优先级无效",
  PUSH_TOPIC_INVALID: "推送主题无效",
  PUSH_REPOSITORY_METHOD_MISSING: "推送审计仓储接口不完整",
});
