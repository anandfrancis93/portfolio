# Plan: keep my email address off GitHub (from spec.md, 22 October 2026)

Status: draft, for the product owner's review.
Derived from `spec.md` (accepted 22 October 2026, PR #113, all five concerns accepted as
recommended). Departures during implementation are written back into this file in the same PR.

This plan names the address only as "the address". It never spells it, and no command in it
holds it: each command reads it from `CONTACT_EMAIL` in the owner's shell.

## Context

Stage 3 of the AI-native SDLC for the fourth intent. The intent (PR #112) and the spec (PR #113)
are accepted. The owner adds the repository secret `CONTACT_EMAIL` before phase A's pull request
opens (spec 6.1).

Verified on 22 October 2026, on `main` at `e4067b9`:

- Five tracked files spell the address: `src/content/profile.yaml` line 12,
  `scripts/check-voice.mjs` line 82, `.claude/skills/portfolio-voice/SKILL.md` line 56,
  `docs/sdlc/001-portfolio-v1/intent.md` line 33 and `docs/sdlc/001-portfolio-v1/spec.md`
  line 183. No other tracked file holds an address at the Gmail domain, and the repository
  tracks no image or PDF.
- Four components read `identity.email`: `Contact.astro`, `MobileMenu.astro`,
  `print/Resume.astro` and `404.astro`. The schema validates it with `z.email()` inside a strict
  object (`src/content/schema.ts` line 50).
- Eleven files call `loadProfile`, not the six spec 2.2 lists: `src/content/site.ts`,
  `scripts/check-content.mjs`, `check-voice.mjs`, `finalize-dist.mjs`, `build-qr.mjs`,
  `build-pdf.mjs`, `build-headers.mjs`, `tests/helpers/page.ts`, `tests/pdf.spec.ts`,
  `tests/e2e/content.spec.ts` and `tests/e2e/disclosure.spec.ts`.
- No client script imports `site.ts` or the profile, so no browser bundle can read the build's
  environment. `playwright.config.ts` already reads `process.env`, so `astro check` has Node's
  types.
- `deploy.yml`'s `preview` job runs `pnpm build` (line 103) and the `production` job runs it at
  line 157, each as an unnamed step. The `Headers spec against the deployed preview` step runs
  `tests/e2e/headers.spec.ts`, which reads no address. `watch.yml`'s smoke check uses the
  `smoke-check` action, which reads no address either.
- `git filter-repo` (the container's build, `a40bce548d2c`) runs `--email-callback` on author,
  committer and tagger addresses, and exposes `os` to every callback. A dry run on a scratch
  repository with a made-up address left no address in any author, committer, message or file,
  and the head tree unchanged.

## Decisions taken in this plan (the spec is not reopened)

1. **How a build reads `CONTACT_EMAIL` (spec 8, first point).** `process.env`, through one new
   module, `src/content/contact.ts`. It exports `STAND_IN` (`contact@example.com`) and
   `contactEmail(env = process.env)`, which returns the trimmed `CONTACT_EMAIL` or, when that is
   unset or empty, the stand-in. Astro's prerender runs in Node, so `site.ts` reads the same
   environment as the scripts and the tests. Not `astro:env` or `import.meta.env`: both read
   `.env` files, which spec 2.2 rules out, and neither works in the Node scripts.
2. **`loadProfile(source, email)`.** The second argument is required. `loadProfile` refuses a
   source that still holds `identity.email`, with a message that names `CONTACT_EMAIL`, then
   sets the field and validates as today. All eleven callers pass `contactEmail()`.
3. **The refusal (spec 3.3)** lives in `scripts/lib/stand-in.mjs` as `findStandIn(distDir)`,
   which returns the HTML files under `dist/` that contain `STAND_IN`. `scripts/deploy.mjs`
   calls it after its existing checks, before wrangler, and exits 1 with one line naming
   `CONTACT_EMAIL` and the first file. The refusal is also the proof of decision 1: a build that
   did not see the secret writes the stand-in, and the deploy refuses it.
4. **The Gmail-domain check (spec 4)** is `scripts/check-address.mjs` over
   `scripts/lib/address.mjs`. It lists the tracked files with `git ls-files -z`, reads each as
   text, and fails on an address at the Gmail domain. Its pattern is built from parts, so its own
   source does not match. A finding prints the file and the line number, never the line, so a
   `ci` log never repeats the address. It runs in `pnpm check` after `check-voice.mjs`.
5. **Where the search with the value runs (spec 8, second point).** On the owner's MacBook,
   inside phase B, as part of the rewrite's proof. That proof searches every file of every
   commit, the head included, so it is gate 2's second half too. No workflow step gets the value
   for a search.
6. **The order of work (spec 8, third point).** Three phases, below. The owner merges phase A
   and releases it before phase B.
7. **The rewrite reads the address from the owner's shell, not from a file.** The owner types
   it once into a hidden prompt (`read -rs CONTACT_EMAIL`). Three filter-repo callbacks read
   `os.environ["CONTACT_EMAIL"]`: the email callback maps it to the noreply address, the blob
   callback and the message callback replace it with the stand-in. So no mailmap or
   replace-text file holds the address, and no command Claude writes or reads does either. This
   departs from spec 6.2's "a mailmap and a replace-text file"; spec 6.2 is corrected in place
   in phase A's PR, marked with this date.
8. **Settings before the push.** Spec 6.3 pushes the rewritten `main` (step 3) before the
   settings and secrets (steps 4 and 5). This plan creates the empty repository, applies the
   settings and the secrets, and only then pushes. Pushed first, the hourly watch could run
   before its token exists and open "The watch failed", and the push's `ci` would run before
   the ruleset. Spec 6.3 is corrected in place in phase A's PR, marked with this date.
9. **The voice skill line.** The line changes the skill's body, not its description, so which
   skill a prompt loads cannot change. CLAUDE.md still asks for `pnpm eval:skills` on a skill
   change, and only the owner runs it, so phase A's PR asks him once.

## Departures from the intent, recorded here as spec concern 1 asked

- Intent outcome 1, "A build without the value fails": a build without the value uses the
  stand-in, and the deploy refuses the stand-in (spec 2.1, concern 1, accepted).
- Intent outcome 1, "a local build gets [the value] from a file that git ignores": a local build
  reads only the shell's environment (spec 2.2). `.gitignore` does not change.

## Repository layout (additions and changes)

```
src/content/contact.ts  src/content/profile.ts (changed)  src/content/site.ts (changed)  src/content/profile.yaml (changed)
scripts/lib/stand-in.mjs  scripts/lib/address.mjs  scripts/check-address.mjs
scripts/deploy.mjs (changed)  scripts/check-voice.mjs (changed)  scripts/check-content.mjs (changed)
scripts/finalize-dist.mjs  scripts/build-qr.mjs  scripts/build-pdf.mjs  scripts/build-headers.mjs (each changed)
tests/helpers/page.ts  tests/pdf.spec.ts  tests/e2e/content.spec.ts  tests/e2e/disclosure.spec.ts (each changed)
tests/config/contact.test.mjs  tests/config/address.test.mjs
.github/workflows/deploy.yml (changed)  package.json (changed)
.claude/skills/portfolio-voice/SKILL.md (changed)  CLAUDE.md (changed)  docs/runbook.md (changed)
docs/sdlc/001-portfolio-v1/intent.md  docs/sdlc/001-portfolio-v1/spec.md  docs/sdlc/001-portfolio-v1/plan.md (each changed)
docs/sdlc/004-email-off-github/spec.md (changed)  docs/sdlc/004-email-off-github/intent.md (changed, phase C)
```

## npm scripts (additions and changes)

`check` gains `node scripts/check-address.mjs` after `node scripts/check-voice.mjs`. Nothing
else.

## Order of work

Three phases, one pull request each for A and C, and B with no pull request. Every pull request
runs the pre-flight passes and the verifier, posts their reports, and carries `pnpm verify` at
its head, as CLAUDE.md requires.

### A. The build

- Hands-on, the owner's, before the PR opens: the repository secret `CONTACT_EMAIL`. Claude
  never sees its value.
- Files:
  - `src/content/contact.ts` (decision 1); `profile.ts` (decision 2, and its header comment);
    `site.ts` and the ten other callers (`contactEmail()`); `profile.yaml` drops
    `identity.email`.
  - `scripts/lib/stand-in.mjs` and `scripts/deploy.mjs` (decision 3).
  - `scripts/lib/address.mjs`, `scripts/check-address.mjs` and `package.json` (decision 4).
  - `scripts/check-voice.mjs` drops the address fact (spec 4).
  - `.github/workflows/deploy.yml`: the `pnpm build` steps of `preview` and `production` each
    gain `env: CONTACT_EMAIL: ${{ secrets.CONTACT_EMAIL }}`, and no other step does (spec 3.2).
    No step is added, named or renamed.
  - `tests/config/contact.test.mjs`: the stand-in when the variable is unset, empty or blank;
    the trimmed value when set; `loadProfile` refusing a source with `identity.email`; every
    caller of `loadProfile` passing `contactEmail()`, read from the eleven files; `findStandIn`
    against a temporary `dist/` with and without the stand-in; `deploy.mjs` exiting 1 on a
    temporary build with the stand-in, before wrangler runs; and `deploy.yml` giving
    `CONTACT_EMAIL` to exactly the two `pnpm build` steps, read through the `yaml` package.
  - `tests/config/address.test.mjs`: the pattern matches an address at the Gmail domain in any
    case, and not the stand-in or other domains; a finding names the file and line and not the
    text; `check-address.mjs`'s own source passes.
  - Documents (spec 5): the voice skill's line; intent 001 line 33 and spec 001 section 3.8 say
    "my public Gmail address"; spec 001 section 8 and CLAUDE.md's copy convention gain the
    exception; CLAUDE.md's Process line lists `004-email-off-github`, in progress; the runbook
    gains "The contact address"; plan 001 records the edits to its accepted spec and intent;
    spec 004 sections 2.2, 6.2 and 6.3 corrected in place for the eleven callers and decisions 7
    and 8, each marked with the date.
- Done: `pnpm verify` green at the head with no `CONTACT_EMAIL` set; the PR's preview deploy
  green, which proves the build saw the secret (decision 3); the owner checks the four places
  on the preview URL (gate 3); the owner runs `pnpm eval:skills` once (decision 9).
- Then: the owner merges, and releases through `deploy`'s `release` dispatch. The live site
  shows the address in the four places.
- Could go wrong: Vite replacing `process.env` in the prerender bundle, so the build never sees
  the secret. The preview deploy's refusal catches it; the fallback is Astro's `astro:env`
  with a server secret, recorded here as a departure. A Dependabot pull request has no secret,
  so its preview job skips, as today.

### B. The rewrite and the swap (no pull request)

On the owner's MacBook, by Claude through Remote Control with his approval in the thread, or by
the owner. One sitting.

1. Quiet: no merge and no deploy for 75 minutes before step 6 (spec 6.3).
2. Save the repository's settings, labels, ruleset, environment, environment secret names and
   repository secret names to a file outside the repository.
3. The rewrite, in a fresh clone of `main`, outside any other checkout:

   ```
   read -rs CONTACT_EMAIL && export CONTACT_EMAIL
   git filter-repo --force \
     --email-callback 'return b"23470013+anandfrancis93@users.noreply.github.com" if email == os.environ["CONTACT_EMAIL"].encode() else email' \
     --blob-callback 'blob.data = blob.data.replace(os.environ["CONTACT_EMAIL"].encode(), b"contact@example.com")' \
     --message-callback 'return message.replace(os.environ["CONTACT_EMAIL"].encode(), b"contact@example.com")'
   ```

4. The proof, which prints counts and tree ids only:

   ```
   git log --all --format='%ae%n%ce' | grep -c -F -e "$CONTACT_EMAIL"
   git log --all --format='%B' | grep -c -F -e "$CONTACT_EMAIL"
   git rev-list --all | while read -r c; do git grep -l -F -e "$CONTACT_EMAIL" "$c"; done | wc -l
   git rev-parse 'main^{tree}'
   ```

   The three counts are 0, and the tree id equals the old `main`'s. If any count is not 0, the
   sitting stops before step 5.
5. Rename `portfolio` to `portfolio-archive`, make it private, and disable its Actions.
6. Create an empty public `portfolio`. Apply the saved settings: merge options, labels, Actions
   permissions, the ruleset requiring `ci`, the `production` environment with its reviewer
   rule, code scanning, secret scanning, push protection and Dependabot security updates. The
   owner adds the five repository secrets and the `production` environment's secrets (spec 6.3
   step 5). Then push the rewritten `main` (decision 8).
7. Check that the Claude GitHub app reaches the new repository, dispatch `watch` once and see it
   green, then open phase C's pull request and see `ci`, `review` and the preview deploy green.
8. The owner sets his MacBook's `git config --global user.email` to the noreply address,
   confirms "Keep my email addresses private" is on, and turns on "Block command line pushes
   that expose my email" (spec 6.4).

- Could go wrong: the owner no longer holds a token's value, since Cloudflare shows a token once.
  He then rolls that token in Cloudflare, and if its expiry changes, phase C updates
  `.github/expiry.json`. A count in step 4 not 0, for example from a case difference: the
  sitting stops, and the callbacks are fixed and rerun on a fresh clone.

### C. The records and the close (in the new repository)

- Files: this file's "Records" (the proof's output from B step 4, the watch run, phase C's own
  checks, the first merge's author and committer); the note that pull request and issue numbers
  in the docs before this date belong to `portfolio-archive` (spec 6.4); intent 004's status line
  (delivered, with the date and a pointer to the records).
- Done: gate 6 recorded; the first merge in the new repository carries no address; `pnpm
  verify` at the head.

## Risks

- The rewrite changes every commit id. Links to commits in the docs and in old pull requests stop
  resolving in the new repository; they still resolve in the archive.
- Copies outside GitHub keep the address (spec concern 5, accepted).
- A typo in the secret reaches the preview first, and gate 3 catches it (spec concern 2).
- The phase A diff shows the address in its removed lines, in a public pull request. The archive
  becomes private in phase B, so that view goes with it.

## Proof (spec section 7, gate by gate)

| Gate | Check | Command or record | Phase |
| --- | --- | --- | --- |
| 1 `pnpm verify` green with no `CONTACT_EMAIL` | the PR's head | `pnpm verify`; `ci` | A |
| 2 the Gmail-domain check green; the search with the value empty | `address.test.mjs`; B step 4 | `pnpm check`; record | A, B |
| 3 the preview shows the address in the four places | the owner, on the preview URL | record | A |
| 4 the refusal proven | `contact.test.mjs` | `pnpm test:config` | A |
| 5 the rewrite's proof | B step 4's output | record | B, C |
| 6 the new repository's `ci` and `watch` green; its history and files hold no address | B step 7; B step 4 against a fresh clone of the new repository | record | B, C |

## Records

(Written as each phase closes.)

## Departures recorded during implementation

(None yet.)
