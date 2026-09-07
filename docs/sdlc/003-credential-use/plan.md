# Plan: know when a credential is used outside the workflows (from spec.md, 7 September 2026)

Status: draft, written on 7 September 2026 for the owner's acceptance.
Derived from `spec.md` (accepted 7 September 2026, PR #35, all eight concerns accepted as
recommended). Departures during implementation are written back into this file in the same PR.

## Context

Stage 3 of the AI-native SDLC for the third intent. The intent (PR #34) and the spec (PR #35)
are accepted. Nothing hands-on is done yet: the read-only watch token of spec section 4 does not
exist, and the owner creates it inside phase B, before that phase's PR merges, since the job that
holds it fails without it and must never skip. The spec's preamble records the one real call
this plan rests on: the audit log's shape, the six entries a preview deploy writes, and the token
fields in both the returned and the published shape.

Verified on 7 September 2026, on the repository as it is: `.github/workflows/deploy.yml`'s
deploy steps carry an `id` (`deploy` on the preview job, none on the production job) and no
`name`, and its rollback steps carry `id: rollback` and no `name`; GitHub's jobs API returns a
step's `name`, never its `id`, so the names spec section 9 asks for are the plan's first change
to that file. `.github/workflows/ci.yml` has one job, `ci`, the only check the `main` ruleset
requires, so a second job is a separate check that blocks nothing. `scripts/check-expiry.mjs`
takes every `*Expires` key by suffix and fails only on a file with none (line 62), and its
`--online` mode compares the caller's real expiry with `cloudflarePreviewExpires` alone (line
119). `.github/workflows/watch.yml`'s report step counts any result but `success` as a failure
(`[ "$CHECKS" = "success" ] || failed=...`), which on an hourly cron would read the skipped
weekly jobs as failures. Wrangler is 4.129.1 since PR #36, so the preview no longer dies under
the tests on this machine, four clean first attempts in a row on 7 September.

## Decisions taken in this plan (the spec is not reopened)

- The required-keys list for `check-expiry.mjs` (spec section 4) lands in two steps: phase A
  adds the list with the six keys the file holds today, so no PR claims a token that does not
  exist; phase B adds `cloudflareWatchExpires` to the list and to `.github/expiry.json` in the
  same commit the owner's new secret is named, so the file and the list never disagree.
- The watch token's real expiry is verified by the script that already does it: `check-expiry.mjs`
  gains `--key <name>` (default `cloudflarePreviewExpires`), and the new job runs
  `node scripts/check-expiry.mjs --online --key cloudflareWatchExpires` with the watch token
  before the credential-use script. One verify path, already tested against a stand-in server,
  rather than a second copy in the new script.
- A missing `CLOUDFLARE_WATCH_TOKEN` is exit 1, never a skip: a skipped job would leave the run
  green, the heartbeat green and nothing checked. So the token exists before phase B's PR merges,
  and the PR description says so.
- The check script is `scripts/check-credential-use.mjs`, its judgement and formatter
  `scripts/lib/credential-use.mjs`; the heartbeat is `scripts/check-heartbeat.mjs` over
  `scripts/lib/heartbeat.mjs`. Neither gets a `pnpm` script: the workflows run them with `node`,
  the runbook names the commands, and CLAUDE.md's Commands list gains nothing to drift.
- The heartbeat measures the newest completed `watch` run of any trigger, by its `updated_at`,
  against three hours, and fails on `conclusion` other than `success`; it runs on `ci`'s
  `pull_request` and `push` events alike with a read-only token.
- The finding issue's title is exactly "A credential was used outside the workflows"; the report
  job finds it as it finds "The watch failed", by title and by author `app/github-actions`,
  newest first, open or closed for the state read and open only for the comment.
- The report is list items, one per line, never a table; each line's ids sit in fixed positions
  (the audit-log id first, then the deployment and version prefixes in brackets) so 2.5's state
  read takes them by position and not by pattern over the chosen text.
- The production step's shape in the library is the preview's six kinds plus one route entry on
  `anandfrancis-com`, as spec section 8 allows; the first real release after phase B is the
  measurement, and its record in this file corrects the shape if it differs.
- Fixtures are built from the key lists the spec's preamble records (nested `actor.token` and
  flat `actor.token_id`/`actor.token_name` alike), with every forbidden field carrying a
  recognisable placeholder (`redacted-email`, `203.0.113.7`, `redacted-account`), so the
  allow-list test asserts the placeholders' absence from the report.

## Repository layout (additions and changes)

