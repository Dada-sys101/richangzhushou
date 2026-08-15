import { Injectable } from "@nestjs/common";
import type { AiOperationType } from "@daily-assistant/api-contracts";

import { ApiException } from "../common/api-error.js";
import { FakeAiProvider } from "./fake-provider/fake-ai-provider.js";
import type { FakeAiProviderScenario } from "./fake-provider/fake-ai-provider.types.js";

const REQUEST_TYPE_SCENARIOS = {
  CALENDAR_EVENT: "CALENDAR_EVENT_SUCCESS",
  REMINDER: "REMINDER_SUCCESS",
  TASK: "TASK_SUCCESS",
  TRANSACTION: "TRANSACTION_SUCCESS",
  TRIP: "TRIP_SUCCESS",
} as const satisfies Record<AiOperationType, FakeAiProviderScenario>;

@Injectable()
export class AiFakeProviderFactory {
  create(requestType: string): FakeAiProvider {
    return new FakeAiProvider({
      scenario: scenarioForRequestType(requestType),
    });
  }
}

export function scenarioForRequestType(
  requestType: string,
): FakeAiProviderScenario {
  if (isAiOperationType(requestType)) {
    return REQUEST_TYPE_SCENARIOS[requestType];
  }
  throw new ApiException(
    "AI_INPUT_VALIDATION_ERROR",
    400,
    "Unsupported AI request type",
  );
}

export function operationTypeForRequestType(
  requestType: string,
): AiOperationType {
  if (isAiOperationType(requestType)) {
    return requestType;
  }
  throw new ApiException(
    "AI_INPUT_VALIDATION_ERROR",
    400,
    "Unsupported AI request type",
  );
}

function isAiOperationType(value: string): value is AiOperationType {
  return Object.hasOwn(REQUEST_TYPE_SCENARIOS, value);
}
