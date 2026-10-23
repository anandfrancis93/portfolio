# Patch the zod and astro advisories

Date: 2026-10-23. PR: #25. Tier: T3.

## Intent

`pnpm audit --audit-level high`, the last step of `pnpm verify`, fails on `main`'s lockfile.
It passed on PR #23 at about 20:00 UTC on 23 October 2026. The lockfile has not changed since;
the advisory data has. Every pull request's `adlc / checks` now fails, PR #24 first
([run 40031450472](https://github.com/anandfrancis93/portfolio/actions/runs/40031450472/job/120680417075)).

The audit names three advisories:

- GHSA-mrhx-c7xc-m3w5 (high): zod below 4.6.6 "can exhaust memory while validating oversized
  constrained collections". Two copies are installed. Version 4.5.4 is the site's own and
  astro's. Version 3.25.76 comes through `@lhci/cli` › `lighthouse` › `puppeteer-core` ›
  `chromium-bidi`.
- GHSA-98hj-9722-w3j8 (moderate) and GHSA-mpr7-6m5w-76rw (low): astro 7.2.10. Both are
  patched in 7.3.3.

Only the high advisory fails the audit. The astro ones are fixed here too, since they need the
same two files.

A fourth advisory appeared during this pull request's first `adlc / checks` run, at 22:46 UTC:
GHSA-27r3-jxmh-p828 (high), body-parser below 1.20.9, through `@lhci/cli` › `express` 4.22.2.
That `express` asks for body-parser `~1.20.5`, so the lockfile moves to 1.20.9 with no override.

Constraints:

- No silence. `pnpm check-advisories` fails on a silenced advisory that has a patched version,
  and this one has.
- zod has no patched 3.x release. `chromium-bidi` 14.0.0 asks for zod `^3.24.1`.
  `puppeteer-core` 24.43.1 pins that `chromium-bidi`, `lighthouse` 12.6.1 asks for
  `puppeteer-core` `^24.10.0`, and `@lhci/cli` 0.15.1 pins `lighthouse` 12.6.1. That
  `@lhci/cli` is its latest release.
- `chromium-bidi` moved to zod 4 in 157.0.8082-0 (1 October 2026). `puppeteer-core` uses it
  from 25.13.0, which only `lighthouse` 13.4.0 and later accept.

Done when: `adlc / checks` passes on this pull request, and then on `main`.

## Tests to add

None. The failing test already exists: the audit step of `pnpm verify`, red on `main`'s
lockfile in run 40031450472. `pnpm lighthouse`, earlier in `pnpm verify`, shows that Lighthouse
still runs with the override below.

## Files in scope

- `package.json`: astro 7.3.3, zod 4.6.6, and the override `"chromium-bidi>zod": "$zod"`.
- `pnpm-lock.yaml`, with body-parser 1.20.9 inside its existing range.
- This spec.

## Out of scope

- The rest of Dependabot's grouped PR #18 (astro 7.4.1, zod 4.6.7 and eight more). It rebases
  onto this change.
- The three CVEs already listed in `pnpm.auditConfig.ignoreCves`.
- `legacy-javascript` 0.0.4, published on 23 October 2026 at 20:11 UTC. Lighthouse's trace
  engine asks for `latest`, so a fresh resolve picks it up. This change keeps the locked 0.0.3.

## Decision

- Choice: bump astro to 7.3.3 and zod to 4.6.6, the first patched versions. Give
  `chromium-bidi` the site's own zod through the override `"chromium-bidi>zod": "$zod"`. One zod
  copy is left, and it moves with the direct dependency. Move body-parser to 1.20.9 in the
  lockfile only.
- Alternatives:
  1. Override the `lighthouse` of `@lhci/cli` to 13.5.0, which reaches a zod 4 `chromium-bidi`
     through `puppeteer-core` 25.
  2. Override `chromium-bidi` to 157.0.8090-0 under `puppeteer-core` 24.
  3. Replace `@lhci/cli` with `lighthouse` called directly.
  4. Silence the advisory.
- Why: `chromium-bidi` is the WebDriver BiDi mapper. `puppeteer-core` loads it only for a BiDi
  connection, and Lighthouse 12 drives Chrome over CDP. A full Lighthouse 12.6.1 run on this
  lockfile, traced with a Node resolve hook, loaded 125 `puppeteer-core` modules and no
  `chromium-bidi` module. So the override changes code this repo never runs. Option 1 is a
  Lighthouse major version, and it can move the scores against the floors in
  `lighthouserc.cjs`. Option 2 pairs `puppeteer-core` 24 with a mapper it was not built for, on
  the same unused path. Option 3 rewrites `scripts/lighthouse.mjs`. Option 4 fails
  `pnpm check-advisories`.
- Known limit: on zod 4, `chromium-bidi` 14.0.0 accepts and rejects the same BiDi commands as on
  zod 3. Two things differ. An accepted command gains the schema's own defaults, such as
  `userActivation: false`. A rejected command throws a `TypeError` instead of its
  `InvalidArgumentException`, because the mapper reads `error.errors`, which zod 4 removed. All
  72 of its parsers were run on 16 inputs each, on both zod versions. This matters only if
  something here starts a BiDi session.
- Remove the override when the `lighthouse` that `@lhci/cli` installs depends on
  `chromium-bidi` 157.0.8082-0 or later. `pnpm why chromium-bidi` shows it.
