import type {
  AiProviderAdapter,
  AiProviderExecutionContext,
  AiProviderRequest,
  AiProviderResponse,
} from "../ai-provider-router.js";
import type { FakeAiProviderResult } from "../fake-provider/fake-ai-provider.types.js";
import { RealAiProviderError } from "../deepseek-provider/deepseek-ai-provider.adapter.js";

export const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

export interface OpenAiTransportRequest {
  body: string;
  headers: Readonly<Record<string, string>>;
  signal?: AbortSignal;
  url: typeof OPENAI_RESPONSES_URL;
}

export interface OpenAiTransportResponse {
  json(): Promise<unknown>;
  status: number;
}

export interface OpenAiTransport {
  post(request: OpenAiTransportRequest): Promise<OpenAiTransportResponse>;
}

export class NativeOpenAiTransport implements OpenAiTransport {
  async post(
    request: OpenAiTransportRequest,
  ): Promise<OpenAiTransportResponse> {
    const response = await fetch(request.url, {
      body: request.body,
      headers: request.headers,
      method: "POST",
      signal: request.signal,
    });
    return { json: () => response.json(), status: response.status };
  }
}

export class OpenAiProviderConfigurationError extends Error {
  readonly category = "INVALID_PROVIDER_CONFIG";

  constructor() {
    super("OpenAI provider configuration is invalid");
    this.name = "OpenAiProviderConfigurationError";
  }
}

interface OpenAiConfiguration {
  apiKey: string;
  model: string;
}

const NULLABLE_STRING = { type: ["string", "null"] } as const;

const OPERATION_PROPERTIES = {
  clarification: { type: ["string", "null"] },
  confidence: { type: "string" },
  status: { const: "PENDING", type: "string" },
} as const;

const OPERATION_REQUIRED = [
  "clarification",
  "confidence",
  "fields",
  "operationType",
  "status",
] as const;

const TRANSACTION_FIELDS_SCHEMA = {
  additionalProperties: false,
  properties: {
    accountId: NULLABLE_STRING,
    amount: { type: "string" },
    categoryId: NULLABLE_STRING,
    currency: NULLABLE_STRING,
    isUnlinkedRefund: { type: ["boolean", "null"] },
    merchant: NULLABLE_STRING,
    note: NULLABLE_STRING,
    occurredAt: NULLABLE_STRING,
    originalTransactionId: NULLABLE_STRING,
    source: { const: "TEXT", type: "string" },
    tripId: NULLABLE_STRING,
    type: { enum: ["EXPENSE", "INCOME", "REFUND"], type: "string" },
  },
  required: [
    "accountId",
    "amount",
    "categoryId",
    "currency",
    "isUnlinkedRefund",
    "merchant",
    "note",
    "occurredAt",
    "originalTransactionId",
    "source",
    "tripId",
    "type",
  ],
  type: "object",
} as const;

const CALENDAR_EVENT_FIELDS_SCHEMA = {
  additionalProperties: false,
  properties: {
    allDay: { type: ["boolean", "null"] },
    endsAt: { type: "string" },
    startsAt: { type: "string" },
    title: { type: "string" },
  },
  required: ["allDay", "endsAt", "startsAt", "title"],
  type: "object",
} as const;

const TASK_FIELDS_SCHEMA = {
  additionalProperties: false,
  properties: {
    dueAt: NULLABLE_STRING,
    priority: {
      enum: ["LOW", "MEDIUM", "HIGH", null],
      type: ["string", "null"],
    },
    title: { type: "string" },
  },
  required: ["dueAt", "priority", "title"],
  type: "object",
} as const;

const REMINDER_RECURRENCE_SCHEMA = {
  additionalProperties: false,
  properties: {
    dayOfMonth: { type: ["integer", "null"] },
    interval: { type: ["integer", "null"] },
    until: NULLABLE_STRING,
    weekdays: { items: { type: "integer" }, type: ["array", "null"] },
  },
  required: ["dayOfMonth", "interval", "until", "weekdays"],
  type: "object",
} as const;

const REMINDER_FIELDS_SCHEMA = {
  additionalProperties: false,
  properties: {
    note: NULLABLE_STRING,
    recurrence: {
      anyOf: [REMINDER_RECURRENCE_SCHEMA, { type: "null" }],
    },
    scheduleType: {
      enum: ["ONCE", "DAILY", "WEEKLY", "MONTHLY"],
      type: "string",
    },
    startsAt: { type: "string" },
    targetId: NULLABLE_STRING,
    targetType: {
      enum: ["CALENDAR_EVENT", "TASK", "STANDALONE", null],
      type: ["string", "null"],
    },
    title: { type: "string" },
  },
  required: [
    "note",
    "recurrence",
    "scheduleType",
    "startsAt",
    "targetId",
    "targetType",
    "title",
  ],
  type: "object",
} as const;

const TRIP_FIELDS_SCHEMA = {
  additionalProperties: false,
  properties: {
    budgetAmount: NULLABLE_STRING,
    destination: { type: "string" },
    endDate: { type: "string" },
    startDate: { type: "string" },
    title: { type: "string" },
  },
  required: ["budgetAmount", "destination", "endDate", "startDate", "title"],
  type: "object",
} as const;

function operationSchema(
  operationType:
    "TRANSACTION" | "CALENDAR_EVENT" | "TASK" | "REMINDER" | "TRIP",
  fields: Record<string, unknown>,
) {
  return {
    additionalProperties: false,
    properties: {
      ...OPERATION_PROPERTIES,
      fields,
      operationType: { const: operationType, type: "string" },
    },
    required: OPERATION_REQUIRED,
    type: "object",
  } as const;
}

