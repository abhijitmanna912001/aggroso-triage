// Run with tsx from the repo root: npm run seed:dry first, then npm run seed.
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import type { EquipmentType } from "../generated/prisma/enums";
import { embedTexts, EmbeddingError } from "../lib/embeddings";
import { loadManualChunks } from "../lib/knowledge/manuals";
import { planChunkSync } from "../lib/knowledge/plan";

config({ path: ".env.local" });

const SAMPLE_EQUIPMENT: readonly { type: EquipmentType; tag: string; name: string }[] = [
  { type: "PUMP", tag: "PUMP-101", name: "Cooling water pump A" },
  { type: "PUMP", tag: "PUMP-102", name: "Boiler feed pump B" },
  { type: "COMPRESSOR", tag: "CMP-201", name: "Instrument air compressor 1" },
  { type: "COMPRESSOR", tag: "CMP-202", name: "Workshop air compressor 2" },
  { type: "MOTOR", tag: "MTR-301", name: "Conveyor drive motor" },
  { type: "MOTOR", tag: "MTR-302", name: "Fan drive motor" },
];

const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");

function printIds(label: string, ids: string[]): void {
  console.log(`${label}: ${ids.length}${ids.length > 0 ? ` (${ids.join(", ")})` : ""}`);
}

async function main(): Promise<void> {
  const connectionString = process.env.DIRECT_URL;
  if (!connectionString) {
    console.error("Missing environment variable: DIRECT_URL");
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const parsed = loadManualChunks();

    const rows = await prisma.manualChunk.findMany({ select: { id: true, content: true, embedding: true } });
    const existing = rows.map((row) => ({
      id: row.id,
      content: row.content,
      embeddingLength: row.embedding.length,
    }));

    const plan = planChunkSync(parsed, existing, { force });
    console.log(`Chunks parsed: ${parsed.length}`);
    printIds("To embed", plan.toEmbed.map((chunk) => chunk.id));
    console.log(`Unchanged: ${plan.unchanged.length}`);
    printIds("Orphaned (kept, never deleted)", plan.orphaned);

    if (dryRun) {
      console.log(`Equipment that would be upserted: ${SAMPLE_EQUIPMENT.length}`);
      console.log("Dry run: no OpenAI calls were made and nothing was written.");
      return;
    }

    let vectors: number[][] = [];
    if (plan.toEmbed.length > 0) {
      if (!process.env.OPENAI_API_KEY) {
        console.error("Missing environment variable: OPENAI_API_KEY");
        process.exitCode = 1;
        return;
      }
      try {
        vectors = await embedTexts(plan.toEmbed.map((chunk) => chunk.content));
      } catch (error) {
        if (error instanceof EmbeddingError) {
          console.error(`Embedding failed at stage "${error.stage}": ${error.message}`);
          console.error("Nothing was written.");
          process.exitCode = 1;
          return;
        }
        throw error;
      }
    }

    // Many sequential upserts over a remote connection can exceed Prisma's default 5 second transaction limit.
    await prisma.$transaction(async (tx) => {
      for (const machine of SAMPLE_EQUIPMENT) {
        await tx.equipment.upsert({
          where: { tag: machine.tag },
          update: { type: machine.type, name: machine.name },
          create: machine,
        });
      }
      for (const [i, chunk] of plan.toEmbed.entries()) {
        const fields = {
          equipmentType: chunk.equipmentType,
          document: chunk.document,
          sectionRef: chunk.sectionRef,
          heading: chunk.heading,
          content: chunk.content,
          embedding: vectors[i],
        };
        await tx.manualChunk.upsert({
          where: { id: chunk.id },
          update: fields,
          create: { id: chunk.id, ...fields },
        });
      }
    }, { timeout: 60_000, maxWait: 10_000 });

    console.log(`Embedded: ${plan.toEmbed.length}`);
    console.log(`Equipment upserted: ${SAMPLE_EQUIPMENT.length}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  // Raw messages from Prisma/pg can contain connection details, so print only the error name.
  console.error(`Seed failed: ${error instanceof Error ? error.name : "UnknownError"}`);
  process.exitCode = 1;
});
