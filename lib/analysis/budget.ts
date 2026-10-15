// Pure module: no "server-only", no "@/" alias, no database, no framework. All times are epoch milliseconds.
// Every message is fixed text plus, for the cooldown, one number. No user text ever reaches a message.

export const ANALYSIS_BUDGET = { cooldownSeconds: 30, perHour: 30, perDay: 150 } as const;

export type BudgetLimits = { cooldownSeconds: number; perHour: number; perDay: number };

export type BudgetSnapshot = {
  now: number;
  runsLastHour: number;
  runsLastDay: number;
  lastRunForReportAt: number | null;
};

export type BudgetDecision =
  | { allowed: true }
  | { allowed: false; reason: "cooldown" | "hourly" | "daily"; retryAfterSeconds: number | null; message: string };

// Check order: daily, then hourly, then cooldown.
export function evaluateBudget(snapshot: BudgetSnapshot, limits: BudgetLimits = ANALYSIS_BUDGET): BudgetDecision {
  if (snapshot.runsLastDay >= limits.perDay) {
    return {
      allowed: false,
      reason: "daily",
      retryAfterSeconds: null,
      message: "The daily analysis limit has been reached. Please try again tomorrow.",
    };
  }
  if (snapshot.runsLastHour >= limits.perHour) {
    return {
      allowed: false,
      reason: "hourly",
      retryAfterSeconds: null,
      message: "The hourly analysis limit has been reached. Please try again later.",
    };
  }
  if (snapshot.lastRunForReportAt !== null) {
    const cooldownMs = limits.cooldownSeconds * 1000;
    const elapsedMs = snapshot.now - snapshot.lastRunForReportAt;
    if (elapsedMs < cooldownMs) {
      const seconds = Math.max(1, Math.ceil((cooldownMs - elapsedMs) / 1000));
      return {
        allowed: false,
        reason: "cooldown",
        retryAfterSeconds: seconds,
        message: `Please wait ${seconds} ${seconds === 1 ? "second" : "seconds"} before analyzing this report again.`,
      };
    }
  }
  return { allowed: true };
}
