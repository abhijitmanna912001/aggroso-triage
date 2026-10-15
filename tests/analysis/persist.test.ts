import { describe, expect, it } from "vitest";
import type { PrismaClient } from "../../generated/prisma/client";
import { saveAnalysis, type Json, type PersistDb, type PersistTx, type SaveAnalysisInput } from "../../lib/analysis/persist";
import type { AnalysisRunResult } from "../../lib/analysis/run";

// Compile-time check: the real client satisfies PersistDb without a cast.
export const assignabilityCheck = (client: PrismaClient): PersistDb => client;

const SENTINEL = "SENTINEL-failure-text-7f3a";

type Call = { method: string; args: unknown; inTransaction: boolean };
type StoredVersion = { workOrderId: number; versionNumber: number; source: "AI" | "TECHNICIAN"; priority: string; editedBy: string | null; title: string; description: string };
type StoredWorkOrder = { id: number; reportId: number; status: "DRAFT" | "APPROVED" | "REJECTED" };

function makeFake(seed?: { workOrder: StoredWorkOrder; versions: StoredVersion[] }) {
  const calls: Call[] = [];
  const transactionOptions: unknown[] = [];
  const workOrders: StoredWorkOrder[] = seed ? [seed.workOrder] : [];
  const versions: StoredVersion[] = seed ? [...seed.versions] : [];
  const runs: Record<string, unknown>[] = [];
  const history: Record<string, unknown>[] = [];
  let inTx = false;
  let nextId = 100;

  const rec = (method: string, args: unknown) => calls.push({ method, args, inTransaction: inTx });

  const tx: PersistTx = {
    analysisRun: {
      async create(args) {
        rec("analysisRun.create", args);
        runs.push(args.data);
        return { id: nextId++ };
      },
    },
    hypothesis: { async createMany(args) { rec("hypothesis.createMany", args); } },
    followUpQuestion: { async createMany(args) { rec("followUpQuestion.createMany", args); } },
    inspectionStep: { async createMany(args) { rec("inspectionStep.createMany", args); } },
    workOrder: {
      async findUnique(args) {
        rec("workOrder.findUnique", args);
        const wo = workOrders.find((w) => w.reportId === args.where.reportId);
        if (!wo) return null;
        const latest = versions
          .filter((v) => v.workOrderId === wo.id)
          .sort((a, b) => b.versionNumber - a.versionNumber)
          .slice(0, 1)
          .map((v) => ({ versionNumber: v.versionNumber, source: v.source }));
        return { id: wo.id, status: wo.status, versions: latest };
      },
      async create(args) {
        rec("workOrder.create", args);
        const wo = { id: nextId++, reportId: args.data.reportId, status: args.data.status };
        workOrders.push(wo);
        return { id: wo.id };
      },
    },
    workOrderVersion: {
      async create(args) {
        rec("workOrderVersion.create", args);
        versions.push({ ...args.data });
      },
    },
    historyEntry: {
      async createMany(args) {
        rec("historyEntry.createMany", args);
        history.push(...args.data);
      },
    },
  };

  const db: PersistDb = {
    ...tx,
    async $transaction(fn, options) {
      calls.push({ method: "$transaction", args: options, inTransaction: false });
      transactionOptions.push(options);
      inTx = true;
      try {
        return await fn(tx);
      } finally {
        inTx = false;
      }
    },
  };
  return { db, calls, transactionOptions, workOrders, versions, runs, history };
}

function makeRun(overrides: Partial<AnalysisRunResult> = {}): AnalysisRunResult {
  return {
    status: "SUCCESS",
    model: "test-model",
    latencyMs: 1234,
    failure: null,
    validated: {
      accepted: {
        hypotheses: [
          { cause: "Worn bearing", rationale: "Noise", confidence: "MEDIUM", citations: [{ type: "manual", id: "pump-4-2" }] },
          { cause: "Misalignment", rationale: "Vibration", confidence: "LOW", citations: [{ type: "event", id: "7" }, { type: "manual", id: "pump-4-3" }] },
        ],
        followUpQuestions: [{ question: "When did it start?", citations: [{ type: "threshold", id: "PUMP.vibration" }] }],
        inspectionSteps: [
          { instruction: "Isolate and lock out", citations: [{ type: "manual", id: "pump-4-2" }] },
          { instruction: "Check bearing", citations: [{ type: "manual", id: "pump-4-2" }] },
        ],
        priority: "HIGH",
        priorityRationale: "Vibration",
        draftWorkOrder: { title: "P-101 inspection", description: "Inspection steps:\n1. Isolate and lock out" },
        limitations: [],
      },
      dropped: [{ kind: "step", index: 2, reason: "no valid citation" }],
      notes: ["hypothesis 1: removed 1 invalid or duplicate citation(s)"],
      priorityRaisedByFloor: true,
    },
    allowed: { manual: [], event: [], threshold: [] },
    promptChunkIds: ["pump-4-2", "pump-4-3"],
    rawOutput: { some: "output" },
    degradedReasons: ["1 item(s) dropped"],
    ...overrides,
  };
}

