import type {
  EquipmentType,
  Priority,
  ThresholdStatus,
} from "@/generated/prisma/enums";
import {
  CONFLICT_WINDOW_MINUTES,
  getRule,
  getRules,
  type SensorRule,
} from "./rules";

export type SensorReadingInput = {
  sensor: string;
  value: number;
  unit: string;
  recordedAt: Date | null;
  source: string | null;
};

export type ThresholdEvaluation = {
  sensor: string;
  status: ThresholdStatus;
  ruleId: string;
  observedValue: number | null;
  unit: string;
  message: string;
  // Only set for CONFLICTING: the readings that disagree.
  readings: SensorReadingInput[] | null;
  // Only true for CONFLICTING when any single disagreeing value is CRITICAL.
  anyReadingCritical: boolean;
};

export class ThresholdInputError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`Invalid threshold input: ${problems.join("; ")}`);
    this.name = "ThresholdInputError";
    this.problems = problems;
  }
}

// Absorbs floating-point noise such as 0.3 - 0.1 ending up above 0.2.
const EPSILON = 1e-9;
const WINDOW_MS = CONFLICT_WINDOW_MINUTES * 60_000;

type Severity = "OK" | "WARNING" | "CRITICAL";

function classify(rule: SensorRule, value: number): Severity {
  if (rule.direction === "high") {
    if (value >= rule.critical) return "CRITICAL";
    if (value >= rule.warning) return "WARNING";
    return "OK";
  }
  if (value <= rule.critical) return "CRITICAL";
  if (value <= rule.warning) return "WARNING";
  return "OK";
}

const RANK: Record<Severity, number> = { OK: 0, WARNING: 1, CRITICAL: 2 };

function describe(r: SensorReadingInput): string {
  return `${r.value} ${r.unit} (${r.source ?? "unknown source"})`;
}

function validate(
  equipmentType: EquipmentType,
  readings: SensorReadingInput[],
): void {
  const problems: string[] = [];
  for (const r of readings) {
    const rule = getRule(equipmentType, r.sensor);
    if (!rule) {
      problems.push(`unknown sensor "${r.sensor}" for ${equipmentType}`);
      continue;
    }
    if (r.unit !== rule.unit) {
      problems.push(
        `unit mismatch for ${r.sensor}: got "${r.unit}", expected "${rule.unit}"`,
      );
    }
    if (!Number.isFinite(r.value)) {
      problems.push(`non-finite value for ${r.sensor}: ${String(r.value)}`);
    }
    if (r.recordedAt !== null && Number.isNaN(r.recordedAt.getTime())) {
      problems.push(`invalid timestamp for ${r.sensor}`);
    }
  }
  if (problems.length > 0) throw new ThresholdInputError(problems);
}

function comparisonSet(readings: SensorReadingInput[]): SensorReadingInput[] {
  const stamped = readings.filter((r) => r.recordedAt !== null);
  if (stamped.length === 0) return readings;
  const latest = Math.max(...stamped.map((r) => r.recordedAt!.getTime()));
  return readings.filter(
    (r) =>
      r.recordedAt === null || latest - r.recordedAt.getTime() <= WINDOW_MS,
  );
}

export function evaluateThresholds(
  equipmentType: EquipmentType,
  readings: SensorReadingInput[],
): ThresholdEvaluation[] {
  validate(equipmentType, readings);

  const results: ThresholdEvaluation[] = [];
  for (const rule of getRules(equipmentType)) {
    const ruleId = `${equipmentType}.${rule.sensor}`;
    const base = { sensor: rule.sensor, ruleId, unit: rule.unit };
    const own = readings.filter((r) => r.sensor === rule.sensor);

    if (own.length === 0) {
      if (rule.expected) {
        results.push({
          ...base,
          status: "MISSING",
          observedValue: null,
          message: `No ${rule.sensor} reading provided`,
          readings: null,
          anyReadingCritical: false,
        });
      }
      continue;
    }

    const set = comparisonSet(own);
    const values = set.map((r) => r.value);
    const spread = Math.max(...values) - Math.min(...values);

    if (spread > rule.conflictTolerance + EPSILON) {
      results.push({
        ...base,
        status: "CONFLICTING",
        observedValue: null,
        message: `Conflicting ${rule.sensor} readings: ${set.map(describe).join(", ")}`,
        readings: set,
        anyReadingCritical: values.some(
          (v) => classify(rule, v) === "CRITICAL",
        ),
      });
      continue;
    }

    let worstValue = values[0];
    let worst = classify(rule, worstValue);
    for (const v of values) {
      const s = classify(rule, v);
      if (RANK[s] > RANK[worst]) {
        worst = s;
        worstValue = v;
      } else if (s === worst) {
        // Among equal severity keep the value closest to the alarm direction.
        worstValue =
          rule.direction === "high"
            ? Math.max(worstValue, v)
            : Math.min(worstValue, v);
      }
    }

    results.push({
      ...base,
      status: worst,
      observedValue: worstValue,
      message: `${rule.sensor} ${worstValue} ${rule.unit} is ${worst} (warning ${rule.warning}, critical ${rule.critical}, ${rule.direction} is bad)`,
      readings: null,
      anyReadingCritical: false,
    });
  }
  return results;
}

export function minimumPriority(
  results: ThresholdEvaluation[],
): Extract<Priority, "HIGH" | "URGENT"> | null {
  const critical = results.filter((r) => r.status === "CRITICAL").length;
  if (critical >= 2) return "URGENT";
  if (critical === 1) return "HIGH";
  if (results.some((r) => r.status === "CONFLICTING" && r.anyReadingCritical))
    return "HIGH";
  return null;
}
