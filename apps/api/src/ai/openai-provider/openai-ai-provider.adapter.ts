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

const PROPOSAL_RESULT_SCHEMA = {
  additionalProperties: false,
  properties: {
    clarification: { type: ["string", "null"] },
    missingFields: { items: { type: "string" }, type: "array" },
    modelId: { type: "string" },
    operations: {
      items: {
        additionalProperties: false,
        properties: {
          clarification: { type: ["string", "null"] },
          confidence: { type: "string" },
          fields: { additionalProperties: true, type: "object" },
          operationType: {
            enum: ["TRANSACTION", "CALENDAR_EVENT", "TASK", "REMINDER", "TRIP"],
            type: "string",
          },
          status: { const: "PENDING", type: "string" },
        },
        required: [
          "clarification",
          "confidence",
          "fields",
          "operationType",
          "status",
        ],
        type: "object",
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
              schema: PROPOSAL_RESULT_SCHEMA,
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
