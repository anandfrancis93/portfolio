# Playbook scorecard: anandfrancis.com version one

How closely the project (repository `anandfrancis93/portfolio`, PRs #1 to #9, 2 to 3 September
2026) follows Anthropic's "The AI-native SDLC playbook" (https://claude.com/blog/the-ai-native-sdlc-playbook).

## Method

The rubric is drawn from the playbook itself: its six core plays, its complementary and advanced
practices, its principles (the loop and its artifacts, the human gates, the agent's boundaries,
skills versus hooks, the CLAUDE.md rules, the feedback loop, the review policy, deployment and
rollback, the source of truth) and its explicit do and don't statements. Each applicable criterion
is scored 0 to 3:

| Score | Meaning |
| --- | --- |
| 0 | Absent |
| 1 | Partial: the mechanism exists but is incomplete, unexercised or weaker than the play asks |
| 2 | Met as the play describes it |
| 3 | Met with evidence beyond the play's description |

Core plays and principles carry weight 2; complementary and advanced practices carry weight 1.
Criteria the playbook aims at running services, teams or organizations, which a one-person static
site with no telemetry cannot exercise, are listed at the end as not applicable and excluded from
the score, each with the reason.

## A. The loop and its artifacts (core, weight 2)

| # | Criterion (from the playbook) | Evidence in the project | Score |
| --- | --- | --- | --- |
| A1 | Intent is captured once, in the originator's own words, as a version-controlled `intent.md` | `docs/sdlc/001-portfolio-v1/intent.md`, first person, "Author: Anand Francis"; committed as "Accept intent" (ca08c2c). The file's own status line still says "draft": the acceptance lives in the commit message, not the artifact. | 2 |
| A2 | Design turns the accepted intent into `spec.md`, constrained by the organization's skills, with concerns flagged for the owner to decide | `spec.md` derived from `intent.md` under the three skills, committed after them (d729645, then 839726f); section 12 lists ten concerns C1 to C10, each with a recommendation, all decided the same day and written back into sections 1 to 11. | 3 |
| A3 | Plan mode is the starting point; the approved `plan.md` is committed before implementation | `plan.md` "accepted by the engineer and product owner ... in plan mode, before any code was written" (fea1dc9 precedes the first code commit); phases A to G, each with files, done criteria and risks; every departure written back in the same PR. | 3 |
| A4 | A stage ends by committing an artifact and that commit initiates the next; the trail carries author and timestamp | intent (ca08c2c) to spec (839726f) to plan (fea1dc9) to PRs #1 to #7, one per phase, then the release record; git author and date on every commit; acceptance dates inside the artifacts. | 3 |
| A5 | Build produces the diff and its tests together | Content test written in phase C, disclosure spec with E, PDF spec with F, the nine remaining suites with G; every PR carried its tests. | 3 |
| A6 | The reviewed PR carries the review findings in its history | PRs #5, #6 and #7 summarize the three passes and their outcome in the description; the reviewers' full reports stayed in the session and were not posted as PR review comments; PR #4 predates the practice. | 2 |
| A7 | One system is named the source of truth for each artifact | No tracker exists; the repository is the source of truth by construction, stated in CLAUDE.md and the plan. | 3 |

Subtotal A: 19 of 21.

## B. Human gates (core, weight 2)

| # | Criterion | Evidence | Score |
| --- | --- | --- | --- |
| B1 | The product owner approves the intent before design starts | Accepted by commit before the spec was written; the artifact's status line was not updated. | 2 |
| B2 | The product owner reviews the spec and resolves the flagged concerns | All ten concerns decided and recorded with dates. | 3 |
| B3 | The engineer approves the plan before Claude implements | Accepted in plan mode before phase A. | 3 |
| B4 | A code owner approves the PR after review; the agent never merges on its own | Ruleset on `main` requires a PR and a green `ci`; each of the nine merges followed an explicit "merge" from the owner in chat. | 3 |
| B5 | A named release manager authorizes production | The production job needs an approval reference; the hook refuses `deploy.mjs` and `wrangler deploy` without `RELEASE_APPROVAL`; the release was dispatched with the owner's message as the reference. | 3 |
| B6 | Stage gates are not skipped because code is fast | Every phase went through review, PR and CI; the smoke-check fix and the closing note also went through PRs #8 and #9. | 3 |

Subtotal B: 17 of 18.

## C. Agent boundaries (core, weight 2)

