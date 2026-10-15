# Equipment Maintenance Triage Assistant

A technician reports an equipment problem. Fixed rules check the sensor readings, relevant manual sections are retrieved, and an AI model drafts possible causes, follow-up questions, inspection steps, a priority and a work order, with every suggestion cited. The technician edits, approves or rejects. The AI cannot approve anything and cannot control equipment.

- **Live app:** https://aggroso-triage.vercel.app/
- **Repository:** https://github.com/abhijitmanna912001/aggroso-triage
- **How I used AI tools while building it:** see [AGENT_USAGE.md](./AGENT_USAGE.md)

## What it does
- **Report form:** equipment, issue, recent events (with optional times) and optional sensor readings. Three sample reports can be loaded with one click.
- **Deterministic threshold checks** (plain code, no AI) per sensor: OK, WARNING, CRITICAL, MISSING or CONFLICTING.
- **Hybrid retrieval** over the equipment manuals: Postgres full-text search plus embedding similarity, merged by reciprocal rank fusion, with a relevance cutoff.
- **AI analysis** (OpenAI, structured output): possible causes (never confirmed), follow-up questions, inspection steps, a proposed priority and a draft work order. Every item cites a manual section, a report event or a threshold result, and the code checks each citation.
- The report page keeps **observations, possible causes and confirmed findings in separate sections**. Only a named technician can confirm a finding.
- **Work orders:** the AI creates a draft; a technician edits (each edit is a new version), approves or rejects (a rejection needs a reason).
- **History:** every report, check, analysis run and decision is saved in an append-only log, shown per equipment.
- **Failures are shown, not hidden:** a failed or degraded run shows its stage and reasons; a failed embedding call falls back to keyword search with a visible notice.

## How a report flows
1. The technician submits a report. It is validated and saved with its events and readings.
2. Threshold rules run in code and the results are saved.
3. When the technician presses **Run analysis**, the report text and abnormal sensors are used to retrieve manual sections.
4. The model receives the report, the threshold results and the retrieved sections, and returns output that must match a schema.
5. Code validates every citation against the items that were really supplied, drops anything unsupported, and composes the work order text from the validated items only.
6. The run, its causes, questions and steps, and the draft work order are saved in one transaction.
7. A technician reviews, edits, approves or rejects.

## Rules the code enforces
- The AI can only create a `DRAFT` work order. Only the approve and reject actions can set `APPROVED` or `REJECTED`, and only through one conditional database update. An invariants test fails if any AI-side file mentions those states or calls an update or delete.
- A possible cause is never "confirmed". Only a Finding row created by a named technician is.
- A possible cause or inspection step must cite a manual section or an event. A cause that cites a missing sensor reading is dropped.
- The final priority is at least the priority the threshold rules require; the AI can raise it, never lower it.
- Decisions carry the work order version the technician saw. A stale view is rejected. Edits and decisions are serialized with a row lock.
- The technician name comes only from a validated cookie, never from a form field. Error messages and logs never contain user text, model output or connection details.
- Analysis is limited to a 30 second cooldown per report, 30 runs per hour and 150 per day.

## Tech stack
Next.js 16 (App Router, Cache Components), React 19, TypeScript, Tailwind CSS v4 (no UI libraries), Prisma 7.10.0 with Neon Postgres (`@prisma/adapter-pg`), OpenAI (`text-embedding-3-small` for embeddings, `gpt-6-luna` by default for analysis), Zod 4, Vitest, pino. Deployed on Vercel.

## Run it locally
Requires Node 22 or newer (developed on 26, deployed on 24), a Postgres database (Neon) and an OpenAI API key.

```bash
npm install
cp .env.example .env.local     # then fill in the values
npx prisma migrate deploy      # creates the tables
npm run seed:dry               # check what the seed would do
npm run seed                   # 6 sample machines, 41 manual sections with embeddings
npm run dev
```

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Pooled Neon connection string, used by the app |
| `DIRECT_URL` | Direct Neon connection string, used by migrations and scripts |
| `OPENAI_API_KEY` | Embeddings and analysis |
| `OPENAI_MODEL` | Optional. Defaults to `gpt-6-luna` |
| `LOG_LEVEL` | Optional. Defaults to `info` |

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Unit and invariant tests |
| `npm run lint` | ESLint |
| `npm run seed` / `seed:dry` | Load equipment and embedded manual sections (the dry run changes nothing) |
| `npm run retrieve -- --type PUMP "text"` | Show what keyword and semantic retrieval return |
| `npm run analyze -- --scenario pump-bearing` | Run the whole pipeline on a sample (uses the OpenAI key) |

