import { describe, expect, it, vi } from "vitest";
import {
  AnalysisConfigError,
  runAnalysis,
  type AnalysisDeps,
  type AnalysisRunInput,
  type ModelCallResult,
} from "../../lib/analysis/run";
import type { AnalysisOutput } from "../../lib/analysis/schema";
import type { ThresholdEvaluation } from "../../lib/thresholds/evaluate";

const threshold: ThresholdEvaluation = {
  sensor: "vibration",
  status: "CRITICAL",
  ruleId: "PUMP.vibration",
  observedValue: 9,
  unit: "mm/s",
  message: "vibration 9 mm/s is CRITICAL",
  readings: null,
  anyReadingCritical: false,
};

function makeInput(overrides: Partial<AnalysisRunInput> = {}): AnalysisRunInput {
  return {
    equipment: { type: "PUMP", tag: "P-101", name: "Cooling pump" },
    issue: "Pump is noisy",
    events: [{ id: 7, occurredAt: null, description: "Noise started" }],
    thresholds: [threshold],
    chunks: [{ id: "pump-4-2", sectionRef: "4.2", heading: "Bearing wear", content: "Check bearings." }],
    answeredQuestions: [],
    priorityFloor: null,
    retrievalMode: "HYBRID",
    ...overrides,
  };
}

function makeOutput(overrides: Partial<AnalysisOutput> = {}): AnalysisOutput {
  return {
    hypotheses: [
      {
        cause: "Possible bearing wear",
        rationale: "High vibration",
        confidence: "MEDIUM",
        citations: [{ type: "manual", id: "pump-4-2" }],
      },
    ],
    followUpQuestions: [{ question: "When was it lubricated?", citations: [{ type: "event", id: "7" }] }],
    inspectionSteps: [
      { instruction: "Isolate and lock out, then inspect.", citations: [{ type: "manual", id: "pump-4-2" }] },
    ],
    proposedPriority: "MEDIUM",
    priorityRationale: "Moderate",
    draftWorkOrder: { title: "Inspect pump", description: "Check it." },
    limitations: [],
    ...overrides,
  };
}

function makeDeps(
  callModel: AnalysisDeps["callModel"],
  times: number[] = [1000, 1250],
): AnalysisDeps & { callModel: ReturnType<typeof vi.fn> } {
  let i = 0;
  return {
    callModel: vi.fn(callModel),
    now: () => times[Math.min(i++, times.length - 1)],
    model: "test-model",
  };
}

const completed = (parsed: unknown): ModelCallResult => ({ status: "completed", parsed });

describe("runAnalysis success", () => {
  it("returns SUCCESS with validated output and measures latency from the injected clock", async () => {
    const deps = makeDeps(async () => completed(makeOutput()));
    const result = await runAnalysis(makeInput(), deps);
    expect(result.status).toBe("SUCCESS");
    expect(result.failure).toBeNull();
    expect(result.degradedReasons).toEqual([]);
    expect(result.model).toBe("test-model");
    expect(result.latencyMs).toBe(250);
    expect(result.validated?.accepted.hypotheses).toHaveLength(1);
    expect(result.allowed).toEqual({ manual: ["pump-4-2"], event: ["7"], threshold: ["PUMP.vibration"] });
    expect(result.promptChunkIds).toEqual(["pump-4-2"]);
    expect(result.rawOutput).toEqual(makeOutput());
  });

  it("passes priorityRaisedByFloor through", async () => {
    const deps = makeDeps(async () => completed(makeOutput({ proposedPriority: "LOW" })));
    const result = await runAnalysis(makeInput({ priorityFloor: "HIGH" }), deps);
    expect(result.validated?.priorityRaisedByFloor).toBe(true);
    expect(result.validated?.accepted.priority).toBe("HIGH");
  });
});

