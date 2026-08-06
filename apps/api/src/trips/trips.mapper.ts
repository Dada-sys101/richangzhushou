import type {
  PackingItemSummary,
  TripItemSummary,
  TripSummary,
} from "@daily-assistant/api-contracts";

import type {
  PackingItem,
  Trip,
  TripItem,
} from "../generated/prisma/client.js";
import { formatMoney } from "../finance/money.util.js";

export function toTripSummary(row: Trip): TripSummary {
  return {
    budgetAmount: row.budgetAmount ? formatMoney(row.budgetAmount) : null,
    createdAt: row.createdAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    destination: row.destination,
    endDate: formatTripDate(row.endDate),
    id: row.id,
    startDate: formatTripDate(row.startDate),
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

export function toTripItemSummary(row: TripItem): TripItemSummary {
  return {
    createdAt: row.createdAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    endsAt: row.endsAt.toISOString(),
    id: row.id,
    location: row.location,
    position: row.position,
    startsAt: row.startsAt.toISOString(),
    tripId: row.tripId,
    type: row.type,
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

export function toPackingItemSummary(row: PackingItem): PackingItemSummary {
  return {
    checked: row.checked,
    createdAt: row.createdAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    id: row.id,
    position: row.position,
    text: row.text,
    tripId: row.tripId,
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

function formatTripDate(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).formatToParts(value);
  const byType = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${byType.year ?? "1970"}-${byType.month ?? "01"}-${byType.day ?? "01"}`;
}
