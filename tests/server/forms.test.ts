import { describe, expect, it } from "vitest";
import {
  parseAnswerForm,
  parseDecisionForm,
  parseFindingForm,
  parseObservationForm,
  parseReportIdForm,
  parseTechnicianForm,
  parseWorkOrderEditForm,
} from "../../lib/server/forms";
import { TECHNICIANS } from "../../lib/technicians";

const SENTINEL = "postgresql://secret";
const INT_MESSAGE = "Enter a whole number greater than zero";
const REQUIRED = "This field is required";

function form(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

const BAD_INTS: [string, string][] = [
  ["non-integer", "abc"],
  ["zero", "0"],
  ["negative", "-1"],
  ["huge", "99999999999999999999"],
  ["decimal", "1.5"],
  ["padded whitespace", " 5 "],
  ["blank", ""],
  ["plus sign", "+5"],
  ["exponent", "1e3"],
];

describe("parseTechnicianForm", () => {
  it("accepts each technician", () => {
    for (const name of TECHNICIANS) {
      expect(parseTechnicianForm(form({ name }))).toEqual({ ok: true, data: { name } });
    }
  });

  it("rejects unknown, empty, missing and differently cased names", () => {
    for (const fd of [form({ name: "Nobody" }), form({ name: "" }), form({}), form({ name: "asha rao" }), form({ name: "ASHA RAO" })]) {
      expect(parseTechnicianForm(fd)).toEqual({
        ok: false,
        fieldErrors: { name: ["Choose a name from the list"] },
        formError: null,
      });
    }
  });
});

describe("parseReportIdForm", () => {
  it("accepts a valid id", () => {
    expect(parseReportIdForm(form({ reportId: "12" }))).toEqual({ ok: true, data: { reportId: 12 } });
  });

  it("rejects a missing field", () => {
    expect(parseReportIdForm(form({}))).toEqual({
      ok: false,
      fieldErrors: { reportId: [INT_MESSAGE] },
      formError: null,
    });
  });

  for (const [label, value] of BAD_INTS) {
    it(`rejects ${label}`, () => {
      const result = parseReportIdForm(form({ reportId: value }));
      expect(result).toEqual({ ok: false, fieldErrors: { reportId: [INT_MESSAGE] }, formError: null });
    });
  }

  it("accepts the largest safe integer and rejects the next one", () => {
    expect(parseReportIdForm(form({ reportId: String(Number.MAX_SAFE_INTEGER) })).ok).toBe(true);
    expect(parseReportIdForm(form({ reportId: String(Number.MAX_SAFE_INTEGER + 1) })).ok).toBe(false);
  });
});

describe("parseWorkOrderEditForm", () => {
  const valid = { reportId: "3", expectedVersion: "2", title: "  Replace seal ", description: " Do it\n", priority: "HIGH" };

  it("accepts a valid form and passes strings through untrimmed", () => {
    expect(parseWorkOrderEditForm(form(valid))).toEqual({
      ok: true,
      data: { reportId: 3, expectedVersion: 2, title: "  Replace seal ", description: " Do it\n", priority: "HIGH" },
    });
  });

  it("accepts every priority", () => {
    for (const priority of ["LOW", "MEDIUM", "HIGH", "URGENT"]) {
      expect(parseWorkOrderEditForm(form({ ...valid, priority })).ok).toBe(true);
    }
  });

  it("reports missing fields", () => {
    const result = parseWorkOrderEditForm(form({}));
    expect(result).toEqual({
      ok: false,
      fieldErrors: {
        reportId: [INT_MESSAGE],
        expectedVersion: [INT_MESSAGE],
        title: [REQUIRED],
        description: [REQUIRED],
        priority: ["Choose a priority"],
      },
      formError: null,
    });
  });

  it("rejects whitespace-only text and unknown or lower-case priorities", () => {
    const result = parseWorkOrderEditForm(form({ ...valid, title: "   ", priority: "high" }));
    expect(result).toEqual({
      ok: false,
      fieldErrors: { title: [REQUIRED], priority: ["Choose a priority"] },
      formError: null,
    });
    expect(parseWorkOrderEditForm(form({ ...valid, priority: "CRITICAL" })).ok).toBe(false);
  });

  for (const [label, value] of BAD_INTS) {
    it(`rejects expectedVersion that is ${label}`, () => {
      const result = parseWorkOrderEditForm(form({ ...valid, expectedVersion: value }));
      expect(result).toEqual({ ok: false, fieldErrors: { expectedVersion: [INT_MESSAGE] }, formError: null });
    });
  }
});

describe("parseDecisionForm", () => {
  it("accepts a valid form with a note passed through untrimmed", () => {
    expect(parseDecisionForm(form({ reportId: "1", expectedVersion: "4", note: " ok " }))).toEqual({
      ok: true,
      data: { reportId: 1, expectedVersion: 4, note: " ok " },
    });
  });

  it("turns blank, whitespace-only and missing notes into null", () => {
    const extras: Record<string, string>[] = [{ note: "" }, { note: "  \n\t " }, {}];
    for (const extra of extras) {
      expect(parseDecisionForm(form({ reportId: "1", expectedVersion: "4", ...extra }))).toEqual({
        ok: true,
        data: { reportId: 1, expectedVersion: 4, note: null },
      });
    }
  });

  for (const [label, value] of BAD_INTS) {
    it(`rejects expectedVersion that is ${label}`, () => {
      const result = parseDecisionForm(form({ reportId: "1", expectedVersion: value }));
      expect(result).toEqual({ ok: false, fieldErrors: { expectedVersion: [INT_MESSAGE] }, formError: null });
    });
  }

  it("rejects a missing reportId", () => {
    expect(parseDecisionForm(form({ expectedVersion: "1" }))).toEqual({
      ok: false,
      fieldErrors: { reportId: [INT_MESSAGE] },
      formError: null,
    });
  });
});

describe("parseObservationForm", () => {
  it("accepts a valid form", () => {
    expect(parseObservationForm(form({ reportId: "2", text: "Smells hot" }))).toEqual({
      ok: true,
      data: { reportId: 2, text: "Smells hot" },
    });
  });

  it("rejects missing and blank text", () => {
    for (const fd of [form({ reportId: "2" }), form({ reportId: "2", text: "   " })]) {
      expect(parseObservationForm(fd)).toEqual({ ok: false, fieldErrors: { text: [REQUIRED] }, formError: null });
    }
  });

  for (const [label, value] of BAD_INTS) {
    it(`rejects reportId that is ${label}`, () => {
      const result = parseObservationForm(form({ reportId: value, text: "x" }));
      expect(result).toEqual({ ok: false, fieldErrors: { reportId: [INT_MESSAGE] }, formError: null });
    });
  }
});

describe("parseFindingForm", () => {
  it("accepts a valid form with a hypothesis", () => {
    expect(parseFindingForm(form({ reportId: "2", description: "Worn bearing", hypothesisId: "9" }))).toEqual({
      ok: true,
      data: { reportId: 2, description: "Worn bearing", hypothesisId: 9 },
    });
  });

  it("turns a blank, whitespace-only or missing hypothesisId into null", () => {
    const extras: Record<string, string>[] = [{ hypothesisId: "" }, { hypothesisId: "  " }, {}];
    for (const extra of extras) {
      expect(parseFindingForm(form({ reportId: "2", description: "d", ...extra }))).toEqual({
        ok: true,
        data: { reportId: 2, description: "d", hypothesisId: null },
      });
    }
  });

  for (const [label, value] of BAD_INTS.filter(([, v]) => v !== "")) {
    it(`rejects hypothesisId that is ${label}`, () => {
      const result = parseFindingForm(form({ reportId: "2", description: "d", hypothesisId: value }));
      expect(result).toEqual({ ok: false, fieldErrors: { hypothesisId: [INT_MESSAGE] }, formError: null });
    });
  }

  it("rejects a missing description", () => {
    expect(parseFindingForm(form({ reportId: "2" }))).toEqual({
      ok: false,
      fieldErrors: { description: [REQUIRED] },
      formError: null,
    });
  });
});

describe("parseAnswerForm", () => {
  it("accepts a valid form", () => {
    expect(parseAnswerForm(form({ reportId: "1", questionId: "5", answer: "Yes" }))).toEqual({
      ok: true,
      data: { reportId: 1, questionId: 5, answer: "Yes" },
    });
  });

  it("rejects missing fields", () => {
    expect(parseAnswerForm(form({}))).toEqual({
      ok: false,
      fieldErrors: { reportId: [INT_MESSAGE], questionId: [INT_MESSAGE], answer: [REQUIRED] },
      formError: null,
    });
  });

  for (const [label, value] of BAD_INTS) {
    it(`rejects questionId that is ${label}`, () => {
      const result = parseAnswerForm(form({ reportId: "1", questionId: value, answer: "a" }));
      expect(result).toEqual({ ok: false, fieldErrors: { questionId: [INT_MESSAGE] }, formError: null });
    });
  }
});

describe("submitted text is never echoed into messages", () => {
  it("keeps the sentinel out of every failure", () => {
    const bad = { reportId: SENTINEL, expectedVersion: SENTINEL, questionId: SENTINEL, hypothesisId: SENTINEL, priority: SENTINEL, name: SENTINEL };
    const blankText = { text: " ", description: " ", answer: " ", title: " " };
    const results = [
      parseTechnicianForm(form(bad)),
      parseReportIdForm(form(bad)),
      parseWorkOrderEditForm(form({ ...bad, ...blankText })),
      parseDecisionForm(form(bad)),
      parseObservationForm(form({ ...bad, ...blankText })),
      parseFindingForm(form({ ...bad, ...blankText })),
      parseAnswerForm(form({ ...bad, ...blankText })),
    ];
    for (const result of results) {
      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toContain(SENTINEL);
    }
  });
});
