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
   `.claude/settings.json`, everything under `.claude/hooks/`, `REVIEW.md`, `.github/expiry.json`,
   the marker itself). It judges the Edit and Write tools, the GitHub file tools, and any shell
   command that writes, moves or deletes: `sed -i`, a redirect onto the file, `tee`, `cp`, `mv`,
   `rm`, `git restore`, the PowerShell file cmdlets, including inside `bash -c`, `eval`,
   `find -exec` or a program passed to `node -e` or `python -c`. Reading those files stays
   allowed. Its message names what was refused and why.
3. Fix the code, not the check. The guard judges command lines, not programs: a script written
   elsewhere and then run, or a patch file applied, carries its paths out of sight, so do not
   route an edit through one; the review reads the test diff either way.
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
environment, which waits for the owner's approval in GitHub. The deploy guard refuses a
production deploy or rollback from a machine, and so do the scripts without `RELEASE_APPROVAL`.

- Release: `gh workflow run deploy.yml -f action=release -f release_approval="<the approving message>"`.
- Rollback: `gh workflow run deploy.yml -f action=rollback`, with an optional
  `-f version_id=<full id>`; it runs the same smoke check as a release.
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

A failing watch is a chore for the owner: rotate the credential and record the new date,
rehearse the rollback, or lift the silence and upgrade.
