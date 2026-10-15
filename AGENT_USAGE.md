# Agent Usage

## Tools used
- Claude (claude.ai chat): planning, architecture trade-offs, reviewing every step and every pasted result, and drafting the prompts I gave Claude Code. It proposed options; I made the decisions.
- Claude Code (Claude Pro plan): implementation. I ran it in manual permission mode, used plan mode for each task, read each plan before approving it, and approved every edit one at a time. A `CLAUDE.md` file in the repo holds the project rules it follows.
- OpenAI at runtime (used by the app, not a development tool): `text-embedding-3-small` for embeddings and `gpt-6-luna` by default for the analysis, chosen from OpenAI's current pricing page and set through an environment variable.

## Representative prompts
Prompts I gave Claude Code (each was first run in plan mode). The first entry is described in words; the other two are verbatim.

### 1. Working in smaller steps after rejecting one large write (seed task)
Claude Code's first plan for the seed task wrote all the files in one huge command. I rejected that plan and asked for the work to be done in smaller steps, reviewing each step before the next one. The seed script now has a dry-run mode, and a second seed run embeds nothing.

### 2. Enforcing a rule the model ignored (Task A3c)
<details>
<summary>The prompt as I gave it to Claude Code</summary>

```text
Task A3c: enforce the missing-reading rule in code and build the work order text deterministically. Use plan mode: propose the plan first and do not edit anything until I approve. Read CLAUDE.md, everything in lib/analysis and everything in tests/analysis first.

Constraints: no dependency changes, no database, no network, no logging. Use only the Edit tool for existing files. Touch only files under lib/analysis, tests/analysis and scripts/analyze.ts. Do NOT run scripts/analyze.ts, any tsx command or any seed command (I run those myself because they spend the paid OpenAI key), do not read .env files, and do not commit.

1. lib/analysis/schema.ts: draftWorkOrder becomes { title: string } (describe: "Short work order title. Do not name causes."). Remove the description field everywhere (schema, prompt, scripts, tests).
2. lib/analysis/prompt.ts: buildAnalysisPrompt also returns missingThresholdIds: string[] = the ruleIds of input thresholds whose status is "MISSING". Keep the instruction about missing and conflicting readings. Remove any wording about a work order description.
3. lib/analysis/validate.ts:
   - options become { priorityFloor: "HIGH" | "URGENT" | null; missingThresholdIds: readonly string[]; equipmentTag: string }.
   - New rule, checked on the ORIGINAL citations before they are cleaned: a hypothesis with any citation of type "threshold" whose id is in missingThresholdIds is dropped with reason "cites a missing reading". Questions and steps are not affected by this rule.
   - accepted.draftWorkOrder becomes { title, description }. title is the model's trimmed title, or `${equipmentTag}: maintenance inspection` when empty. description is composed in code only from accepted items, with these sections in this order and empty sections omitted: "Inspection steps:" as a numbered list of the accepted step instructions; "Open questions:" as a bulleted list of the accepted question texts; "Possible causes under review (not confirmed):" as a bulleted list "<cause> (<confidence> confidence)"; "Limitations:" as a bulleted list of the accepted limitations. When there is no accepted hypothesis, add the line "No possible cause could be proposed from the available evidence." in place of the causes section. Separate sections with a blank line. No other model text may appear in the description.
4. lib/analysis/run.ts: pass missingThresholdIds (from the prompt result) and equipmentTag (input.equipment.tag) to validateAnalysis. A run with a dropped item is already DEGRADED.
5. scripts/analyze.ts: keep printing the draft work order (title and the composed description).
6. Tests: update the existing ones and add: a hypothesis citing a MISSING threshold is dropped with that reason even when it also has a valid manual citation; a step and a question that cite a MISSING threshold are kept; a hypothesis citing a CONFLICTING or OK threshold plus a manual section is kept; the fallback title; the composed description (section order, numbering, empty sections omitted, the no-cause line, limitations included); the text of a dropped hypothesis never appears anywhere in the composed description; missingThresholdIds in the prompt result; a run where the fake model proposes a cause citing a missing reading ends DEGRADED with that dropped item and no trace of the cause in the work order description; schema tests no longer expect a description field.

When done run npm test, npm run lint, npx tsc --noEmit and npm run build, and report the results. Stop after this task.
```

</details>

### 3. Closing a concurrency gap in work order decisions (Task U1c)
<details>
<summary>The prompt as I gave it to Claude Code</summary>

```text
Task U1c: close the concurrency gap in work order edits and decisions. Use plan mode: propose the plan first and do not edit anything until I approve. Read CLAUDE.md, lib/reports/workorder.ts, tests/reports/workorder.test.ts and tests/invariants/ai-cannot-decide.test.ts first.

Constraints: no dependency changes, no network, no logging. Use only the Edit tool. Touch only lib/reports/workorder.ts and tests/reports/workorder.test.ts (and the invariants test only if a pattern truly needs adjusting; say so in the plan). Do not run any script or tsx command, do not read .env files, and do not commit.

Goal: serialize edits and decisions on one work order with a row lock, so a decided work order can never receive a new version and a decision can never be made on an out-of-date version, even under concurrent requests (Postgres READ COMMITTED: an UPDATE takes a row lock, and other transactions touching that row wait for it). Everything stays inside the single $transaction.
- editWorkOrder: after the existing existence/status lookup, first call workOrder.updateMany({ where: { id, status: "DRAFT" }, data: { updatedAt: now } }) to take the row lock; a count of 0 throws the same conflict as today for a non-draft ("no_draft"). THEN read the latest version again (a fresh read after the lock), compare it with expectedVersion (stale_version), then the unchanged check, then create the version and the history.
- approveWorkOrder and rejectWorkOrder: perform the status updateMany (where id and status "DRAFT", as today) FIRST, right after the existence check; a count of 0 throws already_decided. THEN read the latest version; if it differs from expectedVersion throw stale_version, so the transaction rolls back and the status change is undone. Then write the history. Say in the plan whether you keep a cheap early stale check before the update; either is fine.
- Add what is needed to the structural db types (workOrder.updateMany with data { updatedAt: Date } for the lock) without adding any update, delete or upsert method.
Tests: make the fake $transaction restore its state when the callback throws (snapshot and restore), and prove that with a test; an approve whose latest version moved on after the lock throws stale_version AND leaves the work order DRAFT afterwards; an edit with a stale version after the lock throws stale_version and writes nothing; an edit on a decided work order gets count 0 and throws no_draft; assert the order of operations by recording the call order in the fake (the lock or status updateMany happens before the latest-version read for edit, approve and reject); all existing tests keep passing.

When done run npm test, npm run lint, npx tsc --noEmit and npm run build, and report the results. Stop after this task.
```

