import "server-only";
import { prisma } from "@/lib/db";
import { parseCitations, type Citation } from "./evidence";

// Read-only, uncached, plain serializable data. Call these inside <Suspense>.

export async function listEquipment() {
  return prisma.equipment.findMany({
    select: { id: true, tag: true, name: true, type: true },
    orderBy: { tag: "asc" },
  });
}

export async function listRecentReports(limit = 20) {
  const rows = await prisma.report.findMany({
    select: {
      id: true,
      createdAt: true,
      reportedBy: true,
      issue: true,
      status: true,
      equipment: { select: { tag: true, name: true } },
      workOrder: { select: { status: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    reportedBy: r.reportedBy,
    issue: r.issue.slice(0, 140),
    status: r.status,
    equipmentTag: r.equipment.tag,
    equipmentName: r.equipment.name,
    workOrderStatus: r.workOrder?.status ?? null,
  }));
}

export async function getReportWorkspace(reportId: number) {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      issue: true,
      reportedBy: true,
      status: true,
      createdAt: true,
      equipment: { select: { id: true, type: true, tag: true, name: true } },
      events: { select: { id: true, description: true, occurredAt: true }, orderBy: { id: "asc" } },
      readings: {
        select: { sensor: true, value: true, unit: true, recordedAt: true, source: true },
        orderBy: { id: "asc" },
      },
      thresholdResults: {
        select: { id: true, sensor: true, status: true, ruleId: true, observedValue: true, unit: true, message: true },
        orderBy: [{ sensor: "asc" }, { id: "asc" }],
      },
      observations: {
        select: { id: true, text: true, recordedBy: true, createdAt: true },
        orderBy: { id: "asc" },
      },
      findings: {
        select: { id: true, description: true, confirmedBy: true, createdAt: true, hypothesisId: true },
        orderBy: { id: "asc" },
      },
      analysisRuns: {
        select: {
          id: true,
          status: true,
          retrievalMode: true,
          model: true,
          latencyMs: true,
          errorStage: true,
          errorMessage: true,
          createdAt: true,
          retrievedChunkIds: true,
          validationNotes: true,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
      },
      workOrder: {
        select: {
          id: true,
          status: true,
          decidedBy: true,
          decidedAt: true,
          decidedVersion: true,
          decisionNote: true,
          versions: {
            select: {
              versionNumber: true,
              title: true,
              description: true,
              priority: true,
              source: true,
              editedBy: true,
              createdAt: true,
            },
            orderBy: { versionNumber: "desc" },
          },
        },
      },
    },
  });
  if (report === null) return null;

  const latestRun = report.analysisRuns[0] ?? null;

  const [hypotheses, questions, steps, chunkRows] =
    latestRun === null
      ? [[], [], [], []]
      : await Promise.all([
          prisma.hypothesis.findMany({
            where: { reportId, runId: latestRun.id },
            select: { id: true, cause: true, rationale: true, confidence: true, status: true, citations: true },
            orderBy: { id: "asc" },
          }),
          prisma.followUpQuestion.findMany({
            where: { reportId, runId: latestRun.id },
            select: {
              id: true,
              question: true,
              citations: true,
              answer: true,
              answeredBy: true,
              answeredAt: true,
            },
            orderBy: { id: "asc" },
          }),
          prisma.inspectionStep.findMany({
            where: { reportId, runId: latestRun.id },
            select: { id: true, position: true, instruction: true, citations: true },
            orderBy: { position: "asc" },
          }),
          prisma.manualChunk.findMany({
            where: { id: { in: latestRun.retrievedChunkIds } },
            select: { id: true, sectionRef: true, heading: true },
          }),
        ]);

  // Keep the order the run retrieved them in.
  const byId = new Map(chunkRows.map((c) => [c.id, c] as const));
  const chunks = (latestRun?.retrievedChunkIds ?? []).flatMap((id) => {
    const c = byId.get(id);
    return c ? [c] : [];
  });

  return {
    report: {
      id: report.id,
      issue: report.issue,
      reportedBy: report.reportedBy,
      status: report.status,
      createdAt: report.createdAt,
      equipment: report.equipment,
    },
    events: report.events,
    readings: report.readings,
    thresholds: report.thresholdResults,
    observations: report.observations,
    findings: report.findings,
    latestRun,
    hypotheses: hypotheses.map((h) => ({ ...h, citations: parseCitations(h.citations) as Citation[] })),
    questions: questions.map((q) => ({ ...q, citations: parseCitations(q.citations) as Citation[] })),
    steps: steps.map((s) => ({ ...s, citations: parseCitations(s.citations) as Citation[] })),
    workOrder: report.workOrder,
    chunks,
  };
}

export async function getEquipmentHistory(equipmentId: number, limit = 100) {
  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: { id: true, tag: true, name: true, type: true },
  });
  if (equipment === null) return null;
  const entries = await prisma.historyEntry.findMany({
    where: { equipmentId },
    select: { id: true, createdAt: true, type: true, actor: true, summary: true, reportId: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
  });
  return { equipment, entries };
}
