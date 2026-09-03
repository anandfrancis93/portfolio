# Plan: close the playbook gaps (from spec.md, 3 September 2026)

Status: accepted by the engineer and product owner on 3 September 2026, before any code was
written.
Derived from `spec.md` (accepted 3 September 2026, PR #11) under the three skills. Departures
during implementation are written back into this file in the same PR.

## Context

Stage 3 of the AI-native SDLC for the second intent. The intent (PR #10) and the spec (PR #11)
are accepted. The hands-on prerequisites are already done and are not repeated here: the two
scoped Cloudflare tokens, the GitHub `production` environment with the product owner as required
reviewer, the Claude GitHub App on the account, and the `CLAUDE_CODE_OAUTH_TOKEN` secret. The old
Cloudflare token still exists and is deleted in phase F.

Verified on 3 September 2026: Node 22.21 runs `node --test <dir>` and finds `*.test.mjs` under it;
`wrangler rollback` takes `--message`, which skips its prompts; the Claude Code action takes
`claude_code_oauth_token`, a `prompt` and `claude_args`, and by default fires only for commenters
with write access; a GitHub `issue_comment` workflow runs from the default branch, while a
`pull_request` workflow runs from the head branch; environment protection rules apply to any job
that names the environment, whatever the trigger; the Cloudflare verify endpoint returns
`expires_on`.

## Decisions taken in this plan (the spec is not reopened)

- The hook tests land in two steps: phase B tests the hooks as they are today, phase C adds the
  rows the spec marks "(new)" in the same PR as the hooks that make them pass. A test file never
  merges red.
- Gate 11's hash of `dist/` excludes the résumé PDF, because Chromium writes a creation date into
  it on every build; the PDF is proven by `tests/pdf.spec.ts`. Everything else, `og.png` included,
  is hashed. If `og.png` differs between two builds of the same commit, that is recorded and it is
  excluded too.
- The mention workflow cannot fire on the PR that adds it, because comment events run the
  workflow from `main`. Gate 5 is therefore exercised on the first PR after phase E merges. The
  automatic review can fire on its own PR, because pull-request events run from the head branch,
  so gate 6 starts in phase E.
- `.github/expiry.json` starts with `rollbackRehearsed` set to 2 September 2026, the preview
  rehearsal of version one, and phase F replaces it with the production date. `warnDays` is 30 and
  `rollbackIntervalDays` is 180 (C7).
- `check-expiry` runs in `pnpm check` before `test:config`, so the drift test can call it as one
  of the fast checks.
- The Claude action is pinned to the commit SHA that the `v1` tag points at on the day phase E is
  written, with the tag in a comment beside it (C9).
- The shell-side test guard splits commands into segments exactly as the deploy guard does and
  reuses its tokeniser, so the two hooks share one reading of a command line.
- Scheduled workflows in a public repository are disabled by GitHub after sixty days without a
  commit. The offline check in `pnpm check` is the safety net; the monthly cron is the reminder.
  Phase E records this beside the schedule.

## Repository layout (additions and changes)

```
.github/workflows/deploy.yml (changed)  .github/workflows/watch.yml  .github/workflows/claude.yml  .github/workflows/review.yml
.github/expiry.json  .github/pull_request_template.md (changed)
.claude/settings.json (changed)  .claude/hooks/guard-tests.mjs (changed)  .claude/hooks/guard-deploy.mjs (changed)  .claude/hooks/lib/command.mjs
.claude/agents/verifier.md (changed)  .claude/launch.json (changed)
CLAUDE.md (changed)  REVIEW.md (changed)  package.json (changed)
scripts/preview.mjs  scripts/rollback.mjs  scripts/check-expiry.mjs  scripts/eval-skills.mjs
scripts/lib/preview-server.mjs (changed)  playwright.config.ts (changed)  lighthouserc.cjs (changed)
tests/config/helpers.mjs  tests/config/hooks.test.mjs  tests/config/claude-md.test.mjs  tests/config/skills.test.mjs  tests/config/sdlc.test.mjs  tests/config/expiry.test.mjs
docs/sdlc/001-portfolio-v1/intent.md (changed)  docs/sdlc/002-playbook-gaps/scorecard.md (changed, phase G)
```

## npm scripts (additions and changes)

| Script | Runs |
| --- | --- |
| `test:config` | `node --test tests/config/` |
| `check` | as today, then `node scripts/check-expiry.mjs`, then `pnpm test:config` |
| `eval:skills` | `node scripts/eval-skills.mjs` (hand-run, not in `verify`) |
| `preview` | `node scripts/preview.mjs` (wrangler dev on `PREVIEW_PORT`, default 8788) |
| `rollback:preview` | `node scripts/rollback.mjs --env preview` |
| `rollback:production` | `node scripts/rollback.mjs --env production` (exits 1 unless `RELEASE_APPROVAL` is set) |
| `check-expiry` | `node scripts/check-expiry.mjs` (`--online` in the watch workflow) |

## Order of work

Seven phases, one PR each, in sequence; each branch is cut from `main` after the previous merge.
Every PR runs the pre-flight passes and posts their reports, per the accepted REVIEW.md rule,
from phase E onward when the rule is written; phases A to D post them too, since the rule is
already decided.

### A. Baseline: fix-mode rehearsal and the dist hash
- No code. Create `.claude/FIX_TASK`; in a session, attempt an Edit on `tests/e2e/a11y.spec.ts`
  (expect the refusal), a `sed -i` on the same file through Bash (expect it to pass today: the
  gap the intent names; the file is restored with `git checkout` at once), and `rm
  .claude/FIX_TASK` (expect it to pass today). Record the three outcomes with the messages seen
  in "Records" below.
- `pnpm build` on `main`, hash every file in `dist/` except the PDF, record the hash and the
  commit.
- Done: the records are in this file; PR merged.
- Could go wrong: nothing; this phase changes no behaviour.

### B. Configuration evals and the SDLC check
- Files: `tests/config/helpers.mjs`, `hooks.test.mjs` (current behaviour only), `claude-md.test.mjs`,
  `skills.test.mjs`, `sdlc.test.mjs`; `scripts/eval-skills.mjs`; `package.json` (`test:config`,
  `eval:skills`, `check`); `CLAUDE.md` (Commands: `pnpm test:config`, healthy `# fail 0`, and
  `pnpm eval:skills`; Process: the skill-eval rule); `docs/sdlc/001-portfolio-v1/intent.md` line 3.
- The drift test's phrase table classifies every phrase CLAUDE.md quotes today; the third-party
  phrases are the excluded list (C2).
- `pnpm eval:skills` run once on the Max login; its output pasted in the PR (gate 2).
- Done: `pnpm check` green with `test:config` inside it; the hook tables cover every row of spec
  2.2 that holds today; the SDLC check passes with the version one intent updated; the eval run
  pasted.
- Could go wrong: a healthy phrase in CLAUDE.md that no script prints verbatim (fix CLAUDE.md,
  not the script); Windows path separators in the hook payloads (normalise in the helper);
  `claude -p` refusing `--allowedTools Skill` in the installed CLI (fall back to reading the
  `tool_use` events with all tools allowed and `--max-turns 1`, recorded here).

### C. Hooks
- Files: `.claude/hooks/guard-tests.mjs` (Bash and PowerShell handling, the wider perimeter),
  `.claude/hooks/guard-deploy.mjs` (`rollback.mjs`, `rollback:production`), `.claude/settings.json`
  (matcher `Edit|Write|Bash|PowerShell`), `tests/config/hooks.test.mjs` (the "(new)" rows),
  `CLAUDE.md` (fix-mode paragraph; two entries under "Things Claude gets wrong").
- Rehearsal after the change, same three attempts as phase A, all three refused, recorded in
  "Records" with the messages.
- Done: every row of spec 2.2 passes; the rehearsal record shows the refusals; `pnpm check` green.
- Could go wrong: a false block on an innocent command during the phase itself (add the command
  to the allowed rows and narrow the heuristic, recorded here); the hook's own file is inside the
  fence, so its edits happen with fix mode off, which is the normal state.

### D. Scripts and the preview port
- Files: `scripts/preview.mjs`, `scripts/rollback.mjs`, `scripts/check-expiry.mjs`,
  `.github/expiry.json`, `scripts/lib/preview-server.mjs`, `playwright.config.ts`,
  `lighthouserc.cjs`, `.claude/launch.json` (comment), `package.json` (`preview`, `rollback:*`,
  `check-expiry`, `check`), `tests/config/expiry.test.mjs` (injected near dates, stale rehearsal,
  drift between recorded and online dates with a stubbed fetch), `tests/config/claude-md.test.mjs`
  (`check-expiry` joins the fast checks), `CLAUDE.md` (Commands: the new scripts, `PREVIEW_PORT`).
- The two-port proof: a second checkout of `main`, `PREVIEW_PORT=8790 pnpm preview` there and the
  default here, `pnpm test:headers` in each with a deliberately different `_headers` line in one
  build, each run seeing its own. Recorded in "Records" (gate 9).
- `rollback:preview` run once from this machine against the preview Worker to prove the script,
  before the workflow exists.
- Done: `pnpm verify` green; the port proof recorded; the rollback script proven on preview.
- Could go wrong: Playwright's `webServer` block and `reuseExistingServer` with a non-default port
  (the URL and the command both read the variable); wrangler's `--port` on Windows with a child
  `workerd` (the preview server library already ends the child).

### E. Workflows and the review policy
- Files: `.github/workflows/deploy.yml` (dispatch inputs `action`, `release_approval`,
  `version_id`; `production` job with `environment: production` and `if: action == 'release'`;
  `rollback` and `rollback-preview` jobs), `.github/workflows/watch.yml`,
  `.github/workflows/claude.yml`, `.github/workflows/review.yml` (both pinned by SHA),
  `REVIEW.md` ("Where findings live"; the "Do not report" additions), `.claude/agents/verifier.md`,
  `.github/pull_request_template.md`, `CLAUDE.md` (Process: the loop; the release-record rule for
  intent status lines).
- The automatic review fires on this PR (gate 6 begins). The watch workflow is dispatched once
  after merge (gate 4).
- Done: `pnpm verify` green; the review workflow's post visible on the PR; `deploy.yml` valid
  (the preview job still green on the PR); the watch dispatch green.
- Could go wrong: the action's `claude_args` syntax for tool restriction (checked against the
  action's `docs/configuration.md` when written); the OAuth token rejected by the action (the
  docs say Pro and Max are supported; if rejected, the two workflows wait and the plan records
  it); the ruleset's unattributed-changes rule on the app's first commit (phase F learns it).

### F. Rehearsals and the gated release
- Gate 5: a `@claude` mention on this PR asking for a small named change (a wording fix in the
  plan), answered by a commit or a reply from the workflow; the ruleset's behaviour on that commit
  observed and, if it blocks, the rule adjusted here.
- Gate 8, preview: dispatch `rollback-preview` to the previous version, headers spec green on it,
  dispatch again to come forward. Timed.
- Gates 3 and 8, production, three gated dispatches, each approved by the product owner in
  GitHub and each timed: `release` of `main` (a second version, identical content; the smoke
  check green: gate 3), `rollback` to version `5c6f46d9`, `release` forward. The twenty-second
  refusal window after an upload recorded as a known wait.
- After gate 3: the product owner deletes the old Cloudflare token in the dashboard (C4).
- `.github/expiry.json`: `rollbackRehearsed` set to the production date.
- Done: every timing and outcome in "Records"; the old token gone; `pnpm verify` green.
- Could go wrong: the second release's smoke check (the DNS poll from PR #8 is exercised for the
  first time here); a rollback refused inside the window (wait and retry, recorded).

