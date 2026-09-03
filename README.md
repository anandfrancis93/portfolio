# anandfrancis.com

Personal site of Anand Francis. Static, built with Astro, styled from the Acme design system
tokens, deployed to Cloudflare Workers static assets.

The site is developed under the AI-native SDLC: every change starts as an intent, becomes a
spec, then a plan, and only then code, with each artifact committed in `docs/sdlc/`. Start
with `docs/sdlc/001-portfolio-v1/intent.md` to see why the site exists, `spec.md` for what it
is, and `plan.md` for how it is built.

## Commands

```bash
pnpm install
pnpm exec playwright install chromium   # the build renders the PDF and the social card
pnpm dev        # local dev server
pnpm build      # production build into dist/, with the résumé PDF, og.png, _headers and _redirects
pnpm preview    # serve dist/ through wrangler dev, headers and redirects applied
pnpm check      # types and templates
pnpm lint       # prettier and stylelint
```

Node 22.18 or newer and pnpm 9 are required. `CLAUDE.md` holds the working conventions.
