import { Injectable } from "@nestjs/common";
import type {
  BudgetProgress,
  BudgetSummary,
  CategorySummary,
  DuplicateWarning,
  FinanceSummaryResponse,
  FinancialAccountSummary,
  TransactionCreatedResponse,
  TransactionSummary,
} from "@daily-assistant/api-contracts";

import {
  Prisma,
  type Budget,
  type PrismaClient,
  type Transaction,
} from "../generated/prisma/client.js";
import { ApiException } from "../common/api-error.js";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  toBudgetSummary,
  toCategorySummary,
  toFinancialAccountSummary,
  toTransactionSummary,
} from "./finance.mapper.js";
import { formatMoney, toDecimal, zeroMoney } from "./money.util.js";
import {
  currentMonth,
  dayBounds,
  isValidMonth,
  monthBounds,
  toZonedDay,
} from "./time.util.js";
import type {
  CreateBudgetDto,
  CreateCategoryDto,
  CreateFinancialAccountDto,
  CreateTransactionDto,
  ExportCsvQueryDto,
  ListBudgetsQueryDto,
  ListCategoriesQueryDto,
  ListFinancialAccountsQueryDto,
  ListTransactionsQueryDto,
  SummaryQueryDto,
  UpdateBudgetDto,
  UpdateCategoryDto,
  UpdateFinancialAccountDto,
  UpdateTransactionDto,
} from "./dto/finance.dto.js";

const DEFAULT_COLOR = "#64748B";
const DEFAULT_CURRENCY = "CNY";
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
const CSV_MAX_ROWS = 10_000;

