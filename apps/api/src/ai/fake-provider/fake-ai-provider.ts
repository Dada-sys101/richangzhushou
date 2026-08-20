import type {
  AiProviderInput,
  ApiErrorCode,
} from "@daily-assistant/api-contracts";

import {
  buildCalendarEventCandidate,
  buildControlledFailureDetails,
  buildReminderCandidate,
  buildTaskCandidate,
  buildTransactionCandidate,
  buildTripCandidate,
  buildUncertainResult,
} from "./fake-ai-provider.fixtures.js";
import type {
  FakeAiOperationCandidate,
  FakeAiProviderConfiguration,
  FakeAiProviderErrorDetails,
  FakeAiProviderResult,
  FakeAiProviderSuccessResult,
} from "./fake-ai-provider.types.js";
import {
  FAKE_AI_MODEL_ID,
  FAKE_AI_PROVIDER_ID,
} from "./fake-ai-provider.types.js";

/**
 * Deterministic controlled failure. It is a plain in-memory error with a
 * stable message and error code — never a real Provider, network or
 * credential failure.
 */
export class FakeAiProviderError extends Error {
  readonly providerId: string;
  readonly modelId: string;
  readonly errorCategory: FakeAiProviderErrorDetails["errorCategory"];
  readonly errorCode: ApiErrorCode;
  readonly httpStatus: number | undefined;
  readonly retryable: boolean;

  constructor(details: FakeAiProviderErrorDetails) {
    super(details.message);
    this.name = "FakeAiProviderError";
    this.providerId = details.providerId;
    this.modelId = details.modelId;
    this.errorCategory = details.errorCategory;
    this.errorCode = details.errorCode;
    this.httpStatus = details.httpStatus;
    this.retryable = details.retryable;
  }
}

/**
 * PR18 deterministic Fake AI Provider.
 *
 * Guarantees:
 * - pure memory: no network, no credentials, no database, no Domain Service;
 * - deterministic: same configuration + same AiProviderInput -> deep-equal
 *   result;
 * - input immutable: AiProviderInput is never modified;
 * - candidate only: output operations are always PENDING and never ACCEPTED
 *   or APPLIED; no business write is ever performed;
 * - scenario control stays private (FakeAiProviderConfiguration) and never
 *   leaks into AiProviderInput.
 */
export class FakeAiProvider {
  readonly providerId: string = FAKE_AI_PROVIDER_ID;
  readonly modelId: string = FAKE_AI_MODEL_ID;

  constructor(private readonly configuration: FakeAiProviderConfiguration) {}

  generate(input: AiProviderInput): FakeAiProviderResult {
    switch (this.configuration.scenario) {
      case "SUCCESS":
        return this.successForRequestType(input);
      case "TRANSACTION_SUCCESS":
        return this.successResult([buildTransactionCandidate(input)]);
      case "CALENDAR_EVENT_SUCCESS":
        return this.successResult([buildCalendarEventCandidate(input)]);
      case "TASK_SUCCESS":
        return this.successResult([buildTaskCandidate(input)]);
      case "REMINDER_SUCCESS":
        return this.successResult([buildReminderCandidate(input)]);
      case "TRIP_SUCCESS":
        return this.successResult([buildTripCandidate(input)]);
      case "UNCERTAIN":
        return buildUncertainResult(input);
      case "NETWORK_ERROR":
        throw this.failure("NETWORK_ERROR", "AI_PROVIDER_NETWORK_ERROR", true);
      case "TIMEOUT":
        throw this.failure("TIMEOUT", "AI_PROVIDER_TIMEOUT", true);
      case "HTTP_429":
        throw this.failure("HTTP_429", "AI_PROVIDER_ERROR", true, 429);
      case "HTTP_5XX":
        throw this.failure("HTTP_5XX", "AI_PROVIDER_ERROR", true, 503);
      case "HTTP_4XX":
        throw this.failure("HTTP_4XX", "AI_PROVIDER_ERROR", false, 400);
      case "AUTH_ERROR":
        throw this.failure("AUTH_ERROR", "AI_PROVIDER_ERROR", false, 401);
      case "AUTHZ_ERROR":
        throw this.failure("AUTHZ_ERROR", "AI_PROVIDER_ERROR", false, 403);
      case "SCHEMA_INVALID":
        throw this.failure(
          "SCHEMA_INVALID",
          "AI_SCHEMA_VALIDATION_ERROR",
          false,
        );
      case "DOMAIN_INVALID":
        return this.successResult([
          {
            clarification: null,
            confidence: "0.9000",
            fields: {},
            operationType: this.operationType(input.requestType),
            status: "PENDING",
          },
        ]);
      case "MALFORMED_RESPONSE":
        return null as unknown as FakeAiProviderResult;
      case "SAFETY_FAILURE":
      case "CONTROLLED_FAILURE":
        throw new FakeAiProviderError(buildControlledFailureDetails());
      default:
        return this.assertNever(this.configuration.scenario);
    }
  }

  private successForRequestType(input: AiProviderInput): FakeAiProviderResult {
    switch (input.requestType) {
      case "TRANSACTION":
        return this.successResult([buildTransactionCandidate(input)]);
      case "CALENDAR_EVENT":
        return this.successResult([buildCalendarEventCandidate(input)]);
      case "TASK":
        return this.successResult([buildTaskCandidate(input)]);
      case "REMINDER":
        return this.successResult([buildReminderCandidate(input)]);
      case "TRIP":
        return this.successResult([buildTripCandidate(input)]);
      default:
        throw this.failure("HTTP_4XX", "AI_PROVIDER_ERROR", false, 400);
    }
  }

  private operationType(
    value: string,
  ): FakeAiOperationCandidate["operationType"] {
    switch (value) {
      case "TRANSACTION":
      case "CALENDAR_EVENT":
      case "TASK":
      case "REMINDER":
      case "TRIP":
        return value;
      default:
        return "TASK";
    }
  }

  private failure(
    errorCategory: FakeAiProviderErrorDetails["errorCategory"],
    errorCode: ApiErrorCode,
    retryable: boolean,
    httpStatus?: number,
  ): FakeAiProviderError {
    return new FakeAiProviderError({
      errorCategory,
      errorCode,
      httpStatus,
      message: "Deterministic Fake AI Provider failure.",
      modelId: this.modelId,
      providerId: this.providerId,
      retryable,
    });
  }

  private successResult(
    operations: FakeAiOperationCandidate[],
  ): FakeAiProviderSuccessResult {
    return {
      resultType: "SUCCESS",
      providerId: this.providerId,
      modelId: this.modelId,
      operations,
    };
  }

  private assertNever(value: never): never {
    throw new Error(`Unsupported Fake Provider scenario: ${String(value)}`);
  }
}
