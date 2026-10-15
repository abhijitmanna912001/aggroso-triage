import { describe, expect, it, vi } from "vitest";
import {
  analysisLogFields,
  analyzeReport,
  type AnalyzeReportResult,
  type OrchestrateDeps,
  type ReportForAnalysis,
} from "../../lib/analysis/orchestrate";
import type { SaveAnalysisResult } from "../../lib/analysis/persist";
import type { AnalysisRunResult } from "../../lib/analysis/run";
import { ServiceNotFoundError } from "../../lib/reports/errors";
import type { RetrievalResult } from "../../lib/retrieval/retrieve";
import type { SensorReadingInput } from "../../lib/thresholds/evaluate";

const SENTINEL = "SENTINEL-SECRET-TEXT-9f3a";

function reading(sensor: string, value: number, unit: string): SensorReadingInput {
  return { sensor, value, unit, recordedAt: null, source: null };
}

const OK_READINGS = [reading("vibration", 2, "mm/s"), reading("bearing_temperature", 50, "°C")];

function makeReport(overrides: Partial<ReportForAnalysis> = {}): ReportForAnalysis {
  return {
    id: 7,
    equipment: { id: 3, type: "PUMP", tag: "P-101", name: "Cooling pump" },
    issue: "Pump is noisy",
    events: [
      { id: 11, occurredAt: new Date("2026-01-01T10:00:00Z"), description: "Noise started" },
      { id: 12, occurredAt: null, description: "Operator restarted it" },
    ],
    readings: OK_READINGS,
    answeredQuestions: [{ question: "Any leaks?", answer: "No" }],
    ...overrides,
  };
}

function makeRetrieval(overrides: Partial<RetrievalResult> = {}): RetrievalResult {
  return {
    mode: "HYBRID",
    chunks: [
      {
        id: "pump-4-2",
        equipmentType: "PUMP",
        document: "pump.md",
        sectionRef: "4.2",
        heading: "Bearings",
        content: "Check bearing wear.",
        score: 0.9,
        similarity: 0.8,
        sources: [{ name: "keyword", rank: 1 }],
      },
    ],
    warnings: [{ stage: "no_matches", message: "Nothing else matched" }],
    queryText: "q",
    tsQuery: "q",
    belowCutoff: 2,
    ...overrides,
  };
}

function makeRun(overrides: Partial<AnalysisRunResult> = {}): AnalysisRunResult {
  return {
    status: "SUCCESS",
    model: "test-model",
    latencyMs: 120,
    failure: null,
    validated: {
      accepted: {
        hypotheses: [
          { cause: "Worn bearing", rationale: "r", confidence: "LOW", citations: [{ type: "manual", id: "pump-4-2" }] },
          { cause: "Misalignment", rationale: "r", confidence: "LOW", citations: [{ type: "event", id: "11" }] },
        ],
        followUpQuestions: [{ question: "Is it louder under load?", citations: [] }],
        inspectionSteps: [
          { instruction: "Isolate and lock out, then check bearing", citations: [{ type: "manual", id: "pump-4-2" }] },
          { instruction: "Check coupling", citations: [{ type: "event", id: "11" }] },
          { instruction: "Check mounts", citations: [{ type: "event", id: "12" }] },
        ],
        priority: "HIGH",
        priorityRationale: "rationale",
        draftWorkOrder: { title: "Inspect pump", description: "desc" },
        limitations: [],
      },
      dropped: [{ kind: "hypothesis", index: 2, reason: "bad citation" }],
      notes: ["a note"],
      priorityRaisedByFloor: true,
    },
    allowed: { manual: ["pump-4-2"], event: ["11", "12"], threshold: [] },
    promptChunkIds: ["pump-4-2"],
    rawOutput: null,
    degradedReasons: ["1 item(s) dropped"],
    ...overrides,
  };
}

const SAVED: SaveAnalysisResult = { runId: 55, workOrderAction: "created", workOrderId: 9, versionNumber: 1 };