function failedRun(): AnalysisRunResult {
  return makeRun({
    status: "FAILED",
    failure: { stage: "request", message: SENTINEL },
    validated: null,
    rawOutput: null,
    degradedReasons: [],
    promptChunkIds: ["pump-4-2"],
  });
}

function emptyRun(): AnalysisRunResult {
  const base = makeRun();
  return makeRun({
    status: "DEGRADED",
    validated: {
      ...base.validated!,
      accepted: { ...base.validated!.accepted, hypotheses: [], inspectionSteps: [], followUpQuestions: [] },
    },
    degradedReasons: ["no possible cause survived validation"],
  });
}

function makeInput(run: AnalysisRunResult, overrides: Partial<SaveAnalysisInput> = {}): SaveAnalysisInput {
  return {
    reportId: 5,
    equipmentId: 9,
    actor: "Alex",
    run,
    retrievalMode: "HYBRID",
    retrievalWarnings: [],
    ...overrides,
  };
}

const WORK_ORDER_WRITES = ["workOrder.create", "workOrderVersion.create"];
const writesOf = (calls: Call[], names: string[]) => calls.filter((c) => names.includes(c.method));

function seedWorkOrder(status: StoredWorkOrder["status"], latestSource: "AI" | "TECHNICIAN", latestNumber = 1) {
  return {
    workOrder: { id: 50, reportId: 5, status },
    versions: [
      { workOrderId: 50, versionNumber: latestNumber, source: latestSource, priority: "LOW", editedBy: latestSource === "AI" ? null : "Sam", title: "t", description: "d" },
    ] satisfies StoredVersion[],
  };
}

