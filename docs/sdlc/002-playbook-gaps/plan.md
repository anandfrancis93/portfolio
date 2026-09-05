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
  commit. The offline check in `pnpm check` is the safety net; the cron is the reminder, monthly
  as planned and weekly since PR #23 of 4 September 2026, which also added the advisory check.
  Phase E records this beside the schedule.

## Repository layout (additions and changes)

```
.github/workflows/deploy.yml (changed)  .github/workflows/watch.yml  .github/workflows/claude.yml  .github/workflows/review.yml
.github/expiry.json  .github/pull_request_template.md (changed)
.claude/settings.json (changed)  .claude/hooks/guard-tests.mjs (changed)  .claude/hooks/guard-deploy.mjs (changed)  .claude/hooks/lib/command.mjs
.claude/agents/verifier.md (changed)  .claude/launch.json (unchanged, 8788 stays the default)
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
  (`check-expiry` joins the fast checks), `tests/config/skills.test.mjs` (the launch port test),
  `CLAUDE.md` (Commands: the new scripts, `PREVIEW_PORT`).
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
- Two-port proof (phase D), 3 September 2026: a second checkout of the branch in a git worktree,
  with `X-Frame-Options` changed to `SAMEORIGIN` in its `src/config/headers.mjs` and built, its
  preview started with `PREVIEW_PORT=8790`, this checkout's build on the default 8788. Three
  runs of the headers spec: from this checkout on the default port, 5 passed (its own build);
  from this checkout with `PREVIEW_PORT=8790`, 2 failed, "Expected: DENY, Received: SAMEORIGIN"
  (the other checkout's build); from the second checkout with `PREVIEW_PORT=8790`, the same 2
  failed (its own build). Before this change both runs would have reused whichever server held
  8788. The worktree was removed afterwards.
- Preview rollback through the script (phase D), 3 September 2026, from this machine with the
  wrangler login: `pnpm run rollback:preview`, no version id, rolled the preview Worker back
  to version cc45f705 (the deploy before the current one), printed the deployment status and
  "Rolled back preview to version cc45f705-4880-4e61-adb3-4ed7419551e0 in 15 s." (18 s wall
  clock with wrangler's start-up). wrangler still asked for confirmation and answered it itself
  because no terminal was attached; the script now passes `--yes` as well as `--message`.
  Re-run on the hardened script after the review round (d49dc0e), by full version id both ways:
  back to fc64f45f in 4 s and forward to 11de381b in 5 s, no prompt, the version read from the
  rollback's own output; the eight-character form refused with "--version needs a full version
  id". The port parser was re-run too: the headers spec with `PREVIEW_PORT=8790` (5 passed on a
  preview Playwright started on 8790) and with the variable blank (5 passed on 8788).
- Watch workflow dispatched (gate 4, phase F), 3 September 2026: `gh workflow run watch.yml
  --ref main`, run 33818038823, green in under a minute; its one step printed "Expiry check:
  nearest expiry in 365 days (cloudflarePreviewExpires); rollback rehearsed 1 days ago, interval
  180; online: preview token active, expires 2027-09-03." So the online form reads the real
  token's expiry and the recorded date agrees with it.
- Mention answered (gate 5, phase F), first attempt 3 September 2026, 23:34 UTC, on PR #18: the
  `claude` workflow ran (33818158939) and the bot replied "Claude encountered an error". The log:
  Claude Code 2.1.259 refuses to install when `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` is set and
  bubblewrap is absent, and the runner image carries none. The first automatic review (run
  33818134286, gate 6) died the same way. Fixed in PR #19: a composite action,
  `.github/actions/bubblewrap`, installs bubblewrap, adds the AppArmor profile Ubuntu 24.04 needs
  for unprivileged user namespaces and proves a sandbox opens, before the Claude step in both
  workflows; the scrub stays. On PR #19's own review run (33819078345) the step printed
  "bubblewrap 0.9.0 opens a sandbox on this runner" in 36 s, then the action skipped itself as it
  does on any PR that changes its workflow. After PR #19 merged, a second mention (4 September,
  01:08 UTC) started run 33824626660, whose first two attempts (01:08, and 01:22 after a first
  re-set of the secret) failed at their first turn, in two seconds, with no model usage and no
  error text (the
  action hides Claude's output even in debug mode). A throwaway PR (#20, closed unmerged) ran
  Claude Code directly on the runner with the secret and printed only the result: "401 OAuth
  access token is invalid", scrub off and on alike; a second probe printed facts about the
  secret, never its value: it carried two stray whitespace characters from the paste at the
  PowerShell prompt of `gh secret set`, and with whitespace stripped the same token answered
  "ok". The owner minted a new token and stored it from the clipboard with whitespace removed
  (01:28); the probe then found the secret clean and all three forms answered. The earlier token
  was overwritten, is stored nowhere, and lapses with its year. The run's third attempt, at
  01:30:43, answered the mention in 2 min 40 s: 20 turns, commit 01b364d by claude[bot],
  co-authored by the owner, changing exactly the words asked, pushed to this branch, with a
  checklist in the bot's comment; the action reports four permission denials and a notional
  $0.51. One miss, which the bot reported rather than hid: `pnpm check` passed, but `pnpm lint`
  exited 2 before stylelint ran, because Prettier's walk of the repository root met the
  character devices the action mounts over shell and editor dotfiles (`.bashrc`, `.zshrc`,
  `.gitconfig`, `.vscode` and their kin, none of them in this repository) and could not read
  them; the bot pushed with that explanation, against the workflow's instruction to lint first.
  This PR adds those names to `.prettierignore`, so the next mention's lint runs to the end;
  spec section 4.1's "checks before push" is proven by that next mention, not by this one. Gate
  5 met. The new token is valid one year from 4 September 2026; `.github/expiry.json` keeps 3
  September 2027, a day early, the safe side.
- Preview rollback through the workflow, timed (gate 8, preview, phase F), 3 September 2026:
  `gh workflow run deploy.yml --ref main -f action=rollback-preview` with no version id, run
  33818074915, moved the preview from a7f73f51 (a CI deploy of the same minute) back to f0b6bce7;
  the step itself printed "Rolled back preview to version f0b6bce7-b966-4b1e-a648-9a002926a113 in
  3 s." and the run took 169 s wall clock with its queue. Two CI deploys then moved the preview
  on again (to 5edbaa32), so the by-id form was exercised for real twice: run 33818279290 back to
  f0b6bce7 (107 s) and run 33818761443 forward to 5edbaa32-1259-44a7-961e-1303b34b15d4, main's
  build after PR #17 (51 s), where the preview sat until this PR's next CI deploy. The job's
  last step ran the headers
  spec against the host after each rollback; all three runs green.
- Production release, rollback, release forward, timed (gates 3 and 8, phase F), 3 and 4
  September 2026 (times UTC), three `gh workflow run deploy.yml --ref main` dispatches, each
  approved by the product owner in the `production` environment (the approvals list of each
  run names him) and each carrying an approval reference as `release_approval`:
  1. `release` of main at 85c93ad, run 33819177742, dispatched 23:48:28, approved 00:40, job
     00:40:55 to 00:47:09. The deploy step was green (version
     922c3ed5-4bb0-4011-91d3-1dfb6ab321ef live at 00:42:00) and the smoke check red: thirty
     attempts over five minutes, "/ returned 403" from the resolved address, while the site
     answered 200, 200 and
     404 from the owner's machine, also with `--resolve` to that address. The zone's firewall
     events named the cause: Bot Fight Mode (source botFight, action managed_challenge) was
     challenging the runner's curl from Microsoft's network; the first release's runner had not
     been flagged, and the audit log showed no bot-setting change since 2 September. Cloudflare
     documents that the mode cannot be skipped by WAF custom rules or Page Rules, only pre-empted
     by an IP access rule, which cannot cover GitHub's runner ranges, and that exceptions for
     "your own monitoring tools" need Super Bot Fight Mode on a paid plan. The product owner
     turned Bot Fight Mode off for the zone at 00:56, giving up the free tier's site-wide
     challenge of known-bot patterns (scrapers now pass unchallenged; the AI-crawler block, the
     crawler settings, the managed ruleset and Cloudflare's DDoS mitigation stay), a decision
     recorded here, under "Departures" and in the smoke check's header. The run was not re-run:
     the two dispatches below prove the rest.
  2. `rollback` to 5c6f46d9-9d7e-44d6-8d7b-2c5446a5c1aa (the version one release, full id),
     run 33823853500, dispatched 00:57:17, approved 00:58, job 00:58:34 to 00:59:04, thirty
     seconds: "Rolled back production to version 5c6f46d9-9d7e-44d6-8d7b-2c5446a5c1aa in 4 s.",
     then the smoke check green on its first attempt (200, 200, 404, the PDF content type and
     the content security policy header). The twenty-second refusal window was not met: the
     rollback came seventeen minutes after the upload.
  3. `release` forward, run 33824002730, dispatched 00:59:40, approved 01:01, job 01:01:59 to
     01:02:58, fifty-nine seconds with the build: version 95525a17-43d8-47b3-8578-603e1f9680ac
     live at 01:02:53, the smoke check green on its first attempt. Gate 3 met. Production now
     serves main's build; the version one release stays one rollback away.

  Observed on the app's commit 01b364d (see the gate 5 record): the ruleset's
  unattributed-changes rule did not fire, because the commit's author resolves to a GitHub user
  (GitHub's API attributes it to the actions bot account), unsigned as it is; the pull request
  was blocked only while `ci` was red on the npm audit outage, and nothing in the merge box asked
  for an extra approval. No rule adjusted.
- Old token deleted (C4, phase F), 4 September 2026: after the green release forward the product
  owner deleted the token named "anandfrancis.com deploy (GitHub Actions)" in the Cloudflare
  dashboard, by his report; the two scoped tokens of 3 September 2026, expiring 3 September
  2027, are the only ones the workflows hold.
- Automatic review posted on each PR (gate 6, phases E, F, G): first post on PR #18, 4 September
  2026, 01:34:31 UTC, by the re-run of run 33824626978 after the secret fix: 24 turns, 160 s,
  the three passes (0 Important, 0 Nit; 0 Important, 0 Nit; 0 Important, 1 Nit, the description's
  wording on gate 5), two permission denials, a notional $0.51. Three seconds after the post the
  run was cancelled by its own concurrency rule, because the mention workflow's push had started
  a new review run; that run (33826285752) refused to start, "Workflow initiated by non-human
  actor: claude (type: Bot)", the action's default, so a bot's push is not reviewed until the
  next human push, which reviews the whole diff. Phase G's PR adds the next post.
- Dist hash, after (gate 11, phase G), 4 September 2026: the same method as the baseline
  (sha256 per file except the résumé PDF, which carries a creation date, byte-order sort,
  LF-joined, no trailing newline). Two builds, one hash: `pnpm build` at 5019420, `main` with
  phase F merged, when this branch was cut, and the verifier's `pnpm verify` at 9b9173b, this
  branch's own commit, which is the build phase A asked for. Both read 14 files, combined
  `c2f4f09c075b34be64b0af61489b0fbd9510a3ff7955fbb617fc4439a1319ebb`, equal to the baseline of
  phase A, so the seven phases changed nothing the site ships. The verifier's build of the phase
  F branch at af7c97a had given the same hash the night before, unrecorded then and quoted here
  from that report.
- Closing record (phase G), 4 September 2026: phases A to F merged as PRs #13 to #18, with the
  fix PR #19 between E and F, and phase G as this one; the scorecard's re-score reads 213 of
  222, 96%, against 187 of 222, 84%, with the core plays at 100 of 102. The plan's three closing
  conditions hold: no criterion below 2, the evals criterion at 2, the total above 90%; and the
  two dist hashes are equal, which is gate 11, while the re-score itself is gate 12, in
  `scorecard.md`, section "Re-score", on the baseline's own rubric, weights and not-applicable
  list. One condition needed a change to hold: the criterion this intent never took on, recurring
  scans, would have stayed at 1, so the owner turned on CodeQL and Dependabot at the close, the
  phase G departure below. The intent's status line gains "Delivered". Two findings the
  rehearsals left for the next intent's context: a zone's Bot Fight Mode challenges a runner's
  smoke check, and a credential pasted at a Windows prompt must be checked for stray
  whitespace. The next intent, the project card, starts under the improved loop.

- Superseded after delivery, 4 September 2026: PR #23, maintenance belonging to no intent,
  moved the watch from the monthly cron this spec and plan describe to a weekly one and added
  `scripts/check-advisories.mjs` beside the expiry check. The reason is arithmetic this intent
  did not do: the warning window is thirty days, so a monthly run can see thirty-three days on
  one date and two on the next, and a broken watch would go a month unnoticed. The sentences in
  section 3.3 and above carry the correction; this record is the trail.

- Superseded after delivery, 5 September 2026: PR #26, maintenance belonging to no intent, moved
  the fix-mode procedure, the release and rollback dispatches and the watch's detail out of
  CLAUDE.md into `docs/runbook.md`, which the drift test of spec section 2.3 now checks with the
  same command and path rules, and filed the independent playbook assessment of the same day
  beside the scorecard as `assessment.md`. The reason is the playbook's own rule for CLAUDE.md,
  under a page: it read 813 words at version one and 1,846 by 4 September 2026, which the
  assessment's sixth finding named; it now reads 1,369, with every command, healthy output,
  convention, architecture note and known mistake kept, and the Commands section, bound to the
  output lines the drift table pins, is the largest part of what remains. The sentences in spec
  sections 2.3 and 5 carry the correction; this record is the trail.

## Departures recorded during implementation

- Phase G, 4 September 2026: the plan's closing condition "no criterion below 2" met the one
  criterion 002 never took on, H6 (recurring scans); rather than record a shortfall, the product
  owner turned on two GitHub settings outside every phase's file list, CodeQL's default setup,
  which scans the code weekly and on every push and pull request, and Dependabot alerts and
  security updates, which watch the lockfile continuously. Neither writes a file into the
  repository, so this phase stays a documents change, and the re-score gives H6 a 2 on that
  evidence, short of a 3 because no pass validates a finding before it is reported.
- Phase F, 3 September 2026: the watch workflow's dispatch (gate 4) ran and was recorded in
  phase F, after PR #17 merged, although the proof table places it in phases D and E and phase
  E's "Done" line claims it; the dispatch needed the workflow on `main` first, so it could not
  precede the merge. Phase E's record stands corrected by the gate 4 record.
- Phase F, 4 September 2026: the product owner turned the zone's Bot Fight Mode off, a change to
  Cloudflare beyond the intent's affected-systems list (which names only the two API tokens),
  because the mode challenged the runner's smoke check and Cloudflare offers no exemption on the
  free plan; so gate 3 was met by the third gated dispatch (the release forward), not the first.
  The trade-off is in the production record.
- Phase F, 4 September 2026: a throwaway pull request (#20, branch deleted, never merged) ran
  Claude Code directly on the runner to read the error the action hides; it is outside the
  plan's file list and left nothing behind but the finding in the gate 5 record.
- Phase F, 3 September 2026: phase E's two Claude workflows could not start on the runner (with
  the scrub on, Claude Code refuses to start without bubblewrap, which the Ubuntu image does not
  carry; the first automatic review, run 33818134286, and the first mention, run 33818158939,
  both failed there), so a fix PR (#19) landed between the phase E and phase F merges, outside the
  phase order. It adds a composite action, `.github/actions/bubblewrap/action.yml`, which the
  phase E file list does not name, and runs it before the Claude step in both workflows; the
  scrub and the rest of the workflows stay as phase E recorded them.

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
  later segments, `dd of=`, `ln -sf`; the perimeter gains `scripts/lighthouse.mjs` (the Lighthouse
  runner and its floors) and `scripts/postbuild.mjs` (the build's step list, which decides that
  the budget check runs; the render steps it calls, `build-*.mjs` and `finalize-dist.mjs`, stay
  open, so a fix to the PDF or the card is not blocked), `tsconfig.json`, `.gitattributes`
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
- Phase D, 3 September 2026: the preview port's default first lived in
  `scripts/lib/preview-server.mjs` with the two configs repeating it as a literal; the review
  round moved it to one CommonJS module (the next entry), and `.claude/launch.json` keeps 8788
  unchanged since JSON carries no comment. `preview.mjs` prints "Preview on http://127.0.0.1:<port>" before wrangler's
  own "Ready on" line and ends wrangler's workerd child on Windows when interrupted, the leftover
  the version one notes recorded. `rollback.mjs` passes `--yes` because `--message` alone does
  not skip wrangler's confirmation. `check-expiry.mjs` takes `--file` and `--today` and reads
  `EXPIRY_VERIFY_URL` so the tests can inject dates and a stand-in endpoint; `.github/expiry.json`
  carries `cloudflarePreviewExpires` as well as the two dates the spec named, so the online check
  has a recorded date to compare the real one against. The drift test's live rows match the
  start of the printed line rather than the whole of it, since CLAUDE.md quotes prefixes. The
  expiry tests spawn the script asynchronously: the first cut used a synchronous spawn, which
  blocked the test process's event loop while its own stand-in server was meant to answer the
  child, and hung the suite; the same shape would trap any test that serves and spawns at once.
  The two-port proof used a worktree cut from the last commit, which predated the new scripts, so
  the two runtime scripts and the Playwright config were copied into it rather than rebuilding.
- Phase D, 3 September 2026, after the verifier and the three REVIEW.md passes: an impossible
  date in `.github/expiry.json` parsed to NaN and passed every comparison, so a typo would have
  disabled the check; a date is now real or refused, the warning window is inclusive, a
  rehearsal in the future fails, a bare `--file` and a JSON body that is not an object fail
  with a message. The port is parsed once, in `scripts/lib/preview-port.cjs`, which the preview
  library imports and the Playwright and Lighthouse configs require, so a blank or bad
  `PREVIEW_PORT` means the default everywhere; the launch test asserts all three load it.
  `EXPIRY_VERIFY_URL` is honoured for loopback hosts only, since the token travels with the
  request. The rollback script reads `--env` as the deploy guard does (last occurrence wins,
  glued short form accepted), takes the approval reference for production only, refuses one over
  120 characters or beginning with a dash (wrangler's limits), requires the full 36-character
  version id (wrangler passes it to the API as given, so phase F's production rehearsal names the
  full id, not the eight characters spec 7 wrote), refuses a bare `--version`, reads the deployed
  version from the rollback's own output and treats a status that cannot be read as a warning,
  not a failed rollback; the preview message is "preview rollback rehearsal". The preview script
  exits 0 on an interrupt although the child it ends exits 1 under taskkill. The online check
  also fails on an inactive token or one with no expiry, beyond spec 3.3's three conditions,
  and the offline check refuses a file with no expiry dates or with a warning window or an
  interval that is not a whole number of days. `preview-port.cjs` is the one CommonJS file
  under `scripts/`, against CLAUDE.md's "Node ESM" convention, because the Lighthouse config
  can only require; CLAUDE.md names the exception.
- Phase E, 3 September 2026: the production smoke check moved into a composite action,
  `.github/actions/smoke-check/action.yml`, so the release and rollback jobs run the same one
  rather than two copies of thirty lines. The `release_approval` input is optional at the
  workflow level, because `rollback-preview` needs none, and the two gated jobs refuse an empty
  one as their first step. The preview host the `rollback-preview` job tests is a workflow
  variable, since the rollback script does not print a URL. The two Claude workflows carry
  `id-token: write` beside the permissions the spec listed, which the action's own examples set. The
  Claude action is pinned to fa2b2666b747000bf42767d1f332065b375e3c8f, the commit the `v1` tag
  named on 3 September 2026 (tagged the day before). The mention workflow restricts tools with
  `--allowedTools` and also lists the deploy and rollback scripts, their aliases and wrangler
  under `--disallowedTools`, the skill eval with them (spec 2.6 says hand-run), and carries its
  standing instructions through `--append-system-prompt`; `actions: read` reaches the action
  through `additional_permissions`. The fork check spec 4.1 asks for is a job condition on the
  two review events, which carry the pull request's head, and a first step that asks the API on a
  comment event, which does not. CLAUDE.md's second "Things Claude gets wrong" entry is reworded
  from spec 5's: the workflow now references the environment, so the mistake to name is running a
  production deploy or rollback anywhere but through it. REVIEW.md's compliance pass and CLAUDE.md's
  opening now name the intent a change belongs to rather than version one's folder, and REVIEW.md's
  evidence list matches the template: the visual evidence for visual changes, the eval output for
  skill changes. After the security pass: the mention workflow's shell verbs are narrower than
  spec 4.1's `git *` and `gh pr *`, which admitted `gh pr merge`, `gh pr review --approve`
  and `git push --force` with a token that could do them; it now allows `git status`, `diff`,
  `log`, `add`, `commit` and `push origin HEAD`, and `gh pr view`, `diff`, `comment` and
  `checks`. The review workflow's posting pattern is the exact `gh pr review <number> --comment`
  rather than any `gh pr review`. Both Claude jobs set the action's subprocess environment scrub,
  so the OAuth token and the app token never reach a shell command. The mention trigger also
  requires the author to be the owner, a member or a collaborator, so a stranger's mention never
  starts the runner. The rollback jobs pass the version id through the environment rather than
  interpolating it into the command. The review workflow's comment says why its permissions are not
  its boundary. On a comment event the mention workflow installs dependencies on `main` before
  the action switches to the pull request's branch, so a pull request that changes dependencies
  runs its checks with main's; rare here. The automatic review posts its report through a
  single-quoted heredoc on standard input, since its tool set has no file writing and a report
  cites files and commands in backticks that a shell would read, and reads the intent, spec and
  plan the pull request names as well as REVIEW.md. The rollback jobs install no browser and run
  no build; the headers spec the preview rollback job runs uses Playwright's request fixture
  alone, so it needs none either. Every shell pattern in both tool lists uses the one form the
  CLI documents, an exact command or a prefix with a trailing `:*`; the first cut mixed in glob
  stars, which the action's documentation at the pinned commit does not show. The first `ci`
  runs of this phase failed in the audit step on a socket timeout from the npm registry's audit
  endpoint, from the runner and from this machine alike; the step re-runs when the endpoint
  answers, and nothing in the change touches the dependencies. The watch workflow uses
  `setup-node` alone, since the expiry script has no dependencies. The rollback job's green-`ci`
  check is the same as the release job's: it proves the commit whose workflow file runs, not the
  version being restored. The comment events run the mention workflow from `main`, so gate 5 is
  exercised on the first pull request after this one merges, as the plan's decision said. The
  automatic review did run from the head branch on this pull request, but the action skipped
  itself: it refuses a workflow file whose content differs from the default branch's, a
  safeguard against a pull request rewriting the workflow that reviews it. So the plan's decision
  that gate 6 starts on phase E's own pull request does not hold, and it starts on the first pull
  request after this one merges, with gate 5. The same safeguard means any later pull request that
  edits `review.yml` or `claude.yml` runs without the automatic review; the pre-flight covers it.
