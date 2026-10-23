# Intent: move this repository onto the ADLC

Author: Anand Francis. Status: accepted by the product owner on 23 October 2026.
Delivered 23 October 2026 with phase D; see `plan.md`, section "Records".

## Problem

All my repositories are meant to follow one lifecycle, the ADLC
(https://github.com/anandfrancis93/ADLC). It keeps its rules in git hooks, CI and open formats
(`AGENTS.md`, Agent Skills), so any AI tool follows the same process. courses and health are on
release 0.6.0. This repository is not. It still runs the process it grew for itself: intents 001
to 004, `CLAUDE.md`, `REVIEW.md`, its own `ci`, `review` and `claude` workflows, and its own
hooks. The two processes overlap, and where they differ, this repository does more work for
each change than the ADLC asks:

- **Two reviews per pull request.** The `review` workflow posts the three passes, then the
  session that wrote the change runs the same three passes again and adds a verifier, and every
  report is posted. The ADLC asks for one review, in a session that did not write the change,
  where only an Important finding blocks and the owner decides after two rounds.
- **The full suite runs twice.** `CLAUDE.md` makes `pnpm verify` the definition of done before I
  am told a change is finished, and `ci` runs `pnpm verify` again. The ADLC runs each suite once
  per change, in CI, and keeps the local check to the staged files.
- **One long instruction file.** `CLAUDE.md` is 139 lines. The ADLC caps `AGENTS.md` at 60 lines
  of facts, and puts the process in the skills, hooks and CI.
- **Claude-only rules.** The fix-mode and deploy guards are Claude Code hooks, and another AI
  tool does not run them. Production has its own guards outside them (the `production`
  environment's reviewer and the `RELEASE_APPROVAL` check), but nothing outside Claude Code holds
  fix mode. The ADLC enforces that kind of rule in git hooks and CI (`.adlc/protected`, the
  `protected` and `secrets` steps).
- **No shared tiers or drift check.** A change to a heading and a change to the deploy workflow
  take the same path here. The ADLC sets a tier from the paths a change touches, asks for my
  approval only on T3, and fails a pull request whose copy of the ADLC differs from its release.
- **No secret scan in the repository's commit gate, and no Dependabot version updates.** GitHub
  push protection is on, and intent 003 names a local gate for the Claude token's shape, but
  nothing in this repository scans a staged change for secrets. This repository also has no
  `.github/dependabot.yml`.

## Proposed outcome

This repository follows the ADLC at its latest release, and keeps the gates that are about the
site itself.

1. **Synced from a release.** `adlc.py sync` from the latest ADLC tag writes the managed files and
   `.adlc/version`. The `drift` check is green, and each later ADLC release arrives here as a sync
   pull request, as in courses and health.
2. **One process, not two.** Where the ADLC and this repository's process cover the same thing,
   the ADLC's rule is the one that stays: risk tiers, one review per pull request, the review
   budget, the full suite once per change in CI, the T3 approval label, Conventional Commits pull
   request titles, the pre-commit secret scan, Dependabot and the retire log. The repository's own
   version of each is removed in the same change, so no rule exists twice.
3. **The site's gates stay.** What only this site needs stays, and runs as the ADLC's full test:
   types, tokens, content, voice, the address check, the configuration tests, the build with the
   PDF and the card, the headers, HTML validity, Playwright in both themes, Lighthouse and the
   audit. The `production` environment and my approval of each production deploy stay. So do the
   credential watch of intent 003 and the preview deploy. Each commit on `main` still gets the
   green verdict that the production release, the rollback and `pnpm measure` read. Today that is
   a check run named `ci`; the ADLC's checks run only on pull requests and under other names, so
   the spec says what those three read once `ci.yml` changes.
4. **A short `AGENTS.md`.** The facts of this repository go into `AGENTS.md`, under 60 lines.
   `CLAUDE.md` points to it. The process text that the ADLC now holds goes.
5. **The history stays readable.** Intents 001 to 005 stay under `docs/sdlc/`, with their status
   lines. The spec decides where a T3 change after this one keeps its intent and spec.

## Affected users and systems

- Visitors: nothing changes. The site, its headers and its deploys stay as they are.
- The repository: `.adlc/`, `.githooks/`, the ADLC caller workflows, `AGENTS.md`, `CLAUDE.md`,
  `REVIEW.md`, the pull request template (a managed file), `.github/dependabot.yml`, `ci.yml`,
  `review.yml`, `deploy.yml` and `scripts/measure.mjs` (both read the `ci` check), the Claude Code
  hooks and `settings.json`, `docs/runbook.md`, the configuration tests that read `CLAUDE.md`, the
  runbook and the hooks, and `package.json`. The ADLC's `checks` job sets up Node from `.nvmrc`,
  and this repository pins Node in `.node-version`, so the version file changes too.
- GitHub: the `main` ruleset's required checks change from `ci` to the ADLC's checks, the merge
  settings may change, and the repository gets the `ADLC_OWNER` and `ADLC_REVIEWERS` variables.
- My MacBook: Betterleaks v1.9.0 is installed already. `adlc.py sync` sets `core.hooksPath` to
  `.githooks` in the clone it runs in; any other clone of mine needs it set by hand.
- The ADLC: its `sync-repos` workflow starts to list this repository after each release.

## Constraints

- The repository stays public, so its Actions minutes stay free. The ADLC is public, so this
  repository can call its workflows.
- Intent 004 holds: the address stays out of every file, commit, pull request and log, and the
  ADLC's checks run with the stand-in address.
- Production is still reached only through the `deploy` workflow and its `production`
  environment. No ADLC step deploys.
- I run `pnpm eval:skills` and `pnpm eval:tasks` myself, and an agent never starts them, until a
  change removes them by the ADLC's retire rules.
- The ADLC's managed files are not edited here. Where one does not fit this repository, the fix
  is a change to the ADLC and a new release, not a local copy.
- The same process as every change until this one lands: this intent, a spec, a plan, reviewed
  pull requests.

## Out of scope

- Changes to the site, its copy or its design.
- Changes to the ADLC itself. If the spec finds a gap, it becomes a separate ADLC change, and
  this intent waits for that release.
- Rewriting intents 001 to 004 into the ADLC's spec format.
- wdd131 and cse210-student-template.

## Success measures

- `adlc.py sync --check` from the latest ADLC tag reports nothing to change.
- The first pull request after the change passes `checks` (with its `drift` step), `t3-approval`
  and `pr-title`, runs `pnpm verify` once, and gets one review.
- The first production release after the change runs, after my approval, from a `main` commit
  whose green verdict it reads.
- `AGENTS.md` is under 60 lines, and no rule is stated both in it and in the ADLC.
- The `main` ruleset requires the ADLC's checks, and a pull request with a failing `checks` job
  cannot merge.
- A production deploy still waits for my approval in the `production` environment.

## Open questions

- **Merge style.** The ADLC squash-merges and checks only the pull request title. This repository
  makes merge commits. The spec says which one it uses, and how the first merge in each style is
  checked for the address, as intent 004 did.
- **Where new T3 records live.** The ADLC keeps one file per T3 change in `docs/specs/`. This
  repository keeps an intent, a spec and a plan per change in `docs/sdlc/`, and courses kept its
  own folders. The spec picks one.
- **The `review` workflow.** It can be the one ADLC review, since it runs in a fresh session. The
  spec says whether it stays as it is, or follows the ADLC's `REVIEW.md` template, and what
  becomes of the verifier.
- **The Claude Code hooks.** The spec lists which of fix mode, the deploy guard and the format
  hook the ADLC covers, which stay, and which go.
- **The heartbeat.** The `watch heartbeat` job runs inside `ci` today. The spec says where it runs
  once `ci` goes.
- **The evidence list.** The pull request template asks for screenshots, a keyboard walk and the
  Lighthouse numbers on a visual change. The ADLC's template replaces it. The spec says where
  that rule lives, for example in `REVIEW.md`.
