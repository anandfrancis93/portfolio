# Spec: move this repository onto the ADLC

Status: draft.
Derived from: `intent.md` (accepted 23 October 2026, PR #4).
Constraints applied: the ADLC at release v0.6.0 (`README.md`, `docs/`, `templates/` and
`.github/workflows/adlc*.yml` of https://github.com/anandfrancis93/ADLC at that tag); the
`web-quality` skill's rules on deploy configuration apply to the `deploy` workflow change; the
`acme-design-system` and `portfolio-voice` skills constrain nothing, since no page, style or copy
changes. Companion documents: spec 002 (the review loop, fix mode, the evals), spec 003 (the
watch and its heartbeat), spec 004 (the stand-in address) and `docs/runbook.md`.

The ADLC is named by its release. Where a later release lands before the build, the build syncs
to that release instead and reads its changelog's **Breaking** lines first.

## 1. What this change delivers

- `adlc.py sync` from the release tag has written the managed files and `.adlc/version`, and
  `checks`, `t3-approval` and `pr-title` run on every pull request.
- One rule for each thing. Where this repository and the ADLC both had one, the repository's
  copy is gone (section 8 lists each).
- `pnpm verify` runs once per change: in the ADLC's `checks` job, on the pull request. No
  workflow runs it again on `main`, and no instruction asks for it locally.
- One review per pull request: the `review` workflow's, against a `REVIEW.md` built on the
  ADLC's template.
- The site's gates, the `production` approval, the watch and the preview deploy work as today.
- `AGENTS.md` holds the repository's facts in under 60 lines. `CLAUDE.md` is `@AGENTS.md`.

## 2. The sync

- The build runs, on a new branch:
  `python3 <ADLC at v0.6.0>/scripts/adlc.py sync .` (no `--releases`: the site deploys from
  `main` and ships no versions, so `CHANGELOG.md` and `adlc-release.yml` are not added).
- Managed files written: `.adlc/version`, `.adlc/scripts/adlc.py`, `.githooks/pre-commit`,
  `.github/workflows/adlc.yml`, `adlc-review.yml`, `adlc-pr-title.yml`, `adlc-dependabot.yml`
  and `.github/pull_request_template.md`. The last replaces this repository's template; its
  evidence list is already in `REVIEW.md`, "Evidence the PR must carry", and stays there (6.3).
- Repo-owned files added from templates, then filled in by the build: `AGENTS.md`, `.adlc/tiers`,
  `.adlc/protected`, `.adlc/install`, `.adlc/fast-check`, `.adlc/full-test`,
  `.adlc/retire-log.md` and `.github/dependabot.yml`. Sync leaves `REVIEW.md` and
  `.editorconfig`, which exist, as they are; the build edits `REVIEW.md` by hand (6.2) and keeps
  `.editorconfig`.
- No managed file is edited afterwards. The `drift` step of `checks` proves it on every pull
  request.

## 3. The repository-owned ADLC files

### 3.1 `.adlc/tiers`

Highest match wins; an unmatched file is T2.

- T1: `docs/**`, `**/*.md`, `**/*.css`, `public/**` (the favicon and `robots.txt`).
- T3: `.github/**`, `.adlc/**`, `.githooks/**`, `.claude/**`, `AGENTS.md`, `CLAUDE.md`,
  `REVIEW.md`, `docs/specs/**`, `docs/sdlc/**`, `wrangler.jsonc`, `package.json`,
  `pnpm-lock.yaml`, `.nvmrc`, `src/config/headers.mjs`, `src/content/contact.ts`,
  `scripts/deploy.mjs`, `scripts/check-address.mjs`, `scripts/lib/address.mjs`,
  `scripts/lib/stand-in.mjs`, `scripts/check-credential-use.mjs` and
  `scripts/lib/credential-use.mjs`.
- T2: everything else, among it `src/**` pages, components and scripts, `tests/**` and the other
  scripts.

T3 covers the gates, the deploy, the headers and the address because a mistake there breaks a
release, a security header or intent 004 without a visible change on the page. `src/styles/
tokens.css` is CSS and so T1, but it is generated, and `pnpm check` fails a hand edit.

### 3.2 `.adlc/install`, `fast-check`, `full-test`

- `install`: `corepack enable`, then `pnpm install --frozen-lockfile`. Corepack ships with Node
  22 and reads `packageManager` (`pnpm@9.15.0`) from `package.json`.
- `fast-check` (pre-commit, staged files only):
  - refuses a commit on `main`, as the user-level hook does today;
  - formats the staged files with Prettier and lints CSS and Astro files with stylelint, both
    through `pnpm exec`, then stages the result; under `ADLC_CHECK_ONLY=1` it checks and writes
    nothing;
  - runs `scripts/check-address.mjs` on the staged files, so the address never reaches a commit.
- `full-test` (CI only): exports `WRANGLER_SEND_METRICS=false` and `ASTRO_TELEMETRY_DISABLED=1`,
  installs Chromium with `pnpm exec playwright install --with-deps chromium`, then runs
  `pnpm verify`.

### 3.3 `.adlc/protected`

Empty at the start. A bug fix follows the ADLC: the failing test and its line here in one commit,
the fix in later commits, the line removed in the pull request's last commit (section 8).

### 3.4 `.github/dependabot.yml`

The template's `github-actions` and `npm` entries. `npm` covers pnpm's lockfile. The ADLC's own
workflows stay ignored. The `pnpm.overrides` and `auditConfig` silences in `package.json` stay,
and `pnpm check-advisories` keeps watching them on Mondays.

### 3.5 Node

`.node-version` becomes `.nvmrc`, same content (`22.21.0`), because the ADLC's `checks` job sets
up Node from `.nvmrc` only. Every `node-version-file:` in this repository's workflows, the config
tests and `AGENTS.md` follow.

## 4. CI

### 4.1 Removed

`ci.yml` goes. Its `ci` job is the ADLC's `checks`. Its `reports` artifact goes with it, since
the ADLC's job uploads nothing (concern 3).

### 4.2 The heartbeat

The `watch heartbeat` job moves unchanged, name included, into a new `heartbeat.yml` that runs on
`pull_request`. It stays not required.

### 4.3 Required checks

The `main` ruleset requires `adlc / checks`, `adlc / t3-approval` and `pr-title / pr-title`, as
courses' do, in place of `ci`. Its other rules stay: up to date before merging, resolved review
threads, no deletion, no force push.

## 5. What the deploy and the measures read

### 5.1 Production release and rollback

Today both jobs refuse unless a check run named `ci` passed on `github.sha`. With `ci.yml` gone,
the step becomes "require a green ADLC check for this commit":

1. Find the merged pull request for the commit (`GET /repos/{repo}/commits/{sha}/pulls`). None,
   or more than one: refuse.
2. Read the latest `adlc / checks` check run on that pull request's head commit. Not `success`:
   refuse.
3. Compare the tree of the `main` commit with the tree of the head commit. Different: refuse.

The ruleset makes a pull request be up to date with `main` before it merges, so a squash or a
merge commit has the head commit's tree, and step 3 passes for every merge the ruleset allowed.
The step's name and its log line say "checks" in place of "ci". No other step of `deploy.yml`
changes, so spec 003's step windows stay as they are.

### 5.2 `pnpm measure`

It reads the first `adlc / checks` run in place of the first `ci` run. The column keeps its
meaning: green on the first commit that has one. "Reviews by the session" counts zero from this
change on, since the pre-flight reports go (6.1).

## 6. Review

### 6.1 One review

- The `review` workflow is the one review. It already runs in a session that did not write the
  change, on every push, and posts one review.
- The session that wrote the change no longer runs the passes, posts no pre-flight reports and
  has no verifier. `.claude/agents/verifier.md` goes.
- `ADLC_REVIEWERS` is `claude[bot]`, the login the workflow posts as, so `review-budget` counts
  its rounds. After two rounds the PR gets `adlc:owner-decides`, and the owner merges or closes
  it.
- The `claude` workflow, which answers an `@claude` mention by a commenter with write access,
  stays. It is not a review.

### 6.2 `REVIEW.md`

The ADLC template's sections, with this repository's content:

- What to check: bugs; accessibility, performance and security (the `web-quality` skill, as pass
  2 today); compliance with the spec and plan, the design system and the voice skill (pass 3).
- Tags: Important, Nit (at most five), Pre-existing. Only Important blocks.
- Do not report: as today, plus anything `checks` enforces.
- Rounds: the template's.
- The "Where findings live" and pre-flight paragraphs go.

### 6.3 Evidence

The evidence a pull request carries moves from the template into `REVIEW.md`, where the review
checks it: for a bug fix, the pinning test's failing CI run; for a visual change, screenshots at
390, 768 and 1440 in both themes, the keyboard walk and the Lighthouse numbers; for a change under
`.claude/`, the owner's `pnpm eval:tasks` output, and under `.claude/skills/`, `pnpm eval:skills`.
`pnpm verify` output is no longer pasted: `checks` is the record.

## 7. Agent configuration

- `.claude/hooks/guard-tests.mjs`, its lines in `settings.json`, the `.claude/FIX_TASK` marker
  and the fix-mode procedure in the runbook go. `.adlc/protected` and the `protected` step hold
  the same rule for every tool (8).
- `.claude/hooks/format-on-edit.mjs` goes. The pre-commit fast check formats and lints the same
  files.
- `.claude/hooks/guard-deploy.mjs` stays. The ADLC has no deploy guard, and it is the only check
  that stops a local `wrangler deploy` before it runs. It gets a row in the retire log.
- The three skills stay. The ADLC's skills reach Claude Code through the ADLC plugin.
  `settings.json` names the public marketplace and enables `adlc@adlc`, so every session here has
  them (concern 4).
- `pnpm eval:skills` and `pnpm eval:tasks` stay, run by the owner only, each with a retire-log
  row.

## 8. One rule for each thing

| Thing | Removed from this repository | The ADLC's rule |
| --- | --- | --- |
| Review | Pre-flight passes, verifier, posting rule | One review, review budget |
| Full suite | Local `pnpm verify` as done; `ci` on `main` | `full-test` once, in `checks` |
| Fix mode | `guard-tests.mjs`, `FIX_TASK` | `.adlc/protected`, `protected` step |
| Formatting | `format-on-edit.mjs` | Pre-commit `fast-check` |
| Commit on `main` | User-level hook (outside the repository) | `fast-check` refusal |
| Plan per change | "Maintenance PR" rule, intent for all else | Tiers: T1 line, T2 issue, T3 spec |
| PR evidence | Template checklist | `REVIEW.md` evidence (6.3) |
| Merge | Merge commits, free-text titles | Squash, Conventional Commits title |

The user-level commit hook lives on the owner's MacBook. The runbook says it may go once the
pre-commit hook is in place, and that removing it is the owner's step.

## 9. Records

- Intents 001 to 005, their specs and plans stay in `docs/sdlc/`. `sdlc.test.mjs` keeps
  checking them.
- A T3 change after this one keeps its intent, spec and decision in one file,
  `docs/specs/YYYY-MM-DD-<slug>.md`, as the ADLC asks. Its plan is the accepted plan in the pull
  request. A T2 change keeps its intent in an issue, and a T1 change in one line of the pull
  request.
- `CLAUDE.md`'s rule that a plan departure updates `plan.md` in the same pull request becomes:
  a departure from an accepted plan is written in the pull request that departs.

## 10. `AGENTS.md`, `CLAUDE.md` and the runbook

- `AGENTS.md`: the template's sections. Commands keep one healthy line each, Conventions and
  "Things an agent gets wrong" keep the facts that are not process. Under 60 lines.
- `CLAUDE.md` is one line, `@AGENTS.md`, as in courses.
- `tests/config/claude-md.test.mjs` reads `AGENTS.md` and checks the same things there: every
  command it names exists, every healthy line it quotes is one the script prints.
- `docs/runbook.md` loses fix mode and the pre-flight, and gains: the sync PRs, the T3 label, the
  heartbeat's new home and the deploy gate's new reading.

## 11. GitHub settings

Done by the owner or through Remote Control on his MacBook, since a cloud session cannot change
settings:

- Variables `ADLC_OWNER` = `anandfrancis93` and `ADLC_REVIEWERS` = `claude[bot]`.
- The ruleset's required checks (4.3), set after the first pull request has run them, so their
  names are copied from its checks list.
- Merge options: squash only, title from the pull request, body from the pull request.
- Label `adlc:t3-approved` and `adlc:owner-decides`, if the first runs do not create them.

## 12. Gates

1. `adlc.py sync --check` at the release tag prints nothing to change.
2. On the first pull request after the build: `adlc / checks` (with `drift`, `protected`,
   `secrets`, `fast-check` and `full-test` passing), `adlc / t3-approval` and `pr-title / pr-title`
   are green; `pnpm verify` ran once; one review was posted.
3. A pull request that edits a managed file fails `drift`.
4. A pull request that fails `full-test` cannot merge.
5. A production release from the first `main` commit after the build passes the new step of 5.1
   and waits for the owner's approval; a dispatch from a commit no pull request merged is
   refused.
6. `pnpm measure` for the month counts the new pull requests' first `checks` run.
7. `AGENTS.md` is under 60 lines, and `CLAUDE.md` is `@AGENTS.md`.
8. No file names the address; the address check passes in `checks` and in the pre-commit hook.

## 13. Concerns

1. **Squash merges.** Decided by the owner on 23 October 2026: squash, as the ADLC does. Each
   pull request is one commit on `main`, titled by the pull request. The first squash merge is
   checked for the address as the first merge of intent 004 was.
2. **The deploy reads the pull request, not the commit.** 5.1 trusts the ruleset's "up to date"
   rule. Turning that rule off would let a merge commit hold a tree no `checks` run saw, and step 3
   would then refuse the release. Recommended: accept; a refusal is the safe failure.
3. **No CI artifact.** The `reports` artifact (the Playwright report, Lighthouse output, the PDF
   and the card) goes with `ci.yml`. A failure is read from the `checks` log instead, and the
   screenshots for a visual change are taken locally with `pnpm test:screens`. Recommended:
   accept; restoring it means an ADLC change, out of scope here.
4. **The plugin in `settings.json`.** Enabling `adlc@adlc` there changes `.claude/`, so the owner
   runs `pnpm eval:tasks` for that pull request. Recommended: accept; without it, a Claude Code
   session here does not see the ADLC skills.
5. **CI time.** `checks` installs Chromium each run, with no cache, which took ten minutes once on
   the preview job (PR #3). Recommended: accept for now, and record the time in the retire log;
   a cache needs an ADLC change.

## 14. Order of work

The plan sets the phases. One constraint it must keep: the ruleset requires `ci` until section 11
changes it, so the pull request that adds the ADLC keeps `ci.yml`, and a later one removes it.
