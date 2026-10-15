// Pure module: no "server-only", no "@/" alias, no logging, no database import. All I/O comes in through
// OrchestrateDeps. Nothing taken from the report, the model, a failure or a warning reaches analysisLogFields.
import type { EquipmentType } from "../../generated/prisma/enums";
import { ServiceNotFoundError } from "../reports/errors";
import type { RetrievalQueryInput } from "../retrieval/query";
import type { RetrievalMode, RetrievalResult, RetrievalWarning } from "../retrieval/retrieve";
import { evaluateThresholds, minimumPriority, type SensorReadingInput } from "../thresholds/evaluate";
import type { SaveAnalysisInput, SaveAnalysisResult } from "./persist";
import type { AnalysisRunInput, AnalysisRunResult } from "./run";

export type ReportForAnalysis = {
  id: number;
  equipment: { id: number; type: EquipmentType; tag: string; name: string };
  issue: string;
  events: { id: number; occurredAt: Date | null; description: string }[];
  readings: SensorReadingInput[];
  answeredQuestions: { question: string; answer: string }[];
};

export type OrchestrateDeps = {
  loadReport(reportId: number): Promise<ReportForAnalysis | null>;
  retrieve(input: RetrievalQueryInput): Promise<RetrievalResult>;
  analyze(input: AnalysisRunInput): Promise<AnalysisRunResult>;
  save(input: SaveAnalysisInput): Promise<SaveAnalysisResult>;
  now(): number;
};

export type AnalyzeReportResult = {
  run: AnalysisRunResult;
  saved: SaveAnalysisResult;
  retrieval: { mode: RetrievalMode; belowCutoff: number; chunkIds: string[]; warnings: RetrievalWarning[] };
  totalMs: number;
};

// Fixed text only: the thrown error is never read, because its message could carry connection details.
const RETRIEVAL_FAILED_WARNING: RetrievalWarning = {
  stage: "keyword",
  message: "Retrieval failed unexpectedly",
};

export async function analyzeReport(
  deps: OrchestrateDeps,
  { reportId, actor }: { reportId: number; actor: string },
): Promise<AnalyzeReportResult> {
  const start = deps.now();

  const report = await deps.loadReport(reportId);
  if (report === null) throw new ServiceNotFoundError("report");

  const thresholds = evaluateThresholds(report.equipment.type, report.readings);
  const priorityFloor = minimumPriority(thresholds);

  let retrieval: Pick<RetrievalResult, "mode" | "chunks" | "warnings" | "belowCutoff">;
  try {
    retrieval = await deps.retrieve({
      equipmentType: report.equipment.type,
      issue: report.issue,
      events: report.events.map((e) => ({ description: e.description })),
      thresholds: thresholds.map((t) => ({ sensor: t.sensor, status: t.status })),
    });
  } catch {
    retrieval = { mode: "NONE", chunks: [], warnings: [{ ...RETRIEVAL_FAILED_WARNING }], belowCutoff: 0 };
  }

  const run = await deps.analyze({
    equipment: { type: report.equipment.type, tag: report.equipment.tag, name: report.equipment.name },
    issue: report.issue,
    events: report.events.map((e) => ({ id: e.id, occurredAt: e.occurredAt, description: e.description })),
    thresholds,
    chunks: retrieval.chunks.map((c) => ({
      id: c.id,
      sectionRef: c.sectionRef,
      heading: c.heading,
      content: c.content,
    })),
    answeredQuestions: report.answeredQuestions,
    priorityFloor,
    retrievalMode: retrieval.mode,
  });

  const saved = await deps.save({
    reportId,
    equipmentId: report.equipment.id,
    actor,
    run,
    retrievalMode: retrieval.mode,
    retrievalWarnings: retrieval.warnings.map((w) => ({ stage: w.stage, message: w.message })),
  });

  return {
    run,
    saved,
    retrieval: {
      mode: retrieval.mode,
      belowCutoff: retrieval.belowCutoff,
      chunkIds: retrieval.chunks.map((c) => c.id),
      warnings: retrieval.warnings,
    },
    totalMs: deps.now() - start,
  };
}

// Counts, enums, ids, timings and fixed stage names only. Never report text, model text, failure or warning
// messages, citation notes or chunk content.
export function analysisLogFields(
  result: AnalyzeReportResult & { reportId: number },
): Record<string, string | number | boolean> {
  const { run, saved, retrieval } = result;
  const accepted = run.validated?.accepted ?? null;
  return {
    reportId: result.reportId,
    runId: saved.runId,
    status: run.status,
    model: run.model,
    latencyMs: run.latencyMs,
    totalMs: result.totalMs,
    retrievalMode: retrieval.mode,
    belowCutoff: retrieval.belowCutoff,
    chunkCount: retrieval.chunkIds.length,
    retrievalWarningStages: retrieval.warnings.map((w) => w.stage).join(","),
    failureStage: run.failure?.stage ?? "none",
    degradedReasonCount: run.degradedReasons.length,
    droppedCount: run.validated?.dropped.length ?? 0,
    hypothesisCount: accepted?.hypotheses.length ?? 0,
    questionCount: accepted?.followUpQuestions.length ?? 0,
    stepCount: accepted?.inspectionSteps.length ?? 0,
    workOrderAction: saved.workOrderAction,
    priority: accepted?.priority ?? "none",
    priorityRaisedByFloor: run.validated?.priorityRaisedByFloor ?? false,
  };
}
