// Pure module: no "server-only", no "@/" alias, no logging. It does not import lib/db.ts; the database arrives as an
// argument. Only type imports from generated code. History summaries and details hold only ids, never text the user
// typed. A hypothesis is only read here: a possible cause is never itself confirmed, a Finding row is.
import type { HistoryType } from "../../generated/prisma/enums";
import type { Json } from "../analysis/persist";
import { ReportValidationError, ServiceConflictError, ServiceNotFoundError } from "./errors";

export const NOTE_LIMITS = { textMax: 1000 } as const;

export const NOTES_TRANSACTION_OPTIONS = { timeout: 30_000, maxWait: 10_000 } as const;

type HistoryData = {
  equipmentId: number;
  reportId: number;
  type: HistoryType;
  actor: string;
  summary: string;
  details: Json;
};

// Only the Prisma methods used inside the transaction. There is no hypothesis write method and no delete.
export type NotesTx = {
  report: {
    findUnique(args: { where: { id: number }; select: { equipmentId: true } }): Promise<{ equipmentId: number } | null>;
  };
  hypothesis: {
    findUnique(args: { where: { id: number }; select: { reportId: true } }): Promise<{ reportId: number } | null>;
  };
  followUpQuestion: {
    findUnique(args: {
      where: { id: number };
      select: { reportId: true; report: { select: { equipmentId: true } } };
    }): Promise<{ reportId: number; report: { equipmentId: number } } | null>;
    updateMany(args: {
      where: { id: number; answer: null };
      data: { answer: string; answeredBy: string; answeredAt: Date };
    }): Promise<{ count: number }>;
  };
  observation: {
    create(args: { data: { reportId: number; text: string; recordedBy: string } }): Promise<{ id: number }>;
  };
  finding: {
    create(args: {
      data: { reportId: number; hypothesisId: number | null; description: string; confirmedBy: string };
    }): Promise<{ id: number }>;
  };
  historyEntry: {
    create(args: { data: HistoryData }): Promise<unknown>;
  };
};

export type NotesDb = NotesTx & {
  $transaction<R>(fn: (tx: NotesTx) => Promise<R>, options: { timeout: number; maxWait: number }): Promise<R>;
};

const MESSAGES = {
  actor: "Enter your name",
  text: `Enter some text (1 to ${NOTE_LIMITS.textMax} characters)`,
  description: `Enter a description (1 to ${NOTE_LIMITS.textMax} characters)`,
  answer: `Enter an answer (1 to ${NOTE_LIMITS.textMax} characters)`,
} as const;

function validate(actorValue: string, field: "text" | "description" | "answer", value: string): { actor: string; value: string } {
  const actor = actorValue.trim();
  const trimmed = value.trim();
  const errors: Record<string, string[]> = {};
  if (actor === "") errors.actor = [MESSAGES.actor];
  if (trimmed.length < 1 || trimmed.length > NOTE_LIMITS.textMax) errors[field] = [MESSAGES[field]];
  if (Object.keys(errors).length > 0) throw new ReportValidationError(errors);
  return { actor, value: trimmed };
}

async function loadEquipmentId(tx: NotesTx, reportId: number): Promise<number> {
  const report = await tx.report.findUnique({ where: { id: reportId }, select: { equipmentId: true } });
  if (report === null) throw new ServiceNotFoundError("report");
  return report.equipmentId;
}

export type AddObservationInput = { reportId: number; text: string; recordedBy: string; now: Date };

export async function addObservation(db: NotesDb, input: AddObservationInput): Promise<{ observationId: number }> {
  const { actor, value: text } = validate(input.recordedBy, "text", input.text);
  const { reportId } = input;

  return db.$transaction(async (tx) => {
    const equipmentId = await loadEquipmentId(tx, reportId);
    const observation = await tx.observation.create({ data: { reportId, text, recordedBy: actor } });
    await tx.historyEntry.create({
      data: {
        equipmentId,
        reportId,
        type: "OBSERVATION_ADDED",
        actor,
        summary: "Observation added",
        details: { observationId: observation.id },
      },
    });
    return { observationId: observation.id };
  }, NOTES_TRANSACTION_OPTIONS);
}

export type ConfirmFindingInput = {
  reportId: number;
  description: string;
  confirmedBy: string;
  hypothesisId: number | null;
  now: Date;
};

export async function confirmFinding(db: NotesDb, input: ConfirmFindingInput): Promise<{ findingId: number }> {
  const { actor, value: description } = validate(input.confirmedBy, "description", input.description);
  const { reportId, hypothesisId } = input;

  return db.$transaction(async (tx) => {
    const equipmentId = await loadEquipmentId(tx, reportId);
    if (hypothesisId !== null) {
      const hypothesis = await tx.hypothesis.findUnique({ where: { id: hypothesisId }, select: { reportId: true } });
      if (hypothesis === null) throw new ServiceNotFoundError("hypothesis");
      if (hypothesis.reportId !== reportId) throw new ServiceConflictError("wrong_report");
    }
    const finding = await tx.finding.create({
      data: { reportId, hypothesisId, description, confirmedBy: actor },
    });
    await tx.historyEntry.create({
      data: {
        equipmentId,
        reportId,
        type: "FINDING_CONFIRMED",
        actor,
        summary: "Finding confirmed",
        details: { findingId: finding.id, hypothesisId },
      },
    });
    return { findingId: finding.id };
  }, NOTES_TRANSACTION_OPTIONS);
}

export type AnswerQuestionInput = { questionId: number; answer: string; answeredBy: string; now: Date };

export async function answerQuestion(db: NotesDb, input: AnswerQuestionInput): Promise<{ questionId: number }> {
  const { actor, value: answer } = validate(input.answeredBy, "answer", input.answer);
  const { questionId, now } = input;

  return db.$transaction(async (tx) => {
    const question = await tx.followUpQuestion.findUnique({
      where: { id: questionId },
      select: { reportId: true, report: { select: { equipmentId: true } } },
    });
    if (question === null) throw new ServiceNotFoundError("question");

    // One conditional write: only a question that is still unanswered can be answered.
    const result = await tx.followUpQuestion.updateMany({
      where: { id: questionId, answer: null },
      data: { answer, answeredBy: actor, answeredAt: now },
    });
    if (result.count === 0) throw new ServiceConflictError("already_answered");

    await tx.historyEntry.create({
      data: {
        equipmentId: question.report.equipmentId,
        reportId: question.reportId,
        type: "QUESTION_ANSWERED",
        actor,
        summary: "Follow-up question answered",
        details: { questionId },
      },
    });
    return { questionId };
  }, NOTES_TRANSACTION_OPTIONS);
}
