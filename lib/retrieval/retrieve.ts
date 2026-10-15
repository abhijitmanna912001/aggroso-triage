// Pure module: no "server-only", no "@/" alias, no logging, so it runs in plain Node under tsx and vitest.
import type { EquipmentType } from "../../generated/prisma/enums";
import { EmbeddingError } from "../embeddings";
import { reciprocalRankFusion } from "./fusion";
import { GENERIC_QUERY_WORDS, buildRetrievalQuery, toTsQueryString, type RetrievalQueryInput } from "./query";
import { rankBySimilarity } from "./similarity";

// Semantic matches scoring below this cosine similarity are not fused (keyword matches are unaffected).
export const MIN_SIMILARITY = 0.4;

export type RetrievalMode ="HYBRID" | "KEYWORD_ONLY" | "NONE";

export type ChunkRow = {
  id: string;
  equipmentType: EquipmentType;
  document: string;
  sectionRef: string;
  heading: string;
  content: string;
};

export type RetrievedChunk = ChunkRow & {
  score: number;
  // Cosine score when the semantic path ranked the chunk, otherwise null.
  similarity: number | null;
  sources: { name: string; rank: number }[];
};

export type RetrievalWarning = {
  stage: "embedding" | "similarity" | "keyword" | "no_matches";
  message: string;
};

export type RetrievalResult = {
  mode: RetrievalMode;
  chunks: RetrievedChunk[];
  warnings: RetrievalWarning[];
  queryText: string;
  tsQuery: string;
  // Ranked semantic items left out of fusion for scoring below minSimilarity.
  belowCutoff: number;
};

export type RetrievalDeps = {
  // Rows are already ranked best first.
  keywordSearch(equipmentType: EquipmentType, tsQuery: string, limit: number): Promise<ChunkRow[]>;
  loadChunks(equipmentType: EquipmentType): Promise<(ChunkRow & { embedding: number[] })[]>;
  embedQuery(text: string): Promise<number[]>;
};

type SemanticFailureStage = "embedding" | "similarity";

class SemanticPathError extends Error {
  readonly stage: SemanticFailureStage;
  readonly cause: unknown;

  constructor(stage: SemanticFailureStage, cause: unknown) {
    super(stage);
    this.name = "SemanticPathError";
    this.stage = stage;
    this.cause = cause;
  }
}

// Only the error name (and an EmbeddingError's stage) is ever reported: Prisma and pg messages can contain
// connection details, so message text must never reach a warning.
function describeError(error: unknown): string {
  const name = error instanceof Error ? error.name : "UnknownError";
  return error instanceof EmbeddingError ? `${name}, stage ${error.stage}` : name;
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

export async function retrieveChunks(
  input: RetrievalQueryInput,
  deps: RetrievalDeps,
  options: { keywordLimit?: number; semanticLimit?: number; finalLimit?: number; minSimilarity?: number } = {},
): Promise<RetrievalResult> {
  const minSimilarity = options.minSimilarity ?? MIN_SIMILARITY;
  const keywordLimit = options.keywordLimit ?? 8;
  const semanticLimit = options.semanticLimit ?? 8;
  const finalLimit = options.finalLimit ?? 6;

  const queryText = buildRetrievalQuery(input);
  const tsQuery = toTsQueryString(queryText, { exclude: GENERIC_QUERY_WORDS[input.equipmentType] });
  const warnings: RetrievalWarning[] = [];

  const keywordPath = async (): Promise<ChunkRow[]> => {
    if (tsQuery === "") return [];
    return deps.keywordSearch(input.equipmentType, tsQuery, keywordLimit);
  };

  const semanticPath = async () => {
    const [embedded, loaded] = await Promise.allSettled([
      deps.embedQuery(queryText),
      deps.loadChunks(input.equipmentType),
    ]);
    if (embedded.status === "rejected") throw new SemanticPathError("embedding", embedded.reason);
    if (loaded.status === "rejected") throw new SemanticPathError("similarity", loaded.reason);
    try {
      const { ranked, skipped } = rankBySimilarity(embedded.value, loaded.value, semanticLimit);
      return { ranked, skipped, chunks: loaded.value };
    } catch (error) {
      throw new SemanticPathError("similarity", error);
    }
  };

  const [keyword, semantic] = await Promise.allSettled([keywordPath(), semanticPath()]);

  // Both paths read the same database, so a keyword failure means retrieval as a whole is unusable.
  if (keyword.status === "rejected") {
    warnings.push({
      stage: "keyword",
      message: `Keyword search failed (${describeError(keyword.reason)}); no manual sections were retrieved.`,
    });
    return { mode: "NONE", chunks: [], warnings, queryText, tsQuery, belowCutoff: 0 };
  }

  let mode: RetrievalMode;
  let belowCutoff = 0;
  const lists = [{ name: "keyword", ids: keyword.value.map((row) => row.id) }];
  const semanticRows = new Map<string, ChunkRow>();
  const similarityById = new Map<string, number>();

  if (semantic.status === "rejected") {
    mode = "KEYWORD_ONLY";
    const reason = semantic.reason;
    const stage: SemanticFailureStage = reason instanceof SemanticPathError ? reason.stage : "similarity";
    const cause = reason instanceof SemanticPathError ? reason.cause : reason;
    warnings.push({
      stage,
      message:
        stage === "embedding"
          ? `Query embedding failed (${describeError(cause)}); using keyword search only.`
          : `Semantic ranking failed (${describeError(cause)}); using keyword search only.`,
    });
  } else {
    mode = "HYBRID";
    const { ranked, skipped, chunks } = semantic.value;
    // A cutoff of 0 or less disables filtering, so it matches the behaviour before the cutoff existed.
    const kept = minSimilarity <= 0 ? ranked : ranked.filter((item) => item.score >= minSimilarity);
    belowCutoff = ranked.length - kept.length;
    lists.push({ name: "semantic", ids: kept.map((item) => item.id) });
    // Every ranked score is kept for reporting, so a chunk the keyword path found still shows its similarity.
    for (const item of ranked) similarityById.set(item.id, item.score);
    for (const row of chunks) semanticRows.set(row.id, row);
    if (skipped.length > 0) {
      warnings.push({
        stage: "similarity",
        message: `${skipped.length} manual section(s) were skipped in semantic ranking because their embeddings did not match the query.`,
      });
    }
  }

  const keywordRows = new Map(keyword.value.map((row) => [row.id, row] as const));
  const fused = reciprocalRankFusion(lists, { limit: finalLimit });

  const chunks: RetrievedChunk[] = [];
  for (const item of fused) {
    const row = keywordRows.get(item.id) ?? semanticRows.get(item.id);
    if (!row) continue;
    chunks.push({
      ...toChunkRow(row),
      score: item.score,
      similarity: similarityById.get(item.id) ?? null,
      sources: item.sources,
    });
  }

  if (chunks.length === 0) {
    warnings.push({ stage: "no_matches", message: "No manual sections matched this report." });
  }

  return { mode, chunks, warnings, queryText, tsQuery, belowCutoff };
}
