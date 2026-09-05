# Runbook

The procedures CLAUDE.md points to. CLAUDE.md holds what every session needs on day one; this
file holds what a session needs only when it is doing one of the things below. The configuration
tests (`pnpm test:config`) check that every command and path named here exists, as they do for
CLAUDE.md, so neither file can drift from the repository unnoticed.

## Fix mode

A bug-fix task runs in fix mode, so the test that proves the fix cannot be weakened by the fix.
Spec 002 section 6 defines it; `.claude/hooks/guard-tests.mjs` enforces it.

1. Pin the bug. When no test catches it yet, write the failing test and commit it on its own,
   with nothing else in that commit, and paste its failing output in the PR. The verifier checks
   out that commit and runs the test there, so the history shows it failing before the code
   changes rather than taking it on trust.
2. Create the empty marker file `.claude/FIX_TASK` (git-ignored). While it exists the guard
   refuses changes to the tests, to the files that decide what the gates check
   (`playwright.config.ts`, `stylelint.config.js`, `.htmlvalidate.json`, `lighthouserc.cjs`,
   `lighthouserc.desktop.cjs`, `tsconfig.json`, `.gitattributes`, the `check-*`, `lighthouse` and
   `postbuild` scripts, `src/config/pairings.mjs`, the workflows under `.github/workflows/`) and
   to the files that decide what the hook and the definition of done are (`package.json`,
   `.claude/settings.json`, `.claude/settings.local.json`, everything under `.claude/hooks/`,
   `REVIEW.md`, `.github/expiry.json`, the marker itself). It judges the Edit and Write tools, the
   GitHub file tools, and any shell command that writes, moves or deletes: `sed -i`, a redirect
   onto the file, `tee`, `cp`, `mv`, `rm`, `git restore`, `git apply` and `patch`, the PowerShell
   file cmdlets and the rest its header comment lists, including inside `bash -c`, `eval`,
   `find -exec` or a program passed to `node -e` or `python -c`. Reading those files stays
   allowed. Its message names what was refused and why.
3. Fix the code, not the check. The guard judges command lines, not programs: a script written
   elsewhere and then run carries its paths out of sight, so do not route an edit through one;
   the review reads the test diff either way.
4. Open the PR, then delete the marker. The guard allows the deletion only once an open,
   non-draft pull request exists for the branch, so the fix cannot weaken its own proof and fix
   mode cannot end before review can see the change.

A bug in a file the guard fences cannot be fixed under the marker at all: pin it with a test as
above, then fix it outside fix mode, in a commit of its own, and say so in the PR, so the one
edit a hook may not judge is the one a human cannot miss. That supersedes spec 002's C11, which
had such a fix stop for the owner to make by hand; the owner changed it on 4 September 2026, and
the hook's message says so.

## Releases and rollback

Only the `deploy` workflow reaches production, by dispatch on `main` through the `production`
environment, which waits for the owner's approval in GitHub. Without `RELEASE_APPROVAL`, the
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

## The watch

The `watch` workflow runs every Monday and by dispatch, `gh workflow run watch.yml`:

- `pnpm check-expiry` with `--online`: reads `.github/expiry.json` (when each credential
  expires, when the rollback was last rehearsed on production, the rehearsal interval, the
  warning window) and asks Cloudflare for the preview token's real expiry; fails within thirty
  days of an expiry or past the interval. The offline form runs inside `pnpm check` on every
  push, the safety net, since GitHub disables a public repository's schedules after sixty days
  without a commit.
- `pnpm check-advisories`: asks GitHub whether any advisory silenced in `package.json`'s
  `pnpm.auditConfig`, in either list pnpm honours, `ignoreCves` and `ignoreGhsas`, now has a
  patched version, and fails when one does, so a silence cannot outlive its reason.
- The production smoke check, `.github/actions/smoke-check/action.yml`, in a job of its own:
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
the Worker) and fix what they name. A run of the watch by hand, `gh workflow run watch.yml`,
closes the issue once the checks pass again.

