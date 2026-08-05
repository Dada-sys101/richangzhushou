import { describe, expect, it } from "vitest";

import { ApiException } from "../common/api-error.js";
import { parseTransactionText } from "./rule-parser.js";

describe("transaction text rule parser", () => {
  it("parses amount, merchant, and type from natural text", () => {
    const parsed = parseTransactionText(
      "今天 14:30 星巴克 38.50",
      new Date("2026-08-05T04:00:00.000Z"),
    );
    expect(parsed.amount).toBe("38.50");
    expect(parsed.merchant).toBe("星巴克");
    expect(parsed.type).toBe("EXPENSE");
    expect(parsed.currency).toBe("CNY");
    expect(parsed.occurredAt).toBe("2026-08-05T06:30:00.000Z");
  });

  it("normalizes integer and single-decimal amounts", () => {
    expect(
      parseTransactionText("打车 25", new Date("2026-08-05T04:00:00.000Z"))
        .amount,
    ).toBe("25.00");
    expect(
      parseTransactionText("超市 12.5 元", new Date("2026-08-05T04:00:00.000Z"))
        .amount,
    ).toBe("12.50");
    expect(
      parseTransactionText("1,234.5 元", new Date("2026-08-05T04:00:00.000Z"))
        .amount,
    ).toBe("1234.50");
  });

  it("detects income and refund types", () => {
    expect(parseTransactionText("收到工资 8000.00", new Date()).type).toBe(
      "INCOME",
    );
    expect(parseTransactionText("退款 20.00", new Date()).type).toBe("REFUND");
  });

  it("uses yesterday when stated and ignores date-like numbers as amounts", () => {
    const parsed = parseTransactionText(
      "昨天 2026-08-04 餐厅 66.00",
      new Date("2026-08-05T04:00:00.000Z"),
    );
    expect(parsed.amount).toBe("66.00");
    expect(parsed.merchant).toBe("餐厅");
    expect(parsed.occurredAt).toBe("2026-08-03T16:00:00.000Z");
  });

  it("throws a structured validation error without an amount", () => {
    expect(() =>
      parseTransactionText("今天买了一些东西", new Date()),
    ).toThrowError(ApiException);
  });
});
