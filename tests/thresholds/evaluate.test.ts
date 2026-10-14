import { describe, expect, it } from "vitest";
import {
  ThresholdInputError,
  evaluateThresholds,
  minimumPriority,
  type SensorReadingInput,
  type ThresholdEvaluation,
} from "@/lib/thresholds/evaluate";

const T0 = new Date("2026-01-01T10:00:00Z");
const minutesBefore = (m: number) => new Date(T0.getTime() - m * 60_000);

function reading(
  sensor: string,
  value: number,
  unit: string,
  recordedAt: Date | null = T0,
  source: string | null = "gauge",
): SensorReadingInput {
  return { sensor, value, unit, recordedAt, source };
}

const vib = (v: number, at: Date | null = T0, source: string | null = "a") =>
  reading("vibration", v, "mm/s", at, source);
const bearing = (v: number) => reading("bearing_temperature", v, "°C");

function find(results: ThresholdEvaluation[], sensor: string) {
  return results.find((r) => r.sensor === sensor);
}

describe("high sensor boundaries (PUMP vibration, 4.5 / 7.1)", () => {
  it.each([
    [4.49, "OK"],
    [4.5, "WARNING"],
    [7.09, "WARNING"],
    [7.1, "CRITICAL"],
  ])("value %s is %s", (value, status) => {
    const r = find(
      evaluateThresholds("PUMP", [vib(value), bearing(50)]),
      "vibration",
    );
    expect(r?.status).toBe(status);
    expect(r?.observedValue).toBe(value);
    expect(r?.ruleId).toBe("PUMP.vibration");
  });
});

describe("low sensor boundaries (PUMP suction_pressure, 0.5 / 0.2)", () => {
  it.each([
    [0.51, "OK"],
    [0.5, "WARNING"],
    [0.21, "WARNING"],
    [0.2, "CRITICAL"],
  ])("value %s is %s", (value, status) => {
    const r = find(
      evaluateThresholds("PUMP", [
        vib(1),
        bearing(50),
        reading("suction_pressure", value, "bar"),
      ]),
      "suction_pressure",
    );
    expect(r?.status).toBe(status);
  });
});

describe("MISSING", () => {
  it("is reported for expected sensors with no reading", () => {
    const r = evaluateThresholds("PUMP", [vib(1)]);
    expect(find(r, "bearing_temperature")?.status).toBe("MISSING");
    expect(find(r, "bearing_temperature")?.observedValue).toBeNull();
  });

  it("produces no result for absent non-expected sensors", () => {
    const r = evaluateThresholds("PUMP", [vib(1), bearing(50)]);
    expect(find(r, "discharge_pressure")).toBeUndefined();
    expect(find(r, "suction_pressure")).toBeUndefined();
    expect(r).toHaveLength(2);
  });

  it("marks every expected sensor MISSING when readings are empty", () => {
    const r = evaluateThresholds("COMPRESSOR", []);
    expect(r.map((x) => [x.sensor, x.status])).toEqual([
      ["discharge_temperature", "MISSING"],
      ["oil_pressure", "MISSING"],
    ]);
  });
});

