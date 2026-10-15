// Pure module: no "server-only", no "@/" alias, no logging. Parsers turn FormData into typed input. Messages are fixed
// text and never contain anything that was submitted. Length rules stay in the services.
import type { Priority } from "../../generated/prisma/enums";
import { isTechnician } from "../technicians";

// Priority values without a runtime import from generated code. The check below fails to compile if the enum changes.
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const satisfies readonly Priority[];
type MissingPriorities = Exclude<Priority, (typeof PRIORITIES)[number]>;
const priorityListIsComplete: [MissingPriorities] extends [never] ? true : false = true;
void priorityListIsComplete;

export type FormResult<T> =
  | { ok: true; data: T }
  | { ok: false; fieldErrors: Record<string, string[]>; formError: string | null };

const MESSAGES = {
  required: "This field is required",
  integer: "Enter a whole number greater than zero",
  priority: "Choose a priority",
  technician: "Choose a name from the list",
} as const;

// A missing field, or a file instead of text, reads as blank.
function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function toPositiveInt(raw: string): number | null {
  if (!/^[0-9]+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

// Collects errors per field so one result can report all of them.
class Fields {
  readonly errors: Record<string, string[]> = {};
  constructor(private readonly formData: FormData) {}

  private fail(name: string, message: string): void {
    this.errors[name] = [message];
  }

  // Passed through untrimmed; blank or whitespace-only is an error.
  text(name: string): string {
    const raw = readString(this.formData, name);
    if (raw.trim() === "") this.fail(name, MESSAGES.required);
    return raw;
  }

  int(name: string): number {
    const value = toPositiveInt(readString(this.formData, name));
    if (value === null) {
      this.fail(name, MESSAGES.integer);
      return 0;
    }
    return value;
  }

  optionalInt(name: string): number | null {
    const raw = readString(this.formData, name);
    if (raw.trim() === "") return null;
    const value = toPositiveInt(raw);
    if (value === null) this.fail(name, MESSAGES.integer);
    return value;
  }

  optionalText(name: string): string | null {
    const raw = readString(this.formData, name);
    return raw.trim() === "" ? null : raw;
  }

  priority(name: string): Priority {
    const raw = readString(this.formData, name);
    const found = PRIORITIES.find((p) => p === raw);
    if (found === undefined) {
      this.fail(name, MESSAGES.priority);
      return PRIORITIES[0];
    }
    return found;
  }

  finish<T>(data: T): FormResult<T> {
    if (Object.keys(this.errors).length > 0) return { ok: false, fieldErrors: this.errors, formError: null };
    return { ok: true, data };
  }
}

export function parseTechnicianForm(formData: FormData): FormResult<{ name: string }> {
  const name = readString(formData, "name");
  if (!isTechnician(name)) {
    return { ok: false, fieldErrors: { name: [MESSAGES.technician] }, formError: null };
  }
  return { ok: true, data: { name } };
}

export function parseReportIdForm(formData: FormData): FormResult<{ reportId: number }> {
  const f = new Fields(formData);
  const reportId = f.int("reportId");
  return f.finish({ reportId });
}

export type WorkOrderEditFormData = {
  reportId: number;
  expectedVersion: number;
  title: string;
  description: string;
  priority: Priority;
};

export function parseWorkOrderEditForm(formData: FormData): FormResult<WorkOrderEditFormData> {
  const f = new Fields(formData);
  const reportId = f.int("reportId");
  const expectedVersion = f.int("expectedVersion");
  const title = f.text("title");
  const description = f.text("description");
  const priority = f.priority("priority");
  return f.finish({ reportId, expectedVersion, title, description, priority });
}

export function parseDecisionForm(
  formData: FormData,
): FormResult<{ reportId: number; expectedVersion: number; note: string | null }> {
  const f = new Fields(formData);
  const reportId = f.int("reportId");
  const expectedVersion = f.int("expectedVersion");
  const note = f.optionalText("note");
  return f.finish({ reportId, expectedVersion, note });
}

export function parseObservationForm(formData: FormData): FormResult<{ reportId: number; text: string }> {
  const f = new Fields(formData);
  const reportId = f.int("reportId");
  const text = f.text("text");
  return f.finish({ reportId, text });
}

export function parseFindingForm(
  formData: FormData,
): FormResult<{ reportId: number; description: string; hypothesisId: number | null }> {
  const f = new Fields(formData);
  const reportId = f.int("reportId");
  const description = f.text("description");
  const hypothesisId = f.optionalInt("hypothesisId");
  return f.finish({ reportId, description, hypothesisId });
}

export function parseAnswerForm(
  formData: FormData,
): FormResult<{ reportId: number; questionId: number; answer: string }> {
  const f = new Fields(formData);
  const reportId = f.int("reportId");
  const questionId = f.int("questionId");
  const answer = f.text("answer");
  return f.finish({ reportId, questionId, answer });
}
