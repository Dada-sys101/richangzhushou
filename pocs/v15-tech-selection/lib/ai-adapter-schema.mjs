import Ajv from "ajv";

export const AI_LIMITS = Object.freeze({
  maxInputCharacters: 20_000,
  maxContextBytes: 16 * 1024,
  maxOutputBytes: 64 * 1024,
  maxOperations: 10,
  maxFieldDepth: 5,
  maxFieldProperties: 64,
  maxFieldStringCharacters: 4096,
  capabilityTtlMs: 60 * 60 * 1000,
  providerTimeoutMs: 15_000,
  maxProviderAttempts: 3,
  circuitFailureThreshold: 3,
  circuitCooldownMs: 60_000,
});

export const AI_OPERATION_TYPES = Object.freeze([
  "TRANSACTION",
  "CALENDAR_EVENT",
  "TASK",
  "REMINDER",
  "TRIP",
]);

export const AI_RESULT_STATES = Object.freeze({
  proposed: "PROPOSED",
  duplicate: "DUPLICATE",
  rejected: "REJECTED",
});

export const AI_FAILURE_CATEGORIES = Object.freeze({
  authentication: "AUTHENTICATION",
  rateLimit: "RATE_LIMIT",
  quota: "QUOTA",
  timeout: "TIMEOUT",
  transient: "TRANSIENT_SERVICE",
  unsupported: "UNSUPPORTED_CAPABILITY",
  invalidResponse: "INVALID_RESPONSE",
  invalidRequest: "INVALID_REQUEST",
  circuitOpen: "CIRCUIT_OPEN",
  unknown: "UNKNOWN",
});

export const CAPTURE_RESPONSE_SCHEMA = Object.freeze({
  $id: "https://daily-assistant.local/schemas/capture-response-v1.json",
  type: "object",
  additionalProperties: false,
  required: ["schemaVersion", "operations", "provider"],
  properties: {
    schemaVersion: { const: 1 },
    provider: { type: "string", minLength: 1, maxLength: 256 },
    operations: {
      type: "array",
      minItems: 1,
      maxItems: AI_LIMITS.maxOperations,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "confidence", "fields"],
        properties: {
          type: { enum: AI_OPERATION_TYPES },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          fields: { type: "object" },
          clarification: { type: ["string", "null"], maxLength: 2000 },
        },
      },
    },
  },
});

const ajv = new Ajv({ allErrors: true, strict: true });
const validateSchema = ajv.compile(CAPTURE_RESPONSE_SCHEMA);
const dangerousKeys = new Set(["__proto__", "prototype", "constructor"]);
const encoder = new TextEncoder();

export class AiAdapterError extends Error {
  constructor(code, details = {}, options = undefined) {
    super(code, options);
    this.name = "AiAdapterError";
    this.code = code;
    this.details = details;
    this.category = details.category ?? null;
    this.retryable = Boolean(details.retryable);
  }
}

export function aiError(code, details = {}, options = undefined) {
  return new AiAdapterError(code, details, options);
}

export function nonEmpty(name, value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw aiError("AI_REQUIRED_VALUE_MISSING", {
      category: AI_FAILURE_CATEGORIES.invalidRequest,
      name,
    });
  }
  return value.trim();
}