type TransactionTypeValue = "EXPENSE" | "INCOME" | "REFUND";
type RecordSourceValue =
  "MANUAL" | "SHORTCUT" | "OCR" | "TEXT" | "VOICE" | "IMPORT";

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async listTransactions(
    userId: string,
    query: ListTransactionsQueryDto,
  ): Promise<{ items: TransactionSummary[]; nextCursor: string | null }> {
    const limit = Number(query.limit ?? 50);
    const where: Prisma.TransactionWhereInput = {
      userId,
      deletedAt: query.includeDeleted ? undefined : null,
      ...(query.type ? { type: query.type } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.accountId ? { accountId: query.accountId } : {}),
      ...(query.month
        ? (() => {
            const bounds = this.monthRange(query.month);
            return { occurredAt: { gte: bounds.start, lt: bounds.end } };
          })()
        : {}),
    };
    const rows = await this.prisma.transaction.findMany({
      cursor: query.cursor ? { id: query.cursor } : undefined,
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      skip: query.cursor ? 1 : 0,
      take: limit + 1,
      where,
    });
    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map(
      toTransactionSummary,
    );
    return {
      items,
      nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
    };
  }

  async createTransaction(
    userId: string,
    dto: CreateTransactionDto,
    tx?: Prisma.TransactionClient,
  ): Promise<TransactionCreatedResponse> {
    const db = tx ?? this.prisma;
    const input = this.normalizeCreateInput(userId, dto);

    if (input.clientMutationId) {
      const replayed = await this.findByIdempotencyKey(
        userId,
        input.clientMutationId,
        db,
      );
      if (replayed) {
        this.assertSameMutation(replayed, input);
        return { transaction: toTransactionSummary(replayed) };
      }
    }

    await this.validateRefundRules(userId, input, db);
    await this.resolveCategory(userId, input.categoryId, input.type, db);
    await this.resolveAccount(userId, input.accountId, db);
    await this.resolveTrip(userId, input.tripId, db);
    const duplicate = await this.findPossibleDuplicate(userId, input, db);

    try {
      const created = await db.transaction.create({
        data: {
          accountId: input.accountId,
          amount: input.amount,
          categoryId: input.categoryId,
          clientMutationId: input.clientMutationId,
          currency: input.currency,
          isUnlinkedRefund: input.isUnlinkedRefund,
          merchant: input.merchant,
          note: input.note,
          occurredAt: input.occurredAt,
          originalTransactionId: input.originalTransactionId,
          source: input.source,
          sourceFingerprint: input.sourceFingerprint,
          status: "CONFIRMED",
          tripId: input.tripId,
          type: input.type,
          userId,
          version: 1,
        },
      });
      return this.withDuplicateWarning(created, duplicate);
    } catch (error) {
      if (this.isUniqueViolation(error) && input.clientMutationId !== null) {
        const replayed = await this.findByIdempotencyKey(
          userId,
          input.clientMutationId,
          db,
        );
        if (replayed) {
          this.assertSameMutation(replayed, input);
          return { transaction: toTransactionSummary(replayed) };
        }
      }
      throw error;
    }
  }

  async getTransaction(
    userId: string,
    id: string,
  ): Promise<TransactionSummary> {
    const row = await this.prisma.transaction.findFirst({
      where: { id, userId },
    });
    if (!row) {
      throw new ApiException(
        "RESOURCE_NOT_FOUND",
        404,
        "Transaction not found",
      );
    }
    return toTransactionSummary(row);
  }

  async updateTransaction(
    userId: string,
    id: string,
    dto: UpdateTransactionDto,
  ): Promise<TransactionCreatedResponse> {
    const current = await this.prisma.transaction.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!current) {
      throw new ApiException(
        "RESOURCE_NOT_FOUND",
        404,
        "Transaction not found",
      );
    }
    if (current.version !== dto.version) {
      throw new ApiException(
        "VERSION_CONFLICT",
        409,
        "Transaction was modified elsewhere",
      );
    }

    const input = {
      amount: dto.amount !== undefined ? toDecimal(dto.amount) : current.amount,
      categoryId:
        dto.categoryId === undefined ? current.categoryId : dto.categoryId,
      accountId:
        dto.accountId === undefined ? current.accountId : dto.accountId,
      clientMutationId: current.clientMutationId,
      currency: dto.currency ?? current.currency,
      isUnlinkedRefund: dto.isUnlinkedRefund ?? current.isUnlinkedRefund,
      merchant:
        dto.merchant === undefined
          ? current.merchant
          : this.blankToNull(dto.merchant),
      note: dto.note === undefined ? current.note : this.blankToNull(dto.note),
      occurredAt: dto.occurredAt
        ? new Date(dto.occurredAt)
        : current.occurredAt,
      originalTransactionId:
        dto.originalTransactionId === undefined
          ? current.originalTransactionId
          : dto.originalTransactionId,
      source: dto.source ?? current.source,
      sourceFingerprint:
        dto.sourceFingerprint === undefined
          ? current.sourceFingerprint
          : dto.sourceFingerprint,
      tripId: dto.tripId === undefined ? current.tripId : dto.tripId,
      type: dto.type ?? current.type,
      userId,
    } satisfies NormalizedTransactionInput;

    await this.validateRefundRules(userId, input, this.prisma);
    await this.resolveCategory(
      userId,
      input.categoryId,
      input.type,
      this.prisma,
    );
    await this.resolveAccount(userId, input.accountId, this.prisma);
    await this.resolveTrip(userId, input.tripId, this.prisma);
    const duplicate = await this.findPossibleDuplicate(
      userId,
      input,
      this.prisma,
      id,
    );

    const updated = await this.prisma.transaction.updateMany({
      data: {
        accountId: input.accountId,
        amount: input.amount,
        categoryId: input.categoryId,
        currency: input.currency,
        isUnlinkedRefund: input.isUnlinkedRefund,
        merchant: input.merchant,
        note: input.note,
        occurredAt: input.occurredAt,
        originalTransactionId: input.originalTransactionId,
        source: input.source,
        sourceFingerprint: input.sourceFingerprint,
        tripId: input.tripId,
        type: input.type,
        version: { increment: 1 },
      },
      where: { id, userId, version: current.version, deletedAt: null },
    });
    if (updated.count === 0) {
      throw new ApiException(
        "VERSION_CONFLICT",
        409,
        "Transaction was modified elsewhere",
      );
    }
    const row = await this.prisma.transaction.findFirstOrThrow({
      where: { id, userId },
    });
    return this.withDuplicateWarning(row, duplicate);
  }

  async softDeleteTransaction(userId: string, id: string): Promise<void> {
    const result = await this.prisma.transaction.updateMany({
      data: { deletedAt: new Date(), version: { increment: 1 } },
      where: { id, userId, deletedAt: null },
    });
    if (result.count === 0) {
      throw new ApiException(
        "RESOURCE_NOT_FOUND",
        404,
        "Transaction not found",
      );
    }
  }

  async restoreTransaction(
    userId: string,
    id: string,
  ): Promise<TransactionSummary> {
    const result = await this.prisma.transaction.updateMany({
      data: { deletedAt: null, version: { increment: 1 } },
      where: { id, userId, deletedAt: { not: null } },
    });
    if (result.count === 0) {
      throw new ApiException(
        "RESOURCE_NOT_FOUND",
        404,
        "Deleted transaction not found",
      );
    }
    const row = await this.prisma.transaction.findFirstOrThrow({
      where: { id, userId },
    });
    return toTransactionSummary(row);
  }

  async listCategories(
    userId: string,
    query: ListCategoriesQueryDto,
  ): Promise<{ items: CategorySummary[] }> {
    const rows = await this.prisma.category.findMany({
      orderBy: [{ kind: "asc" }, { name: "asc" }],
      where: {
        userId,
        deletedAt: null,
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.includeArchived ? {} : { isArchived: false }),
      },
    });
    return { items: rows.map(toCategorySummary) };
  }

  async createCategory(
    userId: string,
    dto: CreateCategoryDto,
  ): Promise<CategorySummary> {
    const name = dto.name.trim();
    if (!name) {
      throw new ApiException(
        "VALIDATION_ERROR",
        400,
        "Category name is required",
      );
    }
    try {
      const row = await this.prisma.category.create({
        data: {
          color: dto.color ?? DEFAULT_COLOR,
          kind: dto.kind,
          name,
          userId,
        },
      });
      return toCategorySummary(row);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw this.duplicateResource("Category with this name already exists");
      }
      throw error;
    }
  }

  async updateCategory(
    userId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<CategorySummary> {
    const current = await this.prisma.category.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!current) {
      throw new ApiException("RESOURCE_NOT_FOUND", 404, "Category not found");
    }
    if (current.version !== dto.version) {
      throw new ApiException(
        "VERSION_CONFLICT",
        409,
        "Category was modified elsewhere",
      );
    }
    const name = dto.name === undefined ? current.name : dto.name.trim();
    const kind = dto.kind ?? current.kind;
    if (!name) {
      throw new ApiException(
        "VALIDATION_ERROR",
        400,
        "Category name is required",
      );
    }
    if (name !== current.name || kind !== current.kind) {
      const existing = await this.prisma.category.findFirst({
        where: { id: { not: id }, kind, name, userId, deletedAt: null },
      });
      if (existing) {
        throw this.duplicateResource("Category with this name already exists");
      }
    }
    try {
      const updated = await this.prisma.category.updateMany({
        data: {
          color: dto.color ?? current.color,
          isArchived: dto.isArchived ?? current.isArchived,
          kind,
          name,
          version: { increment: 1 },
        },
        where: { id, userId, version: current.version },
      });
      if (updated.count === 0) {
        throw new ApiException(
          "VERSION_CONFLICT",
          409,
          "Category was modified elsewhere",
        );
      }
      return toCategorySummary(
        await this.prisma.category.findFirstOrThrow({
          where: { id, userId },
        }),
      );
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw this.duplicateResource("Category with this name already exists");
      }
      throw error;
    }
  }

  async listFinancialAccounts(
    userId: string,
    query: ListFinancialAccountsQueryDto,
  ): Promise<{ items: FinancialAccountSummary[] }> {
    const rows = await this.prisma.financialAccount.findMany({
      orderBy: { name: "asc" },
      where: {
        userId,
        deletedAt: null,
        ...(query.includeArchived ? {} : { isArchived: false }),
      },
    });
    return { items: rows.map(toFinancialAccountSummary) };
  }

  async createFinancialAccount(
    userId: string,
    dto: CreateFinancialAccountDto,
  ): Promise<FinancialAccountSummary> {
    const name = dto.name.trim();
    if (!name) {
      throw new ApiException(
        "VALIDATION_ERROR",
        400,
        "Account name is required",
      );
    }
    try {
      const row = await this.prisma.financialAccount.create({
        data: { kind: dto.kind, name, userId },
      });
      return toFinancialAccountSummary(row);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw this.duplicateResource(
          "Financial account with this name already exists",
        );
      }
      throw error;
    }
  }

  async updateFinancialAccount(
    userId: string,
    id: string,
    dto: UpdateFinancialAccountDto,
  ): Promise<FinancialAccountSummary> {
    const current = await this.prisma.financialAccount.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!current) {
      throw new ApiException(
        "RESOURCE_NOT_FOUND",
        404,
        "Financial account not found",
      );
    }
    if (current.version !== dto.version) {
      throw new ApiException(
        "VERSION_CONFLICT",
        409,
        "Financial account was modified elsewhere",
      );
    }
    const name = dto.name === undefined ? current.name : dto.name.trim();
    const kind = dto.kind ?? current.kind;
    if (!name) {
      throw new ApiException(
        "VALIDATION_ERROR",
        400,
        "Account name is required",
      );
    }
    if (name !== current.name) {
      const existing = await this.prisma.financialAccount.findFirst({
        where: { id: { not: id }, name, userId, deletedAt: null },
      });
      if (existing) {
        throw this.duplicateResource(
          "Financial account with this name already exists",
        );
      }
    }
    try {
      const updated = await this.prisma.financialAccount.updateMany({
        data: {
          isArchived: dto.isArchived ?? current.isArchived,
          kind,
          name,
          version: { increment: 1 },
        },
        where: { id, userId, version: current.version },
      });
      if (updated.count === 0) {
        throw new ApiException(
          "VERSION_CONFLICT",
          409,
          "Financial account was modified elsewhere",
        );
      }
      return toFinancialAccountSummary(
        await this.prisma.financialAccount.findFirstOrThrow({
          where: { id, userId },
        }),
      );
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw this.duplicateResource(
          "Financial account with this name already exists",
        );
      }
      throw error;
    }
  }

  async listBudgets(
    userId: string,
    query: ListBudgetsQueryDto,
  ): Promise<{ items: BudgetSummary[] }> {
    const rows = await this.prisma.budget.findMany({
      include: { category: true },
      orderBy: [{ month: "asc" }, { categoryId: "asc" }],
      where: {
        userId,
        deletedAt: null,
        ...(query.month ? { month: query.month } : {}),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      },
    });
    return { items: rows.map(toBudgetSummary) };
  }

  async createBudget(
    userId: string,
    dto: CreateBudgetDto,
  ): Promise<BudgetSummary> {
    const month = dto.month;
    if (!isValidMonth(month)) {
      throw new ApiException(
        "VALIDATION_ERROR",
        400,
        "Month must be a valid YYYY-MM value",
      );
    }
    const amount = toDecimal(dto.amount);
    const categoryId = dto.categoryId ?? null;
    const currency = dto.currency ?? DEFAULT_CURRENCY;
    if (categoryId) {
      const category = await this.prisma.category.findFirst({
        where: {
          deletedAt: null,
          id: categoryId,
          isArchived: false,
          kind: "EXPENSE",
          userId,
        },
      });
      if (!category) {
        throw new ApiException(
          "RESOURCE_NOT_FOUND",
          404,
          "Expense category not found",
        );
      }
    }
    const existing = await this.prisma.budget.findFirst({
      where: { categoryId, deletedAt: null, month, userId },
    });
    if (existing) {
      throw this.duplicateResource("Budget for this month already exists");
    }
    try {
      const row = await this.prisma.budget.create({
        data: { amount, categoryId, currency, month, userId },
      });
      return toBudgetSummary(row);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw this.duplicateResource("Budget for this month already exists");
      }
      throw error;
    }
  }

  async updateBudget(
    userId: string,
    id: string,
    dto: UpdateBudgetDto,
  ): Promise<BudgetSummary> {
    const current = await this.prisma.budget.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!current) {
      throw new ApiException("RESOURCE_NOT_FOUND", 404, "Budget not found");
    }
    if (current.version !== dto.version) {
      throw new ApiException(
        "VERSION_CONFLICT",
        409,
        "Budget was modified elsewhere",
      );
    }
    const month = dto.month ?? current.month;
    if (!isValidMonth(month)) {
      throw new ApiException(
        "VALIDATION_ERROR",
        400,
        "Month must be a valid YYYY-MM value",
      );
    }
    const amount =
      dto.amount !== undefined ? toDecimal(dto.amount) : current.amount;
    const categoryId =
      dto.categoryId === undefined ? current.categoryId : dto.categoryId;
    const currency = dto.currency ?? current.currency;
    if (categoryId) {
      const category = await this.prisma.category.findFirst({
        where: {
          deletedAt: null,
          id: categoryId,
          isArchived: false,
          kind: "EXPENSE",
          userId,
        },
      });
      if (!category) {
        throw new ApiException(
          "RESOURCE_NOT_FOUND",
          404,
          "Expense category not found",
        );
      }
    }
    const existing = await this.prisma.budget.findFirst({
      where: {
        categoryId,
        deletedAt: null,
        id: { not: id },
        month,
        userId,
      },
    });
    if (existing) {
      throw this.duplicateResource("Budget for this month already exists");
    }
    try {
      const updated = await this.prisma.budget.updateMany({
        data: {
          amount,
          categoryId,
          currency,
          month,
          version: { increment: 1 },
        },
        where: { id, userId, version: current.version },
      });
      if (updated.count === 0) {
        throw new ApiException(
          "VERSION_CONFLICT",
          409,
          "Budget was modified elsewhere",
        );
      }
      return toBudgetSummary(
        await this.prisma.budget.findFirstOrThrow({
          include: { category: true },
          where: { id, userId },
        }),
      );
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw this.duplicateResource("Budget for this month already exists");
      }
      throw error;
    }
  }

  async softDeleteBudget(userId: string, id: string): Promise<void> {
    const result = await this.prisma.budget.updateMany({
      data: { deletedAt: new Date(), version: { increment: 1 } },
      where: { id, userId, deletedAt: null },
    });
    if (result.count === 0) {
      throw new ApiException("RESOURCE_NOT_FOUND", 404, "Budget not found");
    }
  }

  async getSummary(
    userId: string,
    query: SummaryQueryDto,
  ): Promise<FinanceSummaryResponse> {
    const month = query.month ?? currentMonth();
    if (!isValidMonth(month)) {
      throw new ApiException(
        "VALIDATION_ERROR",
        400,
        "Month must be a valid YYYY-MM value",
      );
    }
    const bounds = this.monthRange(month);
    const today = toZonedDay(new Date());
    const todayRange = dayBounds(today);

    const [
      totalExpense,
      totalRefund,
      totalIncome,
      todayExpense,
      todayRefund,
      budgets,
    ] = await Promise.all([
      this.sumByType(userId, "EXPENSE", bounds, DEFAULT_CURRENCY),
      this.sumByType(userId, "REFUND", bounds, DEFAULT_CURRENCY),
      this.sumByType(userId, "INCOME", bounds, DEFAULT_CURRENCY),
      this.sumByType(userId, "EXPENSE", todayRange, DEFAULT_CURRENCY),
      this.sumByType(userId, "REFUND", todayRange, DEFAULT_CURRENCY),
      this.prisma.budget.findMany({
        include: { category: true },
        orderBy: [{ categoryId: "asc" }, { createdAt: "asc" }],
        where: { deletedAt: null, month, userId },
      }),
    ]);

    const expense = totalExpense ?? zeroMoney();
    const refund = totalRefund ?? zeroMoney();
    const income = totalIncome ?? zeroMoney();
    const todaySpend = (todayExpense ?? zeroMoney()).minus(
      todayRefund ?? zeroMoney(),
    );
    const budgetProgress = await Promise.all(
      budgets.map((budget) => this.budgetProgress(userId, budget, bounds)),
    );

    return {
      budgets: budgetProgress,
      currency: DEFAULT_CURRENCY,
      month,
      netExpense: formatMoney(expense.minus(refund)),
      todaySpend: formatMoney(todaySpend),
      totalExpense: formatMoney(expense),
      totalIncome: formatMoney(income),
      totalRefund: formatMoney(refund),
      updatedAt: new Date().toISOString(),
    };
  }

  async exportCsv(
    userId: string,
    query: ExportCsvQueryDto,
  ): Promise<{ content: string; filename: string }> {
    const where: Prisma.TransactionWhereInput = {
      deletedAt: null,
      status: "CONFIRMED",
      userId,
      ...(query.month
        ? (() => {
            const bounds = this.monthRange(query.month);
            return { occurredAt: { gte: bounds.start, lt: bounds.end } };
          })()
        : {}),
      ...(query.type ? { type: query.type } : {}),
    };
    const rows = await this.prisma.transaction.findMany({
      include: { account: true, category: true },
      orderBy: { occurredAt: "desc" },
      take: CSV_MAX_ROWS,
      where,
    });
    const header = [
      "id",
      "occurredAt",
      "type",
      "status",
      "amount",
      "currency",
      "categoryId",
      "categoryName",
      "accountId",
      "accountName",
      "merchant",
      "note",
      "source",
      "originalTransactionId",
      "isUnlinkedRefund",
      "tripId",
      "createdAt",
      "updatedAt",
      "version",
    ];
    const lines = rows.map((row) =>
      [
        row.id,
        row.occurredAt.toISOString(),
        row.type,
        row.status,
        formatMoney(row.amount),
        row.currency,
        row.categoryId ?? "",
        row.category?.name ?? "",
        row.accountId ?? "",
        row.account?.name ?? "",
        row.merchant ?? "",
        row.note ?? "",
        row.source,
        row.originalTransactionId ?? "",
        row.isUnlinkedRefund ? "true" : "false",
        row.tripId ?? "",
        row.createdAt.toISOString(),
        row.updatedAt.toISOString(),
        String(row.version),
      ]
        .map(csvEscape)
        .join(","),
    );
    const content =
      "\uFEFF" + [header.map(csvEscape).join(","), ...lines].join("\r\n");
    const filename = query.month
      ? `daily-assistant-transactions-${query.month}.csv`
      : "daily-assistant-transactions-all.csv";
    return { content, filename };
  }

  private async budgetProgress(
    userId: string,
    budget: Budget & { category?: { name: string } | null },
    bounds: { start: Date; end: Date },
  ): Promise<BudgetProgress> {
    const [expense, refund] = await Promise.all([
      this.sumByType(
        userId,
        "EXPENSE",
        bounds,
        budget.currency,
        budget.categoryId ?? undefined,
      ),
      this.sumByType(
        userId,
        "REFUND",
        bounds,
        budget.currency,
        budget.categoryId ?? undefined,
      ),
    ]);
    const spent = (expense ?? zeroMoney()).minus(refund ?? zeroMoney());
    const remaining = budget.amount.minus(spent);
    const progress = budget.amount.gt(0)
      ? spent.div(budget.amount).toFixed(2)
      : "0.00";
    return {
      amount: formatMoney(budget.amount),
      budgetId: budget.id,
      categoryId: budget.categoryId,
      categoryName: budget.category?.name ?? null,
      progress,
      remaining: formatMoney(remaining),
      spent: formatMoney(spent),
    };
  }

  private async sumByType(
    userId: string,
    type: TransactionTypeValue,
    range: { start: Date; end: Date },
    currency: string,
    categoryId?: string | null,
  ): Promise<Prisma.Decimal | null> {
    const result = await this.prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        categoryId: categoryId === undefined ? undefined : (categoryId ?? null),
        currency,
        deletedAt: null,
        occurredAt: { gte: range.start, lt: range.end },
        status: "CONFIRMED",
        type,
        userId,
      },
    });
    return result._sum.amount;
  }

  private monthRange(month: string): { start: Date; end: Date } {
    return monthBounds(month);
  }

  private normalizeCreateInput(
    userId: string,
    dto: CreateTransactionDto,
  ): NormalizedTransactionInput {
    return {
      accountId: dto.accountId ?? null,
      amount: toDecimal(dto.amount),
      categoryId: dto.categoryId ?? null,
      clientMutationId: dto.clientMutationId ?? null,
      currency: dto.currency ?? DEFAULT_CURRENCY,
      isUnlinkedRefund: dto.isUnlinkedRefund ?? false,
      merchant: this.blankToNull(dto.merchant),
      note: this.blankToNull(dto.note),
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date(),
      originalTransactionId: dto.originalTransactionId ?? null,
      source: dto.source ?? "MANUAL",
      sourceFingerprint: dto.sourceFingerprint ?? null,
      tripId: dto.tripId ?? null,
      type: dto.type,
      userId,
    };
  }

  private async validateRefundRules(
    userId: string,
    input: {
      isUnlinkedRefund: boolean;
      originalTransactionId: string | null;
      type: TransactionTypeValue;
    },
    db: Prisma.TransactionClient | PrismaClient,
  ): Promise<void> {
    if (input.type !== "REFUND") {
      if (input.originalTransactionId) {
        throw new ApiException(
          "INVALID_STATE",
          400,
          "Only refunds can reference an original transaction",
        );
      }
      if (input.isUnlinkedRefund) {
        throw new ApiException(
          "INVALID_STATE",
          400,
          "isUnlinkedRefund is only valid for refunds",
        );
      }
      return;
    }
    if (input.originalTransactionId && input.isUnlinkedRefund) {
      throw new ApiException(
        "INVALID_STATE",
        400,
        "A refund cannot both reference an original transaction and be unlinked",
      );
    }
    if (!input.originalTransactionId && !input.isUnlinkedRefund) {
      throw new ApiException(
        "INVALID_STATE",
        400,
        "A refund must reference an original transaction or be marked as unlinked",
      );
    }
    if (input.originalTransactionId) {
      const original = await db.transaction.findFirst({
        where: {
          deletedAt: null,
          id: input.originalTransactionId,
          status: "CONFIRMED",
          type: "EXPENSE",
          userId,
        },
      });
      if (!original) {
        throw new ApiException(
          "INVALID_STATE",
          400,
          "Refund must reference an existing confirmed expense owned by the user",
        );
      }
    }
  }

  private async resolveCategory(
    userId: string,
    categoryId: string | null,
    type: TransactionTypeValue,
    db: Prisma.TransactionClient | PrismaClient,
  ): Promise<void> {
    if (!categoryId) {
      return;
    }
    const category = await db.category.findFirst({
      where: {
        deletedAt: null,
        id: categoryId,
        isArchived: false,
        userId,
      },
    });
    if (!category) {
      throw new ApiException("RESOURCE_NOT_FOUND", 404, "Category not found");
    }
    const expectedKind = type === "INCOME" ? "INCOME" : "EXPENSE";
    if (category.kind !== expectedKind) {
      throw new ApiException(
        "INVALID_STATE",
        400,
        `Category kind must be ${expectedKind} for this transaction type`,
      );
    }
  }

  private async resolveAccount(
    userId: string,
    accountId: string | null,
    db: Prisma.TransactionClient | PrismaClient,
  ): Promise<void> {
    if (!accountId) {
      return;
    }
    const account = await db.financialAccount.findFirst({
      where: {
        deletedAt: null,
        id: accountId,
        isArchived: false,
        userId,
      },
    });
    if (!account) {
      throw new ApiException(
        "RESOURCE_NOT_FOUND",
        404,
        "Financial account not found",
      );
    }
  }

  private async resolveTrip(
    userId: string,
    tripId: string | null,
    db: Prisma.TransactionClient | PrismaClient,
  ): Promise<void> {
    if (!tripId) {
      return;
    }
    const trip = await db.trip.findFirst({
      where: { deletedAt: null, id: tripId, userId },
    });
    if (!trip) {
      throw new ApiException("RESOURCE_NOT_FOUND", 404, "Trip not found");
    }
  }

  private async findPossibleDuplicate(
    userId: string,
    input: {
      amount: Prisma.Decimal;
      currency: string;
      merchant: string | null;
      occurredAt: Date;
      sourceFingerprint: string | null;
    },
    db: Prisma.TransactionClient | PrismaClient,
    excludeId?: string,
  ): Promise<Transaction | null> {
    const or: Prisma.TransactionWhereInput[] = [];
    if (input.merchant) {
      or.push({ merchant: input.merchant });
    }
    if (input.sourceFingerprint) {
      or.push({ sourceFingerprint: input.sourceFingerprint });
    }
    if (or.length === 0) {
      return null;
    }
    return db.transaction.findFirst({
      orderBy: { occurredAt: "desc" },
      where: {
        amount: input.amount,
        currency: input.currency,
        deletedAt: null,
        id: excludeId ? { not: excludeId } : undefined,
        occurredAt: {
          gte: new Date(input.occurredAt.getTime() - DUPLICATE_WINDOW_MS),
          lte: new Date(input.occurredAt.getTime() + DUPLICATE_WINDOW_MS),
        },
        OR: or,
        status: "CONFIRMED",
        userId,
      },
    });
  }

  private async findByIdempotencyKey(
    userId: string,
    clientMutationId: string,
    db: Prisma.TransactionClient | PrismaClient,
  ): Promise<Transaction | null> {
    return db.transaction.findFirst({
      where: { clientMutationId, userId },
    });
  }

  private assertSameMutation(
    existing: Transaction,
    input: NormalizedTransactionInput,
  ): void {
    const same =
      existing.type === input.type &&
      existing.amount.equals(input.amount) &&
      existing.currency === input.currency &&
      (existing.categoryId ?? null) === (input.categoryId ?? null) &&
      (existing.accountId ?? null) === (input.accountId ?? null) &&
      (existing.merchant ?? null) === (input.merchant ?? null) &&
      existing.occurredAt.getTime() === input.occurredAt.getTime() &&
      (existing.note ?? null) === (input.note ?? null) &&
      existing.source === input.source &&
      (existing.originalTransactionId ?? null) ===
        (input.originalTransactionId ?? null) &&
      existing.isUnlinkedRefund === input.isUnlinkedRefund &&
      (existing.sourceFingerprint ?? null) ===
        (input.sourceFingerprint ?? null) &&
      (existing.tripId ?? null) === (input.tripId ?? null);
    if (!same) {
      throw new ApiException(
        "IDEMPOTENCY_CONFLICT",
        409,
        "clientMutationId was already used with different content",
      );
    }
  }

  private withDuplicateWarning(
    row: Transaction,
    duplicate: Transaction | null,
  ): TransactionCreatedResponse {
    const response: TransactionCreatedResponse = {
      transaction: toTransactionSummary(row),
    };
    if (duplicate) {
      const warning: DuplicateWarning = {
        code: "POSSIBLE_DUPLICATE",
        matchedTransactionId: duplicate.id,
        message:
          "10 分钟内已存在金额相同且商户或来源指纹相同的账单，疑似重复，请核对。",
      };
      response.duplicateWarning = warning;
    }
    return response;
  }

  private duplicateResource(message: string): ApiException {
    return new ApiException("DUPLICATE_RESOURCE", 409, message);
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }

  private blankToNull(value: string | null | undefined): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}

interface NormalizedTransactionInput {
  accountId: string | null;
  amount: Prisma.Decimal;
  categoryId: string | null;
  clientMutationId: string | null;
  currency: string;
  isUnlinkedRefund: boolean;
  merchant: string | null;
  note: string | null;
  occurredAt: Date;
  originalTransactionId: string | null;
  source: RecordSourceValue;
  sourceFingerprint: string | null;
  tripId: string | null;
  type: TransactionTypeValue;
  userId: string;
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
