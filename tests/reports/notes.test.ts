import { describe, expect, it } from "vitest";
import type { PrismaClient } from "../../generated/prisma/client";
import { ReportValidationError, ServiceConflictError, ServiceNotFoundError } from "../../lib/reports/errors";
import { addObservation, answerQuestion, confirmFinding, type NotesDb, type NotesTx } from "../../lib/reports/notes";

// Compile-time check: the real client satisfies NotesDb without a cast.
export const assignabilityCheck = (client: PrismaClient): NotesDb => client;

const SENTINEL = "SENTINEL-user-text-9f3a";
const NOW = new Date("2026-03-01T10:00:00Z");

type State = {
  report?: { equipmentId: number } | null;
  hypotheses?: Record<number, { reportId: number }>;
  question?: { reportId: number; report: { equipmentId: number } } | null;
  updateCount?: number;
};

function makeFake(state: State = {}) {
  const calls: { method: string; inTransaction: boolean }[] = [];
  const transactionOptions: unknown[] = [];
  const observations: Record<string, unknown>[] = [];
  const findings: Record<string, unknown>[] = [];
  const history: Record<string, unknown>[] = [];
  const answers: Record<string, unknown>[] = [];
  const hypotheses = state.hypotheses ?? {};
  const hypothesesBefore = JSON.stringify(hypotheses);
  let inTx = false;
  const rec = (method: string) => calls.push({ method, inTransaction: inTx });

  const tx: NotesTx = {
    report: {
      async findUnique() {
        rec("report.findUnique");
        return state.report === undefined ? { equipmentId: 3 } : state.report;
      },
    },
    hypothesis: {
      async findUnique(args) {
        rec("hypothesis.findUnique");
        return hypotheses[args.where.id] ?? null;
      },
    },
    followUpQuestion: {
      async findUnique() {
        rec("followUpQuestion.findUnique");
        return state.question === undefined ? { reportId: 5, report: { equipmentId: 3 } } : state.question;
      },
      async updateMany(args) {
        rec("followUpQuestion.updateMany");
        const count = state.updateCount ?? 1;
        if (count > 0) answers.push({ ...args.data, where: args.where });
        return { count };
      },
    },
    observation: {
      async create(args) {
        rec("observation.create");
        observations.push(args.data);
        return { id: 11 };
      },
    },
    finding: {
      async create(args) {
        rec("finding.create");
        findings.push(args.data);
        return { id: 21 };
      },
    },
    historyEntry: {
      async create(args) {
        rec("historyEntry.create");
        history.push(args.data);
        return {};
      },
    },
  };

  const db: NotesDb = {
    ...tx,
    async $transaction(fn, options) {
      transactionOptions.push(options);
      inTx = true;
      try {
        return await fn(tx);
      } finally {
        inTx = false;
      }
    },
  };
  return { db, calls, transactionOptions, observations, findings, history, answers, hypothesesUnchanged: () => JSON.stringify(hypotheses) === hypothesesBefore };
}

describe("addObservation", () => {
  it("creates the observation and a history entry without its text", async () => {
    const f = makeFake();
    const result = await addObservation(f.db, { reportId: 5, text: ` ${SENTINEL} `, recordedBy: " Sam ", now: NOW });
    expect(result).toEqual({ observationId: 11 });
    expect(f.observations).toEqual([{ reportId: 5, text: SENTINEL, recordedBy: "Sam" }]);
    expect(f.history).toEqual([
      {
        equipmentId: 3,
        reportId: 5,
        type: "OBSERVATION_ADDED",
        actor: "Sam",
        summary: "Observation added",
        details: { observationId: 11 },
      },
    ]);
    expect(JSON.stringify(f.history)).not.toContain(SENTINEL);
  });

  it("fails when the report is missing", async () => {
    const f = makeFake({ report: null });
    await expect(addObservation(f.db, { reportId: 5, text: "x", recordedBy: "Sam", now: NOW })).rejects.toBeInstanceOf(
      ServiceNotFoundError,
    );
    expect(f.observations).toHaveLength(0);
  });

  it("collects field errors before any db call", async () => {
    const f = makeFake();
    const error = await addObservation(f.db, { reportId: 5, text: "  ", recordedBy: " ", now: NOW }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ReportValidationError);
    expect(Object.keys((error as ReportValidationError).fieldErrors).sort()).toEqual(["actor", "text"]);
    expect(f.calls).toEqual([]);
  });

  it("rejects text over 1000 characters and runs in one transaction", async () => {
    const f = makeFake();
    await expect(
      addObservation(f.db, { reportId: 5, text: "x".repeat(1001), recordedBy: "Sam", now: NOW }),
    ).rejects.toBeInstanceOf(ReportValidationError);
    await addObservation(f.db, { reportId: 5, text: "ok", recordedBy: "Sam", now: NOW });
    expect(f.transactionOptions).toEqual([{ timeout: 30_000, maxWait: 10_000 }]);
    expect(f.calls.every((c) => c.inTransaction)).toBe(true);
  });
});

