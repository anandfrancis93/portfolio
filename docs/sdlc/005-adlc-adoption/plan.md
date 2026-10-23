# Plan: move this repository onto the ADLC (from spec.md, 23 October 2026)

Status: accepted by the product owner on 23 October 2026.
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
  PowerShell), `guard-tests.mjs` (PreToolUse, Edit, Write, Bash, PowerShell and the GitHub push
  and file tools) and `format-on-edit.mjs` (PostToolUse). `guard-deploy.mjs` imports
  `.claude/hooks/lib/command.mjs`, which stays.
- The configuration tests that name what phases C and D remove: `hooks.test.mjs` (25 lines on the
  two hooks, 27 on `FIX_TASK`, and `ci.yml` at lines 105, 190 and 240), `skills.test.mjs` (3),
  `eval-tasks.test.mjs` (2, `FIX_TASK` at line 194 and `ci.yml` at 195), `telemetry.test.mjs`
  (`ci.yml` at line 103) and `watch.test.mjs` line 233 (the `ci` job's name). `.gitignore` line 18
  ignores `.claude/FIX_TASK`.
- The managed `.githooks/pre-commit` exits 1 when `betterleaks` is not on `PATH`, and this cloud
  session has no `betterleaks`. The ADLC's `checks` job installs v1.9.0 from its release, checked
  against the release's `checksums.txt` (`adlc.yml` at v0.6.0, step "Install Betterleaks").
- The ADLC's `sync-repos` workflow runs only from a checkout at a release tag
  (`check_release_checkout`), and reads `.adlc/version` through the contents API, which any token
  can do on a public repository. So its dry run does not show whether `ADLC_SYNC_TOKEN` can push
  here.
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
   C is expected to be the first squash merge (decision 10), and that commit is checked for the
   address as intent 004's first merge was (spec concern 1): the author and committer of the
   squash commit, and a search of its message.
4. **A's review is the fallback.** A changes `review.yml` (spec 6.1, 6.2), so the action refuses
   to run on it. A gets the one review from a fresh subagent, posted as one review. C and D do not
   change `review.yml` and get the workflow's review.
5. **The deploy gate stays inline.** Each gate step keeps its place before `actions/checkout`, so
   no step moves and the job needs no checkout before it. The step runs spec 5.1's three reads:
   the pull requests of `github.sha`, the latest `adlc / checks` run on that pull request's head,
   and the two trees. Each read is `gh api <path> | jq -r '<filter>'`, never `gh api --jq`, so the
   filter that decides the outcome is plain `jq` that a test can run. Each refusal prints which
   read failed. The step is named "Require a green checks run for this commit".
6. **The gate is tested by running it.** A new `tests/config/release-gate.test.mjs` reads each
   gate step's `run` from `deploy.yml` through the `yaml` package, asserts that the text holds no
   `${{`, and runs it as Actions does, `bash --noprofile --norc -eo pipefail`, with the step's
   `env:` names set (`REPO`, `SHA`, a dummy `GH_TOKEN`). `PATH` is the stub's directory plus
   `/usr/bin:/bin` only, so no call can reach a signed-in `gh`. The stub `gh` serves raw JSON
   fixtures by path, logs each call, and fails on a path it does not know; the real `jq` filters
   them. The cases: one merged pull request with a green `checks` run and the same tree (passes);
   no pull request; two; a red run; no run; a different tree (each exits 1 with its message). The
   test fails if the stub's log is empty or `jq` is missing, and asserts that the two jobs hold the
   same step text. This proves gate 5's refusal without a commit on `main` that no pull request
   merged, which the ruleset does not allow (see "Departures from the spec").
7. **The plugin's `ref`.** D pins the marketplace in `.claude/settings.json` to the tag
   `v0.6.0`. Before D opens, the build reads Claude Code's settings reference for a `ref` on a
   GitHub marketplace source, and failing that for a git URL source that names the tag. If neither
   exists, D records a concern here and in the pull request: every session would then run the
   plugin from the ADLC's `main`, which is already past v0.6.0. The owner decides before D merges.
8. **Betterleaks in the session.** Before A's first commit, the session installs Betterleaks
   v1.9.0 the way the ADLC's `checks` job does: the release archive, checked with `sha256sum -c`
   against the release's `checksums.txt`, onto `PATH`. The hook then runs as on the MacBook; the
   hook is never skipped.
9. **The retire log's first rows.** `guard-deploy.mjs`, `pnpm eval:skills`, `pnpm eval:tasks`,
   and the Chromium install time of `checks` (spec concern 5), each with the reason it stays and
   its owner.
10. **The first squash merge.** Whichever pull request is squash-merged first after B step 2, a
   Dependabot one included, gets decision 3's check. C is the expected one.

## Repository layout (additions and changes)

```
A: AGENTS.md (one line until D)  .adlc/version  .adlc/scripts/adlc.py  .githooks/pre-commit  .github/pull_request_template.md (replaced)
   .github/workflows/adlc.yml  adlc-review.yml  adlc-pr-title.yml  adlc-dependabot.yml
   .adlc/tiers  .adlc/protected  .adlc/install  .adlc/fast-check  .adlc/full-test  .adlc/retire-log.md
   .github/dependabot.yml  .prettierignore (changed)  .nvmrc (from .node-version)
   .github/workflows/ci.yml  claude.yml  deploy.yml  watch.yml (node-version-file only)
   .github/workflows/review.yml (prompt, failure text, `ci` mentions)  REVIEW.md (changed)  CLAUDE.md (lines A makes untrue)
C: .github/workflows/ci.yml (removed)  .github/workflows/heartbeat.yml  .github/workflows/deploy.yml (gate steps)
   scripts/measure.mjs  scripts/lib/measures.mjs  tests/config/measures.test.mjs
   tests/config/watch.test.mjs  tests/config/telemetry.test.mjs  tests/config/release-gate.test.mjs
   CLAUDE.md (lines 16 and 94)  docs/runbook.md (deploy gate, heartbeat, measures)
D: .claude/hooks/guard-tests.mjs  .claude/hooks/format-on-edit.mjs  .claude/agents/verifier.md (removed)
   .claude/settings.json  .gitignore (line 18)  scripts/lib/eval-tasks.mjs  tests/config/hooks.test.mjs  skills.test.mjs  eval-tasks.test.mjs
   AGENTS.md  CLAUDE.md (@AGENTS.md)  tests/config/claude-md.test.mjs  docs/runbook.md  .adlc/retire-log.md
```

## Order of work

Each pull request gets one review (decision 4). No pull request carries `pnpm verify` output:
`ci` and, from A on, `adlc / checks` are the record.

### A. The sync

- Title: `chore(adlc): sync to 0.6.0`, so `pr-title` passes on the pull request that adds it.
- Files:
  - Decision 8 first. Then run the command from the ADLC's `docs/sync.md`, "Adopt the ADLC or
    update a repo", at `v0.6.0`, with no `--releases`.
  - Fill in the repository-owned files from spec 3.1 to 3.6 and decision 9. `.adlc/fast-check`
    runs Prettier with `--ignore-unknown`, so a staged `.githooks/pre-commit` or `.nvmrc` is not an
    error. The sync's `AGENTS.md` template becomes one line, "Until plan 005 phase D, this
    repository's instructions are in `CLAUDE.md`."; D fills it.
  - The edits for spec 6.1, 6.2 and 6.3 to `REVIEW.md` and `review.yml`, which also remove their
    mentions of `ci` ("Check `.github/workflows/ci.yml`" in `REVIEW.md`; lines 5 and 6 and 69 of
    `review.yml`), so C need not touch `review.yml`.
  - Every `CLAUDE.md` line that A makes untrue: line 5's `.node-version`; the pre-flight and
    verifier sentences; "Verify before reporting done: `pnpm verify` … Paste the output."; and
    "Reporting done without running the checks and pasting their output". From A on, `ci` and
    `adlc / checks` are the record (spec 6.3).
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
     of `ci`. A `PUT` replaces the whole `rules` array, so it sends every rule from a fresh `GET`
     with only `required_status_checks` changed, and the read-back is diffed against that `GET`.
   - Merge options: squash only, with the title and body from the pull request, in the
     repository settings, and `allowed_merge_methods: ["squash"]` in the ruleset. Both are read
     back.
3. In the ADLC repository, a dispatch of `ADLC sync repos` from the tag `v0.6.0`, with "dry run"
   checked. Its summary lists this repository as on 0.6.0, which proves only that the workflow
   finds it. The owner reads the token's repository access on its GitHub settings page and
   records whether it reaches this repository. The next release's sync run is the real proof. A
   cloud session never sees that token.

Each step's command and its output go into "Records". The owner approves each step on the
MacBook. The read-back of the ruleset is the proof for step 2 (gates 2 and 4).

### C. CI and the deploy gate

- Title: `ci: read the adlc checks for releases and measures`.
- Files:
  - `ci.yml` is removed. `heartbeat.yml` holds the `watch heartbeat` job, on `pull_request`
    (spec 4.2), with `ci.yml`'s top-level `permissions: contents: read` and the job's
    `actions: read`.
  - The two gate steps in `deploy.yml` (decision 5).
  - `scripts/measure.mjs` (spec 5.2) reads `check_name=adlc%20%2F%20checks`, and `ci` for a pull
    request with no `checks` run (#1 to #7), so October's measure keeps its first-run column.
    `scripts/lib/measures.mjs` renames its "First ci" and "Pre-flight reviews" headers, and
    `measures.test.mjs` follows.
  - `release-gate.test.mjs` (decision 6). `watch.test.mjs` reads `heartbeat.yml`.
    `telemetry.test.mjs` asserts that `.adlc/full-test` exports `WRANGLER_SEND_METRICS=false` and
    `ASTRO_TELEMETRY_DISABLED=1`, since the suite now runs there.
  - `CLAUDE.md` lines 16 (the ruleset requires `ci`, untrue from B) and 94 (`ci` carries the
    heartbeat).
  - In the runbook: the deploy gate, the heartbeat and "Measures".
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
  - The top-level `contents: read` token cannot read `commits/{sha}/pulls` or `check-runs` here:
    `deploy.yml` has never been dispatched in this repository, so that is unproven. The refusal is
    safe; the fallback is job-level `pull-requests: read` and `checks: read`, recorded here as a
    departure from spec 5.1.

### D. The agent configuration and the instructions

- Title: `chore(agents): move the facts to AGENTS.md and drop the duplicated rules`.
- Files: everything in the layout's D rows, and spec 7, 8 (each row of its table), 9 (new T3
  records in `docs/specs/YYYY-MM-DD-<slug>.md`, and the reworded departure rule) and 10.
  `AGENTS.md` stays under 60 lines.
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

Gate 2 is read on C, not A: A keeps `ci.yml` (spec 14), so `pnpm verify` runs twice on A, and A's
review is the fallback (decision 4). C is the first pull request with `full-test` once and the
workflow's one review.

## Departures from the spec

- Gate 5's second half, "a dispatch from a commit no pull request merged is refused", is proven by
  `release-gate.test.mjs` (decision 6), not by a dispatch: the ruleset has no bypass actor, so no
  such commit can reach `main`.

## Records

- A, 23 October 2026: PR #11, merged 430d399 with a merge commit after the owner's "merge" and
  `adlc / t3-approval` on the label. `adlc.py sync --check` at `v0.6.0` listed nothing and
  `prettier --check .` passed (gate 1). The fallback review posted 0 Important and 3 Nit, all
  answered in 5a2c36f. Gate 3: draft PR #12 (a4eb17d, one line added to `.githooks/pre-commit`)
  failed `adlc / checks` with ".githooks/pre-commit differs from ADLC 0.6.0"; closed, not merged.
- B step 1, 23 October 2026, by Remote Control on the owner's "yes": `gh variable set` for
  `ADLC_OWNER=anandfrancis93` and `ADLC_REVIEWERS=claude[bot]`, `gh label create` for
  `adlc:t3-approved` and `adlc:owner-decides`; `gh variable list` and `gh label list` read both
  back.
- B step 2, 23 October 2026, by Remote Control on the owner's "yes": a `PUT` of ruleset 25698298
  from its `GET`. The read-back diff of `rules` shows only two changes, `required_status_checks`
  from `ci` to `adlc / checks`, `adlc / t3-approval` and `pr-title / pr-title` (no
  `integration_id`, as `ci` had none; strict kept) and `allowed_merge_methods` from merge, squash
  and rebase to squash; name, target, enforcement, conditions and bypass actors are unchanged
  (gate 4). The repository allows squash only, with the pull request's title and body.
- B step 3, 23 October 2026: `ADLC sync repos` dispatched from `v0.6.0` with dry run, run
  40006830401, success, "anandfrancis93/portfolio: on 0.6.0". The owner read the token's settings
  page: "This token has access to all repositories owned by you.", so it reaches this repository.
- C, 23 October 2026: PR #22, squash-merged as 2120c49 after the owner's "merge when done" and
  the label. Gate 2: `adlc / checks` (with `full-test` once), `adlc / t3-approval` and
  `pr-title / pr-title` passed, no `ci` run existed, and the workflow's one review posted 0
  Important and 0 Nit. Decision 3: the squash commit's author is the owner's noreply address, its
  committer is GitHub, and its message holds no address at the Gmail domain. The two
  `t3-approval` runs that failed before the label was added stayed red and blocked the merge
  until their failed jobs were re-run; the runbook now says so.
- Gate 5, 23 October 2026: `deploy` run 40011425258, `release` from 2120c49, dispatched on the
  owner's "release" and approved by the owner in the `production` environment. The gate step
  printed "adlc / checks on #22, head bbdb36b97f98d79a1a58364dc71ca4c04a038e9e: success" and
  "2120c4994a000e08359e577e7771f81b11bb89d0 carries the tree of #22, whose checks passed.";
  production version fba78f87-6626-485f-9e19-8c7d0f0cff48; the smoke check passed.
- Gate 6, 23 October 2026: `pnpm measure` on the owner's MacBook, on a fresh clone at 2120c49,
  shows `success` for #22 in the "First checks run" column (9 pull requests in October 2026).
- Decision 7, 23 October 2026: Claude Code's settings reference
  (https://code.claude.com/docs/en/settings-reference, "Allowed source types") gives a `github`
  marketplace source the field `ref`, "a branch or tag". Its `extraKnownMarketplaces` entry lists
  the source types without that table, so the field is read from the table. D pins `ref` to
  `v0.6.0`, and `skills.test.mjs` fails when it differs from `.adlc/version`.
- D, 23 October 2026: PR #23. Gate 7: `AGENTS.md` has 59 lines and `CLAUDE.md` is `@AGENTS.md`,
  both checked by `claude-md.test.mjs`. The first run of `pnpm eval:tasks` on the owner's
  MacBook stopped before any grade with "EISDIR: illegal operation on a directory, read": the
  runner's `node_modules` link in each worktree showed as an untracked file, since
  `node_modules/` matches only a directory, and the runner read it. The same happens on `main`;
  `--dry-run` reproduces it. With the pattern `node_modules`, `--dry-run` grades all three tasks.
  The owner's run on the PR's head, on the owner's "you do it", is posted in the PR.

## Departures recorded during implementation

- Phase A, spec 3.2: `.adlc/fast-check` keeps the ADLC template's refusal of a staged file that
  also has unstaged edits, so the pre-commit run never meets a file staged in part (`git add -p`);
  the spec's sentence on such a file applies only to the address check's reading of the working
  tree, which no commit can now reach with a partial stage. The refusal is the safer of the two.
- Phase D: `AGENTS.md` has the template's sections and a Conventions section, and no
  Architecture section; the two facts the file tree does not show (the build-only pages, the
  generated `_headers` and `_redirects`) moved to "Facts an agent would get wrong".
- Phase D, outside its layout rows: `.claude/hooks/lib/command.mjs` loses `commandWord`, which
  only the test guard used; `tests/config/helpers.mjs` loses `scratchProject` and `edit`, which
  only the removed hook tests used; `README.md`, `REVIEW.md`, the prompt in
  `.github/workflows/claude.yml` and the header of `scripts/eval-tasks.mjs` name `AGENTS.md`
  where they named `CLAUDE.md`, and a comment in `scripts/check-advisories.mjs` drops its
  reference to a `CLAUDE.md` rule that no longer exists. `skills.test.mjs` gains the check that
  the plugin's `ref` matches `.adlc/version`. `.gitignore` drops the slash from `node_modules/`
  (the D record), and `eval-tasks.test.mjs` checks that a `node_modules` link is ignored.
