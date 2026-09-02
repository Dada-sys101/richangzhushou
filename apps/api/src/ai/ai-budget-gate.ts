export type AiBudgetDecision = "ALLOW" | "BUDGET_BLOCKED";

export interface AiBudgetGate {
  evaluate(): AiBudgetDecision | Promise<AiBudgetDecision>;
}

/**
 * Temporary ADR-029 policy: usage metadata is retained for later Asia/Shanghai
 * calendar-month accounting, but no monetary ceiling is configured yet.
 */
export class AllowFakeAiBudgetGate implements AiBudgetGate {
  evaluate(): AiBudgetDecision {
    return "ALLOW";
  }
}
