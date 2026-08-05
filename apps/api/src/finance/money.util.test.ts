import { describe, expect, it } from "vitest";

import { formatMoney, toDecimal, zeroMoney } from "./money.util.js";

describe("money util", () => {
  it("QA-FIN-001: sums fixed-point decimals without float drift", () => {
    const sum = toDecimal("0.10").plus(toDecimal("0.20"));
    expect(sum.toFixed(2)).toBe("0.30");
    expect(formatMoney(sum)).toBe("0.30");
  });

  it("accumulates many small amounts exactly", () => {
    const total = [0.1, 0.2, 0.05, 1.15, 9.99, 88.5].reduce(
      (acc, value) => acc.plus(toDecimal(value.toFixed(2))),
      zeroMoney(),
    );
    expect(formatMoney(total)).toBe("99.99");
  });

  it("rejects zero, negative, or malformed amounts", () => {
    for (const bad of ["0.00", "-1.00", "0.1", "1.234", "abc", ""]) {
      expect(() => toDecimal(bad)).toThrow();
    }
  });

  it("formats missing sums as 0.00", () => {
    expect(formatMoney(null)).toBe("0.00");
    expect(formatMoney(undefined)).toBe("0.00");
    expect(formatMoney(zeroMoney())).toBe("0.00");
  });
});