```
.github/workflows/watch.yml (changed)  .github/workflows/ci.yml (changed)  .github/workflows/deploy.yml (changed)
.github/expiry.json (changed)  REVIEW.md (changed)
scripts/check-credential-use.mjs  scripts/lib/credential-use.mjs  scripts/check-heartbeat.mjs  scripts/lib/heartbeat.mjs
scripts/check-expiry.mjs (changed)
tests/config/credential-use.test.mjs  tests/config/heartbeat.test.mjs  tests/config/expiry.test.mjs (changed)
CLAUDE.md (changed)  docs/runbook.md (changed)
docs/sdlc/002-playbook-gaps/plan.md (changed)  docs/sdlc/002-playbook-gaps/spec.md (changed)  docs/sdlc/002-playbook-gaps/scorecard.md (changed)
docs/sdlc/003-credential-use/intent.md (changed, phase C)
```

## npm scripts (additions and changes)

None. `check-expiry` gains the `--key` option; the two new scripts are run by the workflows with
`node` and by hand as the runbook says.

## Order of work

Three phases, one PR each, in sequence; each branch is cut from `main` after the previous merge.
Every PR runs the pre-flight passes and the verifier and posts their reports, and carries
`pnpm verify` at its head, as CLAUDE.md requires.

### A. The check, its library and its tests

- Files: `scripts/lib/credential-use.mjs` (the span arithmetic, the window builder from runs,
  jobs and steps, the judgement in the spec's order, the shape per step kind, the formatter
  with its allow-list and escape function, the cap, the state reader); `scripts/check-credential-use.mjs`
  (the fetches of spec 2.1, paging by `cursor` and by run page, the `before` rule for a running
  step, the report file, the summary, the exit codes of 2.1, stderr that names endpoints and
  status codes only); `tests/config/credential-use.test.mjs` (every case gate 1 lists);
  `scripts/check-expiry.mjs` (the required-keys list of six, `--key`) and `tests/config/expiry.test.mjs`
  (a file missing a required key fails and names it; `--key` selects the compared date).
- The script can be run by hand against the real account with a read token in the environment
  and `--dry-run`, which fetches, judges and prints the report but writes no file and opens
  nothing; the session runs it once against the owner's account through the Cloudflare tool's
  session only if the owner asks, since the point of the phase is the fixtures.
- Done: `pnpm check` green with the new suite inside it; gate 1's list covered case by case, the
  test names reading as the gate's clauses; gate 2's first half (the missing-key case) green;
  `pnpm verify` at the head.
- Could go wrong: the audit log's paging cursor semantics differing from the docs (the script
  stops on an empty page as well as on passing `since`); GitHub's jobs API omitting step
  timestamps for a queued job (a step with no `completed_at` is the running case of 2.2, and a
  step with no `started_at` gives no window); the Unicode categories in the escape function
  needing the `u` flag and `\p{Cc}\p{Cf}` (Node 22 supports both).

### B. The token, the watch, the heartbeat and the records

- Hands-on, the owner's, before the PR merges: create the Cloudflare user API token
  "anandfrancis.com watch (GitHub Actions)" with `Account Settings Read` and `Workers Scripts
  Read`, resources this account only, expiring 3 September 2027; paste it into the repository
  secret `CLOUDFLARE_WATCH_TOKEN`. Claude drives everything up to and after; the value never
  passes through its tools.
- Files: `.github/expiry.json` (`cloudflareWatchExpires`) with `check-expiry.mjs`'s list gaining
  the key; `.github/workflows/watch.yml` (the second cron `17 * * * *`; `checks` and `smoke`
  gated to the Monday cron and dispatch; the `credential use` job of spec 3.2, its two Cloudflare
  values in the step's `env`, the expiry step with `--key`, the report artifact with
  `retention-days: 1`; the report job's `needs` of three, its `failure` test, the finding issue
  by `--body-file` that only the owner closes; `run-name` for the hourly run); `deploy.yml`
  (`name: deploy` on both deploy steps, `name: roll back` on both rollback steps, nothing else);
  `ci.yml` (the `watch heartbeat` job, `contents: read` and `actions: read`, not required);
  `scripts/check-heartbeat.mjs` and `scripts/lib/heartbeat.mjs` with `tests/config/heartbeat.test.mjs`
  (a fresh successful run, a stale one, a failed one, no run at all); `docs/runbook.md`, "The
  watch" (the new check, the finding issue and its chore, the heartbeat and its remedy, where a
  YAML error shows); CLAUDE.md's Commands line on the watch (hourly for credential use, weekly
  for the rest); `docs/sdlc/002-playbook-gaps/spec.md` 3.3 corrected in place (the hourly cron
  beside the weekly, "after all three"); plan 002's two records ("Superseded after delivery" for
  3.3's cadence, "Added after delivery" for the job and its token, saying the expiry step keeps
  the preview token); `scorecard.md` C4 losing "the only one it holds" and "weekly", its note
  saying the year is a decision; `REVIEW.md`'s "spec section 10" reading "the spec's quality
  gates".
