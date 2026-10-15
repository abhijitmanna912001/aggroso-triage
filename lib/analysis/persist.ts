// Pure module: no "server-only", no "@/" alias, no logging. It does not import lib/db.ts; the database arrives as an
// argument. Only type imports from generated code, so nothing from it is loaded at runtime.
// History summaries and details hold only counts, ids, names and stages. The failure message is stored on the
// run row (errorMessage) and nowhere else.
import type { Confidence, HistoryType, Priority, VersionSource, WorkOrderStatus } from "../../generated/prisma/enums";
import type { RetrievalMode } from "../retrieval/retrieve";
import type { AnalysisRunResult } from "./run";

// Same shape as Prisma's InputJsonValue: null is allowed inside arrays and objects but not at the top level.
export type Json = string | number | boolean | (Json | null)[] | { [key: string]: Json | null };

type AnalysisStatusValue = "SUCCESS" | "DEGRADED" | "FAILED";

// Only the Prisma methods used inside the transaction. There is no update or delete method, so neither can be
// called. The work order create only accepts status "DRAFT".
export type PersistTx = {
  analysisRun: {
    create(args: {
      data: {
        reportId: number;
        status: AnalysisStatusValue;
        retrievalMode: RetrievalMode;
        model: string;
        retrievedChunkIds: string[];
        errorStage: string | null;
        errorMessage: string | null;
        latencyMs: number;
        rawOutput?: Json;
        validationNotes: Json;
      };
    }): Promise<{ id: number }>;
  };
  hypothesis: {
    createMany(args: {
      data: {
        reportId: number;
        runId: number;
        cause: string;
        rationale: string;
        confidence: Confidence;
        citations: Json;
        status: "PROPOSED";
      }[];
    }): Promise<unknown>;
  };
  followUpQuestion: {
    createMany(args: {
      data: { reportId: number; runId: number; question: string; citations: Json }[];
    }): Promise<unknown>;
  };
  inspectionStep: {
    createMany(args: {
      data: { reportId: number; runId: number; position: number; instruction: string; citations: Json }[];
    }): Promise<unknown>;
  };
  workOrder: {
    findUnique(args: {
      where: { reportId: number };
      select: {
        id: true;
        status: true;
        versions: {
          orderBy: { versionNumber: "desc" };
          take: 1;
          select: { versionNumber: true; source: true };
        };
      };
    }): Promise<{
      id: number;
      status: WorkOrderStatus;
      versions: { versionNumber: number; source: VersionSource }[];
    } | null>;
    create(args: { data: { reportId: number; status: "DRAFT" } }): Promise<{ id: number }>;
  };
  workOrderVersion: {
    create(args: {
      data: {
        workOrderId: number;
        versionNumber: number;
        title: string;
        description: string;
        priority: Priority;
        source: "AI";
        editedBy: null;
      };
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

export type PersistDb = PersistTx & {
  $transaction<R>(
    fn: (tx: PersistTx) => Promise<R>,
    options: { timeout: number; maxWait: number },
  ): Promise<R>;
};

export type WorkOrderAction =
  | "created"
  | "new_version"
  | "skipped_decided"
  | "skipped_technician_edits"
  | "skipped_nothing_to_propose"
  | "skipped_failed";

export type SaveAnalysisInput = {
  reportId: number;
  equipmentId: number;
  actor: string;
  run: AnalysisRunResult;
  retrievalMode: RetrievalMode;
  retrievalWarnings: { stage: string; message: string }[];
};

export type SaveAnalysisResult = {
  runId: number;
  workOrderAction: WorkOrderAction;
  workOrderId: number | null;
  versionNumber: number | null;
};

export const TRANSACTION_OPTIONS = { timeout: 30_000, maxWait: 10_000 } as const;

export async function saveAnalysis(db: PersistDb, input: SaveAnalysisInput): Promise<SaveAnalysisResult> {
  const actor = input.actor.trim();
  if (actor === "") throw new Error("saveAnalysis needs a technician name");

  const { reportId, equipmentId, run } = input;

  return db.$transaction(async (tx) => {
    const accepted = run.validated?.accepted ?? null;

    // Decided before the run row is written, so the row is created once and never updated.
    let action: WorkOrderAction;
    let existing: { id: number; latestVersion: number } | null = null;
    if (run.failure !== null || run.status === "FAILED" || accepted === null) {
      action = "skipped_failed";
    } else if (accepted.hypotheses.length === 0 && accepted.inspectionSteps.length === 0) {
      action = "skipped_nothing_to_propose";
    } else {
      const workOrder = await tx.workOrder.findUnique({
        where: { reportId },
        select: {
          id: true,
          status: true,
          versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { versionNumber: true, source: true } },
        },
      });
      if (workOrder === null) {
        action = "created";
      } else if (workOrder.status !== "DRAFT") {
        action = "skipped_decided";
        existing = { id: workOrder.id, latestVersion: workOrder.versions[0]?.versionNumber ?? 0 };
      } else {
        const latest = workOrder.versions[0];
        existing = { id: workOrder.id, latestVersion: latest?.versionNumber ?? 0 };
        action = latest?.source === "TECHNICIAN" ? "skipped_technician_edits" : "new_version";
      }
    }

    const validationNotes: Json = {
      dropped: (run.validated?.dropped ?? []).map((d) => ({ kind: d.kind, index: d.index, reason: d.reason })),
      notes: run.validated?.notes ?? [],
      degradedReasons: run.degradedReasons,
      priorityRaisedByFloor: run.validated?.priorityRaisedByFloor ?? false,
      retrievalWarnings: input.retrievalWarnings.map((w) => ({ stage: w.stage, message: w.message })),
      workOrderAction: action,
    };

    const created = await tx.analysisRun.create({
      data: {
        reportId,
        status: run.status,
        retrievalMode: input.retrievalMode,
        model: run.model,
        retrievedChunkIds: run.promptChunkIds,
        errorStage: run.failure?.stage ?? null,
        errorMessage: run.failure?.message ?? null,
        latencyMs: run.latencyMs,
        // rawOutput is already plain JSON (runAnalysis only passes parsed output or a plain object).
        ...(run.rawOutput === null ? {} : { rawOutput: run.rawOutput as Json }),
        validationNotes,
      },
    });
    const runId = created.id;

    if (accepted !== null) {
      if (accepted.hypotheses.length > 0) {
        await tx.hypothesis.createMany({
          data: accepted.hypotheses.map((h) => ({
            reportId,
            runId,
            cause: h.cause,
            rationale: h.rationale,
            confidence: h.confidence,
            citations: h.citations.map((c) => ({ type: c.type, id: c.id })),
            status: "PROPOSED" as const,
          })),
        });
      }
      if (accepted.followUpQuestions.length > 0) {
        await tx.followUpQuestion.createMany({
          data: accepted.followUpQuestions.map((q) => ({
            reportId,
            runId,
            question: q.question,
            citations: q.citations.map((c) => ({ type: c.type, id: c.id })),
          })),
        });
      }
      if (accepted.inspectionSteps.length > 0) {
        await tx.inspectionStep.createMany({
          data: accepted.inspectionSteps.map((s, i) => ({
            reportId,
            runId,
            position: i + 1,
            instruction: s.instruction,
            citations: s.citations.map((c) => ({ type: c.type, id: c.id })),
          })),
        });
      }
    }

    let workOrderId: number | null = existing?.id ?? null;
    let versionNumber: number | null = null;
    if (accepted !== null && (action === "created" || action === "new_version")) {
      if (action === "created") {
        const workOrder = await tx.workOrder.create({ data: { reportId, status: "DRAFT" } });
        workOrderId = workOrder.id;
        versionNumber = 1;
      } else {
        versionNumber = (existing?.latestVersion ?? 0) + 1;
      }
      await tx.workOrderVersion.create({
        data: {
          workOrderId: workOrderId as number,
          versionNumber,
          title: accepted.draftWorkOrder.title,
          description: accepted.draftWorkOrder.description,
          priority: accepted.priority,
          source: "AI",
          editedBy: null,
        },
      });
    }

    const history: {
      equipmentId: number;
      reportId: number;
      type: HistoryType;
      actor: string;
      summary: string;
      details: Json;
    }[] = [];
    const runDetails: Json = { runId, model: run.model, latencyMs: run.latencyMs };
    if (run.status === "FAILED") {
      history.push({
        equipmentId,
        reportId,
        type: "ANALYSIS_FAILED",
        actor,
        summary: `Analysis run ${runId} failed at stage ${run.failure?.stage ?? "unknown"}`,
        details: runDetails,
      });
    } else {
      history.push({
        equipmentId,
        reportId,
        type: "ANALYSIS_RUN",
        actor,
        summary: `Analysis run ${runId}: ${run.status}, ${accepted?.hypotheses.length ?? 0} possible causes, ${accepted?.inspectionSteps.length ?? 0} steps (${run.model})`,
        details: runDetails,
      });
    }
    if (versionNumber !== null) {
      history.push({
        equipmentId,
        reportId,
        type: "WORK_ORDER_DRAFTED",
        actor,
        summary: `AI draft work order version ${versionNumber} created`,
        details: { workOrderId, versionNumber, source: "AI" },
      });
    }
    await tx.historyEntry.createMany({ data: history });

    return { runId, workOrderAction: action, workOrderId, versionNumber };
  }, TRANSACTION_OPTIONS);
}
