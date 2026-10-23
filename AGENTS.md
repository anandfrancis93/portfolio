# anandfrancis.com

This repo follows the ADLC: https://github.com/anandfrancis93/ADLC
Keep this file under 60 lines. Facts only; process lives in the ADLC skills, hooks and CI.
Never edit the files the ADLC manages (the ADLC's docs/sync.md lists them). CI fails if they change.
Write all prose for people (PRs, commits, reviews, docs, replies) by the `adlc-writing` skill.

Anand Francis's personal portfolio: an Astro 7 static site in TypeScript, with plain CSS from the Acme design system tokens, served by Cloudflare Workers static assets. Node and pnpm versions: `.nvmrc` and `packageManager` in `package.json`. The owner works on a MacBook (macOS 26); CI is Ubuntu.

## Commands
- Install (exact, from the lockfile): `.adlc/install`; then `pnpm exec playwright install chromium`. Once per user account: `pnpm exec astro telemetry disable` and `pnpm exec wrangler telemetry disable`.
- Fast check (pre-commit, staged files): `.adlc/fast-check`.
- Full test suite (CI only): `.adlc/full-test` runs `pnpm verify`, the definition of done, once per PR in `adlc / checks`. Its run is the record; paste no output.
- Dev: `pnpm dev` (healthy: `Local    http://localhost:4321/`)
- Preview: `pnpm preview` serves `dist` through `wrangler dev`; `PREVIEW_PORT` moves it (healthy: `Preview on http://127.0.0.1:8788` then `Ready on http://127.0.0.1:8788`)
- Build: `pnpm build` (healthy: `[build] Complete!`, `Wrote dist/anand-francis-resume.pdf`, `Wrote dist/og.png`, `Finalized dist`, `Wrote dist/_headers`, `JavaScript budget: N B gzip of 30720 B.`)
- Check: `pnpm check` (healthy: `Result (N files):`, `- 0 errors`, `- 0 warnings`, `- 0 hints`, `Line endings: N text files, all LF.`, `Expiry check: nearest expiry in N days`, `# fail 0`)
- Config tests: `pnpm test:config`, also inside `pnpm check` (healthy: `# fail 0`)
- Lint: `pnpm lint` (healthy: `All matched files use Prettier code style!`); `pnpm format` writes Prettier's formatting.
- Test: `pnpm test` after `pnpm build`; `pnpm test:a11y`, `pnpm test:pdf`, `pnpm test:screens` and `pnpm test:headers` run one group; `PLAYWRIGHT_BASE_URL` targets a deployed host.
- Lighthouse: `pnpm lighthouse` (healthy: `Lighthouse: mobile and desktop at or above the floors`)
- Helpers: `pnpm sync:tokens` regenerates `src/styles/tokens.css`, `pnpm fonts:fallback` the fallback faces, `pnpm build:qr` the QR SVG; `pnpm html` validates `dist`.
- Skill eval, by the owner only: `pnpm eval:skills` (healthy: `Skill eval: N prompts, N pass, N miss`)
- Task eval, by the owner only: `pnpm eval:tasks` (healthy: `Task eval: N tasks, N pass, N fail`); an agent may run its `--dry-run` and `--clean`, which spend nothing.
- Measures: `pnpm measure`, `--write` files the month under `docs/measures/` (healthy: `Measures: N pull requests`)
- Deploy: `pnpm run deploy:preview`. `pnpm run deploy:production` and `pnpm run rollback:production` refuse without `RELEASE_APPROVAL`; production is reached only by dispatching the `deploy` workflow (`docs/runbook.md`).
- Rollback: `pnpm run rollback:preview` (healthy: `Rolled back preview to version`)
- Expiry: `pnpm check-expiry` (healthy: `Expiry check: nearest expiry in N days`)
- Advisories: `pnpm check-advisories`, online, in the Monday `watch` (healthy: `Advisory check: N silenced, none patched`)

## Releases
- Ships versioned releases: no. Each merge to `main` deploys preview; production is a gated dispatch.
- DESIGN.md: no. The design system is the `acme-design-system` skill and `docs/design-system/`.

## Risk tiers
Path-to-tier map: `.adlc/tiers`. Protected paths: `.adlc/protected`.
- A T3 change keeps its intent, spec and decision in `docs/specs/YYYY-MM-DD-<slug>.md`. Intents 001 to 005 stay in `docs/sdlc/`.
- A departure from an accepted plan is written in the pull request that departs.

## Conventions
- Tokens, not values: component CSS uses `var(--...)` only (stylelint). Literal values live only in `src/styles/tokens.css` (generated), `tokens.site.css` and the font files.
- Class names mirror Figma variants: `.btn--primary`, `.badge--success-subtle`; element parts use `__`.
- Headings are semantic: one `h1`, `h2` per section, `h3` for entries even when styled as H4.
- Copy lives only in `src/content/profile.yaml`, in US spelling, by the `portfolio-voice` skill. Comments, test names and process documents keep British spelling.
- The contact address is read from `CONTACT_EMAIL` at build time (`src/content/contact.ts`); no file spells it.
- Visual values: the `acme-design-system` skill. Accessibility, performance and security: the `web-quality` skill.
- Scripts are Node ESM in `scripts/*.mjs`, never shell or PowerShell. Line endings are LF (`.gitattributes`).
- No third-party requests, no analytics, no inline styles, one inline script (the theme bootstrap).

## Facts an agent would get wrong
- `resume-print.astro` and `og-card.astro` render only at build time, into the PDF and the card; `scripts/postbuild.mjs` removes them.
- `dist/_headers` (from `src/config/headers.mjs`, with the bootstrap's hash) and `dist/_redirects` are written by the build, never by hand.
- `.claude/hooks/guard-deploy.mjs` blocks a local production deploy or rollback; the ADLC plugin (`.claude/settings.json`, pinned to the synced tag) brings the rest.
- A sync pull request that moves `.adlc/version` also moves the plugin's `ref` in `.claude/settings.json`; the config tests fail until it does.
- A Dependabot pull request and one that changes `review.yml` get no workflow review; a fresh subagent posts the one review (`REVIEW.md`).
- The `watch heartbeat` check (`.github/workflows/heartbeat.yml`) is red when the hourly `watch` has not passed in three hours. It is not required.
- Write files with the Write tool or Node, never a shell redirect or PowerShell `Out-File`.
- Never type a hex colour or pixel value into component CSS; never derive the heading tag from the Figma style name.
- A clone where `adlc.py sync` did not run needs `git config core.hooksPath .githooks`.
