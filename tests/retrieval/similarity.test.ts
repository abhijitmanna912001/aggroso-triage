import { describe, expect, it } from "vitest";
import { cosineSimilarity, rankBySimilarity } from "../../lib/retrieval/similarity";

describe("cosineSimilarity", () => {
  it("is 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it("is 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("is -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 2], [-1, -2])).toBeCloseTo(-1);
  });

  it("throws a RangeError on a length mismatch", () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(RangeError);
  });

  it("is 0 when either vector has zero magnitude", () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
    expect(cosineSimilarity([1, 2], [0, 0])).toBe(0);
  });
});

describe("rankBySimilarity", () => {
  const query = [1, 0];

  it("orders by score descending", () => {
    const { ranked } = rankBySimilarity(
      query,
      [
        { id: "far", embedding: [0, 1] },
        { id: "near", embedding: [1, 0] },
        { id: "mid", embedding: [1, 1] },
      ],
      10,
    );
    expect(ranked.map((r) => r.id)).toEqual(["near", "mid", "far"]);
  });

  it("breaks ties by id ascending", () => {
    const { ranked } = rankBySimilarity(
      query,
      [
        { id: "b", embedding: [1, 0] },
        { id: "a", embedding: [2, 0] },
        { id: "c", embedding: [3, 0] },
      ],
      10,
    );
    expect(ranked.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  it("cuts to the limit", () => {
    const { ranked } = rankBySimilarity(
      query,
      [
        { id: "a", embedding: [1, 0] },
        { id: "b", embedding: [1, 1] },
        { id: "c", embedding: [0, 1] },
      ],
      2,
    );
    expect(ranked).toHaveLength(2);
  });

  it("skips wrong-length and empty embeddings instead of throwing", () => {
    const { ranked, skipped } = rankBySimilarity(
      query,
      [
        { id: "ok", embedding: [1, 0] },
        { id: "short", embedding: [1] },
        { id: "empty", embedding: [] },
      ],
      10,
    );
    expect(ranked.map((r) => r.id)).toEqual(["ok"]);
    expect(skipped).toEqual(["short", "empty"]);
  });
});
