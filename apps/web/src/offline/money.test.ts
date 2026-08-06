import { describe, expect, it } from "vitest";

import { centsOf, moneyOf, sumMoney } from "./money";

describe("offline money helpers", () => {
  it("converts fixed-point strings without floating-point drift", () => {
    expect(centsOf("0.10")).toBe(10n);
    expect(centsOf("12.30")).toBe(1230n);
    expect(centsOf("-0.25")).toBe(-25n);
    expect(moneyOf(centsOf("0.10") + centsOf("0.20"))).toBe("0.30");
    expect(sumMoney(["1.00", "2.50", "-0.25"])).toBe("3.25");
  });
});
