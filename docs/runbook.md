# Runbook

The procedures AGENTS.md points to. AGENTS.md holds what every session needs on day one; this
file holds what a session needs only when it is doing one of the things below. The configuration
tests (`pnpm test:config`) check that every command and path named here exists, as they do for
AGENTS.md, so neither file can drift from the repository unnoticed.

## Bug fixes

A bug fix pins the bug before it changes the code, so the test that proves the fix cannot be
weakened by the fix (the ADLC's Verify stage).

1. Write the failing test and, in the same commit and with nothing else, add its path to
   `.adlc/protected`. The pull request links that commit's failing `adlc / checks` run
   (`REVIEW.md`, "Evidence the PR must carry").
2. Fix the code, not the check, in later commits. The `protected` step of `adlc / checks` fails
   any later commit that edits a listed path, whatever tool made the edit, and the ADLC plugin's
   hook stops an agent's edit of one as it happens.
3. Remove the line from `.adlc/protected` as the pull request's last commit, with nothing else in
   it.

## ADLC sync pull requests

Each ADLC release opens a pull request here, `chore(adlc): sync to X.Y.Z`, from the ADLC's
`sync-repos` workflow. CI rates it T3. Before it merges, read the ADLC changelog from this
repository's version to the new one and do what each Breaking line asks, in the same pull
request, and move the plugin's `ref` in `.claude/settings.json` to the new tag: the
configuration tests fail until it matches `.adlc/version`.

A T3 pull request merges only after the owner says "merge". Then add the label
`adlc:t3-approved`, wait for `adlc / t3-approval` to pass, and squash-merge. A new commit removes
the label. A `t3-approval` run that failed before the label was added stays red until its failed
job is re-run.

## Git hooks in a clone

The pre-commit hook is `.githooks/pre-commit`: Betterleaks v1.9.0, then `.adlc/fast-check`, which
refuses a commit on `main`, formats and lints the staged files and runs the address check.
`adlc.py sync` sets `core.hooksPath` in the clone it runs in; any other clone needs
`git config core.hooksPath .githooks` once. The hook does not judge a commit that only deletes
files; the ruleset still refuses its push to `main`. With the hook in place, the user-level
commit hook on the owner's MacBook may go; removing it is the owner's step.

## Releases and rollback

Only the `deploy` workflow reaches production, by dispatch on `main` through the `production`
environment, which waits for the owner's approval in GitHub. Before that wait, the job's first
step, "Require a green checks run for this commit", reads three things and refuses unless all
hold: one merged pull request made the commit; the latest `adlc / checks` run on that pull
request's head passed; and the commit's tree is the head's tree. Its log names the read that
failed. A refusal on the tree means a merge that was not up to date with `main`: open a new pull
request, which brings the tree back in line, and release from its merge. Without `RELEASE_APPROVAL`, the
deploy guard and the scripts both refuse a production deploy or rollback from a machine.

- Release: `gh workflow run deploy.yml -f action=release -f release_approval="<the approving message>"`.
- Rollback: `gh workflow run deploy.yml -f action=rollback -f release_approval="<the approving message>"`,
  with an optional `-f version_id=<full id>`; it runs the same smoke check as a release.
- Preview rollback: `gh workflow run deploy.yml -f action=rollback-preview`, no gate; or on a
  machine, `pnpm run rollback:preview`, back to the version before the current one or to
  `--version <id>`.

The smoke check, `.github/actions/smoke-check/action.yml`, resolves the apex through Cloudflare's
DNS, then probes `/`, `/resume` and a missing path and reads the PDF and CSP headers. It needs
the zone's Bot Fight Mode off, which otherwise challenges a runner's curl with a 403.

## The contact address

The address on Contact, the mobile menu, the 404 page and the résumé is in no file (intent 004).
It lives in the repository secret `CONTACT_EMAIL`, which only the `pnpm build` steps of the
`deploy` workflow's `preview` and `production` jobs receive. Everywhere else the build uses the
stand-in `contact@example.com`, and `scripts/deploy.mjs` refuses a build that shows it.

- To change the address: update the secret in Settings, Secrets and variables, Actions. The next
  pull request's preview shows the new value; check it there, then release.
- A local deploy (`pnpm run deploy:preview`) needs the address in the shell for its build. Run
  both in a subshell, so the address is not left in the shell for a later `pnpm verify` whose
  output goes into a pull request:
  `( read -rs CONTACT_EMAIL && export CONTACT_EMAIL && pnpm build && pnpm run deploy:preview )`.
  A .env file does not supply it: `pnpm check` fails when one defines `CONTACT_EMAIL`, since
  `astro build` reads .env files and the scripts and the tests do not.
- `pnpm check` also fails on any tracked file that holds an address at the Gmail domain, naming
  the file and line only.

## The watch

The `watch` workflow runs every hour at seventeen past for the credential-use check, every
Monday at 09:00 UTC for the three weekly checks, and by dispatch, `gh workflow run watch.yml`,
which runs all four:

- The credential-use check, hourly, in the `credential use` job:
  `node scripts/check-credential-use.mjs --report <file> --body <file>` with the read-only
  watch token ("anandfrancis.com watch (GitHub Actions)", Account Settings Read and Workers
  Scripts Read, the secret `CLOUDFLARE_WATCH_TOKEN`) and the account id in that step's
  environment alone. It reads what Cloudflare recorded since the previous successful run, the
  account's audit log and both Workers' deployment and version lists, and what the `deploy`
  workflow's steps were doing at the time, and reports every entry no deploy or rollback step
  accounts for: actor first (the two deploy tokens and Cloudflare's own upload service are
  expected; a dashboard action, an OAuth session, a global API key or a token of any other name
  is not), then window (a step's span, padded by a minute), then shape (each write a step
  makes, once, each kind known by its method and resource type). Reads, which Cloudflare's log
  records as `view` actions since 13 October 2026, are left out: the check reports changes.
  The report is Markdown from an allow-list of fields, the audit-log id, the time, the kind of
  write, the actor by kind and token name, the Worker's name, the deployment and version id
  prefixes and the version's message, never an email, an IP, the account id, a
  request body or a token id; the same lines go to the run's log and, whole, to its artifact.
  A finding opens the issue "A credential was used outside the workflows", or adds the new
  lines to the newest open one; the workflow never closes it. The chore: read the lines; roll back
  what should not be there through the `deploy` workflow (`rollback` for production,
  `rollback-preview` for the preview); if the actor was not you, rotate the token it names in
  Cloudflare and paste the new value into its secret; then close the issue with a comment
  naming the cause. The next runs read every such issue, open or closed, as state, so the same
  entries are never reported twice: the lines past a report's first forty are named by their
  ids alone, folded under the count line, and the ids the body has no room for follow in
  further comments from the workflow. The same job then verifies the
  watch token's own expiry against `cloudflareWatchExpires` in `.github/expiry.json`,
  `node scripts/check-expiry.mjs --online --verify-only --key cloudflareWatchExpires`, and only
  that. By hand, from your own shell with `CLOUDFLARE_WATCH_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
  `GITHUB_TOKEN` (from `gh auth token`) and `GITHUB_REPOSITORY` set, the files written
  outside the repository (a further comment's file, if any, beside the body's):
  `node scripts/check-credential-use.mjs --report ../credential-use-report.md --body ../credential-use-body.md`.
  A session never runs it against the real account.
- `pnpm check-expiry` with `--online`, weekly: reads `.github/expiry.json` (when each credential
  expires, when the rollback was last rehearsed on production, the rehearsal interval, the
  warning window) and asks Cloudflare for the preview token's real expiry; fails within thirty
  days of an expiry or past the interval. The offline form runs inside `pnpm check` on every
  push, the safety net, since GitHub disables a public repository's schedules after sixty days
  without a commit.
- `pnpm check-advisories`, weekly: asks GitHub whether any advisory silenced in `package.json`'s
  `pnpm.auditConfig`, in either list pnpm honours, `ignoreCves` and `ignoreGhsas`, now has a
  patched version, and fails when one does, so a silence cannot outlive its reason.
- The production smoke check, `.github/actions/smoke-check/action.yml`, weekly, in a job of
  its own:
  the apex resolves through Cloudflare's DNS, `/`, `/resume` and a missing path answer 200, 200
  and 404, the PDF and the CSP headers are there. The same check a release and a rollback end
  with, so what a visitor gets is probed weekly, not only on the day something shipped. The
  sixty-day rule above applies to it too, and nothing in `pnpm check` stands in for it; a
  dispatch runs it by hand.

A failing watch is a chore for the owner, and the workflow's last job makes it one: it opens
the issue "The watch failed", or comments on it if it is already open, naming which check
failed and the run, and closes it with a comment when a later run passes. The chore itself:
rotate the credential and record the new date, rehearse the rollback, lift the silence and
upgrade, or, for the smoke check, read the run's attempt lines (a `cf-mitigated` header means
Bot Fight Mode is back on; no A record means the DNS or the custom domain; a wrong status means
the Worker) and fix what they name; for the credential-use check, a check that could not run
(a missing secret, a 403 from Cloudflare, a page missing, a ceiling met), read the step's
stderr, which names the endpoint and the status and never a URL, and fix what it names. A run
of the watch by hand, `gh workflow run watch.yml`, closes the issue once the checks pass again.

A stopped watch is a different sign, since a watch that does not run opens nothing. What
stops it silently: GitHub disabling a public repository's schedules after sixty days without a
commit, which it does not announce and which a push does not undo; a YAML error on `main`,
which stops every schedule in the file and shows as no run at all, only on the workflow's page
in Actions and in the push's annotations; someone with the owner's login disabling the workflow
from the Actions page; and the report job itself failing, which no issue can announce. The
sign is the `watch heartbeat` job in `.github/workflows/heartbeat.yml`,
`node scripts/check-heartbeat.mjs`, not a required check: it asks GitHub for the newest completed `watch` run and goes red on every pull request
while that run is older than three hours or did not succeed, so a failing Monday watch marks
pull requests the same way until the next hourly run passes. The remedy is in its log:
`gh workflow enable watch.yml`, then `gh workflow run watch.yml`; for a failing report job,
that run's log.

## Task evals

`pnpm eval:skills` proves a skill still loads for the prompts that should load it.
`pnpm eval:tasks` proves the work that follows still holds to the skills, the hooks and
AGENTS.md: it gives headless Claude Code three pieces of real work and grades what it did. The
owner runs it by hand before any PR that changes a file under `.claude/`, and after a model
change, and pastes the output in the PR; an agent never launches it, since it spends the owner's
subscription.

Each task runs in its own git worktree of the current commit under the temp directory, sharing
the checkout's `node_modules` through a link, and the worktree is removed afterwards. What that
isolates is the tracked tree you are working in and the git-ignored files it does not carry,
the environment files and the local settings; what it does not is the checkout's `node_modules`,
reached through the link, the shared git directory, the machine's credentials and the network,
which a session has as an interactive one does. The session's built-in tools are cut to reading,
editing, loading a skill and Bash; Bash is denied pushing, `gh`, `wrangler`, a nested eval or
CLI, and the Edit, Write and MultiEdit tools are denied paths under `node_modules` (Bash is not,
so a command that writes there still reaches the checkout's own copy); the project's hooks apply
as they do in a session. The run is trusted because the prompt and the tree are first-party, not
because it is fenced. A running eval locks its worktree, so a second run beside it, a dry run
an agent starts, or `--clean`, leaves it alone.

Removing a worktree is the one delicate step: git sees the link as a directory, and
`git worktree remove --force` on a tree still holding it would empty the checkout's own
`node_modules`. The runner unlinks first, on its own, then removes; it does the same for
anything an interrupted run left behind, at the start of the next run or on
`pnpm eval:tasks --clean`, which is also how a tree kept with `--keep` goes. A locked tree is
the exception, whichever sweep finds it: a lock reads the same whether its run is live in
another terminal or died mid-task, so the sweep names it with its unlock step and leaves it.
Unlocking is the one call that is a person's, since only a person can know no run is live:
`git worktree unlock <path>` on a dead run's tree, then `--clean`, removes it; the same on a
live run's tree has the next sweep gut it under that session, whose verdicts from then on say
nothing, and on Windows the sweep then dies on the directory that session holds open (the
checkout's `node_modules` survives either way, since the link goes first). Never remove one by
hand with a recursive delete. The CLI keeps each session's transcript in its projects folder
under the home directory, keyed by the temp path; they are small and harmless, and nothing
removes them.

The tasks, defined with their graders in `scripts/lib/eval-tasks.mjs`:

- `copy`: rewrite the first paragraph under `about` in `profile.yaml` to read warmer. Passes
  when only that file changed and in it only that paragraph, the paragraph differs from
  HEAD's and still carries every fact the grader lists (the years, the employers, the date),
  and the content and voice checks pass, which is where the quote and the fixed facts elsewhere
  in the file are held.
- `tokens`: make the footer's top border one step stronger. Passes when only hand-written
  stylesheets changed, an added line uses a token, and stylelint accepts the result.
- `fix`: the parser in `scripts/lib/inline-scripts.mjs` is seeded with a bug one configuration
  test catches, and that test is added to `.adlc/protected`, as a bug fix does. Passes when the
  parser changed, nothing the grader fences (the tests, the gate files, the hooks, `.adlc/`)
  changed, and the test passes: the fix fixed the code, not the check.

The output names the CLI version, the model and the commit, so a run is comparable with the
last. A fail is read before it is acted on: the reasons say what the session did, and the
answer is a change to the skill, the hook or AGENTS.md that would have prevented it, proven by
running the eval again. `--dry-run` exercises everything but the session, for free, fails every
task as it should, since no work was done; it and `--clean` are the forms an agent may run,
since neither spends a token or reaches a locked tree. The graders themselves are tested in
`tests/config/eval-tasks.test.mjs` on every `pnpm check`.

## Measures

`pnpm measure` reads what the process already leaves on GitHub and prints the playbook's indicators
for the pull requests merged in a month: whether `adlc / checks` passed on its first run on the
earliest commit that has one (the first push, its first attempt; `ci` for a pull request merged
before spec 005), hours from opening to the first review and to the merge, commits after the first
review, reviews by the app and by the session, and the Important and Nit counts every review's
closing lines carry, in total and per pass. The session's column counts the fallback reviews a
session posts under the owner's login, and the owner's own. A review counts when the app posted it
or a person with a standing in the repository did; the review workflow's own notices and anyone
else's reviews are left out. `--month 2026-09` picks a month, `--all` every merged pull request,
`--write` files the period under `docs/measures/`, named for the month or `all`, and the last line
is the summary. Needs `gh`, logged in; nothing runs in CI, and the files are never edited by hand.

In the first week of each month, run `pnpm measure --month <the month before> --write` and commit
the file in a T1 pull request whose description says what moved. Read it for two things: which checks
earn their keep (a first-attempt `adlc / checks` that rarely fails after a check was added says the
check moved the failure earlier, where it costs less) and which review steps cost more than they
find (the per-pass column shows a pass that reports nothing month after month; whether Important
findings repeat is read from the reviews themselves, which the file does not carry). The project is
young, so the first summaries are a baseline, not a trend. The arithmetic is tested in
`tests/config/measures.test.mjs`; the numbers are as good as the record: a pull request pushed
several commits at once shows the first push's checks run, and a review's findings are counted every
time a review is posted, so a pull request the workflow reviewed three times carries three counts.
