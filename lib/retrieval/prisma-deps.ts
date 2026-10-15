// Pure module: no "server-only", no "@/" alias, so it runs in plain Node under tsx, vitest and Next.
import type { EquipmentType } from "../../generated/prisma/enums";
import { embedTexts } from "../embeddings";
import type { ChunkRow, RetrievalDeps } from "./retrieve";

type LoadedChunk = ChunkRow & { embedding: number[] };

// The minimal slice of PrismaClient this module uses, so both the real client and a test fake satisfy it.
// Method syntax keeps parameter comparison bivariant, which lets the generic Prisma signatures assign to it.
export type RetrievalDb = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  manualChunk: {
    findMany(args: {
      where: { equipmentType: EquipmentType };
      select: {
        id: true;
        equipmentType: true;
        document: true;
        sectionRef: true;
        heading: true;
        content: true;
        embedding: true;
      };
      orderBy: { id: "asc" };
    }): Promise<LoadedChunk[]>;
  };
};

export function embedForRetrieval(texts: string[]): Promise<number[][]> {
  return embedTexts(texts, { timeoutMs: 10_000, maxRetries: 1 });
}

function toChunkRow(row: ChunkRow): ChunkRow {
  return {
    id: row.id,
    equipmentType: row.equipmentType,
    document: row.document,
    sectionRef: row.sectionRef,
    heading: row.heading,
    content: row.content,
  };
}

export function createPrismaRetrievalDeps(
  db: RetrievalDb,
  embed: (texts: string[]) => Promise<number[][]>,
): RetrievalDeps {
  return {
    async keywordSearch(equipmentType, tsQuery, limit) {
      // One parameterized query: every value is a bound parameter, never concatenated into the SQL text.
      const rows = await db.$queryRaw<ChunkRow[]>`
        select id, "equipmentType", document, "sectionRef", heading, content
        from "ManualChunk"
        where "equipmentType" = ${equipmentType}::"EquipmentType"
          and (setweight(to_tsvector('english', heading), 'A') || setweight(to_tsvector('english', content), 'B'))
            @@ to_tsquery('english', ${tsQuery})
        order by
          ts_rank(
            (setweight(to_tsvector('english', heading), 'A') || setweight(to_tsvector('english', content), 'B')),
            to_tsquery('english', ${tsQuery})
          ) desc,
          id asc
        limit ${limit}
      `;
      return rows.map(toChunkRow);
    },

    async loadChunks(equipmentType) {
      const rows = await db.manualChunk.findMany({
        where: { equipmentType },
        select: {
          id: true,
          equipmentType: true,
          document: true,
          sectionRef: true,
          heading: true,
          content: true,
          embedding: true,
        },
        orderBy: { id: "asc" },
      });
      return rows.map((row) => ({ ...toChunkRow(row), embedding: row.embedding }));
    },

    async embedQuery(text) {
      const [vector] = await embed([text]);
      if (!vector) throw new Error("Embedding returned no vector");
      return vector;
    },
  };
}
