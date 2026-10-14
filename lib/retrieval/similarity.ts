// Pure module: no "server-only", no "@/" alias, so it runs in plain Node under tsx and vitest.

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) {
    throw new RangeError(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export type SimilarityItem = { id: string; embedding: readonly number[] };
export type ScoredId = { id: string; score: number };

export function rankBySimilarity(
  queryVector: readonly number[],
  items: readonly SimilarityItem[],
  limit: number,
): { ranked: ScoredId[]; skipped: string[] } {
  const scored: ScoredId[] = [];
  const skipped: string[] = [];

  for (const item of items) {
    if (item.embedding.length !== queryVector.length) {
      skipped.push(item.id);
    } else {
      scored.push({ id: item.id, score: cosineSimilarity(queryVector, item.embedding) });
    }
  }

  scored.sort((x, y) => y.score - x.score || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  return { ranked: scored.slice(0, limit), skipped };
}
