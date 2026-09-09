# anandfrancis.com

Anand Francis's personal portfolio. Astro 7 static site, TypeScript, plain CSS driven by the
Acme design system tokens, deployed to Cloudflare Workers static assets with wrangler.
Node 22.18+, pnpm 9. Windows 11 dev machine; CI is Ubuntu.

## Process

This repo follows the AI-native SDLC. Before changing anything, read the intent it
belongs to under `docs/sdlc/` (`001-portfolio-v1` the site, `002-playbook-gaps` the process
work, both delivered; `003-credential-use` the credential watch, in progress): `intent.md` why,
`spec.md` what, `plan.md` how. Code that departs from `plan.md` updates it, and a release
record written into a plan updates the intent's status line, in the same PR. Every change
is a PR to `main`: the ruleset requires a green `ci`, and a user-level hook refuses
`git commit` on `main`. Review follows `REVIEW.md`: the `review` workflow posts three passes on
every PR or says why it could not, the session runs them as a pre-flight and posts every report,
the verifier's included, before asking for a merge, and `@claude` in a PR comment brings
the agent back.

A maintenance PR keeps an accepted decision true: upkeep with no behaviour change, a scanner
alert, a dependency, a tool's upkeep, or a shape the spec already defines, such as another role
in `profile.yaml`. Anything else gets an intent first, however small; and a change that adds a
promise, to a visitor or to the process, or loosens or reverses a decision an accepted intent
made, is never maintenance, whatever else it keeps true. A maintenance PR names no intent, says
so in its "Intent and plan section" line, and its description is the record; where it makes a
delivered spec or plan sentence untrue, it corrects it and records that in the plan, in the same
PR. It still takes the three passes, the verifier and `ci`.

Bug fixes run in fix mode: pin the bug with a failing test in its own commit, then create the
marker `.claude/FIX_TASK`, and while it exists a hook refuses any change to the tests and to the
files that decide what the gates check, through the tools and the shell alike; the marker can go
only once an open, non-draft PR exists for the branch. Fix the code, not the check, and never
route an edit through a script written elsewhere. The procedure is in `docs/runbook.md`.

Three skills load automatically: `acme-design-system` (visual values), `portfolio-voice` (copy),
`web-quality` (accessibility, performance, security). A skill change is proven with
`pnpm eval:skills`, a change under `.claude/` or to the model with `pnpm eval:tasks`; Francis
runs both by hand and an agent never launches them, since they spend his subscription
(`pnpm eval:tasks --dry-run` and `--clean` spend nothing and may; unlocking an eval worktree is
never an agent's).

## Commands

- Install: `pnpm install`, then `pnpm exec playwright install chromium`. Once per user account:
  `pnpm exec astro telemetry disable` and `pnpm exec wrangler telemetry disable`; the repository
  holds the CI half, in `wrangler.jsonc` and the `env` of every workflow that runs either tool.
- Dev: `pnpm dev` (healthy: a line ending in `Local    http://localhost:4321/`)
- Preview: `pnpm preview` serves `dist` through `wrangler dev`, headers and redirects applied;
  `PREVIEW_PORT` moves it (healthy:
  `Preview on http://127.0.0.1:8788` then `Ready on http://127.0.0.1:8788`)
- Build: `pnpm build` (healthy: `[build] Complete!`, then `Wrote dist/anand-francis-resume.pdf`,
  `Wrote dist/og.png`, `Finalized dist`, `Wrote dist/_headers` and `JavaScript budget: N B gzip
  of 30720 B.`; `dist/index.html` exists)
- Check: `pnpm check` (healthy: `Result (N files):` followed by `- 0 errors`, `- 0 warnings`,
  `- 0 hints`, a passing line from each fast check, `Line endings: N text files, all LF.`,
  `Expiry check: nearest expiry in N days` and a configuration-test summary carrying `# fail 0`)
- Config tests: `pnpm test:config` (the hooks, this file and the runbook, the skills, the agent,
  the SDLC artifacts, the inline-script parser, the telemetry settings; also inside `pnpm check`;
  healthy: `# fail 0` in the summary)
- Skill eval: `pnpm eval:skills` (which skill each prompt loads; healthy:
  `Skill eval: N prompts, N pass, N miss` with 0 miss)
- Task eval: `pnpm eval:tasks` (three pieces of real work, each in a throwaway worktree, graded,
  the output pasted in the PR; healthy: `Task eval: N tasks, N pass, N fail` with 0 fail)
- Lint: `pnpm lint` (healthy: `All matched files use Prettier code style!` and no stylelint
  output; stylelint covers `.css` files and `<style>` blocks in `.astro` files)
- Test: `pnpm test` (Playwright against `pnpm preview`; `pnpm test:a11y`, `test:pdf`,
  `test:screens` and `test:headers` run one group each; `PLAYWRIGHT_BASE_URL` targets a deployed
  host). Needs `pnpm build` first.
- Lighthouse: `pnpm lighthouse` (mobile and desktop, the median of three against the floors in
  `lighthouserc.cjs`; healthy: `Lighthouse: mobile and desktop at or above the floors`)
- Verify before reporting done: `pnpm verify`, the definition of done. Paste the output.
- Helpers: `pnpm sync:tokens` regenerates `src/styles/tokens.css`, `pnpm fonts:fallback` the
  metric-matched fallback faces, `pnpm build:qr` the QR SVG; `pnpm html` validates `dist`;
  `pnpm format` writes Prettier's formatting.
- Measures: `pnpm measure` reads a month's merged pull requests (`--month`, default the
  current); `--write` files it under `docs/measures/`, never edited by hand, a chore for the
  first week of each month (healthy: `Measures: N pull requests`)
