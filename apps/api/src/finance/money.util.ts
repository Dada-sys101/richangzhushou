import { Prisma } from "../generated/prisma/client.js";
import { ApiException } from "../common/api-error.js";

export const MONEY_PATTERN = /^\d+\.\d{2}$/;

export function toDecimal(value: string): Prisma.Decimal {
  if (!MONEY_PATTERN.test(value)) {
    throw new ApiException(
      "VALIDATION_ERROR",
      400,
      "Amount must be a positive fixed-point string with two decimals",
      [{ field: "amount", message: "请输入两位小数的正金额" }],
    );
  }
  const decimal = new Prisma.Decimal(value);
  if (decimal.lte(0)) {
    throw new ApiException(
      "VALIDATION_ERROR",
      400,
      "Amount must be greater than zero",
      [{ field: "amount", message: "金额必须大于 0" }],
    );
  }
  return decimal;
}

export function formatMoney(
  value: { toFixed(digits: number): string } | null | undefined,
): string {
  return value?.toFixed(2) ?? "0.00";
}

export function zeroMoney(): Prisma.Decimal {
  return new Prisma.Decimal("0.00");
}
