import type { AiProviderInput } from "@daily-assistant/api-contracts";

import type {
  FakeAiOperationCandidate,
  FakeAiProviderErrorDetails,
  FakeAiProviderUncertainResult,
} from "./fake-ai-provider.types.js";
import {
  FAKE_AI_MODEL_ID,
  FAKE_AI_PROVIDER_ID,
} from "./fake-ai-provider.types.js";

const DAY_MS = 86_400_000;

const MAX_NOTE_LENGTH = 500;
const MAX_TITLE_LENGTH = 200;

/**
 * Pure deterministic time derivation. The only allowed time source is
 * AiProviderInput.currentDateTime; no system clock, Date.now() or randomness
 * is ever used, so identical inputs always yield identical timestamps.
 */
function addDays(isoDateTime: string, days: number): string {
  const date = new Date(isoDateTime);
  return new Date(date.getTime() + days * DAY_MS).toISOString();
}

function dateOnly(isoDateTime: string): string {
  return isoDateTime.slice(0, 10);
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : value.slice(0, maxLength);
}

export function buildTransactionCandidate(
  input: AiProviderInput,
): FakeAiOperationCandidate {
  return {
    operationType: "TRANSACTION",
    status: "PENDING",
    confidence: "0.9500",
    fields: {
      type: "EXPENSE",
      amount: "38.50",
      currency: input.currency,
      occurredAt: addDays(input.currentDateTime, 0),
      merchant: "示例咖啡店",
      note: truncate(input.userInput, MAX_NOTE_LENGTH),
      source: "TEXT",
    },
    clarification: null,
  };
}

export function buildCalendarEventCandidate(
  input: AiProviderInput,
): FakeAiOperationCandidate {
  return {
    operationType: "CALENDAR_EVENT",
    status: "PENDING",
    confidence: "0.9500",
    fields: {
      title: truncate(input.userInput, MAX_TITLE_LENGTH),
      startsAt: addDays(input.currentDateTime, 1),
      endsAt: addDays(input.currentDateTime, 1),
      allDay: false,
    },
    clarification: null,
  };
}

export function buildTaskCandidate(
  input: AiProviderInput,
): FakeAiOperationCandidate {
  return {
    operationType: "TASK",
    status: "PENDING",
    confidence: "0.9000",
    fields: {
      title: truncate(input.userInput, MAX_TITLE_LENGTH),
      priority: "MEDIUM",
      dueAt: addDays(input.currentDateTime, 3),
    },
    clarification: null,
  };
}

export function buildReminderCandidate(
  input: AiProviderInput,
): FakeAiOperationCandidate {
  return {
    operationType: "REMINDER",
    status: "PENDING",
    confidence: "0.9000",
    fields: {
      title: truncate(input.userInput, MAX_TITLE_LENGTH),
      note: input.userInput,
      scheduleType: "ONCE",
      startsAt: addDays(input.currentDateTime, 1),
      targetType: "STANDALONE",
    },
    clarification: null,
  };
}

export function buildTripCandidate(
  input: AiProviderInput,
): FakeAiOperationCandidate {
  return {
    operationType: "TRIP",
    status: "PENDING",
    confidence: "0.8500",
    fields: {
      title: truncate(input.userInput, MAX_TITLE_LENGTH),
      destination: "上海",
      startDate: dateOnly(addDays(input.currentDateTime, 7)),
      endDate: dateOnly(addDays(input.currentDateTime, 9)),
      budgetAmount: "2000.00",
    },
    clarification: null,
  };
}

/**
 * Explicit uncertainty / missing-field result. The Fake Provider never
 * guesses the missing business facts: it reports the uncertainty, asks for
 * clarification and lists the missing fields instead.
 */
export function buildUncertainResult(
  input: AiProviderInput,
): FakeAiProviderUncertainResult {
  return {
    resultType: "UNCERTAIN",
    providerId: FAKE_AI_PROVIDER_ID,
    modelId: FAKE_AI_MODEL_ID,
    operations: [],
    clarification:
      "提醒内容不明确，请补充具体要提醒的事项。input 原文：".concat(
        truncate(input.userInput, 200),
      ),
    missingFields: ["title", "content"],
  };
}

/** Deterministic controlled failure details; never a real network failure. */
export function buildControlledFailureDetails(): FakeAiProviderErrorDetails {
  return {
    providerId: FAKE_AI_PROVIDER_ID,
    modelId: FAKE_AI_MODEL_ID,
    errorCategory: "SAFETY_FAILURE",
    errorCode: "AI_PROVIDER_ERROR",
    message: "Controlled failure from the Fake AI Provider.",
    retryable: false,
  };
}
