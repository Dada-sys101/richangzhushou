import type { CalendarEventSummary } from "@daily-assistant/api-contracts";

import type { CalendarEvent } from "../generated/prisma/client.js";

export function toCalendarEventSummary(
  row: CalendarEvent,
): CalendarEventSummary {
  return {
    allDay: row.allDay,
    createdAt: row.createdAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    endsAt: row.endsAt.toISOString(),
    id: row.id,
    startsAt: row.startsAt.toISOString(),
    status: row.status,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}
