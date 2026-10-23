# Retire log

Reviewed monthly, when AGENTS.md passes 60 lines, and when the main AI model changes.
Propose removal when an item caught no real defect in 90 days (a skill: it was not used
in 90 days), or its cost is plainly higher than its value.

| Item | Kind | Added | Cost (run time, findings caused, lines) | Value, last 90 days (defects caught; uses for a skill) | Last reviewed | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| `.claude/hooks/guard-deploy.mjs` | Hook | 2026-09-02 (plan 001) | One process per Bash or PowerShell call | The only check that stops a command that changes the production Worker before it runs; the ADLC has no deploy guard | 2026-10-23 | Keep (spec 005, 7). Owner: the owner |
| `pnpm eval:skills` | Eval | 2026-09-03 (plan 002) | The owner's subscription per run; run by hand only | Shows which skill each prompt loads, for each change under `.claude/skills/` | 2026-10-23 | Keep (spec 005, 7). Owner: the owner |
| `pnpm eval:tasks` | Eval | 2026-09-05 | The owner's subscription per run; run by hand only | Three pieces of real work, graded, for each change under `.claude/` or to the model | 2026-10-23 | Keep (spec 005, 7). Owner: the owner |
| Chromium install in `full-test` | CI step | 2026-10-23 (plan 005) | About ten minutes of every `adlc / checks` run, with no browser cache | The build renders the PDF and the card, and the tests and Lighthouse need the browser | 2026-10-23 | Keep (spec 005, concern 5); review once C has run a month. Owner: the owner |

## Kill switches

Feature flags kept on purpose. Not proposed for removal.

| Flag | What it turns off | Owner | Last reviewed |
| --- | --- | --- | --- |

## Candidates from repeated review findings

| Finding | Times seen | Proposed check (test, lint rule, hook) | Owner decision |
| --- | --- | --- | --- |
