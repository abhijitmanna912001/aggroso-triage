import { describe, expect, it } from "vitest";
import type { PrismaClient } from "../../generated/prisma/client";
import {
  ReportValidationError,
  ServiceConflictError,
  ServiceNotFoundError,
} from "../../lib/reports/errors";
import {
  approveWorkOrder,
  editWorkOrder,
  rejectWorkOrder,
  type WorkOrderDb,
  type WorkOrderTx,
} from "../../lib/reports/workorder";

// Compile-time check: the real client satisfies WorkOrderDb without a cast.
export const assignabilityCheck = (client: PrismaClient): WorkOrderDb => client;

const SENTINEL = "SENTINEL-user-text-9f3a";
const NOW = new Date("2026-03-01T10:00:00Z");

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type VersionRow = { versionNumber: number; title: string; description: string; priority: Priority };
type State = {
  report: { equipmentId: number } | null;
  workOrder: { id: number; status: "DRAFT" | "APPROVED" | "REJECTED"; versions: VersionRow[] } | null;
  updateCount?: number;
  // Runs right after a successful lock or status write: simulates another request that committed in between.
  afterLock?: (state: State) => void;
};

function makeFake(state: State) {
  const calls: { method: string; inTransaction: boolean }[] = [];
  const transactionOptions: unknown[] = [];
  const versions: Record<string, unknown>[] = [];
  const history: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const locks: Record<string, unknown>[] = [];
  let inTx = false;
  const rec = (method: string) => calls.push({ method, inTransaction: inTx });

  const tx: WorkOrderTx = {
    report: {
      async findUnique() {
        rec("report.findUnique");
        return state.report;
      },
    },
    workOrder: {
      async findUnique() {
        rec("workOrder.findUnique");
        if (state.workOrder === null) return null;
        const latest = [...state.workOrder.versions].sort((a, b) => b.versionNumber - a.versionNumber).slice(0, 1);
        return { id: state.workOrder.id, status: state.workOrder.status, versions: latest };
      },
      async updateMany(args) {
        rec("workOrder.updateMany");
        // Like the database: the where clause matches only a work order that is still DRAFT.
        const count = state.updateCount ?? (state.workOrder?.status === "DRAFT" ? 1 : 0);
        if (count > 0) {
          if ("status" in args.data) {
            updates.push({ ...args.data, where: args.where });
            if (state.workOrder !== null) state.workOrder.status = args.data.status;
          } else {
            locks.push({ ...args.data, where: args.where });
          }
          state.afterLock?.(state);
        }
        return { count };
      },
    },
    workOrderVersion: {
      async create(args) {
        rec("workOrderVersion.create");
        versions.push(args.data);
        return {};
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

  const db: WorkOrderDb = {
    ...tx,
    async $transaction(fn, options) {
      transactionOptions.push(options);
      // Snapshot, and restore if the callback throws: a rollback, like the database.
      const snapshot = {
        workOrder: structuredClone(state.workOrder),
        versions: [...versions],
        history: [...history],
        updates: [...updates],
        locks: [...locks],
      };
      inTx = true;
      try {
        return await fn(tx);
      } catch (error) {
        state.workOrder = snapshot.workOrder;
        versions.splice(0, versions.length, ...snapshot.versions);
        history.splice(0, history.length, ...snapshot.history);
        updates.splice(0, updates.length, ...snapshot.updates);
        locks.splice(0, locks.length, ...snapshot.locks);
        throw error;
      } finally {
        inTx = false;
      }
    },
  };
  return { db, state, calls, transactionOptions, versions, history, updates, locks };
}

const methods = (f: { calls: { method: string }[] }) => f.calls.map((c) => c.method);

// The lock or status write must come before the second work order read (the fresh latest-version read).
function expectWriteBeforeLatestRead(f: { calls: { method: string }[] }) {
  const order = methods(f);
  const write = order.indexOf("workOrder.updateMany");
  const reads = order.flatMap((m, i) => (m === "workOrder.findUnique" ? [i] : []));
  expect(write).toBeGreaterThan(-1);
  expect(reads).toHaveLength(2);
  expect(write).toBeGreaterThan(reads[0]!);
  expect(write).toBeLessThan(reads[1]!);
}

// Another request commits version 2 after our lock was taken.
const moveOn = (s: State) => {
  s.workOrder!.versions.push({ versionNumber: 2, title: "Other", description: "Other text", priority: "LOW" });
};

describe("fake transaction", () => {
  it("restores state and logs when the callback throws", async () => {
    const f = makeFake(draft());
    const error = await f.db
      .$transaction(
        async (tx) => {
          await tx.workOrder.updateMany({ where: { id: 9, status: "DRAFT" }, data: { updatedAt: NOW } });
          await tx.workOrder.updateMany({
            where: { id: 9, status: "DRAFT" },
            data: { status: "APPROVED", decidedBy: "Sam", decidedAt: NOW, decidedVersion: 1, decisionNote: null },
          });
          await tx.historyEntry.create({
            data: { equipmentId: 3, reportId: 5, type: "WORK_ORDER_APPROVED", actor: "Sam", summary: "x", details: {} },
          });
          expect(f.state.workOrder!.status).toBe("APPROVED");
          throw new Error("boom");
        },
        { timeout: 1, maxWait: 1 },
      )
      .catch((e: unknown) => e);
    expect((error as Error).message).toBe("boom");
    expect(f.state.workOrder!.status).toBe("DRAFT");
    expect(f.updates).toHaveLength(0);
    expect(f.locks).toHaveLength(0);
    expect(f.history).toHaveLength(0);
  });
});

const v1: VersionRow = { versionNumber: 1, title: "Replace seal", description: "Seal is leaking", priority: "MEDIUM" };
const draft = (): State => ({
  report: { equipmentId: 3 },
  workOrder: { id: 9, status: "DRAFT", versions: [{ ...v1 }] },
});

const edit = { reportId: 5, actor: " Sam ", title: "New title", description: "New text", priority: "HIGH" as const, expectedVersion: 1, now: NOW };

describe("editWorkOrder", () => {
  it("creates version 2 by the technician and writes history", async () => {
    const f = makeFake(draft());
    const result = await editWorkOrder(f.db, edit);
    expect(result).toEqual({ versionNumber: 2, changed: true });
    expect(f.versions).toEqual([
      {
        workOrderId: 9,
        versionNumber: 2,
        title: "New title",
        description: "New text",
        priority: "HIGH",
        source: "TECHNICIAN",
        editedBy: "Sam",
      },
    ]);
    expect(f.history).toEqual([
      {
        equipmentId: 3,
        reportId: 5,
        type: "WORK_ORDER_EDITED",
        actor: "Sam",
        summary: "Work order edited: version 2",
        details: { workOrderId: 9, versionNumber: 2 },
      },
    ]);
  });

  it("writes nothing when nothing changed after trimming", async () => {
    const f = makeFake(draft());
    const result = await editWorkOrder(f.db, {
      ...edit,
      title: "  Replace seal ",
      description: "Seal is leaking  ",
      priority: "MEDIUM",
    });
    expect(result).toEqual({ versionNumber: 1, changed: false });
    // The lock write is allowed; no version, history or decision is written.
    expect(f.calls.filter((c) => c.method.endsWith(".create"))).toEqual([]);
    expect(f.updates).toEqual([]);
  });

  it("rejects a stale version", async () => {
    const f = makeFake(draft());
    await expect(editWorkOrder(f.db, { ...edit, expectedVersion: 0 })).rejects.toMatchObject({ code: "stale_version" });
    expect(f.versions).toHaveLength(0);
  });

  it("takes the row lock before the fresh latest-version read", async () => {
    const f = makeFake(draft());
    await editWorkOrder(f.db, edit);
    expectWriteBeforeLatestRead(f);
    expect(f.locks).toEqual([{ updatedAt: NOW, where: { id: 9, status: "DRAFT" } }]);
  });

  it("rejects a version that moved on after the lock and writes nothing", async () => {
    const f = makeFake({ ...draft(), afterLock: moveOn });
    await expect(editWorkOrder(f.db, edit)).rejects.toMatchObject({ code: "stale_version" });
    expect(f.versions).toHaveLength(0);
    expect(f.history).toHaveLength(0);
    expect(f.locks).toHaveLength(0);
  });

  it.each(["APPROVED", "REJECTED"] as const)("gets lock count 0 on a %s work order and reads no version", async (status) => {
    const state = draft();
    state.workOrder!.status = status;
    const f = makeFake(state);
    await expect(editWorkOrder(f.db, edit)).rejects.toMatchObject({ code: "no_draft" });
    expect(methods(f).filter((m) => m === "workOrder.findUnique")).toHaveLength(1);
    expect(f.versions).toHaveLength(0);
    expect(f.history).toHaveLength(0);
  });

  it("fails when the report or the work order does not exist", async () => {
    const noReport = makeFake({ report: null, workOrder: null });
    await expect(editWorkOrder(noReport.db, edit)).rejects.toBeInstanceOf(ServiceNotFoundError);
    const noOrder = makeFake({ report: { equipmentId: 3 }, workOrder: null });
    await expect(editWorkOrder(noOrder.db, edit)).rejects.toMatchObject({ what: "work order" });
  });

  it.each(["APPROVED", "REJECTED"] as const)("never edits a %s work order", async (status) => {
    const state = draft();
    state.workOrder!.status = status;
    const f = makeFake(state);
    const error = await editWorkOrder(f.db, edit).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServiceConflictError);
    expect((error as ServiceConflictError).code).toBe("no_draft");
    expect(f.versions).toHaveLength(0);
  });

  it("collects validation errors with field names before any db call", async () => {
    const f = makeFake(draft());
    const error = await editWorkOrder(f.db, {
      ...edit,
      actor: "   ",
      title: "",
      description: "x".repeat(8001),
      priority: "BOGUS" as never,
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ReportValidationError);
    expect(Object.keys((error as ReportValidationError).fieldErrors).sort()).toEqual([
      "actor",
      "description",
      "priority",
      "title",
    ]);
    expect(f.calls).toEqual([]);
    expect(f.transactionOptions).toEqual([]);
  });

  it("rejects a title over 120 characters", async () => {
    const f = makeFake(draft());
    await expect(editWorkOrder(f.db, { ...edit, title: "t".repeat(121) })).rejects.toBeInstanceOf(ReportValidationError);
  });

  it("runs every db call inside one transaction with the timeout options", async () => {
    const f = makeFake(draft());
    await editWorkOrder(f.db, edit);
    expect(f.transactionOptions).toEqual([{ timeout: 30_000, maxWait: 10_000 }]);
    expect(f.calls.every((c) => c.inTransaction)).toBe(true);
  });

  it("keeps user text out of history", async () => {
    const f = makeFake(draft());
    await editWorkOrder(f.db, { ...edit, title: SENTINEL, description: SENTINEL });
    expect(JSON.stringify(f.history)).not.toContain(SENTINEL);
  });
});

describe.each([
  { name: "approveWorkOrder", status: "APPROVED", type: "WORK_ORDER_APPROVED", word: "approved" },
  { name: "rejectWorkOrder", status: "REJECTED", type: "WORK_ORDER_REJECTED", word: "rejected" },
] as const)("$name", ({ status, type, word }) => {
  const run = (db: WorkOrderDb, extra: { actor?: string; expectedVersion?: number; note?: string | null } = {}) => {
    const input = { reportId: 5, actor: " Sam ", expectedVersion: 1, now: NOW };
    const note = extra.note === undefined ? "Looks fine to me" : extra.note;
    return status === "APPROVED"
      ? approveWorkOrder(db, { ...input, ...extra, note })
      : rejectWorkOrder(db, { ...input, ...extra, note: note as string });
  };

  it("records the decision on the work order", async () => {
    const f = makeFake(draft());
    const result = await run(f.db, { note: ` ${SENTINEL} ` });
    expect(result).toEqual({ versionNumber: 1 });
    expect(f.updates).toEqual([
      {
        where: { id: 9, status: "DRAFT" },
        status,
        decidedBy: "Sam",
        decidedAt: NOW,
        decidedVersion: 1,
        decisionNote: SENTINEL,
      },
    ]);
    expect(f.history).toEqual([
      {
        equipmentId: 3,
        reportId: 5,
        type,
        actor: "Sam",
        summary: `Work order ${word} (version 1)`,
        details: { workOrderId: 9, versionNumber: 1 },
      },
    ]);
    expect(JSON.stringify(f.history)).not.toContain(SENTINEL);
    expect(f.versions).toHaveLength(0);
  });

  it("rejects a stale version", async () => {
    const f = makeFake(draft());
    await expect(run(f.db, { expectedVersion: 2 })).rejects.toMatchObject({ code: "stale_version" });
    expect(f.updates).toHaveLength(0);
    expect(f.state.workOrder!.status).toBe("DRAFT");
  });

  it("does the status write before the fresh latest-version read", async () => {
    const f = makeFake(draft());
    await run(f.db);
    expectWriteBeforeLatestRead(f);
  });

  it("rolls back the status change when the version moved on after the lock", async () => {
    const f = makeFake({ ...draft(), afterLock: moveOn });
    await expect(run(f.db)).rejects.toMatchObject({ code: "stale_version" });
    expect(f.state.workOrder!.status).toBe("DRAFT");
    expect(f.updates).toHaveLength(0);
    expect(f.history).toHaveLength(0);
  });

  it("fails when the order is already decided", async () => {
    const state = draft();
    state.workOrder!.status = "APPROVED";
    const f = makeFake(state);
    await expect(run(f.db)).rejects.toMatchObject({ code: "already_decided" });
  });

  it("fails with already_decided when the conditional write matches nothing", async () => {
    // The pre-check saw a DRAFT, but another decision landed before the write.
    const f = makeFake({ ...draft(), updateCount: 0 });
    await expect(run(f.db)).rejects.toMatchObject({ code: "already_decided" });
    expect(f.history).toHaveLength(0);
  });

  it("needs a technician name before any db call", async () => {
    const f = makeFake(draft());
    const error = await run(f.db, { actor: "  \t " }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ReportValidationError);
    expect(Object.keys((error as ReportValidationError).fieldErrors)).toEqual(["actor"]);
    expect(f.calls).toEqual([]);
  });

  it("fails when the work order is missing", async () => {
    const f = makeFake({ report: { equipmentId: 3 }, workOrder: null });
    await expect(run(f.db)).rejects.toBeInstanceOf(ServiceNotFoundError);
  });

  it("runs inside one transaction with the timeout options", async () => {
    const f = makeFake(draft());
    await run(f.db);
    expect(f.transactionOptions).toEqual([{ timeout: 30_000, maxWait: 10_000 }]);
    expect(f.calls.every((c) => c.inTransaction)).toBe(true);
  });
});

describe("approve and reject notes", () => {
  it("accepts an approval without a note and stores null", async () => {
    const f = makeFake(draft());
    await approveWorkOrder(f.db, { reportId: 5, actor: "Sam", expectedVersion: 1, note: null, now: NOW });
    expect(f.updates[0]).toMatchObject({ status: "APPROVED", decisionNote: null });
  });

  it("rejects an approval note that is too short", async () => {
    const f = makeFake(draft());
    const error = await approveWorkOrder(f.db, {
      reportId: 5,
      actor: "Sam",
      expectedVersion: 1,
      note: "no",
      now: NOW,
    }).catch((e: unknown) => e);
    expect(Object.keys((error as ReportValidationError).fieldErrors)).toEqual(["note"]);
  });

  it("requires a note to reject", async () => {
    for (const note of ["", "   ", "ab"]) {
      const f = makeFake(draft());
      const error = await rejectWorkOrder(f.db, { reportId: 5, actor: "Sam", expectedVersion: 1, note, now: NOW }).catch(
        (e: unknown) => e,
      );
      expect(error).toBeInstanceOf(ReportValidationError);
      expect(Object.keys((error as ReportValidationError).fieldErrors)).toEqual(["note"]);
      expect(f.calls).toEqual([]);
    }
  });
});
