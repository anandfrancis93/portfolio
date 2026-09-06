# Spec: know when a credential is used outside the workflows

Status: draft, written on 5 September 2026 for the owner's acceptance.
Derived from: `intent.md` (accepted 5 September 2026, PR #34).
Constraints applied: the `web-quality` skill's rules on deploy configuration and pinned actions
apply to the three workflow changes (`watch`, `ci`, `deploy`); the `acme-design-system` and
`portfolio-voice` skills constrain nothing here, since no page, copy or style changes.
Companion documents: spec 002, whose section 3.3 this change supersedes in part, and
`docs/runbook.md`, "The watch".

The intent left one question for a real call, in three parts. The session made the call on
5 September 2026, read-only, through the Cloudflare tool the owner's login authorises, with no
token value in its hands, against the account's audit log (version 2) and both Workers'
deployment and version lists; the call itself left no entry, by the first answer below. The
sixty newest entries covered the ten most recent deploy runs, about ten hours, and settled all
three parts:

- Reads are not logged. Every one of the sixty was a `POST` or a `PATCH`, though many reads
  were made beside them. Cloudflare's documentation says the same: `GET` requests and `4xx`
  responses are not logged, and selective logging of sensitive reads is planned, not present.
  So the watch's own reads leave nothing, and neither does a thief who only reads or probes.
- An entry names the token. Every action the deploy workflow made carries `actor.context`
  `api_token` and a nested `actor.token` object with `id` and `name`; Cloudflare's published
  schema names the same two flat, `actor.token_id` and `actor.token_name`, so the library reads
  either shape. A dashboard action carries `dash`, a wrangler login `oauth`. One kind of entry
  has no actor identity: `actor.type` `delegated_service`, Cloudflare's own asset-upload
  service acting for the session a token opened, one entry per deploy, with a path that names
  no Worker (`/workers/assets/upload`).
- The preview deploy token already reaches the log. Reading it needs `Account Settings Read` or
  `Write`, and spec 002 section 3.1 records that permission on both deploy tokens. This
  changes nothing in the intent's decision: the token that runs every hour on a runner is still
  one that cannot deploy.

The call also showed the shape of a deploy. A preview deploy leaves six entries inside its
step's window, in order `Create Assets Upload Session`, `Upload Assets` (the delegated
service), `Upload Version`, `Create Deployment`, `Patch Script Settings` and `Post Worker
subdomain`, five of them on `anandfrancis-com-preview`, plus one version and one deployment in
that Worker's lists; ten runs, the same six every time. The production release's shape is
learned from the first real release after this change (section 8).

## 1. What this change delivers

1. A check script that reads what Cloudflare recorded since the previous successful run and
   what the `deploy` workflow's steps were doing at the time, judges every entry (actor first,
   then window, then shape) and prints a capped report of the unexpected from an allow-list of
   fields (section 2).
2. The `watch` workflow runs every hour for that check and keeps its weekly cadence for the
   three checks it has; a fourth job carries the new check, and the report job opens a distinct
   issue for a finding, which only the owner closes (section 3).
3. A fourth credential, the third Cloudflare token, read-only, held by the watch alone, with
   its expiry recorded and verified like the others, and the expiry check made to refuse a
   file missing any of the dates it knows (section 4).
4. A heartbeat: a job on `ci`, visible and not required, that fails when the watch has not
   run and passed within the last three hours (section 6).
5. The records this change owes: spec 002's weekly cadence superseded and recorded in plan
   002, the new job recorded there too, CLAUDE.md's folder list and watch line, the runbook,
   the scorecard's C4 note, and the assessment's fifth finding closed as a decision (section 5).
6. A rehearsal that proves the report opens on a real deploy from outside the workflows and
   prints nothing the allow-list forbids (section 8).

## 2. The check (`scripts/check-credential-use.mjs`)

### 2.1 Placement and shape

