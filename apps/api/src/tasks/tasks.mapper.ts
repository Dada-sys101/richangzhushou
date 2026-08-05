import type { TaskSummary } from "@daily-assistant/api-contracts";

import type { Task } from "../generated/prisma/client.js";

export function toTaskSummary(row: Task, now = new Date()): TaskSummary {
  return {
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    dueAt: row.dueAt?.toISOString() ?? null,
    id: row.id,
    overdue:
      row.status === "OPEN" &&
      row.dueAt !== null &&
      row.dueAt.getTime() < now.getTime(),
    priority: row.priority,
    status: row.status,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}
