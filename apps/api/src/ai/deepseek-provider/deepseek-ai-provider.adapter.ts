import type {
  AiProviderAdapter,
  AiProviderExecutionContext,
  AiProviderRequest,
  AiProviderResponse,
} from "../ai-provider-router.js";
import type { FakeAiProviderResult } from "../fake-provider/fake-ai-provider.types.js";

export const DEEPSEEK_CHAT_COMPLETIONS_URL =
  "https://api.deepseek.com/chat/completions";

export interface DeepSeekTransportRequest {
  body: string;
  headers: Readonly<Record<string, string>>;
  signal?: AbortSignal;
  url: typeof DEEPSEEK_CHAT_COMPLETIONS_URL;
}

export interface DeepSeekTransportResponse {
  json(): Promise<unknown>;
  status: number;
}

export interface DeepSeekTransport {
  post(request: DeepSeekTransportRequest): Promise<DeepSeekTransportResponse>;
}

export class NativeDeepSeekTransport implements DeepSeekTransport {
  async post(
    request: DeepSeekTransportRequest,
  ): Promise<DeepSeekTransportResponse> {
    const response = await fetch(request.url, {
      body: request.body,
      headers: request.headers,
      method: "POST",
      signal: request.signal,
    });
    return { json: () => response.json(), status: response.status };
  }
}

export class RealAiProviderError extends Error {
  constructor(
    readonly category:
      | "AUTH_ERROR"
      | "INVALID_RESPONSE"
      | "NETWORK_ERROR"
      | "PROVIDER_5XX"
      | "RATE_LIMIT"
      | "SCHEMA_INVALID"
      | "TIMEOUT"
      | "UNKNOWN_PROVIDER_ERROR",
    readonly retryable: boolean,
    readonly httpStatus?: number,
  ) {
    super("The real AI provider request failed");
    this.name = "RealAiProviderError";
  }
}

export class DeepSeekProviderConfigurationError extends Error {
  readonly category = "INVALID_PROVIDER_CONFIG";

  constructor() {
    super("DeepSeek provider configuration is invalid");
    this.name = "DeepSeekProviderConfigurationError";
  }
}

interface DeepSeekConfiguration {
  apiKey: string;
  model: string;
}

export function createDeepSeekAiProviderAdapter(
  environment: Readonly<Record<string, string | undefined>>,
  transport: DeepSeekTransport = new NativeDeepSeekTransport(),
): DeepSeekAiProviderAdapter {
  const apiKey = environment.DEEPSEEK_API_KEY?.trim();
  const model = environment.DEEPSEEK_MODEL?.trim();
  if (!apiKey || !model) throw new DeepSeekProviderConfigurationError();
  return new DeepSeekAiProviderAdapter({ apiKey, model }, transport);
}

export class DeepSeekAiProviderAdapter implements AiProviderAdapter {
  constructor(
    private readonly configuration: DeepSeekConfiguration,
    private readonly transport: DeepSeekTransport,
  ) {}

  providerId(): string {
    return "deepseek";
  }

  modelId(): string {
    return this.configuration.model;
  }

  async execute(
    request: AiProviderRequest,
    context?: AiProviderExecutionContext,
  ): Promise<AiProviderResponse> {
    const startedAt = Date.now();
    let response: DeepSeekTransportResponse;
    try {
      response = await this.transport.post({
        body: JSON.stringify({
          messages: [
            {
              content:
                "Return valid JSON only. Produce a controlled AI proposal result.",
              role: "system",
            },
            {
              content: JSON.stringify(request.input),
              role: "user",
            },
          ],
          model: this.configuration.model,
          response_format: { type: "json_object" },
          stream: false,
          thinking: { type: "disabled" },
        }),
        headers: {
          Authorization: `Bearer ${this.configuration.apiKey}`,
          "Content-Type": "application/json",
        },
        signal: context?.signal,
        url: DEEPSEEK_CHAT_COMPLETIONS_URL,
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
    const parsed = parseDeepSeekResponse(payload);
    if (!parsed) {
      throw new RealAiProviderError("INVALID_RESPONSE", false, response.status);
    }
    let content: FakeAiProviderResult;
    try {
      content = JSON.parse(parsed.content) as FakeAiProviderResult;
    } catch {
      throw new RealAiProviderError("INVALID_RESPONSE", false, response.status);
    }
    return {
      content,
      latencyMs: Math.max(0, Date.now() - startedAt),
      model: this.configuration.model,
      providerName: "deepseek",
      requestId: request.requestId,
      usage: parsed.usage,
    };
  }
}

function parseDeepSeekResponse(payload: unknown): {
  content: string;
  usage: { inputTokens: number | null; outputTokens: number | null };
} | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const choice = Array.isArray(record.choices) ? record.choices[0] : undefined;
  if (!choice || typeof choice !== "object") return null;
  const choiceRecord = choice as Record<string, unknown>;
  if (choiceRecord.finish_reason !== "stop") return null;
  const message = choiceRecord.message;
  if (!message || typeof message !== "object") return null;
  const content = (message as Record<string, unknown>).content;
  if (typeof content !== "string" || content.length === 0) return null;
  const usage = record.usage as Record<string, unknown> | undefined;
  return {
    content,
    usage: {
      inputTokens: token(usage?.prompt_tokens),
      outputTokens: token(usage?.completion_tokens),
    },
  };
}

function token(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}
