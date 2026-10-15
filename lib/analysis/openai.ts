// Not "server-only" and no "@/" alias, so it runs in plain Node under tsx, vitest and Next. No logging.
// Nothing here puts the API key, the prompt, the response text or an SDK error message into a return value
// or a thrown error. SDK errors propagate unchanged; runAnalysis reports only their name and HTTP status.
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { AnalysisConfigError, type ModelCallResult } from "./run";
import { analysisOutputSchema } from "./schema";

export const DEFAULT_MODEL = "gpt-6-luna";
export const ANALYSIS_TIMEOUT_MS = 30_000;
export const MAX_OUTPUT_TOKENS = 6000;

export function readOpenAiConfig(env: Record<string, string | undefined>): { apiKey: string; model: string } {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new AnalysisConfigError("OPENAI_API_KEY is not set");
  const model = env.OPENAI_MODEL?.trim();
  return { apiKey, model: model ? model : DEFAULT_MODEL };
}

// Only what createOpenAiCallModel uses from client.responses.parse, so tests can pass a fake.
// Method syntax keeps parameter comparison bivariant, which lets the generic SDK signature assign to it.
export type OpenAiLike = {
  responses: {
    parse(body: {
      model: string;
      instructions: string;
      input: string;
      text: { format: ReturnType<typeof zodTextFormat> };
      max_output_tokens: number;
      store: boolean;
    }): Promise<{
      status?: string | null;
      output: { type: string; content?: { type: string }[] }[];
      output_parsed: unknown;
    }>;
  };
};

// No retries: a retry would double the wait on a request that already has a 30 second timeout.
export function createOpenAiClient(apiKey: string): OpenAiLike {
  return new OpenAI({ apiKey, timeout: ANALYSIS_TIMEOUT_MS, maxRetries: 0 });
}

export function createOpenAiCallModel(
  client: OpenAiLike,
  model: string,
): (prompt: { instructions: string; userInput: string }) => Promise<ModelCallResult> {
  return async (prompt) => {
    const response = await client.responses.parse({
      model,
      instructions: prompt.instructions,
      input: prompt.userInput,
      text: { format: zodTextFormat(analysisOutputSchema, "analysis_output") },
      max_output_tokens: MAX_OUTPUT_TOKENS,
      store: false,
    });

    const refused = response.output.some(
      (item) => item.type === "message" && (item.content ?? []).some((part) => part.type === "refusal"),
    );
    if (refused) return { status: "refusal" };
    if (response.status === "incomplete") return { status: "incomplete" };
    return { status: "completed", parsed: response.output_parsed };
  };
}
