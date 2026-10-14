// Pure module: no "server-only", no "@/" alias, so it runs in plain Node under tsx and vitest.

export const RRF_K = 60;

export type RankedList = { name: string; ids: readonly string[] };
export type FusedItem = {
  id: string;
  score: number;
  sources: { name: string; rank: number }[];
};

export function reciprocalRankFusion(
  lists: readonly RankedList[],
  options: { k?: number; limit: number },
): FusedItem[] {
  const k = options.k ?? RRF_K;
  const byId = new Map<string, FusedItem & { bestRank: number }>();

  for (const list of lists) {
    const seen = new Set<string>();
    let rank = 0;
    for (const id of list.ids) {
      if (seen.has(id)) continue;
      seen.add(id);
      rank += 1;
      let entry = byId.get(id);
      if (!entry) {
        entry = { id, score: 0, sources: [], bestRank: rank };
        byId.set(id, entry);
      }
      entry.score += 1 / (k + rank);
      entry.sources.push({ name: list.name, rank });
      if (rank < entry.bestRank) entry.bestRank = rank;
    }
  }

  return [...byId.values()]
    .sort(
      (a, b) =>
        b.score - a.score || a.bestRank - b.bestRank || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )
    .slice(0, options.limit)
    .map(({ id, score, sources }) => ({ id, score, sources }));
}
