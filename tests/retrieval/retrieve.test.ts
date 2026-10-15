import { describe, expect, it, vi } from "vitest";
import { EmbeddingError } from "../../lib/embeddings";
import { retrieveChunks, type ChunkRow, type RetrievalDeps } from "../../lib/retrieval/retrieve";

const input = {
  equipmentType: "PUMP" as const,
  issue: "bearing noise",
  events: [],
  thresholds: [],
};

function row(id: string, extra: Partial<ChunkRow> = {}): ChunkRow {
  return {
    id,
    equipmentType: "PUMP",
    document: "pump-manual",
    sectionRef: `ref-${id}`,
    heading: `Heading ${id}`,
    content: `Content ${id}`,
    ...extra,
  };
}

const QUERY_VECTOR = [1, 0, 0, 0];

function loaded(id: string, embedding: number[], extra: Partial<ChunkRow> = {}) {
  return { ...row(id, extra), embedding };
}

function makeDeps(overrides: Partial<RetrievalDeps> = {}): RetrievalDeps {
  return {
    keywordSearch: vi.fn(async () => [row("b"), row("a")]),
    loadChunks: vi.fn(async () => [
      loaded("a", [0, 1, 0, 0]),
      loaded("b", [1, 0, 0, 0]),
      loaded("c", [0.5, 0.5, 0, 0]),
    ]),
    embedQuery: vi.fn(async () => QUERY_VECTOR),
    ...overrides,
  };
}

class SecretError extends Error {
  constructor() {
    super("postgresql://secret");
    this.name = "SecretError";
  }
}

