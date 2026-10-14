import { afterEach, describe, expect, it, vi } from "vitest";
import { EMBEDDING_DIMENSIONS, EmbeddingError, embedTexts, validateEmbeddings } from "../lib/embeddings";

const vector = () => new Array<number>(EMBEDDING_DIMENSIONS).fill(0.5);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("validateEmbeddings", () => {
  it("accepts valid input", () => {
    expect(() => validateEmbeddings([vector(), vector()], 2)).not.toThrow();
  });

  it("rejects a wrong count", () => {
    expect(() => validateEmbeddings([vector()], 2)).toThrow(EmbeddingError);
  });

  it("rejects wrong dimensions", () => {
    expect(() => validateEmbeddings([[1, 2, 3]], 1)).toThrow(EmbeddingError);
  });

  it("rejects NaN", () => {
    const v = vector();
    v[5] = NaN;
    expect(() => validateEmbeddings([v], 1)).toThrow(EmbeddingError);
  });

  it("rejects Infinity", () => {
    const v = vector();
    v[5] = Infinity;
    expect(() => validateEmbeddings([v], 1)).toThrow(EmbeddingError);
  });
});

describe("embedTexts", () => {
  it("returns [] for an empty list without a key and without a network call", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(embedTexts([])).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws EmbeddingError when OPENAI_API_KEY is unset", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    await expect(embedTexts(["hello"])).rejects.toBeInstanceOf(EmbeddingError);
  });
});
