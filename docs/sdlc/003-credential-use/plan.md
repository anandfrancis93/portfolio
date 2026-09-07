# Plan: know when a credential is used outside the workflows (from spec.md, 7 September 2026)

Status: accepted by the engineer and product owner on 7 September 2026, before any code was
written.
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
takes every `*Expires` key by suffix (line 62), fails only on a file with none (line 63), reads
its token from `CLOUDFLARE_API_TOKEN` alone (line 86), names "the preview token" in its online
messages, and in `--online` mode compares the caller's real expiry with `cloudflarePreviewExpires`
alone (line 119). `.github/workflows/watch.yml`'s report step counts any result but `success` as
a failure, which on an hourly cron would read the skipped weekly jobs as failures. Wrangler is
4.129.1 since PR #36, whose trail carries four first-attempt clean `pnpm verify` runs on 7
September (at `81294a2`, `3a71f31`, `296d43d` and `fb0a97d`), consistent with the preview no
longer dying under the tests and not proof of it. `scripts/check-expiry.mjs` also runs every
offline check (the warn window on each date, the rehearsal against its interval) on every
invocation, online or not, and exits 1 on any of them.

## Decisions taken in this plan (the spec is not reopened)

- The required-keys list for `check-expiry.mjs` (spec section 4) lands in two steps: phase A
  adds the list with the five keys the spec names that the file holds today (the three dates,
  `rollbackRehearsed`, `rollbackIntervalDays`; `warnDays` is not on the spec's list and the
  script's integer check refuses its absence already), so no PR claims a token that does not
  exist; phase B adds `cloudflareWatchExpires` to the list and to `.github/expiry.json` in the
  same commit the owner's new secret is named, so the file and the list never disagree.
- The watch token's real expiry is verified by the script that already does it, and spec 2.1's
  last input (the verify call and `expiry.json`) becomes the job's own step rather than the check
  script's: `check-expiry.mjs` gains `--key <name>` (default `cloudflarePreviewExpires`) and
  `--verify-only`, which skips the offline sweep and asks one thing, that the named key's real
  expiry agrees with the recorded one within a day; its online messages, and the comments at
  the top of the script and of `watch.yml`, name the key instead of "the preview token". The
  new job runs the check script first, then `node scripts/check-expiry.mjs --online
  --verify-only --key cloudflareWatchExpires` with the step's `env` mapping
  `secrets.CLOUDFLARE_WATCH_TOKEN` into `CLOUDFLARE_API_TOKEN`, the one variable the script
  reads; both steps carry `if: ${{ !cancelled() }}`, the pattern the `checks` job already uses,
  so neither failing skips the other, and the report job tolerates a missing artifact. Without
  `--verify-only` the hourly step would fail on every run from thirty days before an expiry, or
  from the day the rehearsal interval lapses, skip the check script under the default step
  condition, and give "The watch failed" a comment an hour for months; the warn window and the
  rehearsal stay the Monday job's and `pnpm check`'s. The reviewer reads the `secrets.`
  reference in the workflow, since the run's line cannot tell the two tokens apart (both expire
  on the same day), and a config test pins it (phase B). One verify path, already tested against
  a stand-in server, rather than a second copy in the new script.
- A missing `CLOUDFLARE_WATCH_TOKEN` is exit 1, never a skip: a skipped job would leave the run
  green, the heartbeat green and nothing checked. So the token exists before phase B's PR merges,
  and the PR description says so.
- The check script is `scripts/check-credential-use.mjs`, its judgement and formatter
  `scripts/lib/credential-use.mjs`; the heartbeat is `scripts/check-heartbeat.mjs` over
  `scripts/lib/heartbeat.mjs`. Neither gets a `pnpm` script: the workflows run them with `node`,
  the runbook names the commands, and CLAUDE.md's Commands list gains nothing to drift. The
  check script has no flag for running by hand: the session never runs it against the real
  account, and a by-hand run is the owner's, from phase B on, in his own shell with the four
  values of spec 2.1 (`CLOUDFLARE_WATCH_TOKEN`, a value only he holds, since a pasted secret
  cannot be read back; `CLOUDFLARE_ACCOUNT_ID`; `GITHUB_TOKEN` from `gh auth token`;
  `GITHUB_REPOSITORY`), the command the runbook gains in phase B.