describe("runAnalysis failures", () => {
  it("skips the model call when retrieval produced nothing", async () => {
    const deps = makeDeps(async () => completed(makeOutput()));
    const result = await runAnalysis(makeInput({ retrievalMode: "NONE" }), deps);
    expect(deps.callModel).not.toHaveBeenCalled();
    expect(result.status).toBe("FAILED");
    expect(result.failure?.stage).toBe("retrieval");
    expect(result.validated).toBeNull();
  });

  it("maps a config error to stage config", async () => {
    const deps = makeDeps(async () => {
      throw new AnalysisConfigError("missing key");
    });
    const result = await runAnalysis(makeInput(), deps);
    expect(result.status).toBe("FAILED");
    expect(result.failure?.stage).toBe("config");
    expect(result.failure?.message).toContain("AnalysisConfigError");
    expect(new AnalysisConfigError().name).toBe("AnalysisConfigError");
  });

  it("maps another error to stage request, with and without an http status", async () => {
    const plain = await runAnalysis(
      makeInput(),
      makeDeps(async () => {
        throw new TypeError("boom");
      }),
    );
    expect(plain.failure?.stage).toBe("request");
    expect(plain.failure?.message).toContain("TypeError");
    expect(plain.failure?.message).not.toContain("HTTP");

    const withStatus = await runAnalysis(
      makeInput(),
      makeDeps(async () => {
        throw Object.assign(new Error("rate limited"), { name: "RateLimitError", status: 429 });
      }),
    );
    expect(withStatus.failure?.stage).toBe("request");
    expect(withStatus.failure?.message).toContain("RateLimitError");
    expect(withStatus.failure?.message).toContain("HTTP 429");
  });

  it("maps refusal and incomplete results", async () => {
    const refusal = await runAnalysis(makeInput(), makeDeps(async () => ({ status: "refusal" })));
    expect(refusal.status).toBe("FAILED");
    expect(refusal.failure?.stage).toBe("refusal");
    const incomplete = await runAnalysis(makeInput(), makeDeps(async () => ({ status: "incomplete" })));
    expect(incomplete.status).toBe("FAILED");
    expect(incomplete.failure?.stage).toBe("incomplete");
  });

  it("maps unparseable output to stage parse and keeps plain objects as rawOutput", async () => {
    const bad = { hypotheses: "nope" };
    const result = await runAnalysis(makeInput(), makeDeps(async () => completed(bad)));
    expect(result.status).toBe("FAILED");
    expect(result.failure?.stage).toBe("parse");
    expect(result.failure?.message).toMatch(/\d+ issue/);
    expect(result.rawOutput).toEqual(bad);

    const text = await runAnalysis(makeInput(), makeDeps(async () => completed("just text")));
    expect(text.failure?.stage).toBe("parse");
    expect(text.rawOutput).toBeNull();
  });

  it("turns an unexpected throw into stage internal", async () => {
    const parsed = {
      get hypotheses(): unknown {
        throw new RangeError("secret internals");
      },
    };
    const result = await runAnalysis(makeInput(), makeDeps(async () => completed(parsed)));
    expect(result.status).toBe("FAILED");
    expect(result.failure?.stage).toBe("internal");
    expect(result.failure?.message).toContain("RangeError");
    expect(JSON.stringify(result)).not.toContain("secret internals");
  });

  it("never puts error messages or model text in failure messages", async () => {
    const secretError = await runAnalysis(
      makeInput(),
      makeDeps(async () => {
        throw new Error("postgresql://secret");
      }),
    );
    expect(JSON.stringify(secretError)).not.toContain("postgresql://secret");

    const refusalText = "postgresql://secret";
    const refusal = await runAnalysis(
      makeInput(),
      makeDeps(async () => ({ status: "refusal", text: refusalText }) as ModelCallResult),
    );
    expect(JSON.stringify(refusal)).not.toContain(refusalText);

    const parse = await runAnalysis(makeInput(), makeDeps(async () => completed("postgresql://secret")));
    expect(JSON.stringify(parse)).not.toContain("postgresql://secret");
  });
});

describe("runAnalysis DEGRADED", () => {
  it("is DEGRADED for keyword-only retrieval", async () => {
    const result = await runAnalysis(
      makeInput({ retrievalMode: "KEYWORD_ONLY" }),
      makeDeps(async () => completed(makeOutput())),
    );
    expect(result.status).toBe("DEGRADED");
    expect(result.degradedReasons).toContain("keyword-only retrieval");
    expect(result.validated).not.toBeNull();
  });

  it("is DEGRADED when no chunks were retrieved", async () => {
    const output = makeOutput({
      hypotheses: [
        { cause: "Possible fault", rationale: "r", confidence: "LOW", citations: [{ type: "event", id: "7" }] },
      ],
      inspectionSteps: [],
    });
    const result = await runAnalysis(makeInput({ chunks: [] }), makeDeps(async () => completed(output)));
    expect(result.status).toBe("DEGRADED");
    expect(result.degradedReasons).toContain("no manual sections retrieved");
    expect(result.promptChunkIds).toEqual([]);
  });

  it("is DEGRADED when items were dropped", async () => {
    const output = makeOutput({
      followUpQuestions: [{ question: "Q?", citations: [{ type: "event", id: "999" }] }],
    });
    const result = await runAnalysis(makeInput(), makeDeps(async () => completed(output)));
    expect(result.status).toBe("DEGRADED");
    expect(result.degradedReasons).toContain("1 item(s) dropped");
    expect(result.degradedReasons).toContain("1 citation note(s)");
  });

  it("is DEGRADED when no hypothesis survives", async () => {
    const output = makeOutput({ hypotheses: [] });
    const result = await runAnalysis(makeInput(), makeDeps(async () => completed(output)));
    expect(result.status).toBe("DEGRADED");
    expect(result.degradedReasons).toEqual(["no possible cause survived validation"]);
  });
});