function validateJsonTree(value, path, depth, counter, category) {
  if (depth > AI_LIMITS.maxFieldDepth) {
    throw aiError("AI_RESPONSE_FIELDS_TOO_DEEP", {
      category,
      path,
      limit: AI_LIMITS.maxFieldDepth,
    });
  }
  if (typeof value === "string") {
    if (value.length > AI_LIMITS.maxFieldStringCharacters) {
      throw aiError("AI_RESPONSE_FIELD_TOO_LARGE", {
        category,
        path,
        actual: value.length,
      });
    }
    return;
  }
  if (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      validateJsonTree(item, `${path}[${index}]`, depth + 1, counter, category),
    );
    return;
  }
  if (value && typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw aiError("AI_RESPONSE_FIELD_TYPE_UNSAFE", { category, path });
    }
    for (const [key, child] of Object.entries(value)) {
      counter.properties += 1;
      if (counter.properties > AI_LIMITS.maxFieldProperties) {
        throw aiError("AI_RESPONSE_FIELDS_TOO_MANY", {
          category,
          limit: AI_LIMITS.maxFieldProperties,
        });
      }
      if (dangerousKeys.has(key)) {
        throw aiError("AI_RESPONSE_FIELD_KEY_UNSAFE", {
          category,
          path: `${path}.${key}`,
        });
      }
      validateJsonTree(child, `${path}.${key}`, depth + 1, counter, category);
    }
    return;
  }
  throw aiError("AI_RESPONSE_FIELD_TYPE_UNSAFE", {
    category,
    path,
    type: typeof value,
  });
}

export function validateCaptureRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw aiError("AI_REQUEST_INVALID", {
      category: AI_FAILURE_CATEGORIES.invalidRequest,
    });
  }
  const requestId = nonEmpty("requestId", request.requestId);
  const text = nonEmpty("text", request.text);
  if (text.length > AI_LIMITS.maxInputCharacters) {
    throw aiError("AI_INPUT_TOO_LARGE", {
      category: AI_FAILURE_CATEGORIES.invalidRequest,
      actual: text.length,
      limit: AI_LIMITS.maxInputCharacters,
    });
  }
  const locale = nonEmpty("locale", request.locale ?? "zh-CN");
  if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/u.test(locale)) {
    throw aiError("AI_LOCALE_INVALID", {
      category: AI_FAILURE_CATEGORIES.invalidRequest,
      locale,
    });
  }
  const timeZone = nonEmpty("timeZone", request.timeZone ?? "Asia/Shanghai");
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format();
  } catch (error) {
    throw aiError(
      "AI_TIME_ZONE_INVALID",
      { category: AI_FAILURE_CATEGORIES.invalidRequest, timeZone },
      { cause: error },
    );
  }
  const context =
    request.context &&
    typeof request.context === "object" &&
    !Array.isArray(request.context)
      ? structuredClone(request.context)
      : {};
  validateJsonTree(
    context,
    "context",
    0,
    { properties: 0 },
    AI_FAILURE_CATEGORIES.invalidRequest,
  );
  const contextBytes = encoder.encode(JSON.stringify(context)).length;
  if (contextBytes > AI_LIMITS.maxContextBytes) {
    throw aiError("AI_CONTEXT_TOO_LARGE", {
      category: AI_FAILURE_CATEGORIES.invalidRequest,
      actual: contextBytes,
      limit: AI_LIMITS.maxContextBytes,
    });
  }
  return { requestId, text, locale, timeZone, context };
}

export function validateCaptureResponse(response) {
  let outputBytes;
  try {
    outputBytes = encoder.encode(JSON.stringify(response)).length;
  } catch (error) {
    throw aiError(
      "AI_RESPONSE_NOT_JSON",
      { category: AI_FAILURE_CATEGORIES.invalidResponse },
      { cause: error },
    );
  }
  if (outputBytes > AI_LIMITS.maxOutputBytes) {
    throw aiError("AI_RESPONSE_TOO_LARGE", {
      category: AI_FAILURE_CATEGORIES.invalidResponse,
      actual: outputBytes,
      limit: AI_LIMITS.maxOutputBytes,
    });
  }
  if (!validateSchema(response)) {
    throw aiError("AI_RESPONSE_SCHEMA_INVALID", {
      category: AI_FAILURE_CATEGORIES.invalidResponse,
      errors: validateSchema.errors?.map(({ instancePath, keyword, message }) => ({
        instancePath,
        keyword,
        message,
      })),
    });
  }
  response.operations.forEach((operation, index) => {
    validateJsonTree(
      operation.fields,
      `operations[${index}].fields`,
      0,
      { properties: 0 },
      AI_FAILURE_CATEGORIES.invalidResponse,
    );
    if (operation.confidence < 0.5 && !operation.clarification) {
      throw aiError("AI_RESPONSE_CLARIFICATION_REQUIRED", {
        category: AI_FAILURE_CATEGORIES.invalidResponse,
        operationIndex: index,
      });
    }
  });
  return { response: structuredClone(response), outputBytes };
}

