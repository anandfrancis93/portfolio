# anandfrancis.com

Personal portfolio for Anand Francis. Astro 7 static site, TypeScript, plain CSS driven by the
Acme design system tokens, deployed to Cloudflare Workers static assets with wrangler.
Node 22.18+, pnpm 9. Windows 11 dev machine; CI is Ubuntu.

## Process

This repo follows the AI-native SDLC. Read `docs/sdlc/001-portfolio-v1/` before changing
anything: `intent.md` (why), `spec.md` (what), `plan.md` (how, phase by phase). Code that departs
from `plan.md` updates `plan.md` in the same PR. Every change arrives as a PR to `main`; commits
directly on `main` are blocked by a hook. Review follows `REVIEW.md`.

Three skills apply and load automatically: `acme-design-system` (visual values and rules),
`portfolio-voice` (copy), `web-quality` (accessibility, performance, security gates).

## Commands

- Install: `pnpm install` (then `pnpm exec playwright install chromium` once tests exist)
- Dev: `pnpm dev` (healthy: "Local http://localhost:4321/")
- Build: `pnpm build` (healthy: ends with "Complete!" and `dist/index.html` exists)
- Check: `pnpm check` (healthy: "0 errors, 0 warnings, 0 hints")
- Lint: `pnpm lint` (healthy: "All matched files use Prettier code style!" and no stylelint output)
- Verify before reporting any task done: `pnpm verify` once phase G lands; until then
  `pnpm check && pnpm lint && pnpm build`. Paste the output.

## Conventions

- Tokens, not values. Component CSS uses `var(--...)` only; stylelint enforces it. Literal
  values live only in `src/styles/tokens.css` (generated from the skill; never edit by hand,
  run the sync script), `tokens.site.css`, and the font files.
- Class names mirror Figma variants: `.btn--primary`, `.btn--lg`, `.badge--success-subtle`.
  Element parts use `__`.
- Headings are semantic: one `h1`, `h2` per section, `h3` for entries even when styled as H4.
- Copy lives only in `src/content/profile.yaml`. Never hard-code a sentence in a component.
  US spelling throughout. The voice skill's banned words never appear.
- Scripts are Node ESM in `scripts/*.mjs`, never shell or PowerShell, so they run everywhere.
- Line endings are LF. `.gitattributes` enforces it; do not fight it with editor settings.
- No third-party requests, no analytics, no inline styles, one inline script (theme bootstrap).

## Architecture

- `src/pages/` routes: `index.astro`, `404.astro`, `resume-print.astro` and `og-card.astro`
  (build-time only, removed from `dist`).
- `src/layouts/Base.astro` owns the head, theme bootstrap, skip link, header and footer.
- `src/components/` shared parts; `src/components/sections/` one file per home section.
- `src/styles/` tokens first, then base, components, sections, print.
- `src/scripts/` the only client JavaScript: theme, menu, disclosure, reveal, scroll-spy.
- `scripts/` build and check tooling; `tests/` Playwright.
- `public/_headers` and `public/_redirects` ship with the static assets on Workers.

## Things Claude gets wrong

- Typing a hex colour or pixel value into component CSS instead of adding a named token.
- Deriving the HTML heading tag from the Figma style name.
- Putting copy in a component instead of `profile.yaml`.
- Writing files with PowerShell `Out-File` or `Set-Content` (encoding and CRLF problems).
  Use the Write tool or Node.
- Committing on `main` or skipping the PR.
- Reporting done without running the checks and pasting their output.
