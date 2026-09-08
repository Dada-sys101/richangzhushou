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
              content: buildDeepSeekSystemPrompt(
                request.input.requestType,
                this.configuration.model,
              ),
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

function buildDeepSeekSystemPrompt(
  requestType: AiProviderRequest["input"]["requestType"],
  model: string,
): string {
  const fieldInstructions: Record<string, string> = {
    CALENDAR_EVENT:
      "fields 必须只包含 title、startsAt、endsAt、allDay；startsAt 和 endsAt 使用 ISO 8601，allDay 为 boolean 或 null。",
    REMINDER:
      "fields 必须只包含 title、note、scheduleType、startsAt、targetType、targetId、recurrence；scheduleType 只能是 ONCE、DAILY、WEEKLY、MONTHLY，startsAt 使用 ISO 8601，未知可选字段使用 null。",
    TASK: "fields 必须只包含 title、dueAt、priority；title 必填，dueAt 使用 ISO 8601 或 null，priority 只能是 LOW、MEDIUM、HIGH 或 null。",
    TRANSACTION:
      "fields 必须只包含 type、amount、currency、occurredAt、merchant、note、source、accountId、categoryId、tripId、originalTransactionId、isUnlinkedRefund；amount 使用十进制定点数字字符串，occurredAt 使用 ISO 8601，source 必须是 TEXT，未知可选字段使用 null。",
    TRIP: "fields 必须只包含 title、destination、startDate、endDate、budgetAmount；startDate 和 endDate 使用 YYYY-MM-DD，budgetAmount 使用十进制定点数字字符串或 null。",
  };
  const fieldInstruction =
    fieldInstructions[requestType] ??
    "fields 必须只包含当前请求类型允许的字段。";
  const formatExample: Record<string, string> = {
    CALENDAR_EVENT:
      'CALENDAR_EVENT 示例 fields：{"title":"产品评审","startsAt":"2026-09-03T06:00:00.000Z","endsAt":"2026-09-03T07:00:00.000Z","allDay":false}。',
    REMINDER:
      'REMINDER 示例 fields：{"title":"给植物浇水","note":null,"scheduleType":"ONCE","startsAt":"2026-09-04T01:00:00.000Z","targetType":"STANDALONE","targetId":null,"recurrence":null}。',
    TASK: 'TASK 示例 fields：{"title":"提交周报","dueAt":"2026-09-04T09:00:00.000Z","priority":"HIGH"}。',
    TRANSACTION:
      'TRANSACTION 示例 fields：{"type":"EXPENSE","amount":"38.50","currency":"CNY","occurredAt":"2026-09-01T08:00:00.000Z","merchant":"示例咖啡店","note":null,"source":"TEXT","accountId":null,"categoryId":null,"tripId":null,"originalTransactionId":null,"isUnlinkedRefund":false}；amount 必须是带两位小数的字符串，绝不能是数字。',
    TRIP: 'TRIP 示例 fields：{"title":"北京商务出差","destination":"北京","startDate":"2026-09-05","endDate":"2026-09-07","budgetAmount":"2000.00"}；日期必须严格为 YYYY-MM-DD，budgetAmount 必须是带两位小数的字符串，绝不能使用数字或日期时间。',
  };
  const selectedFormatExample =
    formatExample[requestType] ?? "请严格遵循当前请求类型的字段类型。";

  return [
    "Return JSON only. Do not return Markdown, explanations, or a different top-level shape.",
    "You are producing a Daily Assistant AI Proposal candidate, not writing any business record.",
    `The configured modelId is exactly ${JSON.stringify(model)} and providerId is exactly "deepseek".`,
    `The requestType is exactly ${JSON.stringify(requestType)}; every operation.operationType must match it.`,
    "The only allowed top-level keys are resultType, providerId, modelId, clarification, missingFields, and operations.",
    "For SUCCESS, use clarification=null, missingFields=[], and return one or more operations.",
    "For UNCERTAIN, do not guess missing or ambiguous facts: use operations=[], confidence 0.0000, provide a concise clarification, and list missingFields.",
    "If a required or decision-critical fact is missing, ambiguous, contradictory, or represented by a placeholder, the resultType must be UNCERTAIN; never invent a value to make SUCCESS possible.",
    "Never use placeholder titles or values such as 待定任务, 未命名, or a generic verb/noun as if they were confirmed user facts. A vague task-only input such as 买东西 without a concrete actionable detail must be UNCERTAIN; a specific task title may still have nullable optional dueAt or priority.",
    'Each operation must contain exactly operationType, status="PENDING", confidence (a four-decimal string from 0.0000 to 1.0000), clarification (string or null), and fields.',
    fieldInstruction,
    selectedFormatExample,
    "Use the request's currentDateTime and timeZoneId for relative dates. Keep user-provided facts unchanged. Never add userId, email, token, credential, or other fields.",
    'Example SUCCESS shape: {"resultType":"SUCCESS","providerId":"deepseek","modelId":"MODEL_ID","clarification":null,"missingFields":[],"operations":[{"operationType":"TASK","status":"PENDING","confidence":"0.9000","clarification":null,"fields":{"title":"提交周报","dueAt":null,"priority":"MEDIUM"}}]}.',
    'Example UNCERTAIN shape: {"resultType":"UNCERTAIN","providerId":"deepseek","modelId":"MODEL_ID","clarification":"请补充具体任务内容。","missingFields":["title"],"operations":[]}.',
  ].join("\\n");
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
