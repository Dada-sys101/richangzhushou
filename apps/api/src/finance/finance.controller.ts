import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";

import { AccessTokenGuard } from "../auth/access-token.guard.js";
import type { AuthenticatedRequest } from "../auth/auth.types.js";
import { UserOnlyGuard } from "../auth/user-only.guard.js";
import { FinanceService } from "./finance.service.js";
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

@Controller()
@UseGuards(AccessTokenGuard, UserOnlyGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get("transactions")
  listTransactions(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListTransactionsQueryDto,
  ) {
    return this.financeService.listTransactions(this.userId(request), query);
  }

  @Post("transactions")
  @HttpCode(HttpStatus.CREATED)
  createTransaction(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.financeService.createTransaction(this.userId(request), dto);
  }

  @Get("transactions/:id")
  getTransaction(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
  ) {
    return this.financeService.getTransaction(this.userId(request), id);
  }

  @Patch("transactions/:id")
  updateTransaction(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.financeService.updateTransaction(this.userId(request), id, dto);
  }

  @Delete("transactions/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTransaction(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
  ): Promise<void> {
    await this.financeService.softDeleteTransaction(this.userId(request), id);
  }

  @Post("transactions/:id/restore")
  @HttpCode(HttpStatus.OK)
  restoreTransaction(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
  ) {
    return this.financeService.restoreTransaction(this.userId(request), id);
  }

  @Get("categories")
  listCategories(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListCategoriesQueryDto,
  ) {
    return this.financeService.listCategories(this.userId(request), query);
  }

  @Post("categories")
  @HttpCode(HttpStatus.CREATED)
  createCategory(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.financeService.createCategory(this.userId(request), dto);
  }

  @Patch("categories/:id")
  updateCategory(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.financeService.updateCategory(this.userId(request), id, dto);
  }

  @Get("financial-accounts")
  listFinancialAccounts(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListFinancialAccountsQueryDto,
  ) {
    return this.financeService.listFinancialAccounts(
      this.userId(request),
      query,
    );
  }

  @Post("financial-accounts")
  @HttpCode(HttpStatus.CREATED)
  createFinancialAccount(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateFinancialAccountDto,
  ) {
    return this.financeService.createFinancialAccount(
      this.userId(request),
      dto,
    );
  }

  @Patch("financial-accounts/:id")
  updateFinancialAccount(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: UpdateFinancialAccountDto,
  ) {
    return this.financeService.updateFinancialAccount(
      this.userId(request),
      id,
      dto,
    );
  }

  @Get("budgets")
  listBudgets(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListBudgetsQueryDto,
  ) {
    return this.financeService.listBudgets(this.userId(request), query);
  }

  @Post("budgets")
  @HttpCode(HttpStatus.CREATED)
  createBudget(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateBudgetDto,
  ) {
    return this.financeService.createBudget(this.userId(request), dto);
  }

  @Patch("budgets/:id")
  updateBudget(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() dto: UpdateBudgetDto,
  ) {
    return this.financeService.updateBudget(this.userId(request), id, dto);
  }

  @Delete("budgets/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBudget(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
  ): Promise<void> {
    await this.financeService.softDeleteBudget(this.userId(request), id);
  }

  @Get("finance/summary")
  getSummary(
    @Req() request: AuthenticatedRequest,
    @Query() query: SummaryQueryDto,
  ) {
    return this.financeService.getSummary(this.userId(request), query);
  }

  @Get("finance/export.csv")
  async exportCsv(
    @Req() request: AuthenticatedRequest,
    @Query() query: ExportCsvQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.financeService.exportCsv(
      this.userId(request),
      query,
    );
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.filename}"`,
    );
    return result.content;
  }

  private userId(request: AuthenticatedRequest): string {
    if (!request.user) {
      throw new Error("Authenticated request is missing user");
    }
    return request.user.userId;
  }
}