export function classifyProviderFailure(error) {
  if (error instanceof AiAdapterError) {
    return {
      code: error.code,
      category: error.category ?? AI_FAILURE_CATEGORIES.unknown,
      retryable: error.retryable,
      statusCode: error.details.statusCode ?? null,
      message: error.message,
    };
  }
  const rawStatus = error?.statusCode ?? error?.status;
  const statusCode = Number.isInteger(Number(rawStatus)) ? Number(rawStatus) : null;
  const code = String(error?.code ?? "");
  const message = error instanceof Error ? error.message : String(error);
  if (statusCode === 401 || statusCode === 403) {
    return {
      code: "AI_PROVIDER_AUTHENTICATION_FAILED",
      category: AI_FAILURE_CATEGORIES.authentication,
      retryable: false,
      statusCode,
      message,
    };
  }
  if (statusCode === 429) {
    const quota = /quota|insufficient_quota/iu.test(`${code} ${message}`);
    return {
      code: quota ? "AI_PROVIDER_QUOTA_EXHAUSTED" : "AI_PROVIDER_RATE_LIMITED",
      category: quota
        ? AI_FAILURE_CATEGORIES.quota
        : AI_FAILURE_CATEGORIES.rateLimit,
      retryable: !quota,
      statusCode,
      message,
    };
  }
  if (
    code === "ABORT_ERR" ||
    code === "ETIMEDOUT" ||
    error?.name === "TimeoutError"
  ) {
    return {
      code: "AI_PROVIDER_TIMEOUT",
      category: AI_FAILURE_CATEGORIES.timeout,
      retryable: true,
      statusCode,
      message,
    };
  }
  if ([408, 425].includes(statusCode) || (statusCode >= 500 && statusCode <= 599)) {
    return {
      code: "AI_PROVIDER_TRANSIENT_FAILURE",
      category: AI_FAILURE_CATEGORIES.transient,
      retryable: true,
      statusCode,
      message,
    };
  }
  return {
    code: "AI_PROVIDER_FAILURE",
    category: AI_FAILURE_CATEGORIES.unknown,
    retryable: false,
    statusCode,
    message,
  };
}

export const AI_ERROR_MESSAGES_ZH_CN = Object.freeze({
  AI_REQUEST_INVALID: "AI 请求格式无效",
  AI_INPUT_TOO_LARGE: "输入内容超过允许长度",
  AI_CONTEXT_TOO_LARGE: "上下文内容超过允许大小",
  AI_LOCALE_INVALID: "语言区域设置无效",
  AI_TIME_ZONE_INVALID: "时区设置无效",
  AI_PROVIDER_NO_AVAILABLE_MODEL: "服务商没有可用模型",
  AI_PROVIDER_STRUCTURED_OUTPUT_UNAVAILABLE: "服务商不支持所需的结构化输出",
  AI_RESPONSE_SCHEMA_INVALID: "AI 返回的数据结构无效",
  AI_RESPONSE_FIELD_KEY_UNSAFE: "AI 返回内容包含不安全字段",
  AI_RESPONSE_TOO_LARGE: "AI 返回内容超过允许大小",
  AI_PROVIDER_AUTHENTICATION_FAILED: "AI 服务认证失败",
  AI_PROVIDER_RATE_LIMITED: "AI 服务请求过于频繁",
  AI_PROVIDER_QUOTA_EXHAUSTED: "AI 服务额度已用尽",
  AI_PROVIDER_TIMEOUT: "AI 服务响应超时",
  AI_ALL_PROVIDERS_FAILED: "所有 AI 服务暂时不可用",
  AI_REPOSITORY_METHOD_MISSING: "AI 审计仓储接口不完整",
});
