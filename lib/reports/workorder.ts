// Pure module: no "server-only", no "@/" alias, no logging. It does not import lib/db.ts; the database arrives as an
// argument. Only type imports from generated code. This is the only library file that sets a work order to
// APPROVED or REJECTED. History summaries and details hold only ids and version numbers, never text the user typed
// (the decision note lives on the work order row only).
import type { HistoryType, Priority, WorkOrderStatus } from "../../generated/prisma/enums";
import type { Json } from "../analysis/persist";
import { ReportValidationError, ServiceConflictError, ServiceNotFoundError } from "./errors";

// Priority values without a runtime import from generated code. The check below fails to compile if the enum changes.
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const satisfies readonly Priority[];
type MissingPriorities = Exclude<Priority, (typeof PRIORITIES)[number]>;
const priorityListIsComplete: [MissingPriorities] extends [never] ? true : false = true;
void priorityListIsComplete;

export const WORK_ORDER_LIMITS = {
  titleMax: 120,
  descriptionMax: 8000,
  noteMin: 3,
  noteMax: 500,
} as const;

export const WORK_ORDER_TRANSACTION_OPTIONS = { timeout: 30_000, maxWait: 10_000 } as const;

type DecisionStatus = "APPROVED" | "REJECTED";

type LatestVersion = { versionNumber: number; title: string; description: string; priority: Priority };

// Only the Prisma methods used inside the transaction. There is no update, delete or deleteMany method, so a
// version or a history row can never be changed or removed from here.
export type WorkOrderTx = {
  report: {
    findUnique(args: { where: { id: number }; select: { equipmentId: true } }): Promise<{ equipmentId: number } | null>;
  };
  workOrder: {
    findUnique(args: {
      where: { reportId: number };
      select: {
        id: true;
        status: true;
        versions: {
          orderBy: { versionNumber: "desc" };
          take: 1;
          select: { versionNumber: true; title: true; description: true; priority: true };
        };
      };
    }): Promise<{ id: number; status: WorkOrderStatus; versions: LatestVersion[] } | null>;
    // Two shapes: the decision write, and the row lock (touches updatedAt only). No update, delete or upsert.
    updateMany(args: {
      where: { id: number; status: "DRAFT" };
      data:
        | {
            status: DecisionStatus;
            decidedBy: string;
            decidedAt: Date;
            decidedVersion: number;
            decisionNote: string | null;
          }
        | { updatedAt: Date };
    }): Promise<{ count: number }>;
  };
  workOrderVersion: {
    create(args: {
      data: {
        workOrderId: number;
        versionNumber: number;
        title: string;
        description: string;
        priority: Priority;
        source: "TECHNICIAN";
        editedBy: string;
      };
    }): Promise<unknown>;
  };
  historyEntry: {
    create(args: {
      data: {
        equipmentId: number;
        reportId: number;
        type: HistoryType;
        actor: string;
        summary: string;
        details: Json;
      };
    }): Promise<unknown>;
  };
};

export type WorkOrderDb = WorkOrderTx & {
  $transaction<R>(
    fn: (tx: WorkOrderTx) => Promise<R>,
    options: { timeout: number; maxWait: number },
  ): Promise<R>;
};

export type EditWorkOrderInput = {
  reportId: number;
  actor: string;
  title: string;
  description: string;
  priority: Priority;
  expectedVersion: number;
  now: Date;
};

export type EditWorkOrderResult = { versionNumber: number; changed: boolean };

export type DecideWorkOrderInput = {
  reportId: number;
  actor: string;
  expectedVersion: number;
  note: string | null;
  now: Date;
};

export type RejectWorkOrderInput = Omit<DecideWorkOrderInput, "note"> & { note: string };

export type DecideWorkOrderResult = { versionNumber: number };

const MESSAGES = {
  actor: "Enter your name",
  title: `Enter a title (1 to ${WORK_ORDER_LIMITS.titleMax} characters)`,
  description: `Enter a description (1 to ${WORK_ORDER_LIMITS.descriptionMax} characters)`,
  priority: "Choose a priority",
  note: `Enter a note (${WORK_ORDER_LIMITS.noteMin} to ${WORK_ORDER_LIMITS.noteMax} characters)`,
} as const;

function checkLength(value: string, min: number, max: number): boolean {
  return value.length >= min && value.length <= max;
}

function failIfAny(errors: Record<string, string[]>): void {
  if (Object.keys(errors).length > 0) throw new ReportValidationError(errors);
}

// Serialization: edits and decisions on one work order both start with an UPDATE of that row (the lock, or the status
// change itself). Under READ COMMITTED, other transactions touching the row wait until this one commits or rolls back.
// Only after that write is the latest version read, so the read is fresh and cannot be overtaken.
const LATEST_VERSION_SELECT = {
  id: true,
  status: true,
  versions: {
    orderBy: { versionNumber: "desc" },
    take: 1,
    select: { versionNumber: true, title: true, description: true, priority: true },
  },
} as const;

// Existence checks only. The status and versions read here may be out of date and are not used for decisions.
async function findOrder(tx: WorkOrderTx, reportId: number) {
  const report = await tx.report.findUnique({ where: { id: reportId }, select: { equipmentId: true } });
  if (report === null) throw new ServiceNotFoundError("report");
  const workOrder = await tx.workOrder.findUnique({ where: { reportId }, select: LATEST_VERSION_SELECT });
  if (workOrder === null) throw new ServiceNotFoundError("work order");
  return { equipmentId: report.equipmentId, workOrderId: workOrder.id };
}

