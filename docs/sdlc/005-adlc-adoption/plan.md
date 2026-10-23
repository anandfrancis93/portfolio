# Plan: move this repository onto the ADLC (from spec.md, 23 October 2026)

Status: draft.
Derived from `spec.md` (accepted 23 October 2026, PR #5; concern 1 the owner's decision, concerns 2
to 5 accepted as recommended). Departures during implementation are written back into this file
in the same PR.

## Context

Stage 3 of the fifth intent. The intent (PR #4) and the spec (PR #5) are accepted.

Verified on 23 October 2026, on `main` at `00b5c51`, and against the ADLC at tag `v0.6.0`:

- `adlc.py sync .` from a clean `v0.6.0` clone, run on a scratch copy of this repository, writes
  the eight managed files and the eight repository-owned files spec section 2 lists, and leaves
  `REVIEW.md` and `.editorconfig` as they are. The managed `pull_request_template.md` fails
  `prettier --check` there, which is why spec 3.5 exists.
- `.node-version` holds `22.21.0`. Nine `node-version-file: .node-version` lines read it:
  `ci.yml` lines 48 and 104, `claude.yml` line 69, `deploy.yml` lines 99, 156, 201 and 226, and
  `watch.yml` lines 70 and 114. `CLAUDE.md` line 5 names the file. No script or test reads it.
- `deploy.yml`'s `production` and `rollback` jobs each open with "Require a green ci check for this
  commit" (lines 142 and 187), an inline `gh api` and `jq` step that runs before
  `actions/checkout`. Neither job has a `permissions:` block, so each has the top-level
  `contents: read`. `scripts/lib/credential-use.mjs` keys its windows on the steps named
  `deploy` and `roll back` only, so renaming the gate steps moves no window.
- `scripts/measure.mjs` line 89 reads `check_name=ci`.
- `.claude/settings.json` holds three hooks: `guard-deploy.mjs` (PreToolUse, Bash and
  PowerShell), `guard-tests.mjs` (PreToolUse, the edit and push tools) and `format-on-edit.mjs`
  (PostToolUse). `guard-deploy.mjs` imports `.claude/hooks/lib/command.mjs`, which stays.
- The configuration tests that name what phases C and D remove: `hooks.test.mjs` (25 lines),
  `skills.test.mjs` (3), `eval-tasks.test.mjs` (2) and `watch.test.mjs` line 192 (the `ci` job's
  name).
- The ADLC's `sync-repos` workflow reads every repository its token can see that has
  `.adlc/version`. The token was made for "All repositories" on 22 October 2026, before this
  repository was created on 23 October; phase B proves whether it reaches this one.
- The `watch` workflow's hourly schedule has not fired in this repository since it was created; only
  two dispatches have run (04:25 and 07:32 UTC). That is outside this plan, and is followed up on
  its own.

## Decisions taken in this plan (the spec is not reopened)

1. **Four phases.** A, the sync, in one pull request; B, the GitHub settings, through Remote
   Control on the owner's MacBook, with no pull request; C, CI and the deploy gate, in one pull
   request; D, the agent configuration and the instructions, in one pull request. A keeps
   `ci.yml` (spec 14). C and D are split so that each review reads one subject.
2. **The variables come before A merges.** `adlc / t3-approval` reads `ADLC_OWNER`, and
   `review-budget` reads `ADLC_REVIEWERS`, so B's first step, the two variables and the two labels,
   runs while A is open. B's other steps wait for A's merge, since the required check names are
   copied from A's checks list (spec 11).
3. **Merge styles.** A merges with a merge commit, because squash-only is set in B, after A.
   C is the first squash merge, and its commit is checked for the address as intent 004's first
   merge was (spec concern 1): the author and committer of the squash commit, and a search of its
   message.
4. **A's review is the fallback.** A changes `review.yml` (spec 6.1, 6.2), so the action refuses
   to run on it. A gets the one review from a fresh subagent, posted as one review. C and D do not
   change `review.yml` and get the workflow's review.
5. **The deploy gate stays inline.** Each gate step keeps its place before `actions/checkout`, as
   `gh api` and `jq`, so no step moves and the job needs no checkout before it. The step runs
   spec 5.1's three reads: the pull requests of `github.sha`, the latest `adlc / checks` run on that
   pull request's head, and the two trees. Each refusal prints which read failed. The step is named
   "Require a green checks run for this commit".
6. **The gate is tested by running it.** A new `tests/config/release-gate.test.mjs` reads each
   gate step's `run` from `deploy.yml` through the `yaml` package, and runs it under `bash` with
   a stub `gh` first on `PATH`. The stub answers from fixtures: one merged pull request with a
   green `checks` run and the same tree (passes); no pull request; two; a red run; no run; a
   different tree (each refuses, with exit 1 and its message). It also asserts that the two jobs
   hold the same step text. This proves gate 5's refusal without a commit on `main` that no pull
   request merged, which the ruleset does not allow.
7. **The plugin's `ref`.** D pins the marketplace in `.claude/settings.json` to the tag
   `v0.6.0`. Before D opens, the build reads Claude Code's settings reference for a `ref` on a
   GitHub marketplace source. If there is none, D records that departure here and leaves the plugin
   on the default branch, and concern 4's eval covers it.
8. **The retire log's first rows.** `guard-deploy.mjs`, `pnpm eval:skills`, `pnpm eval:tasks`,
   and the Chromium install time of `checks` (spec concern 5), each with the reason it stays and
   its owner.

## Repository layout (additions and changes)

```
A: .adlc/version  .adlc/scripts/adlc.py  .githooks/pre-commit  .github/pull_request_template.md (replaced)
   .github/workflows/adlc.yml  adlc-review.yml  adlc-pr-title.yml  adlc-dependabot.yml
   .adlc/tiers  .adlc/protected  .adlc/install  .adlc/fast-check  .adlc/full-test  .adlc/retire-log.md
   .github/dependabot.yml  .prettierignore (changed)  .nvmrc (from .node-version)
   .github/workflows/ci.yml  claude.yml  deploy.yml  watch.yml (node-version-file only)
   .github/workflows/review.yml (prompt and failure text)  REVIEW.md (changed)  CLAUDE.md (lines A makes untrue)
C: .github/workflows/ci.yml (removed)  .github/workflows/heartbeat.yml  .github/workflows/deploy.yml (gate steps)
   scripts/measure.mjs  tests/config/watch.test.mjs  tests/config/telemetry.test.mjs  tests/config/release-gate.test.mjs
   docs/runbook.md (deploy gate, heartbeat)
D: .claude/hooks/guard-tests.mjs  .claude/hooks/format-on-edit.mjs  .claude/agents/verifier.md (removed)
   .claude/settings.json  scripts/lib/eval-tasks.mjs  tests/config/hooks.test.mjs  skills.test.mjs  eval-tasks.test.mjs
   AGENTS.md  CLAUDE.md (@AGENTS.md)  tests/config/claude-md.test.mjs  docs/runbook.md  .adlc/retire-log.md
```

## Order of work

Each pull request gets one review (decision 4). No pull request carries `pnpm verify` output:
`ci` and, from A on, `adlc / checks` are the record.

### A. The sync

- Title: `chore(adlc): sync to 0.6.0`, so `pr-title` passes on the pull request that adds it.
- Files: run the command from the ADLC's `docs/sync.md`, "Adopt the ADLC or update a repo", at
  `v0.6.0`, with no `--releases`. Then fill in the repository-owned files from spec 3.1 to 3.6 and
  decision 8. Then make the edits for spec 6.1, 6.2 and 6.3 to `REVIEW.md` and `review.yml`.
  Change only the `CLAUDE.md` lines that A makes untrue: line 5's `.node-version`, and the
  pre-flight and verifier sentences.
- Hands-on, the owner's, while A is open: B step 1.
- Done:
  - `ci`, `adlc / checks` (all its steps), `pr-title / pr-title` and the fallback review are
    green.
  - `adlc.py sync --check` at `v0.6.0` lists nothing, and `pnpm exec prettier --check .` passes
    (gate 1).
  - A trial commit on a scratch branch that edits `.githooks/pre-commit` fails `drift`
    (gate 3). It is pushed, read and deleted, and never merged.
- Then: the owner says "merge". Claude adds `adlc:t3-approved`, waits for `adlc / t3-approval`,
  and merges with a merge commit.
- Could go wrong:
  - `fast-check` under `ADLC_CHECK_ONLY=1` in CI may read files the pre-commit run never
    stages. The fix goes in `.adlc/fast-check`, which this repository owns.
  - `checks` takes Chromium's ten minutes on top of `ci`'s. Both run until C.

### B. The settings (Remote Control, no pull request)

1. While A is open: the variables `ADLC_OWNER=anandfrancis93` and `ADLC_REVIEWERS=claude[bot]`,
   and the labels `adlc:t3-approved` and `adlc:owner-decides`.
2. After A merges:
   - The `main` ruleset requires the three check names, copied from A's checks list, in place
     of `ci`. Its other rules stay.
   - Merge options: squash only, with the title and body from the pull request.
3. In the ADLC repository, a dispatch of `ADLC sync repos` with "dry run" checked. Its summary
   should list this repository as on 0.6.0. If it reports that it cannot read this repository,
   the owner gives `ADLC_SYNC_TOKEN` access to it. A cloud session never sees that token.

Each step's command and its output go into "Records". The owner approves each step on the
MacBook. The read-back of the ruleset is the proof for step 2 (gates 2 and 4).

### C. CI and the deploy gate

- Title: `ci: read the adlc checks for releases and measures`.
- Files:
  - `ci.yml` is removed. `heartbeat.yml` holds the `watch heartbeat` job, on `pull_request`
    (spec 4.2).
  - The two gate steps in `deploy.yml` (decision 5).
  - `scripts/measure.mjs` (spec 5.2).
  - `release-gate.test.mjs` (decision 6). `watch.test.mjs` and `telemetry.test.mjs` read
    `heartbeat.yml`.
  - In the runbook: the deploy gate and the heartbeat.
- Done:
  - `adlc / checks`, `adlc / t3-approval` (after the label) and `pr-title / pr-title` are green,
    and `ci` no longer runs (gate 2).
  - The first squash merge passes decision 3's check.
- Then, the owner's: the first production release from C's commit. It passes the new step and
  waits in the `production` environment (gate 5). `pnpm measure` for the month counts C's first
  `checks` run (gate 6).
- Could go wrong:
  - A merge before the ruleset's up-to-date rule held, so step 3 of the gate refuses. That is the
    safe failure (spec concern 2). The fix is a new pull request, which brings the tree back in
    line.

### D. The agent configuration and the instructions

- Title: `chore(agents): move the facts to AGENTS.md and drop the duplicated rules`.
- Files: everything in the layout's D rows, spec 7 and 10. `AGENTS.md` stays under 60 lines.
- Done:
  - The three checks are green, and the workflow's review has no Important finding.
  - The owner's `pnpm eval:tasks` output is pasted in the pull request (spec concern 4).
  - Gate 7: `wc -l AGENTS.md` is under 60, `CLAUDE.md` is `@AGENTS.md`, and the review checks
    section 8's table against `AGENTS.md`.
- Then, the owner's: removal of the user-level commit hook on the MacBook, and
  `git config core.hooksPath .githooks` in each of the owner's clones (spec 10).

## Risks

- A and C each run two suites for a while: A runs `ci` and `checks`, and C runs `checks` only.
  This costs CI time and changes no gate.
- Between B and C, `deploy.yml` still reads `ci`, and `ci.yml` still runs on each push to
  `main`, so a release in that window works as today.
- A Dependabot pull request opens soon after A merges, before D removes the old review text. It
  gets the fallback review of spec 6.1.
- The sync token may not reach this repository (B step 3). Until it does, later ADLC releases do
  not open a sync pull request here. `drift` still fails on any edit to a managed file.

## Proof (spec section 12, gate by gate)

| Gate | Check | Command or record | Phase |
| --- | --- | --- | --- |
| 1 sync `--check` lists nothing; Prettier passes | the head of A | `adlc.py sync --check`; `prettier --check .` | A |
| 2 the three checks green, `full-test` once, one review | C's checks list | record | C |
| 3 an edit to a managed file fails `drift` | the scratch branch | record | A |
| 4 a failing `full-test` cannot merge | the ruleset read back | record | B |
| 5 the release passes the new step; a commit with no pull request is refused | `release-gate.test.mjs`; the first release | `pnpm test:config`; record | C |
| 6 `pnpm measure` counts the first `checks` run | after C merges | `pnpm measure` | C |
| 7 `AGENTS.md` under 60 lines; `CLAUDE.md` is `@AGENTS.md` | the head of D | `wc -l`; the review | D |
| 8 the address check passes in `checks` and in the hook | every phase | `checks` log; the hook's output | A, C, D |

## Records

Filled in during each phase.

## Departures recorded during implementation

None yet.
