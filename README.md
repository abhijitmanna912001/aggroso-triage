# Equipment Maintenance Triage Assistant

A technician reports an equipment problem. Fixed rules check the sensor readings, relevant manual sections are retrieved, and an AI model drafts possible causes, follow-up questions, inspection steps and a work order, with every suggestion cited. A technician edits, approves or rejects. The AI cannot approve anything and cannot control equipment.

**[Live app](https://aggroso-triage.vercel.app/)** · **[Repository](https://github.com/abhijitmanna912001/aggroso-triage)** · **[How I used AI tools](./AGENT_USAGE.md)**

## Try it in two minutes
No login. Pick a name in the header, then open **Reports**. Three demo reports show different paths:
- **#1 Pump:** a full lifecycle. A cited analysis, an observation, an answered follow-up question, a confirmed finding, an edited work order (version 2) and an approved decision. Open PUMP-101 under **Equipment** to see its history.
- **#2 Compressor:** conflicting oil-pressure gauges and a missing temperature reading. The work order is still a draft, so you can edit, approve or reject it yourself.
- **#3 Motor:** an unrelated request. It shows the degraded path: no manual sections matched, no possible causes, no work order, and a clear explanation.

To make your own: **New report**, load a sample, submit, then **Run analysis** (5 to 30 seconds). Open the evidence chips to see what each suggestion rests on.

## What the code guarantees
- **The AI proposes, a person decides.** The AI can only create a `DRAFT` work order. Only the approve and reject actions can set `APPROVED` or `REJECTED`, through one conditional database update. An invariants test fails if any AI-side file mentions those states or calls an update or delete.
- **A possible cause is never "confirmed".** Observations, possible causes and confirmed findings are separate sections, and only a named technician can create a finding.
- **Suggestions are cited and checked.** Each cause or inspection step must cite a manual section or a report event. The code verifies every citation against what was really supplied and drops the rest. A cause that rests on a missing sensor reading is dropped. The work order text is composed by code from the validated items only.
- **Safety rules are plain code.** Threshold checks (OK, WARNING, CRITICAL, MISSING, CONFLICTING) involve no AI. They set a minimum priority, and the AI can raise the priority but never lower it.
- **Failures are visible.** A failed or degraded run shows its stage and reasons. A failed embedding call falls back to keyword search with a notice.
- **Edits are versioned and safe under concurrency.** Every edit is a new version. A decision carries the version the technician saw, and a stale view is rejected. Edits and decisions on one work order are serialized with a row lock.
- **No leaks.** The technician name comes only from a validated cookie, never from a form field. Error messages and logs never contain user text, model output or connection details. Analysis is rate limited (30 second cooldown per report, 30 runs per hour, 150 per day).

## How a report flows
1. The report is validated and saved with its events and readings, and the threshold rules run in code.
2. On **Run analysis**, the report text and abnormal sensors drive hybrid retrieval over the manuals: Postgres full-text search plus embedding similarity, merged by reciprocal rank fusion, with a relevance cutoff.
3. The model gets the report, the threshold results and the retrieved sections, and must return output matching a schema.
4. Code validates the citations, applies the priority floor and composes the work order draft.
5. The run, its causes, questions, steps and the draft are saved in one transaction.
6. A technician reviews, edits, approves or rejects. Every step is written to an append-only history.

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

<details>
<summary>All scripts</summary>

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Unit and invariant tests |
| `npm run lint` | ESLint |
| `npm run seed` / `seed:dry` | Load equipment and embedded manual sections (the dry run changes nothing) |
| `npm run retrieve -- --type PUMP "text"` | Show what keyword and semantic retrieval return |
| `npm run analyze -- --scenario pump-bearing` | Run the whole pipeline on a sample (uses the OpenAI key) |

</details>

## Tests
Over 550 tests: the threshold rules (exact boundaries, conflicting and missing data), the manuals and their parser, retrieval and rank fusion, the citation validator and priority floor, the analysis runner's failure stages, persistence, the report, work order and notes services, the budget guard and the UI helpers. Invariant tests guard the rules above and check that no log, history entry or error message can contain user text. The database and the model are always replaced by fakes in tests.

## Deployment
Vercel (Node 24.x) and Neon Postgres in the Singapore region. The build runs `prisma generate`. Environment variables are set in Vercel; no secret is committed.

## Scope
**Implemented:** report form, deterministic checks, retrieval over a knowledge base, cited AI suggestions with follow-up questions and a draft work order, edit, approve and reject, observation vs possible cause vs confirmed finding, equipment history, missing and conflicting data handling, and visible AI and retrieval failures, with loading, empty, validation, success and failure states.

**Excluded:** live IoT integration, predictive maintenance models, inventory, technician dispatch, real authentication, a "close report" action, managing equipment or manuals in the UI, pgvector, and end-to-end browser tests.

## Known limitations
- **The manuals are sample documents** written for this assessment, not manufacturer data. Sensor limits are illustrative values.
- **Identity is a chosen name in a cookie**, not authentication. It records who did what and does not prove who someone is.
- **Model output varies between runs.** The rules and validation bound it, but the wording, and sometimes the priority above the minimum, differ.
- **The retrieval relevance cutoff (0.40)** was chosen from five test queries and is a heuristic.
- **The concurrency tests prove the logic and the rollback with fakes.** They do not exercise real Postgres row locking between two connections.
- **The analysis budget check is not atomic:** two requests started within the same few seconds can both pass it.

<details>
<summary>More limitations</summary>

- Analysis takes roughly 5 to 30 seconds. The first request after the database has been idle can take a few seconds more while it resumes.
- Embedding similarity is computed in Node over about a dozen sections per equipment type. pgvector is the upgrade path for a larger knowledge base.
- Under Cache Components, an unknown report or equipment id can be served as a "not found" page with HTTP 200.
- `npm audit` reports high-severity advisories (4 in production dependencies, 9 including development ones), all inside the Prisma CLI's own dependency tree and not in the runtime request path. The only offered fix downgrades Prisma to v6, so I left it. Prisma is pinned at 7.10.0 because Prisma 8 was still a release candidate.
- Static analysis: ESLint and the TypeScript checks run clean, and two guard tests check Tailwind v4 class names and design tokens. SonarQube for IDE still shows maintainability warnings (cognitive complexity, repeated literals) in some files. I fixed the low-risk ones in an audit pass and did not refactor the tested core logic close to the deadline.
- The seed and scripts use the direct database URL, which still produces a driver warning about `sslmode`.

</details>

<details>
<summary>Project layout</summary>

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

</details>