### G. Re-score and close
- Files: `docs/sdlc/002-playbook-gaps/scorecard.md` (section "Re-score", same rubric, every
  criterion re-evidenced), the dist hash after (gate 11), the intent's status line gaining
  "Delivered", this file's closing record.
- Done: no criterion below 2, the evals criterion at 2 or more, the total above 90%; the two
  hashes equal; PR merged. The change is closed and the next intent, the project card, starts
  under the improved loop.

## Risks

- The model-driven pieces (the two workflows, the skill eval) are non-deterministic by nature.
  None is a required check; a miss is recorded, not hidden, and the deterministic layer carries
  the gates.
- Quota: each automatic review and each mention spends the Max subscription. The cadence of this
  repository is a few PRs a day at most; if it bites, the review workflow gains a path filter as
  a departure.
- The shell-side guard is a heuristic. Every false block met is a row added to the allowed table,
  so the guard converges on the commands the work actually uses.
- Two copies of the environment rule exist: the deploy script's `RELEASE_APPROVAL` check and
  GitHub's approval. They are meant to disagree on nothing; the config tests assert the script's
  half, the rehearsal proves GitHub's.
- The old Cloudflare token stays live until phase F. Nothing uses it after phase A's merge, and
  it is the same token that has served since the release, so the exposure is unchanged until
  it is deleted.