// Fresh read of the latest version. Call it only after the lock or status write, then compare with expectedVersion.
async function readLatestVersion(tx: WorkOrderTx, reportId: number, expectedVersion: number): Promise<LatestVersion> {
  const workOrder = await tx.workOrder.findUnique({ where: { reportId }, select: LATEST_VERSION_SELECT });
  if (workOrder === null) throw new ServiceNotFoundError("work order");
  const latest = workOrder.versions[0];
  if (latest === undefined) throw new ServiceNotFoundError("work order version");
  if (latest.versionNumber !== expectedVersion) throw new ServiceConflictError("stale_version");
  return latest;
}

export async function editWorkOrder(db: WorkOrderDb, input: EditWorkOrderInput): Promise<EditWorkOrderResult> {
  const actor = input.actor.trim();
  const title = input.title.trim();
  const description = input.description.trim();
  const errors: Record<string, string[]> = {};
  if (actor === "") errors.actor = [MESSAGES.actor];
  if (!checkLength(title, 1, WORK_ORDER_LIMITS.titleMax)) errors.title = [MESSAGES.title];
  if (!checkLength(description, 1, WORK_ORDER_LIMITS.descriptionMax)) errors.description = [MESSAGES.description];
  if (!(PRIORITIES as readonly string[]).includes(input.priority)) errors.priority = [MESSAGES.priority];
  failIfAny(errors);

  // input.now is part of the shared call shape; version rows get their timestamp from the database default.
  const { reportId, expectedVersion, priority } = input;

  return db.$transaction(async (tx) => {
    const { equipmentId, workOrderId } = await findOrder(tx, reportId);

    // Row lock, held until the transaction ends. Count 0 means the work order is no longer a draft.
    const lock = await tx.workOrder.updateMany({
      where: { id: workOrderId, status: "DRAFT" },
      data: { updatedAt: input.now },
    });
    if (lock.count === 0) throw new ServiceConflictError("no_draft");

    const latest = await readLatestVersion(tx, reportId, expectedVersion);

    if (latest.title === title && latest.description === description && latest.priority === priority) {
      return { versionNumber: latest.versionNumber, changed: false };
    }

    const versionNumber = latest.versionNumber + 1;
    await tx.workOrderVersion.create({
      data: { workOrderId, versionNumber, title, description, priority, source: "TECHNICIAN", editedBy: actor },
    });
    await tx.historyEntry.create({
      data: {
        equipmentId,
        reportId,
        type: "WORK_ORDER_EDITED",
        actor,
        summary: `Work order edited: version ${versionNumber}`,
        details: { workOrderId, versionNumber },
      },
    });
    return { versionNumber, changed: true };
  }, WORK_ORDER_TRANSACTION_OPTIONS);
}

async function decide(
  db: WorkOrderDb,
  status: DecisionStatus,
  input: { reportId: number; actor: string; expectedVersion: number; note: string | null; now: Date },
): Promise<DecideWorkOrderResult> {
  const actor = input.actor.trim();
  const trimmedNote = input.note === null ? "" : input.note.trim();
  const errors: Record<string, string[]> = {};
  if (actor === "") errors.actor = [MESSAGES.actor];
  // A rejection needs a note; an approval note is optional but, when given, has the same limits.
  const noteRequired = status === "REJECTED";
  if ((noteRequired || trimmedNote !== "") && !checkLength(trimmedNote, WORK_ORDER_LIMITS.noteMin, WORK_ORDER_LIMITS.noteMax)) {
    errors.note = [MESSAGES.note];
  }
  failIfAny(errors);

  const decisionNote = trimmedNote === "" ? null : trimmedNote;
  const { reportId, expectedVersion, now } = input;

  return db.$transaction(async (tx) => {
    const { equipmentId, workOrderId } = await findOrder(tx, reportId);

    // One conditional write, first: only a work order that is still DRAFT can be decided, so two people deciding at
    // the same time cannot both succeed. It also takes the row lock, so no edit can land before this transaction ends.
    const result = await tx.workOrder.updateMany({
      where: { id: workOrderId, status: "DRAFT" },
      data: { status, decidedBy: actor, decidedAt: now, decidedVersion: expectedVersion, decisionNote },
    });
    if (result.count === 0) throw new ServiceConflictError("already_decided");

    // A stale version throws here, so the transaction rolls back and the status change above is undone.
    await readLatestVersion(tx, reportId, expectedVersion);

    await tx.historyEntry.create({
      data: {
        equipmentId,
        reportId,
        type: status === "APPROVED" ? "WORK_ORDER_APPROVED" : "WORK_ORDER_REJECTED",
        actor,
        summary:
          status === "APPROVED"
            ? `Work order approved (version ${expectedVersion})`
            : `Work order rejected (version ${expectedVersion})`,
        details: { workOrderId, versionNumber: expectedVersion },
      },
    });
    return { versionNumber: expectedVersion };
  }, WORK_ORDER_TRANSACTION_OPTIONS);
}

export function approveWorkOrder(db: WorkOrderDb, input: DecideWorkOrderInput): Promise<DecideWorkOrderResult> {
  return decide(db, "APPROVED", input);
}

export function rejectWorkOrder(db: WorkOrderDb, input: RejectWorkOrderInput): Promise<DecideWorkOrderResult> {
  return decide(db, "REJECTED", input);
}