describe("confirmFinding", () => {
  it("confirms a finding without a hypothesis", async () => {
    const f = makeFake();
    const result = await confirmFinding(f.db, {
      reportId: 5,
      description: SENTINEL,
      confirmedBy: "Sam",
      hypothesisId: null,
      now: NOW,
    });
    expect(result).toEqual({ findingId: 21 });
    expect(f.findings).toEqual([{ reportId: 5, hypothesisId: null, description: SENTINEL, confirmedBy: "Sam" }]);
    expect(f.history).toEqual([
      {
        equipmentId: 3,
        reportId: 5,
        type: "FINDING_CONFIRMED",
        actor: "Sam",
        summary: "Finding confirmed",
        details: { findingId: 21, hypothesisId: null },
      },
    ]);
    expect(JSON.stringify(f.history)).not.toContain(SENTINEL);
    expect(f.calls.some((c) => c.method.startsWith("hypothesis"))).toBe(false);
  });

  it("links a hypothesis from the same report and leaves it unchanged", async () => {
    const f = makeFake({ hypotheses: { 7: { reportId: 5 } } });
    await confirmFinding(f.db, { reportId: 5, description: "Worn seal", confirmedBy: "Sam", hypothesisId: 7, now: NOW });
    expect(f.findings[0]).toMatchObject({ hypothesisId: 7 });
    expect(f.history[0]).toMatchObject({ details: { findingId: 21, hypothesisId: 7 } });
    expect(f.hypothesesUnchanged()).toBe(true);
  });

  it("rejects a hypothesis from another report", async () => {
    const f = makeFake({ hypotheses: { 7: { reportId: 6 } } });
    const error = await confirmFinding(f.db, {
      reportId: 5,
      description: "Worn seal",
      confirmedBy: "Sam",
      hypothesisId: 7,
      now: NOW,
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceConflictError);
    expect((error as ServiceConflictError).code).toBe("wrong_report");
    expect(f.findings).toHaveLength(0);
    expect(f.history).toHaveLength(0);
  });

  it("fails for a missing report or hypothesis", async () => {
    const noReport = makeFake({ report: null });
    await expect(
      confirmFinding(noReport.db, { reportId: 5, description: "d", confirmedBy: "Sam", hypothesisId: null, now: NOW }),
    ).rejects.toBeInstanceOf(ServiceNotFoundError);
    const noHypothesis = makeFake();
    await expect(
      confirmFinding(noHypothesis.db, { reportId: 5, description: "d", confirmedBy: "Sam", hypothesisId: 99, now: NOW }),
    ).rejects.toMatchObject({ what: "hypothesis" });
  });

  it("needs a named technician and a description", async () => {
    const f = makeFake();
    const error = await confirmFinding(f.db, {
      reportId: 5,
      description: "",
      confirmedBy: "  ",
      hypothesisId: null,
      now: NOW,
    }).catch((e: unknown) => e);
    expect(Object.keys((error as ReportValidationError).fieldErrors).sort()).toEqual(["actor", "description"]);
    expect(f.calls).toEqual([]);
  });
});

describe("answerQuestion", () => {
  it("records the answer and a history entry without its text", async () => {
    const f = makeFake();
    const result = await answerQuestion(f.db, { questionId: 4, answer: ` ${SENTINEL} `, answeredBy: " Sam ", now: NOW });
    expect(result).toEqual({ questionId: 4 });
    expect(f.answers).toEqual([
      { answer: SENTINEL, answeredBy: "Sam", answeredAt: NOW, where: { id: 4, answer: null } },
    ]);
    expect(f.history).toEqual([
      {
        equipmentId: 3,
        reportId: 5,
        type: "QUESTION_ANSWERED",
        actor: "Sam",
        summary: "Follow-up question answered",
        details: { questionId: 4 },
      },
    ]);
    expect(JSON.stringify(f.history)).not.toContain(SENTINEL);
    expect(f.transactionOptions).toEqual([{ timeout: 30_000, maxWait: 10_000 }]);
    expect(f.calls.every((c) => c.inTransaction)).toBe(true);
  });

  it("fails with already_answered when the conditional write matches nothing", async () => {
    const f = makeFake({ updateCount: 0 });
    await expect(
      answerQuestion(f.db, { questionId: 4, answer: "yes", answeredBy: "Sam", now: NOW }),
    ).rejects.toMatchObject({ code: "already_answered" });
    expect(f.history).toHaveLength(0);
  });

  it("fails when the question is missing", async () => {
    const f = makeFake({ question: null });
    await expect(
      answerQuestion(f.db, { questionId: 4, answer: "yes", answeredBy: "Sam", now: NOW }),
    ).rejects.toBeInstanceOf(ServiceNotFoundError);
  });

  it("collects field errors before any db call", async () => {
    const f = makeFake();
    const error = await answerQuestion(f.db, { questionId: 4, answer: " ", answeredBy: "\t", now: NOW }).catch(
      (e: unknown) => e,
    );
    expect(Object.keys((error as ReportValidationError).fieldErrors).sort()).toEqual(["actor", "answer"]);
    expect(f.calls).toEqual([]);
  });
});

describe("errors", () => {
  it("never carry user text in their messages", () => {
    const codes = ["stale_version", "already_decided", "no_draft", "already_answered", "wrong_report"] as const;
    for (const code of codes) expect(new ServiceConflictError(code).message).not.toContain(SENTINEL);
    expect(new ServiceNotFoundError("report").message).toBe("Not found");
  });
});