| # | Criterion | Evidence | Score |
| --- | --- | --- | --- |
| C1 | The agent acts up to the production gate and cannot pass it | `guard-deploy.mjs` blocks `wrangler deploy`, `rollback`, `delete`, `secret` and `scripts/deploy.mjs` without an approval; `--env preview` always allowed; `deploy.yml`'s production job runs only on `main`, only after a green `ci` for the commit. Exercised: the hook blocked the verifier's attempt. | 3 |
| C2 | The agent cannot approve its own code | Branch protection plus the owner's merge decision; the agent only ran `gh pr merge` on the owner's word. | 3 |
| C3 | The agent cannot edit test files during a fix task (feedback loop protected) | `guard-tests.mjs` blocks edits to `tests/` and to the gate-defining files while `.claude/FIX_TASK` exists; documented in CLAUDE.md. No fix task ran during version one, so the hook is in place but unexercised. | 2 |
| C4 | No standing production credentials; scoped, short-lived tokens | The Cloudflare token is scoped to one account and one zone, but it never expires and carries the full "Edit Cloudflare Workers" template rather than the five permissions the deploy uses; the rehearsal used a local OAuth login. | 1 |
| C5 | The agent cannot override branch protection or commit to `main` | GitHub ruleset; a user-level hook refuses `git commit` on `main`; every change arrived as a PR. | 3 |

Subtotal C: 12 of 15.

## D. Skills and hooks (core, weight 2)

| # | Criterion | Evidence | Score |
| --- | --- | --- | --- |
| D1 | Institutional knowledge is encoded as versioned skill folders | `.claude/skills/{acme-design-system,portfolio-voice,web-quality}`; the spec, plan and review passes cite them; the contrast, voice, content, budget and headers checks mirror their rules. | 3 |
| D2 | Hooks are the deterministic layer: block unsafe actions, run formatters, keep credentials out of diffs | Project hooks: deploy guard, test guard, format-on-edit (Prettier and stylelint). User-level hooks: no commits on `main`, a secrets gate on every commit. They live in project settings, which an engineer can edit; the playbook's non-bypassable managed settings are an enterprise feature not in use. | 2 |
| D3 | Hooks pause actions pending a named approval | `RELEASE_APPROVAL` with the approval reference, at the deploy stage, not the build stage. | 3 |
| D4 | Skills are not used for what belongs in CLAUDE.md | Skills hold policy (design values, voice, quality gates); CLAUDE.md holds commands, conventions, architecture and mistakes. | 3 |

Subtotal D: 11 of 12.

## E. CLAUDE.md and the feedback loop (core, weight 2)

| # | Criterion | Evidence | Score |
| --- | --- | --- | --- |
| E1 | CLAUDE.md at the repo root, about a page, with commands and example outputs, conventions, architecture, common mistakes | 86 lines, 813 words; sections Process, Commands (each with its healthy output), Conventions, Architecture, "Things Claude gets wrong". | 3 |
| E2 | When Claude gets something wrong twice, the correction goes into CLAUDE.md | The spelling convention was written in after reviewers flagged it in two phases; the healthy outputs were extended when the build and check outputs changed; the seeded mistakes list held. | 3 |
| E3 | A single verification command with quantifiable targets and its example output | `pnpm verify` (check, lint, build, html, test, lighthouse, audit); floors as numbers; outputs named in CLAUDE.md. | 3 |
| E4 | Visual checks for UI work | Browser feedback loop each phase; the screens project attaches sixteen captures; comparisons against the Figma frames. | 3 |
| E5 | Verification is part of "done"; tests run before a task is reported complete | The verifier subagent runs the command and maps it to the spec's gates; each PR pastes the output. | 3 |

Subtotal E: 15 of 15.

## F. Review (core, weight 2)

| # | Criterion | Evidence | Score |
| --- | --- | --- | --- |
| F1 | Every PR gets the same passes: bugs; security; compliance | Phases B to G had all three plus the verifier. PRs #8 (a workflow change) and #9 (docs) went through CI only. | 2 |
| F2 | A review policy defines Important versus Nit, what to skip, and a nit cap | `REVIEW.md`: three passes, Important defined by behaviour, gates, data and spec, five-nit cap, skip list including what CI enforces. | 3 |
| F3 | Findings are ranked by severity; a human decides the merge | Reports tagged Important or Nit; the owner merged each PR. | 3 |
| F4 | Findings are addressed and pushed by the agent; review comments on GitHub trigger the agent | Every finding was fixed and pushed within the session before merge. The GitHub half of the loop, where a mention on a review comment brings the agent back, is not installed and no review comments were made on GitHub. | 1 |
| F5 | Repeated findings feed back into CLAUDE.md and the plan | Departures recorded per phase; conventions updated. | 3 |

Subtotal F: 12 of 15.

## G. Deployment and rollback (core, weight 2)

| # | Criterion | Evidence | Score |
| --- | --- | --- | --- |
| G1 | Autonomy tiered by environment: free below, gated in production; deploy and rollback as tools the agent can run | Preview deploys run from CI on every PR and push; production only by dispatch with approval. Deploy and rollback are scripts and wrangler commands, not MCP tools. | 2 |
| G2 | Rollback is a rehearsed, single command | Rehearsed on the preview Worker with a deliberately broken release (the PDF removed), rolled back with one command, recorded in the plan with its one caveat. Rehearsed once, not regularly. | 2 |

