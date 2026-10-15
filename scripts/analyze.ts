// Run with tsx from the repo root: npm run analyze -- --scenario pump-bearing [--show-prompt] [--show-raw] [--no-model] [--no-embeddings]
// This spends the paid OpenAI key (embeddings and the model call). It never prints env values.
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { EmbeddingError } from "../lib/embeddings";
import { buildAnalysisPrompt } from "../lib/analysis/prompt";
import { DEFAULT_MODEL, createOpenAiCallModel, createOpenAiClient, readOpenAiConfig } from "../lib/analysis/openai";
import { runAnalysis } from "../lib/analysis/run";
import { createPrismaRetrievalDeps, embedForRetrieval } from "../lib/retrieval/prisma-deps";
import { retrieveChunks } from "../lib/retrieval/retrieve";
import { evaluateThresholds, minimumPriority } from "../lib/thresholds/evaluate";
import { SCENARIOS } from "./analyze-scenarios";

config({ path: ".env.local" });

const USAGE =
  "Usage: npm run analyze -- --scenario <name> [--show-prompt] [--show-raw] [--no-model] [--no-embeddings]";

type Args = {
  scenario: string | undefined;
  showPrompt: boolean;
  showRaw: boolean;
  noModel: boolean;
  noEmbeddings: boolean;
};

function parseArgs(argv: string[]): Args | null {
  const args: Args = { scenario: undefined, showPrompt: false, showRaw: false, noModel: false, noEmbeddings: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--scenario") args.scenario = argv[++i];
    else if (arg === "--show-prompt") args.showPrompt = true;
    else if (arg === "--show-raw") args.showRaw = true;
    else if (arg === "--no-model") args.noModel = true;
    else if (arg === "--no-embeddings") args.noEmbeddings = true;
    else return null;
  }
  return args.scenario === undefined ? null : args;
}

function printScenarioList(): void {
  console.error("Scenarios:");
  for (const s of SCENARIOS) console.error(`  ${s.name}`);
}

function formatCitations(citations: { type: string; id: string }[]): string {
  return citations.length === 0 ? "-" : citations.map((c) => `${c.type}:${c.id}`).join(", ");
}

function section(title: string): void {
  console.log(`\n== ${title} ==`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    console.error(USAGE);
    printScenarioList();
    process.exitCode = 1;
    return;
  }
  const scenario = SCENARIOS.find((s) => s.name === args.scenario);
  if (!scenario) {
    console.error(`Unknown scenario: ${args.scenario}`);
    printScenarioList();
    process.exitCode = 1;
    return;
  }

  const needsKey = !(args.noModel && args.noEmbeddings);
  if (needsKey && !process.env.OPENAI_API_KEY) {
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

  const openAi = process.env.OPENAI_API_KEY ? readOpenAiConfig(process.env) : null;
  const modelName = openAi?.model ?? DEFAULT_MODEL;

  const events = scenario.events.map((description, i) => ({ id: i + 1, occurredAt: null, description }));
  const thresholds = evaluateThresholds(scenario.equipment.type, scenario.readings);
  const floor = minimumPriority(thresholds);

  const embed = args.noEmbeddings
    ? async (): Promise<number[][]> => {
        throw new EmbeddingError("request", "simulated failure");
      }
    : embedForRetrieval;

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    const retrieval = await retrieveChunks(
      { equipmentType: scenario.equipment.type, issue: scenario.issue, events, thresholds },
      createPrismaRetrievalDeps(prisma, embed),
    );

    const input = {
      equipment: scenario.equipment,
      issue: scenario.issue,
      events,
      thresholds,
      chunks: retrieval.chunks.map((c) => ({
        id: c.id,
        sectionRef: c.sectionRef,
        heading: c.heading,
        content: c.content,
      })),
      answeredQuestions: [],
      priorityFloor: floor,
    };

    section("Scenario");
    console.log(`${scenario.name}: ${scenario.equipment.type} ${scenario.equipment.tag} (${scenario.equipment.name})`);

    section("Threshold results");
    for (const t of thresholds) console.log(`${t.sensor}: ${t.status}`);
    console.log(`Priority floor: ${floor ?? "none"}`);

    section("Retrieval");
    console.log(`mode: ${retrieval.mode}`);
    for (const w of retrieval.warnings) console.log(`warning [${w.stage}]: ${w.message}`);
    console.log(`chunks: ${retrieval.chunks.map((c) => c.id).join(", ") || "none"}`);

    if (args.showPrompt) {
      const prompt = buildAnalysisPrompt(input);
      section("Instructions");
      console.log(prompt.instructions);
      section("User input");
      console.log(prompt.userInput);
    }

    section("Model");
    console.log(modelName);

    if (args.noModel) {
      console.log("(model call skipped: --no-model)");
      return;
    }
    if (!openAi) throw new Error("unreachable: key checked above");

    const callModel = createOpenAiCallModel(createOpenAiClient(openAi.apiKey), openAi.model);
    const result = await runAnalysis(
      { ...input, retrievalMode: retrieval.mode },
      { callModel, now: () => Date.now(), model: openAi.model },
    );

    section("Run");
    console.log(`status: ${result.status}`);
    console.log(`latencyMs: ${result.latencyMs}`);
    console.log(`failure: ${result.failure ? `${result.failure.stage}: ${result.failure.message}` : "none"}`);
    console.log(`degradedReasons: ${result.degradedReasons.join("; ") || "none"}`);

    if (args.showRaw) {
      section("Raw parsed output");
      console.log(JSON.stringify(result.rawOutput, null, 2));
    }

    const validated = result.validated;
    if (!validated) return;
    const a = validated.accepted;

    section("Possible causes");
    for (const [i, h] of a.hypotheses.entries()) {
      console.log(`${i + 1}. ${h.cause} [${h.confidence}] cites ${formatCitations(h.citations)}`);
    }
    section("Follow-up questions");
    for (const [i, q] of a.followUpQuestions.entries()) {
      console.log(`${i + 1}. ${q.question} cites ${formatCitations(q.citations)}`);
    }
    section("Inspection steps");
    for (const [i, s] of a.inspectionSteps.entries()) {
      console.log(`${i + 1}. ${s.instruction} cites ${formatCitations(s.citations)}`);
    }
    section("Limitations");
    for (const l of a.limitations) console.log(`- ${l}`);

    section("Priority");
    console.log(`priority: ${a.priority}`);
    console.log(`priorityRaisedByFloor: ${validated.priorityRaisedByFloor}`);
    console.log(`rationale: ${a.priorityRationale}`);

    section("Draft work order");
    console.log(`title: ${a.draftWorkOrder.title}`);
    console.log("description:");
    console.log(a.draftWorkOrder.description);

    section("Dropped items and notes");
    for (const d of validated.dropped) console.log(`dropped ${d.kind} #${d.index}: ${d.reason}`);
    for (const n of validated.notes) console.log(`note: ${n}`);
    if (validated.dropped.length === 0 && validated.notes.length === 0) console.log("none");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  // Raw messages from Prisma/pg/OpenAI can contain connection details, so print only the error name.
  console.error(`Analyze failed: ${error instanceof Error ? error.name : "UnknownError"}`);
  process.exitCode = 1;
});
