// Pure module: no "server-only", no "@/" alias, no logging. It does not import lib/db.ts; the database arrives as an
// argument. Only type imports from generated code. History summaries and details hold only ids, counts and the
// equipment tag, never text the user typed.
import type { EquipmentType, HistoryType, ThresholdStatus } from "../../generated/prisma/enums";
import type { Json } from "../analysis/persist";
import { evaluateThresholds, type SensorReadingInput } from "../thresholds/evaluate";
import { getRule } from "../thresholds/rules";
import { MESSAGES, REPORT_LIMITS, type CreateReportInput } from "./schema";

export class ReportValidationError extends Error {
  readonly fieldErrors: Record<string, string[]>;

  constructor(fieldErrors: Record<string, string[]>) {
    super("Report input is invalid");
    this.name = "ReportValidationError";
    this.fieldErrors = fieldErrors;
  }
}

// Only the Prisma methods used inside the transaction. There is no update or delete method, so neither can be called.
export type CreateReportTx = {
  equipment: {
    findUnique(args: {
      where: { id: number };
      select: { id: true; type: true; tag: true };
    }): Promise<{ id: number; type: EquipmentType; tag: string } | null>;
  };
  report: {
    create(args: {
      data: { equipmentId: number; reportedBy: string; issue: string; status: "OPEN" };
    }): Promise<{ id: number }>;
  };
  reportEvent: {
    createMany(args: {
      data: { reportId: number; occurredAt: Date | null; description: string }[];
    }): Promise<unknown>;
  };
  sensorReading: {
    createMany(args: {
      data: {
        reportId: number;
        sensor: string;
        value: number;
        unit: string;
        recordedAt: Date | null;
        source: string | null;
      }[];
    }): Promise<unknown>;
  };
  thresholdResult: {
    createMany(args: {
      data: {
        reportId: number;
        sensor: string;
        status: ThresholdStatus;
        ruleId: string;
        observedValue: number | null;
        unit: string;
        message: string;
      }[];
    }): Promise<unknown>;
  };
  historyEntry: {
    createMany(args: {
      data: {
        equipmentId: number;
        reportId: number;
        type: HistoryType;
        actor: string;
        summary: string;
        details: Json;
      }[];
    }): Promise<unknown>;
  };
};

export type CreateReportDb = CreateReportTx & {
  $transaction<R>(
    fn: (tx: CreateReportTx) => Promise<R>,
    options: { timeout: number; maxWait: number },
  ): Promise<R>;
};

export type CreateReportResult = {
  reportId: number;
  equipmentId: number;
  summary: Record<ThresholdStatus, number>;
};

export const CREATE_TRANSACTION_OPTIONS = { timeout: 30_000, maxWait: 10_000 } as const;

const SUMMARY_ORDER: readonly ThresholdStatus[] = ["CRITICAL", "CONFLICTING", "WARNING", "MISSING", "OK"];

export async function createReport(db: CreateReportDb, input: CreateReportInput): Promise<CreateReportResult> {
  return db.$transaction(async (tx) => {
    const equipment = await tx.equipment.findUnique({
      where: { id: input.equipmentId },
      select: { id: true, type: true, tag: true },
    });
    if (equipment === null) throw new ReportValidationError({ equipmentId: [MESSAGES.equipment] });

    // Collect every problem before any write.
    const errors: Record<string, string[]> = {};
    const perSensor = new Map<string, number>();
    const readings: SensorReadingInput[] = [];
    input.readings.forEach((r, i) => {
      const rule = getRule(equipment.type, r.sensor);
      if (rule === undefined) {
        errors[`reading.${i}.sensor`] = ["This equipment has no sensor with that name"];
        return;
      }
      const seen = (perSensor.get(r.sensor) ?? 0) + 1;
      perSensor.set(r.sensor, seen);
      if (seen > REPORT_LIMITS.readingsPerSensor) {
        errors[`reading.${i}.sensor`] = [`At most ${REPORT_LIMITS.readingsPerSensor} readings per sensor`];
        return;
      }
      // The unit always comes from the rule, never from the user.
      readings.push({ sensor: r.sensor, value: r.value, unit: rule.unit, recordedAt: r.recordedAt, source: r.source });
    });
    if (Object.keys(errors).length > 0) throw new ReportValidationError(errors);

    const evaluations = evaluateThresholds(equipment.type, readings);

    const report = await tx.report.create({
      data: { equipmentId: equipment.id, reportedBy: input.reportedBy, issue: input.issue, status: "OPEN" },
    });
    const reportId = report.id;

    if (input.events.length > 0) {
      await tx.reportEvent.createMany({
        data: input.events.map((e) => ({ reportId, occurredAt: e.occurredAt, description: e.description })),
      });
    }
    if (readings.length > 0) {
      await tx.sensorReading.createMany({
        data: readings.map((r) => ({
          reportId,
          sensor: r.sensor,
          value: r.value,
          unit: r.unit,
          recordedAt: r.recordedAt,
          source: r.source,
        })),
      });
    }
    if (evaluations.length > 0) {
      await tx.thresholdResult.createMany({
        data: evaluations.map((e) => ({
          reportId,
          sensor: e.sensor,
          status: e.status,
          ruleId: e.ruleId,
          observedValue: e.observedValue,
          unit: e.unit,
          message: e.message,
        })),
      });
    }

    const summary: Record<ThresholdStatus, number> = { OK: 0, WARNING: 0, CRITICAL: 0, MISSING: 0, CONFLICTING: 0 };
    for (const e of evaluations) summary[e.status] += 1;
    const parts = SUMMARY_ORDER.filter((s) => summary[s] > 0).map((s) => `${summary[s]} ${s}`);

    await tx.historyEntry.createMany({
      data: [
        {
          equipmentId: equipment.id,
          reportId,
          type: "REPORT_CREATED",
          actor: input.reportedBy,
          summary: `Report ${reportId} created for ${equipment.tag}`,
          details: { reportId, events: input.events.length, readings: readings.length },
        },
        {
          equipmentId: equipment.id,
          reportId,
          type: "THRESHOLDS_EVALUATED",
          actor: input.reportedBy,
          summary: parts.length > 0 ? `Threshold checks: ${parts.join(", ")}` : "Threshold checks: no sensor rules apply",
          details: { ...summary },
        },
      ],
    });

    return { reportId, equipmentId: equipment.id, summary };
  }, CREATE_TRANSACTION_OPTIONS);
}
