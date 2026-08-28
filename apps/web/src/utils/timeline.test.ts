import { describe, expect, it } from "vitest";

import { buildTimeline } from "./timeline";

describe("buildTimeline", () => {
  it("merges entities by time and puts undated tasks last", () => {
    const items = buildTimeline(
      [
        {
          allDay: false,
          createdAt: "",
          deletedAt: null,
          endsAt: "2026-08-28T03:00:00.000Z",
          id: "event",
          startsAt: "2026-08-28T02:00:00.000Z",
          status: "SCHEDULED",
          title: "日程",
          updatedAt: "",
          version: 1,
        },
      ],
      [
        {
          cancelledAt: null,
          completedAt: null,
          createdAt: "",
          deletedAt: null,
          dueAt: null,
          id: "later",
          overdue: false,
          priority: "LOW",
          status: "OPEN",
          title: "无时间待办",
          updatedAt: "",
          version: 1,
        },
        {
          cancelledAt: null,
          completedAt: null,
          createdAt: "",
          deletedAt: null,
          dueAt: "2026-08-28T01:00:00.000Z",
          id: "task",
          overdue: false,
          priority: "HIGH",
          status: "OPEN",
          title: "待办",
          updatedAt: "",
          version: 1,
        },
      ],
      [
        {
          attemptCount: 0,
          createdAt: "",
          deletedAt: null,
          failureReason: null,
          id: "reminder",
          note: null,
          recurrence: null,
          scheduleType: "ONCE",
          scheduledAt: "2026-08-28T01:30:00.000Z",
          sentAt: null,
          status: "SCHEDULED",
          suppressedAt: null,
          targetId: null,
          targetType: "STANDALONE",
          title: "提醒",
          updatedAt: "",
          version: 1,
        },
      ],
    );
    expect(items.map((item) => item.id)).toEqual([
      "task",
      "reminder",
      "event",
      "later",
    ]);
  });
});
