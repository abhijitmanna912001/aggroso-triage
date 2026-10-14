# Agent Usage

## Tools used
- Claude (chat): planning, architecture tradeoffs, reviewing my decisions
- Claude Code: implementation (to be filled in as I use it)

## Log
| Date | Prompt / task | What the agent produced | What was wrong or rejected | How I verified |
|---|---|---|---|---|
| 2026-10-14 | Hosting recommendation | Suggested Render + Neon | Render's free tier sleeps and I can't pay for always-on, so I rejected it for Vercel + Neon | Checked the free-tier behavior against my constraints |
| 2026-10-14 | Caching approach | Suggested `force-dynamic` on data pages | That's the old caching model; my project uses Cache Components | Agent fetched the current Next.js caching docs; I confirmed `cacheComponents: true` in my config and in the build output |
| 2026-10-14 | Scaffold review | `create-next-app` enabled an `agentFeedback` option | I didn't want auto-written agent instructions in a repo reviewers will read | Read the option's docs, disabled it, committed the change |