## Proof (spec section 10, gate by gate)

| Gate | Check | Command or record | Phase |
| --- | --- | --- | --- |
| 1 verify green with the config tests inside check | `test:config` and `check-expiry` in `pnpm check`; every row of spec 2.2 | `pnpm verify` | B, C, D |
| 2 skill eval run once | output pasted in the PR | `pnpm eval:skills` | B |
| 3 gated production release green | the `release` dispatch approved in GitHub, smoke check green | `gh workflow run deploy.yml -f action=release -f release_approval=...` | F |
| 4 watch workflow green; fails on injected dates | one dispatch; `expiry.test.mjs` | `gh workflow run watch.yml`; `pnpm test:config` | D, E |
| 5 a mention answered | comment on the phase F PR; the workflow's commit or reply | record | F |
| 6 automatic review on every PR | the review post on each PR from E onward | record | E, F, G |
| 7 fix-mode rehearsal recorded | before (A) and after (C), messages in "Records" | record | A, C |
| 8 rollback rehearsed on preview and production | timings in "Records"; `expiry.json` updated | `rollback-preview`, `rollback`, `release` dispatches | F |
| 9 two-port proof | record | `PREVIEW_PORT=8790 pnpm preview` in a second checkout | D |
| 10 version one intent updated; SDLC check passing | `sdlc.test.mjs` | `pnpm test:config` | B |
| 11 dist byte-identical (PDF excluded) | two hashes in "Records" | `pnpm build` and a hash script | A, G |
| 12 scorecard re-scored | `scorecard.md`, "Re-score" | record | G |