- A Node ESM script under `scripts/`, its judgement pure in `scripts/lib/credential-use.mjs`,
  tested against fixtures in `tests/config/credential-use.test.mjs` on every `pnpm check`. The
  script fetches; the library decides and formats; nothing in the library touches the network.
- Inputs, all read-only: the account's audit log, version 2
  (`GET /accounts/{account}/logs/audit`, `since` and `before` required, `limit` and `cursor` for
  paging, `direction` `asc`); each Worker's deployments and versions
  (`GET .../workers/scripts/{name}/deployments` and `.../versions`); the `deploy` workflow's
  runs, their jobs and those jobs' steps from GitHub's API; the newest finding issue and the
  workflow's own comments on it (2.5); the watch's own token through `GET /user/tokens/verify`
  and `.github/expiry.json` (section 4).
- Environment: `CLOUDFLARE_WATCH_TOKEN` (section 4), `CLOUDFLARE_ACCOUNT_ID`, `GITHUB_TOKEN`,
  `GITHUB_REPOSITORY`. Nothing else; no wrangler, no install, like the expiry check.
- Exit codes: 0 when the check ran, whether or not it found anything, its report on stdout and
  in a file the report job reads; 1 when it could not run (an API refused, a token invalid, a
  page missing), with the reason on stderr and no report, so a broken check is a failed job and
  never a silent pass. Stderr names the endpoint by a short name and the status code, never the
  request URL (it carries the account id), a response body, or the token id the verify endpoint
  returns; `scripts/check-expiry.mjs` prints none of these, and this script follows it.

### 2.2 The span

- Each run reads from `since` to `before`. `since` is the earlier of 75 minutes ago (the hourly
  interval plus fifteen minutes of overlap for an entry Cloudflare writes late) and the
  `started_at` of the previous successful `credential use` job, read from the jobs API the job
  already uses, a value only GitHub writes; the first run, with no predecessor, takes 75
  minutes. A run GitHub dropped or delayed, or a run that exited 1, leaves no gap: the next run
  reads its span too. Entries can be read twice; 2.5 keeps them from being reported twice.
- `before` is now, except while a deploy step is running: then it stops at that step's
  `started_at` less the padding, and the entries the step has written so far wait for the next
  run, which will have the finished step's window.
