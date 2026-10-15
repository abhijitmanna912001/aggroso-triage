import { describe, expect, it } from "vitest";
import { createReportInputSchema, parseReportForm, REPORT_LIMITS } from "../../lib/reports/schema";

const base = {
  equipmentId: 1,
  reportedBy: "Alex",
  issue: "Pump is noisy",
  events: [] as unknown[],
  readings: [] as unknown[],
};

function messages(result: ReturnType<typeof createReportInputSchema.safeParse>): string[] {
  return result.success ? [] : result.error.issues.map((i) => i.message);
}

describe("createReportInputSchema", () => {
  it("accepts a valid input and converts timestamps to Dates", () => {
    const r = createReportInputSchema.parse({
      ...base,
      events: [{ description: "Started rattling", occurredAt: "2026-01-31T14:30:00Z" }],
      readings: [{ sensor: "vibration", value: 5.2, recordedAt: "2026-01-31T14:30:00+05:30", source: "handheld" }],
    });
    expect(r.events[0].occurredAt).toEqual(new Date("2026-01-31T14:30:00Z"));
    expect(r.readings[0].recordedAt).toEqual(new Date("2026-01-31T09:00:00Z"));
  });

  it("trims text fields", () => {
    const r = createReportInputSchema.parse({
      ...base,
      reportedBy: "  Alex  ",
      issue: "  Pump is noisy  ",
      events: [{ description: "  hum  ", occurredAt: null }],
      readings: [{ sensor: " vibration ", value: 1, recordedAt: null, source: "  gauge " }],
    });
    expect(r.reportedBy).toBe("Alex");
    expect(r.issue).toBe("Pump is noisy");
    expect(r.events[0].description).toBe("hum");
    expect(r.readings[0].sensor).toBe("vibration");
    expect(r.readings[0].source).toBe("gauge");
  });

  it("rejects a blank issue and a too-short issue", () => {
    expect(createReportInputSchema.safeParse({ ...base, issue: "   " }).success).toBe(false);
    expect(createReportInputSchema.safeParse({ ...base, issue: "abcd" }).success).toBe(false);
    expect(createReportInputSchema.safeParse({ ...base, issue: "abcde" }).success).toBe(true);
  });

  it("rejects too many events", () => {
    const events = Array.from({ length: REPORT_LIMITS.events + 1 }, () => ({ description: "x", occurredAt: null }));
    expect(createReportInputSchema.safeParse({ ...base, events }).success).toBe(false);
  });

  it("rejects an invalid timestamp and a timestamp without an offset", () => {
    for (const bad of ["not a date", "2026-01-31T14:30:00", "2026-01-31", "2026-02-31T10:00:00Z"]) {
      const r = createReportInputSchema.safeParse({ ...base, events: [{ description: "x", occurredAt: bad }] });
      expect(r.success, bad).toBe(false);
    }
  });

  it("turns a blank source into null", () => {
    const r = createReportInputSchema.parse({
      ...base,
      readings: [{ sensor: "vibration", value: 1, recordedAt: null, source: "   " }],
    });
    expect(r.readings[0].source).toBeNull();
  });

  it("rejects non-finite values", () => {
    for (const bad of [Number.NaN, Infinity, -Infinity]) {
      const r = createReportInputSchema.safeParse({
        ...base,
        readings: [{ sensor: "vibration", value: bad, recordedAt: null, source: null }],
      });
      expect(r.success).toBe(false);
    }
  });

  it("uses only its own short messages", () => {
    const r = createReportInputSchema.safeParse({ ...base, issue: "", events: [{ description: "", occurredAt: "x" }] });
    for (const m of messages(r)) expect(m).not.toMatch(/Invalid input|Expected|Too small|Too big|Required/);
  });
});

