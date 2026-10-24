# Patch the undici advisories

Date: 2026-10-24. PR: #26. Tier: T3.

## Intent

`pnpm audit --audit-level high`, the last step of `pnpm verify`, fails again. It passed on #26
at 23:37 UTC on 23 October 2026 and failed on #26 at 02:13 UTC on 24 October, after a rebase that
brought in no dependency change
([job 120749715154](https://github.com/anandfrancis93/portfolio/actions/runs/40053041334/job/120749715154)).
Every pull request's `adlc / checks` fails on it until this change merges.

Three advisories name undici 7.29.1, which `wrangler` › `miniflare` installs:

- GHSA-xjj6-f33q-929c (high): denial of service through an unhandled error on excessive
  content-encodings.
- GHSA-4qv8-2p9j-2685 (moderate): unbounded memory in the EventSource parser.
- GHSA-f72v-6w45-q472 (moderate): a Subresource Integrity bypass through non-lowercase algorithm
  tokens.

All three are patched in undici 7.30.1.

Constraints:

- No silence. `pnpm check-advisories` fails on a silenced advisory that has a patched version.
- `miniflare` pins undici 7.29.1 exactly. The newest `wrangler`, 4.152.0, brings `miniflare`
  5.20261019.2-beta, which pins the same version. So no `wrangler` update fixes it.

Done when: `adlc / checks` passes on #26.

## Tests to add

None. The failing test is the audit step, red in job 120749715154. The Playwright suites run
against `pnpm preview`, which serves the site through `wrangler dev`, so they exercise
`miniflare`'s undici.

## Files in scope

- `package.json`: the override `"miniflare>undici": "^7.30.1"`.
- `pnpm-lock.yaml`: undici 7.30.1 under `miniflare`. `legacy-javascript` stays at the locked
  0.0.3.
- This spec.

## Out of scope

- undici 8.12.3, the other copy in the lockfile. No advisory names it.
- The `wrangler` version.

## Decision

- Choice: override `miniflare`'s undici to `^7.30.1`. It resolves to 7.30.1 and stays on 7.x.
- Alternatives:
  1. Override to `>=7.30.1`, like the other overrides.
  2. Silence the three advisories.
- Why: option 1 resolves to undici 8.12.3, a major version this `miniflare` was not built for.
  Option 2 fails `pnpm check-advisories`.
- Known limit: this `miniflare` was built against undici 7.29.1, and 7.30 is a minor release.
  With the override, `pnpm preview` served the built home page with status 200 and the same
  29,599 bytes as on 7.29.1, and a missing path with 404.
- Remove the override when the installed `miniflare` asks for undici 7.30.1 or later.
  `pnpm why undici` shows it.
