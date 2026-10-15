// Pure module: no "server-only", no "@/" alias, no logging, no I/O. All side effects come in through AnalysisDeps.
// Failure messages are fixed text plus an error name (and HTTP status). Error messages, prompts and model output
// never reach them, because they can carry connection strings or user data.
import type { RetrievalMode } from "../retrieval/retrieve";
import { buildAnalysisPrompt, type AllowedCitations, type AnalysisPromptInput } from "./prompt";
import { analysisOutputSchema } from "./schema";
import { validateAnalysis, type ValidatedAnalysis } from "./validate";

export class AnalysisConfigError extends Error {
  constructor(message = "Analysis is not configured") {
    super(message);
    this.name = "AnalysisConfigError";
  }
}

export type ModelCallResult =
  | { status: "completed"; parsed: unknown }
  | { status: "refusal" }
  | { status: "incomplete" };

export type AnalysisDeps = {
  // Rejects for config, network, timeout and HTTP problems.
  callModel(prompt: { instructions: string; userInput: string }): Promise<ModelCallResult>;
  now(): number;
  model: string;
};

export type AnalysisFailureStage =
  | "retrieval"
  | "config"
  | "request"
  | "refusal"
  | "incomplete"
  | "parse"
  | "internal";

export type AnalysisRunResult = {
  status: "SUCCESS" | "DEGRADED" | "FAILED";
  model: string;
  latencyMs: number;
  failure: { stage: AnalysisFailureStage; message: string } | null;
  validated: ValidatedAnalysis | null;
  allowed: AllowedCitations;
  promptChunkIds: string[];
  rawOutput: unknown | null;
  degradedReasons: string[];
};

export type AnalysisRunInput = AnalysisPromptInput & { retrievalMode: RetrievalMode };

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

function httpStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null) return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

function isPlainJson(value: unknown): boolean {
  if (Array.isArray(value)) return true;
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export async function runAnalysis(input: AnalysisRunInput, deps: AnalysisDeps): Promise<AnalysisRunResult> {
  let allowed: AllowedCitations = { manual: [], event: [], threshold: [] };
  let latencyMs = 0;

  const fail = (
    stage: AnalysisFailureStage,
    message: string,
    rawOutput: unknown | null = null,
  ): AnalysisRunResult => ({
    status: "FAILED",
    model: deps.model,
    latencyMs,
    failure: { stage, message },
    validated: null,
    allowed,
    promptChunkIds: stage === "retrieval" ? [] : input.chunks.map((c) => c.id),
    rawOutput,
    degradedReasons: [],
  });

  try {
    if (input.retrievalMode === "NONE") {
      return fail("retrieval", "Retrieval failed, so the model was not called.");
    }

    const prompt = buildAnalysisPrompt(input);
    allowed = prompt.allowed;

    const start = deps.now();
    let result: ModelCallResult;
    try {
      result = await deps.callModel({ instructions: prompt.instructions, userInput: prompt.userInput });
    } catch (error) {
      latencyMs = deps.now() - start;
      if (error instanceof AnalysisConfigError) {
        return fail("config", `Analysis is not configured (${errorName(error)}).`);
      }
      const status = httpStatus(error);
      return fail(
        "request",
        `The model request failed (${errorName(error)}${status === null ? "" : `, HTTP ${status}`}).`,
      );
    }
    latencyMs = deps.now() - start;

    if (result.status === "refusal") return fail("refusal", "The model refused to produce an analysis.");
    if (result.status === "incomplete") return fail("incomplete", "The model response was incomplete.");

    const parsed = analysisOutputSchema.safeParse(result.parsed);
    if (!parsed.success) {
      return fail(
        "parse",
        `The model output did not match the expected format (${parsed.error.issues.length} issue(s)).`,
        isPlainJson(result.parsed) ? result.parsed : null,
      );
    }

    const validated = validateAnalysis(parsed.data, allowed, {
      priorityFloor: input.priorityFloor,
      missingThresholdIds: prompt.missingThresholdIds,
      equipmentTag: input.equipment.tag,
    });

    const degradedReasons: string[] = [];
    if (input.retrievalMode === "KEYWORD_ONLY") degradedReasons.push("keyword-only retrieval");
    if (input.chunks.length === 0) degradedReasons.push("no manual sections retrieved");
    if (validated.dropped.length > 0) degradedReasons.push(`${validated.dropped.length} item(s) dropped`);
    if (validated.notes.length > 0) degradedReasons.push(`${validated.notes.length} citation note(s)`);
    if (validated.accepted.hypotheses.length === 0) degradedReasons.push("no possible cause survived validation");

    return {
      status: degradedReasons.length > 0 ? "DEGRADED" : "SUCCESS",
      model: deps.model,
      latencyMs,
      failure: null,
      validated,
      allowed,
      promptChunkIds: input.chunks.map((c) => c.id),
      rawOutput: parsed.data,
      degradedReasons,
    };
  } catch (error) {
    return fail("internal", `Unexpected analysis error (${errorName(error)}).`);
  }
}
