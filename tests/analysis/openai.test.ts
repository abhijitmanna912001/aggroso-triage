import { describe, expect, it, vi } from "vitest";
import {
  ANALYSIS_TIMEOUT_MS,
  DEFAULT_MODEL,
  MAX_OUTPUT_TOKENS,
  createOpenAiCallModel,
  readOpenAiConfig,
  type OpenAiLike,
} from "../../lib/analysis/openai";
import { AnalysisConfigError } from "../../lib/analysis/run";

const SECRET = "sk-test-secret-key-123";
const prompt = { instructions: "INSTRUCTIONS", userInput: "USER INPUT" };

type ParseResult = Awaited<ReturnType<OpenAiLike["responses"]["parse"]>>;

function fakeClient(result: ParseResult | Error) {
  const parse = vi.fn(async (): Promise<ParseResult> => {
    if (result instanceof Error) throw result;
    return result;
  });
  return { client: { responses: { parse } } as OpenAiLike, parse };
}

describe("readOpenAiConfig", () => {
  it("returns the key and the default model", () => {
    expect(readOpenAiConfig({ OPENAI_API_KEY: SECRET })).toEqual({ apiKey: SECRET, model: DEFAULT_MODEL });
  });

  it("throws AnalysisConfigError with a fixed message for a missing or blank key", () => {
    for (const env of [{}, { OPENAI_API_KEY: "" }, { OPENAI_API_KEY: "   " }]) {
      let caught: unknown;
      try {
        readOpenAiConfig(env);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(AnalysisConfigError);
      expect((caught as Error).message).toBe("OPENAI_API_KEY is not set");
    }
  });

  it("falls back to the default for a blank model and uses a custom model otherwise", () => {
    expect(readOpenAiConfig({ OPENAI_API_KEY: SECRET, OPENAI_MODEL: "  " }).model).toBe(DEFAULT_MODEL);
    expect(readOpenAiConfig({ OPENAI_API_KEY: SECRET, OPENAI_MODEL: "my-model" }).model).toBe("my-model");
  });

  it("has the documented constants", () => {
    expect(DEFAULT_MODEL).toBe("gpt-6-luna");
    expect(ANALYSIS_TIMEOUT_MS).toBe(60_000);
    expect(MAX_OUTPUT_TOKENS).toBe(6000);
  });
});

describe("createOpenAiCallModel", () => {
  it("passes exactly the expected arguments", async () => {
    const { client, parse } = fakeClient({ status: "completed", output: [], output_parsed: { ok: true } });
    await createOpenAiCallModel(client, "my-model")(prompt);

    expect(parse).toHaveBeenCalledTimes(1);
    const body = (parse.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(
      ["input", "instructions", "max_output_tokens", "model", "store", "text"].sort(),
    );
    expect(body.model).toBe("my-model");
    expect(body.instructions).toBe("INSTRUCTIONS");
    expect(body.input).toBe("USER INPUT");
    expect(body.max_output_tokens).toBe(MAX_OUTPUT_TOKENS);
    expect(body.store).toBe(false);
    const format = (body.text as { format: { type: string; name: string } }).format;
    expect(format.type).toBe("json_schema");
    expect(format.name).toBe("analysis_output");
  });

  it("maps a completed response to the parsed output", async () => {
    const parsed = { hypotheses: [] };
    const { client } = fakeClient({
      status: "completed",
      output: [{ type: "message", content: [{ type: "output_text" }] }],
      output_parsed: parsed,
    });
    expect(await createOpenAiCallModel(client, "m")(prompt)).toEqual({ status: "completed", parsed });
  });

  it("maps a refusal", async () => {
    const { client } = fakeClient({
      status: "completed",
      output: [{ type: "message", content: [{ type: "refusal" }] }],
      output_parsed: null,
    });
    expect(await createOpenAiCallModel(client, "m")(prompt)).toEqual({ status: "refusal" });
  });

  it("maps an incomplete response", async () => {
    const { client } = fakeClient({ status: "incomplete", output: [], output_parsed: null });
    expect(await createOpenAiCallModel(client, "m")(prompt)).toEqual({ status: "incomplete" });
  });

  it("lets an error from the client propagate unchanged", async () => {
    const error = Object.assign(new Error("boom"), { status: 429 });
    const { client } = fakeClient(error);
    await expect(createOpenAiCallModel(client, "m")(prompt)).rejects.toBe(error);
  });

  it("never exposes the key in a result or in the config error", async () => {
    const config = readOpenAiConfig({ OPENAI_API_KEY: SECRET });
    const { client } = fakeClient({ status: "completed", output: [], output_parsed: { a: 1 } });
    const result = await createOpenAiCallModel(client, config.model)(prompt);
    expect(JSON.stringify(result)).not.toContain(SECRET);

    for (const env of [{}, { OPENAI_API_KEY: " " }]) {
      try {
        readOpenAiConfig(env);
      } catch (error) {
        expect(String(error)).not.toContain(SECRET);
      }
    }
  });
});
