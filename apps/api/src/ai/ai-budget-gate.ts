export type AiBudgetDecision = "ALLOW" | "BUDGET_BLOCKED";

export interface AiBudgetGate {
  evaluate(): AiBudgetDecision | Promise<AiBudgetDecision>;
}

/** PR19 intentionally has no accounting. Fake execution is allowed by default. */
export class AllowFakeAiBudgetGate implements AiBudgetGate {
  evaluate(): AiBudgetDecision {
    return "ALLOW";
  }
}
