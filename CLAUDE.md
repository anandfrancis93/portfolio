# anandfrancis.com

Personal portfolio for Anand Francis. Astro 7 static site, TypeScript, plain CSS driven by the
Acme design system tokens, deployed to Cloudflare Workers static assets with wrangler.
Node 22.18+, pnpm 9. Windows 11 dev machine; CI is Ubuntu.

## Process

This repo follows the AI-native SDLC. Before changing anything, read the intent the change
belongs to under `docs/sdlc/` (`001-portfolio-v1` the site, `002-playbook-gaps` the process
work, both delivered): `intent.md` (why), `spec.md` (what), `plan.md` (how). Code that departs
from `plan.md` updates `plan.md` in the same PR; a release record written into a plan updates
the intent's status line in the same PR. Every change is a PR to `main`: the ruleset requires
one with a green `ci`, and a user-level hook refuses `git commit` on `main`. Review follows
`REVIEW.md`: the `review` workflow posts its three passes on every PR or says on it why it could
not, the session runs the same passes as a pre-flight and posts every report, the verifier's
included, before asking for a merge, and `@claude` in a PR comment brings the agent back through
the `claude` workflow.

A change to what a visitor sees or what the site promises belongs to an intent, however small;
one that fills a shape the spec already defines, such as another role in `profile.yaml`, does
not; upkeep with no behaviour change is maintenance. A maintenance PR names no intent, says so
in its "Intent and plan section" line, and its own description is the record; where it makes a
delivered spec or plan sentence untrue, it corrects it and records the change in that plan in
the same PR. It still takes the three review passes, the verifier and `ci`.

Bug fixes run in fix mode: pin the bug with a failing test in a commit of its own, then create
the marker `.claude/FIX_TASK`, and while it exists a hook refuses any change to the tests and to
the files that decide what the gates check, through the tools and the shell alike; the marker
can go only once an open, non-draft PR exists for the branch. Fix the code, not the check, and
never route an edit through a script written elsewhere, which carries its paths out of the
guard's sight. The full procedure, and the case of a bug in a file the guard fences, is in
`docs/runbook.md`.

Three skills load automatically: `acme-design-system` (visual values and rules),
`portfolio-voice` (copy), `web-quality` (accessibility, performance, security gates). A change
to a skill is proven with `pnpm eval:skills`, and a change under `.claude/` or to the model with
`pnpm eval:tasks`, which grades real work; Francis runs both by hand, and an agent never launches
them, since they spend his subscription.

## Commands

- Install: `pnpm install`, then `pnpm exec playwright install chromium` (the build renders the
  résumé PDF and the social card with it)
- Dev: `pnpm dev` (healthy: a line ending in `Local    http://localhost:4321/`)
- Preview: `pnpm preview` serves `dist` through `wrangler dev`, headers and redirects applied;
  `PREVIEW_PORT` moves it, and the tests and Lighthouse follow (healthy:
  `Preview on http://127.0.0.1:8788` then `Ready on http://127.0.0.1:8788`)
- Build: `pnpm build` (healthy: `[build] Complete!`, then `Wrote dist/anand-francis-resume.pdf`,
  `Wrote dist/og.png`, `Finalized dist`, `Wrote dist/_headers` and `JavaScript budget: N B gzip
  of 30720 B.`; `dist/index.html` exists)
- Check: `pnpm check` (healthy: `Result (N files):` followed by `- 0 errors`, `- 0 warnings`,
  `- 0 hints`, a passing line from each fast check, `Line endings: N text files, all LF.`,
  `Expiry check: nearest expiry in N days` and a configuration-test summary carrying `# fail 0`)
- Config tests: `pnpm test:config` (the hooks against payload tables, this file and the runbook
  against what they name, the skills, the agent, the SDLC artifacts, the inline-script parser;
  also inside `pnpm check`; healthy: `# fail 0` in the summary)
- Skill eval: `pnpm eval:skills` (which skill each of a handful of prompts loads; Francis runs it
  by hand before any PR that changes `.claude/skills/` and pastes the output; healthy:
  `Skill eval: N prompts, N pass, N miss` with 0 miss)
- Task eval: `pnpm eval:tasks` (three pieces of real work, each in a throwaway worktree, graded:
  copy that keeps the facts and the quote, styling through tokens, a fix under the marker that
  leaves the test alone; hand-run by Francis before any PR that changes a file under `.claude/`,
  output pasted in that PR; healthy: `Task eval: N tasks, N pass, N fail` with 0 fail)
- Lint: `pnpm lint` (healthy: `All matched files use Prettier code style!` and no stylelint
  output; stylelint covers `.css` files and `<style>` blocks in `.astro` files)