- After the merge: wait 75 minutes, then `gh workflow run watch.yml` once (gate 3), read the run
  for the expiry step's line on the watch token (gate 5) and the report job's "Passed" line; open
  the next pull request (phase C's) and read the heartbeat green on it; read one hourly run's
  report job leaving "The watch failed" closed with `checks` and `smoke` skipped. Record the run
  ids here.
- Done: gates 2, 3, 5 and 6 as the proof table says; the drift test green over CLAUDE.md and the
  runbook; `pnpm verify` at the head; the records written.
- Could go wrong: the token names Cloudflare stores differing in whitespace or case from spec
  002's text (read one real entry from the first hourly run's artifact and correct the library's
  constants in the same PR, recorded here); the first hourly run reporting deploys made before
  the steps had names (expected, gate 3's 75 minutes; if it opens the finding issue anyway, the
  owner closes it with a comment naming this cause, recorded here); GitHub's scheduled runs
  arriving late in the hour (2.2's anchor covers it; the heartbeat's three hours absorb it).

### C. The rehearsal and the close

- Hands-on, the owner's: `pnpm run deploy:preview` from his machine with his wrangler login,
  outside any workflow run; within one interval, read the issue "A credential was used outside
  the workflows" for the lines spec section 8 names and for the absence of an email, an IP and
  the account id; dispatch `rollback-preview`; read the next interval's run adding no line; close
  the issue with a comment naming the rehearsal.
- Files: this file (the rehearsal record with the issue number and both run ids, the first
  fortnight's count of hourly runs and findings per spec section 9, the production shape if a
  release has happened by then, and the closing record); `docs/sdlc/002-playbook-gaps/plan.md`
  (the assessment's fifth finding closed as a decision, beside the #28 to #30 records, pointing
  at intent 003); `docs/sdlc/003-credential-use/intent.md` line 3 (delivered, with the date and
  the pointer to this file's closing record); CLAUDE.md's Process line ("delivered").
- Done: gate 4 recorded; the closing record names every gate's proof; the SDLC check passes with
  the intent's status line updated; `pnpm verify` at the head.
- Could go wrong: the rehearsal's deploy leaving the preview Worker on a build the owner did not
  mean to keep (the `rollback-preview` dispatch is the second half of the rehearsal for this
  reason); the issue opening on the rehearsal's entries a second time after the owner closes it
  (2.5 reads a closed issue; if it happens anyway, the state read is the bug and phase C fixes it
  in the same PR, recorded here).

## Risks

- Cloudflare's audit log is the source, and an outage of its API fails the hourly job and opens
  "The watch failed" with a comment per run until it recovers. Accepted in the spec (concern 4);
  if a day of comments proves a nuisance, the report job skips a comment whose text equals the
  last one, as a departure recorded here.
- The first real production release after phase B is the measurement of the production step's
  shape; a mismatch opens the finding issue once (spec concern 5). The record here closes it.
- The token names are the actor key (spec concern 1). A thief with a deploy token is caught by
  window and shape; the names are read from spec 002 and confirmed against a real entry in phase
  B's first run.
- `.github/workflows/deploy.yml`, `ci.yml`, `check-expiry.mjs` and `.github/expiry.json` are
  files the fix guard fences; none of these PRs is a fix task, and the changes are named in each
  PR so the reviewer reads them as the gate changes they are.
- GitHub's API budget for `GITHUB_TOKEN` is 1,000 requests an hour per repository; the hourly job
  makes a few dozen at most (runs, jobs, steps for a day's deploys, the issue and its comments),
  and the heartbeat one. No margin problem; recorded so a future change reading more knows the
  ceiling.

## Proof (spec section 7, gate by gate)

| Gate | Check | Command or record | Phase |
| --- | --- | --- | --- |
| 1 verify green; the credential-use suite covers every listed case | `tests/config/credential-use.test.mjs` | `pnpm verify` | A |
| 2 expiry refuses a missing required key; the heartbeat library tested | `expiry.test.mjs`, `heartbeat.test.mjs` | `pnpm test:config` | A, B |
| 3 the watch dispatched once, green, nothing reported; heartbeat green on the next PR; an hourly run leaves "The watch failed" closed | run ids in "Records" | `gh workflow run watch.yml`, 75 minutes after the merge | B |
| 4 the rehearsal done once | the issue number, the two run ids, the issue's text checked | record | C |
| 5 the watch token's date recorded and its real expiry verified in the dispatched run | `.github/expiry.json`; the expiry step's line in the run | record | B |
| 6 the records of spec section 5 written; the drift test green | plan 002, spec 002 3.3, scorecard C4, CLAUDE.md, the runbook, REVIEW.md; `claude-md.test.mjs` | `pnpm test:config` | B, C |
| 7 dist untouched | the verifier's report on each PR | record | A, B, C |

## Records

(Written as each phase closes.)

## Departures recorded during implementation

(None yet.)