- The heartbeat measures the newest completed `watch` run of any trigger, by its `updated_at`,
  against three hours, and fails on `conclusion` other than `success`; it runs on `ci`'s
  `pull_request` and `push` events alike with a read-only token.
- The finding issue's title is exactly "A credential was used outside the workflows"; the report
  job finds it as it finds "The watch failed", by title and by author `app/github-actions`,
  newest first, open or closed for the state read and open only for the comment.
- The report is list items, one per line, never a table, in two shapes: an audit-log line opens
  with its audit-log id, then the deployment and version prefixes in brackets when the entry
  has them, then the chosen text in code spans; a deployment or version line opens with the
  prefixes it has, in a fixed order (deployment, then version; a version not yet deployed has
  the second alone), then the code spans. The state read of spec 2.5 splits the body on LF
  alone and takes every bracketed token and every leading id from the part of a line before
  its first backtick; the escape function strips backticks from chosen text, and the Unicode
  line separators (`\p{Zl}` and `\p{Zp}`) with the Cc and Cf categories, so the first backtick
  is always the first code span and no chosen text can start a line of its own; a message
  carrying a bracketed eight-character string cannot hide a finding. Gate 1's overlap case and
  its allow-list case (with a U+2028 in the message) cover it.
- The production step's shape in the library is the preview's six kinds plus one route entry on
  `anandfrancis-com`, as spec section 8 allows; the first real release after phase B is the
  measurement, and its record in this file corrects the shape if it differs.
- Fixtures are what spec 9 says, "the real entries of 5 September 2026 with the forbidden
  fields replaced by placeholders, so the tests exercise the real shape, nested and flat": the
  session did not keep the 5 September bodies, so phase A reads them again the way the
  preamble's call was made, through the Cloudflare tool under the owner's login, read-only, with
  no token value in the session's hands (the tool's connector needs the owner's authorisation
  first, phase A's one hands-on step). Every forbidden field is replaced before anything is
  written down, with a recognisable placeholder (`redacted-email`, `203.0.113.7`,
  `redacted-account` in `raw.uri`'s account segment, since the Worker segment of the same string
  is printed, and `redacted-token-id` for the token id that is printed nowhere), so the
  allow-list test asserts the placeholders' absence from the report. The flat
  `actor.token_id`/`actor.token_name` shape, which the log did not return, is one synthesised
  variant of a real entry.