## Task evals

`pnpm eval:skills` proves a skill still loads for the prompts that should load it.
`pnpm eval:tasks` proves the work that follows still holds to the skills, the hooks and CLAUDE.md:
it gives headless Claude Code three pieces of real work and grades what it did. Francis runs it
by hand before any PR that changes a file under `.claude/`, and after a model change, and pastes
the output in the PR; an agent never launches it, since it spends his subscription.

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
because it is fenced. A running eval locks its worktree, so a second run beside it, or a dry run
an agent starts, leaves it alone.

Removing a worktree is the one delicate step: git sees the link as a directory, and
`git worktree remove --force` on a tree still holding it would empty the checkout's own
`node_modules`. The runner unlinks first, on its own, then removes; it does the same for
anything an interrupted run left behind, at the start of the next run or on
`pnpm eval:tasks --clean`, which is also how a tree kept with `--keep` goes. The sweep at the
start of a run leaves a locked tree alone, since another run may own it; `--clean` takes it
too, since the person running it knows no eval is live, and a run that died mid-task leaves
its lock behind. Never remove one by hand with a recursive delete. The CLI keeps each session's
transcript in its projects folder under the home directory, keyed by the temp path; they are
small and harmless, and nothing removes them.

The tasks, defined with their graders in `scripts/lib/eval-tasks.mjs`:

- `copy`: rewrite the first paragraph under `about` in `profile.yaml` to read warmer. Passes
  when only that file changed and in it only that paragraph, the paragraph differs from
  HEAD's and still carries every fact the grader lists (the years, the employers, the date),
  and the content and voice checks pass, which is where the quote and the fixed facts elsewhere
  in the file are held.
- `tokens`: make the footer's top border one step stronger. Passes when only hand-written
  stylesheets changed, an added line uses a token, and stylelint accepts the result.
- `fix`: the parser in `scripts/lib/inline-scripts.mjs` is seeded with a bug one configuration
  test catches, and the marker is set. Passes when the parser changed, nothing the guard fences
  changed, and the test passes: the fix fixed the code, not the check.

The output names the CLI version, the model and the commit, so a run is comparable with the
last. A fail is read before it is acted on: the reasons say what the session did, and the
answer is a change to the skill, the hook or CLAUDE.md that would have prevented it, proven by
running the eval again. `--dry-run` exercises everything but the session, for free, fails every
task as it should, since no work was done, and is the one form an agent may run. The graders
themselves are tested in `tests/config/eval-tasks.test.mjs` on every `pnpm check`.

## Measures

`pnpm measure` reads what the process already leaves on GitHub and prints the playbook's
indicators for the pull requests merged in a month: whether `ci` passed on its first run on the
earliest commit that has one (the first push, its first attempt), hours from opening to the
first review and to the merge, commits after the first review, reviews by the app and by the
session, and the Important and Nit counts every review's closing lines carry, in total and per
pass. A review counts when the app posted it or a person with a standing in the repository did;
the review workflow's own notices and anyone else's reviews are left out. `--month 2026-09`
picks a month, `--all` every merged pull request, `--write` files the period under
`docs/measures/`, named for the month or `all`, and the last line is the summary. Needs `gh`,
logged in; nothing runs in CI, and the files are never edited by hand.

In the first week of each month, run `pnpm measure --month <the month before> --write` and
commit the file as a maintenance PR whose description says what moved. Read it for two things:
which checks earn their keep (a first-attempt `ci` that rarely fails after a check was added
says the check moved the failure earlier, where it costs less) and which review steps cost more
than they find (the per-pass column shows a pass that reports nothing month after month; whether
Important findings repeat is read from the reviews themselves, which the file does not carry).
The project is young, so the first summaries are a baseline, not a trend. The arithmetic is
tested in `tests/config/measures.test.mjs`; the numbers are as good as the record: a pull request
pushed several commits at once shows the first push's `ci`, and a review's findings are counted
every time a review is posted, so a pull request the workflow reviewed three times carries three
counts.
