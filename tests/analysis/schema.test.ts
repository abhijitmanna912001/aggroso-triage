import { zodTextFormat } from "openai/helpers/zod";
import { describe, expect, it } from "vitest";
import { ANALYSIS_LIMITS, CITATION_TYPES, analysisOutputSchema } from "../../lib/analysis/schema";

const validSample = {
  hypotheses: [
    {
      cause: "Possible bearing wear",
      rationale: "Vibration is high",
      confidence: "MEDIUM",
      citations: [{ type: "manual", id: "pump-4-2" }],
    },
  ],
  followUpQuestions: [{ question: "When was the last lubrication?", citations: [{ type: "event", id: "1" }] }],
  inspectionSteps: [
    {
      instruction: "Isolate and lock out, then inspect the bearing housing.",
      citations: [{ type: "threshold", id: "PUMP.vibration" }],
    },
  ],
  proposedPriority: "HIGH",
  priorityRationale: "Critical vibration",
  draftWorkOrder: { title: "Inspect pump bearing" },
  limitations: ["No lubrication log provided"],
};

type JsonSchemaNode = {
  type?: string;
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  items?: JsonSchemaNode;
  additionalProperties?: unknown;
  [key: string]: unknown;
};

function walk(node: JsonSchemaNode, visit: (n: JsonSchemaNode) => void): void {
  visit(node);
  for (const child of Object.values(node.properties ?? {})) walk(child, visit);
  if (node.items) walk(node.items, visit);
}

describe("analysisOutputSchema", () => {
  const format = zodTextFormat(analysisOutputSchema, "analysis");
  const root = format.schema as JsonSchemaNode;

  it("is accepted by the OpenAI zod helper as a strict json_schema format", () => {
    expect(format.type).toBe("json_schema");
    expect(format.strict).toBe(true);
    expect(root.type).toBe("object");
  });

  it("has additionalProperties false and every property required on every object", () => {
    let objects = 0;
    walk(root, (n) => {
      if (n.type !== "object") return;
      objects += 1;
      expect(n.additionalProperties).toBe(false);
      expect([...(n.required ?? [])].sort()).toEqual(Object.keys(n.properties ?? {}).sort());
    });
    // root + hypothesis + citation(s) + question + step + draftWorkOrder
    expect(objects).toBeGreaterThanOrEqual(6);
  });

  it("uses no keywords Structured Outputs rejects", () => {
    const banned = ["minLength", "maxLength", "minItems", "maxItems", "pattern", "default", "minimum", "maximum"];
    walk(root, (n) => {
      for (const key of banned) expect(n).not.toHaveProperty(key);
    });
  });

  it("draftWorkOrder has only a title, no description", () => {
    expect(Object.keys(root.properties?.draftWorkOrder.properties ?? {})).toEqual(["title"]);
  });

  it("parses a valid sample", () => {
    expect(analysisOutputSchema.safeParse(validSample).success).toBe(true);
  });

  it("rejects a bad enum value", () => {
    expect(analysisOutputSchema.safeParse({ ...validSample, proposedPriority: "SEVERE" }).success).toBe(false);
    const badConfidence = {
      ...validSample,
      hypotheses: [{ ...validSample.hypotheses[0], confidence: "CERTAIN" }],
    };
    expect(analysisOutputSchema.safeParse(badConfidence).success).toBe(false);
    const badCitation = {
      ...validSample,
      hypotheses: [{ ...validSample.hypotheses[0], citations: [{ type: "web", id: "x" }] }],
    };
    expect(analysisOutputSchema.safeParse(badCitation).success).toBe(false);
  });

  it("has no optional fields: a missing field fails", () => {
    for (const key of Object.keys(validSample)) {
      const copy: Record<string, unknown> = { ...validSample };
      delete copy[key];
      expect(analysisOutputSchema.safeParse(copy).success).toBe(false);
    }
  });

  it("exports the citation types and limits", () => {
    expect(CITATION_TYPES).toEqual(["manual", "event", "threshold"]);
    expect(ANALYSIS_LIMITS).toEqual({ hypotheses: 5, followUpQuestions: 6, inspectionSteps: 10 });
  });
});
