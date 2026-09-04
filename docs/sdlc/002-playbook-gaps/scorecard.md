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

## Re-score, 4 September 2026

The same rubric, weights and not-applicable list, applied after intent 002 (PRs #10 to #19,
3 and 4 September 2026; PR #20 was a throwaway diagnostic, never merged). Every criterion is
re-evidenced from the repository and the workflow runs the plan's "Records" cite; a score that
did not move keeps its evidence in one line.

### A. The loop and its artifacts (core, weight 2)

| # | Evidence after 002 | Score |
| --- | --- | --- |
| A1 | Both intents carry their acceptance in the artifact: `001-portfolio-v1/intent.md` "accepted by the product owner on 2 September 2026 (ca08c2c). Delivered as version one, released 3 September 2026"; `002-playbook-gaps/intent.md` "accepted by the product owner on 3 September 2026". `sdlc.test.mjs` fails `pnpm check` if any artifact under `docs/sdlc/` lacks a status line. | 3 |
| A2 | `002-playbook-gaps/spec.md` under the three skills, twelve concerns C1 to C12 each decided the same day and written back. | 3 |
| A3 | `002-playbook-gaps/plan.md` accepted before phase A (PR #12), seven phases with files, done criteria and risks; fourteen departures written back in the PR that made them. | 3 |
| A4 | intent (PR #10) to spec (PR #11) to plan (PR #12) to one PR per phase, A to F as #13 to #18 and G as #21, with the fix PR #19 between E and F; every commit dated, and every one signed but 01b364d, which the app pushed on the owner's behalf. | 3 |
| A5 | Phase B's PR carried the 272 configuration tests, phase C's the hook payload tables, phase D's the expiry tests; 731 tests inside `pnpm check` by phase F. | 3 |
| A6 | From PR #13 on, the verifier's report and the three review passes are posted on each PR as reviews, with a comment naming the commit that answered each finding; from PR #18 the automatic review posts beside them. | 3 |
| A7 | Unchanged: the repository is the source of truth, and `.github/expiry.json` now holds the dates that were only in a session. | 3 |

Subtotal A: 21 of 21 (was 19).

### B. Human gates (core, weight 2)

| # | Evidence after 002 | Score |
| --- | --- | --- |
| B1 | The acceptance sits in each intent's status line, checked by a test (A1). | 3 |
| B2 | Twelve concerns decided and recorded with dates. | 3 |
| B3 | Plan accepted before phase A. | 3 |
| B4 | Ruleset unchanged; each merge followed the owner's word in chat, including PR #19, which the agent merged after the owner's own click had not taken. The automatic review can only comment, never approve. | 3 |
| B5 | Production now runs only through the `deploy` workflow's `production` environment, whose required reviewer is the owner: three runs approved by him on 4 September (release, rollback, release forward), each with an approval reference the scripts require. | 3 |
| B6 | Every PR, including the fix PR #19, four files and a composite action, had the four reports and CI; the diagnostic PR #20 was never merged. | 3 |

Subtotal B: 18 of 18 (was 17).

### C. Agent boundaries (core, weight 2)

| # | Evidence after 002 | Score |
| --- | --- | --- |
| C1 | The production token lives only in the GitHub environment; the agent can dispatch a release but cannot approve it; the hook still refuses production commands without the reference; the guard is spawned with payload tables in `hooks.test.mjs`. | 3 |
| C2 | Unchanged, plus `review.yml`'s tool list allows `gh pr review ... --comment` only. | 3 |
| C3 | Fix mode rehearsed twice on a real branch: before phase C the Edit tool was refused while `sed -i` and a marker delete passed; after, all three were refused, a component edit passed, and the marker could only go once the PR was open. The guard judges shell command lines and the GitHub file tools, and the perimeter covers the hooks, the settings, `package.json`, `REVIEW.md` and the expiry file. | 3 |
| C4 | Two Cloudflare tokens carrying only the permissions their deploys use, four for the preview one and five for the production one, which adds Workers Routes on the zone; both expiring 3 September 2027; the old non-expiring token deleted after the first green gated release; the Claude OAuth token expiring in a year; `check-expiry` fails `pnpm check` thirty days ahead of any recorded date, and the `watch` workflow, weekly since PR #23 of the same day, asks Cloudflare for the preview token's real expiry, the only one it holds, alongside the advisory check that PR added. A year is not short-lived, so the play's letter is not met. | 2 |
| C5 | Unchanged; the user-level hook refused even worktree commits while the checkout stood on `main`. | 3 |

Subtotal C: 14 of 15 (was 12).

### D. Skills and hooks (core, weight 2)

| # | Evidence after 002 | Score |
| --- | --- | --- |
| D1 | Unchanged, plus `pnpm eval:skills` proves each skill still loads for its prompts (11 of 11 on 3 September). | 3 |
| D2 | The deterministic layer is now tested: `hooks.test.mjs` spawns each hook against payload tables (allowed and refused forms, the marker rule, the wrappers), and the fix-mode perimeter fences the hooks and settings themselves. Managed settings remain an enterprise feature not in use. | 3 |
| D3 | Unchanged. | 3 |
| D4 | Unchanged. | 3 |

Subtotal D: 12 of 12 (was 11).

### E. CLAUDE.md and the feedback loop (core, weight 2)

| # | Evidence after 002 | Score |
| --- | --- | --- |
| E1 | CLAUDE.md gained the process loop, fix mode, the new commands with their healthy outputs; `claude-md.test.mjs` fails when a command, path or quoted output it names no longer exists. | 3 |
| E2 | "Things Claude gets wrong" gained the shell edit during a fix task and the production deploy outside the workflow, both from findings. | 3 |
| E3 | `pnpm verify` unchanged in shape; `pnpm check` now carries the expiry check and the configuration tests. | 3 |
| E4 | Unchanged (no visual work in 002). | 3 |
| E5 | The verifier ran on every PR and its report was posted; each PR pasted the verify output. | 3 |

Subtotal E: 15 of 15 (was 15).

### F. Review (core, weight 2)

| # | Evidence after 002 | Score |
| --- | --- | --- |
| F1 | Every phase pull request, #13 to #18 and #21, had the session's three passes and the verifier, and so did the fix PR #19; the throwaway diagnostic #20 had none and was never merged. The `review` workflow posts the same three passes by itself on each of them, except a draft, which it skips by its own condition (#20 was one), and a pull request that changes its own workflow file, which the action refuses (#19); PR #18 carries four posts, one per push. | 3 |
| F2 | `REVIEW.md` unchanged in policy, with "Where findings live" added. | 3 |
| F3 | Unchanged. | 3 |
| F4 | The GitHub half exists and was exercised: a mention on PR #18 was answered by commit 01b364d from the app, co-authored to the owner; the run before it failed on a mis-pasted secret, diagnosed and recorded; the lint the bot could not run to the end is recorded and fixed. | 3 |
| F5 | Departures per phase; CLAUDE.md, REVIEW.md, the verifier and the PR template updated from findings. | 3 |

Subtotal F: 15 of 15 (was 12).

### G. Deployment and rollback (core, weight 2)

| # | Evidence after 002 | Score |
| --- | --- | --- |
| G1 | Preview free (every PR and push, and `rollback-preview` by dispatch with no gate); production gated by the environment for release and rollback alike. Deploy and rollback remain scripts and workflow dispatches rather than MCP tools, a deliberate choice recorded in the intent. | 2 |
| G2 | Rollback rehearsed on the preview Worker through the workflow (once to the previous version, twice by id) and on production through the gate (rollback to the version one release in 4 s, release forward in 59 s, both smoke-checked); the rehearsal date is watched with a 180-day interval. | 3 |

Subtotal G: 5 of 6 (was 4).

### H. Complementary and advanced practices (weight 1)

| # | Evidence after 002 | Score |
| --- | --- | --- |
| H1 | `verifier.md` used every PR; the three passes run from committed prompts in `review.yml` on GitHub, but in the session they are still ad hoc prompts rather than agent files. | 2 |
| H2 | Worktrees were used twice (the two-port proof, and phase F's records beside other work), not as parallel sessions. | 2 |
| H3 | Auto mode after the plan, with the full site suite throughout and the configuration tests growing with the phases that added them, 272 at phase B and 731 by phase F. | 3 |
| H4 | `pnpm test:config` inside `pnpm check` on every push: the hooks against payload tables, CLAUDE.md against the scripts and paths it names, the skills and the agent, the SDLC artifacts, the expiry rules. The skill-trigger eval exists but runs by hand, since it spends the owner's subscription. | 2 |
| H5 | `review.yml` and `claude.yml` run Claude Code non-interactively with a pinned action, restricted tools and the subprocess scrub; the GitHub side uses the app's short-lived token, but the Anthropic side is the owner's one-year subscription token, not a scoped credential. | 2 |
| H6 | Not among the nine gaps, closed at phase G by two settings the owner turned on: CodeQL's default setup on 4 September 2026, which scans the code itself, the Actions workflows, the client scripts, the build and check scripts and the tests, 84 files, on every push and pull request and weekly, so a dormant repository is still scanned; and Dependabot alerts and security updates, which match the lockfile against GitHub's advisory database continuously and open a fixing pull request, meeting `ci` and the owner's merge like any other, though not the automatic review, since the action refuses a run a bot started, as run 33826285752 showed, and a Dependabot event carries a read-only token and none of the repository's secrets. `pnpm audit` still gates high-severity advisories on the branch's own lockfile, which neither setting blocks; Dependabot's first alert matched the one advisory it already carries as ignored (extract-zip, a development dependency). Neither validates a finding before reporting it, which is what a 3 would need. | 2 |

Subtotal H: 13 of 18 (was 7).

### Score after 002

| Group | Points | Of | Weight | Weighted |
| --- | --- | --- | --- | --- |
| A Loop and artifacts | 21 | 21 | 2 | 42 of 42 |
| B Human gates | 18 | 18 | 2 | 36 of 36 |
| C Agent boundaries | 14 | 15 | 2 | 28 of 30 |
| D Skills and hooks | 12 | 12 | 2 | 24 of 24 |
| E CLAUDE.md and feedback loop | 15 | 15 | 2 | 30 of 30 |
| F Review | 15 | 15 | 2 | 30 of 30 |
| G Deployment and rollback | 5 | 6 | 2 | 10 of 12 |
| H Complementary and advanced | 13 | 18 | 1 | 13 of 18 |
| **Total** | | | | **213 of 222, 96%** (was 187 of 222, 84%) |

Core plays and principles alone: 100 of 102, 98% (was 88%). Complementary and advanced
practices alone: 13 of 18, 72% (was 39%).

### Reading the re-score

All nine gaps moved, and the scores below are the arithmetic of that, not a summary of it.
Six now carry a criterion at a full 3: the intent artifacts hold their acceptance (A1 and B1,
2 to 3), the review findings live on the pull request (A6, 2 to 3), fix mode is proven twice
(C3, 2 to 3), every pull request gets the three passes (F1, 2 to 3), a mention brings the agent
back (F4, 1 to 3), and rollback is rehearsed on both Workers through the gate (G2, 2 to 3).

Three moved without reaching the play's own description: the agent's configuration is tested in
CI while the skill-trigger eval runs by hand (H4, 0 to 2), the credentials are scoped, expiring
and watched but last a year (C4, 1 to 2), and worktrees carried two proofs rather than parallel
sessions (H2, 1 to 2). The GitHub half of the review loop moved on both its criteria, F4 above
and H5, since Claude now runs non-interactively in CI, though on a subscription token rather
than a scoped credential (1 to 2).

One gap moved only in half. The seventh asked for a rehearsed rollback and for deploy and
rollback to be tools the agent calls: G2 has the rehearsal, and G1 stays at 2 by decision, since
they remain scripts and workflow dispatches.

Three criteria the nine gaps never named rose too: the deterministic hook layer is now tested
against payload tables (D2, 2 to 3), auto mode ran against a full suite throughout (H3, 2 to 3),
and recurring scans rose at the close, when the owner turned on CodeQL and Dependabot rather
than leave the plan's "no criterion below 2" unmet (H6, 1 to 2). Nothing scores below 2, and no
score rests on a mechanism that does not exist.

Two findings of the rehearsals belong in the next intent's context: a zone's Bot Fight Mode
challenges a runner's smoke check and had to be turned off, and a credential pasted at a
Windows prompt must be checked for stray whitespace before it is trusted.
