// Pure module: only zod, no "server-only", no "@/" alias, so it runs in plain Node under tsx and vitest.
// Structured Outputs does not support optional fields, defaults, min/max/length or regex, so none are used here.
// Limits are enforced in code by validateAnalysis instead.
import { z } from "zod";

export const CITATION_TYPES = ["manual", "event", "threshold"] as const;

export const citationSchema = z.object({
  type: z.enum(CITATION_TYPES).describe("Kind of evidence being cited."),
  id: z
    .string()
    .describe(
      "The exact id of a provided item: a manual section id, an event number, or a threshold rule id.",
    ),
});

const citationsField = z
  .array(citationSchema)
  .describe("Provided items that support this entry. Cite at least one, using exact type and id.");

export const analysisOutputSchema = z.object({
  hypotheses: z.array(
    z.object({
      cause: z
        .string()
        .describe("A possible cause, worded as a possibility, never as confirmed."),
      rationale: z
        .string()
        .describe("Why this cause is plausible, based only on the provided evidence."),
      confidence: z
        .enum(["LOW", "MEDIUM", "HIGH"])
        .describe("How well the provided evidence supports this possible cause."),
      citations: citationsField,
    }),
  ),
  followUpQuestions: z.array(
    z.object({
      question: z
        .string()
        .describe("A question about missing or conflicting information only."),
      citations: citationsField,
    }),
  ),
  inspectionSteps: z.array(
    z.object({
      instruction: z
        .string()
        .describe(
          "One inspection step. If it opens equipment, say to isolate and lock out first. Never remote control.",
        ),
      citations: citationsField,
    }),
  ),
  proposedPriority: z
    .enum(["LOW", "MEDIUM", "HIGH", "URGENT"])
    .describe("Proposed priority. Must not be below the stated minimum priority."),
  priorityRationale: z.string().describe("Short reason for the proposed priority."),
  draftWorkOrder: z.object({
    title: z.string().describe("Short work order title."),
    description: z
      .string()
      .describe("Work order description for a technician to review. Causes remain possibilities."),
  }),
  limitations: z
    .array(z.string())
    .describe("Gaps in the provided evidence, including problems the manual sections do not cover."),
});

export type AnalysisOutput = z.infer<typeof analysisOutputSchema>;
export type Citation = z.infer<typeof citationSchema>;

export const ANALYSIS_LIMITS = {
  hypotheses: 5,
  followUpQuestions: 6,
  inspectionSteps: 10,
} as const;