## Records

Filled in during implementation, one entry per proof that is a record rather than a command.

- Fix-mode rehearsal, before (phase A), 3 September 2026, in a Claude Code session on the
  development machine, with `.claude/FIX_TASK` created by `touch`:
  - An Edit on `tests/e2e/a11y.spec.ts` (a one-line comment change): refused. The message seen:
    "Blocked: <repo>/tests/e2e/a11y.spec.ts is a test or gate file
    and this is a fix task. Fix the code, not the check. If the check itself is wrong, say so and
    stop; a human changes it in a separate change. Fix mode ends when .claude/FIX_TASK is deleted."
    (the absolute path of the checkout elided).
  - `sed -i` on the same file through the Bash tool: went through, exit 0, `git diff --stat`
    reported one line changed; restored at once with `git checkout -- tests/e2e/a11y.spec.ts`.
  - `rm .claude/FIX_TASK` through the Bash tool: went through, exit 0; fix mode ended.
  The two pass-throughs are the gap phase C closes.
- Dist hash, before (phase A), 3 September 2026: `pnpm build` at 3890f0a on `docs/002-plan`, whose
  site sources are those of `main` at 1a6df88 (the branch added only the plan). Method: the
  sha256 of every file under `dist/` except `*.pdf`, one line per file as `<hex>  <path>` with the
  path relative to `dist/` and forward slashes, sorted by path in byte order, joined with LF and
  no trailing newline, then the sha256 of that text. Fourteen files; combined sha256
  `c2f4f09c075b34be64b0af61489b0fbd9510a3ff7955fbb617fc4439a1319ebb`. A second build of the same
  commit gave the same fourteen hashes, so `og.png` is byte-stable and stays in the hash; only the
  PDF varies, as the plan expected. 3890f0a is tree-identical to `main` at c6549c5, the merge
  of PR #12. Phase G builds at the `main` commit that carries its own changes; the site sources
  must still be those of 1a6df88, which an equal hash proves.