describe("multiple readings of one sensor", () => {
  it("is CONFLICTING when readings in the window differ by more than the tolerance", () => {
    const r = find(
      evaluateThresholds("PUMP", [
        vib(3, T0, "a"),
        vib(7.5, minutesBefore(5), "b"),
        bearing(50),
      ]),
      "vibration",
    );
    expect(r?.status).toBe("CONFLICTING");
    expect(r?.readings).toHaveLength(2);
    expect(r?.anyReadingCritical).toBe(true);
    expect(r?.message).toContain("a");
    expect(r?.message).toContain("b");
  });

  it("is CONFLICTING without anyReadingCritical when no value is critical", () => {
    const r = find(
      evaluateThresholds("PUMP", [
        vib(2, T0),
        vib(4, minutesBefore(1)),
        bearing(50),
      ]),
      "vibration",
    );
    expect(r?.status).toBe("CONFLICTING");
    expect(r?.anyReadingCritical).toBe(false);
  });

  it("is not CONFLICTING within tolerance and uses the most severe value", () => {
    const r = find(
      evaluateThresholds("PUMP", [
        vib(4.0, T0),
        vib(4.6, minutesBefore(2)),
        bearing(50),
      ]),
      "vibration",
    );
    expect(r?.status).toBe("WARNING");
    expect(r?.observedValue).toBe(4.6);
  });

  it("uses the lowest value as most severe for a low sensor", () => {
    const r = find(
      evaluateThresholds("PUMP", [
        vib(1),
        bearing(50),
        reading("suction_pressure", 0.6, "bar", T0),
        reading("suction_pressure", 0.45, "bar", minutesBefore(1)),
      ]),
      "suction_pressure",
    );
    expect(r?.status).toBe("WARNING");
    expect(r?.observedValue).toBe(0.45);
  });

  it("ignores readings older than the window", () => {
    const r = find(
      evaluateThresholds("PUMP", [
        vib(3, T0),
        vib(9, minutesBefore(30)),
        bearing(50),
      ]),
      "vibration",
    );
    expect(r?.status).toBe("OK");
    expect(r?.observedValue).toBe(3);
  });

  it("includes a reading exactly at the window edge", () => {
    const r = find(
      evaluateThresholds("PUMP", [
        vib(3, T0),
        vib(9, minutesBefore(10)),
        bearing(50),
      ]),
      "vibration",
    );
    expect(r?.status).toBe("CONFLICTING");
  });

  it("treats untimestamped readings as inside the window", () => {
    const r = find(
      evaluateThresholds("PUMP", [vib(3, T0), vib(9, null), bearing(50)]),
      "vibration",
    );
    expect(r?.status).toBe("CONFLICTING");
  });

  it("compares all readings when none are timestamped", () => {
    const r = find(
      evaluateThresholds("PUMP", [vib(3, null), vib(9, null), bearing(50)]),
      "vibration",
    );
    expect(r?.status).toBe("CONFLICTING");
  });
});

describe("ThresholdInputError", () => {
  it("is thrown for an unknown sensor", () => {
    expect(() => evaluateThresholds("PUMP", [reading("flux", 1, "x")])).toThrow(
      ThresholdInputError,
    );
  });

  it("is thrown for a unit mismatch", () => {
    expect(() =>
      evaluateThresholds("PUMP", [reading("vibration", 1, "in/s")]),
    ).toThrow(ThresholdInputError);
  });

  it("is thrown for NaN and Infinity", () => {
    expect(() => evaluateThresholds("PUMP", [vib(Number.NaN)])).toThrow(
      ThresholdInputError,
    );
    expect(() =>
      evaluateThresholds("PUMP", [vib(Number.POSITIVE_INFINITY)]),
    ).toThrow(ThresholdInputError);
  });

  it("is thrown for an invalid timestamp instead of dropping the reading", () => {
    expect(() =>
      evaluateThresholds("PUMP", [
        reading("vibration", 3, "mm/s", new Date("not a date")),
      ]),
    ).toThrow(ThresholdInputError);
  });

  it("lists every problem found", () => {
    try {
      evaluateThresholds("PUMP", [
        reading("flux", 1, "x"),
        reading("vibration", 1, "in/s"),
        vib(Number.NaN),
      ]);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ThresholdInputError);
      expect((e as ThresholdInputError).problems).toHaveLength(3);
    }
  });
});

describe("minimumPriority", () => {
  const result = (
    status: ThresholdEvaluation["status"],
    anyReadingCritical = false,
  ): ThresholdEvaluation => ({
    sensor: "s",
    status,
    ruleId: "PUMP.s",
    observedValue: null,
    unit: "u",
    message: "",
    readings: null,
    anyReadingCritical,
  });

  it("returns null for no results and for OK/WARNING/MISSING", () => {
    expect(minimumPriority([])).toBeNull();
    expect(
      minimumPriority([result("OK"), result("WARNING"), result("MISSING")]),
    ).toBeNull();
  });

  it("returns HIGH for exactly one CRITICAL", () => {
    expect(minimumPriority([result("CRITICAL"), result("OK")])).toBe("HIGH");
  });

  it("returns URGENT for two or more CRITICAL", () => {
    expect(minimumPriority([result("CRITICAL"), result("CRITICAL")])).toBe(
      "URGENT",
    );
    expect(
      minimumPriority([
        result("CRITICAL"),
        result("CRITICAL"),
        result("CRITICAL"),
      ]),
    ).toBe("URGENT");
  });

  it("returns HIGH for CONFLICTING with a critical reading", () => {
    expect(minimumPriority([result("CONFLICTING", true)])).toBe("HIGH");
  });

  it("returns null for CONFLICTING without a critical reading", () => {
    expect(minimumPriority([result("CONFLICTING", false)])).toBeNull();
  });

  it("keeps HIGH when one CRITICAL is joined by a critical conflict", () => {
    expect(
      minimumPriority([result("CRITICAL"), result("CONFLICTING", true)]),
    ).toBe("HIGH");
  });
});