## Trying the live app
No login is needed. Pick a name in the header (identity is name-based; see limitations).

The site has three demo reports:
- **Report #1, pump:** a full lifecycle. It has an analysis with cited possible causes, an observation, an answered follow-up question, a confirmed finding, an edited work order (version 2) and an approved decision. Open the PUMP-101 page under **Equipment** to see the history.
- **Report #2, compressor:** conflicting oil-pressure gauges and a missing temperature reading. The work order is still a draft, so you can try editing, approving or rejecting it.
- **Report #3, motor:** an unrelated request. It shows the degraded path: no manual sections matched, no possible causes, no work order, and a clear explanation.

To try it yourself, open **New report**, load a sample, submit, then press **Run analysis** (about 5 to 30 seconds). Open the evidence chips to see what each suggestion rests on.

## Tests
Over 550 tests. They cover the threshold rules (including exact boundaries and conflicting or missing data), the manuals against the rules, the parser, retrieval and rank fusion, query building, the citation validator and priority floor, the analysis runner's failure stages, persistence, the report, work order and notes services, the budget guard and the UI helpers. Invariant tests guard the rules above and check that no log, history entry or error message can contain user text. A Tailwind v4 test and a design-token test guard against removed utilities and undefined colors. The database and the model are always replaced by fakes in tests.

## Deployment
Vercel (Node 24.x) and Neon Postgres in the Singapore region. The build runs `prisma generate` through `postinstall` and the build script. Environment variables are set in Vercel; no secret is committed.

## Project layout
```
app/             pages, server actions, UI components
lib/thresholds/  sensor rules and evaluation
lib/knowledge/   manual parsing and chunk sync planning
lib/retrieval/   similarity, rank fusion, query building, orchestration
lib/analysis/    prompt, schema, validation, runner, persistence, budget
lib/reports/     report, work order and notes services
lib/server/      queries, session, wiring (server-only)
lib/ui/          pure UI helpers and class builders
knowledge/       the sample equipment manuals (markdown)
prisma/          schema and migrations
scripts/         seed, retrieve and analyze scripts
tests/
```

## Scope
**Implemented:** report form, deterministic checks, retrieval over a knowledge base, cited AI suggestions with follow-up questions and a draft work order, edit/approve/reject, observation vs possible cause vs confirmed finding, equipment history, missing and conflicting data handling, and visible AI and retrieval failures, with loading, empty, validation, success and failure states.

**Excluded:** live IoT integration, predictive maintenance models, inventory, technician dispatch, real authentication, a "close report" action, managing equipment or manuals in the UI, pgvector, and end-to-end browser tests.

## Known limitations
- **The manuals are sample documents** written for this assessment, not manufacturer data. Sensor limits are illustrative; the vibration bands follow commonly used severity zones but were not checked against a standard.
- **Identity is a chosen name in a cookie**, not authentication. It records who did what, and does not prove who someone is.
- Analysis takes roughly 5 to 30 seconds. The first request after the database has been idle can take a few seconds more while it resumes.
- Model output varies from run to run. The deterministic rules and validation bound it; the wording and sometimes the priority above the minimum differ.
- The retrieval relevance cutoff (0.40) was chosen from five test queries and is a heuristic.
- Embedding similarity is computed in Node over about a dozen sections per equipment type. pgvector is the upgrade path for a larger knowledge base.
- The analysis budget check is not atomic: two requests started within the same few seconds can both pass it.
- The concurrency tests prove the logic and the rollback with fakes; they do not exercise real Postgres row locking between two connections.
- Under Cache Components, an unknown report or equipment id can be served as a "not found" page with HTTP 200.
- `npm audit` reports high-severity advisories (4 in production dependencies, 9 including development ones), all inside the Prisma CLI's own dependency tree and not in the runtime request path. The only offered fix downgrades Prisma to v6, so I left it. Prisma is pinned at 7.10.0 because Prisma 8 was still a release candidate.
- Static analysis: ESLint and the TypeScript checks run clean, and two guard tests check Tailwind v4 class names and design tokens. SonarQube for IDE still shows maintainability warnings (cognitive complexity, repeated literals) in some files. I fixed the low-risk ones in an audit pass and did not refactor the tested core logic close to the deadline.
- The seed and scripts use the direct database URL, which still produces a driver warning about `sslmode`.