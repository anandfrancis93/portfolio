# Keep no credentials in the claude workflow's checkout

Date: 2026-10-23. PR: #27. Tier: T3.

## Intent

The review of Dependabot PR #17 (`actions/checkout` 4 to 7) found a risk in `claude.yml`
([review](https://github.com/anandfrancis93/portfolio/pull/17#pullrequestreview-5635554550)).
That workflow checks out with the default `persist-credentials: true`. Claude then runs
`git push origin HEAD`. On checkout v7, that push may use `GITHUB_TOKEN` instead of the
action's app token. This change sets `persist-credentials: false` on that checkout, so #17 can
merge.

What I checked on 23 October 2026:

- Checkout v4 (tag `v4`, `11d5960`) writes the `GITHUB_TOKEN` header into `.git/config`
  itself
  ([source](https://github.com/actions/checkout/blob/11d5960a326750d5838078e36cf38b85af677262/src/git-auth-helper.ts#L275-L300)).
- Checkout v7 (tag `v7.0.1`, `3d3c42e`) writes it to a file under `$RUNNER_TEMP`. It links that
  file from `.git/config` with `includeIf.gitdir:<repo>/.git.path`
  ([source](https://github.com/actions/checkout/blob/3d3c42e5aac5ba805825da76410c181273ba90b1/src/git-auth-helper.ts#L360-L379)).
- The pinned `claude-code-action` (`fa2b266`) removes the header from `.git/config` and from
  each `include.path` file. It reads no `includeIf` entry. It then puts its app token in the
  origin URL
  ([source](https://github.com/anthropics/claude-code-action/blob/fa2b2666b747000bf42767d1f332065b375e3c8f/src/github/operations/git-config.ts#L70-L134)).
  The action's `main` branch had the same file that day.
- A local test with git 2.43.0 built the v7 layout and ran the action's removal steps. The
  header survived. Git sent it on both requests and never sent the URL's token. With the v4
  layout, the header was removed and git sent the URL's token.
- A push made with `GITHUB_TOKEN` starts no `push` workflow. The `pull_request` runs it starts
  wait in an approval-required state until a user with write access approves them
  ([GitHub docs](https://docs.github.com/en/actions/concepts/security/github_token), read 23
  October 2026).

So on checkout v7, `adlc / checks` on Claude's fix commit would wait for the owner to approve
it. #17's review said no run would start; the docs say the run starts and waits. Either way, the
fix loop stops until the owner acts.

This is not a bug on `main` today. On checkout v4 the action removes the header.

Constraints:

- The checkout keeps `fetch-depth: 0`.
- The setting holds on checkout v4 and v7, so #17 needs no change to `claude.yml`.

Open questions:

- None. The known limit under Decision says when to revisit this.

Done when: `adlc / checks` passes on this pull request with the tests below. After #17 merges,
the first push from the claude workflow gets an `adlc / checks` run that needs no approval.

## Tests to add

In `tests/config/claude-workflow.test.mjs`:

- `is the job's one checkout`: the `respond` job has exactly one `actions/checkout@` step.
- `keeps no credentials`: that step sets `persist-credentials: false`.
- `still fetches the full history`: that step keeps `fetch-depth: 0`.

## Files in scope

- `.github/workflows/claude.yml`: the checkout step and the comment above it.
- `tests/config/claude-workflow.test.mjs`
- This spec.

## Out of scope

- The checkout bump itself, PR #17. It rebases onto this change.
- A fix in `claude-code-action` for `includeIf` entries.
- The checkouts in `deploy.yml` and `review.yml`. No later step in them pushes with git (#17's
  review).

## Decision

- Choice: set `persist-credentials: false` on the `respond` job's checkout.
- Alternatives:
  1. Keep the default, and wait for the action to clean `includeIf` entries.
  2. Add a step after the checkout that removes the `includeIf` entries and the credentials file.
  3. Keep this workflow on checkout v4.
- Why: with no kept header, git has one token to push with, the one the action sets. If the
  action sets none, the push fails loudly. `heartbeat.yml` and `watch.yml` already check out this
  way. Option 1 leaves the approval wait in place until an upstream release. Option 2 copies
  checkout's own cleanup into this repo, and breaks when checkout changes its layout. Option 3
  splits the checkout versions, and keeps v4's "Node.js 20 is deprecated" warning (#17's
  review).
- Known limit: the action fetches the pull request's branch before it sets its token
  ([source](https://github.com/anthropics/claude-code-action/blob/fa2b2666b747000bf42767d1f332065b375e3c8f/src/modes/tag/index.ts#L67-L97)).
  That fetch now runs with no token. It works because this repository is public. If the
  repository becomes private, revisit this choice.
