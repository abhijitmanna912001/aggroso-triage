"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { analysisLogFields, analyzeReport } from "@/lib/analysis/orchestrate";
import { createReport } from "@/lib/reports/create";
import { ReportValidationError } from "@/lib/reports/errors";
import { addObservation, answerQuestion, confirmFinding } from "@/lib/reports/notes";
import { parseReportForm } from "@/lib/reports/schema";
import { approveWorkOrder, editWorkOrder, rejectWorkOrder } from "@/lib/reports/workorder";
import { actionFailure, actionOk, errorLogFields, toActionFailure, type ActionResult } from "@/lib/server/action-result";
import { createAnalysisDeps } from "@/lib/server/analysis-wiring";
import {
  parseAnswerForm,
  parseDecisionForm,
  parseFindingForm,
  parseObservationForm,
  parseReportIdForm,
  parseTechnicianForm,
  parseWorkOrderEditForm,
  type FormResult,
} from "@/lib/server/forms";
import { clearTechnicianCookie, requireTechnician, setTechnicianCookie } from "@/lib/server/session";

// A "use server" file may only export async functions, so everything below the exports stays private.
// No action calls redirect(): it throws a control-flow error that a catch would swallow. The client navigates to
// redirectTo instead.

async function run(context: "analysis" | "general", work: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof Error && error.name === "NotSignedInError") {
      return actionFailure("Choose your name first.");
    }
    // Class name and conflict code only. The error message may hold connection details or user text.
    logger.warn(errorLogFields(error), "server action failed");
    return toActionFailure(error, context);
  }
}

function invalid(result: Extract<FormResult<unknown>, { ok: false }>): ActionResult {
  return actionFailure(result.formError, result.fieldErrors);
}

function reportPath(reportId: number): string {
  return `/reports/${reportId}`;
}

export async function selectTechnicianAction(formData: FormData): Promise<ActionResult> {
  return run("general", async () => {
    const parsed = parseTechnicianForm(formData);
    if (!parsed.ok) return invalid(parsed);
    await setTechnicianCookie(parsed.data.name);
    return actionOk();
  });
}

// The FormData parameter keeps the signature the same as every other action, so it can be used as a form action.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function signOutAction(_formData: FormData): Promise<ActionResult> {
  return run("general", async () => {
    await clearTechnicianCookie();
    return actionOk();
  });
}

export async function createReportAction(formData: FormData): Promise<ActionResult> {
  return run("general", async () => {
    const technician = await requireTechnician();
    // Any submitted reportedBy is ignored: the signed-in name is the only one used.
    const trusted = new FormData();
    for (const [key, value] of formData.entries()) {
      if (key !== "reportedBy") trusted.append(key, value);
    }
    trusted.set("reportedBy", technician);
    const parsed = parseReportForm(trusted);
    if (!parsed.ok) return actionFailure(parsed.formError, parsed.fieldErrors);
    const created = await createReport(prisma, parsed.data);
    revalidatePath("/");
    return actionOk({ redirectTo: reportPath(created.reportId) });
  });
}

export async function analyzeReportAction(formData: FormData): Promise<ActionResult> {
  return run("analysis", async () => {
    const actor = await requireTechnician();
    const parsed = parseReportIdForm(formData);
    if (!parsed.ok) return invalid(parsed);
    const { reportId } = parsed.data;
    const result = await analyzeReport(createAnalysisDeps(), { reportId, actor });
    logger.info(analysisLogFields({ ...result, reportId }), "analysis finished");
    revalidatePath(reportPath(reportId));
    return actionOk({
      message: result.run.status === "FAILED" ? "Analysis failed: see the details below" : "Analysis finished",
    });
  });
}

export async function editWorkOrderAction(formData: FormData): Promise<ActionResult> {
  return run("general", async () => {
    const actor = await requireTechnician();
    const parsed = parseWorkOrderEditForm(formData);
    if (!parsed.ok) return invalid(parsed);
    await editWorkOrder(prisma, { ...parsed.data, actor, now: new Date() });
    revalidatePath(reportPath(parsed.data.reportId));
    return actionOk({ message: "Work order saved" });
  });
}

export async function approveWorkOrderAction(formData: FormData): Promise<ActionResult> {
  return run("general", async () => {
    const actor = await requireTechnician();
    const parsed = parseDecisionForm(formData);
    if (!parsed.ok) return invalid(parsed);
    await approveWorkOrder(prisma, { ...parsed.data, actor, now: new Date() });
    revalidatePath(reportPath(parsed.data.reportId));
    return actionOk({ message: "Work order approved" });
  });
}

export async function rejectWorkOrderAction(formData: FormData): Promise<ActionResult> {
  return run("general", async () => {
    const actor = await requireTechnician();
    const parsed = parseDecisionForm(formData);
    if (!parsed.ok) return invalid(parsed);
    // A rejection always needs a note. The service checks its length; here only a missing one is caught.
    if (parsed.data.note === null) {
      throw new ReportValidationError({ note: ["Enter a note (3 to 500 characters)"] });
    }
    await rejectWorkOrder(prisma, { ...parsed.data, note: parsed.data.note, actor, now: new Date() });
    revalidatePath(reportPath(parsed.data.reportId));
    return actionOk({ message: "Work order rejected" });
  });
}

export async function addObservationAction(formData: FormData): Promise<ActionResult> {
  return run("general", async () => {
    const recordedBy = await requireTechnician();
    const parsed = parseObservationForm(formData);
    if (!parsed.ok) return invalid(parsed);
    await addObservation(prisma, { reportId: parsed.data.reportId, text: parsed.data.text, recordedBy, now: new Date() });
    revalidatePath(reportPath(parsed.data.reportId));
    return actionOk({ message: "Observation added" });
  });
}

export async function confirmFindingAction(formData: FormData): Promise<ActionResult> {
  return run("general", async () => {
    const confirmedBy = await requireTechnician();
    const parsed = parseFindingForm(formData);
    if (!parsed.ok) return invalid(parsed);
    await confirmFinding(prisma, { ...parsed.data, confirmedBy, now: new Date() });
    revalidatePath(reportPath(parsed.data.reportId));
    return actionOk({ message: "Finding confirmed" });
  });
}

export async function answerQuestionAction(formData: FormData): Promise<ActionResult> {
  return run("general", async () => {
    const answeredBy = await requireTechnician();
    const parsed = parseAnswerForm(formData);
    if (!parsed.ok) return invalid(parsed);
    await answerQuestion(prisma, {
      questionId: parsed.data.questionId,
      answer: parsed.data.answer,
      answeredBy,
      now: new Date(),
    });
    revalidatePath(reportPath(parsed.data.reportId));
    return actionOk({ message: "Answer saved" });
  });
}
