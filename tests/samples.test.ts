import { describe, expect, it } from "vitest";
import { createReportInputSchema } from "@/lib/reports/schema";
import { SAMPLE_REPORTS } from "@/lib/samples";
import { getRules } from "@/lib/thresholds/rules";

const TYPE_BY_TAG = {
  "PUMP-101": "PUMP",
  "CMP-201": "COMPRESSOR",
  "MTR-301": "MOTOR",
} as const;

describe("SAMPLE_REPORTS", () => {
  it("has three samples with unique ids", () => {
    expect(SAMPLE_REPORTS).toHaveLength(3);
    expect(new Set(SAMPLE_REPORTS.map((s) => s.id)).size).toBe(3);
  });

  it.each(SAMPLE_REPORTS.map((s) => [s.id, s] as const))("%s passes the report schema", (_id, sample) => {
    const result = createReportInputSchema.safeParse({
      equipmentId: 1,
      reportedBy: "Test",
      issue: sample.issue,
      events: sample.events.map((description) => ({ description, occurredAt: null })),
      readings: sample.readings.map((r) => ({ sensor: r.sensor, value: r.value, recordedAt: null, source: r.source })),
    });
    expect(result.success).toBe(true);
  });

  it.each(SAMPLE_REPORTS.map((s) => [s.id, s] as const))("%s uses sensors that exist for its equipment type", (_id, sample) => {
    const known = getRules(TYPE_BY_TAG[sample.equipmentTag]).map((r) => r.sensor);
    for (const reading of sample.readings) expect(known).toContain(reading.sensor);
  });
});
