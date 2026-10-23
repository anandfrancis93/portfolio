# Review instructions (ADLC review budget)

Every pull request gets one review against this file. The `review` workflow runs it, in a session
that did not write the change, and posts it as one review. Two kinds of pull request get no review
from the workflow: one that changes `review.yml`, since the action refuses to run from a workflow
file that differs from `main`'s, and one that Dependabot opens, since its run gets no repository
secret. For each, the session that drives the pull request runs the same review in a fresh
subagent that did not write the change, and posts its report as one review. The reviewer does not
approve or block on its own; the owner merges, informed by the findings. A comment on the pull
request that mentions `@claude` brings the agent back to it through the `claude` workflow.

## What to check

- Bugs: logic errors, broken edge cases, regressions, anything that fails without JavaScript when
  the spec says it must work without it, wrong dates or names against `src/content/profile.yaml`.
- Accessibility, performance and security: everything in `.claude/skills/web-quality`: heading
  order, landmarks, focus visibility, target size, contrast pairings, reduced motion, no
  third-party requests, header policy, CSP with no inline styles and only the hashed bootstrap
  script.
- Compliance: the change matches the record it names (a spec under `docs/specs/` or
  `docs/sdlc/`, the phase it claims in that intent's `plan.md`, or an issue); it follows the
  design system principles (tokens not values, one way to do each thing, never colour alone,
  movement explains); copy follows the voice skill. A departure from an accepted plan is
  acceptable only if the pull request that departs records it.

## Tags

- Important: would break behaviour, fail one of the spec's quality gates, leak data, or
  contradict the spec or plan. Only Important blocks. Say how to show it fails: an input, a test
  or a command.
- Nit: at most five per review; summarise the rest as a count. Style, naming and wording are
  nits. Never blocking.
- Pre-existing: a bug this pull request did not introduce. Report it; do not block.

## Do not report

- Style-only, diagnostics-only or cleanup-only findings.
- `dist/`, `pnpm-lock.yaml`, and the generated files: `src/styles/tokens.css`,
  `src/styles/fonts.fallback.css`, `src/assets/qr-resume.svg` and the monthly summaries under
  `docs/measures/`.
- Anything `adlc / checks` enforces at the time of the review. Its `full-test` step runs
  `pnpm verify` (types, the token sync, the font fallback, content, voice, the address, line
  endings, the expiry dates, the configuration tests over the hooks, AGENTS.md, the skills and the
  SDLC artifacts, Prettier, stylelint, contrast, the QR byte check, the build with the PDF, the
  card, the headers and the JavaScript budget, HTML validity, the Playwright suites in both
  themes, Lighthouse mobile and desktop, the audit). Read `.adlc/full-test` and `package.json`
  rather than assuming. A finding one of those would catch is the check's; the reviewer's job is
  what a script cannot see.

## Rounds

- After round 1, review only the new diff. Never repeat a finding already posted.
- Flag the class of bug, with every instance, not one line.
- Start the summary with the count of Important findings; say plainly when there is nothing to
  fix.

## Evidence the PR must carry

The review checks it. For a bug fix, the pinning test's failing `adlc / checks` run, taken before
the fix; for a visual change, screenshots at 390, 768 and 1440 in both themes, a description of
the keyboard walk and the Lighthouse numbers for the affected page; for a change under
`.claude/skills/`, the owner's output of `pnpm eval:skills`; for any change under `.claude/`, the
owner's output of `pnpm eval:tasks`. `pnpm verify` output is not pasted: `adlc / checks` is the
record.
