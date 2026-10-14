import { EMBEDDING_DIMENSIONS } from "../embeddings";
import type { ParsedChunk } from "./parse";

export type ExistingChunk = {
  id: string;
  content: string;
  embeddingLength: number;
};

export type ChunkSyncPlan = {
  toEmbed: ParsedChunk[];
  unchanged: string[];
  /** Stored ids no longer in the manuals. Reported only, never deleted: past citations may reference them. */
  orphaned: string[];
};

export function planChunkSync(
  parsed: readonly ParsedChunk[],
  existing: readonly ExistingChunk[],
  { force }: { force: boolean },
): ChunkSyncPlan {
  const stored = new Map(existing.map((chunk) => [chunk.id, chunk]));
  const parsedIds = new Set(parsed.map((chunk) => chunk.id));

  const toEmbed: ParsedChunk[] = [];
  const unchanged: string[] = [];

  for (const chunk of parsed) {
    const current = stored.get(chunk.id);
    const needsEmbedding =
      force ||
      current === undefined ||
      current.content !== chunk.content ||
      current.embeddingLength !== EMBEDDING_DIMENSIONS;
    if (needsEmbedding) toEmbed.push(chunk);
    else unchanged.push(chunk.id);
  }

  const orphaned = existing.filter((chunk) => !parsedIds.has(chunk.id)).map((chunk) => chunk.id);
  return { toEmbed, unchanged, orphaned };
}