- Fix-mode rehearsal, after (phase C), 3 September 2026, in a Claude Code session with the new
  guard live from the working tree, `.claude/FIX_TASK` created by `touch` while fix mode was off:
  - An Edit on `tests/e2e/a11y.spec.ts`: refused. "Blocked: <repo>/tests/e2e/a11y.spec.ts is a
    test or gate file and this is a fix task. Fix the code, not the check. If the check itself is
    wrong, say so and stop; a human changes it in a separate change. Fix mode ends when
    .claude/FIX_TASK is deleted, which is allowed once a pull request exists for the branch."
  - `sed -i` on the same file through the Bash tool: refused. "Blocked: \"sed -i 's/Spec section
    10, gate 2\\./Spec section 10, gate 2. REHEARSAL/' tests/e2e/a11y.spec.ts\" writes to
    tests/e2e/a11y.spec.ts, a test or gate file and this is a fix task. ..." (the rest as above).
  - Deleting the marker through the Bash tool before any pull request existed for the branch:
    refused. "Blocked: \"rm .claude/FIX_TASK\" writes to .claude/FIX_TASK, a test or gate file and
    this is a fix task. ..."
  - An Edit on `src/components/Badge.astro` (a comment): allowed; reverted with
    `git checkout -- src/components/Badge.astro`, which the guard also allowed, the path being
    outside the fence.
  - The phase committed and pushed from inside fix mode (git add, commit and push are not writes
    the guard judges), PR #15 opened, then the same delete of the marker: allowed, exit 0, fix mode
    ended. Every outcome as the plan expected, with the marker rule refined as recorded below.
  - The first false block, met on the very next command: a Bash call that composed this PR's body
    inline carried the marker's delete command inside a quoted string, and the guard read that
    line as a delete. The body was written with the Write tool instead. This is the class the
    spec accepts (C6); the remedy is to write prose that names a guarded command through the Write
    tool, never inline in a shell command.
- Two-port proof (phase D): pending.
- Preview rollback through the script (phase D): pending.
- Mention answered (phase F): pending.
- Preview rollback through the workflow, timed (phase F): pending.
- Production release, rollback, release forward, timed (phase F): pending.
- Old token deleted (phase F): pending.
- Automatic review posted on each PR (phases E, F, G): pending.
- Dist hash, after (phase G): pending.
- Closing record (phase G): pending.

## Departures recorded during implementation

- Phase A, 3 September 2026: the baseline build ran at 3890f0a on `docs/002-plan`, before PR #12
  had merged, rather than on `main` as the phase says; the commit is tree-identical to `main` at
  c6549c5, so the hash stands (the verifier named this; recorded here so the section is honest).
