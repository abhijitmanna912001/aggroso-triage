# Design

Equipment Maintenance Triage Assistant. A technician reports an equipment problem. Deterministic code checks sensor thresholds, retrieval finds relevant manual sections, and an LLM proposes possible causes, follow-up questions, inspection steps, a priority and a draft work order, every item with citations. A human edits, approves or rejects. The AI never approves anything and never controls equipment.

## Flow
1. Technician submits a report: equipment, issue, recent events, optional sensor readings.
2. Deterministic threshold checks run (no LLM). Results: OK, WARNING, CRITICAL, MISSING, CONFLICTING.
3. Retrieval pulls relevant manual chunks.
4. The LLM receives the report, the threshold results and the chunks, and returns structured output validated by a Zod schema.
5. Code validates every citation against real ManualChunk ids and real ReportEvent ids. Invalid ones are dropped and noted.
6. Technician edits, approves or rejects the draft work order. Everything is written to history.

The LLM proposes, code verifies, the human decides.

## Layout
- `app/`: pages and server actions (reports/new, reports/[id], equipment/[id])
- `lib/thresholds/`: rules.ts (typed config) and evaluate.ts
- `lib/retrieval/`: retrieveChunks.ts (the one swappable function) and similarity.ts
- `lib/ai/`: schema.ts (Zod), analyze.ts, validateCitations.ts
- `lib/workorder/`: state transitions
- `lib/db.ts`, `lib/logger.ts`
- `knowledge/`: manuals in markdown, one file per equipment type
- `prisma/`: schema, migrations, seed script

## Data model (Prisma, Postgres on Neon)
- Reference: Equipment, ManualChunk (id is a stable slug like `pump-4-2`, embedding is Float[]).
- Report data: Report, ReportEvent, SensorReading.
- Deterministic output: ThresholdResult.
- AI output, one set per run: AnalysisRun, Hypothesis, FollowUpQuestion, InspectionStep. Citations are JSON arrays like `[{"type":"manual","id":"pump-4-2"}]`.
- Human decisions: Observation, Finding, WorkOrder, WorkOrderVersion.
- Audit log: HistoryEntry, append-only, per equipment.
- Every foreign key is ON DELETE RESTRICT. Nothing is deleted.

## Invariants (each needs a test)
- AI code can only create DRAFT work orders. Only the approve and reject server actions set APPROVED or REJECTED, and each needs a technician name.
- A Hypothesis is never confirmed. Only a Finding, created by a named technician, is a confirmed finding.
- Observations, possible causes and confirmed findings are separate tables and separate sections in the UI.
- Work order edits append a WorkOrderVersion. A decision records which version number it applies to.
- A CRITICAL threshold result forces the proposed priority to at least HIGH, whatever the LLM says.
- Failures are stored on AnalysisRun (status, errorStage, errorMessage) and shown in the UI.

## Threshold rules
Typed config in code, not the database, so rules are easy to read and unit test. Sensor names are plain strings validated against this config. CONFLICTING means two readings of the same sensor at the same time disagree beyond a tolerance. MISSING means a sensor the rules expect was not provided.

## Retrieval
Hybrid: Postgres full-text search plus embedding similarity (OpenAI text-embedding-3-small, stored as Float[], cosine similarity computed in Node). If embeddings fail, fall back to keyword-only, mark the run DEGRADED and say so in the UI. The README names pgvector as the upgrade path.

## AI workflow
OpenAI chat model with structured output from a Zod schema, with a timeout. Failure stages (retrieval, model call, parsing, citation validation) are recorded and shown. A failed analysis never blocks a technician from writing the work order by hand.

## Caching (Next.js Cache Components)
Reports, work orders, analysis runs and history are never cached and are read inside Suspense. Only the manual chunk list may use 'use cache', and it must work on a cache miss.

## Hosting
Vercel for the app, Neon Postgres. Prisma 7.10.0 pinned. The app uses the pooled DATABASE_URL through @prisma/adapter-pg. The Prisma CLI uses DIRECT_URL through prisma7.config.ts. `prisma generate` runs on install so the build has the client.

## Identity
No real auth. A technician name is chosen from a seeded list and kept in a cookie, and every decision records that name. Real authentication is excluded scope.

## Excluded scope
Live IoT integration, predictive maintenance models, inventory management, technician dispatch, real authentication, pgvector.