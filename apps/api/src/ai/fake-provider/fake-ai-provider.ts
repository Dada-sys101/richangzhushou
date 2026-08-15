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
  readonly errorCategory: "CONTROLLED_FAILURE";
  readonly errorCode: ApiErrorCode;

  constructor(details: FakeAiProviderErrorDetails) {
    super(details.message);
    this.name = "FakeAiProviderError";
    this.providerId = details.providerId;
    this.modelId = details.modelId;
    this.errorCategory = details.errorCategory;
    this.errorCode = details.errorCode;
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
      case "CONTROLLED_FAILURE":
        throw new FakeAiProviderError(buildControlledFailureDetails());
      default:
        return this.assertNever(this.configuration.scenario);
    }
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
