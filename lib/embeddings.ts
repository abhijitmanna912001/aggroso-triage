// No "server-only" and no "@/" alias: this module also runs in plain Node via tsx (scripts/seed.ts).
import OpenAI from "openai";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;

export class EmbeddingError extends Error {
  readonly stage: string;

  constructor(stage: string, message: string) {
    super(message);
    this.name = "EmbeddingError";
    this.stage = stage;
  }
}

export function validateEmbeddings(vectors: number[][], expectedCount: number): void {
  if (vectors.length !== expectedCount) {
    throw new EmbeddingError("validation", `Expected ${expectedCount} embeddings, got ${vectors.length}`);
  }
  vectors.forEach((vector, i) => {
    if (vector.length !== EMBEDDING_DIMENSIONS) {
      throw new EmbeddingError(
        "validation",
        `Embedding ${i} has ${vector.length} dimensions, expected ${EMBEDDING_DIMENSIONS}`,
      );
    }
    if (!vector.every((value) => typeof value === "number" && Number.isFinite(value))) {
      throw new EmbeddingError("validation", `Embedding ${i} contains a non-finite value`);
    }
  });
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new EmbeddingError("config", "OPENAI_API_KEY is not set");
  }

  const client = new OpenAI({ apiKey, timeout: TIMEOUT_MS, maxRetries: MAX_RETRIES });

  let data: { index: number; embedding: number[] }[];
  try {
    const response = await client.embeddings.create({ model: EMBEDDING_MODEL, input: texts });
    data = response.data;
  } catch (error) {
    // Report only the error name and HTTP status, never the SDK message, which may echo request details.
    const status = error instanceof OpenAI.APIError && error.status ? ` (HTTP ${error.status})` : "";
    const name = error instanceof Error ? error.name : "UnknownError";
    throw new EmbeddingError("request", `Embedding request failed: ${name}${status}`);
  }

  const vectors = [...data].sort((a, b) => a.index - b.index).map((item) => item.embedding);
  validateEmbeddings(vectors, texts.length);
  return vectors;
}
