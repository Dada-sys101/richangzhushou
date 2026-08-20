export type AiBreakerSample = "SUCCESS" | "TECHNICAL_FAILURE" | "NON_TECHNICAL";

export interface AiBreakerPermit {
  readonly generation: number;
  readonly kind: "NORMAL" | "PROBE";
}

export type AiBreakerAcquireResult =
  { allowed: true; permit: AiBreakerPermit } | { allowed: false };

export interface AiCircuitBreakerSnapshot {
  sampleCount: number;
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  technicalCount: number;
}

const WINDOW_SIZE = 20;
const TECHNICAL_COUNT_THRESHOLD = 5;
const TECHNICAL_RATE_THRESHOLD = 0.5;
const OPEN_INTERVAL_MS = 60_000;

/**
 * Process-local deterministic PR19 breaker. A generation fences late logical
 * request completions after OPEN/HALF_OPEN state changes.
 */
export class AiCircuitBreaker {
  private generation = 0;
  private openedAtMs: number | null = null;
  private probeInFlight = false;
  private samples: AiBreakerSample[] = [];
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";

  acquire(now: Date): AiBreakerAcquireResult {
    if (this.state === "CLOSED") {
      return {
        allowed: true,
        permit: { generation: this.generation, kind: "NORMAL" },
      };
    }

    if (this.state === "OPEN") {
      const openedAtMs = this.openedAtMs ?? now.getTime();
      if (now.getTime() - openedAtMs < OPEN_INTERVAL_MS) {
        return { allowed: false };
      }
      this.state = "HALF_OPEN";
    }

    if (this.probeInFlight) {
      return { allowed: false };
    }
    this.probeInFlight = true;
    return {
      allowed: true,
      permit: { generation: this.generation, kind: "PROBE" },
    };
  }

  record(permit: AiBreakerPermit, sample: AiBreakerSample, now: Date): void {
    if (permit.generation !== this.generation) {
      return;
    }

    if (permit.kind === "PROBE") {
      if (this.state !== "HALF_OPEN" || !this.probeInFlight) {
        return;
      }
      this.probeInFlight = false;
      if (sample === "TECHNICAL_FAILURE") {
        this.open(now);
      } else {
        this.closeAndClear();
      }
      return;
    }

    if (this.state !== "CLOSED") {
      return;
    }
    this.samples.push(sample);
    if (this.samples.length > WINDOW_SIZE) {
      this.samples.shift();
    }
    const technicalCount = this.samples.filter(
      (value) => value === "TECHNICAL_FAILURE",
    ).length;
    if (
      technicalCount >= TECHNICAL_COUNT_THRESHOLD &&
      technicalCount / this.samples.length >= TECHNICAL_RATE_THRESHOLD
    ) {
      this.open(now);
    }
  }

  /** Releases a probe when the request loses its pre-adapter DB transition. */
  abandon(permit: AiBreakerPermit, now: Date): void {
    if (
      permit.kind === "PROBE" &&
      permit.generation === this.generation &&
      this.state === "HALF_OPEN" &&
      this.probeInFlight
    ) {
      this.open(now);
    }
  }

  snapshot(): AiCircuitBreakerSnapshot {
    return {
      sampleCount: this.samples.length,
      state: this.state,
      technicalCount: this.samples.filter(
        (value) => value === "TECHNICAL_FAILURE",
      ).length,
    };
  }

  private open(now: Date): void {
    this.generation += 1;
    this.openedAtMs = now.getTime();
    this.probeInFlight = false;
    this.state = "OPEN";
  }

  private closeAndClear(): void {
    this.generation += 1;
    this.openedAtMs = null;
    this.probeInFlight = false;
    this.samples = [];
    this.state = "CLOSED";
  }
}