- Paging has hard ceilings counted in calls, since each run read costs a jobs call: twenty
  audit-log pages of 1,000 entries (the API's maximum page), and five hundred runs read; a
  ceiling reached with more to read (a next cursor, a next page) is exit 1 like a missing page,
  never a report on a partial span, and a 403 or 429 from either API is exit 1 like any
  refusal. So a paging bug cannot spend the repository's shared hourly budget of
  `GITHUB_TOKEN` requests and fail a release at its gate step, and a flood cannot slip past a
  ceiling unseen: at 1,000 a page, twenty pages is more than one token can write in an hour
  under Cloudflare's own rate limit.

## Repository layout (additions and changes)

```
.github/workflows/watch.yml (changed)  .github/workflows/ci.yml (changed)  .github/workflows/deploy.yml (changed)
.github/expiry.json (changed)  REVIEW.md (changed)
scripts/check-credential-use.mjs  scripts/lib/credential-use.mjs  scripts/check-heartbeat.mjs  scripts/lib/heartbeat.mjs
scripts/check-expiry.mjs (changed)
tests/config/credential-use.test.mjs  tests/config/heartbeat.test.mjs  tests/config/watch.test.mjs  tests/config/expiry.test.mjs (changed)
CLAUDE.md (changed)  docs/runbook.md (changed)
docs/sdlc/002-playbook-gaps/plan.md (changed)  docs/sdlc/002-playbook-gaps/spec.md (changed)  docs/sdlc/002-playbook-gaps/scorecard.md (changed)
docs/sdlc/003-credential-use/intent.md (changed, phase C)
```

## npm scripts (additions and changes)

None. `check-expiry` gains the `--key` option; the two new scripts are run by the workflows with
`node` and, the check script, by the owner by hand as the runbook says.

## Order of work

Three phases, one PR each, in sequence; each branch is cut from `main` after the previous merge,
and phase C's PR opens no sooner than a fortnight after phase B merges, since it records the
first fortnight's count of hourly runs and findings. Every PR runs the pre-flight passes and the
verifier and posts their reports, and carries `pnpm verify` at its head, as CLAUDE.md requires.

### A. The check, its library and its tests

- Hands-on, the owner's, before the fixtures are written: authorise the Cloudflare connector
  in his claude.ai connector settings, so the session can read the 5 September entries again
  through it under his login (decision 9). No token value changes hands.
- Files: `scripts/lib/credential-use.mjs` (the span arithmetic, the window builder from runs,
  jobs and steps, the judgement in the spec's order, the shape per step kind, the formatter
  with its two line shapes, its allow-list and escape function, the cap, the state reader);
  `scripts/check-credential-use.mjs` (the fetches of spec 2.1 less the verify call, which is
  the job's step, paging by `cursor` and by run page under the ceilings, the `before` rule for
  a running step, the report file, the summary, the exit codes of 2.1, stderr that names
  endpoints and status codes only); `tests/config/credential-use.test.mjs` (every case gate 1
  lists); `scripts/check-expiry.mjs` (the required-keys list of five, `--key`, `--verify-only`,
  the online messages and the header comment naming the key) and `tests/config/expiry.test.mjs`
  (a file missing a required key fails and names it; `--key` selects the compared date and the
  message names it; `--verify-only` reports the drift and not a warn window or a lapsed
  rehearsal).
- The script is never run against the real account in this phase: no token for it exists yet,
  and the point of the phase is the fixtures.
- Done: `pnpm check` green with the new suite inside it; gate 1's list covered case by case, the
  test names reading as the gate's clauses; gate 2's first half (the missing-key case) green;
  `pnpm verify` at the head.
- Could go wrong: the audit log's paging cursor semantics differing from the docs (the script
  stops on an empty page or on passing `since`; a ceiling met with more to read is exit 1, never
  a stop); the 5 September entries no longer readable through the tool (they are inside the
  log's eighteen-month retention; if the tool cannot reach them, the spec's sentence is
  corrected in place and recorded as a departure here); GitHub's jobs API omitting
  step timestamps for a queued job (a step with no `completed_at` is the running case of 2.2,
  and a step with no `started_at` gives no window); the Unicode categories in the escape
  function needing the `u` flag and `\p{Cc}\p{Cf}` (Node 22 supports both).

### B. The token, the watch, the heartbeat and the records

- Hands-on, the owner's, before the PR merges: create the Cloudflare user API token
  "anandfrancis.com watch (GitHub Actions)" with `Account Settings Read` and `Workers Scripts
  Read`, resources this account only, expiring 3 September 2027; paste it into the repository
  secret `CLOUDFLARE_WATCH_TOKEN`. Claude drives everything up to and after; the value never
  passes through its tools.