</details>

## Delegated work and what I kept
Delegated to Claude Code, from prompts I reviewed as plans first: the Prisma client and database health page; the threshold rules with unit tests; the sample manuals and their parser; the embeddings client, chunk sync planner and seed script; the retrieval modules (similarity, rank fusion, query builder, orchestrator, Prisma-backed queries); the analysis schema, prompt builder, validator, runner, persistence and budget guard; the report, work order and notes services; the server actions and read queries; the invariants tests; the whole UI, including a small design system built with Tailwind and no UI libraries; and a code-quality audit.

Kept by me: the final decision on every design choice (data model, hosting, database, retrieval, the AI workflow and the product invariants), reading each plan and diff before approving, running every command that spends money or writes to the database myself (migrations, the seed, live model runs), every commit, and the deployment.

## Agent mistakes and rejected suggestions
Chat assistant:
- Recommended Render for hosting. I rejected it (the free tier sleeps and I cannot pay for always-on) and used Vercel with Neon.
- Suggested `export const dynamic = "force-dynamic"`. That is the old caching model; I checked the current Next.js docs and used Cache Components.
- Pointed me to the wrong Vercel settings page for the Node version. I checked the docs.
- Gave wrong counts several times (manual sections, database tables, foreign keys, a retrieval count that was 6 when the real value was 8). I caught them by comparing with real outputs.
- Cited a Prisma 6 docs page. I checked npm dist-tags, found the latest tag was a Prisma 8 release candidate, and pinned Prisma 7.10.0.
- Guessed that the washed-out UI came from undefined colour tokens. Claude Code checked the generated CSS and found every token defined. It did find that nothing set a default border colour and added one, and the UI looked right afterwards. I did not determine whether a stale dev-server cache also played a part.

Tools and generated code:
- `prisma init` added agent skills folders and a lock file I had not asked for. I read them and removed them.
- `npm audit` reported advisories inside the Prisma CLI's dependencies. I reviewed them and did not run `npm audit fix --force`, which would have downgraded Prisma to v6.
- Claude Code started in auto mode. I switched to manual mode and committed a project default.
- Vercel offered a Prisma Postgres integration. I declined it, because the data is in Neon.
- The `pg` driver warned about `sslmode`. I switched `DATABASE_URL` to `sslmode=verify-full` and redeployed.
- Claude Code's Vitest 5 conflicted with my `@types/node`. I chose Vitest 4.1.11, pinned exactly.
- The threshold code silently dropped readings with an invalid timestamp. I found it in review with the chat assistant, then added a check and a test.
- The embeddings client would have called the API with an empty list. Same: found in review, fixed, tested.
- My first schema models never reached `schema.prisma`; Prisma said "Already in sync". I counted models with `grep`, found none, and pasted them again.
- Claude Code's first plan for the seed task wrote all files in one huge command. I rejected it and worked in smaller steps.
- Retrieval returned six manual sections for a nonsense query. I chose a similarity cutoff of 0.40 from five test queries and documented it as a heuristic.
- With a prompt rule telling it not to, the model still proposed a possible cause based on a missing sensor reading in one of two runs. I enforced the rule in code (the validator drops such a cause), and the work order description is now composed by code from validated items only.
- Live model calls took 15 to 28 seconds, close to my first 30 second timeout. I raised it to 60.
- Claude Code reported a concurrency gap in the work order decision flow (an approval could race an edit). I had it add a row lock and an ordering, with a rollback test.
- In one UI task Claude Code wrote files through a shell heredoc and a Python script after being told to use only the Write and Edit tools. It reported this itself. I reviewed both diffs, had the indentation fixed, and added a permanent rule to `CLAUDE.md`.
- A UI restyle lost an `aria-labelledby` on some cards. It was restored in the next task.
- Claude Code's code-quality audit could not run SonarQube. It fixed the low-risk findings and left the core logic files untouched, with a reason for each, because refactoring tested code the day before submitting was not worth the risk.
- SonarQube for IDE still reports maintainability warnings (complexity, repeated literals) in some files. I chose not to refactor them close to the deadline.

## How I verified output
- Unit and invariants tests (over 550), `npm run lint`, `npx tsc --noEmit` and a production build before every commit.
- Reading the generated migration SQL; a dry run before the real seed, and a second seed run that embedded nothing.
- Running real analysis scenarios against the live model and reading the output critically, including running the flaky one twice.
- Sentinel tests that prove secrets and user text never reach history entries, logs or error messages.
- An invariants test that fails if any AI-side code can set a work order to approved or rejected, and another that checks the server actions take identity only from the cookie.
- Guard tests that fail on removed Tailwind v3 utilities and on colour tokens that are not defined.
- Lighthouse accessibility audit on the dashboard (100 in dark mode).
- Checking the deployed site in an incognito window and the Vercel logs.