function makeDeps(
  overrides: Partial<OrchestrateDeps> = {},
  calls: string[] = [],
): OrchestrateDeps & { [K in "loadReport" | "retrieve" | "analyze" | "save"]: ReturnType<typeof vi.fn> } {
  let clock = 1000;
  const deps = {
    loadReport: vi.fn(async () => {
      calls.push("loadReport");
      return makeReport();
    }),
    retrieve: vi.fn(async () => {
      calls.push("retrieve");
      return makeRetrieval();
    }),
    analyze: vi.fn(async () => {
      calls.push("analyze");
      return makeRun();
    }),
    save: vi.fn(async () => {
      calls.push("save");
      return SAVED;
    }),
    now: () => (clock += 50),
    ...overrides,
  };
  return deps as never;
}

describe("analyzeReport", () => {
  it("builds the analysis input and passes the run, mode and warnings to save", async () => {
    const deps = makeDeps();
    const result = await analyzeReport(deps, { reportId: 7, actor: "Asha Rao" });

    expect(deps.retrieve).toHaveBeenCalledWith(
      expect.objectContaining({ equipmentType: "PUMP", issue: "Pump is noisy" }),
    );
    const input = deps.analyze.mock.calls[0][0];
    expect(input.equipment).toEqual({ type: "PUMP", tag: "P-101", name: "Cooling pump" });
    expect(input.issue).toBe("Pump is noisy");
    expect(input.priorityFloor).toBeNull();
    expect(input.retrievalMode).toBe("HYBRID");
    expect(input.events).toEqual([
      { id: 11, occurredAt: new Date("2026-01-01T10:00:00Z"), description: "Noise started" },
      { id: 12, occurredAt: null, description: "Operator restarted it" },
    ]);
    expect(input.chunks).toEqual([
      { id: "pump-4-2", sectionRef: "4.2", heading: "Bearings", content: "Check bearing wear." },
    ]);
    expect(input.answeredQuestions).toEqual([{ question: "Any leaks?", answer: "No" }]);

    const run = await deps.analyze.mock.results[0].value;
    expect(deps.save).toHaveBeenCalledWith({
      reportId: 7,
      equipmentId: 3,
      actor: "Asha Rao",
      run,
      retrievalMode: "HYBRID",
      retrievalWarnings: [{ stage: "no_matches", message: "Nothing else matched" }],
    });

    expect(result.run).toBe(run);
    expect(result.saved).toBe(SAVED);
    expect(result.retrieval).toEqual({
      mode: "HYBRID",
      belowCutoff: 2,
      chunkIds: ["pump-4-2"],
      warnings: [{ stage: "no_matches", message: "Nothing else matched" }],
    });
    expect(result.totalMs).toBeGreaterThan(0);
  });

  it("sets floor HIGH for one CRITICAL reading and URGENT for two", async () => {
    const one = makeDeps({
      loadReport: vi.fn(async () =>
        makeReport({ readings: [reading("vibration", 9, "mm/s"), reading("bearing_temperature", 50, "°C")] }),
      ),
    });
    await analyzeReport(one, { reportId: 7, actor: "Asha Rao" });
    expect(one.analyze.mock.calls[0][0].priorityFloor).toBe("HIGH");

    const two = makeDeps({
      loadReport: vi.fn(async () =>
        makeReport({ readings: [reading("vibration", 9, "mm/s"), reading("bearing_temperature", 95, "°C")] }),
      ),
    });
    await analyzeReport(two, { reportId: 7, actor: "Asha Rao" });
    expect(two.analyze.mock.calls[0][0].priorityFloor).toBe("URGENT");
  });

  it("recomputes thresholds from the readings", async () => {
    const deps = makeDeps({
      loadReport: vi.fn(async () =>
        makeReport({ readings: [reading("vibration", 9, "mm/s"), reading("bearing_temperature", 75, "°C")] }),
      ),
    });
    await analyzeReport(deps, { reportId: 7, actor: "Asha Rao" });

    const retrieved = deps.retrieve.mock.calls[0][0];
    expect(retrieved.events).toEqual([{ description: "Noise started" }, { description: "Operator restarted it" }]);
    expect(retrieved.thresholds).toEqual(
      expect.arrayContaining([
        { sensor: "vibration", status: "CRITICAL" },
        { sensor: "bearing_temperature", status: "WARNING" },
      ]),
    );
    expect(retrieved.thresholds.every((t: object) => Object.keys(t).length === 2)).toBe(true);

    const analyzed = deps.analyze.mock.calls[0][0].thresholds;
    expect(analyzed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ruleId: "PUMP.vibration", status: "CRITICAL", observedValue: 9 }),
        expect.objectContaining({ ruleId: "PUMP.bearing_temperature", status: "WARNING", observedValue: 75 }),
      ]),
    );
  });

  it("throws ServiceNotFoundError for a missing report and calls nothing else", async () => {
    const deps = makeDeps({ loadReport: vi.fn(async () => null) });
    const error = await analyzeReport(deps, { reportId: 99, actor: "Asha Rao" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceNotFoundError);
    expect((error as ServiceNotFoundError).what).toBe("report");
    expect(deps.retrieve).not.toHaveBeenCalled();
    expect(deps.analyze).not.toHaveBeenCalled();
    expect(deps.save).not.toHaveBeenCalled();
  });

  it("continues with mode NONE and a fixed warning when retrieve throws", async () => {
    const deps = makeDeps({
      retrieve: vi.fn(async () => {
        throw new Error(`postgres://user:${SENTINEL}@host/db`);
      }),
    });
    const result = await analyzeReport(deps, { reportId: 7, actor: "Asha Rao" });

    const input = deps.analyze.mock.calls[0][0];
    expect(input.retrievalMode).toBe("NONE");
    expect(input.chunks).toEqual([]);
    const warnings = [{ stage: "keyword", message: "Retrieval failed unexpectedly" }];
    expect(deps.save.mock.calls[0][0].retrievalMode).toBe("NONE");
    expect(deps.save.mock.calls[0][0].retrievalWarnings).toEqual(warnings);
    expect(result.retrieval).toEqual({ mode: "NONE", belowCutoff: 0, chunkIds: [], warnings });
    expect(JSON.stringify([input, deps.save.mock.calls[0][0], result.retrieval])).not.toContain(SENTINEL);
  });

  it("passes a retrieval result with mode NONE through", async () => {
    const deps = makeDeps({
      retrieve: vi.fn(async () =>
        makeRetrieval({ mode: "NONE", chunks: [], warnings: [{ stage: "embedding", message: "no embeddings" }] }),
      ),
    });
    const result = await analyzeReport(deps, { reportId: 7, actor: "Asha Rao" });
    expect(deps.analyze.mock.calls[0][0].retrievalMode).toBe("NONE");
    expect(deps.save.mock.calls[0][0].retrievalMode).toBe("NONE");
    expect(deps.save.mock.calls[0][0].retrievalWarnings).toEqual([{ stage: "embedding", message: "no embeddings" }]);
    expect(result.retrieval.mode).toBe("NONE");
  });

  it("propagates a save failure unchanged", async () => {
    const failure = new Error("save failed");
    const deps = makeDeps({
      save: vi.fn(async () => {
        throw failure;
      }),
    });
    await expect(analyzeReport(deps, { reportId: 7, actor: "Asha Rao" })).rejects.toBe(failure);
  });

  it("calls loadReport, retrieve, analyze, save in order", async () => {
    const calls: string[] = [];
    const deps = makeDeps({}, calls);
    await analyzeReport(deps, { reportId: 7, actor: "Asha Rao" });
    expect(calls).toEqual(["loadReport", "retrieve", "analyze", "save"]);
  });
});

