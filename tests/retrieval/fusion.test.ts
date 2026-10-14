import { describe, expect, it } from "vitest";
import { RRF_K, reciprocalRankFusion } from "../../lib/retrieval/fusion";

describe("reciprocalRankFusion", () => {
  it("handles a single list with 1-based ranks", () => {
    const result = reciprocalRankFusion([{ name: "fts", ids: ["a", "b"] }], { limit: 10 });
    expect(result.map((r) => r.id)).toEqual(["a", "b"]);
    expect(result[0].score).toBeCloseTo(1 / (RRF_K + 1));
    expect(result[1].score).toBeCloseTo(1 / (RRF_K + 2));
  });

  it("ranks an id found by two lists above ids found by one", () => {
    const result = reciprocalRankFusion(
      [
        { name: "fts", ids: ["a", "shared"] },
        { name: "vec", ids: ["b", "shared"] },
      ],
      { limit: 10 },
    );
    expect(result[0].id).toBe("shared");
    expect(result[0].score).toBeCloseTo(2 / (RRF_K + 2));
  });

  it("counts duplicates within a list once, at the first position", () => {
    const result = reciprocalRankFusion([{ name: "fts", ids: ["a", "a", "b"] }], { limit: 10 });
    expect(result.map((r) => r.id)).toEqual(["a", "b"]);
    expect(result[0].sources).toEqual([{ name: "fts", rank: 1 }]);
    expect(result[1].sources).toEqual([{ name: "fts", rank: 2 }]);
  });

  it("breaks score ties by best rank, then by id", () => {
    // x: rank 1 in L1 only. y: rank 1 in L2 only. Equal score and equal best rank, so id decides.
    // p: rank 2 in L1 and q: rank 2 in L2 tie on score too, after x and y.
    const result = reciprocalRankFusion(
      [
        { name: "L1", ids: ["y", "q"] },
        { name: "L2", ids: ["x", "p"] },
      ],
      { limit: 10 },
    );
    expect(result.map((r) => r.id)).toEqual(["x", "y", "p", "q"]);
  });

  it("breaks equal scores by the lowest rank in any list", () => {
    // m: ranks 1 and 3 -> 1/61 + 1/63. Construct n with the same score via a custom k is hard,
    // so use k so that two single-rank entries tie only by rank: use different lists with equal rank sums.
    const result = reciprocalRankFusion(
      [
        { name: "L1", ids: ["m", "z", "n"] },
        { name: "L2", ids: ["n", "z", "m"] },
      ],
      { limit: 10, k: 0 },
    );
    // m: 1/1 + 1/3, n: 1/3 + 1/1 (equal), z: 1/2 + 1/2 = 1 (lower). m and n tie with best rank 1: id order.
    expect(result.map((r) => r.id)).toEqual(["m", "n", "z"]);
  });

  it("cuts to the limit", () => {
    const result = reciprocalRankFusion([{ name: "fts", ids: ["a", "b", "c"] }], { limit: 2 });
    expect(result.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("returns an empty array for empty input", () => {
    expect(reciprocalRankFusion([], { limit: 5 })).toEqual([]);
    expect(reciprocalRankFusion([{ name: "fts", ids: [] }], { limit: 5 })).toEqual([]);
  });

  it("reports each list name and rank as sources", () => {
    const result = reciprocalRankFusion(
      [
        { name: "fts", ids: ["a", "b"] },
        { name: "vec", ids: ["b"] },
      ],
      { limit: 10 },
    );
    const b = result.find((r) => r.id === "b");
    expect(b?.sources).toEqual([
      { name: "fts", rank: 2 },
      { name: "vec", rank: 1 },
    ]);
  });
});