describe("saveAnalysis", () => {
  it("stores a failed run and an ANALYSIS_FAILED entry and touches no work order", async () => {
    const fake = makeFake();
    const result = await saveAnalysis(fake.db, makeInput(failedRun()));

    expect(result).toEqual({ runId: 100, workOrderAction: "skipped_failed", workOrderId: null, versionNumber: null });
    expect(fake.runs).toHaveLength(1);
    expect(fake.runs[0]).toMatchObject({ status: "FAILED", errorStage: "request", errorMessage: SENTINEL, retrievedChunkIds: ["pump-4-2"] });
    expect(fake.calls.filter((c) => c.method.startsWith("workOrder"))).toHaveLength(0);
    expect(fake.calls.filter((c) => /^(hypothesis|followUpQuestion|inspectionStep)\./.test(c.method))).toHaveLength(0);
    expect(fake.history).toHaveLength(1);
    expect(fake.history[0]).toMatchObject({ type: "ANALYSIS_FAILED", actor: "Alex", equipmentId: 9, reportId: 5, summary: "Analysis run 100 failed at stage request" });
    expect(fake.history[0].details).toEqual({ runId: 100, model: "test-model", latencyMs: 1234 });
  });

  it("saves a successful run with items, a DRAFT work order version 1 and history", async () => {
    const fake = makeFake();
    const result = await saveAnalysis(fake.db, makeInput(makeRun()));

    expect(result).toEqual({ runId: 100, workOrderAction: "created", workOrderId: 101, versionNumber: 1 });
    expect(fake.runs[0]).toMatchObject({
      reportId: 5,
      status: "SUCCESS",
      retrievalMode: "HYBRID",
      model: "test-model",
      retrievedChunkIds: ["pump-4-2", "pump-4-3"],
      errorStage: null,
      errorMessage: null,
      latencyMs: 1234,
      rawOutput: { some: "output" },
    });

    const call = (name: string) => fake.calls.find((c) => c.method === name)!.args as { data: Record<string, unknown>[] };
    expect(call("hypothesis.createMany").data).toEqual([
      { reportId: 5, runId: 100, cause: "Worn bearing", rationale: "Noise", confidence: "MEDIUM", citations: [{ type: "manual", id: "pump-4-2" }], status: "PROPOSED" },
      { reportId: 5, runId: 100, cause: "Misalignment", rationale: "Vibration", confidence: "LOW", citations: [{ type: "event", id: "7" }, { type: "manual", id: "pump-4-3" }], status: "PROPOSED" },
    ]);
    expect(call("followUpQuestion.createMany").data).toEqual([
      { reportId: 5, runId: 100, question: "When did it start?", citations: [{ type: "threshold", id: "PUMP.vibration" }] },
    ]);
    expect(call("inspectionStep.createMany").data).toEqual([
      { reportId: 5, runId: 100, position: 1, instruction: "Isolate and lock out", citations: [{ type: "manual", id: "pump-4-2" }] },
      { reportId: 5, runId: 100, position: 2, instruction: "Check bearing", citations: [{ type: "manual", id: "pump-4-2" }] },
    ]);

    expect(fake.workOrders).toEqual([{ id: 101, reportId: 5, status: "DRAFT" }]);
    expect(fake.versions).toEqual([
      { workOrderId: 101, versionNumber: 1, title: "P-101 inspection", description: "Inspection steps:\n1. Isolate and lock out", priority: "HIGH", source: "AI", editedBy: null },
    ]);

    expect(fake.history.map((h) => h.type)).toEqual(["ANALYSIS_RUN", "WORK_ORDER_DRAFTED"]);
    expect(fake.history[0].summary).toBe("Analysis run 100: SUCCESS, 2 possible causes, 2 steps (test-model)");
    expect(fake.history[1].summary).toBe("AI draft work order version 1 created");
    expect(fake.history[1].details).toEqual({ workOrderId: 101, versionNumber: 1, source: "AI" });
    expect(fake.calls.filter((c) => c.method === "historyEntry.createMany")).toHaveLength(1);
  });

  it("appends version 2 to a DRAFT whose latest version is AI", async () => {
    const fake = makeFake(seedWorkOrder("DRAFT", "AI"));
    const result = await saveAnalysis(fake.db, makeInput(makeRun()));

    expect(result).toEqual({ runId: 100, workOrderAction: "new_version", workOrderId: 50, versionNumber: 2 });
    expect(writesOf(fake.calls, ["workOrder.create"])).toHaveLength(0);
    expect(fake.versions.map((v) => v.versionNumber)).toEqual([1, 2]);
    expect(fake.versions[1]).toMatchObject({ source: "AI", editedBy: null, workOrderId: 50 });
    expect(fake.workOrders[0].status).toBe("DRAFT");
    expect(fake.history.map((h) => h.type)).toEqual(["ANALYSIS_RUN", "WORK_ORDER_DRAFTED"]);
    expect(fake.history[1].summary).toBe("AI draft work order version 2 created");
  });

  it("changes nothing when the latest version of a DRAFT is a technician edit", async () => {
    const fake = makeFake(seedWorkOrder("DRAFT", "TECHNICIAN", 3));
    const result = await saveAnalysis(fake.db, makeInput(makeRun()));

    expect(result).toEqual({ runId: 100, workOrderAction: "skipped_technician_edits", workOrderId: 50, versionNumber: null });
    expect(writesOf(fake.calls, WORK_ORDER_WRITES)).toHaveLength(0);
    expect(fake.versions).toHaveLength(1);
    expect(fake.history.map((h) => h.type)).toEqual(["ANALYSIS_RUN"]);
    // The AI items are still saved.
    expect(fake.calls.some((c) => c.method === "hypothesis.createMany")).toBe(true);
  });

  it.each(["APPROVED", "REJECTED"] as const)("changes nothing for a %s work order", async (status) => {
    const fake = makeFake(seedWorkOrder(status, "AI"));
    const result = await saveAnalysis(fake.db, makeInput(makeRun()));

    expect(result).toEqual({ runId: 100, workOrderAction: "skipped_decided", workOrderId: 50, versionNumber: null });
    expect(writesOf(fake.calls, WORK_ORDER_WRITES)).toHaveLength(0);
    expect(fake.workOrders[0].status).toBe(status);
    expect(fake.versions).toHaveLength(1);
  });

  it("stores a DEGRADED run with nothing to propose and writes no work order", async () => {
    const fake = makeFake();
    const result = await saveAnalysis(fake.db, makeInput(emptyRun()));

    expect(result).toEqual({ runId: 100, workOrderAction: "skipped_nothing_to_propose", workOrderId: null, versionNumber: null });
    expect(fake.runs[0]).toMatchObject({ status: "DEGRADED" });
    expect(fake.calls.filter((c) => c.method.startsWith("workOrder"))).toHaveLength(0);
    expect(fake.calls.filter((c) => /^(hypothesis|followUpQuestion|inspectionStep)\./.test(c.method))).toHaveLength(0);
    expect(fake.history.map((h) => h.type)).toEqual(["ANALYSIS_RUN"]);
    expect(fake.history[0].summary).toBe("Analysis run 100: DEGRADED, 0 possible causes, 0 steps (test-model)");
  });

  it("never creates a work order with a status other than DRAFT", async () => {
    const scenarios = [
      makeFake(),
      makeFake(),
      makeFake(seedWorkOrder("DRAFT", "AI")),
      makeFake(seedWorkOrder("DRAFT", "TECHNICIAN")),
      makeFake(seedWorkOrder("APPROVED", "AI")),
      makeFake(seedWorkOrder("REJECTED", "AI")),
    ];
    const runs = [makeRun(), failedRun(), makeRun(), makeRun(), makeRun(), makeRun()];
    for (let i = 0; i < scenarios.length; i++) {
      await saveAnalysis(scenarios[i].db, makeInput(runs[i]));
      for (const call of scenarios[i].calls.filter((c) => c.method === "workOrder.create")) {
        expect((call.args as { data: { status: string } }).data.status).toBe("DRAFT");
      }
    }
  });

  it("omits rawOutput when it is null and includes it otherwise", async () => {
    const withNull = makeFake();
    await saveAnalysis(withNull.db, makeInput(failedRun()));
    expect("rawOutput" in withNull.runs[0]).toBe(false);

    const withValue = makeFake();
    await saveAnalysis(withValue.db, makeInput(makeRun()));
    expect("rawOutput" in withValue.runs[0]).toBe(true);
  });

  it("stores the expected validationNotes", async () => {
    const warnings = [{ stage: "embedding", message: "Embeddings unavailable" }];
    const fake = makeFake();
    await saveAnalysis(fake.db, makeInput(makeRun(), { retrievalMode: "KEYWORD_ONLY", retrievalWarnings: warnings }));

    expect(fake.runs[0].retrievalMode).toBe("KEYWORD_ONLY");
    expect(fake.runs[0].validationNotes).toEqual({
      dropped: [{ kind: "step", index: 2, reason: "no valid citation" }],
      notes: ["hypothesis 1: removed 1 invalid or duplicate citation(s)"],
      degradedReasons: ["1 item(s) dropped"],
      priorityRaisedByFloor: true,
      retrievalWarnings: warnings,
      workOrderAction: "created",
    });

    const failed = makeFake();
    await saveAnalysis(failed.db, makeInput(failedRun(), { retrievalMode: "NONE" }));
    expect(failed.runs[0].validationNotes).toEqual({
      dropped: [],
      notes: [],
      degradedReasons: [],
      priorityRaisedByFloor: false,
      retrievalWarnings: [],
      workOrderAction: "skipped_failed",
    });
  });

  it("stores the priority that the floor raised", async () => {
    const base = makeRun();
    const raised = makeRun({
      validated: { ...base.validated!, accepted: { ...base.validated!.accepted, priority: "URGENT" }, priorityRaisedByFloor: true },
    });
    const fake = makeFake();
    await saveAnalysis(fake.db, makeInput(raised));
    expect(fake.versions[0].priority).toBe("URGENT");
  });

  it.each(["", "   ", "\t\n"])("throws before any db call for actor %j", async (actor) => {
    const fake = makeFake();
    await expect(saveAnalysis(fake.db, makeInput(makeRun(), { actor }))).rejects.toThrow();
    expect(fake.calls).toHaveLength(0);
  });

  it("stores the trimmed actor", async () => {
    const fake = makeFake();
    await saveAnalysis(fake.db, makeInput(makeRun(), { actor: "  Alex  " }));
    expect(fake.history.every((h) => h.actor === "Alex")).toBe(true);
  });

  it("does everything inside one transaction with the timeout options", async () => {
    const fake = makeFake();
    await saveAnalysis(fake.db, makeInput(makeRun()));

    expect(fake.calls.filter((c) => c.method === "$transaction")).toHaveLength(1);
    expect(fake.transactionOptions).toEqual([{ timeout: 30_000, maxWait: 10_000 }]);
    const writes = fake.calls.filter((c) => c.method !== "$transaction");
    expect(writes.length).toBeGreaterThan(0);
    expect(writes.every((c) => c.inTransaction)).toBe(true);
  });

  it("keeps the failure message out of history and in the run row", async () => {
    const fake = makeFake();
    await saveAnalysis(fake.db, makeInput(failedRun()));

    expect(fake.runs[0].errorMessage).toBe(SENTINEL);
    expect(JSON.stringify(fake.history as Json)).not.toContain(SENTINEL);
  });
});