function makeResult(
  run: AnalysisRunResult,
  retrieval: AnalyzeReportResult["retrieval"],
): AnalyzeReportResult & { reportId: number } {
  return { reportId: 7, run, saved: SAVED, retrieval, totalMs: 300 };
}

const GOOD_RETRIEVAL: AnalyzeReportResult["retrieval"] = {
  mode: "HYBRID",
  belowCutoff: 2,
  chunkIds: ["pump-4-2", "pump-4-3"],
  warnings: [{ stage: "no_matches", message: "ok" }],
};

describe("analysisLogFields", () => {
  it("reports counts for a successful run", () => {
    const fields = analysisLogFields(makeResult(makeRun({ degradedReasons: [] }), GOOD_RETRIEVAL));
    expect(fields).toEqual({
      reportId: 7,
      runId: 55,
      status: "SUCCESS",
      model: "test-model",
      latencyMs: 120,
      totalMs: 300,
      retrievalMode: "HYBRID",
      belowCutoff: 2,
      chunkCount: 2,
      retrievalWarningStages: "no_matches",
      failureStage: "none",
      degradedReasonCount: 0,
      droppedCount: 1,
      hypothesisCount: 2,
      questionCount: 1,
      stepCount: 3,
      workOrderAction: "created",
      priority: "HIGH",
      priorityRaisedByFloor: true,
    });
  });

  it("reports a degraded run with joined warning stages", () => {
    const fields = analysisLogFields(
      makeResult(makeRun({ status: "DEGRADED", degradedReasons: ["a", "b"] }), {
        mode: "KEYWORD_ONLY",
        belowCutoff: 0,
        chunkIds: [],
        warnings: [
          { stage: "embedding", message: "x" },
          { stage: "similarity", message: "y" },
        ],
      }),
    );
    expect(fields.status).toBe("DEGRADED");
    expect(fields.retrievalMode).toBe("KEYWORD_ONLY");
    expect(fields.chunkCount).toBe(0);
    expect(fields.retrievalWarningStages).toBe("embedding,similarity");
    expect(fields.degradedReasonCount).toBe(2);
  });

  it("reports a failed run with defaults", () => {
    const fields = analysisLogFields(
      makeResult(
        makeRun({
          status: "FAILED",
          failure: { stage: "request", message: "The model request failed" },
          validated: null,
          degradedReasons: [],
        }),
        { mode: "NONE", belowCutoff: 0, chunkIds: [], warnings: [] },
      ),
    );
    expect(fields).toMatchObject({
      status: "FAILED",
      failureStage: "request",
      droppedCount: 0,
      hypothesisCount: 0,
      questionCount: 0,
      stepCount: 0,
      priority: "none",
      priorityRaisedByFloor: false,
      retrievalWarningStages: "",
    });
  });

  it("holds only primitives and never any report, model, failure, warning or chunk text", async () => {
    const calls: string[] = [];
    const base = makeRun();
    const run = makeRun({
      failure: { stage: "parse", message: `failure ${SENTINEL}` },
      validated: {
        ...base.validated!,
        accepted: {
          ...base.validated!.accepted,
          hypotheses: [{ cause: `cause ${SENTINEL}`, rationale: SENTINEL, confidence: "LOW", citations: [] }],
        },
        notes: [SENTINEL],
      },
      rawOutput: { text: SENTINEL },
    });
    const deps = makeDeps(
      {
        loadReport: vi.fn(async () =>
          makeReport({
            issue: `issue ${SENTINEL}`,
            events: [{ id: 1, occurredAt: null, description: `event ${SENTINEL}` }],
          }),
        ),
        retrieve: vi.fn(async () =>
          makeRetrieval({
            chunks: [{ ...makeRetrieval().chunks[0], content: `chunk ${SENTINEL}`, heading: SENTINEL }],
            warnings: [{ stage: "no_matches", message: `warning ${SENTINEL}` }],
          }),
        ),
        analyze: vi.fn(async () => run),
      },
      calls,
    );
    const result = await analyzeReport(deps, { reportId: 7, actor: "Asha Rao" });
    const fields = analysisLogFields({ ...result, reportId: 7 });

    for (const value of Object.values(fields)) {
      expect(["string", "number", "boolean"]).toContain(typeof value);
      expect(String(value)).not.toContain(SENTINEL);
    }
    expect(JSON.stringify(fields)).not.toContain(SENTINEL);
  });
});
