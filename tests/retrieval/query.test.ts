import { describe, expect, it } from "vitest";
import { GENERIC_QUERY_WORDS, buildRetrievalQuery, toTsQueryString } from "../../lib/retrieval/query";

const SAFE = /^$|^[a-z0-9]+( \| [a-z0-9]+)*$/;

const base = {
  equipmentType: "PUMP" as const,
  issue: "Loud grinding noise",
  events: [{ description: "Bearing replaced last week" }],
  thresholds: [],
};

describe("buildRetrievalQuery", () => {
  it("is deterministic and ordered: label, issue, events, sensors", () => {
    const input = {
      ...base,
      thresholds: [{ sensor: "vibration_rms", status: "WARNING" as const }],
    };
    const out = buildRetrievalQuery(input);
    expect(out).toBe(
      "centrifugal pump\nLoud grinding noise\nBearing replaced last week\nvibration rms",
    );
    expect(buildRetrievalQuery(input)).toBe(out);
  });

  it("uses a readable label per equipment type", () => {
    expect(buildRetrievalQuery({ ...base, equipmentType: "COMPRESSOR" })).toContain("air compressor");
    expect(buildRetrievalQuery({ ...base, equipmentType: "MOTOR" })).toContain("electric motor");
  });

  it("includes WARNING, CRITICAL and CONFLICTING sensors but not OK or MISSING", () => {
    const out = buildRetrievalQuery({
      ...base,
      thresholds: [
        { sensor: "warn_sensor", status: "WARNING" },
        { sensor: "crit_sensor", status: "CRITICAL" },
        { sensor: "conf_sensor", status: "CONFLICTING" },
        { sensor: "ok_sensor", status: "OK" },
        { sensor: "miss_sensor", status: "MISSING" },
      ],
    });
    expect(out).toContain("warn sensor");
    expect(out).toContain("crit sensor");
    expect(out).toContain("conf sensor");
    expect(out).not.toContain("ok sensor");
    expect(out).not.toContain("miss sensor");
    expect(out).not.toContain("_");
  });

  it("collapses repeated whitespace within each part", () => {
    const out = buildRetrievalQuery({ ...base, issue: "  loud \n\t  grinding   noise  " });
    expect(out.split("\n")[1]).toBe("loud grinding noise");
  });

  it("truncates at a word boundary at or under 2000 characters", () => {
    const issue = Array.from({ length: 600 }, () => "word").join(" ");
    const out = buildRetrievalQuery({ ...base, issue });
    expect(out.length).toBeLessThanOrEqual(2000);
    expect(out.length).toBeGreaterThan(1900);
    expect(out.endsWith("word")).toBe(true);
    expect(out.split(/\s+/).every((w) => w === "word" || w === "centrifugal" || w === "pump")).toBe(true);
  });

  it("does not cut a long word in half", () => {
    const out = buildRetrievalQuery({ ...base, issue: `${"a".repeat(1995)} ${"b".repeat(50)}` });
    expect(out).not.toContain("b");
    expect(out.length).toBeLessThanOrEqual(2000);
  });
});

describe("toTsQueryString", () => {
  it("strips tsquery special characters", () => {
    const out = toTsQueryString("pump & valve | !leak : 'seal' (worn) \\ shaft");
    expect(out).toBe("pump | valve | leak | seal | worn | shaft");
  });

  it("turns an injection attempt into safe tokens", () => {
    const out = toTsQueryString("'; DROP TABLE x; --");
    expect(out).toBe("drop | table");
    expect(out).toMatch(SAFE);
  });

  it("drops short tokens and stop words", () => {
    expect(toTsQueryString("the pump is on and has a big leak")).toBe("pump | big | leak");
  });

  it("splits on underscores", () => {
    expect(toTsQueryString("vibration_rms")).toBe("vibration | rms");
  });

  it("dedupes, keeping first occurrence", () => {
    expect(toTsQueryString("Seal leak SEAL leak pump")).toBe("seal | leak | pump");
  });

  it("respects maxTerms, defaulting to 24", () => {
    const text = Array.from({ length: 40 }, (_, i) => `term${i}`).join(" ");
    expect(toTsQueryString(text).split(" | ")).toHaveLength(24);
    expect(toTsQueryString(text, { maxTerms: 3 })).toBe("term0 | term1 | term2");
  });

  it("returns an empty string for empty or punctuation-only input", () => {
    expect(toTsQueryString("")).toBe("");
    expect(toTsQueryString("  &|!:'()\\ -- ")).toBe("");
    expect(toTsQueryString("a an of")).toBe("");
  });

  it("drops excluded tokens, comparing lowercase", () => {
    expect(toTsQueryString("Pump seal leak", { exclude: ["PUMP"] })).toBe("seal | leak");
    expect(toTsQueryString("pump seal leak", { exclude: ["pump", "leak"] })).toBe("seal");
  });

  it("does not count excluded tokens toward maxTerms", () => {
    expect(toTsQueryString("pump seal leak", { exclude: ["pump"], maxTerms: 2 })).toBe("seal | leak");
  });

  it("returns an empty string when everything is excluded", () => {
    expect(toTsQueryString("pump pump", { exclude: ["pump"] })).toBe("");
  });

  it("drops the generic words for the equipment type from a built query", () => {
    const query = buildRetrievalQuery(base);
    const out = toTsQueryString(query, { exclude: GENERIC_QUERY_WORDS.PUMP });
    expect(out).not.toMatch(/\bpump\b|\bcentrifugal\b/);
    expect(out).toContain("grinding");
    expect(GENERIC_QUERY_WORDS.COMPRESSOR).toEqual(["compressor"]);
    expect(GENERIC_QUERY_WORDS.MOTOR).toEqual(["motor", "electric"]);
  });

  it("always matches the safe pattern", () => {
    const inputs = [
      "",
      "Pump 4-2 bearing temp > 90°C!",
      "été naïve 日本語 pump",
      "a:*b & c | d <-> e",
      "x".repeat(500),
      "line1\nline2\ttab",
      "'; DROP TABLE x; --",
    ];
    for (const input of inputs) {
      expect(toTsQueryString(input)).toMatch(SAFE);
    }
  });
});
