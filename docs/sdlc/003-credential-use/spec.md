# Spec: know when a credential is used outside the workflows

Status: draft, written on 5 September 2026 for the owner's acceptance.
Derived from: `intent.md` (accepted 5 September 2026, PR #34).
Constraints applied: the `web-quality` skill's rules on deploy configuration and pinned actions
apply to the workflow change; the `acme-design-system` and `portfolio-voice` skills constrain
nothing here, since no page, copy or style changes. Companion documents: spec 002, whose
sections 3.1 and 3.3 this change supersedes in part, and `docs/runbook.md`, "The watch".

The intent left three questions for one real call. The call was made on 5 September 2026
through the owner's Cloudflare session, read-only, against the account's audit log (version 2)
and both Workers' deployment and version lists, and it settled all three:

- Reads are not logged. Sixty entries covered two days in which the deploy workflow ran nine
  times and many reads were made beside them; every entry was a `POST` or a `PATCH`. Cloudflare's
  documentation says the same: `GET` requests and `4xx` responses are not logged, and selective
  logging of sensitive reads is planned, not present. So the watch's own reads leave nothing, and
  neither does a thief who only reads or only probes.
- An entry names the token. Every action the deploy workflow made carries `actor.context`
  `api_token`, `actor.token.id` and `actor.token.name`; a dashboard action carries `dash`, an
  OAuth action `oauth`. One kind of entry has no actor identity at all: `actor.type`
  `delegated_service`, Cloudflare's own asset-upload service acting for a session the token
  opened, one entry per deploy.
- The preview deploy token already reaches the log. Reading the log needs `Account Settings
  Read` or `Write`, and spec 002 section 3.1 records that permission on both deploy tokens.
  This changes nothing in the intent's decision: the token that runs every hour on a runner is
  still one that cannot deploy.

The call also showed the shape of a deploy: a preview run leaves six entries inside its run's
window, in order `Create Assets Upload Session`, `Upload Assets` (the delegated service),
`Upload Version`, `Create Deployment`, `Patch Script Settings` and `Post Worker subdomain`, all
on `anandfrancis-com-preview`, plus one version and one deployment in that Worker's lists;
nine runs, the same six every time. The production release's shape is confirmed by the
rehearsal in section 8 and recorded in the plan.

## 1. What this change delivers

1. A check script that reads what Cloudflare recorded since the last interval and what the
   `deploy` workflow was doing at the time, judges every entry (actor first, then window, then
   shape) and prints a report of the unexpected from an allow-list of fields (section 2).
2. The `watch` workflow runs every hour for that check and keeps its weekly cadence for the
   three checks it has; a fourth job carries the new check, and the report job opens a distinct
   issue for a finding, which only the owner closes (section 3).
3. A fourth Cloudflare credential, read-only, held by the watch alone, with its expiry recorded
   and verified like the others (section 4).
4. The records this change owes: two spec 002 sentences superseded and recorded in plan 002,
   CLAUDE.md's folder list and watch line, the runbook, the scorecard's C4 note, and the
   assessment's fifth finding closed as a decision (section 5).
5. A rehearsal that proves the report opens on a real deploy from outside the workflows and
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
  runs and their jobs from GitHub's API for the same span, through the job's own `GITHUB_TOKEN`
  with `actions: read`.
- Environment: `CLOUDFLARE_WATCH_TOKEN` (section 4), `CLOUDFLARE_ACCOUNT_ID`, `GITHUB_TOKEN`,
  `GITHUB_REPOSITORY`. Nothing else; no wrangler, no install, like the expiry check.
- Exit codes: 0 when the check ran, whether or not it found anything, its report on stdout and
  in a file the report job reads; 1 when it could not run (an API refused, a token invalid, a
  page missing), with the reason on stderr and no report, so a broken check is a failed job and
  never a silent pass.

### 2.2 The span

- Each run reads the last 75 minutes: the hourly interval plus fifteen minutes of overlap, so
  an entry Cloudflare writes late, or a run that straddles the hour, is never missed. The
  overlap means an entry can be read twice; section 2.5 keeps it from being reported twice.
- The same span is asked of GitHub, widened by the longest job timeout (twenty minutes) on the
  early side, so a run that began before the span and ended inside it is known.

### 2.3 The judgement, in order

An entry is one audit-log record, one deployment or one version. The two lists are read as
well as the log because a deployment is the thing that changes what a visitor gets, and the
lists carry the version id the report needs.

1. **Actor.** The expected actors are the two deploy tokens, matched on `actor.context`
   `api_token` and `actor.token.name` equal to one of the two names spec 002 section 3.1
   records ("anandfrancis.com preview deploy (GitHub Actions)" and "anandfrancis.com production
   deploy (GitHub Actions)"), and `actor.type` `delegated_service`, Cloudflare's own service
   acting inside a deploy. Any other actor is reported, whatever the time: a dashboard action,
   an OAuth session, a global API key, an `api_token` with any other name. The names are the
   key rather than the ids because they are public already and a deploy token cannot mint a
   token of any name (that needs a user-level permission the deploy tokens lack); the ids are
   printed nowhere.
2. **Window.** A run's window is from its `created_at` less sixty seconds to its `updated_at`
   plus sixty seconds. An expected actor's entry outside every window is reported. A
   `delegated_service` entry outside every window is reported too, since nothing legitimate
   opens an upload session outside a run.
3. **Shape.** Inside a window, the entries by expected actors must fit the job that ran, read
   from the run's job list: a `preview` job may touch `anandfrancis-com-preview` only; a
   `production` or `rollback` job `anandfrancis-com` only; a `rollback-preview` job the preview
   Worker only. Per Worker per run: at most one `Upload Version`, at most one `Create
   Deployment` (a rollback makes a deployment and no version), and no entry on any other
   resource than the six kinds a deploy makes (the upload session, the upload, the version, the
   deployment, the script settings, the subdomain) and, for production, the route. Anything
   beyond that shape is reported: a second deployment inside a run, a write to the other
   Worker, a token action on a resource a deploy never touches. The window alone proves nothing,
   since a stolen token looks like the real one and the preview job's windows are public on
   every pull request.

A deployment or version in the Workers' lists is judged the same way: its `source` and author
are not the key, its time and its Worker are; a deployment with no run window around it, or a
second one inside a window, is reported. The two lists and the log describe the same events,
so a real deploy outside the workflows appears in both; the report names it once, by the
audit-log id, with the version id beside it.

### 2.4 The report and its allow-list

- The report is Markdown, one line per unexpected entry, from these fields and no others: the
  audit-log `id`; `action.time`; `action.description`; the actor as `actor.context` and, for an
  `api_token`, `actor.token.name`, or "dashboard", "OAuth session", "global API key",
  "Cloudflare service"; `resource.type`; the Worker's name, parsed from the path after
  `/workers/scripts/` in `raw.uri` and never the URI itself, which carries the account id; and
  for a deployment or version, `created_on`, `source` and the first eight characters of the
  version id.
- Never printed, from any source: `actor.email`, `actor.id`, `actor.ip_address`, anything under
  `account`, `raw.uri`, `raw.user_agent`, `raw.cf_ray_id`, anything under `resource.request` or
  `resource.response` (they carry request bodies and the author's email), `author_email`,
  `author_id`. The library's formatter takes the allow-listed fields by name and has no path to
  the rest; a test feeds it an entry carrying every forbidden field and asserts none appears.
- Text a deployer chose, a version's message or a Worker's name, is rendered inside a code span
  with backticks, newlines and control characters stripped, so a thief cannot put a link or
  Markdown into the owner's notification. The same formatter produces the job's stdout, so the
  public run log shows nothing the issue would not.

### 2.5 State, once and only once

- The issue is the state. Before reporting, the script reads the open issue's body and the
  comments on it that the workflow's own account wrote (`github-actions`, section 3.3) for
  audit-log ids and version ids already named, and drops those; the overlap in 2.2 never
  doubles a report, and a finding is named once however many runs see it. Nobody else's
  comment counts: the issue is public, and a stranger's comment naming an id must not hide a
  finding.
- With no open issue, nothing is dropped; the first report is complete.

## 3. The watch workflow (`.github/workflows/watch.yml`)

### 3.1 Schedule

- Two crons: the existing Monday 09:00 UTC, and `0 * * * *`, every hour. The `checks` and
  `smoke` jobs run on the Monday cron and on dispatch, as now; the new job runs on both crons
  and on dispatch. `run-name` says which: "credential use, hourly", or the existing names.
- This supersedes spec 002 section 3.3's "weekly" for the workflow as a whole; the three
  existing checks keep their weekly cadence. Recorded in plan 002 as PR #23's change was.
- Concurrency stays one run at a time, queued; an hourly run beside the Monday run waits.
- Actions minutes: about a minute an hour, free on a public repository. The sixty-day rule
  still applies; section 6 says what the owner watches for.

### 3.2 The new job

- Name `credential use`; `runs-on: ubuntu-latest`; `timeout-minutes: 5`; `permissions`
  `contents: read`, `actions: read`; checkout with `persist-credentials: false`; Node from
  `.node-version`; no install; `node scripts/check-credential-use.mjs` with the environment of
  2.1; the report written to a file and uploaded as the job's artifact for the report job, and
  echoed to the log through the same allow-listed formatter.
- It carries `CLOUDFLARE_WATCH_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` only; the deploy tokens never
  enter it. The `checks` job keeps `CLOUDFLARE_API_TOKEN`, the preview token, because
  `GET /user/tokens/verify` answers for the token that calls it and the expiry check is asking
  about that token; spec 002 section 3.1's sentence that the watch runs on the preview token is
  superseded for every job but that step, and the record in plan 002 says so.

### 3.3 The report job

- `needs` all three jobs, `if: ${{ !cancelled() }}`, `permissions: issues: write`, as now.
- "The watch failed" keeps its meaning, a check that could not run or failed: the new job's
  result joins the line the issue names when it is not `success`, so a broken credential check
  is a chore like a broken expiry check, and a later passing run closes it.
- A finding is a different chore, and gets a different issue: "A credential was used outside
  the workflows". The report job opens it with the report as the body when none is open, or
  comments the new lines on the open one; it never closes it. Only the owner closes it, after
  the chore in the runbook: read the lines, roll back what should not be there through the
  `deploy` workflow, and rotate the token named if it was not him.
- The issue is public. Everything in it comes through the allow-list in 2.4.

## 4. The fourth credential

- A Cloudflare API token named "anandfrancis.com watch (GitHub Actions)", account-scoped to
  this account only, with `Account Settings Read` (the audit log) and `Workers Scripts Read`
  (the deployment and version lists), nothing else, expiring 3 September 2027 like the others.
  Created by the owner; the value pasted by him into the repository secret
  `CLOUDFLARE_WATCH_TOKEN`; Claude never has it.
- `.github/expiry.json` gains `cloudflareWatchExpires`. The offline expiry check reads it like
  the others and refuses a file without it; the new job verifies its own token's real expiry
  through `GET /user/tokens/verify` on every run and fails when it disagrees with the recorded
  date by more than a day, the rule the online expiry check applies to the preview token.
- The two deploy tokens do not change: four permissions for the preview one, five for the
  production one, as spec 002 section 3.1 lists them.

## 5. Records and documents

- Plan 002 gains two "Superseded after delivery" records, in the PR that changes the workflow:
  section 3.3's weekly cadence, and section 3.1's watch on the preview token, each with the
  sentence that now holds.
- CLAUDE.md: the Process paragraph's folder list names `003-credential-use`, from this PR; the
  Commands line on the watch says hourly for credential use and weekly for the rest, from the
  workflow's PR; the drift test keeps both true.
- `docs/runbook.md`, "The watch": the new check, what a finding means and the chore it sets,
  and the sign of a stopped watch (section 6).
- `scorecard.md`, C4: the note amended to say the one-year lifetime is a decision, recorded in
  intent 003 and here; the score stays at 2.
- Plan 002, beside the #28 to #30 records: the assessment's fifth finding closed as a decision,
  with the pointer to intent 003. Plan 003's closing record repeats it.

## 6. A stopped watch

- The sign is GitHub's own: when it disables a public repository's schedules after sixty days
  without a commit, it notifies the owner and the workflow's page carries the notice. The
  runbook names that notice, and the second sign the owner can see at a glance, the `watch`
  runs in the Actions list, one an hour. No heartbeat mechanism is added; the two notices are
  enough for one owner, and a push re-enables the schedules.
- A check that cannot run is never silent: exit 1 fails the job and "The watch failed" opens.

## 7. Quality gates

The acceptance checks before this change is closed:

1. `pnpm verify` green locally and in CI; `tests/config/credential-use.test.mjs` covers, with
   fixtures shaped like the real entries: an expected token inside its window (nothing); the
   same outside every window (reported); an unknown `api_token` name, a `dash` actor and an
   `oauth` actor inside a window (reported); a `delegated_service` entry inside (nothing) and
   outside (reported); a second deployment inside a window, and a preview run's token touching
   the production Worker (reported); a rollback run's deployment with no version (nothing);
   the overlap and the open issue's ids (reported once); and the allow-list, an entry carrying
   every forbidden field and a version message holding a link and a backtick, the report
   holding none of it and the message as text.
2. The watch dispatched once with the new job and green, reporting nothing, the run named in
   the plan.
3. The rehearsal of section 8 done once and recorded.
4. `.github/expiry.json` carries the watch token's date; `pnpm check` passes with it and fails
   without it in the config tests; the job's own verification of the token's expiry seen green
   in the dispatched run.
5. The records of section 5 written; the drift test green over CLAUDE.md and the runbook.
6. `dist/` untouched: the build is not changed, proven by the verifier on each PR.

## 8. The rehearsal

- The owner, from his machine, with his own wrangler login, deploys the current `main` to the
  preview Worker outside any workflow run: `pnpm run deploy:preview`. Within one interval the
  issue "A credential was used outside the workflows" opens, naming an `oauth` actor (wrangler's
  login), the version and deployment on `anandfrancis-com-preview`, the time, and nothing else:
  no email, no IP, no account id, checked by reading the issue.
- The owner then dispatches `rollback-preview`, a workflow run, which the next interval judges
  expected; the issue gains no line and stays open until he closes it with a comment naming
  this rehearsal.
- The production release's shape (section 2.3) is read from the next real release's entries
  and written into the plan; until then the production job's shape in the library is the
  preview's plus the route, and a mismatch on the first real release is a finding the owner
  reads and the library learns from, in the same PR.

## 9. Technical decisions for the plan stage

- `fetch` from Node 22, no dependency; the audit log paged by `cursor` until `since` is passed;
  the GitHub runs read through `GITHUB_TOKEN`, then each run's jobs, since the runs list does
  not say which job ran.
- The formatter escapes by construction: it is given strings by field name, and every string it
  prints passes through one function that strips backticks, newlines and control characters and
  wraps in a code span.
- The report file is the job's artifact and the report job downloads it; the job's summary
  carries the same text, so a finding is readable from the run page.
- Fixtures are the real entries of 5 September 2026 with the forbidden fields replaced by
  placeholders, so the tests exercise the real shape.
- The interval is hourly; the span 75 minutes; the window padding sixty seconds. The plan
  records the first fortnight's count of hourly runs and findings, so a later intent can judge
  the interval on evidence.

## 10. Areas of concern for the product owner

Each with a recommendation; accepting the spec accepts them unless he says otherwise.

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

## 11. Traceability

- Intent outcome 1 (unexpected use is a chore): sections 2 and 3.3.
- Outcome 2 (the report is safe to print): section 2.4, gate 1's allow-list case, section 8.
- Outcome 3 (the interval): section 3.1, section 9.
- Outcome 4 (the tokens): section 4.
- Outcome 5 (the lifetime decision recorded): section 5.
- Outcome 6 (exercised once): section 8, gates 2 and 3.
- Outcome 7 (a stopped watch is noticed): section 6.
- The intent's open questions: answered in the preamble; the shape question in 2.3 and 8.