export const OPENAI_PROPOSAL_RESULT_SCHEMA = {
  additionalProperties: false,
  properties: {
    clarification: { type: ["string", "null"] },
    missingFields: { items: { type: "string" }, type: "array" },
    modelId: { type: "string" },
    operations: {
      items: {
        anyOf: [
          operationSchema("TRANSACTION", TRANSACTION_FIELDS_SCHEMA),
          operationSchema("CALENDAR_EVENT", CALENDAR_EVENT_FIELDS_SCHEMA),
          operationSchema("TASK", TASK_FIELDS_SCHEMA),
          operationSchema("REMINDER", REMINDER_FIELDS_SCHEMA),
          operationSchema("TRIP", TRIP_FIELDS_SCHEMA),
        ],
      },
      type: "array",
    },
    providerId: { const: "openai", type: "string" },
    resultType: { enum: ["SUCCESS", "UNCERTAIN"], type: "string" },
  },
  required: [
    "clarification",
    "missingFields",
    "modelId",
    "operations",
    "providerId",
    "resultType",
  ],
  type: "object",
} as const;

export function createOpenAiProviderAdapter(
  environment: Readonly<Record<string, string | undefined>>,
  transport: OpenAiTransport = new NativeOpenAiTransport(),
): OpenAiProviderAdapter {
  const apiKey = environment.OPENAI_API_KEY?.trim();
  const model = environment.OPENAI_MODEL?.trim();
  if (!apiKey || !model) throw new OpenAiProviderConfigurationError();
  return new OpenAiProviderAdapter({ apiKey, model }, transport);
}

export class OpenAiProviderAdapter implements AiProviderAdapter {
  constructor(
    private readonly configuration: OpenAiConfiguration,
    private readonly transport: OpenAiTransport,
  ) {}

  providerId(): string {
    return "openai";
  }

  modelId(): string {
    return this.configuration.model;
  }

  async execute(
    request: AiProviderRequest,
    context?: AiProviderExecutionContext,
  ): Promise<AiProviderResponse> {
    const startedAt = Date.now();
    let response: OpenAiTransportResponse;
    try {
      response = await this.transport.post({
        body: JSON.stringify({
          input: [
            {
              content:
                "Return a controlled AI proposal result matching the supplied schema.",
              role: "developer",
            },
            { content: JSON.stringify(request.input), role: "user" },
          ],
          model: this.configuration.model,
          store: false,
          text: {
            format: {
              name: "ai_proposal_result",
              schema: OPENAI_PROPOSAL_RESULT_SCHEMA,
              strict: true,
              type: "json_schema",
            },
          },
        }),
        headers: {
          Authorization: `Bearer ${this.configuration.apiKey}`,
          "Content-Type": "application/json",
        },
        signal: context?.signal,
        url: OPENAI_RESPONSES_URL,
      });
    } catch {
      if (context?.signal?.aborted) {
        throw new RealAiProviderError("TIMEOUT", true);
      }
      throw new RealAiProviderError("NETWORK_ERROR", true);
    }
    if (response.status === 401 || response.status === 403) {
      throw new RealAiProviderError("AUTH_ERROR", false, response.status);
    }
    if (response.status === 429) {
      throw new RealAiProviderError("RATE_LIMIT", true, response.status);
    }
    if (response.status >= 500 && response.status <= 599) {
      throw new RealAiProviderError("PROVIDER_5XX", true, response.status);
    }
    if (response.status < 200 || response.status >= 300) {
      throw new RealAiProviderError(
        "UNKNOWN_PROVIDER_ERROR",
        false,
        response.status,
      );
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new RealAiProviderError("INVALID_RESPONSE", false, response.status);
    }
    const parsed = parseOpenAiResponse(payload);
    if (!parsed) {
      throw new RealAiProviderError("INVALID_RESPONSE", false, response.status);
    }
    let content: unknown;
    try {
      content = JSON.parse(parsed.content);
    } catch {
      throw new RealAiProviderError("INVALID_RESPONSE", false, response.status);
    }
    if (!isStructuredResult(content)) {
      throw new RealAiProviderError("SCHEMA_INVALID", false, response.status);
    }
    return {
      content,
      latencyMs: Math.max(0, Date.now() - startedAt),
      model: this.configuration.model,
      providerName: "openai",
      requestId: request.requestId,
      usage: parsed.usage,
    };
  }
}

function parseOpenAiResponse(payload: unknown): {
  content: string;
  usage: { inputTokens: number | null; outputTokens: number | null };
} | null {
  if (
    !isRecord(payload) ||
    payload.status !== "completed" ||
    !Array.isArray(payload.output)
  )
    return null;
  const texts = payload.output.flatMap((item) => {
    if (!isRecord(item) || !Array.isArray(item.content)) return [];
    return item.content.flatMap((part) =>
      isRecord(part) &&
      part.type === "output_text" &&
      typeof part.text === "string"
        ? [part.text]
        : [],
    );
  });
  const [content] = texts;
  if (texts.length !== 1 || !content) return null;
  const usage = isRecord(payload.usage) ? payload.usage : undefined;
  return {
    content,
    usage: {
      inputTokens: token(usage?.input_tokens),
      outputTokens: token(usage?.output_tokens),
    },
  };
}

function isStructuredResult(value: unknown): value is FakeAiProviderResult {
  return (
    isRecord(value) &&
    (value.resultType === "SUCCESS" || value.resultType === "UNCERTAIN") &&
    value.providerId === "openai" &&
    typeof value.modelId === "string" &&
    Array.isArray(value.operations)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function token(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}
