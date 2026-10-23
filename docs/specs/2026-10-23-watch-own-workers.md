# Watch only the portfolio's own Workers

Date: 2026-10-23. PR: #24. Tier: T3.

## Intent

The credential-use watch (intent 003, `docs/sdlc/003-credential-use/`) reports every change to
the Cloudflare account that the portfolio's deploy workflows did not make. The `courses` and
`health` repos deploy their own Workers to the same account with their own tokens, so each of
their deploys is reported. The three reports after the fixes of 23 October (issue #6's
comments) held 77 findings: 74 were `courses` and `health` deploys and the uploads they
started, and 3 were Cloudflare's own certificate entries. Intent 003's measure, a normal
fortnight with no issue, cannot hold, and a real finding would be lost among them.

What the owner wants (Anand, 23 October 2026):

1. The watch stops reporting the `courses` and `health` deploys. It keeps reporting every
   change to the portfolio's two Workers, and every other change in the account.
2. Each site's deploy token can change only its own Worker. A stolen `courses` or `health`
   token then cannot change the portfolio.

Constraints:

- The portfolio's two deploy tokens stay judged everywhere. A write by either to another Worker
  is still reported (intent 003, outcome 1).
- The watch token gains no permission, and the report's allow-list (spec 003, section 2.4) does
  not change.
- The cost is accepted: nothing reports misuse of the `courses` or `health` tokens on their own
  Workers. Those repos may get their own watch later.

This supersedes one rule of intent 003's outcome 1, "Any actor other than the two deploy tokens
is reported whatever the time", for entries on a Worker that is not the portfolio's.

Open questions:

- Cloudflare gives a single-Worker scope only to an account-owned token: "To use granular
  permissions with Wrangler, authenticate with an account-owned API token"
  ([Cloudflare docs](https://developers.cloudflare.com/workers/authorization/), updated 15
  September 2026). The account has no account-owned tokens (dashboard, Account API tokens, 23
  October 2026). Part 2 therefore needs four new tokens, four new secrets in three repos, and
  the four old user tokens deleted.
- Does a token scoped to one Worker still need the account reads spec 002 section 3.1 lists
  for wrangler? The first preview deploy with the new token answers it.
- `pnpm check-expiry --online` verifies a token through `/user/tokens/verify`. I don't know if
  that call accepts an account-owned token. The first `--online` run answers it.

Done when:

- Part 1: `pnpm test:config` passes with the tests below, and the first watch run after a
  `courses` or `health` deploy reports none of that deploy's entries.
- Part 2: a preview deploy and a production release pass with the new tokens, and
  `pnpm check-expiry` passes with their dates.

## Tests to add

In `tests/config/credential-use-own-workers.test.mjs`, a new file so the protected list can name it alone:

- `another actor's write to another Worker is no finding`: a `courses deploy` token's
  `Upload Version` on `courses` gives no finding.
- `a delegated upload after another Worker's session is no finding`: a `delegated_service`
  `Upload Assets` whose nearest earlier upload session is on `health` gives no finding.
- `another actor on the portfolio's Workers is still reported`: a `courses deploy` token's
  write to `anandfrancis-com-preview` is an `unexpected actor` finding.
- `another actor on no Worker is still reported`: a dashboard or `system` write to a DNS record
  is an `unexpected actor` finding.
- `the portfolio's tokens are still judged on another Worker`: the preview token's write to
  `courses` is an `on another Worker than the step's` finding inside a preview window, and an
  `outside every window` finding outside one.
- `a delegated upload after the portfolio's own session is judged as before`: outside every
  window it is an `outside every window` finding.
- `a day of courses and health deploys leaves only the other findings`: entries shaped like
  issue #6's three comments give only the three `system` findings of 15:40:28 UTC.

In part 2, only where the records show a change:

- `tests/config/expiry.test.mjs`: the online check verifies an account-owned token, if the call
  differs.
- `tests/config/credential-use.test.mjs`: the expected token names, if the new tokens' names
  differ.

## Files in scope

- `docs/specs/2026-10-23-watch-own-workers.md`
- `scripts/lib/credential-use.mjs`
- `tests/config/credential-use-own-workers.test.mjs`, and `.adlc/protected` while the PR builds
- `docs/runbook.md`: "The watch", and the steps to replace the deploy tokens
- `docs/sdlc/003-credential-use/spec.md` and `plan.md`: a dated pointer to this spec where the
  actor rule changes
- Part 2, after the owner makes the tokens: `.github/expiry.json`, `scripts/check-expiry.mjs`
  and `tests/config/expiry.test.mjs` if the verify call differs, and a dated pointer in
  `docs/sdlc/002-playbook-gaps/spec.md` section 3.1

## Out of scope

- A watch for `courses` or `health`.
- Changes in the `courses` and `health` repos. The owner replaces their deploy secret only.
- Cloudflare's own `system` actions, such as the certificate entries of 23 October at 15:40 UTC.
  The watch still reports them as `other`.
- The hourly runs GitHub skips (2 of 16 ran on 23 October).
- The watch token. It stays a user token with two read permissions.

## Decision

- Choice: the watch skips an audit entry when its actor is not one of the portfolio's two
  deploy tokens and its path names a Worker other than the portfolio's two. It ties a
  `delegated_service` upload to the nearest earlier upload session, and skips the upload when
  it skips that session. Then each deploy token becomes an account-owned token with Editor on
  its one Worker; the production token keeps its zone route permission.
- Alternatives: keep reporting them and reword intent 003's measure; move `courses` and
  `health` to their own Cloudflare account; list the `courses` and `health` token names as
  expected actors.
- Why: every deploy write in issue #6 names its Worker in the path, except the delegated
  uploads, which follow their session. The portfolio's Workers stay fully judged, so the skip
  trusts no other token. The single-Worker scope then stops those tokens from changing the
  portfolio at all. A separate account gives no more protection for more dashboard work. Named
  tokens tie this repo to other repos' token names, and a renamed token brings the alarms back.
