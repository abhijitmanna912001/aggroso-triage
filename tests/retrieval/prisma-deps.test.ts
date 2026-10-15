import { describe, expect, it, vi } from "vitest";
import { createPrismaRetrievalDeps, type RetrievalDb } from "../../lib/retrieval/prisma-deps";

function makeDb(rows: unknown[] = [], chunks: unknown[] = []) {
  const queryRaw = vi.fn<(...args: unknown[]) => Promise<unknown[]>>(async () => rows);
  const findMany = vi.fn<(...args: unknown[]) => Promise<unknown[]>>(async () => chunks);
  const db = { $queryRaw: queryRaw, manualChunk: { findMany } } as unknown as RetrievalDb;
  return { db, queryRaw, findMany };
}

const noEmbed = async (): Promise<number[][]> => [];

describe("keywordSearch", () => {
  it("passes tsQuery, equipment type and limit as bound values, never in the SQL text", async () => {
    const { db, queryRaw } = makeDb();
    await createPrismaRetrievalDeps(db, noEmbed).keywordSearch("PUMP", "bearing | noise", 8);

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const [strings, ...values] = queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    expect(values).toContain("PUMP");
    expect(values).toContain("bearing | noise");
    expect(values).toContain(8);
    const sql = strings.join("");
    expect(sql).not.toContain("PUMP'");
    expect(sql).not.toContain("bearing");
    expect(sql).not.toContain("noise");
    expect(sql).not.toMatch(/limit\s+8/i);
  });

  it("maps rows to ChunkRow and drops extra columns", async () => {
    const { db } = makeDb([
      {
        id: "pump-4-2",
        equipmentType: "PUMP",
        document: "pump-manual",
        sectionRef: "4.2",
        heading: "Bearings",
        content: "Check bearings.",
        rank: 0.9,
      },
    ]);
    const result = await createPrismaRetrievalDeps(db, noEmbed).keywordSearch("PUMP", "bearings", 5);
    expect(result).toEqual([
      {
        id: "pump-4-2",
        equipmentType: "PUMP",
        document: "pump-manual",
        sectionRef: "4.2",
        heading: "Bearings",
        content: "Check bearings.",
      },
    ]);
  });
});

describe("loadChunks", () => {
  it("asks for the right type ordered by id and returns the embeddings", async () => {
    const { db, findMany } = makeDb(
      [],
      [
        {
          id: "motor-1-1",
          equipmentType: "MOTOR",
          document: "motor-manual",
          sectionRef: "1.1",
          heading: "Overview",
          content: "Text",
          embedding: [0.1, 0.2],
        },
      ],
    );
    const result = await createPrismaRetrievalDeps(db, noEmbed).loadChunks("MOTOR");

    const args = findMany.mock.calls[0][0] as { where: unknown; orderBy: unknown };
    expect(args.where).toEqual({ equipmentType: "MOTOR" });
    expect(args.orderBy).toEqual({ id: "asc" });
    expect(result).toHaveLength(1);
    expect(result[0].embedding).toEqual([0.1, 0.2]);
  });
});

describe("embedQuery", () => {
  it("calls embed with [text] and returns the first vector", async () => {
    const embed = vi.fn<(texts: string[]) => Promise<number[][]>>(async () => [[1, 2, 3]]);
    const { db } = makeDb();
    const vector = await createPrismaRetrievalDeps(db, embed).embedQuery("hello");
    expect(embed).toHaveBeenCalledWith(["hello"]);
    expect(vector).toEqual([1, 2, 3]);
  });

  it("throws when embed returns no vectors", async () => {
    const { db } = makeDb();
    await expect(createPrismaRetrievalDeps(db, noEmbed).embedQuery("hello")).rejects.toThrow();
  });
});