- The `deploy` runs are read newest first, fifty a page, until the oldest run read was created
  more than twenty minutes (the longest job timeout) before `since`; and, since a dispatched
  run can wait at the environment gate for hours or days before its job starts, every
  `workflow_dispatch` run of the last thirty days (the gate's longest wait) is read as well,
  by event, so a release approved late is judged by when its step ran and not by when it was
  asked for. Jobs are listed with `filter=all`, so a re-run's first attempt keeps its deploy
  step and its window.

### 2.3 The judgement, in order

An entry is one audit-log record, one deployment or one version. The two lists are read as
well as the log because a deployment is the thing that changes what a visitor gets, and the
lists carry the ids the report needs.

1. **Actor.** The expected actors are the two deploy tokens, matched on `actor.context`
   `api_token` and the token name equal to one of the two names spec 002 section 3.1 records
   ("anandfrancis.com preview deploy (GitHub Actions)" and "anandfrancis.com production deploy
   (GitHub Actions)"), and `actor.type` `delegated_service`, Cloudflare's own service acting
   inside a deploy. Any other actor is reported, whatever the time: a dashboard action, an
   OAuth session, a global API key, an `api_token` with any other name. The names are the key
   rather than the ids because they are public already and a deploy token cannot mint a token
   of any name (that needs a user-level permission the deploy tokens lack); the ids are printed
   nowhere.
2. **Window.** A window belongs to a deploy step, not a run: for each of the fifty runs, each
   job named `preview`, `production`, `rollback` or `rollback-preview`, and in it the step
   named `deploy` or `roll back` (the workflow PR gives those steps their names), the window is
   that step's `started_at` less sixty seconds to its `completed_at` plus sixty seconds, and it
   exists only when the step ran and succeeded. A job that was skipped, waited at the gate, or
   failed before that step gives no window, so a fork's pull request, a failed build or a
   refused dispatch offers a thief nothing. A step that failed or was cancelled after it began
   writing gives no window either: its own entries are reported, so the owner reads what a
   half-made deploy did, and a thief's deploy inside that span is reported with them. An
   expected actor's entry outside every window is
   reported; a `delegated_service` entry outside every window is reported too, since nothing
   legitimate opens an upload session outside a deploy step.
3. **Shape.** Inside a window, the entries by expected actors must be exactly what that step
   makes, each kind once: a `preview` deploy, the six kinds above, five of them on
   `anandfrancis-com-preview` and the delegated one tied to the session entry before it; a
   `production` deploy, the same on `anandfrancis-com` plus the route (section 8); a
   `rollback` or `rollback-preview`, one `Create Deployment` on its Worker and no version. A
   kind missing from a window is not a finding: wrangler skips the `Upload Assets` call when no
   asset changed, so a deploy of an unchanged build leaves five entries and no delegated one.
   Anything else inside a window is reported: a second entry of a kind, a kind the step does
   not make (a `Delete Script`, a settings change on its own), a write to the other Worker, a
   token action on a resource a deploy never touches. The window alone proves nothing, since a
   stolen token looks like the real one and the preview step's windows are public on every
   pull request.

A deployment or version in the Workers' lists is judged the same way: its `source` and author
are not the key, its time and its Worker are; a deployment with no window around it, or a
second one inside a window, is reported. The two lists and the log describe the same events,
so a real deploy outside the workflows appears in both; the report names the audit-log entry
and, beside it, the deployment and the version by their own ids.

### 2.4 The report and its allow-list

- The report is Markdown, one list item per unexpected entry and never a table (a pipe inside
  a code span still splits a table row), from these fields and no others: the
  audit-log `id`; `action.time`; `action.description` when it is one of the kinds a deploy makes
  (the six above, the route, the rollback's deployment), else `resource.type` and the word
  "other"; the actor as "dashboard", "OAuth session", "global API key", "Cloudflare service",
  "other" for any context not named here (an origin CA key, a missing context), or for an
  `api_token` the word "token" and its name, treated as chosen text; the Worker's name, the
  first path segment after `/workers/scripts/` in `raw.uri` and never the URI itself, which
  carries the account id, and no Worker at all for an entry whose path has no such segment
  (the delegated upload, a dashboard change outside Workers); and for a deployment or version,
  `created_on`,
  `source`, the first eight characters of the deployment id and of the version id, and the
  version's message annotation, the one deployer-chosen string a version carries.
- Never printed, from any source: `actor.email`, `actor.id`, `actor.ip_address`, anything under
  `account`, `raw.uri`, `raw.user_agent`, `raw.cf_ray_id`, anything under `resource.request` or
  `resource.response` (they carry request bodies and the author's email), `author_email`,
  `author_id`. The library's formatter takes the allow-listed fields by name and has no path to
  the rest; a test feeds it an entry carrying every forbidden field and asserts none appears.
- Every string that came from outside (a token name, a Worker name, a message) passes through
  one function before it is printed: characters in the Unicode categories Cc and Cf, backticks,
  pipes and newlines stripped, the length capped at 120, a string emptied by that replaced by
  the word `empty`, the result wrapped in a code span. So a thief cannot put a link, Markdown
  or a bidirectional override into the owner's notification. The same formatter produces the
  job's stdout, so the public run log shows no field the issue would not.
- Eight characters of a version id are, for the preview Worker, that version's preview URL on
  the account's `workers.dev` subdomain, which is public and marked noindex already; the
  production Worker has no such URL. Accepted.
- The issue body is capped at forty lines, so an hour of noise, a thief's or the owner's,
  cannot push it past GitHub's limits: `anandfrancis-com` lines before `anandfrancis-com-preview`
  lines, deployments and versions before audit-log entries, each group in time order, then one
  line with the count of the rest and the run's URL. The job's artifact and its summary carry
  the whole report, and the count line says so, so no line is lost to the cap. The report
  reaches `gh` through `--body-file`, never as an argument.

### 2.5 State, once and only once

- The issue is the state. Before reporting, the script reads the newest issue titled as in
  3.3, open or closed, that the workflow's own account opened (`app/github-actions`, the
  author filter `watch.yml` already uses), and drops every audit-log id, deployment id and
  version id the workflow wrote in that body and in that account's own comments, read from the
  fixed places the report's layout gives them, never by pattern over the chosen text beside
  them, and matched on the eight characters the report carries. The overlap in 2.2 never
  doubles a report, and a finding stays named once whether the owner has closed the issue or
  not. Nobody else's comment counts: the issue is public, and a stranger's comment naming an
  id must not hide a finding.
- With no such issue, nothing is dropped; the first report is complete.
- Nothing the job writes is read back as state: the previous run's `started_at` in 2.2 comes
  from GitHub, and the ids come from the report the workflow's own account posted.

## 3. The watch workflow (`.github/workflows/watch.yml`)

### 3.1 Schedule

- Two crons: the existing Monday 09:00 UTC, and `17 * * * *`, every hour at seventeen past,
  off the top of the hour where GitHub delays and drops scheduled runs. The `checks` and
  `smoke` jobs run on the Monday cron and on dispatch, as now; the new job runs on both crons
  and on dispatch. `run-name` says which: "credential use, hourly", or the existing names.
- This supersedes spec 002 section 3.3's "weekly" for the workflow as a whole; the three
  existing checks keep their weekly cadence. Recorded in plan 002 as PR #23's change was, and
  corrected in place as PR #23 did: 3.3's "a weekly schedule" gains the hourly cron beside it,
  and its "a third job, after both" reads "after all three" once the report job needs three.
- Concurrency stays one run at a time, queued; an hourly run beside the Monday run waits.
- Actions minutes: about a minute an hour, free on a public repository. A report an hour late
  costs, at worst, an hour of a wrong deploy on a static site with no user data, the figure the
  intent weighed against automatic revocation; a day late would cost a day of it.

### 3.2 The new job

- Name `credential use`; `runs-on: ubuntu-latest`; `timeout-minutes: 5`; `permissions`
  `contents: read`, `actions: read` (the runs, jobs and steps), `issues: read` (the finding
  issue, 2.5); checkout with `persist-credentials: false`; Node from `.node-version`; no
  install; `node scripts/check-credential-use.mjs` with the environment of 2.1, the two
  Cloudflare values in that step's `env` and never the job's; the report written to a file and
  uploaded as the job's artifact with `retention-days: 1` for the report job, and echoed to the
  log through the same allow-listed formatter.
- It carries `CLOUDFLARE_WATCH_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` only; the deploy tokens never
  enter it. The `checks` job keeps `CLOUDFLARE_API_TOKEN`, the preview token, because
  `GET /user/tokens/verify` answers for the token that calls it and the expiry check is asking
  about that token; so spec 002 section 3.3's sentence that the expiry check runs "with the
  repository token" stays true, and the record in plan 002 is an "Added" one, for the new job.

### 3.3 The report job

- `needs` all three jobs, `if: ${{ !cancelled() }}`, `permissions: issues: write`, as now.
- "The watch failed" keeps its meaning, a check that could not run or failed: the new job's
  result joins the line the issue names when it is `failure`, so a broken credential check is
  a chore like a broken expiry check, and a later passing run closes it. The step's test
  changes from "not `success`" to "`failure`", since on the hourly cron the weekly jobs are
  `skipped`, which is not a failure; `cancelled` stays excluded by the job's `if`.
- A finding is a different chore, and gets a different issue: "A credential was used outside
  the workflows". The report job opens it with the report as the body when none is open, or
  comments the new lines on the open one; it never closes it. Only the owner closes it, after
  the chore in the runbook: read the lines, roll back what should not be there through the
  `deploy` workflow, and rotate the token named if it was not him.
- The issue is public. Everything in it comes through the allow-list in 2.4 and arrives by
  `--body-file`.

## 4. The fourth credential

- A Cloudflare user API token whose resources are this account only, named "anandfrancis.com
  watch (GitHub Actions)", with `Account Settings Read` (the audit log; it also reads the
  account's membership, which is why it is held by this job alone) and `Workers Scripts Read`
  (the deployment and version lists), nothing else, expiring 3 September 2027 like the others.
  Created by the owner; the value pasted by him into the repository secret
  `CLOUDFLARE_WATCH_TOKEN`; Claude never has it.
- `.github/expiry.json` gains `cloudflareWatchExpires`. `scripts/check-expiry.mjs`, which today
  takes every key ending in `Expires` and refuses only a file with none, gains the list of the
  keys it requires (the four dates, the rehearsal date and interval) and refuses a file missing
  any, with a config test for the missing case; it is a gate-defining file the fix guard fences,
  named here so the plan changes it in the open. The new job verifies its own token's real
  expiry through `GET /user/tokens/verify` on every run and fails when it disagrees with the
  recorded date by more than a day, the rule the online expiry check applies to the preview
  token.
- The two deploy tokens do not change: four permissions for the preview one, five for the
  production one, as spec 002 section 3.1 lists them.

## 5. Records and documents

- Plan 002 gains, in the PR that changes the workflow: a "Superseded after delivery" record for
  section 3.3's weekly cadence, with the sentence that now holds; and an "Added after delivery"
  record for the new job and its token, saying that 3.3's expiry step keeps the preview token
  and why. The scorecard's C4 re-score loses "the only one it holds" and "weekly" in the same
  PR, and its note says the one-year lifetime is a decision, recorded in intent 003 and here;
  the score stays at 2.
- CLAUDE.md: the Process paragraph's folder list names `003-credential-use`, from this PR, as
  "in progress"; the plan's closing record turns that into "delivered", since nothing pins the
  word. The Commands line on the watch says hourly for credential use and weekly for the rest,
  from the workflow's PR. The drift test pins the commands and paths those lines name, not
  their wording; the session and the compliance pass keep the wording true.
- `docs/runbook.md`, "The watch": the new check, what a finding means and the chore it sets,
  the heartbeat, and the remedy for a stopped watch (section 6). REVIEW.md's pointer to "spec
  section 10" for the gates reads "the spec's quality gates", from the workflow's PR.
- Plan 002, beside the #28 to #30 records, in the PR that closes plan 003: the assessment's
  fifth finding closed as a decision, with the pointer to intent 003. Plan 003's closing record
  repeats it.

## 6. A stopped watch

- What stops it silently: GitHub disabling a public repository's schedules after sixty days
  without a commit, which its documentation says it does and does not promise to announce; a
  YAML error on `main`, which stops every schedule in the file; someone with the owner's GitHub
  login disabling the workflow from the Actions page; and the report job itself failing, which
  no issue can announce because the reporter is what stopped. Only a dropped hourly run is
  covered by 2.2.
- The sign is a heartbeat on `ci`: a second job, `watch heartbeat`, with `contents: read` and
  `actions: read`, that asks GitHub for the newest completed `watch` run and fails when it is
  older than three hours or did not succeed, with a line naming the remedy. It is not a
  required check, so it never blocks a merge; it is a red mark on every pull request until the
  watch runs and passes again, which is the size of sign one owner needs, and a failing Monday
  watch marks pull requests the same way until the next hourly run passes. Its judgement is
  pure in `scripts/lib/heartbeat.mjs` and tested with injected times. `ci.yml` is a file the
  fix guard fences, named here so the plan changes it in the open.
- The remedy, in the runbook: `gh workflow enable watch.yml`, then `gh workflow run watch.yml`;
  for a failing report job, the run's log; for a YAML error, which produces no run at all, the
  workflow's page in Actions and the push's annotations. A push does not re-enable a disabled
  workflow; the runbook says so.
- A check that cannot run is never silent while the reporter runs: exit 1 fails the job and
  "The watch failed" opens.

## 7. Quality gates

The acceptance checks before this change is closed:

1. `pnpm verify` green locally and in CI; `tests/config/credential-use.test.mjs` covers, with
   fixtures shaped like the real entries: an expected token inside its step's window
   (nothing); the same outside every window (reported); an unknown `api_token` name, a `dash`
   actor and an `oauth` actor inside a window (reported); a `delegated_service` entry inside
   (nothing) and outside (reported); a second deployment inside a window, a `Delete Script`
   inside a window, and a preview step's token touching the production Worker (reported); a
   rollback step's deployment with no version (nothing); a run whose deploy step did not run
   (no window, its entries reported); the overlap and a closed issue's ids (reported once);
   the token fields in both shapes; the cap at forty lines with the count line; and the
   allow-list, an entry carrying every forbidden field and a version message holding a link, a
   backtick and a bidirectional override, the report holding none of it and the message as
   text.
2. `tests/config/expiry.test.mjs` fails a file missing any required key, and the heartbeat's
   library is tested with a fresh run, a stale run and a failed run.
3. The watch dispatched once with the new job and green, reporting nothing, the run named in
   the plan, taken at least 75 minutes after the workflow PR merges, since the first run reads
   back over deploys made before the steps had names; the heartbeat seen green on the next
   pull request; and one hourly run seen leaving "The watch failed" closed with the weekly
   jobs skipped.
4. The rehearsal of section 8 done once and recorded.
5. `.github/expiry.json` carries the watch token's date; the job's own verification of the
   token's expiry seen green in the dispatched run.
6. The records of section 5 written; the drift test green over CLAUDE.md and the runbook.
7. `dist/` untouched: the build is not changed, proven by the verifier on each PR.

## 8. The rehearsal

- The owner, from his machine, with his own wrangler login, deploys the current `main` to the
  preview Worker outside any workflow run: `pnpm run deploy:preview`. Within one interval the
  issue "A credential was used outside the workflows" opens, naming an `oauth` actor for the
  entries (five, or four when no asset changed and the delegated upload was skipped), a
  Cloudflare service for the upload if it happened, the version and the deployment on
  `anandfrancis-com-preview` with their ids and the message, the times, and nothing else: no
  email, no IP, no account id, checked by reading the issue.
- The owner then dispatches `rollback-preview`, a workflow run whose step the next interval
  judges expected; the issue gains no line. He closes it with a comment naming this rehearsal,
  whenever he likes: 2.5 reads a closed issue too, so an early close cannot reopen it.
- The production release's shape (section 2.3) is read from the first real release's entries
  and written into the plan; until then the production step's shape in the library is the
  preview's plus the route, and a mismatch on that release is a finding the owner reads and
  the library learns from, in the same PR.

## 9. Technical decisions for the plan stage

- `fetch` from Node 22, no dependency; the audit log paged by `cursor` until `since` is passed;
  the GitHub runs read through `GITHUB_TOKEN` a page at a time until one predates `since`, then
  each run's jobs with `filter=all`, then each job's steps, since only the steps carry the
  deploy's own span; the watch's own previous job the same way, for the anchor of 2.2.
- The library reads a token's name from `actor.token.name` or `actor.token_name`, whichever is
  present, and the same for the id it never prints.
- The formatter escapes by construction: it is given strings by field name, and every string
  from outside passes through the one function of 2.4 before it is printed.
- The report file is the job's artifact and the report job downloads it; the job's summary
  carries the whole report too, so a finding is readable from the run page, and the issue body
  is the capped view of 2.4.
- Fixtures are the real entries of 5 September 2026 with the forbidden fields replaced by
  placeholders, so the tests exercise the real shape, nested and flat.
- The interval is hourly at seventeen past; the span 75 minutes or back to the previous
  successful run; the window padding sixty seconds; the cap forty lines. The plan records the
  first fortnight's count of hourly runs and findings, so a later intent can judge the interval
  on evidence.
- The `deploy` workflow's deploy and rollback steps gain names (`deploy`, `roll back`), the one
  change to that file, so the watch finds them by name and not by their command line.

## 10. Areas of concern for the product owner

Each with a recommendation. They are the owner's to accept one at a time; the status line
records his answers on acceptance, as spec 002's does.

1. **The token names are the key.** A thief with a deploy token acts under its name and is
   caught by window and shape, not by name; a thief with the owner's login could mint a token
   of the same name, and would then be caught only by window and shape too. Recommended: accept;
   the ids would add nothing against a login thief, and the login is the bigger loss anyway.
2. **The owner's own actions are findings.** A deliberate dashboard change opens the issue.
   Recommended: accept, as the intent says; the chore is one comment and a close.
3. **Hourly runs fill the Actions list.** Twenty-four rows a day under `watch`. Recommended:
   accept; the `run-name` tells them apart, and `pnpm measure` reads pull requests, not runs.
4. **Cloudflare's log is the source.** An outage of the audit-log API fails the job and opens
   "The watch failed"; a gap in Cloudflare's own logging would be invisible. Recommended: accept;
   the deployments list is the second source for the thing that matters most, a deploy.
5. **The first production release after this change may mismatch the assumed shape** and open
   the finding issue once. Recommended: accept, as section 8 says; the library learns the real
   shape from it.
6. **A fourth secret to rotate** on the same day as the others. Recommended: accept; the
   expiry check already carries the date, and the four rotate together in September 2027.
7. **The heartbeat is a red mark, not a gate.** A stopped watch shows as a failed check on
   every pull request until it runs and passes again, and so does a failing Monday watch (an
   expiry, an advisory, a smoke failure) until the next hourly run passes; nothing else.
   Recommended: accept; a required check would block unrelated merges on a Cloudflare outage,
   which costs more than a mark.

## 11. Traceability

- Intent outcome 1 (unexpected use is a chore): sections 2 and 3.3.
- Outcome 2 (the report is safe to print): section 2.4, gate 1's allow-list case, section 8.
- Outcome 3 (the interval): sections 3.1 and 9, with the cost of a late report in 3.1.
- Outcome 4 (the tokens): section 4.
- Outcome 5 (the lifetime decision recorded): section 5.
- Outcome 6 (exercised once): section 8, gates 3 and 4.
- Outcome 7 (a stopped watch is noticed): section 6, gate 2.
- The intent's open questions: the first, in three parts, in the preamble; the second (the
  shape inside a window) in 2.3 and 8; the third (the interval) in 3.1 and 9.
- The intent's constraints: credential values the owner's, in the preamble and 4; reads and
  reports only, in 2.1, 4 and 6; no paid plan or feature, in 3.1 and 4; no model step, in 2.1
  and 6; GitHub's notifications only, in 3.3 and 6; the promise sized to what the log holds,
  in the preamble and 2.3.
- Beyond the intent's list of affected files, as details under its outcomes: `ci.yml` and
  `scripts/lib/heartbeat.mjs` (6, outcome 7); `scripts/check-expiry.mjs` (4, outcome 4);
  `deploy.yml`'s step names (9, outcome 1). One departure from the intent's letter: outcome 4
  says the watch's move off the preview token supersedes a spec 002 sentence, and it does not,
  since the sentence is 3.3's expiry step, which keeps that token; the record is an "Added"
  one (5), and the plan's closing record carries this reading to the intent's status line.
