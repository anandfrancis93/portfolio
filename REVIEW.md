# Review instructions

Every PR is reviewed against this file, twice: the `review` workflow runs the three passes on
every pull request and posts them as one review, and the session that built the change runs the
same passes as a pre-flight before it asks for a merge. Run the three passes and tag each finding
with its pass. The reviewer does not approve or block on its own; a human merges through branch
protection, informed by the findings.

## Where findings live

On the pull request, whoever produced them. The `review` workflow posts its own. The session's
pre-flight posts each pass's report, and the verifier's, as review comments before a merge is
requested, and answers each finding with a fix or a reason in a follow-up comment. No pull request
is exempt, docs-only ones included. A comment on the pull request that mentions `@claude` brings
the agent back to it through the `claude` workflow. When the `review` workflow posts no review,
because the pull request changes `review.yml` itself or the action posted nothing, the job says
so in a review comment and its check fails; the pre-flight reports stand in.

## Passes

1. **Bugs.** Logic errors, broken edge cases, regressions, anything that fails without
   JavaScript when the spec says it must work without it, wrong dates or names against
   `src/content/profile.yaml`.
2. **Accessibility, performance and security.** Everything in `.claude/skills/web-quality`:
   heading order, landmarks, focus visibility, target size, contrast pairings, reduced
   motion, no third-party requests, header policy, CSP with no inline styles and only the
   hashed bootstrap script.
3. **Compliance.** The change matches the spec of the intent it names under `docs/sdlc/` and
   the phase it claims in that intent's `plan.md`; it follows the design system principles (tokens not values, one way
   to do each thing, never colour alone, movement explains); copy follows the voice skill.
   A departure from the plan is acceptable only if `plan.md` is updated in the same PR.

## What Important means here

Reserve Important for findings that would break behaviour, fail a quality gate in spec
section 10, leak data, or contradict the spec or plan. Style, naming and wording are nits.

## Cap the nits

Report at most five nits per review; summarise the rest as a count.

## Do not report

`dist/`, `pnpm-lock.yaml`, generated files (`src/styles/tokens.css`,
`src/styles/fonts.fallback.css`, `src/assets/qr-resume.svg`), and anything the `ci` workflow
enforces at the time of the review. Check `.github/workflows/ci.yml` rather than assuming:
since phase G of version one it runs `pnpm verify` (types, the token sync, the font fallback,
content, voice, line endings, the expiry dates, the configuration tests over the hooks, CLAUDE.md,
the skills and the SDLC artifacts, Prettier, stylelint, contrast, the QR byte check, the build with
the PDF, the card, the headers and the JavaScript budget, HTML validity, the Playwright suites in
both themes, Lighthouse mobile and desktop, the audit), so a finding one of those would catch is
CI's, and the reviewer's job is what a script cannot see.

## Evidence the PR must carry

The output of `pnpm verify`; the pre-flight reports and the verifier's report posted as review
comments; for a bug fix, the failing output of the pinning test, taken before the fix; for a
visual change, screenshots at 390, 768 and 1440 in both themes, a description of the keyboard
walk and the Lighthouse numbers for the affected page; for a change under `.claude/skills/`, the
output of `pnpm eval:skills`.
