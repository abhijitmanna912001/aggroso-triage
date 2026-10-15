// Pure module: no "server-only", no "@/" alias, no logging. Every message here is fixed text. An error's own message
// is never read, because it could carry a connection string or text a user typed.
import { AnalysisConfigError } from "../analysis/run";
import { ReportValidationError, ServiceConflictError, ServiceNotFoundError, type ConflictCode } from "../reports/errors";

export type ActionResult =
  | { ok: true; message: string | null; redirectTo: string | null }
  | { ok: false; formError: string | null; fieldErrors: Record<string, string[]> };

export function actionOk(options?: { message?: string; redirectTo?: string }): ActionResult {
  return { ok: true, message: options?.message ?? null, redirectTo: options?.redirectTo ?? null };
}

export function actionFailure(formError: string | null, fieldErrors: Record<string, string[]> = {}): ActionResult {
  return { ok: false, formError, fieldErrors };
}

const CONFLICT_MESSAGES: Record<ConflictCode, string> = {
  stale_version: "This work order changed since you opened it. Reload and review the latest version.",
  already_decided: "This work order has already been approved or rejected.",
  no_draft: "This work order is no longer a draft, so it cannot be edited.",
  already_answered: "This question has already been answered.",
  wrong_report: "That possible cause does not belong to this report.",
};

const MESSAGES = {
  validation: "Check the highlighted fields.",
  notFound: "That item was not found. Reload the page.",
  notConfigured: "Analysis is not configured on this server.",
  analysis: "The analysis could not be completed or saved. Try again.",
  general: "Something went wrong. Try again.",
} as const;

export function toActionFailure(error: unknown, context: "analysis" | "general"): ActionResult {
  try {
    if (error instanceof ReportValidationError) {
      return actionFailure(MESSAGES.validation, error.fieldErrors);
    }
    if (error instanceof ServiceConflictError) {
      return actionFailure(CONFLICT_MESSAGES[error.code] ?? MESSAGES.general);
    }
    if (error instanceof ServiceNotFoundError) {
      return actionFailure(MESSAGES.notFound);
    }
    if (context === "analysis" && error instanceof AnalysisConfigError) {
      return actionFailure(MESSAGES.notConfigured);
    }
  } catch {
    // Fall through to the generic message below.
  }
  return actionFailure(context === "analysis" ? MESSAGES.analysis : MESSAGES.general);
}

// Safe to log: the error class name and, for a conflict, its code. Never any message text.
export function errorLogFields(error: unknown): { errorName: string; errorCode: string | null } {
  return {
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorCode: error instanceof ServiceConflictError ? error.code : null,
  };
}
