import { describe, expect, it } from "vitest";
import { SCENARIOS } from "../../scripts/analyze-scenarios";
import { evaluateThresholds, minimumPriority } from "../../lib/thresholds/evaluate";

function evaluate(name: string) {
  const scenario = SCENARIOS.find((s) => s.name === name);
  if (!scenario) throw new Error(`Unknown scenario ${name}`);
  const results = evaluateThresholds(scenario.equipment.type, scenario.readings);
  return { results, floor: minimumPriority(results) };
}

describe("analyze scenarios", () => {
  it("has the three expected scenario names", () => {
    expect(SCENARIOS.map((s) => s.name)).toEqual(["pump-bearing", "compressor-conflict", "motor-unrelated"]);
  });

  it("pump-bearing: CRITICAL bearing temperature, WARNING vibration, floor HIGH", () => {
    const { results, floor } = evaluate("pump-bearing");
    expect(results.find((r) => r.sensor === "bearing_temperature")?.status).toBe("CRITICAL");
    expect(results.find((r) => r.sensor === "vibration")?.status).toBe("WARNING");
    expect(floor).toBe("HIGH");
  });

  it("compressor-conflict: conflicting oil pressure, missing discharge temperature, no floor", () => {
    const { results, floor } = evaluate("compressor-conflict");
    const oil = results.find((r) => r.sensor === "oil_pressure");
    expect(oil?.status).toBe("CONFLICTING");
    expect(oil?.message).toContain("panel gauge");
    expect(oil?.message).toContain("handheld gauge");
    expect(results.find((r) => r.sensor === "discharge_temperature")?.status).toBe("MISSING");
    expect(floor).toBeNull();
  });

  it("motor-unrelated: both expected sensors missing, no floor", () => {
    const { results, floor } = evaluate("motor-unrelated");
    expect(results.find((r) => r.sensor === "winding_temperature")?.status).toBe("MISSING");
    expect(results.find((r) => r.sensor === "vibration")?.status).toBe("MISSING");
    expect(floor).toBeNull();
  });
});
