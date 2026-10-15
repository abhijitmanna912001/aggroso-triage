import { describe, expect, it } from "vitest";
import { AnalysisConfigError } from "../../lib/analysis/run";
import {
  ReportValidationError,
  ServiceConflictError,
  ServiceNotFoundError,
  type ConflictCode,
} from "../../lib/reports/errors";
import { actionFailure, actionOk, errorLogFields, toActionFailure } from "../../lib/server/action-result";

const SENTINEL = "postgresql://secret";
const CODES: ConflictCode[] = ["stale_version", "already_decided", "no_draft", "already_answered", "wrong_report"];
const CONFLICT_TEXT: Record<ConflictCode, string> = {
  stale_version: "This work order changed since you opened it. Reload and review the latest version.",
  already_decided: "This work order has already been approved or rejected.",
  no_draft: "This work order is no longer a draft, so it cannot be edited.",
  already_answered: "This question has already been answered.",
  wrong_report: "That possible cause does not belong to this report.",
};
const ANALYSIS_GENERIC = "The analysis could not be completed or saved. Try again.";
const GENERAL_GENERIC = "Something went wrong. Try again.";

describe("actionOk / actionFailure", () => {
  it("builds ok results with null defaults", () => {
    expect(actionOk()).toEqual({ ok: true, message: null, redirectTo: null });
    expect(actionOk({ message: "Saved", redirectTo: "/reports/1" })).toEqual({
      ok: true,
      message: "Saved",
      redirectTo: "/reports/1",
    });
  });

  it("builds failure results", () => {
    expect(actionFailure(null)).toEqual({ ok: false, formError: null, fieldErrors: {} });
    expect(actionFailure("Bad", { a: ["x"] })).toEqual({ ok: false, formError: "Bad", fieldErrors: { a: ["x"] } });
  });
});

describe("toActionFailure", () => {
  for (const context of ["analysis", "general"] as const) {
    it(`maps ReportValidationError (${context})`, () => {
      const fieldErrors = { issue: ["Describe the issue"] };
      expect(toActionFailure(new ReportValidationError(fieldErrors), context)).toEqual({
        ok: false,
        formError: "Check the highlighted fields.",
        fieldErrors,
      });
    });

    for (const code of CODES) {
      it(`maps conflict ${code} (${context})`, () => {
        expect(toActionFailure(new ServiceConflictError(code), context)).toEqual({
          ok: false,
          formError: CONFLICT_TEXT[code],
          fieldErrors: {},
        });
      });
    }

    it(`maps ServiceNotFoundError (${context})`, () => {
      expect(toActionFailure(new ServiceNotFoundError("report"), context)).toEqual({
        ok: false,
        formError: "That item was not found. Reload the page.",
        fieldErrors: {},
      });
    });

    it(`maps a plain Error and non-Error values (${context})`, () => {
      const expected = context === "analysis" ? ANALYSIS_GENERIC : GENERAL_GENERIC;
      for (const value of [new Error("boom"), "text", null, undefined, 42, { message: "x" }]) {
        expect(toActionFailure(value, context)).toEqual({ ok: false, formError: expected, fieldErrors: {} });
      }
    });
  }

  it("maps AnalysisConfigError only in the analysis context", () => {
    expect(toActionFailure(new AnalysisConfigError(), "analysis")).toEqual({
      ok: false,
      formError: "Analysis is not configured on this server.",
      fieldErrors: {},
    });
    expect(toActionFailure(new AnalysisConfigError(), "general")).toEqual({
      ok: false,
      formError: GENERAL_GENERIC,
      fieldErrors: {},
    });
  });

  it("never throws, even for hostile values", () => {
    const hostile = new Proxy({}, { get: () => { throw new Error(SENTINEL); } });
    expect(() => toActionFailure(hostile, "general")).not.toThrow();
  });

  it("never returns error message text", () => {
    const errors: unknown[] = [
      new Error(SENTINEL),
      new AnalysisConfigError(SENTINEL),
      new ServiceNotFoundError(SENTINEL),
      new ReportValidationError({}),
      new ServiceConflictError("stale_version"),
      SENTINEL,
    ];
    // Messages of the service errors are set by the class; also overwrite them to prove they are never read.
    const tampered = new ServiceConflictError("no_draft");
    tampered.message = SENTINEL;
    errors.push(tampered);
    for (const error of errors) {
      for (const context of ["analysis", "general"] as const) {
        expect(JSON.stringify(toActionFailure(error, context))).not.toContain(SENTINEL);
      }
      expect(JSON.stringify(errorLogFields(error))).not.toContain(SENTINEL);
    }
  });
});

describe("errorLogFields", () => {
  it("returns the code only for ServiceConflictError", () => {
    expect(errorLogFields(new ServiceConflictError("stale_version"))).toEqual({
      errorName: "ServiceConflictError",
      errorCode: "stale_version",
    });
    expect(errorLogFields(new ServiceNotFoundError("x"))).toEqual({
      errorName: "ServiceNotFoundError",
      errorCode: null,
    });
    expect(errorLogFields(new Error(SENTINEL))).toEqual({ errorName: "Error", errorCode: null });
    expect(errorLogFields(new AnalysisConfigError())).toEqual({ errorName: "AnalysisConfigError", errorCode: null });
  });

  it("uses UnknownError for non-Error values", () => {
    for (const value of ["x", null, undefined, 1, {}]) {
      expect(errorLogFields(value)).toEqual({ errorName: "UnknownError", errorCode: null });
    }
  });
});
