import { centsOf, moneyOf } from "./money";
import { getLocal, listLocal, type SyncEntityType } from "./sync";

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

export async function localList(
  userId: string,
  entityType: SyncEntityType,
): Promise<Record<string, unknown>[]> {
  return listLocal(userId, entityType);
}

export async function localGet(
  userId: string,
  entityType: SyncEntityType,
  id: string,
): Promise<Record<string, unknown> | null> {
  return getLocal(userId, entityType, id);
}

export function mergePending<T extends object>(
  items: T[],
  localItems: T[],
): T[] {
  const byId = new Map(
    items.map((item) => [String((item as Record<string, unknown>).id), item]),
  );
  for (const item of localItems) {
    const id = String((item as Record<string, unknown>).id);
    if (!byId.has(id)) {
      byId.set(id, item);
    }
  }
  return [...byId.values()];
}

export function localSummary(
  transactions: Array<Record<string, unknown>>,
  budgets: Array<Record<string, unknown>>,
  categories: Array<Record<string, unknown>>,
  month: string,
): {
  budgets: Array<Record<string, unknown>>;
  currency: string;
  month: string;
  netExpense: string;
  todaySpend: string;
  totalExpense: string;
  totalIncome: string;
  totalRefund: string;
  updatedAt: string;
} {
  const monthStart = monthStartMs(month);
  const monthEnd = monthEndMs(month);
  const today = todayRangeMs();
  let totalExpense = 0n;
  let totalRefund = 0n;
  let totalIncome = 0n;
  let todayExpense = 0n;
  let todayRefund = 0n;
  for (const transaction of activeTransactions(transactions)) {
    const time = Date.parse(String(transaction.occurredAt ?? ""));
    const amount = centsOf(String(transaction.amount ?? "0.00"));
    if (time >= monthStart && time < monthEnd) {
      if (transaction.type === "EXPENSE") {
        totalExpense += amount;
      } else if (transaction.type === "REFUND") {
        totalRefund += amount;
      } else if (transaction.type === "INCOME") {
        totalIncome += amount;
      }
    }
    if (time >= today.start && time < today.end) {
      if (transaction.type === "EXPENSE") {
        todayExpense += amount;
      } else if (transaction.type === "REFUND") {
        todayRefund += amount;
      }
    }
  }
  const categoryNames = new Map(
    categories.map((category) => [
      String(category.id),
      String(category.name ?? ""),
    ]),
  );
  const progress = budgets
    .filter(
      (budget) =>
        budget.month === month &&
        (budget.deletedAt === null || budget.deletedAt === undefined),
    )
    .map((budget) => {
      const categoryId = budget.categoryId ? String(budget.categoryId) : null;
      let spent = 0n;
      for (const transaction of activeTransactions(transactions)) {
        const time = Date.parse(String(transaction.occurredAt ?? ""));
        if (time < monthStart || time >= monthEnd) {
          continue;
        }
        if (categoryId !== null && transaction.categoryId !== categoryId) {
          continue;
        }
        if (transaction.type === "EXPENSE") {
          spent += centsOf(String(transaction.amount ?? "0.00"));
        } else if (transaction.type === "REFUND") {
          spent -= centsOf(String(transaction.amount ?? "0.00"));
        }
      }
      const amountCents = centsOf(String(budget.amount ?? "0.00"));
      const remaining = amountCents - spent;
      const progressValue =
        amountCents > 0n ? moneyOf((spent * 100n) / amountCents) : "0.00";
      return {
        amount: moneyOf(amountCents),
        budgetId: String(budget.id),
        categoryId,
        categoryName: categoryId
          ? (categoryNames.get(categoryId) ?? null)
          : null,
        progress: progressValue,
        remaining: moneyOf(remaining),
        spent: moneyOf(spent),
      };
    });
  const netExpense = totalExpense - totalRefund;
  const todaySpend = todayExpense - todayRefund;
  return {
    budgets: progress,
    currency: "CNY",
    month,
    netExpense: moneyOf(netExpense),
    todaySpend: moneyOf(todaySpend),
    totalExpense: moneyOf(totalExpense),
    totalIncome: moneyOf(totalIncome),
    totalRefund: moneyOf(totalRefund),
    updatedAt: new Date().toISOString(),
  };
}

export function localTripDetail(
  trip: Record<string, unknown> | null,
  items: Array<Record<string, unknown>>,
  packingItems: Array<Record<string, unknown>>,
  transactions: Array<Record<string, unknown>>,
  calendarEvents: Array<Record<string, unknown>>,
): Record<string, unknown> | null {
  if (!trip) {
    return null;
  }
  const tripId = String(trip.id);
  const linked = activeTransactions(transactions).filter(
    (transaction) => transaction.tripId === tripId,
  );
  let expense = 0n;
  let refund = 0n;
  for (const transaction of linked) {
    if (transaction.type === "EXPENSE") {
      expense += centsOf(String(transaction.amount ?? "0.00"));
    } else if (transaction.type === "REFUND") {
      refund += centsOf(String(transaction.amount ?? "0.00"));
    }
  }
  const actual = expense - refund;
  const budgetAmount =
    trip.budgetAmount === null || trip.budgetAmount === undefined
      ? null
      : String(trip.budgetAmount);
  const budgetCents = budgetAmount ? centsOf(budgetAmount) : null;
  const budgetProgress =
    budgetCents && budgetCents > 0n
      ? moneyOf((actual * 100n) / budgetCents)
      : null;
  const start = Date.parse(`${String(trip.startDate)}T00:00:00+08:00`);
  const end =
    Date.parse(`${String(trip.endDate)}T00:00:00+08:00`) + 24 * 60 * 60 * 1000;
  const inRange = calendarEvents.filter((event) => {
    const startsAt = Date.parse(String(event.startsAt ?? ""));
    const endsAt = Date.parse(String(event.endsAt ?? ""));
    return startsAt < end && endsAt > start;
  });
  return {
    calendarEvents: inRange,
    expense: {
      actualExpense: moneyOf(actual),
      budgetAmount,
      budgetProgress,
    },
    items,
    linkedTransactions: linked,
    packingItems,
    trip,
  };
}

function activeTransactions(
  transactions: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return transactions.filter(
    (transaction) =>
      transaction.status === "CONFIRMED" &&
      (transaction.deletedAt === null || transaction.deletedAt === undefined),
  );
}

function monthStartMs(month: string): number {
  const parts = month.split("-").map(Number);
  const year = parts[0] ?? 0;
  const monthIndex = parts[1] ?? 0;
  return Date.UTC(year, monthIndex - 1, 1) - SHANGHAI_OFFSET_MS;
}

function monthEndMs(month: string): number {
  const parts = month.split("-").map(Number);
  const year = parts[0] ?? 0;
  const monthIndex = parts[1] ?? 0;
  return Date.UTC(year, monthIndex, 1) - SHANGHAI_OFFSET_MS;
}

function todayRangeMs(): { end: number; start: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).formatToParts(now);
  const byType = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  const start =
    Date.UTC(
      Number(byType.year),
      Number(byType.month) - 1,
      Number(byType.day),
    ) - SHANGHAI_OFFSET_MS;
  return { end: start + 24 * 60 * 60 * 1000, start };
}