- Files: `.github/expiry.json` (`cloudflareWatchExpires`) with `check-expiry.mjs`'s list gaining
  the key; `.github/workflows/watch.yml` (the second cron `17 * * * *`; `checks` and `smoke`
  gated to the Monday cron and dispatch; the `credential use` job of spec 3.2: the check
  script first with `CLOUDFLARE_WATCH_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in its step's `env`,
  then the expiry step with `--verify-only --key` and the watch secret mapped into
  `CLOUDFLARE_API_TOKEN` in that step's `env`, both steps `if: ${{ !cancelled() }}`, the report
  artifact with `retention-days: 1`; the report job's `needs` of three, its `failure` test, a
  missing artifact tolerated, the finding issue by `--body-file` that only the owner closes;
  `run-name` for the hourly run; the header comment no longer calling the preview token the
  only one the watch holds); `tests/config/watch.test.mjs` (the `credential use` job's
  `secrets.` references are `CLOUDFLARE_WATCH_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` and nothing
  else, and the job runs on both crons, read from the workflow file, so a later edit copying
  the `checks` step's deploy secret into it fails `pnpm check`); `deploy.yml` (`name: deploy`
  on both deploy steps, `name: roll back` on both rollback steps, nothing else); `ci.yml` (the
  `watch heartbeat` job, `contents: read` and `actions: read`, not required);
  `scripts/check-heartbeat.mjs` and `scripts/lib/heartbeat.mjs` with
  `tests/config/heartbeat.test.mjs` (a fresh successful run, a stale one, a failed one, no run
  at all); `docs/runbook.md`, "The watch" (the new check and the command for a run by hand,
  the finding issue and its chore, the heartbeat and its remedy, where a YAML error shows);
  CLAUDE.md's Commands line on the watch (hourly for credential use, weekly for the rest);
  `docs/sdlc/002-playbook-gaps/spec.md` 3.3 corrected in place (the hourly cron beside the
  weekly, "after all three"); plan 002's two records ("Superseded after delivery" for 3.3's
  cadence, "Added after delivery" for the job and its token, saying the expiry step keeps the
  preview token); `scorecard.md` C4 losing "the only one it holds" and "weekly", its note saying
  the year is a decision; `REVIEW.md`'s "spec section 10" reading "the spec's quality gates".
- Before the merge, once the secret exists, the branch is pushed and the pre-flight passes have
  read `watch.yml`'s diff (its `secrets.` references and `persist-credentials: false`):
  `gh workflow run watch.yml --ref <branch>`, no sooner than 75 minutes after the last `deploy`
  run whose steps had no names, on any ref, since a dispatch runs the branch's file with the
  repository's secrets and the check reads runs of every ref. It is the first proof that the
  token reaches the audit log and the Workers' lists under its two permissions alone, that the
  names Cloudflare stores for the deploy tokens match spec 002's text (read from the run's
  allow-listed artifact), and the first reading of gate 5, that the expiry step verifies the
  watch token. A mismatch in a name opens the finding issue on the real list, naming every
  deploy of the span, and the owner closes it with a comment naming the cause; a 403 on the log
  opens "The watch failed", which the next passing run closes; either is corrected in the same
  PR and recorded here. The runs made by the PR's own pushes ran the branch's `deploy.yml`, so
  their steps are named and inside windows.
- After the merge: wait 75 minutes, then `gh workflow run watch.yml` once on `main` (gate 3),
  read the run for the expiry step's line (gate 5's second reading, the spec's) and the report
  job's "Passed" line; open the next pull request and read the heartbeat green on it; read one
  hourly run's report job leaving "The watch failed" closed with `checks` and `smoke` skipped.
  These run ids are recorded in phase C's PR, the first after the merge.
- Done: the files above merged with `pnpm verify` at the head; the drift test green over
  CLAUDE.md and the runbook; the branch dispatch green and read as above; gates 2 and 6's
  phase-B half and gate 5's first reading shown at the head, gate 3 and gate 5's second reading
  shown by phase C's record.
- Could go wrong: the token names Cloudflare stores differing in whitespace or case from spec
  002's text, or `Account Settings Read` not reaching the audit log under a token holding only
  the two groups (both caught by the branch dispatch and corrected in the same PR, the second
  with the permission group Cloudflare's docs name and no broader one, recorded here); the
  first hourly run on `main` reporting a deploy made from `main` before the steps had names
  (expected, gate 3's 75 minutes; if it opens the finding issue anyway, the owner closes it with
  a comment naming this cause, recorded in phase C); this PR's own `watch heartbeat` check
  showing red on its early pushes, since `ci.yml` runs from the branch and the newest completed
  `watch` run of any ref is the Monday one or a dispatch, older than three hours (expected, not
  required, read as such by the reviewer and the owner; green for three hours after the branch
  dispatch, and from the first hourly run after the merge);
  GitHub's scheduled runs arriving late in the hour (2.2's anchor covers it; the heartbeat's
  three hours absorb it).

### C. The rehearsal and the close

- Hands-on, the owner's: `pnpm run deploy:preview` from his machine with his wrangler login,
  outside any workflow run; within one interval, read the issue "A credential was used outside
  the workflows" for the lines spec section 8 names and for the absence of an email, an IP and
  the account id; dispatch `rollback-preview`; read the next interval's run adding no line; close
  the issue with a comment naming the rehearsal.
- Files: this file (phase B's post-merge record: the dispatched run, the hourly run and the
  pull request that showed the heartbeat green; the rehearsal record with the issue number and
  both run ids; the first fortnight's count of hourly runs and findings per spec section 9; the
  production shape if a release has happened by then; and the closing record, which names every
  gate's proof, repeats the lifetime decision of intent outcome 5 with its reason, and carries
  spec 11's reading of outcome 4, one Superseded record and one Added, to the intent's status
  line); `docs/sdlc/002-playbook-gaps/plan.md` (the assessment's fifth finding closed as a
  decision, beside the #28 to #30 records, pointing at intent 003);
  `docs/sdlc/003-credential-use/intent.md` line 3 (delivered, with the date, the pointer to
  this file's closing record and the outcome-4 reading); CLAUDE.md's Process line
  ("delivered").
- Done: gates 3 and 4 recorded; the closing record names every gate's proof; the SDLC check
  passes with the intent's status line updated; `pnpm verify` at the head.
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
  B's branch dispatch.
- `.github/workflows/deploy.yml`, `ci.yml`, `check-expiry.mjs` and `.github/expiry.json` are
  files the fix guard fences; none of these PRs is a fix task, and the changes are named in each
  PR so the reviewer reads them as the gate changes they are.
- GitHub's API budget for `GITHUB_TOKEN` is 1,000 requests an hour per repository, shared by the
  hourly job, the heartbeat and the deploy workflow's own check of `ci`; the hourly job makes a
  few dozen calls at most, and the ceilings of the last decision, counted in calls, bound a
  bug's spend below the budget.

## Proof (spec section 7, gate by gate)

| Gate | Check | Command or record | Phase |
| --- | --- | --- | --- |
| 1 verify green; the credential-use suite covers every listed case | `tests/config/credential-use.test.mjs` | `pnpm verify` | A |
| 2 expiry refuses a missing required key; the heartbeat library tested | `expiry.test.mjs`, `heartbeat.test.mjs` | `pnpm test:config` | A, B |
| 3 the watch dispatched once on `main`, green, nothing reported; heartbeat green on the next PR; an hourly run leaves "The watch failed" closed | run ids in "Records", written in phase C | `gh workflow run watch.yml`, 75 minutes after the merge | B, C |
| 4 the rehearsal done once | the issue number, the two run ids, the issue's text checked | record | C |
| 5 the watch token's date recorded and its real expiry verified | `.github/expiry.json`; the expiry step's line in the branch dispatch, then in gate 3's run; its `env` reading `secrets.CLOUDFLARE_WATCH_TOKEN`, pinned by `watch.test.mjs` | record; `pnpm test:config` | B, C |
| 6 the records of spec section 5 written; the drift test green | plan 002, spec 002 3.3, scorecard C4, CLAUDE.md, the runbook, REVIEW.md; `claude-md.test.mjs` | `pnpm test:config` | B, C |
| 7 dist untouched | the verifier's report on each PR | record | A, B, C |

## Records

(Written as each phase closes.)

## Departures recorded during implementation

- Phase A, 7 September 2026: decision 9 has the fixtures read again through the Cloudflare
  tool, and the six audit entries of the 5 September deploy at 07:03 UTC were, every forbidden
  field replaced before they were written down. The Workers' deployment and version lists keep
  only their last ten items, so that deploy's two list items were gone; the fixture builds them
  to the shape the 5 September read recorded, with the deploy's real version and deployment ids
  taken from its own audit entries, and says so in its header. The run and jobs behind the
  entries are the real ones (33951428691, PR #26's preview), the deploy step named `deploy` as
  phase B will name it. One rule the library needed that the plan did not state: the log and
  the lists describe the same events, so "each kind once inside a window" is counted per source,
  or a deploy's own deployment list item would read as a second `Create Deployment`.
