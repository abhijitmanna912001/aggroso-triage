@AGENTS.md
@docs/DESIGN.md

# Equipment Maintenance Triage Assistant

Take-home assessment build. The owner must be able to explain every decision. Propose a plan and wait for approval before large changes, and keep each task small.

## Stack
- Next.js App Router with Cache Components on (cacheComponents and partialPrefetching in next.config.ts), TypeScript, Tailwind, Zod.
- Prisma ORM 7.10.0, pinned. Never upgrade to Prisma 8 and never install any prisma package at @latest.
- Neon Postgres. The Prisma CLI config is prisma7.config.ts and uses DIRECT_URL. The app client uses DATABASE_URL (pooled) through @prisma/adapter-pg.
- The generated client is in generated/prisma (git-ignored). Import from there, and run `npx prisma generate` after schema changes.
- OpenAI SDK for chat and embeddings (text-embedding-3-small).

## Hard rules
- Never read, print, copy or edit .env, .env.local or any real secret. Variable names are in .env.example.
- Do not run `npm audit fix --force`. Do not change pinned versions. Ask before adding any dependency.
- Do not edit existing migration files. Schema changes go through `npx prisma migrate dev --name <name>`.
- Do not run git commit or git push. The owner commits.

## Product invariants (each needs a test)
- AI code can only create DRAFT work orders. Only the approve and reject server actions may set APPROVED or REJECTED, and each requires a technician name.
- A Hypothesis is never confirmed. Only a Finding row, created by a named technician, is a confirmed finding.
- Every AI citation is checked against real ManualChunk ids and real ReportEvent ids before saving. Invalid citations are dropped and noted in AnalysisRun.validationNotes.
- Threshold checks are plain deterministic code. No LLM is involved.
- Work order edits append a WorkOrderVersion. Nothing is overwritten or deleted, and history is append-only.
- AI and retrieval failures are stored on AnalysisRun and shown in the UI. Never hide a failure or fall back silently.

## Caching
- Never cache reports, work orders, analysis runs or history. Read them uncached, inside <Suspense>.
- Only the manual chunk list may use 'use cache', and it must still work correctly on a cache miss.
- Do not await params or cookies at the top of a page. Await them in a child component inside <Suspense>.

## Before saying a task is done
- Run `npm run lint`, `npx tsc --noEmit` and `npm test`.

## Logging
- Use the logger from lib/logger.ts for server-side logs. Never log connection strings, keys or passwords, and never put them in log messages.