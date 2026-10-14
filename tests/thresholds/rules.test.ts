import { describe, expect, it } from "vitest";
import { CONFLICT_WINDOW_MINUTES, RULES, getRule, getRules } from "@/lib/thresholds/rules";
import type { EquipmentType } from "@/generated/prisma/enums";

const types = Object.keys(RULES) as EquipmentType[];

describe("rules sanity", () => {
  it("covers PUMP, COMPRESSOR and MOTOR", () => {
    expect(types.sort()).toEqual(["COMPRESSOR", "MOTOR", "PUMP"]);
  });

  it.each(types)("%s: thresholds are ordered correctly", (type) => {
    for (const rule of getRules(type)) {
      if (rule.direction === "high") expect(rule.warning).toBeLessThan(rule.critical);
      else expect(rule.warning).toBeGreaterThan(rule.critical);
      expect(rule.conflictTolerance).toBeGreaterThan(0);
    }
  });

  it.each(types)("%s: sensor names are unique", (type) => {
    const names = getRules(type).map((r) => r.sensor);
    expect(new Set(names).size).toBe(names.length);
  });

  it("getRule finds known sensors and returns undefined otherwise", () => {
    expect(getRule("PUMP", "vibration")?.critical).toBe(7.1);
    expect(getRule("PUMP", "nope")).toBeUndefined();
  });

  it("uses a 10 minute conflict window", () => {
    expect(CONFLICT_WINDOW_MINUTES).toBe(10);
  });
});
