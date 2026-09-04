# Intent: close the playbook gaps in how anandfrancis.com is built

Author: Anand Francis. Status: accepted by the product owner on 3 September 2026. Delivered on
4 September 2026; see `plan.md`, "Records", the closing record, and `scorecard.md`, "Re-score".

## Problem

Version one shipped on 3 September 2026 under the AI-native SDLC, and I scored the project
against Anthropic's playbook the same day (`scorecard.md`, committed beside this file). The core
plays score 88%. The gaps are at the edges, and most of them share one shape: a mechanism exists
but was never exercised, or a rule lives in a habit rather than in something that runs.

Concretely:

- Nothing tests the agent's own configuration. CLAUDE.md, the hooks and the skills changed in six
  of the seven build phases with no check that a hook still blocks or a skill still triggers.
- The Cloudflare token that deploys production never expires and carries permissions the deploy
  does not use, and the same token also runs on every pull request.
- A review comment left on GitHub reaches no agent. The three review passes ran in the session,
  their findings stayed there, and PR #8, which changed how production is smoke-checked, had only
  CI as its reviewer because the passes were a habit and habits are skippable.
- The fix-mode hook has never fired. Reading it shows it watches only the Edit and Write tools, so
  a file rewritten through the shell walks past it, and it leaves `package.json`, the hooks
  themselves and its own marker file editable.
- Rollback was rehearsed once, on the preview Worker, with my own login. Production has one
  version, no rollback job, and the CI token has never performed a rollback.
- Two verification tools reuse whatever is listening on port 8788 without asking which build it
  serves, so the plan's parallel-worktree option was never safe to use.
- The version one intent still says "draft" although its commit accepted it.

## Proposed outcome

Every gap in the scorecard scores at least 2 on the same rubric, and the evals row stops being 0.
More important than the number: every mechanism this change adds is exercised at least once
before the change is closed, and the record of that exercise is on the PR or in the plan.

In order of importance:

1. **Configuration evals.** Deterministic tests, run inside `pnpm check`, that spawn each hook with
   a table of payloads and assert the exit codes, check that every healthy-output line CLAUDE.md
   quotes is printed by the script it names, that every command and path it names exists, and that
   the skills, the agent definition and the hook wiring have the shape they claim. Plus a script I
   run by hand on my Claude Max login, before any PR that touches a skill, which sends a handful of
   prompts through headless Claude Code and reports which skill fired.
2. **A least-privilege release path.** Two Cloudflare tokens with expiry dates: one for the preview
   Worker with account permissions only, one for production that adds the zone route permission.
   A `production` deployment environment on GitHub with me as required reviewer, holding the
   production token, so a production run pauses until I approve it in GitHub. A monthly workflow
   that fails when any token is within thirty days of expiry, or when the rollback rehearsal is
   older than the interval the spec sets.
3. **The GitHub half of the review loop.** A workflow that runs Claude Code when I mention it in a
   PR comment or review, restricted to commenters with write access and to the tools the checks
   need. And a second workflow that reviews every pull request against `REVIEW.md` and posts the
   three passes as a PR review. Neither is a required check; `ci` stays the only one.
4. **Findings on the PR.** The in-session passes stay as a pre-flight, and every report they
   produce, the verifier's included, is posted on the PR before I am asked to merge. `REVIEW.md`
   says so in one line. No pull request is exempt, docs-only ones included.
5. **Fix mode that holds.** The test guard also watches the shell tools, its perimeter grows to
   `package.json`, the hooks, `settings.json`, `REVIEW.md` and its own marker, and it is exercised
   once for real, with the refusal recorded, as the first step of this change.
6. **Rollback as a first-class action.** A rollback script that mirrors the deploy script, a
   rollback job in the deploy workflow behind the production environment, rehearsed on preview
   with the CI token and then on production: re-release, roll back, release forward, each timed
   and recorded.
7. **A configurable preview port**, read by the preview, the test runner and the Lighthouse
   runner, so parallel worktrees are possible when a later intent wants them.
8. **The version one intent** carries its acceptance and its delivery, and every artifact under
   `docs/sdlc` is checked for a status line.

## Affected users and systems

- Me, as owner, product owner, reviewer and the only person with write access.
- The repository at github.com/anandfrancis93/portfolio: its workflows, ruleset, secrets and a new
  deployment environment.
- My Cloudflare account and the anandfrancis.com zone: two new API tokens, the current one
  deleted after the swap.
- My GitHub account: the Claude GitHub App installed on the repository, and a one-year OAuth
  token from my Claude Max subscription stored as a repository secret.
- The Claude Code configuration in `.claude/`, `CLAUDE.md` and `REVIEW.md`.
- Nothing a visitor sees. The site, its copy and its design do not change.

## Constraints

- I have a Claude Max subscription and no API key. Anything that runs Claude in GitHub Actions
  uses the subscription's OAuth token and spends its quota; anything that would spend it on every
  run without earning something back stays local and on demand.
- The repository is public and on GitHub Free. Deployment environments and required reviewers are
  available; nothing that needs a paid plan is assumed.
- No model-driven step may be a required status check.
- Steps that handle a credential value are mine: pressing Create on a token, pasting it into a
  secret, running `claude setup-token`, and clicking Approve on a gated run. Claude drives
  everything up to and after those moments, and never has a token value pass through its tools.
- Every change still arrives as a PR under the existing process: this intent, then a spec, then a
  plan, then reviewed PRs. Departures are written into the plan in the same PR.

## Out of scope

- The projects section, the first project card and the design system case study. They are the
  next intent, once the write-up exists.
- Analytics, monitoring, control bands, on-call: a static site with no telemetry has nothing to
  watch.
- An MCP server for deploy and rollback. Scripts under the same gate do the job here.
- Changing what the site says or how it looks.

## Success measures

- The scorecard re-run at the end: no criterion below 2, the evals criterion at 2 or better, and
  the total above 90%.
- Every new mechanism exercised once and the exercise recorded: a hook refusal seen in a real
  session, a review posted on a PR by the workflow, a mention answered, a production rollback and
  release forward with timings, a green production release through the environment gate.
- The first pull request of the next intent is built entirely under the improved loop with
  nothing done by hand that this change was meant to automate.

## Open questions

- How often rollback should be rehearsed once it is a one-click job. To be decided in the spec.
- Whether the ruleset's rule requiring extra approval for unattributed changes treats commits
  pushed by the Claude GitHub App as attributed. Learned on the first such commit; the rule is
  adjusted in the same change if not.