- Deploy: `pnpm run deploy:preview` (needs `wrangler login` or the `CLOUDFLARE_*` variables);
  `pnpm run deploy:production` and `pnpm run rollback:production` refuse without
  `RELEASE_APPROVAL`, as does the hook. Production is reached only through the `deploy` workflow's
  `production` environment and the owner's approval; the dispatch forms are in the runbook.
- Rollback: `pnpm run rollback:preview` rolls the preview Worker back one version, or to
  `--version <id>` (healthy: `Rolled back preview to version`)
- Expiry: `pnpm check-expiry` reads `.github/expiry.json` and fails within thirty days of a
  credential's expiry or past the rollback rehearsal interval; inside `pnpm check` (healthy:
  `Expiry check: nearest expiry in N days`); `--online` asks Cloudflare for the real expiry of
  the token it holds, the one `--key` names, and `--verify-only` asks that alone.
- Advisories: `pnpm check-advisories` fails when an advisory silenced in `package.json` has a
  patched version; online only, so it runs in the Monday `watch`, never in `pnpm check` (healthy:
  `Advisory check: N silenced, none patched`)
- Watch: `scripts/check-credential-use.mjs` runs hourly with the read-only watch token and opens
  an issue on anything no deploy or rollback step accounts for; expiry, advisories and smoke run
  on Mondays. `ci` carries a `watch heartbeat` job, `scripts/check-heartbeat.mjs`, not required,
  red while the watch has not passed in three hours. The chores are in `docs/runbook.md`.

## Conventions

- Tokens, not values. Component CSS uses `var(--...)` only; stylelint enforces it. Literal values
  live only in `src/styles/tokens.css` (generated, never edited by hand),
  `tokens.site.css` and the font files.
- Class names mirror Figma variants: `.btn--primary`, `.btn--lg`, `.badge--success-subtle`.
  Element parts use `__`.
- Headings are semantic: one `h1`, `h2` per section, `h3` for entries even when styled as H4.
- Copy lives only in `src/content/profile.yaml`, never in a component, in US spelling, and the
  voice skill's banned words never appear. Comments, test names and the process documents keep
  British spelling (colour, behaviour, centred), so a search for `colour` finds tokens and
  comments, never copy.
- Scripts are Node ESM in `scripts/*.mjs`, never shell or PowerShell, so they run everywhere; the
  one CommonJS file, `scripts/lib/preview-port.cjs`, is the Lighthouse config's, which can only
  require.
- Line endings are LF, enforced by `.gitattributes`.
- No third-party requests, no analytics, no inline styles, one inline script (theme bootstrap).

## Architecture

- `src/pages/` routes: `index.astro`, `404.astro`, and `resume-print.astro` and `og-card.astro`,
  build-time only, rendered by `scripts/postbuild.mjs` into the PDF and the card then removed.
- `src/layouts/Base.astro` owns the head, theme bootstrap, skip link, header and footer;
  `src/components/` shared parts, `src/components/sections/` one file per home section.
- `src/styles/` tokens first, then base, components, sections, print. `src/scripts/` is the only
  client JavaScript: theme, menu, disclosure, reveal, scroll-spy.
- `scripts/` build and check tooling; `tests/` Playwright.
- `dist/_headers` (from `src/config/headers.mjs`, with the theme bootstrap's hash) and
  `dist/_redirects` (the `/resume` proxy) are written by the build, never by hand.

## Things Claude gets wrong

- Typing a hex colour or pixel value into component CSS instead of adding a named token.
- Deriving the HTML heading tag from the Figma style name.
- Putting copy in a component instead of `profile.yaml`.
- Writing files with PowerShell `Out-File` or `Set-Content`; use the Write tool or Node.
- Editing a test through the shell during a fix task instead of fixing the code.
- Deploying or rolling back production from a machine instead of dispatching the `deploy`
  workflow, the only path through the environment gate.
- Committing on `main`, or skipping the PR.
- Reporting done without running the checks and pasting their output.
