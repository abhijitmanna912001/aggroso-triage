// Run with tsx from the repo root: npm run retrieve -- --type PUMP "free text describing the problem"
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import type { EquipmentType } from "../generated/prisma/enums";
import { EmbeddingError } from "../lib/embeddings";
import { createPrismaRetrievalDeps, embedForRetrieval } from "../lib/retrieval/prisma-deps";
import { retrieveChunks, type RetrievalDeps } from "../lib/retrieval/retrieve";

config({ path: ".env.local" });

const TYPES: readonly EquipmentType[] = ["PUMP", "COMPRESSOR", "MOTOR"];
const USAGE =
  'Usage: npm run retrieve -- --type PUMP|COMPRESSOR|MOTOR [--no-embeddings] [--debug] "free text describing the problem"';

type Args = { type: EquipmentType; text: string; noEmbeddings: boolean; debug: boolean };

function parseArgs(argv: string[]): Args | null {
  let rawType: string | undefined;
  let noEmbeddings = false;
  let debug = false;
  const words: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--type") rawType = argv[++i];
    else if (arg === "--no-embeddings") noEmbeddings = true;
    else if (arg === "--debug") debug = true;
    else words.push(arg);
  }
  const type = TYPES.find((t) => t === rawType);
  const text = words.join(" ").trim();
  if (!type || text === "") return null;
  return { type, text, noEmbeddings, debug };
}

// For local debugging only: raw messages can contain host names, so the library never reports them.
function withDebug(deps: RetrievalDeps): RetrievalDeps {
  const report = (name: string, error: unknown): void => {
    console.error(`[debug] ${name} failed: ${error instanceof Error ? error.message : String(error)}`);
  };
  return {
    async keywordSearch(...args) {
      try {
        return await deps.keywordSearch(...args);
      } catch (error) {
        report("keywordSearch", error);
        throw error;
      }
    },
    async loadChunks(...args) {
      try {
        return await deps.loadChunks(...args);
      } catch (error) {
        report("loadChunks", error);
        throw error;
      }
    },
    async embedQuery(...args) {
      try {
        return await deps.embedQuery(...args);
      } catch (error) {
        report("embedQuery", error);
        throw error;
      }
    },
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  if (!args.noEmbeddings && !process.env.OPENAI_API_KEY) {
    console.error("Missing environment variable: OPENAI_API_KEY");
    process.exitCode = 1;
    return;
  }
  const connectionString = process.env.DIRECT_URL;
  if (!connectionString) {
    console.error("Missing environment variable: DIRECT_URL");
    process.exitCode = 1;
    return;
  }

  const embed = args.noEmbeddings
    ? async (): Promise<number[][]> => {
        throw new EmbeddingError("request", "simulated failure");
      }
    : embedForRetrieval;

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    let deps = createPrismaRetrievalDeps(prisma, embed);
    if (args.debug) deps = withDebug(deps);

    const result = await retrieveChunks(
      { equipmentType: args.type, issue: args.text, events: [], thresholds: [] },
      deps,
    );

    console.log(`mode: ${result.mode}`);
    console.log(`queryText: ${result.queryText}`);
    console.log(`tsQuery: ${result.tsQuery}`);
    console.log(`belowCutoff: ${result.belowCutoff}`);
    for (const warning of result.warnings) console.log(`[${warning.stage}] ${warning.message}`);
    for (const [i, chunk] of result.chunks.entries()) {
      const similarity = chunk.similarity === null ? "-" : chunk.similarity.toFixed(3);
      const sources = chunk.sources.map((s) => `${s.name}#${s.rank}`).join(" ");
      console.log(
        `${i + 1}. ${chunk.id} ${chunk.sectionRef} ${chunk.heading} score=${chunk.score.toFixed(6)} similarity=${similarity} ${sources}`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  // Raw messages from Prisma/pg can contain connection details, so print only the error name.
  console.error(`Retrieve failed: ${error instanceof Error ? error.name : "UnknownError"}`);
  process.exitCode = 1;
});
