import type {
  CalendarEventSummary,
  ReminderSummary,
  TaskSummary,
} from "../api/client";
import { formatShanghaiDate, todayInShanghai } from "./time";

export type TimelineKind = "EVENT" | "TASK" | "REMINDER";

export interface TimelineItem {
  id: string;
  kind: TimelineKind;
  overdue: boolean;
  path: string;
  priority?: TaskSummary["priority"];
  scheduledAt: string | null;
  title: string;
}

export function buildTimeline(
  events: CalendarEventSummary[],
  tasks: TaskSummary[],
  reminders: ReminderSummary[],
): TimelineItem[] {
  const items: TimelineItem[] = [
    ...events
      .filter((item) => !item.deletedAt && item.status === "SCHEDULED")
      .map((item) => ({
        id: item.id,
        kind: "EVENT" as const,
        overdue: false,
        path: `/calendar/${item.id}`,
        scheduledAt: item.startsAt,
        title: item.title,
      })),
    ...tasks
      .filter((item) => !item.deletedAt && item.status === "OPEN")
      .map((item) => ({
        id: item.id,
        kind: "TASK" as const,
        overdue: item.overdue,
        path: `/tasks/${item.id}`,
        priority: item.priority,
        scheduledAt: item.dueAt,
        title: item.title,
      })),
    ...reminders
      .filter((item) => !item.deletedAt && item.status === "SCHEDULED")
      .map((item) => ({
        id: item.id,
        kind: "REMINDER" as const,
        overdue: false,
        path: `/reminders/${item.id}`,
        scheduledAt: item.scheduledAt,
        title: item.title,
      })),
  ];

  return items.sort((left, right) => {
    if (left.scheduledAt === null && right.scheduledAt === null) {
      return left.title.localeCompare(right.title, "zh-CN");
    }
    if (left.scheduledAt === null) return 1;
    if (right.scheduledAt === null) return -1;
    return (
      new Date(left.scheduledAt).getTime() -
      new Date(right.scheduledAt).getTime()
    );
  });
}

export function isInTimelineRange(
  item: TimelineItem,
  range: "TODAY" | "TOMORROW" | "WEEK" | "MONTH" | "FUTURE" | "OVERDUE",
): boolean {
  const today = todayInShanghai();
  if (range === "OVERDUE") return item.kind === "TASK" && item.overdue;
  if (item.scheduledAt === null) return range === "TODAY" || range === "MONTH";

  const day = formatShanghaiDate(new Date(item.scheduledAt));
  if (range === "TODAY") return day === today;
  if (range === "TOMORROW") return day === plusDays(today, 1);
  if (range === "MONTH") return day.startsWith(today.slice(0, 7));
  if (range === "FUTURE") return day > today;
  return day >= today && day <= plusDays(today, 6);
}

function plusDays(date: string, days: number): string {
  const [year = 1970, month = 1, day = 1] = date.split("-").map(Number);
  return formatShanghaiDate(new Date(Date.UTC(year, month - 1, day + days)));
}