Subtotal G: 4 of 6.

## H. Complementary and advanced practices (weight 1)

| # | Criterion | Evidence | Score |
| --- | --- | --- | --- |
| H1 | Subagents for recurring jobs, defined in `.claude/agents` | `verifier.md` defined and used every phase; the three review passes ran as ad hoc agents with prompts written each time rather than committed definitions. | 2 |
| H2 | Parallel sessions in separate worktrees | The plan anticipated worktrees for phases E to G; the work ran sequentially, one phase at a time, with one reviewer merging. | 1 |
| H3 | Auto mode after plan approval, with a strong test suite and a small blast radius | The build phases ran in auto mode after the plan was accepted; the full suite only existed from phase G, so earlier phases relied on checks, the build and the browser loop. | 2 |
| H4 | Continuous evals in CI for the agent's configuration; skills tested for triggering | None: no evals folder, no test that a skill triggers, no gate on configuration changes. | 0 |
| H5 | Claude runs non-interactively in CI for judgment steps with scoped credentials | CI is deterministic (verify, deploy); no `claude -p` or `claude-code-action` step. Credentials are scoped repository secrets. | 1 |
| H6 | Recurring codebase scans with findings validated before reporting | `pnpm audit` gates high-severity advisories in CI; no scheduled Claude Security scan. | 1 |

Subtotal H: 7 of 18.

## Not applicable (excluded from the score)

| Play or rule | Why it does not apply here |
| --- | --- |
| Closing the loop: control bands, deterministic detection, findings re-entering as `intent.md` | A static site with no server code and no telemetry has no control bands to breach. |
| Service owner triages monitoring findings | Same reason: nothing is monitored. |
| Claude on call with Claude Tag | No team, no incident channel, no tickets. |
| Add an eval for each production incident | No incident has occurred. |
| Tune the review policy monthly from findings | The project is two days old. |
| Legacy tracking system linkage | There is no tracker; the repository is the only system. |

## Score

| Group | Points | Of | Weight | Weighted |
| --- | --- | --- | --- | --- |
| A Loop and artifacts | 19 | 21 | 2 | 38 of 42 |
| B Human gates | 17 | 18 | 2 | 34 of 36 |
| C Agent boundaries | 12 | 15 | 2 | 24 of 30 |
| D Skills and hooks | 11 | 12 | 2 | 22 of 24 |
| E CLAUDE.md and feedback loop | 15 | 15 | 2 | 30 of 30 |
| F Review | 12 | 15 | 2 | 24 of 30 |
| G Deployment and rollback | 4 | 6 | 2 | 8 of 12 |
| H Complementary and advanced | 7 | 18 | 1 | 7 of 18 |
| **Total** | | | | **187 of 222, 84%** |

Core plays and principles alone: 90 of 102, 88%. Complementary and advanced practices alone:
7 of 18, 39%.

## Reading the score

The project follows the playbook's spine closely: every stage committed its artifact, every gate
was a human decision, the agent never crossed the production gate, skills shaped the spec and the
code while hooks enforced the lines that matter, verification was a single command that defined
"done", and review ran as three fixed passes under a written policy. Where it falls short is at the
edges the playbook marks as advanced or team-scale, and in a few places where a mechanism exists but
was never exercised.

Gaps, ranked by how much they would move the score and how much they matter:

1. **No evals for the agent's configuration** (H4). CLAUDE.md, the skills and the hooks changed in
   most phases with nothing testing that a skill still triggers or a hook still blocks. A small
   `evals/` suite run when those files change is the playbook's answer.
2. **A long-lived, over-broad production credential** (C4). The token has no expiry and the template's
   full permission set. Set an end date and trim it to Workers Scripts edit, Account Settings read,
   User Details read, Memberships read and Workers Routes edit on the zone.
3. **The GitHub half of the review loop is missing** (F4, H5). Findings were fixed in the session, but a
   reviewer commenting on GitHub would reach no agent. Installing the GitHub app closes it.
4. **Small PRs skipped the review passes** (F1). The workflow fix in PR #8 changed production behaviour
   and had only CI as its reviewer.
5. **The fix-mode hook has never run** (C3). Its first bug-fix task should start by creating the marker
   file, so the protection is proven rather than assumed.
6. **Findings live in the session, not the PR** (A6). Posting each pass's report as a PR review would
   make the history self-contained.
7. **Rollback rehearsed once** (G2), and deploy and rollback are scripts rather than tools the agent
   calls through MCP (G1).
8. **Sequential rather than parallel build** (H2), a reasonable choice for one reviewer, but the plan's
   own worktree option went unused.
9. **The intent artifact still says "draft"** (A1, B1): the acceptance is in the commit message only.