describe("retrieveChunks", () => {
  it("fuses keyword and semantic lists in hybrid mode", async () => {
    const result = await retrieveChunks(input, makeDeps(), { semanticLimit: 2 });
    expect(result.mode).toBe("HYBRID");
    expect(result.warnings).toEqual([]);
    // b is in both lists; a (keyword rank 2) and c (semantic rank 2) tie, broken by id.
    expect(result.chunks.map((c) => c.id)).toEqual(["b", "a", "c"]);
    const [first] = result.chunks;
    expect(first.id).toBe("b");
    expect(first.sources.map((s) => s.name).sort()).toEqual(["keyword", "semantic"]);
    expect(first.similarity).toBeCloseTo(1);
    const a = result.chunks.find((c) => c.id === "a");
    expect(a?.similarity).toBeNull();
    expect(a?.sources.map((s) => s.name)).toEqual(["keyword"]);
    const c = result.chunks.find((chunk) => chunk.id === "c");
    expect(c?.similarity).toBeCloseTo(Math.SQRT1_2);
    expect(c?.sources.map((s) => s.name)).toEqual(["semantic"]);
  });

  it("builds the query text from the full label and the tsQuery without generic words", async () => {
    const deps = makeDeps();
    const result = await retrieveChunks(input, deps);
    expect(result.queryText).toContain("centrifugal pump");
    expect(result.tsQuery).toBe("bearing | noise");
    expect(deps.embedQuery).toHaveBeenCalledWith(result.queryText);
    expect(deps.keywordSearch).toHaveBeenCalledWith("PUMP", "bearing | noise", 8);
  });

  it("falls back to keyword only with an embedding warning when embedQuery fails", async () => {
    const result = await retrieveChunks(
      input,
      makeDeps({ embedQuery: vi.fn(async () => Promise.reject(new EmbeddingError("request", "boom"))) }),
    );
    expect(result.mode).toBe("KEYWORD_ONLY");
    expect(result.warnings.map((w) => w.stage)).toEqual(["embedding"]);
    expect(result.warnings[0].message).toContain("EmbeddingError");
    expect(result.warnings[0].message).toContain("request");
    expect(result.warnings[0].message).not.toContain("boom");
    expect(result.chunks.map((c) => c.id)).toEqual(["b", "a"]);
    expect(result.chunks.every((c) => c.similarity === null)).toBe(true);
  });

  it("gives a similarity warning when only loadChunks fails", async () => {
    const result = await retrieveChunks(
      input,
      makeDeps({ loadChunks: vi.fn(async () => Promise.reject(new SecretError())) }),
    );
    expect(result.mode).toBe("KEYWORD_ONLY");
    expect(result.warnings.map((w) => w.stage)).toEqual(["similarity"]);
    expect(result.chunks.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("gives an embedding warning when embedQuery and loadChunks both fail", async () => {
    const result = await retrieveChunks(
      input,
      makeDeps({
        embedQuery: vi.fn(async () => Promise.reject(new SecretError())),
        loadChunks: vi.fn(async () => Promise.reject(new SecretError())),
      }),
    );
    expect(result.mode).toBe("KEYWORD_ONLY");
    expect(result.warnings.map((w) => w.stage)).toEqual(["embedding"]);
  });

  it("returns NONE when keyword search fails, even if the semantic path works", async () => {
    const result = await retrieveChunks(
      input,
      makeDeps({ keywordSearch: vi.fn(async () => Promise.reject(new SecretError())) }),
    );
    expect(result.mode).toBe("NONE");
    expect(result.chunks).toEqual([]);
    expect(result.warnings.map((w) => w.stage)).toEqual(["keyword"]);
  });

  it("does not call keywordSearch when the tsQuery is empty", async () => {
    const deps = makeDeps();
    const result = await retrieveChunks({ ...input, issue: "a", events: [] }, deps);
    expect(result.tsQuery).toBe("");
    expect(deps.keywordSearch).not.toHaveBeenCalled();
    expect(result.mode).toBe("HYBRID");
    expect(result.chunks.length).toBeGreaterThan(0);
  });

  it("gives HYBRID, no chunks and a no_matches warning when both paths are empty", async () => {
    const result = await retrieveChunks(
      input,
      makeDeps({ keywordSearch: vi.fn(async () => []), loadChunks: vi.fn(async () => []) }),
    );
    expect(result.mode).toBe("HYBRID");
    expect(result.chunks).toEqual([]);
    expect(result.warnings.map((w) => w.stage)).toEqual(["no_matches"]);
  });

  it("reports both embedding and no_matches for KEYWORD_ONLY with zero keyword rows", async () => {
    const result = await retrieveChunks(
      input,
      makeDeps({
        keywordSearch: vi.fn(async () => []),
        embedQuery: vi.fn(async () => Promise.reject(new Error("x"))),
      }),
    );
    expect(result.mode).toBe("KEYWORD_ONLY");
    expect(result.warnings.map((w) => w.stage)).toEqual(["embedding", "no_matches"]);
  });

  it("adds a skipped warning with only the count for wrong-length embeddings", async () => {
    const result = await retrieveChunks(
      input,
      makeDeps({
        loadChunks: vi.fn(async () => [loaded("a", [1, 0]), loaded("b", [1, 0, 0, 0]), loaded("c", [0, 1, 0])]),
      }),
    );
    expect(result.mode).toBe("HYBRID");
    const warning = result.warnings.find((w) => w.stage === "similarity");
    expect(warning?.message).toContain("2 ");
    expect(warning?.message).not.toMatch(/\b[abc]\b/);
  });

  it("never includes embeddings in the result", async () => {
    const result = await retrieveChunks(input, makeDeps());
    expect(JSON.stringify(result)).not.toContain("embedding\"");
    for (const chunk of result.chunks) expect("embedding" in chunk).toBe(false);
  });

  it("never puts error message text in the result", async () => {
    const failing: Partial<RetrievalDeps>[] = [
      { keywordSearch: vi.fn(async () => Promise.reject(new SecretError())) },
      { embedQuery: vi.fn(async () => Promise.reject(new SecretError())) },
      { loadChunks: vi.fn(async () => Promise.reject(new SecretError())) },
    ];
    for (const overrides of failing) {
      const result = await retrieveChunks(input, makeDeps(overrides));
      const json = JSON.stringify(result);
      expect(json).not.toContain("postgresql://secret");
      expect(json).toContain("SecretError");
    }
  });

  it("respects finalLimit", async () => {
    const result = await retrieveChunks(input, makeDeps(), { finalLimit: 2 });
    expect(result.chunks).toHaveLength(2);
  });

  it("hydrates fields from the keyword row first", async () => {
    const result = await retrieveChunks(
      input,
      makeDeps({
        keywordSearch: vi.fn(async () => [row("b", { sectionRef: "kw-ref", heading: "kw heading", content: "kw content" })]),
        loadChunks: vi.fn(async () => [
          loaded("b", [1, 0, 0, 0], { sectionRef: "db-ref", heading: "db heading", content: "db content" }),
        ]),
      }),
    );
    const b = result.chunks.find((c) => c.id === "b");
    expect(b).toMatchObject({ sectionRef: "kw-ref", heading: "kw heading", content: "kw content" });
  });

  it("hydrates a semantic-only chunk from loadChunks", async () => {
    const result = await retrieveChunks(
      input,
      makeDeps({
        keywordSearch: vi.fn(async () => []),
        loadChunks: vi.fn(async () => [
          loaded("z", [1, 0, 0, 0], { sectionRef: "z-ref", heading: "Z heading", content: "Z content" }),
        ]),
      }),
    );
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0]).toMatchObject({
      id: "z",
      sectionRef: "z-ref",
      heading: "Z heading",
      content: "Z content",
      document: "pump-manual",
      equipmentType: "PUMP",
    });
    expect(result.chunks[0].sources.map((s) => s.name)).toEqual(["semantic"]);
    expect(result.chunks[0].similarity).toBeCloseTo(1);
  });
});

describe("retrieveChunks relevance cutoff", () => {
  // Cosine against QUERY_VECTOR [1,0,0,0] equals the first component for unit vectors.
  const HIGH = [1, 0, 0, 0];
  const LOW = [0.1, Math.sqrt(1 - 0.01), 0, 0]; // similarity 0.1

  it("drops a semantic-only chunk below the cutoff and counts it", async () => {
    const result = await retrieveChunks(
      input,
      makeDeps({
        keywordSearch: vi.fn(async () => []),
        loadChunks: vi.fn(async () => [loaded("hi", HIGH), loaded("lo", LOW)]),
      }),
    );
    expect(result.chunks.map((c) => c.id)).toEqual(["hi"]);
    expect(result.belowCutoff).toBe(1);
  });

  it("keeps a chunk exactly at the cutoff", async () => {
    const result = await retrieveChunks(
      input,
      makeDeps({
        keywordSearch: vi.fn(async () => []),
        loadChunks: vi.fn(async () => [loaded("hi", HIGH)]),
      }),
      { minSimilarity: 1 },
    );
    expect(result.chunks.map((c) => c.id)).toEqual(["hi"]);
    expect(result.belowCutoff).toBe(0);
  });

  it("keeps a below-cutoff chunk that the keyword path found, with its similarity", async () => {
    const result = await retrieveChunks(
      input,
      makeDeps({
        keywordSearch: vi.fn(async () => [row("lo")]),
        loadChunks: vi.fn(async () => [loaded("lo", LOW)]),
      }),
    );
    expect(result.belowCutoff).toBe(1);
    expect(result.chunks).toHaveLength(1);
    expect(result.chunks[0].id).toBe("lo");
    expect(result.chunks[0].similarity).toBeCloseTo(0.1);
    expect(result.chunks[0].sources.map((s) => s.name)).toEqual(["keyword"]);
  });

  it("gives HYBRID, no chunks and no_matches when everything is below the cutoff", async () => {
    const result = await retrieveChunks(
      input,
      makeDeps({
        keywordSearch: vi.fn(async () => []),
        loadChunks: vi.fn(async () => [loaded("x", LOW), loaded("y", LOW)]),
      }),
    );
    expect(result.mode).toBe("HYBRID");
    expect(result.chunks).toEqual([]);
    expect(result.warnings.map((w) => w.stage)).toEqual(["no_matches"]);
    expect(result.belowCutoff).toBe(2);
  });

  it("keeps everything with minSimilarity 0", async () => {
    const result = await retrieveChunks(
      input,
      makeDeps({
        keywordSearch: vi.fn(async () => []),
        loadChunks: vi.fn(async () => [loaded("hi", HIGH), loaded("lo", LOW), loaded("zero", [0, 1, 0, 0])]),
      }),
      { minSimilarity: 0 },
    );
    expect(result.chunks.map((c) => c.id).sort()).toEqual(["hi", "lo", "zero"]);
    expect(result.belowCutoff).toBe(0);
  });

  it("reports belowCutoff 0 in KEYWORD_ONLY and NONE modes", async () => {
    const keywordOnly = await retrieveChunks(
      input,
      makeDeps({ embedQuery: vi.fn(async () => Promise.reject(new Error("x"))) }),
    );
    expect(keywordOnly.mode).toBe("KEYWORD_ONLY");
    expect(keywordOnly.belowCutoff).toBe(0);
    const none = await retrieveChunks(
      input,
      makeDeps({ keywordSearch: vi.fn(async () => Promise.reject(new Error("x"))) }),
    );
    expect(none.mode).toBe("NONE");
    expect(none.belowCutoff).toBe(0);
  });
});
