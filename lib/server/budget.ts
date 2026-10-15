import "server-only";
import { prisma } from "@/lib/db";
import type { BudgetSnapshot } from "../analysis/budget";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Read-only and uncached. Every AnalysisRun row counts, failed ones included, because they cost a model call too.
export async function getBudgetSnapshot(reportId: number, nowMs: number): Promise<BudgetSnapshot> {
  const [runsLastHour, runsLastDay, latest] = await Promise.all([
    prisma.analysisRun.count({ where: { createdAt: { gte: new Date(nowMs - HOUR_MS) } } }),
    prisma.analysisRun.count({ where: { createdAt: { gte: new Date(nowMs - DAY_MS) } } }),
    prisma.analysisRun.findFirst({
      where: { reportId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);
  return {
    now: nowMs,
    runsLastHour,
    runsLastDay,
    lastRunForReportAt: latest === null ? null : latest.createdAt.getTime(),
  };
}