- Phase B, 3 September 2026: `node --test` on this machine (Node 22.21, Windows) treats a directory
  argument as one failing test, so `test:config` passes the glob `tests/config/*.test.mjs`; the
  TAP reporter is forced so the `# fail 0` summary line is the same on a terminal and in CI. The
  drift test runs a fast check live only when CLAUDE.md quotes its passing line, which today is
  the line-ending check alone; the other fast checks in spec 2.3 print lines CLAUDE.md does not
  quote, and `pnpm check` runs them anyway. The spec's "path" kind was dropped: a healthy clause
  ends at its first semicolon, so `dist/index.html` and the stylelint file types in the Lint
  bullet are no longer read as output lines. The installed CLI (2.1.236) has no `--max-turns`
  flag, so `eval-skills.mjs` runs each prompt with only the Skill tool allowed and no turn cap;
  the eval passes the prompt as a quoted argument through the shell so the `claude` launcher
  resolves on Windows. The hook tests spawn the guards with `RELEASE_APPROVAL` and
  `CLAUDE_TASK_MODE` cleared from the inherited environment, so a developer's shell cannot
  change a verdict. The first eval run hung for three minutes on the first prompt: a headless
  session starts every MCP server the machine has configured, and one of them waits for a
  browser; the script now passes `--strict-mcp-config`, so no server starts. The second probe,
  with `--allowedTools Skill` alone, edited `src/styles/components/footer.css` to carry out the
  prompt, because that flag only pre-approves a tool and the user-level settings already allow
  every tool; the edit was reverted with git, nothing was committed, and the script now passes
  `--tools Skill` (the built-in set itself) and disallows the editing and shell tools as well.
  Worth knowing for any future headless use: `--allowedTools` widens, it never narrows.
- Phase B, 3 September 2026, after the verifier and the three REVIEW.md passes: the format-hook
  tests had written their scratch files inside the tree, and a concurrent Prettier scan during
  `pnpm verify` found one of them mid-delete and failed lint; the hook is now exercised in a
  throwaway project outside the repository that links this checkout's `node_modules` and copies
  the two formatter configs, so nothing is ever written inside the tree. Every guard verdict now
  comes from a throwaway project too, with or without the marker, so the repository's own marker,
  which exists during a real fix task, never fails `pnpm check`. The drift test's literal matcher
  reads only `console.log` and `console.error` arguments, bounds each `${...}` gap to one run of
  non-space characters, and carries its own unit cases, so stale wording after a gap fails. The
  eval passes the prompt on stdin with no shell, reads the session's first event and stops if any
  tool beyond Skill is present, compares `git status --porcelain` before and after every prompt
  and stops on a difference, and refuses an unknown `--only`; it also gained that `--only` option,
  which the spec did not describe. The hook tests clear `RELEASE_APPROVAL` and
  `CLAUDE_TASK_MODE` case-insensitively, since Windows environment names are. Spec 2.2's `.png`
  binary case uses a `.woff2`, because the repository tracks no `.png`; the "fix mode off" row
  now covers Edit, Write and the shell commands; the two deploy-guard rows for the rollback script
  wait for phase C, which teaches the guard the script; `grep deploy scripts/rollback.mjs` is
  covered now. The five helper scripts are named in CLAUDE.md rather than exempted in the test, as
  spec 2.3 asks. CLAUDE.md's Process paragraph names Francis as the one who runs the eval. The
  version one intent's status line reads "see `plan.md`, section \"Release\"" where spec 9 wrote
  "see plan.md, Release"; wording only.
- Phase C, 3 September 2026: the two guards read a command line through
  `.claude/hooks/lib/command.mjs` (segments, tokens, the command word after any leading
  `VAR=value`), so the "every file under .claude/hooks is registered" test now applies to the
  `.mjs` files at the top of the folder and checks that `lib/` parses. The marker rule refines
  spec 6: the guard refuses to delete `.claude/FIX_TASK` until an open pull request exists for
  the current branch (`gh pr list --head <branch>`, five and fifteen second timeouts, both
  children's stderr silenced so the refusal message stays first; any failure, gh missing or
  offline included, counts as no PR), and allows it after, which is what "deleted only after the
  PR is opened" meant and makes it mechanical rather than a rule the agent keeps. A redirect
  counts only where it points, so `grep x tests/a.ts > /tmp/out` stays allowed; every other
  write form counts when any protected path appears in the segment, which is the accepted
  false-block class (C6), and the first such block is recorded above. The hooks keep the literal
  byte-order mark in their stdin-cleaning regex as before. CLAUDE.md's "Things Claude gets
  wrong" gains the shell-edit entry now; the production-dispatch entry waits for phase E with
  the environment it describes.
