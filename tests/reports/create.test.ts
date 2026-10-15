import { describe, expect, it } from "vitest";
import type { PrismaClient } from "../../generated/prisma/client";
import { createReport, ReportValidationError, type CreateReportDb, type CreateReportTx } from "../../lib/reports/create";
import type { CreateReportInput } from "../../lib/reports/schema";

// Compile-time check: the real client satisfies CreateReportDb without a cast.
export const assignabilityCheck = (client: PrismaClient): CreateReportDb => client;

type EquipmentRow = { id: number; type: "PUMP" | "COMPRESSOR" | "MOTOR"; tag: string };
type Call = { method: string; args: unknown; inTransaction: boolean };

function makeFake(equipment: EquipmentRow | null = { id: 3, type: "PUMP", tag: "PUMP-4" }) {
  const calls: Call[] = [];
  const transactionOptions: unknown[] = [];
  const created: Record<string, Record<string, unknown>[]> = {};
  let inTx = false;

  const rec = (method: string, args: unknown) => calls.push({ method, args, inTransaction: inTx });
  const many = (name: string) => async (args: { data: Record<string, unknown>[] }) => {
    rec(`${name}.createMany`, args);
    (created[name] ??= []).push(...args.data);
  };

  const tx: CreateReportTx = {
    equipment: {
      async findUnique(args) {
        rec("equipment.findUnique", args);
        return equipment;
      },
    },
    report: {
      async create(args) {
        rec("report.create", args);
        (created.report ??= []).push(args.data);
        return { id: 55 };
      },
    },
    reportEvent: { createMany: many("reportEvent") },
    sensorReading: { createMany: many("sensorReading") },
    thresholdResult: { createMany: many("thresholdResult") },
    historyEntry: { createMany: many("historyEntry") },
  };

  const db: CreateReportDb = {
    ...tx,
    async $transaction(fn, options) {
      transactionOptions.push(options);
      inTx = true;
      try {
        return await fn(tx);
      } finally {
        inTx = false;
      }
    },
  };

  const writes = () => calls.filter((c) => c.method.endsWith(".create") || c.method.endsWith(".createMany"));
  return { db, calls, created, transactionOptions, writes };
}

const T = new Date("2026-01-31T14:30:00Z");

function input(over: Partial<CreateReportInput> = {}): CreateReportInput {
  return { equipmentId: 3, reportedBy: "Alex", issue: "Pump is noisy", events: [], readings: [], ...over };
}

const reading = (sensor: string, value: number) => ({ sensor, value, recordedAt: T, source: "handheld" });

async function failure(promise: Promise<unknown>): Promise<ReportValidationError> {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(ReportValidationError);
    return e as ReportValidationError;
  }
  throw new Error("expected createReport to throw");
}

