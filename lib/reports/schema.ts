// Pure module: only zod, no "server-only", no "@/" alias, no logging, so it runs in plain Node under tsx and vitest.
// Every check carries its own short message, so raw zod text never reaches a form.
import { z } from "zod";

export const REPORT_LIMITS = {
  issueMin: 5,
  issueMax: 2000,
  eventMax: 500,
  events: 20,
  readings: 30,
  readingsPerSensor: 3,
  sourceMax: 60,
  nameMax: 80,
} as const;

export const MESSAGES = {
  equipment: "Choose an equipment item",
  name: `Enter your name (up to ${REPORT_LIMITS.nameMax} characters)`,
  issue: `Describe the issue (${REPORT_LIMITS.issueMin} to ${REPORT_LIMITS.issueMax} characters)`,
  eventDescription: `Describe the event (up to ${REPORT_LIMITS.eventMax} characters)`,
  tooManyEvents: `Too many events (max ${REPORT_LIMITS.events})`,
  sensor: "Choose a sensor",
  value: "Enter a value",
  number: "Enter a number",
  source: `Source is too long (max ${REPORT_LIMITS.sourceMax} characters)`,
  tooManyReadings: `Too many readings (max ${REPORT_LIMITS.readings})`,
  timestamp: "Use a date and time with a time zone, like 2026-01-31T14:30:00Z",
  generic: "Check this field",
  formGeneric: "Check the form and try again",
} as const;

const KNOWN_MESSAGES: ReadonlySet<string> = new Set(Object.values(MESSAGES));

const isoWithOffset = z.iso.datetime({ offset: true });

// ISO 8601 with an explicit offset or Z, or null. Output is a Date or null.
const timestamp = z
  .string({ error: () => MESSAGES.timestamp })
  .nullable()
  .superRefine((v, ctx) => {
    if (v === null) return;
    if (!isoWithOffset.safeParse(v).success || Number.isNaN(new Date(v).getTime())) {
      ctx.addIssue({ code: "custom", message: MESSAGES.timestamp });
    }
  })
  .transform((v) => (v === null ? null : new Date(v)));

const text = (max: number, message: string, min = 1) =>
  z.string({ error: () => message }).trim().min(min, message).max(max, message);

export const createReportInputSchema = z.object({
  equipmentId: z
    .number({ error: () => MESSAGES.equipment })
    .int(MESSAGES.equipment)
    .positive(MESSAGES.equipment),
  reportedBy: text(REPORT_LIMITS.nameMax, MESSAGES.name),
  issue: text(REPORT_LIMITS.issueMax, MESSAGES.issue, REPORT_LIMITS.issueMin),
  events: z
    .array(
      z.object({
        description: text(REPORT_LIMITS.eventMax, MESSAGES.eventDescription),
        occurredAt: timestamp,
      }),
      { error: () => MESSAGES.generic },
    )
    .max(REPORT_LIMITS.events, MESSAGES.tooManyEvents),
  readings: z
    .array(
      z.object({
        sensor: z.string({ error: () => MESSAGES.sensor }).trim().min(1, MESSAGES.sensor),
        value: z
          .number({ error: () => MESSAGES.number })
          .refine(Number.isFinite, MESSAGES.number),
        recordedAt: timestamp,
        source: z
          .string({ error: () => MESSAGES.source })
          .trim()
          .max(REPORT_LIMITS.sourceMax, MESSAGES.source)
          .nullable()
          .transform((v) => (v === null || v === "" ? null : v)),
      }),
      { error: () => MESSAGES.generic },
    )
    .max(REPORT_LIMITS.readings, MESSAGES.tooManyReadings),
});

export type CreateReportInput = z.output<typeof createReportInputSchema>;

export type ParseReportFormResult =
  | { ok: true; data: CreateReportInput }
  | { ok: false; fieldErrors: Record<string, string[]>; formError: string | null };

const ROW_KEY = /^(event|reading)\.(\d{1,4})\.([A-Za-z]+)$/;
const PLAIN_NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)$/;

function field(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v.trim() : "";
}

// Submitted row numbers of one group, in ascending order.
function rowNumbers(formData: FormData, group: "event" | "reading"): number[] {
  const rows = new Set<number>();
  for (const key of formData.keys()) {
    const m = ROW_KEY.exec(key);
    if (m && m[1] === group) rows.add(Number(m[2]));
  }
  return [...rows].sort((a, b) => a - b);
}

export function parseReportForm(formData: FormData): ParseReportFormResult {
  const fieldErrors: Record<string, string[]> = {};
  const addError = (key: string, message: string) => {
    const list = (fieldErrors[key] ??= []);
    if (!list.includes(message)) list.push(message);
  };
  let formError: string | null = null;

  // Input index -> submitted row number, so errors point at the right input after blank rows are skipped.
  const eventRows: number[] = [];
  const events: { description: string; occurredAt: string | null }[] = [];
  for (const n of rowNumbers(formData, "event")) {
    const description = field(formData, `event.${n}.description`);
    const occurredAt = field(formData, `event.${n}.occurredAt`);
    if (description === "" && occurredAt === "") continue;
    eventRows.push(n);
    events.push({ description, occurredAt: occurredAt === "" ? null : occurredAt });
  }

  const readingRows: number[] = [];
  const readings: { sensor: string; value: number; recordedAt: string | null; source: string | null }[] = [];
  for (const n of rowNumbers(formData, "reading")) {
    const sensor = field(formData, `reading.${n}.sensor`);
    const rawValue = field(formData, `reading.${n}.value`);
    const recordedAt = field(formData, `reading.${n}.recordedAt`);
    const source = field(formData, `reading.${n}.source`);
    if (sensor === "" && rawValue === "" && recordedAt === "" && source === "") continue;
    readingRows.push(n);
    let value = Number.NaN;
    if (rawValue === "") addError(`reading.${n}.value`, MESSAGES.value);
    else if (!PLAIN_NUMBER.test(rawValue)) addError(`reading.${n}.value`, MESSAGES.number);
    else value = Number(rawValue);
    readings.push({
      sensor,
      value,
      recordedAt: recordedAt === "" ? null : recordedAt,
      source: source === "" ? null : source,
    });
  }

  const rawEquipment = field(formData, "equipmentId");
  const parsed = createReportInputSchema.safeParse({
    equipmentId: /^\d+$/.test(rawEquipment) ? Number(rawEquipment) : Number.NaN,
    reportedBy: field(formData, "reportedBy"),
    issue: field(formData, "issue"),
    events,
    readings,
  });

  if (parsed.success && Object.keys(fieldErrors).length === 0) return { ok: true, data: parsed.data };

  if (!parsed.success) {
    // Value errors found above win over the schema's own message for the same input.
    const preset = new Set(Object.keys(fieldErrors));
    for (const issue of parsed.error.issues) {
      const [head, index, leaf] = issue.path;
      const message = KNOWN_MESSAGES.has(issue.message) ? issue.message : MESSAGES.generic;
      if (head === "equipmentId" || head === "reportedBy" || head === "issue") {
        addError(head, message);
      } else if ((head === "events" || head === "readings") && typeof index === "number" && typeof leaf === "string") {
        const group = head === "events" ? "event" : "reading";
        const row = (head === "events" ? eventRows : readingRows)[index];
        const key = `${group}.${row}.${leaf}`;
        if (!preset.has(key)) addError(key, message);
      } else {
        formError = message === MESSAGES.generic ? MESSAGES.formGeneric : message;
      }
    }
  }

  return { ok: false, fieldErrors, formError };
}