function form(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

const validForm = {
  equipmentId: "7",
  reportedBy: " Alex ",
  issue: "Pump is noisy",
  "event.0.description": "Started rattling",
  "event.0.occurredAt": "2026-01-31T14:30:00Z",
  "reading.0.sensor": "vibration",
  "reading.0.value": "5.2",
  "reading.0.recordedAt": "2026-01-31T14:30:00Z",
  "reading.0.source": "handheld",
};

describe("parseReportForm", () => {
  it("parses a full valid form", () => {
    const r = parseReportForm(form(validForm));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.equipmentId).toBe(7);
    expect(r.data.reportedBy).toBe("Alex");
    expect(r.data.events).toEqual([{ description: "Started rattling", occurredAt: new Date("2026-01-31T14:30:00Z") }]);
    expect(r.data.readings[0]).toMatchObject({ sensor: "vibration", value: 5.2, source: "handheld" });
  });

  it("accepts a form with no optional rows", () => {
    const r = parseReportForm(form({ equipmentId: "1", reportedBy: "Alex", issue: "Pump is noisy" }));
    expect(r.ok).toBe(true);
  });

  it("skips blank rows and keeps error keys on the submitted positions", () => {
    const r = parseReportForm(
      form({
        equipmentId: "1",
        reportedBy: "Alex",
        issue: "Pump is noisy",
        "event.0.description": "",
        "event.0.occurredAt": " ",
        "event.1.description": "real",
        "event.1.occurredAt": "bad",
        "reading.0.sensor": "",
        "reading.0.value": "",
        "reading.1.sensor": "vibration",
        "reading.1.value": "1",
        "reading.2.sensor": "",
        "reading.3.sensor": "bearing_temperature",
        "reading.3.value": "",
      }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.fieldErrors).sort()).toEqual(["event.1.occurredAt", "reading.3.value"]);
    expect(r.fieldErrors["reading.3.value"]).toEqual(["Enter a value"]);
  });

  it("skips blank rows when the form is otherwise valid", () => {
    const r = parseReportForm(form({ ...validForm, "event.1.description": "", "reading.1.sensor": "", "reading.1.value": "" }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.events).toHaveLength(1);
      expect(r.data.readings).toHaveLength(1);
    }
  });

  it("errors on the value field when a sensor has no value", () => {
    const r = parseReportForm(form({ ...validForm, "reading.2.sensor": "vibration" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors).toEqual({ "reading.2.value": ["Enter a value"] });
  });

  it("rejects values that are not plain numbers", () => {
    for (const bad of ["abc", "1e3", "1,5", "Infinity", "0x10", "--1"]) {
      const r = parseReportForm(form({ ...validForm, "reading.0.value": bad }));
      expect(r.ok, bad).toBe(false);
      if (!r.ok) expect(r.fieldErrors["reading.0.value"], bad).toEqual(["Enter a number"]);
    }
    for (const good of ["-3", "+2.5", ".5", "7."]) {
      expect(parseReportForm(form({ ...validForm, "reading.0.value": good })).ok, good).toBe(true);
    }
  });

  it("uses form field names as error keys and never raw zod text", () => {
    const r = parseReportForm(
      form({
        equipmentId: "",
        reportedBy: "",
        issue: "abc",
        "event.0.description": "",
        "event.0.occurredAt": "2026-01-31T14:30:00",
        "reading.0.sensor": "",
        "reading.0.value": "x",
        "reading.0.recordedAt": "nope",
        "reading.0.source": "s".repeat(REPORT_LIMITS.sourceMax + 1),
      }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.fieldErrors).sort()).toEqual([
      "equipmentId",
      "event.0.description",
      "event.0.occurredAt",
      "issue",
      "reading.0.recordedAt",
      "reading.0.sensor",
      "reading.0.source",
      "reading.0.value",
      "reportedBy",
    ]);
    const all = [...Object.values(r.fieldErrors).flat(), r.formError ?? ""];
    for (const m of all) expect(m).not.toMatch(/Invalid input|Expected|Too small|Too big|Required|received|undefined|NaN/);
  });

  it("reports too many rows as a form error", () => {
    const entries: Record<string, string> = { equipmentId: "1", reportedBy: "Alex", issue: "Pump is noisy" };
    for (let n = 0; n <= REPORT_LIMITS.events; n++) entries[`event.${n}.description`] = "x";
    const r = parseReportForm(form(entries));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.formError).toBe(`Too many events (max ${REPORT_LIMITS.events})`);
  });
});