- Phase C, 3 September 2026, after the verifier and the three REVIEW.md passes: the first cut's
  marker exemption judged only the first protected piece, so a delete that named the marker and a
  test file passed once a PR existed; a directory reached its fence only with a trailing slash,
  so `rm -rf tests`, `rm -rf .claude`, `git restore .`, `git reset --hard` and `git stash`
  passed; case, `./` and `//` in a path slipped past on Windows; `git checkout <path>` without
  `--`, a redirect glued to its command, `&>`, `sed -ni`, a `cd` in an earlier segment and a
  wrapper (`bash -c`, `eval`, `xargs`, `find -delete`, `sudo`, `python -c`) all reached a
  protected file unseen. The guard now exempts the marker only when it is the sole target,
  matches directories with or without the slash and case-insensitively after normalising
  `./` and `//`, treats `.`, `*`, `..` and `/` as the whole tree for destructive commands,
  judges `git checkout`, `mv`, `reset --hard` and `stash`, redirects without a leading
  space, any short-flag cluster of `sed` containing `i`, a carried `cd`, the text inside a
  wrapper as a segment of its own, `pnpm add|remove|pkg` as writes to `package.json`,
  `prettier --write`, Python's `open(..., 'w')`, and the PowerShell aliases and `Rename-Item`,
  `New-Item`; a command with a path prefix (`/bin/rm`, `\\rm`) is read by its name. The
  test guard's environment form also runs from a throwaway project, because the marker rule asks
  gh about the real branch, which had an open PR and made three rows fail; the marker rule's two
  verdicts are tested under a fake `gh` on PATH, on Linux only (CI), since Node resolves a
  command on Windows only as .exe or .com. The guard also refuses `del`, `rmdir`,
  `sed --in-place` and `node -p`, beyond spec 6's list. The two false blocks met were not
  added to the allowed rows and the heuristic was not narrowed, contrary to what phase C's
  "Could go wrong" line prescribed: both came from a guarded phrase quoted inside a shell string
  (a PR body written inline; a memory note naming the rollback alias), a class C6 accepts and one
  no allowed row can express; the remedy, recorded in CLAUDE.md, is to write such prose through
  the Write tool or a script file. The refusal now says the marker's deletion is allowed "once gh
  finds an open pull request", so a gh that could not answer reads as no PR.
- Phase C, 3 September 2026, after the second security pass, run against the hardened guard: the
  segment split was blind to quoting, so `sed -i 's/a/b/;s/c/d/' tests/x` and a two-statement
  `node -e` program parted the write from its path; `lib/command.mjs` now splits outside quotes
  only and keeps a heredoc body with the line that opens it, which also brings a program fed to
  `node -` on stdin into view. Forms the guard cannot judge from a command line, a script written
  elsewhere and run, a patch applied, are named as such in CLAUDE.md, which tells a fix task not
  to route an edit through them; `git apply` and `patch` are refused outright in fix mode. Added:
  `perl -pi`, PowerShell `[IO.File]::WriteAll*` and `::Delete`, a `VAR=path` carried into
  later segments, `dd of=`, `ln -sf`; the perimeter gains `scripts/lighthouse.mjs` and
  `scripts/postbuild.mjs` (check runners, not build steps), `tsconfig.json`, `.gitattributes`
  and `.claude/settings.local.json`, and knowingly leaves `src/content/schema.ts` and
  `profile.ts` out, since a content fix may need them. The marker rule counts only a non-draft
  pull request, so a draft cannot end fix mode, and resolves `git` and `gh` on PATH alone. The
  guard fails closed on its own errors. The GitHub file tools (`mcp__github__push_files`,
  `create_or_update_file`, `delete_file`) join the matcher and are judged by their paths. The
  wrapper rule no longer counts a wrapped command line as the whole tree: `bash -c` and
  `sudo` are judged by what they wrap, `find` by its path and `-delete`/`-exec`, and only
  `xargs`, whose input is a pipe, and an interpreter program with a write word and no visible
  target still reach the whole tree; the three false blocks the pass named are now allowed
  rows.
