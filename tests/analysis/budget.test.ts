import { describe, expect, it } from "vitest";
import { ANALYSIS_BUDGET, evaluateBudget, type BudgetSnapshot } from "../../lib/analysis/budget";

const NOW = 1_800_000_000_000;

function snap(overrides: Partial<BudgetSnapshot> = {}): BudgetSnapshot {
  return { now: NOW, runsLastHour: 0, runsLastDay: 0, lastRunForReportAt: null, ...overrides };
}

describe("evaluateBudget", () => {
  it("has the documented default limits", () => {
    expect(ANALYSIS_BUDGET).toEqual({ cooldownSeconds: 30, perHour: 30, perDay: 150 });
  });

  it("allows an empty snapshot", () => {
    expect(evaluateBudget(snap())).toEqual({ allowed: true });
  });

  it("allows just below each limit and blocks exactly at it", () => {
    expect(evaluateBudget(snap({ runsLastDay: 149 }))).toEqual({ allowed: true });
    expect(evaluateBudget(snap({ runsLastDay: 150 }))).toMatchObject({ allowed: false, reason: "daily" });
    expect(evaluateBudget(snap({ runsLastHour: 29 }))).toEqual({ allowed: true });
    expect(evaluateBudget(snap({ runsLastHour: 30 }))).toMatchObject({ allowed: false, reason: "hourly" });
  });

  it("checks daily before hourly before cooldown", () => {
    const all = snap({ runsLastDay: 500, runsLastHour: 500, lastRunForReportAt: NOW - 1000 });
    expect(evaluateBudget(all)).toMatchObject({ reason: "daily" });
    expect(evaluateBudget({ ...all, runsLastDay: 10 })).toMatchObject({ reason: "hourly" });
    expect(evaluateBudget({ ...all, runsLastDay: 10, runsLastHour: 1 })).toMatchObject({ reason: "cooldown" });
  });

  it("allows exactly cooldownSeconds elapsed and blocks one millisecond less", () => {
    expect(evaluateBudget(snap({ lastRunForReportAt: NOW - 30_000 }))).toEqual({ allowed: true });
    const blocked = evaluateBudget(snap({ lastRunForReportAt: NOW - 29_999 }));
    expect(blocked).toMatchObject({ allowed: false, reason: "cooldown", retryAfterSeconds: 1 });
  });

  it("rounds the wait up and never reports less than 1 second", () => {
    const wait = (elapsedMs: number) => {
      const d = evaluateBudget(snap({ lastRunForReportAt: NOW - elapsedMs }));
      return d.allowed ? null : d.retryAfterSeconds;
    };
    expect(wait(0)).toBe(30);
    expect(wait(1)).toBe(30);
    expect(wait(500)).toBe(30);
    expect(wait(1000)).toBe(29);
    expect(wait(1001)).toBe(29);
    expect(wait(29_000)).toBe(1);
    expect(wait(29_999)).toBe(1);
  });

  it("treats a last run in the future as a full cooldown", () => {
    expect(evaluateBudget(snap({ lastRunForReportAt: NOW + 5000 }))).toMatchObject({ reason: "cooldown" });
  });

  it("applies no cooldown when the report has no previous run", () => {
    expect(evaluateBudget(snap({ lastRunForReportAt: null, runsLastHour: 29 }))).toEqual({ allowed: true });
  });

  it("uses custom limits", () => {
    const limits = { cooldownSeconds: 5, perHour: 2, perDay: 3 };
    expect(evaluateBudget(snap({ runsLastHour: 2 }), limits)).toMatchObject({ reason: "hourly" });
    expect(evaluateBudget(snap({ runsLastDay: 3 }), limits)).toMatchObject({ reason: "daily" });
    expect(evaluateBudget(snap({ lastRunForReportAt: NOW - 4000 }), limits)).toMatchObject({
      reason: "cooldown",
      retryAfterSeconds: 1,
    });
    expect(evaluateBudget(snap({ lastRunForReportAt: NOW - 5000 }), limits)).toEqual({ allowed: true });
  });

  it("does not mutate its input", () => {
    const input = Object.freeze(snap({ runsLastDay: 1, runsLastHour: 1, lastRunForReportAt: NOW - 1000 }));
    const copy = { ...input };
    evaluateBudget(input);
    expect(input).toEqual(copy);
  });

  it("returns only fixed text, plus a number for the cooldown", () => {
    const daily = evaluateBudget(snap({ runsLastDay: 150 }));
    const hourly = evaluateBudget(snap({ runsLastHour: 30 }));
    const cooldown = evaluateBudget(snap({ lastRunForReportAt: NOW - 1000 }));
    expect(daily).toEqual({
      allowed: false,
      reason: "daily",
      retryAfterSeconds: null,
      message: "The daily analysis limit has been reached. Please try again tomorrow.",
    });
    expect(hourly).toEqual({
      allowed: false,
      reason: "hourly",
      retryAfterSeconds: null,
      message: "The hourly analysis limit has been reached. Please try again later.",
    });
    expect(cooldown).toMatchObject({ allowed: false, reason: "cooldown" });
    if (!cooldown.allowed) {
      expect(cooldown.message).toMatch(/^Please wait \d+ seconds before analyzing this report again\.$/);
    }
  });
});