- Test: `pnpm test` (Playwright against `pnpm preview`, started if the port is free; projects
  `a11y-light`, `a11y-dark`, `behaviour`, `screens`, `headers`, `pdf`; `pnpm test:a11y`,
  `test:pdf`, `test:screens` and `test:headers` run one group each; `PLAYWRIGHT_BASE_URL`
  targets a deployed host). Needs `pnpm build` first.
- Lighthouse: `pnpm lighthouse` (mobile then desktop, the median of three against the floors in
  `lighthouserc.cjs`; `LIGHTHOUSE_URL` audits a deployed host; healthy:
  `Lighthouse: mobile and desktop at or above the floors`)
- Verify before reporting any task done: `pnpm verify` (check, lint, build, html, test,
  lighthouse, audit; the definition of done). Paste the output.
- Helpers: `pnpm sync:tokens` regenerates `src/styles/tokens.css` from the skill, `pnpm fonts:fallback`
  the metric-matched fallback faces, `pnpm build:qr` the QR SVG; `pnpm html` validates `dist`
  (part of verify); `pnpm format` writes Prettier's formatting.
- Deploy: `pnpm run deploy:preview` (needs `wrangler login` or the `CLOUDFLARE_*` variables);
  `pnpm run deploy:production` and `pnpm run rollback:production` refuse without
  `RELEASE_APPROVAL`, and so does the hook. Production is reached only through the `deploy`
  workflow's `production` environment and the owner's approval; the dispatch forms are in
  `docs/runbook.md`.
- Rollback: `pnpm run rollback:preview` rolls the preview Worker back to the version before the
  current one, or to `--version <id>` (healthy: `Rolled back preview to version`)
- Expiry: `pnpm check-expiry` reads `.github/expiry.json`, fails within thirty days of a
  credential's expiry or past the rollback rehearsal interval, and runs inside `pnpm check`;
  `--online` asks Cloudflare for the preview token's real expiry too (healthy:
  `Expiry check: nearest expiry in N days`)
- Advisories: `pnpm check-advisories` fails when an advisory silenced in `package.json` has a
  patched version; online only, so it runs in the weekly `watch`, never in `pnpm check`
  (healthy: `Advisory check: N silenced, none patched`)

## Conventions

- Tokens, not values. Component CSS uses `var(--...)` only; stylelint enforces it. Literal
  values live only in `src/styles/tokens.css` (generated from the skill; never edit by hand,
  run the sync script), `tokens.site.css`, and the font files.
- Class names mirror Figma variants: `.btn--primary`, `.btn--lg`, `.badge--success-subtle`.
  Element parts use `__`.
- Headings are semantic: one `h1`, `h2` per section, `h3` for entries even when styled as H4.
- Copy lives only in `src/content/profile.yaml`. Never hard-code a sentence in a component.
  US spelling throughout the copy. The voice skill's banned words never appear. Code comments,
  test names and the process documents keep the spelling the plan and spec use (British:
  colour, behaviour, centred), so a search for `colour` finds tokens and comments, never copy.
- Scripts are Node ESM in `scripts/*.mjs`, never shell or PowerShell, so they run everywhere. The
  one CommonJS file, `scripts/lib/preview-port.cjs`, exists because the Lighthouse config can
  only require it.
- Line endings are LF. `.gitattributes` enforces it; do not fight it with editor settings.
- No third-party requests, no analytics, no inline styles, one inline script (theme bootstrap).

## Architecture

- `src/pages/` routes: `index.astro`, `404.astro`, `resume-print.astro` and `og-card.astro`
  (build-time only, rendered by `scripts/postbuild.mjs` into the PDF and `og.png`, then removed
  from `dist`).
- `src/layouts/Base.astro` owns the head, theme bootstrap, skip link, header and footer.
- `src/components/` shared parts; `src/components/sections/` one file per home section.
- `src/styles/` tokens first, then base, components, sections, print.
- `src/scripts/` the only client JavaScript: theme, menu, disclosure, reveal, scroll-spy.
- `scripts/` build and check tooling; `tests/` Playwright.
- `dist/_headers` (from `src/config/headers.mjs`, with the hash of the theme bootstrap) and
  `dist/_redirects` (the `/resume` proxy to the PDF) are written by the build, never by hand.

## Things Claude gets wrong

- Typing a hex colour or pixel value into component CSS instead of adding a named token.
- Deriving the HTML heading tag from the Figma style name.
- Putting copy in a component instead of `profile.yaml`.
- Writing files with PowerShell `Out-File` or `Set-Content` (encoding and CRLF problems).
  Use the Write tool or Node.
- Editing a test through the shell (`sed -i`, a redirect) during a fix task; the guard refuses it
  and the answer is to fix the code, not the check.
- Running a production deploy or rollback from a machine instead of dispatching the `deploy`
  workflow's `release` or `rollback` action, which is the only path through the environment gate.
- Committing on `main` or skipping the PR.
- Reporting done without running the checks and pasting their output.
