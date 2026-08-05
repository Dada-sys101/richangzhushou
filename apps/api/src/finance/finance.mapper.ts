import type {
  BudgetSummary,
  CategorySummary,
  FinancialAccountSummary,
  TransactionSummary,
} from "@daily-assistant/api-contracts";

import type {
  Budget,
  Category,
  FinancialAccount,
  Transaction,
} from "../generated/prisma/client.js";
import { formatMoney } from "./money.util.js";

export function toTransactionSummary(
  row: Transaction & {
    category?: { id: string; name: string; kind: string } | null;
    account?: { id: string; name: string } | null;
  },
): TransactionSummary {
  return {
    accountId: row.accountId,
    amount: formatMoney(row.amount),
    categoryId: row.categoryId,
    createdAt: row.createdAt.toISOString(),
    currency: row.currency,
    deletedAt: row.deletedAt?.toISOString() ?? null,
    id: row.id,
    isUnlinkedRefund: row.isUnlinkedRefund,
    merchant: row.merchant,
    note: row.note,
    occurredAt: row.occurredAt.toISOString(),
    originalTransactionId: row.originalTransactionId,
    source: row.source,
    sourceFingerprint: row.sourceFingerprint,
    status: row.status,
    type: row.type,
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

export function toCategorySummary(row: Category): CategorySummary {
  return {
    color: row.color,
    createdAt: row.createdAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    id: row.id,
    isArchived: row.isArchived,
    kind: row.kind,
    name: row.name,
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

export function toFinancialAccountSummary(
  row: FinancialAccount,
): FinancialAccountSummary {
  return {
    createdAt: row.createdAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    id: row.id,
    isArchived: row.isArchived,
    kind: row.kind,
    name: row.name,
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

export function toBudgetSummary(
  row: Budget & { category?: { id: string; name: string } | null },
): BudgetSummary {
  return {
    amount: formatMoney(row.amount),
    categoryId: row.categoryId,
    createdAt: row.createdAt.toISOString(),
    currency: row.currency,
    deletedAt: row.deletedAt?.toISOString() ?? null,
    id: row.id,
    month: row.month,
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}
