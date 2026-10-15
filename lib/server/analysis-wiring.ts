import "server-only";
import { prisma } from "@/lib/db";
import { DEFAULT_MODEL, createOpenAiCallModel, createOpenAiClient, readOpenAiConfig } from "../analysis/openai";
import type { OrchestrateDeps, ReportForAnalysis } from "../analysis/orchestrate";
import { saveAnalysis } from "../analysis/persist";
import { runAnalysis } from "../analysis/run";
import { createPrismaRetrievalDeps, embedForRetrieval } from "../retrieval/prisma-deps";
import { retrieveChunks } from "../retrieval/retrieve";

export function createAnalysisDeps(): OrchestrateDeps {
  return {
    async loadReport(reportId) {
      const row = await prisma.report.findUnique({
        where: { id: reportId },
        select: {
          id: true,
          issue: true,
          equipment: { select: { id: true, type: true, tag: true, name: true } },
          events: { select: { id: true, occurredAt: true, description: true }, orderBy: { id: "asc" } },
          readings: {
            select: { sensor: true, value: true, unit: true, recordedAt: true, source: true },
            orderBy: { id: "asc" },
          },
          questions: {
            where: { answer: { not: null } },
            select: { question: true, answer: true },
            orderBy: { id: "asc" },
          },
        },
      });
      if (row === null) return null;
      const report: ReportForAnalysis = {
        id: row.id,
        equipment: row.equipment,
        issue: row.issue,
        events: row.events,
        readings: row.readings,
        answeredQuestions: row.questions.flatMap((q) => (q.answer === null ? [] : [{ question: q.question, answer: q.answer }])),
      };
      return report;
    },

    retrieve: (input) => retrieveChunks(input, createPrismaRetrievalDeps(prisma, embedForRetrieval)),

    analyze: (input) =>
      runAnalysis(input, {
        // The model name is not secret. The key is read inside callModel, so a missing key surfaces as an
        // AnalysisConfigError from the model call and runAnalysis records it as a config failure.
        model: process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
        now: () => Date.now(),
        callModel: async (prompt) => {
          const config = readOpenAiConfig(process.env);
          return createOpenAiCallModel(createOpenAiClient(config.apiKey), config.model)(prompt);
        },
      }),

    save: (input) => saveAnalysis(prisma, input),

    now: () => Date.now(),
  };
}
