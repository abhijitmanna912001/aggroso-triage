# Agent Usage

## Tools used
- Claude (chat): planning, architecture tradeoffs, reviewing my decisions
- Claude Code: implementation (to be filled in as I use it)
- Claude in the claude.ai chat: planning, architecture trade-offs, reviewing every step, and drafting the Claude Code prompts.
- Claude Code v2.1.300 on a Claude Pro plan with Sonnet 5.5, run in manual permission mode, with plan mode for each task.
- OpenAI text-embedding-3-small is used by the app for embeddings.

## Representative prompts

### Task A: Prisma client and database health page
The prompt asked Claude Code to set up the Prisma client and a database health page.

TODO(owner): paste the verbatim prompt here

### Task B: threshold rules, Vitest, pino
The prompt asked Claude Code to add the threshold rules, Vitest tests and pino logging.

TODO(owner): paste the verbatim prompt here

### Task C2: seed script and embeddings
The prompt asked Claude Code to write the seed script and the embeddings code.

TODO(owner): paste the verbatim prompt here

## Delegated work and what I kept
I delegated this to Claude Code, from prompts I reviewed as plans first:
- the Prisma client and health page
- the threshold rules with unit tests
- the sample manuals and their parser
- the embeddings client, the chunk sync planner and the seed script
- the retrieval modules (similarity, rank fusion, query builder, orchestrator)

I kept these myself:
- the data model decisions
- hosting and database choices
- every commit
- running the seed myself
- reading every manual section
- approving each edit one at a time

## Agent mistakes and rejected suggestions

### Log
| Date | Prompt / task | What the agent produced | What was wrong or rejected | How I verified |
|---|---|---|---|---|
| 2026-10-14 | Hosting recommendation | Suggested Render + Neon | Render's free tier sleeps and I can't pay for always-on, so I rejected it for Vercel + Neon | Checked the free-tier behavior against my constraints |
| 2026-10-14 | Caching approach | Suggested `force-dynamic` on data pages | That's the old caching model; my project uses Cache Components | Agent fetched the current Next.js caching docs; I confirmed `cacheComponents: true` in my config and in the build output |
| 2026-10-14 | Scaffold review | `create-next-app` enabled an `agentFeedback` option | I didn't want auto-written agent instructions in a repo reviewers will read | Read the option's docs, disabled it, committed the change |

### Other items
- The chat assistant recommended Render for hosting. I rejected it because the free tier sleeps and I cannot pay for always-on, and used Vercel with Neon.
- The chat assistant suggested `export const dynamic = "force-dynamic"`. That is the old caching model. I checked the current Next.js docs; the project uses Cache Components, with records read uncached inside Suspense.
- The chat assistant pointed me to the wrong Vercel settings page for the Node version. I checked the docs; it is under Build and Deployment.
- The chat assistant made counting mistakes (manual sections, tables, foreign keys). I caught them by checking the real outputs.
- An early docs reference was for Prisma 6. I checked npm dist-tags, found the latest tag is a Prisma 8 release candidate, and pinned Prisma 7.10.0.
- `prisma init` added agent skills folders and a lock file. I read them and removed them.
- `npm audit` reported advisories inside the Prisma CLI dependencies. I reviewed them and did not run `npm audit fix --force`, which would downgrade Prisma to v6.
- Claude Code started in auto mode. I switched to manual mode and committed a project default.
- Vercel offered a Prisma Postgres integration. I declined it, because the data is in Neon.
- The pg driver warned about sslmode. I switched DATABASE_URL to `sslmode=verify-full` and redeployed.
- Claude Code's Vitest 5 conflicted with my @types/node. I chose Vitest 4.1.11, pinned exactly, over upgrading @types/node or using `--legacy-peer-deps`.
- Claude Code's threshold code silently dropped readings with an invalid timestamp. I found it in review, added a check, and added a test.
- The embeddings client would have called the API with an empty list. I found it in review and added a guard and a test.
- Claude Code's first plan for the seed task wrote all files in one huge command. I rejected it and worked in smaller steps.
- I pasted a database schema into the wrong place once. Prisma reported "Already in sync", which led me to count models with grep and fix it.

## How I verified output
- Unit tests, all passing before every commit.
- `npm run lint`, `npx tsc --noEmit` and a production build before every commit.
- Reading the generated migration SQL.
- A dry run before the real seed, and a second seed run proving it embeds nothing the second time.
- Reading every manual section.
- Checking the live site in an incognito window and the Vercel logs.
- Making a new test fail on purpose to prove it guards its fix.
