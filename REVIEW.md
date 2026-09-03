# Review instructions

Every PR is reviewed against this file. Run the three passes and tag each finding with its
pass. The reviewer does not approve or block on its own; a human merges through branch
protection, informed by the findings.

## Passes

1. **Bugs.** Logic errors, broken edge cases, regressions, anything that fails without
   JavaScript when the spec says it must work without it, wrong dates or names against
   `src/content/profile.yaml`.
2. **Accessibility, performance and security.** Everything in `.claude/skills/web-quality`:
   heading order, landmarks, focus visibility, target size, contrast pairings, reduced
   motion, no third-party requests, header policy, CSP with no inline styles and only the
   hashed bootstrap script.
3. **Compliance.** The change matches `docs/sdlc/001-portfolio-v1/spec.md` and the phase it
   claims in `plan.md`; it follows the design system principles (tokens not values, one way
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
since phase G it runs `pnpm verify` (types, the token sync, the font fallback, content, voice,
line endings, Prettier, stylelint, contrast, the QR byte check, the build with the PDF, the card,
the headers and the JavaScript budget, HTML validity, the Playwright suites in both themes,
Lighthouse mobile and desktop, the audit), so a finding one of those would catch is CI's, and
the reviewer's job is what a script cannot see.

## Evidence the PR must carry

Screenshots at 390, 768 and 1440 in both themes for any visual change; a description of the
keyboard walk; the Lighthouse numbers for the affected page; the output of `pnpm verify`
(or the phase A subset).
