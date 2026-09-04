# anandfrancis.com

Personal portfolio for Anand Francis. Astro 7 static site, TypeScript, plain CSS driven by the
Acme design system tokens, deployed to Cloudflare Workers static assets with wrangler.
Node 22.18+, pnpm 9. Windows 11 dev machine; CI is Ubuntu.

## Process

This repo follows the AI-native SDLC. Read the intent the change belongs to under `docs/sdlc/`
before changing anything (`docs/sdlc/002-playbook-gaps/` for the current work,
`docs/sdlc/001-portfolio-v1/` for version one): `intent.md` (why), `spec.md` (what), `plan.md`
(how, phase by phase). Code that departs
from `plan.md` updates `plan.md` in the same PR. Every change arrives as a PR to `main`: a GitHub
ruleset on `main` requires a PR and a green `ci` check and forbids force pushes, and on Francis's
machine a user-level hook also refuses `git commit` while on `main`. Review follows `REVIEW.md`:
the `review` workflow runs its three passes on every pull request and posts them, the session
runs the same passes as a pre-flight and posts every report before asking for a merge, and a
comment on a pull request that mentions `@claude` brings the agent back through the `claude`
workflow. When a release record is written into a plan, the intent's status line is updated in the
same PR.

Bug-fix tasks run in fix mode: create the empty marker file `.claude/FIX_TASK` before starting
(it is git-ignored). While it exists, a hook refuses changes to tests, to the files that decide
what the gates check, and to the files that decide what the hook and the definition of done are
(`package.json`, `.claude/settings.json`, the hooks, `REVIEW.md`, `.github/expiry.json`, the
marker itself), whether
through the Edit and Write tools or through a shell command that writes, moves or deletes
(`sed -i`, a redirect onto the file, `tee`, `cp`, `mv`, `rm`, `git restore`, the PowerShell file
cmdlets), including inside `bash -c`, `eval`, `find -exec` or a program passed to `node -e` or
`python -c`. Reading those files stays allowed. The guard judges command lines, not programs: a
script written elsewhere and then run, or a patch file applied, carries its paths out of sight,
so during a fix task do not route an edit through one; the review reads the test diff either
way. Open the PR first, then delete the marker: the hook allows that only once an open, non-draft
pull request exists for the branch, so the fix cannot weaken its own proof and fix mode cannot
end before review can see the change.

Three skills apply and load automatically: `acme-design-system` (visual values and rules),
`portfolio-voice` (copy), `web-quality` (accessibility, performance, security gates). A change
to a skill is proven with `pnpm eval:skills`, which Francis runs by hand before the PR is opened;
an agent never launches it, since it spends his subscription.

## Commands

- Install: `pnpm install`, then `pnpm exec playwright install chromium` (the build renders the
  résumé PDF and the social card with it)
- Dev: `pnpm dev` (healthy: a line ending in `Local    http://localhost:4321/`)
- Preview: `pnpm preview` serves `dist` through `wrangler dev` on http://127.0.0.1:8788 with the
  `_headers` and `_redirects` applied, as the Worker will; `PREVIEW_PORT` moves it, and the tests
  and Lighthouse follow, so a second checkout previews on its own port (healthy:
  `Preview on http://127.0.0.1:8788` then `Ready on http://127.0.0.1:8788`)
- Build: `pnpm build` (healthy: `[build] Complete!`, then `Wrote dist/anand-francis-resume.pdf`,
  `Wrote dist/og.png`, `Finalized dist`, `Wrote dist/_headers` and `JavaScript budget: N B gzip
  of 30720 B.`; `dist/index.html` exists)
- Check: `pnpm check` (healthy: `Result (N files):` followed by `- 0 errors`, `- 0 warnings`,
  `- 0 hints` on separate lines, then the token, fallback, content, voice and line-ending
  checks each printing a passing line, `Line endings: N text files, all LF.`, then
  `Expiry check: nearest expiry in N days` and the configuration tests, whose summary carries
  `# fail 0`)
- Config tests: `pnpm test:config` (the hooks against their payload tables, this file against
  the scripts and paths it names, the skills, the agent, the SDLC artifacts and the build's
  inline-script parser; also inside `pnpm check`; healthy: `# fail 0` in the summary)
- Skill eval: `pnpm eval:skills` sends a handful of prompts through headless Claude Code on the
  developer's own login and reports which skill each loaded; run by hand before any PR that
  changes a file under `.claude/skills/`, and paste the output in that PR (healthy:
  `Skill eval: N prompts, N pass, N miss` with 0 miss)
- Lint: `pnpm lint` (healthy: `All matched files use Prettier code style!` and no stylelint
  output; stylelint covers `.css` files and `<style>` blocks in `.astro` files)
- Test: `pnpm test` (Playwright against `pnpm preview`, started if the preview port is free; projects
  `a11y-light`, `a11y-dark`, `behaviour`, `screens`, `headers`, `pdf`; `pnpm test:a11y` runs the
  two a11y projects, `test:pdf`, `test:screens` and `test:headers` one each; set
  `PLAYWRIGHT_BASE_URL` to run against a deployed host with no server). Needs `pnpm build` first.
- Lighthouse: `pnpm lighthouse` (mobile then desktop, three runs each, the median against the
  floors in `lighthouserc.cjs`; `LIGHTHOUSE_URL` audits a deployed host; healthy:
  `Lighthouse: mobile and desktop at or above the floors`)
- Verify before reporting any task done: `pnpm verify` (check, lint, build, html, test,
  lighthouse, audit; the definition of done). Paste the output.
- Helpers: `pnpm sync:tokens` regenerates `src/styles/tokens.css` from the skill, `pnpm fonts:fallback`
  the metric-matched fallback faces, `pnpm build:qr` the QR SVG; `pnpm html` validates `dist`
  (part of verify); `pnpm format` writes Prettier's formatting.
- Deploy: `pnpm run deploy:preview` (needs `wrangler login` or the `CLOUDFLARE_*` variables);
  `pnpm run deploy:production` refuses without `RELEASE_APPROVAL`, and so does the hook.
- Rollback: `pnpm run rollback:preview` rolls the preview Worker back to the version before the
  current one, or to `--version <id>`, and prints the deployment status; `pnpm run
  rollback:production` refuses without `RELEASE_APPROVAL`, and so does the hook (healthy:
  `Rolled back preview to version`)
- Release: only the `deploy` workflow reaches production, by dispatch on `main` through the
  `production` environment, which waits for the owner's approval in GitHub:
  `gh workflow run deploy.yml -f action=release -f release_approval="<the approving message>"`;
  `-f action=rollback` with an optional `-f version_id=<full id>` rolls production back and
  runs the same smoke check; `-f action=rollback-preview` rolls the preview Worker back with no
  gate. The `watch` workflow runs the expiry check online monthly and by dispatch.
- Expiry: `pnpm check-expiry` reads `.github/expiry.json` (when each credential expires, when
  the rollback was last rehearsed, the interval) and fails within thirty days of an expiry or
  past the interval; also inside `pnpm check`; `--online` asks Cloudflare for the preview
  token's real expiry too (healthy: `Expiry check: nearest expiry in N days`)

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
