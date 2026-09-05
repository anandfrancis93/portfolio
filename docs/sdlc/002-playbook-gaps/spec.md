# Spec: close the playbook gaps in how anandfrancis.com is built

Status: accepted by the product owner on 3 September 2026. All twelve concerns in section 12
were accepted as recommended the same day.
Derived from: `intent.md` (accepted 3 September 2026, PR #10).
Constraints applied: the `acme-design-system`, `portfolio-voice` and `web-quality` skills in
`.claude/skills/`. This change touches no page, no copy and no style, so the first two skills
constrain nothing here beyond the rule that their files keep the shape the new checks assert; the
web-quality rules on headers, deploy configuration and pinned dependencies apply to the workflow
changes. Companion document: `scorecard.md` (the rubric this change is scored against).

Areas of concern are collected in section 12 with a recommendation each. All twelve were accepted
by the product owner on 3 September 2026 and sections 1 to 11 reflect them.

---

## 1. What this change delivers

Eight mechanisms, each exercised at least once before the change closes, in the order of the
intent's outcomes:

1. Configuration evals: deterministic tests over the hooks, CLAUDE.md, the skills, the agent and
   the SDLC artifacts, inside `pnpm check`; and a hand-run skill-trigger script.
2. A least-privilege release path: the two scoped tokens and the GitHub `production` environment
   (both already in place), the production and rollback jobs behind that environment, and a
   monthly watch on expiries and the rollback rehearsal (weekly since 4 September 2026, PR #23).
3. The GitHub half of the review loop: a mention-triggered workflow and an automatic review on
   every pull request.
4. Findings on the PR: the review policy and the PR template say where findings live.
5. Fix mode that holds: the test guard watches the shell tools and its perimeter grows.
6. Rollback as a first-class action: a rollback script, a gated rollback job, rehearsed on preview
   and on production.
7. A configurable preview port.
8. The version one intent carries its acceptance and delivery; every SDLC artifact carries a
   status line.

Nothing a visitor sees changes. `dist/` after this change is byte-identical to `dist/` before it,
which the plan proves once.

## 2. Configuration evals

### 2.1 Runner and placement

- Files under `tests/config/`, plain Node ESM (`*.test.mjs`) using `node:test` and
  `node:assert/strict`. No new dependency. The Playwright projects match explicit file names, so
  Playwright never collects these; Prettier formats them; the fix-mode guard already protects
  `tests/`.
- Script `test:config`: `node --test tests/config/`. `pnpm check` runs it after the line-ending
  check, so `pnpm verify` and CI cover it on every run (C1). Healthy output ends with node's
  summary line, `# fail 0`, which CLAUDE.md quotes.
- A helper module `tests/config/helpers.mjs` spawns a hook with a JSON payload on stdin and the
  given environment, and returns `{ status, stderr }`; and reads CLAUDE.md, `package.json` and the
  frontmatter of a Markdown file.

### 2.2 Hook tests (`tests/config/hooks.test.mjs`)

Each hook is spawned as Claude Code spawns it: `node <hook>` with `{ "tool_name", "tool_input" }`
on stdin and `CLAUDE_PROJECT_DIR` set. Exit 0 means allowed, exit 2 means blocked with the message
on stderr; every blocked case asserts the message starts with `Blocked:`.

Deploy guard (`guard-deploy.mjs`), Bash and PowerShell tool names both:

| Command | Expected |
| --- | --- |
| `wrangler deploy` | blocked |
| `wrangler deploy --env preview`, `-e preview`, `--env=preview` | allowed |
| `wrangler deploy --env production` | blocked |
| `wrangler versions upload` | allowed |
| `wrangler versions deploy`, `wrangler rollback`, `wrangler rollback --env production abc` | blocked |
| `wrangler rollback --env preview` | allowed |
| `wrangler delete`, `wrangler secret put X`, `wrangler triggers deploy` | blocked |
| `wrangler deploy --env preview && wrangler deploy` | blocked (the second segment) |
| `pnpm run deploy:production`, `pnpm run rollback:production` | blocked |
| `node scripts/deploy.mjs --env production`, `node scripts/rollback.mjs --env production` | blocked |
| `cat scripts/deploy.mjs`, `grep deploy scripts/rollback.mjs` | allowed |
| `RELEASE_APPROVAL=x wrangler deploy` | allowed (the reference is in the command) |
| `wrangler deploy` with `RELEASE_APPROVAL` in the environment | allowed |
| empty command, a non-JSON payload | allowed (exit 0) |

Test guard (`guard-tests.mjs`, section 6), with `CLAUDE_TASK_MODE=fix` and, separately, with a
marker file in a temporary `CLAUDE_PROJECT_DIR`, so the repository's own marker is never touched:

| Tool and target | Expected |
| --- | --- |
| Edit `tests/e2e/a11y.spec.ts`, `tests/config/hooks.test.mjs`, `tests/pdf.spec.ts` | blocked |
| Edit `playwright.config.ts`, `stylelint.config.js`, `.htmlvalidate.json`, `lighthouserc.cjs`, `lighthouserc.desktop.cjs` | blocked |
| Edit `.github/workflows/ci.yml`, `scripts/check-eol.mjs`, `src/config/pairings.mjs` | blocked |
| Edit `package.json`, `.claude/settings.json`, `.claude/hooks/guard-tests.mjs`, `REVIEW.md`, `.claude/FIX_TASK`, `.github/expiry.json` | blocked (new) |
| Edit `src/components/Header.astro`, `scripts/build-pdf.mjs`, `CLAUDE.md`, `docs/sdlc/002-playbook-gaps/plan.md` | allowed |
| Bash `sed -i 's/a/b/' tests/e2e/a11y.spec.ts` | blocked (new) |
| Bash `echo x > tests/e2e/new.spec.ts`, `printf x >> package.json`, `cat > tests/x.mjs <<EOF` | blocked (new) |
| Bash `tee tests/e2e/a11y.spec.ts`, `cp a.ts tests/e2e/a11y.spec.ts`, `mv x playwright.config.ts` | blocked (new) |
| Bash `rm .claude/FIX_TASK`, `rm -rf tests/config`, `git checkout -- tests/`, `git restore tests/e2e/a11y.spec.ts` | blocked (new) |
| PowerShell `Set-Content tests/e2e/a11y.spec.ts x`, `Remove-Item .claude/FIX_TASK`, `Out-File package.json` | blocked (new) |
| Bash `cat tests/e2e/a11y.spec.ts`, `grep -n hidden tests/e2e/*.ts`, `node scripts/check-eol.mjs`, `pnpm test`, `git diff tests/` | allowed |
| Bash `sed 's/a/b/' tests/e2e/a11y.spec.ts` (no `-i`), `echo x > /tmp/out.txt` | allowed |
| Any of the above with fix mode off | allowed |

Format hook (`format-on-edit.mjs`): a `.png` path exits 0 without running anything; a path outside
the project exits 0; a temporary `.css` file containing a raw hex colour exits 2 with a stylelint
finding; a temporary well-formed `.mjs` file exits 0 and is left formatted.

### 2.3 CLAUDE.md drift (`tests/config/claude-md.test.mjs`)

- Every `pnpm <name>` CLAUDE.md names in backticks is a script in `package.json`, and every script
  in `package.json` that a human runs (all but the ones prefixed `test:`, which CLAUDE.md lists as a
  group) is named in CLAUDE.md.
- Every backticked token in CLAUDE.md that contains a slash, starts with a dot or ends in a known
  extension is a path that exists, with `dist/...` paths excluded because they exist only after a
  build, and a bare extension such as `.css`, a class name or flag (`--`) and the two git-ignored
  files (`.claude/FIX_TASK`, `.claude/settings.local.json`) skipped. The dot rule dates from the
  maintenance PR of 5 September 2026; before it, a root dotfile was skipped with the class names.
- The name-exists and path-exists checks, not the every-script-named one, also run over
  `docs/runbook.md`, the procedures CLAUDE.md points to, since the maintenance PR of 5 September
  2026 that moved them there (the plan's records say which).
- Every healthy-output phrase CLAUDE.md quotes is attributed to a source in a table inside the
  test: for the repository's own fast checks (`check-eol`, `check-content`, `check-voice`,
  `check-contrast`, `sync-tokens --check`, `font-fallback --check`, `build-qr --check`,
  `check-expiry`) the test runs the command and matches its last line against the phrase with `N`
  standing for a number; for the build-time phrases (`Wrote dist/...`, `Finalized dist`,
  `Wrote dist/_headers`, `JavaScript budget: N B gzip of 30720 B.`) it matches the phrase against
  the `console.log` literals in the script named, with `${...}` standing for anything; phrases
  printed by third-party tools (Astro, Prettier, wrangler, `astro check`) are listed as excluded,
  and the test fails if CLAUDE.md quotes a phrase the table does not know, so a new phrase must be
  classified when it is added (C2).

### 2.4 Skills, agents and wiring (`tests/config/skills.test.mjs`)

- Every folder under `.claude/skills/` has a `SKILL.md` whose frontmatter `name` equals the folder
  name and whose `description` is non-empty and under 1024 characters.
- The three skill names CLAUDE.md, REVIEW.md and the two specs cite exist.
- `.claude/skills/acme-design-system/tokens.css` is the source `sync-tokens.mjs --check` compares
  against (the path in the script matches the file).
- Every `.claude/agents/*.md` has frontmatter `name`, `description` and `tools`, and `tools` names
  only tools Claude Code has.
- Every hook command in `.claude/settings.json` names a file under `.claude/hooks/` that exists
  and passes `node --check`; every hook file is registered in `settings.json`; the matchers cover
  the tools each hook expects (the test guard on `Edit|Write|Bash|PowerShell`, the deploy guard on
  `Bash|PowerShell`, the format hook on `Edit|Write`).
- `.claude/launch.json` names the preview port that `scripts/preview.mjs` defaults to.

### 2.5 SDLC artifacts (`tests/config/sdlc.test.mjs`)

- Every `intent.md`, `spec.md` and `plan.md` under `docs/sdlc/*/` carries a line beginning
  `Status:`.
- A later stage implies the earlier one was accepted: where `spec.md` exists, the intent's status
  line does not contain `draft`; where `plan.md` exists, the spec's does not.

### 2.6 The skill-trigger script (`scripts/eval-skills.mjs`, hand-run)

- Script `eval:skills`. Not part of `check` or `verify`; run by hand before any PR that changes a
  file under `.claude/skills/`, its output pasted into that PR (C3).
- Prompts live in the script: for each skill, three prompts that should load it, worded as a user
  would ask (a CSS change, a copy edit, a header change); and two prompts that should load no
  skill (a git question, a question about the lockfile).
- Each prompt runs `claude -p <prompt> --output-format stream-json --verbose --max-turns 2
  --allowedTools Skill`, so the only action available to the model is loading a skill, and the run
  spends one or two turns of the Max quota. The script collects every `tool_use` block whose name
  is `Skill` and reads the skill it named.
- Output: one line per prompt, `pass` or `miss`, then a summary. A miss on a prompt that should
  load a skill is re-run once, since the judgement is a model's; two misses fail the script.
- `--model` is passed through when given; the default is the CLI's default model, the one the
  skills are used with in practice.

## 3. The release path

### 3.1 Already in place (not repeated by the plan)

Two Cloudflare user tokens, both expiring 3 September 2027: "anandfrancis.com preview deploy
(GitHub Actions)" with Workers Scripts edit and Account Settings read on the account and User
Details and Memberships read, stored as the repository secret `CLOUDFLARE_API_TOKEN`; and
"anandfrancis.com production deploy (GitHub Actions)" with the same plus Workers Routes edit on
the anandfrancis.com zone, stored as the secret of the same name in the GitHub environment
`production`, which requires Anand Francis's approval and accepts only `main`. The old token,
"anandfrancis.com deploy (GitHub Actions)", thirteen permissions, no expiry, still exists (C4).

### 3.2 The deploy workflow (`.github/workflows/deploy.yml`)

- The `workflow_dispatch` inputs become: `action`, a choice of `release`, `rollback` and
  `rollback-preview`; `release_approval`, a string, required for `release` and `rollback` (C5);
  `version_id`, an optional string used by the rollback actions (default: the version before the
  current one).
- The `production` job gains `environment: { name: production, url: https://anandfrancis.com }`
  and runs only when `action` is `release`. Its `CLOUDFLARE_API_TOKEN` therefore resolves to the
  environment secret. Everything else in it stays: the green-`ci` check for the exact commit, the
  build, `deploy:production` with `RELEASE_APPROVAL`, the smoke check.
- A `rollback` job, same environment, same green-`ci` check, runs `pnpm run rollback:production`
  with `RELEASE_APPROVAL` and `version_id`, then the smoke check, so a rollback is proven the same
  way a release is.
- A `rollback-preview` job, no environment, repository secret, runs `pnpm run rollback:preview`
  with `version_id` and then the headers spec against the preview host.
- The `preview` job is unchanged. Concurrency stays per ref.

### 3.3 The watch workflow (`.github/workflows/watch.yml`)

- Runs on a monthly schedule (the first of the month, 09:00 UTC) and by dispatch; no environment,
  superseded on 4 September 2026 by a weekly schedule (Mondays, 09:00 UTC), PR #23,
  so it never needs an approval; permissions `contents: read`.
- Step one: `node scripts/check-expiry.mjs --online`, which calls `GET /user/tokens/verify` with the
  repository token and reads `expires_on`.
- Step two, added on 4 September 2026 by PR #23 with the weekly schedule above:
  `node scripts/check-advisories.mjs`, which asks GitHub's advisory database whether any
  identifier silenced in `package.json`'s `pnpm.auditConfig`, in either list pnpm honours, now
  has a patched version, and fails when one does or when it cannot read an answer. It runs even
  when step one failed, so one warning never hides the other.
- The dates it cannot ask for live in `.github/expiry.json` (C6): the production token's expiry,
  the OAuth token's expiry, the date the rollback was last rehearsed on production, and the
  rehearsal interval in days (C7). The script fails when any expiry is within thirty days, when
  the online expiry of the preview token disagrees with the recorded one by more than a day, or
  when the rehearsal is older than the interval.
- `scripts/check-expiry.mjs` without `--online` checks only the recorded dates, needs no network,
  and runs inside `pnpm check`, so the same warning appears on every PR and locally, thirty days
  out. The config tests cover both modes with injected dates.
- `.github/expiry.json` decides what a gate checks, so the fix-mode guard protects it.

## 4. The GitHub half of the review loop

### 4.1 Mention workflow (`.github/workflows/claude.yml`)

- Triggers: `issue_comment` (created), `pull_request_review_comment` (created),
  `pull_request_review` (submitted). The job runs only when the comment body contains `@claude`
  and the event belongs to a pull request whose head is in this repository (no forks).
- Authentication: `claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}`. The action's
  default write-access check stays on: only Anand Francis can trigger it. `allowed_non_write_users`
  and `allowed_bots` are never set.
- Permissions: `contents: write`, `pull-requests: write`, `issues: write`, `actions: read`.
- Before the action: checkout, pnpm, Node from `.node-version`, `pnpm install --frozen-lockfile`,
  Chromium, so the checks can run.
- Tools, through `claude_args --allowedTools`: `Read`, `Edit`, `Write`, `Glob`, `Grep`, and Bash
  limited to `pnpm check`, `pnpm lint`, `pnpm format`, `pnpm build`, `pnpm test`, `pnpm test:*`,
  `node scripts/*`, `git *` and `gh pr *`. No `wrangler`, and the job carries no Cloudflare secret
  (C8). The project's hooks load inside the runner as they do locally.
- The action version is pinned to a full commit SHA with the tag in a comment (C9).
- What it does with a comment is what the comment asks; the prompt adds only that it reads
  CLAUDE.md and REVIEW.md first, runs `pnpm check && pnpm lint` before pushing, pushes to the PR
  branch, and never merges.

### 4.2 Automatic review (`.github/workflows/review.yml`)

- Trigger: `pull_request` (opened, synchronize, reopened, ready_for_review), skipping drafts and
  forks. Concurrency per PR with cancel-in-progress, so a push during a review restarts it.
- Same token, same SHA pin. Permissions `contents: read`, `pull-requests: write`, `issues: read`
  and `id-token: write`, which the action's token exchange needs (carried since phase E; written
  here on 5 September 2026, PR #27).
- Tools: `Read`, `Glob`, `Grep`, and Bash limited to `gh pr diff *`, `gh pr view *`, `gh pr
  review *` and `git diff *`. It runs no checks: `ci` runs them, and REVIEW.md says a finding CI
  would catch is not the reviewer's (C10).
- Prompt: read REVIEW.md; run its three passes over the diff against `spec.md` and `plan.md` of
  the intent the PR names; post exactly one review with `gh pr review --comment --body-file`,
  findings tagged by pass and ranked Important then Nit with the five-nit cap; never approve,
  never request changes, never merge.
- It is not a required status check. The ruleset is not changed for it. If the ruleset's rule on
  unattributed changes blocks a merge after the mention workflow's first commit, the rule is
  adjusted in the same PR and recorded in the plan.
- After the action, a step asks the API for a review by the app on the head commit; when none
  exists it posts one review comment on the pull request naming the commit and the reason (the
  workflow file differs from `main`, which the action refuses, or the action posted nothing) and
  fails the job, so a green `review` means a review was posted. A review rather than an issue
  comment, since the deploy workflow's preview step edits the bot's last issue comment. Added by
  PR #27 (5 September 2026); the check stays not required.

## 5. Findings on the PR

- `REVIEW.md` gains a section "Where findings live": every finding is on the pull request,
  whoever produced it. The automatic review posts its own. The in-session passes run as a
  pre-flight before the PR is opened and each report, the verifier's included, is posted with
  `gh pr review --comment --body-file` before a merge is requested. No pull request is exempt,
  docs-only ones included.
- `REVIEW.md`'s "Do not report" list names `tests/config/` results and the expiry check among the
  things CI enforces.
- `.claude/agents/verifier.md` says its report is posted on the PR verbatim by the session that
  ran it, and lists `test:config` and the expiry check among what `pnpm verify` covers.
- `.github/pull_request_template.md`: "Plan phase" becomes "Intent and plan section"; a checkbox
  "Pre-flight review and verifier reports posted on this PR" is added; the evidence list names
  `pnpm verify` output, screenshots only for visual changes, and the skill-eval output only for
  skill changes.
- `CLAUDE.md`: the Process section states the loop (automatic review on every PR; mention
  `@claude` on a PR to have a finding fixed; reports posted before merge); the Commands section
  gains `test:config`, `eval:skills`, `rollback:preview`, `rollback:production`, `check-expiry`
  and the `PREVIEW_PORT` variable with their healthy outputs; the fix-mode paragraph describes the
  wider perimeter and the shell guard (since the maintenance PR of 5 September 2026 it states the
  rule and points to `docs/runbook.md`, which carries the perimeter, the shell guard and the
  release and watch procedures; the plan's records say which PR); "Things Claude gets wrong" gains
  "Editing a test through the shell during a fix task" and "Dispatching production before the
  workflow references the environment".

## 6. Fix mode

- `guard-tests.mjs` handles all four tools. For `Edit` and `Write` it checks `file_path` as today.
  For `Bash` and `PowerShell` it splits the command into segments as the deploy guard does and
  blocks a segment that both names a protected path and contains a write form: `sed -i`, a `>` or
  `>>` redirect, `tee`, `cp`, `mv`, `rm`, `truncate`, `git checkout --`, `git restore`, `git rm`,
  `git clean`, a heredoc into a file, `node -e` or `node --eval` mentioning `writeFile`, and the
  PowerShell cmdlets `Set-Content`, `Add-Content`, `Out-File`, `Remove-Item`, `Move-Item`,
  `Copy-Item`, `Clear-Content`. A segment that only reads a protected path passes. The message
  names the segment and says: fix the code, not the check; if the check is wrong, stop and say so.
- The protected set adds `package.json`, everything under `.claude/hooks/`,
  `.claude/settings.json`, `REVIEW.md`, `.claude/FIX_TASK` and `.github/expiry.json`. Build
  scripts, `CLAUDE.md`, the plan and the site sources stay editable (C11).
- `settings.json` registers the guard on `Edit|Write|Bash|PowerShell`.
- Rehearsal, the first step of the plan and recorded in it with the messages seen: marker on; an
  Edit on a test file, a `sed -i` on the same file, and `rm .claude/FIX_TASK` are each refused; an
  edit to a component is allowed; marker off, the same edit to the test file is allowed.
- CLAUDE.md says the marker is deleted only after the PR is opened, since the guard refuses to
  delete it in fix mode.

## 7. Rollback

- `scripts/rollback.mjs` mirrors `deploy.mjs`: `--env preview|production`, optional `--version
  <id>`, production refused without `RELEASE_APPROVAL`; runs `wrangler rollback [id] --env <env>
  --message "<reference or 'preview rehearsal'>"` so wrangler never prompts, then `wrangler
  deployments status --env <env>` and prints it; writes `version=` to `GITHUB_OUTPUT` when present.
  Scripts `rollback:preview` and `rollback:production`.
- `guard-deploy.mjs` treats `node scripts/rollback.mjs` and `rollback:production` as it treats the
  deploy script and alias; `--env preview` stays always allowed.
- Rehearsal on preview, through the `rollback-preview` dispatch with the CI token: deploy the
  preview (any push does), dispatch a rollback to the previous version, confirm the headers spec
  passes on it, dispatch again to come forward. Timings recorded.
- Rehearsal on production, three gated dispatches, timed: `release` of `main` (a second version,
  identical content), `rollback` to version `5c6f46d9` (the first release), `release` forward
  again. The twenty-second window after an upload during which wrangler refuses to roll back is
  written into the plan as a known wait. The rehearsal date goes into `.github/expiry.json`.

## 8. The preview port

- `PREVIEW_PORT`, default `8788`. `scripts/preview.mjs` reads it and starts `wrangler dev` on it;
  `pnpm preview` runs that script. `scripts/lib/preview-server.mjs`, `playwright.config.ts` and
  `lighthouserc.cjs` derive their default URL from it; `PLAYWRIGHT_BASE_URL` and `LIGHTHOUSE_URL`
  still override. `.claude/launch.json` keeps 8788 and says so.
- Proven once: two checkouts, two ports, `pnpm test:headers` in each hits its own build.

## 9. The version one intent and the SDLC artifacts

- `docs/sdlc/001-portfolio-v1/intent.md` line 3 becomes "Status: accepted by the product owner on
  2 September 2026 (ca08c2c). Delivered as version one, released 3 September 2026; see `plan.md`,
  Release." The rest of the file is untouched.
- The check in 2.5 keeps it from recurring for missing lines; for stale ones, CLAUDE.md's Process
  section carries the rule: when a release record is written, the intent's status line is updated
  in the same PR.

## 10. Quality gates

The acceptance checks before this change is closed:

1. `pnpm verify` green locally and in CI with `test:config` and the offline expiry check inside
   `pnpm check`; the hook tables in 2.2 complete.
2. `pnpm eval:skills` run once on the Max login, every should-load prompt passing, every
   should-not prompt loading nothing, the output in the PR that adds the script.
3. A gated production release green through the environment, the approval recorded by GitHub
   against Anand Francis, the smoke check green. The old Cloudflare token deleted after it.
4. The watch workflow dispatched once and green; the config tests prove it fails on an injected
   near date and on a stale rehearsal date.
5. One `@claude` mention on a PR of this change answered by a commit or a reply from the workflow,
   with the checks it ran visible in the job log.
6. The automatic review posted on every PR of this change from the PR that adds it onward; the
   unattributed-changes rule observed and, if needed, adjusted.
7. The fix-mode rehearsal recorded in the plan with the refusal messages, and the config tests
   covering every row of the test-guard table.
8. Rollback rehearsed on preview and on production as in section 7, timings in the plan, the date
   in `.github/expiry.json`.
9. The two-port proof in section 8 done once and recorded.
10. The version one intent updated; the SDLC check passing.
11. `dist/` byte-identical before and after the change on the same commit of `main` (the build
    is not touched), proven once by a hash of the directory.
12. The scorecard re-scored in `scorecard.md`, section "Re-score": no criterion below 2, the
    evals criterion at 2 or more, the total above 90%.

## 11. Technical decisions for the plan stage

- Tests: `node:test`, one file per area, a shared helper; assertions name the hook, the payload
  and the expected verdict so a failure reads as a sentence.
- The shell-side guard is a heuristic by design; the plan seeds it with the table in 2.2 and adds
  a row for every false block met during the change.
- Workflows: the Claude action pinned by SHA; the other actions stay on their major tags as they
  are, since they are GitHub's own (C9). Node and pnpm setup copied from `ci.yml`, not
  restructured into a reusable workflow; the duplication is four lines.
- The watch workflow's cron, monthly as specified and weekly since PR #23, and the offline check
  in `pnpm check` read one file,
  `.github/expiry.json`, in this shape: `{ "cloudflareProductionExpires": "2027-09-03",
  "claudeOauthExpires": "2027-09-03", "rollbackRehearsed": "<date>", "rollbackIntervalDays": N,
  "warnDays": 30 }`.
- `scripts/preview.mjs`, `scripts/rollback.mjs`, `scripts/check-expiry.mjs` and
  `scripts/eval-skills.mjs` follow the conventions of the existing scripts: Node ESM, a usage
  comment at the top, exit 1 with a readable message, Windows-safe spawning through
  `process.execPath`.
- Order of work: the fix-mode rehearsal first (the hook exists today); then the evals, which lock
  the hooks' behaviour before the hooks change, in the same PR as the version one intent's status
  line, since the SDLC check in 2.5 fails on the old line; then the hooks; then the workflows;
  then the rollback rehearsals, which need the workflows; then the re-score. Each is one PR.

## 12. Areas of concern for the product owner

- **C1 (accepted 3 September 2026). Where the config tests run.** Inside `pnpm check`, so they gate every `verify` and every
  CI run. They take about two seconds. Alternative: `verify` only. Recommendation: `check`.
- **C2 (accepted 3 September 2026). Third-party output phrases in CLAUDE.md.** The drift test cannot check phrases printed by
  Astro, Prettier or wrangler without running a build. Recommendation: list them as excluded in
  the test and rely on the rule that a dependency upgrade PR re-reads CLAUDE.md's Commands
  section; the test still fails on an unclassified phrase, so nothing new slips in unlabelled.
- **C3 (accepted 3 September 2026). The skill-eval script's cost.** Eleven prompts, one or two turns each, on the Max quota,
  per run; run only when a skill file changes. Recommendation: accept, and run it once in this
  change to prove it works.
- **C4 (accepted 3 September 2026). When the old Cloudflare token is deleted.** Recommendation: after gate 3, the first
  green gated production release, by you in the dashboard, recorded in the plan.
- **C5 (accepted 3 September 2026). The free-text approval reference alongside the environment gate.** The environment
  records who approved; the input records why. Keeping both means two things to type on a
  release. Recommendation: keep both; the deploy script and the hook already require the
  reference, and it is the line that ends up in the release record.
- **C6 (accepted 3 September 2026). Fixed expiry dates in a committed file.** The watch workflow cannot read the production
  environment's secret without an approval every month, and no endpoint reports the OAuth token's
  expiry. Recommendation: record both dates in `.github/expiry.json` when the tokens are created,
  and let the online check on the preview token catch a recorded date that drifts.
- **C7 (accepted 3 September 2026). Rollback rehearsal interval.** The intent left it open. A static site changes rarely and
  the rehearsal is three approvals. Recommendation: 180 days, warned at 30 days out, in
  `.github/expiry.json` where it can be changed without touching code.
- **C8 (accepted 3 September 2026). What the mention workflow may run.** It needs the checks to fix a finding properly, which
  means installing Chromium on each run, about a minute. Recommendation: allow the checks and
  Bash for `pnpm`, `node scripts/*`, `git` and `gh pr`; deny everything else; no Cloudflare
  secret in the job.
- **C9 (accepted 3 September 2026). Pinning the Claude action by SHA.** It runs with write permissions and your OAuth token,
  so a moved tag would be a supply-chain path. Recommendation: pin it to a commit SHA and leave
  GitHub's own actions on their major tags; a later intent can pin those too.
- **C10 (accepted 3 September 2026). Whether the automatic review runs the checks.** Recommendation: no. `ci` runs them on
  the same commit, REVIEW.md already excludes what CI enforces, and a read-only reviewer is faster
  and cheaper.
- **C11 (accepted 3 September 2026). The fix-mode perimeter.** `package.json`, the hooks, `settings.json`, REVIEW.md, the
  marker and `.github/expiry.json` join the fence; build scripts and CLAUDE.md stay out.
  Recommendation: accept. If a fix genuinely needs a fenced file, the fix stops and says so,
  which is the rule the hook prints. Amended on 4 September 2026 by PR #23, on the owner's
  decision: such a fix is pinned by a test, then made outside fix mode in a commit of its own
  that the PR calls out, rather than stopping for the owner to make by hand. The fence became a
  rule about visibility rather than a prohibition, on the reasoning that the review and the
  owner's merge are what protect every other change too.
- **C12 (accepted 3 September 2026). Where the in-session reports are posted from.** Recommendation: the session posts every
  report, including the verifier's, so there is one mechanism and the verifier keeps its
  report-only role.

## 13. Traceability

- Intent to spec: outcomes 1 to 8 map to sections 2 to 9; the constraints map to sections 3.1
  (credential steps already done by hand), 4 (Max token, no required check) and 11; the out-of-
  scope items are absent.
- Every gate in section 10 names the mechanism it exercises, which is the intent's success
  measure that every mechanism is exercised once.
- Prompt used to produce this draft, for the record: read the accepted intent and produce a
  requirements and design spec for the process change, applying the three skills where they bear,
  documenting every mechanism, its files, its behaviour and its proof, and describing every area
  of concern for the product owner with a recommendation each.
