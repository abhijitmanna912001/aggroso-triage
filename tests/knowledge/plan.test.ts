import { describe, expect, it } from "vitest";
import { EMBEDDING_DIMENSIONS } from "../../lib/embeddings";
import { planChunkSync, type ExistingChunk } from "../../lib/knowledge/plan";
import type { ParsedChunk } from "../../lib/knowledge/parse";

function chunk(id: string, content = `content of ${id}`): ParsedChunk {
  return { id, equipmentType: "PUMP", document: "Doc", sectionRef: `Doc §${id}`, heading: id, content };
}

function stored(id: string, content = `content of ${id}`, embeddingLength = EMBEDDING_DIMENSIONS): ExistingChunk {
  return { id, content, embeddingLength };
}

const ids = (chunks: ParsedChunk[]) => chunks.map((c) => c.id);

describe("planChunkSync", () => {
  it("embeds a new chunk", () => {
    const plan = planChunkSync([chunk("a"), chunk("b")], [stored("a")], { force: false });
    expect(ids(plan.toEmbed)).toEqual(["b"]);
    expect(plan.unchanged).toEqual(["a"]);
  });

  it("embeds a chunk whose content changed", () => {
    const plan = planChunkSync([chunk("a", "new text")], [stored("a", "old text")], { force: false });
    expect(ids(plan.toEmbed)).toEqual(["a"]);
    expect(plan.unchanged).toEqual([]);
  });

  it("skips an unchanged chunk", () => {
    const plan = planChunkSync([chunk("a")], [stored("a")], { force: false });
    expect(plan).toEqual({ toEmbed: [], unchanged: ["a"], orphaned: [] });
  });

  it("re-embeds a chunk with the wrong stored embedding length", () => {
    const plan = planChunkSync([chunk("a"), chunk("b")], [stored("a", undefined, 0), stored("b", undefined, 10)], {
      force: false,
    });
    expect(ids(plan.toEmbed)).toEqual(["a", "b"]);
    expect(plan.unchanged).toEqual([]);
  });

  it("re-embeds everything when force is true", () => {
    const plan = planChunkSync([chunk("a"), chunk("b")], [stored("a"), stored("b")], { force: true });
    expect(ids(plan.toEmbed)).toEqual(["a", "b"]);
    expect(plan.unchanged).toEqual([]);
  });

  it("reports orphaned ids and removes nothing from the inputs", () => {
    const parsed = [chunk("a")];
    const existing = [stored("a"), stored("gone")];
    const plan = planChunkSync(parsed, existing, { force: false });
    expect(plan.orphaned).toEqual(["gone"]);
    expect(plan.unchanged).toEqual(["a"]);
    expect(existing.map((c) => c.id)).toEqual(["a", "gone"]);
    expect(parsed.map((c) => c.id)).toEqual(["a"]);
  });

  it("embeds everything when existing is empty", () => {
    const plan = planChunkSync([chunk("a"), chunk("b")], [], { force: false });
    expect(ids(plan.toEmbed)).toEqual(["a", "b"]);
    expect(plan.unchanged).toEqual([]);
    expect(plan.orphaned).toEqual([]);
  });

  it("does not mutate its inputs", () => {
    const parsed = [chunk("a"), chunk("b", "new"), chunk("c")];
    const existing = [stored("z"), stored("b", "old"), stored("a")];
    const parsedBefore = structuredClone(parsed);
    const existingBefore = structuredClone(existing);
    planChunkSync(parsed, existing, { force: false });
    planChunkSync(parsed, existing, { force: true });
    expect(parsed).toEqual(parsedBefore);
    expect(existing).toEqual(existingBefore);
  });

  it("keeps toEmbed and unchanged in parsed order and orphaned in existing order", () => {
    const parsed = [chunk("d"), chunk("a"), chunk("c"), chunk("b")];
    const existing = [stored("y"), stored("a"), stored("x"), stored("b", "old"), stored("w")];
    const plan = planChunkSync(parsed, existing, { force: false });
    expect(ids(plan.toEmbed)).toEqual(["d", "c", "b"]);
    expect(plan.unchanged).toEqual(["a"]);
    expect(plan.orphaned).toEqual(["y", "x", "w"]);
  });
});
