// Pure module: no "server-only", no "@/" alias, no logging. Messages are fixed text and never contain anything
// a user typed, so they are safe to show and to log.
export { ReportValidationError } from "./create";

export class ServiceNotFoundError extends Error {
  readonly what: string;

  constructor(what: string) {
    super("Not found");
    this.name = "ServiceNotFoundError";
    this.what = what;
  }
}

export type ConflictCode = "stale_version" | "already_decided" | "no_draft" | "already_answered" | "wrong_report";

const CONFLICT_MESSAGES: Record<ConflictCode, string> = {
  stale_version: "This work order changed since you opened it. Reload and review the latest version.",
  already_decided: "This work order has already been decided.",
  no_draft: "There is no draft work order to change.",
  already_answered: "This question has already been answered.",
  wrong_report: "That item belongs to a different report.",
};

export class ServiceConflictError extends Error {
  readonly code: ConflictCode;

  constructor(code: ConflictCode) {
    super(CONFLICT_MESSAGES[code]);
    this.name = "ServiceConflictError";
    this.code = code;
  }
}