describe("createReport", () => {
  it("writes the report, events, readings, threshold results and history for a PUMP", async () => {
    const fake = makeFake();
    const result = await createReport(
      fake.db,
      input({
        events: [{ description: "Started rattling", occurredAt: T }, { description: "No time", occurredAt: null }],
        readings: [reading("vibration", 8), reading("bearing_temperature", 75), reading("discharge_pressure", 5)],
      }),
    );

    expect(result).toEqual({
      reportId: 55,
      equipmentId: 3,
      summary: { OK: 1, WARNING: 1, CRITICAL: 1, MISSING: 0, CONFLICTING: 0 },
    });
    expect(fake.created.report).toEqual([{ equipmentId: 3, reportedBy: "Alex", issue: "Pump is noisy", status: "OPEN" }]);
    expect(fake.created.reportEvent).toEqual([
      { reportId: 55, occurredAt: T, description: "Started rattling" },
      { reportId: 55, occurredAt: null, description: "No time" },
    ]);
    expect(fake.created.sensorReading).toEqual([
      { reportId: 55, sensor: "vibration", value: 8, unit: "mm/s", recordedAt: T, source: "handheld" },
      { reportId: 55, sensor: "bearing_temperature", value: 75, unit: "°C", recordedAt: T, source: "handheld" },
      { reportId: 55, sensor: "discharge_pressure", value: 5, unit: "bar", recordedAt: T, source: "handheld" },
    ]);
    const byStatus = Object.fromEntries(fake.created.thresholdResult.map((r) => [r.sensor, r.status]));
    expect(byStatus).toMatchObject({ vibration: "CRITICAL", bearing_temperature: "WARNING", discharge_pressure: "OK" });
    expect(fake.created.thresholdResult.find((r) => r.sensor === "vibration")).toMatchObject({
      reportId: 55,
      ruleId: "PUMP.vibration",
      observedValue: 8,
      unit: "mm/s",
    });

    expect(fake.created.historyEntry).toEqual([
      {
        equipmentId: 3,
        reportId: 55,
        type: "REPORT_CREATED",
        actor: "Alex",
        summary: "Report 55 created for PUMP-4",
        details: { reportId: 55, events: 2, readings: 3 },
      },
      {
        equipmentId: 3,
        reportId: 55,
        type: "THRESHOLDS_EVALUATED",
        actor: "Alex",
        summary: "Threshold checks: 1 CRITICAL, 1 WARNING, 1 OK",
        details: { OK: 1, WARNING: 1, CRITICAL: 1, MISSING: 0, CONFLICTING: 0 },
      },
    ]);
  });

  it("takes the unit from the rule, not from the user", async () => {
    const fake = makeFake();
    const withUnit = { ...reading("vibration", 3), unit: "furlongs" } as ReturnType<typeof reading>;
    await createReport(fake.db, input({ readings: [withUnit] }));
    expect(fake.created.sensorReading[0].unit).toBe("mm/s");
  });

  it("gives MISSING results for the expected sensors when there are no readings", async () => {
    const fake = makeFake();
    const result = await createReport(fake.db, input());
    expect(result.summary).toEqual({ OK: 0, WARNING: 0, CRITICAL: 0, MISSING: 2, CONFLICTING: 0 });
    expect(fake.created.thresholdResult.map((r) => [r.sensor, r.status]).sort()).toEqual([
      ["bearing_temperature", "MISSING"],
      ["vibration", "MISSING"],
    ]);
    expect(fake.created.historyEntry[1].summary).toBe("Threshold checks: 2 MISSING");
    // Empty arrays never produce a createMany call.
    expect(fake.calls.map((c) => c.method)).not.toContain("reportEvent.createMany");
    expect(fake.calls.map((c) => c.method)).not.toContain("sensorReading.createMany");
  });

  it("reports an unknown sensor at its input index", async () => {
    const fake = makeFake();
    const err = await failure(createReport(fake.db, input({ readings: [reading("vibration", 1), reading("flux", 2)] })));
    expect(err.name).toBe("ReportValidationError");
    expect(err.fieldErrors).toEqual({ "reading.1.sensor": ["This equipment has no sensor with that name"] });
  });

  it("rejects more than 3 readings of one sensor on the extra rows only", async () => {
    const fake = makeFake();
    const readings = [1, 2, 3, 4, 5].map((v) => reading("vibration", v));
    const err = await failure(createReport(fake.db, input({ readings })));
    expect(Object.keys(err.fieldErrors).sort()).toEqual(["reading.3.sensor", "reading.4.sensor"]);
    expect(err.fieldErrors["reading.3.sensor"]).toEqual(["At most 3 readings per sensor"]);
  });

  it("throws for missing equipment", async () => {
    const fake = makeFake(null);
    const err = await failure(createReport(fake.db, input()));
    expect(err.fieldErrors).toEqual({ equipmentId: ["Choose an equipment item"] });
    expect(fake.writes()).toHaveLength(0);
  });

  it("collects all errors in a single throw and writes nothing", async () => {
    const fake = makeFake();
    const readings = [
      reading("flux", 1),
      reading("vibration", 1),
      reading("vibration", 2),
      reading("vibration", 3),
      reading("vibration", 4),
      reading("nope", 5),
    ];
    const err = await failure(createReport(fake.db, input({ readings })));
    expect(Object.keys(err.fieldErrors).sort()).toEqual(["reading.0.sensor", "reading.4.sensor", "reading.5.sensor"]);
    expect(fake.writes()).toHaveLength(0);
  });

  it("runs everything in one transaction with the timeout options", async () => {
    const fake = makeFake();
    await createReport(fake.db, input({ events: [{ description: "x", occurredAt: null }], readings: [reading("vibration", 1)] }));
    expect(fake.transactionOptions).toEqual([{ timeout: 30_000, maxWait: 10_000 }]);
    expect(fake.calls.length).toBeGreaterThan(0);
    expect(fake.calls.every((c) => c.inTransaction)).toBe(true);
  });

  it("keeps user-entered text out of every history entry", async () => {
    const fake = makeFake();
    const SENTINEL = "SENTINEL-user-text-91c2";
    await createReport(
      fake.db,
      input({
        issue: `Leak ${SENTINEL}`,
        events: [{ description: `Saw ${SENTINEL}`, occurredAt: T }],
        readings: [reading("vibration", 8)],
      }),
    );
    expect(fake.created.historyEntry.length).toBeGreaterThan(0);
    expect(JSON.stringify(fake.created.historyEntry)).not.toContain(SENTINEL);
  });
});
